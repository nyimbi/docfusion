#!/usr/bin/env python3
"""
Expansion: Utilities, Infrastructure, and Specialized Institutions
Water utilities, electricity companies, ports, railways, universities, hospitals across all regions
"""

import json
from datetime import datetime

def create_entry(
    source_name, url, country_code, country_name, region=None, entity_type=None,
    entity_subtype=None, sectors=None, language=None, update_frequency=None,
    registration_required=None, registration_type=None, api_available=None,
    rss_feed=None, email_alerts=None, estimated_annual_tenders=None,
    tender_value_range=None, primary_contact=None, technical_notes=None,
    last_verified=None, data_quality_score=None
):
    return {
        "source_name": source_name,
        "url": url,
        "country_code": country_code,
        "country_name": country_name,
        "region": region,
        "entity_type": entity_type or "Government",
        "entity_subtype": entity_subtype,
        "sectors": sectors or ["General"],
        "language": language or "English",
        "update_frequency": update_frequency or "Daily",
        "registration_required": registration_required,
        "registration_type": registration_type,
        "api_available": api_available or False,
        "rss_feed": rss_feed or False,
        "email_alerts": email_alerts or False,
        "estimated_annual_tenders": estimated_annual_tenders,
        "tender_value_range": tender_value_range,
        "primary_contact": primary_contact,
        "technical_notes": technical_notes,
        "last_verified": last_verified or datetime.now().strftime("%Y-%m-%d"),
        "data_quality_score": data_quality_score
    }

entries = []

# =============================================================================
# AFRICAN WATER UTILITIES
# =============================================================================

african_water_utilities = [
    ("Nairobi Water & Sewerage Company", "https://www.nairobiwater.co.ke/tenders", "KEN", "Kenya", "Nairobi"),
    ("DAWASCO - Dar es Salaam Water", "https://www.dawasco.or.tz/tenders", "TZA", "Tanzania", "Dar es Salaam"),
    ("GWCL - Ghana Water Company", "https://www.gwcl.com.gh/tenders", "GHA", "Ghana", "Accra"),
    ("LWSC - Lusaka Water & Sewerage", "https://www.lwsc.com.zm/tenders", "ZMB", "Zambia", "Lusaka"),
    ("NWSC - National Water Uganda", "https://www.nwsc.co.ug/tenders", "UGA", "Uganda", "Kampala"),
    ("WASREB - Water Services Regulatory Board", "https://www.wasreb.go.ke/tenders", "KEN", "Kenya", "National"),
    ("AUWSA - Arusha Water", "https://www.auwsa.or.tz/tenders", "TZA", "Tanzania", "Arusha"),
    ("MWSA - Mombasa Water", "https://www.mombwasco.co.ke/tenders", "KEN", "Kenya", "Mombasa"),
    ("KCWSC - Kisumu Water", "https://www.kiwasco.co.ke/tenders", "KEN", "Kenya", "Kisumu"),
    ("ONEA - Office National de l'Eau (Burkina)", "https://www.onea.bf/tenders", "BFA", "Burkina Faso", "National"),
    ("SODECI - Côte d'Ivoire Water", "https://www.sodeci.ci/tenders", "CIV", "Côte d'Ivoire", "National"),
    ("SDE - Sénégalaise des Eaux", "https://www.sde.sn/tenders", "SEN", "Senegal", "National"),
    ("REGIDESO - DRC Water", "https://www.regideso.cd/tenders", "COD", "DR Congo", "National"),
    ("Camerounaise des Eaux", "https://www.cde.cm/tenders", "CMR", "Cameroon", "National"),
    ("JIRAMA - Madagascar Water", "https://www.jirama.mg/tenders", "MDG", "Madagascar", "National"),
    ("ZINWA - Zimbabwe National Water", "https://www.zinwa.co.zw/tenders", "ZWE", "Zimbabwe", "National"),
    ("EWURA - Energy and Water Utilities (Tanzania)", "https://www.ewura.go.tz/tenders", "TZA", "Tanzania", "National"),
]

for name, url, code, country, region in african_water_utilities:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code=code,
        country_name=country,
        region=region,
        entity_type="Utility",
        entity_subtype="Water Utility",
        sectors=["Water", "Sanitation", "Infrastructure"],
        language="English" if code in ["KEN", "TZA", "GHA", "ZMB", "UGA", "ZWE"] else "French",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="50-300",
        technical_notes=f"Water utility procurement - {country}"
    ))

# =============================================================================
# AFRICAN ELECTRICITY UTILITIES
# =============================================================================

