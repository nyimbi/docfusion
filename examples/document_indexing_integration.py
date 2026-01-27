#!/usr/bin/env python3
"""
Document Creation and Search Indexing Integration

Example showing how to properly integrate search indexing with document creation,
updates, and deletion using event-driven patterns.
"""

import asyncio
import logging
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

try:
    from uuid_extension import uuid7str
except ImportError:
    from uuid import uuid4

    def uuid7str() -> str:
        return str(uuid4())


class DocumentEventType(str, Enum):
    """Document event types for search indexing"""

    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class DocumentEvent:
    """Document event for search indexing"""

    def __init__(
        self,
        event_type: DocumentEventType,
        document_id: str,
        title: str = None,
        content: str = None,
        metadata: Dict[str, Any] = None,
    ):
        self.event_type = event_type
        self.document_id = document_id
        self.title = title
        self.content = content
        self.metadata = metadata or {}
        self.timestamp = datetime.utcnow()


class DocumentService:
    """Document service with integrated search indexing"""

    def __init__(self, search_engine, webhook_endpoints=None):
        self.search_engine = search_engine
        self.webhook_endpoints = webhook_endpoints
        self.logger = logging.getLogger(__name__)

        # In-memory storage for demo (would be database in production)
        self.documents: Dict[str, Dict[str, Any]] = {}

    async def create_document(
        self,
        title: str,
        content: str,
        author_id: str,
        document_type: str = "proposal",
        tags: list = None,
    ) -> str:
        """Create document with automatic search indexing"""

        document_id = uuid7str()
        tags = tags or []

        # Create document record
        document = {
            "id": document_id,
            "title": title,
            "content": content,
            "author": author_id,
            "document_type": document_type,
            "tags": tags,
            "status": "draft",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "version": 1,
        }

        # Store in database (simulated)
        self.documents[document_id] = document

        # Index in search engine
        await self._index_document(document)

        # Send webhook notification
        await self._send_webhook_event(DocumentEventType.CREATED, document)

        self.logger.info(f"Created and indexed document {document_id}: '{title}'")
        return document_id

    async def update_document(
        self,
        document_id: str,
        title: str = None,
        content: str = None,
        tags: list = None,
    ) -> bool:
        """Update document with search re-indexing"""

        if document_id not in self.documents:
            return False

        document = self.documents[document_id]

        # Update fields
        if title is not None:
            document["title"] = title
        if content is not None:
            document["content"] = content
        if tags is not None:
            document["tags"] = tags

        document["updated_at"] = datetime.utcnow()
        document["version"] += 1

        # Re-index in search engine
        await self._index_document(document)

        # Send webhook notification
        await self._send_webhook_event(DocumentEventType.UPDATED, document)

        self.logger.info(f"Updated and re-indexed document {document_id}")
        return True

    async def delete_document(self, document_id: str) -> bool:
        """Delete document and remove from search index"""

        if document_id not in self.documents:
            return False

        document = self.documents[document_id]

        # Mark as deleted (soft delete)
        document["status"] = "deleted"
        document["deleted_at"] = datetime.utcnow()

        # Remove from search index
        await self._remove_from_search_index(document_id)

        # Send webhook notification
        await self._send_webhook_event(DocumentEventType.DELETED, document)

        self.logger.info(
            f"Deleted document {document_id} and removed from search index"
        )
        return True

    async def publish_document(self, document_id: str) -> bool:
        """Publish document and update search index"""

        if document_id not in self.documents:
            return False

        document = self.documents[document_id]
        document["status"] = "published"
        document["published_at"] = datetime.utcnow()
        document["updated_at"] = datetime.utcnow()

        # Re-index with updated status
        await self._index_document(document)

        # Send webhook notification
        await self._send_webhook_event(DocumentEventType.PUBLISHED, document)

        self.logger.info(f"Published document {document_id}")
        return True

    async def _index_document(self, document: Dict[str, Any]):
        """Index document in search engine"""
        try:
            # Prepare metadata for search index
            search_metadata = {
                "author": document["author"],
                "document_type": document["document_type"],
                "tags": document["tags"],
                "status": document["status"],
                "created_at": document["created_at"].isoformat(),
                "updated_at": document["updated_at"].isoformat(),
                "version": document["version"],
            }

            # Add optional fields
            if "published_at" in document:
                search_metadata["published_at"] = document["published_at"].isoformat()

            # Index in search engine
            await self.search_engine.index_document(
                document["id"], document["title"], document["content"], search_metadata
            )

        except Exception as e:
            self.logger.error(f"Failed to index document {document['id']}: {e}")
            # Could implement retry logic here

    async def _remove_from_search_index(self, document_id: str):
        """Remove document from search index"""
        try:
            await self.search_engine.delete_document(document_id)
        except Exception as e:
            self.logger.error(
                f"Failed to remove document {document_id} from search: {e}"
            )

    async def _send_webhook_event(
        self, event_type: DocumentEventType, document: Dict[str, Any]
    ):
        """Send webhook notification for document events"""
        if not self.webhook_endpoints:
            return

        try:
            # Prepare webhook data
            webhook_data = {
                "document_id": document["id"],
                "title": document["title"],
                "author": document["author"],
                "document_type": document["document_type"],
                "status": document["status"],
                "event_type": event_type.value,
                "timestamp": datetime.utcnow().isoformat(),
            }

            # Send webhook
            await self.webhook_endpoints.send_webhook_event(
                f"document.{event_type.value}",
                webhook_data,
                user_id=document["author"],
                resource_id=document["id"],
            )

        except Exception as e:
            self.logger.error(
                f"Failed to send webhook for document {document['id']}: {e}"
            )


