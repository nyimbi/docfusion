# PHASE 1 IMPLEMENTATION GUIDE
## Detailed Product Specifications, Infrastructure, and Go-to-Market

**For:** Datacraft (www.datacraft.co.ke)
**Phase:** 1 - Foundation (Months 1-6)
**Products:** School Management System, Pharmacy Management System, Property Management System

---

## INFRASTRUCTURE SETUP (Month 1)

### 1. ISO 27001 Certification Process

**Why Critical for Phase 1:**
- Government schools require ISO 27001 for data protection
- Hospitals/pharmacies need certification for health data
- Property management involves sensitive financial data
- Competitive advantage: Most local competitors not certified

**Timeline & Process:**

**Month 1-2: Gap Analysis**
- Engage ISO 27001 consultant (recommended: Kenya Bureau of Standards certified consultant)
- Current state assessment
- Document existing security controls
- Identify gaps vs. ISO 27001:2022 standard
- **Cost:** $5,000 - $10,000

**Month 3-6: Implementation**
- Information Security Management System (ISMS) documentation
- Risk assessment and treatment plan
- Security policies (access control, incident response, business continuity)
- Technical controls implementation (encryption, access logs, vulnerability scanning)
- Staff training (security awareness)
- **Cost:** $10,000 - $20,000

**Month 7-12: Certification (Phase 2 timeline)**
- Internal audit
- Pre-assessment audit by certification body
- Remediation of findings
- Certification audit (Stage 1 documentation review, Stage 2 on-site)
- **Cost:** $5,000 - $15,000 (certification audit)

**Total ISO 27001 Cost:** $20,000 - $45,000 over 12 months
**Benefit:** 20-30% increase in enterprise deal close rates, access to government tenders

---

### 2. Mobile Money Integration Layer (Reusable Across Products)

**Architecture: Unified Payment Abstraction Layer**

```
┌─────────────────────────────────────────────────────────────┐
│                  DATACRAFT PAYMENT SERVICE                   │
│                   (Microservice Architecture)                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Payment   │  │  Transaction │  │   Reconciliation  │  │
│  │   Gateway   │  │    Logger    │  │     Service       │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
│         │                 │                    │             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Payment Provider Adapters                    │   │
│  ├────────────┬─────────────┬──────────────┬───────────┤   │
│  │  M-Pesa    │ Airtel Money│ MTN Mobile   │ Flutterwave│  │
│  │  Adapter   │  Adapter    │ Money Adapter│  Adapter   │  │
│  └────────────┴─────────────┴──────────────┴───────────┘   │
│         │             │              │            │          │
└─────────┼─────────────┼──────────────┼────────────┼─────────┘
          │             │              │            │
          ▼             ▼              ▼            ▼
    ┌─────────┐  ┌─────────┐   ┌─────────┐  ┌──────────┐
    │ M-Pesa  │  │ Airtel  │   │   MTN   │  │Flutterwave│
    │   API   │  │   API   │   │   API   │  │   API    │
    └─────────┘  └─────────┘   └─────────┘  └──────────┘
```

**Core Functionality:**

**A. Payment Initiation (C2B - Customer to Business)**
```javascript
// Unified API for products
POST /api/payments/initiate
{
  "product": "school_management",  // or pharmacy, property
  "customer_id": "CUST123",
  "amount": 15000,                 // KES
  "currency": "KES",
  "provider": "mpesa",             // mpesa, airtel, mtn, card
  "metadata": {
    "student_id": "STD456",
    "term": "Term 2 2026",
    "invoice_id": "INV789"
  }
}

Response:
{
  "transaction_id": "TXN_20260203_001",
  "status": "pending",
  "payment_reference": "MPESA_REF_XYZ",
  "instructions": "Send Ksh 15,000 to Paybill 123456, Account: STD456",
  "expires_at": "2026-02-03T18:00:00Z"
}
```

