"""
LaTeX Formatter Module - Professional Document Generation

This module provides LaTeX-based document formatting for DocuFusion, enabling
professional-quality document generation without manual layout concerns.
The formatter transforms content blocks into semantic LaTeX markup and handles
compilation to various output formats.
"""

from typing import Any, Union
import re
import uuid

from pydantic import Field, ConfigDict
from pydantic.dataclasses import dataclass as pydantic_dataclass

# Import our content block models
from ..assembler.content_assembler import ContentBlock

# Import canonical LaTeX compiler from pdf_renderer
from ..renderer.pdf_renderer import LaTeXCompiler, CompilationResult


# Enhanced Models for LaTeX
@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class LaTeXContentBlock:
	"""Enhanced ContentBlock with LaTeX-specific metadata and formatting options."""
	
	# Core content (required fields first)
	block_type: str
	content: str
	
	# Basic metadata (optional with defaults)
	block_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
	title: str = ""
	metadata: dict[str, Any] = Field(default_factory=dict)
	
	# LaTeX-specific formatting
	latex_environment: str = ""
	latex_options: dict[str, str] = Field(default_factory=dict)
	requires_math_mode: bool = False
	cross_reference_label: str = ""
	
	# Bibliography and citations
	citations: list[str] = Field(default_factory=list)
	
	# Layout control
	page_break_before: bool = False
	page_break_after: bool = False
	column_span: str = "single"  # single, double, full
	
	# Package requirements
	required_packages: list[str] = Field(default_factory=list)
	
	# Positioning and floating
	float_position: str = "htbp"  # h=here, t=top, b=bottom, p=page
	caption: str = ""
	caption_position: str = "bottom"  # top, bottom


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class DocumentMetadata:
	"""Comprehensive document metadata for LaTeX generation."""
	
	# Required document identification
	title: str
	document_type: str  # proposal, report, letter, presentation
	
	# Optional metadata with defaults
	subtitle: str = ""
	author: str = ""
	organization: str = ""
	client_name: str = ""
	rfp_number: str = ""
	submission_date: str = ""
	version: str = "1.0"
	
	# LaTeX document class settings
	document_class: str = "article"
	font_size: str = "11pt"
	paper_size: str = "letterpaper"
	
	# Branding and styling
	logo_path: str = ""
	color_scheme: str = "default"
	template_name: str = "standard"
	
	# Bibliography settings
	bibliography_style: str = "ieee"
	bibliography_file: str = ""
	
	# Document options
	table_of_contents: bool = True
	list_of_figures: bool = False
	list_of_tables: bool = False
	appendices: bool = False
	
	# Custom LaTeX preamble additions
	custom_preamble: str = ""


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class LaTeXTemplate:
	"""LaTeX template configuration and content."""
	
	# Template identification
	template_name: str
	template_path: str
	
	# Template metadata
	description: str = ""
	document_types: list[str] = Field(default_factory=list)
	required_packages: list[str] = Field(default_factory=list)
	
	# Template content
	preamble_template: str = ""
	document_template: str = ""
	
	# Customization options
	customizable_elements: dict[str, Any] = Field(default_factory=dict)
	default_settings: dict[str, Any] = Field(default_factory=dict)


# LaTeX Block Type Mapping
LATEX_BLOCK_MAPPING = {
	'text': {
		'environment': None,
		'command': None,
		'wrapper': r'{content}',
		'packages': []
	},
	'heading': {
		'environment': None,
		'command': r'\section{{{title}}}',
		'wrapper': r'{content}',
		'packages': []
	},
	'subheading': {
		'environment': None,
		'command': r'\subsection{{{title}}}',
		'wrapper': r'{content}',
		'packages': []
	},
	'subsubheading': {
		'environment': None,
		'command': r'\subsubsection{{{title}}}',
		'wrapper': r'{content}',
		'packages': []
	},
	'table': {
		'environment': 'table',
		'command': r'\begin{{tabular}}{{{columns}}}',
		'wrapper': r'\caption{{{caption}}}\label{{{label}}}',
		'packages': ['booktabs', 'array']
	},
	'figure': {
		'environment': 'figure',
		'command': r'\includegraphics[width=\textwidth]{{{path}}}',
		'wrapper': r'\caption{{{caption}}}\label{{{label}}}',
		'packages': ['graphicx']
	},
	'equation': {
		'environment': 'equation',
		'command': None,
		'wrapper': r'\label{{{label}}}',
		'packages': ['amsmath', 'amssymb']
	},
	'list': {
		'environment': 'itemize',
		'command': r'\item',
		'wrapper': r'{content}',
		'packages': []
	},
	'numbered_list': {
		'environment': 'enumerate',
		'command': r'\item',
		'wrapper': r'{content}',
		'packages': []
	},
	'code': {
		'environment': 'lstlisting',
		'command': None,
		'wrapper': r'[language={language},caption={{{caption}}}]',
		'packages': ['listings', 'xcolor']
	},
	'quote': {
		'environment': 'quote',
		'command': None,
		'wrapper': r'{content}',
		'packages': []
	},
	'abstract': {
		'environment': 'abstract',
		'command': None,
		'wrapper': r'{content}',
		'packages': []
	}
}


