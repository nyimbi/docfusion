#!/usr/bin/env python3
"""
Import Fix Script

Fixes import issues and type mismatches in the agent system.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import os
import re
from pathlib import Path


def fix_uuid_imports(file_path):
	"""Fix UUID import issues"""
	with open(file_path, 'r') as f:
		content = f.read()
	
	# Replace direct uuid_extensions import with fallback
	uuid_import_pattern = r'try:
	from uuid_extensions import uuid7str
except ImportError:
	import uuid
	def uuid7str() -> str:
		return str(uuid.uuid4())'
	uuid_fallback = '''try:
	try:
	from uuid_extensions import uuid7str
except ImportError:
	import uuid
	def uuid7str() -> str:
		return str(uuid.uuid4())
except ImportError:
	import uuid
	def uuid7str() -> str:
		return str(uuid.uuid4())'''
	
	if uuid_import_pattern in content:
		content = content.replace(uuid_import_pattern, uuid_fallback)
		
		with open(file_path, 'w') as f:
			f.write(content)
		print(f"Fixed UUID imports in {file_path}")


def fix_capability_references(file_path):
	"""Fix capability reference issues"""
	with open(file_path, 'r') as f:
		content = f.read()
	
	# Replace .capabilities with .primary_capabilities
	if 'role_def.primary_capabilities' in content:
		content = content.replace('role_def.primary_capabilities', 'role_def.primary_capabilities')
		
		with open(file_path, 'w') as f:
			f.write(content)
		print(f"Fixed capability references in {file_path}")


def add_missing_imports(file_path):
	"""Add missing imports like 're' module"""
	with open(file_path, 'r') as f:
		content = f.read()
	
	# Check if 're' module is used but not imported
	if 're.' in content and 'import re' not in content:
		# Add import after other imports
		lines = content.split('\n')
		import_lines = []
		other_lines = []
		in_imports = True
		
		for line in lines:
			if line.startswith('import ') or line.startswith('from '):
				import_lines.append(line)
			elif line.strip() == '':
				if in_imports:
					import_lines.append(line)
				else:
					other_lines.append(line)
			else:
				in_imports = False
				other_lines.append(line)
		
		# Add re import
		import_lines.append('import re')
		
		# Reconstruct file
		new_content = '\n'.join(import_lines + other_lines)
		
		with open(file_path, 'w') as f:
			f.write(new_content)
		print(f"Added 're' import to {file_path}")


def fix_method_signatures(file_path):
	"""Fix method signature mismatches"""
	with open(file_path, 'r') as f:
		content = f.read()
	
	# Fix send_message method signatures
	if 'def send_message(self, message: AgentMessage,' in content:
		# Make sender_id optional with default None
		content = re.sub(
			r'def send_message\(self, message: AgentMessage, \*\*kwargs\) -> bool:',
			'def send_message(self, message: AgentMessage, sender_id: Optional[str] = None, **kwargs) -> bool:',
			content
		)
		
		with open(file_path, 'w') as f:
			f.write(content)
		print(f"Fixed method signatures in {file_path}")


def fix_none_assignments(file_path):
	"""Fix None value assignments to required types"""
	with open(file_path, 'r') as f:
		content = f.read()
	
	changes_made = False
	
	# Fix None assignments to Dict[str, Any]
	if ': Dict[str, Any] = field(default_factory=dict)' in content:
		content = content.replace(': Dict[str, Any] = field(default_factory=dict)', ': Dict[str, Any] = field(default_factory=dict)')
		changes_made = True
	
	# Fix None assignments to List[Dict[str, Any]]
	if ': List[Dict[str, Any]] = field(default_factory=list)' in content:
		content = content.replace(': List[Dict[str, Any]] = field(default_factory=list)', ': List[Dict[str, Any]] = field(default_factory=list)')
		changes_made = True
	
	# Fix None assignments to Dict[str, float]
	if ': Dict[str, float] = field(default_factory=dict)' in content:
		content = content.replace(': Dict[str, float] = field(default_factory=dict)', ': Dict[str, float] = field(default_factory=dict)')
		changes_made = True
	
	if changes_made:
		with open(file_path, 'w') as f:
			f.write(content)
		print(f"Fixed None assignments in {file_path}")


async def fix_async_issues(file_path):
	"""Fix async/await issues"""
	with open(file_path, 'r') as f:
		content = f.read()
	
	# Look for await in non-async functions
	lines = content.split('\n')
	in_function = False
	function_is_async = False
	current_function = ""
	changes_made = False
	
	for i, line in enumerate(lines):
		stripped = line.strip()
		
		# Check for function definition
		if stripped.startswith('def '):
			in_function = True
			function_is_async = 'async def' in stripped
			current_function = stripped
		elif in_function and (stripped.startswith('def ') or stripped.startswith('class ') or (stripped and not line.startswith((' ', '\t')))):
			in_function = False
			function_is_async = False
		
		# Check for await in non-async function
		if in_function and not function_is_async and 'await ' in stripped and not stripped.startswith('#'):
			# Make function async
			if i > 0 and 'def ' in lines[i-1]:
				lines[i-1] = lines[i-1].replace('def ', 'async def ')
				changes_made = True
				print(f"Made function async: {current_function}")
	
	if changes_made:
		content = '\n'.join(lines)
		with open(file_path, 'w') as f:
			f.write(content)
		print(f"Fixed async issues in {file_path}")


def main():
	"""Main fix script"""
	print("🔧 Fixing Agent System Import and Type Issues")
	print("=" * 50)
	
	# Get all Python files in the agent system
	agents_dir = Path(__file__).parent
	python_files = []
	
	for root, dirs, files in os.walk(agents_dir):
		# Skip test directory for now
		if 'tests' in root:
			continue
		
		for file in files:
			if file.endswith('.py') and not file.startswith('__'):
				python_files.append(Path(root) / file)
	
	print(f"Found {len(python_files)} Python files to fix")
	print()
	
	for file_path in python_files:
		print(f"Processing: {file_path.relative_to(agents_dir)}")
		
		try:
			# Apply all fixes
			fix_uuid_imports(file_path)
			fix_capability_references(file_path)
			add_missing_imports(file_path)
			fix_method_signatures(file_path)
			fix_none_assignments(file_path)
			fix_async_issues(file_path)
			
		except Exception as e:
			print(f"❌ Error processing {file_path}: {e}")
	
	print()
	print("✅ Import and type fixes completed!")
	print("🧪 Run tests with: python tests/run_tests.py")


if __name__ == "__main__":
	main()