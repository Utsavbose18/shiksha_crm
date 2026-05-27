from typing import List
from app.models.user import ApplicationMessage


def format_single_message(msg):
    sender = msg.sender_type.upper()
    time = msg.created_at.strftime("%Y-%m-%d %H:%M")

    text = f"[{time}] {sender}: {msg.message}"

    if msg.attachment_name:
        text += f"\nAttachment: {msg.attachment_name}"

    return text 