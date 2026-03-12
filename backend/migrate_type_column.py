"""Rename type column to question_type in exam_questions table"""
from extensions import db
from app import create_app

app = create_app()

with app.app_context():
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    columns = [col['name'] for col in inspector.get_columns('exam_questions')]
    
    if 'type' in columns and 'question_type' not in columns:
        # Backup data first
        print("Renaming 'type' column to 'question_type'...")
        db.session.execute(db.text('ALTER TABLE exam_questions ADD COLUMN question_type VARCHAR(50)'))
        db.session.execute(db.text('UPDATE exam_questions SET question_type = type'))
        db.session.execute(db.text('ALTER TABLE exam_questions DROP COLUMN type'))
        db.session.commit()
        print("Column renamed successfully!")
    elif 'question_type' in columns:
        print("Column question_type already exists")
    else:
        print("No column rename needed")
