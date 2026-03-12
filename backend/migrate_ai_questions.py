"""Add is_ai_generated column to exam_questions table"""
from extensions import db
from app import create_app

app = create_app()

with app.app_context():
    # Check if column exists
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    columns = [col['name'] for col in inspector.get_columns('exam_questions')]
    
    if 'is_ai_generated' not in columns:
        db.session.execute(db.text('ALTER TABLE exam_questions ADD COLUMN is_ai_generated BOOLEAN DEFAULT 0'))
        db.session.commit()
        print("Added is_ai_generated column to exam_questions table")
    else:
        print("Column already exists")
