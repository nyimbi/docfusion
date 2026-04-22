"""Smoke test for centralized Docling config in SecretsManager."""

from docfusion.config.secrets import SecretsManager


def test_get_docling_url_returns_string():
	url = SecretsManager.get_docling_url()
	assert isinstance(url, str)
	assert url.startswith("http")


def test_get_docling_timeout_returns_int():
	timeout = SecretsManager.get_docling_timeout()
	assert isinstance(timeout, int)
	assert timeout > 0


def test_requirement_extractor_uses_secrets_manager():
	from docfusion.rfp.requirement_extractor import RequirementExtractor
	extractor = RequirementExtractor()
	assert extractor.config["docling_service_url"] == SecretsManager.get_docling_url()
	assert extractor.config["docling_timeout"] == SecretsManager.get_docling_timeout()
