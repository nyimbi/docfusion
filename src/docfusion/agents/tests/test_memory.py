"""
Memory System Tests

Tests for agent memory management, context sharing, and knowledge systems.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import pytest
import asyncio

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from memory.memory_manager import MemoryManager, MemoryConfig, MemoryType, MemoryScope
from memory.context_manager import ContextManager, ContextScope
from memory.knowledge_base import KnowledgeBase, KnowledgeEntry, KnowledgeType
from memory.learning_system import LearningSystem


class TestMemoryManager:
	"""Test agent memory management"""
	
	@pytest.fixture
	def memory_config(self):
		"""Create test memory configuration"""
		return MemoryConfig(
			max_short_term_entries=50,
			max_long_term_entries=200,
			short_term_ttl_hours=2,
			cleanup_interval_minutes=5
		)
	
	def test_memory_config_creation(self, memory_config):
		"""Test memory configuration"""
		assert memory_config.max_short_term_entries == 50
		assert memory_config.max_long_term_entries == 200
		assert memory_config.short_term_ttl_hours == 2
	
	def test_memory_manager_initialization(self, memory_config):
		"""Test memory manager initialization"""
		manager = MemoryManager("agent_1", memory_config)
		
		assert manager.agent_id == "agent_1"
		assert manager.config == memory_config
		assert len(manager.memories) == 0
		assert manager.stats["total_entries"] == 0
	
	@pytest.mark.asyncio
	async def test_memory_storage_and_retrieval(self, memory_config):
		"""Test storing and retrieving memories"""
		manager = MemoryManager("agent_1", memory_config)
		await manager.start()
		
		# Store memory
		content = {"task": "research", "topic": "AI", "results": ["finding1", "finding2"]}
		memory_id = await manager.store_memory(
			content=content,
			memory_type=MemoryType.EPISODIC,
			scope=MemoryScope.PRIVATE,
			tags={"research", "AI"}
		)
		
		assert memory_id is not None
		assert len(manager.memories) == 1
		
		# Retrieve memory
		entry = await manager.retrieve_memory(memory_id)
		assert entry is not None
		assert entry.content == content
		assert entry.memory_type == MemoryType.EPISODIC
		assert "research" in entry.tags
		
		await manager.stop()
	
	@pytest.mark.asyncio
	async def test_memory_search(self, memory_config):
		"""Test memory search functionality"""
		manager = MemoryManager("agent_1", memory_config)
		await manager.start()
		
		# Store multiple memories
		await manager.store_memory(
			content="Research about artificial intelligence",
			memory_type=MemoryType.SEMANTIC,
			tags={"AI", "research"}
		)
		
		await manager.store_memory(
			content="Meeting notes from client discussion",
			memory_type=MemoryType.EPISODIC,
			tags={"client", "meeting"}
		)
		
		await manager.store_memory(
			content="Analysis of market trends in AI",
			memory_type=MemoryType.SEMANTIC,
			tags={"AI", "analysis", "market"}
		)
		
		# Search by tags
		ai_memories = await manager.search_memories(tags={"AI"})
		assert len(ai_memories) == 2
		
		# Search by memory type
		semantic_memories = await manager.search_memories(memory_type=MemoryType.SEMANTIC)
		assert len(semantic_memories) == 2
		
		# Search by query text
		research_memories = await manager.search_memories(query="research")
		assert len(research_memories) == 2  # Both contain "research"
		
		await manager.stop()
	
	@pytest.mark.asyncio
	async def test_memory_associations(self, memory_config):
		"""Test memory association functionality"""
		manager = MemoryManager("agent_1", memory_config)
		await manager.start()
		
		# Store related memories
		memory1_id = await manager.store_memory(
			content="Initial research findings",
			tags={"research", "phase1"}
		)
		
		memory2_id = await manager.store_memory(
			content="Follow-up analysis",
			tags={"analysis", "phase2"}
		)
		
		# Create association
		success = await manager.create_memory_association(memory1_id, memory2_id, "follows")
		assert success
		
		# Get related memories
		related = await manager.get_related_memories(memory1_id)
		assert len(related) == 1
		assert related[0].entry_id == memory2_id
		
		await manager.stop()
	
	@pytest.mark.asyncio
	async def test_memory_cleanup(self, memory_config):
		"""Test memory cleanup functionality"""
		# Use short TTL for testing
		config = MemoryConfig(
			max_short_term_entries=2,
			short_term_ttl_hours=0,  # Immediate expiration
			cleanup_interval_minutes=1
		)
		
		manager = MemoryManager("agent_1", config)
		await manager.start()
		
		# Store memory that will expire immediately
		memory_id = await manager.store_memory(
			content="Temporary content",
			memory_type=MemoryType.SHORT_TERM,
			ttl_seconds=1  # 1 second TTL
		)
		
		# Wait for expiration
		await asyncio.sleep(1.5)
		
		# Trigger cleanup
		await manager._perform_cleanup()
		
		# Memory should be cleaned up
		entry = await manager.retrieve_memory(memory_id)
		assert entry is None
		
		await manager.stop()


class TestContextManager:
	"""Test context management system"""
	
	def test_context_manager_initialization(self):
		"""Test context manager initialization"""
		manager = ContextManager()
		
		assert len(manager.contexts) == 0
		assert len(manager.agent_contexts) == 0
		assert len(manager.context_templates) > 0
	
	@pytest.mark.asyncio
	async def test_context_creation(self):
		"""Test context creation"""
		manager = ContextManager()
		await manager.start()
		
		context_id = await manager.create_context(
			scope=ContextScope.AGENT,
			name="Test Context",
			owner="agent_1"
		)
		
		assert context_id is not None
		assert context_id in manager.contexts
		
		context = manager.contexts[context_id]
		assert context.name == "Test Context"
		assert context.owner == "agent_1"
		assert "agent_1" in context.participants
		
		await manager.stop()
	
	@pytest.mark.asyncio
	async def test_shared_context_operations(self):
		"""Test shared context get/set operations"""
		manager = ContextManager()
		await manager.start()
		
		context_id = await manager.create_context(
			scope=ContextScope.CREW,
			name="Crew Context",
			owner="agent_1"
		)
		
		context = manager.contexts[context_id]
		
		# Set context value
		success = await context.set("task_status", "in_progress", agent_id="agent_1")
		assert success
		
		# Get context value
		value = await context.get("task_status", agent_id="agent_1")
		assert value == "in_progress"
		
		# Update context value
		def update_status(current):
			return "completed" if current == "in_progress" else current
		
		success = await context.update("task_status", update_status, agent_id="agent_1")
		assert success
		
		updated_value = await context.get("task_status", agent_id="agent_1")
		assert updated_value == "completed"
		
		await manager.stop()
	
	@pytest.mark.asyncio
	async def test_context_permissions(self):
		"""Test context access permissions"""
		manager = ContextManager()
		await manager.start()
		
		context_id = await manager.create_context(
			scope=ContextScope.PROJECT,
			name="Private Context",
			owner="agent_1"
		)
		
		context = manager.contexts[context_id]
		
		# Owner can set values
		success = await context.set("secret", "confidential", agent_id="agent_1")
		assert success
		
		# Non-participant cannot access
		value = await context.get("secret", agent_id="agent_2")
		assert value is None
		
		# Add participant with read permission
		await manager.add_participant(context_id, "agent_2", "read_only")
		
		# Now agent_2 can read but not write
		value = await context.get("secret", agent_id="agent_2")
		assert value == "confidential"
		
		success = await context.set("new_secret", "value", agent_id="agent_2")
		assert not success  # Should fail - read-only permission
		
		await manager.stop()
	
	@pytest.mark.asyncio
	async def test_context_observers(self):
		"""Test context change observers"""
		manager = ContextManager()
		await manager.start()
		
		context_id = await manager.create_context(
			scope=ContextScope.WORKFLOW,
			name="Observable Context",
			owner="agent_1"
		)
		
		context = manager.contexts[context_id]
		
		# Add observer
		notifications = []
		
		def observer(notification):
			notifications.append(notification)
		
		await context.add_observer("observer_1", observer)
		
		# Make changes that should trigger notifications
		await context.set("status", "started", agent_id="agent_1")
		await context.update("status", lambda x: "running", agent_id="agent_1")
		
		# Check notifications were received
		assert len(notifications) == 2
		assert notifications[0]["action"] == "set"
		assert notifications[1]["action"] == "update"
		
		await manager.stop()


class TestKnowledgeBase:
	"""Test knowledge management system"""
	
	def test_knowledge_base_initialization(self):
		"""Test knowledge base initialization"""
		kb = KnowledgeBase()
		
		assert len(kb.knowledge_graph.nodes) == 0
		assert len(kb.domain_indexes) == 0
		assert len(kb.type_indexes) == 0
	
	@pytest.mark.asyncio
	async def test_knowledge_storage_and_search(self):
		"""Test knowledge storage and retrieval"""
		kb = KnowledgeBase()
		
		# Add knowledge entries
		entry1 = KnowledgeEntry(
			title="AI Fundamentals",
			content="Artificial Intelligence is the simulation of human intelligence in machines",
			knowledge_type=KnowledgeType.CONCEPT,
			domain="technology",
			tags={"AI", "technology", "concepts"}
		)
		
		entry2 = KnowledgeEntry(
			title="Machine Learning Process",
			content="ML involves training models on data to make predictions",
			knowledge_type=KnowledgeType.PROCEDURE,
			domain="technology",
			tags={"ML", "process", "technology"}
		)
		
		id1 = await kb.add_knowledge(entry1)
		id2 = await kb.add_knowledge(entry2)
		
		assert id1 is not None
		assert id2 is not None
		
		# Search knowledge
		ai_results = await kb.search_knowledge("AI", domain="technology")
		assert len(ai_results) >= 1
		
		concept_results = await kb.search_knowledge("", knowledge_type=KnowledgeType.CONCEPT)
		assert len(concept_results) >= 1


class TestLearningSystem:
	"""Test agent learning system"""
	
	def test_learning_system_initialization(self):
		"""Test learning system initialization"""
		learning_system = LearningSystem()
		
		assert learning_system.adaptation_engine is not None
		assert len(learning_system.collective_learning) == 0
	
	@pytest.mark.asyncio
	async def test_experience_recording(self):
		"""Test experience recording and learning"""
		learning_system = LearningSystem()
		
		# Record successful experience
		experience = {
			"context": {"task_type": "research", "complexity": 0.7},
			"outcome": {"success": True, "quality_score": 0.9},
			"lessons": ["Use comprehensive sources", "Cross-validate findings"]
		}
		
		await learning_system.learn_from_experience("agent_1", experience)
		
		# Get learning insights
		insights = await learning_system.get_learning_insights("agent_1")
		assert insights is not None
		
		# Record failure experience
		failure_experience = {
			"context": {"task_type": "writing", "complexity": 0.8},
			"outcome": {"success": False, "error": "voice_inconsistency"},
			"lessons": ["Review brand guidelines", "Use voice validation"]
		}
		
		await learning_system.learn_from_experience("agent_1", failure_experience)


if __name__ == "__main__":
	pytest.main([__file__, "-v"])