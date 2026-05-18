"""GraphQL request context construction."""

from __future__ import annotations

import logging
from typing import Any, Dict

from ...security import SecurityManager

logger = logging.getLogger(__name__)


async def build_graphql_context(
	request,
	security_manager: SecurityManager,
	search_engine=None,
) -> Dict[str, Any]:
	"""Build GraphQL context with authenticated user details when present."""
	context = {
		"request": request,
		"security_manager": security_manager,
		"search_engine": search_engine,
	}

	auth_header = request.headers.get("Authorization")
	if auth_header and auth_header.startswith("Bearer "):
		token = auth_header[7:]
		try:
			payload = await security_manager.user_auth.verify_token(token)
			user_id = payload.get("sub") or payload.get("user_id")
			if not user_id:
				raise ValueError("Token payload missing user identifier")

			context["user"] = {
				"user_id": user_id,
				"username": payload.get("username") or payload.get("preferred_username") or user_id,
				"permissions": payload.get("permissions", []),
				"token_payload": payload,
			}
		except Exception as e:
			logger.warning(f"Invalid authentication token: {e}")

	return context
