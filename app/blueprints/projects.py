"""
Project management views and APIs for DocuFusion Flask-AppBuilder.
"""

from flask import request, jsonify, redirect, url_for, flash
from flask_appbuilder import ModelView, expose, has_access
from flask_appbuilder.api import BaseApi, expose as api_expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import protect
from flask_login import current_user
from wtforms import SelectField, DateField, FloatField
from wtforms.validators import DataRequired, NumberRange
from datetime import datetime, timedelta

from ..models import Project, Document, Opportunity


class ProjectModelView(ModelView):
	"""Project management view for organizing documents and opportunities."""
	
	datamodel = SQLAInterface(Project)
	
	# List view configuration
	list_columns = ['name', 'client_name', 'status', 'priority', 'start_date', 'due_date', 'created_by']
	list_title = "Projects"
	
	# Show view configuration
	show_columns = [
		'name', 'description', 'client_name', 'status', 'priority',
		'start_date', 'due_date', 'completion_date', 'budget', 'estimated_value',
		'created_on', 'created_by', 'changed_on', 'changed_by'
	]
	show_title = "Project Details"
	
	# Add/Edit form configuration
	add_columns = [
		'name', 'description', 'client_name', 'status', 'priority',
		'start_date', 'due_date', 'budget', 'estimated_value'
	]
	edit_columns = add_columns + ['completion_date']
	
	# Form field customization
	add_form_extra_fields = {
		'status': SelectField(
			'Status',
			choices=[
				('active', 'Active'),
				('planning', 'Planning'),
				('on_hold', 'On Hold'),
				('completed', 'Completed'),
				('cancelled', 'Cancelled')
			],
			default='active',
			validators=[DataRequired()]
		),
		'priority': SelectField(
			'Priority',
			choices=[
				('low', 'Low'),
				('medium', 'Medium'),
				('high', 'High'),
				('critical', 'Critical')
			],
			default='medium'
		),
		'budget': FloatField(
			'Budget ($)',
			validators=[NumberRange(min=0)]
		),
		'estimated_value': FloatField(
			'Estimated Value ($)',
			validators=[NumberRange(min=0)]
		)
	}
	
	edit_form_extra_fields = add_form_extra_fields.copy()
	
	# Search configuration
	search_columns = ['name', 'description', 'client_name', 'status', 'priority']
	
	# Permissions
	base_permissions = ['can_list', 'can_show', 'can_add', 'can_edit', 'can_delete']
	
	@expose('/timeline/<int:pk>')
	@has_access
	def project_timeline(self, pk):
		"""Display project timeline and milestones."""
		project = self.datamodel.get(pk)
		if not project:
			flash('Project not found', 'error')
			return redirect(url_for('ProjectModelView.list'))
		
		# Get project documents
		documents = self.appbuilder.session.query(Document).filter(
			Document.project_id == pk
		).order_by(Document.created_on).all()
		
		# Get project opportunities
		opportunities = self.appbuilder.session.query(Opportunity).filter(
			Opportunity.project_id == pk
		).order_by(Opportunity.posted_date).all()
		
		# Create timeline events
		timeline_events = []
		
		# Add project milestones
		if project.start_date:
			timeline_events.append({
				'date': project.start_date,
				'type': 'milestone',
				'title': 'Project Start',
				'description': f'Project "{project.name}" started'
			})
		
		if project.due_date:
			timeline_events.append({
				'date': project.due_date,
				'type': 'deadline',
				'title': 'Project Due Date',
				'description': f'Project "{project.name}" is due'
			})
		
		if project.completion_date:
			timeline_events.append({
				'date': project.completion_date,
				'type': 'completion',
				'title': 'Project Completed',
				'description': f'Project "{project.name}" completed'
			})
		
		# Add document events
		for doc in documents:
			timeline_events.append({
				'date': doc.created_on,
				'type': 'document',
				'title': f'Document: {doc.title}',
				'description': f'Document created - {doc.document_type}',
				'url': url_for('DocumentModelView.show', pk=doc.id)
			})
		
		# Add opportunity events
		for opp in opportunities:
			timeline_events.append({
				'date': opp.posted_date or opp.created_on,
				'type': 'opportunity',
				'title': f'Opportunity: {opp.title}',
				'description': f'Opportunity discovered - {opp.opportunity_type}',
				'url': url_for('OpportunityModelView.show', pk=opp.id)
			})
		
		# Sort timeline events by date
		timeline_events.sort(key=lambda x: x['date'] or datetime.min)
		
		return self.render_template(
			'projects/timeline.html',
			project=project,
			timeline_events=timeline_events,
			documents=documents,
			opportunities=opportunities
		)
	
	@expose('/dashboard/<int:pk>')
	@has_access
	def project_dashboard(self, pk):
		"""Project-specific dashboard with metrics and status."""
		project = self.datamodel.get(pk)
		if not project:
			flash('Project not found', 'error')
			return redirect(url_for('ProjectModelView.list'))
		
		# Calculate project metrics
		metrics = self._calculate_project_metrics(project)
		
		return self.render_template(
			'projects/dashboard.html',
			project=project,
			metrics=metrics
		)
	
	@expose('/clone/<int:pk>')
	@has_access
	def clone_project(self, pk):
		"""Create a copy of an existing project."""
		original = self.datamodel.get(pk)
		if not original:
			flash('Project not found', 'error')
			return redirect(url_for('ProjectModelView.list'))
		
		try:
			# Create new project based on original
			new_project = Project(
				name=f"Copy of {original.name}",
				description=original.description,
				client_name=original.client_name,
				status='planning',
				priority=original.priority,
				budget=original.budget,
				estimated_value=original.estimated_value
			)
			
			self.datamodel.add(new_project)
			flash(f'Project cloned successfully', 'success')
			return redirect(url_for('ProjectModelView.edit', pk=new_project.id))
			
		except Exception as e:
			flash(f'Error cloning project: {str(e)}', 'error')
			return redirect(url_for('ProjectModelView.show', pk=pk))
	
	def _calculate_project_metrics(self, project):
		"""Calculate metrics for project dashboard."""
		# Document metrics
		total_documents = self.appbuilder.session.query(Document).filter(
			Document.project_id == project.id
		).count()
		
		documents_by_status = {}
		status_query = self.appbuilder.session.query(
			Document.status,
			self.appbuilder.session.query(Document).filter(
				Document.project_id == project.id,
				Document.status == Document.status
			).count().label('count')
		).filter(Document.project_id == project.id).group_by(Document.status).all()
		
		for status, count in status_query:
			documents_by_status[status] = count
		
		# Opportunity metrics
		total_opportunities = self.appbuilder.session.query(Opportunity).filter(
			Opportunity.project_id == project.id
		).count()
		
		# Timeline metrics
		days_elapsed = 0
		days_remaining = 0
		progress_percentage = 0
		
		if project.start_date and project.due_date:
			total_duration = (project.due_date - project.start_date).days
			if total_duration > 0:
				if project.completion_date:
					days_elapsed = (project.completion_date - project.start_date).days
					progress_percentage = 100
				else:
					days_elapsed = (datetime.utcnow().date() - project.start_date).days
					days_remaining = (project.due_date - datetime.utcnow().date()).days
					progress_percentage = min((days_elapsed / total_duration) * 100, 100)
		
		return {
			'total_documents': total_documents,
			'documents_by_status': documents_by_status,
			'total_opportunities': total_opportunities,
			'days_elapsed': max(days_elapsed, 0),
			'days_remaining': max(days_remaining, 0),
			'progress_percentage': round(progress_percentage, 1),
			'budget_utilization': self._calculate_budget_utilization(project),
			'team_productivity': self._calculate_team_productivity(project)
		}
	
	def _calculate_budget_utilization(self, project):
		"""Calculate budget utilization percentage."""
		if not project.budget or project.budget <= 0:
			return 0
		
		# This would connect to actual expense tracking
		# For now, return a mock calculation
		if project.status == 'completed':
			return 95  # Assume 95% budget utilization for completed projects
		elif project.status == 'active':
			# Calculate based on time progress
			if project.start_date and project.due_date:
				total_duration = (project.due_date - project.start_date).days
				elapsed_duration = (datetime.utcnow().date() - project.start_date).days
				if total_duration > 0:
					return min((elapsed_duration / total_duration) * 80, 80)  # Conservative estimate
		
		return 25  # Default for planning/new projects
	
	def _calculate_team_productivity(self, project):
		"""Calculate team productivity score."""
		# Documents created in project
		document_count = self.appbuilder.session.query(Document).filter(
			Document.project_id == project.id
		).count()
		
		# Project duration
		if project.start_date:
			duration_days = (datetime.utcnow().date() - project.start_date).days + 1
			docs_per_day = document_count / duration_days if duration_days > 0 else 0
			
			# Normalize to 0-100 scale (assuming 0.5 docs/day is good productivity)
			productivity_score = min((docs_per_day / 0.5) * 100, 100)
			return round(productivity_score, 1)
		
		return 50  # Default moderate productivity
	
	def pre_add(self, item):
		"""Pre-processing before adding a new project."""
		if not item.project_id:
			import uuid
			item.project_id = str(uuid.uuid4())
		
		if not item.status:
			item.status = 'active'
		
		if not item.priority:
			item.priority = 'medium'


