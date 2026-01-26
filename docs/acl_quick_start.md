# Agent Composition Language (ACL) Quick Start Guide

## Overview

The Agent Composition Language (ACL) is a YAML-based DSL for orchestrating agent workflows. This guide will get you up and running in minutes.

## 5-Minute Quick Start

### 1. Basic Composition Structure

```yaml
# my_workflow.yaml
composition:
  name: "My First Workflow"
  version: "1.0"

agents:
  researcher:
    type: "research_agent"
    prompt: "Research the topic: {topic}"
  
  writer:
    type: "content_agent"
    prompt: "Write content about: {research_output}"

flow:
  main:
    sequence: |
      researcher -> writer
```

### 2. Execute the Workflow

```python
from proposal_writer.composition import CompositionParser, CompositionInterpreter, CompositionRunner

async def run_workflow():
    # Load and parse
    with open('my_workflow.yaml') as f:
        yaml_content = f.read()
    
    parser = CompositionParser()
    parsed = await parser.parse_composition(yaml_content)
    
    # Interpret
    interpreter = CompositionInterpreter()
    interpreted = await interpreter.interpret_composition(parsed)
    
    # Execute
    runner = CompositionRunner()
    result = await runner.execute_composition(
        interpreted,
        {"topic": "AI in Healthcare"}
    )
    
    print(f"Status: {result.status}")
    print(f"Duration: {result.duration:.2f}s")
```

## Core Operators

### Sequential (`->`)
```yaml
agent1 -> agent2 -> agent3
```

### Parallel (`||`)
```yaml
agent1 || agent2 || agent3
```

### Conditional (`<`)
```yaml
agent1 < (success_path, failure_path, condition)
```

### Error Handling (`!`)
```yaml
primary_agent ! backup_agent
```

## Common Patterns

### Research Workflow
```yaml
composition:
  name: "Research Pipeline"

agents:
  data_collector:
    type: "research_agent"
    prompt: "Collect data on: {topic}"
  
  analyzer:
    type: "analysis_agent"
    prompt: "Analyze: {data}"
  
  reporter:
    type: "report_agent"
    prompt: "Create report from: {analysis}"

flow:
  pipeline:
    sequence: |
      data_collector -> analyzer -> reporter
```

### Parallel Processing
```yaml
flow:
  parallel_research:
    sequence: |
      (web_research || academic_research || news_research) & 
      synthesis_agent -> 
      final_report
```

### Quality Assurance
```yaml
flow:
  qa_workflow:
    sequence: |
      content_writer -> 
      reviewer ? quality_passed -> 
      editor
```

## Configuration Options

### Global Settings
```yaml
config:
  timeout: 300          # 5 minutes
  max_retries: 3
  parallelism: 5        # Max concurrent agents
```

### Agent Configuration
```yaml
agents:
  my_agent:
    type: "custom_agent"
    model: "qwen2.5:7b"
    temperature: 0.7
    timeout: 180
    prompt: |
      You are an expert in {domain}.
      Task: {task}
      Context: {context}
```

## Error Handling

### Simple Fallback
```yaml
flow:
  robust:
    sequence: |
      primary_service | backup_service -> output
```

### Retry Configuration
```yaml
error_handling:
  api_failure:
    trigger: "api_error"
    action: "retry"
    max_attempts: 3
```

## Monitoring

### Basic Monitoring
```yaml
monitoring:
  performance_metrics:
    - "execution_time"
    - "success_rate"
  
  alerts:
    - condition: "execution_time > 600"
      action: "notify"
```

## Next Steps

1. **Read the [Full Documentation](composition_language.md)** for comprehensive details
2. **Try the Examples** in `/examples/composition_example.py`
3. **Explore Advanced Features** like custom functions and conditions
4. **Join the Community** for support and best practices

## Common Gotchas

1. **Agent Names**: Must be valid identifiers (no spaces, special chars)
2. **YAML Indentation**: Be consistent with spaces (not tabs)
3. **Flow References**: All agents in flows must be defined in the `agents` section
4. **Operator Spacing**: Use spaces around operators: `agent1 -> agent2`

## Example: Complete Proposal Workflow

```yaml
composition:
  name: "Proposal Generation"
  version: "1.0"
  description: "End-to-end proposal creation"

config:
  timeout: 600
  parallelism: 3

context:
  topic: "${input.topic}"
  audience: "${input.audience}"

agents:
  market_researcher:
    type: "research_agent"
    temperature: 0.3
    prompt: |
      Research market conditions for: {topic}
      Target audience: {audience}
  
  tech_analyst:
    type: "analysis_agent"
    temperature: 0.2
    prompt: |
      Technical analysis for: {topic}
      Focus on implementation feasibility
  
  content_writer:
    type: "content_agent"
    temperature: 0.7
    prompt: |
      Create proposal content based on:
      Market Research: {market_research}
      Technical Analysis: {tech_analysis}
  
  reviewer:
    type: "review_agent"
    temperature: 0.1
    prompt: |
      Review proposal for:
      - Clarity and coherence
      - Technical accuracy
      - Business viability

flow:
  proposal_generation:
    sequence: |
      (market_researcher || tech_analyst) & 
      content_writer -> 
      reviewer ? quality_check -> 
      final_output

transformations:
  final_output:
    type: "template"
    template: |
      # Proposal: {context.topic}
      
      ## Market Analysis
      {market_researcher.output}
      
      ## Technical Feasibility
      {tech_analyst.output}
      
      ## Proposal Content
      {content_writer.output}
      
      ## Quality Review
      {reviewer.output}

validation:
  quality_check:
    rules:
      - "output.length > 1000"
      - "output.quality_score > 0.8"
```

Start with simple workflows and gradually add complexity as you become more familiar with the language!