"""
Evidence Management Module

Provides comprehensive evidence collection, organization, and tracking for compliance purposes including:
- Evidence collection from various sources
- Evidence organization and categorization  
- Evidence validity and expiration tracking
- Evidence linking to compliance requirements
- Evidence quality assessment and scoring
- Evidence backup, archival, and retrieval
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum
import json
import hashlib
from datetime import datetime, date, timedelta
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
import mimetypes
from ...core.utils import uuid7str

class EvidenceType(Enum):
	"""Types of compliance evidence"""
	DOCUMENT = "document"
	CERTIFICATE = "certificate"  
	AUDIT_REPORT = "audit_report"
	COMPLIANCE_RECORD = "compliance_record"
	FINANCIAL_RECORD = "financial_record"
	PERFORMANCE_RECORD = "performance_record"
	TRAINING_RECORD = "training_record"
	POLICY_DOCUMENT = "policy_document"
	PROCEDURE_DOCUMENT = "procedure_document"
	CONTRACT = "contract"
	LICENSE = "license"
	PERMIT = "permit"
	INSURANCE = "insurance"
	REGISTRATION = "registration"
	SCREENSHOT = "screenshot"
	EMAIL = "email"
	LOG_FILE = "log_file"
	CUSTOM = "custom"

class EvidenceStatus(Enum):
	"""Evidence status enumeration"""
	ACTIVE = "active"
	PENDING_REVIEW = "pending_review"
	EXPIRED = "expired"
	EXPIRING_SOON = "expiring_soon"
	INVALID = "invalid"
	ARCHIVED = "archived"
	MISSING = "missing"
	UNDER_REVIEW = "under_review"
	REJECTED = "rejected"

class EvidenceSource(Enum):
	"""Sources of evidence"""
	INTERNAL_SYSTEM = "internal_system"
	EXTERNAL_PROVIDER = "external_provider"
	MANUAL_UPLOAD = "manual_upload"
	AUTOMATED_COLLECTION = "automated_collection"
	API_INTEGRATION = "api_integration"
	EMAIL_IMPORT = "email_import"
	SCAN_UPLOAD = "scan_upload"
	THIRD_PARTY = "third_party"

class EvidenceQuality(Enum):
	"""Evidence quality levels"""
	EXCELLENT = "excellent"
	GOOD = "good"
	ACCEPTABLE = "acceptable"
	POOR = "poor"
	INSUFFICIENT = "insufficient"

@dataclass
class EvidenceLink:
	"""Links evidence to compliance requirements"""
	link_id: str = field(default_factory=uuid7str)
	requirement_id: str = ""
	framework_code: str = ""
	rule_code: str = ""
	relationship: str = "supports"  # supports, demonstrates, proves, contradicts
	relevance_score: float = 0.0  # 0.0 to 1.0
	notes: str = ""
	verified: bool = False
	verified_by: str = ""
	verified_date: Optional[datetime] = None
	metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass  
class EvidenceQualityMetrics:
	"""Quality assessment metrics for evidence"""
	completeness_score: float = 0.0  # 0.0 to 1.0
	accuracy_score: float = 0.0
	timeliness_score: float = 0.0
	authenticity_score: float = 0.0
	relevance_score: float = 0.0
	overall_quality_score: float = 0.0
	quality_level: EvidenceQuality = EvidenceQuality.INSUFFICIENT
	assessment_notes: List[str] = field(default_factory=list)
	assessment_date: datetime = field(default_factory=datetime.now)
	assessed_by: str = ""
	confidence_level: float = 0.0

class EvidenceRecord(BaseModel):
	"""Comprehensive evidence record"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_default=True)
	
	# Basic information
	evidence_id: str = Field(default_factory=uuid7str)
	title: str
	description: str = ""
	evidence_type: EvidenceType
	category: str = ""
	subcategory: str = ""
	
	# Source information
	source: EvidenceSource
	source_location: str = ""  # File path, URL, system name
	source_reference: str = ""  # Reference number, case ID, etc.
	collected_by: str = ""
	collection_method: str = ""
	
	# Content information
	file_name: str = ""
	file_path: str = ""
	file_size_bytes: int = 0
	mime_type: str = ""
	file_hash: str = ""  # SHA-256 hash for integrity
	content_preview: str = ""
	full_content: str = ""
	
	# Metadata
	tags: List[str] = Field(default_factory=list)
	keywords: List[str] = Field(default_factory=list)
	custom_fields: Dict[str, Any] = Field(default_factory=dict)
	
	# Validity and lifecycle
	effective_date: Optional[date] = None
	expiration_date: Optional[date] = None
	review_date: Optional[date] = None
	status: EvidenceStatus = EvidenceStatus.PENDING_REVIEW
	
	# Links and relationships
	compliance_links: List[EvidenceLink] = Field(default_factory=list)
	related_evidence: List[str] = Field(default_factory=list)  # Evidence IDs
	superseded_by: Optional[str] = None  # Evidence ID that replaces this
	supersedes: List[str] = Field(default_factory=list)  # Evidence IDs this replaces
	
	# Quality assessment
	quality_metrics: EvidenceQualityMetrics = Field(default_factory=EvidenceQualityMetrics)
	
	# Audit trail
	created_date: datetime = Field(default_factory=datetime.now)
	created_by: str = ""
	last_updated: datetime = Field(default_factory=datetime.now)
	updated_by: str = ""
	access_history: List[Dict[str, Any]] = Field(default_factory=list)
	
	# Backup and archival
	backup_locations: List[str] = Field(default_factory=list)
	archived: bool = False
	archive_date: Optional[datetime] = None
	retention_period_days: Optional[int] = None
	
	# Additional metadata
	metadata: Dict[str, Any] = Field(default_factory=dict)

