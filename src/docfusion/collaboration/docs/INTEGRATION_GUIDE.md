# Integration Guide: Real-Time Collaboration System

## Overview

This guide provides comprehensive information about integrating the Real-Time Collaboration System with existing applications, document engines, and third-party services.

## 🔌 Integration Architecture

### High-Level Integration Points

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Your Application                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │   Frontend   │  │   Backend    │  │  Document    │  │Compliance│ │
│  │     UI       │  │    API       │  │   Engine     │  │ System   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                    Collaboration Integration Layer                  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │Collaborative │  │   Version    │  │   Conflict   │  │WebSocket │ │
│  │   Editor     │  │  Manager     │  │ Resolution   │  │ Handler  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Core Integration Components

1. **CollaborationIntegrator**: Main integration API
2. **WebSocket Handler**: Real-time communication
3. **Event System**: Pluggable event handling
4. **Storage Adapter**: Persistent storage integration
5. **Authentication Adapter**: User authentication integration

## 🚀 Quick Integration Setup

### Basic Integration

```python
from proposal_writer.collaboration.integration.collaboration_integration import (
    CollaborationIntegrator, CollaborationSettings
)

class MyApplication:
    def __init__(self):
        # Initialize collaboration system
        self.collaboration = CollaborationIntegrator(
            storage_path="./collaboration_data",
            document_renderer=self.document_renderer,
            document_processor=self.document_processor
        )
        
        # Configure for your application
        self.default_settings = CollaborationSettings(
            max_concurrent_users=20,
            auto_save_interval=30,
            version_control_enabled=True,
            real_time_sync_enabled=True
        )
    
    async def create_collaborative_document(self, title: str, content: str, creator_id: str):
        """Create collaborative document integrated with your app"""
        doc = await self.collaboration.create_collaborative_document(
            title=title,
            initial_content=content,
            settings=self.default_settings,
            creator_id=creator_id
        )
        
        # Register with your application's document system
        await self.register_document_in_app(doc)
        
        return doc
    
    async def register_document_in_app(self, doc):
        """Integrate document with your application logic"""
        # Example: Save to your database
        await self.db.documents.insert({
            "collaboration_id": doc.document_id,
            "title": doc.title,
            "created_at": doc.created_at,
            "collaboration_enabled": True
        })
```

### WebSocket Integration

```python
from aiohttp import web, WSMsgType
import json

class CollaborationWebSocketHandler:
    def __init__(self, collaboration_integrator: CollaborationIntegrator):
        self.collaboration = collaboration_integrator
        self.active_connections = {}
    
    async def websocket_handler(self, request):
        """Handle WebSocket connections for real-time collaboration"""
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        
        # Get user and document from request
        user_id = request.headers.get('User-ID')
        document_id = request.match_info.get('document_id')
        
        if not user_id or not document_id:
            await ws.close(code=4000, message='Missing user_id or document_id')
            return ws
        
        # Register connection
        self.active_connections[f"{document_id}:{user_id}"] = ws
        
        try:
            # Subscribe to document changes
            subscription_id = await self._subscribe_to_document(document_id, user_id, ws)
            
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    await self._handle_websocket_message(msg.data, document_id, user_id)
                elif msg.type == WSMsgType.ERROR:
                    print(f'WebSocket error: {ws.exception()}')
        
        finally:
            # Cleanup connection
            connection_key = f"{document_id}:{user_id}"
            if connection_key in self.active_connections:
                del self.active_connections[connection_key]
        
        return ws
    
    async def _subscribe_to_document(self, document_id: str, user_id: str, ws):
        """Subscribe to document events for WebSocket broadcasting"""
        async def broadcast_to_websocket(event_type: str, event_data):
            try:
                message = {
                    "type": event_type,
                    "data": event_data,
                    "timestamp": time.time()
                }
                await ws.send_str(json.dumps(message))
            except Exception as e:
                print(f"WebSocket broadcast error: {e}")
        
        # Subscribe to collaborative editor events
        session = self.collaboration.collaborative_sessions.get(document_id)
        if session:
            editor = await session.get_session(document_id)
            if editor:
                return await editor.subscribe_to_changes(broadcast_to_websocket)
    
    async def _handle_websocket_message(self, message_data: str, document_id: str, user_id: str):
        """Handle incoming WebSocket messages"""
        try:
            message = json.loads(message_data)
            message_type = message.get('type')
            
            if message_type == 'edit':
                await self._handle_edit_message(message, document_id, user_id)
            elif message_type == 'cursor':
                await self._handle_cursor_message(message, document_id, user_id)
            elif message_type == 'comment':
                await self._handle_comment_message(message, document_id, user_id)
            
        except json.JSONDecodeError:
            print(f"Invalid JSON message from user {user_id}")
        except Exception as e:
            print(f"Error handling WebSocket message: {e}")
    
    async def _handle_edit_message(self, message: Dict, document_id: str, user_id: str):
        """Handle document edit via WebSocket"""
        content = message.get('content', '')
        position = message.get('position')
        length = message.get('length')
        
        await self.collaboration.edit_document(
            document_id, user_id, content, position, length
        )
    
    async def _handle_cursor_message(self, message: Dict, document_id: str, user_id: str):
        """Handle cursor position update via WebSocket"""
        session = self.collaboration.collaborative_sessions.get(document_id)
        if session:
            editor = await session.get_session(document_id)
            if editor:
                await editor.update_cursor(
                    user_id,
                    message.get('position', 0),
                    message.get('selection_start'),
                    message.get('selection_end')
                )

# Setup WebSocket route
def setup_websocket_routes(app, collaboration_integrator):
    ws_handler = CollaborationWebSocketHandler(collaboration_integrator)
    app.router.add_get('/ws/collaboration/{document_id}', ws_handler.websocket_handler)
```

