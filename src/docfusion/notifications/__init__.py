"""
DocuFusion Notifications System - Week 20 Complete Implementation

Comprehensive notification and communication system providing:
- Multi-channel delivery (Email, SMS, WhatsApp, Telegram, Slack, Push, In-App, Webhooks)
- Intelligent prioritization with ML-based importance scoring
- Advanced analytics and A/B testing capabilities
- Complete workflow integration
- Real-time delivery tracking and optimization
"""

__version__ = "1.0.0"
__author__ = "DocuFusion Team"

# Core notification system
from .delivery import (
    NotificationDelivery,
    NotificationMessage, 
    DeliveryResult,
    ChannelType,
    Priority,
    create_notification_delivery
)

from .prioritization import (
    PriorityManager,
    NotificationMetadata,
    PriorityScore,
    PriorityLevel,
    ImportanceContext,
    create_priority_manager
)

from .analytics import (
    NotificationAnalytics,
    NotificationEvent,
    AnalyticsEvent,
    AnalyticsMetrics,
    create_notification_analytics
)

from .channels import *

from .workflow_notification_integration import (
    WorkflowNotificationIntegration,
    WorkflowEventType,
    NotificationTemplate,
    create_workflow_notification_integration
)

__all__ = [
    # Core delivery
    'NotificationDelivery',
    'NotificationMessage',
    'DeliveryResult', 
    'ChannelType',
    'Priority',
    'create_notification_delivery',
    
    # Prioritization
    'PriorityManager',
    'NotificationMetadata',
    'PriorityScore',
    'PriorityLevel',
    'ImportanceContext', 
    'create_priority_manager',
    
    # Analytics
    'NotificationAnalytics',
    'NotificationEvent',
    'AnalyticsEvent',
    'AnalyticsMetrics',
    'create_notification_analytics',
    
    # Workflow integration
    'WorkflowNotificationIntegration',
    'WorkflowEventType',
    'NotificationTemplate',
    'create_workflow_notification_integration'
]