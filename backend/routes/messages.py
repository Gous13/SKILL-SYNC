"""
Internal messaging routes - universal for Students, Mentors, and Admins
Extends to support project group chats (team collaboration)
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.message import Message
from models.group_chat import GroupChat, GroupChatMember, GroupMessage
from models.group_chat_read_state import GroupChatReadState
from datetime import datetime

messages_bp = Blueprint('messages', __name__)

@messages_bp.route('/recipients', methods=['GET'])
@jwt_required()
def get_recipients():
    """Get users matching email search (for composing messages). Filter by ?q=email"""
    try:
        current_user_id = int(get_jwt_identity())
        q = request.args.get('q', '').strip().lower()
        query = User.query.filter(User.id != current_user_id, User.is_active == True)
        if q:
            query = query.filter(db.func.lower(User.email).contains(q))
        users = query.limit(20).all()
        return jsonify({
            'users': [u.to_dict() for u in users]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/conversations', methods=['GET'])
@jwt_required()
def get_conversations():
    """Get list of conversations: direct (1-to-1) + project group chats"""
    try:
        current_user_id = int(get_jwt_identity())
        # Get all messages where current user is sender or receiver (not deleted)
        sent = db.session.query(Message.receiver_id).filter(
            Message.sender_id == current_user_id
        ).distinct()
        received = db.session.query(Message.sender_id).filter(
            Message.receiver_id == current_user_id,
            Message.deleted_by_receiver_at == None
        ).distinct()
        other_ids = set()
        for r in sent:
            other_ids.add(r[0])
        for r in received:
            other_ids.add(r[0])

        conversations = []
        # Direct (1-to-1) conversations
        for other_id in other_ids:
            other = User.query.get(other_id)
            if not other or not other.is_active:
                continue
            last_msg = Message.query.filter(
                ((Message.sender_id == current_user_id) & (Message.receiver_id == other_id)) |
                ((Message.sender_id == other_id) & (Message.receiver_id == current_user_id) & (Message.deleted_by_receiver_at == None))
            ).order_by(Message.created_at.desc()).first()
            if not last_msg:
                continue
            unread = Message.query.filter(
                Message.sender_id == other_id,
                Message.receiver_id == current_user_id,
                Message.deleted_by_receiver_at == None,
                Message.is_read == False
            ).count()
            conversations.append({
                'type': 'direct',
                'other_user': other.to_dict(),
                'last_message': last_msg.to_dict(include_sender=True),
                'unread_count': unread,
                'last_at': last_msg.created_at.isoformat() if last_msg.created_at else None
            })

        # Project group chats (where current user is a member)
        user_group_memberships = GroupChatMember.query.filter_by(user_id=current_user_id).all()
        for gcm in user_group_memberships:
            gc = gcm.group_chat
            if not gc or not gc.project:
                continue
            last_msg = GroupMessage.query.filter_by(group_chat_id=gc.id).order_by(GroupMessage.created_at.desc()).first()
            # Unread count: messages after last_read_message_id, excluding my own messages
            rs = GroupChatReadState.query.filter_by(group_chat_id=gc.id, user_id=current_user_id).first()
            last_read_id = rs.last_read_message_id if rs else 0
            unread_group = GroupMessage.query.filter(
                GroupMessage.group_chat_id == gc.id,
                GroupMessage.id > last_read_id,
                GroupMessage.sender_id != current_user_id
            ).count()
            conversations.append({
                'type': 'group',
                'group_chat': gc.to_dict(include_project=True),
                'last_message': last_msg.to_dict(include_sender=True) if last_msg else None,
                'unread_count': unread_group,
                'last_at': last_msg.created_at.isoformat() if last_msg and last_msg.created_at else gc.created_at.isoformat() if gc.created_at else None
            })

        conversations.sort(key=lambda x: x['last_at'] or '', reverse=True)
        return jsonify({'conversations': conversations}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/conversations/<int:other_user_id>', methods=['GET'])
@jwt_required()
def get_thread(other_user_id):
    """Get full thread with a user. Mark messages from them as read."""
    try:
        current_user_id = int(get_jwt_identity())
        other = User.query.get(other_user_id)
        if not other:
            return jsonify({'error': 'User not found'}), 404
        
        messages = Message.query.filter(
            ((Message.sender_id == current_user_id) & (Message.receiver_id == other_user_id)) |
            ((Message.sender_id == other_user_id) & (Message.receiver_id == current_user_id) & (Message.deleted_by_receiver_at == None))
        ).order_by(Message.created_at.asc()).all()
        
        # Mark received messages as read
        for m in messages:
            if m.receiver_id == current_user_id and not m.is_read:
                m.is_read = True
        db.session.commit()
        
        result = []
        for m in messages:
            d = m.to_dict(include_sender=True)
            d['is_mine'] = m.sender_id == current_user_id
            result.append(d)
        
        return jsonify({
            'other_user': other.to_dict(),
            'messages': result
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('', methods=['POST'])
@jwt_required()
def send_message():
    """Send a message to another user"""
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        receiver_id = data.get('receiver_id')
        content = data.get('content', '').strip()
        
        if not receiver_id:
            return jsonify({'error': 'receiver_id is required'}), 400
        if not content:
            return jsonify({'error': 'Message content is required'}), 400
        
        receiver = User.query.get(receiver_id)
        if not receiver:
            return jsonify({'error': 'Recipient not found'}), 404
        if not receiver.is_active:
            return jsonify({'error': 'Cannot message inactive user'}), 400
        
        msg = Message(
            sender_id=current_user_id,
            sender_role=current_user.role.name if current_user.role else 'unknown',
            receiver_id=receiver_id,
            receiver_role=receiver.role.name if receiver.role else 'unknown',
            content=content
        )
        db.session.add(msg)
        db.session.commit()
        
        return jsonify({
            'message': 'Message sent',
            'msg': msg.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('', methods=['GET'])
@jwt_required()
def get_inbox():
    """Get inbox - messages where current user is receiver, not deleted"""
    try:
        current_user_id = int(get_jwt_identity())
        messages = Message.query.filter(
            Message.receiver_id == current_user_id,
            Message.deleted_by_receiver_at == None
        ).order_by(Message.created_at.desc()).all()
        
        result = []
        for m in messages:
            d = m.to_dict(include_sender=True)
            result.append(d)
        
        return jsonify({
            'messages': result
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/unread-count', methods=['GET'])
@jwt_required()
def get_unread_count():
    """Get count of unread messages for current user"""
    try:
        current_user_id = int(get_jwt_identity())
        direct_count = Message.query.filter(
            Message.receiver_id == current_user_id,
            Message.deleted_by_receiver_at == None,
            Message.is_read == False
        ).count()

        # Group unread count across all group chats where user is a member
        group_count = 0
        memberships = GroupChatMember.query.filter_by(user_id=current_user_id).all()
        for m in memberships:
            gc = m.group_chat
            if not gc:
                continue
            rs = GroupChatReadState.query.filter_by(group_chat_id=gc.id, user_id=current_user_id).first()
            last_read_id = rs.last_read_message_id if rs else 0
            group_count += GroupMessage.query.filter(
                GroupMessage.group_chat_id == gc.id,
                GroupMessage.id > last_read_id,
                GroupMessage.sender_id != current_user_id
            ).count()

        return jsonify({'unread_count': direct_count + group_count}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Group Chat endpoints ---

@messages_bp.route('/group-chats/<int:group_chat_id>', methods=['GET'])
@jwt_required()
def get_group_chat(group_chat_id):
    """Get group chat with messages. User must be a member."""
    try:
        current_user_id = int(get_jwt_identity())
        gc = GroupChat.query.get(group_chat_id)
        if not gc:
            return jsonify({'error': 'Group chat not found'}), 404

        # Check membership
        is_member = GroupChatMember.query.filter_by(group_chat_id=group_chat_id, user_id=current_user_id).first()
        if not is_member:
            return jsonify({'error': 'You are not a member of this group chat'}), 403

        messages = GroupMessage.query.filter_by(group_chat_id=group_chat_id).order_by(GroupMessage.created_at.asc()).all()

        # Mark group chat as read for this user (set last_read_message_id)
        last_id = messages[-1].id if messages else 0
        rs = GroupChatReadState.query.filter_by(group_chat_id=group_chat_id, user_id=current_user_id).first()
        if rs:
            rs.last_read_message_id = max(rs.last_read_message_id or 0, last_id)
        else:
            rs = GroupChatReadState(group_chat_id=group_chat_id, user_id=current_user_id, last_read_message_id=last_id)
            db.session.add(rs)
        db.session.commit()

        return jsonify({
            'group_chat': gc.to_dict(include_members=True, include_project=True),
            'messages': [m.to_dict(include_sender=True) for m in messages]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@messages_bp.route('/group-chats/<int:group_chat_id>/messages', methods=['POST'])
@jwt_required()
def send_group_message(group_chat_id):
    """Send a message to a group chat. User must be a member."""
    try:
        current_user_id = int(get_jwt_identity())
        gc = GroupChat.query.get(group_chat_id)
        if not gc:
            return jsonify({'error': 'Group chat not found'}), 404

        # Check membership
        is_member = GroupChatMember.query.filter_by(group_chat_id=group_chat_id, user_id=current_user_id).first()
        if not is_member:
            return jsonify({'error': 'You are not a member of this group chat'}), 403

        data = request.get_json()
        content = (data.get('content') or '').strip()
        if not content:
            return jsonify({'error': 'Message content is required'}), 400

        msg = GroupMessage(
            group_chat_id=group_chat_id,
            sender_id=current_user_id,
            content=content
        )
        db.session.add(msg)
        db.session.commit()

        return jsonify({
            'message': 'Message sent',
            'msg': msg.to_dict(include_sender=True)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@messages_bp.route('/<int:msg_id>/read', methods=['PUT'])
@jwt_required()
def mark_as_read(msg_id):
    """Mark a message as read"""
    try:
        current_user_id = int(get_jwt_identity())
        msg = Message.query.get(msg_id)
        if not msg:
            return jsonify({'error': 'Message not found'}), 404
        if msg.receiver_id != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        if msg.deleted_by_receiver_at:
            return jsonify({'error': 'Message not found'}), 404
        
        msg.is_read = True
        db.session.commit()
        return jsonify({'message': 'Marked as read', 'msg': msg.to_dict(include_sender=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/<int:msg_id>', methods=['DELETE'])
@jwt_required()
def clear_message(msg_id):
    """Clear/delete message from receiver's inbox (soft delete - does not affect sender)"""
    try:
        current_user_id = int(get_jwt_identity())
        msg = Message.query.get(msg_id)
        if not msg:
            return jsonify({'error': 'Message not found'}), 404
        if msg.receiver_id != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        if msg.deleted_by_receiver_at:
            return jsonify({'error': 'Message already cleared'}), 400
        
        msg.deleted_by_receiver_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'message': 'Message cleared'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
