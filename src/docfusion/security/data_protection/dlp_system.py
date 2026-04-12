#!/usr/bin/env python3
"""
Data Loss Prevention (DLP) System

Implements comprehensive data loss prevention capabilities including content
scanning, classification, policy enforcement, and incident response for
protecting sensitive data across the application.
"""

import asyncio
import hashlib
import json
import logging
import re
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from pydantic import BaseModel, Field, field_validator
from ...core.utils import uuid7str
class DataSensitivityLevel(str, Enum):
    """Data sensitivity classification levels"""

    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"
    TOP_SECRET = "top_secret"

class DLPViolationType(str, Enum):
    """Types of DLP violations"""

    DATA_EXFILTRATION = "data_exfiltration"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    POLICY_VIOLATION = "policy_violation"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    CONTENT_VIOLATION = "content_violation"
    CLASSIFICATION_MISMATCH = "classification_mismatch"

class ContentType(str, Enum):
    """Types of content for DLP scanning"""

    TEXT = "text"
    DOCUMENT = "document"
    EMAIL = "email"
    DATABASE = "database"
    FILE_UPLOAD = "file_upload"
    API_REQUEST = "api_request"
    WEB_FORM = "web_form"

class DLPAction(str, Enum):
    """Actions to take on DLP policy violations"""

    ALLOW = "allow"
    WARN = "warn"
    BLOCK = "block"
    QUARANTINE = "quarantine"
    ENCRYPT = "encrypt"
    REDACT = "redact"
    LOG_ONLY = "log_only"

class ScanningEngine(str, Enum):
    """Content scanning engines"""

    REGEX = "regex"
    KEYWORD = "keyword"
    ML_CLASSIFIER = "ml_classifier"
    HASH_MATCHING = "hash_matching"
    SEMANTIC_ANALYSIS = "semantic_analysis"

class DataPattern(BaseModel):
    """Data pattern definition for DLP scanning"""

    pattern_id: str = Field(default_factory=uuid7str)
    name: str
    description: str
    pattern_type: str  # ssn, credit_card, email, phone, custom, etc.

    # Pattern definitions
    regex_patterns: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)
    keyword_proximity: int = 50  # Words within this distance

    # Detection settings
    case_sensitive: bool = False
    require_context: bool = False
    context_patterns: List[str] = Field(default_factory=list)

    # Confidence scoring
    base_confidence: float = 0.8
    confidence_modifiers: Dict[str, float] = Field(default_factory=dict)

    # Classification
    data_types: List[str] = Field(default_factory=list)  # PII, PHI, PCI, etc.
    sensitivity_level: DataSensitivityLevel = DataSensitivityLevel.CONFIDENTIAL

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    active: bool = True

class DLPRule(BaseModel):
    """DLP policy rule definition"""

    rule_id: str = Field(default_factory=uuid7str)
    rule_name: str
    description: str
    priority: int = 100  # Lower numbers = higher priority

    # Rule conditions
    data_patterns: List[str] = Field(default_factory=list)  # pattern IDs
    content_types: List[ContentType] = Field(default_factory=list)
    sensitivity_levels: List[DataSensitivityLevel] = Field(default_factory=list)

    # Matching logic
    require_all_patterns: bool = False  # AND vs OR matching
    minimum_matches: int = 1
    confidence_threshold: float = 0.7

    # Scope
    applies_to_users: List[str] = Field(default_factory=list)
    applies_to_groups: List[str] = Field(default_factory=list)
    applies_to_resources: List[str] = Field(default_factory=list)
    excluded_users: List[str] = Field(default_factory=list)
    excluded_resources: List[str] = Field(default_factory=list)

    # Actions
    violation_action: DLPAction = DLPAction.BLOCK
    fallback_action: DLPAction = DLPAction.LOG_ONLY
    allow_override: bool = False
    override_by_roles: List[str] = Field(default_factory=list)

    # Notification and logging
    notify_user: bool = True
    notify_admin: bool = True
    create_incident: bool = True
    log_details: bool = True

    # Metadata
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class ScanResult(BaseModel):
    """Result of DLP content scan"""

    scan_id: str = Field(default_factory=uuid7str)
    content_id: Optional[str] = None
    content_hash: str
    content_type: ContentType

    # Detection results
    patterns_found: List[str] = Field(default_factory=list)  # pattern IDs
    matches: List[Dict[str, Any]] = Field(default_factory=list)  # match details
    overall_confidence: float = 0.0
    max_sensitivity: Optional[DataSensitivityLevel] = None

    # Content analysis
    content_size: int = 0
    scan_duration_ms: float = 0.0
    scanning_engines_used: List[ScanningEngine] = Field(default_factory=list)

    # Classification
    data_types_detected: List[str] = Field(default_factory=list)
    estimated_sensitivity: DataSensitivityLevel = DataSensitivityLevel.PUBLIC

    # Metadata
    scanned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    scanned_by_user: Optional[str] = None
    source_ip: Optional[str] = None

