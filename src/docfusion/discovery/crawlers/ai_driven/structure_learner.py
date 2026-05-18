#!/usr/bin/env python3
"""
Structure Learning Engine

Machine learning system that learns from successful extractions to improve
future scraping performance. Uses various ML techniques to:
- Learn site patterns from successful extractions
- Build similarity matching for new sites
- Recommend extraction strategies
- Continuously improve from user feedback
- Adapt to changing website structures
"""

import asyncio
import json
import logging
import pickle
import numpy as np
from typing import Dict, List, Optional, Any, Tuple, Set
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
import hashlib
from urllib.parse import urlparse
from collections import defaultdict, Counter
import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import DBSCAN, KMeans
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import pandas as pd

from pydantic import BaseModel, Field
from ....core.utils import uuid7str

logger = logging.getLogger(__name__)


class ExtractionAttempt(BaseModel):
	"""Records an extraction attempt and its results"""
	attempt_id: str = Field(default_factory=uuid7str)
	url: str
	domain: str
	timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	
	# Method and parameters used
	extraction_method: str
	method_parameters: Dict[str, Any] = Field(default_factory=dict)
	
	# Results
	success: bool
	opportunities_found: int = 0
	extraction_time: float = 0.0
	
	# Content characteristics
	page_features: Dict[str, Any] = Field(default_factory=dict)
	html_features: Dict[str, Any] = Field(default_factory=dict)
	visual_features: Dict[str, Any] = Field(default_factory=dict)
	
	# Selectors that worked (if any)
	successful_selectors: List[str] = Field(default_factory=list)
	failed_selectors: List[str] = Field(default_factory=list)
	
	# User feedback (if available)
	user_rating: Optional[float] = None  # 0-1 scale
	user_feedback: Optional[str] = None


class SitePattern(BaseModel):
	"""Learned pattern for a site or group of similar sites"""
	pattern_id: str = Field(default_factory=uuid7str)
	domain_patterns: List[str] = Field(default_factory=list)  # regex patterns for domains
	site_type: str = "unknown"  # government, corporate, marketplace, etc.
	
	# Structural patterns
	common_selectors: Dict[str, float] = Field(default_factory=dict)  # selector -> confidence
	layout_patterns: Dict[str, Any] = Field(default_factory=dict)
	
	# Content patterns
	content_indicators: List[str] = Field(default_factory=list)  # Text patterns that indicate opportunities
	anti_patterns: List[str] = Field(default_factory=list)       # Patterns to avoid
	
	# Technical characteristics
	requires_javascript: bool = False
	has_pagination: bool = False
	has_search_filters: bool = False
	typical_load_time: float = 0.0
	
	# Success metrics
	success_rate: float = 0.0
	extraction_attempts: int = 0
	last_successful_extraction: Optional[datetime] = None
	
	# ML features
	feature_vector: Optional[List[float]] = None
	cluster_id: Optional[int] = None


class StrategyRecommendation(BaseModel):
	"""Recommendation for extraction strategy"""
	recommended_method: str
	confidence: float = 0.0
	estimated_success_rate: float = 0.0
	estimated_extraction_time: float = 0.0
	
	# Method-specific parameters
	parameters: Dict[str, Any] = Field(default_factory=dict)
	
	# Alternative strategies
	fallback_methods: List[str] = Field(default_factory=list)
	
	# Reasoning
	reasoning: List[str] = Field(default_factory=list)


