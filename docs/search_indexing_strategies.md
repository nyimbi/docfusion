# Search Indexing Strategies

This document explains how search indexes are populated and managed in the proposal writer system.

## Index Architecture

### Single Shared Index (Recommended ✅)

**What we use**: One shared index per search backend that contains all documents.

```
MeiliSearch Index: "documents"
├── doc_1 (title: "Proposal A", content: "...", metadata: {...})
├── doc_2 (title: "Report B", content: "...", metadata: {...})
├── doc_3 (title: "Template C", content: "...", metadata: {...})
└── ...
```

**Benefits:**
- **Efficient cross-document search** - can search across all documents simultaneously
- **Simple management** - one index to maintain, backup, optimize
- **Fast queries** - no need to query multiple indexes and merge results
- **Cost effective** - less infrastructure overhead
- **Atomic operations** - updates and deletes are straightforward

### Per-Document Index (NOT Recommended ❌)

**What this would be**: Separate index for each document.

```
MeiliSearch Indexes:
├── documents_doc_1 (contains only doc_1)
├── documents_doc_2 (contains only doc_2)  
├── documents_doc_3 (contains only doc_3)
└── ...
```

**Why we don't do this:**
- **Poor search performance** - need to query 1000s of indexes for global search
- **Complex management** - managing thousands of indexes
- **Resource intensive** - each index has overhead
- **Limited cross-document features** - can't easily find related documents

## Document Lifecycle and Indexing

### 1. Document Creation

When a document is created:

```python
async def create_document(title: str, content: str, metadata: dict) -> str:
    # 1. Create document in database
    document_id = await db.create_document(title, content, metadata)
    
    # 2. Index in search engine (single shared index)
    await search_engine.index_document(
        document_id, 
        title, 
        content, 
        {
            'author': metadata['author'],
            'type': metadata['type'],
            'tags': metadata['tags'],
            'created_at': datetime.utcnow().isoformat(),
            'status': 'draft'
        }
    )
    
    # 3. Send webhook notification
    await webhook_system.notify('document.created', {...})
    
    return document_id
```

### 2. Document Updates

When a document is updated:

```python
async def update_document(document_id: str, title: str, content: str):
    # 1. Update in database
    await db.update_document(document_id, title, content)
    
    # 2. Re-index in search engine (overwrites existing entry)
    await search_engine.index_document(
        document_id,
        title, 
        content,
        updated_metadata
    )
    
    # 3. Notify about change
    await webhook_system.notify('document.updated', {...})
```

### 3. Document Deletion

When a document is deleted:

```python
async def delete_document(document_id: str):
    # 1. Mark as deleted in database (soft delete)
    await db.mark_deleted(document_id)
    
    # 2. Remove from search index
    await search_engine.delete_document(document_id)
    
    # 3. Notify about deletion
    await webhook_system.notify('document.deleted', {...})
```

## Search Backend Specifics

### MeiliSearch

```python
# Single index setup
client = meilisearch.Client('http://localhost:7700')
index = client.index('documents')  # One index for all documents

# Configure index settings once
index.update_searchable_attributes(['title', 'content', 'metadata.tags'])
index.update_filterable_attributes(['type', 'author', 'status', 'created_at'])
index.update_sortable_attributes(['created_at', 'updated_at', 'title'])

# Add/update document
document = {
    'id': 'doc_123',
    'title': 'My Proposal',
    'content': 'Proposal content...',
    'metadata': {...}
}
index.add_documents([document])  # Adds to shared index
```

### OpenSearch/Elasticsearch

```python
# Single index setup
client = OpenSearch([{'host': 'localhost', 'port': 9200}])
index_name = 'documents'  # One index for all documents

# Index mapping setup once
mapping = {
    "mappings": {
        "properties": {
            "title": {"type": "text", "analyzer": "standard"},
            "content": {"type": "text", "analyzer": "standard"},
            "metadata": {
                "properties": {
                    "author": {"type": "keyword"},
                    "type": {"type": "keyword"},
                    "tags": {"type": "keyword"},
                    "created_at": {"type": "date"}
                }
            }
        }
    }
}
client.indices.create(index_name, body=mapping)

# Add/update document  
document = {
    'id': 'doc_123',
    'title': 'My Proposal', 
    'content': 'Proposal content...',
    'metadata': {...}
}
client.index(index=index_name, id='doc_123', body=document)
```

## Advanced Indexing Patterns

### 1. Bulk/Batch Indexing

For performance when indexing many documents:

