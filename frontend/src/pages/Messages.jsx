import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import Layout from '../components/Layout'
import toast from 'react-hot-toast'
import { Mail, Send, UserPlus, Search, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { formatTimestamp } from '../utils/time'

const Messages = () => {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const withUserId = searchParams.get('with')
  const groupChatIdParam = searchParams.get('group')
  const [selectedUserId, setSelectedUserId] = useState(
    withUserId ? parseInt(withUserId, 10) : null
  )
  const [selectedGroupChatId, setSelectedGroupChatId] = useState(
    groupChatIdParam ? parseInt(groupChatIdParam, 10) : null
  )
  const [showNewChat, setShowNewChat] = useState(false)
  const [emailSearch, setEmailSearch] = useState('')
  const [replyText, setReplyText] = useState('')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  const { data: conversationsData, isLoading: convLoading } = useQuery({
    queryKey: ['messages-conversations'],
    queryFn: async () => {
      const res = await api.get('/messages/conversations')
      return res.data.conversations || []
    }
  })

  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ['messages-thread', selectedUserId],
    queryFn: async () => {
      const res = await api.get(`/messages/conversations/${selectedUserId}`)
      return res.data
    },
    enabled: !!selectedUserId && !selectedGroupChatId && !showNewChat
  })

  const { data: groupChatData, isLoading: groupChatLoading } = useQuery({
    queryKey: ['messages-group-chat', selectedGroupChatId],
    queryFn: async () => {
      const res = await api.get(`/messages/group-chats/${selectedGroupChatId}`)
      return res.data
    },
    enabled: !!selectedGroupChatId
  })

  useEffect(() => {
    if (threadData && selectedUserId) {
      queryClient.invalidateQueries(['messages-unread'])
      queryClient.invalidateQueries(['messages-conversations'])
    }
  }, [threadData, selectedUserId, queryClient])

  useEffect(() => {
    if (groupChatData && selectedGroupChatId) {
      queryClient.invalidateQueries(['messages-unread'])
      queryClient.invalidateQueries(['messages-conversations'])
    }
  }, [groupChatData, selectedGroupChatId, queryClient])

  const [debouncedEmail, setDebouncedEmail] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedEmail(emailSearch), 300)
    return () => clearTimeout(t)
  }, [emailSearch])

  const { data: recipientsData } = useQuery({
    queryKey: ['messages-recipients', debouncedEmail],
    queryFn: async () => {
      const res = await api.get(`/messages/recipients?q=${encodeURIComponent(debouncedEmail)}`)
      return res.data.users || []
    },
    enabled: showNewChat && debouncedEmail.length >= 2
  })

  const sendMutation = useMutation({
    mutationFn: async (data) => api.post('/messages', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['messages-conversations'])
      queryClient.invalidateQueries(['messages-thread', selectedUserId])
      queryClient.invalidateQueries(['messages-unread'])
      setReplyText('')
      toast.success('Sent!')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to send')
  })

  const sendGroupMutation = useMutation({
    mutationFn: async (data) => api.post(`/messages/group-chats/${selectedGroupChatId}/messages`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['messages-conversations'])
      queryClient.invalidateQueries(['messages-group-chat', selectedGroupChatId])
      setReplyText('')
      toast.success('Sent!')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to send')
  })

  useEffect(() => {
    if (withUserId) {
      const id = parseInt(withUserId, 10)
      if (!isNaN(id)) {
        setSelectedUserId(id)
        setSelectedGroupChatId(null)
      }
    }
  }, [withUserId])

  useEffect(() => {
    if (groupChatIdParam) {
      const id = parseInt(groupChatIdParam, 10)
      if (!isNaN(id)) {
        setSelectedGroupChatId(id)
        setSelectedUserId(null)
      }
    }
  }, [groupChatIdParam])

  useEffect(() => {
    if (threadData?.messages?.length) scrollToBottom()
  }, [threadData?.messages])

  useEffect(() => {
    if (groupChatData?.messages?.length) scrollToBottom()
  }, [groupChatData?.messages])

  const conversations = conversationsData || []
  const otherUser = threadData?.other_user
  const messages = threadData?.messages || []
  const groupChat = groupChatData?.group_chat
  const groupMessages = groupChatData?.messages || []

  const hasSelection = !!selectedUserId || !!selectedGroupChatId

  const handleSendReply = (e) => {
    e.preventDefault()
    const content = replyText.trim()
    if (!content) return
    if (selectedGroupChatId) {
      sendGroupMutation.mutate({ content })
    } else {
      const receiverId = selectedUserId
      if (!receiverId) return
      sendMutation.mutate({ receiver_id: receiverId, content })
    }
  }

  const handleStartNewChat = (targetUser) => {
    setSelectedUserId(targetUser.id)
    setSelectedGroupChatId(null)
    setShowNewChat(false)
    setEmailSearch('')
    setSearchParams({ with: targetUser.id })
  }

  const handleNewMessage = () => {
    setSelectedUserId(null)
    setSelectedGroupChatId(null)
    setShowNewChat(true)
    setSearchParams({})
  }

  const handleSelectConversation = (conv) => {
    setShowNewChat(false)
    if (conv.type === 'group') {
      setSelectedGroupChatId(conv.group_chat.id)
      setSelectedUserId(null)
      setSearchParams({ group: conv.group_chat.id })
    } else {
      setSelectedUserId(conv.other_user.id)
      setSelectedGroupChatId(null)
      setSearchParams({ with: conv.other_user.id })
    }
  }

  const filteredRecipients = recipientsData || []

  return (
    <Layout>
      <div className="bg-brown-800 rounded-lg shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 12rem)', minHeight: 400 }}>
        <div className="flex h-full">
          {/* Left: Conversations */}
          <div className="w-80 border-r border-brown-600 flex flex-col shrink-0 bg-brown-800">
            <div className="p-4 border-b border-brown-600 flex items-center justify-between">
              <h2 className="text-lg font-bold text-cream-100">Messages</h2>
              <button
                onClick={handleNewMessage}
                className="p-2 text-primary-400 hover:bg-brown-700 rounded-lg"
                title="New message"
              >
                <UserPlus className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {convLoading ? (
                <div className="p-4 text-center text-cream-300 text-sm">Loading...</div>
              ) : conversations.length === 0 && !showNewChat ? (
                <div className="p-4 text-center text-cream-300 text-sm">
                  No conversations yet.
                  <button
                    onClick={handleNewMessage}
                    className="block mt-2 text-primary-400 hover:text-primary-300 font-medium"
                  >
                    Start a chat
                  </button>
                </div>
              ) : showNewChat ? (
                <div className="p-4">
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-cream-300 mb-1">Search by email</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-400" />
                      <input
                        type="text"
                        value={emailSearch}
                        onChange={(e) => setEmailSearch(e.target.value)}
                        placeholder="Type email to search..."
                        className="w-full pl-9 pr-3 py-2 border border-brown-600 bg-brown-700 text-cream-100 placeholder-cream-400/40 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                        autoFocus
                      />
                    </div>
                  </div>
                  {emailSearch.length < 2 ? (
                    <p className="text-xs text-cream-300">Type at least 2 characters</p>
                  ) : (
                    <div className="space-y-1">
                      {filteredRecipients.length === 0 ? (
                        <p className="text-sm text-cream-300">No users found</p>
                      ) : (
                        filteredRecipients.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => handleStartNewChat(u)}
                            className="w-full text-left p-3 rounded-lg hover:bg-brown-700 border border-transparent hover:border-brown-500"
                          >
                            <p className="font-medium text-cream-100 text-sm">{u.full_name}</p>
                            <p className="text-xs text-cream-400">{u.email}</p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => { setShowNewChat(false); setEmailSearch('') }}
                    className="mt-3 text-sm text-cream-300 hover:text-cream-200"
                  >
                    ← Back to conversations
                  </button>
                </div>
              ) : (
                conversations.map((conv) => {
                  const isGroup = conv.type === 'group'
                  const key = isGroup ? `group-${conv.group_chat?.id}` : `user-${conv.other_user?.id}`
                  const displayName = isGroup ? (conv.group_chat?.project_title || conv.group_chat?.name) : conv.other_user?.full_name
                  const last = conv.last_message
                  const preview = last?.content?.length > 40 ? last.content.slice(0, 40) + '...' : last?.content || ''
                  const isSelected = isGroup
                    ? selectedGroupChatId === conv.group_chat?.id
                    : selectedUserId === conv.other_user?.id
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectConversation(conv)}
                      className={`w-full text-left p-4 border-b border-brown-600/50 hover:bg-brown-700 ${
                        isSelected ? 'bg-brown-700 border-l-4 border-l-primary-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        {isGroup && <Users className="w-4 h-4 shrink-0 text-cream-400" />}
                        <span className="font-medium text-cream-100 truncate">{displayName}</span>
                        {conv.unread_count > 0 && (
                          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-500 px-1.5 text-xs font-bold text-white">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-cream-400 truncate mt-0.5">
                        {isGroup && preview ? `${last?.sender_name || 'Someone'}: ` : ''}{preview}
                      </p>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right: Chat thread */}
          <div className="flex-1 flex flex-col min-w-0 bg-brown-800">
            {!hasSelection ? (
              <div className="flex-1 flex items-center justify-center text-cream-400">
                <div className="text-center">
                  <Mail className="w-16 h-16 mx-auto text-brown-500 mb-4" />
                  <p className="font-medium text-cream-200">Select a conversation</p>
                  <p className="text-sm mt-1 text-cream-400">or start a new chat</p>
                </div>
              </div>
            ) : selectedGroupChatId ? (
              /* Group chat */
              <>
                <div className="p-4 border-b border-brown-600 flex items-center gap-2">
                  <Users className="w-5 h-5 text-cream-400" />
                  <div>
                    <h3 className="font-semibold text-cream-100">{groupChat?.project_title || groupChat?.name}</h3>
                    <p className="text-xs text-cream-400">Team group chat • {groupChat?.members?.length || 0} members</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {groupChatLoading ? (
                    <div className="text-center py-8 text-cream-400">Loading...</div>
                  ) : (
                    groupMessages.map((msg) => {
                      const isMine = msg.sender_id === user?.id
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                              isMine
                                ? 'bg-primary-500 text-white rounded-br-md'
                                : 'bg-brown-700 text-cream-100 rounded-bl-md'
                            }`}
                          >
                            {!isMine && (
                              <p className="text-xs font-medium text-cream-400 mb-0.5">{msg.sender_name}</p>
                            )}
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            <p className={`text-xs mt-1 ${isMine ? 'text-cream-200' : 'text-cream-400'}`}>
                              {formatTimestamp(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendReply} className="p-4 border-t border-brown-600">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-3 border border-brown-600 bg-brown-700 text-cream-100 placeholder-cream-400/40 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim() || sendGroupMutation.isLoading}
                      className="p-3 bg-primary-500 text-white rounded-full hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* Direct (1-to-1) chat */
              <>
                <div className="p-4 border-b border-brown-600 flex items-center">
                  <div>
                    <h3 className="font-semibold text-cream-100">{otherUser?.full_name}</h3>
                    <p className="text-xs text-cream-400 capitalize">{otherUser?.role}</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {threadLoading ? (
                    <div className="text-center py-8 text-cream-400">Loading...</div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                            msg.is_mine
                                ? 'bg-primary-500 text-white rounded-br-md'
                                : 'bg-brown-700 text-cream-100 rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={`text-xs mt-1 ${msg.is_mine ? 'text-cream-200' : 'text-cream-400'}`}>
                            {formatTimestamp(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendReply} className="p-4 border-t border-brown-600">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-3 border border-brown-600 bg-brown-700 text-cream-100 placeholder-cream-400/40 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim() || sendMutation.isLoading}
                      className="p-3 bg-primary-500 text-white rounded-full hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Messages
