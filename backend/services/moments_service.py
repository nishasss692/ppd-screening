"""Business logic, authorization, and safeguarding for AANCHAL Moments.

Enforces:
- Strict role-based isolation (mothers vs family vs community).
- Explicit audience permissions ('community', 'family', 'both').
- Single-use hashed invitation code lifecycle for family linking.
- Immediate revocation of removed family members.
- Private letters to baby isolation (default private; shared only on explicit consent).
- Anonymous identity masking in community responses.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import html
import logging
import re
import secrets
from typing import Any, Dict, List, Optional, Set
import uuid

from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session

from backend.database.base import utc_now
from backend.models.moments import (
    BabyLetter,
    FamilyCircleMember,
    FamilyInvitation,
    MomentReport,
    MomentsComment,
    MomentsPost,
    MomentsReaction,
    SavedMoment,
    UserBlock,
)
from backend.models.mother import Mother
from backend.models.user import User
from backend.schemas.moments import (
    BabyLetterCreate,
    BabyLetterResponse,
    BabyLetterUpdate,
    FamilyCircleDetailResponse,
    FamilyCircleMemberResponse,
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

logger = logging.getLogger("ppd.moments")


def hash_invitation_code(code: str) -> str:
    """Compute secure SHA-256 hash of an invitation code."""
    return hashlib.sha256(code.strip().upper().encode("utf-8")).hexdigest()


def generate_secure_invitation_code() -> str:
    """Generate human-readable random invitation code: MOMENT-XXXX-XXXX."""
    part1 = secrets.token_hex(2).upper()
    part2 = secrets.token_hex(2).upper()
    return f"MOMENT-{part1}-{part2}"


def sanitize_moment_text(text: str) -> str:
    """Sanitize user text input, stripping HTML tags."""
    if not text:
        return ""
    clean = re.sub(r"<[^>]*?>", "", text)
    return html.unescape(clean).strip()


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure datetime has timezone.utc to prevent naive vs aware comparison errors."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def to_uuid(val: Any) -> uuid.UUID:
    """Normalize input into a uuid.UUID instance."""
    if isinstance(val, uuid.UUID):
        return val
    return uuid.UUID(str(val))


class MomentsService:
    """Central service orchestrating AANCHAL Moments workflows."""

    # -------------------------------------------------------------------------
    # Helper: Resolve Mother Entity for User
    # -------------------------------------------------------------------------
    @staticmethod
    def resolve_user_mother(db: Session, user: User) -> Optional[Mother]:
        """Resolve the linked Mother entity for a patient or family account."""
        if user.mother_id:
            return db.scalar(select(Mother).where(Mother.id == user.mother_id))
        if user.role == "patient":
            # Fallback by email
            m = db.scalar(select(Mother).where(Mother.email == user.email))
            if m:
                user.mother_id = m.id
                db.commit()
                return m
            # If still missing, create a baseline Mother record for patient
            new_mother = Mother(
                name=user.full_name or "Mother",
                email=user.email,
                notes="Created for Moments profile",
            )
            db.add(new_mother)
            db.flush()
            user.mother_id = new_mother.id
            db.commit()
            return new_mother
        return None

    # -------------------------------------------------------------------------
    # Helper: Get Blocked User IDs
    # -------------------------------------------------------------------------
    @staticmethod
    def get_blocked_user_ids(db: Session, user_id: uuid.UUID) -> Set[uuid.UUID]:
        """Fetch all user IDs blocked by or blocking the given user."""
        stmt = select(UserBlock.blocked_user_id).where(UserBlock.blocker_user_id == user_id)
        blocked_by_me = set(db.scalars(stmt).all())
        stmt2 = select(UserBlock.blocker_user_id).where(UserBlock.blocked_user_id == user_id)
        blocked_me = set(db.scalars(stmt2).all())
        return blocked_by_me | blocked_me

    # -------------------------------------------------------------------------
    # Posts & Feeds
    # -------------------------------------------------------------------------
    @classmethod
    def create_post(
        cls,
        db: Session,
        user: User,
        payload: MomentPostCreate,
    ) -> MomentPostResponse:
        """Create a moment with audience selection ('community', 'family', 'both')."""
        clean_caption = sanitize_moment_text(payload.caption)
        if len(clean_caption) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Caption must be at least 2 characters.",
            )

        mother = cls.resolve_user_mother(db, user)
        mother_id = mother.id if mother else None

        audience = payload.audience.strip().lower()
        if audience not in ("community", "family", "both"):
            audience = "family"

        # Role-based posting rules:
        if user.role == "family":
            # Family members CANNOT post to community!
            if audience in ("community", "both"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Family members can only post to their private Family Circle.",
                )
            # Check if mother enabled posting permission for this family member
            f_member = db.scalar(
                select(FamilyCircleMember).where(
                    FamilyCircleMember.user_id == user.id,
                    FamilyCircleMember.mother_id == mother_id,
                    FamilyCircleMember.is_active.is_(True),
                )
            )
            if not f_member or not f_member.can_upload:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not currently have permission to post in this Family Circle. Ask the mother to enable posting permission.",
                )

        # Anonymous display handling
        is_anon = payload.is_anonymous and payload.experience_type == "support_circle"
        display_author = (payload.display_author or "").strip()
        if not display_author:
            if is_anon:
                display_author = "Anonymous Mother"
            else:
                display_author = user.full_name or "Mother"

        post = MomentsPost(
            author_user_id=user.id,
            mother_id=mother_id,
            caption=clean_caption,
            experience_type=payload.experience_type,
            category=payload.category,
            audience=audience,
            is_anonymous=is_anon,
            display_author=display_author,
            author_avatar=None if is_anon else (user.full_name[:2].upper() if user.full_name else "M"),
            media_url=payload.media_url,
            media_type=payload.media_type,
            milestone_title=payload.milestone_title,
            mood=payload.mood,
            status="approved",
            likes_count=0,
            comments_count=0,
        )
        db.add(post)
        db.commit()
        db.refresh(post)

        return cls._format_post_response(post, current_user_id=user.id)

    @classmethod
    def get_feed(
        cls,
        db: Session,
        user: User,
        tab: str = "community",
        experience_type: Optional[str] = None,
        category: Optional[str] = None,
        page: int = 1,
        page_size: int = 15,
    ) -> MomentFeedResponse:
        """Fetch feed tailored strictly by tab and user permissions."""
        tab = (tab or "community").strip().lower()
        blocked_ids = cls.get_blocked_user_ids(db, user.id)

        # 1. Family Member Role Restrictions
        if user.role == "family":
            # Family members CANNOT browse the community feed under any circumstance!
            if tab in ("community", "support_circle"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Family members are restricted to their private Family Circle and cannot view the Mother Community feed.",
                )
            tab = "family"

            if not user.mother_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You are not linked to any mother's Family Circle.",
                )
            active_m = db.scalar(
                select(FamilyCircleMember).where(
                    FamilyCircleMember.user_id == user.id,
                    FamilyCircleMember.mother_id == user.mother_id,
                    FamilyCircleMember.is_active.is_(True),
                )
            )
            if not active_m:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Your access to this Family Circle has been revoked.",
                )

        mother = cls.resolve_user_mother(db, user)
        mother_id = mother.id if mother else None

        stmt = select(MomentsPost).where(MomentsPost.status == "approved")

        # Exclude blocked authors
        if blocked_ids:
            stmt = stmt.where(~MomentsPost.author_user_id.in_(blocked_ids))

        # Audience & Tab scoping
        if tab == "community":
            # Verified mother community feed
            stmt = stmt.where(MomentsPost.audience.in_(("community", "both")))
        elif tab == "family":
            # Private family circle feed for the linked mother
            if not mother_id:
                return MomentFeedResponse(posts=[], total_count=0, page=page, page_size=page_size, has_more=False)
            stmt = stmt.where(
                MomentsPost.mother_id == mother_id,
                MomentsPost.audience.in_(("family", "both")),
            )
        elif tab == "my_moments":
            # Posts authored by this user
            stmt = stmt.where(MomentsPost.author_user_id == user.id)
        elif tab == "support_circle":
            # Filter specifically for Support Circle discussions
            stmt = stmt.where(
                MomentsPost.experience_type == "support_circle",
                MomentsPost.audience.in_(("community", "both")),
            )
        else:
            stmt = stmt.where(MomentsPost.audience.in_(("community", "both")))

        if experience_type and experience_type != "all":
            stmt = stmt.where(MomentsPost.experience_type == experience_type)
        if category and category != "All":
            stmt = stmt.where(MomentsPost.category == category)

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = db.scalar(count_stmt) or 0

        # Sort newest first
        stmt = stmt.order_by(desc(MomentsPost.created_at))
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        posts = db.scalars(stmt).all()

        formatted_posts = [cls._format_post_response(p, current_user_id=user.id) for p in posts]
        has_more = (page * page_size) < total_count

        return MomentFeedResponse(
            posts=formatted_posts,
            total_count=total_count,
            page=page,
            page_size=page_size,
            has_more=has_more,
        )

    @classmethod
    def get_post_detail(cls, db: Session, user: User, post_id: Any) -> MomentPostResponse:
        """Fetch a single post detail with strict authorization."""
        post_id = to_uuid(post_id)
        post = db.scalar(select(MomentsPost).where(MomentsPost.id == post_id))
        if not post or post.status == "removed":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found.")

        # Check permission:
        cls._verify_post_view_permission(db, user, post)

        return cls._format_post_response(post, current_user_id=user.id, include_comments=True)

    @classmethod
    def update_post(
        cls,
        db: Session,
        user: User,
        post_id: Any,
        payload: MomentPostUpdate,
    ) -> MomentPostResponse:
        """Update an existing moment (author only)."""
        post_id = to_uuid(post_id)
        post = db.scalar(select(MomentsPost).where(MomentsPost.id == post_id))
        if not post or post.status == "removed":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found.")

        if post.author_user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit your own moments.",
            )

        if payload.caption is not None:
            post.caption = sanitize_moment_text(payload.caption)
        if payload.category is not None:
            post.category = payload.category
        if payload.milestone_title is not None:
            post.milestone_title = payload.milestone_title
        if payload.mood is not None:
            post.mood = payload.mood
        if payload.audience is not None and user.role != "family":
            post.audience = payload.audience

        db.commit()
        db.refresh(post)
        return cls._format_post_response(post, current_user_id=user.id)

    @classmethod
    def delete_post(cls, db: Session, user: User, post_id: Any) -> dict:
        """Delete an existing moment (author or mother only)."""
        post_id = to_uuid(post_id)
        post = db.scalar(select(MomentsPost).where(MomentsPost.id == post_id))
        if not post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found.")

        if post.author_user_id != user.id and post.mother_id != user.mother_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete this moment.",
            )

        db.delete(post)
        db.commit()
        return {"success": True, "message": "Moment deleted successfully."}

    # -------------------------------------------------------------------------
    # Comments & Reactions
    # -------------------------------------------------------------------------
    @classmethod
    def add_comment(
        cls,
        db: Session,
        user: User,
        post_id: Any,
        payload: MomentCommentCreate,
    ) -> MomentCommentResponse:
        """Add supportive comment to a moment."""
        post_id = to_uuid(post_id)
        post = db.scalar(select(MomentsPost).where(MomentsPost.id == post_id))
        if not post or post.status != "approved":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found.")

        cls._verify_post_view_permission(db, user, post)

        # Family member commenting check
        relationship_label = None
        if user.role == "family":
            f_member = db.scalar(
                select(FamilyCircleMember).where(
                    FamilyCircleMember.user_id == user.id,
                    FamilyCircleMember.mother_id == post.mother_id,
                    FamilyCircleMember.is_active.is_(True),
                )
            )
            if f_member and not f_member.can_comment:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Commenting is currently paused by the mother for this family account.",
                )
            relationship_label = f_member.relationship if f_member else "Family Member"

        clean_content = sanitize_moment_text(payload.content)
        if not clean_content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Comment cannot be empty.")

        is_anon = payload.is_anonymous and post.experience_type == "support_circle"
        display_author = "Anonymous Mother" if is_anon else (user.full_name or "Member")

        comment = MomentsComment(
            post_id=post.id,
            author_user_id=user.id,
            content=clean_content,
            display_author=display_author,
            author_role="family" if user.role == "family" else "mother",
            relationship_label=relationship_label,
            is_anonymous=is_anon,
            status="approved",
        )
        db.add(comment)
        post.comments_count = (post.comments_count or 0) + 1
        db.commit()
        db.refresh(comment)

        return MomentCommentResponse(
            id=str(comment.id),
            post_id=str(comment.post_id),
            content=comment.content,
            display_author=comment.display_author,
            author_role=comment.author_role,
            relationship_label=comment.relationship_label,
            is_anonymous=comment.is_anonymous,
            is_own_comment=True,
            created_at=comment.created_at.strftime("%d %b %Y, %H:%M"),
        )

    @classmethod
    def get_comments(cls, db: Session, user: User, post_id: Any) -> List[MomentCommentResponse]:
        """Fetch comments for a post."""
        post_id = to_uuid(post_id)
        post = db.scalar(select(MomentsPost).where(MomentsPost.id == post_id))
        if not post or post.status != "approved":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found.")

        cls._verify_post_view_permission(db, user, post)

        stmt = (
            select(MomentsComment)
            .where(MomentsComment.post_id == post_id, MomentsComment.status == "approved")
            .order_by(MomentsComment.created_at.asc())
        )
        comments = db.scalars(stmt).all()

        return [
            MomentCommentResponse(
                id=str(c.id),
                post_id=str(c.post_id),
                content=c.content,
                display_author=c.display_author,
                author_role=c.author_role,
                relationship_label=c.relationship_label,
                is_anonymous=c.is_anonymous,
                is_own_comment=(c.author_user_id == user.id),
                created_at=c.created_at.strftime("%d %b %Y, %H:%M"),
            )
            for c in comments
        ]

    @classmethod
    def toggle_reaction(
        cls,
        db: Session,
        user: User,
        post_id: Any,
        reaction_type: str = "heart",
    ) -> MomentReactionResponse:
        """Add or remove reaction on a moment."""
        post_id = to_uuid(post_id)
        post = db.scalar(select(MomentsPost).where(MomentsPost.id == post_id))
        if not post or post.status != "approved":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found.")

        cls._verify_post_view_permission(db, user, post)

        existing = db.scalar(
            select(MomentsReaction).where(
                MomentsReaction.post_id == post_id,
                MomentsReaction.user_id == user.id,
            )
        )

        final_reaction = None
        if existing:
            if existing.reaction_type == reaction_type:
                # Toggle off
                db.delete(existing)
                post.likes_count = max(0, (post.likes_count or 1) - 1)
            else:
                # Switch reaction type
                existing.reaction_type = reaction_type
                final_reaction = reaction_type
        else:
            new_r = MomentsReaction(
                post_id=post_id,
                user_id=user.id,
                reaction_type=reaction_type,
            )
            db.add(new_r)
            post.likes_count = (post.likes_count or 0) + 1
            final_reaction = reaction_type

        db.commit()
        return MomentReactionResponse(
            post_id=str(post_id),
            reaction_type=final_reaction,
            likes_count=post.likes_count,
        )

    @classmethod
    def toggle_save_moment(cls, db: Session, user: User, post_id: Any) -> dict:
        """Save/bookmark a moment for later."""
        post_id = to_uuid(post_id)
        post = db.scalar(select(MomentsPost).where(MomentsPost.id == post_id))
        if not post or post.status != "approved":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found.")

        cls._verify_post_view_permission(db, user, post)

        saved = db.scalar(
            select(SavedMoment).where(
                SavedMoment.post_id == post_id,
                SavedMoment.user_id == user.id,
            )
        )
        if saved:
            db.delete(saved)
            db.commit()
            return {"is_saved": False, "message": "Moment removed from saved items."}
        else:
            new_save = SavedMoment(post_id=post_id, user_id=user.id)
            db.add(new_save)
            db.commit()
            return {"is_saved": True, "message": "Moment saved to your private collection."}

    # -------------------------------------------------------------------------
    # Letters to My Baby (Memory Journal)
    # -------------------------------------------------------------------------
    @classmethod
    def create_letter(cls, db: Session, user: User, payload: BabyLetterCreate) -> BabyLetterResponse:
        """Create a letter to baby. Strictly private to mother by default."""
        mother = cls.resolve_user_mother(db, user)
        if not mother:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No linked mother profile found.")

        letter = BabyLetter(
            mother_id=mother.id,
            author_user_id=user.id,
            title=sanitize_moment_text(payload.title),
            letter_date=payload.letter_date,
            content=sanitize_moment_text(payload.content),
            photo_url=payload.photo_url,
            is_draft=payload.is_draft,
            shared_with_family=payload.shared_with_family,  # default False
            status="active",
        )
        db.add(letter)
        db.commit()
        db.refresh(letter)
        return cls._format_letter_response(letter)

    @classmethod
    def get_letters(cls, db: Session, user: User) -> List[BabyLetterResponse]:
        """Fetch letters chronologically. Enforces strict default privacy."""
        mother = cls.resolve_user_mother(db, user)
        if not mother:
            return []

        stmt = select(BabyLetter).where(BabyLetter.mother_id == mother.id, BabyLetter.status == "active")

        if user.role == "family":
            # Family members ONLY see letters explicitly shared by the mother, and no drafts!
            stmt = stmt.where(BabyLetter.shared_with_family.is_(True), BabyLetter.is_draft.is_(False))

        stmt = stmt.order_by(desc(BabyLetter.created_at))
        letters = db.scalars(stmt).all()
        return [cls._format_letter_response(l) for l in letters]

    @classmethod
    def update_letter(
        cls,
        db: Session,
        user: User,
        letter_id: Any,
        payload: BabyLetterUpdate,
    ) -> BabyLetterResponse:
        """Update a letter (author mother only)."""
        letter_id = to_uuid(letter_id)
        letter = db.scalar(select(BabyLetter).where(BabyLetter.id == letter_id))
        if not letter:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Letter not found.")

        if letter.author_user_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

        if payload.title is not None:
            letter.title = sanitize_moment_text(payload.title)
        if payload.content is not None:
            letter.content = sanitize_moment_text(payload.content)
        if payload.letter_date is not None:
            letter.letter_date = payload.letter_date
        if payload.photo_url is not None:
            letter.photo_url = payload.photo_url
        if payload.is_draft is not None:
            letter.is_draft = payload.is_draft
        if payload.shared_with_family is not None:
            letter.shared_with_family = payload.shared_with_family

        db.commit()
        db.refresh(letter)
        return cls._format_letter_response(letter)

    @classmethod
    def delete_letter(cls, db: Session, user: User, letter_id: Any) -> dict:
        """Delete a letter (author mother only)."""
        letter_id = to_uuid(letter_id)
        letter = db.scalar(select(BabyLetter).where(BabyLetter.id == letter_id))
        if not letter or letter.author_user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Letter not found.")

        db.delete(letter)
        db.commit()
        return {"success": True, "message": "Letter deleted successfully."}

    # -------------------------------------------------------------------------
    # Family Circle Invitations & Membership
    # -------------------------------------------------------------------------
    @classmethod
    def create_invitation(
        cls,
        db: Session,
        user: User,
        payload: FamilyInvitationCreate,
    ) -> FamilyInvitationResponse:
        """Generate a secure, single-use, expiring invitation code for a family member."""
        if user.role != "patient":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only mothers can invite family members to their Family Circle.",
            )

        mother = cls.resolve_user_mother(db, user)
        if not mother:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No mother profile found.")

        raw_code = generate_secure_invitation_code()
        code_hash = hash_invitation_code(raw_code)
        preview = f"{raw_code[:10]}****"

        expires = utc_now() + timedelta(days=7)

        invitation = FamilyInvitation(
            mother_id=mother.id,
            inviter_user_id=user.id,
            invitation_code_hash=code_hash,
            invitation_code_preview=preview,
            invitee_name=payload.invitee_name,
            relationship=payload.relationship,
            can_upload=payload.can_upload,
            can_comment=payload.can_comment,
            status="active",
            expires_at=expires,
        )
        db.add(invitation)
        db.commit()
        db.refresh(invitation)

        return FamilyInvitationResponse(
            id=str(invitation.id),
            invitation_code=raw_code,
            invitation_code_preview=invitation.invitation_code_preview,
            invitee_name=invitation.invitee_name,
            relationship=invitation.relationship or "Family Member",
            can_upload=invitation.can_upload,
            can_comment=invitation.can_comment,
            status=invitation.status,
            expires_at=invitation.expires_at.strftime("%d %b %Y, %H:%M UTC") if invitation.expires_at else "",
            created_at=invitation.created_at.strftime("%d %b %Y") if invitation.created_at else "",
        )

    @classmethod
    def get_family_circle(cls, db: Session, user: User) -> FamilyCircleDetailResponse:
        """Retrieve family members and pending invitations for a mother's circle."""
        mother = cls.resolve_user_mother(db, user)
        if not mother:
            return FamilyCircleDetailResponse(mother_name="Mother", members=[], active_invitations=[])

        # Active members
        stmt_m = select(FamilyCircleMember).where(
            FamilyCircleMember.mother_id == mother.id,
            FamilyCircleMember.is_active.is_(True),
        )
        members = db.scalars(stmt_m).all()
        member_list = []
        for m in members:
            u = db.scalar(select(User).where(User.id == m.user_id))
            member_list.append(
                FamilyCircleMemberResponse(
                    id=str(m.id),
                    user_id=str(m.user_id),
                    name=u.full_name if u else "Family Member",
                    email=u.email if u else "",
                    relationship=m.relationship,
                    can_upload=m.can_upload,
                    can_comment=m.can_comment,
                    is_active=m.is_active,
                    joined_at=m.created_at.strftime("%d %b %Y"),
                )
            )

        # Active invitations
        stmt_inv = (
            select(FamilyInvitation)
            .where(
                FamilyInvitation.mother_id == mother.id,
                FamilyInvitation.status == "active",
                FamilyInvitation.expires_at > utc_now(),
            )
            .order_by(desc(FamilyInvitation.created_at))
        )
        invitations = db.scalars(stmt_inv).all()
        inv_list = [
            FamilyInvitationResponse(
                id=str(inv.id),
                invitation_code=None,
                invitation_code_preview=inv.invitation_code_preview,
                invitee_name=inv.invitee_name,
                relationship=inv.relationship or "Family Member",
                can_upload=inv.can_upload,
                can_comment=inv.can_comment,
                status=inv.status,
                expires_at=inv.expires_at.strftime("%d %b %Y, %H:%M UTC"),
                created_at=inv.created_at.strftime("%d %b %Y"),
            )
            for inv in invitations
        ]

        return FamilyCircleDetailResponse(
            mother_name=mother.name,
            members=member_list,
            active_invitations=inv_list,
        )

    @classmethod
    def join_family_circle(cls, db: Session, user: User, code: str) -> dict:
        """Validate single-use invitation code and link family member account."""
        if not code or len(code.strip()) < 6:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invitation code format.")

        clean_code = code.strip().upper()
        code_hash = hash_invitation_code(clean_code)

        invitation = db.scalar(
            select(FamilyInvitation).where(
                FamilyInvitation.invitation_code_hash == code_hash,
            )
        )
        if not invitation:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invitation code.")

        if invitation.status == "used":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invitation code has already been used.",
            )
        if invitation.status == "revoked":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invitation was cancelled by the mother.",
            )
        exp_time = ensure_utc(invitation.expires_at)
        if exp_time and exp_time < utc_now():
            invitation.status = "expired"
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invitation code has expired. Please ask the mother for a new invitation.",
            )

        mother = db.scalar(select(Mother).where(Mother.id == invitation.mother_id))
        if not mother:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother profile not found.")

        # Link family account
        user.mother_id = mother.id
        if user.role != "family":
            user.role = "family"

        # Check existing membership or create
        existing_m = db.scalar(
            select(FamilyCircleMember).where(
                FamilyCircleMember.mother_id == mother.id,
                FamilyCircleMember.user_id == user.id,
            )
        )
        if existing_m:
            existing_m.is_active = True
            existing_m.relationship = invitation.relationship or existing_m.relationship
            existing_m.can_upload = invitation.can_upload
            existing_m.can_comment = invitation.can_comment
        else:
            new_member = FamilyCircleMember(
                mother_id=mother.id,
                user_id=user.id,
                relationship=invitation.relationship or "Family Member",
                can_upload=invitation.can_upload,
                can_comment=invitation.can_comment,
                is_active=True,
            )
            db.add(new_member)

        # Mark invitation used
        invitation.status = "used"
        invitation.used_at = utc_now()
        invitation.used_by_user_id = user.id

        db.commit()
        member_id = existing_m.id if existing_m else new_member.id
        return {
            "success": True,
            "message": f"Successfully joined {mother.name}'s Family Circle!",
            "mother_name": mother.name,
            "mother_id": str(mother.id),
            "member_id": str(member_id),
            "relationship": invitation.relationship or "Family Member",
            "can_upload": invitation.can_upload,
            "can_comment": invitation.can_comment,
        }

    @classmethod
    def revoke_invitation(cls, db: Session, user: User, invitation_id: Any) -> dict:
        """Mother revokes an unused invitation."""
        invitation_id = to_uuid(invitation_id)
        invitation = db.scalar(select(FamilyInvitation).where(FamilyInvitation.id == invitation_id))
        if not invitation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")

        if invitation.inviter_user_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

        invitation.status = "revoked"
        db.commit()
        return {"success": True, "message": "Invitation code revoked."}

    @classmethod
    def remove_family_member(cls, db: Session, user: User, member_id: Any) -> dict:
        """Mother removes a family member from her circle (immediate revocation)."""
        member_id = to_uuid(member_id)
        member = db.scalar(select(FamilyCircleMember).where(FamilyCircleMember.id == member_id))
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found.")

        mother = cls.resolve_user_mother(db, user)
        if not mother or member.mother_id != mother.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

        # Immediate revocation
        member.is_active = False

        # Disconnect user's mother_id
        target_u = db.scalar(select(User).where(User.id == member.user_id))
        if target_u and target_u.mother_id == mother.id:
            target_u.mother_id = None

        db.commit()
        return {"success": True, "message": "Family member removed from Family Circle."}

    @classmethod
    def update_member_permissions(
        cls,
        db: Session,
        user: User,
        member_id: Any,
        payload: FamilyMemberPermissionsUpdate,
    ) -> FamilyCircleMemberResponse:
        """Mother updates upload or comment permissions for a family member."""
        member_id = to_uuid(member_id)
        member = db.scalar(select(FamilyCircleMember).where(FamilyCircleMember.id == member_id))
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found.")

        mother = cls.resolve_user_mother(db, user)
        if not mother or member.mother_id != mother.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

        if payload.can_upload is not None:
            member.can_upload = payload.can_upload
        if payload.can_comment is not None:
            member.can_comment = payload.can_comment

        db.commit()
        db.refresh(member)

        u = db.scalar(select(User).where(User.id == member.user_id))
        return FamilyCircleMemberResponse(
            id=str(member.id),
            user_id=str(member.user_id),
            name=u.full_name if u else "Family Member",
            email=u.email if u else "",
            relationship=member.relationship,
            can_upload=member.can_upload,
            can_comment=member.can_comment,
            is_active=member.is_active,
            joined_at=member.created_at.strftime("%d %b %Y"),
        )

    # -------------------------------------------------------------------------
    # Safety & Moderation
    # -------------------------------------------------------------------------
    @classmethod
    def report_content(cls, db: Session, user: User, payload: MomentReportCreate) -> MomentReportResponse:
        """Submit a safety/moderation report on a moment or comment."""
        p_id = uuid.UUID(payload.post_id) if payload.post_id else None
        c_id = uuid.UUID(payload.comment_id) if payload.comment_id else None

        report = MomentReport(
            reporter_user_id=user.id,
            post_id=p_id,
            comment_id=c_id,
            reason=payload.reason,
            details=sanitize_moment_text(payload.details or ""),
            status="pending",
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        return MomentReportResponse(
            id=str(report.id),
            message="Thank you for your report. Our clinical support and moderation team will review this shortly.",
            status=report.status,
        )

    @classmethod
    def block_user(cls, db: Session, user: User, target_user_id: Any) -> dict:
        """Block another user from interacting or appearing in feed."""
        target_user_id = to_uuid(target_user_id)
        if user.id == target_user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot block yourself.")

        existing = db.scalar(
            select(UserBlock).where(
                UserBlock.blocker_user_id == user.id,
                UserBlock.blocked_user_id == target_user_id,
            )
        )
        if not existing:
            block = UserBlock(blocker_user_id=user.id, blocked_user_id=target_user_id)
            db.add(block)
            db.commit()
        return {"success": True, "message": "User has been blocked."}

    @classmethod
    def unblock_user(cls, db: Session, user: User, target_user_id: Any) -> dict:
        """Unblock a previously blocked user."""
        target_user_id = to_uuid(target_user_id)
        existing = db.scalar(
            select(UserBlock).where(
                UserBlock.blocker_user_id == user.id,
                UserBlock.blocked_user_id == target_user_id,
            )
        )
        if existing:
            db.delete(existing)
            db.commit()
        return {"success": True, "message": "User has been unblocked."}

    # -------------------------------------------------------------------------
    # Formatting & Authorization Helpers
    # -------------------------------------------------------------------------
    @staticmethod
    def _verify_post_view_permission(db: Session, user: User, post: MomentsPost) -> None:
        """Ensure authenticated user has authorization to view this post."""
        if user.role == "family":
            if post.audience == "community":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Family accounts cannot access community posts.",
                )
            if post.mother_id != user.mother_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: This moment belongs to a different family circle.",
                )
        elif user.role == "patient":
            if post.audience == "family":
                # Family post can only be seen if user is the mother herself
                if post.author_user_id != user.id and post.mother_id != user.mother_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: This is a private family moment.",
                    )

    @classmethod
    def _format_post_response(
        cls,
        post: MomentsPost,
        current_user_id: uuid.UUID,
        include_comments: bool = False,
    ) -> MomentPostResponse:
        """Serialize a MomentsPost into response schema with user-specific flags."""
        user_rx = None
        if post.reactions:
            for rx in post.reactions:
                if rx.user_id == current_user_id:
                    user_rx = rx.reaction_type
                    break

        is_saved = False
        if post.saved_by:
            for sv in post.saved_by:
                if sv.user_id == current_user_id:
                    is_saved = True
                    break

        comments_out = []
        if post.comments:
            slice_comments = post.comments if include_comments else post.comments[-3:]
            for c in slice_comments:
                comments_out.append(
                    MomentCommentResponse(
                        id=str(c.id),
                        post_id=str(c.post_id),
                        content=c.content,
                        display_author=c.display_author,
                        author_role=c.author_role,
                        relationship_label=c.relationship_label,
                        is_anonymous=c.is_anonymous,
                        is_own_comment=(c.author_user_id == current_user_id),
                        created_at=c.created_at.strftime("%d %b %Y, %H:%M"),
                    )
                )

        return MomentPostResponse(
            id=str(post.id),
            caption=post.caption,
            experience_type=post.experience_type,
            category=post.category,
            audience=post.audience,
            is_anonymous=post.is_anonymous,
            display_author=post.display_author,
            author_avatar=post.author_avatar,
            media_url=post.media_url,
            media_type=post.media_type,
            milestone_title=post.milestone_title,
            mood=post.mood,
            status=post.status,
            likes_count=post.likes_count or 0,
            comments_count=post.comments_count or 0,
            user_reacted=user_rx,
            is_saved=is_saved,
            is_own_post=(post.author_user_id == current_user_id),
            created_at=post.created_at.strftime("%d %b %Y, %H:%M"),
            recent_comments=comments_out,
        )

    @staticmethod
    def _format_letter_response(letter: BabyLetter) -> BabyLetterResponse:
        return BabyLetterResponse(
            id=str(letter.id),
            title=letter.title,
            letter_date=letter.letter_date,
            content=letter.content,
            photo_url=letter.photo_url,
            is_draft=letter.is_draft,
            shared_with_family=letter.shared_with_family,
            created_at=letter.created_at.strftime("%d %b %Y"),
            updated_at=letter.updated_at.strftime("%d %b %Y"),
        )

    # -------------------------------------------------------------------------
    # Seeder
    # -------------------------------------------------------------------------
    @classmethod
    def seed_demo_moments(cls, db: Session) -> None:
        """Seed initial warm demo moments if table is empty."""
        count = db.scalar(select(func.count(MomentsPost.id))) or 0
        if count > 0:
            return

        patient_u = db.scalar(select(User).where(User.role == "patient"))
        if not patient_u:
            return
        mother = cls.resolve_user_mother(db, patient_u)
        mother_id = mother.id if mother else None

        demo_moments = [
            {
                "caption": "Our little one smiled for the first time while the morning sun hit the living room. Exhaustion melted away in a single second.",
                "experience_type": "day_in_life",
                "category": "A Day in My Life",
                "audience": "both",
                "milestone_title": "First morning smile",
                "mood": "Joyful",
                "display_author": "Amara K.",
                "likes_count": 6,
            },
            {
                "caption": "To any mother feeling like they are doing everything wrong today: you are enough. Baby is fed, held, and safe. Take three deep breaths.",
                "experience_type": "support_circle",
                "category": "Support Circle",
                "audience": "community",
                "is_anonymous": True,
                "display_author": "Anonymous Mother",
                "likes_count": 14,
            },
            {
                "caption": "Quiet evening update for family: Baby slept 4 continuous hours after bath time! Big thanks to Raj for managing the 7 PM calming routine.",
                "experience_type": "day_in_life",
                "category": "Family Update",
                "audience": "family",
                "milestone_title": "4 hours continuous sleep",
                "mood": "Grateful",
                "display_author": "Amara K.",
                "likes_count": 4,
            },
            {
                "caption": "First stroll around the garden in weeks. Felt the fresh air and took it slow. Celebrating small steps back to myself.",
                "experience_type": "milestone",
                "category": "Small Wins",
                "audience": "community",
                "display_author": "A Mother in Her Journey",
                "mood": "Peaceful",
                "likes_count": 9,
            },
        ]

        for d in demo_moments:
            p = MomentsPost(
                author_user_id=patient_u.id,
                mother_id=mother_id,
                caption=d["caption"],
                experience_type=d["experience_type"],
                category=d["category"],
                audience=d["audience"],
                is_anonymous=d.get("is_anonymous", False),
                display_author=d["display_author"],
                author_avatar="AM" if not d.get("is_anonymous") else None,
                milestone_title=d.get("milestone_title"),
                mood=d.get("mood"),
                status="approved",
                likes_count=d["likes_count"],
                comments_count=1,
            )
            db.add(p)
            db.flush()

            # Seed a supportive comment
            c = MomentsComment(
                post_id=p.id,
                author_user_id=patient_u.id,
                content="Sending you warmth and calm thoughts! You are doing amazing.",
                display_author="A Mother in Her Journey",
                author_role="mother",
                status="approved",
            )
            db.add(c)

        # Seed sample baby letter
        if mother_id:
            letter = BabyLetter(
                mother_id=mother_id,
                author_user_id=patient_u.id,
                title="When you first wrapped your fingers around mine",
                letter_date="20 Nov 2026",
                content=(
                    "Dear little one, today you curled your tiny fingers around my thumb and wouldn't let go. "
                    "I want you to always remember how loved and cherished you are, even through the quiet, sleepy nights."
                ),
                is_draft=False,
                shared_with_family=False,
                status="active",
            )
            db.add(letter)

        db.commit()
        logger.info("Seeded initial AANCHAL Moments and Baby Letters.")
