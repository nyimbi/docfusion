#!/usr/bin/env python3
"""
Input Validators

Comprehensive input validation for API requests including business rules,
security validation, content validation, and custom validation logic.
"""

import re
import logging
from typing import Dict, List, Any
from datetime import datetime
from urllib.parse import urlparse
import html
import bleach



class ValidationResult:
	"""Result of input validation"""
	
	def __init__(self, is_valid: bool = True):
		self.is_valid = is_valid
		self.errors: List[str] = []
		self.warnings: List[str] = []
		self.sanitized_data: Dict[str, Any] = {}
	
	def add_error(self, message: str):
		"""Add validation error"""
		self.errors.append(message)
		self.is_valid = False
	
	def add_warning(self, message: str):
		"""Add validation warning"""
		self.warnings.append(message)
	
	def to_dict(self) -> Dict[str, Any]:
		"""Convert to dictionary"""
		return {
			'is_valid': self.is_valid,
			'errors': self.errors,
			'warnings': self.warnings,
			'sanitized_data': self.sanitized_data
		}


class SecurityValidator:
	"""Security-focused input validation"""
	
	def __init__(self):
		self.logger = logging.getLogger(__name__)
		
		# Common attack patterns
		self.xss_patterns = [
			r'<script[^>]*>.*?</script>',
			r'javascript:',
			r'on\w+\s*=',
			r'<iframe[^>]*>.*?</iframe>',
			r'<object[^>]*>.*?</object>',
			r'<embed[^>]*>.*?</embed>'
		]
		
		self.sql_injection_patterns = [
			r'(\bunion\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bcreate\b|\balter\b)',
			r'(\bor\b\s+\b1\s*=\s*1\b|\band\b\s+\b1\s*=\s*1\b)',
			r'(\bexec\b|\bexecute\b|\bsp_\w+)',
			r'(--|/\*|\*/)',
			r'(\bchar\b|\bnchar\b|\bvarchar\b|\bnvarchar\b)\s*\(',
			r'\b(waitfor\s+delay|benchmark)\b'
		]
		
		self.command_injection_patterns = [
			r'[;&|`$()]',
			r'(curl\b|wget\b|nc\b|netcat\b)',
			r'(\bcat\b|\bls\b|\bps\b|\bgrep\b|\bfind\b)',
			r'(\.\.\/|\.\.\\\)',
			r'(\beval\b|\bexec\b|\bsystem\b)'
		]
	
	def validate_text_content(self, content: str, field_name: str = "content") -> ValidationResult:
		"""Validate text content for security threats"""
		result = ValidationResult()
		
		if not content:
			return result
		
		# Check for XSS attempts
		for pattern in self.xss_patterns:
			if re.search(pattern, content, re.IGNORECASE):
				result.add_error(f"{field_name} contains potential XSS content")
				break
		
		# Check for SQL injection attempts
		for pattern in self.sql_injection_patterns:
			if re.search(pattern, content, re.IGNORECASE):
				result.add_error(f"{field_name} contains potential SQL injection content")
				break
		
		# Check for command injection attempts
		for pattern in self.command_injection_patterns:
			if re.search(pattern, content):
				result.add_error(f"{field_name} contains potential command injection content")
				break
		
		# Sanitize content if valid
		if result.is_valid:
			result.sanitized_data[field_name] = self.sanitize_html(content)
		
		return result
	
	def sanitize_html(self, content: str) -> str:
		"""Sanitize HTML content"""
		# Allowed HTML tags and attributes
		allowed_tags = [
			'p', 'br', 'strong', 'em', 'u', 'i', 'b',
			'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
			'ul', 'ol', 'li', 'blockquote', 'code', 'pre'
		]
		
		allowed_attributes = {
			'*': ['class'],
			'a': ['href', 'title'],
			'img': ['src', 'alt', 'title', 'width', 'height']
		}
		
		return bleach.clean(content, tags=allowed_tags, attributes=allowed_attributes, strip=True)
	
	def validate_file_path(self, file_path: str) -> ValidationResult:
		"""Validate file path for directory traversal"""
		result = ValidationResult()
		
		if not file_path:
			return result
		
		# Check for directory traversal attempts
		if '..' in file_path or file_path.startswith('/'):
			result.add_error("Invalid file path - directory traversal detected")
		
		# Check for suspicious file extensions
		suspicious_extensions = ['.exe', '.bat', '.sh', '.php', '.asp', '.jsp']
		if any(file_path.lower().endswith(ext) for ext in suspicious_extensions):
			result.add_warning("Potentially unsafe file extension")
		
		return result
	
	def validate_url(self, url: str) -> ValidationResult:
		"""Validate URL for security"""
		result = ValidationResult()
		
		if not url:
			return result
		
		try:
			parsed = urlparse(url)
			
			# Only allow HTTP and HTTPS
			if parsed.scheme not in ['http', 'https']:
				result.add_error("Only HTTP and HTTPS URLs are allowed")
			
			# Block localhost and private IPs in production
			hostname = parsed.hostname
			if hostname:
				if hostname in ['localhost', '127.0.0.1', '0.0.0.0']:
					result.add_warning("Localhost URLs should be avoided in production")
				
				# Check for private IP ranges
				if self._is_private_ip(hostname):
					result.add_warning("Private IP addresses should be avoided")
			
		except Exception as e:
			result.add_error(f"Invalid URL format: {e}")
		
		return result
	
	def _is_private_ip(self, ip: str) -> bool:
		"""Check if IP is in private range"""
		try:
			import ipaddress
			ip_obj = ipaddress.ip_address(ip)
			return ip_obj.is_private
		except Exception as e:
			self.logger.warning(f"Failed to validate IP '{ip}': {e}")
			return False


