"""
CLI commands for DocuFusion management.
"""

import click
from flask.cli import with_appcontext
from flask import current_app
import os
import sys
from datetime import datetime, timedelta


def register_commands(app):
	"""Register CLI commands with Flask application."""
	
	@app.cli.group()
	def docufusion():
		"""DocuFusion management commands."""
		pass
	
	@docufusion.command()
	@with_appcontext
	def init_db():
		"""Initialize the database with tables and default data."""
		from app import db
		
		click.echo('Creating database tables...')
		db.create_all()
		
		# Initialize security manager
		security_manager = current_app.appbuilder.sm
		if hasattr(security_manager, 'create_db'):
			security_manager.create_db()
		
		click.echo('Database initialized successfully!')
	
	@docufusion.command()
	@click.option('--username', prompt=True, help='Admin username')
	@click.option('--email', prompt=True, help='Admin email')
	@click.option('--password', prompt=True, hide_input=True, confirmation_prompt=True, help='Admin password')
	@click.option('--first-name', prompt=True, help='First name')
	@click.option('--last-name', prompt=True, help='Last name')
	@with_appcontext
	def create_admin(username, email, password, first_name, last_name):
		"""Create an admin user."""
		security_manager = current_app.appbuilder.sm
		
		# Check if user already exists
		if security_manager.find_user(username=username):
			click.echo(f'User {username} already exists!')
			return
		
		# Find admin role
		admin_role = security_manager.find_role(security_manager.auth_role_admin)
		if not admin_role:
			click.echo('Admin role not found! Run init-db first.')
			return
		
		# Create admin user
		user = security_manager.add_user(
			username=username,
			first_name=first_name,
			last_name=last_name,
			email=email,
			role=admin_role,
			password=password
		)
		
		if user:
			click.echo(f'Admin user {username} created successfully!')
		else:
			click.echo('Failed to create admin user!')
	
	@docufusion.command()
	@with_appcontext
	def list_users():
		"""List all users in the system."""
		security_manager = current_app.appbuilder.sm
		users = security_manager.get_all_users()
		
		click.echo('\nUsers in the system:')
		click.echo('-' * 60)
		
		for user in users:
			roles = ', '.join([role.name for role in user.roles])
			status = 'Active' if user.active else 'Inactive'
			click.echo(f'{user.username:<20} {user.email:<30} {status:<10} {roles}')
		
		click.echo(f'\nTotal users: {len(users)}')
	
	@docufusion.command()
	@click.option('--username', required=True, help='Username to activate/deactivate')
	@click.option('--activate/--deactivate', default=True, help='Activate or deactivate user')
	@with_appcontext
	def toggle_user(username, activate):
		"""Activate or deactivate a user."""
		security_manager = current_app.appbuilder.sm
		user = security_manager.find_user(username=username)
		
		if not user:
			click.echo(f'User {username} not found!')
			return
		
		user.active = activate
		security_manager.update_user(user)
		
		status = 'activated' if activate else 'deactivated'
		click.echo(f'User {username} has been {status}!')
	
	@docufusion.command()
	@with_appcontext
	def cleanup_old_data():
		"""Clean up old data from the database."""
		from app import db
		from app.models import DocumentVersion, WorkflowInstance
		
		# Clean up old document versions (keep last 10 per document)
		click.echo('Cleaning up old document versions...')
		
		# This would need a more sophisticated query in production
		old_versions = db.session.query(DocumentVersion).filter(
			DocumentVersion.created_on < datetime.utcnow() - timedelta(days=90),
			DocumentVersion.is_current == False
		).limit(100).all()
		
		for version in old_versions:
			db.session.delete(version)
		
		# Clean up completed workflows older than 30 days
		click.echo('Cleaning up old workflows...')
		
		old_workflows = db.session.query(WorkflowInstance).filter(
			WorkflowInstance.completed_on < datetime.utcnow() - timedelta(days=30),
			WorkflowInstance.status == 'completed'
		).limit(50).all()
		
		for workflow in old_workflows:
			db.session.delete(workflow)
		
		db.session.commit()
		click.echo(f'Cleaned up {len(old_versions)} document versions and {len(old_workflows)} workflows')
	
	@docufusion.command()
	@with_appcontext
	def export_data():
		"""Export system data for backup."""
		import json
		from app.models import Document, Template, Project, Opportunity
		
		export_data = {
			'export_date': datetime.utcnow().isoformat(),
			'documents': [],
			'templates': [],
			'projects': [],
			'opportunities': []
		}
		
		# Export documents
		documents = Document.query.all()
		for doc in documents:
			export_data['documents'].append(doc.to_dict())
		
		# Export templates
		templates = Template.query.all()
		for template in templates:
			export_data['templates'].append({
				'id': template.id,
				'name': template.name,
				'description': template.description,
				'category': template.category,
				'template_content': template.template_content,
				'version': template.version
			})
		
		# Export projects
		projects = Project.query.all()
		for project in projects:
			export_data['projects'].append({
				'id': project.id,
				'name': project.name,
				'description': project.description,
				'client_name': project.client_name,
				'status': project.status,
				'start_date': project.start_date.isoformat() if project.start_date else None,
				'due_date': project.due_date.isoformat() if project.due_date else None
			})
		
		# Export opportunities
		opportunities = Opportunity.query.all()
		for opp in opportunities:
			export_data['opportunities'].append({
				'id': opp.id,
				'title': opp.title,
				'description': opp.description,
				'source_organization': opp.source_organization,
				'opportunity_type': opp.opportunity_type,
				'status': opp.status,
				'estimated_value': opp.estimated_value
			})
		
		# Write to file
		timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
		filename = f'docufusion_export_{timestamp}.json'
		
		with open(filename, 'w') as f:
			json.dump(export_data, f, indent=2, default=str)
		
		click.echo(f'Data exported to {filename}')
		click.echo(f'Exported {len(export_data["documents"])} documents, '
				  f'{len(export_data["templates"])} templates, '
				  f'{len(export_data["projects"])} projects, '
				  f'{len(export_data["opportunities"])} opportunities')
	
	@docufusion.command()
	@click.argument('filename')
	@with_appcontext
	def import_data(filename):
		"""Import system data from backup file."""
		import json
		from app import db
		from app.models import Document, Template, Project, Opportunity
		
		if not os.path.exists(filename):
			click.echo(f'File {filename} not found!')
			return
		
		with open(filename, 'r') as f:
			import_data = json.load(f)
		
		click.echo(f'Importing data from {filename}...')
		
		# Import templates first (documents may reference them)
		template_mapping = {}
		for template_data in import_data.get('templates', []):
			existing = Template.query.filter_by(name=template_data['name']).first()
			if not existing:
				template = Template(
					name=template_data['name'],
					description=template_data.get('description'),
					category=template_data.get('category'),
					template_content=template_data.get('template_content'),
					version=template_data.get('version', '1.0')
				)
				db.session.add(template)
				db.session.flush()  # Get ID
				template_mapping[template_data['id']] = template.id
			else:
				template_mapping[template_data['id']] = existing.id
		
		# Import projects
		project_mapping = {}
		for project_data in import_data.get('projects', []):
			existing = Project.query.filter_by(name=project_data['name']).first()
			if not existing:
				project = Project(
					name=project_data['name'],
					description=project_data.get('description'),
					client_name=project_data.get('client_name'),
					status=project_data.get('status', 'active')
				)
				if project_data.get('start_date'):
					project.start_date = datetime.fromisoformat(project_data['start_date']).date()
				if project_data.get('due_date'):
					project.due_date = datetime.fromisoformat(project_data['due_date']).date()
				
				db.session.add(project)
				db.session.flush()
				project_mapping[project_data['id']] = project.id
			else:
				project_mapping[project_data['id']] = existing.id
		
		# Import documents
		imported_docs = 0
		for doc_data in import_data.get('documents', []):
			existing = Document.query.filter_by(title=doc_data['title']).first()
			if not existing:
				document = Document(
					title=doc_data['title'],
					description=doc_data.get('description'),
					content=doc_data.get('content'),
					document_type=doc_data.get('document_type', 'proposal'),
					status=doc_data.get('status', 'draft'),
					version=doc_data.get('version', '1.0')
				)
				
				# Map template and project IDs
				if doc_data.get('template_id') and doc_data['template_id'] in template_mapping:
					document.template_id = template_mapping[doc_data['template_id']]
				if doc_data.get('project_id') and doc_data['project_id'] in project_mapping:
					document.project_id = project_mapping[doc_data['project_id']]
				
				db.session.add(document)
				imported_docs += 1
		
		# Import opportunities
		imported_opps = 0
		for opp_data in import_data.get('opportunities', []):
			existing = Opportunity.query.filter_by(title=opp_data['title']).first()
			if not existing:
				opportunity = Opportunity(
					title=opp_data['title'],
					description=opp_data.get('description'),
					source_organization=opp_data.get('source_organization'),
					opportunity_type=opp_data.get('opportunity_type', 'rfp'),
					status=opp_data.get('status', 'discovered'),
					estimated_value=opp_data.get('estimated_value')
				)
				db.session.add(opportunity)
				imported_opps += 1
		
		db.session.commit()
		
		click.echo(f'Import completed!')
		click.echo(f'Imported {imported_docs} documents and {imported_opps} opportunities')
	
	@docufusion.command()
	@with_appcontext
	def system_status():
		"""Show system status and health information."""
		from app.models import Document, Template, Project, Opportunity, WorkflowInstance
		
		click.echo('\nDocuFusion System Status')
		click.echo('=' * 40)
		
		# Database statistics
		doc_count = Document.query.count()
		template_count = Template.query.count()
		project_count = Project.query.count()
		opp_count = Opportunity.query.count()
		workflow_count = WorkflowInstance.query.count()
		
		click.echo(f'Documents:     {doc_count}')
		click.echo(f'Templates:     {template_count}')
		click.echo(f'Projects:      {project_count}')
		click.echo(f'Opportunities: {opp_count}')
		click.echo(f'Workflows:     {workflow_count}')
		
		# User statistics
		security_manager = current_app.appbuilder.sm
		users = security_manager.get_all_users()
		active_users = len([u for u in users if u.active])
		
		click.echo(f'Total Users:   {len(users)}')
		click.echo(f'Active Users:  {active_users}')
		
		# System health
		click.echo('\nSystem Health:')
		
		# Check database connection
		try:
			from app import db
			db.session.execute('SELECT 1')
			click.echo('✓ Database connection: OK')
		except Exception as e:
			click.echo(f'✗ Database connection: ERROR - {e}')
		
		# Check file system permissions
		try:
			test_file = 'test_permissions.tmp'
			with open(test_file, 'w') as f:
				f.write('test')
			os.remove(test_file)
			click.echo('✓ File system: OK')
		except Exception as e:
			click.echo(f'✗ File system: ERROR - {e}')
		
		# Check backend integration
		try:
			from app.services.document_service import DocumentService
			doc_service = DocumentService()
			click.echo('✓ Document service: OK')
		except Exception as e:
			click.echo(f'✗ Document service: ERROR - {e}')
		
		click.echo('\nSystem Status Check Complete')
	
	@docufusion.command()
	@click.option('--days', default=7, help='Number of days to analyze')
	@with_appcontext
	def analytics(days):
		"""Show system analytics for the specified number of days."""
		from app.models import Document, Project, Opportunity
		from sqlalchemy import func
		
		cutoff_date = datetime.utcnow() - timedelta(days=days)
		
		click.echo(f'\nDocuFusion Analytics (Last {days} days)')
		click.echo('=' * 50)
		
		# Document activity
		recent_docs = Document.query.filter(Document.created_on >= cutoff_date).count()
		click.echo(f'New Documents:      {recent_docs}')
		
		# Document status distribution
		status_stats = db.session.query(
			Document.status,
			func.count(Document.id).label('count')
		).group_by(Document.status).all()
		
		click.echo('\nDocument Status Distribution:')
		for status, count in status_stats:
			click.echo(f'  {status:<15} {count}')
		
		# Project activity
		recent_projects = Project.query.filter(Project.created_on >= cutoff_date).count()
		click.echo(f'\nNew Projects:       {recent_projects}')
		
		# Opportunity activity
		recent_opps = Opportunity.query.filter(Opportunity.created_on >= cutoff_date).count()
		discovered_opps = Opportunity.query.filter(
			Opportunity.created_on >= cutoff_date,
			Opportunity.status == 'discovered'
		).count()
		
		click.echo(f'New Opportunities:  {recent_opps}')
		click.echo(f'Discovered Opps:    {discovered_opps}')
		
		# Top users by activity
		top_users = db.session.query(
			Document.created_by_fk,
			func.count(Document.id).label('doc_count')
		).filter(
			Document.created_on >= cutoff_date
		).group_by(Document.created_by_fk).order_by(
			func.count(Document.id).desc()
		).limit(5).all()
		
		if top_users:
			click.echo('\nTop Active Users:')
			security_manager = current_app.appbuilder.sm
			for user_id, doc_count in top_users:
				user = security_manager.get_user_by_id(user_id)
				username = user.username if user else 'Unknown'
				click.echo(f'  {username:<20} {doc_count} documents')
	
	click.echo('CLI commands registered successfully')
	return app