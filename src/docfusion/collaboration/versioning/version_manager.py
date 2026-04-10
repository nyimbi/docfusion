"""
Version Manager Module

Git-like document version control system for collaborative editing including:
- Document versioning with branching and merging
- Commit-based change tracking
- Diff generation and patch application
- Branch management and conflict resolution
- Tag and milestone management

Simple API for document versioning and collaboration.
"""

import asyncio
import difflib
import hashlib
import json
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from pydantic import BaseModel, ConfigDict, Field
from ...core.utils import uuid7str
class ChangeType(Enum):
    """Types of document changes"""

    INSERT = "insert"
    DELETE = "delete"
    MODIFY = "modify"
    MOVE = "move"
    FORMAT = "format"

class MergeStrategy(Enum):
    """Merge strategies for combining branches"""

    AUTO = "auto"  # Automatic merge with conflict detection
    MANUAL = "manual"  # Require manual conflict resolution
    OVERWRITE = "overwrite"  # Overwrite target with source
    APPEND = "append"  # Append changes to target

@dataclass
class DocumentChange:
    """Individual document change (similar to Git diff)"""

    change_id: str = field(default_factory=uuid7str)
    change_type: ChangeType = ChangeType.MODIFY
    position: int = 0  # Character position in document
    length: int = 0  # Length of change
    old_content: str = ""  # Content being replaced
    new_content: str = ""  # New content
    line_number: int = 0  # Line number for reference
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class DocumentCommit:
    """Document commit (similar to Git commit)"""

    commit_id: str = field(default_factory=uuid7str)
    parent_commits: List[str] = field(default_factory=list)
    author_id: str = ""
    author_name: str = ""
    message: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    changes: List[DocumentChange] = field(default_factory=list)
    document_content: str = ""  # Full document content at this commit
    document_hash: str = ""  # SHA hash of document content
    branch_name: str = "main"
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class DocumentBranch:
    """Document branch for parallel development"""

    branch_name: str = "main"
    head_commit_id: str = ""
    created_from: str = "main"  # Parent branch
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = ""
    description: str = ""
    is_active: bool = True
    merge_conflicts: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class MergeConflict:
    """Merge conflict information"""

    conflict_id: str = field(default_factory=uuid7str)
    position: int = 0
    length: int = 0
    source_content: str = ""  # Content from source branch
    target_content: str = ""  # Content from target branch
    context_before: str = ""  # Context before conflict
    context_after: str = ""  # Context after conflict
    conflict_type: str = "content"  # content, format, structure
    resolution_strategy: Optional[MergeStrategy] = None
    resolved: bool = False
    resolved_content: str = ""
    resolved_by: str = ""
    resolved_at: Optional[datetime] = None

@dataclass
class DocumentTag:
    """Document version tag (like Git tag)"""

    tag_name: str = ""
    commit_id: str = ""
    tagger_id: str = ""
    tagger_name: str = ""
    message: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    tag_type: str = "lightweight"  # lightweight, annotated
    metadata: Dict[str, Any] = field(default_factory=dict)

class DocumentHistory(BaseModel):
    """Complete document version history"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_default=True)

    document_id: str = Field(default_factory=uuid7str)
    current_branch: str = "main"
    branches: Dict[str, DocumentBranch] = Field(default_factory=dict)
    commits: Dict[str, DocumentCommit] = Field(default_factory=dict)
    tags: Dict[str, DocumentTag] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)
    last_modified: datetime = Field(default_factory=datetime.now)

class VersionManager:
    """
    Git-like version control system for documents with simple API.

    Provides branching, merging, diff generation, and conflict resolution
    for collaborative document editing.

    Simple usage:
    ```python
    vm = VersionManager(document_id="doc123")
    await vm.create_commit("user1", "Initial draft", content)
    await vm.create_branch("user1", "feature-branch")
    await vm.commit_changes("user1", "Add new section", changes)
    await vm.merge_branch("user1", "feature-branch", "main")
    ```
    """

    def __init__(self, document_id: str, storage_path: Optional[str] = None):
        self.document_id = document_id
        self.storage_path = (
            Path(storage_path) if storage_path else Path.cwd() / "versions"
        )

        # Initialize document history
        self.history = DocumentHistory(document_id=document_id)

        # Create default main branch
        if "main" not in self.history.branches:
            self.history.branches["main"] = DocumentBranch(
                branch_name="main", description="Main branch"
            )

        # Performance optimization
        self._content_cache: Dict[str, str] = {}
        self._diff_cache: Dict[str, List[DocumentChange]] = {}

        # Thread safety
        self._lock = asyncio.Lock()

    async def create_commit(
        self,
        author_id: str,
        message: str,
        document_content: str,
        author_name: str = "",
        branch_name: Optional[str] = None,
        changes: Optional[List[DocumentChange]] = None,
    ) -> DocumentCommit:
        """
        Create a new commit with document changes.

        Simple API - provide content and commit message.
        """
        async with self._lock:
            branch_name = branch_name or self.history.current_branch

            if branch_name not in self.history.branches:
                raise ValueError(f"Branch {branch_name} does not exist")

            # Get parent commit
            branch = self.history.branches[branch_name]
            parent_commits = [branch.head_commit_id] if branch.head_commit_id else []

            # Calculate document hash
            document_hash = hashlib.sha256(document_content.encode()).hexdigest()

            # Generate changes if not provided
            if changes is None and parent_commits:
                parent_content = await self.get_document_at_commit(parent_commits[0])
                changes = await self._generate_changes(parent_content, document_content)
            elif changes is None:
                changes = []  # Initial commit

            # Create commit
            commit = DocumentCommit(
                author_id=author_id,
                author_name=author_name or author_id,
                message=message,
                parent_commits=parent_commits,
                changes=changes,
                document_content=document_content,
                document_hash=document_hash,
                branch_name=branch_name,
            )

            # Store commit
            self.history.commits[commit.commit_id] = commit

            # Update branch head
            self.history.branches[branch_name].head_commit_id = commit.commit_id

            # Update cache
            self._content_cache[commit.commit_id] = document_content

            # Update history metadata
            self.history.last_modified = datetime.now()

            await self._save_history()

            return commit

    async def create_branch(
        self,
        creator_id: str,
        branch_name: str,
        from_branch: str = "main",
        description: str = "",
    ) -> DocumentBranch:
        """
        Create a new branch from existing branch.

        Simple API - provide branch name and source.
        """
        async with self._lock:
            if branch_name in self.history.branches:
                raise ValueError(f"Branch {branch_name} already exists")

            if from_branch not in self.history.branches:
                raise ValueError(f"Source branch {from_branch} does not exist")

            source_branch = self.history.branches[from_branch]

            # Create new branch
            branch = DocumentBranch(
                branch_name=branch_name,
                head_commit_id=source_branch.head_commit_id,
                created_from=from_branch,
                created_by=creator_id,
                description=description,
            )

            self.history.branches[branch_name] = branch
            await self._save_history()

            return branch

    async def switch_branch(self, branch_name: str) -> bool:
        """Switch to different branch."""
        if branch_name not in self.history.branches:
            return False

        self.history.current_branch = branch_name
        await self._save_history()
        return True

    async def merge_branch(
        self,
        merger_id: str,
        source_branch: str,
        target_branch: str,
        merge_message: Optional[str] = None,
        strategy: MergeStrategy = MergeStrategy.AUTO,
    ) -> Tuple[bool, List[MergeConflict]]:
        """
        Merge one branch into another.

        Simple API - automatic conflict detection and resolution.
        """
        async with self._lock:
            if source_branch not in self.history.branches:
                raise ValueError(f"Source branch {source_branch} does not exist")

            if target_branch not in self.history.branches:
                raise ValueError(f"Target branch {target_branch} does not exist")

            source = self.history.branches[source_branch]
            target = self.history.branches[target_branch]

            if not source.head_commit_id or not target.head_commit_id:
                raise ValueError("Cannot merge branches without commits")

            # Get documents at branch heads
            source_content = await self.get_document_at_commit(source.head_commit_id)
            target_content = await self.get_document_at_commit(target.head_commit_id)

            # Detect conflicts
            conflicts = await self._detect_merge_conflicts(
                source_content, target_content, source_branch, target_branch
            )

            if conflicts and strategy == MergeStrategy.MANUAL:
                return False, conflicts

            # Resolve conflicts based on strategy
            merged_content, resolved_conflicts = await self._resolve_conflicts(
                source_content, target_content, conflicts, strategy
            )

            # Create merge commit if successful
            if not resolved_conflicts or all(c.resolved for c in resolved_conflicts):
                merge_message = (
                    merge_message or f"Merge {source_branch} into {target_branch}"
                )

                merge_commit = DocumentCommit(
                    author_id=merger_id,
                    message=merge_message,
                    parent_commits=[target.head_commit_id, source.head_commit_id],
                    document_content=merged_content,
                    document_hash=hashlib.sha256(merged_content.encode()).hexdigest(),
                    branch_name=target_branch,
                    metadata={
                        "merge_source": source_branch,
                        "conflicts_resolved": len(resolved_conflicts),
                    },
                )

                self.history.commits[merge_commit.commit_id] = merge_commit
                self.history.branches[
                    target_branch
                ].head_commit_id = merge_commit.commit_id

                await self._save_history()
                return True, []

            return False, resolved_conflicts

    async def get_document_at_commit(self, commit_id: str) -> str:
        """Get document content at specific commit."""
        if commit_id in self._content_cache:
            return self._content_cache[commit_id]

        if commit_id not in self.history.commits:
            raise ValueError(f"Commit {commit_id} not found")

        commit = self.history.commits[commit_id]
        content = commit.document_content

        # Cache for performance
        self._content_cache[commit_id] = content

        return content

    async def get_branch_history(
        self, branch_name: str, limit: Optional[int] = None
    ) -> List[DocumentCommit]:
        """Get commit history for branch."""
        if branch_name not in self.history.branches:
            raise ValueError(f"Branch {branch_name} not found")

        branch = self.history.branches[branch_name]
        if not branch.head_commit_id:
            return []

        commits = []
        current_commit_id = branch.head_commit_id

        while current_commit_id and current_commit_id in self.history.commits:
            commit = self.history.commits[current_commit_id]
            commits.append(commit)

            if limit and len(commits) >= limit:
                break

            # Move to parent commit
            current_commit_id = (
                commit.parent_commits[0] if commit.parent_commits else None
            )

        return commits

    async def generate_diff(
        self, from_commit: str, to_commit: str
    ) -> List[DocumentChange]:
        """Generate diff between two commits."""
        cache_key = f"{from_commit}-{to_commit}"
        if cache_key in self._diff_cache:
            return self._diff_cache[cache_key]

        from_content = await self.get_document_at_commit(from_commit)
        to_content = await self.get_document_at_commit(to_commit)

        changes = await self._generate_changes(from_content, to_content)

        # Cache for performance
        self._diff_cache[cache_key] = changes

        return changes

    async def create_tag(
        self,
        tag_name: str,
        commit_id: str,
        tagger_id: str,
        message: str = "",
        tagger_name: str = "",
    ) -> DocumentTag:
        """Create tag at specific commit."""
        if tag_name in self.history.tags:
            raise ValueError(f"Tag {tag_name} already exists")

        if commit_id not in self.history.commits:
            raise ValueError(f"Commit {commit_id} not found")

        tag = DocumentTag(
            tag_name=tag_name,
            commit_id=commit_id,
            tagger_id=tagger_id,
            tagger_name=tagger_name or tagger_id,
            message=message,
        )

        self.history.tags[tag_name] = tag
        await self._save_history()

        return tag

    async def get_branches(self) -> Dict[str, DocumentBranch]:
        """Get all branches."""
        return self.history.branches.copy()

    async def get_tags(self) -> Dict[str, DocumentTag]:
        """Get all tags."""
        return self.history.tags.copy()

    async def delete_branch(self, branch_name: str, force: bool = False) -> bool:
        """Delete a branch."""
        if branch_name == "main":
            raise ValueError("Cannot delete main branch")

        if branch_name not in self.history.branches:
            return False

        branch = self.history.branches[branch_name]

        # Check if branch has unmerged changes (unless force)
        if not force:
            # Simple check - see if branch head is reachable from main
            main_branch = self.history.branches["main"]
            if branch.head_commit_id != main_branch.head_commit_id:
                # Could implement more sophisticated merge-base checking
                raise ValueError(
                    f"Branch {branch_name} has unmerged changes. Use force=True to delete anyway."
                )

        del self.history.branches[branch_name]

        # Switch to main if deleting current branch
        if self.history.current_branch == branch_name:
            self.history.current_branch = "main"

        await self._save_history()
        return True

    async def revert_commit(
        self, commit_id: str, reverter_id: str, revert_message: Optional[str] = None
    ) -> DocumentCommit:
        """Revert a specific commit."""
        if commit_id not in self.history.commits:
            raise ValueError(f"Commit {commit_id} not found")

        commit = self.history.commits[commit_id]

        # Get parent commit content
        if not commit.parent_commits:
            raise ValueError("Cannot revert initial commit")

        parent_content = await self.get_document_at_commit(commit.parent_commits[0])
        current_content = await self.get_document_at_commit(
            self.history.branches[self.history.current_branch].head_commit_id
        )

        # Apply reverse changes
        reversed_changes = await self._reverse_changes(commit.changes)
        reverted_content = await self._apply_changes(current_content, reversed_changes)

        # Create revert commit
        revert_message = revert_message or f"Revert '{commit.message}'"

        revert_commit = await self.create_commit(
            reverter_id, revert_message, reverted_content, changes=reversed_changes
        )

        return revert_commit

    # Internal implementation methods

    async def _generate_changes(
        self, old_content: str, new_content: str
    ) -> List[DocumentChange]:
        """Generate list of changes between two document versions."""
        changes = []

        # Use difflib to generate line-based diff
        old_lines = old_content.splitlines(keepends=True)
        new_lines = new_content.splitlines(keepends=True)

        diff = list(difflib.unified_diff(old_lines, new_lines, n=0))

        position = 0
        line_number = 0

        for line in diff:
            if line.startswith("@@"):
                # Parse hunk header
                parts = line.split()
                if len(parts) >= 2:
                    old_range = parts[1][1:]  # Remove '-'
                    if "," in old_range:
                        line_number = int(old_range.split(",")[0])
                    else:
                        line_number = int(old_range)

            elif line.startswith("-"):
                # Deletion
                old_content_line = line[1:]
                changes.append(
                    DocumentChange(
                        change_type=ChangeType.DELETE,
                        position=position,
                        length=len(old_content_line),
                        old_content=old_content_line,
                        new_content="",
                        line_number=line_number,
                    )
                )
                position += len(old_content_line)
                line_number += 1

            elif line.startswith("+"):
                # Insertion
                new_content_line = line[1:]
                changes.append(
                    DocumentChange(
                        change_type=ChangeType.INSERT,
                        position=position,
                        length=len(new_content_line),
                        old_content="",
                        new_content=new_content_line,
                        line_number=line_number,
                    )
                )
                # Don't increment position for insertions

            elif not line.startswith(("\\", "@")):
                # Context line
                position += len(line)
                line_number += 1

        return changes

    async def _detect_merge_conflicts(
        self,
        source_content: str,
        target_content: str,
        source_branch: str,
        target_branch: str,
    ) -> List[MergeConflict]:
        """Detect conflicts when merging branches."""
        conflicts = []

        # Simple conflict detection - find overlapping changes
        source_lines = source_content.splitlines()
        target_lines = target_content.splitlines()

        # Use difflib to find differences
        matcher = difflib.SequenceMatcher(None, target_lines, source_lines)

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "replace":
                # Potential conflict - both versions changed the same lines
                conflict = MergeConflict(
                    position=sum(len(line) + 1 for line in target_lines[:i1]),
                    length=sum(len(line) + 1 for line in target_lines[i1:i2]),
                    target_content="\n".join(target_lines[i1:i2]),
                    source_content="\n".join(source_lines[j1:j2]),
                    context_before="\n".join(target_lines[max(0, i1 - 3) : i1]),
                    context_after="\n".join(
                        target_lines[i2 : min(len(target_lines), i2 + 3)]
                    ),
                    conflict_type="content",
                )
                conflicts.append(conflict)

        return conflicts

    async def _resolve_conflicts(
        self,
        source_content: str,
        target_content: str,
        conflicts: List[MergeConflict],
        strategy: MergeStrategy,
    ) -> Tuple[str, List[MergeConflict]]:
        """Resolve merge conflicts based on strategy."""
        if not conflicts:
            # Simple merge - prefer source changes
            return source_content, []

        resolved_content = target_content
        resolved_conflicts = []

        for conflict in conflicts:
            if strategy == MergeStrategy.AUTO:
                # Simple auto-resolution - prefer source if no overlap
                if len(conflict.source_content) > len(conflict.target_content):
                    conflict.resolved_content = conflict.source_content
                else:
                    conflict.resolved_content = conflict.target_content
                conflict.resolved = True
                conflict.resolution_strategy = strategy

            elif strategy == MergeStrategy.OVERWRITE:
                conflict.resolved_content = conflict.source_content
                conflict.resolved = True
                conflict.resolution_strategy = strategy

            elif strategy == MergeStrategy.APPEND:
                conflict.resolved_content = (
                    conflict.target_content + "\n" + conflict.source_content
                )
                conflict.resolved = True
                conflict.resolution_strategy = strategy

            resolved_conflicts.append(conflict)

        # Apply resolved conflicts to content
        if resolved_conflicts and all(c.resolved for c in resolved_conflicts):
            # Simple merge - return source content with conflict markers if needed
            if strategy == MergeStrategy.AUTO:
                resolved_content = source_content
            elif strategy == MergeStrategy.APPEND:
                resolved_content = target_content + "\n\n" + source_content

        return resolved_content, resolved_conflicts

    async def _reverse_changes(
        self, changes: List[DocumentChange]
    ) -> List[DocumentChange]:
        """Create reverse changes for revert operation."""
        reversed_changes = []

        for change in reversed(changes):  # Apply in reverse order
            if change.change_type == ChangeType.INSERT:
                # Reverse of insert is delete
                reversed_changes.append(
                    DocumentChange(
                        change_type=ChangeType.DELETE,
                        position=change.position,
                        length=change.length,
                        old_content=change.new_content,
                        new_content="",
                        line_number=change.line_number,
                    )
                )

            elif change.change_type == ChangeType.DELETE:
                # Reverse of delete is insert
                reversed_changes.append(
                    DocumentChange(
                        change_type=ChangeType.INSERT,
                        position=change.position,
                        length=change.length,
                        old_content="",
                        new_content=change.old_content,
                        line_number=change.line_number,
                    )
                )

            elif change.change_type == ChangeType.MODIFY:
                # Reverse of modify is modify back
                reversed_changes.append(
                    DocumentChange(
                        change_type=ChangeType.MODIFY,
                        position=change.position,
                        length=len(change.old_content),
                        old_content=change.new_content,
                        new_content=change.old_content,
                        line_number=change.line_number,
                    )
                )

        return reversed_changes

    async def _apply_changes(self, content: str, changes: List[DocumentChange]) -> str:
        """Apply list of changes to document content."""
        # Sort changes by position (reverse order for proper application)
        sorted_changes = sorted(changes, key=lambda c: c.position, reverse=True)

        result = content

        for change in sorted_changes:
            if change.change_type == ChangeType.INSERT:
                result = (
                    result[: change.position]
                    + change.new_content
                    + result[change.position :]
                )

            elif change.change_type == ChangeType.DELETE:
                end_pos = change.position + change.length
                result = result[: change.position] + result[end_pos:]

            elif change.change_type == ChangeType.MODIFY:
                end_pos = change.position + change.length
                result = (
                    result[: change.position] + change.new_content + result[end_pos:]
                )

        return result

    async def _save_history(self) -> None:
        """Save version history to storage."""
        # In a real implementation, this would save to persistent storage
        # For now, we'll just update the timestamp
        self.history.last_modified = datetime.now()

    async def get_statistics(self) -> Dict[str, Any]:
        """Get version management statistics."""
        return {
            "document_id": self.document_id,
            "total_commits": len(self.history.commits),
            "total_branches": len(self.history.branches),
            "total_tags": len(self.history.tags),
            "current_branch": self.history.current_branch,
            "created_at": self.history.created_at.isoformat(),
            "last_modified": self.history.last_modified.isoformat(),
            "branches": {
                name: {
                    "head_commit": branch.head_commit_id,
                    "created_at": branch.created_at.isoformat(),
                    "created_by": branch.created_by,
                    "is_active": branch.is_active,
                }
                for name, branch in self.history.branches.items()
            },
        }
