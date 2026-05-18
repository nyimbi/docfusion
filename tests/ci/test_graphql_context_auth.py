import pytest

from docfusion.api.graphql.context import build_graphql_context


class FakeRequest:
	def __init__(self, authorization: str | None = None):
		self.headers = {}
		if authorization is not None:
			self.headers["Authorization"] = authorization


class FakeUserAuth:
	def __init__(self, payload=None, error: Exception | None = None):
		self.payload = payload or {}
		self.error = error
		self.tokens: list[str] = []

	async def verify_token(self, token: str):
		self.tokens.append(token)
		if self.error:
			raise self.error
		return self.payload


class FakeSecurityManager:
	def __init__(self, user_auth: FakeUserAuth):
		self.user_auth = user_auth


@pytest.mark.asyncio
async def test_graphql_context_uses_verified_bearer_token_payload():
	user_auth = FakeUserAuth(
		{
			"sub": "user-1",
			"username": "ada",
			"permissions": ["document:read"],
		}
	)
	security = FakeSecurityManager(user_auth)

	context = await build_graphql_context(
		FakeRequest("Bearer signed-token"),
		security,
		search_engine="search",
	)

	assert user_auth.tokens == ["signed-token"]
	assert context["security_manager"] is security
	assert context["search_engine"] == "search"
	assert context["user"]["user_id"] == "user-1"
	assert context["user"]["username"] == "ada"
	assert context["user"]["permissions"] == ["document:read"]


@pytest.mark.asyncio
async def test_graphql_context_does_not_create_user_for_invalid_token():
	security = FakeSecurityManager(FakeUserAuth(error=ValueError("bad token")))

	context = await build_graphql_context(
		FakeRequest("Bearer bad-token"),
		security,
	)

	assert "user" not in context


@pytest.mark.asyncio
async def test_graphql_context_rejects_token_without_user_identifier():
	security = FakeSecurityManager(FakeUserAuth({"permissions": ["document:read"]}))

	context = await build_graphql_context(
		FakeRequest("Bearer incomplete-token"),
		security,
	)

	assert "user" not in context