class DLPViolation(BaseModel):
    """DLP policy violation record"""

    violation_id: str = Field(default_factory=uuid7str)
    violation_type: DLPViolationType
    severity: str = "medium"  # low, medium, high, critical

    # Context
    user_id: Optional[str] = None
    resource_id: Optional[str] = None
    content_id: Optional[str] = None
    action_attempted: Optional[str] = None

    # Rule and pattern details
    triggered_rules: List[str] = Field(default_factory=list)  # rule IDs
    matched_patterns: List[str] = Field(default_factory=list)  # pattern IDs
    scan_result_id: Optional[str] = None

    # Violation details
    description: str
    evidence: Dict[str, Any] = Field(default_factory=dict)
    confidence_score: float = 0.0

    # Response
    action_taken: DLPAction
    blocked: bool = False
    quarantined: bool = False
    user_notified: bool = False
    admin_notified: bool = False

    # Investigation
    investigated: bool = False
    investigation_notes: Optional[str] = None
    false_positive: bool = False
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None

    # Metadata
    detected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source_ip: Optional[str] = None
    user_agent: Optional[str] = None

class DLPIncident(BaseModel):
    """DLP security incident record"""

    incident_id: str = Field(default_factory=uuid7str)
    incident_type: str = "data_loss_prevention"
    title: str
    description: str
    severity: str = "medium"  # low, medium, high, critical

    # Related violations
    related_violations: List[str] = Field(default_factory=list)  # violation IDs
    violation_count: int = 0

    # Incident details
    affected_users: List[str] = Field(default_factory=list)
    affected_resources: List[str] = Field(default_factory=list)
    data_types_involved: List[str] = Field(default_factory=list)
    estimated_records_affected: int = 0

    # Response tracking
    status: str = "open"  # open, investigating, resolved, closed
    assigned_to: Optional[str] = None
    investigation_notes: Optional[str] = None

    # Timeline
    first_detected: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None

    # Impact assessment
    business_impact: str = "unknown"  # low, medium, high, critical
    compliance_impact: bool = False
    external_notification_required: bool = False

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

@dataclass
class DLPConfiguration:
    """DLP system configuration"""

    # Scanning settings
    enable_real_time_scanning: bool = True
    enable_background_scanning: bool = True
    scan_timeout_seconds: int = 30
    max_content_size_mb: int = 100

    # Performance settings
    max_concurrent_scans: int = 10
    scan_queue_size: int = 1000
    enable_scan_caching: bool = True
    cache_ttl_hours: int = 24

    # Pattern matching
    enable_regex_scanning: bool = True
    enable_keyword_scanning: bool = True
    enable_ml_classification: bool = False  # Requires ML models

    # Action settings
    default_violation_action: DLPAction = DLPAction.BLOCK
    allow_user_override: bool = False
    quarantine_duration_days: int = 30

    # Incident management
    auto_create_incidents: bool = True
    incident_threshold_violations: int = 5
    incident_threshold_minutes: int = 60

    # Notifications
    notify_users_on_violation: bool = True
    notify_admins_on_violation: bool = True
    email_notification_enabled: bool = True

    # Compliance and retention
    retain_scan_results_days: int = 365
    retain_violations_days: int = 2555  # 7 years
    enable_audit_logging: bool = True

    # Integration settings
    integrate_with_encryption: bool = True
    integrate_with_classification: bool = True

