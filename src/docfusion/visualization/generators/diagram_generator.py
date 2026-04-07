"""
Diagram Generator

Process flow diagrams, organizational charts, technical architecture diagrams,
and network diagrams generation for visual documentation.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import json
import logging
import math
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union

try:
    from uuid_extensions import uuid7str
except ImportError:
    import uuid

    def uuid7str() -> str:
        return str(uuid.uuid4())


# For diagram libraries - would need to install these
try:
    import graphviz

    GRAPHVIZ_AVAILABLE = True
except ImportError:
    GRAPHVIZ_AVAILABLE = False

try:
    import matplotlib.patches as patches
    import matplotlib.pyplot as plt
    import numpy as np
    from matplotlib.patches import ConnectionPatch, FancyBboxPatch

    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False

from pydantic import BaseModel, ConfigDict, Field


class DiagramType(str, Enum):
    """Supported diagram types"""

    FLOWCHART = "flowchart"
    ORGANIZATIONAL_CHART = "organizational_chart"
    NETWORK_DIAGRAM = "network_diagram"
    ARCHITECTURE_DIAGRAM = "architecture_diagram"
    PROCESS_FLOW = "process_flow"
    SEQUENCE_DIAGRAM = "sequence_diagram"
    ENTITY_RELATIONSHIP = "entity_relationship"
    MIND_MAP = "mind_map"
    GANTT_CHART = "gantt_chart"
    TREE_DIAGRAM = "tree_diagram"


class NodeShape(str, Enum):
    """Node shapes for diagrams"""

    RECTANGLE = "rectangle"
    CIRCLE = "circle"
    DIAMOND = "diamond"
    ELLIPSE = "ellipse"
    TRIANGLE = "triangle"
    HEXAGON = "hexagon"
    PARALLELOGRAM = "parallelogram"


class EdgeStyle(str, Enum):
    """Edge styles for connections"""

    SOLID = "solid"
    DASHED = "dashed"
    DOTTED = "dotted"
    BOLD = "bold"


@dataclass
class DiagramNode:
    """Diagram node representation"""

    node_id: str
    label: str
    shape: NodeShape = NodeShape.RECTANGLE
    color: str = "#lightblue"
    text_color: str = "#000000"
    position: Optional[Tuple[float, float]] = None
    size: Tuple[float, float] = (100, 50)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DiagramEdge:
    """Diagram edge representation"""

    edge_id: str
    from_node: str
    to_node: str
    label: str = ""
    style: EdgeStyle = EdgeStyle.SOLID
    color: str = "#000000"
    weight: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DiagramLayout:
    """Diagram layout configuration"""

    layout_type: str = "hierarchical"  # hierarchical, circular, grid, force
    direction: str = (
        "top_to_bottom"  # top_to_bottom, left_to_right, bottom_to_top, right_to_left
    )
    spacing: Tuple[float, float] = (100, 100)  # horizontal, vertical spacing
    margins: Tuple[float, float, float, float] = (
        50,
        50,
        50,
        50,
    )  # top, right, bottom, left
    auto_arrange: bool = True


@dataclass
class DiagramData:
    """Complete diagram data structure"""

    diagram_id: str = field(default_factory=uuid7str)
    title: str = ""
    description: str = ""
    nodes: List[DiagramNode] = field(default_factory=list)
    edges: List[DiagramEdge] = field(default_factory=list)
    layout: DiagramLayout = field(default_factory=DiagramLayout)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DiagramConfiguration:
    """Diagram styling and export configuration"""

    diagram_type: DiagramType
    width: int = 800
    height: int = 600
    background_color: str = "#FFFFFF"

    # Typography
    font_family: str = "Arial"
    font_size: int = 12
    title_font_size: int = 16

    # Theme and styling
    theme: str = "professional"  # professional, modern, classic
    color_scheme: str = "blue"  # blue, green, orange, purple, grayscale

    # Export options
    export_formats: List[str] = field(default_factory=lambda: ["svg", "png", "pdf"])
    high_resolution: bool = True

    # Accessibility
    high_contrast: bool = False
    include_descriptions: bool = True


class DiagramGenerator:
    """
    Comprehensive diagram generator for various diagram types

    Supports process flows, organizational charts, technical architecture,
    network diagrams, and other visual documentation needs.
    """

    def __init__(self):
        # Color schemes
        self.color_schemes = {
            "blue": ["#1f77b4", "#aec7e8", "#ffbb78", "#2ca02c", "#98df8a"],
            "green": ["#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd"],
            "orange": ["#ff7f0e", "#ffbb78", "#2ca02c", "#98df8a", "#d62728"],
            "purple": ["#9467bd", "#c5b0d5", "#8c564b", "#c49c94", "#e377c2"],
            "grayscale": ["#333333", "#666666", "#999999", "#cccccc", "#ffffff"],
        }

        # Node templates by diagram type
        self.node_templates = self._initialize_node_templates()

        # Layout algorithms
        self.layout_algorithms = self._initialize_layout_algorithms()

        self.logger = logging.getLogger("diagram_generator")

        if not GRAPHVIZ_AVAILABLE and not MATPLOTLIB_AVAILABLE:
            self.logger.warning(
                "Neither Graphviz nor Matplotlib available - using mock generation"
            )

    async def generate_diagram(
        self, data: DiagramData, config: DiagramConfiguration
    ) -> Dict[str, Any]:
        """
        Generate a diagram from data and configuration

        Args:
                data: Diagram data with nodes and edges
                config: Diagram configuration

        Returns:
                Generated diagram with multiple format outputs
        """
        try:
            # Apply layout if auto-arrange is enabled
            if data.layout.auto_arrange:
                await self._apply_auto_layout(data, config)

            # Generate the diagram
            if GRAPHVIZ_AVAILABLE and config.diagram_type in [
                DiagramType.FLOWCHART,
                DiagramType.NETWORK_DIAGRAM,
            ]:
                diagram_output = await self._generate_graphviz_diagram(data, config)
            elif MATPLOTLIB_AVAILABLE:
                diagram_output = await self._generate_matplotlib_diagram(data, config)
            else:
                diagram_output = await self._generate_mock_diagram(data, config)

            # Add metadata
            result = {
                "diagram_id": data.diagram_id,
                "type": config.diagram_type.value,
                "title": data.title,
                "generated_at": datetime.now().isoformat(),
                "metadata": {
                    "node_count": len(data.nodes),
                    "edge_count": len(data.edges),
                    "layout_type": data.layout.layout_type,
                    "theme": config.theme,
                    "formats": config.export_formats,
                },
                **diagram_output,
            }

            self.logger.info(
                f"Diagram generated: {config.diagram_type.value} with {len(data.nodes)} nodes"
            )

            return result

        except Exception as e:
            self.logger.error(f"Diagram generation failed: {e}")
            return {"diagram_id": data.diagram_id, "error": str(e), "success": False}

    async def generate_process_flow(
        self, process_steps: List[Dict[str, Any]], title: str = "Process Flow"
    ) -> Dict[str, Any]:
        """
        Generate process flow diagram from steps

        Args:
                process_steps: List of process steps with name, type, connections
                title: Diagram title

        Returns:
                Process flow diagram
        """
        data = DiagramData(title=title)

        # Create nodes for each step
        for i, step in enumerate(process_steps):
            step_type = step.get("type", "process")

            # Determine node shape based on step type
            if step_type == "decision":
                shape = NodeShape.DIAMOND
                color = "#ffeb3b"
            elif step_type == "start" or step_type == "end":
                shape = NodeShape.ELLIPSE
                color = "#4caf50" if step_type == "start" else "#f44336"
            else:
                shape = NodeShape.RECTANGLE
                color = "#2196f3"

            node = DiagramNode(
                node_id=f"step_{i}",
                label=step.get("name", f"Step {i + 1}"),
                shape=shape,
                color=color,
            )
            data.nodes.append(node)

            # Create edges based on connections
            connections = step.get("connections", [])
            for connection in connections:
                if isinstance(connection, int) and connection < len(process_steps):
                    edge = DiagramEdge(
                        edge_id=f"edge_{i}_{connection}",
                        from_node=f"step_{i}",
                        to_node=f"step_{connection}",
                        label=step.get("condition", ""),
                    )
                    data.edges.append(edge)

        # Set layout for process flow
        data.layout.layout_type = "hierarchical"
        data.layout.direction = "top_to_bottom"

        config = DiagramConfiguration(diagram_type=DiagramType.PROCESS_FLOW)

        return await self.generate_diagram(data, config)

    async def generate_organizational_chart(
        self, org_structure: Dict[str, Any], title: str = "Organizational Chart"
    ) -> Dict[str, Any]:
        """
        Generate organizational chart from hierarchical structure

        Args:
                org_structure: Hierarchical organization structure
                title: Chart title

        Returns:
                Organizational chart diagram
        """
        data = DiagramData(title=title)

        # Recursively create nodes and edges from org structure
        await self._build_org_nodes(org_structure, data, parent_id=None)

        # Set layout for org chart
        data.layout.layout_type = "hierarchical"
        data.layout.direction = "top_to_bottom"
        data.layout.spacing = (150, 100)

        config = DiagramConfiguration(
            diagram_type=DiagramType.ORGANIZATIONAL_CHART,
            theme="professional",
            color_scheme="blue",
        )

        return await self.generate_diagram(data, config)

    async def generate_architecture_diagram(
        self,
        components: List[Dict[str, Any]],
        connections: List[Dict[str, Any]],
        title: str = "System Architecture",
    ) -> Dict[str, Any]:
        """
        Generate technical architecture diagram

        Args:
                components: System components with type, name, properties
                connections: Connections between components
                title: Diagram title

        Returns:
                Architecture diagram
        """
        data = DiagramData(title=title)

        # Create nodes for components
        for i, component in enumerate(components):
            comp_type = component.get("type", "service")

            # Determine styling based on component type
            if comp_type == "database":
                shape = NodeShape.CIRCLE
                color = "#9c27b0"
            elif comp_type == "api":
                shape = NodeShape.HEXAGON
                color = "#ff9800"
            elif comp_type == "frontend":
                shape = NodeShape.RECTANGLE
                color = "#4caf50"
            else:
                shape = NodeShape.RECTANGLE
                color = "#2196f3"

            node = DiagramNode(
                node_id=f"comp_{i}",
                label=component.get("name", f"Component {i + 1}"),
                shape=shape,
                color=color,
                metadata={"type": comp_type},
            )
            data.nodes.append(node)

        # Create edges for connections
        for j, connection in enumerate(connections):
            from_comp = connection.get("from")
            to_comp = connection.get("to")

            if from_comp is not None and to_comp is not None:
                edge = DiagramEdge(
                    edge_id=f"conn_{j}",
                    from_node=f"comp_{from_comp}",
                    to_node=f"comp_{to_comp}",
                    label=connection.get("type", ""),
                    style=EdgeStyle.SOLID
                    if connection.get("type") == "sync"
                    else EdgeStyle.DASHED,
                )
                data.edges.append(edge)

        # Set layout for architecture
        data.layout.layout_type = "force"
        data.layout.spacing = (120, 80)

        config = DiagramConfiguration(
            diagram_type=DiagramType.ARCHITECTURE_DIAGRAM,
            theme="modern",
            color_scheme="purple",
        )

        return await self.generate_diagram(data, config)

    async def generate_network_diagram(
        self,
        network_nodes: List[Dict[str, Any]],
        network_links: List[Dict[str, Any]],
        title: str = "Network Diagram",
    ) -> Dict[str, Any]:
        """
        Generate network topology diagram

        Args:
                network_nodes: Network devices/nodes
                network_links: Network connections
                title: Diagram title

        Returns:
                Network diagram
        """
        data = DiagramData(title=title)

        # Create nodes for network devices
        for i, device in enumerate(network_nodes):
            device_type = device.get("type", "router")

            # Device-specific styling
            if device_type == "server":
                shape = NodeShape.RECTANGLE
                color = "#607d8b"
            elif device_type == "router":
                shape = NodeShape.DIAMOND
                color = "#ff5722"
            elif device_type == "switch":
                shape = NodeShape.HEXAGON
                color = "#795548"
            elif device_type == "firewall":
                shape = NodeShape.TRIANGLE
                color = "#f44336"
            else:
                shape = NodeShape.CIRCLE
                color = "#9e9e9e"

            node = DiagramNode(
                node_id=f"device_{i}",
                label=device.get("name", f"Device {i + 1}"),
                shape=shape,
                color=color,
                metadata={"type": device_type, "ip": device.get("ip")},
            )
            data.nodes.append(node)

        # Create edges for network links
        for j, link in enumerate(network_links):
            from_device = link.get("from")
            to_device = link.get("to")

            if from_device is not None and to_device is not None:
                edge = DiagramEdge(
                    edge_id=f"link_{j}",
                    from_node=f"device_{from_device}",
                    to_node=f"device_{to_device}",
                    label=link.get("protocol", ""),
                    style=EdgeStyle.BOLD
                    if link.get("type") == "primary"
                    else EdgeStyle.SOLID,
                )
                data.edges.append(edge)

        # Set network layout
        data.layout.layout_type = "force"
        data.layout.spacing = (150, 150)

        config = DiagramConfiguration(
            diagram_type=DiagramType.NETWORK_DIAGRAM,
            theme="professional",
            color_scheme="grayscale",
        )

        return await self.generate_diagram(data, config)

    async def _apply_auto_layout(self, data: DiagramData, config: DiagramConfiguration):
        """Apply automatic layout algorithm to position nodes"""
        layout_func = self.layout_algorithms.get(data.layout.layout_type)
        if layout_func:
            await layout_func(data, config)

    async def _hierarchical_layout(
        self, data: DiagramData, config: DiagramConfiguration
    ):
        """Apply hierarchical layout (tree-like structure)"""
        if not data.nodes:
            return

        # Find root nodes (nodes with no incoming edges)
        incoming_edges = {node.node_id: [] for node in data.nodes}
        for edge in data.edges:
            if edge.to_node in incoming_edges:
                incoming_edges[edge.to_node].append(edge.from_node)

        root_nodes = [
            node_id for node_id, incoming in incoming_edges.items() if not incoming
        ]

        if not root_nodes:
            root_nodes = [data.nodes[0].node_id]  # Use first node as root

        # Assign levels using BFS
        node_levels = {}
        queue = [(node_id, 0) for node_id in root_nodes]

        while queue:
            node_id, level = queue.pop(0)
            if node_id not in node_levels:
                node_levels[node_id] = level

                # Find children
                children = [
                    edge.to_node for edge in data.edges if edge.from_node == node_id
                ]
                for child in children:
                    if child not in node_levels:
                        queue.append((child, level + 1))

        # Position nodes based on levels
        max_level = max(node_levels.values()) if node_levels else 0
        nodes_by_level = {}

        for node_id, level in node_levels.items():
            if level not in nodes_by_level:
                nodes_by_level[level] = []
            nodes_by_level[level].append(node_id)

        # Calculate positions
        for node in data.nodes:
            if node.node_id in node_levels:
                level = node_levels[node.node_id]
                nodes_at_level = nodes_by_level[level]
                position_in_level = nodes_at_level.index(node.node_id)

                # Calculate x position (spread across width)
                if len(nodes_at_level) > 1:
                    x = (position_in_level / (len(nodes_at_level) - 1)) * (
                        config.width - 200
                    ) + 100
                else:
                    x = config.width / 2

                # Calculate y position (by level)
                y = level * data.layout.spacing[1] + 100

                node.position = (x, y)

    async def _force_layout(self, data: DiagramData, config: DiagramConfiguration):
        """Apply force-directed layout algorithm"""
        if not data.nodes:
            return

        # Simple force-directed layout simulation
        positions = {}

        # Initialize random positions
        for node in data.nodes:
            positions[node.node_id] = (
                np.random.uniform(100, config.width - 100),
                np.random.uniform(100, config.height - 100),
            )

        # Simulate forces (simplified)
        for iteration in range(50):
            forces = {node_id: [0, 0] for node_id in positions}

            # Repulsion between all nodes
            for node1_id in positions:
                for node2_id in positions:
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
            for edge in data.edges:
                if edge.from_node in positions and edge.to_node in positions:
                    x1, y1 = positions[edge.from_node]
                    x2, y2 = positions[edge.to_node]

                    dx = x2 - x1
                    dy = y2 - y1
                    distance = math.sqrt(dx * dx + dy * dy)

                    if distance > 0:
                        attraction_force = distance * 0.01
                        forces[edge.from_node][0] += (dx / distance) * attraction_force
                        forces[edge.from_node][1] += (dy / distance) * attraction_force
                        forces[edge.to_node][0] -= (dx / distance) * attraction_force
                        forces[edge.to_node][1] -= (dy / distance) * attraction_force

            # Update positions
            for node_id in positions:
                x, y = positions[node_id]
                fx, fy = forces[node_id]

                # Apply forces with damping
                new_x = max(50, min(config.width - 50, x + fx * 0.1))
                new_y = max(50, min(config.height - 50, y + fy * 0.1))

                positions[node_id] = (new_x, new_y)

        # Apply calculated positions
        for node in data.nodes:
            if node.node_id in positions:
                node.position = positions[node.node_id]

    async def _build_org_nodes(
        self,
        org_data: Dict[str, Any],
        diagram_data: DiagramData,
        parent_id: Optional[str] = None,
        level: int = 0,
    ):
        """Recursively build organizational chart nodes"""
        node_id = f"org_{len(diagram_data.nodes)}"

        # Determine color based on level
        colors = ["#1565c0", "#1976d2", "#1e88e5", "#2196f3", "#42a5f5"]
        color = colors[min(level, len(colors) - 1)]

        node = DiagramNode(
            node_id=node_id,
            label=org_data.get("name", "Unknown"),
            shape=NodeShape.RECTANGLE,
            color=color,
            metadata={"title": org_data.get("title", ""), "level": level},
        )
        diagram_data.nodes.append(node)

        # Create edge to parent
        if parent_id:
            edge = DiagramEdge(
                edge_id=f"edge_{parent_id}_{node_id}",
                from_node=parent_id,
                to_node=node_id,
            )
            diagram_data.edges.append(edge)

        # Process subordinates
        subordinates = org_data.get("subordinates", [])
        for subordinate in subordinates:
            await self._build_org_nodes(subordinate, diagram_data, node_id, level + 1)

    async def _generate_graphviz_diagram(
        self, data: DiagramData, config: DiagramConfiguration
    ) -> Dict[str, Any]:
        """Generate diagram using Graphviz"""
        if not GRAPHVIZ_AVAILABLE:
            return await self._generate_mock_diagram(data, config)

        try:
            # Create Graphviz graph
            dot = graphviz.Digraph(comment=data.title)
            dot.attr(rankdir="TB" if data.layout.direction == "top_to_bottom" else "LR")
            dot.attr(bgcolor=config.background_color)

            # Add nodes
            for node in data.nodes:
                dot.node(
                    node.node_id,
                    node.label,
                    shape=self._get_graphviz_shape(node.shape),
                    fillcolor=node.color,
                    style="filled",
                    fontname=config.font_family,
                )

            # Add edges
            for edge in data.edges:
                dot.edge(
                    edge.from_node,
                    edge.to_node,
                    label=edge.label,
                    style=edge.style.value,
                    color=edge.color,
                )

            # Render to different formats
            outputs = {}
            for format_type in config.export_formats:
                if format_type in ["svg", "png", "pdf"]:
                    try:
                        outputs[format_type] = dot.pipe(format=format_type)
                    except Exception as e:
                        self.logger.warning(f"Graphviz pipe failed for format {format_type}: {e}")
                        outputs[format_type] = f"Mock {format_type} output"

            return {"success": True, "source": str(dot.source), "outputs": outputs}

        except Exception as e:
            self.logger.error(f"Graphviz generation failed: {e}")
            return await self._generate_mock_diagram(data, config)

    async def _generate_matplotlib_diagram(
        self, data: DiagramData, config: DiagramConfiguration
    ) -> Dict[str, Any]:
        """Generate diagram using Matplotlib"""
        if not MATPLOTLIB_AVAILABLE:
            return await self._generate_mock_diagram(data, config)

        try:
            fig, ax = plt.subplots(figsize=(config.width / 100, config.height / 100))
            ax.set_xlim(0, config.width)
            ax.set_ylim(0, config.height)
            ax.set_aspect("equal")

            # Draw edges first (so they appear behind nodes)
            for edge in data.edges:
                from_node = next(
                    (n for n in data.nodes if n.node_id == edge.from_node), None
                )
                to_node = next(
                    (n for n in data.nodes if n.node_id == edge.to_node), None
                )

                if from_node and to_node and from_node.position and to_node.position:
                    x1, y1 = from_node.position
                    x2, y2 = to_node.position

                    # Draw arrow
                    ax.annotate(
                        "",
                        xy=(x2, y2),
                        xytext=(x1, y1),
                        arrowprops=dict(arrowstyle="->", color=edge.color, lw=1.5),
                    )

                    # Add edge label if present
                    if edge.label:
                        mid_x, mid_y = (x1 + x2) / 2, (y1 + y2) / 2
                        ax.text(
                            mid_x,
                            mid_y,
                            edge.label,
                            ha="center",
                            va="center",
                            bbox=dict(
                                boxstyle="round,pad=0.3", facecolor="white", alpha=0.8
                            ),
                        )

            # Draw nodes
            for node in data.nodes:
                if node.position:
                    x, y = node.position

                    # Draw node shape
                    if node.shape == NodeShape.RECTANGLE:
                        rect = FancyBboxPatch(
                            (x - node.size[0] / 2, y - node.size[1] / 2),
                            node.size[0],
                            node.size[1],
                            boxstyle="round,pad=5",
                            facecolor=node.color,
                            edgecolor="black",
                            linewidth=1,
                        )
                        ax.add_patch(rect)
                    elif node.shape == NodeShape.CIRCLE:
                        circle = patches.Circle(
                            (x, y),
                            node.size[0] / 2,
                            facecolor=node.color,
                            edgecolor="black",
                        )
                        ax.add_patch(circle)
                    elif node.shape == NodeShape.DIAMOND:
                        # Create diamond shape
                        diamond_points = np.array(
                            [
                                [x, y + node.size[1] / 2],  # top
                                [x + node.size[0] / 2, y],  # right
                                [x, y - node.size[1] / 2],  # bottom
                                [x - node.size[0] / 2, y],  # left
                            ]
                        )
                        diamond = patches.Polygon(
                            diamond_points,
                            closed=True,
                            facecolor=node.color,
                            edgecolor="black",
                        )
                        ax.add_patch(diamond)

                    # Add node label
                    ax.text(
                        x,
                        y,
                        node.label,
                        ha="center",
                        va="center",
                        fontsize=config.font_size,
                        fontfamily=config.font_family,
                        color=node.text_color,
                        weight="bold",
                    )

            # Set title
            if data.title:
                ax.set_title(
                    data.title,
                    fontsize=config.title_font_size,
                    fontfamily=config.font_family,
                    weight="bold",
                )

            # Remove axes
            ax.set_xticks([])
            ax.set_yticks([])
            ax.spines["top"].set_visible(False)
            ax.spines["right"].set_visible(False)
            ax.spines["bottom"].set_visible(False)
            ax.spines["left"].set_visible(False)

            # Save outputs
            outputs = {}
            for format_type in config.export_formats:
                if format_type in ["png", "svg", "pdf"]:
                    try:
                        import io

                        buffer = io.BytesIO()
                        plt.savefig(
                            buffer,
                            format=format_type,
                            bbox_inches="tight",
                            dpi=300 if config.high_resolution else 150,
                        )
                        outputs[format_type] = buffer.getvalue()
                    except Exception as e:
                        self.logger.warning(f"Matplotlib savefig failed for format {format_type}: {e}")
                        outputs[format_type] = f"Mock {format_type} output"

            plt.close(fig)

            return {"success": True, "outputs": outputs, "renderer": "matplotlib"}

        except Exception as e:
            self.logger.error(f"Matplotlib generation failed: {e}")
            return await self._generate_mock_diagram(data, config)

    async def _generate_mock_diagram(
        self, data: DiagramData, config: DiagramConfiguration
    ) -> Dict[str, Any]:
        """Generate mock diagram when libraries are not available"""
        return {
            "success": True,
            "mock": True,
            "diagram_type": config.diagram_type.value,
            "node_count": len(data.nodes),
            "edge_count": len(data.edges),
            "outputs": {
                format_type: f"Mock {format_type} output"
                for format_type in config.export_formats
            },
        }

    def _get_graphviz_shape(self, shape: NodeShape) -> str:
        """Convert internal shape to Graphviz shape"""
        shape_mapping = {
            NodeShape.RECTANGLE: "box",
            NodeShape.CIRCLE: "circle",
            NodeShape.DIAMOND: "diamond",
            NodeShape.ELLIPSE: "ellipse",
            NodeShape.TRIANGLE: "triangle",
            NodeShape.HEXAGON: "hexagon",
            NodeShape.PARALLELOGRAM: "parallelogram",
        }
        return shape_mapping.get(shape, "box")

    def _initialize_node_templates(self) -> Dict[DiagramType, Dict[str, Any]]:
        """Initialize node templates for different diagram types"""
        return {
            DiagramType.FLOWCHART: {
                "process": {"shape": NodeShape.RECTANGLE, "color": "#2196f3"},
                "decision": {"shape": NodeShape.DIAMOND, "color": "#ffeb3b"},
                "start_end": {"shape": NodeShape.ELLIPSE, "color": "#4caf50"},
            },
            DiagramType.ORGANIZATIONAL_CHART: {
                "executive": {"shape": NodeShape.RECTANGLE, "color": "#1565c0"},
                "manager": {"shape": NodeShape.RECTANGLE, "color": "#1976d2"},
                "employee": {"shape": NodeShape.RECTANGLE, "color": "#2196f3"},
            },
            DiagramType.NETWORK_DIAGRAM: {
                "server": {"shape": NodeShape.RECTANGLE, "color": "#607d8b"},
                "router": {"shape": NodeShape.DIAMOND, "color": "#ff5722"},
                "switch": {"shape": NodeShape.HEXAGON, "color": "#795548"},
            },
        }

    def _initialize_layout_algorithms(self) -> Dict[str, Any]:
        """Initialize layout algorithms"""
        return {
            "hierarchical": self._hierarchical_layout,
            "force": self._force_layout,
            "circular": self._circular_layout,
            "grid": self._grid_layout,
        }

    async def _circular_layout(self, data: DiagramData, config: DiagramConfiguration):
        """Apply circular layout"""
        if not data.nodes:
            return

        center_x = config.width / 2
        center_y = config.height / 2
        radius = min(config.width, config.height) / 3

        for i, node in enumerate(data.nodes):
            angle = 2 * math.pi * i / len(data.nodes)
            x = center_x + radius * math.cos(angle)
            y = center_y + radius * math.sin(angle)
            node.position = (x, y)

    async def _grid_layout(self, data: DiagramData, config: DiagramConfiguration):
        """Apply grid layout"""
        if not data.nodes:
            return

        cols = math.ceil(math.sqrt(len(data.nodes)))
        rows = math.ceil(len(data.nodes) / cols)

        spacing_x = (config.width - 100) / max(cols - 1, 1)
        spacing_y = (config.height - 100) / max(rows - 1, 1)

        for i, node in enumerate(data.nodes):
            col = i % cols
            row = i // cols

            x = 50 + col * spacing_x
            y = 50 + row * spacing_y

            node.position = (x, y)
