"""
Sentiment Analyzer Service

Provides basic sentiment analysis for text content.
"""

import re
from typing import Dict


# Basic positive/negative word lists for heuristic sentiment
_POSITIVE_WORDS = frozenset({
	"good", "great", "excellent", "outstanding", "superior", "best",
	"innovative", "reliable", "efficient", "effective", "proven",
	"strong", "robust", "comprehensive", "competitive", "advantage",
})

_NEGATIVE_WORDS = frozenset({
	"bad", "poor", "terrible", "worst", "weak", "failed", "inadequate",
	"unreliable", "inefficient", "ineffective", "limited", "complex",
	"expensive", "slow", "difficult", "risk", "concern",
})


class SentimentAnalyzer:
	"""Basic sentiment analysis using keyword heuristics."""

	def analyze(self, text: str) -> Dict[str, any]:
		"""Analyze sentiment of text, returning scores and label."""
		if not text:
			return {"score": 0.0, "label": "neutral", "confidence": 0.0}

		words = set(re.findall(r'\b[a-zA-Z]+\b', text.lower()))
		positive_count = len(words & _POSITIVE_WORDS)
		negative_count = len(words & _NEGATIVE_WORDS)
		total = max(len(words), 1)

		score = (positive_count - negative_count) / total
		label = "positive" if score > 0.05 else "negative" if score < -0.05 else "neutral"
		confidence = min(abs(score) * 10, 1.0)

		return {
			"score": round(score, 4),
			"label": label,
			"confidence": round(confidence, 4),
			"positive_terms": positive_count,
			"negative_terms": negative_count,
		}