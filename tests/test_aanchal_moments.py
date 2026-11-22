"""Unit and integration tests for AANCHAL Moments (Private Motherhood Community & Family Circle).

Validates:
1. Mother post creation with explicit audience ('community', 'family', 'both').
2. Cross-role isolation: family role cannot read Mother Community feed (HTTP 403 Forbidden).
3. Cross-family isolation: Family member of Mother A cannot see moments of Mother B.
4. Single-use hashed invitation code lifecycle:
   - Creation returns raw code once, stores SHA-256 hash
   - Joining verifies hash, links account, and marks invitation as used
   - Re-using code is rejected
   - Mother revocation invalidates code immediately
5. Immediate revocation: removing a family member revokes access immediately.
6. Private Letters to My Baby isolation: private by default; family sees only explicitly shared letters.
7. Anonymous identity masking in community responses.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import uuid
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from backend.database.base import Base, utc_now
from backend.models.mother import Mother
from backend.models.user import User
from backend.models.moments import (
    BabyLetter,
    FamilyCircleMember,
    FamilyInvitation,
    MomentsComment,
    MomentsPost,
    MomentsReaction,
)
from backend.schemas.moments import (
    BabyLetterCreate,
    FamilyInvitationCreate,
    FamilyMemberPermissionsUpdate,
    MomentCommentCreate,
    MomentPostCreate,
)
from backend.services.moments_service import (
    MomentsService,
    hash_invitation_code,
    to_uuid,
)


@pytest.fixture
def db_session():
    """Create in-memory SQLite database session for moments testing."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def sample_mothers_and_users(db_session: Session):
    """Fixture providing 2 distinct mothers and their accounts."""
    # Mother A
    mother_a = Mother(
        id=uuid.uuid4(),
        name="Priya Sharma",
        email="priya@example.com",
    )
    user_mother_a = User(
        id=uuid.uuid4(),
        email="priya@example.com",
        full_name="Priya Sharma",
        hashed_password="pw",
        role="patient",
        mother_id=mother_a.id,
    )

    # Mother B
    mother_b = Mother(
        id=uuid.uuid4(),
        name="Ananya Verma",
        email="ananya@example.com",
    )
    user_mother_b = User(
        id=uuid.uuid4(),
        email="ananya@example.com",
        full_name="Ananya Verma",
        hashed_password="pw",
        role="patient",
        mother_id=mother_b.id,
    )

    # Family member user
    user_family_a = User(
        id=uuid.uuid4(),
        email="rahul.sharma@example.com",
        full_name="Rahul Sharma",
        hashed_password="pw",
        role="family",
        mother_id=None,  # Unlinked initially
    )

    db_session.add_all([mother_a, user_mother_a, mother_b, user_mother_b, user_family_a])
    db_session.commit()

    return {
        "mother_a": mother_a,
        "user_mother_a": user_mother_a,
        "mother_b": mother_b,
        "user_mother_b": user_mother_b,
        "user_family_a": user_family_a,
    }


# -----------------------------------------------------------------------------
# 1. Post Creation & Audience Handling
# -----------------------------------------------------------------------------
def test_mother_post_creation_audience(db_session: Session, sample_mothers_and_users):
    user_a = sample_mothers_and_users["user_mother_a"]

    # 1. Community post
    post_comm = MomentsService.create_post(
        db=db_session,
        user=user_a,
        payload=MomentPostCreate(
            audience="community",
            experience_type="day_in_life",
            caption="First morning walk with baby in the garden.",
            is_anonymous=False,
        ),
    )
    assert post_comm.audience == "community"
    assert post_comm.display_author == "Priya Sharma"

    # 2. Family-only post
    post_fam = MomentsService.create_post(
        db=db_session,
        user=user_a,
        payload=MomentPostCreate(
            audience="family",
            experience_type="milestone",
            milestone_title="First Smile",
            caption="Baby smiled today at 7 AM!",
        ),
    )
    assert post_fam.audience == "family"
    assert post_fam.milestone_title == "First Smile"

    # 3. Both post
    post_both = MomentsService.create_post(
        db=db_session,
        user=user_a,
        payload=MomentPostCreate(
            audience="both",
            experience_type="general",
            caption="Shared with both community and family.",
        ),
    )
    assert post_both.audience == "both"


