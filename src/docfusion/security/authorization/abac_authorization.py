#!/usr/bin/env python3
"""
Attribute-Based Access Control (ABAC) Module

Implements fine-grained ABAC authorization with support for dynamic policies,
contextual access controls, and time/location-based restrictions.
"""

import asyncio
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone, time
from typing import Dict, List, Optional, Any, Union, Callable, Set
from enum import Enum
import logging
from ipaddress import ip_network, ip_address, AddressValueError

from pydantic import BaseModel, Field
from uuid_extensions import uuid7str

logger = logging.getLogger(__name__)


class AttributeType(str, Enum):
	"""ABAC attribute types"""
	SUBJECT = "subject"  # User attributes
	RESOURCE = "resource"  # Resource attributes
	ACTION = "action"  # Action attributes
	ENVIRONMENT = "environment"  # Environmental attributes


class PolicyEffect(str, Enum):
	"""Policy decision effects"""
	PERMIT = "Permit"
	DENY = "Deny"


class PolicyCombiningAlgorithm(str, Enum):
	"""Policy combining algorithms"""
	DENY_OVERRIDES = "deny-overrides"
	PERMIT_OVERRIDES = "permit-overrides"
	FIRST_APPLICABLE = "first-applicable"
	ONLY_ONE_APPLICABLE = "only-one-applicable"


class ComparisonOperator(str, Enum):
	"""Comparison operators for attribute matching"""
	EQUALS = "equals"
	NOT_EQUALS = "not_equals"
	GREATER_THAN = "greater_than"
	LESS_THAN = "less_than"
	GREATER_EQUAL = "greater_equal"
	LESS_EQUAL = "less_equal"
	CONTAINS = "contains"
	NOT_CONTAINS = "not_contains"
	STARTS_WITH = "starts_with"
	ENDS_WITH = "ends_with"
	REGEX_MATCH = "regex_match"
	IN_LIST = "in_list"
	NOT_IN_LIST = "not_in_list"
	IN_RANGE = "in_range"
	TIME_IN_RANGE = "time_in_range"
	DATE_IN_RANGE = "date_in_range"
	IP_IN_NETWORK = "ip_in_network"


