#!/usr/bin/env python3
"""
GraphQL Schema Definition

Comprehensive GraphQL schema for complex document queries, mutations,
and subscriptions with integrated security and real-time capabilities.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import timezone, datetime, timedelta
from enum import Enum

try:
	import strawberry
	from strawberry.types import Info
	from strawberry.permission import BasePermission
except ImportError:
	strawberry = None

logger = logging.getLogger(__name__)

from ..endpoints.search_endpoints import SearchRequest, SearchMode, SearchScope
from .context import build_graphql_context as build_graphql_context
from ...security import SecurityManager
from ...core.utils import uuid7str

if strawberry is None:
	raise ImportError("strawberry-graphql is required for GraphQL support")

# ==================== PERMISSIONS ====================

class IsAuthenticated(BasePermission):
	"""Check if user is authenticated"""
	message = "User must be authenticated"
	
	async def has_permission(self, source: Any, info: Info, **kwargs) -> bool:
		context = info.context
		return context.get("user") is not None

class HasPermission(BasePermission):
	"""Check specific permission"""
	
	def __init__(self, resource: str, action: str):
		self.resource = resource
		self.action = action
		self.message = f"Permission required: {resource}:{action}"
	
	async def has_permission(self, source: Any, info: Info, **kwargs) -> bool:
		context = info.context
		user = context.get("user")
		security_manager = context.get("security_manager")
		
		if not user or not security_manager:
			return False
		
		try:
			auth_result = await security_manager.check_permission(
				user["user_id"], self.resource, self.action
			)
			return auth_result.has_permission
		except Exception as e:
			logger.warning(f"Permission check failed: {e}")
			return False

def require_permission(resource: str, action: str):
	"""Create a Strawberry permission class for a specific resource action."""
	class ResourcePermission(HasPermission):
		def __init__(self):
			super().__init__(resource, action)

	ResourcePermission.__name__ = f"HasPermission_{resource}_{action}"
	return ResourcePermission

class IsOwnerOrAdmin(BasePermission):
	"""Check if user owns resource or is admin"""
	message = "Must be owner or admin"
	
	async def has_permission(self, source: Any, info: Info, **kwargs) -> bool:
		context = info.context
		user = context.get("user")
		security_manager = context.get("security_manager")
		
		if not user or not security_manager:
			return False
		
		# Check if admin
		admin_result = await security_manager.check_permission(
			user["user_id"], "system", "manage"
		)
		if admin_result.has_permission:
			return True
		
		# Check ownership (implementation depends on specific resource)
		resource_owner = getattr(source, "created_by", None) or getattr(source, "user_id", None)
		return resource_owner == user["user_id"]

# ==================== ENUMS ====================

@strawberry.enum
class DocumentStatus(Enum):
	DRAFT = "draft"
	PUBLISHED = "published"
	ARCHIVED = "archived"
	DELETED = "deleted"

@strawberry.enum
class DocumentType(Enum):
	PROPOSAL = "proposal"
	TEMPLATE = "template"
	REPORT = "report"
	MEMO = "memo"
	OTHER = "other"

@strawberry.enum
class SearchModeEnum(Enum):
	FULL_TEXT = "full_text"
	EXACT = "exact"
	FUZZY = "fuzzy"
	REGEX = "regex"
	SEMANTIC = "semantic"

@strawberry.enum
class SearchScopeEnum(Enum):
	ALL = "all"
	DOCUMENTS = "documents"
	TEMPLATES = "templates"
	COMMENTS = "comments"

@strawberry.enum
class SortOrderEnum(Enum):
	ASC = "asc"
	DESC = "desc"

@strawberry.enum
class SearchSortEnum(Enum):
	RELEVANCE = "relevance"
	CREATED_AT = "created_at"
	UPDATED_AT = "updated_at"
	TITLE = "title"
	AUTHOR = "author"

# ==================== SCALAR TYPES ====================

@strawberry.type
class User:
	"""User type"""
	user_id: str
	username: str
	email: str
	full_name: Optional[str] = None
	avatar_url: Optional[str] = None
	created_at: datetime
	last_login: Optional[datetime] = None
	is_active: bool = True

@strawberry.type
class Tag:
	"""Document tag"""
	name: str
	color: Optional[str] = None
	description: Optional[str] = None

@strawberry.type
class DocumentMetadata:
	"""Document metadata"""
	word_count: Optional[int] = None
	page_count: Optional[int] = None
	language: Optional[str] = None
	file_size: Optional[int] = None
	mime_type: Optional[str] = None
	checksum: Optional[str] = None

@strawberry.type
class DocumentVersion:
	"""Document version information"""
	version_id: str
	version_number: int
	created_at: datetime
	created_by: str
	changes_summary: Optional[str] = None
	is_current: bool = False

@strawberry.type
class Document:
	"""Document type with full metadata"""
	document_id: str
	title: str
	content: str
	status: DocumentStatus
	document_type: DocumentType
	created_by: str
	created_at: datetime
	updated_at: datetime
	tags: List[Tag] = strawberry.field(default_factory=list)
	metadata: Optional[DocumentMetadata] = None
	version_info: Optional[DocumentVersion] = None
	
	@strawberry.field
	async def author(self, info: Info) -> Optional[User]:
		"""Get document author"""
		# In production, would fetch from user service
		return User(
			user_id=self.created_by,
			username=f"user_{self.created_by[:8]}",
			email=f"user_{self.created_by[:8]}@example.com",
			created_at=datetime.now(timezone.utc)
		)
	
	@strawberry.field
	async def collaborators(self, info: Info) -> List[User]:
		"""Get document collaborators"""
		# In production, would fetch from collaboration service
		return []
	
	@strawberry.field
	async def comments_count(self, info: Info) -> int:
		"""Get total comments count"""
		# In production, would query comment service
		return 0
	
	@strawberry.field
	async def is_favorite(self, info: Info) -> bool:
		"""Check if document is favorited by current user"""
		context = info.context
		user = context.get("user")
		if not user:
			return False
		
		# In production, would check user favorites
		return False

@strawberry.type
class Comment:
	"""Document comment"""
	comment_id: str
	document_id: str
	content: str
	created_by: str
	created_at: datetime
	updated_at: Optional[datetime] = None
	parent_id: Optional[str] = None
	position: Optional[str] = None  # JSON string for position in document
	is_resolved: bool = False
	
	@strawberry.field
	async def author(self, info: Info) -> Optional[User]:
		"""Get comment author"""
		return User(
			user_id=self.created_by,
			username=f"user_{self.created_by[:8]}",
			email=f"user_{self.created_by[:8]}@example.com",
			created_at=datetime.now(timezone.utc)
		)
	
	@strawberry.field
	async def replies(self, info: Info) -> List["Comment"]:
		"""Get comment replies"""
		# In production, would fetch replies from database
		return []

@strawberry.type
class SearchHighlight:
	"""Search result highlight"""
	field: str
	fragments: List[str]

@strawberry.type
class SearchResult:
	"""Search result item"""
	document_id: str
	title: str
	excerpt: Optional[str] = None
	score: float
	highlights: List[SearchHighlight] = strawberry.field(default_factory=list)
	
	@strawberry.field
	async def document(self, info: Info) -> Optional[Document]:
		"""Get full document"""
		# In production, would fetch from document service
		return Document(
			document_id=self.document_id,
			title=self.title,
			content="Document content...",
			status=DocumentStatus.PUBLISHED,
			document_type=DocumentType.PROPOSAL,
			created_by="user123",
			created_at=datetime.now(timezone.utc),
			updated_at=datetime.now(timezone.utc)
		)

@strawberry.type
class SearchResults:
	"""Paginated search results"""
	query: str
	total_results: int
	page: int
	per_page: int
	total_pages: int
	results: List[SearchResult]
	search_id: str
	timestamp: datetime

@strawberry.type
class DocumentConnection:
	"""GraphQL connection for documents"""
	edges: List["DocumentEdge"]
	page_info: "PageInfo"
	total_count: int

@strawberry.type
class DocumentEdge:
	"""Document edge for connections"""
	node: Document
	cursor: str

@strawberry.type
class PageInfo:
	"""Pagination information"""
	has_next_page: bool
	has_previous_page: bool
	start_cursor: Optional[str] = None
	end_cursor: Optional[str] = None

@strawberry.type
class AnalyticsData:
	"""Analytics data point"""
	timestamp: datetime
	value: float
	metadata: Optional[str] = None  # JSON string

@strawberry.type
class DocumentAnalytics:
	"""Document analytics"""
	document_id: str
	views: List[AnalyticsData] = strawberry.field(default_factory=list)
	edits: List[AnalyticsData] = strawberry.field(default_factory=list)
	collaborators: List[AnalyticsData] = strawberry.field(default_factory=list)
	total_views: int = 0
	total_edits: int = 0
	total_collaborators: int = 0

# ==================== INPUT TYPES ====================

@strawberry.input
class DocumentFilters:
	"""Document filtering options"""
	status: Optional[List[DocumentStatus]] = None
	document_type: Optional[List[DocumentType]] = None
	created_by: Optional[List[str]] = None
	tags: Optional[List[str]] = None
	created_after: Optional[datetime] = None
	created_before: Optional[datetime] = None
	updated_after: Optional[datetime] = None
	updated_before: Optional[datetime] = None
	search_query: Optional[str] = None

@strawberry.input
class DocumentSort:
	"""Document sorting options"""
	field: SearchSortEnum
	order: SortOrderEnum = SortOrderEnum.DESC

@strawberry.input
class SearchInput:
	"""Advanced search input"""
	query: str
	scope: SearchScopeEnum = SearchScopeEnum.ALL
	mode: SearchModeEnum = SearchModeEnum.FULL_TEXT
	filters: Optional[DocumentFilters] = None
	sort: Optional[DocumentSort] = None
	page: int = 1
	per_page: int = 20
	highlight: bool = True
	include_suggestions: bool = False

@strawberry.input
class DocumentInput:
	"""Document creation/update input"""
	title: str
	content: str
	document_type: DocumentType = DocumentType.PROPOSAL
	tags: List[str] = strawberry.field(default_factory=list)
	metadata: Optional[str] = None  # JSON string

@strawberry.input
class CommentInput:
	"""Comment creation input"""
	document_id: str
	content: str
	parent_id: Optional[str] = None
	position: Optional[str] = None

# ==================== QUERIES ====================

@strawberry.type
class Query:
	"""GraphQL queries"""
	
	@strawberry.field(permission_classes=[IsAuthenticated])
	async def documents(
		self,
		info: Info,
		filters: Optional[DocumentFilters] = None,
		sort: Optional[DocumentSort] = None,
		first: int = 20,
		after: Optional[str] = None
	) -> DocumentConnection:
		"""Get paginated documents"""
		# In production, would implement actual database queries
		sample_docs = [
			Document(
				document_id=f"doc_{i}",
				title=f"Sample Document {i}",
				content=f"This is sample content for document {i}",
				status=DocumentStatus.PUBLISHED,
				document_type=DocumentType.PROPOSAL,
				created_by="user123",
				created_at=datetime.now(timezone.utc) - timedelta(days=i),
				updated_at=datetime.now(timezone.utc) - timedelta(days=i//2)
			) for i in range(1, 21)
		]
		
		edges = [
			DocumentEdge(node=doc, cursor=f"cursor_{doc.document_id}")
			for doc in sample_docs
		]
		
		return DocumentConnection(
			edges=edges,
			page_info=PageInfo(
				has_next_page=False,
				has_previous_page=False,
				start_cursor=edges[0].cursor if edges else None,
				end_cursor=edges[-1].cursor if edges else None
			),
			total_count=len(sample_docs)
		)
	
	@strawberry.field(permission_classes=[IsAuthenticated])
	async def document(
		self,
		info: Info,
		document_id: str
	) -> Optional[Document]:
		"""Get document by ID"""
		# Check permissions
		context = info.context
		user = context.get("user")
		security_manager = context.get("security_manager")
		
		if security_manager:
			auth_result = await security_manager.check_document_permission(
				document_id, user["user_id"], "view", {}
			)
			if not auth_result.get("has_permission", False):
				return None
		
		# Return sample document
		return Document(
			document_id=document_id,
			title="Sample Document",
			content="This is sample document content",
			status=DocumentStatus.PUBLISHED,
			document_type=DocumentType.PROPOSAL,
			created_by="user123",
			created_at=datetime.now(timezone.utc),
			updated_at=datetime.now(timezone.utc)
		)
	
	@strawberry.field(permission_classes=[IsAuthenticated])
	async def search(
		self,
		info: Info,
		search_input: SearchInput
	) -> SearchResults:
		"""Advanced search with complex queries"""
		context = info.context
		search_engine = context.get("search_engine")
		user = context.get("user")
		
		if not search_engine or not user:
			return SearchResults(
				query=search_input.query,
				total_results=0,
				page=search_input.page,
				per_page=search_input.per_page,
				total_pages=0,
				results=[],
				search_id=uuid7str(),
				timestamp=datetime.now(timezone.utc)
			)
		
		# Convert GraphQL input to search request
		search_request = SearchRequest(
			query=search_input.query,
			scope=SearchScope(search_input.scope.value),
			mode=SearchMode(search_input.mode.value),
			page=search_input.page,
			per_page=search_input.per_page,
			highlight=search_input.highlight,
			include_suggestions=search_input.include_suggestions
		)
		
		# Execute search
		try:
			search_response = await search_engine.search(
				search_request,
				user["user_id"],
				{"user_id": user["user_id"]}
			)
			
			# Convert results
			results = [
				SearchResult(
					document_id=result.id,
					title=result.title,
					excerpt=result.excerpt,
					score=result.score,
					highlights=[
						SearchHighlight(field=h.field, fragments=h.fragments)
						for h in (result.highlights or [])
					]
				) for result in search_response.results
			]
			
			return SearchResults(
				query=search_response.query,
				total_results=search_response.total_results,
				page=search_response.page,
				per_page=search_response.per_page,
				total_pages=search_response.total_pages,
				results=results,
				search_id=search_response.search_id,
				timestamp=search_response.timestamp
			)
			
		except Exception as e:
			logging.error(f"GraphQL search failed: {e}")
			return SearchResults(
				query=search_input.query,
				total_results=0,
				page=search_input.page,
				per_page=search_input.per_page,
				total_pages=0,
				results=[],
				search_id=uuid7str(),
				timestamp=datetime.now(timezone.utc)
			)
	
	@strawberry.field(permission_classes=[IsAuthenticated])
	async def document_comments(
		self,
		info: Info,
		document_id: str,
		limit: int = 50
	) -> List[Comment]:
		"""Get document comments"""
		# In production, would fetch from comment service
		return []
	
	@strawberry.field(permission_classes=[IsAuthenticated])
	async def document_analytics(
		self,
		info: Info,
		document_id: str,
		days: int = 30
	) -> DocumentAnalytics:
		"""Get document analytics"""
		# Check permissions
		context = info.context
		user = context.get("user")
		security_manager = context.get("security_manager")
		
		if security_manager:
			auth_result = await security_manager.check_document_permission(
				document_id, user["user_id"], "analytics", {}
			)
			if not auth_result.get("has_permission", False):
				raise Exception("Permission denied")
		
		# Return sample analytics
		return DocumentAnalytics(
			document_id=document_id,
			views=[
				AnalyticsData(
					timestamp=datetime.now(timezone.utc) - timedelta(days=i),
					value=float(10 + i * 2)
				) for i in range(days)
			],
			total_views=100,
			total_edits=25,
			total_collaborators=5
		)
	
	@strawberry.field(permission_classes=[require_permission("system", "read")])
	async def system_analytics(
		self,
		info: Info,
		days: int = 30
	) -> Dict[str, Any]:
		"""Get system-wide analytics"""
		# In production, would fetch from analytics service
		return {
			"total_documents": 1000,
			"total_users": 100,
			"daily_active_users": 50,
			"search_queries_today": 200
		}

# ==================== MUTATIONS ====================

@strawberry.type
class Mutation:
	"""GraphQL mutations"""
	
	@strawberry.field(permission_classes=[require_permission("document", "create")])
	async def create_document(
		self,
		info: Info,
		input: DocumentInput
	) -> Document:
		"""Create new document"""
		context = info.context
		user = context.get("user")
		
		document_id = uuid7str()
		
		# In production, would save to database and index in search
		document = Document(
			document_id=document_id,
			title=input.title,
			content=input.content,
			status=DocumentStatus.DRAFT,
			document_type=input.document_type,
			created_by=user["user_id"],
			created_at=datetime.now(timezone.utc),
			updated_at=datetime.now(timezone.utc),
			tags=[Tag(name=tag) for tag in input.tags]
		)
		
		# Index in search engine
		search_engine = context.get("search_engine")
		if search_engine:
			try:
				await search_engine.index_document(
					document_id,
					input.title,
					input.content,
					{
						"type": input.document_type.value,
						"author": user["user_id"],
						"tags": input.tags,
						"created_at": document.created_at.isoformat(),
						"status": DocumentStatus.DRAFT.value
					}
				)
			except Exception as e:
				logging.error(f"Failed to index document: {e}")
		
		return document
	
	@strawberry.field(permission_classes=[IsAuthenticated])
	async def update_document(
		self,
		info: Info,
		document_id: str,
		input: DocumentInput
	) -> Optional[Document]:
		"""Update existing document"""
		context = info.context
		user = context.get("user")
		security_manager = context.get("security_manager")
		
		# Check permissions
		if security_manager:
			auth_result = await security_manager.check_document_permission(
				document_id, user["user_id"], "edit", {}
			)
			if not auth_result.get("has_permission", False):
				raise Exception("Permission denied")
		
		# In production, would update in database and re-index
		document = Document(
			document_id=document_id,
			title=input.title,
			content=input.content,
			status=DocumentStatus.DRAFT,
			document_type=input.document_type,
			created_by=user["user_id"],
			created_at=datetime.now(timezone.utc) - timedelta(days=1),
			updated_at=datetime.now(timezone.utc),
			tags=[Tag(name=tag) for tag in input.tags]
		)
		
		return document
	
	@strawberry.field(permission_classes=[IsAuthenticated])
	async def delete_document(
		self,
		info: Info,
		document_id: str
	) -> bool:
		"""Delete document"""
		context = info.context
		user = context.get("user")
		security_manager = context.get("security_manager")
		
		# Check permissions
		if security_manager:
			auth_result = await security_manager.check_document_permission(
				document_id, user["user_id"], "delete", {}
			)
			if not auth_result.get("has_permission", False):
				raise Exception("Permission denied")
		
		# In production, would mark as deleted and remove from search index
		search_engine = context.get("search_engine")
		if search_engine:
			try:
				await search_engine.delete_document(document_id)
			except Exception as e:
				logging.error(f"Failed to delete document from search: {e}")
		
		return True
	
	@strawberry.field(permission_classes=[IsAuthenticated])
	async def add_comment(
		self,
		info: Info,
		input: CommentInput
	) -> Comment:
		"""Add comment to document"""
		context = info.context
		user = context.get("user")
		security_manager = context.get("security_manager")
		
		# Check document permissions
		if security_manager:
			auth_result = await security_manager.check_document_permission(
				input.document_id, user["user_id"], "comment", {}
			)
			if not auth_result.get("has_permission", False):
				raise Exception("Permission denied")
		
		# Create comment
		comment = Comment(
			comment_id=uuid7str(),
			document_id=input.document_id,
			content=input.content,
			created_by=user["user_id"],
			created_at=datetime.now(timezone.utc),
			parent_id=input.parent_id,
			position=input.position
		)
		
		return comment
	
	@strawberry.field(permission_classes=[require_permission("search", "index")])
	async def reindex_document(
		self,
		info: Info,
		document_id: str
	) -> bool:
		"""Reindex document in search engine"""
		context = info.context
		search_engine = context.get("search_engine")
		
		if not search_engine:
			return False
		
		# In production, would fetch document from database and reindex
		try:
			await search_engine.index_document(
				document_id,
				"Sample Document",
				"Sample content for reindexing",
				{
					"type": "proposal",
					"author": "user123",
					"reindexed_at": datetime.now(timezone.utc).isoformat()
				}
			)
			return True
		except Exception as e:
			logging.error(f"Reindexing failed: {e}")
			return False

# ==================== SUBSCRIPTIONS ====================

@strawberry.type
class Subscription:
	"""GraphQL subscriptions for real-time updates"""
	
	@strawberry.subscription(permission_classes=[IsAuthenticated])
	async def document_updates(
		self,
		info: Info,
		document_id: str
	) -> Document:
		"""Subscribe to document updates"""
		# In production, would use WebSocket connection manager
		# For now, just yield sample updates periodically
		
		while True:
			await asyncio.sleep(30)  # Wait 30 seconds between updates
			
			yield Document(
				document_id=document_id,
				title="Updated Document",
				content=f"Document updated at {datetime.now(timezone.utc)}",
				status=DocumentStatus.PUBLISHED,
				document_type=DocumentType.PROPOSAL,
				created_by="user123",
				created_at=datetime.now(timezone.utc),
				updated_at=datetime.now(timezone.utc)
			)
	
	@strawberry.subscription(permission_classes=[IsAuthenticated])
	async def collaboration_events(
		self,
		info: Info,
		document_id: str
	) -> str:
		"""Subscribe to collaboration events"""
		# In production, would integrate with WebSocket connection manager
		
		while True:
			await asyncio.sleep(10)
			yield f"User activity on document {document_id} at {datetime.now(timezone.utc)}"
	
	@strawberry.subscription(permission_classes=[IsAuthenticated])
	async def search_analytics(
		self,
		info: Info
	) -> Dict[str, Any]:
		"""Subscribe to search analytics updates"""
		
		while True:
			await asyncio.sleep(60)  # Update every minute
			
			yield {
				"timestamp": datetime.now(timezone.utc),
				"total_searches": 1000,
				"active_users": 50,
				"popular_queries": ["proposal", "template", "report"]
			}

# ==================== SCHEMA ====================

def create_graphql_schema(security_manager: SecurityManager):
	"""Create GraphQL schema with security integration"""
	
	schema = strawberry.Schema(
		query=Query,
		mutation=Mutation,
		subscription=Subscription
	)
	
	return schema
