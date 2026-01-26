#!/usr/bin/env python3
"""
GraphQL Integration Example

Example showing how to integrate and use the GraphQL API for complex document queries,
mutations, and real-time subscriptions.
"""

import asyncio
import json
import logging
from typing import Dict, Any
from datetime import datetime

try:
	import httpx
	import websockets
except ImportError:
	print("Please install httpx and websockets: pip install httpx websockets")
	exit(1)


class GraphQLClient:
	"""GraphQL client for API interactions"""
	
	def __init__(self, endpoint: str = "http://localhost:8000/api/v1/graphql", 
	             ws_endpoint: str = "ws://localhost:8000/api/v1/graphql/ws"):
		self.endpoint = endpoint
		self.ws_endpoint = ws_endpoint
		self.auth_token = None
		self.logger = logging.getLogger(__name__)
	
	def set_auth_token(self, token: str):
		"""Set authentication token"""
		self.auth_token = token
	
	async def query(self, query: str, variables: Dict[str, Any] = None) -> Dict[str, Any]:
		"""Execute GraphQL query"""
		headers = {"Content-Type": "application/json"}
		if self.auth_token:
			headers["Authorization"] = f"Bearer {self.auth_token}"
		
		payload = {"query": query}
		if variables:
			payload["variables"] = variables
		
		async with httpx.AsyncClient() as client:
			response = await client.post(
				self.endpoint,
				json=payload,
				headers=headers
			)
			return response.json()
	
	async def subscribe(self, subscription: str, variables: Dict[str, Any] = None):
		"""Execute GraphQL subscription"""
		payload = {
			"type": "start",
			"payload": {
				"query": subscription,
				"variables": variables or {}
			}
		}
		
		headers = {}
		if self.auth_token:
			headers["Authorization"] = f"Bearer {self.auth_token}"
		
		async with websockets.connect(
			self.ws_endpoint,
			subprotocols=["graphql-ws"],
			extra_headers=headers
		) as websocket:
			# Send connection init
			await websocket.send(json.dumps({"type": "connection_init"}))
			
			# Wait for connection ack
			response = await websocket.recv()
			init_response = json.loads(response)
			
			if init_response.get("type") != "connection_ack":
				raise Exception("Failed to initialize WebSocket connection")
			
			# Send subscription
			await websocket.send(json.dumps(payload))
			
			# Listen for messages
			try:
				async for message in websocket:
					data = json.loads(message)
					if data.get("type") == "data":
						yield data.get("payload")
					elif data.get("type") == "error":
						self.logger.error(f"Subscription error: {data}")
						break
					elif data.get("type") == "complete":
						break
			except websockets.exceptions.ConnectionClosed:
				self.logger.info("WebSocket connection closed")


