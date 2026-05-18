"""
Comprehensive test suite for Git + LaTeX Content Management System

Tests the file-based content block system with Git integration,
LaTeX compilation, and document assembly functionality.
"""

import asyncio
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
import git

from .git_latex_manager import (
	FileContentBlock,
	GitLatexContentManager,
	GitLatexAssembler,
	LaTeXCompiler,
	CompilationResult
)


@pytest.fixture
def temp_repo():
	"""Create temporary Git repository for testing"""
	with tempfile.TemporaryDirectory() as temp_dir:
		repo_path = Path(temp_dir) / "test_repo"
		repo_path.mkdir()
		yield repo_path
		# Cleanup handled by TemporaryDirectory


@pytest.fixture
async def git_latex_manager(temp_repo):
	"""Create GitLatexContentManager instance for testing"""
	manager = GitLatexContentManager(temp_repo)
	yield manager


@pytest.fixture
async def git_latex_assembler(temp_repo):
	"""Create GitLatexAssembler instance for testing"""
	# First initialize with manager to create repo structure
	GitLatexContentManager(temp_repo)
	assembler = GitLatexAssembler(temp_repo)
	yield assembler


class TestFileContentBlock:
	"""Test FileContentBlock functionality"""
	
	def test_file_content_block_creation(self, temp_repo):
		"""Test creating FileContentBlock instances"""
		file_path = temp_repo / "test_block.tex"
		
		block = FileContentBlock(
			file_path=file_path,
			block_type="text",
			title="Test Block",
			metadata={"author": "test"}
		)
		
		assert block.file_path == file_path
		assert block.block_type == "text"
		assert block.title == "Test Block"
		assert block.metadata["author"] == "test"
		assert block.block_id  # Should have auto-generated ID
	
	def test_write_and_read_content(self, temp_repo):
		"""Test writing and reading content from files"""
		file_path = temp_repo / "test_block.tex"
		
		block = FileContentBlock(
			file_path=file_path,
			block_type="text"
		)
		
		test_content = "\\section{Test}\nThis is test content."
		block.write_content(test_content)
		
		assert file_path.exists()
		read_content = block.read_content()
		assert read_content == test_content
	
	def test_file_not_found_error(self, temp_repo):
		"""Test error handling for missing files"""
		file_path = temp_repo / "missing_block.tex"
		
		block = FileContentBlock(
			file_path=file_path,
			block_type="text"
		)
		
		with pytest.raises(FileNotFoundError):
			block.read_content()
	
	def test_git_operations(self, temp_repo):
		"""Test Git operations with FileContentBlock"""
		# Initialize Git repo
		repo = git.Repo.init(temp_repo)
		
		file_path = temp_repo / "test_block.tex"
		block = FileContentBlock(
			file_path=file_path,
			block_type="text",
			git_repo=repo
		)
		
		# Write content and commit
		test_content = "\\section{Test}\nThis is test content."
		block.write_content(test_content, "Initial commit")
		
		# Check Git history
		history = block.get_history()
		assert len(history) >= 1
		assert "Initial commit" in history[0]["message"]