class ProjectApi(BaseApi):
	"""REST API for project operations."""
	
	resource_name = 'projects'
	datamodel = SQLAInterface(Project)
	
	@api_expose('/metrics/<int:pk>', methods=['GET'])
	@protect()
	def project_metrics(self, pk):
		"""Get project metrics via API."""
		project = self.datamodel.get(pk)
		if not project:
			return {'error': 'Project not found'}, 404
		
		# Calculate metrics (reuse from view)
		view = ProjectModelView()
		metrics = view._calculate_project_metrics(project)
		
		return {
			'project_id': project.id,
			'project_name': project.name,
			'metrics': metrics
		}
	
	@api_expose('/timeline/<int:pk>', methods=['GET'])
	@protect()
	def project_timeline_api(self, pk):
		"""Get project timeline via API."""
		project = self.datamodel.get(pk)
		if not project:
			return {'error': 'Project not found'}, 404
		
		# Get timeline data (similar to view logic)
		documents = self.datamodel.session.query(Document).filter(
			Document.project_id == pk
		).order_by(Document.created_on).all()
		
		opportunities = self.datamodel.session.query(Opportunity).filter(
			Opportunity.project_id == pk
		).order_by(Opportunity.posted_date).all()
		
		timeline = {
			'project_milestones': [],
			'documents': [],
			'opportunities': []
		}
		
		# Add project milestones
		if project.start_date:
			timeline['project_milestones'].append({
				'date': project.start_date.isoformat(),
				'type': 'start',
				'title': 'Project Start'
			})
		
		if project.due_date:
			timeline['project_milestones'].append({
				'date': project.due_date.isoformat(),
				'type': 'due',
				'title': 'Project Due'
			})
		
		if project.completion_date:
			timeline['project_milestones'].append({
				'date': project.completion_date.isoformat(),
				'type': 'completion',
				'title': 'Project Completed'
			})
		
		# Add documents
		for doc in documents:
			timeline['documents'].append({
				'id': doc.id,
				'title': doc.title,
				'type': doc.document_type,
				'status': doc.status,
				'created_on': doc.created_on.isoformat() if doc.created_on else None
			})
		
		# Add opportunities
		for opp in opportunities:
			timeline['opportunities'].append({
				'id': opp.id,
				'title': opp.title,
				'type': opp.opportunity_type,
				'status': opp.status,
				'posted_date': opp.posted_date.isoformat() if opp.posted_date else None
			})
		
		return timeline