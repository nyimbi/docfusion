#!/usr/bin/env python3
"""
Test Causal Analysis Module

Demonstrates causal inference using established statistical libraries
(scipy, statsmodels, pandas) for proposal performance analysis.
"""

import asyncio
import sys
import os
import numpy as np
import pandas as pd

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from docfusion.nlp.analyzers.causal_analyzer import (
	CausalAnalyzer, 
	create_causal_analyzer,
	CausalityType,
	ConfidenceLevel
)

async def test_causal_analysis():
	"""Test causal analysis with simulated proposal data"""
	print("🔬 Testing Causal Analysis with Established Statistical Libraries")
	print("=" * 70)
	
	# Create causal analyzer using established libraries
	analyzer = create_causal_analyzer(
		confidence_level=ConfidenceLevel.MEDIUM,
		min_sample_size=30,
		effect_size_threshold=0.1,
		enable_robustness_checks=True
	)
	
	# Generate simulated proposal performance data
	np.random.seed(42)  # For reproducible results
	n_samples = 200
	
	print(f"📊 Generating {n_samples} simulated proposal records...")
	
	# Create realistic proposal metrics
	data = {
		'proposal_length': np.random.normal(50, 15, n_samples),  # Pages
		'technical_score': np.random.uniform(1, 10, n_samples),  # Expert rating
		'budget_amount': np.random.lognormal(12, 1.5, n_samples),  # Dollar amount
		'team_size': np.random.poisson(8, n_samples),  # Number of people
		'client_relationship': np.random.uniform(1, 5, n_samples),  # Relationship strength
		'industry_experience': np.random.uniform(0, 20, n_samples),  # Years
	}
	
	# Create win_probability with realistic causal relationships
	win_probability = (
		0.3 +  # Base rate
		0.15 * (data['technical_score'] / 10) +  # Technical quality matters
		0.1 * (data['client_relationship'] / 5) +  # Relationships matter
		0.05 * np.tanh(data['industry_experience'] / 10) +  # Experience (diminishing returns)
		-0.05 * np.tanh(data['proposal_length'] / 50) +  # Shorter proposals better (diminishing)
		0.02 * np.log(data['budget_amount'] / np.mean(data['budget_amount'])) +  # Budget effect
		np.random.normal(0, 0.15, n_samples)  # Random noise
	)
	
	# Ensure win_probability is bounded [0,1]
	win_probability = np.clip(win_probability, 0, 1)
	data['win_probability'] = win_probability
	
	# Create binary win outcome
	data['won_contract'] = (win_probability > np.random.uniform(0, 1, n_samples)).astype(int)
	
	# Create proposal_score as another outcome variable
	proposal_score = (
		60 +  # Base score
		25 * (data['technical_score'] / 10) +
		10 * (data['client_relationship'] / 5) +
		5 * np.random.normal(0, 1, n_samples)
	)
	data['proposal_score'] = np.clip(proposal_score, 0, 100)
	
	df = pd.DataFrame(data)
	
	print(f"✅ Generated data with {len(df)} records and {len(df.columns)} variables")
	print(f"   Variables: {list(df.columns)}")
	print(f"   Win rate: {df['won_contract'].mean():.1%}")
	print()
	
	# Define treatment and outcome variables for causal analysis
	treatment_variables = [
		'proposal_length',
		'technical_score', 
		'budget_amount',
		'team_size'
	]
	
	outcome_variables = [
		'win_probability',
		'won_contract',
		'proposal_score'
	]
	
	control_variables = [
		'client_relationship',
		'industry_experience'
	]
	
	print("🎯 Analyzing Causal Relationships...")
	print(f"   Treatment variables: {treatment_variables}")
	print(f"   Outcome variables: {outcome_variables}")
	print(f"   Control variables: {control_variables}")
	print()
	
	try:
		# Perform comprehensive causal analysis
		result = await analyzer.analyze_causality(
			data=df,
			treatment_variables=treatment_variables,
			outcome_variables=outcome_variables,
			control_variables=control_variables,
			methods=[
				CausalityType.CORRELATION,
				CausalityType.GRANGER_CAUSALITY,
				CausalityType.INSTRUMENTAL_VARIABLE
			]
		)
		
		print("📊 CAUSAL ANALYSIS RESULTS")
		print("=" * 50)
		print(f"✅ Analysis successful: {result.success}")
		print(f"📈 Sample size: {result.sample_size}")
		print(f"⏱️  Processing time: {result.processing_time:.2f}s")
		print(f"🎯 Data quality score: {result.data_quality_score:.3f}")
		print()
		
		print(f"🔗 RELATIONSHIPS DISCOVERED")
		print(f"   Total relationships analyzed: {result.total_relationships}")
		print(f"   Statistically significant (p<0.05): {result.significant_relationships}")
		print()
		
		if result.causal_relationships:
			print("🏆 TOP CAUSAL RELATIONSHIPS:")
			# Sort by statistical significance
			sorted_relationships = sorted(result.causal_relationships, key=lambda x: x.p_value)
			
			for i, rel in enumerate(sorted_relationships[:5]):  # Show top 5
				significance = "***" if rel.p_value < 0.001 else "**" if rel.p_value < 0.01 else "*" if rel.p_value < 0.05 else ""
				print(f"   {i+1}. {rel.cause_variable} → {rel.effect_variable}")
				print(f"      Method: {rel.causality_type.value}")
				print(f"      p-value: {rel.p_value:.4f} {significance}")
				print(f"      Effect size: {rel.effect_size:.3f}")
				print(f"      Strength: {rel.causal_strength.value}")
				print(f"      Direction: {rel.direction}")
				if rel.interpretation:
					print(f"      Note: {rel.interpretation}")
				print()
		
		if result.strongest_relationship:
			strongest = result.strongest_relationship
			print("🎯 STRONGEST CAUSAL RELATIONSHIP:")
			print(f"   {strongest.cause_variable} → {strongest.effect_variable}")
			print(f"   p-value: {strongest.p_value:.6f}")
			print(f"   Effect size: {strongest.effect_size:.3f}")
			print(f"   Method: {strongest.causality_type.value}")
			print()
		
		if result.causal_models:
			print(f"📈 CAUSAL MODELS BUILT: {len(result.causal_models)}")
			for i, model in enumerate(result.causal_models):
				print(f"   Model {i+1}: {model.outcome_variable}")
				print(f"     R²: {model.model_fit.get('r_squared', 0):.3f}")
				print(f"     AIC: {model.model_fit.get('aic', 0):.1f}")
				print(f"     Significant predictors: {len([r for r in model.relationships if r.p_value < 0.05])}")
				
				# Show diagnostic tests
				if model.heteroscedasticity_test:
					het_test = model.heteroscedasticity_test
					if 'assumption_met' in het_test:
						status = "✅ PASS" if het_test['assumption_met'] else "⚠️  FAIL"
						print(f"     Heteroscedasticity test: {status}")
				
				if model.multicollinearity_test:
					mc_test = model.multicollinearity_test
					if 'assumption_met' in mc_test:
						status = "✅ PASS" if mc_test['assumption_met'] else "⚠️  FAIL"
						print(f"     Multicollinearity test: {status}")
			print()
		
		if result.causal_insights:
			print("💡 CAUSAL INSIGHTS:")
			for insight in result.causal_insights:
				print(f"   • {insight}")
			print()
		
		if result.recommendations:
			print("📋 RECOMMENDATIONS:")
			for rec in result.recommendations:
				print(f"   • {rec}")
			print()
		
		if result.warnings:
			print("⚠️  WARNINGS:")
			for warning in result.warnings:
				print(f"   • {warning}")
			print()
		
		print("🧬 STATISTICAL METHODS USED:")
		print("   • Scipy: Pearson/Spearman correlation, statistical tests")
		print("   • Statsmodels: Granger causality, regression models, diagnostic tests")
		print("   • Pandas: Data manipulation and analysis")
		print("   • Numpy: Numerical computations")
		print()
		
		await analyzer.close()
		return True
		
	except Exception as e:
		print(f"❌ Error during causal analysis: {e}")
		import traceback
		traceback.print_exc()
		await analyzer.close()
		return False

