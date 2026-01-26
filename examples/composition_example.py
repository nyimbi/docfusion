#!/usr/bin/env python3
"""
Agent Composition Language Example

Demonstrates the complete composition language system with YAML-based
workflow definition, parsing, interpretation, and execution.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025

Usage:
	python examples/composition_example.py
"""

import asyncio
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from docfusion.composition import (
	CompositionLanguage,
	CompositionParser,
	CompositionInterpreter,
	CompositionRunner
)


async def demo_composition_language():
	"""Demonstrate the complete composition language workflow"""
	
	print("🚀 Agent Composition Language Demo")
	print("=" * 50)
	
	# 1. Get example composition (use simpler version first)
	print("\n1. Loading Example Composition...")
	
	# Use a simplified composition for initial testing
	example_yaml = """
composition:
  name: "Simple Test Workflow"
  version: "1.0"
  description: "Basic test workflow"

config:
  timeout: 300
  max_retries: 3

context:
  topic: "${input.topic}"

agents:
  research_agent:
    type: "research_specialist"
    model: "qwen2.5:7b"
    temperature: 0.3
    prompt: "Research the topic: {topic}"
    
  content_writer:
    type: "content_specialist"
    model: "qwen2.5:7b"
    temperature: 0.7
    prompt: "Create content based on research for: {topic}"

flow:
  main_flow:
    sequence: |
      research_agent -> content_writer
"""
	
	print(f"   ✅ Loaded {len(example_yaml.split(chr(10)))} lines of YAML")
	
	# 2. Parse composition
	print("\n2. Parsing Composition...")
	parser = CompositionParser()
	
	try:
		parsed_composition = await parser.parse_composition(example_yaml)
		print(f"   ✅ Parsed composition: {parsed_composition.name}")
		print(f"      Agents: {len(parsed_composition.agents)}")
		print(f"      Flows: {len(parsed_composition.flows)}")
		print(f"      Version: {parsed_composition.version}")
		
		# Show flow details
		for flow_id, flow in parsed_composition.flows.items():
			print(f"      Flow '{flow_id}': {len(flow.expressions)} expressions")
			print(f"         Entry points: {flow.entry_points}")
			print(f"         Exit points: {flow.exit_points}")
			
	except Exception as e:
		print(f"   ❌ Parsing failed: {str(e)}")
		return
	
	# 3. Interpret composition
	print("\n3. Interpreting Composition...")
	interpreter = CompositionInterpreter()
	
	try:
		interpreted_composition = await interpreter.interpret_composition(parsed_composition)
		print(f"   ✅ Interpreted composition successfully")
		print(f"      Execution nodes: {len(interpreted_composition.execution_graph.nodes)}")
		print(f"      Execution edges: {len(interpreted_composition.execution_graph.edges)}")
		print(f"      Execution levels: {len(interpreted_composition.execution_graph.execution_order)}")
		print(f"      Parallel groups: {len(interpreted_composition.execution_graph.parallel_groups)}")
		
		# Show execution plan
		execution_plan = await interpreter.get_execution_plan(interpreted_composition)
		print(f"      Estimated duration: {execution_plan['estimated_duration']:.2f} seconds")
		print(f"      Resource requirements: {execution_plan['resource_requirements']['max_parallel_agents']} max parallel")
		
	except Exception as e:
		print(f"   ❌ Interpretation failed: {str(e)}")
		return
	
	# 4. Execute composition
	print("\n4. Executing Composition...")
	runner = CompositionRunner(max_workers=5)
	
	# Prepare input data
	input_data = {
		"topic": "AI-Powered Document Generation Platform",
		"target_audience": "enterprise decision makers",
		"deadline": "2025-08-15",
		"budget_range": "$50,000 - $100,000",
		"focus_areas": "market analysis, technical feasibility, competitive advantages",
		"tone": "professional and persuasive",
		"word_count": 2000,
		"depth_level": "comprehensive",
		"industry": "technology",
		"competitive_analysis": "enabled"
	}
	
	try:
		execution_report = await runner.execute_composition(
			interpreted_composition, 
			input_data,
			execution_options={
				'timeout': 600,
				'parallel_limit': 3,
				'retry_policy': 'exponential_backoff'
			}
		)
		
		print(f"   ✅ Execution completed")
		print(f"      Status: {execution_report.status.value}")
		print(f"      Duration: {execution_report.duration:.2f} seconds")
		print(f"      Successful nodes: {execution_report.successful_nodes}/{execution_report.total_nodes}")
		print(f"      Failed nodes: {execution_report.failed_nodes}")
		
		# Show performance metrics
		metrics = execution_report.performance_metrics
		print(f"      Average node duration: {metrics.get('average_node_duration', 0):.2f}s")
		print(f"      Success rate: {metrics.get('success_rate', 0):.2%}")
		print(f"      Throughput: {metrics.get('throughput', 0):.2f} nodes/second")
		
		# Show some node results
		print("\n   📊 Sample Node Results:")
		for i, (node_id, result) in enumerate(list(execution_report.node_results.items())[:3]):
			print(f"      {i+1}. {node_id}: {result.status.value} ({result.duration:.2f}s)")
			if result.output:
				output_preview = str(result.output)[:100] + "..." if len(str(result.output)) > 100 else str(result.output)
				print(f"         Output: {output_preview}")
		
	except Exception as e:
		print(f"   ❌ Execution failed: {str(e)}")
		return
	
	# 5. Demonstrate streaming execution
	print("\n5. Demonstrating Streaming Execution...")
	
	try:
		print("   📡 Starting streaming execution...")
		stream_count = 0
		
		async for event in runner.stream_execution(interpreted_composition, input_data):
			stream_count += 1
			event_type = event.get('type', 'unknown')
			
			if event_type == 'execution_started':
				print(f"      🚀 Execution started with {event['total_nodes']} nodes")
			elif event_type == 'level_started':
				print(f"      📋 Level {event['level']} started with {len(event['nodes'])} nodes")
			elif event_type == 'node_completed':
				status_icon = "✅" if event['status'] == 'completed' else "❌"
				print(f"         {status_icon} {event['node_id']}: {event['status']} ({event['duration']:.2f}s)")
			elif event_type == 'execution_completed':
				print(f"      🎉 Execution completed successfully")
			elif event_type == 'execution_failed':
				print(f"      💥 Execution failed: {event['error']}")
			
			# Limit output for demo
			if stream_count > 20:
				print(f"      ... (truncated after {stream_count} events)")
				break
		
	except Exception as e:
		print(f"   ❌ Streaming failed: {str(e)}")
	
	# 6. Show language features
	print("\n6. Language Features Summary...")
	features = CompositionLanguage.get_language_features()
	
	print(f"   📚 Operator System:")
	print(f"      Operators available: {len(features['operator_system']['operators'])}")
	print(f"      Example operators: {', '.join(features['operator_system']['operators'][:5])}")
	
	print(f"   🔀 Conditional Logic:")
	print(f"      Built-in conditions: {len(features['conditional_logic']['built_in_conditions'])}")
	print(f"      Custom conditions: {features['conditional_logic']['custom_conditions']}")
	
	print(f"   ⚡ Parallelism:")
	print(f"      Features: {', '.join(features['parallelism']['features'])}")
	
	print(f"   🔧 Error Handling:")
	print(f"      Features: {', '.join(features['error_handling']['features'])}")
	
	# 7. Validate syntax examples
	print("\n7. Syntax Validation Examples...")
	syntax_ref = CompositionLanguage.get_syntax_reference()
	
	test_expressions = [
		"research_agent -> content_writer",
		"(research_agent || market_analyst) -> content_writer",
		"research_agent < (detailed_analysis, basic_summary, sufficient_data)",
		"research_agent >> content_writer >> reviewer",
		"content_writer ? quality_check -> editor",
		"reviewer * 3 -> final_output",
		"research_agent ! backup_research -> content_writer"
	]
	
	for expr in test_expressions:
		try:
			validation = await parser.validate_expression(expr, ['research_agent', 'content_writer', 'market_analyst', 'detailed_analysis', 'basic_summary', 'reviewer', 'editor', 'backup_research', 'final_output'])
			status_icon = "✅" if validation['valid'] else "❌"
			print(f"      {status_icon} '{expr}' -> {validation.get('operator', 'unknown')}")
		except Exception as e:
			print(f"      ❌ '{expr}' -> validation error: {str(e)}")
	
	# 8. Performance summary
	print("\n8. Performance Summary...")
	perf_summary = runner.get_performance_summary()
	
	print(f"   📈 Total executions: {perf_summary['total_executions']}")
	print(f"   ✅ Success rate: {perf_summary['success_rate']:.2%}")
	print(f"   ⏱️  Average duration: {perf_summary['average_duration']:.2f} seconds")
	print(f"   🔢 Total nodes executed: {perf_summary['total_nodes_executed']}")
	print(f"   🏃 Active executions: {perf_summary['active_executions']}")
	
	print("\n" + "=" * 50)
	print("🎉 Agent Composition Language Demo Complete!")
	print("\nKey Capabilities Demonstrated:")
	print("✅ YAML-based declarative workflow definition")
	print("✅ Advanced operator syntax (->、||、<、>>、&、?、*、!、~、|)")
	print("✅ Comprehensive parsing and validation")
	print("✅ Intelligent interpretation and optimization")
	print("✅ Parallel execution with dependency resolution")
	print("✅ Real-time streaming execution")
	print("✅ Error handling and retry mechanisms")
	print("✅ Performance monitoring and metrics")
	print("✅ Extensible function and condition system")


