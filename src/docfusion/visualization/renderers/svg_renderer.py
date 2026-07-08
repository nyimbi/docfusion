"""
SVG Renderer

High-quality SVG generation with scalable vector graphics optimization,
interactive elements, and cross-platform compatibility.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import logging
import re
import base64
import importlib.util
# Security: use defusedxml to prevent XXE attacks when available
try:
    import defusedxml.ElementTree as ET
except ImportError:
    import xml.etree.ElementTree as ET  # noqa: S405 - fallback when defusedxml not installed
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from ...core.utils import uuid7str

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

            figure = chart_data.get("figure")
            if figure is not None and hasattr(figure, "to_dict"):
                await self._convert_plotly_to_svg(
                    figure, svg_root, config
                )
            elif "elements" in chart_data:
                await self._convert_elements_to_svg(
                    chart_data["elements"], svg_root, config
                )
            elif "data" in chart_data:
                await self._convert_tabular_data_to_svg(
                    chart_data["data"], svg_root, config
                )
            else:
                raise RuntimeError(
                    "SVG chart rendering requires a plotly figure, explicit SVG elements, "
                    "or tabular chart data"
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
        if (
            hasattr(figure, "to_image")
            and importlib.util.find_spec("kaleido") is not None
        ):
            try:
                svg_bytes = figure.to_image(
                    format="svg", width=config.width, height=config.height
                )
                xml_root = ET.fromstring(svg_bytes)
                converted = SVGElement(tag="")
                await self._xml_to_svg_element(xml_root, converted)
                svg_root.children.extend(converted.children)
                return
            except Exception as e:
                self.logger.warning(
                    f"Plotly static SVG export failed; rendering traces directly: {e}"
                )

        figure_dict = figure.to_dict()
        traces = figure_dict.get("data", [])
        if not traces:
            raise RuntimeError("Plotly figure contains no renderable traces")

        layout = figure_dict.get("layout", {})
        title = layout.get("title", "")
        if isinstance(title, dict):
            title = title.get("text", "")
        if title:
            svg_root.children.append(
                SVGElement(
                    tag="text",
                    attributes={
                        "x": str(config.width // 2),
                        "y": "28",
                        "text-anchor": "middle",
                        "class": "svg-text",
                        "font-size": str(config.font_size + 4),
                    },
                    content=str(title),
                )
            )

        rendered_any = False
        for trace in traces:
            if await self._convert_trace_to_svg(trace, svg_root, config):
                rendered_any = True

        if not rendered_any:
            raise RuntimeError("Plotly figure traces are not supported by SVG renderer")

    async def _convert_tabular_data_to_svg(
        self,
        data: Dict[str, List[Any]],
        svg_root: SVGElement,
        config: SVGConfiguration,
    ):
        """Render tabular chart data as SVG bars using actual values."""
        labels, values = self._extract_chart_series(data)
        if not values:
            raise RuntimeError("SVG chart rendering requires numeric data")

        await self._draw_bar_series(svg_root, config, labels, values, "#1f77b4")

    async def _convert_trace_to_svg(
        self, trace: Dict[str, Any], svg_root: SVGElement, config: SVGConfiguration
    ) -> bool:
        """Render a basic Plotly trace as primitive SVG elements."""
        trace_type = trace.get("type", "scatter")
        labels = trace.get("x")
        if labels is None:
            labels = trace.get("labels")
        values = trace.get("y")
        if values is None:
            values = trace.get("values")
        color = (
            trace.get("marker", {}).get("color")
            if isinstance(trace.get("marker"), dict)
            else None
        ) or trace.get("line", {}).get("color", "#1f77b4")

        if values is None:
            return False

        numeric_values = self._to_float_series(values)
        if not numeric_values:
            return False

        if labels is None or len(labels) != len(numeric_values):
            labels = list(range(1, len(numeric_values) + 1))

        if trace_type == "bar":
            await self._draw_bar_series(svg_root, config, labels, numeric_values, color)
            return True

        await self._draw_line_or_scatter_series(
            svg_root,
            config,
            numeric_values,
            color,
            draw_line=trace_type in {"scatter", "line"} and "lines" in trace.get("mode", "lines"),
            draw_markers=trace_type != "line" and "markers" in trace.get("mode", "markers"),
        )
        return True

    async def _draw_bar_series(
        self,
        svg_root: SVGElement,
        config: SVGConfiguration,
        labels: List[Any],
        values: List[float],
        color: str,
    ):
        chart_left = 60
        chart_top = 60
        chart_width = max(1, config.width - 100)
        chart_height = max(1, config.height - 120)
        max_value = max(values) or 1.0
        slot_width = chart_width / max(1, len(values))
        bar_width = max(6.0, slot_width * 0.65)

        svg_root.children.append(
            SVGElement(
                tag="line",
                attributes={
                    "x1": str(chart_left),
                    "y1": str(chart_top + chart_height),
                    "x2": str(chart_left + chart_width),
                    "y2": str(chart_top + chart_height),
                    "stroke": "#222222",
                },
            )
        )

        for index, value in enumerate(values):
            bar_height = chart_height * max(0.0, value / max_value)
            x = chart_left + index * slot_width + (slot_width - bar_width) / 2
            y = chart_top + chart_height - bar_height
            svg_root.children.append(
                SVGElement(
                    tag="rect",
                    attributes={
                        "x": f"{x:.2f}",
                        "y": f"{y:.2f}",
                        "width": f"{bar_width:.2f}",
                        "height": f"{bar_height:.2f}",
                        "fill": str(color),
                        "class": "interactive",
                    },
                )
            )
            if index < 12:
                svg_root.children.append(
                    SVGElement(
                        tag="text",
                        attributes={
                            "x": f"{x + bar_width / 2:.2f}",
                            "y": str(config.height - 28),
                            "text-anchor": "middle",
                            "class": "svg-text",
                            "font-size": str(max(9, config.font_size - 2)),
                        },
                        content=str(labels[index])[:12],
                    )
                )

    async def _draw_line_or_scatter_series(
        self,
        svg_root: SVGElement,
        config: SVGConfiguration,
        values: List[float],
        color: str,
        draw_line: bool,
        draw_markers: bool,
    ):
        chart_left = 60
        chart_top = 60
        chart_width = max(1, config.width - 100)
        chart_height = max(1, config.height - 120)
        max_value = max(values) or 1.0
        min_value = min(values)
        value_range = max(max_value - min_value, 1.0)
        step = chart_width / max(1, len(values) - 1)
        points = []

        for index, value in enumerate(values):
            x = chart_left + index * step
            y = chart_top + chart_height - ((value - min_value) / value_range) * chart_height
            points.append((x, y))

        if draw_line and points:
            svg_root.children.append(
                SVGElement(
                    tag="polyline",
                    attributes={
                        "points": " ".join(f"{x:.2f},{y:.2f}" for x, y in points),
                        "fill": "none",
                        "stroke": str(color),
                        "stroke-width": "2",
                    },
                )
            )

        if draw_markers:
            for x, y in points:
                svg_root.children.append(
                    SVGElement(
                        tag="circle",
                        attributes={
                            "cx": f"{x:.2f}",
                            "cy": f"{y:.2f}",
                            "r": "4",
                            "fill": str(color),
                            "class": "interactive",
                        },
                    )
                )

    def _extract_chart_series(
        self, data: Optional[Dict[str, List[Any]]]
    ) -> tuple[List[Any], List[float]]:
        if not data:
            return [], []

        labels: List[Any] = []
        values: List[float] = []
        label_column = None

        for column, column_values in data.items():
            numeric_values = self._to_float_series(column_values)
            if numeric_values and not values:
                values = numeric_values
            elif label_column is None:
                label_column = column

        if not values:
            first_column = next(iter(data.values()), [])
            counts: Dict[str, float] = {}
            for value in first_column:
                counts[str(value)] = counts.get(str(value), 0.0) + 1.0
            return list(counts.keys()), list(counts.values())

        if label_column and len(data[label_column]) == len(values):
            labels = data[label_column]
        else:
            labels = list(range(1, len(values) + 1))

        return labels, values

    def _to_float_series(self, values: Any) -> List[float]:
        if values is None:
            return []

        if isinstance(values, dict) and "bdata" in values and "dtype" in values:
            try:
                import numpy as np

                dtype_map = {
                    "f8": np.float64,
                    "f4": np.float32,
                    "i8": np.int64,
                    "i4": np.int32,
                    "i2": np.int16,
                    "i1": np.int8,
                    "u8": np.uint64,
                    "u4": np.uint32,
                    "u2": np.uint16,
                    "u1": np.uint8,
                }
                dtype = dtype_map.get(values["dtype"])
                if dtype is None:
                    return []
                decoded = base64.b64decode(values["bdata"])
                return [float(value) for value in np.frombuffer(decoded, dtype=dtype)]
            except Exception:
                return []

        numeric_values = []
        for value in values:
            try:
                numeric_values.append(float(value))
            except (TypeError, ValueError):
                return []

        return numeric_values

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
        except (ValueError, TypeError) as e:
            self.logger.warning(f"XML formatting failed: {e}")
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
        """Merge adjacent similar elements to reduce redundancy.

        Groups children by (tag, frozen attributes) signature and replaces
        adjacent runs with a single merged element when safe.
        """
        if not element.children:
            return

        merged_children: List[SVGElement] = []
        current_run: List[SVGElement] = []

        def _signature(child: SVGElement) -> tuple:
            attrs = tuple(sorted(child.attributes.items()))
            return (child.tag, attrs)

        def _flush_run():
            if not current_run:
                return
            if len(current_run) == 1:
                merged_children.append(current_run[0])
            else:
                # Merge into first element's tag/attributes, concatenate content
                base = current_run[0]
                merged_content = "".join(c.content for c in current_run)
                merged = SVGElement(
                    tag=base.tag,
                    attributes=dict(base.attributes),
                    content=merged_content,
                    children=[],
                )
                merged_children.append(merged)
            current_run.clear()

        for child in element.children:
            if child.children:
                # Recursive merge on descendants first
                await self._merge_similar_elements(child)
                merged_children.append(child)
                continue

            if not current_run:
                current_run.append(child)
            elif _signature(child) == _signature(current_run[0]):
                current_run.append(child)
            else:
                _flush_run()
                current_run.append(child)

        _flush_run()
        element.children = merged_children

    async def _optimize_paths(self, element: SVGElement):
        """Optimize SVG path 'd' attributes by collapsing redundant commands."""
        import re

        if element.tag == "path" and "d" in element.attributes:
            d = element.attributes["d"]
            # Collapse repeated spaces and redundant command separators
            d = re.sub(r"([MmLlHhVvCcSsQqTtAaZz])\s+", r"\1", d)
            d = re.sub(r"\s+", " ", d).strip()
            # Collapse zero-length line segments: L x y followed by L x y → keep one
            d = re.sub(r"(L\s+[^\s]+\s+[^\s]+)\s+\1", r"\1", d, flags=re.IGNORECASE)
            element.attributes["d"] = d

        for child in element.children:
            await self._optimize_paths(child)

    async def _remove_default_attributes(self, element: SVGElement):
        """Remove attributes that have SVG default values."""
        # Per-element SVG defaults (subset of common elements)
        defaults: Dict[str, Dict[str, str]] = {
            "svg": {"version": "1.1", "xmlns": "http://www.w3.org/2000/svg"},
            "rect": {"x": "0", "y": "0", "rx": "0", "ry": "0"},
            "circle": {"cx": "0", "cy": "0", "r": "0"},
            "ellipse": {"cx": "0", "cy": "0", "rx": "0", "ry": "0"},
            "line": {"x1": "0", "y1": "0", "x2": "0", "y2": "0"},
            "path": {"d": ""},
            "text": {"x": "0", "y": "0", "font-size": "16"},
            "g": {"transform": ""},
            "polygon": {},
            "polyline": {},
        }

        tag_defaults = defaults.get(element.tag, {})
        element.attributes = {
            k: v
            for k, v in element.attributes.items()
            if k not in tag_defaults or v != tag_defaults[k]
        }

        for child in element.children:
            await self._remove_default_attributes(child)

    async def _compress_styles(self, element: SVGElement):
        """Compress inline style attributes by removing redundant declarations."""
        if "style" in element.attributes:
            style = element.attributes["style"]
            # Split declarations, dedupe by property (last wins), strip whitespace
            declarations: Dict[str, str] = {}
            for decl in style.split(";"):
                decl = decl.strip()
                if ":" in decl:
                    prop, val = decl.split(":", 1)
                    declarations[prop.strip()] = val.strip()
            # Rebuild compressed style string
            if declarations:
                element.attributes["style"] = ";".join(
                    f"{k}:{v}" for k, v in declarations.items()
                ) + ";"
            else:
                del element.attributes["style"]

        for child in element.children:
            await self._compress_styles(child)

    async def _xml_to_svg_element(self, xml_element, svg_element: SVGElement):
        """Convert an xml.etree.ElementTree element into SVGElement children."""

        if not hasattr(xml_element, "tag"):
            return

        svg_element.tag = xml_element.tag.split("}")[-1]  # strip namespace
        svg_element.attributes = dict(xml_element.attrib)
        svg_element.content = (xml_element.text or "").strip()
        svg_element.children = []

        for child_xml in xml_element:
            child_svg = SVGElement(tag="")
            await self._xml_to_svg_element(child_xml, child_svg)
            svg_element.children.append(child_svg)

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
