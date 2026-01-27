"""
PNG Renderer

High-resolution PNG generation with compression optimization,
batch rendering capabilities, and quality control.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import base64
import io
import logging
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


# Image processing libraries
try:
    from PIL import Image, ImageDraw, ImageEnhance, ImageFont

    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import matplotlib.patches as patches
    import matplotlib.pyplot as plt
    import numpy as np
    from matplotlib.backends.backend_agg import FigureCanvasAgg

    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False

from pydantic import BaseModel, ConfigDict, Field


class PNGQuality(str, Enum):
    """PNG quality levels"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    MAXIMUM = "maximum"


class CompressionLevel(str, Enum):
    """PNG compression levels"""

    NONE = "none"
    FAST = "fast"
    BALANCED = "balanced"
    MAXIMUM = "maximum"


@dataclass
class PNGConfiguration:
    """PNG rendering configuration"""

    width: int = 800
    height: int = 600
    dpi: int = 300  # Resolution

    # Quality settings
    quality: PNGQuality = PNGQuality.HIGH
    compression: CompressionLevel = CompressionLevel.BALANCED

    # Color settings
    color_mode: str = "RGB"  # RGB, RGBA, L (grayscale)
    background_color: Union[str, Tuple[int, int, int]] = (255, 255, 255)

    # Optimization
    optimize: bool = True
    progressive: bool = False

    # Anti-aliasing
    antialias: bool = True
    smooth_scaling: bool = True

    # Output options
    include_metadata: bool = True
    embed_color_profile: bool = False


