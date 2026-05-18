"""
TaskCoordinator - Task assignment algorithms and workload coordination.

This module provides comprehensive task coordination including intelligent task
assignment algorithms, workload balancing across team members, skill-based task
routing, dependency management, and progress tracking.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Callable
from collections import defaultdict

from pydantic import BaseModel, Field, ConfigDict
from ...core.utils import uuid7str

logger = logging.getLogger(__name__)

class AssignmentStrategy(str, Enum):
	"""Task assignment strategies."""
	ROUND_ROBIN = "round_robin"
	SKILL_BASED = "skill_based"
	WORKLOAD_BALANCED = "workload_balanced"
	DEADLINE_DRIVEN = "deadline_driven"
	EXPERTISE_MAXIMIZED = "expertise_maximized"
	COLLABORATION_OPTIMIZED = "collaboration_optimized"
	COST_MINIMIZED = "cost_minimized"
	QUALITY_FOCUSED = "quality_focused"

class TaskComplexity(str, Enum):
	"""Task complexity levels."""
	TRIVIAL = "trivial"
	SIMPLE = "simple"
	MODERATE = "moderate"
	COMPLEX = "complex"
	EXPERT = "expert"

class CollaborationType(str, Enum):
	"""Types of collaboration required."""
	INDIVIDUAL = "individual"
	PAIR = "pair"
	TEAM = "team"
	CROSS_FUNCTIONAL = "cross_functional"
	REVIEW_REQUIRED = "review_required"
	MENTORSHIP = "mentorship"

class TaskAssignment(BaseModel):
	"""A task assignment to team members."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	assignment_id: str = Field(default_factory=uuid7str)
	task_id: str = Field(description="Task being assigned")
	workflow_instance_id: str = Field(description="Parent workflow instance")
	
	# Assignment details
	assigned_to: List[str] = Field(description="User IDs assigned to task")
	primary_assignee: str = Field(description="Primary responsible user")
	secondary_assignees: List[str] = Field(default_factory=list, description="Supporting users")
	
	# Assignment rationale
	assignment_strategy: AssignmentStrategy = Field(description="Strategy used for assignment")
	assignment_reason: str = Field(description="Explanation for assignment decision")
	confidence_score: float = Field(description="Confidence in assignment quality (0-1)")
	
	# Task characteristics
	required_skills: Dict[str, float] = Field(default_factory=dict, description="Skill -> proficiency level")
	estimated_effort_hours: float = Field(description="Estimated effort required")
	complexity_level: TaskComplexity = Field(description="Task complexity")
	collaboration_type: CollaborationType = Field(description="Type of collaboration needed")
	
	# Timing and constraints
	created_at: datetime = Field(default_factory=datetime.now)
	assigned_at: Optional[datetime] = None
	accepted_at: Optional[datetime] = None
	started_at: Optional[datetime] = None
	due_date: Optional[datetime] = None
	
	# Progress tracking
	progress_percentage: float = Field(0.0, description="Completion percentage")
	quality_score: Optional[float] = None
	blockers: List[str] = Field(default_factory=list, description="Current blockers")
	
	# Coordination data
	dependencies: List[str] = Field(default_factory=list, description="Task IDs this depends on")
	dependents: List[str] = Field(default_factory=list, description="Task IDs that depend on this")
	coordination_notes: List[str] = Field(default_factory=list, description="Coordination notes")

class TeamMember(BaseModel):
	"""Team member profile for task assignment."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	user_id: str = Field(description="Unique user identifier")
	name: str = Field(description="User display name")
	email: str = Field(description="User email address")
	
	# Skills and capabilities
	skills: Dict[str, float] = Field(default_factory=dict, description="Skill -> proficiency (0-1)")
	specializations: List[str] = Field(default_factory=list, description="Areas of specialization")
	certifications: List[str] = Field(default_factory=list, description="Professional certifications")
	experience_years: float = Field(description="Years of relevant experience")
	
	# Availability and capacity
	availability_hours_per_day: float = Field(8.0, description="Available hours per day")
	current_workload_hours: float = Field(0.0, description="Current committed hours")
	max_concurrent_tasks: int = Field(5, description="Maximum concurrent tasks")
	current_task_count: int = Field(0, description="Current number of tasks")
	
	# Performance metrics
	average_task_completion_time: float = Field(description="Average hours to complete tasks")
	quality_rating: float = Field(description="Quality rating (0-1)")
	collaboration_rating: float = Field(description="Collaboration effectiveness (0-1)")
	reliability_score: float = Field(description="Reliability score (0-1)")
	
	# Preferences and constraints
	preferred_task_types: List[str] = Field(default_factory=list)
	timezone: str = Field("UTC", description="User timezone")
	working_hours_start: int = Field(9, description="Working hours start (24h format)")
	working_hours_end: int = Field(17, description="Working hours end (24h format)")
	unavailable_dates: List[datetime] = Field(default_factory=list)
	
	# Learning and development
	learning_goals: List[str] = Field(default_factory=list)
	mentorship_capacity: bool = Field(False, description="Can mentor others")
	seeks_mentorship: bool = Field(False, description="Seeks mentorship")

class WorkloadBalance(BaseModel):
	"""Workload balance analysis for team members."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	user_id: str = Field(description="User identifier")
	
	# Current workload
	current_hours: float = Field(description="Current committed hours")
	available_hours: float = Field(description="Available hours per day")
	utilization_percentage: float = Field(description="Current utilization percentage")
	
	# Task distribution
	current_tasks: int = Field(description="Number of current tasks")
	max_tasks: int = Field(description="Maximum concurrent tasks")
	task_complexity_distribution: Dict[TaskComplexity, int] = Field(default_factory=dict)
	
	# Balance metrics
	workload_score: float = Field(description="Workload balance score (0-1, 1=perfectly balanced)")
	stress_level: float = Field(description="Estimated stress level (0-1)")
	burnout_risk: float = Field(description="Risk of burnout (0-1)")
	
	# Recommendations
	recommended_assignments: int = Field(description="Recommended number of new assignments")
	workload_adjustment_needed: bool = Field(description="Whether workload adjustment is needed")
	suggested_actions: List[str] = Field(default_factory=list)

