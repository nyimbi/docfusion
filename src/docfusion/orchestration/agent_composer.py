"""
Agent Composer

Visual agent composition system for building complex workflows with
drag-and-drop functionality, prompt editing, and configuration management.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union

try:
    from uuid_extensions import uuid7str
except ImportError:
    import uuid

    def uuid7str() -> str:
        return str(uuid.uuid4())


from pydantic import BaseModel, ConfigDict, Field

from .workflow_engine import (
    NodeType,
    Workflow,
    WorkflowEdge,
    WorkflowNode,
    WorkflowType,
)


class AgentTemplate(str, Enum):
    """Built-in agent templates"""

    RESEARCH_AGENT = "research_agent"
    CONTENT_AGENT = "content_agent"
    ANALYSIS_AGENT = "analysis_agent"
    REVIEW_AGENT = "review_agent"
    EDITOR_AGENT = "editor_agent"
    LAYOUT_AGENT = "layout_agent"
    QA_AGENT = "qa_agent"
    CUSTOM_AGENT = "custom_agent"


class PromptTemplate(str, Enum):
    """Built-in prompt templates"""

    RESEARCH_QUERY = "research_query"
    CONTENT_GENERATION = "content_generation"
    DATA_ANALYSIS = "data_analysis"
    DOCUMENT_REVIEW = "document_review"
    EDITING_INSTRUCTIONS = "editing_instructions"
    LAYOUT_SPECIFICATIONS = "layout_specifications"
    QUALITY_CHECK = "quality_check"
    CUSTOM_PROMPT = "custom_prompt"


@dataclass
class AgentConfiguration:
    """Complete agent configuration"""

    agent_id: str = field(default_factory=uuid7str)
    name: str = ""
    description: str = ""
    agent_type: AgentTemplate = AgentTemplate.CUSTOM_AGENT

    # Core configuration
    model_name: str = "qwen2.5:1.5b"
    temperature: float = 0.7
    max_tokens: int = 2000
    timeout: int = 300

    # Prompt configuration
    system_prompt: str = ""
    prompt_template: PromptTemplate = PromptTemplate.CUSTOM_PROMPT
    custom_prompt: str = ""
    input_variables: List[str] = field(default_factory=list)
    output_format: str = "text"  # text, json, markdown

    # Capabilities and tools
    enabled_tools: List[str] = field(default_factory=list)
    capabilities: List[str] = field(default_factory=list)

    # Behavior settings
    retry_attempts: int = 3
    error_handling: str = "continue"  # continue, stop, retry

    # Context and memory
    context_window: int = 4000
    memory_enabled: bool = True
    conversation_history: int = 10

    # Integration settings
    external_apis: Dict[str, Any] = field(default_factory=dict)
    databases: List[str] = field(default_factory=list)

    # Metadata
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    version: str = "1.0"
    tags: List[str] = field(default_factory=list)


@dataclass
class WorkflowTemplate:
    """Predefined workflow template"""

    template_id: str = field(default_factory=uuid7str)
    name: str = ""
    description: str = ""
    category: str = "general"

    # Template structure
    nodes: List[Dict[str, Any]] = field(default_factory=list)
    edges: List[Dict[str, Any]] = field(default_factory=list)

    # Configuration
    default_settings: Dict[str, Any] = field(default_factory=dict)
    required_parameters: List[str] = field(default_factory=list)

    # Metadata
    difficulty: str = "beginner"  # beginner, intermediate, advanced
    estimated_time: int = 300  # seconds
    tags: List[str] = field(default_factory=list)


class AgentComposer:
    """
    Visual agent composition system

    Provides tools for building, configuring, and managing complex agent workflows
    with drag-and-drop functionality and visual editing capabilities.
    """

    def __init__(self):
        self.logger = logging.getLogger("agent_composer")

        # Built-in templates
        self.agent_templates = self._initialize_agent_templates()
        self.prompt_templates = self._initialize_prompt_templates()
        self.workflow_templates = self._initialize_workflow_templates()

        # Custom configurations
        self.custom_agents: Dict[str, AgentConfiguration] = {}
        self.custom_workflows: Dict[str, WorkflowTemplate] = {}

        # Workspace state
        self.current_workspace: Optional[Dict[str, Any]] = None

    async def create_agent(self, agent_config: AgentConfiguration) -> Dict[str, Any]:
        """
        Create a new agent configuration

        Args:
                agent_config: Agent configuration

        Returns:
                Created agent information
        """
        try:
            # Validate configuration
            await self._validate_agent_config(agent_config)

            # Apply template if specified
            if agent_config.agent_type != AgentTemplate.CUSTOM_AGENT:
                template = self.agent_templates.get(agent_config.agent_type)
                if template:
                    agent_config = await self._apply_agent_template(
                        agent_config, template
                    )

            # Store custom agent
            self.custom_agents[agent_config.agent_id] = agent_config

            result = {
                "agent_id": agent_config.agent_id,
                "name": agent_config.name,
                "type": agent_config.agent_type.value,
                "status": "created",
                "created_at": agent_config.created_at.isoformat(),
                "success": True,
            }

            self.logger.info(f"Agent created: {agent_config.name}")

            return result

        except Exception as e:
            self.logger.error(f"Agent creation failed: {e}")
            return {"error": str(e), "success": False}

    async def edit_agent_prompt(
        self, agent_id: str, new_prompt: str, variables: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Edit agent prompt template

        Args:
                agent_id: Agent identifier
                new_prompt: New prompt template
                variables: Input variables for the prompt

        Returns:
                Update result
        """
        try:
            if agent_id not in self.custom_agents:
                raise ValueError(f"Agent {agent_id} not found")

            agent = self.custom_agents[agent_id]

            # Update prompt
            agent.custom_prompt = new_prompt
            agent.input_variables = variables or []
            agent.updated_at = datetime.now()

            # Validate prompt
            validation_result = await self._validate_prompt(new_prompt, variables)

            result = {
                "agent_id": agent_id,
                "prompt_updated": True,
                "validation": validation_result,
                "updated_at": agent.updated_at.isoformat(),
                "success": True,
            }

            self.logger.info(f"Agent prompt updated: {agent_id}")

            return result

        except Exception as e:
            self.logger.error(f"Prompt update failed: {e}")
            return {"error": str(e), "success": False}

    async def create_workflow(
        self, workflow_name: str, workflow_type: WorkflowType = WorkflowType.SEQUENTIAL
    ) -> Dict[str, Any]:
        """
        Create a new workflow

        Args:
                workflow_name: Name of the workflow
                workflow_type: Type of workflow execution

        Returns:
                Created workflow information
        """
        try:
            workflow = Workflow(
                name=workflow_name,
                workflow_type=workflow_type,
                created_at=datetime.now(),
            )

            # Initialize workspace
            self.current_workspace = {
                "workflow": workflow,
                "canvas_elements": [],
                "connections": [],
                "selected_elements": [],
                "clipboard": [],
                "history": [],
                "undo_stack": [],
                "redo_stack": [],
            }

            result = {
                "workflow_id": workflow.workflow_id,
                "name": workflow.name,
                "type": workflow.workflow_type.value,
                "status": "created",
                "created_at": workflow.created_at.isoformat(),
                "success": True,
            }

            self.logger.info(f"Workflow created: {workflow_name}")

            return result

        except Exception as e:
            self.logger.error(f"Workflow creation failed: {e}")
            return {"error": str(e), "success": False}

    async def add_agent_to_workflow(
        self, agent_config: AgentConfiguration, position: Tuple[float, float] = (0, 0)
    ) -> Dict[str, Any]:
        """
        Add agent to current workflow

        Args:
                agent_config: Agent configuration
                position: Visual position on canvas

        Returns:
                Addition result
        """
        try:
            if not self.current_workspace:
                raise ValueError("No active workflow workspace")

            workflow = self.current_workspace["workflow"]

            # Create workflow node from agent
            node = WorkflowNode(
                node_id=agent_config.agent_id,
                node_type=NodeType.AGENT,
                name=agent_config.name,
                agent_type=agent_config.agent_type.value,
                agent_config=self._agent_config_to_dict(agent_config),
                prompt_template=agent_config.custom_prompt
                or agent_config.system_prompt,
                position=position,
                timeout=agent_config.timeout,
                retry_count=agent_config.retry_attempts,
            )

            # Add to workflow
            workflow.nodes[node.node_id] = node

            # Add to canvas elements
            canvas_element = {
                "id": node.node_id,
                "type": "agent",
                "name": node.name,
                "position": position,
                "size": (200, 100),
                "config": agent_config,
                "selected": False,
                "dragging": False,
            }

            self.current_workspace["canvas_elements"].append(canvas_element)

            # Save to history
            await self._save_workspace_state()

            result = {
                "node_id": node.node_id,
                "agent_name": agent_config.name,
                "position": position,
                "status": "added",
                "success": True,
            }

            self.logger.info(f"Agent added to workflow: {agent_config.name}")

            return result

        except Exception as e:
            self.logger.error(f"Failed to add agent to workflow: {e}")
            return {"error": str(e), "success": False}

    async def connect_agents(
        self,
        source_agent_id: str,
        target_agent_id: str,
        condition: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create connection between agents

        Args:
                source_agent_id: Source agent ID
                target_agent_id: Target agent ID
                condition: Optional condition for the connection

        Returns:
                Connection result
        """
        try:
            if not self.current_workspace:
                raise ValueError("No active workflow workspace")

            workflow = self.current_workspace["workflow"]

            # Validate agents exist
            if source_agent_id not in workflow.nodes:
                raise ValueError(f"Source agent {source_agent_id} not found")
            if target_agent_id not in workflow.nodes:
                raise ValueError(f"Target agent {target_agent_id} not found")

            # Create edge
            edge = WorkflowEdge(
                edge_id=uuid7str(),
                source_node=source_agent_id,
                target_node=target_agent_id,
                condition=condition,
            )

            workflow.edges.append(edge)

            # Add to canvas connections
            connection = {
                "id": edge.edge_id,
                "source": source_agent_id,
                "target": target_agent_id,
                "condition": condition,
                "style": "solid",
                "selected": False,
            }

            self.current_workspace["connections"].append(connection)

            # Save to history
            await self._save_workspace_state()

            result = {
                "edge_id": edge.edge_id,
                "source": source_agent_id,
                "target": target_agent_id,
                "condition": condition,
                "status": "connected",
                "success": True,
            }

            self.logger.info(
                f"Agents connected: {source_agent_id} -> {target_agent_id}"
            )

            return result

        except Exception as e:
            self.logger.error(f"Agent connection failed: {e}")
            return {"error": str(e), "success": False}

    async def arrange_agents(self, arrangement: str = "hierarchical") -> Dict[str, Any]:
        """
        Auto-arrange agents on canvas

        Args:
                arrangement: Arrangement type (hierarchical, grid, circular, force)

        Returns:
                Arrangement result
        """
        try:
            if not self.current_workspace:
                raise ValueError("No active workflow workspace")

            workflow = self.current_workspace["workflow"]
            canvas_elements = self.current_workspace["canvas_elements"]

            if arrangement == "hierarchical":
                positions = await self._arrange_hierarchical(
                    workflow.nodes, workflow.edges
                )
            elif arrangement == "grid":
                positions = await self._arrange_grid(workflow.nodes)
            elif arrangement == "circular":
                positions = await self._arrange_circular(workflow.nodes)
            elif arrangement == "force":
                positions = await self._arrange_force_directed(
                    workflow.nodes, workflow.edges
                )
            else:
                raise ValueError(f"Unknown arrangement type: {arrangement}")

            # Update positions
            for element in canvas_elements:
                if element["id"] in positions:
                    element["position"] = positions[element["id"]]
                    workflow.nodes[element["id"]].position = positions[element["id"]]

            # Save to history
            await self._save_workspace_state()

            result = {
                "arrangement": arrangement,
                "nodes_arranged": len(positions),
                "positions": positions,
                "success": True,
            }

            self.logger.info(f"Agents arranged: {arrangement}")

            return result

        except Exception as e:
            self.logger.error(f"Agent arrangement failed: {e}")
            return {"error": str(e), "success": False}

    async def get_workflow_templates(
        self, category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get available workflow templates

        Args:
                category: Optional category filter

        Returns:
                Available templates
        """
        templates = list(self.workflow_templates.values())

        if category:
            templates = [t for t in templates if t.category == category]

        template_list = []
        for template in templates:
            template_list.append(
                {
                    "template_id": template.template_id,
                    "name": template.name,
                    "description": template.description,
                    "category": template.category,
                    "difficulty": template.difficulty,
                    "estimated_time": template.estimated_time,
                    "node_count": len(template.nodes),
                    "tags": template.tags,
                }
            )

        return {
            "templates": template_list,
            "total": len(template_list),
            "categories": list(set(t["category"] for t in template_list)),
            "success": True,
        }

    async def apply_workflow_template(
        self, template_id: str, parameters: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Apply a workflow template to current workspace

        Args:
                template_id: Template identifier
                parameters: Template parameters

        Returns:
                Application result
        """
        try:
            if template_id not in self.workflow_templates:
                raise ValueError(f"Template {template_id} not found")

            template = self.workflow_templates[template_id]
            parameters = parameters or {}

            # Validate required parameters
            missing_params = [
                p for p in template.required_parameters if p not in parameters
            ]
            if missing_params:
                raise ValueError(f"Missing required parameters: {missing_params}")

            if not self.current_workspace:
                await self.create_workflow(f"Workflow from {template.name}")

            workflow = self.current_workspace["workflow"]

            # Apply template nodes
            for node_config in template.nodes:
                node_config = await self._apply_parameters(node_config, parameters)

                node = WorkflowNode(
                    node_id=node_config.get("node_id", uuid7str()),
                    node_type=NodeType(node_config.get("node_type", "agent")),
                    name=node_config.get("name", "Agent"),
                    agent_type=node_config.get("agent_type"),
                    prompt_template=node_config.get("prompt_template"),
                    position=tuple(node_config.get("position", [0, 0])),
                    timeout=node_config.get("timeout", 300),
                )

                workflow.nodes[node.node_id] = node

            # Apply template edges
            for edge_config in template.edges:
                edge_config = await self._apply_parameters(edge_config, parameters)

                edge = WorkflowEdge(
                    edge_id=edge_config.get("edge_id", uuid7str()),
                    source_node=edge_config.get("source_node"),
                    target_node=edge_config.get("target_node"),
                    condition=edge_config.get("condition"),
                )

                workflow.edges.append(edge)

            # Update canvas elements
            await self._sync_canvas_with_workflow()

            result = {
                "template_id": template_id,
                "template_name": template.name,
                "nodes_added": len(template.nodes),
                "edges_added": len(template.edges),
                "success": True,
            }

            self.logger.info(f"Workflow template applied: {template.name}")

            return result

        except Exception as e:
            self.logger.error(f"Template application failed: {e}")
            return {"error": str(e), "success": False}

    async def export_workflow(self, format_type: str = "json") -> Dict[str, Any]:
        """
        Export current workflow

        Args:
                format_type: Export format (json, yaml, visual)

        Returns:
                Export result
        """
        try:
            if not self.current_workspace:
                raise ValueError("No active workflow workspace")

            workflow = self.current_workspace["workflow"]

            if format_type == "json":
                export_data = await self._export_to_json(workflow)
            elif format_type == "yaml":
                export_data = await self._export_to_yaml(workflow)
            elif format_type == "visual":
                export_data = await self._export_visual_representation(workflow)
            else:
                raise ValueError(f"Unsupported export format: {format_type}")

            result = {
                "workflow_id": workflow.workflow_id,
                "format": format_type,
                "data": export_data,
                "exported_at": datetime.now().isoformat(),
                "success": True,
            }

            self.logger.info(f"Workflow exported: {format_type}")

            return result

        except Exception as e:
            self.logger.error(f"Workflow export failed: {e}")
            return {"error": str(e), "success": False}

    async def undo_action(self) -> Dict[str, Any]:
        """Undo last action"""
        try:
            if not self.current_workspace or not self.current_workspace["undo_stack"]:
                return {"message": "Nothing to undo", "success": True}

            # Move current state to redo stack
            current_state = await self._get_workspace_state()
            self.current_workspace["redo_stack"].append(current_state)

            # Restore previous state
            previous_state = self.current_workspace["undo_stack"].pop()
            await self._restore_workspace_state(previous_state)

            return {"action": "undo", "success": True}

        except Exception as e:
            self.logger.error(f"Undo failed: {e}")
            return {"error": str(e), "success": False}

    async def redo_action(self) -> Dict[str, Any]:
        """Redo last undone action"""
        try:
            if not self.current_workspace or not self.current_workspace["redo_stack"]:
                return {"message": "Nothing to redo", "success": True}

            # Move current state to undo stack
            current_state = await self._get_workspace_state()
            self.current_workspace["undo_stack"].append(current_state)

            # Restore next state
            next_state = self.current_workspace["redo_stack"].pop()
            await self._restore_workspace_state(next_state)

            return {"action": "redo", "success": True}

        except Exception as e:
            self.logger.error(f"Redo failed: {e}")
            return {"error": str(e), "success": False}

    # Private helper methods

    async def _validate_agent_config(self, config: AgentConfiguration):
        """Validate agent configuration"""
        if not config.name:
            raise ValueError("Agent name is required")

        if config.temperature < 0 or config.temperature > 2:
            raise ValueError("Temperature must be between 0 and 2")

        if config.max_tokens < 1:
            raise ValueError("Max tokens must be positive")

    async def _validate_prompt(
        self, prompt: str, variables: List[str]
    ) -> Dict[str, Any]:
        """Validate prompt template"""
        validation = {"valid": True, "issues": [], "suggestions": []}

        if not prompt.strip():
            validation["valid"] = False
            validation["issues"].append("Prompt cannot be empty")

        # Check for variable placeholders
        import re

        found_vars = re.findall(r"\{(\w+)\}", prompt)

        missing_vars = [var for var in found_vars if var not in variables]
        if missing_vars:
            validation["issues"].append(f"Missing variables: {missing_vars}")

        unused_vars = [var for var in variables if var not in found_vars]
        if unused_vars:
            validation["suggestions"].append(f"Unused variables: {unused_vars}")

        return validation

    async def _apply_agent_template(
        self, config: AgentConfiguration, template: Dict[str, Any]
    ) -> AgentConfiguration:
        """Apply agent template to configuration"""
        # Apply template defaults
        for key, value in template.items():
            if hasattr(config, key) and getattr(config, key) in [None, "", []]:
                setattr(config, key, value)

        return config

    def _agent_config_to_dict(self, config: AgentConfiguration) -> Dict[str, Any]:
        """Convert agent configuration to dictionary"""
        return {
            "agent_id": config.agent_id,
            "name": config.name,
            "agent_type": config.agent_type.value,
            "model_name": config.model_name,
            "temperature": config.temperature,
            "max_tokens": config.max_tokens,
            "timeout": config.timeout,
            "system_prompt": config.system_prompt,
            "custom_prompt": config.custom_prompt,
            "enabled_tools": config.enabled_tools,
            "capabilities": config.capabilities,
        }

    async def _save_workspace_state(self):
        """Save current workspace state to history"""
        if not self.current_workspace:
            return

        state = await self._get_workspace_state()
        self.current_workspace["undo_stack"].append(state)

        # Limit undo stack size
        if len(self.current_workspace["undo_stack"]) > 20:
            self.current_workspace["undo_stack"].pop(0)

        # Clear redo stack when new action is performed
        self.current_workspace["redo_stack"].clear()

    async def _get_workspace_state(self) -> Dict[str, Any]:
        """Get current workspace state"""
        if not self.current_workspace:
            return {}

        return {
            "workflow": self.current_workspace["workflow"],
            "canvas_elements": self.current_workspace["canvas_elements"].copy(),
            "connections": self.current_workspace["connections"].copy(),
        }

    async def _restore_workspace_state(self, state: Dict[str, Any]):
        """Restore workspace state"""
        if not self.current_workspace:
            return

        self.current_workspace["workflow"] = state["workflow"]
        self.current_workspace["canvas_elements"] = state["canvas_elements"]
        self.current_workspace["connections"] = state["connections"]

    async def _arrange_hierarchical(
        self, nodes: Dict[str, WorkflowNode], edges: List[WorkflowEdge]
    ) -> Dict[str, Tuple[float, float]]:
        """Arrange nodes hierarchically"""
        positions = {}

        # Simple hierarchical layout
        levels = {}
        visited = set()

        # Find root nodes (no incoming edges)
        incoming = {node_id: [] for node_id in nodes.keys()}
        for edge in edges:
            incoming[edge.target_node].append(edge.source_node)

        roots = [node_id for node_id, sources in incoming.items() if not sources]
        if not roots:
            roots = [list(nodes.keys())[0]]

        # Assign levels using BFS
        queue = [(node_id, 0) for node_id in roots]

        while queue:
            node_id, level = queue.pop(0)
            if node_id not in visited:
                visited.add(node_id)

                if level not in levels:
                    levels[level] = []
                levels[level].append(node_id)

                # Add children
                children = [
                    edge.target_node for edge in edges if edge.source_node == node_id
                ]
                for child in children:
                    if child not in visited:
                        queue.append((child, level + 1))

        # Calculate positions
        level_height = 150
        node_spacing = 220

        for level, level_nodes in levels.items():
            y = level * level_height + 50
            start_x = 50

            if len(level_nodes) > 1:
                total_width = (len(level_nodes) - 1) * node_spacing
                start_x = (1200 - total_width) / 2  # Center horizontally

            for i, node_id in enumerate(level_nodes):
                x = start_x + i * node_spacing
                positions[node_id] = (x, y)

        return positions

    async def _arrange_grid(
        self, nodes: Dict[str, WorkflowNode]
    ) -> Dict[str, Tuple[float, float]]:
        """Arrange nodes in grid"""
        positions = {}

        import math

        node_count = len(nodes)
        cols = math.ceil(math.sqrt(node_count))
        rows = math.ceil(node_count / cols)

        spacing_x = 220
        spacing_y = 150
        start_x = 50
        start_y = 50

        for i, node_id in enumerate(nodes.keys()):
            row = i // cols
            col = i % cols

            x = start_x + col * spacing_x
            y = start_y + row * spacing_y

            positions[node_id] = (x, y)

        return positions

    async def _arrange_circular(
        self, nodes: Dict[str, WorkflowNode]
    ) -> Dict[str, Tuple[float, float]]:
        """Arrange nodes in circle"""
        positions = {}

        import math

        node_count = len(nodes)
        if node_count == 0:
            return positions

        center_x, center_y = 600, 300
        radius = 200

        for i, node_id in enumerate(nodes.keys()):
            angle = 2 * math.pi * i / node_count
            x = center_x + radius * math.cos(angle)
            y = center_y + radius * math.sin(angle)

            positions[node_id] = (x, y)

        return positions

    async def _arrange_force_directed(
        self, nodes: Dict[str, WorkflowNode], edges: List[WorkflowEdge]
    ) -> Dict[str, Tuple[float, float]]:
        """Arrange nodes using force-directed algorithm"""
        import math
        import random

        positions = {}

        # Initialize random positions
        for node_id in nodes.keys():
            positions[node_id] = (random.uniform(100, 1100), random.uniform(100, 700))

        # Force-directed simulation (simplified)
        for iteration in range(50):
            forces = {node_id: [0, 0] for node_id in nodes.keys()}

            # Repulsion between all nodes
            for node1_id in nodes.keys():
                for node2_id in nodes.keys():
                    if node1_id != node2_id:
                        x1, y1 = positions[node1_id]
                        x2, y2 = positions[node2_id]

                        dx = x1 - x2
                        dy = y1 - y2
                        distance = math.sqrt(dx * dx + dy * dy)

                        if distance > 0:
                            repulsion_force = 1000 / (distance * distance)
                            forces[node1_id][0] += (dx / distance) * repulsion_force
                            forces[node1_id][1] += (dy / distance) * repulsion_force

            # Attraction along edges
            for edge in edges:
                if edge.source_node in positions and edge.target_node in positions:
                    x1, y1 = positions[edge.source_node]
                    x2, y2 = positions[edge.target_node]

                    dx = x2 - x1
                    dy = y2 - y1
                    distance = math.sqrt(dx * dx + dy * dy)

                    if distance > 0:
                        attraction_force = distance * 0.01
                        forces[edge.source_node][0] += (
                            dx / distance
                        ) * attraction_force
                        forces[edge.source_node][1] += (
                            dy / distance
                        ) * attraction_force
                        forces[edge.target_node][0] -= (
                            dx / distance
                        ) * attraction_force
                        forces[edge.target_node][1] -= (
                            dy / distance
                        ) * attraction_force

            # Update positions
            for node_id in nodes.keys():
                x, y = positions[node_id]
                fx, fy = forces[node_id]

                # Apply forces with damping
                new_x = max(50, min(1150, x + fx * 0.1))
                new_y = max(50, min(750, y + fy * 0.1))

                positions[node_id] = (new_x, new_y)

        return positions

    async def _apply_parameters(
        self, config: Dict[str, Any], parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Apply parameters to configuration"""
        config_str = json.dumps(config)

        for key, value in parameters.items():
            placeholder = f"{{{key}}}"
            config_str = config_str.replace(placeholder, str(value))

        return json.loads(config_str)

    async def _sync_canvas_with_workflow(self):
        """Synchronize canvas elements with workflow"""
        if not self.current_workspace:
            return

        workflow = self.current_workspace["workflow"]

        # Update canvas elements from workflow nodes
        self.current_workspace["canvas_elements"] = []
        for node in workflow.nodes.values():
            element = {
                "id": node.node_id,
                "type": "agent",
                "name": node.name,
                "position": node.position,
                "size": node.size,
                "selected": False,
                "dragging": False,
            }
            self.current_workspace["canvas_elements"].append(element)

        # Update connections from workflow edges
        self.current_workspace["connections"] = []
        for edge in workflow.edges:
            connection = {
                "id": edge.edge_id,
                "source": edge.source_node,
                "target": edge.target_node,
                "condition": edge.condition,
                "style": edge.style,
                "selected": False,
            }
            self.current_workspace["connections"].append(connection)

    async def _export_to_json(self, workflow: Workflow) -> str:
        """Export workflow to JSON"""
        export_data = {
            "workflow_id": workflow.workflow_id,
            "name": workflow.name,
            "description": workflow.description,
            "workflow_type": workflow.workflow_type.value,
            "nodes": {},
            "edges": [],
            "created_at": workflow.created_at.isoformat(),
            "version": workflow.version,
        }

        # Export nodes
        for node_id, node in workflow.nodes.items():
            export_data["nodes"][node_id] = {
                "node_id": node.node_id,
                "node_type": node.node_type.value,
                "name": node.name,
                "agent_type": node.agent_type,
                "agent_config": node.agent_config,
                "prompt_template": node.prompt_template,
                "position": node.position,
                "timeout": node.timeout,
            }

        # Export edges
        for edge in workflow.edges:
            export_data["edges"].append(
                {
                    "edge_id": edge.edge_id,
                    "source_node": edge.source_node,
                    "target_node": edge.target_node,
                    "condition": edge.condition,
                    "data_mapping": edge.data_mapping,
                }
            )

        return json.dumps(export_data, indent=2)

    async def _export_to_yaml(self, workflow: Workflow) -> str:
        """Export workflow to YAML"""
        json_data = await self._export_to_json(workflow)
        data = json.loads(json_data)

        # Convert to YAML format
        import yaml

        return yaml.dump(data, default_flow_style=False, indent=2)

    async def _export_visual_representation(self, workflow: Workflow) -> Dict[str, Any]:
        """Export visual representation of workflow"""
        return {
            "canvas_size": workflow.canvas_size,
            "zoom_level": workflow.zoom_level,
            "nodes": [
                {
                    "id": node.node_id,
                    "name": node.name,
                    "type": node.node_type.value,
                    "position": node.position,
                    "size": node.size,
                    "color": node.color,
                }
                for node in workflow.nodes.values()
            ],
            "edges": [
                {
                    "id": edge.edge_id,
                    "source": edge.source_node,
                    "target": edge.target_node,
                    "style": edge.style,
                    "color": edge.color,
                }
                for edge in workflow.edges
            ],
        }

    def _initialize_agent_templates(self) -> Dict[AgentTemplate, Dict[str, Any]]:
        """Initialize built-in agent templates"""
        return {
            AgentTemplate.RESEARCH_AGENT: {
                "system_prompt": "You are a research agent specialized in gathering and analyzing information from various sources.",
                "enabled_tools": ["web_search", "document_retrieval", "data_analysis"],
                "capabilities": ["research", "analysis", "summarization"],
                "temperature": 0.3,
                "max_tokens": 3000,
            },
            AgentTemplate.CONTENT_AGENT: {
                "system_prompt": "You are a content creation agent specialized in generating high-quality written content.",
                "enabled_tools": ["text_generation", "formatting", "style_guide"],
                "capabilities": ["writing", "editing", "formatting"],
                "temperature": 0.7,
                "max_tokens": 4000,
            },
            AgentTemplate.ANALYSIS_AGENT: {
                "system_prompt": "You are an analysis agent specialized in data interpretation and insights generation.",
                "enabled_tools": ["data_analysis", "visualization", "statistics"],
                "capabilities": ["analysis", "visualization", "reporting"],
                "temperature": 0.2,
                "max_tokens": 2500,
            },
            AgentTemplate.REVIEW_AGENT: {
                "system_prompt": "You are a review agent specialized in quality assessment and improvement suggestions.",
                "enabled_tools": ["quality_check", "grammar_check", "style_analysis"],
                "capabilities": ["review", "quality_assurance", "feedback"],
                "temperature": 0.4,
                "max_tokens": 2000,
            },
            AgentTemplate.EDITOR_AGENT: {
                "system_prompt": "You are an editor agent specialized in document consistency and coherence.",
                "enabled_tools": ["editing", "consistency_check", "flow_analysis"],
                "capabilities": ["editing", "consistency", "flow"],
                "temperature": 0.3,
                "max_tokens": 3500,
            },
        }

    def _initialize_prompt_templates(self) -> Dict[PromptTemplate, str]:
        """Initialize built-in prompt templates"""
        return {
            PromptTemplate.RESEARCH_QUERY: "Research the following topic and provide comprehensive analysis: {topic}\n\nFocus on: {focus_areas}\nProvide sources and citations.",
            PromptTemplate.CONTENT_GENERATION: "Create content on the following topic: {topic}\n\nRequirements:\n- Length: {word_count} words\n- Tone: {tone}\n- Audience: {audience}",
            PromptTemplate.DATA_ANALYSIS: "Analyze the following data: {data}\n\nProvide insights on:\n- Key trends\n- Patterns\n- Recommendations",
            PromptTemplate.DOCUMENT_REVIEW: "Review the following document for: {review_criteria}\n\nDocument: {document}\n\nProvide specific feedback and suggestions.",
            PromptTemplate.EDITING_INSTRUCTIONS: "Edit the following content for: {editing_focus}\n\nContent: {content}\n\nMaintain the original meaning while improving clarity.",
            PromptTemplate.QUALITY_CHECK: "Perform quality check on: {content}\n\nCheck for:\n- Accuracy\n- Completeness\n- Consistency\n- Clarity",
        }

    def _initialize_workflow_templates(self) -> Dict[str, WorkflowTemplate]:
        """Initialize built-in workflow templates"""
        templates = {}

        # Research and Analysis Workflow
        research_template = WorkflowTemplate(
            name="Research and Analysis",
            description="Complete research workflow with analysis and reporting",
            category="research",
            difficulty="intermediate",
            estimated_time=1800,
            nodes=[
                {
                    "node_id": "research_node",
                    "node_type": "agent",
                    "name": "Research Agent",
                    "agent_type": "research_agent",
                    "position": [100, 100],
                    "prompt_template": "Research {topic} and gather comprehensive information",
                },
                {
                    "node_id": "analysis_node",
                    "node_type": "agent",
                    "name": "Analysis Agent",
                    "agent_type": "analysis_agent",
                    "position": [400, 100],
                    "prompt_template": "Analyze the research data and provide insights",
                },
                {
                    "node_id": "report_node",
                    "node_type": "agent",
                    "name": "Report Agent",
                    "agent_type": "content_agent",
                    "position": [700, 100],
                    "prompt_template": "Create a comprehensive report based on analysis",
                },
            ],
            edges=[
                {"source_node": "research_node", "target_node": "analysis_node"},
                {"source_node": "analysis_node", "target_node": "report_node"},
            ],
            required_parameters=["topic"],
            tags=["research", "analysis", "reporting"],
        )

        templates[research_template.template_id] = research_template

        # Content Creation Workflow
        content_template = WorkflowTemplate(
            name="Content Creation Pipeline",
            description="End-to-end content creation with review and editing",
            category="content",
            difficulty="beginner",
            estimated_time=1200,
            nodes=[
                {
                    "node_id": "content_node",
                    "node_type": "agent",
                    "name": "Content Creator",
                    "agent_type": "content_agent",
                    "position": [100, 100],
                    "prompt_template": "Create content on {topic} for {audience}",
                },
                {
                    "node_id": "review_node",
                    "node_type": "agent",
                    "name": "Content Reviewer",
                    "agent_type": "review_agent",
                    "position": [400, 100],
                    "prompt_template": "Review content for quality and accuracy",
                },
                {
                    "node_id": "editor_node",
                    "node_type": "agent",
                    "name": "Editor",
                    "agent_type": "editor_agent",
                    "position": [700, 100],
                    "prompt_template": "Edit content for consistency and flow",
                },
            ],
            edges=[
                {"source_node": "content_node", "target_node": "review_node"},
                {"source_node": "review_node", "target_node": "editor_node"},
            ],
            required_parameters=["topic", "audience"],
            tags=["content", "writing", "editing"],
        )

        templates[content_template.template_id] = content_template

        return templates