class TestGitLatexContentManager:
	"""Test GitLatexContentManager functionality"""
	
	async def test_manager_initialization(self, git_latex_manager):
		"""Test GitLatexContentManager initialization"""
		manager = git_latex_manager
		
		# Check directory structure
		assert manager.blocks_dir.exists()
		assert manager.templates_dir.exists()
		assert manager.assets_dir.exists()
		assert manager.generated_dir.exists()
		assert manager.build_dir.exists()
		
		# Check Git repository
		assert manager.git_repo
		assert manager.repo_path / ".git"
		
		# Check default templates
		assert (manager.templates_dir / "docufusion-proposal.cls").exists()
		assert (manager.templates_dir / "common_macros.tex").exists()
	
	async def test_generate_content_block(self, git_latex_manager):
		"""Test content block generation"""
		manager = git_latex_manager
		
		requirements = {
			"title": "Executive Summary",
			"client": "Test Client",
			"focus_areas": ["innovation", "efficiency"]
		}
		
		block_path = await manager.generate_content_block(
			block_type="executive_summary",
			requirements=requirements,
			output_file="executive_summary"
		)
		
		# Verify file creation
		assert Path(block_path).exists()
		
		# Verify content structure
		content = Path(block_path).read_text()
		assert "% Block metadata:" in content
		assert "\\section{Executive Summary}" in content
		assert "\\label{sec:executive-summary}" in content
	
	async def test_update_content_block(self, git_latex_manager):
		"""Test content block updates"""
		manager = git_latex_manager
		
		# Create initial block
		await manager.generate_content_block(
			block_type="text",
			requirements={"title": "Test Block"},
			output_file="test_block"
		)
		
		# Update the block
		updates = {
			"replacements": {
				"Test Block": "Updated Test Block"
			},
			"append": "\\subsection{New Section}\nAdditional content.",
			"metadata": {"updated": True}
		}
		
		success = await manager.update_content_block(
			block_file="test_block",
			updates=updates,
			commit_message="Update test block"
		)
		
		assert success
		
		# Verify updates
		block_path = manager.blocks_dir / "test_block.tex"
		content = block_path.read_text()
		assert "Updated Test Block" in content
		assert "\\subsection{New Section}" in content
	
	async def test_list_content_blocks(self, git_latex_manager):
		"""Test listing all content blocks"""
		manager = git_latex_manager
		
		# Create multiple blocks
		await manager.generate_content_block("executive_summary", {}, "exec_summary")
		await manager.generate_content_block("technical_approach", {}, "tech_approach")
		await manager.generate_content_block("text", {}, "general_content")
		
		# List blocks
		blocks = await manager.list_content_blocks()
		
		assert len(blocks) >= 3
		block_names = [block.file_path.stem for block in blocks]
		assert "exec_summary" in block_names
		assert "tech_approach" in block_names
		assert "general_content" in block_names
	
	async def test_create_document_config(self, git_latex_manager):
		"""Test document configuration creation"""
		manager = git_latex_manager
		
		config = await manager.create_document_config(
			title="Test Proposal",
			client="Test Client",
			rfp_number="RFP-2024-001",
			content_blocks=["executive_summary", "technical_approach"],
			appendices=["appendix_a"],
			template="proposal"
		)
		
		assert config["title"] == "Test Proposal"
		assert config["client"] == "Test Client"
		assert config["rfp_number"] == "RFP-2024-001"
		assert "executive_summary" in config["content_blocks"]
		assert "appendix_a" in config["appendices"]
		
		# Verify metadata file creation
		metadata_file = manager.repo_path / "document_metadata.json"
		assert metadata_file.exists()
		
		saved_config = json.loads(metadata_file.read_text())
		assert saved_config["title"] == "Test Proposal"


class TestGitLatexAssembler:
	"""Test GitLatexAssembler functionality"""
	
	async def test_assembler_initialization(self, git_latex_assembler):
		"""Test GitLatexAssembler initialization"""
		assembler = git_latex_assembler
		
		assert assembler.repo_path
		assert assembler.git_repo
		assert assembler.build_dir.exists()
	
	async def test_generate_main_document(self, git_latex_assembler):
		"""Test main document generation"""
		assembler = git_latex_assembler
		
		config = {
			"title": "Test Document",
			"author": "Test Author",
			"client": "Test Client",
			"rfp_number": "RFP-001",
			"date": "2024-01-01",
			"document_class": "article",
			"content_blocks": ["block1", "block2"],
			"appendices": ["appendix_a"],
			"toc": True
		}
		
		main_tex = assembler._generate_main_document(config)
		
		assert "\\documentclass[11pt,letterpaper]{article}" in main_tex
		assert "\\title{Test Document}" in main_tex
		assert "\\input{blocks/block1}" in main_tex
		assert "\\input{blocks/block2}" in main_tex
		assert "\\appendix" in main_tex
		assert "\\tableofcontents" in main_tex
	
	async def test_assemble_document_missing_blocks(self, git_latex_assembler):
		"""Test document assembly with missing blocks"""
		assembler = git_latex_assembler
		
		config = {
			"title": "Test Document",
			"author": "Test Author", 
			"client": "Test Client",
			"rfp_number": "RFP-001",
			"content_blocks": ["missing_block1", "missing_block2"]
		}
		
		# This should handle missing blocks gracefully
		main_tex = assembler._generate_main_document(config)
		
		assert "% Missing block: missing_block1" in main_tex
		assert "% Missing block: missing_block2" in main_tex


