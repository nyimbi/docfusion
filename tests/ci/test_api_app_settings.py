from importlib import import_module

from fastapi.testclient import TestClient

from docfusion.api.dependencies import ServiceContainer, ServiceSettings

api_app = import_module("docfusion.api.app")


def test_create_app_reuses_explicit_settings(monkeypatch):
	seen: dict[str, ServiceSettings] = {}

	async def initialize_services(settings: ServiceSettings) -> ServiceContainer:
		seen["settings"] = settings
		return ServiceContainer()

	async def initialize_endpoints(container: ServiceContainer) -> None:
		return None

	async def shutdown_services() -> None:
		return None

	settings = ServiceSettings(
		jwt_secret="test-secret",
		cors_allowed_origins=["https://example.test"],
	)

	monkeypatch.setattr(api_app, "initialize_services", initialize_services)
	monkeypatch.setattr(api_app, "initialize_endpoints", initialize_endpoints)
	monkeypatch.setattr(api_app, "shutdown_services", shutdown_services)

	app = api_app.create_app(settings=settings)

	with TestClient(app) as client:
		response = client.options(
			"/health",
			headers={
				"Origin": "https://example.test",
				"Access-Control-Request-Method": "GET",
			},
		)

	assert response.status_code == 200
	assert response.headers["access-control-allow-origin"] == "https://example.test"
	assert seen["settings"] is settings
	assert app.state.settings is settings