async def example_queries():
	"""Example GraphQL queries"""
	client = GraphQLClient()
	
	print("=== GraphQL Query Examples ===\n")
	
	# 1. Get paginated documents
	print("1. Getting paginated documents...")
	documents_query = """
	query GetDocuments($first: Int, $filters: DocumentFilters) {
		documents(first: $first, filters: $filters) {
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
					commentsCount
					isFavorite
				}
				cursor
			}
			pageInfo {
				hasNextPage
				hasPreviousPage
				startCursor
				endCursor
			}
			totalCount
		}
	}
	"""
	
	result = await client.query(documents_query, {
		"first": 10,
		"filters": {
			"status": ["PUBLISHED", "DRAFT"],
			"documentType": ["PROPOSAL"]
		}
	})
	
	if "errors" in result:
		print(f"Query error: {result['errors']}")
	else:
		documents = result["data"]["documents"]
		print(f"Found {documents['totalCount']} documents")
		for edge in documents["edges"][:3]:  # Show first 3
			doc = edge["node"]
			print(f"- {doc['title']} ({doc['status']}) by {doc['author']['username']}")
	
	print()
	
	# 2. Advanced search
	print("2. Performing advanced search...")
	search_query = """
	query SearchDocuments($searchInput: SearchInput!) {
		search(searchInput: $searchInput) {
			query
			totalResults
			page
			totalPages
			results {
				documentId
				title
				excerpt
				score
				highlights {
					field
					fragments
				}
				document {
					documentType
					status
					createdAt
					author {
						username
					}
				}
			}
		}
	}
	"""
	
	result = await client.query(search_query, {
		"searchInput": {
			"query": "proposal template",
			"scope": "DOCUMENTS",
			"mode": "FULL_TEXT",
			"page": 1,
			"perPage": 5,
			"highlight": True,
			"filters": {
				"documentType": ["PROPOSAL", "TEMPLATE"],
				"createdAfter": "2024-01-01T00:00:00Z"
			}
		}
	})
	
	if "errors" in result:
		print(f"Search error: {result['errors']}")
	else:
		search_results = result["data"]["search"]
		print(f"Search '{search_results['query']}' found {search_results['totalResults']} results")
		for result_item in search_results["results"]:
			print(f"- {result_item['title']} (score: {result_item['score']:.2f})")
			if result_item["highlights"]:
				for highlight in result_item["highlights"]:
					print(f"  Highlighted in {highlight['field']}: {highlight['fragments'][0][:100]}...")
	
	print()
	
	# 3. Get document with analytics
	print("3. Getting document analytics...")
	analytics_query = """
	query GetDocumentAnalytics($documentId: String!, $days: Int) {
		document(documentId: $documentId) {
			documentId
			title
			status
			createdAt
		}
		documentAnalytics(documentId: $documentId, days: $days) {
			documentId
			totalViews
			totalEdits
			totalCollaborators
			views {
				timestamp
				value
			}
		}
	}
	"""
	
	result = await client.query(analytics_query, {
		"documentId": "doc_1",
		"days": 7
	})
	
	if "errors" in result:
		print(f"Analytics error: {result['errors']}")
	else:
		document = result["data"]["document"]
		analytics = result["data"]["documentAnalytics"]
		if document and analytics:
			print(f"Document: {document['title']}")
			print(f"Total views: {analytics['totalViews']}")
			print(f"Total edits: {analytics['totalEdits']}")
			print(f"Recent activity: {len(analytics['views'])} data points")
	
	print()


async def example_mutations():
	"""Example GraphQL mutations"""
	client = GraphQLClient()
	client.set_auth_token("sample_jwt_token")  # In production, get from auth
	
	print("=== GraphQL Mutation Examples ===\n")
	
	# 1. Create document
	print("1. Creating a new document...")
	create_mutation = """
	mutation CreateDocument($input: DocumentInput!) {
		createDocument(input: $input) {
			documentId
			title
			status
			documentType
			createdAt
			createdBy
			tags {
				name
			}
		}
	}
	"""
	
	result = await client.query(create_mutation, {
		"input": {
			"title": "My GraphQL Test Document",
			"content": "This document was created using GraphQL mutations!",
			"documentType": "PROPOSAL",
			"tags": ["graphql", "test", "api"]
		}
	})
	
	if "errors" in result:
		print(f"Create error: {result['errors']}")
	else:
		document = result["data"]["createDocument"]
		print(f"Created document: {document['title']} (ID: {document['documentId']})")
		document_id = document['documentId']
	
	print()
	
	# 2. Update document
	print("2. Updating the document...")
	update_mutation = """
	mutation UpdateDocument($documentId: String!, $input: DocumentInput!) {
		updateDocument(documentId: $documentId, input: $input) {
			documentId
			title
			status
			updatedAt
		}
	}
	"""
	
	if 'document_id' in locals():
		result = await client.query(update_mutation, {
			"documentId": document_id,
			"input": {
				"title": "My Updated GraphQL Test Document",
				"content": "This document was updated using GraphQL mutations!",
				"documentType": "PROPOSAL",
				"tags": ["graphql", "test", "api", "updated"]
			}
		})
		
		if "errors" in result:
			print(f"Update error: {result['errors']}")
		else:
			document = result["data"]["updateDocument"]
			if document:
				print(f"Updated document: {document['title']}")
	
	print()
	
	# 3. Add comment
	print("3. Adding a comment...")
	comment_mutation = """
	mutation AddComment($input: CommentInput!) {
		addComment(input: $input) {
			commentId
			content
			createdAt
			author {
				username
			}
		}
	}
	"""
	
	if 'document_id' in locals():
		result = await client.query(comment_mutation, {
			"input": {
				"documentId": document_id,
				"content": "This is a test comment added via GraphQL!",
				"position": json.dumps({"line": 1, "character": 10})
			}
		})
		
		if "errors" in result:
			print(f"Comment error: {result['errors']}")
		else:
			comment = result["data"]["addComment"]
			print(f"Added comment: {comment['content'][:50]}...")
	
	print()


