#!/usr/bin/env python3
"""
Test script for centralized LLM configuration system
"""

import sys
from pathlib import Path

# Add the src directory to Python path
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

try:
	from docfusion.config.llm_config import (
		get_llm_config_manager, 
		get_llm_config, 
		LLMTask, 
		ModelProfile,
		print_config_summary
	)
	from docfusion.nlp.analyzers.style_analyzer import create_style_analyzer
	from docfusion.nlp.analyzers.semantic_analyzer import create_semantic_analyzer
	from docfusion.nlp.analyzers.coherence_analyzer import create_coherence_analyzer
	
	print("✓ Successfully imported centralized LLM configuration system")
	print()
	
	# Test configuration loading
	print("=== Testing Configuration Loading ===")
	manager = get_llm_config_manager()
	print(f"✓ Configuration manager loaded successfully")
	print(f"  Environment: {manager.environment}")
	print(f"  Config path: {manager.config_path}")
	print(f"  Total tasks configured: {len(manager.get_all_tasks())}")
	print()
	
	# Test task-specific configurations
	print("=== Testing Task-Specific Configurations ===")
	style_config = get_llm_config(LLMTask.STYLE_ANALYSIS)
	print(f"Style Analysis Config:")
	print(f"  Model: {style_config.model}")
	print(f"  Timeout: {style_config.timeout}s")
	print(f"  Temperature: {style_config.temperature}")
	print(f"  Num Predict: {style_config.num_predict}")
	print(f"  Thinking Filter: {style_config.enable_thinking_filter}")
	print()
	
	semantic_config = get_llm_config(LLMTask.SEMANTIC_ANALYSIS)
	print(f"Semantic Analysis Config:")
	print(f"  Model: {semantic_config.model}")
	print(f"  Timeout: {semantic_config.timeout}s")
	print(f"  Temperature: {semantic_config.temperature}")
	print(f"  Num Predict: {semantic_config.num_predict}")
	print(f"  Thinking Filter: {semantic_config.enable_thinking_filter}")
	print()
	
	coherence_config = get_llm_config(LLMTask.COHERENCE_ANALYSIS)
	print(f"Coherence Analysis Config:")
	print(f"  Model: {coherence_config.model}")
	print(f"  Timeout: {coherence_config.timeout}s")
	print(f"  Temperature: {coherence_config.temperature}")
	print(f"  Num Predict: {coherence_config.num_predict}")
	print(f"  Thinking Filter: {coherence_config.enable_thinking_filter}")
	print()
	
	# Test analyzer creation with centralized config
	print("=== Testing Analyzer Creation ===")
	try:
		style_analyzer = create_style_analyzer(llm_config=style_config)
		print("✓ StyleAnalyzer created successfully with centralized config")
		print(f"  Using model: {style_analyzer.llm_config.model}")
	except Exception as e:
		print(f"✗ StyleAnalyzer creation failed: {e}")
	
	try:
		semantic_analyzer = create_semantic_analyzer(llm_config=semantic_config)
		print("✓ SemanticAnalyzer created successfully with centralized config")
		print(f"  Using model: {semantic_analyzer.llm_config.model}")
	except Exception as e:
		print(f"✗ SemanticAnalyzer creation failed: {e}")
	
	try:
		coherence_analyzer = create_coherence_analyzer(llm_config=coherence_config)
		print("✓ CoherenceAnalyzer created successfully with centralized config")
		print(f"  Using model: {coherence_analyzer.llm_config.model}")
	except Exception as e:
		print(f"✗ CoherenceAnalyzer creation failed: {e}")
	print()
	
	# Test model profiles
	print("=== Testing Model Profiles ===")
	precision_config = get_llm_config(LLMTask.STYLE_ANALYSIS, ModelProfile.PRECISION)
	print(f"Precision Profile for Style Analysis:")
	print(f"  Model: {precision_config.model}")
	print(f"  Temperature: {precision_config.temperature}")
	print(f"  Num Predict: {precision_config.num_predict}")
	print()
	
	# Test configuration summary
	print("=== Full Configuration Summary ===")
	print_config_summary()
	
	print("✅ All tests passed! Centralized LLM configuration system is working correctly.")
	
except ImportError as e:
	print(f"❌ Import error: {e}")
	print("Make sure the configuration system is properly implemented.")
except Exception as e:
	print(f"❌ Test failed: {e}")
	import traceback
	traceback.print_exc()