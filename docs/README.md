# DocuFusion AI Agent Framework Documentation

Welcome to the comprehensive documentation for the DocuFusion AI Agent Framework, featuring the Agent Composition Language (ACL) for declarative workflow orchestration.

## 📚 Documentation Index

### Core Framework
- **[Agent System Overview](agent_system.md)** - Complete guide to the DocuFusion agent architecture
- **[Visual Orchestration](visual_orchestration.md)** - Drag-and-drop workflow building interface
- **[Integration Guide](integration_guide.md)** - Connecting with external systems and services

### Agent Composition Language (ACL)
- **[ACL Quick Start](acl_quick_start.md)** - Get started with ACL in 5 minutes
- **[Complete Language Guide](composition_language.md)** - Comprehensive ACL documentation
- **[Architecture Deep Dive](acl_architecture.md)** - Technical architecture and design patterns
- **[Practical Examples](acl_examples.md)** - Real-world workflow examples and patterns

## 🚀 What is DocuFusion?

DocuFusion is an advanced AI agent framework designed for intelligent document creation, content generation, and workflow automation. At its core is the Agent Composition Language (ACL), a declarative YAML-based DSL that makes complex agent orchestration intuitive and maintainable.

### Key Features

- **🧠 Intelligent Agent Ecosystem**: Specialized agents for research, analysis, writing, review, and editing
- **📝 Declarative Workflows**: YAML-based composition language with intuitive operator syntax  
- **🔄 Advanced Orchestration**: Parallel execution, conditional logic, error handling, and real-time monitoring
- **🎨 Visual Interface**: Drag-and-drop workflow builder with live execution monitoring
- **⚡ High Performance**: Optimized execution engine with automatic parallelization
- **🔧 Extensible Architecture**: Plugin system for custom agents, functions, and operators

## 🎯 Quick Start

### 1. Basic Agent Workflow

```yaml
composition:
  name: "Simple Content Creation"
  version: "1.0"

agents:
  researcher:
    type: "research_agent"
    prompt: "Research the topic: {topic}"
  
  writer:
    type: "content_agent"
    prompt: "Write content based on: {research_output}"

flow:
  main:
    sequence: |
      researcher -> writer
```

### 2. Execute the Workflow

```python
from proposal_writer.composition import CompositionParser, CompositionInterpreter, CompositionRunner

# Parse, interpret, and execute
parser = CompositionParser()
interpreter = CompositionInterpreter()
runner = CompositionRunner()

parsed = await parser.parse_composition(yaml_content)
interpreted = await interpreter.interpret_composition(parsed)
result = await runner.execute_composition(interpreted, {"topic": "AI Trends"})
```

## 🔧 Core Operators

ACL provides intuitive operators for complex workflow logic:

| Operator | Syntax | Description |
|----------|--------|-------------|
| Sequential | `agent1 -> agent2` | Execute agents in sequence |
| Parallel | `agent1 \|\| agent2` | Execute agents concurrently |
| Conditional | `agent1 < (path1, path2, condition)` | Branch based on conditions |
| Pipeline | `agent1 >> agent2` | Data-focused sequential flow |
| Join | `(agent1 \|\| agent2) & merge` | Synchronize parallel paths |
| Loop | `agent1 * 3` | Repeat execution |
| Error Handler | `agent1 ! fallback` | Define error recovery |
| Async | `~agent1` | Fire-and-forget execution |
| Fallback | `agent1 \| agent2` | Alternative on failure |

## 📖 Documentation Structure

### For Beginners
1. Start with **[ACL Quick Start](acl_quick_start.md)** for a 5-minute introduction
2. Try the examples in **[Practical Examples](acl_examples.md)**
3. Explore the **[Complete Language Guide](composition_language.md)** for full features

### For Developers
1. Read the **[Architecture Deep Dive](acl_architecture.md)** for system design
2. Study **[Agent System Overview](agent_system.md)** for implementation details
3. Check **[Integration Guide](integration_guide.md)** for API usage

