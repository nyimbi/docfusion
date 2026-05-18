"""
Git-Based LaTeX Content Manager for DocuFusion

This module implements the Git + LaTeX includes architecture for DocuFusion,
providing file-based content block management with industry-standard version
control through Git and professional typesetting through LaTeX.

Key Features:
- Individual content blocks as separate .tex files
- Git version control for all content and collaboration
- LaTeX includes for document assembly
- Automatic dependency resolution through LaTeX
- Professional typesetting without layout concerns
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional, TypeAlias

from pydantic import BaseModel, ConfigDict, Field
from ..core.utils import uuid7str

logger = logging.getLogger(__name__)

# Optional dependency: gitpython
if TYPE_CHECKING:
	from git import Repo  # type: ignore[import-not-found]
else:
	Repo = None  # type: ignore[misc]

GIT_AVAILABLE = False

try:
	import git as _git_runtime  # type: ignore[import-not-found]
	GIT_AVAILABLE = True
	if not TYPE_CHECKING:
		git = _git_runtime  # type: ignore[misc]
except ImportError:
	git = None  # type: ignore[assignment]

# Import canonical LaTeX compiler from pdf_renderer
try:
	from ..renderer.pdf_renderer import CompilationResult as CanonicalCompilationResult  # type: ignore[import-not-found]
	from ..renderer.pdf_renderer import LaTeXCompiler as CanonicalLaTeXCompiler  # type: ignore[import-not-found]
except ImportError:
	# Fallback: use the real async LaTeX compiler from document_engine.latex
	from dataclasses import dataclass, field

	from .latex.compiler import LatexCompiler

	@dataclass
	class CanonicalCompilationResult:
		success: bool = False
		output_file: str = ""
		compilation_log: str = ""
		compilation_time: float = 0.0
		output_format: str = "pdf"
		errors: list[str] = field(default_factory=list)
		compiled_content: bytes = b""

	class CanonicalLaTeXCompiler:
		def __init__(self) -> None:
			self._compiler = LatexCompiler()

		async def compile_to_pdf(self, content: str, filename: str = "") -> "CanonicalCompilationResult":
			result = await self._compiler.compile(content)
			return CanonicalCompilationResult(
				success=result.success,
				compilation_log=result.log,
				compiled_content=result.pdf_bytes or b"",
				errors=[e.message for e in result.errors],
			)

# Import from content_assembler if available, otherwise define minimal versions
try:
	from .assembler.content_assembler import ContentBlock
except ImportError:
	# Define minimal version for standalone use
	from datetime import datetime
	from typing import Any

	class ContentBlock(BaseModel):
		model_config = ConfigDict(
			extra='forbid',
			validate_by_name=True,
			validate_by_alias=True,
			validate_assignment=True
		)
		block_id: str = Field(default_factory=uuid7str)
		block_type: str
		content: str
		title: str = ""
		metadata: dict[str, Any] = Field(default_factory=dict)
		created_at: datetime = Field(default_factory=datetime.now)

# DocumentMetadata is defined locally for use in this module
class DocumentMetadata(BaseModel):
	model_config = ConfigDict(
		extra='forbid',
		validate_by_name=True,
		validate_by_alias=True
	)
	title: str
	author: str = ""
	client: str = ""
	rfp_number: str = ""
	created_at: datetime = Field(default_factory=datetime.now)

class FileContentBlock(BaseModel):
	"""Content block represented as a file in Git repository"""
	model_config = ConfigDict(
		extra='forbid', 
		validate_by_name=True, 
		validate_by_alias=True,
		validate_assignment=True
	)
	
	file_path: Path
	block_type: str
	block_id: str = Field(default_factory=uuid7str)
	title: str = ""
	metadata: dict[str, Any] = Field(default_factory=dict)
	git_repo: Optional[Any] = Field(default=None, exclude=True)  # git.Repo instance
	
	# LaTeX-specific fields
	latex_environment: str = ""
	latex_options: dict[str, str] = Field(default_factory=dict)
	requires_math_mode: bool = False
	cross_reference_label: str = ""
	
	# Dependencies and relationships
	dependencies: list[str] = Field(default_factory=list)
	
	# Temporal tracking
	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)
	
	def read_content(self) -> str:
		"""Read LaTeX content from file"""
		assert isinstance(self.file_path, Path), "file_path must be Path instance"
		
		if not self.file_path.exists():
			raise FileNotFoundError(f"Content block file not found: {self.file_path}")
		
		content = self.file_path.read_text(encoding='utf-8')
		
		assert isinstance(content, str), "Content must be string"
		return content
	
	def write_content(self, content: str, commit_message: str = "") -> None:
		"""Write content and commit to Git"""
		assert isinstance(content, str), "Content must be string"
		assert isinstance(commit_message, str), "Commit message must be string"
		
		# Ensure directory exists
		self.file_path.parent.mkdir(parents=True, exist_ok=True)
		
		# Write content to file
		self.file_path.write_text(content, encoding='utf-8')
		self.updated_at = datetime.now()
		
		# Git operations if repository is available
		if self.git_repo:
			try:
				# Add file to Git
				self.git_repo.index.add([str(self.file_path)])
				
				# Commit with descriptive message
				message = commit_message or f"Update {self.file_path.name}"
				self.git_repo.index.commit(message)
			except Exception as e:
				# Log error but don't fail the write operation
				self._log_git_error(f"Git commit failed: {e}")
		
		assert self.file_path.exists(), "File must exist after write operation"
	
	def get_history(self) -> list[dict[str, Any]]:
		"""Get Git commit history for this block"""
		if not self.git_repo:
			return []
		
		try:
			commits = list(self.git_repo.iter_commits(paths=str(self.file_path)))
			history = [
				{
					"commit_id": commit.hexsha,
					"message": commit.message.strip(),
					"author": str(commit.author),
					"date": commit.committed_datetime.isoformat(),
					"files": list(commit.stats.files.keys())
				}
				for commit in commits[:10]  # Last 10 commits
			]
			
			assert isinstance(history, list), "History must be list"
			return history
		except Exception as e:
			self._log_git_error(f"Failed to get commit history: {e}")
			return []
	
	def get_diff(self, commit1: str, commit2: str = "HEAD") -> str:
		"""Get diff between two commits"""
		assert isinstance(commit1, str), "commit1 must be string"
		assert isinstance(commit2, str), "commit2 must be string"
		
		if not self.git_repo:
			return ""
		
		try:
			diff = self.git_repo.git.diff(commit1, commit2, str(self.file_path))
			assert isinstance(diff, str), "Diff must be string"
			return diff
		except Exception as e:
			self._log_git_error(f"Failed to get diff: {e}")
			return ""
	
	def _log_git_error(self, message: str) -> None:
		"""Log Git operation errors"""
		logger.error("[GitLatex] %s", message)

class LaTeXTemplate(BaseModel):
	"""LaTeX template configuration"""
	model_config = ConfigDict(
		extra='forbid',
		validate_by_name=True,
		validate_by_alias=True
	)
	
	template_name: str
	document_class: str = "article"
	font_size: str = "11pt"
	paper_size: str = "letterpaper"
	template_path: Path
	required_packages: list[str] = Field(default_factory=list)
	custom_commands: dict[str, str] = Field(default_factory=dict)

# Use CompilationResult from pdf_renderer - alias for backward compatibility
CompilationResult: TypeAlias = CanonicalCompilationResult

class GitLatexContentManager:
	"""Manage content blocks as Git-versioned LaTeX files"""
	
	def __init__(self, repo_path: Path):
		assert isinstance(repo_path, Path), "repo_path must be Path instance"
		
		self.repo_path = Path(repo_path)
		self.blocks_dir = self.repo_path / "blocks"
		self.templates_dir = self.repo_path / "templates"
		self.assets_dir = self.repo_path / "assets"
		self.generated_dir = self.repo_path / "generated"
		self.build_dir = self.repo_path / "build"
		
		# Initialize or load Git repository
		self.git_repo = self._init_git_repo()
		
		# Create directory structure
		self._create_directory_structure()
		
		# Initialize default templates
		self._init_default_templates()
		
		assert self.repo_path.exists(), "Repository path must exist after initialization"
		assert self.git_repo is not None, "Git repository must be initialized"
	
	def _init_git_repo(self) -> "Repo | None":
		"""Initialize or load Git repository"""
		if not GIT_AVAILABLE:
			logger.warning("GitPython not available - Git features disabled")
			return None
		try:
			# Try to load existing repository
			repo = git.Repo(self.repo_path)
		except git.exc.InvalidGitRepositoryError:  # type: ignore[union-attr]
			# Initialize new repository
			repo = git.Repo.init(self.repo_path)  # type: ignore[union-attr]
			
			# Create initial commit
			gitignore_content = """
