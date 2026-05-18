#!/usr/bin/env python3
"""
NLP Service Integration Layer

Unified service that orchestrates all NLP processors and extractors for comprehensive
document understanding and analysis with Ollama-based AI enhancement.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

# Import all NLP processors and extractors
from .analyzers.causal_analyzer import create_causal_analyzer
from .analyzers.coherence_analyzer import create_coherence_analyzer
from .analyzers.readability_analyzer import (
    create_readability_analyzer,
)
from .analyzers.semantic_analyzer import create_semantic_analyzer

# Import enhanced analyzers and transformers
from .analyzers.style_analyzer import create_style_analyzer
from .extractors.deadline_extractor import create_deadline_extractor
from .extractors.entity_extractor import create_entity_extractor
from .extractors.relationship_extractor import (
    create_relationship_extractor,
)
from .extractors.requirement_extractor import (
    create_requirement_extractor,
)
from .processors.document_processor import create_document_processor
from .processors.document_tokenizer import create_document_tokenizer
from .processors.structure_recognizer import (
    create_structure_recognizer,
)
from .processors.text_cleaner import create_text_cleaner
from .transformers.content_generator import create_content_generator
from .transformers.content_optimizer import create_content_optimizer
from .transformers.document_summarizer import (
    create_document_summarizer,
)
from .transformers.style_transformer import create_style_transformer
from ..core.utils import uuid7str
import time

@dataclass
class NLPAnalysisResult:
    """Comprehensive NLP analysis result"""

    success: bool = False
    document_id: str = ""

    # Raw processing results
    document_processing: Optional[Any] = None
    text_cleaning: Optional[Any] = None
    tokenization: Optional[Any] = None
    structure_recognition: Optional[Any] = None
    requirement_extraction: Optional[Any] = None
    entity_extraction: Optional[Any] = None
    relationship_extraction: Optional[Any] = None
    deadline_extraction: Optional[Any] = None

    # Enhanced analysis results
    style_analysis: Optional[Any] = None
    semantic_analysis: Optional[Any] = None
    coherence_analysis: Optional[Any] = None
    readability_analysis: Optional[Any] = None
    causal_analysis: Optional[Any] = None

    # Transformation results
    content_generation: Optional[Any] = None
    style_transformation: Optional[Any] = None
    document_summarization: Optional[Any] = None
    content_optimization: Optional[Any] = None

    # Processed content
    cleaned_text: str = ""
    structured_content: Dict[str, Any] = None

    # Extracted information
    requirements: List[Any] = None
    entities: List[Any] = None
    relationships: List[Any] = None
    deadlines: List[Any] = None
    timeline: List[Any] = None

    # Analysis metadata
    statistics: Dict[str, Any] = None
    processing_time: float = 0.0
    errors: List[str] = None
    warnings: List[str] = None

    def __post_init__(self):
        if self.structured_content is None:
            self.structured_content = {}
        if self.requirements is None:
            self.requirements = []
        if self.entities is None:
            self.entities = []
        if self.relationships is None:
            self.relationships = []
        if self.deadlines is None:
            self.deadlines = []
        if self.timeline is None:
            self.timeline = []
        if self.statistics is None:
            self.statistics = {}
        if self.errors is None:
            self.errors = []
        if self.warnings is None:
            self.warnings = []

class NLPServiceConfiguration:
    """Configuration for NLP service"""

    def __init__(
        self,
        # Ollama settings (shared across all components)
        ollama_base_url: str = "http://localhost:11434",
        ollama_model: str = "deepseek-r1:32b",
        ollama_timeout: float = 120.0,
        # Processing options
        enable_document_processing: bool = True,
        enable_text_cleaning: bool = True,
        enable_tokenization: bool = True,
        enable_structure_recognition: bool = True,
        enable_requirement_extraction: bool = True,
        enable_entity_extraction: bool = True,
        enable_relationship_extraction: bool = True,
        enable_deadline_extraction: bool = True,
        # Enhanced analysis options
        enable_style_analysis: bool = True,
        enable_semantic_analysis: bool = True,
        enable_coherence_analysis: bool = True,
        enable_readability_analysis: bool = True,
        enable_causal_analysis: bool = True,
        # Transformation options
        enable_content_generation: bool = False,  # On-demand only
        enable_style_transformation: bool = False,  # On-demand only
        enable_document_summarization: bool = True,
        enable_content_optimization: bool = False,  # On-demand only
        # AI enhancement settings
        use_ai_enhancement: bool = True,
        ai_chunk_size: int = 3000,
        parallel_processing: bool = True,
        # Quality settings
        min_confidence_threshold: float = 0.4,
        enable_cross_validation: bool = True,
        # Component configurations
        document_processor_config: Optional[Dict[str, Any]] = None,
        text_cleaner_config: Optional[Dict[str, Any]] = None,
        tokenizer_config: Optional[Dict[str, Any]] = None,
        structure_recognizer_config: Optional[Dict[str, Any]] = None,
        requirement_extractor_config: Optional[Dict[str, Any]] = None,
        entity_extractor_config: Optional[Dict[str, Any]] = None,
        relationship_extractor_config: Optional[Dict[str, Any]] = None,
        deadline_extractor_config: Optional[Dict[str, Any]] = None,
        # Enhanced analyzer configurations
        style_analyzer_config: Optional[Dict[str, Any]] = None,
        semantic_analyzer_config: Optional[Dict[str, Any]] = None,
        coherence_analyzer_config: Optional[Dict[str, Any]] = None,
        readability_analyzer_config: Optional[Dict[str, Any]] = None,
        causal_analyzer_config: Optional[Dict[str, Any]] = None,
        # Transformer configurations
        content_generator_config: Optional[Dict[str, Any]] = None,
        style_transformer_config: Optional[Dict[str, Any]] = None,
        document_summarizer_config: Optional[Dict[str, Any]] = None,
        content_optimizer_config: Optional[Dict[str, Any]] = None,
    ):
        self.ollama_base_url = ollama_base_url
        self.ollama_model = ollama_model
        self.ollama_timeout = ollama_timeout

        self.enable_document_processing = enable_document_processing
        self.enable_text_cleaning = enable_text_cleaning
        self.enable_tokenization = enable_tokenization
        self.enable_structure_recognition = enable_structure_recognition
        self.enable_requirement_extraction = enable_requirement_extraction
        self.enable_entity_extraction = enable_entity_extraction
        self.enable_relationship_extraction = enable_relationship_extraction
        self.enable_deadline_extraction = enable_deadline_extraction

        # Enhanced analyzer settings
        self.enable_style_analysis = enable_style_analysis
        self.enable_semantic_analysis = enable_semantic_analysis
        self.enable_coherence_analysis = enable_coherence_analysis
        self.enable_readability_analysis = enable_readability_analysis
        self.enable_causal_analysis = enable_causal_analysis

        # Transformation settings
        self.enable_content_generation = enable_content_generation
        self.enable_style_transformation = enable_style_transformation
        self.enable_document_summarization = enable_document_summarization
        self.enable_content_optimization = enable_content_optimization

        self.use_ai_enhancement = use_ai_enhancement
        self.ai_chunk_size = ai_chunk_size
        self.parallel_processing = parallel_processing
        self.min_confidence_threshold = min_confidence_threshold
        self.enable_cross_validation = enable_cross_validation

        # Component configurations with shared Ollama settings
        base_ollama_config = {
            "ollama_base_url": ollama_base_url,
            "ollama_model": ollama_model,
            "ollama_timeout": ollama_timeout,
            "use_ai_enhancement": use_ai_enhancement,
        }

        self.document_processor_config = {
            **base_ollama_config,
            **(document_processor_config or {}),
        }
        self.text_cleaner_config = {**base_ollama_config, **(text_cleaner_config or {})}
        self.tokenizer_config = {**base_ollama_config, **(tokenizer_config or {})}
        self.structure_recognizer_config = {
            **base_ollama_config,
            **(structure_recognizer_config or {}),
        }
        self.requirement_extractor_config = {
            **base_ollama_config,
            **(requirement_extractor_config or {}),
        }
        self.entity_extractor_config = {
            **base_ollama_config,
            **(entity_extractor_config or {}),
        }
        self.relationship_extractor_config = {
            **base_ollama_config,
            **(relationship_extractor_config or {}),
        }
        self.deadline_extractor_config = {
            **base_ollama_config,
            **(deadline_extractor_config or {}),
        }

        # Enhanced analyzer configurations
        self.style_analyzer_config = {
            **base_ollama_config,
            **(style_analyzer_config or {}),
        }
        self.semantic_analyzer_config = {
            **base_ollama_config,
            **(semantic_analyzer_config or {}),
        }
        self.coherence_analyzer_config = {
            **base_ollama_config,
            **(coherence_analyzer_config or {}),
        }
        self.readability_analyzer_config = {
            **base_ollama_config,
            **(readability_analyzer_config or {}),
        }
        self.causal_analyzer_config = {
            **base_ollama_config,
            **(causal_analyzer_config or {}),
        }

        # Transformer configurations
        self.content_generator_config = {
            **base_ollama_config,
            **(content_generator_config or {}),
        }
        self.style_transformer_config = {
            **base_ollama_config,
            **(style_transformer_config or {}),
        }
        self.document_summarizer_config = {
            **base_ollama_config,
            **(document_summarizer_config or {}),
        }
        self.content_optimizer_config = {
            **base_ollama_config,
            **(content_optimizer_config or {}),
        }

class NLPService:
    """Unified NLP service for comprehensive document analysis"""

    def __init__(self, config: Optional[NLPServiceConfiguration] = None):
        self.config = config or NLPServiceConfiguration()
        self.logger = logging.getLogger(__name__)

        # Initialize all NLP components
        self._initialize_components()

        self.logger.info(
            "NLP service initialized with comprehensive document understanding capabilities"
        )

    def _initialize_components(self):
        """Initialize all NLP processors and extractors"""
        # Document processor
        if self.config.enable_document_processing:
            self.document_processor = create_document_processor(
                self.config.document_processor_config
            )
        else:
            self.document_processor = None

        # Text cleaner
        if self.config.enable_text_cleaning:
            self.text_cleaner = create_text_cleaner(self.config.text_cleaner_config)
        else:
            self.text_cleaner = None

        # Tokenizer
        if self.config.enable_tokenization:
            self.tokenizer = create_document_tokenizer(self.config.tokenizer_config)
        else:
            self.tokenizer = None

        # Structure recognizer
        if self.config.enable_structure_recognition:
            self.structure_recognizer = create_structure_recognizer(
                self.config.structure_recognizer_config
            )
        else:
            self.structure_recognizer = None

        # Requirement extractor
        if self.config.enable_requirement_extraction:
            self.requirement_extractor = create_requirement_extractor(
                self.config.requirement_extractor_config
            )
        else:
            self.requirement_extractor = None

        # Entity extractor
        if self.config.enable_entity_extraction:
            self.entity_extractor = create_entity_extractor(
                self.config.entity_extractor_config
            )
        else:
            self.entity_extractor = None

        # Relationship extractor
        if self.config.enable_relationship_extraction:
            self.relationship_extractor = create_relationship_extractor(
                self.config.relationship_extractor_config
            )
        else:
            self.relationship_extractor = None

        # Deadline extractor
        if self.config.enable_deadline_extraction:
            self.deadline_extractor = create_deadline_extractor(
                self.config.deadline_extractor_config
            )
        else:
            self.deadline_extractor = None

        # Enhanced analyzers
        if self.config.enable_style_analysis:
            self.style_analyzer = create_style_analyzer(
                self.config.style_analyzer_config
            )
        else:
            self.style_analyzer = None

        if self.config.enable_semantic_analysis:
            self.semantic_analyzer = create_semantic_analyzer(
                self.config.semantic_analyzer_config
            )
        else:
            self.semantic_analyzer = None

        if self.config.enable_coherence_analysis:
            self.coherence_analyzer = create_coherence_analyzer(
                self.config.coherence_analyzer_config
            )
        else:
            self.coherence_analyzer = None

        if self.config.enable_readability_analysis:
            self.readability_analyzer = create_readability_analyzer(
                self.config.readability_analyzer_config
            )
        else:
            self.readability_analyzer = None

        if self.config.enable_causal_analysis:
            self.causal_analyzer = create_causal_analyzer(
                self.config.causal_analyzer_config
            )
        else:
            self.causal_analyzer = None

        # Transformers (on-demand)
        if self.config.enable_content_generation:
            self.content_generator = create_content_generator(
                self.config.content_generator_config
            )
        else:
            self.content_generator = None

        if self.config.enable_style_transformation:
            self.style_transformer = create_style_transformer(
                self.config.style_transformer_config
            )
        else:
            self.style_transformer = None

        if self.config.enable_document_summarization:
            self.document_summarizer = create_document_summarizer(
                self.config.document_summarizer_config
            )
        else:
            self.document_summarizer = None

        if self.config.enable_content_optimization:
            self.content_optimizer = create_content_optimizer(
                self.config.content_optimizer_config
            )
        else:
            self.content_optimizer = None

    async def analyze_document(
        self,
        content: Union[str, bytes],
        content_type: Optional[str] = None,
        filename: Optional[str] = None,
        document_id: Optional[str] = None,
    ) -> NLPAnalysisResult:
        """Perform comprehensive NLP analysis on document content"""
        start_time = time.monotonic()
        result = NLPAnalysisResult()
        result.document_id = document_id or uuid7str()

        try:
            # Step 1: Document Processing (if content is not text)
            if isinstance(content, bytes) or content_type:
                if self.document_processor:
                    doc_result = await self._process_document_content(
                        content, content_type, filename
                    )
                    result.document_processing = doc_result
                    if doc_result.success:
                        content = doc_result.content
                    else:
                        result.errors.extend(doc_result.errors)
                        if not content or isinstance(content, bytes):
                            result.errors.append("Failed to extract text from document")
                            return result

            # Ensure content is string
            if isinstance(content, bytes):
                try:
                    content = content.decode("utf-8")
                except UnicodeDecodeError:
                    content = content.decode("utf-8", errors="replace")

            if not content or not content.strip():
                result.errors.append("No text content to analyze")
                return result

            # Step 2: Text Cleaning
            cleaned_text = content
            if self.text_cleaner:
                cleaning_result = await self.text_cleaner.clean_text(cleaned_text)
                result.text_cleaning = cleaning_result
                if cleaning_result.success:
                    cleaned_text = cleaning_result.cleaned_text
                else:
                    result.warnings.extend(cleaning_result.errors)

            result.cleaned_text = cleaned_text

            # Step 3: Parallel processing of all extractors
            if self.config.parallel_processing:
                await self._parallel_analysis(cleaned_text, result)
            else:
                await self._sequential_analysis(cleaned_text, result)

            # Step 4: Post-processing and cross-validation
            if self.config.enable_cross_validation:
                await self._cross_validate_results(result)

            # Step 5: Build comprehensive structured content
            self._build_structured_content(result)

            # Step 6: Calculate overall statistics
            self._calculate_overall_statistics(result)

            result.success = len(result.errors) == 0
            result.processing_time = time.monotonic() - start_time

            self.logger.info(
                f"NLP analysis completed for document {result.document_id}, "
                f"success: {result.success}, time: {result.processing_time:.2f}s"
            )

        except Exception as e:
            result.errors.append(f"NLP analysis failed: {str(e)}")
            self.logger.error(f"NLP analysis error: {e}")

        return result

    async def _process_document_content(
        self,
        content: Union[str, bytes],
        content_type: Optional[str],
        filename: Optional[str],
    ):
        """Process document content to extract text"""
        if isinstance(content, str):
            # Already text, create a mock result
            from .processors.document_processor import ProcessingResult

            result = ProcessingResult()
            result.success = True
            result.content = content
            return result

        return await self.document_processor.process_content(
            content, content_type or "application/octet-stream", filename
        )

    async def _parallel_analysis(self, text: str, result: NLPAnalysisResult):
        """Run all NLP analyses in parallel"""
        tasks = []

        # Tokenization
        if self.tokenizer:
            tasks.append(self._run_tokenization(text))

        # Structure recognition
        if self.structure_recognizer:
            tasks.append(self._run_structure_recognition(text))

        # Requirement extraction
        if self.requirement_extractor:
            tasks.append(self._run_requirement_extraction(text))

        # Entity extraction
        if self.entity_extractor:
            tasks.append(self._run_entity_extraction(text))

        # Relationship extraction
        if self.relationship_extractor:
            tasks.append(self._run_relationship_extraction(text))

        # Deadline extraction
        if self.deadline_extractor:
            tasks.append(self._run_deadline_extraction(text))

        # Enhanced analysis
        if self.style_analyzer:
            tasks.append(self._run_style_analysis(text))

        if self.semantic_analyzer:
            tasks.append(self._run_semantic_analysis(text))

        if self.coherence_analyzer:
            tasks.append(self._run_coherence_analysis(text))

        if self.readability_analyzer:
            tasks.append(self._run_readability_analysis(text))

        if self.causal_analyzer:
            tasks.append(self._run_causal_analysis(text))

        # Transformations (if enabled)
        if self.document_summarizer:
            tasks.append(self._run_document_summarization(text))

        # Run all tasks in parallel
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results
            task_names = []
            if self.tokenizer:
                task_names.append("tokenization")
            if self.structure_recognizer:
                task_names.append("structure_recognition")
            if self.requirement_extractor:
                task_names.append("requirement_extraction")
            if self.entity_extractor:
                task_names.append("entity_extraction")
            if self.relationship_extractor:
                task_names.append("relationship_extraction")
            if self.deadline_extractor:
                task_names.append("deadline_extraction")

            # Enhanced analyzer task names
            if self.style_analyzer:
                task_names.append("style_analysis")
            if self.semantic_analyzer:
                task_names.append("semantic_analysis")
            if self.coherence_analyzer:
                task_names.append("coherence_analysis")
            if self.readability_analyzer:
                task_names.append("readability_analysis")
            if self.causal_analyzer:
                task_names.append("causal_analysis")
            if self.document_summarizer:
                task_names.append("document_summarization")

            for i, task_result in enumerate(results):
                task_name = task_names[i] if i < len(task_names) else f"task_{i}"

                if isinstance(task_result, Exception):
                    result.errors.append(f"{task_name} failed: {str(task_result)}")
                else:
                    self._process_task_result(task_name, task_result, result)

    async def _sequential_analysis(self, text: str, result: NLPAnalysisResult):
        """Run all NLP analyses sequentially"""
        # Tokenization
        if self.tokenizer:
            try:
                tokenization_result = await self._run_tokenization(text)
                self._process_task_result("tokenization", tokenization_result, result)
            except Exception as e:
                result.errors.append(f"Tokenization failed: {str(e)}")

        # Structure recognition
        if self.structure_recognizer:
            try:
                structure_result = await self._run_structure_recognition(text)
                self._process_task_result(
                    "structure_recognition", structure_result, result
                )
            except Exception as e:
                result.errors.append(f"Structure recognition failed: {str(e)}")

        # Requirement extraction
        if self.requirement_extractor:
            try:
                requirement_result = await self._run_requirement_extraction(text)
                self._process_task_result(
                    "requirement_extraction", requirement_result, result
                )
            except Exception as e:
                result.errors.append(f"Requirement extraction failed: {str(e)}")

        # Entity extraction
        if self.entity_extractor:
            try:
                entity_result = await self._run_entity_extraction(text)
                self._process_task_result("entity_extraction", entity_result, result)
            except Exception as e:
                result.errors.append(f"Entity extraction failed: {str(e)}")

        # Relationship extraction (needs entities)
        if self.relationship_extractor:
            try:
                entities = result.entities if hasattr(result, "entities") else None
                relationship_result = await self._run_relationship_extraction(
                    text, entities
                )
                self._process_task_result(
                    "relationship_extraction", relationship_result, result
                )
            except Exception as e:
                result.errors.append(f"Relationship extraction failed: {str(e)}")

        # Deadline extraction
        if self.deadline_extractor:
            try:
                deadline_result = await self._run_deadline_extraction(text)
                self._process_task_result(
                    "deadline_extraction", deadline_result, result
                )
            except Exception as e:
                result.errors.append(f"Deadline extraction failed: {str(e)}")

    async def _run_tokenization(self, text: str):
        """Run tokenization analysis"""
        return await self.tokenizer.tokenize_document(
            text, preserve_sentences=True, include_entities=True
        )

    async def _run_structure_recognition(self, text: str):
        """Run structure recognition analysis"""
        return await self.structure_recognizer.recognize_structure(
            text, use_ai=self.config.use_ai_enhancement
        )

    async def _run_requirement_extraction(self, text: str):
        """Run requirement extraction analysis"""
        return await self.requirement_extractor.extract_requirements(
            text, use_ai=self.config.use_ai_enhancement
        )

    async def _run_entity_extraction(self, text: str):
        """Run entity extraction analysis"""
        return await self.entity_extractor.extract_entities(
            text, use_ai=self.config.use_ai_enhancement
        )

    async def _run_relationship_extraction(
        self, text: str, entities: Optional[List[Any]] = None
    ):
        """Run relationship extraction analysis"""
        return await self.relationship_extractor.extract_relationships(
            text, entities, use_ai=self.config.use_ai_enhancement
        )

    async def _run_deadline_extraction(self, text: str):
        """Run deadline extraction analysis"""
        return await self.deadline_extractor.extract_deadlines(
            text, use_ai=self.config.use_ai_enhancement
        )

    # Enhanced analyzer methods
    async def _run_style_analysis(self, text: str):
        """Run style analysis"""
        return await self.style_analyzer.analyze_style(text)

    async def _run_semantic_analysis(self, text: str):
        """Run semantic analysis"""
        return await self.semantic_analyzer.analyze_semantics(text)

    async def _run_coherence_analysis(self, text: str):
        """Run coherence analysis"""
        return await self.coherence_analyzer.analyze_coherence(text)

    async def _run_readability_analysis(self, text: str):
        """Run readability analysis"""
        return await self.readability_analyzer.analyze_readability(text)

    async def _run_causal_analysis(self, text: str):
        """Run causal analysis"""
        # For causal analysis, we need structured data, so we'll pass the text for processing
        return await self.causal_analyzer.analyze_causal_relationships(text)

    async def _run_document_summarization(self, text: str):
        """Run document summarization"""
        return await self.document_summarizer.summarize_document(text)

    def _process_task_result(
        self, task_name: str, task_result: Any, result: NLPAnalysisResult
    ):
        """Process individual task result and integrate into overall result"""
        if not task_result or not hasattr(task_result, "success"):
            result.warnings.append(f"{task_name} returned invalid result")
            return

        if task_name == "tokenization":
            result.tokenization = task_result
            if task_result.success:
                # Store tokenization statistics
                if "tokenization" not in result.statistics:
                    result.statistics["tokenization"] = task_result.statistics
            else:
                result.errors.extend(task_result.errors)

        elif task_name == "structure_recognition":
            result.structure_recognition = task_result
            if task_result.success and task_result.structure:
                result.structured_content["structure"] = {
                    "elements": [
                        elem.__dict__ for elem in task_result.structure.elements
                    ],
                    "outline": task_result.structure.outline,
                    "statistics": task_result.structure.statistics,
                }
            else:
                result.errors.extend(task_result.errors)

        elif task_name == "requirement_extraction":
            result.requirement_extraction = task_result
            if task_result.success:
                result.requirements = [req.__dict__ for req in task_result.requirements]
                result.statistics["requirements"] = task_result.statistics
            else:
                result.errors.extend(task_result.errors)

        elif task_name == "entity_extraction":
            result.entity_extraction = task_result
            if task_result.success:
                result.entities = [entity.__dict__ for entity in task_result.entities]
                result.statistics["entities"] = task_result.statistics
            else:
                result.errors.extend(task_result.errors)

        elif task_name == "relationship_extraction":
            result.relationship_extraction = task_result
            if task_result.success:
                result.relationships = [
                    rel.__dict__ for rel in task_result.relationships
                ]
                result.statistics["relationships"] = task_result.statistics
            else:
                result.errors.extend(task_result.errors)

        elif task_name == "deadline_extraction":
            result.deadline_extraction = task_result
            if task_result.success:
                result.deadlines = [
                    deadline.__dict__ for deadline in task_result.deadlines
                ]
                result.timeline = [
                    (dt.isoformat() if hasattr(dt, "isoformat") else str(dt), desc)
                    for dt, desc in task_result.timeline
                ]
                result.statistics["deadlines"] = task_result.statistics
            else:
                result.errors.extend(task_result.errors)

        # Enhanced analyzer results
        elif task_name == "style_analysis":
            result.style_analysis = task_result
            if task_result and hasattr(task_result, "success") and task_result.success:
                result.statistics["style_analysis"] = getattr(
                    task_result, "statistics", {}
                )
            elif task_result and hasattr(task_result, "errors"):
                result.errors.extend(task_result.errors)

        elif task_name == "semantic_analysis":
            result.semantic_analysis = task_result
            if task_result and hasattr(task_result, "success") and task_result.success:
                result.statistics["semantic_analysis"] = getattr(
                    task_result, "statistics", {}
                )
            elif task_result and hasattr(task_result, "errors"):
                result.errors.extend(task_result.errors)

        elif task_name == "coherence_analysis":
            result.coherence_analysis = task_result
            if task_result and hasattr(task_result, "success") and task_result.success:
                result.statistics["coherence_analysis"] = getattr(
                    task_result, "statistics", {}
                )
            elif task_result and hasattr(task_result, "errors"):
                result.errors.extend(task_result.errors)

        elif task_name == "readability_analysis":
            result.readability_analysis = task_result
            if task_result and hasattr(task_result, "success") and task_result.success:
                result.statistics["readability_analysis"] = getattr(
                    task_result, "statistics", {}
                )
            elif task_result and hasattr(task_result, "errors"):
                result.errors.extend(task_result.errors)

        elif task_name == "causal_analysis":
            result.causal_analysis = task_result
            if task_result and hasattr(task_result, "success") and task_result.success:
                result.statistics["causal_analysis"] = getattr(
                    task_result, "statistics", {}
                )
            elif task_result and hasattr(task_result, "errors"):
                result.errors.extend(task_result.errors)

        elif task_name == "document_summarization":
            result.document_summarization = task_result
            if task_result and hasattr(task_result, "success") and task_result.success:
                result.statistics["document_summarization"] = getattr(
                    task_result, "statistics", {}
                )
            elif task_result and hasattr(task_result, "errors"):
                result.errors.extend(task_result.errors)

    async def _cross_validate_results(self, result: NLPAnalysisResult):
        """Cross-validate results between different extractors"""
        # Cross-validate entities mentioned in requirements
        if result.entities and result.requirements:
            entity_texts = {entity["text"].lower() for entity in result.entities}
            for req in result.requirements:
                req_text_lower = req["text"].lower()
                mentioned_entities = [
                    entity for entity in entity_texts if entity in req_text_lower
                ]
                if mentioned_entities:
                    req["mentioned_entities"] = list(mentioned_entities)

        # Cross-validate relationships with entities
        if result.relationships and result.entities:
            entity_texts = {entity["text"] for entity in result.entities}
            validated_relationships = []
            for rel in result.relationships:
                if (
                    rel["source_entity"] in entity_texts
                    or rel["target_entity"] in entity_texts
                ):
                    rel["entity_validated"] = True
                    validated_relationships.append(rel)
                else:
                    rel["entity_validated"] = False
                    validated_relationships.append(rel)
            result.relationships = validated_relationships

        # Cross-validate deadlines with requirements
        if result.deadlines and result.requirements:
            deadline_texts = {deadline["text"].lower() for deadline in result.deadlines}
            for req in result.requirements:
                req_text_lower = req["text"].lower()
                has_deadline = any(
                    deadline_text in req_text_lower for deadline_text in deadline_texts
                )
                req["has_associated_deadline"] = has_deadline

    def _build_structured_content(self, result: NLPAnalysisResult):
        """Build comprehensive structured content representation"""
        # Document overview
        result.structured_content["overview"] = {
            "document_id": result.document_id,
            "processing_timestamp": datetime.now().isoformat(),
            "content_length": len(result.cleaned_text),
            "processing_time": result.processing_time,
        }

        # Summary statistics
        summary = {
            "requirements_count": len(result.requirements),
            "entities_count": len(result.entities),
            "relationships_count": len(result.relationships),
            "deadlines_count": len(result.deadlines),
        }

        # Add confidence scores
        if result.requirements:
            avg_req_confidence = sum(
                req.get("confidence", 0) for req in result.requirements
            ) / len(result.requirements)
            summary["avg_requirement_confidence"] = avg_req_confidence

        if result.entities:
            avg_entity_confidence = sum(
                entity.get("confidence", 0) for entity in result.entities
            ) / len(result.entities)
            summary["avg_entity_confidence"] = avg_entity_confidence

        result.structured_content["summary"] = summary

        # Key insights
        insights = []
        if len(result.requirements) > 10:
            insights.append(
                f"Document contains {len(result.requirements)} requirements - complex RFP"
            )
        if len(result.deadlines) > 5:
            insights.append(
                f"Multiple deadlines identified ({len(result.deadlines)}) - time-sensitive project"
            )
        if len(result.entities) > 20:
            insights.append("High entity density - detailed technical specification")

        result.structured_content["insights"] = insights

    def _calculate_overall_statistics(self, result: NLPAnalysisResult):
        """Calculate comprehensive statistics across all analyses"""
        overall_stats = {
            "processing_summary": {
                "total_components": sum(
                    1
                    for comp in [
                        self.document_processor,
                        self.text_cleaner,
                        self.tokenizer,
                        self.structure_recognizer,
                        self.requirement_extractor,
                        self.entity_extractor,
                        self.relationship_extractor,
                        self.deadline_extractor,
                    ]
                    if comp is not None
                ),
                "successful_extractions": len(
                    [
                        result.tokenization,
                        result.structure_recognition,
                        result.requirement_extraction,
                        result.entity_extraction,
                        result.relationship_extraction,
                        result.deadline_extraction,
                    ]
                ),
                "total_processing_time": result.processing_time,
            }
        }

        # Merge component statistics
        for component_name, stats in result.statistics.items():
            if isinstance(stats, dict):
                overall_stats[f"{component_name}_stats"] = stats

        result.statistics["overall"] = overall_stats

    async def analyze_text_only(
        self, text: str, document_id: Optional[str] = None
    ) -> NLPAnalysisResult:
        """Analyze plain text content (shortcut method)"""
        return await self.analyze_document(
            text, content_type="text/plain", document_id=document_id
        )

    async def get_document_summary(self, text: str) -> Dict[str, Any]:
        """Get a quick summary of document content"""
        analysis = await self.analyze_text_only(text)

        if not analysis.success:
            return {"error": "Analysis failed", "errors": analysis.errors}

        return {
            "summary": analysis.structured_content.get("summary", {}),
            "insights": analysis.structured_content.get("insights", []),
            "key_requirements": analysis.requirements[:5]
            if analysis.requirements
            else [],
            "key_entities": analysis.entities[:10] if analysis.entities else [],
            "upcoming_deadlines": analysis.deadlines[:3] if analysis.deadlines else [],
            "processing_time": analysis.processing_time,
        }

    async def extract_requirements(self, text: str) -> List[str]:
        """Extract requirements from text (convenience alias)."""
        result = await self.extract_requirements_only(text)
        if result.get("success"):
            return [req.get("text", "") for req in result.get("requirements", [])]
        return []

    async def extract_requirements_only(self, text: str) -> Dict[str, Any]:
        """Extract only requirements (optimized method)"""
        if not self.requirement_extractor:
            return {"error": "Requirement extraction not enabled"}

        result = await self.requirement_extractor.extract_requirements(text)

        return {
            "success": result.success,
            "requirements": [req.__dict__ for req in result.requirements]
            if result.success
            else [],
            "statistics": result.statistics if result.success else {},
            "errors": result.errors,
        }

    async def close(self):
        """Close all NLP service components"""
        components = [
            self.text_cleaner,
            self.structure_recognizer,
            self.requirement_extractor,
            self.entity_extractor,
            self.relationship_extractor,
            self.deadline_extractor,
        ]

        for component in components:
            if component and hasattr(component, "close"):
                try:
                    await component.close()
                except Exception as e:
                    self.logger.warning(
                        f"Failed to close component {type(component).__name__}: {e}"
                    )

        self.logger.info("NLP service closed")

    def get_service_info(self) -> Dict[str, Any]:
        """Get comprehensive service information"""
        component_info = {}

        if self.document_processor:
            component_info["document_processor"] = (
                self.document_processor.get_processor_info()
            )
        if self.tokenizer:
            component_info["tokenizer"] = self.tokenizer.get_tokenizer_info()
        if self.structure_recognizer:
            component_info["structure_recognizer"] = (
                self.structure_recognizer.get_recognizer_info()
            )
        if self.requirement_extractor:
            component_info["requirement_extractor"] = (
                self.requirement_extractor.get_extractor_info()
            )
        if self.entity_extractor:
            component_info["entity_extractor"] = (
                self.entity_extractor.get_extractor_info()
            )
        if self.relationship_extractor:
            component_info["relationship_extractor"] = (
                self.relationship_extractor.get_extractor_info()
            )
        if self.deadline_extractor:
            component_info["deadline_extractor"] = (
                self.deadline_extractor.get_extractor_info()
            )

        return {
            "service_version": "1.0.0",
            "ollama_model": self.config.ollama_model,
            "components_enabled": {
                "document_processing": self.config.enable_document_processing,
                "text_cleaning": self.config.enable_text_cleaning,
                "tokenization": self.config.enable_tokenization,
                "structure_recognition": self.config.enable_structure_recognition,
                "requirement_extraction": self.config.enable_requirement_extraction,
                "entity_extraction": self.config.enable_entity_extraction,
                "relationship_extraction": self.config.enable_relationship_extraction,
                "deadline_extraction": self.config.enable_deadline_extraction,
            },
            "component_details": component_info,
            "configuration": {
                "ai_enhancement": self.config.use_ai_enhancement,
                "parallel_processing": self.config.parallel_processing,
                "min_confidence_threshold": self.config.min_confidence_threshold,
            },
        }

# Factory function
def create_nlp_service(config: Optional[NLPServiceConfiguration] = None) -> NLPService:
    """Create NLP service instance with configuration"""
    return NLPService(config)
