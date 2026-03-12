import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import StudentDashboard from './pages/StudentDashboard'
import TeamWorkspace from './pages/TeamWorkspace'
import ProjectWorkspace from './pages/ProjectWorkspace'
import MentorDashboard from './pages/MentorDashboard'
import AdminDashboard from './pages/AdminDashboard'
import Messages from './pages/Messages'
import ExamPage from './pages/ExamPage'
import ExamMentorPage from './pages/ExamMentorPage'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <StudentDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/team/:teamId"
              element={
                <PrivateRoute>
                  <TeamWorkspace />
                </PrivateRoute>
              }
            />
            <Route
              path="/project/:projectId/workspace"
              element={
                <PrivateRoute requiredRole="mentor">
                  <ProjectWorkspace />
                </PrivateRoute>
              }
            />
            <Route
              path="/mentor"
              element={
                <PrivateRoute requiredRole="mentor">
                  <MentorDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <PrivateRoute requiredRole="admin">
                  <AdminDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <PrivateRoute>
                  <Messages />
                </PrivateRoute>
              }
            />
            <Route
              path="/exam"
              element={
                <PrivateRoute>
                  <ExamPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/exam-mentor"
              element={
                <PrivateRoute requiredRole="mentor">
                  <ExamMentorPage />
                </PrivateRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
