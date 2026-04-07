"""
File Operation Tools for Agents

Provides file system operations like read, write, copy, delete, search, etc.
"""

import logging
import os
import shutil
import json
import csv
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import mimetypes
import asyncio
import aiofiles
import re
from datetime import datetime

from .base import AgentTool, ToolResult, ToolCapability, ToolError, ToolConfig

logger = logging.getLogger(__name__)


class FileReadTool(AgentTool):
	"""
	Tool for reading files with support for various formats
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="file_read",
			description="Read files from the filesystem",
			capabilities=[ToolCapability.FILE_OPERATIONS, ToolCapability.DATA_PROCESSING],
			config=config
		)
		self.max_file_size_mb = 50  # Limit file size for safety
	
	async def execute(self, file_path: str, encoding: str = "utf-8", 
					 max_lines: Optional[int] = None, **kwargs) -> ToolResult:
		"""Execute file read operation"""
		
		try:
			path = Path(file_path)
			
			# Security check - prevent reading outside allowed directories
			if not self._is_safe_path(path):
				raise ToolError("Access to this path is not allowed", self.name, "ACCESS_DENIED")
			
			if not path.exists():
				raise ToolError(f"File not found: {file_path}", self.name, "FILE_NOT_FOUND")
			
			if not path.is_file():
				raise ToolError(f"Path is not a file: {file_path}", self.name, "NOT_A_FILE")
			
			# Check file size
			file_size = path.stat().st_size
			if file_size > self.max_file_size_mb * 1024 * 1024:
				raise ToolError(f"File too large: {file_size / (1024*1024):.1f}MB", 
							  self.name, "FILE_TOO_LARGE")
			
			# Determine file type
			mime_type, _ = mimetypes.guess_type(str(path))
			
			# Read file content
			if mime_type and mime_type.startswith('text/') or path.suffix in ['.txt', '.md', '.py', '.json', '.csv', '.xml', '.html']:
				content = await self._read_text_file(path, encoding, max_lines)
				result_data = {
					"content": content,
					"type": "text",
					"encoding": encoding,
					"line_count": content.count('\n') + 1 if content else 0
				}
			else:
				# Binary file - read as bytes and return base64
				content = await self._read_binary_file(path)
				result_data = {
					"content": content,
					"type": "binary", 
					"size_bytes": file_size
				}
			
			return ToolResult(
				success=True,
				data=result_data,
				tool_name=self.name,
				metadata={
					"file_path": str(path),
					"file_size": file_size,
					"mime_type": mime_type,
					"last_modified": datetime.fromtimestamp(path.stat().st_mtime).isoformat()
				}
			)
			
		except Exception as e:
			raise ToolError(f"File read failed: {str(e)}", self.name, "READ_ERROR")
	
	async def _read_text_file(self, path: Path, encoding: str, max_lines: Optional[int]) -> str:
		"""Read text file content"""
		async with aiofiles.open(path, 'r', encoding=encoding) as f:
			if max_lines:
				lines = []
				line_count = 0
				async for line in f:
					if line_count >= max_lines:
						break
					lines.append(line)
					line_count += 1
				return ''.join(lines)
			else:
				return await f.read()
	
	async def _read_binary_file(self, path: Path) -> str:
		"""Read binary file and encode as base64"""
		import base64
		async with aiofiles.open(path, 'rb') as f:
			content = await f.read()
			return base64.b64encode(content).decode('ascii')
	
	def _is_safe_path(self, path: Path) -> bool:
		"""Check if path is safe to access"""
		# Convert to absolute path
		abs_path = path.resolve()
		
		# Define allowed directories (customize as needed)
		allowed_dirs = [
			Path.cwd(),  # Current working directory
			Path.home() / "Documents",  # User documents
			Path("/tmp"),  # Temporary directory
		]
		
		# Check if path is within allowed directories
		for allowed_dir in allowed_dirs:
			try:
				abs_path.relative_to(allowed_dir.resolve())
				return True
			except ValueError:
				continue
		
		return False
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for file read"""
		return {
			"type": "object",
			"properties": {
				"file_path": {
					"type": "string",
					"description": "Path to file to read"
				},
				"encoding": {
					"type": "string",
					"default": "utf-8",
					"description": "Text encoding for the file"
				},
				"max_lines": {
					"type": "integer",
					"minimum": 1,
					"description": "Maximum number of lines to read"
				}
			},
			"required": ["file_path"]
		}


