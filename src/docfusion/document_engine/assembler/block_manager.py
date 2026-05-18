"""
BlockManager Module - Comprehensive Content Block Lifecycle Management

This module provides advanced content block lifecycle management for DocuFusion,
including creation, validation, versioning, dependency tracking, and usage analytics.
The BlockManager follows a repository pattern with event-driven updates and
comprehensive caching for high-performance operations.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta
from typing import Any, Protocol
from collections import defaultdict, deque
import time

from pydantic import Field, ConfigDict
from pydantic.dataclasses import dataclass as pydantic_dataclass

from .content_assembler import uuid7str


# Enhanced Data Models
@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class EnhancedContentBlock:
	"""
	Enhanced content block with full lifecycle support and comprehensive metadata.
	
	This model extends the basic ContentBlock with additional fields for version
	control, dependency tracking, usage analytics, and quality assessment.
	"""
	# Core identification (required fields first)
	block_type: str  # text, table, image, chart, section, template
	content: str
	
	# Optional fields with defaults
	block_id: str = Field(default_factory=uuid7str)
	title: str = ""
	metadata: dict[str, Any] = Field(default_factory=dict)
	tags: list[str] = Field(default_factory=list)
	
	# Relationships and organization
	dependencies: list[str] = Field(default_factory=list)
	dependents: list[str] = Field(default_factory=list)  # Reverse dependencies
	category: str = "general"
	priority: int = 0
	
	# Lifecycle management
	status: str = "draft"  # draft, review, approved, archived, deleted
	lifecycle_stage: str = "active"  # active, deprecated, obsolete
	
	# Version control
	version: str = "1.0.0"
	version_history: list[str] = Field(default_factory=list)
	parent_version: str | None = None
	branch: str = "main"
	
	# Temporal data
	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)
	last_accessed: datetime | None = None
	
	# Ownership and permissions
	created_by: str = "system"
	updated_by: str = "system"
	permissions: dict[str, list[str]] = Field(default_factory=dict)
	
	# Quality and validation
	quality_score: float = 0.0
	validation_status: str = "pending"  # pending, valid, invalid, warning
	validation_errors: list[str] = Field(default_factory=list)
	
	# Usage analytics
	access_count: int = 0
	modification_count: int = 0
	usage_score: float = 0.0
	
	# Storage and caching
	storage_location: str | None = None
	cache_key: str | None = None
	checksum: str | None = None
	
	def __post_init__(self):
		"""Post-initialization to compute derived fields."""
		if not self.checksum:
			self.checksum = self._compute_checksum()
		if not self.cache_key:
			self.cache_key = f"block:{self.block_id}:{self.version}"
	
	def _compute_checksum(self) -> str:
		"""Compute SHA-256 checksum of block content."""
		content_hash = hashlib.sha256(
			f"{self.content}{self.title}{json.dumps(self.metadata, sort_keys=True)}".encode()
		).hexdigest()
		return content_hash[:16]  # Use first 16 characters for efficiency


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class BlockVersion:
	"""
	Immutable version record for content blocks with complete history tracking.
	"""
	# Required fields
	block_id: str
	version_number: str
	created_by: str
	
	# Optional fields with defaults
	version_id: str = Field(default_factory=uuid7str)
	parent_version: str | None = None
	branch: str = "main"
	
	# Version content (immutable snapshot)
	content_snapshot: str = ""  # JSON serialized ContentBlock
	diff_from_parent: dict[str, Any] = Field(default_factory=dict)
	
	# Version metadata
	created_at: datetime = Field(default_factory=datetime.now)
	commit_message: str = ""
	tags: list[str] = Field(default_factory=list)
	
	# Validation and quality
	validation_status: str = "pending"
	quality_metrics: dict[str, float] = Field(default_factory=dict)
	
	# Storage information
	storage_size: int = 0
	compression_ratio: float = 1.0


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class DependencyGraph:
	"""
	Graph representation of block dependencies with performance optimization.
	"""
	# Required fields
	nodes: dict[str, EnhancedContentBlock] = Field(default_factory=dict)
	edges: dict[str, list[str]] = Field(default_factory=dict)  # block_id -> [dependent_ids]
	reverse_edges: dict[str, list[str]] = Field(default_factory=dict)  # block_id -> [dependency_ids]
	
	# Optional fields with defaults
	graph_id: str = Field(default_factory=uuid7str)
	
	# Graph metrics
	node_count: int = 0
	edge_count: int = 0
	max_depth: int = 0
	has_cycles: bool = False
	
	# Performance optimization
	topological_order: list[str] = Field(default_factory=list)
	strongly_connected_components: list[list[str]] = Field(default_factory=list)
	
	# Temporal tracking
	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class UsageMetrics:
	"""
	Comprehensive usage analytics for content blocks with temporal aggregation.
	"""
	# Required fields
	block_id: str
	time_period: str  # hour, day, week, month, year
	period_start: datetime
	period_end: datetime
	
	# Optional fields with defaults
	metrics_id: str = Field(default_factory=uuid7str)
	
	# Access metrics
	read_count: int = 0
	write_count: int = 0
	search_hits: int = 0
	reference_count: int = 0
	
	# Performance metrics
	avg_access_time: float = 0.0
	cache_hit_ratio: float = 0.0
	error_rate: float = 0.0
	
	# User interaction metrics
	unique_users: int = 0
	collaborative_sessions: int = 0
	modification_frequency: float = 0.0
	
	# Content quality metrics
	validation_success_rate: float = 1.0
	user_feedback_score: float = 0.0
	content_effectiveness: float = 0.0
	
	# Temporal data
	recorded_at: datetime = Field(default_factory=datetime.now)


# Service Interfaces
class BlockStorageInterface(Protocol):
	"""Abstract storage interface for pluggable storage backends."""
	
	async def store_block(self, block: EnhancedContentBlock) -> str:
		"""Store a content block and return storage ID."""
		...
	
	async def retrieve_block(self, block_id: str) -> EnhancedContentBlock | None:
		"""Retrieve a content block by ID."""
		...
	
	async def update_block(self, block_id: str, updates: dict[str, Any]) -> bool:
		"""Update an existing block with partial data."""
		...
	
	async def delete_block(self, block_id: str) -> bool:
		"""Soft delete a content block."""
		...
	
	async def search_blocks(self, query: dict[str, Any]) -> list[EnhancedContentBlock]:
		"""Search for blocks matching criteria."""
		...
	
	async def batch_operation(self, operations: list[dict[str, Any]]) -> list[str]:
		"""Perform batch operations for efficiency."""
		...


class NLPServiceInterface(Protocol):
	"""Interface for NLP services used by BlockManager."""
	
	async def extract_metadata(self, content: str) -> dict[str, Any]:
		"""Extract metadata from content."""
		...
	
	async def categorize_content(self, content: str) -> str:
		"""Automatically categorize content."""
		...
	
	async def suggest_tags(self, content: str) -> list[str]:
		"""Suggest relevant tags for content."""
		...
	
	async def assess_quality(self, content: str) -> float:
		"""Assess content quality score (0.0-1.0)."""
		...


class CacheInterface(Protocol):
	"""Interface for caching layer."""
	
	async def get(self, key: str) -> Any:
		"""Get cached value by key."""
		...
	
	async def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
		"""Set cached value with TTL."""
		...
	
	async def delete(self, key: str) -> bool:
		"""Delete cached value."""
		...
	
	async def clear_pattern(self, pattern: str) -> int:
		"""Clear all keys matching pattern."""
		...


# Core Components
class BlockRepository:
	"""
	Central storage and retrieval system for content blocks with high-performance
	operations, caching, and batch processing capabilities.
	"""
	
	def __init__(
		self,
		storage: BlockStorageInterface,
		cache: CacheInterface | None = None,
		performance_monitor: 'PerformanceMonitor' | None = None
	):
		"""
		Initialize BlockRepository with storage backend and optional caching.
		
		Args:
			storage: Storage backend implementation
			cache: Optional caching layer for performance
			performance_monitor: Optional performance tracking
		"""
		self.storage = storage
		self.cache = cache or MockCache()
		self.performance_monitor = performance_monitor or PerformanceMonitor()
		
		# Performance metrics
		self._operation_stats = {
			'total_operations': 0,
			'cache_hits': 0,
			'cache_misses': 0,
			'storage_operations': 0,
			'batch_operations': 0
		}
		
		# Connection pool for storage optimization
		self._connection_pool_size = 10
		self._active_connections = 0
	
	async def create_block(
		self,
		block: EnhancedContentBlock,
		validate: bool = True
	) -> str:
		"""
		Create a new content block with atomic operation and validation.
		
		Args:
			block: Content block to create
			validate: Whether to perform validation
			
		Returns:
			Block ID of created block
			
		Raises:
			BlockValidationException: If validation fails
			StorageException: If storage operation fails
		"""
		start_time = time.time()
		
		try:
			# Validate block if requested
			if validate:
				await self._validate_block(block)
			
			# Ensure block has proper metadata
			block.created_at = datetime.now()
			block.updated_at = block.created_at
			
			# Store in backend
			storage_id = await self.storage.store_block(block)
			
			# Cache the block for future access
			if self.cache:
				await self.cache.set(
					block.cache_key or f"block:{block.block_id}",
					block,
					ttl=3600  # 1 hour TTL
				)
			
			# Update metrics
			self._operation_stats['total_operations'] += 1
			self._operation_stats['storage_operations'] += 1
			
			# Track performance
			operation_time = time.time() - start_time
			await self.performance_monitor.track_operation_time('create_block', operation_time)
			
			return storage_id
			
		except Exception as e:
			await self.performance_monitor.track_error('create_block', str(e))
			raise BlockManagerException(f"Failed to create block: {str(e)}") from e
	
	async def get_block(self, block_id: str) -> EnhancedContentBlock | None:
		"""
		Retrieve a content block with caching and performance optimization.
		
		Args:
			block_id: ID of block to retrieve
			
		Returns:
			Content block if found, None otherwise
		"""
		start_time = time.time()
		cache_key = f"block:{block_id}"
		
		try:
			# Try cache first
			if self.cache:
				cached_block = await self.cache.get(cache_key)
				if cached_block:
					self._operation_stats['cache_hits'] += 1
					operation_time = time.time() - start_time
					await self.performance_monitor.track_operation_time('get_block_cached', operation_time)
					return cached_block
				
				self._operation_stats['cache_misses'] += 1
			
			# Fetch from storage
			block = await self.storage.retrieve_block(block_id)
			
			if block:
				# Update access tracking
				block.last_accessed = datetime.now()
				block.access_count += 1
				
				# Cache for future access
				if self.cache:
					await self.cache.set(cache_key, block, ttl=3600)
			
			# Update metrics
			self._operation_stats['total_operations'] += 1
			self._operation_stats['storage_operations'] += 1
			
			# Track performance
			operation_time = time.time() - start_time
			await self.performance_monitor.track_operation_time('get_block', operation_time)
			
			return block
			
		except Exception as e:
			await self.performance_monitor.track_error('get_block', str(e))
			raise BlockManagerException(f"Failed to retrieve block {block_id}: {str(e)}") from e
	
	async def update_block(
		self,
		block_id: str,
		updates: dict[str, Any],
		create_version: bool = True
	) -> bool:
		"""
		Update an existing block with optimistic locking and versioning.
		
		Args:
			block_id: ID of block to update
			updates: Dictionary of fields to update
			create_version: Whether to create a new version
			
		Returns:
			True if update successful, False otherwise
			
		Raises:
			BlockNotFoundException: If block doesn't exist
			VersionConflictException: If concurrent modification detected
		"""
		start_time = time.time()
		
		try:
			# Get current block
			current_block = await self.get_block(block_id)
			if not current_block:
				raise BlockNotFoundException(f"Block {block_id} not found")
			
			# Apply updates
			for field, value in updates.items():
				if hasattr(current_block, field):
					setattr(current_block, field, value)
			
			# Update metadata
			current_block.updated_at = datetime.now()
			current_block.modification_count += 1
			
			# Recompute checksum
			current_block.checksum = current_block._compute_checksum()
			
			# Update in storage
			success = await self.storage.update_block(block_id, updates)
			
			if success:
				# Invalidate cache
				if self.cache:
					await self.cache.delete(f"block:{block_id}")
					await self.cache.delete(current_block.cache_key or f"block:{block_id}")
				
				# Update metrics
				self._operation_stats['total_operations'] += 1
				self._operation_stats['storage_operations'] += 1
			
			# Track performance
			operation_time = time.time() - start_time
			await self.performance_monitor.track_operation_time('update_block', operation_time)
			
			return success
			
		except Exception as e:
			await self.performance_monitor.track_error('update_block', str(e))
			raise BlockManagerException(f"Failed to update block {block_id}: {str(e)}") from e
	
	async def delete_block(self, block_id: str, soft_delete: bool = True) -> bool:
		"""
		Delete a content block with optional soft deletion.
		
		Args:
			block_id: ID of block to delete
			soft_delete: Whether to perform soft deletion (recommended)
			
		Returns:
			True if deletion successful, False otherwise
		"""
		start_time = time.time()
		
		try:
			if soft_delete:
				# Soft delete by updating status
				success = await self.update_block(
					block_id,
					{
						'status': 'deleted',
						'lifecycle_stage': 'obsolete'
					},
					create_version=True
				)
			else:
				# Hard delete from storage
				success = await self.storage.delete_block(block_id)
				
				# Clear from cache
				if self.cache:
					await self.cache.delete(f"block:{block_id}")
			
			# Track performance
			operation_time = time.time() - start_time
			await self.performance_monitor.track_operation_time('delete_block', operation_time)
			
			return success
			
		except Exception as e:
			await self.performance_monitor.track_error('delete_block', str(e))
			raise BlockManagerException(f"Failed to delete block {block_id}: {str(e)}") from e
	
	async def search_blocks(
		self,
		criteria: dict[str, Any],
		limit: int = 100,
		offset: int = 0
	) -> list[EnhancedContentBlock]:
		"""
		Search for blocks matching specified criteria with pagination.
		
		Args:
			criteria: Search criteria dictionary
			limit: Maximum number of results
			offset: Offset for pagination
			
		Returns:
			List of matching content blocks
		"""
		start_time = time.time()
		
		try:
			# Add pagination and filtering to query
			query = {
				**criteria,
				'limit': limit,
				'offset': offset,
				'exclude_deleted': True  # Exclude soft-deleted blocks by default
			}
			
			# Search in storage
			results = await self.storage.search_blocks(query)
			
			# Update access tracking for found blocks
			for block in results:
				block.last_accessed = datetime.now()
				block.access_count += 1
			
			# Update metrics
			self._operation_stats['total_operations'] += 1
			self._operation_stats['storage_operations'] += 1
			
			# Track performance
			operation_time = time.time() - start_time
			await self.performance_monitor.track_operation_time('search_blocks', operation_time)
			
			return results
			
		except Exception as e:
			await self.performance_monitor.track_error('search_blocks', str(e))
			raise BlockManagerException(f"Failed to search blocks: {str(e)}") from e
	
	async def batch_create(self, blocks: list[EnhancedContentBlock]) -> list[str]:
		"""
		Create multiple blocks in a single batch operation for efficiency.
		
		Args:
			blocks: List of blocks to create
			
		Returns:
			List of storage IDs for created blocks
		"""
		start_time = time.time()
		
		try:
			# Prepare batch operations
			operations = []
			for block in blocks:
				block.created_at = datetime.now()
				block.updated_at = block.created_at
				operations.append({
					'operation': 'create',
					'data': block
				})
			
			# Execute batch operation
			storage_ids = await self.storage.batch_operation(operations)
			
			# Cache blocks for future access
			if self.cache:
				for block in blocks:
					cache_key = block.cache_key or f"block:{block.block_id}"
					await self.cache.set(cache_key, block, ttl=3600)
			
			# Update metrics
			self._operation_stats['total_operations'] += len(blocks)
			self._operation_stats['batch_operations'] += 1
			self._operation_stats['storage_operations'] += 1
			
			# Track performance
			operation_time = time.time() - start_time
			await self.performance_monitor.track_operation_time('batch_create', operation_time)
			
			return storage_ids
			
		except Exception as e:
			await self.performance_monitor.track_error('batch_create', str(e))
			raise BlockManagerException(f"Failed to batch create blocks: {str(e)}") from e
	
	async def get_repository_stats(self) -> dict[str, Any]:
		"""Get comprehensive repository statistics and metrics."""
		return {
			'operation_stats': self._operation_stats.copy(),
			'cache_hit_ratio': self._operation_stats['cache_hits'] / max(1, 
				self._operation_stats['cache_hits'] + self._operation_stats['cache_misses']),
			'total_operations': self._operation_stats['total_operations'],
			'performance_metrics': await self.performance_monitor.get_metrics()
		}
	
	async def _validate_block(self, block: EnhancedContentBlock) -> None:
		"""
		Validate a content block for data integrity and business rules.
		
		Args:
			block: Block to validate
			
		Raises:
			BlockValidationException: If validation fails
		"""
		errors = []
		
		# Required field validation
		if not block.block_type:
			errors.append("Block type is required")
		
		if not block.content:
			errors.append("Block content cannot be empty")
		
		# Content length validation
		if len(block.content) > 100000:  # 100KB limit
			errors.append("Block content exceeds maximum size limit")
		
		# Block type validation
		valid_types = ['text', 'table', 'image', 'chart', 'section', 'template']
		if block.block_type not in valid_types:
			errors.append(f"Invalid block type: {block.block_type}")
		
		# Status validation
		valid_statuses = ['draft', 'review', 'approved', 'archived', 'deleted']
		if block.status not in valid_statuses:
			errors.append(f"Invalid status: {block.status}")
		
		if errors:
			raise BlockValidationException(f"Block validation failed: {'; '.join(errors)}")


class VersionManager:
	"""
	Git-like version control system for content blocks with branching,
	merging, and comprehensive diff generation capabilities.
	"""
	
	def __init__(self, storage: BlockStorageInterface):
		"""
		Initialize VersionManager with storage backend.
		
		Args:
			storage: Storage backend for version persistence
		"""
		self.storage = storage
		self._version_cache: dict[str, list[BlockVersion]] = {}
		self._diff_cache: dict[str, dict[str, Any]] = {}
		
		# Version metrics
		self._metrics = {
			'versions_created': 0,
			'diffs_generated': 0,
			'rollbacks_performed': 0,
			'merges_completed': 0
		}
	
	async def create_version(
		self,
		block: EnhancedContentBlock,
		commit_message: str = "",
		created_by: str = "system"
	) -> BlockVersion:
		"""
		Create a new version of a content block with complete snapshot.
		
		Args:
			block: Content block to version
			commit_message: Description of changes
			created_by: User creating the version
			
		Returns:
			Created BlockVersion instance
		"""
		# Generate version number
		current_versions = await self.get_version_history(block.block_id)
		version_number = self._generate_version_number(current_versions, block.branch)
		
		# Create version snapshot
		version = BlockVersion(
			block_id=block.block_id,
			version_number=version_number,
			created_by=created_by,
			parent_version=block.version if current_versions else None,
			branch=block.branch,
			content_snapshot=json.dumps(block.__dict__, default=str),
			commit_message=commit_message,
			created_at=datetime.now(),
			validation_status=block.validation_status,
			storage_size=len(block.content.encode('utf-8'))
		)
		
		# Calculate diff from parent if available
		if current_versions and version.parent_version:
			parent_version = next(
				(v for v in current_versions if v.version_number == version.parent_version),
				None
			)
			if parent_version:
				version.diff_from_parent = await self._generate_diff(parent_version, version)
		
		# Store version (mock implementation would add to in-memory store)
		# await self.storage.store_version(version)
		
		# Update cache
		if block.block_id not in self._version_cache:
			self._version_cache[block.block_id] = []
		self._version_cache[block.block_id].append(version)
		
		# Update block's version info
		block.version = version_number
		block.version_history.append(version_number)
		
		# Update metrics
		self._metrics['versions_created'] += 1
		
		return version
	
	async def get_version_history(self, block_id: str) -> list[BlockVersion]:
		"""
		Get complete version history for a content block.
		
		Args:
			block_id: ID of block to get history for
			
		Returns:
			List of all versions ordered by creation time
		"""
		# Check cache first
		if block_id in self._version_cache:
			return sorted(
				self._version_cache[block_id],
				key=lambda v: v.created_at,
				reverse=True
			)
		
		# Would fetch from storage in real implementation
		# versions = await self.storage.get_versions(block_id)
		versions = []
		
		# Cache results
		self._version_cache[block_id] = versions
		
		return versions
	
	async def get_version(self, block_id: str, version_number: str) -> BlockVersion | None:
		"""
		Get a specific version of a content block.
		
		Args:
			block_id: ID of block
			version_number: Specific version to retrieve
			
		Returns:
			BlockVersion if found, None otherwise
		"""
		versions = await self.get_version_history(block_id)
		return next(
			(v for v in versions if v.version_number == version_number),
			None
		)
	
	async def compare_versions(
		self,
		block_id: str,
		version1: str,
		version2: str
	) -> dict[str, Any]:
		"""
		Generate detailed diff between two versions of a block.
		
		Args:
			block_id: ID of block
			version1: First version for comparison
			version2: Second version for comparison
			
		Returns:
			Comprehensive diff dictionary
		"""
		cache_key = f"{block_id}:{version1}:{version2}"
		
		# Check cache first
		if cache_key in self._diff_cache:
			return self._diff_cache[cache_key]
		
		# Get versions
		v1 = await self.get_version(block_id, version1)
		v2 = await self.get_version(block_id, version2)
		
		if not v1 or not v2:
			raise VersionNotFoundException(f"One or both versions not found")
		
		# Generate diff
		diff = await self._generate_diff(v1, v2)
		
		# Cache result
		self._diff_cache[cache_key] = diff
		
		# Update metrics
		self._metrics['diffs_generated'] += 1
		
		return diff
	
	async def rollback_to_version(
		self,
		block_id: str,
		target_version: str,
		created_by: str = "system"
	) -> EnhancedContentBlock:
		"""
		Rollback a block to a previous version by creating a new version.
		
		Args:
			block_id: ID of block to rollback
			target_version: Version to rollback to
			created_by: User performing rollback
			
		Returns:
			New content block at target version state
		"""
		# Get target version
		target = await self.get_version(block_id, target_version)
		if not target:
			raise VersionNotFoundException(f"Target version {target_version} not found")
		
		# Reconstruct block from version snapshot
		snapshot_data = json.loads(target.content_snapshot)
		
		# Create new block with target version content
		rolled_back_block = EnhancedContentBlock(
			block_id=block_id,
			block_type=snapshot_data['block_type'],
			content=snapshot_data['content'],
			title=snapshot_data.get('title', ''),
			metadata=snapshot_data.get('metadata', {}),
			tags=snapshot_data.get('tags', []),
			updated_at=datetime.now(),
			updated_by=created_by
		)
		
		# Create new version for rollback
		await self.create_version(
			rolled_back_block,
			commit_message=f"Rollback to version {target_version}",
			created_by=created_by
		)
		
		# Update metrics
		self._metrics['rollbacks_performed'] += 1
		
		return rolled_back_block
	
	def _generate_version_number(
		self,
		existing_versions: list[BlockVersion],
		branch: str = "main"
	) -> str:
		"""
		Generate next version number based on existing versions.
		
		Args:
			existing_versions: List of existing versions
			branch: Branch name for version
			
		Returns:
			Next version number (semantic versioning format)
		"""
		if not existing_versions:
			return "1.0.0"
		
		# Find highest version number for branch
		branch_versions = [v for v in existing_versions if v.branch == branch]
		if not branch_versions:
			return "1.0.0"
		
		# Get latest version and increment patch number
		latest = max(branch_versions, key=lambda v: v.created_at)
		major, minor, patch = map(int, latest.version_number.split('.'))
		
		return f"{major}.{minor}.{patch + 1}"
	
	async def _generate_diff(
		self,
		version1: BlockVersion,
		version2: BlockVersion
	) -> dict[str, Any]:
		"""
		Generate comprehensive diff between two versions.
		
		Args:
			version1: First version
			version2: Second version
			
		Returns:
			Detailed diff dictionary
		"""
		# Parse snapshots
		data1 = json.loads(version1.content_snapshot)
		data2 = json.loads(version2.content_snapshot)
		
		diff = {
			'version1': version1.version_number,
			'version2': version2.version_number,
			'created_at': datetime.now().isoformat(),
			'changes': [],
			'statistics': {
				'fields_changed': 0,
				'content_size_change': 0,
				'lines_added': 0,
				'lines_removed': 0
			}
		}
		
		# Compare each field
		for field_name in set(data1.keys()) | set(data2.keys()):
			old_value = data1.get(field_name)
			new_value = data2.get(field_name)
			
			if old_value != new_value:
				diff['changes'].append({
					'field': field_name,
					'old_value': old_value,
					'new_value': new_value,
					'change_type': self._classify_change(old_value, new_value)
				})
				diff['statistics']['fields_changed'] += 1
		
		# Calculate content-specific diffs
		if 'content' in data1 and 'content' in data2:
			content_diff = self._generate_content_diff(data1['content'], data2['content'])
			diff.update(content_diff)
		
		return diff
	
	def _classify_change(self, old_value: Any, new_value: Any) -> str:
		"""Classify the type of change between two values."""
		if old_value is None:
			return "added"
		elif new_value is None:
			return "removed"
		else:
			return "modified"
	
	def _generate_content_diff(self, content1: str, content2: str) -> dict[str, Any]:
		"""Generate line-by-line diff for content."""
		lines1 = content1.splitlines()
		lines2 = content2.splitlines()
		
		# Simple diff implementation (would use difflib in production)
		return {
			'content_diff': {
				'lines_added': max(0, len(lines2) - len(lines1)),
				'lines_removed': max(0, len(lines1) - len(lines2)),
				'total_lines_old': len(lines1),
				'total_lines_new': len(lines2)
			}
		}
	
	async def get_version_metrics(self) -> dict[str, Any]:
		"""Get version management metrics and statistics."""
		return {
			'metrics': self._metrics.copy(),
			'cache_stats': {
				'version_cache_size': len(self._version_cache),
				'diff_cache_size': len(self._diff_cache),
				'total_cached_versions': sum(len(versions) for versions in self._version_cache.values())
			}
		}


class DependencyTracker:
	"""
	Intelligent dependency relationship management with graph algorithms,
	impact analysis, and circular dependency detection.
	"""
	
	def __init__(self):
		"""Initialize DependencyTracker with empty dependency graph."""
		self.dependency_graph = DependencyGraph()
		self._impact_cache: dict[str, dict[str, Any]] = {}
		
		# Performance optimization
		self._graph_dirty = False
		self._last_update = datetime.now()
		
		# Tracking metrics
		self._metrics = {
			'dependencies_added': 0,
			'dependencies_removed': 0,
			'cycles_detected': 0,
			'impact_analyses': 0
		}
	
	async def add_dependency(self, dependent_id: str, dependency_id: str) -> bool:
		"""
		Add a dependency relationship between two blocks.
		
		Args:
			dependent_id: ID of block that depends on another
			dependency_id: ID of block being depended upon
			
		Returns:
			True if dependency added successfully, False if would create cycle
		"""
		# Check if adding this dependency would create a cycle
		if await self._would_create_cycle(dependent_id, dependency_id):
			self._metrics['cycles_detected'] += 1
			return False
		
		# Add to forward edges (dependency -> dependents)
		if dependency_id not in self.dependency_graph.edges:
			self.dependency_graph.edges[dependency_id] = []
		
		if dependent_id not in self.dependency_graph.edges[dependency_id]:
			self.dependency_graph.edges[dependency_id].append(dependent_id)
		
		# Add to reverse edges (dependent -> dependencies)
		if dependent_id not in self.dependency_graph.reverse_edges:
			self.dependency_graph.reverse_edges[dependent_id] = []
		
		if dependency_id not in self.dependency_graph.reverse_edges[dependent_id]:
			self.dependency_graph.reverse_edges[dependent_id].append(dependency_id)
		
		# Update graph metadata
		self.dependency_graph.edge_count += 1
		self.dependency_graph.updated_at = datetime.now()
		self._graph_dirty = True
		
		# Clear impact cache as graph structure changed
		self._impact_cache.clear()
		
		# Update metrics
		self._metrics['dependencies_added'] += 1
		
		return True
	
	async def remove_dependency(self, dependent_id: str, dependency_id: str) -> bool:
		"""
		Remove a dependency relationship between two blocks.
		
		Args:
			dependent_id: ID of dependent block
			dependency_id: ID of dependency block
			
		Returns:
			True if dependency removed successfully
		"""
		# Remove from forward edges
		if dependency_id in self.dependency_graph.edges:
			if dependent_id in self.dependency_graph.edges[dependency_id]:
				self.dependency_graph.edges[dependency_id].remove(dependent_id)
				
				# Clean up empty lists
				if not self.dependency_graph.edges[dependency_id]:
					del self.dependency_graph.edges[dependency_id]
		
		# Remove from reverse edges
		if dependent_id in self.dependency_graph.reverse_edges:
			if dependency_id in self.dependency_graph.reverse_edges[dependent_id]:
				self.dependency_graph.reverse_edges[dependent_id].remove(dependency_id)
				
				# Clean up empty lists
				if not self.dependency_graph.reverse_edges[dependent_id]:
					del self.dependency_graph.reverse_edges[dependent_id]
		
		# Update graph metadata
		self.dependency_graph.edge_count = max(0, self.dependency_graph.edge_count - 1)
		self.dependency_graph.updated_at = datetime.now()
		self._graph_dirty = True
		
		# Clear impact cache
		self._impact_cache.clear()
		
		# Update metrics
		self._metrics['dependencies_removed'] += 1
		
		return True
	
	async def get_dependencies(self, block_id: str) -> list[str]:
		"""
		Get all direct dependencies of a block.
		
		Args:
			block_id: ID of block to get dependencies for
			
		Returns:
			List of dependency block IDs
		"""
		return self.dependency_graph.reverse_edges.get(block_id, []).copy()
	
	async def get_dependents(self, block_id: str) -> list[str]:
		"""
		Get all direct dependents of a block.
		
		Args:
			block_id: ID of block to get dependents for
			
		Returns:
			List of dependent block IDs
		"""
		return self.dependency_graph.edges.get(block_id, []).copy()
	
	async def get_all_dependents(self, block_id: str) -> list[str]:
		"""
		Get all blocks that transitively depend on this block.
		
		Args:
			block_id: ID of block to analyze
			
		Returns:
			List of all transitively dependent block IDs
		"""
		visited = set()
		all_dependents = []
		
		def _collect_dependents(current_id: str):
			if current_id in visited:
				return
			
			visited.add(current_id)
			direct_dependents = self.dependency_graph.edges.get(current_id, [])
			
			for dependent_id in direct_dependents:
				if dependent_id not in all_dependents:
					all_dependents.append(dependent_id)
				_collect_dependents(dependent_id)
		
		_collect_dependents(block_id)
		return all_dependents
	
	async def detect_cycles(self) -> list[list[str]]:
		"""
		Detect all cycles in the dependency graph.
		
		Returns:
			List of cycles, where each cycle is a list of block IDs
		"""
		cycles = []
		visited = set()
		rec_stack = set()
		
		def _dfs_cycle_detection(node: str, path: list[str]) -> bool:
			if node in rec_stack:
				# Found a cycle, extract it
				cycle_start = path.index(node)
				cycle = path[cycle_start:] + [node]
				cycles.append(cycle)
				return True
			
			if node in visited:
				return False
			
			visited.add(node)
			rec_stack.add(node)
			path.append(node)
			
			# Check all dependencies
			for dependency in self.dependency_graph.reverse_edges.get(node, []):
				if _dfs_cycle_detection(dependency, path):
					# Continue to find all cycles
					pass
			
			rec_stack.remove(node)
			path.pop()
			return False
		
		# Check each node as potential cycle start
		for node in self.dependency_graph.reverse_edges:
			if node not in visited:
				_dfs_cycle_detection(node, [])
		
		# Update graph metadata
		self.dependency_graph.has_cycles = len(cycles) > 0
		
		return cycles
	
	async def impact_analysis(self, block_id: str) -> dict[str, Any]:
		"""
		Analyze the impact of changes to a specific block.
		
		Args:
			block_id: ID of block to analyze impact for
			
		Returns:
			Comprehensive impact analysis
		"""
		cache_key = f"impact:{block_id}"
		
		# Check cache first
		if cache_key in self._impact_cache:
			return self._impact_cache[cache_key]
		
		# Get all affected blocks
		direct_dependents = await self.get_dependents(block_id)
		all_dependents = await self.get_all_dependents(block_id)
		
		# Calculate impact metrics
		impact = {
			'analyzed_block': block_id,
			'analysis_timestamp': datetime.now().isoformat(),
			'direct_dependents': direct_dependents,
			'all_dependents': all_dependents,
			'impact_scope': {
				'direct_impact_count': len(direct_dependents),
				'total_impact_count': len(all_dependents),
				'impact_depth': self._calculate_max_depth(block_id),
				'impact_breadth': len(set(all_dependents))
			},
			'risk_assessment': self._assess_change_risk(len(all_dependents)),
			'recommendations': self._generate_impact_recommendations(len(all_dependents))
		}
		
		# Cache result
		self._impact_cache[cache_key] = impact
		
		# Update metrics
		self._metrics['impact_analyses'] += 1
		
		return impact
	
	async def get_topological_order(self) -> list[str]:
		"""
		Get topological ordering of all blocks in dependency graph.
		
		Returns:
			List of block IDs in topological order
		"""
		if not self._graph_dirty and self.dependency_graph.topological_order:
			return self.dependency_graph.topological_order.copy()
		
		# Kahn's algorithm for topological sorting
		in_degree = {}
		all_nodes = set()
		
		# Initialize in-degree count
		for node in self.dependency_graph.reverse_edges:
			all_nodes.add(node)
			in_degree[node] = len(self.dependency_graph.reverse_edges[node])
		
		for node in self.dependency_graph.edges:
			all_nodes.add(node)
			if node not in in_degree:
				in_degree[node] = 0
		
		# Find nodes with no incoming edges
		queue = deque([node for node in all_nodes if in_degree[node] == 0])
		topo_order = []
		
		while queue:
			current = queue.popleft()
			topo_order.append(current)
			
			# Remove edges from current node
			for dependent in self.dependency_graph.edges.get(current, []):
				in_degree[dependent] -= 1
				if in_degree[dependent] == 0:
					queue.append(dependent)
		
		# Check for cycles
		if len(topo_order) != len(all_nodes):
			# Cycle detected
			self.dependency_graph.has_cycles = True
		else:
			self.dependency_graph.topological_order = topo_order
			self._graph_dirty = False
		
		return topo_order
	
	async def _would_create_cycle(self, dependent_id: str, dependency_id: str) -> bool:
		"""
		Check if adding a dependency would create a cycle.
		
		Args:
			dependent_id: ID of dependent block
			dependency_id: ID of dependency block
			
		Returns:
			True if cycle would be created, False otherwise
		"""
		# If dependency_id can reach dependent_id, adding this edge creates a cycle
		visited = set()
		
		def _can_reach(from_id: str, to_id: str) -> bool:
			if from_id == to_id:
				return True
			
			if from_id in visited:
				return False
			
			visited.add(from_id)
			
			# Check all dependents of from_id
			for dependent in self.dependency_graph.edges.get(from_id, []):
				if _can_reach(dependent, to_id):
					return True
			
			return False
		
		return _can_reach(dependency_id, dependent_id)
	
	def _calculate_max_depth(self, block_id: str) -> int:
		"""Calculate maximum depth of dependency chain from block."""
		visited = set()
		
		def _dfs_depth(node: str) -> int:
			if node in visited:
				return 0
			
			visited.add(node)
			max_child_depth = 0
			
			for dependent in self.dependency_graph.edges.get(node, []):
				child_depth = _dfs_depth(dependent)
				max_child_depth = max(max_child_depth, child_depth)
			
			return max_child_depth + 1
		
		return _dfs_depth(block_id) - 1  # Subtract 1 as we don't count the starting node
	
	def _assess_change_risk(self, impact_count: int) -> str:
		"""Assess risk level based on impact count."""
		if impact_count == 0:
			return "low"
		elif impact_count <= 5:
			return "medium"
		elif impact_count <= 20:
			return "high"
		else:
			return "critical"
	
	def _generate_impact_recommendations(self, impact_count: int) -> list[str]:
		"""Generate recommendations based on impact analysis."""
		recommendations = []
		
		if impact_count == 0:
			recommendations.append("No dependent blocks - safe to modify")
		elif impact_count <= 5:
			recommendations.append("Review dependent blocks before making changes")
			recommendations.append("Consider notifying stakeholders of affected content")
		elif impact_count <= 20:
			recommendations.append("Extensive testing recommended before changes")
			recommendations.append("Consider staging changes in development environment")
			recommendations.append("Notify all stakeholders of potential impact")
		else:
			recommendations.append("Critical impact - requires careful change management")
			recommendations.append("Mandatory testing and validation process")
			recommendations.append("Consider breaking changes into smaller increments")
			recommendations.append("Full stakeholder review and approval required")
		
		return recommendations
	
	async def get_dependency_metrics(self) -> dict[str, Any]:
		"""Get comprehensive dependency tracking metrics."""
		cycles = await self.detect_cycles()
		
		return {
			'metrics': self._metrics.copy(),
			'graph_stats': {
				'total_nodes': len(set(list(self.dependency_graph.edges.keys()) + 
									list(self.dependency_graph.reverse_edges.keys()))),
				'total_edges': self.dependency_graph.edge_count,
				'cycles_count': len(cycles),
				'has_cycles': len(cycles) > 0,
				'max_depth': self.dependency_graph.max_depth,
				'cache_size': len(self._impact_cache)
			},
			'performance': {
				'last_update': self._last_update.isoformat(),
				'graph_dirty': self._graph_dirty
			}
		}


# Mock Implementations for Phase 1
class MockBlockStorage:
	"""Mock storage implementation for development and testing."""
	
	def __init__(self):
		self.blocks: dict[str, EnhancedContentBlock] = {}
		self.operation_log: list[dict[str, Any]] = []
	
	async def store_block(self, block: EnhancedContentBlock) -> str:
		"""Store block in memory."""
		storage_id = f"storage_{block.block_id}"
		self.blocks[block.block_id] = block
		
		self.operation_log.append({
			'operation': 'store',
			'block_id': block.block_id,
			'timestamp': datetime.now().isoformat()
		})
		
		return storage_id
	
	async def retrieve_block(self, block_id: str) -> EnhancedContentBlock | None:
		"""Retrieve block from memory."""
		block = self.blocks.get(block_id)
		
		if block:
			self.operation_log.append({
				'operation': 'retrieve',
				'block_id': block_id,
				'timestamp': datetime.now().isoformat()
			})
		
		return block
	
	async def update_block(self, block_id: str, updates: dict[str, Any]) -> bool:
		"""Update block in memory."""
		if block_id not in self.blocks:
			return False
		
		block = self.blocks[block_id]
		for field_name, value in updates.items():
			if hasattr(block, field_name):
				setattr(block, field_name, value)
		
		self.operation_log.append({
			'operation': 'update',
			'block_id': block_id,
			'updates': list(updates.keys()),
			'timestamp': datetime.now().isoformat()
		})
		
		return True
	
	async def delete_block(self, block_id: str) -> bool:
		"""Delete block from memory."""
		if block_id in self.blocks:
			del self.blocks[block_id]
			
			self.operation_log.append({
				'operation': 'delete',
				'block_id': block_id,
				'timestamp': datetime.now().isoformat()
			})
			
			return True
		
		return False
	
	async def search_blocks(self, query: dict[str, Any]) -> list[EnhancedContentBlock]:
		"""Search blocks in memory with basic filtering."""
		results = []
		
		for block in self.blocks.values():
			# Skip deleted blocks unless explicitly requested
			if query.get('exclude_deleted', True) and block.status == 'deleted':
				continue
			
			# Simple filtering based on query parameters
			matches = True
			
			if 'block_type' in query and block.block_type != query['block_type']:
				matches = False
			
			if 'status' in query and block.status != query['status']:
				matches = False
			
			if 'category' in query and block.category != query['category']:
				matches = False
			
			if 'tags' in query:
				query_tags = query['tags'] if isinstance(query['tags'], list) else [query['tags']]
				if not any(tag in block.tags for tag in query_tags):
					matches = False
			
			if 'content_search' in query:
				search_term = query['content_search'].lower()
				if search_term not in block.content.lower() and search_term not in block.title.lower():
					matches = False
			
			if matches:
				results.append(block)
		
		# Apply pagination
		offset = query.get('offset', 0)
		limit = query.get('limit', 100)
		
		self.operation_log.append({
			'operation': 'search',
			'query': query,
			'results_count': len(results),
			'timestamp': datetime.now().isoformat()
		})
		
		return results[offset:offset + limit]
	
	async def batch_operation(self, operations: list[dict[str, Any]]) -> list[str]:
		"""Perform batch operations."""
		storage_ids = []
		
		for operation in operations:
			op_type = operation['operation']
			
			if op_type == 'create':
				block = operation['data']
				storage_id = await self.store_block(block)
				storage_ids.append(storage_id)
			
			# Add support for other batch operations as needed
		
		return storage_ids


class MockCache:
	"""Mock cache implementation for development."""
	
	def __init__(self):
		self.cache: dict[str, tuple[Any, datetime]] = {}
		self.default_ttl = 3600  # 1 hour
	
	async def get(self, key: str) -> Any:
		"""Get value from cache if not expired."""
		if key in self.cache:
			value, expiry = self.cache[key]
			if datetime.now() < expiry:
				return value
			else:
				# Expired, remove from cache
				del self.cache[key]
		
		return None
	
	async def set(self, key: str, value: Any, ttl: int = None) -> bool:
		"""Set value in cache with TTL."""
		ttl = ttl or self.default_ttl
		expiry = datetime.now() + timedelta(seconds=ttl)
		self.cache[key] = (value, expiry)
		return True
	
	async def delete(self, key: str) -> bool:
		"""Delete value from cache."""
		if key in self.cache:
			del self.cache[key]
			return True
		return False
	
	async def clear_pattern(self, pattern: str) -> int:
		"""Clear keys matching pattern."""
		keys_to_delete = [key for key in self.cache.keys() if pattern in key]
		for key in keys_to_delete:
			del self.cache[key]
		return len(keys_to_delete)


class MockNLPService:
	"""Mock NLP service for development."""
	
	async def extract_metadata(self, content: str) -> dict[str, Any]:
		"""Extract basic metadata from content."""
		return {
			'word_count': len(content.split()),
			'estimated_reading_time': len(content.split()) / 200,
			'language': 'en',
			'complexity_score': min(1.0, len(content) / 1000),
			'topics': ['general', 'content']
		}
	
	async def categorize_content(self, content: str) -> str:
		"""Simple content categorization."""
		content_lower = content.lower()
		
		if any(word in content_lower for word in ['table', 'data', 'chart']):
			return 'data'
		elif any(word in content_lower for word in ['image', 'figure', 'diagram']):
			return 'visual'
		elif any(word in content_lower for word in ['section', 'chapter', 'heading']):
			return 'structure'
		else:
			return 'general'
	
	async def suggest_tags(self, content: str) -> list[str]:
		"""Generate tag suggestions based on content."""
		suggestions = []
		content_lower = content.lower()
		
		# Simple keyword-based tagging
		if 'technical' in content_lower:
			suggestions.append('technical')
		if 'business' in content_lower:
			suggestions.append('business')
		if 'important' in content_lower:
			suggestions.append('important')
		if len(content) > 1000:
			suggestions.append('detailed')
		
		return suggestions[:5]  # Limit to 5 suggestions
	
	async def assess_quality(self, content: str) -> float:
		"""Assess content quality (mock implementation)."""
		# Simple quality assessment based on length and structure
		base_score = 0.7
		
		# Bonus for appropriate length
		if 100 <= len(content) <= 2000:
			base_score += 0.1
		
		# Bonus for proper sentences
		if '.' in content:
			base_score += 0.1
		
		# Penalty for very short content
		if len(content) < 50:
			base_score -= 0.3
		
		return max(0.0, min(1.0, base_score))


class PerformanceMonitor:
	"""Performance monitoring and metrics collection."""
	
	def __init__(self):
		self.operation_times: dict[str, list[float]] = defaultdict(list)
		self.error_counts: dict[str, int] = defaultdict(int)
		self.start_time = datetime.now()
	
	async def track_operation_time(self, operation: str, duration: float) -> None:
		"""Track operation execution time."""
		self.operation_times[operation].append(duration)
		
		# Keep only last 1000 measurements for memory efficiency
		if len(self.operation_times[operation]) > 1000:
			self.operation_times[operation] = self.operation_times[operation][-1000:]
	
	async def track_error(self, operation: str, error: str) -> None:
		"""Track operation errors."""
		self.error_counts[f"{operation}:{error}"] += 1
	
	async def get_metrics(self) -> dict[str, Any]:
		"""Get comprehensive performance metrics."""
		metrics = {
			'uptime_seconds': (datetime.now() - self.start_time).total_seconds(),
			'operations': {}
		}
		
		# Calculate statistics for each operation
		for operation, times in self.operation_times.items():
			if times:
				metrics['operations'][operation] = {
					'count': len(times),
					'avg_time': sum(times) / len(times),
					'min_time': min(times),
					'max_time': max(times),
					'total_time': sum(times)
				}
		
		metrics['errors'] = dict(self.error_counts)
		return metrics


# Main BlockManager Class
class BlockManager:
	"""
	Main BlockManager class that orchestrates all content block lifecycle
	operations including creation, versioning, dependency tracking, and analytics.
	"""
	
	def __init__(
		self,
		storage: BlockStorageInterface | None = None,
		nlp_service: NLPServiceInterface | None = None,
		cache: CacheInterface | None = None
	):
		"""
		Initialize BlockManager with service dependencies.
		
		Args:
			storage: Storage backend (optional, will use mock)
			nlp_service: NLP service (optional, will use mock)
			cache: Cache layer (optional, will use mock)
		"""
		# Initialize service dependencies
		self.storage = storage or MockBlockStorage()
		self.nlp_service = nlp_service or MockNLPService()
		self.cache = cache or MockCache()
		
		# Initialize core components
		self.performance_monitor = PerformanceMonitor()
		self.repository = BlockRepository(self.storage, self.cache, self.performance_monitor)
		self.version_manager = VersionManager(self.storage)
		self.dependency_tracker = DependencyTracker()
		
		# Usage analytics storage
		self.usage_metrics: dict[str, UsageMetrics] = {}
		
		# BlockManager metrics
		self._metrics = {
			'blocks_created': 0,
			'blocks_updated': 0,
			'blocks_deleted': 0,
			'versions_created': 0,
			'dependencies_managed': 0
		}
	
	async def create_block(
		self,
		block_type: str,
		content: str,
		title: str = "",
		metadata: dict[str, Any] | None = None,
		tags: list[str] | None = None,
		dependencies: list[str] | None = None,
		created_by: str = "system"
	) -> EnhancedContentBlock:
		"""
		Create a new content block with comprehensive lifecycle management.
		
		Args:
			block_type: Type of block (text, table, image, etc.)
			content: Block content
			title: Optional title
			metadata: Optional metadata dictionary
			tags: Optional tags list
			dependencies: Optional dependency block IDs
			created_by: User creating the block
			
		Returns:
			Created EnhancedContentBlock
			
		Raises:
			BlockValidationException: If block validation fails
		"""
		start_time = time.time()
		
		try:
			# Create enhanced content block
			block = EnhancedContentBlock(
				block_type=block_type,
				content=content,
				title=title,
				metadata=metadata or {},
				tags=tags or [],
				dependencies=dependencies or [],
				created_by=created_by,
				updated_by=created_by
			)
			
			# Enrich with NLP analysis
			await self._enrich_block_metadata(block)
			
			# Validate dependencies
			if block.dependencies:
				await self._validate_dependencies(block.dependencies)
			
			# Store in repository
			storage_id = await self.repository.create_block(block)
			block.storage_location = storage_id
			
			# Create initial version
			await self.version_manager.create_version(
				block,
				commit_message="Initial version",
				created_by=created_by
			)
			
			# Register dependencies
			for dep_id in block.dependencies:
				await self.dependency_tracker.add_dependency(block.block_id, dep_id)
			
			# Initialize usage metrics
			await self._initialize_usage_metrics(block.block_id)
			
			# Update metrics
			self._metrics['blocks_created'] += 1
			
			# Track performance
			operation_time = time.time() - start_time
			await self.performance_monitor.track_operation_time('create_block', operation_time)
			
			return block
			
		except Exception as e:
			await self.performance_monitor.track_error('create_block', str(e))
			raise BlockManagerException(f"Failed to create block: {str(e)}") from e
	
	async def get_block(self, block_id: str) -> EnhancedContentBlock | None:
		"""
		Retrieve a content block with usage tracking.
		
		Args:
			block_id: ID of block to retrieve
			
		Returns:
			Content block if found, None otherwise
		"""
		block = await self.repository.get_block(block_id)
		
		if block:
			# Track usage
			await self._track_block_access(block_id, 'read')
		
		return block
	
	async def update_block(
		self,
		block_id: str,
		updates: dict[str, Any],
		updated_by: str = "system",
		commit_message: str = ""
	) -> bool:
		"""
		Update a content block with versioning and dependency validation.
		
		Args:
			block_id: ID of block to update
			updates: Dictionary of fields to update
			updated_by: User performing update
			commit_message: Description of changes
			
		Returns:
			True if update successful
		"""
		start_time = time.time()
		
		try:
			# Get current block
			current_block = await self.get_block(block_id)
			if not current_block:
				raise BlockNotFoundException(f"Block {block_id} not found")
			
			# Validate dependency updates
			if 'dependencies' in updates:
				await self._validate_dependencies(updates['dependencies'])
				
				# Update dependency relationships
				old_deps = set(current_block.dependencies)
				new_deps = set(updates['dependencies'])
				
				# Remove old dependencies
				for dep_id in old_deps - new_deps:
					await self.dependency_tracker.remove_dependency(block_id, dep_id)
				
				# Add new dependencies
				for dep_id in new_deps - old_deps:
					success = await self.dependency_tracker.add_dependency(block_id, dep_id)
					if not success:
						raise CircularDependencyException(
							f"Adding dependency {dep_id} would create circular dependency"
						)
			
			# Add update metadata
			updates.update({
				'updated_by': updated_by,
				'updated_at': datetime.now()
			})
			
			# Re-enrich metadata if content changed
			if 'content' in updates:
				temp_block = EnhancedContentBlock(
					block_type=current_block.block_type,
					content=updates['content'],
					title=updates.get('title', current_block.title)
				)
				await self._enrich_block_metadata(temp_block)
				
				# Update with enriched metadata
				updates.update({
					'quality_score': temp_block.quality_score,
					'category': temp_block.category
				})
			
			# Update in repository
			success = await self.repository.update_block(block_id, updates)
			
			if success:
				# Get updated block for versioning
				updated_block = await self.repository.get_block(block_id)
				if updated_block:
					# Create new version
					await self.version_manager.create_version(
						updated_block,
						commit_message=commit_message or "Block updated",
						created_by=updated_by
					)
				
				# Track usage
				await self._track_block_access(block_id, 'write')
				
				# Update metrics
				self._metrics['blocks_updated'] += 1
			
			# Track performance
			operation_time = time.time() - start_time
			await self.performance_monitor.track_operation_time('update_block', operation_time)
			
			return success
			
		except Exception as e:
			await self.performance_monitor.track_error('update_block', str(e))
			raise BlockManagerException(f"Failed to update block {block_id}: {str(e)}") from e
	
	async def delete_block(
		self,
		block_id: str,
		deleted_by: str = "system",
		soft_delete: bool = True
	) -> bool:
		"""
		Delete a content block with dependency validation.
		
		Args:
			block_id: ID of block to delete
			deleted_by: User performing deletion
			soft_delete: Whether to soft delete (recommended)
			
		Returns:
			True if deletion successful
		"""
		start_time = time.time()
		
		try:
			# Check for dependents
			dependents = await self.dependency_tracker.get_dependents(block_id)
			if dependents and not soft_delete:
				raise DependencyException(
					f"Cannot delete block {block_id}: has {len(dependents)} dependents"
				)
			
			# Perform deletion
			if soft_delete:
				success = await self.update_block(
					block_id,
					{
						'status': 'deleted',
						'lifecycle_stage': 'obsolete'
					},
					updated_by=deleted_by,
					commit_message="Block deleted"
				)
			else:
				# Remove all dependencies first
				dependencies = await self.dependency_tracker.get_dependencies(block_id)
				for dep_id in dependencies:
					await self.dependency_tracker.remove_dependency(block_id, dep_id)
				
				# Remove as dependency from others
				for dependent_id in dependents:
					await self.dependency_tracker.remove_dependency(dependent_id, block_id)
				
				success = await self.repository.delete_block(block_id, soft_delete=False)
			
			if success:
				# Update metrics
				self._metrics['blocks_deleted'] += 1
			
			# Track performance
			operation_time = time.time() - start_time
			await self.performance_monitor.track_operation_time('delete_block', operation_time)
			
			return success
			
		except Exception as e:
			await self.performance_monitor.track_error('delete_block', str(e))
			raise BlockManagerException(f"Failed to delete block {block_id}: {str(e)}") from e
	
	async def search_blocks(
		self,
		criteria: dict[str, Any],
		limit: int = 100,
		offset: int = 0
	) -> list[EnhancedContentBlock]:
		"""
		Search for blocks with comprehensive filtering and ranking.
		
		Args:
			criteria: Search criteria
			limit: Maximum results to return
			offset: Offset for pagination
			
		Returns:
			List of matching blocks
		"""
		results = await self.repository.search_blocks(criteria, limit, offset)
		
		# Track search usage for each result
		for block in results:
			await self._track_block_access(block.block_id, 'search')
		
		return results
	
	async def get_version_history(self, block_id: str) -> list[BlockVersion]:
		"""Get complete version history for a block."""
		return await self.version_manager.get_version_history(block_id)
	
	async def rollback_block(
		self,
		block_id: str,
		target_version: str,
		rolled_back_by: str = "system"
	) -> EnhancedContentBlock:
		"""Rollback a block to a previous version."""
		rolled_back_block = await self.version_manager.rollback_to_version(
			block_id, target_version, rolled_back_by
		)
		
		# Update in repository
		await self.repository.update_block(
			block_id,
			rolled_back_block.__dict__,
			create_version=False  # Version already created by rollback
		)
		
		return rolled_back_block
	
	async def get_impact_analysis(self, block_id: str) -> dict[str, Any]:
		"""Get comprehensive impact analysis for a block."""
		return await self.dependency_tracker.impact_analysis(block_id)
	
	async def get_usage_metrics(
		self,
		block_id: str,
		time_period: str = "day"
	) -> UsageMetrics | None:
		"""Get usage metrics for a specific block and time period."""
		metrics_key = f"{block_id}:{time_period}"
		return self.usage_metrics.get(metrics_key)
	
	async def get_manager_stats(self) -> dict[str, Any]:
		"""Get comprehensive BlockManager statistics."""
		repo_stats = await self.repository.get_repository_stats()
		version_metrics = await self.version_manager.get_version_metrics()
		dependency_metrics = await self.dependency_tracker.get_dependency_metrics()
		performance_metrics = await self.performance_monitor.get_metrics()
		
		return {
			'block_manager_metrics': self._metrics.copy(),
			'repository_stats': repo_stats,
			'version_metrics': version_metrics,
			'dependency_metrics': dependency_metrics,
			'performance_metrics': performance_metrics,
			'usage_metrics_count': len(self.usage_metrics)
		}
	
	async def _enrich_block_metadata(self, block: EnhancedContentBlock) -> None:
		"""Enrich block with NLP-generated metadata."""
		try:
			# Extract metadata
			extracted_metadata = await self.nlp_service.extract_metadata(block.content)
			block.metadata.update(extracted_metadata)
			
			# Categorize content
			category = await self.nlp_service.categorize_content(block.content)
			block.category = category
			
			# Suggest tags
			if not block.tags:
				suggested_tags = await self.nlp_service.suggest_tags(block.content)
				block.tags.extend(suggested_tags)
			
			# Assess quality
			quality_score = await self.nlp_service.assess_quality(block.content)
			block.quality_score = quality_score
			
			# Set validation status based on quality
			if quality_score >= 0.8:
				block.validation_status = "valid"
			elif quality_score >= 0.6:
				block.validation_status = "warning"
			else:
				block.validation_status = "invalid"
				block.validation_errors.append("Low content quality score")
			
		except Exception as e:
			# Don't fail block creation if metadata enrichment fails
			block.validation_errors.append(f"Metadata enrichment failed: {str(e)}")
	
	async def _validate_dependencies(self, dependency_ids: list[str]) -> None:
		"""Validate that all dependency blocks exist."""
		for dep_id in dependency_ids:
			dependent_block = await self.repository.get_block(dep_id)
			if not dependent_block:
				raise MissingDependencyException(f"Dependency block {dep_id} not found")
			
			if dependent_block.status == 'deleted':
				raise InvalidDependencyException(f"Cannot depend on deleted block {dep_id}")
	
	async def _initialize_usage_metrics(self, block_id: str) -> None:
		"""Initialize usage metrics for a new block."""
		now = datetime.now()
		
		# Create daily metrics
		daily_metrics = UsageMetrics(
			block_id=block_id,
			time_period="day",
			period_start=now.replace(hour=0, minute=0, second=0, microsecond=0),
			period_end=now.replace(hour=23, minute=59, second=59, microsecond=999999)
		)
		
		self.usage_metrics[f"{block_id}:day"] = daily_metrics
	
	async def _track_block_access(self, block_id: str, access_type: str) -> None:
		"""Track block access for analytics."""
		metrics_key = f"{block_id}:day"
		
		if metrics_key not in self.usage_metrics:
			await self._initialize_usage_metrics(block_id)
		
		metrics = self.usage_metrics[metrics_key]
		
		if access_type == 'read':
			metrics.read_count += 1
		elif access_type == 'write':
			metrics.write_count += 1
		elif access_type == 'search':
			metrics.search_hits += 1
		
		metrics.recorded_at = datetime.now()


# Exception Classes
class BlockManagerException(Exception):
	"""Base exception for BlockManager operations."""
	pass


class BlockNotFoundException(BlockManagerException):
	"""Raised when a requested block is not found."""
	pass


class BlockValidationException(BlockManagerException):
	"""Raised when block validation fails."""
	pass


class VersionNotFoundException(BlockManagerException):
	"""Raised when a requested version is not found."""
	pass


class VersionConflictException(BlockManagerException):
	"""Raised when version conflicts occur."""
	pass


class DependencyException(BlockManagerException):
	"""Base exception for dependency-related errors."""
	pass


class CircularDependencyException(DependencyException):
	"""Raised when circular dependencies are detected."""
	pass


class MissingDependencyException(DependencyException):
	"""Raised when required dependencies are missing."""
	pass


class InvalidDependencyException(DependencyException):
	"""Raised when dependencies are invalid."""
	pass


class StorageException(BlockManagerException):
	"""Raised when storage operations fail."""
	pass


# Module-level assertions for robustness
assert EnhancedContentBlock, "EnhancedContentBlock model must be available"
assert BlockVersion, "BlockVersion model must be available"
assert DependencyGraph, "DependencyGraph model must be available"
assert UsageMetrics, "UsageMetrics model must be available"

assert BlockRepository, "BlockRepository must be available for block storage operations"
assert VersionManager, "VersionManager must be available for version control"
assert DependencyTracker, "DependencyTracker must be available for dependency management"
assert BlockManager, "BlockManager must be available as main interface"
