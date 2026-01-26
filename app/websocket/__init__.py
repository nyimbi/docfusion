"""
WebSocket integration for real-time features in DocuFusion Flask-AppBuilder.
"""

from .socketio_app import socketio, init_socketio
from .events import register_events

__all__ = ['socketio', 'init_socketio', 'register_events']