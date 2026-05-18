#!/usr/bin/env python3
"""
GraphQL Endpoint Integration

FastAPI integration for GraphQL with authentication, subscriptions,
and comprehensive error handling.
"""

import logging
from typing import Dict, Any

from fastapi import APIRouter, Request, WebSocket
from fastapi.responses import HTMLResponse

try:
	import strawberry
	from strawberry.fastapi import GraphQLRouter
	from strawberry.subscriptions import GRAPHQL_WS_PROTOCOL
except ImportError:
	strawberry = None
	GraphQLRouter = None

from .schema import create_graphql_schema, build_graphql_context
from ...security import SecurityManager


class GraphQLEndpoints:
	"""GraphQL endpoint management"""
	
	def __init__(self, security_manager: SecurityManager, search_engine=None):
		self.security = security_manager
		self.search_engine = search_engine
		self.logger = logging.getLogger(__name__)
		
		if strawberry is None or GraphQLRouter is None:
			raise ImportError("strawberry-graphql is required for GraphQL support")
		
		# Create GraphQL schema
		self.schema = create_graphql_schema(security_manager)
		
		# Create GraphQL router
		self.graphql_router = GraphQLRouter(
			schema=self.schema,
			context_getter=self._get_context,
			subscription_protocols=[GRAPHQL_WS_PROTOCOL]
		)
		
		# Create FastAPI router
		self.router = APIRouter(prefix="/api/v1/graphql", tags=["graphql"])
		
		# Register endpoints
		self._register_endpoints()
		
		self.logger.info("GraphQL endpoints initialized")
	
	def _register_endpoints(self):
		"""Register GraphQL endpoints"""
		
		@self.router.get("/playground", response_class=HTMLResponse)
		async def graphql_playground():
			"""GraphQL Playground IDE"""
			return """
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>GraphQL Playground</title>
				<link rel="shortcut icon" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/favicon.png" />
				<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/css/index.css" />
			</head>
			<body>
				<div id="root">
					<style>
						body { margin: 0; font-family: Open Sans, sans-serif; overflow: hidden; }
						#root { height: 100vh; }
					</style>
					<div class="loading">Loading...</div>
				</div>
				<script>window.GraphQLPlayground.init(document.getElementById('root'), {
					endpoint: '/api/v1/graphql',
					subscriptionEndpoint: 'ws://localhost:8000/api/v1/graphql/ws',
					settings: {
						'general.betaUpdates': false,
						'editor.cursorShape': 'line',
						'editor.theme': 'dark',
						'editor.reuseHeaders': true,
						'tracing.hideTracingResponse': true,
						'queryPlan.hideQueryPlanResponse': true,
						'editor.fontSize': 14,
					},
					tabs: [{
						endpoint: '/api/v1/graphql',
						query: `# Welcome to GraphQL Playground
# GraphQL is a query language for APIs and a runtime for fulfilling those queries with your existing data.
# GraphQL provides a complete and understandable description of the data in your API, 
# gives clients the power to ask for exactly what they need and nothing more.

# Try this sample query:
query GetDocuments {
  documents(first: 10) {
    edges {
      node {
        documentId
        title
        status
        documentType
        createdAt
        author {
          username
          email
        }
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
    totalCount
  }
}

# Or try a search query:
query SearchDocuments {
  search(searchInput: {
    query: "proposal",
    scope: DOCUMENTS,
    mode: FULL_TEXT,
    page: 1,
    perPage: 5
  }) {
    query
    totalResults
    results {
      documentId
      title
      excerpt
      score
      highlights {
        field
        fragments
      }
    }
  }
}

# For mutations, you can create a document:
mutation CreateDocument {
  createDocument(input: {
    title: "My New Proposal",
    content: "This is the content of my proposal...",
    documentType: PROPOSAL,
    tags: ["important", "draft"]
  }) {
    documentId
    title
    status
    createdAt
  }
}`
					}]
				})</script>
				<script src="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/middleware.js"></script>
			</body>
			</html>
			"""
		
		@self.router.get("/schema.graphql")
		async def get_schema():
			"""Get GraphQL schema SDL"""
			return {"schema": strawberry.export_schema.get_schema_from_ast(self.schema.as_str())}
		
		@self.router.get("/introspection")
		async def get_introspection():
			"""Get GraphQL introspection query result"""
			from strawberry.schema.introspection import get_introspection_query_from_schema
			return get_introspection_query_from_schema(self.schema)
		
		# Mount GraphQL router
		self.router.mount("", self.graphql_router)
	
	async def _get_context(self, request: Request = None, websocket: WebSocket = None) -> Dict[str, Any]:
		"""Build GraphQL context for requests"""
		try:
			context = await build_graphql_context(
				request or websocket,
				self.security,
				self.search_engine
			)
			
			# Add WebSocket-specific context
			if websocket:
				context["websocket"] = websocket
			
			return context
			
		except Exception as e:
			self.logger.error(f"Context building failed: {e}")
			return {
				"request": request or websocket,
				"security_manager": self.security,
				"search_engine": self.search_engine
			}
	
	def get_router(self) -> APIRouter:
		"""Get the configured FastAPI router"""
		return self.router


# Factory function
def create_graphql_endpoints(security_manager: SecurityManager, search_engine=None) -> GraphQLEndpoints:
	"""Create GraphQL endpoints with security and search integration"""
	return GraphQLEndpoints(security_manager, search_engine)
