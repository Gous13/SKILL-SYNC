"""
Skill assessment routes for student skill verification.
- MCQ assessment (legacy): /assessment/<skill_name>, /assess/<student_skill_id>
- Practical assessment: /practical/start/<student_skill_id>, /practical/submit
"""

import json
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.student_skill import StudentSkill
from models.skill_assessment import SkillAssessment, SkillAssessmentResult
from utils.decorators import student_required
from services.skill_assessment_service import (
    resolve_assessment_skill,
    start_assessment,
    submit_assessment,
    run_assessment,
)

skills_bp = Blueprint('skills', __name__)

PASSING_THRESHOLD = 70.0  # Configurable passing score percentage (MCQ)


@skills_bp.route('/add', methods=['POST'])
@jwt_required()
@student_required
def add_skill():
    """Add a skill (initially unverified)"""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json()
        skill_name = (data.get('skill_name') or '').strip()
        if not skill_name:
            return jsonify({'error': 'skill_name is required'}), 400

        existing = StudentSkill.query.filter_by(user_id=user_id, skill_name=skill_name).first()
        if existing:
            return jsonify({
                'message': 'Skill already exists',
                'skill': existing.to_dict()
            }), 200

        skill = StudentSkill(user_id=user_id, skill_name=skill_name, status='unverified')
        db.session.add(skill)
        db.session.commit()
        return jsonify({
            'message': 'Skill added. Complete assessment to verify.',
            'skill': skill.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@skills_bp.route('/my-skills', methods=['GET'])
@jwt_required()
@student_required
def get_my_skills():
    """List current user's skills with status"""
    try:
        user_id = int(get_jwt_identity())
        skills = StudentSkill.query.filter_by(user_id=user_id).order_by(StudentSkill.skill_name).all()
        return jsonify({
            'skills': [s.to_dict() for s in skills]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@skills_bp.route('/assessment/<skill_name>', methods=['GET'])
@jwt_required()
@student_required
def get_assessment(skill_name):
    """Get MCQ assessment questions for a skill"""
    try:
        skill_name = skill_name.strip()
        questions = SkillAssessment.query.filter_by(skill_name=skill_name).limit(8).all()
        if not questions:
            return jsonify({'error': f'No assessment available for skill: {skill_name}'}), 404
        # Return questions without correct_option (for security)
        result = []
        for q in questions:
            result.append({
                'id': q.id,
                'skill_name': q.skill_name,
                'question_text': q.question_text,
                'option_a': q.option_a,
                'option_b': q.option_b,
                'option_c': q.option_c,
                'option_d': q.option_d,
            })
        return jsonify({'questions': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@skills_bp.route('/assess/<int:student_skill_id>', methods=['POST'])
@jwt_required()
@student_required
def submit_mcq_assessment(student_skill_id):
    """Submit assessment answers and get result"""
    try:
        user_id = int(get_jwt_identity())
        student_skill = StudentSkill.query.get(student_skill_id)
        if not student_skill or student_skill.user_id != user_id:
            return jsonify({'error': 'Skill not found'}), 404

        data = request.get_json()
        answers = data.get('answers')  # {question_id: 'a'|'b'|'c'|'d'}
        if not isinstance(answers, dict):
            return jsonify({'error': 'answers must be an object mapping question_id to option'}), 400

        q_ids = []
        for k in answers.keys():
            try:
                q_ids.append(int(k))
            except (ValueError, TypeError):
                pass
        if not q_ids:
            return jsonify({'error': 'No valid question IDs'}), 400

        questions = SkillAssessment.query.filter(
            SkillAssessment.id.in_(q_ids),
            SkillAssessment.skill_name == student_skill.skill_name
        ).all()
        if not questions:
            return jsonify({'error': 'No valid questions found'}), 400

        correct = 0
        total = len(questions)
        for q in questions:
            sid = str(q.id)
            if sid in answers and answers[sid].lower() in ['a', 'b', 'c', 'd']:
                if answers[sid].lower() == q.correct_option.lower():
                    correct += 1

        score = (correct / total * 100) if total > 0 else 0
        passed = score >= PASSING_THRESHOLD

        result = SkillAssessmentResult(
            student_skill_id=student_skill_id,
            answers=json.dumps(answers),
            score=score,
            passed=passed
        )
        db.session.add(result)

        if passed:
            from datetime import datetime
            student_skill.status = 'verified'
            student_skill.assessment_score = score
            student_skill.assessed_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'score': round(score, 1),
            'passed': passed,
            'correct': correct,
            'total': total,
            'skill': student_skill.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@skills_bp.route('/verified-only', methods=['GET'])
@jwt_required()
@student_required
def get_verified_skills():
    """Get only verified skills for current user (used internally by matching)"""
    try:
        user_id = int(get_jwt_identity())
        skills = StudentSkill.query.filter_by(user_id=user_id, status='verified').all()
        return jsonify({
            'skills': [{'skill_name': s.skill_name, 'score': s.assessment_score} for s in skills]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ----- Practical Assessment (dynamic, code-based) -----

@skills_bp.route('/practical/check/<int:student_skill_id>', methods=['GET'])
@jwt_required()
@student_required
def check_practical_available(student_skill_id):
    """Check if practical assessment is available for this skill"""
    try:
        user_id = int(get_jwt_identity())
        student_skill = StudentSkill.query.get(student_skill_id)
        if not student_skill or student_skill.user_id != user_id:
            return jsonify({'error': 'Skill not found'}), 404
        from services.skill_assessment_service import resolve_assessment_skill, can_start_assessment
        is_supported = resolve_assessment_skill(student_skill.skill_name) is not None
        can_start, msg = can_start_assessment(user_id, student_skill) if is_supported else (False, "Not supported")
        
        return jsonify({
            'available': is_supported and can_start,
            'is_supported': is_supported,
            'message': msg,
            'skill_name': student_skill.skill_name,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@skills_bp.route('/practical/start/<int:student_skill_id>', methods=['POST'])
@jwt_required()
@student_required
def start_practical(student_skill_id):
    """Start practical assessment - returns random question set (1 easy + 1 hard)"""
    try:
        user_id = int(get_jwt_identity())
        student_skill = StudentSkill.query.get(student_skill_id)
        if not student_skill or student_skill.user_id != user_id:
            return jsonify({'error': 'Skill not found'}), 404
        result = start_assessment(user_id, student_skill)
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@skills_bp.route('/practical/submit', methods=['POST'])
@jwt_required()
@student_required
def submit_practical():
    """Submit practical assessment answers and get score"""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json(silent=True) or {}
        
        student_skill_id = data.get('student_skill_id')
        set_id = data.get('set_id')
        answers = data.get('answers') or {}

        if not student_skill_id or not set_id:
            return jsonify({'error': 'Missing student_skill_id or set_id'}), 400

        timeout = getattr(current_app.config, 'ASSESSMENT_TIMEOUT_SECONDS', 30)
        result = submit_assessment(user_id, int(student_skill_id), int(set_id), answers, timeout=timeout)
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 400

        return jsonify(result), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@skills_bp.route('/practical/run', methods=['POST'])
@jwt_required()
@student_required
def run_practical():
    """Run code against sample tests (Sandbox)"""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json(silent=True) or {}
        
        student_skill_id = data.get('student_skill_id')
        question_id = data.get('question_id')
        code = data.get('code')
        
        if not all([student_skill_id, question_id, code]):
            return jsonify({'error': 'Missing required fields'}), 400
            
        result = run_assessment(user_id, student_skill_id, question_id, code)
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
            
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
