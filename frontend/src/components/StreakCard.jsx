import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { Flame, Zap } from 'lucide-react'

/**
 * StreakCard – shows a student's current and longest learning streak.
 * Compact, reusable, self-contained data fetching.
 */
const StreakCard = () => {
  const { data: streak, isLoading } = useQuery({
    queryKey: ['my-streak'],
    queryFn: async () => {
      const res = await api.get('/streaks/me')
      return res.data
    },
    staleTime: 60000
  })

  const current = streak?.streak_count ?? 0
  const longest = streak?.longest_streak ?? 0

  const getFlameColor = (count) => {
    if (count >= 14) return 'text-red-500'
    if (count >= 7) return 'text-orange-500'
    if (count >= 3) return 'text-amber-500'
    return 'text-yellow-400'
  }

  if (isLoading) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
        <div className="h-8 bg-gray-100 rounded w-1/4" />
      </div>
    )
  }

  return (
    <div className="card p-5 border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="flex items-start justify-between gap-3">
        {/* Left – current streak */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center">
              <Flame className={`w-7 h-7 ${getFlameColor(current)}`} />
            </div>
            {current >= 3 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <Zap className="w-2.5 h-2.5 text-white" />
              </span>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-0.5">
              Daily Streak
            </p>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-black text-gray-900">{current}</span>
              <span className="text-sm text-gray-500 font-medium mb-1">day{current !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* Right – longest */}
        <div className="text-right">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Best</p>
          <div className="flex items-center justify-end gap-1">
            <Flame className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xl font-bold text-gray-600">{longest}</span>
          </div>
        </div>
      </div>

      {/* Motivational message */}
      <p className="text-xs text-orange-700 font-medium mt-3">
        {current === 0
          ? '🎯 Start today to begin your streak!'
          : current >= 14
          ? '🔥 You\'re on fire! Keep it going!'
          : current >= 7
          ? '⚡ One week strong! Amazing consistency!'
          : current >= 3
          ? '💪 Great momentum! Don\'t break the chain!'
          : '✨ Good start! Aim for 3 days in a row!'}
      </p>
    </div>
  )
}

export default StreakCard