async def example_subscriptions():
	"""Example GraphQL subscriptions"""
	client = GraphQLClient()
	client.set_auth_token("sample_jwt_token")
	
	print("=== GraphQL Subscription Examples ===\n")
	
	print("Subscribing to document updates (will run for 30 seconds)...")
	
	# Document updates subscription
	document_subscription = """
	subscription DocumentUpdates($documentId: String!) {
		documentUpdates(documentId: $documentId) {
			documentId
			title
			status
			updatedAt
		}
	}
	"""
	
	try:
		timeout = asyncio.create_task(asyncio.sleep(30))  # 30 second timeout
		subscription_task = asyncio.create_task(
			client.subscribe(document_subscription, {"documentId": "doc_1"})
		)
		
		done, pending = await asyncio.wait(
			[timeout, subscription_task],
			return_when=asyncio.FIRST_COMPLETED
		)
		
		if timeout in done:
			print("Subscription timed out")
			subscription_task.cancel()
		else:
			async for update in subscription_task:
				print(f"Document update received: {update}")
				
	except Exception as e:
		print(f"Subscription error: {e}")
	
	print()


async def complex_query_examples():
	"""Examples of complex GraphQL queries"""
	client = GraphQLClient()
	
	print("=== Complex GraphQL Query Examples ===\n")
	
	# 1. Multi-faceted search with nested data
	print("1. Complex search with nested relationships...")
	complex_search = """
	query ComplexSearch($searchInput: SearchInput!) {
		search(searchInput: $searchInput) {
			query
			totalResults
			results {
				documentId
				title
				score
				document {
					documentType
					status
					createdAt
					author {
						username
						email
						fullName
					}
					collaborators {
						username
						fullName
					}
					tags {
						name
						color
					}
					commentsCount
					isFavorite
				}
			}
		}
	}
	"""
	
	result = await client.query(complex_search, {
		"searchInput": {
			"query": "important project",
			"scope": "ALL",
			"mode": "SEMANTIC",
			"filters": {
				"status": ["PUBLISHED"],
				"createdAfter": "2024-01-01T00:00:00Z",
				"tags": ["important", "project"]
			},
			"sort": {
				"field": "UPDATED_AT",
				"order": "DESC"
			},
			"highlight": True,
			"includeSuggestions": True
		}
	})
	
	if "errors" not in result:
		search_data = result["data"]["search"]
		print(f"Complex search returned {search_data['totalResults']} results")
		for item in search_data["results"][:2]:
			doc = item["document"]
			print(f"- {doc['documentType']}: {item['title']}")
			print(f"  Author: {doc['author']['fullName'] or doc['author']['username']}")
			print(f"  Collaborators: {len(doc['collaborators'])}")
			print(f"  Tags: {[tag['name'] for tag in doc['tags']]}")
	
	print()
	
	# 2. Batch query multiple documents with analytics
	print("2. Batch query with analytics...")
	batch_query = """
	query BatchDocumentQuery($documentIds: [String!]!) {
		batchDocuments: documents(filters: {documentIds: $documentIds}) {
			edges {
				node {
					documentId
					title
					status
					author {
						username
					}
				}
			}
		}
		
		systemAnalytics(days: 7) {
			totalDocuments
			totalUsers
			dailyActiveUsers
			searchQueriesToday
		}
	}
	"""
	
	# Note: This query uses features that would need to be implemented in the schema
	print("This query demonstrates batch operations and system analytics")
	print("(Implementation would require extending the schema)")
	
	print()


async def main():
	"""Main example runner"""
	print("GraphQL Integration Examples")
	print("=" * 50)
	print()
	
	try:
		# Run query examples
		await example_queries()
		
		# Run mutation examples (requires authentication)
		await example_mutations()
		
		# Run subscription examples (requires WebSocket support)
		print("Note: Subscription examples require a running server with WebSocket support")
		# await example_subscriptions()
		
		# Show complex query patterns
		await complex_query_examples()
		
	except Exception as e:
		print(f"Example error: {e}")
		logging.exception("Example execution failed")
	
	print("\n" + "=" * 50)
	print("GraphQL Integration Examples Complete")
	print("\nTo run with a live server:")
	print("1. Start the FastAPI server with GraphQL endpoints")
	print("2. Visit http://localhost:8000/api/v1/graphql/playground")
	print("3. Try the example queries interactively")


if __name__ == "__main__":
	logging.basicConfig(level=logging.INFO)
	asyncio.run(main())