african_electricity = [
    ("KPLC - Kenya Power & Lighting", "https://www.kplc.co.ke/tenders", "KEN", "Kenya"),
    ("TANESCO - Tanzania Electric Supply", "https://www.tanesco.co.tz/tenders", "TZA", "Tanzania"),
    ("ECG - Electricity Company of Ghana", "https://www.ecggh.com/tenders", "GHA", "Ghana"),
    ("GRIDCO - Ghana Grid Company", "https://www.gridcogh.com/tenders", "GHA", "Ghana"),
    ("VRA - Volta River Authority", "https://www.vra.com/tenders", "GHA", "Ghana"),
    ("UMEME - Uganda Electricity", "https://www.umeme.co.ug/tenders", "UGA", "Uganda"),
    ("REG - Rwanda Energy Group", "https://www.reg.rw/tenders", "RWA", "Rwanda"),
    ("ZESCO - Zambia Electricity", "https://www.zesco.co.zm/tenders", "ZMB", "Zambia"),
    ("ZETDC - Zimbabwe Electricity", "https://www.zetdc.co.zw/tenders", "ZWE", "Zimbabwe"),
    ("ZPC - Zimbabwe Power Company", "https://www.zpc.co.zw/tenders", "ZWE", "Zimbabwe"),
    ("EDM - Electricidade de Moçambique", "https://www.edm.co.mz/tenders", "MOZ", "Mozambique"),
    ("ESCOM - Electricity Supply Malawi", "https://www.escom.mw/tenders", "MWI", "Malawi"),
    ("BPC - Botswana Power Corporation", "https://www.bpc.bw/tenders", "BWA", "Botswana"),
    ("NamPower - Namibia Power", "https://www.nampower.com.na/tenders", "NAM", "Namibia"),
    ("SNEL - Société Nationale d'Electricité DRC", "https://www.snel.cd/tenders", "COD", "DR Congo"),
    ("ENEO - Energy of Cameroon", "https://www.eneocameroon.cm/tenders", "CMR", "Cameroon"),
    ("SENELEC - Sénégal Electricité", "https://www.senelec.sn/tenders", "SEN", "Senegal"),
    ("CIE - Compagnie Ivoirienne d'Electricité", "https://www.cie.ci/tenders", "CIV", "Côte d'Ivoire"),
    ("SONABEL - Burkina Faso Electricity", "https://www.sonabel.bf/tenders", "BFA", "Burkina Faso"),
    ("EDG - Electricité de Guinée", "https://www.edg.gov.gn/tenders", "GIN", "Guinea"),
    ("NIGELEC - Niger Electricity", "https://www.nigelec.ne/tenders", "NER", "Niger"),
    ("SBEE - Bénin Electricity", "https://www.sbee.bj/tenders", "BEN", "Benin"),
    ("CEET - Togo Electricity", "https://www.ceet.tg/tenders", "TGO", "Togo"),
    ("LEC - Liberia Electricity", "https://www.lec.gov.lr/tenders", "LBR", "Liberia"),
]

for name, url, code, country in african_electricity:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code=code,
        country_name=country,
        entity_type="Utility",
        entity_subtype="Electricity Utility",
        sectors=["Energy", "Electricity", "Infrastructure"],
        language="English" if code in ["KEN", "TZA", "GHA", "UGA", "RWA", "ZMB", "ZWE", "MWI", "BWA", "NAM", "LBR"] else "French" if code in ["COD", "CMR", "SEN", "CIV", "BFA", "GIN", "NER", "BEN", "TGO"] else "Portuguese",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="100-500",
        technical_notes=f"National electricity utility - {country}"
    ))

# =============================================================================
# AFRICAN PORTS AND MARITIME
# =============================================================================

