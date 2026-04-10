#!/usr/bin/env python3
"""
DocumentRetriever Module for DocuFusion Storage Layer

Implements template library management, boilerplate content access system,
content block retrieval by type/category, and smart content recommendation.
Provides intelligent content discovery and retrieval for document generation workflows.
"""

import asyncio
import json
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import pickle
from collections import Counter, defaultdict
from difflib import SequenceMatcher

import aiofiles
from ...core.utils import uuid7str

@dataclass
class ContentBlock:
    """Content block for template and boilerplate management"""

    block_id: str = field(default_factory=uuid7str)
    title: str = ""
    content: str = ""
    content_type: str = "text"  # text, markdown, html, latex
    block_type: str = "general"  # section, paragraph, list, table, header, footer
    category: str = "general"
    subcategory: str = ""
    tags: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    usage_count: int = 0
    quality_score: float = 1.0
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    last_used: datetime = field(default_factory=datetime.now)
    author: str = "system"
    source_document_id: Optional[str] = None
    variables: Dict[str, str] = field(default_factory=dict)  # For templating
    dependencies: List[str] = field(
        default_factory=list
    )  # Dependencies on other blocks
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Template:
    """Document template with content blocks and structure"""

    template_id: str = field(default_factory=uuid7str)
    name: str = ""
    description: str = ""
    template_type: str = "document"  # document, section, component
    category: str = "general"
    structure: Dict[str, Any] = field(
        default_factory=dict
    )  # Template structure definition
    content_blocks: List[str] = field(default_factory=list)  # Block IDs
    variables: Dict[str, Any] = field(default_factory=dict)  # Template variables
    required_blocks: List[str] = field(default_factory=list)
    optional_blocks: List[str] = field(default_factory=list)
    usage_count: int = 0
    quality_score: float = 1.0
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    last_used: datetime = field(default_factory=datetime.now)
    author: str = "system"
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ContentRecommendation:
    """Content recommendation with scoring"""

    content_id: str
    content_type: str  # block, template
    title: str
    content: str
    relevance_score: float
    recommendation_reason: str
    usage_frequency: int
    quality_score: float
    last_used: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class RetrievalStats:
    """Content retrieval statistics"""

    total_retrievals: int = 0
    block_retrievals: int = 0
    template_retrievals: int = 0
    recommendation_requests: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    average_retrieval_time: float = 0.0
    most_used_content: Dict[str, int] = field(default_factory=dict)
    performance_metrics: Dict[str, float] = field(default_factory=dict)

