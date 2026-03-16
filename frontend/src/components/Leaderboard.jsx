import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { Trophy, Medal, Crown, RefreshCw, Users, Filter } from 'lucide-react'

const Leaderboard = ({ userRole = 'student' }) => {
  const [selectedSkill, setSelectedSkill] = useState('')
  const [skillFilter, setSkillFilter] = useState('overall')

  const { data: leaderboard, isLoading, refetch } = useQuery({
    queryKey: ['leaderboard', skillFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (skillFilter && skillFilter !== 'overall') params.append('skill', skillFilter)
      params.append('limit', 50)
      const res = await api.get(`/exam/leaderboard?${params.toString()}`)
      return res.data || []
    },
    staleTime: 30000
  })

  const { data: skills = [], isLoading: isLoadingSkills } = useQuery({
    queryKey: ['exam-skills-list'],
    queryFn: async () => {
      const res = await api.get('/exam/skills')
      return res.data || []
    }
  })

  const handleSkillChange = (e) => {
    const val = e.target.value
    setSelectedSkill(val)
    setSkillFilter(val || 'overall')
  }

  const getRankStyle = (rank) => {
    if (rank === 1) return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-500', icon: <Crown className="w-5 h-5 fill-yellow-500" /> }
    if (rank === 2) return { bg: 'bg-slate-300/10', border: 'border-slate-300/30', text: 'text-slate-300', icon: <Medal className="w-5 h-5 fill-slate-300" /> }
    if (rank === 3) return { bg: 'bg-amber-600/10', border: 'border-amber-600/30', text: 'text-amber-600', icon: <Medal className="w-5 h-5 fill-amber-600" /> }
    return { bg: 'bg-gray-800/10', border: 'border-gray-800', text: 'text-gray-400', icon: null }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-100 rounded-2xl">
            <Trophy className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              Rankings
            </h2>
            <p className="text-gray-500 text-sm font-medium flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              Showing top performers
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:block">Filter by Mastery:</span>
            <div className="relative group">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-hover:text-purple-500 transition-colors pointer-events-none" />
              <select
                value={selectedSkill}
                onChange={handleSkillChange}
                disabled={isLoadingSkills}
                className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 hover:border-gray-300 transition-all cursor-pointer shadow-sm disabled:opacity-50 min-w-[140px]"
              >
                <option value="">Overall Ranking</option>
                {isLoadingSkills ? (
                  <option disabled>Loading skills...</option>
                ) : (
                  skills.map(skill => (
                    <option key={skill} value={skill}>{skill}</option>
                  ))
                )}
              </select>
            </div>
          </div>
          
          <button
            onClick={() => refetch()}
            className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-purple-600 transition-all active:scale-95 shadow-sm"
            title="Refresh Rankings"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <RefreshCw className="w-10 h-10 text-purple-500 animate-spin" />
          <p className="mt-4 text-gray-500 font-bold uppercase tracking-widest text-xs">Crunching data...</p>
        </div>
      ) : leaderboard && leaderboard.length > 0 ? (
        <div className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-3">
              <thead>
                <tr className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
                  <th className="px-6 py-2">Rank</th>
                  <th className="px-6 py-2">Participant</th>
                  <th className="px-6 py-2">Mastery Area</th>
                  <th className="px-6 py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => {
                  const style = getRankStyle(entry.rank)
                  const isTopThree = entry.rank <= 3
                  
                  return (
                    <tr 
                      key={`${entry.user_id}-${entry.skill}`} 
                      className={`group transition-all duration-300 hover:-translate-y-0.5`}
                    >
                      <td className={`px-6 py-4 rounded-l-2xl border-y border-l transition-colors ${isTopThree ? `${style.bg} ${style.border}` : 'bg-white border-gray-100 group-hover:bg-gray-50'}`}>
                        <div className="flex items-center gap-3">
                          <span className={`flex items-center justify-center w-8 h-8 rounded-lg font-black text-sm ${isTopThree ? style.text : 'text-gray-400 bg-gray-50 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors'}`}>
                            {entry.rank}
                          </span>
                          {style.icon}
                        </div>
                      </td>
                      <td className={`px-6 py-4 border-y transition-colors ${isTopThree ? `${style.bg} ${style.border}` : 'bg-white border-gray-100 group-hover:bg-gray-50'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${isTopThree ? `${style.border} bg-white ${style.text}` : 'bg-gray-100 border-gray-200 text-gray-500 shadow-inner'}`}>
                            {entry.user_name.charAt(0)}
                          </div>
                          <div>
                            <span className={`block font-bold tracking-tight ${isTopThree ? 'text-gray-900' : 'text-gray-700'}`}>
                              {entry.user_name}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Candidate</span>
                          </div>
                        </div>
                      </td>
                      <td className={`px-6 py-4 border-y transition-colors ${isTopThree ? `${style.bg} ${style.border}` : 'bg-white border-gray-100 group-hover:bg-gray-50'}`}>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${isTopThree ? `${style.border} bg-white ${style.text}` : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                          {entry.skill}
                        </span>
                      </td>
                      <td className={`px-6 py-4 rounded-r-2xl border-y border-r text-right transition-colors ${isTopThree ? `${style.bg} ${style.border}` : 'bg-white border-gray-100 group-hover:bg-gray-50'}`}>
                        <div className="flex flex-col items-end">
                          <span className={`text-xl font-black italic tracking-tighter ${isTopThree ? style.text : 'text-gray-900 group-hover:text-purple-600 transition-colors'}`}>
                            {entry.score}{(!skillFilter || skillFilter === 'overall') ? '' : '%'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Points</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-[2rem] border border-gray-100 border-dashed">
          <div className="p-5 rounded-full bg-white shadow-sm mb-4">
            <Trophy className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">No Rankings Yet</h3>
          <p className="text-gray-500 mt-2 max-w-xs text-center text-sm">
            {selectedSkill 
              ? `Be the first to master ${selectedSkill} and claim the top spot!`
              : "Complete an assessment to start your journey to the leaderboard."}
          </p>
          <button 
             onClick={() => refetch()}
             className="mt-6 px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-purple-200 active:scale-95"
          >
            Refresh Now
          </button>
        </div>
      )}
    </div>
  )
}

export default Leaderboard