class FileWriteTool(AgentTool):
	"""
	Tool for writing files to the filesystem
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="file_write",
			description="Write content to files",
			capabilities=[ToolCapability.FILE_OPERATIONS],
			config=config
		)
	
	async def execute(self, file_path: str, content: str, encoding: str = "utf-8",
					 mode: str = "w", create_dirs: bool = True, **kwargs) -> ToolResult:
		"""Execute file write operation"""
		
		try:
			path = Path(file_path)
			
			# Security check
			if not self._is_safe_path(path):
				raise ToolError("Access to this path is not allowed", self.name, "ACCESS_DENIED")
			
			# Create parent directories if requested
			if create_dirs and not path.parent.exists():
				path.parent.mkdir(parents=True, exist_ok=True)
			
			# Write file
			async with aiofiles.open(path, mode, encoding=encoding) as f:
				await f.write(content)
			
			# Get file stats
			file_size = path.stat().st_size
			
			return ToolResult(
				success=True,
				data={
					"file_path": str(path),
					"bytes_written": len(content.encode(encoding)),
					"file_size": file_size,
					"created": not path.existed_before if hasattr(path, 'existed_before') else True
				},
				tool_name=self.name,
				metadata={
					"encoding": encoding,
					"mode": mode
				}
			)
			
		except Exception as e:
			raise ToolError(f"File write failed: {str(e)}", self.name, "WRITE_ERROR")
	
	def _is_safe_path(self, path: Path) -> bool:
		"""Check if path is safe to write to"""
		# Similar to read tool but may have different restrictions
		abs_path = path.resolve()
		
		# Define allowed write directories
		allowed_dirs = [
			Path.cwd(),
			Path.home() / "Documents",
			Path("/tmp"),
		]
		
		for allowed_dir in allowed_dirs:
			try:
				abs_path.relative_to(allowed_dir.resolve())
				return True
			except ValueError:
				continue
		
		return False
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for file write"""
		return {
			"type": "object",
			"properties": {
				"file_path": {
					"type": "string",
					"description": "Path where to write the file"
				},
				"content": {
					"type": "string",
					"description": "Content to write to the file"
				},
				"encoding": {
					"type": "string",
					"default": "utf-8",
					"description": "Text encoding for the file"
				},
				"mode": {
					"type": "string",
					"enum": ["w", "a", "x"],
					"default": "w",
					"description": "Write mode: w=overwrite, a=append, x=exclusive"
				},
				"create_dirs": {
					"type": "boolean",
					"default": True,
					"description": "Create parent directories if they don't exist"
				}
			},
			"required": ["file_path", "content"]
		}


