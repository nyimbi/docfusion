"""
Combinatorial Integration Test Runner

Executes all combinatorial integration tests and provides comprehensive
results analysis for DocuFusion component interoperability validation.
"""

import asyncio
import time
import sys
from pathlib import Path
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
from datetime import datetime
import json

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from test_combinatorial_integrations import (
    TestPairwiseIntegrations,
    TestTripleIntegrations, 
    TestQuadrupleIntegrations,
    MockComponentFactory
)


@dataclass
class TestResult:
    """Individual test result."""
    test_name: str
    integration_type: str  # pairwise, triple, quadruple
    components: List[str]
    success: bool
    duration_seconds: float
    error_message: str = ""


@dataclass 
class IntegrationTestSuite:
    """Complete integration test suite results."""
    total_tests: int
    passed_tests: int
    failed_tests: int
    total_duration: float
    test_results: List[TestResult]
    component_matrix: Dict[str, Dict[str, bool]]


class CombinatorialTestRunner:
    """Runner for all combinatorial integration tests."""
    
    def __init__(self):
        self.components = [
            "Document Engine", "Workflow System", "Agents System", 
            "NLP Services", "Security System", "Notifications"
        ]
        self.component_abbrev = {
            "Document Engine": "DE",
            "Workflow System": "WF", 
            "Agents System": "AG",
            "NLP Services": "NLP",
            "Security System": "SEC",
            "Notifications": "NOT"
        }
        
    async def run_all_tests(self) -> IntegrationTestSuite:
        """Run all combinatorial integration tests."""
        print("🚀 Starting DocuFusion Combinatorial Integration Test Suite")
        print("=" * 70)
        
        start_time = time.time()
        test_results = []
        
        # Run pairwise integration tests
        print("\n📋 Running Pairwise Integration Tests (15 combinations)")
        pairwise_results = await self._run_pairwise_tests()
        test_results.extend(pairwise_results)
        
        # Run triple integration tests  
        print("\n📋 Running Triple Integration Tests (2 selected combinations)")
        triple_results = await self._run_triple_tests()
        test_results.extend(triple_results)
        
        # Run quadruple integration tests
        print("\n📋 Running Quadruple Integration Tests (1 selected combination)")
        quadruple_results = await self._run_quadruple_tests()
        test_results.extend(quadruple_results)
        
        total_duration = time.time() - start_time
        
        # Calculate results
        passed_tests = len([r for r in test_results if r.success])
        failed_tests = len([r for r in test_results if not r.success])
        
        # Build component interaction matrix
        component_matrix = self._build_component_matrix(test_results)
        
        # Create test suite results
        suite_results = IntegrationTestSuite(
            total_tests=len(test_results),
            passed_tests=passed_tests,
            failed_tests=failed_tests,
            total_duration=total_duration,
            test_results=test_results,
            component_matrix=component_matrix
        )
        
        # Print summary
        self._print_test_summary(suite_results)
        
        return suite_results
    
    async def _run_pairwise_tests(self) -> List[TestResult]:
        """Run all pairwise integration tests."""
        test_instance = TestPairwiseIntegrations()
        results = []
        
        # Define all pairwise test methods
        pairwise_tests = [
            ("document_engine_workflow_integration", ["Document Engine", "Workflow System"]),
            ("document_engine_agents_integration", ["Document Engine", "Agents System"]),
            ("document_engine_nlp_integration", ["Document Engine", "NLP Services"]),
            ("document_engine_security_integration", ["Document Engine", "Security System"]),
            ("document_engine_notifications_integration", ["Document Engine", "Notifications"]),
            ("workflow_agents_integration", ["Workflow System", "Agents System"]),
            ("workflow_nlp_integration", ["Workflow System", "NLP Services"]),
            ("workflow_security_integration", ["Workflow System", "Security System"]),
            ("workflow_notifications_integration", ["Workflow System", "Notifications"]),
            ("agents_nlp_integration", ["Agents System", "NLP Services"]),
            ("agents_security_integration", ["Agents System", "Security System"]),
            ("agents_notifications_integration", ["Agents System", "Notifications"]),
            ("nlp_security_integration", ["NLP Services", "Security System"]),
            ("nlp_notifications_integration", ["NLP Services", "Notifications"]),
            ("security_notifications_integration", ["Security System", "Notifications"])
        ]
        
        for test_method, components in pairwise_tests:
            result = await self._run_single_test(
                test_instance, 
                f"test_{test_method}",
                "pairwise",
                components
            )
            results.append(result)
            
        return results
    
    async def _run_triple_tests(self) -> List[TestResult]:
        """Run selected triple integration tests."""
        test_instance = TestTripleIntegrations()
        results = []
        
        triple_tests = [
            ("document_workflow_notifications_integration", ["Document Engine", "Workflow System", "Notifications"]),
            ("agents_nlp_security_integration", ["Agents System", "NLP Services", "Security System"])
        ]
        
        for test_method, components in triple_tests:
            result = await self._run_single_test(
                test_instance,
                f"test_{test_method}",
                "triple", 
                components
            )
            results.append(result)
            
        return results
    
    async def _run_quadruple_tests(self) -> List[TestResult]:
        """Run selected quadruple integration tests."""
        test_instance = TestQuadrupleIntegrations()
        results = []
        
        quadruple_tests = [
            ("full_document_pipeline_integration", ["Document Engine", "Workflow System", "Agents System", "NLP Services"])
        ]
        
        for test_method, components in quadruple_tests:
            result = await self._run_single_test(
                test_instance,
                f"test_{test_method}",
                "quadruple",
                components
            )
            results.append(result)
            
        return results
    
    async def _run_single_test(
        self, 
        test_instance: Any, 
        test_method: str,
        integration_type: str,
        components: List[str]
    ) -> TestResult:
        """Run a single integration test."""
        component_abbrevs = [self.component_abbrev[comp] for comp in components]
        test_display = f"{integration_type.upper()}: {' + '.join(component_abbrevs)}"
        
        print(f"  ⚡ Running {test_display}...", end="", flush=True)
        
        start_time = time.time()
        try:
            # Get the test method and run it
            method = getattr(test_instance, test_method)
            await method()
            
            duration = time.time() - start_time
            print(f" ✅ PASSED ({duration:.2f}s)")
            
            return TestResult(
                test_name=test_method,
                integration_type=integration_type,
                components=components,
                success=True,
                duration_seconds=duration
            )
            
        except Exception as e:
            duration = time.time() - start_time
            print(f" ❌ FAILED ({duration:.2f}s)")
            print(f"    Error: {str(e)}")
            
            return TestResult(
                test_name=test_method,
                integration_type=integration_type,
                components=components,
                success=False,
                duration_seconds=duration,
                error_message=str(e)
            )
    
    def _build_component_matrix(self, test_results: List[TestResult]) -> Dict[str, Dict[str, bool]]:
        """Build component interaction success matrix."""
        matrix = {}
        
        for component in self.components:
            matrix[component] = {}
            for other_component in self.components:
                if component == other_component:
                    matrix[component][other_component] = True  # Self-integration always true
                else:
                    matrix[component][other_component] = False  # Default to False
        
        # Fill matrix based on test results
        for result in test_results:
            if result.integration_type == "pairwise" and len(result.components) == 2:
                comp1, comp2 = result.components
                matrix[comp1][comp2] = result.success
                matrix[comp2][comp1] = result.success  # Symmetric
        
        return matrix
    
    def _print_test_summary(self, suite_results: IntegrationTestSuite):
        """Print comprehensive test results summary."""
        print("\n" + "=" * 70)
        print("📊 DOCUFUSION COMBINATORIAL INTEGRATION TEST RESULTS")
        print("=" * 70)
        
        # Overall results
        success_rate = (suite_results.passed_tests / suite_results.total_tests) * 100
        print(f"📈 Overall Results:")
        print(f"   Total Tests: {suite_results.total_tests}")
        print(f"   Passed: {suite_results.passed_tests} ✅")
        print(f"   Failed: {suite_results.failed_tests} ❌")
        print(f"   Success Rate: {success_rate:.1f}%")
        print(f"   Total Duration: {suite_results.total_duration:.2f} seconds")
        
        # Results by integration type
        print(f"\n📋 Results by Integration Type:")
        for integration_type in ["pairwise", "triple", "quadruple"]:
            type_tests = [r for r in suite_results.test_results if r.integration_type == integration_type]
            if type_tests:
                type_passed = len([r for r in type_tests if r.success])
                type_total = len(type_tests)
                type_rate = (type_passed / type_total) * 100
                print(f"   {integration_type.title()}: {type_passed}/{type_total} ({type_rate:.1f}%)")
        
        # Component interaction matrix
        print(f"\n🔗 Component Interaction Matrix:")
        print("   " + "".join(f"{abbrev:>6}" for abbrev in self.component_abbrev.values()))
        
        for component in self.components:
            abbrev = self.component_abbrev[component]
            row = f"{abbrev:>3}"
            for other_component in self.components:
                if component == other_component:
                    row += "   ●  "  # Self
                elif suite_results.component_matrix[component][other_component]:
                    row += "   ✅ "  # Success
                else:
                    row += "   ❌ "  # Failed or not tested
            print(row)
        
        print(f"\n   Legend: ● = Self, ✅ = Integration Success, ❌ = Integration Failed/Not Tested")
        
        # Failed tests details
        failed_tests = [r for r in suite_results.test_results if not r.success]
        if failed_tests:
            print(f"\n❌ Failed Test Details:")
            for test in failed_tests:
                components_str = " + ".join([self.component_abbrev[c] for c in test.components])
                print(f"   {test.integration_type.upper()}: {components_str}")
                print(f"      Error: {test.error_message}")
        
        # Performance metrics
        print(f"\n⚡ Performance Metrics:")
        avg_duration = sum(r.duration_seconds for r in suite_results.test_results) / len(suite_results.test_results)
        fastest_test = min(suite_results.test_results, key=lambda r: r.duration_seconds)
        slowest_test = max(suite_results.test_results, key=lambda r: r.duration_seconds)
        
        print(f"   Average Test Duration: {avg_duration:.3f} seconds")
        print(f"   Fastest Test: {fastest_test.duration_seconds:.3f}s ({fastest_test.test_name})")
        print(f"   Slowest Test: {slowest_test.duration_seconds:.3f}s ({slowest_test.test_name})")
        
        # Integration coverage analysis
        print(f"\n📊 Integration Coverage Analysis:")
        total_possible_pairs = len(self.components) * (len(self.components) - 1) // 2
        tested_pairs = len([r for r in suite_results.test_results if r.integration_type == "pairwise"])
        coverage_rate = (tested_pairs / total_possible_pairs) * 100 if total_possible_pairs > 0 else 0
        
        print(f"   Pairwise Coverage: {tested_pairs}/{total_possible_pairs} ({coverage_rate:.1f}%)")
        print(f"   Triple Integration Tests: {len([r for r in suite_results.test_results if r.integration_type == 'triple'])}")
        print(f"   Quadruple Integration Tests: {len([r for r in suite_results.test_results if r.integration_type == 'quadruple'])}")
        
        # Final assessment
        print(f"\n🎯 Final Assessment:")
        if success_rate >= 95:
            assessment = "EXCELLENT - All critical integrations working perfectly"
            emoji = "🌟"
        elif success_rate >= 85:
            assessment = "GOOD - Most integrations working with minor issues"
            emoji = "👍"
        elif success_rate >= 70:
            assessment = "ACCEPTABLE - Some integration issues need attention"
            emoji = "⚠️"
        else:
            assessment = "NEEDS WORK - Critical integration failures detected"
            emoji = "🔴"
        
        print(f"   {emoji} {assessment}")
        print(f"   DocuFusion Integration Status: {'PRODUCTION READY' if success_rate >= 90 else 'NEEDS FIXES'}")
        
        print("\n" + "=" * 70)
    
    def save_results_to_file(self, suite_results: IntegrationTestSuite, filename: str = None):
        """Save test results to JSON file for further analysis."""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"combinatorial_integration_results_{timestamp}.json"
        
        # Convert results to serializable format
        results_data = {
            "test_summary": {
                "total_tests": suite_results.total_tests,
                "passed_tests": suite_results.passed_tests,
                "failed_tests": suite_results.failed_tests,
                "success_rate": (suite_results.passed_tests / suite_results.total_tests) * 100,
                "total_duration": suite_results.total_duration,
                "timestamp": datetime.now().isoformat()
            },
            "component_matrix": suite_results.component_matrix,
            "detailed_results": [
                {
                    "test_name": r.test_name,
                    "integration_type": r.integration_type,
                    "components": r.components,
                    "success": r.success,
                    "duration_seconds": r.duration_seconds,
                    "error_message": r.error_message
                }
                for r in suite_results.test_results
            ]
        }
        
        filepath = Path(__file__).parent / filename
        with open(filepath, 'w') as f:
            json.dump(results_data, f, indent=2)
        
        print(f"📄 Test results saved to: {filepath}")


async def main():
    """Main test runner entry point."""
    print("🔧 DocuFusion Combinatorial Integration Test Suite")
    print("   Testing all component integration combinations...")
    print()
    
    runner = CombinatorialTestRunner()
    
    try:
        # Run all tests
        results = await runner.run_all_tests()
        
        # Save results to file
        runner.save_results_to_file(results)
        
        # Return appropriate exit code
        exit_code = 0 if results.failed_tests == 0 else 1
        print(f"\n🏁 Test suite completed with exit code: {exit_code}")
        
        return exit_code
        
    except Exception as e:
        print(f"\n💥 Test suite failed with exception: {e}")
        return 1


if __name__ == "__main__":
    import sys
    exit_code = asyncio.run(main())
    sys.exit(exit_code)