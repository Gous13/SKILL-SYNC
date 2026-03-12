import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react'

const TeamSkillValidation = ({ teamId }) => {
  const { data: validation, isLoading } = useQuery({
    queryKey: ['team-skill-validation', teamId],
    queryFn: async () => {
      const res = await api.get(`/teams/${teamId}/skill-validation`)
      return res.data
    },
    enabled: !!teamId
  })

  if (!teamId) return null
  if (isLoading) return <div className="text-sm text-gray-400">Loading validation...</div>
  if (!validation || validation.error) return null

  const { confidence_score, coverage, warnings } = validation
  const isLow = confidence_score < 1

  return (
    <div className={`rounded-lg p-4 border ${isLow ? 'bg-amber-900/10 border-amber-200' : 'bg-green-900/10 border-green-200'}`}>
      <div className="flex items-center gap-2 mb-2">
        {isLow ? (
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        ) : (
          <CheckCircle className="w-5 h-5 text-green-600" />
        )}
        <span className="font-semibold text-white">
          Team Skill Confidence: {(confidence_score * 100).toFixed(0)}%
        </span>
      </div>
      {warnings?.length > 0 && (
        <ul className="text-sm text-amber-700 list-disc list-inside space-y-0.5">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      {coverage?.length > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          {coverage.filter(c => c.covered).length}/{coverage.length} required skills covered
        </div>
      )}
    </div>
  )
}

export default TeamSkillValidation
