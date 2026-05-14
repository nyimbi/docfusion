"""
Tests for CompositionRunner retry logic functionality.

This module tests the retry mechanism with exponential backoff,
jitter, configurable retry conditions, and comprehensive error handling.
"""

import asyncio
import pytest
import time
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Dict, Any

from docfusion.experimental.composition.runner import (
	CompositionRunner, 
	ExecutionStatus, 
	NodeExecutionResult,
	CompositionRunnerError,
	ExecutionContext
)
from docfusion.experimental.composition.interpreter import (
	ExecutionNode, 
	NodeType,
	InterpretedComposition
)


class TestCompositionRunnerRetry:
	"""Test suite for retry logic in CompositionRunner."""
	
	@pytest.fixture
	def runner(self):
		"""Create CompositionRunner instance for testing."""
		return CompositionRunner(max_workers=2, enable_monitoring=True)
	
	@pytest.fixture
	def mock_context(self):
		"""Create mock execution context."""
		return ExecutionContext(
			execution_id="test-exec-123",
			composition_id="test-comp-123",
			input_data={"test": "data"},
			variables={}
		)
	
	@pytest.fixture
	def failing_node(self):
		"""Create a node that's configured to fail and retry."""
		return ExecutionNode(
			node_id="test-node-1",
			node_type=NodeType.FUNCTION,
			function_name="test_failing_function",
			parameters={"param1": "value1"},
			retry_config={
				'max_attempts': 3,
				'base_delay': 0.1,  # Short delay for testing
				'max_delay': 1.0,
				'backoff_factor': 2.0,
				'jitter': False,  # Disable jitter for predictable tests
				'retry_on': ['Exception']
			}
		)
	
	@pytest.fixture
	def non_retry_node(self):
		"""Create a node with no retry configuration."""
		return ExecutionNode(
			node_id="test-node-2",
			node_type=NodeType.FUNCTION,
			function_name="test_function",
			parameters={"param1": "value1"},
			retry_config={}  # No retry configured
		)

	@pytest.mark.asyncio
	async def test_retry_success_on_second_attempt(self, runner, mock_context, failing_node):
		"""Test successful execution after one retry."""
		# Mock function that fails once then succeeds
		call_count = 0
		
		async def mock_failing_function(*args, **kwargs):
			nonlocal call_count
			call_count += 1
			if call_count == 1:
				raise ConnectionError("Network timeout")
			return {"success": True, "attempt": call_count}
		
		runner.register_function("test_failing_function", mock_failing_function)
		
		# Execute the node
		result = await runner._execute_node("test-node-1", failing_node, mock_context)
		
		# Assertions
		assert result.status == ExecutionStatus.COMPLETED
		assert result.output == {"success": True, "attempt": 2}
		assert 'retry_metadata' in result.metadata
		
		retry_metadata = result.metadata['retry_metadata']
		assert retry_metadata['attempts'] == 2
		assert retry_metadata['success_after_retries'] is True
		assert retry_metadata['successful_attempt'] == 2
		assert len(retry_metadata['errors']) == 1
		assert "Network timeout" in retry_metadata['errors'][0]
	
	@pytest.mark.asyncio
	async def test_retry_failure_after_max_attempts(self, runner, mock_context, failing_node):
		"""Test failure after exhausting all retry attempts."""
		# Mock function that always fails
		async def mock_always_failing_function(*args, **kwargs):
			raise ValueError("Persistent error")
		
		runner.register_function("test_failing_function", mock_always_failing_function)
		
		# Execute the node
		result = await runner._execute_node("test-node-1", failing_node, mock_context)
		
		# Assertions
		assert result.status == ExecutionStatus.FAILED
		assert "Persistent error" in result.error
		assert 'retry_metadata' in result.metadata
		
		retry_metadata = result.metadata['retry_metadata']
		assert retry_metadata['attempts'] == 3  # max_attempts
		assert retry_metadata['all_attempts_failed'] is True
		assert len(retry_metadata['errors']) == 3
		assert all("Persistent error" in error for error in retry_metadata['errors'])
	
	@pytest.mark.asyncio
	async def test_no_retry_on_first_success(self, runner, mock_context, failing_node):
		"""Test no retry when function succeeds on first attempt."""
		# Mock function that succeeds immediately
		async def mock_success_function(*args, **kwargs):
			return {"success": True, "attempt": 1}
		
		runner.register_function("test_failing_function", mock_success_function)
		
		# Execute the node
		result = await runner._execute_node("test-node-1", failing_node, mock_context)
		
		# Assertions
		assert result.status == ExecutionStatus.COMPLETED
		assert result.output == {"success": True, "attempt": 1}
		assert 'retry_metadata' not in result.metadata  # No retry was needed
	
	@pytest.mark.asyncio
	async def test_no_retry_configuration(self, runner, mock_context, non_retry_node):
		"""Test that nodes without retry config fail immediately."""
		# Mock function that always fails
		async def mock_failing_function(*args, **kwargs):
			raise RuntimeError("Immediate failure")
		
		runner.register_function("test_function", mock_failing_function)
		
		# Execute the node
		result = await runner._execute_node("test-node-2", non_retry_node, mock_context)
		
		# Assertions
		assert result.status == ExecutionStatus.FAILED
		assert "Immediate failure" in result.error
		assert 'retry_metadata' not in result.metadata  # No retry attempted
	
	@pytest.mark.asyncio
	async def test_exponential_backoff_timing(self, runner, mock_context):
		"""Test exponential backoff timing behavior."""
		node = ExecutionNode(
			node_id="test-timing-node",
			node_type=NodeType.FUNCTION,
			function_name="test_timing_function",
			retry_config={
				'max_attempts': 4,
				'base_delay': 0.1,
				'backoff_factor': 2.0,
				'jitter': False,  # Disable jitter for predictable timing
				'retry_on': ['Exception']
			}
		)
		
		call_times = []
		
		async def mock_timing_function(*args, **kwargs):
			call_times.append(time.time())
			if len(call_times) < 3:  # Fail first 2 attempts
				raise TimeoutError("Timeout")
			return {"success": True}
		
		runner.register_function("test_timing_function", mock_timing_function)
		
		start_time = time.time()
		result = await runner._execute_node("test-timing-node", node, mock_context)
		
		# Verify success
		assert result.status == ExecutionStatus.COMPLETED
		assert len(call_times) == 3
		
		# Verify exponential backoff timing (approximately)
		# First retry after ~0.1s, second retry after ~0.2s
		time_diffs = [call_times[i+1] - call_times[i] for i in range(len(call_times)-1)]
		assert 0.08 <= time_diffs[0] <= 0.15  # ~0.1s ± tolerance
		assert 0.18 <= time_diffs[1] <= 0.25  # ~0.2s ± tolerance
	
	@pytest.mark.asyncio
	async def test_retry_with_jitter(self, runner, mock_context):
		"""Test retry with jitter enabled."""
		node = ExecutionNode(
			node_id="test-jitter-node",
			node_type=NodeType.FUNCTION,
			function_name="test_jitter_function",
			retry_config={
				'max_attempts': 3,
				'base_delay': 0.2,
				'jitter': True,  # Enable jitter
				'retry_on': ['Exception']
			}
		)
		
		call_times = []
		
		async def mock_jitter_function(*args, **kwargs):
			call_times.append(time.time())
			if len(call_times) < 2:  # Fail first attempt
				raise ConnectionError("Connection lost")
			return {"success": True}
		
		runner.register_function("test_jitter_function", mock_jitter_function)
		
		result = await runner._execute_node("test-jitter-node", node, mock_context)
		
		# Verify success and that retry occurred
		assert result.status == ExecutionStatus.COMPLETED
		assert len(call_times) == 2
		
		# With jitter, delay should be between 50% and 100% of calculated delay
		time_diff = call_times[1] - call_times[0]
		expected_min = 0.2 * 0.5  # 50% of base delay
		expected_max = 0.2 * 1.0  # 100% of base delay
		assert expected_min <= time_diff <= expected_max + 0.05  # Small tolerance
	
	@pytest.mark.asyncio
	async def test_selective_retry_on_exception_types(self, runner, mock_context):
		"""Test retry only occurs for specified exception types."""
		node = ExecutionNode(
			node_id="test-selective-node",
			node_type=NodeType.FUNCTION,
			function_name="test_selective_function",
			retry_config={
				'max_attempts': 3,
				'base_delay': 0.1,
				'retry_on': ['ConnectionError', 'TimeoutError']  # Only retry these
			}
		)
		
		# Test 1: Exception type in retry list should retry
		async def mock_retryable_function(*args, **kwargs):
			raise ConnectionError("Should retry this")
		
		runner.register_function("test_selective_function", mock_retryable_function)
		result = await runner._execute_node("test-selective-node", node, mock_context)
		
		assert result.status == ExecutionStatus.FAILED
		assert 'retry_metadata' in result.metadata
		assert result.metadata['retry_metadata']['attempts'] == 3
		
		# Test 2: Exception type not in retry list should not retry
		async def mock_non_retryable_function(*args, **kwargs):
			raise ValueError("Should not retry this")
		
		runner.register_function("test_selective_function", mock_non_retryable_function)
		result = await runner._execute_node("test-selective-node", node, mock_context)
		
		assert result.status == ExecutionStatus.FAILED
		assert 'retry_metadata' not in result.metadata  # No retry should occur
	
	@pytest.mark.asyncio
	async def test_max_delay_cap(self, runner, mock_context):
		"""Test that delay is capped at max_delay."""
		node = ExecutionNode(
			node_id="test-maxdelay-node",
			node_type=NodeType.FUNCTION,
			function_name="test_maxdelay_function",
			retry_config={
				'max_attempts': 4,
				'base_delay': 0.5,
				'max_delay': 0.8,  # Cap delay
				'backoff_factor': 3.0,  # High backoff factor
				'jitter': False
			}
		)
		
		call_times = []
		
		async def mock_maxdelay_function(*args, **kwargs):
			call_times.append(time.time())
			if len(call_times) < 3:  # Fail first 2 attempts
				raise RuntimeError("Max delay test")
			return {"success": True}
		
		runner.register_function("test_maxdelay_function", mock_maxdelay_function)
		
		result = await runner._execute_node("test-maxdelay-node", node, mock_context)
		
		assert result.status == ExecutionStatus.COMPLETED
		assert len(call_times) == 3
		
		# Check delays don't exceed max_delay
		retry_metadata = result.metadata['retry_metadata']
		for delay in retry_metadata['retry_delays']:
			assert delay <= 0.8 + 0.05  # max_delay + small tolerance
	
	@pytest.mark.asyncio
	async def test_retry_metadata_completeness(self, runner, mock_context, failing_node):
		"""Test that retry metadata contains all expected information."""
		call_count = 0
		
		async def mock_metadata_function(*args, **kwargs):
			nonlocal call_count
			call_count += 1
			if call_count <= 2:  # Fail first 2 attempts
				raise OSError(f"Error {call_count}")
			return {"success": True}
		
		runner.register_function("test_failing_function", mock_metadata_function)
		
		result = await runner._execute_node("test-node-1", failing_node, mock_context)
		
		assert result.status == ExecutionStatus.COMPLETED
		retry_metadata = result.metadata['retry_metadata']
		
		# Check all expected metadata fields
		assert 'attempts' in retry_metadata
		assert 'total_duration' in retry_metadata
		assert 'errors' in retry_metadata
		assert 'retry_delays' in retry_metadata
		assert 'successful_attempt' in retry_metadata
		assert 'success_after_retries' in retry_metadata
		
		# Check metadata values
		assert retry_metadata['attempts'] == 3
		assert retry_metadata['successful_attempt'] == 3
		assert retry_metadata['success_after_retries'] is True
		assert len(retry_metadata['errors']) == 2  # First 2 failures
		assert len(retry_metadata['retry_delays']) == 2  # 2 retries
		assert retry_metadata['total_duration'] > 0
		
		# Check error messages
		assert "Error 1" in retry_metadata['errors'][0]
		assert "Error 2" in retry_metadata['errors'][1]
	
	@pytest.mark.asyncio
	async def test_retry_with_different_node_types(self, runner, mock_context):
		"""Test retry works with different node types."""
		# Test with AGENT node type
		agent_node = ExecutionNode(
			node_id="test-agent-node",
			node_type=NodeType.AGENT,
			agent_id="test_agent",
			retry_config={
				'max_attempts': 2,
				'base_delay': 0.1,
				'jitter': False
			}
		)
		
		# The actual implementation uses the built-in agent execution,
		# so we expect the default mock output format
		result = await runner._execute_node("test-agent-node", agent_node, mock_context)
		
		assert result.status == ExecutionStatus.COMPLETED
		# Check the actual format returned by _execute_agent_node
		assert result.output['agent_id'] == "test_agent"
		assert result.output['status'] == "success"
		assert 'retry_metadata' not in result.metadata  # No retry needed for successful execution
	
	@pytest.mark.asyncio
	async def test_retry_performance_impact(self, runner, mock_context):
		"""Test that retry mechanism doesn't significantly impact performance."""
		# Node with no retries needed
		fast_node = ExecutionNode(
			node_id="fast-node",
			node_type=NodeType.FUNCTION,
			function_name="fast_function",
			retry_config={
				'max_attempts': 5,
				'base_delay': 0.1
			}
		)
		
		async def fast_function(*args, **kwargs):
			return {"fast": True}
		
		runner.register_function("fast_function", fast_function)
		
		# Measure execution time
		start_time = time.time()
		result = await runner._execute_node("fast-node", fast_node, mock_context)
		execution_time = time.time() - start_time
		
		# Should complete quickly without retry overhead
		assert result.status == ExecutionStatus.COMPLETED
		assert execution_time < 0.1  # Should be very fast
		assert 'retry_metadata' not in result.metadata
	
	@pytest.mark.asyncio
	async def test_concurrent_retry_executions(self, runner, mock_context):
		"""Test multiple concurrent executions with retries."""
		call_counts = {}
		
		async def concurrent_function(node, context):
			node_id = node.node_id
			if node_id not in call_counts:
				call_counts[node_id] = 0
			call_counts[node_id] += 1
			
			if call_counts[node_id] == 1:
				raise ConnectionError(f"First failure for {node_id}")
			return {"node_id": node_id, "success": True}
		
		# Create multiple nodes and execute concurrently
		nodes = []
		for i in range(3):
			node = ExecutionNode(
				node_id=f"concurrent-node-{i}",
				node_type=NodeType.FUNCTION,
				function_name="concurrent_function",
				retry_config={
					'max_attempts': 2,
					'base_delay': 0.1,
					'jitter': False
				}
			)
			nodes.append(node)
		
		runner.register_function("concurrent_function", concurrent_function)
		
		# Execute all nodes concurrently
		tasks = [
			runner._execute_node(node.node_id, node, mock_context)
			for node in nodes
		]
		results = await asyncio.gather(*tasks)
		
		# All should succeed after retry
		for i, result in enumerate(results):
			assert result.status == ExecutionStatus.COMPLETED
			assert result.output["node_id"] == f"concurrent-node-{i}"
			assert 'retry_metadata' in result.metadata
			assert result.metadata['retry_metadata']['attempts'] == 2


if __name__ == "__main__":
	pytest.main([__file__])