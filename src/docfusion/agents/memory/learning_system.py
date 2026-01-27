"""
Learning System

Adaptive learning and experience accumulation system for agent
improvement and collective intelligence enhancement.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Union

from pydantic import BaseModel, ConfigDict, Field

try:
    from uuid_extensions import uuid7str
except ImportError:
    import uuid

    def uuid7str() -> str:
        return str(uuid.uuid4())


class LearningType(str, Enum):
    """Types of learning experiences"""

    SUCCESS = "success"
    FAILURE = "failure"
    ADAPTATION = "adaptation"
    DISCOVERY = "discovery"
    OPTIMIZATION = "optimization"


@dataclass
class ExperienceRecord:
    """Individual learning experience"""

    experience_id: str = field(default_factory=uuid7str)
    agent_id: str = ""
    learning_type: LearningType = LearningType.SUCCESS
    context: Dict[str, Any] = field(default_factory=dict)
    outcome: Dict[str, Any] = field(default_factory=dict)
    lessons_learned: List[str] = field(default_factory=list)
    performance_impact: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)


class AdaptationEngine:
    """
    Adaptive learning engine for behavioral optimization

    Processes experiences and adapts agent behavior based on
    learning outcomes and performance feedback.
    """

    def __init__(self):
        self.experiences: Dict[str, ExperienceRecord] = {}
        self.adaptation_patterns: Dict[str, Dict[str, Any]] = {}

        self.logger = logging.getLogger("adaptation_engine")
        self.logger.info("Adaptation engine initialized")

    async def record_experience(self, record: ExperienceRecord) -> str:
        """Record learning experience"""
        self.experiences[record.experience_id] = record
        await self._analyze_experience(record)
        return record.experience_id

    async def _analyze_experience(self, record: ExperienceRecord) -> None:
        """Analyze experience for learning opportunities"""
        # Simplified analysis - would implement more sophisticated learning algorithms
        pass

    async def get_adaptations(self, agent_id: str) -> Dict[str, Any]:
        """Get recommended adaptations for agent"""
        return self.adaptation_patterns.get(agent_id, {})


class LearningSystem:
    """
    Comprehensive learning system for multi-agent environments

    Manages experience collection, pattern recognition, and adaptive
    improvement across individual agents and collective systems.
    """

    def __init__(self):
        self.adaptation_engine = AdaptationEngine()
        self.collective_learning: Dict[str, Any] = {}

        self.logger = logging.getLogger("learning_system")
        self.logger.info("Learning system initialized")

    async def learn_from_experience(
        self, agent_id: str, experience: Dict[str, Any]
    ) -> None:
        """Process learning experience"""
        record = ExperienceRecord(
            agent_id=agent_id,
            context=experience.get("context", {}),
            outcome=experience.get("outcome", {}),
            lessons_learned=experience.get("lessons", []),
        )

        await self.adaptation_engine.record_experience(record)

    async def get_learning_insights(self, agent_id: str) -> Dict[str, Any]:
        """Get learning insights and recommendations"""
        return await self.adaptation_engine.get_adaptations(agent_id)
