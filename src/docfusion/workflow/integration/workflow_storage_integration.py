#!/usr/bin/env python3
"""
Workflow-Aware Storage Integration

Provides comprehensive integration between the workflow automation system
and document storage, enabling workflow-driven document management with
persistent state tracking, version control, and collaborative features.

Key Features:
- Workflow state persistence in storage
- Document-workflow relationship tracking
- Workflow-aware document retrieval and recommendations
- Version control integration with workflow phases
- Collaborative editing with workflow coordination
- Performance analytics and optimization insights
"""

import asyncio
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from ...document_engine.document_engine import DocumentGenerationResult

# Import storage components
from ...storage.storage_service import StorageService

# Import workflow components
from ..automation.workflow_engine import (
    ProcessState,
    WorkflowEngine,
    WorkflowInstance,
)
from ..monitoring.workflow_monitor import WorkflowMonitor
from ...core.utils import uuid7str

logger = logging.getLogger(__name__)

# ============================================================================
# Data Models
# ============================================================================

class DocumentWorkflowState(Enum):
    """Document workflow states"""

    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    FAILED = "failed"

class WorkflowStorageMetadata(BaseModel):
    """Extended metadata for workflow-aware documents"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    # Workflow tracking
    workflow_instance_id: Optional[str] = None
    workflow_state: Optional[ProcessState] = None
    current_phase: Optional[str] = None
    assigned_users: List[str] = Field(default_factory=list)

    # Progress tracking
    completion_percentage: float = 0.0
    quality_score: Optional[float] = None
    deadline: Optional[datetime] = None

    # Performance metrics
    processing_time_seconds: Optional[float] = None
    task_durations: Dict[str, float] = Field(default_factory=dict)
    bottleneck_phases: List[str] = Field(default_factory=list)

    # Collaboration
    active_collaborators: List[str] = Field(default_factory=list)
    pending_approvals: List[str] = Field(default_factory=list)
    review_comments: List[Dict[str, Any]] = Field(default_factory=list)

    # Version control
    workflow_version: str = "1.0"
    phase_checkpoints: Dict[str, str] = Field(
        default_factory=dict
    )  # phase -> document_version
    rollback_points: List[Dict[str, Any]] = Field(default_factory=list)

class WorkflowDocumentRelation(BaseModel):
    """Relationship between documents and workflows"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    relation_id: str = Field(default_factory=uuid7str)
    document_id: str
    workflow_instance_id: str
    relationship_type: str  # "source", "derived", "referenced", "template"
    created_at: datetime = Field(default_factory=datetime.now)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class WorkflowSearchResult(BaseModel):
    """Enhanced search result with workflow context"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    document_id: str
    title: str
    content_snippet: str
    relevance_score: float

    # Workflow context
    workflow_state: Optional[ProcessState] = None
    current_phase: Optional[str] = None
    completion_percentage: float = 0.0
    assigned_users: List[str] = Field(default_factory=list)
    deadline: Optional[datetime] = None

    # Recommendation factors
    similar_workflows: List[str] = Field(default_factory=list)
    success_probability: Optional[float] = None
    estimated_completion_time: Optional[float] = None

# ============================================================================
# Main Integration Class
# ============================================================================

class WorkflowStorageIntegration:
    """
    Comprehensive integration between workflow automation and document storage.

    This class provides workflow-aware document management capabilities,
    including state persistence, relationship tracking, and intelligent
    document recommendations based on workflow context.
    """

    def __init__(
        self,
        storage_service: StorageService,
        workflow_engine: WorkflowEngine,
        workflow_monitor: WorkflowMonitor,
    ):
        self.storage_service = storage_service
        self.workflow_engine = workflow_engine
        self.workflow_monitor = workflow_monitor

        # Internal state
        self.workflow_documents: Dict[
            str, List[str]
        ] = {}  # workflow_id -> document_ids
        self.document_workflows: Dict[str, str] = {}  # document_id -> workflow_id
        self.workflow_relations: Dict[str, List[WorkflowDocumentRelation]] = {}
        self.cached_recommendations: Dict[str, List[WorkflowSearchResult]] = {}

        # Configuration
        self.cache_ttl_seconds = 300  # 5 minutes
        self.max_cache_entries = 1000

        # Locks for thread safety
        self._storage_lock = asyncio.Lock()
        self._cache_lock = asyncio.Lock()

        logger.info("WorkflowStorageIntegration initialized")

    # ========================================================================
    # Document Storage with Workflow Context
    # ========================================================================

    async def store_workflow_document(
        self,
        document_id: str,
        workflow_instance_id: str,
        content: str,
        title: str,
        phase: str,
        generation_result: Optional[DocumentGenerationResult] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Store document with comprehensive workflow context.

        Args:
                document_id: Document identifier
                workflow_instance_id: Associated workflow instance
                content: Document content
                title: Document title
                phase: Current workflow phase
                generation_result: Optional generation result for metrics
                metadata: Additional metadata

        Returns:
                Storage result with workflow context
        """
        async with self._storage_lock:
            try:
                # Get workflow instance for context
                workflow_instance = await self.workflow_engine.get_workflow_instance(
                    workflow_instance_id
                )
                if not workflow_instance:
                    raise ValueError(
                        f"Workflow instance {workflow_instance_id} not found"
                    )

                # Build workflow-aware metadata
                workflow_metadata = WorkflowStorageMetadata()

                if workflow_instance:
                    workflow_metadata.workflow_instance_id = workflow_instance_id
                    workflow_metadata.workflow_state = workflow_instance.state
                    workflow_metadata.current_phase = phase
                    workflow_metadata.assigned_users = workflow_instance.assigned_users

                    # Calculate completion percentage
                    if hasattr(workflow_instance, "completed_tasks") and hasattr(
                        workflow_instance, "total_tasks"
                    ):
                        workflow_metadata.completion_percentage = (
                            len(workflow_instance.completed_tasks)
                            / max(workflow_instance.total_tasks, 1)
                            * 100.0
                        )

                # Add generation metrics if available
                if generation_result:
                    workflow_metadata.processing_time_seconds = (
                        generation_result.processing_time
                    )
                    workflow_metadata.quality_score = (
                        generation_result.overall_quality_score
                    )
                    workflow_metadata.task_durations = (
                        generation_result.component_processing_times
                    )

                # Prepare complete metadata
                complete_metadata = metadata or {}
                complete_metadata.update(
                    {
                        "workflow_metadata": workflow_metadata.dict(),
                        "document_workflow_state": DocumentWorkflowState.IN_PROGRESS.value,
                        "stored_at": datetime.now().isoformat(),
                        "storage_source": "workflow_integration",
                    }
                )

                # Store document with enhanced metadata
                storage_result = await self.storage_service.store_document(
                    content=content,
                    title=title,
                    document_id=document_id,
                    content_type="workflow_document",
                    category="generated",
                    tags=[f"workflow:{workflow_instance_id}", f"phase:{phase}"],
                    author="workflow_system",
                    metadata=complete_metadata,
                )

                # Track document-workflow relationship
                await self._create_document_workflow_relation(
                    document_id, workflow_instance_id, "primary"
                )

                # Update internal tracking
                if workflow_instance_id not in self.workflow_documents:
                    self.workflow_documents[workflow_instance_id] = []
                self.workflow_documents[workflow_instance_id].append(document_id)
                self.document_workflows[document_id] = workflow_instance_id

                # Invalidate relevant caches
                await self._invalidate_related_cache(document_id, workflow_instance_id)

                logger.info(
                    f"Stored workflow document {document_id} for workflow {workflow_instance_id}"
                )

                return {
                    "success": True,
                    "document_id": document_id,
                    "workflow_instance_id": workflow_instance_id,
                    "storage_result": storage_result,
                    "workflow_metadata": workflow_metadata.dict(),
                }

            except Exception as e:
                logger.error(f"Failed to store workflow document: {str(e)}")
                return {
                    "success": False,
                    "error": str(e),
                    "document_id": document_id,
                    "workflow_instance_id": workflow_instance_id,
                }

    async def retrieve_workflow_document(
        self,
        document_id: str,
        include_workflow_context: bool = True,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Retrieve document with workflow context and permissions.

        Args:
                document_id: Document identifier
                include_workflow_context: Whether to include workflow metadata
                user_id: User requesting the document

        Returns:
                Document with workflow context
        """
        try:
            # Retrieve base document
            base_result = await self.storage_service.retrieve_document(
                document_id=document_id, include_metadata=True
            )

            if not base_result:
                return {"success": False, "error": "Document not found"}

            result = {"success": True, "document": base_result, "workflow_context": {}}

            # Add workflow context if requested
            if include_workflow_context:
                workflow_context = await self._get_document_workflow_context(
                    document_id
                )
                result["workflow_context"] = workflow_context

                # Check user permissions for workflow access
                if user_id and workflow_context.get("workflow_instance_id"):
                    permissions = await self._check_workflow_document_permissions(
                        document_id, workflow_context["workflow_instance_id"], user_id
                    )
                    result["user_permissions"] = permissions

            return result

        except Exception as e:
            logger.error(
                f"Failed to retrieve workflow document {document_id}: {str(e)}"
            )
            return {"success": False, "error": str(e)}

    async def update_workflow_document_state(
        self,
        document_id: str,
        new_state: DocumentWorkflowState,
        phase: Optional[str] = None,
        user_id: Optional[str] = None,
        comments: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Update document workflow state with audit trail.

        Args:
                document_id: Document identifier
                new_state: New workflow state
                phase: Optional current phase
                user_id: User making the change
                comments: Optional comments about the change

        Returns:
                Update result
        """
        async with self._storage_lock:
            try:
                # Get current document
                doc_result = await self.retrieve_workflow_document(
                    document_id, include_workflow_context=True
                )
                if not doc_result["success"]:
                    return doc_result

                document = doc_result["document"]
                workflow_context = doc_result["workflow_context"]

                # Update workflow metadata
                current_metadata = document.get("metadata", {})
                workflow_metadata = current_metadata.get("workflow_metadata", {})

                # Create state change record
                state_change = {
                    "from_state": workflow_metadata.get("workflow_state"),
                    "to_state": new_state.value,
                    "phase": phase,
                    "changed_by": user_id,
                    "changed_at": datetime.now().isoformat(),
                    "comments": comments,
                }

                # Update metadata
                workflow_metadata["workflow_state"] = new_state.value
                if phase:
                    workflow_metadata["current_phase"] = phase

                # Add to state history
                if "state_history" not in current_metadata:
                    current_metadata["state_history"] = []
                current_metadata["state_history"].append(state_change)

                # Update document metadata
                current_metadata["workflow_metadata"] = workflow_metadata
                current_metadata["document_workflow_state"] = new_state.value
                current_metadata["last_modified"] = datetime.now().isoformat()

                # Store updated document
                await self.storage_service.update_document_metadata(
                    document_id=document_id, metadata=current_metadata
                )

                # Notify workflow engine of state change
                if workflow_context.get("workflow_instance_id"):
                    await self.workflow_engine.emit_workflow_event(
                        workflow_context["workflow_instance_id"],
                        "document_state_changed",
                        {"document_id": document_id, "state_change": state_change},
                    )

                logger.info(
                    f"Updated workflow state for document {document_id} to {new_state.value}"
                )

                return {
                    "success": True,
                    "document_id": document_id,
                    "new_state": new_state.value,
                    "state_change": state_change,
                }

            except Exception as e:
                logger.error(f"Failed to update workflow document state: {str(e)}")
                return {"success": False, "error": str(e)}

    # ========================================================================
    # Workflow-Aware Search and Recommendations
    # ========================================================================

    async def search_workflow_documents(
        self,
        query: str,
        workflow_filter: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[WorkflowSearchResult]:
        """
        Search documents with workflow context and intelligent ranking.

        Args:
                query: Search query
                workflow_filter: Optional workflow-specific filters
                user_id: User performing search
                limit: Maximum results

        Returns:
                Enhanced search results with workflow context
        """
        try:
            # Build search filters
            filters = {"content_type": "workflow_document"}

            if workflow_filter:
                if "workflow_state" in workflow_filter:
                    filters["document_workflow_state"] = workflow_filter[
                        "workflow_state"
                    ]

                if "phase" in workflow_filter:
                    filters["tags"] = f"phase:{workflow_filter['phase']}"

                if "assigned_user" in workflow_filter:
                    filters["workflow_assigned_user"] = workflow_filter["assigned_user"]

            # Perform base search
            search_results = await self.storage_service.search_documents(
                query=query,
                filters=filters,
                limit=limit * 2,  # Get extra results for workflow ranking
                include_highlights=True,
            )

            # Enhance results with workflow context
            enhanced_results = []
            for result in search_results:
                try:
                    enhanced_result = await self._enhance_search_result_with_workflow(
                        result, user_id
                    )
                    if enhanced_result:
                        enhanced_results.append(enhanced_result)
                except Exception as e:
                    logger.warning(f"Failed to enhance search result: {str(e)}")
                    continue

            # Apply workflow-aware ranking
            ranked_results = await self._rank_workflow_search_results(
                enhanced_results, query, user_id
            )

            return ranked_results[:limit]

        except Exception as e:
            logger.error(f"Workflow document search failed: {str(e)}")
            return []

    async def get_workflow_document_recommendations(
        self,
        workflow_instance_id: str,
        current_phase: str,
        user_id: Optional[str] = None,
        limit: int = 10,
    ) -> List[WorkflowSearchResult]:
        """
        Get intelligent document recommendations based on workflow context.

        Args:
                workflow_instance_id: Current workflow instance
                current_phase: Current workflow phase
                user_id: User requesting recommendations
                limit: Maximum recommendations

        Returns:
                Recommended documents with relevance scoring
        """
        cache_key = f"recommendations:{workflow_instance_id}:{current_phase}:{user_id}"

        # Check cache first
        async with self._cache_lock:
            if cache_key in self.cached_recommendations:
                cached_result = self.cached_recommendations[cache_key]
                if self._is_cache_valid(cache_key):
                    return cached_result[:limit]

        try:
            # Get workflow context
            workflow_instance = await self.workflow_engine.get_workflow_instance(
                workflow_instance_id
            )
            if not workflow_instance:
                return []

            # Build recommendation query based on workflow context
            context_factors = await self._extract_workflow_context_factors(
                workflow_instance, current_phase
            )

            # Get similar workflows
            similar_workflows = await self._find_similar_workflows(
                workflow_instance, context_factors
            )

            # Get documents from similar workflows
            candidate_documents = await self._get_documents_from_similar_workflows(
                similar_workflows, current_phase
            )

            # Score and rank recommendations
            recommendations = await self._score_document_recommendations(
                candidate_documents, context_factors, user_id
            )

            # Cache results
            async with self._cache_lock:
                self.cached_recommendations[cache_key] = recommendations
                await self._cleanup_cache_if_needed()

            return recommendations[:limit]

        except Exception as e:
            logger.error(f"Failed to get workflow document recommendations: {str(e)}")
            return []

    async def get_workflow_performance_insights(
        self, workflow_instance_id: Optional[str] = None, time_period_days: int = 30
    ) -> Dict[str, Any]:
        """
        Get performance insights for workflow document operations.

        Args:
                workflow_instance_id: Optional specific workflow instance
                time_period_days: Analysis period in days

        Returns:
                Performance insights and recommendations
        """
        try:
            cutoff_date = datetime.now() - timedelta(days=time_period_days)

            # Get workflow documents from the period
            if workflow_instance_id:
                document_ids = self.workflow_documents.get(workflow_instance_id, [])
            else:
                document_ids = list(self.document_workflows.keys())

            # Analyze document performance
            performance_data = await self._analyze_workflow_document_performance(
                document_ids, cutoff_date
            )

            # Get workflow metrics
            workflow_metrics = (
                await self.workflow_monitor.get_comprehensive_workflow_metrics()
            )

            # Generate insights
            insights = {
                "analysis_period_days": time_period_days,
                "total_workflow_documents": len(document_ids),
                "document_performance": performance_data,
                "workflow_metrics": workflow_metrics,
                "optimization_recommendations": await self._generate_performance_recommendations(
                    performance_data, workflow_metrics
                ),
                "generated_at": datetime.now().isoformat(),
            }

            return insights

        except Exception as e:
            logger.error(f"Failed to get workflow performance insights: {str(e)}")
            return {"error": str(e)}

    # ========================================================================
    # Document-Workflow Relationship Management
    # ========================================================================

    async def _create_document_workflow_relation(
        self,
        document_id: str,
        workflow_instance_id: str,
        relationship_type: str,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Create a relationship between document and workflow."""
        relation = WorkflowDocumentRelation(
            document_id=document_id,
            workflow_instance_id=workflow_instance_id,
            relationship_type=relationship_type,
            metadata=metadata or {},
        )

        if workflow_instance_id not in self.workflow_relations:
            self.workflow_relations[workflow_instance_id] = []

        self.workflow_relations[workflow_instance_id].append(relation)

    async def _get_document_workflow_context(self, document_id: str) -> Dict[str, Any]:
        """Get comprehensive workflow context for a document."""
        workflow_id = self.document_workflows.get(document_id)
        if not workflow_id:
            return {}

        try:
            workflow_instance = await self.workflow_engine.get_workflow_instance(
                workflow_id
            )
            if not workflow_instance:
                return {}

            # Get workflow relations
            relations = self.workflow_relations.get(workflow_id, [])
            document_relations = [r for r in relations if r.document_id == document_id]

            context = {
                "workflow_instance_id": workflow_id,
                "workflow_state": workflow_instance.state.value
                if workflow_instance.state
                else None,
                "workflow_type": getattr(
                    workflow_instance, "process_definition_id", None
                ),
                "assigned_users": getattr(workflow_instance, "assigned_users", []),
                "created_at": getattr(workflow_instance, "created_at", None),
                "relations": [r.dict() for r in document_relations],
            }

            return context

        except Exception as e:
            logger.warning(
                f"Failed to get workflow context for document {document_id}: {str(e)}"
            )
            return {}

    async def _check_workflow_document_permissions(
        self, document_id: str, workflow_instance_id: str, user_id: str
    ) -> Dict[str, bool]:
        """Check user permissions for workflow document access."""
        try:
            workflow_instance = await self.workflow_engine.get_workflow_instance(
                workflow_instance_id
            )
            if not workflow_instance:
                return {"read": False, "write": False, "approve": False}

            # Basic permissions based on workflow participation
            is_assigned = user_id in getattr(workflow_instance, "assigned_users", [])
            is_creator = user_id == getattr(workflow_instance, "created_by", None)

            permissions = {
                "read": is_assigned or is_creator,
                "write": is_assigned,
                "approve": is_creator,  # Simplified - would check roles in production
                "workflow_admin": is_creator,
            }

            return permissions

        except Exception as e:
            logger.warning(f"Failed to check permissions: {str(e)}")
            return {"read": False, "write": False, "approve": False}

    # ========================================================================
    # Search Enhancement and Ranking
    # ========================================================================

    async def _enhance_search_result_with_workflow(
        self, base_result: Dict[str, Any], user_id: Optional[str]
    ) -> Optional[WorkflowSearchResult]:
        """Enhance search result with workflow context."""
        try:
            document_id = base_result.get("document_id")
            if not document_id:
                return None

            # Get workflow context
            workflow_context = await self._get_document_workflow_context(document_id)

            # Create enhanced result
            enhanced = WorkflowSearchResult(
                document_id=document_id,
                title=base_result.get("title", ""),
                content_snippet=base_result.get("content_snippet", ""),
                relevance_score=base_result.get("relevance_score", 0.0),
            )

            # Add workflow context
            if workflow_context:
                enhanced.workflow_state = (
                    ProcessState(workflow_context["workflow_state"])
                    if workflow_context.get("workflow_state")
                    else None
                )
                enhanced.current_phase = workflow_context.get("current_phase")
                enhanced.assigned_users = workflow_context.get("assigned_users", [])

            # Add document metadata
            metadata = base_result.get("metadata", {})
            workflow_metadata = metadata.get("workflow_metadata", {})
            enhanced.completion_percentage = workflow_metadata.get(
                "completion_percentage", 0.0
            )

            if workflow_metadata.get("deadline"):
                enhanced.deadline = datetime.fromisoformat(
                    workflow_metadata["deadline"]
                )

            return enhanced

        except Exception as e:
            logger.warning(f"Failed to enhance search result: {str(e)}")
            return None

    async def _rank_workflow_search_results(
        self, results: List[WorkflowSearchResult], query: str, user_id: Optional[str]
    ) -> List[WorkflowSearchResult]:
        """Apply workflow-aware ranking to search results."""
        try:
            # Calculate workflow relevance scores
            for result in results:
                workflow_score = await self._calculate_workflow_relevance(
                    result, query, user_id
                )

                # Combine base relevance with workflow relevance
                result.relevance_score = (
                    result.relevance_score * 0.6  # Base text relevance
                    + workflow_score * 0.4  # Workflow context relevance
                )

            # Sort by enhanced relevance score
            results.sort(key=lambda r: r.relevance_score, reverse=True)

            return results

        except Exception as e:
            logger.warning(f"Failed to rank workflow search results: {str(e)}")
            return results

    async def _calculate_workflow_relevance(
        self, result: WorkflowSearchResult, query: str, user_id: Optional[str]
    ) -> float:
        """Calculate workflow-specific relevance score."""
        score = 0.0

        # User assignment boost
        if user_id and user_id in result.assigned_users:
            score += 0.3

        # Active workflow boost
        if result.workflow_state in [ProcessState.RUNNING, ProcessState.WAITING]:
            score += 0.2

        # Recent deadline boost
        if result.deadline and result.deadline > datetime.now():
            days_until_deadline = (result.deadline - datetime.now()).days
            if days_until_deadline <= 7:
                score += 0.25 * (8 - days_until_deadline) / 7

        # Completion progress boost
        if result.completion_percentage > 0:
            score += 0.1 * (result.completion_percentage / 100.0)

        return min(score, 1.0)

    # ========================================================================
    # Workflow Analytics and Recommendations
    # ========================================================================

    async def _extract_workflow_context_factors(
        self, workflow_instance: WorkflowInstance, current_phase: str
    ) -> Dict[str, Any]:
        """Extract context factors for recommendations."""
        return {
            "workflow_type": getattr(workflow_instance, "process_definition_id", ""),
            "current_phase": current_phase,
            "assigned_users": getattr(workflow_instance, "assigned_users", []),
            "workflow_age_days": (
                datetime.now()
                - getattr(workflow_instance, "created_at", datetime.now())
            ).days,
            "context_data": getattr(workflow_instance, "context", {}),
        }

    async def _find_similar_workflows(
        self, workflow_instance: WorkflowInstance, context_factors: Dict[str, Any]
    ) -> List[str]:
        """Find workflows similar to the current one."""
        try:
            # Get all completed workflows of the same type
            similar_workflows = []

            # This would be implemented with proper workflow history in production
            # For now, return a mock set of similar workflow IDs
            similar_workflows = [f"workflow_{i}" for i in range(5, 10)]

            return similar_workflows

        except Exception as e:
            logger.warning(f"Failed to find similar workflows: {str(e)}")
            return []

    async def _get_documents_from_similar_workflows(
        self, workflow_ids: List[str], target_phase: str
    ) -> List[Dict[str, Any]]:
        """Get documents from similar workflows at the target phase."""
        candidate_documents = []

        for workflow_id in workflow_ids:
            if workflow_id in self.workflow_documents:
                document_ids = self.workflow_documents[workflow_id]

                for doc_id in document_ids:
                    try:
                        doc_result = await self.retrieve_workflow_document(
                            doc_id, include_workflow_context=True
                        )

                        if doc_result["success"]:
                            document = doc_result["document"]
                            workflow_context = doc_result["workflow_context"]

                            # Check if document was created at target phase
                            metadata = document.get("metadata", {})
                            workflow_metadata = metadata.get("workflow_metadata", {})

                            if workflow_metadata.get("current_phase") == target_phase:
                                candidate_documents.append(
                                    {
                                        "document_id": doc_id,
                                        "document": document,
                                        "workflow_context": workflow_context,
                                    }
                                )

                    except Exception as e:
                        logger.warning(
                            f"Failed to retrieve candidate document {doc_id}: {str(e)}"
                        )
                        continue

        return candidate_documents

    async def _score_document_recommendations(
        self,
        candidates: List[Dict[str, Any]],
        context_factors: Dict[str, Any],
        user_id: Optional[str],
    ) -> List[WorkflowSearchResult]:
        """Score and rank document recommendations."""
        recommendations = []

        for candidate in candidates:
            try:
                document = candidate["document"]
                workflow_context = candidate["workflow_context"]

                # Calculate recommendation score
                score = await self._calculate_recommendation_score(
                    candidate, context_factors, user_id
                )

                if score > 0.3:  # Minimum threshold
                    recommendation = WorkflowSearchResult(
                        document_id=candidate["document_id"],
                        title=document.get("title", ""),
                        content_snippet=document.get("content", "")[:200] + "...",
                        relevance_score=score,
                    )

                    # Add workflow context
                    metadata = document.get("metadata", {})
                    workflow_metadata = metadata.get("workflow_metadata", {})

                    recommendation.workflow_state = (
                        ProcessState(workflow_context.get("workflow_state"))
                        if workflow_context.get("workflow_state")
                        else None
                    )
                    recommendation.current_phase = workflow_metadata.get(
                        "current_phase"
                    )
                    recommendation.completion_percentage = workflow_metadata.get(
                        "completion_percentage", 0.0
                    )
                    recommendation.assigned_users = workflow_metadata.get(
                        "assigned_users", []
                    )

                    # Add success probability based on historical data
                    recommendation.success_probability = (
                        await self._estimate_success_probability(
                            candidate, context_factors
                        )
                    )

                    recommendations.append(recommendation)

            except Exception as e:
                logger.warning(f"Failed to score recommendation: {str(e)}")
                continue

        # Sort by relevance score
        recommendations.sort(key=lambda r: r.relevance_score, reverse=True)

        return recommendations

    async def _calculate_recommendation_score(
        self,
        candidate: Dict[str, Any],
        context_factors: Dict[str, Any],
        user_id: Optional[str],
    ) -> float:
        """Calculate recommendation score for a candidate document."""
        score = 0.5  # Base score

        document = candidate["document"]
        metadata = document.get("metadata", {})
        workflow_metadata = metadata.get("workflow_metadata", {})

        # Phase match boost
        if workflow_metadata.get("current_phase") == context_factors.get(
            "current_phase"
        ):
            score += 0.3

        # Quality score boost
        quality_score = workflow_metadata.get("quality_score", 0.0)
        if quality_score > 0:
            score += 0.2 * quality_score

        # User overlap boost
        candidate_users = workflow_metadata.get("assigned_users", [])
        context_users = context_factors.get("assigned_users", [])
        user_overlap = len(set(candidate_users) & set(context_users))
        if user_overlap > 0:
            score += 0.1 * min(user_overlap / len(context_users), 1.0)

        # Recency boost
        stored_at = metadata.get("stored_at")
        if stored_at:
            try:
                stored_date = datetime.fromisoformat(stored_at)
                days_old = (datetime.now() - stored_date).days
                if days_old < 30:
                    score += 0.1 * (30 - days_old) / 30
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to parse stored_at date for recency boost: {e}")

        return min(score, 1.0)

    async def _estimate_success_probability(
        self, candidate: Dict[str, Any], context_factors: Dict[str, Any]
    ) -> float:
        """Estimate success probability for using this document."""
        # This would use ML models in production
        # For now, return a simple heuristic-based estimate

        document = candidate["document"]
        metadata = document.get("metadata", {})
        workflow_metadata = metadata.get("workflow_metadata", {})

        base_probability = 0.7

        # Quality score influence
        quality_score = workflow_metadata.get("quality_score", 0.0)
        if quality_score > 0:
            base_probability += (quality_score - 0.5) * 0.3

        # Processing time influence (faster is better for similar workflows)
        processing_time = workflow_metadata.get("processing_time_seconds", 0)
        if processing_time > 0 and processing_time < 3600:  # Less than 1 hour
            base_probability += 0.1

        return min(max(base_probability, 0.0), 1.0)

    # ========================================================================
    # Performance Analysis
    # ========================================================================

    async def _analyze_workflow_document_performance(
        self, document_ids: List[str], cutoff_date: datetime
    ) -> Dict[str, Any]:
        """Analyze performance of workflow documents."""
        performance_data = {
            "total_documents": len(document_ids),
            "average_quality_score": 0.0,
            "average_processing_time": 0.0,
            "phase_performance": {},
            "bottleneck_analysis": {},
            "success_rate": 0.0,
        }

        quality_scores = []
        processing_times = []
        phase_counts = {}
        successful_completions = 0

        for doc_id in document_ids:
            try:
                doc_result = await self.retrieve_workflow_document(
                    doc_id, include_workflow_context=True
                )

                if not doc_result["success"]:
                    continue

                document = doc_result["document"]
                metadata = document.get("metadata", {})
                workflow_metadata = metadata.get("workflow_metadata", {})

                # Collect quality scores
                quality_score = workflow_metadata.get("quality_score")
                if quality_score:
                    quality_scores.append(quality_score)

                # Collect processing times
                processing_time = workflow_metadata.get("processing_time_seconds")
                if processing_time:
                    processing_times.append(processing_time)

                # Track phase performance
                current_phase = workflow_metadata.get("current_phase")
                if current_phase:
                    if current_phase not in phase_counts:
                        phase_counts[current_phase] = {"count": 0, "avg_time": 0.0}
                    phase_counts[current_phase]["count"] += 1

                    if processing_time:
                        current_avg = phase_counts[current_phase]["avg_time"]
                        count = phase_counts[current_phase]["count"]
                        phase_counts[current_phase]["avg_time"] = (
                            current_avg * (count - 1) + processing_time
                        ) / count

                # Check completion status
                workflow_state = workflow_metadata.get("workflow_state")
                if workflow_state in ["completed", "approved"]:
                    successful_completions += 1

            except Exception as e:
                logger.warning(f"Failed to analyze document {doc_id}: {str(e)}")
                continue

        # Calculate averages
        if quality_scores:
            performance_data["average_quality_score"] = sum(quality_scores) / len(
                quality_scores
            )

        if processing_times:
            performance_data["average_processing_time"] = sum(processing_times) / len(
                processing_times
            )

        performance_data["phase_performance"] = phase_counts
        performance_data["success_rate"] = successful_completions / max(
            len(document_ids), 1
        )

        return performance_data

    async def _generate_performance_recommendations(
        self, performance_data: Dict[str, Any], workflow_metrics: Dict[str, Any]
    ) -> List[str]:
        """Generate performance optimization recommendations."""
        recommendations = []

        # Quality-based recommendations
        avg_quality = performance_data.get("average_quality_score", 0.0)
        if avg_quality < 0.8:
            recommendations.append(
                f"Average quality score ({avg_quality:.2f}) is below optimal. "
                "Consider reviewing content generation parameters and validation rules."
            )

        # Performance-based recommendations
        avg_time = performance_data.get("average_processing_time", 0.0)
        if avg_time > 1800:  # 30 minutes
            recommendations.append(
                f"Average processing time ({avg_time / 60:.1f} minutes) is high. "
                "Consider optimizing workflow phases or adding parallel processing."
            )

        # Success rate recommendations
        success_rate = performance_data.get("success_rate", 0.0)
        if success_rate < 0.9:
            recommendations.append(
                f"Success rate ({success_rate:.1%}) could be improved. "
                "Review failure patterns and add better error handling."
            )

        # Phase-specific recommendations
        phase_performance = performance_data.get("phase_performance", {})
        if phase_performance:
            slowest_phase = max(
                phase_performance.items(), key=lambda x: x[1]["avg_time"]
            )
            if slowest_phase[1]["avg_time"] > avg_time * 1.5:
                recommendations.append(
                    f"Phase '{slowest_phase[0]}' is taking longer than average. "
                    "Consider breaking it into smaller tasks or optimizing its execution."
                )

        return recommendations

    # ========================================================================
    # Cache Management
    # ========================================================================

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cache entry is still valid."""
        # Simplified cache validation - would use timestamps in production
        return True

    async def _cleanup_cache_if_needed(self):
        """Clean up cache if it gets too large."""
        if len(self.cached_recommendations) > self.max_cache_entries:
            # Remove oldest 20% of entries
            keys_to_remove = list(self.cached_recommendations.keys())[
                : self.max_cache_entries // 5
            ]
            for key in keys_to_remove:
                del self.cached_recommendations[key]

    async def _invalidate_related_cache(
        self, document_id: str, workflow_instance_id: str
    ):
        """Invalidate cache entries related to a document or workflow."""
        keys_to_remove = []

        for cache_key in self.cached_recommendations:
            if workflow_instance_id in cache_key or document_id in cache_key:
                keys_to_remove.append(cache_key)

        for key in keys_to_remove:
            del self.cached_recommendations[key]

    # ========================================================================
    # Lifecycle Management
    # ========================================================================

    async def initialize(self):
        """Initialize the workflow storage integration."""
        try:
            # Ensure storage service is initialized
            if hasattr(self.storage_service, "initialize"):
                await self.storage_service.initialize()

            logger.info("WorkflowStorageIntegration initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize WorkflowStorageIntegration: {str(e)}")
            raise

    async def cleanup(self):
        """Clean up resources."""
        async with self._storage_lock:
            self.workflow_documents.clear()
            self.document_workflows.clear()
            self.workflow_relations.clear()

        async with self._cache_lock:
            self.cached_recommendations.clear()

        logger.info("WorkflowStorageIntegration cleaned up")

# ============================================================================
# Factory Functions
# ============================================================================

async def create_workflow_storage_integration(
    storage_service: StorageService,
    workflow_engine: WorkflowEngine,
    workflow_monitor: WorkflowMonitor,
) -> WorkflowStorageIntegration:
    """
    Factory function to create and initialize WorkflowStorageIntegration.

    Args:
            storage_service: Document storage service
            workflow_engine: Workflow automation engine
            workflow_monitor: Workflow monitoring system

    Returns:
            Initialized WorkflowStorageIntegration instance
    """
    integration = WorkflowStorageIntegration(
        storage_service=storage_service,
        workflow_engine=workflow_engine,
        workflow_monitor=workflow_monitor,
    )

    await integration.initialize()
    return integration
