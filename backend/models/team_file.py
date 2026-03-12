"""
Team file model for secure file upload and sharing
"""

from extensions import db
from datetime import datetime


class TeamFile(db.Model):
    """Metadata for files uploaded to team workspace"""
    __tablename__ = 'team_files'

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=False, index=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True, index=True)
    file_name = db.Column(db.String(255), nullable=False)
    storage_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))
    uploader_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    uploader = db.relationship('User', backref='uploaded_files')
    team = db.relationship('Team', backref='files')

    def to_dict(self):
        uploader_name = None
        if self.uploader:
            uploader_name = self.uploader.full_name
        return {
            'id': self.id,
            'team_id': self.team_id,
            'project_id': self.project_id,
            'file_name': self.file_name,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'uploader_id': self.uploader_id,
            'uploader_name': uploader_name,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
        }
