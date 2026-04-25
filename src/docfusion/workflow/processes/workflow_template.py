"""
Industry-specific workflow templates and template management.

This module provides customizable workflow templates, template sharing,
template performance analytics, and optimization recommendations.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Union

from pydantic import BaseModel, Field, ConfigDict, field_validator
from ...core.utils import uuid7str

logger = logging.getLogger(__name__)

class TemplateCategory(str, Enum):
	"""Categories of workflow templates."""
	DOCUMENT_CREATION = "document_creation"
	PROPOSAL_DEVELOPMENT = "proposal_development"
	REVIEW_APPROVAL = "review_approval"
	COLLABORATION = "collaboration"
	COMPLIANCE = "compliance"
	PROJECT_MANAGEMENT = "project_management"
	CONTENT_MANAGEMENT = "content_management"
	QUALITY_ASSURANCE = "quality_assurance"
	PUBLISHING = "publishing"
	MAINTENANCE = "maintenance"

class IndustryType(str, Enum):
	"""Target industries for templates."""
	GOVERNMENT = "government"
	HEALTHCARE = "healthcare"
	FINANCE = "finance"
	TECHNOLOGY = "technology"
	MANUFACTURING = "manufacturing"
	EDUCATION = "education"
	CONSTRUCTION = "construction"
	CONSULTING = "consulting"
	LEGAL = "legal"
	NONPROFIT = "nonprofit"
	GENERIC = "generic"

class ParameterType(str, Enum):
	"""Types of template parameters."""
	STRING = "string"
	INTEGER = "integer"
	FLOAT = "float"
	BOOLEAN = "boolean"
	LIST = "list"
	DICT = "dict"
	USER_ID = "user_id"
	ROLE_NAME = "role_name"
	DURATION = "duration"
	DATE = "date"
	ENUM = "enum"

class TemplateStatus(str, Enum):
	"""Template lifecycle statuses."""
	DRAFT = "draft"
	ACTIVE = "active"
	DEPRECATED = "deprecated"
	ARCHIVED = "archived"

class TemplateParameter(BaseModel):
	"""Customizable template parameter definition."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	parameter_id: str = Field(default_factory=uuid7str)
	name: str = Field(description="Parameter name")
	display_name: str = Field(description="User-friendly parameter name")
	description: str = Field(description="Parameter description")
	parameter_type: ParameterType = Field(description="Parameter data type")
	default_value: Any = Field(None, description="Default parameter value")
	required: bool = Field(True, description="Whether parameter is required")
	
	# Validation constraints
	min_value: Optional[Union[int, float]] = Field(None, description="Minimum value for numeric types")
	max_value: Optional[Union[int, float]] = Field(None, description="Maximum value for numeric types")
	min_length: Optional[int] = Field(None, description="Minimum length for string/list types")
	max_length: Optional[int] = Field(None, description="Maximum length for string/list types")
	allowed_values: Optional[List[Any]] = Field(None, description="Allowed values for enum types")
	pattern: Optional[str] = Field(None, description="Regex pattern for string validation")
	
	# UI hints
	placeholder: Optional[str] = Field(None, description="Placeholder text for UI")
	help_text: Optional[str] = Field(None, description="Additional help text")
	group: Optional[str] = Field(None, description="Parameter grouping for UI")
	order: int = Field(100, description="Display order")

class TemplateUsageStatistics(BaseModel):
	"""Template usage and performance statistics."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	template_id: str = Field(description="Template identifier")
	total_usage_count: int = Field(0, description="Total number of template uses")
	successful_completions: int = Field(0, description="Number of successful completions")
	average_completion_time_hours: float = Field(0.0, description="Average completion time")
	user_satisfaction_score: float = Field(0.0, description="Average user satisfaction (1-5)")
	
	# Usage patterns
	most_active_users: List[str] = Field(default_factory=list, description="Most active user IDs")
	peak_usage_hours: List[int] = Field(default_factory=list, description="Peak usage hours")
	common_parameter_values: Dict[str, Any] = Field(default_factory=dict, description="Common parameter combinations")
	
	# Performance metrics
	average_task_durations: Dict[str, float] = Field(default_factory=dict, description="Average duration per task type")
	bottleneck_tasks: List[str] = Field(default_factory=list, description="Task IDs that cause delays")
	optimization_suggestions: List[str] = Field(default_factory=list, description="Recommended optimizations")
	
	# Time-based analytics
	usage_trend: Dict[str, int] = Field(default_factory=dict, description="Usage count by date")
	performance_trend: Dict[str, float] = Field(default_factory=dict, description="Performance trend by date")
	last_updated: datetime = Field(default_factory=datetime.now)

class TemplateInstance(BaseModel):
	"""Instance of a template with specific parameter values."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	instance_id: str = Field(default_factory=uuid7str)
	template_id: str = Field(description="Source template ID")
	instance_name: str = Field(description="Instance name")
	created_by: str = Field(description="User who created instance")
	created_at: datetime = Field(default_factory=datetime.now)
	
	# Parameter values
	parameter_values: Dict[str, Any] = Field(description="Instantiated parameter values")
	
	# Execution tracking
	status: str = Field("created", description="Instance status")
	started_at: Optional[datetime] = Field(None, description="Execution start time")
	completed_at: Optional[datetime] = Field(None, description="Execution completion time")
	execution_log: List[str] = Field(default_factory=list, description="Execution log entries")
	
	# Results and feedback
	outcome: Optional[str] = Field(None, description="Execution outcome")
	user_feedback: Optional[Dict[str, Any]] = Field(None, description="User feedback on instance")
	performance_metrics: Dict[str, float] = Field(default_factory=dict, description="Performance measurements")

