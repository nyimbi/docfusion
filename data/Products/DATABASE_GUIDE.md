# Datacraft Tender Intelligence Database 2026
## Comprehensive Tender Portal Database for Software, IT & Allied Opportunities

**Company:** Datacraft (www.datacraft.co.ke)
**Database Version:** 1.0
**Date:** February 1, 2026
**Total Entries:** 1,012 tender portals

---

## Executive Summary

This database represents a comprehensive compilation of 1,012+ web locations for identifying tender opportunities in software, IT, and allied services across Africa and the global south. The database is specifically designed for automated scraping and systematic tender intelligence gathering.

### Coverage Breakdown

- **African Government Portals:** 54 countries with national and sub-national coverage
- **Global South Government Portals:** 58 countries across Asia, Latin America, Caribbean, Middle East
- **Multilateral Development Banks:** 16 major institutions (World Bank, AfDB, ADB, IDB, IsDB, etc.)
- **UN Agencies:** 15+ major agencies (UNDP, UNICEF, WHO, FAO, WFP, etc.)
- **Commercial Aggregators:** 300+ country and sector-specific pages across 10 major platforms
- **Bilateral Development Agencies:** 15 major donor countries (USAID, DFID, GIZ, etc.)
- **International NGOs:** 20+ major organizations
- **Sector-Specific Platforms:** 30+ specialized IT/software procurement portals
- **Regional Organizations:** EAC, ECOWAS, SADC, COMESA, and other RECs

---

## Database Structure

### Master Database Sheet

The primary sheet contains **26 columns** with comprehensive metadata for each portal:

1. **ID** - Unique identifier
2. **Portal Name** - Official name of the portal
3. **Portal Type** - Category (Government Portal, Commercial Aggregator, MDB Portal, etc.)
4. **Category** - Sub-category classification
5. **URL** - Direct link to tender portal
6. **Country/Region** - Geographic coverage
7. **Geographic Coverage** - Scope (National, Regional, Global)
8. **Language(s)** - Available languages
9. **Registration Required** - Yes/No
10. **Registration Cost** - Free or subscription amount
11. **Registration Time** - Average time to register
12. **Update Frequency** - How often tenders are posted
13. **IT/Software Tenders** - Frequency/volume of IT opportunities
14. **Tender Volume** - Estimated volume
15. **API Available** - Yes/No/Partial
16. **API Type** - Type of API or data access
17. **Scraping Difficulty** - Low/Medium/High/Very High
18. **Scraping Notes** - Technical details for automation
19. **Authentication Required** - Login requirements
20. **Data Format** - Available formats (JSON, XML, PDF, etc.)
21. **Mobile App** - Mobile application availability
22. **Email Alerts** - Alert system availability
23. **Typical Contract Values** - Expected tender sizes
24. **Payment Terms** - Standard payment terms
25. **Priority Tier** - Tier 1-4 classification
26. **Notes** - Additional context and details

### Analysis & Metrics Sheet

Contains automated summary statistics, regional breakdowns, and usage guidance.

---

## Priority Tier Classification

### Tier 1 (Highest Priority) - 250+ portals
- **Characteristics:** Daily updates, high IT/software volume, API access or low scraping difficulty
- **Examples:**
  - India GeM (7,721 tenders/day)
  - Nigeria BPP (1,000+/month)
  - World Bank Group
  - UNDP
  - South Africa eTenders
  - Mexico CompraNet (Full API, OCDS)
- **Recommendation:** Priority targets for automated scraping

### Tier 2 (Medium Priority) - 400+ portals
- **Characteristics:** Weekly updates, medium IT volume, structured data
- **Examples:**
  - Uganda GPP
  - Zambia ZPPA
  - AFD France
  - SIDA Sweden
  - Most state/provincial portals
- **Recommendation:** Secondary automation targets

### Tier 3 (Monitor) - 300+ portals
- **Characteristics:** Monthly updates, lower IT volume, developing systems
- **Examples:**
  - Smaller African countries
  - Emerging markets
  - Specialized foundations
  - Low-frequency sectors
- **Recommendation:** Periodic manual monitoring

### Tier 4 (Watch List) - 60+ portals
- **Characteristics:** Quarterly updates, conflict zones, very limited access
- **Examples:**
  - Afghanistan, Yemen, Libya
  - Conflict-affected regions
  - Very small markets
