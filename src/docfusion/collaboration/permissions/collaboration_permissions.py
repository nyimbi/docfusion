"""
Collaboration permissions management for fine-grained access control.

This module provides section-level editing permissions, role-based collaboration
controls, dynamic permission management, and permission inheritance.
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Union

from pydantic import BaseModel, Field, ConfigDict

def uuid7str():
	"""Generate a UUID7-like string using UUID4 for compatibility."""
	return str(uuid.uuid4())


logger = logging.getLogger(__name__)


class Permission(str, Enum):
	"""Available collaboration permissions."""
	READ = "read"
	WRITE = "write"
	COMMENT = "comment"
	REVIEW = "review"
	APPROVE = "approve"
	DELETE = "delete"
	SHARE = "share"
	ADMIN = "admin"
	MERGE = "merge"
	BRANCH = "branch"
	EXPORT = "export"
	TEMPLATE = "template"


class PermissionScope(str, Enum):
	"""Scope of permission application."""
	DOCUMENT = "document"
	SECTION = "section"
	PARAGRAPH = "paragraph"
	SENTENCE = "sentence"
	SELECTION = "selection"


class PermissionEffect(str, Enum):
	"""Effect of permission rule."""
	ALLOW = "allow"
	DENY = "deny"
	INHERIT = "inherit"


class ConditionType(str, Enum):
	"""Types of permission conditions."""
	TIME_BASED = "time_based"
	LOCATION_BASED = "location_based"
	ROLE_BASED = "role_based"
	CONTENT_BASED = "content_based"
	WORKFLOW_BASED = "workflow_based"
	USER_BASED = "user_based"


class PermissionGrant(BaseModel):
	"""Individual permission grant record."""
	model_config = ConfigDict(extra='forbid')
	
	grant_id: str = Field(default_factory=uuid7str)
	user_id: str = Field(description="User receiving permission")
	permission: Permission = Field(description="Permission being granted")
	scope: PermissionScope = Field(description="Scope of permission")
	target_id: str = Field(description="Target resource ID (document, section, etc.)")
	effect: PermissionEffect = Field(description="Allow, deny, or inherit")
	granted_by: str = Field(description="User who granted permission")
	granted_at: datetime = Field(default_factory=datetime.now)
	expires_at: Optional[datetime] = Field(None, description="Permission expiration")
	conditions: Dict[str, Any] = Field(default_factory=dict, description="Conditional requirements")
	priority: int = Field(100, description="Priority for conflict resolution")
	reason: Optional[str] = Field(None, description="Reason for permission grant")


class PermissionRule(BaseModel):
	"""Dynamic permission rule definition."""
	model_config = ConfigDict(extra='forbid')
	
	rule_id: str = Field(default_factory=uuid7str)
	name: str = Field(description="Human-readable rule name")
	description: str = Field(description="Rule description")
	condition_type: ConditionType = Field(description="Type of condition")
	condition_data: Dict[str, Any] = Field(description="Condition parameters")
	permissions: Set[Permission] = Field(description="Permissions affected by rule")
	effect: PermissionEffect = Field(description="Effect when condition is met")
	priority: int = Field(100, description="Rule priority")
	is_active: bool = Field(True, description="Whether rule is active")
	created_by: str = Field(description="User who created rule")
	created_at: datetime = Field(default_factory=datetime.now)


class UserPermissions(BaseModel):
	"""User's effective permissions for a resource."""
	model_config = ConfigDict(extra='forbid')
	
	user_id: str = Field(description="User identifier")
	target_id: str = Field(description="Target resource ID")
	scope: PermissionScope = Field(description="Permission scope")
	effective_permissions: Set[Permission] = Field(description="Computed effective permissions")
	inherited_permissions: Set[Permission] = Field(default_factory=set)
	explicit_grants: List[PermissionGrant] = Field(default_factory=list)
	applied_rules: List[str] = Field(default_factory=list, description="Rule IDs that applied")
	last_computed: datetime = Field(default_factory=datetime.now)
	cache_ttl: int = Field(300, description="Cache TTL in seconds")


