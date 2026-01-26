# DocuFusion Usage Examples

Comprehensive examples for using the DocuFusion document generation system.

## Table of Contents

- [Quick Start](#quick-start)
- [Basic Document Generation](#basic-document-generation)
- [Multi-Format Output](#multi-format-output)
- [Advanced Configuration](#advanced-configuration)
- [Content Processing](#content-processing)
- [Performance Optimization](#performance-optimization)
- [Error Handling](#error-handling)
- [Real-World Examples](#real-world-examples)

## Quick Start

### Simple Document Generation

```python
import asyncio
from proposal_writer.document_engine.document_engine import (
    DocumentEngine, DocumentGenerationRequest, DocumentGenerationConfiguration
)

async def quick_start():
    # Create engine
    engine = DocumentEngine()
    
    # Configure generation
    config = DocumentGenerationConfiguration(
        document_title="My First Document",
        output_formats=["html", "pdf"]
    )
    
    # Create request
    request = DocumentGenerationRequest(
        content_sources=[
            {"content": "# Hello World\nThis is my first document!", "type": "markdown"}
        ],
        generation_config=config
    )
    
    # Generate document
    result = await engine.generate_document(request)
    
    if result.generation_successful:
        print(f"✓ Document generated successfully!")
        print(f"Quality score: {result.overall_quality_score:.2f}")
        print(f"Processing time: {result.processing_time:.2f}s")
    else:
        print(f"✗ Generation failed: {result.errors}")

# Run the example
asyncio.run(quick_start())
```

## Basic Document Generation

### HTML Document with Styling

```python
async def generate_styled_html():
    engine = DocumentEngine()
    
    # HTML content with embedded CSS
    html_content = """
    <h1>Professional Report</h1>
    <h2>Executive Summary</h2>
    <p>This report provides a comprehensive analysis of our findings.</p>
    
    <h2>Key Findings</h2>
    <ul>
        <li>Finding 1: Significant improvement in efficiency</li>
        <li>Finding 2: Cost reduction of 25%</li>
        <li>Finding 3: Customer satisfaction increased</li>
    </ul>
    
    <h2>Recommendations</h2>
    <p>Based on our analysis, we recommend the following actions:</p>
    <ol>
        <li>Implement new processes immediately</li>
        <li>Train staff on new procedures</li>
        <li>Monitor results quarterly</li>
    </ol>
    """
    
    css_content = """
    body { 
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
    }
    h1 { 
        color: #2c3e50;
        border-bottom: 3px solid #3498db;
        padding-bottom: 10px;
    }
    h2 { 
        color: #34495e;
        margin-top: 30px;
    }
    ul, ol {
        padding-left: 20px;
    }
    li {
        margin: 5px 0;
    }
    """
    
    # Configure for HTML with custom styling
    config = DocumentGenerationConfiguration(
        document_title="Professional Report",
        output_formats=["html"],
        enable_accessibility=True
    )
    
    request = DocumentGenerationRequest(
        content_sources=[
            {"content": html_content, "type": "html"},
            {"content": css_content, "type": "css"}
        ],
        generation_config=config
    )
    
    result = await engine.generate_document(request)
    return result

# Usage
result = await generate_styled_html()
```

### PDF Generation with LaTeX

```python
async def generate_pdf_with_latex():
    engine = DocumentEngine()
    
    # LaTeX content for high-quality PDF
    latex_content = r"""
    \documentclass[11pt,a4paper]{article}
    \usepackage[utf8]{inputenc}
    \usepackage{graphicx}
    \usepackage{hyperref}
    \usepackage{geometry}
    \geometry{margin=1in}
    
    \title{Technical Specification}
    \author{Engineering Team}
    \date{\today}
    
    \begin{document}
    \maketitle
    
    \section{Introduction}
    This document outlines the technical specifications for our new system.
    
    \section{Architecture}
    The system follows a microservices architecture with the following components:
    \begin{itemize}
        \item API Gateway
        \item Authentication Service  
        \item Data Processing Service
        \item Notification Service
    \end{itemize}
    
    \section{Performance Requirements}
    \begin{table}[h]
    \centering
    \begin{tabular}{|l|l|}
    \hline
    Metric & Requirement \\
    \hline
    Response Time & < 200ms \\
    Throughput & > 1000 req/s \\
    Availability & 99.9\% \\
    \hline
    \end{tabular}
    \caption{System Performance Requirements}
    \end{table}
    
    \end{document}
    """
    
    config = DocumentGenerationConfiguration(
        document_title="Technical Specification",
        output_formats=["pdf"]
    )
    
    request = DocumentGenerationRequest(
        content_sources=[
            {"content": latex_content, "type": "latex"}
        ],
        generation_config=config
    )
    
    result = await engine.generate_document(request)
    return result
```

## Multi-Format Output

### Generate Multiple Formats Simultaneously

```python
async def multi_format_generation():
    engine = DocumentEngine()
    
    # Markdown content that works well across all formats
    markdown_content = """
# Project Proposal

## Executive Summary

This proposal outlines a new initiative to improve our customer experience 
through digital transformation.

## Objectives

1. **Increase Customer Satisfaction** - Target 95% satisfaction rate
2. **Reduce Processing Time** - 50% reduction in average processing time  
3. **Improve Accessibility** - Full WCAG AA compliance

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Analysis | 2 weeks | Requirements document |
| Design | 4 weeks | System architecture |
| Development | 8 weeks | Working prototype |
| Testing | 2 weeks | Test results |

## Budget

The total project budget is **$150,000** broken down as follows:

- Development: $100,000 (67%)
- Testing: $30,000 (20%)  
- Infrastructure: $20,000 (13%)

## Next Steps

Please review this proposal and provide feedback by **Friday, July 25th**.

For questions, contact: project-team@company.com
"""
    
    # Configure for multiple output formats
    config = DocumentGenerationConfiguration(
        document_title="Project Proposal",
        output_formats=["html", "pdf", "docx"],
        enable_accessibility=True,
        enable_brand_compliance=True,
        output_directory="./output"
    )
    
    request = DocumentGenerationRequest(
        content_sources=[
            {"content": markdown_content, "type": "markdown"}
        ],
        generation_config=config,
        brand_specification={
            "primary_color": "#2c3e50",
            "secondary_color": "#3498db", 
            "font_family": "Segoe UI",
            "logo_url": "company-logo.png"
        }
    )
    
    result = await engine.generate_document(request)
    
    if result.generation_successful:
        print("✓ Multi-format generation successful!")
        for format_name, quality in result.format_quality_scores.items():
            print(f"  {format_name}: {quality:.2f} quality score")
        
        print(f"\nGenerated files:")
        for format_name, file_path in result.generated_documents.items():
            print(f"  {format_name}: {file_path}")
    
    return result

# Usage
result = await multi_format_generation()
```

## Advanced Configuration

### Enterprise Configuration

```python
async def enterprise_document_generation():
    # Enterprise-grade configuration
    config = DocumentGenerationConfiguration(
        # Document settings
        document_title="Enterprise Report Q3 2024",
        document_type="report",
        document_language="en",
        
        # Output configuration
        output_formats=["pdf", "html", "docx"],
        output_directory="/secure/reports",
        output_filename_template="{title}_v{version}_{timestamp}",
        
        # Quality requirements
        minimum_quality_score=0.95,
        accessibility_compliance_level="AAA",
        brand_compliance_threshold=0.90,
        
        # Performance settings
        enable_caching=True,
        parallel_processing=True,
        concurrent_renderers=4,
        max_processing_time=120.0,
        
        # Format-specific configurations
        pdf_config={
            "pdf_version": "1.7",
            "pdf_a_compliance": True,
            "password_protection": True,
            "owner_password": "secure_password_123",
            "dpi": 300,
            "font_embedding": True
        },
        html_config={
            "semantic_markup": True,
            "responsive_design": True,
            "include_meta_tags": True,
            "open_graph_enabled": True
        },
        accessibility_config={
            "target_wcag_level": "AAA",
            "auto_generate_alt_text": True,
            "enhance_aria_labels": True,
            "screen_reader_optimized": True
        }
    )
    
    # Enterprise content sources
    content_sources = [
        {
            "source_id": "executive_summary",
            "type": "markdown",
            "content": "# Executive Summary\nQ3 performance exceeded expectations...",
            "priority": 1
        },
        {
            "source_id": "financial_data", 
            "type": "html",
            "content": "<h2>Financial Performance</h2><table>...</table>",
            "priority": 2
        },
        {
            "source_id": "appendix",
            "type": "text", 
            "content": "Additional technical details...",
            "priority": 3
        }
    ]
    
    request = DocumentGenerationRequest(
        content_sources=content_sources,
        generation_config=config,
        
        # Brand requirements
        brand_specification={
            "company_name": "Enterprise Corp",
            "primary_color": "#1e3a8a",
            "secondary_color": "#3b82f6",
            "accent_color": "#f59e0b", 
            "font_primary": "Segoe UI",
            "font_heading": "Arial Black",
            "logo_path": "/assets/enterprise-logo.png",
            "watermark": "CONFIDENTIAL",
            "header_text": "Enterprise Corp - Q3 2024 Report",
            "footer_text": "© 2024 Enterprise Corp. All rights reserved."
        },
        
        # Compliance requirements
        accessibility_requirements={
            "wcag_level": "AAA",
            "section_508_compliance": True,
            "language_tags": True,
            "alt_text_required": True,
            "color_contrast_minimum": 7.0
        },
        
        # Security settings
        document_context={
            "classification": "confidential",
            "access_level": "internal",
            "retention_period": "7_years",
            "approval_required": True
        }
    )
    
    engine = DocumentEngine(enable_logging=True)
    result = await engine.generate_document(request)
    
    # Validate enterprise requirements
    if result.generation_successful:
        assert result.overall_quality_score >= 0.95
        assert result.accessibility_score >= 0.90
        assert result.brand_compliance_score >= 0.90
        print("✓ Enterprise requirements met")
    
    return result
```

## Content Processing

### Complex Content Assembly

```python
async def complex_content_assembly():
    engine = DocumentEngine()
    
    # Multiple content sources with different formats
    content_sources = [
        # Title page
        {
            "source_id": "title_page",
            "type": "html",
            "content": """
            <div class="title-page">
                <h1>Annual Report 2024</h1>
                <h2>Building the Future Together</h2>
                <p class="date">Published: July 2024</p>
                <img src="annual-report-cover.jpg" alt="Annual Report Cover" />
            </div>
            """,
            "priority": 1
        },
        
        # Table of contents (auto-generated)
        {
            "source_id": "toc",
            "type": "auto_toc",
            "content": "<!-- Auto-generated table of contents -->",
            "priority": 2
        },
        
        # Executive summary
        {
            "source_id": "executive_summary",
            "type": "markdown", 
            "content": """
# Executive Summary

## Financial Highlights
- Revenue: $2.4B (+15% YoY)
- Net Income: $340M (+22% YoY)  
- EBITDA: $480M (+18% YoY)

## Key Achievements
- Expanded into 12 new markets
- Launched 5 innovative products
- Achieved carbon neutrality goal
            """,
            "priority": 3
        },
        
        # Financial data with charts
        {
            "source_id": "financials",
            "type": "html",
            "content": """
            <h1>Financial Performance</h1>
            <div class="financial-charts">
                <div class="chart">
                    <h3>Revenue Growth</h3>
                    <canvas id="revenueChart" width="400" height="200"></canvas>
                </div>
                <div class="chart">
                    <h3>Profit Margins</h3>
                    <canvas id="marginChart" width="400" height="200"></canvas>
                </div>
            </div>
            """,
            "priority": 4
        },
        
        # Sustainability report
        {
            "source_id": "sustainability",
            "type": "markdown",
            "content": """
# Sustainability Report

## Environmental Impact
Our commitment to sustainability drove significant improvements:

### Carbon Footprint
- 45% reduction in Scope 1 emissions
- 30% reduction in Scope 2 emissions
- Carbon neutral operations achieved

### Waste Reduction  
- 60% reduction in landfill waste
- 85% recycling rate achieved
- Zero single-use plastics in offices

### Renewable Energy
- 100% renewable electricity
- Solar installations at 15 facilities
- Energy efficiency improvements of 25%
            """,
            "priority": 5
        }
    ]
    
    # Advanced configuration
    config = DocumentGenerationConfiguration(
        document_title="Annual Report 2024",
        document_type="report",
        output_formats=["pdf", "html"],
        
        # Enable advanced features
        enable_cross_references=True,
        enable_accessibility=True,
        enable_brand_compliance=True,
        
        # Content processing options
        assembly_config={
            "auto_generate_toc": True,
            "number_sections": True,
            "cross_reference_resolution": True,
            "content_validation": True
        },
        
        structure_config={
            "heading_hierarchy_validation": True,
            "section_balancing": True,
            "page_break_optimization": True
        }
    )
    
    request = DocumentGenerationRequest(
        content_sources=content_sources,
        generation_config=config,
        
        # Content structure specification
        content_structure={
            "sections": [
                {"id": "title_page", "type": "cover"},
                {"id": "toc", "type": "table_of_contents"},
                {"id": "executive_summary", "type": "summary"},
                {"id": "financials", "type": "data_section"},
                {"id": "sustainability", "type": "report_section"}
            ],
            "page_numbering": "roman_then_arabic",
            "section_breaks": "page"
        }
    )
    
    result = await engine.generate_document(request)
    return result
```

### Dynamic Content Generation

```python
async def dynamic_content_generation():
    """Generate documents with dynamic data"""
    
    # Simulate fetching data from database/API
    def get_sales_data():
        return {
            "q1_sales": 1200000,
            "q2_sales": 1350000, 
            "q3_sales": 1480000,
            "q4_sales": 1620000,
            "total_sales": 5650000,
            "growth_rate": 12.5,
            "top_products": [
                {"name": "Product A", "sales": 2200000},
                {"name": "Product B", "sales": 1800000},
                {"name": "Product C", "sales": 1650000}
            ]
        }
    
    data = get_sales_data()
    
    # Generate dynamic content
    executive_summary = f"""
# Sales Performance Report

## Executive Summary

We are pleased to report exceptional sales performance for the fiscal year, 
with total sales reaching **${data['total_sales']:,}**, representing a 
**{data['growth_rate']:.1f}%** increase over the previous year.

## Quarterly Performance

| Quarter | Sales | Growth |
|---------|-------|--------|
| Q1 | ${data['q1_sales']:,} | - |
| Q2 | ${data['q2_sales']:,} | {((data['q2_sales']/data['q1_sales']-1)*100):.1f}% |
| Q3 | ${data['q3_sales']:,} | {((data['q3_sales']/data['q2_sales']-1)*100):.1f}% |
| Q4 | ${data['q4_sales']:,} | {((data['q4_sales']/data['q3_sales']-1)*100):.1f}% |

## Top Performing Products
"""
    
    for i, product in enumerate(data['top_products'], 1):
        executive_summary += f"{i}. **{product['name']}**: ${product['sales']:,}\n"
    
    # Create content with dynamic data
    content_sources = [
        {
            "source_id": "dynamic_summary",
            "type": "markdown",
            "content": executive_summary,
            "priority": 1
        }
    ]
    
    config = DocumentGenerationConfiguration(
        document_title=f"Sales Report - Total: ${data['total_sales']:,}",
        output_formats=["html", "pdf"]
    )
    
    request = DocumentGenerationRequest(
        content_sources=content_sources,
        generation_config=config,
        
        # Add metadata for tracking
        document_context={
            "report_date": "2024-07-21",
            "data_source": "sales_database",
            "report_type": "quarterly_sales",
            "generated_by": "automated_system"
        }
    )
    
    engine = DocumentEngine()
    result = await engine.generate_document(request)
    return result
```

## Performance Optimization

### Performance Monitoring and Optimization

```python
async def performance_optimization_example():
    from proposal_writer.document_engine.performance_optimizer import (
        PerformanceOptimizer, create_performance_test_requests
    )
    
    # Create engine
    engine = DocumentEngine(enable_caching=True)
    
    # Create performance optimizer
    optimizer = PerformanceOptimizer(engine)
    
    # Create test requests for profiling
    test_requests = create_performance_test_requests()
    
    print("🔍 Profiling system performance...")
    
    # Profile current performance
    profile = await optimizer.profile_performance(test_requests, iterations=3)
    
    print(f"📊 Performance Results:")
    print(f"  Grade: {profile.performance_grade}")
    print(f"  Average Time: {profile.total_time:.3f}s")
    print(f"  Cache Efficiency: {profile.cache_efficiency:.1%}")
    print(f"  Bottlenecks: {', '.join(profile.bottleneck_components) or 'None'}")
    
    # Show component breakdown
    print(f"\n🔧 Component Performance:")
    for component, time_spent in sorted(profile.component_times.items(), key=lambda x: x[1], reverse=True):
        percentage = (time_spent / profile.total_time) * 100
        status = "🔴" if component in profile.bottleneck_components else "🟢"
        print(f"  {status} {component}: {time_spent:.4f}s ({percentage:.1f}%)")
    
    # Show recommendations
    print(f"\n💡 Optimization Recommendations:")
    for i, rec in enumerate(profile.optimization_recommendations, 1):
        print(f"  {i}. {rec}")
    
    # Apply optimizations
    if profile.performance_grade in ['C', 'D', 'F']:
        print(f"\n🚀 Applying optimizations...")
        optimization_result = await optimizer.apply_optimizations()
        
        print(f"✅ Optimizations Applied:")
        for opt in optimization_result.optimizations_applied:
            print(f"  ✓ {opt}")
        
        print(f"\n📈 Performance Improvement:")
        print(f"  Original: {optimization_result.original_time:.3f}s")
        print(f"  Optimized: {optimization_result.optimized_time:.3f}s")
        print(f"  Improvement: {optimization_result.improvement_percentage:.1f}%")
        print(f"  New Grade: {optimization_result.new_performance_grade}")
    
    # Generate performance report
    report_path = Path("performance_report.md")
    report = await optimizer.generate_performance_report(report_path)
    print(f"\n📄 Performance report saved to {report_path}")
    
    return profile, engine

# Usage
profile, optimized_engine = await performance_optimization_example()
```

### Batch Processing for High Throughput

```python
async def high_throughput_batch_processing():
    """Example of processing many documents efficiently"""
    
    engine = DocumentEngine(
        config=DocumentGenerationConfiguration(
            parallel_processing=True,
            concurrent_renderers=6,
            enable_caching=True
        )
    )
    
    # Create batch of document requests
    def create_batch_requests(count: int):
        requests = []
        for i in range(count):
            config = DocumentGenerationConfiguration(
                document_title=f"Report {i+1}",
                output_formats=["html", "pdf"],
                enable_accessibility=True
            )
            
            request = DocumentGenerationRequest(
                content_sources=[
                    {
                        "content": f"# Report {i+1}\n\nThis is report number {i+1} with sample content.",
                        "type": "markdown"
                    }
                ],
                generation_config=config
            )
            requests.append(request)
        
        return requests
    
    # Process in batches
    batch_size = 10
    total_documents = 50
    
    print(f"📦 Processing {total_documents} documents in batches of {batch_size}...")
    
    all_results = []
    start_time = time.time()
    
    for batch_num in range(0, total_documents, batch_size):
        batch_requests = create_batch_requests(batch_size)
        
        print(f"  Processing batch {batch_num//batch_size + 1}...")
        batch_results = await engine.generate_document_batch(batch_requests)
        all_results.extend(batch_results)
        
        # Show batch statistics
        successful = sum(1 for r in batch_results if r.generation_successful)
        avg_time = sum(r.processing_time for r in batch_results) / len(batch_results)
        print(f"    ✓ {successful}/{len(batch_results)} successful, avg: {avg_time:.3f}s")
    
    total_time = time.time() - start_time
    
    # Final statistics
    successful_total = sum(1 for r in all_results if r.generation_successful)
    success_rate = (successful_total / len(all_results)) * 100
    avg_processing_time = sum(r.processing_time for r in all_results) / len(all_results)
    throughput = len(all_results) / total_time
    
    print(f"\n📊 Batch Processing Results:")
    print(f"  Total Documents: {len(all_results)}")
    print(f"  Successful: {successful_total} ({success_rate:.1f}%)")
    print(f"  Total Time: {total_time:.2f}s")
    print(f"  Avg Processing Time: {avg_processing_time:.3f}s")
    print(f"  Throughput: {throughput:.1f} docs/second")
    
    return all_results
```

## Error Handling

### Robust Error Handling

```python
async def robust_document_generation():
    """Example of comprehensive error handling"""
    
    async def safe_generate_document(engine, request, max_retries=3):
        """Generate document with retry logic and error handling"""
        
        for attempt in range(max_retries):
            try:
                # Validate request first
                if not request.content_sources:
                    raise ValueError("No content sources provided")
                
                if not request.generation_config.output_formats:
                    raise ValueError("No output formats specified")
                
                # Attempt generation
                result = await engine.generate_document(request)
                
                # Check for partial success
                if result.generation_successful:
                    return result, "success", None
                elif result.format_quality_scores:
                    return result, "partial", f"Some formats failed: {result.errors}"
                else:
                    error_msg = f"Generation failed: {'; '.join(result.errors)}"
                    if attempt < max_retries - 1:
                        print(f"⚠️  Attempt {attempt + 1} failed, retrying: {error_msg}")
                        continue
                    else:
                        return result, "failed", error_msg
                        
            except DocumentEngineException as e:
                error_msg = f"Engine error: {e}"
                if attempt < max_retries - 1:
                    print(f"⚠️  Attempt {attempt + 1} failed, retrying: {error_msg}")
                    await asyncio.sleep(1)  # Brief delay before retry
                    continue
                else:
                    return None, "error", error_msg
                    
            except Exception as e:
                error_msg = f"Unexpected error: {e}"
                print(f"❌ Critical error: {error_msg}")
                return None, "critical", error_msg
        
        return None, "exhausted", "All retry attempts exhausted"
    
    # Example usage
    engine = DocumentEngine()
    
    # Create potentially problematic request
    config = DocumentGenerationConfiguration(
        document_title="Test Document",
        output_formats=["pdf", "html", "docx"],  # Multiple formats
        minimum_quality_score=0.9  # High quality requirement
    )
    
    request = DocumentGenerationRequest(
        content_sources=[
            {"content": "# Test\nSample content", "type": "markdown"}
        ],
        generation_config=config
    )
    
    # Attempt generation with error handling
    result, status, error = await safe_generate_document(engine, request)
    
    # Handle different outcomes
    if status == "success":
        print(f"✅ Document generated successfully!")
        print(f"   Quality: {result.overall_quality_score:.2f}")
        print(f"   Formats: {list(result.format_quality_scores.keys())}")
        
    elif status == "partial":
        print(f"⚠️  Document partially generated: {error}")
        print(f"   Successful formats: {list(result.format_quality_scores.keys())}")
        # Could still use partial results
        
    elif status == "failed":
        print(f"❌ Document generation failed: {error}")
        # Could fall back to simplified generation
        
    else:  # error or critical
        print(f"🚨 Critical failure: {error}")
        # Could alert administrators or log to monitoring system
    
    return result, status, error

# Usage
result, status, error = await robust_document_generation()
```

## Real-World Examples

### Complete Business Report Generation

```python
async def generate_business_report():
    """Complete example: Generate a professional business report"""
    
    # Sample data (would typically come from database/API)
    company_data = {
        "name": "TechCorp Industries",
        "quarter": "Q3 2024",
        "revenue": 48500000,
        "growth": 18.5,
        "employees": 1250,
        "departments": [
            {"name": "Engineering", "employees": 450, "budget": 12000000},
            {"name": "Sales", "employees": 280, "budget": 8500000},
            {"name": "Marketing", "employees": 120, "budget": 4200000},
            {"name": "Operations", "employees": 400, "budget": 6800000}
        ],
        "key_metrics": {
            "customer_satisfaction": 94.2,
            "employee_retention": 91.8,
            "market_share": 23.1
        }
    }
    
    # Generate executive summary
    exec_summary = f"""
# {company_data['name']} - {company_data['quarter']} Business Report

## Executive Summary

We are pleased to present our {company_data['quarter']} business report, highlighting 
exceptional performance across all key metrics.

### Financial Highlights
- **Total Revenue**: ${company_data['revenue']:,}
- **Growth Rate**: {company_data['growth']:.1f}% year-over-year
- **Team Size**: {company_data['employees']} employees

### Key Performance Indicators
- **Customer Satisfaction**: {company_data['key_metrics']['customer_satisfaction']:.1f}%
- **Employee Retention**: {company_data['key_metrics']['employee_retention']:.1f}%
- **Market Share**: {company_data['key_metrics']['market_share']:.1f}%

## Departmental Overview
"""
    
    # Add department details
    for dept in company_data['departments']:
        budget_percentage = (dept['budget'] / company_data['revenue']) * 100
        exec_summary += f"""
### {dept['name']} Department
- **Team Size**: {dept['employees']} employees
- **Budget**: ${dept['budget']:,} ({budget_percentage:.1f}% of revenue)
- **Budget per Employee**: ${dept['budget'] // dept['employees']:,}
"""
    
    # Create detailed financial section
    financial_section = """
# Financial Performance Analysis

## Revenue Breakdown by Department

The following table shows revenue attribution and budget allocation:

| Department | Team Size | Budget | Budget % | Per Employee |
|------------|-----------|---------|----------|--------------|
"""
    
    for dept in company_data['departments']:
        budget_pct = (dept['budget'] / company_data['revenue']) * 100
        per_employee = dept['budget'] // dept['employees']
        financial_section += f"| {dept['name']} | {dept['employees']} | ${dept['budget']:,} | {budget_pct:.1f}% | ${per_employee:,} |\n"
    
    financial_section += """

## Growth Analysis

Our {:.1f}% growth rate significantly exceeds industry averages of 12.3%, 
positioning us as a market leader in our sector.

### Contributing Factors
1. **Innovation**: Launched 3 new products this quarter
2. **Market Expansion**: Entered 2 new geographic markets  
3. **Operational Efficiency**: Reduced costs by 8.5%
4. **Customer Focus**: Improved satisfaction by 4.2 points
""".format(company_data['growth'])
    
    # Operational excellence section
    operations_section = """
# Operational Excellence

## Employee Engagement

With a retention rate of {:.1f}%, we continue to be an employer of choice:

- **Professional Development**: 40 hours of training per employee
- **Work-Life Balance**: Flexible working arrangements for 85% of roles
- **Compensation**: Market-leading salary packages
- **Benefits**: Comprehensive health and wellness programs

## Quality Metrics

Our commitment to quality drives customer satisfaction of {:.1f}%:

- **Product Quality**: 99.2% first-time success rate
- **Customer Support**: Average response time under 2 hours
- **Delivery Performance**: 98.7% on-time delivery rate
- **Innovation Index**: 15 patents filed this quarter

## Future Outlook

Based on current trends and market conditions, we project:

- **Q4 Revenue Target**: ${:,}
- **Annual Growth Projection**: {:.1f}%
- **Team Expansion**: 150 new hires planned
- **Market Share Goal**: {:.1f}% by year-end
""".format(
        company_data['key_metrics']['employee_retention'],
        company_data['key_metrics']['customer_satisfaction'],
        int(company_data['revenue'] * 1.12),  # Q4 projection
        company_data['growth'] + 2.0,  # Annual projection
        company_data['key_metrics']['market_share'] + 1.5  # Market share goal
    )
    
    # Configure professional document generation
    config = DocumentGenerationConfiguration(
        document_title=f"{company_data['name']} - {company_data['quarter']} Business Report",
        document_type="report",
        output_formats=["pdf", "html", "docx"],
        
        # Professional quality settings
        minimum_quality_score=0.9,
        enable_accessibility=True,
        enable_brand_compliance=True,
        
        # Output configuration
        output_directory="./business_reports",
        output_filename_template="{title}_{timestamp}",
        
        # Performance settings
        parallel_processing=True,
        enable_caching=True
    )
    
    # Create comprehensive request
    request = DocumentGenerationRequest(
        content_sources=[
            {
                "source_id": "executive_summary",
                "type": "markdown",
                "content": exec_summary,
                "priority": 1
            },
            {
                "source_id": "financial_analysis", 
                "type": "markdown",
                "content": financial_section,
                "priority": 2
            },
            {
                "source_id": "operations",
                "type": "markdown", 
                "content": operations_section,
                "priority": 3
            }
        ],
        generation_config=config,
        
        # Corporate branding
        brand_specification={
            "company_name": company_data['name'],
            "primary_color": "#1e40af",      # Corporate blue
            "secondary_color": "#059669",    # Success green  
            "accent_color": "#dc2626",       # Alert red
            "font_primary": "Segoe UI",
            "font_heading": "Arial Black",
            "logo_path": "corporate_logo.png",
            "header_text": f"{company_data['name']} - Confidential",
            "footer_text": "© 2024 TechCorp Industries. All rights reserved.",
            "watermark": "BUSINESS CONFIDENTIAL"
        },
        
        # Professional metadata
        document_context={
            "classification": "business_confidential",
            "department": "executive",
            "report_period": company_data['quarter'],
            "approval_level": "c_suite",
            "distribution": "board_members",
            "retention_years": 7
        }
    )
    
    # Generate the report
    engine = DocumentEngine(enable_logging=True)
    
    print(f"📊 Generating {company_data['quarter']} business report for {company_data['name']}...")
    
    result = await engine.generate_document(request)
    
    if result.generation_successful:
        print(f"✅ Business report generated successfully!")
        print(f"   📈 Overall Quality Score: {result.overall_quality_score:.2f}")
        print(f"   ♿ Accessibility Score: {result.accessibility_score:.2f}")
        print(f"   🎨 Brand Compliance: {result.brand_compliance_score:.2f}")
        print(f"   ⏱️  Processing Time: {result.processing_time:.2f}s")
        
        print(f"\n📄 Generated Files:")
        for format_name, file_path in result.generated_documents.items():
            print(f"   {format_name.upper()}: {file_path}")
        
        print(f"\n📊 Format Quality Scores:")
        for format_name, score in result.format_quality_scores.items():
            print(f"   {format_name}: {score:.2f}")
            
    else:
        print(f"❌ Report generation failed:")
        for error in result.errors:
            print(f"   • {error}")
    
    return result

# Usage
business_report_result = await generate_business_report()
```

### Academic Paper Generation

```python
async def generate_academic_paper():
    """Generate a properly formatted academic paper"""
    
    # Academic content with proper citations
    abstract = """
# Abstract

This paper presents a comprehensive analysis of machine learning applications 
in document generation systems. We propose a novel approach that combines 
natural language processing with automated formatting to create high-quality 
documents across multiple output formats. Our evaluation shows significant 
improvements in generation speed (40% faster) and quality scores (15% higher) 
compared to existing systems.

**Keywords**: document generation, machine learning, natural language processing, automated formatting
"""
    
    introduction = """
# 1. Introduction

Document generation has become increasingly important in modern information systems. 
Traditional approaches rely on manual formatting and template-based systems, which 
are time-consuming and error-prone [@Smith2023; @Jones2022].

Recent advances in machine learning have opened new possibilities for intelligent 
document creation [@Wilson2024]. This paper contributes:

1. A unified framework for multi-format document generation
2. Performance optimizations for large-scale processing
3. Comprehensive evaluation against existing approaches
4. Open-source implementation for reproducibility

## 1.1 Problem Statement

Current document generation systems face several challenges:
- **Format Inconsistency**: Output varies across different formats
- **Poor Accessibility**: Limited support for assistive technologies  
- **Performance Issues**: Slow processing for complex documents
- **Maintenance Overhead**: Complex template management

## 1.2 Research Questions

This work addresses the following research questions:
1. How can we create consistent output across PDF, HTML, and DOCX formats?
2. What optimizations most effectively improve generation performance?
3. How does our approach compare to existing commercial solutions?
"""
    
    methodology = """
# 2. Methodology

## 2.1 System Architecture

Our system employs a multi-stage pipeline consisting of:

1. **Content Assembly**: Aggregation and preprocessing of source materials
2. **Structure Building**: Hierarchical organization and cross-reference resolution
3. **Format Application**: Style and layout processing 
4. **Multi-Format Rendering**: Parallel generation across target formats

## 2.2 Evaluation Framework

We evaluate our system using the following metrics:

- **Processing Time**: End-to-end generation latency
- **Quality Score**: Automated assessment of output quality (0-1 scale)
- **Accessibility Score**: WCAG compliance measurement
- **Format Consistency**: Cross-format similarity analysis

### 2.2.1 Test Dataset

Our evaluation uses 500 documents spanning:
- Academic papers (150 documents)
- Business reports (150 documents)  
- Technical specifications (100 documents)
- Marketing materials (100 documents)

### 2.2.2 Baseline Systems

We compare against three baseline systems:
- **Commercial System A**: Leading enterprise solution
- **Commercial System B**: Popular cloud-based platform
- **Open Source Tool**: Academic reference implementation
"""
    
    results = """
# 3. Results

## 3.1 Performance Analysis

Table 1 shows comparative performance across different document types:

| Document Type | Our System | System A | System B | Open Source |
|---------------|------------|----------|----------|-------------|
| Academic (avg) | 2.3s | 3.8s | 4.1s | 5.2s |
| Business (avg) | 1.8s | 2.9s | 3.2s | 4.1s |
| Technical (avg) | 3.1s | 4.9s | 5.3s | 6.8s |
| Marketing (avg) | 1.5s | 2.2s | 2.7s | 3.4s |

*Table 1: Average processing times by document type*

## 3.2 Quality Assessment

Our quality scoring algorithm evaluates multiple dimensions:

- **Content Fidelity**: Preservation of source formatting (Weight: 30%)
- **Visual Consistency**: Cross-format appearance similarity (Weight: 25%)
- **Accessibility**: WCAG compliance level (Weight: 25%)
- **Technical Correctness**: Valid output format specification (Weight: 20%)

Results show consistent quality improvements:
- Average quality score: 0.94 (vs 0.82 baseline average)
- Accessibility compliance: 96.2% (vs 78.1% baseline)
- Format consistency: 0.91 correlation (vs 0.73 baseline)

## 3.3 Statistical Significance

Using paired t-tests (α = 0.05), we find statistically significant improvements in:
- Processing time: p < 0.001, Cohen's d = 1.8 (large effect)
- Quality scores: p < 0.001, Cohen's d = 1.4 (large effect)  
- Accessibility: p < 0.001, Cohen's d = 2.1 (large effect)
"""
    
    conclusion = """
# 4. Conclusion

This paper presented a novel approach to automated document generation that 
achieves significant improvements in performance, quality, and accessibility 
compared to existing solutions.

## 4.1 Key Contributions

1. **Unified Architecture**: Single system generating multiple output formats
2. **Performance Optimization**: 40% average speedup over commercial alternatives
3. **Quality Improvement**: 15% higher quality scores with 96.2% accessibility compliance
4. **Open Implementation**: Full source code available for reproducibility

## 4.2 Limitations

Current limitations include:
- LaTeX dependency for advanced PDF features
- Memory usage scales linearly with document size
- Limited support for non-Latin scripts

## 4.3 Future Work

Future research directions include:
- Integration with large language models for content generation
- Support for interactive and multimedia document formats
- Cloud-native scaling for enterprise deployments
- Real-time collaborative editing capabilities

# References

[1] Smith, J. et al. (2023). "Document Generation in Enterprise Environments." 
    *Journal of Information Systems*, 45(3), 234-251.

[2] Jones, M. & Brown, L. (2022). "Template-Based Approaches to Document Creation." 
    *ACM Computing Surveys*, 54(2), 1-28.

[3] Wilson, K. (2024). "Machine Learning for Document Processing: A Survey." 
    *IEEE Transactions on Knowledge and Data Engineering*, 36(4), 445-462.
"""
    
    # Academic configuration
    config = DocumentGenerationConfiguration(
        document_title="Intelligent Document Generation: A Machine Learning Approach",
        document_type="academic_paper",
        output_formats=["pdf", "html"],
        
        # Academic quality requirements
        minimum_quality_score=0.95,
        enable_accessibility=True,
        
        # Academic formatting
        pdf_config={
            "pdf_version": "1.7",
            "font_embedding": True,
            "latex_engine": "pdflatex",
            "enable_latex_fallback": True
        }
    )
    
    request = DocumentGenerationRequest(
        content_sources=[
            {"source_id": "abstract", "type": "markdown", "content": abstract, "priority": 1},
            {"source_id": "intro", "type": "markdown", "content": introduction, "priority": 2},
            {"source_id": "methods", "type": "markdown", "content": methodology, "priority": 3},
            {"source_id": "results", "type": "markdown", "content": results, "priority": 4},
            {"source_id": "conclusion", "type": "markdown", "content": conclusion, "priority": 5}
        ],
        generation_config=config,
        
        # Academic metadata
        document_context={
            "document_type": "research_paper",
            "field": "computer_science",
            "subfield": "document_processing",
            "publication_venue": "conference",
            "peer_reviewed": True,
            "citation_style": "ieee"
        }
    )
    
    engine = DocumentEngine()
    result = await engine.generate_document(request)
    
    if result.generation_successful:
        print("📄 Academic paper generated successfully!")
        print(f"Quality score: {result.overall_quality_score:.3f}")
    
    return result

# Usage
academic_result = await generate_academic_paper()
```

---

These examples demonstrate the full capabilities of the DocuFusion document generation system, from simple documents to complex enterprise reports and academic papers. The system handles multiple content formats, applies consistent styling, ensures accessibility compliance, and provides comprehensive performance monitoring.