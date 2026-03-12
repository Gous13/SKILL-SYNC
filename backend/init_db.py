"""
Database initialization script
Creates tables and default roles
"""

from app import create_app
from extensions import db
from models.user import Role

def init_database():
    """Initialize database with default roles"""
    app = create_app()
    
    with app.app_context():
        # Create all tables
        db.create_all()
        
        # Create default roles if they don't exist
        roles = [
            {'name': 'student', 'description': 'Student user'},
            {'name': 'mentor', 'description': 'Mentor/Faculty user'},
            {'name': 'admin', 'description': 'Administrator'}
        ]
        
        for role_data in roles:
            role = Role.query.filter_by(name=role_data['name']).first()
            if not role:
                role = Role(**role_data)
                db.session.add(role)
                print(f"Created role: {role_data['name']}")
        
        db.session.commit()
        print("Database initialized successfully!")

if __name__ == '__main__':
    init_database()