class BusinessRuleValidator:
	"""Business rule validation"""
	
	def __init__(self):
		self.logger = logging.getLogger(__name__)
	
	def validate_document_title(self, title: str) -> ValidationResult:
		"""Validate document title"""
		result = ValidationResult()
		
		if not title or not title.strip():
			result.add_error("Document title is required")
			return result
		
		title = title.strip()
		
		# Length validation
		if len(title) < 3:
			result.add_error("Document title must be at least 3 characters")
		elif len(title) > 255:
			result.add_error("Document title must be 255 characters or less")
		
		# Character validation
		if not re.match(r'^[a-zA-Z0-9\s\-_.,:;()[\]{}]+$', title):
			result.add_error("Document title contains invalid characters")
		
		# Business rules
		forbidden_words = ['test', 'temp', 'untitled', 'draft']
		if any(word in title.lower() for word in forbidden_words):
			result.add_warning("Document title suggests temporary content")
		
		result.sanitized_data['title'] = title
		return result
	
	def validate_document_content(self, content: str) -> ValidationResult:
		"""Validate document content"""
		result = ValidationResult()
		
		if not content or not content.strip():
			result.add_error("Document content is required")
			return result
		
		content = content.strip()
		
		# Length validation
		if len(content) < 10:
			result.add_error("Document content must be at least 10 characters")
		elif len(content) > 1000000:  # 1MB limit
			result.add_error("Document content exceeds maximum length")
		
		# Quality checks
		if len(content.split()) < 5:
			result.add_warning("Document content seems too short")
		
		# Check for placeholder content
		placeholder_patterns = [
			r'lorem ipsum',
			r'placeholder',
			r'xxx+',
			r'todo:',
			r'fixme:'
		]
		
		for pattern in placeholder_patterns:
			if re.search(pattern, content.lower()):
				result.add_warning("Document appears to contain placeholder content")
				break
		
		result.sanitized_data['content'] = content
		return result
	
	def validate_tags(self, tags: List[str]) -> ValidationResult:
		"""Validate document tags"""
		result = ValidationResult()
		
		if not tags:
			return result
		
		if len(tags) > 20:
			result.add_error("Maximum 20 tags allowed")
		
		sanitized_tags = []
		seen_tags = set()
		
		for tag in tags:
			if not isinstance(tag, str):
				result.add_error("Tags must be strings")
				continue
			
			tag = tag.strip().lower()
			
			if not tag:
				result.add_warning("Empty tag ignored")
				continue
			
			if len(tag) > 50:
				result.add_error("Tag length must be 50 characters or less")
				continue
			
			if not re.match(r'^[a-zA-Z0-9\-_]+$', tag):
				result.add_error(f"Tag '{tag}' contains invalid characters")
				continue
			
			if tag in seen_tags:
				result.add_warning(f"Duplicate tag '{tag}' ignored")
				continue
			
			seen_tags.add(tag)
			sanitized_tags.append(tag)
		
		result.sanitized_data['tags'] = sanitized_tags
		return result
	
	def validate_template_fields(self, fields: List[Dict[str, Any]]) -> ValidationResult:
		"""Validate template fields"""
		result = ValidationResult()
		
		if not fields:
			return result
		
		if len(fields) > 50:
			result.add_error("Maximum 50 template fields allowed")
		
		seen_names = set()
		valid_fields = []
		
		for i, field in enumerate(fields):
			field_result = self._validate_single_field(field, i)
			
			if not field_result.is_valid:
				result.errors.extend(field_result.errors)
				result.warnings.extend(field_result.warnings)
				result.is_valid = False
				continue
			
			field_name = field.get('name', '').lower()
			if field_name in seen_names:
				result.add_error(f"Duplicate field name: {field_name}")
				continue
			
			seen_names.add(field_name)
			valid_fields.append(field_result.sanitized_data)
		
		result.sanitized_data['fields'] = valid_fields
		return result
	
	def _validate_single_field(self, field: Dict[str, Any], index: int) -> ValidationResult:
		"""Validate single template field"""
		result = ValidationResult()
		
		# Required fields
		if 'name' not in field or not field['name']:
			result.add_error(f"Field {index}: name is required")
		
		if 'type' not in field or not field['type']:
			result.add_error(f"Field {index}: type is required")
		
		if not result.is_valid:
			return result
		
		# Validate field name
		name = field['name'].strip()
		if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', name):
			result.add_error(f"Field {index}: invalid name format")
		
		# Validate field type
		valid_types = ['text', 'textarea', 'number', 'date', 'boolean', 'select', 'multiselect']
		if field['type'] not in valid_types:
			result.add_error(f"Field {index}: invalid field type")
		
		# Validate options for select fields
		if field['type'] in ['select', 'multiselect']:
			options = field.get('options', [])
			if not options:
				result.add_error(f"Field {index}: select fields must have options")
		
		if result.is_valid:
			result.sanitized_data = field
		
		return result


