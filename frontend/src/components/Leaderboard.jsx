import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { Trophy, Medal, Crown, Search, RefreshCw } from 'lucide-react'

const Leaderboard = ({ userRole = 'student' }) => {
  const [selectedSkill, setSelectedSkill] = useState('')
  const [skillFilter, setSkillFilter] = useState('')

  const { data: leaderboard, isLoading, refetch } = useQuery({
    queryKey: ['leaderboard', skillFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (skillFilter) params.append('skill', skillFilter)
      params.append('limit', 10)
      const res = await api.get(`/exam/leaderboard?${params.toString()}`)
      return res.data || []
    },
    staleTime: 30000
  })

  const { data: skills } = useQuery({
    queryKey: ['exam-skills'],
    queryFn: async () => {
      const res = await api.get('/exam/results?role=mentor')
      const results = res.data || []
      const uniqueSkills = [...new Set(results.map(r => r.skill))]
      return uniqueSkills
    },
    enabled: userRole === 'mentor'
  })

  const handleSkillChange = (e) => {
    setSelectedSkill(e.target.value)
    setSkillFilter(e.target.value)
  }

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />
    return <span className="text-gray-400 font-bold w-5 text-center">{rank}</span>
  }

  const getRankBg = (rank) => {
    if (rank === 1) return 'bg-yellow-900/20 border-yellow-500/30'
    if (rank === 2) return 'bg-gray-800/50 border-gray-600/30'
    if (rank === 3) return 'bg-amber-900/20 border-amber-500/30'
    return 'bg-gray-900/50 border-gray-800'
  }

  return (
    <div className="bg-gray-900 rounded-lg shadow-sm p-6 border border-purple-900/30">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-bold text-white flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
          Leaderboard
        </h2>
        
        <div className="flex items-center gap-3">
          {userRole === 'mentor' && skills && skills.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={selectedSkill}
                onChange={handleSkillChange}
                className="pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Skills</option>
                {skills.map(skill => (
                  <option key={skill} value={skill}>{skill}</option>
                ))}
              </select>
            </div>
          )}
          
          <button
            onClick={() => refetch()}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading leaderboard...
        </div>
      ) : leaderboard && leaderboard.length > 0 ? (
        <div className="space-y-3">
          {leaderboard.map((entry) => (
            <div
              key={`${entry.user_id}-${entry.skill}-${entry.timestamp}`}
              className={`flex items-center justify-between p-4 rounded-lg border ${getRankBg(entry.rank)} transition hover:scale-[1.01]`}
            >
              <div className="flex items-center gap-4">
                <div className="w-8 flex justify-center">
                  {getRankIcon(entry.rank)}
                </div>
                
                <div>
                  <p className="font-semibold text-white">{entry.user_name}</p>
                  <p className="text-xs text-gray-400">{entry.skill}</p>
                </div>
              </div>
              
              <div className="text-right">
                <p className={`text-xl font-bold ${entry.score >= 60 ? 'text-green-400' : 'text-red-400'}`}>
                  {entry.score}%
                </p>
                {entry.timestamp && (
                  <p className="text-xs text-gray-500">
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No exam results yet.</p>
          <p className="text-sm mt-1">Complete an exam to appear on the leaderboard!</p>
        </div>
      )}
    </div>
  )
}

export default Leaderboard
