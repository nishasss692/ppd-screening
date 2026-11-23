"""SQLAlchemy entity models for AANCHAL Moments (Private Motherhood Community & Family Circle).

Implements:
- MomentsPost: Moments shared by mothers with audience controls ('community', 'family', 'both').
- MomentsComment: Comments and supportive replies on moments.
- MomentsReaction: Emotional support reactions (Heart, Cheer, Hug, Love, Strength).
- SavedMoment: Personal bookmarks/saved moments for mothers.
- BabyLetter: Private digital memory journal letters to the baby.
- FamilyInvitation: Secure single-use invitation codes for family member linking.
- FamilyCircleMember: Relationship mapping and granular permissions between mother and family members.
- UserBlock: Peer-to-peer block list for community safety.
- MomentReport: Content moderation reports.
"""

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship as sa_relationship

from backend.database.base import Base, TimestampMixin, utc_now

if TYPE_CHECKING:
    from backend.models.mother import Mother
    from backend.models.user import User


class MomentsPost(Base, TimestampMixin):
    """Moments post shared by a mother or authorized family member."""

    __tablename__ = "moments_posts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique identifier for the moment",
    )
    author_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Author account user ID",
    )
    mother_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("mothers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="Associated mother entity for Family Circle scoping",
    )
    caption: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Moment caption, reflection, or story",
    )
    experience_type: Mapped[str] = mapped_column(
        String(32),
        default="day_in_life",
        nullable=False,
        index=True,
        doc="Type: 'day_in_life', 'support_circle', 'milestone', 'general'",
    )
    category: Mapped[str] = mapped_column(
        String(64),
        default="A Day in My Life",
        nullable=False,
        index=True,
        doc="Display category label",
    )
    audience: Mapped[str] = mapped_column(
        String(32),
        default="family",
        nullable=False,
        index=True,
        doc="Audience permission: 'community', 'family', 'both'",
    )
    is_anonymous: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="If true, author identity is masked in community responses",
    )
    display_author: Mapped[str] = mapped_column(
        String(100),
        default="Mother",
        nullable=False,
        doc="Display name shown on post",
    )
    author_avatar: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        doc="Optional avatar initials or photo path",
    )
    media_url: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Uploaded photo or video URL/path",
    )
    media_type: Mapped[Optional[str]] = mapped_column(
        String(32),
        nullable=True,
        doc="Media type: 'image' or 'video'",
    )
    milestone_title: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
        doc="Optional baby milestone achievement title",
    )
    mood: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        doc="Optional mood tag",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="approved",
        nullable=False,
        index=True,
        doc="Status: 'approved', 'flagged', 'hidden', 'removed'",
    )
    likes_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Reaction count",
    )
    comments_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Comments count",
    )

    # Relationships
    author: Mapped["User"] = sa_relationship(
        "User",
        foreign_keys=[author_user_id],
        lazy="select",
    )
    mother: Mapped[Optional["Mother"]] = sa_relationship(
        "Mother",
        foreign_keys=[mother_id],
        lazy="select",
    )
    comments: Mapped[List["MomentsComment"]] = sa_relationship(
        "MomentsComment",
        back_populates="post",
        cascade="all, delete-orphan",
        order_by="MomentsComment.created_at.asc()",
    )
    reactions: Mapped[List["MomentsReaction"]] = sa_relationship(
        "MomentsReaction",
        back_populates="post",
        cascade="all, delete-orphan",
    )
    saved_by: Mapped[List["SavedMoment"]] = sa_relationship(
        "SavedMoment",
        back_populates="post",
        cascade="all, delete-orphan",
    )
    reports: Mapped[List["MomentReport"]] = sa_relationship(
        "MomentReport",
        back_populates="post",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<MomentsPost(id={self.id}, audience='{self.audience}', type='{self.experience_type}')>"


class MomentsComment(Base, TimestampMixin):
    """Comment or supportive message on a Moment."""

    __tablename__ = "moments_comments"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique identifier for the comment",
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("moments_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Parent moment post ID",
    )
    author_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Author account user ID",
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Body of the comment",
    )
    display_author: Mapped[str] = mapped_column(
        String(100),
        default="Member",
        nullable=False,
        doc="Display author name",
    )
    author_role: Mapped[str] = mapped_column(
        String(32),
        default="mother",
        nullable=False,
        doc="Author role: 'mother' or 'family'",
    )
    relationship_label: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        doc="Relationship label if family member (e.g. 'Partner', 'Grandmother')",
    )
    is_anonymous: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="Whether comment author is anonymous",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="approved",
        nullable=False,
        doc="Status: 'approved', 'flagged', 'hidden'",
    )

    # Relationships
    post: Mapped["MomentsPost"] = sa_relationship(
        "MomentsPost",
        back_populates="comments",
    )
    author: Mapped["User"] = sa_relationship(
        "User",
        foreign_keys=[author_user_id],
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<MomentsComment(id={self.id}, post_id={self.post_id}, role='{self.author_role}')>"


class MomentsReaction(Base, TimestampMixin):
    """Reaction left on a Moment."""

    __tablename__ = "moments_reactions"

    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_moments_reaction_post_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("moments_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reaction_type: Mapped[str] = mapped_column(
        String(32),
        default="heart",
        nullable=False,
        doc="Reaction type: 'heart', 'cheer', 'hug', 'love', 'strength'",
    )

    post: Mapped["MomentsPost"] = sa_relationship(
        "MomentsPost",
        back_populates="reactions",
    )
    user: Mapped["User"] = sa_relationship(
        "User",
        foreign_keys=[user_id],
        lazy="select",
    )


class SavedMoment(Base, TimestampMixin):
    """Bookmarked moment saved privately by a mother."""

    __tablename__ = "moments_saved"

    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_moments_saved_post_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("moments_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    post: Mapped["MomentsPost"] = sa_relationship(
        "MomentsPost",
        back_populates="saved_by",
    )
    user: Mapped["User"] = sa_relationship(
        "User",
        foreign_keys=[user_id],
        lazy="select",
    )


class BabyLetter(Base, TimestampMixin):
    """Private digital memory journal letters written by a mother to her baby."""

    __tablename__ = "baby_letters"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    mother_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("mothers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Mother author entity ID",
    )
    author_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Author account user ID",
    )
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        doc="Letter title",
    )
    letter_date: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        doc="Letter display date (e.g. '22 Nov 2026')",
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Letter text body",
    )
    photo_url: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Optional attached photograph URL/data",
    )
    is_draft: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="Draft indicator",
    )
    shared_with_family: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="Strict privacy: letters are private by default; shared only when explicitly true",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="active",
        nullable=False,
        doc="'active' or 'archived'",
    )

    # Relationships
    mother: Mapped["Mother"] = sa_relationship(
        "Mother",
        foreign_keys=[mother_id],
        lazy="select",
    )
    author: Mapped["User"] = sa_relationship(
        "User",
        foreign_keys=[author_user_id],
        lazy="select",
    )


