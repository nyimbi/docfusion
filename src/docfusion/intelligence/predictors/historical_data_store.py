"""
Historical Data Store

Manages storage and retrieval of historical RFP data for ML model training.
Provides persistent storage for training examples, RFP outcomes, and model metadata.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

try:
	from uuid_extensions import uuid7str
except ImportError:
	from uuid import uuid4

	def uuid7str() -> str:
		return str(uuid4())

from pydantic import BaseModel, ConfigDict, Field


class RFPStatus(str, Enum):
	"""Status of an RFP in the pipeline"""

	DRAFT = "draft"
	SUBMITTED = "submitted"
	WON = "won"
	LOST = "lost"
	WITHDRAWN = "withdrawn"
	PENDING = "pending"


class HistoricalRFPResult(BaseModel):
	"""
	Historical RFP result data for model training.

	Stores complete information about past RFPs including outcomes,
	scoring data, and lessons learned.
	"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	id: str = Field(default_factory=uuid7str, description="Unique result identifier")
	rfp_id: str = Field(..., description="Associated RFP identifier")
	opportunity_id: str = Field(..., description="Opportunity identifier")

	# Outcome information
	status: RFPStatus = Field(..., description="Final RFP status")
	win_probability: float | None = Field(default=None, ge=0.0, le=1.0, description="Pre-submission win probability")
	actual_outcome: bool | None = Field(default=None, description="True if won, False if lost, None if pending")

	# Scoring information
	predicted_scores: Dict[str, float] = Field(
		default_factory=dict,
		description="Predicted section scores (section_type -> score)"
	)
	actual_scores: Dict[str, float] = Field(
		default_factory=dict,
		description="Actual received scores (section_type -> score)"
	)
	section_features: Dict[str, Dict[str, float]] = Field(
		default_factory=dict,
		description="Features used for each section prediction"
	)

	# Feature engineering inputs
	requirements_count: int = Field(default=0, description="Number of requirements extracted")
	compliance_rate: float = Field(default=0.0, ge=0.0, le=1.0, description="Compliance rate achieved")
	mandatory_compliance_rate: float = Field(default=0.0, ge=0.0, le=1.0, description="Mandatory requirement compliance rate")
	optional_compliance_rate: float = Field(default=0.0, ge=0.0, le=1.0, description="Optional requirement compliance rate")

	# Competitive factors
	competitor_count: int | None = Field(default=None, description="Number of competitors")
	price_ranking: int | None = Field(default=None, description="Price ranking (1 = lowest)")
	technical_ranking: int | None = Field(default=None, description="Technical ranking (1 = best)")

	# Organizational factors
	team_experience_score: float = Field(default=0.5, ge=0.0, le=1.0, description="Team experience relevance")
	past_performance_score: float = Field(default=0.5, ge=0.0, le=1.0, description="Past performance relevance")
	capability_match_score: float = Field(default=0.5, ge=0.0, le=1.0, description="Capability alignment score")

	# Market factors
	market_familiarity: float = Field(default=0.5, ge=0.0, le=1.0, description="Market familiarity score")
	client_relationship_score: float = Field(default=0.5, ge=0.0, le=1.0, description="Client relationship strength")

	# Lessons learned
	lessons_learned: List[str] = Field(default_factory=list, description="Key lessons from this RFP")
	strengths: List[str] = Field(default_factory=list, description="Identified proposal strengths")
	weaknesses: List[str] = Field(default_factory=list, description="Identified proposal weaknesses")

	# Metadata
	created_at: datetime = Field(default_factory=datetime.now, description="Record creation time")
	updated_at: datetime = Field(default_factory=datetime.now, description="Last update time")
	submission_date: datetime | None = Field(default=None, description="RFP submission date")
	decision_date: datetime | None = Field(default=None, description="Award decision date")
	metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class TrainingExample(BaseModel):
	"""
	Single training example for model training.

	Represents a single data point with features and target value,
	suitable for ML model training.
	"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	id: str = Field(default_factory=uuid7str, description="Training example ID")
	features: Dict[str, float] = Field(..., description="Feature vector")
	target: float = Field(..., description="Target value (score or probability)")
	weight: float = Field(default=1.0, ge=0.0, description="Example weight for training")

	# Context
	rfp_id: str | None = Field(default=None, description="Associated RFP ID")
	section_type: str | None = Field(default=None, description="Section type for section-level training")
	example_type: str = Field(default="win_probability", description="Type of training example")

	# Quality metrics
	confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence in this example")
	is_validated: bool = Field(default=False, description="Whether example has been validated")
	source: str = Field(default="historical", description="Source of this example")

	created_at: datetime = Field(default_factory=datetime.now)


class DataQualityMetrics(BaseModel):
	"""Data quality metrics for historical data store"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	total_records: int = Field(default=0, description="Total number of records")
	validated_records: int = Field(default=0, description="Number of validated records")
	win_records: int = Field(default=0, description="Number of won RFPs")
	loss_records: int = Field(default=0, description="Number of lost RFPs")
	pending_records: int = Field(default=0, description="Number of pending RFPs")

	# Feature coverage
	feature_completeness: Dict[str, float] = Field(
		default_factory=dict,
		description="Percentage of records with each feature populated"
	)
	average_features_per_record: float = Field(default=0.0, description="Average number of features")

	# Quality issues
	missing_value_count: int = Field(default=0, description="Number of missing values")
	outlier_count: int = Field(default=0, description="Number of detected outliers")
	duplicate_count: int = Field(default=0, description="Number of duplicate records")

	# Temporal distribution
	oldest_record: datetime | None = Field(default=None, description="Date of oldest record")
	newest_record: datetime | None = Field(default=None, description="Date of newest record")
	records_last_30_days: int = Field(default=0, description="Records added in last 30 days")


