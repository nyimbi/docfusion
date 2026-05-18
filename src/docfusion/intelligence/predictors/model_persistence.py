"""
Model Persistence

Provides model save/load functionality with versioning, metadata storage,
and model registry for ML models used in prediction systems.
"""

import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List

import joblib
from pydantic import BaseModel, ConfigDict, Field
from ...core.utils import uuid7str

class ModelType(str, Enum):
	"""Types of ML models supported"""

	SECTION_SCORER = "section_scorer"
	WIN_PROBABILITY = "win_probability"
	OUTCOME_PREDICTOR = "outcome_predictor"
	RISK_PREDICTOR = "risk_predictor"
	ENSEMBLE = "ensemble"

class ModelStatus(str, Enum):
	"""Status of a persisted model"""

	DRAFT = "draft"
	TRAINING = "training"
	VALIDATED = "validated"
	PRODUCTION = "production"
	DEPRECATED = "deprecated"
	ARCHIVED = "archived"

class ModelMetadata(BaseModel):
	"""
	Metadata for a persisted model.

	Tracks model version, performance metrics, and deployment status.
	"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	id: str = Field(default_factory=uuid7str, description="Unique model ID")
	name: str = Field(..., description="Human-readable model name")
	model_type: ModelType = Field(..., description="Type of model")
	version: str = Field(default="1.0.0", description="Semantic version")
	description: str = Field(default="", description="Model description")

	# Performance metrics
	metrics: Dict[str, float] = Field(
		default_factory=dict,
		description="Performance metrics (accuracy, MAE, etc.)"
	)
	training_samples: int = Field(default=0, description="Number of training samples")
	feature_count: int = Field(default=0, description="Number of features")

	# Training metadata
	algorithm: str = Field(default="", description="Algorithm name (e.g., 'RandomForest')")
	hyperparameters: Dict[str, Any] = Field(
		default_factory=dict,
		description="Hyperparameters used"
	)
	feature_names: List[str] = Field(
		default_factory=list,
		description="Ordered list of feature names"
	)

	# Status and lifecycle
	status: ModelStatus = Field(default=ModelStatus.DRAFT, description="Current status")
	is_active: bool = Field(default=False, description="Whether this is the active model")

	# Timestamps
	created_at: datetime = Field(default_factory=datetime.now, description="Creation time")
	updated_at: datetime = Field(default_factory=datetime.now, description="Last update time")
	trained_at: datetime | None = Field(default=None, description="Training completion time")
	validated_at: datetime | None = Field(default=None, description="Validation time")
	deployed_at: datetime | None = Field(default=None, description="Deployment time")

	# File information
	file_path: str = Field(default="", description="Path to model file")
	file_size_bytes: int = Field(default=0, description="Size of model file")
	checksum: str = Field(default="", description="SHA256 checksum for integrity")

	# Dependencies
	dependencies: Dict[str, str] = Field(
		default_factory=dict,
		description="Required package versions"
	)

	# Lineage
	parent_model_id: str | None = Field(default=None, description="Parent model ID if derived")
	training_data_hash: str = Field(default="", description="Hash of training data")

	# Tags and labels
	tags: List[str] = Field(default_factory=list, description="Tags for organization")
	labels: Dict[str, str] = Field(default_factory=dict, description="Key-value labels")

@dataclass
class ModelVersion:
	"""Represents a specific model version"""

	model_id: str
	version: str
	file_path: Path
	metadata: ModelMetadata
	created_at: datetime = field(default_factory=datetime.now)

class ModelPersistence:
	"""
	Persistence layer for ML models.

	Provides model save/load with versioning, metadata management,
	and model registry functionality.
	"""

	def __init__(
		self,
		storage_path: str | Path | None = None,
		config: Dict[str, Any] | None = None
	):
		"""
		Initialize the model persistence layer.

		Args:
			storage_path: Optional path for model storage
			config: Optional configuration dictionary
		"""
		self.storage_path = Path(storage_path) if storage_path else Path.cwd() / "models"
		self.config = config or self._get_default_config()
		self.logger = logging.getLogger(__name__)

		# In-memory registry
		self._model_registry: Dict[str, ModelMetadata] = {}
		self._active_models: Dict[ModelType, str] = {}

		# Ensure storage directory exists
		self._ensure_storage_path()

		# Load existing registry
		self._load_registry()

		self._log_initialization()

	def _get_default_config(self) -> Dict[str, Any]:
		"""Get default configuration"""
		return {
			"max_versions_per_model": 10,
			"auto_version": True,
			"compression": True,
			"validate_on_load": True,
			"backup_on_save": True,
			"checksum_verification": True,
		}

	def _ensure_storage_path(self) -> None:
		"""Ensure storage directory exists"""
		self.storage_path.mkdir(parents=True, exist_ok=True)

		# Create subdirectories
		(self.storage_path / "models").mkdir(exist_ok=True)
		(self.storage_path / "registry").mkdir(exist_ok=True)
		(self.storage_path / "backups").mkdir(exist_ok=True)

	def _log_initialization(self) -> None:
		"""Log initialization"""
		self.logger.info(f"ModelPersistence initialized with storage at {self.storage_path}")

	def _load_registry(self) -> None:
		"""Load existing model registry from disk"""
		registry_path = self.storage_path / "registry" / "registry.json"

		if registry_path.exists():
			try:
				with open(registry_path, 'r') as f:
					data = json.load(f)

				for model_id, metadata_dict in data.get("models", {}).items():
					self._model_registry[model_id] = ModelMetadata(**metadata_dict)

				for model_type, model_id in data.get("active_models", {}).items():
					self._active_models[ModelType(model_type)] = model_id

				self.logger.info(f"Loaded {len(self._model_registry)} models from registry")

			except Exception as e:
				self.logger.error(f"Failed to load registry: {e}")

	def _save_registry(self) -> None:
		"""Save model registry to disk"""
		registry_path = self.storage_path / "registry" / "registry.json"

		data = {
			"models": {
				model_id: metadata.model_dump()
				for model_id, metadata in self._model_registry.items()
			},
			"active_models": {
				model_type.value: model_id
				for model_type, model_id in self._active_models.items()
			},
			"updated_at": datetime.now().isoformat(),
		}

		with open(registry_path, 'w') as f:
			json.dump(data, f, indent=2, default=str)

	def save_model(
		self,
		model: Any,
		name: str,
		model_type: ModelType,
		metrics: Dict[str, float] | None = None,
		hyperparameters: Dict[str, Any] | None = None,
		feature_names: List[str] | None = None,
		description: str = "",
		parent_model_id: str | None = None,
		training_data_hash: str = "",
		tags: List[str] | None = None,
		labels: Dict[str, str] | None = None,
	) -> ModelMetadata:
		"""
		Save a model with metadata.

		Args:
			model: The model object to save
			name: Human-readable model name
			model_type: Type of model
			metrics: Performance metrics
			hyperparameters: Hyperparameters used
			feature_names: Ordered list of feature names
			description: Model description
			parent_model_id: Parent model ID if derived
			training_data_hash: Hash of training data
			tags: Tags for organization
			labels: Key-value labels

		Returns:
			ModelMetadata for the saved model
		"""
		# Generate model ID
		model_id = uuid7str()

		# Determine version
		version = self._get_next_version(name)

		# Create backup if configured
		if self.config["backup_on_save"]:
			self._backup_existing_model(name, model_type)

		# Save model file
		file_name = f"{name}_{version}.joblib"
		file_path = self.storage_path / "models" / file_name

		if self.config["compression"]:
			file_path = file_path.with_suffix('.joblib.gz')
			joblib.dump(model, file_path, compress=3)
		else:
			joblib.dump(model, file_path)

		# Calculate checksum
		checksum = self._calculate_checksum(file_path)

		# Get file size
		file_size = file_path.stat().st_size

		# Create metadata
		metadata = ModelMetadata(
			id=model_id,
			name=name,
			model_type=model_type,
			version=version,
			description=description,
			metrics=metrics or {},
			hyperparameters=hyperparameters or {},
			feature_names=feature_names or [],
			file_path=str(file_path),
			file_size_bytes=file_size,
			checksum=checksum,
			parent_model_id=parent_model_id,
			training_data_hash=training_data_hash,
			tags=tags or [],
			labels=labels or {},
			trained_at=datetime.now(),
			status=ModelStatus.VALIDATED,
		)

		# Detect algorithm
		metadata.algorithm = type(model).__name__

		# Count features
		metadata.feature_count = len(feature_names) if feature_names else 0

		# Store in registry
		self._model_registry[model_id] = metadata

		# Save registry
		self._save_registry()

		self.logger.info(f"Saved model {name} v{version} ({model_id})")
		return metadata

	def load_model(
		self,
		model_id: str | None = None,
		name: str | None = None,
		version: str | None = None,
		model_type: ModelType | None = None,
	) -> tuple[Any, ModelMetadata]:
		"""
		Load a model by ID, name, or type.

		Args:
			model_id: Specific model ID to load
			name: Model name (loads latest version if no version specified)
			version: Specific version to load
			model_type: Load active model for type

		Returns:
			Tuple of (model, metadata)

		Raises:
			ValueError: If model not found
		"""
		metadata = None

		if model_id:
			# Load by ID
			metadata = self._model_registry.get(model_id)
			if not metadata:
				raise ValueError(f"Model not found: {model_id}")

		elif name and version:
			# Load by name and version
			for m in self._model_registry.values():
				if m.name == name and m.version == version:
					metadata = m
					break
			if not metadata:
				raise ValueError(f"Model not found: {name} v{version}")

		elif name:
			# Load latest version by name
			candidates = [
				m for m in self._model_registry.values()
				if m.name == name
			]
			if not candidates:
				raise ValueError(f"Model not found: {name}")
			# Sort by version descending
			candidates.sort(key=lambda m: m.version, reverse=True)
			metadata = candidates[0]

		elif model_type:
			# Load active model for type
			active_id = self._active_models.get(model_type)
			if not active_id:
				raise ValueError(f"No active model for type: {model_type}")
			metadata = self._model_registry.get(active_id)
			if not metadata:
				raise ValueError(f"Active model not found: {active_id}")

		else:
			raise ValueError("Must specify model_id, name, or model_type")

		# Load model file
		file_path = Path(metadata.file_path)

		if not file_path.exists():
			raise ValueError(f"Model file not found: {file_path}")

		# Verify checksum if configured
		if self.config["checksum_verification"]:
			current_checksum = self._calculate_checksum(file_path)
			if current_checksum != metadata.checksum:
				raise ValueError(f"Model checksum mismatch for {model_id}")

		# Load model
		model = joblib.load(file_path)

		self.logger.info(f"Loaded model {metadata.name} v{metadata.version}")
		return model, metadata

	def activate_model(self, model_id: str) -> bool:
		"""
		Set a model as the active model for its type.

		Args:
			model_id: ID of model to activate

		Returns:
			True if successful, False if not found
		"""
		metadata = self._model_registry.get(model_id)
		if not metadata:
			return False

		# Deactivate current active model for this type
		if metadata.model_type in self._active_models:
			current_active_id = self._active_models[metadata.model_type]
			if current_active_id in self._model_registry:
				self._model_registry[current_active_id].is_active = False
				self._model_registry[current_active_id].status = ModelStatus.VALIDATED

		# Activate new model
		metadata.is_active = True
		metadata.status = ModelStatus.PRODUCTION
		metadata.deployed_at = datetime.now()
		metadata.updated_at = datetime.now()

		self._active_models[metadata.model_type] = model_id
		self._save_registry()

		self.logger.info(f"Activated model {metadata.name} v{metadata.version}")
		return True

	def deactivate_model(self, model_id: str) -> bool:
		"""
		Deactivate a model.

		Args:
			model_id: ID of model to deactivate

		Returns:
			True if successful, False if not found
		"""
		metadata = self._model_registry.get(model_id)
		if not metadata:
			return False

		metadata.is_active = False
		metadata.status = ModelStatus.VALIDATED
		metadata.updated_at = datetime.now()

		# Remove from active models
		if model_id in self._active_models.values():
			for mt, mid in list(self._active_models.items()):
				if mid == model_id:
					del self._active_models[mt]

		self._save_registry()
		self.logger.info(f"Deactivated model {metadata.name} v{metadata.version}")
		return True

	def get_model_metadata(self, model_id: str) -> ModelMetadata | None:
		"""
		Get metadata for a model.

		Args:
			model_id: Model ID

		Returns:
			ModelMetadata if found, None otherwise
		"""
		return self._model_registry.get(model_id)

	def list_models(
		self,
		model_type: ModelType | None = None,
		status: ModelStatus | None = None,
		tags: List[str] | None = None,
	) -> List[ModelMetadata]:
		"""
		List models with optional filters.

		Args:
			model_type: Filter by model type
			status: Filter by status
			tags: Filter by tags (must have all tags)

		Returns:
			List of matching model metadata
		"""
		models = list(self._model_registry.values())

		if model_type:
			models = [m for m in models if m.model_type == model_type]

		if status:
			models = [m for m in models if m.status == status]

		if tags:
			models = [m for m in models if all(t in m.tags for t in tags)]

		# Sort by created_at descending
		models.sort(key=lambda m: m.created_at, reverse=True)
		return models

	def get_active_model(self, model_type: ModelType) -> tuple[Any, ModelMetadata] | None:
		"""
		Get the active model for a type.

		Args:
			model_type: Model type to get

		Returns:
			Tuple of (model, metadata) or None if not found
		"""
		active_id = self._active_models.get(model_type)
		if not active_id:
			return None

		return self.load_model(model_id=active_id)

	def get_model_versions(self, name: str) -> List[ModelMetadata]:
		"""
		Get all versions of a model.

		Args:
			name: Model name

		Returns:
			List of metadata for all versions
		"""
		versions = [
			m for m in self._model_registry.values()
			if m.name == name
		]
		versions.sort(key=lambda m: m.version, reverse=True)
		return versions

	def delete_model(self, model_id: str, archive: bool = True) -> bool:
		"""
		Delete or archive a model.

		Args:
			model_id: Model ID to delete
			archive: If True, archive instead of delete

		Returns:
			True if successful, False if not found
		"""
		metadata = self._model_registry.get(model_id)
		if not metadata:
			return False

		# Check if active
		if model_id in self._active_models.values():
			self.logger.warning(f"Cannot delete active model: {model_id}")
			return False

		if archive:
			# Archive the model
			metadata.status = ModelStatus.ARCHIVED
			metadata.updated_at = datetime.now()
			self.logger.info(f"Archived model {metadata.name} v{metadata.version}")
		else:
			# Delete the model
			file_path = Path(metadata.file_path)
			if file_path.exists():
				file_path.unlink()

			del self._model_registry[model_id]
			self.logger.info(f"Deleted model {metadata.name} v{metadata.version}")

		self._save_registry()
		return True

	def compare_models(
		self,
		model_id_1: str,
		model_id_2: str
	) -> Dict[str, Any]:
		"""
		Compare two models.

		Args:
			model_id_1: First model ID
			model_id_2: Second model ID

		Returns:
			Dictionary with comparison results
		"""
		m1 = self._model_registry.get(model_id_1)
		m2 = self._model_registry.get(model_id_2)

		if not m1 or not m2:
			raise ValueError("One or both models not found")

		# Build comparison dictionary with proper typing
		metric_differences: Dict[str, Dict[str, float]] = {}
		all_metrics = set(m1.metrics.keys()) | set(m2.metrics.keys())
		for metric in all_metrics:
			v1 = m1.metrics.get(metric, 0.0)
			v2 = m2.metrics.get(metric, 0.0)
			metric_differences[metric] = {
				"model_1": float(v1),
				"model_2": float(v2),
				"difference": float(v2 - v1),
				"relative_change": float((v2 - v1) / v1) if v1 != 0 else 0.0,
			}

		# Determine winner based on primary metric (e.g., accuracy or MAE)
		# For accuracy-type metrics (higher is better), for error-type (lower is better)
		accuracy_metrics = ["accuracy", "r2_score", "auc_score", "precision", "recall", "f1_score"]
		error_metrics = ["mae", "mse", "rmse", "mean_absolute_error", "mean_squared_error"]

		m1_score = 0
		m2_score = 0

		for metric in accuracy_metrics:
			if metric in m1.metrics and metric in m2.metrics:
				if m1.metrics[metric] > m2.metrics[metric]:
					m1_score += 1
				elif m2.metrics[metric] > m1.metrics[metric]:
					m2_score += 1

		for metric in error_metrics:
			if metric in m1.metrics and metric in m2.metrics:
				if m1.metrics[metric] < m2.metrics[metric]:
					m1_score += 1
				elif m2.metrics[metric] < m1.metrics[metric]:
					m2_score += 1

		winner: str | None = None
		if m1_score > m2_score:
			winner = model_id_1
		elif m2_score > m1_score:
			winner = model_id_2

		comparison: Dict[str, Any] = {
			"model_1": {
				"id": m1.id,
				"name": m1.name,
				"version": m1.version,
				"metrics": m1.metrics,
				"training_samples": m1.training_samples,
			},
			"model_2": {
				"id": m2.id,
				"name": m2.name,
				"version": m2.version,
				"metrics": m2.metrics,
				"training_samples": m2.training_samples,
			},
			"metric_differences": metric_differences,
			"winner": winner,
		}

		return comparison

	def export_model(
		self,
		model_id: str,
		export_path: str | Path,
		include_metadata: bool = True
	) -> Path:
		"""
		Export a model to a specific path.

		Args:
			model_id: Model ID to export
			export_path: Path to export to
			include_metadata: Whether to include metadata JSON

		Returns:
			Path to exported model
		"""
		metadata = self._model_registry.get(model_id)
		if not metadata:
			raise ValueError(f"Model not found: {model_id}")

		export_path = Path(export_path)
		export_path.mkdir(parents=True, exist_ok=True)

		# Copy model file
		src_path = Path(metadata.file_path)
		dst_path = export_path / f"{metadata.name}_v{metadata.version}.joblib"

		import shutil
		shutil.copy2(src_path, dst_path)

		# Export metadata if requested
		if include_metadata:
			meta_path = export_path / f"{metadata.name}_v{metadata.version}_metadata.json"
			with open(meta_path, 'w') as f:
				f.write(metadata.model_dump_json(indent=2))

		self.logger.info(f"Exported model {metadata.name} v{metadata.version} to {export_path}")
		return dst_path

	def _get_next_version(self, name: str) -> str:
		"""Get the next version number for a model"""
		existing_versions = self.get_model_versions(name)

		if not existing_versions:
			return "1.0.0"

		# Parse latest version and increment
		latest = existing_versions[0].version
		parts = latest.split('.')

		if len(parts) == 3:
			major, minor, patch = map(int, parts)
			# Auto-version: increment patch
			return f"{major}.{minor}.{patch + 1}"

		return "1.0.0"

	def _calculate_checksum(self, file_path: Path) -> str:
		"""Calculate SHA256 checksum of a file"""
		sha256_hash = hashlib.sha256()

		with open(file_path, 'rb') as f:
			for chunk in iter(lambda: f.read(4096), b''):
				sha256_hash.update(chunk)

		return sha256_hash.hexdigest()

	def _backup_existing_model(self, name: str, model_type: ModelType) -> None:
		"""Backup existing active model"""
		active_id = self._active_models.get(model_type)
		if not active_id:
			return

		metadata = self._model_registry.get(active_id)
		if not metadata:
			return

		# Create backup
		src_path = Path(metadata.file_path)
		if not src_path.exists():
			return

		backup_path = self.storage_path / "backups" / f"{name}_v{metadata.version}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.joblib"

		import shutil
		shutil.copy2(src_path, backup_path)

		self.logger.info(f"Backed up model to {backup_path}")

	def get_registry_summary(self) -> Dict[str, Any]:
		"""
		Get summary of the model registry.

		Returns:
			Dictionary with registry statistics
		"""
		by_type: Dict[str, int] = {}
		by_status: Dict[str, int] = {}
		active_models: Dict[str, Dict[str, str]] = {}

		# Count by type
		for model in self._model_registry.values():
			mt = model.model_type.value
			by_type[mt] = by_type.get(mt, 0) + 1

		# Count by status
		for model in self._model_registry.values():
			st = model.status.value
			by_status[st] = by_status.get(st, 0) + 1

		# Active models
		for model_type, model_id in self._active_models.items():
			if model_id in self._model_registry:
				m = self._model_registry[model_id]
				active_models[model_type.value] = {
					"id": m.id,
					"name": m.name,
					"version": m.version,
				}

		summary: Dict[str, Any] = {
			"total_models": len(self._model_registry),
			"by_type": by_type,
			"by_status": by_status,
			"active_models": active_models,
		}

		return summary

# Convenience factory function
def create_model_persistence(
	storage_path: str | Path | None = None,
	config: Dict[str, Any] | None = None
) -> ModelPersistence:
	"""
	Create a ModelPersistence instance.

	Args:
		storage_path: Optional path for model storage
		config: Optional configuration dictionary

	Returns:
		Configured ModelPersistence instance
	"""
	return ModelPersistence(storage_path, config)