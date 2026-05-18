"""
Tool Setup and Registration

Initializes and registers all available tools with the tool registry.
"""

import logging
from typing import Dict, List
from pathlib import Path

from .base import get_tool_registry, ToolRegistry, ToolConfig
from .web_tools import WebSearchTool, WebScrapeTool, DownloadTool, URLValidatorTool
from .file_tools import FileReadTool, FileWriteTool, DirectoryListTool, FileSearchTool
from .data_tools import JSONProcessorTool, CSVProcessorTool, XMLProcessorTool, TextProcessorTool
from .research_tools import CompanyResearchTool, MarketResearchTool
from .publishing_tools import (
	GrammarCheckerTool, PlagiarismDetectorTool, DocumentComparatorTool,
	CitationValidatorTool, DocumentFormatterTool, ReadabilityAnalyzerTool,
	FactCheckerTool, MetadataExtractorTool, ReportGeneratorTool, DeliveryPackagerTool
)


def setup_default_tools(download_dir: str = "/tmp/agent_downloads") -> ToolRegistry:
	"""
	Set up and register default tools with the tool registry
	
	Args:
		download_dir: Directory for file downloads
		
	Returns:
		Configured tool registry with all tools registered
	"""
	logger = logging.getLogger("tool_setup")
	registry = get_tool_registry()
	
	# Create download directory
	Path(download_dir).mkdir(exist_ok=True, parents=True)
	
	# Define tool configurations
	default_config = ToolConfig(
		timeout_seconds=30,
		max_retries=3,
		rate_limit=60  # 60 requests per minute
	)
	
	web_config = ToolConfig(
		timeout_seconds=15,
		max_retries=2,
		rate_limit=30  # More conservative for web tools
	)
	
	file_config = ToolConfig(
		timeout_seconds=10,
		max_retries=1,
		rate_limit=None  # No rate limit for file operations
	)
	
	# Web Tools
	tools_to_register = [
		# Web tools
		WebSearchTool(web_config),
		WebScrapeTool(web_config),
		DownloadTool(download_dir, web_config),
		URLValidatorTool(web_config),
		
		# File tools
		FileReadTool(file_config),
		FileWriteTool(file_config),
		DirectoryListTool(file_config),
		FileSearchTool(file_config),
		
		# Data processing tools
		JSONProcessorTool(default_config),
		CSVProcessorTool(default_config),
		XMLProcessorTool(default_config),
		TextProcessorTool(default_config),
		
		# Research tools
		CompanyResearchTool(default_config),
		MarketResearchTool(default_config),
		
		# Publishing & QA tools
		GrammarCheckerTool(default_config),
		PlagiarismDetectorTool(default_config),
		DocumentComparatorTool(default_config),
		CitationValidatorTool(default_config),
		DocumentFormatterTool(default_config),
		ReadabilityAnalyzerTool(default_config),
		FactCheckerTool(default_config),
		MetadataExtractorTool(default_config),
		ReportGeneratorTool(default_config),
		DeliveryPackagerTool(default_config),
	]
	
	# Register all tools
	registered_count = 0
	failed_count = 0
	
	for tool in tools_to_register:
		try:
			if registry.register_tool(tool):
				registered_count += 1
				logger.debug(f"Registered tool: {tool.name}")
			else:
				failed_count += 1
				logger.warning(f"Failed to register tool: {tool.name}")
		except Exception as e:
			failed_count += 1
			logger.error(f"Error registering tool {tool.name}: {e}")
	
	logger.info(f"Tool registration complete: {registered_count} registered, {failed_count} failed")
	
	return registry


def get_tool_registry_stats() -> Dict[str, int]:
	"""Get statistics about the tool registry"""
	registry = get_tool_registry()
	if not registry:
		return {"error": "Tool registry not available"}
	
	stats = registry.get_registry_stats()
	return {
		"total_tools": stats["total_tools"],
		"capabilities": len(stats["capabilities"]),
		"web_tools": stats["capabilities"].get("web_search", 0) + stats["capabilities"].get("web_scraping", 0),
		"file_tools": stats["capabilities"].get("file_operations", 0),
		"data_tools": stats["capabilities"].get("data_processing", 0),
		"research_tools": stats["capabilities"].get("research", 0)
	}


def list_available_tools() -> List[Dict[str, str]]:
	"""List all available tools with descriptions"""
	registry = get_tool_registry()
	if not registry:
		return []
	
	tools_info = []
	for tool_name in registry.list_tools():
		tool = registry.get_tool(tool_name)
		if tool:
			tools_info.append({
				"name": tool.name,
				"description": tool.description,
				"capabilities": [cap.value for cap in tool.capabilities],
				"enabled": tool.enabled
			})
	
	return sorted(tools_info, key=lambda x: x["name"])


async def test_tool_functionality() -> Dict[str, bool]:
	"""
	Test basic functionality of all registered tools
	
	Returns:
		Dictionary mapping tool names to success status
	"""
	logger = logging.getLogger("tool_testing")
	registry = get_tool_registry()
	
	if not registry:
		return {"error": "Tool registry not available"}
	
	test_results = {}
	
	# Test web search (if available)
	web_search_tool = registry.get_tool("web_search")
	if web_search_tool:
		try:
			result = await web_search_tool.safe_execute(query="test query", max_results=1)
			test_results["web_search"] = result.success
		except Exception as e:
			logger.warning(f"Web search test failed: {e}")
			test_results["web_search"] = False
	
	# Test URL field_validator
	url_validator_tool = registry.get_tool("url_field_validator")
	if url_validator_tool:
		try:
			result = await url_validator_tool.safe_execute(url="https://example.com", check_availability=False)
			test_results["url_field_validator"] = result.success
		except Exception as e:
			logger.warning(f"URL field_validator test failed: {e}")
			test_results["url_field_validator"] = False
	
	# Test JSON processor
	json_tool = registry.get_tool("json_processor")
	if json_tool:
		try:
			test_data = '{"test": "value"}'
			result = await json_tool.safe_execute(operation="parse", data=test_data)
			test_results["json_processor"] = result.success
		except Exception as e:
			logger.warning(f"JSON processor test failed: {e}")
			test_results["json_processor"] = False
	
	# Test text processor
	text_tool = registry.get_tool("text_processor")
	if text_tool:
		try:
			result = await text_tool.safe_execute(operation="word_count", text="This is a test sentence.")
			test_results["text_processor"] = result.success
		except Exception as e:
			logger.warning(f"Text processor test failed: {e}")
			test_results["text_processor"] = False
	
	# Test directory listing (current directory)
	dir_tool = registry.get_tool("directory_list")
	if dir_tool:
		try:
			result = await dir_tool.safe_execute(directory_path=".", recursive=False)
			test_results["directory_list"] = result.success
		except Exception as e:
			logger.warning(f"Directory list test failed: {e}")
			test_results["directory_list"] = False
	
	logger.info(f"Tool functionality tests completed: {test_results}")
	return test_results


# Initialize tools when module is imported
_tools_initialized = False

def ensure_tools_initialized():
	"""Ensure tools are initialized (called automatically)"""
	global _tools_initialized
	if not _tools_initialized:
		setup_default_tools()
		_tools_initialized = True


# Auto-initialize tools
ensure_tools_initialized()