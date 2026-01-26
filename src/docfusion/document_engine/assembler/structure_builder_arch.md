# StructureBuilder Module - Architecture Documentation

## Architectural Overview

The StructureBuilder module implements a hierarchical document structure management system using template-driven generation, section composition patterns, and automatic organization algorithms. The architecture follows a layered approach with clear separation between template processing, structure generation, and content organization.

## Core Architecture Pattern

### 1. Template-Driven Architecture
```
Template Engine
├── Template Parser
│   ├── Template Validation
│   ├── Variable Extraction
│   ├── Section Definition Processing
│   └── Inheritance Resolution
├── Template Compiler
│   ├── Structure Generation Rules
│   ├── Section Ordering Logic
│   ├── Content Placement Rules
│   └── Navigation Generation
└── Template Cache
    ├── Compiled Template Storage
    ├── Template Dependency Tracking
    ├── Invalidation Management
    └── Performance Optimization
```

### 2. Hierarchical Structure Management
```
Structure Manager
├── Section Hierarchy
│   ├── Section Tree Construction
│   ├── Parent-Child Relationships
│   ├── Sibling Ordering
│   └── Depth Validation
├── Section Operations
│   ├── Insert/Remove Operations
│   ├── Reordering Logic
│   ├── Hierarchy Restructuring
│   └── Dependency Resolution
└── Structure Validation
    ├── Hierarchy Consistency
    ├── Section Numbering
    ├── Reference Integrity
    └── Template Compliance
```

### 3. Content Organization System
```
Organization Engine
├── Content Placement
│   ├── Block-to-Section Mapping
│   ├── Content Ordering Rules
│   ├── Priority-Based Placement
│   └── Template-Driven Positioning
├── TOC Generation
│   ├── Section Discovery
│   ├── Numbering System
│   ├── Formatting Rules
│   └── Multi-Level Indentation
└── Navigation Creation
    ├── Section Links
    ├── Cross-References
    ├── Breadcrumb Generation
    └── Document Navigation
```

## Data Models

### DocumentStructure
```python
@dataclass
class DocumentStructure:
    """Hierarchical document structure representation"""
    structure_id: str = Field(default_factory=uuid7str)
    document_id: str
    template_name: str
    
    # Hierarchical structure
    sections: list[DocumentSection] = Field(default_factory=list)
    section_tree: dict[str, list[str]] = Field(default_factory=dict)  # parent -> children
    max_depth: int = 6
    
    # Table of contents
    toc_config: TOCConfiguration = Field(default_factory=TOCConfiguration)
    generated_toc: list[TOCEntry] = Field(default_factory=list)
    
    # Metadata and configuration
    template_version: str = "1.0.0"
    structure_version: str = "1.0.0"
    auto_numbering: bool = True
    custom_ordering: dict[str, int] = Field(default_factory=dict)
    
    # Performance optimization
    structure_hash: str = ""
    last_compiled: datetime = Field(default_factory=datetime.now)
    compilation_time: float = 0.0
    
    # Integration points
    content_block_mapping: dict[str, str] = Field(default_factory=dict)  # block_id -> section_id
    template_variables: dict[str, Any] = Field(default_factory=dict)
```

### DocumentSection
```python
@dataclass
class DocumentSection:
    """Individual section within document structure"""
    section_id: str = Field(default_factory=uuid7str)
    title: str
    section_type: str  # heading, content, appendix, toc, index
    
    # Hierarchy information
    level: int = 1  # 1-6 depth levels
    parent_id: str | None = None
    child_ids: list[str] = Field(default_factory=list)
    sibling_order: int = 0
    section_number: str = ""  # Auto-generated: "1.2.3"
    
    # Content association
    content_block_ids: list[str] = Field(default_factory=list)
    content_requirements: dict[str, Any] = Field(default_factory=dict)
    optional_content: bool = False
    
    # Template configuration
    template_section: str = ""
    template_variables: dict[str, Any] = Field(default_factory=dict)
    styling_rules: dict[str, str] = Field(default_factory=dict)
    
    # Navigation and references
    anchor_id: str = ""
    cross_references: list[str] = Field(default_factory=list)
    backlinks: list[str] = Field(default_factory=list)
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    section_status: str = "active"  # active, hidden, conditional
    priority: int = 0
```

