"""
Scoring Predictor

This module provides machine learning-based prediction of section-level scores
for proposal sections using ensemble models with comprehensive feature engineering
and performance optimization for competitive proposal development.
"""

import asyncio
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum

import joblib
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import cross_val_score, train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb
from pydantic import BaseModel, Field, ConfigDict
from uuid import uuid4

from ...core.models.base import BaseEntity


class ProposalSection(str, Enum):
	"""Standard proposal section types"""
	
	TECHNICAL_APPROACH = "technical_approach"
	MANAGEMENT_APPROACH = "management_approach"
	PAST_PERFORMANCE = "past_performance"
	PERSONNEL_QUALIFICATIONS = "personnel_qualifications"
	CORPORATE_EXPERIENCE = "corporate_experience"
	UNDERSTANDING_OF_REQUIREMENTS = "understanding_of_requirements"
	PRICE_COST = "price_cost"
	SMALL_BUSINESS_UTILIZATION = "small_business_utilization"
	TRANSITION_APPROACH = "transition_approach"
	RISK_MANAGEMENT = "risk_management"


class SectionFeatures(BaseModel):
	"""Features for predicting section scores"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	# Content quality features
	word_count: int = Field(ge=0, description="Total word count for section")
	unique_concepts_count: int = Field(ge=0, description="Number of unique concepts/topics")
	technical_depth_score: float = Field(ge=0.0, le=1.0, description="Depth of technical detail")
	clarity_score: float = Field(ge=0.0, le=1.0, description="Writing clarity and coherence")
	
	# Requirements alignment
	requirement_coverage_ratio: float = Field(ge=0.0, le=1.0, description="Percentage of requirements addressed")
	compliance_score: float = Field(ge=0.0, le=1.0, description="Compliance with solicitation requirements")
	
	# Evidence and support
	quantitative_evidence_count: int = Field(ge=0, description="Number of quantitative supporting elements")
	case_study_relevance: float = Field(ge=0.0, le=1.0, description="Relevance of case studies/examples")
	reference_quality_score: float = Field(ge=0.0, le=1.0, description="Quality of references and citations")
	
	# Team and experience alignment
	team_expertise_match: float = Field(ge=0.0, le=1.0, description="Team expertise alignment with requirements")
	past_performance_relevance: float = Field(ge=0.0, le=1.0, description="Relevance of past performance")
	
	# Innovation and differentiation
	innovation_score: float = Field(ge=0.0, le=1.0, description="Level of innovative approaches")
	differentiation_strength: float = Field(ge=0.0, le=1.0, description="Strength of differentiators")
	
	# Risk mitigation
	risk_identification_completeness: float = Field(ge=0.0, le=1.0, description="Completeness of risk identification")
	mitigation_strategy_quality: float = Field(ge=0.0, le=1.0, description="Quality of mitigation strategies")
	
	# Section-specific factors
	section_completion_percentage: float = Field(ge=0.0, le=1.0, description="Percentage of section completed")


class SectionScorePrediction(BaseModel):
	"""Section score prediction result"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	prediction_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique prediction identifier")
	section_type: ProposalSection = Field(description="Type of proposal section")
	predicted_score: float = Field(ge=0.0, le=100.0, description="Predicted section score (0-100)")
	confidence_interval: Tuple[float, float] = Field(description="95% confidence interval for score")
	
	# Feature impact analysis
	top_positive_features: List[Tuple[str, float]] = Field(description="Features positively impacting score")
	top_negative_features: List[Tuple[str, float]] = Field(description="Features negatively impacting score")
	
	# Model information
	model_used: str = Field(description="ML model used for prediction")
	prediction_confidence: float = Field(ge=0.0, le=1.0, description="Confidence in the prediction")
	
	# Improvement recommendations
	improvement_suggestions: List[str] = Field(description="Specific suggestions to improve score")
	critical_gaps: List[str] = Field(description="Critical gaps that must be addressed")
	
	prediction_timestamp: datetime = Field(default_factory=datetime.now)