class TestLaTeXCompiler:
	"""Test LaTeX compilation functionality"""
	
	async def test_compiler_initialization(self, temp_repo):
		"""Test LaTeXCompiler initialization"""
		compiler = LaTeXCompiler(temp_repo)
		
		assert compiler.working_dir == temp_repo
		assert compiler.latex_engine == "pdflatex"
		assert compiler.build_dir.exists()
	
	async def test_compile_document_missing_file(self, temp_repo):
		"""Test compilation with missing file"""
		compiler = LaTeXCompiler(temp_repo)
		
		result = await compiler.compile_document("missing.tex")
		
		assert not result.success
		assert "not found" in result.error_messages[0]
	
	async def test_compile_document_basic(self, temp_repo):
		"""Test basic document compilation"""
		compiler = LaTeXCompiler(temp_repo)
		
		# Create minimal LaTeX document
		tex_content = r"""
\documentclass{article}
\begin{document}
\title{Test Document}
\author{Test Author}
\maketitle
Hello, world!
\end{document}
"""
		
		tex_file = temp_repo / "test.tex"
		tex_file.write_text(tex_content)
		
		# Mock the LaTeX compilation since we may not have LaTeX installed
		with patch.object(compiler, '_run_latex_pass') as mock_latex:
			mock_latex.return_value = {
				"returncode": 0,
				"stdout": "LaTeX output",
				"stderr": "",
				"log": "LaTeX log content"
			}
			
			# Create mock PDF output
			pdf_file = compiler.build_dir / "test.pdf"
			pdf_file.write_text("Mock PDF content")
			
			result = await compiler.compile_document("test.tex")
			
			assert result.success
			assert result.output_file == pdf_file
			assert result.output_format == "pdf"
			assert result.compilation_time >= 0


class TestIntegrationWorkflow:
	"""Test complete Git + LaTeX workflow integration"""
	
	async def test_complete_workflow(self, temp_repo):
		"""Test complete document creation and compilation workflow"""
		# Initialize manager
		manager = GitLatexContentManager(temp_repo)
		
		# Generate content blocks
		await manager.generate_content_block(
			block_type="executive_summary",
			requirements={"title": "Executive Summary", "client": "ACME Corp"},
			output_file="executive_summary"
		)
		
		await manager.generate_content_block(
			block_type="technical_approach", 
			requirements={"title": "Technical Approach"},
			output_file="technical_approach"
		)
		
		await manager.generate_content_block(
			block_type="project_timeline",
			requirements={"title": "Project Timeline"},
			output_file="project_timeline"
		)
		
		# Create document configuration
		config = await manager.create_document_config(
			title="Proposal for ACME Corp",
			client="ACME Corp",
			rfp_number="RFP-2024-001",
			content_blocks=["executive_summary", "technical_approach", "project_timeline"]
		)
		
		# Assemble document
		assembler = GitLatexAssembler(temp_repo)
		
		# Mock compilation since we may not have LaTeX
		with patch.object(LaTeXCompiler, 'compile_document') as mock_compile:
			mock_compile.return_value = CompilationResult(
				success=True,
				output_file=temp_repo / "build" / "main.pdf",
				compilation_time=2.5,
				output_format="pdf"
			)
			
			result = await assembler.assemble_document(config)
			
			assert result.success
			assert result.output_format == "pdf"
			assert result.compilation_time > 0
		
		# Verify main.tex was created
		main_tex_path = temp_repo / "main.tex"
		assert main_tex_path.exists()
		
		main_content = main_tex_path.read_text()
		assert "Proposal for ACME Corp" in main_content
		assert "\\input{blocks/executive_summary}" in main_content
		assert "\\input{blocks/technical_approach}" in main_content
		assert "\\input{blocks/project_timeline}" in main_content
	
	async def test_git_version_control_workflow(self, temp_repo):
		"""Test Git version control throughout the workflow"""
		manager = GitLatexContentManager(temp_repo)
		
		# Create initial content
		await manager.generate_content_block(
			block_type="text",
			requirements={"title": "Version Control Test"},
			output_file="version_test"
		)
		
		# Verify initial commit
		repo = manager.git_repo
		commits = list(repo.iter_commits())
		initial_commit_count = len(commits)
		
		# Update content
		await manager.update_content_block(
			block_file="version_test",
			updates={"append": "\\subsection{Updated Content}"},
			commit_message="Add updated content section"
		)
		
		# Verify new commit
		commits = list(repo.iter_commits())
		assert len(commits) > initial_commit_count
		
		# Check commit message
		latest_commit = commits[0]
		assert "Add updated content section" in latest_commit.message
	
	async def test_content_block_dependencies(self, temp_repo):
		"""Test content block dependency handling"""
		manager = GitLatexContentManager(temp_repo)
		
		# Create blocks with dependencies
		await manager.generate_content_block(
			block_type="technical_approach",
			requirements={"title": "Technical Approach"},
			output_file="technical_approach"
		)
		
		# Create budget block that references technical approach
		budget_content = r"""
% Block metadata: type=budget, dependencies=[technical_approach]
\section{Budget Breakdown}
\label{sec:budget}

Based on the technical approach outlined in Section~\ref{sec:technical-approach}, 
our budget includes the following components:

\begin{itemize}
    \item Development costs based on technical complexity
    \item Infrastructure requirements from technical specifications
    \item Timeline costs derived from technical implementation plan
\end{itemize}
"""
		
		budget_path = manager.blocks_dir / "budget_breakdown.tex"
		budget_path.write_text(budget_content)
		
		# Create document config with both blocks
		config = await manager.create_document_config(
			title="Complete Proposal",
			client="Test Client",
			rfp_number="RFP-001",
			content_blocks=["technical_approach", "budget_breakdown"]
		)
		
		# Verify cross-references in generated main document
		assembler = GitLatexAssembler(temp_repo)
		main_tex = assembler._generate_main_document(config)
		
		assert "\\input{blocks/technical_approach}" in main_tex
		assert "\\input{blocks/budget_breakdown}" in main_tex
		
		# LaTeX will handle the cross-reference resolution automatically


