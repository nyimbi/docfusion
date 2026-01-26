"""
Flask-AppBuilder Application for DocuFusion Proposal Writer

This module provides a complete Flask-AppBuilder frontend that can be used
either standalone or integrated into other Flask-AppBuilder applications.
"""

import os
import logging
from flask import Flask
from flask_appbuilder import AppBuilder, SQLA
from flask_appbuilder.menu import Menu
from flask_appbuilder.security.manager import SecurityManager
from sqlalchemy.engine import Engine
from sqlalchemy import event
from .security import DocuFusionSecurityManager
from .config import Config

# Logging configuration
logging.basicConfig(format="%(asctime)s:%(levelname)s:%(name)s:%(message)s")
logging.getLogger().setLevel(logging.DEBUG)

db = SQLA()
appbuilder = AppBuilder()


def create_app(config_class=Config, standalone=True):
	"""
	Create and configure the Flask application.
	
	Args:
		config_class: Configuration class to use
		standalone: If True, configure for standalone operation.
					If False, configure for integration into existing app.
	
	Returns:
		Flask application instance
	"""
	app = Flask(__name__)
	app.config.from_object(config_class)
	
	# Initialize extensions
	db.init_app(app)
	
	# Configure security manager
	security_manager_class = DocuFusionSecurityManager if standalone else SecurityManager
	
	appbuilder.init_app(
		app, 
		db.session,
		security_manager_class=security_manager_class
	)
	
	# Register blueprints
	from .blueprints import register_blueprints
	register_blueprints(appbuilder, standalone=standalone)
	
	# Configure menu
	from .menu import configure_menu
	configure_menu(appbuilder, standalone=standalone)
	
	# Set up database listeners for performance
	@event.listens_for(Engine, "connect")
	def set_sqlite_pragma(dbapi_connection, connection_record):
		if 'sqlite' in str(dbapi_connection):
			cursor = dbapi_connection.cursor()
			cursor.execute("PRAGMA foreign_keys=ON")
			cursor.close()
	
	# Error handlers
	@app.errorhandler(404)
	def not_found(error):
		return appbuilder.render_template('404.html'), 404
	
	@app.errorhandler(500)
	def internal_error(error):
		db.session.rollback()
		return appbuilder.render_template('500.html'), 500
	
	return app