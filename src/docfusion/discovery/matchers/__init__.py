"""
Discovery Matchers Module

Advanced matching and filtering capabilities for opportunity discovery,
including semantic matching, relevance filtering, and multi-criteria
opportunity assessment.
"""

from .capability_matcher import CapabilityMatcher
from .relevance_filter import RelevanceFilter
# from .eligibility_matcher import EligibilityMatcher  # Future implementation
# from .strategic_matcher import StrategicMatcher      # Future implementation

__all__ = [
    "CapabilityMatcher",
    "RelevanceFilter",
    # "EligibilityMatcher",
    # "StrategicMatcher"
]