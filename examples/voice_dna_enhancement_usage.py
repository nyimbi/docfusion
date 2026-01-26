#!/usr/bin/env python3
"""
Voice DNA Engine Enhancement Usage Examples

Demonstrates how to use the Voice DNA Engine's new enhancement capabilities
for natural writing improvement, content quality analysis, style guide
compliance checking, and writing assistance.
"""

import asyncio
from docfusion.voice_dna import (
    VoiceIntegrator,
    AnalysisRequest,
    AnalysisType,
    enhance_writing,
    analyze_content_quality,
    check_style_compliance,
    WritingEnhancer,
    ContentQualityAnalyzer,
    StyleGuideCompliance,
    NaturalWritingAssistant,
    EnhancementRequest,
    WritingAssistanceRequest,
    ComplianceRequest
)


async def demo_comprehensive_enhancement():
    """Demonstrate comprehensive writing enhancement"""
    print("🔧 Voice DNA Engine - Comprehensive Enhancement Demo")
    print("=" * 60)
    
    # Sample AI-generated text that needs humanization
    sample_text = """
    The implementation of this solution will result in significant improvements.
    The system will process data more efficiently. The users will experience
    better performance. The implementation will be completed in the next quarter.
    It is important to note that the solution addresses all requirements.
    """
    
    # Initialize the voice integrator
    integrator = VoiceIntegrator()
    
    # Create comprehensive enhancement request
    request = enhance_writing(
        text=sample_text,
        organization="TechCorp",
        intensity=0.8
    )
    
    print(f"📝 Original Text:")
    print(sample_text)
    print("\n🔍 Running comprehensive enhancement analysis...")
    
    # Perform comprehensive enhancement
    result = await integrator.analyze(request)
    
    print(f"\n📊 Enhancement Results:")
    print(f"Overall Voice Score: {result.overall_voice_score:.2f}")
    print(f"Components Analyzed: {', '.join(result.components_analyzed)}")
    
    # Display enhancement results
    if result.enhancement_result:
        print(f"\n✨ Enhanced Versions:")
        for version_type, enhanced_text in result.enhancement_result.enhanced_versions.items():
            print(f"\n{version_type.upper()} Enhancement:")
            print(enhanced_text)
    
    # Display quality analysis
    if result.quality_analysis:
        print(f"\n📈 Quality Metrics:")
        quality = result.quality_analysis
        if quality.readability_metrics:
            print(f"Readability Score: {quality.readability_metrics.overall_readability:.2f}")
        if quality.engagement_metrics:
            print(f"Engagement Score: {quality.engagement_metrics.overall_engagement:.2f}")
        if quality.human_likeness_metrics:
            print(f"Human-likeness Score: {quality.human_likeness_metrics.overall_human_likeness:.2f}")
    
    # Display writing assistance
    if result.writing_assistance:
        print(f"\n📝 Writing Suggestions ({len(result.writing_assistance.suggestions)}):")
        for i, suggestion in enumerate(result.writing_assistance.suggestions[:3], 1):
            print(f"{i}. {suggestion.explanation}")
            print(f"   Impact: {suggestion.impact_description}")
            print(f"   Confidence: {suggestion.confidence_score:.2f}")
    
    print("\n" + "=" * 60)


async def demo_quality_analysis():
    """Demonstrate content quality analysis"""
    print("\n📊 Content Quality Analysis Demo")
    print("=" * 40)
    
    analyzer = ContentQualityAnalyzer()
    
    # Sample text with various quality issues
    sample_text = """
    This is a sentence. This is another sentence. This is yet another sentence.
    The text is very repetitive and monotonous. The sentences are all similar.
    There is no variety in the writing style or structure patterns.
    """
    
    print(f"📝 Analyzing Text:")
    print(sample_text)
    
    # Analyze content quality
    result = await analyzer.analyze_content_quality(
        text=sample_text,
        target_audience="general",
        content_type="document"
    )
    
    print(f"\n📈 Quality Scores:")
    if result.readability_metrics:
        print(f"Readability: {result.readability_metrics.overall_readability:.2f}")
        print(f"Flesch Reading Ease: {result.readability_metrics.flesch_reading_ease:.1f}")
        print(f"Grade Level: {result.readability_metrics.flesch_kincaid_grade:.1f}")
    
    if result.engagement_metrics:
        print(f"Engagement: {result.engagement_metrics.overall_engagement:.2f}")
        print(f"Hook Strength: {result.engagement_metrics.hook_strength:.2f}")
        print(f"Emotional Language: {result.engagement_metrics.emotional_language:.2f}")
    
    if result.human_likeness_metrics:
        print(f"Human-likeness: {result.human_likeness_metrics.overall_human_likeness:.2f}")
        print(f"Natural Flow: {result.human_likeness_metrics.natural_flow:.2f}")
        print(f"Conversational Tone: {result.human_likeness_metrics.conversational_tone:.2f}")
    
    print(f"\n💡 Key Recommendations:")
    for rec in result.improvement_recommendations[:3]:
        print(f"• {rec}")


