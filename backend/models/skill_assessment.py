"""
Skill assessment question bank for MCQ-based verification
"""

from extensions import db
from datetime import datetime


class SkillAssessment(db.Model):
    """MCQ question for a skill"""
    __tablename__ = 'skill_assessments'

    id = db.Column(db.Integer, primary_key=True)
    skill_name = db.Column(db.String(100), nullable=False, index=True)
    question_text = db.Column(db.Text, nullable=False)
    option_a = db.Column(db.String(255), nullable=False)
    option_b = db.Column(db.String(255), nullable=False)
    option_c = db.Column(db.String(255), nullable=False)
    option_d = db.Column(db.String(255), nullable=False)
    correct_option = db.Column(db.String(1), nullable=False)  # 'a', 'b', 'c', 'd'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'skill_name': self.skill_name,
            'question_text': self.question_text,
            'option_a': self.option_a,
            'option_b': self.option_b,
            'option_c': self.option_c,
            'option_d': self.option_d,
            'correct_option': self.correct_option,
        }


class SkillAssessmentResult(db.Model):
    """Result of a student's skill assessment attempt"""
    __tablename__ = 'skill_assessment_results'

    id = db.Column(db.Integer, primary_key=True)
    student_skill_id = db.Column(db.Integer, db.ForeignKey('student_skills.id'), nullable=False)
    answers = db.Column(db.Text)  # JSON: {question_id: selected_option}
    score = db.Column(db.Float, nullable=False)
    passed = db.Column(db.Boolean, nullable=False)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)
