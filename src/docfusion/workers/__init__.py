"""Temporal worker packages for DocuFusion async pipelines.

Each subpackage owns one workflow domain. Today the only one is
``rfp_parse`` (RFP parse-on-upload). The split keeps task queues —
and therefore worker pools — domain-scoped: scaling rfp parsing
independently of, say, future composition workers is a config change,
not a refactor.
"""
