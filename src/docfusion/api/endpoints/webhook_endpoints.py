#!/usr/bin/env python3
"""
Webhook System

WebSocket and HTTP webhook endpoints for process notifications, event delivery,
and external system integration with comprehensive security and reliability.
"""

import asyncio
import hashlib
import hmac
import json
import logging
from datetime import timezone, datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query
from fastapi import Path as PathParam
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, HttpUrl, field_validator

from ...security import SecurityManager
from ..middleware.authentication_middleware import get_api_key_user, get_current_user
from ...core.utils import uuid7str

class WebhookEventType(str, Enum):
    """Webhook event types"""

    DOCUMENT_CREATED = "document.created"
    DOCUMENT_UPDATED = "document.updated"
    DOCUMENT_DELETED = "document.deleted"
    DOCUMENT_RENDERED = "document.rendered"
    BATCH_JOB_STARTED = "batch.job.started"
    BATCH_JOB_COMPLETED = "batch.job.completed"
    BATCH_JOB_FAILED = "batch.job.failed"
    USER_JOINED_DOCUMENT = "collaboration.user.joined"
    USER_LEFT_DOCUMENT = "collaboration.user.left"
    DOCUMENT_SHARED = "sharing.document.shared"
    SECURITY_VIOLATION = "security.violation"
    SYSTEM_MAINTENANCE = "system.maintenance"

class WebhookStatus(str, Enum):
    """Webhook delivery status"""

    PENDING = "pending"
    SENDING = "sending"
    DELIVERED = "delivered"
    FAILED = "failed"
    DISABLED = "disabled"

class WebhookCreateRequest(BaseModel):
    """Request model for webhook creation"""

    url: HttpUrl = Field(..., description="Webhook endpoint URL")
    events: List[WebhookEventType] = Field(
        ..., min_items=1, description="Events to subscribe to"
    )
    secret: Optional[str] = Field(
        None, min_length=16, description="Secret for signature verification"
    )
    active: bool = Field(True, description="Whether webhook is active")
    description: Optional[str] = Field(
        None, max_length=500, description="Webhook description"
    )
    headers: Optional[Dict[str, str]] = Field(
        None, description="Custom headers to send"
    )
    timeout: int = Field(30, ge=5, le=300, description="Timeout in seconds")
    retry_count: int = Field(3, ge=0, le=10, description="Number of retries on failure")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Custom metadata")

class WebhookResponse(BaseModel):
    """Response model for webhook operations"""

    webhook_id: str = Field(..., description="Unique webhook identifier")
    url: str = Field(..., description="Webhook endpoint URL")
    events: List[WebhookEventType] = Field(..., description="Subscribed events")
    active: bool = Field(..., description="Whether webhook is active")
    description: Optional[str] = Field(None, description="Webhook description")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    created_by: str = Field(..., description="User who created the webhook")
    last_delivery: Optional[datetime] = Field(
        None, description="Last successful delivery"
    )
    failure_count: int = Field(0, description="Consecutive failure count")
    total_deliveries: int = Field(0, description="Total delivery attempts")
    success_rate: float = Field(1.0, description="Success rate (0.0 to 1.0)")

class WebhookDeliveryResponse(BaseModel):
    """Response model for webhook delivery status"""

    delivery_id: str = Field(..., description="Unique delivery identifier")
    webhook_id: str = Field(..., description="Webhook identifier")
    event_type: WebhookEventType = Field(..., description="Event type")
    status: WebhookStatus = Field(..., description="Delivery status")
    created_at: datetime = Field(..., description="Delivery attempt timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    response_status: Optional[int] = Field(None, description="HTTP response status")
    response_body: Optional[str] = Field(None, description="Response body")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    retry_count: int = Field(0, description="Number of retries attempted")
    duration_ms: Optional[float] = Field(
        None, description="Request duration in milliseconds"
    )

class WebhookEvent(BaseModel):
    """Webhook event data structure"""

    event_id: str = Field(default_factory=uuid7str, description="Unique event ID")
    event_type: WebhookEventType = Field(..., description="Type of event")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="Event timestamp"
    )
    data: Dict[str, Any] = Field(..., description="Event payload data")
    user_id: Optional[str] = Field(None, description="User associated with event")
    resource_id: Optional[str] = Field(
        None, description="Resource ID associated with event"
    )
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

