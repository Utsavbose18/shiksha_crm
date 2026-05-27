"""
app/services/whatsapp_gateway.py
─────────────────────────────────
Clean async client for the local WhatsApp gateway.

The gateway exposes TWO surfaces:
  1. Webhook (action-routed):  POST /api/v1/integrations/webhook
                               Header: X-Webhook-Key: <key>
                               Body:   { "action": "...", ...fields }

  2. REST API:                 base = /api/v1/public/v1
                               Header: Authorization: Bearer <key>
                               Standard CRUD endpoints for contacts, 
                               conversations, templates, chatbots, broadcasts.

All public functions in this module are async and raise GatewayError on failure.
Callers should catch GatewayError and return an appropriate HTTP response.

Usage:
    from app.services.whatsapp_gateway import gateway

    # Send plain text
    await gateway.send_text("+919876543210", "Hello!")

    # Send a pre-approved template
    await gateway.send_template(
        to="+919876543210",
        template_name="application_update",
        body_parameters={"student_name": "Rahul", "status": "Offer Received"},
    )

    # Send an image
    await gateway.send_media(
        to="+919876543210",
        media_type="image",
        media_url="https://yourcdn.com/offer-letter-preview.jpg",
        caption="Your offer letter is ready!",
    )

    # Trigger a chatbot flow
    await gateway.start_chatbot(to="+919876543210", chatbot_id=12)

    # Start a broadcast
    await gateway.start_broadcast(broadcast_id=4)

    # REST — list contacts from the gateway's own CRM
    contacts = await gateway.list_gateway_contacts(search="Rahul", limit=20)

    # REST — get message history for a gateway conversation
    msgs = await gateway.get_conversation_messages(conversation_id="abc123")
"""

import logging
from typing import Optional, Any

import httpx

from app.core.config import settings

logger = logging.getLogger("portal.whatsapp_gateway")


# ─── Custom exception ────────────────────────────────────────────────────────

class GatewayError(Exception):
    """Raised when the gateway returns a non-2xx response or is unreachable."""
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


# ─── Gateway client ───────────────────────────────────────────────────────────

