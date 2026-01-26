#!/usr/bin/env python3
"""
Example of how to integrate DocuFusion into an existing Flask-AppBuilder application.

This script demonstrates how to add DocuFusion functionality to an existing
Flask-AppBuilder application without running it standalone.
"""

from flask import Flask
from flask_appbuilder import AppBuilder, SQLA

# Import DocuFusion components
from app import create_app
from app.blueprints import register_blueprints
from app.menu import configure_menu
from app.models import *  # Import all DocuFusion models


def integrate_docufusion_into_existing_app(existing_app, existing_appbuilder):
	"""
	Integrate DocuFusion into an existing Flask-AppBuilder application.
	
	Args:
		existing_app: Existing Flask application
		existing_appbuilder: Existing AppBuilder instance
	
	Returns:
		Modified appbuilder with DocuFusion features
	"""
	
	# Add DocuFusion configuration to existing app
	existing_app.config.update({
		'DOCUFUSION_API_BASE': 'http://localhost:8000',
		'DOCUFUSION_ENABLE_COLLABORATION': True,
		'DOCUFUSION_ENABLE_AI_FEATURES': True,
		'DOCUFUSION_ENABLE_WORKFLOW': True,
	})
	
	# Register DocuFusion blueprints (integration mode)
	register_blueprints(existing_appbuilder, standalone=False)
	
	# Configure DocuFusion menu (integration mode)
	configure_menu(existing_appbuilder, standalone=False)
	
	print("DocuFusion successfully integrated into existing application")
	print("Available DocuFusion features:")
	print("  - Document management")
	print("  - Template library")
	print("  - Project organization")
	print("  - Opportunity discovery")
	print("  - AI-powered content enhancement")
	print("  - Collaboration tools")
	print("  - Workflow automation")
	
	return existing_appbuilder


def example_integration():
	"""
	Example of complete integration setup.
	This shows how you would modify your existing Flask-AppBuilder app.
	"""
	
	# Your existing Flask-AppBuilder setup
	app = Flask(__name__)
	app.config.from_object('your_existing_config')
	
	db = SQLA(app)
	appbuilder = AppBuilder(app, db.session)
	
	# Your existing views and models would be here
	# from your_app.views import YourExistingViews
	# appbuilder.add_view(YourExistingViews, "Your Feature", category="Your Category")
	
	# Integrate DocuFusion
	integrate_docufusion_into_existing_app(app, appbuilder)
	
	# Continue with your existing application setup
	return app


def selective_integration_example():
	"""
	Example of selective integration - only adding specific DocuFusion features.
	"""
	from app.blueprints.documents import DocumentModelView, DocumentApi
	from app.blueprints.templates import TemplateModelView, TemplateApi
	from app.blueprints.ai_features import AIFeaturesView, AIFeaturesApi
	
	# Your existing setup
	app = Flask(__name__)
	app.config.from_object('your_existing_config')
	
	db = SQLA(app)
	appbuilder = AppBuilder(app, db.session)
	
	# Add only specific DocuFusion features
	appbuilder.add_view(
		DocumentModelView,
		"Documents",
		icon="fa-file-text-o",
		category="DocuFusion"
	)
	
	appbuilder.add_view(
		TemplateModelView,
		"Templates",
		icon="fa-file-code-o", 
		category="DocuFusion"
	)
	
	appbuilder.add_view(
		AIFeaturesView,
		"AI Assistant",
		icon="fa-magic",
		category="DocuFusion"
	)
	
	# Add APIs
	appbuilder.add_api(DocumentApi)
	appbuilder.add_api(TemplateApi)
	appbuilder.add_api(AIFeaturesApi)
	
	print("Selective DocuFusion integration completed")
	return app


if __name__ == '__main__':
	print("DocuFusion Integration Examples")
	print("=" * 40)
	print()
	print("This file contains examples of how to integrate DocuFusion")
	print("into existing Flask-AppBuilder applications.")
	print()
	print("Integration options:")
	print("1. Full integration: integrate_docufusion_into_existing_app()")
	print("2. Selective integration: selective_integration_example()")
	print()
	print("See the function implementations above for details.")
	
	# Run example
	# app = example_integration()
	# app.run(debug=True)