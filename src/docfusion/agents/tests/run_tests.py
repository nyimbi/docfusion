"""
Test Runner

Script to run all agent system tests with proper setup and reporting.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import sys
import os
import pytest
import asyncio
from pathlib import Path

# Add the agents directory to Python path
agents_dir = Path(__file__).parent.parent
sys.path.insert(0, str(agents_dir))

def run_agent_tests():
	"""Run all agent system tests"""
	print("🤖 Starting AI Agent System Test Suite")
	print("=" * 50)
	
	test_modules = [
		"test_agent_core.py",
		"test_communication.py", 
		"test_orchestration.py",
		"test_memory.py",
		"test_integration.py",
		"test_end_to_end.py"
	]
	
	# Test configuration
	pytest_args = [
		"-v",  # Verbose output
		"-s",  # Don't capture output
		"--tb=short",  # Short traceback format
		"--maxfail=5",  # Stop after 5 failures
		"-x" if "--stop-on-fail" in sys.argv else "",  # Stop on first failure if requested
	]
	
	# Filter out empty args
	pytest_args = [arg for arg in pytest_args if arg]
	
	# Add test modules
	test_dir = Path(__file__).parent
	for module in test_modules:
		test_path = test_dir / module
		if test_path.exists():
			pytest_args.append(str(test_path))
		else:
			print(f"⚠️  Warning: Test module {module} not found")
	
	print(f"Running tests: {', '.join(test_modules)}")
	print("=" * 50)
	
	# Run tests
	exit_code = pytest.main(pytest_args)
	
	if exit_code == 0:
		print("\n✅ All tests passed successfully!")
	else:
		print(f"\n❌ Tests failed with exit code: {exit_code}")
	
	return exit_code


def run_quick_tests():
	"""Run only core and integration tests for quick validation"""
	print("🚀 Running Quick Agent System Tests")
	print("=" * 40)
	
	quick_tests = [
		"test_agent_core.py",
		"test_communication.py",
		"test_integration.py"
	]
	
	pytest_args = ["-v", "--tb=short", "--maxfail=3"]
	
	test_dir = Path(__file__).parent
	for module in quick_tests:
		test_path = test_dir / module
		if test_path.exists():
			pytest_args.append(str(test_path))
	
	exit_code = pytest.main(pytest_args)
	
	if exit_code == 0:
		print("\n✅ Quick tests passed!")
	else:
		print(f"\n❌ Quick tests failed with exit code: {exit_code}")
	
	return exit_code


def run_specific_test(test_name):
	"""Run a specific test module"""
	print(f"🎯 Running Specific Test: {test_name}")
	print("=" * 30)
	
	test_path = Path(__file__).parent / f"test_{test_name}.py"
	
	if not test_path.exists():
		print(f"❌ Test file not found: {test_path}")
		return 1
	
	pytest_args = ["-v", "-s", "--tb=short", str(test_path)]
	exit_code = pytest.main(pytest_args)
	
	return exit_code


if __name__ == "__main__":
	if len(sys.argv) > 1:
		if sys.argv[1] == "quick":
			exit_code = run_quick_tests()
		elif sys.argv[1] == "all":
			exit_code = run_agent_tests()
		else:
			# Run specific test
			test_name = sys.argv[1]
			exit_code = run_specific_test(test_name)
	else:
		# Default: run all tests
		exit_code = run_agent_tests()
	
	sys.exit(exit_code)