```python
async def batch_index_documents(documents: List[Dict], batch_size: int = 100):
    """Index documents in batches for better performance"""
    
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i + batch_size]
        
        # Prepare batch for search engine
        search_docs = []
        for doc in batch:
            search_docs.append({
                'id': doc['id'],
                'title': doc['title'],
                'content': doc['content'],
                'metadata': prepare_metadata(doc)
            })
        
        # Index batch (backend-specific)
        if backend_type == 'meilisearch':
            await index.add_documents(search_docs)
        elif backend_type == 'opensearch':
            await bulk_index_opensearch(search_docs)
        
        print(f"Indexed batch {i//batch_size + 1}: {len(batch)} documents")
```

### 2. Incremental Indexing

Track changes and only index what changed:

```python
class IncrementalIndexer:
    def __init__(self):
        self.last_sync = datetime.utcnow()
    
    async def sync_changes(self):
        """Index only documents changed since last sync"""
        
        # Get documents modified since last sync
        changed_docs = await db.get_documents_modified_since(self.last_sync)
        
        for doc in changed_docs:
            if doc.status == 'deleted':
                await search_engine.delete_document(doc.id)
            else:
                await search_engine.index_document(
                    doc.id, doc.title, doc.content, doc.metadata
                )
        
        self.last_sync = datetime.utcnow()
        print(f"Synced {len(changed_docs)} changes to search index")
```

### 3. Index Partitioning (Advanced)

For very large datasets, you might partition by logical groups:

```python
# Example: Separate indexes by organization or tenant
class PartitionedSearchEngine:
    def __init__(self):
        self.indexes = {}  # tenant_id -> search_backend
    
    async def index_document(self, tenant_id: str, doc_id: str, title: str, content: str):
        """Index document in tenant-specific index"""
        
        if tenant_id not in self.indexes:
            # Create tenant-specific index
            self.indexes[tenant_id] = create_search_backend(
                index_name=f"documents_{tenant_id}"
            )
        
        await self.indexes[tenant_id].index_document(doc_id, title, content, metadata)
    
    async def search(self, tenant_id: str, query: str):
        """Search within tenant's documents only"""
        if tenant_id in self.indexes:
            return await self.indexes[tenant_id].search(query)
        return []
```

## Best Practices

### ✅ Do's

1. **Use single shared index** for most use cases
2. **Index immediately** when documents are created/updated
3. **Use consistent metadata structure** across all documents
4. **Implement retry logic** for indexing failures
5. **Monitor index performance** and size
6. **Use batch operations** for bulk updates
7. **Clean up deleted documents** from index
8. **Version your index mappings** for schema changes

### ❌ Don'ts

1. **Don't create per-document indexes** - leads to poor performance
2. **Don't forget to remove deleted documents** from search index
3. **Don't index sensitive data** without proper security
4. **Don't ignore indexing errors** - implement proper error handling
5. **Don't make schema changes** without considering existing data
6. **Don't skip index optimization** for production systems

## Monitoring and Maintenance

### Index Health Monitoring

```python
async def monitor_search_index():
    """Monitor search index health and performance"""
    
    stats = await search_engine.get_stats()
    
    print(f"Total documents indexed: {stats['total_documents']}")
    print(f"Index size: {stats.get('index_size_mb', 'N/A')} MB")
    print(f"Average query time: {stats.get('avg_query_time_ms', 'N/A')} ms")
    
    # Alert if issues detected
    if stats.get('failed_indexes', 0) > 0:
        await send_alert(f"Search index has {stats['failed_indexes']} failed documents")
    
    if stats.get('avg_query_time_ms', 0) > 1000:
        await send_alert("Search queries are slow - consider optimization")
```

### Index Maintenance

```python
async def maintain_search_index():
    """Regular maintenance tasks for search index"""
    
    # 1. Remove documents marked as deleted
    deleted_docs = await db.get_deleted_documents()
    for doc in deleted_docs:
        await search_engine.delete_document(doc.id)
    
    # 2. Optimize index performance (backend-specific)
    await search_engine.optimize_index()
    
    # 3. Backup index
    await search_engine.backup_index(f"backup_{datetime.utcnow().date()}")
    
    # 4. Clean up old backups
    await cleanup_old_backups(days=30)
    
    print("Index maintenance completed")
```

## Summary

The search indexing strategy uses:

- ✅ **Single shared index per backend** (e.g., "documents")
- ✅ **Automatic indexing** on document create/update/delete  
- ✅ **Event-driven updates** via webhook notifications
- ✅ **Batch processing** for bulk operations
- ✅ **Consistent metadata structure** for all documents
- ✅ **Multiple backend support** (MeiliSearch, OpenSearch, in-memory)
- ✅ **Performance monitoring** and health checks
- ✅ **Proper error handling** and retry logic

This approach provides excellent search performance, simple management, and scalability for document-centric applications.