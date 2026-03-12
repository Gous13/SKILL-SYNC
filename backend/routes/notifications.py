"""
Notification routes

Provides a unified notification feed backed by the existing Message model.
This is intentionally minimal and non-breaking:
- Reuses the 'messages' table (Message model) as the notifications store
- Adds optional server-side filtering by notification type
- Does not change any existing message or task behavior
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models.message import Message
from models.project_task import ProjectTask
from models.project import Project


notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.route("", methods=["GET"])
@jwt_required()
def get_notifications():
  """
  Get notifications for the current user.

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

    items = []
    for m in messages:
      base = m.to_dict(include_sender=True)
      # Ensure type/related_id are always present in payload
      base_type = (m.type or "message").lower()
      base["type"] = base_type
      base["related_id"] = m.related_id

      # Optional, type-specific metadata to help the frontend route correctly
      meta = {}
      if base_type == "task" and m.related_id and m.related_id in tasks_by_id:
        meta["task"] = tasks_by_id[m.related_id]
      elif base_type == "project" and m.related_id and m.related_id in projects_by_id:
        meta["project"] = projects_by_id[m.related_id]

      base["meta"] = meta
      items.append(base)

    return jsonify({"notifications": items}), 200
  except Exception as e:
    db.session.rollback()
    return jsonify({"error": str(e)}), 500

