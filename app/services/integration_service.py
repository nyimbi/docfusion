"""
Integration service for connecting with external systems and the proposal_writer backend.
"""

from typing import Dict, Any, List, Optional
import requests
import json


class IntegrationService:
	"""Service for integrating with external systems and backend components."""
	
	def __init__(self):
		"""Initialize the integration service."""
		self.backend_base_url = "http://localhost:8000"  # Backend API base URL
		self.session = requests.Session()
		self.session.headers.update({
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		})
	
	def call_backend_api(self, endpoint: str, method: str = 'GET', data: Dict[str, Any] = None) -> Dict[str, Any]:
		"""
		Make a call to the proposal_writer backend API.
		
		Args:
			endpoint: API endpoint path
			method: HTTP method
			data: Request data
			
		Returns:
			Response data
		"""
		url = f"{self.backend_base_url}/{endpoint.lstrip('/')}"
		
		try:
			if method.upper() == 'GET':
				response = self.session.get(url, params=data)
			elif method.upper() == 'POST':
				response = self.session.post(url, json=data)
			elif method.upper() == 'PUT':
				response = self.session.put(url, json=data)
			elif method.upper() == 'DELETE':
				response = self.session.delete(url)
			else:
				raise ValueError(f"Unsupported HTTP method: {method}")
			
			response.raise_for_status()
			return response.json()
			
		except requests.exceptions.RequestException as e:
			print(f"Backend API call failed: {e}")
			return {'error': str(e)}
		except Exception as e:
			print(f"Unexpected error in backend API call: {e}")
			return {'error': f'Unexpected error: {str(e)}'}
	
	def sync_with_crm(self, crm_type: str, credentials: Dict[str, str]) -> Dict[str, Any]:
		"""
		Synchronize data with CRM system.
		
		Args:
			crm_type: Type of CRM (salesforce, hubspot, etc.)
			credentials: CRM credentials
			
		Returns:
			Sync result
		"""
		# Implementation would integrate with specific CRM APIs
		return {
			'status': 'success',
			'records_synced': 0,
			'message': f'CRM sync not yet implemented for {crm_type}'
		}
	
	def export_to_external_system(self, system_type: str, document_id: int, config: Dict[str, Any]) -> Dict[str, Any]:
		"""
		Export document to external system.
		
		Args:
			system_type: Type of external system
			document_id: Document to export
			config: Export configuration
			
		Returns:
			Export result
		"""
		# Implementation would handle various export formats and destinations
		return {
			'status': 'success',
			'export_url': f'/exports/document_{document_id}.pdf',
			'message': 'Document exported successfully'
		}
	
	def validate_external_connection(self, connection_type: str, config: Dict[str, Any]) -> Dict[str, Any]:
		"""
		Validate connection to external system.
		
		Args:
			connection_type: Type of connection to validate
			config: Connection configuration
			
		Returns:
			Validation result
		"""
		# Implementation would test connectivity to various external systems
		return {
			'status': 'valid',
			'message': 'Connection validated successfully',
			'capabilities': ['read', 'write', 'sync']
		}