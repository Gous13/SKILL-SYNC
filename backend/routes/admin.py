"""
Admin routes for system management
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User, Role
from models.analytics import SystemLog
from models.project import Project, Hackathon
from models.team import Team, TeamMember
from models.matching import MatchExplanation, SimilarityScore
from models.profile import StudentProfile
from models.message import Message
from utils.decorators import admin_required, mentor_or_admin_required
from datetime import datetime

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/stats', methods=['GET'])
@jwt_required()
@admin_required
def get_stats():
    """Get system statistics"""
    try:
        stats = {
            'users': {
                'total': User.query.count(),
                'students': User.query.join(Role).filter(Role.name == 'student').count(),
                'mentors': User.query.join(Role).filter(Role.name == 'mentor').count(),
                'admins': User.query.join(Role).filter(Role.name == 'admin').count(),
                'active': User.query.filter_by(is_active=True).count()
            },
            'projects': {
                'total': Project.query.count(),
                'open': Project.query.filter_by(status='open').count(),
                'in_progress': Project.query.filter_by(status='in_progress').count(),
                'completed': Project.query.filter_by(status='completed').count()
            },
            'teams': {
                'total': Team.query.count(),
                'forming': Team.query.filter_by(status='forming').count(),
                'active': Team.query.filter_by(status='active').count()
            },
            'logs': {
                'total': SystemLog.query.count()
            }
        }
        
        return jsonify({
            'stats': stats
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/logs', methods=['GET'])
@jwt_required()
@admin_required
def get_logs():
    """Get system logs"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        logs = SystemLog.query.order_by(SystemLog.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'logs': [log.to_dict() for log in logs.items],
            'total': logs.total,
            'page': page,
            'per_page': per_page,
            'pages': logs.pages
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users', methods=['GET'])
@jwt_required()
@admin_required
def get_all_users():
    """Get all users (admin only)"""
    try:
        users = User.query.all()
        return jsonify({
            'users': [user.to_dict() for user in users]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/students', methods=['GET'])
@jwt_required()
@mentor_or_admin_required
def get_student_users():
    """Get all student users (mentor or admin)"""
    try:
        students = User.query.join(Role).filter(Role.name == 'student').all()
        return jsonify({
            'users': [user.to_dict() for user in students]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/reset-projects', methods=['POST'])
@jwt_required()
@admin_required
def reset_projects():
    """Reset all project-related data. Keeps users and profiles intact."""
    try:
        match_exp_count = MatchExplanation.query.delete()
        sim_count = SimilarityScore.query.delete()
        team_member_count = TeamMember.query.delete()
        team_count = Team.query.delete()
        project_count = Project.query.delete()
        hackathon_count = Hackathon.query.delete()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Project data reset successfully',
            'removed': {
                'match_explanations': match_exp_count,
                'similarity_scores': sim_count,
                'team_members': team_member_count,
                'teams': team_count,
                'projects': project_count,
                'hackathons': hackathon_count
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/reset-full', methods=['POST'])
@jwt_required()
@admin_required
def reset_full():
    """Full system reset. Removes all users, profiles, projects, teams, messages, logs. Keeps roles for fresh registration."""
    try:
        match_exp_count = MatchExplanation.query.delete()
        sim_count = SimilarityScore.query.delete()
        team_member_count = TeamMember.query.delete()
        team_count = Team.query.delete()
        msg_count = Message.query.delete()
        profile_count = StudentProfile.query.delete()
        project_count = Project.query.delete()
        hackathon_count = Hackathon.query.delete()
        log_count = SystemLog.query.delete()
        user_count = User.query.delete()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Full system reset. Database empty. Roles preserved for new registration.',
            'removed': {
                'match_explanations': match_exp_count,
                'similarity_scores': sim_count,
                'team_members': team_member_count,
                'teams': team_count,
                'messages': msg_count,
                'profiles': profile_count,
                'projects': project_count,
                'hackathons': hackathon_count,
                'logs': log_count,
                'users': user_count
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/init-roles', methods=['POST'])
@jwt_required()
@admin_required
def init_roles():
    """Initialize default roles"""
    try:
        roles_data = [
            {'name': 'student', 'description': 'Student user'},
            {'name': 'mentor', 'description': 'Mentor/Faculty user'},
            {'name': 'admin', 'description': 'Administrator'}
        ]
        
        created = []
        for role_data in roles_data:
            role = Role.query.filter_by(name=role_data['name']).first()
            if not role:
                role = Role(**role_data)
                db.session.add(role)
                created.append(role_data['name'])
        
        db.session.commit()
        
        return jsonify({
            'message': 'Roles initialized',
            'created': created
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<int:user_id>/block', methods=['POST'])
@jwt_required()
@admin_required
def block_user(user_id):
    """Block a user from accessing the system"""
    try:
        user = User.query.get_or_404(user_id)
        data = request.get_json() or {}
        
        user.is_blocked = True
        user.blocked_reason = data.get('reason', 'Blocked by admin')
        user.blocked_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': f'User {user.full_name} has been blocked',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<int:user_id>/unblock', methods=['POST'])
@jwt_required()
@admin_required
def unblock_user(user_id):
    """Unblock a user to restore access"""
    try:
        user = User.query.get_or_404(user_id)
        
        user.is_blocked = False
        user.blocked_reason = None
        user.blocked_at = None
        
        db.session.commit()
        
        return jsonify({
            'message': f'User {user.full_name} has been unblocked',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<int:user_id>/role', methods=['PUT'])
@jwt_required()
@admin_required
def change_user_role(user_id):
    """Change a user's role"""
    try:
        user = User.query.get_or_404(user_id)
        data = request.json
        new_role = data.get('role')
        
        if new_role not in ['student', 'mentor', 'admin']:
            return jsonify({'error': 'Invalid role. Must be student, mentor, or admin'}), 400
        
        # Get or create the role
        role = Role.query.filter_by(name=new_role).first()
        if not role:
            role = Role(name=new_role)
            db.session.add(role)
            db.session.flush()
        
        user.role = role
        db.session.commit()
        
        return jsonify({
            'message': f"User {user.full_name}'s role changed to {new_role}",
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_user(user_id):
    """Delete a user"""
    try:
        user = User.query.get_or_404(user_id)
        
        # Prevent admin from deleting themselves
        current_user_id = get_jwt_identity()
        if user_id == current_user_id:
            return jsonify({'error': 'Cannot delete your own account'}), 400
        
        user_name = user.full_name
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({
            'message': f'User {user_name} has been deleted'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
