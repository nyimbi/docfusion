"""
PriorityManager - Week 20 Intelligent Notification Prioritization System

Implements sophisticated notification prioritization with machine learning-based
importance scoring, user preference learning, context-aware ranking, and
adaptive priority adjustment based on user behavior and workflow patterns.
"""

import asyncio
import logging
import math

# from uuid_extensions import uuid7str
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple


def uuid7str() -> str:
    """Generate UUID7-style string (fallback implementation)."""
    return str(uuid.uuid4())


from pydantic import BaseModel, ConfigDict, Field, validator
from pydantic.types import confloat, conint


class PriorityLevel(str, Enum):
    """Notification priority levels with semantic meaning."""

    CRITICAL = "critical"  # System alerts, failures, urgent deadlines
    HIGH = "high"  # Important updates, approaching deadlines
    MEDIUM = "medium"  # Regular workflow updates, status changes
    LOW = "low"  # Informational updates, minor changes
    VERY_LOW = "very_low"  # Background updates, system maintenance


class ImportanceContext(str, Enum):
    """Context types that influence notification importance."""

    DEADLINE_CRITICAL = "deadline_critical"  # Near deadline, high impact
    WORKFLOW_BLOCKING = "workflow_blocking"  # Blocking other work
    STAKEHOLDER_PRIORITY = "stakeholder_priority"  # High-priority stakeholder
    REVENUE_IMPACT = "revenue_impact"  # Financial implications
    COMPLIANCE_RISK = "compliance_risk"  # Regulatory compliance
    COLLABORATION_URGENT = "collaboration_urgent"  # Team collaboration needed
    ERROR_RECOVERY = "error_recovery"  # System error recovery
    MILESTONE_CRITICAL = "milestone_critical"  # Project milestone
    SECURITY_ALERT = "security_alert"  # Security-related
    PERFORMANCE_ALERT = "performance_alert"  # Performance degradation


@dataclass
class UserPreferenceProfile:
    """User notification preference learning profile."""

    user_id: str

    # Interaction patterns
    open_rate_by_priority: Dict[PriorityLevel, float] = field(default_factory=dict)
    response_time_by_priority: Dict[PriorityLevel, float] = field(default_factory=dict)
    action_rate_by_context: Dict[ImportanceContext, float] = field(default_factory=dict)

    # Time-based preferences
    active_hours: List[int] = field(
        default_factory=list
    )  # Hours when user is most active
    preferred_channels_by_priority: Dict[PriorityLevel, List[str]] = field(
        default_factory=dict
    )
    quiet_hours: Optional[Tuple[int, int]] = None  # (start_hour, end_hour)

    # Content preferences
    keyword_importance_weights: Dict[str, float] = field(default_factory=dict)
    context_importance_weights: Dict[ImportanceContext, float] = field(
        default_factory=dict
    )

    # Behavioral metrics
    total_notifications_received: int = 0
    total_notifications_opened: int = 0
    total_notifications_acted_upon: int = 0
    average_response_time_minutes: float = 0.0

    # Learning metadata
    last_updated: datetime = field(default_factory=datetime.now)
    profile_confidence: float = 0.0  # 0.0 to 1.0, higher = more data
    learning_iterations: int = 0


