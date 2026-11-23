/**
 * AANCHAL Family Member Portal — "My Mother's Moments"
 *
 * Dedicated space for authorized partners and family caregivers.
 *
 * Guarantees:
 * 1. Family members see ONLY moments explicitly shared with the Family Circle.
 * 2. Strictly BLOCKED from the wider Mother Community feed.
 * 3. Strictly BLOCKED from clinical screening records, EPDS scores, and medical reports.
 * 4. Supports single-use invitation code joining workflow.
 * 5. Respects mother-granted permissions (can_upload, can_comment).
 */

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, signOutUser } from '../auth/authService.js';
import { PatientIcon } from '../patient/components/PatientIcons.jsx';
import {
  fetchMomentsFeed,
  fetchPostDetail,
  createPost,
  fetchComments,
  addComment,
  toggleReaction,
  fetchBabyLetters,
  joinFamilyCircle,
  uploadMomentMedia,
} from '../patient/services/momentsApiService.js';
import '../patient/styles/moments.css';

const REACTION_CONFIG = [
  { type: 'heart', label: 'Heart', icon: 'heart', activeColor: '#be185d' },
  { type: 'cheer', label: 'Cheer', icon: 'cheer', activeColor: '#b45309' },
  { type: 'hug', label: 'Hug', icon: 'hug', activeColor: '#4338ca' },
  { type: 'love', label: 'Love', icon: 'love', activeColor: '#e11d48' },
  { type: 'strength', label: 'Strength', icon: 'strength', activeColor: '#047857' },
];