async def test_simple_correlation():
	"""Test simple correlation analysis"""
	print("\n" + "="*70)
	print("🔍 Testing Simple Correlation Analysis")
	print("="*70)
	
	# Create simple test data
	n = 100
	x = np.random.normal(0, 1, n)
	y = 2 * x + np.random.normal(0, 0.5, n)  # Strong positive relationship
	z = -0.5 * x + np.random.normal(0, 1, n)  # Moderate negative relationship
	
	data = pd.DataFrame({
		'predictor': x,
		'strong_positive_outcome': y,
		'moderate_negative_outcome': z,
		'random_noise': np.random.normal(0, 1, n)
	})
	
	analyzer = create_causal_analyzer()
	
	result = await analyzer.analyze_causality(
		data=data,
		treatment_variables=['predictor'],
		outcome_variables=['strong_positive_outcome', 'moderate_negative_outcome', 'random_noise'],
		methods=[CausalityType.CORRELATION]
	)
	
	print(f"📊 Found {result.significant_relationships} significant relationships")
	
	for rel in sorted(result.causal_relationships, key=lambda x: x.p_value):
		print(f"   {rel.cause_variable} → {rel.effect_variable}: r={rel.test_statistic:.3f}, p={rel.p_value:.4f}")
	
	await analyzer.close()

if __name__ == "__main__":
	print("🚀 Starting Causal Analysis Tests using Established Libraries")
	print("   Libraries: scipy, statsmodels, pandas, numpy")
	print()
	
	success1 = asyncio.run(test_causal_analysis())
	success2 = asyncio.run(test_simple_correlation())
	
	if success1 and success2:
		print("\n" + "="*70)
		print("✅ ALL CAUSAL ANALYSIS TESTS PASSED")
		print("✅ Successfully using established statistical libraries:")
		print("   • scipy.stats for correlation and statistical tests")
		print("   • statsmodels for Granger causality and regression models")
		print("   • pandas for data manipulation")
		print("   • numpy for numerical computations")
		print("\n🎉 No wheel reinvention - leveraging proven statistical methods!")
	else:
		print("\n❌ Some tests failed")