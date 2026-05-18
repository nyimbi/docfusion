"""
Result Validator

Multi-layer result validation with consistency checking, quality score calculation,
and validation rule engine for AI agent workflows.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field
from ...core.utils import uuid7str

class ValidationLevel(str, Enum):
    """Validation severity levels"""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class ValidationCategory(str, Enum):
    """Categories of validation checks"""

    STRUCTURE = "structure"
    CONTENT = "content"
    CONSISTENCY = "consistency"
    QUALITY = "quality"
    COMPLIANCE = "compliance"
    PERFORMANCE = "performance"
    SECURITY = "security"

@dataclass
class ValidationIssue:
    """Individual validation issue"""

    issue_id: str = field(default_factory=uuid7str)
    category: ValidationCategory = ValidationCategory.QUALITY
    level: ValidationLevel = ValidationLevel.WARNING
    message: str = ""
    details: Optional[str] = None
    path: Optional[str] = None  # JSON path or field path
    rule_name: Optional[str] = None
    expected_value: Any = None
    actual_value: Any = None
    suggestions: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "issue_id": self.issue_id,
            "category": self.category.value,
            "level": self.level.value,
            "message": self.message,
            "details": self.details,
            "path": self.path,
            "rule_name": self.rule_name,
            "expected_value": self.expected_value,
            "actual_value": self.actual_value,
            "suggestions": self.suggestions,
            "created_at": self.created_at.isoformat(),
        }

@dataclass
class ValidationResult:
    """Result of validation process"""

    validation_id: str = field(default_factory=uuid7str)
    is_valid: bool = True
    overall_score: float = 100.0
    issues: List[ValidationIssue] = field(default_factory=list)
    category_scores: Dict[ValidationCategory, float] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    validated_at: datetime = field(default_factory=datetime.now)

    def get_issues_by_level(self, level: ValidationLevel) -> List[ValidationIssue]:
        """Get issues by severity level"""
        return [issue for issue in self.issues if issue.level == level]

    def get_issues_by_category(
        self, category: ValidationCategory
    ) -> List[ValidationIssue]:
        """Get issues by category"""
        return [issue for issue in self.issues if issue.category == category]

    def has_critical_issues(self) -> bool:
        """Check if there are critical issues"""
        return any(issue.level == ValidationLevel.CRITICAL for issue in self.issues)

    def has_errors(self) -> bool:
        """Check if there are error-level issues"""
        return any(issue.level == ValidationLevel.ERROR for issue in self.issues)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "validation_id": self.validation_id,
            "is_valid": self.is_valid,
            "overall_score": self.overall_score,
            "issues": [issue.to_dict() for issue in self.issues],
            "category_scores": {
                cat.value: score for cat, score in self.category_scores.items()
            },
            "metadata": self.metadata,
            "validated_at": self.validated_at.isoformat(),
        }

class ValidationRule(BaseModel):
    """Validation rule definition"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_assignment=True)

    rule_id: str = Field(default_factory=uuid7str)
    name: str
    description: str
    category: ValidationCategory
    level: ValidationLevel = ValidationLevel.WARNING
    enabled: bool = True

    # Rule configuration
    target_path: Optional[str] = None  # JSON path to validate
    expected_type: Optional[str] = None  # Expected data type
    required: bool = False
    min_value: Optional[Union[int, float]] = None
    max_value: Optional[Union[int, float]] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    pattern: Optional[str] = None  # Regex pattern
    allowed_values: List[Any] = Field(default_factory=list)
    custom_field_validator: Optional[str] = None  # Custom validation function name

    # Suggestions for fixing issues
    fix_suggestions: List[str] = Field(default_factory=list)

