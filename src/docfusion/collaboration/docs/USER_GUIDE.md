# User Guide: Real-Time Collaboration System

## Overview

The Real-Time Collaboration System enables multiple users to simultaneously edit documents with automatic conflict resolution, version control, and real-time synchronization. This guide covers all user-facing features and workflows.

## 🚀 Getting Started

### Basic Concepts

- **Collaborative Document**: A document that multiple users can edit simultaneously
- **Real-time Editing**: Changes appear instantly for all users
- **Conflict Resolution**: Automatic handling of simultaneous edits
- **Version Control**: Git-like branching and merging for document versions
- **User Presence**: See who's online and where they're working

### Quick Start Example

```python
from proposal_writer.collaboration.integration.collaboration_integration import (
    CollaborationIntegrator, CollaborationSettings, CollaborationMode
)

# Create collaboration system
integrator = CollaborationIntegrator()

# Create a collaborative document
doc = await integrator.create_collaborative_document(
    title="Team Project Proposal",
    initial_content="# Project Overview\n\nWelcome to our collaborative proposal!"
)

print(f"Created document: {doc.document_id}")
```

## 👥 User Management

### Adding Users to Documents

```python
# Add team members to the document
alice = await integrator.add_user_to_document(
    doc.document_id,
    user_id="alice",
    user_name="Alice Smith",
    permissions={"read", "write", "comment"}
)

bob = await integrator.add_user_to_document(
    doc.document_id,
    user_id="bob", 
    user_name="Bob Johnson",
    permissions={"read", "write"}
)

# Add a reviewer with limited permissions
reviewer = await integrator.add_user_to_document(
    doc.document_id,
    user_id="reviewer",
    user_name="Sarah Wilson",
    permissions={"read", "comment"}
)
```

### User Permissions

| Permission | Description |
|------------|-------------|
| `read` | View document content |
| `write` | Edit document content |
| `comment` | Add comments and annotations |
| `admin` | Manage users and settings |
| `merge` | Merge branches and resolve conflicts |

### Checking Active Users

```python
# See who's currently working on the document
active_users = await integrator.get_active_users(doc.document_id)

for user in active_users:
    print(f"{user.user_name} is {user.presence.value}")
    if user.cursor_position:
        print(f"  - Cursor at position {user.cursor_position}")
```

## ✏️ Real-Time Editing

### Basic Editing

```python
# Alice makes an edit
result = await integrator.edit_document(
    doc.document_id,
    user_id="alice",
    content="# Project Overview\n\nWelcome to our collaborative proposal!\n\n## Executive Summary\nThis project will deliver innovative solutions..."
)

if result["success"]:
    print(f"Edit successful! New version: {result['new_version']}")
```

### Advanced Editing with Position Control

```python
# Insert text at specific position
result = await integrator.edit_document(
    doc.document_id,
    user_id="bob",
    content="IMPORTANT: ", 
    position=0,  # Insert at beginning
    length=0     # Insert, don't replace
)

# Replace specific text section
result = await integrator.edit_document(
    doc.document_id,
    user_id="alice",
    content="Updated Executive Summary",
    position=100,  # Start position
    length=18      # Length of "Executive Summary"
)
```

### Understanding Edit Results

```python
{
    "success": True,                           # Edit was successful
    "conflicts_detected": [],                  # Any conflicts found
    "conflicts_resolved": [ResolvedConflict], # Automatically resolved conflicts
    "new_version": 5,                         # New document version number
    "sync_time_ms": 23.5,                    # How long sync took
    "compliance_status": {                    # If compliance checking enabled
        "compliant": True,
        "score": 0.92
    }
}
```

## 🔄 Real-Time Features

### User Presence Awareness

The system automatically tracks and shows:
- **Who is online** and actively editing
- **Cursor positions** of other users
- **Current selections** being made
- **User activity status** (editing, viewing, idle)

```python
# Get real-time status
status = await integrator.get_document_status(doc.document_id)

print(f"Active users: {status['active_users']}")
print(f"Current version: {status['current_version']}")
print(f"Last modified: {status['last_modified']}")

# Show user list with activity
for user_info in status['user_list']:
    print(f"- {user_info['name']} ({user_info['user_id']})")
```

