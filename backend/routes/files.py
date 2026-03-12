"""
Team file upload and sharing routes
"""

import os
import uuid
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from extensions import db
from models.user import User
from models.team import Team, TeamMember
from models.team_file import TeamFile

files_bp = Blueprint('files', __name__)


def _allowed_file(filename):
    from flask import current_app
    allowed = current_app.config.get('ALLOWED_EXTENSIONS', {'pdf', 'doc', 'docx', 'txt', 'zip', 'png', 'jpg', 'jpeg'})
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    return ext in allowed


def _can_access_team_files(user_id, team_id):
    user = User.query.get(user_id)
    if not user:
        return False
    if user.role and user.role.name == 'admin':
        return True
    team = Team.query.get(team_id)
    if not team:
        return False
    if team.project and team.project.creator_id == user_id:
        return True
    return any(m.user_id == user_id for m in (team.members or []))


@files_bp.route('/teams/<int:team_id>/files', methods=['GET'])
@jwt_required()
def list_team_files(team_id):
    """List files for a team"""
    try:
        user_id = int(get_jwt_identity())
        if not _can_access_team_files(user_id, team_id):
            return jsonify({'error': 'Unauthorized'}), 403
        files = TeamFile.query.filter_by(team_id=team_id).order_by(TeamFile.uploaded_at.desc()).all()
        return jsonify({'files': [f.to_dict() for f in files]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@files_bp.route('/teams/<int:team_id>/files', methods=['POST'])
@jwt_required()
def upload_file(team_id):
    """Upload file to team workspace"""
    try:
        user_id = int(get_jwt_identity())
        if not _can_access_team_files(user_id, team_id):
            return jsonify({'error': 'Unauthorized'}), 403

        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if not file or file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not _allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400

        team = Team.query.get(team_id)
        if not team:
            return jsonify({'error': 'Team not found'}), 404

        from flask import current_app
        upload_folder = current_app.config.get('UPLOAD_FOLDER', os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads'))
        team_dir = os.path.join(upload_folder, 'teams', str(team_id))
        os.makedirs(team_dir, exist_ok=True)

        orig_name = secure_filename(file.filename) or 'file'
        ext = orig_name.rsplit('.', 1)[-1].lower() if '.' in orig_name else ''
        safe_name = f"{uuid.uuid4().hex}_{orig_name}"
        storage_path = os.path.join(team_dir, safe_name)

        file.save(storage_path)
        file_size = os.path.getsize(storage_path)
        rel_path = os.path.join('teams', str(team_id), safe_name)

        tf = TeamFile(
            team_id=team_id,
            project_id=team.project_id if team else None,
            file_name=orig_name,
            storage_path=rel_path,
            file_size=file_size,
            mime_type=file.content_type,
            uploader_id=user_id
        )
        db.session.add(tf)
        db.session.commit()

        return jsonify({'message': 'File uploaded', 'file': tf.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@files_bp.route('/teams/<int:team_id>/files/<int:file_id>/download', methods=['GET'])
@jwt_required()
def download_file(team_id, file_id):
    """Download a team file"""
    try:
        user_id = int(get_jwt_identity())
        if not _can_access_team_files(user_id, team_id):
            return jsonify({'error': 'Unauthorized'}), 403

        tf = TeamFile.query.filter_by(id=file_id, team_id=team_id).first()
        if not tf:
            return jsonify({'error': 'File not found'}), 404

        from flask import current_app
        upload_folder = current_app.config.get('UPLOAD_FOLDER', os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads'))
        full_path = os.path.join(upload_folder, tf.storage_path)

        if not os.path.isfile(full_path):
            return jsonify({'error': 'File not found on disk'}), 404

        return send_file(full_path, as_attachment=True, download_name=tf.file_name)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@files_bp.route('/teams/<int:team_id>/files/<int:file_id>', methods=['DELETE'])
@jwt_required()
def delete_file(team_id, file_id):
    """Delete a team file (uploader, mentor, or admin)"""
    try:
        user_id = int(get_jwt_identity())
        if not _can_access_team_files(user_id, team_id):
            return jsonify({'error': 'Unauthorized'}), 403

        tf = TeamFile.query.filter_by(id=file_id, team_id=team_id).first()
        if not tf:
            return jsonify({'error': 'File not found'}), 404

        user = User.query.get(user_id)
        is_uploader = tf.uploader_id == user_id
        is_mentor = tf.team and tf.team.project and tf.team.project.creator_id == user_id
        is_admin = user.role and user.role.name == 'admin'

        if not (is_uploader or is_mentor or is_admin):
            return jsonify({'error': 'Only uploader, mentor, or admin can delete'}), 403

        from flask import current_app
        upload_folder = current_app.config.get('UPLOAD_FOLDER', os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads'))
        full_path = os.path.join(upload_folder, tf.storage_path)
        if os.path.isfile(full_path):
            os.remove(full_path)

        db.session.delete(tf)
        db.session.commit()
        return jsonify({'message': 'File deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