## 🔧 Document Engine Integration

### Document Processor Integration

```python
class DocumentEngineIntegration:
    def __init__(self, collaboration_integrator: CollaborationIntegrator):
        self.collaboration = collaboration_integrator
        self.document_processor = self._create_document_processor()
        
        # Hook into collaboration events
        self._setup_collaboration_hooks()
    
    def _create_document_processor(self):
        """Create document processor with collaboration hooks"""
        
        class CollaborationAwareProcessor:
            def __init__(self, collaboration_system):
                self.collaboration = collaboration_system
            
            async def process_document(self, document_id: str, content: str) -> str:
                """Process document with collaboration awareness"""
                # Pre-processing hooks
                await self._pre_process_hooks(document_id, content)
                
                # Core document processing
                processed_content = await self._core_processing(content)
                
                # Post-processing hooks
                await self._post_process_hooks(document_id, processed_content)
                
                return processed_content
            
            async def _pre_process_hooks(self, document_id: str, content: str):
                """Pre-processing hooks for collaboration"""
                # Check for active collaborative sessions
                active_users = await self.collaboration.get_active_users(document_id)
                if active_users:
                    print(f"Processing document with {len(active_users)} active collaborators")
                
                # Validate collaboration state
                status = await self.collaboration.get_document_status(document_id)
                if status['conflicts_resolved'] < status['total_operations'] * 0.95:
                    print("Warning: Document has unresolved conflicts")
            
            async def _core_processing(self, content: str) -> str:
                """Core document processing logic"""
                # Your existing document processing logic here
                # Example: Format conversion, compliance checking, etc.
                processed = content.upper()  # Example transformation
                return processed
            
            async def _post_process_hooks(self, document_id: str, content: str):
                """Post-processing hooks for collaboration"""
                # Update collaborative document with processed content
                # Note: This should be done carefully to avoid conflicts
                pass
        
        return CollaborationAwareProcessor(self.collaboration)
    
    def _setup_collaboration_hooks(self):
        """Setup hooks into collaboration system"""
        # Override edit_document to include processing
        original_edit = self.collaboration.edit_document
        
        async def collaborative_edit_with_processing(doc_id, user_id, content, *args, **kwargs):
            # Pre-edit processing
            if self._should_process_content(content):
                content = await self.document_processor.process_document(doc_id, content)
            
            # Perform collaborative edit
            result = await original_edit(doc_id, user_id, content, *args, **kwargs)
            
            # Post-edit hooks
            await self._post_edit_processing(doc_id, result)
            
            return result
        
        self.collaboration.edit_document = collaborative_edit_with_processing
    
    def _should_process_content(self, content: str) -> bool:
        """Determine if content should be processed"""
        # Example: Only process content that has changed significantly
        return len(content) > 100  # Simple example
    
    async def _post_edit_processing(self, document_id: str, edit_result: Dict):
        """Post-edit processing hooks"""
        if edit_result.get('success'):
            # Trigger any post-edit workflows
            await self._trigger_post_edit_workflows(document_id, edit_result)
    
    async def _trigger_post_edit_workflows(self, document_id: str, edit_result: Dict):
        """Trigger workflows after successful edit"""
        # Example: Auto-save, backup, notifications, etc.
        pass
```

