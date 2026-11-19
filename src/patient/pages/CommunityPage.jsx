/**
 * MIORA / AANCHAL AI — Mother's Circle (Anonymous Mother's Community)
 *
 * Safe, supportive, anonymous peer sanctuary for registered mothers.
 * Fully backed by persistent FastAPI backend with strict zero-PII guarantees.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { PatientIcon } from '../components/PatientIcons.jsx';
import {
  fetchCommunityFeed,
  createCommunityPost,
  updateCommunityPost,
  deleteCommunityPost,
  fetchPostComments,
  addPostComment,
  updateComment,
  deleteComment,
  togglePostReaction,
  reportContent,
} from '../services/communityApiService.js';
import '../styles/community.css';

const CATEGORIES = [
  'All',
  'Emotional Support',
  'My Postpartum Journey',
  'Motherhood Struggles',
  'Questions & Advice',
  'Small Wins',
  'Relationships & Family',
  'Just Need to Talk',
];

const MOODS = [
  'Hopeful',
  'Overwhelmed',
  'Exhausted',
  'Grateful',
  'Anxious',
  'Healing',
  'Lonely',
  'Proud',
];

const PERSONAS = [
  'Anonymous Mother',
  'A Mother in Her Journey',
  'Anonymous Member',
];

const REACTION_CONFIG = [
  { type: 'sending_love', label: 'Sending Love', emoji: '❤️' },
  { type: 'i_understand', label: 'I Understand', emoji: '🌸' },
  { type: 'youre_not_alone', label: "You're Not Alone", emoji: '🫂' },
  { type: 'sending_strength', label: 'Sending Strength', emoji: '💪' },
];

const REPORT_REASONS = [
  'Harassment',
  'Abuse',
  'Spam',
  'Harmful Advice',
  'Privacy Violation',
  'Other',
];

export function CommunityPage() {
  // Feed state
  const [posts, setPosts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feedError, setFeedError] = useState(null);

  // Compose post state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeContent, setComposeContent] = useState('');
  const [composeCategory, setComposeCategory] = useState('Emotional Support');
  const [composeMood, setComposeMood] = useState('');
  const [composePersona, setComposePersona] = useState('Anonymous Mother');
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [composeError, setComposeError] = useState(null);

  // Post edit state
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('Emotional Support');
  const [editMood, setEditMood] = useState('');
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);

  // Comments state per post
  const [openComments, setOpenComments] = useState({});
  const [commentsMap, setCommentsMap] = useState({});
  const [loadingComments, setLoadingComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');

  // Dropdown menus
  const [activeMenuPostId, setActiveMenuPostId] = useState(null);

  // Reporting modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState({ postId: null, commentId: null });
  const [reportReason, setReportReason] = useState('Harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Load feed
  const loadFeed = useCallback(async (cat, sort, p, append = false) => {
    setIsLoading(true);
    setFeedError(null);
    try {
      const data = await fetchCommunityFeed({
        category: cat === 'All' ? null : cat,
        sort,
        page: p,
        pageSize: 10,
      });

      if (append) {
        setPosts((prev) => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts || []);
      }
      setTotalCount(data.total_count || 0);
      setHasMore(data.has_more || false);
    } catch (err) {
      setFeedError(err.message || 'Unable to load community posts. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    loadFeed(selectedCategory, sortOrder, 1, false);
  }, [selectedCategory, sortOrder, loadFeed]);

  // Handle Load More
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadFeed(selectedCategory, sortOrder, nextPage, true);
  };

  // Submit new post
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (composeContent.trim().length < 10) {
      setComposeError('Please share at least 10 characters.');
      return;
    }

    setIsSubmittingPost(true);
    setComposeError(null);
    try {
      const newPost = await createCommunityPost({
        content: composeContent.trim(),
        category: composeCategory,
        mood: composeMood || null,
        display_author: composePersona,
      });

      // Insert at top of feed
      setPosts((prev) => [newPost, ...prev]);
      setTotalCount((c) => c + 1);
      setComposeContent('');
      setComposeMood('');
      setIsComposeOpen(false);
      showToast('Your anonymous reflection has been shared safely.');
    } catch (err) {
      setComposeError(err.message || 'Failed to submit post. Please try again.');
    } finally {
      setIsSubmittingPost(false);
    }
  };

  // Submit post edit
  const handleSavePostEdit = async () => {
    if (!editingPost || editContent.trim().length < 10) return;

    setIsUpdatingPost(true);
    try {
      const updated = await updateCommunityPost(editingPost.id, {
        content: editContent.trim(),
        category: editCategory,
        mood: editMood || null,
      });

      setPosts((prev) => prev.map((p) => (p.id === editingPost.id ? updated : p)));
      setEditingPost(null);
      showToast('Post updated successfully.');
    } catch (err) {
      alert(err.message || 'Failed to update post.');
    } finally {
      setIsUpdatingPost(false);
    }
  };

  // Delete post
  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you wish to delete this community post?')) return;

    try {
      await deleteCommunityPost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setTotalCount((c) => Math.max(0, c - 1));
      setActiveMenuPostId(null);
      showToast('Post deleted.');
    } catch (err) {
      alert(err.message || 'Failed to delete post.');
    }
  };

  // Toggle reaction
  const handleReactionClick = async (postId, reactionType) => {
    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;

        const hadReaction = p.user_reaction === reactionType;
        const newReaction = hadReaction ? null : reactionType;
        const oldReaction = p.user_reaction;

        const breakdown = { ...(p.reaction_breakdown || {}) };
        if (oldReaction && breakdown[oldReaction]) {
          breakdown[oldReaction] = Math.max(0, breakdown[oldReaction] - 1);
        }
        if (newReaction) {
          breakdown[newReaction] = (breakdown[newReaction] || 0) + 1;
        }

        const newLikesCount = hadReaction
          ? Math.max(0, p.likes_count - 1)
          : oldReaction
          ? p.likes_count
          : p.likes_count + 1;

        return {
          ...p,
          user_reaction: newReaction,
          likes_count: newLikesCount,
          reaction_breakdown: breakdown,
        };
      })
    );

    try {
      const res = await togglePostReaction(postId, reactionType);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                user_reaction: res.user_reaction,
                likes_count: res.likes_count,
                reaction_breakdown: res.reaction_breakdown,
              }
            : p
        )
      );
    } catch (err) {
      // Revert if error
      loadFeed(selectedCategory, sortOrder, 1, false);
    }
  };

  // Toggle comments thread
  const handleToggleComments = async (postId) => {
    const isNowOpen = !openComments[postId];
    setOpenComments((prev) => ({ ...prev, [postId]: isNowOpen }));

    if (isNowOpen && !commentsMap[postId]) {
      setLoadingComments((prev) => ({ ...prev, [postId]: true }));
      try {
        const comments = await fetchPostComments(postId);
        setCommentsMap((prev) => ({ ...prev, [postId]: comments }));
      } catch (err) {
        // Fallback empty comments
        setCommentsMap((prev) => ({ ...prev, [postId]: [] }));
      } finally {
        setLoadingComments((prev) => ({ ...prev, [postId]: false }));
      }
    }
  };

  // Submit comment
  const handleAddComment = async (postId) => {
    const text = (commentInputs[postId] || '').trim();
    if (text.length < 2) return;

    setSubmittingComment((prev) => ({ ...prev, [postId]: true }));
    try {
      const newComment = await addPostComment(postId, text);
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }));
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p))
      );
      showToast('Supportive comment added anonymously.');
    } catch (err) {
      alert(err.message || 'Failed to submit comment.');
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  // Edit comment
  const handleSaveCommentEdit = async (commentId, postId) => {
    if (!editCommentText.trim()) return;
    try {
      const updated = await updateComment(commentId, editCommentText.trim());
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c) => (c.id === commentId ? updated : c)),
      }));
      setEditingCommentId(null);
      setEditCommentText('');
      showToast('Comment updated.');
    } catch (err) {
      alert(err.message || 'Failed to update comment.');
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId, postId) => {
    if (!window.confirm('Delete your comment?')) return;
    try {
      await deleteComment(commentId);
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
      }));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p
        )
      );
      showToast('Comment removed.');
    } catch (err) {
      alert(err.message || 'Failed to delete comment.');
    }
  };

  // Open reporting modal
  const handleOpenReport = (postId, commentId = null) => {
    setReportTarget({ postId, commentId });
    setReportReason('Harassment');
    setReportDetails('');
    setReportModalOpen(true);
    setActiveMenuPostId(null);
  };

  // Submit report
  const handleSubmitReport = async () => {
    setIsReporting(true);
    try {
      await reportContent({
        postId: reportTarget.postId,
        commentId: reportTarget.commentId,
        reason: reportReason,
        details: reportDetails.trim() || null,
      });
      setReportModalOpen(false);
      showToast('Thank you. Content reported for clinical moderation.');
    } catch (err) {
      alert(err.message || 'Failed to submit report.');
    } finally {
      setIsReporting(false);
    }
  };

  // Helper Toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Format relative date
  const formatTimeAgo = (dateStr) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 2) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="community-container">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            background: '#1e293b',
            color: '#ffffff',
            padding: '0.85rem 1.4rem',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            zIndex: 9999,
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="community-header">
        <div className="community-badge-pill">
          <PatientIcon name="lock" size={14} />
          <span>Mother's Sanctuary</span>
        </div>
        <h1 className="community-title">Mother's Circle</h1>
        <p className="community-subtitle">
          A safe, non-judgmental space where every mother is heard, understood, and supported.
          Share your journey, triumphs, and struggles with complete anonymity.
        </p>

        <div className="community-header-actions">
          <button
            type="button"
            className="btn-primary-rose"
            onClick={() => {
              setIsComposeOpen(true);
              setEditingPost(null);
            }}
          >
            <PatientIcon name="sparkles" size={16} />
            <span>Write Anonymously</span>
          </button>
          <button
            type="button"
            className="btn-secondary-blush"
            onClick={() => {
              setSelectedCategory('All');
              loadFeed('All', sortOrder, 1, false);
            }}
          >
            <span>Explore Community</span>
          </button>
        </div>
      </header>

      {/* Privacy Notice Strip */}
      <div className="privacy-notice-strip">
        <PatientIcon name="shield-check" size={20} color="#be185d" />
        <div>
          <strong>Privacy Guaranteed:</strong> Your real name, email, profile photo, and account details
          are never stored with your public posts or exposed to other members.
        </div>
      </div>

      {/* Compose Post Card */}
      {isComposeOpen && (
        <div className="compose-card">
          <div className="compose-header">
            <h3>
              <PatientIcon name="sparkles" size={18} color="#be185d" />
              <span>Share Anonymously with Mother's Circle</span>
            </h3>
            <span className="compose-anonymous-tag">
              <PatientIcon name="lock" size={12} />
              Identity Protected
            </span>
          </div>

          <form onSubmit={handleCreatePost}>
            <textarea
              className="compose-textarea"
              placeholder="What is on your heart today? Share a postpartum feeling, small victory, question, or struggle..."
              value={composeContent}
              onChange={(e) => setComposeContent(e.target.value)}
              maxLength={2500}
              required
            />

            <div className="compose-meta-row">
              {/* Category */}
              <div>
                <label className="compose-field-label">Category</label>
                <select
                  className="compose-select"
                  value={composeCategory}
                  onChange={(e) => setComposeCategory(e.target.value)}
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Mood */}
              <div>
                <label className="compose-field-label">Current Mood (Optional)</label>
                <select
                  className="compose-select"
                  value={composeMood}
                  onChange={(e) => setComposeMood(e.target.value)}
                >
                  <option value="">Select mood...</option>
                  {MOODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Persona */}
              <div>
                <label className="compose-field-label">Display Persona</label>
                <select
                  className="compose-select"
                  value={composePersona}
                  onChange={(e) => setComposePersona(e.target.value)}
                >
                  {PERSONAS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {composeError && (
              <p style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '0.75rem', fontWeight: 500 }}>
                {composeError}
              </p>
            )}

            <div className="compose-footer">
              <span className={`compose-char-counter ${composeContent.length < 10 && composeContent.length > 0 ? 'is-error' : ''}`}>
                {composeContent.length} / 2500 characters (min. 10)
              </span>

              <div className="compose-btn-group">
                <button
                  type="button"
                  className="btn-secondary-blush"
                  onClick={() => setIsComposeOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-rose"
                  disabled={isSubmittingPost || composeContent.trim().length < 10}
                >
                  <PatientIcon name="lock" size={14} />
                  <span>{isSubmittingPost ? 'Posting...' : 'Submit Anonymously'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="comm-modal-overlay">
          <div className="comm-modal-card">
            <h3>Edit Anonymous Post</h3>
            <p>Update your reflection while preserving full anonymity.</p>

            <textarea
              className="compose-textarea"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              maxLength={2500}
              style={{ minHeight: '120px' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
              <div>
                <label className="compose-field-label">Category</label>
                <select
                  className="compose-select"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="compose-field-label">Mood</label>
                <select
                  className="compose-select"
                  value={editMood}
                  onChange={(e) => setEditMood(e.target.value)}
                >
                  <option value="">None</option>
                  {MOODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer-actions">
              <button
                type="button"
                className="btn-secondary-blush"
                onClick={() => setEditingPost(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary-rose"
                onClick={handleSavePostEdit}
                disabled={isUpdatingPost || editContent.trim().length < 10}
              >
                {isUpdatingPost ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feed Filter & Sort Bar */}
      <section className="feed-controls-bar">
        <div className="category-chips-scroll" role="tablist" aria-label="Filter posts by category">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat}
              className={`category-chip ${selectedCategory === cat ? 'is-active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="feed-sort-row">
          <span className="feed-count-summary">
            {totalCount} {totalCount === 1 ? 'shared reflection' : 'shared reflections'}
          </span>

          <div className="sort-select-wrap">
            <label htmlFor="feed-sort-select">Sort by:</label>
            <select
              id="feed-sort-select"
              className="sort-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="most_supported">Most Supported</option>
            </select>
          </div>
        </div>
      </section>

      {/* Error State */}
      {feedError && (
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '14px', padding: '1.25rem', textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ color: '#be185d', fontWeight: 600, margin: '0 0 0.5rem' }}>{feedError}</p>
          <button
            type="button"
            className="btn-secondary-blush"
            onClick={() => loadFeed(selectedCategory, sortOrder, 1, false)}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && posts.length === 0 && (
        <div className="community-feed">
          {[1, 2, 3].map((n) => (
            <div key={n} className="skeleton-card">
              <div style={{ display: 'flex', gap: '0.85rem', marginBottom: '1rem', alignItems: 'center' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#f1f5f9' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-line" style={{ width: '120px' }} />
                  <div className="skeleton-line" style={{ width: '80px', height: '10px' }} />
                </div>
              </div>
              <div className="skeleton-line" style={{ width: '90%' }} />
              <div className="skeleton-line" style={{ width: '70%' }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && posts.length === 0 && !feedError && (
        <div className="community-empty-state">
          <div className="empty-icon-wrap">
            <PatientIcon name="community" size={32} />
          </div>
          <h3 className="empty-title">Your community is growing.</h3>
          <p className="empty-subtitle">
            Be the first mother to share an encouraging thought, a question, or a small win today.
          </p>
          <button
            type="button"
            className="btn-primary-rose"
            onClick={() => setIsComposeOpen(true)}
          >
            <PatientIcon name="sparkles" size={16} />
            <span>Share the First Thought</span>
          </button>
        </div>
      )}

      {/* Post List */}
      <main className="community-feed">
        {posts.map((post) => {
          const isCommentsOpen = Boolean(openComments[post.id]);
          const comments = commentsMap[post.id] || [];
          const isPostMenuOpen = activeMenuPostId === post.id;

          return (
            <article key={post.id} className={`post-card ${post.is_own_post ? 'is-own-post' : ''}`}>
              {/* Card Header */}
              <div className="post-card-header">
                <div className="post-author-box">
                  <div className="post-avatar-circle" aria-hidden="true">
                    <PatientIcon name="anonymous-mother" size={24} color="#831843" />
                  </div>
                  <div className="post-author-meta">
                    <span className="post-author-name">
                      {post.display_author}
                      {post.is_own_post && <span className="own-post-pill">Your Post</span>}
                    </span>
                    <span className="post-time-meta">{formatTimeAgo(post.created_at)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="post-tags-row">
                    <span className="category-tag">{post.category}</span>
                    {post.mood && <span className="mood-tag">{post.mood}</span>}
                  </div>

                  {/* Options Menu Toggle */}
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="more-options-btn"
                      onClick={() => setActiveMenuPostId(isPostMenuOpen ? null : post.id)}
                      aria-label="Post options"
                    >
                      <PatientIcon name="more-vertical" size={18} />
                    </button>

                    {isPostMenuOpen && (
                      <div className="dropdown-menu-popover">
                        {post.is_own_post ? (
                          <>
                            <button
                              type="button"
                              className="dropdown-item-btn"
                              onClick={() => {
                                setEditingPost(post);
                                setEditContent(post.content);
                                setEditCategory(post.category);
                                setEditMood(post.mood || '');
                                setActiveMenuPostId(null);
                              }}
                            >
                              Edit Post
                            </button>
                            <button
                              type="button"
                              className="dropdown-item-btn is-danger"
                              onClick={() => handleDeletePost(post.id)}
                            >
                              Delete Post
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="dropdown-item-btn is-danger"
                            onClick={() => handleOpenReport(post.id)}
                          >
                            Report Post
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Content */}
              <div className="post-card-content">{post.content}</div>

              {/* Action Bar: Supportive Reactions & Comments */}
              <div className="post-actions-bar">
                {/* 4 Supportive Reactions */}
                <div className="reactions-group" role="group" aria-label="Supportive emotional reactions">
                  {REACTION_CONFIG.map(({ type, label, emoji }) => {
                    const count = post.reaction_breakdown?.[type] || 0;
                    const isActive = post.user_reaction === type;

                    return (
                      <button
                        key={type}
                        type="button"
                        className={`reaction-btn ${isActive ? 'is-active' : ''}`}
                        onClick={() => handleReactionClick(post.id, type)}
                        title={`${label} (${count})`}
                        aria-pressed={isActive}
                      >
                        <span aria-hidden="true">{emoji}</span>
                        <span>{label}</span>
                        {count > 0 && <span style={{ fontWeight: 700, marginLeft: '0.15rem' }}>{count}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Comment Counter / Toggle */}
                <div className="post-footer-right">
                  <button
                    type="button"
                    className="toggle-comments-btn"
                    onClick={() => handleToggleComments(post.id)}
                  >
                    <PatientIcon name="ai-assistant" size={16} />
                    <span>
                      {post.comments_count === 0
                        ? 'Leave Support'
                        : `${post.comments_count} ${post.comments_count === 1 ? 'comment' : 'comments'}`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Collapsible Comments Thread */}
              {isCommentsOpen && (
                <div className="comments-thread-container">
                  {loadingComments[post.id] ? (
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1rem' }}>
                      Loading supportive thoughts...
                    </p>
                  ) : comments.length > 0 ? (
                    <div className="comments-list">
                      {comments.map((comment) => (
                        <div key={comment.id} className="comment-card">
                          <div className="comment-header">
                            <span className="comment-author-name">
                              <PatientIcon name="anonymous-mother" size={14} color="#be185d" />
                              <span>{comment.display_author}</span>
                              {comment.is_own_comment && <span className="own-post-pill">You</span>}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {formatTimeAgo(comment.created_at)}
                              </span>
                              {comment.is_own_comment ? (
                                <button
                                  type="button"
                                  style={{ background: 'none', border: 'none', color: '#e11d48', fontSize: '0.75rem', cursor: 'pointer' }}
                                  onClick={() => handleDeleteComment(comment.id, post.id)}
                                >
                                  Delete
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer' }}
                                  onClick={() => handleOpenReport(null, comment.id)}
                                >
                                  Report
                                </button>
                              )}
                            </div>
                          </div>

                          {editingCommentId === comment.id ? (
                            <div style={{ marginTop: '0.5rem' }}>
                              <input
                                type="text"
                                className="comment-input"
                                value={editCommentText}
                                onChange={(e) => setEditCommentText(e.target.value)}
                              />
                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <button
                                  type="button"
                                  className="btn-primary-rose"
                                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                  onClick={() => handleSaveCommentEdit(comment.id, post.id)}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary-blush"
                                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                  onClick={() => setEditingCommentId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="comment-body">{comment.content}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1rem' }}>
                      No comments yet. Share a comforting thought first!
                    </p>
                  )}

                  {/* Add Comment Input */}
                  <div className="comment-compose-wrap">
                    <input
                      type="text"
                      className="comment-input"
                      placeholder="Write an anonymous words of support (min. 2 chars)..."
                      value={commentInputs[post.id] || ''}
                      onChange={(e) =>
                        setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddComment(post.id);
                        }
                      }}
                      maxLength={500}
                    />
                    <button
                      type="button"
                      className="btn-primary-rose"
                      style={{ padding: '0.65rem 1.1rem' }}
                      disabled={
                        submittingComment[post.id] ||
                        (commentInputs[post.id] || '').trim().length < 2
                      }
                      onClick={() => handleAddComment(post.id)}
                    >
                      {submittingComment[post.id] ? 'Sending...' : 'Reply'}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </main>

      {/* Pagination Load More */}
      {hasMore && !isLoading && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            type="button"
            className="btn-secondary-blush"
            onClick={handleLoadMore}
            style={{ padding: '0.85rem 2rem' }}
          >
            Load Older Reflections
          </button>
        </div>
      )}

      {/* Clinical Safeguarding / Tele-MANAS Hotline Card */}
      <aside className="community-safety-card" aria-label="Crisis Support Resources">
        <div className="safety-card-content">
          <h4>Gentle Care & Immediate Clinical Support</h4>
          <p>
            Mother's Circle is a supportive peer sanctuary and does not replace medical diagnosis or therapy.
            If you are in distress or need confidential clinical help right now, free 24/7 care is available.
          </p>
        </div>
        <a
          href="tel:14416"
          className="safety-hotline-pill"
          aria-label="Call Tele-MANAS Maternal Mental Health Helpline at 14416"
        >
          <PatientIcon name="headset-support" size={18} color="#be185d" />
          <span>Tele-MANAS: 14416 (24x7 Free)</span>
        </a>
      </aside>

      {/* Inappropriate Content Reporting Modal */}
      {reportModalOpen && (
        <div className="comm-modal-overlay">
          <div className="comm-modal-card">
            <h3>Report Inappropriate Content</h3>
            <p>
              Help us keep Mother's Circle gentle and safe. Reports are escalated directly to clinical staff.
            </p>

            <div className="radio-group-wrap">
              {REPORT_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`radio-item-label ${reportReason === reason ? 'is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="report_reason"
                    value={reason}
                    checked={reportReason === reason}
                    onChange={() => setReportReason(reason)}
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            <textarea
              className="compose-textarea"
              placeholder="Optional additional details for moderators..."
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              style={{ minHeight: '80px', marginTop: '0.5rem' }}
              maxLength={1000}
            />

            <div className="modal-footer-actions">
              <button
                type="button"
                className="btn-secondary-blush"
                onClick={() => setReportModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary-rose"
                onClick={handleSubmitReport}
                disabled={isReporting}
              >
                {isReporting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunityPage;
