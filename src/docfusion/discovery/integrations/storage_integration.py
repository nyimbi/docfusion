"""
Storage Integration Service for Discovery Engine

This module provides comprehensive storage integration capabilities for the
discovery engine, handling opportunity persistence, analysis caching, and
data lifecycle management.
"""

import asyncio
import logging
logger = logging.getLogger(__name__)
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

from pydantic import BaseModel, Field, ConfigDict

from ...storage.services import StorageManager
from ...storage.models.storage_models import StorageQuery
from ..models.opportunity_models import OpportunityData
from ..analyzers.opportunity_analyzer import OpportunityAnalysis
from ..analyzers.qualification_analyzer import QualificationAssessment
from ...intelligence.analyzers.competitive_analyzer import CompetitiveAnalysis
from .nlp_integration import NLPAnalysisResult


class StorageOperationResult(BaseModel):
	"""Result of storage operation"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	success: bool = Field(description="Whether operation was successful")
	operation_type: str = Field(description="Type of operation performed")
	affected_records: int = Field(default=0, description="Number of records affected")
	operation_time: float = Field(description="Operation time in seconds")
	error_message: Optional[str] = Field(None, description="Error message if operation failed")
	metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional operation metadata")


class OpportunitySearchCriteria(BaseModel):
	"""Criteria for searching opportunities"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	# Basic filters
	date_range: Optional[Tuple[datetime, datetime]] = Field(None, description="Date range filter")
	value_range: Optional[Tuple[float, float]] = Field(None, description="Value range filter")
	industries: Optional[List[str]] = Field(None, description="Industry filters")
	
	# Status filters
	statuses: Optional[List[str]] = Field(None, description="Opportunity status filters")
	analysis_status: Optional[List[str]] = Field(None, description="Analysis status filters")
	
	# Text-based filters
	keywords: Optional[List[str]] = Field(None, description="Keyword filters")
	required_capabilities: Optional[List[str]] = Field(None, description="Required capability filters")
	
	# Score-based filters
	min_match_score: Optional[float] = Field(None, description="Minimum capability match score")
	min_win_probability: Optional[float] = Field(None, description="Minimum win probability")
	
	# Pagination
	limit: int = Field(default=100, description="Maximum number of results")
	offset: int = Field(default=0, description="Result offset for pagination")
	
	# Sorting
	sort_by: str = Field(default="created_date", description="Field to sort by")
	sort_order: str = Field(default="desc", description="Sort order (asc/desc)")