class HistoricalDataStore:
	"""
	Storage and retrieval system for historical RFP data.

	Manages persistence of training data, RFP results, and provides
	query capabilities for model training and analysis.
	"""

	def __init__(
		self,
		storage_path: str | None = None,
		config: Dict[str, Any] | None = None
	):
		"""
		Initialize the historical data store.

		Args:
			storage_path: Optional path for data persistence
			config: Optional configuration dictionary
		"""
		self.storage_path = Path(storage_path) if storage_path else None
		self.config = config or self._get_default_config()
		self.logger = logging.getLogger(__name__)

		# In-memory storage (backed by persistence)
		self._rfp_results: Dict[str, HistoricalRFPResult] = {}
		self._training_examples: Dict[str, TrainingExample] = {}
		self._example_index: Dict[str, List[str]] = {}  # rfp_id -> example IDs

		self._log_initialization()

	def _get_default_config(self) -> Dict[str, Any]:
		"""Get default configuration"""
		return {
			"max_records": 100000,
			"validation_threshold": 0.8,
			"feature_importance_threshold": 0.01,
			"auto_validate": True,
			"duplicate_detection": True,
			"outlier_detection": True,
		}

	def _log_initialization(self) -> None:
		"""Log initialization"""
		self.logger.info("HistoricalDataStore initialized")

	async def store_rfp_result(self, result: HistoricalRFPResult) -> str:
		"""
		Store an RFP result for future training.

		Args:
			result: The RFP result to store

		Returns:
			The ID of the stored result
		"""
		# Validate result
		self._validate_result(result)

		# Check for duplicates
		if self.config["duplicate_detection"]:
			existing = await self._find_duplicate(result)
			if existing:
				self.logger.warning(f"Duplicate result found for RFP {result.rfp_id}, updating")
				result.id = existing.id

		# Store result
		self._rfp_results[result.id] = result
		result.updated_at = datetime.now()

		# Persist if storage path configured
		if self.storage_path:
			await self._persist_result(result)

		# Generate training examples
		await self._generate_training_examples(result)

		self.logger.info(f"Stored RFP result {result.id} for RFP {result.rfp_id}")
		return result.id

	async def get_training_data(
		self,
		example_type: str = "win_probability",
		section_type: str | None = None,
		min_confidence: float = 0.0,
		include_pending: bool = False,
		limit: int | None = None
	) -> List[TrainingExample]:
		"""
		Retrieve training data for model training.

		Args:
			example_type: Type of training examples to retrieve
			section_type: Optional section type filter for section-level training
			min_confidence: Minimum confidence threshold
			include_pending: Whether to include pending RFPs
			limit: Optional limit on number of examples

		Returns:
			List of training examples
		"""
		examples = []

		for example in self._training_examples.values():
			# Filter by type
			if example.example_type != example_type:
				continue

			# Filter by section type
			if section_type and example.section_type != section_type:
				continue

			# Filter by confidence
			if example.confidence < min_confidence:
				continue

			# Filter by validation status
			if not include_pending and not example.is_validated:
				continue

			examples.append(example)

			# Apply limit
			if limit and len(examples) >= limit:
				break

		self.logger.info(f"Retrieved {len(examples)} training examples")
		return examples

	async def get_rfp_result(self, result_id: str) -> HistoricalRFPResult | None:
		"""
		Get a specific RFP result by ID.

		Args:
			result_id: The result ID to retrieve

		Returns:
			The RFP result if found, None otherwise
		"""
		return self._rfp_results.get(result_id)

	async def get_rfp_results_by_status(
		self,
		status: RFPStatus | None = None,
		limit: int | None = None
	) -> List[HistoricalRFPResult]:
		"""
		Get RFP results filtered by status.

		Args:
			status: Optional status filter
			limit: Optional limit on number of results

		Returns:
			List of RFP results
		"""
		results = []

		for result in self._rfp_results.values():
			if status and result.status != status:
				continue
			results.append(result)

			if limit and len(results) >= limit:
				break

		return results

	async def get_section_training_data(
		self,
		section_type: str,
		include_scores: bool = True
	) -> List[Dict[str, Any]]:
		"""
		Get training data for section-level models.

		Args:
			section_type: The section type to get training data for
			include_scores: Whether to include actual scores

		Returns:
			List of training data dictionaries
		"""
		training_data = []

		for result in self._rfp_results.values():
			# Check if section data exists
			if section_type not in result.section_features:
				continue

			# Check if actual score exists for training
			if include_scores and section_type not in result.actual_scores:
				continue

			data = {
				"rfp_id": result.rfp_id,
				"features": result.section_features[section_type],
				"predicted_score": result.predicted_scores.get(section_type),
			}

			if include_scores:
				data["actual_score"] = result.actual_scores.get(section_type)

			# Add outcome context
			if result.actual_outcome is not None:
				data["won"] = result.actual_outcome

			training_data.append(data)

		return training_data

	async def get_quality_metrics(self) -> DataQualityMetrics:
		"""
		Get data quality metrics for the historical store.

		Returns:
			DataQualityMetrics with quality statistics
		"""
		metrics = DataQualityMetrics()
		metrics.total_records = len(self._rfp_results)

		if metrics.total_records == 0:
			return metrics

		# Count by status
		metrics.win_records = sum(
			1 for r in self._rfp_results.values() if r.status == RFPStatus.WON
		)
		metrics.loss_records = sum(
			1 for r in self._rfp_results.values() if r.status == RFPStatus.LOST
		)
		metrics.pending_records = sum(
			1 for r in self._rfp_results.values()
			if r.status in (RFPStatus.DRAFT, RFPStatus.SUBMITTED, RFPStatus.PENDING)
		)
		metrics.validated_records = sum(
			1 for e in self._training_examples.values() if e.is_validated
		)

		# Feature completeness
		all_features: Dict[str, int] = {}
		for result in self._rfp_results.values():
			for feature_name in self._get_feature_names(result):
				all_features[feature_name] = all_features.get(feature_name, 0) + 1

		for feature_name, count in all_features.items():
			metrics.feature_completeness[feature_name] = count / metrics.total_records

		# Average features per record
		metrics.average_features_per_record = sum(
			len(self._get_feature_names(r)) for r in self._rfp_results.values()
		) / metrics.total_records

		# Temporal distribution
		dates = [r.created_at for r in self._rfp_results.values()]
		if dates:
			metrics.oldest_record = min(dates)
			metrics.newest_record = max(dates)

		thirty_days_ago = datetime.now() - __import__('datetime').timedelta(days=30)
		metrics.records_last_30_days = sum(
			1 for r in self._rfp_results.values() if r.created_at >= thirty_days_ago
		)

		return metrics

	async def validate_example(self, example_id: str) -> bool:
		"""
		Mark a training example as validated.

		Args:
			example_id: The example ID to validate

		Returns:
			True if validated, False if not found
		"""
		if example_id not in self._training_examples:
			return False

		self._training_examples[example_id].is_validated = True
		self.logger.info(f"Validated training example {example_id}")
		return True

	async def load_from_storage(self) -> int:
		"""
		Load all data from persistent storage.

		Returns:
			Number of records loaded
		"""
		if not self.storage_path:
			self.logger.warning("No storage path configured")
			return 0

		if not self.storage_path.exists():
			self.logger.warning(f"Storage path does not exist: {self.storage_path}")
			return 0

		loaded = 0

		# Load RFP results
		results_path = self.storage_path / "rfp_results"
		if results_path.exists():
			for file_path in results_path.glob("*.json"):
				try:
					with open(file_path, 'r') as f:
						data = json.load(f)
						result = HistoricalRFPResult(**data)
						self._rfp_results[result.id] = result
						loaded += 1
				except Exception as e:
					self.logger.error(f"Failed to load {file_path}: {e}")

		# Load training examples
		examples_path = self.storage_path / "training_examples"
		if examples_path.exists():
			for file_path in examples_path.glob("*.json"):
				try:
					with open(file_path, 'r') as f:
						data = json.load(f)
						example = TrainingExample(**data)
						self._training_examples[example.id] = example
				except Exception as e:
					self.logger.error(f"Failed to load {file_path}: {e}")

		self.logger.info(f"Loaded {loaded} records from storage")
		return loaded

	async def save_to_storage(self) -> int:
		"""
		Save all data to persistent storage.

		Returns:
			Number of records saved
		"""
		if not self.storage_path:
			self.logger.warning("No storage path configured")
			return 0

		# Create directories
		results_path = self.storage_path / "rfp_results"
		examples_path = self.storage_path / "training_examples"
		results_path.mkdir(parents=True, exist_ok=True)
		examples_path.mkdir(parents=True, exist_ok=True)

		saved = 0

		# Save RFP results
		for result in self._rfp_results.values():
			try:
				file_path = results_path / f"{result.id}.json"
				with open(file_path, 'w') as f:
					f.write(result.model_dump_json(indent=2))
				saved += 1
			except Exception as e:
				self.logger.error(f"Failed to save {result.id}: {e}")

		# Save training examples
		for example in self._training_examples.values():
			try:
				file_path = examples_path / f"{example.id}.json"
				with open(file_path, 'w') as f:
					f.write(example.model_dump_json(indent=2))
			except Exception as e:
				self.logger.error(f"Failed to save {example.id}: {e}")

		self.logger.info(f"Saved {saved} records to storage")
		return saved

	def _validate_result(self, result: HistoricalRFPResult) -> None:
		"""Validate an RFP result before storing"""
		if not result.rfp_id:
			raise ValueError("RFP ID is required")

		if not result.opportunity_id:
			raise ValueError("Opportunity ID is required")

		# Validate scores are in range
		for section, score in result.predicted_scores.items():
			if not 0 <= score <= 100:
				raise ValueError(f"Predicted score for {section} must be between 0 and 100")

		for section, score in result.actual_scores.items():
			if not 0 <= score <= 100:
				raise ValueError(f"Actual score for {section} must be between 0 and 100")

	async def _find_duplicate(self, result: HistoricalRFPResult) -> HistoricalRFPResult | None:
		"""Find a duplicate result"""
		for existing in self._rfp_results.values():
			if existing.rfp_id == result.rfp_id:
				return existing
		return None

	async def _generate_training_examples(self, result: HistoricalRFPResult) -> None:
		"""Generate training examples from an RFP result"""
		# Only generate for completed RFPs
		if result.status not in (RFPStatus.WON, RFPStatus.LOST):
			return

		# Generate win probability training example
		win_example = TrainingExample(
			rfp_id=result.rfp_id,
			example_type="win_probability",
			features={
				"requirements_count": float(result.requirements_count),
				"compliance_rate": result.compliance_rate,
				"mandatory_compliance_rate": result.mandatory_compliance_rate,
				"optional_compliance_rate": result.optional_compliance_rate,
				"team_experience_score": result.team_experience_score,
				"past_performance_score": result.past_performance_score,
				"capability_match_score": result.capability_match_score,
				"market_familiarity": result.market_familiarity,
				"client_relationship_score": result.client_relationship_score,
				**{f"section_{k}_score": v for k, v in result.predicted_scores.items()},
			},
			target=1.0 if result.actual_outcome else 0.0,
			confidence=result.win_probability if result.win_probability else 1.0,
			is_validated=self.config.get("auto_validate", True),
		)
		self._training_examples[win_example.id] = win_example

		# Generate section score training examples
		for section_type, features in result.section_features.items():
			if section_type in result.actual_scores:
				section_example = TrainingExample(
					rfp_id=result.rfp_id,
					section_type=section_type,
					example_type="section_score",
					features=features,
					target=result.actual_scores[section_type],
					is_validated=self.config.get("auto_validate", True),
				)
				self._training_examples[section_example.id] = section_example

		# Update index
		if result.rfp_id not in self._example_index:
			self._example_index[result.rfp_id] = []
		self._example_index[result.rfp_id].extend([
			ex.id for ex in self._training_examples.values()
			if ex.rfp_id == result.rfp_id
		])

	async def _persist_result(self, result: HistoricalRFPResult) -> None:
		"""Persist a result to storage"""
		if not self.storage_path:
			return

		results_path = self.storage_path / "rfp_results"
		results_path.mkdir(parents=True, exist_ok=True)

		file_path = results_path / f"{result.id}.json"
		with open(file_path, 'w') as f:
			f.write(result.model_dump_json(indent=2))

	def _get_feature_names(self, result: HistoricalRFPResult) -> List[str]:
		"""Get all feature names present in a result"""
		features = [
			"requirements_count",
			"compliance_rate",
			"mandatory_compliance_rate",
			"optional_compliance_rate",
			"team_experience_score",
			"past_performance_score",
			"capability_match_score",
			"market_familiarity",
			"client_relationship_score",
		]

		# Add section features
		for section_type in result.section_features.keys():
			features.append(f"section_{section_type}_features")

		# Add predicted scores
		for section_type in result.predicted_scores.keys():
			features.append(f"section_{section_type}_predicted_score")

		return features

	def get_results_count(self) -> int:
		"""Get total number of stored RFP results"""
		return len(self._rfp_results)

	def get_examples_count(self) -> int:
		"""Get total number of training examples"""
		return len(self._training_examples)

	async def delete_result(self, result_id: str) -> bool:
		"""
		Delete an RFP result and its associated examples.

		Args:
			result_id: The result ID to delete

		Returns:
			True if deleted, False if not found
		"""
		if result_id not in self._rfp_results:
			return False

		result = self._rfp_results[result_id]

		# Delete associated examples
		if result.rfp_id in self._example_index:
			for example_id in self._example_index[result.rfp_id]:
				self._training_examples.pop(example_id, None)
			del self._example_index[result.rfp_id]

		# Delete result
		del self._rfp_results[result_id]

		# Delete from storage
		if self.storage_path:
			file_path = self.storage_path / "rfp_results" / f"{result_id}.json"
			if file_path.exists():
				file_path.unlink()

		self.logger.info(f"Deleted RFP result {result_id}")
		return True


# Convenience factory function
def create_historical_data_store(
	storage_path: str | None = None,
	config: Dict[str, Any] | None = None
) -> HistoricalDataStore:
	"""
	Create a HistoricalDataStore instance.

	Args:
		storage_path: Optional path for data persistence
		config: Optional configuration dictionary

	Returns:
		Configured HistoricalDataStore instance
	"""
	return HistoricalDataStore(storage_path, config)