# Source Connection Checklist

Generated from the production search for `leadership training` across all states/levels.

## Summary

- 76 sources are connected and searched.
- 61 sources are not wired, blocked, or account/browser-dependent.
- 6 additional sources are wired but temporarily rate-limited.

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

## Needs Connector Or Resolution

1. Capital Area Council of Governments Procurement
2. City of Allen Purchasing
3. City of Atlanta Procurement
4. City of Aurora Purchasing
5. City of Charlotte Procurement
6. City of Colorado Springs Procurement
7. City of Fort Collins Purchasing
8. City of Houston Procurement
9. City of Memphis Purchasing
10. City of Orlando Procurement and Contracts
11. City of Raleigh Current Bidding Opportunities
12. City of Tampa Purchasing
13. Cobb County Purchasing
14. Colorado BIDS Price Agreements
15. Colorado Department of Human Services Procurement
16. Colorado Department of Transportation Bidding
17. Colorado State Purchasing and Contracts
18. Colorado State University Procurement Services
19. Colorado Vendor Self Service
20. Colorado VSS Published Solicitations
21. CPS Energy Procurement and Suppliers
22. Denver International Airport Business Opportunities
23. Denver Public Schools Purchasing
24. Department of Defense Office of Small Business Programs
25. Department of Health and Human Services Contracts
26. Department of Homeland Security Vendor Resources
27. Department of Labor Contract Opportunities
28. Department of Transportation Procurement
29. Department of Veterans Affairs Vendor Portal
30. Douglas County Purchasing
31. Equalis Group Current Solicitations
32. Federal Procurement Data System
33. Florida State Purchasing / MFMP
34. Fulton County Bid Opportunities
35. Georgia DOAS Bids and Contracts
36. Georgia Procurement Registry
37. GSA eBuy
38. GSA Forecast of Contracting Opportunities
39. GSA Multiple Award Schedule
40. Gwinnett County Purchasing
41. Hillsborough County Procurement
42. Mecklenburg County Vendor Opportunities
43. Metro Nashville Procurement
44. Miami-Dade County Procurement
45. MyFloridaMarketPlace Vendor Information Portal
46. NC eProcurement
47. North Carolina eVP Solicitations
48. Orange County Florida OrangeBids
49. Palm Beach County Purchasing
50. RTD Procurement and Contracting
51. Shelby County Purchasing
52. Small Business Administration Contracting Guide
53. Tennessee Board of Regents Procurement Opportunities
54. Tennessee Central Procurement Office Supplier Info
55. The Woodlands Township Bids
56. UNC System Procurement
57. University of Colorado Procurement Service Center
58. University of Florida Procurement Bid Schedule
59. University System of Georgia Procurement
60. USAspending.gov
61. Wake County Procurement Services

## Wired But Temporarily Rate-Limited

1. City of Denton Purchasing
2. City of Georgetown Purchasing
3. Houston ISD Procurement
4. Lone Star College Purchasing
5. SAM.gov Contract Opportunities
6. TIPS-USA Cooperative Bid Opportunities
