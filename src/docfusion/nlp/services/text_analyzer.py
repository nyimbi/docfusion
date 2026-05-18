"""
Text Analyzer Service

Provides basic text analysis capabilities including readability,
complexity, and linguistic feature extraction.
"""

import re
from typing import Any, Dict, List


class TextAnalyzer:
	"""Basic text analysis service for content understanding."""

	def analyze(self, text: str) -> Dict[str, Any]:
		"""Analyze text and return basic metrics."""
		if not text:
			return {"word_count": 0, "sentence_count": 0, "avg_word_length": 0.0}

		words = text.split()
		sentences = re.split(r'[.!?]+', text)
		sentences = [s.strip() for s in sentences if s.strip()]

		return {
			"word_count": len(words),
			"sentence_count": len(sentences),
			"avg_word_length": sum(len(w) for w in words) / max(len(words), 1),
			"avg_sentence_length": len(words) / max(len(sentences), 1),
		}

	def extract_keywords(self, text: str, max_keywords: int = 10) -> List[str]:
		"""Extract key terms from text using frequency analysis."""
		words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
		from collections import Counter
		word_freq = Counter(words)
		return [w for w, _ in word_freq.most_common(max_keywords)]