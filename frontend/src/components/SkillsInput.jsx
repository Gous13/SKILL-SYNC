import { useState, useRef, useEffect } from 'react'
import { searchSkills } from '../data/skills'
import { X } from 'lucide-react'

/**
 * Skills input with autocomplete - typing shows related skills from all domains.
 * E.g., "sql" shows SQL, MySQL, PostgreSQL, etc. "react" shows React, React Native, etc.
 */
const SkillsInput = ({ value, onChange, placeholder = 'Type to search skills (e.g., sql, react)...' }) => {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef(null)

  // Parse comma-separated skills into array
  const selectedSkills = value
    ? value.split(',').map(s => s.trim()).filter(Boolean)
    : []

  useEffect(() => {
    if (inputValue.trim().length >= 2) {
      const results = searchSkills(inputValue, 12)
      // Filter out already selected skills
      const filtered = results.filter(s => !selectedSkills.includes(s))
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
      setHighlightedIndex(-1)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [inputValue, selectedSkills.join(',')])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addSkill = (skill) => {
    if (skill && !selectedSkills.includes(skill)) {
      const updated = [...selectedSkills, skill]
      onChange(updated.join(', '))
      setInputValue('')
      setShowSuggestions(false)
    }
  }

  const removeSkill = (skillToRemove) => {
    const updated = selectedSkills.filter(s => s !== skillToRemove)
    onChange(updated.join(', '))
  }

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter' && inputValue.trim()) {
        // Add custom skill if no match
        addSkill(inputValue.trim())
        e.preventDefault()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        addSkill(suggestions[highlightedIndex])
      } else if (inputValue.trim()) {
        addSkill(inputValue.trim())
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setHighlightedIndex(-1)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="min-h-[80px] px-3 py-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 bg-gray-900">
        {/* Selected skills as tags */}
        {selectedSkills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedSkills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-900/30 text-primary-800 rounded-md text-sm"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="hover:bg-primary-200 rounded p-0.5"
                  aria-label={`Remove ${skill}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue.length >= 2 && setShowSuggestions(suggestions.length > 0)}
          placeholder={selectedSkills.length === 0 ? placeholder : 'Add more skills...'}
          className="w-full border-0 p-0 focus:ring-0 focus:outline-none text-white placeholder-gray-400"
        />
      </div>
      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-auto bg-gray-900 border border-gray-200 rounded-md shadow-lg py-1">
          {suggestions.map((skill, idx) => (
            <li
              key={skill}
              onClick={() => addSkill(skill)}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`px-3 py-2 cursor-pointer text-sm ${
                idx === highlightedIndex ? 'bg-primary-50 text-primary-800' : 'text-gray-300 hover:bg-gray-950'
              }`}
            >
              {skill}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default SkillsInput