### Compliance Integration

```python
from typing import Optional

class ComplianceIntegration:
    def __init__(self, collaboration_integrator: CollaborationIntegrator, compliance_system):
        self.collaboration = collaboration_integrator
        self.compliance_system = compliance_system
        
        # Setup compliance hooks
        self._setup_compliance_hooks()
    
    def _setup_compliance_hooks(self):
        """Setup compliance checking hooks"""
        original_edit = self.collaboration.edit_document
        
        async def edit_with_compliance_check(doc_id, user_id, content, *args, **kwargs):
            # Pre-edit compliance check
            compliance_result = await self._check_compliance_pre_edit(doc_id, content)
            
            if not compliance_result['allowed']:
                return {
                    "success": False,
                    "error": "Compliance violation detected",
                    "compliance_issues": compliance_result['issues']
                }
            
            # Perform edit
            result = await original_edit(doc_id, user_id, content, *args, **kwargs)
            
            # Post-edit compliance validation
            if result['success']:
                post_compliance = await self._check_compliance_post_edit(doc_id, content)
                result['compliance_status'] = post_compliance
            
            return result
        
        self.collaboration.edit_document = edit_with_compliance_check
    
    async def _check_compliance_pre_edit(self, document_id: str, content: str) -> Dict[str, Any]:
        """Pre-edit compliance checking"""
        try:
            # Check content against compliance rules
            compliance_result = await self.compliance_system.validate_content(content)
            
            return {
                "allowed": compliance_result.score > 0.7,  # 70% compliance threshold
                "score": compliance_result.score,
                "issues": compliance_result.violations[:5]  # Top 5 issues
            }
        
        except Exception as e:
            # Allow edit if compliance system fails
            return {
                "allowed": True,
                "error": str(e)
            }
    
    async def _check_compliance_post_edit(self, document_id: str, content: str) -> Dict[str, Any]:
        """Post-edit compliance validation"""
        try:
            compliance_result = await self.compliance_system.validate_content(content)
            
            return {
                "compliant": compliance_result.score > 0.8,
                "score": compliance_result.score,
                "recommendations": compliance_result.recommendations
            }
        
        except Exception as e:
            return {
                "compliant": False,
                "error": str(e)
            }
```

## 🗄️ Database Integration

### Document Storage Integration

```python
from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import asyncio

Base = declarative_base()

class CollaborativeDocument(Base):
    __tablename__ = 'collaborative_documents'
    
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    content = Column(Text)
    version = Column(Integer, default=1)
    status = Column(String, default='active')
    settings = Column(JSON)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    created_by = Column(String)

class DocumentVersion(Base):
    __tablename__ = 'document_versions'
    
    id = Column(String, primary_key=True)
    document_id = Column(String, nullable=False)
    version_number = Column(Integer, nullable=False)
    content = Column(Text)
    commit_message = Column(String)
    author_id = Column(String)
    created_at = Column(DateTime)

class DatabaseIntegration:
    def __init__(self, database_url: str, collaboration_integrator: CollaborationIntegrator):
        self.engine = create_async_engine(database_url)
        self.SessionLocal = sessionmaker(self.engine, class_=AsyncSession)
        self.collaboration = collaboration_integrator
        
        # Setup database hooks
        self._setup_database_hooks()
    
    async def create_tables(self):
        """Create database tables"""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    
    def _setup_database_hooks(self):
        """Setup database persistence hooks"""
        original_create = self.collaboration.create_collaborative_document
        original_edit = self.collaboration.edit_document
        
        async def create_with_db_persistence(title, initial_content="", **kwargs):
            # Create collaborative document
            doc = await original_create(title, initial_content, **kwargs)
            
            # Persist to database
            await self._save_document_to_db(doc)
            
            return doc
        
        async def edit_with_db_persistence(doc_id, user_id, content, **kwargs):
            # Perform collaborative edit
            result = await original_edit(doc_id, user_id, content, **kwargs)
            
            # Update database
            if result['success']:
                await self._update_document_in_db(doc_id, content, result['new_version'], user_id)
            
            return result
        
        self.collaboration.create_collaborative_document = create_with_db_persistence
        self.collaboration.edit_document = edit_with_db_persistence
    
    async def _save_document_to_db(self, doc):
        """Save collaborative document to database"""
        async with self.SessionLocal() as session:
            db_doc = CollaborativeDocument(
                id=doc.document_id,
                title=doc.title,
                content=doc.current_content,
                version=doc.current_version,
                settings=doc.collaboration_settings.__dict__,
                created_at=doc.created_at,
                updated_at=doc.last_modified,
                created_by=""  # Would get from context
            )
            session.add(db_doc)
            await session.commit()
    
    async def _update_document_in_db(self, doc_id: str, content: str, version: int, user_id: str):
        """Update document in database"""
        async with self.SessionLocal() as session:
            # Update main document
            doc = await session.get(CollaborativeDocument, doc_id)
            if doc:
                doc.content = content
                doc.version = version
                doc.updated_at = datetime.now()
            
            # Create version record
            version_record = DocumentVersion(
                id=f"{doc_id}_v{version}",
                document_id=doc_id,
                version_number=version,
                content=content,
                author_id=user_id,
                created_at=datetime.now()
            )
            session.add(version_record)
            
            await session.commit()
    
    async def load_document_from_db(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Load collaborative document from database"""
        async with self.SessionLocal() as session:
            doc = await session.get(CollaborativeDocument, doc_id)
            if doc:
                return {
                    "document_id": doc.id,
                    "title": doc.title,
                    "content": doc.content,
                    "version": doc.version,
                    "settings": doc.settings,
                    "created_at": doc.created_at,
                    "updated_at": doc.updated_at
                }
            return None
```

