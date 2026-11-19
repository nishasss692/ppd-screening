/**
 * MIORA / AANCHAL AI Anonymous Mother's Community API Service
 * Handles communication with /api/community FastAPI endpoints.
 *
 * Guarantees zero author PII serialization and uses Bearer token authorization.
 */

import { getAuthToken } from '../../auth/authService.js';

function getApiBase() {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return '';
}

function getHeaders(extraHeaders = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extraHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch approved community posts feed.
 */
export async function fetchCommunityFeed({ category = null, sort = 'newest', page = 1, pageSize = 10 } = {}) {
  const params = new URLSearchParams();
  if (category && category !== 'All') {
    params.append('category', category);
  }
  if (sort) {
    params.append('sort', sort);
  }
  params.append('page', String(page));
  params.append('page_size', String(pageSize));

  const url = `${getApiBase()}/api/community/posts?${params.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch community feed`);
  }

  return response.json();
}

/**
 * Fetch single post with full comment thread.
 */
export async function fetchPostDetail(postId) {
  const url = `${getApiBase()}/api/community/posts/${postId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch post detail`);
  }

  return response.json();
}

/**
 * Publish an anonymous post.
 */
export async function createCommunityPost({ content, category, mood = null, display_author = 'Anonymous Mother' }) {
  const url = `${getApiBase()}/api/community/posts`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      content,
      category,
      mood,
      display_author,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to publish community post`);
  }

  return response.json();
}

/**
 * Edit an existing post (author only).
 */
export async function updateCommunityPost(postId, { content, category = null, mood = null }) {
  const url = `${getApiBase()}/api/community/posts/${postId}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({
      content,
      category,
      mood,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to update post`);
  }

  return response.json();
}

/**
 * Delete a post (author or moderator only).
 */
export async function deleteCommunityPost(postId) {
  const url = `${getApiBase()}/api/community/posts/${postId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to delete post`);
  }

  return response.json();
}

/**
 * Fetch comments for a post.
 */
export async function fetchPostComments(postId) {
  const url = `${getApiBase()}/api/community/posts/${postId}/comments`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch comments`);
  }

  return response.json();
}

/**
 * Add an anonymous comment.
 */
export async function addPostComment(postId, content) {
  const url = `${getApiBase()}/api/community/posts/${postId}/comments`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to add comment`);
  }

  return response.json();
}

/**
 * Edit an anonymous comment (author only).
 */
export async function updateComment(commentId, content) {
  const url = `${getApiBase()}/api/community/comments/${commentId}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to edit comment`);
  }

  return response.json();
}

/**
 * Delete an anonymous comment (author or moderator only).
 */
export async function deleteComment(commentId) {
  const url = `${getApiBase()}/api/community/comments/${commentId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to delete comment`);
  }

  return response.json();
}

/**
 * Toggle a supportive reaction on a post.
 * reactionType: 'sending_love' | 'i_understand' | 'youre_not_alone' | 'sending_strength'
 */
export async function togglePostReaction(postId, reactionType) {
  const url = `${getApiBase()}/api/community/posts/${postId}/reactions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ reaction_type: reactionType }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to toggle reaction`);
  }

  return response.json();
}

/**
 * Report inappropriate post or comment for clinical moderation.
 */
export async function reportContent({ postId = null, commentId = null, reason, details = null }) {
  const url = `${getApiBase()}/api/community/reports`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      post_id: postId,
      comment_id: commentId,
      reason,
      details,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to submit report`);
  }

  return response.json();
}

/**
 * Fetch moderation queue for clinicians / admins.
 */
export async function fetchModerationQueue() {
  const url = `${getApiBase()}/api/community/moderation/queue`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch moderation queue`);
  }

  return response.json();
}

/**
 * Apply moderation action (hide, remove, approve, safeguard_escalate).
 */
export async function applyModerationAction({ targetType, targetId, action, reason }) {
  const url = `${getApiBase()}/api/community/moderation/action`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      target_type: targetType,
      target_id: targetId,
      action,
      reason,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to execute moderation action`);
  }

  return response.json();
}