class ResultValidator:
    """
    Multi-layer result validation with consistency checking and quality scoring

    Validates AI agent results across multiple dimensions including structure,
    content quality, consistency, compliance, and performance metrics.
    """

    def __init__(self):
        # Validation rules registry
        self.validation_rules: Dict[str, ValidationRule] = {}
        self.custom_validators: Dict[str, Callable] = {}

        # Validation history and metrics
        self.validation_history: List[ValidationResult] = []
        self.validation_stats = {
            "total_validations": 0,
            "passed_validations": 0,
            "failed_validations": 0,
            "average_score": 0.0,
            "common_issues": {},
        }

        # Configuration
        self.strict_mode = False  # Fail on any error-level issue
        self.max_history_size = 1000

        self.logger = logging.getLogger("result_validator")
        self.logger.info("ResultValidator initialized")

        # Initialize default validation rules
        self._initialize_default_rules()

    def register_validation_rule(self, rule: ValidationRule) -> None:
        """Register a validation rule"""
        self.validation_rules[rule.rule_id] = rule
        self.logger.info(f"Registered validation rule: {rule.name}")

    def unregister_validation_rule(self, rule_id: str) -> None:
        """Unregister a validation rule"""
        if rule_id in self.validation_rules:
            rule = self.validation_rules[rule_id]
            del self.validation_rules[rule_id]
            self.logger.info(f"Unregistered validation rule: {rule.name}")

    def register_custom_field_validator(self, name: str, validator_func: Callable) -> None:
        """Register a custom validation function"""
        self.custom_validators[name] = validator_func
        self.logger.info(f"Registered custom field_validator: {name}")

    async def validate_result(
        self,
        data: Any,
        rule_set: Optional[List[str]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> ValidationResult:
        """
        Validate data against registered rules

        Args:
                data: Data to validate
                rule_set: Specific rule IDs to use (if None, uses all enabled rules)
                context: Additional context for validation

        Returns:
                Validation result with issues and scores
        """
        validation_result = ValidationResult()
        context = context or {}

        try:
            # Determine which rules to apply
            rules_to_apply = []
            if rule_set:
                rules_to_apply = [
                    self.validation_rules[rid]
                    for rid in rule_set
                    if rid in self.validation_rules
                    and self.validation_rules[rid].enabled
                ]
            else:
                rules_to_apply = [
                    rule for rule in self.validation_rules.values() if rule.enabled
                ]

            # Apply validation rules
            for rule in rules_to_apply:
                issues = await self._apply_validation_rule(rule, data, context)
                validation_result.issues.extend(issues)

            # Calculate scores
            await self._calculate_validation_scores(validation_result)

            # Determine overall validity
            validation_result.is_valid = self._determine_validity(validation_result)

            # Update statistics
            self._update_validation_stats(validation_result)

            # Store in history
            self.validation_history.append(validation_result)
            if len(self.validation_history) > self.max_history_size:
                self.validation_history = self.validation_history[-500:]

            self.logger.info(
                f"Validation completed: {validation_result.overall_score:.1f} score, "
                f"{len(validation_result.issues)} issues"
            )

            return validation_result

        except Exception as e:
            self.logger.error(f"Validation failed: {e}")

            # Return error result
            error_issue = ValidationIssue(
                category=ValidationCategory.STRUCTURE,
                level=ValidationLevel.CRITICAL,
                message="Validation process failed",
                details=str(e),
                rule_name="validation_error",
            )

            validation_result.issues.append(error_issue)
            validation_result.is_valid = False
            validation_result.overall_score = 0.0

            return validation_result

    async def validate_consistency(
        self, results: List[Any], consistency_rules: Optional[Dict[str, Any]] = None
    ) -> ValidationResult:
        """
        Validate consistency across multiple results

        Args:
                results: List of results to check for consistency
                consistency_rules: Specific consistency validation rules

        Returns:
                Consistency validation result
        """
        validation_result = ValidationResult()
        consistency_rules = consistency_rules or {}

        if len(results) < 2:
            return validation_result  # Nothing to compare

        # Check structural consistency
        await self._check_structural_consistency(results, validation_result)

        # Check value consistency
        await self._check_value_consistency(results, validation_result)

        # Check type consistency
        await self._check_type_consistency(results, validation_result)

        # Apply custom consistency rules
        for rule_name, rule_config in consistency_rules.items():
            issues = await self._apply_custom_consistency_rule(
                rule_name, rule_config, results
            )
            validation_result.issues.extend(issues)

        # Calculate consistency scores
        await self._calculate_validation_scores(validation_result)
        validation_result.is_valid = self._determine_validity(validation_result)

        self.logger.info(
            f"Consistency validation completed: {validation_result.overall_score:.1f} score"
        )

        return validation_result

    async def validate_quality_score(
        self, result: Any, quality_criteria: Dict[str, Any]
    ) -> float:
        """
        Calculate quality score for a result

        Args:
                result: Result to score
                quality_criteria: Quality assessment criteria

        Returns:
                Quality score (0-100)
        """
        try:
            total_score = 0.0
            total_weight = 0.0

            for criterion, config in quality_criteria.items():
                weight = config.get("weight", 1.0)
                score = await self._evaluate_quality_criterion(
                    result, criterion, config
                )

                total_score += score * weight
                total_weight += weight

            final_score = total_score / total_weight if total_weight > 0 else 0.0

            self.logger.debug(f"Quality score calculated: {final_score:.1f}")

            return max(0.0, min(100.0, final_score))

        except Exception as e:
            self.logger.error(f"Quality score calculation failed: {e}")
            return 0.0

    async def get_validation_report(self, validation_result: ValidationResult) -> str:
        """Generate a human-readable validation report"""
        report_lines = [
            "# Validation Report",
            f"**Validation ID**: {validation_result.validation_id}",
            f"**Overall Score**: {validation_result.overall_score:.1f}/100",
            f"**Status**: {'✅ PASSED' if validation_result.is_valid else '❌ FAILED'}",
            f"**Validated At**: {validation_result.validated_at.strftime('%Y-%m-%d %H:%M:%S')}",
            "",
        ]

        # Category scores
        if validation_result.category_scores:
            report_lines.extend(
                [
                    "## Category Scores",
                    *[
                        f"- **{cat.value.title()}**: {score:.1f}/100"
                        for cat, score in validation_result.category_scores.items()
                    ],
                    "",
                ]
            )

        # Issues by level
        critical_issues = validation_result.get_issues_by_level(
            ValidationLevel.CRITICAL
        )
        error_issues = validation_result.get_issues_by_level(ValidationLevel.ERROR)
        warning_issues = validation_result.get_issues_by_level(ValidationLevel.WARNING)
        info_issues = validation_result.get_issues_by_level(ValidationLevel.INFO)

        if critical_issues:
            report_lines.extend(
                [
                    "## 🔴 Critical Issues",
                    *[
                        f"- **{issue.rule_name or 'Unknown'}**: {issue.message}"
                        for issue in critical_issues
                    ],
                    "",
                ]
            )

        if error_issues:
            report_lines.extend(
                [
                    "## 🟠 Errors",
                    *[
                        f"- **{issue.rule_name or 'Unknown'}**: {issue.message}"
                        for issue in error_issues
                    ],
                    "",
                ]
            )

        if warning_issues:
            report_lines.extend(
                [
                    "## 🟡 Warnings",
                    *[
                        f"- **{issue.rule_name or 'Unknown'}**: {issue.message}"
                        for issue in warning_issues[:10]
                    ],  # Limit to 10
                    ""
                    if len(warning_issues) <= 10
                    else f"... and {len(warning_issues) - 10} more warnings",
                    "",
                ]
            )

        if info_issues:
            report_lines.extend(
                [
                    "## ℹ️ Information",
                    *[
                        f"- **{issue.rule_name or 'Unknown'}**: {issue.message}"
                        for issue in info_issues[:5]
                    ],  # Limit to 5
                    ""
                    if len(info_issues) <= 5
                    else f"... and {len(info_issues) - 5} more info items",
                    "",
                ]
            )

        # Recommendations
        all_suggestions = []
        for issue in validation_result.issues:
            all_suggestions.extend(issue.suggestions)

        if all_suggestions:
            unique_suggestions = list(set(all_suggestions))[
                :10
            ]  # Top 10 unique suggestions
            report_lines.extend(
                [
                    "## Recommendations",
                    *[f"- {suggestion}" for suggestion in unique_suggestions],
                    "",
                ]
            )

        return "\n".join(report_lines)

    def get_validation_stats(self) -> Dict[str, Any]:
        """Get validation statistics"""
        return dict(self.validation_stats)

    async def _apply_validation_rule(
        self, rule: ValidationRule, data: Any, context: Dict[str, Any]
    ) -> List[ValidationIssue]:
        """Apply a single validation rule to data"""
        issues = []

        try:
            # Extract target value if path specified
            if rule.target_path:
                target_value = self._extract_value_by_path(data, rule.target_path)
            else:
                target_value = data

            # Check if required field is missing
            if rule.required and target_value is None:
                issues.append(
                    ValidationIssue(
                        category=rule.category,
                        level=rule.level,
                        message=f"Required field missing: {rule.target_path or 'root'}",
                        path=rule.target_path,
                        rule_name=rule.name,
                        suggestions=rule.fix_suggestions,
                    )
                )
                return issues

            # Skip validation if value is None and not required
            if target_value is None:
                return issues

            # Type validation
            if rule.expected_type:
                if not self._check_type(target_value, rule.expected_type):
                    issues.append(
                        ValidationIssue(
                            category=rule.category,
                            level=rule.level,
                            message=f"Type mismatch: expected {rule.expected_type}, got {type(target_value).__name__}",
                            path=rule.target_path,
                            rule_name=rule.name,
                            expected_value=rule.expected_type,
                            actual_value=type(target_value).__name__,
                            suggestions=rule.fix_suggestions,
                        )
                    )

            # Value range validation
            if isinstance(target_value, (int, float)):
                if rule.min_value is not None and target_value < rule.min_value:
                    issues.append(
                        ValidationIssue(
                            category=rule.category,
                            level=rule.level,
                            message=f"Value below minimum: {target_value} < {rule.min_value}",
                            path=rule.target_path,
                            rule_name=rule.name,
                            expected_value=f">= {rule.min_value}",
                            actual_value=target_value,
                            suggestions=rule.fix_suggestions,
                        )
                    )

                if rule.max_value is not None and target_value > rule.max_value:
                    issues.append(
                        ValidationIssue(
                            category=rule.category,
                            level=rule.level,
                            message=f"Value above maximum: {target_value} > {rule.max_value}",
                            path=rule.target_path,
                            rule_name=rule.name,
                            expected_value=f"<= {rule.max_value}",
                            actual_value=target_value,
                            suggestions=rule.fix_suggestions,
                        )
                    )

            # Length validation
            if hasattr(target_value, "__len__"):
                length = len(target_value)

                if rule.min_length is not None and length < rule.min_length:
                    issues.append(
                        ValidationIssue(
                            category=rule.category,
                            level=rule.level,
                            message=f"Length below minimum: {length} < {rule.min_length}",
                            path=rule.target_path,
                            rule_name=rule.name,
                            expected_value=f"length >= {rule.min_length}",
                            actual_value=length,
                            suggestions=rule.fix_suggestions,
                        )
                    )

                if rule.max_length is not None and length > rule.max_length:
                    issues.append(
                        ValidationIssue(
                            category=rule.category,
                            level=rule.level,
                            message=f"Length above maximum: {length} > {rule.max_length}",
                            path=rule.target_path,
                            rule_name=rule.name,
                            expected_value=f"length <= {rule.max_length}",
                            actual_value=length,
                            suggestions=rule.fix_suggestions,
                        )
                    )

            # Pattern validation
            if rule.pattern and isinstance(target_value, str):
                if not re.match(rule.pattern, target_value):
                    issues.append(
                        ValidationIssue(
                            category=rule.category,
                            level=rule.level,
                            message=f"Pattern mismatch: value does not match pattern {rule.pattern}",
                            path=rule.target_path,
                            rule_name=rule.name,
                            expected_value=f"matches {rule.pattern}",
                            actual_value=target_value,
                            suggestions=rule.fix_suggestions,
                        )
                    )

            # Allowed values validation
            if rule.allowed_values and target_value not in rule.allowed_values:
                issues.append(
                    ValidationIssue(
                        category=rule.category,
                        level=rule.level,
                        message=f"Value not allowed: {target_value} not in {rule.allowed_values}",
                        path=rule.target_path,
                        rule_name=rule.name,
                        expected_value=rule.allowed_values,
                        actual_value=target_value,
                        suggestions=rule.fix_suggestions,
                    )
                )

            # Custom field_validator
            if (
                rule.custom_field_validator
                and rule.custom_field_validator in self.custom_validators
            ):
                validator_func = self.custom_validators[rule.custom_field_validator]
                try:
                    custom_issues = await self._call_custom_field_validator(
                        validator_func, target_value, rule, context
                    )
                    issues.extend(custom_issues)
                except Exception as e:
                    issues.append(
                        ValidationIssue(
                            category=ValidationCategory.STRUCTURE,
                            level=ValidationLevel.ERROR,
                            message=f"Custom field_validator failed: {e}",
                            path=rule.target_path,
                            rule_name=rule.name,
                        )
                    )

        except Exception as e:
            issues.append(
                ValidationIssue(
                    category=ValidationCategory.STRUCTURE,
                    level=ValidationLevel.ERROR,
                    message=f"Rule application failed: {e}",
                    rule_name=rule.name,
                )
            )

        return issues

    def _extract_value_by_path(self, data: Any, path: str) -> Any:
        """Extract value from data using JSON path notation"""
        try:
            parts = path.split(".")
            current = data

            for part in parts:
                if isinstance(current, dict):
                    current = current.get(part)
                elif isinstance(current, (list, tuple)) and part.isdigit():
                    index = int(part)
                    current = current[index] if 0 <= index < len(current) else None
                else:
                    return None

            return current

        except Exception:
            return None

    def _check_type(self, value: Any, expected_type: str) -> bool:
        """Check if value matches expected type"""
        type_map = {
            "str": str,
            "int": int,
            "float": float,
            "bool": bool,
            "list": list,
            "dict": dict,
            "tuple": tuple,
            "set": set,
        }

        if expected_type in type_map:
            return isinstance(value, type_map[expected_type])

        return True  # Unknown type, assume valid

    async def _call_custom_field_validator(
        self,
        validator_func: Callable,
        value: Any,
        rule: ValidationRule,
        context: Dict[str, Any],
    ) -> List[ValidationIssue]:
        """Call custom validation function"""
        try:
            if asyncio.iscoroutinefunction(validator_func):
                return await validator_func(value, rule, context)
            else:
                return validator_func(value, rule, context)
        except Exception as e:
            return [
                ValidationIssue(
                    category=ValidationCategory.STRUCTURE,
                    level=ValidationLevel.ERROR,
                    message=f"Custom validation error: {e}",
                    rule_name=rule.name,
                )
            ]

    async def _check_structural_consistency(
        self, results: List[Any], validation_result: ValidationResult
    ):
        """Check structural consistency across results"""
        if not results:
            return

        # Check if all results have the same structure
        first_result = results[0]
        first_keys = set()

        if isinstance(first_result, dict):
            first_keys = set(first_result.keys())

        for i, result in enumerate(results[1:], 1):
            if isinstance(result, dict):
                result_keys = set(result.keys())
                missing_keys = first_keys - result_keys
                extra_keys = result_keys - first_keys

                if missing_keys:
                    validation_result.issues.append(
                        ValidationIssue(
                            category=ValidationCategory.CONSISTENCY,
                            level=ValidationLevel.WARNING,
                            message=f"Result {i} missing keys: {list(missing_keys)}",
                            path=f"result.{i}",
                            rule_name="structural_consistency",
                        )
                    )

                if extra_keys:
                    validation_result.issues.append(
                        ValidationIssue(
                            category=ValidationCategory.CONSISTENCY,
                            level=ValidationLevel.INFO,
                            message=f"Result {i} has extra keys: {list(extra_keys)}",
                            path=f"result.{i}",
                            rule_name="structural_consistency",
                        )
                    )

    async def _check_value_consistency(
        self, results: List[Any], validation_result: ValidationResult
    ):
        """Check value consistency across results"""
        if len(results) < 2:
            return

        # For simple values, check if they're all the same
        if all(not isinstance(r, (dict, list)) for r in results):
            unique_values = set(results)
            if len(unique_values) > 1:
                validation_result.issues.append(
                    ValidationIssue(
                        category=ValidationCategory.CONSISTENCY,
                        level=ValidationLevel.WARNING,
                        message=f"Inconsistent values across results: {list(unique_values)}",
                        rule_name="value_consistency",
                    )
                )

    async def _check_type_consistency(
        self, results: List[Any], validation_result: ValidationResult
    ):
        """Check type consistency across results"""
        if not results:
            return

        first_type = type(results[0])
        for i, result in enumerate(results[1:], 1):
            if type(result) != first_type:
                validation_result.issues.append(
                    ValidationIssue(
                        category=ValidationCategory.CONSISTENCY,
                        level=ValidationLevel.ERROR,
                        message=f"Type mismatch: result {i} is {type(result).__name__}, expected {first_type.__name__}",
                        path=f"result.{i}",
                        rule_name="type_consistency",
                    )
                )

    async def _apply_custom_consistency_rule(
        self, rule_name: str, rule_config: Dict[str, Any], results: List[Any]
    ) -> List[ValidationIssue]:
        """Apply custom consistency rule"""
        # This would be implemented based on specific consistency requirements
        return []

    async def _evaluate_quality_criterion(
        self, result: Any, criterion: str, config: Dict[str, Any]
    ) -> float:
        """Evaluate a quality criterion"""
        if criterion == "completeness":
            return await self._evaluate_completeness(result, config)
        elif criterion == "accuracy":
            return await self._evaluate_accuracy(result, config)
        elif criterion == "relevance":
            return await self._evaluate_relevance(result, config)
        elif criterion == "clarity":
            return await self._evaluate_clarity(result, config)
        else:
            return 50.0  # Default neutral score

    async def _evaluate_completeness(
        self, result: Any, config: Dict[str, Any]
    ) -> float:
        """Evaluate result completeness"""
        required_fields = config.get("required_fields", [])
        if not required_fields:
            return 100.0

        if not isinstance(result, dict):
            return 0.0

        present_fields = sum(
            1
            for field in required_fields
            if field in result and result[field] is not None
        )
        return (present_fields / len(required_fields)) * 100

    async def _evaluate_accuracy(self, result: Any, config: Dict[str, Any]) -> float:
        """Evaluate result accuracy"""
        # This would implement accuracy metrics based on expected values or patterns
        return 80.0  # Placeholder score

    async def _evaluate_relevance(self, result: Any, config: Dict[str, Any]) -> float:
        """Evaluate result relevance"""
        # This would implement relevance scoring based on context or keywords
        return 85.0  # Placeholder score

    async def _evaluate_clarity(self, result: Any, config: Dict[str, Any]) -> float:
        """Evaluate result clarity"""
        # This would implement clarity metrics for text content
        return 90.0  # Placeholder score

    async def _calculate_validation_scores(self, validation_result: ValidationResult):
        """Calculate category and overall scores"""
        category_issues = {}

        # Group issues by category
        for issue in validation_result.issues:
            if issue.category not in category_issues:
                category_issues[issue.category] = []
            category_issues[issue.category].append(issue)

        # Calculate category scores
        for category in ValidationCategory:
            issues = category_issues.get(category, [])
            score = self._calculate_category_score(issues)
            validation_result.category_scores[category] = score

        # Calculate overall score
        if validation_result.category_scores:
            validation_result.overall_score = sum(
                validation_result.category_scores.values()
            ) / len(validation_result.category_scores)
        else:
            validation_result.overall_score = 100.0

    def _calculate_category_score(self, issues: List[ValidationIssue]) -> float:
        """Calculate score for a category based on issues"""
        if not issues:
            return 100.0

        penalty = 0
        for issue in issues:
            if issue.level == ValidationLevel.CRITICAL:
                penalty += 25
            elif issue.level == ValidationLevel.ERROR:
                penalty += 15
            elif issue.level == ValidationLevel.WARNING:
                penalty += 5
            else:  # INFO
                penalty += 1

        return max(0.0, 100.0 - penalty)

    def _determine_validity(self, validation_result: ValidationResult) -> bool:
        """Determine if result is valid based on issues"""
        if self.strict_mode:
            return not any(
                issue.level in [ValidationLevel.ERROR, ValidationLevel.CRITICAL]
                for issue in validation_result.issues
            )
        else:
            return not validation_result.has_critical_issues()

    def _update_validation_stats(self, validation_result: ValidationResult):
        """Update validation statistics"""
        self.validation_stats["total_validations"] += 1

        if validation_result.is_valid:
            self.validation_stats["passed_validations"] += 1
        else:
            self.validation_stats["failed_validations"] += 1

        # Update average score
        total = self.validation_stats["total_validations"]
        current_avg = self.validation_stats["average_score"]
        new_avg = (
            (current_avg * (total - 1)) + validation_result.overall_score
        ) / total
        self.validation_stats["average_score"] = new_avg

        # Track common issues
        for issue in validation_result.issues:
            rule_name = issue.rule_name or "unknown"
            if rule_name not in self.validation_stats["common_issues"]:
                self.validation_stats["common_issues"][rule_name] = 0
            self.validation_stats["common_issues"][rule_name] += 1

    def _initialize_default_rules(self):
        """Initialize default validation rules"""
        # Basic structure rules
        self.register_validation_rule(
            ValidationRule(
                name="Non-empty result",
                description="Result should not be empty or None",
                category=ValidationCategory.STRUCTURE,
                level=ValidationLevel.ERROR,
                required=True,
                fix_suggestions=["Ensure the process produces a valid result"],
            )
        )

        # Content quality rules
        self.register_validation_rule(
            ValidationRule(
                name="Minimum content length",
                description="Text content should have minimum length",
                category=ValidationCategory.CONTENT,
                level=ValidationLevel.WARNING,
                target_path="content",
                expected_type="str",
                min_length=10,
                fix_suggestions=["Add more detailed content"],
            )
        )

        self.logger.info("Default validation rules initialized")
