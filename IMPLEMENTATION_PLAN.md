# SynapseLink: Implementation Plan for Review Panel Extensions

This document provides a structured, step-by-step implementation plan for the four required extensions while preserving the existing architecture.

---

## Overview of Changes

| Extension | Scope | New Tables | Touches Existing |
|-----------|-------|------------|------------------|
| 1. Skill Assessment | Student profile + matching pipeline | 3 | Profile model, matching routes, NLP usage |
| 2. Team Skill Validation | Post-team-formation verification | 0 | New service, mentor/admin UI |
| 3. Task Tracking | Collaboration workspace | 2 | TeamWorkspace, ProjectWorkspace, MentorDashboard |
| 4. File Upload/Sharing | Collaboration workspace | 1 | TeamWorkspace, backend storage |

---

## 1. Database Schema Extensions (Minimal & Safe)

### 1.1 Skill Assessment Tables

**Rationale:** Skills must be stored individually to track verification status and assessment scores. The existing `skills_description` on `StudentProfile` remains for backward compatibility and NLP embeddings, but we add structured skill records.

#### Table: `student_skills`
| Column | Type | Description |
|--------|------|-------------|
| id | Integer, PK | |
| user_id | Integer, FK(users.id) | Student who owns the skill |
| skill_name | String(100) | Normalized skill (e.g., "Python", "React") |
| status | String(20) | `unverified` or `verified` |
| assessment_score | Float | Score (0–100) if verified |
| assessed_at | DateTime | When assessment was completed |
| created_at | DateTime | When skill was added |

- Unique constraint: `(user_id, skill_name)`
- Index on `(user_id, status)` for quick lookups

#### Table: `skill_assessments`
| Column | Type | Description |
|--------|------|-------------|
| id | Integer, PK | |
| skill_name | String(100) | Skill this assessment covers |
| question_text | Text | MCQ question |
| option_a, option_b, option_c, option_d | String(255) | Answer choices |
| correct_option | String(1) | 'a', 'b', 'c', or 'd' |
| created_at | DateTime | |

- One assessment can have multiple questions (separate rows per question).
- Seed data: Pre-populate questions for skills in `SKILLS_LIST` (or a subset).

#### Table: `skill_assessment_results`
| Column | Type | Description |
|--------|------|-------------|
| id | Integer, PK | |
| student_skill_id | Integer, FK(student_skills.id) | |
| answers | Text | JSON: `{question_id: selected_option}` |
| score | Float | Percentage correct |
| passed | Boolean | score >= passing_threshold |
| completed_at | DateTime | |

- Passing threshold: configurable (e.g., 70%).

---

### 1.2 Task Tracking Tables

#### Table: `project_tasks`
| Column | Type | Description |
|--------|------|-------------|
| id | Integer, PK | |
| team_id | Integer, FK(teams.id) | Team for project-based tasks |
| project_id | Integer, FK(projects.id) | Denormalized for easier querying |
| title | String(200) | Task title |
| description | Text | Optional |
| assignee_id | Integer, FK(users.id), nullable | null = unassigned or whole team |
| status | String(20) | `pending`, `in_progress`, `completed` |
| deadline | DateTime, nullable | |
| created_by | Integer, FK(users.id) | Mentor who created it |
| created_at | DateTime | |
| updated_at | DateTime | |

- Tasks belong to a **team** (project workspace is team-scoped).
- For mentor view: tasks can be queried by `project_id` (all teams under project).

#### Table: `task_activity_log` (optional, for contribution counts)
| Column | Type | Description |
|--------|------|-------------|
| id | Integer, PK | |
| task_id | Integer, FK(project_tasks.id) | |
| user_id | Integer, FK(users.id) | Who performed action |
| action | String(50) | `created`, `assigned`, `status_change`, `completed` |
| created_at | DateTime | |

- Enables per-member contribution counts and audit trail.

---

### 1.3 File Upload Table

