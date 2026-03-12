"""
Student profile routes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.profile import StudentProfile
from models.student_skill import StudentSkill
from services.nlp_service import get_nlp_service

profiles_bp = Blueprint('profiles', __name__)
nlp_service = get_nlp_service()


def _sync_skills_to_student_skills(user_id, skills_description):
    """Sync comma-separated skills to student_skills table (unverified if new)"""
    if not skills_description or not skills_description.strip():
        return
    skills = [s.strip() for s in skills_description.split(',') if s.strip()]
    for name in skills:
        existing = StudentSkill.query.filter_by(user_id=user_id, skill_name=name).first()
        if not existing:
            sk = StudentSkill(user_id=user_id, skill_name=name, status='unverified')
            db.session.add(sk)

@profiles_bp.route('', methods=['POST'])
@jwt_required()
def create_profile():
    """Create student profile"""
    try:
        user_id = int(get_jwt_identity())  # Convert string to int for database query
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if user is a student
        if not user.role or user.role.name != 'student':
            return jsonify({'error': 'Only students can create profiles'}), 403
        
        # Check if profile already exists
        existing_profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if existing_profile:
            return jsonify({'error': 'Profile already exists. Use PUT to update.'}), 400
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        if not data.get('skills_description'):
            return jsonify({'error': 'skills_description is required'}), 400
        
        # Create profile
        # Convert year_of_study and gpa to proper types
        year_of_study = data.get('year_of_study')
        if year_of_study:
            try:
                year_of_study = int(year_of_study)
            except (ValueError, TypeError):
                year_of_study = None
        
        gpa = data.get('gpa')
        if gpa:
            try:
                gpa = float(gpa)
            except (ValueError, TypeError):
                gpa = None
        
        profile = StudentProfile(
            user_id=user_id,
            skills_description=data.get('skills_description'),
            interests_description=data.get('interests_description'),
            experience_description=data.get('experience_description'),
            availability_description=data.get('availability_description'),
            year_of_study=year_of_study,
            department=data.get('department'),
            gpa=gpa
        )
        
        # Generate embeddings (ONLY skills/interests/experience; availability is NOT embedded)
        import json
        skills_emb = nlp_service.encode_text(profile.skills_description or '')
        interests_emb = nlp_service.encode_text(profile.interests_description or '')
        experience_emb = nlp_service.encode_text(profile.experience_description or '')

        profile.skills_embedding = json.dumps(skills_emb.tolist())
        profile.interests_embedding = json.dumps(interests_emb.tolist())
        profile.experience_embedding = json.dumps(experience_emb.tolist())
        profile.is_complete = True
        
        db.session.add(profile)
        db.session.flush()
        _sync_skills_to_student_skills(user_id, profile.skills_description)
        db.session.commit()

        return jsonify({
            'message': 'Profile created successfully',
            'profile': profile.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@profiles_bp.route('', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user's profile"""
    try:
        user_id = int(get_jwt_identity())  # Convert string to int for database query
        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        
        if not profile:
            return jsonify({'profile': None}), 200
        
        return jsonify({
            'profile': profile.to_dict()
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profiles_bp.route('', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update student profile"""
    try:
        user_id = int(get_jwt_identity())  # Convert string to int for database query
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if user is a student
        if not user.role or user.role.name != 'student':
            return jsonify({'error': 'Only students can update profiles'}), 403
        
        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Update fields
        if 'skills_description' in data:
            profile.skills_description = data['skills_description']
        if 'interests_description' in data:
            profile.interests_description = data['interests_description']
        if 'experience_description' in data:
            profile.experience_description = data['experience_description']
        if 'availability_description' in data:
            profile.availability_description = data['availability_description']
        if 'year_of_study' in data:
            try:
                profile.year_of_study = int(data['year_of_study']) if data['year_of_study'] else None
            except (ValueError, TypeError):
                profile.year_of_study = None
        if 'department' in data:
            profile.department = data['department']
        if 'gpa' in data:
            try:
                profile.gpa = float(data['gpa']) if data['gpa'] else None
            except (ValueError, TypeError):
                profile.gpa = None
        
        # Regenerate embeddings (ONLY skills/interests/experience; availability is NOT embedded)
        import json
        skills_emb = nlp_service.encode_text(profile.skills_description or '')
        interests_emb = nlp_service.encode_text(profile.interests_description or '')
        experience_emb = nlp_service.encode_text(profile.experience_description or '')

        profile.skills_embedding = json.dumps(skills_emb.tolist())
        profile.interests_embedding = json.dumps(interests_emb.tolist())
        profile.experience_embedding = json.dumps(experience_emb.tolist())

        if 'skills_description' in data:
            _sync_skills_to_student_skills(user_id, profile.skills_description)
        db.session.commit()

        return jsonify({
            'message': 'Profile updated successfully',
            'profile': profile.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@profiles_bp.route('/all', methods=['GET'])
@jwt_required()
def get_all_profiles():
    """Get all student profiles (for matching)"""
    try:
        user_id = int(get_jwt_identity())  # Convert string to int for database query
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if user is a student
        if not user.role or user.role.name != 'student':
            return jsonify({'error': 'Only students can view profiles'}), 403
        
        profiles = StudentProfile.query.filter(StudentProfile.user_id != user_id).all()
        
        return jsonify({
            'profiles': [profile.to_dict() for profile in profiles]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
