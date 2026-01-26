"""
Data Processing Tools for Agents

Provides tools for processing various data formats like JSON, CSV, XML, etc.
"""

import json
import csv
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Union
import re
from pathlib import Path
import asyncio
import aiofiles

from .base import AgentTool, ToolResult, ToolCapability, ToolError, ToolConfig


class JSONProcessorTool(AgentTool):
	"""
	Tool for processing JSON data
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="json_processor",
			description="Process and manipulate JSON data",
			capabilities=[ToolCapability.DATA_PROCESSING],
			config=config
		)
	
	async def execute(self, operation: str, data: Union[str, dict, list] = None,
					 json_path: Optional[str] = None, query: Optional[str] = None,
					 **kwargs) -> ToolResult:
		"""Execute JSON processing operation"""
		
		try:
			if operation == "parse":
				result = await self._parse_json(data)
			elif operation == "stringify":
				result = await self._stringify_json(data, kwargs.get("indent", 2))
			elif operation == "query":
				result = await self._query_json(data, query)
			elif operation == "validate":
				result = await self._validate_json(data)
			elif operation == "extract":
				result = await self._extract_from_json(data, json_path)
			elif operation == "merge":
				result = await self._merge_json(data, kwargs.get("merge_with", {}))
			else:
				raise ToolError(f"Invalid operation: {operation}", self.name, "INVALID_OPERATION")
			
			return ToolResult(
				success=True,
				data=result,
				tool_name=self.name,
				metadata={"operation": operation}
			)
			
		except Exception as e:
			raise ToolError(f"JSON processing failed: {str(e)}", self.name, "PROCESSING_ERROR")
	
	async def _parse_json(self, data: str) -> Dict[str, Any]:
		"""Parse JSON string"""
		try:
			parsed = json.loads(data)
			return {
				"parsed_data": parsed,
				"type": type(parsed).__name__,
				"size": len(str(parsed))
			}
		except json.JSONDecodeError as e:
			raise ToolError(f"Invalid JSON: {str(e)}", self.name, "INVALID_JSON")
	
	async def _stringify_json(self, data: Union[dict, list], indent: int = 2) -> Dict[str, Any]:
		"""Convert data to JSON string"""
		json_string = json.dumps(data, indent=indent, ensure_ascii=False)
		return {
			"json_string": json_string,
			"size": len(json_string),
			"formatted": indent > 0
		}
	
	async def _query_json(self, data: Union[dict, list], query: str) -> Dict[str, Any]:
		"""Query JSON data using simple path notation"""
		try:
			# Simple path query like "data.users[0].name"
			result = data
			parts = query.split('.')
			
			for part in parts:
				if '[' in part and ']' in part:
					# Handle array indexing
					key = part.split('[')[0]
					index = int(part.split('[')[1].split(']')[0])
					result = result[key][index]
				else:
					result = result[part]
			
			return {
				"query": query,
				"result": result,
				"found": True
			}
			
		except (KeyError, IndexError, TypeError) as e:
			return {
				"query": query,
				"result": None,
				"found": False,
				"error": str(e)
			}
	
	async def _validate_json(self, data: str) -> Dict[str, Any]:
		"""Validate JSON format"""
		try:
			json.loads(data)
			return {
				"valid": True,
				"size": len(data),
				"error": None
			}
		except json.JSONDecodeError as e:
			return {
				"valid": False,
				"error": str(e),
				"line": e.lineno,
				"column": e.colno
			}
	
	async def _extract_from_json(self, data: Union[dict, list], json_path: str) -> Dict[str, Any]:
		"""Extract specific fields from JSON"""
		# Simple extraction - can be enhanced with JSONPath
		try:
			if isinstance(data, dict):
				extracted = {key: data.get(key) for key in json_path.split(',')}
			else:
				extracted = data
			
			return {
				"extracted_data": extracted,
				"extraction_path": json_path
			}
		except Exception as e:
			raise ToolError(f"Extraction failed: {str(e)}", self.name, "EXTRACTION_ERROR")
	
	async def _merge_json(self, data1: Union[dict, list], data2: Union[dict, list]) -> Dict[str, Any]:
		"""Merge two JSON objects"""
		if isinstance(data1, dict) and isinstance(data2, dict):
			merged = {**data1, **data2}
		elif isinstance(data1, list) and isinstance(data2, list):
			merged = data1 + data2
		else:
			raise ToolError("Cannot merge different data types", self.name, "TYPE_MISMATCH")
		
		return {
			"merged_data": merged,
			"original_size": len(str(data1)),
			"merged_size": len(str(merged))
		}
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for JSON processor"""
		return {
			"type": "object",
			"properties": {
				"operation": {
					"type": "string",
					"enum": ["parse", "stringify", "query", "validate", "extract", "merge"],
					"description": "JSON operation to perform"
				},
				"data": {
					"description": "JSON data to process"
				},
				"json_path": {
					"type": "string",
					"description": "Path for extraction (comma-separated keys)"
				},
				"query": {
					"type": "string",
					"description": "Query path (e.g., 'data.users[0].name')"
				},
				"indent": {
					"type": "integer",
					"default": 2,
					"description": "Indentation for stringify operation"
				},
				"merge_with": {
					"description": "Data to merge with for merge operation"
				}
			},
			"required": ["operation"]
		}


