"""
Minimal, SQLite-safe migration for notification categorization fields.

Extends the existing 'messages' table with:
- type:   'message' | 'task' | 'project' (default: 'message')
- related_id: optional integer linking to a related entity (e.g., task or project)

This script is idempotent and safe to run multiple times.
"""

from sqlalchemy import inspect, text

from app import create_app
from extensions import db


def migrate():
  app = create_app()
  with app.app_context():
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()
    if "messages" not in tables:
      # Nothing to do if messages table does not exist yet
      return

    columns = {col["name"] for col in inspector.get_columns("messages")}

    # Add 'type' column if missing
    if "type" not in columns:
      db.session.execute(
        text("ALTER TABLE messages ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'message'")
      )

    # Add 'related_id' column if missing
    if "related_id" not in columns:
      db.session.execute(
        text("ALTER TABLE messages ADD COLUMN related_id INTEGER NULL")
      )

    db.session.commit()


if __name__ == "__main__":
  migrate()

