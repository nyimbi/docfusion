#!/usr/bin/env python3
"""
Contextual Access Control Module

Implements time-based and location-based access controls along with other
contextual factors for fine-grained security policies. Integrates with ABAC
to provide dynamic access decisions based on environmental context.
"""

import asyncio
import json
import hashlib
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta, timezone
from typing import Dict, List, Optional, Any, Union, Set, Tuple
from enum import Enum
import logging
import ipaddress
from pathlib import Path

from pydantic import BaseModel, Field, validator
from uuid_extensions import uuid7str


class AccessTimePattern(str, Enum):
	"""Access time patterns"""
	BUSINESS_HOURS = "business_hours"
	EXTENDED_HOURS = "extended_hours"
	WEEKDAYS_ONLY = "weekdays_only"
	WEEKENDS_ONLY = "weekends_only"
	ALWAYS = "always"
	NEVER = "never"
	CUSTOM = "custom"


class LocationScope(str, Enum):
	"""Location scopes for access control"""
	COUNTRY = "country"
	REGION = "region"
	CITY = "city"
	OFFICE = "office"
	NETWORK = "network"
	COORDINATES = "coordinates"


class RiskFactorType(str, Enum):
	"""Types of risk factors"""
	LOCATION = "location"
	TIME = "time"
	DEVICE = "device"
	BEHAVIOR = "behavior"
	NETWORK = "network"
	VELOCITY = "velocity"
	AUTHENTICATION = "authentication"


class TimeRange(BaseModel):
	"""Time range for access control"""
	start_time: time
	end_time: time
	timezone: str = "UTC"

	@validator('timezone')
	def validate_timezone(cls, v):
		# Simplified timezone validation
		if v not in ['UTC', 'EST', 'PST', 'GMT', 'CET']:
			raise ValueError('Invalid timezone')
		return v


class LocationConstraint(BaseModel):
	"""Location-based access constraint"""
	constraint_id: str = Field(default_factory=uuid7str)
	name: str
	scope: LocationScope
	allowed_locations: List[str] = Field(default_factory=list)
	blocked_locations: List[str] = Field(default_factory=list)

	# Geographic coordinates (for precise location control)
	allowed_coordinates: List[Dict[str, float]] = Field(default_factory=list)  # lat, lng, radius
	blocked_coordinates: List[Dict[str, float]] = Field(default_factory=list)

	# Network-based location
	allowed_ip_ranges: List[str] = Field(default_factory=list)
	blocked_ip_ranges: List[str] = Field(default_factory=list)

	# Office/facility-based
	allowed_offices: List[str] = Field(default_factory=list)
	blocked_offices: List[str] = Field(default_factory=list)

	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	created_by: str


class TimeConstraint(BaseModel):
	"""Time-based access constraint"""
	constraint_id: str = Field(default_factory=uuid7str)
	name: str
	pattern: AccessTimePattern

	# Business hours configuration
	business_hours_start: time = time(9, 0)  # 9 AM
	business_hours_end: time = time(17, 0)   # 5 PM
	business_timezone: str = "UTC"

	# Custom time ranges
	allowed_time_ranges: List[TimeRange] = Field(default_factory=list)
	blocked_time_ranges: List[TimeRange] = Field(default_factory=list)

	# Day-based restrictions
	allowed_days: List[int] = Field(default_factory=list)  # 0=Monday, 6=Sunday
	blocked_days: List[int] = Field(default_factory=list)

	# Holiday and special day handling
	respect_holidays: bool = True
	holiday_list: List[str] = Field(default_factory=list)  # ISO date strings

	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	created_by: str


class VelocityConstraint(BaseModel):
	"""Velocity-based access constraint (impossible travel detection)"""
	constraint_id: str = Field(default_factory=uuid7str)
	name: str

	# Maximum travel speed (km/h)
	max_travel_speed_kmh: float = 900.0  # Commercial aircraft speed

	# Time windows for velocity analysis
	velocity_check_window_minutes: int = 60

	# Grace periods
	grace_period_minutes: int = 15  # Allow for clock skew, etc.

	# Exemptions
	exempt_locations: List[str] = Field(default_factory=list)  # Locations exempt from velocity checks
	exempt_ip_ranges: List[str] = Field(default_factory=list)  # IP ranges exempt (e.g., corporate VPN)

	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	created_by: str


class RiskFactor(BaseModel):
	"""Individual risk factor assessment"""
	factor_id: str = Field(default_factory=uuid7str)
	factor_type: RiskFactorType
	description: str
	risk_score: float  # 0.0 to 1.0
	confidence: float  # 0.0 to 1.0

	# Factor-specific data
	details: Dict[str, Any] = Field(default_factory=dict)

	detected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	expires_at: Optional[datetime] = None


