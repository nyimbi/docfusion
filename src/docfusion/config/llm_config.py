#!/usr/bin/env python3
"""
Centralized LLM Configuration Management

Provides centralized configuration for all LLM usage across the system,
allowing fine-grained control over model selection, parameters, and resource allocation.
"""

import logging
import os
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, Optional, Union

try:
	import yaml
except ImportError:
	yaml = None

from ..core.utils import uuid7str

class LLMTask(Enum):
    """Standard LLM task categories"""

    STYLE_ANALYSIS = "nlp.style_analysis"
    SEMANTIC_ANALYSIS = "nlp.semantic_analysis"
    COHERENCE_ANALYSIS = "nlp.coherence_analysis"
    READABILITY_ANALYSIS = "nlp.readability_analysis"
    RELATIONSHIP_EXTRACTION = "nlp.relationship_extraction"

    DOCUMENT_CONTENT = "content_generation.document_content"
    EXECUTIVE_SUMMARY = "content_generation.executive_summary"
    TECHNICAL_SPECS = "content_generation.technical_specs"

    STYLE_TRANSFORMATION = "content_transformation.style_transformation"
    SUMMARIZATION = "content_transformation.summarization"
    CONTENT_OPTIMIZATION = "content_transformation.content_optimization"

    CAUSAL_ANALYSIS = "specialized_analysis.causal_analysis"
    CONTEXT_ANALYSIS = "specialized_analysis.context_analysis"

    # Compliance-specific tasks
    COMPLIANCE_ANALYSIS = "compliance.compliance_analysis"
    REGULATORY_VALIDATION = "compliance.regulatory_validation"
    EVIDENCE_ASSESSMENT = "compliance.evidence_assessment"
    RISK_ASSESSMENT = "compliance.risk_assessment"
    GAP_ANALYSIS = "compliance.gap_analysis"
    VIOLATION_ANALYSIS = "compliance.violation_analysis"
    COMPLIANCE_REPORTING = "compliance.compliance_reporting"
    REGULATORY_INTERPRETATION = "compliance.regulatory_interpretation"

class ModelProfile(Enum):
    """Pre-defined model profiles for common use cases"""

    REASONING_HEAVY = "reasoning_heavy"
    CREATIVE = "creative"
    LIGHTWEIGHT = "lightweight"
    PRECISION = "precision"

@dataclass
class LLMConfiguration:
    """LLM configuration for a specific task or component"""

    task_id: str = ""
    model: str = "deepseek-r1:32b"
    base_url: str = "http://localhost:11434"
    timeout: float = 120.0
    temperature: float = 0.2
    top_p: float = 0.9
    num_predict: int = 1000
    description: str = ""

    # Advanced options
    enable_thinking_filter: bool = True
    enable_cot: bool = True  # Chain of Thought
    enable_tot: bool = True  # Tree of Thought

    # Retry and fallback
    max_retries: int = 2
    fallback_model: Optional[str] = None

    def to_ollama_options(self) -> Dict[str, Any]:
        """Convert to Ollama API options format"""
        return {
            "temperature": self.temperature,
            "top_p": self.top_p,
            "num_predict": self.num_predict,
        }

    def to_request_params(self) -> Dict[str, Any]:
        """Convert to complete request parameters"""
        return {
            "model": self.model,
            "stream": False,
            "options": self.to_ollama_options(),
        }

