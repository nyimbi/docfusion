#!/usr/bin/env python3
"""
Embedding Service for RAG System

Handles text chunking, embedding generation, and vector operations for the RAG system.
Supports multiple embedding providers including Ollama (default) and OpenAI.
"""

import asyncio
import logging
import re
from dataclasses import dataclass
from typing import Dict, List, Any, Optional, Tuple
import hashlib
from datetime import datetime
import aiohttp

# Optional imports - fallback gracefully if not available
try:
	import openai
	from openai import AsyncOpenAI
	OPENAI_AVAILABLE = True
except ImportError:
	OPENAI_AVAILABLE = False
	openai = None
	AsyncOpenAI = None

from .database import DocumentChunk, RAGDocument
from ...core.utils import uuid7str

@dataclass
class EmbeddingConfiguration:
	"""Configuration for embedding service"""
	# Embedding provider configuration
	provider: str = "ollama"  # "ollama" or "openai"
	
	# Ollama configuration (default)
	ollama_base_url: str = "http://localhost:11434"
	ollama_model: str = "nomic-embed-text"  # Alternative: "bge-m3"
	
	# Ollama load balancing (optional)
	ollama_instances: Optional[List[str]] = None  # Multiple Ollama URLs
	load_balancing_strategy: str = "health_weighted"
	enable_load_balancing: bool = False
	
	# OpenAI configuration (fallback)
	openai_api_key: Optional[str] = None
	openai_model: str = "text-embedding-ada-002"
	
	# Model-specific dimensions (auto-detected if possible)
	embedding_dimensions: Optional[int] = None
	
	# Chunking configuration
	chunk_size: int = 1000
	chunk_overlap: int = 200
	min_chunk_size: int = 100
	
	# Processing configuration
	max_concurrent_requests: int = 10
	request_timeout: float = 30.0
	retry_attempts: int = 3
	retry_delay: float = 1.0
	
	# Caching configuration
	enable_embedding_cache: bool = True
	cache_ttl_hours: int = 24

@dataclass
class EmbeddingResult:
	"""Result of embedding operation"""
	text: str
	embedding: List[float]
	model: str
	dimensions: int
	token_count: int = 0
	processing_time: float = 0.0

@dataclass
class ChunkingResult:
	"""Result of text chunking operation"""
	chunks: List[str]
	chunk_count: int
	total_characters: int
	overlap_characters: int
	processing_time: float = 0.0

