"""
Agent Message System

Message types, priorities, and communication protocols for inter-agent
communication in the multi-agent proposal system.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field
from ...core.utils import uuid7str

class MessageType(str, Enum):
    """Types of messages exchanged between agents"""

    # Task-related messages
    TASK_REQUEST = "task_request"
    TASK_RESPONSE = "task_response"
    TASK_UPDATE = "task_update"
    TASK_COMPLETION = "task_completion"
    TASK_FAILURE = "task_failure"
    TASK_CANCELLATION = "task_cancellation"

    # Collaboration messages
    COLLABORATION_REQUEST = "collaboration_request"
    COLLABORATION_ACCEPTANCE = "collaboration_acceptance"
    COLLABORATION_REJECTION = "collaboration_rejection"
    COLLABORATION_UPDATE = "collaboration_update"
    COLLABORATION_COMPLETION = "collaboration_completion"

    # Information sharing
    INFORMATION_SHARE = "information_share"
    KNOWLEDGE_UPDATE = "knowledge_update"
    INSIGHT_BROADCAST = "insight_broadcast"
    RESOURCE_SHARE = "resource_share"

    # Coordination messages
    STATUS_REQUEST = "status_request"
    STATUS_REPORT = "status_report"
    HEALTH_CHECK = "health_check"
    AVAILABILITY_QUERY = "availability_query"
    CAPABILITY_QUERY = "capability_query"

    # System messages
    SYSTEM_NOTIFICATION = "system_notification"
    ERROR_REPORT = "error_report"
    WARNING_ALERT = "warning_alert"
    SHUTDOWN_NOTICE = "shutdown_notice"
    STARTUP_ANNOUNCEMENT = "startup_announcement"

    # Workflow messages
    WORKFLOW_START = "workflow_start"
    WORKFLOW_STEP = "workflow_step"
    WORKFLOW_COMPLETE = "workflow_complete"
    WORKFLOW_ERROR = "workflow_error"

    # General communication
    GENERAL_MESSAGE = "general_message"
    BROADCAST = "broadcast"
    DIRECT_MESSAGE = "direct_message"
    URGENT_ALERT = "urgent_alert"

class MessagePriority(str, Enum):
    """Message priority levels"""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    BACKGROUND = "background"

class MessageStatus(str, Enum):
    """Message delivery and processing status"""

    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    PROCESSED = "processed"
    ACKNOWLEDGED = "acknowledged"
    FAILED = "failed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"

class MessageDeliveryMode(str, Enum):
    """Message delivery modes"""

    DIRECT = "direct"  # Point-to-point
    BROADCAST = "broadcast"  # One-to-many
    MULTICAST = "multicast"  # Selective broadcast
    PUBLISH_SUBSCRIBE = "publish_subscribe"  # Topic-based
    QUEUE = "queue"  # Queued delivery
    REQUEST_RESPONSE = "request_response"  # Synchronous request/response

class MessageMetadata(BaseModel):
    """Metadata associated with messages"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    created_at: datetime = Field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3
    delivery_attempts: List[datetime] = Field(default_factory=list)
    routing_path: List[str] = Field(default_factory=list)
    processing_time_ms: Optional[float] = None
    encryption_enabled: bool = False
    compression_enabled: bool = False
    content_type: str = "application/json"
    content_length: int = 0
    checksum: Optional[str] = None
    tags: Dict[str, str] = Field(default_factory=dict)

