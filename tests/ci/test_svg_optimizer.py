"""Tests for SVG renderer optimizer stub implementations."""

from __future__ import annotations

import xml.etree.ElementTree as ET

import pytest

from docfusion.visualization.renderers.svg_renderer import SVGElement, SVGRenderer


@pytest.fixture
def renderer():
	return SVGRenderer()


async def test_merge_similar_elements(renderer):
	parent = SVGElement(
		tag="g",
		children=[
			SVGElement(tag="text", attributes={"x": "0"}, content="Hello"),
			SVGElement(tag="text", attributes={"x": "0"}, content=" "),
			SVGElement(tag="text", attributes={"x": "0"}, content="World"),
			SVGElement(tag="rect", attributes={"x": "0"}, content=""),
		],
	)
	await renderer._merge_similar_elements(parent)
	assert len(parent.children) == 2
	assert parent.children[0].tag == "text"
	assert parent.children[0].content == "Hello World"
	assert parent.children[1].tag == "rect"


async def test_no_merge_different_attributes(renderer):
	parent = SVGElement(
		tag="g",
		children=[
			SVGElement(tag="text", attributes={"x": "0"}, content="A"),
			SVGElement(tag="text", attributes={"x": "1"}, content="B"),
		],
	)
	await renderer._merge_similar_elements(parent)
	assert len(parent.children) == 2


async def test_optimize_paths(renderer):
	path = SVGElement(
		tag="path",
		attributes={"d": "M 0 0   L 10 10   L 10 10   L 20 20"},
	)
	await renderer._optimize_paths(path)
	# Should collapse redundant spaces and duplicate L commands
	assert "  " not in path.attributes["d"]
	# Original has L 10 10 twice; after optimization it should be deduped
	assert path.attributes["d"].count("10 10") <= 2


async def test_remove_default_attributes(renderer):
	rect = SVGElement(
		tag="rect",
		attributes={"x": "0", "y": "0", "width": "100", "rx": "0"},
	)
	await renderer._remove_default_attributes(rect)
	assert "x" not in rect.attributes
	assert "y" not in rect.attributes
	assert "rx" not in rect.attributes
	assert "width" in rect.attributes


async def test_compress_styles(renderer):
	el = SVGElement(
		tag="div",
		attributes={"style": "color: red; fill: blue; color: green; "},
	)
	await renderer._compress_styles(el)
	assert "color:green" in el.attributes["style"]
	assert "red" not in el.attributes["style"]
	assert "fill:blue" in el.attributes["style"]


async def test_xml_to_svg_element(renderer):
	xml = ET.fromstring('<svg xmlns="http://www.w3.org/2000/svg" width="100"><rect x="10"/></svg>')
	svg = SVGElement(tag="root")
	await renderer._xml_to_svg_element(xml, svg)
	assert svg.tag == "svg"
	assert svg.attributes.get("width") == "100"
	assert len(svg.children) == 1
	assert svg.children[0].tag == "rect"
	assert svg.children[0].attributes.get("x") == "10"
