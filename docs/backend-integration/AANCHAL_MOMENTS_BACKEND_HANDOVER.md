# AANCHAL Moments — Backend Integration & Architecture Handover Report

> **Target Audience:** Backend Engineering Team  
> **Status:** Full-Stack Functional Prototype Verified (Tests Passing: 100%)  
> **Feature Scope:** Private Motherhood Community, Family Circle Sharing, Digital Memory Journal ("Letters to My Baby"), and Single-Use Cryptographic Family Linkage  
> **Date:** November 2026  
> **Branch:** `aachal-moments`

---

## 1. Executive Summary & Purpose

**AANCHAL Moments** is a private social-media-style platform embedded inside the Patient Portal's **Support Space** and the **Family Member Portal**. It enables postpartum mothers to:
1. Share authentic everyday experiences (**A Day in My Life**).
2. Seek emotional guidance, vulnerability, and advice with optional anonymous masking (**Support Circle**).
3. Celebrate developmental milestones (**Baby Milestones**).
4. Preserve private, heartfelt digital letters to their children (**Letters to My Baby**).
5. Maintain a closed, private family sanctuary (**My Family Circle**) where partners, grandparents, and caregivers can connect without ever seeing clinical or psychiatric screening data.

---

## 2. Security Boundaries & Safeguarding Walls

```
                     ┌────────────────────────────────────────────────────────┐
                     │              AANCHAL Clinical Firewall                 │
                     │  (EPDS, Voice/Video AI Inferences, Clinical Reviews)   │
                     └───────────────────────────┬────────────────────────────┘
                                                 │ STRICT ISOLATION
                                                 ▼
┌─────────────────────────────────┐                             ┌─────────────────────────────────┐
│     Verified Mother Account     │                             │      Family Member Account      │
│         (role: 'patient')       │                             │        (role: 'family')         │
├─────────────────────────────────┤                             ├─────────────────────────────────┤
│ • Full access to Community feed │                             │ • BLOCKED from Community feed   │
│ • Full access to Support Circle │   Shared in Family Circle   │ • BLOCKED from Clinical Data    │
│ • Full access to Private Letters│ ──────────────────────────> │ • Can ONLY see Family moments   │
│ • Controls Family Circle perms  │                             │ • Can ONLY see shared letters   │
│ • Can revoke / remove members   │                             │ • Respects mother's permissions │
└─────────────────────────────────┘                             └─────────────────────────────────┘
```

### Strict Business Rules:
1. **Clinical Data Wall:** Family accounts must NEVER be allowed access to `/api/screenings/*`, `/api/clinical-reviews/*`, `/api/patients/me/reports`, or `/api/consultation-reports/*`.
2. **Community Isolation:** Family accounts querying `/api/moments/feed?tab=community` or `/api/moments/feed?tab=support_circle` must strictly receive `403 Forbidden`.
3. **Audience Permission Scoping:**
   - `audience = 'community'`: Visible only to verified mother accounts (`role == 'patient'`).
   - `audience = 'family'`: Visible only to the mother and her authorized family circle members.
   - `audience = 'both'`: Visible on community feed and inside the mother's private family circle.
4. **Immediate Revocation:** If a mother removes a family member or toggles `is_active = False`, all active sessions or future API calls from that user for family moments must return `403 Forbidden` immediately.
5. **Private Letters Isolation:** Digital letters in `baby_letters` are private to the mother by default (`shared_with_family = False`). Family members can only query letters where `shared_with_family == True` and `is_draft == False`.

---

## 3. Database Schema & SQLAlchemy Entities

The models are defined in `backend/models/moments.py` and registered in `backend/models/__init__.py`.

### 3.1 Entity Relationship Diagram

```
 mothers (id)
    │ 1
    │
    ├──< moments_posts (id, mother_id, author_user_id, audience, experience_type, ...)
    │       │ 1
    │       ├──< moments_comments (id, post_id, author_user_id, content, ...)
    │       ├──< moments_reactions (id, post_id, user_id, reaction_type) [Unique(post_id, user_id)]
    │       ├──< moments_saved (id, post_id, user_id) [Unique(post_id, user_id)]
    │       └──< moment_reports (id, post_id, reporter_user_id, reason, ...)
    │
    ├──< baby_letters (id, mother_id, author_user_id, title, content, shared_with_family, ...)
    │
    ├──< family_invitations (id, mother_id, inviter_user_id, invitation_code_hash, status, expires_at)
    │
    └──< family_circle_members (id, mother_id, user_id, relationship, can_upload, can_comment, is_active)
            [Unique(mother_id, user_id)]
```

