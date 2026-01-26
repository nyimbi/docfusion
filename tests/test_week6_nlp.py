#!/usr/bin/env python3
"""
Quick test for Week 6 NLP components
"""
import asyncio
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

async def test_week6_nlp():
	"""Test Week 6 NLP enhanced service"""
	print("Testing Week 6 Enhanced NLP Service...")
	
	try:
		# Test direct component imports
		from docfusion.nlp.analyzers.style_analyzer import create_style_analyzer
		from docfusion.nlp.transformers.content_generator import create_content_generator, ContentType, GenerationStyle
		
		print("✅ Successfully imported Week 6 NLP components")
		
		# Test content generator
		print("Testing ContentGenerator...")
		generator = create_content_generator()
		
		# Test content generation with comprehensive content types
		from docfusion.nlp.transformers.content_generator import GenerationContext
		
		# Create proper context object
		context = GenerationContext(
			project_name="software development project", 
			target_audience="technical stakeholders",
			industry="software"
		)
		
		gen_result = await generator.generate_content(
			ContentType.EXECUTIVE_SUMMARY,
			context=context,
			style=GenerationStyle.PROFESSIONAL
		)
		
		print(f"Content generation success: {gen_result.success}")
		if gen_result.success:
			content_length = len(gen_result.generated_content.content) if gen_result.generated_content else 0
			print(f"Generated content length: {content_length} characters")
			quality = gen_result.generated_content.quality_score if gen_result.generated_content else 0
			print(f"Content quality score: {quality:.3f}")
		
		# Test that we have extensive content types and styles
		print(f"Available content types: {len(list(ContentType))}")
		print(f"Available generation styles: {len(list(GenerationStyle))}")
		
		# Show some examples of the expanded content types
		example_types = [
			ContentType.EXECUTIVE_SUMMARY,
			ContentType.TECHNICAL_SOLUTION, 
			ContentType.RISK_ASSESSMENT,
			ContentType.COST_BENEFIT_ANALYSIS,
			ContentType.IMPLEMENTATION_PLAN
		]
		print("Example content types:", [t.value for t in example_types])
		
		await generator.close()
		return True
		
	except Exception as e:
		print(f"Error during testing: {e}")
		import traceback
		traceback.print_exc()
		return False

if __name__ == "__main__":
	success = asyncio.run(test_week6_nlp())
	if success:
		print("✅ Week 6 NLP components are working correctly")
	else:
		print("❌ Week 6 NLP test failed")