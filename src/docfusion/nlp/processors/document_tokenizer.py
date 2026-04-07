#!/usr/bin/env python3
"""
Document Tokenizer

Advanced document tokenization with spaCy integration for linguistic analysis,
named entity recognition, and text preprocessing for NLP tasks.
"""

import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union

try:
    from uuid_extensions import uuid7str
except ImportError:
    from uuid import uuid4

    def uuid7str() -> str:
        return str(uuid4())


# spaCy integration for advanced NLP
try:
    import spacy
    from spacy.lang.en import English
    from spacy.matcher import Matcher, PhraseMatcher
    from spacy.tokens import Doc, Span, Token

    HAS_SPACY_SUPPORT = True
except ImportError:
    HAS_SPACY_SUPPORT = False

# NLTK fallback for basic tokenization
try:
    import nltk
    from nltk.corpus import stopwords
    from nltk.stem import PorterStemmer, WordNetLemmatizer
    from nltk.tokenize import sent_tokenize, word_tokenize

    HAS_NLTK_SUPPORT = True
except ImportError:
    HAS_NLTK_SUPPORT = False


class TokenType(str, Enum):
    """Token types for classification"""

    WORD = "word"
    PUNCTUATION = "punctuation"
    NUMBER = "number"
    EMAIL = "email"
    URL = "url"
    PHONE = "phone"
    DATE = "date"
    MONEY = "money"
    ENTITY = "entity"
    STOPWORD = "stopword"
    WHITESPACE = "whitespace"


@dataclass
class Token:
    """Individual token with linguistic features"""

    text: str
    lemma: str = ""
    pos_tag: str = ""
    token_type: TokenType = TokenType.WORD
    start_char: int = 0
    end_char: int = 0
    is_alpha: bool = False
    is_digit: bool = False
    is_stop: bool = False
    is_punct: bool = False
    is_space: bool = False
    is_oov: bool = False  # Out of vocabulary
    sentiment: Optional[float] = None
    confidence: float = 1.0
    entity_label: Optional[str] = None
    entity_confidence: Optional[float] = None
    custom_attributes: Dict[str, Any] = None

    def __post_init__(self):
        if self.custom_attributes is None:
            self.custom_attributes = {}


@dataclass
class Sentence:
    """Sentence with tokens and features"""

    text: str
    tokens: List[Token]
    start_char: int = 0
    end_char: int = 0
    sentiment: Optional[float] = None
    confidence: float = 1.0
    complexity_score: Optional[float] = None
    entities: List[Dict[str, Any]] = None

    def __post_init__(self):
        if self.entities is None:
            self.entities = []


class TokenizationResult:
    """Result of document tokenization"""

    def __init__(self):
        self.success: bool = False
        self.original_text: str = ""
        self.sentences: List[Sentence] = []
        self.tokens: List[Token] = []
        self.entities: List[Dict[str, Any]] = []
        self.statistics: Dict[str, Any] = {}
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.processing_time: float = 0.0
        self.model_used: str = ""
        self.language: str = "en"
        self.metadata: Dict[str, Any] = {}


