"""Pydantic schemas for Anonymous Mother's Community (Mother's Circle).

Strict Anonymity Contract:
Under no circumstances may author_user_id, email, full_name, phone, or any personal account
identifiers be present in public Community API responses.
Ownership is communicated safely via boolean flags (`is_own_post`, `is_own_comment`),
computed dynamically on the server against the requesting user's session.
"""

from datetime import datetime
from typing import Dict, List, Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field


VALID_CATEGORIES = [
    "Emotional Support",
    "My Postpartum Journey",
    "Motherhood Struggles",
    "Questions & Advice",
    "Small Wins",
    "Relationships & Family",
    "Just Need to Talk",
]

VALID_REACTIONS = [
    "sending_love",
    "i_understand",
    "youre_not_alone",
    "sending_strength",
]

VALID_REPORT_REASONS = [
    "Harassment",
    "Abuse",
    "Spam",
    "Harmful Advice",
    "Privacy Violation",
    "Other",
]


class PostCreateRequest(BaseModel):
    """Payload to create an anonymous community post."""

    content: str = Field(
        ...,
        min_length=10,
        max_length=2500,
        description="Thoughtful post content (10 to 2500 characters)",
    )
    category: str = Field(
        ...,
        description="Community category",
    )
    mood: Optional[str] = Field(
        None,
        max_length=64,
        description="Optional emotional mood indicator",
    )
    display_author: Optional[str] = Field(
        "Anonymous Mother",
        max_length=64,
        description="Anonymous persona: 'Anonymous Mother', 'A Mother in Her Journey', 'Anonymous Member'",
    )


class PostUpdateRequest(BaseModel):
    """Payload to update an existing anonymous post."""

    content: str = Field(
        ...,
        min_length=10,
        max_length=2500,
        description="Updated post content",
    )
    category: Optional[str] = Field(None, description="Updated category")
    mood: Optional[str] = Field(None, max_length=64, description="Updated mood")


class CommentCreateRequest(BaseModel):
    """Payload to add an anonymous comment."""

    content: str = Field(
        ...,
        min_length=2,
        max_length=500,
        description="Supportive comment content (2 to 500 characters)",
    )


class CommentUpdateRequest(BaseModel):
    """Payload to update an anonymous comment."""

    content: str = Field(
        ...,
        min_length=2,
        max_length=500,
        description="Updated comment content",
    )


class CommentResponse(BaseModel):
    """Public comment response - 100% anonymous."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    post_id: uuid.UUID
    display_author: str = "Anonymous Mother"
    content: str
    created_at: datetime
    updated_at: datetime
    is_own_comment: bool = False


class ReactionToggleRequest(BaseModel):
    """Payload to add, change, or remove a reaction."""

    reaction_type: str = Field(
        ...,
        description="One of: sending_love, i_understand, youre_not_alone, sending_strength",
    )


class ReactionResponse(BaseModel):
    """Result of toggling a reaction."""

    post_id: uuid.UUID
    user_reaction: Optional[str] = None
    likes_count: int
    reaction_breakdown: Dict[str, int]


class PostResponse(BaseModel):
    """Public community post response - strictly zero author PII exposed."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_author: str = "Anonymous Mother"
    content: str
    category: str
    mood: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    likes_count: int = 0
    comments_count: int = 0
    reaction_breakdown: Dict[str, int] = Field(default_factory=dict)
    user_reaction: Optional[str] = None
    is_own_post: bool = False
    comments: Optional[List[CommentResponse]] = None


class PostFeedResponse(BaseModel):
    """Paginated community feed response."""

    posts: List[PostResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_more: bool


class ReportCreateRequest(BaseModel):
    """Payload to report inappropriate content."""

    post_id: Optional[uuid.UUID] = None
    comment_id: Optional[uuid.UUID] = None
    reason: str = Field(
        ...,
        description="Report reason: Harassment, Abuse, Spam, Harmful Advice, Privacy Violation, Other",
    )
    details: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional additional context",
    )


class ReportResponse(BaseModel):
    """Confirmation of report filing."""

    id: uuid.UUID
    status: str
    message: str


class ModerationQueueItem(BaseModel):
    """Item in moderation queue for clinicians / admins."""

    id: uuid.UUID
    target_type: str  # "post" or "comment"
    target_id: uuid.UUID
    content: str
    category: Optional[str] = None
    status: str
    reports_count: int
    latest_report_reason: Optional[str] = None
    latest_report_details: Optional[str] = None
    created_at: datetime


class ModerationActionRequest(BaseModel):
    """Action taken by moderator on content."""

    target_type: str = Field(..., description="'post' or 'comment'")
    target_id: uuid.UUID = Field(..., description="Target post or comment UUID")
    action: str = Field(
        ...,
        description="Action: 'hide', 'remove', 'approve', 'safeguard_escalate'",
    )
    reason: str = Field(..., min_length=3, max_length=1000, description="Justification")


class ModerationActionResponse(BaseModel):
    """Confirmation of moderation action."""

    id: uuid.UUID
    action: str
    target_type: str
    target_id: uuid.UUID
    status: str
    message: str