# -----------------------------------------------------------------------------
# 2. Cross-Role Isolation: Family Cannot Access Community Feed
# -----------------------------------------------------------------------------
def test_family_blocked_from_community_feed(db_session: Session, sample_mothers_and_users):
    user_family = sample_mothers_and_users["user_family_a"]

    # Attempting to fetch community tab as family role must raise 403 Forbidden
    with pytest.raises(HTTPException) as excinfo:
        MomentsService.get_feed(db=db_session, user=user_family, tab="community")
    assert excinfo.value.status_code == 403
    assert "Family members are restricted" in excinfo.value.detail


# -----------------------------------------------------------------------------
# 3. Single-Use Hashed Invitation Code & Family Linking
# -----------------------------------------------------------------------------
def test_family_invitation_lifecycle(db_session: Session, sample_mothers_and_users):
    user_mother_a = sample_mothers_and_users["user_mother_a"]
    user_family_a = sample_mothers_and_users["user_family_a"]

    # Mother generates invitation
    invite = MomentsService.create_invitation(
        db=db_session,
        user=user_mother_a,
        payload=FamilyInvitationCreate(
            invitee_name="Rahul Sharma",
            relationship="Partner / Co-Parent",
            can_upload=True,
            can_comment=True,
        ),
    )
    raw_code = invite.invitation_code
    assert raw_code.startswith("MOMENT-")
    db_inv = db_session.scalar(select(FamilyInvitation).where(FamilyInvitation.id == to_uuid(invite.id)))
    assert db_inv.invitation_code_hash == hash_invitation_code(raw_code)

    # Family member joins with code
    join_res = MomentsService.join_family_circle(db=db_session, user=user_family_a, code=raw_code)
    assert join_res["success"] is True
    assert user_family_a.mother_id == user_mother_a.mother_id

    # Re-using the same code must fail
    with pytest.raises(HTTPException) as exc_used:
        MomentsService.join_family_circle(db=db_session, user=user_family_a, code=raw_code)
    assert exc_used.value.status_code == 400
    assert "already been used" in str(exc_used.value.detail).lower()


def test_invitation_revocation_by_mother(db_session: Session, sample_mothers_and_users):
    user_mother_a = sample_mothers_and_users["user_mother_a"]
    user_family_a = sample_mothers_and_users["user_family_a"]

    invite = MomentsService.create_invitation(
        db=db_session,
        user=user_mother_a,
        payload=FamilyInvitationCreate(relationship="Grandmother"),
    )
    raw_code = invite.invitation_code

    # Mother revokes invitation
    MomentsService.revoke_invitation(db=db_session, user=user_mother_a, invitation_id=invite.id)

    # Attempting to join revoked invitation must fail
    with pytest.raises(HTTPException) as exc_revoked:
        MomentsService.join_family_circle(db=db_session, user=user_family_a, code=raw_code)
    assert exc_revoked.value.status_code == 400
    assert "cancelled" in exc_revoked.value.detail.lower() or "revoked" in exc_revoked.value.detail.lower()


