"""
Team and TeamMember models
"""

from extensions import db
from datetime import datetime

class Team(db.Model):
    """Team model for projects and hackathons"""
    __tablename__ = 'teams'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)
    hackathon_id = db.Column(db.Integer, db.ForeignKey('hackathons.id'), nullable=True)
    
    # Team status
    status = db.Column(db.String(50), default='forming')  # forming, active, completed
    is_locked = db.Column(db.Boolean, default=False)  # Locked teams cannot be modified
    
    # Team metadata
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    members = db.relationship('TeamMember', backref='team', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self, include_members=True):
        """Convert to dictionary"""
        data = {
            'id': self.id,
            'name': self.name,
            'project_id': self.project_id,
            'hackathon_id': self.hackathon_id,
            'project_title': self.project.title if self.project else None,
            'hackathon_title': self.hackathon.title if self.hackathon else None,
            'project_creator_id': self.project.creator_id if self.project else None,
            'status': self.status,
            'is_locked': self.is_locked,
            'description': self.description,
            'member_count': len(self.members) if self.members else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_members and self.members:
            data['members'] = [member.to_dict() for member in self.members]
        return data
    
    def get_member_ids(self):
        """Get list of user IDs in this team"""
        return [member.user_id for member in self.members]

class TeamMember(db.Model):
    """Team membership model"""
    __tablename__ = 'team_members'
    
    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Role in team
    role = db.Column(db.String(50), default='member')  # member, leader, co-leader
    
    # Status
    status = db.Column(db.String(50), default='active')  # active, inactive, removed
    
    # Metadata
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Unique constraint: user can only be in one team per project/hackathon
    __table_args__ = (db.UniqueConstraint('team_id', 'user_id', name='unique_team_member'),)
    
    def to_dict(self):
        """Convert to dictionary"""
        user_name = None
        user_email = None
        
        # Safely access user relationship
        if self.user:
            try:
                user_name = self.user.full_name
                user_email = self.user.email
            except (AttributeError, TypeError):
                # Fallback if full_name property doesn't work
                try:
                    user_name = f"{self.user.first_name} {self.user.last_name}"
                    user_email = self.user.email
                except (AttributeError, TypeError):
                    pass
        
        return {
            'id': self.id,
            'team_id': self.team_id,
            'user_id': self.user_id,
            'user_name': user_name,
            'user_email': user_email,
            'role': self.role,
            'status': self.status,
            'joined_at': self.joined_at.isoformat() if self.joined_at else None
        }
