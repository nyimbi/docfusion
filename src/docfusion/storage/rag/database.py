#!/usr/bin/env python3
"""
PostgreSQL Database Layer for RAG System

Implements the database connection and management layer for the RAG system
using PostgreSQL with pgai extensions for vector operations and embeddings.
"""

import asyncio
import logging
import re
from dataclasses import dataclass
from typing import Dict, List, Any, Optional, Union
from pathlib import Path
import json
import os
from datetime import datetime

import asyncpg
import psycopg2
from psycopg2.extras import RealDictCursor
from ...core.utils import uuid7str

VALID_SCHEMA_PATTERN = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')

def _validate_schema_name(schema_name: str) -> str:
	"""Validate schema name to prevent SQL injection via config values."""
	if not VALID_SCHEMA_PATTERN.match(schema_name):
		raise ValueError(f"Invalid schema name: {schema_name!r}")
	return schema_name

@dataclass
class DatabaseConfiguration:
	"""Configuration for PostgreSQL RAG database"""
	connection_string: str
	pool_size: int = 10
	max_pool_size: int = 20
	command_timeout: float = 30.0
	enable_pgai: bool = True
	embedding_model: str = "openai/text-embedding-ada-002"
	embedding_dimensions: int = 1536
	chunk_size: int = 1000
	chunk_overlap: int = 200
	schema_name: str = "rag"

@dataclass 
class DocumentChunk:
	"""Represents a document chunk with embedding"""
	chunk_id: str
	document_id: str
	chunk_index: int
	content: str
	metadata: Dict[str, Any]
	embedding: Optional[List[float]] = None
	created_at: Optional[datetime] = None
	updated_at: Optional[datetime] = None

@dataclass
class RAGDocument:
	"""Represents a document in the RAG system"""
	document_id: str
	title: str
	content: str
	document_type: str = "text"
	category: str = "general"
	tags: List[str] = None
	metadata: Dict[str, Any] = None
	chunk_count: int = 0
	created_at: Optional[datetime] = None
	updated_at: Optional[datetime] = None
	
	def __post_init__(self):
		if self.tags is None:
			self.tags = []
		if self.metadata is None:
			self.metadata = {}