class BatchDocumentIndexer:
    """Batch indexing for large document migrations"""

    def __init__(self, search_engine, batch_size: int = 100):
        self.search_engine = search_engine
        self.batch_size = batch_size
        self.logger = logging.getLogger(__name__)

    async def reindex_all_documents(self, documents: list):
        """Reindex all documents in batches"""

        total = len(documents)
        processed = 0

        for i in range(0, total, self.batch_size):
            batch = documents[i : i + self.batch_size]

            # Process batch
            tasks = []
            for doc in batch:
                task = self._index_single_document(doc)
                tasks.append(task)

            # Execute batch concurrently
            await asyncio.gather(*tasks, return_exceptions=True)

            processed += len(batch)
            self.logger.info(f"Indexed batch: {processed}/{total} documents")

        self.logger.info(f"Completed reindexing {total} documents")

    async def _index_single_document(self, document: Dict[str, Any]):
        """Index a single document"""
        try:
            metadata = {
                "author": document.get("author"),
                "document_type": document.get("document_type"),
                "tags": document.get("tags", []),
                "status": document.get("status"),
                "created_at": document.get("created_at", datetime.utcnow()).isoformat(),
            }

            await self.search_engine.index_document(
                document["id"], document["title"], document["content"], metadata
            )

        except Exception as e:
            self.logger.error(f"Failed to index document {document['id']}: {e}")


class SearchIndexManager:
    """Manages search index operations and optimization"""

    def __init__(self, search_engine):
        self.search_engine = search_engine
        self.logger = logging.getLogger(__name__)

    async def optimize_index(self):
        """Optimize search index performance"""
        try:
            # Get backend-specific optimization
            if hasattr(self.search_engine.backend, "optimize"):
                await self.search_engine.backend.optimize()
            else:
                self.logger.info("Backend doesn't support optimization")

        except Exception as e:
            self.logger.error(f"Index optimization failed: {e}")

    async def get_index_stats(self) -> Dict[str, Any]:
        """Get search index statistics"""
        try:
            stats = await self.search_engine.backend.get_stats()
            return stats
        except Exception as e:
            self.logger.error(f"Failed to get index stats: {e}")
            return {}

    async def backup_index(self, backup_path: str):
        """Backup search index (implementation depends on backend)"""
        # This would be backend-specific
        self.logger.info(
            f"Index backup to {backup_path} - implementation depends on backend"
        )

    async def rebuild_index_from_database(self, document_service: DocumentService):
        """Rebuild entire search index from database"""
        try:
            # Clear existing index (careful!)
            self.logger.warning(
                "Rebuilding search index - this will clear existing data"
            )

            # Get all documents from database
            all_documents = list(document_service.documents.values())

            # Use batch indexer to rebuild
            batch_indexer = BatchDocumentIndexer(self.search_engine)
            await batch_indexer.reindex_all_documents(all_documents)

            self.logger.info(
                f"Rebuilt search index with {len(all_documents)} documents"
            )

        except Exception as e:
            self.logger.error(f"Index rebuild failed: {e}")


async def example_usage():
    """Example of integrated document and search operations"""

    # Mock search engine for demonstration
    class MockSearchEngine:
        async def index_document(self, doc_id, title, content, metadata):
            print(f"🔍 INDEXED: {doc_id} - '{title}' with metadata: {metadata}")

        async def delete_document(self, doc_id):
            print(f"🗑️  REMOVED from search: {doc_id}")

    # Create services
    search_engine = MockSearchEngine()
    doc_service = DocumentService(search_engine)

    print("=== Document Creation and Search Indexing Example ===\n")

    # 1. Create documents
    print("1. Creating documents...")
    doc1_id = await doc_service.create_document(
        "Proposal Template",
        "This is a template for creating proposals...",
        "user123",
        "template",
        ["proposal", "template", "important"],
    )

    doc2_id = await doc_service.create_document(
        "Project Report",
        "This report covers the Q1 project status...",
        "user456",
        "report",
        ["report", "q1", "project"],
    )

    print()

    # 2. Update document
    print("2. Updating document...")
    await doc_service.update_document(
        doc1_id,
        title="Updated Proposal Template",
        content="This is an updated template for creating proposals...",
        tags=["proposal", "template", "important", "updated"],
    )

    print()

    # 3. Publish document
    print("3. Publishing document...")
    await doc_service.publish_document(doc1_id)

    print()

    # 4. Delete document
    print("4. Deleting document...")
    await doc_service.delete_document(doc2_id)

    print()

    # 5. Index statistics
    print("5. Index management...")
    index_manager = SearchIndexManager(search_engine)
    stats = await index_manager.get_index_stats()
    print(f"Index stats: {stats}")

    print("\n=== Key Points ===")
    print("✅ Single shared index per backend (not per document)")
    print("✅ Automatic indexing on create/update/delete")
    print("✅ Event-driven webhook notifications")
    print("✅ Batch processing for large migrations")
    print("✅ Index management and optimization")
    print("✅ Consistent metadata structure")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(example_usage())