class LaTeXSanitizer:
	"""Sanitize and escape content for safe LaTeX processing."""
	
	# Special LaTeX characters that need escaping
	LATEX_SPECIAL_CHARS = {
		'&': r'\&',
		'%': r'\%',
		'$': r'\$',
		'#': r'\#',
		'^': r'\textasciicircum{}',
		'_': r'\_',
		'{': r'\{',
		'}': r'\}',
		'~': r'\textasciitilde{}',
		'\\': r'\textbackslash{}',
	}
	
	@classmethod
	def escape_latex(cls, text: str) -> str:
		"""
		Escape special LaTeX characters in text content.
		
		Args:
			text: Raw text content
			
		Returns:
			LaTeX-safe escaped text
		"""
		if not text:
			return ""
		
		# Escape special characters
		escaped_text = text
		for char, replacement in cls.LATEX_SPECIAL_CHARS.items():
			escaped_text = escaped_text.replace(char, replacement)
		
		return escaped_text
	
	@classmethod
	def sanitize_label(cls, label: str) -> str:
		"""
		Sanitize text for use as LaTeX labels and references.
		
		Args:
			label: Raw label text
			
		Returns:
			LaTeX-safe label
		"""
		if not label:
			return ""
		
		# Convert to lowercase and replace spaces/special chars with hyphens
		sanitized = re.sub(r'[^a-zA-Z0-9\-_]', '-', label.lower())
		
		# Remove multiple consecutive hyphens
		sanitized = re.sub(r'-+', '-', sanitized)
		
		# Remove leading/trailing hyphens
		sanitized = sanitized.strip('-')
		
		return sanitized
	
	@classmethod
	def clean_filename(cls, filename: str) -> str:
		"""
		Clean filename for LaTeX file inclusion.
		
		Args:
			filename: Raw filename
			
		Returns:
			LaTeX-safe filename
		"""
		if not filename:
			return ""
		
		# Remove or replace problematic characters
		cleaned = re.sub(r'[^\w\-_\.]', '_', filename)
		
		return cleaned