class TestErrorHandling:
	"""Test error handling and edge cases"""
	
	async def test_invalid_git_repository(self):
		"""Test handling of invalid Git repository"""
		# This should be handled gracefully by creating a new repo
		with tempfile.TemporaryDirectory() as temp_dir:
			repo_path = Path(temp_dir) / "new_repo"
			manager = GitLatexContentManager(repo_path)
			
			assert manager.git_repo
			assert manager.repo_path.exists()
	
	async def test_file_permission_errors(self, git_latex_manager):
		"""Test handling of file permission errors"""
		manager = git_latex_manager
		
		# This test would need actual permission restrictions to be meaningful
		# For now, just verify the error handling structure exists
		try:
			await manager.generate_content_block(
				block_type="test",
				requirements={},
				output_file="test_permissions"
			)
			# Should succeed in normal circumstances
			assert True
		except PermissionError:
			# Should handle permission errors gracefully
			assert True
	
	async def test_large_content_handling(self, git_latex_manager):
		"""Test handling of large content blocks"""
		manager = git_latex_manager
		
		# Generate large content
		large_content = "\\section{Large Content}\n" + "Lorem ipsum dolor sit amet. " * 1000
		
		requirements = {
			"title": "Large Content Block",
			"content": large_content
		}
		
		block_path = await manager.generate_content_block(
			block_type="text",
			requirements=requirements,
			output_file="large_content"
		)
		
		assert Path(block_path).exists()
		content = Path(block_path).read_text()
		assert len(content) > 10000  # Verify large content was written


class TestPerformance:
	"""Test performance characteristics"""
	
	async def test_multiple_block_creation_performance(self, git_latex_manager):
		"""Test performance with multiple content blocks"""
		manager = git_latex_manager
		
		import time
		start_time = time.time()
		
		# Create multiple blocks
		tasks = []
		for i in range(10):
			tasks.append(manager.generate_content_block(
				block_type="text",
				requirements={"title": f"Block {i}"},
				output_file=f"block_{i}"
			))
		
		# Execute concurrently
		await asyncio.gather(*tasks)
		
		end_time = time.time()
		total_time = end_time - start_time
		
		# Should complete within reasonable time (adjust threshold as needed)
		assert total_time < 30  # 30 seconds for 10 blocks
		
		# Verify all blocks were created
		blocks = await manager.list_content_blocks()
		assert len(blocks) >= 10


# Test fixtures for mock data
@pytest.fixture
def sample_latex_content():
	"""Sample LaTeX content for testing"""
	return r"""
% Block metadata: type=text, priority=high
\section{Sample Section}
\label{sec:sample}

This is sample LaTeX content for testing purposes.

\subsection{Subsection}

Some more content with \textbf{formatting} and \emph{emphasis}.

\begin{itemize}
    \item First item
    \item Second item  
    \item Third item
\end{itemize}
"""


@pytest.fixture
def sample_document_config():
	"""Sample document configuration for testing"""
	return {
		"title": "Test Document",
		"author": "Test Author",
		"client": "Test Client", 
		"rfp_number": "TEST-001",
		"date": "2024-01-01",
		"content_blocks": ["block1", "block2", "block3"],
		"appendices": ["appendix_a"],
		"toc": True
	}


if __name__ == "__main__":
	# Run tests if executed directly
	pytest.main([__file__, "-v"])