class AccessContext(BaseModel):
	"""Complete access context for evaluation"""
	user_id: str
	resource_id: Optional[str] = None
	action: str

	# Time context
	access_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	user_timezone: Optional[str] = None

	# Location context
	ip_address: Optional[str] = None
	geolocation: Optional[Dict[str, Any]] = None  # country, region, city, lat, lng
	office_location: Optional[str] = None
	network_segment: Optional[str] = None

	# Device context
	device_id: Optional[str] = None
	device_trust_level: Optional[str] = None
	device_location: Optional[Dict[str, Any]] = None

	# Authentication context
	authentication_method: Optional[str] = None
	authentication_strength: Optional[str] = None
	recent_authentications: List[Dict[str, Any]] = Field(default_factory=list)

	# Behavioral context
	user_behavior_score: Optional[float] = None
	recent_activities: List[Dict[str, Any]] = Field(default_factory=list)

	# Risk factors
	risk_factors: List[RiskFactor] = Field(default_factory=list)
	overall_risk_score: float = 0.0


class ContextualPolicy(BaseModel):
	"""Contextual access control policy"""
	policy_id: str = Field(default_factory=uuid7str)
	policy_name: str
	description: str

	# Policy scope
	applies_to_users: List[str] = Field(default_factory=list)
	applies_to_resources: List[str] = Field(default_factory=list)
	applies_to_actions: List[str] = Field(default_factory=list)

	# Constraints
	time_constraints: List[str] = Field(default_factory=list)  # constraint IDs
	location_constraints: List[str] = Field(default_factory=list)
	velocity_constraints: List[str] = Field(default_factory=list)

	# Risk thresholds
	max_risk_score: float = 0.7
	require_additional_auth_above_risk: float = 0.5

	# Policy logic
	require_all_constraints: bool = True  # AND vs OR logic
	allow_override: bool = False
	override_by_roles: List[str] = Field(default_factory=list)

	# Actions on policy violation
	deny_access: bool = True
	require_step_up_auth: bool = False
	log_violation: bool = True
	notify_admin: bool = False

	# Metadata
	priority: int = 100  # Lower numbers = higher priority
	active: bool = True
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	created_by: str


class AccessDecision(BaseModel):
	"""Contextual access control decision"""
	decision_id: str = Field(default_factory=uuid7str)
	decision: str  # allow, deny, require_auth, require_additional_auth
	confidence: float = 1.0

	# Context
	user_id: str
	resource_id: Optional[str] = None
	action: str

	# Decision factors
	policy_matches: List[str] = Field(default_factory=list)  # policy IDs that matched
	constraint_violations: List[str] = Field(default_factory=list)
	risk_factors: List[str] = Field(default_factory=list)  # factor IDs
	overall_risk_score: float = 0.0

	# Requirements
	additional_auth_required: bool = False
	required_auth_methods: List[str] = Field(default_factory=list)

	# Reasoning
	decision_reason: str
	decision_details: Dict[str, Any] = Field(default_factory=dict)

	# Metadata
	evaluated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	expires_at: Optional[datetime] = None


@dataclass
class ContextualAccessConfig:
	"""Contextual access control configuration"""
	# Time-based settings
	default_business_hours_start: time = time(9, 0)
	default_business_hours_end: time = time(17, 0)
	default_business_timezone: str = "UTC"

	# Location-based settings
	enable_geolocation: bool = True
	enable_ip_geolocation: bool = True
	suspicious_location_threshold_km: float = 500.0

	# Velocity settings
	enable_velocity_checks: bool = True
	default_max_travel_speed_kmh: float = 900.0
	velocity_grace_period_minutes: int = 15

	# Risk assessment
	enable_risk_scoring: bool = True
	default_max_risk_score: float = 0.7
	risk_factor_decay_hours: int = 24

	# Policy enforcement
	default_policy_mode: str = "enforce"  # enforce, monitor, disabled
	cache_decisions: bool = True
	decision_cache_ttl_minutes: int = 30

	# Integration
	integrate_with_abac: bool = True
	integrate_with_device_management: bool = True

	# Monitoring
	log_all_decisions: bool = True
	log_policy_violations: bool = True
	alert_on_high_risk: bool = True