- **Recommendation:** Monitor for stability improvements

---

## Scraping Complexity Assessment

### Low Difficulty (700+ portals)
- **Features:** API access, RSS feeds, structured HTML, OCDS compliance
- **Automation:** Direct API integration or simple HTML parsing
- **Examples:**
  - Rwanda UMUCYO (OCDS API)
  - Mexico CompraNet (Full REST API)
  - All major commercial aggregators (BidDetail, GlobalTenders, etc.)

### Medium Difficulty (250+ portals)
- **Features:** Stable structure, requires authentication, standard formats
- **Automation:** Authenticated scraping, form submission
- **Examples:**
  - Most African government portals
  - UNGM registration systems
  - State-level portals

### High Difficulty (50+ portals)
- **Features:** Dynamic content, CAPTCHA, frequent structure changes
- **Automation:** Requires sophisticated scraping or browser automation
- **Examples:**
  - Some Francophone African portals
  - Portals with heavy anti-bot measures

### Very High Difficulty (12+ portals)
- **Features:** Limited online presence, manual processes, access restrictions
- **Automation:** May require manual monitoring or insider access
- **Examples:**
  - Turkmenistan, Libya, CAR
  - Conflict zones

---

## Implementation Roadmap

### Phase 1: Quick Wins (Weeks 1-4)
**Target:** 50 highest-value portals

1. **Commercial Aggregators (15 portals)**
   - BidDetail Global + 5 country pages
   - GlobalTenders Africa
   - TendersOnTime Global
   - TendersGo with AI matching
   - dgMarket

2. **Tier 1 African Government Portals (15 portals)**
   - Rwanda, South Africa, Ghana, Kenya, Tanzania
   - Nigeria, Ethiopia, Egypt, Morocco
   - Additional EAC and ECOWAS members

3. **Major MDBs and UN (10 portals)**
   - World Bank, AfDB, ADB, IDB
   - UNDP, UNICEF, WHO, FAO

4. **US and European Donors (10 portals)**
   - USAID via SAM.gov
   - DFID/FCDO
   - GIZ
   - AFD

**Expected Coverage:** ~60% of high-value opportunities

### Phase 2: Comprehensive Coverage (Months 2-3)
**Target:** 200 additional portals

1. Tier 2 African countries
2. All Global South Tier 1 countries
3. Additional bilateral agencies
4. Major NGOs
5. Sector-specific platforms

**Expected Coverage:** ~85% of opportunities

### Phase 3: Full Database Integration (Months 4-6)
**Target:** Remaining 700+ portals

1. All remaining government portals
2. State/provincial portals
3. Municipal portals
4. All aggregator country pages
5. Specialized and niche platforms

**Expected Coverage:** ~95% of opportunities

---

## Technical Implementation Notes

### API Integration Priority
**Immediate API Integration (Full Access):**
1. India GeM - https://gem.gov.in/api-documentation
2. Mexico CompraNet - OCDS compliant
3. Colombia SECOP II - REST API
4. Chile ChileCompra - Full API since 2000
5. World Bank - http://search.worldbank.org/api/procnotices
6. All major commercial aggregators (BidDetail, GlobalTenders, TendersOnTime, TendersGo, Tender Impulse)

**Partial API/Structured Data:**
1. South Africa CSD integration
2. Most commercial aggregators (RSS/Email)
3. UN Quantum portal system
4. TED (EU) - Open Data
5. SAM.gov Opportunities API

### Authentication Strategies

**UNGM Registration (Required for UN Agencies):**
- Central registration covers 20+ UN agencies
- Free registration
- Three levels: Basic, Standard (needed), Advanced
- Timeline: 15 minutes to 2 weeks depending on level
- URL: https://www.ungm.org/

**SAM.gov Registration (Required for US Federal):**
- Required for USAID and US government contracts
- Free registration
- Timeline: 1-2 weeks
- Covers all US federal agencies
- URL: https://sam.gov/

**Individual Portal Registration:**
- Budget 2-4 weeks per major government portal
- Most African portals: Free registration
- Documents needed: Business registration, tax compliance, bank details

### Data Standardization

**Recommended Field Extraction:**
1. Tender ID/Reference Number
2. Title/Description
3. Issuing Organization
4. Country/Region
5. Publication Date
6. Deadline Date
7. Tender Category/Sector
8. Estimated Value
9. IT/Software relevance score
10. Eligibility requirements
11. Document links
12. Contact information

