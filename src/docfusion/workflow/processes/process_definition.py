"""
Visual workflow designer and process definition management.

This module provides comprehensive workflow design capabilities including
visual workflow designer, process validation, versioning, and testing.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field, ConfigDict
from ...core.utils import uuid7str

logger = logging.getLogger(__name__)

class NodeType(str, Enum):
	"""Types of workflow nodes."""
	START = "start"
	END = "end"
	TASK = "task"
	DECISION = "decision"
	PARALLEL = "parallel"
	MERGE = "merge"
	SUBPROCESS = "subprocess"
	TIMER = "timer"
	EVENT = "event"
	GATEWAY = "gateway"
	USER_TASK = "user_task"
	SERVICE_TASK = "service_task"
	SCRIPT_TASK = "script_task"
	MANUAL_TASK = "manual_task"
	RECEIVE_TASK = "receive_task"
	SEND_TASK = "send_task"

class EdgeType(str, Enum):
	"""Types of workflow edges."""
	SEQUENCE = "sequence"
	CONDITIONAL = "conditional"
	DEFAULT = "default"
	MESSAGE = "message"
	ASSOCIATION = "association"

class ProcessStatus(str, Enum):
	"""Process definition statuses."""
	DRAFT = "draft"
	ACTIVE = "active"
	INACTIVE = "inactive"
	DEPRECATED = "deprecated"
	ARCHIVED = "archived"

class ValidationSeverity(str, Enum):
	"""Validation issue severities."""
	ERROR = "error"
	WARNING = "warning"
	INFO = "info"

class WorkflowNode(BaseModel):
	"""Workflow node definition."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	node_id: str = Field(default_factory=uuid7str)
	name: str = Field(description="Display name for the node")
	node_type: NodeType = Field(description="Type of workflow node")
	description: str = Field("", description="Node description")
	
	# Visual positioning
	x: float = Field(0.0, description="X coordinate in visual designer")
	y: float = Field(0.0, description="Y coordinate in visual designer")
	width: float = Field(100.0, description="Node width")
	height: float = Field(50.0, description="Node height")
	
	# Node configuration
	properties: Dict[str, Any] = Field(default_factory=dict, description="Node-specific properties")
	input_parameters: Dict[str, Any] = Field(default_factory=dict, description="Input parameter definitions")
	output_parameters: Dict[str, Any] = Field(default_factory=dict, description="Output parameter definitions")
	
	# Execution configuration
	timeout_seconds: Optional[int] = Field(None, description="Execution timeout")
	retry_count: int = Field(0, description="Number of retry attempts")
	retry_delay_seconds: int = Field(60, description="Delay between retries")
	
	# Assignment and roles
	assigned_users: List[str] = Field(default_factory=list, description="Assigned user IDs")
	assigned_roles: List[str] = Field(default_factory=list, description="Assigned role names")
	escalation_users: List[str] = Field(default_factory=list, description="Escalation user IDs")
	escalation_delay_hours: int = Field(24, description="Hours before escalation")
	
	# Conditions and rules
	pre_conditions: List[str] = Field(default_factory=list, description="Pre-execution conditions")
	post_conditions: List[str] = Field(default_factory=list, description="Post-execution conditions")
	business_rules: List[str] = Field(default_factory=list, description="Business rule references")
	
	# Metadata
	created_at: datetime = Field(default_factory=datetime.now)
	created_by: str = Field("", description="Creator user ID")
	tags: List[str] = Field(default_factory=list, description="Node tags")

