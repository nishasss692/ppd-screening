"""Pydantic schemas for AANCHAL Moments (Private Motherhood Community & Family Circle)."""

from datetime import datetime
from typing import List, Optional
import uuid

from pydantic import BaseModel, Field


# ============================================================================
# Post Schemas
# ============================================================================

class MomentPostCreate(BaseModel):
    caption: str = Field(..., min_length=2, max_length=5000, description="Post text or reflection")
    experience_type: str = Field("day_in_life", description="'day_in_life', 'support_circle', 'milestone', 'general'")
    category: str = Field("A Day in My Life", max_length=64)
    audience: str = Field("family", description="'community', 'family', 'both'")
    is_anonymous: bool = Field(False, description="Anonymous toggle for support circle")
    display_author: Optional[str] = Field(None, max_length=100)
    media_url: Optional[str] = None
    media_type: Optional[str] = Field(None, description="'image' or 'video'")
    milestone_title: Optional[str] = Field(None, max_length=200)
    mood: Optional[str] = Field(None, max_length=64)


class MomentPostUpdate(BaseModel):
    caption: Optional[str] = Field(None, min_length=2, max_length=5000)
    category: Optional[str] = None
    milestone_title: Optional[str] = None
    mood: Optional[str] = None
    audience: Optional[str] = None


class MomentCommentResponse(BaseModel):
    id: str
    post_id: str
    content: str
    display_author: str
    author_role: str
    relationship_label: Optional[str] = None
    is_anonymous: bool
    is_own_comment: bool = False
    created_at: str

    class Config:
        from_attributes = True


class MomentPostResponse(BaseModel):
    id: str
    caption: str
    experience_type: str
    category: str
    audience: str
    is_anonymous: bool
    display_author: str
    author_avatar: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    milestone_title: Optional[str] = None
    mood: Optional[str] = None
    status: str
    likes_count: int
    comments_count: int
    user_reacted: Optional[str] = None
    is_saved: bool = False
    is_own_post: bool = False
    created_at: str
    recent_comments: List[MomentCommentResponse] = []

    class Config:
        from_attributes = True


class MomentFeedResponse(BaseModel):
    posts: List[MomentPostResponse]
    items: Optional[List[MomentPostResponse]] = None
    total_count: int
    page: int
    page_size: int
    has_more: bool

    def __init__(self, **data):
        if "posts" in data and "items" not in data:
            data["items"] = data["posts"]
        elif "items" in data and "posts" not in data:
            data["posts"] = data["items"]
        super().__init__(**data)


# ============================================================================
# Comment & Reaction Schemas
# ============================================================================

class MomentCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    is_anonymous: bool = Field(False)


class MomentReactionToggle(BaseModel):
    reaction_type: str = Field("heart", description="'heart', 'cheer', 'hug', 'love', 'strength'")


class MomentReactionResponse(BaseModel):
    post_id: str
    reaction_type: Optional[str] = None
    likes_count: int


# ============================================================================
# Baby Letters (Memory Journal) Schemas
# ============================================================================

class BabyLetterCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    letter_date: str = Field(..., max_length=64)
    content: str = Field(..., min_length=1, max_length=10000)
    photo_url: Optional[str] = None
    is_draft: bool = False
    shared_with_family: bool = False


class BabyLetterUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    letter_date: Optional[str] = None
    content: Optional[str] = Field(None, min_length=1, max_length=10000)
    photo_url: Optional[str] = None
    is_draft: Optional[bool] = None
    shared_with_family: Optional[bool] = None


class BabyLetterResponse(BaseModel):
    id: str
    title: str
    letter_date: str
    content: str
    photo_url: Optional[str] = None
    is_draft: bool
    shared_with_family: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


# ============================================================================
# Family Circle & Invitation Schemas
# ============================================================================

class FamilyInvitationCreate(BaseModel):
    invitee_name: Optional[str] = Field(None, max_length=128)
    relationship: str = Field("Partner / Caregiver", max_length=64)
    can_upload: bool = Field(False, description="Permission to post moments")
    can_comment: bool = Field(True, description="Permission to comment")


class FamilyInvitationResponse(BaseModel):
    id: str
    invitation_code: Optional[str] = None  # Returned once upon generation
    invitation_code_preview: str
    invitee_name: Optional[str] = None
    relationship: str
    can_upload: bool
    can_comment: bool
    status: str
    expires_at: str
    created_at: str

    class Config:
        from_attributes = True


class FamilyJoinRequest(BaseModel):
    invitation_code: str = Field(..., min_length=6, max_length=64)


class FamilyCircleMemberResponse(BaseModel):
    id: str
    user_id: str
    name: str
    email: str
    relationship: str
    can_upload: bool
    can_comment: bool
    is_active: bool
    joined_at: str

    class Config:
        from_attributes = True


class FamilyMemberPermissionsUpdate(BaseModel):
    can_upload: Optional[bool] = None
    can_comment: Optional[bool] = None


class FamilyCircleDetailResponse(BaseModel):
    mother_name: str
    members: List[FamilyCircleMemberResponse]
    active_invitations: List[FamilyInvitationResponse]


# ============================================================================
# Moderation & Safety Schemas
# ============================================================================

class MomentReportCreate(BaseModel):
    post_id: Optional[str] = None
    comment_id: Optional[str] = None
    reason: str = Field(..., max_length=64)
    details: Optional[str] = Field(None, max_length=1000)


class MomentReportResponse(BaseModel):
    id: str
    message: str
    status: str


class UserBlockRequest(BaseModel):
    blocked_user_id: str
