/**
 * AANCHAL Moments — Private Motherhood Community & Family Circle
 * Inside Patient Portal Support Space.
 *
 * Implements:
 * 1. Community Feed (A Day in My Life, Support Circle, Milestones)
 * 2. My Family Circle (Private family sharing, invitation code generation, permissions)
 * 3. Create a Moment (Audience selector, media uploader, anonymous toggle, mood)
 * 4. My Moments (Personal archive & saved moments)
 * 5. Letters to My Baby (Intimate memory journal, keepsake download)
 */

import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../auth/authService.js';
import { PatientIcon } from '../components/PatientIcons.jsx';
import {
  fetchMomentsFeed,
  createPost,
  deletePost,
  fetchComments,
  addComment,
  toggleReaction,
  toggleSaveMoment,
  fetchBabyLetters,
  createBabyLetter,
  deleteBabyLetter,
  fetchFamilyCircle,
  createFamilyInvitation,
  revokeFamilyInvitation,
  removeFamilyMember,
  updateFamilyMemberPermissions,
  reportMomentContent,
  blockUser,
  uploadMomentMedia,
} from '../services/momentsApiService.js';
import '../styles/moments.css';

const EXPERIENCES = [
  { id: 'all', label: 'All Moments', icon: 'sparkles' },
  { id: 'day_in_life', label: 'A Day in My Life', icon: 'calendar' },
  { id: 'support_circle', label: 'Support Circle', icon: 'hug' },
  { id: 'milestone', label: 'Baby Milestones', icon: 'cheer' },
];

const REACTION_CONFIG = [
  { type: 'heart', label: 'Heart', icon: 'heart', activeColor: '#be185d' },
  { type: 'cheer', label: 'Cheer', icon: 'cheer', activeColor: '#b45309' },
  { type: 'hug', label: 'Hug', icon: 'hug', activeColor: '#4338ca' },
  { type: 'love', label: 'Love', icon: 'love', activeColor: '#e11d48' },
  { type: 'strength', label: 'Strength', icon: 'strength', activeColor: '#047857' },
];

const MOODS = [
  'Grateful',
  'Peaceful',
  'Overwhelmed',
  'Tired but Happy',
  'Emotional',
  'Proud',
  'Seeking Advice',
];

