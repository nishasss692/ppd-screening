"""User entity model representing authenticated accounts (patients, doctors, clinicians)."""

from typing import TYPE_CHECKING, Optional
import uuid

from sqlalchemy import Boolean, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from backend.models.mother import Mother


class User(Base, TimestampMixin):
    """User account entity for authentication and role-based access control."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique primary key identifier (UUID)",
    )
    email: Mapped[str] = mapped_column(
        String(128),
        unique=True,
        index=True,
        nullable=False,
        doc="Unique login email address",
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Bcrypt hashed password",
    )
    full_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        doc="Full display name",
    )
    role: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="patient",
        index=True,
        doc="Role: 'patient', 'doctor', or 'admin'",
    )
    mother_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("mothers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="Linked Mother entity for patient accounts",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        doc="Account active status",
    )

    # Relationships
    mother: Mapped[Optional["Mother"]] = relationship(
        "Mother",
        backref="user",
        lazy="joined",
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"

