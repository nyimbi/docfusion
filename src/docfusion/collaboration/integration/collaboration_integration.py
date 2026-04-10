"""
Collaboration Integration Module

Integration layer between collaborative editing system and document engine including:
- Real-time document synchronization
- Collaborative workflow integration
- Document state management
- User session coordination
- Performance optimization for collaborative editing

Simple API for seamless collaboration features in document generation.
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union

from pydantic import BaseModel, ConfigDict, Field
logger = logging.getLogger(__name__)

from ..conflicts.conflict_detector import (
    ConflictAnalysisResult,
    ConflictDetector,
    DetectedConflict,
)
from ..conflicts.conflict_resolver import (
    ConflictResolutionResult,
    ConflictResolver,
    ResolutionStrategy,
)

# Import collaboration modules
from ..editing.collaborative_editor import (
    CollaborativeEditor,
    CollaborativeSession,
    DocumentState,
    Operation,
    User,
)
from ...core.utils import uuid7str
from ..versioning.version_manager import (
    DocumentBranch,
    DocumentCommit,
    DocumentHistory,
    VersionManager,
)

# Import document engine components (simplified imports)
try:
    from ...document_engine.compliance_integration import DocumentComplianceIntegrator
    from ...document_engine.document_processor import DocumentProcessor
    from ...document_engine.document_renderer import DocumentRenderer
except ImportError:
    # Fallback for demo/testing
    DocumentRenderer = None
    DocumentProcessor = None
    DocumentComplianceIntegrator = None

class CollaborationMode(Enum):
    """Collaboration modes for documents"""

    REAL_TIME = "real_time"  # Live collaborative editing
    TURN_BASED = "turn_based"  # Sequential editing with locks
    BRANCH_BASED = "branch_based"  # Git-like branching workflow
    REVIEW_BASED = "review_based"  # Review and approval workflow
    HYBRID = "hybrid"  # Combination of modes

class SyncStrategy(Enum):
    """Document synchronization strategies"""

    IMMEDIATE = "immediate"  # Sync every change immediately
    BATCHED = "batched"  # Batch changes for efficiency
    PERIODIC = "periodic"  # Sync at regular intervals
    ON_DEMAND = "on_demand"  # Sync only when requested

class DocumentStatus(Enum):
    """Status of collaborative document"""

    DRAFT = "draft"
    ACTIVE_COLLABORATION = "active_collaboration"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"

@dataclass
class CollaborationSettings:
    """Settings for collaborative document editing"""

    collaboration_mode: CollaborationMode = CollaborationMode.REAL_TIME
    sync_strategy: SyncStrategy = SyncStrategy.IMMEDIATE
    max_concurrent_users: int = 10
    auto_save_interval: int = 30  # seconds
    conflict_resolution_strategy: ResolutionStrategy = ResolutionStrategy.AUTO_MERGE
    version_control_enabled: bool = True
    real_time_sync_enabled: bool = True
    user_presence_tracking: bool = True
    comment_system_enabled: bool = True
    track_all_changes: bool = True
    backup_frequency: int = 300  # seconds

@dataclass
class UserSession:
    """User collaboration session information"""

    session_id: str = field(default_factory=uuid7str)
    user_id: str = ""
    user_name: str = ""
    joined_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)
    permissions: Set[str] = field(default_factory=lambda: {"read", "write"})
    active_branch: str = "main"
    cursor_position: Optional[int] = None
    selection_range: Optional[Tuple[int, int]] = None
    is_online: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class DocumentSnapshot:
    """Point-in-time snapshot of document state"""

    snapshot_id: str = field(default_factory=uuid7str)
    document_id: str = ""
    content: str = ""
    version: int = 0
    branch_name: str = "main"
    commit_id: Optional[str] = None
    active_users: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

class CollaborativeDocument(BaseModel):
    """Collaborative document with integrated features"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_default=True)

    # Document identification
    document_id: str = Field(default_factory=uuid7str)
    title: str = ""
    description: str = ""

    # Content and state
    current_content: str = ""
    current_version: int = 0
    status: DocumentStatus = DocumentStatus.DRAFT

    # Collaboration metadata
    collaboration_settings: CollaborationSettings = Field(
        default_factory=CollaborationSettings
    )
    active_sessions: Dict[str, UserSession] = Field(default_factory=dict)

    # Integration components
    collaborative_editor_active: bool = False
    version_manager_active: bool = False
    conflict_detection_active: bool = False

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.now)
    last_modified: datetime = Field(default_factory=datetime.now)
    last_synced: datetime = Field(default_factory=datetime.now)

    # Performance metrics
    total_operations: int = 0
    total_conflicts_resolved: int = 0
    average_sync_time_ms: float = 0.0

