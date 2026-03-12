from flask import Blueprint, request, jsonify
from extensions import db
from models.exam import ExamQuestion, ExamResult
from models.student_skill import StudentSkill
from models.user import User
from flask_jwt_extended import jwt_required, get_jwt_identity
import json
from datetime import datetime
import uuid

exam_bp = Blueprint('exam', __name__)

def check_user_blocked(user_id):
    """Check if user is blocked"""
    user = User.query.get(user_id)
    if user and user.is_blocked:
        return True, user.blocked_reason
    return False, None

@exam_bp.route('/questions', methods=['GET'])
@jwt_required()
def get_questions():
    skill = request.args.get('skill')
    if not skill:
        return jsonify({"error": "Skill required"}), 400
    
    # Get approved questions for this skill (case-insensitive)
    questions = ExamQuestion.query.filter(
        ExamQuestion.skill.ilike(skill),
        ExamQuestion.status == 'approved'
    ).all()
    if not questions:
        return jsonify([])
    return jsonify([q.to_dict() for q in questions])

@exam_bp.route('/questions/all', methods=['GET'])
@jwt_required()
def get_all_questions():
    """Get all questions regardless of status (for mentors)"""
    user_id = get_jwt_identity()
    current_user = User.query.get(user_id)
    
    if not current_user or (current_user.role and current_user.role.name) not in ['mentor', 'admin']:
        return jsonify({'error': 'Only mentors or admins can view all questions'}), 403
    
    skill = request.args.get('skill')
    status = request.args.get('status')
    
    query = ExamQuestion.query
    
    if skill and skill != 'all':
        query = query.filter(ExamQuestion.skill.ilike(skill))
    if status:
        query = query.filter(ExamQuestion.status == status)
    
    questions = query.order_by(ExamQuestion.created_at.desc()).all()
    return jsonify([q.to_dict() for q in questions])

@exam_bp.route('/questions', methods=['POST'])
@jwt_required()
def add_question():
    data = request.json
    
    q = ExamQuestion(
        skill=data.get('skill'),
        title=data.get('title'),
        question_type=data.get('type', 'Coding'),
        problem_statement=data.get('problem_statement', ''),
        marks=data.get('marks', 10),
        options_json=json.dumps(data.get('options')) if data.get('options') else None,
        correct_answer=data.get('correct_answer'),
        sample_input=data.get('sample_input'),
        sample_output=data.get('sample_output'),
        test_cases_json=json.dumps(data.get('test_cases')) if data.get('test_cases') else None,
        status=data.get('status', 'approved')
    )
    db.session.add(q)
    db.session.commit()
    return jsonify(q.to_dict()), 201

@exam_bp.route('/questions/<int:question_id>', methods=['PUT'])
@jwt_required()
def update_question(question_id):
    """Update a question"""
    user_id = get_jwt_identity()
    current_user = User.query.get(user_id)
    
    if not current_user or (current_user.role and current_user.role.name) not in ['mentor', 'admin']:
        return jsonify({'error': 'Only mentors or admins can update questions'}), 403
    
    question = ExamQuestion.query.get(question_id)
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    data = request.json
    
    if 'title' in data:
        question.title = data['title']
    if 'skill' in data:
        question.skill = data['skill']
    if 'type' in data:
        question.question_type = data['type']
    if 'marks' in data:
        question.marks = data['marks']
    if 'problem_statement' in data:
        question.problem_statement = data['problem_statement']
    if 'options' in data:
        question.options_json = json.dumps(data['options']) if data['options'] else None
    if 'correct_answer' in data:
        question.correct_answer = data['correct_answer']
    if 'test_cases' in data:
        question.test_cases_json = json.dumps(data['test_cases']) if data['test_cases'] else None
    if 'status' in data:
        question.status = data['status']
    
    db.session.commit()
    
    return jsonify(question.to_dict()), 200

@exam_bp.route('/questions/<int:question_id>', methods=['DELETE'])
@jwt_required()
def delete_question(question_id):
    """Delete a question - marks as rejected so it won't appear in exams"""
    user_id = get_jwt_identity()
    current_user = User.query.get(user_id)
    
    if not current_user or (current_user.role and current_user.role.name) not in ['mentor', 'admin']:
        return jsonify({'error': 'Only mentors or admins can delete questions'}), 403
    
    question = ExamQuestion.query.get(question_id)
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    question.status = 'rejected'
    db.session.commit()
    
    return jsonify({'message': 'Question removed from exam successfully'}), 200

