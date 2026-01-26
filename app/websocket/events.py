"""
WebSocket event handlers for real-time features.
"""

from flask_socketio import emit, join_room, leave_room
from flask_login import current_user
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def register_events(socketio):
	"""
	Register all WebSocket event handlers.
	
	Args:
		socketio: SocketIO instance
	"""
	
	@socketio.on('ping')
	def handle_ping():
		"""Handle ping requests for connection testing."""
		emit('pong', {'timestamp': str(datetime.utcnow())})
	
	@socketio.on('request_document_status')
	def handle_document_status_request(data):
		"""Handle requests for document status updates."""
		if not current_user.is_authenticated:
			return False
		
		document_id = data.get('document_id')
		if not document_id:
			return False
		
		# Get document status from database
		from ..models import Document
		document = Document.query.get(document_id)
		
		if document:
			emit('document_status', {
				'document_id': document_id,
				'status': document.status,
				'version': document.version,
				'last_modified': str(document.changed_on) if document.changed_on else None,
				'quality_score': document.quality_score,
				'voice_dna_score': document.voice_dna_score
			})
	
	@socketio.on('request_active_collaborators')
	def handle_active_collaborators_request(data):
		"""Handle requests for active collaborators on a document."""
		if not current_user.is_authenticated:
			return False
		
		document_id = data.get('document_id')
		if not document_id:
			return False
		
		# Get active collaborators from room
		room = f"document_{document_id}"
		
		# In a real implementation, you'd query the room for active users
		# For now, emit a mock response
		emit('active_collaborators', {
			'document_id': document_id,
			'collaborators': [
				{
					'user_id': current_user.id,
					'username': current_user.username,
					'status': 'active',
					'last_seen': str(datetime.utcnow())
				}
			]
		})
	
	@socketio.on('workflow_action')
	def handle_workflow_action(data):
		"""Handle workflow action events."""
		if not current_user.is_authenticated:
			return False
		
		workflow_id = data.get('workflow_id')
		action = data.get('action')
		
		if not all([workflow_id, action]):
			return False
		
		# Process workflow action
		from ..services.workflow_service import WorkflowService
		workflow_service = WorkflowService()
		
		try:
			success = workflow_service.advance_workflow(workflow_id, action, current_user.id)
			
			if success:
				# Get updated workflow status
				status = workflow_service.get_workflow_status(workflow_id)
				
				# Broadcast workflow update
				emit('workflow_updated', {
					'workflow_id': workflow_id,
					'action': action,
					'status': status,
					'user': current_user.username,
					'timestamp': str(datetime.utcnow())
				}, broadcast=True)
			else:
				emit('workflow_error', {
					'workflow_id': workflow_id,
					'message': 'Failed to process workflow action'
				})
				
		except Exception as e:
			logger.error(f"Workflow action failed: {e}")
			emit('workflow_error', {
				'workflow_id': workflow_id,
				'message': str(e)
			})
	
	@socketio.on('ai_analysis_request')
	def handle_ai_analysis_request(data):
		"""Handle requests for AI analysis."""
		if not current_user.is_authenticated:
			return False
		
		document_id = data.get('document_id')
		analysis_type = data.get('analysis_type', 'comprehensive')
		
		if not document_id:
			return False
		
		# Get document
		from ..models import Document
		document = Document.query.get(document_id)
		
		if not document:
			emit('ai_analysis_error', {
				'document_id': document_id,
				'message': 'Document not found'
			})
			return
		
		# Emit analysis started event
		emit('ai_analysis_started', {
			'document_id': document_id,
			'analysis_type': analysis_type,
			'timestamp': str(datetime.utcnow())
		})
		
		# Perform AI analysis (async in real implementation)
		from ..services.ai_service import AIService
		ai_service = AIService()
		
		try:
			if analysis_type == 'comprehensive':
				analysis = ai_service.comprehensive_analysis(document.content, document.document_type)
			elif analysis_type == 'voice':
				voice_score = ai_service.analyze_voice_consistency(document.content)
				analysis = {'voice_score': voice_score}
			elif analysis_type == 'quality':
				quality_score = ai_service.analyze_quality(document.content)
				analysis = {'quality_score': quality_score}
			else:
				analysis = {'error': 'Unknown analysis type'}
			
			# Emit analysis completed event
			emit('ai_analysis_completed', {
				'document_id': document_id,
				'analysis_type': analysis_type,
				'results': analysis,
				'timestamp': str(datetime.utcnow())
			})
			
		except Exception as e:
			logger.error(f"AI analysis failed: {e}")
			emit('ai_analysis_error', {
				'document_id': document_id,
				'message': str(e)
			})
	
	@socketio.on('subscribe_notifications')
	def handle_subscribe_notifications(data):
		"""Handle notification subscription requests."""
		if not current_user.is_authenticated:
			return False
		
		notification_types = data.get('types', [])
		
		# Join notification rooms based on subscription
		for notification_type in notification_types:
			if notification_type in ['document_updates', 'workflow_updates', 'system_alerts']:
				join_room(f"notifications_{notification_type}")
		
		emit('notification_subscription_confirmed', {
			'types': notification_types,
			'timestamp': str(datetime.utcnow())
		})
	
	@socketio.on('unsubscribe_notifications')
	def handle_unsubscribe_notifications(data):
		"""Handle notification unsubscription requests."""
		if not current_user.is_authenticated:
			return False
		
		notification_types = data.get('types', [])
		
		# Leave notification rooms
		for notification_type in notification_types:
			if notification_type in ['document_updates', 'workflow_updates', 'system_alerts']:
				leave_room(f"notifications_{notification_type}")
		
		emit('notification_unsubscription_confirmed', {
			'types': notification_types,
			'timestamp': str(datetime.utcnow())
		})
	
	@socketio.on('heartbeat')
	def handle_heartbeat():
		"""Handle heartbeat for connection monitoring."""
		if current_user.is_authenticated:
			emit('heartbeat_ack', {
				'user_id': current_user.id,
				'timestamp': str(datetime.utcnow())
			})
	
	@socketio.on('dashboard_data_request')
	def handle_dashboard_data_request():
		"""Handle requests for real-time dashboard data."""
		if not current_user.is_authenticated:
			return False
		
		# Get dashboard data
		try:
			from ..blueprints.dashboards import DashboardView
			dashboard_view = DashboardView()
			
			with socketio.app.app_context():
				user_stats = dashboard_view._get_user_statistics()
				system_stats = dashboard_view._get_system_statistics()
				recent_activity = dashboard_view._get_recent_activity()
			
			emit('dashboard_data', {
				'user_stats': user_stats,
				'system_stats': system_stats,
				'recent_activity': recent_activity,
				'timestamp': str(datetime.utcnow())
			})
			
		except Exception as e:
			logger.error(f"Dashboard data request failed: {e}")
			emit('dashboard_error', {
				'message': str(e)
			})
	
	@socketio.on('typing_indicator')
	def handle_typing_indicator(data):
		"""Handle typing indicators for document collaboration."""
		if not current_user.is_authenticated:
			return False
		
		document_id = data.get('document_id')
		is_typing = data.get('is_typing', False)
		
		if not document_id:
			return False
		
		# Broadcast typing indicator to other users in the document
		room = f"document_{document_id}"
		
		emit('user_typing', {
			'user_id': current_user.id,
			'username': current_user.username,
			'document_id': document_id,
			'is_typing': is_typing,
			'timestamp': str(datetime.utcnow())
		}, room=room, include_self=False)
	
	logger.info("WebSocket event handlers registered")