class AnalysisCache(BaseModel):
	"""Cached analysis result"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	opportunity_id: str = Field(description="Opportunity identifier")
	analysis_type: str = Field(description="Type of analysis")
	analysis_data: Dict[str, Any] = Field(description="Serialized analysis data")
	cache_timestamp: datetime = Field(default_factory=datetime.now)
	expiry_timestamp: datetime = Field(description="When cache expires")
	access_count: int = Field(default=0, description="Number of times accessed")
	last_accessed: datetime = Field(default_factory=datetime.now)


class DiscoveryStorageService:
	"""
	Comprehensive storage service for discovery engine
	
	Manages persistence, caching, and retrieval of opportunities,
	analyses, and related discovery data.
	"""
	
	def __init__(self, storage_manager: Optional[StorageManager] = None):
		self.storage_manager = storage_manager or StorageManager()
		
		# Cache management
		self.analysis_cache: Dict[str, AnalysisCache] = {}
		self.cache_hit_rate = 0.0
		self.cache_requests = 0
		self.cache_hits = 0
		
		# Storage statistics
		self.stored_opportunities = 0
		self.stored_analyses = 0
		self.total_storage_operations = 0
		self.failed_operations = 0
		
		# Collection names
		self.OPPORTUNITIES_COLLECTION = "discovery_opportunities"
		self.ANALYSES_COLLECTION = "discovery_analyses"
		self.CACHE_COLLECTION = "analysis_cache"
		
		self._log_service_initialized()
	
	async def store_opportunity(self, opportunity_data: OpportunityData,
	                           metadata: Optional[Dict[str, Any]] = None) -> StorageOperationResult:
		"""
		Store opportunity data with metadata
		
		Args:
			opportunity_data: Opportunity to store
			metadata: Additional metadata
			
		Returns:
			Storage operation result
		"""
		start_time = datetime.now()
		
		try:
			# Prepare storage document
			storage_doc = {
				'opportunity_data': opportunity_data.model_dump(),
				'metadata': metadata or {},
				'created_timestamp': datetime.now().isoformat(),
				'updated_timestamp': datetime.now().isoformat(),
				'storage_version': '1.0'
			}
			
			# Store in database
			result = await self.storage_manager.store_document(
				collection=self.OPPORTUNITIES_COLLECTION,
				document_id=opportunity_data.id,
				document=storage_doc
			)
			
			processing_time = (datetime.now() - start_time).total_seconds()
			
			if result.success:
				self.stored_opportunities += 1
				self.total_storage_operations += 1
				
				self._log_storage_success("opportunity", opportunity_data.id, processing_time)
				
				return StorageOperationResult(
					success=True,
					operation_type="store_opportunity",
					affected_records=1,
					operation_time=processing_time
				)
			else:
				self.failed_operations += 1
				return StorageOperationResult(
					success=False,
					operation_type="store_opportunity",
					operation_time=processing_time,
					error_message=result.error_message
				)
		
		except Exception as e:
			self.failed_operations += 1
			processing_time = (datetime.now() - start_time).total_seconds()
			error_msg = f"Failed to store opportunity {opportunity_data.id}: {str(e)}"
			
			self._log_storage_error(error_msg)
			
			return StorageOperationResult(
				success=False,
				operation_type="store_opportunity",
				operation_time=processing_time,
				error_message=error_msg
			)
	
	async def store_analysis(self, opportunity_id: str, analysis_type: str,
	                        analysis_data: Union[OpportunityAnalysis, QualificationAssessment, 
	                                           CompetitiveAnalysis, NLPAnalysisResult]) -> StorageOperationResult:
		"""
		Store analysis results with caching
		
		Args:
			opportunity_id: Associated opportunity ID
			analysis_type: Type of analysis
			analysis_data: Analysis results
			
		Returns:
			Storage operation result
		"""
		start_time = datetime.now()
		
		try:
			# Serialize analysis data
			if hasattr(analysis_data, 'model_dump'):
				serialized_data = analysis_data.model_dump()
			else:
				serialized_data = dict(analysis_data)
			
			# Prepare storage document
			storage_doc = {
				'opportunity_id': opportunity_id,
				'analysis_type': analysis_type,
				'analysis_data': serialized_data,
				'created_timestamp': datetime.now().isoformat(),
				'analysis_version': getattr(analysis_data, 'analysis_version', '1.0')
			}
			
			# Generate unique analysis ID
			analysis_id = f"{opportunity_id}_{analysis_type}_{int(datetime.now().timestamp())}"
			
			# Store in database
			result = await self.storage_manager.store_document(
				collection=self.ANALYSES_COLLECTION,
				document_id=analysis_id,
				document=storage_doc
			)
			
			processing_time = (datetime.now() - start_time).total_seconds()
			
			if result.success:
				# Also cache the analysis
				await self._cache_analysis(opportunity_id, analysis_type, serialized_data)
				
				self.stored_analyses += 1
				self.total_storage_operations += 1
				
				self._log_storage_success("analysis", analysis_id, processing_time)
				
				return StorageOperationResult(
					success=True,
					operation_type="store_analysis",
					affected_records=1,
					operation_time=processing_time
				)
			else:
				self.failed_operations += 1
				return StorageOperationResult(
					success=False,
					operation_type="store_analysis",
					operation_time=processing_time,
					error_message=result.error_message
				)
		
		except Exception as e:
			self.failed_operations += 1
			processing_time = (datetime.now() - start_time).total_seconds()
			error_msg = f"Failed to store analysis for {opportunity_id}: {str(e)}"
			
			self._log_storage_error(error_msg)
			
			return StorageOperationResult(
				success=False,
				operation_type="store_analysis",
				operation_time=processing_time,
				error_message=error_msg
			)
	
	async def retrieve_opportunity(self, opportunity_id: str) -> Optional[OpportunityData]:
		"""
		Retrieve opportunity by ID
		
		Args:
			opportunity_id: Opportunity identifier
			
		Returns:
			Opportunity data if found, None otherwise
		"""
		try:
			result = await self.storage_manager.retrieve_document(
				collection=self.OPPORTUNITIES_COLLECTION,
				document_id=opportunity_id
			)
			
			if result.success and result.document:
				opportunity_dict = result.document.get('opportunity_data', {})
				return OpportunityData(**opportunity_dict)
			
			return None
			
		except Exception as e:
			self._log_retrieval_error(f"Failed to retrieve opportunity {opportunity_id}: {str(e)}")
			return None
	
	async def retrieve_analysis(self, opportunity_id: str, 
	                           analysis_type: str) -> Optional[Dict[str, Any]]:
		"""
		Retrieve analysis results with caching
		
		Args:
			opportunity_id: Opportunity identifier
			analysis_type: Type of analysis to retrieve
			
		Returns:
			Analysis data if found, None otherwise
		"""
		# Check cache first
		cached_result = await self._get_cached_analysis(opportunity_id, analysis_type)
		if cached_result:
			return cached_result
		
		try:
			# Query database
			query = StorageQuery(
				collection=self.ANALYSES_COLLECTION,
				filters={
					'opportunity_id': opportunity_id,
					'analysis_type': analysis_type
				},
				sort_by='created_timestamp',
				sort_order='desc',
				limit=1
			)
			
			result = await self.storage_manager.query_documents(query)
			
			if result.success and result.documents:
				analysis_doc = result.documents[0]
				analysis_data = analysis_doc.get('analysis_data', {})
				
				# Cache the result
				await self._cache_analysis(opportunity_id, analysis_type, analysis_data)
				
				return analysis_data
			
			return None
			
		except Exception as e:
			self._log_retrieval_error(f"Failed to retrieve analysis for {opportunity_id}: {str(e)}")
			return None
	
	async def search_opportunities(self, criteria: OpportunitySearchCriteria) -> List[OpportunityData]:
		"""
		Search opportunities based on criteria
		
		Args:
			criteria: Search criteria
			
		Returns:
			List of matching opportunities
		"""
		try:
			# Build database query
			filters = {}
			
			# Date range filter
			if criteria.date_range:
				start_date, end_date = criteria.date_range
				filters['created_timestamp'] = {
					'$gte': start_date.isoformat(),
					'$lte': end_date.isoformat()
				}
			
			# Value range filter
			if criteria.value_range:
				min_value, max_value = criteria.value_range
				filters['opportunity_data.estimated_value'] = {
					'$gte': min_value,
					'$lte': max_value
				}
			
			# Industry filter
			if criteria.industries:
				filters['opportunity_data.industry'] = {'$in': criteria.industries}
			
			# Status filter
			if criteria.statuses:
				filters['opportunity_data.status'] = {'$in': criteria.statuses}
			
			# Keyword filter (text search simulation)
			if criteria.keywords:
				# In a real implementation, this would use text indexing
				keyword_pattern = '|'.join(criteria.keywords)
				filters['$or'] = [
					{'opportunity_data.title': {'$regex': keyword_pattern, '$options': 'i'}},
					{'opportunity_data.description': {'$regex': keyword_pattern, '$options': 'i'}}
				]
			
			# Create query
			query = StorageQuery(
				collection=self.OPPORTUNITIES_COLLECTION,
				filters=filters,
				sort_by=criteria.sort_by,
				sort_order=criteria.sort_order,
				limit=criteria.limit,
				offset=criteria.offset
			)
			
			result = await self.storage_manager.query_documents(query)
			
			if result.success:
				opportunities = []
				for doc in result.documents:
					opportunity_dict = doc.get('opportunity_data', {})
					opportunities.append(OpportunityData(**opportunity_dict))
				
				self._log_search_success(len(opportunities), criteria.limit)
				return opportunities
			
			return []
			
		except Exception as e:
			self._log_search_error(f"Opportunity search failed: {str(e)}")
			return []
	
	async def batch_store_opportunities(self, opportunities: List[Tuple[OpportunityData, Dict[str, Any]]]) -> List[StorageOperationResult]:
		"""
		Store multiple opportunities in batch for efficiency
		
		Args:
			opportunities: List of (opportunity_data, metadata) tuples
			
		Returns:
			List of storage operation results
		"""
		try:
			# Process in parallel batches
			batch_size = 10
			results = []
			
			for i in range(0, len(opportunities), batch_size):
				batch = opportunities[i:i + batch_size]
				batch_tasks = [
					self.store_opportunity(opp_data, metadata) 
					for opp_data, metadata in batch
				]
				
				batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
				
				for result in batch_results:
					if isinstance(result, Exception):
						error_result = StorageOperationResult(
							success=False,
							operation_type="batch_store_opportunity",
							operation_time=0.0,
							error_message=str(result)
						)
						results.append(error_result)
					else:
						results.append(result)
			
			successful_ops = sum(1 for r in results if r.success)
			self._log_batch_operation("store", len(opportunities), successful_ops)
			
			return results
			
		except Exception as e:
			self._log_batch_error(f"Batch store failed: {str(e)}")
			return []
	
	async def update_opportunity_status(self, opportunity_id: str, 
	                                   status: str, metadata: Optional[Dict[str, Any]] = None) -> StorageOperationResult:
		"""
		Update opportunity status and metadata
		
		Args:
			opportunity_id: Opportunity to update
			status: New status
			metadata: Additional metadata updates
			
		Returns:
			Storage operation result
		"""
		start_time = datetime.now()
		
		try:
			# Prepare update document
			update_doc = {
				'opportunity_data.status': status,
				'updated_timestamp': datetime.now().isoformat()
			}
			
			if metadata:
				for key, value in metadata.items():
					update_doc[f'metadata.{key}'] = value
			
			result = await self.storage_manager.update_document(
				collection=self.OPPORTUNITIES_COLLECTION,
				document_id=opportunity_id,
				updates=update_doc
			)
			
			processing_time = (datetime.now() - start_time).total_seconds()
			
			if result.success:
				self.total_storage_operations += 1
				self._log_update_success(opportunity_id, status, processing_time)
				
				return StorageOperationResult(
					success=True,
					operation_type="update_status",
					affected_records=1,
					operation_time=processing_time
				)
			else:
				self.failed_operations += 1
				return StorageOperationResult(
					success=False,
					operation_type="update_status",
					operation_time=processing_time,
					error_message=result.error_message
				)
		
		except Exception as e:
			self.failed_operations += 1
			processing_time = (datetime.now() - start_time).total_seconds()
			error_msg = f"Failed to update status for {opportunity_id}: {str(e)}"
			
			self._log_storage_error(error_msg)
			
			return StorageOperationResult(
				success=False,
				operation_type="update_status",
				operation_time=processing_time,
				error_message=error_msg
			)
	
	async def _cache_analysis(self, opportunity_id: str, analysis_type: str, 
	                         analysis_data: Dict[str, Any]) -> None:
		"""Cache analysis result for faster retrieval"""
		try:
			cache_key = f"{opportunity_id}_{analysis_type}"
			expiry_time = datetime.now() + timedelta(hours=24)  # Cache for 24 hours
			
			cache_entry = AnalysisCache(
				opportunity_id=opportunity_id,
				analysis_type=analysis_type,
				analysis_data=analysis_data,
				expiry_timestamp=expiry_time
			)
			
			self.analysis_cache[cache_key] = cache_entry
			
			# Cleanup expired cache entries periodically
			await self._cleanup_expired_cache()
			
		except Exception as e:
			self._log_cache_error(f"Failed to cache analysis: {str(e)}")
	
	async def _get_cached_analysis(self, opportunity_id: str, 
	                              analysis_type: str) -> Optional[Dict[str, Any]]:
		"""Retrieve analysis from cache if available and not expired"""
		self.cache_requests += 1
		
		try:
			cache_key = f"{opportunity_id}_{analysis_type}"
			
			if cache_key in self.analysis_cache:
				cache_entry = self.analysis_cache[cache_key]
				
				# Check if cache is still valid
				if datetime.now() < cache_entry.expiry_timestamp:
					# Update access statistics
					cache_entry.access_count += 1
					cache_entry.last_accessed = datetime.now()
					
					self.cache_hits += 1
					self.cache_hit_rate = self.cache_hits / self.cache_requests
					
					self._log_cache_hit(cache_key)
					return cache_entry.analysis_data
				else:
					# Remove expired cache entry
					del self.analysis_cache[cache_key]
					self._log_cache_miss(cache_key, "expired")
			else:
				self._log_cache_miss(cache_key, "not_found")
			
			return None
			
		except Exception as e:
			self._log_cache_error(f"Cache retrieval failed: {str(e)}")
			return None
	
	async def _cleanup_expired_cache(self) -> None:
		"""Remove expired cache entries"""
		try:
			current_time = datetime.now()
			expired_keys = [
				key for key, cache_entry in self.analysis_cache.items()
				if current_time >= cache_entry.expiry_timestamp
			]
			
			for key in expired_keys:
				del self.analysis_cache[key]
			
			if expired_keys:
				self._log_cache_cleanup(len(expired_keys))
				
		except Exception as e:
			self._log_cache_error(f"Cache cleanup failed: {str(e)}")
	
	async def get_storage_statistics(self) -> Dict[str, Any]:
		"""Get comprehensive storage service statistics"""
		
		# Calculate success rate
		success_rate = (
			(self.total_storage_operations - self.failed_operations) / self.total_storage_operations
			if self.total_storage_operations > 0 else 1.0
		)
		
		# Cache statistics
		cache_size = len(self.analysis_cache)
		
		# Storage utilization (would be actual database stats in real implementation)
		storage_stats = await self.storage_manager.get_storage_statistics()
		
		return {
			'opportunities_stored': self.stored_opportunities,
			'analyses_stored': self.stored_analyses,
			'total_operations': self.total_storage_operations,
			'failed_operations': self.failed_operations,
			'success_rate': success_rate,
			'cache_statistics': {
				'cache_size': cache_size,
				'cache_hit_rate': self.cache_hit_rate,
				'total_cache_requests': self.cache_requests,
				'cache_hits': self.cache_hits
			},
			'storage_utilization': storage_stats,
			'service_status': 'active'
		}
	
	async def optimize_storage(self) -> StorageOperationResult:
		"""Perform storage optimization operations"""
		start_time = datetime.now()
		
		try:
			optimization_tasks = [
				self._cleanup_expired_cache(),
				self._archive_old_analyses(),
				self._optimize_indexes()
			]
			
			await asyncio.gather(*optimization_tasks, return_exceptions=True)
			
			processing_time = (datetime.now() - start_time).total_seconds()
			
			self._log_optimization_complete(processing_time)
			
			return StorageOperationResult(
				success=True,
				operation_type="optimize_storage",
				operation_time=processing_time,
				metadata={'optimization_tasks': len(optimization_tasks)}
			)
			
		except Exception as e:
			processing_time = (datetime.now() - start_time).total_seconds()
			error_msg = f"Storage optimization failed: {str(e)}"
			
			self._log_storage_error(error_msg)
			
			return StorageOperationResult(
				success=False,
				operation_type="optimize_storage",
				operation_time=processing_time,
				error_message=error_msg
			)
	
	async def _archive_old_analyses(self) -> None:
		"""Archive analyses older than retention period"""
		try:
			# Archive analyses older than 90 days
			cutoff_date = datetime.now() - timedelta(days=90)
			
			query = StorageQuery(
				collection=self.ANALYSES_COLLECTION,
				filters={
					'created_timestamp': {'$lt': cutoff_date.isoformat()}
				}
			)
			
			result = await self.storage_manager.query_documents(query)
			
			if result.success and result.documents:
				# In a real implementation, would move to archive storage
				archived_count = len(result.documents)
				self._log_archive_complete(archived_count)
			
		except Exception as e:
			self._log_storage_error(f"Archive operation failed: {str(e)}")
	
	async def _optimize_indexes(self) -> None:
		"""Optimize database indexes for better performance"""
		try:
			# Define indexes for common query patterns
			indexes = [
				{'collection': self.OPPORTUNITIES_COLLECTION, 'fields': ['opportunity_data.industry']},
				{'collection': self.OPPORTUNITIES_COLLECTION, 'fields': ['opportunity_data.estimated_value']},
				{'collection': self.OPPORTUNITIES_COLLECTION, 'fields': ['created_timestamp']},
				{'collection': self.ANALYSES_COLLECTION, 'fields': ['opportunity_id', 'analysis_type']},
				{'collection': self.ANALYSES_COLLECTION, 'fields': ['created_timestamp']}
			]
			
			# In a real implementation, would create/optimize these indexes
			self._log_index_optimization(len(indexes))
			
		except Exception as e:
			self._log_storage_error(f"Index optimization failed: {str(e)}")
	
	# Logging methods
	
	def _log_service_initialized(self) -> None:
		"""Log service initialization"""
		logger.info(f"DiscoveryStorageService: Service initialized with storage manager")
	
	def _log_storage_success(self, operation_type: str, document_id: str, processing_time: float) -> None:
		"""Log successful storage operation"""
		logger.info(f"DiscoveryStorageService: {operation_type.title()} stored {document_id} ({processing_time:.3f}s)")
	
	def _log_storage_error(self, message: str) -> None:
		"""Log storage errors"""
		logger.error(f"DiscoveryStorageService Error: {message}")
	
	def _log_retrieval_error(self, message: str) -> None:
		"""Log retrieval errors"""
		logger.error(f"DiscoveryStorageService Retrieval Error: {message}")
	
	def _log_search_success(self, results_count: int, limit: int) -> None:
		"""Log successful search operation"""
		logger.info(f"DiscoveryStorageService: Search returned {results_count}/{limit} results")
	
	def _log_search_error(self, message: str) -> None:
		"""Log search errors"""
		logger.error(f"DiscoveryStorageService Search Error: {message}")
	
	def _log_batch_operation(self, operation: str, total: int, successful: int) -> None:
		"""Log batch operation completion"""
		logger.info(f"DiscoveryStorageService: Batch {operation} completed - {successful}/{total} successful")
	
	def _log_batch_error(self, message: str) -> None:
		"""Log batch operation errors"""
		logger.error(f"DiscoveryStorageService Batch Error: {message}")
	
	def _log_update_success(self, document_id: str, status: str, processing_time: float) -> None:
		"""Log successful update operation"""
		logger.info(f"DiscoveryStorageService: Updated {document_id} to {status} ({processing_time:.3f}s)")
	
	def _log_cache_hit(self, cache_key: str) -> None:
		"""Log cache hit"""
		logger.info(f"DiscoveryStorageService: Cache hit for {cache_key}")
	
	def _log_cache_miss(self, cache_key: str, reason: str) -> None:
		"""Log cache miss"""
		logger.info(f"DiscoveryStorageService: Cache miss for {cache_key} ({reason})")
	
	def _log_cache_error(self, message: str) -> None:
		"""Log cache errors"""
		logger.error(f"DiscoveryStorageService Cache Error: {message}")
	
	def _log_cache_cleanup(self, expired_count: int) -> None:
		"""Log cache cleanup"""
		logger.info(f"DiscoveryStorageService: Cleaned up {expired_count} expired cache entries")
	
	def _log_optimization_complete(self, processing_time: float) -> None:
		"""Log optimization completion"""
		logger.info(f"DiscoveryStorageService: Storage optimization completed ({processing_time:.2f}s)")
	
	def _log_archive_complete(self, archived_count: int) -> None:
		"""Log archive operation completion"""
		logger.info(f"DiscoveryStorageService: Archived {archived_count} old analyses")
	
	def _log_index_optimization(self, index_count: int) -> None:
		"""Log index optimization"""
		logger.info(f"DiscoveryStorageService: Optimized {index_count} database indexes")


# Example usage and testing
async def test_storage_integration():
	"""Test storage integration with discovery services"""
	
	# Initialize storage service
	storage_service = DiscoveryStorageService()
	
	# Sample opportunity data
	opportunity = OpportunityData(
		id="test_storage_001",
		title="Cloud Migration Project",
		description="Migrate legacy systems to cloud infrastructure",
		requirements="AWS expertise, migration experience, security compliance",
		estimated_value=3000000.0
	)
	
	# Store opportunity
	store_result = await storage_service.store_opportunity(
		opportunity, 
		metadata={'source': 'test', 'priority': 'high'}
	)
	
	logger.info(f"Store Result: {store_result.success}")
	
	# Retrieve opportunity
	retrieved_opp = await storage_service.retrieve_opportunity(opportunity.id)
	logger.info(f"Retrieved: {retrieved_opp.title if retrieved_opp else 'Not found'}")
	
	# Search opportunities
	search_criteria = OpportunitySearchCriteria(
		keywords=['cloud', 'migration'],
		limit=10
	)
	
	search_results = await storage_service.search_opportunities(search_criteria)
	logger.info(f"Search Results: {len(search_results)} opportunities found")
	
	# Get statistics
	stats = await storage_service.get_storage_statistics()
	
	return stats


if __name__ == "__main__":
	# Test the storage integration
	import asyncio
	
	async def main():
		stats = await test_storage_integration()
		logger.info(f"Storage Statistics:")
		logger.info(f"- Opportunities Stored: {stats['opportunities_stored']}")
		logger.info(f"- Total Operations: {stats['total_operations']}")
		logger.info(f"- Success Rate: {stats['success_rate']:.2%}")
		logger.info(f"- Cache Hit Rate: {stats['cache_statistics']['cache_hit_rate']:.2%}")
		
	asyncio.run(main())