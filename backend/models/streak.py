"""
UserStreak model – tracks daily learning streaks per student.
"""

from extensions import db
from datetime import datetime, date


class UserStreak(db.Model):
    """Tracks a student's consecutive daily learning activity."""
    __tablename__ = 'user_streaks'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False, index=True)
    streak_count = db.Column(db.Integer, default=0, nullable=False)       # current consecutive days
    longest_streak = db.Column(db.Integer, default=0, nullable=False)     # all-time best
    last_active_date = db.Column(db.Date, nullable=True)                  # date of last qualifying activity
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref='streak', uselist=False)

    def to_dict(self):
        return {
            'user_id': self.user_id,
            'streak_count': self.streak_count,
            'longest_streak': self.longest_streak,
            'last_active_date': self.last_active_date.isoformat() if self.last_active_date else None,
            'user_name': self.user.full_name if self.user else None,
        }