class DirectoryListTool(AgentTool):
	"""
	Tool for listing directory contents
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="directory_list",
			description="List contents of directories",
			capabilities=[ToolCapability.FILE_OPERATIONS],
			config=config
		)
	
	async def execute(self, directory_path: str = ".", include_hidden: bool = False,
					 recursive: bool = False, max_depth: int = 3, **kwargs) -> ToolResult:
		"""Execute directory listing"""
		
		try:
			path = Path(directory_path)
			
			if not self._is_safe_path(path):
				raise ToolError("Access to this path is not allowed", self.name, "ACCESS_DENIED")
			
			if not path.exists():
				raise ToolError(f"Directory not found: {directory_path}", self.name, "DIR_NOT_FOUND")
			
			if not path.is_dir():
				raise ToolError(f"Path is not a directory: {directory_path}", self.name, "NOT_A_DIRECTORY")
			
			# List directory contents
			if recursive:
				items = await self._list_recursive(path, include_hidden, max_depth, 0)
			else:
				items = await self._list_single(path, include_hidden)
			
			return ToolResult(
				success=True,
				data={
					"directory": str(path),
					"items": items,
					"total_count": len(items)
				},
				tool_name=self.name,
				metadata={
					"recursive": recursive,
					"include_hidden": include_hidden
				}
			)
			
		except Exception as e:
			raise ToolError(f"Directory listing failed: {str(e)}", self.name, "LIST_ERROR")
	
	async def _list_single(self, path: Path, include_hidden: bool) -> List[Dict[str, Any]]:
		"""List single directory contents"""
		items = []
		
		for item in path.iterdir():
			if not include_hidden and item.name.startswith('.'):
				continue
			
			stat = item.stat()
			items.append({
				"name": item.name,
				"path": str(item),
				"type": "directory" if item.is_dir() else "file",
				"size": stat.st_size if item.is_file() else None,
				"modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
				"permissions": oct(stat.st_mode)[-3:],
				"mime_type": mimetypes.guess_type(str(item))[0] if item.is_file() else None
			})
		
		return sorted(items, key=lambda x: (x["type"], x["name"]))
	
	async def _list_recursive(self, path: Path, include_hidden: bool, max_depth: int, current_depth: int) -> List[Dict[str, Any]]:
		"""List directory contents recursively"""
		if current_depth >= max_depth:
			return []
		
		items = []
		
		for item in path.iterdir():
			if not include_hidden and item.name.startswith('.'):
				continue
			
			stat = item.stat()
			item_info = {
				"name": item.name,
				"path": str(item),
				"type": "directory" if item.is_dir() else "file",
				"size": stat.st_size if item.is_file() else None,
				"modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
				"depth": current_depth,
				"mime_type": mimetypes.guess_type(str(item))[0] if item.is_file() else None
			}
			
			items.append(item_info)
			
			# Recurse into subdirectories
			if item.is_dir() and current_depth < max_depth - 1:
				try:
					sub_items = await self._list_recursive(item, include_hidden, max_depth, current_depth + 1)
					items.extend(sub_items)
				except PermissionError:
					# Skip directories we can't access
					pass
		
		return items
	
	def _is_safe_path(self, path: Path) -> bool:
		"""Check if path is safe to list"""
		abs_path = path.resolve()
		
		# Define allowed directories
		allowed_dirs = [
			Path.cwd(),
			Path.home(),
			Path("/tmp"),
		]
		
		for allowed_dir in allowed_dirs:
			try:
				abs_path.relative_to(allowed_dir.resolve())
				return True
			except ValueError:
				continue
		
		return False
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for directory listing"""
		return {
			"type": "object",
			"properties": {
				"directory_path": {
					"type": "string",
					"default": ".",
					"description": "Path to directory to list"
				},
				"include_hidden": {
					"type": "boolean",
					"default": False,
					"description": "Include hidden files and directories"
				},
				"recursive": {
					"type": "boolean",
					"default": False,
					"description": "List contents recursively"
				},
				"max_depth": {
					"type": "integer",
					"default": 3,
					"minimum": 1,
					"maximum": 10,
					"description": "Maximum recursion depth"
				}
			}
		}


