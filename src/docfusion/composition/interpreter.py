"""
Agent Composition Language Interpreter

Interprets parsed composition structures and builds executable workflow plans.
Handles operator semantics, dependency resolution, and execution graph construction.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional, Union, Tuple, Set, Callable
from dataclasses import dataclass, field
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict

from .parser import ParsedComposition, ParsedFlow, ParsedExpression, OperatorType
from ..core.utils import uuid7str

class ExecutionMode(Enum):
	"""Execution modes for workflow interpretation"""
	SYNCHRONOUS = "synchronous"
	ASYNCHRONOUS = "asynchronous"
	PARALLEL = "parallel"
	STREAMING = "streaming"

class NodeType(Enum):
	"""Types of execution nodes"""
	AGENT = "agent"
	FUNCTION = "function"
	CONDITION = "condition"
	JOIN = "join"
	SPLIT = "split"
	LOOP = "loop"
	ERROR_HANDLER = "error_handler"

@dataclass
class ExecutionNode:
	"""Represents a node in the execution graph"""
	node_id: str
	node_type: NodeType
	agent_id: Optional[str] = None
	function_name: Optional[str] = None
	condition: Optional[str] = None
	parameters: Dict[str, Any] = field(default_factory=dict)
	dependencies: List[str] = field(default_factory=list)
	successors: List[str] = field(default_factory=list)
	execution_mode: ExecutionMode = ExecutionMode.SYNCHRONOUS
	retry_config: Dict[str, Any] = field(default_factory=dict)
	timeout: Optional[int] = None
	position: Tuple[int, int] = (0, 0)
	metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ExecutionGraph:
	"""Complete execution graph for a workflow"""
	graph_id: str
	name: str
	nodes: Dict[str, ExecutionNode]
	edges: List[Tuple[str, str]]
	entry_points: List[str]
	exit_points: List[str]
	execution_order: List[List[str]]  # Topologically sorted execution levels
	parallel_groups: List[List[str]]  # Groups that can execute in parallel
	conditional_branches: Dict[str, Dict[str, str]]  # Conditional routing
	error_handlers: Dict[str, str]  # Error handling mappings
	loop_structures: Dict[str, Dict[str, Any]]  # Loop configurations
	data_flow: Dict[str, List[str]]  # Data flow mappings
	metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class InterpretedComposition:
	"""Complete interpreted composition ready for execution"""
	composition_id: str
	name: str
	version: str
	execution_graph: ExecutionGraph
	agent_configurations: Dict[str, Dict[str, Any]]
	global_config: Dict[str, Any]
	context_variables: Dict[str, Any]
	validation_rules: Dict[str, Any]
	error_handling: Dict[str, Any]
	monitoring_config: Dict[str, Any]
	transformations: Dict[str, Any]
	metadata: Dict[str, Any]

class CompositionInterpreterError(Exception):
	"""Exception raised during composition interpretation"""
	
	def __init__(self, message: str, node_id: Optional[str] = None, context: Optional[str] = None):
		self.message = message
		self.node_id = node_id
		self.context = context
		super().__init__(self._format_message())
	
	def _format_message(self) -> str:
		"""Format error message with context"""
		msg = f"Composition interpreter error: {self.message}"
		if self.node_id:
			msg += f" in node {self.node_id}"
		if self.context:
			msg += f" context: {self.context}"
		return msg

class CompositionInterpreter:
	"""
	Interpreter for parsed Agent Composition Language structures
	
	Converts parsed compositions into executable workflow graphs with
	proper dependency resolution, parallel execution planning, and
	error handling strategies.
	"""
	
	def __init__(self):
		self.logger = logging.getLogger(self.__class__.__name__)
		self.node_counter = 0
	
	async def interpret_composition(self, parsed_composition: ParsedComposition) -> InterpretedComposition:
		"""Interpret complete parsed composition into executable form"""
		try:
			self.logger.info(f"Interpreting composition: {parsed_composition.name}")
			
			# Build execution graph from all flows
			execution_graph = await self._build_execution_graph(parsed_composition)
			
			# Optimize graph for execution
			await self._optimize_execution_graph(execution_graph)
			
			# Validate graph integrity
			await self._validate_execution_graph(execution_graph, parsed_composition)
			
			# Create interpreted composition
			interpreted_composition = InterpretedComposition(
				composition_id=parsed_composition.composition_id,
				name=parsed_composition.name,
				version=parsed_composition.version,
				execution_graph=execution_graph,
				agent_configurations=parsed_composition.agents,
				global_config=parsed_composition.config,
				context_variables=parsed_composition.context,
				validation_rules=parsed_composition.validation_rules,
				error_handling=parsed_composition.error_handling,
				monitoring_config=parsed_composition.monitoring,
				transformations=parsed_composition.transformations,
				metadata={
					**parsed_composition.metadata,
					'interpreted_at': str(__import__('datetime').datetime.now()),
					'total_nodes': len(execution_graph.nodes),
					'total_edges': len(execution_graph.edges),
					'execution_levels': len(execution_graph.execution_order),
					'parallel_groups': len(execution_graph.parallel_groups)
				}
			)
			
			self.logger.info(f"Successfully interpreted composition with {len(execution_graph.nodes)} nodes")
			return interpreted_composition
			
		except Exception as e:
			raise CompositionInterpreterError(f"Failed to interpret composition: {str(e)}") from e
	
	async def _build_execution_graph(self, composition: ParsedComposition) -> ExecutionGraph:
		"""Build execution graph from parsed flows"""
		graph_id = uuid7str()
		nodes = {}
		edges = []
		entry_points = set()
		exit_points = set()
		conditional_branches = {}
		error_handlers = {}
		loop_structures = {}
		data_flow = {}
		
		# Process each flow
		for flow_id, flow in composition.flows.items():
			flow_nodes, flow_edges = await self._process_flow(flow, composition.agents)
			
			# Merge nodes
			nodes.update(flow_nodes)
			edges.extend(flow_edges)
			
			# Track entry and exit points for this flow
			entry_points.update(flow.entry_points)
			exit_points.update(flow.exit_points)
		
		# Build additional structures from expressions
		for flow in composition.flows.values():
			for expr in flow.expressions:
				await self._process_expression(
					expr, nodes, edges, conditional_branches, 
					error_handlers, loop_structures, data_flow
				)
		
		# Compute execution order
		execution_order = await self._compute_execution_order(nodes, edges)
		
		# Identify parallel groups
		parallel_groups = await self._identify_parallel_groups(nodes, edges, execution_order)
		
		return ExecutionGraph(
			graph_id=graph_id,
			name=composition.name,
			nodes=nodes,
			edges=edges,
			entry_points=list(entry_points),
			exit_points=list(exit_points),
			execution_order=execution_order,
			parallel_groups=parallel_groups,
			conditional_branches=conditional_branches,
			error_handlers=error_handlers,
			loop_structures=loop_structures,
			data_flow=data_flow,
			metadata={
				'flow_count': len(composition.flows),
				'agent_count': len(composition.agents)
			}
		)
	
	async def _process_flow(self, flow: ParsedFlow, agents: Dict[str, Any]) -> Tuple[Dict[str, ExecutionNode], List[Tuple[str, str]]]:
		"""Process individual flow into nodes and edges"""
		nodes = {}
		edges = []
		
		# Create nodes for each agent referenced in the flow
		referenced_agents = set()
		
		for expr in flow.expressions:
			if expr.left_operand:
				referenced_agents.add(expr.left_operand)
			if expr.right_operand:
				referenced_agents.add(expr.right_operand)
		
		# Create execution nodes
		for agent_id in referenced_agents:
			if agent_id in agents:
				node = await self._create_agent_node(agent_id, agents[agent_id])
				nodes[node.node_id] = node
			elif agent_id in flow.dependencies:
				# This might be a transformation or function
				node = await self._create_function_node(agent_id)
				nodes[node.node_id] = node
		
		# Create edges based on dependencies
		for agent_id, deps in flow.dependencies.items():
			target_node = self._find_node_by_agent(nodes, agent_id)
			if target_node:
				for dep_id in deps:
					source_node = self._find_node_by_agent(nodes, dep_id)
					if source_node:
						edges.append((source_node.node_id, target_node.node_id))
		
		return nodes, edges
	
	async def _process_expression(
		self, 
		expr: ParsedExpression,
		nodes: Dict[str, ExecutionNode],
		edges: List[Tuple[str, str]],
		conditional_branches: Dict[str, Dict[str, str]],
		error_handlers: Dict[str, str],
		loop_structures: Dict[str, Dict[str, Any]],
		data_flow: Dict[str, List[str]]
	):
		"""Process individual expression for special structures"""
		
		if expr.operator == OperatorType.BRANCH:
			# Handle conditional branching
			if expr.left_operand and expr.right_operand and expr.condition:
				conditional_branches[expr.left_operand] = {
					'true_path': expr.right_operand,
					'false_path': expr.condition,  # In branch syntax, third param can be false path
					'condition': expr.condition
				}
		
		elif expr.operator == OperatorType.ERROR_HANDLER:
			# Handle error routing
			if expr.left_operand and expr.right_operand:
				error_handlers[expr.left_operand] = expr.right_operand
		
		elif expr.operator == OperatorType.LOOP:
			# Handle loop structures
			if expr.left_operand and expr.condition:
				loop_structures[expr.left_operand] = {
					'type': 'count' if expr.condition.isdigit() else 'condition',
					'value': expr.condition,
					'max_iterations': int(expr.condition) if expr.condition.isdigit() else 100
				}
		
		elif expr.operator == OperatorType.PIPELINE:
			# Handle data flow
			if expr.left_operand and expr.right_operand:
				if expr.left_operand not in data_flow:
					data_flow[expr.left_operand] = []
				data_flow[expr.left_operand].append(expr.right_operand)
		
		elif expr.operator == OperatorType.PARALLEL:
			# Mark nodes for parallel execution
			left_node = self._find_node_by_agent(nodes, expr.left_operand)
			right_node = self._find_node_by_agent(nodes, expr.right_operand)
			
			if left_node:
				left_node.execution_mode = ExecutionMode.PARALLEL
			if right_node:
				right_node.execution_mode = ExecutionMode.PARALLEL
		
		elif expr.operator == OperatorType.ASYNC:
			# Mark node for async execution
			node = self._find_node_by_agent(nodes, expr.left_operand)
			if node:
				node.execution_mode = ExecutionMode.ASYNCHRONOUS
	
	async def _create_agent_node(self, agent_id: str, agent_config: Dict[str, Any]) -> ExecutionNode:
		"""Create execution node for agent"""
		node_id = f"agent_{self.node_counter}_{agent_id}"
		self.node_counter += 1
		
		return ExecutionNode(
			node_id=node_id,
			node_type=NodeType.AGENT,
			agent_id=agent_id,
			parameters={
				'type': agent_config.get('type', 'generic'),
				'model': agent_config.get('model', 'qwen2.5:7b'),
				'temperature': agent_config.get('temperature', 0.7),
				'max_tokens': agent_config.get('max_tokens', 3000),
				'tools': agent_config.get('tools', [])
			},
			timeout=agent_config.get('timeout', 300),
			retry_config={
				'max_attempts': agent_config.get('retries', 3),
				'backoff_factor': 2.0,
				'retry_on_error': True
			},
			metadata={
				'prompt': agent_config.get('prompt', ''),
				'agent_type': agent_config.get('type', 'generic')
			}
		)
	
	async def _create_function_node(self, function_id: str) -> ExecutionNode:
		"""Create execution node for function"""
		node_id = f"func_{self.node_counter}_{function_id}"
		self.node_counter += 1
		
		return ExecutionNode(
			node_id=node_id,
			node_type=NodeType.FUNCTION,
			function_name=function_id,
			parameters={},
			metadata={'function_id': function_id}
		)
	
	def _find_node_by_agent(self, nodes: Dict[str, ExecutionNode], agent_id: str) -> Optional[ExecutionNode]:
		"""Find execution node by agent ID"""
		for node in nodes.values():
			if node.agent_id == agent_id:
				return node
		return None
	
	async def _compute_execution_order(self, nodes: Dict[str, ExecutionNode], edges: List[Tuple[str, str]]) -> List[List[str]]:
		"""Compute topological execution order"""
		# Build adjacency list
		graph = {node_id: [] for node_id in nodes.keys()}
		in_degree = {node_id: 0 for node_id in nodes.keys()}
		
		for source, target in edges:
			if source in graph and target in graph:
				graph[source].append(target)
				in_degree[target] += 1
		
		# Kahn's algorithm for topological sorting
		execution_order = []
		queue = [node_id for node_id, degree in in_degree.items() if degree == 0]
		
		while queue:
			# All nodes in current queue can execute in parallel
			current_level = queue.copy()
			execution_order.append(current_level)
			queue.clear()
			
			# Process each node in current level
			for node_id in current_level:
				for neighbor in graph[node_id]:
					in_degree[neighbor] -= 1
					if in_degree[neighbor] == 0:
						queue.append(neighbor)
		
		return execution_order
	
	async def _identify_parallel_groups(
		self, 
		nodes: Dict[str, ExecutionNode], 
		edges: List[Tuple[str, str]], 
		execution_order: List[List[str]]
	) -> List[List[str]]:
		"""Identify groups of nodes that can execute in parallel"""
		parallel_groups = []
		
		for level in execution_order:
			if len(level) > 1:
				# Check if nodes in this level can truly run in parallel
				# (no shared resources, compatible execution modes, etc.)
				parallel_group = []
				
				for node_id in level:
					node = nodes[node_id]
					if node.execution_mode in [ExecutionMode.PARALLEL, ExecutionMode.ASYNCHRONOUS]:
						parallel_group.append(node_id)
				
				if parallel_group:
					parallel_groups.append(parallel_group)
		
		return parallel_groups
	
	async def _optimize_execution_graph(self, graph: ExecutionGraph):
		"""Optimize execution graph for performance"""
		# Merge sequential nodes where possible
		await self._merge_sequential_nodes(graph)
		
		# Optimize parallel execution
		await self._optimize_parallel_execution(graph)
		
		# Add join nodes where needed
		await self._add_join_nodes(graph)
	
	async def _merge_sequential_nodes(self, graph: ExecutionGraph):
		"""Merge sequential nodes of the same type to reduce graph size.

		Merges adjacent nodes when:
		- They share the same node type
		- There is no branching (single predecessor, single successor)
		- They have compatible execution modes
		- They are not entry or exit points
		"""
		merged_any = True
		while merged_any:
			merged_any = False
			nodes = graph.nodes
			edges = graph.edges

			# Build adjacency maps
			predecessors: Dict[str, List[str]] = {nid: [] for nid in nodes}
			successors: Dict[str, List[str]] = {nid: [] for nid in nodes}
			for src, dst in edges:
				predecessors[dst].append(src)
				successors[src].append(dst)

			for node_id in list(nodes.keys()):
				if node_id not in nodes:
					continue

				node = nodes[node_id]
				succs = successors.get(node_id, [])

				# Only merge if this node has exactly one successor
				if len(succs) != 1:
					continue

				succ_id = succs[0]
				if succ_id not in nodes:
					continue

				succ_node = nodes[succ_id]
				preds = predecessors.get(succ_id, [])

				# Only merge if successor has exactly one predecessor
				if len(preds) != 1 or preds[0] != node_id:
					continue

				# Skip if node is an exit point (nothing after it to merge)
				if node_id in graph.exit_points:
					continue

				# Require same node type and compatible execution mode
				if node.node_type != succ_node.node_type:
					continue

				if node.execution_mode != succ_node.execution_mode:
					continue

				# Merge successor into current node
				merged_id = f"{node_id}_{succ_id}"
				merged_node = ExecutionNode(
					node_id=merged_id,
					node_type=node.node_type,
					agent_id=node.agent_id or succ_node.agent_id,
					function_name=node.function_name or succ_node.function_name,
					condition=node.condition or succ_node.condition,
					parameters={**node.parameters, **succ_node.parameters},
					dependencies=list(set(node.dependencies + succ_node.dependencies)),
					successors=succ_node.successors.copy(),
					execution_mode=node.execution_mode,
					retry_config=node.retry_config if node.retry_config else succ_node.retry_config,
					timeout=node.timeout or succ_node.timeout,
					position=node.position,
					metadata={
						"merged_from": [node_id, succ_id],
						**node.metadata,
						**succ_node.metadata,
					},
				)

				# Update graph
				nodes[merged_id] = merged_node
				del nodes[node_id]
				del nodes[succ_id]

				# Update edges: redirect any edges pointing to node_id or succ_id
				new_edges = []
				for src, dst in edges:
					if src == node_id or src == succ_id:
						new_edges.append((merged_id, dst))
					elif dst == node_id or dst == succ_id:
						new_edges.append((src, merged_id))
					else:
						new_edges.append((src, dst))

				# Remove self-loops, duplicates, and edges referencing deleted nodes
				valid_nodes = set(nodes.keys())
				graph.edges = list(dict.fromkeys(
					(s, d) for s, d in new_edges
					if s != d and s in valid_nodes and d in valid_nodes
				))

				# Update entry/exit points
				graph.entry_points = [
					merged_id if nid == node_id else nid for nid in graph.entry_points
				]
				graph.exit_points = [
					merged_id if nid == succ_id else nid for nid in graph.exit_points
				]

				merged_any = True
				break
	
	async def _optimize_parallel_execution(self, graph: ExecutionGraph):
		"""Optimize parallel execution groups"""
		# Recompute parallel groups based on resource constraints
		optimized_groups = []
		
		for group in graph.parallel_groups:
			# Check resource compatibility
			compatible_nodes = []
			for node_id in group:
				node = graph.nodes[node_id]
				# Add logic to check resource compatibility
				compatible_nodes.append(node_id)
			
			if compatible_nodes:
				optimized_groups.append(compatible_nodes)
		
		graph.parallel_groups = optimized_groups
	
	async def _add_join_nodes(self, graph: ExecutionGraph):
		"""Add join nodes for synchronization where needed"""
		# Identify points where parallel branches need to join
		for group in graph.parallel_groups:
			# Find common successors
			common_successors = set()
			
			for node_id in group:
				node = graph.nodes[node_id]
				if not common_successors:
					common_successors = set(node.successors)
				else:
					common_successors &= set(node.successors)
			
			# Add join nodes if needed
			if len(common_successors) == 1 and len(group) > 1:
				join_node_id = f"join_{uuid7str()[:8]}"
				join_node = ExecutionNode(
					node_id=join_node_id,
					node_type=NodeType.JOIN,
					dependencies=group.copy(),
					successors=list(common_successors),
					metadata={'join_group': group}
				)
				graph.nodes[join_node_id] = join_node
	
	async def _validate_execution_graph(self, graph: ExecutionGraph, composition: ParsedComposition):
		"""Validate execution graph integrity"""
		# Check for cycles
		if await self._has_cycles(graph):
			raise CompositionInterpreterError("Execution graph contains cycles")
		
		# Validate node references
		for node in graph.nodes.values():
			if node.node_type == NodeType.AGENT and node.agent_id:
				if node.agent_id not in composition.agents:
					raise CompositionInterpreterError(f"Node references undefined agent: {node.agent_id}")
		
		# Validate edge integrity
		for source, target in graph.edges:
			if source not in graph.nodes or target not in graph.nodes:
				raise CompositionInterpreterError(f"Edge references non-existent nodes: {source} -> {target}")
	
	async def _has_cycles(self, graph: ExecutionGraph) -> bool:
		"""Check if execution graph has cycles"""
		visited = set()
		rec_stack = set()
		
		def dfs(node_id: str) -> bool:
			visited.add(node_id)
			rec_stack.add(node_id)
			
			node = graph.nodes.get(node_id)
			if node:
				for successor in node.successors:
					if successor not in visited:
						if dfs(successor):
							return True
					elif successor in rec_stack:
						return True
			
			rec_stack.remove(node_id)
			return False
		
		for node_id in graph.nodes:
			if node_id not in visited:
				if dfs(node_id):
					return True
		
		return False
	
	async def get_execution_plan(self, interpreted_composition: InterpretedComposition) -> Dict[str, Any]:
		"""Generate detailed execution plan"""
		graph = interpreted_composition.execution_graph
		
		return {
			'composition_id': interpreted_composition.composition_id,
			'name': interpreted_composition.name,
			'total_nodes': len(graph.nodes),
			'execution_levels': len(graph.execution_order),
			'parallel_groups': len(graph.parallel_groups),
			'estimated_duration': await self._estimate_execution_duration(graph),
			'resource_requirements': await self._calculate_resource_requirements(graph),
			'execution_sequence': [
				{
					'level': i,
					'nodes': level,
					'can_parallelize': len(level) > 1,
					'estimated_time': await self._estimate_level_duration(graph, level)
				}
				for i, level in enumerate(graph.execution_order)
			],
			'critical_path': await self._find_critical_path(graph),
			'bottlenecks': await self._identify_bottlenecks(graph)
		}
	
	async def _estimate_execution_duration(self, graph: ExecutionGraph) -> float:
		"""Estimate total execution duration"""
		total_duration = 0.0
		
		for level in graph.execution_order:
			level_duration = await self._estimate_level_duration(graph, level)
			total_duration += level_duration
		
		return total_duration
	
	async def _estimate_level_duration(self, graph: ExecutionGraph, level: List[str]) -> float:
		"""Estimate duration for execution level"""
		max_duration = 0.0
		
		for node_id in level:
			node = graph.nodes[node_id]
			node_duration = node.timeout or 60.0  # Default 60 seconds
			max_duration = max(max_duration, node_duration)
		
		return max_duration
	
	async def _calculate_resource_requirements(self, graph: ExecutionGraph) -> Dict[str, Any]:
		"""Calculate resource requirements"""
		max_parallel = max(len(level) for level in graph.execution_order) if graph.execution_order else 1
		
		return {
			'max_parallel_agents': max_parallel,
			'total_compute_units': len([n for n in graph.nodes.values() if n.node_type == NodeType.AGENT]),
			'memory_estimate': max_parallel * 2048,  # MB per agent
			'network_requirements': 'moderate'
		}
	
	async def _find_critical_path(self, graph: ExecutionGraph) -> List[str]:
		"""Find critical path through execution graph"""
		# Simplified critical path finding
		# In practice, this would use proper critical path method (CPM)
		critical_path = []
		
		if graph.execution_order:
			for level in graph.execution_order:
				if level:
					# For simplicity, pick first node in each level
					critical_path.append(level[0])
		
		return critical_path
	
	async def _identify_bottlenecks(self, graph: ExecutionGraph) -> List[Dict[str, Any]]:
		"""Identify potential bottlenecks"""
		bottlenecks = []
		
		# Check for nodes with many dependencies
		for node_id, node in graph.nodes.items():
			if len(node.dependencies) > 3:
				bottlenecks.append({
					'type': 'high_dependency',
					'node_id': node_id,
					'dependency_count': len(node.dependencies),
					'impact': 'high'
				})
		
		# Check for single-threaded sections
		for i, level in enumerate(graph.execution_order):
			if len(level) == 1 and i > 0 and i < len(graph.execution_order) - 1:
				bottlenecks.append({
					'type': 'sequential_bottleneck',
					'level': i,
					'node_id': level[0],
					'impact': 'medium'
				})
		
		return bottlenecks