#### Table: `team_files`
| Column | Type | Description |
|--------|------|-------------|
| id | Integer, PK | |
| team_id | Integer, FK(teams.id) | |
| project_id | Integer, FK(projects.id) | Denormalized for admin view |
| file_name | String(255) | Original filename |
| storage_path | String(500) | Server path (e.g., `uploads/teams/{team_id}/{uuid}_{filename}`) |
| file_size | Integer | Bytes |
| mime_type | String(100) | |
| uploader_id | Integer, FK(users.id) | |
| uploaded_at | DateTime | |
| created_at | DateTime | |

- Files stored on disk; only metadata in DB.
- Index on `(team_id)`, `(project_id)` for queries.

---

## 2. Backend API Endpoints

### 2.1 Skill Assessment APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/skills/add` | Add skill (initially unverified) | Student |
| GET | `/api/skills/my-skills` | List student's skills with status | Student |
| GET | `/api/skills/assessment/<skill_name>` | Get MCQ assessment for skill | Student |
| POST | `/api/skills/assess/<student_skill_id>` | Submit answers, receive result | Student |
| GET | `/api/skills/verified-only` | Get verified skills for current user (for matching) | Student (internal) |

**Integration:** `profiles.py` or new `skills_bp` blueprint. Skills are added via a new flow; profile `skills_description` can be synced from verified skills for NLP (or we filter at matching time).

### 2.2 Team Skill Validation APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/teams/<team_id>/skill-validation` | Get team skill confidence & missing skills | Mentor, Admin, Team Member |
| GET | `/api/projects/<project_id>/teams-validation` | Validation for all teams in project | Mentor, Admin |

### 2.3 Task Tracking APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/teams/<team_id>/tasks` | List tasks for team | Team member, Mentor |
| POST | `/api/teams/<team_id>/tasks` | Create task | Mentor |
| PUT | `/api/tasks/<task_id>` | Update task (status, assignee, etc.) | Mentor, Assignee |
| GET | `/api/projects/<project_id>/tasks-summary` | Project-level progress & per-member counts | Mentor |
| GET | `/api/admin/tasks-analytics` | Global task analytics | Admin |

### 2.4 File Upload APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/teams/<team_id>/files` | List files for team | Team member, Mentor |
| POST | `/api/teams/<team_id>/files` | Upload file (multipart/form-data) | Team member, Mentor |
| GET | `/api/teams/<team_id>/files/<file_id>/download` | Download file | Team member, Mentor |
| DELETE | `/api/teams/<team_id>/files/<file_id>` | Delete file | Uploader, Mentor, Admin |
| GET | `/api/admin/files-overview` | List all files (monitoring) | Admin |

---

## 3. Assessment Evaluation Logic

### 3.1 Flow

1. Student adds skill via SkillsInput → API creates `student_skills` row with `status='unverified'`.
2. Student must complete assessment to verify. Frontend fetches questions for that skill.
3. Student submits selected options (e.g., `{1: 'a', 2: 'c', 3: 'b'}`).
4. Backend evaluates:
   - Compare each answer to `correct_option`.
   - Score = (correct_count / total) * 100.
   - If score >= 70 (configurable), set `status='verified'`, `assessment_score`, `assessed_at`.
5. Only verified skills are used in:
   - NLP semantic matching (filter `skills_description` or use `student_skills` verified set).
   - Project recommendations (skill overlap check).
   - Team validation.

### 3.2 Assessment Question Bank

- Create seed script or migration to populate `skill_assessments` for ~20–30 popular skills.
- Each skill: 5–8 MCQ questions.
- Questions can be manually authored or placeholders (e.g., "What is X used for?") for demo.

### 3.3 Modification to Matching Pipeline

- **Recommendations (`get_recommendations`)**: When extracting `student_skills`, use verified skills from `student_skills` instead of (or in addition to) `skills_description`. Fallback: if no verified skills, use `skills_description` with a flag or lower weight.
- **Similarity computation**: Continue using `skills_embedding` from profile, but optionally weight by verified skill count or exclude unverified-only profiles from top recommendations.
- **OR-Tools optimization**: `profile_required_hits` and `profile_skills_dict` should prefer verified skills. Pass a `verified_skills_only=True` flag and filter `profile.skills_description` to only include verified skill names when computing hits.

