#!/usr/bin/env python3
"""
Role-Based Access Control Module

Implements hierarchical role-based access control with fine-grained permissions
and dynamic permission assignment capabilities.
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Set, Union, Any, Tuple
from enum import Enum
import logging

try:
	from uuid_extensions import uuid7str
except ImportError:
	from uuid import uuid4
	def uuid7str() -> str:
		return str(uuid4())

from pydantic import BaseModel, Field, ConfigDict


class PermissionAction(Enum):
	"""Standard permission actions"""
	CREATE = "create"
	READ = "read"
	UPDATE = "update"
	DELETE = "delete"
	EXECUTE = "execute"
	APPROVE = "approve"
	MANAGE = "manage"
	ADMIN = "admin"


class ResourceType(Enum):
	"""Resource types for permissions"""
	DOCUMENT = "document"
	TEMPLATE = "template"
	USER = "user"
	ORGANIZATION = "organization"
	SYSTEM = "system"
	API = "api"
	WORKFLOW = "workflow"
	REPORT = "report"


class RoleLevel(Enum):
	"""Hierarchical role levels"""
	VIEWER = 1
	USER = 2
	CONTRIBUTOR = 3
	MANAGER = 4
	ADMIN = 5
	SUPER_ADMIN = 6


class AccessDecision(Enum):
	"""Access control decision"""
	GRANTED = "granted"
	DENIED = "denied"
	CONDITIONAL = "conditional"


class Permission(BaseModel):
	"""Individual permission model"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	permission_id: str = Field(default_factory=uuid7str)
	name: str
	description: str
	resource_type: ResourceType
	action: PermissionAction
	scope: str = "*"  # Resource scope (e.g., "org:123", "doc:456", "*")
	
	# Conditions and constraints
	conditions: Dict[str, Any] = Field(default_factory=dict)
	time_restrictions: Optional[Dict[str, str]] = None
	ip_restrictions: List[str] = Field(default_factory=list)
	
	# Metadata
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	created_by: str
	is_system: bool = False  # System-defined vs custom permission


class Role(BaseModel):
	"""Role model with hierarchical structure"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	role_id: str = Field(default_factory=uuid7str)
	name: str
	description: str
	level: RoleLevel
	
	# Permissions
	permissions: List[str] = Field(default_factory=list)  # Permission IDs
	inherited_permissions: List[str] = Field(default_factory=list)  # From parent roles
	
	# Hierarchy
	parent_role_id: Optional[str] = None
	child_role_ids: List[str] = Field(default_factory=list)
	
	# Constraints
	max_users: Optional[int] = None
	requires_approval: bool = False
	auto_expire_days: Optional[int] = None
	
	# Metadata
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	created_by: str
	is_system: bool = True  # System-defined vs custom role
	is_active: bool = True


class UserRoleAssignment(BaseModel):
	"""User role assignment with metadata"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	assignment_id: str = Field(default_factory=uuid7str)
	user_id: str
	role_id: str
	
	# Assignment metadata
	assigned_by: str
	assigned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	expires_at: Optional[datetime] = None
	
	# Scope and conditions
	scope: str = "*"  # Assignment scope
	conditions: Dict[str, Any] = Field(default_factory=dict)
	
	# Status
	is_active: bool = True
	suspended_until: Optional[datetime] = None
	suspension_reason: Optional[str] = None