class AttributeCondition(BaseModel):
	"""Single attribute condition"""
	attribute_type: AttributeType
	attribute_name: str
	operator: ComparisonOperator
	value: Any
	case_sensitive: bool = True
	
	# Additional parameters for specific operators
	range_min: Optional[Any] = None  # For in_range
	range_max: Optional[Any] = None  # For in_range
	pattern_flags: Optional[str] = None  # For regex_match
	
	def evaluate(self, attributes: Dict[AttributeType, Dict[str, Any]]) -> bool:
		"""Evaluate this condition against provided attributes"""
		try:
			attr_dict = attributes.get(self.attribute_type, {})
			actual_value = attr_dict.get(self.attribute_name)
			
			if actual_value is None:
				return False
			
			return self._compare_values(actual_value, self.value, self.operator)
		
		except Exception as e:
			logger.warning(f"Failed to evaluate condition: {e}")
			return False
	
	def _compare_values(self, actual: Any, expected: Any, operator: ComparisonOperator) -> bool:
		"""Compare values using the specified operator"""
		if operator == ComparisonOperator.EQUALS:
			return self._equal_check(actual, expected)
		
		elif operator == ComparisonOperator.NOT_EQUALS:
			return not self._equal_check(actual, expected)
		
		elif operator == ComparisonOperator.GREATER_THAN:
			return actual > expected
		
		elif operator == ComparisonOperator.LESS_THAN:
			return actual < expected
		
		elif operator == ComparisonOperator.GREATER_EQUAL:
			return actual >= expected
		
		elif operator == ComparisonOperator.LESS_EQUAL:
			return actual <= expected
		
		elif operator == ComparisonOperator.CONTAINS:
			return self._string_contains(actual, expected)
		
		elif operator == ComparisonOperator.NOT_CONTAINS:
			return not self._string_contains(actual, expected)
		
		elif operator == ComparisonOperator.STARTS_WITH:
			return self._string_starts_with(actual, expected)
		
		elif operator == ComparisonOperator.ENDS_WITH:
			return self._string_ends_with(actual, expected)
		
		elif operator == ComparisonOperator.REGEX_MATCH:
			return self._regex_match(actual, expected)
		
		elif operator == ComparisonOperator.IN_LIST:
			return actual in (expected if isinstance(expected, (list, tuple, set)) else [expected])
		
		elif operator == ComparisonOperator.NOT_IN_LIST:
			return actual not in (expected if isinstance(expected, (list, tuple, set)) else [expected])
		
		elif operator == ComparisonOperator.IN_RANGE:
			return self._in_range(actual, self.range_min, self.range_max)
		
		elif operator == ComparisonOperator.TIME_IN_RANGE:
			return self._time_in_range(actual, expected)
		
		elif operator == ComparisonOperator.DATE_IN_RANGE:
			return self._date_in_range(actual, expected)
		
		elif operator == ComparisonOperator.IP_IN_NETWORK:
			return self._ip_in_network(actual, expected)
		
		return False
	
	def _equal_check(self, actual: Any, expected: Any) -> bool:
		"""Case-sensitive or insensitive equality check"""
		if not self.case_sensitive and isinstance(actual, str) and isinstance(expected, str):
			return actual.lower() == expected.lower()
		return actual == expected
	
	def _string_contains(self, actual: Any, expected: Any) -> bool:
		"""String contains check"""
		actual_str = str(actual)
		expected_str = str(expected)
		if not self.case_sensitive:
			return expected_str.lower() in actual_str.lower()
		return expected_str in actual_str
	
	def _string_starts_with(self, actual: Any, expected: Any) -> bool:
		"""String starts with check"""
		actual_str = str(actual)
		expected_str = str(expected)
		if not self.case_sensitive:
			return actual_str.lower().startswith(expected_str.lower())
		return actual_str.startswith(expected_str)
	
	def _string_ends_with(self, actual: Any, expected: Any) -> bool:
		"""String ends with check"""
		actual_str = str(actual)
		expected_str = str(expected)
		if not self.case_sensitive:
			return actual_str.lower().endswith(expected_str.lower())
		return actual_str.endswith(expected_str)
	
	def _regex_match(self, actual: Any, pattern: str) -> bool:
		"""Regex pattern matching"""
		try:
			flags = 0
			if not self.case_sensitive:
				flags |= re.IGNORECASE
			if self.pattern_flags:
				if 'i' in self.pattern_flags: flags |= re.IGNORECASE
				if 'm' in self.pattern_flags: flags |= re.MULTILINE
				if 's' in self.pattern_flags: flags |= re.DOTALL
			
			return bool(re.search(pattern, str(actual), flags))
		except re.error:
			return False
	
	def _in_range(self, actual: Any, range_min: Any, range_max: Any) -> bool:
		"""Check if value is in specified range"""
		if range_min is None or range_max is None:
			return False
		return range_min <= actual <= range_max
	
	def _time_in_range(self, actual: Any, time_range: Dict[str, str]) -> bool:
		"""Check if time is in specified range"""
		try:
			if isinstance(actual, datetime):
				actual_time = actual.time()
			elif isinstance(actual, time):
				actual_time = actual
			else:
				actual_time = datetime.fromisoformat(str(actual)).time()

			start_time = datetime.strptime(time_range.get('start', '00:00'), '%H:%M').time()
			end_time = datetime.strptime(time_range.get('end', '23:59'), '%H:%M').time()

			if start_time <= end_time:
				return start_time <= actual_time <= end_time
			else:
				# Range crosses midnight
				return actual_time >= start_time or actual_time <= end_time
		except (ValueError, TypeError, KeyError, AttributeError) as e:
			logging.getLogger(__name__).warning(f"Time range evaluation failed: {e}")
			return False
	
	def _date_in_range(self, actual: Any, date_range: Dict[str, str]) -> bool:
		"""Check if date is in specified range"""
		try:
			if isinstance(actual, datetime):
				actual_date = actual.date()
			else:
				actual_date = datetime.fromisoformat(str(actual)).date()

			start_date = datetime.fromisoformat(date_range.get('start', '1900-01-01')).date()
			end_date = datetime.fromisoformat(date_range.get('end', '2100-12-31')).date()

			return start_date <= actual_date <= end_date
		except (ValueError, TypeError, KeyError, AttributeError) as e:
			logging.getLogger(__name__).warning(f"Date range evaluation failed: {e}")
			return False
	
	def _ip_in_network(self, actual: Any, network: str) -> bool:
		"""Check if IP address is in specified network"""
		try:
			return ip_address(str(actual)) in ip_network(network, strict=False)
		except AddressValueError:
			return False


