"""
Streak routes – manage and expose daily learning streak data.
"""

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.streak import UserStreak
from models.user import User, Role
from datetime import date, timedelta

streak_bp = Blueprint('streaks', __name__)


def update_streak(user_id):
    """
    Call this whenever a student performs a qualifying activity.
    Streak rules:
      - Same day  → no change
      - Next day  → streak + 1, update longest if needed
      - Gap > 1 day → reset to 1
    """
    today = date.today()
    streak = UserStreak.query.filter_by(user_id=user_id).first()

    if not streak:
        streak = UserStreak(
            user_id=user_id,
            streak_count=1,
            longest_streak=1,
            last_active_date=today
        )
        db.session.add(streak)
    else:
        if streak.last_active_date == today:
            # Already active today – nothing to do
            return streak
        elif streak.last_active_date == today - timedelta(days=1):
            # Consecutive day – increment
            streak.streak_count += 1
        else:
            # Gap of more than 1 day – reset
            streak.streak_count = 1

        streak.last_active_date = today
        if streak.streak_count > streak.longest_streak:
            streak.longest_streak = streak.streak_count

    db.session.commit()
    return streak


# ────────────────────────────────────────────────
# Student: get own streak
# ────────────────────────────────────────────────
@streak_bp.route('/me', methods=['GET'])
@jwt_required()
def get_my_streak():
    user_id = int(get_jwt_identity())
    streak = UserStreak.query.filter_by(user_id=user_id).first()
    if not streak:
        return jsonify({
            'user_id': user_id,
            'streak_count': 0,
            'longest_streak': 0,
            'last_active_date': None
        }), 200
    return jsonify(streak.to_dict()), 200


# ────────────────────────────────────────────────
# Mentor: view all student streaks
# ────────────────────────────────────────────────
@streak_bp.route('/students', methods=['GET'])
@jwt_required()
def get_student_streaks():
    """Returns streak data for all students – read-only for mentors."""
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)
    if not current_user or current_user.role.name.lower() not in ('mentor', 'admin'):
        return jsonify({'error': 'Access denied'}), 403

    student_role = Role.query.filter(db.func.lower(Role.name) == 'student').first()
    if not student_role:
        return jsonify([]), 200

    students = User.query.filter_by(role_id=student_role.id, is_active=True).all()
    today = date.today()
    result = []
    for s in students:
        streak = UserStreak.query.filter_by(user_id=s.id).first()
        if streak:
            # Mark inactive if no activity yesterday or today
            last = streak.last_active_date
            is_active_today = last == today or last == today - timedelta(days=1)
            result.append({
                'user_id': s.id,
                'user_name': s.full_name,
                'email': s.email,
                'streak_count': streak.streak_count,
                'longest_streak': streak.longest_streak,
                'last_active_date': last.isoformat() if last else None,
                'is_active': is_active_today
            })
        else:
            result.append({
                'user_id': s.id,
                'user_name': s.full_name,
                'email': s.email,
                'streak_count': 0,
                'longest_streak': 0,
                'last_active_date': None,
                'is_active': False
            })

    # Sort by streak_count descending
    result.sort(key=lambda x: x['streak_count'], reverse=True)
    return jsonify(result), 200


# ────────────────────────────────────────────────
# Admin: platform-wide streak analytics
# ────────────────────────────────────────────────
@streak_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_streak_analytics():
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)
    if not current_user or current_user.role.name.lower() != 'admin':
        return jsonify({'error': 'Access denied'}), 403

    all_streaks = UserStreak.query.all()
    if not all_streaks:
        return jsonify({
            'highest_streak': 0,
            'average_streak': 0,
            'total_active_students': 0,
            'top_students': []
        }), 200

    counts = [s.streak_count for s in all_streaks]
    highest = max(counts)
    average = round(sum(counts) / len(counts), 1)
    today = date.today()
    active_count = sum(
        1 for s in all_streaks
        if s.last_active_date and (s.last_active_date == today or s.last_active_date == today - timedelta(days=1))
    )

    # Top 5 by current streak
    top = sorted(all_streaks, key=lambda s: s.streak_count, reverse=True)[:5]
    top_students = [{
        'user_id': s.user_id,
        'user_name': s.user.full_name if s.user else 'Unknown',
        'streak_count': s.streak_count,
        'longest_streak': s.longest_streak,
    } for s in top]

    return jsonify({
        'highest_streak': highest,
        'average_streak': average,
        'total_active_students': active_count,
        'top_students': top_students
    }), 200
