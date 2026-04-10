"""
Intelligence-Storage Integration Service

This module provides storage integration for the intelligence engine, enabling
persistent storage and retrieval of ML models, historical data, predictions,
and intelligence analyses for continuous learning and improvement.
"""

import asyncio
import json
import pickle
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import asdict
from enum import Enum

import numpy as np
from pydantic import BaseModel, Field, ConfigDict
from uuid import uuid4

# Intelligence engine imports
from ..predictors.win_probability_predictor import (
    WinProbabilityPredictor, PredictionResult, HistoricalOpportunity, ModelPerformanceMetrics
)
from ..predictors.scoring_predictor import (
    ScoringPredictor, SectionScorePrediction, HistoricalSectionScore, SectionModelMetrics, ProposalSection
)
from ..recommenders.strategy_recommender import StrategyRecommender, StrategicRecommendation
from ..recommenders.content_recommender import ContentRecommender, ContentRecommendationReport
from .discovery_integration import OpportunityIntelligence


class StorageType(str, Enum):
    """Types of storage backends"""
    
    FILE_SYSTEM = "file_system"
    DATABASE = "database"
    CLOUD_STORAGE = "cloud_storage"
    MEMORY = "memory"


class DataType(str, Enum):
    """Types of data to store"""
    
    ML_MODELS = "ml_models"
    HISTORICAL_DATA = "historical_data"
    PREDICTIONS = "predictions"
    INTELLIGENCE_REPORTS = "intelligence_reports"
    PERFORMANCE_METRICS = "performance_metrics"
    TRAINING_DATA = "training_data"


