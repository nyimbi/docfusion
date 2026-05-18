"""Webhook SSRF protections."""

import socket

import pytest

from docfusion.api.endpoints import webhook_endpoints as webhook_module
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


def test_webhook_post_connects_to_resolved_public_ip(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sent_requests: list[bytes] = []
    connection_targets: list[tuple[str, int]] = []

    def fake_getaddrinfo(*args: object, **kwargs: object) -> list[tuple]:
        del args, kwargs
        return [_addr_record("93.184.216.34")]

    class FakeSocket:
        def settimeout(self, timeout: int) -> None:
            self.timeout = timeout

        def __enter__(self) -> "FakeSocket":
            return self

        def __exit__(self, *args: object) -> None:
            del args

    class FakeTlsSocket(FakeSocket):
        def sendall(self, data: bytes) -> None:
            sent_requests.append(data)

    class FakeSslContext:
        def wrap_socket(
            self,
            sock: FakeSocket,
            *,
            server_hostname: str,
        ) -> FakeTlsSocket:
            assert sock is not None
            assert server_hostname == "hooks.example.com"
            return FakeTlsSocket()

    class FakeHTTPResponse:
        status = 202

        def __init__(self, sock: FakeTlsSocket) -> None:
            assert sock is not None

        def begin(self) -> None:
            return None

        def read(self, size: int) -> bytes:
            assert size == 1000
            return b"accepted"

    def fake_create_connection(
        target: tuple[str, int],
        timeout: int,
    ) -> FakeSocket:
        assert timeout == 5
        connection_targets.append(target)
        return FakeSocket()

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
    monkeypatch.setattr(socket, "create_connection", fake_create_connection)
    monkeypatch.setattr(
        webhook_module.ssl,
        "create_default_context",
        lambda: FakeSslContext(),
    )
    monkeypatch.setattr(webhook_module, "HTTPResponse", FakeHTTPResponse)

    response = webhook_module._post_webhook_json_sync(  # noqa: SLF001
        "https://hooks.example.com/webhook?source=test",
        {"ok": True},
        {"X-Test": "1"},
        5,
    )

    assert response.status_code == 202
    assert response.text == "accepted"
    assert connection_targets == [("93.184.216.34", 443)]
    assert b"POST /webhook?source=test HTTP/1.1" in sent_requests[0]
    assert b"Host: hooks.example.com" in sent_requests[0]