## 🔐 Authentication Integration

### User Authentication Integration

```python
from typing import Optional, Set
import jwt
from datetime import datetime, timedelta

class AuthenticationIntegration:
    def __init__(self, collaboration_integrator: CollaborationIntegrator, jwt_secret: str):
        self.collaboration = collaboration_integrator
        self.jwt_secret = jwt_secret
        self.user_sessions = {}
        
        # Setup authentication hooks
        self._setup_auth_hooks()
    
    def _setup_auth_hooks(self):
        """Setup authentication hooks for collaboration operations"""
        original_add_user = self.collaboration.add_user_to_document
        original_edit = self.collaboration.edit_document
        
        async def add_user_with_auth(doc_id, user_id, user_name, **kwargs):
            # Verify user authentication
            if not await self._verify_user_auth(user_id):
                raise PermissionError("User not authenticated")
            
            # Check document access permissions
            if not await self._check_document_access(user_id, doc_id, "read"):
                raise PermissionError("User lacks document access")
            
            # Get user permissions
            permissions = await self._get_user_permissions(user_id, doc_id)
            
            return await original_add_user(doc_id, user_id, user_name, permissions=permissions)
        
        async def edit_with_auth(doc_id, user_id, content, **kwargs):
            # Verify user authentication
            if not await self._verify_user_auth(user_id):
                raise PermissionError("User not authenticated")
            
            # Check write permissions
            if not await self._check_document_access(user_id, doc_id, "write"):
                raise PermissionError("User lacks write permission")
            
            return await original_edit(doc_id, user_id, content, **kwargs)
        
        self.collaboration.add_user_to_document = add_user_with_auth
        self.collaboration.edit_document = edit_with_auth
    
    async def authenticate_user(self, username: str, password: str) -> Optional[str]:
        """Authenticate user and return JWT token"""
        # Your authentication logic here
        user = await self._validate_credentials(username, password)
        
        if user:
            # Create JWT token
            payload = {
                "user_id": user["id"],
                "username": username,
                "exp": datetime.utcnow() + timedelta(hours=24),
                "iat": datetime.utcnow()
            }
            token = jwt.encode(payload, self.jwt_secret, algorithm='HS256')
            
            # Store user session
            self.user_sessions[user["id"]] = {
                "username": username,
                "authenticated_at": datetime.utcnow(),
                "permissions": user.get("permissions", set())
            }
            
            return token
        
        return None
    
    async def _verify_user_auth(self, user_id: str) -> bool:
        """Verify user is authenticated"""
        return user_id in self.user_sessions
    
    async def _validate_credentials(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """Validate user credentials - implement your logic"""
        # Example implementation - replace with your auth system
        users_db = {
            "alice": {"id": "alice", "password": "password123", "permissions": {"admin"}},
            "bob": {"id": "bob", "password": "password456", "permissions": {"read", "write"}},
            "charlie": {"id": "charlie", "password": "password789", "permissions": {"read"}}
        }
        
        user = users_db.get(username)
        if user and user["password"] == password:
            return user
        
        return None
    
    async def _check_document_access(self, user_id: str, doc_id: str, permission: str) -> bool:
        """Check if user has document access permission"""
        user_session = self.user_sessions.get(user_id)
        if not user_session:
            return False
        
        # Check if user has admin permission (access to all documents)
        if "admin" in user_session["permissions"]:
            return True
        
        # Check document-specific permissions
        # This would typically query your permission system
        return permission in user_session["permissions"]
    
    async def _get_user_permissions(self, user_id: str, doc_id: str) -> Set[str]:
        """Get user permissions for specific document"""
        user_session = self.user_sessions.get(user_id)
        if not user_session:
            return set()
        
        return user_session["permissions"]
    
    def verify_jwt_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token and return payload"""
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=['HS256'])
            return payload
        except jwt.InvalidTokenError:
            return None
```