---

## 4. Team Skill Validation Logic

### 4.1 Service: `team_validation_service.py`

```
Input: team_id (or project_id for all teams)
Output: {
  team_id, project_id,
  required_skills: [...],  // from project.required_skills
  coverage: [
    { skill: "Python", covered: true, best_member_id, best_score, members_with_skill: [...] },
    { skill: "React", covered: false, members_with_skill: [] }
  ],
  confidence_score: 0.85,  // 0-1
  warnings: ["React: No verified member"]
}
```

### 4.2 Algorithm

1. Get project `required_skills`; parse into list (e.g., comma-split + NLP keywords).
2. For each team member, get verified skills and scores from `student_skills`.
3. For each required skill:
   - Use NLP similarity or exact match to find members with verified matching skills.
   - If at least one member has verified skill with score >= 60 (configurable): covered.
   - Record best member and score.
4. Confidence = (covered_skills / total_required_skills).
5. Warnings = list of uncovered skills.

### 4.3 Integration

- Call after team formation (in `_auto_form_teams_for_project` or `form_teams`) and store result in cache or return to client.
- Mentor sees validation in ProjectWorkspace and TeamWorkspace when viewing teams.
- Admin sees in project/team overview.

---

## 5. Task Tracking Workflow

### 5.1 Mentor Flow

1. Mentor opens ProjectWorkspace → sees list of teams.
2. Mentor selects a team (or a "Tasks" tab) → sees task board for that team.
3. Create task: title, description, assignee (dropdown of team members or "Unassigned"), deadline.
4. View: columns Pending | In Progress | Completed.
5. Monitor: project completion % = (completed tasks / total tasks) across all teams for project.
6. Per-member contribution: count of tasks completed by each member (from `task_activity_log` or `assignee_id` + status).

### 5.2 Student Flow