class TextChunker:
	"""Handles intelligent text chunking for RAG processing"""
	
	def __init__(self, config: EmbeddingConfiguration):
		self.config = config
		self.logger = logging.getLogger(__name__)
		
		# Sentence boundary patterns
		self.sentence_endings = re.compile(r'[.!?]+\s+')
		self.paragraph_breaks = re.compile(r'\n\s*\n')
		
	def chunk_text(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> ChunkingResult:
		"""Split text into overlapping chunks optimized for embeddings"""
		start_time = datetime.now()
		
		if len(text) <= self.config.chunk_size:
			return ChunkingResult(
				chunks=[text],
				chunk_count=1,
				total_characters=len(text),
				overlap_characters=0,
				processing_time=(datetime.now() - start_time).total_seconds()
			)
		
		chunks = []
		overlap_chars = 0
		
		# Try paragraph-based chunking first
		paragraphs = self.paragraph_breaks.split(text)
		if len(paragraphs) > 1:
			chunks, overlap_chars = self._chunk_by_paragraphs(paragraphs)
		else:
			# Fall back to sentence-based chunking
			sentences = self.sentence_endings.split(text)
			if len(sentences) > 1:
				chunks, overlap_chars = self._chunk_by_sentences(sentences)
			else:
				# Fall back to character-based chunking
				chunks, overlap_chars = self._chunk_by_characters(text)
		
		# Filter out chunks that are too small
		filtered_chunks = [chunk for chunk in chunks if len(chunk.strip()) >= self.config.min_chunk_size]
		
		processing_time = (datetime.now() - start_time).total_seconds()
		
		if not filtered_chunks:
			# Return original text as single chunk if filtering removed everything
			filtered_chunks = [text]
		
		return ChunkingResult(
			chunks=filtered_chunks,
			chunk_count=len(filtered_chunks),
			total_characters=sum(len(chunk) for chunk in filtered_chunks),
			overlap_characters=overlap_chars,
			processing_time=processing_time
		)
	
	def _chunk_by_paragraphs(self, paragraphs: List[str]) -> Tuple[List[str], int]:
		"""Chunk text by paragraphs with overlap"""
		chunks = []
		current_chunk = ""
		overlap_chars = 0
		
		for paragraph in paragraphs:
			paragraph = paragraph.strip()
			if not paragraph:
				continue
				
			# Check if adding this paragraph exceeds chunk size
			if len(current_chunk + "\n\n" + paragraph) > self.config.chunk_size and current_chunk:
				chunks.append(current_chunk.strip())
				
				# Create overlap with previous chunk
				overlap_text = self._create_overlap(current_chunk)
				current_chunk = overlap_text + paragraph
				overlap_chars += len(overlap_text)
			else:
				if current_chunk:
					current_chunk += "\n\n" + paragraph
				else:
					current_chunk = paragraph
		
		if current_chunk.strip():
			chunks.append(current_chunk.strip())
		
		return chunks, overlap_chars
	
	def _chunk_by_sentences(self, sentences: List[str]) -> Tuple[List[str], int]:
		"""Chunk text by sentences with overlap"""
		chunks = []
		current_chunk = ""
		overlap_chars = 0
		
		for sentence in sentences:
			sentence = sentence.strip()
			if not sentence:
				continue
				
			# Check if adding this sentence exceeds chunk size
			if len(current_chunk + " " + sentence) > self.config.chunk_size and current_chunk:
				chunks.append(current_chunk.strip())
				
				# Create overlap with previous chunk
				overlap_text = self._create_overlap(current_chunk)
				current_chunk = overlap_text + sentence
				overlap_chars += len(overlap_text)
			else:
				if current_chunk:
					current_chunk += " " + sentence
				else:
					current_chunk = sentence
		
		if current_chunk.strip():
			chunks.append(current_chunk.strip())
		
		return chunks, overlap_chars
	
	def _chunk_by_characters(self, text: str) -> Tuple[List[str], int]:
		"""Chunk text by character count with word boundaries"""
		chunks = []
		overlap_chars = 0
		
		start = 0
		while start < len(text):
			end = min(start + self.config.chunk_size, len(text))
			
			# Adjust end to word boundary
			if end < len(text):
				# Find the last space within the chunk
				space_pos = text.rfind(' ', start, end)
				if space_pos > start:
					end = space_pos
			
			chunk = text[start:end].strip()
			if chunk:
				chunks.append(chunk)
			
			# Calculate overlap for next chunk
			if end < len(text):
				overlap_size = min(self.config.chunk_overlap, len(chunk))
				overlap_start = max(start, end - overlap_size)
				overlap_text = text[overlap_start:end]
				overlap_chars += len(overlap_text)
				start = end - len(overlap_text)
			else:
				break
		
		return chunks, overlap_chars
	
	def _create_overlap(self, text: str) -> str:
		"""Create overlap text from the end of previous chunk"""
		if len(text) <= self.config.chunk_overlap:
			return text + " "
		
		# Try to find a good breaking point for overlap
		overlap_text = text[-self.config.chunk_overlap:]
		
		# Find the first sentence boundary in the overlap
		sentence_match = self.sentence_endings.search(overlap_text)
		if sentence_match:
			return overlap_text[sentence_match.end():] + " "
		
		# Find the first word boundary
		space_pos = overlap_text.find(' ')
		if space_pos > 0:
			return overlap_text[space_pos + 1:] + " "
		
		return overlap_text + " "

class EmbeddingService:
	"""Service for generating and managing embeddings"""
	
	def __init__(self, config: EmbeddingConfiguration):
		self.config = config
		self.chunker = TextChunker(config)
		self.logger = logging.getLogger(__name__)
		
		# Initialize embedding clients based on provider
		self.openai_client = None
		self.ollama_session = None
		self.load_balancer = None
		
		if config.provider == "openai" and OPENAI_AVAILABLE:
			if config.openai_api_key:
				self.openai_client = AsyncOpenAI(api_key=config.openai_api_key)
			else:
				self.openai_client = AsyncOpenAI()  # Will use OPENAI_API_KEY env var
			self.logger.info(f"Initialized OpenAI embedding client with model: {config.openai_model}")
		elif config.provider == "ollama":
			if config.enable_load_balancing and config.ollama_instances:
				# Initialize load balancer for multiple instances
				self._init_load_balancer()
				self.logger.info(f"Using Ollama load balancer with {len(config.ollama_instances)} instances")
			else:
				# Single Ollama instance
				self.logger.info(f"Using Ollama embedding service at {config.ollama_base_url} with model: {config.ollama_model}")
		else:
			raise ValueError(f"Unsupported embedding provider: {config.provider}")
		
		# Semaphore for concurrent request control
		self.semaphore = asyncio.Semaphore(config.max_concurrent_requests)
		
		# Simple in-memory cache for embeddings
		self.embedding_cache: Dict[str, EmbeddingResult] = {}
		
		# Auto-detect embedding dimensions if not specified
		if self.config.embedding_dimensions is None:
			self.config.embedding_dimensions = self._get_default_dimensions()
	
	def _init_load_balancer(self):
		"""Initialize Ollama load balancer"""
		try:
			from .ollama_loadbalancer import create_load_balancer_config, OllamaLoadBalancer
			
			# Create load balancer config
			lb_config = create_load_balancer_config(
				instances=self.config.ollama_instances,
				strategy=self.config.load_balancing_strategy,
				request_timeout=self.config.request_timeout,
				max_retries=self.config.retry_attempts,
				retry_delay=self.config.retry_delay
			)
			
			self.load_balancer = OllamaLoadBalancer(lb_config)
			self.logger.info("Ollama load balancer initialized successfully")
			
		except ImportError:
			self.logger.error("Load balancer not available - falling back to single instance")
			self.config.enable_load_balancing = False
		except Exception as e:
			self.logger.error(f"Failed to initialize load balancer: {e}")
			self.config.enable_load_balancing = False
	
	def _get_default_dimensions(self) -> int:
		"""Get default embedding dimensions for the configured model"""
		if self.config.provider == "ollama":
			if "nomic-embed-text" in self.config.ollama_model:
				return 768  # nomic-embed-text dimensions
			elif "bge-m3" in self.config.ollama_model:
				return 1024  # bge-m3 dimensions
			else:
				return 1024  # Default for most Ollama embedding models
		else:  # OpenAI
			if "ada-002" in self.config.openai_model:
				return 1536  # text-embedding-ada-002 dimensions
			elif "3-small" in self.config.openai_model:
				return 1536  # text-embedding-3-small dimensions
			elif "3-large" in self.config.openai_model:
				return 3072  # text-embedding-3-large dimensions
			else:
				return 1536  # Default OpenAI dimensions
		
	async def process_document(self, document: RAGDocument) -> List[DocumentChunk]:
		"""Process document into chunks with embeddings"""
		self.logger.info(f"Processing document: {document.document_id}")
		
		# Chunk the document text
		chunking_result = self.chunker.chunk_text(document.content)
		self.logger.info(f"Created {chunking_result.chunk_count} chunks for document {document.document_id}")
		
		# Generate embeddings for all chunks
		chunk_embeddings = await self._generate_embeddings_batch(chunking_result.chunks)
		
		# Create DocumentChunk objects
		document_chunks = []
		embedding_model = self._get_current_model_name()
		
		for i, (chunk_text, embedding_result) in enumerate(zip(chunking_result.chunks, chunk_embeddings)):
			chunk = DocumentChunk(
				chunk_id=uuid7str(),
				document_id=document.document_id,
				chunk_index=i,
				content=chunk_text,
				embedding=embedding_result.embedding if embedding_result else None,
				metadata={
					'chunk_size': len(chunk_text),
					'chunk_word_count': len(chunk_text.split()),
					'embedding_model': embedding_model,
					'embedding_provider': self.config.provider,
					'document_title': document.title,
					'document_category': document.category,
					'document_type': document.document_type
				}
			)
			document_chunks.append(chunk)
		
		self.logger.info(f"Generated embeddings for {len(document_chunks)} chunks")
		return document_chunks
	
	def _get_current_model_name(self) -> str:
		"""Get the current embedding model name"""
		if self.config.provider == "ollama":
			return self.config.ollama_model
		else:
			return self.config.openai_model
	
	async def generate_query_embedding(self, query: str) -> Optional[EmbeddingResult]:
		"""Generate embedding for a search query"""
		return await self._generate_embedding(query)
	
	async def _generate_embeddings_batch(self, texts: List[str]) -> List[Optional[EmbeddingResult]]:
		"""Generate embeddings for multiple texts concurrently"""
		if not texts:
			return []
		
		tasks = [self._generate_embedding(text) for text in texts]
		results = await asyncio.gather(*tasks, return_exceptions=True)
		
		# Handle exceptions in results
		processed_results = []
		for i, result in enumerate(results):
			if isinstance(result, Exception):
				self.logger.error(f"Failed to generate embedding for chunk {i}: {result}")
				processed_results.append(None)
			else:
				processed_results.append(result)
		
		return processed_results
	
	async def _generate_embedding(self, text: str) -> Optional[EmbeddingResult]:
		"""Generate embedding for a single text using configured provider"""
		# Check cache first
		if self.config.enable_embedding_cache:
			cache_key = self._get_cache_key(text)
			if cache_key in self.embedding_cache:
				return self.embedding_cache[cache_key]
		
		async with self.semaphore:
			start_time = datetime.now()
			
			for attempt in range(self.config.retry_attempts):
				try:
					if self.config.provider == "ollama":
						result = await self._generate_ollama_embedding(text, start_time)
					elif self.config.provider == "openai":
						result = await self._generate_openai_embedding(text, start_time)
					else:
						raise ValueError(f"Unsupported provider: {self.config.provider}")
					
					if result:
						# Cache the result
						if self.config.enable_embedding_cache:
							cache_key = self._get_cache_key(text)
							self.embedding_cache[cache_key] = result
						
						return result
						
				except Exception as e:
					self.logger.warning(f"Embedding attempt {attempt + 1} failed: {e}")
					if attempt < self.config.retry_attempts - 1:
						await asyncio.sleep(self.config.retry_delay * (attempt + 1))
					else:
						self.logger.error(f"Failed to generate embedding after {self.config.retry_attempts} attempts: {e}")
						return None
		
		return None
	
	async def _generate_ollama_embedding(self, text: str, start_time: datetime) -> Optional[EmbeddingResult]:
		"""Generate embedding using Ollama API (with optional load balancing)"""
		if self.config.enable_load_balancing and self.load_balancer:
			# Use load balancer for multiple instances
			result = await self.load_balancer.generate_embedding(self.config.ollama_model, text)
			
			if result:
				processing_time = (datetime.now() - start_time).total_seconds()
				
				return EmbeddingResult(
					text=text,
					embedding=result["embedding"],
					model=result["model"],
					dimensions=result["dimensions"],
					token_count=len(text.split()),  # Rough estimate
					processing_time=processing_time
				)
			else:
				raise Exception("Load balancer failed to generate embedding")
		
		else:
			# Use single Ollama instance
			timeout = aiohttp.ClientTimeout(total=self.config.request_timeout)
			
			async with aiohttp.ClientSession(timeout=timeout) as session:
				url = f"{self.config.ollama_base_url}/api/embeddings"
				payload = {
					"model": self.config.ollama_model,
					"prompt": text
				}
				
				async with session.post(url, json=payload) as response:
					if response.status == 200:
						data = await response.json()
						embedding = data.get("embedding", [])
						
						if not embedding:
							raise ValueError("Empty embedding returned from Ollama")
						
						processing_time = (datetime.now() - start_time).total_seconds()
						
						return EmbeddingResult(
							text=text,
							embedding=embedding,
							model=self.config.ollama_model,
							dimensions=len(embedding),
							token_count=len(text.split()),  # Rough estimate
							processing_time=processing_time
						)
					else:
						error_text = await response.text()
						raise Exception(f"Ollama API error {response.status}: {error_text}")
	
	async def _generate_openai_embedding(self, text: str, start_time: datetime) -> Optional[EmbeddingResult]:
		"""Generate embedding using OpenAI API"""
		if not self.openai_client:
			raise Exception("OpenAI client not initialized")
		
		response = await self.openai_client.embeddings.create(
			model=self.config.openai_model,
			input=text,
			timeout=self.config.request_timeout
		)
		
		embedding_data = response.data[0]
		processing_time = (datetime.now() - start_time).total_seconds()
		
		return EmbeddingResult(
			text=text,
			embedding=embedding_data.embedding,
			model=self.config.openai_model,
			dimensions=len(embedding_data.embedding),
			token_count=response.usage.total_tokens,
			processing_time=processing_time
		)
	
	def _get_cache_key(self, text: str) -> str:
		"""Generate cache key for text"""
		# Use hash of text + provider + model for cache key
		model_name = self._get_current_model_name()
		content = f"{text}:{self.config.provider}:{model_name}"
		return hashlib.sha256(content.encode()).hexdigest()
	
	def clear_cache(self):
		"""Clear embedding cache"""
		self.embedding_cache.clear()
		self.logger.info("Embedding cache cleared")
	
	def get_cache_stats(self) -> Dict[str, Any]:
		"""Get embedding cache statistics"""
		return {
			'cache_size': len(self.embedding_cache),
			'cache_enabled': self.config.enable_embedding_cache,
			'max_concurrent_requests': self.config.max_concurrent_requests,
			'embedding_provider': self.config.provider,
			'embedding_model': self._get_current_model_name(),
			'embedding_dimensions': self.config.embedding_dimensions,
			'ollama_base_url': self.config.ollama_base_url if self.config.provider == "ollama" else None
		}
	
	async def close(self):
		"""Clean up resources"""
		if self.ollama_session and not self.ollama_session.closed:
			await self.ollama_session.close()
		
		if self.load_balancer:
			await self.load_balancer.stop()
		
		self.logger.info("Embedding service closed")

# Utility functions
def create_embedding_service(
	provider: str = "ollama",
	ollama_model: str = "nomic-embed-text",
	ollama_base_url: str = "http://localhost:11434",
	openai_api_key: Optional[str] = None,
	chunk_size: int = 1000,
	chunk_overlap: int = 200,
	**kwargs
) -> EmbeddingService:
	"""Create embedding service with default configuration"""
	config = EmbeddingConfiguration(
		provider=provider,
		ollama_model=ollama_model,
		ollama_base_url=ollama_base_url,
		openai_api_key=openai_api_key,
		chunk_size=chunk_size,
		chunk_overlap=chunk_overlap,
		**kwargs
	)
	return EmbeddingService(config)

def get_optimal_chunk_size(text: str, target_chunks: int = 10) -> int:
	"""Calculate optimal chunk size for a given text"""
	text_length = len(text)
	if target_chunks <= 1:
		return text_length
	
	# Account for overlap
	effective_chunk_size = text_length // target_chunks
	return min(max(effective_chunk_size, 500), 2000)  # Keep between 500-2000 chars
