"""
Presence management package for real-time collaboration.

This package provides real-time user presence tracking and activity monitoring
for collaborative document editing sessions.
"""

from .presence_manager import PresenceManager, UserPresence, UserSession
from .activity_tracker import ActivityTracker, ActivityEvent, ProductivityMetrics

__all__ = [
	'PresenceManager',
	'UserPresence', 
	'UserSession',
	'ActivityTracker',
	'ActivityEvent',
	'ProductivityMetrics'
]