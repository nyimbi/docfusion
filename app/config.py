"""
Configuration for DocuFusion Flask-AppBuilder Application
"""

import os
from datetime import timedelta


class Config:
	"""Base configuration class."""
	
	# Flask core settings
	SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
	
	# Database configuration
	SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///docufusion.db'
	SQLALCHEMY_TRACK_MODIFICATIONS = False
	SQLALCHEMY_ENGINE_OPTIONS = {
		'pool_pre_ping': True,
		'pool_recycle': 300,
	}
	
	# Flask-AppBuilder configuration
	APP_NAME = "DocuFusion"
	APP_THEME = "cerulean.css"  # Can be changed to other Bootswatch themes
	APP_ICON = "fa-file-text-o"
	
	# Security configuration
	AUTH_TYPE = 1  # Database authentication
	AUTH_ROLE_ADMIN = 'Admin'
	AUTH_ROLE_PUBLIC = 'Public'
	AUTH_USER_REGISTRATION = True
	AUTH_USER_REGISTRATION_ROLE = "User"
	
	# Session configuration
	PERMANENT_SESSION_LIFETIME = timedelta(hours=24)
	
	# File upload configuration
	UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER') or 'uploads/'
	MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
	
	# DocuFusion specific settings
	DOCUFUSION_API_BASE = os.environ.get('DOCUFUSION_API_BASE') or 'http://localhost:8000'
	DOCUFUSION_ENABLE_COLLABORATION = True
	DOCUFUSION_ENABLE_AI_FEATURES = True
	DOCUFUSION_ENABLE_WORKFLOW = True
	
	# Babel configuration for internationalization
	LANGUAGES = {
		'en': {'flag': 'us', 'name': 'English'},
		'es': {'flag': 'es', 'name': 'Spanish'},
		'fr': {'flag': 'fr', 'name': 'French'},
		'de': {'flag': 'de', 'name': 'German'},
	}
	BABEL_DEFAULT_LOCALE = 'en'
	BABEL_DEFAULT_TIMEZONE = 'UTC'
	
	# Logging configuration
	LOG_LEVEL = os.environ.get('LOG_LEVEL') or 'INFO'
	
	# Redis configuration for caching and sessions (optional)
	REDIS_URL = os.environ.get('REDIS_URL')
	if REDIS_URL:
		CACHE_TYPE = 'redis'
		CACHE_REDIS_URL = REDIS_URL
	else:
		CACHE_TYPE = 'simple'
	
	# Email configuration
	MAIL_SERVER = os.environ.get('MAIL_SERVER')
	MAIL_PORT = int(os.environ.get('MAIL_PORT') or 587)
	MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() in ['true', 'on', '1']
	MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
	MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
	
	# Celery configuration for async tasks
	CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL') or 'redis://localhost:6379/0'
	CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND') or 'redis://localhost:6379/0'


class DevelopmentConfig(Config):
	"""Development configuration."""
	
	DEBUG = True
	SQLALCHEMY_ECHO = True
	LOG_LEVEL = 'DEBUG'
	
	# Disable CSRF for development convenience (enable in production)
	WTF_CSRF_ENABLED = False


class TestingConfig(Config):
	"""Testing configuration."""
	
	TESTING = True
	SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
	WTF_CSRF_ENABLED = False
	
	# Disable authentication for testing
	AUTH_TYPE = 0


class ProductionConfig(Config):
	"""Production configuration."""
	
	DEBUG = False
	TESTING = False
	
	# Enhanced security settings
	SESSION_COOKIE_SECURE = True
	SESSION_COOKIE_HTTPONLY = True
	SESSION_COOKIE_SAMESITE = 'Lax'
	
	# Enforce HTTPS
	PREFERRED_URL_SCHEME = 'https'
	
	# Rate limiting
	RATELIMIT_STORAGE_URL = os.environ.get('REDIS_URL') or 'memory://'


# Configuration mapping
config = {
	'development': DevelopmentConfig,
	'testing': TestingConfig,
	'production': ProductionConfig,
	'default': DevelopmentConfig
}