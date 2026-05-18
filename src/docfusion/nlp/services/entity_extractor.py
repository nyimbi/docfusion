"""
Entity Extractor Service

Provides basic named entity extraction from text.
"""

import re
from typing import Dict, List


class EntityExtractor:
	"""Basic entity extraction using pattern matching."""

	def extract(self, text: str) -> List[Dict[str, str]]:
		"""Extract named entities from text."""
		entities = []

		# Email patterns
		for match in re.finditer(r'[\w.+-]+@[\w-]+\.[\w.]+', text):
			entities.append({"text": match.group(), "type": "email"})

		# URL patterns
		for match in re.finditer(r'https?://[^\s<>"]+', text):
			entities.append({"text": match.group(), "type": "url"})

		# Phone patterns
		for match in re.finditer(r'\+?\d[\d\s-]{7,}\d', text):
			entities.append({"text": match.group(), "type": "phone"})

		# Monetary amounts
		for match in re.finditer(r'\$[\d,]+(?:\.\d{2})?', text):
			entities.append({"text": match.group(), "type": "money"})

		# Date patterns
		for match in re.finditer(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', text):
			entities.append({"text": match.group(), "type": "date"})

		return entities