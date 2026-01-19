# docfusion

[![CI/CD Pipeline](https://github.com/yourusername/docfusion/workflows/CI/badge.svg)](https://github.com/yourusername/docfusion/actions)
[![Airflow DAG Validation](https://github.com/yourusername/docfusion/workflows/Airflow%20DAG%20Validation/badge.svg)](https://github.com/yourusername/docfusion/actions)
[![codecov](https://codecov.io/gh/yourusername/docfusion/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/docfusion)
[![Documentation Status](https://readthedocs.org/projects/docfusion/badge/?version=latest)](https://docfusion.readthedocs.io/en/latest/?badge=latest)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![uv](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/uv/main/assets/badge/v0.json)](https://github.com/astral-sh/uv)
[![Ruff](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/ruff/main/assets/badge/v2.json)](https://github.com/astral-sh/ruff)
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)
[![Checked with mypy](https://www.mypy-lang.org/static/mypy_badge.svg)](https://mypy-lang.org/)
[![security: bandit](https://img.shields.io/badge/security-bandit-green.svg)](https://github.com/PyCQA/bandit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> A modern Python project built with cutting-edge tooling, comprehensive automation, and enterprise-grade best practices.

## ✨ Features

- 🚀 **Lightning-fast dependency management** with [UV](https://github.com/astral-sh/uv)
- 🔍 **Comprehensive code quality** with [Ruff](https://github.com/astral-sh/ruff) (linting + formatting)
- 🛡️ **Static type safety** with [MyPy](https://github.com/python/mypy)
- 🧪 **Robust testing framework** with [pytest](https://github.com/pytest-dev/pytest)
- 🔒 **Multi-layer security scanning** (Bandit, Safety, pip-audit)
- 🔄 **Automated quality gates** with pre-commit hooks
- 📚 **Professional documentation** with Sphinx
- 🐳 **Production-ready containerization** with optimized Docker builds
- 🌪️ **Workflow orchestration** with Apache Airflow 3.0+ integration
- 🚀 **Enterprise CI/CD** with GitHub Actions
- 📊 **Performance monitoring** and benchmarking
- 🎯 **100% type coverage** and comprehensive testing

## 🚀 Quick Start

### Prerequisites

#### Install UV (Recommended)
UV is a blazing-fast Python package installer and resolver, written in Rust.

```bash
# macOS and Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# Or via pip
pip install uv
```

#### Alternative: Traditional Setup
If you prefer traditional tools:
```bash
# Ensure you have Python 3.10+ installed
python --version  # Should be 3.10 or higher
pip install --upgrade pip
```

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/docfusion.git
   cd docfusion
   ```

2. **Set up the development environment:**
   ```bash
   make dev-setup
   ```
   
   This single command will:
   - 📦 Install all dependencies with UV
   - 🔗 Set up pre-commit hooks
   - ✅ Validate the environment
   - 🎯 Prepare for development

3. **Verify installation:**
   ```bash
   make quality-check
   ```

4. **Run the application:**
   ```bash
   make run
   ```

### Alternative Installation Methods

<details>
<summary>🐳 Docker Setup</summary>

```bash
# Build and run with Docker
docker build -t docfusion:latest .
docker run -p 8000:8000 docfusion:latest

# Or use docker-compose
docker-compose up --build
```
</details>

<details>
<summary>🌪️ Airflow Integration</summary>

```bash
# Set up Airflow environment
make airflow-setup
make airflow-init

# Start Airflow services
make airflow-start

# Access Airflow UI at http://localhost:8080 (admin/admin)
```
</details>

<details>
<summary>📓 Jupyter Development</summary>

```bash
# Start Jupyter Lab
make lab

# Or traditional Jupyter Notebook
make notebook
```
</details>

## 🛠️ Development

### Development Workflow

docfusion follows modern Python development practices with comprehensive automation:

```bash
# 🚀 Daily development commands
make dev-setup          # One-time environment setup
make quality-check       # Run all quality checks
make test-coverage       # Run tests with coverage
make tdd                # Test-driven development mode
make docs               # Generate documentation
```

### Available Commands

Run `make help` to see all available commands:

<details>
<summary>📋 Core Development Commands</summary>

| Command | Description |
|---------|-------------|
| `make dev-setup` | Complete development environment setup |
| `make quality-check` | Run comprehensive quality pipeline |
| `make test` | Run test suite |
| `make test-coverage` | Run tests with coverage analysis |
| `make test-parallel` | Run tests in parallel |
| `make test-watch` | Continuous testing (watch mode) |
| `make format` | Format code with Ruff |
| `make lint` | Comprehensive linting |
| `make type-check` | Static type checking with MyPy |
| `make security-scan` | Security vulnerability scanning |

</details>

<details>
<summary>📦 Dependency Management</summary>

| Command | Description |
|---------|-------------|
| `make uv-add PACKAGE=name` | Add production dependency |
| `make uv-add-dev PACKAGE=name` | Add development dependency |
| `make uv-remove PACKAGE=name` | Remove dependency |
| `make deps-update` | Update all dependencies |
| `make deps-tree` | Show dependency tree |
| `make deps-audit` | Security audit dependencies |

</details>

<details>
<summary>🚀 Build and Deploy</summary>

| Command | Description |
|---------|-------------|
| `make build` | Build distribution packages |
| `make docker-build` | Build Docker image |
| `make docker-run` | Run in Docker container |
| `make upload-test` | Upload to TestPyPI |
| `make upload` | Upload to PyPI |

</details>

### Adding Dependencies

```bash
# Production dependencies
make uv-add PACKAGE="fastapi>=0.104.0"
make uv-add PACKAGE="pydantic[email]"

# Development dependencies  
make uv-add-dev PACKAGE="pytest-mock"
make uv-add-dev PACKAGE="httpx"

# Remove dependencies
make uv-remove PACKAGE="unused-package"
```

### Code Quality Standards

docfusion maintains the highest code quality standards:

#### 🎨 **Code Formatting**
- **Ruff** for ultra-fast linting and formatting (replaces Black + isort + flake8)
- **Consistent style** across the entire codebase
- **Automatic formatting** on save and commit

#### 🔍 **Static Analysis**
- **MyPy** for comprehensive type checking
- **Strict mode** enabled for maximum type safety
- **100% type coverage** requirement

#### 🧪 **Testing**
- **pytest** with comprehensive test suite
- **Minimum 80% coverage** requirement (configurable)
- **Property-based testing** with Hypothesis
- **Performance benchmarking** with pytest-benchmark

#### 🔒 **Security**
- **Bandit** for security vulnerability detection
- **Safety** for dependency vulnerability scanning
- **pip-audit** for package security auditing
- **Secret detection** in pre-commit hooks

### Pre-commit Hooks

Quality gates are automatically enforced:

```bash
# Automatically installed with dev-setup
make pre-commit-install

# Run manually
make pre-commit-run

# Update hooks
make pre-commit-update
```

**Enabled hooks:**
- ✅ Code formatting (Ruff)
- ✅ Import sorting (Ruff)
- ✅ Linting (Ruff)
- ✅ Type checking (MyPy)
- ✅ Security scanning (Bandit)
- ✅ Secret detection
- ✅ Conventional commits
- ✅ Documentation validation

## 🧪 Testing

### Running Tests

```bash
# Basic test run
make test

# With coverage analysis
make test-coverage

# Parallel execution (faster)
make test-parallel

# Watch mode (continuous testing)
make test-watch

# Performance benchmarks
make benchmark
```

### Test Organization

```
tests/
├── unit/              # Unit tests
├── integration/       # Integration tests
├── conftest.py       # Pytest configuration
└── test_main.py      # Main application tests
```

### Coverage Requirements

- **Minimum coverage:** 80% (configurable in `pyproject.toml`)
- **Branch coverage** enabled
- **HTML reports** generated in `reports/coverage/`
- **XML reports** for CI/CD integration

## 📚 Documentation

### Building Documentation

```bash
# Generate documentation
make docs

# Serve locally
make docs-serve  # http://localhost:8000

# Clean documentation
make docs-clean
```

### Documentation Structure

```
docs/
├── api/              # API documentation
├── design/           # Design documents
├── user_guides/      # User guides
└── dev_notes/        # Developer notes
```

### API Documentation

API documentation is automatically generated from docstrings:

- **Google-style docstrings** (enforced by pydocstyle)
- **Type hints** automatically documented
- **Sphinx autodoc** integration
- **Interactive examples** with code blocks

## 🐳 Docker

### Docker Images

docfusion provides optimized Docker images:

```bash
# Production image (minimal, secure)
docker build -t docfusion:latest .

# Development image (full tooling)
docker build --target development -t docfusion:dev .

# Multi-architecture support
docker buildx build --platform linux/amd64,linux/arm64 -t docfusion:latest .
```

### Docker Features

- 🔒 **Security-first:** Non-root user, minimal attack surface
- ⚡ **Performance:** Multi-stage builds, layer caching
- 🏗️ **UV optimization:** Leverages UV for fast dependency installation
- 📦 **Multi-arch:** AMD64 and ARM64 support
- 🔍 **Health checks:** Built-in health monitoring
- 📊 **Observability:** Structured logging and metrics

### Docker Compose

```bash
# Development environment
docker-compose -f docker-compose.dev.yml up

# Production deployment
docker-compose up --build

# With external services
docker-compose -f docker-compose.yml -f docker-compose.services.yml up
```

## 🌪️ Airflow Integration

docfusion includes comprehensive Apache Airflow 3.0+ integration:

### Setting Up Airflow

```bash
# Initialize Airflow
make airflow-setup
make airflow-init

# Start services
make airflow-start

# Access UI: http://localhost:8080 (admin/admin)
```

### DAG Development

```python
# Example DAG structure
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta

default_args = {
    'owner': 'docfusion',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

with DAG(
    'docfusion_pipeline',
    default_args=default_args,
    description='docfusion data pipeline',
    schedule_interval='@daily',
    catchup=False,
    tags=['docfusion', 'production'],
) as dag:
    # Your tasks here
    pass
```

### DAG Validation

Comprehensive DAG validation is automated:

- ✅ **Syntax validation** with Python AST
- ✅ **Import validation** with DagBag
- ✅ **Structure validation** (dependencies, schedules)
- ✅ **Security scanning** for DAG files
- ✅ **Performance analysis** and complexity scoring
- ✅ **Documentation coverage** validation

```bash
# Run DAG validation
make airflow-test

# Validate specific DAG
airflow dags test docfusion_pipeline 2024-01-01
```

## 🚀 CI/CD

### GitHub Actions Workflows

docfusion includes enterprise-grade CI/CD:

#### 🔄 **Main CI/CD Pipeline** (`.github/workflows/ci.yml`)
- **Multi-Python version testing** (3.10, 3.11, 3.12)
- **Cross-platform testing** (Ubuntu, Windows, macOS)
- **Quality gates** (linting, type checking, security)
- **Automated testing** with coverage reporting
- **Documentation building** and deployment
- **Package building** and PyPI publishing
- **Docker image building** with multi-arch support

#### 🌪️ **Airflow DAG Validation** (`.github/workflows/airflow-dag-check.yml`)
- **Airflow 3.0+ compatibility** testing
- **PostgreSQL 16 integration** testing
- **DAG syntax and structure** validation
- **Security scanning** for workflow files
- **Performance analysis** and optimization
- **Integration testing** with Celery and Redis

### Deployment Strategies

<details>
<summary>🚀 Automated Deployments</summary>

```yaml
# Tag-based releases
git tag v1.0.0
git push origin v1.0.0  # Triggers PyPI release

# Manual deployment
gh workflow run ci.yml -f deploy_environment=production

# Environment-specific deployments
gh workflow run ci.yml -f deploy_environment=staging
```
</details>

<details>
<summary>📦 Package Publishing</summary>

```bash
# TestPyPI (staging)
make upload-test

# PyPI (production)
make upload

# Automated via GitHub Actions on tag push
```
</details>

### Quality Gates

Every commit and PR goes through:

1. 🎨 **Code formatting** validation
2. 🔍 **Comprehensive linting** (500+ rules)
3. 🛡️ **Type checking** (100% coverage)
4. 🔒 **Security scanning** (multiple tools)
5. 🧪 **Test execution** (unit + integration)
6. 📊 **Coverage analysis** (80% minimum)
7. 📚 **Documentation** building
8. 🐳 **Docker image** building
9. 🌪️ **Airflow DAG** validation

## 📊 Performance

### Benchmarking

docfusion includes comprehensive performance monitoring:

```bash
# Run performance benchmarks
make benchmark

# Memory profiling
make memory-profile

# Line-by-line profiling
make line-profile

# Complexity analysis
make complexity
```

### Performance Metrics

- ⚡ **UV dependency resolution:** 10-100x faster than pip
- 🚀 **Ruff linting:** 10-100x faster than flake8
- 📦 **Docker builds:** Multi-stage optimization
- 🔄 **CI/CD pipeline:** Parallel execution with caching
- 📊 **Test execution:** Parallel testing with pytest-xdist

## 🔧 Configuration

### Project Configuration

All configuration is centralized in `pyproject.toml`:

<details>
<summary>📋 Tool Configuration</summary>

```toml
[tool.ruff]
line-length = 88
target-version = "py310"

[tool.mypy]
strict = true
warn_return_any = true

[tool.pytest.ini_options]
minversion = "7.0"
addopts = "--strict-markers --tb=short"

[tool.coverage.report]
fail_under = 80
show_missing = true
```
</details>

### Environment Variables

<details>
<summary>🌍 Environment Configuration</summary>

```bash
# Development
DEBUG=True
LOG_LEVEL=DEBUG

# Production
DEBUG=False
LOG_LEVEL=INFO
DATABASE_URL=postgresql://...

# Airflow
AIRFLOW_HOME=./airflow
AIRFLOW__CORE__EXECUTOR=CeleryExecutor
```
</details>

## 🏗️ Project Structure

```
docfusion/
├── 📁 src/docfusion/          # Source code (src-layout)
│   ├── __init__.py                   # Package initialization
│   ├── main.py                       # Main application entry
│   ├── api/                          # API modules
│   ├── models/                       # Data models
│   └── utils/                        # Utility functions
├── 📁 tests/                         # Test suite
│   ├── unit/                         # Unit tests
│   ├── integration/                  # Integration tests
│   └── conftest.py                   # Pytest configuration
├── 📁 docs/                          # Documentation
│   ├── api/                          # API documentation
│   └── user_guides/                  # User guides
├── 📁 airflow/                       # Airflow workflows
│   ├── dags/                         # DAG definitions
│   ├── plugins/                      # Custom plugins
│   └── tests/                        # DAG tests
├── 📁 deployment/                    # Deployment configurations
│   ├── docker/                       # Docker configurations
│   ├── kubernetes/                   # K8s manifests
│   └── terraform/                    # Infrastructure as code
├── 📁 .github/workflows/             # CI/CD pipelines
├── 📄 pyproject.toml                 # Project configuration
├── 📄 uv.lock                        # Dependency lock file
├── 📄 Dockerfile                     # Container definition
├── 📄 docker-compose.yml             # Local development
├── 📄 Makefile                       # Development automation
└── 📄 README.md                      # This file
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Process

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Set up** development environment (`make dev-setup`)
4. **Make** your changes
5. **Run** quality checks (`make quality-check`)
6. **Commit** your changes (`git commit -m 'feat: add amazing feature'`)
7. **Push** to the branch (`git push origin feature/amazing-feature`)
8. **Open** a Pull Request

### Code Standards

- 🎯 **100% type coverage** with MyPy
- 📊 **Minimum 80% test coverage**
- 🎨 **Consistent formatting** with Ruff
- 📝 **Google-style docstrings**
- 🔒 **Security best practices**
- ✅ **All pre-commit hooks** passing

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: add new feature
fix: resolve bug
docs: update documentation
style: formatting changes
refactor: code restructuring
test: add tests
chore: maintenance tasks
```

## 📈 Roadmap

### Current Version (v0.1.0)
- ✅ Core functionality
- ✅ Comprehensive testing
- ✅ Documentation
- ✅ CI/CD pipeline

### Upcoming Features
- 🚀 **Performance optimizations**
- 📊 **Enhanced monitoring**
- 🔌 **Plugin system**
- 🌍 **Internationalization**
- 📱 **Mobile API**

See our [Project Board](https://github.com/yourusername/docfusion/projects) for detailed progress.

## 🆘 Support

### Getting Help

- 📚 **Documentation:** [https://docfusion.readthedocs.io](https://docfusion.readthedocs.io)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/yourusername/docfusion/discussions)
- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/yourusername/docfusion/issues)
- 📧 **Email:** support@docfusion.com

### Troubleshooting

<details>
<summary>🔧 Common Issues</summary>

**UV Installation Issues:**
```bash
# If UV installation fails
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
```

**Permission Errors:**
```bash
# Fix common permission issues
sudo chown -R $USER:$USER ~/.local/share/uv
```

**Airflow Issues:**
```bash
# Reset Airflow environment
make airflow-stop
rm -rf airflow/logs airflow/airflow.db
make airflow-init
```
</details>

### Performance Issues

<details>
<summary>⚡ Optimization Tips</summary>

**Slow Tests:**
```bash
# Use parallel testing
make test-parallel

# Run specific test categories
pytest -m "not slow"
```

**Large Dependencies:**
```bash
# Check dependency tree
make deps-tree

# Audit dependency sizes
uv tree --outdated
```
</details>

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

docfusion is built with and inspired by amazing open-source projects:

### Core Technologies
- 🚀 **[UV](https://github.com/astral-sh/uv)** - Ultra-fast Python package manager
- ⚡ **[Ruff](https://github.com/astral-sh/ruff)** - Blazing-fast Python linter
- 🛡️ **[MyPy](https://github.com/python/mypy)** - Static type checker
- 🧪 **[pytest](https://github.com/pytest-dev/pytest)** - Testing framework
- 🌪️ **[Apache Airflow](https://github.com/apache/airflow)** - Workflow orchestration

### Development Tools
- 🔄 **[Pre-commit](https://github.com/pre-commit/pre-commit)** - Git hooks
- 📚 **[Sphinx](https://github.com/sphinx-doc/sphinx)** - Documentation
- 🐳 **[Docker](https://www.docker.com/)** - Containerization
- 🤖 **[GitHub Actions](https://github.com/features/actions)** - CI/CD

### Special Thanks
- The **Python community** for continuous innovation
- **Astral** team for UV and Ruff
- **Apache Software Foundation** for Airflow
- All **contributors** and **maintainers**

---

<div align="center">

**Built with ❤️ and modern Python tooling**

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/docfusion&type=Date)](https://star-history.com/#yourusername/docfusion&Date)

[⬆ Back to top](#docfusion)

</div>