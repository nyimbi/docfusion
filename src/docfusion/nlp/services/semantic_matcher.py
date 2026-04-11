"""
Semantic Matcher Service

Provides basic semantic similarity matching between texts.
"""

import re
from typing import Dict, List, Optional


class SemanticMatcher:
	"""Basic semantic matching service using keyword overlap."""

	def match(self, text_a: str, text_b: str) -> float:
		"""Calculate semantic similarity between two texts (0.0 to 1.0)."""
		if not text_a or not text_b:
			return 0.0

		words_a = set(re.findall(r'\b[a-zA-Z]{3,}\b', text_a.lower()))
		words_b = set(re.findall(r'\b[a-zA-Z]{3,}\b', text_b.lower()))

		if not words_a or not words_b:
			return 0.0

		intersection = words_a & words_b
		union = words_a | words_b
		return len(intersection) / max(len(union), 1)

	def find_matches(
		self,
		query: str,
		candidates: List[str],
		threshold: float = 0.3,
	) -> List[Dict[str, any]]:
		"""Find candidate texts that match the query above threshold."""
		results = []
		for i, candidate in enumerate(candidates):
			score = self.match(query, candidate)
			if score >= threshold:
				results.append({"index": i, "text": candidate, "score": score})
		results.sort(key=lambda x: x["score"], reverse=True)
		return results