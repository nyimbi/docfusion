"""
Context Manager

Advanced context management for multi-agent coordination with shared
context spaces, context inheritance, and dynamic context adaptation.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import json
import logging
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union

from pydantic import BaseModel, ConfigDict, Field

try:
    from uuid_extensions import uuid7str
except ImportError:
    import uuid

    def uuid7str() -> str:
        return str(uuid.uuid4())


class ContextScope(str, Enum):
    """Context visibility and access scope"""

    AGENT = "agent"  # Agent-specific context
    TASK = "task"  # Task-specific context
    CREW = "crew"  # Crew-level shared context
    SWARM = "swarm"  # Swarm-level collective context
    WORKFLOW = "workflow"  # Workflow execution context
    PROJECT = "project"  # Project-wide context
    GLOBAL = "global"  # System-wide global context


class ContextType(str, Enum):
    """Types of context information"""

    STATE = "state"  # Agent/system state information
    KNOWLEDGE = "knowledge"  # Domain knowledge and facts
    CONVERSATION = "conversation"  # Communication history
    TASK_PROGRESS = "task_progress"  # Task execution state
    DECISIONS = "decisions"  # Decision history and rationale
    METRICS = "metrics"  # Performance and operational metrics
    CONFIGURATION = "configuration"  # System configuration
    USER_PREFERENCES = "user_preferences"  # User settings and preferences


class ContextAccess(str, Enum):
    """Context access permissions"""

    READ_ONLY = "read_only"
    READ_WRITE = "read_write"
    ADMIN = "admin"  # Full control including deletion
    OWNER = "owner"  # Original creator with full rights


@dataclass
class ContextEntry:
    """Individual context entry"""

    key: str
    value: Any
    context_type: ContextType = ContextType.STATE
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    version: int = 1
    metadata: Dict[str, Any] = field(default_factory=dict)
    tags: Set[str] = field(default_factory=set)

    # Access control
    access_permissions: Dict[str, ContextAccess] = field(default_factory=dict)
    public: bool = False

    # Lifecycle
    ttl_seconds: Optional[int] = None
    expires_at: Optional[datetime] = None


class SharedContext:
    """
    Shared context space for multi-agent coordination

    Provides thread-safe context sharing with access control,
    versioning, and event notifications.
    """

    # Maximum history entries to prevent unbounded growth
    MAX_HISTORY_SIZE = 100

    def __init__(self, context_id: str, scope: ContextScope, name: str = ""):
        self.context_id = context_id
        self.scope = scope
        self.name = name or f"{scope}_{context_id[:8]}"

        # Context storage
        self.entries: Dict[str, ContextEntry] = {}
        self.history: List[Dict[str, Any]] = []

        # Access control
        self.participants: Set[str] = set()
        self.access_permissions: Dict[str, ContextAccess] = {}
        self.owner: Optional[str] = None

        # Synchronization
        self._lock = asyncio.Lock()
        self._observers: Dict[str, Callable] = {}

        # Metadata
        self.created_at = datetime.now()
        self.last_updated = datetime.now()
        self.update_count = 0

        self.logger = logging.getLogger(f"context.{self.name}")

    async def set(
        self,
        key: str,
        value: Any,
        context_type: ContextType = ContextType.STATE,
        agent_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ttl_seconds: Optional[int] = None,
    ) -> bool:
        """Set context value"""
        async with self._lock:
            try:
                # Check write permissions
                if not self._can_write(agent_id):
                    self.logger.warning(
                        f"Agent {agent_id} lacks write permission for {key}"
                    )
                    return False

                # Create or update entry
                if key in self.entries:
                    entry = self.entries[key]
                    entry.value = value
                    entry.updated_at = datetime.now()
                    entry.updated_by = agent_id
                    entry.version += 1
                    if metadata:
                        entry.metadata.update(metadata)
                else:
                    entry = ContextEntry(
                        key=key,
                        value=value,
                        context_type=context_type,
                        created_by=agent_id,
                        metadata=metadata or {},
                        ttl_seconds=ttl_seconds,
                    )

                    if ttl_seconds:
                        entry.expires_at = datetime.now() + timedelta(
                            seconds=ttl_seconds
                        )

                    self.entries[key] = entry

                # Record history
                self.history.append(
                    {
                        "action": "set",
                        "key": key,
                        "agent_id": agent_id,
                        "timestamp": datetime.now().isoformat(),
                        "version": entry.version,
                    }
                )
                # Enforce max history size to prevent unbounded growth
                if len(self.history) > self.MAX_HISTORY_SIZE:
                    self.history = self.history[-self.MAX_HISTORY_SIZE:]

                # Update context metadata
                self.last_updated = datetime.now()
                self.update_count += 1

                # Notify observers
                await self._notify_observers("set", key, value, agent_id)

                self.logger.debug(f"Set context {key} by agent {agent_id}")
                return True

            except Exception as e:
                self.logger.error(f"Failed to set context {key}: {e}")
                return False

    async def get(
        self, key: str, agent_id: Optional[str] = None, default: Any = None
    ) -> Any:
        """Get context value"""
        async with self._lock:
            try:
                if key not in self.entries:
                    return default

                entry = self.entries[key]

                # Check read permissions
                if not self._can_read(agent_id, entry):
                    self.logger.warning(
                        f"Agent {agent_id} lacks read permission for {key}"
                    )
                    return default

                # Check expiration
                if entry.expires_at and entry.expires_at < datetime.now():
                    await self._remove_expired_entry(key)
                    return default

                self.logger.debug(f"Get context {key} by agent {agent_id}")
                return entry.value

            except Exception as e:
                self.logger.error(f"Failed to get context {key}: {e}")
                return default

    async def update(
        self, key: str, updater: Callable[[Any], Any], agent_id: Optional[str] = None
    ) -> bool:
        """Atomically update context value using updater function"""
        async with self._lock:
            try:
                if not self._can_write(agent_id):
                    return False

                if key not in self.entries:
                    return False

                entry = self.entries[key]
                old_value = entry.value
                new_value = updater(old_value)

                entry.value = new_value
                entry.updated_at = datetime.now()
                entry.updated_by = agent_id
                entry.version += 1

                # Record history
                self.history.append(
                    {
                        "action": "update",
                        "key": key,
                        "agent_id": agent_id,
                        "timestamp": datetime.now().isoformat(),
                        "version": entry.version,
                    }
                )
                # Enforce max history size to prevent unbounded growth
                if len(self.history) > self.MAX_HISTORY_SIZE:
                    self.history = self.history[-self.MAX_HISTORY_SIZE:]

                self.last_updated = datetime.now()
                self.update_count += 1

                # Notify observers
                await self._notify_observers("update", key, new_value, agent_id)

                return True

            except Exception as e:
                self.logger.error(f"Failed to update context {key}: {e}")
                return False

    async def delete(self, key: str, agent_id: Optional[str] = None) -> bool:
        """Delete context entry"""
        async with self._lock:
            try:
                if key not in self.entries:
                    return False

                entry = self.entries[key]

                # Check delete permissions (need admin access)
                if not self._can_delete(agent_id, entry):
                    self.logger.warning(
                        f"Agent {agent_id} lacks delete permission for {key}"
                    )
                    return False

                del self.entries[key]

                # Record history
                self.history.append(
                    {
                        "action": "delete",
                        "key": key,
                        "agent_id": agent_id,
                        "timestamp": datetime.now().isoformat(),
                    }
                )
                # Enforce max history size to prevent unbounded growth
                if len(self.history) > self.MAX_HISTORY_SIZE:
                    self.history = self.history[-self.MAX_HISTORY_SIZE:]

                self.last_updated = datetime.now()
                self.update_count += 1

                # Notify observers
                await self._notify_observers("delete", key, None, agent_id)

                return True

            except Exception as e:
                self.logger.error(f"Failed to delete context {key}: {e}")
                return False

    async def get_all(
        self, agent_id: Optional[str] = None, context_type: Optional[ContextType] = None
    ) -> Dict[str, Any]:
        """Get all context entries agent has access to"""
        async with self._lock:
            result = {}

            for key, entry in self.entries.items():
                # Check permissions and filters
                if not self._can_read(agent_id, entry):
                    continue

                if context_type and entry.context_type != context_type:
                    continue

                # Check expiration
                if entry.expires_at and entry.expires_at < datetime.now():
                    continue

                result[key] = entry.value

            return result

    async def add_observer(self, observer_id: str, callback: Callable) -> bool:
        """Add observer for context changes"""
        try:
            self._observers[observer_id] = callback
            return True
        except Exception as e:
            self.logger.error(f"Failed to add observer {observer_id}: {e}")
            return False

    async def remove_observer(self, observer_id: str) -> bool:
        """Remove context observer"""
        try:
            self._observers.pop(observer_id, None)
            return True
        except Exception as e:
            self.logger.error(f"Failed to remove observer {observer_id}: {e}")
            return False

    def _can_read(self, agent_id: Optional[str], entry: ContextEntry) -> bool:
        """Check if agent can read entry"""
        if entry.public:
            return True

        if not agent_id:
            return False

        # Owner can always read
        if entry.created_by == agent_id:
            return True

        # Check specific permissions
        if agent_id in entry.access_permissions:
            return True

        # Check context-level permissions
        if agent_id in self.access_permissions:
            return True

        return False

    def _can_write(self, agent_id: Optional[str]) -> bool:
        """Check if agent can write to context"""
        if not agent_id:
            return False

        # Owner can always write
        if self.owner == agent_id:
            return True

        # Check permissions
        permission = self.access_permissions.get(agent_id)
        return permission in [
            ContextAccess.READ_WRITE,
            ContextAccess.ADMIN,
            ContextAccess.OWNER,
        ]

    def _can_delete(self, agent_id: Optional[str], entry: ContextEntry) -> bool:
        """Check if agent can delete entry"""
        if not agent_id:
            return False

        # Creator can delete their own entries
        if entry.created_by == agent_id:
            return True

        # Check for admin permissions
        context_permission = self.access_permissions.get(agent_id)
        if context_permission in [ContextAccess.ADMIN, ContextAccess.OWNER]:
            return True

        entry_permission = entry.access_permissions.get(agent_id)
        if entry_permission in [ContextAccess.ADMIN, ContextAccess.OWNER]:
            return True

        return False

    async def _notify_observers(
        self, action: str, key: str, value: Any, agent_id: Optional[str]
    ) -> None:
        """Notify observers of context changes"""
        notification = {
            "action": action,
            "key": key,
            "value": value,
            "agent_id": agent_id,
            "context_id": self.context_id,
            "timestamp": datetime.now(),
        }

        for observer_id, callback in self._observers.items():
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(notification)
                else:
                    callback(notification)
            except Exception as e:
                self.logger.warning(f"Observer {observer_id} callback failed: {e}")

    async def _remove_expired_entry(self, key: str) -> None:
        """Remove expired entry"""
        try:
            del self.entries[key]
            self.logger.debug(f"Removed expired context entry: {key}")
        except KeyError:
            self.logger.debug(f"Expired context entry already removed: {key}")

    def get_context_info(self) -> Dict[str, Any]:
        """Get context metadata and statistics"""
        return {
            "context_id": self.context_id,
            "name": self.name,
            "scope": self.scope.value,
            "entry_count": len(self.entries),
            "participant_count": len(self.participants),
            "owner": self.owner,
            "created_at": self.created_at.isoformat(),
            "last_updated": self.last_updated.isoformat(),
            "update_count": self.update_count,
        }


class ContextManager:
    """
    Advanced context manager for multi-agent systems

    Manages multiple shared context spaces with hierarchical inheritance,
    dynamic context creation, and sophisticated access control.
    """

    def __init__(self):
        # Context storage
        self.contexts: Dict[str, SharedContext] = {}
        self.context_hierarchy: Dict[str, Set[str]] = {}  # parent -> children
        self.agent_contexts: Dict[str, Set[str]] = {}  # agent_id -> context_ids

        # Context templates and patterns
        self.context_templates: Dict[str, Dict[str, Any]] = {}

        # Management
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False

        self.logger = logging.getLogger("context_manager")
        self._initialize_default_templates()

    async def start(self) -> None:
        """Start context manager"""
        if self._running:
            return

        self._running = True
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        self.logger.info("Context manager started")

    async def stop(self) -> None:
        """Stop context manager"""
        if not self._running:
            return

        self._running = False

        if self._cleanup_task:
            self._cleanup_task.cancel()

        self.logger.info("Context manager stopped")

    # Context creation and management

    async def create_context(
        self,
        scope: ContextScope,
        name: str = "",
        owner: Optional[str] = None,
        template: Optional[str] = None,
        parent_context: Optional[str] = None,
    ) -> str:
        """Create new shared context"""
        try:
            context_id = uuid7str()
            context = SharedContext(context_id, scope, name)
            context.owner = owner

            if owner:
                context.access_permissions[owner] = ContextAccess.OWNER
                context.participants.add(owner)

                # Track agent contexts
                if owner not in self.agent_contexts:
                    self.agent_contexts[owner] = set()
                self.agent_contexts[owner].add(context_id)

            # Apply template if provided
            if template and template in self.context_templates:
                await self._apply_template(context, template)

            # Set up hierarchy
            if parent_context and parent_context in self.contexts:
                if parent_context not in self.context_hierarchy:
                    self.context_hierarchy[parent_context] = set()
                self.context_hierarchy[parent_context].add(context_id)

            self.contexts[context_id] = context

            self.logger.info(
                f"Created context: {name} ({context_id}) with scope {scope}"
            )
            return context_id

        except Exception as e:
            self.logger.error(f"Failed to create context: {e}")
            raise

    async def get_context(self, context_id: str) -> Optional[SharedContext]:
        """Get context by ID"""
        return self.contexts.get(context_id)

    async def delete_context(
        self, context_id: str, agent_id: Optional[str] = None
    ) -> bool:
        """Delete context"""
        try:
            if context_id not in self.contexts:
                return False

            context = self.contexts[context_id]

            # Check permissions
            if agent_id != context.owner and agent_id not in context.access_permissions:
                return False

            # Remove from agent tracking
            for agent_contexts in self.agent_contexts.values():
                agent_contexts.discard(context_id)

            # Remove from hierarchy
            for children in self.context_hierarchy.values():
                children.discard(context_id)
            self.context_hierarchy.pop(context_id, None)

            del self.contexts[context_id]

            self.logger.info(f"Deleted context: {context_id}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to delete context {context_id}: {e}")
            return False

    async def add_participant(
        self,
        context_id: str,
        agent_id: str,
        access: ContextAccess = ContextAccess.READ_ONLY,
    ) -> bool:
        """Add participant to context"""
        try:
            if context_id not in self.contexts:
                return False

            context = self.contexts[context_id]
            context.participants.add(agent_id)
            context.access_permissions[agent_id] = access

            # Track agent contexts
            if agent_id not in self.agent_contexts:
                self.agent_contexts[agent_id] = set()
            self.agent_contexts[agent_id].add(context_id)

            self.logger.debug(f"Added participant {agent_id} to context {context_id}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to add participant: {e}")
            return False

    async def remove_participant(self, context_id: str, agent_id: str) -> bool:
        """Remove participant from context"""
        try:
            if context_id not in self.contexts:
                return False

            context = self.contexts[context_id]
            context.participants.discard(agent_id)
            context.access_permissions.pop(agent_id, None)

            # Update agent tracking
            if agent_id in self.agent_contexts:
                self.agent_contexts[agent_id].discard(context_id)

            return True

        except Exception as e:
            self.logger.error(f"Failed to remove participant: {e}")
            return False

    # Context inheritance and hierarchy

    async def get_inherited_value(
        self, context_id: str, key: str, agent_id: Optional[str] = None
    ) -> Any:
        """Get value with inheritance from parent contexts"""
        # Try current context first
        context = self.contexts.get(context_id)
        if context:
            value = await context.get(key, agent_id)
            if value is not None:
                return value

        # Search parent contexts
        for parent_id, children in self.context_hierarchy.items():
            if context_id in children:
                parent_value = await self.get_inherited_value(parent_id, key, agent_id)
                if parent_value is not None:
                    return parent_value

        return None

    async def propagate_to_children(
        self, context_id: str, key: str, value: Any, agent_id: Optional[str] = None
    ) -> int:
        """Propagate value to child contexts"""
        propagated_count = 0

        if context_id in self.context_hierarchy:
            for child_id in self.context_hierarchy[context_id]:
                child_context = self.contexts.get(child_id)
                if child_context:
                    success = await child_context.set(key, value, agent_id=agent_id)
                    if success:
                        propagated_count += 1

                    # Recursively propagate to grandchildren
                    propagated_count += await self.propagate_to_children(
                        child_id, key, value, agent_id
                    )

        return propagated_count

    # Agent context management

    async def get_agent_contexts(
        self, agent_id: str, scope: Optional[ContextScope] = None
    ) -> List[SharedContext]:
        """Get all contexts an agent has access to"""
        agent_context_ids = self.agent_contexts.get(agent_id, set())
        contexts = []

        for context_id in agent_context_ids:
            context = self.contexts.get(context_id)
            if context and (not scope or context.scope == scope):
                contexts.append(context)

        return contexts

    async def create_agent_workspace(self, agent_id: str) -> str:
        """Create personal workspace context for agent"""
        return await self.create_context(
            scope=ContextScope.AGENT,
            name=f"{agent_id}_workspace",
            owner=agent_id,
            template="agent_workspace",
        )

    async def create_crew_context(self, crew_id: str, participants: List[str]) -> str:
        """Create shared context for crew"""
        context_id = await self.create_context(
            scope=ContextScope.CREW,
            name=f"crew_{crew_id}",
            template="crew_collaboration",
        )

        # Add all participants
        for participant_id in participants:
            await self.add_participant(
                context_id, participant_id, ContextAccess.READ_WRITE
            )

        return context_id

    async def create_workflow_context(
        self, workflow_id: str, execution_context: Dict[str, Any]
    ) -> str:
        """Create context for workflow execution"""
        context_id = await self.create_context(
            scope=ContextScope.WORKFLOW,
            name=f"workflow_{workflow_id}",
            template="workflow_execution",
        )

        context = self.contexts[context_id]

        # Initialize with execution context
        for key, value in execution_context.items():
            await context.set(key, value, context_type=ContextType.CONFIGURATION)

        return context_id

    # Template and pattern system

    def _initialize_default_templates(self) -> None:
        """Initialize default context templates"""
        self.context_templates["agent_workspace"] = {
            "initial_entries": {
                "status": "active",
                "preferences": {},
                "current_tasks": [],
                "performance_metrics": {},
            }
        }

        self.context_templates["crew_collaboration"] = {
            "initial_entries": {
                "crew_status": "active",
                "shared_goals": [],
                "task_assignments": {},
                "communication_log": [],
                "collaboration_metrics": {},
            }
        }

        self.context_templates["workflow_execution"] = {
            "initial_entries": {
                "workflow_status": "initialized",
                "current_stage": 0,
                "stage_results": {},
                "execution_metrics": {},
                "error_log": [],
            }
        }

    async def _apply_template(self, context: SharedContext, template_name: str) -> None:
        """Apply template to context"""
        template = self.context_templates.get(template_name, {})
        initial_entries = template.get("initial_entries", {})

        for key, value in initial_entries.items():
            await context.set(key, deepcopy(value), context_type=ContextType.STATE)

    async def register_template(self, name: str, template: Dict[str, Any]) -> bool:
        """Register new context template"""
        try:
            self.context_templates[name] = template
            return True
        except Exception as e:
            self.logger.error(f"Failed to register template {name}: {e}")
            return False

    # Cleanup and maintenance

    async def _cleanup_loop(self) -> None:
        """Background cleanup for expired contexts and entries"""
        while self._running:
            try:
                await self._cleanup_expired_entries()
                await asyncio.sleep(300)  # Run every 5 minutes
            except Exception as e:
                self.logger.error(f"Cleanup error: {e}")
                await asyncio.sleep(60)

    async def _cleanup_expired_entries(self) -> None:
        """Clean up expired context entries"""
        current_time = datetime.now()
        cleanup_count = 0

        for context in self.contexts.values():
            expired_keys = []

            for key, entry in context.entries.items():
                if entry.expires_at and entry.expires_at < current_time:
                    expired_keys.append(key)

            for key in expired_keys:
                await context.delete(key)
                cleanup_count += 1

        if cleanup_count > 0:
            self.logger.info(f"Cleaned up {cleanup_count} expired context entries")

    # Query and analytics

    async def query_contexts(
        self,
        scope: Optional[ContextScope] = None,
        agent_id: Optional[str] = None,
        contains_key: Optional[str] = None,
    ) -> List[SharedContext]:
        """Query contexts with various filters"""
        results = []

        for context in self.contexts.values():
            # Apply filters
            if scope and context.scope != scope:
                continue

            if agent_id and agent_id not in context.participants:
                continue

            if contains_key and contains_key not in context.entries:
                continue

            results.append(context)

        return results

    def get_context_statistics(self) -> Dict[str, Any]:
        """Get context manager statistics"""
        stats = {
            "total_contexts": len(self.contexts),
            "contexts_by_scope": {},
            "total_entries": 0,
            "total_participants": len(self.agent_contexts),
            "hierarchy_depth": 0,
        }

        # Count by scope
        for context in self.contexts.values():
            scope_key = context.scope.value
            stats["contexts_by_scope"][scope_key] = (
                stats["contexts_by_scope"].get(scope_key, 0) + 1
            )
            stats["total_entries"] += len(context.entries)

        # Calculate max hierarchy depth
        def calculate_depth(context_id, current_depth=0):
            max_depth = current_depth
            for child_id in self.context_hierarchy.get(context_id, set()):
                child_depth = calculate_depth(child_id, current_depth + 1)
                max_depth = max(max_depth, child_depth)
            return max_depth

        for context_id in self.contexts.keys():
            depth = calculate_depth(context_id)
            stats["hierarchy_depth"] = max(stats["hierarchy_depth"], depth)

        return stats
