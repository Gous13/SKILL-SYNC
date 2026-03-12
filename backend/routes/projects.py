"""
Project and Hackathon routes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.project import Project, Hackathon
from models.project_task import ProjectTask
from services.nlp_service import get_nlp_service
from utils.decorators import mentor_or_admin_required
from datetime import datetime

projects_bp = Blueprint('projects', __name__)
nlp_service = get_nlp_service()

@projects_bp.route('/projects', methods=['POST'])
@jwt_required()
@mentor_or_admin_required
def create_project():
    """Create a new project"""
    try:
        user_id = int(get_jwt_identity())  # Convert string to int for database query
        data = request.get_json()
        
        # Validate required fields
        if not data.get('title') or not data.get('description'):
            return jsonify({'error': 'Title and description are required'}), 400
        
        # Create project
        project = Project(
            title=data['title'],
            description=data['description'],
            required_skills=data.get('required_skills', ''),
            creator_id=user_id,
            min_team_size=data.get('min_team_size', 3),
            max_team_size=data.get('max_team_size', 5),
            preferred_team_size=data.get('preferred_team_size', 4),
            status=data.get('status', 'open'),
            deadline=datetime.fromisoformat(data['deadline']) if data.get('deadline') else None
        )
        
        # Generate embedding
        project_text = f"{project.description} {project.required_skills}"
        embedding = nlp_service.encode_text(project_text)
        import json
        project.description_embedding = json.dumps(embedding.tolist())
        
        db.session.add(project)
        db.session.commit()
        
        # Auto-compute similarities for all students to enable recommendations
        try:
            from routes.matching import compute_similarities
            # Call the similarity computation function directly
            from models.profile import StudentProfile
            from models.matching import SimilarityScore
            from services.nlp_service import get_nlp_service
            
            profiles = StudentProfile.query.all()
            project_embedding = json.loads(project.description_embedding)
            
            def _compute_profile_project_similarity_local(project_embedding_local, profile_obj):
                skills_emb = json.loads(profile_obj.skills_embedding) if profile_obj.skills_embedding else None
                interests_emb = json.loads(profile_obj.interests_embedding) if profile_obj.interests_embedding else None
                experience_emb = json.loads(profile_obj.experience_embedding) if profile_obj.experience_embedding else None

                if skills_emb is None:
                    skills_emb = get_nlp_service().encode_text(profile_obj.skills_description or '').tolist()
                    profile_obj.skills_embedding = json.dumps(skills_emb)
                if interests_emb is None:
                    interests_emb = get_nlp_service().encode_text(profile_obj.interests_description or '').tolist()
                    profile_obj.interests_embedding = json.dumps(interests_emb)
                if experience_emb is None:
                    experience_emb = get_nlp_service().encode_text(profile_obj.experience_description or '').tolist()
                    profile_obj.experience_embedding = json.dumps(experience_emb)

                skills_sim = get_nlp_service().compute_similarity(project_embedding_local, skills_emb)
                interests_sim = get_nlp_service().compute_similarity(project_embedding_local, interests_emb) if (profile_obj.interests_description or '').strip() else None
                experience_sim = get_nlp_service().compute_similarity(project_embedding_local, experience_emb) if (profile_obj.experience_description or '').strip() else None

                sims = [skills_sim]
                if interests_sim is not None:
                    sims.append(interests_sim)
                if experience_sim is not None:
                    sims.append(experience_sim)
                overall = float(sum(sims) / max(len(sims), 1))
                return overall, skills_sim, interests_sim, experience_sim

            for profile in profiles:
                overall_sim, skills_sim, interests_sim, experience_sim = _compute_profile_project_similarity_local(project_embedding, profile)
                
                similarity = SimilarityScore.query.filter_by(
                    profile_id=profile.id,
                    project_id=project.id
                ).first()
                
                if similarity:
                    similarity.overall_similarity = overall_sim
                    similarity.skills_similarity = skills_sim
                    similarity.interests_similarity = interests_sim
                    similarity.experience_similarity = experience_sim
                else:
                    similarity = SimilarityScore(
                        profile_id=profile.id,
                        project_id=project.id,
                        overall_similarity=overall_sim,
                        skills_similarity=skills_sim,
                        interests_similarity=interests_sim,
                        experience_similarity=experience_sim
                    )
                    db.session.add(similarity)
            
            db.session.commit()
        except Exception as e:
            # Don't fail project creation if similarity computation fails
            print(f"Warning: Failed to compute similarities for new project: {e}")
            db.session.rollback()
        
        return jsonify({
            'message': 'Project created successfully. Similarities computed for recommendations.',
            'project': project.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@projects_bp.route('/projects', methods=['GET'])
@jwt_required()
def get_projects():
    """Get all projects"""
    try:
        projects = Project.query.all()
        return jsonify({
            'projects': [project.to_dict(include_teams=True) for project in projects]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@projects_bp.route('/projects/<int:project_id>', methods=['GET'])
@jwt_required()
def get_project(project_id):
    """Get project by ID"""
    try:
        project = Project.query.get(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        return jsonify({
            'project': project.to_dict(include_teams=True)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@projects_bp.route('/projects/<int:project_id>/members', methods=['GET'])
@jwt_required()
def get_project_members(project_id):
    """Get all students who joined this project (across all teams). For View Team / View Members."""
    try:
        from models.team import Team, TeamMember

        project = Project.query.get(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404

        members = TeamMember.query.join(Team).filter(Team.project_id == project_id).all()
        seen = set()
        unique_members = []
        for m in members:
            if m.user_id in seen:
                continue
            seen.add(m.user_id)
            unique_members.append({
                'user_id': m.user_id,
                'name': m.user.full_name if m.user else 'Unknown',
                'email': m.user.email if m.user else ''
            })

        # Ensure group chat exists when members exist (for Workspace Group Chat option)
        group_chat_obj = None
        if members:
            from services.group_chat_service import ensure_project_group_chat
            group_chat_obj, _ = ensure_project_group_chat(project_id)
            if group_chat_obj:
                db.session.commit()

        from models.group_chat import GroupChat
        if not group_chat_obj:
            group_chat_obj = GroupChat.query.filter_by(project_id=project_id).first()

        return jsonify({
            'project_id': project_id,
            'project_title': project.title,
            'members': unique_members,
            'group_chat_id': group_chat_obj.id if group_chat_obj else None
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@projects_bp.route('/projects/<int:project_id>/tasks-summary', methods=['GET'])
@jwt_required()
@mentor_or_admin_required
def get_project_tasks_summary(project_id):
    """Get project-level task summary (completion %, per-member counts)"""
    try:
        from models.team import Team
        from models.project import ProjectTask
        project = Project.query.get(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        teams = Team.query.filter_by(project_id=project_id).all()
        all_tasks = []
        for t in teams:
            for task in ProjectTask.query.filter_by(team_id=t.id).all():
                d = task.to_dict()
                d['team_name'] = t.name
                all_tasks.append(d)
        total = len(all_tasks)
        completed = sum(1 for t in all_tasks if t.get('status') == 'completed')
        completion_pct = (completed / total * 100) if total > 0 else 0
        member_counts = {}
        for t in all_tasks:
            if t.get('assignee_id') and t.get('status') == 'completed':
                aid = t['assignee_id']
                member_counts[aid] = member_counts.get(aid, 0) + 1
        return jsonify({
            'project_id': project_id,
            'total_tasks': total,
            'completed_tasks': completed,
            'completion_percentage': round(completion_pct, 1),
            'per_member_completed': member_counts,
            'tasks_by_team': [{'team_id': t.id, 'team_name': t.name, 'tasks': [x.to_dict() for x in ProjectTask.query.filter_by(team_id=t.id).all()]} for t in teams]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@projects_bp.route('/projects/<int:project_id>/teams-validation', methods=['GET'])
@jwt_required()
@mentor_or_admin_required
def get_project_teams_validation(project_id):
    """Get skill validation for all teams in project"""
    try:
        from services.team_validation_service import validate_project_teams
        results = validate_project_teams(project_id)
        return jsonify({'teams_validation': results}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@projects_bp.route('/hackathons', methods=['POST'])
@jwt_required()
@mentor_or_admin_required
def create_hackathon():
    """Create a new hackathon"""
    try:
        user_id = int(get_jwt_identity())  # Convert string to int for database query
        data = request.get_json()
        
        # Validate required fields
        if not data.get('title') or not data.get('description'):
            return jsonify({'error': 'Title and description are required'}), 400
        if not data.get('start_date') or not data.get('end_date'):
            return jsonify({'error': 'Start date and end date are required'}), 400
        
        # Create hackathon
        hackathon = Hackathon(
            title=data['title'],
            description=data['description'],
            theme=data.get('theme', ''),
            required_skills=data.get('required_skills', ''),
            creator_id=user_id,
            min_team_size=data.get('min_team_size', 3),
            max_team_size=data.get('max_team_size', 5),
            preferred_team_size=data.get('preferred_team_size', 4),
            start_date=datetime.fromisoformat(data['start_date']),
            end_date=datetime.fromisoformat(data['end_date']),
            registration_deadline=datetime.fromisoformat(data['registration_deadline']) if data.get('registration_deadline') else None,
            status=data.get('status', 'upcoming')
        )
        
        # Generate embedding
        hackathon_text = f"{hackathon.description} {hackathon.required_skills} {hackathon.theme}"
        embedding = nlp_service.encode_text(hackathon_text)
        import json
        hackathon.description_embedding = json.dumps(embedding.tolist())
        
        db.session.add(hackathon)
        db.session.commit()
        
        return jsonify({
            'message': 'Hackathon created successfully',
            'hackathon': hackathon.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@projects_bp.route('/hackathons', methods=['GET'])
@jwt_required()
def get_hackathons():
    """Get all hackathons"""
    try:
        hackathons = Hackathon.query.all()
        return jsonify({
            'hackathons': [hackathon.to_dict() for hackathon in hackathons]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@projects_bp.route('/hackathons/<int:hackathon_id>', methods=['GET'])
@jwt_required()
def get_hackathon(hackathon_id):
    """Get hackathon by ID"""
    try:
        hackathon = Hackathon.query.get(hackathon_id)
        if not hackathon:
            return jsonify({'error': 'Hackathon not found'}), 404
        
        return jsonify({
            'hackathon': hackathon.to_dict(include_teams=True)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
