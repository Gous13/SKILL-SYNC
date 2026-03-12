# SynapseLink Setup Guide

## Quick Start

### Step 1: Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Create and activate virtual environment:
   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # Linux/Mac
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Initialize database:
   ```bash
   python init_db.py
   ```

5. Seed skill assessments (for MCQ verification):
   ```bash
   python seed_assessments.py
   ```

6. Run the backend:
   ```bash
   python app.py
   ```

   Backend will be available at `http://localhost:5000`

### Step 2: Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

   Frontend will be available at `http://localhost:3000`

## First Time Setup

### 1. Create Admin Account

1. Open the frontend at `http://localhost:3000`
2. Click "Register"
3. Select "Admin" as role
4. Fill in details and register

### 2. Initialize Roles (Optional)

If roles are not created automatically, you can initialize them:

1. Login as admin
2. Navigate to Admin Dashboard
3. Or use the API endpoint: `POST /api/admin/init-roles`

### 3. Create Test Users

1. Register a few students with different skills
2. Register a mentor account
3. Have students create their profiles

### 4. Create a Project

1. Login as mentor/admin
2. Navigate to Mentor Dashboard
3. Click "Create Project"
4. Fill in project details:
   - Title: "AI Chatbot Development"
   - Description: "Build an intelligent chatbot using NLP and machine learning"
   - Required Skills: "Python, NLP, Machine Learning, Flask, React"
   - Team Size: 3-5 members

### 5. Form Teams

1. In Mentor Dashboard, find your project
2. Click "Form Teams" button
3. The system will:
   - Compute similarity scores for all students
   - Form optimized teams using OR-Tools
   - Display the created teams

### 6. View Recommendations (Student)

1. Login as a student
2. Complete your profile with skills and interests
3. View AI recommendations on the dashboard
4. Click "Why this match?" to see explanations

## Testing the System

### Test Flow

1. **Student Registration & Profile**
   - Register 5-10 students
   - Each creates a detailed profile
   - Include diverse skills (Python, React, ML, Design, etc.)

2. **Project Creation**
   - Create 2-3 projects with different requirements
   - Vary team sizes and skill requirements

3. **Team Formation**
   - For each project, compute similarities
   - Form teams and review results
   - Check team balance and diversity

4. **Recommendations**
   - Login as different students
   - View personalized recommendations
   - Check explanation quality

## Troubleshooting

### Backend Issues

**Import Errors**:
- Ensure you're in the virtual environment
- Reinstall dependencies: `pip install -r requirements.txt`

**Database Errors**:
- Delete `synapselink.db` and run `python init_db.py` again
- Check file permissions

**NLP Model Loading**:
- First run will download the Sentence-BERT model (~90MB)
- Ensure internet connection for first run

### Frontend Issues

**Module Not Found**:
- Run `npm install` again
- Clear node_modules and reinstall

**API Connection Errors**:
- Check backend is running on port 5000
- Verify `VITE_API_URL` in `.env` file
- Check CORS settings in backend

**Build Errors**:
- Clear `dist` folder
- Run `npm run build` again

## Environment Variables

### Backend (.env)
```
JWT_SECRET_KEY=your-secret-key-here
JWT_ACCESS_TOKEN_EXPIRES=86400
DATABASE_URL=sqlite:///synapselink.db
FLASK_ENV=development
FLASK_DEBUG=True
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000/api
```

## Production Deployment

### Backend (Render)

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect repository
4. Set:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python app.py`
5. Add environment variables
6. Enable persistent disk for SQLite

### Frontend (Vercel)

1. Install Vercel CLI: `npm i -g vercel`
2. Navigate to frontend directory
3. Run: `vercel`
4. Set `VITE_API_URL` to your Render backend URL
5. Deploy

## Notes

- SQLite is used for academic deployment
- For production, consider PostgreSQL
- First NLP model load takes time (~30 seconds)
- Team formation optimization may take a few seconds for large datasets