### 3.2 Table Definitions

#### A. `moments_posts`
| Column Name | Type | Modifiers / Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | Primary Key, default `uuid4` | Unique moment ID |
| `author_user_id` | `UUID` | Foreign Key (`users.id`, ondelete `CASCADE`), Indexed, Not Null | Author's user account ID |
| `mother_id` | `UUID` | Foreign Key (`mothers.id`, ondelete `CASCADE`), Indexed, Nullable | Associated mother record |
| `audience` | `VARCHAR(32)` | Default `'community'`, Not Null, Indexed | `'community'`, `'family'`, `'both'` |
| `experience_type`| `VARCHAR(32)` | Default `'day_in_life'`, Not Null, Indexed | `'day_in_life'`, `'support_circle'`, `'milestone'`, `'general'` |
| `category` | `VARCHAR(64)` | Default `'General'`, Not Null | Optional sub-tag |
| `caption` | `TEXT` | Not Null | User-submitted content (HTML sanitized) |
| `media_url` | `VARCHAR(512)` | Nullable | Uploaded photo or video URL (`/api/moments/media/{filename}`) |
| `media_type` | `VARCHAR(32)` | Nullable | `'photo'` or `'video'` |
| `milestone_title`| `VARCHAR(160)` | Nullable | Custom milestone heading (e.g. "First Laugh") |
| `mood` | `VARCHAR(48)` | Nullable | Mother's current mood tag |
| `is_anonymous` | `BOOLEAN` | Default `False`, Not Null | If `True`, identity masked as "Anonymous Mother" in feed |
| `display_author` | `VARCHAR(128)` | Default `'Mother'`, Not Null | Author display name |
| `author_avatar` | `VARCHAR(512)` | Nullable | Profile photo URL |
| `status` | `VARCHAR(32)` | Default `'approved'`, Not Null, Indexed | `'approved'`, `'flagged'`, `'removed'` |
| `likes_count` | `INTEGER` | Default `0`, Not Null | Total emotional reactions count |
| `comments_count`| `INTEGER` | Default `0`, Not Null | Total comments count |
| `created_at` | `DATETIME(tz)`| Default `utc_now()`, Not Null | Timestamp created |
| `updated_at` | `DATETIME(tz)`| Default `utc_now()`, onupdate | Timestamp updated |

#### B. `family_invitations`
| Column Name | Type | Modifiers / Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | Primary Key, default `uuid4` | Unique invitation ID |
| `mother_id` | `UUID` | Foreign Key (`mothers.id`, ondelete `CASCADE`), Indexed, Not Null | The inviting mother |
| `inviter_user_id`| `UUID` | Foreign Key (`users.id`, ondelete `CASCADE`), Indexed, Not Null | Mother's account ID |
| `invitation_code_hash` | `VARCHAR(64)` | Indexed, Not Null | **SHA-256 hash** of raw uppercase invitation code |
| `invitation_code_preview` | `VARCHAR(16)` | Not Null | Safe preview string (e.g. `"MOMENT-****-B6A7"`) |
| `invitee_name` | `VARCHAR(128)` | Nullable | Expected family member name (e.g. "Rahul") |
| `relationship` | `VARCHAR(64)` | Default `'Family Member'`, Nullable | Expected relationship (Partner, Grandparent, etc.) |
| `can_upload` | `BOOLEAN` | Default `False`, Not Null | Initial upload permission |
| `can_comment` | `BOOLEAN` | Default `True`, Not Null | Initial comment permission |
| `status` | `VARCHAR(32)` | Default `'active'`, Not Null, Indexed | `'active'`, `'used'`, `'revoked'`, `'expired'` |
| `expires_at` | `DATETIME(tz)`| Not Null | Expiration timestamp (strictly **7 days** from creation) |
| `used_at` | `DATETIME(tz)`| Nullable | Timestamp code was redeemed |
| `used_by_user_id` | `UUID` | Foreign Key (`users.id`, ondelete `SET NULL`), Nullable | The user who redeemed the code |