@exam_bp.route('/ai-questions', methods=['GET'])
@jwt_required()
def get_ai_questions():
    """Get all AI-generated questions (pending, approved, rejected)"""
    status = request.args.get('status')
    query = ExamQuestion.query.filter(ExamQuestion.is_ai_generated == True)
    
    if status:
        query = query.filter(ExamQuestion.status == status)
    
    questions = query.order_by(ExamQuestion.created_at.desc()).all()
    return jsonify([q.to_dict() for q in questions])

@exam_bp.route('/ai-questions', methods=['POST'])
@jwt_required()
def save_ai_question():
    """Save an AI-generated question (pending review)"""
    try:
        user_id = get_jwt_identity()
        current_user = User.query.get(user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.json
        
        q = ExamQuestion(
            skill=data.get('skill'),
            title=data.get('title'),
            question_type=data.get('type', 'Coding'),
            problem_statement=data.get('problem_statement', ''),
            marks=data.get('marks', 10),
            options_json=json.dumps(data.get('options')) if data.get('options') else None,
            correct_answer=data.get('correct_answer'),
            sample_input=data.get('sample_input'),
            sample_output=data.get('sample_output'),
            test_cases_json=json.dumps(data.get('test_cases')) if data.get('test_cases') else None,
            status=data.get('status', 'pending'),
            is_ai_generated=True
        )
        db.session.add(q)
        db.session.commit()
        return jsonify(q.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500

@exam_bp.route('/ai-questions/<int:question_id>', methods=['PUT'])
@jwt_required()
def update_ai_question(question_id):
    """Update an AI-generated question"""
    user_id = get_jwt_identity()
    current_user = User.query.get(user_id)
    
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    # Temporarily allow any logged-in user for testing
    # user_role = current_user.role.name if current_user.role else None
    # if user_role not in ['mentor', 'admin']:
    #     return jsonify({'error': 'Only mentors or admins can update AI questions'}), 403
    
    question = ExamQuestion.query.get(question_id)
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    data = request.json
    
    if 'skill' in data:
        question.skill = data['skill']
    if 'title' in data:
        question.title = data['title']
    if 'type' in data:
        question.question_type = data.get('type', 'Coding')
    if 'problem_statement' in data:
        question.problem_statement = data['problem_statement']
    if 'marks' in data:
        question.marks = data['marks']
    if 'options' in data:
        question.options_json = json.dumps(data['options']) if data['options'] else None
    if 'correct_answer' in data:
        question.correct_answer = data['correct_answer']
    if 'sample_input' in data:
        question.sample_input = data['sample_input']
    if 'sample_output' in data:
        question.sample_output = data['sample_output']
    if 'test_cases' in data:
        question.test_cases_json = json.dumps(data['test_cases']) if data['test_cases'] else None
    if 'status' in data:
        question.status = data['status']
    
    db.session.commit()
    return jsonify(question.to_dict()), 200

@exam_bp.route('/ai-questions/<int:question_id>', methods=['DELETE'])
@jwt_required()
def delete_ai_question(question_id):
    """Delete an AI-generated question - marks as rejected so it won't appear in exams"""
    user_id = get_jwt_identity()
    current_user = User.query.get(user_id)
    
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    user_role = current_user.role.name if current_user.role else None
    if user_role not in ['mentor', 'admin']:
        return jsonify({'error': 'Only mentors or admins can delete AI questions'}), 403
    
    question = ExamQuestion.query.get(question_id)
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    question.status = 'rejected'
    db.session.commit()
    
    return jsonify({'message': 'Question removed from exam successfully'}), 200

@exam_bp.route('/submit', methods=['POST'])
@jwt_required()
def submit_exam():
    user_id = get_jwt_identity()
    data = request.json
    
    is_blocked, reason = check_user_blocked(user_id)
    if is_blocked:
        return jsonify({
            "error": "Your account is temporarily blocked. Contact admin.",
            "blocked": True,
            "reason": reason
        }), 403
    
    # Check if there's already a recent attempt for this skill to avoid duplicates
    existing = ExamResult.query.filter_by(
        user_id=user_id,
        skill=data.get('skill')
    ).order_by(ExamResult.timestamp.desc()).first()
    
    if existing and existing.status == 'IN_PROGRESS':
        # Update existing in-progress attempt
        existing.answers_json = json.dumps(data.get('answers'))
        existing.score = data.get('score')
        existing.proctoring_flags = data.get('flags', 0)
        existing.proctoring_logs_json = json.dumps(data.get('logs', []))
        existing.proctor_logs_json = json.dumps(data.get('proctorLogs', []))
        existing.status = 'COMPLETED'
        existing.timestamp = datetime.utcnow()
        
        score = data.get('score', 0)
        skill_name = data.get('skill')
        if skill_name:
            student_skill = StudentSkill.query.filter_by(user_id=user_id, skill_name=skill_name).first()
            if not student_skill:
                student_skill = StudentSkill(user_id=user_id, skill_name=skill_name)
                db.session.add(student_skill)
                
            student_skill.assessment_score = score
            student_skill.assessed_at = datetime.utcnow()
            try:
                student_skill.status = 'passed' if float(score) >= 60 else 'failed'
            except (ValueError, TypeError):
                student_skill.status = 'failed'

        db.session.commit()
        return jsonify(existing.to_dict()), 200
    
    # Create new result if no existing in-progress attempt
    attempt_id = str(uuid.uuid4())
    
    result = ExamResult(
        user_id=user_id,
        skill=data.get('skill'),
        attempt_id=attempt_id,
        answers_json=json.dumps(data.get('answers')),
        score=data.get('score'),
        proctoring_flags=data.get('flags', 0),
        proctoring_logs_json=json.dumps(data.get('logs', [])),
        proctor_logs_json=json.dumps(data.get('proctorLogs', [])),
        status='COMPLETED'
    )
    db.session.add(result)
    
    score = data.get('score', 0)
    skill_name = data.get('skill')
    if skill_name:
        student_skill = StudentSkill.query.filter_by(user_id=user_id, skill_name=skill_name).first()
        if not student_skill:
            try:
                student_skill = StudentSkill(user_id=user_id, skill_name=skill_name)
                db.session.add(student_skill)
                db.session.flush()
            except Exception:
                db.session.rollback()
                student_skill = StudentSkill.query.filter_by(user_id=user_id, skill_name=skill_name).first()
        
        if student_skill:
            student_skill.assessment_score = score
            student_skill.assessed_at = datetime.utcnow()
            try:
                student_skill.status = 'passed' if float(score) >= 60 else 'failed'
            except (ValueError, TypeError):
                student_skill.status = 'failed'

    db.session.commit()
    return jsonify(result.to_dict()), 201

@exam_bp.route('/results', methods=['GET'])
@jwt_required()
def get_results():
    user_id = get_jwt_identity()
    role = request.args.get('role')
    skill = request.args.get('skill')
    
    query = ExamResult.query
    
    if role == 'mentor':
        if skill:
            query = query.filter_by(skill=skill)
        results = query.order_by(ExamResult.timestamp.desc()).all()
    else:
        query = query.filter_by(user_id=user_id)
        if skill:
            query = query.filter_by(skill=skill)
        results = query.order_by(ExamResult.timestamp.desc()).all()
        
    return jsonify([r.to_dict() for r in results])

@exam_bp.route('/results/<int:result_id>/edit-score', methods=['PUT'])
@jwt_required()
def edit_result_score(result_id):
    user_id = get_jwt_identity()
    current_user = User.query.get(user_id)
    
    if not current_user or (current_user.role and current_user.role.name) != 'mentor':
        return jsonify({'error': 'Only mentors can edit scores'}), 403
    
    data = request.json
    new_score = data.get('score')
    feedback = data.get('feedback')
    
    result = ExamResult.query.get(result_id)
    if not result:
        return jsonify({'error': 'Result not found'}), 404
    
    if new_score is not None:
        try:
            result.overridden_score = float(new_score)
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid score value'}), 400
    
    if feedback:
        result.mentor_feedback = feedback
    
    db.session.commit()
    
    # Also update the student's skill score
    student_skill = StudentSkill.query.filter_by(
        user_id=result.user_id,
        skill_name=result.skill
    ).first()
    
    if student_skill:
        student_skill.assessment_score = result.overridden_score if result.overridden_score is not None else result.score
        score_value = float(student_skill.assessment_score) if student_skill.assessment_score is not None else 0.0
        student_skill.status = 'passed' if score_value >= 60.0 else 'failed'
        db.session.commit()
    
    return jsonify(result.to_dict()), 200

@exam_bp.route('/results/latest', methods=['GET'])
@jwt_required()
def get_latest_result():
    user_id = get_jwt_identity()
    skill = request.args.get('skill')
    
    if not skill:
        return jsonify({"error": "Skill required"}), 400
    
    result = ExamResult.query.filter_by(
        user_id=user_id,
        skill=skill
    ).order_by(ExamResult.timestamp.desc()).first()
    
    if not result:
        return jsonify({"error": "No result found"}), 404
    
    return jsonify(result.to_dict())

@exam_bp.route('/attempt/start', methods=['POST'])
@jwt_required()
def start_exam_attempt():
    user_id = get_jwt_identity()
    data = request.json
    skill = data.get('skill')
    
    if not skill:
        return jsonify({"error": "Skill required"}), 400
    
    is_blocked, reason = check_user_blocked(user_id)
    if is_blocked:
        return jsonify({
            "error": "Your account is temporarily blocked. Contact admin.",
            "blocked": True,
            "reason": reason
        }), 403
    
    attempt_id = str(uuid.uuid4())
    
    result = ExamResult(
        user_id=user_id,
        skill=skill,
        attempt_id=attempt_id,
        answers_json=json.dumps({}),
        score=0,
        status='IN_PROGRESS'
    )
    db.session.add(result)
    db.session.commit()
    
    return jsonify(result.to_dict()), 201

@exam_bp.route('/attempt/<attempt_id>/submit', methods=['POST'])
@jwt_required()
def submit_exam_attempt(attempt_id):
    user_id = get_jwt_identity()
    data = request.json
    
    result = ExamResult.query.filter_by(
        attempt_id=attempt_id,
        user_id=user_id
    ).first()
    
    if not result:
        # Try to find any existing result for this user/skill to avoid duplicate
        existing = ExamResult.query.filter_by(
            user_id=user_id,
            skill=data.get('skill')
        ).order_by(ExamResult.timestamp.desc()).first()
        
        if existing:
            # Update existing record instead
            result = existing
        else:
            # Create new if none exists
            result = ExamResult(
                user_id=user_id,
                skill=data.get('skill'),
                attempt_id=attempt_id,
                answers_json=json.dumps(data.get('answers', {})),
                score=data.get('score', 0),
                proctoring_flags=data.get('flags', 0),
                proctoring_logs_json=json.dumps(data.get('logs', [])),
                proctor_logs_json=json.dumps(data.get('proctorLogs', [])),
                status='COMPLETED'
            )
            db.session.add(result)
    
    result.answers_json = json.dumps(data.get('answers', {}))
    result.score = data.get('score', 0)
    result.proctoring_flags = data.get('flags', 0)
    result.proctoring_logs_json = json.dumps(data.get('logs', []))
    result.proctor_logs_json = json.dumps(data.get('proctorLogs', []))
    result.status = 'COMPLETED'
    result.timestamp = datetime.utcnow()
    
    score = data.get('score', 0)
    skill_name = data.get('skill')
    if skill_name:
        student_skill = StudentSkill.query.filter_by(user_id=user_id, skill_name=skill_name).first()
        if not student_skill:
            try:
                student_skill = StudentSkill(user_id=user_id, skill_name=skill_name)
                db.session.add(student_skill)
                db.session.flush()  # Check for unique constraint violation
            except Exception:
                db.session.rollback()
                student_skill = StudentSkill.query.filter_by(user_id=user_id, skill_name=skill_name).first()
        
        if student_skill:
            student_skill.assessment_score = score
            student_skill.assessed_at = datetime.utcnow()
            try:
                student_skill.status = 'passed' if float(score) >= 60 else 'failed'
            except (ValueError, TypeError):
                student_skill.status = 'failed'

    db.session.commit()
    return jsonify(result.to_dict()), 200

@exam_bp.route('/attempt/<attempt_id>/terminate', methods=['POST'])
@jwt_required()
def terminate_exam_attempt(attempt_id):
    user_id = get_jwt_identity()
    data = request.json
    
    result = ExamResult.query.filter_by(
        attempt_id=attempt_id,
        user_id=user_id
    ).first()
    
    if not result:
        return jsonify({"error": "Attempt not found"}), 404
    
    result.status = 'TERMINATED'
    result.proctoring_flags = data.get('flags', 0)
    result.proctoring_logs_json = json.dumps(data.get('logs', []))
    result.timestamp = datetime.utcnow()
    
    db.session.commit()
    return jsonify(result.to_dict()), 200

@exam_bp.route('/evaluate/<int:result_id>', methods=['POST'])
@jwt_required()
def evaluate_result(result_id):
    result = ExamResult.query.get_or_404(result_id)
    data = request.json
    
    if 'overridden_score' in data:
        result.overridden_score = data['overridden_score']
    if 'feedback' in data:
        result.mentor_feedback = data['feedback']
    result.status = 'Graded'
    
    # Update StudentSkill if score overridden
    if 'overridden_score' in data:
        score = data['overridden_score']
        student_skill = StudentSkill.query.filter_by(user_id=result.user_id, skill_name=result.skill).first()
        if student_skill:
            student_skill.assessment_score = score
            try:
                student_skill.status = 'passed' if float(score) >= 60 else 'failed'
            except (ValueError, TypeError):
                student_skill.status = 'failed'
    
    db.session.commit()
    return jsonify(result.to_dict()), 200

@exam_bp.route('/assign', methods=['POST'])
@jwt_required()
def assign_exam_to_student():
    """Mentor assigns an exam to a student"""
    user_id = get_jwt_identity()
    data = request.json
    
    student_id = data.get('student_id')
    skill = data.get('skill')
    
    if not student_id or not skill:
        return jsonify({"error": "student_id and skill are required"}), 400
    
    # Check if already assigned
    existing = StudentSkill.query.filter_by(
        user_id=student_id,
        skill_name=skill
    ).first()
    
    if existing:
        existing.status = 'assigned'
        existing.assigned_at = datetime.utcnow()
    else:
        student_skill = StudentSkill(
            user_id=student_id,
            skill_name=skill,
            status='assigned',
            assigned_at=datetime.utcnow()
        )
        db.session.add(student_skill)
    
    db.session.commit()
    return jsonify({"message": f"Exam assigned to student", "skill": skill}), 200

@exam_bp.route('/unassign', methods=['POST'])
@jwt_required()
def unassign_exam_from_student():
    """Mentor unassigns an exam from a student"""
    user_id = get_jwt_identity()
    data = request.json
    
    student_id = data.get('student_id')
    skill = data.get('skill')
    
    if not student_id or not skill:
        return jsonify({"error": "student_id and skill are required"}), 400
    
    # Find the assigned exam
    student_skill = StudentSkill.query.filter_by(
        user_id=student_id,
        skill_name=skill,
        status='assigned'
    ).first()
    
    if not student_skill:
        return jsonify({"error": "No assigned exam found for this student and skill"}), 404
    
    # Delete the assigned exam record
    db.session.delete(student_skill)
    db.session.commit()
    
    return jsonify({"message": f"Exam unassigned from student", "skill": skill}), 200

@exam_bp.route('/assigned', methods=['GET'])
@jwt_required()
def get_assigned_exams():
    """Get all assigned exams (mentor/admin only) - optionally filtered by skill"""
    skill = request.args.get('skill')
    
    query = StudentSkill.query.filter_by(status='assigned')
    
    if skill:
        query = query.filter_by(skill_name=skill)
    
    assigned = query.all()
    
    # Group by user_id and skill
    result = {}
    for a in assigned:
        key = f"{a.user_id}_{a.skill_name}"
        result[key] = {
            'user_id': a.user_id,
            'skill_name': a.skill_name,
            'assigned_at': a.assigned_at.isoformat() if a.assigned_at else None
        }
    
    return jsonify({'assigned': result}), 200

@exam_bp.route('/my-assigned', methods=['GET'])
@jwt_required()
def get_my_assigned_exams():
    """Get student's assigned exams"""
    user_id = get_jwt_identity()
    
    # Show only assigned (not yet taken) exams
    assigned = StudentSkill.query.filter(
        StudentSkill.user_id == user_id,
        StudentSkill.status == 'assigned'
    ).all()
    
    return jsonify([{
        'id': s.id,
        'skill_name': s.skill_name,
        'status': s.status,
        'assigned_at': s.assigned_at.isoformat() if s.assigned_at else None,
        'assessment_score': s.assessment_score
    } for s in assigned]), 200

@exam_bp.route('/leaderboard', methods=['GET'])
@jwt_required()
def get_leaderboard():
    """Get exam leaderboard - top scores by skill"""
    skill = request.args.get('skill')
    limit = request.args.get('limit', 10, type=int)
    
    query = ExamResult.query.filter(
        ExamResult.status.in_(['COMPLETED', 'Graded'])
    )
    
    if skill:
        query = query.filter(ExamResult.skill.ilike(skill))
    
    results = query.order_by(ExamResult.score.desc()).limit(limit).all()
    
    leaderboard = []
    for idx, r in enumerate(results):
        final_score = r.overridden_score if r.overridden_score is not None else r.score
        leaderboard.append({
            'rank': idx + 1,
            'user_id': r.user_id,
            'user_name': r.user.full_name if r.user else 'Unknown',
            'skill': r.skill,
            'score': final_score,
            'timestamp': r.timestamp.isoformat() if r.timestamp else None
        })
    
    return jsonify(leaderboard), 200
