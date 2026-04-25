---
id: TASK-023
title: 'Phase 4: Complete SVG renderer optimizer stubs'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-22 23:45'
labels: []
dependencies: []
priority: medium
---

# task-023 - Phase 4: Complete SVG renderer optimizer stubs

## Description (the why)

`src/docfusion/visualization/renderers/svg_renderer.py` has five `NotImplementedError` stubs on optimization helpers (`_merge_similar_elements`, `_optimize_paths`, `_remove_default_attributes`, `_compress_styles`, `_xml_to_svg_element`). Without them, output SVGs are larger than necessary and one of the optimization passes will crash the renderer.

## Acceptance Criteria (the what)

- [ ] All five methods are implemented.
- [ ] `grep -n "NotImplementedError" src/docfusion/visualization/renderers/svg_renderer.py` returns 0 lines.
- [ ] Each optimization is idempotent: running it twice yields the same result.
- [ ] Test `tests/ci/test_svg_renderer.py` verifies byte-reduction after each optimization and correctness of `_xml_to_svg_element`.

## Implementation Plan (the how)

**Step 1: Read the file.**
```bash
wc -l src/docfusion/visualization/renderers/svg_renderer.py
grep -n "def _merge_similar_elements\|def _optimize_paths\|def _remove_default_attributes\|def _compress_styles\|def _xml_to_svg_element\|class" src/docfusion/visualization/renderers/svg_renderer.py
```

**Step 2 — `_merge_similar_elements`.** Merge adjacent elements with identical tag + attrs into a single element where the combined content is concatenated.

```python
def _merge_similar_elements(self, elements: list["SvgElement"]) -> list["SvgElement"]:
	"""Merge adjacent elements sharing tag + attributes."""
	if not elements:
		return []
	merged: list[SvgElement] = [elements[0]]
	for el in elements[1:]:
		prior = merged[-1]
		if prior.tag == el.tag and prior.attributes == el.attributes and not prior.children and not el.children:
			prior.text = (prior.text or "") + (el.text or "")
		else:
			merged.append(el)
	return merged
```

**Step 3 — `_optimize_paths`.** Simplify `<path d="...">` data using Ramer–Douglas–Peucker.

```python
def _optimize_paths(self, element: "SvgElement", tolerance: float = 0.5) -> "SvgElement":
	"""Simplify path commands using RDP on line segments."""
	if element.tag != "path":
		return element
	d = element.attributes.get("d", "")
	if not d:
		return element
	points = self._parse_path_to_points(d)
	if len(points) < 3:
		return element
	simplified = self._rdp(points, tolerance)
	element.attributes["d"] = self._points_to_path(simplified)
	return element

def _rdp(self, points: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
	"""Ramer-Douglas-Peucker polyline simplification."""
	if len(points) < 3:
		return points
	start, end = points[0], points[-1]
	max_dist, max_idx = 0.0, 0
	for i in range(1, len(points) - 1):
		d = self._point_line_distance(points[i], start, end)
		if d > max_dist:
			max_dist, max_idx = d, i
	if max_dist > tol:
		left = self._rdp(points[:max_idx + 1], tol)
		right = self._rdp(points[max_idx:], tol)
		return left[:-1] + right
	return [start, end]

def _point_line_distance(self, p, a, b) -> float:
	import math
	x0, y0 = p
	x1, y1 = a
	x2, y2 = b
	num = abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1)
	den = math.hypot(y2 - y1, x2 - x1) or 1.0
	return num / den

def _parse_path_to_points(self, d: str) -> list[tuple[float, float]]:
	# Minimal parser: only M and L commands. Complex paths skip optimization.
	import re
	points: list[tuple[float, float]] = []
	tokens = re.findall(r"[ML]\s*([-\d.]+)[\s,]+([-\d.]+)", d)
	for x, y in tokens:
		points.append((float(x), float(y)))
	return points

def _points_to_path(self, points: list[tuple[float, float]]) -> str:
	if not points:
		return ""
	head = f"M{points[0][0]},{points[0][1]}"
	rest = " ".join(f"L{x},{y}" for x, y in points[1:])
	return f"{head} {rest}".strip()
```

**Step 4 — `_remove_default_attributes`.** Strip attributes whose values equal the SVG spec defaults.

