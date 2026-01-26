"""
Dashboard views for DocuFusion Flask-AppBuilder application.
"""

from flask import request, jsonify, render_template
from flask_appbuilder import BaseView, expose, has_access
from flask_appbuilder.api import BaseApi, expose as api_expose
from flask_appbuilder.security.decorators import protect
from flask_login import current_user
from sqlalchemy import func, desc
from datetime import datetime, timedelta
import json

from ..models import Document, Project, Opportunity, WorkflowInstance
from ..services.ai_service import AIService


class DashboardView(BaseView):
	"""
	Main dashboard view providing overview of system status and user activity.
	"""
	
	default_view = 'dashboard'
	
	def __init__(self):
		super().__init__()
		self.ai_service = AIService()
	
	@expose('/')
	@has_access
	def dashboard(self):
		"""Main dashboard page."""
		# Get user-specific statistics
		user_stats = self._get_user_statistics()
		system_stats = self._get_system_statistics()
		recent_activity = self._get_recent_activity()
		
		return self.render_template(
			'dashboards/main_dashboard.html',
			user_stats=user_stats,
			system_stats=system_stats,
			recent_activity=recent_activity
		)
	
	@expose('/api/stats')
	@has_access
	def dashboard_stats_api(self):
		"""API endpoint for dashboard statistics."""
		stats = {
			'user': self._get_user_statistics(),
			'system': self._get_system_statistics(),
			'recent_activity': self._get_recent_activity()
		}
		return jsonify(stats)
	
	def _get_user_statistics(self):
		"""Get statistics for current user."""
		user_id = current_user.id if current_user.is_authenticated else None
		
		if not user_id:
			return {}
		
		# Documents created by user
		user_documents = self.appbuilder.session.query(Document).filter(
			Document.created_by_fk == user_id
		).count()
		
		# Projects where user is involved
		user_projects = self.appbuilder.session.query(Project).filter(
			Project.created_by_fk == user_id
		).count()
		
		# Recent documents (last 30 days)
		thirty_days_ago = datetime.utcnow() - timedelta(days=30)
		recent_docs = self.appbuilder.session.query(Document).filter(
			Document.created_by_fk == user_id,
			Document.created_on >= thirty_days_ago
		).count()
		
		# Document status distribution
		status_query = self.appbuilder.session.query(
			Document.status,
			func.count(Document.id).label('count')
		).filter(
			Document.created_by_fk == user_id
		).group_by(Document.status).all()
		
		status_distribution = {status: count for status, count in status_query}
		
		return {
			'total_documents': user_documents,
			'total_projects': user_projects,
			'recent_documents': recent_docs,
			'status_distribution': status_distribution,
			'productivity_score': self._calculate_productivity_score(user_id)
		}
	
	def _get_system_statistics(self):
		"""Get system-wide statistics."""
		# Total counts
		total_documents = self.appbuilder.session.query(Document).count()
		total_projects = self.appbuilder.session.query(Project).count()
		total_opportunities = self.appbuilder.session.query(Opportunity).count()
		
		# Active workflows
		active_workflows = self.appbuilder.session.query(WorkflowInstance).filter(
			WorkflowInstance.status == 'active'
		).count()
		
		# Document types distribution
		type_query = self.appbuilder.session.query(
			Document.document_type,
			func.count(Document.id).label('count')
		).group_by(Document.document_type).all()
		
		type_distribution = {doc_type: count for doc_type, count in type_query}
		
		# Recent activity (last 7 days)
		seven_days_ago = datetime.utcnow() - timedelta(days=7)
		recent_activity = self.appbuilder.session.query(Document).filter(
			Document.created_on >= seven_days_ago
		).count()
		
		return {
			'total_documents': total_documents,
			'total_projects': total_projects,
			'total_opportunities': total_opportunities,
			'active_workflows': active_workflows,
			'type_distribution': type_distribution,
			'recent_activity': recent_activity,
			'system_health': self._get_system_health()
		}
	
	def _get_recent_activity(self, limit=10):
		"""Get recent system activity."""
		# Recent documents
		recent_docs = self.appbuilder.session.query(Document).order_by(
			desc(Document.created_on)
		).limit(limit).all()
		
		# Recent projects
		recent_projects = self.appbuilder.session.query(Project).order_by(
			desc(Project.created_on)
		).limit(limit).all()
		
		activity = []
		
		# Add documents to activity
		for doc in recent_docs:
			activity.append({
				'type': 'document',
				'action': 'created',
				'title': doc.title,
				'user': doc.created_by.username if doc.created_by else 'Unknown',
				'timestamp': doc.created_on.isoformat() if doc.created_on else None,
				'url': f'/documentmodelview/show/{doc.id}'
			})
		
		# Add projects to activity
		for project in recent_projects:
			activity.append({
				'type': 'project',
				'action': 'created',
				'title': project.name,
				'user': project.created_by.username if project.created_by else 'Unknown',
				'timestamp': project.created_on.isoformat() if project.created_on else None,
				'url': f'/projectmodelview/show/{project.id}'
			})
		
		# Sort by timestamp and return top items
		activity.sort(key=lambda x: x['timestamp'] or '', reverse=True)
		return activity[:limit]
	
	def _calculate_productivity_score(self, user_id):
		"""Calculate productivity score for user."""
		try:
			# Documents created in last 30 days
			thirty_days_ago = datetime.utcnow() - timedelta(days=30)
			recent_docs = self.appbuilder.session.query(Document).filter(
				Document.created_by_fk == user_id,
				Document.created_on >= thirty_days_ago
			).count()
			
			# Quality scores of recent documents
			quality_scores = self.appbuilder.session.query(Document.quality_score).filter(
				Document.created_by_fk == user_id,
				Document.quality_score.isnot(None),
				Document.created_on >= thirty_days_ago
			).all()
			
			avg_quality = sum(score[0] for score in quality_scores) / len(quality_scores) if quality_scores else 0.5
			
			# Combine activity and quality
			activity_score = min(recent_docs / 10, 1.0)  # Normalize to 0-1
			productivity = (activity_score * 0.6) + (avg_quality * 0.4)
			
			return round(productivity * 100, 1)  # Return as percentage
			
		except Exception as e:
			print(f"Productivity calculation failed: {e}")
			return 50.0
	
	def _get_system_health(self):
		"""Get system health indicators."""
		health = {
			'status': 'healthy',
			'indicators': []
		}
		
		try:
			# Check database connectivity
			self.appbuilder.session.query(Document).count()
			health['indicators'].append({
				'name': 'Database',
				'status': 'healthy',
				'message': 'Database connection is working'
			})
			
			# Check AI services
			if self.ai_service:
				health['indicators'].append({
					'name': 'AI Services',
					'status': 'healthy',
					'message': 'AI services are available'
				})
			else:
				health['indicators'].append({
					'name': 'AI Services',
					'status': 'warning',
					'message': 'AI services are not fully available'
				})
			
			# Check for any critical issues
			warning_count = len([i for i in health['indicators'] if i['status'] == 'warning'])
			error_count = len([i for i in health['indicators'] if i['status'] == 'error'])
			
			if error_count > 0:
				health['status'] = 'error'
			elif warning_count > 0:
				health['status'] = 'warning'
				
		except Exception as e:
			health['status'] = 'error'
			health['indicators'].append({
				'name': 'System',
				'status': 'error',
				'message': f'System health check failed: {str(e)}'
			})
		
		return health


