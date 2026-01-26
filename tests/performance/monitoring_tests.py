#!/usr/bin/env python3
"""
Monitoring Accuracy and Responsiveness Tests

Test suite to validate monitoring system accuracy, alerting responsiveness,
and performance tracking reliability across all system components.
"""

import asyncio
import time
import random
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, field

try:
	import httpx
	import psutil
except ImportError:
	print("Please install: pip install httpx psutil")
	exit(1)


@dataclass
class MonitoringTestResult:
	"""Monitoring test result"""
	test_name: str
	passed: bool
	expected_value: Any
	actual_value: Any
	tolerance: float = 0.1  # 10% tolerance by default
	error_message: str = ""
	duration_seconds: float = 0.0
	timestamp: datetime = field(default_factory=datetime.utcnow)


class MonitoringAccuracyTester:
	"""Test monitoring system accuracy and responsiveness"""
	
	def __init__(self, base_url: str = "http://localhost:8000"):
		self.base_url = base_url
		self.logger = logging.getLogger(__name__)
		self.test_results: List[MonitoringTestResult] = []
	
	async def test_response_time_tracking(self, endpoint: str = "/health") -> MonitoringTestResult:
		"""Test response time measurement accuracy"""
		test_name = "Response Time Tracking Accuracy"
		
		try:
			# Make controlled requests and measure response times
			measured_times = []
			expected_times = []
			
			async with httpx.AsyncClient() as client:
				for _ in range(10):
					start_time = time.time()
					response = await client.get(f"{self.base_url}{endpoint}")
					end_time = time.time()
					
					actual_time = (end_time - start_time) * 1000  # Convert to ms
					measured_times.append(actual_time)
			
			# Get monitoring system's recorded times
			monitoring_times = await self._get_monitoring_response_times(endpoint)
			
			if not monitoring_times:
				return MonitoringTestResult(
					test_name=test_name,
					passed=False,
					expected_value="Response time data",
					actual_value="No data found",
					error_message="Monitoring system did not record response times"
				)
			
			# Compare accuracy
			avg_measured = sum(measured_times) / len(measured_times)
			avg_monitored = sum(monitoring_times) / len(monitoring_times)
			
			accuracy = abs(avg_measured - avg_monitored) / avg_measured
			passed = accuracy <= 0.2  # 20% tolerance for response time accuracy
			
			return MonitoringTestResult(
				test_name=test_name,
				passed=passed,
				expected_value=f"{avg_measured:.1f}ms",
				actual_value=f"{avg_monitored:.1f}ms",
				tolerance=0.2,
				error_message="" if passed else f"Accuracy deviation: {accuracy*100:.1f}%"
			)
			
		except Exception as e:
			return MonitoringTestResult(
				test_name=test_name,
				passed=False,
				expected_value="Accurate response time tracking",
				actual_value="Test failed",
				error_message=str(e)
			)
	
	async def test_error_rate_tracking(self) -> MonitoringTestResult:
		"""Test error rate measurement accuracy"""
		test_name = "Error Rate Tracking Accuracy"
		
		try:
			# Generate controlled errors
			total_requests = 50
			error_requests = 10
			expected_error_rate = error_requests / total_requests
			
			async with httpx.AsyncClient() as client:
				for i in range(total_requests):
					if i < error_requests:
						# Make requests that should fail
						try:
							await client.get(f"{self.base_url}/api/v1/nonexistent-endpoint")
						except:
							pass
					else:
						# Make successful requests
						try:
							await client.get(f"{self.base_url}/health")
						except:
							pass
					
					await asyncio.sleep(0.1)  # Small delay between requests
			
			# Wait for monitoring system to process
			await asyncio.sleep(2)
			
			# Get monitored error rate
			monitored_error_rate = await self._get_monitoring_error_rate()
			
			if monitored_error_rate is None:
				return MonitoringTestResult(
					test_name=test_name,
					passed=False,
					expected_value=f"{expected_error_rate*100:.1f}%",
					actual_value="No data",
					error_message="Monitoring system did not record error rate"
				)
			
			# Compare accuracy
			accuracy = abs(expected_error_rate - monitored_error_rate) / expected_error_rate
			passed = accuracy <= 0.15  # 15% tolerance
			
			return MonitoringTestResult(
				test_name=test_name,
				passed=passed,
				expected_value=f"{expected_error_rate*100:.1f}%",
				actual_value=f"{monitored_error_rate*100:.1f}%",
				tolerance=0.15,
				error_message="" if passed else f"Accuracy deviation: {accuracy*100:.1f}%"
			)
			
		except Exception as e:
			return MonitoringTestResult(
				test_name=test_name,
				passed=False,
				expected_value="Accurate error rate tracking",
				actual_value="Test failed",
				error_message=str(e)
			)
	
	async def test_throughput_tracking(self, endpoint: str = "/health") -> MonitoringTestResult:
		"""Test request throughput measurement accuracy"""
		test_name = "Throughput Tracking Accuracy"
		
		try:
			# Generate controlled load
			request_count = 100
			duration_seconds = 30
			expected_rps = request_count / duration_seconds
			
			start_time = time.time()
			
			async def make_request(session):
				try:
					await session.get(f"{self.base_url}{endpoint}")
					return True
				except:
					return False
			
			# Generate load
			async with httpx.AsyncClient() as session:
				tasks = []
				for _ in range(request_count):
					task = asyncio.create_task(make_request(session))
					tasks.append(task)
					await asyncio.sleep(duration_seconds / request_count)
				
				# Wait for all requests to complete
				results = await asyncio.gather(*tasks, return_exceptions=True)
			
			actual_duration = time.time() - start_time
			actual_rps = request_count / actual_duration
			
			# Wait for monitoring system to process
			await asyncio.sleep(2)
			
			# Get monitored throughput
			monitored_rps = await self._get_monitoring_throughput(endpoint)
			
			if monitored_rps is None:
				return MonitoringTestResult(
					test_name=test_name,
					passed=False,
					expected_value=f"{actual_rps:.1f} RPS",
					actual_value="No data",
					error_message="Monitoring system did not record throughput"
				)
			
			# Compare accuracy
			accuracy = abs(actual_rps - monitored_rps) / actual_rps
			passed = accuracy <= 0.25  # 25% tolerance for throughput
			
			return MonitoringTestResult(
				test_name=test_name,
				passed=passed,
				expected_value=f"{actual_rps:.1f} RPS",
				actual_value=f"{monitored_rps:.1f} RPS",
				tolerance=0.25,
				error_message="" if passed else f"Accuracy deviation: {accuracy*100:.1f}%"
			)
			
		except Exception as e:
			return MonitoringTestResult(
				test_name=test_name,
				passed=False,
				expected_value="Accurate throughput tracking",
				actual_value="Test failed",
				error_message=str(e)
			)
	
	async def test_system_metrics_accuracy(self) -> MonitoringTestResult:
		"""Test system metrics (CPU, memory) accuracy"""
		test_name = "System Metrics Accuracy"
		
		try:
			# Get system metrics directly
			direct_cpu = psutil.cpu_percent(interval=1)
			direct_memory = psutil.virtual_memory().percent
			
			# Get metrics from monitoring system
			monitored_metrics = await self._get_monitoring_system_metrics()
			
			if not monitored_metrics:
				return MonitoringTestResult(
					test_name=test_name,
					passed=False,
					expected_value="System metrics data",
					actual_value="No data",
					error_message="Monitoring system did not record system metrics"
				)
			
			monitored_cpu = monitored_metrics.get('cpu_usage', 0)
			monitored_memory = monitored_metrics.get('memory_usage', 0)
			
			# Check CPU accuracy
			cpu_accuracy = abs(direct_cpu - monitored_cpu) / max(direct_cpu, 1)
			cpu_passed = cpu_accuracy <= 0.3  # 30% tolerance for CPU
			
			# Check memory accuracy  
			memory_accuracy = abs(direct_memory - monitored_memory) / max(direct_memory, 1)
			memory_passed = memory_accuracy <= 0.1  # 10% tolerance for memory
			
			passed = cpu_passed and memory_passed
			
			return MonitoringTestResult(
				test_name=test_name,
				passed=passed,
				expected_value=f"CPU: {direct_cpu:.1f}%, Memory: {direct_memory:.1f}%",
				actual_value=f"CPU: {monitored_cpu:.1f}%, Memory: {monitored_memory:.1f}%",
				tolerance=0.2,
				error_message="" if passed else f"CPU accuracy: {cpu_accuracy*100:.1f}%, Memory accuracy: {memory_accuracy*100:.1f}%"
			)
			
		except Exception as e:
			return MonitoringTestResult(
				test_name=test_name,
				passed=False,
				expected_value="Accurate system metrics",
				actual_value="Test failed",
				error_message=str(e)
			)
	
	async def test_alert_responsiveness(self) -> MonitoringTestResult:
		"""Test alert system responsiveness"""
		test_name = "Alert System Responsiveness"
		
		try:
			# Record initial alert count
			initial_alerts = await self._get_active_alerts_count()
			
			# Generate condition that should trigger alert (simulate high error rate)
			async with httpx.AsyncClient() as client:
				for _ in range(20):  # Generate many errors quickly
					try:
						await client.get(f"{self.base_url}/api/v1/trigger-test-alert-endpoint")
					except:
						pass
			
			# Wait for alert system to respond
			max_wait_time = 60  # 1 minute
			alert_detected = False
			start_wait = time.time()
			
			while time.time() - start_wait < max_wait_time:
				current_alerts = await self._get_active_alerts_count()
				if current_alerts > initial_alerts:
					alert_detected = True
					response_time = time.time() - start_wait
					break
				await asyncio.sleep(2)
			
			if alert_detected:
				passed = response_time <= 30  # Alert should trigger within 30 seconds
				return MonitoringTestResult(
					test_name=test_name,
					passed=passed,
					expected_value="Alert within 30 seconds",
					actual_value=f"Alert after {response_time:.1f} seconds",
					error_message="" if passed else "Alert response too slow"
				)
			else:
				return MonitoringTestResult(
					test_name=test_name,
					passed=False,
					expected_value="Alert triggered",
					actual_value="No alert triggered",
					error_message="Alert system did not respond to error condition"
				)
			
		except Exception as e:
			return MonitoringTestResult(
				test_name=test_name,
				passed=False,
				expected_value="Responsive alerting",
				actual_value="Test failed",
				error_message=str(e)
			)
	
	async def test_websocket_monitoring(self) -> MonitoringTestResult:
		"""Test WebSocket connection monitoring accuracy"""
		test_name = "WebSocket Monitoring Accuracy"
		
		try:
			# Get initial WebSocket connection count
			initial_connections = await self._get_websocket_connection_count()
			
			# Create test WebSocket connections
			test_connections = 5
			websockets = []
			
			try:
				import websockets as ws
				
				for i in range(test_connections):
					websocket = await ws.connect(f"ws://localhost:8000/api/v1/websockets?token=test_token")
					websockets.append(websocket)
					await asyncio.sleep(0.5)  # Small delay between connections
				
				# Wait for monitoring to update
				await asyncio.sleep(3)
				
				# Check monitored connection count
				monitored_connections = await self._get_websocket_connection_count()
				expected_connections = initial_connections + test_connections
				
				accuracy = abs(expected_connections - monitored_connections) / max(expected_connections, 1)
				passed = accuracy <= 0.1  # 10% tolerance
				
				# Close test connections
				for websocket in websockets:
					await websocket.close()
				
				return MonitoringTestResult(
					test_name=test_name,
					passed=passed,
					expected_value=f"{expected_connections} connections",
					actual_value=f"{monitored_connections} connections",
					tolerance=0.1,
					error_message="" if passed else f"Connection count accuracy: {accuracy*100:.1f}%"
				)
				
			except ImportError:
				return MonitoringTestResult(
					test_name=test_name,
					passed=False,
					expected_value="WebSocket monitoring test",
					actual_value="Test skipped",
					error_message="websockets library not available"
				)
			
		except Exception as e:
			return MonitoringTestResult(
				test_name=test_name,
				passed=False,
				expected_value="Accurate WebSocket monitoring",
				actual_value="Test failed",
				error_message=str(e)
			)
	
	async def _get_monitoring_response_times(self, endpoint: str) -> List[float]:
		"""Get response times from monitoring system"""
		try:
			async with httpx.AsyncClient() as client:
				response = await client.get(f"{self.base_url}/api/v1/monitoring/metrics")
				if response.status_code == 200:
					data = response.json()
					# Extract response times for the endpoint
					# This would depend on your monitoring API structure
					return data.get('response_times', {}).get(endpoint, [])
		except:
			pass
		return []
	
	async def _get_monitoring_error_rate(self) -> Optional[float]:
		"""Get error rate from monitoring system"""
		try:
			async with httpx.AsyncClient() as client:
				response = await client.get(f"{self.base_url}/api/v1/monitoring/stats")
				if response.status_code == 200:
					data = response.json()
					return data.get('error_rate', 0.0)
		except:
			pass
		return None
	
	async def _get_monitoring_throughput(self, endpoint: str) -> Optional[float]:
		"""Get throughput from monitoring system"""
		try:
			async with httpx.AsyncClient() as client:
				response = await client.get(f"{self.base_url}/api/v1/monitoring/throughput")
				if response.status_code == 200:
					data = response.json()
					return data.get('endpoints', {}).get(endpoint, {}).get('rps', 0.0)
		except:
			pass
		return None
	
	async def _get_monitoring_system_metrics(self) -> Optional[Dict[str, float]]:
		"""Get system metrics from monitoring system"""
		try:
			async with httpx.AsyncClient() as client:
				response = await client.get(f"{self.base_url}/api/v1/monitoring/system")
				if response.status_code == 200:
					return response.json()
		except:
			pass
		return None
	
	async def _get_active_alerts_count(self) -> int:
		"""Get number of active alerts"""
		try:
			async with httpx.AsyncClient() as client:
				response = await client.get(f"{self.base_url}/api/v1/monitoring/alerts")
				if response.status_code == 200:
					data = response.json()
					return len(data.get('active_alerts', []))
		except:
			pass
		return 0
	
	async def _get_websocket_connection_count(self) -> int:
		"""Get WebSocket connection count from monitoring"""
		try:
			async with httpx.AsyncClient() as client:
				response = await client.get(f"{self.base_url}/api/v1/monitoring/websockets")
				if response.status_code == 200:
					data = response.json()
					return data.get('active_connections', 0)
		except:
			pass
		return 0
	
	async def run_all_tests(self) -> List[MonitoringTestResult]:
		"""Run all monitoring accuracy tests"""
		
		print("🔍 Running Monitoring Accuracy Tests")
		print("=" * 50)
		
		tests = [
			self.test_response_time_tracking(),
			self.test_error_rate_tracking(),
			self.test_throughput_tracking(),
			self.test_system_metrics_accuracy(),
			self.test_alert_responsiveness(),
			self.test_websocket_monitoring()
		]
		
		results = []
		
		for i, test in enumerate(tests):
			print(f"Running test {i+1}/{len(tests)}...", end=" ")
			result = await test
			results.append(result)
			
			status = "✅ PASS" if result.passed else "❌ FAIL"
			print(f"{status} - {result.test_name}")
			
			if not result.passed:
				print(f"   Expected: {result.expected_value}")
				print(f"   Actual:   {result.actual_value}")
				if result.error_message:
					print(f"   Error:    {result.error_message}")
		
		self.test_results.extend(results)
		
		# Print summary
		passed_tests = sum(1 for r in results if r.passed)
		total_tests = len(results)
		
		print(f"\n📊 Test Summary: {passed_tests}/{total_tests} tests passed")
		
		if passed_tests == total_tests:
			print("🎉 All monitoring accuracy tests passed!")
		else:
			print("⚠️  Some monitoring tests failed. Review system accuracy.")
		
		return results


