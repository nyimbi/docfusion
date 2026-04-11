"""
Voice DNA Engine

Comprehensive organizational voice analysis and consistency system providing
advanced writing pattern recognition, style analysis, voice validation,
authenticity scoring, and profile management capabilities.

The Voice DNA Engine enables organizations to:
- Analyze and fingerprint unique writing patterns
- Validate content against established voice profiles  
- Score authenticity and brand alignment
- Track voice evolution over time
- Ensure consistent organizational communication

Components:
- VoicePatternAnalyzer: Writing style fingerprinting and analysis
- StylePatternExtractor: Multi-dimensional style pattern analysis
- VoiceValidator: Real-time voice consistency validation
- AuthenticityScorer: Organizational voice compliance scoring
- VoiceProfiler: Voice profile creation and management
- ProfileManager: Profile versioning and lifecycle management
- VoiceIntegrator: Unified analysis integration system
- WritingEnhancer: Natural writing pattern improvement
- ContentQualityAnalyzer: Readability and engagement analysis  
- StyleGuideCompliance: Organizational style guide validation
- NaturalWritingAssistant: Sentence structure and voice development

Usage:
    from docfusion.voice_dna import VoiceIntegrator, AnalysisRequest, AnalysisType
    
    # Initialize voice analysis system
    integrator = VoiceIntegrator()
    
    # Create analysis request
    request = AnalysisRequest(
        analysis_type=AnalysisType.FULL_ANALYSIS,
        text_content="Your document content...",
        organization_name="Your Organization"
    )
    
    # Perform comprehensive voice analysis
    result = await integrator.analyze(request)
    
    # Access results
    logger.info(f"Voice Score: {result.overall_voice_score}")
    logger.info(f"Recommendations: {result.key_recommendations}")
"""

# Core analyzer components
from .analyzer import (
import logging
logger = logging.getLogger(__name__)
	VoicePatternAnalyzer,
	VoiceFingerprint,
	WritingPattern,
	VoiceComponent,
	StylePatternExtractor,
	StyleProfile,
	StylePattern,
	StyleDimension
)

# Validation components  
from .validator import (
	VoiceValidator,
	ValidationResult,
	VoiceDeviation,
	DeviationType,
	ValidationSeverity,
	AuthenticityScorer,
	AuthenticityReport,
	AuthenticityDimension,
	AuthenticityFactor
)

# Profiling components
from .profiler import (
	VoiceProfiler,
	VoiceProfile,
	ProfileType,
	DocumentMetadata,
	ProfileManager,
	ProfileVersion,
	ProfileComparison,
	ProfileStatus,
	ComparisonType
)

# Integration system
from .integration import (
	VoiceIntegrator,
	IntegrationConfig,
	AnalysisRequest,
	AnalysisResult,
	AnalysisType,
	IntegrationMode,
	DocumentAnalysisEngine,
	NLPAnalysisEngine
)

# Enhancement system
from .enhancement import (
	WritingEnhancer,
	EnhancementRequest,
	EnhancementResult,
	EnhancementType,
	ContentQualityAnalyzer,
	QualityAnalysisResult,
	ReadabilityMetrics,
	EngagementMetrics,
	HumanLikenessMetrics,
	StyleGuideCompliance,
	ComplianceRequest,
	ComplianceResult,
	StyleGuideRule,
	ComplianceViolation,
	NaturalWritingAssistant,
	WritingAssistanceRequest,
	WritingAssistanceResult,
	WritingSuggestion
)

# Version info
__version__ = "1.0.0"
__author__ = "Voice DNA Engine Development Team"

# Main exports
__all__ = [
	# Core Analysis
	"VoicePatternAnalyzer",
	"StylePatternExtractor", 
	"VoiceValidator",
	"AuthenticityScorer",
	"VoiceProfiler",
	"ProfileManager",
	
	# Integration System
	"VoiceIntegrator",
	"IntegrationConfig",
	"AnalysisRequest",
	"AnalysisResult",
	"DocumentAnalysisEngine",
	"NLPAnalysisEngine",
	
	# Enhancement System
	"WritingEnhancer",
	"ContentQualityAnalyzer",
	"StyleGuideCompliance",
	"NaturalWritingAssistant",
	"EnhancementRequest",
	"EnhancementResult",
	"QualityAnalysisResult",
	"ComplianceRequest",
	"ComplianceResult",
	"WritingAssistanceRequest",
	"WritingAssistanceResult",
	
	# Data Models
	"VoiceFingerprint",
	"StyleProfile",
	"ValidationResult", 
	"AuthenticityReport",
	"VoiceProfile",
	"ProfileComparison",
	"WritingPattern",
	"StylePattern",
	"VoiceDeviation",
	"AuthenticityFactor",
	"ProfileVersion",
	"DocumentMetadata",
	"ReadabilityMetrics",
	"EngagementMetrics",
	"HumanLikenessMetrics",
	"StyleGuideRule",
	"ComplianceViolation",
	"WritingSuggestion",
	
	# Enums
	"VoiceComponent",
	"StyleDimension",
	"DeviationType",
	"ValidationSeverity",
	"AuthenticityDimension",
	"ProfileType",
	"ProfileStatus",
	"ComparisonType",
	"AnalysisType",
	"IntegrationMode",
	"EnhancementType",
	
	# Version
	"__version__"
]

