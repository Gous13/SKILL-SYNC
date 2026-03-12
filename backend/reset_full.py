"""
Full system reset - removes ALL data (users, profiles, projects, teams, messages, logs).
Keeps roles for fresh registration.
Run: python reset_full.py (from backend directory)
"""

from app import create_app
from extensions import db
from models.matching import MatchExplanation, SimilarityScore
from models.team import Team, TeamMember
from models.message import Message
from models.profile import StudentProfile
from models.project import Project, Hackathon
from models.analytics import SystemLog
from models.user import User


def reset_full():
    """Remove all data. Keep roles."""
    app = create_app()
    
    with app.app_context():
        try:
            match_exp_count = MatchExplanation.query.delete()
            sim_count = SimilarityScore.query.delete()
            team_member_count = TeamMember.query.delete()
            team_count = Team.query.delete()
            msg_count = Message.query.delete()
            profile_count = StudentProfile.query.delete()
            project_count = Project.query.delete()
            hackathon_count = Hackathon.query.delete()
            log_count = SystemLog.query.delete()
            user_count = User.query.delete()
            
            db.session.commit()
            
            print("Full system reset complete:")
            print(f"  - Match explanations: {match_exp_count}")
            print(f"  - Similarity scores:  {sim_count}")
            print(f"  - Team members:       {team_member_count}")
            print(f"  - Teams:              {team_count}")
            print(f"  - Messages:           {msg_count}")
            print(f"  - Profiles:           {profile_count}")
            print(f"  - Projects:           {project_count}")
            print(f"  - Hackathons:         {hackathon_count}")
            print(f"  - Logs:               {log_count}")
            print(f"  - Users:              {user_count}")
            print("\nDatabase empty. Roles preserved. Run init_db.py to ensure roles exist.")
            print("New users can register and create projects from scratch.")
            
        except Exception as e:
            db.session.rollback()
            print(f"Error: {e}")
            raise


if __name__ == '__main__':
    reset_full()
