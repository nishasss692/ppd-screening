import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CommunityPage } from './CommunityPage.jsx';
import * as communityApi from '../services/communityApiService.js';

const MOCK_POSTS = [
  {
    id: 'post-1',
    display_author: 'Anonymous Mother',
    content: 'Today was a tough day with cluster feeding, but holding my baby in the evening brought peace.',
    category: 'Emotional Support',
    mood: 'Hopeful',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    likes_count: 3,
    comments_count: 2,
    reaction_breakdown: { sending_love: 2, youre_not_alone: 1 },
    user_reaction: null,
    is_own_post: false,
  },
  {
    id: 'post-2',
    display_author: 'A Mother in Her Journey',
    content: 'Celebrated a small win! Managed a 15-minute gentle walk around the block.',
    category: 'Small Wins',
    mood: 'Grateful',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    likes_count: 5,
    comments_count: 0,
    reaction_breakdown: { sending_strength: 5 },
    user_reaction: 'sending_strength',
    is_own_post: true,
  },
];

const MOCK_COMMENTS = [
  {
    id: 'comm-1',
    post_id: 'post-1',
    display_author: 'Anonymous Mother',
    content: 'You are doing great! Week 6 was our turning point.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_own_comment: false,
  },
];

function renderCommunityPage() {
  return render(
    <MemoryRouter>
      <CommunityPage />
    </MemoryRouter>
  );
}