class StorageMetadata(BaseModel):
    """Metadata for stored items"""
    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
    
    storage_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique storage identifier")
    data_type: DataType = Field(description="Type of stored data")
    item_id: str = Field(description="Identifier of stored item")
    
    storage_path: str = Field(description="Storage path or location")
    file_size_bytes: Optional[int] = Field(None, description="File size in bytes")
    
    created_timestamp: datetime = Field(default_factory=datetime.now)
    last_accessed: datetime = Field(default_factory=datetime.now)
    access_count: int = Field(default=0, description="Number of times accessed")
    
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class IntelligenceStorageService:
    """
    Storage integration service for intelligence engine
    
    Provides persistent storage for ML models, historical data, predictions,
    and intelligence analyses with support for multiple storage backends
    and automatic data lifecycle management.
    """
    
    def __init__(self, storage_type: StorageType = StorageType.FILE_SYSTEM,
                 base_storage_path: str = "./intelligence_storage"):
        self.storage_type = storage_type
        self.base_path = Path(base_storage_path)
        
        # Initialize storage structure
        self._initialize_storage_structure()
        
        # Storage metadata tracking
        self.storage_metadata: Dict[str, StorageMetadata] = {}
        self.metadata_file = self.base_path / "metadata" / "storage_metadata.json"
        
        # Configuration
        self.auto_backup_enabled = True
        self.data_retention_days = 365
        self.compression_enabled = True
        
        # Load existing metadata
        self._load_metadata()
        
        self._log_initialization()
    
    def _initialize_storage_structure(self):
        """Initialize storage directory structure"""
        
        directories = [
            "models/win_probability",
            "models/scoring_predictor", 
            "models/strategy_recommender",
            "data/historical_opportunities",
            "data/historical_sections",
            "data/training_datasets",
            "predictions/win_probability",
            "predictions/section_scores",
            "reports/intelligence",
            "reports/content_recommendations",
            "reports/strategic_recommendations",
            "metrics/model_performance",
            "metadata",
            "backups"
        ]
        
        for directory in directories:
            (self.base_path / directory).mkdir(parents=True, exist_ok=True)
    
    async def store_ml_model(self, model: Any, model_type: str, model_id: str,
                             performance_metrics: Optional[Dict[str, Any]] = None) -> str:
        """
        Store ML model with metadata
        
        Args:
            model: ML model object to store
            model_type: Type of model (win_probability, scoring_predictor, etc.)
            model_id: Unique identifier for the model
            performance_metrics: Model performance metrics
            
        Returns:
            Storage path of saved model
        """
        try:
            self._log_storage_start("ml_model", model_id)
            
            # Determine storage path
            model_dir = self.base_path / "models" / model_type
            model_file = model_dir / f"{model_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pkl"
            
            # Store model
            with open(model_file, 'wb') as f:
                pickle.dump(model, f)
            
            # Store performance metrics if provided
            if performance_metrics:
                metrics_file = model_file.with_suffix('.metrics.json')
                with open(metrics_file, 'w') as f:
                    json.dump(performance_metrics, f, indent=2, default=str)
            
            # Create metadata
            metadata = StorageMetadata(
                data_type=DataType.ML_MODELS,
                item_id=model_id,
                storage_path=str(model_file),
                file_size_bytes=model_file.stat().st_size,
                metadata={
                    "model_type": model_type,
                    "has_performance_metrics": performance_metrics is not None,
                    "model_class": model.__class__.__name__
                }
            )
            
            self._store_metadata(metadata)
            
            self._log_storage_complete("ml_model", model_id, str(model_file))
            
            return str(model_file)
            
        except Exception as e:
            self._log_storage_error(f"Failed to store ML model {model_id}: {str(e)}")
            raise
    
    async def load_ml_model(self, model_id: str, model_type: str) -> Tuple[Any, Optional[Dict[str, Any]]]:
        """
        Load ML model and its performance metrics
        
        Args:
            model_id: Model identifier
            model_type: Type of model
            
        Returns:
            Tuple of (model, performance_metrics)
        """
        try:
            # Find latest model file
            model_files = list((self.base_path / "models" / model_type).glob(f"{model_id}_*.pkl"))
            
            if not model_files:
                raise FileNotFoundError(f"No model found for {model_id} of type {model_type}")
            
            # Get most recent model
            latest_model_file = max(model_files, key=lambda x: x.stat().st_mtime)
            
            # Load model
            with open(latest_model_file, 'rb') as f:
                model = pickle.load(f)
            
            # Load performance metrics if available
            metrics_file = latest_model_file.with_suffix('.metrics.json')
            performance_metrics = None
            if metrics_file.exists():
                with open(metrics_file, 'r') as f:
                    performance_metrics = json.load(f)
            
            # Update access metadata
            self._update_access_metadata(str(latest_model_file))
            
            self._log_load_complete("ml_model", model_id, str(latest_model_file))
            
            return model, performance_metrics
            
        except Exception as e:
            self._log_load_error(f"Failed to load ML model {model_id}: {str(e)}")
            raise
    
    async def store_historical_data(self, historical_data: List[Any], data_type: str) -> str:
        """
        Store historical training data
        
        Args:
            historical_data: List of historical data objects
            data_type: Type of historical data (opportunities, sections, etc.)
            
        Returns:
            Storage path of saved data
        """
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            data_file = self.base_path / "data" / f"historical_{data_type}" / f"data_{timestamp}.json"
            
            # Convert data to JSON-serializable format
            if hasattr(historical_data[0], 'model_dump'):
                # Pydantic models
                serializable_data = [item.model_dump() for item in historical_data]
            elif hasattr(historical_data[0], '__dict__'):
                # Dataclasses or regular objects
                serializable_data = [asdict(item) if hasattr(item, '__dataclass_fields__') else item.__dict__ for item in historical_data]
            else:
                serializable_data = historical_data
            
            # Store data
            with open(data_file, 'w') as f:
                json.dump(serializable_data, f, indent=2, default=str)
            
            # Create metadata
            metadata = StorageMetadata(
                data_type=DataType.HISTORICAL_DATA,
                item_id=f"{data_type}_{timestamp}",
                storage_path=str(data_file),
                file_size_bytes=data_file.stat().st_size,
                metadata={
                    "data_type": data_type,
                    "record_count": len(historical_data),
                    "sample_fields": list(serializable_data[0].keys()) if serializable_data else []
                }
            )
            
            self._store_metadata(metadata)
            
            self._log_storage_complete("historical_data", f"{data_type}_{timestamp}", str(data_file))
            
            return str(data_file)
            
        except Exception as e:
            self._log_storage_error(f"Failed to store historical data {data_type}: {str(e)}")
            raise
    
    async def load_historical_data(self, data_type: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Load historical training data
        
        Args:
            data_type: Type of historical data to load
            limit: Maximum number of records to return
            
        Returns:
            List of historical data records
        """
        try:
            data_dir = self.base_path / "data" / f"historical_{data_type}"
            data_files = list(data_dir.glob("data_*.json"))
            
            if not data_files:
                return []
            
            # Load all data files and combine
            all_data = []
            for data_file in sorted(data_files, key=lambda x: x.stat().st_mtime, reverse=True):
                with open(data_file, 'r') as f:
                    file_data = json.load(f)
                    all_data.extend(file_data)
                
                # Update access metadata
                self._update_access_metadata(str(data_file))
            
            # Apply limit if specified
            if limit:
                all_data = all_data[:limit]
            
            self._log_load_complete("historical_data", data_type, f"{len(all_data)} records")
            
            return all_data
            
        except Exception as e:
            self._log_load_error(f"Failed to load historical data {data_type}: {str(e)}")
            raise
    
    async def store_prediction(self, prediction: Any, prediction_type: str) -> str:
        """
        Store prediction result
        
        Args:
            prediction: Prediction object to store
            prediction_type: Type of prediction (win_probability, section_score, etc.)
            
        Returns:
            Storage path of saved prediction
        """
        try:
            # Get prediction ID
            prediction_id = getattr(prediction, 'prediction_id', getattr(prediction, 'opportunity_id', str(uuid4())))
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            prediction_file = self.base_path / "predictions" / prediction_type / f"{prediction_id}_{timestamp}.json"
            
            # Convert to JSON-serializable format
            if hasattr(prediction, 'model_dump'):
                prediction_data = prediction.model_dump()
            elif hasattr(prediction, '__dict__'):
                prediction_data = prediction.__dict__
            else:
                prediction_data = prediction
            
            # Store prediction
            with open(prediction_file, 'w') as f:
                json.dump(prediction_data, f, indent=2, default=str)
            
            # Create metadata
            metadata = StorageMetadata(
                data_type=DataType.PREDICTIONS,
                item_id=prediction_id,
                storage_path=str(prediction_file),
                file_size_bytes=prediction_file.stat().st_size,
                metadata={
                    "prediction_type": prediction_type,
                    "predicted_value": self._extract_predicted_value(prediction_data),
                    "confidence": self._extract_confidence(prediction_data)
                }
            )
            
            self._store_metadata(metadata)
            
            self._log_storage_complete("prediction", prediction_id, str(prediction_file))
            
            return str(prediction_file)
            
        except Exception as e:
            self._log_storage_error(f"Failed to store prediction: {str(e)}")
            raise
    
    async def store_intelligence_report(self, intelligence: OpportunityIntelligence) -> str:
        """
        Store intelligence analysis report
        
        Args:
            intelligence: Intelligence report to store
            
        Returns:
            Storage path of saved report
        """
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            report_file = self.base_path / "reports" / "intelligence" / f"{intelligence.opportunity_id}_{timestamp}.json"
            
            # Store report
            with open(report_file, 'w') as f:
                json.dump(intelligence.model_dump(), f, indent=2, default=str)
            
            # Create metadata
            metadata = StorageMetadata(
                data_type=DataType.INTELLIGENCE_REPORTS,
                item_id=intelligence.intelligence_id,
                storage_path=str(report_file),
                file_size_bytes=report_file.stat().st_size,
                metadata={
                    "opportunity_id": intelligence.opportunity_id,
                    "intelligence_level": intelligence.intelligence_level.value,
                    "confidence_score": intelligence.confidence_score,
                    "analysis_duration": intelligence.analysis_duration_seconds
                }
            )
            
            self._store_metadata(metadata)
            
            self._log_storage_complete("intelligence_report", intelligence.intelligence_id, str(report_file))
            
            return str(report_file)
            
        except Exception as e:
            self._log_storage_error(f"Failed to store intelligence report: {str(e)}")
            raise
    
    async def load_intelligence_reports(self, opportunity_id: Optional[str] = None,
                                        limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Load intelligence reports
        
        Args:
            opportunity_id: Optional filter by opportunity ID
            limit: Maximum number of reports to return
            
        Returns:
            List of intelligence reports
        """
        try:
            reports_dir = self.base_path / "reports" / "intelligence"
            
            if opportunity_id:
                report_files = list(reports_dir.glob(f"{opportunity_id}_*.json"))
            else:
                report_files = list(reports_dir.glob("*.json"))
            
            # Sort by modification time (newest first)
            report_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            
            if limit:
                report_files = report_files[:limit]
            
            reports = []
            for report_file in report_files:
                with open(report_file, 'r') as f:
                    report_data = json.load(f)
                    reports.append(report_data)
                
                # Update access metadata
                self._update_access_metadata(str(report_file))
            
            self._log_load_complete("intelligence_reports", opportunity_id or "all", f"{len(reports)} reports")
            
            return reports
            
        except Exception as e:
            self._log_load_error(f"Failed to load intelligence reports: {str(e)}")
            raise
    
    async def store_performance_metrics(self, metrics: Any, metrics_type: str, model_id: str) -> str:
        """
        Store model performance metrics
        
        Args:
            metrics: Performance metrics object
            metrics_type: Type of metrics (win_probability, section_scoring, etc.)
            model_id: Model identifier
            
        Returns:
            Storage path of saved metrics
        """
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            metrics_file = self.base_path / "metrics" / "model_performance" / f"{metrics_type}_{model_id}_{timestamp}.json"
            
            # Convert to JSON-serializable format
            if hasattr(metrics, 'model_dump'):
                metrics_data = metrics.model_dump()
            elif hasattr(metrics, '__dict__'):
                metrics_data = metrics.__dict__
            else:
                metrics_data = metrics
            
            # Store metrics
            with open(metrics_file, 'w') as f:
                json.dump(metrics_data, f, indent=2, default=str)
            
            # Create metadata
            metadata = StorageMetadata(
                data_type=DataType.PERFORMANCE_METRICS,
                item_id=f"{metrics_type}_{model_id}",
                storage_path=str(metrics_file),
                file_size_bytes=metrics_file.stat().st_size,
                metadata={
                    "metrics_type": metrics_type,
                    "model_id": model_id,
                    "performance_score": self._extract_performance_score(metrics_data)
                }
            )
            
            self._store_metadata(metadata)
            
            self._log_storage_complete("performance_metrics", f"{metrics_type}_{model_id}", str(metrics_file))
            
            return str(metrics_file)
            
        except Exception as e:
            self._log_storage_error(f"Failed to store performance metrics: {str(e)}")
            raise
    
    def _extract_predicted_value(self, prediction_data: Dict[str, Any]) -> Any:
        """Extract predicted value from prediction data"""
        
        # Common field names for predicted values
        value_fields = ['predicted_win_probability', 'predicted_score', 'prediction_result']
        
        for field in value_fields:
            if field in prediction_data:
                return prediction_data[field]
        
        return None
    
    def _extract_confidence(self, prediction_data: Dict[str, Any]) -> Any:
        """Extract confidence from prediction data"""
        
        confidence_fields = ['prediction_confidence', 'confidence_level', 'confidence']
        
        for field in confidence_fields:
            if field in prediction_data:
                return prediction_data[field]
        
        return None
    
    def _extract_performance_score(self, metrics_data: Dict[str, Any]) -> Any:
        """Extract performance score from metrics data"""
        
        score_fields = ['accuracy', 'r2_score', 'f1_score', 'performance_score']
        
        for field in score_fields:
            if field in metrics_data:
                return metrics_data[field]
        
        return None
    
    def _store_metadata(self, metadata: StorageMetadata):
        """Store metadata for tracking"""
        
        self.storage_metadata[metadata.storage_id] = metadata
        self._save_metadata()
    
    def _update_access_metadata(self, storage_path: str):
        """Update access metadata for a stored item"""
        
        # Find metadata by storage path
        for metadata in self.storage_metadata.values():
            if metadata.storage_path == storage_path:
                metadata.last_accessed = datetime.now()
                metadata.access_count += 1
                break
        
        self._save_metadata()
    
    def _load_metadata(self):
        """Load metadata from file"""
        
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r') as f:
                    metadata_dict = json.load(f)
                
                # Convert to StorageMetadata objects
                for storage_id, metadata_data in metadata_dict.items():
                    self.storage_metadata[storage_id] = StorageMetadata(**metadata_data)
                    
            except Exception as e:
                self._log_load_error(f"Failed to load metadata: {str(e)}")
    
    def _save_metadata(self):
        """Save metadata to file"""
        
        try:
            metadata_dict = {
                storage_id: metadata.model_dump()
                for storage_id, metadata in self.storage_metadata.items()
            }
            
            with open(self.metadata_file, 'w') as f:
                json.dump(metadata_dict, f, indent=2, default=str)
                
        except Exception as e:
            self._log_storage_error(f"Failed to save metadata: {str(e)}")
    
    async def cleanup_old_data(self, retention_days: Optional[int] = None) -> Dict[str, int]:
        """
        Clean up old data based on retention policy
        
        Args:
            retention_days: Number of days to retain data (uses instance default if None)
            
        Returns:
            Dictionary with cleanup statistics
        """
        retention_days = retention_days or self.data_retention_days
        cutoff_date = datetime.now() - timedelta(days=retention_days)
        
        cleanup_stats = {"files_deleted": 0, "metadata_cleaned": 0, "bytes_freed": 0}
        
        # Clean up files and metadata
        to_delete = []
        for storage_id, metadata in self.storage_metadata.items():
            if metadata.created_timestamp < cutoff_date:
                # Delete file if it exists
                file_path = Path(metadata.storage_path)
                if file_path.exists():
                    file_size = file_path.stat().st_size
                    file_path.unlink()
                    cleanup_stats["files_deleted"] += 1
                    cleanup_stats["bytes_freed"] += file_size
                
                to_delete.append(storage_id)
        
        # Remove metadata for deleted files
        for storage_id in to_delete:
            del self.storage_metadata[storage_id]
            cleanup_stats["metadata_cleaned"] += 1
        
        # Save updated metadata
        self._save_metadata()
        
        self._log_cleanup_complete(cleanup_stats)
        
        return cleanup_stats
    
    def get_storage_statistics(self) -> Dict[str, Any]:
        """Get storage usage and statistics"""
        
        stats = {
            "total_items": len(self.storage_metadata),
            "storage_type": self.storage_type.value,
            "base_path": str(self.base_path),
            "total_size_bytes": 0,
            "items_by_type": {},
            "access_statistics": {},
            "oldest_item": None,
            "newest_item": None
        }
        
        if not self.storage_metadata:
            return stats
        
        # Calculate statistics
        creation_times = []
        access_counts = []
        
        for metadata in self.storage_metadata.values():
            # Size calculation
            if metadata.file_size_bytes:
                stats["total_size_bytes"] += metadata.file_size_bytes
            
            # Count by type
            data_type = metadata.data_type.value
            stats["items_by_type"][data_type] = stats["items_by_type"].get(data_type, 0) + 1
            
            # Access statistics
            access_counts.append(metadata.access_count)
            creation_times.append(metadata.created_timestamp)
        
        # Access statistics
        if access_counts:
            stats["access_statistics"] = {
                "average_access_count": sum(access_counts) / len(access_counts),
                "max_access_count": max(access_counts),
                "total_accesses": sum(access_counts)
            }
        
        # Date statistics
        if creation_times:
            stats["oldest_item"] = min(creation_times).isoformat()
            stats["newest_item"] = max(creation_times).isoformat()
        
        return stats
    
    # Logging methods
    
    def _log_initialization(self):
        print(f"IntelligenceStorageService: Initialized with {self.storage_type.value} storage at {self.base_path}")
    
    def _log_storage_start(self, data_type: str, item_id: str):
        print(f"IntelligenceStorageService: Storing {data_type} {item_id}")
    
    def _log_storage_complete(self, data_type: str, item_id: str, path: str):
        print(f"IntelligenceStorageService: Stored {data_type} {item_id} at {path}")
    
    def _log_storage_error(self, message: str):
        print(f"IntelligenceStorageService Storage Error: {message}")
    
    def _log_load_complete(self, data_type: str, item_id: str, details: str):
        print(f"IntelligenceStorageService: Loaded {data_type} {item_id} ({details})")
    
    def _log_load_error(self, message: str):
        print(f"IntelligenceStorageService Load Error: {message}")
    
    def _log_cleanup_complete(self, stats: Dict[str, int]):
        print(f"IntelligenceStorageService: Cleanup complete - {stats['files_deleted']} files deleted, {stats['bytes_freed']} bytes freed")


# Example usage and testing
async def create_sample_storage_operations():
    """Create sample storage operations for testing"""
    
    # Initialize storage service
    storage_service = IntelligenceStorageService()
    
    # Sample data to store
    sample_historical_data = [
        {
            "opportunity_id": "hist_001",
            "actual_outcome": True,
            "opportunity_value": 2000000.0,
            "features": {
                "capability_match_score": 0.8,
                "competitive_intensity": 0.5
            }
        },
        {
            "opportunity_id": "hist_002", 
            "actual_outcome": False,
            "opportunity_value": 1500000.0,
            "features": {
                "capability_match_score": 0.6,
                "competitive_intensity": 0.8
            }
        }
    ]
    
    # Store historical data
    historical_path = await storage_service.store_historical_data(
        sample_historical_data, "opportunities"
    )
    
    # Sample prediction result
    sample_prediction = {
        "prediction_id": "pred_001",
        "opportunity_id": "opp_001", 
        "predicted_win_probability": 0.75,
        "prediction_confidence": 0.85,
        "prediction_timestamp": datetime.now().isoformat()
    }
    
    # Store prediction
    prediction_path = await storage_service.store_prediction(
        sample_prediction, "win_probability"
    )
    
    # Sample performance metrics
    sample_metrics = {
        "model_name": "Random Forest",
        "accuracy": 0.82,
        "f1_score": 0.79,
        "training_samples": 100,
        "last_trained": datetime.now().isoformat()
    }
    
    # Store performance metrics
    metrics_path = await storage_service.store_performance_metrics(
        sample_metrics, "win_probability", "rf_model_v1"
    )
    
    # Get storage statistics
    stats = storage_service.get_storage_statistics()
    
    return {
        "historical_path": historical_path,
        "prediction_path": prediction_path,
        "metrics_path": metrics_path,
        "storage_stats": stats
    }


if __name__ == "__main__":
    # Test the storage integration service
    import asyncio
    
    async def main():
        results = await create_sample_storage_operations()
        
        print("Storage Integration Test Results:")
        print("=" * 50)
        print(f"Historical Data Path: {results['historical_path']}")
        print(f"Prediction Path: {results['prediction_path']}")
        print(f"Metrics Path: {results['metrics_path']}")
        
        print(f"\nStorage Statistics:")
        stats = results['storage_stats']
        print(f"  Total Items: {stats['total_items']}")
        print(f"  Total Size: {stats['total_size_bytes']} bytes")
        print(f"  Storage Type: {stats['storage_type']}")
        print(f"  Items by Type: {stats['items_by_type']}")
        
        if stats['access_statistics']:
            print(f"  Average Access Count: {stats['access_statistics']['average_access_count']:.1f}")
        
        print(f"  Base Path: {stats['base_path']}")
    
    asyncio.run(main())