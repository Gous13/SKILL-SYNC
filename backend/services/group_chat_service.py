"""
Group chat service - ensures project group chats exist and are synced with team members
"""

from extensions import db
from models.project import Project
from models.team import Team, TeamMember
from models.group_chat import GroupChat, GroupChatMember


def ensure_project_group_chat(project_id):
    """
    Ensure a group chat exists for the project and has all members (mentor + students).
    Called when teams are formed or members join.
    Returns (group_chat, created) or (None, False) if no students have joined yet.
    """
    project = Project.query.get(project_id)
    if not project:
        return None, False

    # Get all students who have joined (across all teams)
    joined_members = TeamMember.query.join(Team).filter(Team.project_id == project_id).all()
    if not joined_members:
        return None, False

    joined_user_ids = set(m.user_id for m in joined_members)
    mentor_id = project.creator_id
    all_member_ids = joined_user_ids | {mentor_id}

    # Get or create group chat
    group_chat = GroupChat.query.filter_by(project_id=project_id).first()
    created = False
    if not group_chat:
        group_chat = GroupChat(
            project_id=project_id,
            name=project.title  # Display as project name per spec
        )
        db.session.add(group_chat)
        db.session.flush()
        created = True

    # Sync members: ensure mentor + all students are in the group
    existing_member_ids = {m.user_id for m in group_chat.members}
    for user_id in all_member_ids:
        if user_id not in existing_member_ids:
            gcm = GroupChatMember(group_chat_id=group_chat.id, user_id=user_id)
            db.session.add(gcm)

    return group_chat, created