class DLPSystem:
    """Data Loss Prevention system implementation"""

    def __init__(self, config: Optional[DLPConfiguration] = None):
        """Initialize DLP system"""
        self.config = config or DLPConfiguration()
        self.logger = logging.getLogger(__name__)

        # Storage (in production, use database)
        self.data_patterns: Dict[str, DataPattern] = {}
        self.dlp_rules: Dict[str, DLPRule] = {}
        self.scan_results: Dict[str, ScanResult] = {}
        self.violations: Dict[str, DLPViolation] = {}
        self.incidents: Dict[str, DLPIncident] = {}

        # Caches and indexes
        self.scan_cache: Dict[str, ScanResult] = {}  # content_hash -> result
        self.pattern_cache: Dict[str, List[DataPattern]] = {}  # Compiled patterns

        # Scanning queue
        self.scan_queue: asyncio.Queue = asyncio.Queue(
            maxsize=self.config.scan_queue_size
        )

        # Create default patterns
        self._create_default_patterns()

        # Start background tasks
        asyncio.create_task(self._start_background_scanner())

        self.logger.info("DLP system initialized")

    def _create_default_patterns(self):
        """Create default data patterns for common sensitive data types"""
        # Social Security Number (US)
        ssn_pattern = DataPattern(
            name="US Social Security Number",
            description="Detects US Social Security Numbers",
            pattern_type="ssn",
            regex_patterns=[
                r"\b\d{3}-\d{2}-\d{4}\b",  # XXX-XX-XXXX
                r"\b\d{3}\s\d{2}\s\d{4}\b",  # XXX XX XXXX
                r"\b\d{9}\b",  # XXXXXXXXX (9 consecutive digits)
            ],
            keywords=["ssn", "social security", "social security number"],
            data_types=["PII"],
            sensitivity_level=DataSensitivityLevel.RESTRICTED,
            created_by="system",
        )
        self.data_patterns["ssn"] = ssn_pattern

        # Credit Card Numbers
        cc_pattern = DataPattern(
            name="Credit Card Number",
            description="Detects credit card numbers using Luhn algorithm",
            pattern_type="credit_card",
            regex_patterns=[
                r"\b4\d{3}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b",  # Visa
                r"\b5[1-5]\d{2}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b",  # MasterCard
                r"\b3[47]\d{2}[\s\-]?\d{6}[\s\-]?\d{5}\b",  # American Express
                r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b",  # Generic 16-digit
            ],
            keywords=["credit card", "card number", "cc", "visa", "mastercard", "amex"],
            data_types=["PCI"],
            sensitivity_level=DataSensitivityLevel.RESTRICTED,
            created_by="system",
        )
        self.data_patterns["credit_card"] = cc_pattern

        # Email Addresses
        email_pattern = DataPattern(
            name="Email Address",
            description="Detects email addresses",
            pattern_type="email",
            regex_patterns=[r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"],
            data_types=["PII"],
            sensitivity_level=DataSensitivityLevel.INTERNAL,
            created_by="system",
        )
        self.data_patterns["email"] = email_pattern

        # Phone Numbers
        phone_pattern = DataPattern(
            name="Phone Number",
            description="Detects phone numbers in various formats",
            pattern_type="phone",
            regex_patterns=[
                r"\b\(\d{3}\)\s?\d{3}-\d{4}\b",  # (XXX) XXX-XXXX
                r"\b\d{3}-\d{3}-\d{4}\b",  # XXX-XXX-XXXX
                r"\b\d{3}\.\d{3}\.\d{4}\b",  # XXX.XXX.XXXX
                r"\b\d{10}\b",  # XXXXXXXXXX
            ],
            keywords=["phone", "telephone", "mobile", "cell"],
            data_types=["PII"],
            sensitivity_level=DataSensitivityLevel.INTERNAL,
            created_by="system",
        )
        self.data_patterns["phone"] = phone_pattern

        # API Keys and Secrets
        api_key_pattern = DataPattern(
            name="API Key",
            description="Detects API keys and secrets",
            pattern_type="api_key",
            regex_patterns=[
                r'api[_\-]?key["\']?\s*[:=]\s*["\']([a-zA-Z0-9_\-]{16,})["\']?',
                r'secret[_\-]?key["\']?\s*[:=]\s*["\']([a-zA-Z0-9_\-]{16,})["\']?',
                r'access[_\-]?token["\']?\s*[:=]\s*["\']([a-zA-Z0-9_\-]{16,})["\']?',
            ],
            keywords=["api key", "secret key", "access token", "bearer token"],
            data_types=["API_SECRET"],
            sensitivity_level=DataSensitivityLevel.CONFIDENTIAL,
            created_by="system",
        )
        self.data_patterns["api_key"] = api_key_pattern

    # Pattern Management

    def create_data_pattern(
        self, name: str, description: str, pattern_type: str, created_by: str, **kwargs
    ) -> str:
        """Create a new data pattern"""
        pattern = DataPattern(
            name=name,
            description=description,
            pattern_type=pattern_type,
            created_by=created_by,
            **kwargs,
        )

        self.data_patterns[pattern.pattern_id] = pattern

        # Clear pattern cache to force recompilation
        self.pattern_cache.clear()

        self.logger.info(f"Created data pattern: {name}")
        return pattern.pattern_id

    def create_dlp_rule(
        self, rule_name: str, description: str, created_by: str, **kwargs
    ) -> str:
        """Create a new DLP rule"""
        rule = DLPRule(
            rule_name=rule_name,
            description=description,
            created_by=created_by,
            **kwargs,
        )

        self.dlp_rules[rule.rule_id] = rule

        self.logger.info(f"Created DLP rule: {rule_name}")
        return rule.rule_id

    # Content Scanning

    async def scan_content(
        self,
        content: str,
        content_type: ContentType,
        user_id: Optional[str] = None,
        content_id: Optional[str] = None,
        source_ip: Optional[str] = None,
    ) -> ScanResult:
        """Scan content for sensitive data patterns"""
        start_time = datetime.now()

        try:
            # Create content hash for caching
            content_hash = hashlib.sha256(content.encode()).hexdigest()

            # Check cache if enabled
            if self.config.enable_scan_caching and content_hash in self.scan_cache:
                cached_result = self.scan_cache[content_hash]
                # Check cache age
                cache_age = datetime.now(timezone.utc) - cached_result.scanned_at
                if cache_age < timedelta(hours=self.config.cache_ttl_hours):
                    return cached_result

            # Perform scanning
            scan_result = ScanResult(
                content_id=content_id,
                content_hash=content_hash,
                content_type=content_type,
                content_size=len(content),
                scanned_by_user=user_id,
                source_ip=source_ip,
            )

            # Get applicable patterns
            patterns = self._get_applicable_patterns(content_type)

            # Scan with each pattern
            all_matches = []
            patterns_found = []
            confidence_scores = []
            data_types = set()

            for pattern in patterns:
                matches = await self._scan_with_pattern(content, pattern)
                if matches:
                    patterns_found.append(pattern.pattern_id)
                    all_matches.extend(matches)
                    confidence_scores.extend(
                        [m.get("confidence", pattern.base_confidence) for m in matches]
                    )
                    data_types.update(pattern.data_types)

            # Calculate overall results
            scan_result.patterns_found = patterns_found
            scan_result.matches = all_matches
            scan_result.overall_confidence = (
                max(confidence_scores) if confidence_scores else 0.0
            )
            scan_result.data_types_detected = list(data_types)

            # Determine sensitivity level
            if patterns_found:
                sensitivity_levels = [
                    self.data_patterns[pid].sensitivity_level for pid in patterns_found
                ]
                scan_result.max_sensitivity = max(
                    sensitivity_levels, key=lambda x: self._sensitivity_to_numeric(x)
                )
                scan_result.estimated_sensitivity = scan_result.max_sensitivity

            # Calculate scan duration
            scan_duration = (datetime.now() - start_time).total_seconds() * 1000
            scan_result.scan_duration_ms = scan_duration
            scan_result.scanning_engines_used = [
                ScanningEngine.REGEX,
                ScanningEngine.KEYWORD,
            ]

            # Store results
            self.scan_results[scan_result.scan_id] = scan_result

            # Cache result
            if self.config.enable_scan_caching:
                self.scan_cache[content_hash] = scan_result

            self.logger.info(
                f"Content scan completed: {len(patterns_found)} patterns found, confidence: {scan_result.overall_confidence:.2f}"
            )
            return scan_result

        except Exception as e:
            self.logger.error(f"Content scanning failed: {e}")
            # Return empty result on error
            return ScanResult(
                content_hash=hashlib.sha256(content.encode()).hexdigest(),
                content_type=content_type,
                scanned_by_user=user_id,
                source_ip=source_ip,
            )

    async def _scan_with_pattern(
        self, content: str, pattern: DataPattern
    ) -> List[Dict[str, Any]]:
        """Scan content with a specific pattern"""
        matches = []

        try:
            # Regex matching
            if pattern.regex_patterns:
                for regex_pattern in pattern.regex_patterns:
                    flags = 0 if pattern.case_sensitive else re.IGNORECASE
                    regex_matches = re.finditer(regex_pattern, content, flags)

                    for match in regex_matches:
                        match_info = {
                            "pattern_id": pattern.pattern_id,
                            "pattern_name": pattern.name,
                            "match_type": "regex",
                            "matched_text": match.group(),
                            "start_pos": match.start(),
                            "end_pos": match.end(),
                            "confidence": pattern.base_confidence,
                            "context": self._extract_context(
                                content, match.start(), match.end()
                            ),
                        }

                        # Apply confidence modifiers
                        match_info["confidence"] = self._calculate_match_confidence(
                            match_info, pattern
                        )

                        matches.append(match_info)

            # Keyword matching
            if pattern.keywords:
                for keyword in pattern.keywords:
                    flags = 0 if pattern.case_sensitive else re.IGNORECASE
                    keyword_pattern = r"\b" + re.escape(keyword) + r"\b"
                    keyword_matches = re.finditer(keyword_pattern, content, flags)

                    for match in keyword_matches:
                        match_info = {
                            "pattern_id": pattern.pattern_id,
                            "pattern_name": pattern.name,
                            "match_type": "keyword",
                            "matched_text": match.group(),
                            "start_pos": match.start(),
                            "end_pos": match.end(),
                            "confidence": pattern.base_confidence
                            * 0.8,  # Lower confidence for keywords
                            "context": self._extract_context(
                                content, match.start(), match.end()
                            ),
                        }

                        matches.append(match_info)

            # Context validation
            if pattern.require_context and pattern.context_patterns:
                matches = [
                    m
                    for m in matches
                    if self._validate_context(m["context"], pattern.context_patterns)
                ]

            return matches

        except Exception as e:
            self.logger.error(
                f"Pattern scanning failed for pattern {pattern.name}: {e}"
            )
            return []

    def _get_applicable_patterns(self, content_type: ContentType) -> List[DataPattern]:
        """Get patterns applicable to the content type"""
        # For now, return all active patterns
        # In production, you'd filter by content type
        return [p for p in self.data_patterns.values() if p.active]

    def _extract_context(
        self, content: str, start_pos: int, end_pos: int, context_chars: int = 100
    ) -> str:
        """Extract context around a match"""
        context_start = max(0, start_pos - context_chars)
        context_end = min(len(content), end_pos + context_chars)
        return content[context_start:context_end]

    def _calculate_match_confidence(
        self, match_info: Dict[str, Any], pattern: DataPattern
    ) -> float:
        """Calculate confidence score for a match"""
        base_confidence = match_info["confidence"]

        # Apply pattern-specific modifiers
        for modifier_key, modifier_value in pattern.confidence_modifiers.items():
            if modifier_key in match_info["context"].lower():
                base_confidence *= 1.0 + modifier_value

        # Additional validation for specific patterns
        if pattern.pattern_type == "credit_card":
            # Simple Luhn algorithm check
            if self._validate_luhn(match_info["matched_text"]):
                base_confidence *= 1.2
            else:
                base_confidence *= 0.5

        return min(1.0, base_confidence)

    def _validate_luhn(self, card_number: str) -> bool:
        """Validate credit card number using Luhn algorithm"""
        try:
            # Remove spaces and dashes
            card_number = re.sub(r"[\s\-]", "", card_number)

            if not card_number.isdigit():
                return False

            # Luhn algorithm
            total = 0
            for i, digit in enumerate(reversed(card_number)):
                n = int(digit)
                if i % 2 == 1:  # Every second digit from right
                    n *= 2
                    if n > 9:
                        n = n // 10 + n % 10
                total += n

            return total % 10 == 0
        except Exception as e:
            self.logger.warning(f"Credit card validation failed: {e}")
            return False

    def _validate_context(self, context: str, context_patterns: List[str]) -> bool:
        """Validate that context contains required patterns"""
        for pattern in context_patterns:
            if re.search(pattern, context, re.IGNORECASE):
                return True
        return False

    def _sensitivity_to_numeric(self, sensitivity: DataSensitivityLevel) -> int:
        """Convert sensitivity level to numeric for comparison"""
        mapping = {
            DataSensitivityLevel.PUBLIC: 0,
            DataSensitivityLevel.INTERNAL: 1,
            DataSensitivityLevel.CONFIDENTIAL: 2,
            DataSensitivityLevel.RESTRICTED: 3,
            DataSensitivityLevel.TOP_SECRET: 4,
        }
        return mapping.get(sensitivity, 0)

    # Policy Enforcement

    async def check_dlp_policies(
        self,
        scan_result: ScanResult,
        user_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        action: Optional[str] = None,
    ) -> List[DLPViolation]:
        """Check scan result against DLP policies"""
        violations = []

        try:
            # Get applicable rules
            applicable_rules = self._get_applicable_rules(
                user_id, resource_id, scan_result.content_type
            )

            for rule in applicable_rules:
                violation = await self._evaluate_rule(
                    rule, scan_result, user_id, resource_id, action
                )
                if violation:
                    violations.append(violation)

            # Store violations
            for violation in violations:
                self.violations[violation.violation_id] = violation

                # Create incident if needed
                if self.config.auto_create_incidents and violation.severity in [
                    "high",
                    "critical",
                ]:
                    await self._create_incident_for_violation(violation)

            return violations

        except Exception as e:
            self.logger.error(f"DLP policy check failed: {e}")
            return []

    def _get_applicable_rules(
        self,
        user_id: Optional[str],
        resource_id: Optional[str],
        content_type: ContentType,
    ) -> List[DLPRule]:
        """Get DLP rules applicable to the context"""
        applicable_rules = []

        for rule in self.dlp_rules.values():
            if not rule.active:
                continue

            # Check content type
            if rule.content_types and content_type not in rule.content_types:
                continue

            # Check user scope
            if user_id:
                if rule.excluded_users and user_id in rule.excluded_users:
                    continue
                if rule.applies_to_users and user_id not in rule.applies_to_users:
                    continue

            # Check resource scope
            if resource_id:
                if rule.excluded_resources and resource_id in rule.excluded_resources:
                    continue
                if (
                    rule.applies_to_resources
                    and resource_id not in rule.applies_to_resources
                ):
                    continue

            applicable_rules.append(rule)

        # Sort by priority
        return sorted(applicable_rules, key=lambda r: r.priority)

    async def _evaluate_rule(
        self,
        rule: DLPRule,
        scan_result: ScanResult,
        user_id: Optional[str],
        resource_id: Optional[str],
        action: Optional[str],
    ) -> Optional[DLPViolation]:
        """Evaluate a DLP rule against scan result"""
        try:
            # Check if rule patterns match scan results
            matching_patterns = []
            for pattern_id in rule.data_patterns:
                if pattern_id in scan_result.patterns_found:
                    matching_patterns.append(pattern_id)

            # Check minimum matches
            if len(matching_patterns) < rule.minimum_matches:
                return None

            # Check pattern matching logic (AND vs OR)
            if rule.require_all_patterns:
                if set(rule.data_patterns) != set(matching_patterns):
                    return None

            # Check confidence threshold
            if scan_result.overall_confidence < rule.confidence_threshold:
                return None

            # Check sensitivity levels
            if rule.sensitivity_levels and scan_result.max_sensitivity:
                if scan_result.max_sensitivity not in rule.sensitivity_levels:
                    return None

            # Create violation
            violation_type = DLPViolationType.POLICY_VIOLATION
            if action == "export" or action == "download":
                violation_type = DLPViolationType.DATA_EXFILTRATION

            violation = DLPViolation(
                violation_type=violation_type,
                severity=self._calculate_violation_severity(rule, scan_result),
                user_id=user_id,
                resource_id=resource_id,
                content_id=scan_result.content_id,
                action_attempted=action,
                triggered_rules=[rule.rule_id],
                matched_patterns=matching_patterns,
                scan_result_id=scan_result.scan_id,
                description=f"DLP rule violation: {rule.rule_name}",
                evidence={
                    "rule_name": rule.rule_name,
                    "patterns_matched": len(matching_patterns),
                    "confidence_score": scan_result.overall_confidence,
                    "sensitivity_level": scan_result.max_sensitivity.value
                    if scan_result.max_sensitivity
                    else None,
                    "data_types": scan_result.data_types_detected,
                },
                confidence_score=scan_result.overall_confidence,
                action_taken=rule.violation_action,
                blocked=(rule.violation_action == DLPAction.BLOCK),
                quarantined=(rule.violation_action == DLPAction.QUARANTINE),
                user_notified=rule.notify_user,
                admin_notified=rule.notify_admin,
                source_ip=scan_result.source_ip,
            )

            return violation

        except Exception as e:
            self.logger.error(f"Rule evaluation failed for rule {rule.rule_name}: {e}")
            return None

    def _calculate_violation_severity(
        self, rule: DLPRule, scan_result: ScanResult
    ) -> str:
        """Calculate violation severity based on rule and scan result"""
        base_severity = "medium"

        # Increase severity based on sensitivity
        if scan_result.max_sensitivity == DataSensitivityLevel.TOP_SECRET:
            base_severity = "critical"
        elif scan_result.max_sensitivity == DataSensitivityLevel.RESTRICTED:
            base_severity = "high"
        elif scan_result.max_sensitivity == DataSensitivityLevel.CONFIDENTIAL:
            base_severity = "medium"

        # Increase severity based on confidence
        if scan_result.overall_confidence >= 0.9:
            if base_severity == "medium":
                base_severity = "high"
            elif base_severity == "low":
                base_severity = "medium"

        # Increase severity based on number of patterns
        if len(scan_result.patterns_found) >= 3:
            if base_severity == "low":
                base_severity = "medium"
            elif base_severity == "medium":
                base_severity = "high"

        return base_severity

    async def _create_incident_for_violation(self, violation: DLPViolation):
        """Create security incident for high-severity violations"""
        try:
            incident = DLPIncident(
                title=f"DLP Violation: {violation.description}",
                description=f"High-severity DLP violation detected for user {violation.user_id}",
                severity=violation.severity,
                related_violations=[violation.violation_id],
                violation_count=1,
                affected_users=[violation.user_id] if violation.user_id else [],
                affected_resources=[violation.resource_id]
                if violation.resource_id
                else [],
                data_types_involved=violation.evidence.get("data_types", []),
                status="open",
                created_by="dlp_system",
            )

            self.incidents[incident.incident_id] = incident

            self.logger.warning(
                f"Created DLP incident {incident.incident_id} for violation {violation.violation_id}"
            )

        except Exception as e:
            self.logger.error(
                f"Failed to create incident for violation {violation.violation_id}: {e}"
            )

    # Background Processing

    async def _start_background_scanner(self):
        """Start background scanning tasks"""
        if not self.config.enable_background_scanning:
            return

        # Start scanner workers
        for i in range(self.config.max_concurrent_scans):
            asyncio.create_task(self._scan_worker(f"worker_{i}"))

    async def _scan_worker(self, worker_name: str):
        """Background scan worker"""
        while True:
            try:
                # Get scan task from queue
                scan_task = await self.scan_queue.get()

                # Process scan
                await self._process_background_scan(scan_task)

                # Mark task as done
                self.scan_queue.task_done()

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Background scan worker {worker_name} error: {e}")

    async def _process_background_scan(self, scan_task: Dict[str, Any]):
        """Process a background scan task"""
        try:
            content = scan_task["content"]
            content_type = scan_task["content_type"]
            user_id = scan_task.get("user_id")
            content_id = scan_task.get("content_id")

            # Perform scan
            scan_result = await self.scan_content(
                content=content,
                content_type=content_type,
                user_id=user_id,
                content_id=content_id,
            )

            # Check policies if patterns were found
            if scan_result.patterns_found:
                violations = await self.check_dlp_policies(
                    scan_result=scan_result,
                    user_id=user_id,
                    resource_id=scan_task.get("resource_id"),
                    action=scan_task.get("action"),
                )

                if violations:
                    self.logger.info(
                        f"Background scan found {len(violations)} violations"
                    )

        except Exception as e:
            self.logger.error(f"Background scan processing failed: {e}")

    # Public API Methods

    async def queue_background_scan(
        self,
        content: str,
        content_type: ContentType,
        user_id: Optional[str] = None,
        content_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        action: Optional[str] = None,
    ) -> bool:
        """Queue content for background scanning"""
        try:
            scan_task = {
                "content": content,
                "content_type": content_type,
                "user_id": user_id,
                "content_id": content_id,
                "resource_id": resource_id,
                "action": action,
                "queued_at": datetime.now(timezone.utc),
            }

            await self.scan_queue.put(scan_task)
            return True

        except asyncio.QueueFull:
            self.logger.warning("Scan queue is full, dropping background scan request")
            return False
        except Exception as e:
            self.logger.error(f"Failed to queue background scan: {e}")
            return False

    async def scan_and_enforce(
        self,
        content: str,
        content_type: ContentType,
        user_id: str,
        resource_id: Optional[str] = None,
        action: str = "access",
        source_ip: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Scan content and enforce DLP policies"""
        try:
            # Perform content scan
            scan_result = await self.scan_content(
                content=content,
                content_type=content_type,
                user_id=user_id,
                content_id=resource_id,
                source_ip=source_ip,
            )

            # Check policies if sensitive data found
            violations = []
            if scan_result.patterns_found:
                violations = await self.check_dlp_policies(
                    scan_result=scan_result,
                    user_id=user_id,
                    resource_id=resource_id,
                    action=action,
                )

            # Determine enforcement action
            allowed = True
            action_taken = DLPAction.ALLOW
            blocked_reasons = []

            for violation in violations:
                if violation.action_taken == DLPAction.BLOCK:
                    allowed = False
                    action_taken = DLPAction.BLOCK
                    blocked_reasons.append(violation.description)
                elif violation.action_taken == DLPAction.QUARANTINE:
                    # Quarantine content
                    allowed = False
                    action_taken = DLPAction.QUARANTINE

            return {
                "allowed": allowed,
                "action_taken": action_taken,
                "scan_result": {
                    "scan_id": scan_result.scan_id,
                    "patterns_found": len(scan_result.patterns_found),
                    "confidence": scan_result.overall_confidence,
                    "sensitivity": scan_result.max_sensitivity.value
                    if scan_result.max_sensitivity
                    else None,
                    "data_types": scan_result.data_types_detected,
                },
                "violations": [
                    {
                        "violation_id": v.violation_id,
                        "severity": v.severity,
                        "description": v.description,
                        "action_taken": v.action_taken,
                    }
                    for v in violations
                ],
                "blocked_reasons": blocked_reasons,
            }

        except Exception as e:
            self.logger.error(f"DLP scan and enforcement failed: {e}")
            # Fail secure - block on error
            return {
                "allowed": False,
                "action_taken": DLPAction.BLOCK,
                "error": str(e),
                "blocked_reasons": ["DLP system error"],
            }

    # Management and Query Methods

    def get_violation_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get violation summary for the specified time period"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)

        recent_violations = [
            v for v in self.violations.values() if v.detected_at >= cutoff_time
        ]

        # Count by severity
        severity_counts = {}
        for violation in recent_violations:
            severity_counts[violation.severity] = (
                severity_counts.get(violation.severity, 0) + 1
            )

        # Count by type
        type_counts = {}
        for violation in recent_violations:
            type_counts[violation.violation_type] = (
                type_counts.get(violation.violation_type, 0) + 1
            )

        # Top data types
        data_type_counts = {}
        for violation in recent_violations:
            for data_type in violation.evidence.get("data_types", []):
                data_type_counts[data_type] = data_type_counts.get(data_type, 0) + 1

        return {
            "time_period_hours": hours,
            "total_violations": len(recent_violations),
            "violations_by_severity": severity_counts,
            "violations_by_type": type_counts,
            "top_data_types": dict(
                sorted(data_type_counts.items(), key=lambda x: x[1], reverse=True)[:10]
            ),
            "blocked_actions": len([v for v in recent_violations if v.blocked]),
            "quarantined_items": len([v for v in recent_violations if v.quarantined]),
        }

    def get_user_violations(self, user_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get violations for a specific user"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(days=days)

        user_violations = [
            v
            for v in self.violations.values()
            if v.user_id == user_id and v.detected_at >= cutoff_time
        ]

        return [
            {
                "violation_id": v.violation_id,
                "violation_type": v.violation_type,
                "severity": v.severity,
                "description": v.description,
                "action_taken": v.action_taken,
                "detected_at": v.detected_at.isoformat(),
                "blocked": v.blocked,
                "resolved": v.resolved,
            }
            for v in sorted(user_violations, key=lambda x: x.detected_at, reverse=True)
        ]

    async def cleanup_old_data(self) -> Dict[str, int]:
        """Clean up old scan results, violations, and cache"""
        now = datetime.now(timezone.utc)
        cleanup_stats = {}

        # Clean old scan results
        scan_cutoff = now - timedelta(days=self.config.retain_scan_results_days)
        old_scans = [
            scan_id
            for scan_id, scan in self.scan_results.items()
            if scan.scanned_at < scan_cutoff
        ]

        for scan_id in old_scans:
            del self.scan_results[scan_id]

        cleanup_stats["old_scan_results"] = len(old_scans)

        # Clean old violations (but keep for compliance)
        violation_cutoff = now - timedelta(days=self.config.retain_violations_days)
        old_violations = [
            violation_id
            for violation_id, violation in self.violations.items()
            if violation.detected_at < violation_cutoff and violation.resolved
        ]

        for violation_id in old_violations:
            del self.violations[violation_id]

        cleanup_stats["old_violations"] = len(old_violations)

        # Clean scan cache
        cache_cutoff = now - timedelta(hours=self.config.cache_ttl_hours)
        old_cache_entries = [
            cache_key
            for cache_key, result in self.scan_cache.items()
            if result.scanned_at < cache_cutoff
        ]

        for cache_key in old_cache_entries:
            del self.scan_cache[cache_key]

        cleanup_stats["cache_entries_removed"] = len(old_cache_entries)

        return cleanup_stats

    def get_statistics(self) -> Dict[str, Any]:
        """Get DLP system statistics"""
        total_violations = len(self.violations)
        active_incidents = len(
            [i for i in self.incidents.values() if i.status == "open"]
        )

        return {
            "data_patterns": len(self.data_patterns),
            "active_patterns": len(
                [p for p in self.data_patterns.values() if p.active]
            ),
            "dlp_rules": len(self.dlp_rules),
            "active_rules": len([r for r in self.dlp_rules.values() if r.active]),
            "total_scans": len(self.scan_results),
            "total_violations": total_violations,
            "active_incidents": active_incidents,
            "cache_entries": len(self.scan_cache),
            "queue_size": self.scan_queue.qsize(),
        }

# Factory functions
def create_dlp_system(config: Optional[DLPConfiguration] = None) -> DLPSystem:
    """Create DLP system instance"""
    return DLPSystem(config)

def create_test_dlp_config() -> DLPConfiguration:
    """Create test DLP configuration"""
    return DLPConfiguration(
        scan_timeout_seconds=5,
        max_concurrent_scans=2,
        scan_queue_size=100,
        retain_scan_results_days=7,
        cache_ttl_hours=1,
    )