class CSVProcessorTool(AgentTool):
	"""
	Tool for processing CSV data
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="csv_processor",
			description="Process and manipulate CSV data",
			capabilities=[ToolCapability.DATA_PROCESSING],
			config=config
		)
	
	async def execute(self, operation: str, data: Union[str, List[Dict]] = None,
					 file_path: Optional[str] = None, delimiter: str = ",",
					 **kwargs) -> ToolResult:
		"""Execute CSV processing operation"""
		
		try:
			if operation == "parse":
				result = await self._parse_csv(data, delimiter)
			elif operation == "to_json":
				result = await self._csv_to_json(data, delimiter)
			elif operation == "from_json":
				result = await self._json_to_csv(data, delimiter)
			elif operation == "filter":
				result = await self._filter_csv(data, kwargs.get("filter_condition"), delimiter)
			elif operation == "aggregate":
				result = await self._aggregate_csv(data, kwargs.get("group_by"), kwargs.get("aggregate_func"), delimiter)
			elif operation == "load_file":
				result = await self._load_csv_file(file_path, delimiter)
			else:
				raise ToolError(f"Invalid operation: {operation}", self.name, "INVALID_OPERATION")
			
			return ToolResult(
				success=True,
				data=result,
				tool_name=self.name,
				metadata={"operation": operation, "delimiter": delimiter}
			)
			
		except Exception as e:
			raise ToolError(f"CSV processing failed: {str(e)}", self.name, "PROCESSING_ERROR")
	
	async def _parse_csv(self, data: str, delimiter: str) -> Dict[str, Any]:
		"""Parse CSV string into records"""
		lines = data.strip().split('\n')
		if not lines:
			return {"records": [], "columns": [], "row_count": 0}
		
		# Use csv.reader for proper parsing
		import io
		csv_reader = csv.DictReader(io.StringIO(data), delimiter=delimiter)
		records = list(csv_reader)
		
		return {
			"records": records,
			"columns": csv_reader.fieldnames,
			"row_count": len(records)
		}
	
	async def _csv_to_json(self, data: str, delimiter: str) -> Dict[str, Any]:
		"""Convert CSV to JSON format"""
		parsed = await self._parse_csv(data, delimiter)
		json_data = json.dumps(parsed["records"], indent=2)
		
		return {
			"json_data": json_data,
			"record_count": parsed["row_count"],
			"columns": parsed["columns"]
		}
	
	async def _json_to_csv(self, data: List[Dict], delimiter: str) -> Dict[str, Any]:
		"""Convert JSON array to CSV format"""
		if not data or not isinstance(data, list):
			raise ToolError("Data must be a list of dictionaries", self.name, "INVALID_DATA")
		
		import io
		output = io.StringIO()
		
		if data:
			fieldnames = data[0].keys()
			writer = csv.DictWriter(output, fieldnames=fieldnames, delimiter=delimiter)
			writer.writeheader()
			writer.writerows(data)
		
		csv_content = output.getvalue()
		
		return {
			"csv_content": csv_content,
			"record_count": len(data),
			"columns": list(fieldnames) if data else []
		}
	
	async def _filter_csv(self, data: str, condition: str, delimiter: str) -> Dict[str, Any]:
		"""Filter CSV records based on condition"""
		parsed = await self._parse_csv(data, delimiter)
		records = parsed["records"]
		
		# Simple filtering - can be enhanced
		filtered_records = []
		if condition:
			# Basic condition parsing (column=value)
			if '=' in condition:
				key, value = condition.split('=', 1)
				key = key.strip()
				value = value.strip()
				filtered_records = [r for r in records if r.get(key) == value]
			else:
				filtered_records = records
		else:
			filtered_records = records
		
		return {
			"filtered_records": filtered_records,
			"original_count": len(records),
			"filtered_count": len(filtered_records),
			"condition": condition
		}
	
	async def _aggregate_csv(self, data: str, group_by: str, aggregate_func: str, delimiter: str) -> Dict[str, Any]:
		"""Aggregate CSV data"""
		parsed = await self._parse_csv(data, delimiter)
		records = parsed["records"]
		
		if not group_by or not records:
			return {"aggregated_data": {}, "group_count": 0}
		
		# Simple grouping
		groups = {}
		for record in records:
			key = record.get(group_by, 'unknown')
			if key not in groups:
				groups[key] = []
			groups[key].append(record)
		
		# Simple aggregation (count for now)
		aggregated = {key: len(values) for key, values in groups.items()}
		
		return {
			"aggregated_data": aggregated,
			"group_count": len(groups),
			"group_by": group_by,
			"function": aggregate_func or "count"
		}
	
	async def _load_csv_file(self, file_path: str, delimiter: str) -> Dict[str, Any]:
		"""Load CSV from file"""
		if not file_path:
			raise ToolError("File path is required", self.name, "MISSING_FILE_PATH")
		
		path = Path(file_path)
		if not path.exists():
			raise ToolError(f"File not found: {file_path}", self.name, "FILE_NOT_FOUND")
		
		async with aiofiles.open(path, 'r', encoding='utf-8') as f:
			content = await f.read()
		
		return await self._parse_csv(content, delimiter)
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for CSV processor"""
		return {
			"type": "object",
			"properties": {
				"operation": {
					"type": "string",
					"enum": ["parse", "to_json", "from_json", "filter", "aggregate", "load_file"],
					"description": "CSV operation to perform"
				},
				"data": {
					"description": "CSV data to process"
				},
				"file_path": {
					"type": "string",
					"description": "Path to CSV file for load_file operation"
				},
				"delimiter": {
					"type": "string",
					"default": ",",
					"description": "CSV delimiter character"
				},
				"filter_condition": {
					"type": "string",
					"description": "Filter condition (e.g., 'status=active')"
				},
				"group_by": {
					"type": "string",
					"description": "Column to group by for aggregation"
				},
				"aggregate_func": {
					"type": "string",
					"enum": ["count", "sum", "avg"],
					"default": "count",
					"description": "Aggregation function"
				}
			},
			"required": ["operation"]
		}