class MessageHeader(BaseModel):
    """Message header information"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    message_id: str = Field(default_factory=uuid7str)
    conversation_id: Optional[str] = None
    thread_id: Optional[str] = None
    correlation_id: Optional[str] = None
    reply_to: Optional[str] = None

    # Routing information
    sender_id: str
    recipient_id: Optional[str] = None
    recipient_group: Optional[str] = None
    routing_key: Optional[str] = None

    # Message properties
    message_type: MessageType
    priority: MessagePriority = MessagePriority.MEDIUM
    delivery_mode: MessageDeliveryMode = MessageDeliveryMode.DIRECT

    # Timing and delivery
    timestamp: datetime = Field(default_factory=datetime.now)
    ttl_seconds: Optional[int] = None
    delivery_timeout_seconds: int = 30
    response_expected: bool = False
    response_timeout_seconds: Optional[int] = None

class MessagePayload(BaseModel):
    """Message payload containing the actual content"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    content: Any = Field(description="Main message content")
    content_format: str = "json"
    schema_version: str = "1.0"
    attachments: List[Dict[str, Any]] = Field(default_factory=list)
    references: List[str] = Field(
        default_factory=list
    )  # References to other messages/resources
    context: Dict[str, Any] = Field(default_factory=dict)
    parameters: Dict[str, Any] = Field(default_factory=dict)

