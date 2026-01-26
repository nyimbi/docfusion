"""
Template service for managing document templates.
"""

import re
import json
from typing import Dict, Any, List, Optional
from jinja2 import Template, Environment, BaseLoader, TemplateError


class TemplateService:
	"""
	Service class for template operations including rendering,
	validation, and variable extraction.
	"""
	
	def __init__(self):
		"""Initialize the template service."""
		self.jinja_env = Environment(loader=BaseLoader())
		
		# Sample data for different document categories
		self.sample_data = {
			'rfp_response': {
				'client_name': 'ABC Corporation',
				'project_title': 'Enterprise Software Implementation',
				'company_name': 'Your Company Name',
				'project_manager': 'John Smith',
				'proposal_date': '2024-01-15',
				'project_duration': '6 months',
				'budget': '$150,000',
				'team_size': '5-7 members',
				'delivery_date': '2024-07-15',
				'contact_email': 'contact@yourcompany.com',
				'phone': '+1-555-0123'
			},
			'proposal': {
				'client_name': 'Global Enterprises Ltd',
				'project_title': 'Digital Transformation Initiative',
				'company_name': 'Innovation Solutions Inc',
				'project_lead': 'Sarah Johnson',
				'proposal_date': '2024-01-20',
				'estimated_value': '$250,000',
				'timeline': '8-10 months',
				'methodology': 'Agile/Scrum',
				'deliverables': ['Requirements Analysis', 'System Design', 'Implementation', 'Testing', 'Training']
			},
			'contract': {
				'party_a': 'Service Provider LLC',
				'party_b': 'Client Corporation',
				'contract_date': '2024-01-25',
				'service_description': 'Professional consulting services',
				'contract_value': '$75,000',
				'start_date': '2024-02-01',
				'end_date': '2024-08-01',
				'payment_terms': 'Net 30 days',
				'jurisdiction': 'State of California'
			},
			'report': {
				'report_title': 'Quarterly Business Analysis',
				'reporting_period': 'Q4 2023',
				'author': 'Business Analysis Team',
				'date_prepared': '2024-01-10',
				'executive_summary': 'Summary of key findings and recommendations',
				'key_metrics': ['Revenue Growth: 15%', 'Customer Satisfaction: 92%', 'Market Share: 8.5%']
			},
			'presentation': {
				'presentation_title': 'Strategic Planning Session',
				'presenter': 'Executive Team',
				'audience': 'Board of Directors',
				'date': '2024-02-01',
				'agenda_items': ['Market Analysis', 'Financial Performance', 'Growth Strategy', 'Q&A'],
				'objectives': ['Align on strategic priorities', 'Approve budget allocation', 'Set quarterly goals']
			}
		}
	
	def render_template(self, template_content: str, data: Dict[str, Any]) -> str:
		"""
		Render template with provided data using Jinja2.
		
		Args:
			template_content: Template content with Jinja2 syntax
			data: Dictionary of variables to substitute
			
		Returns:
			Rendered template content
		"""
		try:
			template = self.jinja_env.from_string(template_content)
			return template.render(**data)
		except TemplateError as e:
			raise ValueError(f"Template rendering error: {str(e)}")
		except Exception as e:
			raise ValueError(f"Unexpected error during template rendering: {str(e)}")
	
	def extract_variables(self, template_content: str) -> List[str]:
		"""
		Extract variable names from template content.
		
		Args:
			template_content: Template content to analyze
			
		Returns:
			List of unique variable names found in template
		"""
		# Pattern to match Jinja2 variables {{ variable_name }}
		variable_pattern = r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}'
		
		# Find all variable matches
		matches = re.findall(variable_pattern, template_content)
		
		# Return unique variables
		return list(set(matches))
	
	def validate_template(self, template) -> Dict[str, Any]:
		"""
		Validate template syntax and structure.
		
		Args:
			template: Template model instance
			
		Returns:
			Dictionary containing validation results
		"""
		result = {
			'is_valid': True,
			'errors': [],
			'warnings': [],
			'variables': [],
			'statistics': {}
		}
		
		try:
			# Test template syntax
			jinja_template = self.jinja_env.from_string(template.template_content)
			
			# Extract variables
			variables = self.extract_variables(template.template_content)
			result['variables'] = variables
			
			# Test rendering with sample data
			sample_data = self.get_sample_data(template.category)
			try:
				rendered = jinja_template.render(**sample_data)
				result['statistics']['rendered_length'] = len(rendered)
			except Exception as e:
				result['warnings'].append(f"Template renders with errors using sample data: {str(e)}")
			
			# Basic content validation
			if not template.template_content.strip():
				result['errors'].append("Template content is empty")
			
			if len(variables) == 0:
				result['warnings'].append("Template contains no variables")
			
			# Check for common issues
			if '{{' in template.template_content and '}}' not in template.template_content:
				result['errors'].append("Unclosed variable tags found")
			
			if '{%' in template.template_content and '%}' not in template.template_content:
				result['errors'].append("Unclosed control tags found")
			
		except TemplateError as e:
			result['is_valid'] = False
			result['errors'].append(f"Template syntax error: {str(e)}")
		except Exception as e:
			result['is_valid'] = False
			result['errors'].append(f"Validation error: {str(e)}")
		
		# Set overall validity
		if result['errors']:
			result['is_valid'] = False
		
		return result
	
	def get_sample_data(self, category: str) -> Dict[str, Any]:
		"""
		Get sample data for template category.
		
		Args:
			category: Template category
			
		Returns:
			Dictionary of sample data
		"""
		return self.sample_data.get(category, self.sample_data['proposal'])
	
	def analyze_template_structure(self, template) -> Dict[str, Any]:
		"""
		Analyze template structure and complexity.
		
		Args:
			template: Template model instance
			
		Returns:
			Dictionary containing structure analysis
		"""
		content = template.template_content or ''
		
		analysis = {
			'character_count': len(content),
			'line_count': len(content.split('\n')),
			'variable_count': len(self.extract_variables(content)),
			'has_conditionals': '{%' in content and 'if' in content,
			'has_loops': '{%' in content and 'for' in content,
			'complexity_score': 0
		}
		
		# Calculate complexity score
		complexity = 0
		complexity += len(self.extract_variables(content))  # Variables add complexity
		complexity += content.count('{% if') * 2  # Conditionals add more complexity
		complexity += content.count('{% for') * 3  # Loops add even more complexity
		complexity += content.count('{% block') * 2  # Template inheritance
		
		analysis['complexity_score'] = complexity
		
		# Determine complexity level
		if complexity < 5:
			analysis['complexity_level'] = 'Simple'
		elif complexity < 15:
			analysis['complexity_level'] = 'Moderate'
		else:
			analysis['complexity_level'] = 'Complex'
		
		# Update template structure in database
		if hasattr(template, 'template_structure'):
			template.template_structure = analysis
		
		return analysis
	
	def export_template(self, template) -> Dict[str, Any]:
		"""
		Export template as structured data for sharing.
		
		Args:
			template: Template model instance
			
		Returns:
			Dictionary containing exportable template data
		"""
		export_data = {
			'format_version': '1.0',
			'template': {
				'name': template.name,
				'description': template.description,
				'category': template.category,
				'version': template.version,
				'content': template.template_content,
				'structure': template.template_structure,
				'variables': self.extract_variables(template.template_content or ''),
				'metadata': {
					'is_public': template.is_public,
					'created_on': template.created_on.isoformat() if template.created_on else None,
					'export_date': '2024-01-01T00:00:00'  # Current timestamp would go here
				}
			}
		}
		
		return export_data
	
	def import_template(self, template_data: Dict[str, Any]):
		"""
		Import template from structured data.
		
		Args:
			template_data: Dictionary containing template data
			
		Returns:
			Template model instance
		"""
		from ..models import Template
		import uuid
		
		# Validate import data
		if 'template' not in template_data:
			raise ValueError("Invalid template data format")
		
		template_info = template_data['template']
		
		# Create new template
		template = Template(
			template_id=str(uuid.uuid4()),
			name=template_info.get('name', 'Imported Template'),
			description=template_info.get('description', ''),
			category=template_info.get('category', 'other'),
			template_content=template_info.get('content', ''),
			template_structure=template_info.get('structure', {}),
			version=template_info.get('version', '1.0'),
			is_active=True,
			is_public=False  # Imported templates are private by default
		)
		
		return template
	
	def suggest_improvements(self, template) -> List[Dict[str, str]]:
		"""
		Suggest improvements for template quality.
		
		Args:
			template: Template model instance
			
		Returns:
			List of improvement suggestions
		"""
		suggestions = []
		content = template.template_content or ''
		variables = self.extract_variables(content)
		
		# Check for missing description
		if not template.description or len(template.description.strip()) < 10:
			suggestions.append({
				'type': 'content',
				'priority': 'medium',
				'message': 'Add a detailed description to help users understand the template purpose'
			})
		
		# Check for variable documentation
		if variables and '{{' in content:
			# Look for comment documentation
			if not ('<!--' in content or '{#' in content):
				suggestions.append({
					'type': 'documentation',
					'priority': 'medium',
					'message': 'Add comments to document template variables and their usage'
				})
		
		# Check template length
		if len(content) < 100:
			suggestions.append({
				'type': 'content',
				'priority': 'low',
				'message': 'Template seems very short. Consider adding more comprehensive content'
			})
		elif len(content) > 10000:
			suggestions.append({
				'type': 'structure',
				'priority': 'medium',
				'message': 'Template is very long. Consider breaking it into smaller, reusable components'
			})
		
		# Check for error handling in complex templates
		if '{%' in content and 'if' in content:
			if 'else' not in content:
				suggestions.append({
					'type': 'logic',
					'priority': 'low',
					'message': 'Consider adding else clauses for better error handling in conditional statements'
				})
		
		return suggestions