class ContentToLaTeXTransformer:
	"""Transform content blocks into semantic LaTeX markup."""
	
	def __init__(self):
		"""Initialize transformer with default settings."""
		self.sanitizer = LaTeXSanitizer()
		self.required_packages = set()
	
	def transform_content_block(self, block: LaTeXContentBlock) -> str:
		"""
		Transform a content block to LaTeX based on its type.
		
		Args:
			block: Content block to transform
			
		Returns:
			LaTeX markup for the block
		"""
		# Get block type mapping
		mapping = LATEX_BLOCK_MAPPING.get(block.block_type, LATEX_BLOCK_MAPPING['text'])
		
		# Add required packages
		self.required_packages.update(mapping['packages'])
		self.required_packages.update(block.required_packages)
		
		# Apply page breaks
		latex_content = ""
		if block.page_break_before:
			latex_content += r'\newpage' + '\n'
		
		# Transform based on block type
		if block.block_type == 'text':
			latex_content += self._transform_text_block(block)
		elif block.block_type in ['heading', 'subheading', 'subsubheading']:
			latex_content += self._transform_heading_block(block)
		elif block.block_type == 'table':
			latex_content += self._transform_table_block(block)
		elif block.block_type == 'figure':
			latex_content += self._transform_figure_block(block)
		elif block.block_type == 'equation':
			latex_content += self._transform_equation_block(block)
		elif block.block_type in ['list', 'numbered_list']:
			latex_content += self._transform_list_block(block)
		elif block.block_type == 'code':
			latex_content += self._transform_code_block(block)
		elif block.block_type == 'quote':
			latex_content += self._transform_quote_block(block)
		elif block.block_type == 'abstract':
			latex_content += self._transform_abstract_block(block)
		else:
			# Default to text transformation
			latex_content += self._transform_text_block(block)
		
		# Apply page breaks
		if block.page_break_after:
			latex_content += '\n' + r'\newpage'
		
		return latex_content
	
	def _transform_text_block(self, block: LaTeXContentBlock) -> str:
		"""Transform text content block to LaTeX."""
		content = self.sanitizer.escape_latex(block.content)
		
		# Add paragraph breaks for multiple paragraphs
		if '\n\n' in content:
			content = content.replace('\n\n', '\n\n\\par\n')
		
		return content + '\n\n'
	
	def _transform_heading_block(self, block: LaTeXContentBlock) -> str:
		"""Transform heading block to LaTeX section commands."""
		title = self.sanitizer.escape_latex(block.title or block.content)
		content = self.sanitizer.escape_latex(block.content) if block.content != block.title else ""
		
		# Determine section level
		if block.block_type == 'heading':
			command = r'\section{' + title + '}'
		elif block.block_type == 'subheading':
			command = r'\subsection{' + title + '}'
		else:  # subsubheading
			command = r'\subsubsection{' + title + '}'
		
		# Add label if specified
		if block.cross_reference_label:
			label = self.sanitizer.sanitize_label(block.cross_reference_label)
			command += r'\label{' + label + '}'
		
		result = command + '\n'
		if content:
			result += content + '\n'
		
		return result + '\n'
	
	def _transform_table_block(self, block: LaTeXContentBlock) -> str:
		"""Transform table block to LaTeX tabular environment."""
		# Parse table data from content (assuming CSV or similar format)
		table_data = self._parse_table_data(block.content)
		
		if not table_data:
			return self._transform_text_block(block)
		
		# Determine column specification
		num_cols = len(table_data[0]) if table_data else 1
		col_spec = 'l' * num_cols  # Left-aligned columns by default
		
		# Override with custom column specification if provided
		if 'columns' in block.latex_options:
			col_spec = block.latex_options['columns']
		
		# Build table
		latex_content = r'\begin{table}[' + block.float_position + ']\n'
		latex_content += r'\centering' + '\n'
		
		if block.caption:
			if block.caption_position == 'top':
				latex_content += r'\caption{' + self.sanitizer.escape_latex(block.caption) + '}\n'
		
		if block.cross_reference_label:
			label = self.sanitizer.sanitize_label(block.cross_reference_label)
			latex_content += r'\label{' + label + '}\n'
		
		# Table content
		latex_content += r'\begin{tabular}{' + col_spec + '}\n'
		latex_content += r'\toprule' + '\n'
		
		# Table rows
		for i, row in enumerate(table_data):
			escaped_row = [self.sanitizer.escape_latex(str(cell)) for cell in row]
			latex_content += ' & '.join(escaped_row) + r' \\' + '\n'
			
			# Add midrule after header row
			if i == 0 and len(table_data) > 1:
				latex_content += r'\midrule' + '\n'
		
		latex_content += r'\bottomrule' + '\n'
		latex_content += r'\end{tabular}' + '\n'
		
		if block.caption and block.caption_position == 'bottom':
			latex_content += r'\caption{' + self.sanitizer.escape_latex(block.caption) + '}\n'
		
		latex_content += r'\end{table}' + '\n\n'
		
		return latex_content
	
	def _transform_figure_block(self, block: LaTeXContentBlock) -> str:
		"""Transform figure block to LaTeX figure environment."""
		# Extract image path from content or metadata
		image_path = block.content.strip()
		if not image_path and 'path' in block.metadata:
			image_path = block.metadata['path']
		
		if not image_path:
			return f"% Figure block without image path: {block.block_id}\n\n"
		
		# Sanitize filename
		clean_path = self.sanitizer.clean_filename(image_path)
		
		# Build figure
		latex_content = r'\begin{figure}[' + block.float_position + ']\n'
		latex_content += r'\centering' + '\n'
		
		# Include graphics with options
		width_option = block.latex_options.get('width', r'\textwidth')
		latex_content += r'\includegraphics[width=' + width_option + ']{' + clean_path + '}\n'
		
		if block.caption:
			latex_content += r'\caption{' + self.sanitizer.escape_latex(block.caption) + '}\n'
		
		if block.cross_reference_label:
			label = self.sanitizer.sanitize_label(block.cross_reference_label)
			latex_content += r'\label{' + label + '}\n'
		
		latex_content += r'\end{figure}' + '\n\n'
		
		return latex_content
	
	def _transform_equation_block(self, block: LaTeXContentBlock) -> str:
		"""Transform equation block to LaTeX math environment."""
		# Assume content is already in LaTeX math format
		equation_content = block.content.strip()
		
		if block.latex_environment == 'align':
			latex_content = r'\begin{align}' + '\n'
			latex_content += equation_content + '\n'
			
			if block.cross_reference_label:
				label = self.sanitizer.sanitize_label(block.cross_reference_label)
				latex_content += r'\label{' + label + '}\n'
			
			latex_content += r'\end{align}' + '\n\n'
		else:
			# Default equation environment
			latex_content = r'\begin{equation}' + '\n'
			latex_content += equation_content + '\n'
			
			if block.cross_reference_label:
				label = self.sanitizer.sanitize_label(block.cross_reference_label)
				latex_content += r'\label{' + label + '}\n'
			
			latex_content += r'\end{equation}' + '\n\n'
		
		return latex_content
	
	def _transform_list_block(self, block: LaTeXContentBlock) -> str:
		"""Transform list block to LaTeX list environment."""
		# Parse list items from content
		list_items = self._parse_list_items(block.content)
		
		if not list_items:
			return self._transform_text_block(block)
		
		# Determine list environment
		env_name = 'enumerate' if block.block_type == 'numbered_list' else 'itemize'
		
		latex_content = r'\begin{' + env_name + '}\n'
		
		for item in list_items:
			escaped_item = self.sanitizer.escape_latex(item.strip())
			latex_content += r'\item ' + escaped_item + '\n'
		
		latex_content += r'\end{' + env_name + '}\n\n'
		
		return latex_content
	
	def _transform_code_block(self, block: LaTeXContentBlock) -> str:
		"""Transform code block to LaTeX listings environment."""
		# Get programming language from metadata
		language = block.latex_options.get('language', 'text')
		
		latex_content = r'\begin{lstlisting}'
		
		# Add options
		options = []
		if language != 'text':
			options.append(f'language={language}')
		if block.caption:
			options.append(f'caption={{{self.sanitizer.escape_latex(block.caption)}}}')
		if block.cross_reference_label:
			label = self.sanitizer.sanitize_label(block.cross_reference_label)
			options.append(f'label={{{label}}}')
		
		if options:
			latex_content += '[' + ','.join(options) + ']'
		
		latex_content += '\n'
		latex_content += block.content  # Code content is not escaped
		latex_content += '\n' + r'\end{lstlisting}' + '\n\n'
		
		return latex_content
	
	def _transform_quote_block(self, block: LaTeXContentBlock) -> str:
		"""Transform quote block to LaTeX quote environment."""
		content = self.sanitizer.escape_latex(block.content)
		
		latex_content = r'\begin{quote}' + '\n'
		latex_content += content + '\n'
		latex_content += r'\end{quote}' + '\n\n'
		
		return latex_content
	
	def _transform_abstract_block(self, block: LaTeXContentBlock) -> str:
		"""Transform abstract block to LaTeX abstract environment."""
		content = self.sanitizer.escape_latex(block.content)
		
		latex_content = r'\begin{abstract}' + '\n'
		latex_content += content + '\n'
		latex_content += r'\end{abstract}' + '\n\n'
		
		return latex_content
	
	def _parse_table_data(self, content: str) -> list[list[str]]:
		"""Parse table data from content string."""
		if not content.strip():
			return []
		
		# Split by lines and parse as CSV-like format
		lines = content.strip().split('\n')
		table_data = []
		
		for line in lines:
			# Simple CSV parsing (could be enhanced)
			if ',' in line:
				row = [cell.strip() for cell in line.split(',')]
			elif '\t' in line:
				row = [cell.strip() for cell in line.split('\t')]
			elif '|' in line:
				row = [cell.strip() for cell in line.split('|')]
			else:
				row = [line.strip()]
			
			if row and any(cell for cell in row):  # Skip empty rows
				table_data.append(row)
		
		return table_data
	
	def _parse_list_items(self, content: str) -> list[str]:
		"""Parse list items from content string."""
		if not content.strip():
			return []
		
		lines = content.strip().split('\n')
		items = []
		
		for line in lines:
			line = line.strip()
			if not line:
				continue
			
			# Remove common list markers
			if line.startswith('- '):
				line = line[2:]
			elif line.startswith('* '):
				line = line[2:]
			elif re.match(r'^\d+\.\s', line):
				line = re.sub(r'^\d+\.\s', '', line)
			
			if line:
				items.append(line)
		
		return items
	
	def get_required_packages(self) -> list[str]:
		"""Get list of LaTeX packages required for transformed content."""
		return sorted(list(self.required_packages))


