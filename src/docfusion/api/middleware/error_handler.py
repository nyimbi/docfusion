"""
Global Error Handler

Centralized error handling for the DocuFusion API with consistent response formats.
"""

from __future__ import annotations

import logging
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError

logger = logging.getLogger(__name__)


# ============================================================================
# Custom Exception Classes
# ============================================================================

class APIError(Exception):
	"""
	Base API error with status code and details.

	All API errors should inherit from this class.
	"""

	def __init__(
		self,
		message: str,
		status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
		details: Optional[Dict[str, Any]] = None,
		error_code: Optional[str] = None,
	):
		self.message = message
		self.status_code = status_code
		self.details = details or {}
		self.error_code = error_code or self.__class__.__name__
		super().__init__(self.message)


class NotFoundError(APIError):
	"""Resource not found error."""

	def __init__(self, resource: str, resource_id: Optional[str] = None):
		message = f"{resource} not found"
		if resource_id:
			message = f"{resource} with ID '{resource_id}' not found"
		super().__init__(
			message=message,
			status_code=status.HTTP_404_NOT_FOUND,
			error_code="NOT_FOUND",
		)


class PermissionDeniedError(APIError):
	"""Permission denied error."""

	def __init__(self, action: Optional[str] = None, resource: Optional[str] = None):
		message = "Permission denied"
		if action and resource:
			message = f"Permission denied to {action} on {resource}"
		elif action:
			message = f"Permission denied for action: {action}"
		super().__init__(
			message=message,
			status_code=status.HTTP_403_FORBIDDEN,
			error_code="PERMISSION_DENIED",
		)


class ValidationError(APIError):
	"""Validation error with field-level details."""

	def __init__(
		self,
		message: str,
		field_errors: Optional[Dict[str, str]] = None,
		details: Optional[Dict[str, Any]] = None,
	):
		super().__init__(
			message=message,
			status_code=status.HTTP_400_BAD_REQUEST,
			details={
				**details,
				"field_errors": field_errors or {},
			} if details else {"field_errors": field_errors or {}},
			error_code="VALIDATION_ERROR",
		)


class AuthenticationError(APIError):
	"""Authentication required error."""

	def __init__(self, message: str = "Authentication required"):
		super().__init__(
			message=message,
			status_code=status.HTTP_401_UNAUTHORIZED,
			error_code="AUTHENTICATION_REQUIRED",
		)


class ConflictError(APIError):
	"""Resource conflict error."""

	def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
		super().__init__(
			message=message,
			status_code=status.HTTP_409_CONFLICT,
			details=details,
			error_code="CONFLICT",
		)


class RateLimitError(APIError):
	"""Rate limit exceeded error."""

	def __init__(
		self,
		retry_after: int = 60,
		message: str = "Rate limit exceeded",
	):
		super().__init__(
			message=message,
			status_code=status.HTTP_429_TOO_MANY_REQUESTS,
			details={"retry_after": retry_after},
			error_code="RATE_LIMIT_EXCEEDED",
		)


class ServiceUnavailableError(APIError):
	"""Service temporarily unavailable error."""

	def __init__(
		self,
		service: str,
		message: Optional[str] = None,
		retry_after: Optional[int] = None,
	):
		details = {"service": service}
		if retry_after:
			details["retry_after"] = retry_after

		super().__init__(
			message=message or f"Service '{service}' is temporarily unavailable",
			status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
			details=details,
			error_code="SERVICE_UNAVAILABLE",
		)


# ============================================================================
# Error Response Builder
# ============================================================================

def build_error_response(
	request: Request,
	status_code: int,
	message: str,
	details: Optional[Dict[str, Any]] = None,
	error_code: Optional[str] = None,
) -> JSONResponse:
	"""Build a standardized error response."""

	body = {
		"error": {
			"message": message,
			"code": error_code or "INTERNAL_ERROR",
			"status_code": status_code,
			"timestamp": datetime.now(timezone.utc).isoformat(),
			"path": str(request.url.path),
		}
	}

	if details:
		body["error"]["details"] = details

	# Include traceback in development
	if not _is_production():
		body["error"]["request_id"] = getattr(request.state, "request_id", None)

	return JSONResponse(
		status_code=status_code,
		content=body,
	)


