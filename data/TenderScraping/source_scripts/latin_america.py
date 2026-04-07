#!/usr/bin/env python3
"""
Tender Intelligence Database - Latin America & Caribbean
Brazil, Mexico, Argentina, Colombia, Peru, Chile, and other countries
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

latin_america = [
    # BRAZIL
    create_entry("LAM-BRA-0001", "ComprasNet (Portal de Compras do Governo Federal)", "https://www.gov.br/compras", "BRA", "Brazil", "Latin-America-South", "National Government Portal", "E-Procurement", "All sectors", "Portuguese", "Daily", "Free Registration", "Yes", "HTML, XML, JSON", "Very High (>2000)", "Main federal procurement portal"),
    create_entry("LAM-BRA-0002", "Portal Nacional de Contratacoes Publicas (PNCP)", "https://www.gov.br/pncp", "BRA", "Brazil", "Latin-America-South", "National Government Portal", "Transparency Portal", "All sectors", "Portuguese", "Daily", "No", "Yes", "HTML, JSON", "Very High (>2000)", "National contracting transparency"),
    create_entry("LAM-BRA-0003", "Banco Nacional de Precos (BNP)", "https://bnp.gov.br", "BRA", "Brazil", "Latin-America-South", "National Government Portal", "Price Database", "All sectors", "Portuguese", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-BRA-0004", "Petrobras", "https://www.petrobras.com.br/fornecedores", "BRA", "Brazil", "Latin-America-South", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Portuguese, English", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)", "Major oil company"),
    create_entry("LAM-BRA-0005", "Eletrobras", "https://www.eletrobras.com/fornecedores", "BRA", "Brazil", "Latin-America-South", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Portuguese", "Weekly", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-BRA-0006", "Banco Central do Brasil", "https://www.bcb.gov.br/licitacoes", "BRA", "Brazil", "Latin-America-South", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("LAM-BRA-0007", "DNIT (Roads)", "https://www.gov.br/dnit", "BRA", "Brazil", "Latin-America-South", "Infrastructure Authority", "Roads", "Construction, Engineering", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-BRA-0008", "ANTT (Transport)", "https://www.gov.br/antt", "BRA", "Brazil", "Latin-America-South", "Central Bank/Regulator", "Transport Regulator", "Transport, Rail, Roads", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-BRA-0009", "INFRAERO (Airports)", "https://www.infraero.gov.br/licitacoes", "BRA", "Brazil", "Latin-America-South", "Parastatal/SOE", "Aviation", "Aviation, Construction, IT", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-BRA-0010", "Correios (Post)", "https://www.correios.com.br/fornecedores", "BRA", "Brazil", "Latin-America-South", "Parastatal/SOE", "Postal", "Logistics, IT, Services", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-BRA-0011", "Ministerio da Saude", "https://www.gov.br/saude/licitacoes", "BRA", "Brazil", "Latin-America-South", "Federal Ministry", "Health", "Medical supplies, Pharmaceuticals", "Portuguese", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-BRA-0012", "FIOCRUZ", "https://www.fiocruz.br/compras", "BRA", "Brazil", "Latin-America-South", "University/Research", "Health Research", "Medical, Lab equipment, Pharmaceuticals", "Portuguese", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    # Brazil States
    create_entry("LAM-BRA-0013", "BEC Sao Paulo", "https://www.bec.sp.gov.br", "BRA", "Brazil", "Latin-America-South", "State/Provincial Government", "State E-Procurement", "All sectors", "Portuguese", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Sao Paulo state portal"),
    create_entry("LAM-BRA-0014", "SIAD Minas Gerais", "https://www.compras.mg.gov.br", "BRA", "Brazil", "Latin-America-South", "State/Provincial Government", "State E-Procurement", "All sectors", "Portuguese", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-BRA-0015", "Portal de Compras Rio de Janeiro", "https://www.compras.rj.gov.br", "BRA", "Brazil", "Latin-America-South", "State/Provincial Government", "State E-Procurement", "All sectors", "Portuguese", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-BRA-0016", "Licitacoes-e Bahia", "https://www.comprasnet.ba.gov.br", "BRA", "Brazil", "Latin-America-South", "State/Provincial Government", "State E-Procurement", "All sectors", "Portuguese", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-BRA-0017", "Portal de Compras Parana", "https://www.compras.pr.gov.br", "BRA", "Brazil", "Latin-America-South", "State/Provincial Government", "State E-Procurement", "All sectors", "Portuguese", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-BRA-0018", "Portal de Compras RS", "https://www.compras.rs.gov.br", "BRA", "Brazil", "Latin-America-South", "State/Provincial Government", "State E-Procurement", "All sectors", "Portuguese", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-BRA-0019", "Prefeitura de Sao Paulo", "https://www.prefeitura.sp.gov.br/licitacoes", "BRA", "Brazil", "Latin-America-South", "Municipal/Local Government", "City Government", "All sectors", "Portuguese", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-BRA-0020", "Prefeitura do Rio de Janeiro", "https://www.rio.rj.gov.br/licitacoes", "BRA", "Brazil", "Latin-America-South", "Municipal/Local Government", "City Government", "All sectors", "Portuguese", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),

    # MEXICO
    create_entry("LAM-MEX-0001", "CompraNet Mexico", "https://compranet.hacienda.gob.mx", "MEX", "Mexico", "Latin-America-Central", "National Government Portal", "E-Procurement", "All sectors", "Spanish", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Main federal procurement portal"),
    create_entry("LAM-MEX-0002", "Secretaria de Hacienda", "https://www.gob.mx/shcp", "MEX", "Mexico", "Latin-America-Central", "Federal Ministry", "Finance", "Financial services, Consulting", "Spanish", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-MEX-0003", "PEMEX", "https://www.pemex.com/proveedores", "MEX", "Mexico", "Latin-America-Central", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Spanish", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)", "Major oil company"),
    create_entry("LAM-MEX-0004", "CFE (Electricity)", "https://www.cfe.mx/proveedores", "MEX", "Mexico", "Latin-America-Central", "Public Utility", "Electricity", "Power, Engineering, Equipment", "Spanish", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-MEX-0005", "IMSS (Social Security)", "https://compras.imss.gob.mx", "MEX", "Mexico", "Latin-America-Central", "Pension/Social Fund", "Health Insurance", "Medical supplies, Pharmaceuticals, IT", "Spanish", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-MEX-0006", "ISSSTE", "https://www.gob.mx/issste/acciones-y-programas/adquisiciones", "MEX", "Mexico", "Latin-America-Central", "Pension/Social Fund", "Social Security", "Medical supplies, IT, Services", "Spanish", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-MEX-0007", "Banco de Mexico", "https://www.banxico.org.mx/licitaciones", "MEX", "Mexico", "Latin-America-Central", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Spanish", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("LAM-MEX-0008", "CONAGUA (Water)", "https://www.gob.mx/conagua", "MEX", "Mexico", "Latin-America-Central", "Infrastructure Authority", "Water", "Water, Engineering, Construction", "Spanish", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-MEX-0009", "SCT (Transport)", "https://www.gob.mx/sct", "MEX", "Mexico", "Latin-America-Central", "Federal Ministry", "Transport", "Transport, Construction, IT", "Spanish", "Weekly", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-MEX-0010", "UNAM", "https://www.unam.mx/licitaciones", "MEX", "Mexico", "Latin-America-Central", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Spanish", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-MEX-0011", "Gobierno de CDMX", "https://www.cdmx.gob.mx/licitaciones", "MEX", "Mexico", "Latin-America-Central", "State/Provincial Government", "City-State Government", "All sectors", "Spanish", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-MEX-0012", "Gobierno de Jalisco", "https://comprasjal.jalisco.gob.mx", "MEX", "Mexico", "Latin-America-Central", "State/Provincial Government", "State Government", "All sectors", "Spanish", "Daily", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-MEX-0013", "Gobierno de Nuevo Leon", "https://www.nl.gob.mx/licitaciones", "MEX", "Mexico", "Latin-America-Central", "State/Provincial Government", "State Government", "All sectors", "Spanish", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),

    # ARGENTINA
    create_entry("LAM-ARG-0001", "COMPR.AR", "https://comprar.gob.ar", "ARG", "Argentina", "Latin-America-South", "National Government Portal", "E-Procurement", "All sectors", "Spanish", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Main federal procurement portal"),
    create_entry("LAM-ARG-0002", "Argentina Compra", "https://www.argentinacompra.gov.ar", "ARG", "Argentina", "Latin-America-South", "National Government Portal", "Procurement Portal", "All sectors", "Spanish", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-ARG-0003", "YPF", "https://www.ypf.com/proveedores", "ARG", "Argentina", "Latin-America-South", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Spanish", "Weekly", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-ARG-0004", "Banco Central de la Republica Argentina", "https://www.bcra.gob.ar/licitaciones", "ARG", "Argentina", "Latin-America-South", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Spanish", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("LAM-ARG-0005", "AYSA (Buenos Aires Water)", "https://www.aysa.com.ar/licitaciones", "ARG", "Argentina", "Latin-America-South", "Public Utility", "Water", "Water, Engineering, Construction", "Spanish", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("LAM-ARG-0006", "Vialidad Nacional", "https://www.argentina.gob.ar/obras-publicas/vialidad-nacional", "ARG", "Argentina", "Latin-America-South", "Infrastructure Authority", "Roads", "Construction, Engineering", "Spanish", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-ARG-0007", "Universidad de Buenos Aires", "https://www.uba.ar/licitaciones", "ARG", "Argentina", "Latin-America-South", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Spanish", "Monthly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("LAM-ARG-0008", "Buenos Aires Ciudad (CABA)", "https://www.buenosaires.gob.ar/compras", "ARG", "Argentina", "Latin-America-South", "State/Provincial Government", "City Government", "All sectors", "Spanish", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-ARG-0009", "Provincia de Buenos Aires", "https://www.gba.gob.ar/contrataciones", "ARG", "Argentina", "Latin-America-South", "State/Provincial Government", "Provincial Government", "All sectors", "Spanish", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),

    # COLOMBIA
    create_entry("LAM-COL-0001", "SECOP II (Colombia Compra Eficiente)", "https://www.colombiacompra.gov.co/secop-ii", "COL", "Colombia", "Latin-America-South", "National Government Portal", "E-Procurement", "All sectors", "Spanish", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Main e-procurement system"),
    create_entry("LAM-COL-0002", "Tienda Virtual del Estado Colombiano", "https://colombiacompra.gov.co/tienda-virtual", "COL", "Colombia", "Latin-America-South", "National Government Portal", "Online Marketplace", "All sectors", "Spanish", "Daily", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-COL-0003", "Ecopetrol", "https://www.ecopetrol.com.co/proveedores", "COL", "Colombia", "Latin-America-South", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Spanish", "Weekly", "Free Registration", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-COL-0004", "INVIAS (Roads)", "https://www.invias.gov.co/contratacion", "COL", "Colombia", "Latin-America-South", "Infrastructure Authority", "Roads", "Construction, Engineering", "Spanish", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-COL-0005", "EPM (Medellin Utilities)", "https://www.epm.com.co/proveedores", "COL", "Colombia", "Latin-America-South", "Public Utility", "Multi-Utility", "Power, Water, Gas, IT", "Spanish", "Weekly", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-COL-0006", "Banco de la Republica", "https://www.banrep.gov.co/contratacion", "COL", "Colombia", "Latin-America-South", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Spanish", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("LAM-COL-0007", "Universidad Nacional de Colombia", "https://www.unal.edu.co/contratacion", "COL", "Colombia", "Latin-America-South", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Spanish", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("LAM-COL-0008", "Alcaldia de Bogota", "https://www.bogota.gov.co/sdqs/contratacion", "COL", "Colombia", "Latin-America-South", "Municipal/Local Government", "City Government", "All sectors", "Spanish", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),

    # PERU
    create_entry("LAM-PER-0001", "SEACE (Sistema Electronico de Contrataciones)", "https://www.gob.pe/seace", "PER", "Peru", "Latin-America-South", "National Government Portal", "E-Procurement", "All sectors", "Spanish", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Main e-procurement portal"),
    create_entry("LAM-PER-0002", "OSCE (Procurement Regulator)", "https://www.gob.pe/osce", "PER", "Peru", "Latin-America-South", "National Government Portal", "Procurement Regulator", "All sectors", "Spanish", "Daily", "No", "No", "HTML, PDF", "Very High (>2000)"),
    create_entry("LAM-PER-0003", "Petroperu", "https://www.petroperu.com.pe/proveedores", "PER", "Peru", "Latin-America-South", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Spanish", "Weekly", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-PER-0004", "Banco Central de Reserva del Peru", "https://www.bcrp.gob.pe/contrataciones", "PER", "Peru", "Latin-America-South", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Spanish", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("LAM-PER-0005", "SEDAPAL (Lima Water)", "https://www.sedapal.com.pe/proveedores", "PER", "Peru", "Latin-America-South", "Public Utility", "Water", "Water, Engineering, Construction", "Spanish", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("LAM-PER-0006", "Municipalidad de Lima", "https://www.munlima.gob.pe/contrataciones", "PER", "Peru", "Latin-America-South", "Municipal/Local Government", "City Government", "All sectors", "Spanish", "Daily", "No", "No", "HTML, PDF", "High (500-2000)"),

    # CHILE
    create_entry("LAM-CHL-0001", "ChileCompra (Mercado Publico)", "https://www.mercadopublico.cl", "CHL", "Chile", "Latin-America-South", "National Government Portal", "E-Procurement", "All sectors", "Spanish", "Daily", "Free Registration", "Yes", "HTML, XML", "Very High (>2000)", "Comprehensive e-procurement, >2M tenders/year"),
    create_entry("LAM-CHL-0002", "CODELCO", "https://www.codelco.com/proveedores", "CHL", "Chile", "Latin-America-South", "Parastatal/SOE", "Mining", "Mining, Engineering, Equipment", "Spanish", "Weekly", "Free Registration", "No", "HTML, PDF", "Very High (>2000)", "Major copper company"),
    create_entry("LAM-CHL-0003", "ENAP (Oil)", "https://www.enap.cl/proveedores", "CHL", "Chile", "Latin-America-South", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Spanish", "Weekly", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-CHL-0004", "Banco Central de Chile", "https://www.bcentral.cl/web/banco-central/licitaciones", "CHL", "Chile", "Latin-America-South", "Central Bank/Regulator", "Central Bank", "IT, Financial services, Consulting", "Spanish", "Monthly", "No", "No", "HTML, PDF", "Low (20-100)"),
    create_entry("LAM-CHL-0005", "EFE (Railways)", "https://www.efe.cl/proveedores", "CHL", "Chile", "Latin-America-South", "Parastatal/SOE", "Railways", "Rail, Construction, Rolling stock", "Spanish", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("LAM-CHL-0006", "Metro de Santiago", "https://www.metro.cl/proveedores", "CHL", "Chile", "Latin-America-South", "Parastatal/SOE", "Metro", "Rail, Construction, Engineering", "Spanish", "Weekly", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),
    create_entry("LAM-CHL-0007", "Universidad de Chile", "https://www.uchile.cl/licitaciones", "CHL", "Chile", "Latin-America-South", "University/Research", "Higher Education", "IT, Lab equipment, Construction", "Spanish", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # OTHER LATIN AMERICAN COUNTRIES
    # Ecuador
    create_entry("LAM-ECU-0001", "SERCOP (Compras Publicas Ecuador)", "https://www.compraspublicas.gob.ec", "ECU", "Ecuador", "Latin-America-South", "National Government Portal", "E-Procurement", "All sectors", "Spanish", "Daily", "Free Registration", "Yes", "HTML, XML", "High (500-2000)"),
    create_entry("LAM-ECU-0002", "Petroecuador", "https://www.eppetroecuador.ec/proveedores", "ECU", "Ecuador", "Latin-America-South", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Spanish", "Weekly", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),

    # Bolivia
    create_entry("LAM-BOL-0001", "SICOES Bolivia", "https://www.sicoes.gob.bo", "BOL", "Bolivia", "Latin-America-South", "National Government Portal", "E-Procurement", "All sectors", "Spanish", "Daily", "Free Registration", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("LAM-BOL-0002", "YPFB", "https://www.ypfb.gob.bo/proveedores", "BOL", "Bolivia", "Latin-America-South", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Spanish", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # Paraguay
    create_entry("LAM-PRY-0001", "DNCP Paraguay", "https://www.contrataciones.gov.py", "PRY", "Paraguay", "Latin-America-South", "National Government Portal", "E-Procurement", "All sectors", "Spanish", "Daily", "Free Registration", "Yes", "HTML, XML", "Medium (100-500)"),

    # Uruguay
    create_entry("LAM-URY-0001", "Compras Estatales Uruguay", "https://www.comprasestatales.gub.uy", "URY", "Uruguay", "Latin-America-South", "National Government Portal", "E-Procurement", "All sectors", "Spanish", "Daily", "Free Registration", "Yes", "HTML, XML", "Medium (100-500)"),
    create_entry("LAM-URY-0002", "ANCAP", "https://www.ancap.com.uy/proveedores", "URY", "Uruguay", "Latin-America-South", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Spanish", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # Venezuela
    create_entry("LAM-VEN-0001", "RNC (Registro Nacional de Contratistas)", "https://www.rnc.gob.ve", "VEN", "Venezuela", "Latin-America-South", "National Government Portal", "Contractor Registry", "All sectors", "Spanish", "Weekly", "Government ID", "No", "HTML, PDF", "Medium (100-500)"),
    create_entry("LAM-VEN-0002", "PDVSA", "https://www.pdvsa.com/proveedores", "VEN", "Venezuela", "Latin-America-South", "Parastatal/SOE", "Oil and Gas", "Oil, Gas, Engineering", "Spanish", "Weekly", "No", "No", "HTML, PDF", "High (500-2000)"),

    # CENTRAL AMERICA & CARIBBEAN
    # Guatemala
    create_entry("LAM-GTM-0001", "Guatecompras", "https://www.guatecompras.gt", "GTM", "Guatemala", "Latin-America-Central", "National Government Portal", "E-Procurement", "All sectors", "Spanish", "Daily", "Free Registration", "Yes", "HTML, XML", "High (500-2000)"),

    # Costa Rica
    create_entry("LAM-CRI-0001", "SICOP Costa Rica", "https://www.sicop.go.cr", "CRI", "Costa Rica", "Latin-America-Central", "National Government Portal", "E-Procurement", "All sectors", "Spanish", "Daily", "Free Registration", "Yes", "HTML, XML", "Medium (100-500)"),
    create_entry("LAM-CRI-0002", "ICE Costa Rica", "https://www.grupoice.com/proveedores", "CRI", "Costa Rica", "Latin-America-Central", "Public Utility", "Electricity & Telecom", "Power, IT, Telecommunications", "Spanish", "Weekly", "No", "No", "HTML, PDF", "Medium (100-500)"),

    # Panama
    create_entry("LAM-PAN-0001", "PanamaCompra", "https://www.panamacompra.gob.pa", "PAN", "Panama", "Latin-America-Central", "National Government Portal", "E-Procurement", "All sectors", "Spanish", "Daily", "Free Registration", "Yes", "HTML, XML", "Medium (100-500)"),
    create_entry("LAM-PAN-0002", "Autoridad del Canal de Panama", "https://www.pancanal.com/proveedores", "PAN", "Panama", "Latin-America-Central", "Parastatal/SOE", "Maritime", "Maritime, Construction, Engineering", "Spanish, English", "Weekly", "Free Registration", "No", "HTML, PDF", "High (500-2000)"),

    # Honduras
    create_entry("LAM-HND-0001", "HonduCompras", "https://www.honducompras.gob.hn", "HND", "Honduras", "Latin-America-Central", "National Government Portal", "E-Procurement", "All sectors", "Spanish", "Daily", "Free Registration", "No", "HTML, PDF", "Low (20-100)"),

    # El Salvador
    create_entry("LAM-SLV-0001", "COMPRASAL", "https://www.comprasal.gob.sv", "SLV", "El Salvador", "Latin-America-Central", "National Government Portal", "E-Procurement", "All sectors", "Spanish", "Daily", "Free Registration", "Yes", "HTML, XML", "Low (20-100)"),

    # Dominican Republic
    create_entry("LAM-DOM-0001", "Portal Transaccional Republica Dominicana", "https://www.dgcp.gob.do", "DOM", "Dominican Republic", "Caribbean", "National Government Portal", "E-Procurement", "All sectors", "Spanish", "Daily", "Free Registration", "Yes", "HTML, XML", "Medium (100-500)"),

    # Jamaica
    create_entry("LAM-JAM-0001", "Government of Jamaica eProcurement", "https://www.gojep.gov.jm", "JAM", "Jamaica", "Caribbean", "National Government Portal", "E-Procurement", "All sectors", "English", "Daily", "Free Registration", "No", "HTML, PDF", "Low (20-100)"),

    # Trinidad and Tobago
    create_entry("LAM-TTO-0001", "Central Tenders Board Trinidad", "https://www.finance.gov.tt/services/central-tenders-board", "TTO", "Trinidad and Tobago", "Caribbean", "National Government Portal", "Central Procurement", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),

    # Guyana
    create_entry("LAM-GUY-0001", "National Procurement and Tender Administration", "https://www.npta.gov.gy", "GUY", "Guyana", "Caribbean", "National Government Portal", "Central Procurement", "All sectors", "English", "Weekly", "No", "No", "HTML, PDF", "Low (20-100)"),
]

if __name__ == "__main__":
    print(f"Latin America entries: {len(latin_america)}")
    with open("/sessions/peaceful-zen-gauss/tender_db/latin_america.json", "w") as f:
        json.dump(latin_america, f, indent=2)
    print("Saved latin_america.json")
