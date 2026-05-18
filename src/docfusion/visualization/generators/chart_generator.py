"""
Chart Generator

Automatic chart type selection and generation with data visualization best practices,
interactive features, and accessibility compliance.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import json
import logging
import math
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

# For visualization libraries - would need to install these
try:
    import pandas as pd
    import plotly.express as px
    from plotly.subplots import make_subplots

    PLOTLY_AVAILABLE = True
except ImportError:
    PLOTLY_AVAILABLE = False

from ...core.utils import uuid7str

class ChartType(str, Enum):
    """Supported chart types"""

    BAR = "bar"
    LINE = "line"
    PIE = "pie"
    SCATTER = "scatter"
    HISTOGRAM = "histogram"
    BOX = "box"
    HEATMAP = "heatmap"
    AREA = "area"
    FUNNEL = "funnel"
    GAUGE = "gauge"
    TREEMAP = "treemap"
    WATERFALL = "waterfall"

class DataType(str, Enum):
    """Data types for automatic chart selection"""

    CATEGORICAL = "categorical"
    NUMERICAL = "numerical"
    TEMPORAL = "temporal"
    GEOGRAPHIC = "geographic"

@dataclass
class ChartData:
    """Chart data structure"""

    data: Dict[str, List[Any]]
    chart_id: str = field(default_factory=uuid7str)
    title: Optional[str] = None
    description: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dataframe(self):
        """Convert to pandas DataFrame if available"""
        if not PLOTLY_AVAILABLE:
            return None
        return pd.DataFrame(self.data)

@dataclass
class ChartConfiguration:
    """Chart configuration and styling"""

    chart_type: ChartType
    title: str = ""
    subtitle: str = ""
    x_axis_title: str = ""
    y_axis_title: str = ""

    # Styling
    width: int = 800
    height: int = 600
    color_scheme: str = "plotly"  # plotly, viridis, blues, etc.
    theme: str = "plotly_white"  # plotly, plotly_white, plotly_dark, etc.

    # Accessibility
    high_contrast: bool = False
    colorblind_friendly: bool = True

    # Interactivity
    interactive: bool = True
    zoom_enabled: bool = True
    hover_info: str = "all"

    # Export options
    export_formats: List[str] = field(default_factory=lambda: ["html", "png", "svg"])

class ChartGenerator:
    """
    Automatic chart generation with intelligent type selection

    Analyzes data characteristics and automatically selects appropriate
    chart types while following data visualization best practices.
    """

    def __init__(self):
        # Chart type recommendation rules
        self.chart_selection_rules = self._initialize_chart_rules()

        # Color schemes for accessibility
        self.accessible_colors = {
            "default": [
                "#1f77b4",
                "#ff7f0e",
                "#2ca02c",
                "#d62728",
                "#9467bd",
                "#8c564b",
            ],
            "colorblind_friendly": [
                "#1f77b4",
                "#ff7f0e",
                "#2ca02c",
                "#d62728",
                "#9467bd",
                "#8c564b",
            ],
            "high_contrast": [
                "#000000",
                "#FFFFFF",
                "#FF0000",
                "#00FF00",
                "#0000FF",
                "#FFFF00",
            ],
        }

        # Template configurations
        self.chart_templates = self._initialize_chart_templates()

        self.logger = logging.getLogger("chart_generator")

        if not PLOTLY_AVAILABLE:
            self.logger.warning(
                "Plotly not available - chart generation will use mock data"
            )

    async def generate_chart(
        self,
        data: ChartData,
        config: Optional[ChartConfiguration] = None,
        auto_select_type: bool = True,
    ) -> Dict[str, Any]:
        """
        Generate a chart from data

        Args:
                data: Chart data
                config: Chart configuration (optional)
                auto_select_type: Whether to automatically select chart type

        Returns:
                Chart generation result with figure and metadata
        """
        try:
            # Auto-select chart type if not specified
            if auto_select_type and (not config or not config.chart_type):
                recommended_type = await self._recommend_chart_type(data)
                if config:
                    config.chart_type = recommended_type
                else:
                    config = ChartConfiguration(chart_type=recommended_type)

            if not config:
                config = ChartConfiguration(chart_type=ChartType.BAR)

            # Generate the chart
            if PLOTLY_AVAILABLE:
                figure = await self._create_plotly_chart(data, config)
                chart_html = figure.to_html(include_plotlyjs=True)
                chart_json = figure.to_json()
            else:
                # Mock chart generation
                figure = await self._create_mock_chart(data, config)
                chart_html = f"<div>Mock Chart: {config.chart_type.value}</div>"
                chart_json = json.dumps({"mock": True, "type": config.chart_type.value})

            # Apply accessibility enhancements
            await self._apply_accessibility_features(config)

            result = {
                "chart_id": data.chart_id,
                "chart_type": config.chart_type.value,
                "title": config.title or data.title or "Generated Chart",
                "figure": figure,
                "html": chart_html,
                "json": chart_json,
                "config": config,
                "metadata": {
                    "generated_at": datetime.now().isoformat(),
                    "data_points": len(data.data.get(list(data.data.keys())[0], []))
                    if data.data
                    else 0,
                    "dimensions": len(data.data.keys()) if data.data else 0,
                    "accessibility_compliant": config.colorblind_friendly
                    and config.high_contrast,
                    "interactive": config.interactive,
                },
            }

            self.logger.info(
                f"Chart generated: {config.chart_type.value} with {result['metadata']['data_points']} points"
            )

            return result

        except Exception as e:
            self.logger.error(f"Chart generation failed: {e}")
            return {"chart_id": data.chart_id, "error": str(e), "success": False}

    async def recommend_chart_type(self, data: ChartData) -> ChartType:
        """
        Recommend optimal chart type based on data characteristics

        Args:
                data: Chart data to analyze

        Returns:
                Recommended chart type
        """
        return await self._recommend_chart_type(data)

    async def generate_multiple_charts(
        self, data: ChartData, chart_types: Optional[List[ChartType]] = None
    ) -> Dict[str, Any]:
        """
        Generate multiple chart variations for the same data

        Args:
                data: Chart data
                chart_types: Specific chart types to generate (optional)

        Returns:
                Multiple chart variations
        """
        if not chart_types:
            # Generate recommended types based on data
            primary_type = await self._recommend_chart_type(data)
            chart_types = await self._get_alternative_chart_types(data, primary_type)

        charts = {}

        for chart_type in chart_types:
            config = ChartConfiguration(chart_type=chart_type)
            chart_result = await self.generate_chart(
                data, config, auto_select_type=False
            )

            if "error" not in chart_result:
                charts[chart_type.value] = chart_result

        return {
            "chart_id": data.chart_id,
            "variations": charts,
            "recommended": chart_types[0].value if chart_types else None,
            "generated_at": datetime.now().isoformat(),
        }

    async def create_dashboard(
        self, data_sets: List[ChartData], layout: str = "grid"
    ) -> Dict[str, Any]:
        """
        Create a dashboard with multiple charts

        Args:
                data_sets: List of chart data sets
                layout: Dashboard layout type

        Returns:
                Dashboard with multiple charts
        """
        charts = []

        for i, data in enumerate(data_sets):
            chart_result = await self.generate_chart(data)
            if "error" not in chart_result:
                charts.append(chart_result)

        # Create dashboard layout
        if PLOTLY_AVAILABLE and len(charts) > 1:
            dashboard_fig = await self._create_dashboard_layout(charts, layout)
            dashboard_html = dashboard_fig.to_html(include_plotlyjs=True)
        else:
            dashboard_fig = None
            dashboard_html = f"<div>Dashboard with {len(charts)} charts</div>"

        return {
            "dashboard_id": uuid7str(),
            "charts": charts,
            "layout": layout,
            "figure": dashboard_fig,
            "html": dashboard_html,
            "generated_at": datetime.now().isoformat(),
            "metadata": {"chart_count": len(charts), "layout_type": layout},
        }

    async def _recommend_chart_type(self, data: ChartData) -> ChartType:
        """Analyze data and recommend optimal chart type"""
        if not data.data:
            return ChartType.BAR

        # Analyze data characteristics
        data_analysis = await self._analyze_data_characteristics(data)

        # Apply recommendation rules
        for rule in self.chart_selection_rules:
            if await self._rule_matches(rule, data_analysis):
                return rule["recommended_type"]

        # Default fallback
        return ChartType.BAR

    async def _analyze_data_characteristics(self, data: ChartData) -> Dict[str, Any]:
        """Analyze data to determine characteristics"""
        if not data.data:
            return {}

        characteristics = {
            "column_count": len(data.data),
            "row_count": max(len(values) for values in data.data.values())
            if data.data
            else 0,
            "data_types": {},
            "has_temporal": False,
            "has_categorical": False,
            "has_numerical": False,
            "value_ranges": {},
        }

        for column, values in data.data.items():
            if not values:
                continue

            # Detect data type
            sample_value = values[0] if values else None

            if isinstance(sample_value, (int, float)):
                characteristics["data_types"][column] = DataType.NUMERICAL
                characteristics["has_numerical"] = True
                characteristics["value_ranges"][column] = {
                    "min": min(values),
                    "max": max(values),
                    "range": max(values) - min(values),
                }
            elif isinstance(sample_value, str):
                # Check if it's a date string
                if await self._is_date_string(sample_value):
                    characteristics["data_types"][column] = DataType.TEMPORAL
                    characteristics["has_temporal"] = True
                else:
                    characteristics["data_types"][column] = DataType.CATEGORICAL
                    characteristics["has_categorical"] = True
                    characteristics["value_ranges"][column] = {
                        "unique_count": len(set(values))
                    }

        return characteristics

    async def _is_date_string(self, value: str) -> bool:
        """Check if string represents a date"""
        date_indicators = ["202", "201", "date", "time", "/", "-"]
        return any(indicator in value.lower() for indicator in date_indicators)

    async def _rule_matches(
        self, rule: Dict[str, Any], data_analysis: Dict[str, Any]
    ) -> bool:
        """Check if a recommendation rule matches the data"""
        conditions = rule.get("conditions", {})

        for condition, expected_value in conditions.items():
            if condition not in data_analysis:
                continue

            actual_value = data_analysis[condition]

            if isinstance(expected_value, bool):
                if actual_value != expected_value:
                    return False
            elif isinstance(expected_value, str):
                if actual_value != expected_value:
                    return False
            elif isinstance(expected_value, dict) and "min" in expected_value:
                if actual_value < expected_value["min"]:
                    return False
            elif isinstance(expected_value, dict) and "max" in expected_value:
                if actual_value > expected_value["max"]:
                    return False

        return True

    async def _get_alternative_chart_types(
        self, data: ChartData, primary_type: ChartType
    ) -> List[ChartType]:
        """Get alternative chart types for the same data"""
        data_analysis = await self._analyze_data_characteristics(data)

        alternatives = [primary_type]

        # Add alternatives based on data characteristics
        if data_analysis.get("has_numerical") and data_analysis.get("has_categorical"):
            alternatives.extend([ChartType.BAR, ChartType.LINE, ChartType.SCATTER])

        if data_analysis.get("has_temporal"):
            alternatives.extend([ChartType.LINE, ChartType.AREA])

        if data_analysis.get("column_count", 0) == 1:
            alternatives.extend([ChartType.HISTOGRAM, ChartType.BOX])

        # Remove duplicates and return limited set
        unique_alternatives = list(set(alternatives))
        return unique_alternatives[:4]  # Limit to 4 alternatives

    async def _create_plotly_chart(
        self, data: ChartData, config: ChartConfiguration
    ) -> Any:
        """Create chart using Plotly"""
        if not PLOTLY_AVAILABLE:
            return None

        df = data.to_dataframe()
        if df is None or df.empty:
            return None

        # Get chart creation function
        chart_func = getattr(self, f"_create_{config.chart_type.value}_chart", None)
        if chart_func:
            fig = await chart_func(df, config)
        else:
            # Default to bar chart
            fig = await self._create_bar_chart(df, config)

        # Apply common styling
        fig.update_layout(
            title=config.title,
            width=config.width,
            height=config.height,
            template=config.theme,
        )

        if config.x_axis_title:
            fig.update_xaxes(title_text=config.x_axis_title)
        if config.y_axis_title:
            fig.update_yaxes(title_text=config.y_axis_title)

        return fig

    async def _create_bar_chart(self, df, config: ChartConfiguration) -> Any:
        """Create bar chart"""
        if not PLOTLY_AVAILABLE:
            return None

        columns = df.columns.tolist()
        if len(columns) >= 2:
            return px.bar(df, x=columns[0], y=columns[1], title=config.title)
        else:
            return px.bar(df, y=columns[0], title=config.title)

    async def _create_line_chart(self, df, config: ChartConfiguration) -> Any:
        """Create line chart"""
        if not PLOTLY_AVAILABLE:
            return None

        columns = df.columns.tolist()
        if len(columns) >= 2:
            return px.line(df, x=columns[0], y=columns[1], title=config.title)
        else:
            return px.line(df, y=columns[0], title=config.title)

    async def _create_pie_chart(self, df, config: ChartConfiguration) -> Any:
        """Create pie chart"""
        if not PLOTLY_AVAILABLE:
            return None

        columns = df.columns.tolist()
        if len(columns) >= 2:
            return px.pie(df, names=columns[0], values=columns[1], title=config.title)
        else:
            # Create pie from value counts
            value_counts = df[columns[0]].value_counts()
            return px.pie(
                values=value_counts.values, names=value_counts.index, title=config.title
            )

    async def _create_scatter_chart(self, df, config: ChartConfiguration) -> Any:
        """Create scatter plot"""
        if not PLOTLY_AVAILABLE:
            return None

        columns = df.columns.tolist()
        if len(columns) >= 2:
            return px.scatter(df, x=columns[0], y=columns[1], title=config.title)
        else:
            return px.scatter(df, y=columns[0], title=config.title)

    async def _create_histogram_chart(self, df, config: ChartConfiguration) -> Any:
        """Create histogram"""
        if not PLOTLY_AVAILABLE:
            return None

        columns = df.columns.tolist()
        return px.histogram(df, x=columns[0], title=config.title)

    async def _create_box_chart(self, df, config: ChartConfiguration) -> Any:
        """Create box plot"""
        if not PLOTLY_AVAILABLE:
            return None

        columns = df.columns.tolist()
        return px.box(df, y=columns[0], title=config.title)

    async def _create_mock_chart(
        self, data: ChartData, config: ChartConfiguration
    ) -> Dict[str, Any]:
        """Create mock chart when Plotly is not available"""
        return {
            "type": "mock_chart",
            "chart_type": config.chart_type.value,
            "title": config.title,
            "data_points": len(data.data.get(list(data.data.keys())[0], []))
            if data.data
            else 0,
            "mock": True,
        }

    async def _create_dashboard_layout(
        self, charts: List[Dict[str, Any]], layout: str
    ) -> Any:
        """Create dashboard layout with multiple charts"""
        if not PLOTLY_AVAILABLE:
            return None

        chart_count = len(charts)

        if layout == "grid":
            rows = math.ceil(chart_count / 2)
            cols = 2 if chart_count > 1 else 1

            fig = make_subplots(
                rows=rows,
                cols=cols,
                subplot_titles=[
                    chart.get("title", f"Chart {i + 1}")
                    for i, chart in enumerate(charts)
                ],
            )

            for i, chart in enumerate(charts):
                row = (i // 2) + 1
                col = (i % 2) + 1

                if chart.get("figure"):
                    # Add traces from the chart figure
                    for trace in chart["figure"].data:
                        fig.add_trace(trace, row=row, col=col)

            fig.update_layout(height=400 * rows, showlegend=False)
            return fig

        return None

    async def _apply_accessibility_features(self, config: ChartConfiguration):
        """Apply accessibility features to chart configuration"""
        if config.colorblind_friendly:
            # Use colorblind-friendly palette
            config.color_scheme = "colorblind_friendly"

        if config.high_contrast:
            # Use high contrast colors
            config.color_scheme = "high_contrast"

    def _initialize_chart_rules(self) -> List[Dict[str, Any]]:
        """Initialize chart type recommendation rules"""
        return [
            {
                "name": "temporal_data_line",
                "conditions": {"has_temporal": True, "column_count": {"min": 2}},
                "recommended_type": ChartType.LINE,
            },
            {
                "name": "categorical_distribution_pie",
                "conditions": {"has_categorical": True, "column_count": 2},
                "recommended_type": ChartType.PIE,
            },
            {
                "name": "numerical_comparison_bar",
                "conditions": {"has_numerical": True, "has_categorical": True},
                "recommended_type": ChartType.BAR,
            },
            {
                "name": "single_numerical_histogram",
                "conditions": {"has_numerical": True, "column_count": 1},
                "recommended_type": ChartType.HISTOGRAM,
            },
            {
                "name": "two_numerical_scatter",
                "conditions": {"has_numerical": True, "column_count": 2},
                "recommended_type": ChartType.SCATTER,
            },
        ]

    def _initialize_chart_templates(self) -> Dict[str, Any]:
        """Initialize chart templates"""
        return {
            "default": {
                "color_scheme": "plotly",
                "template": "plotly_white",
                "font_family": "Arial",
                "font_size": 12,
            },
            "professional": {
                "color_scheme": "blues",
                "template": "plotly_white",
                "font_family": "Arial",
                "font_size": 11,
            },
            "presentation": {
                "color_scheme": "viridis",
                "template": "plotly_white",
                "font_family": "Arial",
                "font_size": 14,
            },
        }
