"""
Optimization Service using Google OR-Tools for team formation
"""

from ortools.sat.python import cp_model
import json
import numpy as np


def _get_verified_skills_for_profile(profile):
    """Get verified skill names for a profile; fallback to skills_description keywords if none."""
    from models.student_skill import StudentSkill
    verified = StudentSkill.query.filter(
        StudentSkill.user_id == profile.user_id, 
        StudentSkill.status.in_(['passed', 'verified'])
    ).all()
    if verified:
        return {s.skill_name.lower().strip() for s in verified}
    return None

class OptimizationService:
    """Service for constraint-based team formation optimization"""
    
    def __init__(self):
        """Initialize optimization service"""
        pass
    
    def form_teams(self, profiles, project, similarity_scores, constraints=None):
        """
        Form optimal teams using constraint programming
        
        Args:
            profiles: List of student profiles
            project: Project or Hackathon object
            similarity_scores: Dict mapping profile_id -> similarity_score
            constraints: Optional dict with custom constraints
            
        Returns:
            List of team assignments (list of profile IDs per team)
        """
        if constraints is None:
            constraints = {}
        
        num_students = len(profiles)
        if num_students == 0:
            return []
        
        # Get team size constraints
        min_size = constraints.get('min_team_size', project.min_team_size if hasattr(project, 'min_team_size') else 3)
        max_size = constraints.get('max_team_size', project.max_team_size if hasattr(project, 'max_team_size') else 5)
        preferred_size = constraints.get('preferred_team_size', project.preferred_team_size if hasattr(project, 'preferred_team_size') else 4)
        
        # Calculate an upper bound on number of teams (some may remain inactive).
        # Using an upper bound avoids infeasibility when ceil-division would force
        # too many teams each needing >= min_size.
        num_teams = max(1, (num_students + preferred_size - 1) // preferred_size)  # Ceiling division
        
        # Create model
        model = cp_model.CpModel()
        
        # Decision variables: x[i,t] = 1 if student i is assigned to team t
        x = {}
        for i in range(num_students):
            for t in range(num_teams):
                x[i, t] = model.NewBoolVar(f'student_{i}_team_{t}')
        
        # Team active indicator (allows some teams to be unused while keeping feasibility)
        team_active = {}
        for t in range(num_teams):
            team_active[t] = model.NewBoolVar(f'team_active_{t}')

        # Constraints
        
        # 1. Each student assigned to exactly one team
        for i in range(num_students):
            model.Add(sum(x[i, t] for t in range(num_teams)) == 1)
        
        # 2. Team size constraints (only enforce min_size when team is active)
        team_sizes = {}
        for t in range(num_teams):
            team_size = sum(x[i, t] for i in range(num_students))
            team_sizes[t] = team_size
            # 0 <= team_size <= max_size always
            model.Add(team_size <= max_size)
            # If active => team_size >= min_size, else team_size == 0
            model.Add(team_size >= min_size).OnlyEnforceIf(team_active[t])
            model.Add(team_size == 0).OnlyEnforceIf(team_active[t].Not())

            # Link activity: if any student assigned then active must be 1
            # (team_size >= 1 => active). We model with: team_size <= max_size * active and team_size >= active
            model.Add(team_size <= max_size * team_active[t])
            model.Add(team_size >= team_active[t])
        
        # 3. Objective: OR-Tools decides the final assignment.
        # Similarity is a primary signal, but ties/near-ties are resolved by balancing:
        # - skill coverage (from project required skills/description keywords)
        # - workload balance (availability)
        # - academic balance/diversity (year, GPA)
        # - skill diversity (avoid near-duplicate skill sets within a team)
        objective_terms = []
        
        # --- Helpers to extract/normalize fields used for balancing ---
        from services.nlp_service import get_nlp_service
        nlp = get_nlp_service()

        def _parse_availability_hours(text: str) -> int:
            """
            Parse availability into an integer hours/week bucket.
            Uses a conservative heuristic; returns 0 if unknown.
            Examples:
              "5-10 hours per week" -> 8
              "Available 20 hours per week" -> 20
            """
            if not text:
                return 0
            import re
            s = str(text).lower()
            nums = [int(n) for n in re.findall(r'\d+', s)]
            if not nums:
                return 0
            if len(nums) >= 2:
                return int(round((nums[0] + nums[1]) / 2))
            return int(nums[0])

        def _gpa_to_int(gpa) -> int:
            # Store GPA on a coarse 0-100 scale to keep CP-SAT integers.
            try:
                if gpa is None:
                    return 0
                return int(round(float(gpa) * 10))  # e.g. 8.45 -> 85
            except Exception:
                return 0

        # Project "required skills" keywords for coverage scoring (top-N only)
        project_text = f"{getattr(project, 'required_skills', '')} {getattr(project, 'description', '')}".strip()
        required_keywords = nlp.extract_keywords(project_text, top_n=10) if project_text else []
        required_keywords_set = set(required_keywords)

        # Extract skills for diversity calculation and coverage (prefer verified skills)
        profile_skills_dict = {}
        profile_required_hits = {}  # i -> count of required keywords hit
        availability_hours = {}
        years = {}
        gpas = {}
        for i, profile in enumerate(profiles):
            verified_skills = _get_verified_skills_for_profile(profile)
            if verified_skills:
                skills = verified_skills
            else:
                skills = set(nlp.extract_keywords(profile.skills_description or '', top_n=10))
            interests = set(nlp.extract_keywords(profile.interests_description or '', top_n=10))
            experience = set(nlp.extract_keywords(profile.experience_description or '', top_n=10))
            token_set = skills | interests | experience
            profile_skills_dict[i] = skills
            profile_required_hits[i] = len(token_set & required_keywords_set) if required_keywords_set else 0
            availability_hours[i] = _parse_availability_hours(profile.availability_description or '')
            years[i] = int(profile.year_of_study or 0)
            gpas[i] = _gpa_to_int(profile.gpa)
        
        # --- Similarity component (still important, but not the only factor) ---
        for i in range(num_students):
            profile_id = profiles[i].id
            similarity = similarity_scores.get(profile_id, 0.5)
            for t in range(num_teams):
                objective_terms.append(similarity * 100 * x[i, t])

        # --- Skill coverage component (encourage covering project keywords) ---
        # Reward assigning students who collectively cover more required keywords.
        # Implement as a simple additive reward per student's keyword hits.
        if required_keywords_set:
            for t in range(num_teams):
                for i in range(num_students):
                    if profile_required_hits[i] > 0:
                        objective_terms.append(profile_required_hits[i] * 6 * x[i, t])
        
        # --- Skill diversity within teams ---
        # Penalize teams where students have very similar skills (>80% overlap)
        for t in range(num_teams):
            for i in range(num_students):
                for j in range(i + 1, num_students):
                    # Check if these two students have very similar skills
                    skills_i = profile_skills_dict[i]
                    skills_j = profile_skills_dict[j]
                    if len(skills_i) > 0 and len(skills_j) > 0:
                        overlap_ratio = len(skills_i & skills_j) / max(len(skills_i | skills_j), 1)
                        
                        # If overlap is very high (>80%), add penalty if both in same team
                        if overlap_ratio > 0.8:
                            # Create indicator: both_in_team = x[i,t] AND x[j,t]
                            both_in_team = model.NewBoolVar(f'both_{i}_{j}_team_{t}')
                            # both_in_team == 1 if and only if both x[i,t] == 1 and x[j,t] == 1
                            model.Add(both_in_team <= x[i, t])
                            model.Add(both_in_team <= x[j, t])
                            model.Add(both_in_team >= x[i, t] + x[j, t] - 1)
                            # Penalty for low diversity
                            objective_terms.append(-30 * both_in_team)
        
        # --- Balance team sizes around preferred_size ---
        for t in range(num_teams):
            # OR-Tools CP-SAT does not support calling abs() directly on a
            # linear expression in constraints. We model the absolute
            # deviation using an auxiliary variable and AddAbsEquality.
            diff = model.NewIntVar(0, max_size, f'diff_team_{t}')
            diff_raw = model.NewIntVar(-max_size, max_size, f'diff_raw_team_{t}')
            # diff_raw = team_sizes[t] - preferred_size
            model.Add(diff_raw == team_sizes[t] - preferred_size)
            # diff = |diff_raw|
            model.AddAbsEquality(diff, diff_raw)
            # Penalty for deviation (negative because we maximize the objective)
            objective_terms.append(-diff * 10)

        # --- Availability / Year / GPA balancing & diversity ---
        # We encourage teams to have balanced workload (availability) and avoid extreme homogeneity in year/GPA.
        # Implemented as pairwise penalties for being too similar (year) and for pairing very low-availability
        # with other low-availability students, plus soft penalties for GPA clustering.
        for t in range(num_teams):
            for i in range(num_students):
                for j in range(i + 1, num_students):
                    both_in_team = model.NewBoolVar(f'pair_{i}_{j}_team_{t}')
                    model.Add(both_in_team <= x[i, t])
                    model.Add(both_in_team <= x[j, t])
                    model.Add(both_in_team >= x[i, t] + x[j, t] - 1)

                    # Year diversity: penalize same-year pairings (soft)
                    if years[i] and years[j] and years[i] == years[j]:
                        objective_terms.append(-8 * both_in_team)

                    # Workload balance: penalize pairing two low-availability students (soft)
                    if availability_hours[i] and availability_hours[j]:
                        if availability_hours[i] <= 10 and availability_hours[j] <= 10:
                            objective_terms.append(-10 * both_in_team)

                    # GPA diversity/balance: penalize pairing very similar GPAs (soft)
                    if gpas[i] and gpas[j]:
                        if abs(gpas[i] - gpas[j]) <= 5:  # within ~0.5 GPA
                            objective_terms.append(-4 * both_in_team)
        
        # Maximize objective
        model.Maximize(sum(objective_terms))
        
        # Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 10.0  # Time limit for academic use
        status = solver.Solve(model)
        
        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            # Extract team assignments
            teams = [[] for _ in range(num_teams)]
            for i in range(num_students):
                for t in range(num_teams):
                    if solver.Value(x[i, t]) == 1:
                        teams[t].append(profiles[i].id)
                        break
            
            # Filter out empty teams
            teams = [team for team in teams if len(team) > 0]
            return teams
        else:
            # Strict: do not fallback to greedy/similarity ranking. If CP-SAT cannot find a solution,
            # return an empty assignment to avoid violating the "optimization selects final team" rule.
            return []
    
    def _greedy_team_formation(self, profiles, project, similarity_scores, constraints):
        """
        Fallback greedy team formation algorithm
        """
        min_size = constraints.get('min_team_size', project.min_team_size if hasattr(project, 'min_team_size') else 3)
        max_size = constraints.get('max_team_size', project.max_team_size if hasattr(project, 'max_team_size') else 5)
        preferred_size = constraints.get('preferred_team_size', project.preferred_team_size if hasattr(project, 'preferred_team_size') else 4)
        
        # Sort profiles by similarity (descending)
        sorted_profiles = sorted(
            profiles,
            key=lambda p: similarity_scores.get(p.id, 0.5),
            reverse=True
        )
        
        # Extract skills for diversity checking
        from services.nlp_service import get_nlp_service
        nlp = get_nlp_service()
        profile_skills = {}
        for profile in sorted_profiles:
            profile_skills[profile.id] = set(nlp.extract_keywords(profile.skills_description or '', top_n=10))
        
        teams = []
        current_team = []
        current_team_skills = set()
        
        for profile in sorted_profiles:
            profile_id = profile.id
            skills = profile_skills[profile_id]
            
            # Check skill diversity: avoid putting students with >80% skill overlap together
            if current_team and len(current_team) >= min_size:
                # Check overlap with existing team members
                max_overlap = 0
                for member_id in current_team:
                    member_skills = profile_skills.get(member_id, set())
                    if len(member_skills) > 0 and len(skills) > 0:
                        overlap = len(member_skills & skills) / len(member_skills | skills)
                        max_overlap = max(max_overlap, overlap)
                
                # If overlap is too high (>80%), start new team for diversity
                if max_overlap > 0.8:
                    teams.append(current_team)
                    current_team = [profile_id]
                    current_team_skills = skills
                    continue
            
            if len(current_team) < preferred_size:
                current_team.append(profile_id)
                current_team_skills.update(skills)
            else:
                teams.append(current_team)
                current_team = [profile_id]
                current_team_skills = skills
        
        if current_team:
            # Merge small teams or add to existing
            if len(teams) > 0 and len(current_team) < min_size:
                # Try to merge with last team if possible
                if len(teams[-1]) + len(current_team) <= max_size:
                    teams[-1].extend(current_team)
                else:
                    teams.append(current_team)
            else:
                teams.append(current_team)
        
        return teams
    
    def compute_team_diversity_score(self, team_profile_ids, profiles_dict):
        """
        Compute diversity score for a team based on skills/background
        
        Args:
            team_profile_ids: List of profile IDs in team
            profiles_dict: Dict mapping profile_id -> profile object
            
        Returns:
            float: Diversity score (0-1)
        """
        if len(team_profile_ids) < 2:
            return 0.0
        
        # Extract skills from each profile
        all_skills = []
        for profile_id in team_profile_ids:
            profile = profiles_dict.get(profile_id)
            if profile and profile.skills_description:
                # Simple keyword extraction
                skills = [s.strip() for s in profile.skills_description.lower().split(',')]
                all_skills.append(set(skills))
        
        # Compute Jaccard similarity between all pairs
        similarities = []
        for i in range(len(all_skills)):
            for j in range(i + 1, len(all_skills)):
                intersection = len(all_skills[i] & all_skills[j])
                union = len(all_skills[i] | all_skills[j])
                if union > 0:
                    jaccard = intersection / union
                    similarities.append(jaccard)
        
        if not similarities:
            return 1.0  # Maximum diversity if no overlap
        
        # Diversity = 1 - average similarity
        avg_similarity = sum(similarities) / len(similarities)
        diversity = 1.0 - avg_similarity
        
        return diversity
