# Source Connection Checklist

Generated from the production search for `leadership training` across all states/levels.

## Summary

- Latest local verification for `leadership training`: 95 searched, 82 results, 28 directory-pending, 0 hard errors.
- Source health currently shows 88 `ok` rows and 35 `pending` rows because temporary rate limits/timeouts are included in health.
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
11. Static official-page batch
   - Status: Wired and locally verified.
   - Sources added: CDOT future bidding, Shelby County bids listing, Tennessee Board of Regents procurement opportunities, University of Florida bid schedule.
   - Note: these may correctly return zero results when the public page has no matching/open posting.

## Needs Connector Or Resolution

1. Capital Area Council of Governments Procurement
2. City of Allen Purchasing
3. City of Atlanta Procurement
4. City of Charlotte Procurement
5. City of Houston Procurement
6. City of Memphis Purchasing
7. City of Orlando Procurement and Contracts
8. City of Raleigh Current Bidding Opportunities
9. Cobb County Purchasing
10. Colorado Department of Human Services Procurement
11. Colorado State University Procurement Services
12. Colorado Vendor Self Service
13. Colorado VSS Published Solicitations
14. CPS Energy Procurement and Suppliers
15. Denver International Airport Business Opportunities
16. Equalis Group Current Solicitations
17. Georgia Procurement Registry
18. GSA Forecast of Contracting Opportunities
19. Gwinnett County Purchasing
20. Hillsborough County Procurement
21. Mecklenburg County Vendor Opportunities
22. Metro Nashville Procurement
23. Miami-Dade County Procurement
24. North Carolina eVP Solicitations
25. Orange County Florida OrangeBids
26. Palm Beach County Purchasing
27. The Woodlands Township Bids
28. Wake County Procurement Services

## Wired But Temporarily Rate-Limited

1. City of Georgetown Purchasing
2. City of Irving Purchasing
3. Goodbuy Purchasing Cooperative Bid Opportunities
4. Houston ISD Procurement
5. Lone Star College Purchasing
6. SAM.gov Contract Opportunities
7. TIPS-USA Cooperative Bid Opportunities
