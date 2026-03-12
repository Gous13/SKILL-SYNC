"""
Group chat models for project team collaboration
Extends messaging system to support WhatsApp-like group chats per project
"""

from extensions import db
from datetime import datetime


class GroupChat(db.Model):
    """Project-specific group chat - one per project"""
    __tablename__ = 'group_chats'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False, unique=True)
    name = db.Column(db.String(200), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    project = db.relationship('Project', backref=db.backref('group_chat', uselist=False, lazy=True))
    members = db.relationship('GroupChatMember', backref='group_chat', lazy=True, cascade='all, delete-orphan')
    messages = db.relationship('GroupMessage', backref='group_chat', lazy=True, cascade='all, delete-orphan', order_by='GroupMessage.created_at')

    def to_dict(self, include_members=False, include_project=False):
        data = {
            'id': self.id,
            'project_id': self.project_id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_members and self.members:
            data['members'] = [m.to_dict() for m in self.members]
        if include_project and self.project:
            data['project_title'] = self.project.title
        return data


class GroupChatMember(db.Model):
    """Membership in a group chat"""
    __tablename__ = 'group_chat_members'

    id = db.Column(db.Integer, primary_key=True)
    group_chat_id = db.Column(db.Integer, db.ForeignKey('group_chats.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('group_chat_id', 'user_id', name='unique_group_chat_member'),)

    user = db.relationship('User', backref='group_chat_memberships', lazy=True)

    def to_dict(self):
        user_name = None
        user_email = None
        if self.user:
            try:
                user_name = self.user.full_name
                user_email = self.user.email
            except (AttributeError, TypeError):
                try:
                    user_name = f"{self.user.first_name} {self.user.last_name}"
                    user_email = self.user.email
                except (AttributeError, TypeError):
                    pass

        return {
            'id': self.id,
            'group_chat_id': self.group_chat_id,
            'user_id': self.user_id,
            'user_name': user_name,
            'user_email': user_email,
            'joined_at': self.joined_at.isoformat() if self.joined_at else None
        }


class GroupMessage(db.Model):
    """Message in a group chat"""
    __tablename__ = 'group_messages'

    id = db.Column(db.Integer, primary_key=True)
    group_chat_id = db.Column(db.Integer, db.ForeignKey('group_chats.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    sender = db.relationship('User', foreign_keys=[sender_id], lazy=True)

    def to_dict(self, include_sender=False):
        data = {
            'id': self.id,
            'group_chat_id': self.group_chat_id,
            'sender_id': self.sender_id,
            'content': self.content,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_sender and self.sender:
            data['sender_name'] = self.sender.full_name
        return data
