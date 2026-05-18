"""
Win Probability Predictor

This module provides machine learning-based prediction of win probabilities
for opportunities using Random Forest and XGBoost models with comprehensive
feature engineering and performance monitoring.
"""

import asyncio
import logging
logger = logging.getLogger(__name__)
import numpy as np
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field

import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score, train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import xgboost as xgb
from pydantic import BaseModel, Field, ConfigDict



class PredictionFeatures(BaseModel):
	"""Features used for win probability prediction"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	# Opportunity characteristics
	opportunity_value: float = Field(description="Estimated opportunity value")
	submission_days_remaining: int = Field(description="Days remaining for submission")
	requirements_complexity: float = Field(ge=0.0, le=1.0, description="Complexity score of requirements")
	
	# Organizational factors
	capability_match_score: float = Field(ge=0.0, le=1.0, description="How well capabilities match requirements")
	past_performance_score: float = Field(ge=0.0, le=1.0, description="Relevant past performance score")
	team_experience_score: float = Field(ge=0.0, le=1.0, description="Team experience relevance score")
	
	# Competitive factors
	competitive_intensity: float = Field(ge=0.0, le=1.0, description="Level of competition")
	incumbent_advantage: bool = Field(description="Whether there's an incumbent advantage")
	estimated_competitors: int = Field(ge=0, description="Estimated number of competitors")
	
	# Market factors
	market_familiarity: float = Field(ge=0.0, le=1.0, description="Familiarity with market/client")
	industry_experience_years: int = Field(ge=0, description="Years of industry experience")
	client_relationship_score: float = Field(ge=0.0, le=1.0, description="Quality of client relationship")
	
	# Strategic factors
	strategic_importance: float = Field(ge=0.0, le=1.0, description="Strategic importance to organization")
	resource_availability: float = Field(ge=0.0, le=1.0, description="Availability of required resources")
	pricing_competitiveness: float = Field(ge=0.0, le=1.0, description="Expected pricing competitiveness")


class PredictionResult(BaseModel):
	"""Win probability prediction result"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	opportunity_id: str = Field(description="Opportunity identifier")
	predicted_win_probability: float = Field(ge=0.0, le=1.0, description="Predicted win probability")
	confidence_interval: Tuple[float, float] = Field(description="95% confidence interval")
	
	# Feature importance
	top_positive_factors: List[Tuple[str, float]] = Field(description="Top factors increasing win probability")
	top_negative_factors: List[Tuple[str, float]] = Field(description="Top factors decreasing win probability")
	
	# Model information
	model_used: str = Field(description="ML model used for prediction")
	prediction_confidence: float = Field(ge=0.0, le=1.0, description="Confidence in the prediction")
	
	# Recommendations
	improvement_recommendations: List[str] = Field(description="Recommendations to improve win probability")
	risk_factors: List[str] = Field(description="Key risk factors identified")
	
	prediction_timestamp: datetime = Field(default_factory=datetime.now)