## 📊 Event System Integration

### Custom Event Handling

```python
from typing import Callable, Dict, List
from enum import Enum
import asyncio

class CollaborationEvent(Enum):
    DOCUMENT_CREATED = "document_created"
    DOCUMENT_EDITED = "document_edited"
    USER_JOINED = "user_joined"
    USER_LEFT = "user_left"
    CONFLICT_DETECTED = "conflict_detected"
    CONFLICT_RESOLVED = "conflict_resolved"
    VERSION_CREATED = "version_created"
    BRANCH_CREATED = "branch_created"
    BRANCH_MERGED = "branch_merged"

class EventSystem:
    def __init__(self):
        self.event_handlers: Dict[CollaborationEvent, List[Callable]] = {}
        self.middleware: List[Callable] = []
    
    def on(self, event: CollaborationEvent, handler: Callable):
        """Register event handler"""
        if event not in self.event_handlers:
            self.event_handlers[event] = []
        self.event_handlers[event].append(handler)
    
    def add_middleware(self, middleware: Callable):
        """Add event middleware"""
        self.middleware.append(middleware)
    
    async def emit(self, event: CollaborationEvent, data: Dict[str, Any]):
        """Emit event to all handlers"""
        # Process through middleware first
        for middleware in self.middleware:
            data = await middleware(event, data)
            if data is None:  # Middleware can cancel event
                return
        
        # Call event handlers
        handlers = self.event_handlers.get(event, [])
        if handlers:
            await asyncio.gather(*[handler(data) for handler in handlers], return_exceptions=True)

class EventIntegration:
    def __init__(self, collaboration_integrator: CollaborationIntegrator):
        self.collaboration = collaboration_integrator
        self.event_system = EventSystem()
        
        # Setup event hooks
        self._setup_event_hooks()
        
        # Setup default event handlers
        self._setup_default_handlers()
    
    def _setup_event_hooks(self):
        """Setup hooks to emit collaboration events"""
        original_create = self.collaboration.create_collaborative_document
        original_add_user = self.collaboration.add_user_to_document
        original_edit = self.collaboration.edit_document
        
        async def create_with_events(title, initial_content="", **kwargs):
            doc = await original_create(title, initial_content, **kwargs)
            
            await self.event_system.emit(CollaborationEvent.DOCUMENT_CREATED, {
                "document_id": doc.document_id,
                "title": doc.title,
                "creator_id": kwargs.get("creator_id", ""),
                "timestamp": datetime.now().isoformat()
            })
            
            return doc
        
        async def add_user_with_events(doc_id, user_id, user_name, **kwargs):
            session = await original_add_user(doc_id, user_id, user_name, **kwargs)
            
            await self.event_system.emit(CollaborationEvent.USER_JOINED, {
                "document_id": doc_id,
                "user_id": user_id,
                "user_name": user_name,
                "permissions": list(session.permissions),
                "timestamp": datetime.now().isoformat()
            })
            
            return session
        
        async def edit_with_events(doc_id, user_id, content, **kwargs):
            result = await original_edit(doc_id, user_id, content, **kwargs)
            
            await self.event_system.emit(CollaborationEvent.DOCUMENT_EDITED, {
                "document_id": doc_id,
                "user_id": user_id,
                "success": result["success"],
                "new_version": result.get("new_version"),
                "conflicts_detected": len(result.get("conflicts_detected", [])),
                "timestamp": datetime.now().isoformat()
            })
            
            # Emit conflict events if detected
            if result.get("conflicts_detected"):
                await self.event_system.emit(CollaborationEvent.CONFLICT_DETECTED, {
                    "document_id": doc_id,
                    "user_id": user_id,
                    "conflicts": result["conflicts_detected"],
                    "timestamp": datetime.now().isoformat()
                })
            
            return result
        
        self.collaboration.create_collaborative_document = create_with_events
        self.collaboration.add_user_to_document = add_user_with_events
        self.collaboration.edit_document = edit_with_events
    
    def _setup_default_handlers(self):
        """Setup default event handlers"""
        
        # Logging handler
        async def log_events(event_data):
            print(f"📝 Collaboration Event: {event_data}")
        
        # Register for all events
        for event in CollaborationEvent:
            self.event_system.on(event, log_events)
        
        # Notification handler for user events
        async def handle_user_events(event_data):
            if event_data.get("document_id"):
                doc_id = event_data["document_id"]
                active_users = await self.collaboration.get_active_users(doc_id)
                
                # Broadcast to other users (would integrate with your notification system)
                print(f"Notify {len(active_users)} users about user event")
        
        self.event_system.on(CollaborationEvent.USER_JOINED, handle_user_events)
        self.event_system.on(CollaborationEvent.USER_LEFT, handle_user_events)

# Usage example
def setup_custom_event_handlers(event_integration: EventIntegration):
    """Setup custom application-specific event handlers"""
    
    # Analytics handler
    async def analytics_handler(event_data):
        # Send to analytics system
        await send_to_analytics({
            "event": "collaboration_activity",
            "data": event_data
        })
    
    event_integration.event_system.on(CollaborationEvent.DOCUMENT_EDITED, analytics_handler)
    
    # Backup handler
    async def backup_handler(event_data):
        if event_data.get("new_version") and event_data["new_version"] % 10 == 0:
            # Backup every 10 versions
            doc_id = event_data["document_id"]
            await create_document_backup(doc_id)
    
    event_integration.event_system.on(CollaborationEvent.DOCUMENT_EDITED, backup_handler)
    
    # Audit trail handler
    async def audit_handler(event_data):
        await log_to_audit_trail({
            "timestamp": event_data.get("timestamp"),
            "action": "collaboration_event",
            "user_id": event_data.get("user_id"),
            "document_id": event_data.get("document_id"),
            "details": event_data
        })
    
    # Register audit handler for all events
    for event in CollaborationEvent:
        event_integration.event_system.on(event, audit_handler)
```

