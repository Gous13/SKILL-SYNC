import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { CheckCircle, AlertCircle, ClipboardList, Play, BookOpen, FileText } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const AVAILABLE_SKILLS = [
  'Python', 'Java', 'JavaScript', 'C++', 'C', 'Data Structures', 
  'Algorithms', 'SQL', 'React', 'Node.js', 'Machine Learning',
  'Artificial Intelligence', 'Web Development', 'Mobile Development'
]

const SkillsSection = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: skillsData } = useQuery({
    queryKey: ['my-skills'],
    queryFn: async () => {
      const res = await api.get('/skills/my-skills')
      return res.data.skills || []
    }
  })

  const { data: assignedExams } = useQuery({
    queryKey: ['assigned-exams'],
    queryFn: async () => {
      try {
        const res = await api.get('/exam/my-assigned')
        return res.data || []
      } catch {
        return []
      }
    }
  })

  const skills = skillsData || []
  const assigned = assignedExams || []
  
  const passedCount = skills.filter(s => s.status === 'passed' || s.status === 'verified').length
  const failedCount = skills.filter(s => s.status === 'failed').length
  const unverifiedCount = skills.filter(s => s.status === 'unverified').length

  const mySkillNames = skills.map(s => s.skill_name.toLowerCase())
  const availableForExam = AVAILABLE_SKILLS.filter(s => !mySkillNames.includes(s.toLowerCase()))

  return (
    <div className="space-y-6">
      {/* Assigned Exams Section */}
      {assigned.length > 0 && (
        <div className="bg-gray-900 rounded-xl shadow-sm p-6 border border-yellow-500/30">
          <h2 className="text-xl font-bold text-white flex items-center mb-4">
            <FileText className="w-5 h-5 mr-2 text-yellow-500" />
            Assigned Exams
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Your mentor has assigned these exams to you:
          </p>
          <div className="flex flex-wrap gap-3">
            {assigned.map((exam) => (
              <button
                key={exam.id}
                onClick={() => navigate(`/exam?skill=${encodeURIComponent(exam.skill_name)}`)}
                className="px-4 py-2 bg-yellow-600 text-white font-bold rounded-lg hover:bg-yellow-500 transition flex items-center"
              >
                <Play className="w-4 h-4 mr-2" />
                Take {exam.skill_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center">
              <ClipboardList className="w-5 h-5 mr-2 text-primary-600" />
              Skill Verification
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Pass practical assessments to unlock project recommendations.
            </p>
          </div>
      </div>

      {skills.length === 0 ? (
        <div className="text-center py-8 bg-gray-950 rounded-xl border border-dashed">
          <p className="text-gray-400 text-sm">Add skills in your profile to start verification.</p>
          <p className="text-gray-500 text-xs mt-2">Use the skills section above to add your skills.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-4 mb-6 text-xs font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-green-600 bg-green-900/10 px-2.5 py-1 rounded-full border border-green-800">
              <CheckCircle className="w-3.5 h-3.5" />
              {passedCount} Verified
            </span>
            {failedCount > 0 && (
              <span className="flex items-center gap-1.5 text-red-600 bg-red-900/10 px-2.5 py-1 rounded-full border border-red-800">
                <AlertCircle className="w-3.5 h-3.5" />
                {failedCount} Failed
              </span>
            )}
            <span className="flex items-center gap-1.5 text-amber-600 bg-amber-900/10 px-2.5 py-1 rounded-full border border-amber-800">
              <AlertCircle className="w-3.5 h-3.5" />
              {unverifiedCount} Unverified
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {skills.map((skill) => {
              const isPassed = skill.status === 'passed' || skill.status === 'verified';
              const isFailed = skill.status === 'failed';

              return (
                <div
                  key={skill.id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isPassed ? 'bg-gray-900 border-green-800 shadow-sm shadow-green-900/20' :
                    isFailed ? 'bg-gray-900 border-red-800 shadow-sm shadow-red-900/20' :
                      'bg-gray-900 border-gray-100 shadow-sm'
                    }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-200">{skill.skill_name}</span>
                    <span className="text-[10px] font-medium text-gray-400 mt-0.5">
                      {isPassed ? `Score: ${skill.assessment_score}%` :
                        isFailed ? 'Verification Failed' : 'Action Required'}
                    </span>
                  </div>

                  {isPassed ? (
                    <div className="flex items-center gap-1 text-green-500 bg-green-900/10 p-1.5 rounded-lg border border-green-800">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  ) : (
                    <button
                      onClick={() => navigate(`/exam?skill=${encodeURIComponent(skill.skill_name)}`)}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${isFailed ? 'bg-gray-800 text-gray-400 hover:bg-gray-200' : 'bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-purple-900/50'
                        }`}
                    >
                      {isFailed ? 'Retake' : 'Verify'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
    </div>
  )
}

export default SkillsSection
