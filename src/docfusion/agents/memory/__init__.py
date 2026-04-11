"""
Agent Memory and Context Management

Shared knowledge management, context persistence, and collective memory
systems for multi-agent coordination and learning.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import os
from ...config.secrets import SecretsManager
from typing import Optional

from .memory_manager import MemoryManager, MemoryConfig, MemoryType
from .memory_manager import MemoryScope, MemoryPriority, MemoryEntry, MemoryIndex
from .context_manager import ContextManager, ContextScope, SharedContext
from .knowledge_base import KnowledgeBase, KnowledgeEntry, KnowledgeGraph
from .learning_system import LearningSystem, ExperienceRecord, AdaptationEngine

# Persistent memory adapter
from .persistent_adapter import (
	PersistentMemoryAdapter,
	PersistentMemoryConfig,
	EmbeddingClient,
	create_persistent_memory,
)
from .schema import (
	AGENT_MEMORY_SCHEMA,
	SCHEMA_VERSION,
	DEFAULT_EMBEDDING_DIMENSIONS,
	get_schema_sql,
	get_migration_statements,
)

# Global memory manager instance (singleton pattern)
_memory_manager_instance: Optional[MemoryManager] = None
_persistent_memory_enabled: Optional[bool] = None


def is_persistent_memory_enabled() -> bool:
	"""
	Check if persistent memory is enabled via environment variable.

	Returns:
		True if PERSISTENT_MEMORY_ENABLED=true, False otherwise.
		Defaults to False in development, True in production.
	"""
	global _persistent_memory_enabled

	if _persistent_memory_enabled is not None:
		return _persistent_memory_enabled

	# Check environment variable
	env_value = os.environ.get("PERSISTENT_MEMORY_ENABLED", "").lower()  # TODO: migrate to SecretsManager

	# Explicit setting takes precedence
	if env_value in ("true", "1", "yes"):
		_persistent_memory_enabled = True
	elif env_value in ("false", "0", "no"):
		_persistent_memory_enabled = False
	else:
		# Default based on environment
		# In production (no DEBUG flag), enable by default
		# In development, disable by default
		debug_mode = not SecretsManager.is_production()
		_persistent_memory_enabled = not debug_mode

	return _persistent_memory_enabled


async def get_memory_manager(
	agent_id: str = "default",
	database_url: Optional[str] = None,
	config: Optional[MemoryConfig] = None,
) -> MemoryManager | PersistentMemoryAdapter:
	"""
	Get or create the memory manager instance.

	This factory function provides a singleton MemoryManager instance.
	If persistent memory is enabled and database_url is provided,
	it returns a PersistentMemoryAdapter. Otherwise, it returns
	an in-memory MemoryManager.

	Args:
		agent_id: Unique agent identifier for memory scoping
		database_url: Optional PostgreSQL connection URL for persistence
		config: Optional MemoryConfig for customization

	Returns:
		MemoryManager instance (either PersistentMemoryAdapter or in-memory)
	"""
	global _memory_manager_instance

	# If we already have an instance and no specific agent_id requested
	if _memory_manager_instance is not None and agent_id == "default":
		return _memory_manager_instance

	# Determine if we should use persistent memory
	use_persistent = is_persistent_memory_enabled()

	if use_persistent:
		# Try to use persistent memory adapter
		try:
			# Get database URL from environment or parameter
			db_url = database_url or SecretsManager.get_database_url()

			if db_url:
				# Create persistent memory adapter
				manager = await create_persistent_memory(
					agent_id=agent_id,
					database_url=db_url,
				)

				# Cache as singleton for default agent
				if agent_id == "default":
					_memory_manager_instance = manager

				return manager
			else:
				# No database URL, fall back to in-memory
				import logging
				logging.getLogger(__name__).warning(
					"Persistent memory enabled but no DATABASE_URL provided, "
					"falling back to in-memory storage"
				)
		except Exception as e:
			import logging
			logging.getLogger(__name__).warning(
				f"Failed to initialize persistent memory: {e}, "
				f"falling back to in-memory storage"
			)

	# Fall back to in-memory MemoryManager
	manager = MemoryManager(agent_id=agent_id, config=config or MemoryConfig())

	# Cache as singleton for default agent
	if agent_id == "default":
		_memory_manager_instance = manager

	return manager


def reset_memory_manager() -> None:
	"""Reset the global memory manager instance (useful for testing)."""
	global _memory_manager_instance, _persistent_memory_enabled
	_memory_manager_instance = None
	_persistent_memory_enabled = None


__all__ = [
	# Core memory management
	"MemoryManager",
	"MemoryConfig",
	"MemoryType",
	"MemoryScope",
	"MemoryPriority",
	"MemoryEntry",
	"MemoryIndex",
	# Context management
	"ContextManager",
	"ContextScope",
	"SharedContext",
	# Knowledge management
	"KnowledgeBase",
	"KnowledgeEntry",
	"KnowledgeGraph",
	# Learning systems
	"LearningSystem",
	"ExperienceRecord",
	"AdaptationEngine",
	# Persistent memory
	"PersistentMemoryAdapter",
	"PersistentMemoryConfig",
	"EmbeddingClient",
	"create_persistent_memory",
	# Schema
	"AGENT_MEMORY_SCHEMA",
	"SCHEMA_VERSION",
	"DEFAULT_EMBEDDING_DIMENSIONS",
	"get_schema_sql",
	"get_migration_statements",
	# Factory functions
	"get_memory_manager",
	"is_persistent_memory_enabled",
	"reset_memory_manager",
]