"""Direct FastAPI router integration tests for Anonymous Mother's Community.

Invokes the FastAPI router functions directly with database sessions and dependency injection,
testing:
1. POST /api/community/posts (create_community_post)
2. GET /api/community/posts (get_community_feed)
3. GET /api/community/posts/{post_id} (get_post_detail)
4. PUT /api/community/posts/{post_id} (update_community_post)
5. DELETE /api/community/posts/{post_id} (delete_community_post)
6. POST /api/community/posts/{post_id}/comments (add_post_comment)
7. GET /api/community/posts/{post_id}/comments (get_post_comments)
8. PUT /api/community/comments/{comment_id} (update_comment)
9. DELETE /api/community/comments/{comment_id} (delete_comment)
10. POST /api/community/posts/{post_id}/reactions (toggle_post_reaction)
11. POST /api/community/reports (report_content)
12. GET /api/community/moderation/queue (get_moderation_queue)
13. POST /api/community/moderation/action (take_moderation_action)
"""

import uuid
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from backend.database.base import Base
from backend.models.user import User
from backend.routers.community import (
    add_post_comment,
    create_community_post,
    delete_comment,
    delete_community_post,
    get_community_feed,
    get_moderation_queue,
    get_post_comments,
    get_post_detail,
    report_content,
    take_moderation_action,
    toggle_post_reaction,
    update_comment,
    update_community_post,
)
from backend.schemas.community import (
    CommentCreateRequest,
    CommentUpdateRequest,
    ModerationActionRequest,
    PostCreateRequest,
    PostUpdateRequest,
    ReactionToggleRequest,
    ReportCreateRequest,
)


@pytest.fixture(scope="function")
def db_session() -> Session:
    """Create an isolated, in-memory SQLite database session."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    with engine.connect() as conn:
        conn.execute(text("PRAGMA foreign_keys = ON;"))

    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)
    session: Session = TestingSession()
    try:
        yield session
    finally:
        session.close()


def _make_user(db: Session, email: str, name: str, role: str = "patient") -> User:
    """Create user fixture."""
    user = User(
        email=email,
        hashed_password="bcrypt_mock_hash",
        full_name=name,
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_router_post_crud_and_anonymity(db_session: Session):
    """Test router functions for post creation, retrieval, updating, and deletion."""
    mother_a = _make_user(db_session, "a@circle.test", "Mother Alpha")
    mother_b = _make_user(db_session, "b@circle.test", "Mother Beta")

    # 1. Create Post via Router
    create_payload = PostCreateRequest(
        content="Testing post creation via FastAPI community router.",
        category="Emotional Support",
        mood="Grateful",
        display_author="Anonymous Mother",
    )
    post_res = create_community_post(payload=create_payload, current_user=mother_a, db=db_session)
    assert post_res.display_author == "Anonymous Mother"
    assert post_res.is_own_post is True
    post_id = post_res.id

    # 2. Feed retrieval via Router
    feed_res = get_community_feed(
        category=None,
        sort="newest",
        page=1,
        page_size=10,
        current_user=mother_b,
        db=db_session,
    )
    assert feed_res.total_count == 1
    assert feed_res.posts[0].is_own_post is False

    # 3. Post Detail via Router
    detail_res = get_post_detail(post_id=post_id, current_user=mother_b, db=db_session)
    assert detail_res.id == post_id
    assert detail_res.is_own_post is False

    # 4. Unauthorized edit attempt via Router -> 403
    with pytest.raises(HTTPException) as exc_info:
        update_community_post(
            post_id=post_id,
            payload=PostUpdateRequest(content="Unauthorized edit by Beta"),
            current_user=mother_b,
            db=db_session,
        )
    assert exc_info.value.status_code == 403

    # 5. Author edit via Router -> 200
    updated_res = update_community_post(
        post_id=post_id,
        payload=PostUpdateRequest(content="Authorized updated content by Alpha"),
        current_user=mother_a,
        db=db_session,
    )
    assert "Authorized updated" in updated_res.content

    # 6. Delete via Router
    del_res = delete_community_post(post_id=post_id, current_user=mother_a, db=db_session)
    assert del_res["status"] == "success"


def test_router_comments_and_reactions(db_session: Session):
    """Test router functions for comments and reactions."""
    mother_a = _make_user(db_session, "a2@circle.test", "Mother A2")
    mother_b = _make_user(db_session, "b2@circle.test", "Mother B2")

    # Create post
    post = create_community_post(
        payload=PostCreateRequest(content="Post for commenting and reacting.", category="Questions & Advice"),
        current_user=mother_a,
        db=db_session,
    )

    # Add comment via router
    comment_res = add_post_comment(
        post_id=post.id,
        payload=CommentCreateRequest(content="Helpful response from Mother B."),
        current_user=mother_b,
        db=db_session,
    )
    assert comment_res.is_own_comment is True
    assert comment_res.display_author == "Anonymous Mother"

    # Fetch comments via router
    comments_list = get_post_comments(post_id=post.id, current_user=mother_a, db=db_session)
    assert len(comments_list) == 1
    assert comments_list[0].is_own_comment is False

    # Edit comment via router
    updated_c = update_comment(
        comment_id=comment_res.id,
        payload=CommentUpdateRequest(content="Updated helpful response."),
        current_user=mother_b,
        db=db_session,
    )
    assert updated_c.content == "Updated helpful response."

    # Toggle reaction via router
    reaction_res = toggle_post_reaction(
        post_id=post.id,
        payload=ReactionToggleRequest(reaction_type="sending_love"),
        current_user=mother_b,
        db=db_session,
    )
    assert reaction_res.likes_count == 1
    assert reaction_res.user_reaction == "sending_love"

    # Delete comment via router
    del_c_res = delete_comment(comment_id=comment_res.id, current_user=mother_b, db=db_session)
    assert del_c_res["status"] == "success"


def test_router_reporting_and_moderation(db_session: Session):
    """Test router functions for reporting and clinician moderation."""
    mother = _make_user(db_session, "poster2@circle.test", "Poster")
    reporter = _make_user(db_session, "reporter2@circle.test", "Reporter")
    doctor = _make_user(db_session, "doc@circle.test", "Dr. Staff", role="doctor")

    post = create_community_post(
        payload=PostCreateRequest(content="Spam post needing moderation.", category="Just Need to Talk"),
        current_user=mother,
        db=db_session,
    )

    # Report post via router
    rep_res = report_content(
        payload=ReportCreateRequest(post_id=post.id, reason="Spam", details="Spam details"),
        current_user=reporter,
        db=db_session,
    )
    assert rep_res.status == "received"

    # Doctor views queue via router
    queue = get_moderation_queue(current_user=doctor, db=db_session)
    assert isinstance(queue, list)

    # Non-doctor blocked from moderation queue -> 403
    with pytest.raises(HTTPException) as exc_info:
        get_moderation_queue(current_user=mother, db=db_session)
    assert exc_info.value.status_code == 403

    # Doctor takes moderation action via router
    action_res = take_moderation_action(
        payload=ModerationActionRequest(
            target_type="post",
            target_id=post.id,
            action="hide",
            reason="Confirmed spam content.",
        ),
        current_user=doctor,
        db=db_session,
    )
    assert action_res.status == "hidden"
