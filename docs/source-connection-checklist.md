# Source Connection Checklist

Generated from the production search for `leadership training` across all states/levels.

## Summary

- Latest local verification for `leadership training`: 102 searched, 99 raw results, 21 directory-pending, 0 hard errors.
- Default Focused quality view shows 3 higher-quality matches for `leadership training`; the other raw results are weak matches hidden unless Broad is selected.
- Source health currently shows 95 `ok` rows and 28 `pending` rows because temporary rate limits/timeouts are included in health.
- Reference-only/vendor setup/award-history pages are no longer counted as broken live-opportunity connectors.
- Production needs a fresh Vercel deployment after this checklist update is pushed.

## Active Work

1. Acquisition.gov
   - Status: Resolved.
   - Current finding: reference-only FAR/acquisition policy site, not a live opportunity feed.
   - Action: remove from pending opportunity-source count and keep as reference-only support source.
2. Arapahoe County Purchasing
   - Status: Wired and locally verified.
   - Current finding: official county purchasing page sends current solicitations to BidNet Direct / Rocky Mountain E-Purchasing.
   - Action: added a public BidNet open-bids connector that parses solicitation ID, title, posted date, closing date, detail URL, and document access instructions.
   - Verification: `leadership training` returned an Arapahoe result and status `ok`; `housing` returned `Housing Action Plan Consultant`, solicitation `26-34`, due `07/13/2026`.
3. Bexar County Purchasing
   - Status: Wired and locally verified.
   - Current finding: official CivicEngage bid page is server-readable and currently says there are no open bid postings.
   - Action: removed the stale server-blocked skip so the system checks the official page live.
   - Verification: `leadership training` for Texas local sources returned Bexar status `ok`, 0 results, 624ms.
4. Boulder County Purchasing
   - Status: Wired and locally verified.
   - Current finding: official county page publishes a current solicitations chart with Bonfire/Euna document links.
   - Action: added a public table connector that parses due date, solicitation number, title, department, and stable Bonfire detail URL.
   - Verification: `vehicle` for Colorado local sources returned `Police Vehicle Equipment Upfitter`, solicitation `RFP-298-26`, due `07/17/2026 2:00 pm`.
5. Broward County Purchasing
   - Status: Wired and locally verified.
   - Current finding: official county purchasing page moved solicitations to BPRO, powered by Bonfire.
   - Action: made the shared Bonfire connector state-aware and added Broward as a Florida local source.
   - Verification: `management` for Florida local sources returned 4 Broward opportunities, including `Parking Management Services for Fort Lauderdale-Hollywood International Airport`, solicitation `GEN2130575P1`, due `2026-07-22 18:00:00`.
6. Capital Area Council of Governments Procurement
   - Status: Investigated; still blocked.
   - Current finding: official page has RFP content, but direct server requests are blocked by Cloudflare.
   - Checked endpoints: page, WordPress REST page/search, feed, sitemap, and site search all returned 403 from server-side fetches.
   - Required resolution: email-alert ingestion, approved browser collector, or CAPCOG allowlisting/API access. Do not count as wired until one of those paths is in place.
7. City and County of Denver Bidding Opportunities
   - Status: Wired and locally verified.
   - Current finding: official Denver current-bidding page is server-readable and publishes open solicitation cards.
   - Action: added a parser for title, reference number, closing date, status, description, and detail URL.
   - Verification: `park` for Colorado local sources returned `RFQ: Park Hill Park Design`, solicitation `Solicitation No. 202684823`, due `August 13, 2026, 02:00 PM`.
8. City of Addison Purchasing
   - Status: Wired and locally verified.
   - Current finding: official Addison page points current bids to BidNetDirect, and the public BidNet agency slug is `townofaddison`.
   - Action: added a BidNet connector for Addison using the shared BidNet parser.
   - Verification: `tourism` for Texas local sources returned `Tourism Public Relations Services`, solicitation `26-232`, due `08/04/2026`.
9. City of Allen Purchasing
   - Status: Investigated; still blocked for production runtime.
   - Current finding: official eBid is IonWave and public rows exist, but Node/server fetch receives an IonWave/Cloudflare 429 challenge while browser/curl can read the page.
   - Checked endpoint: `https://allentx.ionwave.net/SourcingEvents.aspx?SourceType=1`.
   - Required resolution: approved browser collector, vendor alert ingestion, or official API/feed access. Do not count as wired until the app runtime gets an `ok` result.
10. Colorado/Fulton/Tampa connector batch
   - Status: Wired and locally verified.
   - Sources added: City of Aurora, City of Colorado Springs, City of Fort Collins, Denver Public Schools, Douglas County CO, RTD, University of Colorado, Fulton County, and City of Tampa.
   - Platforms: BidNet Direct / Rocky Mountain E-Purchasing, OpenGov.
   - Verification examples: Aurora `firing range`, DPS `custodial services`, CU `billing tool`, Fulton `disaster bags`, Tampa `services`, RTD `leadership training`.
11. Public connector batch 2
   - Status: Wired and locally verified.
   - Sources added: City of Charlotte, Cobb County, City of Orlando, Orange County FL, Hillsborough County, Miami-Dade County, and Gwinnett County.
   - Platforms/endpoints: Bonfire, OpenGov embed feeds, DemandStar agency feed, Miami-Dade JSON feeds, and Gwinnett official solicitations page.
   - Verification examples: Charlotte `charlotte` returned 44 Bonfire rows with document links; Cobb `cobb` returned 9 OpenGov rows; Orlando `orlando` returned 10 OpenGov rows; Orange County `orange` returned 10 OpenGov rows; Miami-Dade `miami` returned 34 current/future rows; Gwinnett `gwinnett` returned 18 rows with notice/addendum links.
   - Hillsborough note: DemandStar feed is reachable and status is `ok`, but the public feed currently contains no future/open rows after deadline filtering; latest 100 rows are under evaluation or past due.
12. Static official-page batch
   - Status: Wired and locally verified.
   - Sources added: CDOT future bidding, Shelby County bids listing, Tennessee Board of Regents procurement opportunities, University of Florida bid schedule.
   - Note: these may correctly return zero results when the public page has no matching/open posting.

## Needs Connector Or Resolution

1. Capital Area Council of Governments Procurement
2. City of Allen Purchasing
3. City of Atlanta Procurement
4. City of Houston Procurement
5. City of Memphis Purchasing
6. City of Raleigh Current Bidding Opportunities
7. Colorado Department of Human Services Procurement
8. Colorado State University Procurement Services
9. Colorado Vendor Self Service
10. Colorado VSS Published Solicitations
11. CPS Energy Procurement and Suppliers
12. Denver International Airport Business Opportunities
13. Equalis Group Current Solicitations
14. Georgia Procurement Registry
15. GSA Forecast of Contracting Opportunities
16. Mecklenburg County Vendor Opportunities
17. Metro Nashville Procurement
18. North Carolina eVP Solicitations
19. Palm Beach County Purchasing
20. The Woodlands Township Bids
21. Wake County Procurement Services

## Wired But Temporarily Rate-Limited

1. City of Georgetown Purchasing
2. City of Irving Purchasing
3. Goodbuy Purchasing Cooperative Bid Opportunities
4. Houston ISD Procurement
5. Lone Star College Purchasing
6. SAM.gov Contract Opportunities
7. TIPS-USA Cooperative Bid Opportunities
