"""
Menu configuration for DocuFusion Flask-AppBuilder application.
"""

from flask_appbuilder.menu import Menu


def configure_menu(appbuilder, standalone=True):
	"""
	Configure the application menu structure.
	
	Args:
		appbuilder: Flask-AppBuilder instance
		standalone: If True, configure full menu. If False, configure minimal menu for integration.
	"""
	
	if standalone:
		# Full standalone menu configuration
		
		# Dashboard menu (if standalone)
		appbuilder.add_link(
			"Dashboard",
			href="/dashboardview/",
			icon="fa-dashboard",
			category="",
			category_icon="fa-dashboard"
		)
		
		# Separator
		appbuilder.add_separator("Documents")
		
		# Quick actions menu
		appbuilder.add_view_no_menu(name="Quick Actions")
		appbuilder.add_link(
			"New Document",
			href="/documentmodelview/add",
			icon="fa-plus",
			category="Quick Actions",
			category_icon="fa-bolt"
		)
		
		appbuilder.add_link(
			"New Project",
			href="/projectmodelview/add",
			icon="fa-folder-open",
			category="Quick Actions"
		)
		
		appbuilder.add_link(
			"New Template",
			href="/templatemodelview/add",
			icon="fa-file-code-o",
			category="Quick Actions"
		)
		
		# AI Tools submenu
		appbuilder.add_link(
			"Content Enhancement",
			href="/aifeaturesview/",
			icon="fa-magic",
			category="AI Tools",
			category_icon="fa-magic"
		)
		
		appbuilder.add_link(
			"Document Analysis",
			href="/documentmodelview/list",
			icon="fa-line-chart",
			category="AI Tools"
		)
		
		appbuilder.add_link(
			"Voice DNA Check",
			href="/aifeaturesview/",
			icon="fa-user-circle",
			category="AI Tools"
		)
		
		# Discovery submenu
		appbuilder.add_link(
			"Opportunity Dashboard",
			href="/opportunitymodelview/dashboard",
			icon="fa-dashboard",
			category="Discovery",
			category_icon="fa-search"
		)
		
		appbuilder.add_link(
			"Bulk Analysis",
			href="/opportunitymodelview/bulk_analyze",
			icon="fa-cogs",
			category="Discovery"
		)
		
		# Collaboration submenu
		appbuilder.add_link(
			"Active Collaborations",
			href="/collaborationview/",
			icon="fa-users",
			category="Collaboration",
			category_icon="fa-users"
		)
		
		appbuilder.add_link(
			"Document Comments",
			href="/collaborationview/",
			icon="fa-comments",
			category="Collaboration"
		)
		
		# Workflow submenu
		appbuilder.add_link(
			"Active Workflows",
			href="/workflowview/",
			icon="fa-play",
			category="Workflow",
			category_icon="fa-sitemap"
		)
		
		appbuilder.add_link(
			"Workflow Templates",
			href="/workflowview/",
			icon="fa-copy",
			category="Workflow"
		)
		
		# Analytics submenu (for users with analytics permission)
		appbuilder.add_link(
			"System Analytics",
			href="/dashboardview/",
			icon="fa-bar-chart",
			category="Analytics",
			category_icon="fa-bar-chart"
		)
		
		appbuilder.add_link(
			"User Productivity",
			href="/dashboardview/",
			icon="fa-user",
			category="Analytics"
		)
		
		appbuilder.add_link(
			"Quality Metrics",
			href="/dashboardview/",
			icon="fa-trophy",
			category="Analytics"
		)
		
		# Settings submenu
		appbuilder.add_link(
			"System Settings",
			href="/dashboardview/",
			icon="fa-cog",
			category="Settings",
			category_icon="fa-cog"
		)
		
		appbuilder.add_link(
			"User Preferences",
			href="/dashboardview/",
			icon="fa-user-cog",
			category="Settings"
		)
		
		# Help menu
		appbuilder.add_link(
			"Documentation",
			href="/static/docs/index.html",
			icon="fa-book",
			category="Help",
			category_icon="fa-question-circle"
		)
		
		appbuilder.add_link(
			"API Reference",
			href="/api/v1/",
			icon="fa-code",
			category="Help"
		)
		
		appbuilder.add_link(
			"Support",
			href="mailto:support@docufusion.com",
			icon="fa-envelope",
			category="Help"
		)
	
	else:
		# Minimal menu for integration mode
		
		# Just add essential DocuFusion links to existing menu
		appbuilder.add_link(
			"DocuFusion Dashboard",
			href="/dashboardview/",
			icon="fa-file-text-o",
			category="DocuFusion",
			category_icon="fa-file-text-o"
		)
		
		appbuilder.add_link(
			"Documents",
			href="/documentmodelview/list",
			icon="fa-file",
			category="DocuFusion"
		)
		
		appbuilder.add_link(
			"Templates",
			href="/templatemodelview/list",
			icon="fa-file-code-o",
			category="DocuFusion"
		)
		
		appbuilder.add_link(
			"Projects",
			href="/projectmodelview/list",
			icon="fa-folder",
			category="DocuFusion"
		)
		
		appbuilder.add_link(
			"Opportunities",
			href="/opportunitymodelview/list",
			icon="fa-search",
			category="DocuFusion"
		)


