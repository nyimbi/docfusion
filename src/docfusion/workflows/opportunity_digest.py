"""
Opportunity Digest Workflows

Temporal workflows for scheduled opportunity processing and notifications.
Sends daily morning emails with new opportunities matching user interests.

Uses:
- Stalwart Mail (mail.lindela.io) for email delivery
- SearXNG for opportunity discovery
- LiteLLM for content analysis

Configuration via environment variables:
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
- All secrets managed through SecretsManager
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional
import smtplib

logger = logging.getLogger(__name__)

# Email configuration - all secrets via SecretsManager, no hardcoded defaults
from ..config.secrets import SecretsManager

SMTP_HOST = SecretsManager.get_smtp_host()
SMTP_PORT = SecretsManager.get_smtp_port()
SMTP_USER = SecretsManager.get_smtp_user()
SMTP_PASSWORD = SecretsManager.get_smtp_password()
SMTP_FROM = SecretsManager.get_smtp_from_address()


# ============================================================================
# Workflow Request/Response Models
# ============================================================================

@dataclass
class OpportunityDigest:
	"""Digest of opportunities for a user."""

	user_id: str
	user_email: str
	user_name: str
	opportunities: List[Dict[str, Any]]
	digest_date: datetime
	summary: str = ""
	total_count: int = 0
	new_count: int = 0


@dataclass
class SendDigestRequest:
	"""Request to send opportunity digest."""

	user_id: str
	user_email: str
	user_name: str
	user_interests: List[str] = field(default_factory=list)
	search_queries: List[str] = field(default_factory=list)
	days_lookback: int = 1
	send_even_if_empty: bool = False


@dataclass
class ScheduleDigestRequest:
	"""Request to schedule daily digest."""

	cron_schedule: str = "0 8 * * *"  # 8 AM daily
	user_id: str = ""
	user_email: str = ""
	user_name: str = ""
	user_interests: List[str] = field(default_factory=list)


@dataclass
class DigestResult:
	"""Result of digest processing."""

	success: bool
	user_id: str
	email_sent: bool
	opportunities_found: int
	error_message: str = ""


# ============================================================================
# Email Service
# ============================================================================

class EmailService:
	"""Service for sending emails via Stalwart Mail."""

	def __init__(
		self,
		host: str = SMTP_HOST,
		port: int = SMTP_PORT,
		user: str = SMTP_USER,
		password: str = SMTP_PASSWORD,
		from_addr: str = SMTP_FROM,
	):
		self.host = host
		self.port = port
		self.user = user
		self.password = password
		self.from_addr = from_addr
		self.logger = logging.getLogger(__name__)

	async def send_email(
		self,
		to: str,
		subject: str,
		html_body: str,
		text_body: Optional[str] = None,
	) -> bool:
		"""
		Send email via SMTP.

		Args:
			to: Recipient email address
			subject: Email subject
			html_body: HTML email body
			text_body: Optional plain text body

		Returns:
			True if sent successfully
		"""
		try:
			# Create message
			msg = MIMEMultipart("alternative")
			msg["Subject"] = subject
			msg["From"] = self.from_addr
			msg["To"] = to

			# Add text body if provided
			if text_body:
				msg.attach(MIMEText(text_body, "plain"))

			# Add HTML body
			msg.attach(MIMEText(html_body, "html"))

			# Send email
			with smtplib.SMTP(self.host, self.port) as server:
				server.starttls()
				server.login(self.user, self.password)
				server.sendmail(self.from_addr, to, msg.as_string())

			self.logger.info(f"Email sent to {to}: {subject}")
			return True

		except Exception as e:
			self.logger.error(f"Failed to send email to {to}: {e}")
			return False


# ============================================================================
# Opportunity Discovery
# ============================================================================

class OpportunityDiscovery:
	"""Discover opportunities from SearXNG searches."""

	def __init__(self, searxng_client=None, firecrawl_client=None):
		self.searxng_client = searxng_client
		self.firecrawl_client = firecrawl_client
		self.logger = logging.getLogger(__name__)

	async def discover_opportunities(
		self,
		interests: List[str],
		search_queries: Optional[List[str]] = None,
		days_lookback: int = 1,
		limit: int = 20,
	) -> List[Dict[str, Any]]:
		"""
		Discover opportunities matching user interests.

		Args:
			interests: User's interest areas
			search_queries: Custom search queries
			days_lookback: Days to look back
			limit: Maximum results

		Returns:
			List of discovered opportunities
		"""
		opportunities = []
		seen_urls = set()

		# Build search queries from interests
		queries = search_queries or []
		if not queries:
			for interest in interests[:5]:  # Limit to 5 interests
				queries.append(f"{interest} opportunity RFP proposal 2026")

		# Time range filter
		time_range = "day" if days_lookback <= 1 else f"{days_lookback}d"

		for query in queries:
			try:
				if self.searxng_client:
					results = await self.searxng_client.search(
						query=query,
						time_range=time_range,
						limit=min(limit // len(queries) + 1, 10),
					)

					for result in results.results:
						if result.url not in seen_urls:
							seen_urls.add(result.url)
							opportunities.append({
								"title": result.title,
								"url": result.url,
								"snippet": result.content[:500] if result.content else "",
								"source": result.engine,
								"relevance": result.score if hasattr(result, "score") else 0.5,
								"found_at": datetime.now(timezone.utc).isoformat(),
							})
				else:
					self.logger.warning("SearXNG client not available")

			except Exception as e:
				self.logger.error(f"Search failed for query '{query}': {e}")

		# Sort by relevance
		opportunities.sort(key=lambda x: x.get("relevance", 0), reverse=True)

		return opportunities[:limit]


# ============================================================================
# Digest Workflow Activities
# ============================================================================

class DigestActivities:
	"""Activities for opportunity digest workflow."""

	def __init__(
		self,
		email_service: Optional[EmailService] = None,
		discovery: Optional[OpportunityDiscovery] = None,
	):
		self.email_service = email_service or EmailService()
		self.discovery = discovery
		self.logger = logging.getLogger(__name__)

	async def discover_opportunities(
		self,
		user_interests: List[str],
		search_queries: List[str],
		days_lookback: int,
	) -> List[Dict[str, Any]]:
		"""Activity: Discover opportunities."""
		if not self.discovery:
			return []

		return await self.discovery.discover_opportunities(
			interests=user_interests,
			search_queries=search_queries,
			days_lookback=days_lookback,
		)

	async def generate_summary(
		self,
		opportunities: List[Dict[str, Any]],
		user_interests: List[str],
	) -> str:
		"""Activity: Generate summary using LiteLLM."""
		# Placeholder - in production would call LiteLLM
		count = len(opportunities)
		if count == 0:
			return "No new opportunities found today."

		return f"Found {count} new opportunities matching your interests in: {', '.join(user_interests[:3])}"

	async def send_digest_email(
		self,
		user_email: str,
		user_name: str,
		opportunities: List[Dict[str, Any]],
		summary: str,
	) -> bool:
		"""Activity: Send digest email."""
		# Build HTML email
		html = self._build_html_email(user_name, opportunities, summary)
		text = self._build_text_email(user_name, opportunities, summary)

		subject = f"Your Daily Opportunities Digest - {datetime.now().strftime('%B %d, %Y')}"

		return await self.email_service.send_email(
			to=user_email,
			subject=subject,
			html_body=html,
			text_body=text,
		)

	def _build_html_email(
		self,
		user_name: str,
		opportunities: List[Dict[str, Any]],
		summary: str,
	) -> str:
		"""Build HTML email body."""
		items = ""
		for opp in opportunities[:10]:
			items += f"""
			<div style="margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
				<h3 style="margin: 0 0 10px 0;">
					<a href="{opp['url']}" style="color: #2563eb; text-decoration: none;">{opp['title']}</a>
				</h3>
				<p style="margin: 0; color: #666;">{opp['snippet'][:200]}...</p>
				<p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">Source: {opp.get('source', 'Unknown')}</p>
			</div>
			"""

		return f"""
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<style>
				body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }}
				h1 {{ color: #1f2937; }}
				.summary {{ background: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0; }}
			</style>
		</head>
		<body>
			<h1>Good morning, {user_name}!</h1>
			<p>Here's your daily digest of opportunities:</p>
			<div class="summary">
				<strong>Summary:</strong> {summary}
			</div>
			<h2>Today's Opportunities ({len(opportunities)} found)</h2>
			{items}
			<p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
				You're receiving this because you subscribed to opportunity alerts.
				<a href="#">Manage preferences</a> | <a href="#">Unsubscribe</a>
			</p>
		</body>
		</html>
		"""

	def _build_text_email(
		self,
		user_name: str,
		opportunities: List[Dict[str, Any]],
		summary: str,
	) -> str:
		"""Build plain text email body."""
		items = "\n\n".join([
			f"- {opp['title']}\n  {opp['url']}\n  {opp['snippet'][:100]}..."
			for opp in opportunities[:10]
		])

		return f"""
Good morning, {user_name}!

Here's your daily digest of opportunities:

SUMMARY: {summary}

TODAY'S OPPORTUNITIES ({len(opportunities)} found)
{items}

---
You're receiving this because you subscribed to opportunity alerts.
Manage preferences | Unsubscribe
"""


# ============================================================================
# Workflow Definitions
# ============================================================================

async def send_opportunity_digest(
	request: SendDigestRequest,
	searxng_client=None,
	firecrawl_client=None,
) -> DigestResult:
	"""
	Send opportunity digest to a user.

	This is the main workflow function that can be called directly
	or scheduled as a Temporal workflow.

	Args:
		request: Digest request with user info and preferences
		searxng_client: Optional SearXNG client for discovery
		firecrawl_client: Optional Firecrawl client for scraping

	Returns:
		DigestResult with processing status
	"""
	logger.info(f"Starting opportunity digest for user {request.user_id}")

	# Initialize services
	email_service = EmailService()
	discovery = OpportunityDiscovery(searxng_client, firecrawl_client)
	activities = DigestActivities(email_service, discovery)

	try:
		# Discover opportunities
		opportunities = await activities.discover_opportunities(
			user_interests=request.user_interests,
			search_queries=request.search_queries,
			days_lookback=request.days_lookback,
		)

		logger.info(f"Found {len(opportunities)} opportunities for user {request.user_id}")

		# Skip if empty and not requested
		if len(opportunities) == 0 and not request.send_even_if_empty:
			logger.info(f"No opportunities found, skipping email for user {request.user_id}")
			return DigestResult(
				success=True,
				user_id=request.user_id,
				email_sent=False,
				opportunities_found=0,
			)

		# Generate summary
		summary = await activities.generate_summary(
			opportunities=opportunities,
			user_interests=request.user_interests,
		)

		# Send email
		email_sent = await activities.send_digest_email(
			user_email=request.user_email,
			user_name=request.user_name,
			opportunities=opportunities,
			summary=summary,
		)

		return DigestResult(
			success=True,
			user_id=request.user_id,
			email_sent=email_sent,
			opportunities_found=len(opportunities),
		)

	except Exception as e:
		logger.error(f"Digest workflow failed for user {request.user_id}: {e}")
		return DigestResult(
			success=False,
			user_id=request.user_id,
			email_sent=False,
			opportunities_found=0,
			error_message=str(e),
		)


async def schedule_daily_digest(
	request: ScheduleDigestRequest,
	temporal_client=None,
) -> Dict[str, Any]:
	"""
	Schedule daily opportunity digest workflow.

	Args:
		request: Schedule request with user info
		temporal_client: Optional Temporal client for scheduling

	Returns:
		Schedule confirmation
	"""
	if temporal_client:
		# Schedule via Temporal
		try:
			await temporal_client.schedule_workflow(
				workflow=send_opportunity_digest,
				cron_schedule=request.cron_schedule,
				workflow_id=f"daily-digest-{request.user_id}",
			)
			return {
				"scheduled": True,
				"workflow_id": f"daily-digest-{request.user_id}",
				"cron": request.cron_schedule,
			}
		except Exception as e:
			logger.error(f"Failed to schedule Temporal workflow: {e}")

	# Fallback: Return configuration for external scheduler
	return {
		"scheduled": False,
		"config": {
			"workflow": "send_opportunity_digest",
			"cron": request.cron_schedule,
			"user_id": request.user_id,
			"user_email": request.user_email,
		},
		"message": "Configure external scheduler to call send_opportunity_digest",
	}