**B. Payment Notification (Webhook)**
```javascript
// Provider sends notification to our webhook
POST /webhooks/mpesa/callback
{
  "provider": "mpesa",
  "transaction_id": "MPESA123456",
  "amount": 15000,
  "phone_number": "254712345678",
  "account_reference": "STD456",
  "transaction_time": "2026-02-03T14:30:00Z",
  "result_code": 0  // 0 = success
}

// Our service processes:
1. Verify webhook authenticity (signature check)
2. Match to pending transaction (by account_reference)
3. Update transaction status → "completed"
4. Trigger product-specific handler:
   - School: Mark invoice as paid, send SMS to parent & admin
   - Pharmacy: Record payment in cashier system
   - Property: Mark rent as paid for month, SMS tenant & landlord
5. Generate and store receipt
6. Log for reconciliation
```

**C. Reconciliation**
```javascript
// Daily reconciliation job (runs at 6 AM EAT)
- Fetch M-Pesa statement for previous day
- Match against logged transactions
- Flag discrepancies:
  * Payment received but not in our system (missed webhook)
  * Payment in our system but not in M-Pesa statement (fraudulent?)
- Auto-resolve obvious matches
- Alert finance team for manual review of unmatched items
- Generate reconciliation report
```

**Key Features:**
- **Multi-Provider Support:** M-Pesa, Airtel Money, MTN Mobile Money, Flutterwave (cards)
- **Idempotency:** Prevent duplicate charges (transaction ID tracking)
- **Retry Logic:** Automatic retry for failed transactions (exponential backoff)
- **Webhook Security:** HMAC signature verification
- **Audit Trail:** Every payment logged with timestamp, source, destination
- **Real-Time Notifications:** SMS on payment success/failure
- **Reconciliation:** Daily automated matching with provider statements

**Technology Stack:**
- **Language:** Node.js (Express.js) - for async/event-driven payment processing
- **Database:** PostgreSQL (transactions) + Redis (payment state machine)
- **Queue:** BullMQ (job queue for retries, reconciliation)
- **Security:** HTTPS only, webhook signature verification, PCI DSS Level 1 practices

**Integration Endpoints:**

**M-Pesa (Safaricom - Kenya):**
- API: Daraja API v2 (C2B, B2C, Transaction Status)
- Authentication: OAuth 2.0 with short-lived tokens
- Paybill/Till Number setup required (Ksh 3,000 application fee)
- Sandbox: https://sandbox.safaricom.co.ke (for testing)
- Production: https://api.safaricom.co.ke

**Airtel Money (Kenya, Tanzania, Uganda):**
- API: Airtel Money API v2
- Authentication: Bearer token
- Collection API for payments, Disbursement API for payouts
- Sandbox available

**MTN Mobile Money (Uganda primarily):**
- API: MTN MoMo API
- Authentication: API key + OAuth
- Collection API for payments
- Sandbox: https://momodeveloper.mtn.com

**Flutterwave (Multi-country card payments):**
- API: Flutterwave v3 API
- Supports: Cards, M-Pesa, bank transfers, USSD
- Alternative to direct M-Pesa integration (higher fees but easier)

**Implementation Timeline:**
- Week 1-2: Architecture design, provider account setup
- Week 3-4: M-Pesa integration (Kenya priority)
- Week 5-6: Testing, sandbox validation, production deployment
- Week 7-8: Airtel Money, MTN Mobile Money (lower priority)

**Deliverable:** Reusable payment microservice that all 3 products (and future products) can consume via REST API.

---

### 3. Cloud Infrastructure (AWS East Africa Setup)

**AWS Region Strategy:**
- **Primary:** AWS Africa (Cape Town) - af-south-1
  - Lowest latency to East Africa (~45-60ms from Nairobi)
  - Data residency compliance (South Africa, potentially Kenya/Rwanda)
- **Secondary:** AWS Europe (Frankfurt) - eu-central-1
  - Backup region for disaster recovery
  - ~90-110ms latency to Nairobi (acceptable)
- **Future:** AWS Africa (Kenya) data center (announced but not live yet)

**Infrastructure Components:**

