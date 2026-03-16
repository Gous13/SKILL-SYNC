"""
Authentication routes
"""

import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from extensions import db
from models.user import User, Role
from models.analytics import SystemLog
from datetime import datetime

auth_bp = Blueprint('auth', __name__)

def validate_password_strength(password):
    """
    Validate password strength.
    Returns (is_valid, error_message).
    """
    if len(password) < 8:
        return False, 'Password must be at least 8 characters long.'
    if not re.search(r'[A-Z]', password):
        return False, 'Password must contain at least one uppercase letter.'
    if not re.search(r'[a-z]', password):
        return False, 'Password must contain at least one lowercase letter.'
    if not re.search(r'\d', password):
        return False, 'Password must contain at least one number.'
    if not re.search(r'[!@#$%^&*(),.?":{}|<>\-_=+\[\]\\\/;\'`~]', password):
        return False, 'Password must contain at least one special character (e.g. !@#$%^&*).'
    return True, None

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'password', 'first_name', 'last_name', 'role']
        for field in required_fields:
            if not data or field not in data or not str(data[field]).strip():
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Validate password strength BEFORE checking duplicates
        is_valid, pw_error = validate_password_strength(data['password'])
        if not is_valid:
            return jsonify({'error': pw_error}), 400
        
        # Check if email is already registered
        if User.query.filter_by(email=data['email'].lower().strip()).first():
            return jsonify({'error': 'Email already registered. Please log in or use a different email.'}), 409
        
        # Get or create role
        role = Role.query.filter(db.func.lower(Role.name) == data['role'].lower()).first()
        if not role:
            # Create default roles if they don't exist
            if data['role'].lower() == 'student':
                role = Role(name='student', description='Student user')
            elif data['role'].lower() == 'mentor':
                role = Role(name='mentor', description='Mentor/Faculty user')
            elif data['role'].lower() == 'admin':
                role = Role(name='admin', description='Administrator')
            else:
                return jsonify({'error': 'Invalid role. Must be student, mentor, or admin'}), 400
            db.session.add(role)
            db.session.flush() # Use flush instead of commit to get the ID without ending the transaction
        
        # Create user
        user = User(
            email=data['email'].lower().strip(),
            first_name=data['first_name'].strip(),
            last_name=data['last_name'].strip(),
            role_id=role.id
        )
        user.set_password(data['password'])
        db.session.add(user)
        db.session.flush()
        
        # Log registration
        log = SystemLog(
            user_id=user.id,
            action='user_registered',
            entity_type='user',
            entity_id=user.id,
            ip_address=request.remote_addr
        )
        db.session.add(log)
        
        # Final single commit for all operations
        db.session.commit()
        
        # Generate token (identity must be a string)
        access_token = create_access_token(identity=str(user.id))
        
        return jsonify({
            'message': 'User registered successfully',
            'access_token': access_token,
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user"""
    try:
        data = request.get_json()
        
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required.'}), 400
        
        # Lookup user by email (case-insensitive)
        user = User.query.filter(db.func.lower(User.email) == data['email'].lower().strip()).first()
        
        if not user:
            return jsonify({'error': 'No account found with this email address.'}), 401
        
        if not user.check_password(data['password']):
            return jsonify({'error': 'Incorrect password. Please try again.'}), 401
        
        if not user.is_active:
            return jsonify({'error': 'Account is deactivated'}), 403
        
        # Generate token (identity must be a string)
        access_token = create_access_token(identity=str(user.id))
        
        # Log login
        log = SystemLog(
            user_id=user.id,
            action='user_login',
            entity_type='user',
            entity_id=user.id,
            ip_address=request.remote_addr
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user': user.to_dict(include_profile=True)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current authenticated user"""
    try:
        user_id = int(get_jwt_identity())  # Convert string to int for database query
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'user': user.to_dict(include_profile=True)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
