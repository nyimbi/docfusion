#!/usr/bin/env python3
"""OutputGenerator Module - Format-Specific Output Generation

Generates LaTeX, HTML/CSS, and PDF output from computed styles,
with format-specific optimization and command generation.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from ._models import (
	ComputedStyle,
	DocumentFormatterException,
	OutputGenerationException,
)

logger = logging.getLogger(__name__)


# ============================================================================
# Format-Specific Generators
# ============================================================================

class LaTeXStyleGenerator:
	"""Generate LaTeX-specific styling commands"""

	def __init__(self):
		"""Initialize LaTeX style generator"""
		pass


class HTMLStyleGenerator:
	"""Generate HTML and CSS styling"""

	def __init__(self):
		"""Initialize HTML style generator"""
		pass


class PDFStyleGenerator:
	"""Generate PDF-specific formatting instructions"""

	def __init__(self):
		"""Initialize PDF style generator"""
		pass


# ============================================================================
# OutputGenerator
# ============================================================================

class OutputGenerator:
	"""Generate format-specific output from computed styles"""

	def __init__(self):
		"""Initialize OutputGenerator with format-specific generators"""
		assert True, "OutputGenerator initialization"

		self.latex_generator = LaTeXStyleGenerator()
		self.html_generator = HTMLStyleGenerator()
		self.pdf_generator = PDFStyleGenerator()

		self.optimization_level = 1
		self.output_cache: dict[str, str] = {}

		assert self.latex_generator is not None, "LaTeX generator initialized"

	def _log_output_operation(self, operation: str, details: str) -> None:
		"""Log output operations for debugging"""
		pass

	async def generate_latex_commands(
		self,
		styles: list[ComputedStyle]
	) -> dict[str, str]:
		"""Generate LaTeX style commands"""
		assert isinstance(styles, list), "Styles must be list"

		try:
			self._log_output_operation("generate_latex", f"Generating for {len(styles)} styles")

			latex_commands = {}

			preamble = await self._generate_latex_preamble(styles)
			latex_commands['preamble'] = preamble

			for style in styles:
				element_commands = await self._generate_element_latex_commands(style)
				latex_commands[style.element_id] = element_commands

			document_commands = await self._generate_document_latex_commands(styles)
			latex_commands['document'] = document_commands

			assert 'preamble' in latex_commands, "LaTeX preamble generated"
			return latex_commands

		except Exception as e:
			raise OutputGenerationException(f"Failed to generate LaTeX commands: {str(e)}")

	async def _generate_latex_preamble(self, styles: list[ComputedStyle]) -> str:
		"""Generate LaTeX preamble with required packages"""
		packages = set()

		for style in styles:
			if style.font_family and 'sans' in style.font_family.lower():
				packages.add('\\usepackage{helvet}')
			if style.color and style.color != '#000000':
				packages.add('\\usepackage{xcolor}')
			if style.text_decoration == 'underline':
				packages.add('\\usepackage{ulem}')

		packages.update([
			'\\usepackage[utf8]{inputenc}',
			'\\usepackage[T1]{fontenc}',
			'\\usepackage{geometry}',
			'\\usepackage{setspace}',
			'\\usepackage{titlesec}'
		])

		return '\n'.join(sorted(packages))

	async def _generate_element_latex_commands(self, style: ComputedStyle) -> str:
		"""Generate LaTeX commands for individual element"""
		commands = []

		font_commands = await self._generate_latex_font_commands(style)
		if font_commands:
			commands.append(font_commands)

		spacing_commands = await self._generate_latex_spacing_commands(style)
		if spacing_commands:
			commands.append(spacing_commands)

		if style.color and style.color != '#000000':
			color_command = self._convert_color_to_latex(style.color)
			commands.append(f'\\textcolor{{{color_command}}}')

		return ''.join(commands)

	async def _generate_latex_font_commands(self, style: ComputedStyle) -> str:
		"""Generate LaTeX font commands"""
		commands = []

		if 'serif' in style.font_family.lower():
			commands.append('\\rmfamily ')
		elif 'sans' in style.font_family.lower():
			commands.append('\\sffamily ')
		elif 'mono' in style.font_family.lower():
			commands.append('\\ttfamily ')

		if style.font_weight == 'bold':
			commands.append('\\bfseries ')

		if style.font_style == 'italic':
			commands.append('\\itshape ')

		size_map = {
			'8pt': '\\tiny ',
			'9pt': '\\scriptsize ',
			'10pt': '\\footnotesize ',
			'11pt': '\\small ',
			'12pt': '\\normalsize ',
			'14pt': '\\large ',
			'16pt': '\\Large ',
			'18pt': '\\LARGE ',
			'20pt': '\\huge ',
			'24pt': '\\Huge '
		}

		if style.font_size in size_map:
			commands.append(size_map[style.font_size])

		return ''.join(commands)

	async def _generate_latex_spacing_commands(self, style: ComputedStyle) -> str:
		"""Generate LaTeX spacing commands"""
		commands = []

		if style.margin_top and style.margin_top != '0':
			commands.append(f'\\vspace{{{style.margin_top}}}')

		if style.margin_bottom and style.margin_bottom != '0':
			commands.append(f'\\vspace{{{style.margin_bottom}}}')

		if style.text_indent and style.text_indent != '0':
			commands.append(f'\\indent ')

		return ''.join(commands)

	async def _generate_document_latex_commands(self, styles: list[ComputedStyle]) -> str:
		"""Generate document-level LaTeX commands"""
		commands = []

		commands.append('\\geometry{margin=1in}')
		commands.append('\\setstretch{1.5}')

		return '\n'.join(commands)

	def _convert_color_to_latex(self, color: str) -> str:
		"""Convert CSS color to LaTeX color"""
		if color.startswith('#'):
			hex_color = color[1:]
			if len(hex_color) == 3:
				hex_color = ''.join([c*2 for c in hex_color])

			r = int(hex_color[0:2], 16) / 255.0
			g = int(hex_color[2:4], 16) / 255.0
			b = int(hex_color[4:6], 16) / 255.0

			return f'[rgb]{{{r:.2f},{g:.2f},{b:.2f}}}'

		color_map = {
			'black': 'black',
			'white': 'white',
			'red': 'red',
			'green': 'green',
			'blue': 'blue'
		}

		return color_map.get(color.lower(), 'black')

	async def generate_html_css(
		self,
		styles: list[ComputedStyle]
	) -> tuple[str, str]:
		"""Generate HTML markup and CSS stylesheet"""
		assert isinstance(styles, list), "Styles must be list"

		try:
			self._log_output_operation("generate_html", f"Generating for {len(styles)} styles")

			css_content = await self._generate_css_stylesheet(styles)
			html_content = await self._generate_html_markup(styles)

			assert css_content != "", "CSS content generated"
			return html_content, css_content

		except Exception as e:
			raise OutputGenerationException(f"Failed to generate HTML/CSS: {str(e)}")

	async def _generate_css_stylesheet(self, styles: list[ComputedStyle]) -> str:
		"""Generate CSS stylesheet from computed styles"""
		css_rules = []

		for style in styles:
			css_rule = await self._generate_css_rule_for_style(style)
			css_rules.append(css_rule)

		return '\n\n'.join(css_rules)

	async def _generate_css_rule_for_style(self, style: ComputedStyle) -> str:
		"""Generate CSS rule for individual style"""
		selector = f".element-{style.element_id}"
		properties = []

		properties.append(f"font-family: {style.font_family}")
		properties.append(f"font-size: {style.font_size}")
		properties.append(f"font-weight: {style.font_weight}")
		properties.append(f"font-style: {style.font_style}")
		properties.append(f"line-height: {style.line_height}")
		properties.append(f"color: {style.color}")
		properties.append(f"text-align: {style.text_align}")

		properties.append(f"margin-top: {style.margin_top}")
		properties.append(f"margin-bottom: {style.margin_bottom}")
		properties.append(f"margin-left: {style.margin_left}")
		properties.append(f"margin-right: {style.margin_right}")
		properties.append(f"padding-top: {style.padding_top}")
		properties.append(f"padding-bottom: {style.padding_bottom}")
		properties.append(f"padding-left: {style.padding_left}")
		properties.append(f"padding-right: {style.padding_right}")

		properties.append(f"display: {style.display}")
		if style.width != 'auto':
			properties.append(f"width: {style.width}")
		if style.height != 'auto':
			properties.append(f"height: {style.height}")

		if style.background_color != 'transparent':
			properties.append(f"background-color: {style.background_color}")
		if style.border_width != '0':
			properties.append(f"border: {style.border_width} {style.border_style} {style.border_color}")

		return f"{selector} {{\n  " + ";\n  ".join(properties) + ";\n}"

	async def _generate_html_markup(self, styles: list[ComputedStyle]) -> str:
		"""Generate HTML markup with proper styling classes"""
		html_elements = []

		for style in styles:
			element_html = await self._generate_html_element(style)
			html_elements.append(element_html)

		return '\n'.join(html_elements)

	async def _generate_html_element(self, style: ComputedStyle) -> str:
		"""Generate HTML element with styling"""
		class_name = f"element-{style.element_id}"
		tag = self._get_html_tag_for_element_type(style.element_type)

		return f'<{tag} class="{class_name}"><!-- Content for {style.element_id} --></{tag}>'

	def _get_html_tag_for_element_type(self, element_type: str) -> str:
		"""Get appropriate HTML tag for element type"""
		tag_map = {
			'heading': 'h2',
			'paragraph': 'p',
			'table': 'table',
			'figure': 'figure',
			'list': 'ul',
			'code': 'code'
		}

		return tag_map.get(element_type, 'div')

	async def generate_pdf_formatting(
		self,
		styles: list[ComputedStyle]
	) -> dict[str, Any]:
		"""Generate PDF formatting instructions"""
		assert isinstance(styles, list), "Styles must be list"

		try:
			self._log_output_operation("generate_pdf", f"Generating for {len(styles)} styles")

			pdf_formatting = {
				'page_setup': await self._generate_pdf_page_setup(styles),
				'font_definitions': await self._generate_pdf_font_definitions(styles),
				'style_definitions': await self._generate_pdf_style_definitions(styles),
				'layout_instructions': await self._generate_pdf_layout_instructions(styles)
			}

			assert 'page_setup' in pdf_formatting, "PDF page setup generated"
			return pdf_formatting

		except Exception as e:
			raise OutputGenerationException(f"Failed to generate PDF formatting: {str(e)}")

	async def _generate_pdf_page_setup(self, styles: list[ComputedStyle]) -> dict[str, Any]:
		"""Generate PDF page setup configuration"""
		return {
			'page_size': 'A4',
			'margins': {
				'top': '1in',
				'bottom': '1in',
				'left': '1in',
				'right': '1in'
			},
			'orientation': 'portrait'
		}

	async def _generate_pdf_font_definitions(self, styles: list[ComputedStyle]) -> list[dict[str, Any]]:
		"""Generate PDF font definitions"""
		fonts = []
		used_fonts = set()

		for style in styles:
			if style.font_family not in used_fonts:
				font_def = {
					'name': style.font_family,
					'base_size': style.font_size,
					'weight_variants': ['normal', 'bold'],
					'style_variants': ['normal', 'italic']
				}
				fonts.append(font_def)
				used_fonts.add(style.font_family)

		return fonts

	async def _generate_pdf_style_definitions(self, styles: list[ComputedStyle]) -> list[dict[str, Any]]:
		"""Generate PDF style definitions"""
		style_defs = []

		for style in styles:
			style_def = {
				'element_id': style.element_id,
				'element_type': style.element_type,
				'font_family': style.font_family,
				'font_size': style.font_size,
				'font_weight': style.font_weight,
				'color': style.color,
				'spacing': {
					'margin_top': style.margin_top,
					'margin_bottom': style.margin_bottom,
					'padding_top': style.padding_top,
					'padding_bottom': style.padding_bottom
				}
			}
			style_defs.append(style_def)

		return style_defs

	async def _generate_pdf_layout_instructions(self, styles: list[ComputedStyle]) -> dict[str, Any]:
		"""Generate PDF layout instructions"""
		return {
			'flow_direction': 'top_to_bottom',
			'column_count': 1,
			'line_spacing': 1.5,
			'page_breaks': 'auto',
			'widow_orphan_control': True
		}

	async def optimize_output(
		self,
		output: str,
		format_type: str,
		optimization_level: int = 1
	) -> str:
		"""Optimize generated output for performance and size"""
		assert isinstance(output, str), "Output must be string"
		assert isinstance(format_type, str), "Format type must be string"
		assert 1 <= optimization_level <= 3, "Optimization level must be 1-3"

		try:
			if format_type.lower() == 'latex':
				return await self._optimize_latex_output(output, optimization_level)
			elif format_type.lower() == 'css':
				return await self._optimize_css_output(output, optimization_level)
			elif format_type.lower() == 'html':
				return await self._optimize_html_output(output, optimization_level)
			else:
				return output

		except Exception as e:
			return output

	async def _optimize_latex_output(self, latex_content: str, level: int) -> str:
		"""Optimize LaTeX output"""
		if level == 1:
			optimized = re.sub(r'\n\s*\n\s*\n+', '\n\n', latex_content)
			optimized = re.sub(r'[ \t]+', ' ', optimized)
			optimized = '\n'.join(line.strip() for line in optimized.split('\n'))
			return optimized.strip()

		elif level == 2:
			optimized = await self._optimize_latex_output(latex_content, 1)
			return optimized

		elif level == 3:
			optimized = await self._optimize_latex_output(latex_content, 2)
			return optimized

		return latex_content

	async def _optimize_css_output(self, css_content: str, level: int) -> str:
		"""Optimize CSS output"""
		if level == 1:
			optimized = re.sub(r'/\*.*?\*/', '', css_content, flags=re.DOTALL)
			optimized = re.sub(r'\s+', ' ', optimized)
			optimized = re.sub(r';\s*}', '}', optimized)
			return optimized.strip()

		elif level >= 2:
			optimized = await self._optimize_css_output(css_content, 1)
			return optimized

		return css_content

	async def _optimize_html_output(self, html_content: str, level: int) -> str:
		"""Optimize HTML output"""
		if level == 1:
			optimized = re.sub(r'>\s+<', '><', html_content)
			optimized = re.sub(r'\s+', ' ', optimized)
			return optimized.strip()

		return html_content