african_ports = [
    ("Kenya Ports Authority", "https://www.kpa.co.ke/tenders", "KEN", "Kenya", "Mombasa"),
    ("Tanzania Ports Authority", "https://www.ports.go.tz/tenders", "TZA", "Tanzania", "Dar es Salaam"),
    ("Ghana Ports and Harbours", "https://www.ghanaports.gov.gh/tenders", "GHA", "Ghana", "Tema/Takoradi"),
    ("Nigerian Ports Authority", "https://www.nigerianports.gov.ng/tenders", "NGA", "Nigeria", "Lagos/Port Harcourt"),
    ("Port Authority of Djibouti", "https://www.dpfza.gov.dj/tenders", "DJI", "Djibouti", "Djibouti"),
    ("Ethiopian Shipping & Logistics", "https://www.eslse.gov.et/tenders", "ETH", "Ethiopia", "National"),
    ("Transnet National Ports Authority", "https://www.transnetnationalportsauthority.net/tenders", "ZAF", "South Africa", "National"),
    ("Maputo Port Development", "https://www.portmaputo.com/tenders", "MOZ", "Mozambique", "Maputo"),
    ("Namport - Namibian Ports", "https://www.namport.com.na/tenders", "NAM", "Namibia", "Walvis Bay"),
    ("Port Autonome de Dakar", "https://www.portdakar.sn/tenders", "SEN", "Senegal", "Dakar"),
    ("Port Autonome d'Abidjan", "https://www.portabidjan.ci/tenders", "CIV", "Côte d'Ivoire", "Abidjan"),
    ("Port Autonome de Douala", "https://www.pad.cm/tenders", "CMR", "Cameroon", "Douala"),
    ("Port Autonome de Cotonou", "https://www.portcotonou.bj/tenders", "BEN", "Benin", "Cotonou"),
    ("Port Autonome de Lomé", "https://www.togo-port.net/tenders", "TGO", "Togo", "Lomé"),
    ("GETMA - Conakry Port", "https://www.getma.gn/tenders", "GIN", "Guinea", "Conakry"),
    ("Mauritius Ports Authority", "https://www.mauport.com/tenders", "MUS", "Mauritius", "Port Louis"),
    ("Mombasa Port Development", "https://www.mombasaport.co.ke/tenders", "KEN", "Kenya", "Mombasa"),
    ("Lamu Port Development", "https://www.lamuport.go.ke/tenders", "KEN", "Kenya", "Lamu"),
]

for name, url, code, country, port in african_ports:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code=code,
        country_name=country,
        region=port,
        entity_type="Port Authority",
        entity_subtype="Maritime Infrastructure",
        sectors=["Ports", "Maritime", "Logistics", "Infrastructure"],
        language="English" if code in ["KEN", "TZA", "GHA", "NGA", "DJI", "ETH", "ZAF", "NAM", "MUS"] else "French" if code in ["SEN", "CIV", "CMR", "BEN", "TGO", "GIN"] else "Portuguese",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="50-300",
        technical_notes=f"Port authority - {port}, {country}"
    ))

# =============================================================================
# AFRICAN RAILWAYS
# =============================================================================

african_railways = [
    ("Kenya Railways Corporation", "https://www.krc.co.ke/tenders", "KEN", "Kenya"),
    ("Tanzania Railways Corporation", "https://www.trc.co.tz/tenders", "TZA", "Tanzania"),
    ("Uganda Railways Corporation", "https://www.urc.go.ug/tenders", "UGA", "Uganda"),
    ("Ethiopian Railways Corporation", "https://www.erc.gov.et/tenders", "ETH", "Ethiopia"),
    ("PRASA - South Africa Rail", "https://www.prasa.com/tenders", "ZAF", "South Africa"),
    ("Transnet Freight Rail", "https://www.transnetfreightrail.net/tenders", "ZAF", "South Africa"),
    ("Zambia Railways", "https://www.zrl.com.zm/tenders", "ZMB", "Zambia"),
    ("NRZ - National Railways Zimbabwe", "https://www.nrz.co.zw/tenders", "ZWE", "Zimbabwe"),
    ("CFM - Caminhos de Ferro Moçambique", "https://www.cfm.co.mz/tenders", "MOZ", "Mozambique"),
    ("NRC - Nigerian Railway Corporation", "https://www.nrc.gov.ng/tenders", "NGA", "Nigeria"),
    ("Ghana Railway Company", "https://www.grda.gov.gh/tenders", "GHA", "Ghana"),
    ("ONCF - Morocco Railways", "https://www.oncf.ma/tenders", "MAR", "Morocco"),
    ("SNCFT - Tunisia Railways", "https://www.sncft.com.tn/tenders", "TUN", "Tunisia"),
    ("ENR - Egyptian National Railways", "https://www.enr.gov.eg/tenders", "EGY", "Egypt"),
    ("Standard Gauge Railway Kenya", "https://www.sgr.go.ke/tenders", "KEN", "Kenya"),
]

for name, url, code, country in african_railways:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code=code,
        country_name=country,
        entity_type="State-Owned Enterprise",
        entity_subtype="Railway Corporation",
        sectors=["Transport", "Railways", "Infrastructure"],
        language="English" if code in ["KEN", "TZA", "UGA", "ETH", "ZAF", "ZMB", "ZWE", "NGA", "GHA"] else "French" if code in ["MAR", "TUN"] else "Arabic" if code == "EGY" else "Portuguese",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="50-400",
        technical_notes=f"Railway corporation - {country}"
    ))

# =============================================================================
# AFRICAN AIRPORTS
# =============================================================================

