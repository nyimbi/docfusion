#!/usr/bin/env python3
"""
Expansion: Asia Sub-national and SOE Expansion
Additional Indonesian provinces, Pakistani institutions, Vietnamese provinces, Thai agencies
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
# INDONESIA - Additional Provinces and Major Cities
# =============================================================================

indonesian_provinces = [
    ("Jawa Barat", "https://lpse.jabarprov.go.id", "West Java"),
    ("Jawa Tengah", "https://lpse.jatengprov.go.id", "Central Java"),
    ("Jawa Timur", "https://lpse.jatimprov.go.id", "East Java"),
    ("Sumatera Utara", "https://lpse.sumutprov.go.id", "North Sumatra"),
    ("Sumatera Barat", "https://lpse.sumbarprov.go.id", "West Sumatra"),
    ("Sumatera Selatan", "https://lpse.sumselprov.go.id", "South Sumatra"),
    ("Riau", "https://lpse.riau.go.id", "Riau"),
    ("Kepulauan Riau", "https://lpse.kepriprov.go.id", "Riau Islands"),
    ("Jambi", "https://lpse.jambiprov.go.id", "Jambi"),
    ("Bengkulu", "https://lpse.bengkuluprov.go.id", "Bengkulu"),
    ("Lampung", "https://lpse.lampungprov.go.id", "Lampung"),
    ("Kalimantan Barat", "https://lpse.kalbarprov.go.id", "West Kalimantan"),
    ("Kalimantan Tengah", "https://lpse.kalteng.go.id", "Central Kalimantan"),
    ("Kalimantan Selatan", "https://lpse.kalselprov.go.id", "South Kalimantan"),
    ("Kalimantan Timur", "https://lpse.kaltimprov.go.id", "East Kalimantan"),
    ("Kalimantan Utara", "https://lpse.kaltaraprov.go.id", "North Kalimantan"),
    ("Sulawesi Utara", "https://lpse.sulutprov.go.id", "North Sulawesi"),
    ("Sulawesi Tengah", "https://lpse.sultengprov.go.id", "Central Sulawesi"),
    ("Sulawesi Selatan", "https://lpse.sulselprov.go.id", "South Sulawesi"),
    ("Sulawesi Tenggara", "https://lpse.sultraprov.go.id", "Southeast Sulawesi"),
    ("Gorontalo", "https://lpse.gorontaloprov.go.id", "Gorontalo"),
    ("Sulawesi Barat", "https://lpse.sulbarprov.go.id", "West Sulawesi"),
    ("Maluku", "https://lpse.malukuprov.go.id", "Maluku"),
    ("Maluku Utara", "https://lpse.malutprov.go.id", "North Maluku"),
    ("Papua", "https://lpse.papua.go.id", "Papua"),
    ("Papua Barat", "https://lpse.papuabaratprov.go.id", "West Papua"),
    ("Bali", "https://lpse.baliprov.go.id", "Bali"),
    ("Nusa Tenggara Barat", "https://lpse.ntbprov.go.id", "West Nusa Tenggara"),
    ("Nusa Tenggara Timur", "https://lpse.nttprov.go.id", "East Nusa Tenggara"),
    ("Aceh", "https://lpse.acehprov.go.id", "Aceh"),
    ("Bangka Belitung", "https://lpse.babelprov.go.id", "Bangka Belitung"),
    ("Banten", "https://lpse.bantenprov.go.id", "Banten"),
]

for prov_name, url, english_name in indonesian_provinces:
    entries.append(create_entry(
        source_name=f"LPSE Provinsi {prov_name}",
        url=url,
        country_code="IDN",
        country_name="Indonesia",
        region=prov_name,
        entity_type="Sub-national Government",
        entity_subtype="Provincial Government",
        sectors=["General", "Infrastructure", "Health", "Education"],
        language="Indonesian",
        update_frequency="Daily",
        registration_required=True,
        estimated_annual_tenders="500-2000",
        api_available=True,
        technical_notes=f"LPSE e-procurement portal for {english_name} Province"
    ))

# Indonesian Major Cities
indonesian_cities = [
    ("Jakarta", "https://lpse.jakarta.go.id", "DKI Jakarta"),
    ("Surabaya", "https://lpse.surabaya.go.id", "East Java"),
    ("Bandung", "https://lpse.bandung.go.id", "West Java"),
    ("Medan", "https://lpse.pemkomedan.go.id", "North Sumatra"),
    ("Semarang", "https://lpse.semarangkota.go.id", "Central Java"),
    ("Makassar", "https://lpse.makassarkota.go.id", "South Sulawesi"),
    ("Palembang", "https://lpse.palembang.go.id", "South Sumatra"),
    ("Tangerang", "https://lpse.tangerangkota.go.id", "Banten"),
    ("Depok", "https://lpse.depok.go.id", "West Java"),
    ("Bekasi", "https://lpse.bekasikota.go.id", "West Java"),
    ("Yogyakarta", "https://lpse.jogjakota.go.id", "DIY"),
    ("Bogor", "https://lpse.kotabogor.go.id", "West Java"),
    ("Malang", "https://lpse.malangkota.go.id", "East Java"),
    ("Denpasar", "https://lpse.denpasarkota.go.id", "Bali"),
    ("Balikpapan", "https://lpse.balikpapan.go.id", "East Kalimantan"),
    ("Batam", "https://lpse.batam.go.id", "Riau Islands"),
    ("Pekanbaru", "https://lpse.pekanbaru.go.id", "Riau"),
    ("Manado", "https://lpse.manadokota.go.id", "North Sulawesi"),
    ("Samarinda", "https://lpse.samarindakota.go.id", "East Kalimantan"),
    ("Banjarmasin", "https://lpse.banjarmasinkota.go.id", "South Kalimantan"),
]

for city, url, province in indonesian_cities:
    entries.append(create_entry(
        source_name=f"LPSE Kota {city}",
        url=url,
        country_code="IDN",
        country_name="Indonesia",
        region=f"{city}, {province}",
        entity_type="Sub-national Government",
        entity_subtype="City Government",
        sectors=["General", "Urban Development", "Infrastructure"],
        language="Indonesian",
        update_frequency="Daily",
        registration_required=True,
        estimated_annual_tenders="200-800",
        api_available=True,
        technical_notes=f"LPSE e-procurement for {city} City"
    ))

# Indonesian Major SOEs (BUMN)
indonesian_soes = [
    ("Pertamina", "https://eproc.pertamina.com", ["Oil & Gas", "Energy", "Petrochemicals"]),
    ("PLN - Perusahaan Listrik Negara", "https://eproc.pln.co.id", ["Energy", "Electricity"]),
    ("Telkom Indonesia", "https://eproc.telkom.co.id", ["ICT", "Telecommunications"]),
    ("Bank Mandiri", "https://eproc.bankmandiri.co.id", ["Banking", "Finance"]),
    ("Bank BRI", "https://eproc.bri.co.id", ["Banking", "Finance"]),
    ("Bank BNI", "https://eproc.bni.co.id", ["Banking", "Finance"]),
    ("Garuda Indonesia", "https://eproc.garuda-indonesia.com", ["Aviation"]),
    ("PT Pelni", "https://eproc.pelni.co.id", ["Maritime", "Shipping"]),
    ("PT Pelindo", "https://eproc.pelindo.co.id", ["Ports", "Maritime"]),
    ("PT Angkasa Pura I", "https://eproc.angkasapura1.co.id", ["Aviation", "Airports"]),
    ("PT Angkasa Pura II", "https://eproc.angkasapura2.co.id", ["Aviation", "Airports"]),
    ("PT KAI - Kereta Api Indonesia", "https://eproc.kai.id", ["Transport", "Railways"]),
    ("PT Pos Indonesia", "https://eproc.posindonesia.co.id", ["Postal", "Logistics"]),
    ("PT Bukit Asam", "https://eproc.ptba.co.id", ["Mining", "Coal"]),
    ("PT Aneka Tambang", "https://eproc.antam.com", ["Mining", "Metals"]),
    ("PT Inalum", "https://eproc.inalum.id", ["Mining", "Aluminum"]),
    ("PT Semen Indonesia", "https://eproc.semenindonesia.com", ["Construction Materials", "Cement"]),
    ("PT Wijaya Karya", "https://eproc.wika.co.id", ["Construction", "Infrastructure"]),
    ("PT Waskita Karya", "https://eproc.waskita.co.id", ["Construction", "Infrastructure"]),
    ("PT Hutama Karya", "https://eproc.hutamakarya.com", ["Construction", "Toll Roads"]),
    ("PT Adhi Karya", "https://eproc.adhi.co.id", ["Construction"]),
    ("PT PP", "https://eproc.ptpp.co.id", ["Construction"]),
    ("PT Kimia Farma", "https://eproc.kimiafarma.co.id", ["Pharmaceuticals", "Health"]),
    ("PT Bio Farma", "https://eproc.biofarma.co.id", ["Pharmaceuticals", "Vaccines"]),
    ("PT Pindad", "https://eproc.pindad.com", ["Defense", "Manufacturing"]),
    ("PT PAL Indonesia", "https://eproc.pal.co.id", ["Defense", "Shipbuilding"]),
    ("PT Dirgantara Indonesia", "https://eproc.indonesian-aerospace.com", ["Defense", "Aerospace"]),
]

for name, url, sectors in indonesian_soes:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code="IDN",
        country_name="Indonesia",
        entity_type="State-Owned Enterprise",
        entity_subtype="BUMN",
        sectors=sectors,
        language="Indonesian",
        update_frequency="Daily",
        registration_required=True,
        estimated_annual_tenders="500-3000",
        api_available=True,
        technical_notes="Major Indonesian state-owned enterprise"
    ))

# =============================================================================
# PAKISTAN - Provincial and Major City Portals
# =============================================================================

pakistani_provinces = [
    ("Punjab", "https://ppra.punjab.gov.pk", "Lahore"),
    ("Sindh", "https://ppra.sindh.gov.pk", "Karachi"),
    ("Khyber Pakhtunkhwa", "https://ppra.kp.gov.pk", "Peshawar"),
    ("Balochistan", "https://ppra.balochistan.gov.pk", "Quetta"),
    ("Gilgit-Baltistan", "https://procurement.gb.gov.pk", "Gilgit"),
    ("Azad Kashmir", "https://ajkpra.gov.pk", "Muzaffarabad"),
]

for province, url, capital in pakistani_provinces:
    entries.append(create_entry(
        source_name=f"{province} Public Procurement Regulatory Authority",
        url=url,
        country_code="PAK",
        country_name="Pakistan",
        region=province,
        entity_type="Sub-national Government",
        entity_subtype="Provincial Government",
        sectors=["General", "Infrastructure", "Health", "Education"],
        language="English",
        update_frequency="Daily",
        registration_required=True,
        estimated_annual_tenders="500-2000",
        technical_notes=f"Provincial procurement authority - {province}"
    ))

# Pakistani Major Cities
pakistani_cities = [
    ("Karachi", "https://kmc.gos.pk/procurement", "Sindh"),
    ("Lahore", "https://lda.gop.pk/procurement", "Punjab"),
    ("Faisalabad", "https://fda.punjab.gov.pk/procurement", "Punjab"),
    ("Rawalpindi", "https://rda.gop.pk/procurement", "Punjab"),
    ("Multan", "https://mda.punjab.gov.pk/procurement", "Punjab"),
    ("Peshawar", "https://pda.kp.gov.pk/procurement", "KPK"),
    ("Quetta", "https://qda.balochistan.gov.pk/procurement", "Balochistan"),
    ("Islamabad", "https://cda.gov.pk/procurement", "ICT"),
    ("Hyderabad", "https://hda.sindh.gov.pk/procurement", "Sindh"),
    ("Gujranwala", "https://gda.punjab.gov.pk/procurement", "Punjab"),
]

for city, url, province in pakistani_cities:
    entries.append(create_entry(
        source_name=f"{city} Development Authority - Procurement",
        url=url,
        country_code="PAK",
        country_name="Pakistan",
        region=f"{city}, {province}",
        entity_type="Sub-national Government",
        entity_subtype="Development Authority",
        sectors=["Urban Development", "Infrastructure", "Housing"],
        language="English",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="100-500",
        technical_notes=f"City development authority - {city}"
    ))

# Pakistani Major SOEs and Utilities
pakistani_soes = [
    ("Pakistan State Oil (PSO)", "https://psopk.com/tenders", ["Oil & Gas", "Energy"]),
    ("Sui Northern Gas Pipelines (SNGPL)", "https://sngpl.com.pk/tenders", ["Gas", "Energy"]),
    ("Sui Southern Gas Company", "https://ssgc.com.pk/tenders", ["Gas", "Energy"]),
    ("Pakistan International Airlines", "https://piac.com.pk/tenders", ["Aviation"]),
    ("Pakistan Railways", "https://pakrail.gov.pk/tenders", ["Transport", "Railways"]),
    ("WAPDA", "https://wapda.gov.pk/tenders", ["Energy", "Water", "Power"]),
    ("PEPCO - Pakistan Electric Power Company", "https://pepco.gov.pk/tenders", ["Energy", "Electricity"]),
    ("NTDC - National Transmission & Despatch", "https://ntdc.gov.pk/tenders", ["Energy", "Transmission"]),
    ("Pakistan Post", "https://pakpost.gov.pk/tenders", ["Postal", "Logistics"]),
    ("Pakistan Broadcasting Corporation", "https://radio.gov.pk/tenders", ["Media", "Broadcasting"]),
    ("PTV - Pakistan Television", "https://ptv.com.pk/tenders", ["Media", "Broadcasting"]),
    ("NHA - National Highway Authority", "https://nha.gov.pk/procurement", ["Transport", "Highways"]),
    ("OGDCL - Oil & Gas Development", "https://ogdcl.com/tenders", ["Oil & Gas"]),
    ("PPL - Pakistan Petroleum", "https://ppl.com.pk/tenders", ["Oil & Gas"]),
    ("Pakistan Steel Mills", "https://paksteel.com.pk/tenders", ["Steel", "Manufacturing"]),
    ("Port Qasim Authority", "https://pqa.gov.pk/procurement", ["Ports", "Maritime"]),
    ("Karachi Port Trust", "https://kpt.gov.pk/procurement", ["Ports", "Maritime"]),
    ("Gwadar Port Authority", "https://gwadarport.gov.pk/procurement", ["Ports", "Maritime"]),
]

for name, url, sectors in pakistani_soes:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code="PAK",
        country_name="Pakistan",
        entity_type="State-Owned Enterprise",
        entity_subtype="Federal Corporation",
        sectors=sectors,
        language="English",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="200-1000",
        technical_notes="Pakistani federal corporation/utility"
    ))

# =============================================================================
# VIETNAM - Provinces and Major SOEs
# =============================================================================

vietnamese_provinces = [
    ("Ho Chi Minh City", "https://msc.gov.vn/muasamcong", "HCMC"),
    ("Hanoi", "https://msc.gov.vn/muasamcong/hanoi", "Hanoi"),
    ("Da Nang", "https://msc.gov.vn/muasamcong/danang", "Da Nang"),
    ("Hai Phong", "https://msc.gov.vn/muasamcong/haiphong", "Hai Phong"),
    ("Can Tho", "https://msc.gov.vn/muasamcong/cantho", "Can Tho"),
    ("Binh Duong", "https://msc.gov.vn/muasamcong/binhduong", "Binh Duong"),
    ("Dong Nai", "https://msc.gov.vn/muasamcong/dongnai", "Dong Nai"),
    ("Quang Ninh", "https://msc.gov.vn/muasamcong/quangninh", "Quang Ninh"),
    ("Khanh Hoa", "https://msc.gov.vn/muasamcong/khanhhoa", "Khanh Hoa"),
    ("Thanh Hoa", "https://msc.gov.vn/muasamcong/thanhhoa", "Thanh Hoa"),
    ("Nghe An", "https://msc.gov.vn/muasamcong/nghean", "Nghe An"),
    ("Ha Tinh", "https://msc.gov.vn/muasamcong/hatinh", "Ha Tinh"),
    ("Quang Nam", "https://msc.gov.vn/muasamcong/quangnam", "Quang Nam"),
    ("Binh Thuan", "https://msc.gov.vn/muasamcong/binhthuan", "Binh Thuan"),
    ("Lam Dong", "https://msc.gov.vn/muasamcong/lamdong", "Lam Dong"),
    ("Long An", "https://msc.gov.vn/muasamcong/longan", "Long An"),
    ("Tay Ninh", "https://msc.gov.vn/muasamcong/tayninh", "Tay Ninh"),
    ("Ba Ria - Vung Tau", "https://msc.gov.vn/muasamcong/brvt", "BRVT"),
]

for province, url, short in vietnamese_provinces:
    entries.append(create_entry(
        source_name=f"{province} Public Procurement Portal",
        url=url,
        country_code="VNM",
        country_name="Vietnam",
        region=province,
        entity_type="Sub-national Government",
        entity_subtype="Province/City",
        sectors=["General", "Infrastructure", "Manufacturing"],
        language="Vietnamese",
        update_frequency="Daily",
        registration_required=True,
        estimated_annual_tenders="300-1500",
        technical_notes=f"Provincial procurement - {province}"
    ))

# Vietnamese Major SOEs
vietnamese_soes = [
    ("PetroVietnam (PVN)", "https://pvn.vn/en/tenders", ["Oil & Gas", "Energy"]),
    ("EVN - Vietnam Electricity", "https://evn.com.vn/tenders", ["Energy", "Electricity"]),
    ("VNPT - Vietnam Posts and Telecommunications", "https://vnpt.vn/tenders", ["ICT", "Telecommunications"]),
    ("Viettel", "https://viettel.vn/tenders", ["ICT", "Telecommunications", "Defense"]),
    ("Vietnam Airlines", "https://vietnamairlines.com/tenders", ["Aviation"]),
    ("Vietnam Railways", "https://vr.com.vn/tenders", ["Transport", "Railways"]),
    ("Vinacomin - Vietnam Coal and Mineral", "https://vinacomin.vn/tenders", ["Mining", "Coal"]),
    ("Vinatex - Vietnam Textile", "https://vinatex.com.vn/tenders", ["Textiles", "Manufacturing"]),
    ("Vietnam Rubber Group", "https://vnrubbergroup.com/tenders", ["Agriculture", "Rubber"]),
    ("Vinamilk", "https://vinamilk.com.vn/tenders", ["Food & Beverage", "Dairy"]),
    ("Vietcombank", "https://vietcombank.com.vn/tenders", ["Banking", "Finance"]),
    ("BIDV", "https://bidv.com.vn/tenders", ["Banking", "Finance"]),
    ("Agribank", "https://agribank.com.vn/tenders", ["Banking", "Finance"]),
    ("Vietnam Post", "https://vnpost.vn/tenders", ["Postal", "Logistics"]),
    ("ACV - Airports Corporation of Vietnam", "https://acv.vn/tenders", ["Aviation", "Airports"]),
    ("Vietnam Maritime Corporation", "https://vinalines.com.vn/tenders", ["Maritime", "Shipping"]),
]

for name, url, sectors in vietnamese_soes:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code="VNM",
        country_name="Vietnam",
        entity_type="State-Owned Enterprise",
        entity_subtype="General Corporation",
        sectors=sectors,
        language="Vietnamese",
        update_frequency="Daily",
        registration_required=True,
        estimated_annual_tenders="200-1500",
        technical_notes="Vietnamese state general corporation"
    ))

# =============================================================================
# THAILAND - Provinces and Major SOEs
# =============================================================================

thai_provinces = [
    ("Bangkok", "https://gprocurement.go.th/new/region/bangkok"),
    ("Chiang Mai", "https://gprocurement.go.th/new/region/chiangmai"),
    ("Phuket", "https://gprocurement.go.th/new/region/phuket"),
    ("Khon Kaen", "https://gprocurement.go.th/new/region/khonkaen"),
    ("Nakhon Ratchasima", "https://gprocurement.go.th/new/region/korat"),
    ("Udon Thani", "https://gprocurement.go.th/new/region/udonthani"),
    ("Chonburi", "https://gprocurement.go.th/new/region/chonburi"),
    ("Songkhla", "https://gprocurement.go.th/new/region/songkhla"),
    ("Surat Thani", "https://gprocurement.go.th/new/region/suratthani"),
    ("Rayong", "https://gprocurement.go.th/new/region/rayong"),
    ("Nonthaburi", "https://gprocurement.go.th/new/region/nonthaburi"),
    ("Pathum Thani", "https://gprocurement.go.th/new/region/pathumthani"),
]

for province, url in thai_provinces:
    entries.append(create_entry(
        source_name=f"{province} Provincial Procurement",
        url=url,
        country_code="THA",
        country_name="Thailand",
        region=province,
        entity_type="Sub-national Government",
        entity_subtype="Provincial Administration",
        sectors=["General", "Infrastructure", "Tourism"],
        language="Thai",
        update_frequency="Daily",
        registration_required=True,
        estimated_annual_tenders="200-1000",
        technical_notes=f"Provincial procurement - {province}"
    ))

# Thai Major SOEs
thai_soes = [
    ("PTT Public Company Limited", "https://www.pttplc.com/en/Supplier.aspx", ["Oil & Gas", "Energy", "Petrochemicals"]),
    ("Electricity Generating Authority (EGAT)", "https://www.egat.co.th/procurement", ["Energy", "Electricity"]),
    ("Provincial Electricity Authority (PEA)", "https://www.pea.co.th/procurement", ["Energy", "Electricity Distribution"]),
    ("Metropolitan Electricity Authority (MEA)", "https://www.mea.or.th/procurement", ["Energy", "Electricity"]),
    ("Thai Airways", "https://www.thaiairways.com/procurement", ["Aviation"]),
    ("State Railway of Thailand", "https://www.railway.co.th/procurement", ["Transport", "Railways"]),
    ("CAT Telecom", "https://www.cattelecom.com/procurement", ["ICT", "Telecommunications"]),
    ("TOT Public Company", "https://www.tot.co.th/procurement", ["ICT", "Telecommunications"]),
    ("Metropolitan Waterworks Authority", "https://www.mwa.co.th/procurement", ["Water", "Utilities"]),
    ("Provincial Waterworks Authority", "https://www.pwa.co.th/procurement", ["Water", "Utilities"]),
    ("Airports of Thailand (AOT)", "https://www.airportthai.co.th/procurement", ["Aviation", "Airports"]),
    ("Port Authority of Thailand", "https://www.port.co.th/procurement", ["Ports", "Maritime"]),
    ("Mass Rapid Transit Authority", "https://www.mrta.co.th/procurement", ["Transport", "Rail"]),
    ("Bangkok Mass Transit Authority (BMTA)", "https://www.bmta.co.th/procurement", ["Transport", "Bus"]),
    ("Krung Thai Bank", "https://www.ktb.co.th/procurement", ["Banking", "Finance"]),
    ("Government Savings Bank", "https://www.gsb.or.th/procurement", ["Banking", "Finance"]),
]

for name, url, sectors in thai_soes:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code="THA",
        country_name="Thailand",
        entity_type="State-Owned Enterprise",
        entity_subtype="State Enterprise",
        sectors=sectors,
        language="Thai",
        update_frequency="Daily",
        registration_required=True,
        estimated_annual_tenders="300-2000",
        technical_notes="Thai state enterprise procurement"
    ))

# =============================================================================
# MALAYSIA - States and Major GLCs
# =============================================================================

malaysian_states = [
    ("Selangor", "https://eperolehan.selangor.gov.my"),
    ("Johor", "https://eperolehan.johor.gov.my"),
    ("Sabah", "https://eperolehan.sabah.gov.my"),
    ("Sarawak", "https://eperolehan.sarawak.gov.my"),
    ("Penang", "https://eperolehan.penang.gov.my"),
    ("Perak", "https://eperolehan.perak.gov.my"),
    ("Pahang", "https://eperolehan.pahang.gov.my"),
    ("Kelantan", "https://eperolehan.kelantan.gov.my"),
    ("Kedah", "https://eperolehan.kedah.gov.my"),
    ("Terengganu", "https://eperolehan.terengganu.gov.my"),
    ("Negeri Sembilan", "https://eperolehan.ns.gov.my"),
    ("Melaka", "https://eperolehan.melaka.gov.my"),
    ("Perlis", "https://eperolehan.perlis.gov.my"),
]

for state, url in malaysian_states:
    entries.append(create_entry(
        source_name=f"{state} State E-Procurement Portal",
        url=url,
        country_code="MYS",
        country_name="Malaysia",
        region=state,
        entity_type="Sub-national Government",
        entity_subtype="State Government",
        sectors=["General", "Infrastructure", "Agriculture"],
        language="Malay",
        update_frequency="Daily",
        registration_required=True,
        estimated_annual_tenders="200-800",
        technical_notes=f"State e-procurement - {state}"
    ))

# Malaysian GLCs
malaysian_glcs = [
    ("Petronas", "https://vendor.petronas.com", ["Oil & Gas", "Energy", "Petrochemicals"]),
    ("Tenaga Nasional Berhad (TNB)", "https://vendor.tnb.com.my", ["Energy", "Electricity"]),
    ("Telekom Malaysia", "https://vendor.tm.com.my", ["ICT", "Telecommunications"]),
    ("Malaysia Airlines", "https://vendor.malaysiaairlines.com", ["Aviation"]),
    ("KTMB - Keretapi Tanah Melayu", "https://vendor.ktmb.com.my", ["Transport", "Railways"]),
    ("Prasarana Malaysia", "https://vendor.prasarana.com.my", ["Transport", "Rail"]),
    ("Malaysia Airports Holdings", "https://vendor.malaysiaairports.com.my", ["Aviation", "Airports"]),
    ("Sime Darby", "https://vendor.simedarby.com", ["Conglomerate", "Plantations"]),
    ("Maybank", "https://vendor.maybank.com", ["Banking", "Finance"]),
    ("CIMB Group", "https://vendor.cimb.com", ["Banking", "Finance"]),
    ("Pos Malaysia", "https://vendor.pos.com.my", ["Postal", "Logistics"]),
    ("Axiata Group", "https://vendor.axiata.com", ["ICT", "Telecommunications"]),
    ("UEM Group", "https://vendor.uem.com.my", ["Construction", "Infrastructure"]),
]

for name, url, sectors in malaysian_glcs:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code="MYS",
        country_name="Malaysia",
        entity_type="Government-Linked Company",
        entity_subtype="GLC",
        sectors=sectors,
        language="English",
        update_frequency="Daily",
        registration_required=True,
        estimated_annual_tenders="300-2000",
        technical_notes="Malaysian government-linked company"
    ))

# =============================================================================
# PHILIPPINES - Regions and Major GOCCs
# =============================================================================

philippine_regions = [
    ("NCR - Metro Manila", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=NCR"),
    ("Region I - Ilocos", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=1"),
    ("Region II - Cagayan Valley", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=2"),
    ("Region III - Central Luzon", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=3"),
    ("Region IV-A - CALABARZON", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=4A"),
    ("Region V - Bicol", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=5"),
    ("Region VI - Western Visayas", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=6"),
    ("Region VII - Central Visayas", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=7"),
    ("Region VIII - Eastern Visayas", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=8"),
    ("Region IX - Zamboanga Peninsula", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=9"),
    ("Region X - Northern Mindanao", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=10"),
    ("Region XI - Davao", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=11"),
    ("Region XII - SOCCSKSARGEN", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=12"),
    ("CARAGA", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=caraga"),
    ("CAR - Cordillera", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=car"),
    ("BARMM", "https://www.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesUI.aspx?region=barmm"),
]

for region, url in philippine_regions:
    entries.append(create_entry(
        source_name=f"PhilGEPS - {region}",
        url=url,
        country_code="PHL",
        country_name="Philippines",
        region=region,
        entity_type="Sub-national Government",
        entity_subtype="Regional Government",
        sectors=["General", "Infrastructure", "Health", "Education"],
        language="English",
        update_frequency="Daily",
        registration_required=True,
        estimated_annual_tenders="300-1500",
        api_available=True,
        technical_notes=f"PhilGEPS regional filter - {region}"
    ))

# Philippine GOCCs
philippine_goccs = [
    ("PNOC - Philippine National Oil Company", "https://www.pnoc.com.ph/procurement", ["Oil & Gas", "Energy"]),
    ("NPC - National Power Corporation", "https://www.napocor.gov.ph/procurement", ["Energy", "Electricity"]),
    ("MWSS - Metropolitan Waterworks", "https://mwss.gov.ph/procurement", ["Water", "Sanitation"]),
    ("LWUA - Local Water Utilities", "https://lwua.gov.ph/procurement", ["Water", "Sanitation"]),
    ("NIA - National Irrigation Administration", "https://www.nia.gov.ph/procurement", ["Water", "Agriculture"]),
    ("PPA - Philippine Ports Authority", "https://www.ppa.com.ph/procurement", ["Ports", "Maritime"]),
    ("CAAP - Civil Aviation Authority", "https://www.caap.gov.ph/procurement", ["Aviation"]),
    ("MIAA - Manila International Airport", "https://www.miaa.gov.ph/procurement", ["Aviation", "Airports"]),
    ("LTO - Land Transportation Office", "https://www.lto.gov.ph/procurement", ["Transport"]),
    ("PNR - Philippine National Railways", "https://www.pnr.gov.ph/procurement", ["Transport", "Railways"]),
    ("NHA - National Housing Authority", "https://www.nha.gov.ph/procurement", ["Housing", "Construction"]),
    ("GSIS - Government Service Insurance", "https://www.gsis.gov.ph/procurement", ["Insurance", "Finance"]),
    ("SSS - Social Security System", "https://www.sss.gov.ph/procurement", ["Insurance", "Finance"]),
    ("PhilHealth", "https://www.philhealth.gov.ph/procurement", ["Health", "Insurance"]),
    ("PAGCOR", "https://www.pagcor.ph/procurement", ["Gaming", "Entertainment"]),
]

for name, url, sectors in philippine_goccs:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code="PHL",
        country_name="Philippines",
        entity_type="Government-Owned Corporation",
        entity_subtype="GOCC",
        sectors=sectors,
        language="English",
        update_frequency="Daily",
        registration_required=True,
        estimated_annual_tenders="200-1000",
        technical_notes="Philippine government-owned corporation"
    ))

# =============================================================================
# BANGLADESH - Divisions and Major SOEs
# =============================================================================

bangladeshi_divisions = [
    ("Dhaka", "https://eprocure.gov.bd/dhaka"),
    ("Chittagong", "https://eprocure.gov.bd/chittagong"),
    ("Rajshahi", "https://eprocure.gov.bd/rajshahi"),
    ("Khulna", "https://eprocure.gov.bd/khulna"),
    ("Sylhet", "https://eprocure.gov.bd/sylhet"),
    ("Barisal", "https://eprocure.gov.bd/barisal"),
    ("Rangpur", "https://eprocure.gov.bd/rangpur"),
    ("Mymensingh", "https://eprocure.gov.bd/mymensingh"),
]

for division, url in bangladeshi_divisions:
    entries.append(create_entry(
        source_name=f"e-GP Bangladesh - {division} Division",
        url=url,
        country_code="BGD",
        country_name="Bangladesh",
        region=division,
        entity_type="Sub-national Government",
        entity_subtype="Division",
        sectors=["General", "Infrastructure", "Textiles"],
        language="Bengali",
        update_frequency="Daily",
        registration_required=True,
        estimated_annual_tenders="200-1000",
        technical_notes=f"Divisional procurement - {division}"
    ))

# Bangladeshi SOEs
bangladeshi_soes = [
    ("Petrobangla", "https://www.petrobangla.org.bd/tender", ["Oil & Gas", "Energy"]),
    ("BPDB - Bangladesh Power Development Board", "https://www.bpdb.gov.bd/tender", ["Energy", "Electricity"]),
    ("DESCO", "https://www.desco.org.bd/tender", ["Energy", "Electricity Distribution"]),
    ("DPDC", "https://www.dpdc.org.bd/tender", ["Energy", "Electricity Distribution"]),
    ("PGCB - Power Grid Company", "https://www.pgcb.org.bd/tender", ["Energy", "Transmission"]),
    ("DWASA - Dhaka Water Supply", "https://www.dwasa.org.bd/tender", ["Water", "Sanitation"]),
    ("CWASA - Chittagong Water Supply", "https://www.cwasa.org.bd/tender", ["Water", "Sanitation"]),
    ("Bangladesh Railway", "https://www.railway.gov.bd/tender", ["Transport", "Railways"]),
    ("BTCL - Bangladesh Telecommunications", "https://www.btcl.gov.bd/tender", ["ICT", "Telecommunications"]),
    ("Biman Bangladesh Airlines", "https://www.bfrbd.com/tender", ["Aviation"]),
    ("Bangladesh Shipping Corporation", "https://www.bsc.gov.bd/tender", ["Maritime", "Shipping"]),
    ("Chittagong Port Authority", "https://www.cpa.gov.bd/tender", ["Ports", "Maritime"]),
    ("Mongla Port Authority", "https://www.mpa.gov.bd/tender", ["Ports", "Maritime"]),
    ("BIWTA - Inland Water Transport", "https://www.biwta.gov.bd/tender", ["Transport", "Maritime"]),
    ("CAAB - Civil Aviation Authority", "https://www.caab.gov.bd/tender", ["Aviation"]),
]

for name, url, sectors in bangladeshi_soes:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code="BGD",
        country_name="Bangladesh",
        entity_type="State-Owned Enterprise",
        entity_subtype="Public Corporation",
        sectors=sectors,
        language="Bengali",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="100-500",
        technical_notes="Bangladeshi public corporation"
    ))

# =============================================================================
# SRI LANKA - Provinces and Major SOEs
# =============================================================================

srilankan_provinces = [
    ("Western Province", "https://www.gic.gov.lk/gic/index.php/en/procurement/western"),
    ("Central Province", "https://www.gic.gov.lk/gic/index.php/en/procurement/central"),
    ("Southern Province", "https://www.gic.gov.lk/gic/index.php/en/procurement/southern"),
    ("Northern Province", "https://www.gic.gov.lk/gic/index.php/en/procurement/northern"),
    ("Eastern Province", "https://www.gic.gov.lk/gic/index.php/en/procurement/eastern"),
    ("North Western Province", "https://www.gic.gov.lk/gic/index.php/en/procurement/north-western"),
    ("North Central Province", "https://www.gic.gov.lk/gic/index.php/en/procurement/north-central"),
    ("Uva Province", "https://www.gic.gov.lk/gic/index.php/en/procurement/uva"),
    ("Sabaragamuwa Province", "https://www.gic.gov.lk/gic/index.php/en/procurement/sabaragamuwa"),
]

for province, url in srilankan_provinces:
    entries.append(create_entry(
        source_name=f"Sri Lanka - {province} Procurement",
        url=url,
        country_code="LKA",
        country_name="Sri Lanka",
        region=province,
        entity_type="Sub-national Government",
        entity_subtype="Provincial Council",
        sectors=["General", "Infrastructure", "Agriculture"],
        language="English",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="50-300",
        technical_notes=f"Provincial procurement - {province}"
    ))

# Sri Lankan SOEs
srilankan_soes = [
    ("Ceylon Petroleum Corporation", "https://www.ceypetco.gov.lk/tenders", ["Oil & Gas", "Energy"]),
    ("Ceylon Electricity Board", "https://www.ceb.lk/tenders", ["Energy", "Electricity"]),
    ("Sri Lanka Telecom", "https://www.slt.lk/tenders", ["ICT", "Telecommunications"]),
    ("National Water Supply & Drainage Board", "https://www.waterboard.lk/tenders", ["Water", "Sanitation"]),
    ("Sri Lanka Railways", "https://www.railway.gov.lk/tenders", ["Transport", "Railways"]),
    ("Sri Lanka Ports Authority", "https://www.slpa.lk/tenders", ["Ports", "Maritime"]),
    ("Airport & Aviation Services", "https://www.airport.lk/tenders", ["Aviation", "Airports"]),
    ("SriLankan Airlines", "https://www.srilankan.com/tenders", ["Aviation"]),
    ("Sri Lanka Transport Board", "https://www.sltb.lk/tenders", ["Transport", "Bus"]),
    ("Bank of Ceylon", "https://www.boc.lk/tenders", ["Banking", "Finance"]),
    ("People's Bank", "https://www.peoplesbank.lk/tenders", ["Banking", "Finance"]),
]

for name, url, sectors in srilankan_soes:
    entries.append(create_entry(
        source_name=name,
        url=url,
        country_code="LKA",
        country_name="Sri Lanka",
        entity_type="State-Owned Enterprise",
        entity_subtype="Public Corporation",
        sectors=sectors,
        language="English",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="100-400",
        technical_notes="Sri Lankan public corporation"
    ))

print(f"Asia Expansion entries: {len(entries)}")

# Save to JSON
with open('/sessions/peaceful-zen-gauss/tender_db/expansion_asia.json', 'w') as f:
    json.dump(entries, f, indent=2)

print(f"Saved {len(entries)} entries to expansion_asia.json")