## 🌐 API Integration Patterns

### REST API Integration

```python
from fastapi import FastAPI, HTTPException, Depends, WebSocket
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI(title="Collaboration API")
security = HTTPBearer()

class DocumentCreateRequest(BaseModel):
    title: str
    initial_content: str = ""
    settings: Optional[Dict[str, Any]] = None

class DocumentEditRequest(BaseModel):
    content: str
    position: Optional[int] = None
    length: Optional[int] = None
    commit_message: Optional[str] = None

class CollaborationAPI:
    def __init__(self, collaboration_integrator: CollaborationIntegrator, auth_system):
        self.collaboration = collaboration_integrator
        self.auth = auth_system
    
    async def get_current_user(self, credentials: HTTPAuthorizationCredentials = Depends(security)):
        """Get current user from JWT token"""
        token = credentials.credentials
        payload = self.auth.verify_jwt_token(token)
        
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
        
        return payload["user_id"]

# Initialize API
collaboration_api = CollaborationAPI(collaboration_integrator, auth_system)

@app.post("/documents")
async def create_document(
    request: DocumentCreateRequest,
    current_user: str = Depends(collaboration_api.get_current_user)
):
    """Create new collaborative document"""
    try:
        doc = await collaboration_api.collaboration.create_collaborative_document(
            title=request.title,
            initial_content=request.initial_content,
            settings=request.settings,
            creator_id=current_user
        )
        
        return {
            "document_id": doc.document_id,
            "title": doc.title,
            "status": "created",
            "created_at": doc.created_at.isoformat()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/documents/{document_id}/users")
async def add_user_to_document(
    document_id: str,
    user_name: str,
    permissions: Optional[List[str]] = None,
    current_user: str = Depends(collaboration_api.get_current_user)
):
    """Add user to collaborative document"""
    try:
        session = await collaboration_api.collaboration.add_user_to_document(
            document_id, current_user, user_name, set(permissions or ["read", "write"])
        )
        
        return {
            "session_id": session.session_id,
            "user_id": session.user_id,
            "user_name": session.user_name,
            "permissions": list(session.permissions),
            "joined_at": session.joined_at.isoformat()
        }
    
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/documents/{document_id}")
async def edit_document(
    document_id: str,
    request: DocumentEditRequest,
    current_user: str = Depends(collaboration_api.get_current_user)
):
    """Edit collaborative document"""
    try:
        result = await collaboration_api.collaboration.edit_document(
            document_id,
            current_user,
            request.content,
            request.position,
            request.length,
            request.commit_message
        )
        
        return {
            "success": result["success"],
            "new_version": result.get("new_version"),
            "conflicts_detected": len(result.get("conflicts_detected", [])),
            "conflicts_resolved": len(result.get("conflicts_resolved", [])),
            "sync_time_ms": result.get("sync_time_ms")
        }
    
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents/{document_id}")
async def get_document(
    document_id: str,
    current_user: str = Depends(collaboration_api.get_current_user)
):
    """Get collaborative document status"""
    try:
        status = await collaboration_api.collaboration.get_document_status(document_id)
        return status
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/documents/{document_id}/conflicts/resolve")
async def resolve_conflicts(
    document_id: str,
    auto_resolve: bool = True,
    current_user: str = Depends(collaboration_api.get_current_user)
):
    """Resolve document conflicts"""
    try:
        result = await collaboration_api.collaboration.resolve_conflicts(
            document_id, current_user, auto_resolve
        )
        
        return {
            "merge_successful": result.merge_successful,
            "conflicts_resolved": len(result.resolved_conflicts),
            "unresolved_conflicts": len(result.unresolved_conflicts),
            "processing_time_ms": result.total_processing_time_ms
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/{document_id}")
async def websocket_endpoint(websocket: WebSocket, document_id: str):
    """WebSocket endpoint for real-time collaboration"""
    # This would integrate with the WebSocket handler shown earlier
    await websocket.accept()
    # Handle WebSocket communication...
```

