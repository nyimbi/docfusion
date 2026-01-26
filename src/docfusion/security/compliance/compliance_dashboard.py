#!/usr/bin/env python3
"""
Compliance Reporting Dashboard

Provides comprehensive compliance reporting and monitoring dashboard
for GDPR, SOC 2, HIPAA, and other regulatory frameworks.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any, Union, Tuple
from enum import Enum
import logging

from pydantic import BaseModel, Field
from uuid_extensions import uuid7str


class ComplianceFramework(str, Enum):
	"""Supported compliance frameworks"""
	GDPR = "gdpr"
	SOC2 = "soc2"
	HIPAA = "hipaa"
	CCPA = "ccpa"
	ISO27001 = "iso27001"
	PCI_DSS = "pci_dss"
	NIST = "nist"


class ComplianceStatus(str, Enum):
	"""Compliance status levels"""
	COMPLIANT = "compliant"
	NON_COMPLIANT = "non_compliant"
	PARTIALLY_COMPLIANT = "partially_compliant"
	UNDER_REVIEW = "under_review"
	UNKNOWN = "unknown"


class RiskLevel(str, Enum):
	"""Risk assessment levels"""
	CRITICAL = "critical"
	HIGH = "high"
	MEDIUM = "medium"
	LOW = "low"
	MINIMAL = "minimal"


class ComplianceMetric(BaseModel):
	"""Individual compliance metric"""
	metric_id: str = Field(default_factory=uuid7str)
	framework: ComplianceFramework
	control_id: str  # Framework-specific control identifier
	control_name: str
	
	# Status and assessment
	status: ComplianceStatus
	risk_level: RiskLevel
	score: float = Field(ge=0, le=100)  # Compliance score (0-100%)
	
	# Evidence and documentation
	evidence: List[str] = Field(default_factory=list)  # Evidence references
	gaps: List[str] = Field(default_factory=list)  # Identified gaps
	remediation_actions: List[str] = Field(default_factory=list)
	
	# Timing
	last_assessed: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	next_assessment_due: datetime
	
	# Responsibility
	responsible_team: str
	reviewer: Optional[str] = None
	
	# Metadata
	notes: Optional[str] = None
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ComplianceFrameworkAssessment(BaseModel):
	"""Overall assessment for a compliance framework"""
	framework: ComplianceFramework
	overall_status: ComplianceStatus
	overall_score: float = Field(ge=0, le=100)
	
	# Detailed scores by category
	category_scores: Dict[str, float] = Field(default_factory=dict)
	
	# Risk assessment
	critical_issues: int = 0
	high_risk_issues: int = 0
	medium_risk_issues: int = 0
	low_risk_issues: int = 0
	
	# Progress tracking
	total_controls: int
	compliant_controls: int
	non_compliant_controls: int
	under_review_controls: int
	
	# Timeline
	assessment_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	next_assessment_due: datetime
	certification_expiry: Optional[datetime] = None
	
	# Trends
	trend_direction: str = "stable"  # improving, declining, stable
	previous_score: Optional[float] = None
	score_change: Optional[float] = None


class ComplianceAlert(BaseModel):
	"""Compliance alert or notification"""
	alert_id: str = Field(default_factory=uuid7str)
	framework: ComplianceFramework
	alert_type: str  # deadline, violation, review_required, etc.
	severity: RiskLevel
	
	# Alert details
	title: str
	description: str
	control_id: Optional[str] = None
	
	# Timing
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	due_date: Optional[datetime] = None
	resolved_at: Optional[datetime] = None
	
	# Assignment
	assigned_to: Optional[str] = None
	acknowledged_by: Optional[str] = None
	acknowledged_at: Optional[datetime] = None
	
	# Resolution
	status: str = "open"  # open, acknowledged, in_progress, resolved
	resolution_notes: Optional[str] = None


class SecurityIncident(BaseModel):
	"""Security incident record"""
	incident_id: str = Field(default_factory=uuid7str)
	title: str
	description: str
	
	# Classification
	incident_type: str  # breach, unauthorized_access, malware, etc.
	severity: RiskLevel
	impact_level: str  # organizational, customer, regulatory
	
	# Affected systems
	affected_systems: List[str] = Field(default_factory=list)
	affected_data_types: List[str] = Field(default_factory=list)
	affected_users_count: int = 0
	
	# Timeline
	discovered_at: datetime
	reported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	resolved_at: Optional[datetime] = None
	
	# Response
	status: str = "open"  # open, investigating, contained, resolved
	response_team: List[str] = Field(default_factory=list)
	containment_actions: List[str] = Field(default_factory=list)
	
	# Compliance impact
	regulatory_notification_required: bool = False
	regulatory_notification_sent: bool = False
	notification_deadline: Optional[datetime] = None
	
	# Post-incident
	root_cause: Optional[str] = None
	lessons_learned: Optional[str] = None
	preventive_measures: List[str] = Field(default_factory=list)


@dataclass
class DashboardConfiguration:
	"""Dashboard configuration settings"""
	# Refresh settings
	auto_refresh_interval_minutes: int = 15
	alert_check_interval_minutes: int = 5
	
	# Display settings
	max_alerts_displayed: int = 50
	max_incidents_displayed: int = 20
	dashboard_timezone: str = "UTC"
	
	# Notification settings
	email_notifications: bool = True
	slack_notifications: bool = False
	critical_alert_immediate_notification: bool = True
	
	# Assessment settings
	default_assessment_interval_days: int = 90
	critical_control_assessment_interval_days: int = 30
	
	# Reporting settings
	generate_monthly_reports: bool = True
	generate_quarterly_reports: bool = True
	retain_historical_data_months: int = 24


class ComplianceDashboard:
	"""Compliance reporting and monitoring dashboard"""
	
	def __init__(self, config: Optional[DashboardConfiguration] = None):
		"""Initialize compliance dashboard"""
		self.config = config or DashboardConfiguration()
		self.logger = logging.getLogger(__name__)
		
		# Storage (in production, use database)
		self.compliance_metrics: Dict[str, ComplianceMetric] = {}
		self.framework_assessments: Dict[ComplianceFramework, ComplianceFrameworkAssessment] = {}
		self.compliance_alerts: Dict[str, ComplianceAlert] = {}
		self.security_incidents: Dict[str, SecurityIncident] = {}
		
		# Historical data
		self.historical_assessments: List[ComplianceFrameworkAssessment] = []
		self.metric_history: Dict[str, List[Tuple[datetime, float]]] = {}  # metric_id -> [(timestamp, score), ...]
		
		# Dashboard state
		self.dashboard_last_updated: Optional[datetime] = None
		
		self.logger.info("Compliance dashboard initialized")
	
	# Framework Assessment Management
	
	async def add_compliance_metric(self, metric: ComplianceMetric) -> str:
		"""Add or update compliance metric"""
		self.compliance_metrics[metric.metric_id] = metric
		
		# Update metric history
		if metric.metric_id not in self.metric_history:
			self.metric_history[metric.metric_id] = []
		
		self.metric_history[metric.metric_id].append(
			(metric.last_assessed, metric.score)
		)
		
		# Keep only last 100 entries per metric
		if len(self.metric_history[metric.metric_id]) > 100:
			self.metric_history[metric.metric_id] = self.metric_history[metric.metric_id][-100:]
		
		# Check for alerts
		await self._check_metric_alerts(metric)
		
		self.logger.info(f"Added compliance metric: {metric.control_name} ({metric.framework})")
		return metric.metric_id
	
	async def update_framework_assessment(
		self,
		framework: ComplianceFramework,
		force_recalculate: bool = False
	) -> ComplianceFrameworkAssessment:
		"""Update overall framework assessment"""
		# Get all metrics for this framework
		framework_metrics = [
			m for m in self.compliance_metrics.values()
			if m.framework == framework
		]
		
		if not framework_metrics:
			# Create placeholder assessment
			assessment = ComplianceFrameworkAssessment(
				framework=framework,
				overall_status=ComplianceStatus.UNKNOWN,
				overall_score=0.0,
				total_controls=0,
				compliant_controls=0,
				non_compliant_controls=0,
				under_review_controls=0,
				next_assessment_due=datetime.now(timezone.utc) + timedelta(days=self.config.default_assessment_interval_days)
			)
		else:
			# Calculate scores and status
			total_score = sum(m.score for m in framework_metrics)
			overall_score = total_score / len(framework_metrics)
			
			# Count by status
			compliant = len([m for m in framework_metrics if m.status == ComplianceStatus.COMPLIANT])
			non_compliant = len([m for m in framework_metrics if m.status == ComplianceStatus.NON_COMPLIANT])
			under_review = len([m for m in framework_metrics if m.status == ComplianceStatus.UNDER_REVIEW])
			partially_compliant = len([m for m in framework_metrics if m.status == ComplianceStatus.PARTIALLY_COMPLIANT])
			
			# Determine overall status
			if non_compliant > 0 or partially_compliant > len(framework_metrics) * 0.2:
				overall_status = ComplianceStatus.NON_COMPLIANT
			elif under_review > len(framework_metrics) * 0.1:
				overall_status = ComplianceStatus.UNDER_REVIEW
			elif compliant == len(framework_metrics):
				overall_status = ComplianceStatus.COMPLIANT
			else:
				overall_status = ComplianceStatus.PARTIALLY_COMPLIANT
			
			# Count risk levels
			critical_issues = len([m for m in framework_metrics if m.risk_level == RiskLevel.CRITICAL])
			high_risk_issues = len([m for m in framework_metrics if m.risk_level == RiskLevel.HIGH])
			medium_risk_issues = len([m for m in framework_metrics if m.risk_level == RiskLevel.MEDIUM])
			low_risk_issues = len([m for m in framework_metrics if m.risk_level == RiskLevel.LOW])
			
			# Calculate category scores (simplified grouping)
			category_scores = self._calculate_category_scores(framework_metrics)
			
			# Create assessment
			assessment = ComplianceFrameworkAssessment(
				framework=framework,
				overall_status=overall_status,
				overall_score=overall_score,
				category_scores=category_scores,
				critical_issues=critical_issues,
				high_risk_issues=high_risk_issues,
				medium_risk_issues=medium_risk_issues,
				low_risk_issues=low_risk_issues,
				total_controls=len(framework_metrics),
				compliant_controls=compliant,
				non_compliant_controls=non_compliant,
				under_review_controls=under_review,
				next_assessment_due=datetime.now(timezone.utc) + timedelta(days=self.config.default_assessment_interval_days)
			)
			
			# Calculate trends if previous assessment exists
			previous_assessment = self.framework_assessments.get(framework)
			if previous_assessment:
				assessment.previous_score = previous_assessment.overall_score
				assessment.score_change = overall_score - previous_assessment.overall_score
				
				if assessment.score_change > 5:
					assessment.trend_direction = "improving"
				elif assessment.score_change < -5:
					assessment.trend_direction = "declining"
				else:
					assessment.trend_direction = "stable"
		
		# Store assessment
		if framework in self.framework_assessments:
			self.historical_assessments.append(self.framework_assessments[framework])
		
		self.framework_assessments[framework] = assessment
		
		# Check for framework-level alerts
		await self._check_framework_alerts(assessment)
		
		self.logger.info(f"Updated {framework} assessment: {overall_score:.1f}% ({overall_status})")
		return assessment
	
	def _calculate_category_scores(self, metrics: List[ComplianceMetric]) -> Dict[str, float]:
		"""Calculate scores by control category"""
		categories = {}
		
		for metric in metrics:
			# Simplified categorization based on control ID patterns
			category = self._categorize_control(metric.control_id, metric.framework)
			
			if category not in categories:
				categories[category] = []
			
			categories[category].append(metric.score)
		
		# Calculate average scores
		category_scores = {}
		for category, scores in categories.items():
			category_scores[category] = sum(scores) / len(scores)
		
		return category_scores
	
	def _categorize_control(self, control_id: str, framework: ComplianceFramework) -> str:
		"""Categorize control based on ID and framework"""
		control_id_lower = control_id.lower()
		
		if framework == ComplianceFramework.GDPR:
			if 'data' in control_id_lower or 'process' in control_id_lower:
				return "Data Processing"
			elif 'consent' in control_id_lower:
				return "Consent Management"
			elif 'security' in control_id_lower:
				return "Security Measures"
			elif 'right' in control_id_lower:
				return "Individual Rights"
			else:
				return "General Compliance"
		
		elif framework == ComplianceFramework.SOC2:
			if 'cc' in control_id_lower:
				return "Common Criteria"
			elif 'a1' in control_id_lower:
				return "Availability"
			elif 'p1' in control_id_lower:
				return "Processing Integrity"
			elif 'c1' in control_id_lower:
				return "Confidentiality"
			elif 'pi1' in control_id_lower:
				return "Privacy"
			else:
				return "Security"
		
		elif framework == ComplianceFramework.HIPAA:
			if 'admin' in control_id_lower:
				return "Administrative Safeguards"
			elif 'physical' in control_id_lower:
				return "Physical Safeguards"
			elif 'technical' in control_id_lower:
				return "Technical Safeguards"
			else:
				return "General Safeguards"
		
		else:
			return "General Controls"
	
	# Alert Management
	
	async def _check_metric_alerts(self, metric: ComplianceMetric):
		"""Check for alerts based on metric status"""
		alerts_to_create = []
		
		# Critical or high-risk non-compliant controls
		if metric.status == ComplianceStatus.NON_COMPLIANT and metric.risk_level in [RiskLevel.CRITICAL, RiskLevel.HIGH]:
			alerts_to_create.append({
				'type': 'non_compliant_critical',
				'title': f'Critical Non-Compliance: {metric.control_name}',
				'description': f'Control {metric.control_id} is non-compliant with {metric.risk_level.value} risk level',
				'severity': metric.risk_level
			})
		
		# Overdue assessments
		if datetime.now(timezone.utc) > metric.next_assessment_due:
			alerts_to_create.append({
				'type': 'assessment_overdue',
				'title': f'Assessment Overdue: {metric.control_name}',
				'description': f'Control {metric.control_id} assessment is overdue',
				'severity': RiskLevel.MEDIUM
			})
		
		# Score degradation
		if metric.metric_id in self.metric_history and len(self.metric_history[metric.metric_id]) > 1:
			previous_score = self.metric_history[metric.metric_id][-2][1]
			if metric.score < previous_score - 20:  # 20 point drop
				alerts_to_create.append({
					'type': 'score_degradation',
					'title': f'Score Degradation: {metric.control_name}',
					'description': f'Control score dropped from {previous_score:.1f} to {metric.score:.1f}',
					'severity': RiskLevel.MEDIUM
				})
		
		# Create alerts
		for alert_data in alerts_to_create:
			alert = ComplianceAlert(
				framework=metric.framework,
				alert_type=alert_data['type'],
				severity=alert_data['severity'],
				title=alert_data['title'],
				description=alert_data['description'],
				control_id=metric.control_id,
				due_date=metric.next_assessment_due if alert_data['type'] == 'assessment_overdue' else None
			)
			
			self.compliance_alerts[alert.alert_id] = alert
	
	async def _check_framework_alerts(self, assessment: ComplianceFrameworkAssessment):
		"""Check for framework-level alerts"""
		alerts_to_create = []
		
		# Overall non-compliance
		if assessment.overall_status == ComplianceStatus.NON_COMPLIANT:
			alerts_to_create.append({
				'type': 'framework_non_compliant',
				'title': f'{assessment.framework.value.upper()} Non-Compliance',
				'description': f'Overall {assessment.framework.value.upper()} compliance status is non-compliant',
				'severity': RiskLevel.HIGH
			})
		
		# Critical issues
		if assessment.critical_issues > 0:
			alerts_to_create.append({
				'type': 'critical_issues',
				'title': f'Critical Issues in {assessment.framework.value.upper()}',
				'description': f'{assessment.critical_issues} critical compliance issues identified',
				'severity': RiskLevel.CRITICAL
			})
		
		# Declining trend
		if assessment.trend_direction == "declining" and assessment.score_change and assessment.score_change < -10:
			alerts_to_create.append({
				'type': 'declining_compliance',
				'title': f'{assessment.framework.value.upper()} Compliance Declining',
				'description': f'Compliance score declined by {abs(assessment.score_change):.1f} points',
				'severity': RiskLevel.MEDIUM
			})
		
		# Upcoming certification expiry
		if assessment.certification_expiry:
			days_to_expiry = (assessment.certification_expiry - datetime.now(timezone.utc)).days
			if days_to_expiry <= 60:  # 60 days warning
				alerts_to_create.append({
					'type': 'certification_expiry',
					'title': f'{assessment.framework.value.upper()} Certification Expiring',
					'description': f'Certification expires in {days_to_expiry} days',
					'severity': RiskLevel.HIGH if days_to_expiry <= 30 else RiskLevel.MEDIUM,
					'due_date': assessment.certification_expiry
				})
		
		# Create alerts
		for alert_data in alerts_to_create:
			alert = ComplianceAlert(
				framework=assessment.framework,
				alert_type=alert_data['type'],
				severity=alert_data['severity'],
				title=alert_data['title'],
				description=alert_data['description'],
				due_date=alert_data.get('due_date')
			)
			
			self.compliance_alerts[alert.alert_id] = alert
	
	# Incident Management
	
	async def record_security_incident(self, incident: SecurityIncident) -> str:
		"""Record a security incident"""
		self.security_incidents[incident.incident_id] = incident
		
		# Create compliance alerts for regulatory notification requirements
		if incident.regulatory_notification_required and not incident.regulatory_notification_sent:
			alert = ComplianceAlert(
				framework=ComplianceFramework.GDPR,  # Assume GDPR for now
				alert_type="regulatory_notification_required",
				severity=RiskLevel.CRITICAL,
				title=f"Regulatory Notification Required: {incident.title}",
				description=f"Security incident requires regulatory notification within deadline",
				due_date=incident.notification_deadline
			)
			self.compliance_alerts[alert.alert_id] = alert
		
		self.logger.info(f"Recorded security incident: {incident.title}")
		return incident.incident_id
	
	async def update_incident_status(
		self,
		incident_id: str,
		status: str,
		resolution_notes: Optional[str] = None
	) -> bool:
		"""Update security incident status"""
		incident = self.security_incidents.get(incident_id)
		if not incident:
			return False
		
		incident.status = status
		if status == "resolved":
			incident.resolved_at = datetime.now(timezone.utc)
		
		if resolution_notes:
			incident.resolution_notes = resolution_notes
		
		return True
	
	# Dashboard Data Retrieval
	
	async def get_dashboard_summary(self) -> Dict[str, Any]:
		"""Get dashboard summary data"""
		now = datetime.now(timezone.utc)
		
		# Overall compliance summary
		total_frameworks = len(self.framework_assessments)
		compliant_frameworks = len([
			a for a in self.framework_assessments.values()
			if a.overall_status == ComplianceStatus.COMPLIANT
		])
		
		# Alert summary
		critical_alerts = len([
			a for a in self.compliance_alerts.values()
			if a.severity == RiskLevel.CRITICAL and a.status == "open"
		])
		high_alerts = len([
			a for a in self.compliance_alerts.values()
			if a.severity == RiskLevel.HIGH and a.status == "open"
		])
		total_open_alerts = len([
			a for a in self.compliance_alerts.values()
			if a.status == "open"
		])
		
		# Incident summary
		open_incidents = len([
			i for i in self.security_incidents.values()
			if i.status != "resolved"
		])
		
		# Recent activity
		recent_assessments = []
		for assessment in sorted(self.framework_assessments.values(), key=lambda a: a.assessment_date, reverse=True)[:5]:
			recent_assessments.append({
				'framework': assessment.framework.value,
				'score': assessment.overall_score,
				'status': assessment.overall_status.value,
				'date': assessment.assessment_date.isoformat()
			})
		
		# Compliance scores by framework
		framework_scores = {}
		for framework, assessment in self.framework_assessments.items():
			framework_scores[framework.value] = {
				'score': assessment.overall_score,
				'status': assessment.overall_status.value,
				'critical_issues': assessment.critical_issues,
				'trend': assessment.trend_direction
			}
		
		self.dashboard_last_updated = now
		
		return {
			'dashboard_updated_at': now.isoformat(),
			'overall_summary': {
				'total_frameworks': total_frameworks,
				'compliant_frameworks': compliant_frameworks,
				'compliance_percentage': (compliant_frameworks / total_frameworks * 100) if total_frameworks > 0 else 0
			},
			'alerts': {
				'total_open': total_open_alerts,
				'critical': critical_alerts,
				'high': high_alerts,
				'overdue_assessments': len([
					a for a in self.compliance_alerts.values()
					if a.alert_type == "assessment_overdue" and a.status == "open"
				])
			},
			'incidents': {
				'open_incidents': open_incidents,
				'notification_required': len([
					i for i in self.security_incidents.values()
					if i.regulatory_notification_required and not i.regulatory_notification_sent
				])
			},
			'framework_scores': framework_scores,
			'recent_assessments': recent_assessments
		}
	
	async def get_framework_details(self, framework: ComplianceFramework) -> Dict[str, Any]:
		"""Get detailed information for a specific framework"""
		assessment = self.framework_assessments.get(framework)
		if not assessment:
			return {'error': 'Framework assessment not found'}
		
		# Get metrics for this framework
		framework_metrics = [
			m for m in self.compliance_metrics.values()
			if m.framework == framework
		]
		
		# Get alerts for this framework
		framework_alerts = [
			a for a in self.compliance_alerts.values()
			if a.framework == framework and a.status == "open"
		]
		
		# Control details
		controls = []
		for metric in sorted(framework_metrics, key=lambda m: m.control_id):
			controls.append({
				'control_id': metric.control_id,
				'control_name': metric.control_name,
				'status': metric.status.value,
				'score': metric.score,
				'risk_level': metric.risk_level.value,
				'last_assessed': metric.last_assessed.isoformat(),
				'next_due': metric.next_assessment_due.isoformat(),
				'responsible_team': metric.responsible_team,
				'gaps': metric.gaps,
				'remediation_actions': metric.remediation_actions
			})
		
		# Alert details
		alerts = []
		for alert in sorted(framework_alerts, key=lambda a: a.created_at, reverse=True):
			alerts.append({
				'alert_id': alert.alert_id,
				'type': alert.alert_type,
				'title': alert.title,
				'severity': alert.severity.value,
				'created_at': alert.created_at.isoformat(),
				'due_date': alert.due_date.isoformat() if alert.due_date else None,
				'status': alert.status
			})
		
		return {
			'framework': framework.value,
			'assessment': {
				'overall_score': assessment.overall_score,
				'overall_status': assessment.overall_status.value,
				'assessment_date': assessment.assessment_date.isoformat(),
				'next_assessment_due': assessment.next_assessment_due.isoformat(),
				'trend_direction': assessment.trend_direction,
				'score_change': assessment.score_change
			},
			'risk_summary': {
				'critical_issues': assessment.critical_issues,
				'high_risk_issues': assessment.high_risk_issues,
				'medium_risk_issues': assessment.medium_risk_issues,
				'low_risk_issues': assessment.low_risk_issues
			},
			'control_summary': {
				'total_controls': assessment.total_controls,
				'compliant_controls': assessment.compliant_controls,
				'non_compliant_controls': assessment.non_compliant_controls,
				'under_review_controls': assessment.under_review_controls
			},
			'category_scores': assessment.category_scores,
			'controls': controls,
			'alerts': alerts
		}
	
	async def get_alert_dashboard(self) -> Dict[str, Any]:
		"""Get alert dashboard data"""
		# Group alerts by severity and status
		alerts_by_severity = {}
		alerts_by_framework = {}
		alerts_by_type = {}
		
		for alert in self.compliance_alerts.values():
			# By severity
			severity = alert.severity.value
			if severity not in alerts_by_severity:
				alerts_by_severity[severity] = {'open': 0, 'total': 0}
			
			alerts_by_severity[severity]['total'] += 1
			if alert.status == "open":
				alerts_by_severity[severity]['open'] += 1
			
			# By framework
			framework = alert.framework.value
			if framework not in alerts_by_framework:
				alerts_by_framework[framework] = {'open': 0, 'total': 0}
			
			alerts_by_framework[framework]['total'] += 1
			if alert.status == "open":
				alerts_by_framework[framework]['open'] += 1
			
			# By type
			alert_type = alert.alert_type
			if alert_type not in alerts_by_type:
				alerts_by_type[alert_type] = {'open': 0, 'total': 0}
			
			alerts_by_type[alert_type]['total'] += 1
			if alert.status == "open":
				alerts_by_type[alert_type]['open'] += 1
		
		# Recent alerts
		recent_alerts = []
		sorted_alerts = sorted(
			self.compliance_alerts.values(),
			key=lambda a: a.created_at,
			reverse=True
		)
		
		for alert in sorted_alerts[:20]:  # Last 20 alerts
			recent_alerts.append({
				'alert_id': alert.alert_id,
				'framework': alert.framework.value,
				'type': alert.alert_type,
				'title': alert.title,
				'severity': alert.severity.value,
				'status': alert.status,
				'created_at': alert.created_at.isoformat(),
				'due_date': alert.due_date.isoformat() if alert.due_date else None,
				'assigned_to': alert.assigned_to
			})
		
		return {
			'alerts_by_severity': alerts_by_severity,
			'alerts_by_framework': alerts_by_framework,
			'alerts_by_type': alerts_by_type,
			'recent_alerts': recent_alerts,
			'total_alerts': len(self.compliance_alerts),
			'open_alerts': len([a for a in self.compliance_alerts.values() if a.status == "open"])
		}
	
	# Reporting Functions
	
	async def generate_compliance_report(
		self,
		framework: Optional[ComplianceFramework] = None,
		start_date: Optional[datetime] = None,
		end_date: Optional[datetime] = None
	) -> Dict[str, Any]:
		"""Generate comprehensive compliance report"""
		now = datetime.now(timezone.utc)
		start_date = start_date or (now - timedelta(days=30))
		end_date = end_date or now
		
		if framework:
			frameworks_to_include = [framework]
		else:
			frameworks_to_include = list(self.framework_assessments.keys())
		
		report = {
			'report_generated_at': now.isoformat(),
			'report_period': {
				'start_date': start_date.isoformat(),
				'end_date': end_date.isoformat()
			},
			'frameworks': {}
		}
		
		for fw in frameworks_to_include:
			assessment = self.framework_assessments.get(fw)
			if not assessment:
				continue
			
			# Get metrics for this framework
			framework_metrics = [
				m for m in self.compliance_metrics.values()
				if m.framework == fw
			]
			
			# Get alerts in period
			period_alerts = [
				a for a in self.compliance_alerts.values()
				if (a.framework == fw and 
					start_date <= a.created_at <= end_date)
			]
			
			# Get incidents affecting this framework
			period_incidents = [
				i for i in self.security_incidents.values()
				if start_date <= i.discovered_at <= end_date
			]
			
			report['frameworks'][fw.value] = {
				'assessment': {
					'overall_score': assessment.overall_score,
					'overall_status': assessment.overall_status.value,
					'trend_direction': assessment.trend_direction,
					'score_change': assessment.score_change
				},
				'controls': {
					'total': len(framework_metrics),
					'compliant': len([m for m in framework_metrics if m.status == ComplianceStatus.COMPLIANT]),
					'non_compliant': len([m for m in framework_metrics if m.status == ComplianceStatus.NON_COMPLIANT]),
					'under_review': len([m for m in framework_metrics if m.status == ComplianceStatus.UNDER_REVIEW])
				},
				'risks': {
					'critical': len([m for m in framework_metrics if m.risk_level == RiskLevel.CRITICAL]),
					'high': len([m for m in framework_metrics if m.risk_level == RiskLevel.HIGH]),
					'medium': len([m for m in framework_metrics if m.risk_level == RiskLevel.MEDIUM]),
					'low': len([m for m in framework_metrics if m.risk_level == RiskLevel.LOW])
				},
				'activity_summary': {
					'alerts_created': len(period_alerts),
					'critical_alerts': len([a for a in period_alerts if a.severity == RiskLevel.CRITICAL]),
					'incidents': len(period_incidents),
					'assessments_completed': len([
						m for m in framework_metrics
						if start_date <= m.last_assessed <= end_date
					])
				}
			}
		
		return report
	
	# Utility Methods
	
	async def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
		"""Acknowledge an alert"""
		alert = self.compliance_alerts.get(alert_id)
		if not alert:
			return False
		
		alert.status = "acknowledged"
		alert.acknowledged_by = acknowledged_by
		alert.acknowledged_at = datetime.now(timezone.utc)
		
		return True
	
	async def resolve_alert(self, alert_id: str, resolution_notes: str) -> bool:
		"""Resolve an alert"""
		alert = self.compliance_alerts.get(alert_id)
		if not alert:
			return False
		
		alert.status = "resolved"
		alert.resolved_at = datetime.now(timezone.utc)
		alert.resolution_notes = resolution_notes
		
		return True
	
	async def cleanup_resolved_alerts(self, days_old: int = 30) -> int:
		"""Clean up old resolved alerts"""
		cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
		alerts_to_remove = []
		
		for alert_id, alert in self.compliance_alerts.items():
			if (alert.status == "resolved" and 
				alert.resolved_at and 
				alert.resolved_at < cutoff_date):
				alerts_to_remove.append(alert_id)
		
		for alert_id in alerts_to_remove:
			del self.compliance_alerts[alert_id]
		
		return len(alerts_to_remove)
	
	def get_compliance_metrics(self, framework: Optional[ComplianceFramework] = None) -> List[ComplianceMetric]:
		"""Get compliance metrics, optionally filtered by framework"""
		metrics = list(self.compliance_metrics.values())
		
		if framework:
			metrics = [m for m in metrics if m.framework == framework]
		
		return sorted(metrics, key=lambda m: (m.framework.value, m.control_id))


# Factory functions
def create_compliance_dashboard(config: Optional[DashboardConfiguration] = None) -> ComplianceDashboard:
	"""Create ComplianceDashboard instance"""
	return ComplianceDashboard(config)


def create_sample_compliance_data() -> Tuple[List[ComplianceMetric], List[SecurityIncident]]:
	"""Create sample compliance data for testing"""
	metrics = []
	incidents = []
	
	# Sample GDPR metrics
	gdpr_metrics = [
		ComplianceMetric(
			framework=ComplianceFramework.GDPR,
			control_id="Art.25",
			control_name="Data Protection by Design and by Default",
			status=ComplianceStatus.COMPLIANT,
			risk_level=RiskLevel.HIGH,
			score=85.0,
			responsible_team="Engineering",
			next_assessment_due=datetime.now(timezone.utc) + timedelta(days=90)
		),
		ComplianceMetric(
			framework=ComplianceFramework.GDPR,
			control_id="Art.32",
			control_name="Security of Processing",
			status=ComplianceStatus.PARTIALLY_COMPLIANT,
			risk_level=RiskLevel.MEDIUM,
			score=75.0,
			gaps=["Encryption at rest not fully implemented"],
			remediation_actions=["Deploy encryption solution by Q2"],
			responsible_team="Security",
			next_assessment_due=datetime.now(timezone.utc) + timedelta(days=60)
		)
	]
	
	metrics.extend(gdpr_metrics)
	
	# Sample SOC 2 metrics
	soc2_metrics = [
		ComplianceMetric(
			framework=ComplianceFramework.SOC2,
			control_id="CC6.1",
			control_name="Logical and Physical Access Controls",
			status=ComplianceStatus.COMPLIANT,
			risk_level=RiskLevel.HIGH,
			score=92.0,
			responsible_team="IT Operations",
			next_assessment_due=datetime.now(timezone.utc) + timedelta(days=90)
		)
	]
	
	metrics.extend(soc2_metrics)
	
	# Sample security incident
	incidents.append(
		SecurityIncident(
			title="Unauthorized Access Attempt",
			description="Multiple failed login attempts detected from suspicious IP range",
			incident_type="unauthorized_access",
			severity=RiskLevel.MEDIUM,
			impact_level="organizational",
			affected_systems=["authentication_service"],
			discovered_at=datetime.now(timezone.utc) - timedelta(hours=2),
			status="investigating",
			response_team=["security_team", "it_operations"],
			containment_actions=["IP blocking", "Enhanced monitoring"],
			regulatory_notification_required=False
		)
	)
	
	return metrics, incidents