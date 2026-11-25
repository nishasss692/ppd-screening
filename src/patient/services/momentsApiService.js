/**
 * AANCHAL Moments API Service
 * Handles communication with /api/moments FastAPI endpoints.
 *
 * Implements:
 * - Feed queries with tab and experience filters
 * - Post creation, update, delete
 * - Supportive comments & 5 emotional reactions
 * - Save moments (bookmarks)
 * - Letters to My Baby (digital memory journal)
 * - Family Circle management & invitation code handling
 * - Content reporting & peer safety
 * - Multimedia upload (photos / videos)
 */

import { getAuthToken } from '../../auth/authService.js';

function getApiBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MIORA_API_URL) {
    return import.meta.env.VITE_MIORA_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('blob:')) {
    if (window.location.port === '3000' || window.location.port === '5173') {
      return 'http://127.0.0.1:8000';
    }
    return window.location.origin;
  }
  return 'http://127.0.0.1:8000';
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

// ----------------------------------------------------------------------------
// Feed & Posts
// ----------------------------------------------------------------------------
export async function fetchMomentsFeed({
  tab = 'community',
  experienceType = null,
  category = null,
  page = 1,
  pageSize = 20,
} = {}) {
  const params = new URLSearchParams();
  if (tab) params.append('tab', tab);
  if (experienceType && experienceType !== 'all') params.append('experience_type', experienceType);
  if (category && category !== 'All') params.append('category', category);
  params.append('page', String(page));
  params.append('page_size', String(pageSize));

  const url = `${getApiBase()}/api/moments/feed?${params.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch feed (HTTP ${response.status})`);
  }
  return response.json();
}

export async function fetchPostDetail(postId) {
  const response = await fetch(`${getApiBase()}/api/moments/posts/${postId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch post (HTTP ${response.status})`);
  }
  return response.json();
}

export async function createPost(payload) {
  const response = await fetch(`${getApiBase()}/api/moments/posts`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create moment (HTTP ${response.status})`);
  }
  return response.json();
}

export async function updatePost(postId, payload) {
  const response = await fetch(`${getApiBase()}/api/moments/posts/${postId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update moment (HTTP ${response.status})`);
  }
  return response.json();
}

export async function deletePost(postId) {
  const response = await fetch(`${getApiBase()}/api/moments/posts/${postId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok && response.status !== 204) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete moment (HTTP ${response.status})`);
  }
  return true;
}

// ----------------------------------------------------------------------------
// Comments & Reactions
// ----------------------------------------------------------------------------
export async function fetchComments(postId) {
  const response = await fetch(`${getApiBase()}/api/moments/posts/${postId}/comments`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch comments (HTTP ${response.status})`);
  }
  return response.json();
}

export async function addComment(postId, payload) {
  const response = await fetch(`${getApiBase()}/api/moments/posts/${postId}/comments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to add comment (HTTP ${response.status})`);
  }
  return response.json();
}

export async function toggleReaction(postId, reactionType = 'heart') {
  const response = await fetch(`${getApiBase()}/api/moments/posts/${postId}/reactions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ reaction_type: reactionType }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to react (HTTP ${response.status})`);
  }
  return response.json();
}

export async function toggleSaveMoment(postId) {
  const response = await fetch(`${getApiBase()}/api/moments/posts/${postId}/save`, {
    method: 'POST',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to save moment (HTTP ${response.status})`);
  }
  return response.json();
}

// ----------------------------------------------------------------------------
// Letters to My Baby
// ----------------------------------------------------------------------------
export async function fetchBabyLetters() {
  const response = await fetch(`${getApiBase()}/api/moments/letters`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch letters (HTTP ${response.status})`);
  }
  return response.json();
}

export async function createBabyLetter(payload) {
  const response = await fetch(`${getApiBase()}/api/moments/letters`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create letter (HTTP ${response.status})`);
  }
  return response.json();
}

export async function updateBabyLetter(letterId, payload) {
  const response = await fetch(`${getApiBase()}/api/moments/letters/${letterId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update letter (HTTP ${response.status})`);
  }
  return response.json();
}

export async function deleteBabyLetter(letterId) {
  const response = await fetch(`${getApiBase()}/api/moments/letters/${letterId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok && response.status !== 204) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete letter (HTTP ${response.status})`);
  }
  return true;
}

// ----------------------------------------------------------------------------
// Family Circle Management
// ----------------------------------------------------------------------------
export async function fetchFamilyCircle() {
  const response = await fetch(`${getApiBase()}/api/moments/family/circle`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch family circle (HTTP ${response.status})`);
  }
  return response.json();
}

export async function createFamilyInvitation(payload) {
  const response = await fetch(`${getApiBase()}/api/moments/family/invitations`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create invitation (HTTP ${response.status})`);
  }
  return response.json();
}

export async function revokeFamilyInvitation(invitationId) {
  const response = await fetch(`${getApiBase()}/api/moments/family/invitations/${invitationId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok && response.status !== 204) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to revoke invitation (HTTP ${response.status})`);
  }
  return true;
}

export async function joinFamilyCircle(code) {
  const response = await fetch(`${getApiBase()}/api/moments/family/join`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to join family circle (HTTP ${response.status})`);
  }
  return response.json();
}

export async function removeFamilyMember(memberId) {
  const response = await fetch(`${getApiBase()}/api/moments/family/members/${memberId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok && response.status !== 204) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to remove family member (HTTP ${response.status})`);
  }
  return true;
}

export async function updateFamilyMemberPermissions(memberId, payload) {
  const response = await fetch(`${getApiBase()}/api/moments/family/members/${memberId}/permissions`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update permissions (HTTP ${response.status})`);
  }
  return response.json();
}

// ----------------------------------------------------------------------------
// Moderation & Safety
// ----------------------------------------------------------------------------
export async function reportMomentContent(payload) {
  const response = await fetch(`${getApiBase()}/api/moments/reports`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to submit report (HTTP ${response.status})`);
  }
  return response.json();
}

export async function blockUser(userId) {
  const response = await fetch(`${getApiBase()}/api/moments/users/${userId}/block`, {
    method: 'POST',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to block user (HTTP ${response.status})`);
  }
  return response.json();
}

export async function unblockUser(userId) {
  const response = await fetch(`${getApiBase()}/api/moments/users/${userId}/block`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to unblock user (HTTP ${response.status})`);
  }
  return response.json();
}

// ----------------------------------------------------------------------------
// Media Upload
// ----------------------------------------------------------------------------
export async function uploadMomentMedia(file) {
  const formData = new FormData();
  formData.append('file', file);

  const token = getAuthToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBase()}/api/moments/media/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to upload media (HTTP ${response.status})`);
  }
  return response.json();
}
