# StyleApplier Module - Architecture Documentation

## Architectural Overview

The StyleApplier module implements a sophisticated brand styling engine that ensures consistent visual identity across all DocuFusion documents. It provides professional color management, typography application, and brand guideline enforcement while maintaining high performance and cross-format compatibility.

## Core Architecture Pattern

### 1. Style Application Pipeline
```
Style Application Engine
├── Color Management System
│   ├── Brand Palette Definition
│   ├── Color Space Conversion (RGB, HSL, CMYK)
│   ├── Accessibility Validation (WCAG)
│   └── Format-Specific Export (LaTeX, CSS, PDF)
├── Typography Engine
│   ├── Font Family Resolution
│   ├── Font Loading and Validation
│   ├── Typography Scale Calculation
│   └── Cross-Platform Font Fallbacks
├── Style Rule Processor
│   ├── CSS-like Rule Parsing
│   ├── Specificity and Cascade Resolution
│   ├── Responsive Style Adaptation
│   └── Performance Caching
└── Brand Compliance Validator
    ├── Guideline Rule Engine
    ├── Accessibility Checking
    ├── Consistency Validation
    └── Quality Assurance Reporting
```

### 2. Color Management Architecture
```
Color Management System
├── Palette Management
│   ├── Primary Color Definition
│   ├── Secondary and Accent Colors
│   ├── Neutral and Semantic Colors
│   └── Dynamic Color Generation
├── Color Space Operations
│   ├── Format Conversion (HEX, RGB, HSL, CMYK)
│   ├── Color Manipulation (lighten, darken, saturate)
│   ├── Harmony Generation (triadic, complementary)
│   └── Accessibility Enhancement
├── Contrast Validation
│   ├── WCAG 2.1 Compliance Checking
│   ├── Automatic Contrast Adjustment
│   ├── Color Blindness Simulation
│   └── Readability Optimization
└── Format Export
    ├── LaTeX Color Definitions
    ├── CSS Custom Properties
    ├── PDF Color Profiles
    └── SVG Color Schemes
```

## Data Models

### ColorPalette
```python
@dataclass
class ColorPalette:
    """Brand color palette with accessibility validation"""
    # Core brand colors
    primary: str  # Main brand color
    secondary: str = ""  # Secondary brand color
    accent: str = ""  # Accent/highlight color
    
    # Text colors
    text_primary: str = "#000000"
    text_secondary: str = "#666666"
    text_muted: str = "#999999"
    
    # Background colors
    background_primary: str = "#ffffff"
    background_secondary: str = "#f5f5f5"
    background_accent: str = "#f0f0f0"
    
    # Semantic colors
    success: str = "#22c55e"
    warning: str = "#f59e0b" 
    error: str = "#ef4444"
    info: str = "#3b82f6"
    
    # Metadata
    palette_name: str = "default"
    description: str = ""
    accessibility_level: str = "AA"  # A, AA, AAA
    
    # Validation results
    contrast_ratios: dict[str, float] = Field(default_factory=dict)
    accessibility_compliant: bool = True
    validation_errors: list[str] = Field(default_factory=list)
```

### TypographyProfile
```python
@dataclass
class TypographyProfile:
    """Typography configuration with font management"""
    # Font families
    primary_font: str = "Inter"  # Main text font
    heading_font: str = "Inter"  # Heading font
    code_font: str = "JetBrains Mono"  # Monospace font
    accent_font: str = ""  # Special accent font
    
    # Font sources
    font_sources: dict[str, str] = Field(default_factory=dict)  # font_name -> source_url
    fallback_fonts: dict[str, list[str]] = Field(default_factory=dict)
    
    # Typography scale
    base_font_size: str = "16px"
    scale_ratio: float = 1.25  # Major third scale
    font_sizes: dict[str, str] = Field(default_factory=dict)  # h1, h2, body, etc.
    
    # Line heights
    base_line_height: float = 1.5
    line_heights: dict[str, float] = Field(default_factory=dict)
    
    # Font weights
    font_weights: dict[str, str] = Field(default_factory=dict)  # light, normal, bold, etc.
    
    # Advanced typography
    letter_spacing: dict[str, str] = Field(default_factory=dict)
    text_rendering: str = "optimizeLegibility"
    font_smoothing: str = "antialiased"
    
    # Format-specific settings
    latex_packages: list[str] = Field(default_factory=list)
    web_font_display: str = "swap"
    
    # Validation
    fonts_available: dict[str, bool] = Field(default_factory=dict)
    loading_performance: dict[str, float] = Field(default_factory=dict)
```

