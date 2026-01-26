# DocuFusion API Reference

Complete API reference for the DocuFusion document generation system.

## Table of Contents

- [Document Engine API](#document-engine-api)
- [Unified Renderer Interface](#unified-renderer-interface)
- [Content Models](#content-models)
- [Configuration Classes](#configuration-classes)
- [Result Objects](#result-objects)
- [Performance Optimization](#performance-optimization)
- [Error Handling](#error-handling)

## Document Engine API

### DocumentEngine

Main orchestration class for document generation.

```python
from proposal_writer.document_engine.document_engine import DocumentEngine

engine = DocumentEngine(enable_logging=True, enable_caching=True)
```

#### Constructor Parameters

- `config: Optional[DocumentGenerationConfiguration]` - Engine configuration
- `enable_logging: bool = True` - Enable logging output
- `enable_caching: bool = True` - Enable result caching

#### Core Methods

##### `generate_document(request: DocumentGenerationRequest) -> DocumentGenerationResult`

Generate a single document from request specification.

```python
async def generate_document(
    request: DocumentGenerationRequest
) -> DocumentGenerationResult
```

**Parameters:**
- `request: DocumentGenerationRequest` - Document generation specification

**Returns:**
- `DocumentGenerationResult` - Complete generation results with metrics

**Example:**
```python
from proposal_writer.document_engine.document_engine import (
    DocumentGenerationRequest, DocumentGenerationConfiguration
)

config = DocumentGenerationConfiguration(
    document_title="My Document",
    output_formats=["pdf", "html"],
    enable_accessibility=True
)

request = DocumentGenerationRequest(
    content_sources=[
        {"content": "# Title\nContent here", "type": "markdown"}
    ],
    generation_config=config
)

result = await engine.generate_document(request)
print(f"Success: {result.generation_successful}")
print(f"Quality Score: {result.overall_quality_score}")
```

##### `generate_document_batch(requests: List[DocumentGenerationRequest]) -> List[DocumentGenerationResult]`

Generate multiple documents in batch with optional parallelization.

```python
async def generate_document_batch(
    requests: List[DocumentGenerationRequest]
) -> List[DocumentGenerationResult]
```

##### `get_engine_metrics() -> Dict[str, Any]`

Get comprehensive performance and usage metrics.

```python
async def get_engine_metrics() -> Dict[str, Any]
```

**Returns:**
```python
{
    'engine_metrics': {
        'documents_generated': int,
        'total_processing_time': float,
        'average_processing_time': float,
        'success_rate': float
    },
    'component_metrics': Dict[str, Any],
    'cache_stats': {'hits': int, 'misses': int},
    'system_status': str
}
```

## Unified Renderer Interface

### BaseRenderer

Abstract base class for all document renderers.

```python
from proposal_writer.document_engine.renderer.base_renderer import BaseRenderer
```

#### Abstract Methods

All renderers must implement:

```python
async def render(
    content: UnifiedDocumentContent,
    output_path: Optional[Union[str, Path]] = None,
    custom_config: Optional[UnifiedRenderConfiguration] = None
) -> UnifiedRenderResult
```

#### Available Renderers

##### UnifiedPDFRenderer

```python
from proposal_writer.document_engine.renderer.unified_pdf_renderer import (
    UnifiedPDFRenderer, PDFRenderConfiguration
)

pdf_config = PDFRenderConfiguration(
    pdf_version="1.7",
    compression_level=6,
    enable_latex_fallback=True
)

renderer = UnifiedPDFRenderer(pdf_config)
result = await renderer.render(content, "output.pdf")
```

##### UnifiedHTMLRenderer

```python
from proposal_writer.document_engine.renderer.unified_html_renderer import (
    UnifiedHTMLRenderer, HTMLRenderConfiguration
)

html_config = HTMLRenderConfiguration(
    responsive_design=True,
    include_css=True,
    semantic_markup=True
)

renderer = UnifiedHTMLRenderer(html_config)
result = await renderer.render(content, "output.html")
```

##### UnifiedDOCXRenderer

```python
from proposal_writer.document_engine.renderer.unified_docx_renderer import (
    UnifiedDOCXRenderer, DOCXRenderConfiguration
)

docx_config = DOCXRenderConfiguration(
    default_font="Calibri",
    preserve_html_structure=True
)

renderer = UnifiedDOCXRenderer(docx_config)
result = await renderer.render(content, "output.docx")
```

##### UnifiedAccessibilityRenderer

```python
from proposal_writer.document_engine.renderer.unified_accessibility_renderer import (
    UnifiedAccessibilityRenderer, AccessibilityRenderConfiguration
)

a11y_config = AccessibilityRenderConfiguration(
    target_wcag_level="AA",
    auto_generate_alt_text=True
)

renderer = UnifiedAccessibilityRenderer(a11y_config)
result = await renderer.render(content, "accessible.html")
```

### Renderer Registry

Factory pattern for renderer management.

```python
from proposal_writer.document_engine.renderer.base_renderer import (
    renderer_registry, render_document
)

# Check available formats
formats = renderer_registry.get_available_formats()
print(f"Available: {formats}")

# Get specific renderer
pdf_renderer = renderer_registry.get_renderer("pdf")

# Convenience function
result = await render_document(content, "html")
```

## Content Models

### UnifiedDocumentContent

Standardized content representation across all renderers.

```python
from proposal_writer.document_engine.renderer.base_renderer import UnifiedDocumentContent

content = UnifiedDocumentContent(
    title="Document Title",
    content_html="<h1>Title</h1><p>Content</p>",
    content_markdown="# Title\n\nContent",
    content_text="Title\n\nContent",
    content_css="h1 { color: blue; }",
    sections=[
        {"title": "Section 1", "content": "Section content"},
        {"title": "Section 2", "content": "More content"}
    ],
    metadata={
        "author": "John Doe",
        "subject": "Document Subject",
        "keywords": ["keyword1", "keyword2"]
    },
    image_assets={"logo": "base64encodeddata"},
    computed_styles={"heading_color": "#2c3e50"}
)
```

#### Key Fields

- `title: str` - Document title
- `content_html: str` - HTML content
- `content_markdown: str` - Markdown content  
- `content_text: str` - Plain text content
- `content_css: str` - CSS styling
- `content_latex: str` - LaTeX content (for PDF)
- `sections: List[Dict[str, Any]]` - Document sections
- `metadata: Dict[str, Any]` - Document metadata
- `image_assets: Dict[str, str]` - Embedded images
- `computed_styles: Dict[str, Any]` - Computed styling

### DocumentGenerationRequest

Complete request specification for document generation.

```python
from proposal_writer.document_engine.document_engine import DocumentGenerationRequest

request = DocumentGenerationRequest(
    content_sources=[
        {
            "source_id": "intro", 
            "type": "markdown",
            "content": "# Introduction\nContent here",
            "priority": 1
        }
    ],
    generation_config=config,
    brand_specification={
        "primary_color": "#2c3e50",
        "font_family": "Arial"
    },
    accessibility_requirements={
        "wcag_level": "AA",
        "screen_reader_optimized": True
    }
)
```

## Configuration Classes

### DocumentGenerationConfiguration

Main configuration for document generation.

```python
from proposal_writer.document_engine.document_engine import DocumentGenerationConfiguration

config = DocumentGenerationConfiguration(
    # Document metadata
    document_title="My Document",
    document_type="report",  # proposal, report, presentation, memo
    document_language="en",
    
    # Output formats
    output_formats=["pdf", "html", "docx"],
    output_directory="/path/to/output",
    
    # Processing options
    enable_accessibility=True,
    enable_brand_compliance=True,
    enable_cross_references=True,
    parallel_processing=True,
    
    # Quality requirements
    minimum_quality_score=0.8,
    accessibility_compliance_level="AA",
    
    # Performance settings
    max_processing_time=300.0,  # 5 minutes
    concurrent_renderers=3
)
```

### Format-Specific Configurations

#### PDFRenderConfiguration

```python
from proposal_writer.document_engine.renderer.unified_pdf_renderer import PDFRenderConfiguration

pdf_config = PDFRenderConfiguration(
    # PDF settings
    pdf_version="1.7",
    pdf_a_compliance=False,
    compression_level=6,
    
    # LaTeX settings
    latex_engine="pdflatex",
    enable_latex_fallback=True,
    
    # Security
    password_protection=False,
    allow_printing=True,
    
    # Quality
    dpi=300,
    image_quality=85
)
```

#### HTMLRenderConfiguration

```python
from proposal_writer.document_engine.renderer.unified_html_renderer import HTMLRenderConfiguration

html_config = HTMLRenderConfiguration(
    # HTML generation
    html_version="HTML5",
    semantic_markup=True,
    minify_html=False,
    
    # CSS settings
    include_css=True,
    responsive_design=True,
    css_framework="custom",
    
    # SEO and accessibility
    include_meta_tags=True,
    aria_labels=True,
    skip_navigation=True
)
```

## Result Objects

### UnifiedRenderResult

Standardized result from any renderer.

```python
# Access render results
result = await renderer.render(content)

print(f"Success: {result.render_successful}")
print(f"Content Type: {result.content_type}")
print(f"File Size: {result.file_size}")
print(f"Quality Score: {result.rendering_quality_score}")
print(f"Accessibility Score: {result.accessibility_score}")
print(f"Processing Time: {result.rendering_time}s")

# Access rendered content
rendered_bytes = result.rendered_content
additional_files = result.additional_files  # CSS, JS, etc.
output_paths = result.output_paths

# Check for issues
if result.validation_warnings:
    print(f"Warnings: {result.validation_warnings}")
if result.validation_errors:
    print(f"Errors: {result.validation_errors}")
```

### DocumentGenerationResult

Complete result from DocumentEngine.

```python
result = await engine.generate_document(request)

# Overall status
print(f"Success: {result.generation_successful}")
print(f"Overall Quality: {result.overall_quality_score}")
print(f"Processing Time: {result.processing_time}s")

# Component results
assembly_result = result.assembly_result
formatting_result = result.formatting_result
pdf_result = result.pdf_result
html_result = result.html_result

# Performance metrics
component_times = result.component_processing_times
print(f"Assembly took: {component_times.get('assembly', 0)}s")
print(f"Rendering took: {component_times.get('rendering', 0)}s")

# Quality scores by format
for format_name, score in result.format_quality_scores.items():
    print(f"{format_name} quality: {score}")

# Generated files
for format_name, file_path in result.generated_documents.items():
    print(f"{format_name}: {file_path}")
```

## Performance Optimization

### PerformanceOptimizer

Analyze and optimize system performance.

```python
from proposal_writer.document_engine.performance_optimizer import (
    PerformanceOptimizer, create_performance_test_requests
)

# Create optimizer
optimizer = PerformanceOptimizer(engine)

# Profile performance
test_requests = create_performance_test_requests()
profile = await optimizer.profile_performance(test_requests, iterations=3)

print(f"Performance Grade: {profile.performance_grade}")
print(f"Average Time: {profile.total_time:.3f}s")
print(f"Bottlenecks: {profile.bottleneck_components}")

# Apply optimizations
optimization_result = await optimizer.apply_optimizations()
print(f"Improvement: {optimization_result.improvement_percentage:.1f}%")

# Generate report
report = await optimizer.generate_performance_report()
print(report)
```

### Quick Performance Check

```python
from proposal_writer.document_engine.performance_optimizer import quick_performance_check

# Quick performance assessment
avg_time, grade = await quick_performance_check(engine)
print(f"Performance: {grade} ({avg_time:.3f}s)")
```

## Error Handling

### Exception Hierarchy

```python
from proposal_writer.document_engine.document_engine import (
    DocumentEngineException,
    DocumentGenerationException,
    WorkflowExecutionException,
    ConfigurationException
)

from proposal_writer.document_engine.renderer.base_renderer import (
    RendererException,
    ContentProcessingException,
    OutputGenerationException
)
```

### Error Handling Patterns

```python
try:
    result = await engine.generate_document(request)
    if not result.generation_successful:
        print(f"Generation failed: {result.errors}")
        print(f"Warnings: {result.warnings}")
except DocumentGenerationException as e:
    print(f"Generation error: {e}")
except ConfigurationException as e:
    print(f"Configuration error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

### Graceful Degradation

```python
# Handle partial failures
result = await engine.generate_document(request)

if result.generation_successful:
    print("Full success!")
elif result.format_quality_scores:
    print("Partial success - some formats generated")
    for format_name, score in result.format_quality_scores.items():
        print(f"✓ {format_name}: {score}")
else:
    print("Complete failure")
    print(f"Errors: {result.errors}")
```

## Utility Functions

### Convenience Functions

```python
from proposal_writer.document_engine.renderer.base_renderer import (
    render_document,
    batch_render_multi_format,
    create_unified_content_from_html
)

# Simple document rendering
result = await render_document(content, "pdf")

# Multi-format batch rendering
results = await batch_render_multi_format(
    documents=[content1, content2], 
    formats=["html", "pdf"],
    output_directory="/path/to/output"
)

# Create content from HTML
content = create_unified_content_from_html(
    html_content="<h1>Title</h1>",
    title="Document",
    css_content="h1 { color: blue; }"
)
```

### Factory Functions

```python
from proposal_writer.document_engine.renderer.unified_pdf_renderer import create_pdf_renderer
from proposal_writer.document_engine.renderer.unified_html_renderer import create_html_renderer

# Create renderers with factory functions
pdf_renderer = create_pdf_renderer(config=pdf_config, unified_interface=True)
html_renderer = create_html_renderer(config=html_config, unified_interface=True)
```

## Best Practices

### 1. Configuration Management

```python
# Use environment-specific configurations
def create_production_config():
    return DocumentGenerationConfiguration(
        output_formats=["pdf", "html"],
        enable_caching=True,
        parallel_processing=True,
        minimum_quality_score=0.9,
        max_processing_time=60.0
    )

def create_development_config():
    return DocumentGenerationConfiguration(
        output_formats=["html"],  # Faster for development
        enable_caching=False,     # For consistent testing
        parallel_processing=False,
        minimum_quality_score=0.7
    )
```

### 2. Error Handling

```python
async def robust_document_generation(engine, request):
    """Example of robust document generation with error handling"""
    try:
        # Validate request
        if not request.content_sources:
            raise ValueError("No content sources provided")
        
        # Generate document
        result = await engine.generate_document(request)
        
        # Check quality
        if result.overall_quality_score < 0.8:
            print(f"Warning: Low quality score: {result.overall_quality_score}")
        
        # Return successful result
        return result
        
    except DocumentEngineException as e:
        print(f"Engine error: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None
```

### 3. Performance Monitoring

```python
async def monitor_performance(engine):
    """Monitor engine performance over time"""
    while True:
        metrics = await engine.get_engine_metrics()
        engine_metrics = metrics['engine_metrics']
        
        # Log key metrics
        print(f"Documents: {engine_metrics['documents_generated']}")
        print(f"Success Rate: {engine_metrics['success_rate']:.1%}")
        print(f"Avg Time: {engine_metrics['average_processing_time']:.3f}s")
        
        # Alert on performance degradation
        if engine_metrics['average_processing_time'] > 5.0:
            print("⚠️  Performance alert: Average time > 5s")
        
        await asyncio.sleep(60)  # Check every minute
```

### 4. Batch Processing

```python
async def process_document_queue(engine, requests):
    """Process multiple documents efficiently"""
    batch_size = 10
    
    for i in range(0, len(requests), batch_size):
        batch = requests[i:i + batch_size]
        
        # Process batch
        results = await engine.generate_document_batch(batch)
        
        # Handle results
        for result in results:
            if result.generation_successful:
                print(f"✓ Document {result.request_id} completed")
            else:
                print(f"✗ Document {result.request_id} failed")
```

---

For more examples and tutorials, see the [Usage Examples](USAGE_EXAMPLES.md) documentation.