class SectionPermissions(BaseModel):
	"""Permissions configuration for a document section."""
	model_config = ConfigDict(extra='forbid')
	
	section_id: str = Field(description="Section identifier")
	document_id: str = Field(description="Parent document ID")
	section_path: str = Field(description="Hierarchical section path")
	default_permissions: Set[Permission] = Field(description="Default permissions for section")
	user_permissions: Dict[str, Set[Permission]] = Field(default_factory=dict)
	inherit_from_parent: bool = Field(True, description="Whether to inherit parent permissions")
	permission_overrides: List[PermissionGrant] = Field(default_factory=list)
	locked_by: Optional[str] = Field(None, description="User who has exclusive lock")
	locked_until: Optional[datetime] = Field(None, description="Lock expiration")
	requires_approval: bool = Field(False, description="Whether changes need approval")


@dataclass
class PermissionContext:
	"""Context information for permission evaluation."""
	user_id: str
	target_id: str
	scope: PermissionScope
	request_time: datetime = field(default_factory=datetime.now)
	user_roles: Set[str] = field(default_factory=set)
	user_location: Optional[str] = None
	request_ip: Optional[str] = None
	session_id: Optional[str] = None
	workflow_state: Optional[str] = None
	additional_context: Dict[str, Any] = field(default_factory=dict)


