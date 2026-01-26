"""
Pytest configuration and fixtures for DocuFusion Flask-AppBuilder tests.
"""

import pytest
import tempfile
import os
from app import create_app, db
from app.config import TestingConfig
from app.models import Document, Template, Project, Opportunity


@pytest.fixture
def app():
	"""Create application for testing."""
	# Create temporary database file
	db_fd, db_path = tempfile.mkstemp()
	
	class TestConfig(TestingConfig):
		SQLALCHEMY_DATABASE_URI = f'sqlite:///{db_path}'
		WTF_CSRF_ENABLED = False
		TESTING = True
	
	app = create_app(TestConfig, standalone=True)
	
	with app.app_context():
		db.create_all()
		
		# Create default roles and permissions
		security_manager = app.appbuilder.sm
		if hasattr(security_manager, 'create_db'):
			security_manager.create_db()
	
	yield app
	
	# Cleanup
	os.close(db_fd)
	os.unlink(db_path)


@pytest.fixture
def client(app):
	"""Create test client."""
	return app.test_client()


@pytest.fixture
def runner(app):
	"""Create test CLI runner."""
	return app.test_cli_runner()


@pytest.fixture
def auth_client(client, app):
	"""Create authenticated test client."""
	with app.app_context():
		# Create test user
		security_manager = app.appbuilder.sm
		
		# Find or create admin role
		admin_role = security_manager.find_role('Admin')
		if not admin_role:
			admin_role = security_manager.add_role('Admin')
		
		# Create test user
		test_user = security_manager.add_user(
			username='testuser',
			first_name='Test',
			last_name='User',
			email='test@example.com',
			role=admin_role,
			password='testpass123'
		)
		
		# Login
		response = client.post('/login/', data={
			'username': 'testuser',
			'password': 'testpass123'
		}, follow_redirects=True)
		
		assert response.status_code == 200
		
		yield client


@pytest.fixture
def sample_document(app):
	"""Create sample document for testing."""
	with app.app_context():
		document = Document(
			title='Test Document',
			description='A test document for unit testing',
			content='This is test content for the document.',
			document_type='proposal',
			status='draft',
			version='1.0'
		)
		db.session.add(document)
		db.session.commit()
		return document


@pytest.fixture
def sample_template(app):
	"""Create sample template for testing."""
	with app.app_context():
		template = Template(
			name='Test Template',
			description='A test template for unit testing',
			category='proposal',
			template_content='Hello {{client_name}}, this is a test template.',
			is_active=True,
			is_public=False,
			version='1.0'
		)
		db.session.add(template)
		db.session.commit()
		return template


@pytest.fixture
def sample_project(app):
	"""Create sample project for testing."""
	with app.app_context():
		from datetime import datetime, timedelta
		
		project = Project(
			name='Test Project',
			description='A test project for unit testing',
			client_name='Test Client',
			status='active',
			priority='medium',
			start_date=datetime.utcnow().date(),
			due_date=(datetime.utcnow() + timedelta(days=30)).date(),
			budget=50000.0,
			estimated_value=75000.0
		)
		db.session.add(project)
		db.session.commit()
		return project


@pytest.fixture
def sample_opportunity(app):
	"""Create sample opportunity for testing."""
	with app.app_context():
		from datetime import datetime, timedelta
		
		opportunity = Opportunity(
			title='Test RFP Opportunity',
			description='A test RFP opportunity for unit testing',
			source_organization='Test Agency',
			opportunity_type='rfp',
			industry='technology',
			location='United States',
			status='discovered',
			priority='medium',
			posted_date=datetime.utcnow().date(),
			submission_deadline=(datetime.utcnow() + timedelta(days=14)).date(),
			estimated_value=100000.0,
			qualification_score=0.75,
			win_probability=0.35
		)
		db.session.add(opportunity)
		db.session.commit()
		return opportunity


@pytest.fixture
def sample_data(app, sample_document, sample_template, sample_project, sample_opportunity):
	"""Create complete set of sample data for testing."""
	return {
		'document': sample_document,
		'template': sample_template,
		'project': sample_project,
		'opportunity': sample_opportunity
	}