"""
Internal messaging model - universal for Students, Mentors, and Admins
"""

from extensions import db
from datetime import datetime

class Message(db.Model):
    """Internal message - any user can message any other user"""
    __tablename__ = 'messages'
    
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    sender_role = db.Column(db.String(50), nullable=False)  # student, mentor, admin
    receiver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    receiver_role = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    # Categorization for unified notifications/message panel
    # 'message' = direct or group-related chat, 'task' = task assignment/update, 'project' = project events
    type = db.Column(db.String(20), nullable=False, default='message', index=True)
    # Optional link to related domain entity (e.g., project_tasks.id or projects.id)
    related_id = db.Column(db.Integer, nullable=True, index=True)
    # When set, message is hidden from receiver's inbox (clear/delete by receiver)
    deleted_by_receiver_at = db.Column(db.DateTime, nullable=True)
    # Server-generated timestamp (UTC) for consistent chronological ordering
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    sender = db.relationship('User', foreign_keys=[sender_id], lazy=True)
    receiver = db.relationship('User', foreign_keys=[receiver_id], lazy=True)
    
    def to_dict(self, include_sender=False):
        data = {
            'id': self.id,
            'sender_id': self.sender_id,
            'sender_role': self.sender_role,
            'receiver_id': self.receiver_id,
            'receiver_role': self.receiver_role,
            'content': self.content,
            'is_read': self.is_read,
            'type': self.type or 'message',
            'related_id': self.related_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_sender and self.sender:
            data['sender_name'] = self.sender.full_name
        return data
