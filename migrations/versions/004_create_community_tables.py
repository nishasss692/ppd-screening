"""004_create_community_tables

Revision ID: 004_create_community
Revises: 003_create_users
Create Date: 2026-11-19 10:00:00.000000+00:00

Create database tables for Anonymous Mother's Community:
- community_posts
- community_comments
- community_reactions
- community_reports
- moderation_actions
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_create_community'
down_revision: Union[str, None] = '003_create_users'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. community_posts
    op.create_table(
        'community_posts',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('author_user_id', sa.Uuid(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=64), nullable=False),
        sa.Column('mood', sa.String(length=64), nullable=True),
        sa.Column('display_author', sa.String(length=64), nullable=False, server_default='Anonymous Mother'),
        sa.Column('is_anonymous', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='approved'),
        sa.Column('likes_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('comments_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['author_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_community_posts_author_user_id', 'community_posts', ['author_user_id'], unique=False)
    op.create_index('ix_community_posts_category', 'community_posts', ['category'], unique=False)
    op.create_index('ix_community_posts_status', 'community_posts', ['status'], unique=False)
    op.create_index('ix_community_posts_created_at', 'community_posts', ['created_at'], unique=False)

    # 2. community_comments
    op.create_table(
        'community_comments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('post_id', sa.Uuid(), nullable=False),
        sa.Column('author_user_id', sa.Uuid(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('display_author', sa.String(length=64), nullable=False, server_default='Anonymous Mother'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='approved'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_community_comments_post_id', 'community_comments', ['post_id'], unique=False)
    op.create_index('ix_community_comments_author_user_id', 'community_comments', ['author_user_id'], unique=False)
    op.create_index('ix_community_comments_status', 'community_comments', ['status'], unique=False)

    # 3. community_reactions
    op.create_table(
        'community_reactions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('post_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('reaction_type', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('post_id', 'user_id', name='uq_community_reaction_post_user'),
    )
    op.create_index('ix_community_reactions_post_id', 'community_reactions', ['post_id'], unique=False)
    op.create_index('ix_community_reactions_user_id', 'community_reactions', ['user_id'], unique=False)

    # 4. community_reports
    op.create_table(
        'community_reports',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('reporter_user_id', sa.Uuid(), nullable=False),
        sa.Column('post_id', sa.Uuid(), nullable=True),
        sa.Column('comment_id', sa.Uuid(), nullable=True),
        sa.Column('reason', sa.String(length=64), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['reporter_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['comment_id'], ['community_comments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_community_reports_reporter_user_id', 'community_reports', ['reporter_user_id'], unique=False)
    op.create_index('ix_community_reports_post_id', 'community_reports', ['post_id'], unique=False)
    op.create_index('ix_community_reports_comment_id', 'community_reports', ['comment_id'], unique=False)
    op.create_index('ix_community_reports_status', 'community_reports', ['status'], unique=False)

    # 5. moderation_actions
    op.create_table(
        'moderation_actions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('moderator_user_id', sa.Uuid(), nullable=True),
        sa.Column('target_type', sa.String(length=32), nullable=False),
        sa.Column('target_id', sa.Uuid(), nullable=False),
        sa.Column('action', sa.String(length=32), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['moderator_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_moderation_actions_target_id', 'moderation_actions', ['target_id'], unique=False)


def downgrade() -> None:
    op.drop_table('moderation_actions')
    op.drop_table('community_reports')
    op.drop_table('community_reactions')
    op.drop_table('community_comments')
    op.drop_table('community_posts')