class LLMConfigManager:
    """Centralized LLM configuration manager"""

    def __init__(
        self,
        config_path: Optional[Union[str, Path]] = None,
        environment: str = "development",
    ):
        self.environment = environment
        self.logger = logging.getLogger(__name__)
        self._config_data: Dict[str, Any] = {}
        self._task_configs: Dict[str, LLMConfiguration] = {}

        # Default config path
        if config_path is None:
            config_path = (
                Path(__file__).parent.parent.parent.parent
                / "config"
                / "llm_config.yaml"
            )

        self.config_path = Path(config_path)
        self.load_configuration()

    def load_configuration(self):
        """Load configuration from YAML file"""
        if not yaml:
            self.logger.warning("PyYAML not available, using default configurations")
            self._load_defaults()
            return

        if not self.config_path.exists():
            self.logger.warning(
                f"Config file not found: {self.config_path}, using defaults"
            )
            self._load_defaults()
            return

        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                self._config_data = yaml.safe_load(f)

            self._build_task_configurations()
            self.logger.info(f"Loaded LLM configuration from {self.config_path}")

        except Exception as e:
            self.logger.error(f"Failed to load config: {e}, using defaults")
            self._load_defaults()

    def _load_defaults(self):
        """Load default configuration when YAML is unavailable"""
        self._config_data = {
            "defaults": {
                "base_url": "http://localhost:11434",
                "timeout": 120.0,
                "temperature": 0.2,
                "top_p": 0.9,
                "num_predict": 1000,
            },
            "features": {
                "enable_thinking_tag_filtering": True,
                "enable_chain_of_thought": True,
                "enable_tree_of_thought": True,
            },
        }
        self._build_task_configurations()

    def _build_task_configurations(self):
        """Build task-specific configurations from loaded data"""
        defaults = self._config_data.get("defaults", {})
        features = self._config_data.get("features", {})

        # Apply environment-specific overrides
        env_config = self._config_data.get("environments", {}).get(self.environment, {})

        # Build configurations for each defined task
        for category, tasks in self._config_data.items():
            if category in ["defaults", "environments", "features", "model_profiles"]:
                continue

            if isinstance(tasks, dict):
                for task_name, task_config in tasks.items():
                    if isinstance(task_config, dict):
                        full_task_id = f"{category}.{task_name}"
                        config = self._create_task_config(
                            full_task_id, task_config, defaults, env_config, features
                        )
                        self._task_configs[full_task_id] = config

    def _create_task_config(
        self,
        task_id: str,
        task_config: Dict[str, Any],
        defaults: Dict[str, Any],
        env_config: Dict[str, Any],
        features: Dict[str, Any],
    ) -> LLMConfiguration:
        """Create a task configuration with proper inheritance"""

        config = LLMConfiguration(task_id=task_id)

        # Apply defaults first
        config.base_url = defaults.get("base_url", config.base_url)
        config.timeout = defaults.get("timeout", config.timeout)
        config.temperature = defaults.get("temperature", config.temperature)
        config.top_p = defaults.get("top_p", config.top_p)
        config.num_predict = defaults.get("num_predict", config.num_predict)

        # Apply environment overrides
        config.model = env_config.get(
            "default_model", task_config.get("model", config.model)
        )
        config.timeout = env_config.get(
            "default_timeout", task_config.get("timeout", config.timeout)
        )
        config.num_predict = env_config.get(
            "default_num_predict", task_config.get("num_predict", config.num_predict)
        )

        # Apply task-specific settings
        for key, value in task_config.items():
            if hasattr(config, key):
                setattr(config, key, value)

        # Apply feature flags
        config.enable_thinking_filter = features.get(
            "enable_thinking_tag_filtering", True
        )
        config.enable_cot = features.get("enable_chain_of_thought", True)
        config.enable_tot = features.get("enable_tree_of_thought", True)

        return config

    def get_config(
        self, task: Union[LLMTask, str], profile: Optional[ModelProfile] = None
    ) -> LLMConfiguration:
        """Get configuration for a specific task"""

        # Convert enum to string if needed
        task_id = task.value if isinstance(task, LLMTask) else str(task)

        # Check if we have a specific config for this task
        if task_id in self._task_configs:
            config = self._task_configs[task_id]
        else:
            # Create default config for unknown tasks
            config = self._create_default_config(task_id)

        # Apply profile overrides if specified
        if profile:
            config = self._apply_profile(config, profile)

        return config

    def _create_default_config(self, task_id: str) -> LLMConfiguration:
        """Create default configuration for unknown tasks"""
        defaults = self._config_data.get("defaults", {})
        features = self._config_data.get("features", {})

        config = LLMConfiguration(task_id=task_id)
        config.base_url = defaults.get("base_url", config.base_url)
        config.timeout = defaults.get("timeout", config.timeout)
        config.temperature = defaults.get("temperature", config.temperature)
        config.top_p = defaults.get("top_p", config.top_p)
        config.num_predict = defaults.get("num_predict", config.num_predict)

        config.enable_thinking_filter = features.get(
            "enable_thinking_tag_filtering", True
        )
        config.enable_cot = features.get("enable_chain_of_thought", True)
        config.enable_tot = features.get("enable_tree_of_thought", True)

        return config

    def _apply_profile(
        self, config: LLMConfiguration, profile: ModelProfile
    ) -> LLMConfiguration:
        """Apply a model profile to override configuration"""
        profiles = self._config_data.get("model_profiles", {})
        profile_config = profiles.get(profile.value, {})

        # Create a copy and apply profile settings
        new_config = LLMConfiguration(**config.__dict__)

        for key, value in profile_config.items():
            if hasattr(new_config, key):
                setattr(new_config, key, value)

        return new_config

    def get_all_tasks(self) -> Dict[str, LLMConfiguration]:
        """Get all configured tasks"""
        return self._task_configs.copy()

    def update_task_config(self, task: Union[LLMTask, str], updates: Dict[str, Any]):
        """Update configuration for a specific task at runtime"""
        task_id = task.value if isinstance(task, LLMTask) else str(task)

        if task_id in self._task_configs:
            config = self._task_configs[task_id]
            for key, value in updates.items():
                if hasattr(config, key):
                    setattr(config, key, value)
                    self.logger.info(f"Updated {task_id}.{key} = {value}")

    def reload_configuration(self):
        """Reload configuration from file"""
        self.load_configuration()
        self.logger.info("Configuration reloaded")

    def get_config_summary(self) -> Dict[str, Any]:
        """Get summary of all configurations"""
        return {
            "environment": self.environment,
            "config_path": str(self.config_path),
            "total_tasks": len(self._task_configs),
            "tasks": {
                task_id: {
                    "model": config.model,
                    "timeout": config.timeout,
                    "temperature": config.temperature,
                    "num_predict": config.num_predict,
                    "description": config.description,
                }
                for task_id, config in self._task_configs.items()
            },
        }

