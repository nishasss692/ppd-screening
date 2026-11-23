"""FastAPI router for AANCHAL Moments (Private Motherhood Community & Family Circle).

Implements:
- Feed retrieval with strict role/audience isolation:
  - Mother Community Feed (supportive peers, A Day in My Life, Support Circle, Milestones)
  - Family Circle Feed (private family moments)
  - Personal archive (My Moments) and private bookmarks (Saved Moments)
- Post CRUD & multimedia uploads (photo/video)
- Supportive comments and emotional reactions (Heart, Cheer, Hug, Love, Strength)
- Private baby memory letters ("Letters to My Baby") with optional family sharing
- Family Circle invitation code generation (hashed single-use codes) & joining
- Family member permission toggling and immediate revocation
- Peer blocking & content reporting for community safety
"""

from datetime import datetime, timezone
import logging
import os
import re
from typing import Any, Dict, List, Optional
import uuid

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.models.user import User
from backend.schemas.moments import (
    BabyLetterCreate,
    BabyLetterResponse,
    BabyLetterUpdate,
    FamilyCircleDetailResponse,
    FamilyInvitationCreate,
    FamilyInvitationResponse,
    FamilyMemberPermissionsUpdate,
    MomentCommentCreate,
    MomentCommentResponse,
    MomentFeedResponse,
    MomentPostCreate,
    MomentPostResponse,
    MomentPostUpdate,
    MomentReactionResponse,
    MomentReportCreate,
    MomentReportResponse,
)
from backend.services.auth_service import get_current_user
from backend.services.moments_service import MomentsService

logger = logging.getLogger("ppd.routers.moments")

router = APIRouter(prefix="/api/moments", tags=["AANCHAL Moments"])

