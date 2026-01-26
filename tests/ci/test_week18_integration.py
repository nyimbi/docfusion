"""
Integration tests for Week 18: Presence Management and Workflow Foundation.

Tests the integration between presence management, activity tracking,
permissions, and workflow systems.
"""

import asyncio
import pytest
import uuid
from datetime import datetime

def uuid7str():
	"""Generate a UUID7-like string using UUID4 for compatibility."""
	return str(uuid.uuid4())

from docfusion.collaboration.presence.presence_manager import (
	PresenceManager, PresenceStatus, CursorPosition
)
from docfusion.collaboration.presence.activity_tracker import (
	ActivityTracker, ActivityType
)
from docfusion.collaboration.permissions.collaboration_permissions import (
	CollaborationPermissions, Permission, PermissionScope
)
from docfusion.workflow.processes.process_definition import (
	ProcessDefinition, NodeType
)
from docfusion.workflow.processes.workflow_template import (
	WorkflowTemplate, TemplateCategory, IndustryType
)


@pytest.fixture
async def presence_manager():
	"""Create presence manager for testing."""
	manager = PresenceManager()
	await manager.start_cleanup_task()
	yield manager
	await manager.cleanup()


@pytest.fixture
async def activity_tracker():
	"""Create activity tracker for testing."""
	tracker = ActivityTracker()
	yield tracker
	await tracker.cleanup()


@pytest.fixture
async def permissions_manager():
	"""Create permissions manager for testing."""
	manager = CollaborationPermissions()
	yield manager
	await manager.cleanup()


@pytest.fixture
async def process_definition():
	"""Create process definition manager for testing."""
	manager = ProcessDefinition()
	yield manager
	await manager.cleanup()


@pytest.fixture
async def workflow_template():
	"""Create workflow template manager for testing."""
	manager = WorkflowTemplate()
	yield manager
	await manager.cleanup()


class TestPresenceManagerIntegration:
	"""Test presence manager integration and functionality."""
	
	@pytest.mark.asyncio
	async def test_presence_manager_basic_operations(self, presence_manager):
		"""Test basic presence manager operations."""
		document_id = "test_doc_001"
		
		# Add users to document
		session1 = await presence_manager.add_user_to_document(
			document_id, "user1", "Alice Smith"
		)
		session2 = await presence_manager.add_user_to_document(
			document_id, "user2", "Bob Johnson"
		)
		
		assert session1.document_id == document_id
		assert session1.user_id == "user1"
		assert session1.is_online
		
		assert session2.document_id == document_id
		assert session2.user_id == "user2"
		assert session2.is_online
		
		# Update user status
		success = await presence_manager.update_user_status(
			session1.session_id,
			PresenceStatus.EDITING,
			CursorPosition(position=100, selection_start=100, selection_end=110)
		)
		assert success
		
		# Get active users
		active_users = await presence_manager.get_active_users(document_id)
		assert len(active_users) == 2
		
		user_names = [user.user_name for user in active_users]
		assert "Alice Smith" in user_names
		assert "Bob Johnson" in user_names
		
		# Check cursor position was updated
		alice_session = next(user for user in active_users if user.user_name == "Alice Smith")
		assert alice_session.presence.cursor_position.position == 100
		assert alice_session.presence.status == PresenceStatus.EDITING
		
		# Remove user
		removed = await presence_manager.remove_user_from_document(session1.session_id)
		assert removed
		
		# Verify user was removed
		active_users = await presence_manager.get_active_users(document_id)
		assert len(active_users) == 1
		assert active_users[0].user_name == "Bob Johnson"
	
	@pytest.mark.asyncio
	async def test_presence_statistics(self, presence_manager):
		"""Test presence statistics calculation."""
		document_id = "test_doc_stats"
		
		# Add multiple users
		users = []
		for i in range(5):
			session = await presence_manager.add_user_to_document(
				document_id, f"user{i}", f"User {i}"
			)
			users.append(session)
		
		# Update some users to editing status
		for i in range(3):
			await presence_manager.update_user_status(
				users[i].session_id, PresenceStatus.EDITING
			)
		
		# Get statistics
		stats = await presence_manager.get_presence_statistics(document_id)
		
		assert stats["document_id"] == document_id
		assert stats["total_users"] == 5
		assert stats["online_users"] == 5
		assert stats["editing_users"] == 3
		assert stats["status_breakdown"]["editing"] == 3
		assert stats["status_breakdown"]["online"] == 2
		
		# Get global statistics
		global_stats = await presence_manager.get_global_presence_statistics()
		assert global_stats["total_sessions"] >= 5
		assert global_stats["online_sessions"] >= 5