class XMLProcessorTool(AgentTool):
	"""
	Tool for processing XML data
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="xml_processor",
			description="Process and manipulate XML data",
			capabilities=[ToolCapability.DATA_PROCESSING],
			config=config
		)
	
	async def execute(self, operation: str, data: str = None,
					 xpath: Optional[str] = None, **kwargs) -> ToolResult:
		"""Execute XML processing operation"""
		
		try:
			if operation == "parse":
				result = await self._parse_xml(data)
			elif operation == "to_json":
				result = await self._xml_to_json(data)
			elif operation == "extract":
				result = await self._extract_from_xml(data, xpath)
			elif operation == "validate":
				result = await self._validate_xml(data)
			else:
				raise ToolError(f"Invalid operation: {operation}", self.name, "INVALID_OPERATION")
			
			return ToolResult(
				success=True,
				data=result,
				tool_name=self.name,
				metadata={"operation": operation}
			)
			
		except Exception as e:
			raise ToolError(f"XML processing failed: {str(e)}", self.name, "PROCESSING_ERROR")
	
	async def _parse_xml(self, data: str) -> Dict[str, Any]:
		"""Parse XML string"""
		try:
			root = ET.fromstring(data)
			return {
				"root_tag": root.tag,
				"attributes": root.attrib,
				"children_count": len(root),
				"text": root.text.strip() if root.text else None
			}
		except ET.ParseError as e:
			raise ToolError(f"Invalid XML: {str(e)}", self.name, "INVALID_XML")
	
	async def _xml_to_json(self, data: str) -> Dict[str, Any]:
		"""Convert XML to JSON-like structure"""
		def xml_to_dict(element):
			result = {}
			if element.attrib:
				result['@attributes'] = element.attrib
			if element.text and element.text.strip():
				result['text'] = element.text.strip()
			
			for child in element:
				child_data = xml_to_dict(child)
				if child.tag in result:
					if not isinstance(result[child.tag], list):
						result[child.tag] = [result[child.tag]]
					result[child.tag].append(child_data)
				else:
					result[child.tag] = child_data
			
			return result
		
		try:
			root = ET.fromstring(data)
			json_data = {root.tag: xml_to_dict(root)}
			
			return {
				"json_data": json_data,
				"json_string": json.dumps(json_data, indent=2)
			}
		except ET.ParseError as e:
			raise ToolError(f"Invalid XML: {str(e)}", self.name, "INVALID_XML")
	
	async def _extract_from_xml(self, data: str, xpath: str) -> Dict[str, Any]:
		"""Extract data from XML using XPath-like syntax"""
		try:
			root = ET.fromstring(data)
			
			# Simple XPath-like extraction
			if xpath:
				elements = root.findall(xpath)
				extracted = []
				for elem in elements:
					extracted.append({
						"tag": elem.tag,
						"text": elem.text,
						"attributes": elem.attrib
					})
			else:
				extracted = []
			
			return {
				"xpath": xpath,
				"matches": extracted,
				"match_count": len(extracted)
			}
			
		except ET.ParseError as e:
			raise ToolError(f"Invalid XML: {str(e)}", self.name, "INVALID_XML")
	
	async def _validate_xml(self, data: str) -> Dict[str, Any]:
		"""Validate XML format"""
		try:
			ET.fromstring(data)
			return {
				"valid": True,
				"size": len(data),
				"error": None
			}
		except ET.ParseError as e:
			return {
				"valid": False,
				"error": str(e),
				"line": e.lineno
			}
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for XML processor"""
		return {
			"type": "object",
			"properties": {
				"operation": {
					"type": "string",
					"enum": ["parse", "to_json", "extract", "validate"],
					"description": "XML operation to perform"
				},
				"data": {
					"type": "string",
					"description": "XML data to process"
				},
				"xpath": {
					"type": "string",
					"description": "XPath expression for extraction"
				}
			},
			"required": ["operation", "data"]
		}


