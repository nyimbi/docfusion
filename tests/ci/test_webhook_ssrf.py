"""Webhook SSRF protections."""

import socket

import pytest

from docfusion.api.endpoints.webhook_endpoints import (
    UnsafeWebhookUrlError,
    WebhookEvent,
    WebhookEventType,
    WebhookManager,
    validate_public_webhook_url,
)


def _addr_record(address: str) -> tuple:
    family = socket.AF_INET6 if ":" in address else socket.AF_INET
    return (family, socket.SOCK_STREAM, 6, "", (address, 443))


def test_webhook_url_must_use_https() -> None:
    with pytest.raises(UnsafeWebhookUrlError, match="HTTPS"):
        validate_public_webhook_url("http://hooks.example.com/webhook")


def test_webhook_url_rejects_loopback_literal() -> None:
    with pytest.raises(UnsafeWebhookUrlError, match="non-public"):
        validate_public_webhook_url("https://127.0.0.1/webhook")


def test_webhook_url_rejects_private_dns_resolution(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_getaddrinfo(*args: object, **kwargs: object) -> list[tuple]:
        del args, kwargs
        return [_addr_record("10.0.0.5")]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)

    with pytest.raises(UnsafeWebhookUrlError, match="non-public"):
        validate_public_webhook_url("https://hooks.example.com/webhook")


def test_webhook_url_accepts_public_dns_resolution(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_getaddrinfo(*args: object, **kwargs: object) -> list[tuple]:
        del args, kwargs
        return [_addr_record("93.184.216.34")]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)

    assert (
        validate_public_webhook_url("https://hooks.example.com/webhook")
        == "https://hooks.example.com/webhook"
    )


@pytest.mark.asyncio
async def test_webhook_delivery_revalidates_target_before_send(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def disable_delivery_worker(self: WebhookManager) -> None:
        del self

    monkeypatch.setattr(WebhookManager, "_start_delivery_worker", disable_delivery_worker)

    def fake_getaddrinfo(*args: object, **kwargs: object) -> list[tuple]:
        del args, kwargs
        return [_addr_record("127.0.0.1")]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
    manager = WebhookManager(security_manager=object())
    webhook = {
        "webhook_id": "webhook-1",
        "url": "https://hooks.example.com/webhook",
        "headers": {},
        "secret": None,
        "timeout": 5,
        "retry_count": 0,
        "active": True,
        "failure_count": 0,
        "total_deliveries": 0,
        "successful_deliveries": 0,
    }
    event = WebhookEvent(
        event_type=WebhookEventType.SYSTEM_MAINTENANCE,
        data={"test": True},
    )

    await manager._process_webhook_delivery(  # noqa: SLF001
        {
            "delivery_id": "delivery-1",
            "webhook": webhook,
            "event": event,
            "attempt": 1,
            "max_attempts": 1,
        }
    )

    delivery = manager.deliveries["delivery-1"]
    assert delivery["status"].value == "failed"
    assert "non-public" in delivery["error_message"]
    assert webhook["total_deliveries"] == 1