def add_custom_menu_items(appbuilder):
	"""
	Add custom menu items that might be specific to the deployment.
	This function can be called from the main application to add
	deployment-specific menu items.
	"""
	
	# Example: Add industry-specific menu items
	# This could be configured based on the organization's needs
	
	# Government contracting specific items
	appbuilder.add_link(
		"FAR Compliance Check",
		href="/complianceview/",
		icon="fa-shield",
		category="Government",
		category_icon="fa-university"
	)
	
	appbuilder.add_link(
		"DFARS Requirements",
		href="/complianceview/",
		icon="fa-flag",
		category="Government"
	)
	
	# Commercial specific items
	appbuilder.add_link(
		"RFP Templates",
		href="/templatemodelview/list?category=rfp_response",
		icon="fa-file-text",
		category="Commercial",
		category_icon="fa-building"
	)
	
	appbuilder.add_link(
		"Proposal Library",
		href="/documentmodelview/list?document_type=proposal",
		icon="fa-archive",
		category="Commercial"
	)


def setup_role_based_menu(appbuilder, user_roles):
	"""
	Configure menu visibility based on user roles.
	
	Args:
		appbuilder: Flask-AppBuilder instance
		user_roles: List of user role names
	"""
	
	# Hide/show menu items based on roles
	if 'ComplianceOfficer' in user_roles:
		# Show compliance-specific menu items
		appbuilder.add_link(
			"Compliance Dashboard",
			href="/complianceview/",
			icon="fa-shield",
			category="My Tools",
			category_icon="fa-user"
		)
	
	if 'ProjectManager' in user_roles:
		# Show project management specific items
		appbuilder.add_link(
			"Project Dashboard",
			href="/projectmodelview/list",
			icon="fa-tasks",
			category="My Tools",
			category_icon="fa-user"
		)
	
	if 'DocumentEditor' in user_roles:
		# Show editor-specific tools
		appbuilder.add_link(
			"My Documents",
			href="/documentmodelview/list",
			icon="fa-edit",
			category="My Tools",
			category_icon="fa-user"
		)
	
	if 'Admin' in user_roles:
		# Show admin-specific items
		appbuilder.add_link(
			"System Health",
			href="/dashboardview/api/stats",
			icon="fa-heartbeat",
			category="Administration",
			category_icon="fa-gear"
		)
		
		appbuilder.add_link(
			"User Management",
			href="/users/userdbmodelview/list",
			icon="fa-users",
			category="Administration"
		)
		
		appbuilder.add_link(
			"System Logs",
			href="/dashboardview/",
			icon="fa-list-alt",
			category="Administration"
		)