#### C. `family_circle_members`
| Column Name | Type | Modifiers / Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | Primary Key, default `uuid4` | Member link ID |
| `mother_id` | `UUID` | Foreign Key (`mothers.id`, ondelete `CASCADE`), Indexed, Not Null | Mother ID |
| `user_id` | `UUID` | Foreign Key (`users.id`, ondelete `CASCADE`), Indexed, Not Null | Family user account ID |
| `relationship` | `VARCHAR(64)` | Default `'Family Caregiver'`, Not Null | Relationship label |
| `can_upload` | `BOOLEAN` | Default `False`, Not Null | Mother-controlled upload permission |
| `can_comment` | `BOOLEAN` | Default `True`, Not Null | Mother-controlled comment permission |
| `is_active` | `BOOLEAN` | Default `True`, Not Null | Access flag (set to `False` on removal) |
| **Constraint** | `UniqueConstraint('mother_id', 'user_id')` | Named `uq_family_circle_mother_user` | Prevents duplicate linkage |

#### D. `baby_letters`
| Column Name | Type | Modifiers / Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | Primary Key, default `uuid4` | Letter ID |
| `mother_id` | `UUID` | Foreign Key (`mothers.id`, ondelete `CASCADE`), Indexed, Not Null | Mother ID |
| `author_user_id`| `UUID` | Foreign Key (`users.id`, ondelete `CASCADE`), Indexed, Not Null | Mother's User ID |
| `title` | `VARCHAR(200)` | Not Null | Letter title (e.g. "When you first smiled") |
| `letter_date` | `VARCHAR(32)` | Not Null | Date of letter |
| `content` | `TEXT` | Not Null | Heartfelt journal body text |
| `photo_url` | `VARCHAR(512)` | Nullable | Optional keepsake photo URL |
| `is_draft` | `BOOLEAN` | Default `False`, Not Null | Draft status |
| `shared_with_family` | `BOOLEAN` | Default `False`, Not Null | **Strictly `False` by default.** Shared only on explicit opt-in |

#### E. `moments_reactions` & `moments_saved`
* `moments_reactions`: Contains `post_id`, `user_id`, and `reaction_type` (`'heart'`, `'cheer'`, `'hug'`, `'love'`, `'strength'`) with `UniqueConstraint('post_id', 'user_id')`.
* `moments_saved`: Contains `post_id` and `user_id` with `UniqueConstraint('post_id', 'user_id')` for private bookmarks.

---

## 4. REST API Endpoint Specifications

All endpoints are registered under `/api/moments` and require Bearer token authorization:
`Authorization: Bearer <JWT_ACCESS_TOKEN>`

### 4.1 Feed & Post Endpoints

#### `GET /api/moments/feed`
Retrieves filtered moments feed.
* **Query Parameters:**
  * `tab` (`str`, default `"community"`): `"community"`, `"family"`, `"my_moments"`, `"saved"`.
  * `experience_type` (`str`, optional): `"day_in_life"`, `"support_circle"`, `"milestone"`, `"general"`.
  * `category` (`str`, optional): Subcategory filter.
  * `page` (`int`, default `1`).
  * `page_size` (`int`, default `20`).
* **Role Enforcements:**
  * If `current_user.role == "family"`, any request where `tab in ("community", "support_circle")` returns `403 Forbidden`.
  * If `current_user.role == "family"`, feed is strictly scoped to `mother_id == current_user.mother_id` and `audience.in_(('family', 'both'))`.
* **Response (200 OK):**
```json
{
  "posts": [
    {
      "id": "e6715f22-4a0b-4e8f-9a13-8a3c89f5bc31",
      "caption": "First morning walk with our baby in the park.",
      "experience_type": "day_in_life",
      "category": "Daily Routine",
      "audience": "community",
      "is_anonymous": false,
      "display_author": "Priya Sharma",
      "author_avatar": null,
      "media_url": "/api/moments/media/walk.jpg",
      "media_type": "photo",
      "milestone_title": null,
      "mood": "Peaceful",
      "status": "approved",
      "likes_count": 8,
      "comments_count": 2,
      "user_reacted": "heart",
      "is_saved": false,
      "is_own_post": true,
      "created_at": "22 Nov 2026, 09:30",
      "reaction_counts": { "heart": 5, "cheer": 2, "hug": 1, "love": 0, "strength": 0 }
    }
  ],
  "items": [...],
  "total_count": 24,
  "page": 1,
  "page_size": 20,
  "has_more": true
}
```

