# Skill Assessment Module - Setup & Testing

## Overview

The Skill Assessment Module adds **dynamic, practical code-based verification** for:
- SQL
- Python
- HTML/CSS/JavaScript
- C/C++  
- Java

Each skill has 3–4 randomized question sets. Each set has 1 Easy + 1 Hard task. Assessments are auto-evaluated and only **verified skills** are used by NLP matching.

## Database Tables Added

| Table | Purpose |
|-------|---------|
| `assessment_questions` | Practical questions (easy/hard) with starter_code, evaluation_type |
| `assessment_sets` | Links easy + hard question per skill |
| `assessment_attempts` | User attempts with answers, score, passed |

## Configuration

- `ASSESSMENT_PASSING_THRESHOLD` (default: 60%) – Combined Easy (40%) + Hard (60%) score
- `ASSESSMENT_COOLDOWN_HOURS` (default: 24) – Retry after failed attempt
- `ASSESSMENT_TIMEOUT_SECONDS` (default: 30) – Python execution timeout

## Testing Strategy

1. **Unit tests for evaluators**: Run SQL/Python/Web/static evaluators with sample code
2. **API tests**: Call `/practical/check`, `/practical/start`, `/practical/submit`
3. **E2E**: Login as student → Add skill (e.g., Python) → Verify → Complete Easy+Hard tasks → Verify skill becomes verified
4. **NLP integration**: Ensure recommendations use only verified skills (`/api/skills/verified-only`)

## Skill Mapping

Profile skills map to assessment skills:

- SQL, MySQL, PostgreSQL, SQLite → SQL
- Python → Python
- HTML, CSS, JavaScript, React, Vue → HTML/CSS/JavaScript
- C, C++, CPP → C/C++
- Java → Java