describe('Mother\'s Circle — Anonymous Mother\'s Community Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.spyOn(communityApi, 'fetchCommunityFeed').mockResolvedValue({
      posts: MOCK_POSTS,
      total_count: 2,
      page: 1,
      page_size: 10,
      total_pages: 1,
      has_more: false,
    });

    vi.spyOn(communityApi, 'fetchPostComments').mockResolvedValue(MOCK_COMMENTS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders header, title, privacy assurance, and category filter chips', async () => {
    renderCommunityPage();

    // Check Header & Subtitle
    expect(screen.getByText("Mother's Circle")).toBeDefined();
    expect(
      screen.getByText(/A safe, non-judgmental space where every mother is heard/i)
    ).toBeDefined();

    // Check Privacy Assurance
    expect(screen.getByText(/Privacy Guaranteed:/i)).toBeDefined();

    // Check Actions
    expect(screen.getByText('Write Anonymously')).toBeDefined();
    expect(screen.getByText('Explore Community')).toBeDefined();

    // Check Categories
    expect(screen.getByRole('tab', { name: 'All' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Emotional Support' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Small Wins' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Motherhood Struggles' })).toBeDefined();

    // Wait for feed to display posts
    await waitFor(() => {
      expect(screen.getByText(/Today was a tough day with cluster feeding/i)).toBeDefined();
      expect(screen.getByText(/Celebrated a small win!/i)).toBeDefined();
    });

    // Verify anonymous author labels
    expect(screen.getAllByText('Anonymous Mother').length).toBeGreaterThan(0);
    expect(screen.getByText('A Mother in Her Journey')).toBeDefined();
    expect(screen.getByText('Your Post')).toBeDefined();
  });

  it('opens anonymous post composer, accepts text, and submits new post', async () => {
    const newPostMock = {
      id: 'post-new-1',
      display_author: 'Anonymous Member',
      content: 'Sharing my first reflection here. Feeling grateful for this safe circle.',
      category: 'My Postpartum Journey',
      mood: 'Healing',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      likes_count: 0,
      comments_count: 0,
      reaction_breakdown: {},
      user_reaction: null,
      is_own_post: true,
    };

    const createSpy = vi.spyOn(communityApi, 'createCommunityPost').mockResolvedValue(newPostMock);

    renderCommunityPage();

    // Open composer
    const writeBtn = screen.getByText('Write Anonymously');
    fireEvent.click(writeBtn);

    expect(screen.getByText(/Share Anonymously with Mother's Circle/i)).toBeDefined();

    const textarea = screen.getByPlaceholderText(/What is on your heart today\?/i);
    fireEvent.change(textarea, {
      target: { value: 'Sharing my first reflection here. Feeling grateful for this safe circle.' },
    });

    // Select category and persona
    const selects = screen.getAllByRole('combobox');
    // Category select is first
    fireEvent.change(selects[0], { target: { value: 'My Postpartum Journey' } });

    // Submit
    const submitBtn = screen.getByText('Submit Anonymously');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        content: 'Sharing my first reflection here. Feeling grateful for this safe circle.',
        category: 'My Postpartum Journey',
        mood: null,
        display_author: 'Anonymous Mother',
      });
      expect(screen.getByText(/Your anonymous reflection has been shared safely/i)).toBeDefined();
    });
  });

  it('allows reacting to posts and updates supportive reaction counters', async () => {
    const toggleSpy = vi.spyOn(communityApi, 'togglePostReaction').mockResolvedValue({
      post_id: 'post-1',
      user_reaction: 'sending_love',
      likes_count: 4,
      reaction_breakdown: { sending_love: 3, youre_not_alone: 1 },
    });

    renderCommunityPage();

    await waitFor(() => {
      expect(screen.getByText(/Today was a tough day with cluster feeding/i)).toBeDefined();
    });

    // Find and click "Sending Love" reaction button on post-1
    const loveBtns = screen.getAllByRole('button', { name: /Sending Love/i });
    fireEvent.click(loveBtns[0]);

    await waitFor(() => {
      expect(toggleSpy).toHaveBeenCalledWith('post-1', 'sending_love');
    });
  });

  it('expands comment section, loads comments, and allows adding a comment', async () => {
    const addCommentSpy = vi.spyOn(communityApi, 'addPostComment').mockResolvedValue({
      id: 'comm-2',
      post_id: 'post-1',
      display_author: 'Anonymous Mother',
      content: 'Sending warm hugs your way!',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_own_comment: true,
    });

    renderCommunityPage();

    await waitFor(() => {
      expect(screen.getByText(/Today was a tough day with cluster feeding/i)).toBeDefined();
    });

    // Click "2 comments" toggle button
    const commentToggleBtn = screen.getByText(/2 comments/i);
    fireEvent.click(commentToggleBtn);

    // Wait for comment to load
    await waitFor(() => {
      expect(screen.getByText(/You are doing great! Week 6 was our turning point/i)).toBeDefined();
    });

    // Type a reply
    const input = screen.getByPlaceholderText(/Write an anonymous words of support/i);
    fireEvent.change(input, { target: { value: 'Sending warm hugs your way!' } });

    // Submit reply
    const replyBtn = screen.getByText('Reply');
    fireEvent.click(replyBtn);

    await waitFor(() => {
      expect(addCommentSpy).toHaveBeenCalledWith('post-1', 'Sending warm hugs your way!');
      expect(screen.getByText(/Supportive comment added anonymously/i)).toBeDefined();
    });
  });

  it('opens report modal and submits report for inappropriate content', async () => {
    const reportSpy = vi.spyOn(communityApi, 'reportContent').mockResolvedValue({
      id: 'rep-1',
      status: 'received',
      message: 'Report received.',
    });

    renderCommunityPage();

    await waitFor(() => {
      expect(screen.getByText(/Today was a tough day with cluster feeding/i)).toBeDefined();
    });

    // Post-1 is not own post; open its more options menu
    const moreBtns = screen.getAllByLabelText('Post options');
    fireEvent.click(moreBtns[0]);

    // Click "Report Post"
    const reportBtn = screen.getByText('Report Post');
    fireEvent.click(reportBtn);

    // Verify modal is open
    expect(screen.getByText('Report Inappropriate Content')).toBeDefined();
    expect(screen.getByLabelText('Spam')).toBeDefined();

    // Select Spam radio
    fireEvent.click(screen.getByLabelText('Spam'));

    // Submit Report
    const submitReportBtn = screen.getByText('Submit Report');
    fireEvent.click(submitReportBtn);

    await waitFor(() => {
      expect(reportSpy).toHaveBeenCalledWith({
        postId: 'post-1',
        commentId: null,
        reason: 'Spam',
        details: null,
      });
      expect(screen.getByText(/Content reported for clinical moderation/i)).toBeDefined();
    });
  });

  it('displays the 24/7 Tele-MANAS hotline safeguarding banner', async () => {
    renderCommunityPage();

    expect(screen.getByText(/Gentle Care & Immediate Clinical Support/i)).toBeDefined();
    expect(screen.getByText(/Tele-MANAS: 14416/i)).toBeDefined();
  });
});