class WebhookManager:
    """Manages webhook registrations and deliveries"""

    def __init__(self, security_manager: SecurityManager):
        self.security = security_manager
        self.logger = logging.getLogger(__name__)

        # In-memory storage (in production, would use database)
        self.webhooks: Dict[str, Dict[str, Any]] = {}
        self.deliveries: Dict[str, Dict[str, Any]] = {}
        self.user_webhooks: Dict[str, Set[str]] = {}  # user_id -> set of webhook_ids

        # Delivery queue
        self.delivery_queue: asyncio.Queue = asyncio.Queue()

        # Active delivery tasks
        self.delivery_tasks: Set[asyncio.Task] = set()

        # Stats
        self.stats = {
            "total_webhooks": 0,
            "total_deliveries": 0,
            "successful_deliveries": 0,
            "failed_deliveries": 0,
            "average_response_time": 0.0,
        }

        # Start delivery worker
        self._start_delivery_worker()

        self.logger.info("Webhook manager initialized")

    def _start_delivery_worker(self):
        """Start background delivery worker"""

        async def delivery_worker():
            while True:
                try:
                    delivery_data = await self.delivery_queue.get()
                    task = asyncio.create_task(
                        self._process_webhook_delivery(delivery_data)
                    )
                    self.delivery_tasks.add(task)
                    task.add_done_callback(self.delivery_tasks.discard)
                except Exception as e:
                    self.logger.error(f"Delivery worker error: {e}")
                    await asyncio.sleep(1)

        asyncio.create_task(delivery_worker())

    async def create_webhook(self, user_id: str, request: WebhookCreateRequest) -> str:
        """Create new webhook"""
        webhook_id = uuid7str()

        webhook = {
            "webhook_id": webhook_id,
            "url": str(request.url),
            "events": request.events,
            "secret": request.secret,
            "active": request.active,
            "description": request.description,
            "headers": request.headers or {},
            "timeout": request.timeout,
            "retry_count": request.retry_count,
            "metadata": request.metadata or {},
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "created_by": user_id,
            "last_delivery": None,
            "failure_count": 0,
            "total_deliveries": 0,
            "successful_deliveries": 0,
        }

        self.webhooks[webhook_id] = webhook

        # Track user webhooks
        if user_id not in self.user_webhooks:
            self.user_webhooks[user_id] = set()
        self.user_webhooks[user_id].add(webhook_id)

        self.stats["total_webhooks"] += 1

        self.logger.info(f"Created webhook {webhook_id} for user {user_id}")
        return webhook_id

    async def update_webhook(
        self, webhook_id: str, user_id: str, updates: Dict[str, Any]
    ) -> bool:
        """Update existing webhook"""
        if webhook_id not in self.webhooks:
            return False

        webhook = self.webhooks[webhook_id]

        # Check ownership
        if webhook["created_by"] != user_id:
            return False

        # Update fields
        allowed_updates = [
            "url",
            "events",
            "secret",
            "active",
            "description",
            "headers",
            "timeout",
            "retry_count",
            "metadata",
        ]
        for field, value in updates.items():
            if field in allowed_updates:
                webhook[field] = value

        webhook["updated_at"] = datetime.now(timezone.utc)

        self.logger.info(f"Updated webhook {webhook_id}")
        return True

    async def delete_webhook(self, webhook_id: str, user_id: str) -> bool:
        """Delete webhook"""
        if webhook_id not in self.webhooks:
            return False

        webhook = self.webhooks[webhook_id]

        # Check ownership
        if webhook["created_by"] != user_id:
            return False

        # Remove from storage
        del self.webhooks[webhook_id]

        # Remove from user tracking
        if user_id in self.user_webhooks:
            self.user_webhooks[user_id].discard(webhook_id)

        self.stats["total_webhooks"] -= 1

        self.logger.info(f"Deleted webhook {webhook_id}")
        return True

    async def get_webhook(
        self, webhook_id: str, user_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get webhook by ID"""
        if webhook_id not in self.webhooks:
            return None

        webhook = self.webhooks[webhook_id]

        # Check ownership
        if webhook["created_by"] != user_id:
            return None

        return webhook.copy()

    async def list_user_webhooks(self, user_id: str) -> List[Dict[str, Any]]:
        """List user's webhooks"""
        if user_id not in self.user_webhooks:
            return []

        webhooks = []
        for webhook_id in self.user_webhooks[user_id]:
            if webhook_id in self.webhooks:
                webhook = self.webhooks[webhook_id].copy()
                # Don't include secret in list
                webhook.pop("secret", None)
                webhooks.append(webhook)

        return webhooks

    async def trigger_webhook_event(self, event: WebhookEvent):
        """Trigger webhook event delivery"""
        # Find webhooks that should receive this event
        target_webhooks = []
        for webhook in self.webhooks.values():
            if not webhook["active"]:
                continue

            if event.event_type in webhook["events"]:
                target_webhooks.append(webhook)

        # Queue deliveries
        for webhook in target_webhooks:
            delivery_data = {
                "delivery_id": uuid7str(),
                "webhook": webhook,
                "event": event,
                "attempt": 1,
                "max_attempts": webhook["retry_count"] + 1,
            }

            await self.delivery_queue.put(delivery_data)

        self.logger.debug(
            f"Queued event {event.event_id} for {len(target_webhooks)} webhooks"
        )

    async def _process_webhook_delivery(self, delivery_data: Dict[str, Any]):
        """Process single webhook delivery"""
        delivery_id = delivery_data["delivery_id"]
        webhook = delivery_data["webhook"]
        event = delivery_data["event"]
        attempt = delivery_data["attempt"]
        max_attempts = delivery_data["max_attempts"]

        try:
            # Create delivery record
            delivery = {
                "delivery_id": delivery_id,
                "webhook_id": webhook["webhook_id"],
                "event_type": event.event_type,
                "status": WebhookStatus.SENDING,
                "created_at": datetime.now(timezone.utc),
                "completed_at": None,
                "response_status": None,
                "response_body": None,
                "error_message": None,
                "retry_count": attempt - 1,
                "duration_ms": None,
            }

            self.deliveries[delivery_id] = delivery

            # Prepare payload
            payload = {
                "event_id": event.event_id,
                "event_type": event.event_type,
                "timestamp": event.timestamp.isoformat(),
                "data": event.data,
                "user_id": event.user_id,
                "resource_id": event.resource_id,
                "metadata": event.metadata or {},
            }

            # Prepare headers
            headers = webhook["headers"].copy()
            headers["Content-Type"] = "application/json"
            headers["User-Agent"] = "DocuFusion-Webhook/1.0"
            headers["X-Event-Type"] = event.event_type
            headers["X-Event-ID"] = event.event_id
            headers["X-Delivery-ID"] = delivery_id

            # Add signature if secret is provided
            if webhook["secret"]:
                payload_str = json.dumps(payload, sort_keys=True)
                signature = hmac.new(
                    webhook["secret"].encode(), payload_str.encode(), hashlib.sha256
                ).hexdigest()
                headers["X-Signature-SHA256"] = f"sha256={signature}"

            # Make HTTP request
            start_time = datetime.now(timezone.utc)

            try:
                import httpx

                async with httpx.AsyncClient(timeout=webhook["timeout"]) as client:
                    response = await client.post(
                        webhook["url"], json=payload, headers=headers
                    )

                    end_time = datetime.now(timezone.utc)
                    duration_ms = (end_time - start_time).total_seconds() * 1000

                    # Update delivery record
                    delivery["completed_at"] = end_time
                    delivery["response_status"] = response.status_code
                    delivery["response_body"] = response.text[
                        :1000
                    ]  # Limit response size
                    delivery["duration_ms"] = duration_ms

                    # Check if successful
                    if 200 <= response.status_code < 300:
                        delivery["status"] = WebhookStatus.DELIVERED

                        # Update webhook stats
                        webhook["total_deliveries"] += 1
                        webhook["successful_deliveries"] += 1
                        webhook["last_delivery"] = end_time
                        webhook["failure_count"] = 0

                        # Update global stats
                        self.stats["total_deliveries"] += 1
                        self.stats["successful_deliveries"] += 1
                        self._update_average_response_time(duration_ms)

                        self.logger.debug(f"Webhook delivery {delivery_id} successful")
                    else:
                        raise httpx.HTTPStatusError(
                            f"HTTP {response.status_code}",
                            request=response.request,
                            response=response,
                        )

            except Exception as e:
                end_time = datetime.now(timezone.utc)
                duration_ms = (end_time - start_time).total_seconds() * 1000

                delivery["completed_at"] = end_time
                delivery["duration_ms"] = duration_ms
                delivery["error_message"] = str(e)

                # Check if we should retry
                if attempt < max_attempts:
                    # Schedule retry with exponential backoff
                    retry_delay = min(60 * (2 ** (attempt - 1)), 300)  # Max 5 minutes

                    delivery["status"] = WebhookStatus.FAILED
                    self.logger.warning(
                        f"Webhook delivery {delivery_id} failed (attempt {attempt}/{max_attempts}), retrying in {retry_delay}s: {e}"
                    )

                    # Schedule retry
                    asyncio.create_task(
                        self._schedule_retry(delivery_data, retry_delay)
                    )
                else:
                    # Final failure
                    delivery["status"] = WebhookStatus.FAILED

                    # Update webhook stats
                    webhook["total_deliveries"] += 1
                    webhook["failure_count"] += 1

                    # Disable webhook if too many failures
                    if webhook["failure_count"] >= 10:
                        webhook["active"] = False
                        self.logger.warning(
                            f"Disabled webhook {webhook['webhook_id']} due to excessive failures"
                        )

                    # Update global stats
                    self.stats["total_deliveries"] += 1
                    self.stats["failed_deliveries"] += 1

                    self.logger.error(
                        f"Webhook delivery {delivery_id} permanently failed after {max_attempts} attempts: {e}"
                    )

        except Exception as e:
            self.logger.error(
                f"Webhook delivery processing error for {delivery_id}: {e}"
            )
            if delivery_id in self.deliveries:
                self.deliveries[delivery_id]["status"] = WebhookStatus.FAILED
                self.deliveries[delivery_id]["error_message"] = (
                    f"Processing error: {str(e)}"
                )

    async def _schedule_retry(self, delivery_data: Dict[str, Any], delay: int):
        """Schedule webhook delivery retry"""
        await asyncio.sleep(delay)

        # Increment attempt counter
        delivery_data["attempt"] += 1

        # Re-queue delivery
        await self.delivery_queue.put(delivery_data)

    def _update_average_response_time(self, duration_ms: float):
        """Update average response time"""
        current_avg = self.stats["average_response_time"]
        total_successful = self.stats["successful_deliveries"]

        if total_successful == 1:
            self.stats["average_response_time"] = duration_ms
        else:
            # Moving average
            self.stats["average_response_time"] = (
                (current_avg * (total_successful - 1)) + duration_ms
            ) / total_successful

    async def get_delivery_status(self, delivery_id: str) -> Optional[Dict[str, Any]]:
        """Get delivery status by ID"""
        return self.deliveries.get(delivery_id)

    async def get_webhook_deliveries(
        self, webhook_id: str, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get recent deliveries for a webhook"""
        deliveries = []
        for delivery in self.deliveries.values():
            if delivery["webhook_id"] == webhook_id:
                deliveries.append(delivery)

        # Sort by creation time (newest first) and limit
        deliveries.sort(key=lambda x: x["created_at"], reverse=True)
        return deliveries[:limit]

    def get_stats(self) -> Dict[str, Any]:
        """Get webhook system statistics"""
        return self.stats.copy()

class WebhookEndpoints:
    """Webhook management endpoints"""

    def __init__(self, security_manager: SecurityManager):
        self.security = security_manager
        self.webhook_manager = WebhookManager(security_manager)
        self.logger = logging.getLogger(__name__)

        # Create FastAPI router
        self.router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])

        # Register endpoints
        self._register_endpoints()

        self.logger.info("Webhook endpoints initialized")

    def _register_endpoints(self):
        """Register webhook endpoints"""

        @self.router.post("/", response_model=WebhookResponse, status_code=201)
        async def create_webhook(
            request: WebhookCreateRequest,
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Create new webhook"""
            return await self.create_webhook_handler(request, current_user)

        @self.router.get("/{webhook_id}", response_model=WebhookResponse)
        async def get_webhook(
            webhook_id: str = PathParam(..., description="Webhook ID"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Get webhook by ID"""
            return await self.get_webhook_handler(webhook_id, current_user)

        @self.router.put("/{webhook_id}", response_model=WebhookResponse)
        async def update_webhook(
            webhook_id: str = PathParam(..., description="Webhook ID"),
            updates: Dict[str, Any] = ...,
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Update webhook"""
            return await self.update_webhook_handler(webhook_id, updates, current_user)

        @self.router.delete("/{webhook_id}", status_code=204)
        async def delete_webhook(
            webhook_id: str = PathParam(..., description="Webhook ID"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Delete webhook"""
            await self.delete_webhook_handler(webhook_id, current_user)

        @self.router.get("/", response_model=List[WebhookResponse])
        async def list_webhooks(
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """List user's webhooks"""
            return await self.list_webhooks_handler(current_user)

        @self.router.get(
            "/{webhook_id}/deliveries", response_model=List[WebhookDeliveryResponse]
        )
        async def get_webhook_deliveries(
            webhook_id: str = PathParam(..., description="Webhook ID"),
            limit: int = Query(50, ge=1, le=100, description="Maximum results"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Get webhook delivery history"""
            return await self.get_webhook_deliveries_handler(
                webhook_id, limit, current_user
            )

        @self.router.post("/test", response_model=Dict[str, Any])
        async def test_webhook(
            webhook_id: str = Query(..., description="Webhook ID to test"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Test webhook endpoint"""
            return await self.test_webhook_handler(webhook_id, current_user)

        @self.router.get("/stats/system", response_model=Dict[str, Any])
        async def get_webhook_stats(
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Get webhook system statistics"""
            return await self.get_webhook_stats_handler(current_user)

        @self.router.post("/events/trigger", response_model=Dict[str, Any])
        async def trigger_event(
            event_type: WebhookEventType = Query(
                ..., description="Event type to trigger"
            ),
            data: Dict[str, Any] = None,
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Manually trigger webhook event (testing)"""
            if data is None:
                data = {}
            return await self.trigger_event_handler(event_type, data, current_user)

    # ==================== HANDLER METHODS ====================

    async def create_webhook_handler(
        self, request: WebhookCreateRequest, current_user: Dict[str, Any]
    ) -> WebhookResponse:
        """Handle webhook creation"""
        try:
            user_id = current_user["user_id"]

            # Check permissions
            auth_result = await self.security.check_permission(
                user_id, "webhook", "create"
            )

            if not auth_result.has_permission:
                raise HTTPException(status_code=403, detail="Permission denied")

            # Create webhook
            webhook_id = await self.webhook_manager.create_webhook(user_id, request)

            # Get created webhook
            webhook = await self.webhook_manager.get_webhook(webhook_id, user_id)
            if not webhook:
                raise HTTPException(
                    status_code=500, detail="Failed to retrieve created webhook"
                )

            # Calculate success rate
            success_rate = 1.0
            if webhook["total_deliveries"] > 0:
                success_rate = (
                    webhook["successful_deliveries"] / webhook["total_deliveries"]
                )

            return WebhookResponse(
                webhook_id=webhook["webhook_id"],
                url=webhook["url"],
                events=webhook["events"],
                active=webhook["active"],
                description=webhook["description"],
                created_at=webhook["created_at"],
                updated_at=webhook["updated_at"],
                created_by=webhook["created_by"],
                last_delivery=webhook["last_delivery"],
                failure_count=webhook["failure_count"],
                total_deliveries=webhook["total_deliveries"],
                success_rate=success_rate,
            )

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Webhook creation failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def get_webhook_handler(
        self, webhook_id: str, current_user: Dict[str, Any]
    ) -> WebhookResponse:
        """Handle webhook retrieval"""
        try:
            user_id = current_user["user_id"]

            webhook = await self.webhook_manager.get_webhook(webhook_id, user_id)
            if not webhook:
                raise HTTPException(status_code=404, detail="Webhook not found")

            # Calculate success rate
            success_rate = 1.0
            if webhook["total_deliveries"] > 0:
                success_rate = (
                    webhook["successful_deliveries"] / webhook["total_deliveries"]
                )

            return WebhookResponse(
                webhook_id=webhook["webhook_id"],
                url=webhook["url"],
                events=webhook["events"],
                active=webhook["active"],
                description=webhook["description"],
                created_at=webhook["created_at"],
                updated_at=webhook["updated_at"],
                created_by=webhook["created_by"],
                last_delivery=webhook["last_delivery"],
                failure_count=webhook["failure_count"],
                total_deliveries=webhook["total_deliveries"],
                success_rate=success_rate,
            )

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Webhook retrieval failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def update_webhook_handler(
        self, webhook_id: str, updates: Dict[str, Any], current_user: Dict[str, Any]
    ) -> WebhookResponse:
        """Handle webhook update"""
        try:
            user_id = current_user["user_id"]

            success = await self.webhook_manager.update_webhook(
                webhook_id, user_id, updates
            )
            if not success:
                raise HTTPException(status_code=404, detail="Webhook not found")

            # Return updated webhook
            return await self.get_webhook_handler(webhook_id, current_user)

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Webhook update failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def delete_webhook_handler(
        self, webhook_id: str, current_user: Dict[str, Any]
    ):
        """Handle webhook deletion"""
        try:
            user_id = current_user["user_id"]

            success = await self.webhook_manager.delete_webhook(webhook_id, user_id)
            if not success:
                raise HTTPException(status_code=404, detail="Webhook not found")

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Webhook deletion failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def list_webhooks_handler(
        self, current_user: Dict[str, Any]
    ) -> List[WebhookResponse]:
        """Handle webhook listing"""
        try:
            user_id = current_user["user_id"]

            webhooks = await self.webhook_manager.list_user_webhooks(user_id)

            responses = []
            for webhook in webhooks:
                success_rate = 1.0
                if webhook["total_deliveries"] > 0:
                    success_rate = (
                        webhook["successful_deliveries"] / webhook["total_deliveries"]
                    )

                responses.append(
                    WebhookResponse(
                        webhook_id=webhook["webhook_id"],
                        url=webhook["url"],
                        events=webhook["events"],
                        active=webhook["active"],
                        description=webhook["description"],
                        created_at=webhook["created_at"],
                        updated_at=webhook["updated_at"],
                        created_by=webhook["created_by"],
                        last_delivery=webhook["last_delivery"],
                        failure_count=webhook["failure_count"],
                        total_deliveries=webhook["total_deliveries"],
                        success_rate=success_rate,
                    )
                )

            return responses

        except Exception as e:
            self.logger.error(f"Webhook listing failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def get_webhook_deliveries_handler(
        self, webhook_id: str, limit: int, current_user: Dict[str, Any]
    ) -> List[WebhookDeliveryResponse]:
        """Handle webhook delivery history retrieval"""
        try:
            user_id = current_user["user_id"]

            # Verify webhook ownership
            webhook = await self.webhook_manager.get_webhook(webhook_id, user_id)
            if not webhook:
                raise HTTPException(status_code=404, detail="Webhook not found")

            deliveries = await self.webhook_manager.get_webhook_deliveries(
                webhook_id, limit
            )

            responses = []
            for delivery in deliveries:
                responses.append(
                    WebhookDeliveryResponse(
                        delivery_id=delivery["delivery_id"],
                        webhook_id=delivery["webhook_id"],
                        event_type=delivery["event_type"],
                        status=delivery["status"],
                        created_at=delivery["created_at"],
                        completed_at=delivery["completed_at"],
                        response_status=delivery["response_status"],
                        response_body=delivery["response_body"],
                        error_message=delivery["error_message"],
                        retry_count=delivery["retry_count"],
                        duration_ms=delivery["duration_ms"],
                    )
                )

            return responses

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Webhook delivery history retrieval failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def test_webhook_handler(
        self, webhook_id: str, current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle webhook testing"""
        try:
            user_id = current_user["user_id"]

            # Verify webhook ownership
            webhook = await self.webhook_manager.get_webhook(webhook_id, user_id)
            if not webhook:
                raise HTTPException(status_code=404, detail="Webhook not found")

            # Create test event
            test_event = WebhookEvent(
                event_type=WebhookEventType.SYSTEM_MAINTENANCE,
                data={
                    "test": True,
                    "message": "This is a test webhook delivery",
                    "webhook_id": webhook_id,
                },
                user_id=user_id,
                metadata={"test_delivery": True},
            )

            # Trigger test delivery
            await self.webhook_manager.trigger_webhook_event(test_event)

            return {
                "success": True,
                "message": "Test webhook delivery queued",
                "event_id": test_event.event_id,
                "webhook_id": webhook_id,
            }

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Webhook testing failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def get_webhook_stats_handler(
        self, current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle webhook statistics retrieval"""
        try:
            user_id = current_user["user_id"]

            # Check if user can view system stats
            auth_result = await self.security.check_permission(
                user_id, "system", "read"
            )

            stats = self.webhook_manager.get_stats()

            if auth_result.has_permission:
                # Return full system stats
                return {
                    "system_stats": stats,
                    "user_webhook_count": len(
                        await self.webhook_manager.list_user_webhooks(user_id)
                    ),
                    "permissions": "full",
                }
            else:
                # Return limited user stats
                user_webhooks = await self.webhook_manager.list_user_webhooks(user_id)
                user_stats = {
                    "user_webhook_count": len(user_webhooks),
                    "user_total_deliveries": sum(
                        w["total_deliveries"] for w in user_webhooks
                    ),
                    "user_successful_deliveries": sum(
                        w["successful_deliveries"] for w in user_webhooks
                    ),
                    "permissions": "limited",
                }
                return user_stats

        except Exception as e:
            self.logger.error(f"Webhook stats retrieval failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def trigger_event_handler(
        self,
        event_type: WebhookEventType,
        data: Dict[str, Any],
        current_user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Handle manual event triggering (for testing)"""
        try:
            user_id = current_user["user_id"]

            # Check permissions (admin only for manual triggers)
            auth_result = await self.security.check_permission(
                user_id, "system", "manage"
            )

            if not auth_result.has_permission:
                raise HTTPException(
                    status_code=403, detail="Permission denied - admin required"
                )

            # Create and trigger event
            event = WebhookEvent(
                event_type=event_type,
                data=data,
                user_id=user_id,
                metadata={"manual_trigger": True, "triggered_by": user_id},
            )

            await self.webhook_manager.trigger_webhook_event(event)

            return {
                "success": True,
                "message": f"Event {event_type} triggered manually",
                "event_id": event.event_id,
            }

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Manual event trigger failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    # ==================== PUBLIC METHODS ====================

    async def send_webhook_event(
        self,
        event_type: WebhookEventType,
        data: Dict[str, Any],
        user_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Send webhook event (called by other services)"""
        event = WebhookEvent(
            event_type=event_type,
            data=data,
            user_id=user_id,
            resource_id=resource_id,
            metadata=metadata,
        )

        await self.webhook_manager.trigger_webhook_event(event)

        self.logger.debug(f"Webhook event {event_type} sent for resource {resource_id}")

# Factory function
def create_webhook_endpoints(security_manager: SecurityManager) -> WebhookEndpoints:
    """Create WebhookEndpoints instance with security manager"""
    return WebhookEndpoints(security_manager)