class TextProcessorTool(AgentTool):
	"""
	Tool for processing text data with various operations
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="text_processor",
			description="Process and manipulate text data",
			capabilities=[ToolCapability.DATA_PROCESSING],
			config=config
		)
	
	async def execute(self, operation: str, text: str, **kwargs) -> ToolResult:
		"""Execute text processing operation"""
		
		try:
			if operation == "clean":
				result = await self._clean_text(text)
			elif operation == "extract_emails":
				result = await self._extract_emails(text)
			elif operation == "extract_urls":
				result = await self._extract_urls(text)
			elif operation == "word_count":
				result = await self._word_count(text)
			elif operation == "sentiment":
				result = await self._basic_sentiment(text)
			elif operation == "summarize":
				result = await self._basic_summarize(text, kwargs.get("max_sentences", 3))
			else:
				raise ToolError(f"Invalid operation: {operation}", self.name, "INVALID_OPERATION")
			
			return ToolResult(
				success=True,
				data=result,
				tool_name=self.name,
				metadata={"operation": operation}
			)
			
		except Exception as e:
			raise ToolError(f"Text processing failed: {str(e)}", self.name, "PROCESSING_ERROR")
	
	async def _clean_text(self, text: str) -> Dict[str, Any]:
		"""Clean and normalize text"""
		original_length = len(text)
		
		# Basic cleaning operations
		cleaned = text.strip()
		cleaned = re.sub(r'\s+', ' ', cleaned)  # Normalize whitespace
		cleaned = re.sub(r'[^\w\s.,!?-]', '', cleaned)  # Remove special chars
		
		return {
			"original_text": text,
			"cleaned_text": cleaned,
			"original_length": original_length,
			"cleaned_length": len(cleaned),
			"reduction_percent": ((original_length - len(cleaned)) / original_length * 100) if original_length > 0 else 0
		}
	
	async def _extract_emails(self, text: str) -> Dict[str, Any]:
		"""Extract email addresses from text"""
		email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
		emails = re.findall(email_pattern, text)
		unique_emails = list(set(emails))
		
		return {
			"emails": unique_emails,
			"email_count": len(unique_emails),
			"total_matches": len(emails)
		}
	
	async def _extract_urls(self, text: str) -> Dict[str, Any]:
		"""Extract URLs from text"""
		url_pattern = r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
		urls = re.findall(url_pattern, text)
		unique_urls = list(set(urls))
		
		return {
			"urls": unique_urls,
			"url_count": len(unique_urls),
			"total_matches": len(urls)
		}
	
	async def _word_count(self, text: str) -> Dict[str, Any]:
		"""Count words and analyze text statistics"""
		words = text.split()
		sentences = re.split(r'[.!?]+', text)
		paragraphs = text.split('\n\n')
		
		# Word frequency
		word_freq = {}
		for word in words:
			clean_word = re.sub(r'[^\w]', '', word.lower())
			if clean_word:
				word_freq[clean_word] = word_freq.get(clean_word, 0) + 1
		
		# Top words
		top_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:10]
		
		return {
			"word_count": len(words),
			"sentence_count": len([s for s in sentences if s.strip()]),
			"paragraph_count": len([p for p in paragraphs if p.strip()]),
			"character_count": len(text),
			"character_count_no_spaces": len(text.replace(' ', '')),
			"average_word_length": sum(len(word) for word in words) / len(words) if words else 0,
			"top_words": top_words,
			"unique_words": len(word_freq)
		}
	
	async def _basic_sentiment(self, text: str) -> Dict[str, Any]:
		"""Basic sentiment analysis using keyword matching"""
		positive_words = {'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'best', 'awesome'}
		negative_words = {'bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disgusting', 'poor', 'disappointing'}
		
		words = set(word.lower().strip('.,!?') for word in text.split())
		
		positive_count = len(words & positive_words)
		negative_count = len(words & negative_words)
		
		if positive_count > negative_count:
			sentiment = "positive"
		elif negative_count > positive_count:
			sentiment = "negative"
		else:
			sentiment = "neutral"
		
		return {
			"sentiment": sentiment,
			"positive_words_found": positive_count,
			"negative_words_found": negative_count,
			"confidence": abs(positive_count - negative_count) / max(positive_count + negative_count, 1)
		}
	
	async def _basic_summarize(self, text: str, max_sentences: int = 3) -> Dict[str, Any]:
		"""Basic text summarization by extracting key sentences"""
		sentences = re.split(r'[.!?]+', text)
		sentences = [s.strip() for s in sentences if s.strip()]
		
		if len(sentences) <= max_sentences:
			summary_sentences = sentences
		else:
			# Simple scoring: prefer longer sentences and those with more common words
			scored_sentences = []
			for i, sentence in enumerate(sentences):
				words = sentence.split()
				score = len(words) + (i == 0) * 2  # Slight preference for first sentence
				scored_sentences.append((sentence, score))
			
			# Select top sentences
			scored_sentences.sort(key=lambda x: x[1], reverse=True)
			summary_sentences = [s[0] for s in scored_sentences[:max_sentences]]
		
		summary = '. '.join(summary_sentences) + '.'
		
		return {
			"summary": summary,
			"original_sentences": len(sentences),
			"summary_sentences": len(summary_sentences),
			"compression_ratio": len(summary) / len(text) if text else 0
		}
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for text processor"""
		return {
			"type": "object",
			"properties": {
				"operation": {
					"type": "string",
					"enum": ["clean", "extract_emails", "extract_urls", "word_count", "sentiment", "summarize"],
					"description": "Text processing operation to perform"
				},
				"text": {
					"type": "string",
					"description": "Text to process"
				},
				"max_sentences": {
					"type": "integer",
					"default": 3,
					"minimum": 1,
					"maximum": 10,
					"description": "Maximum sentences for summarization"
				}
			},
			"required": ["operation", "text"]
		}