class FileSearchTool(AgentTool):
	"""
	Tool for searching files by name, content, or patterns
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="file_search",
			description="Search for files by name, content, or patterns",
			capabilities=[ToolCapability.FILE_OPERATIONS, ToolCapability.DATA_PROCESSING],
			config=config
		)
	
	async def execute(self, search_path: str = ".", search_term: str = "",
					 search_type: str = "name", file_pattern: str = "*",
					 case_sensitive: bool = False, max_results: int = 100, **kwargs) -> ToolResult:
		"""Execute file search"""
		
		try:
			path = Path(search_path)
			
			if not self._is_safe_path(path):
				raise ToolError("Access to this path is not allowed", self.name, "ACCESS_DENIED")
			
			if not path.exists():
				raise ToolError(f"Search path not found: {search_path}", self.name, "PATH_NOT_FOUND")
			
			# Perform search based on type
			if search_type == "name":
				results = await self._search_by_name(path, search_term, file_pattern, case_sensitive, max_results)
			elif search_type == "content":
				results = await self._search_by_content(path, search_term, file_pattern, case_sensitive, max_results)
			else:
				raise ToolError(f"Invalid search type: {search_type}", self.name, "INVALID_SEARCH_TYPE")
			
			return ToolResult(
				success=True,
				data={
					"search_path": str(path),
					"search_term": search_term,
					"search_type": search_type,
					"results": results,
					"result_count": len(results)
				},
				tool_name=self.name,
				metadata={
					"case_sensitive": case_sensitive,
					"file_pattern": file_pattern
				}
			)
			
		except Exception as e:
			raise ToolError(f"File search failed: {str(e)}", self.name, "SEARCH_ERROR")
	
	async def _search_by_name(self, path: Path, search_term: str, file_pattern: str, 
							case_sensitive: bool, max_results: int) -> List[Dict[str, Any]]:
		"""Search files by name"""
		results = []
		search_pattern = search_term if case_sensitive else search_term.lower()
		
		# Use glob pattern matching combined with name search
		for file_path in path.rglob(file_pattern):
			if len(results) >= max_results:
				break
			
			filename = file_path.name if case_sensitive else file_path.name.lower()
			
			if search_pattern in filename:
				stat = file_path.stat()
				results.append({
					"path": str(file_path),
					"name": file_path.name,
					"type": "directory" if file_path.is_dir() else "file",
					"size": stat.st_size if file_path.is_file() else None,
					"modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
					"match_type": "name"
				})
		
		return results
	
	async def _search_by_content(self, path: Path, search_term: str, file_pattern: str,
								case_sensitive: bool, max_results: int) -> List[Dict[str, Any]]:
		"""Search files by content"""
		results = []
		search_pattern = search_term if case_sensitive else search_term.lower()
		flags = 0 if case_sensitive else re.IGNORECASE
		search_regex = re.compile(re.escape(search_term), flags)
		
		# Search through text files
		for file_path in path.rglob(file_pattern):
			if len(results) >= max_results:
				break
			
			if not file_path.is_file():
				continue
			
			# Only search text files
			mime_type, _ = mimetypes.guess_type(str(file_path))
			if mime_type and not mime_type.startswith('text/') and file_path.suffix not in ['.txt', '.md', '.py', '.js', '.json', '.xml', '.html', '.css']:
				continue
			
			try:
				async with aiofiles.open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
					content = await f.read()
					matches = list(search_regex.finditer(content))
					
					if matches:
						stat = file_path.stat()
						
						# Get context around matches
						match_contexts = []
						for match in matches[:5]:  # Limit to first 5 matches per file
							start = max(0, match.start() - 50)
							end = min(len(content), match.end() + 50)
							context = content[start:end].strip()
							match_contexts.append({
								"line": content[:match.start()].count('\n') + 1,
								"context": context,
								"position": match.start()
							})
						
						results.append({
							"path": str(file_path),
							"name": file_path.name,
							"type": "file",
							"size": stat.st_size,
							"modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
							"match_type": "content",
							"match_count": len(matches),
							"matches": match_contexts
						})
						
			except Exception as e:
				logger.warning(f"Failed to read file {file_path}: {e}")
				continue
		
		return results
	
	def _is_safe_path(self, path: Path) -> bool:
		"""Check if path is safe to search"""
		abs_path = path.resolve()
		
		# Define allowed search directories
		allowed_dirs = [
			Path.cwd(),
			Path.home(),
			Path("/tmp"),
		]
		
		for allowed_dir in allowed_dirs:
			try:
				abs_path.relative_to(allowed_dir.resolve())
				return True
			except ValueError:
				continue
		
		return False
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for file search"""
		return {
			"type": "object",
			"properties": {
				"search_path": {
					"type": "string",
					"default": ".",
					"description": "Path to search in"
				},
				"search_term": {
					"type": "string",
					"description": "Term to search for"
				},
				"search_type": {
					"type": "string",
					"enum": ["name", "content"],
					"default": "name",
					"description": "Type of search: name or content"
				},
				"file_pattern": {
					"type": "string",
					"default": "*",
					"description": "File pattern to match (glob syntax)"
				},
				"case_sensitive": {
					"type": "boolean",
					"default": False,
					"description": "Case sensitive search"
				},
				"max_results": {
					"type": "integer",
					"default": 100,
					"minimum": 1,
					"maximum": 1000,
					"description": "Maximum number of results"
				}
			},
			"required": ["search_term"]
		}


# Additional file operation tools can be added here:
# FileCopyTool, FileDeleteTool, etc.