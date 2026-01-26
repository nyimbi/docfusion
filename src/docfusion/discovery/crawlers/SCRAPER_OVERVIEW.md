# DocuFusion RFP/EoI Scraper Overview

## Location
All RFP, EoI, and grant opportunity scrapers are located in:
```
discovery/crawlers/
```

## Comprehensive Source Coverage

### Government Sources (`government/`)
**Federal US Government:**
- **SAM.gov** - Primary federal contracting opportunities
- **Grants.gov** - Federal grant opportunities  
- **FBO** - Legacy FedBizOpps integration
- **Department-Specific**: DOD, NASA, NIH, NSF, DOE procurement portals
- **State & Local**: State procurement portals, municipal opportunities

### Commercial Platforms (`commercial/`)
**Major Databases:**
- **BidSync** - Comprehensive opportunity database
- **GovWin IQ** - Government market intelligence platform
- **RFPDB.com** - RFP database and alerts

**Enterprise Procurement:**
- **SAP Ariba** - Enterprise procurement network
- **JAGGAER** - Procurement platform
- **Coupa** - Procurement and spend management

**Industry-Specific:**
- Construction, Healthcare, Technology opportunity platforms

### Foundation & Grants (`foundations/`)
**Major Grant Databases:**
- **Foundation Center/Candid** - Comprehensive foundation directory
- **Grants.com** - Private foundation and grant opportunities

**Private Foundations:**
- Gates Foundation, Ford Foundation, Rockefeller, Kellogg
- Corporate and community foundations

**Grant Categories:**
- Research, Education, Healthcare, Environmental grants

### International Sources (`international/`)
**European Union:**
- **TED Europa** - EU public procurement notices
- EU funding programs (Horizon Europe, etc.)

**Major Markets:**
- **Canada**: BuyandSell.gc.ca
- **Australia**: AusTender
- **UK**: Contracts Finder

**Multilateral Organizations:**
- World Bank, UN Global Marketplace, Asian Development Bank
- Inter-American Development Bank

**Regional Markets:**
- Japan, Singapore, South Africa, India procurement portals

### Generic Infrastructure (`generic/`)
**Reusable Components:**
- Base scraper framework
- API crawlers for REST/GraphQL endpoints
- RSS/Atom feed monitors
- Rate limiting and proxy management
- Authentication and session handling
- Content extraction and document downloading

## Key Features

### Comprehensive Coverage
- **200+ Sources** monitored continuously
- **Government, Commercial, Foundation, International** opportunities
- **Multi-language** support for international sources
- **API Integration** where available, web scraping where necessary

### Intelligent Processing
- **Real-time monitoring** with configurable intervals
- **Change detection** to identify new opportunities immediately
- **Respectful crawling** with rate limiting and robots.txt compliance
- **Authentication handling** for secured portals and premium services

### Content Extraction
- **PDF/DOCX downloading** of full RFP documents
- **Structured data extraction** from opportunity listings
- **Deadline and timeline parsing** for critical dates
- **Requirement identification** coordination with NLP package

### Quality Assurance
- **Source health monitoring** to detect portal changes
- **Error handling and recovery** for robust operation
- **Proxy rotation** for high-volume scraping
- **Audit logging** of all discovery activities

## Integration with DocuFusion

### Service Flow
1. **Scrapers** continuously monitor sources and extract opportunities
2. **Analyzers** coordinate with NLP package for requirement extraction
3. **Matchers** use Storage package search to filter relevant opportunities
4. **Intelligence package** provides competitive analysis and win probability
5. **Notifications** alert teams to high-priority opportunities

### Data Processing
- Raw opportunity data → Storage package
- Document content → NLP package for processing
- Competitive intelligence → Intelligence package
- Filtered opportunities → AI Agents for strategy

This comprehensive scraping infrastructure ensures DocuFusion captures opportunities before competitors are even aware they exist, providing the strategic advantage outlined in the DocuFusion vision.