"""FastAPI router for Anonymous Mother's Community (Mother's Circle).

Endpoints:
- Community Posts:
  - POST   /api/community/posts               (Create anonymous post)
  - GET    /api/community/posts               (Get community feed with category filter, sorting, pagination)
  - GET    /api/community/posts/{post_id}     (Get post details with full comments thread)
  - PUT    /api/community/posts/{post_id}     (Edit own post)
  - DELETE /api/community/posts/{post_id}     (Delete own post)
- Comments:
  - GET    /api/community/posts/{post_id}/comments  (Get post comments)
  - POST   /api/community/posts/{post_id}/comments  (Add anonymous comment)
  - PUT    /api/community/comments/{comment_id}     (Edit own comment)
  - DELETE /api/community/comments/{comment_id}     (Delete own comment)
- Reactions:
  - POST   /api/community/posts/{post_id}/reactions (Add/change/remove supportive reaction)
- Safety & Reporting:
  - POST   /api/community/reports             (Report inappropriate content)
  - GET    /api/community/moderation/queue    (Moderation review queue - doctors/admins only)
  - POST   /api/community/moderation/action   (Take moderation action - doctors/admins only)
"""

from typing import Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.models.user import User
from backend.schemas.community import (
    CommentCreateRequest,
    CommentResponse,
    CommentUpdateRequest,
    ModerationActionRequest,
    ModerationActionResponse,
    ModerationQueueItem,
    PostCreateRequest,
    PostFeedResponse,
    PostResponse,
    PostUpdateRequest,
    ReactionResponse,
    ReactionToggleRequest,
    ReportCreateRequest,
    ReportResponse,
)
from backend.services.auth_service import get_current_user
from backend.services.community_service import CommunityService

router = APIRouter(
    prefix="/api/community",
    tags=["Anonymous Community"],
)


# ============================================================================
# Community Posts
# ============================================================================


@router.post(
    "/posts",
    response_model=PostResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an anonymous community post",
)
def create_community_post(
    payload: PostCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostResponse:
    """Create a new post in Mother's Circle. Identity remains strictly anonymous to other users."""
    return CommunityService.create_post(db=db, user=current_user, payload=payload)


@router.get(
    "/posts",
    response_model=PostFeedResponse,
    summary="Fetch approved community posts feed",
)
def get_community_feed(
    category: Optional[str] = Query(None, description="Optional category filter"),
    sort: str = Query("newest", description="'newest' or 'most_supported'"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=50, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostFeedResponse:
    """Fetch paginated community feed with anonymous author labels, like and comment counts."""
    return CommunityService.get_feed(
        db=db,
        user=current_user,
        category=category,
        sort=sort,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/posts/{post_id}",
    response_model=PostResponse,
    summary="Fetch single post and its comment thread",
)
def get_post_detail(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostResponse:
    """Retrieve full details of a post including its anonymous comments."""
    return CommunityService.get_post_detail(db=db, user=current_user, post_id=post_id)


@router.put(
    "/posts/{post_id}",
    response_model=PostResponse,
    summary="Edit own anonymous post",
)
def update_community_post(
    post_id: uuid.UUID,
    payload: PostUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostResponse:
    """Update content of own post. Enforces author ownership on backend."""
    return CommunityService.update_post(db=db, user=current_user, post_id=post_id, payload=payload)


@router.delete(
    "/posts/{post_id}",
    summary="Delete own anonymous post",
)
def delete_community_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Delete own post. Enforces author or moderator authorization."""
    return CommunityService.delete_post(db=db, user=current_user, post_id=post_id)


# ============================================================================
# Comments
# ============================================================================


@router.get(
    "/posts/{post_id}/comments",
    response_model=List[CommentResponse],
    summary="Fetch comments for a community post",
)
def get_post_comments(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[CommentResponse]:
    """Fetch all approved comments for a post anonymously."""
    post_detail = CommunityService.get_post_detail(db=db, user=current_user, post_id=post_id)
    return post_detail.comments or []


@router.post(
    "/posts/{post_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an anonymous comment to a post",
)
def add_post_comment(
    post_id: uuid.UUID,
    payload: CommentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentResponse:
    """Leave a supportive anonymous comment on a post."""
    return CommunityService.add_comment(
        db=db,
        user=current_user,
        post_id=post_id,
        payload=payload,
    )


@router.put(
    "/comments/{comment_id}",
    response_model=CommentResponse,
    summary="Edit own anonymous comment",
)
def update_comment(
    comment_id: uuid.UUID,
    payload: CommentUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentResponse:
    """Edit own comment. Enforces author ownership."""
    return CommunityService.update_comment(
        db=db,
        user=current_user,
        comment_id=comment_id,
        payload=payload,
    )


@router.delete(
    "/comments/{comment_id}",
    summary="Delete own anonymous comment",
)
def delete_comment(
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Delete own comment. Enforces author or moderator authorization."""
    return CommunityService.delete_comment(
        db=db,
        user=current_user,
        comment_id=comment_id,
    )


# ============================================================================
# Reactions
# ============================================================================


@router.post(
    "/posts/{post_id}/reactions",
    response_model=ReactionResponse,
    summary="Toggle a supportive reaction on a post",
)
def toggle_post_reaction(
    post_id: uuid.UUID,
    payload: ReactionToggleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReactionResponse:
    """Add, switch, or remove a reaction (Sending Love, I Understand, You're Not Alone, Sending Strength)."""
    return CommunityService.toggle_reaction(
        db=db,
        user=current_user,
        post_id=post_id,
        payload=payload,
    )


# ============================================================================
# Safety, Reporting & Moderation
# ============================================================================


@router.post(
    "/reports",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Report inappropriate post or comment",
)
def report_content(
    payload: ReportCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportResponse:
    """Flag inappropriate content for clinical review."""
    return CommunityService.create_report(
        db=db,
        user=current_user,
        payload=payload,
    )


@router.get(
    "/moderation/queue",
    response_model=List[ModerationQueueItem],
    summary="Get content moderation queue (clinicians / admins only)",
)
def get_moderation_queue(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ModerationQueueItem]:
    """Review flagged community posts and comments."""
    return CommunityService.get_moderation_queue(db=db, moderator_user=current_user)


@router.post(
    "/moderation/action",
    response_model=ModerationActionResponse,
    summary="Take action on reported content (clinicians / admins only)",
)
def take_moderation_action(
    payload: ModerationActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ModerationActionResponse:
    """Hide, remove, approve, or escalate reported content."""
    return CommunityService.take_moderation_action(
        db=db,
        moderator_user=current_user,
        payload=payload,
    )