class ContentValidator:
	"""Content-specific validation"""
	
	def __init__(self):
		self.logger = logging.getLogger(__name__)
	
	def validate_email(self, email: str) -> ValidationResult:
		"""Validate email address"""
		result = ValidationResult()
		
		if not email:
			return result
		
		email = email.strip().lower()
		
		# RFC 5322 regex (simplified)
		email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
		
		if not re.match(email_pattern, email):
			result.add_error("Invalid email format")
		elif len(email) > 254:
			result.add_error("Email address too long")
		else:
			result.sanitized_data['email'] = email
		
		return result
	
	def validate_phone_number(self, phone: str) -> ValidationResult:
		"""Validate phone number"""
		result = ValidationResult()
		
		if not phone:
			return result
		
		# Remove common separators
		phone = re.sub(r'[-.\s()]', '', phone)
		
		# Basic phone number validation (international format)
		if not re.match(r'^\+?[1-9]\d{1,14}$', phone):
			result.add_error("Invalid phone number format")
		else:
			result.sanitized_data['phone'] = phone
		
		return result
	
	def validate_date_range(self, start_date: str, end_date: str) -> ValidationResult:
		"""Validate date range"""
		result = ValidationResult()
		
		try:
			start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
			end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
			
			if start >= end:
				result.add_error("Start date must be before end date")
			
			# Check if date range is reasonable (not more than 100 years)
			if (end - start).days > 36500:
				result.add_warning("Date range exceeds 100 years")
			
			result.sanitized_data['start_date'] = start.isoformat()
			result.sanitized_data['end_date'] = end.isoformat()
			
		except ValueError as e:
			result.add_error(f"Invalid date format: {e}")
		
		return result
	
	def validate_file_size(self, file_size: int, max_size_mb: int = 10) -> ValidationResult:
		"""Validate file size"""
		result = ValidationResult()
		
		max_size_bytes = max_size_mb * 1024 * 1024
		
		if file_size > max_size_bytes:
			result.add_error(f"File size exceeds {max_size_mb}MB limit")
		elif file_size == 0:
			result.add_error("File is empty")
		else:
			result.sanitized_data['file_size'] = file_size
		
		return result
	
	def validate_password_strength(self, password: str) -> ValidationResult:
		"""Validate password strength"""
		result = ValidationResult()
		
		if not password:
			result.add_error("Password is required")
			return result
		
		if len(password) < 8:
			result.add_error("Password must be at least 8 characters")
		
		if len(password) > 128:
			result.add_error("Password must be 128 characters or less")
		
		# Check for character variety
		has_lower = bool(re.search(r'[a-z]', password))
		has_upper = bool(re.search(r'[A-Z]', password))
		has_digit = bool(re.search(r'\d', password))
		has_special = bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password))
		
		score = sum([has_lower, has_upper, has_digit, has_special])
		
		if score < 3:
			result.add_error("Password must contain at least 3 of: lowercase, uppercase, digits, special characters")
		
		# Check for common patterns
		if re.search(r'(.)\1{2,}', password):
			result.add_warning("Password contains repeated characters")
		
		if re.search(r'(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)', password.lower()):
			result.add_warning("Password contains sequential characters")
		
		# Don't store the password in sanitized data for security
		if result.is_valid:
			result.sanitized_data['password_valid'] = True
		
		return result


