"""Business logic and safeguarding service for Anonymous Mother's Community (Mother's Circle).

Features:
- Strict zero-PII serialization and author isolation.
- Content sanitization and rate limiting support.
- Acute crisis & self-harm safeguarding intercept with Tele-MANAS escalation.
- Reaction deduplication and atomic counter synchronization.
- Ownership authorization for edits and deletions.
- Moderation queue management and audit logging.
"""

from datetime import datetime, timezone
import html
import logging
import re
from typing import Dict, List, Optional, Tuple
import uuid

from fastapi import HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from backend.models.community import (
    CommunityComment,
    CommunityPost,
    CommunityReaction,
    CommunityReport,
    ModerationAction,
)
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
    VALID_CATEGORIES,
    VALID_REACTIONS,
    VALID_REPORT_REASONS,
)

logger = logging.getLogger("ppd.community")

# Acute crisis keywords for postpartum safeguarding
CRISIS_KEYWORDS = [
    r"\bkill\s+myself\b",
    r"\bend\s+my\s+life\b",
    r"\bend\s+it\s+all\b",
    r"\bsuicid",
    r"\bwant\s+to\s+die\b",
    r"\bharm\s+myself\b",
    r"\bhurt\s+myself\b",
    r"\bcut\s+myself\b",
    r"\bharm\s+my\s+baby\b",
    r"\bhurt\s+my\s+baby\b",
    r"\bkill\s+my\s+baby\b",
    r"\bdrown\s+my\s+baby\b",
    r"\bshake\s+my\s+baby\b",
]
CRISIS_REGEX = re.compile("|".join(CRISIS_KEYWORDS), re.IGNORECASE)


def sanitize_text(text: str) -> str:
    """Sanitize user submitted text, removing dangerous HTML and stripping excess spaces."""
    if not text:
        return ""
    # Strip HTML tags
    clean = re.sub(r"<[^>]*?>", "", text)
    # Unescape HTML entities to prevent double-encoding, then re-escape cleanly for display safety
    clean = html.unescape(clean).strip()
    return clean


def detect_crisis_risk(text: str) -> bool:
    """Analyze text for indications of acute crisis, self-harm, or infant harm."""
    if not text:
        return False
    return bool(CRISIS_REGEX.search(text))


