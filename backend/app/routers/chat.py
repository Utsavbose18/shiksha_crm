"""
WebSocket-based real-time chat for application threads.

Each application has its own isolated room identified by application_id.
Messages sent over WebSocket are also persisted to the DB.

Connect URL:
    ws://host/ws/chat/{application_id}?token=<jwt_access_token>

Protocol (JSON frames):
  Client → Server:
    { "type": "message", "text": "Hello" }
    { "type": "ping" }

  Server → Client:
    { "type": "message", "id": 42, "sender_type": "user", "sender_id": 5,
      "text": "Hello", "created_at": "2025-01-01T10:00:00" }
    { "type": "pong" }
    { "type": "error", "detail": "reason" }
    { "type": "history", "messages": [...] }   <- sent on connect
"""
import json
from datetime import datetime
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import Application, ApplicationMessage, Student, User, UserRole

router = APIRouter(tags=["WebSocket Chat"])


# ─── Connection manager ───────────────────────────────────────────────────────

class ChatRoomManager:
    """
    Maintains a dict of  application_id -> set of active WebSocket connections.
    Rooms are created on first connect and destroyed when last user leaves.
    """
    def __init__(self):
        self.rooms: Dict[int, Set[WebSocket]] = {}

    async def connect(self, application_id: int, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(application_id, set()).add(ws)

    def disconnect(self, application_id: int, ws: WebSocket):
        if application_id in self.rooms:
            self.rooms[application_id].discard(ws)
            if not self.rooms[application_id]:
                del self.rooms[application_id]

    async def broadcast(self, application_id: int, payload: dict, exclude: WebSocket = None):
        """Send payload to every connection in the room except the sender."""
        for ws in list(self.rooms.get(application_id, [])):
            if ws is exclude:
                continue
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                self.disconnect(application_id, ws)

    async def send_personal(self, ws: WebSocket, payload: dict):
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            pass

    def room_size(self, application_id: int) -> int:
        return len(self.rooms.get(application_id, []))


manager = ChatRoomManager()


# ─── Auth helper for WS ───────────────────────────────────────────────────────

def _authenticate_ws(token: str, db: Session):
    """
    Validates JWT token and returns (user_obj, sender_type).
    sender_type is "student" or "user".
    """
    try:
        payload = decode_token(token)
    except Exception:
        return None, None

    if payload.get("type") != "access":
        return None, None

    user_id = int(payload.get("sub", 0))
    role = payload.get("role")

    if role == UserRole.student:
        user = db.query(Student).filter(Student.id == user_id, Student.is_active == True).first()
        return user, "student"
    else:
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        return user, "user"


def _check_access(application: Application, user, sender_type: str) -> bool:
    """Returns True if this user may chat on this application."""
    if sender_type == "student":
        return application.student_id == user.id
    if user.role == UserRole.admin:
        return True
    if user.role == UserRole.counsellor:
        # counsellor must be assigned to this student
        return application.student.counsellor_id == user.id
    return False


# ─── WebSocket endpoint ───────────────────────────────────────────────────────

@router.websocket("/ws/chat/{application_id}")
async def websocket_chat(
    application_id: int,
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    # 1. Authenticate
    user, sender_type = _authenticate_ws(token, db)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    # 2. Load application
    application = (
        db.query(Application)
        .filter(Application.id == application_id)
        .first()
    )
    if not application:
        await websocket.close(code=4004, reason="Application not found")
        return

    # 3. Access check
    if not _check_access(application, user, sender_type):
        await websocket.close(code=4003, reason="Forbidden")
        return

    # 4. Accept connection
    await manager.connect(application_id, websocket)

    # 5. Send chat history (last 100 messages)
    history = (
        db.query(ApplicationMessage)
        .filter(ApplicationMessage.application_id == application_id)
        .order_by(ApplicationMessage.created_at.asc())
        .limit(100)
        .all()
    )
    await manager.send_personal(websocket, {
        "type": "history",
        "messages": [
            {
                "id": m.id,
                "sender_type": m.sender_type,
                "sender_id": m.sender_id,
                "text": m.message,
                "attachment_path": m.attachment_path,
                "created_at": m.created_at.isoformat(),
            }
            for m in history
        ],
    })

    # 6. Message loop
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                frame = json.loads(raw)
            except json.JSONDecodeError:
                await manager.send_personal(websocket, {"type": "error", "detail": "Invalid JSON"})
                continue

            frame_type = frame.get("type")

            if frame_type == "ping":
                await manager.send_personal(websocket, {"type": "pong"})
                continue

            if frame_type == "message":
                text = (frame.get("text") or "").strip()
                if not text:
                    await manager.send_personal(websocket, {"type": "error", "detail": "Empty message"})
                    continue

                # Persist to DB
                msg = ApplicationMessage(
                    application_id=application_id,
                    sender_type=sender_type,
                    sender_id=user.id,
                    message=text,
                )
                db.add(msg)
                db.commit()
                db.refresh(msg)

                payload = {
                    "type": "message",
                    "id": msg.id,
                    "sender_type": sender_type,
                    "sender_id": user.id,
                    "text": text,
                    "created_at": msg.created_at.isoformat(),
                }

                # Echo back to sender (so client gets the confirmed DB id)
                await manager.send_personal(websocket, payload)
                # Broadcast to everyone else in this application's room
                await manager.broadcast(application_id, payload, exclude=websocket)
                continue

            await manager.send_personal(websocket, {"type": "error", "detail": f"Unknown frame type: {frame_type}"})

    except WebSocketDisconnect:
        manager.disconnect(application_id, websocket)
    except Exception as e:
        manager.disconnect(application_id, websocket)
        try:
            await websocket.close(code=1011, reason=str(e))
        except Exception:
            pass


# ─── REST: online users count (optional utility) ──────────────────────────────

@router.get("/api/chat/{application_id}/online")
def online_count(application_id: int, _=Depends(lambda: None)):
    return {"application_id": application_id, "online": manager.room_size(application_id)}