### Real-Time Synchronization

Changes are synchronized automatically based on your collaboration settings:

- **Immediate**: Changes appear instantly (default)
- **Batched**: Changes grouped for efficiency  
- **Periodic**: Regular sync intervals
- **On-demand**: Manual sync triggers

```python
# Configure sync behavior
from proposal_writer.collaboration.integration.collaboration_integration import (
    CollaborationSettings, SyncStrategy
)

settings = CollaborationSettings(
    sync_strategy=SyncStrategy.IMMEDIATE,    # Real-time sync
    auto_save_interval=30,                   # Auto-save every 30 seconds
    max_concurrent_users=10                  # Support up to 10 users
)

doc = await integrator.create_collaborative_document(
    "Real-time Document",
    settings=settings
)
```

## 💬 Comments and Annotations

### Adding Comments

```python
# Access the collaborative editor directly for advanced features
session = integrator.collaborative_sessions.get(doc.document_id)
editor = await session.get_session(doc.document_id)

# Add a comment to specific text
comment = await editor.add_comment(
    user_id="reviewer",
    position=250,    # Character position
    length=20,       # Length of text being commented on
    text="This section needs more technical detail. Consider adding performance metrics and implementation timeline."
)

print(f"Added comment: {comment.comment_id}")
```

### Working with Comments

```python
# Get all comments
comments = await editor.get_comments()

for comment_id, comment in comments.items():
    print(f"Comment by {comment.author_id}:")
    print(f"  Position: {comment.position}-{comment.position + comment.length}")
    print(f"  Text: {comment.text}")
    print(f"  Resolved: {comment.resolved}")
    print(f"  Created: {comment.created_at}")

# Resolve a comment when addressed
await editor.resolve_comment("alice", comment.comment_id)
```

### Comment Workflows

1. **Review Process**: Reviewers add comments for improvement suggestions
2. **Collaborative Discussion**: Team members discuss changes in comments
3. **Resolution Tracking**: Mark comments as resolved when addressed
4. **Change History**: Comments remain linked to document versions

## 🌳 Version Control

### Understanding Branches

Like Git, the collaboration system uses branches for parallel development:

- **main**: Primary document branch
- **feature branches**: Separate development tracks
- **merging**: Combining changes from different branches

### Creating and Using Branches

```python
# Create a feature branch for major changes
branch = await integrator.create_document_branch(
    doc.document_id,
    user_id="alice",
    branch_name="executive-summary-rewrite",
    from_branch="main"
)

# Work on the feature branch
await integrator.edit_document(
    doc.document_id,
    user_id="alice",
    content="# Completely Revised Executive Summary\n\nOur innovative approach...",
    commit_message="Complete rewrite of executive summary"
)

# When ready, merge back to main
success, conflicts = await integrator.merge_document_branch(
    doc.document_id,
    user_id="alice",
    source_branch="executive-summary-rewrite",
    target_branch="main"
)

if success:
    print("Merge completed successfully!")
else:
    print(f"Merge conflicts need resolution: {len(conflicts)} conflicts")
```

### Version History

```python
# View document history
history = await integrator.get_document_history(doc.document_id, limit=10)

for commit in history:
    print(f"Version {commit.commit_id[:8]}")
    print(f"  Author: {commit.author_name}")
    print(f"  Date: {commit.timestamp}")
    print(f"  Message: {commit.message}")
    print(f"  Changes: {len(commit.changes)}")
    print()
```

### Best Practices for Version Control

1. **Use Descriptive Branch Names**: `feature-cost-analysis`, `fix-formatting-issues`
2. **Write Clear Commit Messages**: Explain what and why you changed
3. **Merge Frequently**: Keep branches in sync with main
4. **Review Before Merging**: Use comments for peer review

## ⚔️ Conflict Resolution

### Understanding Conflicts

Conflicts occur when multiple users edit the same content simultaneously. The system detects several types:

- **Content Conflicts**: Direct text overlaps
- **Semantic Conflicts**: Contradictory meaning
- **Structural Conflicts**: Document organization changes
- **Format Conflicts**: Styling and formatting differences

### Automatic Resolution

Most conflicts are resolved automatically:

