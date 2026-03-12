"""
User management routes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User, Role
from utils.decorators import admin_required, mentor_or_admin_required

users_bp = Blueprint('users', __name__)

@users_bp.route('', methods=['GET'])
@jwt_required()
@mentor_or_admin_required
def get_users():
    """Get all users (mentor/admin only)"""
    try:
        users = User.query.all()
        return jsonify({
            'users': [user.to_dict() for user in users]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get user by ID"""
    try:
        current_user_id = int(get_jwt_identity())  # Convert string to int for database query
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Users can only view their own profile unless they're admin/mentor
        current_user = User.query.get(current_user_id)
        if user_id != current_user_id and current_user.role.name not in ['admin', 'mentor']:
            return jsonify({'error': 'Unauthorized'}), 403
        
        return jsonify({
            'user': user.to_dict(include_profile=True)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/<int:user_id>/activate', methods=['POST'])
@jwt_required()
@admin_required
def activate_user(user_id):
    """Activate/deactivate user (admin only)"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        user.is_active = data.get('is_active', True)
        db.session.commit()
        
        return jsonify({
            'message': 'User status updated',
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