### GraphQL Integration

```python
import strawberry
from typing import Optional, List

@strawberry.type
class Document:
    document_id: str
    title: str
    current_content: str
    current_version: int
    status: str
    created_at: str
    last_modified: str

@strawberry.type
class EditResult:
    success: bool
    new_version: Optional[int]
    conflicts_detected: int
    conflicts_resolved: int
    sync_time_ms: float

@strawberry.type
class Query:
    
    @strawberry.field
    async def document(self, document_id: str, info) -> Optional[Document]:
        """Get document by ID"""
        # Extract user from context
        user_id = info.context["user_id"]
        
        try:
            status = await collaboration_integrator.get_document_status(document_id)
            
            return Document(
                document_id=status["document_id"],
                title=status["title"],
                current_content="",  # Would get from collaboration system
                current_version=status["current_version"],
                status=status["status"],
                created_at=status.get("created_at", ""),
                last_modified=status["last_modified"]
            )
        
        except Exception:
            return None
    
    @strawberry.field
    async def documents(self, info) -> List[Document]:
        """Get all documents for current user"""
        # Implementation would query user's accessible documents
        pass

@strawberry.type
class Mutation:
    
    @strawberry.mutation
    async def create_document(
        self,
        title: str,
        initial_content: str = "",
        info = None
    ) -> Document:
        """Create new collaborative document"""
        user_id = info.context["user_id"]
        
        doc = await collaboration_integrator.create_collaborative_document(
            title=title,
            initial_content=initial_content,
            creator_id=user_id
        )
        
        return Document(
            document_id=doc.document_id,
            title=doc.title,
            current_content=doc.current_content,
            current_version=doc.current_version,
            status=doc.status.value,
            created_at=doc.created_at.isoformat(),
            last_modified=doc.last_modified.isoformat()
        )
    
    @strawberry.mutation
    async def edit_document(
        self,
        document_id: str,
        content: str,
        position: Optional[int] = None,
        length: Optional[int] = None,
        info = None
    ) -> EditResult:
        """Edit collaborative document"""
        user_id = info.context["user_id"]
        
        result = await collaboration_integrator.edit_document(
            document_id, user_id, content, position, length
        )
        
        return EditResult(
            success=result["success"],
            new_version=result.get("new_version"),
            conflicts_detected=len(result.get("conflicts_detected", [])),
            conflicts_resolved=len(result.get("conflicts_resolved", [])),
            sync_time_ms=result.get("sync_time_ms", 0.0)
        )

schema = strawberry.Schema(query=Query, mutation=Mutation)
```

