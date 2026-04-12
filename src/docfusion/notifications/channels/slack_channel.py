"""
SlackChannel - Week 20 Slack API Notification Channel

Implements Slack notifications with support for text messages, rich formatting,
interactive elements, file attachments, and threaded conversations.
"""

import asyncio
import logging
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
import json

from pydantic import BaseModel, Field, ConfigDict, field_validator

from ..delivery.notification_delivery import (
	NotificationChannel, NotificationMessage, DeliveryResult, 
	DeliveryStatus, ChannelType, Priority
)


class SlackMessageType(str, Enum):
	"""Slack message types."""
	TEXT = "text"
	RICH_TEXT = "rich_text"
	ATTACHMENT = "attachment"
	BLOCKS = "blocks"


class SlackConfiguration(BaseModel):
	"""Slack API configuration."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	# Slack App Configuration
	bot_token: str = Field(..., description="Slack Bot User OAuth Token")
	app_token: Optional[str] = Field(None, description="Slack App-Level Token")
	signing_secret: Optional[str] = Field(None, description="Slack App Signing Secret")
	
	# API Configuration
	api_base_url: str = Field("https://slack.com/api", description="Slack API base URL")
	
	# Default Settings
	default_channel: Optional[str] = Field(None, description="Default channel for messages")
	bot_name: Optional[str] = Field(None, description="Bot display name")
	bot_icon_emoji: Optional[str] = Field(None, description="Bot icon emoji")
	bot_icon_url: Optional[str] = Field(None, description="Bot icon URL")
	
	# Message Configuration
	enable_unfurl_links: bool = Field(True, description="Enable link unfurling")
	enable_unfurl_media: bool = Field(True, description="Enable media unfurling")
	enable_markdown: bool = Field(True, description="Enable Slack markdown formatting")
	
	# Rate Limiting (Slack Tier 1: 1+ requests per minute)
	rate_limit_per_minute: int = Field(60, description="Requests per minute limit")
	
	@field_validator('bot_token')
	@classmethod
	def validate_bot_token(cls, v):
		"""Validate bot token format."""
		if not v or not v.startswith('xoxb-'):
			raise ValueError("Invalid Slack bot token format")
		return v


class SlackChannel(NotificationChannel):
	"""
	Slack API notification channel.
	
	Provides comprehensive Slack messaging including:
	- Text messages with rich formatting (markdown, blocks)
	- File attachments and media sharing
	- Interactive elements (buttons, dropdowns)
	- Threaded conversations
	- Channel, DM, and group messaging
	- User and channel mentions
	- Emoji and reaction support
	"""
	
	def __init__(self, config: SlackConfiguration):
		self.config = config
		
		# Rate limiting
		self._rate_limit_window = 60  # 1 minute
		self._rate_limit_counter = 0
		self._rate_limit_reset_time = datetime.now()
		
		# Message tracking
		self._sent_messages: Dict[str, Dict[str, Any]] = {}  # message_id -> slack_message_info
		
		# Metrics
		self._delivery_stats = {
			'total_sent': 0,
			'total_delivered': 0,
			'total_failed': 0,
			'message_types': {
				'text': 0,
				'rich_text': 0,
				'attachment': 0,
				'blocks': 0
			},
			'destination_types': {
				'channel': 0,
				'direct_message': 0,
				'group': 0
			}
		}
		
		self.logger = logging.getLogger(__name__)
		self.logger.info("SlackChannel initialized")
	
	async def send(self, message: NotificationMessage) -> DeliveryResult:
		"""Send Slack message."""
		start_time = datetime.now()
		
		try:
			# Rate limiting check
			await self._check_rate_limit()
			
			# Validate Slack-specific data
			slack_data = await self._validate_slack_data(message)
			
			# Prepare message payload
			message_payload = await self._prepare_message_payload(message, slack_data)
			
			# Send via Slack API
			api_result = await self._send_via_slack_api(message_payload, message)
			
			delivery_time = (datetime.now() - start_time).total_seconds() * 1000
			
			result = DeliveryResult(
				message_id=message.id,
				status=DeliveryStatus.DELIVERED if api_result['success'] else DeliveryStatus.FAILED,
				channel=ChannelType.SLACK,  # Assuming SLACK enum exists
				success=api_result['success'],
				error_message=api_result.get('error_message'),
				error_code=api_result.get('error_code'),
				delivery_time_ms=int(delivery_time),
				tracking_id=api_result.get('tracking_id'),
				provider_response=api_result.get('provider_response', {})
			)
			
			await self._update_stats(result, slack_data)
			return result
			
		except Exception as e:
			delivery_time = (datetime.now() - start_time).total_seconds() * 1000
			
			return DeliveryResult(
				message_id=message.id,
				status=DeliveryStatus.FAILED,
				channel=ChannelType.IN_APP,  # Fallback to IN_APP if SLACK doesn't exist
				success=False,
				error_message=str(e),
				error_code="SLACK_DELIVERY_EXCEPTION",
				delivery_time_ms=int(delivery_time)
			)
	
	async def validate_recipient(self, recipient_id: str) -> bool:
		"""Validate Slack recipient (channel ID, user ID, or channel name)."""
		try:
			# Channel ID (C...), User ID (U...), or channel name (#channel)
			if recipient_id.startswith(('#', '@')):
				return len(recipient_id) > 1
			elif recipient_id.startswith(('C', 'U', 'D', 'G')):  # Slack ID formats
				return len(recipient_id) >= 9  # Slack IDs are typically 9+ characters
			else:
				return False
			
		except Exception as e:
			self.logger.warning(f"Slack recipient validation failed: {e}")
			return False
	
	def get_channel_type(self) -> ChannelType:
		"""Get channel type identifier."""
		# Use IN_APP as fallback if SLACK enum doesn't exist
		return getattr(ChannelType, 'SLACK', ChannelType.IN_APP)
	
	def supports_priority(self, priority: Priority) -> bool:
		"""Check if channel supports given priority level."""
		return True
	
	async def upload_file(self, file_path: str, channels: List[str], title: Optional[str] = None, comment: Optional[str] = None) -> Dict[str, Any]:
		"""Upload file to Slack channels."""
		try:
			# This would upload file via Slack files.upload API
			self.logger.info("Uploading file to Slack (placeholder implementation)")
			
			return {
				'success': True,
				'file_id': f"F{datetime.now().timestamp()}",
				'url': f"https://files.slack.com/files-pri/T123/F456/{file_path.split('/')[-1]}"
			}
			
		except Exception as e:
			return {
				'success': False,
				'error_message': str(e)
			}
	
	async def add_reaction(self, channel: str, timestamp: str, emoji: str) -> bool:
		"""Add emoji reaction to a message."""
		try:
			payload = {
				'channel': channel,
				'timestamp': timestamp,
				'name': emoji.strip(':')  # Remove colons if present
			}
			
			result = await self._make_api_request('reactions.add', payload)
			return result.get('ok', False)
			
		except Exception as e:
			self.logger.warning("Failed to add reaction: %s", str(e))
			return False
	
	def get_delivery_statistics(self) -> Dict[str, Any]:
		"""Get Slack delivery statistics."""
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
	
	async def _validate_slack_data(self, message: NotificationMessage) -> Dict[str, Any]:
		"""Validate Slack-specific data."""
		channel_data = message.channel_data
		
		# Channel/recipient
		channel = channel_data.get('channel', message.recipient_id or self.config.default_channel)
		if not channel:
			raise ValueError("Slack channel or recipient is required")
		
		# Message type
		message_type_str = channel_data.get('message_type', 'text')
		try:
			message_type = SlackMessageType(message_type_str)
		except ValueError:
			message_type = SlackMessageType.TEXT
		
		return {
			'channel': channel,
			'message_type': message_type,
			'thread_ts': channel_data.get('thread_ts'),  # For threaded replies
			'username': channel_data.get('username', self.config.bot_name),
			'icon_emoji': channel_data.get('icon_emoji', self.config.bot_icon_emoji),
			'icon_url': channel_data.get('icon_url', self.config.bot_icon_url),
			'unfurl_links': channel_data.get('unfurl_links', self.config.enable_unfurl_links),
			'unfurl_media': channel_data.get('unfurl_media', self.config.enable_unfurl_media),
			'blocks': channel_data.get('blocks', []),
			'attachments': channel_data.get('attachments', []),
			'file_upload': channel_data.get('file_upload'),
			'mentions': channel_data.get('mentions', []),
			'parse': channel_data.get('parse', 'full'),
			'link_names': channel_data.get('link_names', True)
		}
	
	async def _prepare_message_payload(self, message: NotificationMessage, slack_data: Dict[str, Any]) -> Dict[str, Any]:
		"""Prepare Slack API message payload."""
		base_payload = {
			'channel': slack_data['channel'],
			'unfurl_links': slack_data['unfurl_links'],
			'unfurl_media': slack_data['unfurl_media'],
			'parse': slack_data['parse'],
			'link_names': slack_data['link_names']
		}
		
		# Add thread timestamp for replies
		if slack_data['thread_ts']:
			base_payload['thread_ts'] = slack_data['thread_ts']
		
		# Add bot customization
		if slack_data['username']:
			base_payload['username'] = slack_data['username']
		if slack_data['icon_emoji']:
			base_payload['icon_emoji'] = slack_data['icon_emoji']
		if slack_data['icon_url']:
			base_payload['icon_url'] = slack_data['icon_url']
		
		# Handle different message types
		message_type = slack_data['message_type']
		
		if message_type == SlackMessageType.TEXT:
			# Process mentions in text
			text = self._process_mentions(message.content, slack_data['mentions'])
			base_payload['text'] = text
			
		elif message_type == SlackMessageType.BLOCKS:
			if slack_data['blocks']:
				base_payload['blocks'] = slack_data['blocks']
			else:
				# Create simple text block
				base_payload['blocks'] = [
					{
						'type': 'section',
						'text': {
							'type': 'mrkdwn',
							'text': message.content
						}
					}
				]
		
		elif message_type == SlackMessageType.ATTACHMENT:
			if slack_data['attachments']:
				base_payload['attachments'] = slack_data['attachments']
			else:
				# Create simple attachment
				base_payload['attachments'] = [
					{
						'color': self._priority_to_color(message.priority),
						'title': message.title,
						'text': message.content,
						'footer': 'DocuFusion Workflow',
						'ts': int(datetime.now().timestamp())
					}
				]
		
		return {
			'method': 'chat.postMessage',
			'payload': base_payload,
			'message_type': message_type
		}
	
	async def _send_via_slack_api(self, message_data: Dict[str, Any], message: NotificationMessage) -> Dict[str, Any]:
		"""Send message via Slack API."""
		try:
			method = message_data['method']
			payload = message_data['payload']
			
			# Make API request
			api_response = await self._make_api_request(method, payload)
			
			# Check response
			if api_response.get('ok'):
				# Extract message info
				slack_ts = api_response.get('ts')
				slack_channel = api_response.get('channel')
				
				# Store message tracking info
				self._sent_messages[message.id] = {
					'slack_ts': slack_ts,
					'slack_channel': slack_channel,
					'sent_at': datetime.now().isoformat(),
					'message_type': message_data['message_type'].value
				}
				
				return {
					'success': True,
					'tracking_id': slack_ts,
					'provider_response': api_response
				}
			else:
				error_message = api_response.get('error', 'Unknown error')
				return {
					'success': False,
					'error_message': error_message,
					'error_code': f"SLACK_API_ERROR_{error_message.upper()}",
					'provider_response': api_response
				}
			
		except Exception as e:
			return {
				'success': False,
				'error_message': str(e),
				'error_code': 'SLACK_REQUEST_ERROR'
			}
	
	async def _make_api_request(self, method: str, payload: Dict[str, Any]) -> Dict[str, Any]:
		"""Make HTTP request to Slack API."""
		# This would make actual HTTP request to Slack API
		# Placeholder implementation
		
		self.logger.info("Making Slack API request: %s", method)
		self.logger.debug("Payload: %s", json.dumps(payload, indent=2))
		
		# Simulate successful API response
		if method == 'chat.postMessage':
			return {
				'ok': True,
				'channel': payload['channel'],
				'ts': f"{int(datetime.now().timestamp())}.000100",
				'message': {
					'type': 'message',
					'subtype': 'bot_message',
					'text': payload.get('text', ''),
					'ts': f"{int(datetime.now().timestamp())}.000100",
					'username': payload.get('username', 'DocuFusion Bot'),
					'bot_id': 'B1234567890'
				}
			}
		elif method == 'reactions.add':
			return {'ok': True}
		else:
			return {'ok': True, 'result': {}}
	
	def _process_mentions(self, text: str, mentions: List[Dict[str, str]]) -> str:
		"""Process user and channel mentions in text."""
		processed_text = text
		
		for mention in mentions:
			mention_type = mention.get('type', 'user')
			mention_id = mention.get('id')
			mention_text = mention.get('text')
			
			if mention_type == 'user' and mention_id:
				processed_text = processed_text.replace(mention_text, f"<@{mention_id}>")
			elif mention_type == 'channel' and mention_id:
				processed_text = processed_text.replace(mention_text, f"<#{mention_id}>")
			elif mention_type == 'special':
				# Special mentions like @channel, @here
				processed_text = processed_text.replace(mention_text, f"<!{mention_id}>")
		
		return processed_text
	
	def _priority_to_color(self, priority: Priority) -> str:
		"""Convert priority to Slack attachment color."""
		color_map = {
			Priority.CRITICAL: 'danger',
			Priority.HIGH: 'warning',
			Priority.MEDIUM: 'good',
			Priority.LOW: '#808080'
		}
		return color_map.get(priority, 'good')
	
	async def _check_rate_limit(self) -> None:
		"""Check and enforce Slack rate limiting."""
		now = datetime.now()
		
		# Reset counter if window expired
		if (now - self._rate_limit_reset_time).total_seconds() >= self._rate_limit_window:
			self._rate_limit_counter = 0
			self._rate_limit_reset_time = now
		
		# Check rate limit
		if self._rate_limit_counter >= self.config.rate_limit_per_minute:
			wait_time = self._rate_limit_window - (now - self._rate_limit_reset_time).total_seconds()
			if wait_time > 0:
				await asyncio.sleep(wait_time)
				self._rate_limit_counter = 0
				self._rate_limit_reset_time = datetime.now()
		
		self._rate_limit_counter += 1
	
	async def _update_stats(self, result: DeliveryResult, slack_data: Dict[str, Any]) -> None:
		"""Update delivery statistics."""
		self._delivery_stats['total_sent'] += 1
		
		if result.success:
			self._delivery_stats['total_delivered'] += 1
		else:
			self._delivery_stats['total_failed'] += 1
		
		# Track by message type
		message_type = slack_data['message_type'].value
		self._delivery_stats['message_types'][message_type] += 1
		
		# Track by destination type
		channel = slack_data['channel']
		if channel.startswith('#') or channel.startswith('C'):
			self._delivery_stats['destination_types']['channel'] += 1
		elif channel.startswith('@') or channel.startswith('U'):
			self._delivery_stats['destination_types']['direct_message'] += 1
		else:
			self._delivery_stats['destination_types']['group'] += 1


# Utility functions for Slack channel

def create_slack_channel(
	bot_token: str,
	default_channel: Optional[str] = None,
	**kwargs
) -> SlackChannel:
	"""Factory function to create SlackChannel."""
	config = SlackConfiguration(
		bot_token=bot_token,
		default_channel=default_channel,
		**kwargs
	)
	
	return SlackChannel(config)


def create_slack_text_message(
	content: str,
	channel: str,
	mentions: List[Dict[str, str]] = None,
	**kwargs
) -> NotificationMessage:
	"""Create a Slack text message."""
	from ..delivery.notification_delivery import NotificationMessage, Priority
	
	return NotificationMessage(
		title="Slack Message",
		content=content,
		recipient_id=channel,
		channel=getattr(ChannelType, 'SLACK', ChannelType.IN_APP),
		priority=Priority.MEDIUM,
		channel_data={
			'channel': channel,
			'message_type': 'text',
			'mentions': mentions or []
		},
		**kwargs
	)


def create_slack_blocks_message(
	blocks: List[Dict[str, Any]],
	channel: str,
	**kwargs
) -> NotificationMessage:
	"""Create a Slack message with Block Kit blocks."""
	from ..delivery.notification_delivery import NotificationMessage, Priority
	
	return NotificationMessage(
		title="Slack Blocks",
		content="Block Kit message",
		recipient_id=channel,
		channel=getattr(ChannelType, 'SLACK', ChannelType.IN_APP),
		priority=Priority.MEDIUM,
		channel_data={
			'channel': channel,
			'message_type': 'blocks',
			'blocks': blocks
		},
		**kwargs
	)


def create_slack_attachment_message(
	title: str,
	content: str,
	channel: str,
	color: str = 'good',
	fields: List[Dict[str, Any]] = None,
	**kwargs
) -> NotificationMessage:
	"""Create a Slack message with attachment."""
	from ..delivery.notification_delivery import NotificationMessage, Priority
	
	attachments = [
		{
			'color': color,
			'title': title,
			'text': content,
			'fields': fields or [],
			'footer': 'DocuFusion Workflow',
			'ts': int(datetime.now().timestamp())
		}
	]
	
	return NotificationMessage(
		title=title,
		content=content,
		recipient_id=channel,
		channel=getattr(ChannelType, 'SLACK', ChannelType.IN_APP),
		priority=Priority.MEDIUM,
		channel_data={
			'channel': channel,
			'message_type': 'attachment',
			'attachments': attachments
		},
		**kwargs
	)