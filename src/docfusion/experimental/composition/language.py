"""
Agent Composition Language Definition

Defines the YAML-based declarative language for agent workflow composition
with support for sequencing, branching, parallelism, and advanced control flow.

Author: Nyimbi Odero  
Company: Datacraft Ltd
Copyright (c) 2025
"""

from typing import Any, Dict


class CompositionLanguage:
	"""
	Agent Composition Language (ACL) Specification
	
	A declarative YAML-based language for defining complex agent workflows
	with intuitive syntax for sequencing, branching, and control flow.
	"""
	
	# Language version
	VERSION = "1.0"
	
	# Supported operators
	OPERATORS = {
		"->": "sequence",           # Sequential execution: agent1 -> agent2
		"||": "parallel",          # Parallel execution: agent1 || agent2  
		"<": "branch",             # Conditional branch: agent1 < (agent2, agent3, condition)
		">>": "pipeline",          # Data pipeline: agent1 >> agent2 (pass data)
		"&": "join",               # Join parallel: agent1 & agent2 (wait for both)
		"?": "conditional",        # Conditional: agent1 ? condition
		"*": "loop",               # Loop: agent1 * count or condition
		"!": "error_handler",      # Error handling: agent1 ! error_agent
		"~": "async",              # Async execution: ~agent1 (fire and forget)
		"|": "fallback"            # Fallback: agent1 | agent2 (if agent1 fails)
	}
	
	# Built-in conditions
	CONDITIONS = {
		"success": "result.success == true",
		"failure": "result.success == false", 
		"error": "result.error != null",
		"empty": "result.data == null or result.data == ''",
		"nonempty": "result.data != null and result.data != ''",
		"contains": "condition_value in result.data",
		"equals": "result.data == condition_value",
		"greater": "result.data > condition_value",
		"less": "result.data < condition_value"
	}
	
	# Built-in functions
	FUNCTIONS = {
		"merge": "Merge results from multiple agents",
		"filter": "Filter results based on condition", 
		"transform": "Transform data using template",
		"validate": "Validate result against schema",
		"cache": "Cache result for reuse",
		"delay": "Add delay before execution",
		"retry": "Retry agent on failure",
		"timeout": "Set execution timeout"
	}
	
	@classmethod
	def get_example_composition(cls) -> str:
		"""Get example composition to demonstrate language features"""
		return """
# Agent Composition Language Example
# Comprehensive proposal generation workflow

composition:
  name: "Proposal Generation Workflow"
  version: "1.0"
  description: "End-to-end proposal generation with research, writing, and review"

# Global configuration
config:
  timeout: 300
  max_retries: 3
  error_strategy: "continue"
  parallelism: 5

# Context variables
context:
  topic: "${input.topic}"
  audience: "${input.target_audience}" 
  deadline: "${input.deadline}"
  budget: "${input.budget_range}"

# Agent definitions
agents:
    research_agent:
      type: "research_specialist"
      model: "qwen2.5:7b"
      temperature: 0.3
      prompt: |
        Research the topic: {topic}
        Target audience: {audience}
        Focus on market analysis, competitive landscape, and opportunities.
        Provide comprehensive research findings with sources.
      tools: ["web_search", "document_analysis", "data_extraction"]
      timeout: 180
      
    market_analyst:
      type: "analysis_specialist"  
      model: "qwen2.5:7b"
      temperature: 0.2
      prompt: |
        Analyze market data for: {topic}
        Provide insights on:
        - Market size and growth
        - Target demographics  
        - Competitive positioning
        - Revenue opportunities
      tools: ["data_analysis", "visualization", "statistics"]
      
    content_writer:
      type: "content_specialist"
      model: "qwen2.5:7b" 
      temperature: 0.7
      prompt: |
        Create compelling proposal content based on research findings.
        Topic: {topic}
        Audience: {audience}
        Tone: Professional and persuasive
        Include: Executive summary, problem statement, solution, benefits
      tools: ["text_generation", "formatting", "templates"]
      
    technical_writer:
      type: "technical_specialist"
      model: "qwen2.5:7b"
      temperature: 0.4
      prompt: |
        Create technical sections of the proposal:
        - Implementation plan
        - Technical specifications
        - Architecture diagrams
        - Risk assessment
      tools: ["technical_writing", "diagram_generation", "code_examples"]
      
    reviewer:
      type: "review_specialist"
      model: "qwen2.5:7b"
      temperature: 0.3
      prompt: |
        Review proposal for:
        - Clarity and coherence
        - Technical accuracy
        - Persuasiveness
        - Completeness
        Provide specific feedback and improvement suggestions.
      tools: ["quality_assessment", "grammar_check", "readability"]
      
    editor:
      type: "editor_specialist"
      model: "qwen2.5:7b"
      temperature: 0.2
      prompt: |
        Edit and finalize proposal ensuring:
        - Consistent formatting
        - Professional presentation
        - Complete sections
        - Executive summary
        - Clear call to action
      tools: ["editing", "formatting", "style_guide"]
      
    legal_reviewer:
      type: "legal_specialist"
      model: "qwen2.5:7b"
      temperature: 0.1
      prompt: |
        Legal review of proposal for:
        - Compliance requirements
        - Contract terms
        - Risk mitigation
        - Legal disclaimers
      tools: ["legal_analysis", "compliance_check", "risk_assessment"]

# Workflow composition using ACL syntax
flow:
    # Phase 1: Parallel research and analysis
    phase_1:
      sequence: |
        (research_agent || market_analyst) -> research_merge
        
    research_merge:
      function: "merge"
      inputs: ["research_agent.output", "market_analyst.output"]
      template: |
        Research Findings:
        {research_agent.output}
        
        Market Analysis:
        {market_analyst.output}
        
    # Phase 2: Content creation based on research
    phase_2:
      sequence: |
        research_merge -> (content_writer || technical_writer) -> content_merge
        
    content_merge:
      function: "merge"
      inputs: ["content_writer.output", "technical_writer.output"]
      template: |
        Proposal Content:
        
        {content_writer.output}
        
        Technical Details:
        {technical_writer.output}
        
    # Phase 3: Review and editing pipeline
    phase_3:
      sequence: |
        content_merge -> reviewer ? review_passed -> editor
        
    review_passed:
      condition: "success"
      on_failure: |
        content_merge -> reviewer -> content_writer -> reviewer ? review_passed -> editor
        
    # Phase 4: Legal review (conditional)
    phase_4:
      sequence: |
        editor -> legal_reviewer ? legal_required -> final_output
        
    legal_required:
      condition: "contains"
      condition_value: "contract"
      on_false: "editor -> final_output"
      
    final_output:
      function: "transform"
      template: |
        # Final Proposal
        
        Generated: {timestamp}
        Topic: {context.topic}
        
        {editor.output}
        
        Legal Review: {legal_reviewer.output || "Not required"}

# Alternative flow syntax examples
alternative_flows:
    
    # Simple sequence
    simple_sequence: |
      research_agent -> content_writer -> reviewer -> editor
      
    # Parallel with join
    parallel_research: |
      (research_agent || market_analyst || competitive_analysis) & merge_research -> content_writer
      
    # Conditional branching
    conditional_flow: |
      research_agent -> content_writer < (
        reviewer,          # if success
        research_agent,    # if failure - retry research
        success           # condition
      ) -> editor
      
    # Loop example
    iterative_improvement: |
      content_writer -> reviewer * 3 -> editor
      
    # Error handling
    error_handling: |
      research_agent ! backup_research -> content_writer
      
    # Async execution
    async_flow: |
      ~background_research || main_content -> final_merge
      
    # Pipeline with data passing
    data_pipeline: |
      research_agent >> content_writer >> reviewer >> editor
      
    # Complex conditional with fallback
    complex_conditional: |
      research_agent -> (
        detailed_analysis ? sufficient_data |
        supplementary_research -> detailed_analysis
      ) -> content_writer
      
    # Nested conditions
    nested_conditions: |
      research_agent -> content_writer < (
        technical_writer < (
          legal_reviewer,     # if technical and legal needed
          final_output,       # if technical but no legal
          legal_required     # condition
        ),
        simple_output,        # if no technical needed  
        technical_required    # condition
      )

# Data transformations
transformations:
    
    merge_research:
      type: "merge"
      inputs: ["research_agent", "market_analyst"]
      output_format: "structured"
      
    format_proposal:
      type: "template" 
      template: |
        # Proposal: {context.topic}
        
        ## Executive Summary
        {content_writer.summary}
        
        ## Research Findings  
        {research_agent.findings}
        
        ## Technical Implementation
        {technical_writer.implementation}
        
        ## Next Steps
        {editor.recommendations}

# Validation rules
validation:
    
    research_completeness:
      agent: "research_agent"
      rules:
        - "output.length > 500"
        - "output.sources.length >= 3"
        - "not output.contains('TODO')"
        
    content_quality:
      agent: "content_writer" 
      rules:
        - "output.word_count >= 1000"
        - "output.sections.length >= 4"
        - "output.readability_score > 7"

# Error handling strategies
error_handling:
    
    research_failure:
      trigger: "research_agent.error"
      action: "retry"
      max_attempts: 3
      fallback: "use_cached_research"
      
    content_quality_failure:
      trigger: "content_writer.quality_score < 0.7"
      action: "rework"
      instructions: "Improve clarity and persuasiveness"

# Monitoring and metrics
monitoring:
    
    performance_metrics:
      - "execution_time"
      - "success_rate"
      - "quality_scores"
      - "user_satisfaction"
      
    alerts:
      - condition: "execution_time > 600"
        action: "notify_admin"
      - condition: "success_rate < 0.8"
        action: "escalate"
# Post-processing
post_processing:
    
    quality_check:
      enabled: true
      rules: "validation.content_quality"
      
    formatting:
      enabled: true
      style: "professional"
      
    delivery:
      format: ["pdf", "docx", "html"]
      recipients: "${input.stakeholders}"
"""
	
	@classmethod  
	def get_syntax_reference(cls) -> Dict[str, Any]:
		"""Get complete syntax reference for the composition language"""
		return {
			"version": cls.VERSION,
			"operators": {
				"sequential": {
					"syntax": "agent1 -> agent2",
					"description": "Execute agents in sequence",
					"example": "research -> analysis -> content"
				},
				"parallel": {
					"syntax": "agent1 || agent2",
					"description": "Execute agents in parallel", 
					"example": "(research || market_analysis) -> content"
				},
				"branch": {
					"syntax": "agent1 < (agent2, agent3, condition)",
					"description": "Conditional branching based on result",
					"example": "research < (detailed_analysis, basic_summary, sufficient_data)"
				},
				"pipeline": {
					"syntax": "agent1 >> agent2",
					"description": "Pass data through pipeline",
					"example": "research >> analysis >> content"
				},
				"join": {
					"syntax": "agent1 & agent2",
					"description": "Wait for all parallel agents to complete",
					"example": "(research || analysis) & content"
				},
				"conditional": {
					"syntax": "agent1 ? condition",
					"description": "Execute only if condition is met",
					"example": "legal_review ? contract_required"
				},
				"loop": {
					"syntax": "agent1 * count",
					"description": "Repeat agent execution",
					"example": "review * 3"
				},
				"error_handler": {
					"syntax": "agent1 ! error_agent",
					"description": "Execute error_agent if agent1 fails",
					"example": "research ! backup_research"
				},
				"async": {
					"syntax": "~agent1",
					"description": "Execute asynchronously (fire and forget)",
					"example": "~background_task || main_flow"
				},
				"fallback": {
					"syntax": "agent1 | agent2", 
					"description": "Execute agent2 if agent1 fails",
					"example": "primary_research | cached_research"
				}
			},
			"conditions": cls.CONDITIONS,
			"functions": cls.FUNCTIONS,
			"structure": {
				"required_sections": ["composition", "agents", "flow"],
				"optional_sections": ["config", "context", "transformations", "validation", "error_handling", "monitoring"],
				"agent_properties": [
					"type", "model", "temperature", "prompt", "tools", "timeout", "retries"
				],
				"flow_properties": [
					"sequence", "condition", "on_success", "on_failure", "timeout", "retry"
				]
			},
			"examples": {
				"simple_sequence": "agent1 -> agent2 -> agent3",
				"parallel_execution": "agent1 || agent2 || agent3",
				"conditional_branch": "agent1 < (agent2, agent3, success)",
				"complex_flow": "(agent1 || agent2) & merge -> agent3 ? validated -> agent4",
				"error_handling": "agent1 ! error_handler -> agent2 | fallback",
				"loop_with_condition": "agent1 -> (agent2 * until_complete) -> agent3"
			}
		}
	
	@classmethod
	def validate_syntax(cls, composition_text: str) -> Dict[str, Any]:
		"""Validate composition syntax"""
		errors = []
		warnings = []
		
		# Basic validation rules
		required_sections = ["composition", "agents", "flow"]
		
		try:
			import yaml
			composition = yaml.safe_load(composition_text)
			
			# Check required sections
			for section in required_sections:
				if section not in composition:
					errors.append(f"Missing required section: {section}")
			
			# Validate agents section
			if "agents" in composition:
				agents = composition["agents"]
				if not isinstance(agents, dict):
					errors.append("Agents section must be a dictionary")
				else:
					for agent_id, agent_config in agents.items():
						if not isinstance(agent_config, dict):
							errors.append(f"Agent {agent_id} configuration must be a dictionary")
						else:
							# Check required agent properties
							if "type" not in agent_config:
								warnings.append(f"Agent {agent_id} missing type specification")
							if "prompt" not in agent_config:
								warnings.append(f"Agent {agent_id} missing prompt")
			
			# Validate flow syntax (basic check)
			if "flow" in composition:
				flow = composition["flow"]
				if isinstance(flow, dict):
					for flow_id, flow_config in flow.items():
						if "sequence" in flow_config:
							sequence = flow_config["sequence"]
							# Check for valid operators
							for operator in cls.OPERATORS.keys():
								if operator in sequence:
									# Valid operator found
									break
							else:
								warnings.append(f"Flow {flow_id} may not contain valid operators")
			
		except yaml.YAMLError as e:
			errors.append(f"YAML syntax error: {str(e)}")
		except Exception as e:
			errors.append(f"Validation error: {str(e)}")
		
		return {
			"valid": len(errors) == 0,
			"errors": errors,
			"warnings": warnings,
			"total_issues": len(errors) + len(warnings)
		}
	
	@classmethod
	def get_language_features(cls) -> Dict[str, Any]:
		"""Get comprehensive language features documentation"""
		return {
			"declarative_syntax": {
				"description": "YAML-based declarative workflow definition",
				"benefits": [
					"Human-readable configuration",
					"Version control friendly", 
					"Easy to maintain and modify",
					"Language-agnostic"
				]
			},
			"operator_system": {
				"description": "Rich set of operators for flow control",
				"operators": list(cls.OPERATORS.keys()),
				"composability": "Operators can be nested and combined for complex logic"
			},
			"conditional_logic": {
				"description": "Built-in conditions and custom condition support",
				"built_in_conditions": list(cls.CONDITIONS.keys()),
				"custom_conditions": "Support for JavaScript-like expressions"
			},
			"error_handling": {
				"description": "Comprehensive error handling and recovery",
				"features": [
					"Automatic retries",
					"Fallback agents", 
					"Error routing",
					"Circuit breakers"
				]
			},
			"parallelism": {
				"description": "Built-in support for parallel execution",
				"features": [
					"Parallel agent execution",
					"Join synchronization",
					"Load balancing",
					"Resource management"
				]
			},
			"data_flow": {
				"description": "Flexible data passing between agents",
				"features": [
					"Pipeline data flow",
					"Context variables",
					"Data transformations",
					"Result merging"
				]
			},
			"extensibility": {
				"description": "Extensible with custom functions and conditions",
				"features": [
					"Custom functions",
					"Plugin system",
					"Template system",
					"Validation rules"
				]
			}
		}