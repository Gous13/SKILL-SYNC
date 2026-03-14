import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import Layout from '../components/Layout'
import SkillsInput from '../components/SkillsInput'
import SkillsSection from '../components/SkillsSection'
import toast from 'react-hot-toast'
import {
  User, Plus, Search, Sparkles, Users, Briefcase,
  TrendingUp, Info, CheckCircle, XCircle
} from 'lucide-react'
import Leaderboard from '../components/Leaderboard'

const AVAILABILITY_OPTIONS = [
  { value: '', label: 'Select availability' },
  { value: '5-10 hours per week', label: '5-10 hours per week' },
  { value: '10-20 hours per week', label: '10-20 hours per week' },
  { value: '30-40 hours per week', label: '30-40 hours per week' },
  { value: '40-50 hours per week', label: '40-50 hours per week' },
  { value: '50-60 hours per week', label: '50-60 hours per week' },
  { value: '60-70 hours per week', label: '60-70 hours per week' },
  { value: '70-80 hours per week', label: '70-80 hours per week' },
  { value: '80-90 hours per week', label: '80-90 hours per week' },
  { value: '90-100 hours per week', label: '90-100 hours per week' }
]

const DEPARTMENT_OPTIONS = ['CSE', 'CAD', 'CSM', 'CIV', 'EEE', 'ECE', 'MEC']

const EMPTY_PROFILE_DATA = {
  skills_description: '',
  interests_description: '',
  experience_description: '',
  availability_description: '',
  year_of_study: '',
  department: '',
  gpa: ''
}

