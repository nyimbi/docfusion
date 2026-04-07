"""
Calendar Integration for Deadline Management

Provides integration with Google Calendar and Microsoft Outlook APIs
for deadline management, event creation, and reminder scheduling.
"""

import asyncio
import base64
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from enum import Enum
from dataclasses import dataclass
import hashlib

from pydantic import BaseModel, Field, ConfigDict

try:
	from uuid_extensions import uuid7str
except ImportError:
	from uuid import uuid4
	def uuid7str() -> str:
		return str(uuid4())


class CalendarProvider(str, Enum):
	"""Supported calendar providers"""
	GOOGLE = "google"
	OUTLOOK = "outlook"
	ICAL = "ical"
	LOCAL = "local"


class ReminderType(str, Enum):
	"""Types of reminders"""
	EMAIL = "email"
	POPUP = "popup"
	SMS = "sms"
	WEBHOOK = "webhook"


class EventStatus(str, Enum):
	"""Status of calendar events"""
	CONFIRMED = "confirmed"
	TENTATIVE = "tentative"
	CANCELLED = "cancelled"


class CalendarEvent(BaseModel):
	"""Calendar event model"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	id: str = Field(default_factory=uuid7str, description="Event ID")
	provider_event_id: str | None = Field(default=None, description="Provider's event ID")
	title: str = Field(description="Event title")
	description: str = Field(default="", description="Event description")
	location: str | None = Field(default=None, description="Event location")
	start_time: datetime = Field(description="Event start time")
	end_time: datetime = Field(description="Event end time")
	all_day: bool = Field(default=False, description="Whether event is all-day")
	timezone: str = Field(default="UTC", description="Event timezone")

	# Reminders
	reminders: List[Dict[str, Any]] = Field(default_factory=list, description="Reminder settings")

	# Metadata
	provider: CalendarProvider = Field(description="Calendar provider")
	status: EventStatus = Field(default=EventStatus.CONFIRMED)
	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)

	# Association
	deadline_id: str | None = Field(default=None, description="Associated deadline ID")
	opportunity_id: str | None = Field(default=None, description="Associated opportunity ID")
	document_id: str | None = Field(default=None, description="Associated document ID")

	# URLs
	html_link: str | None = Field(default=None, description="Link to view event")
	ics_url: str | None = Field(default=None, description="ICS download URL")


class Reminder(BaseModel):
	"""Reminder configuration"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	id: str = Field(default_factory=uuid7str)
	event_id: str = Field(description="Associated event ID")
	reminder_type: ReminderType = Field(description="Type of reminder")
	minutes_before: int = Field(description="Minutes before event to trigger")
	message: str = Field(default="", description="Reminder message")
	delivered: bool = Field(default=False)
	delivered_at: datetime | None = Field(default=None)