# LaTeX build artifacts
*.aux
*.log
*.toc
*.out
*.nav
*.snm
*.vrb
*.fls
*.fdb_latexmk
*.synctex.gz
*.bbl
*.blg
*.bcf
*.run.xml

# Build directory
build/
*.pdf

# OS generated files
.DS_Store
Thumbs.db

# Editor files
*.swp
*.swo
*~
"""
			gitignore_path = self.repo_path / ".gitignore"
			gitignore_path.write_text(gitignore_content.strip())
			
			repo.index.add([".gitignore"])
			repo.index.commit("Initial commit: GitLatex content management system")
		
		assert isinstance(repo, git.Repo), "Must return valid Git repository"
		return repo
	
	def _create_directory_structure(self) -> None:
		"""Create the file system structure for Git + LaTeX"""
		directories = [
			self.blocks_dir,
			self.blocks_dir / "appendices",
			self.templates_dir,
			self.assets_dir,
			self.generated_dir,
			self.build_dir
		]
		
		for directory in directories:
			directory.mkdir(parents=True, exist_ok=True)
		
		# Verify all directories exist
		for directory in directories:
			assert directory.exists(), f"Directory {directory} must exist after creation"
	
	def _init_default_templates(self) -> None:
		"""Initialize default LaTeX templates and styles"""
		# Create proposal document class
		proposal_cls = self.templates_dir / "docufusion-proposal.cls"
		if not proposal_cls.exists():
			proposal_content = r"""
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{docufusion-proposal}[2024/01/01 DocuFusion Proposal Class]