class WorkflowEdge(BaseModel):
	"""Workflow edge (connection) definition."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	edge_id: str = Field(default_factory=uuid7str)
	name: str = Field("", description="Edge name/label")
	edge_type: EdgeType = Field(EdgeType.SEQUENCE, description="Type of edge")
	
	# Connection points
	source_node_id: str = Field(description="Source node ID")
	target_node_id: str = Field(description="Target node ID")
	source_port: str = Field("out", description="Source port name")
	target_port: str = Field("in", description="Target port name")
	
	# Visual routing
	waypoints: List[Tuple[float, float]] = Field(default_factory=list, description="Edge waypoints")
	
	# Conditional logic
	condition: str = Field("", description="Condition expression for conditional edges")
	priority: int = Field(100, description="Edge priority for multiple outgoing edges")
	
	# Data mapping
	data_mapping: Dict[str, str] = Field(default_factory=dict, description="Data transformation mapping")
	
	# Metadata
	properties: Dict[str, Any] = Field(default_factory=dict, description="Edge-specific properties")

class ValidationIssue(BaseModel):
	"""Workflow validation issue."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	issue_id: str = Field(default_factory=uuid7str)
	severity: ValidationSeverity = Field(description="Issue severity")
	message: str = Field(description="Issue description")
	node_id: Optional[str] = Field(None, description="Related node ID")
	edge_id: Optional[str] = Field(None, description="Related edge ID")
	suggestion: Optional[str] = Field(None, description="Suggested fix")
	rule_name: str = Field("", description="Validation rule that triggered this issue")

class WorkflowValidationResult(BaseModel):
	"""Result of workflow validation."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	is_valid: bool = Field(description="Whether workflow is valid")
	issues: List[ValidationIssue] = Field(default_factory=list, description="Validation issues")
	warnings_count: int = Field(0, description="Number of warnings")
	errors_count: int = Field(0, description="Number of errors")
	validation_time: datetime = Field(default_factory=datetime.now)
	validator_version: str = Field("1.0.0", description="Validator version used")

class ProcessMetadata(BaseModel):
	"""Process metadata and version information."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	process_id: str = Field(default_factory=uuid7str)
	name: str = Field(description="Process name")
	version: str = Field("1.0.0", description="Process version")
	description: str = Field("", description="Process description")
	
	# Lifecycle
	status: ProcessStatus = Field(ProcessStatus.DRAFT, description="Process status")
	created_at: datetime = Field(default_factory=datetime.now)
	created_by: str = Field(description="Creator user ID")
	modified_at: datetime = Field(default_factory=datetime.now)
	modified_by: str = Field(description="Last modifier user ID")
	
	# Categorization
	category: str = Field("", description="Process category")
	tags: List[str] = Field(default_factory=list, description="Process tags")
	industry: str = Field("", description="Target industry")
	department: str = Field("", description="Target department")
	
	# Performance expectations
	expected_duration_hours: Optional[float] = Field(None, description="Expected process duration")
	sla_hours: Optional[float] = Field(None, description="Service level agreement")
	complexity_score: float = Field(1.0, description="Process complexity (1-10)")
	
	# Documentation
	documentation_url: Optional[str] = Field(None, description="Link to detailed documentation")
	training_materials: List[str] = Field(default_factory=list, description="Training material links")
	
	# Access control
	owner_user_id: str = Field(description="Process owner")
	editor_user_ids: List[str] = Field(default_factory=list, description="Users who can edit")
	viewer_user_ids: List[str] = Field(default_factory=list, description="Users who can view")

@dataclass
class ProcessTestResult:
	"""Result of process testing."""
	test_id: str
	process_id: str
	test_scenario: str
	success: bool
	execution_time_seconds: float
	issues_found: List[str]
	test_data: Dict[str, Any]
	timestamp: datetime = field(default_factory=datetime.now)