# ============================================================================
# Exception Handlers
# ============================================================================

def register_error_handlers(app: FastAPI) -> None:
	"""Register all error handlers with the FastAPI app."""

	@app.exception_handler(APIError)
	async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
		"""Handle custom API errors."""
		logger.warning(
			f"API Error: {exc.error_code} - {exc.message}",
			extra={
				"status_code": exc.status_code,
				"path": str(request.url.path),
				"details": exc.details,
			},
		)

		return build_error_response(
			request=request,
			status_code=exc.status_code,
			message=exc.message,
			details=exc.details,
			error_code=exc.error_code,
		)

	@app.exception_handler(PydanticValidationError)
	async def validation_error_handler(
		request: Request,
		exc: PydanticValidationError,
	) -> JSONResponse:
		"""Handle Pydantic validation errors."""
		field_errors = {}
		for error in exc.errors():
			field = ".".join(str(loc) for loc in error.get("loc", []))
			field_errors[field] = error.get("msg", "Invalid value")

		logger.warning(
			f"Validation Error: {len(field_errors)} field(s)",
			extra={"path": str(request.url.path), "fields": field_errors},
		)

		return build_error_response(
			request=request,
			status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
			message="Validation error",
			details={"field_errors": field_errors},
			error_code="VALIDATION_ERROR",
		)

	@app.exception_handler(status.HTTP_404_NOT_FOUND)
	async def not_found_handler(request: Request, exc: Exception) -> JSONResponse:
		"""Handle 404 Not Found errors."""
		return build_error_response(
			request=request,
			status_code=status.HTTP_404_NOT_FOUND,
			message=f"Path '{request.url.path}' not found",
			error_code="NOT_FOUND",
		)

	@app.exception_handler(status.HTTP_405_METHOD_NOT_ALLOWED)
	async def method_not_allowed_handler(
		request: Request,
		exc: Exception,
	) -> JSONResponse:
		"""Handle 405 Method Not Allowed errors."""
		return build_error_response(
			request=request,
			status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
			message=f"Method '{request.method}' not allowed",
			error_code="METHOD_NOT_ALLOWED",
		)

	@app.exception_handler(Exception)
	async def general_error_handler(request: Request, exc: Exception) -> JSONResponse:
		"""Handle unexpected errors."""
		# Log full traceback
		logger.error(
			f"Unexpected error: {exc}",
			extra={
				"path": str(request.url.path),
				"method": request.method,
			},
		)
		logger.error(traceback.format_exc())

		# In production, hide error details
		from ...config.secrets import SecretsManager
		if SecretsManager.is_production():
			message = "Internal server error"
			details = None
		else:
			message = str(exc)
			details = {
				"traceback": traceback.format_exc(),
				"type": type(exc).__name__,
			}

		return build_error_response(
			request=request,
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			message=message,
			details=details,
			error_code="INTERNAL_ERROR",
		)


# ============================================================================
# Utility Functions
# ============================================================================

def raise_not_found(resource: str, resource_id: Optional[str] = None) -> None:
	"""
	Convenience function to raise NotFoundError.

	Usage:
		if not document:
			raise_not_found("Document", document_id)
	"""
	raise NotFoundError(resource, resource_id)


def raise_permission_denied(
	action: Optional[str] = None,
	resource: Optional[str] = None,
) -> None:
	"""
	Convenience function to raise PermissionDeniedError.

	Usage:
		if not user.has_permission("write", document):
			raise_permission_denied("write", "document")
	"""
	raise PermissionDeniedError(action, resource)


def raise_validation_error(
	message: str,
	field_errors: Optional[Dict[str, str]] = None,
) -> None:
	"""
	Convenience function to raise ValidationError.

	Usage:
		if not valid:
			raise_validation_error("Invalid input", {"email": "Invalid email format"})
	"""
	raise ValidationError(message, field_errors)