async def run_monitoring_stress_test():
	"""Run monitoring system under stress to test reliability"""
	
	print("\n🔥 Monitoring System Stress Test")
	print("=" * 50)
	
	# Generate high load to stress monitoring system
	async def generate_load():
		async with httpx.AsyncClient() as client:
			tasks = []
			
			# Generate mixed load patterns
			for _ in range(1000):
				# Mix of successful and error requests
				if random.random() < 0.8:  # 80% success rate
					task = client.get("http://localhost:8000/health")
				else:
					task = client.get("http://localhost:8000/nonexistent")
				
				tasks.append(asyncio.create_task(task))
				
				if len(tasks) >= 50:  # Batch requests
					await asyncio.gather(*tasks, return_exceptions=True)
					tasks = []
					await asyncio.sleep(0.1)
			
			if tasks:  # Handle remaining tasks
				await asyncio.gather(*tasks, return_exceptions=True)
	
	# Monitor system performance during stress
	monitoring_data = []
	
	async def monitor_during_stress():
		for _ in range(30):  # Monitor for 30 seconds
			try:
				async with httpx.AsyncClient() as client:
					response = await client.get("http://localhost:8000/api/v1/monitoring/stats")
					if response.status_code == 200:
						data = response.json()
						monitoring_data.append({
							'timestamp': datetime.utcnow(),
							'stats': data
						})
			except:
				pass
			
			await asyncio.sleep(1)
	
	# Run stress test and monitoring concurrently
	print("Generating high load...")
	await asyncio.gather(
		generate_load(),
		monitor_during_stress()
	)
	
	# Analyze monitoring system performance during stress
	if monitoring_data:
		response_times = []
		for entry in monitoring_data:
			if 'response_time' in entry['stats']:
				response_times.append(entry['stats']['response_time'])
		
		if response_times:
			avg_monitoring_response = sum(response_times) / len(response_times)
			max_monitoring_response = max(response_times)
			
			print(f"📊 Monitoring system performance during stress:")
			print(f"   Average monitoring response time: {avg_monitoring_response:.2f}ms")
			print(f"   Maximum monitoring response time: {max_monitoring_response:.2f}ms")
			print(f"   Data points collected: {len(monitoring_data)}")
			
			if max_monitoring_response < 1000:  # 1 second
				print("✅ Monitoring system remained responsive under stress")
			else:
				print("⚠️  Monitoring system showed degraded performance under stress")
		else:
			print("❌ Unable to collect monitoring performance data")
	else:
		print("❌ No monitoring data collected during stress test")


async def main():
	"""Run comprehensive monitoring tests"""
	
	print("🎯 Comprehensive Monitoring System Tests")
	print("=" * 60)
	
	tester = MonitoringAccuracyTester()
	
	# Run accuracy tests
	accuracy_results = await tester.run_all_tests()
	
	# Run stress test
	await run_monitoring_stress_test()
	
	# Generate final report
	print(f"\n📋 MONITORING TEST REPORT")
	print("=" * 60)
	
	passed_tests = sum(1 for r in accuracy_results if r.passed)
	total_tests = len(accuracy_results)
	
	print(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
	print(f"Total tests: {total_tests}")
	print(f"Passed: {passed_tests}")
	print(f"Failed: {total_tests - passed_tests}")
	print(f"Success rate: {passed_tests/total_tests*100:.1f}%")
	
	if passed_tests == total_tests:
		print("\n🎉 Monitoring system is accurate and reliable!")
	else:
		print("\n⚠️  Monitoring system needs attention:")
		for result in accuracy_results:
			if not result.passed:
				print(f"   • {result.test_name}: {result.error_message}")


if __name__ == "__main__":
	logging.basicConfig(level=logging.INFO)
	asyncio.run(main())