"""
Agent Composition Language Runner

Executes interpreted compositions with support for parallel execution,
error handling, monitoring, and real-time workflow orchestration.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import json
import logging
import random
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncIterator, Callable, Dict, List, Optional, Union

from simpleeval import simple_eval, InvalidExpression, NameNotDefined, FunctionNotDefined

from pydantic import BaseModel, ConfigDict, Field

from ..core.utils import uuid7str
from .interpreter import (
    ExecutionGraph,
    ExecutionMode,
    ExecutionNode,
    InterpretedComposition,
    NodeType,
)

class ExecutionStatus(Enum):
    """Execution status states"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"
    RETRYING = "retrying"

class NodeExecutionResult(BaseModel):
    """Result of individual node execution"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    node_id: str
    status: ExecutionStatus
    start_time: float
    end_time: Optional[float] = None
    duration: Optional[float] = None
    output: Optional[Any] = None
    error: Optional[str] = None
    retry_count: int = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)

@dataclass
class ExecutionContext:
    """Context for workflow execution"""

    execution_id: str
    composition_id: str
    input_data: Dict[str, Any]
    variables: Dict[str, Any]
    agent_results: Dict[str, Any] = field(default_factory=dict)
    global_config: Dict[str, Any] = field(default_factory=dict)
    runtime_state: Dict[str, Any] = field(default_factory=dict)
    start_time: float = field(default_factory=time.time)
    cancellation_token: Optional[asyncio.Event] = None

@dataclass
class ExecutionReport:
    """Complete execution report"""

    execution_id: str
    composition_id: str
    status: ExecutionStatus
    start_time: float
    end_time: Optional[float]
    duration: Optional[float]
    total_nodes: int
    successful_nodes: int
    failed_nodes: int
    node_results: Dict[str, NodeExecutionResult]
    error_summary: List[str]
    performance_metrics: Dict[str, Any]
    resource_usage: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)

class CompositionRunnerError(Exception):
    """Exception raised during composition execution"""

    def __init__(
        self,
        message: str,
        execution_id: Optional[str] = None,
        node_id: Optional[str] = None,
    ):
        self.message = message
        self.execution_id = execution_id
        self.node_id = node_id
        super().__init__(self._format_message())

    def _format_message(self) -> str:
        """Format error message with context"""
        msg = f"Composition runner error: {self.message}"
        if self.execution_id:
            msg += f" (execution: {self.execution_id})"
        if self.node_id:
            msg += f" (node: {self.node_id})"
        return msg

class CompositionRunner:
    """
    Executes interpreted Agent Composition Language workflows

    Provides advanced execution capabilities including parallel processing,
    error handling, monitoring, and real-time orchestration.
    """

    def __init__(self, max_workers: int = 10, enable_monitoring: bool = True):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.max_workers = max_workers
        self.enable_monitoring = enable_monitoring
        self.executor = ThreadPoolExecutor(max_workers=max_workers)

        # Runtime state
        self.active_executions: Dict[str, ExecutionContext] = {}
        self.execution_history: List[ExecutionReport] = []

        # Agent registry - would be injected in real implementation
        self.agent_registry: Dict[str, Any] = {}
        self.function_registry: Dict[str, Callable] = {}

        # Performance monitoring
        self.performance_metrics: Dict[str, List[float]] = {}
        self.resource_monitor: Dict[str, Any] = {}

    async def execute_composition(
        self,
        composition: InterpretedComposition,
        input_data: Dict[str, Any],
        execution_options: Optional[Dict[str, Any]] = None,
    ) -> ExecutionReport:
        """Execute complete interpreted composition"""

        execution_id = uuid7str()
        self.logger.info(
            f"Starting execution {execution_id} for composition: {composition.name}"
        )

        try:
            # Create execution context
            context = ExecutionContext(
                execution_id=execution_id,
                composition_id=composition.composition_id,
                input_data=input_data,
                variables={**composition.context_variables, **input_data},
                global_config=composition.global_config,
                cancellation_token=asyncio.Event(),
            )

            # Register execution
            self.active_executions[execution_id] = context

            # Apply execution options
            if execution_options:
                await self._apply_execution_options(context, execution_options)

            # Execute workflow
            execution_report = await self._execute_workflow(composition, context)

            # Store in history
            self.execution_history.append(execution_report)

            self.logger.info(
                f"Completed execution {execution_id} with status: {execution_report.status}"
            )
            return execution_report

        except Exception as e:
            self.logger.error(f"Execution {execution_id} failed: {str(e)}")
            raise CompositionRunnerError(f"Execution failed: {str(e)}", execution_id)

        finally:
            # Clean up
            if execution_id in self.active_executions:
                del self.active_executions[execution_id]

    async def _execute_workflow(
        self, composition: InterpretedComposition, context: ExecutionContext
    ) -> ExecutionReport:
        """Execute workflow graph"""
        graph = composition.execution_graph
        node_results: Dict[str, NodeExecutionResult] = {}

        start_time = time.time()

        try:
            # Execute in topological order
            for level_index, level_nodes in enumerate(graph.execution_order):
                self.logger.debug(
                    f"Executing level {level_index} with {len(level_nodes)} nodes"
                )

                # Check for cancellation
                if context.cancellation_token and context.cancellation_token.is_set():
                    break

                # Execute nodes in this level
                level_results = await self._execute_level(level_nodes, graph, context)
                node_results.update(level_results)

                # Update context with results
                await self._update_context_with_results(context, level_results)

                # Check if any critical nodes failed
                failed_nodes = [
                    r
                    for r in level_results.values()
                    if r.status == ExecutionStatus.FAILED
                ]
                if failed_nodes and composition.global_config.get("fail_fast", True):
                    self.logger.warning(
                        f"Stopping execution due to {len(failed_nodes)} failed nodes"
                    )
                    break

            # Determine overall status
            end_time = time.time()
            successful_count = sum(
                1
                for r in node_results.values()
                if r.status == ExecutionStatus.COMPLETED
            )
            failed_count = sum(
                1 for r in node_results.values() if r.status == ExecutionStatus.FAILED
            )

            overall_status = (
                ExecutionStatus.COMPLETED
                if failed_count == 0
                else ExecutionStatus.FAILED
            )

            # Generate performance metrics
            performance_metrics = await self._calculate_performance_metrics(
                node_results, start_time, end_time
            )

            # Generate resource usage report
            resource_usage = await self._calculate_resource_usage(node_results)

            return ExecutionReport(
                execution_id=context.execution_id,
                composition_id=context.composition_id,
                status=overall_status,
                start_time=start_time,
                end_time=end_time,
                duration=end_time - start_time,
                total_nodes=len(graph.nodes),
                successful_nodes=successful_count,
                failed_nodes=failed_count,
                node_results=node_results,
                error_summary=[r.error for r in node_results.values() if r.error],
                performance_metrics=performance_metrics,
                resource_usage=resource_usage,
                metadata={
                    "composition_name": composition.name,
                    "execution_levels": len(graph.execution_order),
                    "parallel_groups": len(graph.parallel_groups),
                },
            )

        except Exception as e:
            end_time = time.time()
            return ExecutionReport(
                execution_id=context.execution_id,
                composition_id=context.composition_id,
                status=ExecutionStatus.FAILED,
                start_time=start_time,
                end_time=end_time,
                duration=end_time - start_time,
                total_nodes=len(graph.nodes),
                successful_nodes=0,
                failed_nodes=len(graph.nodes),
                node_results=node_results,
                error_summary=[str(e)],
                performance_metrics={},
                resource_usage={},
                metadata={"error": str(e)},
            )

    async def _execute_level(
        self, level_nodes: List[str], graph: ExecutionGraph, context: ExecutionContext
    ) -> Dict[str, NodeExecutionResult]:
        """Execute all nodes in a level (potentially in parallel)"""

        if len(level_nodes) == 1:
            # Single node - execute directly
            node_id = level_nodes[0]
            result = await self._execute_node(node_id, graph.nodes[node_id], context)
            return {node_id: result}

        else:
            # Multiple nodes - check if they can run in parallel
            parallel_nodes = []
            sequential_nodes = []

            for node_id in level_nodes:
                node = graph.nodes[node_id]
                if node.execution_mode in [
                    ExecutionMode.PARALLEL,
                    ExecutionMode.ASYNCHRONOUS,
                ]:
                    parallel_nodes.append(node_id)
                else:
                    sequential_nodes.append(node_id)

            results = {}

            # Execute parallel nodes concurrently
            if parallel_nodes:
                parallel_tasks = [
                    self._execute_node(node_id, graph.nodes[node_id], context)
                    for node_id in parallel_nodes
                ]
                parallel_results = await asyncio.gather(
                    *parallel_tasks, return_exceptions=True
                )

                for i, result in enumerate(parallel_results):
                    node_id = parallel_nodes[i]
                    if isinstance(result, Exception):
                        results[node_id] = NodeExecutionResult(
                            node_id=node_id,
                            status=ExecutionStatus.FAILED,
                            start_time=time.time(),
                            error=str(result),
                        )
                    else:
                        results[node_id] = result

            # Execute sequential nodes one by one
            for node_id in sequential_nodes:
                result = await self._execute_node(
                    node_id, graph.nodes[node_id], context
                )
                results[node_id] = result

            return results

    async def _execute_node(
        self, node_id: str, node: ExecutionNode, context: ExecutionContext
    ) -> NodeExecutionResult:
        """Execute individual node"""
        start_time = time.time()

        try:
            self.logger.debug(f"Executing node {node_id} ({node.node_type.value})")

            # Check dependencies are satisfied
            if not await self._check_dependencies(node, context):
                return NodeExecutionResult(
                    node_id=node_id,
                    status=ExecutionStatus.FAILED,
                    start_time=start_time,
                    error="Dependencies not satisfied",
                )

            # Execute based on node type
            if node.node_type == NodeType.AGENT:
                output = await self._execute_agent_node(node, context)
            elif node.node_type == NodeType.FUNCTION:
                output = await self._execute_function_node(node, context)
            elif node.node_type == NodeType.CONDITION:
                output = await self._execute_condition_node(node, context)
            elif node.node_type == NodeType.JOIN:
                output = await self._execute_join_node(node, context)
            else:
                raise CompositionRunnerError(f"Unsupported node type: {node.node_type}")

            end_time = time.time()

            return NodeExecutionResult(
                node_id=node_id,
                status=ExecutionStatus.COMPLETED,
                start_time=start_time,
                end_time=end_time,
                duration=end_time - start_time,
                output=output,
                metadata={
                    "node_type": node.node_type.value,
                    "agent_id": node.agent_id,
                    "function_name": node.function_name,
                },
            )

        except Exception as e:
            end_time = time.time()
            self.logger.error(f"Node {node_id} execution failed: {str(e)}")

            # Check if retry is configured and if this error should be retried
            retry_config = node.retry_config
            max_attempts = retry_config.get("max_attempts", 1)

            if max_attempts > 1:
                # Check if this error type should trigger a retry
                retry_on = retry_config.get("retry_on", ["Exception"])
                should_retry = False

                if retry_on == ["Exception"]:  # Default: retry on any exception
                    should_retry = True
                else:
                    for retry_exception in retry_on:
                        if retry_exception in str(type(e).__name__):
                            should_retry = True
                            break

                if should_retry:
                    # Implement retry logic with exponential backoff
                    return await self._execute_node_with_retry(
                        node, context, start_time, e, retry_config
                    )
                else:
                    self.logger.info(
                        f"Error type {type(e).__name__} not configured for retry"
                    )

            return NodeExecutionResult(
                node_id=node_id,
                status=ExecutionStatus.FAILED,
                start_time=start_time,
                end_time=end_time,
                duration=end_time - start_time,
                error=str(e),
                metadata={"node_type": node.node_type.value},
            )

    async def _execute_agent_node(
        self, node: ExecutionNode, context: ExecutionContext
    ) -> Any:
        """Execute agent node"""
        if not node.agent_id:
            raise CompositionRunnerError("Agent node missing agent_id")

        # In real implementation, this would:
        # 1. Get agent from registry
        # 2. Prepare agent input from context
        # 3. Execute agent
        # 4. Return result

        # Simulated agent execution
        agent_input = {
            "prompt": node.metadata.get("prompt", ""),
            "context": context.variables,
            "parameters": node.parameters,
        }

        # Simulate processing time
        await asyncio.sleep(0.1)

        # Return mock result
        return {
            "agent_id": node.agent_id,
            "status": "success",
            "output": f"Generated content for {node.agent_id}",
            "execution_time": 0.1,
            "tokens_used": 150,
        }

    async def _execute_function_node(
        self, node: ExecutionNode, context: ExecutionContext
    ) -> Any:
        """Execute function node"""
        if not node.function_name:
            raise CompositionRunnerError("Function node missing function_name")

        # Get function from registry
        if node.function_name not in self.function_registry:
            # Built-in functions
            if node.function_name == "merge":
                return await self._builtin_merge(node, context)
            elif node.function_name == "filter":
                return await self._builtin_filter(node, context)
            elif node.function_name == "transform":
                return await self._builtin_transform(node, context)
            else:
                raise CompositionRunnerError(f"Unknown function: {node.function_name}")

        # Execute registered function
        func = self.function_registry[node.function_name]
        return await func(node, context)

    async def _execute_condition_node(
        self, node: ExecutionNode, context: ExecutionContext
    ) -> Any:
        """Execute condition node"""
        if not node.condition:
            raise CompositionRunnerError("Condition node missing condition")

        # Evaluate condition
        result = await self._evaluate_condition(node.condition, context)

        return {
            "condition": node.condition,
            "result": result,
            "evaluation_time": time.time(),
        }

    async def _execute_join_node(
        self, node: ExecutionNode, context: ExecutionContext
    ) -> Any:
        """Execute join node"""
        # Wait for all dependencies
        dependency_results = []

        for dep_id in node.dependencies:
            if dep_id in context.agent_results:
                dependency_results.append(context.agent_results[dep_id])

        return {
            "join_type": "synchronization",
            "dependency_count": len(dependency_results),
            "synchronized_at": time.time(),
        }

    async def _check_dependencies(
        self, node: ExecutionNode, context: ExecutionContext
    ) -> bool:
        """Check if node dependencies are satisfied"""
        for dep_id in node.dependencies:
            if dep_id not in context.agent_results:
                return False

            # Check if dependency completed successfully
            dep_result = context.agent_results[dep_id]
            if (
                hasattr(dep_result, "status")
                and dep_result.status != ExecutionStatus.COMPLETED
            ):
                return False

        return True

    async def _update_context_with_results(
        self, context: ExecutionContext, results: Dict[str, NodeExecutionResult]
    ):
        """Update execution context with node results"""
        for node_id, result in results.items():
            context.agent_results[node_id] = result

            # Update variables if output contains variables
            if result.output and isinstance(result.output, dict):
                context.variables.update(result.output)

    async def _evaluate_condition(
        self, condition: str, context: ExecutionContext
    ) -> bool:
        """Evaluate condition expression"""
        # Simple condition evaluation
        # In real implementation, this would use a proper expression evaluator

        if condition == "success":
            return True
        elif condition == "failure":
            return False
        elif condition == "empty":
            return not context.variables
        elif condition == "nonempty":
            return bool(context.variables)
        else:
            try:
                return simple_eval(condition, names={"context": context.variables})
            except (InvalidExpression, NameNotDefined, FunctionNotDefined, TypeError, ValueError, SyntaxError) as e:
                self.logger.warning(f"Condition evaluation failed for '{condition}': {e}")
                return False

    async def _builtin_merge(
        self, node: ExecutionNode, context: ExecutionContext
    ) -> Any:
        """Built-in merge function"""
        inputs = node.parameters.get("inputs", [])
        merged_data = {}

        for input_ref in inputs:
            if input_ref in context.agent_results:
                result = context.agent_results[input_ref]
                if hasattr(result, "output") and result.output:
                    merged_data[input_ref] = result.output

        return {
            "function": "merge",
            "merged_data": merged_data,
            "input_count": len(inputs),
        }

    async def _builtin_filter(
        self, node: ExecutionNode, context: ExecutionContext
    ) -> Any:
        """Built-in filter function"""
        filter_condition = node.parameters.get("condition", "true")
        source_data = node.parameters.get("source", {})

        # Simple filtering logic
        filtered_data = source_data  # In real implementation, apply filter

        return {
            "function": "filter",
            "filtered_data": filtered_data,
            "condition": filter_condition,
        }

    async def _builtin_transform(
        self, node: ExecutionNode, context: ExecutionContext
    ) -> Any:
        """Built-in transform function"""
        template = node.parameters.get("template", "")

        # Simple template substitution
        transformed_output = template
        for var_name, var_value in context.variables.items():
            transformed_output = transformed_output.replace(
                f"{{{var_name}}}", str(var_value)
            )

        return {
            "function": "transform",
            "transformed_output": transformed_output,
            "template": template,
        }

    async def _apply_execution_options(
        self, context: ExecutionContext, options: Dict[str, Any]
    ):
        """Apply execution options to context"""
        if "timeout" in options:
            context.runtime_state["global_timeout"] = options["timeout"]

        if "parallel_limit" in options:
            context.runtime_state["parallel_limit"] = options["parallel_limit"]

        if "retry_policy" in options:
            context.runtime_state["retry_policy"] = options["retry_policy"]

    async def _calculate_performance_metrics(
        self,
        node_results: Dict[str, NodeExecutionResult],
        start_time: float,
        end_time: float,
    ) -> Dict[str, Any]:
        """Calculate performance metrics"""
        durations = [r.duration for r in node_results.values() if r.duration]

        return {
            "total_execution_time": end_time - start_time,
            "average_node_duration": sum(durations) / len(durations)
            if durations
            else 0,
            "max_node_duration": max(durations) if durations else 0,
            "min_node_duration": min(durations) if durations else 0,
            "throughput": len(node_results) / (end_time - start_time)
            if (end_time - start_time) > 0
            else 0,
            "success_rate": sum(
                1
                for r in node_results.values()
                if r.status == ExecutionStatus.COMPLETED
            )
            / len(node_results)
            if node_results
            else 0,
        }

    async def _calculate_resource_usage(
        self, node_results: Dict[str, NodeExecutionResult]
    ) -> Dict[str, Any]:
        """Calculate resource usage metrics"""
        # Mock resource calculation
        return {
            "cpu_time": sum(r.duration or 0 for r in node_results.values()),
            "memory_peak": len(node_results) * 100,  # MB
            "network_requests": len(node_results),
            "agent_invocations": sum(
                1 for r in node_results.values() if "agent_id" in r.metadata
            ),
        }

    async def cancel_execution(self, execution_id: str) -> bool:
        """Cancel running execution"""
        if execution_id in self.active_executions:
            context = self.active_executions[execution_id]
            if context.cancellation_token:
                context.cancellation_token.set()
                self.logger.info(f"Cancelled execution {execution_id}")
                return True
        return False

    async def get_execution_status(self, execution_id: str) -> Optional[Dict[str, Any]]:
        """Get current execution status"""
        if execution_id in self.active_executions:
            context = self.active_executions[execution_id]
            return {
                "execution_id": execution_id,
                "composition_id": context.composition_id,
                "status": "running",
                "start_time": context.start_time,
                "duration": time.time() - context.start_time,
                "completed_nodes": len(context.agent_results),
                "variables": context.variables,
            }

        # Check execution history
        for report in self.execution_history:
            if report.execution_id == execution_id:
                return {
                    "execution_id": execution_id,
                    "status": report.status.value,
                    "duration": report.duration,
                    "successful_nodes": report.successful_nodes,
                    "failed_nodes": report.failed_nodes,
                }

        return None

    async def stream_execution(
        self, composition: InterpretedComposition, input_data: Dict[str, Any]
    ) -> AsyncIterator[Dict[str, Any]]:
        """Stream execution progress in real-time"""
        execution_id = uuid7str()

        # Create context
        context = ExecutionContext(
            execution_id=execution_id,
            composition_id=composition.composition_id,
            input_data=input_data,
            variables={**composition.context_variables, **input_data},
        )

        self.active_executions[execution_id] = context

        try:
            graph = composition.execution_graph

            yield {
                "type": "execution_started",
                "execution_id": execution_id,
                "total_nodes": len(graph.nodes),
                "timestamp": time.time(),
            }

            # Execute levels and stream progress
            for level_index, level_nodes in enumerate(graph.execution_order):
                yield {
                    "type": "level_started",
                    "level": level_index,
                    "nodes": level_nodes,
                    "timestamp": time.time(),
                }

                level_results = await self._execute_level(level_nodes, graph, context)

                for node_id, result in level_results.items():
                    yield {
                        "type": "node_completed",
                        "node_id": node_id,
                        "status": result.status.value,
                        "duration": result.duration,
                        "output": result.output,
                        "timestamp": time.time(),
                    }

            yield {
                "type": "execution_completed",
                "execution_id": execution_id,
                "timestamp": time.time(),
            }

        except Exception as e:
            yield {
                "type": "execution_failed",
                "execution_id": execution_id,
                "error": str(e),
                "timestamp": time.time(),
            }

        finally:
            if execution_id in self.active_executions:
                del self.active_executions[execution_id]

    async def _execute_node_with_retry(
        self,
        node: ExecutionNode,
        context: ExecutionContext,
        initial_start_time: float,
        initial_error: Exception,
        retry_config: Dict[str, Any],
    ) -> NodeExecutionResult:
        """
        Execute node with retry logic using exponential backoff.

        Args:
                node: The execution node to retry
                context: Execution context
                initial_start_time: Start time of the first attempt
                initial_error: The initial error that triggered retry
                retry_config: Retry configuration options

        Returns:
                NodeExecutionResult with retry metadata
        """
        node_id = node.node_id
        max_attempts = retry_config.get("max_attempts", 3)
        base_delay = retry_config.get("base_delay", 1.0)  # seconds
        max_delay = retry_config.get("max_delay", 60.0)  # seconds
        backoff_factor = retry_config.get("backoff_factor", 2.0)
        jitter = retry_config.get("jitter", True)
        retry_on = retry_config.get(
            "retry_on", ["Exception"]
        )  # Exception types to retry on

        last_error = initial_error
        retry_metadata = {
            "attempts": 1,
            "total_duration": 0,
            "errors": [str(initial_error)],
            "retry_delays": [],
        }

        self.logger.info(
            f"Starting retry for node {node_id} (max_attempts: {max_attempts})"
        )

        for attempt in range(
            2, max_attempts + 1
        ):  # Start from 2 since first attempt already failed
            # Check if this error type should trigger a retry
            should_retry = False
            if retry_on == ["Exception"]:  # Default: retry on any exception
                should_retry = True
            else:
                for retry_exception in retry_on:
                    if retry_exception in str(type(last_error).__name__):
                        should_retry = True
                        break

            if not should_retry:
                self.logger.info(
                    f"Error type {type(last_error).__name__} not configured for retry"
                )
                break

            # Calculate delay with exponential backoff
            delay = min(base_delay * (backoff_factor ** (attempt - 2)), max_delay)

            # Add jitter to prevent thundering herd
            if jitter:
                delay = delay * (0.5 + random.random() * 0.5)

            retry_metadata["retry_delays"].append(delay)

            self.logger.info(
                f"Retry attempt {attempt}/{max_attempts} for node {node_id} after {delay:.2f}s delay"
            )

            # Wait before retry
            await asyncio.sleep(delay)

            # Attempt execution again
            try:
                start_time = time.time()

                # Execute based on node type (same logic as main execution)
                if node.node_type == NodeType.AGENT:
                    output = await self._execute_agent_node(node, context)
                elif node.node_type == NodeType.FUNCTION:
                    output = await self._execute_function_node(node, context)
                elif node.node_type == NodeType.CONDITION:
                    output = await self._execute_condition_node(node, context)
                elif node.node_type == NodeType.JOIN:
                    output = await self._execute_join_node(node, context)
                else:
                    raise CompositionRunnerError(
                        f"Unsupported node type: {node.node_type}"
                    )

                end_time = time.time()
                total_duration = end_time - initial_start_time

                # Success after retry
                retry_metadata.update(
                    {
                        "attempts": attempt,
                        "total_duration": total_duration,
                        "successful_attempt": attempt,
                        "success_after_retries": True,
                    }
                )

                self.logger.info(
                    f"Node {node_id} succeeded on attempt {attempt}/{max_attempts}"
                )

                return NodeExecutionResult(
                    node_id=node_id,
                    status=ExecutionStatus.COMPLETED,
                    start_time=initial_start_time,
                    end_time=end_time,
                    duration=total_duration,
                    output=output,
                    metadata={
                        "node_type": node.node_type.value,
                        "agent_id": node.agent_id,
                        "function_name": node.function_name,
                        "retry_metadata": retry_metadata,
                    },
                )

            except Exception as e:
                last_error = e
                retry_metadata["attempts"] = attempt
                retry_metadata["errors"].append(str(e))
                retry_metadata["total_duration"] = time.time() - initial_start_time

                self.logger.warning(
                    f"Retry attempt {attempt}/{max_attempts} failed for node {node_id}: {str(e)}"
                )

        # All retries exhausted
        final_end_time = time.time()
        total_duration = final_end_time - initial_start_time

        retry_metadata.update(
            {
                "total_duration": total_duration,
                "all_attempts_failed": True,
                "final_error": str(last_error),
            }
        )

        self.logger.error(
            f"Node {node_id} failed after {max_attempts} attempts. Final error: {str(last_error)}"
        )

        return NodeExecutionResult(
            node_id=node_id,
            status=ExecutionStatus.FAILED,
            start_time=initial_start_time,
            end_time=final_end_time,
            duration=total_duration,
            error=str(last_error),
            metadata={
                "node_type": node.node_type.value,
                "retry_metadata": retry_metadata,
            },
        )

    def register_agent(self, agent_id: str, agent: Any):
        """Register agent for execution"""
        self.agent_registry[agent_id] = agent
        self.logger.debug(f"Registered agent: {agent_id}")

    def register_function(self, function_name: str, function: Callable):
        """Register custom function for execution"""
        self.function_registry[function_name] = function
        self.logger.debug(f"Registered function: {function_name}")

    def get_performance_summary(self) -> Dict[str, Any]:
        """Get performance summary across all executions"""
        if not self.execution_history:
            return {"message": "No executions recorded"}

        total_executions = len(self.execution_history)
        successful_executions = sum(
            1 for r in self.execution_history if r.status == ExecutionStatus.COMPLETED
        )

        durations = [r.duration for r in self.execution_history if r.duration]

        return {
            "total_executions": total_executions,
            "successful_executions": successful_executions,
            "success_rate": successful_executions / total_executions,
            "average_duration": sum(durations) / len(durations) if durations else 0,
            "total_nodes_executed": sum(r.total_nodes for r in self.execution_history),
            "total_runtime": sum(durations),
            "active_executions": len(self.active_executions),
        }