class LaTeXDocumentAssembler:
	"""Assemble content blocks into complete LaTeX documents."""
	
	def __init__(self):
		"""Initialize assembler with default settings."""
		self.transformer = ContentToLaTeXTransformer()
		self.template_manager = LaTeXTemplateManager()
	
	async def assemble_document(
		self,
		blocks: list[LaTeXContentBlock],
		metadata: DocumentMetadata,
		template_name: str = "standard"
	) -> str:
		"""
		Assemble content blocks into complete LaTeX document.
		
		Args:
			blocks: List of content blocks to assemble
			metadata: Document metadata
			template_name: LaTeX template to use
			
		Returns:
			Complete LaTeX document source
		"""
		# Get template
		template = await self.template_manager.get_template(template_name)
		
		# Transform content blocks
		latex_blocks = []
		for block in blocks:
			latex_content = self.transformer.transform_content_block(block)
			latex_blocks.append(latex_content)
		
		# Generate document sections
		preamble = self._generate_preamble(metadata, template)
		document_begin = self._generate_document_begin(metadata)
		content = '\n'.join(latex_blocks)
		document_end = self._generate_document_end()
		
		# Assemble complete document
		latex_document = preamble + '\n\n' + document_begin + '\n\n' + content + '\n\n' + document_end
		
		return latex_document
	
	def _generate_preamble(self, metadata: DocumentMetadata, template: LaTeXTemplate) -> str:
		"""Generate LaTeX preamble with document class and packages."""
		preamble = []
		
		# Document class
		class_options = [metadata.font_size, metadata.paper_size]
		if metadata.document_type == 'presentation':
			preamble.append(r'\documentclass{beamer}')
		else:
			preamble.append(r'\documentclass[' + ','.join(class_options) + ']{' + metadata.document_class + '}')
		
		# Required packages
		required_packages = set([
			'inputenc',  # Input encoding
			'fontenc',   # Font encoding
			'geometry',  # Page layout
			'fancyhdr',  # Headers and footers
			'titlesec',  # Section formatting
			'xcolor',    # Color support
			'graphicx',  # Graphics
			'amsmath',   # Mathematics
			'amssymb',   # Math symbols
			'booktabs',  # Professional tables
			'hyperref',  # Hyperlinks
		])
		
		# Add packages from transformer
		required_packages.update(self.transformer.get_required_packages())
		
		# Add template packages
		if template and template.required_packages:
			required_packages.update(template.required_packages)
		
		# Package declarations
		for package in sorted(required_packages):
			if package == 'inputenc':
				preamble.append(r'\usepackage[utf8]{inputenc}')
			elif package == 'fontenc':
				preamble.append(r'\usepackage[T1]{fontenc}')
			elif package == 'geometry':
				preamble.append(r'\usepackage[margin=1in]{geometry}')
			elif package == 'hyperref':
				preamble.append(r'\usepackage[colorlinks=true,linkcolor=blue,citecolor=blue,urlcolor=blue]{hyperref}')
			else:
				preamble.append(f'\\usepackage{{{package}}}')
		
		# Custom preamble additions
		if metadata.custom_preamble:
			preamble.append('')
			preamble.append('% Custom preamble additions')
			preamble.append(metadata.custom_preamble)
		
		return '\n'.join(preamble)
	
	def _generate_document_begin(self, metadata: DocumentMetadata) -> str:
		"""Generate document beginning with title and metadata."""
		content = [r'\begin{document}']
		
		# Title information
		if metadata.title:
			content.append(f'\\title{{{LaTeXSanitizer.escape_latex(metadata.title)}}}')
		
		if metadata.author:
			content.append(f'\\author{{{LaTeXSanitizer.escape_latex(metadata.author)}}}')
		
		if metadata.submission_date:
			content.append(f'\\date{{{LaTeXSanitizer.escape_latex(metadata.submission_date)}}}')
		else:
			content.append(r'\date{\today}')
		
		# Make title
		if metadata.title:
			content.append(r'\maketitle')
		
		# Table of contents
		if metadata.table_of_contents:
			content.append(r'\tableofcontents')
			content.append(r'\newpage')
		
		# List of figures/tables
		if metadata.list_of_figures:
			content.append(r'\listoffigures')
		
		if metadata.list_of_tables:
			content.append(r'\listoftables')
		
		return '\n'.join(content)
	
	def _generate_document_end(self) -> str:
		"""Generate document ending."""
		return r'\end{document}'


