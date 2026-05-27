"""
WhatsApp integration via local gateway (127.0.0.1:8000).

Gateway surfaces:
  Inbound:  gateway POSTs to /api/whatsapp/webhook  (X-Webhook-Key header)
  Outbound: we call app/services/whatsapp_gateway.py which routes to:
    - POST /api/v1/integrations/webhook   (action-routed, X-Webhook-Key)
    - GET/POST /api/v1/public/v1/...      (REST, Authorization: Bearer)

IMPORTANT: Your FastAPI app must NOT run on port 8000 if the gateway is on
           127.0.0.1:8000. Run your app on 8080:
               uvicorn app.main:app --port 8080

Existing endpoints (unchanged):
  GET  /api/whatsapp/webhook               — Meta-style verify handshake
  POST /api/whatsapp/webhook               — Inbound message from gateway
  GET  /api/whatsapp/contacts              — List CRM contacts
  GET  /api/whatsapp/contacts/{id}/messages
  POST /api/whatsapp/contacts/{id}/send    — Send plain text
  POST /api/whatsapp/contacts/{id}/link-student
  DELETE /api/whatsapp/contacts/{id}/link-student
  PATCH /api/whatsapp/contacts/{id}/assign
  GET  /api/whatsapp/unread-count

New endpoints added:
  POST /api/whatsapp/contacts/{id}/send-template  — Send approved template
  POST /api/whatsapp/contacts/{id}/send-media     — Send image/video/document
  POST /api/whatsapp/contacts/{id}/start-chatbot  — Trigger a chatbot flow
  POST /api/whatsapp/broadcasts/{id}/start        — Start a broadcast
  GET  /api/whatsapp/gateway/templates            — List templates from gateway
  GET  /api/whatsapp/gateway/chatbots             — List chatbots from gateway
  GET  /api/whatsapp/gateway/broadcasts           — List broadcasts from gateway
  GET  /api/whatsapp/gateway/contacts             — Gateway-side contact list
  POST /api/whatsapp/gateway/contacts/sync        — Push a student into gateway CRM
  GET  /api/whatsapp/health                       — Ping the gateway
"""
import hmac
import logging

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import (
    User, Student, UserRole,
    WhatsAppContact, WhatsAppMessage,
)
from app.services.whatsapp_gateway import gateway, GatewayError

logger = logging.getLogger("portal.whatsapp")

router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp"])
staff_roles = require_roles(UserRole.admin, UserRole.counsellor)


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    text: str


class SendTemplateRequest(BaseModel):
    template_name: str
    body_parameters: Optional[dict] = None
    dynamic_header_media_url: Optional[str] = None


class SendMediaRequest(BaseModel):
    media_type: str                  # "image" | "video" | "document" | "audio"
    media_url: str                   # publicly accessible URL
    caption: Optional[str] = None
    filename: Optional[str] = None   # for documents


class StartChatbotRequest(BaseModel):
    chatbot_id: int


class LinkStudentRequest(BaseModel):
    student_id: int


class GatewaySyncRequest(BaseModel):
    """Push a student's info into the gateway's own CRM contact list."""
    student_id: int

class SendDirectTextRequest(BaseModel):
    to: str
    text: str

# ─── Shared error handler for gateway errors ──────────────────────────────────

def _gateway_exc(e: GatewayError) -> HTTPException:
    return HTTPException(status_code=e.status_code, detail=str(e))


# ─── Inbound key verification ─────────────────────────────────────────────────

def _verify_inbound_key(request: Request) -> bool:
    if not settings.WHATSAPP_WEBHOOK_KEY:
        logger.warning("[WA] WHATSAPP_WEBHOOK_KEY not set — skipping verification")
        return True

    header_key = request.headers.get("X-Webhook-Key", "")
    query_key  = request.query_params.get("key", "")
    provided   = header_key or query_key

    if not provided:
        return False

    return hmac.compare_digest(provided, settings.WHATSAPP_WEBHOOK_KEY)


# ═══════════════════════════════════════════════════════════════════════════════
# WEBHOOK ENDPOINTS  (unchanged)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """
    Meta-style verification handshake + plain liveness probe.
    The gateway calls this on startup to confirm the webhook URL is reachable.
    """
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN:
        logger.info("[WA] Webhook verified")
        return PlainTextResponse(hub_challenge or "ok")

    return {"status": "ok", "service": "whatsapp"}


@router.post("/webhook", status_code=200)
async def receive_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    The local gateway POSTs inbound WhatsApp messages here.
    Handles Meta-style nested format AND the gateway's flat format.
    """
    if not _verify_inbound_key(request):
        logger.error("[WA] Invalid webhook key — dropping request")
        raise HTTPException(status_code=403, detail="Invalid webhook key")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    _process_webhook_payload(payload, db)
    return {"status": "ok"}


