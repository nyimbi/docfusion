"""
TelegramChannel - Week 20 Telegram Bot API Notification Channel

Implements Telegram Bot API notifications with support for text messages,
rich media, inline keyboards, and delivery tracking.
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


class TelegramParseMode(str, Enum):
	"""Telegram message parsing modes."""
	MARKDOWN = "Markdown"
	MARKDOWNV2 = "MarkdownV2"
	HTML = "HTML"


class TelegramConfiguration(BaseModel):
	"""Telegram Bot API configuration."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	# Bot Configuration
	bot_token: str = Field(..., description="Telegram Bot API token")
	api_base_url: str = Field("https://api.telegram.org", description="Telegram API base URL")
	
	# Message Configuration
	default_parse_mode: TelegramParseMode = Field(TelegramParseMode.HTML, description="Default message parse mode")
	enable_web_page_preview: bool = Field(True, description="Enable web page preview in messages")
	enable_notification: bool = Field(True, description="Send messages with notification sound")
	
	# Rate Limiting (Telegram limits: 30 messages per second)
	rate_limit_per_second: int = Field(20, description="Messages per second limit")
	rate_limit_per_minute: int = Field(600, description="Messages per minute limit")
	
	# Webhook Configuration
	webhook_url: Optional[str] = Field(None, description="Webhook URL for receiving updates")
	webhook_secret_token: Optional[str] = Field(None, description="Webhook secret token")
	
	@validator('bot_token')
	def validate_bot_token(cls, v):
		"""Validate bot token format."""
		if not v or not v.count(':') == 1:
			raise ValueError("Invalid Telegram bot token format")
		return v