class TestActivityTrackerIntegration:
	"""Test activity tracker integration and functionality."""
	
	@pytest.mark.asyncio
	async def test_activity_tracking_workflow(self, activity_tracker):
		"""Test complete activity tracking workflow."""
		document_id = "test_doc_activity"
		user_id = "test_user"
		
		# Start session
		session = await activity_tracker.start_session(
			"session_001", document_id, user_id
		)
		
		assert session.session_id == "session_001"
		assert session.document_id == document_id
		assert session.user_id == user_id
		assert session.start_time is not None
		
		# Log various activities
		activities = [
			(ActivityType.TEXT_INSERT, {"content_length": 50}),
			(ActivityType.TEXT_DELETE, {"content_length": 10}),
			(ActivityType.CURSOR_MOVE, {}),
			(ActivityType.COMMENT_ADD, {}),
			(ActivityType.SAVE_DOCUMENT, {})
		]
		
		logged_events = []
		for activity_type, kwargs in activities:
			event = await activity_tracker.log_activity(
				document_id=document_id,
				user_id=user_id,
				session_id="session_001",
				activity_type=activity_type,
				**kwargs
			)
			logged_events.append(event)
		
		assert len(logged_events) == 5
		
		# Verify activities were logged
		for i, event in enumerate(logged_events):
			assert event.activity_type == activities[i][0]
			assert event.user_id == user_id
			assert event.document_id == document_id
			assert event.productivity_score is not None
		
		# End session
		completed_session = await activity_tracker.end_session("session_001")
		assert completed_session is not None
		assert completed_session.end_time is not None
		assert completed_session.total_activities == 5
		assert completed_session.characters_added == 50
		assert completed_session.characters_deleted == 10
		
		# Get productivity metrics
		metrics = await activity_tracker.get_user_productivity_metrics(user_id)
		assert metrics.user_id == user_id
		assert metrics.total_activities == 5
		assert metrics.total_characters_added == 50
		assert metrics.total_characters_deleted == 10
		assert metrics.net_contribution == 40


