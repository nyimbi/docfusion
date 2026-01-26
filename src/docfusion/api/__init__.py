"""
API Package

FastAPI-based REST API for the proposal writer system with comprehensive
endpoints, middleware, validation, and documentation.
"""

__version__ = "1.0.0"
__author__ = "Proposal Writer Team"

from .main import APIApplication, create_api_application, create_app
from .endpoints.document_endpoints import DocumentEndpoints, create_document_endpoints
from .endpoints.template_endpoints import TemplateEndpoints, create_template_endpoints
from .middleware.authentication_middleware import AuthenticationMiddleware, get_current_user
from .middleware.rate_limiting_middleware import RateLimitingMiddleware, RateLimitRule
from .middleware.cors_middleware import CORSMiddleware, CORSConfiguration
from .serializers.document_serializers import (
	DocumentCreateRequest, DocumentUpdateRequest, DocumentResponse,
	DocumentListResponse, RenderRequest
)
from .serializers.template_serializers import (
	TemplateCreateRequest, TemplateUpdateRequest, TemplateResponse,
	TemplateListResponse, TemplateField
)
from .validators.input_validators import InputValidators, ValidationResult

__all__ = [
	# Main application
	"APIApplication", "create_api_application", "create_app",
	
	# Endpoints
	"DocumentEndpoints", "create_document_endpoints",
	"TemplateEndpoints", "create_template_endpoints",
	
	# Middleware
	"AuthenticationMiddleware", "get_current_user",
	"RateLimitingMiddleware", "RateLimitRule",
	"CORSMiddleware", "CORSConfiguration",
	
	# Serializers
	"DocumentCreateRequest", "DocumentUpdateRequest", "DocumentResponse",
	"DocumentListResponse", "RenderRequest",
	"TemplateCreateRequest", "TemplateUpdateRequest", "TemplateResponse",
	"TemplateListResponse", "TemplateField",
	
	# Validators
	"InputValidators", "ValidationResult"
]