class AccessResult(BaseModel):
	"""Result of access control check"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	decision: AccessDecision
	user_id: str
	resource_type: ResourceType
	action: PermissionAction
	resource_id: Optional[str] = None
	
	# Decision details
	granted_by_role: Optional[str] = None
	granted_by_permission: Optional[str] = None
	conditions_met: bool = True
	
	# Metadata
	checked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	reason: Optional[str] = None
	requires_elevation: bool = False
	
	# Additional context
	user_roles: List[str] = Field(default_factory=list)
	effective_permissions: List[str] = Field(default_factory=list)


@dataclass
class RBACConfiguration:
	"""Configuration for role-based access control"""
	# Default roles and permissions
	create_default_roles: bool = True
	create_default_permissions: bool = True
	
	# Hierarchy settings
	max_role_hierarchy_depth: int = 5
	allow_circular_inheritance: bool = False
	
	# Assignment settings
	max_roles_per_user: int = 10
	require_approval_for_elevation: bool = True
	default_assignment_duration_days: int = 365
	
	# Caching
	enable_permission_cache: bool = True
	cache_ttl_seconds: int = 300  # 5 minutes
	
	# Audit
	log_all_access_checks: bool = True
	log_permission_changes: bool = True


class RoleBasedAccess:
	"""Comprehensive role-based access control system"""
	
	def __init__(self, config: Optional[RBACConfiguration] = None):
		"""Initialize RBAC system with configuration"""
		self.config = config or RBACConfiguration()
		self.logger = logging.getLogger(__name__)
		
		# Storage (replace with database in production)
		self.permissions: Dict[str, Permission] = {}
		self.roles: Dict[str, Role] = {}
		self.user_role_assignments: Dict[str, List[UserRoleAssignment]] = {}  # user_id -> assignments
		
		# Caching
		self.permission_cache: Dict[str, Any] = {}
		self.cache_timestamps: Dict[str, datetime] = {}
		
		# Initialize default roles and permissions
		if self.config.create_default_roles:
			asyncio.create_task(self._create_default_roles())
		
		if self.config.create_default_permissions:
			asyncio.create_task(self._create_default_permissions())
		
		self.logger.info("Role-based access control system initialized")
	
	async def create_permission(
		self,
		name: str,
		description: str,
		resource_type: ResourceType,
		action: PermissionAction,
		created_by: str,
		scope: str = "*",
		conditions: Optional[Dict[str, Any]] = None,
		time_restrictions: Optional[Dict[str, str]] = None,
		ip_restrictions: Optional[List[str]] = None
	) -> str:
		"""Create a new permission"""
		permission = Permission(
			name=name,
			description=description,
			resource_type=resource_type,
			action=action,
			scope=scope,
			conditions=conditions or {},
			time_restrictions=time_restrictions,
			ip_restrictions=ip_restrictions or [],
			created_by=created_by
		)
		
		self.permissions[permission.permission_id] = permission
		self._invalidate_cache()
		
		self.logger.info(f"Created permission: {name} ({permission.permission_id})")
		return permission.permission_id
	
	async def create_role(
		self,
		name: str,
		description: str,
		level: RoleLevel,
		created_by: str,
		permission_ids: Optional[List[str]] = None,
		parent_role_id: Optional[str] = None,
		max_users: Optional[int] = None,
		requires_approval: bool = False,
		auto_expire_days: Optional[int] = None
	) -> str:
		"""Create a new role"""
		# Validate parent role hierarchy
		if parent_role_id:
			parent_role = self.roles.get(parent_role_id)
			if not parent_role:
				raise ValueError("Parent role not found")
			
			if not await self._validate_role_hierarchy(parent_role_id, level):
				raise ValueError("Invalid role hierarchy")
		
		# Validate permissions exist
		permission_ids = permission_ids or []
		for perm_id in permission_ids:
			if perm_id not in self.permissions:
				raise ValueError(f"Permission not found: {perm_id}")
		
		role = Role(
			name=name,
			description=description,
			level=level,
			permissions=permission_ids,
			parent_role_id=parent_role_id,
			max_users=max_users,
			requires_approval=requires_approval,
			auto_expire_days=auto_expire_days,
			created_by=created_by,
			is_system=False
		)
		
		# Calculate inherited permissions
		if parent_role_id:
			role.inherited_permissions = await self._calculate_inherited_permissions(parent_role_id)
		
		self.roles[role.role_id] = role
		
		# Update parent's children
		if parent_role_id:
			parent_role = self.roles[parent_role_id]
			parent_role.child_role_ids.append(role.role_id)
		
		self._invalidate_cache()
		
		self.logger.info(f"Created role: {name} ({role.role_id})")
		return role.role_id
	
	async def assign_role_to_user(
		self,
		user_id: str,
		role_id: str,
		assigned_by: str,
		scope: str = "*",
		expires_in_days: Optional[int] = None,
		conditions: Optional[Dict[str, Any]] = None
	) -> str:
		"""Assign role to user"""
		role = self.roles.get(role_id)
		if not role or not role.is_active:
			raise ValueError("Role not found or inactive")
		
		# Check if role requires approval for assignment
		if role.requires_approval:
			# In production, this would trigger an approval workflow
			self.logger.info(f"Role assignment requires approval: {role.name} for user {user_id}")
		
		# Check role user limit
		if role.max_users:
			current_assignments = await self._count_active_role_assignments(role_id)
			if current_assignments >= role.max_users:
				raise ValueError(f"Role has reached maximum user limit: {role.max_users}")
		
		# Check user role limit
		user_assignments = self.user_role_assignments.get(user_id, [])
		active_assignments = [a for a in user_assignments if a.is_active and not self._is_assignment_expired(a)]
		if len(active_assignments) >= self.config.max_roles_per_user:
			raise ValueError(f"User has reached maximum role limit: {self.config.max_roles_per_user}")
		
		# Calculate expiration
		expires_at = None
		if expires_in_days:
			expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
		elif role.auto_expire_days:
			expires_at = datetime.now(timezone.utc) + timedelta(days=role.auto_expire_days)
		elif self.config.default_assignment_duration_days:
			expires_at = datetime.now(timezone.utc) + timedelta(days=self.config.default_assignment_duration_days)
		
		assignment = UserRoleAssignment(
			user_id=user_id,
			role_id=role_id,
			assigned_by=assigned_by,
			expires_at=expires_at,
			scope=scope,
			conditions=conditions or {}
		)
		
		# Store assignment
		if user_id not in self.user_role_assignments:
			self.user_role_assignments[user_id] = []
		
		self.user_role_assignments[user_id].append(assignment)
		self._invalidate_cache()
		
		self.logger.info(f"Assigned role {role.name} to user {user_id}")
		return assignment.assignment_id
	
	async def check_permission(
		self,
		user_id: str,
		resource_type: ResourceType,
		action: PermissionAction,
		resource_id: Optional[str] = None,
		context: Optional[Dict[str, Any]] = None
	) -> AccessResult:
		"""Check if user has permission for action on resource"""
		context = context or {}
		
		# Check cache first
		if self.config.enable_permission_cache:
			cache_key = f"{user_id}:{resource_type.value}:{action.value}:{resource_id}"
			cached_result = self._get_cached_result(cache_key)
			if cached_result:
				return cached_result
		
		# Get user's active roles
		user_roles = await self._get_user_active_roles(user_id)
		if not user_roles:
			result = AccessResult(
				decision=AccessDecision.DENIED,
				user_id=user_id,
				resource_type=resource_type,
				action=action,
				resource_id=resource_id,
				reason="No active roles found"
			)
			return result
		
		# Collect all effective permissions
		effective_permissions = []
		granted_by_role = None
		granted_by_permission = None
		
		for role_assignment in user_roles:
			role = self.roles[role_assignment.role_id]
			
			# Check role scope matches resource scope
			if not self._check_scope_match(role_assignment.scope, resource_id):
				continue
			
			# Get all permissions for this role (direct + inherited)
			role_permissions = role.permissions + role.inherited_permissions
			
			for perm_id in role_permissions:
				permission = self.permissions.get(perm_id)
				if not permission:
					continue
				
				# Check if permission matches resource type and action
				if (permission.resource_type == resource_type and 
					permission.action == action):
					
					# Check permission scope
					if not self._check_scope_match(permission.scope, resource_id):
						continue
					
					# Check conditions
					if not self._check_permission_conditions(permission, context):
						continue
					
					# Check time restrictions
					if not self._check_time_restrictions(permission):
						continue
					
					# Check IP restrictions
					if not self._check_ip_restrictions(permission, context.get('ip_address')):
						continue
					
					# Permission granted
					effective_permissions.append(perm_id)
					granted_by_role = role.role_id
					granted_by_permission = perm_id
					break
			
			if granted_by_permission:
				break
		
		# Determine access decision
		if granted_by_permission:
			decision = AccessDecision.GRANTED
			reason = f"Granted by role {self.roles[granted_by_role].name}"
		else:
			decision = AccessDecision.DENIED
			reason = "No matching permissions found"
		
		result = AccessResult(
			decision=decision,
			user_id=user_id,
			resource_type=resource_type,
			action=action,
			resource_id=resource_id,
			granted_by_role=granted_by_role,
			granted_by_permission=granted_by_permission,
			reason=reason,
			user_roles=[r.role_id for r in user_roles],
			effective_permissions=effective_permissions
		)
		
		# Cache result
		if self.config.enable_permission_cache:
			self._cache_result(cache_key, result)
		
		# Log access check
		if self.config.log_all_access_checks:
			self.logger.info(f"Access check: {user_id} -> {resource_type.value}:{action.value} = {decision.value}")
		
		return result
	
	async def get_user_permissions(self, user_id: str) -> Dict[str, Any]:
		"""Get all permissions for a user"""
		user_roles = await self._get_user_active_roles(user_id)
		
		all_permissions = {}
		role_info = []
		
		for role_assignment in user_roles:
			role = self.roles[role_assignment.role_id]
			role_permissions = role.permissions + role.inherited_permissions
			
			role_info.append({
				'role_id': role.role_id,
				'role_name': role.name,
				'role_level': role.level.value,
				'assignment_scope': role_assignment.scope,
				'expires_at': role_assignment.expires_at,
				'permission_count': len(role_permissions)
			})
			
			for perm_id in role_permissions:
				permission = self.permissions.get(perm_id)
				if permission:
					all_permissions[perm_id] = {
						'name': permission.name,
						'resource_type': permission.resource_type.value,
						'action': permission.action.value,
						'scope': permission.scope,
						'granted_by_role': role.name
					}
		
		return {
			'user_id': user_id,
			'roles': role_info,
			'permissions': all_permissions,
			'total_permissions': len(all_permissions)
		}
	
	async def revoke_user_role(self, user_id: str, role_id: str, revoked_by: str) -> bool:
		"""Revoke role from user"""
		user_assignments = self.user_role_assignments.get(user_id, [])
		
		for assignment in user_assignments:
			if assignment.role_id == role_id and assignment.is_active:
				assignment.is_active = False
				self._invalidate_cache()
				
				self.logger.info(f"Revoked role {role_id} from user {user_id} by {revoked_by}")
				return True
		
		return False
	
	async def suspend_user_role(
		self,
		user_id: str,
		role_id: str,
		suspended_by: str,
		suspension_duration_hours: int,
		reason: str
	) -> bool:
		"""Temporarily suspend user role"""
		user_assignments = self.user_role_assignments.get(user_id, [])
		
		for assignment in user_assignments:
			if assignment.role_id == role_id and assignment.is_active:
				assignment.suspended_until = datetime.now(timezone.utc) + timedelta(hours=suspension_duration_hours)
				assignment.suspension_reason = reason
				self._invalidate_cache()
				
				self.logger.info(f"Suspended role {role_id} for user {user_id} for {suspension_duration_hours}h")
				return True
		
		return False
	
	async def _create_default_permissions(self):
		"""Create default system permissions"""
		default_permissions = [
			# Document permissions
			("document.create", "Create documents", ResourceType.DOCUMENT, PermissionAction.CREATE),
			("document.read", "Read documents", ResourceType.DOCUMENT, PermissionAction.READ),
			("document.update", "Update documents", ResourceType.DOCUMENT, PermissionAction.UPDATE),
			("document.delete", "Delete documents", ResourceType.DOCUMENT, PermissionAction.DELETE),
			("document.manage", "Manage documents", ResourceType.DOCUMENT, PermissionAction.MANAGE),
			
			# Template permissions
			("template.create", "Create templates", ResourceType.TEMPLATE, PermissionAction.CREATE),
			("template.read", "Read templates", ResourceType.TEMPLATE, PermissionAction.READ),
			("template.update", "Update templates", ResourceType.TEMPLATE, PermissionAction.UPDATE),
			("template.delete", "Delete templates", ResourceType.TEMPLATE, PermissionAction.DELETE),
			
			# User management
			("user.read", "View users", ResourceType.USER, PermissionAction.READ),
			("user.manage", "Manage users", ResourceType.USER, PermissionAction.MANAGE),
			
			# System administration
			("system.admin", "System administration", ResourceType.SYSTEM, PermissionAction.ADMIN),
			("system.manage", "System management", ResourceType.SYSTEM, PermissionAction.MANAGE),
		]
		
		for name, desc, resource_type, action in default_permissions:
			permission = Permission(
				name=name,
				description=desc,
				resource_type=resource_type,
				action=action,
				created_by="system",
				is_system=True
			)
			self.permissions[permission.permission_id] = permission
	
	async def _create_default_roles(self):
		"""Create default system roles"""
		# Wait for permissions to be created
		await self._create_default_permissions()
		
		# Get permission IDs by name
		perm_map = {p.name: p.permission_id for p in self.permissions.values()}
		
		# Viewer role
		viewer_perms = [perm_map.get("document.read"), perm_map.get("template.read")]
		viewer_perms = [p for p in viewer_perms if p]
		
		viewer_role = Role(
			name="Viewer",
			description="Can view documents and templates",
			level=RoleLevel.VIEWER,
			permissions=viewer_perms,
			created_by="system",
			is_system=True
		)
		self.roles[viewer_role.role_id] = viewer_role
		
		# User role
		user_perms = viewer_perms + [
			perm_map.get("document.create"),
			perm_map.get("document.update")
		]
		user_perms = [p for p in user_perms if p]
		
		user_role = Role(
			name="User",
			description="Can create and edit documents",
			level=RoleLevel.USER,
			permissions=user_perms,
			parent_role_id=viewer_role.role_id,
			created_by="system",
			is_system=True
		)
		self.roles[user_role.role_id] = user_role
		viewer_role.child_role_ids.append(user_role.role_id)
		
		# Manager role
		manager_perms = user_perms + [
			perm_map.get("document.delete"),
			perm_map.get("template.create"),
			perm_map.get("template.update"),
			perm_map.get("user.read")
		]
		manager_perms = [p for p in manager_perms if p]
		
		manager_role = Role(
			name="Manager",
			description="Can manage documents and templates",
			level=RoleLevel.MANAGER,
			permissions=manager_perms,
			parent_role_id=user_role.role_id,
			created_by="system",
			is_system=True
		)
		self.roles[manager_role.role_id] = manager_role
		user_role.child_role_ids.append(manager_role.role_id)
		
		# Admin role
		admin_perms = manager_perms + [
			perm_map.get("document.manage"),
			perm_map.get("template.delete"),
			perm_map.get("user.manage"),
			perm_map.get("system.manage")
		]
		admin_perms = [p for p in admin_perms if p]
		
		admin_role = Role(
			name="Admin",
			description="System administrator",
			level=RoleLevel.ADMIN,
			permissions=admin_perms,
			parent_role_id=manager_role.role_id,
			created_by="system",
			is_system=True
		)
		self.roles[admin_role.role_id] = admin_role
		manager_role.child_role_ids.append(admin_role.role_id)
		
		self.logger.info("Created default roles: Viewer, User, Manager, Admin")
	
	async def _get_user_active_roles(self, user_id: str) -> List[UserRoleAssignment]:
		"""Get user's active role assignments"""
		user_assignments = self.user_role_assignments.get(user_id, [])
		active_assignments = []
		
		for assignment in user_assignments:
			if (assignment.is_active and 
				not self._is_assignment_expired(assignment) and
				not self._is_assignment_suspended(assignment)):
				
				active_assignments.append(assignment)
		
		return active_assignments
	
	def _is_assignment_expired(self, assignment: UserRoleAssignment) -> bool:
		"""Check if role assignment has expired"""
		if assignment.expires_at:
			return datetime.now(timezone.utc) > assignment.expires_at
		return False
	
	def _is_assignment_suspended(self, assignment: UserRoleAssignment) -> bool:
		"""Check if role assignment is suspended"""
		if assignment.suspended_until:
			return datetime.now(timezone.utc) < assignment.suspended_until
		return False
	
	def _check_scope_match(self, permission_scope: str, resource_id: Optional[str]) -> bool:
		"""Check if permission scope matches resource"""
		if permission_scope == "*":
			return True
		
		if not resource_id:
			return permission_scope == "*"
		
		# Support hierarchical scopes like "org:123", "org:123:dept:456"
		if ":" in permission_scope:
			return resource_id.startswith(permission_scope) or permission_scope.startswith(resource_id)
		
		return permission_scope == resource_id
	
	def _check_permission_conditions(self, permission: Permission, context: Dict[str, Any]) -> bool:
		"""Check if permission conditions are met"""
		if not permission.conditions:
			return True
		
		# Example condition checking (extend as needed)
		for condition_key, condition_value in permission.conditions.items():
			context_value = context.get(condition_key)
			if context_value != condition_value:
				return False
		
		return True
	
	def _check_time_restrictions(self, permission: Permission) -> bool:
		"""Check if current time is within permission time restrictions"""
		if not permission.time_restrictions:
			return True
		
		now = datetime.now(timezone.utc)
		
		# Check day of week restrictions
		if 'allowed_days' in permission.time_restrictions:
			allowed_days = permission.time_restrictions['allowed_days']
			current_day = now.strftime('%A').lower()
			if current_day not in [day.lower() for day in allowed_days]:
				return False
		
		# Check time of day restrictions
		if 'allowed_hours' in permission.time_restrictions:
			allowed_hours = permission.time_restrictions['allowed_hours']
			current_hour = now.hour
			start_hour, end_hour = map(int, allowed_hours.split('-'))
			if not (start_hour <= current_hour <= end_hour):
				return False
		
		return True
	
	def _check_ip_restrictions(self, permission: Permission, ip_address: Optional[str]) -> bool:
		"""Check IP address restrictions"""
		if not permission.ip_restrictions or not ip_address:
			return True
		
		return ip_address in permission.ip_restrictions
	
	async def _calculate_inherited_permissions(self, parent_role_id: str) -> List[str]:
		"""Calculate permissions inherited from parent roles"""
		inherited = []
		
		parent_role = self.roles.get(parent_role_id)
		if parent_role:
			# Add parent's direct permissions
			inherited.extend(parent_role.permissions)
			
			# Add parent's inherited permissions
			inherited.extend(parent_role.inherited_permissions)
			
			# Recursively get grandparent permissions
			if parent_role.parent_role_id:
				grandparent_permissions = await self._calculate_inherited_permissions(parent_role.parent_role_id)
				inherited.extend(grandparent_permissions)
		
		# Remove duplicates
		return list(set(inherited))
	
	async def _validate_role_hierarchy(self, parent_role_id: str, child_level: RoleLevel) -> bool:
		"""Validate role hierarchy constraints"""
		parent_role = self.roles.get(parent_role_id)
		if not parent_role:
			return False
		
		# Child level should be higher than parent level
		if child_level.value <= parent_role.level.value:
			return False
		
		# Check maximum hierarchy depth
		depth = await self._calculate_hierarchy_depth(parent_role_id)
		if depth >= self.config.max_role_hierarchy_depth:
			return False
		
		return True
	
	async def _calculate_hierarchy_depth(self, role_id: str) -> int:
		"""Calculate hierarchy depth from root"""
		role = self.roles.get(role_id)
		if not role or not role.parent_role_id:
			return 1
		
		return 1 + await self._calculate_hierarchy_depth(role.parent_role_id)
	
	async def _count_active_role_assignments(self, role_id: str) -> int:
		"""Count active assignments for a role"""
		count = 0
		for assignments in self.user_role_assignments.values():
			for assignment in assignments:
				if (assignment.role_id == role_id and 
					assignment.is_active and
					not self._is_assignment_expired(assignment)):
					count += 1
		return count
	
	def _get_cached_result(self, cache_key: str) -> Optional[AccessResult]:
		"""Get cached access result if still valid"""
		if cache_key in self.permission_cache:
			cached_time = self.cache_timestamps.get(cache_key)
			if cached_time:
				age = (datetime.now(timezone.utc) - cached_time).total_seconds()
				if age < self.config.cache_ttl_seconds:
					return self.permission_cache[cache_key]
		return None
	
	def _cache_result(self, cache_key: str, result: AccessResult):
		"""Cache access result"""
		self.permission_cache[cache_key] = result
		self.cache_timestamps[cache_key] = datetime.now(timezone.utc)
		
		# Clean old cache entries (keep last 1000)
		if len(self.permission_cache) > 1000:
			oldest_keys = sorted(
				self.cache_timestamps.keys(),
				key=lambda k: self.cache_timestamps[k]
			)[:100]  # Remove oldest 100
			
			for key in oldest_keys:
				self.permission_cache.pop(key, None)
				self.cache_timestamps.pop(key, None)
	
	def _invalidate_cache(self):
		"""Invalidate permission cache"""
		self.permission_cache.clear()
		self.cache_timestamps.clear()


# Factory function
def create_role_based_access(config: Optional[RBACConfiguration] = None) -> RoleBasedAccess:
	"""Create RoleBasedAccess instance with optional configuration"""
	return RoleBasedAccess(config)