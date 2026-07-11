"""Coverage for top-level DocuFusion communication channels."""

from __future__ import annotations

import asyncio

import pytest

from docfusion.channels import ChannelRegistry, Event, InMemoryChannel


@pytest.mark.asyncio
async def test_in_memory_channel_publish_subscribe_round_trip():
	channel = InMemoryChannel()
	received: list[Event] = []
	delivered = asyncio.Event()

	async def handler(event: Event) -> None:
		received.append(event)
		delivered.set()

	channel.subscribe(handler)
	event = Event(event_type="agent.started", payload={"agent": "tiny"}, source_agent="tiny")

	await channel.publish(event)
	await asyncio.wait_for(delivered.wait(), timeout=1.0)

	assert received == [event]


def test_channel_registry_get_default_channel():
	channel = ChannelRegistry.get_channel("events")

	assert channel is ChannelRegistry.get_channel("events")
	assert hasattr(channel, "publish")
