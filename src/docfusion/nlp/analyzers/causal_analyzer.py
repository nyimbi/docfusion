#!/usr/bin/env python3
"""
Causal Analysis Module using Established Statistical Libraries

Advanced causal inference analysis using scipy, statsmodels, and pandas
for discovering causal relationships in proposal data and content performance.
Uses established statistical methods rather than reinventing the wheel.
"""

import asyncio
import json
import logging
import warnings
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd

# Statistical libraries for causal analysis
try:
    import scipy.stats as stats
    from scipy.stats import chi2_contingency, pearsonr, spearmanr

    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

try:
    import statsmodels.api as sm
    from statsmodels.regression.linear_model import OLS
    from statsmodels.stats.diagnostic import acorr_ljungbox
    from statsmodels.stats.outliers_influence import variance_inflation_factor
    from statsmodels.stats.stattools import durbin_watson
    from statsmodels.tsa.stattools import grangercausalitytests

    HAS_STATSMODELS = True
except ImportError:
    HAS_STATSMODELS = False

try:
    from uuid_extensions import uuid7str
except ImportError:
    from uuid import uuid4

    def uuid7str() -> str:
        return str(uuid4())


class CausalityType(str, Enum):
    """Types of causal relationships"""

    CORRELATION = "correlation"
    GRANGER_CAUSALITY = "granger_causality"
    INSTRUMENTAL_VARIABLE = "instrumental_variable"
    DIFFERENCE_IN_DIFFERENCES = "difference_in_differences"
    REGRESSION_DISCONTINUITY = "regression_discontinuity"
    PROPENSITY_SCORE_MATCHING = "propensity_score_matching"
    STRUCTURAL_EQUATION = "structural_equation"


class CausalStrength(str, Enum):
    """Strength of causal evidence"""

    VERY_WEAK = "very_weak"  # p > 0.1
    WEAK = "weak"  # 0.05 < p <= 0.1
    MODERATE = "moderate"  # 0.01 < p <= 0.05
    STRONG = "strong"  # 0.001 < p <= 0.01
    VERY_STRONG = "very_strong"  # p <= 0.001


class ConfidenceLevel(str, Enum):
    """Statistical confidence levels"""

    LOW = "90%"  # α = 0.1
    MEDIUM = "95%"  # α = 0.05
    HIGH = "99%"  # α = 0.01
    VERY_HIGH = "99.9%"  # α = 0.001


@dataclass
class CausalRelationship:
    """Represents a discovered causal relationship"""

    id: str = field(default_factory=uuid7str)

    # Relationship details
    cause_variable: str = ""
    effect_variable: str = ""
    causality_type: CausalityType = CausalityType.CORRELATION

    # Statistical evidence
    test_statistic: float = 0.0
    p_value: float = 1.0
    confidence_interval: Tuple[float, float] = (0.0, 0.0)
    effect_size: float = 0.0
    causal_strength: CausalStrength = CausalStrength.VERY_WEAK

    # Interpretation
    direction: str = "positive"  # positive, negative, non_linear
    interpretation: str = ""
    practical_significance: bool = False

    # Quality assessment
    assumptions_met: List[str] = field(default_factory=list)
    violations: List[str] = field(default_factory=list)
    robustness_score: float = 0.0

    # Context
    sample_size: int = 0
    data_quality: str = "unknown"
    temporal_ordering: bool = False


@dataclass
class CausalModel:
    """Represents a causal model with multiple relationships"""

    id: str = field(default_factory=uuid7str)

    # Model specification
    model_type: str = "linear_regression"
    outcome_variable: str = ""
    treatment_variables: List[str] = field(default_factory=list)
    control_variables: List[str] = field(default_factory=list)

    # Model results
    relationships: List[CausalRelationship] = field(default_factory=list)
    model_fit: Dict[str, float] = field(default_factory=dict)  # R², AIC, BIC

    # Diagnostic tests
    heteroscedasticity_test: Optional[Dict[str, Any]] = None
    multicollinearity_test: Optional[Dict[str, Any]] = None
    autocorrelation_test: Optional[Dict[str, Any]] = None
    normality_test: Optional[Dict[str, Any]] = None

    # Robustness checks
    robustness_tests: List[Dict[str, Any]] = field(default_factory=list)
    sensitivity_analysis: Optional[Dict[str, Any]] = None


