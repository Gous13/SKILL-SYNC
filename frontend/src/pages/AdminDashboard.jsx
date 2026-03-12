import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import Layout from '../components/Layout'
import toast from 'react-hot-toast'
import { Settings, Users, Briefcase, Activity, BarChart3, RotateCcw, Trash2, Ban, CheckCircle } from 'lucide-react'

const AdminDashboard = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showFullResetConfirm, setShowFullResetConfirm] = useState(false)
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await api.get('/admin/stats')
      return res.data.stats
    }
  })

  const { data: logs } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: async () => {
      const res = await api.get('/admin/logs')
      return res.data.logs || []
    }
  })

  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get('/admin/users')
      return res.data.users || []
    }
  })

  const resetProjectsMutation = useMutation({
    mutationFn: () => api.post('/admin/reset-projects'),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-stats'])
      queryClient.invalidateQueries(['admin-logs'])
      setShowResetConfirm(false)
      toast.success('Project data reset. Users and profiles preserved.')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Reset failed')
  })

  const resetFullMutation = useMutation({
    mutationFn: () => api.post('/admin/reset-full'),
    onSuccess: () => {
      setShowFullResetConfirm(false)
      toast.success('Full reset complete. You will need to register again.')
      localStorage.removeItem('token')
      navigate('/login')
      window.location.reload()
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Reset failed')
  })

  const blockUserMutation = useMutation({
    mutationFn: (userId) => api.post(`/admin/users/${userId}/block`, { reason: 'Blocked by admin' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users'])
      toast.success('User blocked successfully')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to block user')
  })

  const unblockUserMutation = useMutation({
    mutationFn: (userId) => api.post(`/admin/users/${userId}/unblock`),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users'])
      toast.success('User unblocked successfully')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to unblock user')
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => api.put(`/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users'])
      toast.success('User role updated successfully')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update role')
  })

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => api.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users'])
      queryClient.invalidateQueries(['admin-stats'])
      toast.success('User deleted successfully')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to delete user')
  })

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading admin dashboard...</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gray-900 rounded-lg shadow-sm p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
              <p className="mt-2 text-gray-400">System overview and management</p>
            </div>
            <div className="flex flex-col items-stretch sm:items-end gap-2">
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center justify-center px-4 py-2 border border-purple-500/50 text-purple-400 rounded-lg hover:bg-purple-900/30 w-full sm:w-auto"
                title="Reset projects, teams. Keeps users and profiles."
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Reset Projects
              </button>
              <button
                onClick={() => setShowFullResetConfirm(true)}
                className="flex items-center justify-center px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-900/10 w-full sm:w-auto"
                title="Remove all data. Fresh start."
              >
                <Trash2 className="w-5 h-5 mr-2" />
                Full Reset
              </button>
            </div>
          </div>
        </div>

        {/* Full reset confirmation */}
        {showFullResetConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-lg max-w-md w-full p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-red-700 mb-2">Full System Reset?</h3>
              <p className="text-sm text-gray-400 mb-4">
                This will delete ALL data: users, profiles, projects, teams, messages. The database will be empty. You will need to register again. Application structure is unchanged.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowFullResetConfirm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-300 hover:bg-gray-950"
                >
                  Cancel
                </button>
                <button
                  onClick={() => resetFullMutation.mutate()}
                  disabled={resetFullMutation.isLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {resetFullMutation.isLoading ? 'Resetting...' : 'Full Reset'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset projects confirmation */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-lg max-w-md w-full p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-2">Reset Project Data?</h3>
              <p className="text-sm text-gray-400 mb-4">
                This will remove all projects, teams, hackathons, and matching data. Users and profiles will be kept. Mentors can create new projects; students will see no joined teams.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-300 hover:bg-gray-950"
                >
                  Cancel
                </button>
                <button
                  onClick={() => resetProjectsMutation.mutate()}
                  disabled={resetProjectsMutation.isLoading}
                  className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                >
                  {resetProjectsMutation.isLoading ? 'Resetting...' : 'Reset Projects'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Users"
            value={stats?.users?.total || 0}
            subtitle={`${stats?.users?.active || 0} active`}
            icon={Users}
            color="primary"
          />
          <StatCard
            title="Students"
            value={stats?.users?.students || 0}
            subtitle="Registered"
            icon={Users}
            color="accent"
          />
          <StatCard
            title="Projects"
            value={stats?.projects?.total || 0}
            subtitle={`${stats?.projects?.open || 0} open`}
            icon={Briefcase}
            color="purple"
          />
          <StatCard
            title="Teams"
            value={stats?.teams?.total || 0}
            subtitle={`${stats?.teams?.active || 0} active`}
            icon={Activity}
            color="blue"
          />
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Breakdown */}
          <div className="bg-gray-900 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-primary-600" />
              User Breakdown
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Students</span>
                <span className="font-semibold text-white">
                  {stats?.users?.students || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Mentors</span>
                <span className="font-semibold text-white">
                  {stats?.users?.mentors || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Admins</span>
                <span className="font-semibold text-white">
                  {stats?.users?.admins || 0}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="font-medium text-white">Total Active</span>
                <span className="font-bold text-primary-600">
                  {stats?.users?.active || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Project Status */}
          <div className="bg-gray-900 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <Briefcase className="w-5 h-5 mr-2 text-primary-600" />
              Project Status
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Open</span>
                <span className="font-semibold text-white">
                  {stats?.projects?.open || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">In Progress</span>
                <span className="font-semibold text-white">
                  {stats?.projects?.in_progress || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Completed</span>
                <span className="font-semibold text-white">
                  {stats?.projects?.completed || 0}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="font-medium text-white">Total</span>
                <span className="font-bold text-primary-600">
                  {stats?.projects?.total || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-gray-900 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-primary-600" />
            All Users ({usersData?.length || 0})
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-950">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Blocked
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-900 divide-y divide-gray-200">
                {usersData && usersData.length > 0 ? (
                  usersData.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">
                          {user.full_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-400">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-900/30 text-primary-800">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                          }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.is_blocked
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                          }`}>
                          {user.is_blocked ? 'Blocked' : 'Normal'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div className="flex items-center space-x-2">
                          {/* Role selector */}
                          <select
                            value={user.role}
                            onChange={(e) => {
                              if (e.target.value !== user.role) {
                                changeRoleMutation.mutate({ userId: user.id, role: e.target.value })
                              }
                            }}
                            className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded border border-gray-600"
                          >
                            <option value="student">Student</option>
                            <option value="mentor">Mentor</option>
                            <option value="admin">Admin</option>
                          </select>
                          
                          {/* Block/Unblock */}
                          {user.is_blocked ? (
                            <button
                              onClick={() => unblockUserMutation.mutate(user.id)}
                              className="text-green-400 hover:text-green-300 flex items-center"
                              title="Unblock user"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() => blockUserMutation.mutate(user.id)}
                              className="text-red-400 hover:text-red-300 flex items-center"
                              title="Block user"
                            >
                              <Ban className="w-4 h-4 mr-1" />
                              Block
                            </button>
                          )}
                          
                          {/* Delete user */}
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete ${user.full_name}? This action cannot be undone.`)) {
                                deleteUserMutation.mutate(user.id)
                              }
                            }}
                            className="text-red-600 hover:text-red-400 flex items-center"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-400">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity Logs */}
        <div className="bg-gray-900 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-primary-600" />
            Recent Activity
          </h2>
          <div className="space-y-2">
            {logs && logs.length > 0 ? (
              logs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-gray-950 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{log.action}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {log.entity_type} #{log.entity_id}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">No activity logs</div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'primary' }) => {
  const colorClasses = {
    primary: 'bg-purple-900/30 text-primary-600',
    accent: 'bg-purple-900/30 text-primary-400',
    purple: 'bg-purple-900/30 text-purple-400',
    blue: 'bg-purple-900/30 text-blue-400'
  }

  return (
    <div className="bg-gray-900 rounded-lg shadow-sm p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
