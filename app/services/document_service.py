"""
Document service for integrating with DocuFusion document engine.
"""

import os
import tempfile
from typing import Optional, Dict, Any, List
from pathlib import Path

# Import DocuFusion components
try:
	from src.proposal_writer.document_engine.document_engine import DocumentEngine
	from src.proposal_writer.document_engine.assembler.content_assembler import ContentAssembler
	from src.proposal_writer.document_engine.formatter.document_formatter import DocumentFormatter
	from src.proposal_writer.document_engine.renderer.pdf_renderer import PDFRenderer
	from src.proposal_writer.document_engine.renderer.docx_renderer import DOCXRenderer
	from src.proposal_writer.document_engine.renderer.html_renderer import HTMLRenderer
	from src.proposal_writer.storage.storage_service import StorageService
	from src.proposal_writer.nlp.nlp_service import NLPService
except ImportError:
	# Fallback for when proposal_writer components are not available
	DocumentEngine = None
	ContentAssembler = None
	DocumentFormatter = None
	PDFRenderer = None
	DOCXRenderer = None
	HTMLRenderer = None
	StorageService = None
	NLPService = None


class DocumentService:
	"""
	Service class for document operations that integrates with the
	DocuFusion document engine and other backend components.
	"""
	
	def __init__(self):
		"""Initialize the document service with backend components."""
		self.document_engine = None
		self.storage_service = None
		self.nlp_service = None
		
		# Initialize components if available
		if DocumentEngine:
			try:
				self.document_engine = DocumentEngine()
				self.storage_service = StorageService()
				self.nlp_service = NLPService()
			except Exception as e:
				print(f"Warning: Could not initialize DocuFusion components: {e}")
	
	def generate_pdf(self, document) -> str:
		"""
		Generate PDF version of document.
		
		Args:
			document: Document model instance
			
		Returns:
			Path to generated PDF file
		"""
		if not self.document_engine:
			# Fallback implementation
			return self._generate_fallback_pdf(document)
		
		try:
			# Use DocuFusion document engine
			content_blocks = self._prepare_content_blocks(document)
			formatted_document = self.document_engine.format_document(content_blocks)
			
			# Generate PDF
			pdf_renderer = PDFRenderer()
			output_path = self._get_output_path(document, 'pdf')
			pdf_path = pdf_renderer.render(formatted_document, output_path)
			
			return pdf_path
			
		except Exception as e:
			print(f"PDF generation failed: {e}")
			return self._generate_fallback_pdf(document)
	
	def generate_docx(self, document) -> str:
		"""
		Generate DOCX version of document.
		
		Args:
			document: Document model instance
			
		Returns:
			Path to generated DOCX file
		"""
		if not self.document_engine:
			return self._generate_fallback_docx(document)
		
		try:
			content_blocks = self._prepare_content_blocks(document)
			formatted_document = self.document_engine.format_document(content_blocks)
			
			# Generate DOCX
			docx_renderer = DOCXRenderer()
			output_path = self._get_output_path(document, 'docx')
			docx_path = docx_renderer.render(formatted_document, output_path)
			
			return docx_path
			
		except Exception as e:
			print(f"DOCX generation failed: {e}")
			return self._generate_fallback_docx(document)
	
	def generate_html(self, document) -> str:
		"""
		Generate HTML version of document.
		
		Args:
			document: Document model instance
			
		Returns:
			Path to generated HTML file
		"""
		if not self.document_engine:
			return self._generate_fallback_html(document)
		
		try:
			content_blocks = self._prepare_content_blocks(document)
			formatted_document = self.document_engine.format_document(content_blocks)
			
			# Generate HTML
			html_renderer = HTMLRenderer()
			output_path = self._get_output_path(document, 'html')
			html_path = html_renderer.render(formatted_document, output_path)
			
			return html_path
			
		except Exception as e:
			print(f"HTML generation failed: {e}")
			return self._generate_fallback_html(document)
	
	def analyze_document(self, document) -> Dict[str, Any]:
		"""
		Analyze document using NLP services.
		
		Args:
			document: Document model instance
			
		Returns:
			Dictionary containing analysis results
		"""
		if not self.nlp_service or not document.content:
			return {}
		
		try:
			analysis = {
				'word_count': len(document.content.split()),
				'readability': self.nlp_service.analyze_readability(document.content),
				'entities': self.nlp_service.extract_entities(document.content),
				'sentiment': self.nlp_service.analyze_sentiment(document.content),
				'topics': self.nlp_service.extract_topics(document.content)
			}
			
			return analysis
			
		except Exception as e:
			print(f"Document analysis failed: {e}")
			return {}
	
	def get_document_statistics(self, document) -> Dict[str, Any]:
		"""
		Get basic statistics about the document.
		
		Args:
			document: Document model instance
			
		Returns:
			Dictionary containing document statistics
		"""
		if not document.content:
			return {}
		
		content = document.content
		
		stats = {
			'character_count': len(content),
			'word_count': len(content.split()),
			'paragraph_count': len([p for p in content.split('\n\n') if p.strip()]),
			'line_count': len(content.split('\n')),
			'average_words_per_sentence': 0,
			'average_characters_per_word': 0
		}
		
		# Calculate averages
		sentences = content.replace('!', '.').replace('?', '.').split('.')
		sentences = [s.strip() for s in sentences if s.strip()]
		
		if sentences:
			total_words_in_sentences = sum(len(s.split()) for s in sentences)
			stats['average_words_per_sentence'] = total_words_in_sentences / len(sentences)
		
		words = content.split()
		if words:
			total_chars_in_words = sum(len(w) for w in words)
			stats['average_characters_per_word'] = total_chars_in_words / len(words)
		
		return stats
	
	def _prepare_content_blocks(self, document) -> List[Dict[str, Any]]:
		"""
		Prepare content blocks for document engine processing.
		
		Args:
			document: Document model instance
			
		Returns:
			List of content block dictionaries
		"""
		# Basic content block structure
		content_blocks = [
			{
				'block_id': 'main_content',
				'block_type': 'text',
				'content': document.content or '',
				'metadata': {
					'title': document.title,
					'document_type': document.document_type,
					'version': document.version
				},
				'order': 1
			}
		]
		
		return content_blocks
	
	def _get_output_path(self, document, format_type: str) -> str:
		"""
		Get output path for generated document.
		
		Args:
			document: Document model instance
			format_type: File format (pdf, docx, html)
			
		Returns:
			Output file path
		"""
		# Create output directory if it doesn't exist
		output_dir = Path('generated_documents')
		output_dir.mkdir(exist_ok=True)
		
		# Generate filename
		safe_title = "".join(c for c in document.title if c.isalnum() or c in (' ', '-', '_')).rstrip()
		filename = f"{safe_title}_{document.version}.{format_type}"
		
		return str(output_dir / filename)
	
	def _generate_fallback_pdf(self, document) -> str:
		"""
		Fallback PDF generation using basic HTML to PDF conversion.
		
		Args:
			document: Document model instance
			
		Returns:
			Path to generated PDF file
		"""
		try:
			import weasyprint
			
			# Create simple HTML
			html_content = f"""
			<!DOCTYPE html>
			<html>
			<head>
				<title>{document.title}</title>
				<style>
					body {{ font-family: Arial, sans-serif; margin: 2cm; }}
					h1 {{ color: #333; }}
					.meta {{ color: #666; font-size: 0.9em; margin-bottom: 2em; }}
				</style>
			</head>
			<body>
				<h1>{document.title}</h1>
				<div class="meta">
					Type: {document.document_type} | Version: {document.version} | Status: {document.status}
				</div>
				<div>{document.content or 'No content available'}</div>
			</body>
			</html>
			"""
			
			output_path = self._get_output_path(document, 'pdf')
			weasyprint.HTML(string=html_content).write_pdf(output_path)
			
			return output_path
			
		except ImportError:
			# Create a simple text file as final fallback
			output_path = self._get_output_path(document, 'txt')
			with open(output_path, 'w', encoding='utf-8') as f:
				f.write(f"Title: {document.title}\n")
				f.write(f"Type: {document.document_type}\n")
				f.write(f"Version: {document.version}\n")
				f.write(f"Status: {document.status}\n\n")
				f.write(document.content or 'No content available')
			
			return output_path
	
	def _generate_fallback_docx(self, document) -> str:
		"""
		Fallback DOCX generation using python-docx.
		
		Args:
			document: Document model instance
			
		Returns:
			Path to generated DOCX file
		"""
		try:
			from docx import Document as DocxDocument
			
			doc = DocxDocument()
			doc.add_heading(document.title, 0)
			
			# Add metadata
			meta_paragraph = doc.add_paragraph()
			meta_paragraph.add_run(f"Type: {document.document_type} | ").bold = True
			meta_paragraph.add_run(f"Version: {document.version} | ").bold = True
			meta_paragraph.add_run(f"Status: {document.status}").bold = True
			
			doc.add_paragraph()  # Empty line
			
			# Add content
			if document.content:
				for paragraph in document.content.split('\n\n'):
					if paragraph.strip():
						doc.add_paragraph(paragraph.strip())
			else:
				doc.add_paragraph('No content available')
			
			output_path = self._get_output_path(document, 'docx')
			doc.save(output_path)
			
			return output_path
			
		except ImportError:
			# Create a simple text file as final fallback
			return self._generate_fallback_pdf(document)
	
	def _generate_fallback_html(self, document) -> str:
		"""
		Fallback HTML generation.
		
		Args:
			document: Document model instance
			
		Returns:
			Path to generated HTML file
		"""
		html_content = f"""
		<!DOCTYPE html>
		<html>
		<head>
			<title>{document.title}</title>
			<meta charset="utf-8">
			<style>
				body {{ 
					font-family: Arial, sans-serif; 
					max-width: 800px; 
					margin: 0 auto; 
					padding: 2em; 
					line-height: 1.6;
				}}
				h1 {{ color: #333; border-bottom: 2px solid #eee; }}
				.meta {{ 
					background: #f5f5f5; 
					padding: 1em; 
					border-radius: 4px; 
					margin: 1em 0;
				}}
				.content {{ white-space: pre-wrap; }}
			</style>
		</head>
		<body>
			<h1>{document.title}</h1>
			<div class="meta">
				<strong>Type:</strong> {document.document_type}<br>
				<strong>Version:</strong> {document.version}<br>
				<strong>Status:</strong> {document.status}<br>
				<strong>Description:</strong> {document.description or 'No description'}
			</div>
			<div class="content">{document.content or 'No content available'}</div>
		</body>
		</html>
		"""
		
		output_path = self._get_output_path(document, 'html')
		with open(output_path, 'w', encoding='utf-8') as f:
			f.write(html_content)
		
		return output_path