```python
# Edit simultaneously (this would cause conflicts in traditional systems)
# Alice adds technical details
alice_edit = integrator.edit_document(
    doc.document_id,
    "alice",
    original_content + "\n\n## Technical Implementation\nOur solution uses..."
)

# Bob adds cost analysis at the same time  
bob_edit = integrator.edit_document(
    doc.document_id,
    "bob", 
    original_content + "\n\n## Cost Analysis\nTotal project cost is..."
)

# Run both edits concurrently
results = await asyncio.gather(alice_edit, bob_edit)

# Check if conflicts were automatically resolved
if all(result["success"] for result in results):
    print("All conflicts resolved automatically!")
```

### Manual Conflict Resolution

For complex conflicts requiring human judgment:

```python
# Detect conflicts that need manual attention
resolution_result = await integrator.resolve_conflicts(
    doc.document_id,
    user_id="alice",
    auto_resolve=True
)

if not resolution_result.merge_successful:
    print("Manual conflict resolution required!")
    
    for conflict in resolution_result.unresolved_conflicts:
        print(f"Conflict at position {conflict.position}:")
        print(f"  Version A: {conflict.content_a}")
        print(f"  Version B: {conflict.content_b}")
        print(f"  Type: {conflict.conflict_type}")
        print(f"  Severity: {conflict.severity}")
        
        # Manual resolution would involve user choosing or combining versions
```

### Conflict Resolution Strategies

The system can be configured with different resolution strategies:

```python
from proposal_writer.collaboration.conflicts.conflict_resolver import ResolutionStrategy

# Configure resolution preferences
settings = CollaborationSettings(
    conflict_resolution_strategy=ResolutionStrategy.PREFER_NEWER  # Prefer most recent changes
)

# Other strategies:
# - ResolutionStrategy.AUTO_MERGE: Intelligent automatic merging
# - ResolutionStrategy.PREFER_LONGER: Prefer more detailed content
# - ResolutionStrategy.SEMANTIC_MERGE: AI-powered semantic resolution
# - ResolutionStrategy.MANUAL_REVIEW: Always require human review
```

## 📊 Monitoring and Analytics

### Document Status Dashboard

```python
# Get comprehensive document status
status = await integrator.get_document_status(doc.document_id)

print(f"""
Document Dashboard: {status['title']}
=====================================
Status: {status['status']}
Current Version: {status['current_version']}
Content Length: {status['content_length']} characters
Active Users: {status['active_users']}
Total Operations: {status['total_operations']}
Conflicts Resolved: {status['conflicts_resolved']}
Average Sync Time: {status['average_sync_time']:.1f}ms
Last Modified: {status['last_modified']}
""")
```

### Performance Monitoring

```python
# Monitor system performance
integration_stats = await integrator.get_integration_statistics()

print(f"""
System Performance
==================
Active Documents: {integration_stats['active_documents']}
Active Sessions: {integration_stats['active_collaborative_sessions']}
Version Managers: {integration_stats['active_version_managers']}
Background Tasks: {integration_stats['background_sync_tasks']}
""")
```

### User Activity Tracking

```python
# Track user activity and engagement
for user_session in await integrator.get_active_users(doc.document_id):
    activity_duration = datetime.now() - user_session.last_activity
    print(f"{user_session.user_name}:")
    print(f"  - Online: {user_session.is_online}")
    print(f"  - Last active: {activity_duration.total_seconds():.0f}s ago")
    print(f"  - Permissions: {', '.join(user_session.permissions)}")
    print(f"  - Current branch: {user_session.active_branch}")
```

## ⚙️ Configuration and Customization

### Collaboration Modes

Choose the collaboration mode that fits your workflow:

```python
from proposal_writer.collaboration.integration.collaboration_integration import CollaborationMode

# Real-time collaboration (default)
settings = CollaborationSettings(
    collaboration_mode=CollaborationMode.REAL_TIME,
    real_time_sync_enabled=True,
    user_presence_tracking=True
)

# Turn-based editing with locks
settings = CollaborationSettings(
    collaboration_mode=CollaborationMode.TURN_BASED,
    max_concurrent_users=1  # One editor at a time
)

# Branch-based workflow
settings = CollaborationSettings(
    collaboration_mode=CollaborationMode.BRANCH_BASED,
    version_control_enabled=True
)

# Review-based workflow with approval process
settings = CollaborationSettings(
    collaboration_mode=CollaborationMode.REVIEW_BASED,
    comment_system_enabled=True
)
```

