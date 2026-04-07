#!/usr/bin/env python3
"""
Tender Intelligence Database - Africa Southern Region
South Africa, Botswana, Zambia, Zimbabwe, Namibia, Mozambique, Malawi,
Lesotho, Eswatini, Angola
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

africa_southern = [
    # SOUTH AFRICA - Major economy
    create_entry("AFS-ZAF-0001", "eTender Portal South Africa", "https://www.etenders.gov.za", "ZAF", "South Africa", "Africa-Southern", "National Government Portal", "E-Procurement", "All sectors", "English", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Main government tender portal"),
    create_entry("AFS-ZAF-0002", "National Treasury South Africa", "https://www.treasury.gov.za", "ZAF", "South Africa", "Africa-Southern", "Federal Ministry", "Finance", "Financial services, Consulting", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZAF-0003", "Office of the Chief Procurement Officer", "https://ocpo.treasury.gov.za", "ZAF", "South Africa", "Africa-Southern", "National Government Portal", "Procurement Regulator", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZAF-0004", "Central Supplier Database", "https://secure.csd.gov.za", "ZAF", "South Africa", "Africa-Southern", "National Government Portal", "Supplier Registration", "All sectors", "English", "Daily", "Free Registration", "Yes", "HTML, API", "Very High (>2000)", "Supplier verification system"),
    create_entry("AFS-ZAF-0005", "Department of Health South Africa", "https://www.health.gov.za", "ZAF", "South Africa", "Africa-Southern", "Federal Ministry", "Health", "Medical supplies, Pharmaceuticals", "English", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFS-ZAF-0006", "Department of Public Works and Infrastructure", "https://www.publicworks.gov.za", "ZAF", "South Africa", "Africa-Southern", "Federal Ministry", "Infrastructure", "Construction, Engineering", "English", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFS-ZAF-0007", "Department of Transport", "https://www.transport.gov.za", "ZAF", "South Africa", "Africa-Southern", "Federal Ministry", "Transport", "Transport, Construction, IT", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZAF-0008", "Department of Defence", "https://www.dod.mil.za", "ZAF", "South Africa", "Africa-Southern", "Federal Ministry", "Defence", "Defence, IT, Equipment", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZAF-0009", "South African National Roads Agency (SANRAL)", "https://www.sanral.co.za", "ZAF", "South Africa", "Africa-Southern", "Infrastructure Authority", "Roads", "Construction, Engineering", "English", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFS-ZAF-0010", "Transnet", "https://www.transnet.net", "ZAF", "South Africa", "Africa-Southern", "Parastatal/SOE", "Logistics", "Rail, Ports, Logistics, Engineering", "English", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)", "Major SOE - ports, rail, pipelines"),
    create_entry("AFS-ZAF-0011", "Eskom Holdings", "https://www.eskom.co.za", "ZAF", "South Africa", "Africa-Southern", "Public Utility", "Electricity", "Power, Engineering, Construction", "English", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)", "Largest African utility"),
    create_entry("AFS-ZAF-0012", "Rand Water", "https://www.randwater.co.za", "ZAF", "South Africa", "Africa-Southern", "Public Utility", "Water", "Water, Engineering, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZAF-0013", "Umgeni Water", "https://www.umgeni.co.za", "ZAF", "South Africa", "Africa-Southern", "Public Utility", "Water", "Water, Engineering, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0014", "South African Airways", "https://www.flysaa.com", "ZAF", "South Africa", "Africa-Southern", "Parastatal/SOE", "Aviation", "Aviation, IT, Services", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0015", "Airports Company South Africa (ACSA)", "https://www.airports.co.za", "ZAF", "South Africa", "Africa-Southern", "Parastatal/SOE", "Aviation", "Aviation, Construction, IT", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZAF-0016", "Telkom South Africa", "https://www.telkom.co.za", "ZAF", "South Africa", "Africa-Southern", "Public Utility", "Telecommunications", "IT, Telecommunications", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZAF-0017", "South African Post Office", "https://www.postoffice.co.za", "ZAF", "South Africa", "Africa-Southern", "Parastatal/SOE", "Postal", "Logistics, IT, Services", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0018", "South African Reserve Bank", "https://www.resbank.co.za", "ZAF", "South Africa", "Africa-Southern", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-ZAF-0019", "Independent Electoral Commission South Africa", "https://www.elections.org.za", "ZAF", "South Africa", "Africa-Southern", "Electoral Body", "Elections", "IT, Logistics, Printing", "English", "Irregular", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0020", "Government Employees Pension Fund (GEPF)", "https://www.gepf.co.za", "ZAF", "South Africa", "Africa-Southern", "Pension/Social Fund", "Pensions", "IT, Financial services", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-ZAF-0021", "University of Cape Town", "https://www.uct.ac.za", "ZAF", "South Africa", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0022", "University of the Witwatersrand", "https://www.wits.ac.za", "ZAF", "South Africa", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0023", "University of Pretoria", "https://www.up.ac.za", "ZAF", "South Africa", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0024", "Stellenbosch University", "https://www.sun.ac.za", "ZAF", "South Africa", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English, Afrikaans", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0025", "University of KwaZulu-Natal", "https://www.ukzn.ac.za", "ZAF", "South Africa", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0026", "Chris Hani Baragwanath Hospital", "https://www.chrishanibaragwanathhospital.co.za", "ZAF", "South Africa", "Africa-Southern", "Hospital/Health System", "Teaching Hospital", "Medical equipment, Pharmaceuticals", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0027", "Steve Biko Academic Hospital", "https://www.sbah.org.za", "ZAF", "South Africa", "Africa-Southern", "Hospital/Health System", "Teaching Hospital", "Medical equipment, Pharmaceuticals", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    # South Africa - Provincial Governments
    create_entry("AFS-ZAF-0028", "Gauteng Provincial Government", "https://www.gauteng.gov.za", "ZAF", "South Africa", "Africa-Southern", "State/Provincial Government", "Provincial Government", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFS-ZAF-0029", "Western Cape Provincial Government", "https://www.westerncape.gov.za", "ZAF", "South Africa", "Africa-Southern", "State/Provincial Government", "Provincial Government", "All sectors", "English, Afrikaans", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZAF-0030", "KwaZulu-Natal Provincial Government", "https://www.kznonline.gov.za", "ZAF", "South Africa", "Africa-Southern", "State/Provincial Government", "Provincial Government", "All sectors", "English, Zulu", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZAF-0031", "Eastern Cape Provincial Government", "https://www.ecprov.gov.za", "ZAF", "South Africa", "Africa-Southern", "State/Provincial Government", "Provincial Government", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZAF-0032", "Limpopo Provincial Government", "https://www.limpopo.gov.za", "ZAF", "South Africa", "Africa-Southern", "State/Provincial Government", "Provincial Government", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0033", "Mpumalanga Provincial Government", "https://www.mpumalanga.gov.za", "ZAF", "South Africa", "Africa-Southern", "State/Provincial Government", "Provincial Government", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0034", "North West Provincial Government", "https://www.nwpg.gov.za", "ZAF", "South Africa", "Africa-Southern", "State/Provincial Government", "Provincial Government", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0035", "Free State Provincial Government", "https://www.freestateonline.fs.gov.za", "ZAF", "South Africa", "Africa-Southern", "State/Provincial Government", "Provincial Government", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0036", "Northern Cape Provincial Government", "https://www.northern-cape.gov.za", "ZAF", "South Africa", "Africa-Southern", "State/Provincial Government", "Provincial Government", "All sectors", "English, Afrikaans", "Daily", "No", "No", "HTML, PDF", "Low (20-100)"),
    # South Africa - Major Metros
    create_entry("AFS-ZAF-0037", "City of Johannesburg", "https://www.joburg.org.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Metro Government", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFS-ZAF-0038", "City of Cape Town", "https://www.capetown.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Metro Government", "All sectors", "English, Afrikaans", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFS-ZAF-0039", "City of Tshwane (Pretoria)", "https://www.tshwane.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Metro Government", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFS-ZAF-0040", "eThekwini Municipality (Durban)", "https://www.durban.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Metro Government", "All sectors", "English, Zulu", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFS-ZAF-0041", "City of Ekurhuleni", "https://www.ekurhuleni.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Metro Government", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZAF-0042", "Nelson Mandela Bay Municipality", "https://www.nelsonmandelabay.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Metro Government", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZAF-0043", "Buffalo City Metropolitan Municipality", "https://www.buffalocity.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Metro Government", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0044", "Mangaung Metropolitan Municipality", "https://www.mangaung.co.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Metro Government", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # BOTSWANA
    create_entry("AFS-BWA-0001", "Public Procurement and Asset Disposal Board (PPADB)", "https://www.ppadb.co.bw", "BWA", "Botswana", "Africa-Southern", "National Government Portal", "Procurement Regulator", "All sectors", "English", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-BWA-0002", "Integrated Procurement Management System (IPMS)", "https://www.tenders.ppadb.co.bw", "BWA", "Botswana", "Africa-Southern", "National Government Portal", "E-Procurement", "All sectors", "English", "Daily", "Free Registration", "Yes", "HTML, XML", "High (500-2000)", "Central e-procurement system"),
    create_entry("AFS-BWA-0003", "Ministry of Finance and Economic Development Botswana", "https://www.finance.gov.bw", "BWA", "Botswana", "Africa-Southern", "Federal Ministry", "Finance", "Financial services, Consulting", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-BWA-0004", "Botswana Power Corporation", "https://www.bpc.bw", "BWA", "Botswana", "Africa-Southern", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-BWA-0005", "Water Utilities Corporation Botswana", "https://www.wuc.bw", "BWA", "Botswana", "Africa-Southern", "Public Utility", "Water", "Water, Engineering, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-BWA-0006", "Botswana Telecommunications Corporation", "https://www.btc.bw", "BWA", "Botswana", "Africa-Southern", "Public Utility", "Telecommunications", "IT, Telecommunications", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-BWA-0007", "Bank of Botswana", "https://www.bankofbotswana.bw", "BWA", "Botswana", "Africa-Southern", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-BWA-0008", "University of Botswana", "https://www.ub.bw", "BWA", "Botswana", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-BWA-0009", "Gaborone City Council", "https://www.gaborone.gov.bw", "BWA", "Botswana", "Africa-Southern", "Municipal/Local Government", "City Government", "Construction, Services, IT", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-BWA-0010", "Botswana Unified Revenue Service", "https://www.burs.org.bw", "BWA", "Botswana", "Africa-Southern", "Federal Ministry", "Revenue", "IT, Consulting", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # ZAMBIA
    create_entry("AFS-ZMB-0001", "Zambia Public Procurement Authority (ZPPA)", "https://www.zppa.org.zm", "ZMB", "Zambia", "Africa-Southern", "National Government Portal", "Procurement Regulator", "All sectors", "English", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZMB-0002", "ZPPA e-Procurement Portal", "https://www.epp.zppa.org.zm", "ZMB", "Zambia", "Africa-Southern", "National Government Portal", "E-Procurement", "All sectors", "English", "Daily", "Free Registration", "Yes", "HTML, XML", "High (500-2000)"),
    create_entry("AFS-ZMB-0003", "Ministry of Finance Zambia", "https://www.mof.gov.zm", "ZMB", "Zambia", "Africa-Southern", "Federal Ministry", "Finance", "Financial services, Consulting", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZMB-0004", "Road Development Agency Zambia", "https://www.rda.org.zm", "ZMB", "Zambia", "Africa-Southern", "Infrastructure Authority", "Roads", "Construction, Engineering", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZMB-0005", "ZESCO Limited", "https://www.zesco.co.zm", "ZMB", "Zambia", "Africa-Southern", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZMB-0006", "Lusaka Water and Sewerage Company", "https://www.lwsc.com.zm", "ZMB", "Zambia", "Africa-Southern", "Public Utility", "Water", "Water, Engineering, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZMB-0007", "Zambia Telecommunications Company (Zamtel)", "https://www.zamtel.zm", "ZMB", "Zambia", "Africa-Southern", "Public Utility", "Telecommunications", "IT, Telecommunications", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZMB-0008", "Bank of Zambia", "https://www.boz.zm", "ZMB", "Zambia", "Africa-Southern", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-ZMB-0009", "University of Zambia", "https://www.unza.zm", "ZMB", "Zambia", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-ZMB-0010", "Lusaka City Council", "https://www.lcc.gov.zm", "ZMB", "Zambia", "Africa-Southern", "Municipal/Local Government", "City Government", "Construction, Services, IT", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZMB-0011", "Medical Stores Limited Zambia", "https://www.msl.com.zm", "ZMB", "Zambia", "Africa-Southern", "Parastatal/SOE", "Medical Supplies", "Pharmaceuticals, Medical equipment", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # ZIMBABWE
    create_entry("AFS-ZWE-0001", "Procurement Regulatory Authority of Zimbabwe (PRAZ)", "https://www.praz.gov.zw", "ZWE", "Zimbabwe", "Africa-Southern", "National Government Portal", "Procurement Regulator", "All sectors", "English", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZWE-0002", "Zimbabwe Government Gazette (Tenders)", "https://www.veritaszim.net", "ZWE", "Zimbabwe", "Africa-Southern", "National Government Portal", "Government Gazette", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-ZWE-0003", "Ministry of Finance Zimbabwe", "https://www.zimtreasury.gov.zw", "ZWE", "Zimbabwe", "Africa-Southern", "Federal Ministry", "Finance", "Financial services, Consulting", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZWE-0004", "ZINARA (Roads)", "https://www.zinara.co.zw", "ZWE", "Zimbabwe", "Africa-Southern", "Infrastructure Authority", "Roads", "Construction, Engineering", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZWE-0005", "ZESA Holdings", "https://www.zesa.co.zw", "ZWE", "Zimbabwe", "Africa-Southern", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZWE-0006", "ZINWA (Water)", "https://www.zinwa.co.zw", "ZWE", "Zimbabwe", "Africa-Southern", "Public Utility", "Water", "Water, Engineering, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZWE-0007", "Reserve Bank of Zimbabwe", "https://www.rbz.co.zw", "ZWE", "Zimbabwe", "Africa-Southern", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-ZWE-0008", "University of Zimbabwe", "https://www.uz.ac.zw", "ZWE", "Zimbabwe", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-ZWE-0009", "City of Harare", "https://www.hararecity.co.zw", "ZWE", "Zimbabwe", "Africa-Southern", "Municipal/Local Government", "City Government", "Construction, Services, IT", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZWE-0010", "NatPharm Zimbabwe", "https://www.natpharm.co.zw", "ZWE", "Zimbabwe", "Africa-Southern", "Parastatal/SOE", "Medical Supplies", "Pharmaceuticals, Medical equipment", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # NAMIBIA
    create_entry("AFS-NAM-0001", "Central Procurement Board Namibia", "https://www.cpbn.gov.na", "NAM", "Namibia", "Africa-Southern", "National Government Portal", "Procurement Regulator", "All sectors", "English", "Daily", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-NAM-0002", "Ministry of Finance Namibia", "https://www.mof.gov.na", "NAM", "Namibia", "Africa-Southern", "Federal Ministry", "Finance", "Financial services, Consulting", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-NAM-0003", "NamPower", "https://www.nampower.com.na", "NAM", "Namibia", "Africa-Southern", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-NAM-0004", "NamWater", "https://www.namwater.com.na", "NAM", "Namibia", "Africa-Southern", "Public Utility", "Water", "Water, Engineering, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-NAM-0005", "Namibia Ports Authority (Namport)", "https://www.namport.com.na", "NAM", "Namibia", "Africa-Southern", "Parastatal/SOE", "Ports", "Maritime, Construction, Equipment", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-NAM-0006", "Roads Authority Namibia", "https://www.ra.org.na", "NAM", "Namibia", "Africa-Southern", "Infrastructure Authority", "Roads", "Construction, Engineering", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-NAM-0007", "Bank of Namibia", "https://www.bon.com.na", "NAM", "Namibia", "Africa-Southern", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-NAM-0008", "University of Namibia", "https://www.unam.edu.na", "NAM", "Namibia", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-NAM-0009", "City of Windhoek", "https://www.windhoekcc.org.na", "NAM", "Namibia", "Africa-Southern", "Municipal/Local Government", "City Government", "Construction, Services, IT", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # MOZAMBIQUE
    create_entry("AFS-MOZ-0001", "UFSA (Unidade Funcional de Supervisao das Aquisicoes)", "https://www.ufsa.gov.mz", "MOZ", "Mozambique", "Africa-Southern", "National Government Portal", "Procurement Regulator", "All sectors", "Portuguese", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-MOZ-0002", "Sistema de Gestao de Contratos (e-SISTAFE)", "https://www.sistafe.gov.mz", "MOZ", "Mozambique", "Africa-Southern", "National Government Portal", "E-Procurement", "All sectors", "Portuguese", "Daily", "Government ID", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-MOZ-0003", "Ministry of Economy and Finance Mozambique", "https://www.mef.gov.mz", "MOZ", "Mozambique", "Africa-Southern", "Federal Ministry", "Finance", "Financial services, Consulting", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-MOZ-0004", "ANE (Roads)", "https://www.ane.gov.mz", "MOZ", "Mozambique", "Africa-Southern", "Infrastructure Authority", "Roads", "Construction, Engineering", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-MOZ-0005", "EDM (Electricidade de Mocambique)", "https://www.edm.co.mz", "MOZ", "Mozambique", "Africa-Southern", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-MOZ-0006", "FIPAG (Water)", "https://www.fipag.co.mz", "MOZ", "Mozambique", "Africa-Southern", "Public Utility", "Water", "Water, Engineering, Construction", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-MOZ-0007", "CFM (Ports and Railways)", "https://www.cfm.co.mz", "MOZ", "Mozambique", "Africa-Southern", "Parastatal/SOE", "Ports and Railways", "Maritime, Rail, Construction", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-MOZ-0008", "Banco de Mocambique", "https://www.bancomoc.mz", "MOZ", "Mozambique", "Africa-Southern", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Portuguese", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-MOZ-0009", "Universidade Eduardo Mondlane", "https://www.uem.mz", "MOZ", "Mozambique", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Portuguese", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-MOZ-0010", "Conselho Municipal de Maputo", "https://www.cfrmmaputo.gov.mz", "MOZ", "Mozambique", "Africa-Southern", "Municipal/Local Government", "City Government", "Construction, Services, IT", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # MALAWI
    create_entry("AFS-MWI-0001", "Public Procurement and Disposal of Assets Authority (PPDA)", "https://www.ppda.mw", "MWI", "Malawi", "Africa-Southern", "National Government Portal", "Procurement Regulator", "All sectors", "English", "Daily", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-MWI-0002", "Ministry of Finance Malawi", "https://www.finance.gov.mw", "MWI", "Malawi", "Africa-Southern", "Federal Ministry", "Finance", "Financial services, Consulting", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-MWI-0003", "ESCOM Malawi (Electricity)", "https://www.escom.mw", "MWI", "Malawi", "Africa-Southern", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-MWI-0004", "Lilongwe Water Board", "https://www.lwb.mw", "MWI", "Malawi", "Africa-Southern", "Public Utility", "Water", "Water, Engineering, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-MWI-0005", "Reserve Bank of Malawi", "https://www.rbm.mw", "MWI", "Malawi", "Africa-Southern", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-MWI-0006", "University of Malawi", "https://www.unima.mw", "MWI", "Malawi", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-MWI-0007", "Central Medical Stores Trust Malawi", "https://www.cmst.mw", "MWI", "Malawi", "Africa-Southern", "Parastatal/SOE", "Medical Supplies", "Pharmaceuticals, Medical equipment", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # LESOTHO
    create_entry("AFS-LSO-0001", "Procurement Policy Unit Lesotho", "https://www.ppu.gov.ls", "LSO", "Lesotho", "Africa-Southern", "National Government Portal", "Procurement Regulator", "All sectors", "English, Sesotho", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-LSO-0002", "Ministry of Finance Lesotho", "https://www.finance.gov.ls", "LSO", "Lesotho", "Africa-Southern", "Federal Ministry", "Finance", "Financial services, Consulting", "English, Sesotho", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-LSO-0003", "Lesotho Electricity Company", "https://www.lec.co.ls", "LSO", "Lesotho", "Africa-Southern", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English, Sesotho", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-LSO-0004", "WASCO Lesotho (Water)", "https://www.wasco.co.ls", "LSO", "Lesotho", "Africa-Southern", "Public Utility", "Water", "Water, Engineering, Construction", "English, Sesotho", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-LSO-0005", "Central Bank of Lesotho", "https://www.centralbank.org.ls", "LSO", "Lesotho", "Africa-Southern", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English, Sesotho", "Monthly", "No", "No", "HTML, PDF", "Very Low (<20)"),
    create_entry("AFS-LSO-0006", "National University of Lesotho", "https://www.nul.ls", "LSO", "Lesotho", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English, Sesotho", "Monthly", "No", "No", "HTML, PDF", "Very Low (<20)"),

    # ESWATINI (SWAZILAND)
    create_entry("AFS-SWZ-0001", "Eswatini Public Procurement Regulatory Agency", "https://www.sppra.co.sz", "SWZ", "Eswatini", "Africa-Southern", "National Government Portal", "Procurement Regulator", "All sectors", "English, Swati", "Weekly", "Free Registration", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-SWZ-0002", "Ministry of Finance Eswatini", "https://www.gov.sz/index.php/ministries-departments/ministry-of-finance", "SWZ", "Eswatini", "Africa-Southern", "Federal Ministry", "Finance", "Financial services, Consulting", "English, Swati", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-SWZ-0003", "Eswatini Electricity Company (EEC)", "https://www.sec.co.sz", "SWZ", "Eswatini", "Africa-Southern", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English, Swati", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-SWZ-0004", "Eswatini Water Services Corporation", "https://www.swsc.co.sz", "SWZ", "Eswatini", "Africa-Southern", "Public Utility", "Water", "Water, Engineering, Construction", "English, Swati", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-SWZ-0005", "Central Bank of Eswatini", "https://www.centralbank.org.sz", "SWZ", "Eswatini", "Africa-Southern", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English, Swati", "Monthly", "No", "No", "HTML, PDF", "Very Low (<20)"),
    create_entry("AFS-SWZ-0006", "University of Eswatini", "https://www.uneswa.ac.sz", "SWZ", "Eswatini", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English, Swati", "Monthly", "No", "No", "HTML, PDF", "Very Low (<20)"),

    # ANGOLA
    create_entry("AFS-AGO-0001", "Portal de Contratacao Publica de Angola", "https://www.sncp.minfin.gov.ao", "AGO", "Angola", "Africa-Southern", "National Government Portal", "E-Procurement", "All sectors", "Portuguese", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFS-AGO-0002", "Ministerio das Financas Angola", "https://www.minfin.gov.ao", "AGO", "Angola", "Africa-Southern", "Federal Ministry", "Finance", "Financial services, Consulting", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-AGO-0003", "INEA (Roads)", "https://www.inea.gov.ao", "AGO", "Angola", "Africa-Southern", "Infrastructure Authority", "Roads", "Construction, Engineering", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-AGO-0004", "Sonangol (Oil)", "https://www.sonangol.co.ao", "AGO", "Angola", "Africa-Southern", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)", "Major oil company"),
    create_entry("AFS-AGO-0005", "ENDE (Electricity)", "https://www.ende.co.ao", "AGO", "Angola", "Africa-Southern", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFS-AGO-0006", "EPAL (Water)", "https://www.epal.co.ao", "AGO", "Angola", "Africa-Southern", "Public Utility", "Water", "Water, Engineering, Construction", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-AGO-0007", "Porto de Luanda", "https://www.portoluanda.co.ao", "AGO", "Angola", "Africa-Southern", "Parastatal/SOE", "Ports", "Maritime, Construction, Equipment", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-AGO-0008", "Banco Nacional de Angola", "https://www.bna.ao", "AGO", "Angola", "Africa-Southern", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Portuguese", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-AGO-0009", "Universidade Agostinho Neto", "https://www.uan.ao", "AGO", "Angola", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Portuguese", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-AGO-0010", "TAAG Angola Airlines", "https://www.taag.com", "AGO", "Angola", "Africa-Southern", "Parastatal/SOE", "Aviation", "Aviation, IT, Services", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
]

if __name__ == "__main__":
    print(f"Southern Africa entries: {len(africa_southern)}")
    with open("/sessions/peaceful-zen-gauss/tender_db/africa_southern.json", "w") as f:
        json.dump(africa_southern, f, indent=2)
    print("Saved africa_southern.json")
