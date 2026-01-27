"""
Feedback Processor

Feedback collection, analysis, and learning system for performance improvement
and feedback-driven optimization in AI agent workflows.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import json
import logging
import statistics
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

import numpy as np

try:
    from uuid_extensions import uuid7str
except ImportError:
    import uuid

    def uuid7str() -> str:
        return str(uuid.uuid4())


from pydantic import BaseModel, ConfigDict, Field


class FeedbackType(str, Enum):
    """Types of feedback"""

    PERFORMANCE = "performance"
    QUALITY = "quality"
    USER_SATISFACTION = "user_satisfaction"
    SYSTEM_HEALTH = "system_health"
    ERROR_ANALYSIS = "error_analysis"
    IMPROVEMENT_SUGGESTION = "improvement_suggestion"


class FeedbackSource(str, Enum):
    """Sources of feedback"""

    USER = "user"
    SYSTEM = "system"
    AGENT = "agent"
    EXTERNAL_API = "external_api"
    MONITORING = "monitoring"
    VALIDATION = "validation"


class FeedbackSentiment(str, Enum):
    """Sentiment of feedback"""

    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    MIXED = "mixed"


@dataclass
class FeedbackItem:
    """Individual feedback item"""

    feedback_id: str = field(default_factory=uuid7str)
    type: FeedbackType = FeedbackType.QUALITY
    source: FeedbackSource = FeedbackSource.SYSTEM
    sentiment: FeedbackSentiment = FeedbackSentiment.NEUTRAL

    # Core feedback data
    title: str = ""
    description: str = ""
    context: Dict[str, Any] = field(default_factory=dict)
    metrics: Dict[str, float] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)

    # Tracking information
    task_id: Optional[str] = None
    agent_id: Optional[str] = None
    workflow_id: Optional[str] = None

    # Temporal data
    created_at: datetime = field(default_factory=datetime.now)
    processed_at: Optional[datetime] = None

    # Analysis results
    confidence_score: float = 0.0
    impact_score: float = 0.0
    actionability_score: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "feedback_id": self.feedback_id,
            "type": self.type.value,
            "source": self.source.value,
            "sentiment": self.sentiment.value,
            "title": self.title,
            "description": self.description,
            "context": self.context,
            "metrics": self.metrics,
            "tags": self.tags,
            "task_id": self.task_id,
            "agent_id": self.agent_id,
            "workflow_id": self.workflow_id,
            "created_at": self.created_at.isoformat(),
            "processed_at": self.processed_at.isoformat()
            if self.processed_at
            else None,
            "confidence_score": self.confidence_score,
            "impact_score": self.impact_score,
            "actionability_score": self.actionability_score,
        }


@dataclass
class PerformancePattern:
    """Identified performance pattern"""

    pattern_id: str = field(default_factory=uuid7str)
    pattern_name: str = ""
    description: str = ""

    # Pattern characteristics
    conditions: Dict[str, Any] = field(default_factory=dict)
    outcomes: Dict[str, Any] = field(default_factory=dict)
    frequency: int = 0
    confidence: float = 0.0

    # Performance metrics
    success_rate: float = 0.0
    average_duration: float = 0.0
    quality_score: float = 0.0

    # Recommendations
    recommendations: List[str] = field(default_factory=list)

    created_at: datetime = field(default_factory=datetime.now)
    last_seen: datetime = field(default_factory=datetime.now)


@dataclass
class ImprovementRecommendation:
    """Performance improvement recommendation"""

    recommendation_id: str = field(default_factory=uuid7str)
    title: str = ""
    description: str = ""

    # Recommendation details
    category: str = ""
    priority: str = "medium"  # low, medium, high, critical
    estimated_impact: float = 0.0
    implementation_difficulty: str = "medium"  # easy, medium, hard

    # Supporting evidence
    supporting_feedback: List[str] = field(default_factory=list)
    patterns_involved: List[str] = field(default_factory=list)
    metrics_evidence: Dict[str, Any] = field(default_factory=dict)

    # Action plan
    action_steps: List[str] = field(default_factory=list)
    expected_outcomes: List[str] = field(default_factory=list)

    # Tracking
    status: str = "pending"  # pending, in_progress, implemented, rejected
    created_at: datetime = field(default_factory=datetime.now)
    implemented_at: Optional[datetime] = None


class FeedbackProcessor:
    """
    Feedback collection, analysis, and learning system

    Processes feedback from various sources, identifies patterns,
    generates improvement recommendations, and tracks feedback loop closure.
    """

    def __init__(self, max_feedback_history: int = 10000):
        self.max_feedback_history = max_feedback_history

        # Feedback storage
        self.feedback_items: Dict[str, FeedbackItem] = {}
        self.feedback_history: deque = deque(maxlen=max_feedback_history)

        # Pattern recognition and learning
        self.performance_patterns: Dict[str, PerformancePattern] = {}
        self.improvement_recommendations: Dict[str, ImprovementRecommendation] = {}

        # Analysis engines
        self.sentiment_analyzers: Dict[str, Callable] = {}
        self.pattern_detectors: Dict[str, Callable] = {}
        self.recommendation_generators: Dict[str, Callable] = {}

        # Metrics and statistics
        self.feedback_stats = {
            "total_feedback": 0,
            "positive_feedback": 0,
            "negative_feedback": 0,
            "patterns_identified": 0,
            "recommendations_generated": 0,
            "improvements_implemented": 0,
            "average_response_time": 0.0,
        }

        # Configuration
        self.pattern_detection_threshold = 3  # Minimum occurrences for pattern
        self.recommendation_confidence_threshold = 0.7
        self.feedback_retention_days = 30

        self.logger = logging.getLogger("feedback_processor")
        self.logger.info("FeedbackProcessor initialized")

        # Background tasks
        self._pattern_analysis_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        """Start the feedback processor"""
        if self._running:
            return

        self._running = True

        # Start background tasks
        self._pattern_analysis_task = asyncio.create_task(self._pattern_analysis_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        self.logger.info("FeedbackProcessor started")

    async def stop(self) -> None:
        """Stop the feedback processor"""
        if not self._running:
            return

        self._running = False

        # Cancel background tasks
        if self._pattern_analysis_task:
            self._pattern_analysis_task.cancel()
        if self._cleanup_task:
            self._cleanup_task.cancel()

        self.logger.info("FeedbackProcessor stopped")

    async def collect_feedback(self, feedback: FeedbackItem) -> str:
        """
        Collect and process feedback

        Args:
                feedback: Feedback item to process

        Returns:
                Feedback ID for tracking
        """
        # Store feedback
        self.feedback_items[feedback.feedback_id] = feedback
        self.feedback_history.append(feedback)

        # Update statistics
        self.feedback_stats["total_feedback"] += 1

        try:
            # Analyze sentiment if not already set
            if feedback.sentiment == FeedbackSentiment.NEUTRAL:
                feedback.sentiment = await self._analyze_sentiment(feedback)

            # Update sentiment statistics
            if feedback.sentiment == FeedbackSentiment.POSITIVE:
                self.feedback_stats["positive_feedback"] += 1
            elif feedback.sentiment == FeedbackSentiment.NEGATIVE:
                self.feedback_stats["negative_feedback"] += 1

            # Calculate scores
            await self._calculate_feedback_scores(feedback)

            # Mark as processed
            feedback.processed_at = datetime.now()

            # Trigger immediate analysis for high-impact feedback
            if feedback.impact_score > 0.8:
                await self._analyze_immediate_feedback(feedback)

            self.logger.info(
                f"Feedback collected: {feedback.feedback_id} ({feedback.type.value})"
            )

            return feedback.feedback_id

        except Exception as e:
            self.logger.error(f"Feedback processing failed: {e}")
            return feedback.feedback_id

    async def collect_performance_feedback(
        self,
        task_id: str,
        agent_id: str,
        metrics: Dict[str, float],
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Collect performance feedback from task execution

        Args:
                task_id: Task identifier
                agent_id: Agent identifier
                metrics: Performance metrics
                context: Additional context information

        Returns:
                Feedback ID
        """
        # Determine sentiment based on metrics
        sentiment = self._determine_performance_sentiment(metrics)

        # Create feedback item
        feedback = FeedbackItem(
            type=FeedbackType.PERFORMANCE,
            source=FeedbackSource.SYSTEM,
            sentiment=sentiment,
            title=f"Performance feedback for task {task_id}",
            description=f"Automated performance metrics for agent {agent_id}",
            context=context or {},
            metrics=metrics,
            task_id=task_id,
            agent_id=agent_id,
            tags=["performance", "automated"],
        )

        return await self.collect_feedback(feedback)

    async def collect_user_feedback(
        self,
        user_id: str,
        rating: float,
        comment: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Collect user satisfaction feedback

        Args:
                user_id: User identifier
                rating: User rating (0-5)
                comment: User comment
                context: Additional context

        Returns:
                Feedback ID
        """
        # Determine sentiment from rating
        if rating >= 4:
            sentiment = FeedbackSentiment.POSITIVE
        elif rating <= 2:
            sentiment = FeedbackSentiment.NEGATIVE
        else:
            sentiment = FeedbackSentiment.NEUTRAL

        feedback = FeedbackItem(
            type=FeedbackType.USER_SATISFACTION,
            source=FeedbackSource.USER,
            sentiment=sentiment,
            title=f"User feedback from {user_id}",
            description=comment,
            context=context or {},
            metrics={"rating": rating},
            tags=["user_feedback", "manual"],
        )

        return await self.collect_feedback(feedback)

    async def analyze_performance_patterns(self) -> List[PerformancePattern]:
        """
        Analyze feedback to identify performance patterns

        Returns:
                List of identified patterns
        """
        patterns = []

        try:
            # Group feedback by various dimensions
            grouped_feedback = await self._group_feedback_for_analysis()

            # Analyze each group for patterns
            for group_key, feedback_items in grouped_feedback.items():
                if len(feedback_items) >= self.pattern_detection_threshold:
                    pattern = await self._detect_pattern_in_group(
                        group_key, feedback_items
                    )
                    if pattern and pattern.confidence > 0.5:
                        patterns.append(pattern)

                        # Store pattern
                        self.performance_patterns[pattern.pattern_id] = pattern
                        self.feedback_stats["patterns_identified"] += 1

            self.logger.info(f"Identified {len(patterns)} performance patterns")

            return patterns

        except Exception as e:
            self.logger.error(f"Pattern analysis failed: {e}")
            return []

    async def generate_improvement_recommendations(
        self,
    ) -> List[ImprovementRecommendation]:
        """
        Generate improvement recommendations based on patterns and feedback

        Returns:
                List of improvement recommendations
        """
        recommendations = []

        try:
            # Analyze negative feedback for improvement opportunities
            negative_feedback = [
                f
                for f in self.feedback_history
                if f.sentiment == FeedbackSentiment.NEGATIVE
            ]

            # Group by categories
            feedback_by_category = defaultdict(list)
            for feedback in negative_feedback:
                for tag in feedback.tags:
                    feedback_by_category[tag].append(feedback)

            # Generate recommendations for each category
            for category, feedback_items in feedback_by_category.items():
                if len(feedback_items) >= 2:  # Need multiple instances
                    recommendation = await self._generate_recommendation_for_category(
                        category, feedback_items
                    )
                    if recommendation:
                        recommendations.append(recommendation)

                        # Store recommendation
                        self.improvement_recommendations[
                            recommendation.recommendation_id
                        ] = recommendation
                        self.feedback_stats["recommendations_generated"] += 1

            # Also generate recommendations from patterns
            for pattern in self.performance_patterns.values():
                if pattern.success_rate < 0.8:  # Poor performing patterns
                    recommendation = await self._generate_recommendation_from_pattern(
                        pattern
                    )
                    if recommendation:
                        recommendations.append(recommendation)
                        self.improvement_recommendations[
                            recommendation.recommendation_id
                        ] = recommendation
                        self.feedback_stats["recommendations_generated"] += 1

            # Sort by estimated impact
            recommendations.sort(key=lambda r: r.estimated_impact, reverse=True)

            self.logger.info(
                f"Generated {len(recommendations)} improvement recommendations"
            )

            return recommendations

        except Exception as e:
            self.logger.error(f"Recommendation generation failed: {e}")
            return []

    async def track_feedback_loop_closure(
        self,
        recommendation_id: str,
        implementation_status: str,
        results: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Track closure of feedback loops by monitoring recommendation implementation

        Args:
                recommendation_id: Recommendation identifier
                implementation_status: Status update (implemented, rejected, etc.)
                results: Implementation results if available

        Returns:
                Success of tracking update
        """
        try:
            if recommendation_id not in self.improvement_recommendations:
                self.logger.warning(f"Unknown recommendation ID: {recommendation_id}")
                return False

            recommendation = self.improvement_recommendations[recommendation_id]
            recommendation.status = implementation_status

            if implementation_status == "implemented":
                recommendation.implemented_at = datetime.now()
                self.feedback_stats["improvements_implemented"] += 1

                # Track results if provided
                if results:
                    recommendation.metrics_evidence.update(results)

                self.logger.info(f"Feedback loop closed: {recommendation.title}")

            return True

        except Exception as e:
            self.logger.error(f"Feedback loop tracking failed: {e}")
            return False

    async def get_feedback_analytics(self) -> Dict[str, Any]:
        """Get comprehensive feedback analytics"""
        try:
            recent_feedback = [
                f
                for f in self.feedback_history
                if (datetime.now() - f.created_at).days <= 7
            ]

            analytics = {
                "overall_stats": dict(self.feedback_stats),
                "recent_feedback_count": len(recent_feedback),
                "patterns_count": len(self.performance_patterns),
                "recommendations_count": len(self.improvement_recommendations),
                "sentiment_distribution": await self._calculate_sentiment_distribution(),
                "feedback_types_distribution": await self._calculate_type_distribution(),
                "top_improvement_areas": await self._identify_top_improvement_areas(),
                "performance_trends": await self._calculate_performance_trends(),
                "recommendation_effectiveness": await self._measure_recommendation_effectiveness(),
            }

            return analytics

        except Exception as e:
            self.logger.error(f"Analytics generation failed: {e}")
            return {}

    async def _analyze_sentiment(self, feedback: FeedbackItem) -> FeedbackSentiment:
        """Analyze sentiment of feedback"""
        # Simple sentiment analysis based on keywords
        text = f"{feedback.title} {feedback.description}".lower()

        positive_words = [
            "good",
            "great",
            "excellent",
            "fast",
            "accurate",
            "helpful",
            "success",
        ]
        negative_words = [
            "bad",
            "slow",
            "error",
            "failed",
            "poor",
            "wrong",
            "issue",
            "problem",
        ]

        positive_score = sum(1 for word in positive_words if word in text)
        negative_score = sum(1 for word in negative_words if word in text)

        if positive_score > negative_score:
            return FeedbackSentiment.POSITIVE
        elif negative_score > positive_score:
            return FeedbackSentiment.NEGATIVE
        else:
            return FeedbackSentiment.NEUTRAL

    async def _calculate_feedback_scores(self, feedback: FeedbackItem) -> None:
        """Calculate various scores for feedback"""
        # Confidence score based on source and metrics
        confidence_factors = {
            FeedbackSource.USER: 0.9,
            FeedbackSource.SYSTEM: 0.8,
            FeedbackSource.MONITORING: 0.7,
            FeedbackSource.VALIDATION: 0.8,
        }
        feedback.confidence_score = confidence_factors.get(feedback.source, 0.5)

        # Impact score based on metrics and context
        impact_score = 0.5  # Base score

        # Boost impact for performance issues
        if feedback.type == FeedbackType.PERFORMANCE:
            if "error_rate" in feedback.metrics:
                impact_score += min(feedback.metrics["error_rate"] / 100, 0.3)
            if "response_time" in feedback.metrics:
                if feedback.metrics["response_time"] > 1000:  # Over 1 second
                    impact_score += 0.2

        # Boost impact for negative sentiment
        if feedback.sentiment == FeedbackSentiment.NEGATIVE:
            impact_score += 0.2

        feedback.impact_score = min(impact_score, 1.0)

        # Actionability score based on description detail
        desc_length = len(feedback.description)
        if desc_length > 100:
            feedback.actionability_score = min(0.8, desc_length / 200)
        else:
            feedback.actionability_score = max(0.2, desc_length / 100)

    def _determine_performance_sentiment(
        self, metrics: Dict[str, float]
    ) -> FeedbackSentiment:
        """Determine sentiment based on performance metrics"""
        positive_indicators = 0
        negative_indicators = 0

        # Check various metrics
        if "success_rate" in metrics:
            if metrics["success_rate"] > 0.9:
                positive_indicators += 1
            elif metrics["success_rate"] < 0.7:
                negative_indicators += 1

        if "response_time" in metrics:
            if metrics["response_time"] < 500:  # Less than 500ms
                positive_indicators += 1
            elif metrics["response_time"] > 2000:  # More than 2s
                negative_indicators += 1

        if "error_rate" in metrics:
            if metrics["error_rate"] < 0.01:  # Less than 1%
                positive_indicators += 1
            elif metrics["error_rate"] > 0.1:  # More than 10%
                negative_indicators += 1

        if positive_indicators > negative_indicators:
            return FeedbackSentiment.POSITIVE
        elif negative_indicators > positive_indicators:
            return FeedbackSentiment.NEGATIVE
        else:
            return FeedbackSentiment.NEUTRAL

    async def _analyze_immediate_feedback(self, feedback: FeedbackItem) -> None:
        """Analyze high-impact feedback immediately"""
        if (
            feedback.sentiment == FeedbackSentiment.NEGATIVE
            and feedback.impact_score > 0.8
        ):
            self.logger.warning(f"High-impact negative feedback: {feedback.title}")

            # Could trigger immediate alerts or actions here

    async def _group_feedback_for_analysis(self) -> Dict[str, List[FeedbackItem]]:
        """Group feedback for pattern analysis"""
        grouped = defaultdict(list)

        for feedback in self.feedback_history:
            # Group by agent ID
            if feedback.agent_id:
                grouped[f"agent:{feedback.agent_id}"].append(feedback)

            # Group by type
            grouped[f"type:{feedback.type.value}"].append(feedback)

            # Group by tags
            for tag in feedback.tags:
                grouped[f"tag:{tag}"].append(feedback)

        return grouped

    async def _detect_pattern_in_group(
        self, group_key: str, feedback_items: List[FeedbackItem]
    ) -> Optional[PerformancePattern]:
        """Detect patterns in a group of feedback items"""
        if len(feedback_items) < self.pattern_detection_threshold:
            return None

        # Calculate aggregate metrics
        success_count = sum(
            1 for f in feedback_items if f.sentiment == FeedbackSentiment.POSITIVE
        )
        success_rate = success_count / len(feedback_items)

        # Calculate average metrics
        avg_metrics = {}
        for feedback in feedback_items:
            for metric, value in feedback.metrics.items():
                if metric not in avg_metrics:
                    avg_metrics[metric] = []
                avg_metrics[metric].append(value)

        # Calculate averages
        for metric in avg_metrics:
            avg_metrics[metric] = statistics.mean(avg_metrics[metric])

        # Create pattern
        pattern = PerformancePattern(
            pattern_name=f"Pattern in {group_key}",
            description=f"Performance pattern identified in {group_key} with {len(feedback_items)} instances",
            conditions={"group": group_key, "sample_size": len(feedback_items)},
            outcomes=avg_metrics,
            frequency=len(feedback_items),
            confidence=min(
                len(feedback_items) / 10, 1.0
            ),  # Higher confidence with more data
            success_rate=success_rate,
            average_duration=avg_metrics.get("response_time", 0),
            quality_score=success_rate * 100,
        )

        # Generate recommendations for poor patterns
        if success_rate < 0.8:
            pattern.recommendations = [
                f"Investigate issues in {group_key}",
                f"Review feedback patterns for {group_key}",
                f"Consider process improvements for {group_key}",
            ]

        return pattern

    async def _generate_recommendation_for_category(
        self, category: str, feedback_items: List[FeedbackItem]
    ) -> Optional[ImprovementRecommendation]:
        """Generate improvement recommendation for a feedback category"""
        if len(feedback_items) < 2:
            return None

        # Analyze common issues
        common_keywords = []
        for feedback in feedback_items:
            words = feedback.description.lower().split()
            common_keywords.extend(words)

        # Find most frequent issues
        word_freq = defaultdict(int)
        for word in common_keywords:
            if len(word) > 3:  # Skip short words
                word_freq[word] += 1

        top_issues = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:3]

        recommendation = ImprovementRecommendation(
            title=f"Improve {category} performance",
            description=f"Based on {len(feedback_items)} negative feedback items in {category}",
            category=category,
            priority="medium" if len(feedback_items) < 5 else "high",
            estimated_impact=min(len(feedback_items) / 10, 1.0),
            implementation_difficulty="medium",
            supporting_feedback=[f.feedback_id for f in feedback_items],
            action_steps=[
                f"Analyze root causes in {category}",
                f"Address common issues: {[issue[0] for issue in top_issues]}",
                f"Monitor improvement metrics",
            ],
            expected_outcomes=[
                f"Reduce negative feedback in {category}",
                f"Improve performance metrics",
                f"Increase user satisfaction",
            ],
        )

        return recommendation

    async def _generate_recommendation_from_pattern(
        self, pattern: PerformancePattern
    ) -> Optional[ImprovementRecommendation]:
        """Generate recommendation from a performance pattern"""
        if pattern.success_rate > 0.8:
            return None  # Good pattern, no improvement needed

        recommendation = ImprovementRecommendation(
            title=f"Address performance issues in {pattern.pattern_name}",
            description=f"Pattern shows {pattern.success_rate:.1%} success rate with {pattern.frequency} occurrences",
            category="performance",
            priority="high" if pattern.success_rate < 0.5 else "medium",
            estimated_impact=1.0 - pattern.success_rate,
            implementation_difficulty="medium",
            patterns_involved=[pattern.pattern_id],
            metrics_evidence=pattern.outcomes,
            action_steps=pattern.recommendations
            or [
                "Investigate root causes",
                "Implement process improvements",
                "Monitor success rate improvements",
            ],
            expected_outcomes=[
                f"Improve success rate from {pattern.success_rate:.1%} to >80%",
                "Reduce error frequency",
                "Enhance overall system performance",
            ],
        )

        return recommendation

    async def _calculate_sentiment_distribution(self) -> Dict[str, int]:
        """Calculate distribution of feedback sentiments"""
        distribution = defaultdict(int)
        for feedback in self.feedback_history:
            distribution[feedback.sentiment.value] += 1
        return dict(distribution)

    async def _calculate_type_distribution(self) -> Dict[str, int]:
        """Calculate distribution of feedback types"""
        distribution = defaultdict(int)
        for feedback in self.feedback_history:
            distribution[feedback.type.value] += 1
        return dict(distribution)

    async def _identify_top_improvement_areas(self) -> List[Dict[str, Any]]:
        """Identify top areas needing improvement"""
        areas = defaultdict(lambda: {"count": 0, "avg_impact": 0.0})

        negative_feedback = [
            f
            for f in self.feedback_history
            if f.sentiment == FeedbackSentiment.NEGATIVE
        ]

        for feedback in negative_feedback:
            for tag in feedback.tags:
                areas[tag]["count"] += 1
                areas[tag]["avg_impact"] += feedback.impact_score

        # Calculate averages and sort
        top_areas = []
        for area, data in areas.items():
            if data["count"] > 0:
                data["avg_impact"] /= data["count"]
                data["priority_score"] = data["count"] * data["avg_impact"]
                top_areas.append({"area": area, **data})

        return sorted(top_areas, key=lambda x: x["priority_score"], reverse=True)[:10]

    async def _calculate_performance_trends(self) -> Dict[str, List[float]]:
        """Calculate performance trends over time"""
        # Group feedback by week
        weekly_metrics = defaultdict(list)

        for feedback in self.feedback_history:
            week_key = feedback.created_at.strftime("%Y-W%U")
            if feedback.type == FeedbackType.PERFORMANCE:
                for metric, value in feedback.metrics.items():
                    weekly_metrics[f"{week_key}_{metric}"].append(value)

        # Calculate averages per week per metric
        trends = {}
        for key, values in weekly_metrics.items():
            if len(values) > 0:
                trends[key] = [statistics.mean(values)]

        return trends

    async def _measure_recommendation_effectiveness(self) -> Dict[str, Any]:
        """Measure effectiveness of implemented recommendations"""
        implemented = [
            r
            for r in self.improvement_recommendations.values()
            if r.status == "implemented"
        ]

        if not implemented:
            return {"total_implemented": 0, "average_effectiveness": 0.0}

        # This would measure actual impact vs. predicted impact
        # For now, return basic stats
        return {
            "total_implemented": len(implemented),
            "total_generated": len(self.improvement_recommendations),
            "implementation_rate": len(implemented)
            / len(self.improvement_recommendations)
            if self.improvement_recommendations
            else 0,
            "average_estimated_impact": statistics.mean(
                [r.estimated_impact for r in implemented]
            )
            if implemented
            else 0,
        }

    async def _pattern_analysis_loop(self) -> None:
        """Background pattern analysis"""
        while self._running:
            try:
                await self.analyze_performance_patterns()
                await self.generate_improvement_recommendations()
                await asyncio.sleep(3600)  # Every hour
            except Exception as e:
                self.logger.error(f"Pattern analysis loop error: {e}")
                await asyncio.sleep(600)  # Wait 10 minutes on error

    async def _cleanup_loop(self) -> None:
        """Background cleanup of old feedback"""
        while self._running:
            try:
                await self._cleanup_old_feedback()
                await asyncio.sleep(86400)  # Daily cleanup
            except Exception as e:
                self.logger.error(f"Cleanup loop error: {e}")
                await asyncio.sleep(3600)

    async def _cleanup_old_feedback(self) -> None:
        """Clean up old feedback to prevent memory growth"""
        cutoff_date = datetime.now() - timedelta(days=self.feedback_retention_days)

        # Remove old feedback
        old_feedback_ids = [
            fid
            for fid, feedback in self.feedback_items.items()
            if feedback.created_at < cutoff_date
        ]

        for fid in old_feedback_ids:
            del self.feedback_items[fid]

        self.logger.info(f"Cleaned up {len(old_feedback_ids)} old feedback items")