# -----------------------------------------------------------------------------
# 4. Cross-Family Isolation & Immediate Revocation
# -----------------------------------------------------------------------------
def test_cross_family_isolation_and_immediate_revocation(db_session: Session, sample_mothers_and_users):
    user_mother_a = sample_mothers_and_users["user_mother_a"]
    user_mother_b = sample_mothers_and_users["user_mother_b"]
    user_family_a = sample_mothers_and_users["user_family_a"]

    # Link Family A to Mother A
    invite = MomentsService.create_invitation(
        db=db_session,
        user=user_mother_a,
        payload=FamilyInvitationCreate(relationship="Partner"),
    )
    join_res = MomentsService.join_family_circle(db=db_session, user=user_family_a, code=invite.invitation_code)
    member_id = join_res["member_id"]

    # Mother A posts a family moment
    MomentsService.create_post(
        db=db_session,
        user=user_mother_a,
        payload=MomentPostCreate(
            audience="family",
            caption="Family moment only for Mother A's circle.",
        ),
    )

    # Mother B posts a family moment
    MomentsService.create_post(
        db=db_session,
        user=user_mother_b,
        payload=MomentPostCreate(
            audience="family",
            caption="Family moment only for Mother B's circle.",
        ),
    )

    # Family A queries their family feed
    feed = MomentsService.get_feed(db=db_session, user=user_family_a, tab="family")
    assert len(feed.items) == 1
    assert feed.items[0].caption == "Family moment only for Mother A's circle."

    # Immediate Revocation: Mother A removes Family A
    MomentsService.remove_family_member(db=db_session, user=user_mother_a, member_id=member_id)
    db_session.refresh(user_family_a)

    # Family A now cannot access family feed (unlinked)
    with pytest.raises(HTTPException) as exc_unlinked:
        MomentsService.get_feed(db=db_session, user=user_family_a, tab="family")
    assert exc_unlinked.value.status_code == 403


# -----------------------------------------------------------------------------
# 5. Letters to My Baby Privacy Isolation
# -----------------------------------------------------------------------------
def test_baby_letters_privacy(db_session: Session, sample_mothers_and_users):
    user_mother_a = sample_mothers_and_users["user_mother_a"]
    user_family_a = sample_mothers_and_users["user_family_a"]

    # Link Family A
    inv = MomentsService.create_invitation(db=db_session, user=user_mother_a, payload=FamilyInvitationCreate())
    MomentsService.join_family_circle(db=db_session, user=user_family_a, code=inv.invitation_code)

    # 1. Private letter (default shared_with_family=False)
    letter_priv = MomentsService.create_letter(
        db=db_session,
        user=user_mother_a,
        payload=BabyLetterCreate(
            title="My Secret Thoughts for Baby",
            letter_date="2026-11-22",
            content="This is private to mother only.",
            shared_with_family=False,
        ),
    )

    # 2. Shared letter
    letter_shared = MomentsService.create_letter(
        db=db_session,
        user=user_mother_a,
        payload=BabyLetterCreate(
            title="Welcoming Baby Together",
            letter_date="2026-11-22",
            content="A note for both parents.",
            shared_with_family=True,
        ),
    )

    # Mother sees all her letters
    mother_letters = MomentsService.get_letters(db=db_session, user=user_mother_a)
    assert len(mother_letters) == 2

    # Family member sees ONLY the shared letter
    family_letters = MomentsService.get_letters(db=db_session, user=user_family_a)
    assert len(family_letters) == 1
    assert family_letters[0].title == "Welcoming Baby Together"


# -----------------------------------------------------------------------------
# 6. Anonymous Identity Masking
# -----------------------------------------------------------------------------
def test_anonymous_author_masking(db_session: Session, sample_mothers_and_users):
    user_mother_a = sample_mothers_and_users["user_mother_a"]
    user_mother_b = sample_mothers_and_users["user_mother_b"]

    # Mother A posts anonymously to Support Circle
    MomentsService.create_post(
        db=db_session,
        user=user_mother_a,
        payload=MomentPostCreate(
            audience="community",
            experience_type="support_circle",
            caption="Feeling overwhelmed today. Looking for reassurance.",
            is_anonymous=True,
        ),
    )

    # Mother B views community feed
    feed_b = MomentsService.get_feed(db=db_session, user=user_mother_b, tab="community")
    post = feed_b.items[0]
    assert post.is_anonymous is True
    assert post.display_author == "Anonymous Mother"
    assert post.author_avatar is None