class NotificationMetadata(BaseModel):
    """Rich metadata for priority calculation."""

    model_config = ConfigDict(extra="forbid", validate_by_name=True)

    # Basic information
    notification_id: str = Field(..., description="Unique notification identifier")
    user_id: str = Field(..., description="Target user identifier")
    created_at: datetime = Field(default_factory=datetime.now)

    # Content analysis
    title_keywords: List[str] = Field(
        default_factory=list, description="Extracted title keywords"
    )
    content_keywords: List[str] = Field(
        default_factory=list, description="Extracted content keywords"
    )
    sentiment_score: confloat(ge=-1.0, le=1.0) = Field(
        0.0, description="Content sentiment (-1 to 1)"
    )
    urgency_keywords: List[str] = Field(
        default_factory=list, description="Urgency indicator words"
    )

    # Context information
    workflow_id: Optional[str] = Field(None, description="Associated workflow")
    workflow_stage: Optional[str] = Field(None, description="Current workflow stage")
    project_id: Optional[str] = Field(None, description="Associated project")
    deadline_timestamp: Optional[datetime] = Field(None, description="Related deadline")
    stakeholder_priority: Optional[str] = Field(
        None, description="Stakeholder priority level"
    )

    # Business impact
    revenue_impact_estimate: Optional[float] = Field(
        None, description="Estimated revenue impact"
    )
    compliance_risk_level: confloat(ge=0.0, le=1.0) = Field(
        0.0, description="Compliance risk (0-1)"
    )
    blocking_dependencies: List[str] = Field(
        default_factory=list, description="IDs of blocked items"
    )

    # Temporal context
    time_sensitivity_hours: Optional[int] = Field(
        None, description="Time sensitivity window"
    )
    escalation_threshold_minutes: Optional[int] = Field(
        None, description="Auto-escalation time"
    )
    optimal_delivery_window: Optional[Tuple[int, int]] = Field(
        None, description="Best delivery hours"
    )

    # Collaboration context
    requires_immediate_response: bool = Field(
        False, description="Needs immediate response"
    )
    involves_external_stakeholders: bool = Field(
        False, description="External parties involved"
    )
    team_size_affected: int = Field(1, description="Number of people affected")

    # System context
    importance_contexts: List[ImportanceContext] = Field(default_factory=list)
    custom_priority_override: Optional[PriorityLevel] = Field(
        None, description="Manual priority override"
    )

    @validator("optimal_delivery_window")
    def validate_delivery_window(cls, v):
        """Validate delivery window hours."""
        if v and (v[0] < 0 or v[0] > 23 or v[1] < 0 or v[1] > 23):
            raise ValueError("Delivery window hours must be between 0 and 23")
        return v


class PriorityScore(BaseModel):
    """Comprehensive priority scoring result."""

    model_config = ConfigDict(extra="forbid")

    notification_id: str = Field(..., description="Notification identifier")
    user_id: str = Field(..., description="Target user identifier")

    # Core scoring
    base_priority: PriorityLevel = Field(..., description="Initial priority level")
    calculated_score: confloat(ge=0.0, le=1.0) = Field(
        ..., description="ML-calculated priority score"
    )
    final_priority: PriorityLevel = Field(
        ..., description="Final priority after adjustments"
    )

    # Score components
    content_score: confloat(ge=0.0, le=1.0) = Field(
        0.0, description="Content-based importance"
    )
    context_score: confloat(ge=0.0, le=1.0) = Field(
        0.0, description="Context-based importance"
    )
    temporal_score: confloat(ge=0.0, le=1.0) = Field(
        0.0, description="Time-sensitive importance"
    )
    user_preference_score: confloat(ge=0.0, le=1.0) = Field(
        0.0, description="User preference alignment"
    )
    business_impact_score: confloat(ge=0.0, le=1.0) = Field(
        0.0, description="Business impact weight"
    )

    # Adjustments
    time_decay_factor: confloat(ge=0.0, le=1.0) = Field(
        1.0, description="Time-based priority decay"
    )
    user_activity_multiplier: confloat(ge=0.1, le=3.0) = Field(
        1.0, description="User activity adjustment"
    )
    load_balancing_adjustment: confloat(ge=0.1, le=2.0) = Field(
        1.0, description="System load adjustment"
    )

    # Metadata
    calculation_timestamp: datetime = Field(default_factory=datetime.now)
    confidence_level: confloat(ge=0.0, le=1.0) = Field(
        0.5, description="Calculation confidence"
    )
    reasoning: List[str] = Field(
        default_factory=list, description="Priority reasoning factors"
    )