export function SupportSpacePage({ initialTab = 'community' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getCurrentUser();

  // Navigation state
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedExperience, setSelectedExperience] = useState('all');
  const [myMomentsSubTab, setMyMomentsSubTab] = useState('created'); // 'created' | 'saved'

  // Data states
  const [feedPosts, setFeedPosts] = useState([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [feedError, setFeedError] = useState(null);

  const [babyLetters, setBabyLetters] = useState([]);
  const [isLoadingLetters, setIsLoadingLetters] = useState(false);

  const [familyCircle, setFamilyCircle] = useState({ members: [], active_invitations: [] });
  const [isLoadingFamily, setIsLoadingFamily] = useState(false);

  // Active open comment drawers: map postId -> { open: bool, comments: [], loading: bool, text: '' }
  const [commentsState, setCommentsState] = useState({});

  // Active post menu dropdown: postId | null
  const [activeMenuPostId, setActiveMenuPostId] = useState(null);

  // Modals
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [newInviteName, setNewInviteName] = useState('');
  const [newInviteRelation, setNewInviteRelation] = useState('Partner / Co-Parent');
  const [newInviteCanUpload, setNewInviteCanUpload] = useState(false);
  const [newInviteCanComment, setNewInviteCanComment] = useState(true);
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [inviteError, setInviteError] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);
  const [letterTitle, setLetterTitle] = useState('');
  const [letterDate, setLetterDate] = useState(new Date().toISOString().split('T')[0]);
  const [letterContent, setLetterContent] = useState('');
  const [letterPhotoUrl, setLetterPhotoUrl] = useState('');
  const [letterSharedWithFamily, setLetterSharedWithFamily] = useState(false);
  const [letterSubmitting, setLetterSubmitting] = useState(false);

  const [reportModalData, setReportModalData] = useState(null); // { postId, reason: '' }
  const [reportReason, setReportReason] = useState('Inappropriate content');
  const [reportDetails, setReportDetails] = useState('');

  // Create Moment Form State
  const [newAudience, setNewAudience] = useState('community'); // 'community' | 'family' | 'both'
  const [newExperience, setNewExperience] = useState('day_in_life');
  const [newCaption, setNewCaption] = useState('');
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMood, setNewMood] = useState('Grateful');
  const [newIsAnonymous, setNewIsAnonymous] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState('photo');
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [postSubmitSuccess, setPostSubmitSuccess] = useState(false);

  const fileInputRef = useRef(null);
  const letterFileInputRef = useRef(null);

  // Handle URL query or prop sync
  useEffect(() => {
    if (location.pathname.includes('/community')) {
      setActiveTab('community');
    }
  }, [location.pathname]);

  // Load feed when tab or experience filter changes
  useEffect(() => {
    if (activeTab === 'community' || activeTab === 'my_moments' || activeTab === 'family_circle') {
      loadFeed();
    }
    if (activeTab === 'letters') {
      loadLetters();
    }
    if (activeTab === 'family_circle') {
      loadFamilyCircle();
    }
  }, [activeTab, selectedExperience, myMomentsSubTab]);

  const loadFeed = async () => {
    setIsLoadingFeed(true);
    setFeedError(null);
    try {
      let queryTab = 'community';
      if (activeTab === 'family_circle') queryTab = 'family';
      else if (activeTab === 'my_moments') {
        queryTab = myMomentsSubTab === 'saved' ? 'saved' : 'my_moments';
      }

      const res = await fetchMomentsFeed({
        tab: queryTab,
        experienceType: selectedExperience,
        page: 1,
        pageSize: 30,
      });
      setFeedPosts(res.items || []);
    } catch (err) {
      console.error('Failed to load moments feed:', err);
      setFeedError(err.message || 'Unable to load moments at this time.');
    } finally {
      setIsLoadingFeed(false);
    }
  };

  const loadLetters = async () => {
    setIsLoadingLetters(true);
    try {
      const data = await fetchBabyLetters();
      setBabyLetters(data || []);
    } catch (err) {
      console.error('Failed to load letters:', err);
    } finally {
      setIsLoadingLetters(false);
    }
  };

  const loadFamilyCircle = async () => {
    setIsLoadingFamily(true);
    try {
      const data = await fetchFamilyCircle();
      setFamilyCircle(data);
    } catch (err) {
      console.error('Failed to load family circle:', err);
    } finally {
      setIsLoadingFamily(false);
    }
  };

  // --------------------------------------------------------------------------
  // Create Moment Logic
  // --------------------------------------------------------------------------
  const handleMediaSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaFile(file);
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
    if (file.type.startsWith('video/')) {
      setMediaType('video');
    } else {
      setMediaType('photo');
    }
  };

  const handleClearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newCaption.trim() && !mediaFile) return;

    setIsSubmittingPost(true);
    try {
      let uploadedUrl = null;
      if (mediaFile) {
        const uploadRes = await uploadMomentMedia(mediaFile);
        uploadedUrl = uploadRes.url;
      }

      const payload = {
        audience: newAudience,
        experience_type: newExperience,
        caption: newCaption.trim(),
        media_url: uploadedUrl,
        media_type: uploadedUrl ? mediaType : null,
        milestone_title: newExperience === 'milestone' ? newMilestoneTitle.trim() : null,
        mood: newMood,
        is_anonymous: newIsAnonymous,
      };

      await createPost(payload);
      setNewCaption('');
      setNewMilestoneTitle('');
      handleClearMedia();
      setPostSubmitSuccess(true);
      setTimeout(() => setPostSubmitSuccess(false), 4000);

      // Return to feed
      if (newAudience === 'family') {
        setActiveTab('family_circle');
      } else {
        setActiveTab('community');
      }
    } catch (err) {
      alert(`Error creating moment: ${err.message}`);
    } finally {
      setIsSubmittingPost(false);
    }
  };

  // --------------------------------------------------------------------------
  // Reactions & Comments
  // --------------------------------------------------------------------------
  const handleToggleReaction = async (postId, reactionType) => {
    try {
      // Optimistic update
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
      console.error('Failed to toggle reaction:', err);
    }
  };

  const handleToggleSave = async (postId) => {
    try {
      setFeedPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, is_saved: !p.is_saved } : p))
      );
      await toggleSaveMoment(postId);
    } catch (err) {
      console.error('Failed to toggle save:', err);
    }
  };

  const handleToggleCommentsDrawer = async (postId) => {
    setCommentsState((prev) => {
      const current = prev[postId] || { open: false, comments: [], loading: false, text: '' };
      return {
        ...prev,
        [postId]: { ...current, open: !current.open },
      };
    });

    if (!commentsState[postId]?.comments?.length) {
      setCommentsState((prev) => ({
        ...prev,
        [postId]: { ...(prev[postId] || {}), loading: true },
      }));
      try {
        const comments = await fetchComments(postId);
        setCommentsState((prev) => ({
          ...prev,
          [postId]: { ...(prev[postId] || {}), comments, loading: false },
        }));
      } catch (err) {
        setCommentsState((prev) => ({
          ...prev,
          [postId]: { ...(prev[postId] || {}), loading: false },
        }));
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

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this moment?')) return;
    try {
      await deletePost(postId);
      setFeedPosts((prev) => prev.filter((p) => p.id !== postId));
      setActiveMenuPostId(null);
    } catch (err) {
      alert(`Failed to delete moment: ${err.message}`);
    }
  };

  const handleBlockAuthor = async (authorUserId) => {
    if (!window.confirm("Block this user? You won't see their posts or comments.")) return;
    try {
      await blockUser(authorUserId);
      setFeedPosts((prev) => prev.filter((p) => p.author_user_id !== authorUserId));
      setActiveMenuPostId(null);
      alert('User blocked successfully.');
    } catch (err) {
      alert(`Failed to block user: ${err.message}`);
    }
  };

  const handleReportPost = async () => {
    if (!reportModalData) return;
    try {
      await reportMomentContent({
        post_id: reportModalData.postId,
        reason: reportReason,
        details: reportDetails,
      });
      alert('Report received. Our clinical moderation team has been notified.');
      setReportModalData(null);
      setReportDetails('');
    } catch (err) {
      alert(`Failed to submit report: ${err.message}`);
    }
  };

  // --------------------------------------------------------------------------
  // Family Circle Management
  // --------------------------------------------------------------------------
  const handleGenerateInvite = async (e) => {
    e.preventDefault();
    setInviteError(null);
    try {
      const result = await createFamilyInvitation({
        invitee_name: newInviteName.trim() || 'Family Caregiver',
        relationship: newInviteRelation,
        can_upload: newInviteCanUpload,
        can_comment: newInviteCanComment,
      });
      setGeneratedInvite(result);
      loadFamilyCircle();
    } catch (err) {
      setInviteError(err.message || 'Failed to generate invitation.');
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleRevokeInvitation = async (invitationId) => {
    if (!window.confirm('Revoke this invitation code? It will no longer be valid.')) return;
    try {
      await revokeFamilyInvitation(invitationId);
      loadFamilyCircle();
    } catch (err) {
      alert(`Failed to revoke invitation: ${err.message}`);
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (
      !window.confirm(
        `Remove ${memberName} from your Family Circle? Their access to family moments will be revoked immediately.`
      )
    ) {
      return;
    }
    try {
      await removeFamilyMember(memberId);
      loadFamilyCircle();
    } catch (err) {
      alert(`Failed to remove family member: ${err.message}`);
    }
  };

  const handleTogglePermission = async (memberId, currentPermissions, field) => {
    try {
      const updated = {
        can_upload: currentPermissions.can_upload,
        can_comment: currentPermissions.can_comment,
        [field]: !currentPermissions[field],
      };
      await updateFamilyMemberPermissions(memberId, updated);
      loadFamilyCircle();
    } catch (err) {
      alert(`Failed to update permissions: ${err.message}`);
    }
  };

  // --------------------------------------------------------------------------
  // Letters to My Baby
  // --------------------------------------------------------------------------
  const handleCreateLetter = async (e) => {
    e.preventDefault();
    if (!letterTitle.trim() || !letterContent.trim()) return;

    setLetterSubmitting(true);
    try {
      await createBabyLetter({
        title: letterTitle.trim(),
        letter_date: letterDate,
        content: letterContent.trim(),
        photo_url: letterPhotoUrl || null,
        shared_with_family: letterSharedWithFamily,
        is_draft: false,
      });
      setIsLetterModalOpen(false);
      setLetterTitle('');
      setLetterContent('');
      setLetterPhotoUrl('');
      setLetterSharedWithFamily(false);
      loadLetters();
    } catch (err) {
      alert(`Failed to save letter: ${err.message}`);
    } finally {
      setLetterSubmitting(false);
    }
  };

  const handleDeleteLetter = async (letterId) => {
    if (!window.confirm('Are you sure you want to delete this memory letter?')) return;
    try {
      await deleteBabyLetter(letterId);
      setBabyLetters((prev) => prev.filter((l) => l.id !== letterId));
    } catch (err) {
      alert(`Failed to delete letter: ${err.message}`);
    }
  };

  const handleDownloadLetterKeepsake = (letter) => {
    const printableWindow = window.open('', '_blank');
    if (!printableWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${letter.title} — Letter to My Baby</title>
        <style>
          body { font-family: 'Georgia', serif; padding: 40px; color: #271218; line-height: 1.8; max-width: 650px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #f0dfe2; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 26px; font-weight: bold; color: #9d174d; margin: 0 0 10px; }
          .date { font-size: 14px; color: #62555a; font-style: italic; }
          .content { font-size: 16px; white-space: pre-wrap; margin-bottom: 30px; }
          .footer { text-align: center; font-size: 12px; color: #8a7880; border-top: 1px solid #f0dfe2; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${letter.title}</div>
          <div class="date">${letter.letter_date}</div>
        </div>
        <div class="content">${letter.content}</div>
        <div class="footer">AANCHAL Moments Keepsake — Preserved with love</div>
      </body>
      </html>
    `;
    printableWindow.document.write(htmlContent);
    printableWindow.document.close();
    printableWindow.focus();
    setTimeout(() => {
      printableWindow.print();
    }, 500);
  };

  return (
    <div className="moments-container">
      {/* --------------------------------------------------------------------
         Hero Header & Tab Navigation
         -------------------------------------------------------------------- */}
      <section className="patient-card reports-hero-card moments-hero" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
          <div className="reports-hero-text">
            <div className="miora-dash-eyebrow">
              <span>SUPPORT SPACE &bull; AANCHAL MOMENTS</span>
              <span className="miora-dash-eyebrow-line" aria-hidden="true" />
            </div>
            <h1 className="miora-dash-title patient-page-heading reports-title">
              Private Motherhood <em>Community &amp; Family Circle</em>
            </h1>
            <p className="miora-dash-subtitle patient-page-subheading reports-subtitle">
              A gentle, supportive space designed exclusively for mothers to share real everyday milestones,
              uplift one another with emotional support, preserve digital memory letters, and maintain private
              family connections.
            </p>
          </div>

          <div className="reports-hero-illu-wrap" aria-hidden="true">
            <img
              src="/assets/mother-baby-header-crop.png"
              alt=""
              className="reports-hero-illustration"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        </div>

        <nav className="moments-tabs-nav" aria-label="Moments Sections" style={{ marginTop: 0 }}>
          <button
            type="button"
            className={`moments-tab-btn ${activeTab === 'community' ? 'active' : ''}`}
            onClick={() => setActiveTab('community')}
          >
            <PatientIcon name="community" size={16} />
            <span>Community Feed</span>
          </button>

          <button
            type="button"
            className={`moments-tab-btn ${activeTab === 'family_circle' ? 'active' : ''}`}
            onClick={() => setActiveTab('family_circle')}
          >
            <PatientIcon name="users" size={16} />
            <span>My Family Circle</span>
            {familyCircle?.members?.length > 0 && (
              <span className="badge-count">{familyCircle.members.length}</span>
            )}
          </button>

          <button
            type="button"
            className={`moments-tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            <PatientIcon name="plus" size={16} />
            <span>Create a Moment</span>
          </button>

          <button
            type="button"
            className={`moments-tab-btn ${activeTab === 'my_moments' ? 'active' : ''}`}
            onClick={() => setActiveTab('my_moments')}
          >
            <PatientIcon name="folder" size={16} />
            <span>My Moments</span>
          </button>

          <button
            type="button"
            className={`moments-tab-btn ${activeTab === 'letters' ? 'active' : ''}`}
            onClick={() => setActiveTab('letters')}
          >
            <PatientIcon name="mail" size={16} />
            <span>Letters to My Baby</span>
            {babyLetters.length > 0 && (
              <span className="badge-count">{babyLetters.length}</span>
            )}
          </button>
        </nav>
      </section>

      {/* --------------------------------------------------------------------
         TAB 1 & TAB 4: Community Feed / My Moments
         -------------------------------------------------------------------- */}
      {(activeTab === 'community' || activeTab === 'my_moments') && (
        <div>
          {/* Sub-bar for My Moments: Created vs Saved */}
          {activeTab === 'my_moments' && (
            <div className="moments-chips-group" style={{ marginBottom: '1.25rem' }}>
              <button
                type="button"
                className={`moments-chip ${myMomentsSubTab === 'created' ? 'active' : ''}`}
                onClick={() => setMyMomentsSubTab('created')}
              >
                <PatientIcon name="file-text" size={14} />
                <span>My Shared Moments</span>
              </button>
              <button
                type="button"
                className={`moments-chip ${myMomentsSubTab === 'saved' ? 'active' : ''}`}
                onClick={() => setMyMomentsSubTab('saved')}
              >
                <PatientIcon name="bookmark" size={14} />
                <span>Saved Bookmarks</span>
              </button>
            </div>
          )}

          {/* Experience Filter Chips */}
          <div className="moments-filters-bar">
            <div className="moments-chips-group">
              {EXPERIENCES.map((exp) => (
                <button
                  key={exp.id}
                  type="button"
                  className={`moments-chip ${selectedExperience === exp.id ? 'active' : ''}`}
                  onClick={() => setSelectedExperience(exp.id)}
                >
                  <PatientIcon name={exp.icon} size={14} />
                  <span>{exp.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="moments-btn-primary"
              onClick={() => setActiveTab('create')}
            >
              <PatientIcon name="plus" size={16} />
              <span>Share a Moment</span>
            </button>
          </div>

          {/* Loading / Error States */}
          {isLoadingFeed && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--patient-muted)' }}>
              <PatientIcon name="sparkles" size={24} className="spin-slow" />
              <p style={{ marginTop: '0.75rem', fontSize: '0.92rem' }}>Loading moments from mothers...</p>
            </div>
          )}

          {feedError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                padding: '1.25rem',
                color: '#991b1b',
                marginBottom: '1.5rem',
              }}
            >
              <p style={{ margin: 0 }}>{feedError}</p>
            </div>
          )}

          {!isLoadingFeed && feedPosts.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid var(--patient-blush-border)',
              }}
            >
              <PatientIcon name="heart" size={36} color="var(--patient-brand-rose)" />
              <h3
                style={{
                  fontFamily: 'var(--patient-font-serif)',
                  fontSize: '1.35rem',
                  marginTop: '1rem',
                  marginBottom: '0.5rem',
                }}
              >
                No moments shared here yet
              </h3>
              <p style={{ color: 'var(--patient-ink-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                Be the first to share an authentic motherhood experience, a daily reflection, or a baby milestone.
              </p>
              <button
                type="button"
                className="moments-btn-primary"
                onClick={() => setActiveTab('create')}
              >
                <PatientIcon name="plus" size={16} />
                <span>Create the First Moment</span>
              </button>
            </div>
          )}

          {/* Post Feed List */}
          <div className="moments-feed">
            {feedPosts.map((post) => {
              const isAuthor = currentUser?.id && post.author_user_id === currentUser.id;
              const commentsData = commentsState[post.id] || { open: false, comments: [], text: '' };

              return (
                <article key={post.id} className="moment-card">
                  {/* Card Header */}
                  <div className="moment-card-header">
                    <div className="moment-author-info">
                      <div className="moment-avatar">
                        {post.author_avatar && /^(https?:\/\/|data:|\/)/i.test(post.author_avatar) ? (
                          <img
                            src={post.author_avatar}
                            alt=""
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span>
                            {post.is_anonymous
                              ? 'A'
                              : (post.author_avatar || (post.display_author || 'M').charAt(0).toUpperCase())}
                          </span>
                        )}
                      </div>
                      <div className="moment-author-meta">
                        <div className="moment-author-name">
                          <span>{post.display_author}</span>
                          {post.is_anonymous ? (
                            <span className="moment-author-badge anonymous">
                              <PatientIcon name="shield-check" size={10} /> Anonymous Mother
                            </span>
                          ) : (
                            <span className="moment-author-badge mother">Mother</span>
                          )}
                        </div>
                        <div className="moment-timestamp-row">
                          <span>{new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          <span>•</span>
                          <span className={`moment-audience-pill ${post.audience}`}>
                            {post.audience === 'family' ? (
                              <>
                                <PatientIcon name="lock" size={10} /> Family Circle
                              </>
                            ) : post.audience === 'both' ? (
                              <>
                                <PatientIcon name="users" size={10} /> Community & Family
                              </>
                            ) : (
                              <>
                                <PatientIcon name="sparkles" size={10} /> Mother Community
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="moment-actions-menu">
                      <button
                        type="button"
                        className="moment-menu-btn"
                        onClick={() =>
                          setActiveMenuPostId(activeMenuPostId === post.id ? null : post.id)
                        }
                        aria-label="More options"
                      >
                        <PatientIcon name="more-vertical" size={16} />
                      </button>

                      {activeMenuPostId === post.id && (
                        <div className="moment-dropdown">
                          <button
                            type="button"
                            className="moment-dropdown-item"
                            onClick={() => {
                              handleToggleSave(post.id);
                              setActiveMenuPostId(null);
                            }}
                          >
                            <PatientIcon name={post.is_saved ? 'bookmark-filled' : 'bookmark'} size={14} />
                            <span>{post.is_saved ? 'Remove Bookmark' : 'Save Moment'}</span>
                          </button>

                          {!isAuthor && !post.is_anonymous && (
                            <button
                              type="button"
                              className="moment-dropdown-item"
                              onClick={() => handleBlockAuthor(post.author_user_id)}
                            >
                              <PatientIcon name="close" size={14} />
                              <span>Block User</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="moment-dropdown-item"
                            onClick={() => {
                              setReportModalData({ postId: post.id });
                              setActiveMenuPostId(null);
                            }}
                          >
                            <PatientIcon name="flag" size={14} />
                            <span>Report Post</span>
                          </button>

                          {isAuthor && (
                            <button
                              type="button"
                              className="moment-dropdown-item danger"
                              onClick={() => handleDeletePost(post.id)}
                            >
                              <PatientIcon name="trash" size={14} />
                              <span>Delete Moment</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Post Content */}
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
                          <img
                            src={post.media_url}
                            alt="Shared moment"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                    )}

                    {post.mood && (
                      <div className="moment-mood-tag">
                        <PatientIcon name="heart" size={12} />
                        <span>Feeling {post.mood}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions & Reactions Bar */}
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
                            title={`React with ${r.label}`}
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

                    <div className="moment-secondary-actions">
                      <button
                        type="button"
                        className={`action-icon-btn ${commentsData.open ? 'active' : ''}`}
                        onClick={() => handleToggleCommentsDrawer(post.id)}
                      >
                        <PatientIcon name="message-square" size={14} />
                        <span>{post.comments_count || 0} Comments</span>
                      </button>

                      <button
                        type="button"
                        className={`action-icon-btn ${post.is_saved ? 'active' : ''}`}
                        onClick={() => handleToggleSave(post.id)}
                        title="Bookmark this moment"
                      >
                        <PatientIcon
                          name={post.is_saved ? 'bookmark-filled' : 'bookmark'}
                          size={14}
                          color={post.is_saved ? 'var(--patient-brand-rose)' : 'currentColor'}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Comments Thread Drawer */}
                  {commentsData.open && (
                    <div className="moment-comments-section">
                      {/* Comment Composer */}
                      <div className="moment-comment-composer">
                        <input
                          type="text"
                          className="comment-input-box"
                          placeholder="Write a supportive, loving comment..."
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

                      {/* Comments List */}
                      {commentsData.loading ? (
                        <p style={{ fontSize: '0.82rem', color: 'var(--patient-muted)' }}>
                          Loading comments...
                        </p>
                      ) : commentsData.comments?.length === 0 ? (
                        <p style={{ fontSize: '0.82rem', color: 'var(--patient-muted)', fontStyle: 'italic' }}>
                          No comments yet. Be the first to leave words of encouragement!
                        </p>
                      ) : (
                        <div className="moment-comments-list">
                          {commentsData.comments.map((comment) => (
                            <div key={comment.id} className="moment-comment-item">
                              <div className="comment-avatar">
                                {comment.author_role === 'family' ? 'F' : 'M'}
                              </div>
                              <div className="comment-bubble">
                                <div className="comment-author-row">
                                  <span className="comment-author-name">
                                    {comment.display_author}
                                    {comment.relationship_label && (
                                      <span className="comment-role-tag" style={{ background: '#eff6ff', color: '#1e40af' }}>
                                        {comment.relationship_label}
                                      </span>
                                    )}
                                  </span>
                                  <span className="comment-time">
                                    {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="comment-text">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
         TAB 2: My Family Circle
         -------------------------------------------------------------------- */}
      {activeTab === 'family_circle' && (
        <div>
          {/* Family Header & Invite Button */}
          <div className="moments-filters-bar">
            <div>
              <h2
                style={{
                  fontFamily: 'var(--patient-font-serif)',
                  fontSize: '1.4rem',
                  margin: '0 0 0.25rem',
                }}
              >
                My Family Circle
              </h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--patient-ink-secondary)', margin: 0 }}>
                A private, invite-only sanctuary for your partner, parents, and closest caregivers.
              </p>
            </div>

            <button
              type="button"
              className="moments-btn-primary"
              onClick={() => {
                setGeneratedInvite(null);
                setIsInviteModalOpen(true);
              }}
            >
              <PatientIcon name="plus" size={16} />
              <span>Invite Family Member</span>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="family-circle-stats">
            <div className="family-stat-card">
              <div className="family-stat-icon">
                <PatientIcon name="users" size={20} />
              </div>
              <div>
                <div className="family-stat-num">{familyCircle.members?.length || 0}</div>
                <div className="family-stat-label">Active Family Members</div>
              </div>
            </div>

            <div className="family-stat-card">
              <div className="family-stat-icon">
                <PatientIcon name="mail" size={20} />
              </div>
              <div>
                <div className="family-stat-num">{familyCircle.active_invitations?.length || 0}</div>
                <div className="family-stat-label">Pending Invitations</div>
              </div>
            </div>

            <div className="family-stat-card">
              <div className="family-stat-icon">
                <PatientIcon name="lock" size={20} />
              </div>
              <div>
                <div className="family-stat-num" style={{ fontSize: '1rem', color: '#047857' }}>
                  Private & Isolated
                </div>
                <div className="family-stat-label">Zero Clinical Data Shared</div>
              </div>
            </div>
          </div>

          {/* Active Family Members Grid */}
          <h3
            style={{
              fontFamily: 'var(--patient-font-serif)',
              fontSize: '1.2rem',
              marginBottom: '1rem',
            }}
          >
            Connected Family Members
          </h3>

          {familyCircle.members?.length === 0 ? (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid var(--patient-blush-border)',
                borderRadius: '14px',
                padding: '2.5rem',
                textAlign: 'center',
                marginBottom: '2rem',
              }}
            >
              <PatientIcon name="users" size={32} color="var(--patient-brand-rose)" />
              <h4 style={{ margin: '0.75rem 0 0.35rem' }}>No family members connected yet</h4>
              <p style={{ color: 'var(--patient-muted)', fontSize: '0.88rem', margin: '0 0 1.25rem' }}>
                Generate a secure single-use invitation code to invite your partner or caregiver.
              </p>
              <button
                type="button"
                className="moments-btn-primary"
                onClick={() => {
                  setGeneratedInvite(null);
                  setIsInviteModalOpen(true);
                }}
              >
                <PatientIcon name="plus" size={16} />
                <span>Invite Family Member</span>
              </button>
            </div>
          ) : (
            <div className="family-members-grid">
              {familyCircle.members.map((member) => (
                <div key={member.id} className="family-member-card">
                  <div className="member-header">
                    <div className="moment-avatar">
                      <span>{(member.user_name || 'F').charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <div className="member-name">{member.user_name}</div>
                      <div className="member-relation">{member.relationship}</div>
                    </div>
                  </div>

                  <div className="member-permissions">
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#9d174d', marginBottom: '0.25rem' }}>
                      Mother-Controlled Permissions
                    </div>

                    <label className="perm-toggle-row">
                      <span>Allow posting family moments</span>
                      <input
                        type="checkbox"
                        checked={member.can_upload}
                        onChange={() => handleTogglePermission(member.id, member, 'can_upload')}
                      />
                    </label>

                    <label className="perm-toggle-row">
                      <span>Allow commenting & reactions</span>
                      <input
                        type="checkbox"
                        checked={member.can_comment}
                        onChange={() => handleTogglePermission(member.id, member, 'can_comment')}
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    style={{
                      width: '100%',
                      padding: '0.45rem',
                      background: 'transparent',
                      color: '#b91c1c',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    onClick={() => handleRemoveMember(member.id, member.user_name)}
                  >
                    Remove from Family Circle
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pending Invitations Section */}
          {familyCircle.active_invitations?.length > 0 && (
            <div style={{ marginBottom: '2.5rem' }}>
              <h3
                style={{
                  fontFamily: 'var(--patient-font-serif)',
                  fontSize: '1.2rem',
                  marginBottom: '1rem',
                }}
              >
                Active Single-Use Invitation Codes
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {familyCircle.active_invitations.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--patient-blush-border)',
                      borderRadius: '12px',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                        {inv.invitee_name || 'Caregiver'} ({inv.relationship})
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--patient-muted)', marginTop: '0.2rem' }}>
                        Code preview: <code>{inv.invitation_code_preview}</code> • Expires:{' '}
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </div>
                    </div>

                    <button
                      type="button"
                      style={{
                        padding: '0.35rem 0.75rem',
                        background: '#fef2f2',
                        color: '#b91c1c',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      onClick={() => handleRevokeInvitation(inv.id)}
                    >
                      Revoke Code
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Family Circle Moments Feed */}
          <h3
            style={{
              fontFamily: 'var(--patient-font-serif)',
              fontSize: '1.2rem',
              marginBottom: '1rem',
            }}
          >
            Moments Shared with Family
          </h3>
          <div className="moments-feed">
            {feedPosts.filter((p) => p.audience === 'family' || p.audience === 'both').length === 0 ? (
              <p style={{ color: 'var(--patient-muted)', fontStyle: 'italic' }}>
                No moments currently shared with your Family Circle. Use "Create a Moment" to share with your family!
              </p>
            ) : (
              feedPosts
                .filter((p) => p.audience === 'family' || p.audience === 'both')
                .map((post) => (
                  <article key={post.id} className="moment-card">
                    <div className="moment-card-header">
                      <div className="moment-author-info">
                        <div className="moment-avatar">
                          <span>{(post.display_author || 'M').charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="moment-author-meta">
                          <div className="moment-author-name">{post.display_author}</div>
                          <div className="moment-timestamp-row">
                            <span>{new Date(post.created_at).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className="moment-audience-pill family">Family Circle</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="moment-content">
                      <p className="moment-caption">{post.caption}</p>
                      {post.media_url && (
                        <div className="moment-media-wrapper">
                          <img src={post.media_url} alt="" />
                        </div>
                      )}
                    </div>
                  </article>
                ))
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
         TAB 3: Create a Moment Composer
         -------------------------------------------------------------------- */}
      {activeTab === 'create' && (
        <div className="moment-composer-card">
          <h2 className="composer-section-title">Create a New Moment</h2>
          <p className="composer-section-desc">
            Share your everyday motherhood journey, celebrate small wins, or ask for peer support.
          </p>

          {postSubmitSuccess && (
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                color: '#065f46',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <PatientIcon name="check" size={16} />
              <span>Your moment has been shared successfully!</span>
            </div>
          )}

          <form onSubmit={handleCreatePost}>
            {/* Step 1: Explicit Audience Selector */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                1. Choose Who Can See This Moment
              </label>
              <div className="audience-selector-grid">
                <div
                  className={`audience-card ${newAudience === 'community' ? 'active' : ''}`}
                  onClick={() => setNewAudience('community')}
                >
                  <div className="audience-card-header">
                    <span className="audience-card-title">Mother Community</span>
                    <PatientIcon name="sparkles" size={16} color="var(--patient-brand-rose)" />
                  </div>
                  <span className="audience-card-desc">
                    Visible to all verified mothers using AANCHAL. Ideal for peer support and shared experiences.
                  </span>
                </div>

                <div
                  className={`audience-card ${newAudience === 'family' ? 'active' : ''}`}
                  onClick={() => setNewAudience('family')}
                >
                  <div className="audience-card-header">
                    <span className="audience-card-title">My Family Circle</span>
                    <PatientIcon name="lock" size={16} color="#047857" />
                  </div>
                  <span className="audience-card-desc">
                    Exclusively shared with your linked family members. Completely hidden from public community.
                  </span>
                </div>

                <div
                  className={`audience-card ${newAudience === 'both' ? 'active' : ''}`}
                  onClick={() => setNewAudience('both')}
                >
                  <div className="audience-card-header">
                    <span className="audience-card-title">Both Community & Family</span>
                    <PatientIcon name="users" size={16} color="#5b21b6" />
                  </div>
                  <span className="audience-card-desc">
                    Shared with mothers in the community feed AND visible inside your private Family Circle.
                  </span>
                </div>
              </div>
            </div>

            {/* Step 2: Experience Selector */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                2. Select Moment Experience
              </label>
              <div className="experience-type-pills">
                <button
                  type="button"
                  className={`experience-pill ${newExperience === 'day_in_life' ? 'active' : ''}`}
                  onClick={() => setNewExperience('day_in_life')}
                >
                  <PatientIcon name="calendar" size={14} />
                  <span>A Day in My Life</span>
                </button>

                <button
                  type="button"
                  className={`experience-pill ${newExperience === 'support_circle' ? 'active' : ''}`}
                  onClick={() => setNewExperience('support_circle')}
                >
                  <PatientIcon name="hug" size={14} />
                  <span>Support Circle</span>
                </button>

                <button
                  type="button"
                  className={`experience-pill ${newExperience === 'milestone' ? 'active' : ''}`}
                  onClick={() => setNewExperience('milestone')}
                >
                  <PatientIcon name="cheer" size={14} />
                  <span>Baby Milestone</span>
                </button>

                <button
                  type="button"
                  className={`experience-pill ${newExperience === 'general' ? 'active' : ''}`}
                  onClick={() => setNewExperience('general')}
                >
                  <PatientIcon name="flower" size={14} />
                  <span>General Reflection</span>
                </button>
              </div>
            </div>

            {/* Milestone Title (if selected) */}
            {newExperience === 'milestone' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Milestone Title
                </label>
                <input
                  type="text"
                  className="comment-input-box"
                  style={{ width: '100%', borderRadius: '10px' }}
                  placeholder="e.g. Baby's First Belly Laugh, Slept 5 Hours Straight"
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Step 3: Caption / Story */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                3. Your Words & Thoughts
              </label>
              <textarea
                className="composer-textarea"
                placeholder={
                  newExperience === 'support_circle'
                    ? 'Ask a question, share emotional vulnerability, or seek advice from fellow mothers...'
                    : 'Describe your day, your feelings, or this special moment...'
                }
                value={newCaption}
                onChange={(e) => setNewCaption(e.target.value)}
                required
              />
            </div>

            {/* Step 4: Photo / Video Attachment */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                4. Photograph or Video (Optional)
              </label>

              {mediaPreview ? (
                <div className="media-preview-container">
                  {mediaType === 'video' ? (
                    <video src={mediaPreview} controls />
                  ) : (
                    <img src={mediaPreview} alt="Preview" />
                  )}
                  <button
                    type="button"
                    className="media-remove-btn"
                    onClick={handleClearMedia}
                    title="Remove attachment"
                  >
                    <PatientIcon name="close" size={14} />
                  </button>
                </div>
              ) : (
                <div
                  className="media-upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <PatientIcon name="photo" size={28} color="var(--patient-brand-rose)" />
                  <p style={{ margin: '0.5rem 0 0.2rem', fontSize: '0.9rem', fontWeight: 600 }}>
                    Click to attach photo or video
                  </p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--patient-muted)' }}>
                    JPG, PNG, WebP, MP4 up to 25 MB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    style={{ display: 'none' }}
                    onChange={handleMediaSelect}
                  />
                </div>
              )}
            </div>

            {/* Step 5: Mood & Controls */}
            <div className="composer-controls-row" style={{ marginBottom: '1.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  How are you feeling right now?
                </label>
                <select
                  value={newMood}
                  onChange={(e) => setNewMood(e.target.value)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--patient-blush-border)',
                    fontSize: '0.85rem',
                    background: '#fff',
                    color: 'var(--patient-ink)',
                  }}
                >
                  {MOODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {newAudience !== 'family' && (
                <label className="composer-anon-toggle">
                  <input
                    type="checkbox"
                    checked={newIsAnonymous}
                    onChange={(e) => setNewIsAnonymous(e.target.checked)}
                  />
                  <span>Post anonymously to Mother Community</span>
                </label>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="moments-btn-primary"
              disabled={isSubmittingPost || (!newCaption.trim() && !mediaFile)}
              style={{ padding: '0.75rem 2rem', fontSize: '0.96rem' }}
            >
              <PatientIcon name="send" size={16} />
              <span>{isSubmittingPost ? 'Sharing Moment...' : 'Share Moment'}</span>
            </button>
          </form>
        </div>
      )}

      {/* --------------------------------------------------------------------
         TAB 5: Letters to My Baby (Memory Journal)
         -------------------------------------------------------------------- */}
      {activeTab === 'letters' && (
        <div>
          <div className="letters-section-header">
            <div>
              <h2
                style={{
                  fontFamily: 'var(--patient-font-serif)',
                  fontSize: '1.4rem',
                  margin: '0 0 0.25rem',
                }}
              >
                Letters to My Baby
              </h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--patient-ink-secondary)', margin: 0 }}>
                A private, timeless memory journal of heartfelt digital letters written to your child.
              </p>
            </div>

            <button
              type="button"
              className="moments-btn-primary"
              onClick={() => setIsLetterModalOpen(true)}
            >
              <PatientIcon name="pencil" size={16} />
              <span>Write a New Letter</span>
            </button>
          </div>

          <div className="letters-intro-card">
            <PatientIcon name="mail" size={24} color="#9a3412" />
            <div className="letters-intro-content">
              <h4>Strictly Private Digital Keepsake</h4>
              <p>
                Every letter you write here is strictly private to you by default. Letters are preserved in your
                account and can be printed or exported as a keepsake. You may also explicitly choose to share
                individual letters with your Family Circle.
              </p>
            </div>
          </div>

          {isLoadingLetters ? (
            <p style={{ textAlign: 'center', color: 'var(--patient-muted)' }}>Loading letters...</p>
          ) : babyLetters.length === 0 ? (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid var(--patient-blush-border)',
                borderRadius: '16px',
                padding: '3.5rem 2rem',
                textAlign: 'center',
              }}
            >
              <PatientIcon name="mail" size={36} color="var(--patient-brand-rose)" />
              <h3 style={{ fontFamily: 'var(--patient-font-serif)', margin: '1rem 0 0.5rem' }}>
                Your baby journal is waiting for its first entry
              </h3>
              <p style={{ color: 'var(--patient-muted)', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                Write your first letter capturing your love, hopes, and memories from today.
              </p>
              <button
                type="button"
                className="moments-btn-primary"
                onClick={() => setIsLetterModalOpen(true)}
              >
                <PatientIcon name="pencil" size={16} />
                <span>Write First Letter</span>
              </button>
            </div>
          ) : (
            <div className="letters-timeline">
              {babyLetters.map((letter) => (
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

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="action-icon-btn"
                        onClick={() => handleDownloadLetterKeepsake(letter)}
                        title="Download or Print Keepsake"
                      >
                        <PatientIcon name="download" size={14} />
                        <span>Print Keepsake</span>
                      </button>

                      <button
                        type="button"
                        className="action-icon-btn"
                        style={{ color: '#b91c1c' }}
                        onClick={() => handleDeleteLetter(letter.id)}
                        title="Delete letter"
                      >
                        <PatientIcon name="trash" size={14} />
                      </button>
                    </div>
                  </div>

                  <p className="letter-body">{letter.content}</p>

                  {letter.photo_url && (
                    <div style={{ maxWidth: '300px', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.25rem' }}>
                      <img src={letter.photo_url} alt="" style={{ width: '100%', display: 'block' }} />
                    </div>
                  )}

                  <div className="letter-footer">
                    <span
                      className={`letter-privacy-indicator ${letter.shared_with_family ? 'shared' : ''
                        }`}
                    >
                      <PatientIcon
                        name={letter.shared_with_family ? 'users' : 'lock'}
                        size={12}
                      />
                      <span>
                        {letter.shared_with_family
                          ? 'Shared with Family Circle'
                          : 'Private (Only you can see this)'}
                      </span>
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------
         MODAL 1: Invite Family Member
         -------------------------------------------------------------------- */}
      {isInviteModalOpen && (
        <div className="moments-modal-backdrop">
          <div className="moments-modal-window">
            <div className="modal-header">
              <h3>Invite Family Member</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsInviteModalOpen(false)}
              >
                <PatientIcon name="close" size={16} />
              </button>
            </div>

            {generatedInvite ? (
              <div>
                <div
                  style={{
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: '10px',
                    padding: '0.85rem 1rem',
                    color: '#065f46',
                    fontSize: '0.88rem',
                    marginBottom: '1rem',
                  }}
                >
                  Invitation generated for <strong>{generatedInvite.invitee_name}</strong>!
                </div>

                <div className="invitation-code-box">
                  <div style={{ fontSize: '0.8rem', color: 'var(--patient-muted)' }}>
                    Share this secure code with your family member:
                  </div>
                  <div className="invitation-code-display">{generatedInvite.invitation_code}</div>
                  <button
                    type="button"
                    className="moments-btn-primary"
                    style={{ margin: '0.5rem auto 0' }}
                    onClick={() => handleCopyCode(generatedInvite.invitation_code)}
                  >
                    <PatientIcon name={copiedCode ? 'check' : 'copy'} size={14} />
                    <span>{copiedCode ? 'Copied to Clipboard!' : 'Copy Code'}</span>
                  </button>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--patient-muted)', lineHeight: 1.5 }}>
                  • Valid for <strong>7 days</strong>.
                  <br />
                  • Single-use only: deactivated immediately after being linked.
                  <br />• Your family member will enter this code in their AANCHAL Family Portal.
                </p>

                <button
                  type="button"
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    background: 'var(--patient-surface-subtle)',
                    border: '1px solid var(--patient-blush-border)',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '1rem',
                  }}
                  onClick={() => setIsInviteModalOpen(false)}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleGenerateInvite}>
                {inviteError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      color: '#991b1b',
                      fontSize: '0.84rem',
                      marginBottom: '1rem',
                    }}
                  >
                    {inviteError}
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Family Member Name
                  </label>
                  <input
                    type="text"
                    className="comment-input-box"
                    style={{ width: '100%', borderRadius: '8px' }}
                    placeholder="e.g. Rahul, Meena, Grandmom Anita"
                    value={newInviteName}
                    onChange={(e) => setNewInviteName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Relationship
                  </label>
                  <select
                    value={newInviteRelation}
                    onChange={(e) => setNewInviteRelation(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid var(--patient-blush-border)',
                      fontSize: '0.88rem',
                    }}
                  >
                    <option value="Partner / Co-Parent">Partner / Co-Parent</option>
                    <option value="Grandmother / Grandfather">Grandmother / Grandfather</option>
                    <option value="Sister / Aunt">Sister / Aunt</option>
                    <option value="Family Caregiver">Family Caregiver</option>
                  </select>
                </div>

                <div
                  style={{
                    background: 'var(--patient-surface-subtle)',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9d174d' }}>
                    Initial Permissions
                  </div>
                  <label className="perm-toggle-row">
                    <span>Allow uploading moments</span>
                    <input
                      type="checkbox"
                      checked={newInviteCanUpload}
                      onChange={(e) => setNewInviteCanUpload(e.target.checked)}
                    />
                  </label>
                  <label className="perm-toggle-row">
                    <span>Allow commenting & reacting</span>
                    <input
                      type="checkbox"
                      checked={newInviteCanComment}
                      onChange={(e) => setNewInviteCanComment(e.target.checked)}
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  className="moments-btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <PatientIcon name="sparkles" size={16} />
                  <span>Generate Single-Use Code</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
         MODAL 2: Write Letter to Baby
         -------------------------------------------------------------------- */}
      {isLetterModalOpen && (
        <div className="moments-modal-backdrop">
          <div className="moments-modal-window">
            <div className="modal-header">
              <h3>Write a Letter to Your Baby</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsLetterModalOpen(false)}
              >
                <PatientIcon name="close" size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateLetter}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Letter Title
                </label>
                <input
                  type="text"
                  className="comment-input-box"
                  style={{ width: '100%', borderRadius: '8px' }}
                  placeholder="e.g. When You Smiled for the First Time"
                  value={letterTitle}
                  onChange={(e) => setLetterTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Date of Letter
                </label>
                <input
                  type="date"
                  className="comment-input-box"
                  style={{ width: '100%', borderRadius: '8px' }}
                  value={letterDate}
                  onChange={(e) => setLetterDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Your Words to Your Baby
                </label>
                <textarea
                  className="composer-textarea"
                  style={{ minHeight: '180px', fontStyle: 'italic' }}
                  placeholder="Dear baby, today you looked into my eyes and..."
                  value={letterContent}
                  onChange={(e) => setLetterContent(e.target.value)}
                  required
                />
              </div>

              <div
                style={{
                  background: 'var(--patient-surface-subtle)',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  marginBottom: '1.25rem',
                }}
              >
                <label className="perm-toggle-row">
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>Share with Family Circle</span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--patient-muted)' }}>
                      Strictly private to you if unchecked
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={letterSharedWithFamily}
                    onChange={(e) => setLetterSharedWithFamily(e.target.checked)}
                  />
                </label>
              </div>

              <button
                type="submit"
                className="moments-btn-primary"
                disabled={letterSubmitting}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <PatientIcon name="heart" size={16} />
                <span>{letterSubmitting ? 'Preserving Letter...' : 'Save to Memory Journal'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
         MODAL 3: Report Content
         -------------------------------------------------------------------- */}
      {reportModalData && (
        <div className="moments-modal-backdrop">
          <div className="moments-modal-window">
            <div className="modal-header">
              <h3>Report Content</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setReportModalData(null)}
              >
                <PatientIcon name="close" size={16} />
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Reason for Reporting
              </label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: '8px',
                  border: '1px solid var(--patient-blush-border)',
                  fontSize: '0.88rem',
                }}
              >
                <option value="Inappropriate content">Inappropriate or offensive content</option>
                <option value="Harassment or hostility">Harassment or lack of supportive tone</option>
                <option value="Self-harm / Crisis concern">Distress or crisis concern</option>
                <option value="Medical misinformation">Unverified medical advice</option>
                <option value="Spam / Commercial">Spam or commercial promotion</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Additional Details (Optional)
              </label>
              <textarea
                className="comment-input-box"
                style={{ width: '100%', borderRadius: '8px', minHeight: '80px' }}
                placeholder="Help our moderation team understand the context..."
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="moments-btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleReportPost}
            >
              <span>Submit Report for Clinical Review</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SupportSpacePage;
