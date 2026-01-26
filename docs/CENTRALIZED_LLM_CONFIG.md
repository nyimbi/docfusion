# Centralized LLM Configuration System

The proposal writer now uses a centralized LLM configuration system that allows fine-grained control over model selection, parameters, and resource allocation for different tasks.

## Key Benefits

- **Single Point of Configuration**: All LLM settings managed in one YAML file
- **Task-Specific Optimization**: Different models and parameters for different use cases
- **Environment-Specific Overrides**: Different settings for dev/staging/production
- **Model Profiles**: Pre-defined configurations for common patterns
- **Runtime Configuration**: Update settings without code changes
- **Backward Compatibility**: Legacy code continues to work

## Configuration File Structure

The main configuration is in `config/llm_config.yaml`:

```yaml
# Global defaults
defaults:
  base_url: "http://localhost:11434"
  timeout: 120.0
  temperature: 0.2
  top_p: 0.9
  num_predict: 1000

# Task-specific configurations
nlp:
  style_analysis:
    model: "deepseek-r1:32b"
    timeout: 120.0
    temperature: 0.1
    num_predict: 1500
    description: "Style and tone analysis with reasoning"

# Environment overrides
environments:
  development:
    default_model: "llama3.2:3b"  # Faster for dev
  production:
    default_model: "deepseek-r1:32b"  # Quality for prod

# Feature flags
features:
  enable_thinking_tag_filtering: true
  enable_chain_of_thought: true
  enable_tree_of_thought: true
```

## Using the Configuration System

### Basic Usage

```python
from proposal_writer.config.llm_config import get_llm_config, LLMTask

# Get configuration for a specific task
config = get_llm_config(LLMTask.STYLE_ANALYSIS)
print(f"Model: {config.model}")
print(f"Timeout: {config.timeout}")
print(f"Temperature: {config.temperature}")
```

### Creating Analyzers with Centralized Config

```python
from proposal_writer.nlp.analyzers.style_analyzer import create_style_analyzer
from proposal_writer.config.llm_config import get_llm_config, LLMTask

# Get the centralized config for style analysis
style_config = get_llm_config(LLMTask.STYLE_ANALYSIS)

# Create analyzer with centralized config
analyzer = create_style_analyzer(llm_config=style_config)
```

### Using Model Profiles

```python
from proposal_writer.config.llm_config import get_llm_config, LLMTask, ModelProfile

# Use precision profile for critical analysis
precise_config = get_llm_config(LLMTask.STYLE_ANALYSIS, ModelProfile.PRECISION)
analyzer = create_style_analyzer(llm_config=precise_config)

# Use lightweight profile for quick processing
fast_config = get_llm_config(LLMTask.READABILITY_ANALYSIS, ModelProfile.LIGHTWEIGHT)
```

### Runtime Configuration Updates

```python
from proposal_writer.config.llm_config import get_llm_config_manager

manager = get_llm_config_manager()

# Update timeout for all style analysis tasks
manager.update_task_config(
    LLMTask.STYLE_ANALYSIS,
    {"timeout": 180.0}
)

# Reload configuration from file
manager.reload_configuration()
```

## Available LLM Tasks

### NLP Analysis Tasks
- `LLMTask.STYLE_ANALYSIS` - Style and tone analysis
- `LLMTask.SEMANTIC_ANALYSIS` - Topic modeling and semantic understanding
- `LLMTask.COHERENCE_ANALYSIS` - Document coherence and flow analysis
- `LLMTask.READABILITY_ANALYSIS` - Readability and complexity assessment
- `LLMTask.RELATIONSHIP_EXTRACTION` - Entity and relationship extraction

### Content Generation Tasks
- `LLMTask.DOCUMENT_CONTENT` - Primary document content generation
- `LLMTask.EXECUTIVE_SUMMARY` - Executive summary generation
- `LLMTask.TECHNICAL_SPECS` - Technical specification generation

### Content Transformation Tasks
- `LLMTask.STYLE_TRANSFORMATION` - Content style adaptation
- `LLMTask.SUMMARIZATION` - Document summarization
- `LLMTask.CONTENT_OPTIMIZATION` - Content improvement

### Specialized Analysis Tasks
- `LLMTask.CAUSAL_ANALYSIS` - Statistical and causal analysis
- `LLMTask.CONTEXT_ANALYSIS` - Document context understanding

## Available Model Profiles

- `ModelProfile.REASONING_HEAVY` - High-reasoning tasks (deepseek-r1:32b, low temp)
- `ModelProfile.CREATIVE` - Creative tasks (higher temperature)
- `ModelProfile.LIGHTWEIGHT` - Fast processing (llama3.2:3b)
- `ModelProfile.PRECISION` - High-precision factual tasks (very low temp)

## Environment Configuration

Set the `ENVIRONMENT` environment variable to control which settings are used:

```bash
export ENVIRONMENT=production  # Use production settings
export ENVIRONMENT=development # Use development settings (default)
```

## Best Practices

1. **Use Task-Specific Configs**: Always use the appropriate `LLMTask` enum value
2. **Profile Selection**: Choose the right profile for your use case
3. **Environment Settings**: Configure different models/timeouts per environment
4. **Monitor Usage**: Different tasks have different resource requirements
5. **Test Configuration Changes**: Always test config changes in development first

## Backward Compatibility

Existing code continues to work. The system provides fallbacks for:
- Missing YAML configuration files
- Legacy analyzer constructors
- Missing dependencies (PyYAML, etc.)

## Troubleshooting

### Configuration Not Loading
- Check that `config/llm_config.yaml` exists
- Verify YAML syntax is valid
- Check file permissions

### Wrong Model Being Used
- Verify environment variable settings
- Check task-specific overrides
- Review profile applications

### Performance Issues
- Adjust timeouts per task
- Use lightweight profiles for fast operations
- Monitor model selection per environment

## Testing the Configuration

Run the test script to verify everything is working:

```bash
python test_centralized_config.py
```

This will test:
- Configuration loading
- Task-specific configurations
- Analyzer creation
- Model profiles
- Full system integration