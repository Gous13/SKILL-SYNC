import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import { X, CheckCircle, XCircle, Clock, Code, Play, Send, Terminal, AlertCircle } from 'lucide-react'

const ASSESSMENT_DURATION_MINUTES = 15

const PracticalAssessmentModal = ({ skill, onClose, onComplete }) => {
  const [step, setStep] = useState('check') // check | ready | questions | result
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [assessment, setAssessment] = useState(null)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [answers, setAnswers] = useState({}) // { questionId: code }
  const [outputs, setOutputs] = useState({}) // { questionId: { message, success } }
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [running, setRunning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(ASSESSMENT_DURATION_MINUTES * 60)
  const [timerActive, setTimerActive] = useState(false)

  const startTimer = useCallback(() => {
    setTimerActive(true)
    setSecondsLeft(ASSESSMENT_DURATION_MINUTES * 60)
  }, [])

  useEffect(() => {
    if (!timerActive) return
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t)
          setTimerActive(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [timerActive])

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleStart = async () => {
    if (!skill?.id) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.post(`/skills/practical/start/${skill.id}`)
      setAssessment(res.data)
      const initialAnswers = {}
      res.data.questions?.forEach(q => {
        initialAnswers[String(q.id)] = ''
      })
      setAnswers(initialAnswers)
      setStep('questions')
      startTimer()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start assessment')
    } finally {
      setLoading(false)
    }
  }

  const handleCheck = async () => {
    if (!skill?.id) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/skills/practical/check/${skill.id}`)
      if (res.data.available) {
        setStep('ready')
      } else {
        setError(res.data.message || 'Assessment not available')
        setStep('check')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to check availability')
      setStep('check')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (skill?.id && step === 'check') {
      handleCheck()
    }
  }, [skill?.id])

  const handleCodeChange = (e) => {
    const q = assessment.questions[currentQuestionIdx]
    setAnswers(prev => ({ ...prev, [String(q.id)]: e.target.value }))
  }

  const handleRun = async () => {
    const q = assessment.questions[currentQuestionIdx]
    const code = answers[String(q.id)]

    setRunning(true)
    try {
      const res = await api.post('/skills/practical/run', {
        student_skill_id: skill.id,
        question_id: q.id,
        code: code
      })
      setOutputs(prev => ({ ...prev, [String(q.id)]: res.data }))
    } catch (err) {
      setOutputs(prev => ({
        ...prev,
        [String(q.id)]: { message: err.response?.data?.error || 'Execution failed', success: false }
      }))
    } finally {
      setRunning(false)
    }
  }

  const handleSubmit = async () => {
    if (!assessment?.set_id || !skill?.id) return

    // Check if all questions have some code
    const qIds = assessment.questions?.map(q => q.id) || []
    const incomplete = qIds.some(id => !answers[String(id)]?.trim())

    if (incomplete && !window.confirm('Some tasks are empty. Are you sure you want to submit?')) {
      return
    }

    setSubmitting(true)
    setTimerActive(false)
    setError(null)
    try {
      const res = await api.post('/skills/practical/submit', {
        student_skill_id: skill.id,
        set_id: assessment.set_id,
        answers: answers
      })
      setResult(res.data)
      setStep('result')
      // Note: onComplete is now called from the button in the result view
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed. Please try again.')
      setTimerActive(true) // Re-enable timer if submission failed
    } finally {
      setSubmitting(false)
    }
  }

  if (!skill) return null

  const currentQuestion = assessment?.questions?.[currentQuestionIdx]
  const currentOutput = outputs[String(currentQuestion?.id)]

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4 md:p-8">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gray-950 border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-900/30 rounded-lg">
              <Code className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {skill.skill_name} Verification
              </h2>
              {step === 'questions' && (
                <div className="flex items-center gap-4 text-xs font-medium text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Time Remaining: <span className={secondsLeft < 120 ? 'text-red-500' : ''}>{formatTime(secondsLeft)}</span>
                  </span>
                  <span>|</span>
                  <span>Task {currentQuestionIdx + 1} of {assessment.questions.length}</span>
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {step === 'check' && (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              {loading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-12 w-12 bg-gray-200 rounded-full mx-auto"></div>
                  <div className="h-4 w-48 bg-gray-200 rounded mx-auto"></div>
                </div>
              ) : error ? (
                <div className="max-w-md">
                  <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Notice</h3>
                  <p className="text-gray-400 mb-6">{error}</p>
                  <button onClick={onClose} className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                    Go Back
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {step === 'ready' && (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-white to-gray-50">
              <div className="max-w-2xl">
                <div className="w-20 h-20 bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Play className="w-10 h-10 text-primary-600" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Start Practical Assessment</h3>
                <div className="bg-gray-900 border rounded-xl p-6 text-left mb-8 shadow-sm">
                  <h4 className="font-semibold text-white mb-3">Assessment Rules:</h4>
                  <ul className="space-y-3 text-gray-400 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Total 2 Tasks: 1 Easy (40 pts) and 1 Hard (60 pts).
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Time Limit: 15 minutes to complete and submit both.
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Minimum 60% score required to pass.
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      You can "Run" code against sample cases as many times as you want.
                    </li>
                  </ul>
                </div>
                <button
                  onClick={handleStart}
                  className="w-full sm:w-auto px-12 py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all transform hover:-translate-y-0.5"
                >
                  Start Now
                </button>
              </div>
            </div>
          )}

          {step === 'questions' && assessment && (
            <div className="h-full flex flex-col md:flex-row overflow-hidden">
              {/* Left Panel: Problem Statement */}
              <div className="w-full md:w-5/12 border-r flex flex-col bg-gray-900 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                  <div className="flex items-center gap-2 mb-6">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${currentQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                      {currentQuestion.difficulty}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">| {currentQuestion.evaluation_type}</span>
                  </div>

                  <h4 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                    <span className="bg-gray-900 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm">
                      {currentQuestionIdx + 1}
                    </span>
                    Task Description
                  </h4>

                  <div className="prose prose-sm text-gray-300 max-w-none leading-relaxed">
                    <p className="whitespace-pre-wrap text-base">{currentQuestion.question_text}</p>
                  </div>

                  <div className="mt-8 space-y-6">
                    <div>
                      <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Constraints</h5>
                      <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                        <li>Time Limit: 10s per execution</li>
                        <li>Memory Limit: 256MB</li>
                        <li>Output must match exactly</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Question Selector Footer */}
                <div className="p-4 border-t bg-gray-950 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase mr-2">Jump to:</span>
                    {assessment.questions.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentQuestionIdx(idx)}
                        className={`h-9 w-9 rounded-lg font-black text-sm transition-all ${currentQuestionIdx === idx
                          ? 'bg-gray-900 text-white shadow-lg transform scale-110'
                          : 'bg-gray-900 border border-gray-200 text-gray-400 hover:border-gray-900 hover:text-white'
                          }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-900/10 text-red-600 border border-red-800 rounded-lg text-[11px] font-bold animate-pulse">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel: Editor & Console */}
              <div className="w-full md:w-7/12 flex flex-col bg-[#0d1117] overflow-hidden">
                {/* Editor Header */}
                <div className="bg-[#161b22] px-4 py-2 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5 item-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">solution.py</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRun}
                      disabled={running}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 text-white font-bold text-xs rounded-lg hover:bg-gray-600 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Play className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
                      Run Test
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white font-bold text-xs rounded-lg hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {submitting ? 'Sending...' : 'Submit All'}
                    </button>
                  </div>
                </div>

                {/* Editor area */}
                <div className="flex-1 relative border-b border-white/5">
                  <div className="absolute left-0 top-0 bottom-0 w-12 bg-[#0d1117] border-r border-white/5 flex flex-col items-center py-4 text-[10px] font-mono text-gray-400 select-none">
                    {[...Array(20)].map((_, i) => <div key={i}>{i + 1}</div>)}
                  </div>
                  <textarea
                    value={answers[String(currentQuestion.id)] || ''}
                    onChange={handleCodeChange}
                    className="absolute inset-0 w-full h-full bg-transparent text-gray-100 pl-16 pr-6 py-4 font-mono text-sm resize-none focus:outline-none leading-relaxed"
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    placeholder="// Write your solution here..."
                  />
                </div>

                {/* Console / Output area */}
                <div className={`h-48 flex flex-col bg-[#0d1117] transition-all border-t border-white/10 ${currentOutput ? 'translate-y-0' : 'translate-y-0'}`}>
                  <div className="bg-[#161b22] px-4 py-1.5 flex items-center justify-between border-b border-white/5">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Terminal className="w-3 h-3" /> Execution Results
                    </span>
                    {currentOutput && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${currentOutput.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                        {currentOutput.success ? 'All Passed' : 'Fail'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
                    {!currentOutput ? (
                      <div className="text-gray-400 italic text-xs">Run your code to see the output here...</div>
                    ) : (
                      <div className="space-y-2">
                        <div className={`text-xs font-bold ${currentOutput.success ? 'text-green-400' : 'text-amber-400'}`}>
                          {currentOutput.success ? '✔ SUCCESS' : '✖ EXECUTION COMPLETED'}
                        </div>
                        <div className="text-gray-400 text-xs">
                          Passed: <span className="text-white font-bold">{currentOutput.passed_count}</span> / {currentOutput.total_count} test cases
                        </div>
                        <div className="bg-black/30 p-2 rounded border border-white/5 text-xs text-gray-300 whitespace-pre-wrap">
                          {currentOutput.message}
                        </div>
                        {currentOutput.results?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {currentOutput.results.slice(0, 3).map((res, i) => (
                              <div key={i} className="text-[10px] flex items-center gap-2">
                                <span className={res.passed ? 'text-green-500' : 'text-red-500'}>
                                  {res.passed ? '●' : '○'}
                                </span>
                                <span className="text-gray-400">Case {i + 1}:</span>
                                <span className="text-gray-400 truncate max-w-[200px]">
                                  {res.passed ? 'Matches expected output' : `Got "${res.got}" instead of "${res.expected}"`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gray-950">
              <div className="max-w-md w-full bg-gray-900 border rounded-2xl p-8 shadow-xl">
                {result.passed ? (
                  <>
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-12 h-12 text-green-600" />
                    </div>
                    <h3 className="text-3xl font-extrabold text-white mb-2">Verified!</h3>
                    <p className="text-gray-400 mb-6 font-medium">Congratulations! You&apos;ve passed the assessment.</p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <XCircle className="w-12 h-12 text-red-600" />
                    </div>
                    <h3 className="text-3xl font-extrabold text-white mb-2">Not Verified</h3>
                    <p className="text-gray-400 mb-6 font-medium">You didn&apos;t meet the 60% score requirement this time.</p>
                  </>
                )}

                <div className="flex flex-col gap-3 mb-8">
                  <div className="flex items-center justify-between p-4 bg-gray-950 rounded-xl">
                    <span className="text-sm font-bold text-gray-400 uppercase">Overall Score</span>
                    <span className={`text-2xl font-black ${result.passed ? 'text-green-600' : 'text-red-600'}`}>
                      {result.score}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 border rounded-xl bg-gray-900">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Easy Task</p>
                      <p className="text-lg font-bold text-gray-300">{result.easy_score}%</p>
                    </div>
                    <div className="p-3 border rounded-xl bg-gray-900">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Hard Task</p>
                      <p className="text-lg font-bold text-gray-300">{result.hard_score}%</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (result.passed) {
                      onComplete?.(result.skill);
                    } else {
                      onClose();
                    }
                  }}
                  className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PracticalAssessmentModal
