import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { X, CheckCircle, XCircle } from 'lucide-react'

const SkillAssessmentModal = ({ skill, onClose, onComplete }) => {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchQuestions = async () => {
      if (!skill?.skill_name) return
      setLoading(true)
      setError(null)
      try {
        const res = await api.get(`/skills/assessment/${encodeURIComponent(skill.skill_name)}`)
        setQuestions(res.data.questions || [])
        setAnswers({})
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load assessment')
      } finally {
        setLoading(false)
      }
    }
    fetchQuestions()
  }, [skill?.skill_name])

  const handleAnswer = (questionId, option) => {
    setAnswers(prev => ({ ...prev, [String(questionId)]: option }))
  }

  const handleSubmit = async () => {
    if (!skill?.id) return
    const answered = Object.keys(answers).length
    if (answered < questions.length) {
      setError(`Please answer all ${questions.length} questions`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await api.post(`/skills/assess/${skill.id}`, { answers })
      setResult(res.data)
      if (res.data.passed) {
        onComplete?.(res.data.skill)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Assessment failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (!skill) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            Skill Assessment: {skill.skill_name}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading questions...</div>
          ) : result ? (
            <div className="text-center py-8">
              {result.passed ? (
                <div>
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <p className="text-xl font-semibold text-green-700">Congratulations! You passed!</p>
                  <p className="text-gray-400 mt-2">
                    Score: {result.score}% ({result.correct}/{result.total} correct)
                  </p>
                  <p className="text-sm text-gray-400 mt-1">{skill.skill_name} is now verified.</p>
                  <button
                    onClick={onClose}
                    className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div>
                  <XCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                  <p className="text-xl font-semibold text-amber-700">Not passed this time</p>
                  <p className="text-gray-400 mt-2">
                    Score: {result.score}% ({result.correct}/{result.total} correct)
                  </p>
                  <p className="text-sm text-gray-400 mt-1">You need 70% to verify. Try again later.</p>
                  <button
                    onClick={() => { setResult(null); setAnswers({}) }}
                    className="mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-950"
                  >
                    Retry
                  </button>
                  <button
                    onClick={onClose}
                    className="mt-4 ml-2 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-950"
              >
                Close
              </button>
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No assessment available for this skill yet.
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((q) => (
                <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                  <p className="font-medium text-white mb-3">{q.question_text}</p>
                  <div className="space-y-2">
                    {['a', 'b', 'c', 'd'].map((opt) => {
                      const val = q[`option_${opt}`]
                      if (!val) return null
                      const selected = answers[String(q.id)] === opt
                      return (
                        <label
                          key={opt}
                          className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                            selected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-950'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q_${q.id}`}
                            value={opt}
                            checked={selected}
                            onChange={() => handleAnswer(q.id, opt)}
                            className="mr-3"
                          />
                          <span className="text-gray-200">{val}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-950"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || Object.keys(answers).length < questions.length}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Assessment'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SkillAssessmentModal
