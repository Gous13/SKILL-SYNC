"""
Custom decorators for role-based access control
"""

from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from models.user import User

def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            user_id = int(get_jwt_identity())  # Convert string to int for database query
            user = User.query.get(user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Access role to trigger lazy load if needed
            role_name = user.role.name if user.role else None
            
            if not role_name:
                return jsonify({'error': 'User role not found'}), 403
            
            if role_name != 'admin':
                return jsonify({'error': 'Admin access required'}), 403
            
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    return decorated_function

def mentor_or_admin_required(f):
    """Decorator to require mentor or admin role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            user_id = int(get_jwt_identity())  # Convert string to int for database query
            user = User.query.get(user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Access role to trigger lazy load if needed
            role_name = user.role.name if user.role else None
            
            if not role_name:
                return jsonify({'error': 'User role not found'}), 403
            
            if role_name not in ['mentor', 'admin']:
                return jsonify({'error': 'Mentor or admin access required'}), 403
            
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    return decorated_function

def student_required(f):
    """Decorator to require student role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            user_id = int(get_jwt_identity())  # Convert string to int for database query
            user = User.query.get(user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Access role to trigger lazy load if needed
            role_name = user.role.name if user.role else None
            
            if not role_name:
                return jsonify({'error': 'User role not found'}), 403
            
            if role_name != 'student':
                return jsonify({'error': 'Student access required'}), 403
            
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    return decorated_function
