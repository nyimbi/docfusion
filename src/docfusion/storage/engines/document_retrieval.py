#!/usr/bin/env python3
"""
DocumentRetrieval Module for DocuFusion Storage Layer

Implements file system-based storage with document metadata tracking,
version-agnostic retrieval, and document caching for performance optimization.
Supports concurrent access and provides high-performance document access patterns.
"""

import asyncio
import json
import hashlib
import shutil
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Set, Any, Optional, Union
from pathlib import Path
from datetime import datetime, timedelta
try:
	from uuid_extensions import uuid7str
except ImportError:
	from uuid import uuid4
	def uuid7str() -> str:
		return str(uuid4())
from collections import OrderedDict
import pickle
import aiofiles
import os


@dataclass
class DocumentMetadata:
	"""Document metadata with comprehensive tracking"""
	document_id: str
	title: str
	content_type: str  # text, markdown, html, pdf, docx, etc.
	file_path: str
	file_size: int
	checksum: str
	version: str = "1.0.0"
	parent_version: Optional[str] = None
	created_at: datetime = field(default_factory=datetime.now)
	updated_at: datetime = field(default_factory=datetime.now)
	accessed_at: datetime = field(default_factory=datetime.now)
	author: str = "system"
	tags: List[str] = field(default_factory=list)
	category: str = "general"
	access_count: int = 0
	content_hash: Optional[str] = None
	custom_metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DocumentVersion:
	"""Document version information"""
	version: str
	document_id: str
	parent_version: Optional[str]
	created_at: datetime
	author: str
	changes_summary: str = ""
	file_path: str = ""
	checksum: str = ""


@dataclass
class RetrievalStats:
	"""Document retrieval statistics"""
	total_retrievals: int = 0
	cache_hits: int = 0
	cache_misses: int = 0
	average_retrieval_time: float = 0.0
	most_accessed_documents: Dict[str, int] = field(default_factory=dict)
	performance_metrics: Dict[str, float] = field(default_factory=dict)


class LRUCache:
	"""Least Recently Used cache for document content"""
	
	def __init__(self, max_size: int = 1000, max_memory_mb: int = 500):
		self.max_size = max_size
		self.max_memory_bytes = max_memory_mb * 1024 * 1024
		self.cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
		self.memory_usage = 0
	
	def get(self, key: str) -> Optional[Dict[str, Any]]:
		"""Get item from cache and move to end (most recent)"""
		if key in self.cache:
			# Move to end (most recent)
			value = self.cache.pop(key)
			self.cache[key] = value
			return value
		return None
	
	def put(self, key: str, value: Dict[str, Any]) -> None:
		"""Add item to cache with LRU eviction"""
		# Calculate size of the item
		item_size = len(str(value))
		
		# Remove existing item if present
		if key in self.cache:
			old_value = self.cache.pop(key)
			self.memory_usage -= len(str(old_value))
		
		# Evict items if necessary
		while (len(self.cache) >= self.max_size or 
			   self.memory_usage + item_size > self.max_memory_bytes) and self.cache:
			oldest_key, oldest_value = self.cache.popitem(last=False)
			self.memory_usage -= len(str(oldest_value))
		
		# Add new item
		self.cache[key] = value
		self.memory_usage += item_size
	
	def clear(self) -> None:
		"""Clear cache"""
		self.cache.clear()
		self.memory_usage = 0
	
	def size(self) -> int:
		"""Get cache size"""
		return len(self.cache)


