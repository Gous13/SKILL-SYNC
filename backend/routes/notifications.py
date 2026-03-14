from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models.message import Message
from models.project_task import ProjectTask
from models.project import Project
from models.group_chat import GroupChat, GroupChatMember, GroupMessage
from models.group_chat_read_state import GroupChatReadState


notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.route("", methods=["GET"])
@jwt_required()
def get_notifications():
  """
  Get notifications for the current user.
  Includes both direct messages AND unread group chat messages.

  Optional query params:
  - type: 'message' | 'task' | 'project'
  - limit: max number of items to return (default: 50)
  """
  try:
    current_user_id = int(get_jwt_identity())
    notif_type = (request.args.get("type") or "").strip().lower()
    limit = request.args.get("limit", 50, type=int)
    if limit <= 0 or limit > 200:
      limit = 50

    items = []

    # --- Direct messages ---
    query = Message.query.filter(
      Message.receiver_id == current_user_id,
      Message.deleted_by_receiver_at == None,  # noqa: E711
    )

    if notif_type in ("message", "task", "project"):
      query = query.filter(Message.type == notif_type)

    query = query.order_by(Message.created_at.desc()).limit(limit)
    messages = query.all()

    # Preload related tasks/projects for richer navigation targets
    task_ids = {m.related_id for m in messages if m.type == "task" and m.related_id}
    project_ids = {m.related_id for m in messages if m.type == "project" and m.related_id}

    tasks_by_id = {}
    projects_by_id = {}

    if task_ids:
      for t in ProjectTask.query.filter(ProjectTask.id.in_(task_ids)).all():
        tasks_by_id[t.id] = {
          "id": t.id,
          "title": t.title,
          "team_id": t.team_id,
          "project_id": t.project_id,
        }

    if project_ids:
      for p in Project.query.filter(Project.id.in_(project_ids)).all():
        projects_by_id[p.id] = {
          "id": p.id,
          "title": p.title,
        }

    for m in messages:
      base = m.to_dict(include_sender=True)
      base_type = (m.type or "message").lower()
      base["type"] = base_type
      base["related_id"] = m.related_id

      meta = {}
      if base_type == "task" and m.related_id and m.related_id in tasks_by_id:
        meta["task"] = tasks_by_id[m.related_id]
      elif base_type == "project" and m.related_id and m.related_id in projects_by_id:
        meta["project"] = projects_by_id[m.related_id]

      base["meta"] = meta
      items.append(base)

    # --- Group chat messages (unread only) ---
    # Only include if type filter isn't set to task/project (group msgs are type=message)
    if notif_type in ("", "message", "all"):
      memberships = GroupChatMember.query.filter_by(user_id=current_user_id).all()
      for mem in memberships:
        gc = mem.group_chat
        if not gc:
          continue
        rs = GroupChatReadState.query.filter_by(
          group_chat_id=gc.id, user_id=current_user_id
        ).first()
        last_read_id = rs.last_read_message_id if rs else 0

        unread_group_msgs = GroupMessage.query.filter(
          GroupMessage.group_chat_id == gc.id,
          GroupMessage.id > last_read_id,
          GroupMessage.sender_id != current_user_id
        ).order_by(GroupMessage.created_at.desc()).limit(10).all()

        for gm in unread_group_msgs:
          sender = gm.sender
          items.append({
            "id": f"group_{gm.id}",
            "type": "message",
            "content": f"[{gc.project.title if gc.project else 'Group'}] {gm.content}",
            "created_at": gm.created_at.isoformat() if gm.created_at else None,
            "is_read": False,
            "sender_id": gm.sender_id,
            "sender": sender.to_dict() if sender else None,
            "group_chat_id": gc.id,
            "meta": {}
          })

    # Sort all notifications by date descending and apply limit
    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    items = items[:limit]

    return jsonify({"notifications": items}), 200
  except Exception as e:
    db.session.rollback()
    return jsonify({"error": str(e)}), 500