1. Student opens TeamWorkspace.
2. Sees "Tasks" section with assigned tasks.
3. Updates status: Pending → In Progress → Completed.
4. Can view all team tasks (read-only for others' tasks, editable for own).

### 5.3 Status Transitions

- Pending → In Progress (student)
- In Progress → Completed (student)
- Mentor can edit any field (assignee, deadline, status).

---

## 6. Secure File Upload Handling

### 6.1 Storage Strategy

- Directory: `backend/uploads/teams/<team_id>/`
- Filename: `{uuid}_{sanitized_original_name}` to avoid collisions and path traversal.
- Allowed extensions: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.csv`, `.txt`, `.py`, `.js`, `.zip`, `.png`, `.jpg`, `.jpeg` (configurable).
- Max file size: 10 MB (configurable).

### 6.2 Security

- Validate `team_id`: user must be team member or mentor of project.
- Sanitize filename: remove path components, restrict charset.
- Store only metadata in DB; serve files via Flask `send_file` with safe path resolution.
- Admin: read-only list of files (no edit/delete of content, only monitoring).

### 6.3 Implementation

- Use `werkzeug.FileStorage` for multipart upload.
- `os.path.join` with `os.path.normpath` and ensure path stays inside `uploads/`.
- Add `uploads/` to `.gitignore`.

---

## 7. Frontend Component Additions

### 7.1 Student Dashboard

- **SkillsSection**: List skills with status (Unverified/Verified) and "Take Assessment" button.
- **SkillAssessmentModal**: MCQ form; on submit, call assess API and show result.
- Extend **SkillsInput**: After adding skill, show badge "Unverified" and prompt to take assessment.

### 7.2 TeamWorkspace (Collaboration)

- **TaskBoard**: Columns Pending | In Progress | Completed; drag or click to change status.
- **TaskCard**: Title, assignee, deadline, status dropdown (for assignee).
- **FileUploadPanel**: Upload button, file list with download/delete, upload history.

### 7.3 ProjectWorkspace (Mentor)

- **ProjectTasksSummary**: Overall completion %, per-team breakdown.
- **TaskBoard** (per team): Create tasks, assign, view status.
- **TeamSkillValidation**: Confidence indicator, warnings, coverage table.

### 7.4 Mentor Dashboard

- **ProjectCard** enhancement: Show completion % and skill validation warning if any.

### 7.5 Admin Dashboard

- **TasksAnalytics**: Global task counts, completion rates.
- **FilesOverview**: List of uploaded files (team, project, uploader, date) — monitoring only.

---

## 8. Safe Integration Steps

### Phase 1: Database & Models (No Behavior Change)

1. Create new model files: `student_skill.py`, `skill_assessment.py`, `project_task.py`, `team_file.py`.
2. Add to `models/__init__.py`.
3. Run `db.create_all()` or migration; verify tables exist.
4. Seed `skill_assessments` with placeholder questions.

### Phase 2: Skill Assessment (Isolated)

1. Implement `skills_bp` and APIs.
2. Add SkillsSection and SkillAssessmentModal to StudentDashboard.
3. Keep existing `skills_description` flow; new skills can be stored in both (synced) or only in `student_skills` with profile sync on verify.
4. Do **not** change matching yet; test assessment flow only.

### Phase 3: Matching Integration

1. Update `get_recommendations` to prefer verified skills when filtering.
2. Update `_compute_profile_project_similarity` and optimization to optionally use verified skills.
3. Ensure backward compatibility: if user has no verified skills, fall back to `skills_description`.

### Phase 4: Team Validation (Additive)

1. Implement `team_validation_service.py`.
2. Add APIs and call from team/project routes.
3. Add TeamSkillValidation component to ProjectWorkspace and MentorDashboard.

### Phase 5: Task Tracking

1. Implement `project_task` model and APIs.
2. Add TaskBoard to TeamWorkspace (students) and ProjectWorkspace (mentor).
3. Add project-level summary to MentorDashboard.
4. Add admin analytics.

### Phase 6: File Upload

1. Implement `team_file` model, storage directory, APIs.
2. Add FileUploadPanel to TeamWorkspace.
3. Add admin files overview.

### Phase 7: Testing & Polish

1. End-to-end tests: add skill → assess → verify → get recommendation.
2. Team validation: form team → check validation.
3. Tasks: create → assign → update status → verify counts.
4. Files: upload → download → delete → access control.

---

## 9. Backward Compatibility

- **Existing profiles**: Continue to work. If `student_skills` is empty, use `skills_description` for matching (possibly with "legacy" flag).
- **Existing teams**: Team validation runs on demand; no schema change to Team/TeamMember.
- **Existing projects**: Task and file features are additive; projects without tasks behave as before.
- **JWT, CORS, SQLite**: Unchanged.

---

## 10. Files to Create/Modify Summary

### New Files

- `backend/models/student_skill.py`
- `backend/models/skill_assessment.py`
- `backend/models/project_task.py`
- `backend/models/team_file.py`
- `backend/routes/skills.py`
- `backend/services/team_validation_service.py`
- `backend/seed_assessments.py` (optional)
- `frontend/src/components/SkillAssessmentModal.jsx`
- `frontend/src/components/SkillsSection.jsx`
- `frontend/src/components/TaskBoard.jsx`
- `frontend/src/components/FileUploadPanel.jsx`
- `frontend/src/components/TeamSkillValidation.jsx`

### Modified Files

- `backend/models/__init__.py` — add new models
- `backend/app.py` — register `skills_bp`
- `backend/routes/matching.py` — use verified skills
- `backend/routes/teams.py` — add task/file sub-routes or new blueprints
- `backend/routes/projects.py` — add task summary, validation
- `frontend/src/pages/StudentDashboard.jsx` — SkillsSection, assessment
- `frontend/src/pages/TeamWorkspace.jsx` — TaskBoard, FileUploadPanel
- `frontend/src/pages/ProjectWorkspace.jsx` — TaskBoard, TeamSkillValidation
- `frontend/src/pages/MentorDashboard.jsx` — progress indicators
- `frontend/src/pages/AdminDashboard.jsx` — analytics, files overview

---

*End of Implementation Plan*
