"""
Student skill model for skill genuineness verification
"""

from extensions import db
from datetime import datetime


class StudentSkill(db.Model):
    """Individual skills with verification status and assessment score"""
    __tablename__ = 'student_skills'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    skill_name = db.Column(db.String(100), nullable=False, index=True)
    status = db.Column(db.String(20), default='unverified')  # unverified, assigned, passed, failed
    assessment_score = db.Column(db.Float)  # 0-100 if verified
    assessed_at = db.Column(db.DateTime)
    assigned_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', 'skill_name', name='unique_user_skill'),)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'skill_name': self.skill_name,
            'status': self.status,
            'assessment_score': self.assessment_score,
            'assessed_at': self.assessed_at.isoformat() if self.assessed_at else None,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