class TestPermissionsIntegration:
	"""Test permissions manager integration and functionality."""
	
	@pytest.mark.asyncio
	async def test_permission_lifecycle(self, permissions_manager):
		"""Test complete permission management lifecycle."""
		user_id = "test_user"
		document_id = "test_document"
		
		# Grant permissions
		grant = await permissions_manager.grant_permission(
			user_id=user_id,
			permission=Permission.WRITE,
			scope=PermissionScope.DOCUMENT,
			target_id=document_id,
			granted_by="admin",
			reason="Testing permissions"
		)
		
		assert grant.user_id == user_id
		assert grant.permission == Permission.WRITE
		assert grant.target_id == document_id
		assert grant.granted_by == "admin"
		
		# Check permission
		has_write = await permissions_manager.check_permission(
			user_id=user_id,
			permission=Permission.WRITE,
			target_id=document_id,
			scope=PermissionScope.DOCUMENT
		)
		assert has_write
		
		# Check implied permission (READ should be implied by WRITE)
		has_read = await permissions_manager.check_permission(
			user_id=user_id,
			permission=Permission.READ,
			target_id=document_id,
			scope=PermissionScope.DOCUMENT
		)
		assert has_read
		
		# Check non-granted permission
		has_admin = await permissions_manager.check_permission(
			user_id=user_id,
			permission=Permission.ADMIN,
			target_id=document_id,
			scope=PermissionScope.DOCUMENT
		)
		assert not has_admin
		
		# Get user permissions
		user_perms = await permissions_manager.get_user_permissions(
			user_id=user_id,
			target_id=document_id,
			scope=PermissionScope.DOCUMENT
		)
		
		assert Permission.WRITE in user_perms.effective_permissions
		assert len(user_perms.explicit_grants) == 1
		
		# Revoke permission
		revoked = await permissions_manager.revoke_permission(
			grant.grant_id, "admin", "Testing revocation"
		)
		assert revoked
		
		# Verify permission was revoked
		has_write_after = await permissions_manager.check_permission(
			user_id=user_id,
			permission=Permission.WRITE,
			target_id=document_id,
			scope=PermissionScope.DOCUMENT
		)
		assert not has_write_after
	
	@pytest.mark.asyncio
	async def test_section_permissions(self, permissions_manager):
		"""Test section-level permission management."""
		document_id = "test_doc_sections"
		section_id = "section_001"
		user_id = "section_user"
		
		# Configure section permissions
		section_perms = await permissions_manager.configure_section_permissions(
			section_id=section_id,
			document_id=document_id,
			section_path="/introduction",
			default_permissions={Permission.READ},
			inherit_from_parent=True
		)
		
		assert section_perms.section_id == section_id
		assert section_perms.document_id == document_id
		assert Permission.READ in section_perms.default_permissions
		
		# Lock section
		locked = await permissions_manager.lock_section(
			section_id, user_id, lock_duration_minutes=15
		)
		assert locked
		
		# Verify section is locked
		retrieved_perms = await permissions_manager.get_section_permissions(section_id)
		assert retrieved_perms.locked_by == user_id
		assert retrieved_perms.locked_until is not None
		
		# Try to lock by another user (should fail)
		locked_by_other = await permissions_manager.lock_section(
			section_id, "other_user", lock_duration_minutes=10
		)
		assert not locked_by_other
		
		# Unlock section
		unlocked = await permissions_manager.unlock_section(section_id, user_id)
		assert unlocked
		
		# Verify section is unlocked
		retrieved_perms = await permissions_manager.get_section_permissions(section_id)
		assert retrieved_perms.locked_by is None
		assert retrieved_perms.locked_until is None


class TestWorkflowProcessDefinition:
	"""Test workflow process definition functionality."""
	
	@pytest.mark.asyncio
	async def test_process_creation_and_validation(self, process_definition):
		"""Test creating and validating workflow processes."""
		# Create process
		process = await process_definition.create_process(
			name="Test Approval Process",
			description="Simple approval workflow",
			created_by="admin",
			category="approval"
		)
		
		assert process.name == "Test Approval Process"
		assert process.created_by == "admin"
		assert process.category == "approval"
		
		# Add nodes
		start_node = await process_definition.add_node(
			process.process_id, NodeType.START, "Start Process", 0, 0
		)
		
		review_node = await process_definition.add_node(
			process.process_id, NodeType.USER_TASK, "Review Document", 100, 50
		)
		
		approve_node = await process_definition.add_node(
			process.process_id, NodeType.USER_TASK, "Approve Document", 200, 50
		)
		
		end_node = await process_definition.add_node(
			process.process_id, NodeType.END, "End Process", 300, 50
		)
		
		# Add edges
		edge1 = await process_definition.add_edge(
			process.process_id, start_node.node_id, review_node.node_id
		)
		
		edge2 = await process_definition.add_edge(
			process.process_id, review_node.node_id, approve_node.node_id
		)
		
		edge3 = await process_definition.add_edge(
			process.process_id, approve_node.node_id, end_node.node_id
		)
		
		# Validate process
		validation = await process_definition.validate_process(process.process_id)
		
		assert validation.is_valid
		assert validation.errors_count == 0
		
		# Get process components
		nodes = await process_definition.get_process_nodes(process.process_id)
		edges = await process_definition.get_process_edges(process.process_id)
		
		assert len(nodes) == 4
		assert len(edges) == 3
		
		# Test process testing
		test_result = await process_definition.test_process(
			process.process_id, "basic_test", {"test_data": "sample"}
		)
		
		assert test_result.process_id == process.process_id
		assert test_result.test_scenario == "basic_test"
		# Note: success may vary based on implementation details
	
	@pytest.mark.asyncio
	async def test_process_export_import(self, process_definition):
		"""Test process export and import functionality."""
		# Create simple process
		process = await process_definition.create_process(
			name="Export Test Process",
			description="Process for testing export/import",
			created_by="admin"
		)
		
		# Add basic structure
		start_node = await process_definition.add_node(
			process.process_id, NodeType.START, "Start"
		)
		end_node = await process_definition.add_node(
			process.process_id, NodeType.END, "End"
		)
		await process_definition.add_edge(
			process.process_id, start_node.node_id, end_node.node_id
		)
		
		# Export process
		exported_json = await process_definition.export_process(
			process.process_id, "json"
		)
		
		assert isinstance(exported_json, str)
		assert "Start" in exported_json
		assert "End" in exported_json
		
		# Import process
		imported_process = await process_definition.import_process(
			exported_json, "json", "importer"
		)
		
		assert imported_process.name == "Export Test Process"
		assert imported_process.created_by == "importer"  # Should be updated
		
		# Verify imported process structure
		imported_nodes = await process_definition.get_process_nodes(
			imported_process.process_id
		)
		imported_edges = await process_definition.get_process_edges(
			imported_process.process_id
		)
		
		assert len(imported_nodes) == 2
		assert len(imported_edges) == 1


