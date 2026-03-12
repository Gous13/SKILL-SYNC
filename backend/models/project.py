"""
Project and Hackathon models
"""

from extensions import db
from datetime import datetime

class Project(db.Model):
    """Academic project model"""
    __tablename__ = 'projects'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    required_skills = db.Column(db.Text)  # Natural language description
    creator_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Project constraints
    min_team_size = db.Column(db.Integer, default=3)
    max_team_size = db.Column(db.Integer, default=5)
    preferred_team_size = db.Column(db.Integer, default=4)
    
    # Status
    status = db.Column(db.String(50), default='open')  # open, team_forming, in_progress, completed
    deadline = db.Column(db.DateTime)
    
    # NLP embedding
    description_embedding = db.Column(db.Text)  # JSON array of floats
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    teams = db.relationship('Team', backref='project', lazy=True)
    
    def to_dict(self, include_teams=False):
        """Convert to dictionary"""
        creator_name = None
        if self.creator:
            try:
                creator_name = self.creator.full_name
            except (AttributeError, TypeError):
                # Fallback if full_name property doesn't work
                try:
                    creator_name = f"{self.creator.first_name} {self.creator.last_name}"
                except (AttributeError, TypeError):
                    pass
        
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'required_skills': self.required_skills,
            'creator_id': self.creator_id,
            'creator_name': creator_name,
            'min_team_size': self.min_team_size,
            'max_team_size': self.max_team_size,
            'preferred_team_size': self.preferred_team_size,
            'status': self.status,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_teams:
            data['teams'] = [team.to_dict() for team in self.teams]
        return data

class Hackathon(db.Model):
    """Hackathon model"""
    __tablename__ = 'hackathons'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    theme = db.Column(db.String(200))
    required_skills = db.Column(db.Text)
    creator_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Team constraints
    min_team_size = db.Column(db.Integer, default=3)
    max_team_size = db.Column(db.Integer, default=5)
    preferred_team_size = db.Column(db.Integer, default=4)
    
    # Dates
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    registration_deadline = db.Column(db.DateTime)
    
    # Status
    status = db.Column(db.String(50), default='upcoming')  # upcoming, open, in_progress, completed
    
    # NLP embedding
    description_embedding = db.Column(db.Text)  # JSON array of floats
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    teams = db.relationship('Team', backref='hackathon', lazy=True)
    
    def to_dict(self, include_teams=False):
        """Convert to dictionary"""
        creator_name = None
        if self.creator:
            try:
                creator_name = self.creator.full_name
            except (AttributeError, TypeError):
                # Fallback if full_name property doesn't work
                try:
                    creator_name = f"{self.creator.first_name} {self.creator.last_name}"
                except (AttributeError, TypeError):
                    pass
        
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'theme': self.theme,
            'required_skills': self.required_skills,
            'creator_id': self.creator_id,
            'creator_name': creator_name,
            'min_team_size': self.min_team_size,
            'max_team_size': self.max_team_size,
            'preferred_team_size': self.preferred_team_size,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'registration_deadline': self.registration_deadline.isoformat() if self.registration_deadline else None,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_teams:
            data['teams'] = [team.to_dict() for team in self.teams]
        return data
