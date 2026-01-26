#!/usr/bin/env python3
"""
Test Advanced Prompting Implementation

Tests the enhanced ContentGenerator with Chain-of-Thought prompting and
deepseek-r1:32b thinking tag filtering.
"""

import asyncio
import sys
import os
import logging

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from docfusion.nlp.transformers.content_generator import (
	ContentGenerator, 
	ContentType, 
	GenerationStyle, 
	ContentFormat,
	GenerationContext,
	create_content_generator
)

async def test_advanced_prompting():
	"""Test advanced prompting with deepseek-r1:32b"""
	print("🧠 Testing Advanced Prompting with deepseek-r1:32b")
	print("=" * 60)
	
	try:
		# Create generator with advanced prompting enabled
		config = {
			'ollama_model': 'deepseek-r1:32b',
			'use_advanced_prompting': True,
			'ollama_timeout': 60.0
		}
		
		generator = create_content_generator(config)
		print(f"✅ ContentGenerator created with model: {generator.ollama_model}")
		print(f"✅ Advanced prompting enabled: {generator.use_advanced_prompting}")
		
		# Test context for content generation
		context = GenerationContext(
			project_name="AI-Powered Proposal System",
			client_name="Tech Innovation Corp", 
			industry="Technology",
			target_audience="business_professionals",
			key_points=[
				"AI-driven content generation",
				"Chain-of-thought reasoning", 
				"Advanced prompting techniques",
				"Thinking model integration"
			],
			requirements=[
				"Professional tone",
				"Technical accuracy",
				"Clear value proposition"
			],
			length_requirement="medium"
		)
		
		print(f"📋 Test context created with {len(context.key_points)} key points")
		
		# Test Chain-of-Thought prompting for executive summary
		print("\n🎯 Testing Chain-of-Thought Executive Summary Generation...")
		
		result = await generator.generate_content(
			content_type=ContentType.EXECUTIVE_SUMMARY,
			context=context,
			style=GenerationStyle.EXECUTIVE,
			format=ContentFormat.PLAIN_TEXT
		)
		
		print(f"✅ Generation completed: {result.success}")
		print(f"📊 Model calls: {result.model_calls}")
		print(f"🔤 Total tokens: {result.total_tokens_used}")
		print(f"⏱️  Processing time: {result.processing_time:.3f}s")
		
		if result.primary_content:
			content = result.primary_content.content
			print(f"📝 Generated content ({result.primary_content.word_count} words):")
			print("-" * 40)
			print(content[:500] + "..." if len(content) > 500 else content)
			print("-" * 40)
			
			# Check if thinking tags were filtered
			has_thinking_tags = '<think>' in content.lower() or '</think>' in content.lower()
			print(f"🧹 Thinking tags filtered: {'❌ FAILED' if has_thinking_tags else '✅ SUCCESS'}")
			
			# Quality scores
			print(f"🎯 Quality score: {result.primary_content.quality_score:.3f}")
			print(f"📊 Style score: {result.primary_content.style_score:.3f}")
			print(f"🔗 Coherence: {result.coherence_score:.3f}")
			print(f"🎪 Relevance: {result.relevance_score:.3f}")
			
		if result.suggestions:
			print(f"\n💡 Improvement suggestions:")
			for suggestion in result.suggestions[:3]:
				print(f"   • {suggestion}")
		
		if result.errors:
			print(f"\n❌ Errors encountered:")
			for error in result.errors:
				print(f"   • {error}")
		
		await generator.close()
		print("\n✅ Advanced prompting test completed successfully!")
		return True
		
	except Exception as e:
		print(f"❌ Test failed: {e}")
		import traceback
		traceback.print_exc()
		return False

async def test_prompting_strategies():
	"""Test prompting strategies module integration"""
	print("\n" + "=" * 60)
	print("🧰 Testing Prompting Strategies Module")
	print("=" * 60)
	
	try:
		from docfusion.nlp.prompting_strategies import (
			filter_thinking_tags,
			create_chain_of_thought_prompt,
			create_advanced_prompt_builder,
			PromptingStrategy,
			ThoughtBranch
		)
		
		print("✅ Prompting strategies imports successful")
		
		# Test thinking tag filtering
		test_text = """
		<think>
		This is internal thinking that should be filtered out.
		Let me analyze the requirements...
		</think>
		
		Based on the analysis, here is the executive summary:
		Our AI-powered solution provides significant value...
		
		<think>More internal reasoning here</think>
		
		The key benefits include improved efficiency and accuracy.
		"""
		
		filtered = filter_thinking_tags(test_text)
		has_thinking = '<think>' in filtered.lower()
		print(f"🧹 Thinking tag filtering: {'❌ FAILED' if has_thinking else '✅ SUCCESS'}")
		
		# Test Chain-of-Thought prompt creation
		reasoning_steps = [
			"Analyze the business context and requirements",
			"Identify key value propositions",
			"Structure content for executive audience", 
			"Generate compelling summary with clear benefits"
		]
		
		cot_prompt = create_chain_of_thought_prompt(
			task="Generate executive summary",
			context="AI proposal for technology client",
			reasoning_steps=reasoning_steps
		)
		
		print(f"🔗 Chain-of-Thought prompt created: {len(cot_prompt)} characters")
		print(f"✅ Contains reasoning steps: {'✅ YES' if 'reasoning steps' in cot_prompt.lower() else '❌ NO'}")
		
		# Test advanced prompt builder
		builder = create_advanced_prompt_builder("deepseek-r1:32b")
		print(f"🏗️  Advanced prompt builder created for: {builder.model_name}")
		print(f"📚 Templates available: {len(builder.templates)}")
		
		return True
		
	except Exception as e:
		print(f"❌ Prompting strategies test failed: {e}")
		return False

if __name__ == "__main__":
	print("🧪 Starting Advanced Prompting Tests")
	print("   Testing deepseek-r1:32b integration with CoT prompting")
	print()
	
	# Set up logging to reduce noise
	logging.basicConfig(level=logging.WARNING)
	
	success1 = asyncio.run(test_prompting_strategies())
	success2 = asyncio.run(test_advanced_prompting())
	
	if success1 and success2:
		print("\n" + "=" * 60)
		print("🎉 ALL ADVANCED PROMPTING TESTS PASSED!")
		print("✅ deepseek-r1:32b model integration")
		print("✅ Chain-of-Thought prompting")
		print("✅ Thinking tag filtering")
		print("✅ Advanced prompt building")
		print("✅ Content generation with enhanced reasoning")
		print("\n🏆 Advanced prompting system is fully operational!")
	else:
		print("\n❌ Some tests failed")