"""
Base Tool Framework for Agents

Defines the fundamental tool interfaces and registry for agent tool usage.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

class ToolCapability(str, Enum):
    """Tool capability categories"""

    WEB_SEARCH = "web_search"
    WEB_SCRAPING = "web_scraping"
    FILE_OPERATIONS = "file_operations"
    DATA_PROCESSING = "data_processing"
    RESEARCH = "research"
    DOWNLOAD = "download"
    API_INTEGRATION = "api_integration"
    DATABASE = "database"
    COMMUNICATION = "communication"

class ToolError(Exception):
    """Base exception for tool errors"""

    def __init__(self, message: str, tool_name: str, error_code: str = "TOOL_ERROR"):
        self.message = message
        self.tool_name = tool_name
        self.error_code = error_code
        super().__init__(f"{tool_name}: {message}")

@dataclass
class ToolResult:
    """Result returned by tool execution"""

    success: bool
    data: Any = None
    error_message: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    execution_time: float = 0.0
    tool_name: str = ""
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary"""
        return {
            "success": self.success,
            "data": self.data,
            "error_message": self.error_message,
            "metadata": self.metadata,
            "execution_time": self.execution_time,
            "tool_name": self.tool_name,
            "timestamp": self.timestamp.isoformat(),
        }

class ToolConfig(BaseModel):
    """Configuration for a tool"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    enabled: bool = True
    timeout_seconds: int = 30
    max_retries: int = 3
    rate_limit: Optional[int] = None  # requests per minute
    custom_settings: Dict[str, Any] = Field(default_factory=dict)

class AgentTool(ABC):
    """
    Base class for all agent tools

    Tools provide specific capabilities to agents like web search,
    file operations, data processing, etc.
    """

    def __init__(
        self,
        name: str,
        description: str,
        capabilities: List[ToolCapability],
        config: Optional[ToolConfig] = None,
    ):
        self.name = name
        self.description = description
        self.capabilities = capabilities
        self.config = config or ToolConfig()
        self.logger = logging.getLogger(f"tool.{name}")

        # Tool state
        self.enabled = self.config.enabled
        self.usage_count = 0
        self.error_count = 0
        self.last_used = None

        # Rate limiting
        self._rate_limit_queue: List[datetime] = []

    @abstractmethod
    async def execute(self, **kwargs) -> ToolResult:
        """Execute the tool with provided parameters"""
        pass

    @abstractmethod
    def get_parameters_schema(self) -> Dict[str, Any]:
        """Get the parameters schema for this tool"""
        pass

    def validate_parameters(self, parameters: Dict[str, Any]) -> bool:
        """Validate parameters against the tool's schema"""
        # Basic validation - override for specific validation logic
        schema = self.get_parameters_schema()
        required_params = schema.get("required", [])

        # Check required parameters
        for param in required_params:
            if param not in parameters:
                raise ToolError(
                    f"Missing required parameter: {param}", self.name, "MISSING_PARAM"
                )

        return True

    async def safe_execute(self, **kwargs) -> ToolResult:
        """Safely execute tool with error handling and rate limiting"""
        if not self.enabled:
            return ToolResult(
                success=False, error_message="Tool is disabled", tool_name=self.name
            )

        # Check rate limiting
        if not self._check_rate_limit():
            return ToolResult(
                success=False,
                error_message="Rate limit exceeded",
                tool_name=self.name,
                metadata={"rate_limit": self.config.rate_limit},
            )

        start_time = datetime.now()

        try:
            # Validate parameters
            self.validate_parameters(kwargs)

            # Execute with timeout and retries
            result = await self._execute_with_retries(**kwargs)

            # Update usage statistics
            self.usage_count += 1
            self.last_used = datetime.now()

            return result

        except ToolError as e:
            self.error_count += 1
            self.logger.error(f"Tool error: {e.message}")
            return ToolResult(
                success=False,
                error_message=e.message,
                tool_name=self.name,
                metadata={"error_code": e.error_code},
            )
        except Exception as e:
            self.error_count += 1
            self.logger.error(f"Unexpected tool error: {e}")
            return ToolResult(
                success=False,
                error_message=str(e),
                tool_name=self.name,
                metadata={"error_type": "UNEXPECTED_ERROR"},
            )
        finally:
            execution_time = (datetime.now() - start_time).total_seconds()
            self.logger.debug(f"Tool {self.name} executed in {execution_time:.2f}s")

    async def _execute_with_retries(self, **kwargs) -> ToolResult:
        """Execute tool with retry logic"""
        last_error = None

        for attempt in range(self.config.max_retries + 1):
            try:
                # Execute with timeout
                result = await asyncio.wait_for(
                    self.execute(**kwargs), timeout=self.config.timeout_seconds
                )
                return result

            except asyncio.TimeoutError:
                last_error = ToolError(
                    f"Tool execution timed out after {self.config.timeout_seconds}s",
                    self.name,
                    "TIMEOUT",
                )
                if attempt < self.config.max_retries:
                    await asyncio.sleep(2**attempt)  # Exponential backoff

            except Exception as e:
                last_error = e
                if attempt < self.config.max_retries:
                    await asyncio.sleep(2**attempt)

        # All retries failed
        if last_error:
            raise last_error

        raise ToolError("All retry attempts failed", self.name, "MAX_RETRIES_EXCEEDED")

    def _check_rate_limit(self) -> bool:
        """Check if tool usage is within rate limit"""
        if not self.config.rate_limit:
            return True

        now = datetime.now()

        # Clean old entries (older than 1 minute)
        self._rate_limit_queue = [
            ts for ts in self._rate_limit_queue if (now - ts).total_seconds() < 60
        ]

        # Check if we're within rate limit
        if len(self._rate_limit_queue) >= self.config.rate_limit:
            return False

        # Add current request
        self._rate_limit_queue.append(now)
        return True

    def get_usage_stats(self) -> Dict[str, Any]:
        """Get tool usage statistics"""
        return {
            "usage_count": self.usage_count,
            "error_count": self.error_count,
            "error_rate": self.error_count / max(self.usage_count, 1),
            "last_used": self.last_used.isoformat() if self.last_used else None,
            "enabled": self.enabled,
        }

    def enable(self):
        """Enable the tool"""
        self.enabled = True
        self.logger.info(f"Tool {self.name} enabled")

    def disable(self):
        """Disable the tool"""
        self.enabled = False
        self.logger.info(f"Tool {self.name} disabled")

