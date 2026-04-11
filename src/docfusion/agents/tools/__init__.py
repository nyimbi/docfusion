"""
Agent Tools Module

Provides tools and utilities for agents to interact with external systems,
perform web searches, download content, process files, and execute tasks.

Author: Nyimbi Odero  
Company: Datacraft Ltd
Copyright (c) 2025
"""

from .base import (
    AgentTool,
    ToolResult,
    ToolRegistry,
    ToolCapability,
    ToolError,
    get_tool_registry
)

from .setup import (
    setup_default_tools,
    get_tool_registry_stats,
    list_available_tools,
    test_tool_functionality,
    ensure_tools_initialized
)

from .web_tools import (
    WebSearchTool,
    WebScrapeTool,
    DownloadTool,
    URLValidatorTool
)

from .file_tools import (
	FileReadTool,
	FileWriteTool,
	FileSearchTool,
)

from .data_tools import (
    JSONProcessorTool,
    CSVProcessorTool,
    XMLProcessorTool,
    TextProcessorTool
)

from .research_tools import (
	CompanyResearchTool,
	MarketResearchTool,
)

__all__ = [
    # Base framework
    "AgentTool",
    "ToolResult", 
    "ToolRegistry",
    "ToolCapability",
    "ToolError",
    "get_tool_registry",
    
    # Setup functions
    "setup_default_tools",
    "get_tool_registry_stats", 
    "list_available_tools",
    "test_tool_functionality",
    "ensure_tools_initialized",
    
    # Web tools
    "WebSearchTool",
    "WebScrapeTool", 
    "DownloadTool",
    "URLValidatorTool",
    
	# File tools
	"FileReadTool",
	"FileWriteTool",
	"FileSearchTool",
    
    # Data processing tools
    "JSONProcessorTool",
    "CSVProcessorTool",
    "XMLProcessorTool", 
    "TextProcessorTool",
    
	# Research tools
	"CompanyResearchTool",
	"MarketResearchTool",
]