#!/usr/bin/env python3
"""
Tender Intelligence Database - Africa North Region
Egypt, Morocco, Tunisia, Algeria, Libya, Sudan
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

africa_north = [
    # EGYPT
    create_entry("AFN-EGY-0001", "Egypt Tenders Portal", "https://www.etenders.gov.eg", "EGY", "Egypt", "Africa-North", "National Government Portal", "E-Procurement", "All sectors", "Arabic, English", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Main e-procurement portal"),
    create_entry("AFN-EGY-0002", "General Authority for Government Services", "https://www.gags.gov.eg", "EGY", "Egypt", "Africa-North", "National Government Portal", "Central Procurement", "All sectors", "Arabic, English", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFN-EGY-0003", "Ministry of Finance Egypt", "https://www.mof.gov.eg", "EGY", "Egypt", "Africa-North", "Federal Ministry", "Finance", "Financial services, Consulting", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-EGY-0004", "Ministry of Health Egypt", "https://www.mohp.gov.eg", "EGY", "Egypt", "Africa-North", "Federal Ministry", "Health", "Medical supplies, Pharmaceuticals", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFN-EGY-0005", "Ministry of Transport Egypt", "https://www.mot.gov.eg", "EGY", "Egypt", "Africa-North", "Federal Ministry", "Transport", "Transport, Construction", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-EGY-0006", "General Authority for Roads and Bridges", "https://www.garbridges.gov.eg", "EGY", "Egypt", "Africa-North", "Infrastructure Authority", "Roads", "Construction, Engineering", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFN-EGY-0007", "Egyptian Electricity Holding Company", "https://www.eehc.gov.eg", "EGY", "Egypt", "Africa-North", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFN-EGY-0008", "Holding Company for Water and Wastewater", "https://www.hcww.com.eg", "EGY", "Egypt", "Africa-North", "Public Utility", "Water", "Water, Engineering, Construction", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-EGY-0009", "Suez Canal Authority", "https://www.suezcanal.gov.eg", "EGY", "Egypt", "Africa-North", "Parastatal/SOE", "Maritime", "Maritime, Construction, Equipment", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-EGY-0010", "Alexandria Port Authority", "https://www.apa.gov.eg", "EGY", "Egypt", "Africa-North", "Parastatal/SOE", "Ports", "Maritime, Construction, Equipment", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0011", "Egyptian National Railways", "https://www.enr.gov.eg", "EGY", "Egypt", "Africa-North", "Parastatal/SOE", "Railways", "Rail, Construction, Rolling stock", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-EGY-0012", "Cairo Metro", "https://www.cairometro.gov.eg", "EGY", "Egypt", "Africa-North", "Parastatal/SOE", "Metro", "Rail, Construction, Engineering", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0013", "Egyptian General Petroleum Corporation (EGPC)", "https://www.egpc.com.eg", "EGY", "Egypt", "Africa-North", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFN-EGY-0014", "Telecom Egypt", "https://www.te.eg", "EGY", "Egypt", "Africa-North", "Public Utility", "Telecommunications", "IT, Telecommunications", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-EGY-0015", "Central Bank of Egypt", "https://www.cbe.org.eg", "EGY", "Egypt", "Africa-North", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Arabic, English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-EGY-0016", "Cairo University", "https://cu.edu.eg", "EGY", "Egypt", "Africa-North", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Arabic, English", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0017", "Alexandria University", "https://www.alexu.edu.eg", "EGY", "Egypt", "Africa-North", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Arabic, English", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0018", "Ain Shams University", "https://www.asu.edu.eg", "EGY", "Egypt", "Africa-North", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Arabic, English", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-EGY-0019", "New Administrative Capital Company", "https://www.acud.eg", "EGY", "Egypt", "Africa-North", "Parastatal/SOE", "Urban Development", "Construction, Infrastructure, IT", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)", "Major new capital project"),
    create_entry("AFN-EGY-0020", "Cairo Governorate", "https://www.cairo.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-EGY-0021", "Alexandria Governorate", "https://www.alexandria.gov.eg", "EGY", "Egypt", "Africa-North", "State/Provincial Government", "Governorate", "All sectors", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # MOROCCO
    create_entry("AFN-MAR-0001", "Portail Marocain des Marches Publics", "https://www.marchespublics.gov.ma", "MAR", "Morocco", "Africa-North", "National Government Portal", "E-Procurement", "All sectors", "Arabic, French", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Main e-procurement portal"),
    create_entry("AFN-MAR-0002", "Tresorerie Generale du Royaume", "https://www.tgr.gov.ma", "MAR", "Morocco", "Africa-North", "Federal Ministry", "Finance", "Financial services, Consulting", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-MAR-0003", "Ministere de la Sante Maroc", "https://www.sante.gov.ma", "MAR", "Morocco", "Africa-North", "Federal Ministry", "Health", "Medical supplies, Pharmaceuticals", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-MAR-0004", "Ministere de l'Equipement et de l'Eau", "https://www.equipement.gov.ma", "MAR", "Morocco", "Africa-North", "Federal Ministry", "Infrastructure", "Construction, Engineering, Water", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFN-MAR-0005", "Office National de l'Electricite et de l'Eau (ONEE)", "https://www.onee.ma", "MAR", "Morocco", "Africa-North", "Public Utility", "Electricity and Water", "Power, Water, Engineering", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFN-MAR-0006", "Office National des Chemins de Fer (ONCF)", "https://www.oncf.ma", "MAR", "Morocco", "Africa-North", "Parastatal/SOE", "Railways", "Rail, Construction, Rolling stock", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-MAR-0007", "Autoroutes du Maroc", "https://www.adm.co.ma", "MAR", "Morocco", "Africa-North", "Parastatal/SOE", "Highways", "Construction, Engineering", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-MAR-0008", "Agence Nationale des Ports (ANP)", "https://www.anp.org.ma", "MAR", "Morocco", "Africa-North", "Parastatal/SOE", "Ports", "Maritime, Construction, Equipment", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-MAR-0009", "Tanger Med Port Authority", "https://www.tangermed.ma", "MAR", "Morocco", "Africa-North", "Parastatal/SOE", "Ports", "Maritime, Construction, Logistics", "Arabic, French, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-MAR-0010", "Office Cherifien des Phosphates (OCP)", "https://www.ocpgroup.ma", "MAR", "Morocco", "Africa-North", "Parastatal/SOE", "Mining", "Mining, Engineering, Construction", "Arabic, French, English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)", "Major phosphate company"),
    create_entry("AFN-MAR-0011", "Maroc Telecom", "https://www.iam.ma", "MAR", "Morocco", "Africa-North", "Public Utility", "Telecommunications", "IT, Telecommunications", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-MAR-0012", "Royal Air Maroc", "https://www.royalairmaroc.com", "MAR", "Morocco", "Africa-North", "Parastatal/SOE", "Aviation", "Aviation, IT, Services", "Arabic, French, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-MAR-0013", "Bank Al-Maghrib", "https://www.bkam.ma", "MAR", "Morocco", "Africa-North", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Arabic, French", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-MAR-0014", "Universite Mohammed V Rabat", "https://www.um5.ac.ma", "MAR", "Morocco", "Africa-North", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Arabic, French", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-MAR-0015", "Casablanca City", "https://www.casablanca.ma", "MAR", "Morocco", "Africa-North", "Municipal/Local Government", "City Government", "Construction, Services, IT", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-MAR-0016", "Region Casablanca-Settat", "https://www.casablancasettat.ma", "MAR", "Morocco", "Africa-North", "State/Provincial Government", "Regional Government", "All sectors", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),

    # TUNISIA
    create_entry("AFN-TUN-0001", "TUNEPS (Tunisia e-Procurement)", "https://www.tuneps.tn", "TUN", "Tunisia", "Africa-North", "National Government Portal", "E-Procurement", "All sectors", "Arabic, French", "Daily", "Free Registration", "Yes", "HTML, XML", "High (500-2000)", "Main e-procurement portal"),
    create_entry("AFN-TUN-0002", "Haute Instance de la Commande Publique", "https://www.haicop.gov.tn", "TUN", "Tunisia", "Africa-North", "National Government Portal", "Procurement Regulator", "All sectors", "Arabic, French", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-TUN-0003", "Ministere des Finances Tunisie", "https://www.finances.gov.tn", "TUN", "Tunisia", "Africa-North", "Federal Ministry", "Finance", "Financial services, Consulting", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-TUN-0004", "STEG (Electricity & Gas)", "https://www.steg.com.tn", "TUN", "Tunisia", "Africa-North", "Public Utility", "Electricity and Gas", "Power, Gas, Engineering", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-TUN-0005", "SONEDE (Water)", "https://www.sonede.com.tn", "TUN", "Tunisia", "Africa-North", "Public Utility", "Water", "Water, Engineering, Construction", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-TUN-0006", "Office des Ports Nationaux Tunisiens", "https://www.ommp.nat.tn", "TUN", "Tunisia", "Africa-North", "Parastatal/SOE", "Ports", "Maritime, Construction, Equipment", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-TUN-0007", "SNCFT (Railways)", "https://www.sncft.com.tn", "TUN", "Tunisia", "Africa-North", "Parastatal/SOE", "Railways", "Rail, Construction, Rolling stock", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-TUN-0008", "ETAP (Oil)", "https://www.etap.com.tn", "TUN", "Tunisia", "Africa-North", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-TUN-0009", "Tunisie Telecom", "https://www.tunisietelecom.tn", "TUN", "Tunisia", "Africa-North", "Public Utility", "Telecommunications", "IT, Telecommunications", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-TUN-0010", "Banque Centrale de Tunisie", "https://www.bct.gov.tn", "TUN", "Tunisia", "Africa-North", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Arabic, French", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-TUN-0011", "Universite de Tunis", "https://www.utunis.rnu.tn", "TUN", "Tunisia", "Africa-North", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Arabic, French", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-TUN-0012", "Municipalite de Tunis", "https://www.commune-tunis.gov.tn", "TUN", "Tunisia", "Africa-North", "Municipal/Local Government", "City Government", "Construction, Services, IT", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # ALGERIA
    create_entry("AFN-DZA-0001", "BOMOP (Bulletin Officiel des Marches)", "https://www.bomop.dz", "DZA", "Algeria", "Africa-North", "National Government Portal", "Official Gazette", "All sectors", "Arabic, French", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)", "Official tender bulletin"),
    create_entry("AFN-DZA-0002", "ARMP Algerie", "https://www.armp.gov.dz", "DZA", "Algeria", "Africa-North", "National Government Portal", "Procurement Regulator", "All sectors", "Arabic, French", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFN-DZA-0003", "Ministere des Finances Algerie", "https://www.mf.gov.dz", "DZA", "Algeria", "Africa-North", "Federal Ministry", "Finance", "Financial services, Consulting", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-DZA-0004", "Sonatrach", "https://www.sonatrach.com", "DZA", "Algeria", "Africa-North", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Arabic, French, English", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)", "Major oil/gas company"),
    create_entry("AFN-DZA-0005", "Sonelgaz (Electricity & Gas)", "https://www.sonelgaz.dz", "DZA", "Algeria", "Africa-North", "Public Utility", "Electricity and Gas", "Power, Gas, Engineering", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFN-DZA-0006", "Algerie Telecom", "https://www.algerietelecom.dz", "DZA", "Algeria", "Africa-North", "Public Utility", "Telecommunications", "IT, Telecommunications", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-DZA-0007", "ANESRIF (Railways)", "https://www.anesrif.dz", "DZA", "Algeria", "Africa-North", "Infrastructure Authority", "Railways", "Rail, Construction, Rolling stock", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-DZA-0008", "ANA (Roads)", "https://www.ana.dz", "DZA", "Algeria", "Africa-North", "Infrastructure Authority", "Roads", "Construction, Engineering", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("AFN-DZA-0009", "SEAAL (Algiers Water)", "https://www.seaal.dz", "DZA", "Algeria", "Africa-North", "Public Utility", "Water", "Water, Engineering, Construction", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-DZA-0010", "Air Algerie", "https://www.airalgerie.dz", "DZA", "Algeria", "Africa-North", "Parastatal/SOE", "Aviation", "Aviation, IT, Services", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-DZA-0011", "Entreprise Portuaire d'Alger", "https://www.portalger.com.dz", "DZA", "Algeria", "Africa-North", "Parastatal/SOE", "Ports", "Maritime, Construction, Equipment", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-DZA-0012", "Banque d'Algerie", "https://www.bank-of-algeria.dz", "DZA", "Algeria", "Africa-North", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Arabic, French", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-DZA-0013", "Universite d'Alger", "https://www.univ-alger.dz", "DZA", "Algeria", "Africa-North", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Arabic, French", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-DZA-0014", "Wilaya d'Alger", "https://www.wilaya-alger.dz", "DZA", "Algeria", "Africa-North", "State/Provincial Government", "Provincial Government", "All sectors", "Arabic, French", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),

    # LIBYA
    create_entry("AFN-LBY-0001", "Administrative Control Authority Libya", "https://www.aca.gov.ly", "LBY", "Libya", "Africa-North", "National Government Portal", "Procurement Oversight", "All sectors", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-LBY-0002", "National Oil Corporation Libya", "https://www.noc.ly", "LBY", "Libya", "Africa-North", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("AFN-LBY-0003", "General Electricity Company of Libya (GECOL)", "https://www.gecol.ly", "LBY", "Libya", "Africa-North", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-LBY-0004", "Central Bank of Libya", "https://www.cbl.gov.ly", "LBY", "Libya", "Africa-North", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Arabic, English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # SUDAN
    create_entry("AFN-SDN-0001", "General Administration for Government Contracts", "https://www.contracts.gov.sd", "SDN", "Sudan", "Africa-North", "National Government Portal", "Central Procurement", "All sectors", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-SDN-0002", "Ministry of Finance Sudan", "https://www.mof.gov.sd", "SDN", "Sudan", "Africa-North", "Federal Ministry", "Finance", "Financial services, Consulting", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-SDN-0003", "Sudanese Petroleum Corporation", "https://www.sudapet.sd", "SDN", "Sudan", "Africa-North", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Arabic, English", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-SDN-0004", "Sudanese Electricity Distribution Company", "https://www.sedc.sd", "SDN", "Sudan", "Africa-North", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Arabic", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("AFN-SDN-0005", "Central Bank of Sudan", "https://www.cbos.gov.sd", "SDN", "Sudan", "Africa-North", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Arabic, English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("AFN-SDN-0006", "University of Khartoum", "https://www.uofk.edu.sd", "SDN", "Sudan", "Africa-North", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Arabic, English", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
]

if __name__ == "__main__":
    print(f"North Africa entries: {len(africa_north)}")
    with open("/sessions/peaceful-zen-gauss/tender_db/africa_north.json", "w") as f:
        json.dump(africa_north, f, indent=2)
    print("Saved africa_north.json")