class ContextualAccessControl:
	"""Contextual access control system with time and location constraints"""

	def __init__(self, config: Optional[ContextualAccessConfig] = None):
		"""Initialize contextual access control system"""
		self.config = config or ContextualAccessConfig()
		self.logger = logging.getLogger(__name__)

		# Storage (in production, use database)
		self.time_constraints: Dict[str, TimeConstraint] = {}
		self.location_constraints: Dict[str, LocationConstraint] = {}
		self.velocity_constraints: Dict[str, VelocityConstraint] = {}
		self.policies: Dict[str, ContextualPolicy] = {}
		self.access_history: Dict[str, List[AccessContext]] = {}  # user_id -> contexts
		self.decision_cache: Dict[str, AccessDecision] = {}

		# Create default constraints
		self._create_default_constraints()

		self.logger.info("Contextual access control system initialized")

	def _create_default_constraints(self):
		"""Create default time and location constraints"""
		# Default business hours constraint
		business_hours = TimeConstraint(
			name="Business Hours",
			pattern=AccessTimePattern.BUSINESS_HOURS,
			business_hours_start=self.config.default_business_hours_start,
			business_hours_end=self.config.default_business_hours_end,
			business_timezone=self.config.default_business_timezone,
			created_by="system"
		)
		self.time_constraints["business_hours"] = business_hours

		# Default velocity constraint
		velocity = VelocityConstraint(
			name="Default Velocity Check",
			max_travel_speed_kmh=self.config.default_max_travel_speed_kmh,
			grace_period_minutes=self.config.velocity_grace_period_minutes,
			created_by="system"
		)
		self.velocity_constraints["default_velocity"] = velocity

	# Constraint Management

	def create_time_constraint(
		self,
		name: str,
		pattern: AccessTimePattern,
		created_by: str,
		**kwargs
	) -> str:
		"""Create time-based access constraint"""
		constraint = TimeConstraint(
			name=name,
			pattern=pattern,
			created_by=created_by,
			**kwargs
		)

		self.time_constraints[constraint.constraint_id] = constraint
		self.logger.info(f"Created time constraint: {name}")
		return constraint.constraint_id

	def create_location_constraint(
		self,
		name: str,
		scope: LocationScope,
		created_by: str,
		**kwargs
	) -> str:
		"""Create location-based access constraint"""
		constraint = LocationConstraint(
			name=name,
			scope=scope,
			created_by=created_by,
			**kwargs
		)

		self.location_constraints[constraint.constraint_id] = constraint
		self.logger.info(f"Created location constraint: {name}")
		return constraint.constraint_id

	def create_velocity_constraint(
		self,
		name: str,
		created_by: str,
		max_travel_speed_kmh: float = 900.0,
		**kwargs
	) -> str:
		"""Create velocity-based access constraint"""
		constraint = VelocityConstraint(
			name=name,
			max_travel_speed_kmh=max_travel_speed_kmh,
			created_by=created_by,
			**kwargs
		)

		self.velocity_constraints[constraint.constraint_id] = constraint
		self.logger.info(f"Created velocity constraint: {name}")
		return constraint.constraint_id

	def create_contextual_policy(
		self,
		policy_name: str,
		description: str,
		created_by: str,
		**kwargs
	) -> str:
		"""Create contextual access policy"""
		policy = ContextualPolicy(
			policy_name=policy_name,
			description=description,
			created_by=created_by,
			**kwargs
		)

		self.policies[policy.policy_id] = policy
		self.logger.info(f"Created contextual policy: {policy_name}")
		return policy.policy_id

	# Context Evaluation

	async def evaluate_access(
		self,
		context: AccessContext
	) -> AccessDecision:
		"""Evaluate access request based on contextual factors"""
		try:
			# Check decision cache
			cache_key = self._generate_cache_key(context)
			if self.config.cache_decisions and cache_key in self.decision_cache:
				cached_decision = self.decision_cache[cache_key]
				if (cached_decision.expires_at and
					datetime.now(timezone.utc) < cached_decision.expires_at):
					return cached_decision

			# Assess risk factors
			risk_factors = await self._assess_risk_factors(context)
			context.risk_factors = risk_factors
			context.overall_risk_score = self._calculate_overall_risk_score(risk_factors)

			# Find applicable policies
			applicable_policies = self._find_applicable_policies(context)

			# Evaluate each policy
			policy_violations = []
			constraint_violations = []
			decision = "allow"
			decision_reason = "No applicable policies or all policies satisfied"
			additional_auth_required = False
			required_auth_methods = []

			for policy in applicable_policies:
				policy_result = await self._evaluate_policy(context, policy)

				if not policy_result["satisfied"]:
					policy_violations.append(policy.policy_id)
					constraint_violations.extend(policy_result["violations"])

					if policy.deny_access:
						decision = "deny"
						decision_reason = f"Policy violation: {policy.policy_name}"
					elif policy.require_step_up_auth:
						additional_auth_required = True
						decision = "require_additional_auth"
						decision_reason = f"Additional authentication required by policy: {policy.policy_name}"

			# Risk-based decisions
			if context.overall_risk_score > self.config.default_max_risk_score:
				if decision == "allow":
					decision = "deny"
					decision_reason = f"High risk score: {context.overall_risk_score:.2f}"
			elif context.overall_risk_score > 0.5:  # Configurable threshold
				additional_auth_required = True
				if decision == "allow":
					decision = "require_additional_auth"
					decision_reason = f"Elevated risk score: {context.overall_risk_score:.2f}"

			# Create decision
			access_decision = AccessDecision(
				decision=decision,
				user_id=context.user_id,
				resource_id=context.resource_id,
				action=context.action,
				policy_matches=[p.policy_id for p in applicable_policies],
				constraint_violations=constraint_violations,
				risk_factors=[rf.factor_id for rf in risk_factors],
				overall_risk_score=context.overall_risk_score,
				additional_auth_required=additional_auth_required,
				required_auth_methods=required_auth_methods,
				decision_reason=decision_reason,
				decision_details={
					"applicable_policies": len(applicable_policies),
					"policy_violations": len(policy_violations),
					"risk_factor_count": len(risk_factors)
				}
			)

			# Cache decision if enabled
			if self.config.cache_decisions:
				access_decision.expires_at = datetime.now(timezone.utc) + timedelta(
					minutes=self.config.decision_cache_ttl_minutes
				)
				self.decision_cache[cache_key] = access_decision

			# Store access context for future analysis
			self._store_access_context(context)

			self.logger.info(f"Access decision for user {context.user_id}: {decision} (risk: {context.overall_risk_score:.2f})")
			return access_decision

		except Exception as e:
			self.logger.error(f"Access evaluation failed: {e}")
			# Fail secure
			return AccessDecision(
				decision="deny",
				user_id=context.user_id,
				resource_id=context.resource_id,
				action=context.action,
				decision_reason=f"Evaluation error: {str(e)}"
			)

	async def _assess_risk_factors(self, context: AccessContext) -> List[RiskFactor]:
		"""Assess various risk factors for the access context"""
		risk_factors = []

		try:
			# Time-based risk factors
			time_risks = await self._assess_time_risks(context)
			risk_factors.extend(time_risks)

			# Location-based risk factors
			location_risks = await self._assess_location_risks(context)
			risk_factors.extend(location_risks)

			# Velocity-based risk factors
			velocity_risks = await self._assess_velocity_risks(context)
			risk_factors.extend(velocity_risks)

			# Device-based risk factors
			device_risks = await self._assess_device_risks(context)
			risk_factors.extend(device_risks)

			# Behavioral risk factors
			behavior_risks = await self._assess_behavioral_risks(context)
			risk_factors.extend(behavior_risks)

			return risk_factors

		except Exception as e:
			self.logger.error(f"Risk assessment failed: {e}")
			# Return high-risk factor on error
			return [RiskFactor(
				factor_type=RiskFactorType.AUTHENTICATION,
				description=f"Risk assessment error: {str(e)}",
				risk_score=0.8,
				confidence=0.9
			)]

	async def _assess_time_risks(self, context: AccessContext) -> List[RiskFactor]:
		"""Assess time-based risk factors"""
		risk_factors = []

		access_time = context.access_time
		hour = access_time.hour
		weekday = access_time.weekday()

		# After hours access
		if hour < 6 or hour > 22:
			risk_factors.append(RiskFactor(
				factor_type=RiskFactorType.TIME,
				description="Access outside typical business hours",
				risk_score=0.3,
				confidence=0.9,
				details={"hour": hour, "access_time": access_time.isoformat()}
			))

		# Weekend access
		if weekday >= 5:  # Saturday, Sunday
			risk_factors.append(RiskFactor(
				factor_type=RiskFactorType.TIME,
				description="Weekend access",
				risk_score=0.2,
				confidence=0.8,
				details={"weekday": weekday}
			))

		# Holiday access (simplified check)
		if access_time.strftime("%m-%d") in ["01-01", "07-04", "12-25"]:  # Major holidays
			risk_factors.append(RiskFactor(
				factor_type=RiskFactorType.TIME,
				description="Holiday access",
				risk_score=0.4,
				confidence=0.7,
				details={"date": access_time.strftime("%Y-%m-%d")}
			))

		return risk_factors

	async def _assess_location_risks(self, context: AccessContext) -> List[RiskFactor]:
		"""Assess location-based risk factors"""
		risk_factors = []

		if not context.geolocation:
			risk_factors.append(RiskFactor(
				factor_type=RiskFactorType.LOCATION,
				description="Unknown location",
				risk_score=0.3,
				confidence=0.6,
				details={"ip_address": context.ip_address}
			))
			return risk_factors

		# Check for high-risk countries (simplified)
		country = context.geolocation.get("country", "").upper()
		high_risk_countries = ["XX", "YY"]  # Placeholder for actual risk assessment

		if country in high_risk_countries:
			risk_factors.append(RiskFactor(
				factor_type=RiskFactorType.LOCATION,
				description=f"Access from high-risk country: {country}",
				risk_score=0.7,
				confidence=0.8,
				details={"country": country}
			))

		# Check against user's typical locations
		typical_locations = await self._get_user_typical_locations(context.user_id)
		if typical_locations:
			current_location = (
				context.geolocation.get("lat", 0),
				context.geolocation.get("lng", 0)
			)

			min_distance = min(
				self._calculate_distance(current_location, loc)
				for loc in typical_locations
			)

			if min_distance > self.config.suspicious_location_threshold_km:
				risk_factors.append(RiskFactor(
					factor_type=RiskFactorType.LOCATION,
					description=f"Unusual location: {min_distance:.1f}km from typical locations",
					risk_score=min(0.6, min_distance / 1000.0),  # Cap at 0.6
					confidence=0.7,
					details={"distance_km": min_distance, "country": country}
				))

		return risk_factors

	async def _assess_velocity_risks(self, context: AccessContext) -> List[RiskFactor]:
		"""Assess velocity/impossible travel risk factors"""
		risk_factors = []

		if not self.config.enable_velocity_checks or not context.geolocation:
			return risk_factors

		# Get recent access history
		user_history = self.access_history.get(context.user_id, [])
		if not user_history:
			return risk_factors

		current_location = (
			context.geolocation.get("lat", 0),
			context.geolocation.get("lng", 0)
		)
		current_time = context.access_time

		# Check velocity against recent accesses
		for prev_context in reversed(user_history[-10:]):  # Check last 10 accesses
			if not prev_context.geolocation:
				continue

			prev_location = (
				prev_context.geolocation.get("lat", 0),
				prev_context.geolocation.get("lng", 0)
			)
			time_diff = (current_time - prev_context.access_time).total_seconds()

			# Only check recent accesses (within velocity check window)
			if time_diff > self.config.velocity_grace_period_minutes * 60:
				continue

			distance_km = self._calculate_distance(current_location, prev_location)
			if distance_km < 10:  # Same location, no velocity risk
				break

			time_hours = time_diff / 3600
			if time_hours > 0:
				velocity_kmh = distance_km / time_hours

				if velocity_kmh > self.config.default_max_travel_speed_kmh:
					risk_factors.append(RiskFactor(
						factor_type=RiskFactorType.VELOCITY,
						description=f"Impossible travel detected: {velocity_kmh:.1f} km/h",
						risk_score=min(0.9, velocity_kmh / 2000.0),  # Cap at 0.9
						confidence=0.8,
						details={
							"distance_km": distance_km,
							"time_hours": time_hours,
							"velocity_kmh": velocity_kmh,
							"max_allowed_kmh": self.config.default_max_travel_speed_kmh
						}
					))
					break

		return risk_factors

	async def _assess_device_risks(self, context: AccessContext) -> List[RiskFactor]:
		"""Assess device-based risk factors"""
		risk_factors = []

		# Unknown device
		if not context.device_id:
			risk_factors.append(RiskFactor(
				factor_type=RiskFactorType.DEVICE,
				description="Unknown or unregistered device",
				risk_score=0.4,
				confidence=0.8
			))

		# Low trust device
		elif context.device_trust_level in ["untrusted", "low"]:
			risk_factors.append(RiskFactor(
				factor_type=RiskFactorType.DEVICE,
				description=f"Low trust device: {context.device_trust_level}",
				risk_score=0.3,
				confidence=0.9,
				details={"trust_level": context.device_trust_level}
			))

		return risk_factors

	async def _assess_behavioral_risks(self, context: AccessContext) -> List[RiskFactor]:
		"""Assess behavioral risk factors"""
		risk_factors = []

		# Unusual behavior score
		if context.user_behavior_score and context.user_behavior_score > 0.7:
			risk_factors.append(RiskFactor(
				factor_type=RiskFactorType.BEHAVIOR,
				description=f"Unusual behavior pattern: {context.user_behavior_score:.2f}",
				risk_score=context.user_behavior_score,
				confidence=0.6,
				details={"behavior_score": context.user_behavior_score}
			))

		# Rapid successive attempts
		recent_attempts = len([
			ctx for ctx in self.access_history.get(context.user_id, [])
			if (context.access_time - ctx.access_time).total_seconds() < 300  # 5 minutes
		])

		if recent_attempts > 10:
			risk_factors.append(RiskFactor(
				factor_type=RiskFactorType.BEHAVIOR,
				description=f"High frequency access: {recent_attempts} attempts in 5 minutes",
				risk_score=min(0.8, recent_attempts / 20.0),
				confidence=0.8,
				details={"attempts_5min": recent_attempts}
			))

		return risk_factors

	def _calculate_overall_risk_score(self, risk_factors: List[RiskFactor]) -> float:
		"""Calculate overall risk score from individual factors"""
		if not risk_factors:
			return 0.0

		# Weighted average with confidence
		total_weighted_score = 0.0
		total_weight = 0.0

		for factor in risk_factors:
			weight = factor.confidence
			weighted_score = factor.risk_score * weight
			total_weighted_score += weighted_score
			total_weight += weight

		if total_weight == 0:
			return 0.0

		base_score = total_weighted_score / total_weight

		# Apply multiplier for multiple risk factors
		multiplier = 1.0 + (len(risk_factors) - 1) * 0.1
		final_score = min(1.0, base_score * multiplier)

		return final_score

	# Policy Evaluation

	def _find_applicable_policies(self, context: AccessContext) -> List[ContextualPolicy]:
		"""Find policies applicable to the access context"""
		applicable_policies = []

		for policy in self.policies.values():
			if not policy.active:
				continue

			# Check user scope
			if policy.applies_to_users and context.user_id not in policy.applies_to_users:
				continue

			# Check resource scope
			if (policy.applies_to_resources and context.resource_id and
				context.resource_id not in policy.applies_to_resources):
				continue

			# Check action scope
			if policy.applies_to_actions and context.action not in policy.applies_to_actions:
				continue

			applicable_policies.append(policy)

		# Sort by priority (lower number = higher priority)
		return sorted(applicable_policies, key=lambda p: p.priority)

	async def _evaluate_policy(
		self,
		context: AccessContext,
		policy: ContextualPolicy
	) -> Dict[str, Any]:
		"""Evaluate a single contextual policy against the access context"""
		violations = []
		constraint_results = []

		# Evaluate time constraints
		for constraint_id in policy.time_constraints:
			constraint = self.time_constraints.get(constraint_id)
			if constraint:
				result = await self._evaluate_time_constraint(context, constraint)
				constraint_results.append(result)
				if not result["satisfied"]:
					violations.append(f"time_constraint_{constraint_id}")

		# Evaluate location constraints
		for constraint_id in policy.location_constraints:
			constraint = self.location_constraints.get(constraint_id)
			if constraint:
				result = await self._evaluate_location_constraint(context, constraint)
				constraint_results.append(result)
				if not result["satisfied"]:
					violations.append(f"location_constraint_{constraint_id}")

		# Evaluate velocity constraints
		for constraint_id in policy.velocity_constraints:
			constraint = self.velocity_constraints.get(constraint_id)
			if constraint:
				result = await self._evaluate_velocity_constraint(context, constraint)
				constraint_results.append(result)
				if not result["satisfied"]:
					violations.append(f"velocity_constraint_{constraint_id}")

		# Check risk threshold
		if context.overall_risk_score > policy.max_risk_score:
			violations.append(f"risk_score_exceeded_{context.overall_risk_score}")

		# Apply policy logic (AND vs OR)
		if policy.require_all_constraints:
			satisfied = len(violations) == 0
		else:
			satisfied = len(constraint_results) == 0 or any(r["satisfied"] for r in constraint_results)

		return {
			"satisfied": satisfied,
			"violations": violations,
			"constraint_results": constraint_results
		}

	async def _evaluate_time_constraint(
		self,
		context: AccessContext,
		constraint: TimeConstraint
	) -> Dict[str, Any]:
		"""Evaluate time constraint against context"""
		access_time = context.access_time

		if constraint.pattern == AccessTimePattern.ALWAYS:
			return {"satisfied": True, "reason": "Always allowed"}
		elif constraint.pattern == AccessTimePattern.NEVER:
			return {"satisfied": False, "reason": "Never allowed"}

		elif constraint.pattern == AccessTimePattern.BUSINESS_HOURS:
			# Convert to business timezone for comparison
			business_hour = access_time.hour  # Simplified - should convert timezone

			satisfied = (constraint.business_hours_start.hour <= business_hour <= constraint.business_hours_end.hour)
			return {
				"satisfied": satisfied,
				"reason": f"Business hours check: {business_hour}h vs {constraint.business_hours_start.hour}-{constraint.business_hours_end.hour}h"
			}

		elif constraint.pattern == AccessTimePattern.WEEKDAYS_ONLY:
			weekday = access_time.weekday()
			satisfied = weekday < 5  # Monday=0 to Friday=4
			return {"satisfied": satisfied, "reason": f"Weekday check: {weekday}"}

		elif constraint.pattern == AccessTimePattern.WEEKENDS_ONLY:
			weekday = access_time.weekday()
			satisfied = weekday >= 5  # Saturday=5, Sunday=6
			return {"satisfied": satisfied, "reason": f"Weekend check: {weekday}"}

		else:  # CUSTOM pattern
			# Check custom time ranges and day restrictions
			satisfied = True
			reason_parts = []

			# Check allowed days
			if constraint.allowed_days:
				weekday = access_time.weekday()
				if weekday not in constraint.allowed_days:
					satisfied = False
					reason_parts.append(f"Day {weekday} not in allowed days {constraint.allowed_days}")

			# Check blocked days
			if constraint.blocked_days:
				weekday = access_time.weekday()
				if weekday in constraint.blocked_days:
					satisfied = False
					reason_parts.append(f"Day {weekday} in blocked days {constraint.blocked_days}")

			# Check time ranges (simplified)
			if constraint.allowed_time_ranges:
				time_satisfied = any(
					tr.start_time.hour <= access_time.hour <= tr.end_time.hour
					for tr in constraint.allowed_time_ranges
				)
				if not time_satisfied:
					satisfied = False
					reason_parts.append("Time not in allowed ranges")

			return {
				"satisfied": satisfied,
				"reason": "; ".join(reason_parts) if reason_parts else "Custom time constraint satisfied"
			}

	async def _evaluate_location_constraint(
		self,
		context: AccessContext,
		constraint: LocationConstraint
	) -> Dict[str, Any]:
		"""Evaluate location constraint against context"""
		if not context.geolocation and not context.ip_address:
			return {"satisfied": False, "reason": "No location information available"}

		satisfied = True
		reason_parts = []

		# Check IP ranges
		if context.ip_address:
			# Check blocked IP ranges
			for ip_range in constraint.blocked_ip_ranges:
				if self._ip_in_range(context.ip_address, ip_range):
					satisfied = False
					reason_parts.append(f"IP {context.ip_address} in blocked range {ip_range}")

			# Check allowed IP ranges
			if constraint.allowed_ip_ranges:
				ip_allowed = any(
					self._ip_in_range(context.ip_address, ip_range)
					for ip_range in constraint.allowed_ip_ranges
				)
				if not ip_allowed:
					satisfied = False
					reason_parts.append(f"IP {context.ip_address} not in allowed ranges")

		# Check geographic locations
		if context.geolocation:
			country = context.geolocation.get("country", "")

			# Check blocked countries
			if country in constraint.blocked_locations:
				satisfied = False
				reason_parts.append(f"Country {country} is blocked")

			# Check allowed countries
			if constraint.allowed_locations and country not in constraint.allowed_locations:
				satisfied = False
				reason_parts.append(f"Country {country} not in allowed list")

		return {
			"satisfied": satisfied,
			"reason": "; ".join(reason_parts) if reason_parts else "Location constraint satisfied"
		}

	async def _evaluate_velocity_constraint(
		self,
		context: AccessContext,
		constraint: VelocityConstraint
	) -> Dict[str, Any]:
		"""Evaluate velocity constraint against context"""
		if not context.geolocation:
			return {"satisfied": True, "reason": "No location for velocity check"}

		# Get recent access history
		user_history = self.access_history.get(context.user_id, [])
		if not user_history:
			return {"satisfied": True, "reason": "No previous access history"}

		current_location = (
			context.geolocation.get("lat", 0),
			context.geolocation.get("lng", 0)
		)
		current_time = context.access_time

		# Check velocity against recent accesses
		for prev_context in reversed(user_history[-5:]):
			if not prev_context.geolocation:
				continue

			time_diff_minutes = (current_time - prev_context.access_time).total_seconds() / 60

			# Only check within the velocity window
			if time_diff_minutes > constraint.velocity_check_window_minutes:
				continue

			# Skip if within grace period
			if time_diff_minutes < constraint.grace_period_minutes:
				continue

			prev_location = (
				prev_context.geolocation.get("lat", 0),
				prev_context.geolocation.get("lng", 0)
			)

			distance_km = self._calculate_distance(current_location, prev_location)
			if distance_km < 10:  # Same location
				continue

			time_hours = time_diff_minutes / 60
			if time_hours > 0:
				velocity_kmh = distance_km / time_hours

				if velocity_kmh > constraint.max_travel_speed_kmh:
					return {
						"satisfied": False,
						"reason": f"Velocity {velocity_kmh:.1f} km/h exceeds limit {constraint.max_travel_speed_kmh} km/h"
					}

		return {"satisfied": True, "reason": "Velocity within acceptable limits"}

	# Utility Methods

	def _generate_cache_key(self, context: AccessContext) -> str:
		"""Generate cache key for access decision"""
		key_components = [
			context.user_id,
			context.resource_id or "",
			context.action,
			context.ip_address or "",
			str(context.access_time.replace(microsecond=0, second=0))  # Round to minute
		]
		key_string = "|".join(key_components)
		return hashlib.sha256(key_string.encode()).hexdigest()[:16]

	def _store_access_context(self, context: AccessContext):
		"""Store access context for historical analysis"""
		if context.user_id not in self.access_history:
			self.access_history[context.user_id] = []

		self.access_history[context.user_id].append(context)

		# Keep only recent history (last 100 accesses)
		self.access_history[context.user_id] = self.access_history[context.user_id][-100:]

	async def _get_user_typical_locations(self, user_id: str) -> List[Tuple[float, float]]:
		"""Get user's typical access locations"""
		user_history = self.access_history.get(user_id, [])
		locations = []

		for context in user_history[-50:]:  # Last 50 accesses
			if context.geolocation:
				lat = context.geolocation.get("lat")
				lng = context.geolocation.get("lng")
				if lat and lng:
					locations.append((lat, lng))

		# Simple clustering - return unique locations with some tolerance
		# In production, use proper clustering algorithm
		unique_locations = []
		tolerance_km = 50.0  # 50km tolerance

		for loc in locations:
			is_unique = True
			for unique_loc in unique_locations:
				if self._calculate_distance(loc, unique_loc) < tolerance_km:
					is_unique = False
					break
			if is_unique:
				unique_locations.append(loc)

		return unique_locations[:5]  # Return top 5 typical locations

	def _calculate_distance(self, loc1: Tuple[float, float], loc2: Tuple[float, float]) -> float:
		"""Calculate distance between two lat/lng points in kilometers"""
		import math

		lat1, lng1 = loc1
		lat2, lng2 = loc2

		# Haversine formula
		R = 6371  # Earth's radius in kilometers
		dlat = math.radians(lat2 - lat1)
		dlng = math.radians(lng2 - lng1)
		a = (math.sin(dlat/2) * math.sin(dlat/2) +
			 math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
			 math.sin(dlng/2) * math.sin(dlng/2))
		c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
		distance = R * c

		return distance

	def _ip_in_range(self, ip_address: str, ip_range: str) -> bool:
		"""Check if IP address is in given range"""
		try:
			return ipaddress.ip_address(ip_address) in ipaddress.ip_network(ip_range, strict=False)
		except Exception as e:
			self.logger.warning(f"Failed to check IP range for '{ip_address}' in '{ip_range}': {e}")
			return False

	# Management and Query Methods

	async def get_policy_violations(
		self,
		user_id: Optional[str] = None,
		hours: int = 24
	) -> List[Dict[str, Any]]:
		"""Get recent policy violations"""
		# This would query actual violation logs in production
		# For now, return empty list
		return []

	async def get_risk_assessment_summary(
		self,
		user_id: str,
		hours: int = 24
	) -> Dict[str, Any]:
		"""Get risk assessment summary for user"""
		user_history = self.access_history.get(user_id, [])
		cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)

		recent_contexts = [
			ctx for ctx in user_history
			if ctx.access_time >= cutoff_time
		]

		if not recent_contexts:
			return {
				"user_id": user_id,
				"period_hours": hours,
				"access_count": 0,
				"average_risk_score": 0.0,
				"risk_factors": []
			}

		risk_scores = [ctx.overall_risk_score for ctx in recent_contexts]
		all_risk_factors = []
		for ctx in recent_contexts:
			all_risk_factors.extend(ctx.risk_factors)

		# Aggregate risk factors by type
		risk_factor_summary = {}
		for rf in all_risk_factors:
			factor_type = rf.factor_type
			if factor_type not in risk_factor_summary:
				risk_factor_summary[factor_type] = {
					"count": 0,
					"max_risk_score": 0.0,
					"descriptions": set()
				}

			risk_factor_summary[factor_type]["count"] += 1
			risk_factor_summary[factor_type]["max_risk_score"] = max(
				risk_factor_summary[factor_type]["max_risk_score"],
				rf.risk_score
			)
			risk_factor_summary[factor_type]["descriptions"].add(rf.description)

		# Convert descriptions set to list
		for factor_type in risk_factor_summary:
			risk_factor_summary[factor_type]["descriptions"] = list(
				risk_factor_summary[factor_type]["descriptions"]
			)

		return {
			"user_id": user_id,
			"period_hours": hours,
			"access_count": len(recent_contexts),
			"average_risk_score": sum(risk_scores) / len(risk_scores),
			"max_risk_score": max(risk_scores),
			"risk_factor_summary": risk_factor_summary,
			"unique_locations": len(set(
				(ctx.geolocation.get("country", "") if ctx.geolocation else "")
				for ctx in recent_contexts
			))
		}

	async def cleanup_expired_data(self) -> Dict[str, int]:
		"""Clean up expired decisions and old history"""
		now = datetime.now(timezone.utc)
		cleanup_stats = {"expired_decisions": 0, "old_history_entries": 0}

		# Clean expired decisions
		expired_decisions = [
			key for key, decision in self.decision_cache.items()
			if decision.expires_at and now > decision.expires_at
		]

		for key in expired_decisions:
			del self.decision_cache[key]
			cleanup_stats["expired_decisions"] += 1

		# Clean old access history (keep last 30 days)
		cutoff_time = now - timedelta(days=30)
		for user_id, history in self.access_history.items():
			original_len = len(history)
			self.access_history[user_id] = [
				ctx for ctx in history
				if ctx.access_time >= cutoff_time
			]
			cleanup_stats["old_history_entries"] += original_len - len(self.access_history[user_id])

		return cleanup_stats

	def get_statistics(self) -> Dict[str, Any]:
		"""Get contextual access control statistics"""
		total_history_entries = sum(len(history) for history in self.access_history.values())

		return {
			"time_constraints": len(self.time_constraints),
			"location_constraints": len(self.location_constraints),
			"velocity_constraints": len(self.velocity_constraints),
			"contextual_policies": len(self.policies),
			"active_policies": len([p for p in self.policies.values() if p.active]),
			"cached_decisions": len(self.decision_cache),
			"users_with_history": len(self.access_history),
			"total_history_entries": total_history_entries
		}


# Factory functions
def create_contextual_access_control(config: Optional[ContextualAccessConfig] = None) -> ContextualAccessControl:
	"""Create ContextualAccessControl instance"""
	return ContextualAccessControl(config)


def create_test_contextual_config() -> ContextualAccessConfig:
	"""Create test contextual access configuration"""
	return ContextualAccessConfig(
		decision_cache_ttl_minutes=5,
		velocity_grace_period_minutes=5,
		suspicious_location_threshold_km=100.0
	)