### StyleRule
```python
@dataclass
class StyleRule:
    """Enhanced style rule with brand application"""
    # Basic rule properties
    selector: str
    properties: dict[str, Any]
    specificity: int = 0
    
    # Brand enhancement flags
    apply_brand_colors: bool = True
    apply_brand_fonts: bool = True
    enforce_accessibility: bool = True
    
    # Responsive behavior
    responsive_properties: dict[str, dict[str, Any]] = Field(default_factory=dict)
    breakpoints: list[str] = Field(default_factory=list)
    
    # Brand compliance
    brand_compliant: bool = True
    compliance_score: float = 1.0
    compliance_issues: list[str] = Field(default_factory=list)
    
    # Performance optimization
    cacheable: bool = True
    cache_key: str = ""
    last_applied: datetime = Field(default_factory=datetime.now)
```

### BrandGuidelines
```python
@dataclass
class BrandGuidelines:
    """Brand guideline rules and validation criteria"""
    # Visual identity
    brand_name: str
    logo_requirements: dict[str, Any] = Field(default_factory=dict)
    color_palette: ColorPalette = Field(default_factory=ColorPalette)
    typography: TypographyProfile = Field(default_factory=TypographyProfile)
    
    # Design rules
    spacing_rules: dict[str, str] = Field(default_factory=dict)
    layout_constraints: dict[str, Any] = Field(default_factory=dict)
    element_styles: dict[str, dict[str, Any]] = Field(default_factory=dict)
    
    # Accessibility requirements
    min_contrast_ratio: float = 4.5
    font_size_minimums: dict[str, str] = Field(default_factory=dict)
    touch_target_sizes: dict[str, str] = Field(default_factory=dict)
    
    # Quality standards
    image_resolution_requirements: dict[str, int] = Field(default_factory=dict)
    text_readability_score: float = 0.8
    
    # Validation rules
    validation_rules: list[dict[str, Any]] = Field(default_factory=list)
    auto_corrections: dict[str, Any] = Field(default_factory=dict)
```

## Component Architecture

### 1. ColorManager
```python
class ColorManager:
    """Advanced color management with accessibility validation"""
    
    def __init__(self, palette: ColorPalette):
        self.palette = palette
        self.color_cache = {}
        self.contrast_cache = {}
    
    def apply_brand_colors(self, style: ComputedStyle) -> ComputedStyle:
        """Apply brand colors to computed style"""
        
    def validate_contrast(self, foreground: str, background: str) -> float:
        """Calculate WCAG contrast ratio"""
        
    def generate_color_variations(self, base_color: str, count: int = 5) -> list[str]:
        """Generate color variations (tints, shades)"""
        
    def convert_color_format(self, color: str, target_format: str) -> str:
        """Convert between color formats (HEX, RGB, HSL, etc.)"""
        
    def export_latex_colors(self) -> str:
        """Generate LaTeX color definitions"""
        
    def export_css_variables(self) -> str:
        """Generate CSS custom properties"""
```

### 2. TypographyManager
```python
class TypographyManager:
    """Typography application and font management"""
    
    def __init__(self, profile: TypographyProfile):
        self.profile = profile
        self.font_cache = {}
        self.size_cache = {}
    
    def apply_typography(self, style: ComputedStyle, element_type: str) -> ComputedStyle:
        """Apply typography settings to style"""
        
    def calculate_font_size(self, level: int, base_size: str = None) -> str:
        """Calculate font size using typography scale"""
        
    def resolve_font_stack(self, font_family: str) -> str:
        """Build complete font stack with fallbacks"""
        
    def validate_font_availability(self, font_family: str) -> bool:
        """Check if font is available on system"""
        
    def generate_latex_fonts(self) -> str:
        """Generate LaTeX font package imports"""
        
    def generate_css_fonts(self) -> str:
        """Generate CSS font declarations"""
```

### 3. BrandCompliance
```python
class BrandCompliance:
    """Brand guideline enforcement and validation"""
    
    def __init__(self, guidelines: BrandGuidelines):
        self.guidelines = guidelines
        self.validation_cache = {}
    
    def validate_style_compliance(self, style: ComputedStyle) -> ComplianceResult:
        """Validate style against brand guidelines"""
        
    def auto_correct_violations(self, style: ComputedStyle) -> ComputedStyle:
        """Apply automatic corrections for guideline violations"""
        
    def generate_compliance_report(self, styles: list[ComputedStyle]) -> ComplianceReport:
        """Generate comprehensive compliance report"""
        
    def check_accessibility_compliance(self, style: ComputedStyle) -> AccessibilityResult:
        """Validate accessibility requirements"""
```