export function FamilyMomentsPage({ initialAction = null }) {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'letters'
  const [feedPosts, setFeedPosts] = useState([]);
  const [sharedLetters, setSharedLetters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Link status
  const [isLinked, setIsLinked] = useState(Boolean(currentUser?.mother_id));
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);

  // Comments state: map postId -> { open: bool, comments: [], text: '' }
  const [commentsState, setCommentsState] = useState({});

  // Compose family moment state
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerCaption, setComposerCaption] = useState('');
  const [composerMediaFile, setComposerMediaFile] = useState(null);
  const [composerMediaPreview, setComposerMediaPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadFamilyData();
  }, [isLinked]);

  const loadFamilyData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Family role feed is strictly tab='family'
      const feedRes = await fetchMomentsFeed({ tab: 'family', page: 1, pageSize: 30 });
      setFeedPosts(feedRes.items || []);
      setIsLinked(true);

      // Load letters shared with family
      try {
        const lettersRes = await fetchBabyLetters();
        setSharedLetters(lettersRes || []);
      } catch (err) {
        // May have no letters
      }
    } catch (err) {
      console.error('Failed to load family moments:', err);
      if (err.message && (err.message.includes('not linked') || err.message.includes('HTTP 403'))) {
        setIsLinked(false);
      } else {
        setErrorMessage(err.message || 'Unable to load family moments at this time.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinCircle = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setIsJoining(true);
    setJoinError(null);
    try {
      await joinFamilyCircle(joinCode.trim());
      setIsLinked(true);
      setJoinCode('');
      loadFamilyData();
    } catch (err) {
      setJoinError(err.message || 'Invalid or expired invitation code. Please check with the mother.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleSignOut = () => {
    signOutUser();
    navigate('/login');
  };

  // --------------------------------------------------------------------------
  // Reactions & Comments
  // --------------------------------------------------------------------------
  const handleToggleReaction = async (postId, reactionType) => {
    try {
      setFeedPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          const isCurrentlyActive = post.user_reaction === reactionType;
          const nextActive = isCurrentlyActive ? null : reactionType;
          const updatedCounts = { ...(post.reaction_counts || {}) };

          if (isCurrentlyActive) {
            updatedCounts[reactionType] = Math.max(0, (updatedCounts[reactionType] || 1) - 1);
          } else {
            if (post.user_reaction && updatedCounts[post.user_reaction]) {
              updatedCounts[post.user_reaction] = Math.max(0, updatedCounts[post.user_reaction] - 1);
            }
            updatedCounts[reactionType] = (updatedCounts[reactionType] || 0) + 1;
          }

          return {
            ...post,
            user_reaction: nextActive,
            reaction_counts: updatedCounts,
          };
        })
      );

      await toggleReaction(postId, reactionType);
    } catch (err) {
      console.error('Failed to react:', err);
    }
  };

  const handleToggleComments = async (postId) => {
    setCommentsState((prev) => {
      const current = prev[postId] || { open: false, comments: [], text: '' };
      return {
        ...prev,
        [postId]: { ...current, open: !current.open },
      };
    });

    if (!commentsState[postId]?.comments?.length) {
      try {
        const comments = await fetchComments(postId);
        setCommentsState((prev) => ({
          ...prev,
          [postId]: { ...(prev[postId] || {}), comments },
        }));
      } catch (err) {
        console.error('Failed to load comments:', err);
      }
    }
  };

  const handleAddComment = async (postId) => {
    const text = commentsState[postId]?.text?.trim();
    if (!text) return;

    try {
      const created = await addComment(postId, { content: text });
      setCommentsState((prev) => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          comments: [...(prev[postId]?.comments || []), created],
          text: '',
        },
      }));
      setFeedPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p))
      );
    } catch (err) {
      alert(`Unable to post comment: ${err.message}`);
    }
  };

  // --------------------------------------------------------------------------
  // Create Family Post
  // --------------------------------------------------------------------------
  const handleSelectMedia = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setComposerMediaFile(file);
    setComposerMediaPreview(URL.createObjectURL(file));
  };

  const handleCreateFamilyPost = async (e) => {
    e.preventDefault();
    if (!composerCaption.trim() && !composerMediaFile) return;

    setIsSubmitting(true);
    try {
      let uploadedUrl = null;
      let mediaType = null;
      if (composerMediaFile) {
        const res = await uploadMomentMedia(composerMediaFile);
        uploadedUrl = res.url;
        mediaType = res.media_type;
      }

      await createPost({
        audience: 'family',
        experience_type: 'general',
        caption: composerCaption.trim(),
        media_url: uploadedUrl,
        media_type: mediaType,
      });

      setComposerCaption('');
      if (composerMediaPreview) URL.revokeObjectURL(composerMediaPreview);
      setComposerMediaFile(null);
      setComposerMediaPreview(null);
      setIsComposerOpen(false);
      loadFamilyData();
    } catch (err) {
      alert(`Failed to share family moment: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--patient-cream, #fdf8f4)' }}>
      {/* Top Navigation Bar */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid var(--patient-blush-border, #f0dfe2)',
          padding: '0.85rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'var(--patient-brand-rose-subtle, #fde7ec)',
              color: 'var(--patient-brand-rose-deep, #ca2261)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PatientIcon name="heart" size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--patient-ink, #271218)' }}>
              AANCHAL
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--patient-muted, #62555a)' }}>
              Family Caregiver Portal
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#eff6ff',
                color: '#1e40af',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {(currentUser?.name || 'F').charAt(0).toUpperCase()}
            </div>
            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--patient-ink)' }}>
              {currentUser?.name || 'Family Member'}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '9999px',
              border: '1px solid var(--patient-blush-border, #f0dfe2)',
              background: '#fff',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--patient-ink-secondary)',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="moments-container" style={{ paddingTop: '2rem' }}>
        {/* Banner: Family Circle Privacy Guarantee */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
            border: '1px solid #a7f3d0',
            borderRadius: '14px',
            padding: '1.25rem 1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#d1fae5',
                color: '#065f46',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <PatientIcon name="lock" size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.94rem', color: '#065f46' }}>
                Protected Family Circle
              </div>
              <div style={{ fontSize: '0.82rem', color: '#047857', marginTop: '0.15rem' }}>
                This is a private sanctuary for family connection. In compliance with clinical privacy,
                all psychological screening results and clinical assessments are strictly confidential.
              </div>
            </div>
          </div>
        </div>

        {/* Not Linked State -> Invitation Code Entry Form */}
        {!isLinked && !isLoading ? (
          <div
            style={{
              maxWidth: '540px',
              margin: '3rem auto',
              background: '#ffffff',
              border: '1px solid var(--patient-blush-border)',
              borderRadius: '16px',
              padding: '2.5rem',
              boxShadow: '0 8px 30px rgba(182, 45, 91, 0.08)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--patient-brand-rose-subtle)',
                color: 'var(--patient-brand-rose-deep)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              <PatientIcon name="users" size={28} />
            </div>

            <h2
              style={{
                fontFamily: 'var(--patient-font-serif)',
                fontSize: '1.6rem',
                margin: '0 0 0.5rem',
                color: 'var(--patient-ink)',
              }}
            >
              Join Your Mother's Family Circle
            </h2>
            <p style={{ color: 'var(--patient-ink-secondary)', fontSize: '0.92rem', lineHeight: 1.5, margin: '0 0 1.75rem' }}>
              Enter the single-use invitation code provided by the mother to connect with her private Family Circle.
            </p>

            {joinError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#991b1b',
                  fontSize: '0.84rem',
                  marginBottom: '1.25rem',
                  textAlign: 'left',
                }}
              >
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinCircle}>
              <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Invitation Code
                </label>
                <input
                  type="text"
                  className="comment-input-box"
                  style={{
                    width: '100%',
                    borderRadius: '10px',
                    fontFamily: 'monospace',
                    fontSize: '1.15rem',
                    textAlign: 'center',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                  placeholder="MOMENT-XXXX-XXXX"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <button
                type="submit"
                className="moments-btn-primary"
                disabled={isJoining || !joinCode.trim()}
                style={{ width: '100%', justifyContent: 'center', padding: '0.8rem' }}
              >
                <PatientIcon name="check" size={16} />
                <span>{isJoining ? 'Verifying & Linking...' : 'Connect to Family Circle'}</span>
              </button>
            </form>
          </div>
        ) : (
          /* Linked State -> Family Portal Views */
          <div>
            {/* Header & Sub-tabs */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--patient-blush-border)',
                marginBottom: '2rem',
                paddingBottom: '0.5rem',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`moments-tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
                  onClick={() => setActiveTab('feed')}
                >
                  <PatientIcon name="heart" size={16} />
                  <span>My Mother's Moments</span>
                  {feedPosts.length > 0 && <span className="badge-count">{feedPosts.length}</span>}
                </button>

                <button
                  type="button"
                  className={`moments-tab-btn ${activeTab === 'letters' ? 'active' : ''}`}
                  onClick={() => setActiveTab('letters')}
                >
                  <PatientIcon name="mail" size={16} />
                  <span>Letters Shared With You</span>
                  {sharedLetters.length > 0 && (
                    <span className="badge-count">{sharedLetters.length}</span>
                  )}
                </button>
              </div>

              <button
                type="button"
                className="moments-btn-primary"
                onClick={() => setIsComposerOpen(!isComposerOpen)}
              >
                <PatientIcon name="plus" size={16} />
                <span>Share Family Moment</span>
              </button>
            </div>

            {/* Composer Card for Family (if opened) */}
            {isComposerOpen && (
              <div className="moment-composer-card">
                <h3 className="composer-section-title">Share a Moment with Mother</h3>
                <p className="composer-section-desc">
                  This moment will be shared directly inside your private Family Circle.
                </p>

                <form onSubmit={handleCreateFamilyPost}>
                  <textarea
                    className="composer-textarea"
                    placeholder="Write a message of love, support, or capture a family memory..."
                    value={composerCaption}
                    onChange={(e) => setComposerCaption(e.target.value)}
                    required
                  />

                  {composerMediaPreview ? (
                    <div className="media-preview-container">
                      <img src={composerMediaPreview} alt="" />
                      <button
                        type="button"
                        className="media-remove-btn"
                        onClick={() => {
                          URL.revokeObjectURL(composerMediaPreview);
                          setComposerMediaPreview(null);
                          setComposerMediaFile(null);
                        }}
                      >
                        <PatientIcon name="close" size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="media-upload-dropzone"
                      style={{ padding: '1rem', marginBottom: '1.25rem' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <PatientIcon name="photo" size={24} color="var(--patient-brand-rose)" />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, marginLeft: '0.5rem' }}>
                        Add Photo or Video
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        style={{ display: 'none' }}
                        onChange={handleSelectMedia}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="submit"
                      className="moments-btn-primary"
                      disabled={isSubmitting || (!composerCaption.trim() && !composerMediaFile)}
                    >
                      <PatientIcon name="send" size={16} />
                      <span>{isSubmitting ? 'Sharing...' : 'Share to Family Circle'}</span>
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: '0.6rem 1.25rem',
                        background: 'transparent',
                        border: '1px solid var(--patient-blush-border)',
                        borderRadius: '9999px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                      onClick={() => setIsComposerOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Sub-tab 1: Moments Feed */}
            {activeTab === 'feed' && (
              <div className="moments-feed">
                {isLoading ? (
                  <p style={{ textAlign: 'center', color: 'var(--patient-muted)' }}>
                    Loading family moments...
                  </p>
                ) : feedPosts.length === 0 ? (
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--patient-blush-border)',
                      borderRadius: '16px',
                      padding: '3rem 2rem',
                      textAlign: 'center',
                    }}
                  >
                    <PatientIcon name="heart" size={32} color="var(--patient-brand-rose)" />
                    <h3 style={{ fontFamily: 'var(--patient-font-serif)', margin: '1rem 0 0.5rem' }}>
                      No moments shared in your family circle yet
                    </h3>
                    <p style={{ color: 'var(--patient-muted)', maxWidth: '420px', margin: '0 auto' }}>
                      When the mother shares photos, reflections, or milestones with the Family Circle,
                      they will appear here.
                    </p>
                  </div>
                ) : (
                  feedPosts.map((post) => {
                    const commentsData = commentsState[post.id] || { open: false, comments: [], text: '' };

                    return (
                      <article key={post.id} className="moment-card">
                        <div className="moment-card-header">
                          <div className="moment-author-info">
                            <div className="moment-avatar">
                              <span>{(post.display_author || 'M').charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="moment-author-meta">
                              <div className="moment-author-name">
                                <span>{post.display_author}</span>
                                <span className="moment-author-badge family">Family Circle</span>
                              </div>
                              <div className="moment-timestamp-row">
                                <span>{new Date(post.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="moment-content">
                          {post.milestone_title && (
                            <div className="moment-milestone-banner">
                              <PatientIcon name="cheer" size={14} />
                              <span>Milestone: {post.milestone_title}</span>
                            </div>
                          )}

                          <p className="moment-caption">{post.caption}</p>

                          {post.media_url && (
                            <div className="moment-media-wrapper">
                              {post.media_type === 'video' ? (
                                <video src={post.media_url} controls preload="metadata" />
                              ) : (
                                <img src={post.media_url} alt="" loading="lazy" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Reactions Bar */}
                        <div className="moment-actions-bar">
                          <div className="moment-reactions-cluster">
                            {REACTION_CONFIG.map((r) => {
                              const count = post.reaction_counts?.[r.type] || 0;
                              const isActive = post.user_reaction === r.type;

                              return (
                                <button
                                  key={r.type}
                                  type="button"
                                  className={`reaction-btn ${isActive ? 'active' : ''}`}
                                  onClick={() => handleToggleReaction(post.id, r.type)}
                                >
                                  <PatientIcon
                                    name={r.icon}
                                    size={14}
                                    color={isActive ? r.activeColor : 'currentColor'}
                                  />
                                  <span>{r.label}</span>
                                  {count > 0 && <span style={{ fontWeight: 700 }}>{count}</span>}
                                </button>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            className={`action-icon-btn ${commentsData.open ? 'active' : ''}`}
                            onClick={() => handleToggleComments(post.id)}
                          >
                            <PatientIcon name="message-square" size={14} />
                            <span>{post.comments_count || 0} Comments</span>
                          </button>
                        </div>

                        {/* Comments Drawer */}
                        {commentsData.open && (
                          <div className="moment-comments-section">
                            <div className="moment-comment-composer">
                              <input
                                type="text"
                                className="comment-input-box"
                                placeholder="Leave words of love and encouragement..."
                                value={commentsData.text || ''}
                                onChange={(e) =>
                                  setCommentsState((prev) => ({
                                    ...prev,
                                    [post.id]: { ...(prev[post.id] || {}), text: e.target.value },
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddComment(post.id);
                                }}
                              />
                              <button
                                type="button"
                                className="comment-send-btn"
                                disabled={!commentsData.text?.trim()}
                                onClick={() => handleAddComment(post.id)}
                              >
                                <PatientIcon name="send" size={14} color="#fff" />
                              </button>
                            </div>

                            <div className="moment-comments-list">
                              {commentsData.comments?.map((c) => (
                                <div key={c.id} className="moment-comment-item">
                                  <div className="comment-avatar">
                                    {c.author_role === 'family' ? 'F' : 'M'}
                                  </div>
                                  <div className="comment-bubble">
                                    <div className="comment-author-row">
                                      <span className="comment-author-name">
                                        {c.display_author}
                                        {c.relationship_label && (
                                          <span
                                            className="comment-role-tag"
                                            style={{ background: '#eff6ff', color: '#1e40af' }}
                                          >
                                            {c.relationship_label}
                                          </span>
                                        )}
                                      </span>
                                      <span className="comment-time">
                                        {new Date(c.created_at).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
                                    <p className="comment-text">{c.content}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            )}

            {/* Sub-tab 2: Letters Shared with Family */}
            {activeTab === 'letters' && (
              <div className="letters-timeline">
                {sharedLetters.length === 0 ? (
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--patient-blush-border)',
                      borderRadius: '16px',
                      padding: '3rem 2rem',
                      textAlign: 'center',
                    }}
                  >
                    <PatientIcon name="mail" size={32} color="var(--patient-brand-rose)" />
                    <h3 style={{ fontFamily: 'var(--patient-font-serif)', margin: '1rem 0 0.5rem' }}>
                      No letters shared with family yet
                    </h3>
                    <p style={{ color: 'var(--patient-muted)', maxWidth: '420px', margin: '0 auto' }}>
                      When the mother chooses to share a letter to the baby with the family circle, it
                      will be displayed here.
                    </p>
                  </div>
                ) : (
                  sharedLetters.map((letter) => (
                    <article key={letter.id} className="letter-card">
                      <div className="letter-header">
                        <div>
                          <h3 className="letter-title">{letter.title}</h3>
                          <div className="letter-date">
                            {new Date(letter.letter_date).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </div>
                        </div>
                      </div>

                      <p className="letter-body">{letter.content}</p>

                      {letter.photo_url && (
                        <div style={{ maxWidth: '300px', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.25rem' }}>
                          <img src={letter.photo_url} alt="" style={{ width: '100%', display: 'block' }} />
                        </div>
                      )}

                      <div className="letter-footer">
                        <span className="letter-privacy-indicator shared">
                          <PatientIcon name="users" size={12} />
                          <span>Shared with Family Circle</span>
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default FamilyMomentsPage;