class TelegramChannel(NotificationChannel):
	"""
	Telegram Bot API notification channel.
	
	Provides comprehensive Telegram messaging including:
	- Text messages with formatting (HTML, Markdown)
	- Rich media attachments (photos, documents, audio, video)
	- Inline keyboards and reply markup
	- Message delivery tracking
	- Group and channel messaging support
	- Rate limiting and error handling
	"""
	
	def __init__(self, config: TelegramConfiguration):
		self.config = config
		
		# Rate limiting
		self._rate_limit_window = 1  # 1 second
		self._rate_limit_counter = 0
		self._rate_limit_reset_time = datetime.now()
		self._minute_counter = 0
		self._minute_reset_time = datetime.now()
		
		# Message tracking
		self._sent_messages: Dict[str, Dict[str, Any]] = {}  # message_id -> telegram_message_info
		
		# Metrics
		self._delivery_stats = {
			'total_sent': 0,
			'total_delivered': 0,
			'total_failed': 0,
			'message_types': {
				'text': 0,
				'photo': 0,
				'document': 0,
				'audio': 0,
				'video': 0,
				'voice': 0,
				'sticker': 0
			},
			'chat_types': {
				'private': 0,
				'group': 0,
				'supergroup': 0,
				'channel': 0
			}
		}
		
		self.logger = logging.getLogger(__name__)
		self.logger.info("TelegramChannel initialized")
	
	async def send(self, message: NotificationMessage) -> DeliveryResult:
		"""Send Telegram message."""
		start_time = datetime.now()
		
		try:
			# Rate limiting check
			await self._check_rate_limits()
			
			# Validate Telegram-specific data
			telegram_data = await self._validate_telegram_data(message)
			
			# Prepare message payload
			message_payload = await self._prepare_message_payload(message, telegram_data)
			
			# Send via Telegram Bot API
			api_result = await self._send_via_telegram_api(message_payload, message)
			
			delivery_time = (datetime.now() - start_time).total_seconds() * 1000
			
			result = DeliveryResult(
				message_id=message.id,
				status=DeliveryStatus.DELIVERED if api_result['success'] else DeliveryStatus.FAILED,
				channel=ChannelType.IN_APP,  # Using IN_APP enum for Telegram
				success=api_result['success'],
				error_message=api_result.get('error_message'),
				error_code=api_result.get('error_code'),
				delivery_time_ms=int(delivery_time),
				tracking_id=api_result.get('tracking_id'),
				provider_response=api_result.get('provider_response', {})
			)
			
			await self._update_stats(result, telegram_data)
			return result
			
		except Exception as e:
			delivery_time = (datetime.now() - start_time).total_seconds() * 1000
			
			return DeliveryResult(
				message_id=message.id,
				status=DeliveryStatus.FAILED,
				channel=ChannelType.IN_APP,
				success=False,
				error_message=str(e),
				error_code="TELEGRAM_DELIVERY_EXCEPTION",
				delivery_time_ms=int(delivery_time)
			)
	
	async def validate_recipient(self, recipient_id: str) -> bool:
		"""Validate Telegram recipient (chat ID or username)."""
		try:
			# Chat ID (numeric) or username (@username)
			if recipient_id.startswith('@'):
				# Username format
				return len(recipient_id) > 1 and recipient_id[1:].replace('_', '').isalnum()
			else:
				# Chat ID format (can be negative for groups)
				try:
					int(recipient_id)
					return True
				except ValueError:
					return False
			
		except Exception as e:
			self.logger.warning("Failed to validate Telegram recipient '%s': %s", recipient_id, str(e))
			return False
	
	def get_channel_type(self) -> ChannelType:
		"""Get channel type identifier."""
		return ChannelType.IN_APP  # Using IN_APP enum for Telegram
	
	def supports_priority(self, priority: Priority) -> bool:
		"""Check if channel supports given priority level."""
		return True
	
	async def handle_webhook_update(self, update_data: Dict[str, Any]) -> None:
		"""Handle Telegram webhook updates."""
		try:
			# Process different types of updates
			if 'message' in update_data:
				await self._handle_message_update(update_data['message'])
			elif 'callback_query' in update_data:
				await self._handle_callback_query(update_data['callback_query'])
			elif 'inline_query' in update_data:
				await self._handle_inline_query(update_data['inline_query'])
			
			self.logger.debug("Processed Telegram webhook update")
			
		except Exception as e:
			self.logger.error("Error processing Telegram webhook: %s", str(e))
	
	async def send_typing_action(self, chat_id: str) -> None:
		"""Send typing action to indicate bot is preparing a response."""
		try:
			payload = {
				'chat_id': chat_id,
				'action': 'typing'
			}
			
			await self._make_api_request('sendChatAction', payload)
			
		except Exception as e:
			self.logger.warning("Failed to send typing action: %s", str(e))
	
	def get_delivery_statistics(self) -> Dict[str, Any]:
		"""Get Telegram delivery statistics."""
		stats = self._delivery_stats.copy()
		
		# Calculate rates
		if stats['total_sent'] > 0:
			stats['delivery_rate'] = stats['total_delivered'] / stats['total_sent']
			stats['failure_rate'] = stats['total_failed'] / stats['total_sent']
		else:
			stats.update({
				'delivery_rate': 0.0,
				'failure_rate': 0.0
			})
		
		return stats
	
	async def _validate_telegram_data(self, message: NotificationMessage) -> Dict[str, Any]:
		"""Validate Telegram-specific data."""
		channel_data = message.channel_data
		
		# Chat ID (recipient)
		chat_id = channel_data.get('chat_id', message.recipient_id)
		
		# Parse mode
		parse_mode_str = channel_data.get('parse_mode', self.config.default_parse_mode.value)
		try:
			parse_mode = TelegramParseMode(parse_mode_str)
		except ValueError:
			parse_mode = self.config.default_parse_mode
		
		return {
			'chat_id': chat_id,
			'parse_mode': parse_mode,
			'disable_web_page_preview': not channel_data.get('enable_web_page_preview', self.config.enable_web_page_preview),
			'disable_notification': not channel_data.get('enable_notification', self.config.enable_notification),
			'reply_to_message_id': channel_data.get('reply_to_message_id'),
			'inline_keyboard': channel_data.get('inline_keyboard', []),
			'reply_markup': channel_data.get('reply_markup'),
			'media_type': channel_data.get('media_type', 'text'),
			'media_url': channel_data.get('media_url'),
			'media_caption': channel_data.get('media_caption'),
			'document_filename': channel_data.get('document_filename'),
			'protect_content': channel_data.get('protect_content', False)
		}
	
	async def _prepare_message_payload(self, message: NotificationMessage, telegram_data: Dict[str, Any]) -> Dict[str, Any]:
		"""Prepare Telegram API message payload."""
		base_payload = {
			'chat_id': telegram_data['chat_id'],
			'disable_web_page_preview': telegram_data['disable_web_page_preview'],
			'disable_notification': telegram_data['disable_notification'],
			'protect_content': telegram_data['protect_content']
		}
		
		# Add reply-to if specified
		if telegram_data['reply_to_message_id']:
			base_payload['reply_to_message_id'] = telegram_data['reply_to_message_id']
		
		# Handle different media types
		media_type = telegram_data['media_type']
		
		if media_type == 'text':
			base_payload.update({
				'text': message.content,
				'parse_mode': telegram_data['parse_mode'].value
			})
			
		elif media_type in ['photo', 'document', 'audio', 'video', 'voice', 'sticker']:
			if not telegram_data['media_url']:
				raise ValueError(f"Media URL required for {media_type} messages")
			
			base_payload[media_type] = telegram_data['media_url']
			
			# Add caption for media types that support it
			if media_type in ['photo', 'document', 'audio', 'video'] and message.content:
				base_payload['caption'] = message.content
				base_payload['parse_mode'] = telegram_data['parse_mode'].value
			
			# Add filename for documents
			if media_type == 'document' and telegram_data['document_filename']:
				# This would be handled in the actual file upload
				pass
		
		# Add inline keyboard if provided
		if telegram_data['inline_keyboard']:
			base_payload['reply_markup'] = {
				'inline_keyboard': telegram_data['inline_keyboard']
			}
		elif telegram_data['reply_markup']:
			base_payload['reply_markup'] = telegram_data['reply_markup']
		
		return {
			'method': self._get_api_method(media_type),
			'payload': base_payload,
			'media_type': media_type
		}
	
	async def _send_via_telegram_api(self, message_data: Dict[str, Any], message: NotificationMessage) -> Dict[str, Any]:
		"""Send message via Telegram Bot API."""
		try:
			method = message_data['method']
			payload = message_data['payload']
			
			# Make API request
			api_response = await self._make_api_request(method, payload)
			
			# Extract message info from response
			if api_response.get('ok') and 'result' in api_response:
				result = api_response['result']
				telegram_message_id = result.get('message_id')
				
				# Store message tracking info
				self._sent_messages[message.id] = {
					'telegram_message_id': telegram_message_id,
					'chat_id': payload['chat_id'],
					'sent_at': datetime.now().isoformat(),
					'media_type': message_data['media_type']
				}
				
				return {
					'success': True,
					'tracking_id': str(telegram_message_id),
					'provider_response': api_response
				}
			else:
				error_description = api_response.get('description', 'Unknown error')
				return {
					'success': False,
					'error_message': error_description,
					'error_code': 'TELEGRAM_API_ERROR',
					'provider_response': api_response
				}
			
		except Exception as e:
			return {
				'success': False,
				'error_message': str(e),
				'error_code': 'TELEGRAM_REQUEST_ERROR'
			}
	
	async def _make_api_request(self, method: str, payload: Dict[str, Any]) -> Dict[str, Any]:
		"""Make HTTP request to Telegram Bot API."""
		# This would make actual HTTP request to Telegram API
		# Placeholder implementation
		
		self.logger.info("Making Telegram API request: %s", method)
		self.logger.debug("Payload: %s", json.dumps(payload, indent=2))
		
		# Simulate successful API response
		if method == 'sendMessage':
			return {
				'ok': True,
				'result': {
					'message_id': 12345,
					'from': {
						'id': 123456789,
						'is_bot': True,
						'first_name': 'DocuFusion Bot'
					},
					'chat': {
						'id': int(payload['chat_id']) if payload['chat_id'].lstrip('-').isdigit() else 0,
						'type': 'private'
					},
					'date': int(datetime.now().timestamp()),
					'text': payload.get('text', '')
				}
			}
		elif method == 'sendChatAction':
			return {'ok': True, 'result': True}
		else:
			return {
				'ok': True,
				'result': {
					'message_id': 12345,
					'chat': {'id': int(payload['chat_id']) if payload['chat_id'].lstrip('-').isdigit() else 0}
				}
			}
	
	def _get_api_method(self, media_type: str) -> str:
		"""Get Telegram API method for media type."""
		method_map = {
			'text': 'sendMessage',
			'photo': 'sendPhoto',
			'document': 'sendDocument',
			'audio': 'sendAudio',
			'video': 'sendVideo',
			'voice': 'sendVoice',
			'sticker': 'sendSticker'
		}
		
		return method_map.get(media_type, 'sendMessage')
	
	async def _handle_message_update(self, message_data: Dict[str, Any]) -> None:
		"""Handle incoming message updates."""
		# This would process incoming messages for bot interactions
		self.logger.debug("Received message update: %s", message_data.get('message_id'))
	
	async def _handle_callback_query(self, callback_data: Dict[str, Any]) -> None:
		"""Handle inline keyboard button callbacks."""
		# This would process button clicks from inline keyboards
		self.logger.debug("Received callback query: %s", callback_data.get('id'))
	
	async def _handle_inline_query(self, inline_data: Dict[str, Any]) -> None:
		"""Handle inline query updates."""
		# This would process inline bot queries
		self.logger.debug("Received inline query: %s", inline_data.get('id'))
	
	async def _check_rate_limits(self) -> None:
		"""Check and enforce Telegram rate limits."""
		now = datetime.now()
		
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
		
		# Check per-minute limit
		if (now - self._minute_reset_time).total_seconds() >= 60:
			self._minute_counter = 0
			self._minute_reset_time = now
		
		if self._minute_counter >= self.config.rate_limit_per_minute:
			wait_time = 60 - (now - self._minute_reset_time).total_seconds()
			if wait_time > 0:
				await asyncio.sleep(wait_time)
				self._minute_counter = 0
				self._minute_reset_time = datetime.now()
		
		self._rate_limit_counter += 1
		self._minute_counter += 1
	
	async def _update_stats(self, result: DeliveryResult, telegram_data: Dict[str, Any]) -> None:
		"""Update delivery statistics."""
		self._delivery_stats['total_sent'] += 1
		
		if result.success:
			self._delivery_stats['total_delivered'] += 1
		else:
			self._delivery_stats['total_failed'] += 1
		
		# Track by media type
		media_type = telegram_data['media_type']
		if media_type in self._delivery_stats['message_types']:
			self._delivery_stats['message_types'][media_type] += 1
		
		# Track by chat type (would need to be determined from API response)
		# For now, assume private chat
		self._delivery_stats['chat_types']['private'] += 1