### Alert Configuration

**High-Frequency Keywords for IT/Software:**
- Software development
- Custom software
- ERP system
- Cloud services/migration
- Cybersecurity
- Data analytics
- Business intelligence
- System integration
- Mobile application
- Web development
- Database management
- Network infrastructure
- IT consulting
- Technical support
- Software maintenance

---

## Regional Focus Strategies

### Anglophone Africa (Priority 1)
**Why:** English language, established e-procurement, strong GDP growth

**Key Markets:**
1. Nigeria - Largest market (USD 20B+ annual procurement)
2. South Africa - Most mature system
3. Kenya - Tech hub, high IT procurement
4. Ghana - Strong governance and transparency
5. Tanzania, Uganda, Rwanda - EAC integration

**Strategy:** Automated daily scraping, real-time alerts

### Francophone Africa (Priority 2)
**Why:** Large markets, less competition, donor funding

**Key Markets:**
1. Senegal - Regional hub
2. Côte d'Ivoire - Fastest growing
3. Cameroon - Central Africa gateway
4. DRC - Large infrastructure needs
5. Morocco, Algeria, Tunisia - North Africa

**Strategy:** Translation pipeline, local partnerships

### Global South Tier 1 (Priority 3)
**Why:** Massive volumes, established systems, English available

**Key Markets:**
1. India - Largest e-marketplace globally (GeM)
2. Indonesia - ASEAN's largest economy
3. Brazil - Latin America's giant
4. Mexico - NAFTA integration
5. Vietnam, Philippines, Thailand - ASEAN growth

**Strategy:** API integration first, focus on federal systems

---

## Compliance and Risk Considerations

### Data Privacy
- GDPR compliance for EU-funded projects
- POPIA compliance for South Africa
- Local data protection laws vary by country
- Public tender data generally exempt from privacy restrictions
- Respect robots.txt and terms of service

### Anti-Corruption
- All portals are official government or recognized commercial platforms
- No facilitation payments required or accepted
- Registration fees are legitimate administrative costs
- Maintain complete audit trail of sourcing
- Report any suspicious payment requests

### Sanctions Compliance
- Some countries subject to international sanctions (verify current status):
  - Sudan, Zimbabwe, DRC (partial sanctions)
  - Sanctioned individuals/entities lists
- OFAC compliance for US-funded projects
- EU sanctions compliance
- Check sanctions before bidding

### Ethical Scraping
- Respect rate limits (typically 1 request/second)
- Implement exponential backoff on errors
- Identify scraper with User-Agent
- Cache results to minimize requests
- Honor robots.txt directives
- Avoid peak hours for government sites

---

## Success Metrics and KPIs

### Coverage Metrics
- **Geographic Coverage:** 112+ countries
- **Portal Types:** 10+ categories
- **Update Sources:** 1,012 distinct URLs
- **API-Enabled Sources:** 200+ portals
- **Daily Update Sources:** 400+ portals

### Quality Metrics
- **Relevance Score:** IT/software frequency classification
- **Access Score:** Free vs. subscription vs. restricted
- **Automation Score:** Scraping difficulty assessment
- **Value Score:** Typical contract sizes and volumes

### Expected Business Impact
**Conservative Estimates (Tier 1 portals only):**
- Tender visibility: 10,000+ opportunities/month
- IT-relevant tenders: 2,000+ opportunities/month
- Addressable opportunities (after filtering): 200-400/month
- Bid conversion rate (industry average): 5-15%
- **Expected wins:** 10-60 projects/month

**Revenue Potential (based on average contract values):**
- Average IT contract: USD 200K
- Conservative 10 wins/month: USD 2M/month
- **Annual potential:** USD 24M+

---

## Maintenance and Updates

### Quarterly Updates Required
1. **Portal Status Check:** Verify URLs still active
2. **New Portal Discovery:** Monitor for new government systems
3. **API Changes:** Update integration code for API changes
4. **Registration Renewals:** Some portals require annual renewal
5. **Tender Classification:** Update keywords based on wins/losses

### Annual Updates Required
1. **Comprehensive Portal Audit:** Full verification of all 1,012 entries
2. **Market Analysis:** Update tender volumes and frequencies
3. **Technology Assessment:** New procurement platforms launched
4. **Geographic Expansion:** New countries/regions added
5. **Competitive Intelligence:** Track competitor presence