async def demo_style_compliance():
    """Demonstrate style guide compliance checking"""
    print("\n📋 Style Guide Compliance Demo")
    print("=" * 40)
    
    compliance_checker = StyleGuideCompliance()
    
    # Sample text with style issues
    sample_text = """
    Hey there! This document is totally awesome and contains some really 
    cool stuff. We should definitely use this approach because it's super
    effective. Don't you think this is the best solution ever?
    """
    
    print(f"📝 Checking Text:")
    print(sample_text)
    
    # Check compliance with corporate style guide
    request = ComplianceRequest(
        text=sample_text,
        organization_name="Professional Corp",
        style_guide_name="corporate",
        target_audience="executives"
    )
    
    result = await compliance_checker.check_compliance(request)
    
    print(f"\n📊 Compliance Results:")
    print(f"Overall Compliance: {result.overall_compliance_score:.2f}")
    print(f"Voice Alignment: {result.voice_alignment_score:.2f}")
    print(f"Style Consistency: {result.style_consistency_score:.2f}")
    
    if result.violations:
        print(f"\n⚠️  Style Violations ({len(result.violations)}):")
        for violation in result.violations[:3]:
            print(f"• {violation.rule_name}: {violation.description}")
            print(f"  Severity: {violation.severity.value}")
            if violation.suggested_fix:
                print(f"  Suggested Fix: {violation.suggested_fix}")
    
    print(f"\n💡 Improvement Suggestions:")
    for suggestion in result.improvement_suggestions[:3]:
        print(f"• {suggestion}")


async def demo_writing_assistance():
    """Demonstrate natural writing assistance"""
    print("\n✍️  Natural Writing Assistant Demo")
    print("=" * 40)
    
    assistant = NaturalWritingAssistant()
    
    # Sample text with structural issues
    sample_text = """
    The meeting was productive. The team discussed the project. The timeline 
    was reviewed. The budget was approved. The next steps were outlined.
    The meeting ended successfully.
    """
    
    print(f"📝 Analyzing Writing Structure:")
    print(sample_text)
    
    # Get writing assistance
    request = WritingAssistanceRequest(
        text=sample_text,
        enhancement_intensity=0.7,
        target_audience="business professionals"
    )
    
    result = await assistant.provide_assistance(request)
    
    print(f"\n📊 Writing Analysis:")
    if result.sentence_variation:
        print(f"Sentence Variety Score: {result.sentence_variation.start_word_diversity:.2f}")
        print(f"Average Sentence Length: {result.sentence_variation.avg_sentence_length:.1f} words")
        print(f"Structure Repetition: {result.sentence_variation.structure_repetition_score:.2f}")
    
    if result.voice_authenticity:
        print(f"Voice Authenticity: {result.voice_authenticity.overall_score:.2f}")
        print(f"Human-likeness: {result.voice_authenticity.human_likeness:.2f}")
        print(f"Conversational Flow: {result.voice_authenticity.conversational_flow:.2f}")
    
    if result.flow_analysis:
        print(f"Text Flow Score: {result.flow_analysis.overall_flow_score:.2f}")
        print(f"Transition Quality: {result.flow_analysis.transition_quality:.2f}")
    
    print(f"\n✨ Writing Suggestions ({len(result.suggestions)}):")
    for i, suggestion in enumerate(result.suggestions[:5], 1):
        print(f"{i}. {suggestion.explanation}")
        print(f"   Priority: {suggestion.priority} | Confidence: {suggestion.confidence_score:.2f}")
    
    if result.enhanced_versions:
        print(f"\n🔧 Enhanced Version (Conservative):")
        print(result.enhanced_versions.get('conservative', 'Not available'))


async def demo_individual_components():
    """Demonstrate using individual enhancement components"""
    print("\n🧩 Individual Components Demo")
    print("=" * 40)
    
    # Writing Enhancer
    print("\n📝 Writing Enhancer:")
    enhancer = WritingEnhancer()
    enhancement_request = EnhancementRequest(
        text="The system will process the data. The results will be generated.",
        enhancement_intensity=0.6
    )
    enhancement_result = await enhancer.enhance_writing(enhancement_request)
    print(f"Vocabulary Diversity: {enhancement_result.vocabulary_analysis.diversity_score:.2f}")
    print(f"Enhancement Applied: {enhancement_result.enhancement_type.value}")
    
    # Individual quality analyzer check
    print("\n📊 Quality Analyzer:")
    quality_analyzer = ContentQualityAnalyzer()
    quality_result = await quality_analyzer.analyze_content_quality(
        "This is a simple test sentence for quality analysis."
    )
    if quality_result.readability_metrics:
        print(f"Reading Difficulty: {quality_result.readability_metrics.reading_difficulty}")
    
    print(f"\nAnalysis Duration: {quality_result.analysis_duration_seconds:.2f}s")
    print(f"Confidence Level: {quality_result.confidence_level:.2f}")


async def main():
    """Run all enhancement demos"""
    print("🎯 Voice DNA Engine - Enhancement System Demonstration")
    print("=" * 70)
    
    try:
        await demo_comprehensive_enhancement()
        await demo_quality_analysis()
        await demo_style_compliance()
        await demo_writing_assistance()
        await demo_individual_components()
        
        print("\n🎉 All enhancement demos completed successfully!")
        print("\nThe Voice DNA Engine now provides comprehensive writing enhancement")
        print("capabilities alongside its voice analysis and validation features.")
        
    except Exception as e:
        print(f"\n❌ Demo failed: {e}")
        print("Note: Some features may require optional NLP libraries (spaCy, NLTK, textstat)")


if __name__ == "__main__":
    asyncio.run(main())