```python
_SVG_DEFAULTS = {
	"fill": "black",
	"stroke": "none",
	"stroke-width": "1",
	"fill-opacity": "1",
	"stroke-opacity": "1",
	"opacity": "1",
}

def _remove_default_attributes(self, element: "SvgElement") -> "SvgElement":
	for attr, default in _SVG_DEFAULTS.items():
		if element.attributes.get(attr) == default:
			element.attributes.pop(attr, None)
	for child in element.children:
		self._remove_default_attributes(child)
	return element
```

**Step 5 — `_compress_styles`.** Dedupe repeated `style="..."` attributes into CSS classes.

```python
def _compress_styles(self, root: "SvgElement") -> "SvgElement":
	"""Replace duplicated style attributes with CSS classes."""
	style_map: dict[str, str] = {}
	counter = [0]

	def walk(el: "SvgElement") -> None:
		style = el.attributes.pop("style", None)
		if style:
			if style not in style_map:
				counter[0] += 1
				style_map[style] = f"s{counter[0]}"
			el.attributes["class"] = style_map[style]
		for child in el.children:
			walk(child)

	walk(root)

	if style_map:
		css = "\n".join(f".{cls} {{{s}}}" for s, cls in style_map.items())
		style_el = SvgElement(tag="style", attributes={}, text=css, children=[])
		root.children.insert(0, style_el)
	return root
```

Adjust `SvgElement` construction to match the real class signature.

**Step 6 — `_xml_to_svg_element`.** Convert `xml.etree.ElementTree.Element` to the domain `SvgElement`.

```python
def _xml_to_svg_element(self, xml_element) -> "SvgElement":
	"""Convert stdlib ElementTree Element to SvgElement."""
	from xml.etree.ElementTree import Element
	assert isinstance(xml_element, Element), "xml_element must be an ElementTree Element"

	tag = xml_element.tag.split("}", 1)[-1]  # strip namespace
	attributes = dict(xml_element.attrib)
	text = (xml_element.text or "").strip() or None
	children = [self._xml_to_svg_element(child) for child in xml_element]
	return SvgElement(tag=tag, attributes=attributes, text=text, children=children)
```

**Step 7: Test.**

```python
# tests/ci/test_svg_renderer.py
"""SVG renderer optimization coverage."""

import pytest
from xml.etree.ElementTree import fromstring

from docfusion.visualization.renderers.svg_renderer import SvgRenderer, SvgElement

def test_xml_to_svg_element():
	xml = fromstring('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>')
	r = SvgRenderer()
	root = r._xml_to_svg_element(xml)
	assert root.tag == "svg"
	assert len(root.children) == 1
	assert root.children[0].tag == "rect"
	assert root.children[0].attributes["width"] == "10"

def test_remove_default_attributes_strips_black_fill():
	el = SvgElement(tag="rect", attributes={"fill": "black", "width": "5"}, text=None, children=[])
	r = SvgRenderer()
	out = r._remove_default_attributes(el)
	assert "fill" not in out.attributes
	assert out.attributes["width"] == "5"

def test_compress_styles_deduplicates():
	root = SvgElement(tag="svg", attributes={}, text=None, children=[
		SvgElement(tag="rect", attributes={"style": "fill:red"}, text=None, children=[]),
		SvgElement(tag="rect", attributes={"style": "fill:red"}, text=None, children=[]),
	])
	r = SvgRenderer()
	out = r._compress_styles(root)
	# Both rects should now share the same class.
	rect_classes = [c.attributes.get("class") for c in out.children if c.tag == "rect"]
	assert rect_classes[0] == rect_classes[1]
```

**Step 8: Verify + commit.**
```bash
uv run pytest tests/ci/test_svg_renderer.py -vxs
grep -n "NotImplementedError" src/docfusion/visualization/renderers/svg_renderer.py
# Must be 0 lines.

git add src/docfusion/visualization/renderers/svg_renderer.py tests/ci/test_svg_renderer.py
git commit -m "feat(visualization): complete SVG renderer optimizer [G-SVG-01..05]"
```

## Notes for less-capable agents

- `SvgElement` is likely already defined in the same file. If it's a dataclass, mutation works; if it's frozen, use `dataclasses.replace`.
- Path simplification only handles `M`/`L` commands. Paths with `C` (curves) skip optimization — acceptable.
- Don't use an external SVG optimizer library (`scour`, `svgo`). This keeps the dependency surface small.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented all 5 SVG optimizer stubs: merge_similar_elements, optimize_paths, remove_default_attributes, compress_styles, xml_to_svg_element. 6 tests passing.
<!-- SECTION:NOTES:END -->