class PNGRenderer:
    """
    High-resolution PNG rendering engine

    Generates optimized PNG images with compression control,
    batch processing capabilities, and quality optimization.
    """

    def __init__(self):
        # Quality mapping
        self.quality_settings = {
            PNGQuality.LOW: {"dpi": 150, "optimize": False},
            PNGQuality.MEDIUM: {"dpi": 200, "optimize": True},
            PNGQuality.HIGH: {"dpi": 300, "optimize": True},
            PNGQuality.MAXIMUM: {"dpi": 600, "optimize": True},
        }

        # Compression settings
        self.compression_settings = {
            CompressionLevel.NONE: 0,
            CompressionLevel.FAST: 1,
            CompressionLevel.BALANCED: 6,
            CompressionLevel.MAXIMUM: 9,
        }

        self.logger = logging.getLogger("png_renderer")

        if not PIL_AVAILABLE and not MATPLOTLIB_AVAILABLE:
            self.logger.warning(
                "Neither PIL nor Matplotlib available - using mock generation"
            )

    async def render_chart_to_png(
        self, chart_data: Dict[str, Any], config: Optional[PNGConfiguration] = None
    ) -> Dict[str, Any]:
        """
        Render chart data to PNG format

        Args:
                chart_data: Chart data with figure and configuration
                config: PNG-specific configuration

        Returns:
                PNG rendering result
        """
        if not config:
            config = PNGConfiguration()

        try:
            # Apply quality settings
            await self._apply_quality_settings(config)

            # Generate PNG based on available libraries
            if MATPLOTLIB_AVAILABLE and "figure" in chart_data:
                png_data = await self._render_matplotlib_to_png(
                    chart_data["figure"], config
                )
            elif PIL_AVAILABLE:
                png_data = await self._render_with_pil(chart_data, config)
            else:
                png_data = await self._generate_mock_png(chart_data, config)

            # Optimize if requested
            if config.optimize:
                png_data = await self._optimize_png(png_data, config)

            # Generate result
            result = {
                "png_id": uuid7str(),
                "png_data": png_data,
                "base64": base64.b64encode(png_data).decode("utf-8")
                if isinstance(png_data, bytes)
                else None,
                "config": config,
                "metadata": {
                    "width": config.width,
                    "height": config.height,
                    "dpi": config.dpi,
                    "quality": config.quality.value,
                    "compression": config.compression.value,
                    "file_size": len(png_data)
                    if isinstance(png_data, bytes)
                    else len(str(png_data).encode()),
                    "generated_at": datetime.now().isoformat(),
                },
                "success": True,
            }

            self.logger.info(
                f"PNG rendered: {result['metadata']['width']}x{result['metadata']['height']} "
                f"at {config.dpi}dpi, {result['metadata']['file_size']} bytes"
            )

            return result

        except Exception as e:
            self.logger.error(f"PNG rendering failed: {e}")
            return {"png_id": uuid7str(), "error": str(e), "success": False}

    async def render_diagram_to_png(
        self, diagram_data: Dict[str, Any], config: Optional[PNGConfiguration] = None
    ) -> Dict[str, Any]:
        """
        Render diagram data to PNG format

        Args:
                diagram_data: Diagram data with nodes and edges
                config: PNG-specific configuration

        Returns:
                PNG rendering result
        """
        if not config:
            config = PNGConfiguration()

        try:
            await self._apply_quality_settings(config)

            if PIL_AVAILABLE:
                png_data = await self._render_diagram_with_pil(diagram_data, config)
            else:
                png_data = await self._generate_mock_png(diagram_data, config)

            if config.optimize:
                png_data = await self._optimize_png(png_data, config)

            return {
                "png_id": uuid7str(),
                "png_data": png_data,
                "base64": base64.b64encode(png_data).decode("utf-8")
                if isinstance(png_data, bytes)
                else None,
                "success": True,
                "metadata": {
                    "width": config.width,
                    "height": config.height,
                    "dpi": config.dpi,
                    "file_size": len(png_data)
                    if isinstance(png_data, bytes)
                    else len(str(png_data).encode()),
                    "generated_at": datetime.now().isoformat(),
                },
            }

        except Exception as e:
            self.logger.error(f"Diagram PNG rendering failed: {e}")
            return {"png_id": uuid7str(), "error": str(e), "success": False}

    async def batch_render_to_png(
        self, items: List[Dict[str, Any]], config: Optional[PNGConfiguration] = None
    ) -> Dict[str, Any]:
        """
        Batch render multiple items to PNG

        Args:
                items: List of chart/diagram data to render
                config: PNG configuration

        Returns:
                Batch rendering results
        """
        results = []
        total_size = 0

        for i, item in enumerate(items):
            if item.get("type") == "chart":
                result = await self.render_chart_to_png(item, config)
            elif item.get("type") == "diagram":
                result = await self.render_diagram_to_png(item, config)
            else:
                result = {"error": "Unknown item type", "success": False}

            result["batch_index"] = i
            results.append(result)

            if result.get("success") and "metadata" in result:
                total_size += result["metadata"].get("file_size", 0)

        successful_renders = sum(1 for r in results if r.get("success", False))

        return {
            "batch_id": uuid7str(),
            "results": results,
            "total_items": len(items),
            "successful_renders": successful_renders,
            "success_rate": successful_renders / len(items) if items else 0,
            "total_file_size": total_size,
            "generated_at": datetime.now().isoformat(),
        }

    async def optimize_png(
        self,
        png_data: bytes,
        optimization_level: CompressionLevel = CompressionLevel.BALANCED,
    ) -> bytes:
        """
        Optimize existing PNG data

        Args:
                png_data: PNG data to optimize
                optimization_level: Level of compression to apply

        Returns:
                Optimized PNG data
        """
        try:
            if not PIL_AVAILABLE:
                return png_data

            # Load image
            image = Image.open(io.BytesIO(png_data))

            # Optimize
            output = io.BytesIO()
            compression_level = self.compression_settings[optimization_level]

            image.save(
                output, format="PNG", optimize=True, compress_level=compression_level
            )

            optimized_data = output.getvalue()

            self.logger.info(
                f"PNG optimized: {len(png_data)} -> {len(optimized_data)} bytes "
                f"({(1 - len(optimized_data) / len(png_data)) * 100:.1f}% reduction)"
            )

            return optimized_data

        except Exception as e:
            self.logger.error(f"PNG optimization failed: {e}")
            return png_data

    async def resize_png(
        self,
        png_data: bytes,
        target_width: int,
        target_height: int,
        maintain_aspect_ratio: bool = True,
    ) -> bytes:
        """
        Resize PNG image

        Args:
                png_data: Original PNG data
                target_width: Target width
                target_height: Target height
                maintain_aspect_ratio: Whether to maintain aspect ratio

        Returns:
                Resized PNG data
        """
        try:
            if not PIL_AVAILABLE:
                return png_data

            image = Image.open(io.BytesIO(png_data))

            if maintain_aspect_ratio:
                image.thumbnail((target_width, target_height), Image.Resampling.LANCZOS)
            else:
                image = image.resize(
                    (target_width, target_height), Image.Resampling.LANCZOS
                )

            output = io.BytesIO()
            image.save(output, format="PNG")

            return output.getvalue()

        except Exception as e:
            self.logger.error(f"PNG resize failed: {e}")
            return png_data

    async def convert_to_grayscale(self, png_data: bytes) -> bytes:
        """Convert PNG to grayscale"""
        try:
            if not PIL_AVAILABLE:
                return png_data

            image = Image.open(io.BytesIO(png_data))
            grayscale_image = image.convert("L")

            output = io.BytesIO()
            grayscale_image.save(output, format="PNG")

            return output.getvalue()

        except Exception as e:
            self.logger.error(f"Grayscale conversion failed: {e}")
            return png_data

    async def enhance_image(
        self,
        png_data: bytes,
        brightness: float = 1.0,
        contrast: float = 1.0,
        sharpness: float = 1.0,
    ) -> bytes:
        """
        Enhance PNG image quality

        Args:
                png_data: Original PNG data
                brightness: Brightness factor (1.0 = no change)
                contrast: Contrast factor (1.0 = no change)
                sharpness: Sharpness factor (1.0 = no change)

        Returns:
                Enhanced PNG data
        """
        try:
            if not PIL_AVAILABLE:
                return png_data

            image = Image.open(io.BytesIO(png_data))

            # Apply enhancements
            if brightness != 1.0:
                enhancer = ImageEnhance.Brightness(image)
                image = enhancer.enhance(brightness)

            if contrast != 1.0:
                enhancer = ImageEnhance.Contrast(image)
                image = enhancer.enhance(contrast)

            if sharpness != 1.0:
                enhancer = ImageEnhance.Sharpness(image)
                image = enhancer.enhance(sharpness)

            output = io.BytesIO()
            image.save(output, format="PNG")

            return output.getvalue()

        except Exception as e:
            self.logger.error(f"Image enhancement failed: {e}")
            return png_data

    async def _apply_quality_settings(self, config: PNGConfiguration):
        """Apply quality-based settings to configuration"""
        quality_settings = self.quality_settings[config.quality]

        # Update DPI if not explicitly set
        if config.dpi == 300 and config.quality != PNGQuality.HIGH:
            config.dpi = quality_settings["dpi"]

        # Update optimization setting
        config.optimize = quality_settings["optimize"]

    async def _render_matplotlib_to_png(
        self, figure, config: PNGConfiguration
    ) -> bytes:
        """Render Matplotlib figure to PNG"""
        try:
            # Set figure size and DPI
            figure.set_size_inches(
                config.width / config.dpi, config.height / config.dpi
            )
            figure.set_dpi(config.dpi)

            # Render to PNG
            canvas = FigureCanvasAgg(figure)
            buffer = io.BytesIO()

            canvas.print_png(
                buffer, dpi=config.dpi, bbox_inches="tight" if config.optimize else None
            )

            plt.close(figure)

            return buffer.getvalue()

        except Exception as e:
            self.logger.error(f"Matplotlib PNG rendering failed: {e}")
            return await self._generate_mock_png({"figure": figure}, config)

    async def _render_with_pil(
        self, chart_data: Dict[str, Any], config: PNGConfiguration
    ) -> bytes:
        """Render chart data using PIL"""
        if not PIL_AVAILABLE:
            return await self._generate_mock_png(chart_data, config)

        # Create image
        if config.color_mode == "RGBA":
            image = Image.new(
                "RGBA", (config.width, config.height), config.background_color
            )
        else:
            image = Image.new(
                "RGB", (config.width, config.height), config.background_color
            )

        draw = ImageDraw.Draw(image)

        # Draw chart elements (simplified)
        await self._draw_chart_elements(draw, chart_data, config)

        # Save to bytes
        output = io.BytesIO()
        image.save(
            output, format="PNG", optimize=config.optimize, dpi=(config.dpi, config.dpi)
        )

        return output.getvalue()

    async def _render_diagram_with_pil(
        self, diagram_data: Dict[str, Any], config: PNGConfiguration
    ) -> bytes:
        """Render diagram using PIL"""
        if not PIL_AVAILABLE:
            return await self._generate_mock_png(diagram_data, config)

        # Create image
        image = Image.new("RGB", (config.width, config.height), config.background_color)
        draw = ImageDraw.Draw(image)

        # Draw diagram elements
        await self._draw_diagram_elements(draw, diagram_data, config)

        # Save to bytes
        output = io.BytesIO()
        image.save(
            output, format="PNG", optimize=config.optimize, dpi=(config.dpi, config.dpi)
        )

        return output.getvalue()

    async def _draw_chart_elements(
        self, draw, chart_data: Dict[str, Any], config: PNGConfiguration
    ):
        """Draw chart elements using PIL"""
        # Draw title
        title = chart_data.get("title", "Chart")
        try:
            font = ImageFont.truetype("arial.ttf", 16)
        except:
            font = ImageFont.load_default()

        # Get text bounding box for centering
        text_bbox = draw.textbbox((0, 0), title, font=font)
        text_width = text_bbox[2] - text_bbox[0]

        draw.text(
            ((config.width - text_width) // 2, 20), title, fill="black", font=font
        )

        # Draw placeholder chart elements
        chart_area = (50, 60, config.width - 50, config.height - 50)
        draw.rectangle(chart_area, outline="black", width=2)

        # Draw sample bars
        bar_width = 40
        bar_spacing = 60
        max_bar_height = chart_area[3] - chart_area[1] - 40

        for i in range(5):
            x = chart_area[0] + 20 + i * bar_spacing
            height = max_bar_height * (0.3 + i * 0.15)
            y = chart_area[3] - 20 - height

            draw.rectangle(
                (x, y, x + bar_width, chart_area[3] - 20),
                fill=f"rgb({50 + i * 40}, {100 + i * 30}, {150 + i * 20})",
                outline="black",
            )

    async def _draw_diagram_elements(
        self, draw, diagram_data: Dict[str, Any], config: PNGConfiguration
    ):
        """Draw diagram elements using PIL"""
        nodes = diagram_data.get("nodes", [])
        edges = diagram_data.get("edges", [])

        try:
            font = ImageFont.truetype("arial.ttf", 12)
        except:
            font = ImageFont.load_default()

        # Draw edges first
        for edge in edges:
            from_node = next(
                (n for n in nodes if n.get("id") == edge.get("from")), None
            )
            to_node = next((n for n in nodes if n.get("id") == edge.get("to")), None)

            if from_node and to_node:
                from_pos = from_node.get("position", [100, 100])
                to_pos = to_node.get("position", [200, 200])

                draw.line([tuple(from_pos), tuple(to_pos)], fill="black", width=2)

        # Draw nodes
        for node in nodes:
            position = node.get("position", [100, 100])
            size = node.get("size", [80, 40])
            shape = node.get("shape", "rectangle")
            color = node.get("color", "#lightblue")
            label = node.get("label", "")

            # Convert hex color to RGB
            if isinstance(color, str) and color.startswith("#"):
                color = tuple(int(color[i : i + 2], 16) for i in (1, 3, 5))
            elif isinstance(color, str):
                color = "lightblue"  # Default fallback

            if shape == "rectangle":
                bbox = (
                    position[0] - size[0] // 2,
                    position[1] - size[1] // 2,
                    position[0] + size[0] // 2,
                    position[1] + size[1] // 2,
                )
                draw.rectangle(bbox, fill=color, outline="black", width=2)
            elif shape == "circle":
                radius = size[0] // 2
                bbox = (
                    position[0] - radius,
                    position[1] - radius,
                    position[0] + radius,
                    position[1] + radius,
                )
                draw.ellipse(bbox, fill=color, outline="black", width=2)

            # Draw node label
            if label:
                text_bbox = draw.textbbox((0, 0), label, font=font)
                text_width = text_bbox[2] - text_bbox[0]
                text_height = text_bbox[3] - text_bbox[1]

                text_pos = (
                    position[0] - text_width // 2,
                    position[1] - text_height // 2,
                )
                draw.text(text_pos, label, fill="black", font=font)

    async def _optimize_png(self, png_data: bytes, config: PNGConfiguration) -> bytes:
        """Optimize PNG data"""
        if not config.optimize or not PIL_AVAILABLE:
            return png_data

        try:
            image = Image.open(io.BytesIO(png_data))

            # Apply compression
            output = io.BytesIO()
            compression_level = self.compression_settings[config.compression]

            image.save(
                output, format="PNG", optimize=True, compress_level=compression_level
            )

            return output.getvalue()

        except Exception as e:
            self.logger.error(f"PNG optimization failed: {e}")
            return png_data

    async def _generate_mock_png(
        self, data: Dict[str, Any], config: PNGConfiguration
    ) -> str:
        """Generate mock PNG when libraries are not available"""
        return f"Mock PNG data: {config.width}x{config.height} at {config.dpi}dpi"
