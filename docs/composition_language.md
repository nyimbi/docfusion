# Agent Composition Language (ACL) Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Language Syntax](#language-syntax)
4. [Operators Reference](#operators-reference)
5. [YAML Structure](#yaml-structure)
6. [Built-in Functions](#built-in-functions)
7. [Conditional Logic](#conditional-logic)
8. [Error Handling](#error-handling)
9. [Performance & Optimization](#performance--optimization)
10. [API Reference](#api-reference)
11. [Examples](#examples)
12. [Best Practices](#best-practices)
13. [Troubleshooting](#troubleshooting)

---

## Overview

The Agent Composition Language (ACL) is a declarative, YAML-based domain-specific language designed for orchestrating complex agent workflows. It provides an intuitive syntax for defining agent interactions, dependencies, parallel execution, conditional logic, and error handling.

### Key Features

- **Declarative Syntax**: Define what you want, not how to achieve it
- **YAML-Based**: Human-readable, version-control friendly
- **Rich Operator System**: 10 operators for complex flow control
- **Parallel Execution**: Built-in support for concurrent agent execution
- **Error Handling**: Comprehensive error recovery and fallback mechanisms
- **Real-time Monitoring**: Live execution tracking and performance metrics
- **Extensible**: Custom functions and conditions

### Use Cases

- **Proposal Generation**: Research → Analysis → Writing → Review workflows
- **Document Processing**: Multi-stage content creation and validation
- **Data Pipelines**: ETL workflows with agent-based processing
- **Quality Assurance**: Automated testing and validation chains
- **Content Workflows**: Editorial processes with parallel review stages

---

## Architecture

The ACL system consists of four main components working together:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  YAML Definition │───▶│     Parser      │───▶│   Interpreter   │───▶│     Runner      │
│   (Language)     │    │  (Validation)   │    │ (Optimization)  │    │  (Execution)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 1. Language Layer (`CompositionLanguage`)

Defines the syntax, operators, and language features:
- Operator definitions and semantics
- Built-in conditions and functions
- Syntax validation rules
- Example compositions

### 2. Parser Layer (`CompositionParser`)

Converts YAML compositions into structured data:
- YAML parsing and validation
- Expression parsing with regex patterns
- Dependency resolution
- Syntax error detection

### 3. Interpreter Layer (`CompositionInterpreter`)

Transforms parsed compositions into executable graphs:
- Execution graph construction
- Topological sorting for execution order
- Parallel group identification
- Performance optimization

### 4. Runner Layer (`CompositionRunner`)

Executes interpreted compositions:
- Agent orchestration and coordination
- Parallel and asynchronous execution
- Real-time monitoring and streaming
- Error handling and recovery

---

## Language Syntax

### Basic Syntax

ACL uses intuitive operators to define agent relationships:

```yaml
# Sequential execution
agent1 -> agent2 -> agent3

# Parallel execution  
agent1 || agent2 || agent3

# Conditional branching
agent1 < (success_agent, failure_agent, condition)

# Data pipeline
agent1 >> agent2 >> agent3

# Join synchronization
(agent1 || agent2) & merge_agent

# Conditional execution
agent1 ? condition -> agent2

# Loop execution
agent1 -> (agent2 * 3) -> agent3

# Error handling
agent1 ! error_handler -> agent2

# Asynchronous execution
~background_agent || main_flow

# Fallback execution
primary_agent | backup_agent
```

### Expression Composition

Operators can be combined for complex workflows:

```yaml
# Complex parallel workflow with conditional branches
(research_agent || market_analyst) -> 
content_writer < (
  technical_writer,     # if technical content needed
  basic_writer,         # if basic content sufficient  
  complexity_check      # condition
) -> 
reviewer ? quality_passed -> 
editor
```

---

## Operators Reference

### Sequential Operator (`->`)

Executes agents in sequence, passing output from one to the next.

```yaml
research_agent -> content_writer -> reviewer
```

**Use Cases:**
- Linear workflows
- Data transformation pipelines
- Step-by-step processes

**Behavior:**
- Waits for previous agent to complete
- Passes output as input to next agent
- Fails if any agent in sequence fails

### Parallel Operator (`||`)

Executes agents concurrently, improving performance.

```yaml
research_agent || market_analyst || competitive_analysis
```

**Use Cases:**
- Independent data gathering
- Parallel processing tasks
- Performance optimization

**Behavior:**
- Starts all agents simultaneously
- Doesn't wait for completion
- Requires explicit join for synchronization

### Branch Operator (`<`)

Conditional execution based on previous agent results.

```yaml
research_agent < (detailed_analysis, summary_only, data_sufficient)
```

**Syntax:** `agent < (true_path, false_path, condition)`

**Use Cases:**
- Conditional workflows
- Quality-based routing
- Dynamic process adaptation

**Behavior:**
- Evaluates condition against previous result
- Executes true_path if condition is true
- Executes false_path if condition is false

### Pipeline Operator (`>>`)

Data-focused sequential execution with explicit data passing.

```yaml
data_extractor >> data_transformer >> data_validator
```

**Use Cases:**
- ETL workflows
- Data processing chains
- Transformation pipelines

**Behavior:**
- Explicit data passing between agents
- Preserves data lineage
- Optimized for data-heavy workflows

### Join Operator (`&`)

Synchronization point for parallel execution paths.

```yaml
(agent1 || agent2 || agent3) & synchronization_point
```

**Use Cases:**
- Parallel workflow synchronization
- Result aggregation
- Barrier synchronization

**Behavior:**
- Waits for all parallel agents to complete
- Aggregates results from all paths
- Continues only when all dependencies satisfied

### Conditional Operator (`?`)

Executes agent only if condition is met.

```yaml
legal_review ? contract_required -> finalization
```

**Use Cases:**
- Optional processing steps
- Conditional validation
- Feature flags

**Behavior:**
- Evaluates condition before execution
- Skips agent if condition is false
- Continues workflow regardless

### Loop Operator (`*`)

Repeats agent execution for specified iterations or until condition.

```yaml
# Fixed iterations
quality_check * 3

# Conditional loop  
improvement_cycle * until_quality_threshold
```

**Use Cases:**
- Iterative improvement
- Retry mechanisms
- Quality assurance loops

**Behavior:**
- Supports count-based and condition-based loops
- Passes previous iteration output as input
- Includes safeguards against infinite loops

### Error Handler Operator (`!`)

Defines fallback agent for error scenarios.

```yaml
primary_research ! backup_research -> content_writer
```

**Use Cases:**
- Error recovery
- Fallback mechanisms
- Reliability improvement

**Behavior:**
- Executes error handler only on failure
- Can recover from transient errors
- Maintains workflow continuity

### Async Operator (`~`)

Fire-and-forget asynchronous execution.

```yaml
~background_logging || main_workflow
```

**Use Cases:**
- Background tasks
- Logging and monitoring
- Non-blocking operations

**Behavior:**
- Starts agent asynchronously
- Doesn't wait for completion
- Doesn't affect main workflow timing

### Fallback Operator (`|`)

Alternative execution path if primary fails.

```yaml
expensive_analysis | cached_results -> content_creation
```

**Use Cases:**
- Performance optimization
- Resource management
- Graceful degradation

**Behavior:**
- Tries primary agent first
- Falls back to alternative on failure
- Transparent to downstream agents

---

## YAML Structure

### Complete Composition Structure

```yaml
# Metadata and configuration
composition:
  name: "Workflow Name"
  version: "1.0"
  description: "Workflow description"

# Global configuration
config:
  timeout: 300              # Global timeout in seconds
  max_retries: 3            # Default retry attempts
  error_strategy: "continue" # "continue" | "fail_fast" | "ignore"
  parallelism: 5            # Max parallel agents

# Context variables (available to all agents)
context:
  topic: "${input.topic}"
  audience: "${input.audience}"
  deadline: "${input.deadline}"

# Agent definitions
agents:
  agent_name:
    type: "agent_type"      # Agent type identifier
    model: "qwen2.5:7b"     # LLM model to use
    temperature: 0.7        # Model temperature
    max_tokens: 3000        # Max output tokens
    timeout: 180            # Agent-specific timeout
    prompt: |               # Agent prompt template
      Your task is to...
      Context: {context}
      Input: {input}
    tools: ["tool1", "tool2"] # Available tools
    retries: 2              # Agent-specific retries

# Workflow definitions
flow:
  flow_name:
    sequence: |             # Flow definition using ACL syntax
      agent1 -> agent2 || agent3 -> agent4

# Data transformations
transformations:
  transform_name:
    type: "merge"           # Transformation type
    inputs: ["agent1", "agent2"]
    template: |             # Output template
      Combined: {agent1.output} + {agent2.output}

# Validation rules
validation:
  rule_name:
    agent: "agent_name"
    rules:
      - "output.length > 100"
      - "output.quality_score > 0.8"

# Error handling strategies
error_handling:
  error_type:
    trigger: "agent.error"
    action: "retry"         # "retry" | "fallback" | "skip"
    max_attempts: 3
    fallback: "backup_agent"

# Monitoring configuration
monitoring:
  performance_metrics:
    - "execution_time"
    - "success_rate"
    - "quality_scores"
  
  alerts:
    - condition: "execution_time > 600"
      action: "notify_admin"

# Post-processing
post_processing:
  quality_check:
    enabled: true
    rules: "validation.content_quality"
  
  formatting:
    enabled: true
    style: "professional"
```

### Required Sections

1. **composition**: Metadata about the workflow
2. **agents**: Agent definitions and configurations
3. **flow**: Workflow definitions using ACL syntax

### Optional Sections

- **config**: Global configuration settings
- **context**: Shared variables and context
- **transformations**: Data transformation definitions
- **validation**: Quality and validation rules
- **error_handling**: Error recovery strategies
- **monitoring**: Performance monitoring configuration
- **post_processing**: Output processing rules

---

## Built-in Functions

### Data Functions

#### `merge`
Combines outputs from multiple agents.

```yaml
merge_research:
  function: "merge"
  inputs: ["research_agent.output", "market_analyst.output"]
  template: |
    Research Findings: {research_agent.output}
    Market Analysis: {market_analyst.output}
```

#### `filter`
Filters data based on conditions.

```yaml
filter_results:
  function: "filter"
  source: "data_agent.output"
  condition: "quality_score > 0.7"
```

#### `transform`
Applies template-based transformations.

```yaml
format_output:
  function: "transform"
  template: |
    # Report: {context.topic}
    
    ## Summary
    {summary_agent.output}
    
    ## Details
    {detail_agent.output}
```

### Utility Functions

#### `validate`
Validates output against schema or rules.

```yaml
validate_content:
  function: "validate"
  schema: "content_schema"
  rules: ["length > 100", "readability > 7"]
```

#### `cache`
Caches results for reuse.

```yaml
cache_research:
  function: "cache"
  key: "research_{context.topic}"
  ttl: 3600  # 1 hour
```

#### `delay`
Adds processing delay.

```yaml
rate_limit:
  function: "delay"
  duration: 1.0  # seconds
```

#### `retry`
Configures retry behavior.

```yaml
retry_config:
  function: "retry"
  max_attempts: 5
  backoff_factor: 2.0
  retry_on: ["timeout", "api_error"]
```

#### `timeout`
Sets execution timeout.

```yaml
timeout_config:
  function: "timeout"
  duration: 300  # seconds
```

---

## Conditional Logic

### Built-in Conditions

#### Result-based Conditions

```yaml
# Success/failure conditions
success: "result.success == true"
failure: "result.success == false"
error: "result.error != null"

# Data conditions
empty: "result.data == null or result.data == ''"
nonempty: "result.data != null and result.data != ''"

# Comparison conditions
contains: "condition_value in result.data"
equals: "result.data == condition_value"
greater: "result.data > condition_value"
less: "result.data < condition_value"
```

#### Quality-based Conditions

```yaml
# Quality thresholds
quality_high: "result.quality_score > 0.8"
quality_medium: "result.quality_score > 0.6"
quality_low: "result.quality_score <= 0.6"

# Length conditions
sufficient_length: "len(result.data) > 500"
too_short: "len(result.data) < 100"

# Completeness conditions
complete: "result.completeness_score == 1.0"
incomplete: "result.completeness_score < 1.0"
```

### Custom Conditions

Define custom conditions using JavaScript-like expressions:

```yaml
custom_conditions:
  technical_content_needed:
    expression: |
      result.complexity_score > 0.7 && 
      context.audience.includes('technical') &&
      result.data.includes('implementation')
  
  requires_legal_review:
    expression: |
      result.data.includes('contract') || 
      result.data.includes('legal') ||
      context.budget > 50000
```

### Conditional Workflows

```yaml
flow:
  adaptive_workflow:
    sequence: |
      research_agent -> 
      content_writer < (
        technical_writer,      # if technical_content_needed
        general_writer,        # if not technical
        technical_content_needed
      ) ->
      reviewer ? quality_high ->
      legal_review ? requires_legal_review ->
      final_output
```

---

## Error Handling

### Error Types

1. **Agent Errors**: Failures during agent execution
2. **Timeout Errors**: Agents exceeding time limits
3. **Validation Errors**: Output failing validation rules
4. **Resource Errors**: Insufficient resources or capacity
5. **Network Errors**: Communication failures

### Error Handling Strategies

#### 1. Retry Strategy

```yaml
error_handling:
  agent_timeout:
    trigger: "timeout"
    action: "retry"
    max_attempts: 3
    backoff_factor: 2.0
    jitter: true
```

#### 2. Fallback Strategy

```yaml
error_handling:
  research_failure:
    trigger: "research_agent.error"
    action: "fallback"
    fallback_agent: "cached_research"
```

#### 3. Skip Strategy

```yaml
error_handling:
  optional_step_failure:
    trigger: "optional_agent.error"
    action: "skip"
    continue_workflow: true
```

#### 4. Circuit Breaker

```yaml
error_handling:
  api_circuit_breaker:
    trigger: "api_error"
    action: "circuit_break"
    failure_threshold: 5
    recovery_timeout: 300
```

### Error Recovery Patterns

#### Graceful Degradation

```yaml
flow:
  robust_research:
    sequence: |
      (detailed_research | quick_research | cached_research) ->
      content_writer
```

#### Progressive Fallback

```yaml
flow:
  multi_tier_analysis:
    sequence: |
      premium_analysis ! 
      standard_analysis ! 
      basic_analysis ->
      content_writer
```

#### Error Isolation

```yaml
flow:
  isolated_processing:
    sequence: |
      ~error_prone_task ||
      main_workflow ->
      final_output
```

---

## Performance & Optimization

### Execution Optimization

#### Parallel Execution

```yaml
# Maximize parallelism
flow:
  parallel_research:
    sequence: |
      (research_agent || market_analyst || competitor_analysis) &
      data_merge ->
      content_writer
```

#### Pipeline Optimization

```yaml
# Optimize data flow
flow:
  data_pipeline:
    sequence: |
      data_extractor >> 
      data_cleaner >> 
      data_analyzer >> 
      report_generator
```

#### Async Background Tasks

```yaml
# Non-blocking background tasks
flow:
  async_workflow:
    sequence: |
      ~audit_logger ||
      ~metrics_collector ||
      main_process ->
      final_output
```

### Resource Management

#### Concurrency Control

```yaml
config:
  parallelism: 5           # Max concurrent agents
  resource_pool: 10        # Resource pool size
  memory_limit: "4GB"      # Memory constraints
```

#### Load Balancing

```yaml
agents:
  worker_agent:
    type: "content_processor"
    instances: 3           # Multiple instances
    load_balancer: "round_robin"
```

### Performance Monitoring

#### Metrics Collection

```yaml
monitoring:
  performance_metrics:
    - "execution_time"
    - "throughput"
    - "resource_utilization"
    - "error_rate"
    - "quality_score"
  
  real_time_alerts:
    - condition: "execution_time > p95_baseline * 1.5"
      action: "scale_up"
    - condition: "error_rate > 0.1"
      action: "investigate"
```

#### Performance Tuning

```yaml
optimization:
  execution_hints:
    prefer_parallel: true
    cache_intermediate: true
    batch_size: 10
    
  resource_allocation:
    cpu_intensive: ["research_agent", "analysis_agent"]
    io_intensive: ["data_fetcher", "document_writer"]
    memory_intensive: ["large_model_agent"]
```

---

## API Reference

### CompositionLanguage Class

```python
class CompositionLanguage:
    """Language definition and utilities"""
    
    @classmethod
    def get_example_composition() -> str:
        """Get example composition YAML"""
    
    @classmethod
    def get_syntax_reference() -> Dict[str, Any]:
        """Get complete syntax reference"""
    
    @classmethod
    def validate_syntax(cls, composition_text: str) -> Dict[str, Any]:
        """Validate composition syntax"""
    
    @classmethod
    def get_language_features() -> Dict[str, Any]:
        """Get language features documentation"""
```

### CompositionParser Class

```python
class CompositionParser:
    """Parser for ACL compositions"""
    
    async def parse_composition(self, composition_yaml: str) -> ParsedComposition:
        """Parse complete composition from YAML"""
    
    async def validate_expression(self, expression: str, agents: List[str]) -> Dict[str, Any]:
        """Validate individual expression"""
    
    def get_supported_operators() -> Dict[str, Dict[str, Any]]:
        """Get supported operators information"""
```

### CompositionInterpreter Class

```python
class CompositionInterpreter:
    """Interpreter for parsed compositions"""
    
    async def interpret_composition(self, parsed_composition: ParsedComposition) -> InterpretedComposition:
        """Interpret parsed composition into executable form"""
    
    async def get_execution_plan(self, interpreted_composition: InterpretedComposition) -> Dict[str, Any]:
        """Generate detailed execution plan"""
```

### CompositionRunner Class

```python
class CompositionRunner:
    """Executes interpreted compositions"""
    
    def __init__(self, max_workers: int = 10, enable_monitoring: bool = True):
        """Initialize runner with configuration"""
    
    async def execute_composition(
        self, 
        composition: InterpretedComposition, 
        input_data: Dict[str, Any],
        execution_options: Optional[Dict[str, Any]] = None
    ) -> ExecutionReport:
        """Execute complete composition"""
    
    async def stream_execution(
        self, 
        composition: InterpretedComposition, 
        input_data: Dict[str, Any]
    ) -> AsyncIterator[Dict[str, Any]]:
        """Stream execution progress in real-time"""
    
    async def cancel_execution(self, execution_id: str) -> bool:
        """Cancel running execution"""
    
    def register_agent(self, agent_id: str, agent: Any):
        """Register agent for execution"""
    
    def register_function(self, function_name: str, function: Callable):
        """Register custom function"""
```

---

## Examples

### Basic Sequential Workflow

```yaml
composition:
  name: "Simple Document Workflow"
  version: "1.0"

agents:
  researcher:
    type: "research_agent"
    prompt: "Research topic: {topic}"
  
  writer:
    type: "content_agent"
    prompt: "Write content based on: {research_output}"

flow:
  main:
    sequence: |
      researcher -> writer
```

### Parallel Processing Workflow

```yaml
composition:
  name: "Parallel Analysis Workflow"
  version: "1.0"

agents:
  market_researcher:
    type: "research_agent"
    prompt: "Market research for: {topic}"
  
  technical_analyst:
    type: "analysis_agent"
    prompt: "Technical analysis for: {topic}"
  
  content_synthesizer:
    type: "synthesis_agent"
    prompt: "Synthesize findings from multiple sources"

flow:
  parallel_analysis:
    sequence: |
      (market_researcher || technical_analyst) & content_synthesizer
```

### Conditional Workflow

```yaml
composition:
  name: "Adaptive Content Workflow"
  version: "1.0"

agents:
  research_agent:
    type: "research_agent"
    prompt: "Research: {topic}"
  
  technical_writer:
    type: "technical_writer"
    prompt: "Technical content for: {topic}"
  
  simple_writer:
    type: "content_writer"
    prompt: "Simple content for: {topic}"
  
  reviewer:
    type: "review_agent"
    prompt: "Review content quality"

flow:
  adaptive_content:
    sequence: |
      research_agent -> 
      technical_writer < (
        technical_writer,
        simple_writer,
        technical_complexity_needed
      ) ->
      reviewer
```

### Error Handling Workflow

```yaml
composition:
  name: "Robust Research Workflow"
  version: "1.0"

agents:
  primary_research:
    type: "research_agent"
    prompt: "Comprehensive research: {topic}"
  
  backup_research:
    type: "research_agent"
    prompt: "Basic research: {topic}"
  
  cached_research:
    type: "cache_agent"
    prompt: "Retrieve cached research: {topic}"

flow:
  robust_research:
    sequence: |
      primary_research ! backup_research | cached_research -> content_writer

error_handling:
  research_timeout:
    trigger: "primary_research.timeout"
    action: "fallback"
    fallback: "backup_research"
```

### Complex Multi-Stage Workflow

```yaml
composition:
  name: "Enterprise Proposal Generation"
  version: "1.0"

config:
  timeout: 600
  parallelism: 5
  error_strategy: "continue"

context:
  topic: "${input.topic}"
  audience: "${input.audience}"
  budget: "${input.budget}"

agents:
  market_researcher:
    type: "research_agent"
    model: "qwen2.5:7b"
    temperature: 0.3
    prompt: |
      Market research for: {topic}
      Target audience: {audience}
      Budget range: {budget}
  
  competitive_analyst:
    type: "analysis_agent"
    model: "qwen2.5:7b"
    temperature: 0.2
    prompt: "Competitive analysis for: {topic}"
  
  technical_writer:
    type: "technical_writer"
    model: "qwen2.5:7b"
    temperature: 0.5
    prompt: "Technical proposal content"
  
  business_writer:
    type: "business_writer"
    model: "qwen2.5:7b"
    temperature: 0.7
    prompt: "Business proposal content"
  
  reviewer:
    type: "review_agent"
    model: "qwen2.5:7b"
    temperature: 0.2
    prompt: "Review proposal quality"
  
  editor:
    type: "editor_agent"
    model: "qwen2.5:7b"
    temperature: 0.1
    prompt: "Final editing and formatting"

flow:
  # Phase 1: Research
  research_phase:
    sequence: |
      (market_researcher || competitive_analyst) & research_synthesis
  
  # Phase 2: Content Creation
  content_phase:
    sequence: |
      research_synthesis -> 
      (technical_writer || business_writer) & 
      content_synthesis
  
  # Phase 3: Quality Assurance
  qa_phase:
    sequence: |
      content_synthesis ->
      reviewer ? quality_passed ->
      editor

transformations:
  research_synthesis:
    type: "merge"
    inputs: ["market_researcher.output", "competitive_analyst.output"]
    template: |
      # Research Summary
      
      ## Market Analysis
      {market_researcher.output}
      
      ## Competitive Landscape
      {competitive_analyst.output}
  
  content_synthesis:
    type: "merge"
    inputs: ["technical_writer.output", "business_writer.output"]
    template: |
      # Proposal Content
      
      ## Technical Overview
      {technical_writer.output}
      
      ## Business Case
      {business_writer.output}

validation:
  content_quality:
    agent: "reviewer"
    rules:
      - "output.quality_score > 0.8"
      - "output.completeness > 0.9"
      - "output.clarity_score > 0.7"

monitoring:
  performance_metrics:
    - "execution_time"
    - "success_rate"
    - "quality_scores"
  
  alerts:
    - condition: "execution_time > 900"
      action: "notify_admin"
```

---

## Best Practices

### 1. Composition Design

#### Keep Flows Simple
```yaml
# Good: Simple, readable flow
flow:
  main:
    sequence: |
      research -> analysis -> content -> review

# Avoid: Overly complex single flow
flow:
  complex:
    sequence: |
      (research || market) & merge -> analysis < (detailed, summary, condition) -> ...
```

#### Use Descriptive Names
```yaml
# Good: Descriptive agent names
agents:
  market_research_specialist:
    type: "research_agent"
  
  technical_content_writer:
    type: "content_agent"

# Avoid: Generic names
agents:
  agent1:
    type: "research_agent"
  
  agent2:
    type: "content_agent"
```

#### Modularize Complex Workflows
```yaml
# Good: Separate flows for different phases
flow:
  research_phase:
    sequence: |
      primary_research || secondary_research & synthesis
  
  content_phase:
    sequence: |
      synthesis -> writing -> review
  
  finalization_phase:
    sequence: |
      review -> editing -> approval
```

### 2. Error Handling

#### Always Provide Fallbacks
```yaml
# Good: Multiple fallback levels
flow:
  robust_processing:
    sequence: |
      premium_service ! standard_service | cached_results -> output

# Better: Graceful degradation
error_handling:
  service_failure:
    trigger: "premium_service.error"
    action: "fallback"
    fallback: "standard_service"
    notify: true
```

#### Use Circuit Breakers for External Services
```yaml
error_handling:
  external_api:
    trigger: "api_error"
    action: "circuit_break"
    failure_threshold: 3
    recovery_timeout: 300
```

### 3. Performance Optimization

#### Maximize Parallelism
```yaml
# Good: Parallel where possible
flow:
  optimized:
    sequence: |
      (research || analysis || validation) & synthesis -> output

# Avoid: Unnecessary sequencing
flow:
  slow:
    sequence: |
      research -> analysis -> validation -> synthesis -> output
```

#### Use Appropriate Timeouts
```yaml
agents:
  quick_agent:
    timeout: 30      # Fast operations
  
  research_agent:
    timeout: 300     # Research takes time
  
  analysis_agent:
    timeout: 600     # Complex analysis
```

### 4. Resource Management

#### Set Reasonable Concurrency Limits
```yaml
config:
  parallelism: 5     # Based on available resources
  memory_limit: "4GB"
  cpu_limit: "4 cores"
```

#### Use Resource Pools
```yaml
agents:
  heavy_processor:
    type: "analysis_agent"
    resource_pool: "cpu_intensive"
    instances: 2
```

### 5. Monitoring and Debugging

#### Include Comprehensive Monitoring
```yaml
monitoring:
  performance_metrics:
    - "execution_time"
    - "memory_usage"
    - "success_rate"
    - "error_rate"
    - "quality_scores"
  
  debug_logging:
    enabled: true
    level: "INFO"
    include_payloads: false  # Security consideration
```

#### Use Meaningful Validation Rules
```yaml
validation:
  output_quality:
    agent: "content_writer"
    rules:
      - "output.word_count >= 500"
      - "output.readability_score > 6"
      - "not output.contains('TODO')"
      - "output.sections.length >= 3"
```

### 6. Security Considerations

#### Validate Inputs
```yaml
validation:
  input_validation:
    rules:
      - "input.topic.length < 1000"
      - "not input.contains('<script>')"
      - "input.matches('^[a-zA-Z0-9 .,!?-]+$')"
```

#### Sanitize Context Variables
```yaml
context:
  topic: "${sanitize(input.topic)}"
  audience: "${validate_enum(input.audience, ['technical', 'business', 'general'])}"
```

#### Limit Resource Usage
```yaml
agents:
  external_agent:
    timeout: 60
    max_tokens: 1000
    rate_limit: "10/minute"
```

---

## Troubleshooting

### Common Issues

#### 1. Parsing Errors

**Problem**: "Unable to parse expression"
```yaml
# Problematic
flow:
  bad_syntax:
    sequence: |
      agent1 ->-> agent2  # Double operator
```

**Solution**: Check operator syntax
```yaml
# Correct
flow:
  good_syntax:
    sequence: |
      agent1 -> agent2
```

#### 2. Dependency Issues

**Problem**: "Agent references undefined agent"
```yaml
agents:
  writer:
    type: "content_agent"

flow:
  main:
    sequence: |
      researcher -> writer  # researcher not defined
```

**Solution**: Define all referenced agents
```yaml
agents:
  researcher:
    type: "research_agent"
  writer:
    type: "content_agent"

flow:
  main:
    sequence: |
      researcher -> writer
```

#### 3. Execution Timeouts

**Problem**: Agents timing out frequently

**Solution**: Adjust timeouts and add error handling
```yaml
agents:
  slow_agent:
    timeout: 600  # Increase timeout
    
error_handling:
  timeout_recovery:
    trigger: "timeout"
    action: "retry"
    max_attempts: 2
```

#### 4. Memory Issues

**Problem**: Out of memory during execution

**Solution**: Limit parallelism and use resource management
```yaml
config:
  parallelism: 2        # Reduce concurrent agents
  memory_limit: "2GB"   # Set memory limits

agents:
  memory_heavy_agent:
    resource_allocation:
      memory: "512MB"
```

### Debugging Techniques

#### 1. Enable Debug Logging
```yaml
monitoring:
  debug_logging:
    enabled: true
    level: "DEBUG"
    include_timings: true
```

#### 2. Use Simple Test Compositions
```yaml
# Minimal test case
composition:
  name: "Debug Test"

agents:
  test_agent:
    type: "echo_agent"
    prompt: "Echo: {input}"

flow:
  test:
    sequence: |
      test_agent
```

#### 3. Validate Syntax Incrementally
```python
# Test individual expressions
parser = CompositionParser()
result = await parser.validate_expression(
    "agent1 -> agent2", 
    ["agent1", "agent2"]
)
print(result)
```

#### 4. Monitor Execution in Real-time
```python
# Stream execution events
async for event in runner.stream_execution(composition, input_data):
    print(f"Event: {event['type']} - {event}")
```

### Performance Debugging

#### 1. Execution Time Analysis
```yaml
monitoring:
  performance_metrics:
    - "execution_time"
    - "agent_duration"
    - "queue_time"
    - "overhead"
```

#### 2. Bottleneck Identification
```python
# Analyze execution report
report = await runner.execute_composition(composition, input_data)
bottlenecks = report.performance_metrics.get('bottlenecks', [])
for bottleneck in bottlenecks:
    print(f"Bottleneck: {bottleneck}")
```

#### 3. Resource Utilization Monitoring
```yaml
monitoring:
  resource_tracking:
    cpu_usage: true
    memory_usage: true
    network_io: true
    disk_io: true
```

---

## Advanced Features

### Custom Operators

Extend ACL with custom operators:

```python
class CustomCompositionParser(CompositionParser):
    def __init__(self):
        super().__init__()
        # Add custom operator
        self.operator_patterns['broadcast'] = re.compile(r'(\w+)\s*\*>\s*\(([^)]+)\)')
    
    async def _parse_expression(self, expr_text: str, agents: Dict[str, Any]):
        # Handle broadcast operator: agent1 *> (agent2, agent3, agent4)
        if '*>' in expr_text:
            return self._parse_broadcast_expression(expr_text)
        return await super()._parse_expression(expr_text, agents)
```

### Plugin System

Extend functionality with plugins:

```python
class ACLPlugin:
    def register_functions(self, runner: CompositionRunner):
        """Register custom functions"""
        runner.register_function('custom_transform', self.custom_transform)
    
    def register_conditions(self, parser: CompositionParser):
        """Register custom conditions"""
        parser.conditions['custom_condition'] = self.custom_condition
    
    async def custom_transform(self, node, context):
        """Custom transformation logic"""
        return {"transformed": True}
```

### Integration Patterns

#### Event-Driven Integration
```yaml
monitoring:
  events:
    - trigger: "execution_completed"
      webhook: "https://api.example.com/webhook"
    - trigger: "agent_failed"
      action: "send_alert"
```

#### External System Integration
```yaml
agents:
  external_service:
    type: "webhook_agent"
    endpoint: "https://api.service.com/process"
    auth:
      type: "bearer"
      token: "${env.API_TOKEN}"
```

This comprehensive documentation provides everything needed to effectively use the Agent Composition Language for complex workflow orchestration. The system's declarative nature, combined with its powerful operator system and extensive customization options, makes it suitable for a wide range of agent orchestration scenarios.