class RAGDatabase:
	"""PostgreSQL database layer for RAG system with pgai integration"""
	
	def __init__(self, config: DatabaseConfiguration):
		_validate_schema_name(config.schema_name)
		self.config = config
		self.pool: Optional[asyncpg.Pool] = None
		self.logger = logging.getLogger(__name__)

		# Connection state
		self._initialized = False
		self._schema_initialized = False
		
	async def initialize(self):
		"""Initialize database connection and schema"""
		if self._initialized:
			return
			
		try:
			# Create connection pool
			self.pool = await asyncpg.create_pool(
				self.config.connection_string,
				min_size=self.config.pool_size,
				max_size=self.config.max_pool_size,
				command_timeout=self.config.command_timeout
			)
			
			self.logger.info("Database connection pool created successfully")
			
			# Initialize schema if needed
			await self._initialize_schema()
			
			self._initialized = True
			self.logger.info("RAG database initialized successfully")
			
		except Exception as e:
			self.logger.error(f"Failed to initialize RAG database: {e}")
			raise RuntimeError(f"Database initialization failed: {e}") from e
	
	async def _initialize_schema(self):
		"""Initialize database schema and pgai setup"""
		if self._schema_initialized:
			return
			
		async with self.pool.acquire() as conn:
			try:
				# Create schema
				await conn.execute(f"""
					CREATE SCHEMA IF NOT EXISTS {self.config.schema_name}
				""")
				
				# Enable required extensions
				await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
				await conn.execute("CREATE EXTENSION IF NOT EXISTS ai CASCADE")
				
				# Create documents table
				await conn.execute(f"""
					CREATE TABLE IF NOT EXISTS {self.config.schema_name}.documents (
						document_id VARCHAR(255) PRIMARY KEY,
						title TEXT NOT NULL,
						content TEXT NOT NULL,
						document_type VARCHAR(100) DEFAULT 'text',
						category VARCHAR(100) DEFAULT 'general',
						tags TEXT[] DEFAULT '{{}}',
						metadata JSONB DEFAULT '{{}}',
						chunk_count INTEGER DEFAULT 0,
						created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
						updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
					)
				""")
				
				# Create document chunks table with vector column
				await conn.execute(f"""
					CREATE TABLE IF NOT EXISTS {self.config.schema_name}.document_chunks (
						chunk_id VARCHAR(255) PRIMARY KEY,
						document_id VARCHAR(255) REFERENCES {self.config.schema_name}.documents(document_id) ON DELETE CASCADE,
						chunk_index INTEGER NOT NULL,
						content TEXT NOT NULL,
						metadata JSONB DEFAULT '{{}}',
						embedding vector({self.config.embedding_dimensions}),
						created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
						updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
						UNIQUE(document_id, chunk_index)
					)
				""")
				
				# Create indexes for performance
				await conn.execute(f"""
					CREATE INDEX IF NOT EXISTS idx_documents_category 
					ON {self.config.schema_name}.documents(category)
				""")
				
				await conn.execute(f"""
					CREATE INDEX IF NOT EXISTS idx_documents_tags 
					ON {self.config.schema_name}.documents USING GIN(tags)
				""")
				
				await conn.execute(f"""
					CREATE INDEX IF NOT EXISTS idx_documents_metadata 
					ON {self.config.schema_name}.documents USING GIN(metadata)
				""")
				
				await conn.execute(f"""
					CREATE INDEX IF NOT EXISTS idx_chunks_document_id 
					ON {self.config.schema_name}.document_chunks(document_id)
				""")
				
				# Create vector similarity index using HNSW
				await conn.execute(f"""
					CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
					ON {self.config.schema_name}.document_chunks 
					USING hnsw (embedding vector_cosine_ops)
					WITH (m = 16, ef_construction = 64)
				""")
				
				# Create updated_at trigger function
				await conn.execute(f"""
					CREATE OR REPLACE FUNCTION {self.config.schema_name}.update_updated_at_column()
					RETURNS TRIGGER AS $$
					BEGIN
						NEW.updated_at = CURRENT_TIMESTAMP;
						RETURN NEW;
					END;
					$$ language 'plpgsql'
				""")
				
				# Create triggers for updated_at
				await conn.execute(f"""
					DROP TRIGGER IF EXISTS update_documents_updated_at ON {self.config.schema_name}.documents
				""")
				await conn.execute(f"""
					CREATE TRIGGER update_documents_updated_at
					BEFORE UPDATE ON {self.config.schema_name}.documents
					FOR EACH ROW EXECUTE FUNCTION {self.config.schema_name}.update_updated_at_column()
				""")
				
				await conn.execute(f"""
					DROP TRIGGER IF EXISTS update_chunks_updated_at ON {self.config.schema_name}.document_chunks
				""")
				await conn.execute(f"""
					CREATE TRIGGER update_chunks_updated_at
					BEFORE UPDATE ON {self.config.schema_name}.document_chunks
					FOR EACH ROW EXECUTE FUNCTION {self.config.schema_name}.update_updated_at_column()
				""")
				
				self._schema_initialized = True
				self.logger.info("Database schema initialized successfully")
				
			except Exception as e:
				self.logger.error(f"Schema initialization failed: {e}")
				raise
	
	async def store_document(self, document: RAGDocument) -> bool:
		"""Store a document in the database"""
		async with self.pool.acquire() as conn:
			try:
				await conn.execute(f"""
					INSERT INTO {self.config.schema_name}.documents 
					(document_id, title, content, document_type, category, tags, metadata)
					VALUES ($1, $2, $3, $4, $5, $6, $7)
					ON CONFLICT (document_id) 
					DO UPDATE SET 
						title = EXCLUDED.title,
						content = EXCLUDED.content,
						document_type = EXCLUDED.document_type,
						category = EXCLUDED.category,
						tags = EXCLUDED.tags,
						metadata = EXCLUDED.metadata,
						updated_at = CURRENT_TIMESTAMP
				""", 
					document.document_id,
					document.title,
					document.content,
					document.document_type,
					document.category,
					document.tags,
					json.dumps(document.metadata)
				)
				
				self.logger.info(f"Document stored successfully: {document.document_id}")
				return True
				
			except Exception as e:
				self.logger.error(f"Failed to store document {document.document_id}: {e}")
				return False
	
	async def store_chunks(self, chunks: List[DocumentChunk]) -> int:
		"""Store document chunks with embeddings"""
		if not chunks:
			return 0
			
		stored_count = 0
		async with self.pool.acquire() as conn:
			async with conn.transaction():
				for chunk in chunks:
					try:
						await conn.execute(f"""
							INSERT INTO {self.config.schema_name}.document_chunks
							(chunk_id, document_id, chunk_index, content, metadata, embedding)
							VALUES ($1, $2, $3, $4, $5, $6)
							ON CONFLICT (document_id, chunk_index)
							DO UPDATE SET
								chunk_id = EXCLUDED.chunk_id,
								content = EXCLUDED.content,
								metadata = EXCLUDED.metadata,
								embedding = EXCLUDED.embedding,
								updated_at = CURRENT_TIMESTAMP
						""",
							chunk.chunk_id,
							chunk.document_id,
							chunk.chunk_index,
							chunk.content,
							json.dumps(chunk.metadata),
							chunk.embedding
						)
						stored_count += 1
						
					except Exception as e:
						self.logger.error(f"Failed to store chunk {chunk.chunk_id}: {e}")
						
				# Update document chunk count
				if stored_count > 0:
					await conn.execute(f"""
						UPDATE {self.config.schema_name}.documents 
						SET chunk_count = (
							SELECT COUNT(*) FROM {self.config.schema_name}.document_chunks 
							WHERE document_id = $1
						)
						WHERE document_id = $1
					""", chunks[0].document_id)
		
		self.logger.info(f"Stored {stored_count}/{len(chunks)} chunks successfully")
		return stored_count
	
	async def get_document(self, document_id: str) -> Optional[RAGDocument]:
		"""Retrieve a document by ID"""
		async with self.pool.acquire() as conn:
			try:
				row = await conn.fetchrow(f"""
					SELECT document_id, title, content, document_type, category, 
						   tags, metadata, chunk_count, created_at, updated_at
					FROM {self.config.schema_name}.documents
					WHERE document_id = $1
				""", document_id)
				
				if row:
					return RAGDocument(
						document_id=row['document_id'],
						title=row['title'],
						content=row['content'],
						document_type=row['document_type'],
						category=row['category'],
						tags=list(row['tags']) if row['tags'] else [],
						metadata=dict(row['metadata']) if row['metadata'] else {},
						chunk_count=row['chunk_count'],
						created_at=row['created_at'],
						updated_at=row['updated_at']
					)
				return None
				
			except Exception as e:
				self.logger.error(f"Failed to retrieve document {document_id}: {e}")
				return None
	
	async def semantic_search(
		self,
		query_embedding: List[float],
		limit: int = 10,
		similarity_threshold: float = 0.7,
		filters: Optional[Dict[str, Any]] = None
	) -> List[Dict[str, Any]]:
		"""Perform semantic search using vector similarity"""
		async with self.pool.acquire() as conn:
			try:
				# Build WHERE clause for filters
				where_conditions = ["1 = 1"]
				params = [query_embedding, limit]
				param_count = 2
				
				if filters:
					if 'category' in filters:
						param_count += 1
						where_conditions.append(f"d.category = ${param_count}")
						params.append(filters['category'])
					
					if 'document_type' in filters:
						param_count += 1
						where_conditions.append(f"d.document_type = ${param_count}")
						params.append(filters['document_type'])
					
					if 'tags' in filters:
						param_count += 1
						where_conditions.append(f"d.tags && ${param_count}")
						params.append(filters['tags'])
				
				# Add similarity threshold
				param_count += 1
				where_conditions.append(f"(1 - (c.embedding <=> ${1})) >= ${param_count}")
				params.append(similarity_threshold)
				
				where_clause = " AND ".join(where_conditions)
				
				query = f"""
					SELECT 
						c.chunk_id,
						c.document_id,
						c.chunk_index,
						c.content,
						c.metadata as chunk_metadata,
						d.title,
						d.document_type,
						d.category,
						d.tags,
						d.metadata as doc_metadata,
						(1 - (c.embedding <=> $1)) as similarity_score
					FROM {self.config.schema_name}.document_chunks c
					JOIN {self.config.schema_name}.documents d ON c.document_id = d.document_id
					WHERE {where_clause}
					ORDER BY c.embedding <=> $1
					LIMIT $2
				"""
				
				rows = await conn.fetch(query, *params)
				
				results = []
				for row in rows:
					results.append({
						'chunk_id': row['chunk_id'],
						'document_id': row['document_id'],
						'chunk_index': row['chunk_index'],
						'content': row['content'],
						'chunk_metadata': dict(row['chunk_metadata']) if row['chunk_metadata'] else {},
						'document_title': row['title'],
						'document_type': row['document_type'],
						'category': row['category'],
						'tags': list(row['tags']) if row['tags'] else [],
						'document_metadata': dict(row['doc_metadata']) if row['doc_metadata'] else {},
						'similarity_score': float(row['similarity_score'])
					})
				
				return results
				
			except Exception as e:
				self.logger.error(f"Semantic search failed: {e}")
				return []
	
	async def list_documents(
		self,
		category: Optional[str] = None,
		document_type: Optional[str] = None,
		tags: Optional[List[str]] = None,
		limit: int = 100,
		offset: int = 0
	) -> List[RAGDocument]:
		"""List documents with optional filtering"""
		async with self.pool.acquire() as conn:
			try:
				where_conditions = ["1 = 1"]
				params = []
				param_count = 0
				
				if category:
					param_count += 1
					where_conditions.append(f"category = ${param_count}")
					params.append(category)
				
				if document_type:
					param_count += 1
					where_conditions.append(f"document_type = ${param_count}")
					params.append(document_type)
				
				if tags:
					param_count += 1
					where_conditions.append(f"tags && ${param_count}")
					params.append(tags)
				
				param_count += 1
				params.append(limit)
				param_count += 1
				params.append(offset)
				
				where_clause = " AND ".join(where_conditions)
				
				query = f"""
					SELECT document_id, title, content, document_type, category,
						   tags, metadata, chunk_count, created_at, updated_at
					FROM {self.config.schema_name}.documents
					WHERE {where_clause}
					ORDER BY updated_at DESC
					LIMIT ${param_count-1} OFFSET ${param_count}
				"""
				
				rows = await conn.fetch(query, *params)
				
				documents = []
				for row in rows:
					documents.append(RAGDocument(
						document_id=row['document_id'],
						title=row['title'],
						content=row['content'],
						document_type=row['document_type'],
						category=row['category'],
						tags=list(row['tags']) if row['tags'] else [],
						metadata=dict(row['metadata']) if row['metadata'] else {},
						chunk_count=row['chunk_count'],
						created_at=row['created_at'],
						updated_at=row['updated_at']
					))
				
				return documents
				
			except Exception as e:
				self.logger.error(f"Failed to list documents: {e}")
				return []
	
	async def delete_document(self, document_id: str) -> bool:
		"""Delete a document and its chunks"""
		async with self.pool.acquire() as conn:
			async with conn.transaction():
				try:
					# Delete chunks first (CASCADE should handle this, but being explicit)
					await conn.execute(f"""
						DELETE FROM {self.config.schema_name}.document_chunks
						WHERE document_id = $1
					""", document_id)
					
					# Delete document
					result = await conn.execute(f"""
						DELETE FROM {self.config.schema_name}.documents
						WHERE document_id = $1
					""", document_id)
					
					deleted = result.split()[-1] == "1"  # "DELETE 1" means one row deleted
					
					if deleted:
						self.logger.info(f"Document {document_id} deleted successfully")
					
					return deleted
					
				except Exception as e:
					self.logger.error(f"Failed to delete document {document_id}: {e}")
					return False
	
	async def get_statistics(self) -> Dict[str, Any]:
		"""Get database statistics"""
		async with self.pool.acquire() as conn:
			try:
				# Get document counts
				doc_stats = await conn.fetchrow(f"""
					SELECT 
						COUNT(*) as total_documents,
						COUNT(CASE WHEN chunk_count > 0 THEN 1 END) as documents_with_chunks,
						AVG(chunk_count) as avg_chunks_per_doc,
						SUM(chunk_count) as total_chunks
					FROM {self.config.schema_name}.documents
				""")
				
				# Get category breakdown
				category_stats = await conn.fetch(f"""
					SELECT category, COUNT(*) as count
					FROM {self.config.schema_name}.documents
					GROUP BY category
					ORDER BY count DESC
					LIMIT 10
				""")
				
				# Get document type breakdown
				type_stats = await conn.fetch(f"""
					SELECT document_type, COUNT(*) as count
					FROM {self.config.schema_name}.documents
					GROUP BY document_type
					ORDER BY count DESC
				""")
				
				# Get storage size estimate
				size_stats = await conn.fetchrow(f"""
					SELECT 
						pg_size_pretty(pg_total_relation_size('{self.config.schema_name}.documents')) as documents_size,
						pg_size_pretty(pg_total_relation_size('{self.config.schema_name}.document_chunks')) as chunks_size
				""")
				
				return {
					'total_documents': doc_stats['total_documents'] or 0,
					'documents_with_chunks': doc_stats['documents_with_chunks'] or 0,
					'total_chunks': doc_stats['total_chunks'] or 0,
					'avg_chunks_per_document': float(doc_stats['avg_chunks_per_doc'] or 0),
					'categories': {row['category']: row['count'] for row in category_stats},
					'document_types': {row['document_type']: row['count'] for row in type_stats},
					'storage_size': {
						'documents': size_stats['documents_size'] if size_stats else '0 bytes',
						'chunks': size_stats['chunks_size'] if size_stats else '0 bytes'
					},
					'schema_name': self.config.schema_name,
					'embedding_model': self.config.embedding_model,
					'embedding_dimensions': self.config.embedding_dimensions
				}
				
			except Exception as e:
				self.logger.error(f"Failed to get statistics: {e}")
				return {}
	
	async def close(self):
		"""Close database connection pool"""
		if self.pool:
			await self.pool.close()
			self.logger.info("Database connection pool closed")

# Utility functions
async def create_rag_database(connection_string: str, **kwargs) -> RAGDatabase:
	"""Create and initialize RAG database"""
	config = DatabaseConfiguration(
		connection_string=connection_string,
		**kwargs
	)
	
	database = RAGDatabase(config)
	await database.initialize()
	return database

def get_default_database_config(connection_string: str) -> DatabaseConfiguration:
	"""Get default database configuration"""
	return DatabaseConfiguration(
		connection_string=connection_string,
		pool_size=10,
		max_pool_size=20,
		command_timeout=30.0,
		enable_pgai=True,
		embedding_model="openai/text-embedding-ada-002",
		embedding_dimensions=1536,
		chunk_size=1000,
		chunk_overlap=200,
		schema_name="rag"
	)