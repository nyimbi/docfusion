#!/usr/bin/env python3
"""
Tender Intelligence Database - Southeast Asia & Pacific
Indonesia, Philippines, Vietnam, Thailand, Malaysia, Myanmar, Cambodia, Laos
Papua New Guinea, Fiji, Pacific Islands
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

asia_southeast_pacific = [
    # INDONESIA
    create_entry("ASE-IDN-0001", "LPSE (Layanan Pengadaan Secara Elektronik)", "https://inaproc.id", "IDN", "Indonesia", "Southeast-Asia", "National Government Portal", "E-Procurement", "All sectors", "Indonesian, English", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Main e-procurement portal"),
    create_entry("ASE-IDN-0002", "LKPP (National Public Procurement Agency)", "https://www.lkpp.go.id", "IDN", "Indonesia", "Southeast-Asia", "National Government Portal", "Procurement Regulator", "All sectors", "Indonesian", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASE-IDN-0003", "Pertamina", "https://www.pertamina.com/procurement", "IDN", "Indonesia", "Southeast-Asia", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Indonesian, English", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASE-IDN-0004", "PLN (State Electricity)", "https://www.pln.co.id/procurement", "IDN", "Indonesia", "Southeast-Asia", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Indonesian", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASE-IDN-0005", "Telkom Indonesia", "https://www.telkom.co.id/procurement", "IDN", "Indonesia", "Southeast-Asia", "Public Utility", "Telecommunications", "IT, Telecommunications", "Indonesian", "Weekly", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASE-IDN-0006", "Garuda Indonesia", "https://www.garuda-indonesia.com/procurement", "IDN", "Indonesia", "Southeast-Asia", "Parastatal/SOE", "Aviation", "Aviation, IT, Services", "Indonesian, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASE-IDN-0007", "Pelindo (Ports)", "https://www.pelindo.co.id/procurement", "IDN", "Indonesia", "Southeast-Asia", "Parastatal/SOE", "Ports", "Maritime, Construction, Equipment", "Indonesian", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASE-IDN-0008", "Angkasa Pura (Airports)", "https://www.angkasapura.co.id/procurement", "IDN", "Indonesia", "Southeast-Asia", "Parastatal/SOE", "Aviation", "Aviation, Construction, IT", "Indonesian", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASE-IDN-0009", "Bank Indonesia", "https://www.bi.go.id/procurement", "IDN", "Indonesia", "Southeast-Asia", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Indonesian", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASE-IDN-0010", "Universitas Indonesia", "https://www.ui.ac.id/procurement", "IDN", "Indonesia", "Southeast-Asia", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Indonesian", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("ASE-IDN-0011", "DKI Jakarta Province", "https://lpse.jakarta.go.id", "IDN", "Indonesia", "Southeast-Asia", "State/Provincial Government", "Provincial E-Procurement", "All sectors", "Indonesian", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)"),
    create_entry("ASE-IDN-0012", "West Java Province", "https://lpse.jabarprov.go.id", "IDN", "Indonesia", "Southeast-Asia", "State/Provincial Government", "Provincial E-Procurement", "All sectors", "Indonesian", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)"),

    # PHILIPPINES
    create_entry("ASE-PHL-0001", "PhilGEPS", "https://www.philgeps.gov.ph", "PHL", "Philippines", "Southeast-Asia", "National Government Portal", "E-Procurement", "All sectors", "English, Filipino", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Main e-procurement portal"),
    create_entry("ASE-PHL-0002", "DBM Procurement Service", "https://www.ps-philgeps.gov.ph", "PHL", "Philippines", "Southeast-Asia", "National Government Portal", "Central Procurement", "All sectors", "English, Filipino", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASE-PHL-0003", "DPWH (Public Works)", "https://www.dpwh.gov.ph/dpwh/business/procurement", "PHL", "Philippines", "Southeast-Asia", "Federal Ministry", "Infrastructure", "Construction, Engineering", "English, Filipino", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASE-PHL-0004", "DOH Philippines (Health)", "https://www.doh.gov.ph/procurement", "PHL", "Philippines", "Southeast-Asia", "Federal Ministry", "Health", "Medical supplies, Pharmaceuticals", "English, Filipino", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASE-PHL-0005", "Philippine National Railways", "https://www.pnr.gov.ph/procurement", "PHL", "Philippines", "Southeast-Asia", "Parastatal/SOE", "Railways", "Rail, Construction, Rolling stock", "English, Filipino", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASE-PHL-0006", "MWSS (Metro Manila Water)", "https://www.mwss.gov.ph/procurement", "PHL", "Philippines", "Southeast-Asia", "Public Utility", "Water", "Water, Engineering, Construction", "English, Filipino", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASE-PHL-0007", "Bangko Sentral ng Pilipinas", "https://www.bsp.gov.ph/procurement", "PHL", "Philippines", "Southeast-Asia", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("ASE-PHL-0008", "University of the Philippines", "https://www.up.edu.ph/procurement", "PHL", "Philippines", "Southeast-Asia", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English, Filipino", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # VIETNAM
    create_entry("ASE-VNM-0001", "Vietnam National e-Procurement Network", "https://muasamcong.mpi.gov.vn", "VNM", "Vietnam", "Southeast-Asia", "National Government Portal", "E-Procurement", "All sectors", "Vietnamese, English", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)"),
    create_entry("ASE-VNM-0002", "Ministry of Planning and Investment", "https://www.mpi.gov.vn/procurement", "VNM", "Vietnam", "Southeast-Asia", "Federal Ministry", "Planning", "All sectors", "Vietnamese", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASE-VNM-0003", "PetroVietnam", "https://www.pvn.vn/procurement", "VNM", "Vietnam", "Southeast-Asia", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Vietnamese, English", "Weekly", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASE-VNM-0004", "EVN (Electricity of Vietnam)", "https://www.evn.com.vn/procurement", "VNM", "Vietnam", "Southeast-Asia", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Vietnamese", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASE-VNM-0005", "Vietnam Railways", "https://www.vr.com.vn/procurement", "VNM", "Vietnam", "Southeast-Asia", "Parastatal/SOE", "Railways", "Rail, Construction, Rolling stock", "Vietnamese", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASE-VNM-0006", "VNPT (Telecom)", "https://www.vnpt.com.vn/procurement", "VNM", "Vietnam", "Southeast-Asia", "Public Utility", "Telecommunications", "IT, Telecommunications", "Vietnamese", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASE-VNM-0007", "Vietnam Airlines", "https://www.vietnamairlines.com/procurement", "VNM", "Vietnam", "Southeast-Asia", "Parastatal/SOE", "Aviation", "Aviation, IT, Services", "Vietnamese, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASE-VNM-0008", "State Bank of Vietnam", "https://www.sbv.gov.vn/procurement", "VNM", "Vietnam", "Southeast-Asia", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Vietnamese", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # THAILAND
    create_entry("ASE-THA-0001", "Thai Government Procurement (e-GP)", "https://www.gprocurement.go.th", "THA", "Thailand", "Southeast-Asia", "National Government Portal", "E-Procurement", "All sectors", "Thai, English", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)"),
    create_entry("ASE-THA-0002", "Comptroller General's Department", "https://www.cgd.go.th/procurement", "THA", "Thailand", "Southeast-Asia", "National Government Portal", "Procurement Regulator", "All sectors", "Thai", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASE-THA-0003", "PTT (Petroleum Authority)", "https://www.pttplc.com/procurement", "THA", "Thailand", "Southeast-Asia", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Thai, English", "Weekly", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASE-THA-0004", "EGAT (Electricity)", "https://www.egat.co.th/procurement", "THA", "Thailand", "Southeast-Asia", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Thai", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASE-THA-0005", "State Railway of Thailand", "https://www.railway.co.th/procurement", "THA", "Thailand", "Southeast-Asia", "Parastatal/SOE", "Railways", "Rail, Construction, Rolling stock", "Thai", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASE-THA-0006", "AOT (Airports of Thailand)", "https://www.airportthai.co.th/procurement", "THA", "Thailand", "Southeast-Asia", "Parastatal/SOE", "Aviation", "Aviation, Construction, IT", "Thai, English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASE-THA-0007", "Bangkok Metropolitan Administration", "https://www.bangkok.go.th/procurement", "THA", "Thailand", "Southeast-Asia", "Municipal/Local Government", "City Government", "All sectors", "Thai", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASE-THA-0008", "Bank of Thailand", "https://www.bot.or.th/procurement", "THA", "Thailand", "Southeast-Asia", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Thai, English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # MALAYSIA
    create_entry("ASE-MYS-0001", "ePerolehan Malaysia", "https://www.eperolehan.gov.my", "MYS", "Malaysia", "Southeast-Asia", "National Government Portal", "E-Procurement", "All sectors", "Malay, English", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)"),
    create_entry("ASE-MYS-0002", "MyProcurement", "https://www.myprocurement.treasury.gov.my", "MYS", "Malaysia", "Southeast-Asia", "National Government Portal", "Procurement Portal", "All sectors", "Malay, English", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASE-MYS-0003", "Petronas", "https://www.petronas.com/procurement", "MYS", "Malaysia", "Southeast-Asia", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Malay, English", "Weekly", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("ASE-MYS-0004", "Tenaga Nasional (TNB)", "https://www.tnb.com.my/procurement", "MYS", "Malaysia", "Southeast-Asia", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Malay, English", "Weekly", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("ASE-MYS-0005", "Malaysia Airlines", "https://www.malaysiaairlines.com/procurement", "MYS", "Malaysia", "Southeast-Asia", "Parastatal/SOE", "Aviation", "Aviation, IT, Services", "Malay, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASE-MYS-0006", "Bank Negara Malaysia", "https://www.bnm.gov.my/procurement", "MYS", "Malaysia", "Southeast-Asia", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Malay, English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("ASE-MYS-0007", "Universiti Malaya", "https://www.um.edu.my/procurement", "MYS", "Malaysia", "Southeast-Asia", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Malay, English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("ASE-MYS-0008", "Kuala Lumpur City Hall (DBKL)", "https://www.dbkl.gov.my/procurement", "MYS", "Malaysia", "Southeast-Asia", "Municipal/Local Government", "City Government", "All sectors", "Malay, English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),

    # MYANMAR
    create_entry("ASE-MMR-0001", "Myanmar Electronic Government Procurement", "https://www.mfrfegp.gov.mm", "MMR", "Myanmar", "Southeast-Asia", "National Government Portal", "E-Procurement", "All sectors", "Myanmar, English", "Weekly", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASE-MMR-0002", "MOGE (Oil and Gas)", "https://www.mfrfoge.gov.mm/tenders", "MMR", "Myanmar", "Southeast-Asia", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Myanmar, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("ASE-MMR-0003", "Myanmar Electric Power Enterprise", "https://www.mfrfepe.gov.mm/tenders", "MMR", "Myanmar", "Southeast-Asia", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Myanmar, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # CAMBODIA
    create_entry("ASE-KHM-0001", "Cambodia Government Procurement", "https://www.gdce.gov.kh/procurement", "KHM", "Cambodia", "Southeast-Asia", "National Government Portal", "Central Procurement", "All sectors", "Khmer, English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("ASE-KHM-0002", "EDC Cambodia (Electricity)", "https://www.edc.com.kh/procurement", "KHM", "Cambodia", "Southeast-Asia", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Khmer, English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # LAO PDR
    create_entry("ASE-LAO-0001", "Lao PDR Government Procurement", "https://www.mofrfof.gov.la/procurement", "LAO", "Laos", "Southeast-Asia", "National Government Portal", "Central Procurement", "All sectors", "Lao, English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("ASE-LAO-0002", "EDL (Electricity)", "https://www.edl.com.la/procurement", "LAO", "Laos", "Southeast-Asia", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Lao, English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # TIMOR-LESTE
    create_entry("ASE-TLS-0001", "Timor-Leste eProcurement Portal", "https://www.eprocurement.gov.tl", "TLS", "Timor-Leste", "Southeast-Asia", "National Government Portal", "E-Procurement", "All sectors", "Portuguese, Tetum, English", "Weekly", "Free Registration", "No", "HTML, PDF", "Low (20-100)"),

    # PACIFIC ISLANDS
    # Papua New Guinea
    create_entry("PAC-PNG-0001", "PNG Central Supply & Tenders Board", "https://www.cstb.gov.pg", "PNG", "Papua New Guinea", "Pacific", "National Government Portal", "Central Procurement", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("PAC-PNG-0002", "PNG Power", "https://www.pngpower.com.pg/tenders", "PNG", "Papua New Guinea", "Pacific", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # Fiji
    create_entry("PAC-FJI-0001", "Fiji Procurement Office", "https://www.procurement.gov.fj", "FJI", "Fiji", "Pacific", "National Government Portal", "Central Procurement", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("PAC-FJI-0002", "Energy Fiji Limited", "https://www.efl.com.fj/tenders", "FJI", "Fiji", "Pacific", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # Solomon Islands
    create_entry("PAC-SLB-0001", "Solomon Islands Government Procurement", "https://www.mof.gov.sb/procurement", "SLB", "Solomon Islands", "Pacific", "National Government Portal", "Central Procurement", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Very Low (<20)"),

    # Vanuatu
    create_entry("PAC-VUT-0001", "Vanuatu Government Procurement", "https://www.governmentfrfof.vu/procurement", "VUT", "Vanuatu", "Pacific", "National Government Portal", "Central Procurement", "All sectors", "English, French", "Weekly", "No", "No", "HTML, PDF", "Very Low (<20)"),

    # Samoa
    create_entry("PAC-WSM-0001", "Samoa Government Procurement", "https://www.mof.gov.ws/procurement", "WSM", "Samoa", "Pacific", "National Government Portal", "Central Procurement", "All sectors", "English, Samoan", "Weekly", "No", "No", "HTML, PDF", "Very Low (<20)"),

    # Tonga
    create_entry("PAC-TON-0001", "Tonga Government Procurement", "https://www.finance.gov.to/procurement", "TON", "Tonga", "Pacific", "National Government Portal", "Central Procurement", "All sectors", "English, Tongan", "Weekly", "No", "No", "HTML, PDF", "Very Low (<20)"),
]

if __name__ == "__main__":
    print(f"Southeast Asia & Pacific entries: {len(asia_southeast_pacific)}")
    with open("/sessions/peaceful-zen-gauss/tender_db/asia_southeast_pacific.json", "w") as f:
        json.dump(asia_southeast_pacific, f, indent=2)
    print("Saved asia_southeast_pacific.json")
