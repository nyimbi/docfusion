"""
SVG Renderer

High-quality SVG generation with scalable vector graphics optimization,
interactive elements, and cross-platform compatibility.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import logging
import math
import re
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


from pydantic import BaseModel, ConfigDict, Field


class SVGOptimizationLevel(str, Enum):
    """SVG optimization levels"""

    NONE = "none"
    BASIC = "basic"
    ADVANCED = "advanced"
    MAXIMUM = "maximum"


@dataclass
class SVGElement:
    """SVG element representation"""

    tag: str
    attributes: Dict[str, str] = field(default_factory=dict)
    content: str = ""
    children: List["SVGElement"] = field(default_factory=list)

    def to_xml(self) -> str:
        """Convert to XML string"""
        attr_str = " ".join(
            [f'{key}="{value}"' for key, value in self.attributes.items()]
        )

        if self.children or self.content:
            children_str = "".join([child.to_xml() for child in self.children])
            return f"<{self.tag} {attr_str}>{self.content}{children_str}</{self.tag}>"
        else:
            return f"<{self.tag} {attr_str} />"


@dataclass
class SVGConfiguration:
    """SVG rendering configuration"""

    width: int = 800
    height: int = 600
    viewBox: Optional[str] = None

    # Quality settings
    precision: int = 2  # Decimal precision for coordinates
    optimization_level: SVGOptimizationLevel = SVGOptimizationLevel.BASIC

    # Styling
    background_color: str = "white"
    font_family: str = "Arial, sans-serif"
    font_size: int = 12

    # Interactive features
    interactive: bool = True
    hover_effects: bool = True
    click_handlers: bool = False

    # Accessibility
    include_descriptions: bool = True
    include_titles: bool = True
    aria_labels: bool = True

    # Output options
    minify: bool = False
    pretty_print: bool = True
    include_xml_declaration: bool = True


class SVGRenderer:
    """
    High-quality SVG rendering engine

    Generates optimized scalable vector graphics with interactive elements,
    accessibility features, and cross-platform compatibility.
    """

    def __init__(self):
        # SVG namespace and declarations
        self.svg_namespace = "http://www.w3.org/2000/svg"
        self.xlink_namespace = "http://www.w3.org/1999/xlink"

        # Optimization patterns
        self.optimization_patterns = self._initialize_optimization_patterns()

        # Interactive templates
        self.interaction_templates = self._initialize_interaction_templates()

        self.logger = logging.getLogger("svg_renderer")

    async def render_chart_to_svg(
        self, chart_data: Dict[str, Any], config: Optional[SVGConfiguration] = None
    ) -> Dict[str, Any]:
        """
        Render chart data to SVG format

        Args:
                chart_data: Chart data with figure and configuration
                config: SVG-specific configuration

        Returns:
                SVG rendering result
        """
        if not config:
            config = SVGConfiguration()

        try:
            # Create root SVG element
            svg_root = await self._create_svg_root(config)

            # Convert chart elements to SVG
            if "figure" in chart_data and hasattr(chart_data["figure"], "to_dict"):
                # Handle Plotly figures
                await self._convert_plotly_to_svg(
                    chart_data["figure"], svg_root, config
                )
            elif "elements" in chart_data:
                # Handle custom element data
                await self._convert_elements_to_svg(
                    chart_data["elements"], svg_root, config
                )
            else:
                # Generate placeholder
                await self._create_placeholder_svg(
                    svg_root, config, chart_data.get("title", "Chart")
                )

            # Apply optimizations
            if config.optimization_level != SVGOptimizationLevel.NONE:
                await self._optimize_svg(svg_root, config)

            # Add interactivity if enabled
            if config.interactive:
                await self._add_interactivity(svg_root, config)

            # Add accessibility features
            if config.include_descriptions or config.aria_labels:
                await self._add_accessibility_features(svg_root, config, chart_data)

            # Convert to string
            svg_string = await self._svg_to_string(svg_root, config)

            result = {
                "svg_id": uuid7str(),
                "svg_content": svg_string,
                "config": config,
                "metadata": {
                    "width": config.width,
                    "height": config.height,
                    "optimization_level": config.optimization_level.value,
                    "interactive": config.interactive,
                    "file_size": len(svg_string.encode("utf-8")),
                    "generated_at": datetime.now().isoformat(),
                },
                "success": True,
            }

            self.logger.info(f"SVG rendered: {result['metadata']['file_size']} bytes")

            return result

        except Exception as e:
            self.logger.error(f"SVG rendering failed: {e}")
            return {"svg_id": uuid7str(), "error": str(e), "success": False}

    async def render_diagram_to_svg(
        self, diagram_data: Dict[str, Any], config: Optional[SVGConfiguration] = None
    ) -> Dict[str, Any]:
        """
        Render diagram data to SVG format

        Args:
                diagram_data: Diagram data with nodes and edges
                config: SVG-specific configuration

        Returns:
                SVG rendering result
        """
        if not config:
            config = SVGConfiguration()

        try:
            # Create root SVG element
            svg_root = await self._create_svg_root(config)

            # Add diagram elements
            await self._render_diagram_elements(diagram_data, svg_root, config)

            # Apply optimizations and features
            if config.optimization_level != SVGOptimizationLevel.NONE:
                await self._optimize_svg(svg_root, config)

            if config.interactive:
                await self._add_diagram_interactivity(svg_root, config)

            # Convert to string
            svg_string = await self._svg_to_string(svg_root, config)

            return {
                "svg_id": uuid7str(),
                "svg_content": svg_string,
                "success": True,
                "metadata": {
                    "width": config.width,
                    "height": config.height,
                    "file_size": len(svg_string.encode("utf-8")),
                    "generated_at": datetime.now().isoformat(),
                },
            }

        except Exception as e:
            self.logger.error(f"Diagram SVG rendering failed: {e}")
            return {"svg_id": uuid7str(), "error": str(e), "success": False}

    async def optimize_svg(
        self,
        svg_content: str,
        optimization_level: SVGOptimizationLevel = SVGOptimizationLevel.BASIC,
    ) -> str:
        """
        Optimize existing SVG content

        Args:
                svg_content: SVG content to optimize
                optimization_level: Level of optimization to apply

        Returns:
                Optimized SVG content
        """
        try:
            # Parse SVG
            root = ET.fromstring(svg_content)
            svg_element = SVGElement(tag="svg")
            await self._xml_to_svg_element(root, svg_element)

            # Apply optimizations
            config = SVGConfiguration(optimization_level=optimization_level)
            await self._optimize_svg(svg_element, config)

            # Convert back to string
            return await self._svg_to_string(svg_element, config)

        except Exception as e:
            self.logger.error(f"SVG optimization failed: {e}")
            return svg_content  # Return original on error

    async def batch_render_to_svg(
        self, items: List[Dict[str, Any]], config: Optional[SVGConfiguration] = None
    ) -> Dict[str, Any]:
        """
        Batch render multiple items to SVG

        Args:
                items: List of chart/diagram data to render
                config: SVG configuration

        Returns:
                Batch rendering results
        """
        results = []

        for i, item in enumerate(items):
            if item.get("type") == "chart":
                result = await self.render_chart_to_svg(item, config)
            elif item.get("type") == "diagram":
                result = await self.render_diagram_to_svg(item, config)
            else:
                result = {"error": "Unknown item type", "success": False}

            result["batch_index"] = i
            results.append(result)

        successful_renders = sum(1 for r in results if r.get("success", False))

        return {
            "batch_id": uuid7str(),
            "results": results,
            "total_items": len(items),
            "successful_renders": successful_renders,
            "success_rate": successful_renders / len(items) if items else 0,
            "generated_at": datetime.now().isoformat(),
        }

    async def _create_svg_root(self, config: SVGConfiguration) -> SVGElement:
        """Create root SVG element with configuration"""
        viewBox = config.viewBox or f"0 0 {config.width} {config.height}"

        attributes = {
            "xmlns": self.svg_namespace,
            "xmlns:xlink": self.xlink_namespace,
            "width": str(config.width),
            "height": str(config.height),
            "viewBox": viewBox,
        }

        svg_root = SVGElement(tag="svg", attributes=attributes)

        # Add background if specified
        if config.background_color and config.background_color != "transparent":
            background = SVGElement(
                tag="rect",
                attributes={
                    "width": "100%",
                    "height": "100%",
                    "fill": config.background_color,
                },
            )
            svg_root.children.append(background)

        # Add default styles
        style_element = SVGElement(tag="style")
        style_element.content = f"""
			.svg-text {{
				font-family: {config.font_family};
				font-size: {config.font_size}px;
			}}
		"""
        if config.hover_effects:
            style_element.content += """
				.interactive:hover {
					opacity: 0.8;
					cursor: pointer;
				}
			"""
        svg_root.children.append(style_element)

        return svg_root

    async def _convert_plotly_to_svg(
        self, figure, svg_root: SVGElement, config: SVGConfiguration
    ):
        """Convert Plotly figure to SVG elements"""
        # This would implement conversion from Plotly figure to SVG
        # For now, create a placeholder
        placeholder = SVGElement(
            tag="text",
            attributes={
                "x": str(config.width // 2),
                "y": str(config.height // 2),
                "text-anchor": "middle",
                "class": "svg-text",
            },
            content="Plotly Chart (SVG Conversion)",
        )
        svg_root.children.append(placeholder)

    async def _convert_elements_to_svg(
        self,
        elements: List[Dict[str, Any]],
        svg_root: SVGElement,
        config: SVGConfiguration,
    ):
        """Convert custom elements to SVG"""
        for element in elements:
            element_type = element.get("type", "rect")

            if element_type == "rect":
                svg_element = SVGElement(
                    tag="rect",
                    attributes={
                        "x": str(element.get("x", 0)),
                        "y": str(element.get("y", 0)),
                        "width": str(element.get("width", 100)),
                        "height": str(element.get("height", 100)),
                        "fill": element.get("fill", "#000000"),
                    },
                )
            elif element_type == "circle":
                svg_element = SVGElement(
                    tag="circle",
                    attributes={
                        "cx": str(element.get("cx", 50)),
                        "cy": str(element.get("cy", 50)),
                        "r": str(element.get("r", 25)),
                        "fill": element.get("fill", "#000000"),
                    },
                )
            elif element_type == "text":
                svg_element = SVGElement(
                    tag="text",
                    attributes={
                        "x": str(element.get("x", 0)),
                        "y": str(element.get("y", 0)),
                        "class": "svg-text",
                    },
                    content=element.get("text", ""),
                )
            else:
                continue  # Skip unknown elements

            if config.interactive:
                svg_element.attributes["class"] = (
                    svg_element.attributes.get("class", "") + " interactive"
                )

            svg_root.children.append(svg_element)

    async def _create_placeholder_svg(
        self, svg_root: SVGElement, config: SVGConfiguration, title: str
    ):
        """Create placeholder SVG content"""
        # Background
        bg_rect = SVGElement(
            tag="rect",
            attributes={
                "x": "10%",
                "y": "10%",
                "width": "80%",
                "height": "80%",
                "fill": "#f0f0f0",
                "stroke": "#cccccc",
                "stroke-width": "2",
            },
        )
        svg_root.children.append(bg_rect)

        # Title
        title_text = SVGElement(
            tag="text",
            attributes={
                "x": "50%",
                "y": "50%",
                "text-anchor": "middle",
                "class": "svg-text",
                "font-size": str(config.font_size + 4),
            },
            content=title,
        )
        svg_root.children.append(title_text)

    async def _render_diagram_elements(
        self,
        diagram_data: Dict[str, Any],
        svg_root: SVGElement,
        config: SVGConfiguration,
    ):
        """Render diagram nodes and edges to SVG"""
        nodes = diagram_data.get("nodes", [])
        edges = diagram_data.get("edges", [])

        # Create definitions for reusable elements
        defs = SVGElement(tag="defs")

        # Arrow marker for edges
        marker = SVGElement(
            tag="marker",
            attributes={
                "id": "arrowhead",
                "markerWidth": "10",
                "markerHeight": "7",
                "refX": "9",
                "refY": "3.5",
                "orient": "auto",
            },
        )
        arrow_path = SVGElement(
            tag="polygon", attributes={"points": "0 0, 10 3.5, 0 7", "fill": "#000000"}
        )
        marker.children.append(arrow_path)
        defs.children.append(marker)
        svg_root.children.append(defs)

        # Render edges first (so they appear behind nodes)
        for edge in edges:
            from_node = next(
                (n for n in nodes if n.get("id") == edge.get("from")), None
            )
            to_node = next((n for n in nodes if n.get("id") == edge.get("to")), None)

            if from_node and to_node:
                from_pos = from_node.get("position", [100, 100])
                to_pos = to_node.get("position", [200, 200])

                line = SVGElement(
                    tag="line",
                    attributes={
                        "x1": str(from_pos[0]),
                        "y1": str(from_pos[1]),
                        "x2": str(to_pos[0]),
                        "y2": str(to_pos[1]),
                        "stroke": edge.get("color", "#000000"),
                        "stroke-width": "2",
                        "marker-end": "url(#arrowhead)",
                    },
                )
                svg_root.children.append(line)

                # Add edge label if present
                if edge.get("label"):
                    mid_x = (from_pos[0] + to_pos[0]) / 2
                    mid_y = (from_pos[1] + to_pos[1]) / 2

                    label_text = SVGElement(
                        tag="text",
                        attributes={
                            "x": str(mid_x),
                            "y": str(mid_y),
                            "text-anchor": "middle",
                            "class": "svg-text",
                            "font-size": str(config.font_size - 2),
                        },
                        content=edge.get("label", ""),
                    )
                    svg_root.children.append(label_text)

        # Render nodes
        for node in nodes:
            position = node.get("position", [100, 100])
            size = node.get("size", [80, 40])
            shape = node.get("shape", "rectangle")
            color = node.get("color", "#lightblue")
            label = node.get("label", "")

            if shape == "rectangle":
                rect = SVGElement(
                    tag="rect",
                    attributes={
                        "x": str(position[0] - size[0] / 2),
                        "y": str(position[1] - size[1] / 2),
                        "width": str(size[0]),
                        "height": str(size[1]),
                        "fill": color,
                        "stroke": "#000000",
                        "rx": "5",
                    },
                )
                svg_root.children.append(rect)
            elif shape == "circle":
                circle = SVGElement(
                    tag="circle",
                    attributes={
                        "cx": str(position[0]),
                        "cy": str(position[1]),
                        "r": str(size[0] / 2),
                        "fill": color,
                        "stroke": "#000000",
                    },
                )
                svg_root.children.append(circle)

            # Add node label
            if label:
                text = SVGElement(
                    tag="text",
                    attributes={
                        "x": str(position[0]),
                        "y": str(position[1] + config.font_size / 3),
                        "text-anchor": "middle",
                        "class": "svg-text",
                    },
                    content=label,
                )
                svg_root.children.append(text)

    async def _optimize_svg(self, svg_root: SVGElement, config: SVGConfiguration):
        """Apply SVG optimizations"""
        if config.optimization_level == SVGOptimizationLevel.BASIC:
            await self._basic_optimization(svg_root)
        elif config.optimization_level == SVGOptimizationLevel.ADVANCED:
            await self._basic_optimization(svg_root)
            await self._advanced_optimization(svg_root)
        elif config.optimization_level == SVGOptimizationLevel.MAXIMUM:
            await self._basic_optimization(svg_root)
            await self._advanced_optimization(svg_root)
            await self._maximum_optimization(svg_root)

    async def _basic_optimization(self, svg_root: SVGElement):
        """Apply basic SVG optimizations"""
        # Remove empty groups and unused elements
        await self._remove_empty_elements(svg_root)

        # Round coordinates to reduce precision
        await self._round_coordinates(svg_root, precision=2)

    async def _advanced_optimization(self, svg_root: SVGElement):
        """Apply advanced SVG optimizations"""
        # Merge similar elements
        await self._merge_similar_elements(svg_root)

        # Optimize paths
        await self._optimize_paths(svg_root)

    async def _maximum_optimization(self, svg_root: SVGElement):
        """Apply maximum SVG optimizations"""
        # Remove unnecessary attributes
        await self._remove_default_attributes(svg_root)

        # Compress style attributes
        await self._compress_styles(svg_root)

    async def _add_interactivity(self, svg_root: SVGElement, config: SVGConfiguration):
        """Add interactive features to SVG"""
        if not config.interactive:
            return

        # Add JavaScript for interactivity
        script = SVGElement(tag="script")
        script.content = """
			document.addEventListener('DOMContentLoaded', function() {
				const interactiveElements = document.querySelectorAll('.interactive');
				interactiveElements.forEach(element => {
					element.addEventListener('mouseover', function() {
						this.style.opacity = '0.8';
					});
					element.addEventListener('mouseout', function() {
						this.style.opacity = '1';
					});
				});
			});
		"""
        svg_root.children.append(script)

    async def _add_diagram_interactivity(
        self, svg_root: SVGElement, config: SVGConfiguration
    ):
        """Add diagram-specific interactive features"""
        # Add tooltip support
        script = SVGElement(tag="script")
        script.content = """
			// Diagram interactivity code would go here
		"""
        svg_root.children.append(script)

    async def _add_accessibility_features(
        self, svg_root: SVGElement, config: SVGConfiguration, data: Dict[str, Any]
    ):
        """Add accessibility features to SVG"""
        if config.include_titles:
            title = SVGElement(tag="title", content=data.get("title", "Chart"))
            svg_root.children.insert(0, title)

        if config.include_descriptions:
            desc = SVGElement(
                tag="desc", content=data.get("description", "Generated visualization")
            )
            svg_root.children.insert(-1 if config.include_titles else 0, desc)

        if config.aria_labels:
            svg_root.attributes["role"] = "img"
            svg_root.attributes["aria-label"] = data.get("title", "Chart")

    async def _svg_to_string(
        self, svg_root: SVGElement, config: SVGConfiguration
    ) -> str:
        """Convert SVG element to string"""
        xml_declaration = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            if config.include_xml_declaration
            else ""
        )
        svg_content = svg_root.to_xml()

        if config.pretty_print:
            svg_content = await self._format_xml(svg_content)

        if config.minify:
            svg_content = await self._minify_svg(svg_content)

        return xml_declaration + svg_content

    async def _format_xml(self, xml_content: str) -> str:
        """Format XML with proper indentation"""
        try:
            import xml.dom.minidom

            dom = xml.dom.minidom.parseString(xml_content)
            return dom.toprettyxml(indent="  ")
        except:
            return xml_content  # Return original if formatting fails

    async def _minify_svg(self, svg_content: str) -> str:
        """Minify SVG content"""
        # Remove extra whitespace and newlines
        minified = re.sub(r"\s+", " ", svg_content)
        minified = re.sub(r">\s+<", "><", minified)
        return minified.strip()

    async def _remove_empty_elements(self, element: SVGElement):
        """Remove empty elements recursively"""
        element.children = [
            child
            for child in element.children
            if child.tag or child.content or child.attributes
        ]

        for child in element.children:
            await self._remove_empty_elements(child)

    async def _round_coordinates(self, element: SVGElement, precision: int = 2):
        """Round coordinate values to reduce file size"""
        coordinate_attrs = [
            "x",
            "y",
            "cx",
            "cy",
            "x1",
            "y1",
            "x2",
            "y2",
            "width",
            "height",
            "r",
        ]

        for attr in coordinate_attrs:
            if attr in element.attributes:
                try:
                    value = float(element.attributes[attr])
                    element.attributes[attr] = str(round(value, precision))
                except ValueError:
                    pass  # Skip non-numeric values

        for child in element.children:
            await self._round_coordinates(child, precision)

    async def _merge_similar_elements(self, element: SVGElement):
        """Merge similar elements to reduce redundancy"""
        # This would implement logic to merge similar elements
        pass

    async def _optimize_paths(self, element: SVGElement):
        """Optimize SVG path elements"""
        # This would implement path optimization logic
        pass

    async def _remove_default_attributes(self, element: SVGElement):
        """Remove attributes that have default values"""
        # This would remove attributes with default values
        pass

    async def _compress_styles(self, element: SVGElement):
        """Compress style attributes"""
        # This would compress CSS styles
        pass

    async def _xml_to_svg_element(self, xml_element, svg_element: SVGElement):
        """Convert XML element to SVG element"""
        # This would convert ElementTree elements to SVGElement
        pass

    def _initialize_optimization_patterns(self) -> Dict[str, Any]:
        """Initialize optimization patterns"""
        return {
            "remove_whitespace": True,
            "round_coordinates": True,
            "merge_paths": True,
            "remove_empty_groups": True,
        }

    def _initialize_interaction_templates(self) -> Dict[str, str]:
        """Initialize interactive templates"""
        return {
            "hover_effect": "opacity: 0.8;",
            "click_effect": "transform: scale(1.05);",
            "tooltip": "/* Tooltip CSS */",
        }
