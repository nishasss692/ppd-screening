"""Notification entity model for real-time Doctor, Hospital, and Patient notifications."""

from typing import Optional
import uuid

from sqlalchemy import Boolean, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.base import Base, TimestampMixin


class Notification(Base, TimestampMixin):
    """Persistent role-scoped notification for Doctor, Hospital, and Patient workflows."""

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique notification UUID",
    )
    recipient_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        doc="Target recipient ID (e.g., DR-001, HOSP-001, or mother UUID)",
    )
    recipient_role: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        index=True,
        doc="Recipient role: doctor | hospital | patient",
    )
    notification_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="consultation_booked",
        doc="Type: consultation_booked | consultation_completed | report_ready",
    )
    title: Mapped[str] = mapped_column(
        String(160),
        nullable=False,
        doc="Short notification title",
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Human-readable notification message",
    )
    related_appointment_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        index=True,
        doc="Associated CarePlan / Appointment UUID",
    )
    metadata_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Optional JSON string with patient_name, doctor_name, hospital_name, date, time, status",
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
        doc="Whether the recipient has read this notification",
    )

    __table_args__ = (
        Index("ix_notifications_recipient", "recipient_role", "recipient_id", "is_read"),
    )
