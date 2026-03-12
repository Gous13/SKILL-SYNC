"""
Practical assessment models for dynamic skill verification.
Stores questions, sets (easy+hard), and attempts - separate from MCQ-based skill_assessments.
"""

from extensions import db
from datetime import datetime


class AssessmentQuestion(db.Model):
    """Practical question: easy or hard, with code/output expectations"""
    __tablename__ = 'assessment_questions'

    id = db.Column(db.Integer, primary_key=True)
    skill_name = db.Column(db.String(100), nullable=False, index=True)
    difficulty = db.Column(db.String(20), nullable=False)  # easy, hard
    question_text = db.Column(db.Text, nullable=False)
    starter_code = db.Column(db.Text)
    expected_output = db.Column(db.Text)
    test_cases_json = db.Column(db.Text)  # JSON: [{"input":"...", "expected":"..."}]
    evaluation_type = db.Column(db.String(30), nullable=False)  # sql, python, web, cpp, java
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'skill_name': self.skill_name,
            'difficulty': self.difficulty,
            'question_text': self.question_text,
            'starter_code': self.starter_code or '',
            'evaluation_type': self.evaluation_type,
        }


class AssessmentSet(db.Model):
    """One easy + one hard question per skill - randomized set"""
    __tablename__ = 'assessment_sets'

    id = db.Column(db.Integer, primary_key=True)
    skill_name = db.Column(db.String(100), nullable=False, index=True)
    easy_question_id = db.Column(db.Integer, db.ForeignKey('assessment_questions.id'), nullable=False)
    hard_question_id = db.Column(db.Integer, db.ForeignKey('assessment_questions.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    easy_question = db.relationship('AssessmentQuestion', foreign_keys=[easy_question_id])
    hard_question = db.relationship('AssessmentQuestion', foreign_keys=[hard_question_id])

    def to_dict(self):
        return {
            'id': self.id,
            'skill_name': self.skill_name,
            'easy_question': self.easy_question.to_dict() if self.easy_question else None,
            'hard_question': self.hard_question.to_dict() if self.hard_question else None,
        }


class AssessmentAttempt(db.Model):
    """One student attempt for a skill assessment set"""
    __tablename__ = 'assessment_attempts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    skill_name = db.Column(db.String(100), nullable=False, index=True)
    set_id = db.Column(db.Integer, db.ForeignKey('assessment_sets.id'), nullable=False)
    answers_json = db.Column(db.Text)  # {"question_id": "code or answer"}
    score = db.Column(db.Float)
    passed = db.Column(db.Boolean, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
