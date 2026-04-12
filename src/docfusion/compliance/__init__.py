"""
DocuFusion Compliance Package

Automated compliance checking and gap analysis system.
Ensures regulatory adherence and requirement coverage
with real-time validation and risk scoring.
"""

__version__ = "0.1.0"
__author__ = "DocuFusion Team"

from .validators.regulatory_field_validator import RegulatoryValidator
from .validators.format_field_validator import FormatValidator
from .frameworks.compliance_framework import ComplianceFramework

__all__ = [
	"RegulatoryValidator",
	"FormatValidator", 
	"ComplianceFramework"
]