import React from 'react'
import Layout from '../components/Layout'
import Leaderboard from '../components/Leaderboard'
import { Trophy, Sparkles } from 'lucide-react'

const LeaderboardPage = () => {
  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-12 py-8 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-purple-900/20 rounded-2xl border border-purple-500/30 mb-2 animate-bounce">
            <Trophy className="w-8 h-8 text-yellow-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
            Global <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-primary-500">Leaderboard</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Recognizing excellence and skill mastery. Compete with top talent from across the platform and climb the ranks.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-purple-600">
            <Sparkles className="w-4 h-4" />
            <span>Updated in real-time based on assessment performance</span>
          </div>
        </div>

        {/* Leaderboard View Container */}
        <div className="bg-white rounded-[2.5rem] p-4 sm:p-10 shadow-large border border-gray-100 relative overflow-hidden">
          {/* Subtle background decorative elements */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-50 rounded-full blur-3xl opacity-50 -z-10"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-50 rounded-full blur-3xl opacity-50 -z-10"></div>
          
          <Leaderboard userRole="student" />
        </div>

        {/* Footer Info */}
        <div className="text-center text-gray-500 text-sm">
          <p>Scoring is based on accuracy, complexity, and completion time of skill assessments.</p>
        </div>
      </div>
    </Layout>
  )
}

export default LeaderboardPage