class SectionModelMetrics(BaseModel):
	"""Model performance metrics for section scoring"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	model_name: str = Field(description="Name of the ML model")
	section_type: ProposalSection = Field(description="Section type this model predicts")
	
	# Regression metrics
	mean_absolute_error: float = Field(description="Mean Absolute Error")
	mean_squared_error: float = Field(description="Mean Squared Error")
	r2_score: float = Field(description="R² score (coefficient of determination)")
	
	# Cross-validation metrics
	cv_mae_mean: float = Field(description="Mean cross-validation MAE")
	cv_mae_std: float = Field(description="Standard deviation of CV MAE")
	cv_r2_mean: float = Field(description="Mean cross-validation R²")
	cv_r2_std: float = Field(description="Standard deviation of CV R²")
	
	# Feature importance
	feature_importance: Dict[str, float] = Field(description="Feature importance scores")
	
	# Training information
	training_samples: int = Field(description="Number of training samples")
	last_trained: datetime = Field(default_factory=datetime.now)
	model_version: str = Field(description="Version of the trained model")


@dataclass
class HistoricalSectionScore:
	"""Historical section scoring data for model training"""
	
	section_id: str
	section_type: ProposalSection
	features: SectionFeatures
	actual_score: float  # Actual score received (0-100)
	evaluator_feedback: Optional[str] = None
	award_outcome: bool = False  # Whether the overall proposal won
	scoring_date: datetime = field(default_factory=datetime.now)


class ScoringPredictor:
	"""
	Machine learning-based section score predictor
	
	Uses ensemble models (Random Forest + Gradient Boosting + XGBoost) to predict
	section-level scores for proposals based on content analysis, requirements 
	alignment, and historical performance patterns.
	"""
	
	def __init__(self, model_cache_path: Optional[str] = None):
		# Section-specific models
		self.section_models: Dict[ProposalSection, Dict[str, Any]] = {}
		self.feature_scalers: Dict[ProposalSection, StandardScaler] = {}
		
		# Model selection for each section
		self.primary_models: Dict[ProposalSection, str] = {}
		self.model_cache_path = model_cache_path
		
		# Feature engineering
		self.feature_columns = [
			'word_count', 'unique_concepts_count', 'technical_depth_score', 'clarity_score',
			'requirement_coverage_ratio', 'compliance_score', 'quantitative_evidence_count',
			'case_study_relevance', 'reference_quality_score', 'team_expertise_match',
			'past_performance_relevance', 'innovation_score', 'differentiation_strength',
			'risk_identification_completeness', 'mitigation_strategy_quality', 'section_completion_percentage'
		]
		
		# Performance tracking
		self.model_performance: Dict[ProposalSection, Dict[str, SectionModelMetrics]] = {}
		self.prediction_history: List[SectionScorePrediction] = []
		
		# Training data
		self.training_data: Dict[ProposalSection, List[HistoricalSectionScore]] = {}
		self.is_trained: Dict[ProposalSection, bool] = {}
		
		self._log_initialization()
	
	async def train_section_models(self, historical_data: List[HistoricalSectionScore],
	                               test_size: float = 0.2, cross_val_folds: int = 5) -> Dict[ProposalSection, Dict[str, SectionModelMetrics]]:
		"""
		Train section-specific models on historical scoring data
		
		Args:
			historical_data: List of historical section scores with features
			test_size: Proportion of data to use for testing
			cross_val_folds: Number of cross-validation folds
			
		Returns:
			Performance metrics for all section models
		"""
		if len(historical_data) < 20:
			raise ValueError("Need at least 20 historical section scores for training")
		
		try:
			self._log_training_start(len(historical_data))
			
			# Group data by section type
			section_data = self._group_data_by_section(historical_data)
			
			# Train models for each section type
			training_tasks = []
			for section_type, section_scores in section_data.items():
				if len(section_scores) >= 10:  # Minimum samples per section
					training_tasks.append(
						self._train_section_specific_models(
							section_type, section_scores, test_size, cross_val_folds
						)
					)
			
			# Train all sections in parallel
			section_performances = await asyncio.gather(*training_tasks)
			
			# Consolidate results
			all_performance = {}
			for section_perf in section_performances:
				all_performance.update(section_perf)
			
			self._log_training_complete(all_performance)
			return all_performance
			
		except Exception as e:
			self._log_training_error(f"Section model training failed: {str(e)}")
			raise
	
	def _group_data_by_section(self, historical_data: List[HistoricalSectionScore]) -> Dict[ProposalSection, List[HistoricalSectionScore]]:
		"""Group historical data by section type"""
		
		section_groups: Dict[ProposalSection, List[HistoricalSectionScore]] = {}
		
		for score_data in historical_data:
			section_type = score_data.section_type
			if section_type not in section_groups:
				section_groups[section_type] = []
			section_groups[section_type].append(score_data)
		
		return section_groups
	
	async def _train_section_specific_models(self, section_type: ProposalSection, 
	                                         section_data: List[HistoricalSectionScore],
	                                         test_size: float, cv_folds: int) -> Dict[ProposalSection, Dict[str, SectionModelMetrics]]:
		"""Train models for a specific section type"""
		
		# Prepare training data
		X, y = self._prepare_section_training_data(section_data)
		
		# Split data
		X_train, X_test, y_train, y_test = train_test_split(
			X, y, test_size=test_size, random_state=42
		)
		
		# Initialize scaler for this section
		scaler = StandardScaler()
		X_train_scaled = scaler.fit_transform(X_train)
		X_test_scaled = scaler.transform(X_test)
		self.feature_scalers[section_type] = scaler
		
		# Train multiple models
		models = {}
		performance_metrics = {}
		
		# Random Forest Regressor
		rf_metrics = await self._train_random_forest_regressor(
			section_type, X_train_scaled, X_test_scaled, y_train, y_test, cv_folds
		)
		models['random_forest'] = rf_metrics
		performance_metrics['random_forest'] = rf_metrics
		
		# Gradient Boosting Regressor
		gb_metrics = await self._train_gradient_boosting_regressor(
			section_type, X_train_scaled, X_test_scaled, y_train, y_test, cv_folds
		)
		models['gradient_boosting'] = gb_metrics
		performance_metrics['gradient_boosting'] = gb_metrics
		
		# XGBoost Regressor
		xgb_metrics = await self._train_xgboost_regressor(
			section_type, X_train_scaled, X_test_scaled, y_train, y_test, cv_folds
		)
		models['xgboost'] = xgb_metrics
		performance_metrics['xgboost'] = xgb_metrics
		
		# Store models and select best
		self.section_models[section_type] = models
		self.model_performance[section_type] = performance_metrics
		self._select_primary_model_for_section(section_type)
		
		# Update training status
		self.training_data[section_type] = section_data
		self.is_trained[section_type] = True
		
		return {section_type: performance_metrics}
	
	async def _train_random_forest_regressor(self, section_type: ProposalSection,
	                                         X_train: np.ndarray, X_test: np.ndarray,
	                                         y_train: np.ndarray, y_test: np.ndarray,
	                                         cv_folds: int) -> SectionModelMetrics:
		"""Train Random Forest regressor for section scoring"""
		
		# Hyperparameter grid
		rf_param_grid = {
			'n_estimators': [100, 200, 300],
			'max_depth': [10, 20, None],
			'min_samples_split': [2, 5, 10],
			'min_samples_leaf': [1, 2, 4],
			'max_features': ['sqrt', 'log2', None]
		}
		
		# Grid search with cross-validation
		rf_grid_search = GridSearchCV(
			RandomForestRegressor(random_state=42),
			rf_param_grid,
			cv=cv_folds,
			scoring='neg_mean_absolute_error',
			n_jobs=-1
		)
		
		rf_grid_search.fit(X_train, y_train)
		
		# Store best model
		rf_model = rf_grid_search.best_estimator_
		if section_type not in self.section_models:
			self.section_models[section_type] = {}
		self.section_models[section_type]['rf_model'] = rf_model
		
		# Predictions
		y_pred = rf_model.predict(X_test)
		
		# Cross-validation scores
		cv_mae_scores = -cross_val_score(rf_model, X_train, y_train, cv=cv_folds, scoring='neg_mean_absolute_error')
		cv_r2_scores = cross_val_score(rf_model, X_train, y_train, cv=cv_folds, scoring='r2')
		
		# Feature importance
		feature_importance = dict(zip(self.feature_columns, rf_model.feature_importances_))
		
		return SectionModelMetrics(
			model_name="Random Forest",
			section_type=section_type,
			mean_absolute_error=mean_absolute_error(y_test, y_pred),
			mean_squared_error=mean_squared_error(y_test, y_pred),
			r2_score=r2_score(y_test, y_pred),
			cv_mae_mean=cv_mae_scores.mean(),
			cv_mae_std=cv_mae_scores.std(),
			cv_r2_mean=cv_r2_scores.mean(),
			cv_r2_std=cv_r2_scores.std(),
			feature_importance=feature_importance,
			training_samples=len(X_train),
			model_version="1.0"
		)
	
	async def _train_gradient_boosting_regressor(self, section_type: ProposalSection,
	                                             X_train: np.ndarray, X_test: np.ndarray,
	                                             y_train: np.ndarray, y_test: np.ndarray,
	                                             cv_folds: int) -> SectionModelMetrics:
		"""Train Gradient Boosting regressor for section scoring"""
		
		# Hyperparameter grid
		gb_param_grid = {
			'n_estimators': [100, 200],
			'max_depth': [3, 5, 7],
			'learning_rate': [0.01, 0.1, 0.2],
			'subsample': [0.8, 1.0]
		}
		
		# Grid search with cross-validation
		gb_grid_search = GridSearchCV(
			GradientBoostingRegressor(random_state=42),
			gb_param_grid,
			cv=cv_folds,
			scoring='neg_mean_absolute_error',
			n_jobs=-1
		)
		
		gb_grid_search.fit(X_train, y_train)
		
		# Store best model
		gb_model = gb_grid_search.best_estimator_
		self.section_models[section_type]['gb_model'] = gb_model
		
		# Predictions
		y_pred = gb_model.predict(X_test)
		
		# Cross-validation scores
		cv_mae_scores = -cross_val_score(gb_model, X_train, y_train, cv=cv_folds, scoring='neg_mean_absolute_error')
		cv_r2_scores = cross_val_score(gb_model, X_train, y_train, cv=cv_folds, scoring='r2')
		
		# Feature importance
		feature_importance = dict(zip(self.feature_columns, gb_model.feature_importances_))
		
		return SectionModelMetrics(
			model_name="Gradient Boosting",
			section_type=section_type,
			mean_absolute_error=mean_absolute_error(y_test, y_pred),
			mean_squared_error=mean_squared_error(y_test, y_pred),
			r2_score=r2_score(y_test, y_pred),
			cv_mae_mean=cv_mae_scores.mean(),
			cv_mae_std=cv_mae_scores.std(),
			cv_r2_mean=cv_r2_scores.mean(),
			cv_r2_std=cv_r2_scores.std(),
			feature_importance=feature_importance,
			training_samples=len(X_train),
			model_version="1.0"
		)
	
	async def _train_xgboost_regressor(self, section_type: ProposalSection,
	                                   X_train: np.ndarray, X_test: np.ndarray,
	                                   y_train: np.ndarray, y_test: np.ndarray,
	                                   cv_folds: int) -> SectionModelMetrics:
		"""Train XGBoost regressor for section scoring"""
		
		# Hyperparameter grid
		xgb_param_grid = {
			'n_estimators': [100, 200, 300],
			'max_depth': [3, 6, 10],
			'learning_rate': [0.01, 0.1, 0.2],
			'subsample': [0.8, 1.0],
			'colsample_bytree': [0.8, 1.0]
		}
		
		# Grid search with cross-validation
		xgb_grid_search = GridSearchCV(
			xgb.XGBRegressor(random_state=42),
			xgb_param_grid,
			cv=cv_folds,
			scoring='neg_mean_absolute_error',
			n_jobs=-1
		)
		
		xgb_grid_search.fit(X_train, y_train)
		
		# Store best model
		xgb_model = xgb_grid_search.best_estimator_
		self.section_models[section_type]['xgb_model'] = xgb_model
		
		# Predictions
		y_pred = xgb_model.predict(X_test)
		
		# Cross-validation scores
		cv_mae_scores = -cross_val_score(xgb_model, X_train, y_train, cv=cv_folds, scoring='neg_mean_absolute_error')
		cv_r2_scores = cross_val_score(xgb_model, X_train, y_train, cv=cv_folds, scoring='r2')
		
		# Feature importance
		feature_importance = dict(zip(self.feature_columns, xgb_model.feature_importances_))
		
		return SectionModelMetrics(
			model_name="XGBoost",
			section_type=section_type,
			mean_absolute_error=mean_absolute_error(y_test, y_pred),
			mean_squared_error=mean_squared_error(y_test, y_pred),
			r2_score=r2_score(y_test, y_pred),
			cv_mae_mean=cv_mae_scores.mean(),
			cv_mae_std=cv_mae_scores.std(),
			cv_r2_mean=cv_r2_scores.mean(),
			cv_r2_std=cv_r2_scores.std(),
			feature_importance=feature_importance,
			training_samples=len(X_train),
			model_version="1.0"
		)
	
	def _prepare_section_training_data(self, section_data: List[HistoricalSectionScore]) -> Tuple[np.ndarray, np.ndarray]:
		"""Prepare training data from historical section scores"""
		
		features_list = []
		scores = []
		
		for section_score in section_data:
			# Convert features to array
			feature_dict = section_score.features.model_dump()
			
			# Extract features in correct order
			feature_vector = [feature_dict[col] for col in self.feature_columns]
			features_list.append(feature_vector)
			
			# Score (0-100)
			scores.append(section_score.actual_score)
		
		X = np.array(features_list)
		y = np.array(scores)
		
		return X, y
	
	def _select_primary_model_for_section(self, section_type: ProposalSection):
		"""Select the best performing model for a section"""
		
		if section_type not in self.model_performance:
			return
		
		models = self.model_performance[section_type]
		
		# Compare models by R² score (higher is better for regression)
		best_model = 'random_forest'
		best_r2 = -float('inf')
		
		for model_name, metrics in models.items():
			if metrics.r2_score > best_r2:
				best_r2 = metrics.r2_score
				best_model = model_name.replace('_', '_').replace('random_forest', 'rf').replace('gradient_boosting', 'gb').replace('xgboost', 'xgb')
		
		self.primary_models[section_type] = best_model
	
	async def predict_section_score(self, features: SectionFeatures, 
	                                section_type: ProposalSection) -> SectionScorePrediction:
		"""
		Predict score for a proposal section
		
		Args:
			features: Section features for prediction
			section_type: Type of section to predict score for
			
		Returns:
			Section score prediction with insights
		"""
		if section_type not in self.is_trained or not self.is_trained[section_type]:
			raise ValueError(f"Model for {section_type} must be trained before making predictions")
		
		try:
			# Prepare feature vector
			feature_dict = features.model_dump()
			feature_vector = np.array([feature_dict[col] for col in self.feature_columns]).reshape(1, -1)
			
			# Scale features
			scaler = self.feature_scalers[section_type]
			feature_vector_scaled = scaler.transform(feature_vector)
			
			# Get model and make prediction
			primary_model_key = self.primary_models[section_type]
			model_key = f"{primary_model_key.replace('rf', 'random_forest').replace('gb', 'gradient_boosting').replace('xgb', 'xgboost')}_model"
			model = self.section_models[section_type][model_key]
			
			predicted_score = float(model.predict(feature_vector_scaled)[0])
			predicted_score = max(0.0, min(100.0, predicted_score))  # Clamp to valid range
			
			# Calculate confidence interval
			prediction_confidence = self._calculate_section_prediction_confidence(
				feature_vector_scaled, model, section_type
			)
			confidence_margin = 10.0 * (1 - prediction_confidence)  # Score range based on confidence
			
			confidence_interval = (
				max(0.0, predicted_score - confidence_margin),
				min(100.0, predicted_score + confidence_margin)
			)
			
			# Feature importance analysis
			top_positive, top_negative = self._analyze_section_feature_impact(
				feature_dict, model.feature_importances_, section_type
			)
			
			# Generate improvement suggestions
			suggestions = self._generate_section_improvement_suggestions(
				feature_dict, top_negative, section_type, predicted_score
			)
			critical_gaps = self._identify_critical_gaps(feature_dict, section_type)
			
			result = SectionScorePrediction(
				section_type=section_type,
				predicted_score=predicted_score,
				confidence_interval=confidence_interval,
				top_positive_features=top_positive,
				top_negative_features=top_negative,
				model_used=self.primary_models[section_type],
				prediction_confidence=prediction_confidence,
				improvement_suggestions=suggestions,
				critical_gaps=critical_gaps
			)
			
			# Store prediction history
			self.prediction_history.append(result)
			
			self._log_section_prediction_complete(section_type, predicted_score, prediction_confidence)
			
			return result
			
		except Exception as e:
			self._log_section_prediction_error(f"Section score prediction failed for {section_type}: {str(e)}")
			raise
	
	def _calculate_section_prediction_confidence(self, feature_vector: np.ndarray, 
	                                             model, section_type: ProposalSection) -> float:
		"""Calculate confidence in section score prediction"""
		
		# For regression, confidence is based on prediction variance
		# Use ensemble of predictions if available
		predictions = []
		
		for model_name in ['rf_model', 'gb_model', 'xgb_model']:
			if model_name in self.section_models[section_type]:
				pred = self.section_models[section_type][model_name].predict(feature_vector)[0]
				predictions.append(pred)
		
		if len(predictions) > 1:
			# Confidence based on prediction consistency
			prediction_std = np.std(predictions)
			# Normalize by typical score range (0-100)
			confidence = 1.0 - min(prediction_std / 25.0, 1.0)  # Higher std = lower confidence
		else:
			# Single model confidence (simplified)
			confidence = 0.7  # Default confidence for single model
		
		return confidence
	
	def _analyze_section_feature_impact(self, feature_dict: Dict[str, Any],
	                                    feature_importances: np.ndarray,
	                                    section_type: ProposalSection) -> Tuple[List[Tuple[str, float]], List[Tuple[str, float]]]:
		"""Analyze which features positively and negatively impact section score"""
		
		feature_analysis = []
		
		for i, feature_name in enumerate(self.feature_columns):
			importance = feature_importances[i]
			value = feature_dict[feature_name]
			
			# For regression, higher feature values generally mean higher impact
			# Normalize impact by feature value and importance
			if feature_name in ['word_count', 'unique_concepts_count', 'quantitative_evidence_count']:
				# Count-based features: impact scales with value
				normalized_value = min(value / 1000.0, 1.0) if feature_name == 'word_count' else min(value / 10.0, 1.0)
				impact = importance * normalized_value
			else:
				# Score-based features (0-1): direct impact
				impact = importance * value
			
			feature_analysis.append((feature_name.replace('_', ' ').title(), impact))
		
		# Sort by impact magnitude
		feature_analysis.sort(key=lambda x: abs(x[1]), reverse=True)
		
		# Split into positive and negative factors
		positive_factors = [(name, impact) for name, impact in feature_analysis if impact > 0.1][:5]
		negative_factors = [(name, abs(impact)) for name, impact in feature_analysis if impact <= 0.1][:5]
		
		return positive_factors, negative_factors
	
	def _generate_section_improvement_suggestions(self, feature_dict: Dict[str, Any],
	                                              negative_factors: List[Tuple[str, float]],
	                                              section_type: ProposalSection,
	                                              predicted_score: float) -> List[str]:
		"""Generate specific improvement suggestions for section"""
		
		suggestions = []
		
		# Section-specific suggestions
		if section_type == ProposalSection.TECHNICAL_APPROACH:
			if feature_dict['technical_depth_score'] < 0.7:
				suggestions.append("Increase technical depth with detailed methodologies and implementation specifics")
			if feature_dict['innovation_score'] < 0.6:
				suggestions.append("Highlight innovative approaches and unique technical solutions")
		
		elif section_type == ProposalSection.MANAGEMENT_APPROACH:
			if feature_dict['risk_identification_completeness'] < 0.7:
				suggestions.append("Provide more comprehensive risk identification and mitigation strategies")
			if feature_dict['team_expertise_match'] < 0.8:
				suggestions.append("Better align team roles with required expertise and qualifications")
		
		elif section_type == ProposalSection.PAST_PERFORMANCE:
			if feature_dict['case_study_relevance'] < 0.7:
				suggestions.append("Include more relevant and directly applicable past performance examples")
			if feature_dict['quantitative_evidence_count'] < 5:
				suggestions.append("Add quantitative metrics and outcomes from past performance")
		
		# General suggestions based on low-scoring features
		if feature_dict['requirement_coverage_ratio'] < 0.8:
			suggestions.append("Ensure all solicitation requirements are explicitly addressed")
		
		if feature_dict['compliance_score'] < 0.9:
			suggestions.append("Review compliance with all mandatory requirements and instructions")
		
		if feature_dict['clarity_score'] < 0.7:
			suggestions.append("Improve writing clarity and coherence for better readability")
		
		if predicted_score < 70:
			suggestions.append("Consider significant content revision - predicted score below competitive threshold")
		
		return suggestions[:6]
	
	def _identify_critical_gaps(self, feature_dict: Dict[str, Any], 
	                            section_type: ProposalSection) -> List[str]:
		"""Identify critical gaps that must be addressed"""
		
		gaps = []
		
		# Universal critical gaps
		if feature_dict['compliance_score'] < 0.8:
			gaps.append("Critical compliance gaps - must address all mandatory requirements")
		
		if feature_dict['requirement_coverage_ratio'] < 0.7:
			gaps.append("Insufficient requirement coverage - major gaps in addressing solicitation needs")
		
		if feature_dict['section_completion_percentage'] < 0.8:
			gaps.append("Section appears incomplete - requires substantial additional content")
		
		# Section-specific critical gaps
		if section_type == ProposalSection.TECHNICAL_APPROACH:
			if feature_dict['technical_depth_score'] < 0.5:
				gaps.append("Insufficient technical depth - lacks detailed implementation approach")
		
		elif section_type == ProposalSection.PAST_PERFORMANCE:
			if feature_dict['past_performance_relevance'] < 0.6:
				gaps.append("Past performance examples lack relevance to current requirements")
		
		elif section_type == ProposalSection.PERSONNEL_QUALIFICATIONS:
			if feature_dict['team_expertise_match'] < 0.6:
				gaps.append("Team qualifications do not adequately match position requirements")
		
		return gaps[:4]
	
	def get_section_model_performance(self, section_type: ProposalSection) -> Dict[str, SectionModelMetrics]:
		"""Get model performance metrics for a specific section"""
		return self.model_performance.get(section_type, {}).copy()
	
	def get_all_section_performance(self) -> Dict[ProposalSection, Dict[str, SectionModelMetrics]]:
		"""Get performance metrics for all trained section models"""
		return self.model_performance.copy()
	
	def get_section_prediction_statistics(self, section_type: Optional[ProposalSection] = None) -> Dict[str, Any]:
		"""Get prediction statistics for section(s)"""
		
		if section_type:
			section_predictions = [p for p in self.prediction_history if p.section_type == section_type]
			section_name = section_type.value
		else:
			section_predictions = self.prediction_history
			section_name = "all_sections"
		
		if not section_predictions:
			return {f"{section_name}_predictions": 0}
		
		scores = [p.predicted_score for p in section_predictions]
		confidences = [p.prediction_confidence for p in section_predictions]
		
		return {
			f"{section_name}_predictions": len(section_predictions),
			f"{section_name}_average_score": np.mean(scores),
			f"{section_name}_score_distribution": {
				"excellent (90-100)": sum(1 for s in scores if s >= 90),
				"good (80-89)": sum(1 for s in scores if 80 <= s < 90),
				"acceptable (70-79)": sum(1 for s in scores if 70 <= s < 80),
				"needs_improvement (<70)": sum(1 for s in scores if s < 70)
			},
			f"{section_name}_average_confidence": np.mean(confidences),
			"trained_sections": [section.value for section in self.is_trained.keys() if self.is_trained[section]]
		}
	
	# Logging methods

	def _log_initialization(self):
		import logging
		logger = logging.getLogger(__name__)
		logger.info("ScoringPredictor: Initialized with ensemble models for section-level score prediction")

	def _log_training_start(self, data_size: int):
		import logging
		logger = logging.getLogger(__name__)
		logger.info(f"ScoringPredictor: Starting training with {data_size} historical section scores")

	def _log_training_complete(self, performance: Dict[ProposalSection, Dict[str, SectionModelMetrics]]):
		import logging
		logger = logging.getLogger(__name__)
		logger.info(f"ScoringPredictor: Training complete for {len(performance)} section types")
		for section_type, metrics in performance.items():
			best_model = min(metrics.items(), key=lambda x: x[1].mean_absolute_error)
			logger.info(f"  {section_type.value}: Best model {best_model[0]} (MAE: {best_model[1].mean_absolute_error:.2f})")

	def _log_training_error(self, message: str):
		import logging
		logger = logging.getLogger(__name__)
		logger.error(f"ScoringPredictor Training Error: {message}")

	def _log_section_prediction_complete(self, section_type: ProposalSection, score: float, confidence: float):
		import logging
		logger = logging.getLogger(__name__)
		logger.info(f"ScoringPredictor: Predicted {score:.1f} score for {section_type.value} (confidence: {confidence:.3f})")

	def _log_section_prediction_error(self, message: str):
		import logging
		logger = logging.getLogger(__name__)
		logger.error(f"ScoringPredictor Prediction Error: {message}")


# Example usage and testing
async def create_sample_section_scoring_prediction():
	"""Create sample section scoring prediction for testing"""
	
	# Initialize predictor
	predictor = ScoringPredictor()
	
	# Create sample historical section data
	historical_scores = []
	
	# Generate sample data for multiple section types
	section_types = [ProposalSection.TECHNICAL_APPROACH, ProposalSection.MANAGEMENT_APPROACH, ProposalSection.PAST_PERFORMANCE]
	
	for section_type in section_types:
		for i in range(30):  # 30 samples per section type
			features = SectionFeatures(
				word_count=1500 + (i * 100),
				unique_concepts_count=10 + (i % 20),
				technical_depth_score=0.4 + (i % 6) * 0.1,
				clarity_score=0.5 + (i % 5) * 0.1,
				requirement_coverage_ratio=0.6 + (i % 4) * 0.1,
				compliance_score=0.7 + (i % 3) * 0.1,
				quantitative_evidence_count=2 + (i % 8),
				case_study_relevance=0.4 + (i % 6) * 0.1,
				reference_quality_score=0.5 + (i % 5) * 0.1,
				team_expertise_match=0.6 + (i % 4) * 0.1,
				past_performance_relevance=0.5 + (i % 5) * 0.1,
				innovation_score=0.3 + (i % 7) * 0.1,
				differentiation_strength=0.4 + (i % 6) * 0.1,
				risk_identification_completeness=0.6 + (i % 4) * 0.1,
				mitigation_strategy_quality=0.5 + (i % 5) * 0.1,
				section_completion_percentage=0.8 + (i % 2) * 0.1
			)
			
			# Simulate score based on features (higher quality features = higher score)
			base_score = (features.technical_depth_score + features.clarity_score + 
			             features.requirement_coverage_ratio + features.compliance_score) * 25
			score = min(100, max(0, base_score + np.random.normal(0, 5)))  # Add some noise
			
			historical_scores.append(HistoricalSectionScore(
				section_id=f"{section_type.value}_{i:03d}",
				section_type=section_type,
				features=features,
				actual_score=score
			))
	
	# Train models
	performance = await predictor.train_section_models(historical_scores)
	
	# Test predictions
	test_features = SectionFeatures(
		word_count=2500,
		unique_concepts_count=15,
		technical_depth_score=0.8,
		clarity_score=0.9,
		requirement_coverage_ratio=0.85,
		compliance_score=0.95,
		quantitative_evidence_count=6,
		case_study_relevance=0.7,
		reference_quality_score=0.8,
		team_expertise_match=0.85,
		past_performance_relevance=0.8,
		innovation_score=0.7,
		differentiation_strength=0.75,
		risk_identification_completeness=0.9,
		mitigation_strategy_quality=0.85,
		section_completion_percentage=0.95
	)
	
	predictions = {}
	for section_type in section_types:
		prediction = await predictor.predict_section_score(test_features, section_type)
		predictions[section_type] = prediction
	
	return predictions, performance, predictor.get_section_prediction_statistics()


if __name__ == "__main__":
	# Test the section scoring predictor
	import asyncio
	
	async def main():
		predictions, performance, stats = await create_sample_section_scoring_prediction()
		
		print("Section Score Prediction Results:")
		print("=" * 50)
		
		for section_type, prediction in predictions.items():
			print(f"\n📊 {section_type.value.replace('_', ' ').title()}:")
			print(f"  Predicted Score: {prediction.predicted_score:.1f}/100")
			print(f"  Confidence Interval: {prediction.confidence_interval[0]:.1f} - {prediction.confidence_interval[1]:.1f}")
			print(f"  Model Used: {prediction.model_used}")
			print(f"  Prediction Confidence: {prediction.prediction_confidence:.3f}")
			
			print(f"\n  Top Positive Features:")
			for factor, impact in prediction.top_positive_features[:3]:
				print(f"    ✅ {factor}: {impact:.3f}")
			
			print(f"\n  Improvement Suggestions:")
			for suggestion in prediction.improvement_suggestions[:2]:
				print(f"    💡 {suggestion}")
		
		print(f"\nModel Performance Summary:")
		for section_type, section_performance in performance.items():
			best_model = min(section_performance.items(), key=lambda x: x[1].mean_absolute_error)
			print(f"  {section_type.value}: {best_model[0]} (MAE: {best_model[1].mean_absolute_error:.2f})")
	
	asyncio.run(main())