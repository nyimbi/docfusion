"""
Notification Channels Module

Provides comprehensive multi-channel notification delivery supporting:
- Email (SMTP, SendGrid, AWS SES, Mailgun, Postmark)
- SMS (Twilio, AWS SNS, Nexmo, MessageBird, Plivo)
- Push notifications (iOS APNS, Android FCM, Web Push)
- In-app notifications (WebSocket, persistent storage)
- WhatsApp Business API
- Telegram Bot API
- Slack API
- Generic webhooks
- And all major communication platforms
"""

# Core channel implementations
from .email_channel import (
	EmailChannel,
	EmailConfiguration,
	EmailTemplate,
	EmailAttachment,
	EmailProvider,
	create_email_channel,
	create_default_email_template,
	create_email_attachment
)

from .sms_channel import (
	SMSChannel,
	SMSConfiguration,
	SMSProvider,
	create_sms_channel,
	create_twilio_sms_channel,
	validate_phone_number,
	format_phone_number
)

from .push_channel import (
	PushChannel,
	PushConfiguration,
	PushPlatform
)

from .inapp_channel import (
	InAppChannel,
	InAppConfiguration,
	InAppNotificationType,
	create_inapp_channel,
	create_toast_notification,
	create_modal_notification
)

from .whatsapp_channel import (
	WhatsAppChannel,
	WhatsAppConfiguration,
	WhatsAppMessageType,
	create_whatsapp_channel,
	create_whatsapp_text_message,
	create_whatsapp_template_message,
	create_whatsapp_interactive_message
)

from .telegram_channel import (
	TelegramChannel,
	TelegramConfiguration,
	TelegramParseMode,
	create_telegram_channel,
	create_telegram_text_message,
	create_telegram_photo_message,
	create_telegram_keyboard_message
)

from .slack_channel import (
	SlackChannel,
	SlackConfiguration,
	SlackMessageType,
	create_slack_channel,
	create_slack_text_message,
	create_slack_blocks_message,
	create_slack_attachment_message
)

from .webhook_channel import (
	WebhookChannel,
	WebhookConfiguration,
	WebhookAuthType,
	WebhookMethod,
	create_webhook_channel,
	create_webhook_message,
	create_authenticated_webhook_channel,
	create_hmac_webhook_channel
)

__all__ = [
	# Email
	'EmailChannel',
	'EmailConfiguration', 
	'EmailTemplate',
	'EmailAttachment',
	'EmailProvider',
	'create_email_channel',
	'create_default_email_template',
	'create_email_attachment',
	
	# SMS
	'SMSChannel',
	'SMSConfiguration',
	'SMSProvider',
	'create_sms_channel',
	'create_twilio_sms_channel',
	'validate_phone_number',
	'format_phone_number',
	
	# Push
	'PushChannel',
	'PushConfiguration',
	'PushPlatform',
	
	# In-App
	'InAppChannel',
	'InAppConfiguration',
	'InAppNotificationType',
	'create_inapp_channel',
	'create_toast_notification',
	'create_modal_notification',
	
	# WhatsApp
	'WhatsAppChannel',
	'WhatsAppConfiguration',
	'WhatsAppMessageType',
	'create_whatsapp_channel',
	'create_whatsapp_text_message',
	'create_whatsapp_template_message',
	'create_whatsapp_interactive_message',
	
	# Telegram
	'TelegramChannel',
	'TelegramConfiguration',
	'TelegramParseMode',
	'create_telegram_channel',
	'create_telegram_text_message',
	'create_telegram_photo_message',
	'create_telegram_keyboard_message',
	
	# Slack
	'SlackChannel',
	'SlackConfiguration',
	'SlackMessageType',
	'create_slack_channel',
	'create_slack_text_message',
	'create_slack_blocks_message',
	'create_slack_attachment_message',
	
	# Webhook
	'WebhookChannel',
	'WebhookConfiguration',
	'WebhookAuthType',
	'WebhookMethod',
	'create_webhook_channel',
	'create_webhook_message',
	'create_authenticated_webhook_channel',
	'create_hmac_webhook_channel'
]