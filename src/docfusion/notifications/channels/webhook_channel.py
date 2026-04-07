"""
WebhookChannel - Week 20 Generic Webhook Notification Channel

Implements HTTP webhook notifications with support for custom payloads,
authentication methods, retry logic, and response validation.
"""

import asyncio
import logging
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Union
import json
import hashlib
import hmac

from pydantic import BaseModel, Field, ConfigDict, validator

from ..delivery.notification_delivery import (
	NotificationChannel, NotificationMessage, DeliveryResult,
	DeliveryStatus, ChannelType, Priority
)
from ...config.secrets import SecretsManager


class WebhookAuthType(str, Enum):
	"""Webhook authentication methods."""
	NONE = "none"
	BASIC = "basic"
	BEARER = "bearer"
	API_KEY = "api_key"
	HMAC_SHA256 = "hmac_sha256"
	CUSTOM_HEADER = "custom_header"


class WebhookMethod(str, Enum):
	"""HTTP methods for webhook requests."""
	POST = "POST"
	PUT = "PUT"
	PATCH = "PATCH"


class WebhookConfiguration(BaseModel):
	"""Webhook channel configuration."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	# Webhook URL
	webhook_url: str = Field(..., description="Webhook endpoint URL")
	
	# Authentication
	auth_type: WebhookAuthType = Field(WebhookAuthType.NONE, description="Authentication method")
	username: Optional[str] = Field(None, description="Basic auth username")
	password: Optional[str] = Field(None, description="Basic auth password")
	bearer_token: Optional[str] = Field(None, description="Bearer token")
	api_key: Optional[str] = Field(None, description="API key")
	api_key_header: str = Field("X-API-Key", description="API key header name")
	hmac_secret: Optional[str] = Field(None, description="HMAC secret key")
	hmac_header: str = Field("X-Signature", description="HMAC signature header name")
	custom_headers: Dict[str, str] = Field(default_factory=dict, description="Custom headers")
	
	# Request Configuration
	http_method: WebhookMethod = Field(WebhookMethod.POST, description="HTTP method")
	content_type: str = Field("application/json", description="Content-Type header")
	timeout_seconds: int = Field(30, description="Request timeout")
	
	# Payload Configuration
	payload_template: Optional[str] = Field(None, description="Custom payload template")
	include_metadata: bool = Field(True, description="Include message metadata")
	flatten_payload: bool = Field(False, description="Flatten nested payload structure")
	
	# Response Validation
	expected_status_codes: List[int] = Field(default_factory=lambda: [200, 201, 202, 204], description="Expected HTTP status codes")
	validate_response_body: bool = Field(False, description="Validate response body")
	expected_response_pattern: Optional[str] = Field(None, description="Expected response regex pattern")
	
	# Retry Configuration
	max_retries: int = Field(3, description="Maximum retry attempts")
	retry_delay_seconds: int = Field(5, description="Delay between retries")
	retry_exponential_backoff: bool = Field(True, description="Use exponential backoff")
	
	@validator('webhook_url')
	def validate_webhook_url(cls, v):
		"""Validate webhook URL format."""
		if not v.startswith(('http://', 'https://')):
			raise ValueError("Webhook URL must start with http:// or https://")
		return v


class WebhookChannel(NotificationChannel):
	"""
	Generic webhook notification channel.
	
	Provides comprehensive webhook delivery including:
	- Multiple authentication methods (Basic, Bearer, API Key, HMAC, Custom)
	- Flexible payload templating and customization
	- Response validation and error handling
	- Retry logic with exponential backoff
	- Request/response logging and metrics
	- Support for different HTTP methods
	"""
	
	def __init__(self, config: WebhookConfiguration):
		self.config = config
		
		# Metrics
		self._delivery_stats = {
			'total_sent': 0,
			'total_delivered': 0,
			'total_failed': 0,
			'total_retries': 0,
			'response_codes': {},
			'average_response_time': 0.0
		}
		
		self.logger = logging.getLogger(__name__)
		self.logger.info("WebhookChannel initialized for URL: %s", config.webhook_url)
	
	async def send(self, message: NotificationMessage) -> DeliveryResult:
		"""Send webhook notification."""
		start_time = datetime.now()
		
		try:
			# Validate webhook-specific data
			webhook_data = await self._validate_webhook_data(message)
			
			# Prepare webhook payload
			payload = await self._prepare_webhook_payload(message, webhook_data)
			
			# Prepare request headers
			headers = await self._prepare_request_headers(payload)
			
			# Send webhook with retry logic
			response_data = await self._send_webhook_with_retry(payload, headers, message)
			
			delivery_time = (datetime.now() - start_time).total_seconds() * 1000
			
			result = DeliveryResult(
				message_id=message.id,
				status=DeliveryStatus.DELIVERED if response_data['success'] else DeliveryStatus.FAILED,
				channel=ChannelType.WEBHOOK,  # Assuming WEBHOOK enum exists
				success=response_data['success'],
				error_message=response_data.get('error_message'),
				error_code=response_data.get('error_code'),
				delivery_time_ms=int(delivery_time),
				tracking_id=response_data.get('tracking_id'),
				provider_response=response_data.get('provider_response', {})
			)
			
			await self._update_stats(result, response_data.get('response_time', 0))
			return result
			
		except Exception as e:
			delivery_time = (datetime.now() - start_time).total_seconds() * 1000
			
			return DeliveryResult(
				message_id=message.id,
				status=DeliveryStatus.FAILED,
				channel=ChannelType.WEBHOOK,
				success=False,
				error_message=str(e),
				error_code="WEBHOOK_DELIVERY_EXCEPTION",
				delivery_time_ms=int(delivery_time)
			)
	
	async def validate_recipient(self, recipient_id: str) -> bool:
		"""Validate webhook recipient (URL validation)."""
		try:
			# For webhooks, recipient_id could be a URL or identifier
			# Basic validation - could be enhanced with actual HTTP checks
			return True
			
		except Exception:
			return False
	
	def get_channel_type(self) -> ChannelType:
		"""Get channel type identifier."""
		return getattr(ChannelType, 'WEBHOOK', ChannelType.IN_APP)
	
	def supports_priority(self, priority: Priority) -> bool:
		"""Check if channel supports given priority level."""
		return True
	
	async def test_webhook(self) -> Dict[str, Any]:
		"""Test webhook endpoint connectivity."""
		try:
			test_payload = {
				'test': True,
				'timestamp': datetime.now().isoformat(),
				'message': 'DocuFusion webhook test'
			}
			
			headers = await self._prepare_request_headers(test_payload)
			response = await self._make_webhook_request(test_payload, headers)
			
			return {
				'success': response['success'],
				'status_code': response.get('status_code'),
				'response_time_ms': response.get('response_time', 0),
				'error_message': response.get('error_message')
			}
			
		except Exception as e:
			return {
				'success': False,
				'error_message': str(e)
			}
	
	def get_delivery_statistics(self) -> Dict[str, Any]:
		"""Get webhook delivery statistics."""
		stats = self._delivery_stats.copy()
		
		# Calculate rates
		if stats['total_sent'] > 0:
			stats['delivery_rate'] = stats['total_delivered'] / stats['total_sent']
			stats['failure_rate'] = stats['total_failed'] / stats['total_sent']
			stats['retry_rate'] = stats['total_retries'] / stats['total_sent']
		else:
			stats.update({
				'delivery_rate': 0.0,
				'failure_rate': 0.0,
				'retry_rate': 0.0
			})
		
		return stats
	
	async def _validate_webhook_data(self, message: NotificationMessage) -> Dict[str, Any]:
		"""Validate webhook-specific data."""
		channel_data = message.channel_data
		
		return {
			'custom_payload': channel_data.get('custom_payload'),
			'custom_headers': channel_data.get('custom_headers', {}),
			'override_url': channel_data.get('override_url'),
			'template_variables': channel_data.get('template_variables', {}),
			'include_attachments': channel_data.get('include_attachments', True),
			'correlation_id': channel_data.get('correlation_id')
		}
	
	async def _prepare_webhook_payload(self, message: NotificationMessage, webhook_data: Dict[str, Any]) -> Dict[str, Any]:
		"""Prepare webhook request payload."""
		# Use custom payload if provided
		if webhook_data.get('custom_payload'):
			payload = webhook_data['custom_payload']
			
			# Apply template variables if it's a string template
			if isinstance(payload, str) and webhook_data['template_variables']:
				for key, value in webhook_data['template_variables'].items():
					placeholder = f'{{{{{key}}}}}'
					payload = payload.replace(placeholder, str(value))
				
				# Parse as JSON if it's a JSON string
				try:
					payload = json.loads(payload)
				except json.JSONDecodeError:
					pass  # Keep as string
			
			return payload
		
		# Use template if configured
		if self.config.payload_template:
			template_vars = {
				'id': message.id,
				'title': message.title,
				'content': message.content,
				'recipient_id': message.recipient_id,
				'priority': message.priority.value,
				'timestamp': datetime.now().isoformat(),
				'workflow_id': message.workflow_id,
				'tags': message.tags,
				**webhook_data['template_variables']
			}
			
			payload_str = self.config.payload_template
			for key, value in template_vars.items():
				placeholder = f'{{{{{key}}}}}'
				payload_str = payload_str.replace(placeholder, str(value))
			
			try:
				return json.loads(payload_str)
			except json.JSONDecodeError:
				return {'payload': payload_str}
		
		# Default payload structure
		base_payload = {
			'id': message.id,
			'title': message.title,
			'content': message.content,
			'recipient_id': message.recipient_id,
			'priority': message.priority.value,
			'channel': 'webhook',
			'timestamp': datetime.now().isoformat()
		}
		
		# Add metadata if enabled
		if self.config.include_metadata:
			base_payload['metadata'] = {
				'workflow_id': message.workflow_id,
				'event_type': message.event_type,
				'tags': message.tags,
				'created_at': message.created_at.isoformat(),
				'expires_at': message.expires_at.isoformat() if message.expires_at else None,
				'retry_count': message.retry_count,
				'channel_data': message.channel_data
			}
		
		# Add correlation ID if provided
		if webhook_data.get('correlation_id'):
			base_payload['correlation_id'] = webhook_data['correlation_id']
		
		# Flatten payload if configured
		if self.config.flatten_payload:
			flattened = {}
			self._flatten_dict(base_payload, flattened)
			return flattened
		
		return base_payload
	
	async def _prepare_request_headers(self, payload: Any) -> Dict[str, str]:
		"""Prepare HTTP request headers."""
		headers = {
			'Content-Type': self.config.content_type,
			'User-Agent': 'DocuFusion-Webhook/1.0'
		}
		
		# Add custom headers
		headers.update(self.config.custom_headers)
		
		# Add authentication headers
		if self.config.auth_type == WebhookAuthType.BEARER and self.config.bearer_token:
			headers['Authorization'] = f'Bearer {self.config.bearer_token}'
		
		elif self.config.auth_type == WebhookAuthType.API_KEY and self.config.api_key:
			headers[self.config.api_key_header] = self.config.api_key
		
		elif self.config.auth_type == WebhookAuthType.HMAC_SHA256 and self.config.hmac_secret:
			# Generate HMAC signature
			payload_str = json.dumps(payload, sort_keys=True) if isinstance(payload, dict) else str(payload)
			signature = hmac.new(
				self.config.hmac_secret.encode(),
				payload_str.encode(),
				hashlib.sha256
			).hexdigest()
			headers[self.config.hmac_header] = f'sha256={signature}'
		
		return headers
	
	async def _send_webhook_with_retry(self, payload: Any, headers: Dict[str, str], message: NotificationMessage) -> Dict[str, Any]:
		"""Send webhook with retry logic."""
		last_error = None
		retry_count = 0
		
		for attempt in range(self.config.max_retries + 1):
			try:
				response = await self._make_webhook_request(payload, headers)
				
				if response['success']:
					# Update retry stats
					if retry_count > 0:
						self._delivery_stats['total_retries'] += retry_count
					
					return response
				
				# If not successful and not the last attempt, prepare for retry
				if attempt < self.config.max_retries:
					retry_count += 1
					delay = self._calculate_retry_delay(attempt)
					
					self.logger.warning(
						"Webhook delivery failed (attempt %d/%d), retrying in %ds: %s",
						attempt + 1,
						self.config.max_retries + 1,
						delay,
						response.get('error_message', 'Unknown error')
					)
					
					await asyncio.sleep(delay)
					last_error = response
				else:
					# Final attempt failed
					self._delivery_stats['total_retries'] += retry_count
					return response
				
			except Exception as e:
				if attempt < self.config.max_retries:
					retry_count += 1
					delay = self._calculate_retry_delay(attempt)
					
					self.logger.warning(
						"Webhook request exception (attempt %d/%d), retrying in %ds: %s",
						attempt + 1,
						self.config.max_retries + 1,
						delay,
						str(e)
					)
					
					await asyncio.sleep(delay)
					last_error = {'success': False, 'error_message': str(e), 'error_code': 'WEBHOOK_REQUEST_EXCEPTION'}
				else:
					self._delivery_stats['total_retries'] += retry_count
					return {
						'success': False,
						'error_message': str(e),
						'error_code': 'WEBHOOK_REQUEST_EXCEPTION'
					}
		
		# Should never reach here, but return last error as fallback
		return last_error or {'success': False, 'error_message': 'Max retries exceeded'}
	
	async def _make_webhook_request(self, payload: Any, headers: Dict[str, str]) -> Dict[str, Any]:
		"""Make HTTP request to webhook endpoint."""
		# This would make actual HTTP request using aiohttp or similar
		# Placeholder implementation
		
		start_time = datetime.now()
		
		self.logger.info("Making webhook request to: %s", self.config.webhook_url)
		self.logger.debug("Headers: %s", headers)
		self.logger.debug("Payload: %s", json.dumps(payload, indent=2) if isinstance(payload, dict) else str(payload))
		
		# Simulate HTTP request
		try:
			# Simulate different response scenarios
			import random
			
			# 90% success rate for simulation
			if random.random() < 0.9:
				status_code = random.choice([200, 201, 202])
				response_body = {'status': 'success', 'message_id': f'wh_{datetime.now().timestamp()}'}
				success = status_code in self.config.expected_status_codes
			else:
				status_code = random.choice([400, 404, 500, 502, 503])
				response_body = {'error': 'Simulated error', 'code': status_code}
				success = False
			
			response_time = (datetime.now() - start_time).total_seconds() * 1000
			
			# Validate response if configured
			if success and self.config.validate_response_body and self.config.expected_response_pattern:
				import re
				response_str = json.dumps(response_body)
				if not re.search(self.config.expected_response_pattern, response_str):
					success = False
					return {
						'success': False,
						'error_message': 'Response body validation failed',
						'error_code': 'WEBHOOK_RESPONSE_VALIDATION_FAILED',
						'status_code': status_code,
						'response_body': response_body,
						'response_time': response_time
					}
			
			return {
				'success': success,
				'status_code': status_code,
				'response_body': response_body,
				'response_time': response_time,
				'tracking_id': response_body.get('message_id') if success else None,
				'provider_response': {
					'status_code': status_code,
					'headers': {'content-type': 'application/json'},
					'body': response_body
				},
				'error_message': response_body.get('error') if not success else None,
				'error_code': f'HTTP_{status_code}' if not success else None
			}
			
		except Exception as e:
			response_time = (datetime.now() - start_time).total_seconds() * 1000
			return {
				'success': False,
				'error_message': str(e),
				'error_code': 'WEBHOOK_REQUEST_ERROR',
				'response_time': response_time
			}
	
	def _calculate_retry_delay(self, attempt: int) -> int:
		"""Calculate retry delay with optional exponential backoff."""
		if self.config.retry_exponential_backoff:
			return self.config.retry_delay_seconds * (2 ** attempt)
		else:
			return self.config.retry_delay_seconds
	
	def _flatten_dict(self, d: Dict[str, Any], parent_key: str = '', sep: str = '.') -> Dict[str, Any]:
		"""Flatten nested dictionary."""
		items = []
		for k, v in d.items():
			new_key = f"{parent_key}{sep}{k}" if parent_key else k
			if isinstance(v, dict):
				items.extend(self._flatten_dict(v, new_key, sep=sep).items())
			else:
				items.append((new_key, v))
		return dict(items)
	
	async def _update_stats(self, result: DeliveryResult, response_time: float) -> None:
		"""Update delivery statistics."""
		self._delivery_stats['total_sent'] += 1
		
		if result.success:
			self._delivery_stats['total_delivered'] += 1
		else:
			self._delivery_stats['total_failed'] += 1
		
		# Track response codes
		if hasattr(result, 'provider_response') and result.provider_response:
			status_code = result.provider_response.get('status_code')
			if status_code:
				self._delivery_stats['response_codes'][str(status_code)] = \
					self._delivery_stats['response_codes'].get(str(status_code), 0) + 1
		
		# Update average response time
		if response_time > 0:
			current_avg = self._delivery_stats['average_response_time']
			total_sent = self._delivery_stats['total_sent']
			self._delivery_stats['average_response_time'] = \
				(current_avg * (total_sent - 1) + response_time) / total_sent


# Utility functions for webhook channel

def create_webhook_channel(
	webhook_url: str,
	auth_type: WebhookAuthType = WebhookAuthType.NONE,
	**kwargs
) -> WebhookChannel:
	"""Factory function to create WebhookChannel."""
	config = WebhookConfiguration(
		webhook_url=webhook_url,
		auth_type=auth_type,
		**kwargs
	)
	
	return WebhookChannel(config)


def create_webhook_message(
	title: str,
	content: str,
	recipient_id: str = "webhook",
	custom_payload: Optional[Dict[str, Any]] = None,
	correlation_id: Optional[str] = None,
	**kwargs
) -> NotificationMessage:
	"""Create a webhook notification message."""
	from ..delivery.notification_delivery import NotificationMessage, Priority
	
	channel_data = {}
	if custom_payload:
		channel_data['custom_payload'] = custom_payload
	if correlation_id:
		channel_data['correlation_id'] = correlation_id
	
	return NotificationMessage(
		title=title,
		content=content,
		recipient_id=recipient_id,
		channel=getattr(ChannelType, 'WEBHOOK', ChannelType.IN_APP),
		priority=Priority.MEDIUM,
		channel_data=channel_data,
		**kwargs
	)


def create_authenticated_webhook_channel(
	webhook_url: str,
	bearer_token: str,
	**kwargs
) -> WebhookChannel:
	"""Create webhook channel with Bearer token authentication."""
	config = WebhookConfiguration(
		webhook_url=webhook_url,
		auth_type=WebhookAuthType.BEARER,
		bearer_token=bearer_token,
		**kwargs
	)
	
	return WebhookChannel(config)


def create_hmac_webhook_channel(
	webhook_url: str,
	hmac_secret: str,
	hmac_header: str = "X-Signature",
	**kwargs
) -> WebhookChannel:
	"""Create webhook channel with HMAC SHA256 authentication."""
	config = WebhookConfiguration(
		webhook_url=webhook_url,
		auth_type=WebhookAuthType.HMAC_SHA256,
		hmac_secret=hmac_secret,
		hmac_header=hmac_header,
		**kwargs
	)

	return WebhookChannel(config)


def create_webhook_channel_from_secrets(
	webhook_url: str,
	auth_type: WebhookAuthType = WebhookAuthType.NONE,
	**kwargs
) -> WebhookChannel:
	"""
	Create WebhookChannel using secrets from SecretsManager.

	This factory function automatically retrieves API keys and credentials
	from the centralized secrets management system.

	Args:
		webhook_url: Webhook endpoint URL
		auth_type: Authentication type (NONE, BEARER, API_KEY, HMAC_SHA256)
		**kwargs: Additional configuration options

	Returns:
		Configured WebhookChannel instance

	Example:
		channel = create_webhook_channel_from_secrets(
			webhook_url="https://example.com/webhook",
			auth_type=WebhookAuthType.BEARER
		)
	"""
	# Get secrets based on auth type
	if auth_type == WebhookAuthType.BEARER:
		kwargs.setdefault('bearer_token', SecretsManager.get_webhook_bearer_token())
	elif auth_type == WebhookAuthType.API_KEY:
		kwargs.setdefault('api_key', SecretsManager.get_webhook_api_key())
	elif auth_type == WebhookAuthType.HMAC_SHA256:
		kwargs.setdefault('hmac_secret', SecretsManager.get_webhook_hmac_secret())

	config = WebhookConfiguration(
		webhook_url=webhook_url,
		auth_type=auth_type,
		**kwargs
	)

	return WebhookChannel(config)