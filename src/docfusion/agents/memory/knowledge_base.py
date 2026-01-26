"""
Knowledge Base

Structured knowledge management system for agent learning and
information sharing with graph-based relationships and semantic search.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional, Set, Union, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict
try:
	from uuid_extensions import uuid7str
except ImportError:
	import uuid
	def uuid7str() -> str:
		return str(uuid.uuid4())


class KnowledgeType(str, Enum):
	"""Types of knowledge entries"""
	FACT = "fact"
	RULE = "rule"
	CONCEPT = "concept"
	PROCEDURE = "procedure"
	EXPERIENCE = "experience"
	PATTERN = "pattern"
	RELATIONSHIP = "relationship"


@dataclass
class KnowledgeEntry:
	"""Individual knowledge entry"""
	knowledge_id: str = field(default_factory=uuid7str)
	title: str = ""
	content: Any = None
	knowledge_type: KnowledgeType = KnowledgeType.FACT
	domain: str = "general"
	confidence: float = 1.0
	source: str = "system"
	created_at: datetime = field(default_factory=datetime.now)
	tags: Set[str] = field(default_factory=set)
	metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass 
class KnowledgeGraph:
	"""Graph-based knowledge representation"""
	nodes: Dict[str, KnowledgeEntry] = field(default_factory=dict)
	edges: Dict[str, Set[str]] = field(default_factory=dict)
	
	def add_node(self, entry: KnowledgeEntry) -> None:
		"""Add knowledge entry as node"""
		self.nodes[entry.knowledge_id] = entry
		if entry.knowledge_id not in self.edges:
			self.edges[entry.knowledge_id] = set()
	
	def add_edge(self, from_id: str, to_id: str) -> None:
		"""Add relationship edge"""
		if from_id not in self.edges:
			self.edges[from_id] = set()
		self.edges[from_id].add(to_id)


class KnowledgeBase:
	"""
	Structured knowledge management system
	
	Provides semantic knowledge storage, graph-based relationships,
	and intelligent knowledge retrieval for agent learning.
	"""
	
	def __init__(self):
		self.knowledge_graph = KnowledgeGraph()
		self.domain_indexes: Dict[str, Set[str]] = {}
		self.type_indexes: Dict[KnowledgeType, Set[str]] = {}
		
		self.logger = logging.getLogger("knowledge_base")
		self.logger.info("Knowledge base initialized")
	
	async def add_knowledge(self, entry: KnowledgeEntry) -> str:
		"""Add knowledge entry"""
		self.knowledge_graph.add_node(entry)
		
		# Update indexes
		if entry.domain not in self.domain_indexes:
			self.domain_indexes[entry.domain] = set()
		self.domain_indexes[entry.domain].add(entry.knowledge_id)
		
		if entry.knowledge_type not in self.type_indexes:
			self.type_indexes[entry.knowledge_type] = set()
		self.type_indexes[entry.knowledge_type].add(entry.knowledge_id)
		
		return entry.knowledge_id
	
	async def search_knowledge(self, query: str, domain: Optional[str] = None,
							   knowledge_type: Optional[KnowledgeType] = None) -> List[KnowledgeEntry]:
		"""Search knowledge entries"""
		# Simplified search implementation
		results = []
		for entry in self.knowledge_graph.nodes.values():
			if domain and entry.domain != domain:
				continue
			if knowledge_type and entry.knowledge_type != knowledge_type:
				continue
			
			# Simple text matching
			if query.lower() in entry.title.lower() or query.lower() in str(entry.content).lower():
				results.append(entry)
		
		return results
	
	async def get_related_knowledge(self, knowledge_id: str, depth: int = 1) -> List[KnowledgeEntry]:
		"""Get related knowledge entries"""
		related = []
		visited = set()
		queue = [(knowledge_id, 0)]
		
		while queue:
			current_id, current_depth = queue.pop(0)
			
			if current_id in visited or current_depth > depth:
				continue
			
			visited.add(current_id)
			
			if current_id != knowledge_id and current_id in self.knowledge_graph.nodes:
				related.append(self.knowledge_graph.nodes[current_id])
			
			# Add connected nodes
			if current_depth < depth and current_id in self.knowledge_graph.edges:
				for connected_id in self.knowledge_graph.edges[current_id]:
					queue.append((connected_id, current_depth + 1))
		
		return related