class InputValidators:
	"""Main input validation class combining all validators"""
	
	def __init__(self):
		self.security = SecurityValidator()
		self.business = BusinessRuleValidator()
		self.content = ContentValidator()
		self.logger = logging.getLogger(__name__)
	
	def validate_document_creation(self, data: Dict[str, Any]) -> ValidationResult:
		"""Validate document creation data"""
		result = ValidationResult()
		
		# Validate title
		if 'title' in data:
			title_result = self.business.validate_document_title(data['title'])
			self._merge_results(result, title_result)
		
		# Validate content
		if 'content' in data:
			content_result = self.business.validate_document_content(data['content'])
			self._merge_results(result, content_result)
			
			# Security validation
			security_result = self.security.validate_text_content(data['content'], 'content')
			self._merge_results(result, security_result)
		
		# Validate tags
		if 'tags' in data and data['tags']:
			tags_result = self.business.validate_tags(data['tags'])
			self._merge_results(result, tags_result)
		
		return result
	
	def validate_template_creation(self, data: Dict[str, Any]) -> ValidationResult:
		"""Validate template creation data"""
		result = ValidationResult()
		
		# Validate name
		if 'name' in data:
			title_result = self.business.validate_document_title(data['name'])
			self._merge_results(result, title_result)
		
		# Validate content
		if 'content' in data:
			content_result = self.business.validate_document_content(data['content'])
			self._merge_results(result, content_result)
			
			security_result = self.security.validate_text_content(data['content'], 'content')
			self._merge_results(result, security_result)
		
		# Validate fields
		if 'fields' in data and data['fields']:
			fields_result = self.business.validate_template_fields(data['fields'])
			self._merge_results(result, fields_result)
		
		return result
	
	def validate_user_input(self, data: Dict[str, Any], validation_rules: Dict[str, List[str]]) -> ValidationResult:
		"""Generic user input validation with custom rules"""
		result = ValidationResult()
		
		for field_name, rules in validation_rules.items():
			if field_name not in data:
				continue
			
			field_value = data[field_name]
			
			for rule in rules:
				field_result = self._apply_validation_rule(field_name, field_value, rule)
				self._merge_results(result, field_result)
		
		return result
	
	def _apply_validation_rule(self, field_name: str, value: Any, rule: str) -> ValidationResult:
		"""Apply specific validation rule"""
		result = ValidationResult()
		
		if rule == 'required' and not value:
			result.add_error(f"{field_name} is required")
		elif rule == 'email':
			email_result = self.content.validate_email(value)
			self._merge_results(result, email_result)
		elif rule == 'phone':
			phone_result = self.content.validate_phone_number(value)
			self._merge_results(result, phone_result)
		elif rule == 'url':
			url_result = self.security.validate_url(value)
			self._merge_results(result, url_result)
		elif rule == 'password':
			password_result = self.content.validate_password_strength(value)
			self._merge_results(result, password_result)
		elif rule == 'secure_text':
			security_result = self.security.validate_text_content(value, field_name)
			self._merge_results(result, security_result)
		
		return result
	
	def _merge_results(self, target: ValidationResult, source: ValidationResult):
		"""Merge validation results"""
		if not source.is_valid:
			target.is_valid = False
		
		target.errors.extend(source.errors)
		target.warnings.extend(source.warnings)
		target.sanitized_data.update(source.sanitized_data)
	
	def sanitize_input_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
		"""Sanitize input data for safe storage"""
		sanitized = {}
		
		for key, value in data.items():
			if isinstance(value, str):
				# HTML escape and strip whitespace
				sanitized[key] = html.escape(value.strip())
			elif isinstance(value, list):
				# Recursively sanitize lists
				sanitized[key] = [self.sanitize_input_data({'item': item})['item'] if isinstance(item, dict) else html.escape(str(item)) if isinstance(item, str) else item for item in value]
			elif isinstance(value, dict):
				# Recursively sanitize dictionaries
				sanitized[key] = self.sanitize_input_data(value)
			else:
				sanitized[key] = value
		
		return sanitized


# Factory function
def create_input_validators() -> InputValidators:
	"""Create InputValidators instance"""
	return InputValidators()