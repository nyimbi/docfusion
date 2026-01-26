# Ollama Integration for RAG System

## Overview

The RAG system now supports [Ollama](https://ollama.ai) as the default embedding provider, enabling privacy-first, cost-effective, and offline semantic search capabilities. This integration eliminates the need for external API calls while providing high-quality embeddings for document processing.

## Benefits of Ollama Integration

### 🔒 Privacy & Security
- **Complete Privacy**: Documents and queries never leave your infrastructure
- **Data Sovereignty**: Full control over sensitive information
- **Compliance**: Meets strict data governance requirements
- **No External Dependencies**: No third-party API calls

### 💰 Cost Efficiency  
- **No API Costs**: Eliminate per-token/request charges
- **Predictable Expenses**: Fixed infrastructure costs only
- **High Volume Friendly**: Cost doesn't scale with usage
- **ROI**: Significant savings for high-usage scenarios

### 🌐 Operational Benefits
- **Offline Operation**: Works without internet connectivity
- **Low Latency**: Local processing eliminates network overhead
- **Reliability**: No external service dependencies
- **Scalability**: Scale according to your hardware resources

## Supported Models

### Default: nomic-embed-text
- **Dimensions**: 768
- **Context Length**: 8192 tokens
- **Performance**: Optimized for retrieval tasks
- **Size**: ~274MB

### Alternative: bge-m3
- **Dimensions**: 1024
- **Context Length**: 8192 tokens  
- **Multilingual**: Supports 100+ languages
- **Size**: ~2.3GB

## Setup Instructions

### 1. Install Ollama

#### macOS
```bash
# Download and install from https://ollama.ai
curl -fsSL https://ollama.ai/install.sh | sh
```

#### Linux
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

#### Windows
Download installer from [https://ollama.ai](https://ollama.ai)

### 2. Start Ollama Service
```bash
ollama serve
```

### 3. Pull Embedding Model
```bash
# Default model (recommended)
ollama pull nomic-embed-text

# Alternative multilingual model
ollama pull bge-m3
```

### 4. Verify Installation
```bash
# Check available models
ollama list

# Test embedding generation
curl http://localhost:11434/api/embeddings -d '{
  "model": "nomic-embed-text",
  "prompt": "test embedding"
}'
```

## Configuration

### Default Configuration (Ollama)
```python
from proposal_writer.storage.rag import RAGConfiguration

config = RAGConfiguration(
    connection_string="postgresql://user:pass@host:5432/db",
    embedding_provider="ollama",  # Default
    ollama_model="nomic-embed-text",  # Default
    ollama_base_url="http://localhost:11434",  # Default
    embedding_dimensions=None,  # Auto-detected
    chunk_size=1000,
    chunk_overlap=200
)
```

### Alternative Models
```python
# Use bge-m3 for multilingual support
config = RAGConfiguration(
    connection_string="postgresql://user:pass@host:5432/db",
    embedding_provider="ollama",
    ollama_model="bge-m3",
    embedding_dimensions=1024  # Override auto-detection
)

# Use custom Ollama instance
config = RAGConfiguration(
    connection_string="postgresql://user:pass@host:5432/db",
    embedding_provider="ollama",
    ollama_base_url="http://my-ollama-server:11434",
    ollama_model="my-custom-embedding-model"
)
```

### Fallback to OpenAI
```python
# Fallback configuration for development/testing
config = RAGConfiguration(
    connection_string="postgresql://user:pass@host:5432/db",
    embedding_provider="openai",  # Use OpenAI instead
    openai_api_key="your-api-key",
    openai_model="text-embedding-ada-002"
)
```

## Usage Examples

### Basic RAG Service
```python
import asyncio
from proposal_writer.storage.rag import create_rag_service

async def main():
    # Create RAG service with Ollama (default)
    service = await create_rag_service(
        connection_string="postgresql://user:pass@host:5432/db",
        embedding_provider="ollama",  # Default
        ollama_model="nomic-embed-text"  # Default
    )
    
    # Add documents
    doc_id = await service.add_document(
        content="Your document content here",
        title="Test Document",
        category="test"
    )
    
    # Semantic search
    results = await service.search(
        query="your search query",
        limit=5,
        similarity_threshold=0.7
    )
    
    print(f"Found {len(results.results)} results")
    
    await service.close()

asyncio.run(main())
```

### RAG Storage Service
```python
from proposal_writer.storage.rag_storage_service import RAGStorageConfiguration, RAGStorageService
from pathlib import Path

async def main():
    config = RAGStorageConfiguration(
        storage_root_path=Path("./documents"),
        enable_rag=True,
        postgresql_connection_string="postgresql://user:pass@host:5432/db",
        embedding_provider="ollama",  # Use Ollama
        ollama_model="nomic-embed-text",
        enable_hybrid_search=True
    )
    
    service = RAGStorageService(config)
    await service.initialize()
    
    # Store document with RAG indexing
    doc_id = await service.store_document(
        content="Document content",
        title="Test Doc",
        enable_rag_indexing=True
    )
    
    # Hybrid search (traditional + semantic)
    results = await service.search_documents(
        query="search query",
        search_type="hybrid",
        limit=10
    )
    
    await service.close()

asyncio.run(main())
```

### Document Engine Integration
```python
from proposal_writer.document_engine.document_engine import DocumentEngine, DocumentGenerationConfiguration
from proposal_writer.storage.rag_storage_service import RAGStorageConfiguration, RAGStorageService

async def main():
    # RAG storage with Ollama
    storage_config = RAGStorageConfiguration(
        storage_root_path=Path("./storage"),
        enable_rag=True,
        postgresql_connection_string="postgresql://user:pass@host:5432/db",
        embedding_provider="ollama",
        ollama_model="nomic-embed-text"
    )
    
    rag_storage = RAGStorageService(storage_config)
    await rag_storage.initialize()
    
    # Document engine with RAG storage
    engine_config = DocumentGenerationConfiguration(
        enable_storage=True,
        storage_root_path="./storage",
        output_formats=["html", "markdown"]
    )
    
    document_engine = DocumentEngine(
        config=engine_config,
        storage_service=rag_storage  # Use RAG storage
    )
    
    # Generate documents with semantic enhancement
    # Documents will have access to semantically related content
    
    await rag_storage.close()

asyncio.run(main())
```

## Performance Considerations

### Hardware Requirements
- **CPU**: Modern multi-core processor (4+ cores recommended)
- **Memory**: 4GB+ RAM (8GB+ for larger models)
- **Storage**: SSD recommended for model storage
- **Network**: Not required for embedding generation

### Performance Tuning
```python
config = RAGConfiguration(
    connection_string="postgresql://user:pass@host:5432/db",
    embedding_provider="ollama",
    ollama_model="nomic-embed-text",
    
    # Performance tuning
    max_concurrent_requests=5,  # Limit concurrent Ollama requests
    chunk_size=800,  # Smaller chunks = faster processing
    enable_caching=True,  # Cache embeddings
    request_timeout=30.0,  # Timeout for Ollama requests
    
    # Batch processing
    batch_size=50  # Process documents in batches
)
```

### Monitoring
```python
# Get embedding service statistics
stats = service.embedding_service.get_cache_stats()
print(f"Provider: {stats['embedding_provider']}")
print(f"Model: {stats['embedding_model']}")  
print(f"Dimensions: {stats['embedding_dimensions']}")
print(f"Cache size: {stats['cache_size']}")
print(f"Ollama URL: {stats['ollama_base_url']}")
```

## Troubleshooting

### Common Issues

#### 1. Ollama Service Not Running
```
Error: Ollama API error 404: Not Found
```
**Solution**: Start Ollama service
```bash
ollama serve
```

#### 2. Model Not Available
```
Error: model "nomic-embed-text" not found
```
**Solution**: Pull the required model
```bash
ollama pull nomic-embed-text
```

#### 3. Connection Refused
```
Error: Cannot connect to Ollama at localhost:11434
```
**Solution**: Check Ollama is running and accessible
```bash
curl http://localhost:11434/api/version
```

#### 4. Slow Performance
- Reduce `max_concurrent_requests` to limit CPU usage
- Use smaller `chunk_size` for faster processing
- Enable embedding cache to avoid recomputation
- Consider using SSD storage for Ollama models

### Model Management
```bash
# List installed models
ollama list

# Remove unused models to save space
ollama rm bge-m3

# Update to latest model version
ollama pull nomic-embed-text:latest

# Check model information
ollama show nomic-embed-text
```

## Migration from OpenAI

### Configuration Changes
```python
# Before (OpenAI)
config = RAGConfiguration(
    connection_string="postgresql://user:pass@host:5432/db",
    embedding_provider="openai",
    openai_api_key="sk-...",
    openai_model="text-embedding-ada-002",
    embedding_dimensions=1536
)

# After (Ollama)  
config = RAGConfiguration(
    connection_string="postgresql://user:pass@host:5432/db",
    embedding_provider="ollama",  # Changed
    ollama_model="nomic-embed-text",  # New
    ollama_base_url="http://localhost:11434",  # New
    embedding_dimensions=768  # Changed for nomic-embed-text
)
```

### Data Migration
- **No migration required**: Existing OpenAI embeddings remain valid
- **Hybrid approach**: Use different models for different document collections
- **Gradual transition**: Re-index documents over time with Ollama embeddings

### Performance Comparison
| Metric | OpenAI API | Ollama Local |
|--------|------------|--------------|
| Latency | ~200-500ms | ~50-200ms |
| Cost | $0.0001/1K tokens | $0 (after setup) |
| Privacy | External API | Complete |
| Offline | ❌ | ✅ |
| Rate Limits | Yes | Hardware only |

## Advanced Configuration

### Custom Models
```python
# Use custom fine-tuned embedding model
config = RAGConfiguration(
    connection_string="postgresql://user:pass@host:5432/db",
    embedding_provider="ollama",
    ollama_model="my-custom-embeddings",
    embedding_dimensions=768,  # Specify if not auto-detectable
    ollama_base_url="http://localhost:11434"
)
```

### Multiple Ollama Instances
```python
# Load balance across multiple Ollama instances
import random

ollama_urls = [
    "http://ollama-1:11434",
    "http://ollama-2:11434", 
    "http://ollama-3:11434"
]

config = RAGConfiguration(
    connection_string="postgresql://user:pass@host:5432/db",
    embedding_provider="ollama",
    ollama_base_url=random.choice(ollama_urls),  # Random selection
    ollama_model="nomic-embed-text"
)
```

### Docker Deployment
```yaml
# docker-compose.yml
version: '3.8'
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_models:/root/.ollama
    environment:
      - OLLAMA_KEEP_ALIVE=24h
      
  app:
    build: .
    depends_on:
      - ollama
      - postgres
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434

volumes:
  ollama_models:
```

## Best Practices

### 1. Resource Management
- Monitor CPU and memory usage during embedding generation
- Use appropriate `max_concurrent_requests` based on hardware
- Enable embedding caching to avoid recomputation
- Consider model size vs. accuracy trade-offs

### 2. Production Deployment
- Use dedicated hardware/containers for Ollama service
- Implement health checks for Ollama availability
- Set up monitoring and alerting for service status
- Plan for model storage and backup requirements

### 3. Security
- Restrict network access to Ollama service
- Use internal networks for Ollama communication
- Regularly update Ollama and models
- Monitor for unusual resource usage patterns

### 4. Development Workflow
```python
# Development: Use Ollama if available, fallback to OpenAI
import os
import aiohttp

async def get_embedding_provider():
    try:
        # Check if Ollama is available
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:11434/api/version"):
                return "ollama"
    except:
        # Fallback to OpenAI for development
        if os.getenv("OPENAI_API_KEY"):
            return "openai"
        else:
            raise Exception("No embedding provider available")

provider = await get_embedding_provider()
config = RAGConfiguration(
    connection_string="postgresql://user:pass@host:5432/db",
    embedding_provider=provider,
    # Configure based on provider...
)
```

This integration provides a powerful, privacy-first alternative to cloud-based embedding services while maintaining full compatibility with the existing RAG system architecture.