class WhatsAppGatewayClient:
    """
    Thin async wrapper around the gateway's two API surfaces.
    Instantiated once as a module-level singleton (`gateway`).
    """

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _webhook_url(self) -> str:
        """Action-routed POST endpoint."""
        return f"{settings.WHATSAPP_GATEWAY_BASE}/integrations/webhook"

    def _rest_url(self, path: str) -> str:
        """REST API endpoint. path should start with '/'."""
        # REST base is at /api/v1/public/v1 relative to the same host.
        # We derive it from WHATSAPP_GATEWAY_BASE which ends at /api/v1.
        base = settings.WHATSAPP_GATEWAY_BASE.rstrip("/")   # e.g. http://127.0.0.1:8000/api/v1
        # Replace the trailing /api/v1 with /api/v1/public/v1
        rest_base = base + "/public/v1"
        return rest_base + path

    def _webhook_headers(self) -> dict:
        return {
            "X-Webhook-Key": settings.WHATSAPP_WEBHOOK_KEY,
            "Content-Type": "application/json",
        }

    def _rest_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {settings.WHATSAPP_WEBHOOK_KEY}",
            "Content-Type": "application/json",
        }

    def _require_key(self) -> None:
        if not settings.WHATSAPP_WEBHOOK_KEY:
            raise GatewayError(
                "WHATSAPP_WEBHOOK_KEY is not configured in .env", status_code=500
            )

    async def _post_webhook(self, payload: dict) -> dict:
        """POST an action to the webhook endpoint."""
        self._require_key()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    self._webhook_url(),
                    json=payload,
                    headers=self._webhook_headers(),
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"[GW] Webhook HTTP error {e.response.status_code}: {e.response.text}")
            raise GatewayError(
                f"Gateway returned {e.response.status_code}: {e.response.text}",
                status_code=502,
            )
        except httpx.RequestError as e:
            logger.error(f"[GW] Gateway unreachable: {e}")
            raise GatewayError(
                "WhatsApp gateway is unreachable. Is it running on the configured port?",
                status_code=503,
            )

    async def _get_rest(self, path: str, params: dict = None) -> Any:
        """GET from the REST API."""
        self._require_key()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    self._rest_url(path),
                    params=params or {},
                    headers=self._rest_headers(),
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"[GW] REST GET {path} error {e.response.status_code}: {e.response.text}")
            raise GatewayError(
                f"Gateway returned {e.response.status_code}: {e.response.text}",
                status_code=502,
            )
        except httpx.RequestError as e:
            logger.error(f"[GW] Gateway unreachable on GET {path}: {e}")
            raise GatewayError("WhatsApp gateway is unreachable.", status_code=503)

    async def _post_rest(self, path: str, payload: dict) -> Any:
        """POST to the REST API."""
        self._require_key()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    self._rest_url(path),
                    json=payload,
                    headers=self._rest_headers(),
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"[GW] REST POST {path} error {e.response.status_code}: {e.response.text}")
            raise GatewayError(
                f"Gateway returned {e.response.status_code}: {e.response.text}",
                status_code=502,
            )
        except httpx.RequestError as e:
            logger.error(f"[GW] Gateway unreachable on POST {path}: {e}")
            raise GatewayError("WhatsApp gateway is unreachable.", status_code=503)

    async def _patch_rest(self, path: str, payload: dict) -> Any:
        """PATCH to the REST API."""
        self._require_key()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.patch(
                    self._rest_url(path),
                    json=payload,
                    headers=self._rest_headers(),
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            raise GatewayError(
                f"Gateway returned {e.response.status_code}: {e.response.text}",
                status_code=502,
            )
        except httpx.RequestError as e:
            raise GatewayError("WhatsApp gateway is unreachable.", status_code=503)

    # ── Webhook actions ───────────────────────────────────────────────────────

    async def send_text(self, to: str, text: str) -> dict:
        """
        Send a plain text message.
        Gateway action: send_text
        """
        logger.info(f"[GW] send_text → {to}")
        return await self._post_webhook({
            "action": "send_text",
            "to": to,
            "text": text,
        })

    async def send_template(
        self,
        to: str,
        template_name: str,
        body_parameters: Optional[dict] = None,
        dynamic_header_media_url: Optional[str] = None,
        carousel_cards: Optional[list] = None,
    ) -> dict:
        """
        Send a pre-approved WhatsApp template message.
        Gateway action: send_template

        Args:
            to:                       Recipient phone number with country code.
            template_name:            Exact name as approved in WhatsApp Business Manager.
            body_parameters:          Dict of variable placeholders → values.
                                      e.g. {"student_name": "Rahul", "status": "Offer Received"}
            dynamic_header_media_url: URL for a dynamic header image/document (optional).
            carousel_cards:           List of card dicts for carousel templates (optional).

        Common templates you'd use in this portal:
            - "application_update"   → notify student of status change
            - "offer_received"       → student got an offer
            - "visa_approved"        → visa success notification
            - "document_reminder"    → ask student to upload docs
            - "payment_receipt"      → payment confirmation
        """
        logger.info(f"[GW] send_template '{template_name}' → {to}")
        payload: dict = {
            "action": "send_template",
            "to": to,
            "template_name": template_name,
        }
        if body_parameters:
            payload["body_parameters"] = body_parameters
        if dynamic_header_media_url:
            payload["dynamic_header_media_url"] = dynamic_header_media_url
        if carousel_cards:
            payload["carousel_cards"] = carousel_cards

        return await self._post_webhook(payload)

    async def send_media(
        self,
        to: str,
        media_type: str,
        media_url: str,
        caption: Optional[str] = None,
        filename: Optional[str] = None,
    ) -> dict:
        """
        Send a media message (image, video, document, audio).
        Gateway action: send_media

        Args:
            to:         Recipient phone number.
            media_type: One of: "image", "video", "document", "audio"
            media_url:  Publicly accessible URL to the media file.
            caption:    Optional caption (images/videos only).
            filename:   Optional filename (documents only).

        Use cases in this portal:
            - Share an offer letter PDF with the student
            - Send an invoice PDF
            - Share a document checklist image
        """
        logger.info(f"[GW] send_media ({media_type}) → {to}")
        if media_type not in ("image", "video", "document", "audio"):
            raise GatewayError(
                f"Invalid media_type '{media_type}'. Must be: image, video, document, audio",
                status_code=400,
            )
        payload: dict = {
            "action": "send_media",
            "to": to,
            "media_type": media_type,
            "media_url": media_url,
        }
        if caption:
            payload["caption"] = caption
        if filename:
            payload["filename"] = filename

        return await self._post_webhook(payload)

    async def start_chatbot(self, to: str, chatbot_id: int) -> dict:
        """
        Trigger a chatbot flow for a contact.
        Gateway action: start_chatbot

        Args:
            to:          Recipient phone number.
            chatbot_id:  ID of the chatbot/flow configured in the gateway dashboard.

        Use case: Trigger an automated onboarding flow when a new student is registered.
        """
        logger.info(f"[GW] start_chatbot id={chatbot_id} → {to}")
        return await self._post_webhook({
            "action": "start_chatbot",
            "to": to,
            "chatbot_id": chatbot_id,
        })

    async def start_broadcast(self, broadcast_id: int) -> dict:
        """
        Start a broadcast campaign.
        Gateway action: start_broadcast

        Args:
            broadcast_id:  ID of the broadcast configured in the gateway dashboard.

        Use case: Bulk notify students about intake deadlines or events.
        """
        logger.info(f"[GW] start_broadcast id={broadcast_id}")
        return await self._post_webhook({
            "action": "start_broadcast",
            "broadcast_id": broadcast_id,
        })

    # ── REST API — Gateway's own CRM data ─────────────────────────────────────

    async def list_gateway_contacts(
        self,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Any:
        """
        List contacts from the gateway's internal CRM.
        Note: These are GATEWAY-side contacts, separate from your DB contacts.
        Use this to sync/import new contacts into your WhatsAppContact table.
        REST: GET /contacts
        """
        params = {"limit": limit, "offset": offset}
        if search:
            params["search"] = search
        return await self._get_rest("/contacts", params=params)

    async def upsert_gateway_contact(
        self,
        phone_number: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
    ) -> Any:
        """
        Create or update a contact in the gateway's CRM.
        Call this when you create a new student so the gateway knows about them.
        REST: POST /contacts
        """
        payload: dict = {"phone_number": phone_number}
        if name:
            payload["name"] = name
        if email:
            payload["email"] = email
        return await self._post_rest("/contacts", payload)

    async def update_gateway_contact(
        self,
        contact_id: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        groups: Optional[list] = None,
    ) -> Any:
        """
        Update an existing gateway contact.
        REST: PATCH /contacts/{id}
        """
        payload: dict = {}
        if name:
            payload["name"] = name
        if email:
            payload["email"] = email
        if groups is not None:
            payload["groups"] = groups
        return await self._patch_rest(f"/contacts/{contact_id}", payload)

    async def list_conversations(self, limit: int = 50, offset: int = 0) -> Any:
        """
        List conversations ordered by most recent activity.
        REST: GET /conversations
        """
        return await self._get_rest("/conversations", params={"limit": limit, "offset": offset})

    async def get_conversation_messages(
        self,
        conversation_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> Any:
        """
        Get paginated message history for a conversation from the gateway.
        REST: GET /conversations/{id}/messages
        """
        return await self._get_rest(
            f"/conversations/{conversation_id}/messages",
            params={"limit": limit, "offset": offset},
        )

    async def list_templates(self, status: Optional[str] = None) -> Any:
        """
        List all WhatsApp message templates configured in the gateway.
        REST: GET /templates
        Useful for building a template selector in your UI.
        """
        params = {}
        if status:
            params["status"] = status   # e.g. "approved", "pending", "rejected"
        return await self._get_rest("/templates", params=params)

    async def get_template(self, template_id: str) -> Any:
        """
        Get full details of a single template including all components.
        REST: GET /templates/{id}
        """
        return await self._get_rest(f"/templates/{template_id}")

    async def list_chatbots(self) -> Any:
        """
        List all chatbot flows configured in the gateway.
        REST: GET /chatbots
        """
        return await self._get_rest("/chatbots")

    async def list_broadcasts(self) -> Any:
        """
        List all broadcast campaigns.
        REST: GET /broadcasts
        """
        return await self._get_rest("/broadcasts")

    # ── Utility: extract gateway message ID from response ─────────────────────

    @staticmethod
    def extract_message_id(response: dict) -> Optional[str]:
        """
        Gateways return message IDs in different shapes. Try all known patterns.
        """
        return (
            response.get("message_id") or
            response.get("id") or
            (
                response.get("messages", [{}])[0].get("id")
                if isinstance(response.get("messages"), list)
                else None
            )
        )

    # ── Health check ──────────────────────────────────────────────────────────

async def ping(self) -> bool:
        """
        Quick check that the gateway is reachable.
        Returns True if healthy, False otherwise.
        """
        try:
            await self._get_rest("/contacts", params={"limit": 1})
            return True
        except GatewayError:
            return False


async def health(self) -> dict:
    """
    Health wrapper used by the WhatsApp router.
    Keeps /api/whatsapp/health from crashing even when the gateway is offline.
    """
    reachable = await self.ping()

    return {
        "gateway_reachable": reachable,
        "gateway_url": settings.WHATSAPP_GATEWAY_BASE,
        "configured": bool(settings.WHATSAPP_WEBHOOK_KEY),
    }


# ─── Module-level singleton ───────────────────────────────────────────────────
# Import this in other modules:
#   from app.services.whatsapp_gateway import gateway, GatewayError

gateway = WhatsAppGatewayClient()