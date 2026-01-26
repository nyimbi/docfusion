"""
Final Publishing Tools - ReportGeneratorTool and DeliveryPackagerTool

These are the final 2 tools to complete the 10 specialized publishing tools.
"""

import asyncio
import re
import json
import hashlib
from typing import Any, Dict, List, Optional, Tuple, Union
from datetime import datetime
from pathlib import Path
import zipfile
import tempfile
import os

from .base import AgentTool, ToolResult, ToolCapability, ToolError, ToolConfig


class ReportGeneratorTool(AgentTool):
	"""
	Comprehensive report compilation and formatting tool
	
	Essential for report writers, analysts, and publishers to compile comprehensive reports.
	Automatically formats content, generates table of contents, adds executive summaries,
	and creates professional report layouts from multiple content sources.
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="report_generator",
			description="Comprehensive report compilation and professional formatting tool",
			capabilities=[ToolCapability.DATA_PROCESSING, ToolCapability.FILE_OPERATIONS],
			config=config
		)
	
	async def execute(self, content_sections: List[Dict[str, Any]], report_title: str,
					 generate_toc: bool = True, add_executive_summary: bool = True,
					 report_style: str = "professional", **kwargs) -> ToolResult:
		"""Execute report generation"""
		
		try:
			report_results = {
				"report_title": report_title,
				"report_style": report_style,
				"sections_count": len(content_sections),
				"generated_components": [],
				"formatted_report": "",
				"metadata": {}
			}
			
			# Validate and process content sections
			processed_sections = await self._process_content_sections(content_sections)
			report_results["processed_sections"] = processed_sections
			
			# Generate executive summary if requested
			executive_summary = ""
			if add_executive_summary:
				executive_summary = await self._generate_executive_summary(processed_sections)
				report_results["generated_components"].append("executive_summary")
			
			# Generate table of contents if requested
			table_of_contents = ""
			if generate_toc:
				table_of_contents = await self._generate_table_of_contents(processed_sections)
				report_results["generated_components"].append("table_of_contents")
			
			# Compile the complete report
			formatted_report = await self._compile_report(
				report_title, executive_summary, table_of_contents, 
				processed_sections, report_style
			)
			report_results["formatted_report"] = formatted_report
			
			# Generate report metadata
			metadata = await self._generate_report_metadata(
				formatted_report, report_title, processed_sections
			)
			report_results["metadata"] = metadata
			
			# Calculate report statistics
			stats = await self._calculate_report_statistics(formatted_report, processed_sections)
			report_results["statistics"] = stats
			
			return ToolResult(
				success=True,
				data=report_results,
				tool_name=self.name,
				metadata={
					"report_title": report_title,
					"sections_count": len(content_sections),
					"report_style": report_style
				}
			)
			
		except Exception as e:
			raise ToolError(f"Report generation failed: {str(e)}", self.name, "REPORT_GENERATION_ERROR")
	
	async def _process_content_sections(self, sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
		"""Process and validate content sections"""
		processed = []
		
		for i, section in enumerate(sections):
			if not isinstance(section, dict) or "content" not in section:
				continue
			
			section_data = {
				"index": i + 1,
				"title": section.get("title", f"Section {i + 1}"),
				"content": section["content"],
				"section_type": section.get("type", "content"),
				"word_count": len(section["content"].split()),
				"subsections": await self._extract_subsections(section["content"])
			}
			
			# Add numbering if not present
			if not re.match(r'^\d+\.', section_data["title"]):
				section_data["title"] = f"{i + 1}. {section_data['title']}"
			
			processed.append(section_data)
		
		return processed
	
	async def _extract_subsections(self, content: str) -> List[Dict[str, str]]:
		"""Extract subsections from content"""
		subsections = []
		
		# Look for potential subsection headers
		lines = content.split('\n')
		for line_num, line in enumerate(lines):
			line = line.strip()
			
			# Check for subsection patterns
			if (len(line) > 5 and len(line) < 60 and
				not line.endswith('.') and
				(line.startswith(('a)', 'b)', 'c)')) or 
				 re.match(r'^\d+\.\d+', line) or
				 line.isupper())):
				
				subsections.append({
					"title": line,
					"line_number": line_num + 1
				})
		
		return subsections[:10]  # Limit to 10 subsections per section
	
	async def _generate_executive_summary(self, sections: List[Dict[str, Any]]) -> str:
		"""Generate executive summary from report sections"""
		
		# Collect key sentences from each section
		key_points = []
		
		for section in sections[:5]:  # Focus on first 5 sections for summary
			content = section["content"]
			sentences = re.split(r'[.!?]+', content)
			
			# Find sentences that might be key points
			for sentence in sentences:
				sentence = sentence.strip()
				if (len(sentence) > 30 and len(sentence) < 150 and
					any(indicator in sentence.lower() for indicator in 
						['important', 'key', 'significant', 'critical', 'essential', 
						 'shows', 'indicates', 'demonstrates', 'results', 'findings'])):
					key_points.append(sentence)
		
		# Create executive summary
		summary_parts = [
			"## Executive Summary\n",
			"This report presents a comprehensive analysis of the key topics addressed in the following sections.\n"
		]
		
		if key_points:
			summary_parts.append("\n**Key Findings:**\n")
			for i, point in enumerate(key_points[:5], 1):  # Top 5 key points
				summary_parts.append(f"{i}. {point.strip()}.\n")
		
		summary_parts.extend([
			f"\nThe report contains {len(sections)} main sections covering ",
			f"a total of {sum(s['word_count'] for s in sections)} words. ",
			"Each section provides detailed analysis and recommendations for the respective topic areas.\n\n"
		])
		
		return ''.join(summary_parts)
	
	async def _generate_table_of_contents(self, sections: List[Dict[str, Any]]) -> str:
		"""Generate table of contents"""
		toc_parts = ["## Table of Contents\n\n"]
		
		for section in sections:
			toc_parts.append(f"{section['index']}. {section['title']} ... Page {section['index']}\n")
			
			# Add subsections if present
			for subsection in section.get('subsections', []):
				toc_parts.append(f"   {subsection['title']} ... Page {section['index']}\n")
		
		toc_parts.append("\n---\n\n")
		return ''.join(toc_parts)
	
	async def _compile_report(self, title: str, executive_summary: str, 
							 table_of_contents: str, sections: List[Dict[str, Any]], 
							 style: str) -> str:
		"""Compile the complete report"""
		
		report_parts = []
		
		# Report header based on style
		if style == "professional":
			report_parts.extend([
				f"# {title}\n\n",
				f"**Date:** {datetime.now().strftime('%B %d, %Y')}\n",
				f"**Generated by:** Agent Publishing System\n\n",
				"---\n\n"
			])
		elif style == "academic":
			report_parts.extend([
				f"# {title}\n\n",
				f"**Abstract:** This document presents a comprehensive analysis of the subject matter.\n\n",
				f"**Date:** {datetime.now().strftime('%Y-%m-%d')}\n\n",
				"---\n\n"
			])
		else:  # technical or other styles
			report_parts.extend([
				f"# {title}\n\n",
				f"**Document Version:** 1.0\n",
				f"**Generated:** {datetime.now().isoformat()}\n\n",
				"---\n\n"
			])
		
		# Add executive summary
		if executive_summary:
			report_parts.append(executive_summary)
			report_parts.append("---\n\n")
		
		# Add table of contents
		if table_of_contents:
			report_parts.append(table_of_contents)
		
		# Add main content sections
		for section in sections:
			report_parts.extend([
				f"## {section['title']}\n\n",
				section['content'],
				"\n\n---\n\n"
			])
		
		# Add footer based on style
		if style == "professional":
			report_parts.extend([
				"## Report Summary\n\n",
				f"This report contains {len(sections)} sections with a total of ",
				f"{sum(s['word_count'] for s in sections)} words. ",
				"The analysis provided is based on the available information and methodology described in each section.\n\n",
				f"**Report Generated:** {datetime.now().strftime('%B %d, %Y at %I:%M %p')}\n"
			])
		
		return ''.join(report_parts)
	
	async def _generate_report_metadata(self, report: str, title: str, 
									   sections: List[Dict[str, Any]]) -> Dict[str, Any]:
		"""Generate comprehensive report metadata"""
		return {
			"title": title,
			"generation_date": datetime.now().isoformat(),
			"total_word_count": len(report.split()),
			"total_character_count": len(report),
			"section_count": len(sections),
			"page_estimate": max(1, len(report.split()) // 250),  # ~250 words per page
			"report_hash": hashlib.md5(report.encode()).hexdigest(),
			"sections_metadata": [
				{
					"title": s["title"],
					"word_count": s["word_count"],
					"subsection_count": len(s.get("subsections", []))
				}
				for s in sections
			]
		}
	
	async def _calculate_report_statistics(self, report: str, sections: List[Dict[str, Any]]) -> Dict[str, Any]:
		"""Calculate detailed report statistics"""
		words = report.split()
		sentences = re.split(r'[.!?]+', report)
		sentences = [s for s in sentences if s.strip()]
		
		return {
			"total_words": len(words),
			"total_sentences": len(sentences),
			"avg_words_per_sentence": len(words) / len(sentences) if sentences else 0,
			"avg_words_per_section": sum(s['word_count'] for s in sections) / len(sections) if sections else 0,
			"longest_section": max(sections, key=lambda s: s['word_count'])['title'] if sections else None,
			"shortest_section": min(sections, key=lambda s: s['word_count'])['title'] if sections else None,
			"reading_time_minutes": max(1, len(words) // 200)  # ~200 words per minute
		}
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for report generator"""
		return {
			"type": "object",
			"properties": {
				"content_sections": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": {
							"title": {"type": "string", "description": "Section title"},
							"content": {"type": "string", "description": "Section content"},
							"type": {"type": "string", "default": "content", "description": "Section type"}
						},
						"required": ["content"]
					},
					"description": "Array of content sections to include in the report"
				},
				"report_title": {
					"type": "string",
					"description": "Title of the generated report"
				},
				"generate_toc": {
					"type": "boolean",
					"default": True,
					"description": "Generate table of contents"
				},
				"add_executive_summary": {
					"type": "boolean",
					"default": True,
					"description": "Add executive summary to the report"
				},
				"report_style": {
					"type": "string",
					"enum": ["professional", "academic", "technical", "creative"],
					"default": "professional",
					"description": "Report formatting style"
				}
			},
			"required": ["content_sections", "report_title"]
		}


