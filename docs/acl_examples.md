# Agent Composition Language (ACL) Examples

This document provides practical examples of ACL compositions for various use cases, from simple workflows to complex enterprise scenarios.

## Table of Contents

1. [Basic Examples](#basic-examples)
2. [Content Creation Workflows](#content-creation-workflows)
3. [Data Processing Pipelines](#data-processing-pipelines)
4. [Quality Assurance Workflows](#quality-assurance-workflows)
5. [Complex Enterprise Scenarios](#complex-enterprise-scenarios)
6. [Error Handling Patterns](#error-handling-patterns)
7. [Performance Optimization Examples](#performance-optimization-examples)
8. [Integration Examples](#integration-examples)

## Basic Examples

### 1. Simple Sequential Workflow

The most basic ACL composition with two agents in sequence:

```yaml
composition:
  name: "Simple Research and Write"
  version: "1.0"
  description: "Basic research followed by content creation"

config:
  timeout: 300
  max_retries: 2

context:
  topic: "${input.topic}"
  word_count: "${input.word_count || 500}"

agents:
  researcher:
    type: "research_agent"
    model: "qwen2.5:7b"
    temperature: 0.3
    prompt: |
      Research the topic: {topic}
      
      Provide:
      - Key facts and statistics
      - Recent developments
      - Expert opinions
      - Credible sources
      
      Focus on accuracy and reliability.
    tools: ["web_search", "academic_search"]
    timeout: 180

  content_writer:
    type: "content_agent"
    model: "qwen2.5:7b"
    temperature: 0.7
    prompt: |
      Create engaging content based on the research findings.
      
      Topic: {topic}
      Target length: {word_count} words
      Research findings: {researcher.output}
      
      Requirements:
      - Clear and engaging writing
      - Well-structured with headers
      - Include key statistics from research
      - Professional tone
    timeout: 120

flow:
  main_workflow:
    sequence: |
      researcher -> content_writer
```

**Usage**:
```python
input_data = {
    "topic": "Renewable Energy Trends 2025",
    "word_count": 800
}
```

### 2. Parallel Processing Example

Multiple agents working simultaneously:

```yaml
composition:
  name: "Parallel Market Analysis"
  version: "1.0"

agents:
  market_researcher:
    type: "research_agent"
    temperature: 0.2
    prompt: "Market size and growth analysis for: {topic}"

  competitor_analyst:
    type: "analysis_agent"
    temperature: 0.2
    prompt: "Competitive landscape analysis for: {topic}"

  trend_analyst:
    type: "analysis_agent"
    temperature: 0.3
    prompt: "Industry trends and forecasts for: {topic}"

  synthesis_agent:
    type: "synthesis_agent"
    temperature: 0.5
    prompt: |
      Synthesize market analysis from multiple sources:
      
      Market Research: {market_researcher.output}
      Competitor Analysis: {competitor_analyst.output}
      Trend Analysis: {trend_analyst.output}
      
      Create comprehensive market overview.

flow:
  parallel_analysis:
    sequence: |
      (market_researcher || competitor_analyst || trend_analyst) & synthesis_agent
```

## Content Creation Workflows

### 3. Blog Post Creation Pipeline

Complete blog post creation with research, writing, and optimization:

```yaml
composition:
  name: "Blog Post Creation Pipeline"
  version: "1.0"
  description: "End-to-end blog post creation with SEO optimization"

config:
  timeout: 900
  parallelism: 3

context:
  topic: "${input.topic}"
  target_audience: "${input.audience}"
  keyword: "${input.primary_keyword}"
  word_count: "${input.word_count || 1200}"

agents:
  topic_researcher:
    type: "research_agent"
    temperature: 0.3
    prompt: |
      Research comprehensive information about: {topic}
      
      Target audience: {target_audience}
      Primary keyword: {keyword}
      
      Focus on:
      - Current trends and developments
      - Expert opinions and quotes
      - Statistics and data
      - Common questions and pain points
      - Related subtopics
    tools: ["web_search", "social_media_trends", "expert_database"]

  seo_researcher:
    type: "seo_agent"
    temperature: 0.2
    prompt: |
      SEO research for keyword: {keyword}
      Topic: {topic}
      
      Provide:
      - Related keywords and phrases
      - Search intent analysis
      - Content gaps in existing articles
      - Recommended headings structure
      - Meta description suggestions
    tools: ["keyword_research", "serp_analysis"]

  content_writer:
    type: "content_agent"
    temperature: 0.7
    prompt: |
      Write an engaging blog post based on research:
      
      Topic: {topic}
      Target audience: {target_audience}
      Primary keyword: {keyword}
      Target length: {word_count} words
      
      Research findings: {topic_researcher.output}
      SEO guidelines: {seo_researcher.output}
      
      Requirements:
      - Engaging introduction with hook
      - Clear structure with H2/H3 headings
      - Include statistics and examples
      - Natural keyword integration
      - Strong conclusion with call-to-action
      - Conversational but professional tone

  editor:
    type: "editor_agent"
    temperature: 0.3
    prompt: |
      Edit and improve the blog post for:
      
      - Grammar and spelling
      - Clarity and flow
      - Consistency in tone
      - SEO optimization
      - Readability score improvement
      
      Original content: {content_writer.output}
      SEO requirements: {seo_researcher.output}

  meta_optimizer:
    type: "seo_agent"
    temperature: 0.2
    prompt: |
      Create SEO metadata for the blog post:
      
      Content: {editor.output}
      Primary keyword: {keyword}
      
      Generate:
      - SEO title (55-60 characters)
      - Meta description (150-160 characters)
      - Social media titles and descriptions
      - Suggested tags

flow:
  blog_creation:
    sequence: |
      (topic_researcher || seo_researcher) & content_writer -> editor -> meta_optimizer

transformations:
  final_blog_post:
    type: "template"
    template: |
      # Blog Post: {context.topic}
      
      ## SEO Metadata
      **Title**: {meta_optimizer.seo_title}
      **Description**: {meta_optimizer.meta_description}
      **Keywords**: {context.keyword}, {meta_optimizer.related_keywords}
      
      ## Content
      {editor.output}
      
      ## Additional Elements
      **Tags**: {meta_optimizer.suggested_tags}
      **Social Media Title**: {meta_optimizer.social_title}
      **Social Media Description**: {meta_optimizer.social_description}

validation:
  content_quality:
    agent: "editor"
    rules:
      - "output.word_count >= context.word_count * 0.9"
      - "output.readability_score > 7"
      - "output.seo_score > 80"
```

### 4. Technical Documentation Workflow

Creating comprehensive technical documentation:

```yaml
composition:
  name: "Technical Documentation Generator"
  version: "1.0"

agents:
  requirements_analyst:
    type: "analysis_agent"
    prompt: |
      Analyze technical requirements and create documentation outline:
      
      Project: {project_name}
      Technology Stack: {tech_stack}
      Target Audience: {audience}
      
      Create comprehensive outline covering:
      - Architecture overview
      - API documentation
      - Setup instructions
      - Usage examples
      - Troubleshooting guide

  architecture_writer:
    type: "technical_writer"
    temperature: 0.4
    prompt: |
      Write detailed architecture documentation:
      
      Requirements: {requirements_analyst.output}
      
      Include:
      - System architecture diagrams (in text/mermaid format)
      - Component descriptions
      - Data flow explanations
      - Technology decisions and rationale

  api_documenter:
    type: "api_documentation_agent"
    temperature: 0.2
    prompt: |
      Create comprehensive API documentation:
      
      Project requirements: {requirements_analyst.output}
      
      Generate:
      - Endpoint documentation
      - Request/response examples
      - Authentication details
      - Error codes and handling
      - SDK examples in multiple languages

  tutorial_writer:
    type: "tutorial_agent"
    temperature: 0.6
    prompt: |
      Create step-by-step tutorials:
      
      Architecture: {architecture_writer.output}
      API docs: {api_documenter.output}
      
      Write:
      - Getting started guide
      - Common use case examples
      - Best practices
      - Performance tips

  technical_reviewer:
    type: "technical_review_agent"
    temperature: 0.2
    prompt: |
      Review all technical documentation for:
      
      - Technical accuracy
      - Completeness
      - Clarity for target audience
      - Consistency across sections
      - Code examples validation

flow:
  documentation_flow:
    sequence: |
      requirements_analyst -> 
      (architecture_writer || api_documenter) & 
      tutorial_writer -> 
      technical_reviewer
```

## Data Processing Pipelines

### 5. ETL Workflow with Validation

Data extraction, transformation, and loading with quality checks:

```yaml
composition:
  name: "Customer Data ETL Pipeline"
  version: "1.0"

config:
  timeout: 1800  # 30 minutes
  error_strategy: "continue"

agents:
  data_extractor:
    type: "data_extraction_agent"
    prompt: |
      Extract customer data from multiple sources:
      
      Sources: {data_sources}
      Date range: {date_range}
      
      Extract:
      - Customer demographics
      - Transaction history
      - Interaction logs
      - Preference data
    tools: ["database_connector", "api_client", "file_reader"]

  data_validator:
    type: "data_validation_agent"
    prompt: |
      Validate extracted data for:
      
      - Schema compliance
      - Data quality issues
      - Missing values
      - Duplicate records
      - Outlier detection
      
      Raw data: {data_extractor.output}

  data_cleaner:
    type: "data_cleaning_agent"
    prompt: |
      Clean and standardize data:
      
      Validation report: {data_validator.output}
      Raw data: {data_extractor.output}
      
      Apply:
      - Missing value imputation
      - Duplicate removal
      - Format standardization
      - Outlier handling

  data_transformer:
    type: "data_transformation_agent"
    prompt: |
      Transform cleaned data:
      
      Clean data: {data_cleaner.output}
      
      Apply:
      - Feature engineering
      - Data aggregation
      - Calculated fields
      - Format conversion for target system

  quality_checker:
    type: "quality_assurance_agent"
    prompt: |
      Final quality assessment:
      
      Transformed data: {data_transformer.output}
      
      Verify:
      - Data completeness
      - Business rule compliance
      - Statistical consistency
      - Format correctness

  data_loader:
    type: "data_loading_agent"
    prompt: |
      Load data to target systems:
      
      Quality-checked data: {quality_checker.output}
      Target systems: {target_systems}
      
      Perform:
      - Incremental loading
      - Index updates
      - Backup creation
      - Load verification

flow:
  etl_pipeline:
    sequence: |
      data_extractor -> 
      data_validator -> 
      data_cleaner -> 
      data_transformer -> 
      quality_checker ? data_quality_passed -> 
      data_loader

error_handling:
  validation_failure:
    trigger: "data_validator.quality_score < 0.8"
    action: "fallback"
    fallback: "manual_review_agent"
  
  transformation_error:
    trigger: "data_transformer.error"
    action: "retry"
    max_attempts: 3

monitoring:
  performance_metrics:
    - "processing_time"
    - "data_quality_score"
    - "records_processed"
    - "error_rate"
```

## Quality Assurance Workflows

### 6. Multi-Stage Content Review

Comprehensive content quality assurance with multiple review stages:

```yaml
composition:
  name: "Multi-Stage Content Review"
  version: "1.0"

agents:
  grammar_checker:
    type: "grammar_agent"
    temperature: 0.1
    prompt: |
      Check grammar, spelling, and punctuation:
      
      Content: {content}
      
      Identify and suggest fixes for:
      - Grammatical errors
      - Spelling mistakes
      - Punctuation issues
      - Style inconsistencies

  fact_checker:
    type: "fact_checking_agent"
    temperature: 0.2
    prompt: |
      Verify factual accuracy:
      
      Content: {content}
      
      Check:
      - Statistical claims
      - Historical facts
      - Scientific statements
      - Current events references
      
      Flag questionable claims with sources.
    tools: ["fact_database", "web_verification"]

  readability_analyzer:
    type: "readability_agent"
    temperature: 0.2
    prompt: |
      Analyze content readability:
      
      Content: {content}
      Target audience: {target_audience}
      
      Assess:
      - Reading level
      - Sentence complexity
      - Paragraph structure
      - Flow and coherence
      
      Suggest improvements for clarity.

  brand_reviewer:
    type: "brand_compliance_agent"
    temperature: 0.2
    prompt: |
      Review for brand compliance:
      
      Content: {content}
      Brand guidelines: {brand_guidelines}
      
      Check:
      - Tone of voice consistency
      - Brand terminology usage
      - Style guide compliance
      - Messaging alignment

  legal_reviewer:
    type: "legal_review_agent"
    temperature: 0.1
    prompt: |
      Legal and compliance review:
      
      Content: {content}
      Industry: {industry}
      
      Check for:
      - Legal disclaimers needed
      - Regulatory compliance
      - Copyright issues
      - Risk statements
      - Privacy considerations

  editor:
    type: "editor_agent"
    temperature: 0.4
    prompt: |
      Final editorial review and integration:
      
      Original content: {content}
      Grammar feedback: {grammar_checker.output}
      Fact check results: {fact_checker.output}
      Readability analysis: {readability_analyzer.output}
      Brand review: {brand_reviewer.output}
      Legal review: {legal_reviewer.output}
      
      Create final version incorporating all feedback.

flow:
  review_workflow:
    sequence: |
      (grammar_checker || fact_checker || readability_analyzer) &
      brand_reviewer ||
      legal_reviewer ? legal_review_required &
      editor

transformations:
  review_summary:
    type: "template"
    template: |
      # Content Review Summary
      
      ## Grammar & Style
      {grammar_checker.summary}
      
      ## Fact Checking
      {fact_checker.summary}
      
      ## Readability
      Score: {readability_analyzer.score}/10
      Recommendations: {readability_analyzer.recommendations}
      
      ## Brand Compliance
      Status: {brand_reviewer.status}
      Issues: {brand_reviewer.issues}
      
      ## Legal Review
      {legal_reviewer.summary}
      
      ## Final Content
      {editor.output}
```

## Complex Enterprise Scenarios

### 7. RFP Response Generation

Comprehensive Request for Proposal response creation:

```yaml
composition:
  name: "RFP Response Generator"
  version: "1.0"
  description: "Automated RFP response creation with compliance checking"

config:
  timeout: 3600  # 1 hour
  parallelism: 6
  error_strategy: "continue"

context:
  rfp_document: "${input.rfp_document}"
  company_profile: "${input.company_profile}"
  deadline: "${input.deadline}"
  budget_range: "${input.budget_range}"

agents:
  rfp_analyzer:
    type: "document_analysis_agent"
    temperature: 0.2
    prompt: |
      Analyze RFP document comprehensively:
      
      RFP Document: {rfp_document}
      
      Extract and organize:
      - Project requirements and scope
      - Technical specifications
      - Evaluation criteria and weights
      - Submission requirements
      - Mandatory vs. optional requirements
      - Timeline and milestones
      - Budget constraints
      - Compliance requirements
    tools: ["document_parser", "requirement_extractor"]

  capability_matcher:
    type: "analysis_agent"
    temperature: 0.3
    prompt: |
      Match company capabilities to RFP requirements:
      
      RFP Requirements: {rfp_analyzer.output}
      Company Profile: {company_profile}
      
      Analyze:
      - Requirement coverage assessment
      - Capability gaps identification
      - Competitive advantages
      - Risk areas
      - Partnership needs
      - Resource requirements

  technical_writer:
    type: "technical_proposal_agent"
    temperature: 0.4
    prompt: |
      Create technical response sections:
      
      Requirements: {rfp_analyzer.technical_requirements}
      Capabilities: {capability_matcher.technical_capabilities}
      
      Write detailed responses for:
      - Technical approach and methodology
      - Architecture and design
      - Implementation plan
      - Quality assurance approach
      - Security measures
      - Performance specifications

  business_writer:
    type: "business_proposal_agent"
    temperature: 0.5
    prompt: |
      Create business response sections:
      
      Requirements: {rfp_analyzer.business_requirements}
      Capabilities: {capability_matcher.business_capabilities}
      Budget: {budget_range}
      
      Write compelling content for:
      - Executive summary
      - Company qualifications
      - Project team and management
      - Timeline and milestones
      - Pricing and value proposition
      - Risk management

  compliance_checker:
    type: "compliance_agent"
    temperature: 0.1
    prompt: |
      Verify RFP compliance:
      
      RFP Requirements: {rfp_analyzer.output}
      Technical Response: {technical_writer.output}
      Business Response: {business_writer.output}
      
      Check:
      - All mandatory requirements addressed
      - Format and structure compliance
      - Page limits and formatting rules
      - Required certifications included
      - Submission checklist completion

  proposal_editor:
    type: "proposal_editor_agent"
    temperature: 0.3
    prompt: |
      Integrate and edit complete proposal:
      
      Technical content: {technical_writer.output}
      Business content: {business_writer.output}
      Compliance check: {compliance_checker.output}
      
      Create cohesive proposal with:
      - Consistent formatting and style
      - Logical flow and organization
      - Executive summary integration
      - Appendices organization
      - Final quality review

  win_strategy_advisor:
    type: "strategy_agent"
    temperature: 0.4
    prompt: |
      Develop win strategy recommendations:
      
      RFP Analysis: {rfp_analyzer.output}
      Capability Assessment: {capability_matcher.output}
      
      Provide:
      - Competitive positioning advice
      - Differentiation strategies
      - Risk mitigation approaches
      - Pricing recommendations
      - Presentation focus areas

flow:
  rfp_response_flow:
    sequence: |
      rfp_analyzer -> 
      capability_matcher ->
      (technical_writer || business_writer) &
      compliance_checker ->
      proposal_editor ||
      win_strategy_advisor

post_processing:
  final_package:
    enabled: true
    actions:
      - format_document
      - create_appendices
      - generate_executive_summary
      - compile_submission_package

validation:
  compliance_validation:
    rules:
      - "compliance_checker.score >= 0.95"
      - "proposal_editor.word_count <= rfp_analyzer.max_words"
      - "all_mandatory_sections_complete == true"

monitoring:
  rfp_metrics:
    - "requirements_coverage_percentage"
    - "compliance_score"
    - "competitive_advantage_score"
    - "proposal_quality_score"
```

### 8. Crisis Communication Management

Automated crisis communication workflow:

```yaml
composition:
  name: "Crisis Communication Management"
  version: "1.0"
  description: "Automated crisis response communication generation"

config:
  timeout: 1800  # 30 minutes - urgent timeline
  parallelism: 8
  error_strategy: "continue"  # Can't fail in crisis

context:
  crisis_type: "${input.crisis_type}"
  severity_level: "${input.severity_level}"
  affected_stakeholders: "${input.stakeholders}"
  initial_facts: "${input.facts}"
  company_context: "${input.company_context}"

agents:
  crisis_analyzer:
    type: "crisis_analysis_agent"
    temperature: 0.2
    timeout: 300
    prompt: |
      Analyze crisis situation rapidly:
      
      Crisis Type: {crisis_type}
      Severity: {severity_level}
      Facts: {initial_facts}
      Company: {company_context}
      
      Assess:
      - Impact scope and scale
      - Stakeholder implications
      - Regulatory considerations
      - Media attention potential
      - Reputation risks
      - Required response urgency

  legal_advisor:
    type: "legal_advisory_agent"
    temperature: 0.1
    timeout: 300
    prompt: |
      Provide legal guidance for crisis communication:
      
      Crisis analysis: {crisis_analyzer.output}
      
      Advise on:
      - Legal liability considerations
      - Regulatory disclosure requirements
      - Communication restrictions
      - Recommended disclaimers
      - Risk mitigation language

  media_strategist:
    type: "media_strategy_agent"
    temperature: 0.4
    timeout: 300
    prompt: |
      Develop media strategy:
      
      Crisis analysis: {crisis_analyzer.output}
      
      Create strategy for:
      - Key messages and messaging framework
      - Media channel priorities
      - Spokesperson recommendations
      - Timing considerations
      - Proactive vs. reactive approach

  internal_communicator:
    type: "internal_comms_agent"
    temperature: 0.5
    timeout: 300
    prompt: |
      Create internal communications:
      
      Crisis analysis: {crisis_analyzer.output}
      Legal guidance: {legal_advisor.output}
      
      Write for internal stakeholders:
      - Employee communication
      - Management briefing
      - Board notification
      - Department-specific updates

  external_communicator:
    type: "external_comms_agent"
    temperature: 0.5
    timeout: 300
    prompt: |
      Create external communications:
      
      Crisis analysis: {crisis_analyzer.output}
      Media strategy: {media_strategist.output}
      Legal guidance: {legal_advisor.output}
      
      Write for external stakeholders:
      - Press release
      - Customer communication
      - Investor update
      - Social media responses

  regulatory_reporter:
    type: "regulatory_agent"
    temperature: 0.2
    timeout: 300
    prompt: |
      Prepare regulatory communications:
      
      Crisis analysis: {crisis_analyzer.output}
      Legal guidance: {legal_advisor.output}
      
      Create required filings:
      - Regulatory notifications
      - Compliance reports
      - Industry body communications
      - Government liaison messages

  social_media_manager:
    type: "social_media_agent"
    temperature: 0.6
    timeout: 200
    prompt: |
      Create social media responses:
      
      External communications: {external_communicator.output}
      Media strategy: {media_strategist.output}
      
      Develop:
      - Platform-specific responses
      - Community management guidance
      - Hashtag strategies
      - Response templates for common questions

  crisis_coordinator:
    type: "coordination_agent"
    temperature: 0.3
    timeout: 400
    prompt: |
      Coordinate complete crisis response:
      
      All communications: {internal_communicator.output}, {external_communicator.output}
      Strategy: {media_strategist.output}
      Legal: {legal_advisor.output}
      Regulatory: {regulatory_reporter.output}
      Social: {social_media_manager.output}
      
      Create:
      - Communication timeline
      - Coordination checklist
      - Stakeholder contact lists
      - Escalation procedures
      - Follow-up action plan

flow:
  crisis_response_flow:
    sequence: |
      crisis_analyzer ->
      (legal_advisor || media_strategist) &
      (internal_communicator || external_communicator || regulatory_reporter) ||
      social_media_manager &
      crisis_coordinator

error_handling:
  urgent_fallback:
    trigger: "any_agent.timeout"
    action: "skip"
    continue_workflow: true
    notify: true

monitoring:
  crisis_alerts:
    - condition: "execution_time > 1200"  # 20 minutes
      action: "escalate_immediate"
    - condition: "any_agent.failed"
      action: "notify_crisis_team"

post_processing:
  emergency_distribution:
    enabled: true
    auto_send: false  # Require human approval
    channels: ["email", "sms", "slack", "teams"]
```

## Error Handling Patterns

### 9. Robust Research Pipeline with Fallbacks

Research workflow with comprehensive error handling:

```yaml
composition:
  name: "Robust Research Pipeline"
  version: "1.0"

agents:
  primary_researcher:
    type: "research_agent"
    model: "qwen2.5:7b"
    temperature: 0.3
    timeout: 300
    prompt: "Comprehensive research on: {topic}"
    tools: ["premium_databases", "expert_network", "real_time_data"]

  secondary_researcher:
    type: "research_agent"
    model: "qwen2.5:7b"
    temperature: 0.4
    timeout: 200
    prompt: "Alternative research approach for: {topic}"
    tools: ["web_search", "academic_papers", "industry_reports"]

  basic_researcher:
    type: "research_agent"
    model: "qwen2.5:7b"
    temperature: 0.5
    timeout: 100
    prompt: "Basic research using available sources: {topic}"
    tools: ["web_search", "knowledge_base"]

  cached_researcher:
    type: "cache_agent"
    timeout: 30
    prompt: "Retrieve cached research for: {topic}"
    tools: ["cache_database"]

  quality_assessor:
    type: "quality_agent"
    temperature: 0.2
    prompt: |
      Assess research quality:
      
      Research: {research_output}
      
      Rate on:
      - Completeness (1-10)
      - Accuracy (1-10)
      - Recency (1-10)
      - Source credibility (1-10)
      
      Overall quality score: (average)

  research_enhancer:
    type: "enhancement_agent"
    temperature: 0.4
    prompt: |
      Enhance research if quality is below threshold:
      
      Original research: {research_output}
      Quality assessment: {quality_assessor.output}
      
      Add:
      - Missing information
      - Additional sources
      - Recent updates
      - Context and analysis

flow:
  robust_research:
    sequence: |
      primary_researcher ! secondary_researcher | basic_researcher | cached_researcher ->
      quality_assessor ? quality_sufficient ->
      research_enhancer

error_handling:
  primary_timeout:
    trigger: "primary_researcher.timeout"
    action: "fallback"
    fallback: "secondary_researcher"
    notify: true

  secondary_failure:
    trigger: "secondary_researcher.error"
    action: "fallback"
    fallback: "basic_researcher"

  basic_failure:
    trigger: "basic_researcher.error"
    action: "fallback"
    fallback: "cached_researcher"

  quality_insufficient:
    trigger: "quality_assessor.score < 6.0"
    action: "enhance"
    enhancement_agent: "research_enhancer"

  complete_failure:
    trigger: "all_research_failed"
    action: "manual_intervention"
    escalate: true

validation:
  quality_sufficient:
    condition: "quality_assessor.score >= 7.0"
    on_false: "research_enhancer"

monitoring:
  research_metrics:
    - "research_quality_score"
    - "source_count"
    - "research_depth"
    - "fallback_usage_rate"
```

## Performance Optimization Examples

### 10. High-Throughput Content Processing

Optimized workflow for processing large volumes of content:

```yaml
composition:
  name: "High-Throughput Content Processing"
  version: "1.0"
  description: "Optimized for processing large content volumes"

config:
  timeout: 1800
  parallelism: 10  # High parallelism
  batch_size: 5    # Process in batches
  optimization: "performance"

context:
  content_batch: "${input.content_items}"
  processing_priority: "${input.priority || 'normal'}"

agents:
  content_classifier:
    type: "classification_agent"
    model: "qwen2.5:1.5b"  # Lighter model for speed
    temperature: 0.2
    timeout: 30  # Short timeout for classification
    instances: 3  # Multiple instances
    prompt: |
      Classify content type and priority:
      
      Content: {content}
      
      Determine:
      - Content type (article, blog, social, technical)
      - Processing complexity (simple, medium, complex)
      - Priority level (low, normal, high, urgent)

  batch_processor:
    type: "batch_processing_agent"
    model: "qwen2.5:7b"
    temperature: 0.5
    timeout: 120
    instances: 5  # Multiple parallel instances
    prompt: |
      Process content batch efficiently:
      
      Content batch: {content_batch}
      Classification: {content_classifier.output}
      
      Apply appropriate processing based on classification.

  quality_sampler:
    type: "sampling_agent"
    temperature: 0.2
    timeout: 60
    prompt: |
      Sample and validate subset for quality:
      
      Processed content: {batch_processor.output}
      Sample rate: 10%  # Only check 10% for speed
      
      Quick quality check on sample.

  aggregator:
    type: "aggregation_agent"
    timeout: 30
    prompt: |
      Aggregate results efficiently:
      
      Processed batches: {batch_processor.output}
      Quality sample: {quality_sampler.output}
      
      Combine results with metadata.

flow:
  high_throughput_processing:
    sequence: |
      content_classifier ->
      batch_processor ||
      quality_sampler &
      aggregator

optimization:
  performance_settings:
    cache_intermediate: true
    async_processing: true
    connection_pooling: true
    result_streaming: true

  resource_allocation:
    cpu_intensive: ["batch_processor"]
    io_intensive: ["aggregator"]
    memory_optimized: ["content_classifier"]

monitoring:
  throughput_metrics:
    - "items_per_second"
    - "processing_latency"
    - "resource_utilization"
    - "queue_depth"
    - "error_rate"

  real_time_alerts:
    - condition: "throughput < baseline * 0.8"
      action: "scale_up"
    - condition: "error_rate > 0.05"
      action: "investigate"
```

This comprehensive collection of examples demonstrates the flexibility and power of the Agent Composition Language for various use cases, from simple workflows to complex enterprise scenarios. Each example showcases different aspects of ACL capabilities and can be adapted for specific needs.