class PriorityManager:
    """
    Intelligent notification prioritization system with ML-based importance scoring.

    Provides sophisticated priority management including:
    - Machine learning-based importance scoring
    - User preference learning and adaptation
    - Context-aware priority calculation
    - Temporal priority decay and escalation
    - Business impact assessment
    - Load balancing and optimization
    - Real-time priority adjustment
    """

    def __init__(
        self,
        learning_enabled: bool = True,
        adaptive_thresholds: bool = True,
        max_user_profiles: int = 10000,
        priority_refresh_interval: int = 300,  # 5 minutes
        analytics_enabled: bool = True,
    ):
        self.learning_enabled = learning_enabled
        self.adaptive_thresholds = adaptive_thresholds
        self.max_user_profiles = max_user_profiles
        self.priority_refresh_interval = priority_refresh_interval
        self.analytics_enabled = analytics_enabled

        # User preference profiles
        self._user_profiles: Dict[str, UserPreferenceProfile] = {}
        self._profile_update_queue: asyncio.Queue = asyncio.Queue()

        # Priority calculation cache
        self._priority_cache: Dict[str, PriorityScore] = {}
        self._cache_expiry: Dict[str, datetime] = {}

        # Priority thresholds (adaptive)
        self._priority_thresholds = {
            PriorityLevel.CRITICAL: 0.9,
            PriorityLevel.HIGH: 0.7,
            PriorityLevel.MEDIUM: 0.4,
            PriorityLevel.LOW: 0.2,
            PriorityLevel.VERY_LOW: 0.0,
        }

        # Context importance weights
        self._context_weights = {
            ImportanceContext.DEADLINE_CRITICAL: 0.95,
            ImportanceContext.WORKFLOW_BLOCKING: 0.9,
            ImportanceContext.SECURITY_ALERT: 0.95,
            ImportanceContext.REVENUE_IMPACT: 0.85,
            ImportanceContext.COMPLIANCE_RISK: 0.8,
            ImportanceContext.STAKEHOLDER_PRIORITY: 0.75,
            ImportanceContext.MILESTONE_CRITICAL: 0.7,
            ImportanceContext.ERROR_RECOVERY: 0.8,
            ImportanceContext.COLLABORATION_URGENT: 0.6,
            ImportanceContext.PERFORMANCE_ALERT: 0.5,
        }

        # Urgency keywords with weights
        self._urgency_keywords = {
            "urgent": 0.9,
            "critical": 0.95,
            "immediate": 0.85,
            "asap": 0.8,
            "emergency": 0.95,
            "failure": 0.8,
            "error": 0.7,
            "deadline": 0.75,
            "escalated": 0.7,
            "blocked": 0.8,
            "stuck": 0.6,
            "help": 0.5,
            "important": 0.6,
            "priority": 0.65,
            "fast": 0.55,
            "quick": 0.5,
        }

        # System state
        self._running = False
        self._background_tasks: List[asyncio.Task] = []
        self._priority_stats = {
            "total_calculated": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "profile_updates": 0,
            "threshold_adjustments": 0,
        }

        # Logging
        self.logger = logging.getLogger(__name__)
        self.logger.info(
            "PriorityManager initialized with learning=%s", learning_enabled
        )

    async def start(self) -> None:
        """Start the priority management service."""
        if self._running:
            self.logger.warning("Priority manager already running")
            return

        self._running = True
        self.logger.info("Starting priority management service")

        # Start background tasks
        if self.learning_enabled:
            profile_task = asyncio.create_task(self._profile_update_worker())
            self._background_tasks.append(profile_task)

        if self.adaptive_thresholds:
            threshold_task = asyncio.create_task(self._threshold_adjustment_worker())
            self._background_tasks.append(threshold_task)

        cache_task = asyncio.create_task(self._cache_cleanup_worker())
        self._background_tasks.append(cache_task)

        self.logger.info(
            "Priority management service started with %d background tasks",
            len(self._background_tasks),
        )

    async def stop(self) -> None:
        """Stop the priority management service."""
        if not self._running:
            return

        self.logger.info("Stopping priority management service...")
        self._running = False

        # Cancel background tasks
        for task in self._background_tasks:
            task.cancel()

        # Wait for tasks to complete
        if self._background_tasks:
            await asyncio.gather(*self._background_tasks, return_exceptions=True)

        self._background_tasks.clear()
        self.logger.info("Priority management service stopped")

    async def calculate_priority(
        self, metadata: NotificationMetadata, override_cache: bool = False
    ) -> PriorityScore:
        """
        Calculate comprehensive priority score for a notification.

        Args:
                metadata: Rich notification metadata
                override_cache: Force recalculation ignoring cache

        Returns:
                Detailed priority score with reasoning
        """
        # Check cache first
        if not override_cache:
            cached_score = self._get_cached_priority(metadata.notification_id)
            if cached_score:
                self._priority_stats["cache_hits"] += 1
                return cached_score

        self._priority_stats["cache_misses"] += 1
        self._priority_stats["total_calculated"] += 1

        # Get user profile
        user_profile = await self._get_or_create_user_profile(metadata.user_id)

        # Calculate component scores
        content_score = await self._calculate_content_score(metadata)
        context_score = await self._calculate_context_score(metadata)
        temporal_score = await self._calculate_temporal_score(metadata)
        user_preference_score = await self._calculate_user_preference_score(
            metadata, user_profile
        )
        business_impact_score = await self._calculate_business_impact_score(metadata)

        # Weighted combination
        base_score = (
            content_score * 0.2
            + context_score * 0.25
            + temporal_score * 0.2
            + user_preference_score * 0.15
            + business_impact_score * 0.2
        )

        # Apply adjustments
        time_decay = self._calculate_time_decay(metadata.created_at)
        activity_multiplier = await self._calculate_user_activity_multiplier(
            metadata.user_id
        )
        load_adjustment = await self._calculate_load_balancing_adjustment()

        # Final score calculation
        final_score = base_score * time_decay * activity_multiplier * load_adjustment
        final_score = max(0.0, min(1.0, final_score))  # Clamp to [0, 1]

        # Determine priority levels
        base_priority = self._score_to_priority(base_score)
        final_priority = metadata.custom_priority_override or self._score_to_priority(
            final_score
        )

        # Build reasoning
        reasoning = self._build_priority_reasoning(
            metadata,
            content_score,
            context_score,
            temporal_score,
            user_preference_score,
            business_impact_score,
            final_score,
        )

        # Create priority score
        priority_score = PriorityScore(
            notification_id=metadata.notification_id,
            user_id=metadata.user_id,
            base_priority=base_priority,
            calculated_score=final_score,
            final_priority=final_priority,
            content_score=content_score,
            context_score=context_score,
            temporal_score=temporal_score,
            user_preference_score=user_preference_score,
            business_impact_score=business_impact_score,
            time_decay_factor=time_decay,
            user_activity_multiplier=activity_multiplier,
            load_balancing_adjustment=load_adjustment,
            confidence_level=self._calculate_confidence_level(user_profile, metadata),
            reasoning=reasoning,
        )

        # Cache result
        self._cache_priority(priority_score)

        self.logger.debug(
            "Calculated priority for notification %s: %s (score: %.3f)",
            metadata.notification_id,
            final_priority.value,
            final_score,
        )

        return priority_score

    async def batch_calculate_priorities(
        self, metadatas: List[NotificationMetadata]
    ) -> List[PriorityScore]:
        """Calculate priorities for multiple notifications efficiently."""
        tasks = [self.calculate_priority(metadata) for metadata in metadatas]
        priority_scores = await asyncio.gather(*tasks)

        self.logger.info("Calculated priorities for %d notifications", len(metadatas))
        return priority_scores

    async def update_user_interaction(
        self,
        user_id: str,
        notification_id: str,
        interaction_type: str,
        response_time_minutes: Optional[float] = None,
        action_taken: bool = False,
    ) -> None:
        """
        Update user profile based on notification interaction.

        Args:
                user_id: User identifier
                notification_id: Notification that was interacted with
                interaction_type: Type of interaction (opened, clicked, dismissed, etc.)
                response_time_minutes: Time to respond in minutes
                action_taken: Whether user took meaningful action
        """
        if not self.learning_enabled:
            return

        # Queue profile update
        update_data = {
            "user_id": user_id,
            "notification_id": notification_id,
            "interaction_type": interaction_type,
            "response_time_minutes": response_time_minutes,
            "action_taken": action_taken,
            "timestamp": datetime.now(),
        }

        await self._profile_update_queue.put(update_data)

        self.logger.debug(
            "Queued profile update for user %s: %s interaction with notification %s",
            user_id,
            interaction_type,
            notification_id,
        )

    async def get_user_priority_preferences(
        self, user_id: str
    ) -> UserPreferenceProfile:
        """Get current user priority preferences."""
        return await self._get_or_create_user_profile(user_id)

    async def set_priority_override(
        self, notification_id: str, priority: PriorityLevel, reason: str
    ) -> None:
        """Set manual priority override for a notification."""
        # Update cached priority if exists
        if notification_id in self._priority_cache:
            cached_priority = self._priority_cache[notification_id]
            cached_priority.final_priority = priority
            cached_priority.reasoning.append(f"Manual override: {reason}")

            self.logger.info(
                "Applied priority override for notification %s: %s (%s)",
                notification_id,
                priority.value,
                reason,
            )

    def get_priority_statistics(self) -> Dict[str, Any]:
        """Get priority management statistics."""
        return {
            "total_calculated": self._priority_stats["total_calculated"],
            "cache_hit_rate": (
                self._priority_stats["cache_hits"]
                / max(
                    1,
                    self._priority_stats["cache_hits"]
                    + self._priority_stats["cache_misses"],
                )
            ),
            "profile_updates": self._priority_stats["profile_updates"],
            "threshold_adjustments": self._priority_stats["threshold_adjustments"],
            "active_user_profiles": len(self._user_profiles),
            "cached_priorities": len(self._priority_cache),
            "current_thresholds": self._priority_thresholds.copy(),
        }

    async def _calculate_content_score(self, metadata: NotificationMetadata) -> float:
        """Calculate content-based importance score."""
        score = 0.0

        # Urgency keywords in title (higher weight)
        title_text = " ".join(metadata.title_keywords).lower()
        for keyword, weight in self._urgency_keywords.items():
            if keyword in title_text:
                score += weight * 0.7  # Title keywords weighted higher

        # Urgency keywords in content
        content_text = " ".join(metadata.content_keywords).lower()
        for keyword, weight in self._urgency_keywords.items():
            if keyword in content_text:
                score += weight * 0.3  # Content keywords weighted lower

        # Sentiment analysis (negative sentiment may indicate urgency)
        if metadata.sentiment_score < -0.3:  # Negative sentiment
            score += abs(metadata.sentiment_score) * 0.4

        # Explicit urgency keywords
        urgency_boost = len(metadata.urgency_keywords) * 0.2
        score += min(urgency_boost, 0.6)  # Cap at 0.6

        return min(score, 1.0)  # Cap at 1.0

    async def _calculate_context_score(self, metadata: NotificationMetadata) -> float:
        """Calculate context-based importance score."""
        if not metadata.importance_contexts:
            return 0.3  # Default moderate importance

        # Get maximum context weight
        max_weight = max(
            self._context_weights.get(context, 0.5)
            for context in metadata.importance_contexts
        )

        # Boost for multiple high-importance contexts
        context_count_boost = min(len(metadata.importance_contexts) * 0.1, 0.3)

        return min(max_weight + context_count_boost, 1.0)

    async def _calculate_temporal_score(self, metadata: NotificationMetadata) -> float:
        """Calculate time-sensitive importance score."""
        now = datetime.now()
        score = 0.0

        # Deadline proximity
        if metadata.deadline_timestamp:
            time_to_deadline = (metadata.deadline_timestamp - now).total_seconds()
            if time_to_deadline > 0:
                # Exponential urgency increase as deadline approaches
                hours_to_deadline = time_to_deadline / 3600
                if hours_to_deadline <= 1:
                    score += 0.9  # Critical: less than 1 hour
                elif hours_to_deadline <= 4:
                    score += 0.7  # High: less than 4 hours
                elif hours_to_deadline <= 24:
                    score += 0.5  # Medium: less than 1 day
                elif hours_to_deadline <= 72:
                    score += 0.3  # Low: less than 3 days
            else:
                score += 1.0  # Overdue deadline

        # Time sensitivity window
        if metadata.time_sensitivity_hours:
            sensitivity_score = max(0.1, 1.0 - (metadata.time_sensitivity_hours / 48))
            score += sensitivity_score * 0.6

        # Escalation threshold
        if metadata.escalation_threshold_minutes:
            escalation_score = max(
                0.1, 1.0 - (metadata.escalation_threshold_minutes / 240)
            )
            score += escalation_score * 0.4

        # Age of notification (decay over time)
        age_hours = (now - metadata.created_at).total_seconds() / 3600
        if age_hours > 24:
            age_penalty = min(age_hours / 168, 0.5)  # Max 50% penalty after 1 week
            score = max(0.0, score - age_penalty)

        return min(score, 1.0)

    async def _calculate_user_preference_score(
        self, metadata: NotificationMetadata, user_profile: UserPreferenceProfile
    ) -> float:
        """Calculate user preference alignment score."""
        if not user_profile or user_profile.profile_confidence < 0.1:
            return 0.5  # Default neutral score for new users

        score = 0.0

        # Context preferences
        for context in metadata.importance_contexts:
            context_weight = user_profile.context_importance_weights.get(context, 0.5)
            score += context_weight

        if metadata.importance_contexts:
            score /= len(metadata.importance_contexts)  # Average
        else:
            score = 0.5  # Default

        # Keyword preferences
        all_keywords = metadata.title_keywords + metadata.content_keywords
        if all_keywords:
            keyword_scores = [
                user_profile.keyword_importance_weights.get(keyword, 0.5)
                for keyword in all_keywords
            ]
            keyword_score = sum(keyword_scores) / len(keyword_scores)
            score = (score + keyword_score) / 2  # Blend with context score

        # Time-based preferences
        current_hour = datetime.now().hour
        if user_profile.active_hours:
            if current_hour in user_profile.active_hours:
                score += 0.2  # Boost during active hours
            else:
                score -= 0.1  # Slight penalty during inactive hours

        # Quiet hours check
        if user_profile.quiet_hours:
            start_hour, end_hour = user_profile.quiet_hours
            if start_hour <= current_hour <= end_hour:
                score -= 0.3  # Penalty during quiet hours

        return max(0.0, min(score, 1.0))

    async def _calculate_business_impact_score(
        self, metadata: NotificationMetadata
    ) -> float:
        """Calculate business impact importance score."""
        score = 0.0

        # Revenue impact
        if metadata.revenue_impact_estimate:
            # Logarithmic scaling for revenue impact
            revenue_score = min(
                math.log10(max(1, abs(metadata.revenue_impact_estimate))) / 6, 1.0
            )
            score += revenue_score * 0.4

        # Compliance risk
        score += metadata.compliance_risk_level * 0.3

        # Blocking dependencies
        if metadata.blocking_dependencies:
            blocking_score = min(len(metadata.blocking_dependencies) * 0.15, 0.6)
            score += blocking_score

        # Team impact
        if metadata.team_size_affected > 1:
            team_impact = min(math.log10(metadata.team_size_affected) / 2, 0.4)
            score += team_impact

        # External stakeholder involvement
        if metadata.involves_external_stakeholders:
            score += 0.2

        # Immediate response requirement
        if metadata.requires_immediate_response:
            score += 0.3

        return min(score, 1.0)

    def _calculate_time_decay(self, created_at: datetime) -> float:
        """Calculate time-based priority decay factor."""
        age_hours = (datetime.now() - created_at).total_seconds() / 3600

        # Exponential decay after 4 hours
        if age_hours <= 1:
            return 1.0  # No decay for first hour
        elif age_hours <= 4:
            return 0.9  # Minimal decay for first 4 hours
        else:
            # Exponential decay: 50% after 24 hours, 25% after 48 hours
            return max(0.1, 0.5 ** (age_hours / 24))

    async def _calculate_user_activity_multiplier(self, user_id: str) -> float:
        """Calculate user activity-based priority adjustment."""
        user_profile = self._user_profiles.get(user_id)
        if not user_profile:
            return 1.0  # Default multiplier

        # Based on user responsiveness
        if user_profile.average_response_time_minutes > 0:
            # Faster responders get higher priority notifications
            if user_profile.average_response_time_minutes < 15:
                return 1.3  # Very responsive users
            elif user_profile.average_response_time_minutes < 60:
                return 1.1  # Moderately responsive users
            elif user_profile.average_response_time_minutes > 240:
                return 0.8  # Slow responders

        return 1.0

    async def _calculate_load_balancing_adjustment(self) -> float:
        """Calculate system load-based priority adjustment."""
        # Simple load balancing based on cache size
        cache_size = len(self._priority_cache)

        if cache_size > 1000:
            return 0.9  # Reduce priority slightly under high load
        elif cache_size > 500:
            return 0.95  # Minor reduction
        else:
            return 1.0  # No adjustment

    def _score_to_priority(self, score: float) -> PriorityLevel:
        """Convert numeric score to priority level."""
        for priority, threshold in sorted(
            self._priority_thresholds.items(), key=lambda x: x[1], reverse=True
        ):
            if score >= threshold:
                return priority

        return PriorityLevel.VERY_LOW

    def _calculate_confidence_level(
        self, user_profile: UserPreferenceProfile, metadata: NotificationMetadata
    ) -> float:
        """Calculate confidence level for priority calculation."""
        confidence = 0.5  # Base confidence

        # User profile confidence
        if user_profile:
            confidence += user_profile.profile_confidence * 0.3

        # Metadata richness
        metadata_richness = 0.0
        if metadata.importance_contexts:
            metadata_richness += 0.2
        if metadata.deadline_timestamp:
            metadata_richness += 0.1
        if metadata.business_impact_score > 0:
            metadata_richness += 0.1
        if metadata.title_keywords or metadata.content_keywords:
            metadata_richness += 0.1

        confidence += metadata_richness

        return min(confidence, 1.0)

    def _build_priority_reasoning(
        self,
        metadata: NotificationMetadata,
        content_score: float,
        context_score: float,
        temporal_score: float,
        user_preference_score: float,
        business_impact_score: float,
        final_score: float,
    ) -> List[str]:
        """Build human-readable reasoning for priority decision."""
        reasoning = []

        # Content factors
        if content_score > 0.6:
            reasoning.append("High urgency keywords detected in content")
        if metadata.urgency_keywords:
            reasoning.append(
                f"Explicit urgency indicators: {', '.join(metadata.urgency_keywords)}"
            )

        # Context factors
        if context_score > 0.7:
            top_contexts = [ctx.value for ctx in metadata.importance_contexts[:3]]
            reasoning.append(f"Critical business contexts: {', '.join(top_contexts)}")

        # Temporal factors
        if temporal_score > 0.7:
            reasoning.append("Time-sensitive notification")
        if metadata.deadline_timestamp:
            time_to_deadline = metadata.deadline_timestamp - datetime.now()
            if time_to_deadline.total_seconds() < 3600:
                reasoning.append("Deadline approaching within 1 hour")

        # User preference factors
        if user_preference_score > 0.7:
            reasoning.append("High alignment with user preferences")
        elif user_preference_score < 0.3:
            reasoning.append("Lower user interest predicted")

        # Business impact factors
        if business_impact_score > 0.6:
            reasoning.append("Significant business impact identified")
        if metadata.blocking_dependencies:
            reasoning.append("Blocking other workflow items")

        # Final score interpretation
        if final_score > 0.9:
            reasoning.append("Critical priority - immediate attention required")
        elif final_score > 0.7:
            reasoning.append("High priority - prompt attention recommended")
        elif final_score < 0.3:
            reasoning.append("Low priority - can be batched or delayed")

        return reasoning

    def _get_cached_priority(self, notification_id: str) -> Optional[PriorityScore]:
        """Get cached priority score if still valid."""
        if notification_id not in self._priority_cache:
            return None

        expiry_time = self._cache_expiry.get(notification_id)
        if expiry_time and datetime.now() > expiry_time:
            # Cache expired
            del self._priority_cache[notification_id]
            del self._cache_expiry[notification_id]
            return None

        return self._priority_cache[notification_id]

    def _cache_priority(self, priority_score: PriorityScore) -> None:
        """Cache priority score with expiration."""
        self._priority_cache[priority_score.notification_id] = priority_score
        self._cache_expiry[priority_score.notification_id] = datetime.now() + timedelta(
            seconds=self.priority_refresh_interval
        )

    async def _get_or_create_user_profile(self, user_id: str) -> UserPreferenceProfile:
        """Get existing user profile or create new one."""
        if user_id not in self._user_profiles:
            if len(self._user_profiles) >= self.max_user_profiles:
                # Remove oldest profile to make space
                oldest_user = min(
                    self._user_profiles.keys(),
                    key=lambda u: self._user_profiles[u].last_updated,
                )
                del self._user_profiles[oldest_user]
                self.logger.debug("Removed oldest user profile: %s", oldest_user)

            # Create new profile
            self._user_profiles[user_id] = UserPreferenceProfile(user_id=user_id)
            self.logger.debug("Created new user profile: %s", user_id)

        return self._user_profiles[user_id]

    async def _profile_update_worker(self) -> None:
        """Background worker for processing user profile updates."""
        self.logger.debug("Profile update worker started")

        while self._running:
            try:
                # Get update from queue with timeout
                try:
                    update_data = await asyncio.wait_for(
                        self._profile_update_queue.get(), timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue

                # Process profile update
                await self._process_profile_update(update_data)
                self._priority_stats["profile_updates"] += 1

            except Exception as e:
                self.logger.error("Profile update worker error: %s", str(e))
                await asyncio.sleep(1)

        self.logger.debug("Profile update worker stopped")

    async def _process_profile_update(self, update_data: Dict[str, Any]) -> None:
        """Process individual profile update."""
        user_id = update_data["user_id"]
        interaction_type = update_data["interaction_type"]
        response_time = update_data.get("response_time_minutes")
        action_taken = update_data.get("action_taken", False)

        # Get or create user profile
        profile = await self._get_or_create_user_profile(user_id)

        # Update interaction statistics
        profile.total_notifications_received += 1

        if interaction_type in ["opened", "clicked"]:
            profile.total_notifications_opened += 1

        if action_taken:
            profile.total_notifications_acted_upon += 1

        # Update response time
        if response_time is not None:
            total = profile.total_notifications_opened
            if total == 1:
                profile.average_response_time_minutes = response_time
            else:
                # Rolling average
                current_avg = profile.average_response_time_minutes
                profile.average_response_time_minutes = (
                    current_avg * (total - 1) + response_time
                ) / total

        # Update activity hours
        current_hour = datetime.now().hour
        if current_hour not in profile.active_hours:
            profile.active_hours.append(current_hour)
            # Keep only top 8 most active hours
            if len(profile.active_hours) > 8:
                profile.active_hours = profile.active_hours[-8:]

        # Update profile metadata
        profile.last_updated = datetime.now()
        profile.learning_iterations += 1

        # Calculate profile confidence
        min_interactions = 10
        confidence = min(
            profile.total_notifications_received / (min_interactions * 3), 1.0
        )
        profile.profile_confidence = confidence

        self.logger.debug(
            "Updated profile for user %s: %d interactions, %.2f confidence",
            user_id,
            profile.total_notifications_received,
            confidence,
        )

    async def _threshold_adjustment_worker(self) -> None:
        """Background worker for adaptive threshold adjustment."""
        self.logger.debug("Threshold adjustment worker started")

        while self._running:
            try:
                await asyncio.sleep(3600)  # Check every hour

                if self._priority_stats["total_calculated"] > 100:  # Need minimum data
                    await self._adjust_priority_thresholds()
                    self._priority_stats["threshold_adjustments"] += 1

            except Exception as e:
                self.logger.error("Threshold adjustment worker error: %s", str(e))
                await asyncio.sleep(300)  # Sleep 5 minutes on error

        self.logger.debug("Threshold adjustment worker stopped")

    async def _adjust_priority_thresholds(self) -> None:
        """Adjust priority thresholds based on historical data."""
        # This would typically analyze historical priority distributions
        # and user feedback to optimize threshold boundaries

        # Simple placeholder implementation
        # In practice, this would use machine learning to optimize thresholds
        self.logger.debug("Adjusting priority thresholds based on usage patterns")

        # Could implement logic like:
        # - If too many CRITICAL notifications, raise threshold
        # - If users ignore HIGH priority, lower threshold
        # - Use A/B testing to optimize thresholds

    async def _cache_cleanup_worker(self) -> None:
        """Background worker for cleaning up expired cache entries."""
        self.logger.debug("Cache cleanup worker started")

        while self._running:
            try:
                await asyncio.sleep(300)  # Cleanup every 5 minutes

                now = datetime.now()
                expired_keys = [
                    key
                    for key, expiry_time in self._cache_expiry.items()
                    if expiry_time <= now
                ]

                for key in expired_keys:
                    del self._priority_cache[key]
                    del self._cache_expiry[key]

                if expired_keys:
                    self.logger.debug(
                        "Cleaned up %d expired cache entries", len(expired_keys)
                    )

            except Exception as e:
                self.logger.error("Cache cleanup worker error: %s", str(e))
                await asyncio.sleep(60)

        self.logger.debug("Cache cleanup worker stopped")


# Utility functions for priority management


async def create_priority_manager(
    learning_enabled: bool = True, **kwargs
) -> PriorityManager:
    """Factory function to create and start a PriorityManager instance."""
    manager = PriorityManager(learning_enabled=learning_enabled, **kwargs)
    await manager.start()
    return manager


def create_notification_metadata(
    notification_id: str,
    user_id: str,
    title_keywords: List[str] = None,
    content_keywords: List[str] = None,
    importance_contexts: List[ImportanceContext] = None,
    deadline_timestamp: Optional[datetime] = None,
    **kwargs,
) -> NotificationMetadata:
    """Create notification metadata for priority calculation."""
    return NotificationMetadata(
        notification_id=notification_id,
        user_id=user_id,
        title_keywords=title_keywords or [],
        content_keywords=content_keywords or [],
        importance_contexts=importance_contexts or [],
        deadline_timestamp=deadline_timestamp,
        **kwargs,
    )


def extract_urgency_keywords(text: str) -> List[str]:
    """Extract urgency-related keywords from text."""
    urgency_terms = {
        "urgent",
        "critical",
        "immediate",
        "asap",
        "emergency",
        "failure",
        "error",
        "deadline",
        "escalated",
        "blocked",
        "stuck",
        "help",
        "important",
        "priority",
        "fast",
        "quick",
    }

    words = text.lower().split()
    found_keywords = [word for word in words if word in urgency_terms]

    return list(set(found_keywords))  # Remove duplicates
