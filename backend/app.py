"""
SKILLCREW Backend - Main Application Entry Point
Flask API server for intelligent student collaboration and peer matching
"""

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from extensions import db
from flask_socketio import SocketIO
import os
import logging

socketio = SocketIO(cors_allowed_origins="*")
logger = logging.getLogger('socketio')

def create_app(config_class=Config):
    """Application factory pattern"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions - CORS for all origins
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
    jwt = JWTManager(app)
    db.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*")
    
    # Test CORS endpoint
    @app.route('/api/test-cors')
    def test_cors():
        return {'message': 'CORS working!'}
    
    # Configure JWT error handlers
    from flask import jsonify
    
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has expired'}), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({'error': f'Invalid token: {str(error)}'}), 422
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({'error': 'Authorization token is missing'}), 401
    
    # Register blueprints
    from routes.auth import auth_bp
    from routes.users import users_bp
    from routes.profiles import profiles_bp
    from routes.projects import projects_bp
    from routes.teams import teams_bp
    from routes.matching import matching_bp
    from routes.admin import admin_bp
    from routes.messages import messages_bp
    from routes.skills import skills_bp
    from routes.files import files_bp
    from routes.notifications import notifications_bp
    from routes.exam_routes import exam_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(profiles_bp, url_prefix='/api/profiles')
    app.register_blueprint(projects_bp, url_prefix='/api/projects')
    app.register_blueprint(teams_bp, url_prefix='/api/teams')
    app.register_blueprint(matching_bp, url_prefix='/api/matching')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(messages_bp, url_prefix='/api/messages')
    app.register_blueprint(skills_bp, url_prefix='/api/skills')
    app.register_blueprint(files_bp, url_prefix='/api')
    app.register_blueprint(notifications_bp, url_prefix='/api/notifications')
    app.register_blueprint(exam_bp, url_prefix='/api/exam')
    
    # Create tables
    with app.app_context():
        db.create_all()
    
    @app.route('/api/health')
    def health():
        return {'status': 'healthy', 'message': 'SKILLCREW API is running'}, 200
    
    @socketio.on('proctor_stream')
    def handle_proctor_stream(data):
        skill = data.get('skill')
        student_id = data.get('studentId')
        
        # Emit to specific skill room
        if skill:
            socketio.emit('proctor_frame', data, room=skill)
        
        # Also emit to 'all' room for mentors monitoring
        socketio.emit('proctor_frame', data, room='all')
        
        if skill:
            rooms = socketio.server.manager.rooms.get('', skill)
            if rooms:
                logger.info(f"Broadcasting to room {skill}, subscribers: {len(rooms)}")
        
        logger.info(f"Proctor stream from {data.get('studentName')}, skill: {skill}")

    @socketio.on('join_proctor_room')
    def on_join_proctor(data):
        from flask_socketio import join_room
        skill = data.get('skill')
        if skill:
            join_room(skill)
            logger.info(f"Joined proctor room: {skill}")
            
    @socketio.on('terminate_student')
    def handle_terminate_student(data):
        skill = data.get('skill')
        student_id = data.get('studentId')
        student_name = data.get('studentName')
        
        # Send force_terminate to student
        socketio.emit('force_terminate', data, room=skill)
        
        # Notify mentors about termination
        socketio.emit('proctor_frame', {
            'action': 'TERMINATED',
            'skill': skill,
            'studentId': student_id,
            'studentName': student_name
        }, room='all')
        
        logger.info(f"Instructor terminated exam for student {student_id} in {skill}")
            
    return app

if __name__ == '__main__':
    app = create_app()
    socketio.run(app, debug=False, host='0.0.0.0', port=5000)
