"""
Discovery Matchers Module

Advanced matching and filtering capabilities for opportunity discovery,
including semantic matching, relevance filtering, and multi-criteria
opportunity assessment.
"""

try:
	from .capability_matcher import CapabilityMatcher
except ImportError:
	CapabilityMatcher = None

from .relevance_filter import RelevanceFilter
# from .eligibility_matcher import EligibilityMatcher  # Future implementation
# from .strategic_matcher import StrategicMatcher      # Future implementation

__all__ = [
	"CapabilityMatcher",
	"RelevanceFilter",
	# "EligibilityMatcher",
	# "StrategicMatcher"
]