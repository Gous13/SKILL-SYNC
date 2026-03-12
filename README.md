# SynapseLink: Intelligent Student Collaboration and Peer Matching System

A comprehensive full-stack application for intelligent team formation in hackathons and academic projects using NLP-based semantic matching and constraint-based optimization.

## 🎯 Project Overview

SynapseLink automates and optimizes team formation using:
- **NLP Semantic Matching**: Sentence-BERT for profile-project compatibility
- **Constraint Optimization**: Google OR-Tools for balanced team formation
- **Explainable AI**: Transparent matching explanations
- **Role-Based Access**: Student, Mentor, and Admin dashboards

## 🏗️ Architecture

### Backend
- **Framework**: Flask (Python)
- **Database**: SQLite3 with SQLAlchemy ORM
- **Authentication**: JWT-based
- **NLP**: Sentence-BERT (all-MiniLM-L6-v2)
- **Optimization**: Google OR-Tools

### Frontend
- **Framework**: React.js with Vite
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Routing**: React Router

## 📁 Project Structure

```
FinalYearProject_Execution/
├── backend/
│   ├── app.py                 # Main Flask application
│   ├── config.py              # Configuration settings
│   ├── extensions.py          # Flask extensions
│   ├── requirements.txt       # Python dependencies
│   ├── models/                # SQLAlchemy models
│   │   ├── user.py
│   │   ├── profile.py
│   │   ├── project.py
│   │   ├── team.py
│   │   ├── matching.py
│   │   └── analytics.py
│   ├── routes/                # API routes
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── profiles.py
│   │   ├── projects.py
│   │   ├── teams.py
│   │   ├── matching.py
│   │   └── admin.py
│   ├── services/              # Business logic
│   │   ├── nlp_service.py
│   │   ├── optimization_service.py
│   │   └── explanation_service.py
│   └── utils/                 # Utilities
│       └── decorators.py
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── contexts/
        │   └── AuthContext.jsx
        ├── components/
        │   ├── Layout.jsx
        │   └── PrivateRoute.jsx
        ├── pages/
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   ├── StudentDashboard.jsx
        │   ├── TeamWorkspace.jsx
        │   ├── MentorDashboard.jsx
        │   └── AdminDashboard.jsx
        └── services/
            └── api.js
```

## 🚀 Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Create virtual environment** (recommended):
   ```bash
   python -m venv venv
   ```

3. **Activate virtual environment**:
   - Windows: `venv\Scripts\activate`
   - Linux/Mac: `source venv/bin/activate`

4. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Set up environment variables**:
   - Copy `.env.example` to `.env` (if needed)
   - Update `JWT_SECRET_KEY` with a secure random string

6. **Run the application**:
   ```bash
   python app.py
   ```

   The backend will run on `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create environment file** (optional):
   Create `.env` file with:
   ```
   VITE_API_URL=http://localhost:5000/api
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

   The frontend will run on `http://localhost:3000`

## 🔐 Default Roles

The system supports three roles:
- **Student**: Create profile, view recommendations, join teams
- **Mentor**: Create projects/hackathons, form teams, monitor progress
- **Admin**: System management, analytics, user management

## 📊 Key Features

### For Students
- Create detailed profiles with natural language descriptions
- Receive AI-powered project recommendations
- View explainable match explanations
- Join and collaborate in teams

### For Mentors
- Create projects and hackathons
- Trigger AI team formation
- Monitor team composition and balance
- Approve or modify team assignments

### For Admins
- System-wide analytics and statistics
- User management and role assignment
- Activity logs and monitoring
- System configuration

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Profiles
- `GET /api/profiles` - Get current user's profile
- `POST /api/profiles` - Create profile
- `PUT /api/profiles` - Update profile

### Projects
- `GET /api/projects/projects` - List all projects
- `POST /api/projects/projects` - Create project (mentor/admin)
- `GET /api/projects/projects/:id` - Get project details

### Matching
- `GET /api/matching/recommendations` - Get recommendations for student
- `POST /api/matching/compute-similarities/:project_id` - Compute similarities
- `POST /api/matching/form-teams/:project_id` - Form teams (mentor/admin)
- `GET /api/matching/explanation/:similarity_id` - Get match explanation

### Teams
- `GET /api/teams` - List user's teams
- `POST /api/teams` - Create team
- `GET /api/teams/:id` - Get team details

### Admin
- `GET /api/admin/stats` - Get system statistics
- `GET /api/admin/logs` - Get activity logs
- `POST /api/admin/reset-projects` - Reset project data (keeps users and profiles)
- `POST /api/admin/reset-full` - Full system reset (removes all data)

**Reset Projects** (Admin only): Clears projects, teams, hackathons, matching data. Users and profiles kept. Use "Reset Projects" button or `python reset_projects.py`.

**Full Reset** (Admin only): Deletes ALL data (users, profiles, projects, teams, messages, logs). Empty database. Roles preserved. Use "Full Reset" button or `python reset_full.py`.

## 🚢 Deployment

### Backend (Render)

1. Create a new Web Service on Render
2. Connect your repository
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `python app.py`
5. Add environment variables:
   - `JWT_SECRET_KEY`: Generate a secure random string
   - `DATABASE_URL`: SQLite file path (Render provides persistent disk)
   - `FLASK_ENV`: production

### Frontend (Vercel)

1. Install Vercel CLI: `npm i -g vercel`
2. Navigate to frontend directory
3. Run: `vercel`
4. Set environment variable:
   - `VITE_API_URL`: Your Render backend URL

## 📝 Database Schema

The system uses SQLite with the following main tables:
- `users` - User accounts
- `roles` - User roles
- `student_profiles` - Student profile data with embeddings
- `projects` - Academic projects
- `hackathons` - Hackathon events
- `teams` - Team entities
- `team_members` - Team membership
- `similarity_scores` - Computed similarity scores
- `match_explanations` - AI explanations
- `system_logs` - Activity logs

## 🧪 Testing the System

1. **Register as Admin**:
   - Create an admin account
   - Initialize roles via `/api/admin/init-roles`

2. **Create Student Profiles**:
   - Register students
   - Have them create detailed profiles

3. **Create Projects**:
   - Login as mentor/admin
   - Create projects with descriptions

4. **Form Teams**:
   - Compute similarities for a project
   - Trigger team formation
   - Review generated teams

## 📚 Academic Notes

- **NLP Model**: Uses pre-trained Sentence-BERT (no training required)
- **Optimization**: Constraint programming with OR-Tools
- **Explainability**: Rule-based explanation generation
- **Scalability**: Designed for academic-scale deployment (SQLite)
- **No Custom ML Training**: Focus on integration and optimization

## 🤝 Contributing

This is an academic project. For improvements:
1. Follow the existing code structure
2. Maintain code quality and documentation
3. Test thoroughly before deployment

## 📄 License

Academic project - All rights reserved

## 👥 Authors

Final Year B.Tech Project - SynapseLink Team

---

**Note**: This system is designed for academic purposes. For production use, consider:
- PostgreSQL instead of SQLite
- Enhanced security measures
- Custom ML model training
- Advanced optimization algorithms
- Real-time collaboration features
