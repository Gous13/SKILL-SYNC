"""
Configuration settings for SKILLCREW Backend
"""

import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base configuration"""
    SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-secret-key-change-in-production')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRES', 86400))
    
    # Database configuration
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///synapselink.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Flask settings
    FLASK_ENV = os.environ.get('FLASK_ENV', 'development')
    FLASK_DEBUG = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'

    # Skill assessment
    ASSESSMENT_PASSING_THRESHOLD = float(os.environ.get('ASSESSMENT_PASSING_THRESHOLD', 50))
    ASSESSMENT_COOLDOWN_HOURS = int(os.environ.get('ASSESSMENT_COOLDOWN_HOURS', 1))
    ASSESSMENT_TIMEOUT_SECONDS = int(os.environ.get('ASSESSMENT_TIMEOUT_SECONDS', 30))

    # File upload
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB
    ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'py', 'js', 'ts', 'zip', 'png', 'jpg', 'jpeg', 'gif'}