class IndustryTemplate(BaseModel):
	"""Industry-specific workflow template configuration."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	template_id: str = Field(default_factory=uuid7str)
	name: str = Field(description="Template name")
	description: str = Field(description="Template description")
	category: TemplateCategory = Field(description="Template category")
	industry: IndustryType = Field(description="Target industry")
	
	# Template definition
	version: str = Field("1.0.0", description="Template version")
	base_process_definition: Dict[str, Any] = Field(description="Base workflow process definition")
	customizable_parameters: List[TemplateParameter] = Field(default_factory=list)
	
	# Metadata
	created_by: str = Field(description="Template creator")
	created_at: datetime = Field(default_factory=datetime.now)
	modified_at: datetime = Field(default_factory=datetime.now)
	status: TemplateStatus = Field(TemplateStatus.DRAFT)
	
	# Access and sharing
	is_public: bool = Field(False, description="Whether template is publicly available")
	shared_with_users: List[str] = Field(default_factory=list, description="Users with access")
	shared_with_organizations: List[str] = Field(default_factory=list, description="Organizations with access")
	
	# Documentation and support
	documentation_url: Optional[str] = Field(None, description="Link to template documentation")
	training_materials: List[str] = Field(default_factory=list, description="Training material URLs")
	support_contact: Optional[str] = Field(None, description="Support contact information")
	
	# Usage and performance
	usage_statistics: TemplateUsageStatistics = Field(default_factory=lambda: TemplateUsageStatistics(template_id=""))
	tags: List[str] = Field(default_factory=list, description="Template tags")
	complexity_score: float = Field(1.0, description="Template complexity (1-10)")
	estimated_duration_hours: Optional[float] = Field(None, description="Estimated completion time")

@dataclass
class TemplateRecommendation:
	"""Template recommendation for specific use case."""
	template_id: str
	relevance_score: float
	recommendation_reason: str
	suggested_parameters: Dict[str, Any]
	expected_benefits: List[str]
	customization_suggestions: List[str]

class WorkflowTemplate:
	"""
	Industry-specific workflow template management system.
	
	Provides customizable workflow templates, template sharing,
	performance analytics, and optimization recommendations.
	"""
	
	def __init__(self, storage_path: Optional[str] = None):
		self.templates: Dict[str, IndustryTemplate] = {}  # template_id -> template
		self.template_instances: Dict[str, TemplateInstance] = {}  # instance_id -> instance
		self.template_categories: Dict[TemplateCategory, List[str]] = {}  # category -> template_ids
		self.industry_templates: Dict[IndustryType, List[str]] = {}  # industry -> template_ids
		self.template_usage_history: Dict[str, List[Dict[str, Any]]] = {}  # template_id -> usage events
		self.template_subscribers: List[callable] = []
		self.storage_path = storage_path
		self._lock = asyncio.Lock()
		
		# Built-in templates
		self._initialize_builtin_templates()
		
		logger.info("WorkflowTemplate initialized")
	
	async def create_template(
		self,
		name: str,
		description: str,
		category: TemplateCategory,
		industry: IndustryType,
		base_process_definition: Dict[str, Any],
		created_by: str,
		customizable_parameters: Optional[List[TemplateParameter]] = None
	) -> IndustryTemplate:
		"""
		Create a new workflow template.
		
		Args:
			name: Template name
			description: Template description
			category: Template category
			industry: Target industry
			base_process_definition: Base workflow definition
			created_by: Template creator
			customizable_parameters: Customizable parameters
			
		Returns:
			IndustryTemplate: Created template
		"""
		async with self._lock:
			template = IndustryTemplate(
				name=name,
				description=description,
				category=category,
				industry=industry,
				base_process_definition=base_process_definition,
				created_by=created_by,
				customizable_parameters=customizable_parameters or []
			)
			
			# Initialize usage statistics
			template.usage_statistics.template_id = template.template_id
			
			# Store template
			self.templates[template.template_id] = template
			
			# Update category index
			if category not in self.template_categories:
				self.template_categories[category] = []
			self.template_categories[category].append(template.template_id)
			
			# Update industry index
			if industry not in self.industry_templates:
				self.industry_templates[industry] = []
			self.industry_templates[industry].append(template.template_id)
			
			logger.info(f"Created template: {name} ({template.template_id})")
			
			# Notify subscribers
			await self._notify_template_change("template_created", template)
			
			return template
	
	async def instantiate_template(
		self,
		template_id: str,
		instance_name: str,
		parameter_values: Dict[str, Any],
		created_by: str
	) -> TemplateInstance:
		"""
		Create an instance of a template with specific parameters.
		
		Args:
			template_id: Template identifier
			instance_name: Instance name
			parameter_values: Parameter values for instantiation
			created_by: User creating instance
			
		Returns:
			TemplateInstance: Created template instance
		"""
		async with self._lock:
			if template_id not in self.templates:
				raise ValueError(f"Template {template_id} not found")
			
			template = self.templates[template_id]
			
			# Validate parameter values
			validation_errors = await self._validate_parameter_values(template, parameter_values)
			if validation_errors:
				raise ValueError(f"Parameter validation errors: {validation_errors}")
			
			# Create instance
			instance = TemplateInstance(
				template_id=template_id,
				instance_name=instance_name,
				parameter_values=parameter_values,
				created_by=created_by
			)
			
			self.template_instances[instance.instance_id] = instance
			
			# Update usage statistics
			await self._update_template_usage_statistics(template_id, "instantiated", {
				"user_id": created_by,
				"parameter_values": parameter_values
			})
			
			logger.info(f"Instantiated template {template_id} as {instance_name}")
			
			# Notify subscribers
			await self._notify_template_change("template_instantiated", instance)
			
			return instance
	
	async def get_template_recommendations(
		self,
		use_case_description: str,
		industry: Optional[IndustryType] = None,
		category: Optional[TemplateCategory] = None,
		user_id: Optional[str] = None
	) -> List[TemplateRecommendation]:
		"""
		Get template recommendations based on use case.
		
		Args:
			use_case_description: Description of the use case
			industry: Target industry filter
			category: Template category filter
			user_id: User ID for personalized recommendations
			
		Returns:
			List[TemplateRecommendation]: Recommended templates
		"""
		recommendations = []
		
		# Filter templates by industry and category
		candidate_templates = []
		for template in self.templates.values():
			if template.status != TemplateStatus.ACTIVE:
				continue
			
			if industry and template.industry not in [industry, IndustryType.GENERIC]:
				continue
			
			if category and template.category != category:
				continue
			
			candidate_templates.append(template)
		
		# Score templates based on relevance
		for template in candidate_templates:
			relevance_score = await self._calculate_template_relevance(
				template, use_case_description, user_id
			)
			
			if relevance_score > 0.2:  # Threshold for relevance
				recommendation = TemplateRecommendation(
					template_id=template.template_id,
					relevance_score=relevance_score,
					recommendation_reason=await self._generate_recommendation_reason(template, use_case_description),
					suggested_parameters=await self._suggest_parameter_values(template, use_case_description),
					expected_benefits=await self._identify_template_benefits(template),
					customization_suggestions=await self._generate_customization_suggestions(template)
				)
				recommendations.append(recommendation)
		
		# Sort by relevance score
		recommendations.sort(key=lambda r: r.relevance_score, reverse=True)
		
		return recommendations[:10]  # Return top 10 recommendations
	
	async def get_templates_by_category(self, category: TemplateCategory) -> List[IndustryTemplate]:
		"""
		Get all templates in a specific category.
		
		Args:
			category: Template category
			
		Returns:
			List[IndustryTemplate]: Templates in category
		"""
		template_ids = self.template_categories.get(category, [])
		return [self.templates[tid] for tid in template_ids if tid in self.templates]
	
	async def get_templates_by_industry(self, industry: IndustryType) -> List[IndustryTemplate]:
		"""
		Get all templates for a specific industry.
		
		Args:
			industry: Target industry
			
		Returns:
			List[IndustryTemplate]: Templates for industry
		"""
		template_ids = self.industry_templates.get(industry, [])
		generic_ids = self.industry_templates.get(IndustryType.GENERIC, [])
		all_ids = template_ids + generic_ids
		
		return [self.templates[tid] for tid in all_ids if tid in self.templates]
	
	async def update_template_performance(
		self,
		template_id: str,
		performance_data: Dict[str, Any]
	):
		"""
		Update template performance metrics.
		
		Args:
			template_id: Template identifier
			performance_data: Performance measurement data
		"""
		if template_id not in self.templates:
			return
		
		template = self.templates[template_id]
		stats = template.usage_statistics
		
		# Update completion metrics
		if performance_data.get("completed"):
			stats.successful_completions += 1
		
		# Update timing metrics
		if "completion_time_hours" in performance_data:
			current_avg = stats.average_completion_time_hours
			total_completions = stats.successful_completions
			
			if total_completions > 1:
				stats.average_completion_time_hours = (
					(current_avg * (total_completions - 1) + performance_data["completion_time_hours"]) 
					/ total_completions
				)
			else:
				stats.average_completion_time_hours = performance_data["completion_time_hours"]
		
		# Update satisfaction score
		if "user_satisfaction" in performance_data:
			current_score = stats.user_satisfaction_score
			total_ratings = performance_data.get("total_ratings", 1)
			
			stats.user_satisfaction_score = (
				(current_score * (total_ratings - 1) + performance_data["user_satisfaction"]) 
				/ total_ratings
			)
		
		# Update task duration metrics
		if "task_durations" in performance_data:
			for task_id, duration in performance_data["task_durations"].items():
				if task_id in stats.average_task_durations:
					current_avg = stats.average_task_durations[task_id]
					stats.average_task_durations[task_id] = (current_avg + duration) / 2
				else:
					stats.average_task_durations[task_id] = duration
		
		# Identify bottlenecks
		await self._identify_template_bottlenecks(template_id)
		
		# Generate optimization suggestions
		await self._generate_optimization_suggestions(template_id)
		
		stats.last_updated = datetime.now()
		
		logger.info(f"Updated performance metrics for template {template_id}")
	
	async def get_template_analytics(
		self,
		template_id: str,
		period_days: int = 30
	) -> Dict[str, Any]:
		"""
		Get comprehensive analytics for a template.
		
		Args:
			template_id: Template identifier
			period_days: Analysis period in days
			
		Returns:
			Dict[str, Any]: Template analytics
		"""
		if template_id not in self.templates:
			raise ValueError(f"Template {template_id} not found")
		
		template = self.templates[template_id]
		stats = template.usage_statistics
		
		# Get usage history for the period
		cutoff_date = datetime.now() - timedelta(days=period_days)
		usage_history = self.template_usage_history.get(template_id, [])
		recent_usage = [
			event for event in usage_history 
			if datetime.fromisoformat(event["timestamp"]) > cutoff_date
		]
		
		# Calculate analytics
		analytics = {
			"template_id": template_id,
			"template_name": template.name,
			"period_days": period_days,
			"total_usage": len(recent_usage),
			"usage_trend": self._calculate_usage_trend(recent_usage),
			"performance_metrics": {
				"average_completion_time": stats.average_completion_time_hours,
				"success_rate": stats.successful_completions / max(stats.total_usage_count, 1),
				"user_satisfaction": stats.user_satisfaction_score
			},
			"user_engagement": {
				"unique_users": len(set(event.get("user_id") for event in recent_usage if event.get("user_id"))),
				"most_active_users": stats.most_active_users[:5],
				"repeat_usage_rate": self._calculate_repeat_usage_rate(recent_usage)
			},
			"optimization_insights": {
				"bottleneck_tasks": stats.bottleneck_tasks,
				"optimization_suggestions": stats.optimization_suggestions,
				"complexity_score": template.complexity_score
			},
			"parameter_analysis": self._analyze_parameter_usage(recent_usage),
			"generated_at": datetime.now().isoformat()
		}
		
		return analytics
	
	async def share_template(
		self,
		template_id: str,
		target_users: Optional[List[str]] = None,
		target_organizations: Optional[List[str]] = None,
		make_public: bool = False
	) -> bool:
		"""
		Share template with users or organizations.
		
		Args:
			template_id: Template identifier
			target_users: User IDs to share with
			target_organizations: Organization IDs to share with
			make_public: Whether to make template publicly available
			
		Returns:
			bool: True if sharing was successful
		"""
		async with self._lock:
			if template_id not in self.templates:
				return False
			
			template = self.templates[template_id]
			
			if make_public:
				template.is_public = True
			
			if target_users:
				template.shared_with_users.extend(target_users)
				template.shared_with_users = list(set(template.shared_with_users))  # Remove duplicates
			
			if target_organizations:
				template.shared_with_organizations.extend(target_organizations)
				template.shared_with_organizations = list(set(template.shared_with_organizations))
			
			template.modified_at = datetime.now()
			
			logger.info(f"Shared template {template_id} with {len(target_users or [])} users and {len(target_organizations or [])} organizations")
			
			# Notify subscribers
			await self._notify_template_change("template_shared", template)
			
			return True
	
	async def get_template(self, template_id: str) -> Optional[IndustryTemplate]:
		"""
		Get specific template by ID.
		
		Args:
			template_id: Template identifier
			
		Returns:
			Optional[IndustryTemplate]: Template if found
		"""
		return self.templates.get(template_id)
	
	async def search_templates(
		self,
		query: str,
		industry: Optional[IndustryType] = None,
		category: Optional[TemplateCategory] = None,
		tags: Optional[List[str]] = None
	) -> List[IndustryTemplate]:
		"""
		Search templates by query and filters.
		
		Args:
			query: Search query
			industry: Industry filter
			category: Category filter
			tags: Tags filter
			
		Returns:
			List[IndustryTemplate]: Matching templates
		"""
		matching_templates = []
		query_lower = query.lower()
		
		for template in self.templates.values():
			# Apply filters
			if industry and template.industry not in [industry, IndustryType.GENERIC]:
				continue
			
			if category and template.category != category:
				continue
			
			if tags and not any(tag in template.tags for tag in tags):
				continue
			
			# Search in name, description, and tags
			searchable_text = f"{template.name} {template.description} {' '.join(template.tags)}".lower()
			if query_lower in searchable_text:
				matching_templates.append(template)
		
		return matching_templates
	
	async def subscribe_to_template_changes(self, callback: callable) -> str:
		"""
		Subscribe to template change notifications.
		
		Args:
			callback: Callback function for template events
			
		Returns:
			str: Subscription ID
		"""
		self.template_subscribers.append(callback)
		subscription_id = uuid7str()
		logger.info("New template change subscription added")
		return subscription_id
	
	def _initialize_builtin_templates(self):
		"""Initialize built-in workflow templates."""
		# Government proposal template
		gov_proposal_template = IndustryTemplate(
			name="Government Proposal Development",
			description="Complete workflow for developing government contract proposals",
			category=TemplateCategory.PROPOSAL_DEVELOPMENT,
			industry=IndustryType.GOVERNMENT,
			base_process_definition=self._create_government_proposal_workflow(),
			created_by="system",
			customizable_parameters=[
				TemplateParameter(
					name="proposal_type",
					display_name="Proposal Type",
					description="Type of government proposal",
					parameter_type=ParameterType.ENUM,
					allowed_values=["federal", "state", "local", "defense"],
					default_value="federal"
				),
				TemplateParameter(
					name="review_cycles",
					display_name="Review Cycles",
					description="Number of review cycles",
					parameter_type=ParameterType.INTEGER,
					min_value=1,
					max_value=5,
					default_value=2
				),
				TemplateParameter(
					name="compliance_frameworks",
					display_name="Compliance Frameworks",
					description="Required compliance frameworks",
					parameter_type=ParameterType.LIST,
					default_value=["FAR", "DFARS"]
				)
			],
			status=TemplateStatus.ACTIVE,
			tags=["government", "proposal", "compliance", "federal"],
			complexity_score=7.5,
			estimated_duration_hours=120.0
		)
		
		# Generic document review template
		review_template = IndustryTemplate(
			name="Document Review and Approval",
			description="Standard document review and approval workflow",
			category=TemplateCategory.REVIEW_APPROVAL,
			industry=IndustryType.GENERIC,
			base_process_definition=self._create_document_review_workflow(),
			created_by="system",
			customizable_parameters=[
				TemplateParameter(
					name="approval_levels",
					display_name="Approval Levels",
					description="Number of approval levels required",
					parameter_type=ParameterType.INTEGER,
					min_value=1,
					max_value=3,
					default_value=2
				),
				TemplateParameter(
					name="parallel_review",
					display_name="Parallel Review",
					description="Enable parallel review process",
					parameter_type=ParameterType.BOOLEAN,
					default_value=True
				)
			],
			status=TemplateStatus.ACTIVE,
			tags=["review", "approval", "generic", "quality"],
			complexity_score=4.0,
			estimated_duration_hours=24.0
		)
		
		# Healthcare compliance template
		healthcare_template = IndustryTemplate(
			name="Healthcare Document Compliance",
			description="Healthcare-specific document compliance workflow",
			category=TemplateCategory.COMPLIANCE,
			industry=IndustryType.HEALTHCARE,
			base_process_definition=self._create_healthcare_compliance_workflow(),
			created_by="system",
			customizable_parameters=[
				TemplateParameter(
					name="hipaa_required",
					display_name="HIPAA Compliance Required",
					description="Whether HIPAA compliance validation is required",
					parameter_type=ParameterType.BOOLEAN,
					default_value=True
				),
				TemplateParameter(
					name="phi_handling",
					display_name="PHI Handling Level",
					description="Level of PHI handling required",
					parameter_type=ParameterType.ENUM,
					allowed_values=["none", "limited", "full"],
					default_value="limited"
				)
			],
			status=TemplateStatus.ACTIVE,
			tags=["healthcare", "compliance", "hipaa", "phi"],
			complexity_score=8.0,
			estimated_duration_hours=48.0
		)
		
		# Store built-in templates
		for template in [gov_proposal_template, review_template, healthcare_template]:
			template.usage_statistics.template_id = template.template_id
			self.templates[template.template_id] = template
			
			# Update indexes
			if template.category not in self.template_categories:
				self.template_categories[template.category] = []
			self.template_categories[template.category].append(template.template_id)
			
			if template.industry not in self.industry_templates:
				self.industry_templates[template.industry] = []
			self.industry_templates[template.industry].append(template.template_id)
		
		logger.info(f"Initialized {len(self.templates)} built-in templates")
	
	def _create_government_proposal_workflow(self) -> Dict[str, Any]:
		"""Create government proposal development workflow definition."""
		return {
			"nodes": {
				"start": {"node_type": "start", "name": "Start Proposal Development"},
				"requirements_analysis": {"node_type": "user_task", "name": "Analyze Requirements"},
				"team_assignment": {"node_type": "user_task", "name": "Assign Team Members"},
				"content_creation": {"node_type": "parallel", "name": "Create Content Sections"},
				"technical_section": {"node_type": "user_task", "name": "Technical Approach"},
				"management_section": {"node_type": "user_task", "name": "Management Plan"},
				"cost_section": {"node_type": "user_task", "name": "Cost Analysis"},
				"past_performance": {"node_type": "user_task", "name": "Past Performance"},
				"merge_content": {"node_type": "merge", "name": "Merge All Sections"},
				"compliance_check": {"node_type": "service_task", "name": "Compliance Validation"},
				"internal_review": {"node_type": "user_task", "name": "Internal Review"},
				"revision": {"node_type": "user_task", "name": "Revise Document"},
				"final_approval": {"node_type": "user_task", "name": "Final Approval"},
				"submission": {"node_type": "user_task", "name": "Submit Proposal"},
				"end": {"node_type": "end", "name": "Proposal Submitted"}
			},
			"edges": [
				{"source": "start", "target": "requirements_analysis"},
				{"source": "requirements_analysis", "target": "team_assignment"},
				{"source": "team_assignment", "target": "content_creation"},
				{"source": "content_creation", "target": "technical_section"},
				{"source": "content_creation", "target": "management_section"},
				{"source": "content_creation", "target": "cost_section"},
				{"source": "content_creation", "target": "past_performance"},
				{"source": "technical_section", "target": "merge_content"},
				{"source": "management_section", "target": "merge_content"},
				{"source": "cost_section", "target": "merge_content"},
				{"source": "past_performance", "target": "merge_content"},
				{"source": "merge_content", "target": "compliance_check"},
				{"source": "compliance_check", "target": "internal_review"},
				{"source": "internal_review", "target": "revision"},
				{"source": "revision", "target": "final_approval"},
				{"source": "final_approval", "target": "submission"},
				{"source": "submission", "target": "end"}
			]
		}
	
	def _create_document_review_workflow(self) -> Dict[str, Any]:
		"""Create generic document review workflow definition."""
		return {
			"nodes": {
				"start": {"node_type": "start", "name": "Start Review Process"},
				"initial_review": {"node_type": "user_task", "name": "Initial Review"},
				"peer_review": {"node_type": "user_task", "name": "Peer Review"},
				"manager_approval": {"node_type": "user_task", "name": "Manager Approval"},
				"revisions": {"node_type": "user_task", "name": "Apply Revisions"},
				"final_check": {"node_type": "user_task", "name": "Final Quality Check"},
				"publish": {"node_type": "user_task", "name": "Publish Document"},
				"end": {"node_type": "end", "name": "Review Complete"}
			},
			"edges": [
				{"source": "start", "target": "initial_review"},
				{"source": "initial_review", "target": "peer_review"},
				{"source": "peer_review", "target": "manager_approval"},
				{"source": "manager_approval", "target": "revisions", "condition": "needs_revision"},
				{"source": "manager_approval", "target": "final_check", "condition": "approved"},
				{"source": "revisions", "target": "peer_review"},
				{"source": "final_check", "target": "publish"},
				{"source": "publish", "target": "end"}
			]
		}
	
	def _create_healthcare_compliance_workflow(self) -> Dict[str, Any]:
		"""Create healthcare compliance workflow definition."""
		return {
			"nodes": {
				"start": {"node_type": "start", "name": "Start Compliance Review"},
				"phi_scan": {"node_type": "service_task", "name": "PHI Data Scan"},
				"hipaa_check": {"node_type": "service_task", "name": "HIPAA Compliance Check"},
				"privacy_review": {"node_type": "user_task", "name": "Privacy Officer Review"},
				"security_review": {"node_type": "user_task", "name": "Security Review"},
				"remediation": {"node_type": "user_task", "name": "Apply Remediation"},
				"final_approval": {"node_type": "user_task", "name": "Compliance Officer Approval"},
				"archive": {"node_type": "service_task", "name": "Secure Archive"},
				"end": {"node_type": "end", "name": "Compliance Complete"}
			},
			"edges": [
				{"source": "start", "target": "phi_scan"},
				{"source": "phi_scan", "target": "hipaa_check"},
				{"source": "hipaa_check", "target": "privacy_review"},
				{"source": "privacy_review", "target": "security_review"},
				{"source": "security_review", "target": "remediation", "condition": "issues_found"},
				{"source": "security_review", "target": "final_approval", "condition": "compliant"},
				{"source": "remediation", "target": "privacy_review"},
				{"source": "final_approval", "target": "archive"},
				{"source": "archive", "target": "end"}
			]
		}
	
	async def _validate_parameter_values(
		self,
		template: IndustryTemplate,
		parameter_values: Dict[str, Any]
	) -> List[str]:
		"""Validate parameter values against template definition."""
		errors = []
		
		for param in template.customizable_parameters:
			value = parameter_values.get(param.name)
			
			# Check required parameters
			if param.required and value is None:
				errors.append(f"Required parameter '{param.name}' is missing")
				continue
			
			if value is None:
				continue  # Optional parameter not provided
			
			# Type validation
			if param.parameter_type == ParameterType.INTEGER and not isinstance(value, int):
				errors.append(f"Parameter '{param.name}' must be an integer")
			elif param.parameter_type == ParameterType.FLOAT and not isinstance(value, (int, float)):
				errors.append(f"Parameter '{param.name}' must be a number")
			elif param.parameter_type == ParameterType.BOOLEAN and not isinstance(value, bool):
				errors.append(f"Parameter '{param.name}' must be a boolean")
			elif param.parameter_type == ParameterType.STRING and not isinstance(value, str):
				errors.append(f"Parameter '{param.name}' must be a string")
			elif param.parameter_type == ParameterType.LIST and not isinstance(value, list):
				errors.append(f"Parameter '{param.name}' must be a list")
			
			# Range validation
			if param.min_value is not None and isinstance(value, (int, float)) and value < param.min_value:
				errors.append(f"Parameter '{param.name}' must be >= {param.min_value}")
			
			if param.max_value is not None and isinstance(value, (int, float)) and value > param.max_value:
				errors.append(f"Parameter '{param.name}' must be <= {param.max_value}")
			
			# Length validation
			if param.min_length is not None and hasattr(value, '__len__') and len(value) < param.min_length:
				errors.append(f"Parameter '{param.name}' must have length >= {param.min_length}")
			
			if param.max_length is not None and hasattr(value, '__len__') and len(value) > param.max_length:
				errors.append(f"Parameter '{param.name}' must have length <= {param.max_length}")
			
			# Enum validation
			if param.allowed_values and value not in param.allowed_values:
				errors.append(f"Parameter '{param.name}' must be one of {param.allowed_values}")
		
		return errors
	
	async def _update_template_usage_statistics(
		self,
		template_id: str,
		event_type: str,
		event_data: Dict[str, Any]
	):
		"""Update template usage statistics."""
		if template_id not in self.template_usage_history:
			self.template_usage_history[template_id] = []
		
		event = {
			"event_type": event_type,
			"timestamp": datetime.now().isoformat(),
			**event_data
		}
		
		self.template_usage_history[template_id].append(event)
		
		# Update statistics
		template = self.templates[template_id]
		stats = template.usage_statistics
		
		if event_type == "instantiated":
			stats.total_usage_count += 1
			
			# Track user activity
			user_id = event_data.get("user_id")
			if user_id and user_id not in stats.most_active_users:
				stats.most_active_users.append(user_id)
			
			# Track usage patterns
			current_hour = datetime.now().hour
			if current_hour not in stats.peak_usage_hours:
				stats.peak_usage_hours.append(current_hour)
	
	async def _calculate_template_relevance(
		self,
		template: IndustryTemplate,
		use_case_description: str,
		user_id: Optional[str]
	) -> float:
		"""Calculate template relevance score for a use case."""
		relevance_score = 0.0
		
		# Text similarity (simplified - would use NLP in production)
		use_case_lower = use_case_description.lower()
		template_text = f"{template.name} {template.description}".lower()
		
		# Simple keyword matching
		common_words = set(use_case_lower.split()) & set(template_text.split())
		if common_words:
			relevance_score += 0.3 * len(common_words) / len(use_case_lower.split())
		
		# Category matching
		category_keywords = {
			TemplateCategory.PROPOSAL_DEVELOPMENT: ["proposal", "bid", "contract", "rfp"],
			TemplateCategory.REVIEW_APPROVAL: ["review", "approve", "check", "validate"],
			TemplateCategory.COMPLIANCE: ["compliance", "regulatory", "audit", "standard"],
			TemplateCategory.DOCUMENT_CREATION: ["create", "write", "generate", "document"]
		}
		
		category_words = category_keywords.get(template.category, [])
		for word in category_words:
			if word in use_case_lower:
				relevance_score += 0.2
		
		# Usage popularity boost
		if template.usage_statistics.total_usage_count > 10:
			relevance_score += 0.1
		
		# User history boost (if available)
		if user_id and user_id in template.usage_statistics.most_active_users:
			relevance_score += 0.15
		
		return min(relevance_score, 1.0)
	
	async def _generate_recommendation_reason(
		self,
		template: IndustryTemplate,
		use_case_description: str
	) -> str:
		"""Generate explanation for template recommendation."""
		reasons = []
		
		if template.usage_statistics.total_usage_count > 20:
			reasons.append("Popular template with proven success")
		
		if template.usage_statistics.user_satisfaction_score > 4.0:
			reasons.append("High user satisfaction rating")
		
		if template.industry != IndustryType.GENERIC:
			reasons.append(f"Specifically designed for {template.industry.value.title()} industry")
		
		if template.complexity_score < 5.0:
			reasons.append("Straightforward workflow suitable for quick implementation")
		
		return ". ".join(reasons) if reasons else "Good match for your requirements"
	
	async def _suggest_parameter_values(
		self,
		template: IndustryTemplate,
		use_case_description: str
	) -> Dict[str, Any]:
		"""Suggest parameter values based on use case."""
		suggestions = {}
		
		# Use most common parameter values from usage statistics
		for param in template.customizable_parameters:
			if param.name in template.usage_statistics.common_parameter_values:
				suggestions[param.name] = template.usage_statistics.common_parameter_values[param.name]
			else:
				suggestions[param.name] = param.default_value
		
		return suggestions
	
	async def _identify_template_benefits(self, template: IndustryTemplate) -> List[str]:
		"""Identify expected benefits of using the template."""
		benefits = []
		
		if template.estimated_duration_hours:
			benefits.append(f"Estimated completion time: {template.estimated_duration_hours} hours")
		
		if template.usage_statistics.average_completion_time_hours > 0:
			benefits.append(f"Average completion time: {template.usage_statistics.average_completion_time_hours:.1f} hours")
		
		benefits.append("Structured workflow with proven best practices")
		
		if template.category == TemplateCategory.COMPLIANCE:
			benefits.append("Built-in compliance validation")
		
		if template.usage_statistics.user_satisfaction_score > 0:
			benefits.append(f"User satisfaction: {template.usage_statistics.user_satisfaction_score:.1f}/5.0")
		
		return benefits
	
	async def _generate_customization_suggestions(self, template: IndustryTemplate) -> List[str]:
		"""Generate customization suggestions for the template."""
		suggestions = []
		
		if template.complexity_score > 7.0:
			suggestions.append("Consider simplifying workflow for faster completion")
		
		if len(template.customizable_parameters) > 10:
			suggestions.append("Review parameters and remove unused ones")
		
		if template.usage_statistics.bottleneck_tasks:
			suggestions.append("Consider optimizing identified bottleneck tasks")
		
		suggestions.append("Customize task assignments based on your team structure")
		suggestions.append("Adjust approval levels to match your organization's requirements")
		
		return suggestions
	
	def _calculate_usage_trend(self, usage_events: List[Dict[str, Any]]) -> Dict[str, int]:
		"""Calculate usage trend over time."""
		trend = {}
		
		for event in usage_events:
			date = datetime.fromisoformat(event["timestamp"]).date().isoformat()
			trend[date] = trend.get(date, 0) + 1
		
		return trend
	
	def _calculate_repeat_usage_rate(self, usage_events: List[Dict[str, Any]]) -> float:
		"""Calculate rate of repeat usage by users."""
		user_usage_counts = {}
		
		for event in usage_events:
			user_id = event.get("user_id")
			if user_id:
				user_usage_counts[user_id] = user_usage_counts.get(user_id, 0) + 1
		
		if not user_usage_counts:
			return 0.0
		
		repeat_users = sum(1 for count in user_usage_counts.values() if count > 1)
		return repeat_users / len(user_usage_counts)
	
	def _analyze_parameter_usage(self, usage_events: List[Dict[str, Any]]) -> Dict[str, Any]:
		"""Analyze parameter usage patterns."""
		parameter_counts = {}
		parameter_values = {}
		
		for event in usage_events:
			if "parameter_values" in event:
				for param_name, param_value in event["parameter_values"].items():
					if param_name not in parameter_counts:
						parameter_counts[param_name] = 0
						parameter_values[param_name] = {}
					
					parameter_counts[param_name] += 1
					
					value_str = str(param_value)
					if value_str not in parameter_values[param_name]:
						parameter_values[param_name][value_str] = 0
					parameter_values[param_name][value_str] += 1
		
		return {
			"parameter_usage_counts": parameter_counts,
			"most_common_values": {
				param: max(values.items(), key=lambda x: x[1])[0] if values else None
				for param, values in parameter_values.items()
			}
		}
	
	async def _identify_template_bottlenecks(self, template_id: str):
		"""Identify bottleneck tasks in template execution."""
		template = self.templates[template_id]
		stats = template.usage_statistics
		
		# Find tasks with longest average duration
		if stats.average_task_durations:
			sorted_tasks = sorted(
				stats.average_task_durations.items(),
				key=lambda x: x[1],
				reverse=True
			)
			
			# Consider top 20% as bottlenecks
			bottleneck_count = max(1, len(sorted_tasks) // 5)
			stats.bottleneck_tasks = [task_id for task_id, _ in sorted_tasks[:bottleneck_count]]
	
	async def _generate_optimization_suggestions(self, template_id: str):
		"""Generate optimization suggestions for template."""
		template = self.templates[template_id]
		stats = template.usage_statistics
		suggestions = []
		
		# Bottleneck-based suggestions
		if stats.bottleneck_tasks:
			suggestions.append(f"Optimize bottleneck tasks: {', '.join(stats.bottleneck_tasks[:3])}")
		
		# Complexity-based suggestions
		if template.complexity_score > 8.0:
			suggestions.append("Consider breaking down complex workflow into smaller sub-processes")
		
		# Performance-based suggestions
		if stats.average_completion_time_hours > (template.estimated_duration_hours or 0) * 1.5:
			suggestions.append("Review task assignments and deadlines to improve completion time")
		
		# Satisfaction-based suggestions
		if stats.user_satisfaction_score < 3.5:
			suggestions.append("Gather user feedback to identify workflow improvement areas")
		
		stats.optimization_suggestions = suggestions
	
	async def _notify_template_change(
		self,
		event_type: str,
		data: Any,
		additional_data: Optional[Dict[str, Any]] = None
	):
		"""Notify subscribers of template changes."""
		event_data = {
			"event_type": event_type,
			"data": data,
			"timestamp": datetime.now().isoformat()
		}
		
		if additional_data:
			event_data.update(additional_data)
		
		for callback in self.template_subscribers:
			try:
				if asyncio.iscoroutinefunction(callback):
					await callback(event_data)
				else:
					callback(event_data)
			except Exception as e:
				logger.error(f"Error in template change callback: {e}")
	
	async def cleanup(self):
		"""Clean up workflow template resources."""
		async with self._lock:
			self.templates.clear()
			self.template_instances.clear()
			self.template_categories.clear()
			self.industry_templates.clear()
			self.template_usage_history.clear()
			self.template_subscribers.clear()
		
		logger.info("WorkflowTemplate cleaned up")