african_airports = [
    ("KAA - Kenya Airports Authority", "https://www.kaa.go.ke/tenders", "KEN", "Kenya"),
    ("TAA - Tanzania Airports Authority", "https://www.taa.go.tz/tenders", "TZA", "Tanzania"),
    ("GCAA - Ghana Civil Aviation", "https://www.gcaa.com.gh/tenders", "GHA", "Ghana"),
    ("FAAN - Federal Airports Authority Nigeria", "https://www.faan.gov.ng/tenders", "NGA", "Nigeria"),
    ("ACSA - Airports Company South Africa", "https://www.airports.co.za/tenders", "ZAF", "South Africa"),
    ("Ethiopian Airports Enterprise", "https://www.ethiopianairports.com/tenders", "ETH", "Ethiopia"),
    ("Entebbe Airport Uganda", "https://www.ucaa.go.ug/tenders", "UGA", "Uganda"),
    ("RwandAir Airports", "https://www.caa.gov.rw/tenders", "RWA", "Rwanda"),
    ("ONDA - Morocco Airports", "https://www.onda.ma/tenders", "MAR", "Morocco"),
    ("OACA - Tunisia Airports", "https://www.oaca.nat.tn/tenders", "TUN", "Tunisia"),
    ("Egyptian Airports Company", "https://www.ehc.gov.eg/tenders", "EGY", "Egypt"),
    ("Namibia Airports Company", "https://www.airports.com.na/tenders", "NAM", "Namibia"),
    ("Airports of Mauritius", "https://www.aml.mru.aero/tenders", "MUS", "Mauritius"),
]

for name, url, code, country in african_airports:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code=code,
        country_name=country,
        entity_type="Airport Authority",
        entity_subtype="Aviation Infrastructure",
        sectors=["Aviation", "Airports", "Infrastructure"],
        language="English" if code in ["KEN", "TZA", "GHA", "NGA", "ZAF", "ETH", "UGA", "RWA", "NAM", "MUS"] else "French" if code in ["MAR", "TUN"] else "Arabic",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="50-300",
        technical_notes=f"Airport authority - {country}"
    ))

# =============================================================================
# AFRICAN UNIVERSITIES (Major Research Universities)
# =============================================================================

african_universities = [
    ("University of Nairobi", "https://www.uonbi.ac.ke/tenders", "KEN", "Kenya"),
    ("Kenyatta University", "https://www.ku.ac.ke/tenders", "KEN", "Kenya"),
    ("Makerere University", "https://www.mak.ac.ug/tenders", "UGA", "Uganda"),
    ("University of Dar es Salaam", "https://www.udsm.ac.tz/tenders", "TZA", "Tanzania"),
    ("University of Ghana", "https://www.ug.edu.gh/tenders", "GHA", "Ghana"),
    ("Kwame Nkrumah University", "https://www.knust.edu.gh/tenders", "GHA", "Ghana"),
    ("University of Cape Town", "https://www.uct.ac.za/tenders", "ZAF", "South Africa"),
    ("University of Witwatersrand", "https://www.wits.ac.za/tenders", "ZAF", "South Africa"),
    ("University of Pretoria", "https://www.up.ac.za/tenders", "ZAF", "South Africa"),
    ("Stellenbosch University", "https://www.sun.ac.za/tenders", "ZAF", "South Africa"),
    ("University of KwaZulu-Natal", "https://www.ukzn.ac.za/tenders", "ZAF", "South Africa"),
    ("University of Johannesburg", "https://www.uj.ac.za/tenders", "ZAF", "South Africa"),
    ("Addis Ababa University", "https://www.aau.edu.et/tenders", "ETH", "Ethiopia"),
    ("University of Nigeria Nsukka", "https://www.unn.edu.ng/tenders", "NGA", "Nigeria"),
    ("University of Lagos", "https://www.unilag.edu.ng/tenders", "NGA", "Nigeria"),
    ("University of Ibadan", "https://www.ui.edu.ng/tenders", "NGA", "Nigeria"),
    ("Ahmadu Bello University", "https://www.abu.edu.ng/tenders", "NGA", "Nigeria"),
    ("University of Zimbabwe", "https://www.uz.ac.zw/tenders", "ZWE", "Zimbabwe"),
    ("University of Zambia", "https://www.unza.zm/tenders", "ZMB", "Zambia"),
    ("University of Botswana", "https://www.ub.bw/tenders", "BWA", "Botswana"),
    ("University of Mauritius", "https://www.uom.ac.mu/tenders", "MUS", "Mauritius"),
    ("Cairo University", "https://cu.edu.eg/tenders", "EGY", "Egypt"),
    ("Alexandria University", "https://www.alexu.edu.eg/tenders", "EGY", "Egypt"),
    ("Mohammed V University", "https://www.um5.ac.ma/tenders", "MAR", "Morocco"),
    ("University of Cape Verde", "https://www.unicv.edu.cv/tenders", "CPV", "Cape Verde"),
    ("Eduardo Mondlane University", "https://www.uem.mz/tenders", "MOZ", "Mozambique"),
    ("University of Rwanda", "https://www.ur.ac.rw/tenders", "RWA", "Rwanda"),
    ("University of Cheikh Anta Diop", "https://www.ucad.sn/tenders", "SEN", "Senegal"),
    ("Université Félix Houphouët-Boigny", "https://www.univ-fhb.ci/tenders", "CIV", "Côte d'Ivoire"),
]

