"""Named constants for scoring thresholds and weights used across the discovery pipeline."""

# ---------------------------------------------------------------------------
# Cache efficiency thresholds
# ---------------------------------------------------------------------------
CACHE_EFFICIENCY_LOW = 0.3
CACHE_EFFICIENCY_TARGET = 0.9

# ---------------------------------------------------------------------------
# Scoring weights for agent assignment
# ---------------------------------------------------------------------------
CAPABILITY_WEIGHT = 0.5
LOAD_WEIGHT = 0.3
PROXIMITY_WEIGHT = 0.2

# ---------------------------------------------------------------------------
# Bid and quality thresholds
# ---------------------------------------------------------------------------
BID_ACCEPTANCE_THRESHOLD = 0.5
QUALITY_HIGH_THRESHOLD = 0.9
VOICE_CONSISTENCY_TARGET = 0.95
OVERALL_SCORE_MINIMUM = 0.6

# ---------------------------------------------------------------------------
# Communication
# ---------------------------------------------------------------------------
COMMUNICATION_INITIATION_PROBABILITY = 0.3

# ---------------------------------------------------------------------------
# Risk scoring
# ---------------------------------------------------------------------------
RISK_HIGH_THRESHOLD = 0.5
RISK_MEDIUM_THRESHOLD = 0.3

# ---------------------------------------------------------------------------
# Performance grading
# ---------------------------------------------------------------------------
FAST_EXECUTION_THRESHOLD = 0.5  # seconds