**A. Compute (Application Hosting)**
- **Service:** Amazon ECS (Elastic Container Service) with Fargate
- **Why:** Container-based deployment, auto-scaling, pay only for what you use
- **Configuration:**
  - Development: 2 vCPU, 4 GB RAM per container
  - Production: 4 vCPU, 8 GB RAM per container, 2-4 containers (auto-scale)
- **Cost Estimate:** $200-$500/month production, $50-$100/month dev/staging

**B. Database**
- **Service:** Amazon RDS for PostgreSQL (Multi-AZ for production)
- **Configuration:**
  - Development: db.t3.medium (2 vCPU, 4 GB RAM)
  - Production: db.r5.large (2 vCPU, 16 GB RAM), Multi-AZ, automated backups
- **Cost Estimate:** $100-$150/month dev, $300-$600/month production

**C. Caching & Session Management**
- **Service:** Amazon ElastiCache for Redis
- **Configuration:**
  - cache.t3.micro (development)
  - cache.t3.medium (production)
- **Cost Estimate:** $15-$20/month dev, $50-$80/month production

**D. File Storage**
- **Service:** Amazon S3 (Simple Storage Service)
- **Usage:** Student photos, report cards, pharmacy documents, property leases, receipts
- **Configuration:**
  - Standard storage for recent documents
  - Glacier for archival (receipts older than 2 years)
- **Cost Estimate:** $20-$50/month for 100GB-500GB

**E. CDN (Content Delivery)**
- **Service:** Amazon CloudFront
- **Usage:** Serve static assets (JS, CSS, images) from edge locations
- **Benefit:** Faster page load times, reduces origin server load
- **Cost Estimate:** $10-$30/month for moderate traffic

**F. Monitoring & Logging**
- **Services:**
  - CloudWatch (infrastructure metrics, logs, alarms)
  - AWS X-Ray (distributed tracing, performance profiling)
  - Sentry (error tracking)
- **Cost Estimate:** $30-$80/month

**G. Security**
- **Services:**
  - AWS WAF (Web Application Firewall) - DDoS protection, SQL injection blocking
  - AWS Certificate Manager - Free SSL/TLS certificates
  - AWS Secrets Manager - Store API keys, database passwords securely
  - GuardDuty - Threat detection
- **Cost Estimate:** $50-$150/month

**H. CI/CD & DevOps**
- **Services:**
  - GitHub Actions (CI/CD pipeline) - 2,000 free minutes/month, then $0.008/minute
  - AWS CodePipeline (optional, for advanced deployments)
  - Docker (containerization)
- **Cost Estimate:** $0-$50/month (mostly GitHub Actions)

**Total Monthly Infrastructure Cost:**
- **Development/Staging:** $400-$600/month
- **Production (100-300 customers):** $800-$1,500/month
- **Production (1,000+ customers):** $2,000-$4,000/month (scales with usage)

**Infrastructure as Code (IaC):**
- Use Terraform to define all infrastructure
- Version control infrastructure configuration
- Easy replication across environments (dev, staging, prod)
- Disaster recovery: Rebuild entire infrastructure in <1 hour

**Security Best Practices:**
- **Encryption at Rest:** All databases, S3 buckets encrypted with AWS KMS
- **Encryption in Transit:** HTTPS only (TLS 1.2+), no HTTP traffic allowed
- **Network Segmentation:** VPC with private subnets for databases, public subnets for load balancers
- **Access Control:** IAM roles with least privilege, MFA for admin access
- **Backup Strategy:** Daily automated backups, 30-day retention, tested monthly
- **Disaster Recovery:** RTO (Recovery Time Objective) = 4 hours, RPO (Recovery Point Objective) = 1 hour

---

### 4. Payment Gateway Integrations

**Integration Options:**

