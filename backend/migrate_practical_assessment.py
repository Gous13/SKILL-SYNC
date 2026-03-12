"""
Migration: Create practical assessment tables (assessment_questions, assessment_sets, assessment_attempts).
Safe to run - creates tables only if they don't exist.
Run after init_db.py, before seed_practical_assessments.py.
"""

from app import create_app
from extensions import db

def migrate():
    app = create_app()
    with app.app_context():
        db.create_all()
        print("Migration complete. Practical assessment tables ready.")

if __name__ == '__main__':
    migrate()
