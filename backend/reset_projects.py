"""
Reset project-related data while keeping users and profiles intact.
Run: python reset_projects.py (from backend directory)
"""

from app import create_app
from extensions import db
from models.matching import MatchExplanation, SimilarityScore
from models.team import Team, TeamMember
from models.project import Project, Hackathon


def reset_projects():
    """Remove all projects, teams, hackathons, and matching data. Keep users and profiles."""
    app = create_app()
    
    with app.app_context():
        try:
            # Delete in order respecting foreign keys
            match_exp_count = MatchExplanation.query.delete()
            sim_count = SimilarityScore.query.delete()
            team_member_count = TeamMember.query.delete()
            team_count = Team.query.delete()
            project_count = Project.query.delete()
            hackathon_count = Hackathon.query.delete()
            
            db.session.commit()
            
            print("Project reset complete:")
            print(f"  - Match explanations: {match_exp_count}")
            print(f"  - Similarity scores:  {sim_count}")
            print(f"  - Team members:       {team_member_count}")
            print(f"  - Teams:              {team_count}")
            print(f"  - Projects:           {project_count}")
            print(f"  - Hackathons:         {hackathon_count}")
            print("\nUsers and profiles preserved. Ready for new project cycle.")
            
        except Exception as e:
            db.session.rollback()
            print(f"Error: {e}")
            raise


if __name__ == '__main__':
    reset_projects()
