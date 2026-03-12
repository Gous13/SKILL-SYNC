# SynapseLink - Execution Steps for New Extensions

## Prerequisites

1. Backend dependencies installed: `pip install -r requirements.txt`
2. Frontend dependencies: `npm install`
3. Database initialized: `python init_db.py`

## Post-Setup: Seed Skill Assessments

After `init_db.py`, run the assessment seeds:

```bash
cd backend
python seed_assessments.py
python seed_practical_assessments.py
```

- `seed_assessments.py`: MCQ questions for Python, JavaScript, React, SQL, Machine Learning, Flask (legacy)
- `seed_practical_assessments.py`: Practical (code-based) assessments for SQL, Python, HTML/CSS/JavaScript, C/C++, Java (3–4 question sets per skill)

## Start the Application

### Backend
```bash
cd backend
python app.py
```
Runs on `http://localhost:5000`

### Frontend
```bash
cd frontend
npm run dev
```
Runs on `http://localhost:3000` (or port shown)

## New Features - Quick Verification

### 1. Skill Assessment (Student)
- Login as student → Create/Edit profile with skills (e.g., Python, SQL, Java)
- Go to "My Skills" section → Click **Verify** on an unverified skill
- **Practical skills** (SQL, Python, HTML/CSS/JavaScript, C/C++, Java): 1 Easy + 1 Hard code task, 15 min timer, auto-evaluated
- **Other skills**: MCQ assessment (70%+ to verify)
- Verified skills are used for NLP matching and project recommendations

### 2. Team Skill Validation (Mentor / Team)
- Form a team or join a project
- In **Team Workspace** → See "Skill Validation" card with confidence %
- In **Project Workspace** (mentor) → See "Team Skill Validation" for all teams
- Warnings show uncovered required skills

### 3. Task Tracking (Team Workspace)
- Mentor: Open project → View Team → Or student opens Team Workspace
- Mentor clicks **Add Task** → Create task with assignee and deadline
- Students can update status: Pending → In Progress → Completed
- Mentor Dashboard / Project Workspace shows **Project Progress** (completion %)

### 4. File Upload (Team Workspace)
- In Team Workspace → "Shared Files" section
- Click **Upload** → Select file (pdf, doc, code, images, etc.)
- Team members can **Download**
- Uploader / Mentor can **Delete**

## API Endpoints Added

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/skills/add` | Add skill |
| GET | `/api/skills/my-skills` | List skills with status |
| GET | `/api/skills/assessment/<skill_name>` | Get MCQ questions |
| POST | `/api/skills/assess/<student_skill_id>` | Submit MCQ assessment |
| GET | `/api/skills/practical/check/<student_skill_id>` | Check if practical assessment available |
| POST | `/api/skills/practical/start/<student_skill_id>` | Start practical assessment (get questions) |
| POST | `/api/skills/practical/submit` | Submit practical assessment (code answers) |
| GET | `/api/teams/<id>/skill-validation` | Team skill confidence |
| GET | `/api/projects/<id>/teams-validation` | All teams validation |
| GET/POST | `/api/teams/<id>/tasks` | List/Create tasks |
| PUT | `/api/teams/<id>/tasks/<task_id>` | Update task |
| GET | `/api/projects/<id>/tasks-summary` | Project progress |
| GET/POST | `/api/teams/<id>/files` | List/Upload files |
| GET | `/api/teams/<id>/files/<id>/download` | Download file |
| DELETE | `/api/teams/<id>/files/<id>` | Delete file |