class ToolRegistry:
    """
    Registry for managing agent tools

    Allows agents to discover, register, and use tools dynamically.
    """

    def __init__(self):
        self.tools: Dict[str, AgentTool] = {}
        self.tool_categories: Dict[ToolCapability, List[str]] = {}
        self.logger = logging.getLogger("tool_registry")

    def register_tool(self, tool: AgentTool) -> bool:
        """Register a tool in the registry"""
        try:
            if tool.name in self.tools:
                self.logger.warning(f"Tool {tool.name} already registered, overwriting")

            self.tools[tool.name] = tool

            # Update capability categories
            for capability in tool.capabilities:
                if capability not in self.tool_categories:
                    self.tool_categories[capability] = []
                if tool.name not in self.tool_categories[capability]:
                    self.tool_categories[capability].append(tool.name)

            self.logger.info(f"Registered tool: {tool.name}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to register tool {tool.name}: {e}")
            return False

    def unregister_tool(self, tool_name: str) -> bool:
        """Unregister a tool from the registry"""
        if tool_name not in self.tools:
            return False

        tool = self.tools[tool_name]

        # Remove from categories
        for capability in tool.capabilities:
            if capability in self.tool_categories:
                if tool_name in self.tool_categories[capability]:
                    self.tool_categories[capability].remove(tool_name)

        del self.tools[tool_name]
        self.logger.info(f"Unregistered tool: {tool_name}")
        return True

    def get_tool(self, tool_name: str) -> Optional[AgentTool]:
        """Get a tool by name"""
        return self.tools.get(tool_name)

    def get_tools_by_capability(self, capability: ToolCapability) -> List[AgentTool]:
        """Get all tools that have a specific capability"""
        tool_names = self.tool_categories.get(capability, [])
        return [self.tools[name] for name in tool_names if name in self.tools]

    def list_tools(self) -> List[str]:
        """List all registered tool names"""
        return list(self.tools.keys())

    def list_capabilities(self) -> List[ToolCapability]:
        """List all available capabilities"""
        return list(self.tool_categories.keys())

    async def execute_tool(self, tool_name: str, **kwargs) -> ToolResult:
        """Execute a tool by name"""
        tool = self.get_tool(tool_name)
        if not tool:
            return ToolResult(
                success=False,
                error_message=f"Tool '{tool_name}' not found",
                tool_name=tool_name,
            )

        return await tool.safe_execute(**kwargs)

    def get_registry_stats(self) -> Dict[str, Any]:
        """Get registry statistics"""
        return {
            "total_tools": len(self.tools),
            "capabilities": {
                cap.value: len(tools) for cap, tools in self.tool_categories.items()
            },
            "tool_stats": {
                name: tool.get_usage_stats() for name, tool in self.tools.items()
            },
        }

# Global tool registry instance
_tool_registry: Optional[ToolRegistry] = None

def get_tool_registry() -> ToolRegistry:
    """Get the global tool registry instance"""
    global _tool_registry
    if _tool_registry is None:
        _tool_registry = ToolRegistry()
    return _tool_registry
