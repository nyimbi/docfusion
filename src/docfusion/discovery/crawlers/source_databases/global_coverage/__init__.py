"""
Global Coverage Database

Comprehensive databases mapping every procurement source worldwide.
Automatically maintained and updated through AI discovery.
"""

# Country and government mapping
# from .country_mapper import CountryMapper
# from .government_structure_mapper import GovernmentStructureMapper
# from .ministry_directory import MinistryDirectory  
# from .agency_hierarchy_mapper import AgencyHierarchyMapper

# International organization mapping
# from .un_system_mapper import UNSystemMapper
# from .development_bank_mapper import DevelopmentBankMapper
# from .multilateral_org_mapper import MultilateralOrgMapper
# from .regional_bloc_mapper import RegionalBlocMapper

# Corporate structure mapping
# from .fortune_500_mapper import Fortune500Mapper
# from .corporate_hierarchy_mapper import CorporateHierarchyMapper
# from .industry_classification_mapper import IndustryClassificationMapper
# from .supply_chain_mapper import SupplyChainMapper

# Foundation ecosystem mapping
# from .foundation_taxonomy import FoundationTaxonomy
# from .donor_network_mapper import DonorNetworkMapper
# from .philanthropic_ecosystem_mapper import PhilanthropicEcosystemMapper
# from .grant_maker_directory import GrantMakerDirectory

# Auto-discovery and maintenance
# from .source_auto_discoverer import SourceAutoDiscoverer
# from .coverage_gap_detector import CoverageGapDetector
# from .source_health_monitor import SourceHealthMonitor
# from .database_updater import DatabaseUpdater

__all__ = [
    "CountryMapper", "GovernmentStructureMapper", "MinistryDirectory", "AgencyHierarchyMapper",
    "UNSystemMapper", "DevelopmentBankMapper", "MultilateralOrgMapper", "RegionalBlocMapper",
    "Fortune500Mapper", "CorporateHierarchyMapper", "IndustryClassificationMapper", "SupplyChainMapper", 
    "FoundationTaxonomy", "DonorNetworkMapper", "PhilanthropicEcosystemMapper", "GrantMakerDirectory",
    "SourceAutoDiscoverer", "CoverageGapDetector", "SourceHealthMonitor", "DatabaseUpdater"
]