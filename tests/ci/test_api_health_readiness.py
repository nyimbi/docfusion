"""Health endpoint readiness reporting tests."""

from importlib import import_module

from fastapi import APIRouter
from fastapi.testclient import TestClient

from docfusion.api.dependencies import ServiceContainer, ServiceSettings

api_app = import_module("docfusion.api.app")


async def _noop_shutdown() -> None:
	return None


async def _noop_initialize_endpoints(container: ServiceContainer) -> ServiceContainer:
	return container


def _ready_container() -> ServiceContainer:
	container = ServiceContainer()

	async def websocket_endpoint(websocket: object) -> None:
		del websocket

	for attr in (
		"database_connection",
		"database_session",
		"security_manager",
		"storage_service",
		"document_engine",
		"searxng_client",
		"firecrawl_client",
		"litellm_client",
	):
		setattr(container, attr, object())
	for attr in (
		"document_endpoints",
		"template_endpoints",
		"search_endpoints",
		"batch_endpoints",
		"collaboration_endpoints",
		"webhook_endpoints",
	):
		setattr(container, attr, type("EndpointStub", (), {"router": APIRouter()})())
	container.websocket_endpoints = type("WebSocketEndpointStub", (), {})()
	container.websocket_endpoints.websocket_endpoint = websocket_endpoint
	return container


def test_health_reports_unhealthy_when_critical_services_missing(monkeypatch) -> None:
	async def initialize_services(settings: ServiceSettings) -> ServiceContainer:
		del settings
		return ServiceContainer()

	monkeypatch.setattr(api_app, "initialize_services", initialize_services)
	monkeypatch.setattr(api_app, "initialize_endpoints", _noop_initialize_endpoints)
	monkeypatch.setattr(api_app, "shutdown_services", _noop_shutdown)

	app = api_app.create_app(settings=ServiceSettings(jwt_secret="test-secret"))
	with TestClient(app) as client:
		response = client.get("/health")

	assert response.status_code == 503
	payload = response.json()
	assert payload["status"] == "unhealthy"
	assert "database_connection" in payload["missing_critical"]
	assert payload["services"]["database_connection"] == "unavailable"


def test_health_reports_ready_container_as_healthy(monkeypatch) -> None:
	async def initialize_services(settings: ServiceSettings) -> ServiceContainer:
		del settings
		return _ready_container()

	monkeypatch.setattr(api_app, "initialize_services", initialize_services)
	monkeypatch.setattr(api_app, "initialize_endpoints", _noop_initialize_endpoints)
	monkeypatch.setattr(api_app, "shutdown_services", _noop_shutdown)

	app = api_app.create_app(settings=ServiceSettings(jwt_secret="test-secret"))
	with TestClient(app) as client:
		response = client.get("/health")

	assert response.status_code == 200
	payload = response.json()
	assert payload["status"] == "healthy"
	assert payload["missing_critical"] == []
