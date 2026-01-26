"""
Workflow Engine

Core orchestration engine for executing agent workflows with support for
sequences, hierarchies, parallel execution, and conditional branching.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import logging
import json
from typing import Any, Dict, List, Optional, Union, Tuple, Set
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field

try:
	from uuid_extensions import uuid7str
except ImportError:
	import uuid
	def uuid7str() -> str:
		return str(uuid.uuid4())

from pydantic import BaseModel, Field, ConfigDict


class WorkflowType(str, Enum):
	"""Workflow execution patterns"""
	SEQUENTIAL = "sequential"
	PARALLEL = "parallel"
	HIERARCHICAL = "hierarchical"
	CONDITIONAL = "conditional"
	PIPELINE = "pipeline"
	DAG = "dag"  # Directed Acyclic Graph


class NodeType(str, Enum):
	"""Workflow node types"""
	AGENT = "agent"
	CONDITION = "condition"
	FORK = "fork"
	JOIN = "join"
	LOOP = "loop"
	SUBWORKFLOW = "subworkflow"


class ExecutionStatus(str, Enum):
	"""Execution status states"""
	PENDING = "pending"
	RUNNING = "running"
	COMPLETED = "completed"
	FAILED = "failed"
	CANCELLED = "cancelled"
	SKIPPED = "skipped"


@dataclass
class WorkflowNode:
	"""Individual workflow node"""
	node_id: str
	node_type: NodeType
	name: str
	
	# Agent configuration
	agent_type: Optional[str] = None
	agent_config: Dict[str, Any] = field(default_factory=dict)
	prompt_template: Optional[str] = None
	
	# Execution settings
	timeout: Optional[int] = None
	retry_count: int = 0
	retry_delay: int = 1
	
	# Conditional logic
	condition: Optional[str] = None
	condition_params: Dict[str, Any] = field(default_factory=dict)
	
	# Visual properties
	position: Tuple[float, float] = (0, 0)
	size: Tuple[float, float] = (200, 100)
	color: str = "#4CAF50"
	
	# Execution state
	status: ExecutionStatus = ExecutionStatus.PENDING
	start_time: Optional[datetime] = None
	end_time: Optional[datetime] = None
	result: Any = None
	error: Optional[str] = None
	
	# Metadata
	metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkflowEdge:
	"""Workflow connection between nodes"""
	edge_id: str
	source_node: str
	target_node: str
	
	# Conditional edges
	condition: Optional[str] = None
	condition_value: Any = None
	
	# Data transformation
	data_mapping: Dict[str, str] = field(default_factory=dict)
	
	# Visual properties
	style: str = "solid"  # solid, dashed, dotted
	color: str = "#333333"
	
	# Execution properties
	enabled: bool = True


@dataclass
class Workflow:
	"""Complete workflow definition"""
	workflow_id: str = field(default_factory=uuid7str)
	name: str = ""
	description: str = ""
	workflow_type: WorkflowType = WorkflowType.SEQUENTIAL
	
	# Workflow structure
	nodes: Dict[str, WorkflowNode] = field(default_factory=dict)
	edges: List[WorkflowEdge] = field(default_factory=list)
	
	# Entry and exit points
	entry_nodes: List[str] = field(default_factory=list)
	exit_nodes: List[str] = field(default_factory=list)
	
	# Global configuration
	global_timeout: Optional[int] = None
	max_parallel: int = 5
	error_handling: str = "stop"  # stop, continue, retry
	
	# Execution context
	context: Dict[str, Any] = field(default_factory=dict)
	variables: Dict[str, Any] = field(default_factory=dict)
	
	# Visual layout
	canvas_size: Tuple[float, float] = (1200, 800)
	zoom_level: float = 1.0
	
	# Metadata
	created_at: datetime = field(default_factory=datetime.now)
	updated_at: datetime = field(default_factory=datetime.now)
	version: str = "1.0"
	tags: List[str] = field(default_factory=list)


class WorkflowEngine:
	"""
	Advanced workflow execution engine
	
	Executes agent workflows with support for complex orchestration patterns,
	conditional logic, parallel execution, and error handling.
	"""
	
	def __init__(self):
		self.logger = logging.getLogger("workflow_engine")
		self.running_workflows: Dict[str, Dict[str, Any]] = {}
		self.execution_history: List[Dict[str, Any]] = []
		
		# Built-in condition evaluators
		self.condition_evaluators = {
			"equals": lambda x, y: x == y,
			"not_equals": lambda x, y: x != y,
			"greater_than": lambda x, y: x > y,
			"less_than": lambda x, y: x < y,
			"contains": lambda x, y: y in str(x),
			"regex": lambda x, pattern: __import__('re').match(pattern, str(x)) is not None,
			"success": lambda result: result.get("success", False) if isinstance(result, dict) else bool(result),
			"error": lambda result: result.get("error") is not None if isinstance(result, dict) else not bool(result)
		}

	async def execute_workflow(self, workflow: Workflow, 
							   initial_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
		"""
		Execute a complete workflow
		
		Args:
			workflow: Workflow definition to execute
			initial_context: Initial execution context
			
		Returns:
			Workflow execution results
		"""
		execution_id = uuid7str()
		start_time = datetime.now()
		
		try:
			# Initialize execution context
			context = workflow.context.copy()
			if initial_context:
				context.update(initial_context)
			
			# Register running workflow
			self.running_workflows[execution_id] = {
				"workflow_id": workflow.workflow_id,
				"workflow": workflow,
				"context": context,
				"start_time": start_time,
				"status": ExecutionStatus.RUNNING
			}
			
			# Validate workflow
			await self._validate_workflow(workflow)
			
			# Execute based on workflow type
			if workflow.workflow_type == WorkflowType.SEQUENTIAL:
				results = await self._execute_sequential(workflow, context)
			elif workflow.workflow_type == WorkflowType.PARALLEL:
				results = await self._execute_parallel(workflow, context)
			elif workflow.workflow_type == WorkflowType.HIERARCHICAL:
				results = await self._execute_hierarchical(workflow, context)
			elif workflow.workflow_type == WorkflowType.CONDITIONAL:
				results = await self._execute_conditional(workflow, context)
			elif workflow.workflow_type == WorkflowType.PIPELINE:
				results = await self._execute_pipeline(workflow, context)
			elif workflow.workflow_type == WorkflowType.DAG:
				results = await self._execute_dag(workflow, context)
			else:
				raise ValueError(f"Unsupported workflow type: {workflow.workflow_type}")
			
			# Calculate final status
			final_status = self._determine_final_status(results)
			end_time = datetime.now()
			
			# Prepare execution result
			execution_result = {
				"execution_id": execution_id,
				"workflow_id": workflow.workflow_id,
				"workflow_name": workflow.name,
				"status": final_status,
				"start_time": start_time.isoformat(),
				"end_time": end_time.isoformat(),
				"duration": (end_time - start_time).total_seconds(),
				"node_results": results,
				"context": context,
				"success": final_status == ExecutionStatus.COMPLETED
			}
			
			# Update workflow status
			self.running_workflows[execution_id]["status"] = final_status
			self.running_workflows[execution_id]["end_time"] = end_time
			
			# Store in history
			self.execution_history.append(execution_result)
			
			# Cleanup
			del self.running_workflows[execution_id]
			
			self.logger.info(f"Workflow executed: {workflow.name} ({final_status.value})")
			
			return execution_result
			
		except Exception as e:
			self.logger.error(f"Workflow execution failed: {e}")
			
			error_result = {
				"execution_id": execution_id,
				"workflow_id": workflow.workflow_id,
				"status": ExecutionStatus.FAILED,
				"error": str(e),
				"start_time": start_time.isoformat(),
				"end_time": datetime.now().isoformat(),
				"success": False
			}
			
			# Cleanup
			if execution_id in self.running_workflows:
				del self.running_workflows[execution_id]
			
			return error_result

	async def execute_node(self, node: WorkflowNode, context: Dict[str, Any]) -> Dict[str, Any]:
		"""
		Execute a single workflow node
		
		Args:
			node: Node to execute
			context: Execution context
			
		Returns:
			Node execution result
		"""
		node.status = ExecutionStatus.RUNNING
		node.start_time = datetime.now()
		
		try:
			# Execute based on node type
			if node.node_type == NodeType.AGENT:
				result = await self._execute_agent_node(node, context)
			elif node.node_type == NodeType.CONDITION:
				result = await self._execute_condition_node(node, context)
			elif node.node_type == NodeType.FORK:
				result = await self._execute_fork_node(node, context)
			elif node.node_type == NodeType.JOIN:
				result = await self._execute_join_node(node, context)
			elif node.node_type == NodeType.LOOP:
				result = await self._execute_loop_node(node, context)
			elif node.node_type == NodeType.SUBWORKFLOW:
				result = await self._execute_subworkflow_node(node, context)
			else:
				raise ValueError(f"Unsupported node type: {node.node_type}")
			
			node.status = ExecutionStatus.COMPLETED
			node.result = result
			node.end_time = datetime.now()
			
			return {
				"node_id": node.node_id,
				"status": ExecutionStatus.COMPLETED,
				"result": result,
				"execution_time": (node.end_time - node.start_time).total_seconds(),
				"success": True
			}
			
		except Exception as e:
			node.status = ExecutionStatus.FAILED
			node.error = str(e)
			node.end_time = datetime.now()
			
			self.logger.error(f"Node execution failed: {node.node_id} - {e}")
			
			return {
				"node_id": node.node_id,
				"status": ExecutionStatus.FAILED,
				"error": str(e),
				"execution_time": (node.end_time - node.start_time).total_seconds() if node.start_time else 0,
				"success": False
			}

	async def get_workflow_status(self, execution_id: str) -> Dict[str, Any]:
		"""Get real-time status of running workflow"""
		if execution_id in self.running_workflows:
			workflow_info = self.running_workflows[execution_id]
			workflow = workflow_info["workflow"]
			
			# Calculate progress
			total_nodes = len(workflow.nodes)
			completed_nodes = sum(1 for node in workflow.nodes.values() 
								if node.status == ExecutionStatus.COMPLETED)
			failed_nodes = sum(1 for node in workflow.nodes.values() 
							 if node.status == ExecutionStatus.FAILED)
			running_nodes = sum(1 for node in workflow.nodes.values() 
							  if node.status == ExecutionStatus.RUNNING)
			
			progress = completed_nodes / total_nodes if total_nodes > 0 else 0
			
			return {
				"execution_id": execution_id,
				"workflow_id": workflow.workflow_id,
				"status": workflow_info["status"],
				"progress": progress,
				"total_nodes": total_nodes,
				"completed_nodes": completed_nodes,
				"failed_nodes": failed_nodes,
				"running_nodes": running_nodes,
				"start_time": workflow_info["start_time"].isoformat(),
				"current_time": datetime.now().isoformat()
			}
		
		# Check execution history
		for execution in self.execution_history:
			if execution["execution_id"] == execution_id:
				return execution
		
		return {"error": f"Execution {execution_id} not found"}

	async def cancel_workflow(self, execution_id: str) -> Dict[str, Any]:
		"""Cancel running workflow"""
		if execution_id not in self.running_workflows:
			return {"error": f"Execution {execution_id} not found or not running"}
		
		workflow_info = self.running_workflows[execution_id]
		workflow = workflow_info["workflow"]
		
		# Mark all pending/running nodes as cancelled
		for node in workflow.nodes.values():
			if node.status in [ExecutionStatus.PENDING, ExecutionStatus.RUNNING]:
				node.status = ExecutionStatus.CANCELLED
		
		workflow_info["status"] = ExecutionStatus.CANCELLED
		
		self.logger.info(f"Workflow cancelled: {execution_id}")
		
		return {
			"execution_id": execution_id,
			"status": ExecutionStatus.CANCELLED,
			"message": "Workflow cancelled successfully"
		}

	async def _execute_sequential(self, workflow: Workflow, context: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
		"""Execute nodes sequentially"""
		results = {}
		
		# Get execution order
		execution_order = await self._get_execution_order(workflow)
		
		for node_id in execution_order:
			node = workflow.nodes[node_id]
			
			# Check if node should be executed based on conditions
			if not await self._should_execute_node(node, context, results):
				results[node_id] = {
					"node_id": node_id,
					"status": ExecutionStatus.SKIPPED,
					"message": "Skipped due to condition",
					"success": True
				}
				continue
			
			# Execute node
			result = await self.execute_node(node, context)
			results[node_id] = result
			
			# Update context with results
			if result.get("success") and "result" in result:
				context[f"node_{node_id}_result"] = result["result"]
			
			# Handle error based on workflow configuration
			if not result.get("success") and workflow.error_handling == "stop":
				break
		
		return results

	async def _execute_parallel(self, workflow: Workflow, context: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
		"""Execute nodes in parallel"""
		results = {}
		
		# Group nodes that can run in parallel
		parallel_groups = await self._group_parallel_nodes(workflow)
		
		for group in parallel_groups:
			# Create tasks for parallel execution
			tasks = []
			group_nodes = []
			
			for node_id in group:
				node = workflow.nodes[node_id]
				
				if await self._should_execute_node(node, context, results):
					tasks.append(self.execute_node(node, context))
					group_nodes.append(node_id)
				else:
					results[node_id] = {
						"node_id": node_id,
						"status": ExecutionStatus.SKIPPED,
						"message": "Skipped due to condition",
						"success": True
					}
			
			# Execute parallel tasks with concurrency limit
			if tasks:
				semaphore = asyncio.Semaphore(workflow.max_parallel)
				
				async def execute_with_limit(task):
					async with semaphore:
						return await task
				
				limited_tasks = [execute_with_limit(task) for task in tasks]
				group_results = await asyncio.gather(*limited_tasks, return_exceptions=True)
				
				# Process results
				for i, result in enumerate(group_results):
					node_id = group_nodes[i]
					if isinstance(result, Exception):
						results[node_id] = {
							"node_id": node_id,
							"status": ExecutionStatus.FAILED,
							"error": str(result),
							"success": False
						}
					else:
						results[node_id] = result
						
						# Update context
						if result.get("success") and "result" in result:
							context[f"node_{node_id}_result"] = result["result"]
		
		return results

	async def _execute_hierarchical(self, workflow: Workflow, context: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
		"""Execute nodes in hierarchical structure"""
		results = {}
		
		# Build hierarchy
		hierarchy = await self._build_hierarchy(workflow)
		
		# Execute levels in order
		for level, nodes in hierarchy.items():
			level_tasks = []
			level_nodes = []
			
			for node_id in nodes:
				node = workflow.nodes[node_id]
				
				if await self._should_execute_node(node, context, results):
					level_tasks.append(self.execute_node(node, context))
					level_nodes.append(node_id)
			
			# Execute level in parallel
			if level_tasks:
				level_results = await asyncio.gather(*level_tasks, return_exceptions=True)
				
				for i, result in enumerate(level_results):
					node_id = level_nodes[i]
					if isinstance(result, Exception):
						results[node_id] = {
							"node_id": node_id,
							"status": ExecutionStatus.FAILED,
							"error": str(result),
							"success": False
						}
					else:
						results[node_id] = result
						
						if result.get("success") and "result" in result:
							context[f"node_{node_id}_result"] = result["result"]
		
		return results

	async def _execute_conditional(self, workflow: Workflow, context: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
		"""Execute nodes based on conditions"""
		results = {}
		
		# Start with entry nodes
		current_nodes = workflow.entry_nodes.copy() if workflow.entry_nodes else list(workflow.nodes.keys())[:1]
		visited = set()
		
		while current_nodes:
			next_nodes = []
			
			for node_id in current_nodes:
				if node_id in visited:
					continue
				
				visited.add(node_id)
				node = workflow.nodes[node_id]
				
				# Execute node
				result = await self.execute_node(node, context)
				results[node_id] = result
				
				# Update context
				if result.get("success") and "result" in result:
					context[f"node_{node_id}_result"] = result["result"]
				
				# Find next nodes based on edges and conditions
				for edge in workflow.edges:
					if edge.source_node == node_id and edge.enabled:
						if await self._evaluate_edge_condition(edge, context, results):
							next_nodes.append(edge.target_node)
			
			current_nodes = list(set(next_nodes))
		
		return results

	async def _execute_pipeline(self, workflow: Workflow, context: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
		"""Execute nodes as data pipeline"""
		results = {}
		
		# Get pipeline order
		pipeline_order = await self._get_pipeline_order(workflow)
		
		# Pass data through pipeline
		pipeline_data = context.get("input_data", {})
		
		for node_id in pipeline_order:
			node = workflow.nodes[node_id]
			
			# Set pipeline data as input
			node_context = context.copy()
			node_context["input_data"] = pipeline_data
			
			# Execute node
			result = await self.execute_node(node, node_context)
			results[node_id] = result
			
			# Use result as next input if successful
			if result.get("success") and "result" in result:
				pipeline_data = result["result"]
				context[f"node_{node_id}_result"] = result["result"]
			elif not result.get("success") and workflow.error_handling == "stop":
				break
		
		return results

	async def _execute_dag(self, workflow: Workflow, context: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
		"""Execute nodes as Directed Acyclic Graph"""
		results = {}
		
		# Topological sort
		sorted_nodes = await self._topological_sort(workflow)
		
		for node_id in sorted_nodes:
			node = workflow.nodes[node_id]
			
			# Check dependencies are complete
			dependencies_ready = await self._check_dependencies(node_id, workflow, results)
			
			if not dependencies_ready:
				results[node_id] = {
					"node_id": node_id,
					"status": ExecutionStatus.FAILED,
					"error": "Dependencies not satisfied",
					"success": False
				}
				continue
			
			# Execute node
			result = await self.execute_node(node, context)
			results[node_id] = result
			
			if result.get("success") and "result" in result:
				context[f"node_{node_id}_result"] = result["result"]
		
		return results

	async def _execute_agent_node(self, node: WorkflowNode, context: Dict[str, Any]) -> Any:
		"""Execute agent node"""
		# This would integrate with the actual agent system
		# For now, return a mock response
		
		await asyncio.sleep(0.1)  # Simulate processing
		
		return {
			"agent_type": node.agent_type,
			"prompt": node.prompt_template,
			"config": node.agent_config,
			"mock_response": f"Agent {node.agent_type} executed successfully",
			"timestamp": datetime.now().isoformat()
		}

	async def _execute_condition_node(self, node: WorkflowNode, context: Dict[str, Any]) -> Any:
		"""Execute condition node"""
		condition_result = await self._evaluate_condition(node.condition, context)
		
		return {
			"condition": node.condition,
			"result": condition_result,
			"parameters": node.condition_params
		}

	async def _execute_fork_node(self, node: WorkflowNode, context: Dict[str, Any]) -> Any:
		"""Execute fork node (creates parallel branches)"""
		return {
			"fork_id": node.node_id,
			"branches_created": len([e for e in context.get("edges", []) if e.source_node == node.node_id])
		}

	async def _execute_join_node(self, node: WorkflowNode, context: Dict[str, Any]) -> Any:
		"""Execute join node (merges parallel branches)"""
		return {
			"join_id": node.node_id,
			"branches_joined": len([e for e in context.get("edges", []) if e.target_node == node.node_id])
		}

	async def _execute_loop_node(self, node: WorkflowNode, context: Dict[str, Any]) -> Any:
		"""Execute loop node"""
		loop_count = node.condition_params.get("count", 1)
		results = []
		
		for i in range(loop_count):
			# Execute loop body (would need to define sub-nodes)
			await asyncio.sleep(0.05)  # Simulate processing
			results.append(f"Loop iteration {i+1}")
		
		return {
			"loop_id": node.node_id,
			"iterations": loop_count,
			"results": results
		}

	async def _execute_subworkflow_node(self, node: WorkflowNode, context: Dict[str, Any]) -> Any:
		"""Execute subworkflow node"""
		# This would load and execute a sub-workflow
		subworkflow_id = node.metadata.get("subworkflow_id")
		
		return {
			"subworkflow_id": subworkflow_id,
			"status": "completed",
			"message": "Subworkflow executed successfully"
		}

	async def _validate_workflow(self, workflow: Workflow):
		"""Validate workflow structure"""
		if not workflow.nodes:
			raise ValueError("Workflow must have at least one node")
		
		# Check for cycles in DAG workflows
		if workflow.workflow_type == WorkflowType.DAG:
			if await self._has_cycles(workflow):
				raise ValueError("DAG workflows cannot contain cycles")
		
		# Validate node references in edges
		for edge in workflow.edges:
			if edge.source_node not in workflow.nodes:
				raise ValueError(f"Edge references unknown source node: {edge.source_node}")
			if edge.target_node not in workflow.nodes:
				raise ValueError(f"Edge references unknown target node: {edge.target_node}")

	async def _get_execution_order(self, workflow: Workflow) -> List[str]:
		"""Get execution order for sequential workflows"""
		if workflow.entry_nodes:
			return workflow.entry_nodes + [n for n in workflow.nodes.keys() if n not in workflow.entry_nodes]
		else:
			return list(workflow.nodes.keys())

	async def _group_parallel_nodes(self, workflow: Workflow) -> List[List[str]]:
		"""Group nodes that can execute in parallel"""
		# Simple implementation - could be enhanced with dependency analysis
		groups = []
		remaining_nodes = list(workflow.nodes.keys())
		
		while remaining_nodes:
			current_group = remaining_nodes[:workflow.max_parallel]
			groups.append(current_group)
			remaining_nodes = remaining_nodes[workflow.max_parallel:]
		
		return groups

	async def _build_hierarchy(self, workflow: Workflow) -> Dict[int, List[str]]:
		"""Build hierarchical levels from edges"""
		levels = {0: []}
		node_levels = {}
		
		# Find root nodes
		targets = {edge.target_node for edge in workflow.edges}
		roots = [node_id for node_id in workflow.nodes.keys() if node_id not in targets]
		
		if not roots:
			roots = list(workflow.nodes.keys())[:1]
		
		levels[0] = roots
		for root in roots:
			node_levels[root] = 0
		
		# Build levels using BFS
		current_level = 0
		while levels.get(current_level):
			next_level = current_level + 1
			levels[next_level] = []
			
			for node_id in levels[current_level]:
				# Find children
				children = [edge.target_node for edge in workflow.edges 
						   if edge.source_node == node_id and edge.target_node not in node_levels]
				
				for child in children:
					if child not in node_levels:
						node_levels[child] = next_level
						levels[next_level].append(child)
			
			if not levels[next_level]:
				del levels[next_level]
				break
			
			current_level = next_level
		
		return levels

	async def _get_pipeline_order(self, workflow: Workflow) -> List[str]:
		"""Get pipeline execution order"""
		# For pipeline, assume linear flow
		return await self._topological_sort(workflow)

	async def _topological_sort(self, workflow: Workflow) -> List[str]:
		"""Perform topological sort on workflow nodes"""
		# Kahn's algorithm
		in_degree = {node_id: 0 for node_id in workflow.nodes.keys()}
		
		# Calculate in-degrees
		for edge in workflow.edges:
			in_degree[edge.target_node] += 1
		
		# Find nodes with no incoming edges
		queue = [node_id for node_id, degree in in_degree.items() if degree == 0]
		result = []
		
		while queue:
			node_id = queue.pop(0)
			result.append(node_id)
			
			# Remove edges from this node
			for edge in workflow.edges:
				if edge.source_node == node_id:
					in_degree[edge.target_node] -= 1
					if in_degree[edge.target_node] == 0:
						queue.append(edge.target_node)
		
		return result

	async def _has_cycles(self, workflow: Workflow) -> bool:
		"""Check if workflow has cycles"""
		try:
			sorted_nodes = await self._topological_sort(workflow)
			return len(sorted_nodes) != len(workflow.nodes)
		except:
			return True

	async def _should_execute_node(self, node: WorkflowNode, context: Dict[str, Any], results: Dict[str, Any]) -> bool:
		"""Check if node should be executed based on conditions"""
		if not node.condition:
			return True
		
		return await self._evaluate_condition(node.condition, context, results)

	async def _evaluate_condition(self, condition: str, context: Dict[str, Any], results: Optional[Dict[str, Any]] = None) -> bool:
		"""Evaluate condition expression"""
		if not condition:
			return True
		
		try:
			# Simple condition parsing - could be enhanced with expression parser
			parts = condition.split()
			if len(parts) >= 3:
				left, operator, right = parts[0], parts[1], parts[2]
				
				# Resolve values from context
				left_val = context.get(left, left)
				right_val = context.get(right, right)
				
				# Apply condition
				if operator in self.condition_evaluators:
					return self.condition_evaluators[operator](left_val, right_val)
			
			return bool(context.get(condition, False))
			
		except Exception as e:
			self.logger.warning(f"Condition evaluation failed: {condition} - {e}")
			return False

	async def _evaluate_edge_condition(self, edge: WorkflowEdge, context: Dict[str, Any], results: Dict[str, Any]) -> bool:
		"""Evaluate edge condition"""
		if not edge.condition:
			return True
		
		return await self._evaluate_condition(edge.condition, context, results)

	async def _check_dependencies(self, node_id: str, workflow: Workflow, results: Dict[str, Any]) -> bool:
		"""Check if node dependencies are satisfied"""
		# Find incoming edges
		dependencies = [edge.source_node for edge in workflow.edges if edge.target_node == node_id]
		
		# Check all dependencies are completed successfully
		for dep_id in dependencies:
			if dep_id not in results or not results[dep_id].get("success", False):
				return False
		
		return True

	def _determine_final_status(self, results: Dict[str, Dict[str, Any]]) -> ExecutionStatus:
		"""Determine final workflow status from node results"""
		if not results:
			return ExecutionStatus.FAILED
		
		statuses = [result.get("status", ExecutionStatus.FAILED) for result in results.values()]
		
		if ExecutionStatus.FAILED in statuses:
			return ExecutionStatus.FAILED
		elif ExecutionStatus.CANCELLED in statuses:
			return ExecutionStatus.CANCELLED
		elif all(status == ExecutionStatus.COMPLETED for status in statuses):
			return ExecutionStatus.COMPLETED
		else:
			return ExecutionStatus.RUNNING