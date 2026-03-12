import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import Layout from '../components/Layout'
import toast from 'react-hot-toast'
import { 
  Plus, Briefcase, Users, Sparkles, Settings, 
  CheckCircle, XCircle, Play, Eye, UsersRound 
} from 'lucide-react'
import Leaderboard from '../components/Leaderboard'

const MentorDashboard = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [projectData, setProjectData] = useState({
    title: '',
    description: '',
    required_skills: '',
    min_team_size: 3,
    max_team_size: 5,
    preferred_team_size: 4,
    deadline: ''
  })

  // Fetch projects
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects/projects')
      return res.data.projects || []
    }
  })

  // Fetch hackathons
  const { data: hackathonsData } = useQuery({
    queryKey: ['hackathons'],
    queryFn: async () => {
      const res = await api.get('/projects/hackathons')
      return res.data.hackathons || []
    }
  })

  // Create project mutation
  const projectMutation = useMutation({
    mutationFn: async (data) => {
      return api.post('/projects/projects', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['projects'])
      setShowProjectModal(false)
      toast.success('Project created successfully!')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to create project')
    }
  })

  const handleProjectSubmit = (e) => {
    e.preventDefault()
    projectMutation.mutate(projectData)
  }


  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gray-900 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Mentor Dashboard</h1>
              <p className="mt-2 text-gray-400">Manage projects, hackathons, and team formation</p>
            </div>
            <button
              onClick={() => setShowProjectModal(true)}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Project
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900 rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-900/30 rounded-lg">
                <Briefcase className="w-6 h-6 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Total Projects</p>
                <p className="text-2xl font-bold text-white">{projectsData?.length || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-900/30 rounded-lg">
                <Users className="w-6 h-6 text-primary-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Hackathons</p>
                <p className="text-2xl font-bold text-white">{hackathonsData?.length || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Sparkles className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Teams Formed</p>
                <p className="text-2xl font-bold text-white">
                  {projectsData?.reduce((acc, p) => acc + (p.teams?.length || 0), 0) || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Create Project Modal */}
        {showProjectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <h2 className="text-2xl font-bold text-white">Create New Project</h2>
              </div>
              <form onSubmit={handleProjectSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Project Title *
                  </label>
                  <input
                    type="text"
                    value={projectData.title}
                    onChange={(e) => setProjectData({...projectData, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Description *
                  </label>
                  <textarea
                    value={projectData.description}
                    onChange={(e) => setProjectData({...projectData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    rows="4"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Required Skills
                  </label>
                  <textarea
                    value={projectData.required_skills}
                    onChange={(e) => setProjectData({...projectData, required_skills: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    rows="2"
                    placeholder="e.g., Python, React, Machine Learning"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Min Team Size</label>
                    <input
                      type="number"
                      min="2"
                      max="10"
                      value={projectData.min_team_size}
                      onChange={(e) => setProjectData({...projectData, min_team_size: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Max Team Size</label>
                    <input
                      type="number"
                      min="2"
                      max="10"
                      value={projectData.max_team_size}
                      onChange={(e) => setProjectData({...projectData, max_team_size: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Preferred Size</label>
                    <input
                      type="number"
                      min="2"
                      max="10"
                      value={projectData.preferred_team_size}
                      onChange={(e) => setProjectData({...projectData, preferred_team_size: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
          </div>
        </div>

        {/* Leaderboard */}
        <Leaderboard userRole="mentor" />
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Deadline</label>
                  <input
                    type="datetime-local"
                    value={projectData.deadline}
                    onChange={(e) => setProjectData({...projectData, deadline: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowProjectModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-300 hover:bg-gray-950"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={projectMutation.isLoading}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {projectMutation.isLoading ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Projects List */}
        <div className="bg-gray-900 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-white mb-4">Projects</h2>
          {projectsData?.length > 0 ? (
            <div className="space-y-4">
              {projectsData.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  navigate={navigate}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No projects yet. Create one to get started!
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

const ProjectCard = ({ project, navigate }) => {
  // Count total students who have joined this project
  const totalJoined = project.teams?.reduce((sum, team) => sum + (team.member_count || 0), 0) || 0
  
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{project.title}</h3>
            {totalJoined > 0 && (
              <button
                onClick={() => navigate(`/project/${project.id}/workspace`)}
                className="inline-flex items-center gap-1 px-2 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded transition-colors"
                title="View team members"
              >
                <UsersRound className="w-4 h-4" />
                View Team
              </button>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{project.description}</p>
          <div className="mt-3 flex items-center space-x-4 text-sm text-gray-400">
            <span>Team Size: {project.min_team_size}-{project.max_team_size}</span>
            <span className="px-2 py-1 bg-gray-800 rounded">{project.status}</span>
            <span className="font-medium text-primary-600">
              {project.teams?.length || 0} team{project.teams?.length !== 1 ? 's' : ''} formed
            </span>
            <span className="text-gray-400">
              {totalJoined} student{totalJoined !== 1 ? 's' : ''} joined
            </span>
          </div>
        </div>
      </div>
      {project.teams && project.teams.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm font-medium text-gray-300 mb-2">Formed Teams:</p>
          <div className="space-y-2">
            {project.teams.map((team) => (
              <div key={team.id} className="flex items-center justify-between text-sm bg-gray-950 p-2 rounded">
                <span className="text-gray-300 font-medium">{team.name}</span>
                <span className="text-gray-400">{team.member_count} member{team.member_count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {totalJoined > 0 && (!project.teams || project.teams.length === 0) && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-gray-400">
            {totalJoined} student{totalJoined !== 1 ? 's' : ''} joined. 
            {totalJoined < project.preferred_team_size 
              ? ` Need ${project.preferred_team_size - totalJoined} more to auto-form teams.`
              : ' Teams will be auto-formed when enough students join.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default MentorDashboard
