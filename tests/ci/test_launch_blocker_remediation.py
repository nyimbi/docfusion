"""Regression coverage for launch-blocker remediation paths."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from docfusion.intelligence.predictors.win_probability_predictor import (
	WinProbabilityPredictor,
)
from docfusion.visualization.generators import chart_generator as chart_module
from docfusion.visualization.generators import diagram_generator as diagram_module
from docfusion.visualization.generators.chart_generator import (
	ChartConfiguration,
	ChartData,
	ChartGenerator,
	ChartType,
)
from docfusion.visualization.generators.diagram_generator import (
	DiagramConfiguration,
	DiagramData,
	DiagramGenerator,
	DiagramNode,
	DiagramType,
)
from docfusion.visualization.renderers import png_renderer as png_module
from docfusion.visualization.renderers.png_renderer import PNGRenderer
from docfusion.visualization.renderers.svg_renderer import SVGRenderer


@pytest.mark.asyncio
async def test_chart_generator_fails_instead_of_mocking_missing_plotly(monkeypatch):
	monkeypatch.setattr(chart_module, "PLOTLY_AVAILABLE", False)

	result = await ChartGenerator().generate_chart(
		ChartData(data={"label": ["A", "B"], "value": [3, 5]}),
		ChartConfiguration(chart_type=ChartType.BAR),
	)

	assert result["success"] is False
	assert "plotly" in result["error"].lower()
	assert "mock" not in str(result).lower()


@pytest.mark.asyncio
async def test_diagram_generator_fails_instead_of_mocking_missing_renderers(monkeypatch):
	monkeypatch.setattr(diagram_module, "GRAPHVIZ_AVAILABLE", False)
	monkeypatch.setattr(diagram_module, "MATPLOTLIB_AVAILABLE", False)

	result = await DiagramGenerator().generate_diagram(
		DiagramData(
			title="Launch Flow",
			nodes=[DiagramNode(node_id="start", label="Start")],
		),
		DiagramConfiguration(diagram_type=DiagramType.FLOWCHART),
	)

	assert result["success"] is False
	assert "requires" in result["error"].lower()
	assert "mock" not in str(result).lower()


@pytest.mark.asyncio
async def test_png_renderer_fails_instead_of_returning_mock_png(monkeypatch):
	monkeypatch.setattr(png_module, "PIL_AVAILABLE", False)
	monkeypatch.setattr(png_module, "MATPLOTLIB_AVAILABLE", False)

	result = await PNGRenderer().render_chart_to_png(
		{"data": {"label": ["A", "B"], "value": [3, 5]}, "title": "Revenue"}
	)

	assert result["success"] is False
	assert "requires" in result["error"].lower()
	assert "mock png" not in str(result).lower()


@pytest.mark.asyncio
async def test_svg_renderer_converts_plotly_traces_without_placeholder():
	class FakePlotlyFigure:
		def to_dict(self):
			return {
				"data": [
					{
						"type": "bar",
						"x": ["A", "B"],
						"y": [3, 5],
						"marker": {"color": "#123456"},
					}
				],
				"layout": {"title": {"text": "Revenue"}},
			}

	result = await SVGRenderer().render_chart_to_svg(
		{"figure": FakePlotlyFigure(), "title": "Revenue"}
	)

	assert result["success"] is True
	assert "<rect" in result["svg_content"]
	assert "#123456" in result["svg_content"]
	assert "Plotly Chart (SVG Conversion)" not in result["svg_content"]
	assert "placeholder" not in result["svg_content"].lower()


@pytest.mark.asyncio
async def test_svg_renderer_handles_real_plotly_trace_arrays_without_placeholder():
	chart = await ChartGenerator().generate_chart(
		ChartData(data={"label": ["A", "B"], "value": [3, 5]}, title="Revenue"),
		ChartConfiguration(chart_type=ChartType.BAR, title="Revenue"),
	)

	result = await SVGRenderer().render_chart_to_svg(chart)

	assert result["success"] is True
	assert "<rect" in result["svg_content"]
	assert "Plotly Chart (SVG Conversion)" not in result["svg_content"]
	assert "placeholder" not in result["svg_content"].lower()


def test_win_probability_integration_uses_section_scores_not_coin_flip():
	section_type = SimpleNamespace(value="technical_approach")
	scoring_predictor = SimpleNamespace(
		prediction_history=[
			SimpleNamespace(section_type=section_type, predicted_score=92.0),
			SimpleNamespace(
				section_type=SimpleNamespace(value="management_approach"),
				predicted_score=86.0,
			),
		],
		is_trained={},
	)

	result = WinProbabilityPredictor().integrate_with_scoring_predictor(
		scoring_predictor=scoring_predictor,
		requirements=[],
		opportunity_id="opp-launch",
		opportunity_features={
			"opportunity_value": 1_000_000.0,
			"competitive_intensity": 0.2,
			"resource_availability": 0.9,
			"pricing_competitiveness": 0.8,
		},
	)

	assert result["section_scores"]["technical_approach"] == 92.0
	assert result["combined_score"] > 85.0
	assert result["win_probability"] != 0.5
	assert result["model_used"] == "scoring_integrated_heuristic"
	assert result["integrated_prediction"] is True
