"""
Service Coordinator

Cross-package service coordination with API orchestration, health monitoring,
and circuit breaker patterns for complex workflows.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

import aiohttp

from pydantic import BaseModel, ConfigDict, Field
from ...core.utils import uuid7str

class ServiceState(str, Enum):
    """Service health state"""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNAVAILABLE = "unavailable"
    CIRCUIT_OPEN = "circuit_open"

class CircuitBreakerState(str, Enum):
    """Circuit breaker states"""

    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, calls rejected
    HALF_OPEN = "half_open"  # Testing if service recovered

@dataclass
class ServiceCall:
    """Service call tracking"""

    service_name: str
    method: str
    parameters: Dict[str, Any]
    call_id: str = field(default_factory=uuid7str)
    started_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    success: Optional[bool] = None
    error: Optional[str] = None
    response: Any = None
    duration_ms: float = 0.0

@dataclass
class CircuitBreaker:
    """Circuit breaker for service calls"""

    service_name: str
    failure_threshold: int = 5
    success_threshold: int = 3
    timeout_seconds: int = 60

    state: CircuitBreakerState = CircuitBreakerState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: Optional[datetime] = None
    next_attempt_time: Optional[datetime] = None

class ServiceEndpoint(BaseModel):
    """Service endpoint configuration"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_assignment=True)

    name: str
    url: str
    method: str = "POST"
    timeout_seconds: int = 30
    retry_attempts: int = 3
    headers: Dict[str, str] = Field(default_factory=dict)
    auth_required: bool = False
    health_check_path: Optional[str] = None