class EvidenceSearchCriteria(BaseModel):
	"""Search criteria for evidence"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_default=True)
	
	# Text search
	search_query: Optional[str] = None
	title_contains: Optional[str] = None
	description_contains: Optional[str] = None
	content_contains: Optional[str] = None
	
	# Filters
	evidence_types: List[EvidenceType] = Field(default_factory=list)
	categories: List[str] = Field(default_factory=list)
	statuses: List[EvidenceStatus] = Field(default_factory=list)
	sources: List[EvidenceSource] = Field(default_factory=list)
	tags: List[str] = Field(default_factory=list)
	
	# Date filters
	created_after: Optional[datetime] = None
	created_before: Optional[datetime] = None
	effective_after: Optional[date] = None
	effective_before: Optional[date] = None
	expiring_within_days: Optional[int] = None
	
	# Quality filters
	min_quality_score: Optional[float] = None
	quality_levels: List[EvidenceQuality] = Field(default_factory=list)
	
	# Compliance filters
	framework_codes: List[str] = Field(default_factory=list)
	requirement_ids: List[str] = Field(default_factory=list)
	rule_codes: List[str] = Field(default_factory=list)
	
	# Result controls
	limit: Optional[int] = None
	offset: int = 0
	sort_by: str = "created_date"
	sort_order: str = "desc"

class EvidenceManager:
	"""
	Comprehensive evidence management system for compliance purposes.
	
	Manages the complete lifecycle of compliance evidence including collection,
	organization, quality assessment, linking to requirements, and archival.
	"""
	
	# Expose enums as class attributes for backward compatibility
	EvidenceSource = EvidenceSource
	EvidenceType = EvidenceType
	EvidenceStatus = EvidenceStatus
	EvidenceQuality = EvidenceQuality
	
	def __init__(self, storage_path: Optional[str] = None):
		self.evidence_database: Dict[str, EvidenceRecord] = {}
		self.storage_path = Path(storage_path) if storage_path else Path("./evidence_storage")
		self.storage_path.mkdir(parents=True, exist_ok=True)
		
		# Initialize evidence categories
		self.evidence_categories = {
			"regulatory": "Regulatory Compliance Evidence",
			"financial": "Financial and Accounting Records",
			"performance": "Performance and Quality Records",
			"training": "Training and Certification Records",
			"security": "Security and Privacy Evidence",
			"operational": "Operational Procedures and Policies",
			"audit": "Audit and Assessment Reports",
			"legal": "Legal Documents and Contracts",
			"insurance": "Insurance and Risk Management",
			"environmental": "Environmental Compliance"
		}
		
		# Quality assessment weights
		self.quality_weights = {
			"completeness": 0.25,
			"accuracy": 0.25,
			"timeliness": 0.20,
			"authenticity": 0.15,
			"relevance": 0.15
		}
	
	async def collect_evidence(
		self,
		title: str,
		evidence_type: EvidenceType,
		source: EvidenceSource,
		source_location: str = "",
		file_path: Optional[str] = None,
		content: Optional[str] = None,
		description: str = "",
		category: str = "",
		tags: Optional[List[str]] = None,
		effective_date: Optional[date] = None,
		expiration_date: Optional[date] = None,
		collected_by: str = "",
		metadata: Optional[Dict[str, Any]] = None
	) -> EvidenceRecord:
		"""
		Collect and store new evidence
		
		Args:
			title: Evidence title/name
			evidence_type: Type of evidence
			source: Source of the evidence
			source_location: Location/reference for the source
			file_path: Path to evidence file (if applicable)
			content: Text content of evidence
			description: Detailed description
			category: Evidence category
			tags: Tags for organization
			effective_date: When evidence becomes effective
			expiration_date: When evidence expires
			collected_by: Person collecting the evidence
			metadata: Additional metadata
			
		Returns:
			EvidenceRecord for the collected evidence
		"""
		evidence_id = uuid7str()
		
		# Initialize collections
		if tags is None:
			tags = []
		if metadata is None:
			metadata = {}
		
		# Process file if provided
		file_info = {}
		if file_path and Path(file_path).exists():
			file_info = await self._process_evidence_file(file_path)
		
		# Create evidence record
		evidence = EvidenceRecord(
			evidence_id=evidence_id,
			title=title,
			description=description,
			evidence_type=evidence_type,
			category=category or self._determine_category(evidence_type),
			source=source,
			source_location=source_location,
			collected_by=collected_by,
			file_name=file_info.get("file_name", ""),
			file_path=file_info.get("stored_path", ""),
			file_size_bytes=file_info.get("file_size", 0),
			mime_type=file_info.get("mime_type", ""),
			file_hash=file_info.get("file_hash", ""),
			content_preview=file_info.get("content_preview", ""),
			full_content=content or file_info.get("full_content", ""),
			tags=tags,
			effective_date=effective_date,
			expiration_date=expiration_date,
			status=EvidenceStatus.PENDING_REVIEW,
			created_by=collected_by,
			metadata=metadata
		)
		
		# Perform initial quality assessment
		await self._assess_evidence_quality(evidence)
		
		# Store evidence
		self.evidence_database[evidence_id] = evidence
		
		# Log collection
		await self._log_evidence_access(evidence_id, "collected", collected_by)
		
		return evidence
	
	async def _process_evidence_file(self, file_path: str) -> Dict[str, Any]:
		"""Process evidence file and extract metadata"""
		path = Path(file_path)
		
		if not path.exists():
			raise FileNotFoundError(f"Evidence file not found: {file_path}")
		
		# Get file information
		file_info = {
			"file_name": path.name,
			"file_size": path.stat().st_size,
			"mime_type": mimetypes.guess_type(str(path))[0] or "application/octet-stream"
		}
		
		# Calculate file hash
		file_info["file_hash"] = await self._calculate_file_hash(path)
		
		# Store file in evidence storage
		stored_path = await self._store_evidence_file(path)
		file_info["stored_path"] = str(stored_path)
		
		# Extract content preview
		try:
			if file_info["mime_type"].startswith("text/"):
				content = path.read_text(encoding="utf-8", errors="ignore")
				file_info["full_content"] = content
				file_info["content_preview"] = content[:500] + "..." if len(content) > 500 else content
			else:
				file_info["content_preview"] = f"Binary file: {file_info['mime_type']}"
				file_info["full_content"] = ""
		except Exception as e:
			file_info["content_preview"] = f"Error reading file: {str(e)}"
			file_info["full_content"] = ""
		
		return file_info
	
	async def _calculate_file_hash(self, file_path: Path) -> str:
		"""Calculate SHA-256 hash of file"""
		hash_sha256 = hashlib.sha256()
		with open(file_path, "rb") as f:
			for chunk in iter(lambda: f.read(4096), b""):
				hash_sha256.update(chunk)
		return hash_sha256.hexdigest()
	
	async def _store_evidence_file(self, source_path: Path) -> Path:
		"""Store evidence file in evidence storage"""
		# Create date-based storage structure
		now = datetime.now()
		storage_dir = self.storage_path / str(now.year) / f"{now.month:02d}" / f"{now.day:02d}"
		storage_dir.mkdir(parents=True, exist_ok=True)
		
		# Create unique filename to avoid conflicts
		stored_name = f"{uuid7str()}_{source_path.name}"
		stored_path = storage_dir / stored_name
		
		# Copy file to storage
		import shutil
		shutil.copy2(source_path, stored_path)
		
		return stored_path
	
	def _determine_category(self, evidence_type: EvidenceType) -> str:
		"""Determine category based on evidence type"""
		type_category_map = {
			EvidenceType.DOCUMENT: "regulatory",
			EvidenceType.CERTIFICATE: "regulatory", 
			EvidenceType.AUDIT_REPORT: "audit",
			EvidenceType.COMPLIANCE_RECORD: "regulatory",
			EvidenceType.FINANCIAL_RECORD: "financial",
			EvidenceType.PERFORMANCE_RECORD: "performance",
			EvidenceType.TRAINING_RECORD: "training",
			EvidenceType.POLICY_DOCUMENT: "operational",
			EvidenceType.PROCEDURE_DOCUMENT: "operational",
			EvidenceType.CONTRACT: "legal",
			EvidenceType.LICENSE: "regulatory",
			EvidenceType.PERMIT: "regulatory",
			EvidenceType.INSURANCE: "insurance",
			EvidenceType.REGISTRATION: "regulatory"
		}
		return type_category_map.get(evidence_type, "regulatory")
	
	async def _assess_evidence_quality(self, evidence: EvidenceRecord) -> None:
		"""Assess the quality of evidence"""
		metrics = EvidenceQualityMetrics()
		
		# Assess completeness (required fields filled, content present)
		completeness_factors = []
		if evidence.title: completeness_factors.append(1.0)
		if evidence.description: completeness_factors.append(1.0)
		if evidence.source_location: completeness_factors.append(1.0)
		if evidence.full_content or evidence.file_path: completeness_factors.append(1.0)
		if evidence.effective_date: completeness_factors.append(0.8)
		if evidence.tags: completeness_factors.append(0.6)
		
		metrics.completeness_score = sum(completeness_factors) / 6.0
		
		# Assess timeliness (how recent/current is the evidence)
		if evidence.effective_date:
			days_since_effective = (date.today() - evidence.effective_date).days
			if days_since_effective <= 30:
				metrics.timeliness_score = 1.0
			elif days_since_effective <= 90:
				metrics.timeliness_score = 0.8
			elif days_since_effective <= 365:
				metrics.timeliness_score = 0.6
			else:
				metrics.timeliness_score = 0.3
		else:
			metrics.timeliness_score = 0.5  # Unknown age
		
		# Assess authenticity (file integrity, source credibility)
		authenticity_score = 0.7  # Base score
		if evidence.file_hash: authenticity_score += 0.2
		if evidence.source in [EvidenceSource.INTERNAL_SYSTEM, EvidenceSource.API_INTEGRATION]:
			authenticity_score += 0.1
		metrics.authenticity_score = min(1.0, authenticity_score)
		
		# Assess accuracy (assume good for now, could be improved with validation)
		metrics.accuracy_score = 0.8
		
		# Assess relevance (based on compliance links - will be updated when linked)
		metrics.relevance_score = 0.5  # Default until linked to requirements
		
		# Calculate overall score
		overall_score = (
			metrics.completeness_score * self.quality_weights["completeness"] +
			metrics.accuracy_score * self.quality_weights["accuracy"] +
			metrics.timeliness_score * self.quality_weights["timeliness"] +
			metrics.authenticity_score * self.quality_weights["authenticity"] +
			metrics.relevance_score * self.quality_weights["relevance"]
		)
		metrics.overall_quality_score = overall_score
		
		# Determine quality level
		if overall_score >= 0.9:
			metrics.quality_level = EvidenceQuality.EXCELLENT
		elif overall_score >= 0.75:
			metrics.quality_level = EvidenceQuality.GOOD
		elif overall_score >= 0.6:
			metrics.quality_level = EvidenceQuality.ACCEPTABLE
		elif overall_score >= 0.4:
			metrics.quality_level = EvidenceQuality.POOR
		else:
			metrics.quality_level = EvidenceQuality.INSUFFICIENT
		
		# Add assessment notes
		if metrics.completeness_score < 0.7:
			metrics.assessment_notes.append("Missing some required information fields")
		if metrics.timeliness_score < 0.5:
			metrics.assessment_notes.append("Evidence may be outdated")
		if metrics.authenticity_score < 0.8:
			metrics.assessment_notes.append("Could benefit from stronger authentication")
		
		metrics.assessment_date = datetime.now()
		evidence.quality_metrics = metrics
	
	async def link_evidence_to_requirement(
		self,
		evidence_id: str,
		requirement_id: str,
		framework_code: str,
		rule_code: str = "",
		relationship: str = "supports",
		relevance_score: float = 1.0,
		notes: str = "",
		verified_by: str = ""
	) -> bool:
		"""
		Link evidence to compliance requirement
		
		Args:
			evidence_id: ID of evidence to link
			requirement_id: ID of compliance requirement
			framework_code: Framework code (FAR, DFARS, etc.)
			rule_code: Specific rule code
			relationship: Type of relationship (supports, demonstrates, proves, etc.)
			relevance_score: How relevant the evidence is (0.0 to 1.0)
			notes: Additional notes about the link
			verified_by: Who verified the link
			
		Returns:
			True if link was created successfully
		"""
		if evidence_id not in self.evidence_database:
			return False
		
		evidence = self.evidence_database[evidence_id]
		
		# Create evidence link
		link = EvidenceLink(
			requirement_id=requirement_id,
			framework_code=framework_code,
			rule_code=rule_code,
			relationship=relationship,
			relevance_score=relevance_score,
			notes=notes,
			verified=bool(verified_by),
			verified_by=verified_by,
			verified_date=datetime.now() if verified_by else None
		)
		
		evidence.compliance_links.append(link)
		
		# Update relevance score in quality metrics
		if evidence.quality_metrics.relevance_score < relevance_score:
			evidence.quality_metrics.relevance_score = relevance_score
			await self._recalculate_quality_score(evidence)
		
		# Log the linking
		await self._log_evidence_access(evidence_id, "linked_to_requirement", verified_by)
		
		evidence.last_updated = datetime.now()
		evidence.updated_by = verified_by
		
		return True
	
	async def _recalculate_quality_score(self, evidence: EvidenceRecord) -> None:
		"""Recalculate overall quality score"""
		metrics = evidence.quality_metrics
		
		overall_score = (
			metrics.completeness_score * self.quality_weights["completeness"] +
			metrics.accuracy_score * self.quality_weights["accuracy"] +
			metrics.timeliness_score * self.quality_weights["timeliness"] +
			metrics.authenticity_score * self.quality_weights["authenticity"] +
			metrics.relevance_score * self.quality_weights["relevance"]
		)
		metrics.overall_quality_score = overall_score
		
		# Update quality level
		if overall_score >= 0.9:
			metrics.quality_level = EvidenceQuality.EXCELLENT
		elif overall_score >= 0.75:
			metrics.quality_level = EvidenceQuality.GOOD
		elif overall_score >= 0.6:
			metrics.quality_level = EvidenceQuality.ACCEPTABLE
		elif overall_score >= 0.4:
			metrics.quality_level = EvidenceQuality.POOR
		else:
			metrics.quality_level = EvidenceQuality.INSUFFICIENT
	
	async def search_evidence(
		self,
		criteria: EvidenceSearchCriteria
	) -> List[EvidenceRecord]:
		"""
		Search evidence based on criteria
		
		Args:
			criteria: Search criteria
			
		Returns:
			List of matching evidence records
		"""
		results = []
		
		for evidence in self.evidence_database.values():
			if await self._matches_criteria(evidence, criteria):
				results.append(evidence)
		
		# Apply sorting
		if criteria.sort_by == "created_date":
			results.sort(key=lambda x: x.created_date, reverse=criteria.sort_order == "desc")
		elif criteria.sort_by == "quality_score":
			results.sort(key=lambda x: x.quality_metrics.overall_quality_score, reverse=criteria.sort_order == "desc")
		elif criteria.sort_by == "title":
			results.sort(key=lambda x: x.title.lower(), reverse=criteria.sort_order == "desc")
		elif criteria.sort_by == "expiration_date":
			results.sort(key=lambda x: x.expiration_date or date.max, reverse=criteria.sort_order == "desc")
		
		# Apply limit and offset
		if criteria.offset > 0:
			results = results[criteria.offset:]
		if criteria.limit:
			results = results[:criteria.limit]
		
		return results
	
	async def _matches_criteria(self, evidence: EvidenceRecord, criteria: EvidenceSearchCriteria) -> bool:
		"""Check if evidence matches search criteria"""
		
		# Text search
		if criteria.search_query:
			query_lower = criteria.search_query.lower()
			if not any([
				query_lower in evidence.title.lower(),
				query_lower in evidence.description.lower(),
				query_lower in evidence.full_content.lower(),
				any(query_lower in tag.lower() for tag in evidence.tags)
			]):
				return False
		
		if criteria.title_contains and criteria.title_contains.lower() not in evidence.title.lower():
			return False
		
		if criteria.description_contains and criteria.description_contains.lower() not in evidence.description.lower():
			return False
		
		if criteria.content_contains and criteria.content_contains.lower() not in evidence.full_content.lower():
			return False
		
		# Filter checks
		if criteria.evidence_types and evidence.evidence_type not in criteria.evidence_types:
			return False
		
		if criteria.categories and evidence.category not in criteria.categories:
			return False
		
		if criteria.statuses and evidence.status not in criteria.statuses:
			return False
		
		if criteria.sources and evidence.source not in criteria.sources:
			return False
		
		if criteria.tags and not any(tag in evidence.tags for tag in criteria.tags):
			return False
		
		# Date filters
		if criteria.created_after and evidence.created_date < criteria.created_after:
			return False
		
		if criteria.created_before and evidence.created_date > criteria.created_before:
			return False
		
		if criteria.effective_after and (not evidence.effective_date or evidence.effective_date < criteria.effective_after):
			return False
		
		if criteria.effective_before and (not evidence.effective_date or evidence.effective_date > criteria.effective_before):
			return False
		
		# Expiring soon filter
		if criteria.expiring_within_days:
			if not evidence.expiration_date:
				return False
			days_to_expiry = (evidence.expiration_date - date.today()).days
			if days_to_expiry > criteria.expiring_within_days:
				return False
		
		# Quality filters
		if criteria.min_quality_score and evidence.quality_metrics.overall_quality_score < criteria.min_quality_score:
			return False
		
		if criteria.quality_levels and evidence.quality_metrics.quality_level not in criteria.quality_levels:
			return False
		
		# Compliance filters
		if criteria.framework_codes:
			if not any(link.framework_code in criteria.framework_codes for link in evidence.compliance_links):
				return False
		
		if criteria.requirement_ids:
			if not any(link.requirement_id in criteria.requirement_ids for link in evidence.compliance_links):
				return False
		
		if criteria.rule_codes:
			if not any(link.rule_code in criteria.rule_codes for link in evidence.compliance_links):
				return False
		
		return True
	
	async def get_evidence_by_id(self, evidence_id: str, accessed_by: str = "") -> Optional[EvidenceRecord]:
		"""Get evidence by ID"""
		if evidence_id not in self.evidence_database:
			return None
		
		evidence = self.evidence_database[evidence_id]
		
		# Log access
		if accessed_by:
			await self._log_evidence_access(evidence_id, "accessed", accessed_by)
		
		return evidence
	
	async def update_evidence_status(
		self,
		evidence_id: str,
		new_status: EvidenceStatus,
		updated_by: str = "",
		notes: str = ""
	) -> bool:
		"""Update evidence status"""
		if evidence_id not in self.evidence_database:
			return False
		
		evidence = self.evidence_database[evidence_id]
		old_status = evidence.status
		
		evidence.status = new_status
		evidence.last_updated = datetime.now()
		evidence.updated_by = updated_by
		
		# Log status change
		await self._log_evidence_access(
			evidence_id,
			"status_changed",
			updated_by,
			{"old_status": old_status.value, "new_status": new_status.value, "notes": notes}
		)
		
		return True
	
	async def check_expiring_evidence(self, days_ahead: int = 30) -> List[EvidenceRecord]:
		"""Check for evidence expiring within specified days"""
		expiring_evidence = []
		cutoff_date = date.today() + timedelta(days=days_ahead)
		
		for evidence in self.evidence_database.values():
			if evidence.expiration_date and evidence.expiration_date <= cutoff_date:
				if evidence.status not in [EvidenceStatus.EXPIRED, EvidenceStatus.ARCHIVED]:
					expiring_evidence.append(evidence)
		
		# Update status for evidence expiring soon
		for evidence in expiring_evidence:
			if evidence.expiration_date <= date.today():
				evidence.status = EvidenceStatus.EXPIRED
			else:
				evidence.status = EvidenceStatus.EXPIRING_SOON
		
		return expiring_evidence
	
	async def archive_evidence(
		self,
		evidence_id: str,
		archived_by: str = "",
		archive_reason: str = ""
	) -> bool:
		"""Archive evidence"""
		if evidence_id not in self.evidence_database:
			return False
		
		evidence = self.evidence_database[evidence_id]
		
		evidence.status = EvidenceStatus.ARCHIVED
		evidence.archived = True
		evidence.archive_date = datetime.now()
		evidence.last_updated = datetime.now()
		evidence.updated_by = archived_by
		
		# Log archival
		await self._log_evidence_access(
			evidence_id,
			"archived",
			archived_by,
			{"reason": archive_reason}
		)
		
		return True
	
	async def get_evidence_for_requirement(
		self,
		requirement_id: str,
		framework_code: str = "",
		include_related: bool = True
	) -> List[EvidenceRecord]:
		"""Get all evidence linked to a specific requirement"""
		matching_evidence = []
		
		for evidence in self.evidence_database.values():
			for link in evidence.compliance_links:
				if link.requirement_id == requirement_id:
					if not framework_code or link.framework_code == framework_code:
						matching_evidence.append(evidence)
						break
		
		# Include related evidence if requested
		if include_related:
			related_ids = set()
			for evidence in matching_evidence:
				related_ids.update(evidence.related_evidence)
			
			for related_id in related_ids:
				if related_id in self.evidence_database:
					related_evidence = self.evidence_database[related_id]
					if related_evidence not in matching_evidence:
						matching_evidence.append(related_evidence)
		
		return matching_evidence
	
	async def create_evidence_backup(self, backup_location: str) -> Dict[str, Any]:
		"""Create backup of all evidence"""
		backup_info = {
			"backup_date": datetime.now().isoformat(),
			"evidence_count": len(self.evidence_database),
			"backup_location": backup_location,
			"files_backed_up": 0,
			"total_size_bytes": 0
		}
		
		backup_path = Path(backup_location)
		backup_path.mkdir(parents=True, exist_ok=True)
		
		# Export evidence metadata
		evidence_export = {}
		for evidence_id, evidence in self.evidence_database.items():
			evidence_export[evidence_id] = evidence.dict()
		
		metadata_file = backup_path / "evidence_metadata.json"
		with open(metadata_file, 'w') as f:
			json.dump(evidence_export, f, indent=2, default=str)
		
		# Copy evidence files
		files_dir = backup_path / "files"
		files_dir.mkdir(exist_ok=True)
		
		for evidence in self.evidence_database.values():
			if evidence.file_path and Path(evidence.file_path).exists():
				source_path = Path(evidence.file_path)
				dest_path = files_dir / f"{evidence.evidence_id}_{source_path.name}"
				
				import shutil
				shutil.copy2(source_path, dest_path)
				
				backup_info["files_backed_up"] += 1
				backup_info["total_size_bytes"] += source_path.stat().st_size
				
				# Update backup location in evidence
				evidence.backup_locations.append(str(dest_path))
		
		return backup_info
	
	async def _log_evidence_access(
		self,
		evidence_id: str,
		action: str,
		user: str,
		details: Optional[Dict[str, Any]] = None
	) -> None:
		"""Log evidence access for audit trail"""
		if evidence_id not in self.evidence_database:
			return
		
		evidence = self.evidence_database[evidence_id]
		
		access_entry = {
			"timestamp": datetime.now().isoformat(),
			"action": action,
			"user": user,
			"details": details or {}
		}
		
		evidence.access_history.append(access_entry)
		
		# Keep only last 100 access entries
		if len(evidence.access_history) > 100:
			evidence.access_history = evidence.access_history[-100:]
	
	async def get_evidence_statistics(self) -> Dict[str, Any]:
		"""Get evidence statistics"""
		stats = {
			"total_evidence": len(self.evidence_database),
			"by_type": {},
			"by_status": {},
			"by_category": {},
			"by_quality": {},
			"expiring_soon": 0,
			"expired": 0,
			"average_quality_score": 0.0,
			"total_file_size_mb": 0.0,
			"evidence_with_links": 0
		}
		
		total_quality = 0.0
		total_file_size = 0
		
		for evidence in self.evidence_database.values():
			# Count by type
			type_key = evidence.evidence_type.value
			stats["by_type"][type_key] = stats["by_type"].get(type_key, 0) + 1
			
			# Count by status
			status_key = evidence.status.value
			stats["by_status"][status_key] = stats["by_status"].get(status_key, 0) + 1
			
			# Count by category
			if evidence.category:
				stats["by_category"][evidence.category] = stats["by_category"].get(evidence.category, 0) + 1
			
			# Count by quality
			quality_key = evidence.quality_metrics.quality_level.value
			stats["by_quality"][quality_key] = stats["by_quality"].get(quality_key, 0) + 1
			
			# Track expiration
			if evidence.status == EvidenceStatus.EXPIRING_SOON:
				stats["expiring_soon"] += 1
			elif evidence.status == EvidenceStatus.EXPIRED:
				stats["expired"] += 1
			
			# Calculate averages
			total_quality += evidence.quality_metrics.overall_quality_score
			total_file_size += evidence.file_size_bytes
			
			# Count linked evidence
			if evidence.compliance_links:
				stats["evidence_with_links"] += 1
		
		if len(self.evidence_database) > 0:
			stats["average_quality_score"] = total_quality / len(self.evidence_database)
		
		stats["total_file_size_mb"] = total_file_size / (1024 * 1024)
		
		return stats
	
	async def export_evidence_database(self, format: str = "json") -> str:
		"""Export evidence database"""
		if format.lower() != "json":
			raise ValueError(f"Unsupported export format: {format}")
		
		export_data = {
			"export_date": datetime.now().isoformat(),
			"version": "1.0",
			"evidence_count": len(self.evidence_database),
			"evidence": {}
		}
		
		for evidence_id, evidence in self.evidence_database.items():
			export_data["evidence"][evidence_id] = evidence.dict()
		
		return json.dumps(export_data, indent=2, default=str)