@dataclass
class SkillGap:
	"""Identified skill gap for a task."""
	skill_name: str
	required_level: float
	available_level: float
	gap_severity: float
	suggested_training: Optional[str] = None
	alternative_assignees: List[str] = field(default_factory=list)

@dataclass
class CoordinationMetrics:
	"""Metrics for task coordination effectiveness."""
	total_assignments: int = 0
	successful_assignments: int = 0
	assignment_accuracy: float = 0.0
	average_assignment_time_seconds: float = 0.0
	workload_balance_score: float = 0.0
	skill_utilization_efficiency: float = 0.0
	collaboration_effectiveness: float = 0.0
	deadline_adherence_rate: float = 0.0

class TaskCoordinator:
	"""
	Comprehensive task coordination and assignment system.
	
	Provides intelligent task assignment algorithms, workload balancing
	across team members, skill-based task routing, dependency management,
	and progress tracking.
	"""
	
	def __init__(
		self,
		default_strategy: AssignmentStrategy = AssignmentStrategy.SKILL_BASED,
		enable_workload_balancing: bool = True,
		max_assignment_attempts: int = 3
	):
		"""
		Initialize the task coordinator.
		
		Args:
			default_strategy: Default assignment strategy
			enable_workload_balancing: Enable automatic workload balancing
			max_assignment_attempts: Maximum attempts to find suitable assignment
		"""
		self.default_strategy = default_strategy
		self.enable_workload_balancing = enable_workload_balancing
		self.max_assignment_attempts = max_assignment_attempts
		
		# Team and task data
		self.team_members: Dict[str, TeamMember] = {}
		self.active_assignments: Dict[str, TaskAssignment] = {}
		self.completed_assignments: Dict[str, TaskAssignment] = {}
		self.assignment_history: List[Dict[str, Any]] = []
		
		# Skills and expertise mapping
		self.skill_registry: Dict[str, List[Tuple[str, float]]] = defaultdict(list)  # skill -> [(user_id, proficiency)]
		self.expertise_network: Dict[str, Set[str]] = defaultdict(set)  # user_id -> collaborators
		
		# Workload tracking
		self.workload_snapshots: List[Dict[str, WorkloadBalance]] = []
		self.coordination_metrics = CoordinationMetrics()
		
		# Event handling
		self.coordination_subscribers: List[Callable] = []
		
		# Background tasks
		self.balancing_task: Optional[asyncio.Task] = None
		self.metrics_task: Optional[asyncio.Task] = None
		
		# Synchronization
		self._lock = asyncio.Lock()
		self._coordinator_running = False
		
		logger.info(f"TaskCoordinator initialized with strategy={default_strategy.value}")
	
	async def start_coordinator(self):
		"""Start the task coordinator."""
		async with self._lock:
			if self._coordinator_running:
				logger.warning("TaskCoordinator is already running")
				return
			
			self._coordinator_running = True
			
			# Start background tasks
			if self.enable_workload_balancing:
				self.balancing_task = asyncio.create_task(self._workload_balancing_loop())
			
			self.metrics_task = asyncio.create_task(self._metrics_update_loop())
			
			logger.info("TaskCoordinator started successfully")
	
	async def stop_coordinator(self):
		"""Stop the task coordinator."""
		async with self._lock:
			if not self._coordinator_running:
				return
			
			self._coordinator_running = False
			
			# Cancel background tasks
			if self.balancing_task:
				self.balancing_task.cancel()
				try:
					await self.balancing_task
				except asyncio.CancelledError:
					pass
			
			if self.metrics_task:
				self.metrics_task.cancel()
				try:
					await self.metrics_task
				except asyncio.CancelledError:
					pass
			
			logger.info("TaskCoordinator stopped successfully")
	
	async def add_team_member(self, member: TeamMember):
		"""
		Add a team member to the coordination system.
		
		Args:
			member: Team member to add
		"""
		async with self._lock:
			self.team_members[member.user_id] = member
			
			# Update skill registry
			for skill, proficiency in member.skills.items():
				self.skill_registry[skill].append((member.user_id, proficiency))
				# Sort by proficiency (highest first)
				self.skill_registry[skill].sort(key=lambda x: x[1], reverse=True)
			
			logger.info(f"Added team member {member.name} ({member.user_id}) with {len(member.skills)} skills")
	
	async def remove_team_member(self, user_id: str):
		"""
		Remove a team member from the coordination system.
		
		Args:
			user_id: User ID to remove
		"""
		async with self._lock:
			if user_id not in self.team_members:
				return
			
			member = self.team_members.pop(user_id)
			
			# Update skill registry
			for skill in member.skills:
				self.skill_registry[skill] = [
					(uid, prof) for uid, prof in self.skill_registry[skill]
					if uid != user_id
				]
			
			# Reassign active tasks
			tasks_to_reassign = [
				assignment for assignment in self.active_assignments.values()
				if user_id in assignment.assigned_to
			]
			
			for assignment in tasks_to_reassign:
				await self._handle_member_removal(assignment, user_id)
			
			logger.info(f"Removed team member {member.name} ({user_id})")
	
	async def assign_task(
		self,
		task_id: str,
		workflow_instance_id: str,
		required_skills: Dict[str, float],
		estimated_effort_hours: float,
		complexity_level: TaskComplexity,
		collaboration_type: CollaborationType,
		due_date: Optional[datetime] = None,
		strategy: Optional[AssignmentStrategy] = None,
		constraints: Optional[Dict[str, Any]] = None
	) -> Optional[TaskAssignment]:
		"""
		Assign a task to team members.
		
		Args:
			task_id: Unique task identifier
			workflow_instance_id: Parent workflow instance
			required_skills: Required skills and proficiency levels
			estimated_effort_hours: Estimated effort in hours
			complexity_level: Task complexity level
			collaboration_type: Type of collaboration needed
			due_date: Task deadline
			strategy: Assignment strategy to use
			constraints: Additional assignment constraints
		
		Returns:
			Optional[TaskAssignment]: Created assignment if successful
		"""
		async with self._lock:
			start_time = datetime.now()
			
			# Use provided strategy or default
			assignment_strategy = strategy or self.default_strategy
			
			# Find suitable assignees
			assignment_candidates = await self._find_assignment_candidates(
				required_skills=required_skills,
				estimated_effort_hours=estimated_effort_hours,
				complexity_level=complexity_level,
				collaboration_type=collaboration_type,
				due_date=due_date,
				strategy=assignment_strategy,
				constraints=constraints or {}
			)
			
			if not assignment_candidates:
				logger.warning(f"No suitable candidates found for task {task_id}")
				return None
			
			# Select best assignment
			best_assignment = await self._select_best_assignment(
				assignment_candidates,
				assignment_strategy,
				required_skills,
				estimated_effort_hours,
				complexity_level
			)
			
			if not best_assignment:
				logger.error(f"Failed to select assignment for task {task_id}")
				return None
			
			# Create task assignment
			assignment = TaskAssignment(
				task_id=task_id,
				workflow_instance_id=workflow_instance_id,
				assigned_to=best_assignment['assigned_to'],
				primary_assignee=best_assignment['primary_assignee'],
				secondary_assignees=best_assignment.get('secondary_assignees', []),
				assignment_strategy=assignment_strategy,
				assignment_reason=best_assignment['reason'],
				confidence_score=best_assignment['confidence'],
				required_skills=required_skills,
				estimated_effort_hours=estimated_effort_hours,
				complexity_level=complexity_level,
				collaboration_type=collaboration_type,
				assigned_at=datetime.now(),
				due_date=due_date
			)
			
			# Store assignment
			self.active_assignments[assignment.assignment_id] = assignment
			
			# Update member workloads
			await self._update_member_workloads(assignment, add=True)
			
			# Record assignment
			assignment_time_ms = (datetime.now() - start_time).total_seconds() * 1000
			await self._record_assignment_event(assignment, assignment_time_ms)
			
			# Update metrics
			self.coordination_metrics.total_assignments += 1
			self.coordination_metrics.average_assignment_time_seconds = (
				(self.coordination_metrics.average_assignment_time_seconds * 
				 (self.coordination_metrics.total_assignments - 1) + assignment_time_ms / 1000) /
				self.coordination_metrics.total_assignments
			)
			
			logger.info(f"Assigned task {task_id} to {assignment.primary_assignee} (confidence: {assignment.confidence_score:.2f})")
			
			# Notify subscribers
			await self._notify_coordination_event("task_assigned", assignment)
			
			return assignment
	
	async def reassign_task(
		self,
		assignment_id: str,
		reason: str,
		new_strategy: Optional[AssignmentStrategy] = None,
		constraints: Optional[Dict[str, Any]] = None
	) -> Optional[TaskAssignment]:
		"""
		Reassign a task to different team members.
		
		Args:
			assignment_id: Assignment to reassign
			reason: Reason for reassignment
			new_strategy: New assignment strategy
			constraints: Additional constraints
		
		Returns:
			Optional[TaskAssignment]: New assignment if successful
		"""
		async with self._lock:
			if assignment_id not in self.active_assignments:
				logger.error(f"Assignment {assignment_id} not found for reassignment")
				return None
			
			old_assignment = self.active_assignments[assignment_id]
			
			# Remove old assignment
			await self._update_member_workloads(old_assignment, add=False)
			del self.active_assignments[assignment_id]
			
			# Create new assignment
			new_assignment = await self.assign_task(
				task_id=old_assignment.task_id,
				workflow_instance_id=old_assignment.workflow_instance_id,
				required_skills=old_assignment.required_skills,
				estimated_effort_hours=old_assignment.estimated_effort_hours,
				complexity_level=old_assignment.complexity_level,
				collaboration_type=old_assignment.collaboration_type,
				due_date=old_assignment.due_date,
				strategy=new_strategy,
				constraints=constraints
			)
			
			if new_assignment:
				logger.info(f"Reassigned task {old_assignment.task_id} from {old_assignment.primary_assignee} to {new_assignment.primary_assignee}: {reason}")
				
				# Notify subscribers
				await self._notify_coordination_event("task_reassigned", new_assignment, {
					"previous_assignee": old_assignment.primary_assignee,
					"reason": reason
				})
			
			return new_assignment
	
	async def complete_assignment(
		self,
		assignment_id: str,
		quality_score: Optional[float] = None,
		completion_notes: Optional[str] = None
	) -> bool:
		"""
		Mark an assignment as completed.
		
		Args:
			assignment_id: Assignment to complete
			quality_score: Quality score (0-1)
			completion_notes: Optional completion notes
		
		Returns:
			bool: True if completed successfully
		"""
		async with self._lock:
			if assignment_id not in self.active_assignments:
				return False
			
			assignment = self.active_assignments.pop(assignment_id)
			
			# Update assignment
			assignment.progress_percentage = 100.0
			assignment.quality_score = quality_score
			if completion_notes:
				assignment.coordination_notes.append(f"Completed: {completion_notes}")
			
			# Store in completed assignments
			self.completed_assignments[assignment_id] = assignment
			
			# Update member workloads
			await self._update_member_workloads(assignment, add=False)
			
			# Update metrics
			self.coordination_metrics.successful_assignments += 1
			self.coordination_metrics.assignment_accuracy = (
				self.coordination_metrics.successful_assignments / 
				max(self.coordination_metrics.total_assignments, 1) * 100.0
			)
			
			logger.info(f"Completed assignment {assignment_id} for task {assignment.task_id}")
			
			# Notify subscribers
			await self._notify_coordination_event("assignment_completed", assignment, {
				"quality_score": quality_score
			})
			
			return True
	
	async def update_assignment_progress(
		self,
		assignment_id: str,
		progress_percentage: float,
		blockers: Optional[List[str]] = None,
		notes: Optional[str] = None
	) -> bool:
		"""
		Update assignment progress.
		
		Args:
			assignment_id: Assignment to update
			progress_percentage: Current progress (0-100)
			blockers: Current blockers
			notes: Progress notes
		
		Returns:
			bool: True if updated successfully
		"""
		async with self._lock:
			if assignment_id not in self.active_assignments:
				return False
			
			assignment = self.active_assignments[assignment_id]
			
			# Update progress
			assignment.progress_percentage = max(0.0, min(100.0, progress_percentage))
			
			if blockers is not None:
				assignment.blockers = blockers
			
			if notes:
				assignment.coordination_notes.append(f"Progress update: {notes}")
			
			logger.debug(f"Updated assignment {assignment_id} progress to {progress_percentage}%")
			
			# Notify subscribers
			await self._notify_coordination_event("progress_updated", assignment, {
				"progress_percentage": progress_percentage,
				"blockers": blockers
			})
			
			return True
	
	async def get_workload_balance(self, user_id: Optional[str] = None) -> Dict[str, WorkloadBalance]:
		"""
		Get workload balance analysis.
		
		Args:
			user_id: Specific user ID, or None for all users
		
		Returns:
			Dict[str, WorkloadBalance]: User ID -> workload balance
		"""
		workload_balances = {}
		
		user_ids = [user_id] if user_id else list(self.team_members.keys())
		
		for uid in user_ids:
			if uid not in self.team_members:
				continue
			
			member = self.team_members[uid]
			workload_balance = await self._calculate_workload_balance(member)
			workload_balances[uid] = workload_balance
		
		return workload_balances
	
	async def identify_skill_gaps(
		self,
		required_skills: Dict[str, float]
	) -> List[SkillGap]:
		"""
		Identify skill gaps in the team for required skills.
		
		Args:
			required_skills: Required skills and proficiency levels
		
		Returns:
			List[SkillGap]: Identified skill gaps
		"""
		skill_gaps = []
		
		for skill, required_level in required_skills.items():
			# Find team members with this skill
			available_members = self.skill_registry.get(skill, [])
			
			if not available_members:
				# Complete skill gap
				skill_gaps.append(SkillGap(
					skill_name=skill,
					required_level=required_level,
					available_level=0.0,
					gap_severity=1.0,
					suggested_training=f"Training required for {skill}",
					alternative_assignees=[]
				))
			else:
				# Check if any member meets the requirement
				best_available_level = max(proficiency for _, proficiency in available_members)
				
				if best_available_level < required_level:
					# Partial skill gap
					gap_severity = (required_level - best_available_level) / required_level
					
					# Find alternative assignees (members with highest skill level)
					alternatives = [
						user_id for user_id, proficiency in available_members
						if proficiency == best_available_level
					]
					
					skill_gaps.append(SkillGap(
						skill_name=skill,
						required_level=required_level,
						available_level=best_available_level,
						gap_severity=gap_severity,
						suggested_training=f"Skill development needed for {skill}",
						alternative_assignees=alternatives[:3]  # Top 3 alternatives
					))
		
		return skill_gaps
	
	async def get_coordination_metrics(self) -> Dict[str, Any]:
		"""
		Get comprehensive coordination metrics.
		
		Returns:
			Dict[str, Any]: Coordination metrics and statistics
		"""
		# Calculate current workload balance
		workload_balances = await self.get_workload_balance()
		workload_scores = [wb.workload_score for wb in workload_balances.values()]
		avg_workload_balance = sum(workload_scores) / len(workload_scores) if workload_scores else 0.0
		
		# Calculate skill utilization
		skill_utilization = await self._calculate_skill_utilization()
		
		# Calculate collaboration effectiveness
		collaboration_effectiveness = await self._calculate_collaboration_effectiveness()
		
		return {
			"total_assignments": self.coordination_metrics.total_assignments,
			"successful_assignments": self.coordination_metrics.successful_assignments,
			"assignment_accuracy": self.coordination_metrics.assignment_accuracy,
			"average_assignment_time_seconds": self.coordination_metrics.average_assignment_time_seconds,
			"active_assignments": len(self.active_assignments),
			"completed_assignments": len(self.completed_assignments),
			"team_size": len(self.team_members),
			"workload_balance_score": avg_workload_balance,
			"skill_utilization_efficiency": skill_utilization,
			"collaboration_effectiveness": collaboration_effectiveness,
			"deadline_adherence_rate": self.coordination_metrics.deadline_adherence_rate
		}
	
	async def subscribe_to_coordination_events(self, callback: Callable) -> str:
		"""
		Subscribe to coordination events.
		
		Args:
			callback: Callback function for coordination events
		
		Returns:
			str: Subscription ID
		"""
		self.coordination_subscribers.append(callback)
		subscription_id = uuid7str()
		logger.info("New coordination event subscription added")
		return subscription_id
	
	# Private helper methods
	
	async def _find_assignment_candidates(
		self,
		required_skills: Dict[str, float],
		estimated_effort_hours: float,
		complexity_level: TaskComplexity,
		collaboration_type: CollaborationType,
		due_date: Optional[datetime],
		strategy: AssignmentStrategy,
		constraints: Dict[str, Any]
	) -> List[Dict[str, Any]]:
		"""Find potential assignment candidates."""
		candidates = []
		
		# Get all team members as potential candidates
		for member in self.team_members.values():
			candidate_score = await self._evaluate_assignment_candidate(
				member=member,
				required_skills=required_skills,
				estimated_effort_hours=estimated_effort_hours,
				complexity_level=complexity_level,
				collaboration_type=collaboration_type,
				due_date=due_date,
				strategy=strategy,
				constraints=constraints
			)
			
			if candidate_score['eligible']:
				candidates.append({
					'member': member,
					'score': candidate_score['score'],
					'details': candidate_score,
					'assignment_type': 'primary'
				})
		
		# Sort by score (highest first)
		candidates.sort(key=lambda x: x['score'], reverse=True)
		
		# Generate different assignment combinations based on collaboration type
		assignment_candidates = []
		
		if collaboration_type == CollaborationType.INDIVIDUAL:
			# Single assignee
			for candidate in candidates[:5]:  # Top 5 candidates
				assignment_candidates.append({
					'assigned_to': [candidate['member'].user_id],
					'primary_assignee': candidate['member'].user_id,
					'secondary_assignees': [],
					'total_score': candidate['score'],
					'assignment_details': [candidate['details']]
				})
		
		elif collaboration_type == CollaborationType.PAIR:
			# Pair assignments
			for i, primary in enumerate(candidates[:3]):
				for secondary in candidates[i+1:i+4]:
					pair_score = (primary['score'] + secondary['score']) / 2
					# Add collaboration bonus
					collaboration_bonus = await self._calculate_collaboration_bonus(
						[primary['member'], secondary['member']]
					)
					pair_score += collaboration_bonus
					
					assignment_candidates.append({
						'assigned_to': [primary['member'].user_id, secondary['member'].user_id],
						'primary_assignee': primary['member'].user_id,
						'secondary_assignees': [secondary['member'].user_id],
						'total_score': pair_score,
						'assignment_details': [primary['details'], secondary['details']]
					})
		
		elif collaboration_type == CollaborationType.TEAM:
			# Team assignments (3-4 members)
			if len(candidates) >= 3:
				# Best team of 3
				team_members = candidates[:3]
				team_score = sum(c['score'] for c in team_members) / 3
				collaboration_bonus = await self._calculate_collaboration_bonus(
					[c['member'] for c in team_members]
				)
				team_score += collaboration_bonus
				
				assignment_candidates.append({
					'assigned_to': [c['member'].user_id for c in team_members],
					'primary_assignee': team_members[0]['member'].user_id,
					'secondary_assignees': [c['member'].user_id for c in team_members[1:]],
					'total_score': team_score,
					'assignment_details': [c['details'] for c in team_members]
				})
		
		return assignment_candidates
	
	async def _evaluate_assignment_candidate(
		self,
		member: TeamMember,
		required_skills: Dict[str, float],
		estimated_effort_hours: float,
		complexity_level: TaskComplexity,
		collaboration_type: CollaborationType,
		due_date: Optional[datetime],
		strategy: AssignmentStrategy,
		constraints: Dict[str, Any]
	) -> Dict[str, Any]:
		"""Evaluate a team member as assignment candidate."""
		# Check basic eligibility
		if not await self._check_member_availability(member, estimated_effort_hours, due_date):
			return {'eligible': False, 'score': 0.0, 'reason': 'Not available'}
		
		score = 0.0
		score_details = {}
		
		# Skill matching
		skill_score, skill_details = await self._calculate_skill_match_score(member, required_skills)
		score += skill_score * 0.4  # 40% weight
		score_details['skill_match'] = skill_details
		
		# Experience and complexity matching
		experience_score = await self._calculate_experience_score(member, complexity_level)
		score += experience_score * 0.2  # 20% weight
		score_details['experience_match'] = experience_score
		
		# Workload and availability
		workload_score = await self._calculate_workload_score(member, estimated_effort_hours)
		score += workload_score * 0.2  # 20% weight
		score_details['workload_suitability'] = workload_score
		
		# Quality and reliability
		quality_score = (member.quality_rating + member.reliability_score) / 2
		score += quality_score * 0.1  # 10% weight
		score_details['quality_reliability'] = quality_score
		
		# Collaboration fit
		collaboration_score = await self._calculate_collaboration_fit_score(member, collaboration_type)
		score += collaboration_score * 0.1  # 10% weight
		score_details['collaboration_fit'] = collaboration_score
		
		return {
			'eligible': True,
			'score': score,
			'details': score_details,
			'member_id': member.user_id
		}
	
	async def _check_member_availability(
		self,
		member: TeamMember,
		estimated_effort_hours: float,
		due_date: Optional[datetime]
	) -> bool:
		"""Check if member is available for assignment."""
		# Check current workload
		if member.current_workload_hours + estimated_effort_hours > member.availability_hours_per_day * 7:
			return False
		
		# Check concurrent task limit
		if member.current_task_count >= member.max_concurrent_tasks:
			return False
		
		# Check unavailable dates
		if due_date:
			for unavailable_date in member.unavailable_dates:
				if abs((due_date - unavailable_date).days) <= 1:
					return False
		
		return True
	
	async def _calculate_skill_match_score(
		self,
		member: TeamMember,
		required_skills: Dict[str, float]
	) -> Tuple[float, Dict[str, float]]:
		"""Calculate how well member's skills match requirements."""
		if not required_skills:
			return 1.0, {}
		
		skill_scores = {}
		total_match = 0.0
		
		for skill, required_level in required_skills.items():
			member_level = member.skills.get(skill, 0.0)
			
			if member_level >= required_level:
				# Exceeds requirement - bonus for higher skill
				skill_match = 1.0 + min((member_level - required_level) * 0.2, 0.2)
			else:
				# Below requirement - penalty
				skill_match = member_level / required_level if required_level > 0 else 0.0
			
			skill_scores[skill] = skill_match
			total_match += skill_match
		
		average_match = total_match / len(required_skills)
		return average_match, skill_scores
	
	async def _calculate_experience_score(self, member: TeamMember, complexity_level: TaskComplexity) -> float:
		"""Calculate experience suitability for task complexity."""
		complexity_requirements = {
			TaskComplexity.TRIVIAL: 0.5,
			TaskComplexity.SIMPLE: 1.0,
			TaskComplexity.MODERATE: 2.0,
			TaskComplexity.COMPLEX: 4.0,
			TaskComplexity.EXPERT: 6.0
		}
		
		required_experience = complexity_requirements[complexity_level]
		
		if member.experience_years >= required_experience:
			# Good match or overqualified
			return min(1.0, member.experience_years / required_experience * 0.8)
		else:
			# Underqualified
			return member.experience_years / required_experience
	
	async def _calculate_workload_score(self, member: TeamMember, estimated_effort_hours: float) -> float:
		"""Calculate workload suitability score."""
		# Calculate utilization after adding this task
		new_workload = member.current_workload_hours + estimated_effort_hours
		max_workload = member.availability_hours_per_day * 5  # 5 days per week
		
		if max_workload <= 0:
			return 0.0
		
		utilization = new_workload / max_workload
		
		# Optimal utilization is around 70-80%
		if 0.7 <= utilization <= 0.8:
			return 1.0
		elif utilization < 0.7:
			return 0.8 + (utilization - 0.5) * 0.4  # Gentle penalty for underutilization
		else:
			return max(0.1, 1.0 - (utilization - 0.8) * 2)  # Heavy penalty for overutilization
	
	async def _calculate_collaboration_fit_score(self, member: TeamMember, collaboration_type: CollaborationType) -> float:
		"""Calculate collaboration fit score."""
		base_score = member.collaboration_rating
		
		if collaboration_type == CollaborationType.INDIVIDUAL:
			return base_score
		elif collaboration_type == CollaborationType.MENTORSHIP:
			return base_score + (0.3 if member.mentorship_capacity else -0.2)
		else:
			return base_score + 0.1  # Small bonus for collaborative tasks
	
	async def _calculate_collaboration_bonus(self, members: List[TeamMember]) -> float:
		"""Calculate collaboration bonus for team assignments."""
		if len(members) < 2:
			return 0.0
		
		# Check previous collaboration history
		collaboration_bonus = 0.0
		
		for i, member_a in enumerate(members):
			for member_b in members[i+1:]:
				if member_b.user_id in self.expertise_network[member_a.user_id]:
					collaboration_bonus += 0.1  # Bonus for previous collaboration
		
		# Skill complementarity bonus
		all_skills = set()
		for member in members:
			all_skills.update(member.skills.keys())
		
		skill_coverage = len(all_skills) / max(len(members) * 5, 1)  # Assume 5 avg skills per person
		collaboration_bonus += min(skill_coverage * 0.2, 0.3)
		
		return collaboration_bonus
	
	async def _select_best_assignment(
		self,
		candidates: List[Dict[str, Any]],
		strategy: AssignmentStrategy,
		required_skills: Dict[str, float],
		estimated_effort_hours: float,
		complexity_level: TaskComplexity
	) -> Optional[Dict[str, Any]]:
		"""Select the best assignment from candidates."""
		if not candidates:
			return None
		
		# Apply strategy-specific selection logic
		if strategy == AssignmentStrategy.SKILL_BASED:
			# Choose candidate with highest skill match
			best_candidate = max(candidates, key=lambda x: x['total_score'])
		
		elif strategy == AssignmentStrategy.WORKLOAD_BALANCED:
			# Choose candidate that best balances workload
			workload_scores = []
			for candidate in candidates:
				member_ids = candidate['assigned_to']
				workload_balance = 0.0
				for member_id in member_ids:
					member = self.team_members[member_id]
					workload_balance += await self._calculate_workload_score(member, estimated_effort_hours / len(member_ids))
				workload_balance /= len(member_ids)
				workload_scores.append((candidate, workload_balance))
			
			best_candidate = max(workload_scores, key=lambda x: x[1])[0]
		
		elif strategy == AssignmentStrategy.DEADLINE_DRIVEN:
			# Choose candidate most likely to meet deadline
			# For now, use total score as proxy
			best_candidate = max(candidates, key=lambda x: x['total_score'])
		
		else:
			# Default to highest scoring candidate
			best_candidate = max(candidates, key=lambda x: x['total_score'])
		
		# Add assignment details
		confidence = min(best_candidate['total_score'], 1.0)
		reason = f"Selected using {strategy.value} strategy with confidence {confidence:.2f}"
		
		return {
			'assigned_to': best_candidate['assigned_to'],
			'primary_assignee': best_candidate['primary_assignee'],
			'secondary_assignees': best_candidate.get('secondary_assignees', []),
			'confidence': confidence,
			'reason': reason,
			'score_details': best_candidate['assignment_details']
		}
	
	async def _update_member_workloads(self, assignment: TaskAssignment, add: bool):
		"""Update member workload tracking."""
		effort_per_member = assignment.estimated_effort_hours / len(assignment.assigned_to)
		
		for user_id in assignment.assigned_to:
			if user_id in self.team_members:
				member = self.team_members[user_id]
				
				if add:
					member.current_workload_hours += effort_per_member
					member.current_task_count += 1
				else:
					member.current_workload_hours = max(0, member.current_workload_hours - effort_per_member)
					member.current_task_count = max(0, member.current_task_count - 1)
	
	async def _calculate_workload_balance(self, member: TeamMember) -> WorkloadBalance:
		"""Calculate workload balance for a team member."""
		utilization = 0.0
		if member.availability_hours_per_day > 0:
			daily_workload = member.current_workload_hours / 5  # Assume 5-day work week
			utilization = (daily_workload / member.availability_hours_per_day) * 100.0
		
		# Calculate task complexity distribution
		complexity_distribution = defaultdict(int)
		for assignment in self.active_assignments.values():
			if member.user_id in assignment.assigned_to:
				complexity_distribution[assignment.complexity_level] += 1
		
		# Calculate workload score (0-1, with 1 being perfectly balanced)
		optimal_utilization = 75.0  # 75% utilization is considered optimal
		workload_score = max(0.0, 1.0 - abs(utilization - optimal_utilization) / optimal_utilization)
		
		# Calculate stress level based on utilization and task count
		stress_level = min(1.0, (utilization / 100.0) * 0.7 + (member.current_task_count / member.max_concurrent_tasks) * 0.3)
		
		# Calculate burnout risk
		burnout_risk = min(1.0, max(0.0, (utilization - 80.0) / 20.0))
		
		# Recommendations
		recommended_assignments = 0
		if utilization < 60:
			recommended_assignments = max(1, int((optimal_utilization - utilization) / 15))
		
		suggested_actions = []
		if utilization > 90:
			suggested_actions.append("Reduce workload - risk of burnout")
		elif utilization < 50:
			suggested_actions.append("Can take on more assignments")
		
		if member.current_task_count > member.max_concurrent_tasks * 0.8:
			suggested_actions.append("Consider task consolidation")
		
		return WorkloadBalance(
			user_id=member.user_id,
			current_hours=member.current_workload_hours,
			available_hours=member.availability_hours_per_day,
			utilization_percentage=utilization,
			current_tasks=member.current_task_count,
			max_tasks=member.max_concurrent_tasks,
			task_complexity_distribution=dict(complexity_distribution),
			workload_score=workload_score,
			stress_level=stress_level,
			burnout_risk=burnout_risk,
			recommended_assignments=recommended_assignments,
			workload_adjustment_needed=utilization > 85 or utilization < 40,
			suggested_actions=suggested_actions
		)
	
	async def _handle_member_removal(self, assignment: TaskAssignment, removed_user_id: str):
		"""Handle task reassignment when a member is removed."""
		# Remove user from assignment
		assignment.assigned_to = [uid for uid in assignment.assigned_to if uid != removed_user_id]
		
		if assignment.primary_assignee == removed_user_id:
			# Need to assign new primary
			if assignment.assigned_to:
				assignment.primary_assignee = assignment.assigned_to[0]
			else:
				# Need to completely reassign
				await self.reassign_task(
					assignment.assignment_id,
					f"Member {removed_user_id} removed from team",
					self.default_strategy
				)
		
		if removed_user_id in assignment.secondary_assignees:
			assignment.secondary_assignees = [
				uid for uid in assignment.secondary_assignees 
				if uid != removed_user_id
			]
	
	async def _record_assignment_event(self, assignment: TaskAssignment, assignment_time_ms: float):
		"""Record assignment event in history."""
		event = {
			"timestamp": datetime.now().isoformat(),
			"assignment_id": assignment.assignment_id,
			"task_id": assignment.task_id,
			"assigned_to": assignment.assigned_to,
			"primary_assignee": assignment.primary_assignee,
			"strategy": assignment.assignment_strategy.value,
			"confidence": assignment.confidence_score,
			"assignment_time_ms": assignment_time_ms
		}
		
		self.assignment_history.append(event)
		
		# Keep only last 1000 events
		if len(self.assignment_history) > 1000:
			self.assignment_history = self.assignment_history[-1000:]
	
	async def _calculate_skill_utilization(self) -> float:
		"""Calculate overall skill utilization efficiency."""
		if not self.active_assignments:
			return 0.0
		
		total_utilization = 0.0
		assignment_count = 0
		
		for assignment in self.active_assignments.values():
			# Calculate how well skills are utilized in this assignment
			for user_id in assignment.assigned_to:
				if user_id in self.team_members:
					member = self.team_members[user_id]
					skill_utilization = 0.0
					skill_count = 0
					
					for skill, required_level in assignment.required_skills.items():
						member_level = member.skills.get(skill, 0.0)
						if member_level > 0:
							utilization = min(required_level / member_level, 1.0)
							skill_utilization += utilization
							skill_count += 1
					
					if skill_count > 0:
						total_utilization += skill_utilization / skill_count
						assignment_count += 1
		
		return (total_utilization / assignment_count * 100.0) if assignment_count > 0 else 0.0
	
	async def _calculate_collaboration_effectiveness(self) -> float:
		"""Calculate collaboration effectiveness."""
		if not self.completed_assignments:
			return 0.0
		
		collaborative_assignments = [
			assignment for assignment in self.completed_assignments.values()
			if len(assignment.assigned_to) > 1
		]
		
		if not collaborative_assignments:
			return 0.0
		
		total_effectiveness = 0.0
		for assignment in collaborative_assignments:
			if assignment.quality_score:
				total_effectiveness += assignment.quality_score
		
		return (total_effectiveness / len(collaborative_assignments) * 100.0)
	
	async def _workload_balancing_loop(self):
		"""Background loop for workload balancing."""
		while self._coordinator_running:
			try:
				await asyncio.sleep(300)  # Balance every 5 minutes
				await self._perform_workload_balancing()
			except Exception as e:
				logger.error(f"Error in workload balancing loop: {e}")
	
	async def _metrics_update_loop(self):
		"""Background loop for metrics updates."""
		while self._coordinator_running:
			try:
				await asyncio.sleep(60)  # Update every minute
				await self._update_coordination_metrics()
			except Exception as e:
				logger.error(f"Error in metrics update loop: {e}")
	
	async def _perform_workload_balancing(self):
		"""Perform automatic workload balancing."""
		workload_balances = await self.get_workload_balance()
		
		# Identify overloaded and underloaded members
		overloaded = []
		underloaded = []
		
		for user_id, balance in workload_balances.items():
			if balance.utilization_percentage > 90:
				overloaded.append((user_id, balance))
			elif balance.utilization_percentage < 50:
				underloaded.append((user_id, balance))
		
		# Attempt to redistribute tasks
		if overloaded and underloaded:
			logger.info(f"Attempting workload balancing: {len(overloaded)} overloaded, {len(underloaded)} underloaded")
			
			# Simple balancing strategy (could be more sophisticated)
			for overloaded_user_id, overloaded_balance in overloaded:
				# Find tasks that could be reassigned
				reassignable_tasks = [
					assignment for assignment in self.active_assignments.values()
					if (overloaded_user_id in assignment.assigned_to and 
						assignment.progress_percentage < 25)  # Only early-stage tasks
				]
				
				for task_assignment in reassignable_tasks[:1]:  # Reassign one task at a time
					# Try to reassign to underloaded member
					for underloaded_user_id, underloaded_balance in underloaded:
						underloaded_member = self.team_members[underloaded_user_id]
						
						# Check if underloaded member can handle the task
						candidate_score = await self._evaluate_assignment_candidate(
							member=underloaded_member,
							required_skills=task_assignment.required_skills,
							estimated_effort_hours=task_assignment.estimated_effort_hours,
							complexity_level=task_assignment.complexity_level,
							collaboration_type=task_assignment.collaboration_type,
							due_date=task_assignment.due_date,
							strategy=AssignmentStrategy.WORKLOAD_BALANCED,
							constraints={}
						)
						
						if candidate_score['eligible'] and candidate_score['score'] > 0.6:
							await self.reassign_task(
								task_assignment.assignment_id,
								f"Workload balancing: {overloaded_user_id} -> {underloaded_user_id}",
								AssignmentStrategy.WORKLOAD_BALANCED
							)
							break
	
	async def _update_coordination_metrics(self):
		"""Update coordination metrics."""
		# Update deadline adherence rate
		completed_with_deadlines = [
			assignment for assignment in self.completed_assignments.values()
			if assignment.due_date
		]
		
		if completed_with_deadlines:
			# Simplified calculation
			self.coordination_metrics.deadline_adherence_rate = 85.0  # Placeholder
		
		# Take workload balance snapshot
		if len(self.workload_snapshots) > 100:  # Keep last 100 snapshots
			self.workload_snapshots = self.workload_snapshots[-100:]
		
		current_balances = await self.get_workload_balance()
		self.workload_snapshots.append(current_balances)
	
	async def _notify_coordination_event(self, event_type: str, assignment: TaskAssignment, additional_data: Optional[Dict[str, Any]] = None):
		"""Notify subscribers of coordination events."""
		event_data = {
			"event_type": event_type,
			"assignment_id": assignment.assignment_id,
			"task_id": assignment.task_id,
			"workflow_instance_id": assignment.workflow_instance_id,
			"assigned_to": assignment.assigned_to,
			"primary_assignee": assignment.primary_assignee,
			"timestamp": datetime.now().isoformat()
		}
		
		if additional_data:
			event_data.update(additional_data)
		
		for callback in self.coordination_subscribers:
			try:
				if asyncio.iscoroutinefunction(callback):
					await callback(event_data)
				else:
					callback(event_data)
			except Exception as e:
				logger.error(f"Error in coordination event callback: {e}")
	
	async def cleanup(self):
		"""Clean up coordinator resources."""
		await self.stop_coordinator()
		
		# Clear all data
		self.team_members.clear()
		self.active_assignments.clear()
		self.completed_assignments.clear()
		self.assignment_history.clear()
		self.skill_registry.clear()
		self.expertise_network.clear()
		self.workload_snapshots.clear()
		self.coordination_subscribers.clear()
		
		logger.info("TaskCoordinator cleaned up")