class ModelPerformanceMetrics(BaseModel):
	"""Model performance tracking metrics"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	model_name: str = Field(description="Name of the ML model")
	accuracy: float = Field(description="Model accuracy")
	precision: float = Field(description="Model precision")
	recall: float = Field(description="Model recall")
	f1_score: float = Field(description="F1 score")
	auc_score: float = Field(description="AUC-ROC score")
	
	# Cross-validation scores
	cv_accuracy_mean: float = Field(description="Mean cross-validation accuracy")
	cv_accuracy_std: float = Field(description="Standard deviation of CV accuracy")
	
	# Feature importance
	feature_importance: Dict[str, float] = Field(description="Feature importance scores")
	
	# Training information
	training_samples: int = Field(description="Number of training samples")
	last_trained: datetime = Field(default_factory=datetime.now)
	model_version: str = Field(description="Version of the trained model")


@dataclass
class HistoricalOpportunity:
	"""Historical opportunity data for model training"""
	
	opportunity_id: str
	features: PredictionFeatures
	actual_outcome: bool  # True if won, False if lost
	win_score: Optional[float] = None  # If available, the actual win score
	lessons_learned: List[str] = field(default_factory=list)
	outcome_date: datetime = field(default_factory=datetime.now)


class WinProbabilityPredictor:
	"""
	Machine learning-based win probability predictor
	
	Uses Random Forest and XGBoost models to predict win probabilities
	based on opportunity characteristics, organizational factors, and
	competitive landscape analysis.
	"""
	
	def __init__(self, model_cache_path: Optional[str] = None):
		# Model components
		self.rf_model: Optional[RandomForestClassifier] = None
		self.xgb_model: Optional[xgb.XGBClassifier] = None
		self.feature_scaler = StandardScaler()
		self.label_encoder = LabelEncoder()
		
		# Model selection
		self.primary_model = 'random_forest'  # or 'xgboost'
		self.model_cache_path = model_cache_path
		
		# Feature engineering
		self.feature_columns = [
			'opportunity_value', 'submission_days_remaining', 'requirements_complexity',
			'capability_match_score', 'past_performance_score', 'team_experience_score',
			'competitive_intensity', 'incumbent_advantage', 'estimated_competitors',
			'market_familiarity', 'industry_experience_years', 'client_relationship_score',
			'strategic_importance', 'resource_availability', 'pricing_competitiveness'
		]
		
		# Performance tracking
		self.model_performance: Dict[str, ModelPerformanceMetrics] = {}
		self.prediction_history: List[PredictionResult] = []
		
		# Training data
		self.training_data: List[HistoricalOpportunity] = []
		self.is_trained = False
		
		self._log_initialization()
	
	async def train_model(self, historical_data: List[HistoricalOpportunity],
	                      test_size: float = 0.2, cross_val_folds: int = 5) -> Dict[str, ModelPerformanceMetrics]:
		"""
		Train both Random Forest and XGBoost models on historical data
		
		Args:
			historical_data: List of historical opportunities with outcomes
			test_size: Proportion of data to use for testing
			cross_val_folds: Number of cross-validation folds
			
		Returns:
			Performance metrics for both models
		"""
		if len(historical_data) < 10:
			raise ValueError("Need at least 10 historical opportunities for training")
		
		try:
			self._log_training_start(len(historical_data))
			
			# Prepare training data
			X, y = self._prepare_training_data(historical_data)
			
			# Split data
			X_train, X_test, y_train, y_test = train_test_split(
				X, y, test_size=test_size, random_state=42, stratify=y
			)
			
			# Scale features
			X_train_scaled = self.feature_scaler.fit_transform(X_train)
			X_test_scaled = self.feature_scaler.transform(X_test)
			
			# Train Random Forest
			rf_metrics = await self._train_random_forest(
				X_train_scaled, X_test_scaled, y_train, y_test, cross_val_folds
			)
			
			# Train XGBoost
			xgb_metrics = await self._train_xgboost(
				X_train_scaled, X_test_scaled, y_train, y_test, cross_val_folds
			)
			
			# Store performance metrics
			self.model_performance['random_forest'] = rf_metrics
			self.model_performance['xgboost'] = xgb_metrics
			
			# Select best performing model
			self._select_primary_model()
			
			# Update training data and status
			self.training_data = historical_data
			self.is_trained = True
			
			# Save models if cache path provided
			if self.model_cache_path:
				self._save_models()
			
			self._log_training_complete(rf_metrics, xgb_metrics)
			return self.model_performance
			
		except Exception as e:
			self._log_training_error(f"Model training failed: {str(e)}")
			raise
	
	async def _train_random_forest(self, X_train: np.ndarray, X_test: np.ndarray,
	                               y_train: np.ndarray, y_test: np.ndarray,
	                               cv_folds: int) -> ModelPerformanceMetrics:
		"""Train Random Forest model with hyperparameter optimization"""
		
		# Hyperparameter grid for Random Forest
		rf_param_grid = {
			'n_estimators': [100, 200, 300],
			'max_depth': [10, 20, None],
			'min_samples_split': [2, 5, 10],
			'min_samples_leaf': [1, 2, 4]
		}
		
		# Grid search with cross-validation
		rf_grid_search = GridSearchCV(
			RandomForestClassifier(random_state=42),
			rf_param_grid,
			cv=cv_folds,
			scoring='accuracy',
			n_jobs=-1
		)
		
		rf_grid_search.fit(X_train, y_train)
		
		# Best model
		self.rf_model = rf_grid_search.best_estimator_
		
		# Predictions
		y_pred = self.rf_model.predict(X_test)
		y_pred_proba = self.rf_model.predict_proba(X_test)[:, 1]
		
		# Cross-validation scores
		cv_scores = cross_val_score(self.rf_model, X_train, y_train, cv=cv_folds)
		
		# Feature importance
		feature_importance = dict(zip(
			self.feature_columns,
			self.rf_model.feature_importances_
		))
		
		# Calculate AUC
		from sklearn.metrics import roc_auc_score
		auc = roc_auc_score(y_test, y_pred_proba)
		
		return ModelPerformanceMetrics(
			model_name="Random Forest",
			accuracy=accuracy_score(y_test, y_pred),
			precision=precision_score(y_test, y_pred, average='weighted'),
			recall=recall_score(y_test, y_pred, average='weighted'),
			f1_score=f1_score(y_test, y_pred, average='weighted'),
			auc_score=auc,
			cv_accuracy_mean=cv_scores.mean(),
			cv_accuracy_std=cv_scores.std(),
			feature_importance=feature_importance,
			training_samples=len(X_train),
			model_version="1.0"
		)
	
	async def _train_xgboost(self, X_train: np.ndarray, X_test: np.ndarray,
	                         y_train: np.ndarray, y_test: np.ndarray,
	                         cv_folds: int) -> ModelPerformanceMetrics:
		"""Train XGBoost model with hyperparameter optimization"""
		
		# Hyperparameter grid for XGBoost
		xgb_param_grid = {
			'n_estimators': [100, 200, 300],
			'max_depth': [3, 6, 10],
			'learning_rate': [0.01, 0.1, 0.2],
			'subsample': [0.8, 1.0]
		}
		
		# Grid search with cross-validation
		xgb_grid_search = GridSearchCV(
			xgb.XGBClassifier(random_state=42, eval_metric='logloss'),
			xgb_param_grid,
			cv=cv_folds,
			scoring='accuracy',
			n_jobs=-1
		)
		
		xgb_grid_search.fit(X_train, y_train)
		
		# Best model
		self.xgb_model = xgb_grid_search.best_estimator_
		
		# Predictions
		y_pred = self.xgb_model.predict(X_test)
		y_pred_proba = self.xgb_model.predict_proba(X_test)[:, 1]
		
		# Cross-validation scores
		cv_scores = cross_val_score(self.xgb_model, X_train, y_train, cv=cv_folds)
		
		# Feature importance
		feature_importance = dict(zip(
			self.feature_columns,
			self.xgb_model.feature_importances_
		))
		
		# Calculate AUC
		from sklearn.metrics import roc_auc_score
		auc = roc_auc_score(y_test, y_pred_proba)
		
		return ModelPerformanceMetrics(
			model_name="XGBoost",
			accuracy=accuracy_score(y_test, y_pred),
			precision=precision_score(y_test, y_pred, average='weighted'),
			recall=recall_score(y_test, y_pred, average='weighted'),
			f1_score=f1_score(y_test, y_pred, average='weighted'),
			auc_score=auc,
			cv_accuracy_mean=cv_scores.mean(),
			cv_accuracy_std=cv_scores.std(),
			feature_importance=feature_importance,
			training_samples=len(X_train),
			model_version="1.0"
		)
	
	def _prepare_training_data(self, historical_data: List[HistoricalOpportunity]) -> Tuple[np.ndarray, np.ndarray]:
		"""Prepare training data from historical opportunities"""
		
		features_list = []
		outcomes = []
		
		for opportunity in historical_data:
			# Convert features to array
			feature_dict = opportunity.features.model_dump()
			
			# Handle boolean features
			feature_dict['incumbent_advantage'] = float(feature_dict['incumbent_advantage'])
			
			# Extract features in correct order
			feature_vector = [feature_dict[col] for col in self.feature_columns]
			features_list.append(feature_vector)
			
			# Outcome (1 for win, 0 for loss)
			outcomes.append(1 if opportunity.actual_outcome else 0)
		
		X = np.array(features_list)
		y = np.array(outcomes)
		
		return X, y
	
	def _select_primary_model(self):
		"""Select the best performing model as primary"""
		
		if 'random_forest' in self.model_performance and 'xgboost' in self.model_performance:
			rf_score = self.model_performance['random_forest'].accuracy
			xgb_score = self.model_performance['xgboost'].accuracy
			
			self.primary_model = 'xgboost' if xgb_score > rf_score else 'random_forest'
		elif 'random_forest' in self.model_performance:
			self.primary_model = 'random_forest'
		elif 'xgboost' in self.model_performance:
			self.primary_model = 'xgboost'
	
	async def predict_win_probability(self, features: PredictionFeatures,
	                                  opportunity_id: str) -> PredictionResult:
		"""
		Predict win probability for an opportunity
		
		Args:
			features: Opportunity features for prediction
			opportunity_id: Unique opportunity identifier
			
		Returns:
			Prediction result with probability and insights
		"""
		if not self.is_trained:
			raise ValueError("Model must be trained before making predictions")
		
		try:
			# Prepare feature vector
			feature_dict = features.model_dump()
			feature_dict['incumbent_advantage'] = float(feature_dict['incumbent_advantage'])
			feature_vector = np.array([feature_dict[col] for col in self.feature_columns]).reshape(1, -1)
			
			# Scale features
			feature_vector_scaled = self.feature_scaler.transform(feature_vector)
			
			# Get model and make prediction
			model = self.rf_model if self.primary_model == 'random_forest' else self.xgb_model
			
			win_probability = float(model.predict_proba(feature_vector_scaled)[0, 1])
			
			# Calculate confidence interval (simplified approach)
			prediction_confidence = self._calculate_prediction_confidence(feature_vector_scaled, model)
			confidence_margin = 0.1 * (1 - prediction_confidence)  # Wider interval for less confident predictions
			
			confidence_interval = (
				max(0.0, win_probability - confidence_margin),
				min(1.0, win_probability + confidence_margin)
			)
			
			# Feature importance analysis
			top_positive, top_negative = self._analyze_feature_impact(
				feature_dict, model.feature_importances_
			)
			
			# Generate recommendations
			recommendations = self._generate_improvement_recommendations(feature_dict, top_negative)
			risk_factors = self._identify_risk_factors(feature_dict, top_negative)
			
			result = PredictionResult(
				opportunity_id=opportunity_id,
				predicted_win_probability=win_probability,
				confidence_interval=confidence_interval,
				top_positive_factors=top_positive,
				top_negative_factors=top_negative,
				model_used=self.primary_model,
				prediction_confidence=prediction_confidence,
				improvement_recommendations=recommendations,
				risk_factors=risk_factors
			)
			
			# Store prediction history
			self.prediction_history.append(result)
			
			self._log_prediction_complete(opportunity_id, win_probability, prediction_confidence)
			
			return result
			
		except Exception as e:
			self._log_prediction_error(f"Prediction failed for {opportunity_id}: {str(e)}")
			raise
	
	def _calculate_prediction_confidence(self, feature_vector: np.ndarray, model) -> float:
		"""Calculate confidence in prediction based on model certainty"""
		
		# Get prediction probabilities
		probabilities = model.predict_proba(feature_vector)[0]
		
		# Confidence based on how far the prediction is from 0.5 (uncertainty)
		max_prob = max(probabilities)
		confidence = 2 * abs(max_prob - 0.5)  # Scale to 0-1 range
		
		return confidence
	
	def _analyze_feature_impact(self, feature_dict: Dict[str, Any],
	                            feature_importances: np.ndarray) -> Tuple[List[Tuple[str, float]], List[Tuple[str, float]]]:
		"""Analyze which features positively and negatively impact win probability"""
		
		# Combine features with their importance and values
		feature_analysis = []
		
		for i, feature_name in enumerate(self.feature_columns):
			importance = feature_importances[i]
			value = feature_dict[feature_name]
			
			# For binary features and low values, negative impact
			# For high values, positive impact
			if feature_name == 'incumbent_advantage':
				impact = importance if value else -importance
			elif feature_name in ['competitive_intensity']:
				# Higher competition = negative impact
				impact = -importance * value
			else:
				# Most features: higher value = positive impact
				impact = importance * value
			
			feature_analysis.append((feature_name.replace('_', ' ').title(), impact))
		
		# Sort by impact
		feature_analysis.sort(key=lambda x: abs(x[1]), reverse=True)
		
		# Split into positive and negative factors
		positive_factors = [(name, impact) for name, impact in feature_analysis if impact > 0][:5]
		negative_factors = [(name, abs(impact)) for name, impact in feature_analysis if impact < 0][:5]
		
		return positive_factors, negative_factors
	
	def _generate_improvement_recommendations(self, feature_dict: Dict[str, Any],
	                                          negative_factors: List[Tuple[str, float]]) -> List[str]:
		"""Generate specific recommendations to improve win probability"""
		
		recommendations = []
		
		# Analyze top negative factors and provide specific advice
		for factor_name, impact in negative_factors[:3]:
			
			if 'capability' in factor_name.lower():
				recommendations.append("Strengthen team capabilities through training, hiring, or partnerships")
			
			elif 'competitive' in factor_name.lower():
				recommendations.append("Develop stronger differentiation strategy and unique value propositions")
			
			elif 'past performance' in factor_name.lower():
				recommendations.append("Highlight more relevant past performance examples and case studies")
			
			elif 'relationship' in factor_name.lower():
				recommendations.append("Invest more time in client relationship building and stakeholder engagement")
			
			elif 'resource' in factor_name.lower():
				recommendations.append("Secure additional resources or optimize resource allocation plan")
			
			elif 'pricing' in factor_name.lower():
				recommendations.append("Review pricing strategy for better competitiveness while maintaining margins")
		
		# Add general recommendations
		if feature_dict['submission_days_remaining'] < 14:
			recommendations.append("Prioritize proposal completion - limited time remaining")
		
		if feature_dict['strategic_importance'] < 0.5:
			recommendations.append("Consider strategic value and long-term benefits in proposal positioning")
		
		return recommendations[:5]
	
	def _identify_risk_factors(self, feature_dict: Dict[str, Any],
	                           negative_factors: List[Tuple[str, float]]) -> List[str]:
		"""Identify key risk factors that could impact win probability"""
		
		risks = []
		
		# Time-based risks
		if feature_dict['submission_days_remaining'] < 21:
			risks.append("Limited time for proposal development and review")
		
		# Competitive risks
		if feature_dict['competitive_intensity'] > 0.7:
			risks.append("High competitive intensity - many strong competitors expected")
		
		if feature_dict['incumbent_advantage']:
			risks.append("Incumbent contractor advantage - need strong differentiation")
		
		# Capability risks
		if feature_dict['capability_match_score'] < 0.6:
			risks.append("Capability gaps may impact technical evaluation scores")
		
		# Relationship risks
		if feature_dict['client_relationship_score'] < 0.4:
			risks.append("Limited client relationship - may impact evaluation favorability")
		
		# Resource risks
		if feature_dict['resource_availability'] < 0.6:
			risks.append("Resource constraints may impact proposal quality or delivery")
		
		return risks[:4]
	
	async def retrain_with_outcomes(self, new_outcomes: List[HistoricalOpportunity]):
		"""Retrain model with new outcome data"""
		
		if not new_outcomes:
			return
		
		# Combine with existing training data
		updated_training_data = self.training_data + new_outcomes
		
		# Retrain models
		await self.train_model(updated_training_data)
		
		self._log_retraining_complete(len(new_outcomes))
	
	def get_model_performance(self) -> Dict[str, ModelPerformanceMetrics]:
		"""Get current model performance metrics"""
		return self.model_performance.copy()
	
	def get_prediction_statistics(self) -> Dict[str, Any]:
		"""Get prediction statistics and insights"""
		
		if not self.prediction_history:
			return {"total_predictions": 0}
		
		predictions = [p.predicted_win_probability for p in self.prediction_history]
		confidences = [p.prediction_confidence for p in self.prediction_history]
		
		return {
			"total_predictions": len(self.prediction_history),
			"average_predicted_probability": np.mean(predictions),
			"prediction_distribution": {
				"high_probability (>0.7)": sum(1 for p in predictions if p > 0.7),
				"medium_probability (0.3-0.7)": sum(1 for p in predictions if 0.3 <= p <= 0.7),
				"low_probability (<0.3)": sum(1 for p in predictions if p < 0.3)
			},
			"average_confidence": np.mean(confidences),
			"primary_model": self.primary_model,
			"model_trained": self.is_trained
		}
	
	def _save_models(self):
		"""Save trained models to cache"""
		if self.model_cache_path:
			model_data = {
				'rf_model': self.rf_model,
				'xgb_model': self.xgb_model,
				'feature_scaler': self.feature_scaler,
				'feature_columns': self.feature_columns,
				'primary_model': self.primary_model,
				'performance_metrics': self.model_performance
			}
			joblib.dump(model_data, self.model_cache_path)
			self._log_models_saved()
	
	def load_models(self) -> bool:
		"""Load trained models from cache"""
		if self.model_cache_path:
			try:
				model_data = joblib.load(self.model_cache_path)
				
				self.rf_model = model_data['rf_model']
				self.xgb_model = model_data['xgb_model']
				self.feature_scaler = model_data['feature_scaler']
				self.feature_columns = model_data['feature_columns']
				self.primary_model = model_data['primary_model']
				self.model_performance = model_data['performance_metrics']
				self.is_trained = True
				
				self._log_models_loaded()
				return True
				
			except Exception as e:
				self._log_load_error(f"Failed to load models: {str(e)}")
				return False
		
		return False
	
	# Logging methods
	
	def _log_initialization(self):
		logger.info(f"WinProbabilityPredictor: Initialized with Random Forest and XGBoost models")
	
	def _log_training_start(self, data_size: int):
		logger.info(f"WinProbabilityPredictor: Starting training with {data_size} historical opportunities")
	
	def _log_training_complete(self, rf_metrics: ModelPerformanceMetrics, xgb_metrics: ModelPerformanceMetrics):
		logger.info(f"WinProbabilityPredictor: Training complete")
		logger.info(f"  Random Forest Accuracy: {rf_metrics.accuracy:.3f}")
		logger.info(f"  XGBoost Accuracy: {xgb_metrics.accuracy:.3f}")
		logger.info(f"  Primary Model: {self.primary_model}")
	
	def _log_training_error(self, message: str):
		logger.error(f"WinProbabilityPredictor Training Error: {message}")
	
	def _log_prediction_complete(self, opportunity_id: str, probability: float, confidence: float):
		logger.info(f"WinProbabilityPredictor: Predicted {probability:.3f} win probability for {opportunity_id} (confidence: {confidence:.3f})")
	
	def _log_prediction_error(self, message: str):
		logger.error(f"WinProbabilityPredictor Prediction Error: {message}")
	
	def _log_retraining_complete(self, new_samples: int):
		logger.info(f"WinProbabilityPredictor: Retrained with {new_samples} new outcome samples")
	
	def _log_models_saved(self):
		logger.info(f"WinProbabilityPredictor: Models saved to cache")
	
	def _log_models_loaded(self):
		logger.info(f"WinProbabilityPredictor: Models loaded from cache")

	def _log_load_error(self, message: str):
		logger.error(f"WinProbabilityPredictor Load Error: {message}")

	async def predict_win_probability_from_scores(
		self,
		section_scores: Dict[str, float],
		opportunity_id: str,
		opportunity_features: Optional[Dict[str, float]] = None
	) -> PredictionResult:
		"""
		Calculate win probability from section scores combined with opportunity features.

		This method integrates with ScoringPredictor to derive win probability
		from predicted section scores and other opportunity factors.

		Args:
			section_scores: Dictionary of section type to predicted score (0-100)
			opportunity_id: Unique opportunity identifier
			opportunity_features: Optional additional opportunity features

		Returns:
			PredictionResult with win probability and insights
		"""
		# Calculate combined proposal score
		combined_score = self._combine_section_scores(section_scores)

		# Create prediction features from scores and additional features
		features_dict = self._create_features_from_scores(
			section_scores, combined_score, opportunity_features
		)

		# Create PredictionFeatures object
		prediction_features = PredictionFeatures(**features_dict)

		# Use existing prediction logic
		return await self.predict_win_probability(prediction_features, opportunity_id)

	def _combine_section_scores(self, section_scores: Dict[str, float]) -> float:
		"""
		Combine section scores into overall proposal score.

		Uses weighted average based on typical evaluation criteria weights.

		Args:
			section_scores: Dictionary of section type to score (0-100)

		Returns:
			Combined proposal score (0-100)
		"""
		# Standard section weights (typical RFP evaluation weights)
		section_weights = {
			'technical_approach': 0.30,
			'management_approach': 0.15,
			'past_performance': 0.20,
			'personnel_qualifications': 0.10,
			'corporate_experience': 0.05,
			'understanding_of_requirements': 0.10,
			'price_cost': 0.05,
			'small_business_utilization': 0.02,
			'transition_approach': 0.02,
			'risk_management': 0.01,
		}

		total_weight = 0.0
		weighted_sum = 0.0

		for section, score in section_scores.items():
			weight = section_weights.get(section, 0.05)  # Default weight for unknown sections
			weighted_sum += score * weight
			total_weight += weight

		# Normalize by total weight used
		if total_weight > 0:
			combined_score = weighted_sum / total_weight
		else:
			# Fallback to simple average
			combined_score = sum(section_scores.values()) / len(section_scores) if section_scores else 0.0

		return min(100.0, max(0.0, combined_score))

	def _create_features_from_scores(
		self,
		section_scores: Dict[str, float],
		combined_score: float,
		opportunity_features: Optional[Dict[str, float]] = None
	) -> Dict[str, Any]:
		"""
		Create prediction features from section scores and opportunity data.

		Args:
			section_scores: Dictionary of section scores
			combined_score: Combined proposal score
			opportunity_features: Optional additional features

		Returns:
			Dictionary of feature values for PredictionFeatures
		"""
		# Default opportunity features
		defaults: Dict[str, Any] = {
			'opportunity_value': 1000000.0,
			'submission_days_remaining': 30,
			'requirements_complexity': 0.5,
			'capability_match_score': 0.5,
			'past_performance_score': 0.5,
			'team_experience_score': 0.5,
			'competitive_intensity': 0.5,
			'incumbent_advantage': False,
			'estimated_competitors': 5,
			'market_familiarity': 0.5,
			'industry_experience_years': 5,
			'client_relationship_score': 0.5,
			'strategic_importance': 0.5,
			'resource_availability': 0.5,
			'pricing_competitiveness': 0.5,
		}

		# Override defaults with provided features
		if opportunity_features:
			for key, value in opportunity_features.items():
				if key in defaults:
					defaults[key] = value

		# Derive features from section scores
		# Technical approach score maps to capability match
		if 'technical_approach' in section_scores:
			defaults['capability_match_score'] = min(1.0, section_scores['technical_approach'] / 100.0)

		# Past performance score maps directly
		if 'past_performance' in section_scores:
			defaults['past_performance_score'] = min(1.0, section_scores['past_performance'] / 100.0)

		# Personnel qualifications maps to team experience
		if 'personnel_qualifications' in section_scores:
			defaults['team_experience_score'] = min(1.0, section_scores['personnel_qualifications'] / 100.0)

		# Understanding of requirements maps to market familiarity
		if 'understanding_of_requirements' in section_scores:
			defaults['market_familiarity'] = min(1.0, section_scores['understanding_of_requirements'] / 100.0)

		# Combined score influences client relationship (higher scores = better relationship)
		defaults['client_relationship_score'] = min(1.0, combined_score / 100.0)

		return defaults

	def get_confidence_interval(
		self,
		probability: float,
		confidence_level: float = 0.95
	) -> Tuple[float, float]:
		"""
		Get confidence interval for a win probability prediction.

		Uses the model's prediction confidence to estimate the interval.

		Args:
			probability: Predicted win probability
			confidence_level: Confidence level (default 0.95 for 95% CI)

		Returns:
			Tuple of (lower_bound, upper_bound)
		"""
		# Calculate margin based on prediction confidence
		# Higher confidence = narrower interval
		if not self.is_trained:
			# If not trained, use wider interval
			margin = 0.2
		else:
			# Use model performance to estimate margin
			# Lower accuracy = wider interval
			avg_accuracy = np.mean([
				metrics.accuracy for metrics in self.model_performance.values()
			]) if self.model_performance else 0.7

			# Margin inversely proportional to accuracy
			margin = (1 - avg_accuracy) * 0.5

		# Calculate bounds
		lower = max(0.0, probability - margin)
		upper = min(1.0, probability + margin)

		return (lower, upper)

	def integrate_with_scoring_predictor(
		self,
		scoring_predictor: Any,  # ScoringPredictor instance
		requirements: List[Any],  # List of Requirement objects
		opportunity_id: str,
		compliance_matrix: Optional[Any] = None,  # ComplianceMatrix object
		opportunity_features: Optional[Dict[str, float]] = None
	) -> Dict[str, Any]:
		"""
		Integrate with ScoringPredictor to provide comprehensive prediction.

		This method coordinates between the scoring predictor (section-level scores)
		and win probability predictor to provide a complete picture.

		Args:
			scoring_predictor: Instance of ScoringPredictor
			requirements: List of extracted requirements
			opportunity_id: Unique opportunity identifier
			compliance_matrix: Optional compliance matrix
			opportunity_features: Optional additional features

		Returns:
			Dictionary with integrated prediction results
		"""
		# This is a placeholder for integration
		# In practice, this would call scoring_predictor methods
		# and combine results with win probability

		return {
			"opportunity_id": opportunity_id,
			"section_scores": {},
			"combined_score": 0.0,
			"win_probability": 0.5,
			"confidence_interval": (0.3, 0.7),
			"recommendations": [],
			"integrated_prediction": True
		}


# Example usage and testing
async def create_sample_win_probability_prediction():
	"""Create sample win probability prediction for testing"""
	
	# Initialize predictor
	predictor = WinProbabilityPredictor()
	
	# Create sample historical data
	historical_opportunities = []
	
	for i in range(50):  # 50 sample historical opportunities
		features = PredictionFeatures(
			opportunity_value=float(1000000 + (i * 200000)),
			submission_days_remaining=30 + (i % 60),
			requirements_complexity=0.3 + (i % 7) * 0.1,
			capability_match_score=0.5 + (i % 5) * 0.1,
			past_performance_score=0.4 + (i % 6) * 0.1,
			team_experience_score=0.6 + (i % 4) * 0.1,
			competitive_intensity=0.3 + (i % 7) * 0.1,
			incumbent_advantage=(i % 3) == 0,
			estimated_competitors=2 + (i % 6),
			market_familiarity=0.4 + (i % 6) * 0.1,
			industry_experience_years=5 + (i % 15),
			client_relationship_score=0.3 + (i % 7) * 0.1,
			strategic_importance=0.5 + (i % 5) * 0.1,
			resource_availability=0.6 + (i % 4) * 0.1,
			pricing_competitiveness=0.5 + (i % 5) * 0.1
		)
		
		# Simulate outcome based on features (higher capability match = higher win chance)
		outcome = (features.capability_match_score + features.past_performance_score + 
		          features.team_experience_score - features.competitive_intensity) > 1.8
		
		historical_opportunities.append(HistoricalOpportunity(
			opportunity_id=f"hist_{i:03d}",
			features=features,
			actual_outcome=outcome
		))
	
	# Train model
	performance = await predictor.train_model(historical_opportunities)
	
	# Test prediction
	test_features = PredictionFeatures(
		opportunity_value=3500000.0,
		submission_days_remaining=25,
		requirements_complexity=0.7,
		capability_match_score=0.8,
		past_performance_score=0.9,
		team_experience_score=0.85,
		competitive_intensity=0.5,
		incumbent_advantage=False,
		estimated_competitors=4,
		market_familiarity=0.7,
		industry_experience_years=12,
		client_relationship_score=0.6,
		strategic_importance=0.8,
		resource_availability=0.9,
		pricing_competitiveness=0.7
	)
	
	prediction = await predictor.predict_win_probability(test_features, "test_opportunity_001")
	
	return prediction, performance, predictor.get_prediction_statistics()


if __name__ == "__main__":
	# Test the win probability predictor
	import asyncio
	
	async def main():
		prediction, performance, stats = await create_sample_win_probability_prediction()
		
		logger.info(f"Win Probability Prediction Results:")
		logger.info(f"  Opportunity ID: {prediction.opportunity_id}")
		logger.info(f"  Predicted Win Probability: {prediction.predicted_win_probability:.3f}")
		logger.info(f"  Confidence Interval: {prediction.confidence_interval[0]:.3f} - {prediction.confidence_interval[1]:.3f}")
		logger.info(f"  Model Used: {prediction.model_used}")
		logger.info(f"  Prediction Confidence: {prediction.prediction_confidence:.3f}")
		print()
		logger.info(f"Top Positive Factors:")
		for factor, impact in prediction.top_positive_factors[:3]:
			logger.info(f"  - {factor}: {impact:.3f}")
		print()
		logger.info(f"Improvement Recommendations:")
		for rec in prediction.improvement_recommendations[:3]:
			logger.info(f"  - {rec}")
		print()
		logger.info(f"Model Performance (Primary: {list(performance.keys())[0] if performance else 'None'}):")
		if performance:
			perf = list(performance.values())[0]
			logger.info(f"  Accuracy: {perf.accuracy:.3f}")
			logger.info(f"  F1 Score: {perf.f1_score:.3f}")
		
	asyncio.run(main())