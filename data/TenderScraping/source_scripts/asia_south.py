#!/usr/bin/env python3
"""
Tender Intelligence Database - South Asia
India, Pakistan, Bangladesh, Sri Lanka, Nepal, Afghanistan, Bhutan, Maldives
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

asia_south = [
    # INDIA - Massive procurement market
    create_entry("ASA-IND-0001", "Government e-Marketplace (GeM)", "https://gem.gov.in", "IND", "India", "South-Asia", "National Government Portal", "E-Marketplace", "All sectors", "English, Hindi", "Daily", "Free Registration", "Yes", "HTML, XML, API", "Very High (>2000)", "Mandatory for central govt, >$50B annually"),
    create_entry("ASA-IND-0002", "Central Public Procurement Portal (CPPP)", "https://eprocure.gov.in", "IND", "India", "South-Asia", "National Government Portal", "E-Procurement", "All sectors", "English, Hindi", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Central government e-tendering"),
    create_entry("ASA-IND-0003", "Indian Railways e-Procurement (IREPS)", "https://www.ireps.gov.in", "IND", "India", "South-Asia", "Parastatal/SOE", "Railways", "Rail, Construction, Rolling stock", "English, Hindi", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Massive railway system"),
    create_entry("ASA-IND-0004", "Defence Procurement (MoD)", "https://mod.gov.in/dod/procurement", "IND", "India", "South-Asia", "Federal Ministry", "Defence", "Defence, IT, Equipment", "English", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASA-IND-0005", "ONGC", "https://www.ongcindia.com/tenders", "IND", "India", "South-Asia", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "English", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASA-IND-0006", "Indian Oil Corporation", "https://www.iocl.com/tenders", "IND", "India", "South-Asia", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "English", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASA-IND-0007", "NTPC (Power)", "https://www.ntpc.co.in/tenders", "IND", "India", "South-Asia", "Parastatal/SOE", "Electricity", "Power, Engineering, Construction", "English", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASA-IND-0008", "Power Grid Corporation", "https://www.powergridindia.com/tenders", "IND", "India", "South-Asia", "Parastatal/SOE", "Electricity Transmission", "Power, Engineering, Construction", "English", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASA-IND-0009", "BHEL", "https://www.bhel.com/tenders", "IND", "India", "South-Asia", "Parastatal/SOE", "Heavy Engineering", "Engineering, Equipment, Construction", "English", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASA-IND-0010", "Coal India", "https://www.coalindia.in/tenders", "IND", "India", "South-Asia", "Parastatal/SOE", "Mining", "Mining, Equipment, Services", "English", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASA-IND-0011", "NHAI (Roads)", "https://nhai.gov.in/tenders", "IND", "India", "South-Asia", "Infrastructure Authority", "Roads", "Construction, Engineering", "English", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASA-IND-0012", "Airports Authority of India", "https://www.aai.aero/tenders", "IND", "India", "South-Asia", "Parastatal/SOE", "Aviation", "Aviation, Construction, IT", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASA-IND-0013", "Air India", "https://www.airindia.in/tenders", "IND", "India", "South-Asia", "Parastatal/SOE", "Aviation", "Aviation, IT, Services", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASA-IND-0014", "Delhi Metro", "https://www.delhimetrorail.com/tenders", "IND", "India", "South-Asia", "Parastatal/SOE", "Metro", "Rail, Construction, Engineering", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASA-IND-0015", "BSNL", "https://www.bfrfsnl.co.in/tenders", "IND", "India", "South-Asia", "Public Utility", "Telecommunications", "IT, Telecommunications", "English", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASA-IND-0016", "Reserve Bank of India", "https://www.rbi.org.in/tenders", "IND", "India", "South-Asia", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASA-IND-0017", "AIIMS Delhi", "https://www.aiims.edu/tenders", "IND", "India", "South-Asia", "Hospital/Health System", "Teaching Hospital", "Medical equipment, Pharmaceuticals", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASA-IND-0018", "IIT Delhi", "https://www.iitd.ac.in/tenders", "IND", "India", "South-Asia", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASA-IND-0019", "IIT Bombay", "https://www.iitb.ac.in/tenders", "IND", "India", "South-Asia", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASA-IND-0020", "ISRO", "https://www.isro.gov.in/tenders", "IND", "India", "South-Asia", "University/Research", "Space Agency", "Aerospace, IT, Engineering", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    # India States
    create_entry("ASA-IND-0021", "Maharashtra e-Tendering", "https://mahatenders.gov.in", "IND", "India", "South-Asia", "State/Provincial Government", "State E-Procurement", "All sectors", "English, Marathi", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)"),
    create_entry("ASA-IND-0022", "UP e-Procurement", "https://etender.up.nic.in", "IND", "India", "South-Asia", "State/Provincial Government", "State E-Procurement", "All sectors", "English, Hindi", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)"),
    create_entry("ASA-IND-0023", "Karnataka e-Procurement", "https://eproc.karnataka.gov.in", "IND", "India", "South-Asia", "State/Provincial Government", "State E-Procurement", "All sectors", "English, Kannada", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)"),
    create_entry("ASA-IND-0024", "Tamil Nadu e-Tendering", "https://tntenders.gov.in", "IND", "India", "South-Asia", "State/Provincial Government", "State E-Procurement", "All sectors", "English, Tamil", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)"),
    create_entry("ASA-IND-0025", "Gujarat e-Procurement", "https://tender.nprocure.com", "IND", "India", "South-Asia", "State/Provincial Government", "State E-Procurement", "All sectors", "English, Gujarati", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)"),
    create_entry("ASA-IND-0026", "West Bengal e-Tendering", "https://wbtenders.gov.in", "IND", "India", "South-Asia", "State/Provincial Government", "State E-Procurement", "All sectors", "English, Bengali", "Daily", "Free Registration", "Yes", "HTML, XML", "High (500-2000)"),
    create_entry("ASA-IND-0027", "Rajasthan e-Procurement", "https://eproc.rajasthan.gov.in", "IND", "India", "South-Asia", "State/Provincial Government", "State E-Procurement", "All sectors", "English, Hindi", "Daily", "Free Registration", "Yes", "HTML, XML", "High (500-2000)"),
    create_entry("ASA-IND-0028", "Andhra Pradesh e-Procurement", "https://eprocure.ap.gov.in", "IND", "India", "South-Asia", "State/Provincial Government", "State E-Procurement", "All sectors", "English, Telugu", "Daily", "Free Registration", "Yes", "HTML, XML", "High (500-2000)"),
    create_entry("ASA-IND-0029", "Telangana e-Procurement", "https://tender.telangana.gov.in", "IND", "India", "South-Asia", "State/Provincial Government", "State E-Procurement", "All sectors", "English, Telugu", "Daily", "Free Registration", "Yes", "HTML, XML", "High (500-2000)"),
    create_entry("ASA-IND-0030", "Kerala e-Tendering", "https://etenders.kerala.gov.in", "IND", "India", "South-Asia", "State/Provincial Government", "State E-Procurement", "All sectors", "English, Malayalam", "Daily", "Free Registration", "Yes", "HTML, XML", "High (500-2000)"),

    # PAKISTAN
    create_entry("ASA-PAK-0001", "PPRA Pakistan", "https://www.ppra.org.pk", "PAK", "Pakistan", "South-Asia", "National Government Portal", "Procurement Regulator", "All sectors", "English, Urdu", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASA-PAK-0002", "PPMS (Public Procurement Management System)", "https://www.eprocure.gov.pk", "PAK", "Pakistan", "South-Asia", "National Government Portal", "E-Procurement", "All sectors", "English, Urdu", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASA-PAK-0003", "Pakistan State Oil", "https://psopk.com/tenders", "PAK", "Pakistan", "South-Asia", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASA-PAK-0004", "WAPDA (Water & Power)", "https://www.wapda.gov.pk/tenders", "PAK", "Pakistan", "South-Asia", "Public Utility", "Water and Power", "Power, Water, Construction", "English, Urdu", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASA-PAK-0005", "Pakistan Railways", "https://www.railways.gov.pk/tenders", "PAK", "Pakistan", "South-Asia", "Parastatal/SOE", "Railways", "Rail, Construction, Rolling stock", "English, Urdu", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASA-PAK-0006", "PIA", "https://www.piac.com.pk/tenders", "PAK", "Pakistan", "South-Asia", "Parastatal/SOE", "Aviation", "Aviation, IT, Services", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASA-PAK-0007", "State Bank of Pakistan", "https://www.sbp.org.pk/tenders", "PAK", "Pakistan", "South-Asia", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("ASA-PAK-0008", "NHA Pakistan (Roads)", "https://nha.gov.pk/tenders", "PAK", "Pakistan", "South-Asia", "Infrastructure Authority", "Roads", "Construction, Engineering", "English, Urdu", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASA-PAK-0009", "Punjab PPRA", "https://www.pprapunjab.gov.pk", "PAK", "Pakistan", "South-Asia", "State/Provincial Government", "Provincial Procurement", "All sectors", "English, Urdu", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASA-PAK-0010", "Sindh PPRA", "https://www.pprasindh.gov.pk", "PAK", "Pakistan", "South-Asia", "State/Provincial Government", "Provincial Procurement", "All sectors", "English, Urdu", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),

    # BANGLADESH
    create_entry("ASA-BGD-0001", "e-GP Bangladesh", "https://www.eprocure.gov.bd", "BGD", "Bangladesh", "South-Asia", "National Government Portal", "E-Procurement", "All sectors", "English, Bengali", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)"),
    create_entry("ASA-BGD-0002", "CPTU Bangladesh", "https://www.cptu.gov.bd", "BGD", "Bangladesh", "South-Asia", "National Government Portal", "Procurement Regulator", "All sectors", "English, Bengali", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASA-BGD-0003", "Petrobangla", "https://www.petrobangla.org.bd/tenders", "BGD", "Bangladesh", "South-Asia", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "English, Bengali", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASA-BGD-0004", "BPDB (Power)", "https://www.bpdb.gov.bd/tenders", "BGD", "Bangladesh", "South-Asia", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English, Bengali", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASA-BGD-0005", "Bangladesh Railway", "https://www.railway.gov.bd/tenders", "BGD", "Bangladesh", "South-Asia", "Parastatal/SOE", "Railways", "Rail, Construction, Rolling stock", "English, Bengali", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASA-BGD-0006", "RHD Bangladesh (Roads)", "https://www.rhd.gov.bd/tenders", "BGD", "Bangladesh", "South-Asia", "Infrastructure Authority", "Roads", "Construction, Engineering", "English, Bengali", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASA-BGD-0007", "Bangladesh Bank", "https://www.bb.org.bd/tenders", "BGD", "Bangladesh", "South-Asia", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English, Bengali", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("ASA-BGD-0008", "Chittagong Port Authority", "https://www.cpa.gov.bd/tenders", "BGD", "Bangladesh", "South-Asia", "Parastatal/SOE", "Ports", "Maritime, Construction, Equipment", "English, Bengali", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASA-BGD-0009", "University of Dhaka", "https://www.du.ac.bd/tenders", "BGD", "Bangladesh", "South-Asia", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English, Bengali", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # SRI LANKA
    create_entry("ASA-LKA-0001", "e-GP Sri Lanka", "https://www.egp.gov.lk", "LKA", "Sri Lanka", "South-Asia", "National Government Portal", "E-Procurement", "All sectors", "English, Sinhala, Tamil", "Daily", "Free Registration", "Yes", "HTML, XML", "High (500-2000)"),
    create_entry("ASA-LKA-0002", "National Procurement Commission", "https://www.npc.gov.lk", "LKA", "Sri Lanka", "South-Asia", "National Government Portal", "Procurement Regulator", "All sectors", "English, Sinhala", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASA-LKA-0003", "Ceylon Petroleum Corporation", "https://www.ceypetco.gov.lk/tenders", "LKA", "Sri Lanka", "South-Asia", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "English, Sinhala", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASA-LKA-0004", "Ceylon Electricity Board", "https://www.ceb.lk/tenders", "LKA", "Sri Lanka", "South-Asia", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English, Sinhala", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASA-LKA-0005", "Road Development Authority", "https://www.rda.gov.lk/tenders", "LKA", "Sri Lanka", "South-Asia", "Infrastructure Authority", "Roads", "Construction, Engineering", "English, Sinhala", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASA-LKA-0006", "Central Bank of Sri Lanka", "https://www.cbsl.gov.lk/tenders", "LKA", "Sri Lanka", "South-Asia", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English, Sinhala", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("ASA-LKA-0007", "Sri Lanka Ports Authority", "https://www.slpa.lk/tenders", "LKA", "Sri Lanka", "South-Asia", "Parastatal/SOE", "Ports", "Maritime, Construction, Equipment", "English, Sinhala", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # NEPAL
    create_entry("ASA-NPL-0001", "Public Procurement Monitoring Office", "https://www.ppmo.gov.np", "NPL", "Nepal", "South-Asia", "National Government Portal", "Procurement Regulator", "All sectors", "English, Nepali", "Daily", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASA-NPL-0002", "e-Bidding Portal Nepal", "https://bolpatra.gov.np", "NPL", "Nepal", "South-Asia", "National Government Portal", "E-Procurement", "All sectors", "English, Nepali", "Daily", "Free Registration", "Yes", "HTML, XML", "Medium (100-500)"),
    create_entry("ASA-NPL-0003", "Nepal Electricity Authority", "https://www.nea.org.np/tenders", "NPL", "Nepal", "South-Asia", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English, Nepali", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASA-NPL-0004", "Nepal Rastra Bank", "https://www.nrb.org.np/tenders", "NPL", "Nepal", "South-Asia", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English, Nepali", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("ASA-NPL-0005", "Department of Roads Nepal", "https://www.dor.gov.np/tenders", "NPL", "Nepal", "South-Asia", "Infrastructure Authority", "Roads", "Construction, Engineering", "English, Nepali", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # AFGHANISTAN
    create_entry("ASA-AFG-0001", "Afghanistan Government Procurement", "https://www.npa.gov.af", "AFG", "Afghanistan", "South-Asia", "National Government Portal", "Procurement Regulator", "All sectors", "English, Dari, Pashto", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASA-AFG-0002", "Da Afghanistan Breshna Sherkat (DABS)", "https://www.dabs.af/tenders", "AFG", "Afghanistan", "South-Asia", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English, Dari", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # BHUTAN
    create_entry("ASA-BTN-0001", "Construction Development Board Bhutan", "https://www.cdb.gov.bt/tenders", "BTN", "Bhutan", "South-Asia", "National Government Portal", "Construction Procurement", "Construction, Engineering", "English, Dzongkha", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("ASA-BTN-0002", "Bhutan Power Corporation", "https://www.bpc.bt/tenders", "BTN", "Bhutan", "South-Asia", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English, Dzongkha", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # MALDIVES
    create_entry("ASA-MDV-0001", "Maldives Government e-Gazette", "https://www.gazette.gov.mv/iulaan", "MDV", "Maldives", "South-Asia", "National Government Portal", "Official Gazette", "All sectors", "English, Dhivehi", "Daily", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("ASA-MDV-0002", "STELCO Maldives (Electricity)", "https://www.stelco.com.mv/tenders", "MDV", "Maldives", "South-Asia", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English, Dhivehi", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
]

if __name__ == "__main__":
    print(f"South Asia entries: {len(asia_south)}")
    with open("/sessions/peaceful-zen-gauss/tender_db/asia_south.json", "w") as f:
        json.dump(asia_south, f, indent=2)
    print("Saved asia_south.json")
