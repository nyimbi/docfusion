#!/usr/bin/env python3
"""
Text Cleaner

Advanced text cleaning and normalization with Ollama-based intelligent
preprocessing for document understanding and NLP analysis.
"""

import asyncio
import html
import logging
import re
import unicodedata
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

# Ollama integration
import json

import httpx
from ...core.utils import uuid7str

class CleaningResult:
    """Result of text cleaning operations"""

    def __init__(self):
        self.success: bool = False
        self.original_text: str = ""
        self.cleaned_text: str = ""
        self.removed_elements: Dict[str, List[str]] = {}
        self.statistics: Dict[str, int] = {}
        self.warnings: List[str] = []
        self.errors: List[str] = []
        self.processing_time: float = 0.0
        self.ai_enhancements: Dict[str, Any] = {}

class OllamaTextCleaner:
    """AI-powered text cleaner using Ollama for intelligent preprocessing"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or self._get_default_config()
        self.logger = logging.getLogger(__name__)

        # Initialize Ollama client
        self.ollama_client = httpx.AsyncClient(
            base_url=self.config["ollama_base_url"],
            timeout=self.config["ollama_timeout"],
        )

        # Common patterns
        self._init_patterns()

        self.logger.info("Ollama-based text cleaner initialized")

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration"""
        return {
            # Ollama settings
            "ollama_base_url": "http://localhost:11434",
            "ollama_model": "llama3.2:3b",
            "ollama_timeout": 60.0,
            "use_ai_cleaning": True,
            # Cleaning options
            "remove_headers_footers": True,
            "remove_page_numbers": True,
            "normalize_whitespace": True,
            "normalize_unicode": True,
            "remove_ocr_artifacts": True,
            "fix_line_breaks": True,
            "preserve_structure": True,
            "remove_noise_patterns": True,
            # AI enhancement options
            "ai_structure_detection": True,
            "ai_noise_detection": True,
            "ai_content_classification": True,
            "ai_language_correction": True,
            # Performance settings
            "max_text_length": 100000,  # 100k chars for AI processing
            "chunk_size": 5000,  # Process in chunks for large texts
            "parallel_processing": True,
        }

    def _init_patterns(self):
        """Initialize common cleaning patterns"""
        # Header/footer patterns
        self.header_patterns = [
            r"^.*?(?:page \d+|confidential|draft|internal use only).*?$",
            r"^.*?(?:company name|organization).*?$",
            r"^\s*(?:prepared by|document version|last updated).*?$",
        ]

        # Footer patterns
        self.footer_patterns = [
            r"^\s*(?:page \d+ of \d+|\d+ of \d+|page \d+)\s*$",
            r"^\s*(?:copyright|©|confidential|proprietary).*?$",
            r"^\s*(?:generated on|printed on|last modified).*?$",
        ]

        # OCR artifact patterns
        self.ocr_artifact_patterns = [
            r"\s+([.,:;!?])",  # Space before punctuation
            r"([a-zA-Z])([A-Z][a-z])",  # Missing space between words
            r"(\d)\s+(\d)",  # Broken numbers
            r"[|]{2,}",  # Multiple pipe characters
            r"[_]{3,}",  # Multiple underscores
            r"[\-]{3,}",  # Multiple dashes
        ]

        # Noise patterns
        self.noise_patterns = [
            r"\b(?:lorem ipsum|placeholder|sample text|dummy text)\b",
            r"\b(?:xxx+|yyy+|zzz+)\b",
            r"\[?\s*(?:insert|add|include)\s+(?:text|content|image)\s*\]?",
            r"\[?\s*(?:todo|fixme|tbd|tba)\s*:?.*?\]?",
        ]

    async def clean_text(
        self, text: str, use_ai: Optional[bool] = None, preserve_formatting: bool = True
    ) -> CleaningResult:
        """Clean and normalize text with optional AI enhancement"""
        start_time = asyncio.get_event_loop().time()
        result = CleaningResult()
        result.original_text = text

        if not text or not text.strip():
            result.success = True
            result.cleaned_text = ""
            return result

        try:
            # Step 1: Basic cleaning
            cleaned_text = await self._basic_cleaning(text, result)

            # Step 2: AI-enhanced cleaning if enabled
            if (use_ai or self.config["use_ai_cleaning"]) and len(
                cleaned_text
            ) < self.config["max_text_length"]:
                cleaned_text = await self._ai_enhanced_cleaning(cleaned_text, result)

            # Step 3: Final normalization
            cleaned_text = await self._final_normalization(
                cleaned_text, result, preserve_formatting
            )

            result.cleaned_text = cleaned_text
            result.success = True
            result.processing_time = asyncio.get_event_loop().time() - start_time

            # Calculate statistics
            self._calculate_statistics(result)

            self.logger.info(
                f"Text cleaned successfully, time: {result.processing_time:.2f}s"
            )

        except Exception as e:
            result.errors.append(f"Text cleaning failed: {str(e)}")
            result.cleaned_text = text  # Fallback to original
            self.logger.error(f"Text cleaning error: {e}")

        return result

    async def _basic_cleaning(self, text: str, result: CleaningResult) -> str:
        """Perform basic text cleaning operations"""
        cleaned = text

        # Remove headers and footers
        if self.config["remove_headers_footers"]:
            cleaned = self._remove_headers_footers(cleaned, result)

        # Remove page numbers
        if self.config["remove_page_numbers"]:
            cleaned = self._remove_page_numbers(cleaned, result)

        # Fix OCR artifacts
        if self.config["remove_ocr_artifacts"]:
            cleaned = self._fix_ocr_artifacts(cleaned, result)

        # Remove noise patterns
        if self.config["remove_noise_patterns"]:
            cleaned = self._remove_noise_patterns(cleaned, result)

        # Fix line breaks
        if self.config["fix_line_breaks"]:
            cleaned = self._fix_line_breaks(cleaned, result)

        # Normalize whitespace
        if self.config["normalize_whitespace"]:
            cleaned = self._normalize_whitespace(cleaned, result)

        # Normalize Unicode
        if self.config["normalize_unicode"]:
            cleaned = self._normalize_unicode(cleaned, result)

        return cleaned

    async def _ai_enhanced_cleaning(self, text: str, result: CleaningResult) -> str:
        """Use Ollama for AI-enhanced text cleaning"""
        if not self.config["use_ai_cleaning"]:
            return text

        try:
            # Process in chunks if text is large
            if len(text) > self.config["chunk_size"]:
                return await self._process_text_chunks(text, result)

            # Single AI cleaning pass
            return await self._ai_clean_single_pass(text, result)

        except Exception as e:
            result.warnings.append(f"AI cleaning failed, using basic cleaning: {e}")
            return text

    async def _ai_clean_single_pass(self, text: str, result: CleaningResult) -> str:
        """Perform single-pass AI cleaning"""
        prompt = self._create_cleaning_prompt(text)

        try:
            response = await self.ollama_client.post(
                "/api/generate",
                json={
                    "model": self.config["ollama_model"],
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,  # Low temperature for consistent cleaning
                        "top_p": 0.9,
                        "num_predict": min(
                            len(text) * 2, 8192
                        ),  # Reasonable response length
                    },
                },
            )

            if response.status_code == 200:
                ai_response = response.json()
                cleaned_text = ai_response.get("response", "").strip()

                # Validate AI response
                if self._validate_ai_cleaned_text(text, cleaned_text):
                    result.ai_enhancements["cleaning_applied"] = True
                    result.ai_enhancements["original_length"] = len(text)
                    result.ai_enhancements["cleaned_length"] = len(cleaned_text)
                    return cleaned_text
                else:
                    result.warnings.append(
                        "AI cleaning validation failed, using original text"
                    )

        except Exception as e:
            result.warnings.append(f"AI cleaning request failed: {e}")

        return text

    async def _process_text_chunks(self, text: str, result: CleaningResult) -> str:
        """Process large text in chunks"""
        chunks = self._split_text_into_chunks(text, self.config["chunk_size"])
        cleaned_chunks = []

        # Process chunks in parallel if enabled
        if self.config["parallel_processing"]:
            tasks = [self._ai_clean_single_pass(chunk, result) for chunk in chunks]
            cleaned_chunks = await asyncio.gather(*tasks)
        else:
            for chunk in chunks:
                cleaned_chunk = await self._ai_clean_single_pass(chunk, result)
                cleaned_chunks.append(cleaned_chunk)

        return "\n\n".join(cleaned_chunks)

    def _create_cleaning_prompt(self, text: str) -> str:
        """Create prompt for AI text cleaning"""
        return f"""Clean and improve the following text by:
1. Removing OCR artifacts and scanning errors
2. Fixing broken words and spacing issues
3. Removing headers, footers, and page numbers
4. Removing placeholder text and noise
5. Preserving the original meaning and structure
6. Maintaining proper paragraph breaks
7. Ensuring proper punctuation and formatting

Text to clean:
{text}

Cleaned text:"""

    def _validate_ai_cleaned_text(self, original: str, cleaned: str) -> bool:
        """Validate AI-cleaned text quality"""
        if not cleaned or len(cleaned.strip()) == 0:
            return False

        # Check if too much content was removed (more than 50%)
        if len(cleaned) < len(original) * 0.5:
            return False

        # Check for suspicious patterns that indicate AI hallucination
        suspicious_patterns = [
            r"as an ai",
            r"i cannot",
            r"i apologize",
            r"here is the cleaned text",
            r"cleaned version:",
            r"note:",
            r"disclaimer:",
        ]

        cleaned_lower = cleaned.lower()
        if any(re.search(pattern, cleaned_lower) for pattern in suspicious_patterns):
            return False

        return True

    def _remove_headers_footers(self, text: str, result: CleaningResult) -> str:
        """Remove headers and footers from text"""
        lines = text.split("\n")
        cleaned_lines = []
        removed_headers = []
        removed_footers = []

        for line in lines:
            line_stripped = line.strip()

            # Check for header patterns
            is_header = any(
                re.match(pattern, line_stripped, re.IGNORECASE)
                for pattern in self.header_patterns
            )

            # Check for footer patterns
            is_footer = any(
                re.match(pattern, line_stripped, re.IGNORECASE)
                for pattern in self.footer_patterns
            )

            if is_header:
                removed_headers.append(line_stripped)
            elif is_footer:
                removed_footers.append(line_stripped)
            else:
                cleaned_lines.append(line)

        if removed_headers:
            result.removed_elements["headers"] = removed_headers
        if removed_footers:
            result.removed_elements["footers"] = removed_footers

        return "\n".join(cleaned_lines)

    def _remove_page_numbers(self, text: str, result: CleaningResult) -> str:
        """Remove page numbers from text"""
        page_patterns = [
            r"^\s*(?:page\s+)?\d+\s*(?:of\s+\d+)?\s*$",
            r"^\s*\d+\s*$",
            r"^\s*-\s*\d+\s*-\s*$",
        ]

        lines = text.split("\n")
        cleaned_lines = []
        removed_pages = []

        for line in lines:
            line_stripped = line.strip()

            if any(
                re.match(pattern, line_stripped, re.IGNORECASE)
                for pattern in page_patterns
            ):
                if (
                    len(line_stripped) < 20
                ):  # Only remove short lines that look like page numbers
                    removed_pages.append(line_stripped)
                    continue

            cleaned_lines.append(line)

        if removed_pages:
            result.removed_elements["page_numbers"] = removed_pages

        return "\n".join(cleaned_lines)

    def _fix_ocr_artifacts(self, text: str, result: CleaningResult) -> str:
        """Fix common OCR scanning artifacts"""
        cleaned = text

        # Fix space before punctuation
        cleaned = re.sub(r"\s+([.,:;!?])", r"\1", cleaned)

        # Fix missing spaces between words
        cleaned = re.sub(r"([a-z])([A-Z][a-z])", r"\1 \2", cleaned)

        # Fix broken numbers
        cleaned = re.sub(r"(\d)\s+(\d)", r"\1\2", cleaned)

        # Remove excessive repeated characters
        cleaned = re.sub(r"[|]{3,}", "|", cleaned)
        cleaned = re.sub(r"[_]{4,}", "___", cleaned)
        cleaned = re.sub(r"[-]{4,}", "---", cleaned)

        # Fix common OCR character substitutions
        ocr_fixes = {
            "0": "O",  # Zero to O in context
            "1": "l",  # One to l in context
            "5": "S",  # Five to S in context
        }

        # Apply fixes in word context (simplified)
        for wrong, right in ocr_fixes.items():
            # This is a simplified implementation
            # In production, you'd use more sophisticated context detection
            pass

        return cleaned

    def _remove_noise_patterns(self, text: str, result: CleaningResult) -> str:
        """Remove common noise patterns"""
        cleaned = text
        removed_noise = []

        for pattern in self.noise_patterns:
            matches = re.findall(pattern, cleaned, re.IGNORECASE)
            if matches:
                removed_noise.extend(matches)
                cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

        if removed_noise:
            result.removed_elements["noise_patterns"] = removed_noise

        return cleaned

    def _fix_line_breaks(self, text: str, result: CleaningResult) -> str:
        """Fix improper line breaks and hyphenation"""
        # Fix hyphenated words split across lines
        cleaned = re.sub(r"(\w+)-\s*\n\s*(\w+)", r"\1\2", text)

        # Fix sentences split across lines (no hyphen)
        cleaned = re.sub(r"(\w+)\s*\n\s*([a-z])", r"\1 \2", cleaned)

        # Preserve intentional paragraph breaks
        cleaned = re.sub(r"\n\s*\n", "\n\n", cleaned)

        return cleaned

    def _normalize_whitespace(self, text: str, result: CleaningResult) -> str:
        """Normalize whitespace patterns"""
        # Replace multiple spaces with single space
        cleaned = re.sub(r" {2,}", " ", text)

        # Replace tabs with spaces
        cleaned = cleaned.replace("\t", " ")

        # Remove trailing whitespace from lines
        lines = [line.rstrip() for line in cleaned.split("\n")]

        # Remove empty lines at beginning and end
        while lines and not lines[0].strip():
            lines.pop(0)
        while lines and not lines[-1].strip():
            lines.pop()

        # Limit consecutive empty lines to maximum 2
        normalized_lines = []
        empty_count = 0

        for line in lines:
            if not line.strip():
                empty_count += 1
                if empty_count <= 2:
                    normalized_lines.append(line)
            else:
                empty_count = 0
                normalized_lines.append(line)

        return "\n".join(normalized_lines)

    def _normalize_unicode(self, text: str, result: CleaningResult) -> str:
        """Normalize Unicode characters"""
        # Normalize Unicode to NFC form
        normalized = unicodedata.normalize("NFC", text)

        # Decode HTML entities
        normalized = html.unescape(normalized)

        # Replace problematic Unicode characters
        replacements = {
            "\u2018": "'",  # Left single quotation mark
            "\u2019": "'",  # Right single quotation mark
            "\u201c": '"',  # Left double quotation mark
            "\u201d": '"',  # Right double quotation mark
            "\u2013": "-",  # En dash
            "\u2014": "--",  # Em dash
            "\u2026": "...",  # Horizontal ellipsis
        }

        for old, new in replacements.items():
            normalized = normalized.replace(old, new)

        return normalized

    async def _final_normalization(
        self, text: str, result: CleaningResult, preserve_formatting: bool
    ) -> str:
        """Final normalization and cleanup"""
        if not preserve_formatting:
            # Remove all extra formatting
            normalized = re.sub(r"\n{3,}", "\n\n", text)
            normalized = re.sub(r" {2,}", " ", normalized)
            return normalized.strip()

        # Preserve basic structure while cleaning
        lines = text.split("\n")
        cleaned_lines = []

        for line in lines:
            # Clean individual lines while preserving structure
            if line.strip():
                cleaned_line = line.strip()
                cleaned_lines.append(cleaned_line)
            else:
                cleaned_lines.append("")

        return "\n".join(cleaned_lines)

    def _split_text_into_chunks(self, text: str, chunk_size: int) -> List[str]:
        """Split text into processable chunks"""
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        words = text.split()
        current_chunk = []
        current_length = 0

        for word in words:
            word_length = len(word) + 1  # +1 for space

            if current_length + word_length > chunk_size and current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = [word]
                current_length = len(word)
            else:
                current_chunk.append(word)
                current_length += word_length

        if current_chunk:
            chunks.append(" ".join(current_chunk))

        return chunks

    def _calculate_statistics(self, result: CleaningResult):
        """Calculate cleaning statistics"""
        original = result.original_text
        cleaned = result.cleaned_text

        result.statistics = {
            "original_length": len(original),
            "cleaned_length": len(cleaned),
            "characters_removed": len(original) - len(cleaned),
            "original_words": len(original.split()),
            "cleaned_words": len(cleaned.split()),
            "words_removed": len(original.split()) - len(cleaned.split()),
            "original_lines": len(original.split("\n")),
            "cleaned_lines": len(cleaned.split("\n")),
            "lines_removed": len(original.split("\n")) - len(cleaned.split("\n")),
            "elements_removed": sum(len(v) for v in result.removed_elements.values()),
        }

    async def detect_document_structure(self, text: str) -> Dict[str, Any]:
        """Use AI to detect document structure"""
        if (
            not self.config["ai_structure_detection"]
            or len(text) > self.config["max_text_length"]
        ):
            return {}

        prompt = f"""Analyze the structure of this document and identify:
1. Document type (report, proposal, contract, etc.)
2. Main sections and headings
3. Table of contents if present
4. Key structural elements

Document:
{text[:2000]}...

Provide a JSON response with the structure analysis."""

        try:
            response = await self.ollama_client.post(
                "/api/generate",
                json={
                    "model": self.config["ollama_model"],
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1},
                },
            )

            if response.status_code == 200:
                ai_response = response.json()
                # Try to parse JSON response
                try:
                    import json

                    return json.loads(ai_response.get("response", "{}"))
                except json.JSONDecodeError:
                    return {"raw_response": ai_response.get("response", "")}

        except Exception as e:
            self.logger.warning(f"AI structure detection failed: {e}")

        return {}

    async def close(self):
        """Close the Ollama client"""
        await self.ollama_client.aclose()

# Factory function
def create_text_cleaner(config: Optional[Dict[str, Any]] = None) -> OllamaTextCleaner:
    """Create OllamaTextCleaner instance with configuration"""
    return OllamaTextCleaner(config)
