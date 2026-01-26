"""
Database Models for DocuFusion Flask-AppBuilder Application
"""

from flask_appbuilder import Model
from flask_appbuilder.models.mixins import AuditMixin, FileColumn, ImageColumn
from sqlalchemy import Column, Integer, String, Unicode, UnicodeText, DateTime, Boolean, ForeignKey, Text, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import uuid

# Use Flask-AppBuilder's Model base class
Base = Model


class Document(AuditMixin, Model):
	"""Document model for storing document metadata and content."""
	
	__tablename__ = 'documents'
	
	id = Column(Integer, primary_key=True)
	document_id = Column(String(50), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
	title = Column(String(200), nullable=False)
	description = Column(UnicodeText)
	content = Column(UnicodeText)
	document_type = Column(String(50), nullable=False, default='proposal')  # proposal, rfp_response, template, etc.
	status = Column(String(20), nullable=False, default='draft')  # draft, in_review, approved, published
	version = Column(String(20), default='1.0')
	
	# File associations
	source_file = Column(FileColumn)
	generated_pdf = Column(FileColumn)
	generated_docx = Column(FileColumn)
	generated_html = Column(FileColumn)
	
	# Relationships
	template_id = Column(Integer, ForeignKey('templates.id'))
	template = relationship('Template', back_populates='documents')
	
	project_id = Column(Integer, ForeignKey('projects.id'))
	project = relationship('Project', back_populates='documents')
	
	# Collaboration
	collaborators = relationship('DocumentCollaborator', back_populates='document')
	comments = relationship('DocumentComment', back_populates='document')
	versions = relationship('DocumentVersion', back_populates='document')
	
	# AI and Intelligence
	ai_analysis = Column(JSON)  # Store AI analysis results
	compliance_status = Column(JSON)  # Store compliance check results
	voice_dna_score = Column(Float)  # Voice consistency score
	quality_score = Column(Float)  # Overall quality score
	
	def __repr__(self):
		return f'<Document {self.title}>'
	
	def to_dict(self):
		"""Convert document to dictionary for API responses."""
		return {
			'id': self.id,
			'document_id': self.document_id,
			'title': self.title,
			'description': self.description,
			'document_type': self.document_type,
			'status': self.status,
			'version': self.version,
			'created_on': self.created_on.isoformat() if self.created_on else None,
			'changed_on': self.changed_on.isoformat() if self.changed_on else None,
			'created_by': self.created_by.username if self.created_by else None,
			'changed_by': self.changed_by.username if self.changed_by else None,
			'voice_dna_score': self.voice_dna_score,
			'quality_score': self.quality_score,
			'template_id': self.template_id,
			'project_id': self.project_id,
		}


class Template(AuditMixin, Model):
	"""Template model for document templates."""
	
	__tablename__ = 'templates'
	
	id = Column(Integer, primary_key=True)
	template_id = Column(String(50), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
	name = Column(String(200), nullable=False)
	description = Column(UnicodeText)
	category = Column(String(100))  # RFP Response, Proposal, Report, etc.
	template_content = Column(UnicodeText)
	template_structure = Column(JSON)  # Store template structure as JSON
	
	# Template metadata
	is_active = Column(Boolean, default=True)
	is_public = Column(Boolean, default=False)
	version = Column(String(20), default='1.0')
	
	# Relationships
	documents = relationship('Document', back_populates='template')
	
	def __repr__(self):
		return f'<Template {self.name}>'


class Project(AuditMixin, Model):
	"""Project model for organizing documents and workflows."""
	
	__tablename__ = 'projects'
	
	id = Column(Integer, primary_key=True)
	project_id = Column(String(50), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
	name = Column(String(200), nullable=False)
	description = Column(UnicodeText)
	client_name = Column(String(200))
	
	# Project timeline
	start_date = Column(DateTime)
	due_date = Column(DateTime)
	completion_date = Column(DateTime)
	
	# Project status
	status = Column(String(20), nullable=False, default='active')  # active, completed, cancelled, on_hold
	priority = Column(String(20), default='medium')  # low, medium, high, critical
	
	# Financial information
	budget = Column(Float)
	estimated_value = Column(Float)
	
	# Relationships
	documents = relationship('Document', back_populates='project')
	opportunities = relationship('Opportunity', back_populates='project')
	
	def __repr__(self):
		return f'<Project {self.name}>'


class Opportunity(AuditMixin, Model):
	"""Opportunity model for discovered RFPs and business opportunities."""
	
	__tablename__ = 'opportunities'
	
	id = Column(Integer, primary_key=True)
	opportunity_id = Column(String(50), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
	title = Column(String(500), nullable=False)
	description = Column(UnicodeText)
	source_url = Column(String(500))
	source_organization = Column(String(200))
	
	# Opportunity details
	opportunity_type = Column(String(100))  # RFP, RFQ, Grant, etc.
	industry = Column(String(100))
	location = Column(String(200))
	
	# Timeline
	posted_date = Column(DateTime)
	submission_deadline = Column(DateTime)
	project_start_date = Column(DateTime)
	project_end_date = Column(DateTime)
	
	# Financial
	estimated_value = Column(Float)
	contract_length = Column(String(100))
	
	# AI Analysis Results
	qualification_score = Column(Float)  # How well we match
	win_probability = Column(Float)  # Predicted probability of winning
	competitive_assessment = Column(JSON)  # AI analysis of competition
	requirements_analysis = Column(JSON)  # Extracted requirements
	
	# Status tracking
	status = Column(String(20), default='discovered')  # discovered, reviewed, pursuing, submitted, won, lost
	priority = Column(String(20), default='medium')
	
	# Relationships
	project_id = Column(Integer, ForeignKey('projects.id'))
	project = relationship('Project', back_populates='opportunities')
	
	def __repr__(self):
		return f'<Opportunity {self.title}>'


class DocumentCollaborator(AuditMixin, Model):
	"""Model for tracking document collaborators and their permissions."""
	
	__tablename__ = 'document_collaborators'
	
	id = Column(Integer, primary_key=True)
	document_id = Column(Integer, ForeignKey('documents.id'), nullable=False)
	user_id = Column(Integer, ForeignKey('ab_user.id'), nullable=False)
	
	# Collaboration permissions
	can_edit = Column(Boolean, default=True)
	can_comment = Column(Boolean, default=True)
	can_share = Column(Boolean, default=False)
	can_approve = Column(Boolean, default=False)
	
	# Activity tracking
	last_active = Column(DateTime, default=datetime.utcnow)
	is_active = Column(Boolean, default=True)
	
	# Relationships
	document = relationship('Document', back_populates='collaborators')
	user = relationship('User')
	
	def __repr__(self):
		return f'<Collaborator {self.user.username} on {self.document.title}>'


class DocumentComment(AuditMixin, Model):
	"""Model for document comments and annotations."""
	
	__tablename__ = 'document_comments'
	
	id = Column(Integer, primary_key=True)
	document_id = Column(Integer, ForeignKey('documents.id'), nullable=False)
	user_id = Column(Integer, ForeignKey('ab_user.id'), nullable=False)
	
	# Comment content
	content = Column(UnicodeText, nullable=False)
	comment_type = Column(String(20), default='comment')  # comment, suggestion, approval, rejection
	
	# Position in document
	section_id = Column(String(100))  # Reference to document section
	line_number = Column(Integer)
	character_position = Column(Integer)
	
	# Comment status
	is_resolved = Column(Boolean, default=False)
	resolved_by_id = Column(Integer, ForeignKey('ab_user.id'))
	resolved_on = Column(DateTime)
	
	# Relationships
	document = relationship('Document', back_populates='comments')
	user = relationship('User', foreign_keys=[user_id])
	resolved_by = relationship('User', foreign_keys=[resolved_by_id])
	
	def __repr__(self):
		return f'<Comment by {self.user.username} on {self.document.title}>'


class DocumentVersion(AuditMixin, Model):
	"""Model for tracking document versions and changes."""
	
	__tablename__ = 'document_versions'
	
	id = Column(Integer, primary_key=True)
	document_id = Column(Integer, ForeignKey('documents.id'), nullable=False)
	version_number = Column(String(20), nullable=False)
	
	# Version content
	content_snapshot = Column(UnicodeText)
	structure_snapshot = Column(JSON)
	metadata_snapshot = Column(JSON)
	
	# Change tracking
	change_summary = Column(UnicodeText)
	change_type = Column(String(50))  # manual, ai_generated, merged, etc.
	
	# Version status
	is_current = Column(Boolean, default=False)
	is_published = Column(Boolean, default=False)
	
	# Relationships
	document = relationship('Document', back_populates='versions')
	
	def __repr__(self):
		return f'<Version {self.version_number} of {self.document.title}>'


class WorkflowInstance(AuditMixin, Model):
	"""Model for workflow instances and process tracking."""
	
	__tablename__ = 'workflow_instances'
	
	id = Column(Integer, primary_key=True)
	workflow_id = Column(String(50), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
	workflow_type = Column(String(100), nullable=False)  # document_creation, review_process, compliance_check
	
	# Associated entities
	document_id = Column(Integer, ForeignKey('documents.id'))
	project_id = Column(Integer, ForeignKey('projects.id'))
	
	# Workflow state
	current_step = Column(String(100))
	status = Column(String(20), default='active')  # active, completed, failed, cancelled
	progress_percentage = Column(Float, default=0.0)
	
	# Workflow data
	workflow_data = Column(JSON)  # Store workflow-specific data
	step_history = Column(JSON)  # Track step progression
	
	# Timeline
	started_on = Column(DateTime, default=datetime.utcnow)
	completed_on = Column(DateTime)
	due_date = Column(DateTime)
	
	# Relationships
	document = relationship('Document')
	project = relationship('Project')
	
	def __repr__(self):
		return f'<Workflow {self.workflow_type} - {self.status}>'


class SystemSettings(Model):
	"""Model for storing system-wide configuration settings."""
	
	__tablename__ = 'system_settings'
	
	id = Column(Integer, primary_key=True)
	setting_key = Column(String(100), unique=True, nullable=False)
	setting_value = Column(UnicodeText)
	setting_type = Column(String(20), default='string')  # string, integer, float, boolean, json
	description = Column(UnicodeText)
	category = Column(String(50))  # general, ai, compliance, workflow, etc.
	
	# Management
	is_user_configurable = Column(Boolean, default=True)
	requires_restart = Column(Boolean, default=False)
	
	def __repr__(self):
		return f'<Setting {self.setting_key}>'