class PolicyRule(BaseModel):
	"""ABAC policy rule"""
	rule_id: str = Field(default_factory=uuid7str)
	name: str
	description: Optional[str] = None
	effect: PolicyEffect
	
	# Conditions (all must be true for rule to apply)
	conditions: List[AttributeCondition] = Field(default_factory=list)
	
	# Optional target constraints
	target_subjects: Optional[List[str]] = None  # Specific subjects this rule applies to
	target_resources: Optional[List[str]] = None  # Specific resources this rule applies to
	target_actions: Optional[List[str]] = None  # Specific actions this rule applies to
	
	# Rule metadata
	priority: int = 0  # Higher priority rules are evaluated first
	enabled: bool = True
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	created_by: str = "system"
	
	# Advanced features
	obligation: Optional[Dict[str, Any]] = None  # Actions to perform if rule applies
	advice: Optional[Dict[str, Any]] = None  # Guidance if rule applies
	
	def applies_to(self, attributes: Dict[AttributeType, Dict[str, Any]]) -> bool:
		"""Check if this rule applies to the given attributes"""
		if not self.enabled:
			return False
		
		# Check target constraints
		subject_attrs = attributes.get(AttributeType.SUBJECT, {})
		resource_attrs = attributes.get(AttributeType.RESOURCE, {})
		action_attrs = attributes.get(AttributeType.ACTION, {})
		
		if self.target_subjects:
			subject_id = subject_attrs.get('id') or subject_attrs.get('user_id')
			if subject_id not in self.target_subjects:
				return False
		
		if self.target_resources:
			resource_id = resource_attrs.get('id') or resource_attrs.get('resource_id')
			if resource_id not in self.target_resources:
				return False
		
		if self.target_actions:
			action_name = action_attrs.get('name') or action_attrs.get('action')
			if action_name not in self.target_actions:
				return False
		
		# Evaluate all conditions
		return all(condition.evaluate(attributes) for condition in self.conditions)
	
	def evaluate(self, attributes: Dict[AttributeType, Dict[str, Any]]) -> Optional[PolicyEffect]:
		"""Evaluate rule and return effect if applicable"""
		if self.applies_to(attributes):
			return self.effect
		return None


class ABACPolicy(BaseModel):
	"""ABAC policy containing multiple rules"""
	policy_id: str = Field(default_factory=uuid7str)
	name: str
	description: Optional[str] = None
	version: str = "1.0"
	
	# Policy rules
	rules: List[PolicyRule] = Field(default_factory=list)
	
	# Policy combining algorithm
	combining_algorithm: PolicyCombiningAlgorithm = PolicyCombiningAlgorithm.DENY_OVERRIDES
	
	# Policy metadata
	enabled: bool = True
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	created_by: str = "system"
	
	# Policy scope
	applies_to_subjects: Optional[List[str]] = None
	applies_to_resources: Optional[List[str]] = None
	applies_to_actions: Optional[List[str]] = None
	
	def evaluate(self, attributes: Dict[AttributeType, Dict[str, Any]]) -> PolicyEffect:
		"""Evaluate policy using combining algorithm"""
		if not self.enabled:
			return PolicyEffect.DENY
		
		# Sort rules by priority (highest first)
		sorted_rules = sorted(self.rules, key=lambda r: r.priority, reverse=True)
		
		permit_found = False
		deny_found = False
		applicable_rules = []
		
		for rule in sorted_rules:
			effect = rule.evaluate(attributes)
			if effect:
				applicable_rules.append((rule, effect))
				
				if effect == PolicyEffect.PERMIT:
					permit_found = True
				elif effect == PolicyEffect.DENY:
					deny_found = True
		
		# Apply combining algorithm
		if self.combining_algorithm == PolicyCombiningAlgorithm.DENY_OVERRIDES:
			return PolicyEffect.DENY if deny_found else PolicyEffect.PERMIT if permit_found else PolicyEffect.DENY
		
		elif self.combining_algorithm == PolicyCombiningAlgorithm.PERMIT_OVERRIDES:
			return PolicyEffect.PERMIT if permit_found else PolicyEffect.DENY
		
		elif self.combining_algorithm == PolicyCombiningAlgorithm.FIRST_APPLICABLE:
			return applicable_rules[0][1] if applicable_rules else PolicyEffect.DENY
		
		elif self.combining_algorithm == PolicyCombiningAlgorithm.ONLY_ONE_APPLICABLE:
			if len(applicable_rules) == 1:
				return applicable_rules[0][1]
			elif len(applicable_rules) > 1:
				return PolicyEffect.DENY  # Indeterminate - multiple applicable rules
			else:
				return PolicyEffect.DENY
		
		return PolicyEffect.DENY