class DeliveryPackagerTool(AgentTool):
	"""
	Document packaging and delivery preparation tool
	
	Critical for publishers, packagers, and delivery teams to prepare final documents.
	Creates delivery packages with proper folder structure, metadata files,
	version control, and formats for different distribution channels.
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="delivery_packager",
			description="Document packaging and delivery preparation for distribution",
			capabilities=[ToolCapability.FILE_OPERATIONS, ToolCapability.DATA_PROCESSING],
			config=config
		)
	
	async def execute(self, documents: List[Dict[str, Any]], package_name: str,
					 include_metadata: bool = True, create_archive: bool = True,
					 delivery_format: str = "standard", **kwargs) -> ToolResult:
		"""Execute document packaging"""
		
		try:
			packaging_results = {
				"package_name": package_name,
				"delivery_format": delivery_format,
				"documents_count": len(documents),
				"package_structure": {},
				"generated_files": [],
				"package_metadata": {},
				"delivery_info": {}
			}
			
			# Create temporary directory for package preparation
			with tempfile.TemporaryDirectory() as temp_dir:
				package_dir = Path(temp_dir) / package_name
				package_dir.mkdir(exist_ok=True)
				
				# Process documents and create package structure
				package_structure = await self._create_package_structure(
					package_dir, documents, delivery_format
				)
				packaging_results["package_structure"] = package_structure
				
				# Generate metadata files if requested
				if include_metadata:
					metadata_files = await self._generate_metadata_files(
						package_dir, documents, package_name
					)
					packaging_results["generated_files"].extend(metadata_files)
				
				# Create delivery-specific files
				delivery_files = await self._create_delivery_files(
					package_dir, documents, delivery_format
				)
				packaging_results["generated_files"].extend(delivery_files)
				
				# Generate package manifest
				manifest = await self._generate_package_manifest(
					package_dir, documents, package_name
				)
				packaging_results["package_metadata"]["manifest"] = manifest
				
				# Create archive if requested
				archive_info = {}
				if create_archive:
					archive_info = await self._create_archive(
						package_dir, package_name, temp_dir
					)
				packaging_results["delivery_info"]["archive"] = archive_info
				
				# Calculate package statistics
				stats = await self._calculate_package_statistics(package_dir, documents)
				packaging_results["package_metadata"]["statistics"] = stats
				
				# Generate delivery instructions
				delivery_instructions = await self._generate_delivery_instructions(
					package_name, delivery_format, stats
				)
				packaging_results["delivery_info"]["instructions"] = delivery_instructions
			
			return ToolResult(
				success=True,
				data=packaging_results,
				tool_name=self.name,
				metadata={
					"package_name": package_name,
					"documents_count": len(documents),
					"delivery_format": delivery_format
				}
			)
			
		except Exception as e:
			raise ToolError(f"Document packaging failed: {str(e)}", self.name, "PACKAGING_ERROR")
	
	async def _create_package_structure(self, package_dir: Path, documents: List[Dict[str, Any]], 
									   delivery_format: str) -> Dict[str, Any]:
		"""Create organized package directory structure"""
		
		# Create standard directory structure
		dirs = {
			"documents": package_dir / "documents",
			"metadata": package_dir / "metadata",
			"resources": package_dir / "resources"
		}
		
		# Add format-specific directories
		if delivery_format == "print":
			dirs["print_ready"] = package_dir / "print_ready"
			dirs["proofs"] = package_dir / "proofs"
		elif delivery_format == "digital":
			dirs["web"] = package_dir / "web"
			dirs["mobile"] = package_dir / "mobile"
		elif delivery_format == "archive":
			dirs["originals"] = package_dir / "originals"
			dirs["processed"] = package_dir / "processed"
		
		# Create all directories
		for dir_path in dirs.values():
			dir_path.mkdir(exist_ok=True, parents=True)
		
		# Organize documents into appropriate directories
		document_placements = []
		
		for i, doc in enumerate(documents):
			doc_name = doc.get("filename", f"document_{i+1}.txt")
			doc_content = doc.get("content", "")
			doc_type = doc.get("type", "text")
			
			# Determine target directory based on document type and delivery format
			if doc_type in ["final", "published"]:
				target_dir = dirs.get("documents", dirs["documents"])
			elif doc_type in ["draft", "working"]:
				target_dir = dirs.get("originals", dirs["documents"]) 
			else:
				target_dir = dirs["documents"]
			
			# Write document to appropriate location
			doc_path = target_dir / doc_name
			try:
				with open(doc_path, 'w', encoding='utf-8') as f:
					f.write(doc_content)
				
				document_placements.append({
					"filename": doc_name,
					"path": str(doc_path.relative_to(package_dir)),
					"size_bytes": len(doc_content.encode('utf-8')),
					"type": doc_type
				})
			except Exception as e:
				# If writing fails, note the error but continue
				document_placements.append({
					"filename": doc_name,
					"path": "ERROR",
					"error": str(e),
					"type": doc_type
				})
		
		return {
			"directories_created": [str(d.relative_to(package_dir)) for d in dirs.values()],
			"document_placements": document_placements,
			"structure_type": delivery_format
		}
	
	async def _generate_metadata_files(self, package_dir: Path, documents: List[Dict[str, Any]], 
									  package_name: str) -> List[str]:
		"""Generate metadata files for the package"""
		metadata_files = []
		metadata_dir = package_dir / "metadata"
		
		# Generate package info file
		package_info = {
			"package_name": package_name,
			"creation_date": datetime.now().isoformat(),
			"document_count": len(documents),
			"total_size_estimate": sum(len(doc.get("content", "")) for doc in documents),
			"documents": [
				{
					"filename": doc.get("filename", f"document_{i+1}"),
					"type": doc.get("type", "text"),
					"size_estimate": len(doc.get("content", "")),
					"metadata": doc.get("metadata", {})
				}
				for i, doc in enumerate(documents)
			]
		}
		
		info_file = metadata_dir / "package_info.json"
		try:
			with open(info_file, 'w', encoding='utf-8') as f:
				json.dump(package_info, f, indent=2, ensure_ascii=False)
			metadata_files.append(str(info_file.relative_to(package_dir)))
		except Exception as e:
			metadata_files.append(f"ERROR: Could not create package_info.json - {e}")
		
		# Generate checksums file
		checksums = {}
		for i, doc in enumerate(documents):
			filename = doc.get("filename", f"document_{i+1}")
			content = doc.get("content", "")
			checksums[filename] = hashlib.md5(content.encode('utf-8')).hexdigest()
		
		checksum_file = metadata_dir / "checksums.json"
		try:
			with open(checksum_file, 'w', encoding='utf-8') as f:
				json.dump(checksums, f, indent=2)
			metadata_files.append(str(checksum_file.relative_to(package_dir)))
		except Exception as e:
			metadata_files.append(f"ERROR: Could not create checksums.json - {e}")
		
		return metadata_files
	
	async def _create_delivery_files(self, package_dir: Path, documents: List[Dict[str, Any]], 
									delivery_format: str) -> List[str]:
		"""Create delivery-format specific files"""
		delivery_files = []
		
		# Create README file
		readme_content = await self._generate_readme_content(documents, delivery_format)
		readme_file = package_dir / "README.txt"
		try:
			with open(readme_file, 'w', encoding='utf-8') as f:
				f.write(readme_content)
			delivery_files.append(str(readme_file.relative_to(package_dir)))
		except Exception as e:
			delivery_files.append(f"ERROR: Could not create README.txt - {e}")
		
		# Format-specific files
		if delivery_format == "print":
			# Create print specifications
			print_specs = await self._generate_print_specifications(documents)
			spec_file = package_dir / "print_specifications.txt"
			try:
				with open(spec_file, 'w', encoding='utf-8') as f:
					f.write(print_specs)
				delivery_files.append(str(spec_file.relative_to(package_dir)))
			except Exception as e:
				delivery_files.append(f"ERROR: Could not create print_specifications.txt - {e}")
		
		elif delivery_format == "digital":
			# Create web deployment guide
			web_guide = await self._generate_web_deployment_guide(documents)
			guide_file = package_dir / "web_deployment_guide.txt"
			try:
				with open(guide_file, 'w', encoding='utf-8') as f:
					f.write(web_guide)
				delivery_files.append(str(guide_file.relative_to(package_dir)))
			except Exception as e:
				delivery_files.append(f"ERROR: Could not create web_deployment_guide.txt - {e}")
		
		return delivery_files
	
	async def _generate_readme_content(self, documents: List[Dict[str, Any]], 
									  delivery_format: str) -> str:
		"""Generate README content for the package"""
		readme_parts = [
			"# Document Delivery Package\n\n",
			f"**Package Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n",
			f"**Delivery Format:** {delivery_format.title()}\n",
			f"**Document Count:** {len(documents)}\n\n",
			"## Contents\n\n"
		]
		
		# List documents
		for i, doc in enumerate(documents, 1):
			filename = doc.get("filename", f"document_{i}")
			doc_type = doc.get("type", "text")
			size_estimate = len(doc.get("content", ""))
			readme_parts.append(f"{i}. {filename} ({doc_type}, ~{size_estimate} chars)\n")
		
		readme_parts.extend([
			"\n## Directory Structure\n\n",
			"- documents/     - Main document files\n",
			"- metadata/      - Package and document metadata\n",
			"- resources/     - Additional resources and assets\n"
		])
		
		if delivery_format == "print":
			readme_parts.extend([
				"- print_ready/   - Print-optimized versions\n",
				"- proofs/        - Print proofs and previews\n"
			])
		elif delivery_format == "digital":
			readme_parts.extend([
				"- web/          - Web-optimized versions\n", 
				"- mobile/       - Mobile-optimized versions\n"
			])
		
		readme_parts.extend([
			"\n## Usage Instructions\n\n",
			f"This package is prepared for {delivery_format} delivery. ",
			"Please refer to the specific deployment or usage instructions ",
			"included in the package for detailed guidance.\n\n",
			"## Support\n\n",
			"For questions about this package, please contact the document ",
			"preparation team or refer to the metadata files for additional information.\n"
		])
		
		return ''.join(readme_parts)
	
	async def _generate_print_specifications(self, documents: List[Dict[str, Any]]) -> str:
		"""Generate print specifications"""
		specs = [
			"# Print Specifications\n\n",
			"## Document Format Requirements\n\n",
			"- Paper Size: A4 (210 × 297 mm) or Letter (8.5 × 11 in)\n",
			"- Margins: 1 inch (25.4 mm) on all sides\n",
			"- Font: Times New Roman, 12pt for body text\n",
			"- Line Spacing: 1.5x or double space\n",
			"- Print Quality: 300 DPI minimum\n\n",
			"## Color Requirements\n\n",
			"- Text: Black (100% K)\n",
			"- Headers: Black or dark gray\n",
			"- Ensure high contrast for readability\n\n",
			f"## Document Count: {len(documents)}\n\n",
			"Please verify all documents print correctly before final production.\n"
		]
		
		return ''.join(specs)
	
	async def _generate_web_deployment_guide(self, documents: List[Dict[str, Any]]) -> str:
		"""Generate web deployment guide"""
		guide = [
			"# Web Deployment Guide\n\n",
			"## File Requirements\n\n",
			"- Encoding: UTF-8\n",
			"- Line Endings: LF (Unix style)\n",
			"- File Permissions: 644 for files, 755 for directories\n\n",
			"## Deployment Steps\n\n",
			"1. Upload documents to web server\n",
			"2. Ensure proper MIME types are configured\n",
			"3. Test document accessibility\n",
			"4. Verify mobile compatibility\n",
			"5. Check search engine indexing preferences\n\n",
			f"## Document Inventory: {len(documents)} files\n\n",
			"Please test all documents in target browsers before going live.\n"
		]
		
		return ''.join(guide)
	
	async def _generate_package_manifest(self, package_dir: Path, documents: List[Dict[str, Any]], 
										package_name: str) -> Dict[str, Any]:
		"""Generate comprehensive package manifest"""
		
		# Scan actual files created
		actual_files = []
		for root, dirs, files in os.walk(package_dir):
			for file in files:
				file_path = Path(root) / file
				relative_path = file_path.relative_to(package_dir)
				
				try:
					stat_info = file_path.stat()
					actual_files.append({
						"path": str(relative_path),
						"size_bytes": stat_info.st_size,
						"modified": datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
						"type": "file"
					})
				except Exception as e:
					actual_files.append({
						"path": str(relative_path),
						"error": str(e),
						"type": "file"
					})
		
		return {
			"manifest_version": "1.0",
			"package_name": package_name,
			"generated_date": datetime.now().isoformat(),
			"source_documents": len(documents),
			"actual_files": actual_files,
			"total_files": len(actual_files),
			"package_hash": hashlib.md5(package_name.encode()).hexdigest()[:8]
		}
	
	async def _create_archive(self, package_dir: Path, package_name: str, 
							 temp_dir: str) -> Dict[str, Any]:
		"""Create compressed archive of the package"""
		archive_path = Path(temp_dir) / f"{package_name}.zip"
		
		try:
			with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
				for root, dirs, files in os.walk(package_dir):
					for file in files:
						file_path = Path(root) / file
						archive_name = file_path.relative_to(package_dir.parent)
						zipf.write(file_path, archive_name)
			
			archive_stat = archive_path.stat()
			
			return {
				"archive_created": True,
				"archive_path": str(archive_path),
				"archive_size_bytes": archive_stat.st_size,
				"compression_ratio": f"{(1 - archive_stat.st_size / sum(f.stat().st_size for f in package_dir.rglob('*') if f.is_file())) * 100:.1f}%"
			}
		
		except Exception as e:
			return {
				"archive_created": False,
				"error": str(e)
			}
	
	async def _calculate_package_statistics(self, package_dir: Path, 
										   documents: List[Dict[str, Any]]) -> Dict[str, Any]:
		"""Calculate comprehensive package statistics"""
		
		total_size = 0
		file_count = 0
		
		for file_path in package_dir.rglob('*'):
			if file_path.is_file():
				file_count += 1
				try:
					total_size += file_path.stat().st_size
				except:
					pass  # Skip files we can't stat
		
		return {
			"total_files": file_count,
			"total_size_bytes": total_size,
			"total_size_mb": round(total_size / (1024 * 1024), 2),
			"source_documents": len(documents),
			"estimated_word_count": sum(len(doc.get("content", "").split()) for doc in documents),
			"package_efficiency": f"{(len(documents) / file_count) * 100:.1f}%" if file_count > 0 else "N/A"
		}
	
	async def _generate_delivery_instructions(self, package_name: str, delivery_format: str, 
											 stats: Dict[str, Any]) -> Dict[str, Any]:
		"""Generate delivery-specific instructions"""
		
		instructions = {
			"package_name": package_name,
			"delivery_method": self._get_recommended_delivery_method(stats["total_size_mb"]),
			"estimated_transfer_time": self._estimate_transfer_time(stats["total_size_mb"]),
			"verification_steps": [
				"Check file count matches manifest",
				"Verify checksums if provided",
				"Test document accessibility",
				"Confirm format compatibility"
			]
		}
		
		# Format-specific instructions
		if delivery_format == "print":
			instructions["specific_steps"] = [
				"Review print specifications",
				"Test print quality on target printer",
				"Verify paper size and margins",
				"Check color accuracy if applicable"
			]
		elif delivery_format == "digital":
			instructions["specific_steps"] = [
				"Upload to target platform",
				"Test responsive design",
				"Verify SEO meta tags",
				"Check accessibility compliance"
			]
		elif delivery_format == "archive":
			instructions["specific_steps"] = [
				"Store in designated archive location",
				"Create backup copies",
				"Document archive location",
				"Set appropriate access permissions"
			]
		
		return instructions
	
	def _get_recommended_delivery_method(self, size_mb: float) -> str:
		"""Recommend delivery method based on package size"""
		if size_mb < 10:
			return "Email attachment"
		elif size_mb < 100:
			return "Cloud storage link (Dropbox, Google Drive)"
		elif size_mb < 500:
			return "File transfer service (WeTransfer, etc.)"
		else:
			return "Physical media or dedicated file server"
	
	def _estimate_transfer_time(self, size_mb: float) -> str:
		"""Estimate transfer time based on typical connection speeds"""
		# Assuming average broadband speed of 25 Mbps
		seconds = (size_mb * 8) / 25  # Convert MB to Mb, divide by speed
		
		if seconds < 60:
			return f"~{int(seconds)} seconds"
		elif seconds < 3600:
			return f"~{int(seconds/60)} minutes"
		else:
			return f"~{int(seconds/3600)} hours"
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for delivery packager"""
		return {
			"type": "object",
			"properties": {
				"documents": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": {
							"filename": {"type": "string", "description": "Document filename"},
							"content": {"type": "string", "description": "Document content"},
							"type": {"type": "string", "default": "text", "description": "Document type"},
							"metadata": {"type": "object", "description": "Additional document metadata"}
						},
						"required": ["content"]
					},
					"description": "Array of documents to package"
				},
				"package_name": {
					"type": "string",
					"description": "Name for the delivery package"
				},
				"include_metadata": {
					"type": "boolean",
					"default": True,
					"description": "Include metadata files in package"
				},
				"create_archive": {
					"type": "boolean",
					"default": True,
					"description": "Create compressed archive of the package"
				},
				"delivery_format": {
					"type": "string",
					"enum": ["standard", "print", "digital", "archive"],
					"default": "standard",
					"description": "Target delivery format"
				}
			},
			"required": ["documents", "package_name"]
		}