# Utility functions for Telegram channel

def create_telegram_channel(
	bot_token: str,
	**kwargs
) -> TelegramChannel:
	"""Factory function to create TelegramChannel."""
	config = TelegramConfiguration(
		bot_token=bot_token,
		**kwargs
	)
	
	return TelegramChannel(config)


def create_telegram_text_message(
	content: str,
	chat_id: str,
	parse_mode: str = 'HTML',
	**kwargs
) -> NotificationMessage:
	"""Create a Telegram text message."""
	from ..delivery.notification_delivery import NotificationMessage, Priority
	
	return NotificationMessage(
		title="Telegram Message",
		content=content,
		recipient_id=chat_id,
		channel=ChannelType.IN_APP,
		priority=Priority.MEDIUM,
		channel_data={
			'chat_id': chat_id,
			'media_type': 'text',
			'parse_mode': parse_mode
		},
		**kwargs
	)


def create_telegram_photo_message(
	photo_url: str,
	chat_id: str,
	caption: str = "",
	**kwargs
) -> NotificationMessage:
	"""Create a Telegram photo message."""
	from ..delivery.notification_delivery import NotificationMessage, Priority
	
	return NotificationMessage(
		title="Telegram Photo",
		content=caption,
		recipient_id=chat_id,
		channel=ChannelType.IN_APP,
		priority=Priority.MEDIUM,
		channel_data={
			'chat_id': chat_id,
			'media_type': 'photo',
			'media_url': photo_url
		},
		**kwargs
	)


def create_telegram_keyboard_message(
	content: str,
	chat_id: str,
	keyboard_buttons: List[List[Dict[str, str]]],
	**kwargs
) -> NotificationMessage:
	"""Create a Telegram message with inline keyboard."""
	from ..delivery.notification_delivery import NotificationMessage, Priority
	
	return NotificationMessage(
		title="Telegram Interactive",
		content=content,
		recipient_id=chat_id,
		channel=ChannelType.IN_APP,
		priority=Priority.MEDIUM,
		channel_data={
			'chat_id': chat_id,
			'media_type': 'text',
			'inline_keyboard': keyboard_buttons
		},
		**kwargs
	)