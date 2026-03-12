"""
Database models for SKILLCREW
"""

from .user import User, Role
from .profile import StudentProfile
from .project import Project, Hackathon
from .team import Team, TeamMember
from .matching import SimilarityScore, MatchExplanation
from .analytics import SystemLog
from .message import Message
from .group_chat import GroupChat, GroupChatMember, GroupMessage
from .group_chat_read_state import GroupChatReadState
from .student_skill import StudentSkill
from .skill_assessment import SkillAssessment, SkillAssessmentResult
from .practical_assessment import AssessmentQuestion, AssessmentSet, AssessmentAttempt
from .project_task import ProjectTask
from .team_file import TeamFile
from .exam import ExamQuestion, ExamResult

__all__ = [
    'User', 'Role',
    'StudentProfile',
    'Project', 'Hackathon',
    'Team', 'TeamMember',
    'SimilarityScore', 'MatchExplanation',
    'SystemLog',
    'Message',
    'GroupChat', 'GroupChatMember', 'GroupMessage',
    'GroupChatReadState',
    'StudentSkill', 'SkillAssessment', 'SkillAssessmentResult',
    'AssessmentQuestion', 'AssessmentSet', 'AssessmentAttempt',
    'ProjectTask', 'TeamFile',
    'ExamQuestion', 'ExamResult'
]
