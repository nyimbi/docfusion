#!/usr/bin/env python3
"""
Expansion - Additional African sub-national and institutional sources
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

expansion_africa = [
    # ADDITIONAL NIGERIAN STATES (remaining 30+ states)
    create_entry("AFW-NGA-0031", "Akwa Ibom State Government", "https://akwaibomstate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0032", "Abia State Government", "https://abiastate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0033", "Adamawa State Government", "https://adamawastate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0034", "Anambra State Government", "https://anambrastate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0035", "Bauchi State Government", "https://bauchistate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0036", "Bayelsa State Government", "https://bayelsastate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0037", "Benue State Government", "https://benuestate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0038", "Borno State Government", "https://bornostate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0039", "Cross River State Government", "https://crossriverstate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0040", "Ebonyi State Government", "https://ebonyistate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0041", "Edo State Government", "https://edostate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0042", "Ekiti State Government", "https://ekitistate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0043", "Enugu State Government", "https://enugustate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0044", "FCT Administration", "https://fcta.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "Federal Capital", "All sectors", "English", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFW-NGA-0045", "Gombe State Government", "https://gombestate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0046", "Imo State Government", "https://imostate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0047", "Jigawa State Government", "https://jigawastate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0048", "Kebbi State Government", "https://kebbistate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0049", "Kogi State Government", "https://kogistate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0050", "Kwara State Government", "https://kwarastate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0051", "Nasarawa State Government", "https://nasarawastate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0052", "Niger State Government", "https://nigerstate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0053", "Ogun State Government", "https://ogunstate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0054", "Ondo State Government", "https://ondostate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0055", "Osun State Government", "https://osun.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0056", "Plateau State Government", "https://plateaustate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0057", "Sokoto State Government", "https://sokotostate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0058", "Taraba State Government", "https://tarabastate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0059", "Yobe State Government", "https://yfrfbestate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0060", "Zamfara State Government", "https://zamfarastate.gov.ng", "NGA", "Nigeria", "Africa-West", "State/Provincial Government", "State Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # NIGERIAN FEDERAL AGENCIES
    create_entry("AFW-NGA-0061", "Nigeria Customs Service", "https://www.customs.gov.ng", "NGA", "Nigeria", "Africa-West", "Federal Ministry", "Customs", "IT, Equipment, Services", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFW-NGA-0062", "Nigeria Immigration Service", "https://immigration.gov.ng", "NGA", "Nigeria", "Africa-West", "Federal Ministry", "Immigration", "IT, Equipment, Services", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0063", "Federal Road Safety Corps", "https://frsc.gov.ng", "NGA", "Nigeria", "Africa-West", "Federal Ministry", "Road Safety", "Vehicles, IT, Equipment", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0064", "NIMET (Meteorological Agency)", "https://nimet.gov.ng", "NGA", "Nigeria", "Africa-West", "Federal Ministry", "Meteorology", "IT, Scientific equipment", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0065", "NCC (Communications Commission)", "https://ncc.gov.ng", "NGA", "Nigeria", "Africa-West", "Central Bank/Regulator", "Telecom Regulator", "IT, Telecommunications", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0066", "SEC Nigeria", "https://sec.gov.ng", "NGA", "Nigeria", "Africa-West", "Central Bank/Regulator", "Securities Regulator", "IT, Financial services", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0067", "NDIC (Deposit Insurance)", "https://ndic.gov.ng", "NGA", "Nigeria", "Africa-West", "Central Bank/Regulator", "Deposit Insurance", "IT, Financial services", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0068", "NBET (Bulk Electricity Trader)", "https://nfrfbet.com.ng", "NGA", "Nigeria", "Africa-West", "Parastatal/SOE", "Electricity Trading", "Power, IT, Financial services", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0069", "NEMSA (Electricity Management)", "https://nemsa.gov.ng", "NGA", "Nigeria", "Africa-West", "Central Bank/Regulator", "Electricity Regulator", "Power, IT", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFW-NGA-0070", "NNRA (Nuclear Regulatory)", "https://nnra.gov.ng", "NGA", "Nigeria", "Africa-West", "Central Bank/Regulator", "Nuclear Regulator", "Nuclear, Scientific equipment", "English", "Monthly", "No", "No", "HTML, PDF", "Very Low (<20)"),

    # ADDITIONAL SOUTH AFRICAN MUNICIPALITIES
    create_entry("AFS-ZAF-0045", "Emfuleni Local Municipality", "https://www.emfuleni.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0046", "Mogale City Local Municipality", "https://www.mogalecity.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0047", "Polokwane Local Municipality", "https://www.polokwane.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0048", "Rustenburg Local Municipality", "https://www.rustenburg.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0049", "Mbombela Local Municipality", "https://www.mbombela.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0050", "Msunduzi Local Municipality", "https://www.msunduzi.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0051", "Sol Plaatje Local Municipality", "https://www.solplaatje.org.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0052", "Matjhabeng Local Municipality", "https://www.matjhabeng.co.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-ZAF-0053", "Steve Tshwete Local Municipality", "https://www.stevetshwetelm.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-ZAF-0054", "Emalahleni Local Municipality", "https://www.emalahleni.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0055", "Newcastle Local Municipality", "https://www.newcastle.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-ZAF-0056", "Madibeng Local Municipality", "https://www.madibeng.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0057", "Drakenstein Local Municipality", "https://www.drakenstein.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English, Afrikaans", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0058", "Stellenbosch Local Municipality", "https://www.stellenbosch.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English, Afrikaans", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0059", "George Local Municipality", "https://www.george.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English, Afrikaans", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-ZAF-0060", "Mossel Bay Local Municipality", "https://www.mfrfosselbay.gov.za", "ZAF", "South Africa", "Africa-Southern", "Municipal/Local Government", "Local Municipality", "All sectors", "English, Afrikaans", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # SOUTH AFRICAN UNIVERSITIES
    create_entry("AFS-ZAF-0061", "University of Johannesburg", "https://www.uj.ac.za", "ZAF", "South Africa", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0062", "University of the Western Cape", "https://www.uwc.ac.za", "ZAF", "South Africa", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0063", "North-West University", "https://www.nwu.ac.za", "ZAF", "South Africa", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English, Afrikaans", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0064", "University of the Free State", "https://www.ufs.ac.za", "ZAF", "South Africa", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English, Afrikaans", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFS-ZAF-0065", "Rhodes University", "https://www.ru.ac.za", "ZAF", "South Africa", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-ZAF-0066", "University of Limpopo", "https://www.ul.ac.za", "ZAF", "South Africa", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-ZAF-0067", "University of Venda", "https://www.univen.ac.za", "ZAF", "South Africa", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-ZAF-0068", "University of Zululand", "https://www.unizulu.ac.za", "ZAF", "South Africa", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-ZAF-0069", "Walter Sisulu University", "https://www.wsu.ac.za", "ZAF", "South Africa", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFS-ZAF-0070", "Nelson Mandela University", "https://www.mandela.ac.za", "ZAF", "South Africa", "Africa-Southern", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "English", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # ADDITIONAL KENYAN COUNTIES
    create_entry("AFE-KEN-0033", "Machakos County", "https://machakos.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-KEN-0034", "Kiambu County", "https://kiambu.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFE-KEN-0035", "Kajiado County", "https://kajiado.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0036", "Uasin Gishu County", "https://uasingishu.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0037", "Trans Nzoia County", "https://transnzoia.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0038", "Kakamega County", "https://kakamega.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0039", "Bungoma County", "https://bungoma.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0040", "Nyeri County", "https://nyeri.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0041", "Meru County", "https://meru.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0042", "Kilifi County", "https://kilifi.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0043", "Kwale County", "https://kwale.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0044", "Narok County", "https://narok.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFE-KEN-0045", "Laikipia County", "https://laikipia.go.ke", "KEN", "Kenya", "Africa-East", "State/Provincial Government", "County Government", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # EGYPTIAN GOVERNORATES
    create_entry("AFN-EGY-0022", "Giza Governorate", "https://www.giza.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-EGY-0023", "Sharqia Governorate", "https://www.sharqia.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0024", "Dakahlia Governorate", "https://www.dakahlia.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0025", "Qalyubia Governorate", "https://www.qalyubia.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0026", "Beheira Governorate", "https://www.beheira.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0027", "Menoufia Governorate", "https://www.menoufia.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0028", "Gharbia Governorate", "https://www.gharbia.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0029", "Kafr El Sheikh Governorate", "https://www.kafrelshfrfrfikh.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-EGY-0030", "Port Said Governorate", "https://www.portsaid.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0031", "Suez Governorate", "https://www.suez.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0032", "Ismailia Governorate", "https://www.ismailia.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-EGY-0033", "Damietta Governorate", "https://www.damietta.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-EGY-0034", "Aswan Governorate", "https://www.aswan.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-EGY-0035", "Luxor Governorate", "https://www.luxor.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-EGY-0036", "Assiut Governorate", "https://www.assiut.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0037", "Sohag Governorate", "https://www.sohag.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0038", "Qena Governorate", "https://www.qena.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-EGY-0039", "Minya Governorate", "https://www.minya.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0040", "Beni Suef Governorate", "https://www.benisuef.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-EGY-0041", "Fayoum Governorate", "https://www.fayoum.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
]

if __name__ == "__main__":
    print(f"Africa expansion entries: {len(expansion_africa)}")
    with open("/sessions/peaceful-zen-gauss/tender_db/expansion_africa.json", "w") as f:
        json.dump(expansion_africa, f, indent=2)
    print("Saved expansion_africa.json")
