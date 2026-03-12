"""
Service layer for practical skill assessment:
- Skill name mapping (profile skill -> assessment skill)
- Random set selection
- Start assessment, submit and evaluate
"""

import json
from typing import Optional, Tuple
import random
from datetime import datetime, timedelta
from extensions import db
from models.student_skill import StudentSkill
from models.practical_assessment import AssessmentQuestion, AssessmentSet, AssessmentAttempt
from services.assessment_evaluator import evaluate


# Map profile skill names to canonical assessment skill names
SKILL_MAP = {
    'sql': 'SQL',
    'mysql': 'SQL',
    'postgresql': 'SQL',
    'sqlite': 'SQL',
    'pl/sql': 'SQL',
    't-sql': 'SQL',
    'nosql': 'SQL',  # optional: could have separate NoSQL later
    'python': 'Python',
    'html': 'HTML/CSS/JavaScript',
    'css': 'HTML/CSS/JavaScript',
    'javascript': 'HTML/CSS/JavaScript',
    'js': 'HTML/CSS/JavaScript',
    'html/css': 'HTML/CSS/JavaScript',
    'html/css/javascript': 'HTML/CSS/JavaScript',
    'web': 'HTML/CSS/JavaScript',
    'react': 'HTML/CSS/JavaScript',
    'vue': 'HTML/CSS/JavaScript',
    'c': 'C/C++',
    'c++': 'C/C++',
    'cpp': 'C/C++',
    'java': 'Java',
}

SUPPORTED_SKILLS = {'SQL', 'Python', 'HTML/CSS/JavaScript', 'C/C++', 'Java'}


def resolve_assessment_skill(profile_skill_name: str) -> Optional[str]:
    """Map a profile skill name to a supported assessment skill, or None if not supported."""
    key = (profile_skill_name or '').strip().lower()
    canonical = SKILL_MAP.get(key)
    if canonical and canonical in SUPPORTED_SKILLS:
        return canonical
    if key in {s.lower() for s in SUPPORTED_SKILLS}:
        return next(s for s in SUPPORTED_SKILLS if s.lower() == key)
    return None


def get_random_set(skill_name: str):
    """Randomly select one assessment set for the skill."""
    sets = AssessmentSet.query.filter_by(skill_name=skill_name).all()
    if not sets:
        return None
    return random.choice(sets)


def can_start_assessment(user_id: int, student_skill) -> Tuple[bool, str]:
    """
    Check if student can start assessment.
    Returns (can_start, message).
    """
    if student_skill.status == 'verified':
        return False, "Skill already verified"
    assessment_skill = resolve_assessment_skill(student_skill.skill_name)
    if not assessment_skill:
        return False, f"No practical assessment available for '{student_skill.skill_name}'"
    if not get_random_set(assessment_skill):
        return False, "No assessment questions seeded for this skill"
    # Cooldown after failed attempt
    from flask import current_app
    cooldown_hours = getattr(current_app.config, 'ASSESSMENT_COOLDOWN_HOURS', 1)
    last_attempt = AssessmentAttempt.query.filter_by(
        user_id=user_id,
        skill_name=assessment_skill,
        passed=False
    ).order_by(AssessmentAttempt.timestamp.desc()).first()
    if last_attempt:
        since = datetime.utcnow() - last_attempt.timestamp
        if since < timedelta(hours=cooldown_hours):
            total_seconds_left = int((timedelta(hours=cooldown_hours) - since).total_seconds())
            hours_left = total_seconds_left // 3600
            minutes_left = (total_seconds_left % 3600) // 60
            
            if hours_left > 0:
                return False, f"Retry after {hours_left} hour(s) and {minutes_left} minute(s)"
            else:
                return False, f"Retry after {minutes_left} minute(s)"
    return True, ""