### DocumentTemplate
```python
@dataclass
class DocumentTemplate:
    """Template definition for document structure generation"""
    template_id: str = Field(default_factory=uuid7str)
    template_name: str
    template_type: str  # proposal, report, presentation, technical_doc
    
    # Template hierarchy
    base_template: str | None = None  # For template inheritance
    template_version: str = "1.0.0"
    
    # Section definitions
    section_definitions: list[SectionDefinition] = Field(default_factory=list)
    required_sections: list[str] = Field(default_factory=list)
    optional_sections: list[str] = Field(default_factory=list)
    conditional_sections: dict[str, str] = Field(default_factory=dict)  # section_id -> condition
    
    # Structure rules
    max_depth: int = 6
    auto_numbering_format: str = "1.2.3"  # or "I.A.1", "a.i.1", etc.
    section_ordering_rules: dict[str, int] = Field(default_factory=dict)
    
    # TOC configuration
    default_toc_config: TOCConfiguration = Field(default_factory=TOCConfiguration)
    toc_placement: str = "after_title"  # after_title, before_content, custom
    
    # Template variables
    variables: dict[str, TemplateVariable] = Field(default_factory=dict)
    variable_validation: dict[str, str] = Field(default_factory=dict)
    
    # Integration configuration
    latex_class: str = "docufusion-proposal"
    git_integration: bool = True
    file_structure: dict[str, str] = Field(default_factory=dict)  # section -> file mapping
```

### TOCConfiguration
```python
@dataclass
class TOCConfiguration:
    """Table of Contents configuration and formatting"""
    enabled: bool = True
    max_depth: int = 3
    min_depth: int = 1
    
    # Formatting options
    numbering_style: str = "decimal"  # decimal, roman, alpha, none
    indentation_style: str = "spaces"  # spaces, tabs, bullets
    indentation_size: int = 4
    
    # Content filtering
    include_sections: list[str] = Field(default_factory=list)
    exclude_sections: list[str] = Field(default_factory=list)
    section_types: list[str] = Field(default_factory=lambda: ["heading"])
    
    # Styling and presentation
    title: str = "Table of Contents"
    page_numbers: bool = True
    clickable_links: bool = True
    custom_formatting: dict[str, str] = Field(default_factory=dict)
```

## Component Architecture

### 1. TemplateEngine
```python
class TemplateEngine:
    """Core template processing and compilation engine"""
    
    def __init__(self):
        self.template_cache = TemplateCache()
        self.parser = TemplateParser()
        self.compiler = TemplateCompiler()
        self.validator = TemplateValidator()
    
    async def load_template(self, template_name: str) -> DocumentTemplate:
        """Load and validate template definition"""
        
    async def compile_template(
        self, 
        template: DocumentTemplate, 
        variables: dict[str, Any]
    ) -> CompiledTemplate:
        """Compile template with variables into executable structure"""
        
    async def validate_template(self, template: DocumentTemplate) -> ValidationResult:
        """Validate template syntax and structure"""
```

### 2. StructureManager
```python
class StructureManager:
    """Hierarchical document structure management"""
    
    def __init__(self):
        self.section_tree = SectionTree()
        self.numbering_system = NumberingSystem()
        self.dependency_resolver = DependencyResolver()
        self.structure_cache = StructureCache()
    
    async def build_structure(
        self, 
        template: CompiledTemplate, 
        content_blocks: list[ContentBlock]
    ) -> DocumentStructure:
        """Build document structure from template and content blocks"""
        
    async def restructure_document(
        self, 
        structure: DocumentStructure, 
        operations: list[StructureOperation]
    ) -> DocumentStructure:
        """Apply restructuring operations to document"""
        
    async def validate_structure(self, structure: DocumentStructure) -> ValidationResult:
        """Validate structure consistency and integrity"""
```

### 3. TOCGenerator
```python
class TOCGenerator:
    """Table of Contents generation and management"""
    
    def __init__(self):
        self.formatter = TOCFormatter()
        self.numbering = NumberingSystem()
        self.filter_engine = TOCFilterEngine()
    
    async def generate_toc(
        self, 
        structure: DocumentStructure, 
        config: TOCConfiguration
    ) -> TableOfContents:
        """Generate table of contents from document structure"""
        
    async def update_toc(
        self, 
        toc: TableOfContents, 
        structure_changes: list[StructureChange]
    ) -> TableOfContents:
        """Update TOC based on structure changes"""
        
    def format_toc(
        self, 
        toc: TableOfContents, 
        format_style: str
    ) -> str:
        """Format TOC for specific output (LaTeX, HTML, Markdown)"""
```