# Convenience functions

def create_voice_analyzer(organization_name: str, config: dict = None) -> 'VoiceIntegrator':
	"""
	Create a configured voice analyzer for an organization
	
	Args:
		organization_name: Name of the organization
		config: Optional configuration dictionary
		
	Returns:
		Configured VoiceIntegrator instance
	"""
	if config:
		integration_config = IntegrationConfig(**config)
	else:
		integration_config = IntegrationConfig()
	
	return VoiceIntegrator(integration_config)

def quick_voice_analysis(text: str, organization: str) -> 'AnalysisRequest':
	"""
	Create a quick voice analysis request
	
	Args:
		text: Text content to analyze
		organization: Organization name
		
	Returns:
		Pre-configured AnalysisRequest
	"""
	return AnalysisRequest(
		analysis_type=AnalysisType.FULL_ANALYSIS,
		text_content=text,
		organization_name=organization,
		enable_nlp_enhancement=True,
		include_recommendations=True
	)

def voice_validation_only(text: str, organization: str) -> 'AnalysisRequest':
	"""
	Create a voice validation-only request
	
	Args:
		text: Text content to validate
		organization: Organization name
		
	Returns:
		Validation-focused AnalysisRequest
	"""
	return AnalysisRequest(
		analysis_type=AnalysisType.VALIDATION_ONLY,
		text_content=text,
		organization_name=organization,
		use_cached_profiles=True,
		include_recommendations=True
	)

def enhance_writing(text: str, organization: str, intensity: float = 0.7) -> 'AnalysisRequest':
	"""
	Create a writing enhancement request
	
	Args:
		text: Text content to enhance
		organization: Organization name
		intensity: Enhancement intensity (0.1-1.0)
		
	Returns:
		Enhancement-focused AnalysisRequest
	"""
	return AnalysisRequest(
		analysis_type=AnalysisType.COMPREHENSIVE_ENHANCEMENT,
		text_content=text,
		organization_name=organization,
		enhancement_intensity=intensity,
		preserve_voice=True,
		include_recommendations=True
	)

def analyze_content_quality(text: str, organization: str, audience: str = None) -> 'AnalysisRequest':
	"""
	Create a content quality analysis request
	
	Args:
		text: Text content to analyze
		organization: Organization name
		audience: Target audience
		
	Returns:
		Quality analysis AnalysisRequest
	"""
	return AnalysisRequest(
		analysis_type=AnalysisType.QUALITY_ANALYSIS,
		text_content=text,
		organization_name=organization,
		target_audience=audience,
		include_recommendations=True
	)

def check_style_compliance(text: str, organization: str, style_rules: dict = None) -> 'AnalysisRequest':
	"""
	Create a style guide compliance check request
	
	Args:
		text: Text content to check
		organization: Organization name
		style_rules: Custom style guide rules
		
	Returns:
		Compliance check AnalysisRequest
	"""
	return AnalysisRequest(
		analysis_type=AnalysisType.COMPLIANCE_CHECK,
		text_content=text,
		organization_name=organization,
		style_guide_rules=style_rules,
		include_recommendations=True
	)

# Module info
VOICE_DNA_INFO = {
	"name": "Voice DNA Engine",
	"version": __version__,
	"description": "Comprehensive organizational voice analysis and consistency system",
	"components": [
		"Voice Pattern Analysis",
		"Style Pattern Extraction", 
		"Voice Validation",
		"Authenticity Scoring",
		"Voice Profiling",
		"Profile Management",
		"Integration System"
	],
	"capabilities": [
		"Writing style fingerprinting",
		"Multi-dimensional style analysis",
		"Real-time voice validation",
		"Brand alignment scoring",
		"Voice evolution tracking",
		"Profile comparison",
		"Improvement recommendations",
		"Natural writing enhancement",
		"Content quality analysis",
		"Style guide compliance checking",
		"Writing assistance and suggestions"
	]
}

def get_voice_dna_info() -> dict:
	"""Get Voice DNA Engine information"""
	return VOICE_DNA_INFO.copy()