class LaTeXTemplateManager:
	"""Manage LaTeX templates and document classes."""
	
	def __init__(self):
		"""Initialize template manager with built-in templates."""
		self.templates = {}
		self._load_builtin_templates()
	
	def _load_builtin_templates(self):
		"""Load built-in LaTeX templates."""
		# Standard article template
		self.templates["standard"] = LaTeXTemplate(
			template_name="standard",
			template_path="builtin:standard",
			description="Standard article template for general documents",
			document_types=["article", "report", "proposal"],
			required_packages=["geometry", "fancyhdr", "titlesec"]
		)
		
		# Proposal template
		self.templates["proposal"] = LaTeXTemplate(
			template_name="proposal",
			template_path="builtin:proposal",
			description="Professional proposal template with branding",
			document_types=["proposal", "rfp_response"],
			required_packages=["geometry", "fancyhdr", "titlesec", "xcolor", "graphicx"]
		)
		
		# Technical report template
		self.templates["technical_report"] = LaTeXTemplate(
			template_name="technical_report",
			template_path="builtin:technical_report",
			description="Technical report template with advanced formatting",
			document_types=["report", "technical_document"],
			required_packages=["geometry", "fancyhdr", "titlesec", "amsmath", "listings"]
		)
	
	async def get_template(self, template_name: str) -> LaTeXTemplate:
		"""Get template by name."""
		if template_name in self.templates:
			return self.templates[template_name]
		else:
			# Return default template
			return self.templates["standard"]
	
	def register_template(self, template: LaTeXTemplate):
		"""Register a new template."""
		self.templates[template.template_name] = template
	
	def list_templates(self) -> list[str]:
		"""List available template names."""
		return list(self.templates.keys())


