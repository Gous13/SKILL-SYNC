import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import Layout from '../components/Layout'
import { Users, MessageCircle, User, ArrowLeft, Shield, CheckSquare } from 'lucide-react'

const ProjectWorkspace = () => {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: projectData, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/projects/${projectId}`)
      return res.data.project
    }
  })

  const { data: membersData } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/projects/${projectId}/members`)
      return res.data
    },
    enabled: !!projectId
  })

  const { data: tasksSummary } = useQuery({
    queryKey: ['tasks-summary', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/projects/${projectId}/tasks-summary`)
      return res.data
    },
    enabled: !!projectId
  })

  const { data: teamsValidation } = useQuery({
    queryKey: ['teams-validation', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/projects/${projectId}/teams-validation`)
      return res.data.teams_validation || []
    },
    enabled: !!projectId
  })

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading workspace...</div>
      </Layout>
    )
  }

  if (!projectData) {
    return (
      <Layout>
        <div className="text-center py-12 text-red-600">Project not found</div>
      </Layout>
    )
  }

  const members = membersData?.members || []
  const groupChatId = membersData?.group_chat_id

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header with back */}
        <div className="bg-gray-900 rounded-lg shadow-sm p-6">
          <button
            onClick={() => navigate('/mentor')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Projects
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">{projectData.title}</h1>
              <p className="mt-2 text-gray-400 line-clamp-2">{projectData.description}</p>
            </div>
            <span className="px-3 py-1 bg-gray-800 rounded-full text-sm capitalize">
              {projectData.status}
            </span>
          </div>
        </div>

        {/* Group Chat Option */}
        {groupChatId && (
          <div className="bg-gray-900 rounded-lg shadow-sm p-6 border-l-4 border-l-primary-600">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center">
              <MessageCircle className="w-5 h-5 mr-2 text-primary-600" />
              Group Chat
            </h2>
            <p className="text-gray-400 mb-4 text-sm">
              Communicate with the mentor and all team members in a shared chat. Messages appear in your Messages section.
            </p>
            <button
              onClick={() => navigate(`/messages?group=${groupChatId}`)}
              className="inline-flex items-center gap-2 px-5 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              Open Group Chat
            </button>
          </div>
        )}

        {/* Teams - Links to team workspaces */}
        {projectData.teams && projectData.teams.length > 0 && (
          <div className="bg-gray-900 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-white mb-4">Teams</h2>
            <div className="space-y-2">
              {projectData.teams.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <span className="font-medium text-white">{t.name}</span>
                  <button
                    onClick={() => navigate(`/team/${t.id}`)}
                    className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Open Team Workspace
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Project Progress */}
        {tasksSummary && (
          <div className="bg-gray-900 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <CheckSquare className="w-5 h-5 mr-2 text-primary-600" />
              Project Progress
            </h2>
            <div className="flex items-center gap-6">
              <div>
                <span className="text-3xl font-bold text-primary-600">{tasksSummary.completion_percentage || 0}%</span>
                <p className="text-sm text-gray-400">Complete</p>
              </div>
              <div>
                <span className="text-lg font-medium text-white">{tasksSummary.completed_tasks || 0}/{tasksSummary.total_tasks || 0}</span>
                <p className="text-sm text-gray-400">Tasks completed</p>
              </div>
            </div>
          </div>
        )}

        {/* Team Skill Validation */}
        {teamsValidation && teamsValidation.length > 0 && (
          <div className="bg-gray-900 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-primary-600" />
              Team Skill Validation
            </h2>
            <div className="space-y-4">
              {teamsValidation.map((tv) => (
                <div
                  key={tv.team_id}
                  className={`rounded-lg p-4 border ${
                    (tv.confidence_score || 0) < 1 ? 'bg-amber-900/10 border-amber-200' : 'bg-green-900/10 border-green-200'
                  }`}
                >
                  <div className="font-medium text-white">{tv.team_name || `Team ${tv.team_id}`}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    Confidence: {((tv.confidence_score || 0) * 100).toFixed(0)}%
                  </div>
                  {tv.warnings?.length > 0 && (
                    <ul className="text-sm text-amber-700 list-disc list-inside mt-2">
                      {tv.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Members */}
        <div className="bg-gray-900 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-primary-600" />
            Team Members ({members.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center min-w-0">
                    <div className="w-12 h-12 bg-purple-900/30 rounded-full flex items-center justify-center shrink-0">
                      <User className="w-6 h-6 text-primary-600" />
                    </div>
                    <div className="ml-4 min-w-0">
                      <p className="font-semibold text-white">{member.name}</p>
                      <p className="text-sm text-gray-400 truncate">{member.email}</p>
                    </div>
                  </div>
                  {member.user_id !== user?.id && (
                    <button
                      onClick={() => navigate(`/messages?with=${member.user_id}`)}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg shrink-0"
                      title="Message"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default ProjectWorkspace
