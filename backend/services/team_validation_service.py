"""
Team skill validation - verifies team collectively covers project required skills
"""

from models.project import Project
from models.team import Team, TeamMember
from models.student_skill import StudentSkill
from models.profile import StudentProfile
from services.nlp_service import get_nlp_service


def _normalize_skill(s):
    return (s or '').lower().strip()


def _skill_matches(skill_a, skill_b):
    """Check if two skills match (exact or partial)"""
    a = _normalize_skill(skill_a)
    b = _normalize_skill(skill_b)
    if not a or not b:
        return False
    if a == b:
        return True
    if a in b or b in a:
        return True
    a_tokens = set(a.replace('-', ' ').split())
    b_tokens = set(b.replace('-', ' ').split())
    return bool(a_tokens & b_tokens)


def validate_team_skills(team_id):
    """
    Validate that team collectively covers project required skills.
    Returns dict with coverage, confidence, warnings.
    """
    team = Team.query.get(team_id)
    if not team or not team.project_id:
        return {'error': 'Team or project not found'}

    project = Project.query.get(team.project_id)
    if not project:
        return {'error': 'Project not found'}

    # Parse required skills directly from the comma-separated field
    raw = (project.required_skills or '').strip()
    required_skills = [s.strip().lower() for s in raw.split(',') if s.strip()] if raw else []

    if not required_skills:
        return {
            'team_id': team_id,
            'project_id': team.project_id,
            'required_skills': [],
            'coverage': [],
            'confidence_score': 1.0,
            'warnings': []
        }

    # Get each member's VERIFIED skills only (passed or verified status)
    member_skills = {}
    for member in team.members or []:
        user_id = member.user_id
        skills = StudentSkill.query.filter(
            StudentSkill.user_id == user_id,
            StudentSkill.status.in_(['passed', 'verified'])
        ).all()
        member_skills[user_id] = [
            {'skill_name': s.skill_name, 'score': s.assessment_score or 0}
            for s in skills
        ]

    coverage = []
    warnings = []

    for req in required_skills:
        best_member_id = None
        best_score = 0
        members_with_skill = []

        for user_id, skills in member_skills.items():
            for sk in skills:
                if _skill_matches(req, sk['skill_name']):
                    members_with_skill.append({'user_id': user_id, 'score': sk['score']})
                    if sk['score'] and sk['score'] > best_score:
                        best_score = sk['score']
                        best_member_id = user_id

        covered = len(members_with_skill) > 0
        coverage.append({
            'skill': req,
            'covered': covered,
            'best_member_id': best_member_id,
            'best_score': best_score,
            'members_with_skill': members_with_skill
        })
        if not covered:
            warnings.append(f"{req}: No verified team member")

    covered_count = sum(1 for c in coverage if c['covered'])
    confidence = covered_count / len(required_skills) if required_skills else 1.0

    return {
        'team_id': team_id,
        'project_id': team.project_id,
        'required_skills': required_skills,
        'coverage': coverage,
        'confidence_score': round(confidence, 2),
        'warnings': warnings
    }



def validate_project_teams(project_id):
    """Validate all teams for a project."""
    teams = Team.query.filter_by(project_id=project_id).all()
    results = []
    for team in teams:
        r = validate_team_skills(team.id)
        if 'error' not in r:
            r['team_name'] = team.name
            results.append(r)
    return results
