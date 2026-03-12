"""
Exam models for dynamic AI proctored exams.
"""

from extensions import db
from datetime import datetime

class ExamQuestion(db.Model):
    __tablename__ = 'exam_questions'

    id = db.Column(db.Integer, primary_key=True)
    skill = db.Column(db.String(100), nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    question_type = db.Column(db.String(50), nullable=False, default='Coding') # 'MCQ', 'Short Answer', 'Coding'
    problem_statement = db.Column(db.Text)
    marks = db.Column(db.Integer, default=10)  # Points for this question
    
    # For MCQ
    options_json = db.Column(db.Text) # JSON: {"A": "...", "B": "..."}
    correct_answer = db.Column(db.String(10)) 
    
    # For Coding
    sample_input = db.Column(db.Text)
    sample_output = db.Column(db.Text)
    test_cases_json = db.Column(db.Text)
    
    status = db.Column(db.String(50), default='approved') # 'pending', 'approved', 'rejected'  (From AI)
    is_ai_generated = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        import json
        return {
            'id': self.id,
            'skill': self.skill,
            'title': self.title,
            'type': self.question_type,
            'problem_statement': self.problem_statement,
            'marks': self.marks or 10,
            'options': json.loads(self.options_json) if self.options_json else None,
            'correct_answer': self.correct_answer,
            'sample_input': self.sample_input,
            'sample_output': self.sample_output,
            'test_cases': json.loads(self.test_cases_json) if self.test_cases_json else None,
            'status': self.status,
            'is_ai_generated': self.is_ai_generated,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class ExamResult(db.Model):
    __tablename__ = 'exam_results'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    skill = db.Column(db.String(100), nullable=False, index=True)
    attempt_id = db.Column(db.String(36), nullable=False, unique=True, index=True)
    
    answers_json = db.Column(db.Text)  # JSON: {question_id: "answer"}
    score = db.Column(db.Float)
    
    proctoring_flags = db.Column(db.Integer, default=0)
    proctoring_logs_json = db.Column(db.Text)
    proctor_logs_json = db.Column(db.Text)
    
    status = db.Column(db.String(50), default='IN_PROGRESS') 
    overridden_score = db.Column(db.Float)
    mentor_feedback = db.Column(db.Text)
    
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id])

    __table_args__ = (
        db.Index('ix_exam_results_user_skill_timestamp', 'user_id', 'skill', 'timestamp'),
    )

    def to_dict(self):
        import json
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.full_name if self.user else None,
            'skill': self.skill,
            'attempt_id': self.attempt_id,
            'answers': json.loads(self.answers_json) if self.answers_json else None,
            'score': self.score,
            'proctoring_flags': self.proctoring_flags,
            'proctoring_logs': json.loads(self.proctoring_logs_json) if self.proctoring_logs_json else None,
            'proctor_logs': json.loads(self.proctor_logs_json) if self.proctor_logs_json else None,
            'status': self.status,
            'overridden_score': self.overridden_score,
            'mentor_feedback': self.mentor_feedback,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }
