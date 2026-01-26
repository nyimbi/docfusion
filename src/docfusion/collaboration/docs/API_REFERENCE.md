# Collaboration System API Reference

## Overview

Complete API reference for the Real-Time Collaboration System. All APIs are async and follow consistent patterns for error handling and response formats.

## 🔧 CollaborationIntegrator API

The main integration API for all collaboration features.

### Class: `CollaborationIntegrator`

#### Constructor

```python
CollaborationIntegrator(
    storage_path: Optional[str] = None,
    document_renderer: Optional[Any] = None,
    document_processor: Optional[Any] = None,
    compliance_integrator: Optional[Any] = None
)
```

**Parameters:**
- `storage_path`: Directory for storing collaboration data
- `document_renderer`: Document rendering integration (optional)
- `document_processor`: Document processing integration (optional)  
- `compliance_integrator`: Compliance system integration (optional)

### Document Management

#### `create_collaborative_document()`

```python
async def create_collaborative_document(
    title: str,
    initial_content: str = "",
    settings: Optional[CollaborationSettings] = None,
    creator_id: str = ""
) -> CollaborativeDocument
```

Creates a new collaborative document with specified settings.

**Parameters:**
- `title`: Document title
- `initial_content`: Starting document content
- `settings`: Collaboration configuration (uses defaults if None)
- `creator_id`: ID of user creating the document

**Returns:**
- `CollaborativeDocument`: Created document with metadata

**Example:**
```python
doc = await integrator.create_collaborative_document(
    title="Project Proposal",
    initial_content="# Project Overview\n\nInitial draft...",
    creator_id="alice"
)
```

#### `add_user_to_document()`

```python
async def add_user_to_document(
    document_id: str,
    user_id: str,
    user_name: str,
    permissions: Optional[Set[str]] = None
) -> UserSession
```

Adds a user to collaborative document session.

**Parameters:**
- `document_id`: Target document ID
- `user_id`: Unique user identifier
- `user_name`: Display name for user
- `permissions`: Set of permissions (defaults: {"read", "write"})

**Returns:**
- `UserSession`: Created user session with metadata

**Example:**
```python
session = await integrator.add_user_to_document(
    doc.document_id, 
    "bob", 
    "Bob Smith",
    permissions={"read", "write", "comment"}
)
```

#### `edit_document()`

```python
async def edit_document(
    document_id: str,
    user_id: str,
    content: str,
    position: Optional[int] = None,
    length: Optional[int] = None,
    commit_message: Optional[str] = None
) -> Dict[str, Any]
```

Edit document content with real-time collaboration and conflict resolution.

**Parameters:**
- `document_id`: Target document ID
- `user_id`: ID of user making edit
- `content`: New content or content to insert
- `position`: Position for partial edits (optional)
- `length`: Length for replacement operations (optional)
- `commit_message`: Version control commit message (optional)

**Returns:**
- `Dict[str, Any]`: Edit result with status and metadata

**Response Format:**
```python
{
    "success": bool,
    "conflicts_detected": List[DetectedConflict],
    "conflicts_resolved": List[ResolvedConflict],
    "new_version": int,
    "sync_time_ms": float,
    "compliance_status": Dict[str, Any]  # if compliance integration enabled
}
```

**Example:**
```python
result = await integrator.edit_document(
    doc.document_id,
    "bob",
    "Updated content with Bob's changes",
    commit_message="Add technical details section"
)

if result["success"]:
    print(f"Edit successful, new version: {result['new_version']}")
```

#### `resolve_conflicts()`

```python
async def resolve_conflicts(
    document_id: str,
    user_id: str,
    auto_resolve: bool = True
) -> ConflictResolutionResult
```

Detect and resolve document conflicts using intelligent strategies.

**Parameters:**
- `document_id`: Target document ID
- `user_id`: ID of user requesting resolution
- `auto_resolve`: Whether to attempt automatic resolution

**Returns:**
- `ConflictResolutionResult`: Detailed resolution results

**Example:**
```python
resolution = await integrator.resolve_conflicts(doc.document_id, "alice")

print(f"Conflicts resolved: {len(resolution.resolved_conflicts)}")
print(f"Merge successful: {resolution.merge_successful}")
```

### Version Control

#### `create_document_branch()`

```python
async def create_document_branch(
    document_id: str,
    user_id: str,
    branch_name: str,
    from_branch: str = "main"
) -> DocumentBranch
```

Create a new branch for parallel document development.

**Parameters:**
- `document_id`: Target document ID
- `user_id`: ID of user creating branch
- `branch_name`: Name for new branch
- `from_branch`: Source branch (defaults to "main")

**Returns:**
- `DocumentBranch`: Created branch metadata

**Example:**
```python
branch = await integrator.create_document_branch(
    doc.document_id,
    "alice",
    "feature-technical-details"
)
```

#### `merge_document_branch()`

```python
async def merge_document_branch(
    document_id: str,
    user_id: str,
    source_branch: str,
    target_branch: str = "main"
) -> Tuple[bool, List[DetectedConflict]]
```

Merge document branches with automatic conflict resolution.

**Parameters:**
- `document_id`: Target document ID
- `user_id`: ID of user performing merge
- `source_branch`: Branch to merge from
- `target_branch`: Branch to merge into

**Returns:**
- `Tuple[bool, List[DetectedConflict]]`: Success status and any unresolved conflicts

**Example:**
```python
success, conflicts = await integrator.merge_document_branch(
    doc.document_id,
    "alice",
    "feature-technical-details",
    "main"
)

if success:
    print("Merge completed successfully")
else:
    print(f"Merge failed with {len(conflicts)} conflicts")
```

#### `get_document_history()`

```python
async def get_document_history(
    document_id: str,
    branch_name: str = "main",
    limit: Optional[int] = None
) -> List[DocumentCommit]
```

Get document version history for specified branch.

**Parameters:**
- `document_id`: Target document ID
- `branch_name`: Branch to get history for
- `limit`: Maximum number of commits to return

**Returns:**
- `List[DocumentCommit]`: Commit history in reverse chronological order

### Status and Monitoring

#### `get_active_users()`

```python
async def get_active_users(document_id: str) -> List[UserSession]
```

Get list of currently active users in document.

**Parameters:**
- `document_id`: Target document ID

**Returns:**
- `List[UserSession]`: Active user sessions

#### `get_document_status()`

```python
async def get_document_status(document_id: str) -> Dict[str, Any]
```

Get comprehensive document collaboration status.

**Parameters:**
- `document_id`: Target document ID

**Returns:**
- `Dict[str, Any]`: Complete document status

**Response Format:**
```python
{
    "document_id": str,
    "title": str,
    "status": str,  # draft, active_collaboration, etc.
    "current_version": int,
    "content_length": int,
    "active_users": int,
    "user_list": List[Dict[str, str]],
    "collaboration_mode": str,
    "real_time_active": bool,
    "version_control_active": bool,
    "total_operations": int,
    "conflicts_resolved": int,
    "last_modified": str,  # ISO format
    "average_sync_time": float
}
```

## 🎨 CollaborativeEditor API

Direct access to real-time collaborative editing features.

### Class: `CollaborativeEditor`

#### Constructor

```python
CollaborativeEditor(
    document_id: str,
    initial_content: str = "",
    websocket_handler: Optional[Callable] = None
)
```

### User Management

#### `add_user()`

```python
async def add_user(
    user_id: str,
    name: str,
    email: str = "",
    avatar_url: str = "",
    permissions: Optional[Set[str]] = None
) -> User
```

Add user to collaborative editing session.

**Example:**
```python
user = await editor.add_user(
    "alice",
    "Alice Smith", 
    "alice@company.com",
    permissions={"read", "write", "comment"}
)
```

#### `remove_user()`

```python
async def remove_user(user_id: str) -> bool
```

Remove user from collaborative editing session.

### Editing Operations

#### `insert_text()`

```python
async def insert_text(
    user_id: str,
    position: int,
    text: str,
    attributes: Optional[Dict[str, Any]] = None
) -> Operation
```

Insert text at specified position with real-time sync.

**Parameters:**
- `user_id`: ID of user making edit
- `position`: Character position for insertion
- `text`: Text to insert
- `attributes`: Optional formatting attributes

**Returns:**
- `Operation`: CRDT operation that was applied

#### `delete_text()`

```python
async def delete_text(
    user_id: str,
    position: int,
    length: int
) -> Operation
```

Delete text at specified position and length.

#### `update_cursor()`

```python
async def update_cursor(
    user_id: str,
    position: int,
    selection_start: Optional[int] = None,
    selection_end: Optional[int] = None
) -> CursorPosition
```

Update user cursor position and selection for real-time awareness.

### Comments and Annotations

#### `add_comment()`

```python
async def add_comment(
    user_id: str,
    position: int,
    length: int,
    text: str
) -> Comment
```

Add comment/annotation to document region.

**Example:**
```python
comment = await editor.add_comment(
    "bob",
    150,  # position
    25,   # length of text being commented
    "This section needs more detail about the technical approach."
)
```

#### `resolve_comment()`

```python
async def resolve_comment(user_id: str, comment_id: str) -> bool
```

Mark a comment as resolved.

### Undo/Redo

#### `undo()`

```python
async def undo(user_id: str) -> Optional[Operation]
```

Undo the last operation by specified user.

#### `redo()`

```python
async def redo(user_id: str) -> Optional[Operation]
```

Redo the last undone operation by specified user.

### Content Access

#### `get_document_content()`

```python
async def get_document_content() -> str
```

Get current document content.

#### `get_users()`

```python
async def get_users() -> Dict[str, User]
```

Get all users in the editing session.

#### `get_cursors()`

```python
async def get_cursors() -> Dict[str, CursorPosition]
```

Get current cursor positions for all users.

#### `get_comments()`

```python
async def get_comments() -> Dict[str, Comment]
```

Get all comments in the document.

### Real-time Subscriptions

#### `subscribe_to_changes()`

```python
async def subscribe_to_changes(
    callback: Callable[[str, Any], None]
) -> str
```

Subscribe to real-time change notifications.

**Parameters:**
- `callback`: Function to call for each change event

**Returns:**
- `str`: Subscription ID for later unsubscribe

**Example:**
```python
async def handle_change(event_type: str, event_data: Any):
    if event_type == "operation":
        print(f"Document edited: {event_data}")
    elif event_type == "cursor":
        print(f"Cursor moved: {event_data}")

subscription_id = await editor.subscribe_to_changes(handle_change)
```

#### `unsubscribe()`

```python
async def unsubscribe(subscription_id: str) -> bool
```

Unsubscribe from change notifications.

## 🔄 VersionManager API

Git-like version control for documents.

### Class: `VersionManager`

#### Constructor

```python
VersionManager(
    document_id: str,
    storage_path: Optional[str] = None
)
```

### Commit Operations

#### `create_commit()`

```python
async def create_commit(
    author_id: str,
    message: str,
    document_content: str,
    author_name: str = "",
    branch_name: Optional[str] = None,
    changes: Optional[List[DocumentChange]] = None
) -> DocumentCommit
```

Create a new commit with document changes.

**Example:**
```python
commit = await version_manager.create_commit(
    "alice",
    "Add executive summary section",
    updated_content,
    "Alice Smith"
)
```

### Branch Operations

#### `create_branch()`

```python
async def create_branch(
    creator_id: str,
    branch_name: str,
    from_branch: str = "main",
    description: str = ""
) -> DocumentBranch
```

Create a new branch from existing branch.

#### `switch_branch()`

```python
async def switch_branch(branch_name: str) -> bool
```

Switch to different branch.

#### `merge_branch()`

```python
async def merge_branch(
    merger_id: str,
    source_branch: str,
    target_branch: str,
    merge_message: Optional[str] = None,
    strategy: MergeStrategy = MergeStrategy.AUTO
) -> Tuple[bool, List[MergeConflict]]
```

Merge one branch into another with conflict resolution.

### History and Diffs

#### `get_document_at_commit()`

```python
async def get_document_at_commit(commit_id: str) -> str
```

Get document content at specific commit.

#### `generate_diff()`

```python
async def generate_diff(
    from_commit: str,
    to_commit: str
) -> List[DocumentChange]
```

Generate diff between two commits.

#### `get_branch_history()`

```python
async def get_branch_history(
    branch_name: str,
    limit: Optional[int] = None
) -> List[DocumentCommit]
```

Get commit history for branch.

### Tags

#### `create_tag()`

```python
async def create_tag(
    tag_name: str,
    commit_id: str,
    tagger_id: str,
    message: str = "",
    tagger_name: str = ""
) -> DocumentTag
```

Create tag at specific commit.

## 🔍 ConflictDetector API

Intelligent conflict detection system.

### Class: `ConflictDetector`

#### Constructor

```python
ConflictDetector(semantic_analysis: bool = True)
```

### Detection Methods

#### `detect_conflicts()`

```python
async def detect_conflicts(
    content_a: str,
    content_b: str,
    author_a: str = "",
    author_b: str = "",
    document_a_id: str = "",
    document_b_id: str = ""
) -> ConflictAnalysisResult
```

Comprehensive conflict detection between two document versions.

**Returns:**
- `ConflictAnalysisResult`: Complete analysis with conflicts and recommendations

#### `detect_semantic_conflicts()`

```python
async def detect_semantic_conflicts(
    content_a: str,
    content_b: str,
    author_a: str = "",
    author_b: str = ""
) -> List[DetectedConflict]
```

Focus on semantic conflicts using NLP analysis.

#### `classify_conflict_severity()`

```python
async def classify_conflict_severity(
    conflict: DetectedConflict
) -> ConflictSeverity
```

Classify conflict severity based on impact analysis.

## ⚙️ ConflictResolver API

Automated conflict resolution system.

### Class: `ConflictResolver`

#### Constructor

```python
ConflictResolver(semantic_resolution: bool = True)
```

### Resolution Methods

#### `resolve_conflicts()`

```python
async def resolve_conflicts(
    conflicts: Union[List[DetectedConflict], ConflictAnalysisResult],
    content_a: str = "",
    content_b: str = "",
    user_id: Optional[str] = None,
    preferences: Optional[UserPreferences] = None
) -> ConflictResolutionResult
```

Resolve conflicts using intelligent strategies.

**Returns:**
- `ConflictResolutionResult`: Complete resolution results with merged content

#### `resolve_conflict()`

```python
async def resolve_conflict(
    conflict: DetectedConflict,
    content_a: str = "",
    content_b: str = "",
    strategy: Optional[ResolutionStrategy] = None,
    user_id: Optional[str] = None
) -> ResolvedConflict
```

Resolve single conflict with specified strategy.

### Rule Management

#### `add_resolution_rule()`

```python
async def add_resolution_rule(
    rule_name: str,
    conflict_types: List[ConflictType],
    strategy: ResolutionStrategy,
    description: str = "",
    priority: int = 100,
    severity_threshold: ConflictSeverity = ConflictSeverity.LOW
) -> ResolutionRule
```

Add custom resolution rule.

#### `set_user_preferences()`

```python
async def set_user_preferences(
    user_id: str,
    preferences: UserPreferences
) -> None
```

Set user preferences for conflict resolution.

### Learning System

#### `learn_from_resolution()`

```python
async def learn_from_resolution(
    resolved_conflict: ResolvedConflict,
    user_feedback: Dict[str, Any]
) -> None
```

Learn from user feedback to improve resolution strategies.

## 📊 Data Models

### Core Data Types

#### `CollaborativeDocument`

```python
class CollaborativeDocument(BaseModel):
    document_id: str
    title: str
    description: str
    current_content: str
    current_version: int
    status: DocumentStatus
    collaboration_settings: CollaborationSettings
    active_sessions: Dict[str, UserSession]
    created_at: datetime
    last_modified: datetime
```

#### `Operation`

```python
@dataclass
class Operation:
    op_id: str
    op_type: OperationType  # INSERT, DELETE, RETAIN, FORMAT, COMMENT
    position: int
    length: int
    content: str
    attributes: Dict[str, Any]
    author_id: str
    timestamp: float
    vector_clock: Dict[str, int]
```

#### `DetectedConflict`

```python
@dataclass  
class DetectedConflict:
    conflict_id: str
    conflict_type: ConflictType
    severity: ConflictSeverity
    scope: ConflictScope
    position: int
    length: int
    content_a: str
    content_b: str
    description: str
    confidence: float
    suggestions: List[str]
```

#### `DocumentCommit`

```python
@dataclass
class DocumentCommit:
    commit_id: str
    parent_commits: List[str]
    author_id: str
    author_name: str
    message: str
    timestamp: datetime
    changes: List[DocumentChange]
    document_content: str
    document_hash: str
    branch_name: str
    tags: List[str]
```

### Configuration Types

#### `CollaborationSettings`

```python
@dataclass
class CollaborationSettings:
    collaboration_mode: CollaborationMode
    sync_strategy: SyncStrategy
    max_concurrent_users: int = 10
    auto_save_interval: int = 30
    conflict_resolution_strategy: ResolutionStrategy
    version_control_enabled: bool = True
    real_time_sync_enabled: bool = True
    user_presence_tracking: bool = True
    comment_system_enabled: bool = True
    track_all_changes: bool = True
```

#### `UserPreferences`

```python
class UserPreferences(BaseModel):
    user_id: str
    preferred_strategy: ResolutionStrategy
    trusted_authors: List[str]
    prefer_longer_content: bool = True
    prefer_newer_changes: bool = True
    auto_resolve_threshold: ConflictSeverity
    enable_semantic_resolution: bool = True
```

## 🚨 Error Handling

### Exception Types

All APIs use consistent exception handling:

- `ValueError`: Invalid parameters or state
- `PermissionError`: User lacks required permissions
- `RuntimeError`: System or integration errors

### Error Response Format

```python
{
    "error": str,           # Error message
    "error_type": str,      # Exception type
    "context": Dict[str, Any]  # Additional error context
}
```

### Graceful Degradation

The system is designed to degrade gracefully:
- Real-time features fall back to periodic sync
- Semantic analysis falls back to text-based conflict detection
- Complex resolution falls back to manual review

## 🔧 Performance Considerations

### Response Time Targets

- **Real-time operations**: <50ms average
- **Conflict detection**: <500ms for typical documents  
- **Conflict resolution**: <1000ms for automatic resolution
- **Version control**: <500ms for commit operations

### Optimization Tips

1. **Use batch operations** for multiple related changes
2. **Configure appropriate sync strategies** for your use case
3. **Limit concurrent users** based on document complexity
4. **Enable caching** for frequently accessed documents
5. **Monitor performance metrics** using built-in monitoring

### Rate Limiting

Some operations have built-in rate limiting:
- **Edit operations**: Max 100 per minute per user
- **Comment creation**: Max 20 per minute per user
- **Branch operations**: Max 10 per minute per user