"""
Blueprint registration for DocuFusion Flask-AppBuilder application.
"""

from .documents import DocumentModelView, DocumentApi
from .templates import TemplateModelView, TemplateApi
from .projects import ProjectModelView, ProjectApi
from .opportunities import OpportunityModelView, OpportunityApi
from .collaboration import CollaborationView, CollaborationApi
from .workflows import WorkflowView, WorkflowApi
from .dashboards import DashboardView, ExecutiveDashboardView
from .ai_features import AIFeaturesView, AIFeaturesApi
from .compliance import ComplianceView, ComplianceApi


def register_blueprints(appbuilder, standalone=True):
	"""
	Register all DocuFusion blueprints with the AppBuilder.
	
	Args:
		appbuilder: Flask-AppBuilder instance
		standalone: If True, register all views. If False, only register
				   views suitable for integration.
	"""
	
	# Core document management views
	appbuilder.add_view(
		DocumentModelView,
		"Documents",
		icon="fa-file-text-o",
		category="Documents"
	)
	
	appbuilder.add_view(
		TemplateModelView,
		"Templates", 
		icon="fa-file-code-o",
		category="Documents"
	)
	
	appbuilder.add_view(
		ProjectModelView,
		"Projects",
		icon="fa-folder-o",
		category="Projects"
	)
	
	appbuilder.add_view(
		OpportunityModelView,
		"Opportunities",
		icon="fa-search",
		category="Discovery"
	)
	
	# Collaboration features
	appbuilder.add_view(
		CollaborationView,
		"Collaboration",
		icon="fa-users",
		category="Collaboration"
	)
	
	# Workflow management
	appbuilder.add_view(
		WorkflowView,
		"Workflows",
		icon="fa-sitemap",
		category="Workflow"
	)
	
	# AI Features
	appbuilder.add_view(
		AIFeaturesView,
		"AI Assistant",
		icon="fa-magic",
		category="AI Tools"
	)
	
	# Compliance
	appbuilder.add_view(
		ComplianceView,
		"Compliance",
		icon="fa-shield",
		category="Compliance"
	)
	
	# Dashboards (only in standalone mode or if specifically enabled)
	if standalone:
		appbuilder.add_view_no_menu(DashboardView)
		appbuilder.add_view(
			ExecutiveDashboardView,
			"Executive Dashboard",
			icon="fa-dashboard",
			category="Dashboards"
		)
	
	# API endpoints
	appbuilder.add_api(DocumentApi)
	appbuilder.add_api(TemplateApi)
	appbuilder.add_api(ProjectApi)
	appbuilder.add_api(OpportunityApi)
	appbuilder.add_api(CollaborationApi)
	appbuilder.add_api(WorkflowApi)
	appbuilder.add_api(AIFeaturesApi)
	appbuilder.add_api(ComplianceApi)