class TestWorkflowTemplate:
	"""Test workflow template functionality."""
	
	@pytest.mark.asyncio
	async def test_template_creation_and_instantiation(self, workflow_template):
		"""Test creating and instantiating workflow templates."""
		# Create template
		template = await workflow_template.create_template(
			name="Document Review Template",
			description="Standard document review process",
			category=TemplateCategory.REVIEW_APPROVAL,
			industry=IndustryType.GENERIC,
			base_process_definition={
				"nodes": {
					"start": {"node_type": "start", "name": "Start Review"},
					"review": {"node_type": "user_task", "name": "Review Document"},
					"end": {"node_type": "end", "name": "Review Complete"}
				},
				"edges": [
					{"source": "start", "target": "review"},
					{"source": "review", "target": "end"}
				]
			},
			created_by="template_admin"
		)
		
		assert template.name == "Document Review Template"
		assert template.category == TemplateCategory.REVIEW_APPROVAL
		assert template.industry == IndustryType.GENERIC
		
		# Instantiate template
		instance = await workflow_template.instantiate_template(
			template.template_id,
			"My Document Review",
			{},  # No parameters for this simple template
			"user123"
		)
		
		assert instance.template_id == template.template_id
		assert instance.instance_name == "My Document Review"
		assert instance.created_by == "user123"
		
		# Update template performance
		await workflow_template.update_template_performance(
			template.template_id,
			{
				"completed": True,
				"completion_time_hours": 2.5,
				"user_satisfaction": 4.2
			}
		)
		
		# Get template analytics
		analytics = await workflow_template.get_template_analytics(
			template.template_id, period_days=30
		)
		
		assert analytics["template_id"] == template.template_id
		assert analytics["template_name"] == "Document Review Template"
		assert "performance_metrics" in analytics
	
	@pytest.mark.asyncio
	async def test_template_recommendations(self, workflow_template):
		"""Test template recommendation system."""
		# Get recommendations
		recommendations = await workflow_template.get_template_recommendations(
			use_case_description="I need to review and approve a government proposal document",
			industry=IndustryType.GOVERNMENT,
			category=TemplateCategory.PROPOSAL_DEVELOPMENT
		)
		
		# Should find built-in government proposal template
		assert len(recommendations) > 0
		
		gov_template = next(
			(r for r in recommendations if "Government" in r.recommendation_reason),
			None
		)
		assert gov_template is not None
		assert gov_template.relevance_score > 0
		
		# Search templates
		search_results = await workflow_template.search_templates(
			query="government",
			industry=IndustryType.GOVERNMENT
		)
		
		assert len(search_results) > 0
		gov_templates = [t for t in search_results if t.industry == IndustryType.GOVERNMENT]
		assert len(gov_templates) > 0