#### `POST /api/moments/posts`
Creates a new moment.
* **Request Body:**
```json
{
  "audience": "family",
  "experience_type": "milestone",
  "caption": "Baby held my finger for the first time!",
  "media_url": "/api/moments/media/finger.jpg",
  "media_type": "photo",
  "milestone_title": "First Grasp",
  "mood": "Emotional",
  "is_anonymous": false
}
```
* **Status:** `201 Created`

#### `GET /api/moments/posts/{post_id}`
Returns full moment detail including authorized comments.

#### `DELETE /api/moments/posts/{post_id}`
Author or mother of the family member only. Returns `204 No Content`.

---

### 4.2 Emotional Reactions & Comments

#### `POST /api/moments/posts/{post_id}/reactions`
Toggles an emotional reaction (`heart`, `cheer`, `hug`, `love`, `strength`). If already reacted with the same type, reaction is removed; if different, reaction type is switched.
* **Request Body:**
```json
{
  "reaction_type": "hug"
}
```
* **Response (200 OK):**
```json
{
  "post_id": "e6715f22-4a0b-4e8f-9a13-8a3c89f5bc31",
  "reaction_type": "hug",
  "likes_count": 9
}
```

#### `POST /api/moments/posts/{post_id}/comments`
* **Request Body:**
```json
{
  "content": "You are doing an incredible job, mama!",
  "is_anonymous": false
}
```
* **Validation:** If user is a family member, checks `can_comment == True` in `FamilyCircleMember`. If `False`, returns `403 Forbidden`.

#### `POST /api/moments/posts/{post_id}/save`
Toggles bookmarking in private Saved Moments. Returns `{"saved": true, "post_id": "..."}`.

---

### 4.3 Letters to My Baby (Digital Memory Journal)

#### `GET /api/moments/letters`
* If mother: Returns all active letters.
* If family member: Returns **only** letters where `shared_with_family == True` and `is_draft == False`.

#### `POST /api/moments/letters`
Creates a memory journal letter.
* **Request Body:**
```json
{
  "title": "When You First Looked Into My Eyes",
  "letter_date": "2026-11-22",
  "content": "Dearest one, today after feeding, you looked up and smiled...",
  "photo_url": null,
  "shared_with_family": false,
  "is_draft": false
}
```

#### `DELETE /api/moments/letters/{letter_id}`
Deletes a letter (author only). Returns `204 No Content`.

---

### 4.4 Family Circle Management & Single-Use Hashing

#### `POST /api/moments/family/invitations` (Mother Only)
Generates a new invitation.
* **Request Body:**
```json
{
  "invitee_name": "Rahul Sharma",
  "relationship": "Partner / Co-Parent",
  "can_upload": true,
  "can_comment": true
}
```
* **Response (201 Created):**
```json
{
  "id": "7f09322e-bf73-4ea2-b52b-74e2ad210f76",
  "invitation_code": "MOMENT-8A3F-C109",
  "invitation_code_preview": "MOMENT-****-C109",
  "invitee_name": "Rahul Sharma",
  "relationship": "Partner / Co-Parent",
  "can_upload": true,
  "can_comment": true,
  "status": "active",
  "expires_at": "29 Nov 2026, 12:30 UTC",
  "created_at": "22 Nov 2026"
}
```
> [!IMPORTANT]
> The raw plaintext `invitation_code` is returned **only once** upon generation. The database stores only the SHA-256 hash `invitation_code_hash`.

