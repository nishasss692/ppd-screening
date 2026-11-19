"""SQLAlchemy entity models for the Anonymous Mother's Community (Mother's Circle).

Implements:
- CommunityPost: Anonymous community reflections, questions, and shared journeys.
- CommunityComment: Anonymous peer support and advice responses.
- CommunityReaction: Supportive emotional reactions (Sending Love, I Understand, You're Not Alone, Sending Strength).
- CommunityReport: Member-initiated reporting for harassment, abuse, spam, harmful advice, or privacy violation.
- ModerationAction: Audit-tracked moderation actions taken by clinical administrators or moderators.

Security & Anonymity Architecture:
The private author reference (author_user_id) is stored internally in the database for
ownership enforcement, abuse prevention, and safeguarding escalation.
It is STRICTLY PROHIBITED from ever being exposed or serialized in public community API responses.
"""

from typing import TYPE_CHECKING, List, Optional
import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from backend.models.user import User


class CommunityPost(Base, TimestampMixin):
    """Anonymous community post shared by an authenticated mother."""

    __tablename__ = "community_posts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique identifier for the community post",
    )
    # Private author reference: NEVER return to public clients
    author_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Private internal author reference for ownership and moderation",
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Body text of the post",
    )
    category: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        doc="Category: Emotional Support, My Postpartum Journey, Motherhood Struggles, Questions & Advice, Small Wins, Relationships & Family, Just Need to Talk",
    )
    mood: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        doc="Optional mood selected by the mother",
    )
    display_author: Mapped[str] = mapped_column(
        String(64),
        default="Anonymous Mother",
        nullable=False,
        doc="Generic public display label: Anonymous Mother, A Mother in Her Journey, Anonymous Member",
    )
    is_anonymous: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        doc="Flag indicating anonymity is enforced",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="approved",
        nullable=False,
        index=True,
        doc="Status: approved, flagged, hidden, removed",
    )
    likes_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Denormalized count of supportive reactions",
    )
    comments_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Denormalized count of comments",
    )

    # Relationships
    author: Mapped["User"] = relationship(
        "User",
        foreign_keys=[author_user_id],
        lazy="select",
    )
    comments: Mapped[List["CommunityComment"]] = relationship(
        "CommunityComment",
        back_populates="post",
        cascade="all, delete-orphan",
        order_by="CommunityComment.created_at.asc()",
    )
    reactions: Mapped[List["CommunityReaction"]] = relationship(
        "CommunityReaction",
        back_populates="post",
        cascade="all, delete-orphan",
    )
    reports: Mapped[List["CommunityReport"]] = relationship(
        "CommunityReport",
        back_populates="post",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<CommunityPost(id={self.id}, category='{self.category}', status='{self.status}')>"


class CommunityComment(Base, TimestampMixin):
    """Anonymous peer support comment left on a community post."""

    __tablename__ = "community_comments"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique identifier for the comment",
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Reference to the parent community post",
    )
    # Private author reference: NEVER return to public clients
    author_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Private internal author reference for ownership and moderation",
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Body text of the comment",
    )
    display_author: Mapped[str] = mapped_column(
        String(64),
        default="Anonymous Mother",
        nullable=False,
        doc="Generic public display label",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="approved",
        nullable=False,
        index=True,
        doc="Status: approved, flagged, hidden, removed",
    )

    # Relationships
    post: Mapped["CommunityPost"] = relationship(
        "CommunityPost",
        back_populates="comments",
    )
    author: Mapped["User"] = relationship(
        "User",
        foreign_keys=[author_user_id],
        lazy="select",
    )
    reports: Mapped[List["CommunityReport"]] = relationship(
        "CommunityReport",
        back_populates="comment",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<CommunityComment(id={self.id}, post_id={self.post_id}, status='{self.status}')>"


class CommunityReaction(Base, TimestampMixin):
    """Supportive reaction submitted by a mother on a community post."""

    __tablename__ = "community_reactions"

    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_community_reaction_post_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique identifier for the reaction",
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Reference to the reacted community post",
    )
    # Private reactor reference: NEVER return to other users
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Private internal user reference for deduplication and personal state",
    )
    reaction_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        doc="Reaction type: sending_love, i_understand, youre_not_alone, sending_strength",
    )

    # Relationships
    post: Mapped["CommunityPost"] = relationship(
        "CommunityPost",
        back_populates="reactions",
    )
    user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<CommunityReaction(id={self.id}, post_id={self.post_id}, type='{self.reaction_type}')>"


class CommunityReport(Base, TimestampMixin):
    """Safety and moderation report submitted against a post or comment."""

    __tablename__ = "community_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique identifier for the report",
    )
    reporter_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Private user reference of reporting member",
    )
    post_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        doc="Reported post ID if applicable",
    )
    comment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("community_comments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        doc="Reported comment ID if applicable",
    )
    reason: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        doc="Reason: Harassment, Abuse, Spam, Harmful Advice, Privacy Violation, Other",
    )
    details: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Optional supplementary details provided by the reporter",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="pending",
        nullable=False,
        index=True,
        doc="Report status: pending, reviewed, dismissed",
    )

    # Relationships
    reporter: Mapped["User"] = relationship(
        "User",
        foreign_keys=[reporter_user_id],
        lazy="select",
    )
    post: Mapped[Optional["CommunityPost"]] = relationship(
        "CommunityPost",
        back_populates="reports",
    )
    comment: Mapped[Optional["CommunityComment"]] = relationship(
        "CommunityComment",
        back_populates="reports",
    )

    def __repr__(self) -> str:
        return f"<CommunityReport(id={self.id}, reason='{self.reason}', status='{self.status}')>"


class ModerationAction(Base, TimestampMixin):
    """Audit record of moderation interventions taken by administrators or clinical staff."""

    __tablename__ = "moderation_actions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique identifier for the moderation action",
    )
    moderator_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        doc="User reference of the staff moderator taking action",
    )
    target_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        doc="Target type: post, comment",
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        nullable=False,
        index=True,
        doc="UUID of target post or comment",
    )
    action: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        doc="Action: hide, remove, approve, safeguard_escalate",
    )
    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Clinical or policy justification for the intervention",
    )

    # Relationships
    moderator: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[moderator_user_id],
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<ModerationAction(id={self.id}, action='{self.action}', target_type='{self.target_type}')>"
