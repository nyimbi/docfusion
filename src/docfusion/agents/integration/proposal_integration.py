"""
Proposal Integration

Integration layer connecting AI agents with the existing proposal generation
system, enabling seamless agent-driven proposal workflows.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Union

from pydantic import BaseModel, ConfigDict, Field

try:
    from uuid_extensions import uuid7str
except ImportError:
    import uuid

    def uuid7str() -> str:
        return str(uuid.uuid4())


from ..orchestration.crew_manager import AgentCrew, CrewConfig
from ..orchestration.swarm_manager import AgentSwarm, SwarmConfig
from ..orchestration.task_orchestrator import (
    TaskOrchestrator,
    WorkflowDefinition,
    WorkflowEngine,
)
from ..specialists import QualityAgent, ResearchAgent, ReviewerAgent, WriterAgent


@dataclass
class ProposalRequirements:
    """Proposal generation requirements"""

    client_name: str
    project_title: str
    project_description: str
    deadline: datetime
    budget_range: Optional[tuple] = None
    industry: Optional[str] = None
    proposal_type: str = "business"  # business, technical, research
    sections_required: List[str] = field(default_factory=list)
    style_requirements: Dict[str, Any] = field(default_factory=dict)
    compliance_requirements: List[str] = field(default_factory=list)
    target_audience: str = "decision_makers"


@dataclass
class ProposalContext:
    """Context for proposal generation"""

    requirements: ProposalRequirements
    client_profile: Dict[str, Any] = field(default_factory=dict)
    competitive_landscape: Dict[str, Any] = field(default_factory=dict)
    organizational_context: Dict[str, Any] = field(default_factory=dict)
    previous_proposals: List[Dict[str, Any]] = field(default_factory=list)
    templates_available: List[str] = field(default_factory=list)
    resources: Dict[str, Any] = field(default_factory=dict)


class ProposalAgentBridge:
    """
    Bridge connecting agent system with proposal generation components

    Provides unified interface for agent-driven proposal creation
    with integration to existing document and voice systems.
    """

    def __init__(self):
        # Agent orchestration systems
        self.task_orchestrator: Optional[TaskOrchestrator] = None
        self.workflow_engine: Optional[WorkflowEngine] = None

        # Active orchestration instances
        self.active_crews: Dict[str, AgentCrew] = {}
        self.active_swarms: Dict[str, AgentSwarm] = {}

        # Integration services (will be injected)
        self.voice_integrator = None
        self.document_engine = None
        self.storage_service = None
        self.rag_service = None

        self.logger = logging.getLogger("proposal_agent_bridge")
        self.logger.info("Proposal Agent Bridge initialized")

    async def initialize(self, services: Dict[str, Any]) -> None:
        """Initialize with external service dependencies"""
        # Initialize orchestration systems
        self.task_orchestrator = TaskOrchestrator()
        self.workflow_engine = WorkflowEngine(self.task_orchestrator)

        await self.task_orchestrator.start()

        # Store service references
        self.voice_integrator = services.get("voice_integrator")
        self.document_engine = services.get("document_engine")
        self.storage_service = services.get("storage_service")
        self.rag_service = services.get("rag_service")

        self.logger.info("Proposal Agent Bridge initialized with services")

    async def generate_proposal_with_crew(
        self, context: ProposalContext
    ) -> Dict[str, Any]:
        """Generate proposal using crew-based approach"""
        try:
            # Create proposal-specific crew
            crew_config = CrewConfig(
                name=f"Proposal_{context.requirements.client_name}",
                description=f"Proposal generation for {context.requirements.project_title}",
                required_roles=["researcher", "writer", "reviewer", "quality"],
                collaboration_mode="coordinated",
                quality_threshold=0.9,
            )

            crew = AgentCrew(crew_config)

            # Configure agents for proposal context
            agent_configs = await self._create_proposal_agent_configs(context)

            # Assemble crew
            await crew.assemble_crew(agent_configs)

            # Create proposal workflow tasks
            workflow_tasks = await self._create_proposal_workflow_tasks(context)

            # Execute proposal generation
            result = await crew.execute_workflow(workflow_tasks)

            # Store crew for potential reuse
            self.active_crews[crew.crew_id] = crew

            # Process and format results
            proposal_result = await self._process_crew_results(result, context)

            self.logger.info(f"Proposal generated successfully using crew approach")
            return proposal_result

        except Exception as e:
            self.logger.error(f"Crew-based proposal generation failed: {e}")
            raise

    async def generate_proposal_with_swarm(
        self, context: ProposalContext
    ) -> Dict[str, Any]:
        """Generate proposal using swarm intelligence approach"""
        try:
            # Create swarm configuration
            swarm_config = SwarmConfig(
                name=f"ProposalSwarm_{context.requirements.client_name}",
                description=f"Swarm intelligence proposal generation for {context.requirements.project_title}",
                target_size=6,
                primary_behavior="collaborative",
                optimization_target="quality",
            )

            swarm = AgentSwarm(swarm_config)

            # Initialize swarm with agents
            agent_configs = await self._create_proposal_agent_configs(context)
            await swarm.initialize_swarm(agent_configs)

            # Create swarm tasks
            swarm_tasks = await self._create_proposal_swarm_tasks(context)

            # Execute swarm workflow
            result = await swarm.execute_swarm_workflow(swarm_tasks)

            # Store swarm reference
            self.active_swarms[swarm.swarm_id] = swarm

            # Process results
            proposal_result = await self._process_swarm_results(result, context)

            self.logger.info(f"Proposal generated successfully using swarm approach")
            return proposal_result

        except Exception as e:
            self.logger.error(f"Swarm-based proposal generation failed: {e}")
            raise

    async def generate_proposal_with_workflow(self, context: ProposalContext) -> str:
        """Generate proposal using workflow orchestrator"""
        try:
            # Create custom proposal workflow or use template
            workflow_def = await self._create_proposal_workflow_definition(context)

            # Register workflow
            await self.task_orchestrator.register_workflow(workflow_def)

            # Execute workflow
            execution_context = {
                "proposal_context": context.__dict__,
                "client_name": context.requirements.client_name,
                "project_title": context.requirements.project_title,
                "voice_integrator": self.voice_integrator,
                "document_engine": self.document_engine,
                "storage_service": self.storage_service,
                "rag_service": self.rag_service,
            }

            execution_id = await self.task_orchestrator.execute_workflow(
                workflow_def.workflow_id, execution_context
            )

            self.logger.info(f"Proposal workflow execution started: {execution_id}")
            return execution_id

        except Exception as e:
            self.logger.error(f"Workflow-based proposal generation failed: {e}")
            raise

    async def _create_proposal_agent_configs(
        self, context: ProposalContext
    ) -> List[Dict[str, Any]]:
        """Create agent configurations for proposal generation"""
        configs = []

        # Research Agent Configuration
        configs.append(
            {
                "type": "researcher",
                "role": "researcher",
                "config": {
                    "research_domains": [context.requirements.industry]
                    if context.requirements.industry
                    else ["business"],
                    "depth_level": "comprehensive",
                    "competitive_analysis": True,
                    "client_profile": context.client_profile,
                    "rag_integration": self.rag_service is not None,
                },
            }
        )

        # Writer Agent Configuration
        configs.append(
            {
                "type": "writer",
                "role": "writer",
                "config": {
                    "writing_style": context.requirements.style_requirements.get(
                        "style", "professional"
                    ),
                    "target_audience": context.requirements.target_audience,
                    "proposal_type": context.requirements.proposal_type,
                    "voice_integration": self.voice_integrator is not None,
                    "organization_profile": context.organizational_context.get(
                        "organization_name", "default"
                    ),
                },
            }
        )

        # Reviewer Agent Configuration
        configs.append(
            {
                "type": "reviewer",
                "role": "reviewer",
                "config": {
                    "review_criteria": context.requirements.compliance_requirements,
                    "quality_standards": {
                        "minimum_score": 0.85,
                        "voice_consistency": 0.9,
                    },
                    "proposal_standards": True,
                },
            }
        )

        # Quality Agent Configuration
        configs.append(
            {
                "type": "quality",
                "role": "quality",
                "config": {
                    "voice_integration": self.voice_integrator is not None,
                    "organization_profile": context.organizational_context.get(
                        "organization_name", "default"
                    ),
                    "quality_thresholds": {
                        "voice_consistency": 0.95,
                        "readability": 0.9,
                        "engagement": 0.85,
                        "compliance": 0.95,
                    },
                },
            }
        )

        # Coordinator Agent for complex proposals
        if len(context.requirements.sections_required) > 5:
            configs.append(
                {
                    "type": "coordinator",
                    "role": "coordinator",
                    "config": {
                        "coordination_style": "collaborative",
                        "workflow_management": True,
                    },
                }
            )

        return configs

    async def _create_proposal_workflow_tasks(
        self, context: ProposalContext
    ) -> List[Any]:
        """Create workflow tasks for crew execution"""
        from ..orchestration.crew_manager import CrewTask, TaskPriority

        tasks = []

        # Research Phase
        research_task = CrewTask(
            task_id="research_phase",
            description="Comprehensive research and client analysis",
            task_type="research",
            priority=TaskPriority.HIGH,
            context={
                "client_name": context.requirements.client_name,
                "industry": context.requirements.industry,
                "project_description": context.requirements.project_description,
                "competitive_analysis": True,
            },
        )
        tasks.append(research_task)

        # Content Planning
        planning_task = CrewTask(
            task_id="content_planning",
            description="Create proposal structure and content plan",
            task_type="planning",
            priority=TaskPriority.HIGH,
            dependencies=["research_phase"],
            context={
                "sections_required": context.requirements.sections_required,
                "proposal_type": context.requirements.proposal_type,
                "target_audience": context.requirements.target_audience,
            },
        )
        tasks.append(planning_task)

        # Content Generation
        for i, section in enumerate(
            context.requirements.sections_required
            or ["executive_summary", "approach", "timeline", "budget"]
        ):
            writing_task = CrewTask(
                task_id=f"write_{section}",
                description=f"Write {section} section",
                task_type="writing",
                priority=TaskPriority.MEDIUM,
                dependencies=["content_planning"],
                context={
                    "section_name": section,
                    "style_requirements": context.requirements.style_requirements,
                    "voice_profile": context.organizational_context.get(
                        "organization_name"
                    ),
                },
            )
            tasks.append(writing_task)

        # Review and Quality Assurance
        review_task = CrewTask(
            task_id="review_quality",
            description="Comprehensive review and quality assurance",
            task_type="review",
            priority=TaskPriority.HIGH,
            dependencies=[
                f"write_{s}"
                for s in (
                    context.requirements.sections_required
                    or ["executive_summary", "approach", "timeline", "budget"]
                )
            ],
            context={
                "quality_standards": {"voice_consistency": 0.95, "compliance": 0.9},
                "compliance_requirements": context.requirements.compliance_requirements,
            },
        )
        tasks.append(review_task)

        # Final Assembly
        assembly_task = CrewTask(
            task_id="final_assembly",
            description="Assemble final proposal document",
            task_type="assembly",
            priority=TaskPriority.HIGH,
            dependencies=["review_quality"],
            context={
                "document_format": "professional",
                "client_branding": context.client_profile.get(
                    "branding_requirements", {}
                ),
                "output_formats": ["pdf", "docx"],
            },
        )
        tasks.append(assembly_task)

        return tasks

    async def _create_proposal_swarm_tasks(self, context: ProposalContext) -> List[Any]:
        """Create swarm tasks for distributed execution"""
        from ..orchestration.swarm_manager import SwarmTask

        tasks = []

        # Distributed research tasks
        research_tasks = [
            "client_analysis",
            "market_research",
            "competitive_analysis",
            "technical_requirements",
            "budget_analysis",
        ]

        for task_name in research_tasks:
            task = SwarmTask(
                task_id=f"research_{task_name}",
                description=f"Research: {task_name.replace('_', ' ').title()}",
                task_type="research",
                complexity=0.6,
                required_agents=2,
                context=context.__dict__,
            )
            tasks.append(task)

        # Content generation tasks
        sections = context.requirements.sections_required or [
            "executive_summary",
            "problem_statement",
            "proposed_solution",
            "methodology",
            "timeline",
            "budget",
            "team",
            "conclusion",
        ]

        for section in sections:
            task = SwarmTask(
                task_id=f"content_{section}",
                description=f"Generate {section} content",
                task_type="writing",
                complexity=0.7,
                required_agents=1,
                dependencies=[
                    f"research_{t}" for t in research_tasks[:3]
                ],  # Depend on key research
                context={
                    "section": section,
                    "style": context.requirements.style_requirements,
                    "audience": context.requirements.target_audience,
                },
            )
            tasks.append(task)

        return tasks

    async def _create_proposal_workflow_definition(
        self, context: ProposalContext
    ) -> WorkflowDefinition:
        """Create workflow definition for proposal generation"""
        # Use the workflow engine's built-in proposal template
        return await self.workflow_engine.create_proposal_workflow(
            client_context={
                "client_name": context.requirements.client_name,
                "project_title": context.requirements.project_title,
                "industry": context.requirements.industry,
                "proposal_type": context.requirements.proposal_type,
                "sections": context.requirements.sections_required,
                "quality_requirements": {
                    "voice_consistency": 0.95,
                    "compliance_score": 0.9,
                },
                "voice_integrator": self.voice_integrator,
                "document_engine": self.document_engine,
            }
        )

    async def _process_crew_results(
        self, crew_result: Dict[str, Any], context: ProposalContext
    ) -> Dict[str, Any]:
        """Process and format crew execution results"""
        if not crew_result.get("success"):
            raise RuntimeError(f"Crew execution failed: {crew_result.get('error')}")

        # Extract task results
        task_results = crew_result.get("results", {})

        # Compile proposal sections
        proposal_sections = {}
        for task_id, result in task_results.items():
            if task_id.startswith("write_"):
                section_name = task_id.replace("write_", "")
                proposal_sections[section_name] = result

        # Compile final result
        return {
            "proposal_id": uuid7str(),
            "client_name": context.requirements.client_name,
            "project_title": context.requirements.project_title,
            "sections": proposal_sections,
            "metadata": {
                "generation_method": "crew_based",
                "crew_metrics": crew_result.get("metrics", {}),
                "completed_tasks": crew_result.get("completed_tasks", 0),
                "generation_timestamp": datetime.now().isoformat(),
            },
            "quality_scores": task_results.get("review_quality", {}),
            "final_document": task_results.get("final_assembly", {}),
        }

    async def _process_swarm_results(
        self, swarm_result: Dict[str, Any], context: ProposalContext
    ) -> Dict[str, Any]:
        """Process and format swarm execution results"""
        if not swarm_result.get("success"):
            raise RuntimeError(f"Swarm execution failed: {swarm_result.get('error')}")

        # Extract and organize swarm results
        results = swarm_result.get("results", {})

        # Separate research and content results
        research_results = {
            k: v for k, v in results.items() if k.startswith("research_")
        }
        content_results = {k: v for k, v in results.items() if k.startswith("content_")}

        return {
            "proposal_id": uuid7str(),
            "client_name": context.requirements.client_name,
            "project_title": context.requirements.project_title,
            "research_insights": research_results,
            "content_sections": content_results,
            "metadata": {
                "generation_method": "swarm_based",
                "swarm_metrics": swarm_result.get("swarm_metrics", {}),
                "collective_intelligence": swarm_result.get(
                    "collective_intelligence", 0.0
                ),
                "generation_timestamp": datetime.now().isoformat(),
            },
        }

    async def get_execution_status(self, execution_id: str) -> Optional[Dict[str, Any]]:
        """Get workflow execution status"""
        if self.task_orchestrator:
            return self.task_orchestrator.get_execution_status(execution_id)
        return None

    async def cleanup_completed_executions(self) -> None:
        """Clean up completed crews and swarms"""
        # Cleanup crews
        completed_crews = []
        for crew_id, crew in self.active_crews.items():
            if crew.status in ["completed", "disbanded"]:
                completed_crews.append(crew_id)

        for crew_id in completed_crews:
            await self.active_crews[crew_id].disband_crew()
            del self.active_crews[crew_id]

        # Cleanup swarms
        completed_swarms = []
        for swarm_id, swarm in self.active_swarms.items():
            if swarm.state in ["dormant", "error"]:
                completed_swarms.append(swarm_id)

        for swarm_id in completed_swarms:
            await self.active_swarms[swarm_id].stop_swarm()
            del self.active_swarms[swarm_id]

    def get_integration_status(self) -> Dict[str, Any]:
        """Get integration status and metrics"""
        return {
            "orchestrator_running": self.task_orchestrator
            and self.task_orchestrator._running,
            "active_crews": len(self.active_crews),
            "active_swarms": len(self.active_swarms),
            "services_integrated": {
                "voice_integrator": self.voice_integrator is not None,
                "document_engine": self.document_engine is not None,
                "storage_service": self.storage_service is not None,
                "rag_service": self.rag_service is not None,
            },
        }


class ProposalIntegration:
    """
    Main integration service for proposal generation

    Provides high-level interface for agent-driven proposal generation
    with automatic service discovery and orchestration.
    """

    def __init__(self):
        self.bridge = ProposalAgentBridge()
        self.services: Dict[str, Any] = {}
        self._initialized = False

        self.logger = logging.getLogger("proposal_integration")

    async def initialize(
        self, services: Dict[str, Any] = field(default_factory=dict)
    ) -> None:
        """Initialize proposal integration with services"""
        if services:
            self.services.update(services)

        # Initialize bridge with services
        await self.bridge.initialize(self.services)
        self._initialized = True

        self.logger.info("Proposal Integration initialized")

    async def generate_proposal(
        self,
        requirements: ProposalRequirements,
        context: Optional[ProposalContext] = None,
        method: str = "crew",
    ) -> Dict[str, Any]:
        """Generate proposal using specified method"""
        if not self._initialized:
            raise RuntimeError("ProposalIntegration not initialized")

        # Create context if not provided
        if context is None:
            context = ProposalContext(requirements=requirements)

        # Generate based on method
        if method == "crew":
            return await self.bridge.generate_proposal_with_crew(context)
        elif method == "swarm":
            return await self.bridge.generate_proposal_with_swarm(context)
        elif method == "workflow":
            execution_id = await self.bridge.generate_proposal_with_workflow(context)
            return {"execution_id": execution_id, "method": "workflow"}
        else:
            raise ValueError(f"Unknown generation method: {method}")

    async def register_service(self, service_name: str, service_instance: Any) -> None:
        """Register external service"""
        self.services[service_name] = service_instance

        if self._initialized:
            # Re-initialize bridge with new service
            await self.bridge.initialize(self.services)

    def get_status(self) -> Dict[str, Any]:
        """Get integration status"""
        return {
            "initialized": self._initialized,
            "services_count": len(self.services),
            "bridge_status": self.bridge.get_integration_status()
            if self._initialized
            else None,
        }