class CollaborationPermissions:
	"""
	Comprehensive collaboration permissions management system.
	
	Provides section-level editing permissions, role-based controls,
	dynamic permission rules, and hierarchical permission inheritance.
	"""
	
	def __init__(self):
		self.permission_grants: Dict[str, PermissionGrant] = {}  # grant_id -> grant
		self.permission_rules: Dict[str, PermissionRule] = {}  # rule_id -> rule
		self.user_permissions_cache: Dict[str, UserPermissions] = {}  # cache_key -> permissions
		self.section_permissions: Dict[str, SectionPermissions] = {}  # section_id -> permissions
		self.document_permissions: Dict[str, Set[Permission]] = {}  # document_id -> default permissions
		self.permission_subscribers: List[callable] = []
		self._lock = asyncio.Lock()
		
		# Default permission hierarchy
		self.permission_hierarchy = {
			Permission.ADMIN: {Permission.SHARE, Permission.DELETE, Permission.APPROVE, Permission.MERGE, Permission.BRANCH},
			Permission.APPROVE: {Permission.REVIEW, Permission.COMMENT},
			Permission.REVIEW: {Permission.COMMENT, Permission.READ},
			Permission.WRITE: {Permission.READ},
			Permission.MERGE: {Permission.WRITE, Permission.READ},
			Permission.BRANCH: {Permission.WRITE, Permission.READ},
			Permission.SHARE: {Permission.READ},
			Permission.DELETE: {Permission.WRITE, Permission.READ},
			Permission.EXPORT: {Permission.READ},
			Permission.TEMPLATE: {Permission.READ}
		}
		
		logger.info("CollaborationPermissions initialized")
	
	async def grant_permission(
		self,
		user_id: str,
		permission: Permission,
		scope: PermissionScope,
		target_id: str,
		granted_by: str,
		effect: PermissionEffect = PermissionEffect.ALLOW,
		expires_at: Optional[datetime] = None,
		conditions: Optional[Dict[str, Any]] = None,
		reason: Optional[str] = None,
		priority: int = 100
	) -> PermissionGrant:
		"""
		Grant permission to a user for a specific resource.
		
		Args:
			user_id: User receiving permission
			permission: Permission to grant
			scope: Scope of permission
			target_id: Target resource ID
			granted_by: User granting permission
			effect: Allow, deny, or inherit
			expires_at: Permission expiration time
			conditions: Conditional requirements
			reason: Reason for granting
			priority: Priority for conflict resolution
			
		Returns:
			PermissionGrant: Created permission grant
		"""
		async with self._lock:
			grant = PermissionGrant(
				user_id=user_id,
				permission=permission,
				scope=scope,
				target_id=target_id,
				effect=effect,
				granted_by=granted_by,
				expires_at=expires_at,
				conditions=conditions or {},
				reason=reason,
				priority=priority
			)
			
			self.permission_grants[grant.grant_id] = grant
			
			# Invalidate cache for affected user
			await self._invalidate_user_cache(user_id, target_id, scope)
			
			logger.info(f"Granted {permission.value} permission to user {user_id} for {target_id}")
			
			# Notify subscribers
			await self._notify_permission_change("permission_granted", grant)
			
			return grant
	
	async def revoke_permission(
		self,
		grant_id: str,
		revoked_by: str,
		reason: Optional[str] = None
	) -> bool:
		"""
		Revoke a specific permission grant.
		
		Args:
			grant_id: Permission grant ID to revoke
			revoked_by: User revoking permission
			reason: Reason for revocation
			
		Returns:
			bool: True if permission was revoked
		"""
		async with self._lock:
			if grant_id not in self.permission_grants:
				logger.warning(f"Permission grant {grant_id} not found for revocation")
				return False
			
			grant = self.permission_grants[grant_id]
			user_id = grant.user_id
			target_id = grant.target_id
			scope = grant.scope
			
			del self.permission_grants[grant_id]
			
			# Invalidate cache
			await self._invalidate_user_cache(user_id, target_id, scope)
			
			logger.info(f"Revoked permission grant {grant_id} by {revoked_by}")
			
			# Notify subscribers
			await self._notify_permission_change("permission_revoked", grant, {
				"revoked_by": revoked_by,
				"reason": reason
			})
			
			return True
	
	async def check_permission(
		self,
		user_id: str,
		permission: Permission,
		target_id: str,
		scope: PermissionScope = PermissionScope.DOCUMENT,
		context: Optional[PermissionContext] = None
	) -> bool:
		"""
		Check if user has specific permission for a resource.
		
		Args:
			user_id: User to check
			permission: Permission to check
			target_id: Target resource ID
			scope: Permission scope
			context: Additional context for evaluation
			
		Returns:
			bool: True if user has permission
		"""
		if not context:
			context = PermissionContext(user_id=user_id, target_id=target_id, scope=scope)
		
		user_perms = await self.get_user_permissions(user_id, target_id, scope, context)
		
		# Check direct permission or implied permissions
		if permission in user_perms.effective_permissions:
			return True
		
		# Check permission hierarchy
		for perm in user_perms.effective_permissions:
			if permission in self.permission_hierarchy.get(perm, set()):
				return True
		
		return False
	
	async def get_user_permissions(
		self,
		user_id: str,
		target_id: str,
		scope: PermissionScope = PermissionScope.DOCUMENT,
		context: Optional[PermissionContext] = None
	) -> UserPermissions:
		"""
		Get effective permissions for a user on a resource.
		
		Args:
			user_id: User identifier
			target_id: Target resource ID
			scope: Permission scope
			context: Additional context for evaluation
			
		Returns:
			UserPermissions: User's effective permissions
		"""
		cache_key = f"{user_id}:{target_id}:{scope.value}"
		
		# Check cache
		if cache_key in self.user_permissions_cache:
			cached_perms = self.user_permissions_cache[cache_key]
			if (datetime.now() - cached_perms.last_computed).total_seconds() < cached_perms.cache_ttl:
				return cached_perms
		
		# Compute permissions
		if not context:
			context = PermissionContext(user_id=user_id, target_id=target_id, scope=scope)
		
		user_permissions = await self._compute_user_permissions(context)
		
		# Cache result
		self.user_permissions_cache[cache_key] = user_permissions
		
		return user_permissions
	
	async def create_permission_rule(
		self,
		name: str,
		description: str,
		condition_type: ConditionType,
		condition_data: Dict[str, Any],
		permissions: Set[Permission],
		effect: PermissionEffect,
		created_by: str,
		priority: int = 100
	) -> PermissionRule:
		"""
		Create dynamic permission rule.
		
		Args:
			name: Rule name
			description: Rule description
			condition_type: Type of condition
			condition_data: Condition parameters
			permissions: Affected permissions
			effect: Effect when condition is met
			created_by: User creating rule
			priority: Rule priority
			
		Returns:
			PermissionRule: Created permission rule
		"""
		async with self._lock:
			rule = PermissionRule(
				name=name,
				description=description,
				condition_type=condition_type,
				condition_data=condition_data,
				permissions=permissions,
				effect=effect,
				priority=priority,
				created_by=created_by
			)
			
			self.permission_rules[rule.rule_id] = rule
			
			# Clear all permission caches since rules may affect many users
			self.user_permissions_cache.clear()
			
			logger.info(f"Created permission rule: {name}")
			
			# Notify subscribers
			await self._notify_permission_change("rule_created", rule)
			
			return rule
	
	async def configure_section_permissions(
		self,
		section_id: str,
		document_id: str,
		section_path: str,
		default_permissions: Set[Permission],
		inherit_from_parent: bool = True,
		requires_approval: bool = False
	) -> SectionPermissions:
		"""
		Configure permissions for a document section.
		
		Args:
			section_id: Section identifier
			document_id: Parent document ID
			section_path: Hierarchical section path
			default_permissions: Default permissions for section
			inherit_from_parent: Whether to inherit parent permissions
			requires_approval: Whether changes need approval
			
		Returns:
			SectionPermissions: Configured section permissions
		"""
		async with self._lock:
			section_perms = SectionPermissions(
				section_id=section_id,
				document_id=document_id,
				section_path=section_path,
				default_permissions=default_permissions,
				inherit_from_parent=inherit_from_parent,
				requires_approval=requires_approval
			)
			
			self.section_permissions[section_id] = section_perms
			
			logger.info(f"Configured permissions for section {section_id}")
			
			return section_perms
	
	async def lock_section(
		self,
		section_id: str,
		user_id: str,
		lock_duration_minutes: int = 30
	) -> bool:
		"""
		Acquire exclusive lock on a section.
		
		Args:
			section_id: Section to lock
			user_id: User acquiring lock
			lock_duration_minutes: Lock duration in minutes
			
		Returns:
			bool: True if lock was acquired
		"""
		async with self._lock:
			if section_id not in self.section_permissions:
				logger.warning(f"Section {section_id} not found for locking")
				return False
			
			section_perms = self.section_permissions[section_id]
			
			# Check if already locked by someone else
			if (section_perms.locked_by and 
				section_perms.locked_by != user_id and
				section_perms.locked_until and
				datetime.now() < section_perms.locked_until):
				logger.info(f"Section {section_id} already locked by {section_perms.locked_by}")
				return False
			
			# Acquire lock
			section_perms.locked_by = user_id
			section_perms.locked_until = datetime.now() + timedelta(minutes=lock_duration_minutes)
			
			logger.info(f"Section {section_id} locked by {user_id} for {lock_duration_minutes} minutes")
			
			# Notify subscribers
			await self._notify_permission_change("section_locked", section_perms, {
				"locked_by": user_id,
				"duration_minutes": lock_duration_minutes
			})
			
			return True
	
	async def unlock_section(
		self,
		section_id: str,
		user_id: str,
		force: bool = False
	) -> bool:
		"""
		Release lock on a section.
		
		Args:
			section_id: Section to unlock
			user_id: User releasing lock
			force: Force unlock even if not lock owner
			
		Returns:
			bool: True if lock was released
		"""
		async with self._lock:
			if section_id not in self.section_permissions:
				return False
			
			section_perms = self.section_permissions[section_id]
			
			# Check lock ownership
			if not force and section_perms.locked_by != user_id:
				logger.warning(f"User {user_id} cannot unlock section {section_id} owned by {section_perms.locked_by}")
				return False
			
			section_perms.locked_by = None
			section_perms.locked_until = None
			
			logger.info(f"Section {section_id} unlocked by {user_id}")
			
			# Notify subscribers
			await self._notify_permission_change("section_unlocked", section_perms, {
				"unlocked_by": user_id,
				"force": force
			})
			
			return True
	
	async def get_section_permissions(self, section_id: str) -> Optional[SectionPermissions]:
		"""
		Get permissions configuration for a section.
		
		Args:
			section_id: Section identifier
			
		Returns:
			Optional[SectionPermissions]: Section permissions if found
		"""
		return self.section_permissions.get(section_id)
	
	async def get_user_accessible_sections(
		self,
		user_id: str,
		document_id: str,
		required_permission: Permission = Permission.READ
	) -> List[str]:
		"""
		Get sections accessible to a user with specified permission.
		
		Args:
			user_id: User identifier
			document_id: Document identifier
			required_permission: Required permission level
			
		Returns:
			List[str]: Accessible section IDs
		"""
		accessible_sections = []
		
		for section_id, section_perms in self.section_permissions.items():
			if section_perms.document_id != document_id:
				continue
			
			has_permission = await self.check_permission(
				user_id=user_id,
				permission=required_permission,
				target_id=section_id,
				scope=PermissionScope.SECTION
			)
			
			if has_permission:
				accessible_sections.append(section_id)
		
		return accessible_sections
	
	async def get_permission_audit_log(
		self,
		target_id: Optional[str] = None,
		user_id: Optional[str] = None,
		start_time: Optional[datetime] = None,
		end_time: Optional[datetime] = None
	) -> List[Dict[str, Any]]:
		"""
		Get permission audit log with filtering.
		
		Args:
			target_id: Filter by target resource
			user_id: Filter by user
			start_time: Filter by start time
			end_time: Filter by end time
			
		Returns:
			List[Dict[str, Any]]: Audit log entries
		"""
		audit_entries = []
		
		for grant in self.permission_grants.values():
			# Apply filters
			if target_id and grant.target_id != target_id:
				continue
			if user_id and grant.user_id != user_id:
				continue
			if start_time and grant.granted_at < start_time:
				continue
			if end_time and grant.granted_at > end_time:
				continue
			
			audit_entries.append({
				"grant_id": grant.grant_id,
				"user_id": grant.user_id,
				"permission": grant.permission.value,
				"scope": grant.scope.value,
				"target_id": grant.target_id,
				"effect": grant.effect.value,
				"granted_by": grant.granted_by,
				"granted_at": grant.granted_at.isoformat(),
				"expires_at": grant.expires_at.isoformat() if grant.expires_at else None,
				"reason": grant.reason
			})
		
		# Sort by granted_at descending
		audit_entries.sort(key=lambda x: x["granted_at"], reverse=True)
		
		return audit_entries
	
	async def subscribe_to_permission_changes(self, callback: callable) -> str:
		"""
		Subscribe to permission change notifications.
		
		Args:
			callback: Callback function for permission events
			
		Returns:
			str: Subscription ID
		"""
		self.permission_subscribers.append(callback)
		subscription_id = uuid7str()
		logger.info("New permission change subscription added")
		return subscription_id
	
	async def unsubscribe_from_permission_changes(self, callback: callable) -> bool:
		"""
		Unsubscribe from permission change notifications.
		
		Args:
			callback: Callback function to remove
			
		Returns:
			bool: True if subscription was removed
		"""
		try:
			self.permission_subscribers.remove(callback)
			return True
		except ValueError:
			return False
	
	async def _compute_user_permissions(self, context: PermissionContext) -> UserPermissions:
		"""Compute effective permissions for a user."""
		effective_permissions: Set[Permission] = set()
		inherited_permissions: Set[Permission] = set()
		explicit_grants: List[PermissionGrant] = []
		applied_rules: List[str] = []
		
		# Get explicit grants
		for grant in self.permission_grants.values():
			if (grant.user_id == context.user_id and 
				grant.target_id == context.target_id and
				grant.scope == context.scope):
				
				# Check if grant is still valid
				if grant.expires_at and datetime.now() > grant.expires_at:
					continue
				
				# Check conditions
				if await self._evaluate_grant_conditions(grant, context):
					explicit_grants.append(grant)
					
					if grant.effect == PermissionEffect.ALLOW:
						effective_permissions.add(grant.permission)
					elif grant.effect == PermissionEffect.DENY:
						effective_permissions.discard(grant.permission)
		
		# Apply dynamic rules
		for rule in self.permission_rules.values():
			if not rule.is_active:
				continue
			
			if await self._evaluate_rule_condition(rule, context):
				applied_rules.append(rule.rule_id)
				
				if rule.effect == PermissionEffect.ALLOW:
					effective_permissions.update(rule.permissions)
				elif rule.effect == PermissionEffect.DENY:
					effective_permissions -= rule.permissions
		
		# Handle inheritance for sections
		if context.scope == PermissionScope.SECTION:
			section_perms = self.section_permissions.get(context.target_id)
			if section_perms and section_perms.inherit_from_parent:
				# Get document permissions
				parent_context = PermissionContext(
					user_id=context.user_id,
					target_id=section_perms.document_id,
					scope=PermissionScope.DOCUMENT,
					user_roles=context.user_roles
				)
				parent_perms = await self._compute_user_permissions(parent_context)
				inherited_permissions.update(parent_perms.effective_permissions)
				effective_permissions.update(inherited_permissions)
		
		return UserPermissions(
			user_id=context.user_id,
			target_id=context.target_id,
			scope=context.scope,
			effective_permissions=effective_permissions,
			inherited_permissions=inherited_permissions,
			explicit_grants=explicit_grants,
			applied_rules=applied_rules
		)
	
	async def _evaluate_grant_conditions(
		self,
		grant: PermissionGrant,
		context: PermissionContext
	) -> bool:
		"""Evaluate conditional requirements for a permission grant."""
		if not grant.conditions:
			return True
		
		# Time-based conditions
		if "time_restrictions" in grant.conditions:
			time_restrictions = grant.conditions["time_restrictions"]
			current_hour = context.request_time.hour
			
			if "allowed_hours" in time_restrictions:
				allowed_hours = time_restrictions["allowed_hours"]
				if current_hour not in allowed_hours:
					return False
			
			if "allowed_days" in time_restrictions:
				allowed_days = time_restrictions["allowed_days"]
				current_day = context.request_time.weekday()
				if current_day not in allowed_days:
					return False
		
		# Location-based conditions
		if "location_restrictions" in grant.conditions:
			location_restrictions = grant.conditions["location_restrictions"]
			
			if "allowed_locations" in location_restrictions:
				allowed_locations = location_restrictions["allowed_locations"]
				if context.user_location not in allowed_locations:
					return False
		
		# Role-based conditions
		if "required_roles" in grant.conditions:
			required_roles = set(grant.conditions["required_roles"])
			if not required_roles.intersection(context.user_roles):
				return False
		
		return True
	
	async def _evaluate_rule_condition(
		self,
		rule: PermissionRule,
		context: PermissionContext
	) -> bool:
		"""Evaluate condition for a permission rule."""
		condition_type = rule.condition_type
		condition_data = rule.condition_data
		
		if condition_type == ConditionType.TIME_BASED:
			current_hour = context.request_time.hour
			if "business_hours_only" in condition_data and condition_data["business_hours_only"]:
				return 9 <= current_hour <= 17
		
		elif condition_type == ConditionType.ROLE_BASED:
			required_roles = set(condition_data.get("required_roles", []))
			return bool(required_roles.intersection(context.user_roles))
		
		elif condition_type == ConditionType.WORKFLOW_BASED:
			required_state = condition_data.get("required_workflow_state")
			return context.workflow_state == required_state
		
		elif condition_type == ConditionType.USER_BASED:
			allowed_users = set(condition_data.get("allowed_users", []))
			return context.user_id in allowed_users
		
		return True
	
	async def _invalidate_user_cache(
		self,
		user_id: str,
		target_id: str,
		scope: PermissionScope
	):
		"""Invalidate cached permissions for a user."""
		cache_key = f"{user_id}:{target_id}:{scope.value}"
		if cache_key in self.user_permissions_cache:
			del self.user_permissions_cache[cache_key]
	
	async def _notify_permission_change(
		self,
		event_type: str,
		data: Any,
		additional_data: Optional[Dict[str, Any]] = None
	):
		"""Notify subscribers of permission changes."""
		event_data = {
			"event_type": event_type,
			"data": data,
			"timestamp": datetime.now().isoformat()
		}
		
		if additional_data:
			event_data.update(additional_data)
		
		for callback in self.permission_subscribers:
			try:
				if asyncio.iscoroutinefunction(callback):
					await callback(event_data)
				else:
					callback(event_data)
			except Exception as e:
				logger.error(f"Error in permission change callback: {e}")
	
	async def cleanup(self):
		"""Clean up permissions manager resources."""
		async with self._lock:
			self.permission_grants.clear()
			self.permission_rules.clear()
			self.user_permissions_cache.clear()
			self.section_permissions.clear()
			self.document_permissions.clear()
			self.permission_subscribers.clear()
		
		logger.info("CollaborationPermissions cleaned up")