class DocumentRetriever:
    """
    Intelligent document retrieval system with template library management,
    content block access, and smart content recommendations
    """

    def __init__(self, storage_path: Optional[Path] = None):
        self.storage_path = storage_path or Path("./storage/retriever")
        self.storage_path.mkdir(parents=True, exist_ok=True)

        # Initialize storage paths
        self.blocks_path = self.storage_path / "blocks"
        self.templates_path = self.storage_path / "templates"
        self.cache_path = self.storage_path / "cache"

        for path in [self.blocks_path, self.templates_path, self.cache_path]:
            path.mkdir(parents=True, exist_ok=True)

        # Initialize data structures
        self.content_blocks: Dict[str, ContentBlock] = {}
        self.templates: Dict[str, Template] = {}

        # Indexes for fast retrieval
        self.blocks_by_category: Dict[str, Set[str]] = defaultdict(set)
        self.blocks_by_type: Dict[str, Set[str]] = defaultdict(set)
        self.blocks_by_tag: Dict[str, Set[str]] = defaultdict(set)
        self.templates_by_category: Dict[str, Set[str]] = defaultdict(set)
        self.templates_by_type: Dict[str, Set[str]] = defaultdict(set)

        # Statistics and caching
        self.stats = RetrievalStats()
        self.recommendation_cache: Dict[str, List[ContentRecommendation]] = {}
        self.cache_ttl = timedelta(hours=1)

        # Thread safety
        self._lock = asyncio.Lock()

        # Load existing data
        asyncio.create_task(self._load_data())

    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate text similarity between two strings"""
        return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()

    def _extract_keywords(self, text: str, max_keywords: int = 10) -> List[str]:
        """Extract keywords from text"""
        if not text:
            return []

        # Simple keyword extraction
        words = re.findall(r"\b[a-zA-Z]{4,}\b", text.lower())
        word_freq = Counter(words)

        # Filter common words
        stop_words = {
            "this",
            "that",
            "with",
            "have",
            "will",
            "from",
            "they",
            "been",
            "said",
            "each",
            "which",
            "them",
            "would",
            "there",
            "could",
        }

        keywords = [
            word
            for word, freq in word_freq.most_common(max_keywords)
            if word not in stop_words and len(word) > 3
        ]

        return keywords

    async def add_content_block(
        self,
        content: str,
        title: str = "",
        content_type: str = "text",
        block_type: str = "general",
        category: str = "general",
        subcategory: str = "",
        tags: Optional[List[str]] = None,
        author: str = "system",
        variables: Optional[Dict[str, str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Add a new content block to the library"""

        async with self._lock:
            try:
                # Extract keywords if not provided
                keywords = self._extract_keywords(content)

                # Create content block
                block = ContentBlock(
                    title=title or f"Block {datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    content=content,
                    content_type=content_type,
                    block_type=block_type,
                    category=category,
                    subcategory=subcategory,
                    tags=tags or [],
                    keywords=keywords,
                    author=author,
                    variables=variables or {},
                    metadata=metadata or {},
                )

                # Add to collections
                self.content_blocks[block.block_id] = block
                await self._update_block_indexes(block)

                # Save to disk
                await self._save_content_block(block)

                return block.block_id

            except Exception as e:
                raise RuntimeError(f"Failed to add content block: {e}")

    async def add_template(
        self,
        name: str,
        description: str = "",
        template_type: str = "document",
        category: str = "general",
        structure: Optional[Dict[str, Any]] = None,
        content_blocks: Optional[List[str]] = None,
        variables: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        author: str = "system",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Add a new template to the library"""

        async with self._lock:
            try:
                # Validate content blocks exist
                block_ids = content_blocks or []
                valid_blocks = []

                for block_id in block_ids:
                    if block_id in self.content_blocks:
                        valid_blocks.append(block_id)

                # Create template
                template = Template(
                    name=name,
                    description=description,
                    template_type=template_type,
                    category=category,
                    structure=structure or {},
                    content_blocks=valid_blocks,
                    variables=variables or {},
                    tags=tags or [],
                    author=author,
                    metadata=metadata or {},
                )

                # Add to collections
                self.templates[template.template_id] = template
                await self._update_template_indexes(template)

                # Save to disk
                await self._save_template(template)

                return template.template_id

            except Exception as e:
                raise RuntimeError(f"Failed to add template: {e}")

    async def _update_block_indexes(self, block: ContentBlock) -> None:
        """Update content block indexes"""
        self.blocks_by_category[block.category].add(block.block_id)
        self.blocks_by_type[block.block_type].add(block.block_id)

        for tag in block.tags:
            self.blocks_by_tag[tag.lower()].add(block.block_id)

    async def _update_template_indexes(self, template: Template) -> None:
        """Update template indexes"""
        self.templates_by_category[template.category].add(template.template_id)
        self.templates_by_type[template.template_type].add(template.template_id)

    async def retrieve_content_block(
        self, block_id: str, track_usage: bool = True
    ) -> Optional[ContentBlock]:
        """Retrieve a content block by ID"""
        start_time = asyncio.get_event_loop().time()

        try:
            self.stats.total_retrievals += 1
            self.stats.block_retrievals += 1

            if block_id not in self.content_blocks:
                return None

            block = self.content_blocks[block_id]

            if track_usage:
                # Update usage statistics
                block.usage_count += 1
                block.last_used = datetime.now()
                self.stats.most_used_content[block_id] = block.usage_count

                # Save updated block
                await self._save_content_block(block)

            # Update performance metrics
            retrieval_time = asyncio.get_event_loop().time() - start_time
            self.stats.performance_metrics["last_block_retrieval_time"] = retrieval_time
            self.stats.average_retrieval_time = (
                self.stats.average_retrieval_time * (self.stats.total_retrievals - 1)
                + retrieval_time
            ) / self.stats.total_retrievals

            return block

        except Exception as e:
            print(f"Error retrieving content block {block_id}: {e}")
            return None

    async def retrieve_template(
        self, template_id: str, track_usage: bool = True
    ) -> Optional[Template]:
        """Retrieve a template by ID"""
        start_time = asyncio.get_event_loop().time()

        try:
            self.stats.total_retrievals += 1
            self.stats.template_retrievals += 1

            if template_id not in self.templates:
                return None

            template = self.templates[template_id]

            if track_usage:
                # Update usage statistics
                template.usage_count += 1
                template.last_used = datetime.now()
                self.stats.most_used_content[template_id] = template.usage_count

                # Save updated template
                await self._save_template(template)

            # Update performance metrics
            retrieval_time = asyncio.get_event_loop().time() - start_time
            self.stats.performance_metrics["last_template_retrieval_time"] = (
                retrieval_time
            )
            self.stats.average_retrieval_time = (
                self.stats.average_retrieval_time * (self.stats.total_retrievals - 1)
                + retrieval_time
            ) / self.stats.total_retrievals

            return template

        except Exception as e:
            print(f"Error retrieving template {template_id}: {e}")
            return None

    async def search_content_blocks(
        self,
        query: str = "",
        category: Optional[str] = None,
        block_type: Optional[str] = None,
        tags: Optional[List[str]] = None,
        content_type: Optional[str] = None,
        limit: int = 50,
    ) -> List[ContentBlock]:
        """Search content blocks with various filters"""

        candidates = set(self.content_blocks.keys())

        # Apply filters
        if category:
            candidates &= self.blocks_by_category.get(category, set())

        if block_type:
            candidates &= self.blocks_by_type.get(block_type, set())

        if tags:
            tag_matches = set()
            for tag in tags:
                tag_matches |= self.blocks_by_tag.get(tag.lower(), set())
            candidates &= tag_matches

        # Get matching blocks
        matching_blocks = []
        query_lower = query.lower() if query else ""

        for block_id in candidates:
            if block_id not in self.content_blocks:
                continue

            block = self.content_blocks[block_id]

            # Apply content type filter
            if content_type and block.content_type != content_type:
                continue

            # Calculate relevance score
            relevance_score = 0.0

            if query:
                # Title match
                if query_lower in block.title.lower():
                    relevance_score += 2.0

                # Content match
                content_similarity = self._calculate_similarity(query, block.content)
                relevance_score += content_similarity

                # Keyword match
                for keyword in block.keywords:
                    if query_lower in keyword.lower():
                        relevance_score += 0.5

                # Tag match
                for tag in block.tags:
                    if query_lower in tag.lower():
                        relevance_score += 0.3
            else:
                # No query - use usage-based scoring
                relevance_score = block.usage_count * 0.1 + block.quality_score

            matching_blocks.append((block, relevance_score))

        # Sort by relevance and usage
        matching_blocks.sort(
            key=lambda x: (x[1], x[0].usage_count, x[0].quality_score), reverse=True
        )

        return [block for block, _ in matching_blocks[:limit]]

    async def search_templates(
        self,
        query: str = "",
        template_type: Optional[str] = None,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: int = 20,
    ) -> List[Template]:
        """Search templates with various filters"""

        candidates = set(self.templates.keys())

        # Apply filters
        if category:
            candidates &= self.templates_by_category.get(category, set())

        if template_type:
            candidates &= self.templates_by_type.get(template_type, set())

        # Get matching templates
        matching_templates = []
        query_lower = query.lower() if query else ""

        for template_id in candidates:
            if template_id not in self.templates:
                continue

            template = self.templates[template_id]

            # Apply tag filter
            if tags:
                if not any(
                    tag.lower() in [t.lower() for t in template.tags] for tag in tags
                ):
                    continue

            # Calculate relevance score
            relevance_score = 0.0

            if query:
                # Name match
                if query_lower in template.name.lower():
                    relevance_score += 3.0

                # Description match
                desc_similarity = self._calculate_similarity(
                    query, template.description
                )
                relevance_score += desc_similarity * 2.0

                # Tag match
                for tag in template.tags:
                    if query_lower in tag.lower():
                        relevance_score += 0.5
            else:
                # No query - use usage-based scoring
                relevance_score = template.usage_count * 0.1 + template.quality_score

            matching_templates.append((template, relevance_score))

        # Sort by relevance and usage
        matching_templates.sort(
            key=lambda x: (x[1], x[0].usage_count, x[0].quality_score), reverse=True
        )

        return [template for template, _ in matching_templates[:limit]]

    async def recommend_content(
        self,
        context: str,
        content_type: str = "both",  # block, template, both
        category: Optional[str] = None,
        limit: int = 10,
        min_relevance: float = 0.3,
    ) -> List[ContentRecommendation]:
        """Recommend content based on context"""

        self.stats.recommendation_requests += 1

        # Check cache first
        cache_key = f"{context[:100]}:{content_type}:{category}:{limit}"
        if cache_key in self.recommendation_cache:
            cached_result = self.recommendation_cache[cache_key]
            # Check if cache is still valid
            cache_time = (
                cached_result[0].metadata.get("cached_at") if cached_result else None
            )
            if (
                cache_time
                and datetime.now() - datetime.fromisoformat(cache_time) < self.cache_ttl
            ):
                self.stats.cache_hits += 1
                return cached_result

        self.stats.cache_misses += 1

        recommendations = []
        context_keywords = self._extract_keywords(context)

        # Recommend content blocks
        if content_type in ["block", "both"]:
            for block_id, block in self.content_blocks.items():
                if category and block.category != category:
                    continue

                # Calculate relevance
                relevance_score = 0.0

                # Content similarity
                content_similarity = self._calculate_similarity(context, block.content)
                relevance_score += content_similarity * 2.0

                # Keyword overlap
                keyword_overlap = len(set(context_keywords) & set(block.keywords))
                if block.keywords:
                    relevance_score += (keyword_overlap / len(block.keywords)) * 1.5

                # Usage frequency bonus
                usage_bonus = min(block.usage_count * 0.1, 1.0)
                relevance_score += usage_bonus

                # Quality score bonus
                relevance_score += block.quality_score * 0.5

                # Recency bonus
                days_since_used = (datetime.now() - block.last_used).days
                recency_bonus = max(0, 1.0 - (days_since_used * 0.1))
                relevance_score += recency_bonus * 0.3

                if relevance_score >= min_relevance:
                    recommendation = ContentRecommendation(
                        content_id=block_id,
                        content_type="block",
                        title=block.title,
                        content=block.content[:200] + "..."
                        if len(block.content) > 200
                        else block.content,
                        relevance_score=relevance_score,
                        recommendation_reason=self._generate_recommendation_reason(
                            relevance_score,
                            content_similarity,
                            keyword_overlap,
                            usage_bonus,
                        ),
                        usage_frequency=block.usage_count,
                        quality_score=block.quality_score,
                        last_used=block.last_used,
                        metadata={
                            "block_type": block.block_type,
                            "category": block.category,
                        },
                    )
                    recommendations.append(recommendation)

        # Recommend templates
        if content_type in ["template", "both"]:
            for template_id, template in self.templates.items():
                if category and template.category != category:
                    continue

                # Calculate relevance
                relevance_score = 0.0

                # Description similarity
                desc_similarity = self._calculate_similarity(
                    context, template.description
                )
                relevance_score += desc_similarity * 2.0

                # Name similarity
                name_similarity = self._calculate_similarity(context, template.name)
                relevance_score += name_similarity * 1.5

                # Usage frequency bonus
                usage_bonus = min(template.usage_count * 0.1, 1.0)
                relevance_score += usage_bonus

                # Quality score bonus
                relevance_score += template.quality_score * 0.5

                if relevance_score >= min_relevance:
                    recommendation = ContentRecommendation(
                        content_id=template_id,
                        content_type="template",
                        title=template.name,
                        content=template.description,
                        relevance_score=relevance_score,
                        recommendation_reason=self._generate_recommendation_reason(
                            relevance_score, desc_similarity, 0, usage_bonus
                        ),
                        usage_frequency=template.usage_count,
                        quality_score=template.quality_score,
                        last_used=template.last_used,
                        metadata={
                            "template_type": template.template_type,
                            "category": template.category,
                            "block_count": len(template.content_blocks),
                        },
                    )
                    recommendations.append(recommendation)

        # Sort recommendations by relevance
        recommendations.sort(key=lambda x: x.relevance_score, reverse=True)
        recommendations = recommendations[:limit]

        # Add to cache
        for rec in recommendations:
            rec.metadata["cached_at"] = datetime.now().isoformat()
        self.recommendation_cache[cache_key] = recommendations

        return recommendations

    def _generate_recommendation_reason(
        self,
        total_score: float,
        content_sim: float,
        keyword_overlap: int,
        usage_bonus: float,
    ) -> str:
        """Generate human-readable recommendation reason"""
        reasons = []

        if content_sim > 0.7:
            reasons.append("High content similarity")
        elif content_sim > 0.4:
            reasons.append("Moderate content similarity")

        if keyword_overlap > 2:
            reasons.append("Strong keyword match")
        elif keyword_overlap > 0:
            reasons.append("Some keyword overlap")

        if usage_bonus > 0.5:
            reasons.append("Frequently used content")
        elif usage_bonus > 0.2:
            reasons.append("Moderately used content")

        if not reasons:
            reasons.append("General relevance")

        return ", ".join(reasons)

    async def get_content_block_by_category(self, category: str) -> List[ContentBlock]:
        """Get all content blocks in a category"""
        block_ids = self.blocks_by_category.get(category, set())
        return [
            self.content_blocks[block_id]
            for block_id in block_ids
            if block_id in self.content_blocks
        ]

    async def get_templates_by_type(self, template_type: str) -> List[Template]:
        """Get all templates of a specific type"""
        template_ids = self.templates_by_type.get(template_type, set())
        return [
            self.templates[template_id]
            for template_id in template_ids
            if template_id in self.templates
        ]

    async def get_popular_content(
        self, content_type: str = "both", limit: int = 20
    ) -> List[Union[ContentBlock, Template]]:
        """Get most popular content by usage"""
        popular_content = []

        if content_type in ["block", "both"]:
            blocks = sorted(
                self.content_blocks.values(),
                key=lambda x: (x.usage_count, x.quality_score),
                reverse=True,
            )
            popular_content.extend(blocks)

        if content_type in ["template", "both"]:
            templates = sorted(
                self.templates.values(),
                key=lambda x: (x.usage_count, x.quality_score),
                reverse=True,
            )
            popular_content.extend(templates)

        # Sort combined list
        popular_content.sort(
            key=lambda x: (x.usage_count, x.quality_score), reverse=True
        )

        return popular_content[:limit]

    async def get_retrieval_stats(self) -> RetrievalStats:
        """Get retrieval system statistics"""
        return self.stats

    async def clear_cache(self) -> None:
        """Clear recommendation cache"""
        self.recommendation_cache.clear()

    async def _save_content_block(self, block: ContentBlock) -> None:
        """Save content block to disk"""
        try:
            block_file = self.blocks_path / f"{block.block_id}.json"
            block_dict = asdict(block)

            # Convert datetime objects to ISO strings
            for field in ["created_at", "updated_at", "last_used"]:
                if isinstance(block_dict[field], datetime):
                    block_dict[field] = block_dict[field].isoformat()

            async with aiofiles.open(block_file, "w") as f:
                await f.write(json.dumps(block_dict, indent=2))

        except Exception as e:
            raise RuntimeError(f"Failed to save content block {block.block_id}: {e}")

    async def _save_template(self, template: Template) -> None:
        """Save template to disk"""
        try:
            template_file = self.templates_path / f"{template.template_id}.json"
            template_dict = asdict(template)

            # Convert datetime objects to ISO strings
            for field in ["created_at", "updated_at", "last_used"]:
                if isinstance(template_dict[field], datetime):
                    template_dict[field] = template_dict[field].isoformat()

            async with aiofiles.open(template_file, "w") as f:
                await f.write(json.dumps(template_dict, indent=2))

        except Exception as e:
            raise RuntimeError(f"Failed to save template {template.template_id}: {e}")

    async def _load_data(self) -> None:
        """Load content blocks and templates from disk"""
        try:
            # Load content blocks
            if self.blocks_path.exists():
                for block_file in self.blocks_path.glob("*.json"):
                    try:
                        async with aiofiles.open(block_file, "r") as f:
                            content = await f.read()
                            block_dict = json.loads(content)

                            # Convert datetime strings back
                            for field in ["created_at", "updated_at", "last_used"]:
                                if field in block_dict and isinstance(
                                    block_dict[field], str
                                ):
                                    block_dict[field] = datetime.fromisoformat(
                                        block_dict[field]
                                    )

                            block = ContentBlock(**block_dict)
                            self.content_blocks[block.block_id] = block
                            await self._update_block_indexes(block)

                    except Exception as e:
                        print(f"Error loading content block {block_file}: {e}")

            # Load templates
            if self.templates_path.exists():
                for template_file in self.templates_path.glob("*.json"):
                    try:
                        async with aiofiles.open(template_file, "r") as f:
                            content = await f.read()
                            template_dict = json.loads(content)

                            # Convert datetime strings back
                            for field in ["created_at", "updated_at", "last_used"]:
                                if field in template_dict and isinstance(
                                    template_dict[field], str
                                ):
                                    template_dict[field] = datetime.fromisoformat(
                                        template_dict[field]
                                    )

                            template = Template(**template_dict)
                            self.templates[template.template_id] = template
                            await self._update_template_indexes(template)

                    except Exception as e:
                        print(f"Error loading template {template_file}: {e}")

        except Exception as e:
            print(f"Error loading data: {e}")

# Convenience functions
async def create_document_retriever(
    storage_path: Optional[Path] = None,
) -> DocumentRetriever:
    """Create and initialize document retriever"""
    return DocumentRetriever(storage_path)

async def add_boilerplate_content(
    retriever: DocumentRetriever,
    content: str,
    title: str,
    category: str = "boilerplate",
    **kwargs,
) -> str:
    """Convenience function to add boilerplate content"""
    return await retriever.add_content_block(
        content=content,
        title=title,
        category=category,
        block_type="boilerplate",
        **kwargs,
    )
