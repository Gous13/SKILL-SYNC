import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, MessageSquare, CheckSquare, FolderKanban } from 'lucide-react'
import { api } from '../services/api'
import { formatTimestamp } from '../utils/time'

const TYPE_CONFIG = {
  all: { label: 'All' },
  message: { label: 'Messages', icon: MessageSquare },
  task: { label: 'Tasks', icon: CheckSquare },
  project: { label: 'Projects', icon: FolderKanban }
}

const NotificationDropdown = ({ unreadCount = 0 }) => {
  const [open, setOpen] = useState(false)
  const [activeType, setActiveType] = useState('all')
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const queryClient = useQueryClient()

  const { data: notificationsData = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications')
      return res.data.notifications || []
    },
    enabled: open // only fetch when dropdown is open
  })

  const markAsReadMutation = useMutation({
    mutationFn: async (msgId) => {
      await api.put(`/messages/${msgId}/read`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['messages-unread'])
      queryClient.invalidateQueries(['notifications'])
    }
  })

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!open) return
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleToggle = () => {
    setOpen((prev) => !prev)
  }

  const handleNavigate = (notification) => {
    // Mark as read when clicked (only for direct messages with numeric IDs)
    if (notification.id && typeof notification.id === 'number') {
      markAsReadMutation.mutate(notification.id)
    }

    const type = (notification.type || 'message').toLowerCase()

    // Group chat notification — go to messages page (group chats visible in sidebar)
    if (notification.group_chat_id) {
      navigate('/messages')
      setOpen(false)
      return
    }

    if (type === 'message') {
      if (notification.sender_id) {
        navigate(`/messages?with=${notification.sender_id}`)
      } else {
        navigate('/messages')
      }
    } else if (type === 'task') {
      const task = notification.meta?.task
      if (task?.team_id) {
        navigate(`/team/${task.team_id}`)
      }
    } else if (type === 'project') {
      const project = notification.meta?.project
      if (project?.id) {
        navigate(`/project/${project.id}/workspace`)
      }
    }

    setOpen(false)
  }

  const filteredNotifications =
    activeType === 'all'
      ? notificationsData
      : notificationsData.filter((n) => (n.type || 'message').toLowerCase() === activeType)

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex items-center p-2 text-gray-700 hover:text-primary-600 rounded-lg hover:bg-gray-100 transition-all duration-200"
        title="Messages & Notifications"
      >
        <Mail className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-large z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            <div className="mt-2 flex gap-2">
              {['all', 'message', 'task', 'project'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveType(type)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${activeType === type
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                >
                  {TYPE_CONFIG[type].label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto scrollbar-modern">
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-gray-500">Loading...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500 text-center">
                No notifications yet.
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const type = (n.type || 'message').toLowerCase()
                const typeConfig = TYPE_CONFIG[type] || TYPE_CONFIG.message
                const TypeIcon = typeConfig.icon || MessageSquare

                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNavigate(n)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5">
                        <TypeIcon className="w-4 h-4 text-primary-600" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {typeConfig.label}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {formatTimestamp(n.created_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-gray-900 truncate">
                          {n.content}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate('/messages')
              }}
              className="w-full text-xs text-primary-600 hover:text-primary-700 font-medium text-center transition-colors"
            >
              View all messages
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationDropdown

