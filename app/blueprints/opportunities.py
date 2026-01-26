"""
Opportunity management views and APIs for DocuFusion Flask-AppBuilder.
"""

from flask import request, jsonify, redirect, url_for, flash
from flask_appbuilder import ModelView, expose, has_access
from flask_appbuilder.api import BaseApi, expose as api_expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import protect
from flask_login import current_user
from wtforms import SelectField, DateField, FloatField, URLField
from wtforms.validators import DataRequired, NumberRange, URL, Optional
from datetime import datetime, timedelta

from ..models import Opportunity, Project, Document
from ..services.ai_service import AIService


class OpportunityModelView(ModelView):
	"""Opportunity management view for discovered RFPs and business opportunities."""
	
	datamodel = SQLAInterface(Opportunity)
	
	# List view configuration
	list_columns = [
		'title', 'source_organization', 'opportunity_type', 'status', 'priority',
		'submission_deadline', 'estimated_value', 'qualification_score'
	]
	list_title = "Business Opportunities"
	
	# Show view configuration
	show_columns = [
		'title', 'description', 'source_url', 'source_organization',
		'opportunity_type', 'industry', 'location', 'status', 'priority',
		'posted_date', 'submission_deadline', 'project_start_date', 'project_end_date',
		'estimated_value', 'contract_length', 'qualification_score', 'win_probability',
		'project', 'created_on', 'created_by'
	]
	show_title = "Opportunity Details"
	
	# Add/Edit form configuration
	add_columns = [
		'title', 'description', 'source_url', 'source_organization',
		'opportunity_type', 'industry', 'location', 'status', 'priority',
		'posted_date', 'submission_deadline', 'project_start_date', 'project_end_date',
		'estimated_value', 'contract_length', 'project'
	]
	edit_columns = add_columns
	
	# Form field customization
	add_form_extra_fields = {
		'opportunity_type': SelectField(
			'Opportunity Type',
			choices=[
				('rfp', 'Request for Proposal (RFP)'),
				('rfq', 'Request for Quote (RFQ)'),
				('rfi', 'Request for Information (RFI)'),
				('grant', 'Grant Opportunity'),
				('contract', 'Direct Contract'),
				('partnership', 'Partnership'),
				('other', 'Other')
			],
			validators=[DataRequired()]
		),
		'status': SelectField(
			'Status',
			choices=[
				('discovered', 'Discovered'),
				('reviewing', 'Under Review'),
				('pursuing', 'Pursuing'),
				('bid_submitted', 'Bid Submitted'),
				('won', 'Won'),
				('lost', 'Lost'),
				('declined', 'Declined')
			],
			default='discovered'
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
		'estimated_value': FloatField(
			'Estimated Value ($)',
			validators=[NumberRange(min=0), Optional()]
		),
		'source_url': URLField(
			'Source URL',
			validators=[URL(), Optional()]
		)
	}
	
	edit_form_extra_fields = add_form_extra_fields.copy()
	
	# Search configuration
	search_columns = [
		'title', 'description', 'source_organization', 'opportunity_type',
		'industry', 'location', 'status'
	]
	
	# Permissions
	base_permissions = ['can_list', 'can_show', 'can_add', 'can_edit', 'can_delete']
	
	def __init__(self):
		super().__init__()
		self.ai_service = AIService()
	
	@expose('/analyze/<int:pk>')
	@has_access
	def analyze_opportunity(self, pk):
		"""Run AI analysis on opportunity to assess fit and win probability."""
		opportunity = self.datamodel.get(pk)
		if not opportunity:
			flash('Opportunity not found', 'error')
			return redirect(url_for('OpportunityModelView.list'))
		
		try:
			# Run AI analysis
			analysis = self._run_opportunity_analysis(opportunity)
			
			# Update opportunity with analysis results
			opportunity.qualification_score = analysis.get('qualification_score', 0)
			opportunity.win_probability = analysis.get('win_probability', 0)
			opportunity.competitive_assessment = analysis.get('competitive_assessment', {})
			opportunity.requirements_analysis = analysis.get('requirements_analysis', {})
			
			self.datamodel.edit(opportunity)
			
			flash('AI analysis completed successfully', 'success')
			
			return self.render_template(
				'opportunities/analysis_results.html',
				opportunity=opportunity,
				analysis=analysis
			)
			
		except Exception as e:
			flash(f'Error running AI analysis: {str(e)}', 'error')
			return redirect(url_for('OpportunityModelView.show', pk=pk))
	
	@expose('/create_project/<int:pk>')
	@has_access
	def create_project_from_opportunity(self, pk):
		"""Create a new project from this opportunity."""
		opportunity = self.datamodel.get(pk)
		if not opportunity:
			flash('Opportunity not found', 'error')
			return redirect(url_for('OpportunityModelView.list'))
		
		# Check permissions
		if not self.appbuilder.sm.has_docufusion_permission('can_create_documents'):
			flash('You do not have permission to create projects', 'error')
			return redirect(url_for('OpportunityModelView.show', pk=pk))
		
		try:
			# Create new project from opportunity
			new_project = Project(
				name=opportunity.title,
				description=f"Project created from opportunity: {opportunity.title}",
				client_name=opportunity.source_organization,
				status='planning',
				priority=opportunity.priority,
				start_date=opportunity.project_start_date,
				due_date=opportunity.submission_deadline,
				estimated_value=opportunity.estimated_value
			)
			
			# Add to database
			from .projects import ProjectModelView
			project_view = ProjectModelView()
			project_view.datamodel.add(new_project)
			
			# Link opportunity to project
			opportunity.project_id = new_project.id
			self.datamodel.edit(opportunity)
			
			flash(f'Project created from opportunity "{opportunity.title}"', 'success')
			return redirect(url_for('ProjectModelView.show', pk=new_project.id))
			
		except Exception as e:
			flash(f'Error creating project: {str(e)}', 'error')
			return redirect(url_for('OpportunityModelView.show', pk=pk))
	
	@expose('/bulk_analyze')
	@has_access
	def bulk_analyze(self):
		"""Analyze multiple opportunities in batch."""
		# Get unanalyzed opportunities
		unanalyzed = self.datamodel.session.query(Opportunity).filter(
			Opportunity.qualification_score.is_(None)
		).limit(10).all()  # Limit to 10 for performance
		
		results = []
		
		for opportunity in unanalyzed:
			try:
				analysis = self._run_opportunity_analysis(opportunity)
				
				# Update opportunity
				opportunity.qualification_score = analysis.get('qualification_score', 0)
				opportunity.win_probability = analysis.get('win_probability', 0)
				opportunity.competitive_assessment = analysis.get('competitive_assessment', {})
				opportunity.requirements_analysis = analysis.get('requirements_analysis', {})
				
				self.datamodel.edit(opportunity)
				
				results.append({
					'opportunity_id': opportunity.id,
					'title': opportunity.title,
					'status': 'success',
					'qualification_score': opportunity.qualification_score,
					'win_probability': opportunity.win_probability
				})
				
			except Exception as e:
				results.append({
					'opportunity_id': opportunity.id,
					'title': opportunity.title,
					'status': 'error',
					'error': str(e)
				})
		
		return self.render_template(
			'opportunities/bulk_analysis_results.html',
			results=results
		)
	
	@expose('/dashboard')
	@has_access
	def opportunity_dashboard(self):
		"""Dashboard view showing opportunity pipeline and analytics."""
		# Get opportunity statistics
		stats = self._get_opportunity_statistics()
		
		# Get top opportunities
		top_opportunities = self.datamodel.session.query(Opportunity).filter(
			Opportunity.status.in_(['reviewing', 'pursuing'])
		).order_by(
			Opportunity.win_probability.desc(),
			Opportunity.estimated_value.desc()
		).limit(10).all()
		
		return self.render_template(
			'opportunities/dashboard.html',
			stats=stats,
			top_opportunities=top_opportunities
		)
	
	def _run_opportunity_analysis(self, opportunity):
		"""Run comprehensive AI analysis on opportunity."""
		analysis = {
			'qualification_score': 0.5,
			'win_probability': 0.3,
			'competitive_assessment': {},
			'requirements_analysis': {},
			'recommendations': []
		}
		
		try:
			if self.ai_service:
				# Analyze opportunity description
				content = f"{opportunity.title}\n\n{opportunity.description or ''}"
				
				# Get AI predictions
				if hasattr(self.ai_service, 'predict_success_probability'):
					opportunity_data = {
						'type': opportunity.opportunity_type,
						'value': opportunity.estimated_value or 0,
						'industry': opportunity.industry,
						'location': opportunity.location
					}
					
					win_prob = self.ai_service.predict_success_probability(content, opportunity_data)
					analysis['win_probability'] = win_prob
				
				# Qualification scoring
				qualification_factors = []
				
				# Industry match (mock scoring)
				if opportunity.industry in ['technology', 'consulting', 'software']:
					qualification_factors.append(0.8)
				else:
					qualification_factors.append(0.6)
				
				# Value appropriateness
				if opportunity.estimated_value:
					if 10000 <= opportunity.estimated_value <= 1000000:  # Sweet spot
						qualification_factors.append(0.9)
					else:
						qualification_factors.append(0.5)
				else:
					qualification_factors.append(0.4)
				
				# Timeline feasibility
				if opportunity.submission_deadline:
					days_to_deadline = (opportunity.submission_deadline - datetime.utcnow().date()).days
					if days_to_deadline >= 14:  # At least 2 weeks
						qualification_factors.append(0.8)
					elif days_to_deadline >= 7:  # At least 1 week
						qualification_factors.append(0.6)
					else:
						qualification_factors.append(0.3)
				else:
					qualification_factors.append(0.5)
				
				# Calculate average qualification score
				if qualification_factors:
					analysis['qualification_score'] = sum(qualification_factors) / len(qualification_factors)
				
				# Generate recommendations
				if analysis['qualification_score'] > 0.7:
					analysis['recommendations'].append({
						'type': 'pursue',
						'message': 'High qualification score - recommend pursuing this opportunity'
					})
				elif analysis['qualification_score'] > 0.5:
					analysis['recommendations'].append({
						'type': 'review',
						'message': 'Moderate qualification score - requires detailed review'
					})
				else:
					analysis['recommendations'].append({
						'type': 'decline',
						'message': 'Low qualification score - consider declining'
					})
				
				# Add timeline recommendation
				if opportunity.submission_deadline:
					days_to_deadline = (opportunity.submission_deadline - datetime.utcnow().date()).days
					if days_to_deadline < 7:
						analysis['recommendations'].append({
							'type': 'urgent',
							'message': f'Only {days_to_deadline} days to deadline - urgent action required'
						})
			
		except Exception as e:
			print(f"Opportunity analysis failed: {e}")
		
		return analysis
	
	def _get_opportunity_statistics(self):
		"""Get opportunity pipeline statistics."""
		# Status distribution
		status_query = self.datamodel.session.query(
			Opportunity.status,
			self.datamodel.session.query(Opportunity).filter(
				Opportunity.status == Opportunity.status
			).count().label('count')
		).group_by(Opportunity.status).all()
		
		status_distribution = {status: count for status, count in status_query}
		
		# Value statistics
		value_query = self.datamodel.session.query(Opportunity.estimated_value).filter(
			Opportunity.estimated_value.isnot(None)
		).all()
		
		total_value = sum(value[0] for value in value_query) if value_query else 0
		avg_value = total_value / len(value_query) if value_query else 0
		
		# Win rate calculation (mock - would come from historical data)
		won_count = status_distribution.get('won', 0)
		total_completed = won_count + status_distribution.get('lost', 0)
		win_rate = (won_count / total_completed * 100) if total_completed > 0 else 0
		
		# Recent activity
		seven_days_ago = datetime.utcnow() - timedelta(days=7)
		recent_opportunities = self.datamodel.session.query(Opportunity).filter(
			Opportunity.created_on >= seven_days_ago
		).count()
		
		return {
			'total_opportunities': sum(status_distribution.values()),
			'status_distribution': status_distribution,
			'total_pipeline_value': total_value,
			'average_opportunity_value': avg_value,
			'win_rate': round(win_rate, 1),
			'recent_discoveries': recent_opportunities
		}
	
	def pre_add(self, item):
		"""Pre-processing before adding a new opportunity."""
		if not item.opportunity_id:
			import uuid
			item.opportunity_id = str(uuid.uuid4())
		
		if not item.status:
			item.status = 'discovered'
		
		if not item.priority:
			item.priority = 'medium'


class OpportunityApi(BaseApi):
	"""REST API for opportunity operations."""
	
	resource_name = 'opportunities'
	datamodel = SQLAInterface(Opportunity)
	
	def __init__(self):
		super().__init__()
		self.ai_service = AIService()
	
	@api_expose('/analyze/<int:pk>', methods=['POST'])
	@protect()
	def analyze_opportunity_api(self, pk):
		"""Run AI analysis on opportunity via API."""
		opportunity = self.datamodel.get(pk)
		if not opportunity:
			return {'error': 'Opportunity not found'}, 404
		
		try:
			view = OpportunityModelView()
			analysis = view._run_opportunity_analysis(opportunity)
			
			# Update opportunity
			opportunity.qualification_score = analysis.get('qualification_score', 0)
			opportunity.win_probability = analysis.get('win_probability', 0)
			opportunity.competitive_assessment = analysis.get('competitive_assessment', {})
			opportunity.requirements_analysis = analysis.get('requirements_analysis', {})
			
			self.datamodel.edit(opportunity)
			
			return {
				'message': 'Analysis completed',
				'analysis': analysis
			}
			
		except Exception as e:
			return {'error': f'Analysis failed: {str(e)}'}, 500
	
	@api_expose('/pipeline', methods=['GET'])
	@protect()
	def opportunity_pipeline(self):
		"""Get opportunity pipeline statistics."""
		view = OpportunityModelView()
		stats = view._get_opportunity_statistics()
		
		return {'pipeline_stats': stats}
	
	@api_expose('/recommendations/<int:pk>', methods=['GET'])
	@protect()
	def get_recommendations(self, pk):
		"""Get AI recommendations for opportunity."""
		opportunity = self.datamodel.get(pk)
		if not opportunity:
			return {'error': 'Opportunity not found'}, 404
		
		try:
			view = OpportunityModelView()
			analysis = view._run_opportunity_analysis(opportunity)
			
			return {
				'opportunity_id': opportunity.id,
				'recommendations': analysis.get('recommendations', [])
			}
			
		except Exception as e:
			return {'error': f'Recommendation generation failed: {str(e)}'}, 500