class FamilyInvitation(Base, TimestampMixin):
    """Secure single-use invitation codes to join a Mother's Family Circle."""

    __tablename__ = "family_invitations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    mother_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("mothers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    inviter_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invitation_code_hash: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
        doc="Cryptographic hash of the invitation code",
    )
    invitation_code_preview: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        doc="Safe preview code for mother's list (e.g. 'MOMENT-AB12')",
    )
    invitee_name: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        doc="Intended family member name",
    )
    relationship: Mapped[Optional[str]] = mapped_column(
        String(64),
        default="Family Member",
        nullable=True,
        doc="Expected relationship (e.g. 'Partner', 'Grandmother')",
    )
    can_upload: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="Permission granted to post to Family Circle",
    )
    can_comment: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        doc="Permission granted to comment on moments",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="active",
        nullable=False,
        index=True,
        doc="'active', 'used', 'revoked', 'expired'",
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        doc="Expiration timestamp",
    )
    used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    used_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )


class FamilyCircleMember(Base, TimestampMixin):
    """Active membership linking a family account to a mother's private circle."""

    __tablename__ = "family_circle_members"

    __table_args__ = (
        UniqueConstraint("mother_id", "user_id", name="uq_family_circle_mother_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    mother_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("mothers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Family member account ID",
    )
    relationship: Mapped[str] = mapped_column(
        String(64),
        default="Partner / Family Caregiver",
        nullable=False,
    )
    can_upload: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="Mother-granted permission to post",
    )
    can_comment: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        doc="Mother-granted permission to comment",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        doc="If false, family member's access is revoked",
    )

    mother: Mapped["Mother"] = sa_relationship(
        "Mother",
        foreign_keys=[mother_id],
        lazy="select",
    )
    user: Mapped["User"] = sa_relationship(
        "User",
        foreign_keys=[user_id],
        lazy="select",
    )


class UserBlock(Base, TimestampMixin):
    """Peer-to-peer blocking record for community safety."""

    __tablename__ = "user_blocks"

    __table_args__ = (
        UniqueConstraint("blocker_user_id", "blocked_user_id", name="uq_user_block"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    blocker_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    blocked_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


class MomentReport(Base, TimestampMixin):
    """Moderation report on a moment post or comment."""

    __tablename__ = "moment_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    reporter_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    post_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("moments_posts.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    comment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("moments_comments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    reason: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    details: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="pending",
        nullable=False,
        index=True,
    )

    post: Mapped[Optional["MomentsPost"]] = sa_relationship(
        "MomentsPost",
        back_populates="reports",
    )
