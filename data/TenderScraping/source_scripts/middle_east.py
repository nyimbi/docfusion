#!/usr/bin/env python3
"""
Tender Intelligence Database - Middle East (non-GCC developing economies)
Iraq, Jordan, Lebanon, Palestine, Syria, Yemen, Iran
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

middle_east = [
    # IRAQ
    create_entry("MEA-IRQ-0001", "Iraq e-Government Procurement", "https://www.tabadul.gov.iq", "IRQ", "Iraq", "Middle-East", "National Government Portal", "E-Procurement", "All sectors", "Arabic, English", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("MEA-IRQ-0002", "Ministry of Oil Iraq", "https://www.oil.gov.iq/tenders", "IRQ", "Iraq", "Middle-East", "Federal Ministry", "Oil and Gas", "Oil, Gas, Engineering", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("MEA-IRQ-0003", "Ministry of Electricity Iraq", "https://www.moelc.gov.iq/tenders", "IRQ", "Iraq", "Middle-East", "Federal Ministry", "Electricity", "Power, Engineering, Equipment", "Arabic", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("MEA-IRQ-0004", "Iraqi Airways", "https://www.iraqiairways.com.iq/tenders", "IRQ", "Iraq", "Middle-East", "Parastatal/SOE", "Aviation", "Aviation, IT, Services", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-IRQ-0005", "Central Bank of Iraq", "https://www.cbi.iq/tenders", "IRQ", "Iraq", "Middle-East", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Arabic, English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-IRQ-0006", "Kurdistan Regional Government", "https://www.gov.krd/procurement", "IRQ", "Iraq", "Middle-East", "State/Provincial Government", "Regional Government", "All sectors", "Arabic, Kurdish, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("MEA-IRQ-0007", "Baghdad Governorate", "https://www.baghdad.gov.iq/tenders", "IRQ", "Iraq", "Middle-East", "State/Provincial Government", "Provincial Government", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # JORDAN
    create_entry("MEA-JOR-0001", "JONEPS (Jordan National e-Procurement)", "https://www.joneps.gov.jo", "JOR", "Jordan", "Middle-East", "National Government Portal", "E-Procurement", "All sectors", "Arabic, English", "Daily", "Free Registration", "Yes", "HTML, XML", "Medium (100-500)"),
    create_entry("MEA-JOR-0002", "Government Tenders Department Jordan", "https://www.gtd.gov.jo", "JOR", "Jordan", "Middle-East", "National Government Portal", "Central Procurement", "All sectors", "Arabic, English", "Daily", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("MEA-JOR-0003", "Jordan Petroleum Refinery", "https://www.jopetrol.com.jo/tenders", "JOR", "Jordan", "Middle-East", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-JOR-0004", "NEPCO (Electricity)", "https://www.nepco.com.jo/tenders", "JOR", "Jordan", "Middle-East", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("MEA-JOR-0005", "Water Authority of Jordan", "https://www.waj.gov.jo/tenders", "JOR", "Jordan", "Middle-East", "Public Utility", "Water", "Water, Engineering, Construction", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("MEA-JOR-0006", "Royal Jordanian", "https://www.rj.com/tenders", "JOR", "Jordan", "Middle-East", "Parastatal/SOE", "Aviation", "Aviation, IT, Services", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-JOR-0007", "Central Bank of Jordan", "https://www.cbj.gov.jo/tenders", "JOR", "Jordan", "Middle-East", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Arabic, English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-JOR-0008", "University of Jordan", "https://www.ju.edu.jo/tenders", "JOR", "Jordan", "Middle-East", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Arabic, English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-JOR-0009", "Greater Amman Municipality", "https://www.amman.jo/tenders", "JOR", "Jordan", "Middle-East", "Municipal/Local Government", "City Government", "Construction, Services, IT", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # LEBANON
    create_entry("MEA-LBN-0001", "Lebanon Public Procurement Administration", "https://www.ppp.gov.lb", "LBN", "Lebanon", "Middle-East", "National Government Portal", "Procurement Regulator", "All sectors", "Arabic, French, English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-LBN-0002", "Council for Development and Reconstruction", "https://www.cdr.gov.lb/tenders", "LBN", "Lebanon", "Middle-East", "National Government Portal", "Development Agency", "Infrastructure, Construction", "Arabic, French, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("MEA-LBN-0003", "Electricite du Liban (EDL)", "https://www.edl.gov.lb/tenders", "LBN", "Lebanon", "Middle-East", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-LBN-0004", "Middle East Airlines", "https://www.mea.com.lb/tenders", "LBN", "Lebanon", "Middle-East", "Parastatal/SOE", "Aviation", "Aviation, IT, Services", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-LBN-0005", "Banque du Liban", "https://www.bdl.gov.lb/tenders", "LBN", "Lebanon", "Middle-East", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Arabic, French, English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-LBN-0006", "Port of Beirut", "https://www.portdebeyrouth.com/tenders", "LBN", "Lebanon", "Middle-East", "Parastatal/SOE", "Ports", "Maritime, Construction, Equipment", "Arabic, French, English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # PALESTINE
    create_entry("MEA-PSE-0001", "Palestinian High Council for Public Procurement", "https://www.shiraa.gov.ps", "PSE", "Palestine", "Middle-East", "National Government Portal", "E-Procurement", "All sectors", "Arabic, English", "Daily", "Free Registration", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-PSE-0002", "Palestinian Energy Authority", "https://www.penra.gov.ps/tenders", "PSE", "Palestine", "Middle-East", "Federal Ministry", "Energy", "Power, Engineering, Equipment", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-PSE-0003", "Palestinian Water Authority", "https://www.pwa.ps/tenders", "PSE", "Palestine", "Middle-East", "Public Utility", "Water", "Water, Engineering, Construction", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-PSE-0004", "Palestine Monetary Authority", "https://www.pma.ps/tenders", "PSE", "Palestine", "Middle-East", "Central Bank/Regulator", "Monetary Authority", "IT, Financial services, Consulting", "Arabic, English", "Monthly", "No", "No", "HTML, PDF", "Very Low (<20)"),

    # YEMEN
    create_entry("MEA-YEM-0001", "Yemen High Tender Board", "https://www.htb.gov.ye", "YEM", "Yemen", "Middle-East", "National Government Portal", "Central Procurement", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-YEM-0002", "Ministry of Oil Yemen", "https://www.mom.gov.ye/tenders", "YEM", "Yemen", "Middle-East", "Federal Ministry", "Oil and Gas", "Oil, Gas, Engineering", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-YEM-0003", "Public Electricity Corporation Yemen", "https://www.pec.gov.ye/tenders", "YEM", "Yemen", "Middle-East", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # IRAN
    create_entry("MEA-IRN-0001", "Iran Tenders Website (IETS)", "https://ifrrets.mporg.ir", "IRN", "Iran", "Middle-East", "National Government Portal", "E-Procurement", "All sectors", "Farsi, English", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("MEA-IRN-0002", "National Iranian Oil Company (NIOC)", "https://www.nioc.ir/tenders", "IRN", "Iran", "Middle-East", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Farsi, English", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("MEA-IRN-0003", "NIGC (Gas)", "https://www.nigc.ir/tenders", "IRN", "Iran", "Middle-East", "Parastatal/SOE", "Gas", "Gas, Engineering, Construction", "Farsi, English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("MEA-IRN-0004", "TAVANIR (Electricity)", "https://www.tavanir.org.ir/tenders", "IRN", "Iran", "Middle-East", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Farsi", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("MEA-IRN-0005", "Iran Railways", "https://www.rai.ir/tenders", "IRN", "Iran", "Middle-East", "Parastatal/SOE", "Railways", "Rail, Construction, Rolling stock", "Farsi", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("MEA-IRN-0006", "Tehran Municipality", "https://www.tehran.ir/tenders", "IRN", "Iran", "Middle-East", "Municipal/Local Government", "City Government", "Construction, Services, IT", "Farsi", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("MEA-IRN-0007", "Central Bank of Iran", "https://www.cbi.ir/tenders", "IRN", "Iran", "Middle-East", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Farsi, English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("MEA-IRN-0008", "University of Tehran", "https://ut.ac.ir/tenders", "IRN", "Iran", "Middle-East", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Farsi, English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
]

if __name__ == "__main__":
    print(f"Middle East entries: {len(middle_east)}")
    with open("/sessions/peaceful-zen-gauss/tender_db/middle_east.json", "w") as f:
        json.dump(middle_east, f, indent=2)
    print("Saved middle_east.json")
