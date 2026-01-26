"""
NLP Package

Advanced natural language processing with Ollama-based AI enhancement
for comprehensive document understanding, analysis, and extraction.
"""

__version__ = "1.0.0"
__author__ = "Proposal Writer Team"

# Main NLP service
from .nlp_service import NLPService, NLPServiceConfiguration, NLPAnalysisResult, create_nlp_service

# Enhanced NLP service (comprehensive integration layer)
from .enhanced_nlp_service import EnhancedNLPService, EnhancedNLPServiceConfiguration, EnhancedAnalysisResult, create_enhanced_nlp_service

# Processors
from .processors.document_processor import DocumentProcessor, create_document_processor
from .processors.text_cleaner import OllamaTextCleaner, create_text_cleaner
from .processors.document_tokenizer import DocumentTokenizer, create_document_tokenizer
from .processors.structure_recognizer import StructureRecognizer, create_structure_recognizer

# Extractors
from .extractors.requirement_extractor import RequirementExtractor, create_requirement_extractor
from .extractors.entity_extractor import EntityExtractor, create_entity_extractor
from .extractors.relationship_extractor import RelationshipExtractor, create_relationship_extractor
from .extractors.deadline_extractor import DeadlineExtractor, create_deadline_extractor

# Analyzers
from .analyzers.style_analyzer import StyleAnalyzer, create_style_analyzer
from .analyzers.semantic_analyzer import SemanticAnalyzer, create_semantic_analyzer
from .analyzers.coherence_analyzer import CoherenceAnalyzer, create_coherence_analyzer
from .analyzers.readability_analyzer import ReadabilityAnalyzer, create_readability_analyzer
from .analyzers.causal_analyzer import CausalAnalyzer, create_causal_analyzer

# Transformers
from .transformers.content_generator import ContentGenerator, create_content_generator
from .transformers.style_transformer import StyleTransformer, create_style_transformer
from .transformers.document_summarizer import DocumentSummarizer, create_document_summarizer
from .transformers.content_optimizer import ContentOptimizer, create_content_optimizer

__all__ = [
	# Main service
	"NLPService", "NLPServiceConfiguration", "NLPAnalysisResult", "create_nlp_service",
	
	# Enhanced service
	"EnhancedNLPService", "EnhancedNLPServiceConfiguration", "EnhancedAnalysisResult", "create_enhanced_nlp_service",
	
	# Processors
	"DocumentProcessor", "create_document_processor",
	"OllamaTextCleaner", "create_text_cleaner", 
	"DocumentTokenizer", "create_document_tokenizer",
	"StructureRecognizer", "create_structure_recognizer",
	
	# Extractors
	"RequirementExtractor", "create_requirement_extractor",
	"EntityExtractor", "create_entity_extractor", 
	"RelationshipExtractor", "create_relationship_extractor",
	"DeadlineExtractor", "create_deadline_extractor",
	
	# Analyzers
	"StyleAnalyzer", "create_style_analyzer",
	"SemanticAnalyzer", "create_semantic_analyzer",
	"CoherenceAnalyzer", "create_coherence_analyzer",
	"ReadabilityAnalyzer", "create_readability_analyzer",
	"CausalAnalyzer", "create_causal_analyzer",
	
	# Transformers
	"ContentGenerator", "create_content_generator",
	"StyleTransformer", "create_style_transformer",
	"DocumentSummarizer", "create_document_summarizer",
	"ContentOptimizer", "create_content_optimizer"
]