async def demo_custom_composition():
	"""Demonstrate creating and executing a custom composition"""
	
	print("\n" + "=" * 50)
	print("🔧 Custom Composition Demo")
	print("=" * 50)
	
	# Create a simple custom composition
	custom_yaml = """
composition:
  name: "Simple Research Workflow"
  version: "1.0"
  description: "Basic research and writing workflow"

config:
  timeout: 180
  max_retries: 2
  error_strategy: "continue"

context:
  topic: "${input.topic}"
  output_format: "markdown"

agents:
  researcher:
    type: "research_specialist"
    model: "qwen2.5:7b"
    temperature: 0.3
    prompt: |
      Research the topic: {topic}
      Provide comprehensive findings with sources.
    tools: ["web_search", "document_analysis"]
    
  writer:
    type: "content_specialist"
    model: "qwen2.5:7b"
    temperature: 0.7
    prompt: |
      Create a well-structured document based on research.
      Topic: {topic}
      Format: {output_format}
    
  reviewer:
    type: "review_specialist"
    model: "qwen2.5:7b"
    temperature: 0.2
    prompt: |
      Review content for quality and accuracy.
      Provide feedback and suggestions.

flow:
  main_flow:
    sequence: |
      researcher -> writer -> reviewer
      
  alternative_flow:
    sequence: |
      researcher -> (writer || backup_writer) -> reviewer ? quality_check -> final_output
"""
	
	print("1. Parsing Custom Composition...")
	parser = CompositionParser()
	
	try:
		parsed = await parser.parse_composition(custom_yaml)
		print(f"   ✅ Parsed: {parsed.name}")
		print(f"      Agents: {list(parsed.agents.keys())}")
		print(f"      Flows: {list(parsed.flows.keys())}")
		
	except Exception as e:
		print(f"   ❌ Parsing failed: {str(e)}")
		return
	
	print("\n2. Interpreting Custom Composition...")
	interpreter = CompositionInterpreter()
	
	try:
		interpreted = await interpreter.interpret_composition(parsed)
		print(f"   ✅ Interpreted successfully")
		print(f"      Execution graph: {len(interpreted.execution_graph.nodes)} nodes")
		
	except Exception as e:
		print(f"   ❌ Interpretation failed: {str(e)}")
		return
	
	print("\n3. Executing Custom Composition...")
	runner = CompositionRunner()
	
	input_data = {
		"topic": "Sustainable Energy Solutions",
		"output_format": "markdown"
	}
	
	try:
		report = await runner.execute_composition(interpreted, input_data)
		print(f"   ✅ Execution: {report.status.value}")
		print(f"      Duration: {report.duration:.2f}s")
		print(f"      Success rate: {(report.successful_nodes/report.total_nodes)*100:.1f}%")
		
	except Exception as e:
		print(f"   ❌ Execution failed: {str(e)}")


async def main():
	"""Main demo function"""
	print("Agent Composition Language (ACL)")
	print("Declarative YAML-based Agent Workflows")
	print("DocuFusion AI Agent Framework")
	print("=" * 50)
	
	try:
		# Run main demo
		await demo_composition_language()
		
		# Ask user if they want to see custom composition demo
		print("\n🤔 Would you like to see the custom composition demo? (y/n): ", end="")
		try:
			response = input().strip().lower()
			if response in ['y', 'yes']:
				await demo_custom_composition()
			else:
				print("👋 Demo completed. Thank you!")
		except (KeyboardInterrupt, EOFError):
			print("\n👋 Demo completed. Thank you!")
			
	except Exception as e:
		print(f"\n❌ Demo failed: {e}")
		import traceback
		traceback.print_exc()


if __name__ == "__main__":
	asyncio.run(main())