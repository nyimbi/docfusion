#!/usr/bin/env python3
"""
TextSearchEngine Module for DocuFusion Storage Layer

Implements basic keyword matching with stemming, Boolean search operators (AND, OR, NOT),
result ranking by relevance (TF-IDF), fuzzy search capabilities, and search result highlighting.
Designed to handle 1000+ documents with optimized performance.
"""

import asyncio
import re
import math
from dataclasses import dataclass, field
from typing import Dict, List, Set, Any, Optional, Tuple
from pathlib import Path
from collections import defaultdict, Counter
import json
import pickle
from datetime import datetime
try:
	from uuid_extensions import uuid7str
except ImportError:
	from uuid import uuid4
	def uuid7str() -> str:
		return str(uuid4())
from difflib import SequenceMatcher

# Stemming and text processing
try:
	from nltk.stem import PorterStemmer
	from nltk.corpus import stopwords
	from nltk.tokenize import word_tokenize
	import nltk
	nltk_available = True
except ImportError:
	nltk_available = False


@dataclass
class SearchResult:
	"""Search result with relevance scoring and highlighting"""
	document_id: str
	title: str
	content: str
	relevance_score: float
	highlights: List[str] = field(default_factory=list)
	metadata: Dict[str, Any] = field(default_factory=dict)
	match_type: str = "exact"  # exact, fuzzy, boolean, semantic


@dataclass
class SearchQuery:
	"""Structured search query with multiple parameters"""
	query: str
	boolean_operators: bool = True
	fuzzy_search: bool = True
	max_fuzzy_distance: int = 2
	highlight_fragments: int = 3
	result_limit: int = 50
	min_relevance_threshold: float = 0.1


@dataclass
class DocumentIndex:
	"""Document index for search operations"""
	document_id: str
	title: str
	content: str
	tokens: List[str] = field(default_factory=list)
	stems: List[str] = field(default_factory=list)
	metadata: Dict[str, Any] = field(default_factory=dict)
	word_count: int = 0
	created_at: datetime = field(default_factory=datetime.now)
	last_updated: datetime = field(default_factory=datetime.now)


@dataclass
class SearchStats:
	"""Search performance and usage statistics"""
	total_searches: int = 0
	successful_searches: int = 0
	average_search_time: float = 0.0
	most_common_queries: Dict[str, int] = field(default_factory=dict)
	performance_metrics: Dict[str, float] = field(default_factory=dict)


