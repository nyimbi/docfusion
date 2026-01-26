"""
WhatsAppChannel - Week 20 WhatsApp Business API Notification Channel

Implements WhatsApp Business API notifications with support for text messages,
media attachments, interactive buttons, and delivery status tracking.
"""

import asyncio
import logging
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
import json

from pydantic import BaseModel, Field, ConfigDict, validator

from ..delivery.notification_delivery import (
	NotificationChannel, NotificationMessage, DeliveryResult, 
	DeliveryStatus, ChannelType, Priority
)


class WhatsAppMessageType(str, Enum):
	"""WhatsApp message types."""
	TEXT = "text"
	TEMPLATE = "template"
	INTERACTIVE = "interactive"
	MEDIA = "media"


class WhatsAppConfiguration(BaseModel):
	"""WhatsApp Business API configuration."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	# WhatsApp Business API Configuration
	access_token: str = Field(..., description="WhatsApp Business API access token")
	phone_number_id: str = Field(..., description="WhatsApp Business phone number ID")
	business_account_id: str = Field(..., description="WhatsApp Business account ID")
	
	# API Configuration
	api_base_url: str = Field("https://graph.facebook.com/v17.0", description="API base URL")
	webhook_verify_token: Optional[str] = Field(None, description="Webhook verification token")
	
	# Message Configuration
	enable_delivery_reports: bool = Field(True, description="Enable delivery status tracking")
	enable_read_receipts: bool = Field(True, description="Enable read receipt tracking")
	
	# Rate Limiting (WhatsApp has strict limits)
	rate_limit_per_second: int = Field(10, description="Messages per second limit")
	rate_limit_per_day: int = Field(1000, description="Messages per day limit")
	
	# Template Configuration
	default_template_namespace: Optional[str] = Field(None, description="Default template namespace")
	
	@validator('access_token')
	def validate_access_token(cls, v):
		"""Validate access token format."""
		if not v or len(v) < 50:
			raise ValueError("Invalid WhatsApp access token")
		return v


class WhatsAppChannel(NotificationChannel):
	"""
	WhatsApp Business API notification channel.
	
	Provides comprehensive WhatsApp messaging including:
	- Text and template messages
	- Media attachments (images, documents, audio)
	- Interactive buttons and quick replies
	- Delivery and read status tracking
	- Template message compliance
	- Rate limiting and quota management
	"""
	
	def __init__(self, config: WhatsAppConfiguration):
		self.config = config
		
		# Rate limiting
		self._rate_limit_window = 1  # 1 second
		self._rate_limit_counter = 0
		self._rate_limit_reset_time = datetime.now()
		self._daily_counter = 0
		self._daily_reset_time = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
		
		# Message tracking
		self._message_status: Dict[str, str] = {}  # message_id -> status
		
		# Metrics
		self._delivery_stats = {
			'total_sent': 0,
			'total_delivered': 0,
			'total_read': 0,
			'total_failed': 0,
			'message_type_breakdown': {
				'text': 0,
				'template': 0,
				'interactive': 0,
				'media': 0
			},
			'daily_quota_used': 0
		}
		
		self.logger = logging.getLogger(__name__)
		self.logger.info("WhatsAppChannel initialized")
	
	async def send(self, message: NotificationMessage) -> DeliveryResult:
		"""Send WhatsApp message."""
		start_time = datetime.now()
		
		try:
			# Rate limiting check
			await self._check_rate_limits()
			
			# Validate WhatsApp-specific data
			whatsapp_data = await self._validate_whatsapp_data(message)
			
			# Prepare message payload
			message_payload = await self._prepare_message_payload(message, whatsapp_data)
			
			# Send via WhatsApp Business API
			api_result = await self._send_via_whatsapp_api(message_payload, message)
			
			delivery_time = (datetime.now() - start_time).total_seconds() * 1000
			
			result = DeliveryResult(
				message_id=message.id,
				status=DeliveryStatus.DELIVERED if api_result['success'] else DeliveryStatus.FAILED,
				channel=ChannelType.SMS,  # Using SMS enum value for WhatsApp
				success=api_result['success'],
				error_message=api_result.get('error_message'),
				error_code=api_result.get('error_code'),
				delivery_time_ms=int(delivery_time),
				tracking_id=api_result.get('tracking_id'),
				provider_response=api_result.get('provider_response', {})
			)
			
			await self._update_stats(result, whatsapp_data)
			return result
			
		except Exception as e:
			delivery_time = (datetime.now() - start_time).total_seconds() * 1000
			
			return DeliveryResult(
				message_id=message.id,
				status=DeliveryStatus.FAILED,
				channel=ChannelType.SMS,
				success=False,
				error_message=str(e),
				error_code="WHATSAPP_DELIVERY_EXCEPTION",
				delivery_time_ms=int(delivery_time)
			)
	
	async def validate_recipient(self, recipient_id: str) -> bool:
		"""Validate WhatsApp recipient phone number."""
		try:
			# WhatsApp requires E.164 format
			if not recipient_id.startswith('+'):
				return False
			
			# Remove + and check if all digits
			digits = recipient_id[1:]
			if not digits.isdigit() or len(digits) < 10:
				return False
			
			# Additional validation could include:
			# - WhatsApp number verification API
			# - Opt-in status checking
			# - Business policy compliance
			
			return True
			
		except Exception:
			return False
	
	def get_channel_type(self) -> ChannelType:
		"""Get channel type identifier."""
		return ChannelType.SMS  # Using SMS enum for WhatsApp
	
	def supports_priority(self, priority: Priority) -> bool:
		"""Check if channel supports given priority level."""
		return True
	
	async def handle_webhook_event(self, event_data: Dict[str, Any]) -> None:
		"""Handle WhatsApp webhook events (delivery status, etc.)."""
		try:
			# Parse webhook event
			if 'statuses' in event_data:
				for status in event_data['statuses']:
					message_id = status.get('id')
					status_type = status.get('status')
					
					if message_id:
						self._message_status[message_id] = status_type
						
						# Update metrics based on status
						if status_type == 'delivered':
							self._delivery_stats['total_delivered'] += 1
						elif status_type == 'read':
							self._delivery_stats['total_read'] += 1
			
			self.logger.debug("Processed WhatsApp webhook event")
			
		except Exception as e:
			self.logger.error("Error processing WhatsApp webhook: %s", str(e))
	
	def get_delivery_statistics(self) -> Dict[str, Any]:
		"""Get WhatsApp delivery statistics."""
		stats = self._delivery_stats.copy()
		
		# Calculate rates
		if stats['total_sent'] > 0:
			stats['delivery_rate'] = stats['total_delivered'] / stats['total_sent']
			stats['read_rate'] = stats['total_read'] / stats['total_sent']
			stats['failure_rate'] = stats['total_failed'] / stats['total_sent']
		else:
			stats.update({
				'delivery_rate': 0.0,
				'read_rate': 0.0,
				'failure_rate': 0.0
			})
		
		stats['daily_quota_remaining'] = self.config.rate_limit_per_day - stats['daily_quota_used']
		
		return stats
	
	async def _validate_whatsapp_data(self, message: NotificationMessage) -> Dict[str, Any]:
		"""Validate WhatsApp-specific data."""
		channel_data = message.channel_data
		
		# Recipient phone number
		recipient_phone = channel_data.get('recipient_phone', message.recipient_id)
		if not recipient_phone.startswith('+'):
			recipient_phone = '+' + recipient_phone.lstrip('+')
		
		# Message type
		message_type_str = channel_data.get('message_type', 'text')
		try:
			message_type = WhatsAppMessageType(message_type_str)
		except ValueError:
			message_type = WhatsAppMessageType.TEXT
		
		return {
			'recipient_phone': recipient_phone,
			'message_type': message_type,
			'template_name': channel_data.get('template_name'),
			'template_language': channel_data.get('template_language', 'en'),
			'template_parameters': channel_data.get('template_parameters', []),
			'media_url': channel_data.get('media_url'),
			'media_type': channel_data.get('media_type'),
			'interactive_buttons': channel_data.get('interactive_buttons', []),
			'quick_replies': channel_data.get('quick_replies', []),
			'header_text': channel_data.get('header_text'),
			'footer_text': channel_data.get('footer_text')
		}
	
	async def _prepare_message_payload(self, message: NotificationMessage, whatsapp_data: Dict[str, Any]) -> Dict[str, Any]:
		"""Prepare WhatsApp API message payload."""
		base_payload = {
			'messaging_product': 'whatsapp',
			'to': whatsapp_data['recipient_phone'],
			'type': whatsapp_data['message_type'].value
		}
		
		if whatsapp_data['message_type'] == WhatsAppMessageType.TEXT:
			base_payload['text'] = {
				'body': message.content
			}
		
		elif whatsapp_data['message_type'] == WhatsAppMessageType.TEMPLATE:
			if not whatsapp_data['template_name']:
				raise ValueError("Template name required for template messages")
			
			base_payload['template'] = {
				'name': whatsapp_data['template_name'],
				'language': {
					'code': whatsapp_data['template_language']
				}
			}
			
			if whatsapp_data['template_parameters']:
				base_payload['template']['components'] = [
					{
						'type': 'body',
						'parameters': [
							{'type': 'text', 'text': param}
							for param in whatsapp_data['template_parameters']
						]
					}
				]
		
		elif whatsapp_data['message_type'] == WhatsAppMessageType.INTERACTIVE:
			interactive_payload = {
				'type': 'button',
				'body': {
					'text': message.content
				}
			}
			
			if whatsapp_data['header_text']:
				interactive_payload['header'] = {
					'type': 'text',
					'text': whatsapp_data['header_text']
				}
			
			if whatsapp_data['footer_text']:
				interactive_payload['footer'] = {
					'text': whatsapp_data['footer_text']
				}
			
			if whatsapp_data['interactive_buttons']:
				interactive_payload['action'] = {
					'buttons': [
						{
							'type': 'reply',
							'reply': {
								'id': btn.get('id', f"btn_{i}"),
								'title': btn.get('title', f"Button {i+1}")
							}
						}
						for i, btn in enumerate(whatsapp_data['interactive_buttons'][:3])  # Max 3 buttons
					]
				}
			
			base_payload['interactive'] = interactive_payload
		
		elif whatsapp_data['message_type'] == WhatsAppMessageType.MEDIA:
			if not whatsapp_data['media_url']:
				raise ValueError("Media URL required for media messages")
			
			media_type = whatsapp_data['media_type'] or 'image'
			base_payload['type'] = media_type
			base_payload[media_type] = {
				'link': whatsapp_data['media_url']
			}
			
			if message.content:
				base_payload[media_type]['caption'] = message.content
		
		return base_payload
	
	async def _send_via_whatsapp_api(self, payload: Dict[str, Any], message: NotificationMessage) -> Dict[str, Any]:
		"""Send message via WhatsApp Business API."""
		try:
			# This would make HTTP request to WhatsApp Business API
			# Placeholder implementation
			
			self.logger.info("Sending WhatsApp message (placeholder implementation)")
			self.logger.debug("Payload: %s", json.dumps(payload, indent=2))
			
			# Simulate API response
			api_response = {
				'messages': [
					{
						'id': f"wamid.{message.id}",
						'message_status': 'accepted'
					}
				]
			}
			
			return {
				'success': True,
				'tracking_id': f"wamid.{message.id}",
				'provider_response': api_response
			}
			
		except Exception as e:
			return {
				'success': False,
				'error_message': str(e),
				'error_code': 'WHATSAPP_API_ERROR'
			}
	
	async def _check_rate_limits(self) -> None:
		"""Check and enforce WhatsApp rate limits."""
		now = datetime.now()
		
		# Check daily limit
		if now.date() > self._daily_reset_time.date():
			self._daily_counter = 0
			self._daily_reset_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
		
		if self._daily_counter >= self.config.rate_limit_per_day:
			raise Exception("Daily WhatsApp message quota exceeded")
		
		# Check per-second limit
		if (now - self._rate_limit_reset_time).total_seconds() >= self._rate_limit_window:
			self._rate_limit_counter = 0
			self._rate_limit_reset_time = now
		
		if self._rate_limit_counter >= self.config.rate_limit_per_second:
			wait_time = self._rate_limit_window - (now - self._rate_limit_reset_time).total_seconds()
			if wait_time > 0:
				await asyncio.sleep(wait_time)
				self._rate_limit_counter = 0
				self._rate_limit_reset_time = datetime.now()
		
		self._rate_limit_counter += 1
		self._daily_counter += 1
	
	async def _update_stats(self, result: DeliveryResult, whatsapp_data: Dict[str, Any]) -> None:
		"""Update delivery statistics."""
		self._delivery_stats['total_sent'] += 1
		self._delivery_stats['daily_quota_used'] += 1
		
		if result.success:
			# Note: actual delivery confirmation comes via webhook
			pass
		else:
			self._delivery_stats['total_failed'] += 1
		
		# Track by message type
		message_type = whatsapp_data['message_type'].value
		self._delivery_stats['message_type_breakdown'][message_type] += 1


# Utility functions for WhatsApp channel

def create_whatsapp_channel(
	access_token: str,
	phone_number_id: str,
	business_account_id: str,
	**kwargs
) -> WhatsAppChannel:
	"""Factory function to create WhatsAppChannel."""
	config = WhatsAppConfiguration(
		access_token=access_token,
		phone_number_id=phone_number_id,
		business_account_id=business_account_id,
		**kwargs
	)
	
	return WhatsAppChannel(config)


def create_whatsapp_text_message(
	content: str,
	recipient_phone: str,
	**kwargs
) -> NotificationMessage:
	"""Create a WhatsApp text message."""
	from ..delivery.notification_delivery import NotificationMessage, Priority
	
	return NotificationMessage(
		title="WhatsApp Message",
		content=content,
		recipient_id=recipient_phone,
		channel=ChannelType.SMS,  # Using SMS enum for WhatsApp
		priority=Priority.MEDIUM,
		channel_data={
			'recipient_phone': recipient_phone,
			'message_type': 'text'
		},
		**kwargs
	)


def create_whatsapp_template_message(
	template_name: str,
	recipient_phone: str,
	template_parameters: List[str] = None,
	template_language: str = 'en',
	**kwargs
) -> NotificationMessage:
	"""Create a WhatsApp template message."""
	from ..delivery.notification_delivery import NotificationMessage, Priority
	
	return NotificationMessage(
		title="WhatsApp Template",
		content="Template message",
		recipient_id=recipient_phone,
		channel=ChannelType.SMS,
		priority=Priority.MEDIUM,
		channel_data={
			'recipient_phone': recipient_phone,
			'message_type': 'template',
			'template_name': template_name,
			'template_parameters': template_parameters or [],
			'template_language': template_language
		},
		**kwargs
	)


def create_whatsapp_interactive_message(
	content: str,
	recipient_phone: str,
	buttons: List[Dict[str, str]],
	header_text: Optional[str] = None,
	footer_text: Optional[str] = None,
	**kwargs
) -> NotificationMessage:
	"""Create a WhatsApp interactive message with buttons."""
	from ..delivery.notification_delivery import NotificationMessage, Priority
	
	return NotificationMessage(
		title="WhatsApp Interactive",
		content=content,
		recipient_id=recipient_phone,
		channel=ChannelType.SMS,
		priority=Priority.MEDIUM,
		channel_data={
			'recipient_phone': recipient_phone,
			'message_type': 'interactive',
			'interactive_buttons': buttons,
			'header_text': header_text,
			'footer_text': footer_text
		},
		**kwargs
	)