class StructureLearner:
	"""
	Machine learning engine for learning website structures and extraction patterns
	"""
	
	def __init__(self, model_cache_dir: Optional[Path] = None):
		self.logger = logging.getLogger(__name__)
		
		# Storage
		self.model_cache_dir = model_cache_dir or Path(tempfile.gettempdir()) / "structure_learner_models"
		self.model_cache_dir.mkdir(exist_ok=True)
		
		# Data storage
		self.extraction_attempts: List[ExtractionAttempt] = []
		self.site_patterns: Dict[str, SitePattern] = {}
		self.domain_clusters: Dict[int, List[str]] = {}
		
		# ML Models
		self.tfidf_vectorizer = TfidfVectorizer(
			max_features=1000,
			stop_words='english',
			ngram_range=(1, 3)
		)
		self.clustering_model = DBSCAN(eps=0.3, min_samples=2)
		self.success_predictor = RandomForestClassifier(n_estimators=100, random_state=42)
		self.method_selector = RandomForestClassifier(n_estimators=50, random_state=42)
		
		# Feature extraction
		self.html_patterns = [
			r'class="[^"]*(?:tender|opportunity|procurement|bid|rfp|rfq)[^"]*"',
			r'id="[^"]*(?:tender|opportunity|procurement|bid|rfp|rfq)[^"]*"',
			r'<(?:table|div|ul|li)[^>]*>.*?(?:deadline|due date|closes).*?</(?:table|div|ul|li)>',
			r'<(?:a|button)[^>]*href="[^"]*(?:tender|bid|opportunity)[^"]*"',
		]
		
		# Load existing models if available
		self._load_models()
		
		# Performance tracking
		self.learning_stats = {
			'total_attempts_recorded': 0,
			'patterns_learned': 0,
			'predictions_made': 0,
			'prediction_accuracy': 0.0,
			'model_updates': 0
		}
	
	async def record_extraction_attempt(self, attempt: ExtractionAttempt):
		"""Record an extraction attempt for learning"""
		try:
			# Add domain if not present
			if not attempt.domain:
				attempt.domain = urlparse(attempt.url).netloc
			
			# Extract features from the attempt
			await self._extract_features(attempt)
			
			# Store the attempt
			self.extraction_attempts.append(attempt)
			self.learning_stats['total_attempts_recorded'] += 1
			
			# Update site pattern
			await self._update_site_pattern(attempt)
			
			# Trigger learning if we have enough data
			if len(self.extraction_attempts) % 10 == 0:
				await self._trigger_incremental_learning()
			
			self.logger.debug(f"Recorded extraction attempt for {attempt.domain}")
			
		except Exception as e:
			self.logger.error(f"Failed to record extraction attempt: {e}")
	
	async def _extract_features(self, attempt: ExtractionAttempt):
		"""Extract features from an extraction attempt"""
		try:
			# Page features
			attempt.page_features = {
				'domain_length': len(attempt.domain),
				'path_depth': attempt.url.count('/') - 2,  # Subtract protocol and domain
				'has_query_params': '?' in attempt.url,
				'domain_type': self._classify_domain_type(attempt.domain)
			}
			
			# If we have HTML content, extract HTML features
			# This would be passed from the scraper
			if 'html_content' in attempt.method_parameters:
				html_content = attempt.method_parameters['html_content']
				attempt.html_features = await self._extract_html_features(html_content)
			
			# Visual features would come from VisionScraper
			if 'visual_analysis' in attempt.method_parameters:
				visual_data = attempt.method_parameters['visual_analysis']
				attempt.visual_features = self._extract_visual_features(visual_data)
				
		except Exception as e:
			self.logger.warning(f"Feature extraction failed: {e}")
	
	def _classify_domain_type(self, domain: str) -> str:
		"""Classify domain type based on patterns"""
		domain_lower = domain.lower()
		
		if any(gov_pattern in domain_lower for gov_pattern in ['.gov', 'government', 'municipal', 'city']):
			return 'government'
		elif any(edu_pattern in domain_lower for edu_pattern in ['.edu', 'university', 'college']):
			return 'education'
		elif any(org_pattern in domain_lower for org_pattern in ['.org', 'foundation', 'nonprofit']):
			return 'nonprofit'
		elif 'tender' in domain_lower or 'procurement' in domain_lower:
			return 'procurement_platform'
		else:
			return 'corporate'
	
	async def _extract_html_features(self, html_content: str) -> Dict[str, Any]:
		"""Extract features from HTML content"""
		features = {}
		
		try:
			from bs4 import BeautifulSoup
			soup = BeautifulSoup(html_content, 'html.parser')
			
			# Basic structure features
			features['total_elements'] = len(soup.find_all())
			features['div_count'] = len(soup.find_all('div'))
			features['table_count'] = len(soup.find_all('table'))
			features['form_count'] = len(soup.find_all('form'))
			features['link_count'] = len(soup.find_all('a'))
			features['script_count'] = len(soup.find_all('script'))
			
			# Content features
			features['text_length'] = len(soup.get_text())
			features['has_search_form'] = bool(soup.find('form', {'class': re.compile(r'search', re.I)}))
			features['has_pagination'] = bool(soup.find(['div', 'nav'], string=re.compile(r'page|next|previous', re.I)))
			
			# Procurement-specific features
			features['tender_keywords'] = len(re.findall(
				r'\b(?:tender|procurement|bid|rfp|rfq|opportunity|contract)\b', 
				soup.get_text().lower()
			))
			
			# Pattern matching
			html_text = str(soup)
			for i, pattern in enumerate(self.html_patterns):
				matches = len(re.findall(pattern, html_text, re.IGNORECASE | re.DOTALL))
				features[f'pattern_{i}_matches'] = matches
			
			# Class and ID analysis
			all_classes = []
			all_ids = []
			
			for element in soup.find_all():
				if element.get('class'):
					all_classes.extend(element['class'])
				if element.get('id'):
					all_ids.append(element['id'])
			
			# Common procurement-related classes/IDs
			procurement_terms = ['tender', 'opportunity', 'procurement', 'bid', 'rfp', 'contract']
			features['procurement_classes'] = sum(
				1 for class_name in all_classes 
				if any(term in class_name.lower() for term in procurement_terms)
			)
			features['procurement_ids'] = sum(
				1 for id_name in all_ids 
				if any(term in id_name.lower() for term in procurement_terms)
			)
			
		except Exception as e:
			self.logger.warning(f"HTML feature extraction failed: {e}")
			features = {'extraction_failed': True}
		
		return features
	
	def _extract_visual_features(self, visual_data: Dict[str, Any]) -> Dict[str, Any]:
		"""Extract features from visual analysis data"""
		features = {}
		
		try:
			# Element count features
			features['total_ui_elements'] = visual_data.get('total_elements_detected', 0)
			features['patterns_detected'] = visual_data.get('patterns_detected', 0)
			
			# Pattern type analysis
			pattern_types = visual_data.get('pattern_types', [])
			features['has_grid_pattern'] = 'grid' in pattern_types
			features['has_list_pattern'] = 'list' in pattern_types
			features['has_form_pattern'] = 'form' in pattern_types
			
			# Visual complexity
			features['visual_complexity'] = len(pattern_types)
			features['ocr_regions'] = visual_data.get('ocr_regions_processed', 0)
			
		except Exception as e:
			self.logger.warning(f"Visual feature extraction failed: {e}")
			features = {'extraction_failed': True}
		
		return features
	
	async def _update_site_pattern(self, attempt: ExtractionAttempt):
		"""Update or create site pattern based on extraction attempt"""
		try:
			domain = attempt.domain
			
			# Get or create site pattern
			if domain not in self.site_patterns:
				self.site_patterns[domain] = SitePattern(
					domain_patterns=[domain],
					site_type=attempt.page_features.get('domain_type', 'unknown')
				)
			
			pattern = self.site_patterns[domain]
			pattern.extraction_attempts += 1
			
			# Update success rate
			if attempt.success:
				pattern.success_rate = (
					(pattern.success_rate * (pattern.extraction_attempts - 1) + 1.0) / 
					pattern.extraction_attempts
				)
				pattern.last_successful_extraction = attempt.timestamp
				
				# Learn from successful selectors
				for selector in attempt.successful_selectors:
					if selector not in pattern.common_selectors:
						pattern.common_selectors[selector] = 0.0
					pattern.common_selectors[selector] += 0.1  # Increase confidence
			else:
				pattern.success_rate = (
					pattern.success_rate * (pattern.extraction_attempts - 1) / 
					pattern.extraction_attempts
				)
			
			# Update timing information
			if attempt.extraction_time > 0:
				if pattern.typical_load_time == 0:
					pattern.typical_load_time = attempt.extraction_time
				else:
					pattern.typical_load_time = (pattern.typical_load_time * 0.8 + attempt.extraction_time * 0.2)
			
			# Update technical characteristics
			if attempt.method_parameters.get('requires_javascript', False):
				pattern.requires_javascript = True
			
			# Update layout patterns from successful attempts
			if attempt.success and attempt.visual_features:
				for key, value in attempt.visual_features.items():
					if key not in pattern.layout_patterns:
						pattern.layout_patterns[key] = []
					pattern.layout_patterns[key].append(value)
			
			self.learning_stats['patterns_learned'] = len(self.site_patterns)
			
		except Exception as e:
			self.logger.error(f"Failed to update site pattern: {e}")
	
	async def _trigger_incremental_learning(self):
		"""Trigger incremental learning from recent attempts"""
		try:
			# Only learn from recent attempts to adapt to changes
			recent_cutoff = datetime.now(timezone.utc) - timedelta(days=30)
			recent_attempts = [
				attempt for attempt in self.extraction_attempts 
				if attempt.timestamp > recent_cutoff
			]
			
			if len(recent_attempts) < 10:
				return  # Need minimum data for learning
			
			await self._update_clustering(recent_attempts)
			await self._update_success_predictor(recent_attempts)
			await self._update_method_selector(recent_attempts)
			
			self.learning_stats['model_updates'] += 1
			self.logger.info(f"Performed incremental learning on {len(recent_attempts)} recent attempts")
			
		except Exception as e:
			self.logger.error(f"Incremental learning failed: {e}")
	
	async def _update_clustering(self, attempts: List[ExtractionAttempt]):
		"""Update clustering model to group similar sites"""
		try:
			if len(attempts) < 5:
				return
			
			# Create feature matrix
			features = []
			domains = []
			
			for attempt in attempts:
				feature_vector = self._create_feature_vector(attempt)
				features.append(feature_vector)
				domains.append(attempt.domain)
			
			if not features:
				return
			
			# Perform clustering
			feature_matrix = np.array(features)
			cluster_labels = self.clustering_model.fit_predict(feature_matrix)
			
			# Update domain clusters
			self.domain_clusters = defaultdict(list)
			for domain, cluster_id in zip(domains, cluster_labels):
				if cluster_id != -1:  # -1 is noise in DBSCAN
					self.domain_clusters[cluster_id].append(domain)
			
			# Update site patterns with cluster information
			for domain, cluster_id in zip(domains, cluster_labels):
				if domain in self.site_patterns and cluster_id != -1:
					self.site_patterns[domain].cluster_id = cluster_id
			
		except Exception as e:
			self.logger.warning(f"Clustering update failed: {e}")
	
	async def _update_success_predictor(self, attempts: List[ExtractionAttempt]):
		"""Update model that predicts extraction success"""
		try:
			if len(attempts) < 10:
				return
			
			# Prepare training data
			X = []
			y = []
			
			for attempt in attempts:
				feature_vector = self._create_feature_vector(attempt)
				X.append(feature_vector)
				y.append(1 if attempt.success else 0)
			
			if len(set(y)) < 2:  # Need both success and failure examples
				return
			
			# Train model
			X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
			self.success_predictor.fit(X_train, y_train)
			
			# Evaluate
			if len(X_test) > 0:
				accuracy = self.success_predictor.score(X_test, y_test)
				self.learning_stats['prediction_accuracy'] = accuracy
				self.logger.debug(f"Success predictor accuracy: {accuracy:.3f}")
			
		except Exception as e:
			self.logger.warning(f"Success predictor update failed: {e}")
	
	async def _update_method_selector(self, attempts: List[ExtractionAttempt]):
		"""Update model that selects best extraction method"""
		try:
			if len(attempts) < 15:
				return
			
			# Prepare training data
			X = []
			y = []
			methods = set()
			
			for attempt in attempts:
				if attempt.success:  # Only learn from successful attempts
					feature_vector = self._create_feature_vector(attempt)
					X.append(feature_vector)
					y.append(attempt.extraction_method)
					methods.add(attempt.extraction_method)
			
			if len(methods) < 2 or len(X) < 10:
				return
			
			# Train model
			self.method_selector.fit(X, y)
			
		except Exception as e:
			self.logger.warning(f"Method selector update failed: {e}")
	
	def _create_feature_vector(self, attempt: ExtractionAttempt) -> List[float]:
		"""Create feature vector from extraction attempt"""
		features = []
		
		try:
			# Page features
			page_features = attempt.page_features
			features.extend([
				page_features.get('domain_length', 0),
				page_features.get('path_depth', 0),
				1.0 if page_features.get('has_query_params', False) else 0.0,
			])
			
			# Domain type one-hot encoding
			domain_types = ['government', 'corporate', 'education', 'nonprofit', 'procurement_platform']
			domain_type = page_features.get('domain_type', 'corporate')
			for dt in domain_types:
				features.append(1.0 if domain_type == dt else 0.0)
			
			# HTML features
			html_features = attempt.html_features
			features.extend([
				html_features.get('total_elements', 0) / 1000.0,  # Normalize
				html_features.get('div_count', 0) / 100.0,
				html_features.get('table_count', 0) / 10.0,
				html_features.get('form_count', 0) / 5.0,
				html_features.get('link_count', 0) / 50.0,
				html_features.get('tender_keywords', 0) / 10.0,
				1.0 if html_features.get('has_search_form', False) else 0.0,
				1.0 if html_features.get('has_pagination', False) else 0.0,
			])
			
			# Visual features
			visual_features = attempt.visual_features
			features.extend([
				visual_features.get('total_ui_elements', 0) / 50.0,
				visual_features.get('patterns_detected', 0) / 5.0,
				visual_features.get('visual_complexity', 0) / 10.0,
				1.0 if visual_features.get('has_grid_pattern', False) else 0.0,
				1.0 if visual_features.get('has_list_pattern', False) else 0.0,
				1.0 if visual_features.get('has_form_pattern', False) else 0.0,
			])
			
			# Pad or truncate to fixed size
			target_size = 50
			if len(features) < target_size:
				features.extend([0.0] * (target_size - len(features)))
			else:
				features = features[:target_size]
			
		except Exception as e:
			self.logger.warning(f"Feature vector creation failed: {e}")
			features = [0.0] * 50  # Default feature vector
		
		return features
	
	async def recommend_strategy(
		self,
		url: str,
		page_features: Optional[Dict[str, Any]] = None,
		html_features: Optional[Dict[str, Any]] = None,
		visual_features: Optional[Dict[str, Any]] = None
	) -> StrategyRecommendation:
		"""Recommend extraction strategy for a URL"""
		try:
			domain = urlparse(url).netloc
			
			# Create mock attempt for feature extraction
			mock_attempt = ExtractionAttempt(
				url=url,
				domain=domain,
				extraction_method="unknown",
				success=False
			)
			
			# Set provided features
			if page_features:
				mock_attempt.page_features = page_features
			else:
				await self._extract_features(mock_attempt)
			
			if html_features:
				mock_attempt.html_features = html_features
			if visual_features:
				mock_attempt.visual_features = visual_features
			
			# Check if we have a learned pattern for this domain
			if domain in self.site_patterns:
				pattern = self.site_patterns[domain]
				return self._recommend_from_pattern(pattern, mock_attempt)
			
			# Check for similar domains in same cluster
			similar_recommendation = await self._recommend_from_similarity(mock_attempt)
			if similar_recommendation:
				return similar_recommendation
			
			# Use ML models if available and trained
			ml_recommendation = await self._recommend_from_ml(mock_attempt)
			if ml_recommendation:
				return ml_recommendation
			
			# Default recommendation
			return StrategyRecommendation(
				recommended_method="crawl4ai_llm",
				confidence=0.3,
				estimated_success_rate=0.5,
				estimated_extraction_time=30.0,
				fallback_methods=["cloudscraper", "playwright_stealth"],
				reasoning=["No learned patterns available", "Using default AI-powered extraction"]
			)
			
		except Exception as e:
			self.logger.error(f"Strategy recommendation failed: {e}")
			return StrategyRecommendation(
				recommended_method="cloudscraper",
				confidence=0.2,
				reasoning=[f"Error in recommendation: {str(e)}"]
			)
	
	def _recommend_from_pattern(self, pattern: SitePattern, mock_attempt: ExtractionAttempt) -> StrategyRecommendation:
		"""Recommend strategy based on learned site pattern"""
		reasoning = [f"Using learned pattern for {pattern.domain_patterns[0]}"]
		
		# Determine best method based on pattern characteristics
		if pattern.requires_javascript:
			method = "playwright_stealth"
			reasoning.append("Site requires JavaScript execution")
		elif pattern.success_rate > 0.8:
			# Use the method that worked best for this pattern
			method = "crawl4ai_llm"  # Default to AI if we don't track method-specific success
			reasoning.append(f"High success rate ({pattern.success_rate:.1%}) with previous extractions")
		else:
			method = "cloudscraper"
			reasoning.append("Conservative approach due to mixed success history")
		
		# Parameters based on learned characteristics
		parameters = {}
		if pattern.common_selectors:
			# Include the most confident selectors
			best_selectors = sorted(
				pattern.common_selectors.items(),
				key=lambda x: x[1],
				reverse=True
			)[:3]
			parameters['suggested_selectors'] = [selector for selector, confidence in best_selectors]
		
		return StrategyRecommendation(
			recommended_method=method,
			confidence=min(0.9, pattern.success_rate + 0.2),
			estimated_success_rate=pattern.success_rate,
			estimated_extraction_time=pattern.typical_load_time or 25.0,
			parameters=parameters,
			fallback_methods=["crawl4ai_cosine", "vision_analysis"],
			reasoning=reasoning
		)
	
	async def _recommend_from_similarity(self, mock_attempt: ExtractionAttempt) -> Optional[StrategyRecommendation]:
		"""Recommend strategy based on similar domains"""
		try:
			# Create feature vector for similarity comparison
			target_features = self._create_feature_vector(mock_attempt)
			
			# Find most similar successful attempts
			similarities = []
			
			for attempt in self.extraction_attempts:
				if attempt.success and attempt.opportunities_found > 0:
					attempt_features = self._create_feature_vector(attempt)
					similarity = cosine_similarity([target_features], [attempt_features])[0][0]
					similarities.append((similarity, attempt))
			
			if not similarities:
				return None
			
			# Sort by similarity and get top matches
			similarities.sort(key=lambda x: x[0], reverse=True)
			top_matches = similarities[:5]
			
			if top_matches[0][0] < 0.7:  # Minimum similarity threshold
				return None
			
			# Analyze top matches to determine best strategy
			method_counts = Counter()
			total_success_rate = 0
			total_time = 0
			
			for similarity, attempt in top_matches:
				method_counts[attempt.extraction_method] += 1
				total_success_rate += similarity  # Weight by similarity
				total_time += attempt.extraction_time
			
			# Get most common successful method
			best_method = method_counts.most_common(1)[0][0]
			
			reasoning = [
				f"Based on similarity to {len(top_matches)} successful extractions",
				f"Best similarity score: {top_matches[0][0]:.2f}"
			]
			
			return StrategyRecommendation(
				recommended_method=best_method,
				confidence=top_matches[0][0] * 0.8,  # Scale down confidence
				estimated_success_rate=total_success_rate / len(top_matches),
				estimated_extraction_time=total_time / len(top_matches),
				reasoning=reasoning
			)
			
		except Exception as e:
			self.logger.warning(f"Similarity-based recommendation failed: {e}")
			return None
	
	async def _recommend_from_ml(self, mock_attempt: ExtractionAttempt) -> Optional[StrategyRecommendation]:
		"""Recommend strategy using trained ML models"""
		try:
			feature_vector = self._create_feature_vector(mock_attempt)
			
			# Predict success probability
			success_prob = 0.5
			if hasattr(self.success_predictor, 'predict_proba'):
				try:
					success_prob = self.success_predictor.predict_proba([feature_vector])[0][1]
				except (ValueError, IndexError, AttributeError) as e:
					self.logger.warning(f"Success prediction failed: {e}")
			
			# Predict best method
			recommended_method = "crawl4ai_llm"
			method_confidence = 0.4
			
			if hasattr(self.method_selector, 'predict_proba'):
				try:
					method_pred = self.method_selector.predict([feature_vector])[0]
					method_probs = self.method_selector.predict_proba([feature_vector])[0]
					max_prob_idx = np.argmax(method_probs)

					recommended_method = method_pred
					method_confidence = method_probs[max_prob_idx]
				except (ValueError, IndexError, AttributeError) as e:
					self.logger.warning(f"Method selection prediction failed: {e}")
			
			if method_confidence < 0.5:  # Low confidence in ML prediction
				return None
			
			reasoning = [
				f"ML prediction with {method_confidence:.1%} confidence",
				f"Estimated success probability: {success_prob:.1%}"
			]
			
			return StrategyRecommendation(
				recommended_method=recommended_method,
				confidence=method_confidence,
				estimated_success_rate=success_prob,
				estimated_extraction_time=25.0,  # Default estimate
				reasoning=reasoning
			)
			
		except Exception as e:
			self.logger.warning(f"ML-based recommendation failed: {e}")
			return None
	
	def get_learning_stats(self) -> Dict[str, Any]:
		"""Get learning statistics"""
		stats = self.learning_stats.copy()
		
		# Add domain statistics
		stats['unique_domains'] = len(set(attempt.domain for attempt in self.extraction_attempts))
		stats['domain_clusters'] = len(self.domain_clusters)
		
		# Success rate by method
		method_stats = defaultdict(list)
		for attempt in self.extraction_attempts:
			method_stats[attempt.extraction_method].append(attempt.success)
		
		stats['method_success_rates'] = {
			method: sum(successes) / len(successes) if successes else 0
			for method, successes in method_stats.items()
		}
		
		# Recent performance
		recent_cutoff = datetime.now(timezone.utc) - timedelta(days=7)
		recent_attempts = [
			attempt for attempt in self.extraction_attempts
			if attempt.timestamp > recent_cutoff
		]
		
		if recent_attempts:
			stats['recent_success_rate'] = sum(
				1 for attempt in recent_attempts if attempt.success
			) / len(recent_attempts)
		else:
			stats['recent_success_rate'] = 0.0
		
		return stats
	
	def _save_models(self):
		"""Save trained models to disk"""
		try:
			models_to_save = {
				'site_patterns': self.site_patterns,
				'domain_clusters': dict(self.domain_clusters),
				'tfidf_vectorizer': self.tfidf_vectorizer,
				'success_predictor': self.success_predictor,
				'method_selector': self.method_selector,
				'learning_stats': self.learning_stats
			}
			
			model_file = self.model_cache_dir / 'structure_learner_models.pkl'
			with open(model_file, 'wb') as f:
				pickle.dump(models_to_save, f)
				
			self.logger.debug(f"Models saved to {model_file}")
			
		except Exception as e:
			self.logger.warning(f"Failed to save models: {e}")
	
	def _load_models(self):
		"""Load trained models from disk"""
		try:
			model_file = self.model_cache_dir / 'structure_learner_models.pkl'
			
			if not model_file.exists():
				return
				
			# Prefer JSON for safety (deserializing untrusted data can execute arbitrary code)
			json_model_file = self.model_cache_dir / 'structure_learner_models.json'
			if json_model_file.exists():
				with open(json_model_file, 'r') as f:
					saved_models = json.load(f)
			else:
				# Legacy fallback with size validation
				model_size = model_file.stat().st_size
				if model_size > 10 * 1024 * 1024:
					logger.warning("Refusing to deserialize file >10MB: %s", model_file)
					return
				with open(model_file, 'rb') as f:
					saved_models = pickle.load(f)  # noqa: S301
			
			self.site_patterns = saved_models.get('site_patterns', {})
			self.domain_clusters = defaultdict(list, saved_models.get('domain_clusters', {}))
			
			# ML models
			if 'tfidf_vectorizer' in saved_models:
				self.tfidf_vectorizer = saved_models['tfidf_vectorizer']
			if 'success_predictor' in saved_models:
				self.success_predictor = saved_models['success_predictor']
			if 'method_selector' in saved_models:
				self.method_selector = saved_models['method_selector']
			
			self.learning_stats = saved_models.get('learning_stats', self.learning_stats)
			
			self.logger.info(f"Loaded models with {len(self.site_patterns)} site patterns")
			
		except Exception as e:
			self.logger.warning(f"Failed to load models: {e}")
	
	async def cleanup(self):
		"""Clean up resources and save models"""
		try:
			self._save_models()
			self.logger.info("StructureLearner cleanup completed")
		except Exception as e:
			self.logger.error(f"Cleanup failed: {e}")


# Factory function
def create_structure_learner(model_cache_dir: Optional[Path] = None) -> StructureLearner:
	"""Create a StructureLearner instance"""
	return StructureLearner(model_cache_dir)


# Helper function to create extraction attempt from scraper results
def create_extraction_attempt(
	url: str,
	method: str,
	success: bool,
	opportunities_found: int = 0,
	extraction_time: float = 0.0,
	method_parameters: Optional[Dict[str, Any]] = None,
	successful_selectors: Optional[List[str]] = None
) -> ExtractionAttempt:
	"""Helper function to create extraction attempt record"""
	return ExtractionAttempt(
		url=url,
		domain=urlparse(url).netloc,
		extraction_method=method,
		success=success,
		opportunities_found=opportunities_found,
		extraction_time=extraction_time,
		method_parameters=method_parameters or {},
		successful_selectors=successful_selectors or []
	)