MOMENTS_UPLOAD_DIR = os.path.join("uploads", "moments")
os.makedirs(MOMENTS_UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {
    "jpg": "photo",
    "jpeg": "photo",
    "png": "photo",
    "webp": "photo",
    "gif": "photo",
    "mp4": "video",
    "webm": "video",
    "mov": "video",
}

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB max


class ReactionPayload(BaseModel):
    reaction_type: str = Field(default="heart", description="'heart', 'cheer', 'hug', 'love', 'strength'")


class JoinCirclePayload(BaseModel):
    code: str = Field(..., min_length=4, max_length=64, description="Single-use invitation code (e.g. MOMENT-XXXX-XXXX)")


# -----------------------------------------------------------------------------
# Feed Endpoints
# -----------------------------------------------------------------------------
@router.get("/feed", response_model=MomentFeedResponse)
def get_moments_feed(
    tab: str = Query("community", description="'community', 'family', 'my_moments', 'saved'"),
    experience_type: Optional[str] = Query(None, description="'day_in_life', 'support_circle', 'milestone', 'general'"),
    category: Optional[str] = Query(None, description="Optional sub-category filter"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve filtered moments feed respecting user roles and audience boundaries."""
    return MomentsService.get_feed(
        db=db,
        user=current_user,
        tab=tab,
        experience_type=experience_type,
        category=category,
        page=page,
        page_size=page_size,
    )


# -----------------------------------------------------------------------------
# Post Endpoints
# -----------------------------------------------------------------------------
@router.post("/posts", response_model=MomentPostResponse, status_code=status.HTTP_201_CREATED)
def create_moment_post(
    payload: MomentPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new moment post with specified audience and experience type."""
    return MomentsService.create_post(db=db, user=current_user, payload=payload)


@router.get("/posts/{post_id}", response_model=MomentPostResponse)
def get_moment_post_detail(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve full moment details including verified comments."""
    return MomentsService.get_post_detail(db=db, user=current_user, post_id=post_id)


@router.put("/posts/{post_id}", response_model=MomentPostResponse)
def update_moment_post(
    post_id: uuid.UUID,
    payload: MomentPostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing moment post (author only)."""
    return MomentsService.update_post(db=db, user=current_user, post_id=post_id, payload=payload)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_moment_post(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a moment post (author or mother of family member)."""
    MomentsService.delete_post(db=db, user=current_user, post_id=post_id)
    return None


# -----------------------------------------------------------------------------
# Comments & Reactions
# -----------------------------------------------------------------------------
@router.get("/posts/{post_id}/comments", response_model=List[MomentCommentResponse])
def get_moment_comments(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve visible comments for a moment post."""
    return MomentsService.get_comments(db=db, user=current_user, post_id=post_id)


@router.post("/posts/{post_id}/comments", response_model=MomentCommentResponse, status_code=status.HTTP_201_CREATED)
def add_moment_comment(
    post_id: uuid.UUID,
    payload: MomentCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a supportive comment to a moment post."""
    return MomentsService.add_comment(db=db, user=current_user, post_id=post_id, payload=payload)


@router.post("/posts/{post_id}/reactions", response_model=MomentReactionResponse)
def toggle_moment_reaction(
    post_id: uuid.UUID,
    payload: Optional[ReactionPayload] = Body(None),
    reaction_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle or update an emotional reaction on a post."""
    resolved_type = "heart"
    if payload and payload.reaction_type:
        resolved_type = payload.reaction_type
    elif reaction_type:
        resolved_type = reaction_type
    return MomentsService.toggle_reaction(db=db, user=current_user, post_id=post_id, reaction_type=resolved_type)


@router.post("/posts/{post_id}/save")
def toggle_save_moment(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle bookmarking a moment into private Saved Moments."""
    is_saved = MomentsService.toggle_save_moment(db=db, user=current_user, post_id=post_id)
    return {"saved": is_saved, "post_id": str(post_id)}


# -----------------------------------------------------------------------------
# Letters to My Baby
# -----------------------------------------------------------------------------
@router.get("/letters", response_model=List[BabyLetterResponse])
def get_baby_letters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve chronological memory letters to baby."""
    return MomentsService.get_letters(db=db, user=current_user)


@router.post("/letters", response_model=BabyLetterResponse, status_code=status.HTTP_201_CREATED)
def create_baby_letter(
    payload: BabyLetterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new memory journal letter to baby (private by default)."""
    return MomentsService.create_letter(db=db, user=current_user, payload=payload)


@router.put("/letters/{letter_id}", response_model=BabyLetterResponse)
def update_baby_letter(
    letter_id: uuid.UUID,
    payload: BabyLetterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a memory letter."""
    return MomentsService.update_letter(db=db, user=current_user, letter_id=letter_id, payload=payload)


@router.delete("/letters/{letter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_baby_letter(
    letter_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a memory letter."""
    MomentsService.delete_letter(db=db, user=current_user, letter_id=letter_id)
    return None


# -----------------------------------------------------------------------------
# Family Circle Management
# -----------------------------------------------------------------------------
@router.get("/family/circle", response_model=FamilyCircleDetailResponse)
def get_family_circle(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get active family circle members and active invitations."""
    return MomentsService.get_family_circle(db=db, user=current_user)


@router.post("/family/invitations", response_model=FamilyInvitationResponse, status_code=status.HTTP_201_CREATED)
def create_family_invitation(
    payload: FamilyInvitationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a single-use hashed invitation code for family circle joining."""
    return MomentsService.create_invitation(db=db, user=current_user, payload=payload)


@router.delete("/family/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_family_invitation(
    invitation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke an unused family circle invitation."""
    MomentsService.revoke_invitation(db=db, user=current_user, invitation_id=invitation_id)
    return None


@router.post("/family/join")
def join_family_circle(
    payload: JoinCirclePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Join a mother's family circle using a valid single-use invitation code."""
    member = MomentsService.join_family_circle(db=db, user=current_user, code=payload.code)
    return {
        "success": True,
        "message": "Successfully linked to Family Circle",
        "member_id": str(member.id),
        "mother_id": str(member.mother_id),
        "relationship": member.relationship,
    }


@router.delete("/family/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_family_member(
    member_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a family member immediately revoking all Family Circle access."""
    MomentsService.remove_family_member(db=db, user=current_user, member_id=member_id)
    return None


@router.put("/family/members/{member_id}/permissions")
def update_family_member_permissions(
    member_id: uuid.UUID,
    payload: FamilyMemberPermissionsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update mother-controlled permissions for a family member."""
    member = MomentsService.update_member_permissions(
        db=db,
        user=current_user,
        member_id=member_id,
        payload=payload,
    )
    return {
        "member_id": str(member.id),
        "can_upload": member.can_upload,
        "can_comment": member.can_comment,
    }


# -----------------------------------------------------------------------------
# Community Moderation & Peer Safety
# -----------------------------------------------------------------------------
@router.post("/reports", response_model=MomentReportResponse, status_code=status.HTTP_201_CREATED)
def report_content(
    payload: MomentReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Report inappropriate or distressing content."""
    return MomentsService.report_content(db=db, user=current_user, payload=payload)


@router.post("/users/{target_user_id}/block")
def block_user(
    target_user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Block a user so their posts and comments are hidden."""
    MomentsService.block_user(db=db, user=current_user, target_user_id=target_user_id)
    return {"blocked": True, "target_user_id": str(target_user_id)}


@router.delete("/users/{target_user_id}/block")
def unblock_user(
    target_user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unblock a previously blocked user."""
    MomentsService.unblock_user(db=db, user=current_user, target_user_id=target_user_id)
    return {"blocked": False, "target_user_id": str(target_user_id)}


# -----------------------------------------------------------------------------
# Media Upload & Delivery
# -----------------------------------------------------------------------------
@router.post("/media/upload")
async def upload_moment_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload photo or video media for a moment or letter."""
    filename = file.filename or "media"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS.keys())}",
        )

    media_type = ALLOWED_EXTENSIONS[ext]
    safe_base = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", filename)
    unique_filename = f"{uuid.uuid4().hex}_{safe_base}"
    target_path = os.path.join(MOMENTS_UPLOAD_DIR, unique_filename)

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Media file exceeds maximum allowed size (25 MB)",
        )

    with open(target_path, "wb") as f:
        f.write(contents)

    return {
        "url": f"/api/moments/media/{unique_filename}",
        "filename": unique_filename,
        "media_type": media_type,
        "size_bytes": len(contents),
    }


@router.get("/media/{filename}")
def get_moment_media(filename: str):
    """Serve uploaded moment photo or video."""
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(MOMENTS_UPLOAD_DIR, safe_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found")
    return FileResponse(file_path)