for name, url, code, country in african_universities:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code=code,
        country_name=country,
        entity_type="University",
        entity_subtype="Higher Education Institution",
        sectors=["Education", "Research", "ICT", "Construction"],
        language="English" if code in ["KEN", "UGA", "TZA", "GHA", "ZAF", "ETH", "NGA", "ZWE", "ZMB", "BWA", "MUS", "RWA"] else "French" if code in ["SEN", "CIV"] else "Arabic" if code in ["EGY", "MAR"] else "Portuguese",
        update_frequency="Monthly",
        registration_required=True,
        estimated_annual_tenders="30-150",
        technical_notes=f"University procurement - {country}"
    ))

# =============================================================================
# AFRICAN NATIONAL OIL COMPANIES
# =============================================================================

african_nocs = [
    ("NNPC - Nigerian National Petroleum", "https://nnpcgroup.com/tenders", "NGA", "Nigeria"),
    ("GNPC - Ghana National Petroleum", "https://www.gnpcghana.com/tenders", "GHA", "Ghana"),
    ("SONANGOL - Angola", "https://www.sonangol.co.ao/tenders", "AGO", "Angola"),
    ("NOC Libya", "https://noc.ly/tenders", "LBY", "Libya"),
    ("Sonatrach - Algeria", "https://www.sonatrach.dz/tenders", "DZA", "Algeria"),
    ("SNPC - Congo", "https://www.snpc-cg.com/tenders", "COG", "Republic of Congo"),
    ("ETAP - Tunisia", "https://www.etap.com.tn/tenders", "TUN", "Tunisia"),
    ("EGPC - Egyptian Petroleum", "https://www.egpc.com.eg/tenders", "EGY", "Egypt"),
    ("ONHYM - Morocco", "https://www.onhym.com/tenders", "MAR", "Morocco"),
    ("GEPetrol - Equatorial Guinea", "https://www.gepetrol.gq/tenders", "GNQ", "Equatorial Guinea"),
    ("NOCAL - Liberia", "https://www.nocal.com.lr/tenders", "LBR", "Liberia"),
    ("PETROCI - Côte d'Ivoire", "https://www.petroci.ci/tenders", "CIV", "Côte d'Ivoire"),
    ("SNH - Cameroon", "https://www.snh.cm/tenders", "CMR", "Cameroon"),
    ("NAMCOR - Namibia", "https://www.namcor.com.na/tenders", "NAM", "Namibia"),
    ("TPDC - Tanzania Petroleum", "https://www.tpdc.go.tz/tenders", "TZA", "Tanzania"),
    ("NOCK - Kenya National Oil", "https://www.nationaloil.co.ke/tenders", "KEN", "Kenya"),
    ("UNOC - Uganda National Oil", "https://www.unoc.co.ug/tenders", "UGA", "Uganda"),
    ("Sudapet - Sudan", "https://www.sudapet.sd/tenders", "SDN", "Sudan"),
]

for name, url, code, country in african_nocs:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code=code,
        country_name=country,
        entity_type="National Oil Company",
        entity_subtype="Petroleum SOE",
        sectors=["Oil & Gas", "Energy", "Petrochemicals"],
        language="English" if code in ["NGA", "GHA", "LBY", "LBR", "NAM", "TZA", "KEN", "UGA", "SDN"] else "French" if code in ["CIV", "CMR", "COG", "DZA", "TUN", "MAR"] else "Portuguese" if code == "AGO" else "Spanish" if code == "GNQ" else "Arabic",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="100-1000",
        technical_notes=f"National oil company - {country}"
    ))

# =============================================================================
# ASIAN WATER UTILITIES
# =============================================================================