#### `POST /api/moments/family/join` (Family User)
Family member redeems invitation code.
* **Request Body:**
```json
{
  "code": "MOMENT-8A3F-C109"
}
```
* **Validation:**
  1. Computes `hashlib.sha256(code.strip().upper().encode()).hexdigest()`.
  2. Finds invitation in `family_invitations`.
  3. Checks `status == 'active'` (rejects if already `'used'`, `'revoked'`, or `'expired'`).
  4. Checks `expires_at > utc_now()` (rejects if > 7 days old).
  5. Links `user.mother_id = mother.id`.
  6. Creates or activates `FamilyCircleMember` with permissions.
  7. Sets `invitation.status = 'used'`, `used_at = utc_now()`, `used_by_user_id = user.id`.
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Successfully linked to Family Circle",
  "member_id": "4e73819d-fa89-49bb-b14a-191060938491",
  "mother_id": "581d4a8f-...",
  "relationship": "Partner / Co-Parent"
}
```

#### `DELETE /api/moments/family/members/{member_id}` (Mother Only)
Immediately revokes access:
* Sets `member.is_active = False`.
* Clears `target_user.mother_id = None`.
* Returns `204 No Content`.

#### `PUT /api/moments/family/members/{member_id}/permissions` (Mother Only)
Updates `can_upload` and `can_comment` flags.

---

### 4.5 Multimedia Upload

#### `POST /api/moments/media/upload`
* Accepts multipart file upload: `file: UploadFile`.
* Supported formats: `jpg`, `jpeg`, `png`, `webp`, `gif`, `mp4`, `webm`, `mov`.
* Max file size: 25 MB (`413 Request Entity Too Large` if exceeded).
* Destination: `uploads/moments/<uuid>_<filename>`.
* Returns: `{"url": "/api/moments/media/<uuid>_<filename>", "media_type": "photo"|"video"}`.

#### `GET /api/moments/media/{filename}`
Streams uploaded file using `FileResponse`.

---

## 5. Automated Test Verification & Runbook

All automated tests are passing. The backend developer can run:

```bash
# Run AANCHAL Moments unit & integration test suite
.\.venv-demo\Scripts\python.exe -m pytest tests/test_aanchal_moments.py -v

# Run Auth & RBAC test suite
.\.venv-demo\Scripts\python.exe -m pytest tests/test_auth_rbac.py -v

# Run full backend test suite
.\.venv-demo\Scripts\python.exe -m pytest tests/ -v
```

### Test Cases Covered in `tests/test_aanchal_moments.py`:
1. `test_mother_post_creation_audience`: Verifies post creation across `community`, `family`, and `both`.
2. `test_family_blocked_from_community_feed`: Confirms `403 Forbidden` when family role requests community feed.
3. `test_family_invitation_lifecycle`: Tests raw code hashing, linking, and rejection of re-used codes.
4. `test_invitation_revocation_by_mother`: Verifies revoked codes cannot be redeemed.
5. `test_cross_family_isolation_and_immediate_revocation`: Confirms Family A cannot see Mother B's moments, and immediate revocation when member is removed.
6. `test_baby_letters_privacy`: Tests default private isolation of memory letters.
7. `test_anonymous_author_masking`: Verifies author names are masked as "Anonymous Mother" when requested.

---

## 6. Frontend Files Added & Modified

| File | Type | Description |
|:---|:---|:---|
| `src/patient/pages/SupportSpacePage.jsx` | React Page | Full-featured AANCHAL Moments experience with 5 tabs, feed, reactions, comments, letters, and invitation generator |
| `src/family/FamilyMomentsPage.jsx` | React Page | Dedicated Family Member Portal ("My Mother's Moments") with invitation code joining flow and clinical isolation |
| `src/patient/services/momentsApiService.js` | API Service | Client-side SDK connecting to `/api/moments/*` endpoints |
| `src/patient/styles/moments.css` | Styling | Blush pink, cream, ivory, warm beige design system; zero emojis |
| `src/patient/components/PatientIcons.jsx` | SVG Icons | Extended with clean icons (`cheer`, `hug`, `strength`, `love`, `photo`, `send`, `copy`, `bookmark`, etc.) |
| `src/patient/components/PatientSidebar.jsx`| Navigation | Unified `Support Space` routing |
| `src/App.jsx` | Router | Wired `/patient/support-space`, `/patient/moments`, and `/family/moments` routes |
| `src/auth/authService.js` | Auth Service| Directs `family` role accounts to `/family/moments` upon authentication |