class AgentMessage(BaseModel):
    """Complete message structure for inter-agent communication"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    header: MessageHeader
    payload: MessagePayload
    metadata: MessageMetadata = Field(default_factory=MessageMetadata)
    status: MessageStatus = MessageStatus.PENDING

    # Processing information
    processed_by: List[str] = Field(default_factory=list)
    processing_errors: List[str] = Field(default_factory=list)
    acknowledgments: Dict[str, datetime] = Field(default_factory=dict)

    def is_expired(self) -> bool:
        """Check if message has expired"""
        if self.metadata.expires_at:
            return datetime.now() > self.metadata.expires_at
        if self.header.ttl_seconds:
            expiry_time = self.header.timestamp + timedelta(
                seconds=self.header.ttl_seconds
            )
            return datetime.now() > expiry_time
        return False

    def should_retry(self) -> bool:
        """Check if message should be retried"""
        return (
            self.status == MessageStatus.FAILED
            and self.metadata.retry_count < self.metadata.max_retries
            and not self.is_expired()
        )

    def add_processing_error(self, error: str, agent_id: str) -> None:
        """Add processing error information"""
        error_entry = f"{agent_id}: {error} at {datetime.now().isoformat()}"
        self.processing_errors.append(error_entry)

    def acknowledge(self, agent_id: str) -> None:
        """Mark message as acknowledged by an agent"""
        self.acknowledgments[agent_id] = datetime.now()
        if agent_id not in self.processed_by:
            self.processed_by.append(agent_id)

    def update_routing_path(self, agent_id: str) -> None:
        """Update the routing path with current agent"""
        self.metadata.routing_path.append(agent_id)

    def get_age_seconds(self) -> float:
        """Get message age in seconds"""
        return (datetime.now() - self.header.timestamp).total_seconds()

class MessageBuilder:
    """Builder class for constructing messages"""

    def __init__(self, sender_id: str):
        self.sender_id = sender_id
        self._header_data = {"sender_id": sender_id}
        self._payload_data = {}
        self._metadata_data = {}

    def to(self, recipient_id: str) -> "MessageBuilder":
        """Set message recipient"""
        self._header_data["recipient_id"] = recipient_id
        return self

    def to_group(self, group_id: str) -> "MessageBuilder":
        """Set message recipient group"""
        self._header_data["recipient_group"] = group_id
        self._header_data["delivery_mode"] = MessageDeliveryMode.MULTICAST
        return self

    def broadcast(self) -> "MessageBuilder":
        """Set message for broadcast delivery"""
        self._header_data["delivery_mode"] = MessageDeliveryMode.BROADCAST
        return self

    def with_type(self, message_type: MessageType) -> "MessageBuilder":
        """Set message type"""
        self._header_data["message_type"] = message_type
        return self

    def with_priority(self, priority: MessagePriority) -> "MessageBuilder":
        """Set message priority"""
        self._header_data["priority"] = priority
        return self

    def with_content(self, content: Any) -> "MessageBuilder":
        """Set message content"""
        self._payload_data["content"] = content
        return self

    def with_context(self, context: Dict[str, Any]) -> "MessageBuilder":
        """Set message context"""
        self._payload_data["context"] = context
        return self

    def with_ttl(self, ttl_seconds: int) -> "MessageBuilder":
        """Set message time-to-live"""
        self._header_data["ttl_seconds"] = ttl_seconds
        return self

    def expecting_response(self, timeout_seconds: int = 30) -> "MessageBuilder":
        """Mark message as expecting a response"""
        self._header_data["response_expected"] = True
        self._header_data["response_timeout_seconds"] = timeout_seconds
        return self

    def in_conversation(self, conversation_id: str) -> "MessageBuilder":
        """Set conversation context"""
        self._header_data["conversation_id"] = conversation_id
        return self

    def replying_to(self, original_message_id: str) -> "MessageBuilder":
        """Mark as reply to another message"""
        self._header_data["reply_to"] = original_message_id
        self._header_data["correlation_id"] = original_message_id
        return self

    def with_attachment(
        self, name: str, data: Any, content_type: str = "application/octet-stream"
    ) -> "MessageBuilder":
        """Add attachment to message"""
        if "attachments" not in self._payload_data:
            self._payload_data["attachments"] = []

        attachment = {
            "name": name,
            "data": data,
            "content_type": content_type,
            "size": len(str(data)) if isinstance(data, (str, bytes)) else 0,
        }
        self._payload_data["attachments"].append(attachment)
        return self

    def with_tag(self, key: str, value: str) -> "MessageBuilder":
        """Add tag to message metadata"""
        if "tags" not in self._metadata_data:
            self._metadata_data["tags"] = {}
        self._metadata_data["tags"][key] = value
        return self

    def urgent(self) -> "MessageBuilder":
        """Mark message as urgent"""
        self._header_data["priority"] = MessagePriority.CRITICAL
        self._header_data["message_type"] = MessageType.URGENT_ALERT
        return self

    def build(self) -> AgentMessage:
        """Build the final message"""
        # Ensure required fields are present
        if "message_type" not in self._header_data:
            self._header_data["message_type"] = MessageType.GENERAL_MESSAGE

        # Create components
        header = MessageHeader(**self._header_data)
        payload = MessagePayload(**self._payload_data)
        metadata = MessageMetadata(**self._metadata_data)

        # Set expiry time if TTL is specified
        if header.ttl_seconds:
            metadata.expires_at = header.timestamp + timedelta(
                seconds=header.ttl_seconds
            )

        return AgentMessage(header=header, payload=payload, metadata=metadata)

# Predefined message templates
class MessageTemplates:
    """Common message templates for standard interactions"""

    @staticmethod
    def task_request(
        sender_id: str,
        recipient_id: str,
        task_data: Any,
        priority: MessagePriority = MessagePriority.MEDIUM,
    ) -> AgentMessage:
        """Create a task request message"""
        return (
            MessageBuilder(sender_id)
            .to(recipient_id)
            .with_type(MessageType.TASK_REQUEST)
            .with_priority(priority)
            .with_content(task_data)
            .expecting_response(300)  # 5 minutes timeout
            .build()
        )

    @staticmethod
    def task_response(
        sender_id: str, recipient_id: str, result: Any, original_message_id: str
    ) -> AgentMessage:
        """Create a task response message"""
        return (
            MessageBuilder(sender_id)
            .to(recipient_id)
            .with_type(MessageType.TASK_RESPONSE)
            .with_content(result)
            .replying_to(original_message_id)
            .build()
        )

    @staticmethod
    def collaboration_request(
        sender_id: str, recipients: List[str], collaboration_data: Any
    ) -> List[AgentMessage]:
        """Create collaboration request messages"""
        messages = []
        conversation_id = uuid7str()

        for recipient in recipients:
            message = (
                MessageBuilder(sender_id)
                .to(recipient)
                .with_type(MessageType.COLLABORATION_REQUEST)
                .with_priority(MessagePriority.HIGH)
                .with_content(collaboration_data)
                .in_conversation(conversation_id)
                .expecting_response(120)
                .build()
            )
            messages.append(message)

        return messages

    @staticmethod
    def status_request(sender_id: str, recipient_id: str) -> AgentMessage:
        """Create a status request message"""
        return (
            MessageBuilder(sender_id)
            .to(recipient_id)
            .with_type(MessageType.STATUS_REQUEST)
            .with_priority(MessagePriority.LOW)
            .with_content({"request_type": "status"})
            .with_ttl(60)  # 1 minute TTL
            .expecting_response(30)
            .build()
        )

    @staticmethod
    def broadcast_announcement(
        sender_id: str,
        announcement: str,
        priority: MessagePriority = MessagePriority.MEDIUM,
    ) -> AgentMessage:
        """Create a broadcast announcement"""
        return (
            MessageBuilder(sender_id)
            .broadcast()
            .with_type(MessageType.BROADCAST)
            .with_priority(priority)
            .with_content({"message": announcement, "type": "announcement"})
            .build()
        )

    @staticmethod
    def error_report(
        sender_id: str, recipient_id: str, error_info: Dict[str, Any]
    ) -> AgentMessage:
        """Create an error report message"""
        return (
            MessageBuilder(sender_id)
            .to(recipient_id)
            .with_type(MessageType.ERROR_REPORT)
            .with_priority(MessagePriority.HIGH)
            .with_content(error_info)
            .with_tag("category", "error")
            .build()
        )

    @staticmethod
    def knowledge_share(
        sender_id: str, knowledge_data: Any, category: str = "general"
    ) -> AgentMessage:
        """Create a knowledge sharing message"""
        return (
            MessageBuilder(sender_id)
            .broadcast()
            .with_type(MessageType.KNOWLEDGE_UPDATE)
            .with_priority(MessagePriority.LOW)
            .with_content(knowledge_data)
            .with_context({"category": category})
            .with_tag("knowledge_type", category)
            .build()
        )

    @staticmethod
    def urgent_alert(
        sender_id: str, alert_message: str, recipients: Optional[List[str]] = None
    ) -> AgentMessage:
        """Create an urgent alert message"""
        builder = (
            MessageBuilder(sender_id)
            .with_type(MessageType.URGENT_ALERT)
            .urgent()
            .with_content({"alert": alert_message, "severity": "urgent"})
            .with_ttl(300)
        )  # 5 minutes TTL

        if recipients:
            # Send to specific recipients (first one as primary, others in context)
            builder.to(recipients[0])
            if len(recipients) > 1:
                builder.with_context({"additional_recipients": recipients[1:]})
        else:
            # Broadcast to all
            builder.broadcast()

        return builder.build()

class MessageValidator:
    """Validator for message integrity and format"""

    @staticmethod
    def validate_message(message: AgentMessage) -> List[str]:
        """Validate message structure and content"""
        errors = []

        # Check required fields
        if not message.header.sender_id:
            errors.append("Sender ID is required")

        if not message.header.message_type:
            errors.append("Message type is required")

        # Check routing information
        if (
            message.header.delivery_mode == MessageDeliveryMode.DIRECT
            and not message.header.recipient_id
        ):
            errors.append("Recipient ID required for direct messages")

        # Check response requirements
        if (
            message.header.response_expected
            and not message.header.response_timeout_seconds
        ):
            errors.append("Response timeout required when response is expected")

        # Check expiry
        if message.is_expired():
            errors.append("Message has expired")

        # Check content
        if message.payload.content is None:
            errors.append("Message content cannot be None")

        return errors

    @staticmethod
    def is_valid_message(message: AgentMessage) -> bool:
        """Check if message is valid"""
        return len(MessageValidator.validate_message(message)) == 0
