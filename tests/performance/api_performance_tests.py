#!/usr/bin/env python3
"""
API Performance Tests

Comprehensive performance testing suite for API scalability, throughput,
latency, and stress testing with detailed metrics and reporting.
"""

import asyncio
import time
import statistics
import logging
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor
import json

try:
	import httpx
	import websockets
	import aiofiles
except ImportError:
	print("Please install: pip install httpx websockets aiofiles")
	exit(1)


@dataclass
class PerformanceResult:
	"""Performance test result"""
	test_name: str
	endpoint: str
	method: str
	total_requests: int
	successful_requests: int
	failed_requests: int
	avg_response_time: float
	min_response_time: float
	max_response_time: float
	p50_response_time: float
	p90_response_time: float
	p95_response_time: float
	p99_response_time: float
	requests_per_second: float
	errors: List[str] = field(default_factory=list)
	duration_seconds: float = 0.0
	start_time: datetime = field(default_factory=datetime.utcnow)
	end_time: Optional[datetime] = None


@dataclass
class LoadTestConfig:
	"""Load test configuration"""
	base_url: str = "http://localhost:8000"
	concurrent_users: int = 10
	requests_per_user: int = 100
	ramp_up_seconds: int = 30
	test_duration_seconds: int = 300
	auth_token: Optional[str] = None
	custom_headers: Dict[str, str] = field(default_factory=dict)


