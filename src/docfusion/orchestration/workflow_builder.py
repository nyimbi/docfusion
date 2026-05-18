"""
Workflow Builder

Interactive workflow builder with drag-and-drop interface, real-time
collaboration, and visual workflow design capabilities.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple


from .agent_composer import AgentComposer
from ..core.utils import uuid7str
from .workflow_engine import (
    NodeType,
    Workflow,
    WorkflowEdge,
    WorkflowNode,
    WorkflowType,
)

class CanvasAction(str, Enum):
    """Canvas interaction actions"""

    SELECT = "select"
    DRAG = "drag"
    CONNECT = "connect"
    DELETE = "delete"
    COPY = "copy"
    PASTE = "paste"
    ZOOM = "zoom"
    PAN = "pan"

class ElementType(str, Enum):
    """Canvas element types"""

    AGENT_NODE = "agent_node"
    CONDITION_NODE = "condition_node"
    FORK_NODE = "fork_node"
    JOIN_NODE = "join_node"
    LOOP_NODE = "loop_node"
    CONNECTION = "connection"
    GROUP = "group"
    NOTE = "note"

@dataclass
class CanvasElement:
    """Canvas element representation"""

    element_id: str = field(default_factory=uuid7str)
    element_type: ElementType = ElementType.AGENT_NODE

    # Visual properties
    position: Tuple[float, float] = (0, 0)
    size: Tuple[float, float] = (200, 100)
    rotation: float = 0
    z_index: int = 0

    # Styling
    background_color: str = "#ffffff"
    border_color: str = "#cccccc"
    border_width: int = 2
    border_radius: int = 8
    opacity: float = 1.0

    # State
    selected: bool = False
    dragging: bool = False
    resizing: bool = False
    connecting: bool = False

    # Content
    title: str = ""
    description: str = ""
    icon: Optional[str] = None

    # Configuration
    config: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class CanvasConnection:
    """Canvas connection representation"""

    connection_id: str = field(default_factory=uuid7str)
    source_element: str = ""
    target_element: str = ""
    source_port: str = "output"
    target_port: str = "input"

    # Visual properties
    path_type: str = "bezier"  # bezier, straight, step
    stroke_color: str = "#333333"
    stroke_width: int = 2
    stroke_style: str = "solid"  # solid, dashed, dotted

    # Connection points
    source_point: Tuple[float, float] = (0, 0)
    target_point: Tuple[float, float] = (0, 0)
    control_points: List[Tuple[float, float]] = field(default_factory=list)

    # State
    selected: bool = False
    animated: bool = False

    # Logic
    condition: Optional[str] = None
    data_mapping: Dict[str, str] = field(default_factory=dict)
    enabled: bool = True

@dataclass
class WorkflowCanvas:
    """Complete canvas state"""

    canvas_id: str = field(default_factory=uuid7str)

    # Canvas properties
    width: float = 2000
    height: float = 1500
    background_color: str = "#f8f9fa"
    grid_enabled: bool = True
    grid_size: int = 20
    grid_color: str = "#e9ecef"

    # View state
    zoom_level: float = 1.0
    pan_offset: Tuple[float, float] = (0, 0)
    view_bounds: Tuple[float, float, float, float] = (
        0,
        0,
        1200,
        800,
    )  # x, y, width, height

    # Elements
    elements: Dict[str, CanvasElement] = field(default_factory=dict)
    connections: Dict[str, CanvasConnection] = field(default_factory=dict)

    # Selection and interaction
    selected_elements: Set[str] = field(default_factory=set)
    clipboard: List[Dict[str, Any]] = field(default_factory=list)

    # History
    history: List[Dict[str, Any]] = field(default_factory=list)
    history_index: int = -1

    # Collaboration
    collaborators: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    cursors: Dict[str, Tuple[float, float]] = field(default_factory=dict)

class WorkflowBuilder:
    """
    Interactive workflow builder with visual interface

    Provides drag-and-drop workflow construction, real-time collaboration,
    and visual workflow design capabilities.
    """

    def __init__(self):
        self.logger = logging.getLogger("workflow_builder")

        # Canvas state
        self.canvas: Optional[WorkflowCanvas] = None

        # Integration
        self.agent_composer = AgentComposer()

        # Built-in element templates
        self.element_templates = self._initialize_element_templates()

        # Interaction handlers
        self.action_handlers = {
            CanvasAction.SELECT: self._handle_select,
            CanvasAction.DRAG: self._handle_drag,
            CanvasAction.CONNECT: self._handle_connect,
            CanvasAction.DELETE: self._handle_delete,
            CanvasAction.COPY: self._handle_copy,
            CanvasAction.PASTE: self._handle_paste,
            CanvasAction.ZOOM: self._handle_zoom,
            CanvasAction.PAN: self._handle_pan,
        }

        # Real-time updates
        self.update_subscribers: List[callable] = []

    async def create_canvas(
        self, canvas_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a new workflow canvas

        Args:
                canvas_config: Optional canvas configuration

        Returns:
                Canvas creation result
        """
        try:
            config = canvas_config or {}

            self.canvas = WorkflowCanvas(
                width=config.get("width", 2000),
                height=config.get("height", 1500),
                background_color=config.get("background_color", "#f8f9fa"),
                grid_enabled=config.get("grid_enabled", True),
                grid_size=config.get("grid_size", 20),
            )

            # Initialize with basic elements if requested
            if config.get("add_default_elements", True):
                await self._add_default_elements()

            result = {
                "canvas_id": self.canvas.canvas_id,
                "width": self.canvas.width,
                "height": self.canvas.height,
                "grid_enabled": self.canvas.grid_enabled,
                "created_at": datetime.now().isoformat(),
                "success": True,
            }

            self.logger.info(f"Canvas created: {self.canvas.canvas_id}")

            return result

        except Exception as e:
            self.logger.error(f"Canvas creation failed: {e}")
            return {"error": str(e), "success": False}

    async def add_element(
        self,
        element_type: ElementType,
        position: Tuple[float, float],
        config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Add element to canvas

        Args:
                element_type: Type of element to add
                position: Position on canvas
                config: Element configuration

        Returns:
                Element addition result
        """
        try:
            if not self.canvas:
                raise ValueError("No active canvas")

            config = config or {}

            # Get element template
            template = self.element_templates.get(element_type, {})

            # Create element
            element = CanvasElement(
                element_type=element_type,
                position=position,
                size=config.get("size", template.get("size", (200, 100))),
                background_color=config.get(
                    "background_color", template.get("background_color", "#ffffff")
                ),
                border_color=config.get(
                    "border_color", template.get("border_color", "#cccccc")
                ),
                title=config.get(
                    "title",
                    template.get("title", element_type.value.replace("_", " ").title()),
                ),
                description=config.get("description", template.get("description", "")),
                icon=config.get("icon", template.get("icon")),
                config=config,
            )

            # Add to canvas
            self.canvas.elements[element.element_id] = element

            # Save canvas state
            await self._save_canvas_state()

            # Notify subscribers
            await self._notify_update(
                "element_added",
                {
                    "element_id": element.element_id,
                    "element_type": element_type.value,
                    "position": position,
                },
            )

            result = {
                "element_id": element.element_id,
                "element_type": element_type.value,
                "position": position,
                "size": element.size,
                "success": True,
            }

            self.logger.info(f"Element added: {element_type.value} at {position}")

            return result

        except Exception as e:
            self.logger.error(f"Element addition failed: {e}")
            return {"error": str(e), "success": False}

    async def connect_elements(
        self,
        source_id: str,
        target_id: str,
        connection_config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create connection between elements

        Args:
                source_id: Source element ID
                target_id: Target element ID
                connection_config: Connection configuration

        Returns:
                Connection result
        """
        try:
            if not self.canvas:
                raise ValueError("No active canvas")

            # Validate elements exist
            if source_id not in self.canvas.elements:
                raise ValueError(f"Source element {source_id} not found")
            if target_id not in self.canvas.elements:
                raise ValueError(f"Target element {target_id} not found")

            config = connection_config or {}

            # Get element positions for connection points
            source_element = self.canvas.elements[source_id]
            target_element = self.canvas.elements[target_id]

            source_point = await self._calculate_connection_point(
                source_element, "output"
            )
            target_point = await self._calculate_connection_point(
                target_element, "input"
            )

            # Create connection
            connection = CanvasConnection(
                source_element=source_id,
                target_element=target_id,
                source_point=source_point,
                target_point=target_point,
                path_type=config.get("path_type", "bezier"),
                stroke_color=config.get("stroke_color", "#333333"),
                stroke_width=config.get("stroke_width", 2),
                condition=config.get("condition"),
                data_mapping=config.get("data_mapping", {}),
            )

            # Calculate control points for bezier curves
            if connection.path_type == "bezier":
                connection.control_points = await self._calculate_bezier_control_points(
                    source_point, target_point
                )

            # Add to canvas
            self.canvas.connections[connection.connection_id] = connection

            # Save canvas state
            await self._save_canvas_state()

            # Notify subscribers
            await self._notify_update(
                "connection_added",
                {
                    "connection_id": connection.connection_id,
                    "source": source_id,
                    "target": target_id,
                },
            )

            result = {
                "connection_id": connection.connection_id,
                "source": source_id,
                "target": target_id,
                "path_type": connection.path_type,
                "success": True,
            }

            self.logger.info(f"Elements connected: {source_id} -> {target_id}")

            return result

        except Exception as e:
            self.logger.error(f"Element connection failed: {e}")
            return {"error": str(e), "success": False}

    async def handle_canvas_action(
        self, action: CanvasAction, parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle canvas interaction

        Args:
                action: Canvas action type
                parameters: Action parameters

        Returns:
                Action result
        """
        try:
            if not self.canvas:
                raise ValueError("No active canvas")

            # Get action handler
            handler = self.action_handlers.get(action)
            if not handler:
                raise ValueError(f"Unknown action: {action}")

            # Execute action
            result = await handler(parameters)

            # Save canvas state if needed
            if result.get("save_state", False):
                await self._save_canvas_state()

            # Notify subscribers
            if result.get("notify", True):
                await self._notify_update(action.value, parameters)

            return result

        except Exception as e:
            self.logger.error(f"Canvas action failed: {action} - {e}")
            return {"error": str(e), "success": False}

    async def update_element(
        self, element_id: str, updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update element properties

        Args:
                element_id: Element to update
                updates: Property updates

        Returns:
                Update result
        """
        try:
            if not self.canvas:
                raise ValueError("No active canvas")

            if element_id not in self.canvas.elements:
                raise ValueError(f"Element {element_id} not found")

            element = self.canvas.elements[element_id]

            # Apply updates
            for key, value in updates.items():
                if hasattr(element, key):
                    setattr(element, key, value)
                else:
                    element.config[key] = value

            # Save canvas state
            await self._save_canvas_state()

            # Notify subscribers
            await self._notify_update(
                "element_updated", {"element_id": element_id, "updates": updates}
            )

            result = {
                "element_id": element_id,
                "updated_properties": list(updates.keys()),
                "success": True,
            }

            self.logger.info(f"Element updated: {element_id}")

            return result

        except Exception as e:
            self.logger.error(f"Element update failed: {e}")
            return {"error": str(e), "success": False}

    async def arrange_elements(self, arrangement_type: str = "auto") -> Dict[str, Any]:
        """
        Auto-arrange elements on canvas

        Args:
                arrangement_type: Type of arrangement (auto, grid, hierarchical, circular)

        Returns:
                Arrangement result
        """
        try:
            if not self.canvas:
                raise ValueError("No active canvas")

            elements = list(self.canvas.elements.values())
            connections = list(self.canvas.connections.values())

            if arrangement_type == "grid":
                positions = await self._arrange_grid(elements)
            elif arrangement_type == "hierarchical":
                positions = await self._arrange_hierarchical(elements, connections)
            elif arrangement_type == "circular":
                positions = await self._arrange_circular(elements)
            elif arrangement_type == "force":
                positions = await self._arrange_force_directed(elements, connections)
            else:  # auto
                positions = await self._auto_arrange(elements, connections)

            # Update element positions
            for element_id, position in positions.items():
                if element_id in self.canvas.elements:
                    self.canvas.elements[element_id].position = position

            # Update connection paths
            await self._update_all_connection_paths()

            # Save canvas state
            await self._save_canvas_state()

            # Notify subscribers
            await self._notify_update(
                "elements_arranged",
                {"arrangement_type": arrangement_type, "positions": positions},
            )

            result = {
                "arrangement_type": arrangement_type,
                "elements_arranged": len(positions),
                "success": True,
            }

            self.logger.info(f"Elements arranged: {arrangement_type}")

            return result

        except Exception as e:
            self.logger.error(f"Element arrangement failed: {e}")
            return {"error": str(e), "success": False}

    async def export_to_workflow(self) -> Dict[str, Any]:
        """
        Export canvas to executable workflow

        Returns:
                Workflow export result
        """
        try:
            if not self.canvas:
                raise ValueError("No active canvas")

            # Create workflow
            workflow = Workflow(
                name=f"Canvas Workflow {datetime.now().strftime('%Y%m%d_%H%M')}",
                workflow_type=WorkflowType.DAG,  # Default to DAG for visual workflows
                canvas_size=(self.canvas.width, self.canvas.height),
                zoom_level=self.canvas.zoom_level,
            )

            # Convert canvas elements to workflow nodes
            for element in self.canvas.elements.values():
                if element.element_type == ElementType.AGENT_NODE:
                    node = WorkflowNode(
                        node_id=element.element_id,
                        node_type=NodeType.AGENT,
                        name=element.title,
                        agent_type=element.config.get("agent_type", "custom_agent"),
                        agent_config=element.config.get("agent_config", {}),
                        prompt_template=element.config.get("prompt_template", ""),
                        position=element.position,
                        size=element.size,
                        color=element.background_color,
                        timeout=element.config.get("timeout", 300),
                        retry_count=element.config.get("retry_count", 0),
                    )
                elif element.element_type == ElementType.CONDITION_NODE:
                    node = WorkflowNode(
                        node_id=element.element_id,
                        node_type=NodeType.CONDITION,
                        name=element.title,
                        condition=element.config.get("condition", "true"),
                        condition_params=element.config.get("condition_params", {}),
                        position=element.position,
                        size=element.size,
                        color=element.background_color,
                    )
                elif element.element_type == ElementType.FORK_NODE:
                    node = WorkflowNode(
                        node_id=element.element_id,
                        node_type=NodeType.FORK,
                        name=element.title,
                        position=element.position,
                        size=element.size,
                        color=element.background_color,
                    )
                elif element.element_type == ElementType.JOIN_NODE:
                    node = WorkflowNode(
                        node_id=element.element_id,
                        node_type=NodeType.JOIN,
                        name=element.title,
                        position=element.position,
                        size=element.size,
                        color=element.background_color,
                    )
                elif element.element_type == ElementType.LOOP_NODE:
                    node = WorkflowNode(
                        node_id=element.element_id,
                        node_type=NodeType.LOOP,
                        name=element.title,
                        condition=element.config.get("loop_condition", "count"),
                        condition_params=element.config.get(
                            "loop_params", {"count": 1}
                        ),
                        position=element.position,
                        size=element.size,
                        color=element.background_color,
                    )
                else:
                    continue  # Skip unsupported element types

                workflow.nodes[node.node_id] = node

            # Convert canvas connections to workflow edges
            for connection in self.canvas.connections.values():
                # Only create edge if both nodes exist in workflow
                if (
                    connection.source_element in workflow.nodes
                    and connection.target_element in workflow.nodes
                ):
                    edge = WorkflowEdge(
                        edge_id=connection.connection_id,
                        source_node=connection.source_element,
                        target_node=connection.target_element,
                        condition=connection.condition,
                        data_mapping=connection.data_mapping,
                        style=connection.stroke_style,
                        color=connection.stroke_color,
                    )

                    workflow.edges.append(edge)

            # Determine entry and exit nodes
            await self._determine_workflow_entry_exit(workflow)

            result = {
                "workflow": workflow,
                "node_count": len(workflow.nodes),
                "edge_count": len(workflow.edges),
                "entry_nodes": workflow.entry_nodes,
                "exit_nodes": workflow.exit_nodes,
                "success": True,
            }

            self.logger.info(f"Canvas exported to workflow: {workflow.workflow_id}")

            return result

        except Exception as e:
            self.logger.error(f"Canvas export failed: {e}")
            return {"error": str(e), "success": False}

    async def get_canvas_state(self) -> Dict[str, Any]:
        """
        Get current canvas state for rendering

        Returns:
                Complete canvas state
        """
        try:
            if not self.canvas:
                return {"error": "No active canvas", "success": False}

            # Prepare elements for serialization
            elements = []
            for element in self.canvas.elements.values():
                elements.append(
                    {
                        "id": element.element_id,
                        "type": element.element_type.value,
                        "position": element.position,
                        "size": element.size,
                        "rotation": element.rotation,
                        "z_index": element.z_index,
                        "background_color": element.background_color,
                        "border_color": element.border_color,
                        "border_width": element.border_width,
                        "border_radius": element.border_radius,
                        "opacity": element.opacity,
                        "selected": element.selected,
                        "dragging": element.dragging,
                        "title": element.title,
                        "description": element.description,
                        "icon": element.icon,
                        "config": element.config,
                    }
                )

            # Prepare connections for serialization
            connections = []
            for connection in self.canvas.connections.values():
                connections.append(
                    {
                        "id": connection.connection_id,
                        "source": connection.source_element,
                        "target": connection.target_element,
                        "source_port": connection.source_port,
                        "target_port": connection.target_port,
                        "path_type": connection.path_type,
                        "stroke_color": connection.stroke_color,
                        "stroke_width": connection.stroke_width,
                        "stroke_style": connection.stroke_style,
                        "source_point": connection.source_point,
                        "target_point": connection.target_point,
                        "control_points": connection.control_points,
                        "selected": connection.selected,
                        "animated": connection.animated,
                        "condition": connection.condition,
                        "enabled": connection.enabled,
                    }
                )

            return {
                "canvas_id": self.canvas.canvas_id,
                "width": self.canvas.width,
                "height": self.canvas.height,
                "background_color": self.canvas.background_color,
                "grid_enabled": self.canvas.grid_enabled,
                "grid_size": self.canvas.grid_size,
                "grid_color": self.canvas.grid_color,
                "zoom_level": self.canvas.zoom_level,
                "pan_offset": self.canvas.pan_offset,
                "view_bounds": self.canvas.view_bounds,
                "elements": elements,
                "connections": connections,
                "selected_elements": list(self.canvas.selected_elements),
                "collaborators": self.canvas.collaborators,
                "cursors": self.canvas.cursors,
                "success": True,
            }

        except Exception as e:
            self.logger.error(f"Get canvas state failed: {e}")
            return {"error": str(e), "success": False}

    async def subscribe_to_updates(self, callback: callable) -> str:
        """
        Subscribe to real-time canvas updates

        Args:
                callback: Update callback function

        Returns:
                Subscription ID
        """
        subscription_id = uuid7str()
        self.update_subscribers.append({"id": subscription_id, "callback": callback})

        self.logger.info(f"Update subscription added: {subscription_id}")

        return subscription_id

    async def unsubscribe_from_updates(self, subscription_id: str) -> bool:
        """
        Unsubscribe from canvas updates

        Args:
                subscription_id: Subscription to remove

        Returns:
                Success status
        """
        self.update_subscribers = [
            sub for sub in self.update_subscribers if sub["id"] != subscription_id
        ]

        self.logger.info(f"Update subscription removed: {subscription_id}")

        return True

    # Private helper methods

    async def _add_default_elements(self):
        """Add default elements to new canvas"""
        # Add a start node
        await self.add_element(
            ElementType.AGENT_NODE,
            (100, 300),
            {
                "title": "Start",
                "background_color": "#4CAF50",
                "config": {
                    "agent_type": "start_node",
                    "prompt_template": "Workflow started",
                },
            },
        )

    async def _save_canvas_state(self):
        """Save current canvas state to history"""
        if not self.canvas:
            return

        # Create state snapshot
        state = {
            "timestamp": datetime.now().isoformat(),
            "elements": {k: v for k, v in self.canvas.elements.items()},
            "connections": {k: v for k, v in self.canvas.connections.items()},
            "zoom_level": self.canvas.zoom_level,
            "pan_offset": self.canvas.pan_offset,
        }

        # Add to history
        if self.canvas.history_index < len(self.canvas.history) - 1:
            # Remove future history if we're not at the end
            self.canvas.history = self.canvas.history[: self.canvas.history_index + 1]

        self.canvas.history.append(state)
        self.canvas.history_index = len(self.canvas.history) - 1

        # Limit history size
        if len(self.canvas.history) > 50:
            self.canvas.history.pop(0)
            self.canvas.history_index -= 1

    async def _notify_update(self, update_type: str, data: Dict[str, Any]):
        """Notify all subscribers of canvas updates"""
        update_data = {
            "type": update_type,
            "data": data,
            "timestamp": datetime.now().isoformat(),
            "canvas_id": self.canvas.canvas_id if self.canvas else None,
        }

        for subscriber in self.update_subscribers:
            try:
                await subscriber["callback"](update_data)
            except Exception as e:
                self.logger.error(f"Update notification failed: {e}")

    # Action handlers

    async def _handle_select(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle element selection"""
        element_ids = parameters.get("element_ids", [])
        multi_select = parameters.get("multi_select", False)

        if not multi_select:
            # Clear existing selection
            for element in self.canvas.elements.values():
                element.selected = False
            for connection in self.canvas.connections.values():
                connection.selected = False
            self.canvas.selected_elements.clear()

        # Select specified elements
        for element_id in element_ids:
            if element_id in self.canvas.elements:
                self.canvas.elements[element_id].selected = True
                self.canvas.selected_elements.add(element_id)
            elif element_id in self.canvas.connections:
                self.canvas.connections[element_id].selected = True
                self.canvas.selected_elements.add(element_id)

        return {
            "selected_count": len(self.canvas.selected_elements),
            "save_state": False,
            "notify": True,
            "success": True,
        }

    async def _handle_drag(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle element dragging"""
        element_id = parameters.get("element_id")
        delta = parameters.get("delta", (0, 0))

        if element_id in self.canvas.elements:
            element = self.canvas.elements[element_id]
            old_position = element.position

            new_position = (old_position[0] + delta[0], old_position[1] + delta[1])

            # Constrain to canvas bounds
            new_position = await self._constrain_to_canvas(new_position, element.size)

            element.position = new_position
            element.dragging = True

            # Update connected paths
            await self._update_element_connections(element_id)

        return {"save_state": True, "notify": True, "success": True}

    async def _handle_connect(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle connection creation"""
        source_id = parameters.get("source_id")
        target_id = parameters.get("target_id")

        if source_id and target_id:
            result = await self.connect_elements(source_id, target_id)
            return {
                "connection_id": result.get("connection_id"),
                "save_state": True,
                "notify": True,
                "success": result.get("success", False),
            }

        return {"save_state": False, "notify": False, "success": False}

    async def _handle_delete(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle element deletion"""
        element_ids = parameters.get("element_ids", [])
        deleted_count = 0

        # Delete elements
        for element_id in element_ids:
            if element_id in self.canvas.elements:
                del self.canvas.elements[element_id]
                deleted_count += 1

                # Remove from selection
                self.canvas.selected_elements.discard(element_id)

                # Remove connected connections
                connections_to_remove = [
                    conn_id
                    for conn_id, conn in self.canvas.connections.items()
                    if conn.source_element == element_id
                    or conn.target_element == element_id
                ]

                for conn_id in connections_to_remove:
                    del self.canvas.connections[conn_id]
                    self.canvas.selected_elements.discard(conn_id)

            elif element_id in self.canvas.connections:
                del self.canvas.connections[element_id]
                deleted_count += 1
                self.canvas.selected_elements.discard(element_id)

        return {
            "deleted_count": deleted_count,
            "save_state": True,
            "notify": True,
            "success": True,
        }

    async def _handle_copy(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle element copying"""
        element_ids = parameters.get("element_ids", list(self.canvas.selected_elements))

        self.canvas.clipboard.clear()

        for element_id in element_ids:
            if element_id in self.canvas.elements:
                element = self.canvas.elements[element_id]
                self.canvas.clipboard.append(
                    {
                        "type": "element",
                        "data": {
                            "element_type": element.element_type.value,
                            "position": element.position,
                            "size": element.size,
                            "background_color": element.background_color,
                            "border_color": element.border_color,
                            "title": element.title,
                            "description": element.description,
                            "config": element.config.copy(),
                        },
                    }
                )

        return {
            "copied_count": len(self.canvas.clipboard),
            "save_state": False,
            "notify": True,
            "success": True,
        }

    async def _handle_paste(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle element pasting"""
        offset = parameters.get("offset", (20, 20))
        pasted_count = 0

        for item in self.canvas.clipboard:
            if item["type"] == "element":
                data = item["data"]

                # Calculate new position with offset
                original_pos = data["position"]
                new_position = (
                    original_pos[0] + offset[0],
                    original_pos[1] + offset[1],
                )

                # Add element
                result = await self.add_element(
                    ElementType(data["element_type"]),
                    new_position,
                    {
                        "size": data["size"],
                        "background_color": data["background_color"],
                        "border_color": data["border_color"],
                        "title": data["title"] + " (Copy)",
                        "description": data["description"],
                        **data["config"],
                    },
                )

                if result.get("success"):
                    pasted_count += 1

        return {
            "pasted_count": pasted_count,
            "save_state": True,
            "notify": True,
            "success": True,
        }

    async def _handle_zoom(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle canvas zoom"""
        zoom_delta = parameters.get("zoom_delta", 0)
        center_point = parameters.get("center_point", (600, 400))

        old_zoom = self.canvas.zoom_level
        new_zoom = max(0.1, min(5.0, old_zoom + zoom_delta))

        if new_zoom != old_zoom:
            self.canvas.zoom_level = new_zoom

            # Adjust pan offset to zoom around center point
            zoom_factor = new_zoom / old_zoom
            center_x, center_y = center_point
            pan_x, pan_y = self.canvas.pan_offset

            new_pan_x = center_x - (center_x - pan_x) * zoom_factor
            new_pan_y = center_y - (center_y - pan_y) * zoom_factor

            self.canvas.pan_offset = (new_pan_x, new_pan_y)

        return {
            "zoom_level": self.canvas.zoom_level,
            "pan_offset": self.canvas.pan_offset,
            "save_state": False,
            "notify": True,
            "success": True,
        }

    async def _handle_pan(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle canvas panning"""
        delta = parameters.get("delta", (0, 0))

        old_pan = self.canvas.pan_offset
        new_pan = (old_pan[0] + delta[0], old_pan[1] + delta[1])

        self.canvas.pan_offset = new_pan

        return {
            "pan_offset": self.canvas.pan_offset,
            "save_state": False,
            "notify": True,
            "success": True,
        }

    # Layout algorithms

    async def _arrange_grid(
        self, elements: List[CanvasElement]
    ) -> Dict[str, Tuple[float, float]]:
        """Arrange elements in grid layout"""
        positions = {}

        if not elements:
            return positions

        import math

        cols = math.ceil(math.sqrt(len(elements)))
        spacing_x = 250
        spacing_y = 150
        start_x = 100
        start_y = 100

        for i, element in enumerate(elements):
            row = i // cols
            col = i % cols

            x = start_x + col * spacing_x
            y = start_y + row * spacing_y

            positions[element.element_id] = (x, y)

        return positions

    async def _arrange_hierarchical(
        self, elements: List[CanvasElement], connections: List[CanvasConnection]
    ) -> Dict[str, Tuple[float, float]]:
        """Arrange elements hierarchically"""
        positions = {}

        # Build adjacency map
        outgoing = {elem.element_id: [] for elem in elements}
        incoming = {elem.element_id: [] for elem in elements}

        for conn in connections:
            if conn.source_element in outgoing and conn.target_element in incoming:
                outgoing[conn.source_element].append(conn.target_element)
                incoming[conn.target_element].append(conn.source_element)

        # Find root nodes
        roots = [elem.element_id for elem in elements if not incoming[elem.element_id]]
        if not roots:
            roots = [elements[0].element_id]

        # Assign levels
        levels = {}
        queue = [(root, 0) for root in roots]
        visited = set()

        while queue:
            node_id, level = queue.pop(0)
            if node_id not in visited:
                visited.add(node_id)

                if level not in levels:
                    levels[level] = []
                levels[level].append(node_id)

                for child in outgoing[node_id]:
                    if child not in visited:
                        queue.append((child, level + 1))

        # Calculate positions
        level_height = 200
        node_spacing = 300

        for level, level_nodes in levels.items():
            y = level * level_height + 100

            if len(level_nodes) == 1:
                x = self.canvas.width / 2
                positions[level_nodes[0]] = (x, y)
            else:
                total_width = (len(level_nodes) - 1) * node_spacing
                start_x = (self.canvas.width - total_width) / 2

                for i, node_id in enumerate(level_nodes):
                    x = start_x + i * node_spacing
                    positions[node_id] = (x, y)

        return positions

    async def _arrange_circular(
        self, elements: List[CanvasElement]
    ) -> Dict[str, Tuple[float, float]]:
        """Arrange elements in circular layout"""
        positions = {}

        if not elements:
            return positions

        import math

        center_x = self.canvas.width / 2
        center_y = self.canvas.height / 2
        radius = min(self.canvas.width, self.canvas.height) / 3

        for i, element in enumerate(elements):
            angle = 2 * math.pi * i / len(elements)
            x = center_x + radius * math.cos(angle)
            y = center_y + radius * math.sin(angle)

            positions[element.element_id] = (x, y)

        return positions

    async def _arrange_force_directed(
        self, elements: List[CanvasElement], connections: List[CanvasConnection]
    ) -> Dict[str, Tuple[float, float]]:
        """Arrange elements using force-directed algorithm"""
        import math
        import random

        positions = {}

        # Initialize positions
        for element in elements:
            positions[element.element_id] = (
                random.uniform(100, self.canvas.width - 100),
                random.uniform(100, self.canvas.height - 100),
            )

        # Force simulation
        for iteration in range(100):
            forces = {elem.element_id: [0, 0] for elem in elements}

            # Repulsion between all nodes
            for elem1 in elements:
                for elem2 in elements:
                    if elem1.element_id != elem2.element_id:
                        x1, y1 = positions[elem1.element_id]
                        x2, y2 = positions[elem2.element_id]

                        dx = x1 - x2
                        dy = y1 - y2
                        distance = (
                            math.sqrt(dx * dx + dy * dy) + 1
                        )  # Avoid division by zero

                        repulsion_force = 2000 / (distance * distance)
                        forces[elem1.element_id][0] += (dx / distance) * repulsion_force
                        forces[elem1.element_id][1] += (dy / distance) * repulsion_force

            # Attraction along connections
            for conn in connections:
                if (
                    conn.source_element in positions
                    and conn.target_element in positions
                ):
                    x1, y1 = positions[conn.source_element]
                    x2, y2 = positions[conn.target_element]

                    dx = x2 - x1
                    dy = y2 - y1
                    distance = math.sqrt(dx * dx + dy * dy) + 1

                    attraction_force = distance * 0.02
                    forces[conn.source_element][0] += (dx / distance) * attraction_force
                    forces[conn.source_element][1] += (dy / distance) * attraction_force
                    forces[conn.target_element][0] -= (dx / distance) * attraction_force
                    forces[conn.target_element][1] -= (dy / distance) * attraction_force

            # Update positions with damping
            for element in elements:
                x, y = positions[element.element_id]
                fx, fy = forces[element.element_id]

                # Apply forces with damping
                damping = 0.8
                new_x = max(50, min(self.canvas.width - 50, x + fx * 0.1 * damping))
                new_y = max(50, min(self.canvas.height - 50, y + fy * 0.1 * damping))

                positions[element.element_id] = (new_x, new_y)

        return positions

    async def _auto_arrange(
        self, elements: List[CanvasElement], connections: List[CanvasConnection]
    ) -> Dict[str, Tuple[float, float]]:
        """Automatically choose best arrangement"""
        # Simple heuristics for arrangement selection
        if len(connections) == 0:
            return await self._arrange_grid(elements)
        elif len(elements) <= 8:
            return await self._arrange_circular(elements)
        else:
            return await self._arrange_hierarchical(elements, connections)

    # Connection helpers

    async def _calculate_connection_point(
        self, element: CanvasElement, port_type: str
    ) -> Tuple[float, float]:
        """Calculate connection point on element"""
        x, y = element.position
        width, height = element.size

        if port_type == "output":
            return (x + width, y + height / 2)  # Right center
        else:  # input
            return (x, y + height / 2)  # Left center

    async def _calculate_bezier_control_points(
        self, start: Tuple[float, float], end: Tuple[float, float]
    ) -> List[Tuple[float, float]]:
        """Calculate control points for bezier curve"""
        x1, y1 = start
        x2, y2 = end

        # Control points for smooth curve
        offset = abs(x2 - x1) * 0.3

        cp1 = (x1 + offset, y1)
        cp2 = (x2 - offset, y2)

        return [cp1, cp2]

    async def _update_element_connections(self, element_id: str):
        """Update connection paths for element"""
        if element_id not in self.canvas.elements:
            return

        element = self.canvas.elements[element_id]

        # Update connections where this element is source or target
        for connection in self.canvas.connections.values():
            if connection.source_element == element_id:
                connection.source_point = await self._calculate_connection_point(
                    element, "output"
                )
            elif connection.target_element == element_id:
                connection.target_point = await self._calculate_connection_point(
                    element, "input"
                )

            # Recalculate control points for bezier curves
            if (
                connection.source_element == element_id
                or connection.target_element == element_id
            ):
                if connection.path_type == "bezier":
                    connection.control_points = (
                        await self._calculate_bezier_control_points(
                            connection.source_point, connection.target_point
                        )
                    )

    async def _update_all_connection_paths(self):
        """Update all connection paths"""
        for connection in self.canvas.connections.values():
            # Get updated connection points
            if connection.source_element in self.canvas.elements:
                source_element = self.canvas.elements[connection.source_element]
                connection.source_point = await self._calculate_connection_point(
                    source_element, "output"
                )

            if connection.target_element in self.canvas.elements:
                target_element = self.canvas.elements[connection.target_element]
                connection.target_point = await self._calculate_connection_point(
                    target_element, "input"
                )

            # Update control points
            if connection.path_type == "bezier":
                connection.control_points = await self._calculate_bezier_control_points(
                    connection.source_point, connection.target_point
                )

    async def _constrain_to_canvas(
        self, position: Tuple[float, float], size: Tuple[float, float]
    ) -> Tuple[float, float]:
        """Constrain position to canvas bounds"""
        x, y = position
        width, height = size

        # Keep element within canvas bounds
        x = max(0, min(self.canvas.width - width, x))
        y = max(0, min(self.canvas.height - height, y))

        return (x, y)

    async def _determine_workflow_entry_exit(self, workflow: Workflow):
        """Determine workflow entry and exit nodes"""
        # Find nodes with no incoming edges (entry points)
        nodes_with_incoming = {edge.target_node for edge in workflow.edges}
        entry_nodes = [
            node_id
            for node_id in workflow.nodes.keys()
            if node_id not in nodes_with_incoming
        ]

        # Find nodes with no outgoing edges (exit points)
        nodes_with_outgoing = {edge.source_node for edge in workflow.edges}
        exit_nodes = [
            node_id
            for node_id in workflow.nodes.keys()
            if node_id not in nodes_with_outgoing
        ]

        workflow.entry_nodes = entry_nodes
        workflow.exit_nodes = exit_nodes

    def _initialize_element_templates(self) -> Dict[ElementType, Dict[str, Any]]:
        """Initialize element templates"""
        return {
            ElementType.AGENT_NODE: {
                "size": (200, 100),
                "background_color": "#e3f2fd",
                "border_color": "#1976d2",
                "title": "Agent",
                "description": "AI Agent Node",
                "icon": "🤖",
            },
            ElementType.CONDITION_NODE: {
                "size": (120, 80),
                "background_color": "#fff3e0",
                "border_color": "#f57c00",
                "title": "Condition",
                "description": "Conditional Logic",
                "icon": "❓",
            },
            ElementType.FORK_NODE: {
                "size": (80, 80),
                "background_color": "#f3e5f5",
                "border_color": "#7b1fa2",
                "title": "Fork",
                "description": "Parallel Fork",
                "icon": "⑃",
            },
            ElementType.JOIN_NODE: {
                "size": (80, 80),
                "background_color": "#e8f5e8",
                "border_color": "#388e3c",
                "title": "Join",
                "description": "Parallel Join",
                "icon": "⑃",
            },
            ElementType.LOOP_NODE: {
                "size": (100, 60),
                "background_color": "#fce4ec",
                "border_color": "#c2185b",
                "title": "Loop",
                "description": "Loop Control",
                "icon": "🔄",
            },
        }
