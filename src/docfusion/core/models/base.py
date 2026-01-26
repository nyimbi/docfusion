"""
Base Models

Base entity and data structure definitions for the proposal writer system.
"""

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field, ConfigDict
from uuid import uuid4

def uuid7str():
    """Generate a UUID4 string (fallback for uuid7str)"""
    return str(uuid4())


class BaseEntity(BaseModel):
    """Base entity model for all proposal writer entities"""
    model_config = ConfigDict(extra='forbid', validate_by_name=True)
    
    id: str = Field(default_factory=uuid7str, description="Unique entity identifier")
    created_at: datetime = Field(default_factory=datetime.now, description="Entity creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.now, description="Entity last update timestamp")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    
    def update_timestamp(self):
        """Update the last modified timestamp"""
        self.updated_at = datetime.now()


class BaseResponse(BaseModel):
    """Base response model for API responses"""
    model_config = ConfigDict(extra='forbid', validate_by_name=True)
    
    success: bool = Field(description="Whether the operation was successful")
    message: Optional[str] = Field(None, description="Optional response message")
    timestamp: datetime = Field(default_factory=datetime.now, description="Response timestamp")


class BaseConfig(BaseModel):
    """Base configuration model"""
    model_config = ConfigDict(extra='forbid', validate_by_name=True)
    
    version: str = Field(default="1.0.0", description="Configuration version")
    environment: str = Field(default="development", description="Environment name")
    debug: bool = Field(default=False, description="Debug mode flag")