const StudentDashboard = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [rejectedProjects, setRejectedProjects] = useState(() => {
    const key = user?.id ? `rejectedProjects_${user.id}` : 'rejectedProjects'
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : []
  })
  const [profileData, setProfileData] = useState(EMPTY_PROFILE_DATA)

  // Fetch profile - key includes user id for cache isolation per user
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const res = await api.get('/profiles')
      return res.data.profile
    },
    retry: false,
    enabled: !!user?.id
  })

  // Fetch recommendations - key includes user id for per-user cache
  const { data: recommendations, isLoading: recLoading } = useQuery({
    queryKey: ['recommendations', user?.id],
    queryFn: async () => {
      const res = await api.get('/matching/recommendations')
      return res.data.recommendations || []
    },
    enabled: !!profile && !!user?.id
  })

  // Fetch exam results to check if any assessment has been graded by mentor
  const { data: examResults } = useQuery({
    queryKey: ['exam-results'],
    queryFn: async () => {
      const res = await api.get('/exam/results')
      return res.data || []
    },
    enabled: !!user?.id
  })

  // Gate: show recommendations only after mentor has graded at least one assessment
  const hasGradedExam = (examResults || []).some(
    (r) => r.status === 'Graded' || (r.overridden_score !== null && r.overridden_score !== undefined)
  )

  // Fetch teams
  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await api.get('/teams')
      return res.data.teams || []
    }
  })

  // Create/Update profile mutation
  const profileMutation = useMutation({
    mutationFn: async (data) => {
      try {
        if (profile) {
          return await api.put('/profiles', data)
        } else {
          return await api.post('/profiles', data)
        }
      } catch (error) {
        console.error('Profile save error:', error)
        console.error('Error response:', error.response?.data)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['recommendations'] })
      setShowProfileModal(false)
      toast.success('Profile saved successfully!')
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save profile'
      console.error('Profile mutation error:', errorMessage)
      toast.error(errorMessage)
    }
  })

  useEffect(() => {
    if (profile) {
      setProfileData({
        skills_description: profile.skills_description || '',
        interests_description: profile.interests_description || '',
        experience_description: profile.experience_description || '',
        availability_description: profile.availability_description || '',
        year_of_study: profile.year_of_study || '',
        department: profile.department || '',
        gpa: profile.gpa || ''
      })
    } else {
      setProfileData(EMPTY_PROFILE_DATA)
    }
  }, [profile])

  const handleProfileSubmit = (e) => {
    e.preventDefault()
    if (!profileData.skills_description?.trim()) {
      toast.error('Please add at least one skill')
      return
    }
    profileMutation.mutate(profileData)
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Modern Header */}
        <div className="card card-hover">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.first_name}!</h1>
              <p className="mt-2 text-gray-600">Manage your profile and discover team opportunities</p>
            </div>
            <button
              onClick={() => {
                if (!profile) setProfileData(EMPTY_PROFILE_DATA)
                setShowProfileModal(true)
              }}
              className="btn btn-primary"
            >
              <User className="w-5 h-5 mr-2" />
              {profile ? 'Edit Profile' : 'Create Profile'}
            </button>
          </div>
        </div>

        {/* Modern Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card card-hover">
            <div className="flex items-center">
              <div className="p-3 bg-primary-50 rounded-xl">
                <Users className="w-6 h-6 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">My Teams</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{teamsData?.length || 0}</p>
              </div>
            </div>
          </div>
          <div className="card card-hover">
            <div className="flex items-center">
              <div className="p-3 bg-accent-50 rounded-xl">
                <Briefcase className="w-6 h-6 text-accent-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recommendations</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{recommendations?.length || 0}</p>
              </div>
            </div>
          </div>
          <div className="card card-hover">
            <div className="flex items-center">
              <div className={`p-3 rounded-xl ${profile?.is_complete ? 'bg-accent-50' : 'bg-yellow-50'}`}>
                <TrendingUp className={`w-6 h-6 ${profile?.is_complete ? 'text-accent-600' : 'text-yellow-600'}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Profile Status</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {profile?.is_complete ? 'Complete' : 'Incomplete'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Profile Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-large">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Create/Edit Profile</h2>
                <p className="text-sm text-gray-600 mt-1">Fill in your details to get better matches</p>
              </div>
              <form onSubmit={handleProfileSubmit} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Skills *
                  </label>
                  <SkillsInput
                    value={profileData.skills_description}
                    onChange={(val) => setProfileData({ ...profileData, skills_description: val })}
                    placeholder="Type to search (e.g., sql, react, python)..."
                  />
                  <p className="text-xs text-gray-500 mt-1.5">Type a skill to see related suggestions from all domains</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Interests
                  </label>
                  <textarea
                    value={profileData.interests_description}
                    onChange={(e) => setProfileData({ ...profileData, interests_description: e.target.value })}
                    className="input"
                    rows="2"
                    placeholder="e.g., AI, Web Development, Data Science"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Experience
                  </label>
                  <textarea
                    value={profileData.experience_description}
                    onChange={(e) => setProfileData({ ...profileData, experience_description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    rows="2"
                    placeholder="e.g., 2 years of web development, 1 hackathon win"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Availability
                  </label>
                  <select
                    value={profileData.availability_description}
                    onChange={(e) => setProfileData({ ...profileData, availability_description: e.target.value })}
                    className="input"
                  >
                    {(() => {
                      const hasCustom = profileData.availability_description && !AVAILABILITY_OPTIONS.find(o => o.value === profileData.availability_description)
                      return (
                        <>
                          {AVAILABILITY_OPTIONS.map((opt) => (
                            <option key={opt.value || 'empty'} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                          {hasCustom && (
                            <option value={profileData.availability_description}>
                              Current: {profileData.availability_description}
                            </option>
                          )}
                        </>
                      )
                    })()}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Year</label>
                    <select
                      value={profileData.year_of_study}
                      onChange={(e) => setProfileData({ ...profileData, year_of_study: e.target.value })}
                      className="input"
                    >
                      <option value="">Select year</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                    <select
                      value={profileData.department}
                      onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                      className="input"
                    >
                      <option value="">Select department</option>
                      {DEPARTMENT_OPTIONS.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                      {profileData.department && !DEPARTMENT_OPTIONS.includes(profileData.department) && (
                        <option value={profileData.department}>{profileData.department}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">CGPA</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      value={profileData.gpa}
                      onChange={(e) => setProfileData({ ...profileData, gpa: e.target.value })}
                      className="input"
                      placeholder="0.00 - 10.00"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileMutation.isLoading}
                    className="btn btn-primary"
                  >
                    {profileMutation.isLoading ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Skills & Assessment */}
        {profile && <SkillsSection />}

        {/* Exam Results */}
        {profile && <StudentExamResults />}

        {/* Leaderboard */}
        {profile && <Leaderboard userRole="student" />}

        {/* Modern Recommendations Section */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-primary-600" />
              AI Recommendations
            </h2>
          </div>
          {!hasGradedExam ? (
            <div className="text-center py-12 text-gray-500">
              <Sparkles className="w-8 h-8 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-600">Recommendations not available yet</p>
              <p className="text-sm mt-1">Complete a skill assessment and wait for your mentor to grade it to unlock project recommendations.</p>
            </div>
          ) : recLoading ? (
            <div className="text-center py-12 text-gray-500">Loading recommendations...</div>
          ) : (() => {
            // Show all valid recommendations returned by backend.
            // (We still pass onReject so you can dismiss visually if needed.)
            const visibleRecs = (recommendations || []).filter(
              (rec) => rec && rec.project
            )

            if (visibleRecs.length === 0) {
              return (
                <div className="text-center py-12 text-gray-500">
                  No recommendations available. Complete your profile to get matches!
                </div>
              )
            }

            return (
              <div className="space-y-4">
                {visibleRecs.slice(0, 5).map((rec) => (
                  <ProjectCard
                    key={rec.project.id}
                    recommendation={rec}
                    onReject={(projectId) => {
                      setRejectedProjects((prev) => {
                        const updated = [...prev, projectId]
                        const key = user?.id ? `rejectedProjects_${user.id}` : 'rejectedProjects'
                        localStorage.setItem(key, JSON.stringify(updated))
                        return updated
                      })
                    }}
                  />
                ))}
              </div>
            )
          })()}
        </div>

        {/* Modern My Teams Section */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <Users className="w-5 h-5 mr-2 text-primary-600" />
            My Teams
          </h2>
          {teamsData?.length > 0 ? (
            <div className="space-y-4">
              {teamsData.map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              You're not part of any teams yet. Check recommendations above!
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

const ProjectCard = ({ recommendation, onReject }) => {
  const { project, similarity = 0, similarity_id } = recommendation || {}
  if (!project) return null
  const [showExplanation, setShowExplanation] = useState(false)
  const [explanation, setExplanation] = useState(null)
  const [isJoining, setIsJoining] = useState(false)
  const queryClient = useQueryClient()

  const fetchExplanation = async () => {
    try {
      let res
      if (similarity_id) {
        res = await api.get(`/matching/explanation/${similarity_id}`)
        setExplanation(res.data.explanation)
      } else {
        // If no similarity_id, use project-based explanation
        res = await api.get(`/matching/explanation/project/${project.id}`)
        setExplanation(res.data.explanation)
      }
      setShowExplanation(true)
    } catch (error) {
      toast.error('Failed to load explanation')
    }
  }

  const handleJoin = async () => {
    setIsJoining(true)
    try {
      // First compute similarities if not done
      if (!similarity_id) {
        await api.post(`/matching/compute-similarities/${project.id}`)
      }

      // Create or join a team for this project
      const res = await api.post('/teams', {
        name: `${project.title} - My Team`,
        project_id: project.id,
        description: `Team for ${project.title}`
      })

      toast.success('Successfully joined the project!')
      queryClient.invalidateQueries(['teams'])
      queryClient.invalidateQueries({ queryKey: ['recommendations'] })
      // Remove from recommendations immediately
      if (onReject) {
        onReject(project.id)
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to join project')
    } finally {
      setIsJoining(false)
    }
  }

  const handleReject = () => {
    if (onReject) {
      onReject(project.id)
    }
    toast.success('Recommendation dismissed')
  }

  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-soft hover:shadow-medium transition-all duration-200">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{project.title}</h3>
            <div className="badge badge-primary flex items-center shrink-0">
              <TrendingUp className="w-3 h-3 mr-1" />
              {(similarity * 100).toFixed(0)}% Match
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{project.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span>Team Size: {project.min_team_size}-{project.max_team_size}</span>
            <span className="badge badge-success capitalize">{project.status}</span>
            {recommendation.matching_skills && recommendation.matching_skills.length > 0 && (
              <span className="text-primary-600 font-medium">
                {recommendation.skill_overlap_count} matching skill{recommendation.skill_overlap_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {recommendation.matching_skills && recommendation.matching_skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {recommendation.matching_skills.slice(0, 5).map((skill, idx) => (
                <span key={idx} className="badge badge-primary">
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={fetchExplanation}
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center font-medium transition-colors"
        >
          <Info className="w-4 h-4 mr-1" />
          Why this match?
        </button>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={handleReject}
            className="btn btn-ghost text-sm"
          >
            Dismiss
          </button>
          <button
            onClick={handleJoin}
            disabled={isJoining || project.status !== 'open'}
            className="btn btn-primary text-sm"
          >
            {isJoining ? 'Joining...' : 'Join Project'}
          </button>
        </div>
      </div>
      {showExplanation && explanation && (
        <div className="mt-4 p-4 bg-primary-50 rounded-xl border border-primary-200">
          <div className="text-sm text-gray-700 whitespace-pre-line">
            {explanation.explanation_text}
          </div>
          {explanation.overlapping_skills?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-primary-200">
              <p className="text-xs font-semibold text-gray-700 mb-2">Matching Skills:</p>
              <div className="flex flex-wrap gap-2">
                {explanation.overlapping_skills.map((skill, idx) => (
                  <span key={idx} className="badge badge-primary">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
          {explanation.strengths?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-700 mb-1">Your Strengths:</p>
              <ul className="text-xs text-gray-600 mt-1 list-disc list-inside space-y-0.5">
                {explanation.strengths.map((strength, idx) => (
                  <li key={idx}>{strength}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const TeamCard = ({ team }) => {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{team.name}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {team.project_title || team.hackathon_title}
          </p>
          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-400">
            <span>{team.member_count} members</span>
            <span className="px-2 py-1 bg-gray-800 rounded">{team.status}</span>
          </div>
        </div>
        <a
          href={`/team/${team.id}`}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          View Workspace
        </a>
      </div>
    </div>
  )
}

const StudentExamResults = () => {
  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ['exam-results'],
    queryFn: async () => {
      const res = await api.get('/exam/results')
      return res.data || []
    },
    staleTime: 0,
    cacheTime: 0
  })

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED':
      case 'Graded':
        return 'text-green-400';
      case 'IN_PROGRESS':
        return 'text-yellow-400';
      case 'TERMINATED':
        return 'text-red-400';
      default:
        return 'text-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'Completed';
      case 'Graded':
        return 'Graded';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'TERMINATED':
        return 'Terminated';
      case 'NOT_STARTED':
        return 'Not Started';
      default:
        return status;
    }
  };

  const latestResultsBySkill = React.useMemo(() => {
    if (!results || results.length === 0) return [];

    const bySkill = {};
    results.forEach(r => {
      if (!bySkill[r.skill] || new Date(r.timestamp) > new Date(bySkill[r.skill].timestamp)) {
        bySkill[r.skill] = r;
      }
    });

    return Object.values(bySkill).sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );
  }, [results]);

  if (isLoading) return <div className="text-gray-400 text-center py-4">Loading exam results...</div>

  if (!latestResultsBySkill || latestResultsBySkill.length === 0) return null;

  return (
    <div className="bg-gray-900 rounded-lg shadow-sm p-6 border border-purple-900/30">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white flex items-center">
          <CheckCircle className="w-5 h-5 mr-2 text-purple-600" />
          Exam Results
        </h2>
        <button
          onClick={() => refetch()}
          className="text-xs text-purple-400 hover:text-purple-300"
        >
          Refresh
        </button>
      </div>
      <div className="space-y-4">
        {latestResultsBySkill.map((r) => (
          <div key={r.attempt_id || r.id} className="bg-gray-950 border border-gray-800 p-4 rounded-lg flex flex-col items-start gap-4">
            <div className="flex w-full justify-between items-start md:items-center">
              <div>
                <h3 className="font-bold text-purple-300">{r.skill} Assessment</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {r.timestamp ? `Attempt on ${new Date(r.timestamp).toLocaleDateString()} at ${new Date(r.timestamp).toLocaleTimeString()}` : 'No timestamp'}
                </p>
              </div>
              <div className="mt-3 md:mt-0 flex gap-4">
                <div className="text-center">
                  <span className="block text-xs text-gray-400 uppercase tracking-widest">Score</span>
                  <span className={`font-bold ${r.score >= 60 ? 'text-green-500' : 'text-red-500'}`}>
                    {r.overridden_score !== null && r.overridden_score !== undefined ? r.overridden_score : r.score}%
                  </span>
                </div>
                <div className="text-center">
                  <span className="block text-xs text-gray-400 uppercase tracking-widest">Status</span>
                  <span className={`font-bold ${getStatusColor(r.status)}`}>
                    {getStatusLabel(r.status)}
                  </span>
                </div>
              </div>
            </div>
            {r.mentor_feedback && (
              <div className="w-full bg-black/40 p-3 rounded-lg border border-purple-500/20 text-sm text-gray-300">
                <strong className="text-purple-400">Mentor Feedback: </strong>
                {r.mentor_feedback}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default StudentDashboard
