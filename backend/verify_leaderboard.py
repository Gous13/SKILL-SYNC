import sys
import os
sys.path.append(os.getcwd())
from app import create_app
from extensions import db
from models.exam import ExamQuestion, ExamResult
from models.skill_assessment import SkillAssessment
from models.student_skill import StudentSkill
import json

app = create_app()
with app.app_context():
    print("--- Testing /api/exam/skills logic ---")
    try:
        all_skills = set()
        def add_from_query(query_result):
            for row in query_result:
                if row and row[0]:
                    all_skills.add(row[0].strip())

        add_from_query(db.session.query(ExamQuestion.skill).distinct().all())
        add_from_query(db.session.query(ExamResult.skill).distinct().all())
        add_from_query(db.session.query(SkillAssessment.skill_name).distinct().all())
        add_from_query(db.session.query(StudentSkill.skill_name).distinct().all())
        
        popular_skills = ["Java", "C", "C++", "C#", "JavaScript", "Python", "TypeScript"]
        for sk in popular_skills:
            all_skills.add(sk)
            
        result = sorted(list([s for s in all_skills if s]))
        print(f"Skills found: {result}")
    except Exception as e:
        print(f"Error in skills logic: {e}")

    print("\n--- Testing /api/exam/leaderboard (overall) logic ---")
    try:
        from sqlalchemy import func
        latest_attempts_subquery = db.session.query(
            ExamResult.user_id,
            ExamResult.skill,
            func.max(ExamResult.timestamp).label('max_ts')
        ).filter(
            ExamResult.status.in_(['COMPLETED', 'Graded'])
        ).group_by(ExamResult.user_id, ExamResult.skill).subquery()

        results = db.session.query(
            ExamResult.user_id,
            func.sum(func.coalesce(ExamResult.overridden_score, ExamResult.score)).label('total_score'),
            func.max(ExamResult.timestamp).label('latest_timestamp')
        ).join(
            latest_attempts_subquery,
            (ExamResult.user_id == latest_attempts_subquery.c.user_id) & 
            (ExamResult.skill == latest_attempts_subquery.c.skill) & 
            (ExamResult.timestamp == latest_attempts_subquery.c.max_ts)
        ).group_by(ExamResult.user_id).limit(10).all()
        
        print(f"Leaderboard (overall) count: {len(results)}")
        for r in results:
            print(f"User {r.user_id}: {r.total_score}")
    except Exception as e:
        print(f"Error in leaderboard logic: {e}")