% Base class
\LoadClass[11pt,letterpaper]{article}

% Required packages
\RequirePackage{geometry}        % Page layout
\RequirePackage{fancyhdr}        % Headers and footers
\RequirePackage{titlesec}        % Section formatting
\RequirePackage{xcolor}          % Color support
\RequirePackage{graphicx}        % Graphics inclusion
\RequirePackage{amsmath,amssymb} % Mathematics
\RequirePackage{booktabs}        % Professional tables
\RequirePackage{hyperref}        % Hyperlinks and bookmarks
\RequirePackage{enumitem}        % Enhanced lists

% Page setup
\geometry{margin=1in}
\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\leftmark}
\fancyhead[R]{\thepage}
\renewcommand{\headrulewidth}{0.4pt}

% DocuFusion-specific commands
\newcommand{\proposaltitle}[1]{\def\@proposaltitle{#1}}
\newcommand{\clientname}[1]{\def\@clientname{#1}}
\newcommand{\rfpnumber}[1]{\def\@rfpnumber{#1}}
\newcommand{\submissiondate}[1]{\def\@submissiondate{#1}}

% Content block environments
\newenvironment{executivesummary}
	{\section{Executive Summary}}
	{}

\newenvironment{technicalapproach}
	{\section{Technical Approach}}
	{}

\newenvironment{projecttimeline}
	{\section{Project Timeline}}
	{}

% Cross-reference shortcuts
\newcommand{\figref}[1]{Figure~\ref{#1}}
\newcommand{\tabref}[1]{Table~\ref{#1}}
\newcommand{\secref}[1]{Section~\ref{#1}}
\newcommand{\eqref}[1]{Equation~(\ref{#1})}
"""
			proposal_cls.write_text(proposal_content.strip())
		
		# Create common macros
		macros_file = self.templates_dir / "common_macros.tex"
		if not macros_file.exists():
			macros_content = r"""
% DocuFusion Common LaTeX Macros

% Emphasis commands
\newcommand{\highlight}[1]{\textbf{\color{blue}#1}}
\newcommand{\important}[1]{\textbf{\color{red}#1}}
\newcommand{\note}[1]{\textit{\color{gray}#1}}

% Document metadata
\newcommand{\docversion}[1]{\def\@docversion{#1}}
\newcommand{\classification}[1]{\def\@classification{#1}}

% Content block metadata
\newcommand{\blockid}[1]{\label{block:#1}}
\newcommand{\blockref}[1]{\ref{block:#1}}

% Professional formatting
\setlength{\parskip}{0.5\baselineskip}
\setlength{\parindent}{0pt}
"""
			macros_file.write_text(macros_content.strip())
		
		assert proposal_cls.exists(), "Proposal class template must exist"
		assert macros_file.exists(), "Common macros file must exist"
	
	async def generate_content_block(
		self,
		block_type: str,
		requirements: dict[str, Any],
		output_file: str,
		ai_generated: bool = True
	) -> str:
		"""Generate AI content and save as LaTeX file"""
		assert isinstance(block_type, str), "block_type must be string"
		assert isinstance(requirements, dict), "requirements must be dict"
		assert isinstance(output_file, str), "output_file must be string"
		assert isinstance(ai_generated, bool), "ai_generated must be bool"
		
		# For Phase 1, create mock content based on block type
		content = self._generate_mock_content(block_type, requirements)
		
		# Add metadata header
		metadata_header = self._create_metadata_header(
			block_type=block_type,
			ai_generated=ai_generated,
			requirements=requirements
		)
		
		# Combine metadata and content
		full_content = metadata_header + "\n\n" + content
		
		# Create file path
		block_path = self.blocks_dir / f"{output_file}.tex"
		
		# Create FileContentBlock
		block = FileContentBlock(
			file_path=block_path,
			block_type=block_type,
			title=requirements.get("title", output_file.replace("_", " ").title()),
			metadata=requirements,
			git_repo=self.git_repo
		)
		
		# Write content
		block.write_content(
			content=full_content,
			commit_message=f"AI-generated {block_type}: {output_file}"
		)
		
		result_path = str(block_path)
		assert block_path.exists(), "Block file must exist after generation"
		return result_path
	
	def _generate_mock_content(self, block_type: str, requirements: dict[str, Any]) -> str:
		"""Generate mock LaTeX content based on block type"""
		assert isinstance(block_type, str), "block_type must be string"
		assert isinstance(requirements, dict), "requirements must be dict"
		
		title = requirements.get("title", "Content Block")
		
		if block_type == "executive_summary":
			content = rf"""
\section{{Executive Summary}}
\label{{sec:executive-summary}}

Our organization brings extensive experience in delivering innovative solutions that meet the complex requirements outlined in this RFP. With a proven track record of successful project delivery and a deep understanding of the client's industry, we are uniquely positioned to provide exceptional value.

\subsection{{Key Strengths}}

\begin{{itemize}}
	\item Proven expertise in \textbf{{advanced analytics}} and \textbf{{AI implementation}}
	\item Track record of delivering projects \textbf{{on time and under budget}}
	\item Dedicated team of certified professionals with relevant experience
	\item Comprehensive approach that addresses both technical and business requirements
\end{{itemize}}

This proposal demonstrates our capability through detailed technical approaches (Section~\ref{{sec:technical-approach}}) and a realistic project timeline (Section~\ref{{sec:timeline}}).
"""
		
		elif block_type == "technical_approach":
			content = rf"""
\section{{Technical Approach}}
\label{{sec:technical-approach}}

Our technical methodology combines industry best practices with innovative approaches to deliver robust, scalable solutions that exceed client expectations.

\subsection{{Architecture Overview}}

We propose a modern, cloud-native architecture that leverages:

\begin{{itemize}}
	\item Microservices architecture for scalability and maintainability
	\item Event-driven design patterns for real-time responsiveness
	\item Machine learning integration for intelligent automation
	\item Comprehensive security framework with zero-trust principles
\end{{itemize}}

\subsection{{Implementation Strategy}}

Our phased implementation approach ensures minimal disruption while delivering incremental value:

\begin{{enumerate}}
	\item \textbf{{Phase 1}}: Foundation and core infrastructure setup
	\item \textbf{{Phase 2}}: Core feature development and integration
	\item \textbf{{Phase 3}}: Advanced features and optimization
	\item \textbf{{Phase 4}}: Testing, deployment, and knowledge transfer
\end{{enumerate}}
"""
		
		elif block_type == "project_timeline":
			content = rf"""
\section{{Project Timeline}}
\label{{sec:timeline}}

Our project timeline is designed to deliver value incrementally while maintaining quality and meeting all deadlines.

\subsection{{Project Phases}}

\begin{{table}}[h]
\centering
\begin{{tabular}}{{@{{}}llll@{{}}}}
\toprule
Phase & Duration & Key Deliverables & Milestones \\
\midrule
Phase 1 & 4 weeks & Architecture Design & Design Review \\
Phase 2 & 8 weeks & Core Implementation & Alpha Release \\
Phase 3 & 6 weeks & Feature Development & Beta Release \\
Phase 4 & 4 weeks & Testing \& Deployment & Production Release \\
\bottomrule
\end{{tabular}}
\caption{{Project Timeline Overview}}
\label{{tab:timeline}}
\end{{table}}

\subsection{{Critical Path}}

Key dependencies and critical path items have been identified to ensure project success:

\begin{{itemize}}
	\item Infrastructure setup must complete before development begins
	\item Security review checkpoints at each phase transition
	\item Client feedback loops integrated throughout development
	\item Comprehensive testing before production deployment
\end{{itemize}}
"""
		
		else:
			content = rf"""
\section{{{title}}}
\label{{sec:{block_type.replace('_', '-')}}}

This section contains content for the {title.lower()} component of the proposal.

\subsection{{Overview}}

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

\subsection{{Key Points}}

\begin{{itemize}}
	\item First key point about this section
	\item Second important consideration
	\item Third critical element
\end{{itemize}}

\subsection{{Details}}

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
"""
		
		assert isinstance(content, str), "Generated content must be string"
		return content
	
	def _create_metadata_header(
		self,
		block_type: str,
		ai_generated: bool,
		requirements: dict[str, Any]
	) -> str:
		"""Create LaTeX comment header with metadata"""
		assert isinstance(block_type, str), "block_type must be string"
		assert isinstance(ai_generated, bool), "ai_generated must be bool"
		assert isinstance(requirements, dict), "requirements must be dict"
		
		timestamp = datetime.now().isoformat()
		
		header = f"""% Block metadata: type={block_type}, priority=high, dependencies=[]
% AI-generated: {str(ai_generated).lower()}
% Last modified: {timestamp}
% Requirements: {json.dumps(requirements, default=str)}"""
		
		assert isinstance(header, str), "Header must be string"
		return header
	
	async def update_content_block(
		self,
		block_file: str,
		updates: dict[str, Any],
		commit_message: str = ""
	) -> bool:
		"""Update existing content block with AI assistance"""
		assert isinstance(block_file, str), "block_file must be string"
		assert isinstance(updates, dict), "updates must be dict"
		assert isinstance(commit_message, str), "commit_message must be string"
		
		# Get block path
		block_path = self.blocks_dir / f"{block_file}.tex"
		
		if not block_path.exists():
			raise FileNotFoundError(f"Content block not found: {block_file}")
		
		# Read current content
		current_content = block_path.read_text(encoding='utf-8')
		
		# For Phase 1, apply simple text updates
		updated_content = self._apply_mock_updates(current_content, updates)
		
		# Create FileContentBlock and update
		block = FileContentBlock(
			file_path=block_path,
			block_type=updates.get("block_type", "text"),
			git_repo=self.git_repo
		)
		
		# Write updated content
		commit_msg = commit_message or f"AI-enhanced update to {block_file}"
		block.write_content(updated_content, commit_msg)
		
		assert block_path.exists(), "Block file must exist after update"
		return True
	
	def _apply_mock_updates(self, current_content: str, updates: dict[str, Any]) -> str:
		"""Apply mock updates to content (Phase 1 implementation)"""
		assert isinstance(current_content, str), "current_content must be string"
		assert isinstance(updates, dict), "updates must be dict"
		
		updated_content = current_content
		
		# Simple text replacements
		if "replacements" in updates:
			for old_text, new_text in updates["replacements"].items():
				updated_content = updated_content.replace(old_text, new_text)
		
		# Add new content
		if "append" in updates:
			updated_content += "\n\n" + updates["append"]
		
		# Update metadata header
		if "metadata" in updates:
			# Update timestamp in header
			timestamp = datetime.now().isoformat()
			updated_content = updated_content.replace(
				"% Last modified:",
				f"% Last modified: {timestamp}\n% Updated metadata: {json.dumps(updates['metadata'])}\n% Last modified:"
			)
		
		assert isinstance(updated_content, str), "Updated content must be string"
		return updated_content
	
	async def list_content_blocks(self) -> list[FileContentBlock]:
		"""List all content blocks in the repository"""
		blocks = []
		
		# Find all .tex files in blocks directory
		for tex_file in self.blocks_dir.rglob("*.tex"):
			try:
				# Create FileContentBlock instance
				block = FileContentBlock(
					file_path=tex_file,
					block_type=self._infer_block_type(tex_file),
					git_repo=self.git_repo
				)
				blocks.append(block)
			except Exception as e:
				self._log_block_error(f"Error loading block {tex_file}: {e}")
		
		assert isinstance(blocks, list), "Result must be list"
		return blocks
	
	def _infer_block_type(self, file_path: Path) -> str:
		"""Infer block type from file name and content"""
		assert isinstance(file_path, Path), "file_path must be Path instance"
		
		name = file_path.stem.lower()
		
		# Common block type mappings
		type_mappings = {
			"executive_summary": "executive_summary",
			"technical_approach": "technical_approach",
			"project_timeline": "project_timeline",
			"team_qualifications": "team_qualifications",
			"budget": "budget_breakdown",
		}
		
		for pattern, block_type in type_mappings.items():
			if pattern in name:
				return block_type
		
		return "text"  # Default type
	
	async def create_document_config(
		self,
		title: str,
		client: str,
		rfp_number: str,
		content_blocks: list[str],
		appendices: list[str] = None,
		template: str = "proposal"
	) -> dict[str, Any]:
		"""Create document configuration for assembly"""
		assert isinstance(title, str), "title must be string"
		assert isinstance(client, str), "client must be string"
		assert isinstance(rfp_number, str), "rfp_number must be string"
		assert isinstance(content_blocks, list), "content_blocks must be list"
		
		config = {
			"title": title,
			"author": "DocuFusion Corporation",
			"client": client,
			"rfp_number": rfp_number,
			"date": datetime.now().strftime("%Y-%m-%d"),
			"document_class": "docufusion-proposal",
			"font_size": "11pt",
			"paper_size": "letterpaper",
			"template": template,
			"toc": True,
			"content_blocks": content_blocks,
			"appendices": appendices or [],
			"generated_at": datetime.now().isoformat()
		}
		
		# Save configuration to metadata file
		metadata_file = self.repo_path / "document_metadata.json"
		metadata_file.write_text(json.dumps(config, indent=2))
		
		assert isinstance(config, dict), "Config must be dict"
		assert metadata_file.exists(), "Metadata file must exist after creation"
		return config
	
	def _log_block_error(self, message: str) -> None:
		"""Log block operation errors"""
		logger.error(f"[GitLatex] Block Error: {message}")

class GitLatexAssembler:
	"""Assemble documents from Git-managed LaTeX blocks"""

	def __init__(self, repo_path: Path):
		assert isinstance(repo_path, Path), "repo_path must be Path instance"

		self.repo_path = Path(repo_path)
		self.git_repo: "Repo | None" = None
		if GIT_AVAILABLE:
			self.git_repo = git.Repo(repo_path)  # type: ignore[union-attr]
		self.build_dir = repo_path / "build"
		self.build_dir.mkdir(exist_ok=True)

		assert self.build_dir.exists(), "Build directory must exist after initialization"

	async def assemble_document(
		self,
		document_config: dict[str, Any],
		target_branch: str = "main"
	) -> "CompilationResult":
		"""Assemble document from current Git state"""
		assert isinstance(document_config, dict), "document_config must be dict"
		assert isinstance(target_branch, str), "target_branch must be string"

		try:
			# Checkout target branch
			if self.git_repo:
				self.git_repo.git.checkout(target_branch)

			# Generate main.tex from configuration
			main_tex = self._generate_main_document(document_config)

			# Write main document
			main_path = self.repo_path / "main.tex"
			main_path.write_text(main_tex, encoding='utf-8')

			# Compile LaTeX document
			compiler = LaTeXCompiler(working_dir=self.repo_path)
			result = await compiler.compile_document("main.tex")

			# Tag successful builds
			if result.success:
				await self._tag_successful_build(document_config)

			assert isinstance(result, CanonicalCompilationResult), "Result must be CompilationResult"
			return result

		except Exception as e:
			return CanonicalCompilationResult(
				success=False,
				errors=[f"Assembly failed: {str(e)}"]
			)
	
	def _generate_main_document(self, config: dict[str, Any]) -> str:
		"""Generate main.tex with conditional includes"""
		assert isinstance(config, dict), "config must be dict"
		
		template = r"""
\documentclass[{font_size},{paper_size}]{{{document_class}}}

% Load templates and styles
\input{{templates/common_macros}}

% Document metadata
\title{{{title}}}
\author{{{author}}}
\clientname{{{client}}}
\rfpnumber{{{rfp_number}}}
\submissiondate{{{date}}}

\begin{{document}}

\maketitle
{table_of_contents}

% Content blocks
{content_includes}

% Conditional appendices
{appendix_includes}

\end{{document}}
"""
		
		# Build content includes
		content_includes = []
		for block in config.get('content_blocks', []):
			# Check if block file exists
			block_path = self.repo_path / "blocks" / f"{block}.tex"
			if block_path.exists():
				content_includes.append(f"\\input{{blocks/{block}}}")
			else:
				content_includes.append(f"% Missing block: {block}")
		
		# Build appendix includes  
		appendix_includes = []
		if config.get('appendices', []):
			appendix_includes.append("\\appendix")
			for appendix in config['appendices']:
				appendix_path = self.repo_path / "blocks" / "appendices" / f"{appendix}.tex"
				if appendix_path.exists():
					appendix_includes.append(f"\\input{{blocks/appendices/{appendix}}}")
		
		result = template.format(
			font_size=config.get('font_size', '11pt'),
			paper_size=config.get('paper_size', 'letterpaper'),
			document_class=config.get('document_class', 'article'),
			title=config.get('title', 'Document Title'),
			author=config.get('author', 'Author Name'),
			client=config.get('client', 'Client Name'),
			rfp_number=config.get('rfp_number', 'RFP-001'),
			date=config.get('date', r'\today'),
			table_of_contents="\\tableofcontents\\newpage" if config.get('toc', True) else "",
			content_includes='\n'.join(content_includes),
			appendix_includes='\n'.join(appendix_includes)
		)
		
		assert isinstance(result, str), "Generated document must be string"
		return result
	
	async def _tag_successful_build(self, config: dict[str, Any]) -> None:
		"""Tag successful builds in Git"""
		assert isinstance(config, dict), "config must be dict"

		try:
			tag_name = f"build-{config.get('rfp_number', 'unknown')}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
			if self.git_repo:
				self.git_repo.create_tag(tag_name, message=f"Successful build: {config.get('title', 'Document')}")  # type: ignore[union-attr]
		except Exception as e:
			self._log_build_error(f"Failed to create Git tag: {e}")

	def _log_build_error(self, message: str) -> None:
		"""Log build operation errors"""
		logger.error(f"[GitLatex] Build Error: {message}")

# Adapter class to use canonical LaTeXCompiler with file-based interface
class LaTeXCompiler:
	"""
	Adapter wrapping canonical LaTeXCompiler for file-based compilation.

	This class provides a file-based interface (working_dir, compile_document)
	while delegating to the canonical content-based LaTeXCompiler from pdf_renderer.
	"""

	def __init__(self, working_dir: Path):
		assert isinstance(working_dir, Path), "working_dir must be Path instance"

		self.working_dir = Path(working_dir)
		self._canonical_compiler = CanonicalLaTeXCompiler()
		self.build_dir = working_dir / "build"
		self.build_dir.mkdir(exist_ok=True)

		assert self.build_dir.exists(), "Build directory must exist after initialization"

	async def compile_document(self, tex_file: str) -> "CompilationResult":
		"""Compile LaTeX file to PDF using canonical compiler."""
		assert isinstance(tex_file, str), "tex_file must be string"

		tex_path = self.working_dir / tex_file

		if not tex_path.exists():
			return CanonicalCompilationResult(
				success=False,
				errors=[f"LaTeX file not found: {tex_file}"]
			)

		try:
			# Read LaTeX content from file
			latex_content = tex_path.read_text(encoding='utf-8')

			# Use canonical compiler with working directory
			result = await self._canonical_compiler.compile_to_pdf(
				latex_content,
				filename=Path(tex_file).stem
			)

			# Adapt result to file-based interface
			if result.success:
				# Copy PDF to build directory
				pdf_target = self.build_dir / f"{Path(tex_file).stem}.pdf"
				pdf_target.write_bytes(result.compiled_content)

				return CanonicalCompilationResult(
					success=True,
					output_file=str(pdf_target),
					compilation_log=result.compilation_log,
					compilation_time=result.compilation_time,
					output_format="pdf"
				)
			else:
				return CanonicalCompilationResult(
					success=False,
					compilation_log=result.compilation_log,
					errors=result.errors
				)

		except Exception as e:
			return CanonicalCompilationResult(
				success=False,
				errors=[f"Compilation error: {str(e)}"]
			)

# Mock AI service for Phase 1 implementation
class MockAIService:
	"""Mock AI service for content generation"""
	
	async def generate_latex_content(
		self,
		block_type: str,
		requirements: dict[str, Any]
	) -> str:
		"""Generate mock LaTeX content"""
		assert isinstance(block_type, str), "block_type must be string"
		assert isinstance(requirements, dict), "requirements must be dict"
		
		# This will be replaced with real AI service in later phases
		content = f"% AI-generated {block_type} content\n\\section{{{requirements.get('title', 'Generated Content')}}}\n\nThis is AI-generated content for {block_type}."
		
		assert isinstance(content, str), "Generated content must be string"
		return content
	
	async def enhance_latex_content(
		self,
		current_content: str,
		updates: dict[str, Any]
	) -> str:
		"""Enhance existing content with AI assistance"""
		assert isinstance(current_content, str), "current_content must be string"
		assert isinstance(updates, dict), "updates must be dict"
		
		# Simple mock enhancement
		enhancement = f"\n\n% AI Enhancement: {updates.get('enhancement_type', 'general')}\n"
		result = current_content + enhancement
		
		assert isinstance(result, str), "Enhanced content must be string"
		return result
