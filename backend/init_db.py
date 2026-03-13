from app import create_app
from extensions import db

def init_database():
    """Initialize database (roles handled by create_app)"""
    app = create_app()
    print("Database and roles initialized successfully via app factory!")

if __name__ == '__main__':
    init_database()