class ABACDecision(BaseModel):
	"""ABAC authorization decision"""
	decision: PolicyEffect
	applicable_policies: List[str] = Field(default_factory=list)
	applicable_rules: List[str] = Field(default_factory=list)
	
	# Decision metadata
	evaluation_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	decision_id: str = Field(default_factory=uuid7str)
	
	# Additional information
	obligations: List[Dict[str, Any]] = Field(default_factory=list)
	advice: List[Dict[str, Any]] = Field(default_factory=list)
	
	# Debugging information
	debug_info: Optional[Dict[str, Any]] = None


@dataclass
class ABACConfiguration:
	"""ABAC system configuration"""
	default_decision: PolicyEffect = PolicyEffect.DENY
	policy_combining_algorithm: PolicyCombiningAlgorithm = PolicyCombiningAlgorithm.DENY_OVERRIDES
	
	# Performance settings
	max_evaluation_time_seconds: int = 5
	cache_decisions: bool = True
	cache_ttl_seconds: int = 300
	
	# Logging settings
	log_all_decisions: bool = False
	log_denied_decisions: bool = True
	log_evaluation_details: bool = False
	
	# Environment attribute providers
	attribute_providers: Dict[str, Callable] = field(default_factory=dict)


class ABACAuthorization:
	"""Attribute-Based Access Control authorization manager"""
	
	def __init__(self, config: Optional[ABACConfiguration] = None):
		"""Initialize ABAC authorization manager"""
		self.config = config or ABACConfiguration()
		self.logger = logging.getLogger(__name__)
		
		# Policy storage (in production, use database)
		self.policies: Dict[str, ABACPolicy] = {}
		
		# Decision cache (in production, use Redis)
		self.decision_cache: Dict[str, tuple] = {}  # (decision, timestamp)
		
		# Built-in environment attribute providers
		self._setup_environment_providers()
		
		self.logger.info("ABAC authorization system initialized")
	
	def _setup_environment_providers(self):
		"""Set up built-in environment attribute providers"""
		self.config.attribute_providers.update({
			'current_time': lambda: datetime.now(timezone.utc),
			'current_date': lambda: datetime.now(timezone.utc).date(),
			'day_of_week': lambda: datetime.now(timezone.utc).weekday(),
			'hour_of_day': lambda: datetime.now(timezone.utc).hour,
			'timestamp': lambda: datetime.now(timezone.utc).timestamp()
		})
	
	async def evaluate_access(
		self,
		subject_attributes: Dict[str, Any],
		resource_attributes: Dict[str, Any],
		action_attributes: Dict[str, Any],
		environment_attributes: Optional[Dict[str, Any]] = None
	) -> ABACDecision:
		"""Evaluate access request using ABAC policies"""
		try:
			# Prepare attributes
			attributes = {
				AttributeType.SUBJECT: subject_attributes,
				AttributeType.RESOURCE: resource_attributes,
				AttributeType.ACTION: action_attributes,
				AttributeType.ENVIRONMENT: environment_attributes or {}
			}
			
			# Add environment attributes from providers
			for attr_name, provider in self.config.attribute_providers.items():
				try:
					attributes[AttributeType.ENVIRONMENT][attr_name] = provider()
				except Exception as e:
					self.logger.warning(f"Failed to get environment attribute {attr_name}: {e}")
			
			# Check cache
			cache_key = self._generate_cache_key(attributes)
			if self.config.cache_decisions and cache_key in self.decision_cache:
				cached_decision, cached_time = self.decision_cache[cache_key]
				if datetime.now(timezone.utc).timestamp() - cached_time < self.config.cache_ttl_seconds:
					return cached_decision
			
			# Evaluate policies
			start_time = datetime.now(timezone.utc)
			decision = await self._evaluate_policies(attributes)
			evaluation_time = (datetime.now(timezone.utc) - start_time).total_seconds()
			
			# Check evaluation time limit
			if evaluation_time > self.config.max_evaluation_time_seconds:
				self.logger.warning(f"Policy evaluation took {evaluation_time:.2f}s (limit: {self.config.max_evaluation_time_seconds}s)")
			
			# Cache decision
			if self.config.cache_decisions:
				self.decision_cache[cache_key] = (decision, datetime.now(timezone.utc).timestamp())
			
			# Log decision
			if self.config.log_all_decisions or (self.config.log_denied_decisions and decision.decision == PolicyEffect.DENY):
				self._log_decision(decision, attributes, evaluation_time)
			
			return decision
		
		except Exception as e:
			self.logger.error(f"ABAC evaluation error: {e}")
			return ABACDecision(
				decision=self.config.default_decision,
				debug_info={'error': str(e)}
			)
	
	async def _evaluate_policies(self, attributes: Dict[AttributeType, Dict[str, Any]]) -> ABACDecision:
		"""Evaluate all applicable policies"""
		applicable_policies = []
		applicable_rules = []
		obligations = []
		advice = []
		
		permit_found = False
		deny_found = False
		
		# Evaluate each policy
		for policy_id, policy in self.policies.items():
			if not policy.enabled:
				continue
			
			# Check if policy applies to this request
			if not self._policy_applies(policy, attributes):
				continue
			
			# Evaluate policy
			policy_decision = policy.evaluate(attributes)
			
			if policy_decision == PolicyEffect.PERMIT:
				permit_found = True
			elif policy_decision == PolicyEffect.DENY:
				deny_found = True
			
			applicable_policies.append(policy_id)
			
			# Collect obligations and advice from applicable rules
			for rule in policy.rules:
				if rule.applies_to(attributes):
					applicable_rules.append(rule.rule_id)
					
					if rule.obligation:
						obligations.append(rule.obligation)
					if rule.advice:
						advice.append(rule.advice)
		
		# Apply global combining algorithm
		if self.config.policy_combining_algorithm == PolicyCombiningAlgorithm.DENY_OVERRIDES:
			final_decision = PolicyEffect.DENY if deny_found else PolicyEffect.PERMIT if permit_found else self.config.default_decision
		elif self.config.policy_combining_algorithm == PolicyCombiningAlgorithm.PERMIT_OVERRIDES:
			final_decision = PolicyEffect.PERMIT if permit_found else PolicyEffect.DENY
		else:
			final_decision = self.config.default_decision
		
		return ABACDecision(
			decision=final_decision,
			applicable_policies=applicable_policies,
			applicable_rules=applicable_rules,
			obligations=obligations,
			advice=advice,
			debug_info={
				'permit_found': permit_found,
				'deny_found': deny_found,
				'policies_evaluated': len(applicable_policies)
			} if self.config.log_evaluation_details else None
		)
	
	def _policy_applies(self, policy: ABACPolicy, attributes: Dict[AttributeType, Dict[str, Any]]) -> bool:
		"""Check if policy applies to the given attributes"""
		subject_attrs = attributes.get(AttributeType.SUBJECT, {})
		resource_attrs = attributes.get(AttributeType.RESOURCE, {})
		action_attrs = attributes.get(AttributeType.ACTION, {})
		
		# Check policy scope
		if policy.applies_to_subjects:
			subject_id = subject_attrs.get('id') or subject_attrs.get('user_id')
			if subject_id not in policy.applies_to_subjects:
				return False
		
		if policy.applies_to_resources:
			resource_id = resource_attrs.get('id') or resource_attrs.get('resource_id')
			if resource_id not in policy.applies_to_resources:
				return False
		
		if policy.applies_to_actions:
			action_name = action_attrs.get('name') or action_attrs.get('action')
			if action_name not in policy.applies_to_actions:
				return False
		
		return True
	
	def _generate_cache_key(self, attributes: Dict[AttributeType, Dict[str, Any]]) -> str:
		"""Generate cache key for decision caching"""
		import hashlib
		import json
		
		# Create deterministic representation
		cache_data = {}
		for attr_type, attr_dict in attributes.items():
			cache_data[attr_type.value] = dict(sorted(attr_dict.items()))
		
		cache_str = json.dumps(cache_data, sort_keys=True, default=str)
		return hashlib.md5(cache_str.encode()).hexdigest()
	
	def _log_decision(self, decision: ABACDecision, attributes: Dict[AttributeType, Dict[str, Any]], evaluation_time: float):
		"""Log authorization decision"""
		subject = attributes.get(AttributeType.SUBJECT, {})
		resource = attributes.get(AttributeType.RESOURCE, {})
		action = attributes.get(AttributeType.ACTION, {})
		
		self.logger.info(
			f"ABAC Decision: {decision.decision.value} | "
			f"User: {subject.get('user_id', 'unknown')} | "
			f"Resource: {resource.get('resource_id', 'unknown')} | "
			f"Action: {action.get('action', 'unknown')} | "
			f"Time: {evaluation_time:.3f}s | "
			f"Policies: {len(decision.applicable_policies)} | "
			f"Rules: {len(decision.applicable_rules)}"
		)
	
	# Policy Management Methods
	
	def add_policy(self, policy: ABACPolicy) -> str:
		"""Add new ABAC policy"""
		self.policies[policy.policy_id] = policy
		self.logger.info(f"Added ABAC policy: {policy.name} ({policy.policy_id})")
		return policy.policy_id
	
	def update_policy(self, policy_id: str, policy: ABACPolicy) -> bool:
		"""Update existing ABAC policy"""
		if policy_id in self.policies:
			self.policies[policy_id] = policy
			self.logger.info(f"Updated ABAC policy: {policy.name} ({policy_id})")
			return True
		return False
	
	def remove_policy(self, policy_id: str) -> bool:
		"""Remove ABAC policy"""
		if policy_id in self.policies:
			policy = self.policies.pop(policy_id)
			self.logger.info(f"Removed ABAC policy: {policy.name} ({policy_id})")
			return True
		return False
	
	def get_policy(self, policy_id: str) -> Optional[ABACPolicy]:
		"""Get ABAC policy by ID"""
		return self.policies.get(policy_id)
	
	def list_policies(self, enabled_only: bool = False) -> List[ABACPolicy]:
		"""List all ABAC policies"""
		policies = list(self.policies.values())
		if enabled_only:
			policies = [p for p in policies if p.enabled]
		return sorted(policies, key=lambda p: p.name)
	
	# Rule Management Methods
	
	def add_rule_to_policy(self, policy_id: str, rule: PolicyRule) -> bool:
		"""Add rule to existing policy"""
		policy = self.policies.get(policy_id)
		if policy:
			policy.rules.append(rule)
			self.logger.info(f"Added rule to policy {policy_id}: {rule.name}")
			return True
		return False
	
	def remove_rule_from_policy(self, policy_id: str, rule_id: str) -> bool:
		"""Remove rule from policy"""
		policy = self.policies.get(policy_id)
		if policy:
			policy.rules = [r for r in policy.rules if r.rule_id != rule_id]
			self.logger.info(f"Removed rule {rule_id} from policy {policy_id}")
			return True
		return False
	
	# Utility Methods
	
	def create_time_based_rule(
		self,
		name: str,
		effect: PolicyEffect,
		start_time: str = "09:00",
		end_time: str = "17:00",
		days_of_week: Optional[List[int]] = None  # 0=Monday, 6=Sunday
	) -> PolicyRule:
		"""Create time-based access rule"""
		conditions = [
			AttributeCondition(
				attribute_type=AttributeType.ENVIRONMENT,
				attribute_name="current_time",
				operator=ComparisonOperator.TIME_IN_RANGE,
				value={"start": start_time, "end": end_time}
			)
		]
		
		if days_of_week:
			conditions.append(
				AttributeCondition(
					attribute_type=AttributeType.ENVIRONMENT,
					attribute_name="day_of_week",
					operator=ComparisonOperator.IN_LIST,
					value=days_of_week
				)
			)
		
		return PolicyRule(
			name=name,
			effect=effect,
			conditions=conditions
		)
	
	def create_location_based_rule(
		self,
		name: str,
		effect: PolicyEffect,
		allowed_networks: List[str]
	) -> PolicyRule:
		"""Create location/IP-based access rule"""
		conditions = []
		
		for network in allowed_networks:
			conditions.append(
				AttributeCondition(
					attribute_type=AttributeType.ENVIRONMENT,
					attribute_name="client_ip",
					operator=ComparisonOperator.IP_IN_NETWORK,
					value=network
				)
			)
		
		# If multiple networks, create OR logic by making separate rules
		# For now, create single rule with first network
		return PolicyRule(
			name=name,
			effect=effect,
			conditions=[conditions[0]] if conditions else []
		)
	
	def create_role_based_rule(
		self,
		name: str,
		effect: PolicyEffect,
		required_roles: List[str],
		resource_types: Optional[List[str]] = None,
		actions: Optional[List[str]] = None
	) -> PolicyRule:
		"""Create role-based access rule"""
		conditions = [
			AttributeCondition(
				attribute_type=AttributeType.SUBJECT,
				attribute_name="roles",
				operator=ComparisonOperator.IN_LIST,
				value=required_roles
			)
		]
		
		rule = PolicyRule(
			name=name,
			effect=effect,
			conditions=conditions
		)
		
		if resource_types:
			rule.target_resources = resource_types
		if actions:
			rule.target_actions = actions
		
		return rule
	
	async def clear_decision_cache(self):
		"""Clear decision cache"""
		self.decision_cache.clear()
		self.logger.info("ABAC decision cache cleared")
	
	async def get_statistics(self) -> Dict[str, Any]:
		"""Get ABAC system statistics"""
		total_policies = len(self.policies)
		enabled_policies = len([p for p in self.policies.values() if p.enabled])
		total_rules = sum(len(p.rules) for p in self.policies.values())
		
		return {
			'total_policies': total_policies,
			'enabled_policies': enabled_policies,
			'total_rules': total_rules,
			'cache_size': len(self.decision_cache),
			'default_decision': self.config.default_decision.value
		}


