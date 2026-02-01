# Comments and Review Workflow - DocFusion

A comprehensive comments and review/approval workflow system for documents.

## Overview

This system provides:
1. **Threaded Comments** - Full comment threading with replies
2. **Section-specific Comments** - Click on document sections to comment
3. **Review Workflow** - Multi-stage approval process
4. **Due Date Tracking** - Visual indicators for deadlines
5. **Multiple Reviewers** - Support for sequential or parallel reviews

## Architecture

```
Database Schema → Types → Server Actions → Components → Usage
```

### Database (PostgreSQL via Drizzle ORM)

#### Tables

**`documentComments`** - Threaded comments on documents
- `id`, `documentId`, `sectionId` (optional), `userId`
- `content`, `type` (comment|suggestion|approval|rejection)
- `parentId` (for replies), `position` (document anchor)
- `resolvedAt`, `resolvedBy`, `isEdited`

**`documentApprovals`** - Review workflow tracking
- `id`, `documentId`, `sectionId`, `proposalDocumentId`
- `stage` (writer|reviewer|approver), `status` (pending|in_review|approved|rejected|changes_requested)
- `assignedTo`, `sequenceOrder`, `dueDate`
- `completedAt`, `notes`, `rejectionReason`

**`documentWorkflows`** - Workflow templates
- `id`, `name`, `description`
- `stages` (JSON array of stage configs)
- `isDefault`, `organizationId`, `documentType`

**`workflowAssignments`** - Who is assigned to what
- `id`, `documentId`, `workflowId`, `stage`
- `userId`, `sequenceOrder`, `dueDate`, `isActive`

**`commentReactions`** - Emoji reactions to comments

### Types (`lib/types/comments-workflow.ts`)

Full TypeScript type definitions for:
- `DocumentComment`, `CreateCommentInput`, `UpdateCommentInput`
- `DocumentApproval`, `CreateApprovalInput`, `UpdateApprovalInput`
- `DocumentWorkflow`, `WorkflowStageConfig`
- `WorkflowAssignment`, `WorkflowStatus`, `DeadlineSummary`

### Server Actions

#### `lib/actions/comments.ts`
- `createComment()`, `updateComment()`, `deleteComment()`
- `getComments()`, `getComment()`
- `resolveComment()`, `resolveSectionComments()`
- `getCommentStats()`, `addCommentReaction()`, `removeCommentReaction()`

#### `lib/actions/approvals.ts`
- `createApproval()`, `updateApproval()`, `deleteApproval()`
- `getApprovals()`, `getPendingApprovalsForUser()`, `getOverdueApprovals()`
- `submitReview()` - Approve/reject/request changes
- `getWorkflowStatus()`, `initializeWorkflow()`
- `getUpcomingDeadlines()`, `updateApprovalDueDate()`
- `reassignApprovals()`, `cancelWorkflow()`

#### `lib/actions/workflows.ts`
- `getWorkflow()`, `getWorkflows()`, `getDefaultWorkflow()`
- `createWorkflow()`, `updateWorkflow()`, `deleteWorkflow()`
- `getWorkflowAssignments()`, `getStageAssignments()`
- `createAssignment()`, `bulkCreateAssignments()`
- `initializeDefaultWorkflow()`, `applyWorkflowToDocument()`
- Presets: `createStandardWorkflow()`, `createMultiReviewerWorkflow()`, `createSoloWorkflow()`

### React Components

#### `components/document/CommentThread.tsx`
A threaded comment with replies. Features:
- Nested replies (up to configurable depth)
- Comment types (comment, suggestion, approval, rejection)
- Reactions (👍 👎 ❤️ ✅ 🤔 ❓)
- Edit/delete (author only)
- Resolve/unresolve

#### `components/document/CommentsPanel.tsx`
Side panel for comments. Features:
- Show comments for document or specific section
- Filter by type, resolved status, search
- Statistics display
- New comment creation
- Quick section comment resolve

#### `components/document/ApprovalWorkflow.tsx`
Review status visualization. Features:
- Progress bar through stages
- Stage cards with status
- Assigned user avatars
- Due date with urgency indicators
- Overdue warnings
- Action buttons for current reviewer

#### `components/document/ReviewToolbar.tsx`
Approve/Reject/Request changes buttons. Features:
- Quick action buttons
- Confirmation dialogs with feedback
- Quick response templates
- Rejection category selection

## Usage Example

```tsx
import {
  CommentsPanel,
  ApprovalWorkflow,
  ReviewToolbar,
} from "@/components/document";

// In your document editor page:
export default function DocumentPage({ documentId, currentUserId }) {
  return (
    <div className="flex h-screen">
      {/* Main document editor */}
      <div className="flex-1">
        <Editor />
      </div>

      {/* Side panel */}
      <div className="w-96 overflow-y-auto">
        {/* Comments */}
        <CommentsPanel
          documentId={documentId}
          selectedSectionId={currentSectionId}
          currentUserId={currentUserId}
        />

        {/* Workflow Status */}
        <ApprovalWorkflow
          documentId={documentId}
          currentUserId={currentUserId}
        />
      </div>

      {/* Review toolbar in header */}
      <ReviewToolbar
        documentId={documentId}
        currentUserId={currentUserId}
      />
    </div>
  );
}
```

## Workflow Stages

1. **Writer** - Drafting and editing
2. **Reviewer** - Technical/content review (can have multiple reviewers)
3. **Approver** - Final sign-off

Each stage can have:
- Multiple users assigned
- Sequential or parallel approval
- Due dates
- Notifications (placeholder)

## Features

### Comment Features
- ✅ Threaded replies
- ✅ Section-specific comments
- ✅ Comment types (comment, suggestion, approval, rejection)
- ✅ Reactions
- ✅ Edit/delete
- ✅ Resolve/unresolve
- ✅ Filter by type/status/search
- ✅ Statistics

### Workflow Features
- ✅ Multi-stage approval
- ✅ Multiple reviewers per stage
- ✅ Due date tracking with urgency indicators
- ✅ Same person for multiple stages
- ✅ Visual progress tracking
- ✅ Overdue highlighting
- ✅ Assignment management
- ✅ Workflow templates

### Notification Triggers (placeholder)
The following notification events are prepared:
- `assigned` - User assigned to review
- `due_soon` - Due date approaching
- `overdue` - Missed deadline
- `approved`/`rejected`/`changes_requested` - Review decision
- `comment_added` - New comment on document

## Database Migration

The schema is in `lib/db/schema-comments-workflow.ts` and exported from `lib/db/schema.ts`.

Run migrations with:
```bash
npm run db:migrate  # or appropriate command for your setup
```

## Further Enhancements

Future capabilities that can be added:
1. **Real-time updates** - WebSocket for instant comment/workflow updates
2. **Email notifications** - Connect notification triggers to email service
3. **Slack integration** - Post review updates to Slack
4. **PDF annotations** - Visual markers for comments on rendered PDFs
5. **@mentions** - Notify specific users in comments
6. **Comment templates** - Predefined comment patterns
7. **Batch reviews** - Approve multiple documents at once
8. **Audit trail** - Log all workflow actions
9. **Delegation** - Temporary review reassignment
10. **Escalation** - Auto-escalate overdue approvals

## See Example

Check `app/example-review-page.tsx` for a complete integration example.
