"""
Project task model for GitHub-like progress tracking
"""

from extensions import db
from datetime import datetime


class ProjectTask(db.Model):
    """Task within a team's project workspace"""
    __tablename__ = 'project_tasks'

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=False, index=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    assignee_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    status = db.Column(db.String(20), default='pending')  # pending, in_progress, completed
    deadline = db.Column(db.DateTime)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    assignee = db.relationship('User', foreign_keys=[assignee_id])
    creator = db.relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        assignee_name = None
        if self.assignee:
            assignee_name = self.assignee.full_name
        creator_name = None
        if self.creator:
            creator_name = self.creator.full_name
        return {
            'id': self.id,
            'team_id': self.team_id,
            'project_id': self.project_id,
            'title': self.title,
            'description': self.description or '',
            'assignee_id': self.assignee_id,
            'assignee_name': assignee_name,
            'status': self.status,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'created_by': self.created_by,
            'creator_name': creator_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