class DocumentRetrieval:
	"""
	File system-based document storage and retrieval system with
	metadata tracking, version control, and performance caching
	"""
	
	def __init__(self, storage_path: Optional[Path] = None, cache_size: int = 1000):
		self.storage_path = storage_path or Path("./storage/documents")
		self.storage_path.mkdir(parents=True, exist_ok=True)
		
		# Initialize subdirectories
		self.documents_path = self.storage_path / "content"
		self.metadata_path = self.storage_path / "metadata"
		self.versions_path = self.storage_path / "versions"
		
		for path in [self.documents_path, self.metadata_path, self.versions_path]:
			path.mkdir(parents=True, exist_ok=True)
		
		# Initialize caching and tracking
		self.cache = LRUCache(max_size=cache_size)
		self.metadata_cache: Dict[str, DocumentMetadata] = {}
		self.document_index: Dict[str, DocumentMetadata] = {}
		self.version_history: Dict[str, List[DocumentVersion]] = {}
		self.stats = RetrievalStats()
		
		# Lock for thread-safe operations
		self._lock = asyncio.Lock()
		
		# Load existing metadata
		asyncio.create_task(self._load_existing_metadata())
	
	def _calculate_checksum(self, content: Union[str, bytes]) -> str:
		"""Calculate SHA-256 checksum of content"""
		if isinstance(content, str):
			content = content.encode('utf-8')
		return hashlib.sha256(content).hexdigest()
	
	def _generate_file_path(self, document_id: str, version: str = "latest") -> Path:
		"""Generate file path for document storage"""
		# Create directory structure: documents/ab/cd/abcd1234...
		prefix = document_id[:2]
		subdir = document_id[2:4] if len(document_id) > 2 else "00"
		
		dir_path = self.documents_path / prefix / subdir
		dir_path.mkdir(parents=True, exist_ok=True)
		
		filename = f"{document_id}_{version}.txt"
		return dir_path / filename
	
	def _generate_metadata_path(self, document_id: str) -> Path:
		"""Generate metadata file path"""
		prefix = document_id[:2]
		subdir = document_id[2:4] if len(document_id) > 2 else "00"
		
		dir_path = self.metadata_path / prefix / subdir
		dir_path.mkdir(parents=True, exist_ok=True)
		
		return dir_path / f"{document_id}.json"
	
	async def _load_existing_metadata(self) -> None:
		"""Load existing document metadata into memory"""
		try:
			for metadata_file in self.metadata_path.rglob("*.json"):
				try:
					async with aiofiles.open(metadata_file, 'r') as f:
						content = await f.read()
						metadata_dict = json.loads(content)
						
						# Convert datetime strings back to datetime objects
						for date_field in ['created_at', 'updated_at', 'accessed_at']:
							if date_field in metadata_dict:
								metadata_dict[date_field] = datetime.fromisoformat(metadata_dict[date_field])
						
						metadata = DocumentMetadata(**metadata_dict)
						self.document_index[metadata.document_id] = metadata
						self.metadata_cache[metadata.document_id] = metadata
						
				except Exception as e:
					print(f"Error loading metadata from {metadata_file}: {e}")
					
		except Exception as e:
			print(f"Error loading metadata: {e}")
	
	async def _save_metadata(self, metadata: DocumentMetadata) -> None:
		"""Save document metadata to disk"""
		metadata_path = self._generate_metadata_path(metadata.document_id)
		
		try:
			# Convert datetime objects to ISO strings for JSON serialization
			metadata_dict = asdict(metadata)
			for date_field in ['created_at', 'updated_at', 'accessed_at']:
				if isinstance(metadata_dict[date_field], datetime):
					metadata_dict[date_field] = metadata_dict[date_field].isoformat()
			
			async with aiofiles.open(metadata_path, 'w') as f:
				await f.write(json.dumps(metadata_dict, indent=2))
				
			# Update caches
			self.metadata_cache[metadata.document_id] = metadata
			self.document_index[metadata.document_id] = metadata
			
		except Exception as e:
			raise RuntimeError(f"Failed to save metadata for {metadata.document_id}: {e}")
	
	async def store_document(
		self, 
		content: str, 
		title: str = "", 
		content_type: str = "text",
		document_id: Optional[str] = None,
		author: str = "system",
		tags: Optional[List[str]] = None,
		category: str = "general",
		custom_metadata: Optional[Dict[str, Any]] = None
	) -> str:
		"""Store document with metadata tracking"""
		
		async with self._lock:
			# Generate document ID if not provided
			if document_id is None:
				document_id = uuid7str()
			
			# Calculate content properties
			checksum = self._calculate_checksum(content)
			content_hash = hashlib.md5(content.encode('utf-8')).hexdigest()
			
			# Determine version
			version = "1.0.0"
			parent_version = None
			
			# Check if document exists (update scenario)
			if document_id in self.document_index:
				existing_metadata = self.document_index[document_id]
				# Generate new version
				version_parts = existing_metadata.version.split('.')
				major, minor, patch = int(version_parts[0]), int(version_parts[1]), int(version_parts[2])
				version = f"{major}.{minor}.{patch + 1}"
				parent_version = existing_metadata.version
			
			# Generate file path
			file_path = self._generate_file_path(document_id, version)
			
			try:
				# Store document content
				async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
					await f.write(content)
				
				# Create metadata
				metadata = DocumentMetadata(
					document_id=document_id,
					title=title or f"Document {document_id[:8]}",
					content_type=content_type,
					file_path=str(file_path),
					file_size=len(content.encode('utf-8')),
					checksum=checksum,
					version=version,
					parent_version=parent_version,
					author=author,
					tags=tags or [],
					category=category,
					content_hash=content_hash,
					custom_metadata=custom_metadata or {}
				)
				
				# Save metadata
				await self._save_metadata(metadata)
				
				# Store version information
				await self._store_version_info(metadata)
				
				# Invalidate cache for this document
				if document_id in self.cache.cache:
					del self.cache.cache[document_id]
				
				return document_id
				
			except Exception as e:
				# Clean up file if metadata save failed
				if file_path.exists():
					file_path.unlink()
				raise RuntimeError(f"Failed to store document: {e}")
	
	async def _store_version_info(self, metadata: DocumentMetadata) -> None:
		"""Store version information"""
		version_info = DocumentVersion(
			version=metadata.version,
			document_id=metadata.document_id,
			parent_version=metadata.parent_version,
			created_at=metadata.updated_at,
			author=metadata.author,
			file_path=metadata.file_path,
			checksum=metadata.checksum
		)
		
		if metadata.document_id not in self.version_history:
			self.version_history[metadata.document_id] = []
		
		self.version_history[metadata.document_id].append(version_info)
		
		# Save to disk
		version_file = self.versions_path / f"{metadata.document_id}_versions.json"
		versions_data = []
		
		for version in self.version_history[metadata.document_id]:
			version_dict = asdict(version)
			version_dict['created_at'] = version.created_at.isoformat()
			versions_data.append(version_dict)
		
		async with aiofiles.open(version_file, 'w') as f:
			await f.write(json.dumps(versions_data, indent=2))
	
	async def retrieve_document(
		self, 
		document_id: str, 
		version: Optional[str] = None,
		update_access_time: bool = True
	) -> Optional[Dict[str, Any]]:
		"""Retrieve document with optional version specification"""
		
		start_time = asyncio.get_event_loop().time()
		
		try:
			# Update statistics
			self.stats.total_retrievals += 1
			self.stats.most_accessed_documents[document_id] = (
				self.stats.most_accessed_documents.get(document_id, 0) + 1
			)
			
			# Check cache first
			cache_key = f"{document_id}:{version or 'latest'}"
			cached_result = self.cache.get(cache_key)
			
			if cached_result:
				self.stats.cache_hits += 1
				
				# Update access time in metadata if needed
				if update_access_time and document_id in self.metadata_cache:
					metadata = self.metadata_cache[document_id]
					metadata.accessed_at = datetime.now()
					metadata.access_count += 1
					await self._save_metadata(metadata)
				
				return cached_result
			
			self.stats.cache_misses += 1
			
			# Check if document exists in index
			if document_id not in self.document_index:
				return None
			
			metadata = self.document_index[document_id]
			
			# Determine which version to retrieve
			target_version = version or metadata.version
			file_path = Path(metadata.file_path)
			
			# If specific version requested, adjust file path
			if version and version != metadata.version:
				file_path = self._generate_file_path(document_id, version)
				if not file_path.exists():
					return None
			
			# Read document content
			if not file_path.exists():
				return None
			
			async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
				content = await f.read()
			
			# Update access tracking
			if update_access_time:
				metadata.accessed_at = datetime.now()
				metadata.access_count += 1
				await self._save_metadata(metadata)
			
			# Prepare result
			result = {
				'document_id': document_id,
				'content': content,
				'metadata': asdict(metadata),
				'version': target_version,
				'retrieved_at': datetime.now().isoformat()
			}
			
			# Cache the result
			self.cache.put(cache_key, result)
			
			# Update performance metrics
			retrieval_time = asyncio.get_event_loop().time() - start_time
			self.stats.performance_metrics['last_retrieval_time'] = retrieval_time
			self.stats.average_retrieval_time = (
				(self.stats.average_retrieval_time * (self.stats.total_retrievals - 1) + retrieval_time) / 
				self.stats.total_retrievals
			)
			
			return result
			
		except Exception as e:
			print(f"Error retrieving document {document_id}: {e}")
			return None
	
	async def get_document_metadata(self, document_id: str) -> Optional[DocumentMetadata]:
		"""Get document metadata without retrieving content"""
		if document_id in self.metadata_cache:
			return self.metadata_cache[document_id]
		return self.document_index.get(document_id)
	
	async def list_documents(
		self, 
		category: Optional[str] = None,
		tags: Optional[List[str]] = None,
		content_type: Optional[str] = None,
		limit: int = 100,
		offset: int = 0
	) -> List[DocumentMetadata]:
		"""List documents with optional filtering"""
		
		documents = list(self.document_index.values())
		
		# Apply filters
		if category:
			documents = [doc for doc in documents if doc.category == category]
		
		if content_type:
			documents = [doc for doc in documents if doc.content_type == content_type]
		
		if tags:
			documents = [doc for doc in documents if any(tag in doc.tags for tag in tags)]
		
		# Sort by updated_at descending
		documents.sort(key=lambda x: x.updated_at, reverse=True)
		
		# Apply pagination
		return documents[offset:offset + limit]
	
	async def search_documents(
		self, 
		query: str, 
		content_types: Optional[List[str]] = None,
		categories: Optional[List[str]] = None
	) -> List[DocumentMetadata]:
		"""Search documents by title and metadata"""
		
		query_lower = query.lower()
		matching_docs = []
		
		for metadata in self.document_index.values():
			# Check title match
			if query_lower in metadata.title.lower():
				matching_docs.append(metadata)
				continue
			
			# Check tags match
			if any(query_lower in tag.lower() for tag in metadata.tags):
				matching_docs.append(metadata)
				continue
			
			# Check custom metadata match
			for key, value in metadata.custom_metadata.items():
				if isinstance(value, str) and query_lower in value.lower():
					matching_docs.append(metadata)
					break
		
		# Apply filters
		if content_types:
			matching_docs = [doc for doc in matching_docs if doc.content_type in content_types]
		
		if categories:
			matching_docs = [doc for doc in matching_docs if doc.category in categories]
		
		# Sort by relevance (access count and recency)
		matching_docs.sort(
			key=lambda x: (x.access_count, x.updated_at), 
			reverse=True
		)
		
		return matching_docs
	
	async def get_version_history(self, document_id: str) -> List[DocumentVersion]:
		"""Get version history for a document"""
		if document_id in self.version_history:
			return self.version_history[document_id].copy()
		
		# Try loading from disk
		version_file = self.versions_path / f"{document_id}_versions.json"
		if version_file.exists():
			try:
				async with aiofiles.open(version_file, 'r') as f:
					content = await f.read()
					versions_data = json.loads(content)
					
					versions = []
					for version_dict in versions_data:
						version_dict['created_at'] = datetime.fromisoformat(version_dict['created_at'])
						versions.append(DocumentVersion(**version_dict))
					
					self.version_history[document_id] = versions
					return versions.copy()
					
			except Exception as e:
				print(f"Error loading version history for {document_id}: {e}")
		
		return []
	
	async def delete_document(self, document_id: str, delete_all_versions: bool = False) -> bool:
		"""Delete document and optionally all versions"""
		
		async with self._lock:
			try:
				if document_id not in self.document_index:
					return False
				
				metadata = self.document_index[document_id]
				
				if delete_all_versions:
					# Delete all version files
					versions = await self.get_version_history(document_id)
					for version in versions:
						if version.file_path and Path(version.file_path).exists():
							Path(version.file_path).unlink()
					
					# Delete version history file
					version_file = self.versions_path / f"{document_id}_versions.json"
					if version_file.exists():
						version_file.unlink()
				else:
					# Delete only current version
					if Path(metadata.file_path).exists():
						Path(metadata.file_path).unlink()
				
				# Delete metadata file
				metadata_path = self._generate_metadata_path(document_id)
				if metadata_path.exists():
					metadata_path.unlink()
				
				# Remove from caches and indexes
				self.document_index.pop(document_id, None)
				self.metadata_cache.pop(document_id, None)
				self.version_history.pop(document_id, None)
				
				# Clear cache entries
				keys_to_remove = [key for key in self.cache.cache.keys() if key.startswith(f"{document_id}:")]
				for key in keys_to_remove:
					del self.cache.cache[key]
				
				return True
				
			except Exception as e:
				print(f"Error deleting document {document_id}: {e}")
				return False
	
	async def get_storage_stats(self) -> Dict[str, Any]:
		"""Get storage and retrieval statistics"""
		total_size = sum(metadata.file_size for metadata in self.document_index.values())
		
		return {
			'total_documents': len(self.document_index),
			'total_storage_bytes': total_size,
			'total_storage_mb': total_size / (1024 * 1024),
			'cache_size': self.cache.size(),
			'cache_hit_rate': (self.stats.cache_hits / max(self.stats.total_retrievals, 1)) * 100,
			'retrieval_stats': asdict(self.stats),
			'most_accessed_documents': sorted(
				self.stats.most_accessed_documents.items(), 
				key=lambda x: x[1], 
				reverse=True
			)[:10]
		}
	
	async def clear_cache(self) -> None:
		"""Clear document cache"""
		self.cache.clear()
	
	async def optimize_storage(self) -> Dict[str, Any]:
		"""Optimize storage by cleaning up unused files"""
		optimization_stats = {
			'orphaned_files_removed': 0,
			'space_recovered_bytes': 0,
			'errors': []
		}
		
		try:
			# Find all files in storage
			all_files = set()
			for root, dirs, files in os.walk(self.documents_path):
				for file in files:
					all_files.add(Path(root) / file)
			
			# Find referenced files
			referenced_files = set()
			for metadata in self.document_index.values():
				if metadata.file_path:
					referenced_files.add(Path(metadata.file_path))
			
			for versions in self.version_history.values():
				for version in versions:
					if version.file_path:
						referenced_files.add(Path(version.file_path))
			
			# Remove orphaned files
			for file_path in all_files:
				if file_path not in referenced_files:
					try:
						file_size = file_path.stat().st_size
						file_path.unlink()
						optimization_stats['orphaned_files_removed'] += 1
						optimization_stats['space_recovered_bytes'] += file_size
					except Exception as e:
						optimization_stats['errors'].append(f"Error removing {file_path}: {e}")
			
		except Exception as e:
			optimization_stats['errors'].append(f"Optimization error: {e}")
		
		return optimization_stats


# Convenience functions
async def create_document_retrieval(storage_path: Optional[Path] = None, cache_size: int = 1000) -> DocumentRetrieval:
	"""Create and initialize document retrieval system"""
	return DocumentRetrieval(storage_path, cache_size)


async def store_text_document(
	retrieval: DocumentRetrieval, 
	content: str, 
	title: str, 
	**kwargs
) -> str:
	"""Convenience function to store text document"""
	return await retrieval.store_document(
		content=content, 
		title=title, 
		content_type="text", 
		**kwargs
	)