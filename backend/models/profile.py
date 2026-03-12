"""
Student Profile model for storing detailed student information
"""

from extensions import db
from datetime import datetime

class StudentProfile(db.Model):
    """Detailed student profile with skills, interests, and experience"""
    __tablename__ = 'student_profiles'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    
    # Natural language descriptions
    skills_description = db.Column(db.Text, nullable=False)  # e.g., "Python, React, Machine Learning, NLP"
    interests_description = db.Column(db.Text)  # e.g., "AI, Web Development, Data Science"
    experience_description = db.Column(db.Text)  # e.g., "2 years of web development, 1 hackathon win"
    availability_description = db.Column(db.Text)  # e.g., "Available 20 hours per week, flexible schedule"
    
    # Structured data (optional, for filtering)
    year_of_study = db.Column(db.Integer)  # 1, 2, 3, 4
    department = db.Column(db.String(100))
    gpa = db.Column(db.Float)
    
    # NLP embeddings (stored as JSON string)
    skills_embedding = db.Column(db.Text)  # JSON array of floats
    interests_embedding = db.Column(db.Text)  # JSON array of floats
    experience_embedding = db.Column(db.Text)  # JSON array of floats
    
    # Metadata
    is_complete = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'skills_description': self.skills_description,
            'interests_description': self.interests_description,
            'experience_description': self.experience_description,
            'availability_description': self.availability_description,
            'year_of_study': self.year_of_study,
            'department': self.department,
            'gpa': self.gpa,
            'is_complete': self.is_complete,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def get_full_description(self):
        """Combine all descriptions for NLP processing"""
        parts = []
        if self.skills_description:
            parts.append(f"Skills: {self.skills_description}")
        if self.interests_description:
            parts.append(f"Interests: {self.interests_description}")
        if self.experience_description:
            parts.append(f"Experience: {self.experience_description}")
        if self.availability_description:
            parts.append(f"Availability: {self.availability_description}")
        return " ".join(parts)