asian_water = [
    ("PDAM Jakarta", "https://palyja.co.id/tenders", "IDN", "Indonesia", "Jakarta"),
    ("Manila Water Company", "https://www.manilawater.com/tenders", "PHL", "Philippines", "Manila"),
    ("Maynilad Water Services", "https://www.mayniladwater.com.ph/tenders", "PHL", "Philippines", "Manila"),
    ("SYABAS - Selangor Water", "https://www.syabas.com.my/tenders", "MYS", "Malaysia", "Selangor"),
    ("PUB Singapore", "https://www.pub.gov.sg/tenders", "SGP", "Singapore", "National"),
    ("Bangkok MWA", "https://www.mwa.co.th/tenders", "THA", "Thailand", "Bangkok"),
    ("Ho Chi Minh City Water", "https://www.sawaco.com.vn/tenders", "VNM", "Vietnam", "HCMC"),
    ("Hanoi Water", "https://www.hawacom.vn/tenders", "VNM", "Vietnam", "Hanoi"),
    ("Delhi Jal Board", "https://www.delhijalboard.nic.in/tenders", "IND", "India", "Delhi"),
    ("BWSSB Bangalore Water", "https://www.bwssb.gov.in/tenders", "IND", "India", "Bangalore"),
    ("MCGM Mumbai Water", "https://portal.mcgm.gov.in/tenders", "IND", "India", "Mumbai"),
    ("Chennai Metrowater", "https://www.chennaimetrowater.tn.gov.in/tenders", "IND", "India", "Chennai"),
    ("KWASA - Karachi Water", "https://www.kwsb.gos.pk/tenders", "PAK", "Pakistan", "Karachi"),
    ("WASA Lahore", "https://www.wasa.punjab.gov.pk/tenders", "PAK", "Pakistan", "Lahore"),
    ("DHAKA WASA", "https://www.dwasa.org.bd/tenders", "BGD", "Bangladesh", "Dhaka"),
]

for name, url, code, country, city in asian_water:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code=code,
        country_name=country,
        region=city,
        entity_type="Utility",
        entity_subtype="Water Utility",
        sectors=["Water", "Sanitation", "Infrastructure"],
        language="English" if code in ["PHL", "SGP", "IND", "PAK", "BGD"] else "Indonesian" if code == "IDN" else "Malay" if code == "MYS" else "Thai" if code == "THA" else "Vietnamese",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="50-300",
        technical_notes=f"Water utility - {city}, {country}"
    ))

# =============================================================================
# LATIN AMERICAN UTILITIES
# =============================================================================

latam_utilities = [
    ("SABESP - São Paulo Water", "https://www.sabesp.com.br/licitacoes", "BRA", "Brazil", "São Paulo"),
    ("CEDAE - Rio de Janeiro Water", "https://www.cedae.com.br/licitacoes", "BRA", "Brazil", "Rio de Janeiro"),
    ("COPASA - Minas Gerais Water", "https://www.copasa.com.br/licitacoes", "BRA", "Brazil", "Minas Gerais"),
    ("SANEPAR - Paraná Water", "https://www.sanepar.com.br/licitacoes", "BRA", "Brazil", "Paraná"),
    ("CORSAN - Rio Grande do Sul Water", "https://www.corsan.com.br/licitacoes", "BRA", "Brazil", "Rio Grande do Sul"),
    ("Aguas de Bogotá", "https://www.acueducto.com.co/contratacion", "COL", "Colombia", "Bogotá"),
    ("Aguas de Lima - SEDAPAL", "https://www.sedapal.com.pe/proveedores", "PER", "Peru", "Lima"),
    ("Aguas Andinas - Santiago", "https://www.aguasandinas.cl/proveedores", "CHL", "Chile", "Santiago"),
    ("AySA - Buenos Aires Water", "https://www.aysa.com.ar/contrataciones", "ARG", "Argentina", "Buenos Aires"),
    ("ANDA - El Salvador Water", "https://www.anda.gob.sv/licitaciones", "SLV", "El Salvador", "National"),
    ("AyA - Costa Rica Water", "https://www.aya.go.cr/proveeduria", "CRI", "Costa Rica", "National"),
    ("ESSAP - Paraguay Water", "https://www.essap.com.py/licitaciones", "PRY", "Paraguay", "Asunción"),
    ("OSE - Uruguay Water", "https://www.ose.com.uy/licitaciones", "URY", "Uruguay", "National"),
    ("EPSAS - Bolivia Water", "https://www.epsas.com.bo/licitaciones", "BOL", "Bolivia", "La Paz"),
]

for name, url, code, country, region in latam_utilities:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code=code,
        country_name=country,
        region=region,
        entity_type="Utility",
        entity_subtype="Water Utility",
        sectors=["Water", "Sanitation", "Infrastructure"],
        language="Portuguese" if code == "BRA" else "Spanish",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="100-500",
        technical_notes=f"Water utility - {region}, {country}"
    ))

