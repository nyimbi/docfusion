#!/usr/bin/env python3
"""
Tender Intelligence Database - International Institutions
MDBs, UN Agencies, Bilateral Development Agencies, Regional Economic Communities
"""

import json
from datetime import date

TODAY = date.today().isoformat()

def create_entry(source_id, source_name, url, country_code, country_name, region, entity_type,
                 entity_subtype, sectors, languages, update_freq="Unknown", registration="Unknown",
                 api_available="No", data_format="HTML, PDF", est_tenders="Unknown", tech_notes=""):
    return {
        "Source_ID": source_id, "Source_Name": source_name, "URL": url,
        "Country_Code": country_code, "Country_Name": country_name, "Region": region,
        "Entity_Type": entity_type, "Entity_Subtype": entity_subtype,
        "Sectors_Covered": sectors, "Languages": languages, "Update_Frequency": update_freq,
        "Registration_Required": registration, "API_Available": api_available,
        "Data_Format": data_format, "Est_Annual_Tenders": est_tenders,
        "Technical_Notes": tech_notes, "Primary_Source": "Yes", "Last_Verified": TODAY
    }

international = [
    # MULTILATERAL DEVELOPMENT BANKS (MDBs)
    # World Bank Group
    create_entry("INT-MDB-0001", "World Bank Procurement", "https://www.worldbank.org/en/projects-operations/products-and-services/brief/procurement", "INT", "International", "International-MDB", "MDB", "World Bank Group", "All sectors", "English, French, Spanish, Arabic, Chinese", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "STEP system, largest MDB"),
    create_entry("INT-MDB-0002", "World Bank STEP Portal", "https://step.worldbank.org", "INT", "International", "International-MDB", "MDB", "World Bank Group", "All sectors", "English", "Daily", "Free Registration", "Yes", "HTML, XML, JSON", "Very High (>2000)", "Systematic Tracking of Exchanges in Procurement"),
    create_entry("INT-MDB-0003", "IFC (Private Sector)", "https://www.ifc.org/en/what-we-do/sector-expertise/procurement", "INT", "International", "International-MDB", "MDB", "World Bank Group", "Private sector, Advisory", "English", "Weekly", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-MDB-0004", "MIGA (Guarantees)", "https://www.miga.org/procurement", "INT", "International", "International-MDB", "MDB", "World Bank Group", "Insurance, Guarantees", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # African Development Bank Group
    create_entry("INT-MDB-0005", "African Development Bank Procurement", "https://www.afdb.org/en/projects-and-operations/procurement", "INT", "International", "International-MDB", "MDB", "African Development Bank", "All sectors - Africa focus", "English, French", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("INT-MDB-0006", "AfDB EPPS Portal", "https://epps.afdb.org", "INT", "International", "International-MDB", "MDB", "African Development Bank", "All sectors - Africa focus", "English, French", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Electronic Procurement Portal System"),

    # Asian Development Bank
    create_entry("INT-MDB-0007", "Asian Development Bank Procurement", "https://www.adb.org/site/business-opportunities/operational-procurement", "INT", "International", "International-MDB", "MDB", "Asian Development Bank", "All sectors - Asia-Pacific focus", "English", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)"),
    create_entry("INT-MDB-0008", "ADB Consultant Management System", "https://cms.adb.org", "INT", "International", "International-MDB", "MDB", "Asian Development Bank", "Consulting services", "English", "Daily", "Free Registration", "Yes", "HTML, XML", "High (500-2000)"),

    # Inter-American Development Bank
    create_entry("INT-MDB-0009", "IDB Procurement", "https://www.iadb.org/en/procurement", "INT", "International", "International-MDB", "MDB", "Inter-American Development Bank", "All sectors - Latin America focus", "English, Spanish, Portuguese, French", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)"),
    create_entry("INT-MDB-0010", "IDB Invest", "https://www.idbinvest.org/en/procurement", "INT", "International", "International-MDB", "MDB", "Inter-American Development Bank", "Private sector", "English, Spanish", "Weekly", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),

    # European Investment Bank / EBRD
    create_entry("INT-MDB-0011", "European Bank for Reconstruction and Development", "https://www.ebrd.com/work-with-us/procurement.html", "INT", "International", "International-MDB", "MDB", "EBRD", "All sectors - Eastern Europe, Central Asia focus", "English", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("INT-MDB-0012", "EBRD Client e-Procurement Portal (ECEPP)", "https://ecepp.ebrd.com", "INT", "International", "International-MDB", "MDB", "EBRD", "All sectors", "English", "Daily", "Free Registration", "Yes", "HTML, XML", "High (500-2000)"),
    create_entry("INT-MDB-0013", "European Investment Bank Procurement", "https://www.eib.org/en/about/procurement", "INT", "International", "International-MDB", "MDB", "European Investment Bank", "All sectors - EU focus", "English, French, German", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # Islamic Development Bank
    create_entry("INT-MDB-0014", "Islamic Development Bank Procurement", "https://www.isdb.org/procurement", "INT", "International", "International-MDB", "MDB", "Islamic Development Bank", "All sectors - OIC countries", "English, Arabic, French", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),

    # New Development Bank (BRICS)
    create_entry("INT-MDB-0015", "New Development Bank Procurement", "https://www.ndb.int/procurement", "INT", "International", "International-MDB", "MDB", "New Development Bank", "All sectors - BRICS focus", "English", "Weekly", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),

    # Asian Infrastructure Investment Bank
    create_entry("INT-MDB-0016", "AIIB Procurement", "https://www.aiib.org/en/opportunities/business/procurement-services.html", "INT", "International", "International-MDB", "MDB", "Asian Infrastructure Investment Bank", "Infrastructure - Asia focus", "English", "Weekly", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),

    # Other Regional Development Banks
    create_entry("INT-MDB-0017", "Caribbean Development Bank", "https://www.caribank.org/work-with-us/procurement", "INT", "International", "International-MDB", "MDB", "Caribbean Development Bank", "All sectors - Caribbean focus", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("INT-MDB-0018", "Central American Bank for Economic Integration", "https://www.bcie.org/en/about-us/procurement", "INT", "International", "International-MDB", "MDB", "CABEI", "All sectors - Central America focus", "English, Spanish", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-MDB-0019", "Development Bank of Latin America (CAF)", "https://www.caf.com/en/currently/procurement", "INT", "International", "International-MDB", "MDB", "CAF", "All sectors - Latin America focus", "English, Spanish", "Weekly", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-MDB-0020", "West African Development Bank (BOAD)", "https://www.bfrfoad.org/en/procurement", "INT", "International", "International-MDB", "MDB", "BOAD", "All sectors - West Africa focus", "French, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-MDB-0021", "East African Development Bank", "https://www.eadb.org/procurement", "INT", "International", "International-MDB", "MDB", "EADB", "All sectors - East Africa focus", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("INT-MDB-0022", "Trade and Development Bank (PTA Bank)", "https://www.tfrfdbgroup.com/procurement", "INT", "International", "International-MDB", "MDB", "TDB", "Trade finance - Africa focus", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # UN AGENCIES
    create_entry("INT-UN-0001", "UN Global Marketplace (UNGM)", "https://www.ungm.org", "INT", "International", "International-UN", "UN Agency", "UN Procurement Portal", "All sectors", "English, French, Spanish", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Central UN procurement portal"),
    create_entry("INT-UN-0002", "UNDP Procurement Notices", "https://www.undp.org/procurement", "INT", "International", "International-UN", "UN Agency", "UNDP", "Development, Governance, Environment", "English", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("INT-UN-0003", "UNICEF Supply Division", "https://www.unicef.org/supply/procurement", "INT", "International", "International-UN", "UN Agency", "UNICEF", "Health, Education, Children", "English", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Major medical supplies procurement"),
    create_entry("INT-UN-0004", "UNOPS Procurement", "https://www.unops.org/opportunities", "INT", "International", "International-UN", "UN Agency", "UNOPS", "Infrastructure, Project services", "English", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)"),
    create_entry("INT-UN-0005", "WHO Procurement", "https://www.who.int/about/accountability/procurement", "INT", "International", "International-UN", "UN Agency", "WHO", "Health, Medical, Pharmaceuticals", "English, French", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("INT-UN-0006", "WFP Procurement", "https://www.wfp.org/procurement", "INT", "International", "International-UN", "UN Agency", "WFP", "Food, Logistics, Humanitarian", "English", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)", "Major food procurement"),
    create_entry("INT-UN-0007", "FAO Procurement", "https://www.fao.org/procurement", "INT", "International", "International-UN", "UN Agency", "FAO", "Agriculture, Food security", "English, French, Spanish", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("INT-UN-0008", "UNESCO Procurement", "https://en.unesco.org/procurement", "INT", "International", "International-UN", "UN Agency", "UNESCO", "Education, Culture, Science", "English, French", "Weekly", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-UN-0009", "UNHCR Procurement", "https://www.unhcr.org/what-we-do/build-better-futures/procurement", "INT", "International", "International-UN", "UN Agency", "UNHCR", "Humanitarian, Refugees", "English, French", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("INT-UN-0010", "IOM Procurement", "https://www.iom.int/procurement", "INT", "International", "International-UN", "UN Agency", "IOM", "Migration, Humanitarian", "English", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("INT-UN-0011", "UNFPA Procurement", "https://www.unfpa.org/procurement", "INT", "International", "International-UN", "UN Agency", "UNFPA", "Health, Population", "English", "Weekly", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-UN-0012", "UN Secretariat Procurement Division", "https://www.un.org/Depts/ptd/procurement", "INT", "International", "International-UN", "UN Agency", "UN Secretariat", "All sectors", "English, French", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("INT-UN-0013", "ILO Procurement", "https://www.ilo.org/global/about-the-ilo/procurement", "INT", "International", "International-UN", "UN Agency", "ILO", "Labour, Social protection", "English, French", "Weekly", "Free Registration", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("INT-UN-0014", "IAEA Procurement", "https://www.iaea.org/about/procurement", "INT", "International", "International-UN", "UN Agency", "IAEA", "Nuclear, Scientific equipment", "English", "Weekly", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-UN-0015", "UN-Habitat Procurement", "https://unhabitat.org/about-us/procurement", "INT", "International", "International-UN", "UN Agency", "UN-Habitat", "Urban development, Housing", "English", "Weekly", "Free Registration", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("INT-UN-0016", "UNODC Procurement", "https://www.unodc.org/unodc/en/about-unodc/procurement.html", "INT", "International", "International-UN", "UN Agency", "UNODC", "Drugs, Crime prevention", "English", "Weekly", "Free Registration", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("INT-UN-0017", "UNEP Procurement", "https://www.unep.org/about-un-environment/procurement", "INT", "International", "International-UN", "UN Agency", "UNEP", "Environment", "English", "Weekly", "Free Registration", "No", "HTML, PDF", "Low (20-100)"),

    # BILATERAL DEVELOPMENT AGENCIES
    create_entry("INT-BIL-0001", "USAID SAM.gov", "https://sam.gov", "USA", "United States", "International-Bilateral", "Bilateral Agency", "USAID/US Government", "All sectors", "English", "Daily", "Free Registration", "Yes", "HTML, XML, API", "Very High (>2000)", "US federal procurement"),
    create_entry("INT-BIL-0002", "USAID Business Forecast", "https://www.usaid.gov/work-usaid/get-grant-or-contract/opportunities-background/business-forecast", "USA", "United States", "International-Bilateral", "Bilateral Agency", "USAID", "Development", "English", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("INT-BIL-0003", "MCC (Millennium Challenge Corporation)", "https://www.mcc.gov/work-with-us/contracts", "USA", "United States", "International-Bilateral", "Bilateral Agency", "MCC", "Development - poverty reduction", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("INT-BIL-0004", "DFC (US Development Finance)", "https://www.dfc.gov/procurement", "USA", "United States", "International-Bilateral", "DFI", "DFC", "Private sector development", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-BIL-0005", "GIZ Procurement", "https://www.giz.de/en/workingwithgiz/procurement.html", "DEU", "Germany", "International-Bilateral", "Bilateral Agency", "GIZ", "Technical cooperation", "English, German", "Weekly", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("INT-BIL-0006", "KfW Development Bank", "https://www.kfw-entwicklungsbank.de/International-financing/KfW-Development-Bank/About-us/Jobs-and-tenders/Consultant-Services/", "DEU", "Germany", "International-Bilateral", "DFI", "KfW", "Development finance", "English, German", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("INT-BIL-0007", "AFD (Agence Francaise de Developpement)", "https://www.afd.fr/en/page-thematique-axe/calls-tenders-and-contracts", "FRA", "France", "International-Bilateral", "DFI", "AFD", "Development finance", "English, French", "Weekly", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("INT-BIL-0008", "JICA Procurement", "https://www.jica.go.jp/english/our_work/types_of_assistance/oda_loans/procurement/", "JPN", "Japan", "International-Bilateral", "Bilateral Agency", "JICA", "Technical cooperation", "English, Japanese", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("INT-BIL-0009", "UK FCDO Contracts Finder", "https://www.contractsfinder.service.gov.uk", "GBR", "United Kingdom", "International-Bilateral", "Bilateral Agency", "FCDO/UK Government", "All sectors", "English", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)"),
    create_entry("INT-BIL-0010", "SIDA Procurement", "https://www.sida.se/en/for-partners/procurement", "SWE", "Sweden", "International-Bilateral", "Bilateral Agency", "SIDA", "Development", "English, Swedish", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-BIL-0011", "NORAD Procurement", "https://www.norad.no/en/front/procurement/", "NOR", "Norway", "International-Bilateral", "Bilateral Agency", "NORAD", "Development", "English, Norwegian", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-BIL-0012", "DANIDA Procurement", "https://um.dk/en/danida-en/procurement", "DNK", "Denmark", "International-Bilateral", "Bilateral Agency", "DANIDA", "Development", "English, Danish", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-BIL-0013", "Global Affairs Canada", "https://www.international.gc.ca/world-monde/funding-financement/procurement-passation_marches.aspx", "CAN", "Canada", "International-Bilateral", "Bilateral Agency", "Global Affairs Canada", "Development", "English, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-BIL-0014", "DFAT Australia", "https://www.dfat.gov.au/about-us/publications/procurement", "AUS", "Australia", "International-Bilateral", "Bilateral Agency", "DFAT", "Development", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-BIL-0015", "Swiss SDC Procurement", "https://www.eda.admin.ch/deza/en/home/partnerships/procurement.html", "CHE", "Switzerland", "International-Bilateral", "Bilateral Agency", "SDC", "Development", "English, French, German", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-BIL-0016", "Enabel (Belgian Development)", "https://www.enabel.be/procurement", "BEL", "Belgium", "International-Bilateral", "Bilateral Agency", "Enabel", "Development", "English, French, Dutch", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("INT-BIL-0017", "KOICA Procurement", "https://www.koica.go.kr/koica_en/3433/subview.do", "KOR", "South Korea", "International-Bilateral", "Bilateral Agency", "KOICA", "Development", "English, Korean", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # REGIONAL ECONOMIC COMMUNITIES
    create_entry("INT-REG-0001", "African Union Commission Procurement", "https://au.int/en/about/procurement", "INT", "International", "International-Regional", "Regional Economic Community", "African Union", "All sectors - Africa", "English, French, Arabic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-REG-0002", "ECOWAS Procurement", "https://www.ecowas.int/doing-business-in-ecowas/procurement/", "INT", "International", "International-Regional", "Regional Economic Community", "ECOWAS", "All sectors - West Africa", "English, French, Portuguese", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("INT-REG-0003", "SADC Procurement", "https://www.sadc.int/opportunities/tenders", "INT", "International", "International-Regional", "Regional Economic Community", "SADC", "All sectors - Southern Africa", "English, French, Portuguese", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("INT-REG-0004", "EAC Procurement", "https://www.eac.int/procurement", "INT", "International", "International-Regional", "Regional Economic Community", "EAC", "All sectors - East Africa", "English, Swahili", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("INT-REG-0005", "COMESA Procurement", "https://www.comesa.int/procurement/", "INT", "International", "International-Regional", "Regional Economic Community", "COMESA", "Trade - East/Southern Africa", "English, French", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("INT-REG-0006", "CARICOM Procurement", "https://caricom.org/category/procurement/", "INT", "International", "International-Regional", "Regional Economic Community", "CARICOM", "All sectors - Caribbean", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("INT-REG-0007", "ASEAN Secretariat", "https://asean.org/category/procurement/", "INT", "International", "International-Regional", "Regional Economic Community", "ASEAN", "All sectors - Southeast Asia", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("INT-REG-0008", "Pacific Community (SPC)", "https://www.spc.int/procurement", "INT", "International", "International-Regional", "Regional Economic Community", "SPC", "All sectors - Pacific", "English, French", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("INT-REG-0009", "SAARC Secretariat", "https://www.saarc-sec.org/index.php/area-of-cooperation/procurement", "INT", "International", "International-Regional", "Regional Economic Community", "SAARC", "All sectors - South Asia", "English", "Monthly", "No", "No", "HTML, PDF", "Very Low (<20)"),
    create_entry("INT-REG-0010", "Arab League Procurement", "https://www.lasportal.org/en/sectors/procurement", "INT", "International", "International-Regional", "Regional Economic Community", "Arab League", "All sectors - Arab states", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # HUMANITARIAN ORGANIZATIONS
    create_entry("INT-HUM-0001", "ICRC Procurement", "https://www.icrc.org/en/procurement", "INT", "International", "International-Bilateral", "Humanitarian Organization", "ICRC", "Humanitarian, Medical", "English, French", "Weekly", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-HUM-0002", "IFRC Procurement", "https://www.ifrc.org/procurement", "INT", "International", "International-Bilateral", "Humanitarian Organization", "IFRC", "Humanitarian, Disaster relief", "English", "Weekly", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("INT-HUM-0003", "Global Fund to Fight AIDS, TB and Malaria", "https://www.theglobalfund.org/en/sourcing-management/procurement-and-supply-chain/", "INT", "International", "International-Bilateral", "Humanitarian Organization", "Global Fund", "Health, Medical supplies", "English", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("INT-HUM-0004", "Gavi, the Vaccine Alliance", "https://www.gavi.org/operating-model/gavis-partnership-model/procurement", "INT", "International", "International-Bilateral", "Humanitarian Organization", "Gavi", "Vaccines, Health", "English", "Weekly", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
]

if __name__ == "__main__":
    print(f"International Institutions entries: {len(international)}")
    with open("/sessions/peaceful-zen-gauss/tender_db/international_institutions.json", "w") as f:
        json.dump(international, f, indent=2)
    print("Saved international_institutions.json")