class CollaborationIntegrator:
    """
    Integration layer for collaborative document editing.

    Coordinates between collaborative editor, version management, conflict resolution,
    and document engine for seamless real-time collaboration.

    Simple usage:
    ```python
    integrator = CollaborationIntegrator()
    doc = await integrator.create_collaborative_document("My Document")
    await integrator.add_user(doc.document_id, "user1", "Alice")
    await integrator.edit_document(doc.document_id, "user1", "New content")
    ```
    """

    def __init__(
        self,
        storage_path: Optional[str] = None,
        document_renderer: Optional[Any] = None,
        document_processor: Optional[Any] = None,
        compliance_integrator: Optional[Any] = None,
    ):
        self.storage_path = (
            Path(storage_path) if storage_path else Path.cwd() / "collaborative_docs"
        )
        self.storage_path.mkdir(exist_ok=True)

        # Core collaboration components
        self.collaborative_sessions: Dict[str, CollaborativeSession] = {}
        self.version_managers: Dict[str, VersionManager] = {}
        self.conflict_detector = ConflictDetector(semantic_analysis=True)
        self.conflict_resolver = ConflictResolver(semantic_resolution=True)

        # Document engine integration
        self.document_renderer = document_renderer
        self.document_processor = document_processor
        self.compliance_integrator = compliance_integrator

        # Document registry
        self.documents: Dict[str, CollaborativeDocument] = {}
        self.document_snapshots: Dict[str, List[DocumentSnapshot]] = {}

        # Performance tracking
        self.operation_metrics: Dict[str, List[float]] = {}

        # Thread safety
        self._lock = asyncio.Lock()

        # Background tasks
        self._sync_tasks: Dict[str, asyncio.Task] = {}

    async def create_collaborative_document(
        self,
        title: str,
        initial_content: str = "",
        settings: Optional[CollaborationSettings] = None,
        creator_id: str = "",
    ) -> CollaborativeDocument:
        """
        Create new collaborative document.

        Simple API for document creation with collaboration features.
        """
        async with self._lock:
            doc = CollaborativeDocument(
                title=title,
                current_content=initial_content,
                collaboration_settings=settings or CollaborationSettings(),
            )

            # Initialize collaborative editor
            if doc.collaboration_settings.real_time_sync_enabled:
                session = CollaborativeSession()
                editor = await session.create_session(
                    doc.document_id,
                    initial_content,
                    websocket_handler=self._websocket_handler,
                )
                self.collaborative_sessions[doc.document_id] = session
                doc.collaborative_editor_active = True

            # Initialize version manager
            if doc.collaboration_settings.version_control_enabled:
                version_manager = VersionManager(
                    doc.document_id, str(self.storage_path / doc.document_id)
                )
                # Create initial commit
                if initial_content:
                    await version_manager.create_commit(
                        creator_id or "system",
                        "Initial document creation",
                        initial_content,
                        creator_id or "System",
                    )
                    doc.current_version = 1

                self.version_managers[doc.document_id] = version_manager
                doc.version_manager_active = True

            # Register document
            self.documents[doc.document_id] = doc

            # Create initial snapshot
            await self._create_document_snapshot(doc)

            # Start background sync if needed
            if doc.collaboration_settings.sync_strategy == SyncStrategy.PERIODIC:
                await self._start_background_sync(doc.document_id)

            return doc

    async def add_user_to_document(
        self,
        document_id: str,
        user_id: str,
        user_name: str,
        permissions: Optional[Set[str]] = None,
    ) -> UserSession:
        """
        Add user to collaborative document session.

        Simple API for user management.
        """
        if document_id not in self.documents:
            raise ValueError(f"Document {document_id} not found")

        doc = self.documents[document_id]

        # Create user session
        session = UserSession(
            user_id=user_id,
            user_name=user_name,
            permissions=permissions or {"read", "write"},
        )

        # Add to collaborative editor if active
        if (
            doc.collaborative_editor_active
            and document_id in self.collaborative_sessions
        ):
            collab_session = self.collaborative_sessions[document_id]
            editor = await collab_session.get_session(document_id)
            if editor:
                await editor.add_user(
                    user_id, user_name, permissions=session.permissions
                )

        # Register session
        doc.active_sessions[session.session_id] = session
        doc.last_modified = datetime.now()

        return session

    async def edit_document(
        self,
        document_id: str,
        user_id: str,
        content: str,
        position: Optional[int] = None,
        length: Optional[int] = None,
        commit_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Edit document content with real-time collaboration.

        Simple API for document editing with automatic sync and conflict resolution.
        """
        start_time = time.time()

        if document_id not in self.documents:
            raise ValueError(f"Document {document_id} not found")

        doc = self.documents[document_id]
        result = {
            "success": False,
            "conflicts_detected": [],
            "conflicts_resolved": [],
            "new_version": doc.current_version,
            "sync_time_ms": 0.0,
        }

        try:
            # Real-time editing through collaborative editor
            if doc.collaborative_editor_active:
                result_collab = await self._handle_real_time_edit(
                    document_id, user_id, content, position, length
                )
                result.update(result_collab)

            # Version control integration
            if doc.version_manager_active:
                result_version = await self._handle_version_control_edit(
                    document_id, user_id, content, commit_message
                )
                result.update(result_version)

            # Update document state
            doc.current_content = content
            doc.current_version += 1
            doc.last_modified = datetime.now()
            doc.total_operations += 1

            # Document engine integration
            if self.document_processor:
                processed_content = await self._process_document_content(
                    content, document_id
                )
                if processed_content != content:
                    doc.current_content = processed_content

            # Compliance checking integration
            if self.compliance_integrator:
                compliance_result = await self._check_compliance(content, document_id)
                result["compliance_status"] = compliance_result

            # Sync based on strategy
            await self._handle_document_sync(
                document_id, doc.collaboration_settings.sync_strategy
            )

            result["success"] = True
            result["new_version"] = doc.current_version

        except Exception as e:
            result["error"] = str(e)

        # Track performance
        processing_time = (time.time() - start_time) * 1000
        result["sync_time_ms"] = processing_time

        await self._update_performance_metrics(document_id, processing_time)

        return result

    async def resolve_conflicts(
        self, document_id: str, user_id: str, auto_resolve: bool = True
    ) -> ConflictResolutionResult:
        """
        Detect and resolve document conflicts.

        Simple API for conflict management.
        """
        if document_id not in self.documents:
            raise ValueError(f"Document {document_id} not found")

        doc = self.documents[document_id]

        # Get current document versions from different sources
        current_content = doc.current_content

        # Get version from collaborative editor if active
        collab_content = current_content
        if doc.collaborative_editor_active:
            collab_content = await self._get_collaborative_editor_content(document_id)

        # Get version from version manager if active
        version_content = current_content
        if doc.version_manager_active:
            version_content = await self._get_version_manager_content(document_id)

        # Detect conflicts
        conflicts = await self.conflict_detector.detect_conflicts(
            current_content,
            collab_content,
            author_a="current",
            author_b="collaborative",
            document_a_id=document_id,
            document_b_id=document_id,
        )

        # Auto-resolve if requested
        resolution_result = None
        if auto_resolve and conflicts.conflicts:
            resolution_result = await self.conflict_resolver.resolve_conflicts(
                conflicts, current_content, collab_content, user_id
            )

            # Update document with resolved content if successful
            if resolution_result.merge_successful:
                doc.current_content = resolution_result.merged_content
                doc.total_conflicts_resolved += len(
                    resolution_result.resolved_conflicts
                )
                doc.last_modified = datetime.now()

        return resolution_result or ConflictResolutionResult(
            total_conflicts=len(conflicts.conflicts), analysis_result=conflicts
        )

    async def create_document_branch(
        self,
        document_id: str,
        user_id: str,
        branch_name: str,
        from_branch: str = "main",
    ) -> DocumentBranch:
        """
        Create document branch for parallel development.

        Simple API for branching workflow.
        """
        if document_id not in self.documents:
            raise ValueError(f"Document {document_id} not found")

        if document_id not in self.version_managers:
            raise ValueError(f"Version control not enabled for document {document_id}")

        version_manager = self.version_managers[document_id]
        branch = await version_manager.create_branch(
            user_id, branch_name, from_branch, f"Branch created by {user_id}"
        )

        # Update user session to use new branch
        for session in self.documents[document_id].active_sessions.values():
            if session.user_id == user_id:
                session.active_branch = branch_name
                break

        return branch

    async def merge_document_branch(
        self,
        document_id: str,
        user_id: str,
        source_branch: str,
        target_branch: str = "main",
    ) -> Tuple[bool, List[DetectedConflict]]:
        """
        Merge document branches with conflict resolution.

        Simple API for branch merging.
        """
        if document_id not in self.version_managers:
            raise ValueError(f"Version control not enabled for document {document_id}")

        version_manager = self.version_managers[document_id]

        # Attempt merge
        merge_success, conflicts = await version_manager.merge_branch(
            user_id,
            source_branch,
            target_branch,
            f"Merge {source_branch} into {target_branch}",
        )

        if merge_success:
            # Update document content with merged result
            merged_content = await version_manager.get_document_at_commit(
                version_manager.history.branches[target_branch].head_commit_id
            )

            doc = self.documents[document_id]
            doc.current_content = merged_content
            doc.current_version += 1
            doc.last_modified = datetime.now()

            # Sync to collaborative editor if active
            if doc.collaborative_editor_active:
                await self._sync_to_collaborative_editor(document_id, merged_content)

        return merge_success, conflicts

    async def get_document_history(
        self, document_id: str, branch_name: str = "main", limit: Optional[int] = None
    ) -> List[DocumentCommit]:
        """
        Get document version history.

        Simple API for history browsing.
        """
        if document_id not in self.version_managers:
            return []

        version_manager = self.version_managers[document_id]
        return await version_manager.get_branch_history(branch_name, limit)

    async def get_active_users(self, document_id: str) -> List[UserSession]:
        """Get list of active users in document."""
        if document_id not in self.documents:
            return []

        doc = self.documents[document_id]
        active_sessions = [
            session
            for session in doc.active_sessions.values()
            if session.is_online
            and (datetime.now() - session.last_activity).total_seconds()
            < 300  # 5 min timeout
        ]

        return active_sessions

    async def get_document_status(self, document_id: str) -> Dict[str, Any]:
        """Get comprehensive document collaboration status."""
        if document_id not in self.documents:
            raise ValueError(f"Document {document_id} not found")

        doc = self.documents[document_id]
        active_users = await self.get_active_users(document_id)

        status = {
            "document_id": document_id,
            "title": doc.title,
            "status": doc.status.value,
            "current_version": doc.current_version,
            "content_length": len(doc.current_content),
            "active_users": len(active_users),
            "user_list": [
                {"user_id": u.user_id, "name": u.user_name} for u in active_users
            ],
            "collaboration_mode": doc.collaboration_settings.collaboration_mode.value,
            "real_time_active": doc.collaborative_editor_active,
            "version_control_active": doc.version_manager_active,
            "total_operations": doc.total_operations,
            "conflicts_resolved": doc.total_conflicts_resolved,
            "last_modified": doc.last_modified.isoformat(),
            "average_sync_time": doc.average_sync_time_ms,
        }

        # Add version manager stats if available
        if document_id in self.version_managers:
            vm_stats = await self.version_managers[document_id].get_statistics()
            status["version_stats"] = vm_stats

        return status

    # Internal implementation methods

    async def _handle_real_time_edit(
        self,
        document_id: str,
        user_id: str,
        content: str,
        position: Optional[int],
        length: Optional[int],
    ) -> Dict[str, Any]:
        """Handle real-time collaborative editing."""
        session = self.collaborative_sessions.get(document_id)
        if not session:
            return {"real_time_edit": False}

        editor = await session.get_session(document_id)
        if not editor:
            return {"real_time_edit": False}

        # Determine operation type and execute
        if position is not None and length is not None:
            if length == 0:
                # Insert operation
                operation = await editor.insert_text(user_id, position, content)
            else:
                # Replace operation (delete + insert)
                await editor.delete_text(user_id, position, length)
                operation = await editor.insert_text(user_id, position, content)
        else:
            # Full content replacement
            current_content = await editor.get_document_content()
            if current_content != content:
                # Generate diff and apply changes
                # Simplified: just replace all content
                await editor.delete_text(user_id, 0, len(current_content))
                operation = await editor.insert_text(user_id, 0, content)

        return {
            "real_time_edit": True,
            "operation_id": operation.op_id if "operation" in locals() else None,
        }

    async def _handle_version_control_edit(
        self,
        document_id: str,
        user_id: str,
        content: str,
        commit_message: Optional[str],
    ) -> Dict[str, Any]:
        """Handle version control for document edits."""
        version_manager = self.version_managers.get(document_id)
        if not version_manager:
            return {"version_control_edit": False}

        # Find user's active branch
        user_branch = "main"
        doc = self.documents[document_id]
        for session in doc.active_sessions.values():
            if session.user_id == user_id:
                user_branch = session.active_branch
                break

        # Create commit
        message = commit_message or f"Document edit by {user_id}"
        commit = await version_manager.create_commit(
            user_id, message, content, branch_name=user_branch
        )

        return {
            "version_control_edit": True,
            "commit_id": commit.commit_id,
            "branch": user_branch,
        }

    async def _handle_document_sync(
        self, document_id: str, strategy: SyncStrategy
    ) -> None:
        """Handle document synchronization based on strategy."""
        if strategy == SyncStrategy.IMMEDIATE:
            await self._sync_document_immediately(document_id)
        elif strategy == SyncStrategy.BATCHED:
            await self._queue_document_for_batch_sync(document_id)
        elif strategy == SyncStrategy.ON_DEMAND:
            # No automatic sync
            pass

    async def _sync_document_immediately(self, document_id: str) -> None:
        """Immediately sync document across all systems."""
        doc = self.documents[document_id]

        # Sync collaborative editor with current content
        if doc.collaborative_editor_active:
            await self._sync_to_collaborative_editor(document_id, doc.current_content)

        # Update last sync time
        doc.last_synced = datetime.now()

        # Create snapshot
        await self._create_document_snapshot(doc)

    async def _sync_to_collaborative_editor(
        self, document_id: str, content: str
    ) -> None:
        """Sync content to collaborative editor."""
        session = self.collaborative_sessions.get(document_id)
        if session:
            editor = await session.get_session(document_id)
            if editor:
                # This would involve applying operations to sync content
                # Simplified implementation
                pass

    async def _get_collaborative_editor_content(self, document_id: str) -> str:
        """Get current content from collaborative editor."""
        session = self.collaborative_sessions.get(document_id)
        if session:
            editor = await session.get_session(document_id)
            if editor:
                return await editor.get_document_content()

        return self.documents[document_id].current_content

    async def _get_version_manager_content(self, document_id: str) -> str:
        """Get current content from version manager."""
        version_manager = self.version_managers.get(document_id)
        if version_manager:
            main_branch = version_manager.history.branches.get("main")
            if main_branch and main_branch.head_commit_id:
                return await version_manager.get_document_at_commit(
                    main_branch.head_commit_id
                )

        return self.documents[document_id].current_content

    async def _process_document_content(self, content: str, document_id: str) -> str:
        """Process document content through document engine."""
        if self.document_processor:
            # This would integrate with actual document processor
            # Simplified implementation
            return content
        return content

    async def _check_compliance(self, content: str, document_id: str) -> Dict[str, Any]:
        """Check document compliance."""
        if self.compliance_integrator:
            # This would integrate with compliance system
            # Simplified implementation
            return {"compliant": True, "score": 0.85}
        return {"compliant": True, "score": 1.0}

    async def _create_document_snapshot(self, doc: CollaborativeDocument) -> None:
        """Create document snapshot for backup/history."""
        snapshot = DocumentSnapshot(
            document_id=doc.document_id,
            content=doc.current_content,
            version=doc.current_version,
            active_users=[
                s.user_id for s in doc.active_sessions.values() if s.is_online
            ],
        )

        if doc.document_id not in self.document_snapshots:
            self.document_snapshots[doc.document_id] = []

        self.document_snapshots[doc.document_id].append(snapshot)

        # Keep only last 100 snapshots per document
        if len(self.document_snapshots[doc.document_id]) > 100:
            self.document_snapshots[doc.document_id] = self.document_snapshots[
                doc.document_id
            ][-100:]

    async def _update_performance_metrics(
        self, document_id: str, processing_time: float
    ) -> None:
        """Update performance metrics for document."""
        if document_id not in self.operation_metrics:
            self.operation_metrics[document_id] = []

        self.operation_metrics[document_id].append(processing_time)

        # Keep only last 100 measurements
        if len(self.operation_metrics[document_id]) > 100:
            self.operation_metrics[document_id] = self.operation_metrics[document_id][
                -100:
            ]

        # Update document average
        doc = self.documents[document_id]
        doc.average_sync_time_ms = sum(self.operation_metrics[document_id]) / len(
            self.operation_metrics[document_id]
        )

    async def _start_background_sync(self, document_id: str) -> None:
        """Start background sync task for document."""

        async def sync_task():
            while document_id in self.documents:
                await asyncio.sleep(30)  # Sync every 30 seconds
                try:
                    await self._sync_document_immediately(document_id)
                except Exception as e:
                    logger.warning(f"Background sync failed for document {document_id}: {e}")
                    pass

        task = asyncio.create_task(sync_task())
        self._sync_tasks[document_id] = task

    async def _websocket_handler(
        self, event_type: str, event_data: Dict[str, Any]
    ) -> None:
        """Handle WebSocket events from collaborative editor."""
        # This would handle real-time events and broadcast to clients
        # Simplified implementation
        pass

    async def _queue_document_for_batch_sync(self, document_id: str) -> None:
        """Queue document for batch synchronization."""
        # This would implement batched sync logic
        # Simplified implementation
        pass

    async def cleanup_document(self, document_id: str) -> bool:
        """Clean up document resources."""
        if document_id not in self.documents:
            return False

        # Close collaborative session
        if document_id in self.collaborative_sessions:
            session = self.collaborative_sessions[document_id]
            await session.close_session(document_id)
            del self.collaborative_sessions[document_id]

        # Clean up version manager
        if document_id in self.version_managers:
            del self.version_managers[document_id]

        # Cancel background tasks
        if document_id in self._sync_tasks:
            self._sync_tasks[document_id].cancel()
            del self._sync_tasks[document_id]

        # Remove from registry
        del self.documents[document_id]

        return True

    async def get_integration_statistics(self) -> Dict[str, Any]:
        """Get integration system statistics."""
        return {
            "active_documents": len(self.documents),
            "active_collaborative_sessions": len(self.collaborative_sessions),
            "active_version_managers": len(self.version_managers),
            "total_snapshots": sum(
                len(snaps) for snaps in self.document_snapshots.values()
            ),
            "background_sync_tasks": len(self._sync_tasks),
            "performance_metrics_tracked": len(self.operation_metrics),
            "components_available": {
                "document_renderer": self.document_renderer is not None,
                "document_processor": self.document_processor is not None,
                "compliance_integrator": self.compliance_integrator is not None,
            },
        }
