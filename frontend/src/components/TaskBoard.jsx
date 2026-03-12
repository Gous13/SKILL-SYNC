import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { CheckSquare, Plus, Calendar, User } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' }
]

const TaskBoard = ({ teamId, teamMembers = [], isMentor = false }) => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', assignee_id: '', deadline: '' })

  const { data: tasksData } = useQuery({
    queryKey: ['team-tasks', teamId],
    queryFn: async () => {
      const res = await api.get(`/teams/${teamId}/tasks`)
      return res.data.tasks || []
    },
    enabled: !!teamId
  })

  const createMutation = useMutation({
    mutationFn: (data) => api.post(`/teams/${teamId}/tasks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-tasks', teamId] })
      setShowCreate(false)
      setNewTask({ title: '', description: '', assignee_id: '', deadline: '' })
      toast.success('Task created')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to create task')
  })

  const updateMutation = useMutation({
    mutationFn: ({ taskId, data }) => api.put(`/teams/${teamId}/tasks/${taskId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-tasks', teamId] })
      toast.success('Task updated')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update task')
  })

  const tasks = tasksData || []
  const byStatus = {
    pending: tasks.filter(t => t.status === 'pending'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed')
  }

  const canEditStatus = (task) => {
    if (isMentor) return true
    return task.assignee_id === user?.id
  }

  const handleCreate = (e) => {
    e.preventDefault()
    if (!newTask.title?.trim()) {
      toast.error('Title is required')
      return
    }
    createMutation.mutate({
      title: newTask.title.trim(),
      description: newTask.description || '',
      assignee_id: newTask.assignee_id || null,
      deadline: newTask.deadline || null
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-primary-600" />
          Tasks
        </h3>
        {isMentor && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        )}
      </div>

      {showCreate && isMentor && (
        <form onSubmit={handleCreate} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-950">
          <input
            type="text"
            placeholder="Task title *"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            required
          />
          <textarea
            placeholder="Description"
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            rows="2"
          />
          <div className="flex flex-wrap gap-3">
            <select
              value={newTask.assignee_id}
              onChange={(e) => setNewTask({ ...newTask, assignee_id: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.user_name}</option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={newTask.deadline}
              onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
              Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-950">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <div key={value} className="border border-gray-200 rounded-lg p-3 bg-gray-950">
            <div className="font-medium text-gray-300 mb-2">{label}</div>
            <div className="space-y-2">
              {byStatus[value].map((task) => (
                <div key={task.id} className="bg-gray-900 border border-gray-200 rounded-lg p-3 shadow-sm">
                  <div className="font-medium text-white">{task.title}</div>
                  {task.description && <p className="text-sm text-gray-400 mt-1 line-clamp-2">{task.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                    {task.assignee_name && <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{task.assignee_name}</span>}
                    {task.deadline && <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{new Date(task.deadline).toLocaleDateString()}</span>}
                  </div>
                  {canEditStatus(task) && (
                    <select
                      value={task.status}
                      onChange={(e) => updateMutation.mutate({ taskId: task.id, data: { status: e.target.value } })}
                      className="mt-2 text-xs border border-gray-300 rounded px-2 py-1"
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TaskBoard
