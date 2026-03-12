"""
Matching and similarity models for explainable AI
"""

from extensions import db
from datetime import datetime

class SimilarityScore(db.Model):
    """Stores computed similarity scores between profiles and projects"""
    __tablename__ = 'similarity_scores'
    
    id = db.Column(db.Integer, primary_key=True)
    profile_id = db.Column(db.Integer, db.ForeignKey('student_profiles.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)
    hackathon_id = db.Column(db.Integer, db.ForeignKey('hackathons.id'), nullable=True)
    
    # Similarity scores (0-1 range)
    overall_similarity = db.Column(db.Float, nullable=False)
    skills_similarity = db.Column(db.Float)
    interests_similarity = db.Column(db.Float)
    experience_similarity = db.Column(db.Float)
    
    # Metadata
    computed_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    profile = db.relationship('StudentProfile', backref='similarity_scores', lazy=True)
    project = db.relationship('Project', backref='similarity_scores', lazy=True)
    hackathon = db.relationship('Hackathon', backref='similarity_scores', lazy=True)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'profile_id': self.profile_id,
            'project_id': self.project_id,
            'hackathon_id': self.hackathon_id,
            'overall_similarity': self.overall_similarity,
            'skills_similarity': self.skills_similarity,
            'interests_similarity': self.interests_similarity,
            'experience_similarity': self.experience_similarity,
            'computed_at': self.computed_at.isoformat() if self.computed_at else None
        }

class MatchExplanation(db.Model):
    """Stores explainable AI explanations for matches"""
    __tablename__ = 'match_explanations'
    
    id = db.Column(db.Integer, primary_key=True)
    similarity_score_id = db.Column(db.Integer, db.ForeignKey('similarity_scores.id'), nullable=False)
    
    # Explanation components
    explanation_text = db.Column(db.Text, nullable=False)  # Human-readable explanation
    overlapping_skills = db.Column(db.Text)  # JSON array of matched skills
    strengths = db.Column(db.Text)  # JSON array of strengths
    recommendations = db.Column(db.Text)  # JSON array of recommendations
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    similarity_score = db.relationship('SimilarityScore', backref='explanation', uselist=False, lazy=True)
    
    def to_dict(self):
        """Convert to dictionary"""
        import json
        return {
            'id': self.id,
            'similarity_score_id': self.similarity_score_id,
            'explanation_text': self.explanation_text,
            'overlapping_skills': json.loads(self.overlapping_skills) if self.overlapping_skills else [],
            'strengths': json.loads(self.strengths) if self.strengths else [],
            'recommendations': json.loads(self.recommendations) if self.recommendations else [],
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
