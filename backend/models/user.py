"""
User and Role models
"""

from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

class Role(db.Model):
    """User roles: Student, Mentor, Admin"""
    __tablename__ = 'roles'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    users = db.relationship('User', backref='role', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description
        }

class User(db.Model):
    """User model for authentication and basic info"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    is_blocked = db.Column(db.Boolean, default=False)
    blocked_reason = db.Column(db.String(255))
    blocked_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    profile = db.relationship('StudentProfile', backref='user', uselist=False, lazy=True)
    created_projects = db.relationship('Project', backref='creator', lazy=True, foreign_keys='Project.creator_id')
    created_hackathons = db.relationship('Hackathon', backref='creator', lazy=True, foreign_keys='Hackathon.creator_id')
    team_memberships = db.relationship('TeamMember', backref='user', lazy=True)
    
    @property
    def full_name(self):
        """Return full name as a property"""
        return f"{self.first_name} {self.last_name}"
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Verify password"""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self, include_profile=False):
        """Convert to dictionary"""
        data = {
            'id': self.id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': f"{self.first_name} {self.last_name}",
            'role': self.role.name if self.role else None,
            'role_id': self.role_id,
            'is_active': self.is_active,
            'is_blocked': self.is_blocked,
            'blocked_reason': self.blocked_reason,
            'blocked_at': self.blocked_at.isoformat() if self.blocked_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_profile and self.profile:
            data['profile'] = self.profile.to_dict()
        return data
