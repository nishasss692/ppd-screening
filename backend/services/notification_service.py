"""Service for creating, deduplicating, and managing persistent role-scoped notifications."""

import json
import logging
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.models.notification import Notification

logger = logging.getLogger("ppd.notifications")


def create_notification_dedup(
    db: Session,
    *,
    recipient_id: str,
    recipient_role: str,
    notification_type: str,
    title: str,
    message: str,
    related_appointment_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Notification:
    """Create a notification if an identical (recipient, type, appointment) does not already exist."""
    if related_appointment_id:
        existing = db.scalar(
            select(Notification).where(
                Notification.recipient_id == recipient_id,
                Notification.recipient_role == recipient_role,
                Notification.notification_type == notification_type,
                Notification.related_appointment_id == related_appointment_id,
            )
        )
        if existing:
            return existing

    notif = Notification(
        recipient_id=recipient_id,
        recipient_role=recipient_role,
        notification_type=notification_type,
        title=title,
        message=message,
        related_appointment_id=related_appointment_id,
        metadata_json=json.dumps(metadata) if metadata else None,
        is_read=False,
    )
    db.add(notif)
    return notif


def serialize_notification(notif: Notification) -> Dict[str, Any]:
    """Serialize a Notification ORM record to JSON-compatible dict."""
    meta: Dict[str, Any] = {}
    if notif.metadata_json:
        try:
            meta = json.loads(notif.metadata_json)
        except Exception:
            meta = {}

    return {
        "id": str(notif.id),
        "recipientId": notif.recipient_id,
        "recipientRole": notif.recipient_role,
        "type": notif.notification_type,
        "title": notif.title,
        "message": notif.message,
        "relatedAppointmentId": notif.related_appointment_id,
        "metadata": meta,
        "isRead": bool(notif.is_read),
        "read": bool(notif.is_read),
        "createdAt": notif.created_at.isoformat() if notif.created_at else None,
        "date": notif.created_at.strftime("%d %b %Y · %I:%M %p") if notif.created_at else "Just now",
    }


def list_notifications_for_recipient(
    db: Session,
    *,
    recipient_role: str,
    recipient_ids: List[str],
    limit: int = 30,
) -> List[Dict[str, Any]]:
    """Fetch notifications strictly scoped to the given role and recipient IDs."""
    rows = db.scalars(
        select(Notification)
        .where(
            Notification.recipient_role == recipient_role,
            Notification.recipient_id.in_(recipient_ids),
        )
        .order_by(desc(Notification.created_at))
        .limit(limit)
    ).all()
    return [serialize_notification(n) for n in rows]