class APILoadTester:
	"""API load testing framework"""
	
	def __init__(self, config: LoadTestConfig):
		self.config = config
		self.logger = logging.getLogger(__name__)
		self.results: List[PerformanceResult] = []
		
		# HTTP client configuration
		self.timeout = httpx.Timeout(30.0, connect=10.0)
		self.limits = httpx.Limits(max_connections=200, max_keepalive_connections=50)
	
	async def run_load_test(
		self,
		test_name: str,
		endpoint: str,
		method: str = "GET",
		payload: Dict[str, Any] = None,
		headers: Dict[str, str] = None
	) -> PerformanceResult:
		"""Run load test for specific endpoint"""
		
		print(f"\n🚀 Starting load test: {test_name}")
		print(f"   Endpoint: {method} {endpoint}")
		print(f"   Concurrent users: {self.config.concurrent_users}")
		print(f"   Requests per user: {self.config.requests_per_user}")
		print(f"   Total requests: {self.config.concurrent_users * self.config.requests_per_user}")
		
		start_time = time.time()
		response_times = []
		errors = []
		successful_requests = 0
		failed_requests = 0
		
		# Prepare headers
		test_headers = self.config.custom_headers.copy()
		if self.config.auth_token:
			test_headers["Authorization"] = f"Bearer {self.config.auth_token}"
		if headers:
			test_headers.update(headers)
		
		# Create semaphore for connection limiting
		semaphore = asyncio.Semaphore(self.config.concurrent_users * 2)
		
		async def make_request(session: httpx.AsyncClient, user_id: int, request_id: int):
			"""Make single HTTP request"""
			async with semaphore:
				try:
					request_start = time.time()
					
					if method.upper() == "GET":
						response = await session.get(
							f"{self.config.base_url}{endpoint}",
							headers=test_headers
						)
					elif method.upper() == "POST":
						response = await session.post(
							f"{self.config.base_url}{endpoint}",
							json=payload,
							headers=test_headers
						)
					elif method.upper() == "PUT":
						response = await session.put(
							f"{self.config.base_url}{endpoint}",
							json=payload,
							headers=test_headers
						)
					elif method.upper() == "DELETE":
						response = await session.delete(
							f"{self.config.base_url}{endpoint}",
							headers=test_headers
						)
					else:
						raise ValueError(f"Unsupported HTTP method: {method}")
					
					request_end = time.time()
					response_time = (request_end - request_start) * 1000  # Convert to ms
					
					if 200 <= response.status_code < 400:
						response_times.append(response_time)
						return True, response_time, None
					else:
						error = f"HTTP {response.status_code}: {response.text[:100]}"
						return False, response_time, error
						
				except Exception as e:
					request_end = time.time()
					response_time = (request_end - request_start) * 1000
					return False, response_time, str(e)
		
		async def user_scenario(user_id: int):
			"""Simulate user making multiple requests"""
			async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as session:
				user_results = []
				
				for request_id in range(self.config.requests_per_user):
					success, response_time, error = await make_request(session, user_id, request_id)
					user_results.append((success, response_time, error))
					
					# Small delay between requests from same user
					await asyncio.sleep(0.1)
				
				return user_results
		
		# Execute load test with gradual ramp-up
		all_tasks = []
		ramp_up_delay = self.config.ramp_up_seconds / self.config.concurrent_users
		
		for user_id in range(self.config.concurrent_users):
			# Stagger user start times
			await asyncio.sleep(ramp_up_delay)
			task = asyncio.create_task(user_scenario(user_id))
			all_tasks.append(task)
			
			print(f"   Started user {user_id + 1}/{self.config.concurrent_users}", end='\r')
		
		print(f"\n   All {self.config.concurrent_users} users started, waiting for completion...")
		
		# Wait for all users to complete
		results = await asyncio.gather(*all_tasks, return_exceptions=True)
		
		end_time = time.time()
		duration = end_time - start_time
		
		# Process results
		all_response_times = []
		for user_results in results:
			if isinstance(user_results, Exception):
				failed_requests += self.config.requests_per_user
				errors.append(str(user_results))
			else:
				for success, response_time, error in user_results:
					all_response_times.append(response_time)
					if success:
						successful_requests += 1
					else:
						failed_requests += 1
						if error:
							errors.append(error)
		
		# Calculate statistics
		if all_response_times:
			avg_response_time = statistics.mean(all_response_times)
			min_response_time = min(all_response_times)
			max_response_time = max(all_response_times)
			p50_response_time = statistics.median(all_response_times)
			
			sorted_times = sorted(all_response_times)
			p90_response_time = sorted_times[int(len(sorted_times) * 0.9)]
			p95_response_time = sorted_times[int(len(sorted_times) * 0.95)]
			p99_response_time = sorted_times[int(len(sorted_times) * 0.99)]
		else:
			avg_response_time = min_response_time = max_response_time = 0.0
			p50_response_time = p90_response_time = p95_response_time = p99_response_time = 0.0
		
		total_requests = successful_requests + failed_requests
		requests_per_second = total_requests / duration if duration > 0 else 0
		
		# Create result
		result = PerformanceResult(
			test_name=test_name,
			endpoint=endpoint,
			method=method,
			total_requests=total_requests,
			successful_requests=successful_requests,
			failed_requests=failed_requests,
			avg_response_time=avg_response_time,
			min_response_time=min_response_time,
			max_response_time=max_response_time,
			p50_response_time=p50_response_time,
			p90_response_time=p90_response_time,
			p95_response_time=p95_response_time,
			p99_response_time=p99_response_time,
			requests_per_second=requests_per_second,
			errors=errors[:10],  # Keep only first 10 errors
			duration_seconds=duration,
			start_time=datetime.fromtimestamp(start_time),
			end_time=datetime.fromtimestamp(end_time)
		)
		
		self.results.append(result)
		
		# Print results
		self._print_test_results(result)
		
		return result
	
	def _print_test_results(self, result: PerformanceResult):
		"""Print formatted test results"""
		print(f"\n📊 Test Results: {result.test_name}")
		print("=" * 60)
		print(f"Total Requests:     {result.total_requests:,}")
		print(f"Successful:         {result.successful_requests:,} ({result.successful_requests/result.total_requests*100:.1f}%)")
		print(f"Failed:            {result.failed_requests:,} ({result.failed_requests/result.total_requests*100:.1f}%)")
		print(f"Duration:          {result.duration_seconds:.1f}s")
		print(f"Requests/Second:   {result.requests_per_second:.1f}")
		print()
		print("Response Times (ms):")
		print(f"  Average:         {result.avg_response_time:.1f}")
		print(f"  Minimum:         {result.min_response_time:.1f}")
		print(f"  Maximum:         {result.max_response_time:.1f}")
		print(f"  50th percentile: {result.p50_response_time:.1f}")
		print(f"  90th percentile: {result.p90_response_time:.1f}")
		print(f"  95th percentile: {result.p95_response_time:.1f}")
		print(f"  99th percentile: {result.p99_response_time:.1f}")
		
		if result.errors:
			print(f"\nFirst {len(result.errors)} Errors:")
			for error in result.errors:
				print(f"  • {error}")
	
	async def run_stress_test(
		self,
		test_name: str,
		endpoint: str,
		initial_users: int = 1,
		max_users: int = 100,
		step_size: int = 10,
		step_duration_seconds: int = 60,
		method: str = "GET",
		payload: Dict[str, Any] = None
	) -> List[PerformanceResult]:
		"""Run stress test with gradually increasing load"""
		
		print(f"\n🔥 Starting stress test: {test_name}")
		print(f"   Ramping from {initial_users} to {max_users} users")
		print(f"   Step size: {step_size}, Step duration: {step_duration_seconds}s")
		
		stress_results = []
		current_users = initial_users
		
		while current_users <= max_users:
			print(f"\n--- Stress Test Step: {current_users} concurrent users ---")
			
			# Update config for this step
			step_config = LoadTestConfig(
				base_url=self.config.base_url,
				concurrent_users=current_users,
				requests_per_user=step_duration_seconds // 2,  # Adjust based on duration
				ramp_up_seconds=min(10, step_duration_seconds // 4),
				test_duration_seconds=step_duration_seconds,
				auth_token=self.config.auth_token,
				custom_headers=self.config.custom_headers
			)
			
			step_tester = APILoadTester(step_config)
			result = await step_tester.run_load_test(
				f"{test_name} - {current_users} users",
				endpoint,
				method,
				payload
			)
			
			stress_results.append(result)
			
			# Check if system is degrading significantly
			if result.failed_requests / result.total_requests > 0.1:  # 10% error rate
				print(f"⚠️  High error rate detected at {current_users} users, stopping stress test")
				break
			
			if result.p95_response_time > 10000:  # 10 seconds
				print(f"⚠️  High latency detected at {current_users} users, stopping stress test")
				break
			
			current_users += step_size
		
		# Print stress test summary
		self._print_stress_test_summary(stress_results)
		
		return stress_results
	
	def _print_stress_test_summary(self, results: List[PerformanceResult]):
		"""Print stress test summary"""
		print(f"\n📈 Stress Test Summary")
		print("=" * 80)
		print(f"{'Users':<8} {'RPS':<8} {'Avg(ms)':<10} {'P95(ms)':<10} {'Errors':<8} {'Success%':<10}")
		print("-" * 80)
		
		for result in results:
			success_rate = result.successful_requests / result.total_requests * 100
			print(f"{result.total_requests // (result.total_requests // 10):<8} "
			      f"{result.requests_per_second:<8.1f} "
			      f"{result.avg_response_time:<10.1f} "
			      f"{result.p95_response_time:<10.1f} "
			      f"{result.failed_requests:<8} "
			      f"{success_rate:<10.1f}")


class WebSocketLoadTester:
	"""WebSocket load testing framework"""
	
	def __init__(self, ws_url: str = "ws://localhost:8000/api/v1/websockets"):
		self.ws_url = ws_url
		self.logger = logging.getLogger(__name__)
	
	async def test_websocket_connections(
		self,
		concurrent_connections: int = 100,
		messages_per_connection: int = 100,
		message_interval_seconds: float = 1.0
	) -> Dict[str, Any]:
		"""Test WebSocket connection handling and message throughput"""
		
		print(f"\n🔌 WebSocket Load Test")
		print(f"   Concurrent connections: {concurrent_connections}")
		print(f"   Messages per connection: {messages_per_connection}")
		print(f"   Message interval: {message_interval_seconds}s")
		
		start_time = time.time()
		successful_connections = 0
		failed_connections = 0
		total_messages_sent = 0
		total_messages_received = 0
		connection_times = []
		message_latencies = []
		errors = []
		
		async def websocket_client(client_id: int):
			"""Individual WebSocket client"""
			try:
				connect_start = time.time()
				
				async with websockets.connect(self.ws_url) as websocket:
					connect_end = time.time()
					connection_time = (connect_end - connect_start) * 1000
					connection_times.append(connection_time)
					
					nonlocal successful_connections
					successful_connections += 1
					
					# Send messages
					messages_sent = 0
					messages_received = 0
					
					for i in range(messages_per_connection):
						try:
							# Send message
							message = {
								"type": "ping",
								"client_id": client_id,
								"message_id": i,
								"timestamp": time.time()
							}
							
							message_start = time.time()
							await websocket.send(json.dumps(message))
							messages_sent += 1
							
							# Wait for response
							try:
								response = await asyncio.wait_for(
									websocket.recv(),
									timeout=5.0
								)
								message_end = time.time()
								
								response_data = json.loads(response)
								if response_data.get("type") == "pong":
									latency = (message_end - message_start) * 1000
									message_latencies.append(latency)
									messages_received += 1
								
							except asyncio.TimeoutError:
								pass  # Message timeout
							
							await asyncio.sleep(message_interval_seconds)
							
						except Exception as e:
							errors.append(f"Client {client_id} message error: {str(e)}")
					
					return {
						'client_id': client_id,
						'connection_time': connection_time,
						'messages_sent': messages_sent,
						'messages_received': messages_received
					}
					
			except Exception as e:
				nonlocal failed_connections
				failed_connections += 1
				errors.append(f"Client {client_id} connection error: {str(e)}")
				return {
					'client_id': client_id,
					'connection_time': 0,
					'messages_sent': 0,
					'messages_received': 0,
					'error': str(e)
				}
		
		# Start all clients concurrently
		tasks = [websocket_client(i) for i in range(concurrent_connections)]
		client_results = await asyncio.gather(*tasks, return_exceptions=True)
		
		end_time = time.time()
		duration = end_time - start_time
		
		# Process results
		for result in client_results:
			if isinstance(result, Exception):
				failed_connections += 1
				errors.append(str(result))
			else:
				total_messages_sent += result.get('messages_sent', 0)
				total_messages_received += result.get('messages_received', 0)
		
		# Calculate statistics
		avg_connection_time = statistics.mean(connection_times) if connection_times else 0
		avg_message_latency = statistics.mean(message_latencies) if message_latencies else 0
		message_throughput = total_messages_sent / duration if duration > 0 else 0
		
		results = {
			'concurrent_connections': concurrent_connections,
			'successful_connections': successful_connections,
			'failed_connections': failed_connections,
			'total_messages_sent': total_messages_sent,
			'total_messages_received': total_messages_received,
			'avg_connection_time_ms': avg_connection_time,
			'avg_message_latency_ms': avg_message_latency,
			'message_throughput_per_second': message_throughput,
			'test_duration_seconds': duration,
			'errors': errors[:10]  # Keep only first 10 errors
		}
		
		# Print results
		print(f"\n📊 WebSocket Test Results")
		print("=" * 50)
		print(f"Successful connections: {successful_connections}/{concurrent_connections}")
		print(f"Failed connections:     {failed_connections}")
		print(f"Messages sent:          {total_messages_sent:,}")
		print(f"Messages received:      {total_messages_received:,}")
		print(f"Message delivery rate:  {total_messages_received/total_messages_sent*100:.1f}%" if total_messages_sent > 0 else "0%")
		print(f"Avg connection time:    {avg_connection_time:.1f}ms")
		print(f"Avg message latency:    {avg_message_latency:.1f}ms")
		print(f"Message throughput:     {message_throughput:.1f} msg/s")
		print(f"Test duration:          {duration:.1f}s")
		
		if errors:
			print(f"\nFirst {len(errors)} Errors:")
			for error in errors:
				print(f"  • {error}")
		
		return results


async def run_comprehensive_performance_tests():
	"""Run comprehensive performance test suite"""
	
	print("🎯 Comprehensive API Performance Test Suite")
	print("=" * 60)
	
	# Configuration
	config = LoadTestConfig(
		base_url="http://localhost:8000",
		concurrent_users=20,
		requests_per_user=50,
		ramp_up_seconds=10,
		auth_token="sample_token_here"  # Replace with actual token
	)
	
	tester = APILoadTester(config)
	
	# Test suite
	test_results = []
	
	try:
		# 1. Health check endpoint (lightweight)
		result = await tester.run_load_test(
			"Health Check Load Test",
			"/health",
			"GET"
		)
		test_results.append(result)
		
		# 2. Document listing (medium load)
		result = await tester.run_load_test(
			"Document List Load Test",
			"/api/v1/documents",
			"GET"
		)
		test_results.append(result)
		
		# 3. Search endpoint (heavy load)
		result = await tester.run_load_test(
			"Search Load Test",
			"/api/v1/search",
			"POST",
			payload={
				"query": "test document",
				"scope": "documents",
				"page": 1,
				"per_page": 20
			}
		)
		test_results.append(result)
		
		# 4. Document creation (write operations)
		result = await tester.run_load_test(
			"Document Creation Load Test",
			"/api/v1/documents",
			"POST",
			payload={
				"title": "Load Test Document",
				"content": "This is a test document created during load testing.",
				"document_type": "proposal",
				"tags": ["test", "performance"]
			}
		)
		test_results.append(result)
		
		# 5. GraphQL endpoint
		result = await tester.run_load_test(
			"GraphQL Load Test",
			"/api/v1/graphql",
			"POST",
			payload={
				"query": """
				query GetDocuments {
					documents(first: 10) {
						edges {
							node {
								documentId
								title
								status
								createdAt
							}
						}
						totalCount
					}
				}
				"""
			}
		)
		test_results.append(result)
		
		# 6. WebSocket load test
		ws_tester = WebSocketLoadTester()
		ws_results = await ws_tester.test_websocket_connections(
			concurrent_connections=50,
			messages_per_connection=20,
			message_interval_seconds=0.5
		)
		
		# 7. Stress test on critical endpoint
		print(f"\n🔥 Running Stress Test on Document API...")
		stress_results = await tester.run_stress_test(
			"Document API Stress Test",
			"/api/v1/documents",
			initial_users=5,
			max_users=50,
			step_size=5,
			step_duration_seconds=30
		)
		
		# Generate final report
		await generate_performance_report(test_results, ws_results, stress_results)
		
	except Exception as e:
		print(f"❌ Performance test suite failed: {e}")
		logging.exception("Performance test error")


async def generate_performance_report(
	load_test_results: List[PerformanceResult],
	websocket_results: Dict[str, Any],
	stress_test_results: List[PerformanceResult]
):
	"""Generate comprehensive performance report"""
	
	report_time = datetime.utcnow()
	
	print(f"\n📋 PERFORMANCE TEST REPORT")
	print("=" * 80)
	print(f"Generated: {report_time.strftime('%Y-%m-%d %H:%M:%S')} UTC")
	print()
	
	# Summary statistics
	total_requests = sum(r.total_requests for r in load_test_results)
	total_successful = sum(r.successful_requests for r in load_test_results)
	total_failed = sum(r.failed_requests for r in load_test_results)
	overall_success_rate = total_successful / total_requests * 100 if total_requests > 0 else 0
	
	print(f"📊 OVERALL SUMMARY")
	print(f"   Total requests:     {total_requests:,}")
	print(f"   Successful:         {total_successful:,} ({overall_success_rate:.1f}%)")
	print(f"   Failed:            {total_failed:,} ({total_failed/total_requests*100:.1f}%)")
	
	# Load test results
	print(f"\n🚀 LOAD TEST RESULTS")
	print("-" * 80)
	print(f"{'Test Name':<30} {'RPS':<8} {'Avg(ms)':<10} {'P95(ms)':<10} {'Success%':<10}")
	print("-" * 80)
	
	for result in load_test_results:
		success_rate = result.successful_requests / result.total_requests * 100
		print(f"{result.test_name[:29]:<30} "
		      f"{result.requests_per_second:<8.1f} "
		      f"{result.avg_response_time:<10.1f} "
		      f"{result.p95_response_time:<10.1f} "
		      f"{success_rate:<10.1f}")
	
	# WebSocket results
	print(f"\n🔌 WEBSOCKET TEST RESULTS")
	print("-" * 50)
	print(f"Connection success rate: {websocket_results['successful_connections']}/{websocket_results['concurrent_connections']}")
	print(f"Message throughput:      {websocket_results['message_throughput_per_second']:.1f} msg/s")
	print(f"Avg message latency:     {websocket_results['avg_message_latency_ms']:.1f}ms")
	
	# Performance recommendations
	print(f"\n💡 RECOMMENDATIONS")
	print("-" * 50)
	
	recommendations = []
	
	# Check for slow endpoints
	slow_endpoints = [r for r in load_test_results if r.p95_response_time > 2000]
	if slow_endpoints:
		recommendations.append("⚠️  Some endpoints have high P95 latency (>2s). Consider optimization.")
	
	# Check for high error rates
	high_error_endpoints = [r for r in load_test_results if r.failed_requests / r.total_requests > 0.05]
	if high_error_endpoints:
		recommendations.append("❌ Some endpoints have high error rates (>5%). Investigate causes.")
	
	# Check throughput
	low_throughput_endpoints = [r for r in load_test_results if r.requests_per_second < 10]
	if low_throughput_endpoints:
		recommendations.append("🐌 Some endpoints have low throughput (<10 RPS). Consider scaling.")
	
	# WebSocket performance
	if websocket_results['successful_connections'] / websocket_results['concurrent_connections'] < 0.95:
		recommendations.append("🔌 WebSocket connection success rate is low. Check connection limits.")
	
	if not recommendations:
		recommendations.append("✅ All performance metrics are within acceptable ranges!")
	
	for rec in recommendations:
		print(f"   {rec}")
	
	# Save detailed report to file
	report_data = {
		'generated_at': report_time.isoformat(),
		'summary': {
			'total_requests': total_requests,
			'success_rate': overall_success_rate
		},
		'load_tests': [
			{
				'test_name': r.test_name,
				'endpoint': r.endpoint,
				'method': r.method,
				'requests_per_second': r.requests_per_second,
				'avg_response_time': r.avg_response_time,
				'p95_response_time': r.p95_response_time,
				'success_rate': r.successful_requests / r.total_requests * 100
			}
			for r in load_test_results
		],
		'websocket_test': websocket_results,
		'stress_test_results': [
			{
				'concurrent_users': r.total_requests // (r.total_requests // 10),
				'requests_per_second': r.requests_per_second,
				'avg_response_time': r.avg_response_time,
				'p95_response_time': r.p95_response_time,
				'error_rate': r.failed_requests / r.total_requests * 100
			}
			for r in stress_test_results
		],
		'recommendations': recommendations
	}
	
	try:
		async with aiofiles.open('performance_test_report.json', 'w') as f:
			await f.write(json.dumps(report_data, indent=2))
		print(f"\n💾 Detailed report saved to: performance_test_report.json")
	except Exception as e:
		print(f"⚠️  Failed to save report: {e}")


if __name__ == "__main__":
	logging.basicConfig(level=logging.INFO)
	asyncio.run(run_comprehensive_performance_tests())