### For Enterprise Users
1. Review **[Practical Examples](acl_examples.md)** for enterprise patterns
2. Examine **[Visual Orchestration](visual_orchestration.md)** for UI capabilities
3. Consult **[Complete Language Guide](composition_language.md)** for advanced features

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DocuFusion AI Framework                      │
├─────────────────┬───────────────┬───────────────┬───────────────┤
│  Visual Editor  │  ACL Engine   │  Agent System │  Integration  │
│                 │               │               │  Layer        │
│  • Drag & Drop  │  • Parser     │  • Specialist │               │
│  • Live Monitor │  • Interpreter│    Agents     │  • APIs       │
│  • Prompt Edit  │  • Runner     │  • Tools      │  • Webhooks   │
│  • Auto-arrange │  • Streaming  │  • Context    │  • Databases  │
└─────────────────┴───────────────┴───────────────┴───────────────┘
```

## 🎨 Visual Workflow Builder

DocuFusion includes a comprehensive visual interface:

- **Drag-and-Drop Canvas**: Build workflows visually
- **Real-time Execution**: Monitor workflows as they run
- **Prompt Editor**: Edit agent prompts with live validation
- **Auto-arrangement**: Intelligent workflow layout
- **Collaboration**: Multi-user workflow editing

## 🔌 Integration Capabilities

### Supported Integrations
- **LLM Providers**: Ollama, OpenAI, Anthropic, local models
- **Data Sources**: Databases, APIs, file systems, web scraping
- **Output Formats**: PDF, DOCX, HTML, Markdown, JSON
- **Monitoring**: Metrics, alerts, performance tracking
- **Deployment**: Containers, serverless, microservices

### Agent Types
- **Research Agents**: Web search, academic papers, data analysis
- **Content Agents**: Writing, editing, formatting, translation
- **Analysis Agents**: Market research, competitive analysis, technical review
- **Specialist Agents**: Legal review, compliance checking, quality assurance
- **Tool Agents**: File processing, API integration, data transformation

## 📊 Performance & Scalability

- **Parallel Execution**: Automatic parallelization of independent agents
- **Resource Management**: Intelligent resource allocation and pooling
- **Caching**: Multi-level caching for improved performance
- **Monitoring**: Real-time performance metrics and alerting
- **Scalability**: Horizontal scaling with distributed execution

## 🛡️ Security & Compliance

- **Input Validation**: Comprehensive input sanitization and validation
- **Access Control**: Role-based permissions and agent capabilities
- **Audit Logging**: Complete execution audit trails
- **Data Privacy**: Configurable data retention and anonymization
- **Compliance**: Support for GDPR, HIPAA, and industry standards

## 🤝 Community & Support

### Getting Help
- **GitHub Issues**: Report bugs and request features
- **Documentation**: Comprehensive guides and examples
- **Community Forum**: Connect with other users and developers
- **Professional Support**: Enterprise support available

### Contributing
- **Code Contributions**: Pull requests welcome
- **Documentation**: Help improve guides and examples
- **Agent Development**: Contribute new agent types and tools
- **Example Workflows**: Share useful composition patterns

## 📈 Roadmap

### Upcoming Features
- **Multi-language SDKs**: Python, JavaScript, Go, Rust
- **Cloud Deployment**: Managed cloud service
- **Advanced Analytics**: Workflow performance optimization
- **ML Integration**: Machine learning pipeline support
- **Distributed Execution**: Multi-node execution clusters

### Version History
- **v1.0**: Initial ACL implementation with core operators
- **v1.1**: Visual workflow builder and monitoring dashboard
- **v1.2**: Advanced error handling and recovery mechanisms
- **v1.3**: Performance optimization and distributed execution

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🙏 Acknowledgments

Built with love by the DocuFusion team at Datacraft Ltd. Special thanks to the open-source community for their contributions and feedback.

---

**Ready to build intelligent workflows?** Start with the **[ACL Quick Start Guide](acl_quick_start.md)** and create your first agent composition in minutes!