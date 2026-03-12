"""
Team management routes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.team import Team, TeamMember
from models.project import Project, Hackathon
from models.project_task import ProjectTask
from models.message import Message
from utils.decorators import mentor_or_admin_required
from datetime import datetime

teams_bp = Blueprint('teams', __name__)


def _create_notification_message(sender: User, receiver: User, content: str, notif_type: str = 'message', related_id=None):
    """
    Helper to create a typed notification backed by the Message model.
    This is best-effort and deliberately non-critical: failures here must
    never break core team/task flows.
    """
    if not sender or not receiver or not content:
        return None

    try:
        msg = Message(
            sender_id=sender.id,
            sender_role=sender.role.name if getattr(sender, 'role', None) else 'unknown',
            receiver_id=receiver.id,
            receiver_role=receiver.role.name if getattr(receiver, 'role', None) else 'unknown',
            content=content,
            type=notif_type or 'message',
            related_id=related_id
        )
        db.session.add(msg)
        return msg
    except Exception:
        # Silently ignore notification failures
        return None

@teams_bp.route('', methods=['POST'])
@jwt_required()
def create_team():
    """Create a new team or join existing team for a project"""
    try:
        user_id = int(get_jwt_identity())  # Convert string to int for database query
        data = request.get_json()
        
        project_id = data.get('project_id')
        hackathon_id = data.get('hackathon_id')
        
        if not project_id and not hackathon_id:
            return jsonify({'error': 'Either project_id or hackathon_id is required'}), 400
        
        # Verify project/hackathon exists
        if project_id:
            project = Project.query.get(project_id)
            if not project:
                return jsonify({'error': 'Project not found'}), 404
        if hackathon_id:
            hackathon = Hackathon.query.get(hackathon_id)
            if not hackathon:
                return jsonify({'error': 'Hackathon not found'}), 404
        
        # Check if user is already in a team for this project/hackathon
        existing_member = TeamMember.query.join(Team).filter(
            TeamMember.user_id == user_id,
            (Team.project_id == project_id if project_id else False) | 
            (Team.hackathon_id == hackathon_id if hackathon_id else False)
        ).first()
        
        if existing_member:
            # User is already in a team for this project
            team = existing_member.team
            # Ensure relationships are loaded
            if team.members:
                for member in team.members:
                    if member.user_id:
                        _ = member.user
            return jsonify({
                'message': 'You are already in a team for this project',
                'team': team.to_dict()
            }), 200
        
        # Check if there's an existing team for this project that has space
        if project_id:
            existing_team = Team.query.filter_by(project_id=project_id).first()
        else:
            existing_team = Team.query.filter_by(hackathon_id=hackathon_id).first()
        
        if existing_team:
            # Check if team has space
            current_size = len(existing_team.members) if existing_team.members else 0
            max_size = (project.max_team_size if project_id and project else None) or \
                      (hackathon.max_team_size if hackathon_id and hackathon else None) or 5
            
            if current_size < max_size:
                # Join existing team
                member = TeamMember(
                    team_id=existing_team.id,
                    user_id=user_id,
                    role='member',
                    status='active'
                )
                db.session.add(member)
                db.session.commit()
                
                # Reload team
                existing_team = Team.query.get(existing_team.id)
                if existing_team.members:
                    for member in existing_team.members:
                        if member.user_id:
                            _ = member.user
                
                # Ensure project group chat exists (mentor + students)
                if project_id:
                    from services.group_chat_service import ensure_project_group_chat
                    ensure_project_group_chat(project_id)
                    db.session.commit()

                # Check if we should auto-form teams (if project has enough joined students)
                if project_id:
                    # Import here to avoid circular import
                    from routes.matching import _auto_form_teams_for_project
                    success, teams_count, msg = _auto_form_teams_for_project(project_id)
                    if success:
                        # Reload team after auto-formation
                        existing_team = Team.query.get(existing_team.id)
                        if existing_team and existing_team.members:
                            for member in existing_team.members:
                                if member.user_id:
                                    _ = member.user
                        return jsonify({
                            'message': f'Successfully joined! {msg}',
                            'team': existing_team.to_dict() if existing_team else None,
                            'teams_auto_formed': teams_count
                        }), 200

                # Project-level notification: let the project mentor know a student joined a team
                if project_id and project and project.creator_id:
                    try:
                        joiner = User.query.get(user_id)
                        mentor = User.query.get(project.creator_id)
                        if joiner and mentor and mentor.id != joiner.id:
                            _create_notification_message(
                                sender=joiner,
                                receiver=mentor,
                                content=f"{joiner.full_name} joined a team for your project '{project.title}'",
                                notif_type='project',
                                related_id=project.id
                            )
                            db.session.commit()
                    except Exception:
                        db.session.rollback()
                
                return jsonify({
                    'message': 'Successfully joined existing team',
                    'team': existing_team.to_dict()
                }), 200
        
        # Create new team if no existing team or existing team is full
        team_name = data.get('name') or f"{project.title if project_id else hackathon.title} - Team"
        team = Team(
            name=team_name,
            project_id=project_id,
            hackathon_id=hackathon_id,
            description=data.get('description', f"Team for {project.title if project_id else hackathon.title}"),
            status='forming'
        )
        
        db.session.add(team)
        db.session.flush()
        
        # Add creator as team leader
        member = TeamMember(
            team_id=team.id,
            user_id=user_id,
            role='leader',
            status='active'
        )
        db.session.add(member)
        db.session.commit()

        # Ensure project group chat exists (mentor + students)
        if project_id:
            from services.group_chat_service import ensure_project_group_chat
            ensure_project_group_chat(project_id)
            db.session.commit()
        
        # Reload team to ensure relationships are loaded
        team = Team.query.get(team.id)
        # Ensure user relationships are loaded for members
        if team and team.members:
            for member in team.members:
                if member.user_id:
                    _ = member.user  # Trigger lazy load
        
        # Check if we should auto-form teams (if project has enough joined students)
        if project_id:
            # Import here to avoid circular import
            from routes.matching import _auto_form_teams_for_project
            success, teams_count, msg = _auto_form_teams_for_project(project_id)
            if success:
                # Team was deleted and recreated, so reload it
                project = Project.query.get(project_id)
                # Get the first team for this project (should be newly created)
                new_team = Team.query.filter_by(project_id=project_id).first()
                if new_team and new_team.members:
                    for member in new_team.members:
                        if member.user_id:
                            _ = member.user
                return jsonify({
                    'message': f'Team created! {msg}',
                    'team': new_team.to_dict() if new_team else None,
                    'teams_auto_formed': teams_count
                }), 201

        # Project notification: let the mentor know a new team was created
        if project_id and project and project.creator_id:
            try:
                creator = User.query.get(user_id)
                mentor = User.query.get(project.creator_id)
                if creator and mentor and mentor.id != creator.id:
                    _create_notification_message(
                        sender=creator,
                        receiver=mentor,
                        content=f"New team '{team.name}' created for your project '{project.title}'",
                        notif_type='project',
                        related_id=project.id
                    )
                    db.session.commit()
            except Exception:
                db.session.rollback()
        
        return jsonify({
            'message': 'Team created successfully',
            'team': team.to_dict() if team else None
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@teams_bp.route('', methods=['GET'])
@jwt_required()
def get_teams():
    """Get all teams (filtered by user's context)"""
    try:
        user_id = int(get_jwt_identity())  # Convert string to int for database query
        user = User.query.get(user_id)
        
        # Get teams user is member of
        user_teams = Team.query.join(TeamMember).filter(TeamMember.user_id == user_id).all()
        
        # Ensure relationships are loaded before calling to_dict()
        def load_team_relationships(teams):
            for team in teams:
                if team.members:
                    for member in team.members:
                        if member.user_id:
                            _ = member.user  # Trigger lazy load
        
        load_team_relationships(user_teams)
        
        # If admin/mentor, get all teams
        if user.role.name in ['admin', 'mentor']:
            all_teams = Team.query.all()
            load_team_relationships(all_teams)
            return jsonify({
                'teams': [team.to_dict() for team in all_teams],
                'my_teams': [team.to_dict() for team in user_teams]
            }), 200
        
        return jsonify({
            'teams': [team.to_dict() for team in user_teams]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@teams_bp.route('/<int:team_id>', methods=['GET'])
@jwt_required()
def get_team(team_id):
    """Get team by ID"""
    try:
        team = Team.query.get(team_id)
        if not team:
            return jsonify({'error': 'Team not found'}), 404
        
        # Ensure user relationships are loaded for members
        if team.members:
            for member in team.members:
                if member.user_id:
                    _ = member.user  # Trigger lazy load
        
        team_dict = team.to_dict()
        # Include project group chat id for student workspace (same chat as mentor)
        if team.project_id:
            from services.group_chat_service import ensure_project_group_chat
            from models.group_chat import GroupChat
            group_chat, _ = ensure_project_group_chat(team.project_id)
            if group_chat:
                db.session.commit()
                team_dict['group_chat_id'] = group_chat.id
            else:
                gc = GroupChat.query.filter_by(project_id=team.project_id).first()
                team_dict['group_chat_id'] = gc.id if gc else None
        else:
            team_dict['group_chat_id'] = None
        
        return jsonify({
            'team': team_dict
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@teams_bp.route('/<int:team_id>/members', methods=['POST'])
@jwt_required()
def add_member(team_id):
    """Add member to team"""
    try:
        user_id = int(get_jwt_identity())  # Convert string to int for database query
        team = Team.query.get(team_id)
        
        if not team:
            return jsonify({'error': 'Team not found'}), 404
        
        if team.is_locked:
            return jsonify({'error': 'Team is locked'}), 400
        
        data = request.get_json()
        member_user_id = data.get('user_id', user_id)  # Default to current user
        
        # Check if user is already in team
        existing = TeamMember.query.filter_by(team_id=team_id, user_id=member_user_id).first()
        if existing:
            return jsonify({'error': 'User is already a member of this team'}), 400
        
        # Check team size limits
        project = team.project
        hackathon = team.hackathon
        max_size = (project.max_team_size if project else None) or (hackathon.max_team_size if hackathon else None) or 5
        
        if len(team.members) >= max_size:
            return jsonify({'error': 'Team is at maximum capacity'}), 400
        
        # Add member
        member = TeamMember(
            team_id=team_id,
            user_id=member_user_id,
            role=data.get('role', 'member'),
            status='active'
        )
        
        db.session.add(member)
        db.session.commit()

        # Ensure project group chat exists when adding to project team
        if team.project_id:
            from services.group_chat_service import ensure_project_group_chat
            ensure_project_group_chat(team.project_id)
            db.session.commit()
        
        return jsonify({
            'message': 'Member added successfully',
            'member': member.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@teams_bp.route('/<int:team_id>/skill-validation', methods=['GET'])
@jwt_required()
def get_team_skill_validation(team_id):
    """Get team skill confidence and coverage (team members, mentor, admin)"""
    try:
        user_id = int(get_jwt_identity())
        team = Team.query.get(team_id)
        if not team:
            return jsonify({'error': 'Team not found'}), 404

        user = User.query.get(user_id)
        is_member = any(m.user_id == user_id for m in (team.members or []))
        is_mentor = team.project and team.project.creator_id == user_id
        is_admin = user.role and user.role.name == 'admin'

        if not (is_member or is_mentor or is_admin):
            return jsonify({'error': 'Unauthorized'}), 403

        from services.team_validation_service import validate_team_skills
        result = validate_team_skills(team_id)
        if 'error' in result:
            return jsonify({'error': result['error']}), 404
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@teams_bp.route('/<int:team_id>/tasks', methods=['GET'])
@jwt_required()
def get_team_tasks(team_id):
    """List tasks for a team"""
    try:
        user_id = int(get_jwt_identity())
        team = Team.query.get(team_id)
        if not team:
            return jsonify({'error': 'Team not found'}), 404
        user = User.query.get(user_id)
        is_member = any(m.user_id == user_id for m in (team.members or []))
        is_mentor = team.project and team.project.creator_id == user_id
        is_admin = user.role and user.role.name == 'admin'
        if not (is_member or is_mentor or is_admin):
            return jsonify({'error': 'Unauthorized'}), 403
        tasks = ProjectTask.query.filter_by(team_id=team_id).order_by(ProjectTask.created_at.desc()).all()
        return jsonify({'tasks': [t.to_dict() for t in tasks]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@teams_bp.route('/<int:team_id>/tasks', methods=['POST'])
@jwt_required()
def create_team_task(team_id):
    """Create task (mentor only)"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        team = Team.query.get(team_id)
        if not team or not team.project_id:
            return jsonify({'error': 'Team not found'}), 404
        if team.project.creator_id != user_id and (not user.role or user.role.name != 'admin'):
            return jsonify({'error': 'Only mentor or admin can create tasks'}), 403
        data = request.get_json() or {}
        title = (data.get('title') or '').strip()
        if not title:
            return jsonify({'error': 'Title is required'}), 400
        deadline = None
        if data.get('deadline'):
            try:
                deadline = datetime.fromisoformat(data['deadline'].replace('Z', '+00:00'))
            except (ValueError, TypeError):
                pass
        task = ProjectTask(
            team_id=team_id,
            project_id=team.project_id,
            title=title,
            description=data.get('description', ''),
            assignee_id=data.get('assignee_id'),
            status='pending',
            deadline=deadline,
            created_by=user_id
        )
        db.session.add(task)

        # Notification: task assignment for assignee (if any)
        if task.assignee_id:
            try:
                assignee = User.query.get(task.assignee_id)
                if assignee:
                    _create_notification_message(
                        sender=user,
                        receiver=assignee,
                        content=f"You have been assigned a new task: {task.title}",
                        notif_type='task',
                        related_id=task.id
                    )
            except Exception:
                # Non-critical path
                pass

        db.session.commit()
        return jsonify({'message': 'Task created', 'task': task.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@teams_bp.route('/<int:team_id>/tasks/<int:task_id>', methods=['PUT'])
@jwt_required()
def update_team_task(team_id, task_id):
    """Update task (status, assignee) - mentor or assignee"""
    try:
        user_id = int(get_jwt_identity())
        task = ProjectTask.query.filter_by(id=task_id, team_id=team_id).first()
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        team = Team.query.get(team_id)
        if not team:
            return jsonify({'error': 'Team not found'}), 404
        user = User.query.get(user_id)
        is_mentor = team.project and team.project.creator_id == user_id
        is_admin = user.role and user.role.name == 'admin'
        is_assignee = task.assignee_id == user_id
        is_member = any(m.user_id == user_id for m in (team.members or []))
        if not (is_mentor or is_admin or is_assignee or is_member):
            return jsonify({'error': 'Unauthorized'}), 403
        data = request.get_json() or {}

        # Capture previous values for notification logic
        old_status = task.status
        old_assignee_id = task.assignee_id

        if 'status' in data and data['status'] in ('pending', 'in_progress', 'completed'):
            if is_mentor or is_admin or is_assignee:
                task.status = data['status']
        if 'assignee_id' in data and (is_mentor or is_admin):
            task.assignee_id = data['assignee_id'] or None
        if 'title' in data and (is_mentor or is_admin):
            task.title = (data['title'] or '').strip() or task.title
        if 'description' in data and (is_mentor or is_admin):
            task.description = data.get('description', '')
        if 'deadline' in data and (is_mentor or is_admin):
            task.deadline = datetime.fromisoformat(data['deadline'].replace('Z', '+00:00')) if data.get('deadline') else None

        # Task-related notifications
        try:
            # Notify new assignee if changed
            if task.assignee_id and task.assignee_id != old_assignee_id:
                new_assignee = User.query.get(task.assignee_id)
                if new_assignee:
                    _create_notification_message(
                        sender=user,
                        receiver=new_assignee,
                        content=f"You have been assigned task: {task.title}",
                        notif_type='task',
                        related_id=task.id
                    )
            # Notify assignee on status change
            elif task.assignee_id and task.status != old_status:
                current_assignee = User.query.get(task.assignee_id)
                if current_assignee:
                    _create_notification_message(
                        sender=user,
                        receiver=current_assignee,
                        content=f"Task '{task.title}' status updated to {task.status}",
                        notif_type='task',
                        related_id=task.id
                    )
        except Exception:
            # Never let notification issues break task updates
            pass

        db.session.commit()
        return jsonify({'message': 'Task updated', 'task': task.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@teams_bp.route('/<int:team_id>/members/<int:member_id>', methods=['DELETE'])
@jwt_required()
def remove_member(team_id, member_id):
    """Remove member from team"""
    try:
        user_id = int(get_jwt_identity())  # Convert string to int for database query
        team = Team.query.get(team_id)
        
        if not team:
            return jsonify({'error': 'Team not found'}), 404
        
        if team.is_locked:
            return jsonify({'error': 'Team is locked'}), 400
        
        member = TeamMember.query.get(member_id)
        if not member or member.team_id != team_id:
            return jsonify({'error': 'Member not found'}), 404
        
        # Only team leader or admin can remove members
        current_user = User.query.get(user_id)
        is_leader = any(m.user_id == user_id and m.role == 'leader' for m in team.members)
        
        if not is_leader and current_user.role.name != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        
        db.session.delete(member)
        db.session.commit()
        
        return jsonify({
            'message': 'Member removed successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
