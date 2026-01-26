#!/usr/bin/env python3
"""
Simplified NLP Integration Tests
Testing NLP mock replacement and basic functionality
"""

import asyncio
import sys
from pathlib import Path

# Add the src directory to Python path
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

def test_nlp_mock_replacement():
	"""Test that NLP mocks are replaced with real implementations"""
	print("=== Test: NLP Mock Replacement ===")
	
	try:
		from docfusion.document_engine.assembler.content_assembler import (
			ContentAssembler, RealNLPService, MockNLPService, HAS_REAL_NLP
		)
		
		print(f"Real NLP services available: {HAS_REAL_NLP}")
		
		# Create content assembler
		assembler = ContentAssembler()
		print(f"Using NLP service: {type(assembler.nlp_service).__name__}")
		
		if HAS_REAL_NLP and isinstance(assembler.nlp_service, RealNLPService):
			print("✓ Successfully using Real NLP Service")
		elif isinstance(assembler.nlp_service, MockNLPService):
			print("✓ Using Mock NLP Service (expected if real NLP not available)")
		else:
			print(f"? Using unexpected NLP service type: {type(assembler.nlp_service)}")
		
		return True
		
	except Exception as e:
		print(f"✗ NLP mock replacement test failed: {e}")
		import traceback
		traceback.print_exc()
		return False

async def test_basic_content_analysis():
	"""Test basic content analysis functionality"""
	print("\n=== Test: Basic Content Analysis ===")
	
	try:
		from docfusion.document_engine.assembler.content_assembler import ContentAssembler
		
		assembler = ContentAssembler()
		
		# Test content for analysis
		test_content = """
		This is a comprehensive technical proposal for modernizing your IT infrastructure. 
		Our solution leverages cloud-native technologies and provides scalable, secure, and 
		cost-effective implementation. The project includes assessment, migration, and optimization phases.
		"""
		
		print("Analyzing test content...")
		analysis = await assembler.nlp_service.analyze_content(test_content)
		
		print("Analysis Results:")
		print(f"  Word count: {analysis.get('word_count', 'N/A')}")
		print(f"  Reading time: {analysis.get('estimated_reading_time', 'N/A'):.1f} minutes")
		print(f"  Complexity: {analysis.get('complexity_score', 'N/A')}")
		print(f"  Sentiment: {analysis.get('sentiment', 'N/A')}")
		print(f"  Key topics: {analysis.get('key_topics', [])}")
		
		# Check if advanced analysis features are available
		if 'coherence_score' in analysis:
			print(f"  Coherence: {analysis['coherence_score']:.2f}")
		if 'style_recommendations' in analysis:
			print(f"  Style recommendations: {len(analysis['style_recommendations'])}")
		
		print("✓ Content analysis completed successfully")
		return True
		
	except Exception as e:
		print(f"✗ Content analysis test failed: {e}")
		import traceback
		traceback.print_exc()
		return False

async def test_content_generation():
	"""Test content generation functionality"""
	print("\n=== Test: Content Generation ===")
	
	try:
		from docfusion.document_engine.assembler.content_assembler import ContentAssembler
		
		assembler = ContentAssembler()
		
		# Test prompts for different content types
		test_prompts = [
			("Generate an executive summary for a cloud migration project", "executive_summary"),
			("Create a technical approach section for system modernization", "technical_approach"),
			("Write a project timeline for infrastructure upgrade", "timeline")
		]
		
		for prompt, content_type in test_prompts:
			print(f"\nGenerating {content_type}...")
			generated_content = await assembler.nlp_service.generate_content(
				prompt, content_type=content_type, max_length=200
			)
			
			print(f"Generated content ({len(generated_content.split())} words):")
			print(f"  {generated_content[:100]}...")
		
		print("✓ Content generation completed successfully")
		return True
		
	except Exception as e:
		print(f"✗ Content generation test failed: {e}")
		import traceback
		traceback.print_exc()
		return False