### Red Flags to Monitor
- Portals with declining tender volumes
- Increased access restrictions
- Payment demands outside registration fees
- Suspicious or fraudulent tenders
- Portals redirecting to third parties
- Excessive CAPTCHA implementation

---

## Support and Resources

### Official Documentation Links
- World Bank Procurement: https://projects.worldbank.org/en/projects-operations/procurement
- UNGM Help Center: https://www.ungm.org/Public/Help
- African Development Bank: https://www.afdb.org/en/projects-and-operations/procurement
- USAID Acquisition: https://www.usaid.gov/work-usaid/get-grant-or-contract
- EU Procurement: https://ted.europa.eu/

### Industry Resources
- Open Contracting Partnership: https://www.open-contracting.org/
- Transparency International: https://www.transparency.org/
- African Procurement Law Association: Check regional chapters
- International Federation of Consulting Engineers (FIDIC): https://fidic.org/

### Technical Resources
- OCDS Documentation: https://standard.open-contracting.org/
- BeautifulSoup (Python scraping): https://www.crummy.com/software/BeautifulSoup/
- Scrapy Framework: https://scrapy.org/
- Selenium WebDriver: https://www.selenium.dev/

---

## Contact Information

**Datacraft**
Website: www.datacraft.co.ke
Email: nyimbi@gmail.com
Focus: Bespoke software development, IT services, allied opportunities

**Database Compiler:**
Compilation Date: February 1, 2026
Version: 1.0
Next Scheduled Update: May 1, 2026

---

## Appendices

### Appendix A: Acronym Glossary
- **AfDB** - African Development Bank
- **ADB** - Asian Development Bank
- **API** - Application Programming Interface
- **BRICS** - Brazil, Russia, India, China, South Africa
- **CSD** - Central Supplier Database (South Africa)
- **DFI** - Development Finance Institution
- **EAC** - East African Community
- **ECOWAS** - Economic Community of West African States
- **ICB** - International Competitive Bidding
- **IDB** - Inter-American Development Bank
- **IsDB** - Islamic Development Bank
- **IT** - Information Technology
- **LAC** - Latin America and Caribbean
- **MDB** - Multilateral Development Bank
- **NCB** - National Competitive Bidding
- **NGO** - Non-Governmental Organization
- **OCDS** - Open Contracting Data Standard
- **PPRA** - Public Procurement Regulatory Authority
- **REC** - Regional Economic Community
- **RFI** - Request for Information
- **RFP** - Request for Proposal
- **RFQ** - Request for Quotation
- **SADC** - Southern African Development Community
- **UNGM** - United Nations Global Marketplace

### Appendix B: Recommended Tools Stack
**Web Scraping:**
- Python 3.9+ with Scrapy framework
- BeautifulSoup4 for HTML parsing
- Selenium for JavaScript-heavy sites
- Requests library for API calls

**Data Management:**
- PostgreSQL or MySQL for tender database
- Redis for caching
- Elasticsearch for search functionality
- MongoDB for unstructured data

**Monitoring and Alerts:**
- Apache Airflow for workflow orchestration
- Prometheus for monitoring
- Grafana for dashboards
- Slack/Email for alert delivery

**NLP and Classification:**
- spaCy or NLTK for text processing
- Scikit-learn for classification
- Keywords matching for IT relevance scoring

### Appendix C: Sample Scraping Code Structure
```python
# High-level pseudocode structure

class TenderScraperBase:
    def __init__(self, portal_config):
        self.portal = portal_config
        self.session = create_session()

    def authenticate(self):
        # Handle login if required
        pass

    def fetch_tenders(self):
        # Main scraping logic
        pass

    def parse_tender(self, html):
        # Extract structured data
        pass

    def classify_relevance(self, tender):
        # IT/Software relevance scoring
        pass

    def store_tender(self, tender_data):
        # Save to database
        pass

    def run(self):
        # Orchestration
        self.authenticate()
        tenders = self.fetch_tenders()
        for tender in tenders:
            parsed = self.parse_tender(tender)
            if self.classify_relevance(parsed):
                self.store_tender(parsed)
```

---

**End of Database Guide**

For questions or updates, contact Datacraft at nyimbi@gmail.com