**Option A: Direct Provider Integration (Recommended for Phase 1)**
- **M-Pesa Daraja API:** Direct integration with Safaricom
  - **Pros:** Lowest fees (free for C2B except Safaricom's standard M-Pesa charges), full control
  - **Cons:** More development effort, provider-specific code
  - **Fees:** 0% platform fee (only standard M-Pesa charges apply - typically 0-1% depending on transaction size)

**Option B: Payment Aggregator (Backup/Fallback)**
- **Flutterwave:** Pan-African payment gateway
  - **Pros:** Single API for M-Pesa, Airtel Money, cards, bank transfers across multiple countries
  - **Cons:** Higher fees (2.8% + $0.10 per transaction), less control
  - **Use Case:** Fallback if direct integration fails, or for non-Kenya markets initially
  - **Fees:** 2.8% per transaction

- **Paystack:** Nigeria-focused but expanding
  - **Pros:** Good developer experience, strong documentation
  - **Cons:** Limited East Africa support
  - **Fees:** 2.9% + KES 50 per transaction

- **Pesapal:** East Africa payment gateway
  - **Pros:** Local company, understands EA market
  - **Cons:** Mixed reviews on reliability
  - **Fees:** 2.5% - 3.5% per transaction

**Recommended Approach:**
- **Phase 1 (Month 1-3):** Direct M-Pesa integration for Kenya (80% of customers will be Kenyan initially)
- **Phase 1 (Month 4-6):** Add Flutterwave as backup/multi-country option
- **Phase 2:** Direct Airtel Money, MTN Mobile Money integrations for Tanzania, Uganda

---

## GO-TO-MARKET STRATEGY (Months 3-6)

### Pilot Customer Identification & Acquisition

**Objective:** 5-10 pilot customers per product (15-30 total)

**Selection Criteria:**
- **Early Adopters:** Tech-savvy, willing to try new solutions
- **Representative:** Typical of target market (not outliers)
- **Vocal:** Will provide feedback, testimonials, referrals
- **Accessible:** Located in Nairobi/major cities for easy support
- **Influential:** Well-connected in their industry (schools, pharmacies, real estate)

---

### SCHOOL MANAGEMENT SYSTEM - Go-to-Market

**Target Pilot Customers (10-15 schools):**

**Segment Breakdown:**
- 5 small primary schools (50-200 students) - test Starter tier
- 3 medium primary/secondary schools (200-500 students) - test Professional tier
- 2 large secondary schools (500+ students) - test Business tier

**Outreach Channels:**

**1. Direct Outreach (CEO/Founder-Led Sales)**
- **Approach:** Personal connections, warm introductions
- **Target:** Datacraft existing contacts who have school connections
- **Script:**
  - "We're launching a school management system designed specifically for Kenya"
  - "M-Pesa fee collection, SMS parent communication, CBC curriculum"
  - "Looking for 10 pilot schools to use free for 3 months"
  - "In exchange: Your feedback, testimonial, help us perfect the product"
- **Timeline:** Week 1-4, goal 5-10 schools committed

**2. Kenya Private Schools Association (KPSA)**
- **Approach:** Attend KPSA meetings, present product
- **Offer:** Special pricing for KPSA members
- **Timeline:** Month 2-3

**3. Facebook Ads (Targeted)**
- **Audience:** School administrators, principals in Kenya
  - Interest: Education, school management, education technology
  - Location: Nairobi, Mombasa, Kisumu, Nakuru, Eldoret
  - Age: 30-60
- **Ad Creative:** "Automate your school's fee collection with M-Pesa. Try free for 3 months."
- **Budget:** $500/month
- **Timeline:** Month 2-6

**4. Google Ads (Search)**
- **Keywords:**
  - "school management system Kenya"
  - "school software Kenya"
  - "M-Pesa fee collection schools"
  - "report card generator Kenya"
- **Budget:** $300/month
- **Timeline:** Month 3-6

**5. Content Marketing**
- **Blog Posts:**
  - "10 Ways M-Pesa Can Transform School Fee Collection"
  - "How to Reduce Teacher Admin Time by 50%"
  - "Complete Guide to CBC Report Cards"
- **YouTube Videos:**
  - Product demo (5 minutes)
  - "How to Set Up Your School in 30 Minutes"
- **Timeline:** Month 2-6

**Pilot Program Details:**

**Benefits to Pilot Schools:**
- 100% free for 3 months (Month 3-5)
- Free onboarding and training (normally $500 value)
- Dedicated support (WhatsApp hotline)
- Priority feature requests
- 50% discount for next 6 months (Month 6-11) if they continue

**Expectations from Pilot Schools:**
- Weekly feedback sessions (30 minutes)
- Use product for all students (not just test with one class)
- Provide testimonial if satisfied
- Introduce us to 2-3 other schools

**Success Metrics:**
- 80% pilot schools convert to paying customers (Month 6+)
- Each pilot school refers 1+ additional school
- NPS (Net Promoter Score) >40 from pilot schools

---

### PHARMACY MANAGEMENT SYSTEM - Go-to-Market

**Target Pilot Customers (8-12 pharmacies):**

**Segment Breakdown:**
- 5 independent pharmacies (single location)
- 2 small pharmacy chains (2-3 branches)
- 1 hospital pharmacy

**Outreach Channels:**

**1. Pharmaceutical Society of Kenya (PSK)**
- **Approach:** Present at PSK CPD (Continuing Professional Development) events
- **Offer:** "Digital Pharmacy Solutions - Save 10 Hours/Week on Admin"
- **Benefit:** Access to 3,000+ registered pharmacists
- **Timeline:** Month 2-3

**2. Direct Pharmacy Visits (Sales Rep)**
- **Approach:** Door-to-door sales in Nairobi pharmacies
- **Target:** 50 pharmacies visited per week
- **Conversion:** 10-15% pilot interest rate = 5-7 per week
- **Timeline:** Month 2-4

**3. NHIF Integration Marketing**
- **Approach:** "Automate Your NHIF Claims - Get Paid Faster"
- **Why:** NHIF claims are painful, our system automates
- **Channel:** Facebook ads to pharmacies, Google ads
- **Budget:** $400/month
- **Timeline:** Month 3-6

**4. Pharmacy Chains (Partnership Approach)**
- **Target:** HealthCare Pharmacy, Goodlife Pharmacy, Haltons
- **Approach:** White-label solution for their franchise pharmacies
- **Benefit:** One deal = 5-10 pharmacies
- **Timeline:** Month 4-6 (longer sales cycle)

**Pilot Program Details:**

**Benefits:**
- Free for 2 months (faster sales cycle than schools)
- Free data migration (import existing product catalog)
- Free NHIF integration setup
- 50% discount for next 4 months

**Expectations:**
- Daily use (process at least 20 prescriptions/day)
- Test NHIF claims submission (at least 10 claims)
- Testimonial and before/after metrics (hours saved, error reduction)

---

### PROPERTY MANAGEMENT SYSTEM - Go-to-Market

**Target Pilot Customers (10-15 landlords/properties):**

**Segment Breakdown:**
- 6 individual landlords (5-20 units each)
- 2 property managers (managing 50-100 units)
- 1 corporate landlord (100+ units)

**Outreach Channels:**

**1. Kenya Property Managers Association (KPRA)**
- **Approach:** Present at KPRA meetings, sponsor event
- **Offer:** "Automate Rent Collection with M-Pesa"
- **Timeline:** Month 2-3

**2. Real Estate Agencies (Partnership)**
- **Target:** Hass Consult, Knight Frank, Pam Golding, Regent Management
- **Approach:** White-label for their property management division
- **Benefit:** Access to their landlord database
- **Timeline:** Month 3-6

**3. Facebook/Instagram Ads (Landlord-Targeted)**
- **Audience:** Property owners, real estate investors in Kenya
  - Interest: Real estate, property investment, rental income
  - Age: 35-65
  - Income: Top 20%
- **Ad Creative:** "Never Chase Rent Again. M-Pesa Auto-Collection."
- **Budget:** $500/month
- **Timeline:** Month 2-6

**4. LinkedIn (B2B for Property Managers)**
- **Target:** Property managers, real estate professionals
- **Approach:** InMail campaign, connection requests, thought leadership posts
- **Timeline:** Month 3-6

**5. Content Marketing (Landlord Education)**
- **Blog:** "Landlord's Guide to M-Pesa Rent Collection"
- **YouTube:** "How to Manage 50 Rental Units from Your Phone"
- **Free Calculator:** "Rental Property ROI Calculator" (lead magnet)
- **Timeline:** Month 2-6

**Pilot Program Details:**

**Benefits:**
- Free for 3 months
- Free M-Pesa Paybill setup assistance (normally complex)
- Free tenant onboarding (SMS invites to tenants)
- Free lease template library (Kenya Landlord-Tenant Act compliant)

**Expectations:**
- Onboard all tenants to system (100% coverage)
- Enable M-Pesa rent collection for at least 50% of units
- Provide data on time saved (hours/week)
- Introduce us to 2 fellow landlords

---

## SALES COLLATERAL & CASE STUDIES

### Sales Collateral (To Be Created Month 2-3)

**For Each Product:**

**1. Product Deck (PowerPoint/PDF) - 10-15 slides**
- Problem: Current pain points (manual processes, errors, time waste)
- Solution: Our product overview
- Demo: Screenshots of key features
- Benefits: Time saved, money saved, error reduction
- Pricing: Transparent pricing tiers
- Customer Testimonials: (From pilot customers)
- Next Steps: How to get started

**2. One-Pager (Flyer/Brochure)**
- Product overview
- Top 5 features
- Pricing snapshot
- Contact information
- QR code to demo video

**3. Demo Video (3-5 minutes)**
- Screen recording with voiceover
- Show actual product in action
- Focus on "wow" moments (M-Pesa auto-collection, bulk SMS, report generation)
- Call to action: Book a demo, sign up for trial

**4. Comparison Sheet (vs. Competitors)**
- Feature comparison table: Us vs. Top 3 competitors
- Highlight our advantages (M-Pesa, SMS, pricing, local support)
- Fair comparison (acknowledge where competitors are stronger)

**5. ROI Calculator (Excel/Web Tool)**
- Input current costs (time spent, manual errors, late payments)
- Calculate savings with our product
- Output: ROI percentage, payback period in months

### Case Studies (To Be Created After Pilot - Month 5-6)

**Format for Each Case Study (2-4 pages):**

**School Management Example:**

**Title:** "St. Mary's School Reduced Fee Collection Time by 80% with SchoolHub"

**Customer:**
- Name: St. Mary's Primary School, Nairobi
- Size: 350 students
- Challenge: Manual fee tracking, parents paying late, 15 hours/week admin time

**Solution:**
- Implemented SchoolHub in March 2026
- Enabled M-Pesa Paybill integration
- Onboarded 90% of parents to SMS notifications

**Results:**
- 80% reduction in fee collection admin time (15 hours → 3 hours/week)
- 40% faster fee payment (parents pay immediately via M-Pesa)
- 95% parent satisfaction (SMS notifications appreciated)
- Ksh 150,000 saved annually (admin time + late payment reduction)

**Testimonial (with photo):**
"SchoolHub transformed our school. Parents love the SMS reminders and M-Pesa payment. Our admin team can now focus on teaching instead of chasing fees." - John Kamau, Principal

**Pharmacy Management Example:**

**Title:** "Healthy Life Pharmacy Cut Inventory Waste by 60% with PharmaHub"

**Customer:**
- Name: Healthy Life Pharmacy, Nairobi
- Type: Independent pharmacy
- Challenge: Drugs expiring before sale, NHIF claims taking 3 weeks

**Solution:**
- Implemented PharmaHub in April 2026
- Set up expiry alerts (60-day warning)
- Automated NHIF claim submission

**Results:**
- 60% reduction in expired drug waste (Ksh 80,000 saved annually)
- NHIF claims processed in 5 days (vs. 21 days previously)
- 10 hours/week saved on inventory management
- Customer loyalty increased (SMS reminders for chronic medication)

**Testimonial:**
"The expiry alerts alone paid for the system. We used to lose Ksh 20,000/month on expired drugs. Now it's less than Ksh 8,000." - Dr. Mary Wanjiru, Pharmacist-in-Charge

---

## PARTNERSHIP DISCUSSIONS (Month 4-6)

### Telecom Partnerships

**Safaricom (Priority 1 - Kenya)**

**Objectives:**
- **M-Pesa Distribution Partnership:** Safaricom promotes our products to their business customers
- **Safaricom Spark Ecosystem:** Join Safaricom Spark accelerator/portfolio
- **Co-Marketing:** Joint webinars, case studies, events
- **Preferential M-Pesa Rates:** Negotiate reduced transaction fees for high volume

**Approach:**
- Contact: Safaricom Business Development team, Safaricom Spark team
- Pitch: "M-Pesa-First SaaS Products for SMEs"
- Value to Safaricom: Increase M-Pesa transaction volumes, demonstrate M-Pesa utility beyond person-to-person transfers
- Timeline: Month 4-6 (3-month sales cycle expected)

**MTN Mobile Money (Uganda)**
- Similar approach for Uganda market
- Timeline: Month 6+ (Phase 2)

**Vodacom (Tanzania)**
- M-Pesa integration for Tanzania
- Timeline: Month 6+ (Phase 2)

### Industry Association Partnerships

**Kenya Private Schools Association (KPSA)**
- Member discount (10-15% off)
- Present at KPSA conferences
- KPSA logo on our website (credibility)

**Pharmaceutical Society of Kenya (PSK)**
- CPD points for pharmacists using our system (gamification)
- Sponsor PSK events

**Kenya Property Managers Association (KPRA)**
- Preferred vendor status
- Webinar: "Digital Transformation for Property Management"

---

## CRITICAL MILESTONES & DECISION POINTS

### Month 3 Decision Point: MVP Launch or Delay?

**Go/No-Go Criteria:**

**GO if:**
- ✅ All P0 (critical) features complete and tested
- ✅ At least 5 pilot customers confirmed per product
- ✅ M-Pesa integration working in sandbox
- ✅ Infrastructure stable (uptime >99% in staging)
- ✅ Team confident in ability to support pilot customers

**NO-GO if:**
- ❌ Major P0 features missing or buggy
- ❌ <3 pilot customers confirmed per product
- ❌ M-Pesa integration not working
- ❌ Infrastructure issues (frequent crashes, data loss)

**If NO-GO:** Delay 2 weeks, focus on blockers, re-assess

### Month 6 Decision Point: Phase 2 Products or Scale Phase 1?

**Option A: Launch Phase 2 Products (Core Banking, Hospital Management, Farm Management)**
- **Choose if:** Phase 1 ARR >$400K, >200 customers, <12% churn, team capacity available

**Option B: Scale Phase 1 Products**
- **Choose if:** Phase 1 ARR <$300K, need to focus on customer success, team stretched thin

**Option C: Pivot Phase 1 Products**
- **Choose if:** One product underperforming significantly (<20 customers), redirect resources to successful products

---

## SUCCESS METRICS DASHBOARD (Month 6 Review)

**Target Metrics:**

| Metric | School Mgmt | Pharmacy Mgmt | Property Mgmt | Combined |
|--------|-------------|---------------|---------------|----------|
| Customers | 100-150 | 50-80 | 80-120 | 230-350 |
| MRR | $25K-$37.5K | $5K-$8K | $10K-$15K | $40K-$60.5K |
| Churn | <10% | <10% | <10% | <10% |
| NPS | >40 | >40 | >40 | >40 |
| CAC | <$700 | <$600 | <$800 | <$700 |
| LTV:CAC | >6:1 | >5:1 | >4:1 | >5:1 |

**If Actual < Target by >30%:** Investigate root cause, iterate on product/sales/marketing, consider pivot

**If Actual > Target by >30%:** Accelerate! Hire more sales reps, increase marketing budget, fast-track Phase 2

---

**End of Phase 1 Implementation Guide**

Next Documents:
- Individual Product Technical Specifications
- Sales Playbooks
- Customer Success Runbooks
- Financial Models & Unit Economics

---

**Document Status:** Draft v1.0
**Date:** February 2, 2026
**Owner:** Datacraft Product & Engineering Team
**Confidentiality:** Internal Use Only
