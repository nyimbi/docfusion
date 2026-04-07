#!/usr/bin/env python3
"""
Tender Intelligence Database - Africa East Region
Kenya, Tanzania, Uganda, Ethiopia, Rwanda, Burundi, South Sudan, Somalia, Djibouti, Eritrea,
Comoros, Seychelles, Mauritius, Madagascar
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

africa_east = [
    # KENYA - Major IT and business hub
    create_entry("AFE-KEN-0001", "Public Procurement Information Portal (PPIP)", "https://www.tenders.go.ke", "KEN", "Kenya", "Africa-East", "National Government Portal", "E-Procurement", "All sectors", "English", "Daily", "Free Registration", "Yes", "HTML, JSON", "Very High (>2000)", "Main e-procurement portal, OCDS-compliant"),
    create_entry("AFE-KEN-0002", "Public Procurement Regulatory Authority", "https://www.ppra.go.ke", "KEN", "Kenya", "Africa-East", "National Government Portal", "Procurement Regulator", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-KEN-0003", "IFMIS Kenya", "https://www.ifmis.go.ke", "KEN", "Kenya", "Africa-East", "National Government Portal", "Financial Management", "All sectors", "English", "Daily", "Government ID", "No", "HTML, PDF", "Very High (>2000)", "Integrated Financial Management"),
    create_entry("AFE-KEN-0004", "National Treasury Kenya", "https://www.treasury.go.ke", "KEN", "Kenya", "Africa-East", "Federal Ministry", "Finance", "Financial services, Consulting", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-KEN-0005", "Ministry of Health Kenya", "https://www.health.go.ke", "KEN", "Kenya", "Africa-East", "Federal Ministry", "Health", "Medical supplies, Pharmaceuticals, IT", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-KEN-0006", "Ministry of ICT Kenya", "https://www.ict.go.ke", "KEN", "Kenya", "Africa-East", "Federal Ministry", "ICT", "IT, Telecommunications, Digital services", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-KEN-0007", "Kenya National Highways Authority (KeNHA)", "https://www.kenha.co.ke", "KEN", "Kenya", "Africa-East", "Infrastructure Authority", "Roads", "Construction, Engineering, Consulting", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-KEN-0008", "Kenya Rural Roads Authority (KeRRA)", "https://www.kerra.go.ke", "KEN", "Kenya", "Africa-East", "Infrastructure Authority", "Rural Roads", "Construction, Engineering", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-KEN-0009", "Kenya Urban Roads Authority (KURA)", "https://www.kura.go.ke", "KEN", "Kenya", "Africa-East", "Infrastructure Authority", "Urban Roads", "Construction, Engineering", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-KEN-0010", "Kenya Ports Authority", "https://www.kpa.co.ke", "KEN", "Kenya", "Africa-East", "Parastatal/SOE", "Ports", "Maritime, Construction, Equipment", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-KEN-0011", "Kenya Airports Authority", "https://www.kaa.go.ke", "KEN", "Kenya", "Africa-East", "Parastatal/SOE", "Aviation", "Aviation, Construction, IT", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-KEN-0012", "Kenya Railways Corporation", "https://krc.co.ke", "KEN", "Kenya", "Africa-East", "Parastatal/SOE", "Railways", "Rail, Construction, Rolling stock", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-KEN-0013", "Kenya Power and Lighting Company", "https://www.kplc.co.ke", "KEN", "Kenya", "Africa-East", "Public Utility", "Electricity Distribution", "Power, Engineering, IT", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-KEN-0014", "Kenya Electricity Generating Company (KenGen)", "https://www.kengen.co.ke", "KEN", "Kenya", "Africa-East", "Public Utility", "Electricity Generation", "Power, Engineering, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-KEN-0015", "Kenya Electricity Transmission Company (KETRACO)", "https://www.ketraco.co.ke", "KEN", "Kenya", "Africa-East", "Public Utility", "Electricity Transmission", "Power, Engineering, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-KEN-0016", "Nairobi City Water and Sewerage Company", "https://www.nairobiwater.co.ke", "KEN", "Kenya", "Africa-East", "Public Utility", "Water", "Water, Engineering, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-KEN-0017", "Central Bank of Kenya", "https://www.centralbank.go.ke", "KEN", "Kenya", "Africa-East", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0018", "Independent Electoral and Boundaries Commission", "https://www.iebc.or.ke", "KEN", "Kenya", "Africa-East", "Electoral Body", "Elections", "IT, Logistics, Printing", "English", "Irregular", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0019", "National Social Security Fund (NSSF)", "https://www.nssf.or.ke", "KEN", "Kenya", "Africa-East", "Pension/Social Fund", "Social Security", "IT, Construction, Services", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0020", "National Hospital Insurance Fund (NHIF)", "https://www.nhif.or.ke", "KEN", "Kenya", "Africa-East", "Pension/Social Fund", "Health Insurance", "IT, Healthcare", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0021", "University of Nairobi", "https://www.uonbi.ac.ke", "KEN", "Kenya", "Africa-East", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0022", "Kenyatta University", "https://www.ku.ac.ke", "KEN", "Kenya", "Africa-East", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0023", "Moi University", "https://www.mu.ac.ke", "KEN", "Kenya", "Africa-East", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0024", "Kenyatta National Hospital", "https://knh.or.ke", "KEN", "Kenya", "Africa-East", "Hospital/Health System", "Teaching Hospital", "Medical equipment, Pharmaceuticals, IT", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-KEN-0025", "Moi Teaching and Referral Hospital", "https://www.mtrh.go.ke", "KEN", "Kenya", "Africa-East", "Hospital/Health System", "Teaching Hospital", "Medical equipment, Pharmaceuticals, IT", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-KEN-0026", "Kenya Medical Supplies Authority (KEMSA)", "https://www.kemsa.co.ke", "KEN", "Kenya", "Africa-East", "Parastatal/SOE", "Medical Supplies", "Pharmaceuticals, Medical equipment", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-KEN-0027", "Kenya Revenue Authority", "https://www.kra.go.ke", "KEN", "Kenya", "Africa-East", "Federal Ministry", "Revenue", "IT, Consulting, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-KEN-0028", "Communications Authority of Kenya", "https://www.ca.go.ke", "KEN", "Kenya", "Africa-East", "Central Bank/Regulator", "Telecom Regulator", "IT, Telecommunications", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    # Kenya Counties
    create_entry("AFE-KEN-0029", "Nairobi City County", "https://nairobi.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-KEN-0030", "Mombasa County", "https://www.mombasa.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-KEN-0031", "Kisumu County", "https://www.kisumu.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-KEN-0032", "Nakuru County", "https://www.nakuru.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # TANZANIA
    create_entry("AFE-TZA-0001", "Tanzania National e-Procurement System (TANePS)", "https://www.taneps.go.tz", "TZA", "Tanzania", "Africa-East", "National Government Portal", "E-Procurement", "All sectors", "English, Swahili", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Main e-procurement portal"),
    create_entry("AFE-TZA-0002", "Public Procurement Regulatory Authority Tanzania", "https://www.ppra.go.tz", "TZA", "Tanzania", "Africa-East", "National Government Portal", "Procurement Regulator", "All sectors", "English, Swahili", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-TZA-0003", "Ministry of Finance Tanzania", "https://www.mof.go.tz", "TZA", "Tanzania", "Africa-East", "Federal Ministry", "Finance", "Financial services, Consulting", "English, Swahili", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-TZA-0004", "Ministry of Health Tanzania", "https://www.moh.go.tz", "TZA", "Tanzania", "Africa-East", "Federal Ministry", "Health", "Medical supplies, Pharmaceuticals", "English, Swahili", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-TZA-0005", "Tanzania National Roads Agency (TANROADS)", "https://www.tanroads.go.tz", "TZA", "Tanzania", "Africa-East", "Infrastructure Authority", "Roads", "Construction, Engineering", "English, Swahili", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-TZA-0006", "Tanzania Ports Authority", "https://www.ports.go.tz", "TZA", "Tanzania", "Africa-East", "Parastatal/SOE", "Ports", "Maritime, Construction, Equipment", "English, Swahili", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-TZA-0007", "Tanzania Airports Authority", "https://www.taa.go.tz", "TZA", "Tanzania", "Africa-East", "Parastatal/SOE", "Aviation", "Aviation, Construction, IT", "English, Swahili", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-TZA-0008", "Tanzania Railways Corporation", "https://www.trc.co.tz", "TZA", "Tanzania", "Africa-East", "Parastatal/SOE", "Railways", "Rail, Construction, Rolling stock", "English, Swahili", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-TZA-0009", "TANESCO (Tanzania Electric Supply Company)", "https://www.tanesco.co.tz", "TZA", "Tanzania", "Africa-East", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English, Swahili", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-TZA-0010", "DAWASA (Dar es Salaam Water)", "https://www.dawasa.go.tz", "TZA", "Tanzania", "Africa-East", "Public Utility", "Water", "Water, Engineering, Construction", "English, Swahili", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-TZA-0011", "Bank of Tanzania", "https://www.bot.go.tz", "TZA", "Tanzania", "Africa-East", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English, Swahili", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-TZA-0012", "National Electoral Commission Tanzania", "https://www.nec.go.tz", "TZA", "Tanzania", "Africa-East", "Electoral Body", "Elections", "IT, Logistics, Printing", "English, Swahili", "Irregular", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-TZA-0013", "NSSF Tanzania", "https://www.nssf.or.tz", "TZA", "Tanzania", "Africa-East", "Pension/Social Fund", "Social Security", "IT, Construction, Services", "English, Swahili", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-TZA-0014", "University of Dar es Salaam", "https://www.udsm.ac.tz", "TZA", "Tanzania", "Africa-East", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English, Swahili", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-TZA-0015", "Muhimbili National Hospital", "https://www.mnh.or.tz", "TZA", "Tanzania", "Africa-East", "Hospital/Health System", "Teaching Hospital", "Medical equipment, Pharmaceuticals", "English, Swahili", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-TZA-0016", "Medical Stores Department Tanzania", "https://www.msd.go.tz", "TZA", "Tanzania", "Africa-East", "Parastatal/SOE", "Medical Supplies", "Pharmaceuticals, Medical equipment", "English, Swahili", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-TZA-0017", "Tanzania Revenue Authority", "https://www.tra.go.tz", "TZA", "Tanzania", "Africa-East", "Federal Ministry", "Revenue", "IT, Consulting, Construction", "English, Swahili", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # UGANDA
    create_entry("AFE-UGA-0001", "Government Procurement Portal Uganda (GPP)", "https://www.gpp.ppda.go.ug", "UGA", "Uganda", "Africa-East", "National Government Portal", "E-Procurement", "All sectors", "English", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Main e-procurement portal"),
    create_entry("AFE-UGA-0002", "Public Procurement and Disposal of Public Assets Authority", "https://www.ppda.go.ug", "UGA", "Uganda", "Africa-East", "National Government Portal", "Procurement Regulator", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-UGA-0003", "Ministry of Finance Uganda", "https://www.finance.go.ug", "UGA", "Uganda", "Africa-East", "Federal Ministry", "Finance", "Financial services, Consulting", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-UGA-0004", "Ministry of Health Uganda", "https://www.health.go.ug", "UGA", "Uganda", "Africa-East", "Federal Ministry", "Health", "Medical supplies, Pharmaceuticals", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-UGA-0005", "Uganda National Roads Authority (UNRA)", "https://www.unra.go.ug", "UGA", "Uganda", "Africa-East", "Infrastructure Authority", "Roads", "Construction, Engineering", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-UGA-0006", "Uganda Electricity Generation Company (UEGCL)", "https://www.uegcl.com", "UGA", "Uganda", "Africa-East", "Public Utility", "Electricity Generation", "Power, Engineering, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-UGA-0007", "Uganda Electricity Transmission Company (UETCL)", "https://www.uetcl.com", "UGA", "Uganda", "Africa-East", "Public Utility", "Electricity Transmission", "Power, Engineering, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-UGA-0008", "Umeme Limited", "https://www.umeme.co.ug", "UGA", "Uganda", "Africa-East", "Public Utility", "Electricity Distribution", "Power, Engineering, Equipment", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-UGA-0009", "National Water and Sewerage Corporation", "https://www.nwsc.co.ug", "UGA", "Uganda", "Africa-East", "Public Utility", "Water", "Water, Engineering, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-UGA-0010", "Bank of Uganda", "https://www.bou.or.ug", "UGA", "Uganda", "Africa-East", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-UGA-0011", "Electoral Commission Uganda", "https://www.ec.or.ug", "UGA", "Uganda", "Africa-East", "Electoral Body", "Elections", "IT, Logistics, Printing", "English", "Irregular", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-UGA-0012", "NSSF Uganda", "https://www.nssfug.org", "UGA", "Uganda", "Africa-East", "Pension/Social Fund", "Social Security", "IT, Construction, Services", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-UGA-0013", "Makerere University", "https://www.mak.ac.ug", "UGA", "Uganda", "Africa-East", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-UGA-0014", "Mulago National Referral Hospital", "https://www.mulago.or.ug", "UGA", "Uganda", "Africa-East", "Hospital/Health System", "Teaching Hospital", "Medical equipment, Pharmaceuticals", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-UGA-0015", "National Medical Stores Uganda", "https://www.nms.go.ug", "UGA", "Uganda", "Africa-East", "Parastatal/SOE", "Medical Supplies", "Pharmaceuticals, Medical equipment", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-UGA-0016", "Uganda Revenue Authority", "https://www.ura.go.ug", "UGA", "Uganda", "Africa-East", "Federal Ministry", "Revenue", "IT, Consulting, Construction", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-UGA-0017", "Kampala Capital City Authority", "https://www.kcca.go.ug", "UGA", "Uganda", "Africa-East", "Municipal/Local Government", "City Government", "Construction, Services, IT", "English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-UGA-0018", "Civil Aviation Authority Uganda", "https://www.caa.go.ug", "UGA", "Uganda", "Africa-East", "Parastatal/SOE", "Aviation", "Aviation, Construction, IT", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # ETHIOPIA
    create_entry("AFE-ETH-0001", "Public Procurement and Property Administration Agency", "https://www.ppa.gov.et", "ETH", "Ethiopia", "Africa-East", "National Government Portal", "Procurement Regulator", "All sectors", "English, Amharic", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFE-ETH-0002", "Ministry of Finance Ethiopia", "https://www.mof.gov.et", "ETH", "Ethiopia", "Africa-East", "Federal Ministry", "Finance", "Financial services, Consulting", "English, Amharic", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-ETH-0003", "Ministry of Health Ethiopia", "https://www.moh.gov.et", "ETH", "Ethiopia", "Africa-East", "Federal Ministry", "Health", "Medical supplies, Pharmaceuticals", "English, Amharic", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-ETH-0004", "Ethiopian Roads Authority", "https://www.era.gov.et", "ETH", "Ethiopia", "Africa-East", "Infrastructure Authority", "Roads", "Construction, Engineering", "English, Amharic", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFE-ETH-0005", "Ethiopian Electric Utility", "https://www.eeu.gov.et", "ETH", "Ethiopia", "Africa-East", "Public Utility", "Electricity Distribution", "Power, Engineering, Equipment", "English, Amharic", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-ETH-0006", "Ethiopian Electric Power", "https://www.eep.gov.et", "ETH", "Ethiopia", "Africa-East", "Public Utility", "Electricity Generation", "Power, Engineering, Construction", "English, Amharic", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-ETH-0007", "Addis Ababa Water and Sewerage Authority", "https://www.aawsa.gov.et", "ETH", "Ethiopia", "Africa-East", "Public Utility", "Water", "Water, Engineering, Construction", "English, Amharic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-ETH-0008", "Ethiopian Airlines", "https://www.ethiopianairlines.com", "ETH", "Ethiopia", "Africa-East", "Parastatal/SOE", "Aviation", "Aviation, IT, Services", "English, Amharic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-ETH-0009", "Ethiopian Shipping and Logistics", "https://www.esl.com.et", "ETH", "Ethiopia", "Africa-East", "Parastatal/SOE", "Logistics", "Logistics, Maritime, Equipment", "English, Amharic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-ETH-0010", "Ethio Telecom", "https://www.ethiotelecom.et", "ETH", "Ethiopia", "Africa-East", "Public Utility", "Telecommunications", "IT, Telecommunications, Construction", "English, Amharic", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-ETH-0011", "National Bank of Ethiopia", "https://www.nbe.gov.et", "ETH", "Ethiopia", "Africa-East", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English, Amharic", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-ETH-0012", "Addis Ababa University", "https://www.aau.edu.et", "ETH", "Ethiopia", "Africa-East", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English, Amharic", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-ETH-0013", "Ethiopian Pharmaceuticals Supply Service", "https://www.epss.gov.et", "ETH", "Ethiopia", "Africa-East", "Parastatal/SOE", "Medical Supplies", "Pharmaceuticals, Medical equipment", "English, Amharic", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-ETH-0014", "Addis Ababa City Administration", "https://www.addisababa.gov.et", "ETH", "Ethiopia", "Africa-East", "Municipal/Local Government", "City Government", "Construction, Services, IT", "English, Amharic", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),

    # RWANDA
    create_entry("AFE-RWA-0001", "Rwanda Public Procurement Authority (RPPA)", "https://www.rppa.gov.rw", "RWA", "Rwanda", "Africa-East", "National Government Portal", "Procurement Regulator", "All sectors", "English, French, Kinyarwanda", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-RWA-0002", "Umucyo e-Procurement System", "https://www.umucyo.gov.rw", "RWA", "Rwanda", "Africa-East", "National Government Portal", "E-Procurement", "All sectors", "English, French, Kinyarwanda", "Daily", "Free Registration", "Yes", "HTML, XML", "High (500-2000)", "National e-procurement platform"),
    create_entry("AFE-RWA-0003", "Ministry of Finance and Economic Planning Rwanda", "https://www.minecofin.gov.rw", "RWA", "Rwanda", "Africa-East", "Federal Ministry", "Finance", "Financial services, Consulting", "English, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-RWA-0004", "Ministry of Health Rwanda", "https://www.moh.gov.rw", "RWA", "Rwanda", "Africa-East", "Federal Ministry", "Health", "Medical supplies, Pharmaceuticals", "English, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-RWA-0005", "Rwanda Transport Development Agency (RTDA)", "https://www.rtda.gov.rw", "RWA", "Rwanda", "Africa-East", "Infrastructure Authority", "Roads", "Construction, Engineering", "English, French", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFE-RWA-0006", "Rwanda Energy Group", "https://www.reg.rw", "RWA", "Rwanda", "Africa-East", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-RWA-0007", "WASAC (Water and Sanitation Corporation)", "https://www.wasac.rw", "RWA", "Rwanda", "Africa-East", "Public Utility", "Water", "Water, Engineering, Construction", "English, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-RWA-0008", "National Bank of Rwanda", "https://www.bnr.rw", "RWA", "Rwanda", "Africa-East", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English, French", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-RWA-0009", "University of Rwanda", "https://www.ur.ac.rw", "RWA", "Rwanda", "Africa-East", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English, French", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-RWA-0010", "Rwanda Medical Supply Ltd", "https://www.rmsltd.rw", "RWA", "Rwanda", "Africa-East", "Parastatal/SOE", "Medical Supplies", "Pharmaceuticals, Medical equipment", "English, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-RWA-0011", "Rwanda Information Society Authority (RISA)", "https://www.risa.rw", "RWA", "Rwanda", "Africa-East", "Parastatal/SOE", "ICT", "IT, Digital services", "English, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-RWA-0012", "City of Kigali", "https://www.kigalicity.gov.rw", "RWA", "Rwanda", "Africa-East", "Municipal/Local Government", "City Government", "Construction, Services, IT", "English, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # BURUNDI
    create_entry("AFE-BDI-0001", "ARMP Burundi", "https://www.armp.bi", "BDI", "Burundi", "Africa-East", "National Government Portal", "Procurement Regulator", "All sectors", "French, Kirundi", "Weekly", "Free Registration", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-BDI-0002", "Ministry of Finance Burundi", "https://www.finances.gov.bi", "BDI", "Burundi", "Africa-East", "Federal Ministry", "Finance", "Financial services, Consulting", "French, Kirundi", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-BDI-0003", "REGIDESO Burundi (Electricity & Water)", "https://www.regideso.bi", "BDI", "Burundi", "Africa-East", "Public Utility", "Electricity and Water", "Power, Water, Engineering", "French, Kirundi", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-BDI-0004", "University of Burundi", "https://www.ub.edu.bi", "BDI", "Burundi", "Africa-East", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "French, Kirundi", "Monthly", "No", "No", "HTML, PDF", "Very Low (<20)"),

    # SOUTH SUDAN
    create_entry("AFE-SSD-0001", "South Sudan Public Procurement Authority", "https://www.procurement.gov.ss", "SSD", "South Sudan", "Africa-East", "National Government Portal", "Procurement Regulator", "All sectors", "English, Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-SSD-0002", "Ministry of Finance South Sudan", "https://www.mof.gov.ss", "SSD", "South Sudan", "Africa-East", "Federal Ministry", "Finance", "Financial services, Consulting", "English, Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # DJIBOUTI
    create_entry("AFE-DJI-0001", "Commission Nationale des Marches Publics Djibouti", "https://www.cnmp.dj", "DJI", "Djibouti", "Africa-East", "National Government Portal", "Central Procurement", "All sectors", "French, Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-DJI-0002", "Port de Djibouti", "https://www.portdedjibouti.com", "DJI", "Djibouti", "Africa-East", "Parastatal/SOE", "Ports", "Maritime, Construction, Equipment", "French, Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-DJI-0003", "EDD (Electricite de Djibouti)", "https://www.edd.dj", "DJI", "Djibouti", "Africa-East", "Public Utility", "Electricity", "Power, Engineering, Equipment", "French, Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # ERITREA
    create_entry("AFE-ERI-0001", "Ministry of Finance Eritrea", "https://www.mof.gov.er", "ERI", "Eritrea", "Africa-East", "Federal Ministry", "Finance", "All sectors", "English, Arabic, Tigrinya", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # SOMALIA
    create_entry("AFE-SOM-0001", "Federal Government of Somalia Procurement", "https://www.mof.gov.so", "SOM", "Somalia", "Africa-East", "Federal Ministry", "Finance", "All sectors", "English, Somali, Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-SOM-0002", "Somali Electricity Company", "https://www.beco.so", "SOM", "Somalia", "Africa-East", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English, Somali", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # COMOROS
    create_entry("AFE-COM-0001", "Direction Nationale des Marches Publics Comores", "https://www.marchespublics.km", "COM", "Comoros", "Africa-East", "National Government Portal", "Central Procurement", "All sectors", "French, Arabic", "Monthly", "No", "No", "HTML, PDF", "Very Low (<20)"),

    # SEYCHELLES
    create_entry("AFE-SYC-0001", "Seychelles Procurement Oversight Unit", "https://www.pou.gov.sc", "SYC", "Seychelles", "Africa-East", "National Government Portal", "Procurement Regulator", "All sectors", "English, French", "Weekly", "Free Registration", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-SYC-0002", "Public Utilities Corporation Seychelles", "https://www.puc.sc", "SYC", "Seychelles", "Africa-East", "Public Utility", "Electricity and Water", "Power, Water, Engineering", "English, French", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # MAURITIUS
    create_entry("AFE-MUS-0001", "Central Procurement Board Mauritius", "https://www.publicprocurement.govmu.org", "MUS", "Mauritius", "Africa-East", "National Government Portal", "Procurement Regulator", "All sectors", "English, French", "Daily", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-MUS-0002", "e-Procurement System Mauritius", "https://eproc.publicprocurement.govmu.org", "MUS", "Mauritius", "Africa-East", "National Government Portal", "E-Procurement", "All sectors", "English, French", "Daily", "Free Registration", "Yes", "HTML, XML", "Medium (100-500)"),
    create_entry("AFE-MUS-0003", "Central Electricity Board Mauritius", "https://www.ceb.mu", "MUS", "Mauritius", "Africa-East", "Public Utility", "Electricity", "Power, Engineering, Equipment", "English, French", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-MUS-0004", "Central Water Authority Mauritius", "https://www.cwa.mu", "MUS", "Mauritius", "Africa-East", "Public Utility", "Water", "Water, Engineering, Construction", "English, French", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-MUS-0005", "Bank of Mauritius", "https://www.bom.mu", "MUS", "Mauritius", "Africa-East", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "English, French", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-MUS-0006", "University of Mauritius", "https://www.uom.ac.mu", "MUS", "Mauritius", "Africa-East", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English, French", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-MUS-0007", "Mauritius Ports Authority", "https://www.mauport.com", "MUS", "Mauritius", "Africa-East", "Parastatal/SOE", "Ports", "Maritime, Construction, Equipment", "English, French", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # MADAGASCAR
    create_entry("AFE-MDG-0001", "ARMP Madagascar", "https://www.armp.mg", "MDG", "Madagascar", "Africa-East", "National Government Portal", "Procurement Regulator", "All sectors", "French, Malagasy", "Daily", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-MDG-0002", "Portail des Marches Publics Madagascar", "https://www.marchespublics.gov.mg", "MDG", "Madagascar", "Africa-East", "National Government Portal", "E-Procurement", "All sectors", "French, Malagasy", "Daily", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-MDG-0003", "JIRAMA (Electricity & Water)", "https://www.jirama.mg", "MDG", "Madagascar", "Africa-East", "Public Utility", "Electricity and Water", "Power, Water, Engineering", "French, Malagasy", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-MDG-0004", "Port de Toamasina", "https://www.port-toamasina.com", "MDG", "Madagascar", "Africa-East", "Parastatal/SOE", "Ports", "Maritime, Construction, Equipment", "French, Malagasy", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-MDG-0005", "Banque Centrale de Madagascar", "https://www.banky-foibe.mg", "MDG", "Madagascar", "Africa-East", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "French, Malagasy", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-MDG-0006", "Universite d'Antananarivo", "https://www.univ-antananarivo.mg", "MDG", "Madagascar", "Africa-East", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "French, Malagasy", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
]

if __name__ == "__main__":
    print(f"East Africa entries: {len(africa_east)}")
    with open("/sessions/peaceful-zen-gauss/tender_db/africa_east.json", "w") as f:
        json.dump(africa_east, f, indent=2)
    print("Saved africa_east.json")