### 4. OutlineBuilder
```python
class OutlineBuilder:
    """Document outline creation and export"""
    
    def __init__(self):
        self.outline_formatter = OutlineFormatter()
        self.summary_generator = SummaryGenerator()
        self.export_engine = OutlineExportEngine()
    
    async def create_outline(
        self, 
        structure: DocumentStructure,
        detail_level: str = "full"
    ) -> DocumentOutline:
        """Create comprehensive document outline"""
        
    async def generate_section_summaries(
        self, 
        structure: DocumentStructure,
        content_blocks: dict[str, ContentBlock]
    ) -> dict[str, str]:
        """Generate summaries for each section"""
        
    def export_outline(
        self, 
        outline: DocumentOutline, 
        format: str
    ) -> str:
        """Export outline in specified format (JSON, XML, Markdown)"""
```

## Performance Architecture

### Caching Strategy
```python
class StructureCache:
    """Multi-level caching for structure operations"""
    
    # L1: In-memory structure cache (100 structures)
    memory_cache: dict[str, DocumentStructure]
    
    # L2: Compiled template cache (50 templates)
    template_cache: dict[str, CompiledTemplate]
    
    # L3: TOC cache (200 TOCs)
    toc_cache: dict[str, TableOfContents]
    
    # Cache invalidation
    structure_dependencies: dict[str, set[str]]
    cache_timestamps: dict[str, datetime]
```

### Async Processing Pipeline
```python
class AsyncStructureProcessor:
    """Asynchronous structure building pipeline"""
    
    async def parallel_section_processing(
        self, 
        sections: list[SectionDefinition]
    ) -> list[DocumentSection]:
        """Process sections in parallel for performance"""
        
    async def concurrent_toc_generation(
        self, 
        structures: list[DocumentStructure]
    ) -> list[TableOfContents]:
        """Generate multiple TOCs concurrently"""
        
    async def batch_structure_operations(
        self, 
        operations: list[StructureOperation]
    ) -> list[OperationResult]:
        """Execute structure operations in optimized batches"""
```

## Integration Architecture

### Git + LaTeX Integration
```python
class GitLatexStructureIntegration:
    """Integration with Git + LaTeX file-based system"""
    
    def serialize_structure_to_files(
        self, 
        structure: DocumentStructure, 
        repo_path: Path
    ) -> dict[str, Path]:
        """Serialize structure to Git-friendly file layout"""
        
    def generate_latex_structure(
        self, 
        structure: DocumentStructure
    ) -> str:
        """Generate LaTeX document structure with includes"""
        
    def optimize_file_includes(
        self, 
        structure: DocumentStructure
    ) -> list[str]:
        """Optimize LaTeX include order for compilation"""
```

### ContentAssembler Integration
```python
class StructureAssemblerBridge:
    """Bridge between StructureBuilder and ContentAssembler"""
    
    def map_blocks_to_sections(
        self, 
        content_blocks: list[ContentBlock],
        structure: DocumentStructure
    ) -> dict[str, list[str]]:
        """Map content blocks to appropriate sections"""
        
    def resolve_content_dependencies(
        self, 
        structure: DocumentStructure,
        block_dependencies: dict[str, list[str]]
    ) -> list[DependencyConflict]:
        """Resolve conflicts between structure and content dependencies"""
```

## Error Handling Architecture

### Exception Hierarchy
```
StructureBuilderException
├── TemplateException
│   ├── TemplateNotFound
│   ├── TemplateInvalid
│   ├── TemplateCompilationError
│   └── TemplateVariableError
├── StructureException
│   ├── HierarchyInvalid
│   ├── SectionNotFound
│   ├── CircularDependency
│   └── DepthLimitExceeded
├── TOCException
│   ├── TOCGenerationError
│   ├── InvalidTOCConfiguration
│   └── TOCFormattingError
└── OutlineException
    ├── OutlineGenerationError
    ├── ExportFormatUnsupported
    └── SectionSummaryError
```

### Recovery Strategies
- **Template Fallback**: Use base templates when specialized templates fail
- **Partial Structure**: Generate valid partial structures when some sections fail
- **Graceful Degradation**: Provide basic structure when advanced features fail
- **Structure Repair**: Automatic repair of minor structure inconsistencies

This architecture provides a robust, scalable foundation for document structure management while maintaining high performance and seamless integration with the broader DocuFusion system.