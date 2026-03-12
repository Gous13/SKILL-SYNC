"""
Explainable AI Service for generating match explanations
"""

from services.nlp_service import get_nlp_service
import json

class ExplanationService:
    """Service for generating explainable AI explanations"""
    
    def __init__(self):
        self.nlp_service = get_nlp_service()
    
    def generate_explanation(self, profile, project, similarity_score):
        """
        Generate detailed human-readable explanation for a match
        
        Args:
            profile: StudentProfile object
            project: Project or Hackathon object
            similarity_score: SimilarityScore object
            
        Returns:
            dict: Explanation with text, overlapping skills, strengths, recommendations
        """
        # Extract keywords from profile and project
        profile_skills = self._extract_skills(profile.skills_description or '')
        project_skills = self._extract_skills(project.required_skills or project.description or '')
        
        # Find overlapping skills
        overlapping = list(set(profile_skills) & set(project_skills))
        missing_skills = [s for s in project_skills if s not in profile_skills]
        
        # Generate detailed explanation text
        explanation_parts = []
        
        # Start with match quality
        score = similarity_score.overall_similarity
        if score >= 0.8:
            explanation_parts.append(f"🎯 Excellent Match ({score*100:.1f}% compatibility): This project is highly aligned with your skillset.")
        elif score >= 0.6:
            explanation_parts.append(f"✅ Good Match ({score*100:.1f}% compatibility): This project matches well with your profile.")
        elif score >= 0.5:
            explanation_parts.append(f"✓ Moderate Match ({score*100:.1f}% compatibility): This project has some alignment with your skills.")
        
        # Detailed skill matching explanation
        if overlapping:
            explanation_parts.append(f"\n🔧 Skill Match: You have {len(overlapping)} matching skill(s) with this project:")
            explanation_parts.append(f"   • {', '.join(overlapping[:8])}")
            explanation_parts.append(f"\nThis means you can directly contribute to: {project.title}")
        else:
            explanation_parts.append(f"\n⚠️ Limited direct skill overlap, but your background could provide complementary perspectives.")
        
        # Why this project matches
        match_reasons = []
        if overlapping:
            match_reasons.append(f"Your skills in {', '.join(overlapping[:3])} are directly needed for this project")
        
        if profile.experience_description:
            # Check if experience mentions project-related terms
            exp_lower = profile.experience_description.lower()
            proj_lower = (project.required_skills or project.description or '').lower()
            common_terms = [term for term in project_skills if term in exp_lower]
            if common_terms:
                match_reasons.append(f"You have experience with {', '.join(common_terms[:2])}")
        
        if profile.interests_description:
            interests_lower = profile.interests_description.lower()
            interest_matches = [term for term in project_skills if term in interests_lower]
            if interest_matches:
                match_reasons.append(f"Your interests in {', '.join(interest_matches[:2])} align with the project")
        
        if match_reasons:
            explanation_parts.append(f"\n💡 Why This Project Matches You:")
            for reason in match_reasons:
                explanation_parts.append(f"   • {reason}")
        
        # Project requirements analysis
        if project.required_skills:
            explanation_parts.append(f"\n📋 Project Requirements: {project.required_skills[:100]}...")
        
        # Missing skills (if any)
        if missing_skills:
            explanation_parts.append(f"\n📚 Additional Skills Needed: {', '.join(missing_skills[:5])}")
            explanation_parts.append("   (Don't worry - teams need diverse skills, and you can learn on the job!)")
        
        # Strengths
        strengths = []
        if profile.experience_description:
            strengths.append("Relevant experience")
        if profile.gpa and profile.gpa >= 3.5:
            strengths.append("Strong academic record")
        if len(overlapping) >= 3:
            strengths.append("Multiple matching skills")
        
        if strengths:
            explanation_parts.append(f"\n⭐ Your Strengths: {', '.join(strengths)}")
        
        explanation_text = "\n".join(explanation_parts)
        
        return {
            'explanation_text': explanation_text,
            'overlapping_skills': overlapping[:10],  # Top 10
            'strengths': strengths,
            'recommendations': [f"Consider highlighting: {', '.join(missing_skills[:3])}"] if missing_skills else []
        }
    
    def _extract_skills(self, text):
        """Extract skills from text"""
        if not text:
            return []
        
        # Split by common delimiters
        import re
        # Split by comma, semicolon, or "and"
        parts = re.split(r'[,;]|\band\b', text.lower())
        
        skills = []
        for part in parts:
            part = part.strip()
            # Remove common prefixes
            part = re.sub(r'^(skills?|experience|proficient in|knowledge of|familiar with):?\s*', '', part)
            if len(part) > 2:  # Minimum length
                skills.append(part)
        
        # Remove duplicates and return
        return list(set(skills))[:20]  # Limit to 20 skills