class CalendarCredentials(BaseModel):
	"""Calendar API credentials"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	provider: CalendarProvider = Field(description="Calendar provider")
	client_id: str | None = Field(default=None, description="OAuth client ID")
	client_secret: str | None = Field(default=None, description="OAuth client secret")
	access_token: str | None = Field(default=None, description="Access token")
	refresh_token: str | None = Field(default=None, description="Refresh token")
	token_expiry: datetime | None = Field(default=None, description="Token expiry time")
	calendar_id: str | None = Field(default=None, description="Calendar ID")


class CalendarIntegration:
	"""
	Calendar integration for deadline management.

	Supports Google Calendar, Microsoft Outlook, and iCal export.
	"""

	def __init__(self, config: Dict[str, Any] | None = None):
		"""Initialize calendar integration"""
		self.config = config or self._get_default_config()
		self.logger = logging.getLogger(__name__)

		# Provider clients (lazy loaded)
		self._google_client = None
		self._outlook_client = None

		# Event cache
		self._event_cache: Dict[str, CalendarEvent] = {}

		self.logger.info("CalendarIntegration initialized")

	def _get_default_config(self) -> Dict[str, Any]:
		"""Get default configuration"""
		return {
			# Google Calendar settings
			'google_client_id': os.environ.get('GOOGLE_CLIENT_ID'),
			'google_client_secret': os.environ.get('GOOGLE_CLIENT_SECRET'),
			'google_calendar_id': 'primary',

			# Outlook settings
			'outlook_client_id': os.environ.get('OUTLOOK_CLIENT_ID'),
			'outlook_client_secret': os.environ.get('OUTLOOK_CLIENT_SECRET'),
			'outlook_tenant_id': os.environ.get('OUTLOOK_TENENT_ID'),

			# Default reminder settings
			'default_reminders': [
				{'minutes': 1440, 'type': 'email'},   # 1 day before
				{'minutes': 60, 'type': 'popup'},     # 1 hour before
			],

			# Timezone
			'default_timezone': 'UTC',

			# Cache settings
			'cache_events': True,
			'cache_ttl_seconds': 3600,  # 1 hour
		}

	async def create_event(
		self,
		deadline: 'Deadline',
		provider: CalendarProvider = CalendarProvider.GOOGLE,
		calendar_id: str | None = None,
		reminders: List[Dict[str, Any]] | None = None,
		description: str | None = None,
		location: str | None = None,
	) -> CalendarEvent | None:
		"""
		Create a calendar event for a deadline.

		Args:
			deadline: Deadline object to create event for
			provider: Calendar provider to use
			calendar_id: Specific calendar ID (uses default if None)
			reminders: Custom reminder settings
			description: Custom description
			location: Event location

		Returns:
			CalendarEvent if successful, None otherwise
		"""
		try:
			# Build event object
			event = CalendarEvent(
				title=f"[RFP Deadline] {deadline.deadline_type.value.replace('_', ' ').title()}: {deadline.description[:50]}",
				description=description or self._build_event_description(deadline),
				start_time=deadline.date,
				end_time=deadline.date + timedelta(hours=1),
				provider=provider,
				reminders=reminders or self.config['default_reminders'],
				deadline_id=deadline.id,
				opportunity_id=deadline.opportunity_id,
				document_id=deadline.document_id,
				location=location,
				timezone=self.config['default_timezone'],
			)

			# Create event with provider
			if provider == CalendarProvider.GOOGLE:
				created = await self._create_google_event(event, calendar_id)
			elif provider == CalendarProvider.OUTLOOK:
				created = await self._create_outlook_event(event, calendar_id)
			elif provider == CalendarProvider.ICAL:
				# For iCal, just generate the ICS content
				created = self._create_ical_event(event)
			else:
				# Local provider - just store in cache
				created = event
				self._event_cache[event.id] = event

			if created and self.config['cache_events']:
				self._event_cache[created.id] = created

			return created

		except Exception as e:
			self.logger.error(f"Failed to create calendar event: {e}")
			return None

	async def update_event(
		self,
		event_id: str,
		deadline: 'Deadline',
		provider: CalendarProvider = CalendarProvider.GOOGLE,
	) -> CalendarEvent | None:
		"""
		Update an existing calendar event.

		Args:
			event_id: Event ID to update
			deadline: Updated deadline data
			provider: Calendar provider

		Returns:
			Updated CalendarEvent if successful, None otherwise
		"""
		try:
			# Get existing event
			existing = self._event_cache.get(event_id)
			if not existing:
				self.logger.warning(f"Event {event_id} not found in cache")
				return None

			# Update event data
			existing.title = f"[RFP Deadline] {deadline.deadline_type.value.replace('_', ' ').title()}: {deadline.description[:50]}"
			existing.description = self._build_event_description(deadline)
			existing.start_time = deadline.date
			existing.end_time = deadline.date + timedelta(hours=1)
			existing.updated_at = datetime.now()

			# Update with provider
			if provider == CalendarProvider.GOOGLE:
				return await self._update_google_event(existing)
			elif provider == CalendarProvider.OUTLOOK:
				return await self._update_outlook_event(existing)
			else:
				return existing

		except Exception as e:
			self.logger.error(f"Failed to update calendar event: {e}")
			return None

	async def delete_event(
		self,
		event_id: str,
		provider: CalendarProvider = CalendarProvider.GOOGLE,
	) -> bool:
		"""
		Delete a calendar event.

		Args:
			event_id: Event ID to delete
			provider: Calendar provider

		Returns:
			True if successful, False otherwise
		"""
		try:
			event = self._event_cache.get(event_id)

			if provider == CalendarProvider.GOOGLE:
				result = await self._delete_google_event(event_id, event)
			elif provider == CalendarProvider.OUTLOOK:
				result = await self._delete_outlook_event(event_id, event)
			else:
				result = True

			if result and event_id in self._event_cache:
				del self._event_cache[event_id]

			return result

		except Exception as e:
			self.logger.error(f"Failed to delete calendar event: {e}")
			return False

	async def create_reminders(
		self,
		deadline: 'Deadline',
		reminder_times: List[int] | None = None,
		reminder_types: List[ReminderType] | None = None,
	) -> List[Reminder]:
		"""
		Create reminder alerts for a deadline.

		Args:
			deadline: Deadline to create reminders for
			reminder_times: Minutes before deadline for reminders (default: [1440, 60, 15])
			reminder_types: Types of reminders (default: [EMAIL, POPUP, POPUP])

		Returns:
			List of Reminder objects
		"""
		times = reminder_times or [1440, 60, 15]  # 1 day, 1 hour, 15 minutes
		types = reminder_types or [ReminderType.EMAIL, ReminderType.POPUP, ReminderType.POPUP]

		reminders = []
		for i, minutes_before in enumerate(times):
			reminder_type = types[i] if i < len(types) else ReminderType.POPUP

			reminder = Reminder(
				event_id=deadline.id,  # Using deadline ID as event ID reference
				reminder_type=reminder_type,
				minutes_before=minutes_before,
				message=self._build_reminder_message(deadline, minutes_before),
			)
			reminders.append(reminder)

		return reminders

	def get_upcoming_events(
		self,
		days: int = 30,
		provider: CalendarProvider | None = None,
	) -> List[CalendarEvent]:
		"""
		Get upcoming calendar events.

		Args:
			days: Number of days to look ahead
			provider: Filter by provider (optional)

		Returns:
			List of upcoming CalendarEvent objects
		"""
		now = datetime.now()
		end_date = now + timedelta(days=days)

		events = []
		for event in self._event_cache.values():
			# Filter by date range
			if event.start_time < now or event.start_time > end_date:
				continue

			# Filter by provider if specified
			if provider and event.provider != provider:
				continue

			events.append(event)

		# Sort by start time
		events.sort(key=lambda e: e.start_time)
		return events

	def export_to_ical(
		self,
		events: List[CalendarEvent],
		calendar_name: str = "DocFusion Deadlines",
	) -> str:
		"""
		Export events to iCal (ICS) format.

		Args:
			events: List of events to export
			calendar_name: Name for the calendar

		Returns:
			iCal content as string
		"""
		lines = []

		# Calendar header
		lines.append("BEGIN:VCALENDAR")
		lines.append("VERSION:2.0")
		lines.append("PRODID:-//DocFusion//Deadline Intelligence//EN")
		lines.append("CALSCALE:GREGORIAN")
		lines.append("METHOD:PUBLISH")
		lines.append(f"X-WR-CALNAME:{self._escape_ical(calendar_name)}")
		lines.append(f"X-WR-TIMEZONE:{self.config['default_timezone']}")

		# Events
		for event in events:
			lines.extend(self._event_to_ical(event))

		# Calendar footer
		lines.append("END:VCALENDAR")

		return "\r\n".join(lines)

	# Private methods for Google Calendar

	async def _create_google_event(
		self,
		event: CalendarEvent,
		calendar_id: str | None = None,
	) -> CalendarEvent | None:
		"""Create event in Google Calendar"""
		try:
			# Import here to avoid dependency issues
			import httpx

			calendar_id = calendar_id or self.config['google_calendar_id']

			# Get access token (would need OAuth implementation)
			access_token = await self._get_google_access_token()
			if not access_token:
				self.logger.warning("No Google access token available")
				return None

			# Build Google Calendar event body
			event_body = self._build_google_event_body(event)

			# Create event via API
			async with httpx.AsyncClient() as client:
				response = await client.post(
					f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events",
					headers={
						"Authorization": f"Bearer {access_token}",
						"Content-Type": "application/json",
					},
					json=event_body,
				)

				if response.status_code == 200:
					data = response.json()
					event.provider_event_id = data.get("id")
					event.html_link = data.get("htmlLink")
					event.status = EventStatus.CONFIRMED
					return event
				else:
					self.logger.error(f"Google Calendar API error: {response.status_code}")
					return None

		except ImportError:
			self.logger.warning("httpx not available for Google Calendar integration")
			return None
		except Exception as e:
			self.logger.error(f"Failed to create Google Calendar event: {e}")
			return None

	async def _update_google_event(self, event: CalendarEvent) -> CalendarEvent | None:
		"""Update event in Google Calendar"""
		try:
			import httpx

			access_token = await self._get_google_access_token()
			if not access_token or not event.provider_event_id:
				return None

			event_body = self._build_google_event_body(event)

			async with httpx.AsyncClient() as client:
				response = await client.put(
					f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event.provider_event_id}",
					headers={
						"Authorization": f"Bearer {access_token}",
						"Content-Type": "application/json",
					},
					json=event_body,
				)

				if response.status_code == 200:
					return event
				else:
					self.logger.error(f"Google Calendar update error: {response.status_code}")
					return None

		except Exception as e:
			self.logger.error(f"Failed to update Google Calendar event: {e}")
			return None

	async def _delete_google_event(
		self,
		event_id: str,
		event: CalendarEvent | None,
	) -> bool:
		"""Delete event from Google Calendar"""
		try:
			import httpx

			access_token = await self._get_google_access_token()
			if not access_token or not event or not event.provider_event_id:
				return True  # Assume success if no provider event

			async with httpx.AsyncClient() as client:
				response = await client.delete(
					f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event.provider_event_id}",
					headers={"Authorization": f"Bearer {access_token}"},
				)

				return response.status_code in (200, 204, 404)

		except Exception as e:
			self.logger.error(f"Failed to delete Google Calendar event: {e}")
			return False

	async def _get_google_access_token(self) -> str | None:
		"""Get Google OAuth access token"""
		# This would need full OAuth implementation
		# For now, check environment variable
		return os.environ.get("GOOGLE_ACCESS_TOKEN")

	def _build_google_event_body(self, event: CalendarEvent) -> Dict[str, Any]:
		"""Build Google Calendar event body"""
		return {
			"summary": event.title,
			"description": event.description,
			"start": {
				"dateTime": event.start_time.isoformat(),
				"timeZone": event.timezone,
			},
			"end": {
				"dateTime": event.end_time.isoformat(),
				"timeZone": event.timezone,
			},
			"reminders": {
				"useDefault": False,
				"overrides": [
					{"method": r["type"], "minutes": r["minutes"]}
					for r in event.reminders
				],
			},
			"extendedProperties": {
				"private": {
					"deadlineId": event.deadline_id or "",
					"opportunityId": event.opportunity_id or "",
					"source": "docfusion",
				},
			},
		}

	# Private methods for Outlook Calendar

	async def _create_outlook_event(
		self,
		event: CalendarEvent,
		calendar_id: str | None = None,
	) -> CalendarEvent | None:
		"""Create event in Microsoft Outlook"""
		try:
			import httpx

			access_token = await self._get_outlook_access_token()
			if not access_token:
				self.logger.warning("No Outlook access token available")
				return None

			event_body = self._build_outlook_event_body(event)

			async with httpx.AsyncClient() as client:
				response = await client.post(
					"https://graph.microsoft.com/v1.0/me/events",
					headers={
						"Authorization": f"Bearer {access_token}",
						"Content-Type": "application/json",
					},
					json=event_body,
				)

				if response.status_code == 201:
					data = response.json()
					event.provider_event_id = data.get("id")
					event.html_link = data.get("webLink")
					event.status = EventStatus.CONFIRMED
					return event
				else:
					self.logger.error(f"Outlook API error: {response.status_code}")
					return None

		except ImportError:
			self.logger.warning("httpx not available for Outlook integration")
			return None
		except Exception as e:
			self.logger.error(f"Failed to create Outlook event: {e}")
			return None

	async def _update_outlook_event(self, event: CalendarEvent) -> CalendarEvent | None:
		"""Update event in Microsoft Outlook"""
		try:
			import httpx

			access_token = await self._get_outlook_access_token()
			if not access_token or not event.provider_event_id:
				return None

			event_body = self._build_outlook_event_body(event)

			async with httpx.AsyncClient() as client:
				response = await client.patch(
					f"https://graph.microsoft.com/v1.0/me/events/{event.provider_event_id}",
					headers={
						"Authorization": f"Bearer {access_token}",
						"Content-Type": "application/json",
					},
					json=event_body,
				)

				if response.status_code == 200:
					return event
				else:
					self.logger.error(f"Outlook update error: {response.status_code}")
					return None

		except Exception as e:
			self.logger.error(f"Failed to update Outlook event: {e}")
			return None

	async def _delete_outlook_event(
		self,
		event_id: str,
		event: CalendarEvent | None,
	) -> bool:
		"""Delete event from Microsoft Outlook"""
		try:
			import httpx

			access_token = await self._get_outlook_access_token()
			if not access_token or not event or not event.provider_event_id:
				return True

			async with httpx.AsyncClient() as client:
				response = await client.delete(
					f"https://graph.microsoft.com/v1.0/me/events/{event.provider_event_id}",
					headers={"Authorization": f"Bearer {access_token}"},
				)

				return response.status_code in (204, 404)

		except Exception as e:
			self.logger.error(f"Failed to delete Outlook event: {e}")
			return False

	async def _get_outlook_access_token(self) -> str | None:
		"""Get Microsoft OAuth access token"""
		# This would need full OAuth implementation
		return os.environ.get("OUTLOOK_ACCESS_TOKEN")

	def _build_outlook_event_body(self, event: CalendarEvent) -> Dict[str, Any]:
		"""Build Outlook event body"""
		return {
			"subject": event.title,
			"body": {
				"contentType": "HTML",
				"content": event.description,
			},
			"start": {
				"dateTime": event.start_time.isoformat(),
				"timeZone": event.timezone,
			},
			"end": {
				"dateTime": event.end_time.isoformat(),
				"timeZone": event.timezone,
			},
			"location": {
				"displayName": event.location or "Online",
			},
			"reminderMinutesBeforeStart": min(
				r["minutes"] for r in event.reminders
			) if event.reminders else 1440,
		}

	# iCal generation

	def _create_ical_event(self, event: CalendarEvent) -> CalendarEvent:
		"""Create iCal event (no external API needed)"""
		# Generate ICS content
		event.ics_url = f"data:text/calendar;charset=utf-8,{self._event_to_ical_url(event)}"
		return event

	def _event_to_ical(self, event: CalendarEvent) -> List[str]:
		"""Convert event to iCal format lines"""
		lines = []
		lines.append("BEGIN:VEVENT")
		lines.append(f"UID:{event.id}@docfusion")
		lines.append(f"DTSTAMP:{self._format_ical_datetime(datetime.now())}")
		lines.append(f"DTSTART:{self._format_ical_datetime(event.start_time)}")
		lines.append(f"DTEND:{self._format_ical_datetime(event.end_time)}")
		lines.append(f"SUMMARY:{self._escape_ical(event.title)}")
		lines.append(f"DESCRIPTION:{self._escape_ical(event.description)}")

		if event.location:
			lines.append(f"LOCATION:{self._escape_ical(event.location)}")

		# Add reminders as VALARM
		for reminder in event.reminders:
			lines.append("BEGIN:VALARM")
			lines.append(f"TRIGGER:-PT{reminder['minutes']}M")
			lines.append(f"ACTION:{reminder.get('type', 'DISPLAY').upper()}")
			lines.append(f"DESCRIPTION:{self._escape_ical(event.title)}")
			lines.append("END:VALARM")

		lines.append("END:VEVENT")
		return lines

	def _event_to_ical_url(self, event: CalendarEvent) -> str:
		"""Convert event to URL-encoded iCal"""
		ics_content = self.export_to_ical([event])
		return base64.b64encode(ics_content.encode()).decode()

	# Helper methods

	def _build_event_description(self, deadline: 'Deadline') -> str:
		"""Build event description from deadline"""
		lines = [
			f"Deadline Type: {deadline.deadline_type.value.replace('_', ' ').title()}",
			f"Date: {deadline.date.strftime('%B %d, %Y at %I:%M %p')}",
			f"Status: {deadline.status.value.title()}",
			f"Priority: {deadline.priority.value.title()}",
		]

		if deadline.description:
			lines.append(f"\nDescription:\n{deadline.description}")

		if deadline.source_text:
			lines.append(f"\nSource Text:\n{deadline.source_text[:500]}")

		if deadline.days_remaining >= 0:
			lines.append(f"\nDays Remaining: {deadline.days_remaining}")
		else:
			lines.append(f"\nDays Overdue: {abs(deadline.days_remaining)}")

		lines.append("\n---")
		lines.append("Generated by DocFusion Deadline Intelligence")

		return "\n".join(lines)

	def _build_reminder_message(self, deadline: 'Deadline', minutes_before: int) -> str:
		"""Build reminder message for deadline"""
		if minutes_before >= 1440:
			time_desc = f"{minutes_before // 1440} day(s)"
		elif minutes_before >= 60:
			time_desc = f"{minutes_before // 60} hour(s)"
		else:
			time_desc = f"{minutes_before} minute(s)"

		return (
			f"Reminder: {deadline.deadline_type.value.replace('_', ' ').title()} deadline "
			f"is in {time_desc}. "
			f"Due: {deadline.date.strftime('%B %d, %Y at %I:%M %p')}"
		)

	def _format_ical_datetime(self, dt: datetime) -> str:
		"""Format datetime for iCal"""
		return dt.strftime("%Y%m%dT%H%M%SZ")

	def _escape_ical(self, text: str) -> str:
		"""Escape text for iCal format"""
		return (
			text.replace("\\", "\\\\")
			.replace(";", "\\;")
			.replace(",", "\\,")
			.replace("\n", "\\n")
			.replace("\r", "")
		)


# Module-level exports
__all__ = [
	'CalendarProvider',
	'ReminderType',
	'EventStatus',
	'CalendarEvent',
	'Reminder',
	'CalendarCredentials',
	'CalendarIntegration',
]


# Import Deadline type for type hints (avoid circular import)
from .deadline_parser import Deadline