class TextSearchEngine:
	"""
	Advanced text search engine with keyword matching, Boolean operators, 
	fuzzy search, and TF-IDF relevance ranking
	"""
	
	def __init__(self, storage_path: Optional[Path] = None):
		self.storage_path = storage_path or Path("./storage/search_indexes")
		self.storage_path.mkdir(parents=True, exist_ok=True)
		
		# Initialize document indexes and statistics
		self.document_indexes: Dict[str, DocumentIndex] = {}
		self.inverted_index: Dict[str, Set[str]] = defaultdict(set)  # word -> document_ids
		self.tf_idf_scores: Dict[str, Dict[str, float]] = defaultdict(dict)  # doc_id -> {word: tf_idf}
		self.document_frequencies: Dict[str, int] = defaultdict(int)  # word -> num_docs_containing
		self.total_documents: int = 0
		self.stats = SearchStats()
		
		# Initialize NLTK components if available
		self.stemmer = None
		self.stop_words = set()
		if nltk_available:
			try:
				self.stemmer = PorterStemmer()
				self.stop_words = set(stopwords.words('english'))
			except LookupError:
				pass  # NLTK data not downloaded
		
		# Load existing indexes
		self._load_indexes()
	
	def _tokenize_text(self, text: str) -> List[str]:
		"""Tokenize text into words with preprocessing"""
		if not text:
			return []
		
		# Convert to lowercase and extract words
		text = text.lower()
		if nltk_available:
			try:
				tokens = word_tokenize(text)
			except LookupError:
				# Fallback if NLTK data not available
				tokens = re.findall(r'\b\w+\b', text)
		else:
			tokens = re.findall(r'\b\w+\b', text)
		
		# Remove stop words and short words
		tokens = [token for token in tokens if len(token) > 2 and token not in self.stop_words]
		
		return tokens
	
	def _stem_tokens(self, tokens: List[str]) -> List[str]:
		"""Apply stemming to tokens"""
		if self.stemmer:
			return [self.stemmer.stem(token) for token in tokens]
		return tokens
	
	def _calculate_tf_idf(self, document_id: str, tokens: List[str]) -> Dict[str, float]:
		"""Calculate TF-IDF scores for document tokens"""
		tf_idf_scores = {}
		token_counts = Counter(tokens)
		total_tokens = len(tokens)
		
		for token, count in token_counts.items():
			# Term frequency
			tf = count / total_tokens
			
			# Inverse document frequency
			doc_freq = self.document_frequencies.get(token, 1)
			idf = math.log(self.total_documents / doc_freq) if doc_freq > 0 else 0
			
			# TF-IDF score
			tf_idf_scores[token] = tf * idf
		
		return tf_idf_scores
	
	def _update_inverted_index(self, document_id: str, tokens: List[str]) -> None:
		"""Update inverted index with document tokens"""
		unique_tokens = set(tokens)
		
		# Add document to inverted index for each unique token
		for token in unique_tokens:
			self.inverted_index[token].add(document_id)
			if document_id not in [doc for doc in self.document_indexes.values() if token in doc.stems]:
				self.document_frequencies[token] += 1
	
	def _parse_boolean_query(self, query: str) -> Tuple[List[str], List[str], List[str]]:
		"""Parse Boolean query into AND, OR, and NOT terms"""
		query = query.upper()
		
		# Split by operators
		and_terms = []
		or_terms = []
		not_terms = []
		
		# Simple parsing - can be enhanced with proper query parser
		parts = re.split(r'\s+(AND|OR|NOT)\s+', query)
		current_operator = "AND"  # Default
		
		for part in parts:
			part = part.strip()
			if part in ["AND", "OR", "NOT"]:
				current_operator = part
			elif part:
				term = part.lower()
				if current_operator == "AND":
					and_terms.append(term)
				elif current_operator == "OR":
					or_terms.append(term)
				elif current_operator == "NOT":
					not_terms.append(term)
		
		# If no operators found, treat all terms as AND
		if not and_terms and not or_terms and not not_terms:
			and_terms = query.lower().split()
		
		return and_terms, or_terms, not_terms
	
	def _fuzzy_match(self, query_token: str, indexed_token: str, max_distance: int = 2) -> float:
		"""Calculate fuzzy match score between tokens"""
		if query_token == indexed_token:
			return 1.0
		
		# Use sequence matcher for similarity
		similarity = SequenceMatcher(None, query_token, indexed_token).ratio()
		
		# Check edit distance approximation
		if abs(len(query_token) - len(indexed_token)) > max_distance:
			return similarity * 0.5  # Penalize length differences
		
		return similarity
	
	def _highlight_text(self, text: str, query_tokens: List[str], max_fragments: int = 3) -> List[str]:
		"""Generate highlighted text fragments"""
		highlights = []
		text_lower = text.lower()
		
		for token in query_tokens:
			# Find matches in text
			pattern = re.compile(r'\b' + re.escape(token) + r'\b', re.IGNORECASE)
			matches = list(pattern.finditer(text))
			
			for match in matches[:max_fragments]:
				start = max(0, match.start() - 50)
				end = min(len(text), match.end() + 50)
				fragment = text[start:end]
				
				# Add highlighting tags
				highlighted_fragment = pattern.sub(f"<mark>{token}</mark>", fragment)
				highlights.append(f"...{highlighted_fragment}...")
		
		return highlights[:max_fragments]
	
	async def index_document(self, document_id: str, title: str, content: str, metadata: Optional[Dict[str, Any]] = None) -> None:
		"""Index a document for search"""
		if not content and not title:
			return
		
		# Combine title and content for indexing
		full_text = f"{title} {content}".strip()
		
		# Tokenize and stem
		tokens = self._tokenize_text(full_text)
		stems = self._stem_tokens(tokens)
		
		# Create document index
		doc_index = DocumentIndex(
			document_id=document_id,
			title=title,
			content=content,
			tokens=tokens,
			stems=stems,
			metadata=metadata or {},
			word_count=len(tokens),
			last_updated=datetime.now()
		)
		
		# Remove old document if it exists
		if document_id in self.document_indexes:
			await self.remove_document(document_id)
		
		# Add to indexes
		self.document_indexes[document_id] = doc_index
		self._update_inverted_index(document_id, stems)
		
		# Calculate TF-IDF scores
		self.tf_idf_scores[document_id] = self._calculate_tf_idf(document_id, stems)
		
		self.total_documents = len(self.document_indexes)
		
		# Save updated indexes
		await self._save_indexes()
	
	async def remove_document(self, document_id: str) -> None:
		"""Remove document from search index"""
		if document_id not in self.document_indexes:
			return
		
		doc_index = self.document_indexes[document_id]
		
		# Remove from inverted index
		for token in set(doc_index.stems):
			self.inverted_index[token].discard(document_id)
			if not self.inverted_index[token]:
				del self.inverted_index[token]
				self.document_frequencies[token] = max(0, self.document_frequencies[token] - 1)
		
		# Remove from main indexes
		del self.document_indexes[document_id]
		if document_id in self.tf_idf_scores:
			del self.tf_idf_scores[document_id]
		
		self.total_documents = len(self.document_indexes)
		await self._save_indexes()
	
	async def search(self, query: SearchQuery) -> List[SearchResult]:
		"""Perform comprehensive search with multiple strategies"""
		start_time = asyncio.get_event_loop().time()
		results = []
		
		if not query.query.strip():
			return results
		
		try:
			# Update statistics
			self.stats.total_searches += 1
			query_lower = query.query.lower()
			self.stats.most_common_queries[query_lower] = self.stats.most_common_queries.get(query_lower, 0) + 1
			
			# Parse query based on settings
			if query.boolean_operators and any(op in query.query.upper() for op in ["AND", "OR", "NOT"]):
				results = await self._boolean_search(query)
			else:
				results = await self._keyword_search(query)
			
			# Add fuzzy search if enabled and few results
			if query.fuzzy_search and len(results) < query.result_limit // 2:
				fuzzy_results = await self._fuzzy_search(query)
				# Combine and deduplicate
				existing_ids = {r.document_id for r in results}
				for fuzzy_result in fuzzy_results:
					if fuzzy_result.document_id not in existing_ids:
						results.append(fuzzy_result)
			
			# Sort by relevance score
			results.sort(key=lambda x: x.relevance_score, reverse=True)
			
			# Apply result limit and threshold
			results = [r for r in results if r.relevance_score >= query.min_relevance_threshold][:query.result_limit]
			
			# Generate highlights
			query_tokens = self._tokenize_text(query.query)
			for result in results:
				result.highlights = self._highlight_text(result.content, query_tokens, query.highlight_fragments)
			
			# Update statistics
			if results:
				self.stats.successful_searches += 1
			
			# Calculate performance metrics
			search_time = asyncio.get_event_loop().time() - start_time
			self.stats.performance_metrics['last_search_time'] = search_time
			self.stats.average_search_time = (
				(self.stats.average_search_time * (self.stats.total_searches - 1) + search_time) / 
				self.stats.total_searches
			)
			
		except Exception as e:
			print(f"Search error: {e}")
			# Return empty results on error
			results = []
		
		return results
	
	async def _keyword_search(self, query: SearchQuery) -> List[SearchResult]:
		"""Perform keyword-based search with TF-IDF ranking"""
		results = []
		query_tokens = self._tokenize_text(query.query)
		query_stems = self._stem_tokens(query_tokens)
		
		if not query_stems:
			return results
		
		# Find candidate documents
		candidate_docs = set()
		for stem in query_stems:
			candidate_docs.update(self.inverted_index.get(stem, set()))
		
		# Calculate relevance scores
		for doc_id in candidate_docs:
			if doc_id not in self.document_indexes:
				continue
			
			doc_index = self.document_indexes[doc_id]
			tf_idf_scores = self.tf_idf_scores.get(doc_id, {})
			
			# Calculate relevance as sum of TF-IDF scores for query terms
			relevance_score = 0.0
			for stem in query_stems:
				relevance_score += tf_idf_scores.get(stem, 0.0)
			
			# Normalize by query length
			if len(query_stems) > 0:
				relevance_score /= len(query_stems)
			
			if relevance_score > 0:
				results.append(SearchResult(
					document_id=doc_id,
					title=doc_index.title,
					content=doc_index.content,
					relevance_score=relevance_score,
					metadata=doc_index.metadata,
					match_type="keyword"
				))
		
		return results
	
	async def _boolean_search(self, query: SearchQuery) -> List[SearchResult]:
		"""Perform Boolean search with AND, OR, NOT operators"""
		and_terms, or_terms, not_terms = self._parse_boolean_query(query.query)
		
		# Convert terms to stems
		and_stems = self._stem_tokens(and_terms)
		or_stems = self._stem_tokens(or_terms)
		not_stems = self._stem_tokens(not_terms)
		
		# Find documents matching AND terms (all must be present)
		and_docs = None
		for stem in and_stems:
			stem_docs = self.inverted_index.get(stem, set())
			if and_docs is None:
				and_docs = stem_docs.copy()
			else:
				and_docs &= stem_docs
		
		if and_docs is None:
			and_docs = set()
		
		# Find documents matching OR terms (any can be present)
		or_docs = set()
		for stem in or_stems:
			or_docs.update(self.inverted_index.get(stem, set()))
		
		# Combine AND and OR results
		if and_stems and or_stems:
			candidate_docs = and_docs | or_docs
		elif and_stems:
			candidate_docs = and_docs
		elif or_stems:
			candidate_docs = or_docs
		else:
			candidate_docs = set()
		
		# Remove documents matching NOT terms
		for stem in not_stems:
			not_docs = self.inverted_index.get(stem, set())
			candidate_docs -= not_docs
		
		# Create results with relevance scoring
		results = []
		all_query_stems = and_stems + or_stems
		
		for doc_id in candidate_docs:
			if doc_id not in self.document_indexes:
				continue
			
			doc_index = self.document_indexes[doc_id]
			tf_idf_scores = self.tf_idf_scores.get(doc_id, {})
			
			# Calculate relevance score
			relevance_score = 0.0
			for stem in all_query_stems:
				relevance_score += tf_idf_scores.get(stem, 0.0)
			
			# Boost score for AND terms (required terms)
			and_bonus = 0.0
			for stem in and_stems:
				if stem in doc_index.stems:
					and_bonus += 0.2
			
			relevance_score += and_bonus
			
			if len(all_query_stems) > 0:
				relevance_score /= len(all_query_stems)
			
			if relevance_score > 0:
				results.append(SearchResult(
					document_id=doc_id,
					title=doc_index.title,
					content=doc_index.content,
					relevance_score=relevance_score,
					metadata=doc_index.metadata,
					match_type="boolean"
				))
		
		return results
	
	async def _fuzzy_search(self, query: SearchQuery) -> List[SearchResult]:
		"""Perform fuzzy search for approximate matches"""
		results = []
		query_tokens = self._tokenize_text(query.query)
		query_stems = self._stem_tokens(query_tokens)
		
		if not query_stems:
			return results
		
		# Find fuzzy matches for each query term
		fuzzy_matches = defaultdict(list)  # doc_id -> [(stem, similarity)]
		
		for query_stem in query_stems:
			for indexed_stem in self.inverted_index.keys():
				similarity = self._fuzzy_match(query_stem, indexed_stem, query.max_fuzzy_distance)
				if similarity >= 0.6:  # Minimum similarity threshold
					for doc_id in self.inverted_index[indexed_stem]:
						fuzzy_matches[doc_id].append((indexed_stem, similarity))
		
		# Calculate fuzzy relevance scores
		for doc_id, matches in fuzzy_matches.items():
			if doc_id not in self.document_indexes:
				continue
			
			doc_index = self.document_indexes[doc_id]
			tf_idf_scores = self.tf_idf_scores.get(doc_id, {})
			
			# Calculate fuzzy relevance score
			relevance_score = 0.0
			for stem, similarity in matches:
				base_score = tf_idf_scores.get(stem, 0.0)
				fuzzy_score = base_score * similarity * 0.8  # Penalty for fuzzy match
				relevance_score += fuzzy_score
			
			if len(query_stems) > 0:
				relevance_score /= len(query_stems)
			
			if relevance_score > 0:
				results.append(SearchResult(
					document_id=doc_id,
					title=doc_index.title,
					content=doc_index.content,
					relevance_score=relevance_score,
					metadata=doc_index.metadata,
					match_type="fuzzy"
				))
		
		return results
	
	async def get_search_stats(self) -> SearchStats:
		"""Get search engine statistics"""
		return self.stats
	
	async def suggest_queries(self, partial_query: str, max_suggestions: int = 10) -> List[str]:
		"""Suggest query completions based on indexed content and search history"""
		suggestions = []
		
		if not partial_query.strip():
			# Return most common queries if no input
			common_queries = sorted(
				self.stats.most_common_queries.items(), 
				key=lambda x: x[1], 
				reverse=True
			)[:max_suggestions]
			return [query for query, _ in common_queries]
		
		partial_lower = partial_query.lower()
		
		# Find tokens that start with partial query
		matching_tokens = []
		for token in self.inverted_index.keys():
			if token.startswith(partial_lower) and len(token) > len(partial_lower):
				matching_tokens.append(token)
		
		# Sort by document frequency
		matching_tokens.sort(
			key=lambda token: len(self.inverted_index[token]), 
			reverse=True
		)
		
		suggestions = matching_tokens[:max_suggestions]
		
		# Add fuzzy suggestions if not enough exact matches
		if len(suggestions) < max_suggestions:
			for token in self.inverted_index.keys():
				if token not in suggestions:
					similarity = self._fuzzy_match(partial_lower, token, max_distance=1)
					if similarity >= 0.7:
						suggestions.append(token)
						if len(suggestions) >= max_suggestions:
							break
		
		return suggestions[:max_suggestions]
	
	async def _save_indexes(self) -> None:
		"""Save search indexes to disk"""
		try:
			# Save document indexes
			indexes_file = self.storage_path / "document_indexes.pkl"
			with open(indexes_file, 'wb') as f:
				pickle.dump(self.document_indexes, f)
			
			# Save inverted index
			inverted_file = self.storage_path / "inverted_index.pkl"
			with open(inverted_file, 'wb') as f:
				pickle.dump(dict(self.inverted_index), f)
			
			# Save TF-IDF scores
			tfidf_file = self.storage_path / "tf_idf_scores.pkl"
			with open(tfidf_file, 'wb') as f:
				pickle.dump(self.tf_idf_scores, f)
			
			# Save document frequencies
			freq_file = self.storage_path / "document_frequencies.pkl"
			with open(freq_file, 'wb') as f:
				pickle.dump(self.document_frequencies, f)
			
			# Save statistics
			stats_file = self.storage_path / "search_stats.json"
			with open(stats_file, 'w') as f:
				json.dump({
					'total_searches': self.stats.total_searches,
					'successful_searches': self.stats.successful_searches,
					'average_search_time': self.stats.average_search_time,
					'most_common_queries': self.stats.most_common_queries,
					'performance_metrics': self.stats.performance_metrics,
					'total_documents': self.total_documents
				}, f, indent=2)
				
		except Exception as e:
			print(f"Error saving search indexes: {e}")
	
	def _load_indexes(self) -> None:
		"""Load search indexes from disk"""
		try:
			# Load document indexes
			indexes_file = self.storage_path / "document_indexes.pkl"
			if indexes_file.exists():
				with open(indexes_file, 'rb') as f:
					self.document_indexes = pickle.load(f)
			
			# Load inverted index
			inverted_file = self.storage_path / "inverted_index.pkl"
			if inverted_file.exists():
				with open(inverted_file, 'rb') as f:
					loaded_index = pickle.load(f)
					self.inverted_index = defaultdict(set, loaded_index)
			
			# Load TF-IDF scores
			tfidf_file = self.storage_path / "tf_idf_scores.pkl"
			if tfidf_file.exists():
				with open(tfidf_file, 'rb') as f:
					self.tf_idf_scores = pickle.load(f)
			
			# Load document frequencies
			freq_file = self.storage_path / "document_frequencies.pkl"
			if freq_file.exists():
				with open(freq_file, 'rb') as f:
					self.document_frequencies = pickle.load(f)
			
			# Load statistics
			stats_file = self.storage_path / "search_stats.json"
			if stats_file.exists():
				with open(stats_file, 'r') as f:
					data = json.load(f)
					self.stats.total_searches = data.get('total_searches', 0)
					self.stats.successful_searches = data.get('successful_searches', 0)
					self.stats.average_search_time = data.get('average_search_time', 0.0)
					self.stats.most_common_queries = data.get('most_common_queries', {})
					self.stats.performance_metrics = data.get('performance_metrics', {})
					self.total_documents = data.get('total_documents', 0)
			
		except Exception as e:
			print(f"Error loading search indexes: {e}")
			# Initialize empty indexes on error
			self.document_indexes = {}
			self.inverted_index = defaultdict(set)
			self.tf_idf_scores = defaultdict(dict)
			self.document_frequencies = defaultdict(int)
			self.stats = SearchStats()


# Convenience functions for easy integration
async def create_search_engine(storage_path: Optional[Path] = None) -> TextSearchEngine:
	"""Create and initialize text search engine"""
	engine = TextSearchEngine(storage_path)
	return engine


async def search_documents(query: str, search_engine: TextSearchEngine, **kwargs) -> List[SearchResult]:
	"""Convenience function for document search"""
	search_query = SearchQuery(query=query, **kwargs)
	return await search_engine.search(search_query)