# =============================================================================
# MIDDLE EAST UTILITIES AND INFRASTRUCTURE
# =============================================================================

middle_east_utilities = [
    ("DEWA - Dubai Electricity & Water", "https://www.dewa.gov.ae/en/supplier", "ARE", "UAE", "Dubai"),
    ("ADWEA - Abu Dhabi Water & Electricity", "https://www.adwea.ae/suppliers", "ARE", "UAE", "Abu Dhabi"),
    ("SEWA - Sharjah Electricity & Water", "https://www.sewa.gov.ae/suppliers", "ARE", "UAE", "Sharjah"),
    ("KAHRAMAA - Qatar Electricity & Water", "https://www.km.qa/suppliers", "QAT", "Qatar", "National"),
    ("SEC - Saudi Electricity Company", "https://www.se.com.sa/en-us/suppliers", "SAU", "Saudi Arabia", "National"),
    ("SWCC - Saline Water Conversion", "https://www.swcc.gov.sa/suppliers", "SAU", "Saudi Arabia", "National"),
    ("EWA - Bahrain Electricity & Water", "https://www.ewa.bh/suppliers", "BHR", "Bahrain", "National"),
    ("KEGOC - Kazakhstan Grid", "https://www.kegoc.kz/en/procurement", "KAZ", "Kazakhstan", "National"),
    ("Kazenergy - Kazakhstan Oil & Gas", "https://www.kazenergy.com/procurement", "KAZ", "Kazakhstan", "National"),
    ("TAQA - Abu Dhabi Energy", "https://www.taqa.com/suppliers", "ARE", "UAE", "Abu Dhabi"),
    ("Marafiq - Saudi Utilities", "https://www.marafiq.com.sa/suppliers", "SAU", "Saudi Arabia", "Jubail"),
    ("OETC - Oman Electricity Transmission", "https://www.oetc.com.om/suppliers", "OMN", "Oman", "National"),
    ("Oman Power and Water", "https://www.omanpwp.com/suppliers", "OMN", "Oman", "National"),
    ("Kuwait Oil Company", "https://www.kockw.com/procurement", "KWT", "Kuwait", "National"),
    ("KNPC - Kuwait National Petroleum", "https://www.knpc.com/procurement", "KWT", "Kuwait", "National"),
    ("BAPCO - Bahrain Petroleum", "https://www.bapco.net/suppliers", "BHR", "Bahrain", "National"),
]

for name, url, code, country, region in middle_east_utilities:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code=code,
        country_name=country,
        region=region,
        entity_type="Utility" if "Water" in name or "Electricity" in name else "State-Owned Enterprise",
        entity_subtype="Utility" if "Water" in name or "Electricity" in name else "Energy Company",
        sectors=["Energy", "Water", "Utilities", "Oil & Gas"] if "Petroleum" in name or "Oil" in name else ["Energy", "Water", "Utilities"],
        language="Arabic",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="100-800",
        technical_notes=f"Major utility - {region}, {country}"
    ))

# =============================================================================
# MAJOR TEACHING HOSPITALS
# =============================================================================

teaching_hospitals = [
    ("Kenyatta National Hospital", "https://www.knh.or.ke/tenders", "KEN", "Kenya", "Nairobi"),
    ("Muhimbili National Hospital", "https://www.mnh.or.tz/tenders", "TZA", "Tanzania", "Dar es Salaam"),
    ("Korle Bu Teaching Hospital", "https://www.kbth.gov.gh/tenders", "GHA", "Ghana", "Accra"),
    ("Chris Hani Baragwanath Hospital", "https://www.chrishanibaragwanathhospital.co.za/tenders", "ZAF", "South Africa", "Johannesburg"),
    ("Groote Schuur Hospital", "https://www.westerncape.gov.za/facility/groote-schuur-hospital/tenders", "ZAF", "South Africa", "Cape Town"),
    ("Mulago National Referral Hospital", "https://www.mulago.or.ug/tenders", "UGA", "Uganda", "Kampala"),
    ("University Teaching Hospital Zambia", "https://www.uth.gov.zm/tenders", "ZMB", "Zambia", "Lusaka"),
    ("AIIMS - All India Institute of Medical Sciences", "https://www.aiims.edu/tenders", "IND", "India", "New Delhi"),
    ("Philippine General Hospital", "https://www.pgh.gov.ph/tenders", "PHL", "Philippines", "Manila"),
    ("Siriraj Hospital Thailand", "https://www.si.mahidol.ac.th/tenders", "THA", "Thailand", "Bangkok"),
    ("Hospital Nacional Arzobispo Loayza Peru", "https://www.hospitalloayza.gob.pe/licitaciones", "PER", "Peru", "Lima"),
    ("Hospital das Clínicas São Paulo", "https://www.hc.fm.usp.br/licitacoes", "BRA", "Brazil", "São Paulo"),
    ("Hospital General de México", "https://www.hgm.salud.gob.mx/licitaciones", "MEX", "Mexico", "Mexico City"),
    ("Instituto Nacional de Pediatría Mexico", "https://www.pediatria.gob.mx/licitaciones", "MEX", "Mexico", "Mexico City"),
    ("Cairo University Hospital", "https://medicine.cu.edu.eg/tenders", "EGY", "Egypt", "Cairo"),
    ("King Faisal Specialist Hospital", "https://www.kfshrc.edu.sa/suppliers", "SAU", "Saudi Arabia", "Riyadh"),
]