class ServiceCoordinator:
    """
    Cross-package service coordination with API orchestration

    Manages service discovery, health monitoring, circuit breakers,
    and complex workflow orchestration across multiple services.
    """

    def __init__(self):
        # Service registry and health monitoring
        self.services: Dict[str, Any] = {}
        self.service_endpoints: Dict[str, ServiceEndpoint] = {}
        self.service_states: Dict[str, ServiceState] = {}
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}

        # Call tracking and metrics
        self.active_calls: Dict[str, ServiceCall] = {}
        self.call_history: List[ServiceCall] = []
        self.service_metrics: Dict[str, Dict[str, Any]] = {}

        # Configuration
        self.health_check_interval = 30  # seconds
        self.metrics_retention_hours = 24
        self.max_concurrent_calls_per_service = 10

        # HTTP session for external API calls
        self.http_session: Optional[aiohttp.ClientSession] = None

        self.logger = logging.getLogger("service_coordinator")
        self.logger.info("ServiceCoordinator initialized")

        # Background tasks
        self._health_monitor_task: Optional[asyncio.Task] = None
        self._metrics_cleanup_task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        """Start the service coordinator"""
        if self._running:
            return

        self._running = True

        # Initialize HTTP session
        self.http_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=300)
        )

        # Start background tasks
        self._health_monitor_task = asyncio.create_task(self._health_monitor_loop())
        self._metrics_cleanup_task = asyncio.create_task(self._metrics_cleanup_loop())

        self.logger.info("ServiceCoordinator started")

    async def stop(self) -> None:
        """Stop the service coordinator"""
        if not self._running:
            return

        self._running = False

        # Close HTTP session
        if self.http_session:
            await self.http_session.close()

        # Cancel background tasks
        if self._health_monitor_task:
            self._health_monitor_task.cancel()
        if self._metrics_cleanup_task:
            self._metrics_cleanup_task.cancel()

        self.logger.info("ServiceCoordinator stopped")

    def register_service(
        self, name: str, service: Any, endpoint: Optional[ServiceEndpoint] = None
    ) -> None:
        """
        Register a service for coordination

        Args:
                name: Service name
                service: Service instance or callable
                endpoint: Optional HTTP endpoint configuration
        """
        self.services[name] = service
        self.service_states[name] = ServiceState.HEALTHY

        if endpoint:
            self.service_endpoints[name] = endpoint

        # Initialize circuit breaker
        self.circuit_breakers[name] = CircuitBreaker(service_name=name)

        # Initialize metrics
        self.service_metrics[name] = {
            "total_calls": 0,
            "successful_calls": 0,
            "failed_calls": 0,
            "average_response_time": 0.0,
            "last_call_time": None,
            "uptime_percentage": 100.0,
        }

        self.logger.info(f"Registered service: {name}")

    def unregister_service(self, name: str) -> None:
        """Unregister a service"""
        if name in self.services:
            del self.services[name]
        if name in self.service_endpoints:
            del self.service_endpoints[name]
        if name in self.service_states:
            del self.service_states[name]
        if name in self.circuit_breakers:
            del self.circuit_breakers[name]
        if name in self.service_metrics:
            del self.service_metrics[name]

        self.logger.info(f"Unregistered service: {name}")

    async def call_service(
        self,
        service_name: str,
        method: str,
        parameters: Dict[str, Any] = None,
        timeout_seconds: Optional[int] = None,
    ) -> Any:
        """
        Call a service with circuit breaker protection

        Args:
                service_name: Name of the service to call
                method: Method or endpoint to call
                parameters: Call parameters
                timeout_seconds: Override default timeout

        Returns:
                Service response

        Raises:
                ValueError: If service not registered or circuit breaker open
                asyncio.TimeoutError: If call times out
        """
        if service_name not in self.services:
            raise ValueError(f"Service not registered: {service_name}")

        # Check circuit breaker
        circuit_breaker = self.circuit_breakers[service_name]
        if not await self._check_circuit_breaker(circuit_breaker):
            raise ValueError(f"Circuit breaker open for service: {service_name}")

        # Create service call tracking
        call = ServiceCall(
            service_name=service_name, method=method, parameters=parameters or {}
        )

        self.active_calls[call.call_id] = call

        try:
            # Determine call method
            if service_name in self.service_endpoints:
                # HTTP API call
                result = await self._call_http_service(call, timeout_seconds)
            else:
                # Direct service call
                result = await self._call_direct_service(call, timeout_seconds)

            # Mark call as successful
            call.success = True
            call.response = result
            call.completed_at = datetime.now()
            call.duration_ms = (
                call.completed_at - call.started_at
            ).total_seconds() * 1000

            # Update circuit breaker
            await self._record_success(circuit_breaker)

            # Update metrics
            await self._update_service_metrics(service_name, call)

            self.logger.debug(f"Service call successful: {service_name}.{method}")

            return result

        except Exception as e:
            # Mark call as failed
            call.success = False
            call.error = str(e)
            call.completed_at = datetime.now()
            call.duration_ms = (
                call.completed_at - call.started_at
            ).total_seconds() * 1000

            # Update circuit breaker
            await self._record_failure(circuit_breaker)

            # Update metrics
            await self._update_service_metrics(service_name, call)

            self.logger.error(f"Service call failed: {service_name}.{method} - {e}")

            raise

        finally:
            # Move to history and cleanup
            if call.call_id in self.active_calls:
                del self.active_calls[call.call_id]

            self.call_history.append(call)

            # Keep history size manageable
            if len(self.call_history) > 1000:
                self.call_history = self.call_history[-500:]

    async def orchestrate_workflow(
        self, workflow_definition: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Orchestrate a complex workflow across multiple services

        Args:
                workflow_definition: Workflow steps and dependencies

        Returns:
                Workflow execution results
        """
        workflow_id = workflow_definition.get("id", uuid7str())
        steps = workflow_definition.get("steps", [])

        results = {}
        execution_context = {"workflow_id": workflow_id, "results": results}

        self.logger.info(f"Starting workflow orchestration: {workflow_id}")

        try:
            # Execute steps according to dependencies
            for step in steps:
                step_name = step.get("name")
                service_name = step.get("service")
                method = step.get("method")
                parameters = step.get("parameters", {})
                dependencies = step.get("dependencies", [])

                # Wait for dependencies
                await self._wait_for_dependencies(dependencies, results)

                # Resolve parameters with context
                resolved_params = await self._resolve_parameters(
                    parameters, execution_context
                )

                # Execute service call
                step_result = await self.call_service(
                    service_name, method, resolved_params
                )

                results[step_name] = step_result

                self.logger.info(f"Workflow step completed: {workflow_id}.{step_name}")

            self.logger.info(f"Workflow orchestration completed: {workflow_id}")

            return {
                "workflow_id": workflow_id,
                "status": "completed",
                "results": results,
                "completed_at": datetime.now().isoformat(),
            }

        except Exception as e:
            self.logger.error(f"Workflow orchestration failed: {workflow_id} - {e}")

            return {
                "workflow_id": workflow_id,
                "status": "failed",
                "error": str(e),
                "results": results,
                "failed_at": datetime.now().isoformat(),
            }

    async def get_service_health(self, service_name: str) -> ServiceState:
        """Get the health state of a service"""
        return self.service_states.get(service_name, ServiceState.UNAVAILABLE)

    async def get_service_metrics(self, service_name: str) -> Dict[str, Any]:
        """Get metrics for a service"""
        return self.service_metrics.get(service_name, {})

    async def get_all_service_health(self) -> Dict[str, ServiceState]:
        """Get health state of all services"""
        return dict(self.service_states)

    async def _call_http_service(
        self, call: ServiceCall, timeout_seconds: Optional[int]
    ) -> Any:
        """Call an HTTP service endpoint"""
        endpoint = self.service_endpoints[call.service_name]

        if not self.http_session:
            raise RuntimeError("HTTP session not initialized")

        timeout = timeout_seconds or endpoint.timeout_seconds

        # Prepare request
        url = (
            f"{endpoint.url}/{call.method}"
            if not call.method.startswith("http")
            else call.method
        )
        headers = dict(endpoint.headers)

        # Add authentication if required
        if endpoint.auth_required:
            # This would add proper authentication headers
            headers["Authorization"] = "Bearer <token>"

        # Make HTTP request
        async with self.http_session.request(
            endpoint.method, url, json=call.parameters, headers=headers, timeout=timeout
        ) as response:
            response.raise_for_status()

            # Try to parse JSON response
            try:
                return await response.json()
            except (ValueError, TypeError, KeyError) as e:
                self.logger.info(f"Response not JSON, falling back to text: {e}")
                return await response.text()

    async def _call_direct_service(
        self, call: ServiceCall, timeout_seconds: Optional[int]
    ) -> Any:
        """Call a service directly through its instance"""
        service = self.services[call.service_name]
        timeout = timeout_seconds or 30

        # Determine how to call the service
        if hasattr(service, call.method):
            method_func = getattr(service, call.method)

            # Call with timeout
            if asyncio.iscoroutinefunction(method_func):
                return await asyncio.wait_for(
                    method_func(**call.parameters), timeout=timeout
                )
            else:
                # Run sync function in executor with timeout
                loop = asyncio.get_running_loop()
                return await asyncio.wait_for(
                    loop.run_in_executor(None, lambda: method_func(**call.parameters)),
                    timeout=timeout,
                )
        else:
            raise AttributeError(
                f"Service {call.service_name} has no method {call.method}"
            )

    async def _check_circuit_breaker(self, circuit_breaker: CircuitBreaker) -> bool:
        """Check if circuit breaker allows calls"""
        if circuit_breaker.state == CircuitBreakerState.CLOSED:
            return True
        elif circuit_breaker.state == CircuitBreakerState.OPEN:
            # Check if we should transition to half-open
            if (
                circuit_breaker.next_attempt_time
                and datetime.now() >= circuit_breaker.next_attempt_time
            ):
                circuit_breaker.state = CircuitBreakerState.HALF_OPEN
                circuit_breaker.success_count = 0
                return True
            return False
        elif circuit_breaker.state == CircuitBreakerState.HALF_OPEN:
            return True

        return False

    async def _record_success(self, circuit_breaker: CircuitBreaker) -> None:
        """Record a successful call for circuit breaker"""
        if circuit_breaker.state == CircuitBreakerState.HALF_OPEN:
            circuit_breaker.success_count += 1
            if circuit_breaker.success_count >= circuit_breaker.success_threshold:
                circuit_breaker.state = CircuitBreakerState.CLOSED
                circuit_breaker.failure_count = 0
        elif circuit_breaker.state == CircuitBreakerState.CLOSED:
            circuit_breaker.failure_count = 0

    async def _record_failure(self, circuit_breaker: CircuitBreaker) -> None:
        """Record a failed call for circuit breaker"""
        circuit_breaker.failure_count += 1
        circuit_breaker.last_failure_time = datetime.now()

        if circuit_breaker.failure_count >= circuit_breaker.failure_threshold:
            circuit_breaker.state = CircuitBreakerState.OPEN
            circuit_breaker.next_attempt_time = datetime.now() + timedelta(
                seconds=circuit_breaker.timeout_seconds
            )

    async def _update_service_metrics(
        self, service_name: str, call: ServiceCall
    ) -> None:
        """Update metrics for a service call"""
        metrics = self.service_metrics[service_name]

        metrics["total_calls"] += 1
        metrics["last_call_time"] = call.completed_at.isoformat()

        if call.success:
            metrics["successful_calls"] += 1
        else:
            metrics["failed_calls"] += 1

        # Update average response time
        total_calls = metrics["total_calls"]
        current_avg = metrics["average_response_time"]
        new_avg = ((current_avg * (total_calls - 1)) + call.duration_ms) / total_calls
        metrics["average_response_time"] = new_avg

        # Update uptime percentage
        success_rate = metrics["successful_calls"] / total_calls
        metrics["uptime_percentage"] = success_rate * 100

    async def _wait_for_dependencies(
        self, dependencies: List[str], results: Dict[str, Any]
    ) -> None:
        """Wait for workflow step dependencies to complete"""
        for dependency in dependencies:
            while dependency not in results:
                await asyncio.sleep(0.1)

    async def _resolve_parameters(
        self, parameters: Dict[str, Any], context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Resolve parameter templates with execution context"""
        resolved = {}

        for key, value in parameters.items():
            if (
                isinstance(value, str)
                and value.startswith("${")
                and value.endswith("}")
            ):
                # Template parameter - resolve from context
                template = value[2:-1]  # Remove ${ }
                if "." in template:
                    # Nested reference like results.step1.output
                    parts = template.split(".")
                    resolved_value = context
                    for part in parts:
                        resolved_value = resolved_value.get(part, value)
                    resolved[key] = resolved_value
                else:
                    resolved[key] = context.get(template, value)
            else:
                resolved[key] = value

        return resolved

    async def _health_monitor_loop(self) -> None:
        """Background health monitoring"""
        while self._running:
            try:
                await self._check_all_service_health()
                await asyncio.sleep(self.health_check_interval)
            except Exception as e:
                self.logger.error(f"Health monitor error: {e}")
                await asyncio.sleep(60)

    async def _check_all_service_health(self) -> None:
        """Check health of all registered services"""
        for service_name in self.services.keys():
            try:
                await self._check_service_health(service_name)
            except Exception as e:
                self.logger.warning(f"Health check failed for {service_name}: {e}")
                self.service_states[service_name] = ServiceState.UNHEALTHY

    async def _check_service_health(self, service_name: str) -> None:
        """Check health of a specific service"""
        # Check circuit breaker state
        circuit_breaker = self.circuit_breakers[service_name]
        if circuit_breaker.state == CircuitBreakerState.OPEN:
            self.service_states[service_name] = ServiceState.CIRCUIT_OPEN
            return

        # For HTTP endpoints, use health check path
        if service_name in self.service_endpoints:
            endpoint = self.service_endpoints[service_name]
            if endpoint.health_check_path:
                try:
                    await self.call_service(
                        service_name, endpoint.health_check_path, {}
                    )
                    self.service_states[service_name] = ServiceState.HEALTHY
                except Exception as e:
                    self.logger.warning(f"Health check failed for {service_name}: {e}")
                    self.service_states[service_name] = ServiceState.UNHEALTHY
                return

        # For direct services, try a health check method
        service = self.services[service_name]
        if hasattr(service, "health_check"):
            try:
                if asyncio.iscoroutinefunction(service.health_check):
                    healthy = await service.health_check()
                else:
                    healthy = service.health_check()

                self.service_states[service_name] = (
                    ServiceState.HEALTHY if healthy else ServiceState.UNHEALTHY
                )
            except Exception as e:
                self.logger.warning(f"Direct health check failed for {service_name}: {e}")
                self.service_states[service_name] = ServiceState.UNHEALTHY
        else:
            # Default to healthy if service exists
            self.service_states[service_name] = ServiceState.HEALTHY

    async def _metrics_cleanup_loop(self) -> None:
        """Background cleanup of old metrics"""
        while self._running:
            try:
                await self._cleanup_old_metrics()
                await asyncio.sleep(3600)  # Every hour
            except Exception as e:
                self.logger.error(f"Metrics cleanup error: {e}")
                await asyncio.sleep(3600)

    async def _cleanup_old_metrics(self) -> None:
        """Clean up old call history to prevent memory growth"""
        cutoff_time = datetime.now() - timedelta(hours=self.metrics_retention_hours)

        # Filter call history
        self.call_history = [
            call
            for call in self.call_history
            if call.completed_at and call.completed_at > cutoff_time
        ]

        self.logger.debug(
            f"Metrics cleanup: kept {len(self.call_history)} recent calls"
        )
