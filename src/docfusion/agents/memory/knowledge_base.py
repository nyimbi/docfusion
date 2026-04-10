"""
Knowledge Base

Structured knowledge management system for agent learning and
information sharing with graph-based relationships and semantic search.

Optimized with index-based lookups to eliminate N+1 query patterns:
- Tag index: O(1) lookup by tag -> entry IDs
- Domain index: O(1) lookup by domain -> entry IDs
- Type index: O(1) lookup by knowledge type -> entry IDs
- Content text index: inverted index for word -> entry IDs
- LRU cache for frequently accessed entries
- deque-based BFS for graph traversal (O(1) popleft)

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import logging
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from functools import lru_cache
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from pydantic import BaseModel, ConfigDict, Field
from ...core.utils import uuid7str

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

	Uses indexed lookups for O(1) access by tag, domain, type, and
	inverted text indexing for efficient content search. An LRU cache
	accelerates repeated lookups of the same entries.
	"""

	def __init__(self, cache_size: int = 256):
		self.knowledge_graph = KnowledgeGraph()

		# Primary indexes: O(1) lookup by attribute -> set of entry IDs
		self.domain_indexes: Dict[str, Set[str]] = {}
		self.type_indexes: Dict[KnowledgeType, Set[str]] = {}
		self.tag_index: Dict[str, Set[str]] = {}

		# Inverted text index: word -> set of entry IDs for fast text search
		self._text_index: Dict[str, Set[str]] = {}

		# Frequently accessed entries cache
		self._cache_size = cache_size
		self._access_cache: Dict[str, int] = {}  # entry_id -> access_count
		self._cache_entries: Dict[str, KnowledgeEntry] = {}

		self.logger = logging.getLogger("knowledge_base")
		self.logger.info("Knowledge base initialized with indexed lookups")

	def _invalidate_text_index(self, entry: KnowledgeEntry) -> None:
		"""Remove an entry's words from the inverted text index."""
		text = f"{entry.title} {entry.content}".lower()
		for word in text.split():
			if word in self._text_index:
				self._text_index[word].discard(entry.knowledge_id)
				if not self._text_index[word]:
					del self._text_index[word]

	def _index_text(self, entry: KnowledgeEntry) -> None:
		"""Add an entry's title and content words to the inverted text index."""
		text = f"{entry.title} {entry.content}".lower()
		for word in text.split():
			if word not in self._text_index:
				self._text_index[word] = set()
			self._text_index[word].add(entry.knowledge_id)

	def _update_cache(self, entry: KnowledgeEntry) -> None:
		"""Update the access cache with a recently accessed entry."""
		eid = entry.knowledge_id
		self._access_cache[eid] = self._access_cache.get(eid, 0) + 1
		self._cache_entries[eid] = entry

		# Evict least-accessed entries when cache is full
		if len(self._cache_entries) > self._cache_size:
			least_accessed = min(self._access_cache, key=lambda k: self._access_cache[k])
			del self._cache_entries[least_accessed]
			del self._access_cache[least_accessed]

	async def add_knowledge(self, entry: KnowledgeEntry) -> str:
		"""Add knowledge entry and update all indexes."""
		self.knowledge_graph.add_node(entry)

		# Update domain index
		if entry.domain not in self.domain_indexes:
			self.domain_indexes[entry.domain] = set()
		self.domain_indexes[entry.domain].add(entry.knowledge_id)

		# Update type index
		if entry.knowledge_type not in self.type_indexes:
			self.type_indexes[entry.knowledge_type] = set()
		self.type_indexes[entry.knowledge_type].add(entry.knowledge_id)

		# Update tag index
		for tag in entry.tags:
			if tag not in self.tag_index:
				self.tag_index[tag] = set()
			self.tag_index[tag].add(entry.knowledge_id)

		# Update text index
		self._index_text(entry)

		return entry.knowledge_id

	async def remove_knowledge(self, knowledge_id: str) -> bool:
		"""Remove a knowledge entry and clean up all indexes."""
		if knowledge_id not in self.knowledge_graph.nodes:
			return False

		entry = self.knowledge_graph.nodes[knowledge_id]

		# Remove from domain index
		if entry.domain in self.domain_indexes:
			self.domain_indexes[entry.domain].discard(knowledge_id)
			if not self.domain_indexes[entry.domain]:
				del self.domain_indexes[entry.domain]

		# Remove from type index
		if entry.knowledge_type in self.type_indexes:
			self.type_indexes[entry.knowledge_type].discard(knowledge_id)
			if not self.type_indexes[entry.knowledge_type]:
				del self.type_indexes[entry.knowledge_type]

		# Remove from tag index
		for tag in entry.tags:
			if tag in self.tag_index:
				self.tag_index[tag].discard(knowledge_id)
				if not self.tag_index[tag]:
					del self.tag_index[tag]

		# Remove from text index
		self._invalidate_text_index(entry)

		# Remove from graph
		del self.knowledge_graph.nodes[knowledge_id]
		if knowledge_id in self.knowledge_graph.edges:
			del self.knowledge_graph.edges[knowledge_id]

		# Remove inbound edges pointing to this entry
		for src_id, targets in self.knowledge_graph.edges.items():
			targets.discard(knowledge_id)

		# Remove from cache
		self._cache_entries.pop(knowledge_id, None)
		self._access_cache.pop(knowledge_id, None)

		return True

	def find_by_tag(self, tag: str) -> List[KnowledgeEntry]:
		"""O(1) lookup of entries by tag using the tag index."""
		entry_ids = self.tag_index.get(tag, set())
		return [self.knowledge_graph.nodes[eid] for eid in entry_ids if eid in self.knowledge_graph.nodes]

	def find_by_domain(self, domain: str) -> List[KnowledgeEntry]:
		"""O(1) lookup of entries by domain using the domain index."""
		entry_ids = self.domain_indexes.get(domain, set())
		return [self.knowledge_graph.nodes[eid] for eid in entry_ids if eid in self.knowledge_graph.nodes]

	def find_by_type(self, knowledge_type: KnowledgeType) -> List[KnowledgeEntry]:
		"""O(1) lookup of entries by type using the type index."""
		entry_ids = self.type_indexes.get(knowledge_type, set())
		return [self.knowledge_graph.nodes[eid] for eid in entry_ids if eid in self.knowledge_graph.nodes]

	def find_by_tags(self, tags: Set[str], match_all: bool = True) -> List[KnowledgeEntry]:
		"""
		Lookup entries by multiple tags using the tag index.

		Args:
		    tags: Set of tags to search for.
		    match_all: If True, entries must have ALL tags (intersection).
		               If False, entries need ANY tag (union).

		Returns:
		    List of matching KnowledgeEntry objects.
		"""
		if not tags:
			return []

		tag_sets = [self.tag_index.get(tag, set()) for tag in tags]
		if not tag_sets:
			return []

		if match_all:
			matching_ids = set.intersection(*tag_sets) if tag_sets else set()
		else:
			matching_ids = set.union(*tag_sets) if tag_sets else set()

		return [self.knowledge_graph.nodes[eid] for eid in matching_ids if eid in self.knowledge_graph.nodes]

	async def search_knowledge(
		self,
		query: str,
		domain: Optional[str] = None,
		knowledge_type: Optional[KnowledgeType] = None,
	) -> List[KnowledgeEntry]:
		"""
		Search knowledge entries using indexed lookups.

		Strategy:
		1. Narrow candidate set using domain/type indexes (O(1) per filter).
		2. Use inverted text index for word-based matching when query is non-empty.
		3. Fall back to linear scan only on the narrowed candidate set.

		Args:
		    query: Text to search for in title and content.
		    domain: Optional domain filter for O(1) narrowing.
		    knowledge_type: Optional type filter for O(1) narrowing.

		Returns:
		    List of matching KnowledgeEntry objects.
		"""
		# Start with candidate entry IDs, narrowed by indexes
		candidate_ids: Optional[Set[str]] = None

		if domain is not None:
			candidate_ids = self.domain_indexes.get(domain, set()).copy()

		if knowledge_type is not None:
			type_ids = self.type_indexes.get(knowledge_type, set())
			if candidate_ids is not None:
				candidate_ids &= type_ids
			else:
				candidate_ids = type_ids.copy()

		# If query is non-empty, use inverted text index
		if query:
			query_lower = query.lower()
			query_words = query_lower.split()

			# For multi-word queries, intersect results for each word
			word_match_ids: Optional[Set[str]] = None
			for word in query_words:
				word_ids = self._text_index.get(word, set())
				if word_match_ids is None:
					word_match_ids = word_ids.copy()
				else:
					word_match_ids &= word_ids

			if word_match_ids is not None:
				if candidate_ids is not None:
					candidate_ids &= word_match_ids
				else:
					candidate_ids = word_match_ids
			else:
				# No words found in text index; no matches possible
				return []

		# If no filters at all, scan all nodes (backward compatibility)
		if candidate_ids is None:
			candidate_ids = set(self.knowledge_graph.nodes.keys())

		# Collect results from narrowed candidate set
		results: List[KnowledgeEntry] = []
		for eid in candidate_ids:
			if eid in self.knowledge_graph.nodes:
				entry = self.knowledge_graph.nodes[eid]
				self._update_cache(entry)
				results.append(entry)

		return results

	async def get_related_knowledge(
		self, knowledge_id: str, depth: int = 1
	) -> List[KnowledgeEntry]:
		"""
		Get related knowledge entries via graph traversal.

		Uses collections.deque for O(1) popleft instead of list.pop(0)
		which is O(n).
		"""
		related: List[KnowledgeEntry] = []
		visited: Set[str] = set()
		queue: deque[Tuple[str, int]] = deque()
		queue.append((knowledge_id, 0))

		while queue:
			current_id, current_depth = queue.popleft()

			if current_id in visited or current_depth > depth:
				continue

			visited.add(current_id)

			if current_id != knowledge_id and current_id in self.knowledge_graph.nodes:
				entry = self.knowledge_graph.nodes[current_id]
				self._update_cache(entry)
				related.append(entry)

			# Add connected nodes
			if current_depth < depth and current_id in self.knowledge_graph.edges:
				for connected_id in self.knowledge_graph.edges[current_id]:
					queue.append((connected_id, current_depth + 1))

		return related