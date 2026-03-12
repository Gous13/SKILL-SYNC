"""
Per-user read tracking for group chats.

We store a lightweight "last read message id" per (group_chat, user) so we can
compute unread counts similarly to 1-to-1 messages without changing existing
direct messaging behavior.
"""

from extensions import db
from datetime import datetime


class GroupChatReadState(db.Model):
    __tablename__ = 'group_chat_read_states'

    id = db.Column(db.Integer, primary_key=True)
    group_chat_id = db.Column(db.Integer, db.ForeignKey('group_chats.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Last group message id the user has seen in this chat
    last_read_message_id = db.Column(db.Integer, nullable=False, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('group_chat_id', 'user_id', name='unique_group_chat_read_state'),
    )

    group_chat = db.relationship('GroupChat', backref=db.backref('read_states', lazy=True, cascade='all, delete-orphan'))
    user = db.relationship('User', backref=db.backref('group_chat_read_states', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'group_chat_id': self.group_chat_id,
            'user_id': self.user_id,
            'last_read_message_id': self.last_read_message_id,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