## 🚀 Deployment and Scaling

### Docker Integration

```dockerfile
# Dockerfile for collaboration service
FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Setup collaboration data directory
RUN mkdir -p /app/collaboration_data

# Expose ports
EXPOSE 8000

# Environment variables
ENV COLLABORATION_STORAGE_PATH=/app/collaboration_data
ENV COLLABORATION_MAX_USERS=20
ENV COLLABORATION_SYNC_STRATEGY=immediate

# Start application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  collaboration-service:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/collaboration
      - REDIS_URL=redis://redis:6379/0
      - JWT_SECRET=your-secret-key
    volumes:
      - ./collaboration_data:/app/collaboration_data
    depends_on:
      - db
      - redis
  
  db:
    image: postgres:13
    environment:
      POSTGRES_DB: collaboration
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Kubernetes Integration

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: collaboration-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: collaboration-service
  template:
    metadata:
      labels:
        app: collaboration-service
    spec:
      containers:
      - name: collaboration-service
        image: your-registry/collaboration-service:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: collaboration-secrets
              key: database-url
        - name: REDIS_URL
          value: "redis://redis-service:6379/0"
        - name: COLLABORATION_MAX_USERS
          value: "50"
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        volumeMounts:
        - name: collaboration-storage
          mountPath: /app/collaboration_data
      volumes:
      - name: collaboration-storage
        persistentVolumeClaim:
          claimName: collaboration-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: collaboration-service
spec:
  selector:
    app: collaboration-service
  ports:
  - port: 80
    targetPort: 8000
  type: LoadBalancer
```

## 🔍 Monitoring and Observability

### Integration with Monitoring Systems

```python
from prometheus_client import Counter, Histogram, Gauge
import time

# Prometheus metrics
collaboration_operations = Counter('collaboration_operations_total', 'Total collaboration operations', ['operation', 'status'])
collaboration_latency = Histogram('collaboration_operation_duration_seconds', 'Operation latency')
active_collaborators = Gauge('collaboration_active_users', 'Number of active collaborative users')
active_documents = Gauge('collaboration_active_documents', 'Number of active collaborative documents')

class MonitoringIntegration:
    def __init__(self, collaboration_integrator: CollaborationIntegrator):
        self.collaboration = collaboration_integrator
        self._setup_monitoring_hooks()
    
    def _setup_monitoring_hooks(self):
        """Setup monitoring hooks for metrics collection"""
        original_edit = self.collaboration.edit_document
        
        async def edit_with_monitoring(doc_id, user_id, content, **kwargs):
            start_time = time.time()
            
            try:
                result = await original_edit(doc_id, user_id, content, **kwargs)
                
                # Record success metrics
                collaboration_operations.labels(operation='edit', status='success').inc()
                collaboration_latency.observe(time.time() - start_time)
                
                return result
            
            except Exception as e:
                # Record error metrics
                collaboration_operations.labels(operation='edit', status='error').inc()
                collaboration_latency.observe(time.time() - start_time)
                raise
        
        self.collaboration.edit_document = edit_with_monitoring
        
        # Update active users/documents gauges
        self._start_gauge_updates()
    
    async def _start_gauge_updates(self):
        """Start background task to update gauges"""
        async def update_gauges():
            while True:
                try:
                    stats = await self.collaboration.get_integration_statistics()
                    active_documents.set(stats['active_documents'])
                    
                    # Count total active users across all documents
                    total_users = 0
                    for doc_id in self.collaboration.documents.keys():
                        users = await self.collaboration.get_active_users(doc_id)
                        total_users += len(users)
                    
                    active_collaborators.set(total_users)
                
                except Exception as e:
                    print(f"Gauge update error: {e}")
                
                await asyncio.sleep(30)  # Update every 30 seconds
        
        asyncio.create_task(update_gauges())
```

This comprehensive integration guide provides everything needed to successfully integrate the Real-Time Collaboration System with your existing applications and infrastructure. The modular design allows you to choose which integration patterns best fit your needs while maintaining high performance and reliability.