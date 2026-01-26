"""
Performance test suite for the RAG system.

This module contains comprehensive performance tests for evaluating:
- Document ingestion throughput
- Search query latency and distribution  
- Concurrent operation performance
- Memory usage scaling
- System resource utilization

Test markers:
- @pytest.mark.performance: Standard performance tests
- @pytest.mark.integration: Integration performance tests (require real API)
"""