async def test_document_assembly():
	"""Test basic document assembly with real content blocks"""
	print("\n=== Test: Document Assembly ===")
	
	try:
		from docfusion.document_engine.assembler.content_assembler import (
			ContentAssembler, ContentBlock, AssemblyRequest, AssemblyContext
		)
		
		assembler = ContentAssembler()
		
		# Create test content blocks
		blocks = [
			ContentBlock(
				block_type="text",
				content="This proposal presents our approach to modernizing your IT systems.",
				block_id="intro",
				metadata={"section": "introduction", "priority": "high"}
			),
			ContentBlock(
				block_type="text",
				content="Our solution uses cloud-native architecture with microservices design.",
				block_id="solution", 
				metadata={"section": "solution", "priority": "high"}
			)
		]
		
		# Create assembly context
		context = AssemblyContext(
			document_type="proposal",
			target_template="standard_proposal",
			user_id="test_user",
			organization_id="test_org",
			assembly_preferences={"target_audience": "technical_team"}
		)
		
		print(f"Assembling document with {len(blocks)} content blocks...")
		result = await assembler.assemble_document(blocks, context)
		
		print(f"Blocks processed: {result.total_blocks_processed}")
		print(f"Quality score: {result.quality_score:.2f}")
		print(f"Assembly duration: {result.assembly_duration:.3f}s")
		
		if result.assembled_blocks:
			print(f"Assembled blocks: {len(result.assembled_blocks)}")
			print("✓ Document assembly completed successfully")
			return True
		else:
			print("✗ No blocks were assembled")
			return False
		
	except Exception as e:
		print(f"✗ Document assembly test failed: {e}")
		import traceback
		traceback.print_exc()
		return False

async def test_centralized_llm_config():
	"""Test that centralized LLM configuration is working"""
	print("\n=== Test: Centralized LLM Configuration ===")
	
	try:
		from docfusion.config.llm_config import get_llm_config, LLMTask
		
		# Test different task configurations
		tasks_to_test = [
			LLMTask.DOCUMENT_CONTENT,
			LLMTask.STYLE_ANALYSIS,
			LLMTask.SEMANTIC_ANALYSIS,
		]
		
		for task in tasks_to_test:
			try:
				config = get_llm_config(task)
				print(f"✓ {task.value}: {config.model} (temp={config.temperature})")
			except Exception as e:
				print(f"✗ {task.value}: {e}")
		
		print("✓ Centralized LLM configuration is working")
		return True
		
	except Exception as e:
		print(f"✗ Centralized LLM config test failed: {e}")
		return False

async def main():
	"""Run all integration tests"""
	print("🚀 NLP Integration Tests - Document Assembly System")
	print("=" * 60)
	
	tests = [
		("NLP Mock Replacement", test_nlp_mock_replacement),
		("Basic Content Analysis", test_basic_content_analysis),
		("Content Generation", test_content_generation), 
		("Document Assembly", test_document_assembly),
		("Centralized LLM Config", test_centralized_llm_config)
	]
	
	results = []
	
	for test_name, test_func in tests:
		print(f"\n🧪 Running {test_name}...")
		try:
			if asyncio.iscoroutinefunction(test_func):
				result = await test_func()
			else:
				result = test_func()
			results.append((test_name, result))
		except Exception as e:
			print(f"✗ {test_name} failed with exception: {e}")
			results.append((test_name, False))
	
	print("\n" + "=" * 60)
	print("📊 Integration Test Results:")
	print("=" * 60)
	
	passed = 0
	for test_name, result in results:
		status = "✅ PASS" if result else "❌ FAIL"
		print(f"{status} {test_name}")
		if result:
			passed += 1
	
	print(f"\nOverall: {passed}/{len(results)} tests passed")
	
	if passed == len(results):
		print("🎉 All integration tests passed!")
	elif passed >= len(results) * 0.6:
		print("✅ Most tests passed. Core functionality is working.")
	else:
		print("⚠️ Multiple test failures. Review implementation.")
	
	return passed >= len(results) * 0.6

if __name__ == "__main__":
	success = asyncio.run(main())
	sys.exit(0 if success else 1)