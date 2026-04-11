#!/usr/bin/env python3
"""
DocumentIndexer Module for DocuFusion Storage Layer

Implements file-based document catalog with metadata extraction and storage,
incremental indexing for new documents, index optimization and maintenance.
Provides comprehensive document indexing for fast search and retrieval operations.
"""

import logging
import asyncio
import json
import hashlib
import mimetypes
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Set, Any, Optional, Union, Tuple
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict
import aiofiles
import pickle
import re
from ...core.utils import uuid7str

logger = logging.getLogger(__name__)

@dataclass
class IndexedDocument:
	"""Indexed document with comprehensive metadata"""
	document_id: str
	title: str
	content: str
	content_type: str
	file_path: str
	file_size: int
	checksum: str
	content_hash: str
	indexed_at: datetime = field(default_factory=datetime.now)
	last_modified: datetime = field(default_factory=datetime.now)
	author: str = "system"
	tags: List[str] = field(default_factory=list)
	category: str = "general"
	language: str = "en"
	word_count: int = 0
	char_count: int = 0
	extracted_entities: List[Dict[str, Any]] = field(default_factory=list)
	extracted_keywords: List[str] = field(default_factory=list)
	custom_fields: Dict[str, Any] = field(default_factory=dict)

@dataclass
class IndexStats:
	"""Document indexing statistics"""
	total_documents: int = 0
	total_size_bytes: int = 0
	documents_by_type: Dict[str, int] = field(default_factory=dict)
	documents_by_category: Dict[str, int] = field(default_factory=dict)
	indexing_performance: Dict[str, float] = field(default_factory=dict)
	last_full_index: Optional[datetime] = None
	last_incremental_index: Optional[datetime] = None
	index_errors: List[str] = field(default_factory=list)

@dataclass
class IndexConfiguration:
	"""Indexing configuration parameters"""
	enable_content_extraction: bool = True
	enable_keyword_extraction: bool = True
	enable_entity_extraction: bool = False  # Requires NLP
	max_content_length: int = 1_000_000  # 1MB
	supported_file_types: Set[str] = field(default_factory=lambda: {
		'.txt', '.md', '.html', '.json', '.csv', '.log', '.py', '.js', '.css'
	})
	index_batch_size: int = 100
	enable_incremental_indexing: bool = True
	auto_index_interval_minutes: int = 60

