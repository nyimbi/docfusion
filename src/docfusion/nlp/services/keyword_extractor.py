"""
Keyword Extractor Service

Provides basic keyword extraction from text using frequency analysis.
"""

import re
from collections import Counter
from typing import Dict, List, Optional


# Common English stop words for filtering
_STOP_WORDS = frozenset({
	"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
	"of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
	"being", "have", "has", "had", "do", "does", "did", "will", "would",
	"could", "should", "may", "might", "can", "shall", "this", "that",
	"these", "those", "it", "its", "not", "no", "nor", "so", "if",
})


class KeywordExtractor:
	"""Basic keyword extraction using frequency and positional analysis."""

	def extract(
		self,
		text: str,
		max_keywords: int = 10,
		min_length: int = 3,
	) -> List[Dict[str, any]]:
		"""Extract keywords with relevance scores from text."""
		if not text:
			return []

		words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
		filtered = [w for w in words if w not in _STOP_WORDS]

		if not filtered:
			return []

		word_freq = Counter(filtered)
		max_freq = max(word_freq.values())

		keywords = []
		for word, freq in word_freq.most_common(max_keywords):
			score = freq / max_freq
			keywords.append({
				"keyword": word,
				"frequency": freq,
				"score": round(score, 4),
			})

		return keywords