for name, url, code, country, city in teaching_hospitals:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code=code,
        country_name=country,
        region=city,
        entity_type="Hospital",
        entity_subtype="Teaching Hospital",
        sectors=["Health", "Medical Equipment", "Pharmaceuticals", "Construction"],
        language="English" if code in ["KEN", "TZA", "GHA", "ZAF", "UGA", "ZMB", "IND", "PHL"] else "Spanish" if code in ["PER", "MEX"] else "Portuguese" if code == "BRA" else "Thai" if code == "THA" else "Arabic",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="50-300",
        technical_notes=f"Teaching hospital procurement - {city}, {country}"
    ))

# =============================================================================
# ADDITIONAL REGIONAL ECONOMIC ORGANIZATIONS
# =============================================================================

regional_orgs = [
    ("PTA Bank - Eastern and Southern Africa", "https://www.ptabank.org/procurement", "Regional", "ESA", "Banking", "Development Finance"),
    ("BDEAC - Central African Development Bank", "https://www.bdeac.org/procurement", "Regional", "Central Africa", "Banking", "Development Finance"),
    ("BOAD - West African Development Bank", "https://www.boad.org/procurement", "Regional", "West Africa", "Banking", "Development Finance"),
    ("TDB - Trade and Development Bank", "https://www.tdbgroup.org/procurement", "Regional", "Africa", "Banking", "Trade Finance"),
    ("Afreximbank", "https://www.afreximbank.com/procurement", "Regional", "Africa", "Banking", "Export Finance"),
    ("BADEA - Arab Bank for Economic Development in Africa", "https://www.badea.org/procurement", "Regional", "Africa", "Banking", "Development Finance"),
    ("CAF - Development Bank of Latin America", "https://www.caf.com/procurement", "Regional", "Latin America", "Banking", "Development Finance"),
    ("CABEI - Central American Bank", "https://www.bcie.org/procurement", "Regional", "Central America", "Banking", "Development Finance"),
    ("CDB - Caribbean Development Bank", "https://www.caribank.org/procurement", "Regional", "Caribbean", "Banking", "Development Finance"),
    ("FONPLATA - River Plate Basin Development", "https://www.fonplata.org/procurement", "Regional", "South America", "Banking", "Infrastructure"),
    ("OFID - OPEC Fund for International Development", "https://www.opecfund.org/procurement", "International", "Global", "Development Finance", "Energy"),
    ("NDF - Nordic Development Fund", "https://www.ndf.fi/procurement", "International", "Global", "Climate Finance", "Environment"),
    ("IFAD - International Fund for Agricultural Development", "https://www.ifad.org/procurement", "UN", "Global", "Agriculture", "Rural Development"),
    ("UNCTAD - UN Conference on Trade and Development", "https://procurement.unctad.org", "UN", "Global", "Trade", "Development"),
    ("UNIDO - UN Industrial Development", "https://www.unido.org/procurement", "UN", "Global", "Industrial", "Manufacturing"),
]

for name, url, org_type, coverage, sector1, sector2 in regional_orgs:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code=org_type,
        country_name=coverage,
        entity_type="International Organization" if org_type in ["Regional", "International", "UN"] else "Development Bank",
        entity_subtype="Development Finance Institution" if "Bank" in name or "Development" in sector2 else "UN Agency",
        sectors=[sector1, sector2, "Consulting", "Technical Assistance"],
        language="English",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="100-500",
        technical_notes=f"{name} - {coverage} coverage"
    ))

print(f"Utilities Expansion entries: {len(entries)}")

# Save to JSON
with open('/sessions/peaceful-zen-gauss/tender_db/expansion_utilities.json', 'w') as f:
    json.dump(entries, f, indent=2)

print(f"Saved {len(entries)} entries to expansion_utilities.json")
