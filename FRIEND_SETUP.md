# 🚀 SynapseLink Setup Guide (New Laptop)

Follow these steps to get the project running on your friend's laptop.

## 📋 Prerequisites
Ensure the following are installed:
- **Python 3.8+**: [Download Python](https://www.python.org/downloads/)
- **Node.js 16+**: [Download Node.js](https://nodejs.org/en/download/)
- **Git**: [Download Git](https://git-scm.com/downloads)

---

## 🛠️ Step 1: Clone the Repository
Open your terminal (Command Prompt, PowerShell, or Bash) and run:
```bash
git clone https://github.com/Gous13/SKILL-SYNC.git
cd SKILL-SYNC
```

---

## 🐍 Step 2: Backend Setup
1. **Navigate to backend**:
   ```bash
   cd backend
   ```
2. **Create a Virtual Environment**:
   ```bash
   python -m venv venv
   ```
3. **Activate the Virtual Environment**:
   - **Windows (PowerShell)**: `.\venv\Scripts\Activate.ps1`
   - **Windows (CMD)**: `venv\Scripts\activate`
   - **Linux/Mac**: `source venv/bin/activate`
4. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
5. **Initialize the Database**:
   ```bash
   python init_db.py
   ```
6. **Seed Assessment Data** (Important for features to work):
   ```bash
   python seed_assessments.py
   python seed_practical_assessments.py
   ```
7. **Start the Backend Server**:
   ```bash
   python app.py
   ```
   *The backend will run on `http://localhost:5000`*

---

## ⚛️ Step 3: Frontend Setup
1. **Open a NEW terminal window** and navigate to the project root.
2. **Navigate to frontend**:
   ```bash
   cd frontend
   ```
3. **Install Dependencies**:
   ```bash
   npm install
   ```
4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   *The frontend will run on `http://localhost:3000` (or as shown in terminal)*

---

## 🏁 Step 4: Initial Login & Setup
1. Open your browser and go to `http://localhost:3000`.
2. **First Time Login**:
   - Register as **Admin** to initialize system settings.
   - Register as **Mentor** to create projects.
   - Register as **Student** to take skill assessments and join teams.
3. If roles are not visible, login as Admin and go to the Admin Dashboard to click "Initialize Roles".

---

## ❓ Troubleshooting
- **Module Not Found**: Ensure you have activated the virtual environment (`venv`) before running `pip install` and `python app.py`.
- **Port 5000/3000 Busy**: If the port is in use, close any other terminal windows running the app or restart your computer.
- **Database Errors**: If you face database issues, delete `synapselink.db` in the `backend` folder and run `python init_db.py` again.