class ExecutiveDashboardView(BaseView):
	"""
	Executive dashboard with high-level metrics and strategic insights.
	"""
	
	default_view = 'executive'
	
	def __init__(self):
		super().__init__()
		self.ai_service = AIService()
	
	@expose('/')
	@has_access
	def executive(self):
		"""Executive dashboard page."""
		# Check if user has permission to view executive dashboard
		if not self.appbuilder.sm.has_docufusion_permission('can_view_analytics'):
			return self.render_template('errors/403.html'), 403
		
		metrics = self._get_executive_metrics()
		trends = self._get_trend_analysis()
		insights = self._get_ai_insights()
		
		return self.render_template(
			'dashboards/executive_dashboard.html',
			metrics=metrics,
			trends=trends,
			insights=insights
		)
	
	@expose('/api/metrics')
	@has_access
	def executive_metrics_api(self):
		"""API endpoint for executive metrics."""
		if not self.appbuilder.sm.has_docufusion_permission('can_view_analytics'):
			return jsonify({'error': 'Permission denied'}), 403
		
		return jsonify({
			'metrics': self._get_executive_metrics(),
			'trends': self._get_trend_analysis(),
			'insights': self._get_ai_insights()
		})
	
	def _get_executive_metrics(self):
		"""Get high-level executive metrics."""
		# Business impact metrics
		total_opportunities = self.appbuilder.session.query(Opportunity).count()
		
		# Opportunity value analysis
		opportunity_values = self.appbuilder.session.query(Opportunity.estimated_value).filter(
			Opportunity.estimated_value.isnot(None)
		).all()
		
		total_opportunity_value = sum(value[0] for value in opportunity_values) if opportunity_values else 0
		avg_opportunity_value = total_opportunity_value / len(opportunity_values) if opportunity_values else 0
		
		# Win rates (mock data - would come from real tracking)
		win_rate = 0.35  # 35% win rate
		
		# Document production metrics
		total_documents = self.appbuilder.session.query(Document).count()
		
		# Recent productivity (last 30 days)
		thirty_days_ago = datetime.utcnow() - timedelta(days=30)
		recent_docs = self.appbuilder.session.query(Document).filter(
			Document.created_on >= thirty_days_ago
		).count()
		
		# Average quality scores
		quality_scores = self.appbuilder.session.query(Document.quality_score).filter(
			Document.quality_score.isnot(None)
		).all()
		
		avg_quality = sum(score[0] for score in quality_scores) / len(quality_scores) if quality_scores else 0
		
		return {
			'total_opportunities': total_opportunities,
			'total_opportunity_value': total_opportunity_value,
			'avg_opportunity_value': avg_opportunity_value,
			'win_rate': win_rate,
			'total_documents': total_documents,
			'monthly_documents': recent_docs,
			'avg_quality_score': round(avg_quality, 2),
			'roi_estimate': self._calculate_roi_estimate(total_opportunity_value, win_rate)
		}
	
	def _get_trend_analysis(self):
		"""Get trend analysis for executive dashboard."""
		# Document creation trends (last 6 months)
		trends = []
		
		for i in range(6):
			month_start = datetime.utcnow().replace(day=1) - timedelta(days=30*i)
			month_end = month_start + timedelta(days=30)
			
			doc_count = self.appbuilder.session.query(Document).filter(
				Document.created_on >= month_start,
				Document.created_on < month_end
			).count()
			
			project_count = self.appbuilder.session.query(Project).filter(
				Project.created_on >= month_start,
				Project.created_on < month_end
			).count()
			
			trends.append({
				'month': month_start.strftime('%Y-%m'),
				'documents': doc_count,
				'projects': project_count
			})
		
		trends.reverse()  # Chronological order
		
		# Calculate growth rates
		if len(trends) >= 2:
			doc_growth = ((trends[-1]['documents'] - trends[-2]['documents']) / 
						 max(trends[-2]['documents'], 1)) * 100
			project_growth = ((trends[-1]['projects'] - trends[-2]['projects']) / 
							 max(trends[-2]['projects'], 1)) * 100
		else:
			doc_growth = 0
			project_growth = 0
		
		return {
			'monthly_trends': trends,
			'document_growth_rate': round(doc_growth, 1),
			'project_growth_rate': round(project_growth, 1)
		}
	
	def _get_ai_insights(self):
		"""Get AI-generated insights for executives."""
		insights = []
		
		try:
			# Document quality insights
			quality_scores = self.appbuilder.session.query(Document.quality_score).filter(
				Document.quality_score.isnot(None)
			).all()
			
			if quality_scores:
				avg_quality = sum(score[0] for score in quality_scores) / len(quality_scores)
				
				if avg_quality < 0.6:
					insights.append({
						'type': 'quality',
						'priority': 'high',
						'title': 'Document Quality Improvement Needed',
						'message': f'Average document quality score is {avg_quality:.1%}. Consider implementing quality training and AI assistance.',
						'action': 'Review quality processes'
					})
				elif avg_quality > 0.8:
					insights.append({
						'type': 'quality',
						'priority': 'positive',
						'title': 'Excellent Document Quality',
						'message': f'Document quality score of {avg_quality:.1%} exceeds industry standards.',
						'action': 'Maintain current standards'
					})
			
			# Productivity insights
			recent_activity = self._get_recent_activity_metrics()
			
			if recent_activity['documents_per_week'] < 5:
				insights.append({
					'type': 'productivity',
					'priority': 'medium',
					'title': 'Low Document Production',
					'message': 'Current document production rate may not meet project demands.',
					'action': 'Consider workflow optimization'
				})
			
			# Opportunity insights
			opportunity_count = self.appbuilder.session.query(Opportunity).filter(
				Opportunity.status == 'discovered'
			).count()
			
			if opportunity_count > 20:
				insights.append({
					'type': 'opportunities',
					'priority': 'medium',
					'title': 'High Number of Unreviewed Opportunities',
					'message': f'{opportunity_count} opportunities need review. Consider expanding review capacity.',
					'action': 'Review opportunity pipeline'
				})
				
		except Exception as e:
			insights.append({
				'type': 'system',
				'priority': 'warning',
				'title': 'AI Insights Unavailable',
				'message': 'Unable to generate AI insights at this time.',
				'action': 'Check system status'
			})
		
		return insights
	
	def _calculate_roi_estimate(self, total_value, win_rate):
		"""Calculate ROI estimate based on opportunities and win rate."""
		expected_value = total_value * win_rate
		# Assume 20% margin on won opportunities
		estimated_profit = expected_value * 0.20
		# Assume $50K annual system cost
		system_cost = 50000
		
		if system_cost > 0:
			roi = ((estimated_profit - system_cost) / system_cost) * 100
			return round(roi, 1)
		
		return 0
	
	def _get_recent_activity_metrics(self):
		"""Get recent activity metrics for trend analysis."""
		seven_days_ago = datetime.utcnow() - timedelta(days=7)
		
		recent_docs = self.appbuilder.session.query(Document).filter(
			Document.created_on >= seven_days_ago
		).count()
		
		recent_projects = self.appbuilder.session.query(Project).filter(
			Project.created_on >= seven_days_ago
		).count()
		
		return {
			'documents_per_week': recent_docs,
			'projects_per_week': recent_projects
		}