### 4. StyleApplier (Main Class)
```python
class StyleApplier:
    """Main style application engine with brand enhancement"""
    
    def __init__(
        self,
        color_manager: ColorManager,
        typography_manager: TypographyManager,
        brand_compliance: BrandCompliance
    ):
        self.color_manager = color_manager
        self.typography_manager = typography_manager
        self.brand_compliance = brand_compliance
        self.style_cache = {}
        
        # Performance metrics
        self.metrics = {
            'styles_applied': 0,
            'cache_hits': 0,
            'compliance_violations': 0,
            'auto_corrections': 0
        }
    
    async def apply_brand_styles(
        self,
        computed_styles: list[ComputedStyle],
        brand_guidelines: BrandGuidelines,
        responsive_config: ResponsiveConfiguration = None
    ) -> StyleApplicationResult:
        """Apply brand styling to computed styles"""
        
    async def enhance_computed_style(
        self,
        style: ComputedStyle,
        element_type: str,
        context: dict[str, Any] = None
    ) -> ComputedStyle:
        """Enhance single computed style with brand application"""
        
    def generate_format_specific_styles(
        self,
        styles: list[ComputedStyle],
        output_format: str
    ) -> FormatSpecificStyles:
        """Generate format-specific style definitions"""
        
    async def validate_and_correct_styles(
        self,
        styles: list[ComputedStyle]
    ) -> ValidationResult:
        """Validate styles and apply corrections"""
```

## Integration Architecture

### With DocumentFormatter
```python
class DocumentFormatterIntegration:
    """Integration layer with DocumentFormatter"""
    
    async def enhance_formatting_result(
        self,
        result: FormattingResult,
        brand_guidelines: BrandGuidelines
    ) -> FormattingResult:
        """Enhance DocumentFormatter result with brand styling"""
        
    def coordinate_responsive_styles(
        self,
        base_styles: list[ComputedStyle],
        responsive_config: ResponsiveConfiguration
    ) -> list[ComputedStyle]:
        """Coordinate responsive behavior with DocumentFormatter"""
```

### With LaTeX Formatter
```python
class LaTeXStyleIntegration:
    """LaTeX-specific style generation"""
    
    def generate_brand_preamble(self, guidelines: BrandGuidelines) -> str:
        """Generate LaTeX preamble with brand colors and fonts"""
        
    def apply_latex_styling(
        self,
        latex_blocks: list[LaTeXContentBlock],
        brand_guidelines: BrandGuidelines
    ) -> list[LaTeXContentBlock]:
        """Apply brand styling to LaTeX content blocks"""
```

## Performance Architecture

### Caching Strategy
```python
class StyleCache:
    """Multi-level caching for style operations"""
    
    # L1: Computed brand styles (1000 entries)
    brand_style_cache: dict[str, ComputedStyle]
    
    # L2: Color calculations (500 entries)  
    color_cache: dict[str, ColorResult]
    
    # L3: Typography computations (200 entries)
    typography_cache: dict[str, TypographyResult]
    
    # L4: Compliance validations (100 entries)
    compliance_cache: dict[str, ComplianceResult]
```

### Async Processing
```python
class AsyncStyleProcessor:
    """Asynchronous style processing for performance"""
    
    async def parallel_style_application(
        self,
        styles: list[ComputedStyle],
        guidelines: BrandGuidelines
    ) -> list[ComputedStyle]:
        """Apply brand styles in parallel"""
        
    async def batch_compliance_validation(
        self,
        styles: list[ComputedStyle]
    ) -> list[ComplianceResult]:
        """Validate compliance in optimized batches"""
```

## Quality Assurance Architecture

### Accessibility Validation
```python
class AccessibilityValidator:
    """WCAG 2.1 compliance validation"""
    
    def validate_color_contrast(self, fg: str, bg: str) -> ContrastResult:
        """Validate color contrast ratios"""
        
    def check_font_readability(self, typography: TypographyProfile) -> ReadabilityResult:
        """Validate font sizes and readability"""
        
    def generate_accessibility_report(self, styles: list[ComputedStyle]) -> AccessibilityReport:
        """Generate comprehensive accessibility report"""
```

### Brand Consistency
```python
class ConsistencyChecker:
    """Brand consistency validation across documents"""
    
    def validate_color_usage(self, styles: list[ComputedStyle]) -> ConsistencyResult:
        """Check consistent color application"""
        
    def validate_typography_hierarchy(self, styles: list[ComputedStyle]) -> TypographyResult:
        """Validate typography hierarchy consistency"""
        
    def detect_style_anomalies(self, styles: list[ComputedStyle]) -> list[StyleAnomaly]:
        """Detect inconsistent or anomalous styling"""
```

This StyleApplier architecture provides comprehensive brand styling capabilities while maintaining high performance, accessibility compliance, and seamless integration with DocuFusion's document generation pipeline.