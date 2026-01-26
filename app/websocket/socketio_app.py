"""
Socket.IO application for real-time features.
"""

from flask_socketio import SocketIO
from flask_login import current_user
import logging

logger = logging.getLogger(__name__)

# Initialize SocketIO
socketio = SocketIO(
	cors_allowed_origins="*",
	logger=True,
	engineio_logger=True,
	async_mode='threading'
)


def init_socketio(app):
	"""
	Initialize SocketIO with Flask application.
	
	Args:
		app: Flask application instance
	"""
	socketio.init_app(app)
	
	# Register event handlers
	from .events import register_events
	register_events(socketio)
	
	logger.info("SocketIO initialized for real-time features")
	return socketio


@socketio.on('connect')
def handle_connect():
	"""Handle client connection."""
	if current_user.is_authenticated:
		logger.info(f"User {current_user.username} connected to WebSocket")
		
		# Join user to their personal room for notifications
		from flask_socketio import join_room
		join_room(f"user_{current_user.id}")
		
		# Send connection confirmation
		from flask_socketio import emit
		emit('connection_confirmed', {
			'message': 'Connected to DocuFusion real-time services',
			'user_id': current_user.id,
			'username': current_user.username
		})
	else:
		logger.warning("Unauthenticated user attempted WebSocket connection")
		return False  # Reject connection


@socketio.on('disconnect')
def handle_disconnect():
	"""Handle client disconnection."""
	if current_user.is_authenticated:
		logger.info(f"User {current_user.username} disconnected from WebSocket")
		
		# Leave user room
		from flask_socketio import leave_room
		leave_room(f"user_{current_user.id}")


@socketio.on('join_document')
def handle_join_document(data):
	"""Handle user joining a document collaboration session."""
	if not current_user.is_authenticated:
		return False
	
	document_id = data.get('document_id')
	if not document_id:
		return False
	
	# Verify user has access to document
	from ..models import Document
	from ..services.collaboration_service import CollaborationService
	
	document = Document.query.get(document_id)
	if not document:
		return False
	
	# Check permissions (simplified - should use proper permission system)
	collaboration_service = CollaborationService()
	
	# Join document room
	from flask_socketio import join_room, emit
	room = f"document_{document_id}"
	join_room(room)
	
	# Notify other users in the document
	emit('user_joined_document', {
		'user_id': current_user.id,
		'username': current_user.username,
		'document_id': document_id,
		'timestamp': str(datetime.utcnow())
	}, room=room, include_self=False)
	
	logger.info(f"User {current_user.username} joined document {document_id}")


@socketio.on('leave_document')
def handle_leave_document(data):
	"""Handle user leaving a document collaboration session."""
	if not current_user.is_authenticated:
		return False
	
	document_id = data.get('document_id')
	if not document_id:
		return False
	
	# Leave document room
	from flask_socketio import leave_room, emit
	room = f"document_{document_id}"
	leave_room(room)
	
	# Notify other users
	emit('user_left_document', {
		'user_id': current_user.id,
		'username': current_user.username,
		'document_id': document_id,
		'timestamp': str(datetime.utcnow())
	}, room=room)
	
	logger.info(f"User {current_user.username} left document {document_id}")


@socketio.on('document_edit')
def handle_document_edit(data):
	"""Handle real-time document editing events."""
	if not current_user.is_authenticated:
		return False
	
	document_id = data.get('document_id')
	operation = data.get('operation')
	content = data.get('content')
	
	if not all([document_id, operation]):
		return False
	
	# Verify user has edit permissions
	from ..models import Document
	document = Document.query.get(document_id)
	if not document:
		return False
	
	# Broadcast edit to other users in the document
	from flask_socketio import emit
	room = f"document_{document_id}"
	
	emit('document_updated', {
		'user_id': current_user.id,
		'username': current_user.username,
		'document_id': document_id,
		'operation': operation,
		'content': content,
		'timestamp': str(datetime.utcnow())
	}, room=room, include_self=False)
	
	# Optionally save change to database
	if operation == 'save':
		document.content = content
		from .. import db
		db.session.commit()


@socketio.on('cursor_position')
def handle_cursor_position(data):
	"""Handle cursor position updates for collaboration."""
	if not current_user.is_authenticated:
		return False
	
	document_id = data.get('document_id')
	position = data.get('position')
	
	if not all([document_id, position]):
		return False
	
	# Broadcast cursor position to other users
	from flask_socketio import emit
	room = f"document_{document_id}"
	
	emit('cursor_updated', {
		'user_id': current_user.id,
		'username': current_user.username,
		'document_id': document_id,
		'position': position,
		'timestamp': str(datetime.utcnow())
	}, room=room, include_self=False)


@socketio.on('add_comment')
def handle_add_comment(data):
	"""Handle adding comments to documents."""
	if not current_user.is_authenticated:
		return False
	
	document_id = data.get('document_id')
	comment_text = data.get('comment')
	position = data.get('position', {})
	
	if not all([document_id, comment_text]):
		return False
	
	# Save comment to database
	from ..models import DocumentComment
	from .. import db
	
	comment = DocumentComment(
		document_id=document_id,
		user_id=current_user.id,
		content=comment_text,
		section_id=position.get('section_id'),
		line_number=position.get('line_number'),
		character_position=position.get('character_position')
	)
	
	db.session.add(comment)
	db.session.commit()
	
	# Broadcast new comment to other users
	from flask_socketio import emit
	room = f"document_{document_id}"
	
	emit('comment_added', {
		'comment_id': comment.id,
		'user_id': current_user.id,
		'username': current_user.username,
		'document_id': document_id,
		'comment': comment_text,
		'position': position,
		'timestamp': str(comment.created_on)
	}, room=room)


@socketio.on('resolve_comment')
def handle_resolve_comment(data):
	"""Handle resolving comments."""
	if not current_user.is_authenticated:
		return False
	
	comment_id = data.get('comment_id')
	
	if not comment_id:
		return False
	
	# Update comment in database
	from ..models import DocumentComment
	from .. import db
	
	comment = DocumentComment.query.get(comment_id)
	if not comment:
		return False
	
	comment.is_resolved = True
	comment.resolved_by_id = current_user.id
	comment.resolved_on = datetime.utcnow()
	
	db.session.commit()
	
	# Broadcast comment resolution
	from flask_socketio import emit
	room = f"document_{comment.document_id}"
	
	emit('comment_resolved', {
		'comment_id': comment_id,
		'resolved_by': current_user.username,
		'document_id': comment.document_id,
		'timestamp': str(comment.resolved_on)
	}, room=room)


def send_notification_to_user(user_id, notification):
	"""
	Send notification to specific user via WebSocket.
	
	Args:
		user_id: ID of the user to notify
		notification: Notification data dictionary
	"""
	room = f"user_{user_id}"
	socketio.emit('notification', notification, room=room)


def send_notification_to_document_collaborators(document_id, notification):
	"""
	Send notification to all users collaborating on a document.
	
	Args:
		document_id: ID of the document
		notification: Notification data dictionary
	"""
	room = f"document_{document_id}"
	socketio.emit('notification', notification, room=room)


def broadcast_system_notification(notification):
	"""
	Broadcast system-wide notification to all connected users.
	
	Args:
		notification: Notification data dictionary
	"""
	socketio.emit('system_notification', notification, broadcast=True)