"""Search infrastructure endpoint defaults."""

from docfusion.config.secrets import SecretsManager


def test_searxng_default_uses_public_search_host(monkeypatch):
	monkeypatch.delenv("SEARXNG_URL", raising=False)

	assert SecretsManager.get_searxng_url() == "https://search.lindela.io"


def test_searxng_env_override_is_still_honored(monkeypatch):
	monkeypatch.setenv("SEARXNG_URL", "http://localhost:8888")

	assert SecretsManager.get_searxng_url() == "http://localhost:8888"
