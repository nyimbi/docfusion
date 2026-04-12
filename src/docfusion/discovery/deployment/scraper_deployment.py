#!/usr/bin/env python3
"""
Scraper Deployment System

Handles deployment of scrapers for the top 100 procurement sources,
including configuration management, resource allocation, and coordination
between different scraping strategies.
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any, Set
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dataclasses import dataclass
from enum import Enum
import tempfile

from pydantic import BaseModel, Field, field_validator
from ...core.utils import uuid7str

from ..crawlers.source_databases.global_source_db import GlobalSourceDB, ProcurementSource, SourceStatus
from ..crawlers.ai_driven.universal_scraper import UniversalScraper, ScrapingConfiguration
from ..crawlers.ai_driven.structure_learner import StructureLearner
from ...security.authorization.role_based_access import Permission


class DeploymentStatus(Enum):
	"""Status of scraper deployment"""
	PENDING = "pending"
	DEPLOYING = "deploying" 
	ACTIVE = "active"
	PAUSED = "paused"
	FAILED = "failed"
	TERMINATED = "terminated"


class ScraperType(Enum):
	"""Type of scraper deployment"""
	UNIVERSAL = "universal"  # UniversalScraper
	SPECIALIZED = "specialized"  # Custom scraper for specific source
	API_CLIENT = "api_client"  # API-based extraction
	BATCH_PROCESSOR = "batch_processor"  # Bulk/scheduled processing


@dataclass
class ResourceLimits:
	"""Resource limits for scraper deployment"""
	max_concurrent_requests: int = 5
	max_memory_mb: int = 512
	max_cpu_percent: int = 50
	max_disk_mb: int = 1024
	request_timeout_seconds: int = 30
	rate_limit_per_minute: int = 60


class DeploymentConfig(BaseModel):
	"""Configuration for a scraper deployment"""
	config_id: str = Field(default_factory=uuid7str)
	source_id: str
	scraper_type: ScraperType = ScraperType.UNIVERSAL
	
	# Scheduling
	schedule_cron: Optional[str] = None  # e.g., "0 */6 * * *" for every 6 hours
	run_interval_hours: Optional[int] = 6
	timezone: str = "UTC"
	
	# Resource management
	resource_limits: ResourceLimits = Field(default_factory=ResourceLimits)
	priority: int = 5  # 1-10 scale, 10 = highest
	
	# Scraping parameters
	scraping_config: Optional[Dict[str, Any]] = None
	extraction_strategies: List[str] = Field(default_factory=lambda: ["crawl4ai_llm"])
	fallback_strategies: List[str] = Field(default_factory=lambda: ["cloudscraper"])
	
	# Quality requirements
	min_opportunities_expected: int = 0
	max_failure_rate: float = 0.3
	alert_on_no_opportunities: bool = True
	
	# Data handling
	store_raw_content: bool = False
	data_retention_days: int = 30
	export_formats: List[str] = Field(default_factory=lambda: ["json"])
	
	# Monitoring
	enable_health_checks: bool = True
	health_check_interval_minutes: int = 30
	notification_channels: List[str] = Field(default_factory=list)
	
	created_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	created_by: Optional[str] = None


class ScraperInstance(BaseModel):
	"""Running instance of a scraper"""
	instance_id: str = Field(default_factory=uuid7str)
	deployment_id: str
	source_id: str
	
	# Status
	status: DeploymentStatus = DeploymentStatus.PENDING
	started_at: Optional[datetime] = None
	last_run_at: Optional[datetime] = None
	next_run_at: Optional[datetime] = None
	
	# Performance metrics
	total_runs: int = 0
	successful_runs: int = 0
	failed_runs: int = 0
	average_runtime_seconds: float = 0.0
	opportunities_extracted_total: int = 0
	
	# Current run info
	current_run_id: Optional[str] = None
	is_running: bool = False
	last_error: Optional[str] = None
	
	# Resource usage
	memory_usage_mb: float = 0.0
	cpu_usage_percent: float = 0.0


class DeploymentJob(BaseModel):
	"""Individual scraping job"""
	job_id: str = Field(default_factory=uuid7str)
	instance_id: str
	source_id: str
	
	# Job details
	started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	completed_at: Optional[datetime] = None
	duration_seconds: Optional[float] = None
	
	# Results
	success: bool = False
	opportunities_found: int = 0
	pages_processed: int = 0
	extraction_method_used: Optional[str] = None
	
	# Errors and issues
	error_message: Optional[str] = None
	warnings: List[str] = Field(default_factory=list)
	
	# Data
	extracted_data_path: Optional[str] = None
	raw_content_size_bytes: int = 0


class ScraperDeployment:
	"""
	Manages deployment of scrapers for procurement sources
	"""
	
	def __init__(
		self,
		global_db: Optional[GlobalSourceDB] = None,
		structure_learner: Optional[StructureLearner] = None,
		deployment_dir: Optional[Path] = None
	):
		self.logger = logging.getLogger(__name__)
		
		# Dependencies
		self.global_db = global_db or GlobalSourceDB()
		self.structure_learner = structure_learner
		
		# Storage
		self.deployment_dir = deployment_dir or Path(tempfile.gettempdir()) / "scraper_deployments"
		self.deployment_dir.mkdir(exist_ok=True)
		
		# Deployment tracking
		self.deployments: Dict[str, DeploymentConfig] = {}
		self.instances: Dict[str, ScraperInstance] = {}
		self.jobs: Dict[str, DeploymentJob] = {}
		self.scrapers: Dict[str, UniversalScraper] = {}  # Active scraper instances
		
		# Statistics
		self.deployment_stats = {
			'total_deployments': 0,
			'active_instances': 0,
			'total_jobs_run': 0,
			'successful_jobs': 0,
			'failed_jobs': 0,
			'total_opportunities_extracted': 0
		}
	
	async def deploy_top_sources(
		self,
		limit: int = 100,
		priority_filter: Optional[List[str]] = None,
		deployment_config_template: Optional[DeploymentConfig] = None
	) -> List[str]:
		"""
		Deploy scrapers for the top procurement sources
		
		Args:
			limit: Maximum number of sources to deploy
			priority_filter: List of source types to prioritize
			deployment_config_template: Template config to use for all deployments
			
		Returns:
			List of deployment IDs created
		"""
		deployment_ids = []
		
		try:
			# Get top sources from database
			top_sources = await self._get_top_sources(limit, priority_filter)
			
			self.logger.info(f"Deploying scrapers for {len(top_sources)} top sources")
			
			for source in top_sources:
				try:
					deployment_id = await self._deploy_single_source(
						source,
						deployment_config_template
					)
					
					if deployment_id:
						deployment_ids.append(deployment_id)
						self.deployment_stats['total_deployments'] += 1
					
				except Exception as e:
					self.logger.error(f"Failed to deploy scraper for {source.name}: {e}")
			
			self.logger.info(f"Successfully deployed {len(deployment_ids)} scrapers")
			return deployment_ids
			
		except Exception as e:
			self.logger.error(f"Top sources deployment failed: {e}")
			return deployment_ids
	
	async def _get_top_sources(
		self,
		limit: int,
		priority_filter: Optional[List[str]] = None
	) -> List[ProcurementSource]:
		"""Get the top procurement sources for deployment"""
		
		try:
			# Get all active sources
			all_sources = await self.global_db.get_sources_by_status(SourceStatus.ACTIVE)
			
			# Filter by priority if specified
			if priority_filter:
				filtered_sources = [
					source for source in all_sources
					if source.source_type.value in priority_filter
				]
				all_sources = filtered_sources
			
			# Score and rank sources for deployment priority
			scored_sources = []
			for source in all_sources:
				score = self._calculate_deployment_priority_score(source)
				scored_sources.append((score, source))
			
			# Sort by score (descending) and take top N
			scored_sources.sort(key=lambda x: x[0], reverse=True)
			top_sources = [source for _, source in scored_sources[:limit]]
			
			self.logger.info(f"Selected {len(top_sources)} top sources for deployment")
			return top_sources
			
		except Exception as e:
			self.logger.error(f"Failed to get top sources: {e}")
			return []
	
	def _calculate_deployment_priority_score(self, source: ProcurementSource) -> float:
		"""Calculate priority score for deployment"""
		score = 0.0
		
		# Base score from health
		score += source.health_score * 100
		
		# Bonus for government sources
		if source.source_type.value == 'government':
			score += 50
		
		# Bonus for national/international scope
		if source.geographic_scope.value in ['national', 'international']:
			score += 30
		
		# Bonus for API access
		if source.access_method.value == 'api':
			score += 20
		
		# Penalty for known issues
		if source.last_error_message:
			score -= 25
		
		# Bonus for recent activity
		if source.last_successful_check:
			days_since_check = (datetime.now(timezone.utc) - source.last_successful_check).days
			if days_since_check <= 7:
				score += 15
			elif days_since_check <= 30:
				score += 5
		
		return score
	
	async def _deploy_single_source(
		self,
		source: ProcurementSource,
		config_template: Optional[DeploymentConfig] = None
	) -> Optional[str]:
		"""Deploy a scraper for a single source"""
		
		try:
			# Create deployment configuration
			config = await self._create_deployment_config(source, config_template)
			
			# Create scraper instance based on configuration
			scraper = await self._create_scraper_instance(source, config)
			
			# Create deployment tracking
			deployment_id = config.config_id
			self.deployments[deployment_id] = config
			self.scrapers[deployment_id] = scraper
			
			# Create instance tracking
			instance = ScraperInstance(
				deployment_id=deployment_id,
				source_id=source.source_id,
				status=DeploymentStatus.DEPLOYING
			)
			self.instances[instance.instance_id] = instance
			
			# Start the instance
			await self._start_instance(instance, config)
			
			self.logger.info(f"Deployed scraper for {source.name} (ID: {deployment_id})")
			return deployment_id
			
		except Exception as e:
			self.logger.error(f"Single source deployment failed for {source.name}: {e}")
			return None
	
	async def _create_deployment_config(
		self,
		source: ProcurementSource,
		template: Optional[DeploymentConfig] = None
	) -> DeploymentConfig:
		"""Create deployment configuration for a source"""
		
		if template:
			# Use template as base
			config_dict = template.dict()
			config_dict['source_id'] = source.source_id
			config_dict['config_id'] = uuid7str()
			config = DeploymentConfig(**config_dict)
		else:
			# Create default configuration
			config = DeploymentConfig(source_id=source.source_id)
		
		# Customize based on source characteristics
		await self._customize_config_for_source(config, source)
		
		return config
	
	async def _customize_config_for_source(self, config: DeploymentConfig, source: ProcurementSource):
		"""Customize deployment config based on source characteristics"""
		
		# API sources get different treatment
		if source.access_method.value == 'api':
			config.scraper_type = ScraperType.API_CLIENT
			config.resource_limits.max_concurrent_requests = 10
			config.extraction_strategies = ["api_client"]
			config.fallback_strategies = []
		
		# Government sources get higher priority
		if source.source_type.value == 'government':
			config.priority = 8
			config.run_interval_hours = 4  # More frequent checks
		
		# Healthcare sources often have strict rate limits
		if source.source_type.value == 'healthcare':
			config.resource_limits.rate_limit_per_minute = 30
			config.resource_limits.request_timeout_seconds = 45
		
		# High-value sources get special handling
		if source.health_score > 0.9:
			config.priority = 9
			config.alert_on_no_opportunities = True
			config.min_opportunities_expected = 1
		
		# Use learned patterns if available
		if self.structure_learner:
			try:
				recommendation = await self.structure_learner.recommend_strategy(
					source.base_url
				)
				config.extraction_strategies = [recommendation.recommended_method]
				config.fallback_strategies = recommendation.fallback_methods
			except Exception as e:
				self.logger.warning(f"Failed to get ML recommendation for {source.name}: {e}")
	
	async def _create_scraper_instance(
		self,
		source: ProcurementSource,
		config: DeploymentConfig
	) -> UniversalScraper:
		"""Create a scraper instance for the source"""
		
		# Create scraping configuration
		scraping_config = ScrapingConfiguration(
			max_concurrent=config.resource_limits.max_concurrent_requests,
			request_timeout=config.resource_limits.request_timeout_seconds,
			rate_limit_requests_per_minute=config.resource_limits.rate_limit_per_minute,
			respect_robots_txt=True,
			user_agent="ProposalWriter-Discovery/1.0"
		)
		
		# Override with any custom settings
		if config.scraping_config:
			for key, value in config.scraping_config.items():
				if hasattr(scraping_config, key):
					setattr(scraping_config, key, value)
		
		# Create scraper instance
		scraper = UniversalScraper(scraping_config)
		
		return scraper
	
	async def _start_instance(self, instance: ScraperInstance, config: DeploymentConfig):
		"""Start a scraper instance"""
		
		try:
			instance.status = DeploymentStatus.ACTIVE
			instance.started_at = datetime.now(timezone.utc)
			
			# Calculate next run time
			if config.run_interval_hours:
				instance.next_run_at = instance.started_at + timedelta(hours=config.run_interval_hours)
			
			# Schedule the scraper to run
			asyncio.create_task(self._run_scraper_loop(instance.instance_id))
			
			self.deployment_stats['active_instances'] += 1
			self.logger.info(f"Started scraper instance {instance.instance_id}")
			
		except Exception as e:
			instance.status = DeploymentStatus.FAILED
			instance.last_error = str(e)
			self.logger.error(f"Failed to start instance {instance.instance_id}: {e}")
	
	async def _run_scraper_loop(self, instance_id: str):
		"""Main loop for a scraper instance"""
		
		instance = self.instances.get(instance_id)
		if not instance:
			return
		
		config = self.deployments.get(instance.deployment_id)
		if not config:
			return
		
		scraper = self.scrapers.get(instance.deployment_id)
		if not scraper:
			return
		
		while instance.status == DeploymentStatus.ACTIVE:
			try:
				# Check if it's time to run
				now = datetime.now(timezone.utc)
				if instance.next_run_at and now >= instance.next_run_at:
					await self._execute_scraping_job(instance, config, scraper)
				
				# Sleep for a short interval
				await asyncio.sleep(60)  # Check every minute
				
			except asyncio.CancelledError:
				break
			except Exception as e:
				self.logger.error(f"Scraper loop error for {instance_id}: {e}")
				instance.last_error = str(e)
				await asyncio.sleep(300)  # Wait 5 minutes on error
	
	async def _execute_scraping_job(
		self,
		instance: ScraperInstance,
		config: DeploymentConfig,
		scraper: UniversalScraper
	):
		"""Execute a single scraping job"""
		
		job = DeploymentJob(
			instance_id=instance.instance_id,
			source_id=instance.source_id
		)
		
		self.jobs[job.job_id] = job
		instance.current_run_id = job.job_id
		instance.is_running = True
		instance.last_run_at = job.started_at
		
		try:
			# Get source information
			source = await self.global_db.get_source_by_id(instance.source_id)
			if not source:
				raise ValueError(f"Source {instance.source_id} not found")
			
			# Execute scraping with intelligence
			scraping_result, extraction_result = await scraper.scrape_with_intelligence(
				source.base_url,
				use_learned_structure=True,
				learn_structure=True
			)
			
			# Process results
			job.success = scraping_result.success
			job.extraction_method_used = scraping_result.method_used
			job.pages_processed = 1  # Single page for now
			
			if extraction_result and extraction_result.opportunities:
				job.opportunities_found = len(extraction_result.opportunities)
				instance.opportunities_extracted_total += job.opportunities_found
				self.deployment_stats['total_opportunities_extracted'] += job.opportunities_found
			
			# Store extracted data if configured
			if config.store_raw_content and scraping_result.content:
				job.extracted_data_path = await self._store_extracted_data(
					job.job_id,
					{
						'scraping_result': scraping_result.dict(),
						'extraction_result': extraction_result.dict() if extraction_result else None
					}
				)
				job.raw_content_size_bytes = len(scraping_result.content)
			
			# Update instance statistics
			instance.total_runs += 1
			if job.success:
				instance.successful_runs += 1
				self.deployment_stats['successful_jobs'] += 1
			else:
				instance.failed_runs += 1
				self.deployment_stats['failed_jobs'] += 1
				instance.last_error = scraping_result.error_message
			
			# Record with structure learner
			if self.structure_learner and scraping_result.method_used:
				from ..crawlers.ai_driven.structure_learner import create_extraction_attempt
				
				attempt = create_extraction_attempt(
					url=source.base_url,
					method=scraping_result.method_used,
					success=job.success,
					opportunities_found=job.opportunities_found,
					extraction_time=job.duration_seconds or 0.0
				)
				
				await self.structure_learner.record_extraction_attempt(attempt)
			
		except Exception as e:
			job.success = False
			job.error_message = str(e)
			instance.failed_runs += 1
			instance.last_error = str(e)
			self.deployment_stats['failed_jobs'] += 1
			self.logger.error(f"Job execution failed for {job.job_id}: {e}")
		
		finally:
			# Complete the job
			job.completed_at = datetime.now(timezone.utc)
			job.duration_seconds = (job.completed_at - job.started_at).total_seconds()
			
			# Update instance timing
			if instance.total_runs > 0:
				instance.average_runtime_seconds = (
					(instance.average_runtime_seconds * (instance.total_runs - 1) + job.duration_seconds) /
					instance.total_runs
				)
			
			# Schedule next run
			if config.run_interval_hours:
				instance.next_run_at = datetime.now(timezone.utc) + timedelta(hours=config.run_interval_hours)
			
			instance.is_running = False
			instance.current_run_id = None
			self.deployment_stats['total_jobs_run'] += 1
	
	async def _store_extracted_data(self, job_id: str, data: Dict[str, Any]) -> str:
		"""Store extracted data to disk"""
		
		job_data_dir = self.deployment_dir / "job_data"
		job_data_dir.mkdir(exist_ok=True)
		
		data_file = job_data_dir / f"{job_id}.json"
		
		with open(data_file, 'w') as f:
			json.dump(data, f, indent=2, default=str)
		
		return str(data_file)
	
	async def pause_deployment(self, deployment_id: str) -> bool:
		"""Pause a deployment"""
		try:
			if deployment_id not in self.deployments:
				return False
			
			# Find and pause all instances for this deployment
			for instance in self.instances.values():
				if instance.deployment_id == deployment_id:
					instance.status = DeploymentStatus.PAUSED
			
			self.logger.info(f"Paused deployment {deployment_id}")
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to pause deployment {deployment_id}: {e}")
			return False
	
	async def resume_deployment(self, deployment_id: str) -> bool:
		"""Resume a paused deployment"""
		try:
			if deployment_id not in self.deployments:
				return False
			
			# Find and resume all instances for this deployment
			for instance in self.instances.values():
				if instance.deployment_id == deployment_id and instance.status == DeploymentStatus.PAUSED:
					instance.status = DeploymentStatus.ACTIVE
					# Restart the scraper loop
					asyncio.create_task(self._run_scraper_loop(instance.instance_id))
			
			self.logger.info(f"Resumed deployment {deployment_id}")
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to resume deployment {deployment_id}: {e}")
			return False
	
	async def terminate_deployment(self, deployment_id: str) -> bool:
		"""Terminate a deployment"""
		try:
			if deployment_id not in self.deployments:
				return False
			
			# Terminate all instances
			instances_to_terminate = [
				instance for instance in self.instances.values()
				if instance.deployment_id == deployment_id
			]
			
			for instance in instances_to_terminate:
				instance.status = DeploymentStatus.TERMINATED
				if instance.is_running:
					instance.is_running = False
			
			# Clean up scraper
			if deployment_id in self.scrapers:
				await self.scrapers[deployment_id].cleanup()
				del self.scrapers[deployment_id]
			
			self.logger.info(f"Terminated deployment {deployment_id}")
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to terminate deployment {deployment_id}: {e}")
			return False
	
	def get_deployment_status(self, deployment_id: str) -> Optional[Dict[str, Any]]:
		"""Get status of a deployment"""
		
		if deployment_id not in self.deployments:
			return None
		
		config = self.deployments[deployment_id]
		instances = [
			instance for instance in self.instances.values()
			if instance.deployment_id == deployment_id
		]
		
		if not instances:
			return None
		
		instance = instances[0]  # Should only be one instance per deployment
		
		# Get recent jobs
		recent_jobs = [
			job for job in self.jobs.values()
			if job.instance_id == instance.instance_id
		]
		recent_jobs.sort(key=lambda x: x.started_at, reverse=True)
		
		return {
			'deployment_id': deployment_id,
			'source_id': config.source_id,
			'status': instance.status.value,
			'started_at': instance.started_at,
			'last_run_at': instance.last_run_at,
			'next_run_at': instance.next_run_at,
			'total_runs': instance.total_runs,
			'successful_runs': instance.successful_runs,
			'failed_runs': instance.failed_runs,
			'success_rate': instance.successful_runs / max(instance.total_runs, 1),
			'opportunities_extracted_total': instance.opportunities_extracted_total,
			'average_runtime_seconds': instance.average_runtime_seconds,
			'is_running': instance.is_running,
			'last_error': instance.last_error,
			'recent_jobs': [job.dict() for job in recent_jobs[:5]]
		}
	
	def get_all_deployments_status(self) -> List[Dict[str, Any]]:
		"""Get status of all deployments"""
		statuses = []
		
		for deployment_id in self.deployments.keys():
			status = self.get_deployment_status(deployment_id)
			if status:
				statuses.append(status)
		
		return statuses
	
	def get_deployment_stats(self) -> Dict[str, Any]:
		"""Get overall deployment statistics"""
		stats = self.deployment_stats.copy()
		
		# Add current state
		active_count = sum(
			1 for instance in self.instances.values()
			if instance.status == DeploymentStatus.ACTIVE
		)
		stats['current_active_instances'] = active_count
		
		# Success rate
		total_jobs = stats['successful_jobs'] + stats['failed_jobs']
		stats['overall_success_rate'] = stats['successful_jobs'] / max(total_jobs, 1)
		
		# Recent performance
		now = datetime.now(timezone.utc)
		recent_cutoff = now - timedelta(hours=24)
		
		recent_jobs = [
			job for job in self.jobs.values()
			if job.started_at > recent_cutoff
		]
		
		stats['jobs_last_24h'] = len(recent_jobs)
		stats['opportunities_last_24h'] = sum(job.opportunities_found for job in recent_jobs)
		
		return stats
	
	async def cleanup(self):
		"""Clean up all deployments and resources"""
		try:
			# Terminate all deployments
			for deployment_id in list(self.deployments.keys()):
				await self.terminate_deployment(deployment_id)
			
			self.logger.info("ScraperDeployment cleanup completed")
			
		except Exception as e:
			self.logger.error(f"Cleanup failed: {e}")


# Factory function
def create_scraper_deployment(
	global_db: Optional[GlobalSourceDB] = None,
	structure_learner: Optional[StructureLearner] = None
) -> ScraperDeployment:
	"""Create a ScraperDeployment instance"""
	return ScraperDeployment(global_db, structure_learner)