# Global configuration manager instance
_global_config_manager: Optional[LLMConfigManager] = None

def get_llm_config_manager(
    config_path: Optional[Union[str, Path]] = None, environment: Optional[str] = None
) -> LLMConfigManager:
    """Get the global LLM configuration manager instance"""
    global _global_config_manager

    if _global_config_manager is None or config_path is not None:
        env = environment or os.getenv("ENVIRONMENT", "development")
        _global_config_manager = LLMConfigManager(config_path, env)

    return _global_config_manager

def get_llm_config(
    task: Union[LLMTask, str], profile: Optional[ModelProfile] = None
) -> LLMConfiguration:
    """Convenience function to get LLM configuration"""
    manager = get_llm_config_manager()
    return manager.get_config(task, profile)

# Example usage functions
def configure_for_style_analysis() -> LLMConfiguration:
    """Get configuration optimized for style analysis"""
    return get_llm_config(LLMTask.STYLE_ANALYSIS)

def configure_for_content_generation() -> LLMConfiguration:
    """Get configuration optimized for content generation"""
    return get_llm_config(LLMTask.DOCUMENT_CONTENT)

def configure_for_semantic_analysis() -> LLMConfiguration:
    """Get configuration optimized for semantic analysis"""
    return get_llm_config(LLMTask.SEMANTIC_ANALYSIS)

# Development utilities
def print_config_summary():
    """Print configuration summary for debugging"""
    manager = get_llm_config_manager()
    summary = manager.get_config_summary()

    logger.info(f"LLM Configuration Summary")
    logger.info(f"Environment: {summary['environment']}")
    logger.info(f"Config Path: {summary['config_path']}")
    logger.info(f"Total Tasks: {summary['total_tasks']}")
    print()

    for task_id, config in summary["tasks"].items():
        logger.info(f"{task_id}:")
        logger.info(f"  Model: {config['model']}")
        logger.info(f"  Timeout: {config['timeout']}s")
        logger.info(f"  Temperature: {config['temperature']}")
        logger.info(f"  Num Predict: {config['num_predict']}")
        if config["description"]:
            logger.info(f"  Description: {config['description']}")
        print()

if __name__ == "__main__":
    # Demo the configuration system
    print_config_summary()
