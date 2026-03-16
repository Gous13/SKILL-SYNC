import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { Flame, Zap, Trophy, Target } from 'lucide-react'

const StreakDropdown = () => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  const { data: streak, isLoading } = useQuery({
    queryKey: ['my-streak'],
    queryFn: async () => {
      const res = await api.get('/streaks/me')
      return res.data
    },
    staleTime: 60000
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

  const current = streak?.streak_count ?? 0
  const longest = streak?.longest_streak ?? 0

  const getFlameColor = (count) => {
    if (count >= 14) return 'text-red-500'
    if (count >= 7) return 'text-orange-500'
    if (count >= 3) return 'text-amber-500'
    return 'text-yellow-400'
  }

  const getMessage = (count) => {
    if (count === 0) return 'Start today to begin your streak!'
    if (count >= 14) return 'You\'re on fire! Keep it going!'
    if (count >= 7) return 'One week strong! Amazing consistency!'
    if (count >= 3) return 'Great momentum! Don\'t break the chain!'
    return 'Keep learning daily to maintain your streak'
  }

  if (isLoading) return null

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-200 ${
          open 
            ? 'bg-orange-50 border-orange-200 text-orange-600' 
            : 'bg-gray-50 border-gray-100 text-gray-700 hover:bg-orange-50 hover:border-orange-100 hover:text-orange-600'
        }`}
      >
        <Flame className={`w-4 h-4 ${getFlameColor(current)} ${current > 0 ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-bold">{current}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-large z-50 overflow-hidden transform origin-top-right transition-all duration-200">
          <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 border-b border-orange-100">
            <div className="flex items-center gap-2 mb-1">
              <Flame className={`w-5 h-5 ${getFlameColor(current)}`} />
              <span className="text-sm font-bold text-gray-900">Learning Streak</span>
            </div>
            <p className="text-xs text-orange-700 font-medium">
              {getMessage(current)}
            </p>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 rounded-lg">
                  <Flame className={`w-4 h-4 ${getFlameColor(current)}`} />
                </div>
                <span className="text-sm font-medium text-gray-600">Current Streak</span>
              </div>
              <span className="text-lg font-bold text-gray-900">{current} days</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 rounded-lg">
                  <Trophy className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-gray-600">Best Streak</span>
              </div>
              <span className="text-lg font-bold text-gray-900">{longest} days</span>
            </div>

            {current > 0 && (
              <div className="pt-2 border-t border-gray-100 italic text-[10px] text-gray-400 text-center">
                Last active: {streak?.last_active_date ? new Date(streak.last_active_date).toLocaleDateString() : 'Today'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default StreakDropdown