def start_assessment(user_id: int, student_skill) -> dict | None:
    """Start a practical assessment and return the question set."""
    ok, msg = can_start_assessment(user_id, student_skill)
    if not ok:
        return {'error': msg}
    assessment_skill = resolve_assessment_skill(student_skill.skill_name)
    aset = get_random_set(assessment_skill)
    if not aset:
        return {'error': 'No assessment set available'}
    easy = aset.easy_question
    hard = aset.hard_question
    # Do not expose expected_output or test_cases to client
    return {
        'set_id': aset.id,
        'skill_name': assessment_skill,
        'student_skill_id': student_skill.id,
        'questions': [
            {
                'id': easy.id,
                'difficulty': 'easy',
                'question_text': easy.question_text,
                'starter_code': easy.starter_code or '',
                'evaluation_type': easy.evaluation_type,
            },
            {
                'id': hard.id,
                'difficulty': 'hard',
                'question_text': hard.question_text,
                'starter_code': hard.starter_code or '',
                'evaluation_type': hard.evaluation_type,
            },
        ],
    }


def submit_assessment(user_id: int, student_skill_id: int, set_id: int, answers: dict, timeout: int = 10) -> dict:
    """
    Submit answers, evaluate, compute score, update StudentSkill if passed.
    answers: { "question_id": "code or answer string" }
    """
    student_skill = StudentSkill.query.get(student_skill_id)
    if not student_skill or student_skill.user_id != user_id:
        return {'error': 'Skill not found'}
    assessment_skill = resolve_assessment_skill(student_skill.skill_name)
    if not assessment_skill:
        return {'error': 'Skill not supported for practical assessment'}
    aset = AssessmentSet.query.get(set_id)
    if not aset or aset.skill_name != assessment_skill:
        return {'error': 'Invalid assessment set'}

    questions = [aset.easy_question, aset.hard_question]
    if not all(questions):
        return {'error': 'Invalid question set'}

    # Perform real evaluation using the evaluators in assessment_evaluator.py
    easy_score, easy_msg, easy_detail = evaluate(answers.get(str(aset.easy_question_id), ''), aset.easy_question.to_dict())
    hard_score, hard_msg, hard_detail = evaluate(answers.get(str(aset.hard_question_id), ''), aset.hard_question.to_dict())

    # Weighted final score (Easy: 40%, Hard: 60%)
    final_score = (easy_score * 0.4) + (hard_score * 0.6)
    
    # Passing threshold is 60%
    pass_threshold = 60.0
    passed = final_score >= pass_threshold

    attempt = AssessmentAttempt(
        user_id=user_id,
        skill_name=assessment_skill,
        set_id=set_id,
        answers_json=json.dumps(answers or {}),
        score=final_score,
        passed=passed,
    )
    db.session.add(attempt)

    # Update StudentSkill status
    student_skill.status = 'passed' if passed else 'failed'
    student_skill.assessment_score = round(final_score, 1)
    student_skill.assessed_at = datetime.utcnow()

    db.session.commit()

    def _safe(val):
        if val is None or isinstance(val, (bool, int, float, str)):
            return val
        if hasattr(val, 'isoformat'):
            return val.isoformat()
        return str(val)

    skill_data = {
        'id': int(student_skill.id),
        'user_id': int(student_skill.user_id),
        'skill_name': str(student_skill.skill_name),
        'status': str(student_skill.status),
        'assessment_score': float(student_skill.assessment_score) if student_skill.assessment_score is not None else None,
        'assessed_at': _safe(student_skill.assessed_at),
        'created_at': _safe(student_skill.created_at),
    }

    return {
        'score': float(round(final_score, 1)),
        'passed': passed,
        'skill_status': student_skill.status,
        'easy_score': float(round(easy_score, 1)),
        'hard_score': float(round(hard_score, 1)),
        'easy_message': easy_msg,
        'hard_message': hard_msg,
        'skill': skill_data,
    }


def run_assessment(user_id: int, student_skill_id: int, question_id: int, code: str) -> dict:
    """
    Run code against sample test cases (Run button behavior).
    Does NOT finalize score or update DB.
    """
    from models.practical_assessment import AssessmentQuestion
    q = AssessmentQuestion.query.get(question_id)
    if not q:
        return {'error': 'Question not found'}
    
    score, message, detail = evaluate(code, q.to_dict())
    
    return {
        'score': float(round(score, 1)),
        'message': message,
        'success': score >= 60.0,
        'passed_count': detail.get('passed_count', 0),
        'total_count': detail.get('total_count', 0),
        'results': detail.get('results', [])
    }