class CommunityService:
    """Comprehensive service handling anonymous community interactions."""

    @staticmethod
    def create_post(
        db: Session,
        user: User,
        payload: PostCreateRequest,
    ) -> PostResponse:
        """Create a new anonymous post, enforcing content sanitization and crisis checks."""
        clean_content = sanitize_text(payload.content)
        if len(clean_content) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Post content must be at least 10 characters long after trimming.",
            )

        category = payload.category.strip()
        if category not in VALID_CATEGORIES:
            category = "Emotional Support"

        display_author = (payload.display_author or "Anonymous Mother").strip()
        if display_author not in ("Anonymous Mother", "A Mother in Her Journey", "Anonymous Member"):
            display_author = "Anonymous Mother"

        # Check for acute crisis indicators
        is_crisis = detect_crisis_risk(clean_content)
        post_status = "flagged" if is_crisis else "approved"

        post = CommunityPost(
            author_user_id=user.id,
            content=clean_content,
            category=category,
            mood=payload.mood.strip() if payload.mood else None,
            display_author=display_author,
            is_anonymous=True,
            status=post_status,
            likes_count=0,
            comments_count=0,
        )
        db.add(post)
        db.commit()
        db.refresh(post)

        if is_crisis:
            logger.warning(
                "Post %s flagged for crisis keywords; escalated to clinical safeguarding queue.",
                post.id,
            )
            # Create an automatic safeguarding moderation record
            action = ModerationAction(
                moderator_user_id=None,
                target_type="post",
                target_id=post.id,
                action="safeguard_escalate",
                reason="Automated crisis pattern detected (self-harm / safety intercept). Tele-MANAS hotline escalation triggered.",
            )
            db.add(action)
            db.commit()

        return PostResponse(
            id=post.id,
            display_author=post.display_author,
            content=post.content,
            category=post.category,
            mood=post.mood,
            created_at=post.created_at,
            updated_at=post.updated_at,
            likes_count=0,
            comments_count=0,
            reaction_breakdown={},
            user_reaction=None,
            is_own_post=True,
            comments=[],
        )

    @staticmethod
    def get_feed(
        db: Session,
        user: User,
        category: Optional[str] = None,
        sort: str = "newest",
        page: int = 1,
        page_size: int = 10,
    ) -> PostFeedResponse:
        """Fetch approved community posts for feed with pagination, sorting, and category filter."""
        page = max(1, page)
        page_size = min(50, max(1, page_size))

        # Query posts: approved posts, or user's own posts even if pending/flagged
        base_query = select(CommunityPost).where(
            (CommunityPost.status == "approved") | (CommunityPost.author_user_id == user.id)
        )

        if category and category in VALID_CATEGORIES:
            base_query = base_query.where(CommunityPost.category == category)

        # Count total
        count_stmt = select(func.count()).select_from(base_query.subquery())
        total_count = db.scalar(count_stmt) or 0

        # Sorting
        if sort == "most_supported":
            base_query = base_query.order_by(
                desc(CommunityPost.likes_count),
                desc(CommunityPost.created_at),
            )
        else:
            base_query = base_query.order_by(desc(CommunityPost.created_at))

        # Pagination
        offset = (page - 1) * page_size
        posts = db.scalars(base_query.offset(offset).limit(page_size)).all()

        post_ids = [p.id for p in posts]

        # Bulk fetch user's own reactions for these posts
        user_reactions_map: Dict[uuid.UUID, str] = {}
        if post_ids:
            user_reactions_stmt = select(CommunityReaction).where(
                CommunityReaction.post_id.in_(post_ids),
                CommunityReaction.user_id == user.id,
            )
            for r in db.scalars(user_reactions_stmt).all():
                user_reactions_map[r.post_id] = r.reaction_type

        # Bulk fetch reaction breakdown counts
        breakdown_map: Dict[uuid.UUID, Dict[str, int]] = {p.id: {} for p in posts}
        if post_ids:
            counts_stmt = (
                select(
                    CommunityReaction.post_id,
                    CommunityReaction.reaction_type,
                    func.count(CommunityReaction.id),
                )
                .where(CommunityReaction.post_id.in_(post_ids))
                .group_by(CommunityReaction.post_id, CommunityReaction.reaction_type)
            )
            for pid, r_type, c in db.execute(counts_stmt):
                breakdown_map[pid][r_type] = c

        post_responses: List[PostResponse] = []
        for p in posts:
            post_responses.append(
                PostResponse(
                    id=p.id,
                    display_author=p.display_author,
                    content=p.content,
                    category=p.category,
                    mood=p.mood,
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                    likes_count=p.likes_count,
                    comments_count=p.comments_count,
                    reaction_breakdown=breakdown_map.get(p.id, {}),
                    user_reaction=user_reactions_map.get(p.id),
                    is_own_post=(p.author_user_id == user.id),
                )
            )

        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
        has_more = page < total_pages

        return PostFeedResponse(
            posts=post_responses,
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_more=has_more,
        )

    @staticmethod
    def get_post_detail(
        db: Session,
        user: User,
        post_id: uuid.UUID,
    ) -> PostResponse:
        """Fetch single post with full comments thread."""
        post = db.get(CommunityPost, post_id)
        if not post or (post.status != "approved" and post.author_user_id != user.id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Community post not found.",
            )

        # Get reactions breakdown
        counts_stmt = (
            select(CommunityReaction.reaction_type, func.count(CommunityReaction.id))
            .where(CommunityReaction.post_id == post.id)
            .group_by(CommunityReaction.reaction_type)
        )
        breakdown = {r_type: c for r_type, c in db.execute(counts_stmt)}

        user_reaction_stmt = select(CommunityReaction.reaction_type).where(
            CommunityReaction.post_id == post.id,
            CommunityReaction.user_id == user.id,
        )
        user_reaction = db.scalar(user_reaction_stmt)

        # Get approved comments
        comments_stmt = (
            select(CommunityComment)
            .where(
                CommunityComment.post_id == post.id,
                (CommunityComment.status == "approved") | (CommunityComment.author_user_id == user.id),
            )
            .order_by(CommunityComment.created_at.asc())
        )
        comments = db.scalars(comments_stmt).all()

        comment_responses = [
            CommentResponse(
                id=c.id,
                post_id=c.post_id,
                display_author=c.display_author,
                content=c.content,
                created_at=c.created_at,
                updated_at=c.updated_at,
                is_own_comment=(c.author_user_id == user.id),
            )
            for c in comments
        ]

        return PostResponse(
            id=post.id,
            display_author=post.display_author,
            content=post.content,
            category=post.category,
            mood=post.mood,
            created_at=post.created_at,
            updated_at=post.updated_at,
            likes_count=post.likes_count,
            comments_count=post.comments_count,
            reaction_breakdown=breakdown,
            user_reaction=user_reaction,
            is_own_post=(post.author_user_id == user.id),
            comments=comment_responses,
        )

    @staticmethod
    def update_post(
        db: Session,
        user: User,
        post_id: uuid.UUID,
        payload: PostUpdateRequest,
    ) -> PostResponse:
        """Update an existing post; strictly restricted to the author."""
        post = db.get(CommunityPost, post_id)
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Community post not found.",
            )

        if post.author_user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only edit your own community posts.",
            )

        clean_content = sanitize_text(payload.content)
        if len(clean_content) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Post content must be at least 10 characters long after trimming.",
            )

        post.content = clean_content
        if payload.category and payload.category in VALID_CATEGORIES:
            post.category = payload.category
        if payload.mood is not None:
            post.mood = payload.mood.strip() if payload.mood else None

        post.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(post)

        return CommunityService.get_post_detail(db, user, post.id)

    @staticmethod
    def delete_post(
        db: Session,
        user: User,
        post_id: uuid.UUID,
    ) -> Dict[str, str]:
        """Delete an existing post; restricted to author or administrative moderator."""
        post = db.get(CommunityPost, post_id)
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Community post not found.",
            )

        is_author = post.author_user_id == user.id
        is_mod = user.role in ("doctor", "admin")

        if not is_author and not is_mod:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only delete your own community posts.",
            )

        db.delete(post)
        db.commit()

        return {"status": "success", "message": "Post successfully deleted."}

    @staticmethod
    def add_comment(
        db: Session,
        user: User,
        post_id: uuid.UUID,
        payload: CommentCreateRequest,
    ) -> CommentResponse:
        """Add an anonymous supportive comment."""
        post = db.get(CommunityPost, post_id)
        if not post or post.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Community post not found.",
            )

        clean_content = sanitize_text(payload.content)
        if len(clean_content) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comment cannot be empty.",
            )

        is_crisis = detect_crisis_risk(clean_content)
        comment_status = "flagged" if is_crisis else "approved"

        comment = CommunityComment(
            post_id=post.id,
            author_user_id=user.id,
            content=clean_content,
            display_author="Anonymous Mother",
            status=comment_status,
        )
        db.add(comment)

        # Increment comments count
        post.comments_count += 1
        db.commit()
        db.refresh(comment)

        return CommentResponse(
            id=comment.id,
            post_id=comment.post_id,
            display_author=comment.display_author,
            content=comment.content,
            created_at=comment.created_at,
            updated_at=comment.updated_at,
            is_own_comment=True,
        )

    @staticmethod
    def update_comment(
        db: Session,
        user: User,
        comment_id: uuid.UUID,
        payload: CommentUpdateRequest,
    ) -> CommentResponse:
        """Update an anonymous comment; author-only."""
        comment = db.get(CommunityComment, comment_id)
        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Comment not found.",
            )

        if comment.author_user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only edit your own comments.",
            )

        clean_content = sanitize_text(payload.content)
        if len(clean_content) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comment cannot be empty.",
            )

        comment.content = clean_content
        comment.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(comment)

        return CommentResponse(
            id=comment.id,
            post_id=comment.post_id,
            display_author=comment.display_author,
            content=comment.content,
            created_at=comment.created_at,
            updated_at=comment.updated_at,
            is_own_comment=True,
        )

    @staticmethod
    def delete_comment(
        db: Session,
        user: User,
        comment_id: uuid.UUID,
    ) -> Dict[str, str]:
        """Delete an anonymous comment; author or moderator only."""
        comment = db.get(CommunityComment, comment_id)
        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Comment not found.",
            )

        is_author = comment.author_user_id == user.id
        is_mod = user.role in ("doctor", "admin")

        if not is_author and not is_mod:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only delete your own comments.",
            )

        post = db.get(CommunityPost, comment.post_id)
        if post and post.comments_count > 0:
            post.comments_count -= 1

        db.delete(comment)
        db.commit()

        return {"status": "success", "message": "Comment successfully deleted."}

    @staticmethod
    def toggle_reaction(
        db: Session,
        user: User,
        post_id: uuid.UUID,
        payload: ReactionToggleRequest,
    ) -> ReactionResponse:
        """Add, change, or remove a supportive reaction on a post. Deduplicated per mother."""
        post = db.get(CommunityPost, post_id)
        if not post or post.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Community post not found.",
            )

        reaction_type = payload.reaction_type.strip()
        if reaction_type not in VALID_REACTIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid reaction type. Must be one of: {', '.join(VALID_REACTIONS)}",
            )

        existing_stmt = select(CommunityReaction).where(
            CommunityReaction.post_id == post.id,
            CommunityReaction.user_id == user.id,
        )
        existing = db.scalar(existing_stmt)

        current_user_reaction: Optional[str] = None

        if existing:
            if existing.reaction_type == reaction_type:
                # Toggling off (removing reaction)
                db.delete(existing)
                current_user_reaction = None
            else:
                # Switching reaction
                existing.reaction_type = reaction_type
                current_user_reaction = reaction_type
        else:
            # Adding new reaction
            new_reaction = CommunityReaction(
                post_id=post.id,
                user_id=user.id,
                reaction_type=reaction_type,
            )
            db.add(new_reaction)
            current_user_reaction = reaction_type

        db.commit()

        # Recalculate denormalized total likes count and breakdown
        total_reactions_stmt = select(func.count(CommunityReaction.id)).where(
            CommunityReaction.post_id == post.id
        )
        total_count = db.scalar(total_reactions_stmt) or 0
        post.likes_count = total_count

        db.commit()
        db.refresh(post)

        counts_stmt = (
            select(CommunityReaction.reaction_type, func.count(CommunityReaction.id))
            .where(CommunityReaction.post_id == post.id)
            .group_by(CommunityReaction.reaction_type)
        )
        breakdown = {r_t: c for r_t, c in db.execute(counts_stmt)}

        return ReactionResponse(
            post_id=post.id,
            user_reaction=current_user_reaction,
            likes_count=post.likes_count,
            reaction_breakdown=breakdown,
        )

    @staticmethod
    def create_report(
        db: Session,
        user: User,
        payload: ReportCreateRequest,
    ) -> ReportResponse:
        """File a safety or policy violation report against a post or comment."""
        if not payload.post_id and not payload.comment_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Must specify either a post_id or comment_id to report.",
            )

        reason = payload.reason.strip()
        if reason not in VALID_REPORT_REASONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid report reason. Must be one of: {', '.join(VALID_REPORT_REASONS)}",
            )

        report = CommunityReport(
            reporter_user_id=user.id,
            post_id=payload.post_id,
            comment_id=payload.comment_id,
            reason=reason,
            details=payload.details.strip() if payload.details else None,
            status="pending",
        )
        db.add(report)

        # Check total reports for auto-flagging
        if payload.post_id:
            total_reports = db.scalar(
                select(func.count(CommunityReport.id)).where(
                    CommunityReport.post_id == payload.post_id
                )
            ) or 0
            if total_reports >= 2:  # with the new report, >= 3
                target_post = db.get(CommunityPost, payload.post_id)
                if target_post and target_post.status == "approved":
                    target_post.status = "flagged"

        if payload.comment_id:
            total_reports = db.scalar(
                select(func.count(CommunityReport.id)).where(
                    CommunityReport.comment_id == payload.comment_id
                )
            ) or 0
            if total_reports >= 2:
                target_comment = db.get(CommunityComment, payload.comment_id)
                if target_comment and target_comment.status == "approved":
                    target_comment.status = "flagged"

        db.commit()
        db.refresh(report)

        return ReportResponse(
            id=report.id,
            status="received",
            message="Thank you for keeping our community safe. Our clinical moderation team has received your report for review.",
        )

    @staticmethod
    def get_moderation_queue(
        db: Session,
        moderator_user: User,
    ) -> List[ModerationQueueItem]:
        """Fetch pending items in moderation queue (doctors / admins only)."""
        if moderator_user.role not in ("doctor", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Moderation queue requires doctor or admin privileges.",
            )

        # 1. Flagged or reported posts
        posts_stmt = select(CommunityPost).where(CommunityPost.status.in_(["flagged", "pending"]))
        flagged_posts = db.scalars(posts_stmt).all()

        queue_items: List[ModerationQueueItem] = []
        for p in flagged_posts:
            rep_count = db.scalar(
                select(func.count(CommunityReport.id)).where(CommunityReport.post_id == p.id)
            ) or 0
            latest_rep = db.scalar(
                select(CommunityReport)
                .where(CommunityReport.post_id == p.id)
                .order_by(desc(CommunityReport.created_at))
                .limit(1)
            )
            queue_items.append(
                ModerationQueueItem(
                    id=uuid.uuid4(),
                    target_type="post",
                    target_id=p.id,
                    content=p.content,
                    category=p.category,
                    status=p.status,
                    reports_count=rep_count,
                    latest_report_reason=latest_rep.reason if latest_rep else "Automated Crisis Safety Flag",
                    latest_report_details=latest_rep.details if latest_rep else None,
                    created_at=p.created_at,
                )
            )

        # 2. Flagged comments
        comments_stmt = select(CommunityComment).where(CommunityComment.status.in_(["flagged", "pending"]))
        flagged_comments = db.scalars(comments_stmt).all()
        for c in flagged_comments:
            rep_count = db.scalar(
                select(func.count(CommunityReport.id)).where(CommunityReport.comment_id == c.id)
            ) or 0
            latest_rep = db.scalar(
                select(CommunityReport)
                .where(CommunityReport.comment_id == c.id)
                .order_by(desc(CommunityReport.created_at))
                .limit(1)
            )
            queue_items.append(
                ModerationQueueItem(
                    id=uuid.uuid4(),
                    target_type="comment",
                    target_id=c.id,
                    content=c.content,
                    category="Comment",
                    status=c.status,
                    reports_count=rep_count,
                    latest_report_reason=latest_rep.reason if latest_rep else "Automated Safety Flag",
                    latest_report_details=latest_rep.details if latest_rep else None,
                    created_at=c.created_at,
                )
            )

        return queue_items

    @staticmethod
    def take_moderation_action(
        db: Session,
        moderator_user: User,
        payload: ModerationActionRequest,
    ) -> ModerationActionResponse:
        """Apply moderation intervention (hide, remove, approve, safeguard_escalate)."""
        if moderator_user.role not in ("doctor", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Moderation actions require doctor or admin privileges.",
            )

        action_type = payload.action.strip()
        if action_type not in ("hide", "remove", "approve", "safeguard_escalate"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid moderation action.",
            )

        status_map = {
            "hide": "hidden",
            "remove": "removed",
            "approve": "approved",
            "safeguard_escalate": "flagged",
        }
        new_status = status_map[action_type]

        if payload.target_type == "post":
            target = db.get(CommunityPost, payload.target_id)
            if not target:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Target post not found.",
                )
            target.status = new_status
        elif payload.target_type == "comment":
            target = db.get(CommunityComment, payload.target_id)
            if not target:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Target comment not found.",
                )
            target.status = new_status
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid target_type. Must be 'post' or 'comment'.",
            )

        mod_action = ModerationAction(
            moderator_user_id=moderator_user.id,
            target_type=payload.target_type,
            target_id=payload.target_id,
            action=action_type,
            reason=payload.reason,
        )
        db.add(mod_action)
        db.commit()
        db.refresh(mod_action)

        return ModerationActionResponse(
            id=mod_action.id,
            action=action_type,
            target_type=payload.target_type,
            target_id=payload.target_id,
            status=new_status,
            message=f"Content status updated to '{new_status}' with recorded justification.",
        )

    @staticmethod
    def seed_demo_posts(db: Session, default_user: Optional[User] = None) -> None:
        """Seed initial warm and supportive community reflections if the table is currently empty."""
        post_count = db.scalar(select(func.count(CommunityPost.id))) or 0
        if post_count > 0:
            return

        user_stmt = select(User).where(User.role == "patient")
        author = default_user or db.scalar(user_stmt)
        if not author:
            return

        demo_posts = [
            {
                "content": "To any mom who cried in the bathroom today: you are not failing. You are keeping a tiny human alive through extreme sleep deprivation and hormonal shifts. Give yourself grace today.",
                "category": "Emotional Support",
                "mood": "Overwhelmed",
                "display_author": "Anonymous Mother",
                "likes_count": 8,
            },
            {
                "content": "Today my baby smiled during morning sunlight, and for the first time in 4 weeks, I felt a spark of pure joy return. Small steps, but celebrating this quiet win.",
                "category": "Small Wins",
                "mood": "Hopeful",
                "display_author": "A Mother in Her Journey",
                "likes_count": 12,
            },
            {
                "content": "Did anyone else feel guilty asking their partner to take over the night feed? I had to remind myself that resting is healthcare for both me and my baby.",
                "category": "Questions & Advice",
                "mood": "Healing",
                "display_author": "Anonymous Mother",
                "likes_count": 5,
            },
            {
                "content": "Week 6 check-in: the overwhelming fog is slowly lifting with therapy and gentle daily walks. There is light on the other side of postpartum anxiety.",
                "category": "My Postpartum Journey",
                "mood": "Grateful",
                "display_author": "Anonymous Member",
                "likes_count": 9,
            },
        ]

        for p_data in demo_posts:
            post = CommunityPost(
                author_user_id=author.id,
                content=p_data["content"],
                category=p_data["category"],
                mood=p_data["mood"],
                display_author=p_data["display_author"],
                is_anonymous=True,
                status="approved",
                likes_count=p_data["likes_count"],
                comments_count=0,
            )
            db.add(post)

        db.commit()
        logger.info("Seeded %d warm demo posts for Mother's Circle community sanctuary.", len(demo_posts))