# Main LaTeX Formatter Class
class LaTeXFormatter:
	"""
	Main LaTeX formatter class that orchestrates content transformation
	and document compilation for professional document generation.
	"""
	
	def __init__(self):
		"""Initialize LaTeX formatter with all components."""
		self.assembler = LaTeXDocumentAssembler()
		self.compiler = LaTeXCompiler()
		self.template_manager = LaTeXTemplateManager()
		self.sanitizer = LaTeXSanitizer()
		
		# Performance metrics
		self._metrics = {
			'documents_formatted': 0,
			'compilations_successful': 0,
			'compilations_failed': 0,
			'average_compilation_time': 0.0
		}
	
	async def format_document(
		self,
		content_blocks: list[Union[ContentBlock, LaTeXContentBlock]],
		metadata: DocumentMetadata,
		template_name: str = "standard",
		output_format: str = "pdf"
	) -> CompilationResult:
		"""
		Format content blocks into professional document using LaTeX.
		
		Args:
			content_blocks: List of content blocks to format
			metadata: Document metadata
			template_name: LaTeX template to use
			output_format: Output format (pdf, html, etc.)
			
		Returns:
			CompilationResult with formatted document
		"""
		try:
			# Convert ContentBlocks to LaTeXContentBlocks if needed
			latex_blocks = []
			for block in content_blocks:
				if isinstance(block, LaTeXContentBlock):
					latex_blocks.append(block)
				else:
					# Convert ContentBlock to LaTeXContentBlock
					latex_block = LaTeXContentBlock(
						block_type=block.block_type,
						content=block.content,
						block_id=getattr(block, 'block_id', str(uuid.uuid4())),
						title=getattr(block, 'title', ''),
						metadata=getattr(block, 'metadata', {})
					)
					latex_blocks.append(latex_block)
			
			# Assemble LaTeX document
			latex_source = await self.assembler.assemble_document(
				latex_blocks,
				metadata,
				template_name
			)
			
			# Compile to requested format
			if output_format.lower() == "pdf":
				result = await self.compiler.compile_to_pdf(latex_source)
			else:
				# For now, only PDF compilation is implemented
				result = CompilationResult(
					success=False,
					output_format=output_format,
					errors=[f"Output format '{output_format}' not yet implemented"]
				)
			
			# Update metrics
			self._metrics['documents_formatted'] += 1
			if result.success:
				self._metrics['compilations_successful'] += 1
				
				# Update average compilation time
				total_successful = self._metrics['compilations_successful']
				current_avg = self._metrics['average_compilation_time']
				new_avg = ((current_avg * (total_successful - 1)) + result.compilation_time) / total_successful
				self._metrics['average_compilation_time'] = new_avg
			else:
				self._metrics['compilations_failed'] += 1
			
			return result
			
		except Exception as e:
			self._metrics['documents_formatted'] += 1
			self._metrics['compilations_failed'] += 1
			
			return CompilationResult(
				success=False,
				output_format=output_format,
				errors=[f"Formatting exception: {str(e)}"]
			)
	
	async def get_latex_source(
		self,
		content_blocks: list[Union[ContentBlock, LaTeXContentBlock]],
		metadata: DocumentMetadata,
		template_name: str = "standard"
	) -> str:
		"""
		Generate LaTeX source code without compilation.
		
		Args:
			content_blocks: List of content blocks
			metadata: Document metadata
			template_name: LaTeX template to use
			
		Returns:
			LaTeX source code
		"""
		# Convert ContentBlocks to LaTeXContentBlocks if needed
		latex_blocks = []
		for block in content_blocks:
			if isinstance(block, LaTeXContentBlock):
				latex_blocks.append(block)
			else:
				latex_block = LaTeXContentBlock(
					block_type=block.block_type,
					content=block.content,
					block_id=getattr(block, 'block_id', str(uuid.uuid4())),
					title=getattr(block, 'title', ''),
					metadata=getattr(block, 'metadata', {})
				)
				latex_blocks.append(latex_block)
		
		return await self.assembler.assemble_document(latex_blocks, metadata, template_name)
	
	def get_available_templates(self) -> list[str]:
		"""Get list of available LaTeX templates."""
		return self.template_manager.list_templates()
	
	async def get_formatter_metrics(self) -> dict[str, Any]:
		"""Get comprehensive formatter performance metrics."""
		return {
			'formatting_metrics': self._metrics.copy(),
			'available_templates': self.get_available_templates(),
			'supported_output_formats': ['pdf']  # Will expand as more formats are added
		}


# Exception Classes
class LaTeXFormatterException(Exception):
	"""Base exception for LaTeX formatter operations."""
	pass


class LaTeXCompilationException(LaTeXFormatterException):
	"""Raised when LaTeX compilation fails."""
	pass


class LaTeXTemplateException(LaTeXFormatterException):
	"""Raised when template operations fail."""
	pass


# Module-level assertions
assert LaTeXContentBlock, "LaTeXContentBlock model must be available"
assert DocumentMetadata, "DocumentMetadata model must be available"
assert LaTeXTemplate, "LaTeXTemplate model must be available"
assert CompilationResult, "CompilationResult model must be available"

assert ContentToLaTeXTransformer, "ContentToLaTeXTransformer must be available"
assert LaTeXDocumentAssembler, "LaTeXDocumentAssembler must be available"
assert LaTeXCompiler, "LaTeXCompiler must be available"
assert LaTeXFormatter, "LaTeXFormatter must be available as main interface"