### Performance Tuning

```python
# Optimize for your use case
settings = CollaborationSettings(
    # For high-performance scenarios
    sync_strategy=SyncStrategy.BATCHED,          # Batch operations for efficiency
    auto_save_interval=10,                       # Frequent auto-save
    max_concurrent_users=20,                     # Support more users
    
    # For reliability scenarios  
    track_all_changes=True,                      # Complete audit trail
    version_control_enabled=True,                # Full version history
    
    # For simplicity scenarios
    real_time_sync_enabled=False,                # Disable real-time features
    comment_system_enabled=False                 # Disable comments
)
```

### Custom Conflict Resolution

```python
# Set up user preferences for conflict resolution
from proposal_writer.collaboration.conflicts.conflict_resolver import UserPreferences

user_prefs = UserPreferences(
    user_id="alice",
    preferred_strategy=ResolutionStrategy.SEMANTIC_MERGE,
    trusted_authors=["bob", "charlie"],          # Trust these users' changes
    prefer_longer_content=True,                  # Prefer detailed content
    prefer_newer_changes=True,                   # Prefer recent changes
    auto_resolve_threshold=ConflictSeverity.MEDIUM  # Auto-resolve up to medium severity
)

# Apply preferences
resolver = integrator.conflict_resolver
await resolver.set_user_preferences("alice", user_prefs)
```

## 🎯 Common Workflows

### Workflow 1: Team Proposal Development

```python
# 1. Create collaborative proposal
doc = await integrator.create_collaborative_document(
    "Government Contract Proposal",
    """# Government IT Services Proposal

## Executive Summary
[To be completed]

## Technical Approach  
[To be completed]

## Past Performance
[To be completed]

## Cost Analysis
[To be completed]"""
)

# 2. Add team members with specific roles
await integrator.add_user_to_document(doc.document_id, "lead", "Project Lead", {"admin", "read", "write", "merge"})
await integrator.add_user_to_document(doc.document_id, "tech", "Technical Writer", {"read", "write", "comment"})
await integrator.add_user_to_document(doc.document_id, "finance", "Finance Analyst", {"read", "write", "comment"})
await integrator.add_user_to_document(doc.document_id, "reviewer", "Senior Reviewer", {"read", "comment"})

# 3. Parallel development on different sections
tech_branch = await integrator.create_document_branch(doc.document_id, "tech", "technical-approach")
finance_branch = await integrator.create_document_branch(doc.document_id, "finance", "cost-analysis")

# 4. Work proceeds in parallel with automatic conflict resolution
# 5. Regular merges and reviews through comment system
# 6. Final approval and document completion
```

### Workflow 2: Document Review Process

```python
# 1. Reviewer adds comments
editor = await integrator.collaborative_sessions[doc.document_id].get_session(doc.document_id)

await editor.add_comment("reviewer", 100, 50, "This claim needs citation")
await editor.add_comment("reviewer", 300, 25, "Consider alternative approach")

# 2. Authors address comments
await integrator.edit_document(doc.document_id, "tech", revised_content, 
                              commit_message="Address reviewer feedback on technical approach")

# 3. Mark comments as resolved
comments = await editor.get_comments()
for comment_id, comment in comments.items():
    if comment.author_id == "reviewer" and not comment.resolved:
        await editor.resolve_comment("tech", comment_id)

# 4. Final approval
final_status = await integrator.get_document_status(doc.document_id)
if final_status['conflicts_resolved'] == 0:
    print("Document ready for final approval!")
```

### Workflow 3: Version Management

```python
# 1. Create milestone tags
version_manager = integrator.version_managers[doc.document_id]
await version_manager.create_tag("v1.0-draft", current_commit_id, "lead", "Initial complete draft")

# 2. Create release branch
await integrator.create_document_branch(doc.document_id, "lead", "release-v1.0", "main")

# 3. Continue development on main while preparing release
await integrator.edit_document(doc.document_id, "tech", new_features, 
                              commit_message="Add new technical features")

# 4. Cherry-pick important fixes to release branch
# 5. Tag final release
await version_manager.create_tag("v1.0-final", release_commit_id, "lead", "Final release version")
```