class DocumentTokenizer:
    """Advanced document tokenizer with spaCy and NLTK integration"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or self._get_default_config()
        self.logger = logging.getLogger(__name__)

        # spaCy model
        self.nlp_model = None
        self.matcher = None
        self.phrase_matcher = None

        # NLTK components
        self.stemmer = None
        self.lemmatizer = None
        self.stop_words = set()

        # Initialize NLP components
        self._initialize_nlp_components()

        # Custom patterns and rules
        self._init_custom_patterns()

        self.logger.info("Document tokenizer initialized")

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration"""
        return {
            # Model selection
            "spacy_model": "en_core_web_sm",
            "use_spacy": HAS_SPACY_SUPPORT,
            "use_nltk_fallback": HAS_NLTK_SUPPORT,
            "language": "en",
            # Processing options
            "include_pos_tags": True,
            "include_entities": True,
            "include_sentiment": True,
            "include_dependencies": False,  # More advanced feature
            "lemmatization": True,
            "stemming": False,  # Usually use lemmatization OR stemming
            # Token filtering
            "remove_stopwords": False,  # Keep for analysis
            "remove_punctuation": False,
            "remove_whitespace": True,
            "min_token_length": 1,
            "max_token_length": 100,
            # Entity extraction
            "entity_types": [
                "PERSON",
                "ORG",
                "GPE",
                "DATE",
                "TIME",
                "MONEY",
                "PERCENT",
                "EMAIL",
                "URL",
                "PHONE",
            ],
            "custom_entities": True,
            # Performance settings
            "batch_size": 1000,
            "max_text_length": 1000000,  # 1M characters
            "enable_custom_patterns": True,
            # Output options
            "preserve_whitespace_tokens": False,
            "include_token_vectors": False,  # Word embeddings
            "calculate_complexity": True,
        }

    def _initialize_nlp_components(self):
        """Initialize spaCy and NLTK components"""
        if self.config["use_spacy"] and HAS_SPACY_SUPPORT:
            try:
                self.nlp_model = spacy.load(self.config["spacy_model"])
                self.matcher = Matcher(self.nlp_model.vocab)
                self.phrase_matcher = PhraseMatcher(self.nlp_model.vocab)
                self.logger.info(
                    f"spaCy model '{self.config['spacy_model']}' loaded successfully"
                )
            except IOError:
                self.logger.warning(
                    f"Could not load spaCy model '{self.config['spacy_model']}', trying fallback"
                )
                try:
                    # Try smaller model
                    self.nlp_model = spacy.load("en_core_web_sm")
                    self.matcher = Matcher(self.nlp_model.vocab)
                    self.phrase_matcher = PhraseMatcher(self.nlp_model.vocab)
                    self.logger.info("Loaded fallback spaCy model 'en_core_web_sm'")
                except IOError:
                    self.logger.warning("No spaCy model available, using NLTK fallback")
                    self.nlp_model = None

        # Initialize NLTK components if needed
        if not self.nlp_model and self.config["use_nltk_fallback"] and HAS_NLTK_SUPPORT:
            try:
                # Download required NLTK data
                nltk.download("punkt", quiet=True)
                nltk.download("stopwords", quiet=True)
                nltk.download("averaged_perceptron_tagger", quiet=True)
                nltk.download("wordnet", quiet=True)

                if self.config["stemming"]:
                    self.stemmer = PorterStemmer()

                if self.config["lemmatization"]:
                    self.lemmatizer = WordNetLemmatizer()

                self.stop_words = set(stopwords.words("english"))
                self.logger.info("NLTK components initialized successfully")

            except Exception as e:
                self.logger.warning(f"NLTK initialization failed: {e}")

    def _init_custom_patterns(self):
        """Initialize custom patterns for entity recognition"""
        if not self.matcher or not self.config["enable_custom_patterns"]:
            return

        # Email pattern
        email_pattern = [{"LIKE_EMAIL": True}]
        self.matcher.add("EMAIL", [email_pattern])

        # URL pattern
        url_pattern = [{"LIKE_URL": True}]
        self.matcher.add("URL", [url_pattern])

        # Phone pattern (basic)
        phone_pattern = [
            {
                "TEXT": {
                    "REGEX": r"^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$"
                }
            }
        ]
        self.matcher.add("PHONE", [phone_pattern])

        # Money pattern
        money_patterns = [
            [{"TEXT": "$"}, {"LIKE_NUM": True}],
            [{"LIKE_NUM": True}, {"LOWER": {"IN": ["dollars", "usd", "dollar"]}}],
        ]
        self.matcher.add("MONEY", money_patterns)

    async def tokenize_document(
        self,
        text: str,
        preserve_sentences: bool = True,
        include_entities: Optional[bool] = None,
    ) -> TokenizationResult:
        """Tokenize document with comprehensive linguistic analysis"""
        start_time = asyncio.get_event_loop().time()
        result = TokenizationResult()
        result.original_text = text

        if not text or not text.strip():
            result.success = True
            return result

        try:
            # Check text length
            if len(text) > self.config["max_text_length"]:
                result.warnings.append(
                    f"Text truncated to {self.config['max_text_length']} characters"
                )
                text = text[: self.config["max_text_length"]]

            # Use spaCy if available
            if self.nlp_model:
                await self._tokenize_with_spacy(
                    text, result, preserve_sentences, include_entities
                )
            elif HAS_NLTK_SUPPORT:
                await self._tokenize_with_nltk(text, result, preserve_sentences)
            else:
                await self._tokenize_basic(text, result)

            # Calculate statistics
            self._calculate_statistics(result)

            # Calculate complexity if enabled
            if self.config["calculate_complexity"]:
                self._calculate_complexity_scores(result)

            result.success = True
            result.processing_time = asyncio.get_event_loop().time() - start_time

            self.logger.info(
                f"Document tokenized successfully, time: {result.processing_time:.2f}s"
            )

        except Exception as e:
            result.errors.append(f"Tokenization failed: {str(e)}")
            self.logger.error(f"Tokenization error: {e}")

        return result

    async def _tokenize_with_spacy(
        self,
        text: str,
        result: TokenizationResult,
        preserve_sentences: bool,
        include_entities: Optional[bool],
    ):
        """Tokenize using spaCy"""
        result.model_used = f"spaCy ({self.config['spacy_model']})"

        # Process text with spaCy
        doc = self.nlp_model(text)

        # Extract tokens
        tokens = []
        for token in doc:
            if not self.config["preserve_whitespace_tokens"] and token.is_space:
                continue

            # Create token object
            tok = Token(
                text=token.text,
                lemma=token.lemma_ if self.config["lemmatization"] else token.text,
                pos_tag=token.pos_ if self.config["include_pos_tags"] else "",
                start_char=token.idx,
                end_char=token.idx + len(token.text),
                is_alpha=token.is_alpha,
                is_digit=token.is_digit,
                is_stop=token.is_stop,
                is_punct=token.is_punct,
                is_space=token.is_space,
                is_oov=token.is_oov,
            )

            # Classify token type
            tok.token_type = self._classify_token_type(token)

            # Add sentiment if available
            if self.config["include_sentiment"] and hasattr(token, "sentiment"):
                tok.sentiment = getattr(token, "sentiment", None)

            tokens.append(tok)

        result.tokens = tokens

        # Extract sentences if requested
        if preserve_sentences:
            sentences = []
            for sent in doc.sents:
                sentence_tokens = [
                    tok
                    for tok in tokens
                    if tok.start_char >= sent.start_char
                    and tok.end_char <= sent.end_char
                ]

                sentence = Sentence(
                    text=sent.text,
                    tokens=sentence_tokens,
                    start_char=sent.start_char,
                    end_char=sent.end_char,
                )
                sentences.append(sentence)

            result.sentences = sentences

        # Extract entities
        if (
            include_entities is None and self.config["include_entities"]
        ) or include_entities:
            await self._extract_entities_spacy(doc, result)

    async def _tokenize_with_nltk(
        self, text: str, result: TokenizationResult, preserve_sentences: bool
    ):
        """Tokenize using NLTK fallback"""
        result.model_used = "NLTK"

        # Tokenize into sentences first
        sentences = sent_tokenize(text) if preserve_sentences else [text]

        all_tokens = []
        sentence_objects = []
        char_offset = 0

        for sent_text in sentences:
            # Tokenize sentence into words
            words = word_tokenize(sent_text)

            # POS tagging if available
            if self.config["include_pos_tags"]:
                try:
                    pos_tags = nltk.pos_tag(words)
                except (ValueError, TypeError, LookupError) as e:
                    self.logger.warning(f"POS tagging failed, falling back to empty tags: {e}")
                    pos_tags = [(word, "") for word in words]
            else:
                pos_tags = [(word, "") for word in words]

            sentence_tokens = []

            for word, pos in pos_tags:
                # Find character positions (approximate)
                start_pos = text.find(word, char_offset)
                if start_pos == -1:
                    start_pos = char_offset
                end_pos = start_pos + len(word)
                char_offset = end_pos

                # Create token
                tok = Token(
                    text=word,
                    lemma=self.lemmatizer.lemmatize(word) if self.lemmatizer else word,
                    pos_tag=pos,
                    start_char=start_pos,
                    end_char=end_pos,
                    is_alpha=word.isalpha(),
                    is_digit=word.isdigit(),
                    is_stop=word.lower() in self.stop_words,
                    is_punct=not word.isalnum(),
                    is_space=word.isspace(),
                )

                # Classify token type
                tok.token_type = self._classify_token_type_basic(word)

                sentence_tokens.append(tok)
                all_tokens.append(tok)

            if preserve_sentences:
                sentence = Sentence(
                    text=sent_text,
                    tokens=sentence_tokens,
                    start_char=text.find(sent_text),
                    end_char=text.find(sent_text) + len(sent_text),
                )
                sentence_objects.append(sentence)

        result.tokens = all_tokens
        result.sentences = sentence_objects

    async def _tokenize_basic(self, text: str, result: TokenizationResult):
        """Basic tokenization fallback"""
        result.model_used = "Basic"

        # Simple word splitting
        words = re.findall(r"\b\w+\b|\S", text)
        tokens = []
        char_pos = 0

        for word in words:
            start_pos = text.find(word, char_pos)
            if start_pos == -1:
                start_pos = char_pos
            end_pos = start_pos + len(word)
            char_pos = end_pos

            tok = Token(
                text=word,
                lemma=word.lower(),
                start_char=start_pos,
                end_char=end_pos,
                is_alpha=word.isalpha(),
                is_digit=word.isdigit(),
                is_punct=not word.isalnum(),
                is_space=word.isspace(),
            )

            tok.token_type = self._classify_token_type_basic(word)
            tokens.append(tok)

        result.tokens = tokens

    async def _extract_entities_spacy(self, doc, result: TokenizationResult):
        """Extract entities using spaCy"""
        entities = []

        # Built-in entities
        for ent in doc.ents:
            if ent.label_ in self.config["entity_types"]:
                entities.append(
                    {
                        "text": ent.text,
                        "label": ent.label_,
                        "start_char": ent.start_char,
                        "end_char": ent.end_char,
                        "confidence": getattr(ent, "confidence", 1.0),
                        "description": spacy.explain(ent.label_),
                    }
                )

        # Custom pattern matches
        if self.matcher:
            matches = self.matcher(doc)
            for match_id, start, end in matches:
                span = doc[start:end]
                label = self.nlp_model.vocab.strings[match_id]

                entities.append(
                    {
                        "text": span.text,
                        "label": label,
                        "start_char": span.start_char,
                        "end_char": span.end_char,
                        "confidence": 0.8,  # Custom patterns have lower confidence
                        "description": f"Custom pattern: {label}",
                    }
                )

        result.entities = entities

        # Add entities to sentences
        for sentence in result.sentences:
            sentence.entities = [
                ent
                for ent in entities
                if ent["start_char"] >= sentence.start_char
                and ent["end_char"] <= sentence.end_char
            ]

    def _classify_token_type(self, token) -> TokenType:
        """Classify token type using spaCy token"""
        if token.is_punct:
            return TokenType.PUNCTUATION
        elif token.is_space:
            return TokenType.WHITESPACE
        elif token.is_digit or token.like_num:
            return TokenType.NUMBER
        elif token.like_email:
            return TokenType.EMAIL
        elif token.like_url:
            return TokenType.URL
        elif token.is_stop:
            return TokenType.STOPWORD
        elif token.ent_type_:
            return TokenType.ENTITY
        else:
            return TokenType.WORD

    def _classify_token_type_basic(self, word: str) -> TokenType:
        """Basic token type classification"""
        if not word.isalnum():
            return TokenType.PUNCTUATION
        elif word.isdigit():
            return TokenType.NUMBER
        elif "@" in word:
            return TokenType.EMAIL
        elif "http" in word.lower() or "www" in word.lower():
            return TokenType.URL
        elif word.lower() in self.stop_words:
            return TokenType.STOPWORD
        else:
            return TokenType.WORD

    def _calculate_statistics(self, result: TokenizationResult):
        """Calculate tokenization statistics"""
        tokens = result.tokens

        result.statistics = {
            "total_tokens": len(tokens),
            "total_sentences": len(result.sentences),
            "unique_tokens": len(set(tok.text.lower() for tok in tokens)),
            "average_tokens_per_sentence": len(tokens) / max(len(result.sentences), 1),
            "character_count": len(result.original_text),
            "word_count": len(
                [tok for tok in tokens if tok.token_type == TokenType.WORD]
            ),
            "punctuation_count": len(
                [tok for tok in tokens if tok.token_type == TokenType.PUNCTUATION]
            ),
            "number_count": len(
                [tok for tok in tokens if tok.token_type == TokenType.NUMBER]
            ),
            "stopword_count": len([tok for tok in tokens if tok.is_stop]),
            "entity_count": len(result.entities),
            "average_word_length": sum(
                len(tok.text) for tok in tokens if tok.token_type == TokenType.WORD
            )
            / max(len([tok for tok in tokens if tok.token_type == TokenType.WORD]), 1),
            "vocabulary_richness": len(
                set(
                    tok.lemma.lower()
                    for tok in tokens
                    if tok.token_type == TokenType.WORD
                )
            )
            / max(len([tok for tok in tokens if tok.token_type == TokenType.WORD]), 1),
            "pos_tag_distribution": self._get_pos_distribution(tokens),
        }

    def _get_pos_distribution(self, tokens: List[Token]) -> Dict[str, int]:
        """Get POS tag distribution"""
        pos_counts = {}
        for token in tokens:
            if token.pos_tag:
                pos_counts[token.pos_tag] = pos_counts.get(token.pos_tag, 0) + 1
        return pos_counts

    def _calculate_complexity_scores(self, result: TokenizationResult):
        """Calculate text complexity scores"""
        tokens = result.tokens
        sentences = result.sentences

        if not sentences:
            return

        # Simple complexity metrics
        avg_sentence_length = sum(len(sent.tokens) for sent in sentences) / len(
            sentences
        )
        avg_word_length = sum(
            len(tok.text) for tok in tokens if tok.token_type == TokenType.WORD
        ) / max(len([tok for tok in tokens if tok.token_type == TokenType.WORD]), 1)

        for sentence in sentences:
            # Simple complexity score based on length and vocabulary
            word_tokens = [
                tok for tok in sentence.tokens if tok.token_type == TokenType.WORD
            ]
            if word_tokens:
                sentence.complexity_score = (
                    len(word_tokens) / avg_sentence_length * 0.4
                    + sum(len(tok.text) for tok in word_tokens)
                    / len(word_tokens)
                    / avg_word_length
                    * 0.3
                    + len(set(tok.lemma.lower() for tok in word_tokens))
                    / len(word_tokens)
                    * 0.3
                )

    async def extract_keywords(
        self, text: str, max_keywords: int = 20, min_frequency: int = 2
    ) -> List[Dict[str, Any]]:
        """Extract keywords from text"""
        result = await self.tokenize_document(
            text, preserve_sentences=False, include_entities=False
        )

        if not result.success:
            return []

        # Count word frequencies
        word_freq = {}
        for token in result.tokens:
            if (
                token.token_type == TokenType.WORD
                and not token.is_stop
                and len(token.text) >= self.config["min_token_length"]
            ):
                word = token.lemma.lower()
                word_freq[word] = word_freq.get(word, 0) + 1

        # Filter by minimum frequency and sort
        keywords = [
            {"word": word, "frequency": freq, "score": freq / len(result.tokens)}
            for word, freq in word_freq.items()
            if freq >= min_frequency
        ]

        # Sort by frequency and return top keywords
        keywords.sort(key=lambda x: x["frequency"], reverse=True)
        return keywords[:max_keywords]

    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """Basic sentiment analysis placeholder"""
        # This would integrate with sentiment analysis models
        # For now, return neutral sentiment
        result = await self.tokenize_document(text)

        return {
            "overall_sentiment": 0.0,  # -1 to 1 scale
            "confidence": 0.5,
            "sentence_sentiments": [
                {"text": sent.text, "sentiment": 0.0, "confidence": 0.5}
                for sent in result.sentences
            ],
        }

    def get_tokenizer_info(self) -> Dict[str, Any]:
        """Get tokenizer information and capabilities"""
        return {
            "model_used": self.nlp_model.meta if self.nlp_model else "NLTK/Basic",
            "spacy_available": HAS_SPACY_SUPPORT,
            "nltk_available": HAS_NLTK_SUPPORT,
            "capabilities": {
                "pos_tagging": bool(self.nlp_model or HAS_NLTK_SUPPORT),
                "lemmatization": bool(self.nlp_model or self.lemmatizer),
                "entity_recognition": bool(self.nlp_model),
                "dependency_parsing": bool(self.nlp_model),
                "custom_patterns": bool(self.matcher),
                "sentiment_analysis": False,  # Placeholder
            },
            "supported_languages": [self.config["language"]],
            "config": self.config.copy(),
            "version": "1.0.0",
        }


# Factory function
def create_document_tokenizer(
    config: Optional[Dict[str, Any]] = None,
) -> DocumentTokenizer:
    """Create DocumentTokenizer instance with configuration"""
    # Ensure we always have defaults for tokenizer-specific settings
    default_tokenizer_config = {
        "use_spacy": HAS_SPACY_SUPPORT,
        "use_nltk_fallback": HAS_NLTK_SUPPORT,
        "spacy_model": "en_core_web_sm",
        "language": "en",
    }

    # Merge user config with defaults
    if config is not None:
        merged_config = {**default_tokenizer_config, **config}
    else:
        merged_config = default_tokenizer_config

    return DocumentTokenizer(merged_config)