class TestIntegratedWorkflow:
	"""Test integrated workflow functionality across all components."""
	
	@pytest.mark.asyncio
	async def test_complete_collaboration_workflow(
		self,
		presence_manager,
		activity_tracker,
		permissions_manager,
		process_definition,
		workflow_template
	):
		"""Test complete collaboration workflow integration."""
		document_id = "integrated_test_doc"
		
		# 1. Set up presence tracking
		alice_session = await presence_manager.add_user_to_document(
			document_id, "alice", "Alice Smith", {"read", "write"}
		)
		bob_session = await presence_manager.add_user_to_document(
			document_id, "bob", "Bob Johnson", {"read", "comment"}
		)
		
		# 2. Set up activity tracking
		alice_activity_session = await activity_tracker.start_session(
			alice_session.session_id, document_id, "alice"
		)
		bob_activity_session = await activity_tracker.start_session(
			bob_session.session_id, document_id, "bob"
		)
		
		# 3. Configure permissions
		await permissions_manager.grant_permission(
			user_id="alice",
			permission=Permission.WRITE,
			scope=PermissionScope.DOCUMENT,
			target_id=document_id,
			granted_by="admin"
		)
		
		await permissions_manager.grant_permission(
			user_id="bob",
			permission=Permission.COMMENT,
			scope=PermissionScope.DOCUMENT,
			target_id=document_id,
			granted_by="admin"
		)
		
		# 4. Create workflow process
		process = await process_definition.create_process(
			name="Collaborative Document Creation",
			description="Document creation with review",
			created_by="admin"
		)
		
		# Add workflow nodes
		start_node = await process_definition.add_node(
			process.process_id, NodeType.START, "Start"
		)
		draft_node = await process_definition.add_node(
			process.process_id, NodeType.USER_TASK, "Create Draft"
		)
		review_node = await process_definition.add_node(
			process.process_id, NodeType.USER_TASK, "Review Document"
		)
		end_node = await process_definition.add_node(
			process.process_id, NodeType.END, "Complete"
		)
		
		# Connect nodes
		await process_definition.add_edge(
			process.process_id, start_node.node_id, draft_node.node_id
		)
		await process_definition.add_edge(
			process.process_id, draft_node.node_id, review_node.node_id
		)
		await process_definition.add_edge(
			process.process_id, review_node.node_id, end_node.node_id
		)
		
		# 5. Simulate collaborative activities
		# Alice creates content
		await presence_manager.update_user_status(
			alice_session.session_id, PresenceStatus.EDITING
		)
		
		await activity_tracker.log_activity(
			document_id=document_id,
			user_id="alice",
			session_id=alice_activity_session.session_id,
			activity_type=ActivityType.TEXT_INSERT,
			content_length=200
		)
		
		# Bob reviews content
		await presence_manager.update_user_status(
			bob_session.session_id, PresenceStatus.REVIEWING
		)
		
		await activity_tracker.log_activity(
			document_id=document_id,
			user_id="bob",
			session_id=bob_activity_session.session_id,
			activity_type=ActivityType.COMMENT_ADD
		)
		
		# 6. Verify integration state
		# Check presence
		active_users = await presence_manager.get_active_users(document_id)
		assert len(active_users) == 2
		
		# Check permissions
		alice_can_write = await permissions_manager.check_permission(
			"alice", Permission.WRITE, document_id
		)
		bob_can_comment = await permissions_manager.check_permission(
			"bob", Permission.COMMENT, document_id
		)
		
		assert alice_can_write
		assert bob_can_comment
		
		# Check activities
		alice_metrics = await activity_tracker.get_user_productivity_metrics("alice")
		bob_metrics = await activity_tracker.get_user_productivity_metrics("bob")
		
		assert alice_metrics.total_activities > 0
		assert bob_metrics.total_activities > 0
		
		# Validate workflow
		validation = await process_definition.validate_process(process.process_id)
		assert validation.is_valid
		
		# 7. Clean up sessions
		await activity_tracker.end_session(alice_activity_session.session_id)
		await activity_tracker.end_session(bob_activity_session.session_id)
		
		completed_alice = await activity_tracker.get_session_summary(
			alice_activity_session.session_id
		)
		completed_bob = await activity_tracker.get_session_summary(
			bob_activity_session.session_id
		)
		
		assert completed_alice.total_activities > 0
		assert completed_bob.total_activities > 0
		assert completed_alice.characters_added == 200
		
		print("✅ Complete collaboration workflow integration test passed!")


if __name__ == "__main__":
	# Run integration tests
	pytest.main([__file__, "-v", "--tb=short"])