## 🆘 Troubleshooting

### Common Issues and Solutions

#### Issue: Changes Not Syncing

**Symptoms**: Your changes don't appear for other users

**Solutions**:
1. Check network connectivity
2. Verify user permissions include "write"
3. Check if document is in a locked state
4. Try manual sync trigger

```python
# Force sync
await integrator._sync_document_immediately(doc.document_id)
```

#### Issue: Conflicts Not Resolving

**Symptoms**: Repeated conflict messages, merge failures

**Solutions**:
1. Check conflict resolution strategy settings
2. Try manual resolution for complex conflicts
3. Use branch-based workflow for major changes

```python
# Get detailed conflict information
resolution = await integrator.resolve_conflicts(doc.document_id, user_id, auto_resolve=False)
for conflict in resolution.unresolved_conflicts:
    print(f"Manual resolution needed: {conflict.description}")
```

#### Issue: Performance Problems

**Symptoms**: Slow response times, delays in sync

**Solutions**:
1. Reduce number of concurrent users
2. Switch to batched sync strategy
3. Clear document caches
4. Check system resources

```python
# Performance diagnostics
status = await integrator.get_document_status(doc.document_id)
if status['average_sync_time'] > 1000:  # >1 second
    print("Performance issue detected")
    
    # Switch to more efficient sync
    doc.collaboration_settings.sync_strategy = SyncStrategy.BATCHED
```

### Getting Help

1. **Check Logs**: Enable debug logging to see detailed operation traces
2. **Performance Metrics**: Use built-in monitoring to identify bottlenecks  
3. **Document State**: Examine document status for inconsistencies
4. **User Permissions**: Verify users have required permissions for operations

```python
# Enable debug logging
import logging
logging.getLogger('proposal_writer.collaboration').setLevel(logging.DEBUG)

# Check document health
status = await integrator.get_document_status(doc.document_id)
if status['total_operations'] > 10000:
    print("Consider creating a new document version to improve performance")
```

## 🎓 Best Practices

### For Teams

1. **Establish Roles**: Assign clear permissions based on user responsibilities
2. **Use Branches**: Create branches for major changes or experimental features  
3. **Regular Merges**: Keep branches synchronized with main development
4. **Comment Actively**: Use comments for discussion and review processes
5. **Monitor Performance**: Watch for performance degradation with large documents

### For Performance

1. **Batch Related Changes**: Group multiple edits when possible
2. **Optimize Sync Strategy**: Choose appropriate sync mode for your use case
3. **Manage Document Size**: Consider splitting very large documents
4. **Clean Up Regularly**: Archive old versions and resolved conflicts
5. **Monitor Resources**: Track memory and CPU usage during intensive collaboration

### For Reliability

1. **Regular Backups**: Create document snapshots at key milestones
2. **Version Tags**: Tag important document versions for easy reference
3. **Test Conflict Resolution**: Verify conflict resolution works for your content types
4. **User Training**: Ensure all users understand collaboration features
5. **Fallback Plans**: Have procedures for when collaboration features fail

## 📚 Additional Resources

### Quick Reference Cards

**Common Operations**:
- Create document: `create_collaborative_document(title, content)`
- Add user: `add_user_to_document(doc_id, user_id, name, permissions)`
- Edit document: `edit_document(doc_id, user_id, content)`
- Resolve conflicts: `resolve_conflicts(doc_id, user_id)`
- Check status: `get_document_status(doc_id)`

**Keyboard Shortcuts** (when using with UI):
- `Ctrl+S`: Force save/sync
- `Ctrl+Z`: Undo last operation  
- `Ctrl+Y`: Redo operation
- `Ctrl+/`: Add comment at cursor
- `Ctrl+Shift+M`: Manual conflict resolution

### Integration Examples

See the `examples/` directory for complete integration examples:
- `collaborative_proposal_writing.py`: Full proposal development workflow
- `document_review_process.py`: Review and approval workflow
- `performance_optimization.py`: High-performance collaboration setup