class ProcessDefinition:
	"""
	Visual workflow designer and process definition management.
	
	Provides comprehensive workflow design capabilities including visual
	workflow designer, process validation, versioning, and testing.
	"""
	
	def __init__(self, storage_path: Optional[str] = None):
		self.processes: Dict[str, ProcessMetadata] = {}  # process_id -> metadata
		self.process_definitions: Dict[str, Dict[str, Any]] = {}  # process_id -> definition
		self.nodes: Dict[str, Dict[str, WorkflowNode]] = {}  # process_id -> node_id -> node
		self.edges: Dict[str, Dict[str, WorkflowEdge]] = {}  # process_id -> edge_id -> edge
		self.validation_results: Dict[str, WorkflowValidationResult] = {}  # process_id -> result
		self.test_results: Dict[str, List[ProcessTestResult]] = {}  # process_id -> test results
		self.process_subscribers: List[callable] = []
		self.storage_path = storage_path
		self._lock = asyncio.Lock()
		
		# Validation rules
		self.validation_rules = self._initialize_validation_rules()
		
		logger.info("ProcessDefinition initialized")
	
	async def create_process(
		self,
		name: str,
		description: str,
		created_by: str,
		category: str = "",
		industry: str = "",
		department: str = ""
	) -> ProcessMetadata:
		"""
		Create a new workflow process definition.
		
		Args:
			name: Process name
			description: Process description
			created_by: Creator user ID
			category: Process category
			industry: Target industry
			department: Target department
			
		Returns:
			ProcessMetadata: Created process metadata
		"""
		async with self._lock:
			process_metadata = ProcessMetadata(
				name=name,
				description=description,
				created_by=created_by,
				modified_by=created_by,
				category=category,
				industry=industry,
				department=department,
				owner_user_id=created_by
			)
			
			process_id = process_metadata.process_id
			
			# Initialize empty process definition
			self.processes[process_id] = process_metadata
			self.process_definitions[process_id] = {
				"metadata": process_metadata.dict(),
				"nodes": {},
				"edges": {},
				"variables": {},
				"configuration": {}
			}
			self.nodes[process_id] = {}
			self.edges[process_id] = {}
			
			logger.info(f"Created process: {name} ({process_id})")
			
			# Notify subscribers
			await self._notify_process_change("process_created", process_metadata)
			
			return process_metadata
	
	async def add_node(
		self,
		process_id: str,
		node_type: NodeType,
		name: str,
		x: float = 0.0,
		y: float = 0.0,
		properties: Optional[Dict[str, Any]] = None
	) -> WorkflowNode:
		"""
		Add a node to the workflow process.
		
		Args:
			process_id: Process identifier
			node_type: Type of node to add
			name: Node name
			x: X coordinate
			y: Y coordinate
			properties: Node properties
			
		Returns:
			WorkflowNode: Created workflow node
		"""
		async with self._lock:
			if process_id not in self.processes:
				raise ValueError(f"Process {process_id} not found")
			
			node = WorkflowNode(
				name=name,
				node_type=node_type,
				x=x,
				y=y,
				properties=properties or {}
			)
			
			self.nodes[process_id][node.node_id] = node
			
			# Update process definition
			self.process_definitions[process_id]["nodes"][node.node_id] = node.dict()
			
			# Update modification timestamp
			self.processes[process_id].modified_at = datetime.now()
			
			logger.info(f"Added {node_type.value} node '{name}' to process {process_id}")
			
			# Invalidate validation cache
			if process_id in self.validation_results:
				del self.validation_results[process_id]
			
			# Notify subscribers
			await self._notify_process_change("node_added", node, {"process_id": process_id})
			
			return node
	
	async def add_edge(
		self,
		process_id: str,
		source_node_id: str,
		target_node_id: str,
		edge_type: EdgeType = EdgeType.SEQUENCE,
		name: str = "",
		condition: str = ""
	) -> WorkflowEdge:
		"""
		Add an edge (connection) between nodes.
		
		Args:
			process_id: Process identifier
			source_node_id: Source node ID
			target_node_id: Target node ID
			edge_type: Type of edge
			name: Edge name/label
			condition: Condition expression
			
		Returns:
			WorkflowEdge: Created workflow edge
		"""
		async with self._lock:
			if process_id not in self.processes:
				raise ValueError(f"Process {process_id} not found")
			
			if source_node_id not in self.nodes[process_id]:
				raise ValueError(f"Source node {source_node_id} not found")
			
			if target_node_id not in self.nodes[process_id]:
				raise ValueError(f"Target node {target_node_id} not found")
			
			edge = WorkflowEdge(
				name=name,
				edge_type=edge_type,
				source_node_id=source_node_id,
				target_node_id=target_node_id,
				condition=condition
			)
			
			self.edges[process_id][edge.edge_id] = edge
			
			# Update process definition
			self.process_definitions[process_id]["edges"][edge.edge_id] = edge.dict()
			
			# Update modification timestamp
			self.processes[process_id].modified_at = datetime.now()
			
			logger.info(f"Added edge from {source_node_id} to {target_node_id} in process {process_id}")
			
			# Invalidate validation cache
			if process_id in self.validation_results:
				del self.validation_results[process_id]
			
			# Notify subscribers
			await self._notify_process_change("edge_added", edge, {"process_id": process_id})
			
			return edge
	
	async def update_node(
		self,
		process_id: str,
		node_id: str,
		updates: Dict[str, Any]
	) -> WorkflowNode:
		"""
		Update an existing workflow node.
		
		Args:
			process_id: Process identifier
			node_id: Node identifier
			updates: Fields to update
			
		Returns:
			WorkflowNode: Updated workflow node
		"""
		async with self._lock:
			if process_id not in self.nodes or node_id not in self.nodes[process_id]:
				raise ValueError(f"Node {node_id} not found in process {process_id}")
			
			node = self.nodes[process_id][node_id]
			
			# Apply updates
			for field, value in updates.items():
				if hasattr(node, field):
					setattr(node, field, value)
			
			# Update process definition
			self.process_definitions[process_id]["nodes"][node_id] = node.dict()
			
			# Update modification timestamp
			self.processes[process_id].modified_at = datetime.now()
			
			logger.info(f"Updated node {node_id} in process {process_id}")
			
			# Invalidate validation cache
			if process_id in self.validation_results:
				del self.validation_results[process_id]
			
			# Notify subscribers
			await self._notify_process_change("node_updated", node, {"process_id": process_id})
			
			return node
	
	async def remove_node(self, process_id: str, node_id: str) -> bool:
		"""
		Remove a node from the workflow process.
		
		Args:
			process_id: Process identifier
			node_id: Node identifier
			
		Returns:
			bool: True if node was removed
		"""
		async with self._lock:
			if process_id not in self.nodes or node_id not in self.nodes[process_id]:
				return False
			
			# Remove connected edges
			edges_to_remove = []
			for edge_id, edge in self.edges[process_id].items():
				if edge.source_node_id == node_id or edge.target_node_id == node_id:
					edges_to_remove.append(edge_id)
			
			for edge_id in edges_to_remove:
				del self.edges[process_id][edge_id]
				del self.process_definitions[process_id]["edges"][edge_id]
			
			# Remove node
			node = self.nodes[process_id][node_id]
			del self.nodes[process_id][node_id]
			del self.process_definitions[process_id]["nodes"][node_id]
			
			# Update modification timestamp
			self.processes[process_id].modified_at = datetime.now()
			
			logger.info(f"Removed node {node_id} from process {process_id}")
			
			# Invalidate validation cache
			if process_id in self.validation_results:
				del self.validation_results[process_id]
			
			# Notify subscribers
			await self._notify_process_change("node_removed", node, {"process_id": process_id})
			
			return True
	
	async def validate_process(self, process_id: str) -> WorkflowValidationResult:
		"""
		Validate workflow process definition.
		
		Args:
			process_id: Process identifier
			
		Returns:
			WorkflowValidationResult: Validation results
		"""
		if process_id not in self.processes:
			raise ValueError(f"Process {process_id} not found")
		
		# Check cache
		if process_id in self.validation_results:
			return self.validation_results[process_id]
		
		issues: List[ValidationIssue] = []
		
		# Apply validation rules
		for rule_name, rule_func in self.validation_rules.items():
			try:
				rule_issues = await rule_func(process_id, self.nodes[process_id], self.edges[process_id])
				for issue in rule_issues:
					issue.rule_name = rule_name
				issues.extend(rule_issues)
			except Exception as e:
				logger.error(f"Error in validation rule {rule_name}: {e}")
				issues.append(ValidationIssue(
					severity=ValidationSeverity.ERROR,
					message=f"Validation rule error: {e}",
					rule_name=rule_name
				))
		
		# Count issues by severity
		errors_count = sum(1 for issue in issues if issue.severity == ValidationSeverity.ERROR)
		warnings_count = sum(1 for issue in issues if issue.severity == ValidationSeverity.WARNING)
		
		result = WorkflowValidationResult(
			is_valid=errors_count == 0,
			issues=issues,
			errors_count=errors_count,
			warnings_count=warnings_count
		)
		
		# Cache result
		self.validation_results[process_id] = result
		
		logger.info(f"Validated process {process_id}: {errors_count} errors, {warnings_count} warnings")
		
		return result
	
	async def test_process(
		self,
		process_id: str,
		test_scenario: str,
		test_data: Dict[str, Any]
	) -> ProcessTestResult:
		"""
		Test workflow process with sample data.
		
		Args:
			process_id: Process identifier
			test_scenario: Test scenario name
			test_data: Test input data
			
		Returns:
			ProcessTestResult: Test execution results
		"""
		if process_id not in self.processes:
			raise ValueError(f"Process {process_id} not found")
		
		start_time = datetime.now()
		issues_found = []
		
		try:
			# First validate the process
			validation_result = await self.validate_process(process_id)
			if not validation_result.is_valid:
				issues_found.extend([f"Validation error: {issue.message}" for issue in validation_result.issues])
			
			# Simulate process execution
			await self._simulate_process_execution(process_id, test_data, issues_found)
			
			success = len(issues_found) == 0
			
		except Exception as e:
			success = False
			issues_found.append(f"Test execution error: {e}")
			logger.error(f"Error testing process {process_id}: {e}")
		
		execution_time = (datetime.now() - start_time).total_seconds()
		
		test_result = ProcessTestResult(
			test_id=uuid7str(),
			process_id=process_id,
			test_scenario=test_scenario,
			success=success,
			execution_time_seconds=execution_time,
			issues_found=issues_found,
			test_data=test_data
		)
		
		# Store test result
		if process_id not in self.test_results:
			self.test_results[process_id] = []
		self.test_results[process_id].append(test_result)
		
		logger.info(f"Tested process {process_id}: {'PASS' if success else 'FAIL'} in {execution_time:.2f}s")
		
		return test_result
	
	async def get_process(self, process_id: str) -> Optional[ProcessMetadata]:
		"""
		Get process metadata.
		
		Args:
			process_id: Process identifier
			
		Returns:
			Optional[ProcessMetadata]: Process metadata if found
		"""
		return self.processes.get(process_id)
	
	async def get_process_definition(self, process_id: str) -> Optional[Dict[str, Any]]:
		"""
		Get complete process definition.
		
		Args:
			process_id: Process identifier
			
		Returns:
			Optional[Dict[str, Any]]: Process definition if found
		"""
		return self.process_definitions.get(process_id)
	
	async def get_process_nodes(self, process_id: str) -> Dict[str, WorkflowNode]:
		"""
		Get all nodes for a process.
		
		Args:
			process_id: Process identifier
			
		Returns:
			Dict[str, WorkflowNode]: Process nodes
		"""
		return self.nodes.get(process_id, {})
	
	async def get_process_edges(self, process_id: str) -> Dict[str, WorkflowEdge]:
		"""
		Get all edges for a process.
		
		Args:
			process_id: Process identifier
			
		Returns:
			Dict[str, WorkflowEdge]: Process edges
		"""
		return self.edges.get(process_id, {})
	
	async def export_process(self, process_id: str, format: str = "json") -> str:
		"""
		Export process definition to specified format.
		
		Args:
			process_id: Process identifier
			format: Export format (json, bpmn, xml)
			
		Returns:
			str: Exported process definition
		"""
		if process_id not in self.process_definitions:
			raise ValueError(f"Process {process_id} not found")
		
		definition = self.process_definitions[process_id]
		
		if format.lower() == "json":
			return json.dumps(definition, indent=2, default=str)
		elif format.lower() == "bpmn":
			return await self._export_to_bpmn(definition)
		elif format.lower() == "xml":
			return await self._export_to_xml(definition)
		else:
			raise ValueError(f"Unsupported export format: {format}")
	
	async def import_process(
		self,
		definition_data: str,
		format: str = "json",
		imported_by: str = ""
	) -> ProcessMetadata:
		"""
		Import process definition from specified format.
		
		Args:
			definition_data: Process definition data
			format: Import format (json, bpmn, xml)
			imported_by: User importing the process
			
		Returns:
			ProcessMetadata: Imported process metadata
		"""
		if format.lower() == "json":
			definition = json.loads(definition_data)
		elif format.lower() == "bpmn":
			definition = await self._import_from_bpmn(definition_data)
		elif format.lower() == "xml":
			definition = await self._import_from_xml(definition_data)
		else:
			raise ValueError(f"Unsupported import format: {format}")
		
		# Create process from imported definition
		metadata = ProcessMetadata(**definition["metadata"])
		metadata.process_id = uuid7str()  # Generate new ID
		metadata.created_by = imported_by
		metadata.modified_by = imported_by
		metadata.created_at = datetime.now()
		metadata.modified_at = datetime.now()
		
		async with self._lock:
			process_id = metadata.process_id
			
			self.processes[process_id] = metadata
			self.process_definitions[process_id] = definition
			
			# Import nodes
			self.nodes[process_id] = {}
			for node_data in definition.get("nodes", {}).values():
				node = WorkflowNode(**node_data)
				self.nodes[process_id][node.node_id] = node
			
			# Import edges
			self.edges[process_id] = {}
			for edge_data in definition.get("edges", {}).values():
				edge = WorkflowEdge(**edge_data)
				self.edges[process_id][edge.edge_id] = edge
		
		logger.info(f"Imported process: {metadata.name} ({process_id})")
		
		return metadata
	
	async def subscribe_to_process_changes(self, callback: callable) -> str:
		"""
		Subscribe to process change notifications.
		
		Args:
			callback: Callback function for process events
			
		Returns:
			str: Subscription ID
		"""
		self.process_subscribers.append(callback)
		subscription_id = uuid7str()
		logger.info("New process change subscription added")
		return subscription_id
	
	def _initialize_validation_rules(self) -> Dict[str, callable]:
		"""Initialize workflow validation rules."""
		return {
			"has_start_node": self._validate_has_start_node,
			"has_end_node": self._validate_has_end_node,
			"no_orphaned_nodes": self._validate_no_orphaned_nodes,
			"no_circular_dependencies": self._validate_no_circular_dependencies,
			"valid_connections": self._validate_valid_connections,
			"decision_node_conditions": self._validate_decision_node_conditions,
			"node_assignments": self._validate_node_assignments,
			"edge_consistency": self._validate_edge_consistency
		}
	
	async def _validate_has_start_node(
		self,
		process_id: str,
		nodes: Dict[str, WorkflowNode],
		edges: Dict[str, WorkflowEdge]
	) -> List[ValidationIssue]:
		"""Validate that process has at least one start node."""
		start_nodes = [node for node in nodes.values() if node.node_type == NodeType.START]
		
		if not start_nodes:
			return [ValidationIssue(
				severity=ValidationSeverity.ERROR,
				message="Process must have at least one start node",
				suggestion="Add a start node to define the process entry point"
			)]
		
		if len(start_nodes) > 1:
			return [ValidationIssue(
				severity=ValidationSeverity.WARNING,
				message=f"Process has {len(start_nodes)} start nodes, consider consolidating",
				suggestion="Multiple start nodes may make the process confusing"
			)]
		
		return []
	
	async def _validate_has_end_node(
		self,
		process_id: str,
		nodes: Dict[str, WorkflowNode],
		edges: Dict[str, WorkflowEdge]
	) -> List[ValidationIssue]:
		"""Validate that process has at least one end node."""
		end_nodes = [node for node in nodes.values() if node.node_type == NodeType.END]
		
		if not end_nodes:
			return [ValidationIssue(
				severity=ValidationSeverity.ERROR,
				message="Process must have at least one end node",
				suggestion="Add an end node to define process completion"
			)]
		
		return []
	
	async def _validate_no_orphaned_nodes(
		self,
		process_id: str,
		nodes: Dict[str, WorkflowNode],
		edges: Dict[str, WorkflowEdge]
	) -> List[ValidationIssue]:
		"""Validate that all nodes are connected."""
		issues = []
		
		# Find nodes with no incoming or outgoing edges
		for node in nodes.values():
			if node.node_type in [NodeType.START, NodeType.END]:
				continue  # Start/end nodes may have only one connection
			
			incoming = [e for e in edges.values() if e.target_node_id == node.node_id]
			outgoing = [e for e in edges.values() if e.source_node_id == node.node_id]
			
			if not incoming and not outgoing:
				issues.append(ValidationIssue(
					severity=ValidationSeverity.ERROR,
					message=f"Node '{node.name}' is orphaned (no connections)",
					node_id=node.node_id,
					suggestion="Connect the node to the workflow or remove it"
				))
		
		return issues
	
	async def _validate_no_circular_dependencies(
		self,
		process_id: str,
		nodes: Dict[str, WorkflowNode],
		edges: Dict[str, WorkflowEdge]
	) -> List[ValidationIssue]:
		"""Validate that process has no circular dependencies."""
		# Build adjacency list
		graph = {}
		for node_id in nodes.keys():
			graph[node_id] = []
		
		for edge in edges.values():
			if edge.source_node_id in graph:
				graph[edge.source_node_id].append(edge.target_node_id)
		
		# Detect cycles using DFS
		visited = set()
		rec_stack = set()
		
		def has_cycle(node_id):
			visited.add(node_id)
			rec_stack.add(node_id)
			
			for neighbor in graph.get(node_id, []):
				if neighbor not in visited:
					if has_cycle(neighbor):
						return True
				elif neighbor in rec_stack:
					return True
			
			rec_stack.remove(node_id)
			return False
		
		for node_id in nodes.keys():
			if node_id not in visited:
				if has_cycle(node_id):
					return [ValidationIssue(
						severity=ValidationSeverity.ERROR,
						message="Process contains circular dependencies",
						suggestion="Review workflow paths to eliminate cycles"
					)]
		
		return []
	
	async def _validate_valid_connections(
		self,
		process_id: str,
		nodes: Dict[str, WorkflowNode],
		edges: Dict[str, WorkflowEdge]
	) -> List[ValidationIssue]:
		"""Validate that all edge connections are valid."""
		issues = []
		
		for edge in edges.values():
			if edge.source_node_id not in nodes:
				issues.append(ValidationIssue(
					severity=ValidationSeverity.ERROR,
					message=f"Edge references invalid source node: {edge.source_node_id}",
					edge_id=edge.edge_id
				))
			
			if edge.target_node_id not in nodes:
				issues.append(ValidationIssue(
					severity=ValidationSeverity.ERROR,
					message=f"Edge references invalid target node: {edge.target_node_id}",
					edge_id=edge.edge_id
				))
		
		return issues
	
	async def _validate_decision_node_conditions(
		self,
		process_id: str,
		nodes: Dict[str, WorkflowNode],
		edges: Dict[str, WorkflowEdge]
	) -> List[ValidationIssue]:
		"""Validate decision node conditions."""
		issues = []
		
		for node in nodes.values():
			if node.node_type == NodeType.DECISION:
				outgoing_edges = [e for e in edges.values() if e.source_node_id == node.node_id]
				
				if len(outgoing_edges) < 2:
					issues.append(ValidationIssue(
						severity=ValidationSeverity.WARNING,
						message=f"Decision node '{node.name}' should have at least 2 outgoing paths",
						node_id=node.node_id
					))
				
				# Check that at least one edge has a condition
				conditional_edges = [e for e in outgoing_edges if e.condition]
				if not conditional_edges:
					issues.append(ValidationIssue(
						severity=ValidationSeverity.WARNING,
						message=f"Decision node '{node.name}' has no conditional edges",
						node_id=node.node_id
					))
		
		return issues
	
	async def _validate_node_assignments(
		self,
		process_id: str,
		nodes: Dict[str, WorkflowNode],
		edges: Dict[str, WorkflowEdge]
	) -> List[ValidationIssue]:
		"""Validate user task assignments."""
		issues = []
		
		for node in nodes.values():
			if node.node_type == NodeType.USER_TASK:
				if not node.assigned_users and not node.assigned_roles:
					issues.append(ValidationIssue(
						severity=ValidationSeverity.WARNING,
						message=f"User task '{node.name}' has no assignments",
						node_id=node.node_id,
						suggestion="Assign users or roles to handle this task"
					))
		
		return issues
	
	async def _validate_edge_consistency(
		self,
		process_id: str,
		nodes: Dict[str, WorkflowNode],
		edges: Dict[str, WorkflowEdge]
	) -> List[ValidationIssue]:
		"""Validate edge consistency."""
		issues = []
		
		# Check for duplicate edges
		edge_connections = set()
		for edge in edges.values():
			connection = (edge.source_node_id, edge.target_node_id)
			if connection in edge_connections:
				issues.append(ValidationIssue(
					severity=ValidationSeverity.WARNING,
					message=f"Duplicate edge between {edge.source_node_id} and {edge.target_node_id}",
					edge_id=edge.edge_id
				))
			edge_connections.add(connection)
		
		return issues
	
	async def _simulate_process_execution(
		self,
		process_id: str,
		test_data: Dict[str, Any],
		issues_found: List[str]
	):
		"""Simulate process execution for testing."""
		nodes = self.nodes[process_id]
		edges = self.edges[process_id]
		
		# Find start nodes
		start_nodes = [n for n in nodes.values() if n.node_type == NodeType.START]
		if not start_nodes:
			issues_found.append("No start node found for execution")
			return
		
		# Simulate execution path
		current_nodes = [start_nodes[0].node_id]
		visited_nodes = set()
		execution_steps = 0
		max_steps = len(nodes) * 2  # Prevent infinite loops
		
		while current_nodes and execution_steps < max_steps:
			execution_steps += 1
			next_nodes = []
			
			for node_id in current_nodes:
				if node_id in visited_nodes:
					continue
				
				visited_nodes.add(node_id)
				
				# Find outgoing edges
				outgoing_edges = [e for e in edges.values() if e.source_node_id == node_id]
				
				for edge in outgoing_edges:
					# Simulate condition evaluation
					if edge.condition:
						# Simple condition simulation
						condition_met = True  # Would evaluate actual condition
						if condition_met:
							next_nodes.append(edge.target_node_id)
					else:
						next_nodes.append(edge.target_node_id)
			
			current_nodes = next_nodes
		
		if execution_steps >= max_steps:
			issues_found.append("Process execution exceeded maximum steps (possible infinite loop)")
		
		# Check if we reached an end node
		end_nodes_reached = any(
			nodes[node_id].node_type == NodeType.END 
			for node_id in visited_nodes
			if node_id in nodes
		)
		
		if not end_nodes_reached:
			issues_found.append("Process execution did not reach an end node")
	
	async def _export_to_bpmn(self, definition: Dict[str, Any]) -> str:
		"""Export process to BPMN format."""
		# Simplified BPMN export (would use proper BPMN library in production)
		bpmn_xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
		bpmn_xml += '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">\n'
		bpmn_xml += '  <process id="Process_1">\n'
		
		# Add nodes
		for node_data in definition.get("nodes", {}).values():
			node_type = node_data["node_type"]
			bpmn_xml += f'    <{node_type} id="{node_data["node_id"]}" name="{node_data["name"]}" />\n'
		
		# Add edges
		for edge_data in definition.get("edges", {}).values():
			bpmn_xml += f'    <sequenceFlow id="{edge_data["edge_id"]}" '
			bpmn_xml += f'sourceRef="{edge_data["source_node_id"]}" '
			bpmn_xml += f'targetRef="{edge_data["target_node_id"]}" />\n'
		
		bpmn_xml += '  </process>\n'
		bpmn_xml += '</definitions>'
		
		return bpmn_xml
	
	async def _export_to_xml(self, definition: Dict[str, Any]) -> str:
		"""Export process to XML format."""
		# Simplified XML export
		return json.dumps(definition, indent=2)  # Would use proper XML library
	
	async def _import_from_bpmn(self, bpmn_data: str) -> Dict[str, Any]:
		"""Import process from BPMN format."""
		# Simplified BPMN import (would use proper BPMN parser in production)
		return {"error": "BPMN import not implemented"}
	
	async def _import_from_xml(self, xml_data: str) -> Dict[str, Any]:
		"""Import process from XML format."""
		# Simplified XML import
		return json.loads(xml_data)  # Would use proper XML parser
	
	async def _notify_process_change(
		self,
		event_type: str,
		data: Any,
		additional_data: Optional[Dict[str, Any]] = None
	):
		"""Notify subscribers of process changes."""
		event_data = {
			"event_type": event_type,
			"data": data,
			"timestamp": datetime.now().isoformat()
		}
		
		if additional_data:
			event_data.update(additional_data)
		
		for callback in self.process_subscribers:
			try:
				if asyncio.iscoroutinefunction(callback):
					await callback(event_data)
				else:
					callback(event_data)
			except Exception as e:
				logger.error(f"Error in process change callback: {e}")
	
	async def cleanup(self):
		"""Clean up process definition resources."""
		async with self._lock:
			self.processes.clear()
			self.process_definitions.clear()
			self.nodes.clear()
			self.edges.clear()
			self.validation_results.clear()
			self.test_results.clear()
			self.process_subscribers.clear()
		
		logger.info("ProcessDefinition cleaned up")