@dataclass
class CausalAnalysisResult:
    """Comprehensive causal analysis result"""

    success: bool = False
    analysis_id: str = field(default_factory=uuid7str)

    # Analysis configuration
    variables_analyzed: List[str] = field(default_factory=list)
    causality_methods: List[CausalityType] = field(default_factory=list)
    confidence_level: ConfidenceLevel = ConfidenceLevel.MEDIUM

    # Results
    causal_relationships: List[CausalRelationship] = field(default_factory=list)
    causal_models: List[CausalModel] = field(default_factory=list)

    # Summary statistics
    total_relationships: int = 0
    significant_relationships: int = 0
    strongest_relationship: Optional[CausalRelationship] = None

    # Insights and recommendations
    causal_insights: List[str] = field(default_factory=list)
    policy_implications: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)

    # Quality and limitations
    data_quality_score: float = 0.0
    assumption_violations: List[str] = field(default_factory=list)
    limitations: List[str] = field(default_factory=list)

    # Processing metadata
    processing_time: float = 0.0
    sample_size: int = 0
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    statistics: Dict[str, Any] = field(default_factory=dict)


class CausalAnalyzer:
    """Advanced causal analysis using established statistical libraries"""

    def __init__(
        self,
        confidence_level: ConfidenceLevel = ConfidenceLevel.MEDIUM,
        min_sample_size: int = 30,
        effect_size_threshold: float = 0.1,
        enable_robustness_checks: bool = True,
        max_lag_order: int = 4,
    ):
        self.confidence_level = confidence_level
        self.min_sample_size = min_sample_size
        self.effect_size_threshold = effect_size_threshold
        self.enable_robustness_checks = enable_robustness_checks
        self.max_lag_order = max_lag_order
        self.logger = logging.getLogger(__name__)

        # Statistical significance levels
        self.alpha_levels = {
            ConfidenceLevel.LOW: 0.1,
            ConfidenceLevel.MEDIUM: 0.05,
            ConfidenceLevel.HIGH: 0.01,
            ConfidenceLevel.VERY_HIGH: 0.001,
        }

        # Suppress warnings for cleaner output
        warnings.filterwarnings("ignore", category=UserWarning)

        if not HAS_SCIPY or not HAS_STATSMODELS:
            self.logger.warning(
                "Some causal analysis libraries not available. Install scipy and statsmodels for full functionality."
            )

        self.logger.info(
            f"CausalAnalyzer initialized with {confidence_level.value} confidence level"
        )

    async def analyze_causality(
        self,
        data: Union[pd.DataFrame, Dict[str, List[float]]],
        treatment_variables: List[str],
        outcome_variables: List[str],
        control_variables: Optional[List[str]] = None,
        methods: Optional[List[CausalityType]] = None,
    ) -> CausalAnalysisResult:
        """Perform comprehensive causal analysis"""
        start_time = asyncio.get_event_loop().time()
        result = CausalAnalysisResult()

        try:
            # Convert data to DataFrame if needed
            if isinstance(data, dict):
                df = pd.DataFrame(data)
            else:
                df = data.copy()

            result.sample_size = len(df)
            result.variables_analyzed = list(df.columns)

            # Validate data quality
            data_quality = await self._assess_data_quality(df)
            result.data_quality_score = data_quality["overall_score"]
            if data_quality["issues"]:
                result.warnings.extend(data_quality["issues"])

            # Default methods if not specified
            if methods is None:
                methods = [
                    CausalityType.CORRELATION,
                    CausalityType.GRANGER_CAUSALITY,
                    CausalityType.INSTRUMENTAL_VARIABLE,
                ]
            result.causality_methods = methods

            # Perform causal analysis for each method
            if CausalityType.CORRELATION in methods:
                correlations = await self._analyze_correlations(
                    df, treatment_variables, outcome_variables
                )
                result.causal_relationships.extend(correlations)

            if CausalityType.GRANGER_CAUSALITY in methods and HAS_STATSMODELS:
                granger_results = await self._analyze_granger_causality(
                    df, treatment_variables, outcome_variables
                )
                result.causal_relationships.extend(granger_results)

            if CausalityType.INSTRUMENTAL_VARIABLE in methods:
                iv_results = await self._analyze_instrumental_variables(
                    df, treatment_variables, outcome_variables, control_variables
                )
                result.causal_relationships.extend(iv_results)

            # Build causal models
            models = await self._build_causal_models(
                df, treatment_variables, outcome_variables, control_variables
            )
            result.causal_models.extend(models)

            # Generate insights and recommendations
            result.causal_insights = await self._generate_causal_insights(
                result.causal_relationships
            )
            result.recommendations = await self._generate_recommendations(
                result.causal_relationships, result.causal_models
            )

            # Calculate summary statistics
            result.total_relationships = len(result.causal_relationships)
            result.significant_relationships = len(
                [
                    r
                    for r in result.causal_relationships
                    if r.p_value < self.alpha_levels[self.confidence_level]
                ]
            )

            # Find strongest relationship
            if result.causal_relationships:
                result.strongest_relationship = min(
                    result.causal_relationships, key=lambda x: x.p_value
                )

            result.processing_time = asyncio.get_event_loop().time() - start_time
            result.success = len(result.errors) == 0

            self.logger.info(
                f"Causal analysis completed: {result.significant_relationships}/{result.total_relationships} significant relationships found"
            )

        except Exception as e:
            result.errors.append(f"Causal analysis failed: {str(e)}")
            self.logger.error(f"Causal analysis error: {e}")

        return result

    async def _assess_data_quality(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Assess data quality for causal analysis"""
        quality_assessment = {
            "overall_score": 1.0,
            "issues": [],
            "sample_size": len(df),
            "missing_data_pct": 0.0,
            "outlier_pct": 0.0,
        }

        # Check sample size
        if len(df) < self.min_sample_size:
            quality_assessment["issues"].append(
                f"Sample size ({len(df)}) below recommended minimum ({self.min_sample_size})"
            )
            quality_assessment["overall_score"] *= 0.7

        # Check for missing data
        missing_pct = df.isnull().sum().sum() / (len(df) * len(df.columns))
        quality_assessment["missing_data_pct"] = missing_pct
        if missing_pct > 0.1:
            quality_assessment["issues"].append(
                f"High missing data rate: {missing_pct:.1%}"
            )
            quality_assessment["overall_score"] *= 1 - missing_pct

        # Check for outliers using IQR method
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        outlier_counts = 0
        for col in numeric_cols:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            outliers = df[(df[col] < Q1 - 1.5 * IQR) | (df[col] > Q3 + 1.5 * IQR)][col]
            outlier_counts += len(outliers)

        outlier_pct = (
            outlier_counts / (len(df) * len(numeric_cols))
            if len(numeric_cols) > 0
            else 0
        )
        quality_assessment["outlier_pct"] = outlier_pct
        if outlier_pct > 0.05:
            quality_assessment["issues"].append(f"High outlier rate: {outlier_pct:.1%}")
            quality_assessment["overall_score"] *= 0.9

        return quality_assessment

    async def _analyze_correlations(
        self, df: pd.DataFrame, treatment_vars: List[str], outcome_vars: List[str]
    ) -> List[CausalRelationship]:
        """Analyze correlational relationships using scipy"""
        relationships = []

        if not HAS_SCIPY:
            return relationships

        for treatment in treatment_vars:
            for outcome in outcome_vars:
                if treatment in df.columns and outcome in df.columns:
                    # Remove missing values
                    clean_data = df[[treatment, outcome]].dropna()
                    if len(clean_data) < self.min_sample_size:
                        continue

                    x = clean_data[treatment]
                    y = clean_data[outcome]

                    # Pearson correlation
                    try:
                        corr_coef, p_value = pearsonr(x, y)

                        relationship = CausalRelationship(
                            cause_variable=treatment,
                            effect_variable=outcome,
                            causality_type=CausalityType.CORRELATION,
                            test_statistic=corr_coef,
                            p_value=p_value,
                            effect_size=abs(corr_coef),
                            direction="positive" if corr_coef > 0 else "negative",
                            sample_size=len(clean_data),
                            causal_strength=self._determine_causal_strength(p_value),
                            practical_significance=abs(corr_coef)
                            > self.effect_size_threshold,
                            interpretation=f"Pearson correlation: {corr_coef:.3f}",
                        )

                        # Calculate confidence interval
                        if len(clean_data) > 3:
                            se = np.sqrt((1 - corr_coef**2) / (len(clean_data) - 2))
                            t_crit = stats.t.ppf(
                                1 - self.alpha_levels[self.confidence_level] / 2,
                                len(clean_data) - 2,
                            )
                            margin_error = t_crit * se
                            relationship.confidence_interval = (
                                corr_coef - margin_error,
                                corr_coef + margin_error,
                            )

                        relationships.append(relationship)

                    except Exception as e:
                        self.logger.warning(
                            f"Correlation analysis failed for {treatment}->{outcome}: {e}"
                        )

        return relationships

    async def _analyze_granger_causality(
        self, df: pd.DataFrame, treatment_vars: List[str], outcome_vars: List[str]
    ) -> List[CausalRelationship]:
        """Analyze Granger causality using statsmodels"""
        relationships = []

        if not HAS_STATSMODELS:
            return relationships

        for treatment in treatment_vars:
            for outcome in outcome_vars:
                if treatment in df.columns and outcome in df.columns:
                    try:
                        # Prepare data for Granger test
                        clean_data = df[[treatment, outcome]].dropna()
                        if len(clean_data) < self.min_sample_size + self.max_lag_order:
                            continue

                        # Granger causality test
                        test_data = np.column_stack(
                            [clean_data[outcome], clean_data[treatment]]
                        )
                        gc_results = grangercausalitytests(
                            test_data, maxlag=self.max_lag_order, verbose=False
                        )

                        # Extract results for optimal lag
                        best_lag = 1
                        best_p_value = 1.0
                        best_statistic = 0.0

                        for lag in range(
                            1, min(self.max_lag_order + 1, len(gc_results) + 1)
                        ):
                            if lag in gc_results:
                                ssr_ftest = gc_results[lag][0]["ssr_ftest"]
                                p_val = ssr_ftest[1]
                                if p_val < best_p_value:
                                    best_p_value = p_val
                                    best_statistic = ssr_ftest[0]
                                    best_lag = lag

                        relationship = CausalRelationship(
                            cause_variable=treatment,
                            effect_variable=outcome,
                            causality_type=CausalityType.GRANGER_CAUSALITY,
                            test_statistic=best_statistic,
                            p_value=best_p_value,
                            effect_size=1 - best_p_value,  # Proxy for effect size
                            direction="positive",  # Granger doesn't specify direction
                            sample_size=len(clean_data),
                            causal_strength=self._determine_causal_strength(
                                best_p_value
                            ),
                            practical_significance=best_p_value
                            < self.alpha_levels[self.confidence_level],
                            interpretation=f"Granger causality test (lag={best_lag}): F={best_statistic:.3f}",
                            temporal_ordering=True,
                        )

                        relationships.append(relationship)

                    except Exception as e:
                        self.logger.warning(
                            f"Granger causality test failed for {treatment}->{outcome}: {e}"
                        )

        return relationships

    async def _analyze_instrumental_variables(
        self,
        df: pd.DataFrame,
        treatment_vars: List[str],
        outcome_vars: List[str],
        control_vars: Optional[List[str]] = None,
    ) -> List[CausalRelationship]:
        """Analyze using instrumental variables approach"""
        relationships = []

        if not HAS_STATSMODELS or control_vars is None or len(control_vars) == 0:
            return relationships

        for treatment in treatment_vars:
            for outcome in outcome_vars:
                if treatment in df.columns and outcome in df.columns:
                    try:
                        # Simple 2SLS approach using available variables as instruments
                        clean_data = df[[treatment, outcome] + control_vars].dropna()
                        if len(clean_data) < self.min_sample_size:
                            continue

                        # First stage: regress treatment on instruments
                        X_instruments = clean_data[control_vars]
                        X_instruments = sm.add_constant(X_instruments)
                        first_stage = OLS(clean_data[treatment], X_instruments).fit()

                        # Check instrument relevance (F-stat > 10 rule of thumb)
                        f_stat = first_stage.fvalue
                        if f_stat < 10:
                            continue  # Weak instruments

                        # Second stage: regress outcome on predicted treatment
                        predicted_treatment = first_stage.fittedvalues
                        X_second = sm.add_constant(predicted_treatment)
                        second_stage = OLS(clean_data[outcome], X_second).fit()

                        # Extract coefficient for treatment effect
                        treatment_coef = second_stage.params.iloc[1]
                        p_value = second_stage.pvalues.iloc[1]

                        relationship = CausalRelationship(
                            cause_variable=treatment,
                            effect_variable=outcome,
                            causality_type=CausalityType.INSTRUMENTAL_VARIABLE,
                            test_statistic=second_stage.tvalues.iloc[1],
                            p_value=p_value,
                            effect_size=abs(treatment_coef),
                            direction="positive" if treatment_coef > 0 else "negative",
                            sample_size=len(clean_data),
                            causal_strength=self._determine_causal_strength(p_value),
                            practical_significance=p_value
                            < self.alpha_levels[self.confidence_level],
                            interpretation=f"IV estimate: {treatment_coef:.3f} (F-stat: {f_stat:.1f})",
                            assumptions_met=["instrument_relevance"]
                            if f_stat > 10
                            else [],
                            violations=[] if f_stat > 10 else ["weak_instruments"],
                        )

                        relationships.append(relationship)

                    except Exception as e:
                        self.logger.warning(
                            f"IV analysis failed for {treatment}->{outcome}: {e}"
                        )

        return relationships

    async def _build_causal_models(
        self,
        df: pd.DataFrame,
        treatment_vars: List[str],
        outcome_vars: List[str],
        control_vars: Optional[List[str]] = None,
    ) -> List[CausalModel]:
        """Build comprehensive causal models"""
        models = []

        if not HAS_STATSMODELS:
            return models

        for outcome in outcome_vars:
            if outcome not in df.columns:
                continue

            try:
                # Prepare variables
                all_predictors = treatment_vars.copy()
                if control_vars:
                    all_predictors.extend(control_vars)

                available_predictors = [
                    var for var in all_predictors if var in df.columns
                ]

                # Clean data
                model_vars = [outcome] + available_predictors
                clean_data = df[model_vars].dropna()

                if len(clean_data) < self.min_sample_size:
                    continue

                # Build regression model
                X = clean_data[available_predictors]
                X = sm.add_constant(X)
                y = clean_data[outcome]

                model = OLS(y, X).fit()

                # Create causal model object
                causal_model = CausalModel(
                    model_type="linear_regression",
                    outcome_variable=outcome,
                    treatment_variables=[
                        var for var in treatment_vars if var in available_predictors
                    ],
                    control_variables=[
                        var
                        for var in (control_vars or [])
                        if var in available_predictors
                    ],
                    model_fit={
                        "r_squared": model.rsquared,
                        "adj_r_squared": model.rsquared_adj,
                        "aic": model.aic,
                        "bic": model.bic,
                        "f_statistic": model.fvalue,
                        "f_pvalue": model.f_pvalue,
                    },
                )

                # Extract relationships from model
                for i, var in enumerate(available_predictors):
                    if i + 1 < len(model.params):  # Skip constant
                        coef = model.params.iloc[i + 1]
                        p_val = model.pvalues.iloc[i + 1]

                        relationship = CausalRelationship(
                            cause_variable=var,
                            effect_variable=outcome,
                            causality_type=CausalityType.STRUCTURAL_EQUATION,
                            test_statistic=model.tvalues.iloc[i + 1],
                            p_value=p_val,
                            effect_size=abs(coef),
                            direction="positive" if coef > 0 else "negative",
                            sample_size=len(clean_data),
                            causal_strength=self._determine_causal_strength(p_val),
                            practical_significance=p_val
                            < self.alpha_levels[self.confidence_level],
                            interpretation=f"Regression coefficient: {coef:.3f}",
                        )

                        causal_model.relationships.append(relationship)

                # Perform diagnostic tests
                if self.enable_robustness_checks:
                    causal_model.heteroscedasticity_test = (
                        self._test_heteroscedasticity(model)
                    )
                    causal_model.multicollinearity_test = self._test_multicollinearity(
                        X.iloc[:, 1:]
                    )  # Skip constant
                    causal_model.autocorrelation_test = self._test_autocorrelation(
                        model
                    )
                    causal_model.normality_test = self._test_normality(model.resid)

                models.append(causal_model)

            except Exception as e:
                self.logger.warning(f"Model building failed for outcome {outcome}: {e}")

        return models

    def _determine_causal_strength(self, p_value: float) -> CausalStrength:
        """Determine causal strength based on p-value"""
        if p_value <= 0.001:
            return CausalStrength.VERY_STRONG
        elif p_value <= 0.01:
            return CausalStrength.STRONG
        elif p_value <= 0.05:
            return CausalStrength.MODERATE
        elif p_value <= 0.1:
            return CausalStrength.WEAK
        else:
            return CausalStrength.VERY_WEAK

    def _test_heteroscedasticity(self, model) -> Dict[str, Any]:
        """Test for heteroscedasticity using Breusch-Pagan test"""
        try:
            from statsmodels.stats.diagnostic import het_breuschpagan

            bp_test = het_breuschpagan(model.resid, model.model.exog)
            return {
                "test_name": "Breusch-Pagan",
                "statistic": bp_test[0],
                "p_value": bp_test[1],
                "assumption_met": bp_test[1] > 0.05,
            }
        except Exception as e:
            return {"test_name": "Breusch-Pagan", "error": str(e)}

    def _test_multicollinearity(self, X: pd.DataFrame) -> Dict[str, Any]:
        """Test for multicollinearity using VIF"""
        try:
            vif_scores = {}
            for i in range(X.shape[1]):
                vif_scores[X.columns[i]] = variance_inflation_factor(X.values, i)

            max_vif = max(vif_scores.values()) if vif_scores else 1
            return {
                "test_name": "VIF",
                "vif_scores": vif_scores,
                "max_vif": max_vif,
                "assumption_met": max_vif < 5,
            }
        except Exception as e:
            return {"test_name": "VIF", "error": str(e)}

    def _test_autocorrelation(self, model) -> Dict[str, Any]:
        """Test for autocorrelation using Durbin-Watson test"""
        try:
            dw_stat = durbin_watson(model.resid)
            return {
                "test_name": "Durbin-Watson",
                "statistic": dw_stat,
                "assumption_met": 1.5 < dw_stat < 2.5,
            }
        except Exception as e:
            return {"test_name": "Durbin-Watson", "error": str(e)}

    def _test_normality(self, residuals) -> Dict[str, Any]:
        """Test for normality of residuals using Shapiro-Wilk test"""
        try:
            if len(residuals) > 5000:
                # Use Kolmogorov-Smirnov for large samples
                stat, p_val = stats.kstest(residuals, "norm")
                test_name = "Kolmogorov-Smirnov"
            else:
                stat, p_val = stats.shapiro(residuals)
                test_name = "Shapiro-Wilk"

            return {
                "test_name": test_name,
                "statistic": stat,
                "p_value": p_val,
                "assumption_met": p_val > 0.05,
            }
        except Exception as e:
            return {"test_name": "Normality", "error": str(e)}

    async def _generate_causal_insights(
        self, relationships: List[CausalRelationship]
    ) -> List[str]:
        """Generate actionable insights from causal relationships"""
        insights = []

        significant_relationships = [r for r in relationships if r.p_value < 0.05]

        if not significant_relationships:
            insights.append(
                "No statistically significant causal relationships detected at 95% confidence level"
            )
            return insights

        # Strongest relationships
        strong_relationships = [
            r
            for r in significant_relationships
            if r.causal_strength in [CausalStrength.STRONG, CausalStrength.VERY_STRONG]
        ]
        if strong_relationships:
            strongest = min(strong_relationships, key=lambda x: x.p_value)
            insights.append(
                f"Strongest causal relationship: {strongest.cause_variable} → {strongest.effect_variable} (p={strongest.p_value:.4f})"
            )

        # Effect sizes
        large_effects = [r for r in significant_relationships if r.effect_size > 0.5]
        if large_effects:
            insights.append(
                f"Found {len(large_effects)} relationships with large effect sizes (>0.5)"
            )

        # Positive vs negative effects
        positive_effects = [
            r for r in significant_relationships if r.direction == "positive"
        ]
        negative_effects = [
            r for r in significant_relationships if r.direction == "negative"
        ]

        if positive_effects and negative_effects:
            insights.append(
                f"Mixed directional effects: {len(positive_effects)} positive, {len(negative_effects)} negative relationships"
            )
        elif positive_effects:
            insights.append(
                f"Predominantly positive relationships detected ({len(positive_effects)} relationships)"
            )
        elif negative_effects:
            insights.append(
                f"Predominantly negative relationships detected ({len(negative_effects)} relationships)"
            )

        return insights

    async def _generate_recommendations(
        self, relationships: List[CausalRelationship], models: List[CausalModel]
    ) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []

        significant_relationships = [r for r in relationships if r.p_value < 0.05]

        if not significant_relationships:
            recommendations.append(
                "Collect more data or explore different variables to identify causal relationships"
            )
            return recommendations

        # Data quality recommendations
        high_quality_relationships = [
            r for r in significant_relationships if not r.violations
        ]
        if len(high_quality_relationships) < len(significant_relationships):
            recommendations.append(
                "Address assumption violations to strengthen causal inference"
            )

        # Sample size recommendations
        small_sample_relationships = [
            r for r in significant_relationships if r.sample_size < 100
        ]
        if small_sample_relationships:
            recommendations.append(
                "Increase sample size for more robust causal estimates"
            )

        # Practical significance
        practically_significant = [
            r for r in significant_relationships if r.practical_significance
        ]
        if practically_significant:
            top_practical = max(practically_significant, key=lambda x: x.effect_size)
            recommendations.append(
                f"Focus on {top_practical.cause_variable} → {top_practical.effect_variable} relationship for maximum impact"
            )

        # Model-specific recommendations
        for model in models:
            if model.model_fit.get("r_squared", 0) < 0.3:
                recommendations.append(
                    f"Consider additional variables for {model.outcome_variable} model (low R²)"
                )

        return recommendations

    async def close(self):
        """Clean up resources"""
        self.logger.info("CausalAnalyzer closed")


# Factory function
def create_causal_analyzer(
    confidence_level: ConfidenceLevel = ConfidenceLevel.MEDIUM, **kwargs
) -> CausalAnalyzer:
    """Create CausalAnalyzer instance with configuration"""
    return CausalAnalyzer(confidence_level=confidence_level, **kwargs)