# Factory functions
def create_abac_authorization(config: Optional[ABACConfiguration] = None) -> ABACAuthorization:
	"""Create ABACAuthorization instance"""
	return ABACAuthorization(config)


def create_sample_abac_policies() -> List[ABACPolicy]:
	"""Create sample ABAC policies for testing"""
	policies = []
	
	# Business hours policy
	business_hours_rule = PolicyRule(
		name="Business Hours Access",
		effect=PolicyEffect.PERMIT,
		conditions=[
			AttributeCondition(
				attribute_type=AttributeType.ENVIRONMENT,
				attribute_name="hour_of_day",
				operator=ComparisonOperator.IN_RANGE,
				value=None,
				range_min=9,
				range_max=17
			),
			AttributeCondition(
				attribute_type=AttributeType.ENVIRONMENT,
				attribute_name="day_of_week",
				operator=ComparisonOperator.IN_LIST,
				value=[0, 1, 2, 3, 4]  # Monday to Friday
			)
		]
	)
	
	business_hours_policy = ABACPolicy(
		name="Business Hours Policy",
		description="Allow access during business hours only",
		rules=[business_hours_rule]
	)
	
	policies.append(business_hours_policy)
	
	# Admin access policy
	admin_rule = PolicyRule(
		name="Administrator Access",
		effect=PolicyEffect.PERMIT,
		conditions=[
			AttributeCondition(
				attribute_type=AttributeType.SUBJECT,
				attribute_name="roles",
				operator=ComparisonOperator.CONTAINS,
				value="admin"
			)
		]
	)
	
	admin_policy = ABACPolicy(
		name="Administrator Policy",
		description="Full access for administrators",
		combining_algorithm=PolicyCombiningAlgorithm.PERMIT_OVERRIDES,
		rules=[admin_rule]
	)
	
	policies.append(admin_policy)
	
	return policies