class DocumentIndexer:
	"""
	Comprehensive document indexing system with file-based catalog,
	metadata extraction, and incremental indexing capabilities
	"""
	
	def __init__(self, storage_path: Optional[Path] = None, config: Optional[IndexConfiguration] = None):
		self.storage_path = storage_path or Path("./storage/indexes")
		self.storage_path.mkdir(parents=True, exist_ok=True)
		
		self.config = config or IndexConfiguration()
		
		# Initialize index storage paths
		self.catalog_path = self.storage_path / "catalog"
		self.metadata_path = self.storage_path / "metadata"
		self.indexes_path = self.storage_path / "indexes"
		
		for path in [self.catalog_path, self.metadata_path, self.indexes_path]:
			path.mkdir(parents=True, exist_ok=True)
		
		# Initialize data structures
		self.document_catalog: Dict[str, IndexedDocument] = {}
		self.file_to_document: Dict[str, str] = {}  # file_path -> document_id
		self.category_index: Dict[str, Set[str]] = defaultdict(set)
		self.type_index: Dict[str, Set[str]] = defaultdict(set)
		self.tag_index: Dict[str, Set[str]] = defaultdict(set)
		self.keyword_index: Dict[str, Set[str]] = defaultdict(set)
		self.stats = IndexStats()
		
		# Thread safety
		self._lock = asyncio.Lock()
		self._indexing_in_progress = False
		
		# Load existing indexes
		asyncio.create_task(self._load_indexes())
	
	def _calculate_checksum(self, content: Union[str, bytes]) -> str:
		"""Calculate SHA-256 checksum of content"""
		if isinstance(content, str):
			content = content.encode('utf-8')
		return hashlib.sha256(content).hexdigest()
	
	def _extract_metadata_from_path(self, file_path: Path) -> Dict[str, Any]:
		"""Extract metadata from file path and properties"""
		try:
			stat = file_path.stat()
			mime_type, _ = mimetypes.guess_type(str(file_path))
			
			return {
				'file_size': stat.st_size,
				'created_at': datetime.fromtimestamp(stat.st_ctime),
				'modified_at': datetime.fromtimestamp(stat.st_mtime),
				'mime_type': mime_type,
				'file_extension': file_path.suffix.lower(),
				'filename': file_path.name,
				'directory': str(file_path.parent)
			}
		except Exception as e:
			logger.error(f"Error extracting metadata from {file_path}: {e}")
			return {}
	
	def _extract_keywords(self, content: str, max_keywords: int = 20) -> List[str]:
		"""Extract keywords from content using simple frequency analysis"""
		if not self.config.enable_keyword_extraction or not content:
			return []
		
		try:
			# Simple keyword extraction based on word frequency
			words = re.findall(r'\b[a-zA-Z]{4,}\b', content.lower())
			
			# Filter common stop words
			stop_words = {
				'this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 
				'have', 'their', 'said', 'each', 'which', 'them', 'would', 
				'there', 'could', 'other', 'more', 'very', 'what', 'know',
				'just', 'into', 'over', 'also', 'back', 'after', 'first',
				'well', 'work', 'good', 'where', 'much', 'should', 'made',
				'being', 'here', 'before', 'through', 'only', 'then', 'even',
				'most', 'many', 'such', 'long', 'make', 'same', 'right',
				'under', 'might', 'take', 'while', 'down', 'come', 'still'
			}
			
			# Count word frequencies
			word_freq = defaultdict(int)
			for word in words:
				if word not in stop_words and len(word) > 3:
					word_freq[word] += 1
			
			# Return top keywords
			keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
			return [word for word, freq in keywords[:max_keywords]]
			
		except Exception as e:
			logger.error(f"Error extracting keywords: {e}")
			return []
	
	def _extract_content_from_file(self, file_path: Path) -> Tuple[str, str]:
		"""Extract content and determine content type from file"""
		try:
			content_type = "unknown"
			content = ""
			
			# Determine content type from extension
			ext = file_path.suffix.lower()
			if ext in ['.txt', '.md', '.log']:
				content_type = "text"
			elif ext in ['.html', '.htm']:
				content_type = "html"
			elif ext in ['.json']:
				content_type = "json"
			elif ext in ['.csv']:
				content_type = "csv"
			elif ext in ['.py', '.js', '.css', '.sql']:
				content_type = "code"
			
			# Read file content
			try:
				with open(file_path, 'r', encoding='utf-8') as f:
					content = f.read()
			except UnicodeDecodeError:
				# Try with different encoding
				try:
					with open(file_path, 'r', encoding='latin-1') as f:
						content = f.read()
				except Exception as e:
					logger.warning(f"Failed to read file {file_path} with latin-1 encoding: {e}")
					# If all else fails, read as binary and decode errors
					with open(file_path, 'rb') as f:
						content = f.read().decode('utf-8', errors='replace')
			
			# Limit content length
			if len(content) > self.config.max_content_length:
				content = content[:self.config.max_content_length] + "... [truncated]"
			
			return content, content_type
			
		except Exception as e:
			logger.error(f"Error extracting content from {file_path}: {e}")
			return "", "unknown"
	
	async def index_document(
		self,
		document_id: Optional[str] = None,
		title: Optional[str] = None,
		content: Optional[str] = None,
		file_path: Optional[Union[str, Path]] = None,
		content_type: Optional[str] = None,
		author: str = "system",
		tags: Optional[List[str]] = None,
		category: str = "general",
		custom_fields: Optional[Dict[str, Any]] = None
	) -> str:
		"""Index a document with comprehensive metadata extraction"""
		
		async with self._lock:
			try:
				# Generate document ID if not provided
				if document_id is None:
					document_id = uuid7str()
				
				# Handle file-based indexing
				if file_path:
					file_path = Path(file_path)
					if not file_path.exists():
						raise ValueError(f"File not found: {file_path}")
					
					# Extract content and metadata from file
					if content is None:
						content, detected_type = self._extract_content_from_file(file_path)
						content_type = content_type or detected_type
					
					if title is None:
						title = file_path.stem
					
					file_metadata = self._extract_metadata_from_path(file_path)
					
					# Store file path mapping
					self.file_to_document[str(file_path)] = document_id
				
				# Validate required fields
				if not content and not file_path:
					raise ValueError("Either content or file_path must be provided")
				
				content = content or ""
				title = title or f"Document {document_id[:8]}"
				content_type = content_type or "text"
				
				# Calculate content properties
				checksum = self._calculate_checksum(content)
				content_hash = hashlib.md5(content.encode('utf-8')).hexdigest()
				word_count = len(content.split()) if content else 0
				char_count = len(content)
				
				# Extract keywords
				keywords = self._extract_keywords(content)
				
				# Create indexed document
				indexed_doc = IndexedDocument(
					document_id=document_id,
					title=title,
					content=content,
					content_type=content_type,
					file_path=str(file_path) if file_path else "",
					file_size=len(content.encode('utf-8')),
					checksum=checksum,
					content_hash=content_hash,
					author=author,
					tags=tags or [],
					category=category,
					word_count=word_count,
					char_count=char_count,
					extracted_keywords=keywords,
					custom_fields=custom_fields or {}
				)
				
				# Remove old document if exists
				if document_id in self.document_catalog:
					await self._remove_from_indexes(document_id)
				
				# Add to catalog and indexes
				self.document_catalog[document_id] = indexed_doc
				await self._update_indexes(indexed_doc)
				
				# Update statistics
				await self._update_stats()
				
				# Save to disk
				await self._save_document_index(indexed_doc)
				
				return document_id
				
			except Exception as e:
				self.stats.index_errors.append(f"Error indexing document: {e}")
				raise RuntimeError(f"Failed to index document: {e}") from e
	
	async def _update_indexes(self, doc: IndexedDocument) -> None:
		"""Update all secondary indexes"""
		# Category index
		self.category_index[doc.category].add(doc.document_id)
		
		# Type index
		self.type_index[doc.content_type].add(doc.document_id)
		
		# Tag index
		for tag in doc.tags:
			self.tag_index[tag.lower()].add(doc.document_id)
		
		# Keyword index
		for keyword in doc.extracted_keywords:
			self.keyword_index[keyword.lower()].add(doc.document_id)
	
	async def _remove_from_indexes(self, document_id: str) -> None:
		"""Remove document from all indexes"""
		if document_id not in self.document_catalog:
			return
		
		doc = self.document_catalog[document_id]
		
		# Remove from category index
		self.category_index[doc.category].discard(document_id)
		
		# Remove from type index
		self.type_index[doc.content_type].discard(document_id)
		
		# Remove from tag index
		for tag in doc.tags:
			self.tag_index[tag.lower()].discard(document_id)
		
		# Remove from keyword index
		for keyword in doc.extracted_keywords:
			self.keyword_index[keyword.lower()].discard(document_id)
		
		# Remove from file mapping
		if doc.file_path and doc.file_path in self.file_to_document:
			del self.file_to_document[doc.file_path]
		
		# Remove from catalog
		del self.document_catalog[document_id]
	
	async def index_directory(
		self, 
		directory_path: Union[str, Path],
		recursive: bool = True,
		category: str = "general",
		batch_size: Optional[int] = None
	) -> Dict[str, Any]:
		"""Index all supported files in a directory"""
		
		directory_path = Path(directory_path)
		batch_size = batch_size or self.config.index_batch_size
		
		if not directory_path.exists() or not directory_path.is_dir():
			raise ValueError(f"Invalid directory: {directory_path}")
		
		self._indexing_in_progress = True
		
		try:
			indexing_results = {
				'indexed_files': 0,
				'skipped_files': 0,
				'errors': [],
				'indexed_documents': []
			}
			
			# Find all files to index
			pattern = "**/*" if recursive else "*"
			all_files = [
				f for f in directory_path.glob(pattern) 
				if f.is_file() and f.suffix.lower() in self.config.supported_file_types
			]
			
			# Process files in batches
			for i in range(0, len(all_files), batch_size):
				batch = all_files[i:i + batch_size]
				
				for file_path in batch:
					try:
						# Check if file is already indexed
						if str(file_path) in self.file_to_document:
							existing_doc_id = self.file_to_document[str(file_path)]
							existing_doc = self.document_catalog.get(existing_doc_id)
							
							# Check if file has been modified
							file_stat = file_path.stat()
							file_modified = datetime.fromtimestamp(file_stat.st_mtime)
							
							if (existing_doc and 
								existing_doc.last_modified >= file_modified and
								self.config.enable_incremental_indexing):
								indexing_results['skipped_files'] += 1
								continue
						
						# Index the file
						document_id = await self.index_document(
							file_path=file_path,
							category=category,
							author="file_indexer"
						)
						
						indexing_results['indexed_files'] += 1
						indexing_results['indexed_documents'].append(document_id)
						
					except Exception as e:
						error_msg = f"Error indexing {file_path}: {e}"
						indexing_results['errors'].append(error_msg)
						self.stats.index_errors.append(error_msg)
				
				# Small delay between batches to prevent overload
				await asyncio.sleep(0.1)
			
			# Update indexing timestamps
			self.stats.last_incremental_index = datetime.now()
			if not self.config.enable_incremental_indexing:
				self.stats.last_full_index = datetime.now()
			
			# Save updated indexes
			await self._save_all_indexes()
			
			return indexing_results
			
		finally:
			self._indexing_in_progress = False
	
	async def reindex_document(self, document_id: str) -> bool:
		"""Reindex an existing document"""
		if document_id not in self.document_catalog:
			return False
		
		try:
			doc = self.document_catalog[document_id]
			
			# If file-based, re-extract content
			if doc.file_path and Path(doc.file_path).exists():
				content, content_type = self._extract_content_from_file(Path(doc.file_path))
				
				# Update document with new content
				await self.index_document(
					document_id=document_id,
					title=doc.title,
					content=content,
					file_path=doc.file_path,
					content_type=content_type,
					author=doc.author,
					tags=doc.tags,
					category=doc.category,
					custom_fields=doc.custom_fields
				)
				return True
			
			return False
			
		except Exception as e:
			self.stats.index_errors.append(f"Error reindexing {document_id}: {e}")
			return False
	
	async def search_by_category(self, category: str) -> List[IndexedDocument]:
		"""Search documents by category"""
		document_ids = self.category_index.get(category, set())
		return [self.document_catalog[doc_id] for doc_id in document_ids if doc_id in self.document_catalog]
	
	async def search_by_content_type(self, content_type: str) -> List[IndexedDocument]:
		"""Search documents by content type"""
		document_ids = self.type_index.get(content_type, set())
		return [self.document_catalog[doc_id] for doc_id in document_ids if doc_id in self.document_catalog]
	
	async def search_by_tags(self, tags: List[str], match_all: bool = False) -> List[IndexedDocument]:
		"""Search documents by tags"""
		if not tags:
			return []
		
		tag_sets = [self.tag_index.get(tag.lower(), set()) for tag in tags]
		
		if match_all:
			# Intersection of all tag sets
			matching_docs = set.intersection(*tag_sets) if tag_sets else set()
		else:
			# Union of all tag sets
			matching_docs = set.union(*tag_sets) if tag_sets else set()
		
		return [self.document_catalog[doc_id] for doc_id in matching_docs if doc_id in self.document_catalog]
	
	async def search_by_keywords(self, keywords: List[str], match_all: bool = False) -> List[IndexedDocument]:
		"""Search documents by keywords"""
		if not keywords:
			return []
		
		keyword_sets = [self.keyword_index.get(keyword.lower(), set()) for keyword in keywords]
		
		if match_all:
			matching_docs = set.intersection(*keyword_sets) if keyword_sets else set()
		else:
			matching_docs = set.union(*keyword_sets) if keyword_sets else set()
		
		return [self.document_catalog[doc_id] for doc_id in matching_docs if doc_id in self.document_catalog]
	
	async def get_document_by_id(self, document_id: str) -> Optional[IndexedDocument]:
		"""Get document by ID"""
		return self.document_catalog.get(document_id)
	
	async def remove_document(self, document_id: str) -> bool:
		"""Remove document from index"""
		if document_id not in self.document_catalog:
			return False
		
		async with self._lock:
			try:
				await self._remove_from_indexes(document_id)
				
				# Remove document index file
				doc_file = self.catalog_path / f"{document_id}.json"
				if doc_file.exists():
					doc_file.unlink()
				
				await self._update_stats()
				await self._save_all_indexes()
				
				return True
				
			except Exception as e:
				self.stats.index_errors.append(f"Error removing document {document_id}: {e}")
				return False
	
	async def get_index_statistics(self) -> IndexStats:
		"""Get comprehensive indexing statistics"""
		await self._update_stats()
		return self.stats
	
	async def _update_stats(self) -> None:
		"""Update indexing statistics"""
		self.stats.total_documents = len(self.document_catalog)
		self.stats.total_size_bytes = sum(doc.file_size for doc in self.document_catalog.values())
		
		# Update type and category counts
		self.stats.documents_by_type.clear()
		self.stats.documents_by_category.clear()
		
		for doc in self.document_catalog.values():
			self.stats.documents_by_type[doc.content_type] = (
				self.stats.documents_by_type.get(doc.content_type, 0) + 1
			)
			self.stats.documents_by_category[doc.category] = (
				self.stats.documents_by_category.get(doc.category, 0) + 1
			)
	
	async def optimize_indexes(self) -> Dict[str, Any]:
		"""Optimize indexes by removing empty entries and compacting"""
		optimization_stats = {
			'removed_empty_categories': 0,
			'removed_empty_tags': 0,
			'removed_empty_keywords': 0,
			'compacted_indexes': 0
		}
		
		async with self._lock:
			try:
				# Remove empty category indexes
				empty_categories = [cat for cat, docs in self.category_index.items() if not docs]
				for cat in empty_categories:
					del self.category_index[cat]
					optimization_stats['removed_empty_categories'] += 1
				
				# Remove empty tag indexes
				empty_tags = [tag for tag, docs in self.tag_index.items() if not docs]
				for tag in empty_tags:
					del self.tag_index[tag]
					optimization_stats['removed_empty_tags'] += 1
				
				# Remove empty keyword indexes
				empty_keywords = [kw for kw, docs in self.keyword_index.items() if not docs]
				for kw in empty_keywords:
					del self.keyword_index[kw]
					optimization_stats['removed_empty_keywords'] += 1
				
				# Save optimized indexes
				await self._save_all_indexes()
				optimization_stats['compacted_indexes'] = 1
				
			except Exception as e:
				logger.error(f"Error during index optimization: {e}")
		
		return optimization_stats
	
	async def _save_document_index(self, doc: IndexedDocument) -> None:
		"""Save individual document index to disk"""
		try:
			doc_file = self.catalog_path / f"{doc.document_id}.json"
			doc_dict = asdict(doc)
			
			# Convert datetime objects to ISO strings
			for field in ['indexed_at', 'last_modified']:
				if isinstance(doc_dict[field], datetime):
					doc_dict[field] = doc_dict[field].isoformat()
			
			async with aiofiles.open(doc_file, 'w') as f:
				await f.write(json.dumps(doc_dict, indent=2))
				
		except Exception as e:
			raise RuntimeError(f"Failed to save document index {doc.document_id}: {e}") from e
	
	async def _save_all_indexes(self) -> None:
		"""Save all indexes to disk"""
		try:
			# Save secondary indexes
			indexes_data = {
				'category_index': {cat: list(docs) for cat, docs in self.category_index.items()},
				'type_index': {typ: list(docs) for typ, docs in self.type_index.items()},
				'tag_index': {tag: list(docs) for tag, docs in self.tag_index.items()},
				'keyword_index': {kw: list(docs) for kw, docs in self.keyword_index.items()},
				'file_to_document': self.file_to_document
			}
			
			indexes_file = self.indexes_path / "secondary_indexes.json"
			async with aiofiles.open(indexes_file, 'w') as f:
				await f.write(json.dumps(indexes_data, indent=2))
			
			# Save statistics
			stats_dict = asdict(self.stats)
			if stats_dict['last_full_index']:
				stats_dict['last_full_index'] = self.stats.last_full_index.isoformat()
			if stats_dict['last_incremental_index']:
				stats_dict['last_incremental_index'] = self.stats.last_incremental_index.isoformat()
			
			stats_file = self.indexes_path / "index_stats.json"
			async with aiofiles.open(stats_file, 'w') as f:
				await f.write(json.dumps(stats_dict, indent=2))
				
		except Exception as e:
			logger.error(f"Error saving indexes: {e}")
	
	async def _load_indexes(self) -> None:
		"""Load indexes from disk"""
		try:
			# Load individual document indexes
			if self.catalog_path.exists():
				for doc_file in self.catalog_path.glob("*.json"):
					try:
						async with aiofiles.open(doc_file, 'r') as f:
							content = await f.read()
							doc_dict = json.loads(content)
							
							# Convert datetime strings back
							for field in ['indexed_at', 'last_modified']:
								if field in doc_dict and isinstance(doc_dict[field], str):
									doc_dict[field] = datetime.fromisoformat(doc_dict[field])
							
							doc = IndexedDocument(**doc_dict)
							self.document_catalog[doc.document_id] = doc
							
							# Rebuild secondary indexes
							await self._update_indexes(doc)
							
					except Exception as e:
						logger.error(f"Error loading document index {doc_file}: {e}")
			
			# Load secondary indexes
			indexes_file = self.indexes_path / "secondary_indexes.json"
			if indexes_file.exists():
				try:
					async with aiofiles.open(indexes_file, 'r') as f:
						content = await f.read()
						indexes_data = json.loads(content)
						
						# Restore secondary indexes
						self.category_index = defaultdict(set, {
							cat: set(docs) for cat, docs in indexes_data.get('category_index', {}).items()
						})
						self.type_index = defaultdict(set, {
							typ: set(docs) for typ, docs in indexes_data.get('type_index', {}).items()
						})
						self.tag_index = defaultdict(set, {
							tag: set(docs) for tag, docs in indexes_data.get('tag_index', {}).items()
						})
						self.keyword_index = defaultdict(set, {
							kw: set(docs) for kw, docs in indexes_data.get('keyword_index', {}).items()
						})
						self.file_to_document = indexes_data.get('file_to_document', {})
						
				except Exception as e:
					logger.error(f"Error loading secondary indexes: {e}")
			
			# Load statistics
			stats_file = self.indexes_path / "index_stats.json"
			if stats_file.exists():
				try:
					async with aiofiles.open(stats_file, 'r') as f:
						content = await f.read()
						stats_dict = json.loads(content)
						
						# Convert datetime strings back
						if stats_dict.get('last_full_index'):
							stats_dict['last_full_index'] = datetime.fromisoformat(stats_dict['last_full_index'])
						if stats_dict.get('last_incremental_index'):
							stats_dict['last_incremental_index'] = datetime.fromisoformat(stats_dict['last_incremental_index'])
						
						self.stats = IndexStats(**stats_dict)
						
				except Exception as e:
					logger.error(f"Error loading index statistics: {e}")
			
			# Update statistics
			await self._update_stats()
			
		except Exception as e:
			logger.error(f"Error loading indexes: {e}")

# Convenience functions
async def create_document_indexer(storage_path: Optional[Path] = None, config: Optional[IndexConfiguration] = None) -> DocumentIndexer:
	"""Create and initialize document indexer"""
	return DocumentIndexer(storage_path, config)

async def index_text_document(indexer: DocumentIndexer, content: str, title: str, **kwargs) -> str:
	"""Convenience function to index text document"""
	return await indexer.index_document(
		title=title,
		content=content,
		content_type="text",
		**kwargs
	)