# ─── Webhook payload processing (unchanged) ───────────────────────────────────

def _process_webhook_payload(payload: dict, db: Session) -> None:
    try:
        if "entry" in payload:
            for entry in payload.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    if change.get("field") != "messages":
                        continue
                    name_map = {
                        c.get("wa_id", ""): c.get("profile", {}).get("name", "")
                        for c in value.get("contacts", [])
                    }
                    for msg in value.get("messages", []):
                        _upsert_inbound_message(msg, name_map, db)
                    for status_update in value.get("statuses", []):
                        _update_message_status(status_update, db)

        elif "from" in payload and "type" in payload:
            name_map = {
                payload.get("from", ""): payload.get("profile", {}).get("name", "")
            }
            _upsert_inbound_message(payload, name_map, db)

        elif "messages" in payload:
            name_map = {}
            for msg in payload.get("messages", []):
                _upsert_inbound_message(msg, name_map, db)

        else:
            logger.debug(f"[WA] Unrecognised webhook payload shape: {list(payload.keys())}")

    except Exception as e:
        logger.error(f"[WA] Webhook processing error: {e}", exc_info=True)


def _upsert_inbound_message(msg: dict, name_map: dict, db: Session) -> None:
    from_phone   = msg.get("from", "")
    wa_msg_id    = msg.get("id", "")
    msg_type     = msg.get("type", "text")
    display_name = name_map.get(from_phone, "")

    if not from_phone:
        return

    if wa_msg_id and db.query(WhatsAppMessage).filter(
        WhatsAppMessage.wa_message_id == wa_msg_id
    ).first():
        logger.debug(f"[WA] Duplicate {wa_msg_id} — skip")
        return

    contact = db.query(WhatsAppContact).filter(
        WhatsAppContact.phone_number == from_phone
    ).first()

    if not contact:
        contact = WhatsAppContact(
            phone_number=from_phone,
            wa_id=from_phone,
            display_name=display_name or from_phone,
        )
        db.add(contact)
        db.flush()
        logger.info(f"[WA] New contact: {from_phone}")
    elif display_name and not contact.display_name:
        contact.display_name = display_name

    contact.last_seen = datetime.utcnow()

    content = None
    media_url = None
    media_mime = None

    if msg_type == "text":
        content = msg.get("text", {}).get("body", "")
    elif msg_type in ("image", "audio", "document", "video", "sticker"):
        media_block = msg.get(msg_type, {})
        media_url   = media_block.get("url") or media_block.get("id")
        media_mime  = media_block.get("mime_type")
        content     = media_block.get("caption") or f"[{msg_type}]"
    elif msg_type == "location":
        loc     = msg.get("location", {})
        content = f"📍 {loc.get('name', '')} {loc.get('address', '')} ({loc.get('latitude')},{loc.get('longitude')})"
    elif msg_type == "interactive":
        reply   = msg.get("interactive", {})
        content = (reply.get("button_reply", {}).get("title") or
                   reply.get("list_reply", {}).get("title") or "[interactive]")
    else:
        content = f"[{msg_type} message]"

    wa_msg = WhatsAppMessage(
        contact_id=contact.id,
        wa_message_id=wa_msg_id or None,
        direction="inbound",
        message_type=msg_type,
        content=content,
        media_url=media_url,
        media_mime_type=media_mime,
        status="received",
        raw_payload=msg,
    )
    db.add(wa_msg)
    db.commit()
    logger.info(f"[WA] Saved inbound from {from_phone}: {(content or '')[:60]}")


def _update_message_status(status_update: dict, db: Session) -> None:
    wa_msg_id  = status_update.get("id")
    new_status = status_update.get("status")
    if not wa_msg_id or not new_status:
        return
    msg = db.query(WhatsAppMessage).filter(
        WhatsAppMessage.wa_message_id == wa_msg_id
    ).first()
    if msg:
        msg.status = new_status
        if new_status == "failed":
            errors = status_update.get("errors", [])
            msg.error_message = "; ".join(e.get("message", "") for e in errors)
        db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# CONTACT ENDPOINTS  (unchanged)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/contacts")
