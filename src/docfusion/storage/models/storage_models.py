"""
Storage Data Models

Pydantic models for storage queries and results.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from ...core.utils import uuid7str


class StorageQuery(BaseModel):
	"""Query parameters for storage operations."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	query_id: str = Field(default_factory=uuid7str)
	filters: Dict[str, Any] = Field(default_factory=dict)
	sort_by: Optional[str] = None
	sort_order: str = "asc"
	limit: int = 100
	offset: int = 0


class StorageResult(BaseModel):
	"""Result of a storage operation."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	result_id: str = Field(default_factory=uuid7str)
	success: bool = True
	data: List[Dict[str, Any]] = Field(default_factory=list)
	total_count: int = 0
	error_message: Optional[str] = None


__all__ = ["StorageQuery", "StorageResult"]