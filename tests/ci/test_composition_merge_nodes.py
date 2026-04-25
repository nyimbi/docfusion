"""Tests for composition interpreter _merge_sequential_nodes optimization."""

from __future__ import annotations

import pytest

from docfusion.composition.interpreter import (
	CompositionInterpreter,
	ExecutionGraph,
	ExecutionMode,
	ExecutionNode,
	NodeType,
)


async def test_merge_sequential_nodes_same_type():
	interpreter = CompositionInterpreter()
	graph = ExecutionGraph(
		graph_id="g1",
		name="test",
		nodes={
			"a": ExecutionNode(
				node_id="a", node_type=NodeType.FUNCTION,
				function_name="step1", execution_mode=ExecutionMode.SYNCHRONOUS,
				parameters={"x": 1}
			),
			"b": ExecutionNode(
				node_id="b", node_type=NodeType.FUNCTION,
				function_name="step2", execution_mode=ExecutionMode.SYNCHRONOUS,
				parameters={"y": 2}
			),
		},
		edges=[("a", "b")],
		entry_points=["a"],
		exit_points=["b"],
		execution_order=[["a"], ["b"]],
		parallel_groups=[],
		conditional_branches={},
		error_handlers={},
		loop_structures={},
		data_flow={},
	)

	await interpreter._merge_sequential_nodes(graph)

	assert len(graph.nodes) == 1
	merged_id = list(graph.nodes.keys())[0]
	merged = graph.nodes[merged_id]
	assert merged.node_type == NodeType.FUNCTION
	assert merged.parameters == {"x": 1, "y": 2}
	assert graph.entry_points == [merged_id]
	assert graph.exit_points == [merged_id]


async def test_no_merge_different_types():
	interpreter = CompositionInterpreter()
	graph = ExecutionGraph(
		graph_id="g2",
		name="test",
		nodes={
			"a": ExecutionNode(
				node_id="a", node_type=NodeType.FUNCTION,
				execution_mode=ExecutionMode.SYNCHRONOUS
			),
			"b": ExecutionNode(
				node_id="b", node_type=NodeType.CONDITION,
				execution_mode=ExecutionMode.SYNCHRONOUS
			),
		},
		edges=[("a", "b")],
		entry_points=["a"],
		exit_points=["b"],
		execution_order=[["a"], ["b"]],
		parallel_groups=[],
		conditional_branches={},
		error_handlers={},
		loop_structures={},
		data_flow={},
	)

	await interpreter._merge_sequential_nodes(graph)

	assert len(graph.nodes) == 2
	assert "a" in graph.nodes
	assert "b" in graph.nodes


async def test_no_merge_branching():
	interpreter = CompositionInterpreter()
	graph = ExecutionGraph(
		graph_id="g3",
		name="test",
		nodes={
			"a": ExecutionNode(
				node_id="a", node_type=NodeType.FUNCTION,
				execution_mode=ExecutionMode.SYNCHRONOUS
			),
			"b": ExecutionNode(
				node_id="b", node_type=NodeType.FUNCTION,
				execution_mode=ExecutionMode.SYNCHRONOUS
			),
			"c": ExecutionNode(
				node_id="c", node_type=NodeType.FUNCTION,
				execution_mode=ExecutionMode.SYNCHRONOUS
			),
		},
		edges=[("a", "b"), ("a", "c")],
		entry_points=["a"],
		exit_points=["b", "c"],
		execution_order=[["a"], ["b", "c"]],
		parallel_groups=[],
		conditional_branches={},
		error_handlers={},
		loop_structures={},
		data_flow={},
	)

	await interpreter._merge_sequential_nodes(graph)

	assert len(graph.nodes) == 3


async def test_merge_chain_of_three():
	interpreter = CompositionInterpreter()
	graph = ExecutionGraph(
		graph_id="g4",
		name="test",
		nodes={
			"a": ExecutionNode(
				node_id="a", node_type=NodeType.AGENT,
				execution_mode=ExecutionMode.ASYNCHRONOUS
			),
			"b": ExecutionNode(
				node_id="b", node_type=NodeType.AGENT,
				execution_mode=ExecutionMode.ASYNCHRONOUS
			),
			"c": ExecutionNode(
				node_id="c", node_type=NodeType.AGENT,
				execution_mode=ExecutionMode.ASYNCHRONOUS
			),
		},
		edges=[("a", "b"), ("b", "c")],
		entry_points=["a"],
		exit_points=["c"],
		execution_order=[["a"], ["b"], ["c"]],
		parallel_groups=[],
		conditional_branches={},
		error_handlers={},
		loop_structures={},
		data_flow={},
	)

	await interpreter._merge_sequential_nodes(graph)

	# Should merge a+b, then merged+c in second pass
	assert len(graph.nodes) == 1
	merged_id = list(graph.nodes.keys())[0]
	assert "a" in merged_id and "b" in merged_id and "c" in merged_id