def list_contacts(
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
    search: Optional[str] = None,
    unlinked_only: bool = False,
    skip: int = 0,
    limit: int = 50,
):
    q = db.query(WhatsAppContact).options(
        joinedload(WhatsAppContact.student),
        joinedload(WhatsAppContact.messages),
    )

    if current_user.role == UserRole.counsellor:
        q = q.filter(
            (WhatsAppContact.assigned_to == current_user.id) |
            (WhatsAppContact.assigned_to == None)
        )

    if search:
        q = q.filter(
            (WhatsAppContact.phone_number.ilike(f"%{search}%")) |
            (WhatsAppContact.display_name.ilike(f"%{search}%"))
        )

    if unlinked_only:
        q = q.filter(WhatsAppContact.student_id == None)

    contacts = (
        q.order_by(
            WhatsAppContact.last_seen.is_(None),
            WhatsAppContact.last_seen.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )

    result = []
    for c in contacts:
        last_msg = max(c.messages, key=lambda m: m.created_at, default=None) if c.messages else None
        unread   = sum(1 for m in c.messages if m.direction == "inbound" and m.status == "received")
        student_name = None
        if c.student:
            student_name = f"{c.student.first_name or ''} {c.student.last_name or ''}".strip() or c.student.email

        result.append({
            "id":              c.id,
            "phone_number":    c.phone_number,
            "display_name":    c.display_name,
            "student_id":      c.student_id,
            "student_name":    student_name,
            "assigned_to":     c.assigned_to,
            "last_seen":       c.last_seen,
            "unread_count":    unread,
            "last_message":    last_msg.content if last_msg else None,
            "last_message_at": last_msg.created_at if last_msg else None,
            "created_at":      c.created_at,
        })

    return result


@router.get("/contacts/{contact_id}/messages")
def get_contact_messages(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
    skip: int = 0,
    limit: int = 100,
):
    contact = db.query(WhatsAppContact).filter(WhatsAppContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    db.query(WhatsAppMessage).filter(
        WhatsAppMessage.contact_id == contact_id,
        WhatsAppMessage.direction == "inbound",
        WhatsAppMessage.status == "received",
    ).update({"status": "read"})
    db.commit()

    messages = (
        db.query(WhatsAppMessage)
        .filter(WhatsAppMessage.contact_id == contact_id)
        .order_by(WhatsAppMessage.created_at.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        {
            "id":             m.id,
            "wa_message_id":  m.wa_message_id,
            "direction":      m.direction,
            "message_type":   m.message_type,
            "content":        m.content,
            "media_url":      m.media_url,
            "status":         m.status,
            "sender_user_id": m.sender_user_id,
            "error_message":  m.error_message,
            "created_at":     m.created_at,
        }
        for m in messages
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# SEND ENDPOINTS  (send unchanged + new ones added below it)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/contacts/{contact_id}/send")
async def send_text_message(
    contact_id: int,
    payload: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
):
    contact = db.query(WhatsAppContact).filter(WhatsAppContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Message text cannot be empty")

    outbound = WhatsAppMessage(
        contact_id=contact_id,
        direction="outbound",
        message_type="text",
        content=payload.text.strip(),
        status="sending",
        sender_user_id=current_user.id,
    )

    db.add(outbound)
    db.commit()
    db.refresh(outbound)

    try:
        result = await gateway.send_text(contact.phone_number, payload.text.strip())
        outbound.wa_message_id = gateway.extract_message_id(result)
        outbound.status = "sent"
        outbound.raw_payload = result
        contact.last_seen = datetime.utcnow()

    except GatewayError as e:
        outbound.status = "failed"
        outbound.error_message = str(e)
        db.commit()
        raise _gateway_exc(e)

    db.commit()
    db.refresh(outbound)

    return {
        "id": outbound.id,
        "wa_message_id": outbound.wa_message_id,
        "direction": outbound.direction,
        "message_type": outbound.message_type,
        "content": outbound.content,
        "status": outbound.status,
        "created_at": outbound.created_at,
    }

@router.get("/health")
async def whatsapp_health(current_user=Depends(staff_roles)):
    """
    Check if the WhatsApp gateway is configured and reachable.
    This endpoint should never crash the CRM if ngrok/gateway is offline.
    """
    try:
        result = await gateway.health()
        return {
            "crm_whatsapp": "ok",
            "gateway": result,
        }
    except Exception as e:
        logger.error(f"[WA] Health check failed: {e}", exc_info=True)
        return {
            "crm_whatsapp": "ok",
            "gateway": {
                "gateway_reachable": False,
                "gateway_url": settings.WHATSAPP_GATEWAY_BASE,
                "configured": bool(settings.WHATSAPP_WEBHOOK_KEY),
                "error": str(e),
            },
        }
    
@router.post("/contacts/{contact_id}/send-template")
async def send_template_message(
    contact_id: int,
    payload: SendTemplateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
):
    """
    Send a pre-approved WhatsApp template message to a contact.

    The template must be approved in your WhatsApp Business Manager.
    Use body_parameters to fill in the variables defined in your template.

    Example — if your template "application_update" has body:
        "Hello {{1}}, your application status is now {{2}}."
    Then send:
        {
          "template_name": "application_update",
          "body_parameters": {"1": "Rahul", "2": "Offer Received"}
        }

    Or if the gateway uses named vars:
        { "body_parameters": {"student_name": "Rahul", "status": "Offer Received"} }
    """
    contact = db.query(WhatsAppContact).filter(WhatsAppContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Persist before sending
    summary = f"[template: {payload.template_name}]"
    outbound = WhatsAppMessage(
        contact_id=contact_id,
        direction="outbound",
        message_type="template",
        content=summary,
        status="sending",
        sender_user_id=current_user.id,
    )
    db.add(outbound)
    db.commit()
    db.refresh(outbound)

    try:
        result = await gateway.send_template(
            to=contact.phone_number,
            template_name=payload.template_name,
            body_parameters=payload.body_parameters,
            dynamic_header_media_url=payload.dynamic_header_media_url,
        )
        outbound.wa_message_id = gateway.extract_message_id(result)
        outbound.status = "sent"
        logger.info(f"[WA] Template '{payload.template_name}' sent to {contact.phone_number}")
    except GatewayError as e:
        outbound.status = "failed"
        outbound.error_message = str(e)
        db.commit()
        raise _gateway_exc(e)

    db.commit()
    db.refresh(outbound)

    return {
        "id":            outbound.id,
        "wa_message_id": outbound.wa_message_id,
        "direction":     "outbound",
        "message_type":  "template",
        "content":       summary,
        "status":        outbound.status,
        "created_at":    outbound.created_at,
    }


@router.post("/contacts/{contact_id}/send-media")
async def send_media_message(
    contact_id: int,
    payload: SendMediaRequest,
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
):
    """
    Send a media message (image, video, document, audio) to a contact.

    The media_url must be a publicly accessible URL.
    Use this to share offer letters, invoices, or document checklists with students.

    Example — share a document PDF:
        {
          "media_type": "document",
          "media_url": "https://yourcdn.com/offer-letter-123.pdf",
          "caption": "Your offer letter from University of Toronto",
          "filename": "offer_letter_rahul.pdf"
        }
    """
    contact = db.query(WhatsAppContact).filter(WhatsAppContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    allowed_types = ("image", "video", "document", "audio")
    if payload.media_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"media_type must be one of: {', '.join(allowed_types)}",
        )

    content_summary = payload.caption or payload.filename or f"[{payload.media_type}]"

    outbound = WhatsAppMessage(
        contact_id=contact_id,
        direction="outbound",
        message_type=payload.media_type,
        content=content_summary,
        media_url=payload.media_url,
        status="sending",
        sender_user_id=current_user.id,
    )
    db.add(outbound)
    db.commit()
    db.refresh(outbound)

    try:
        result = await gateway.send_media(
            to=contact.phone_number,
            media_type=payload.media_type,
            media_url=payload.media_url,
            caption=payload.caption,
            filename=payload.filename,
        )
        outbound.wa_message_id = gateway.extract_message_id(result)
        outbound.status = "sent"
        logger.info(f"[WA] Media ({payload.media_type}) sent to {contact.phone_number}")
    except GatewayError as e:
        outbound.status = "failed"
        outbound.error_message = str(e)
        db.commit()
        raise _gateway_exc(e)

    db.commit()
    db.refresh(outbound)

    return {
        "id":            outbound.id,
        "wa_message_id": outbound.wa_message_id,
        "direction":     "outbound",
        "message_type":  payload.media_type,
        "content":       content_summary,
        "media_url":     payload.media_url,
        "status":        outbound.status,
        "created_at":    outbound.created_at,
    }


@router.post("/contacts/{contact_id}/start-chatbot")
async def trigger_chatbot(
    contact_id: int,
    payload: StartChatbotRequest,
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
):
    """
    Trigger a chatbot/automated flow for a contact.
    Get the chatbot_id from GET /api/whatsapp/gateway/chatbots.

    Use case: When a counsellor registers a new student, trigger an
    onboarding chatbot that collects their preferred intake and course.
    """
    contact = db.query(WhatsAppContact).filter(WhatsAppContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    try:
        result = await gateway.start_chatbot(
            to=contact.phone_number,
            chatbot_id=payload.chatbot_id,
        )
        logger.info(f"[WA] Chatbot {payload.chatbot_id} started for {contact.phone_number}")
        return {"message": "Chatbot triggered", "result": result}
    except GatewayError as e:
        raise _gateway_exc(e)

@router.post("/send-direct")
async def send_direct_text_message(
    payload: SendDirectTextRequest,
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
):
    """
    Send a WhatsApp text message directly to a phone number.
    Also stores/updates the contact and saves the outbound message in CRM DB.
    """

    phone = payload.to.strip()
    text = payload.text.strip()

    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")

    if not text:
        raise HTTPException(status_code=400, detail="Message text cannot be empty")

    contact = db.query(WhatsAppContact).filter(
        WhatsAppContact.phone_number == phone
    ).first()

    if not contact:
        contact = WhatsAppContact(
            phone_number=phone,
            wa_id=phone,
            display_name=phone,
            assigned_to=current_user.id,
        )
        db.add(contact)
        db.flush()

    outbound = WhatsAppMessage(
        contact_id=contact.id,
        direction="outbound",
        message_type="text",
        content=text,
        status="sending",
        sender_user_id=current_user.id,
    )

    db.add(outbound)
    db.commit()
    db.refresh(outbound)

    try:
        result = await gateway.send_text(phone, text)

        outbound.wa_message_id = gateway.extract_message_id(result)
        outbound.status = "sent"
        outbound.raw_payload = result
        contact.last_seen = datetime.utcnow()

    except GatewayError as e:
        outbound.status = "failed"
        outbound.error_message = str(e)
        db.commit()
        raise _gateway_exc(e)

    db.commit()
    db.refresh(outbound)

    return {
        "message": "Message sent",
        "contact_id": contact.id,
        "id": outbound.id,
        "to": phone,
        "text": text,
        "status": outbound.status,
        "wa_message_id": outbound.wa_message_id,
        "created_at": outbound.created_at,
    }
# ═══════════════════════════════════════════════════════════════════════════════
# BROADCAST ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/broadcasts/{broadcast_id}/start")
async def start_broadcast(
    broadcast_id: int,
    current_user=Depends(staff_roles),
):
    """
    Start a broadcast campaign configured in the gateway dashboard.
    Admin only — this sends to potentially many recipients.

    Use case: Blast a message to all students about an upcoming intake deadline.
    Get broadcast IDs from GET /api/whatsapp/gateway/broadcasts.
    """
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can start broadcasts")

    try:
        result = await gateway.start_broadcast(broadcast_id=broadcast_id)
        logger.info(f"[WA] Broadcast {broadcast_id} started by user {current_user.id}")
        return {"message": "Broadcast started", "broadcast_id": broadcast_id, "result": result}
    except GatewayError as e:
        raise _gateway_exc(e)


# ═══════════════════════════════════════════════════════════════════════════════
# GATEWAY REST API PROXY ENDPOINTS
# These give your frontend access to gateway-side data (templates, chatbots, etc.)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/gateway/templates")
async def list_templates(
    status: Optional[str] = Query(None, description="Filter: approved | pending | rejected"),
    current_user=Depends(staff_roles),
):
    """
    List all WhatsApp message templates from the gateway.
    Use this to build a template picker in your UI instead of hardcoding names.

    Returns the gateway's response directly — template names, statuses, and components.
    """
    try:
        return await gateway.list_templates(status=status)
    except GatewayError as e:
        raise _gateway_exc(e)


@router.get("/gateway/chatbots")
async def list_chatbots(current_user=Depends(staff_roles)):
    """
    List all chatbot flows configured in the gateway.
    Use the returned IDs with POST /contacts/{id}/start-chatbot.
    """
    try:
        return await gateway.list_chatbots()
    except GatewayError as e:
        raise _gateway_exc(e)


@router.get("/gateway/broadcasts")
async def list_broadcasts(current_user=Depends(staff_roles)):
    """
    List all broadcast campaigns in the gateway.
    Use the returned IDs with POST /broadcasts/{id}/start.
    """
    try:
        return await gateway.list_broadcasts()
    except GatewayError as e:
        raise _gateway_exc(e)


@router.get("/gateway/contacts")
async def list_gateway_contacts(
    search: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    current_user=Depends(staff_roles),
):
    """
    List contacts from the gateway's own CRM (not your DB).
    Useful to discover contacts that messaged you but aren't in your system yet.
    """
    try:
        return await gateway.list_gateway_contacts(search=search, limit=limit, offset=offset)
    except GatewayError as e:
        raise _gateway_exc(e)


@router.post("/gateway/contacts/sync")
async def sync_student_to_gateway(
    payload: GatewaySyncRequest,
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
):
    """
    Push a student's contact info into the gateway's CRM.
    Call this when you register a new student so the gateway knows who they are.
    This makes inbound messages from that student auto-recognized by the gateway.

    Also creates/updates the WhatsAppContact in your DB if the student has a phone number.
    """
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if not student.phone:
        raise HTTPException(
            status_code=400,
            detail="Student has no phone number. Add a phone number first.",
        )

    full_name = f"{student.first_name or ''} {student.last_name or ''}".strip() or student.email

    # Push to gateway CRM
    try:
        gateway_result = await gateway.upsert_gateway_contact(
            phone_number=student.phone,
            name=full_name,
            email=student.email,
        )
    except GatewayError as e:
        raise _gateway_exc(e)

    # Also ensure a WhatsAppContact row exists in your DB
    existing_contact = db.query(WhatsAppContact).filter(
        WhatsAppContact.phone_number == student.phone
    ).first()

    if not existing_contact:
        existing_contact = WhatsAppContact(
            phone_number=student.phone,
            display_name=full_name,
            student_id=student.id,
            assigned_to=student.counsellor_id,
        )
        db.add(existing_contact)
        db.commit()
        db.refresh(existing_contact)
        created = True
    else:
        # Link to student if not already linked
        if not existing_contact.student_id:
            existing_contact.student_id = student.id
            existing_contact.assigned_to = student.counsellor_id or existing_contact.assigned_to
            db.commit()
        created = False

    return {
        "message":         "Student synced to gateway",
        "student_id":      student.id,
        "student_name":    full_name,
        "phone":           student.phone,
        "contact_created": created,
        "gateway_result":  gateway_result,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# EXISTING ENDPOINTS  (unchanged)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/contacts/{contact_id}/link-student")
def link_student(
    contact_id: int,
    payload: LinkStudentRequest,
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
):
    contact = db.query(WhatsAppContact).filter(WhatsAppContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    contact.student_id  = student.id
    contact.assigned_to = student.counsellor_id or current_user.id
    db.commit()

    return {
        "message":      "Linked successfully",
        "contact_id":   contact_id,
        "student_id":   student.id,
        "student_name": f"{student.first_name or ''} {student.last_name or ''}".strip(),
    }


@router.delete("/contacts/{contact_id}/link-student", status_code=200)
def unlink_student(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
):
    contact = db.query(WhatsAppContact).filter(WhatsAppContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact.student_id = None
    db.commit()
    return {"message": "Unlinked"}


@router.patch("/contacts/{contact_id}/assign")
def assign_contact(
    contact_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
):
    contact = db.query(WhatsAppContact).filter(WhatsAppContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    user_id = payload.get("user_id")
    if user_id:
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        contact.assigned_to = user_id
    else:
        contact.assigned_to = None

    db.commit()
    return {"message": "Assigned", "assigned_to": contact.assigned_to}


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
):
    q = db.query(WhatsAppMessage).join(
        WhatsAppContact, WhatsAppMessage.contact_id == WhatsAppContact.id
    ).filter(
        WhatsAppMessage.direction == "inbound",
        WhatsAppMessage.status == "received",
    )

    if current_user.role == UserRole.counsellor:
        q = q.filter(
            (WhatsAppContact.assigned_to == current_user.id) |
            (WhatsAppContact.assigned_to == None)
        )

    return {"unread": q.count()}


