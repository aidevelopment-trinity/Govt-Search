# Texas Source Wiring Plan

Goal: every Texas source must either search a real opportunity system or be clearly marked as a non-opportunity reference resource. Do not treat a generic page fetch as a completed connector unless it extracts current opportunities from that buyer's official source.

## Working Connectors

These are wired to live official searches today.

### Statewide ESBD

- Texas Electronic State Business Daily: official ESBD opportunity search.

### ESBD Buyer/Member Filters

These sources are searched through official ESBD buyer/member numbers, with exact post-response filtering to prevent loose ESBD matches from being mislabeled.

- Texas Health and Human Services Commission Contracting: `529`
- Texas Department of Criminal Justice Business and Finance: `696`
- Texas Department of Transportation Business: `601`
- Texas Workforce Commission Procurement: `320`
- Travis County Purchasing: `C2270`
- City of Dallas Procurement Services: `M5572`
- Dallas County Purchasing: `C0570`
- City of San Antonio Procurement: `M0152`
- City of Irving Purchasing: `M0570`
- City of Waco Purchasing: `M1612`
- City of Odessa Purchasing: `M0680`
- Williamson County Purchasing: `C2460`
- City of Georgetown Purchasing: `M2461`
- City of Grapevine Purchasing: `M2201`
- City of Galveston Purchasing: `M0843`
- San Antonio International Airport Business: `M0152`
- University of Texas System Supplier Information: `720`
- Texas A&M University System Doing Business: `711`, `715`, `751`, `555`, `556`, `712`, `716`, `576`
- University of Texas at Austin Purchasing: `721`
- Texas A&M University Purchasing: `711`
- University of Houston Purchasing: `730`
- Texas Tech University System Procurement: `768`, `733`, `739`, `774`
- Dallas ISD Procurement: `S5573`
- Fort Worth ISD Purchasing: `S2209`
- Alamo Colleges Purchasing: `J0150`
- Austin Community College Purchasing: `J2270`
- Lone Star College Purchasing: `J1010`
- North Central Texas Council of Governments Purchasing: `G2200`
- Houston-Galveston Area Council Procurement: `G1010`
- Lower Colorado River Authority Business: `K0042`

### Custom Page Parser

- City of Austin Purchasing: official Austin Finance Online active solicitation list plus detail-page parser.
- City of Frisco Purchasing: official current-bids page parser, used as a stable fallback even though Frisco also posts to Bonfire.

### Bonfire Public API

These sources are wired to Bonfire's public open-opportunities JSON endpoint with queued requests and response caching to avoid portal rate limits.

- City of Dallas Procurement Services
- Harris County Purchasing
- City of Fort Worth Purchasing
- City of Round Rock Purchasing
- City of McKinney Purchasing
- Denton County Purchasing
- City of Midland Purchasing
- Austin ISD Purchasing
- DFW Airport Solicitations
- DART Procurement
- San Antonio ISD Purchasing
- San Antonio River Authority Business Opportunities
- North Texas Municipal Water District Business Opportunities

### OpenGov Public Portals

These sources are wired to OpenGov's public procurement portal state for currently open projects.

- Collin County Purchasing
- City of Sugar Land Purchasing

### IonWave / Euna Public Bid Tables

These sources are wired to IonWave's public `SourcingEvents.aspx` current-bids table with queued requests and response caching. IonWave will rate-limit when hit too quickly, so these connectors intentionally run slower than the ESBD and Bonfire connectors.

- Tarrant County Purchasing
- City of Plano Purchasing
- City of Denton Purchasing
- City of Irving Purchasing
- City of Georgetown Purchasing
- Lone Star College Purchasing
- Houston ISD Procurement

## Reference Resources

These are important for vendor setup, alerts, and eligibility, but they are not opportunity-search feeds.

- Texas Statewide Procurement Division
- Texas Centralized Master Bidders List
- Texas HUB Program

## Remaining Texas Direct Connectors

These sources still need source-specific connector work. The next pass should identify the underlying portal family first, then implement and test one family at a time.

### Priority 1: Large Local Buyers

- City of Austin Purchasing: wired through Austin Finance Online.
- City of Fort Worth Purchasing: wired through Bonfire.
- Tarrant County Purchasing: wired through IonWave public current-bids table.
- Bexar County Purchasing: official page links to Infor supplier portal and CivCast for road/repair/construction; identify current solicitation feed for professional services.
- City of Houston Procurement: official page links to Beacon; Beacon returns AWS WAF human verification to server-side requests, so this needs a non-CAPTCHA feed or approved vendor-alert workflow.
- Harris County Purchasing: wired through Bonfire.
- City of Plano Purchasing: wired through IonWave public current-bids table.
- City of Frisco Purchasing: wired through official current-bids page, with Bonfire available after cooldown.
- Collin County Purchasing: wired through OpenGov public open-project portal.
- City of Denton Purchasing: wired through IonWave public current-bids table.
- Denton County Purchasing: wired through Bonfire; currently returns zero open projects.

### Priority 2: High-Income / Fast-Growth Local Buyers

- City of Midland Purchasing: wired through Bonfire; currently returns zero open projects.
- Midland County Purchasing
- Ector County Purchasing
- City of Sugar Land Purchasing: wired through OpenGov public open-project portal.
- City of Round Rock Purchasing: wired through Bonfire.
- City of McKinney Purchasing: wired through Bonfire.
- City of Allen Purchasing: wired through DemandStar public agency feed.
- City of Addison Purchasing
- City of Georgetown Purchasing: wired through IonWave public current-bids table.
- The Woodlands Township Bids: wired through the official open-bids page, with official Visit The Woodlands fallback for Vercel/server-side blocks and direct document links.

### Priority 3: Airports, Transit, Utilities, Ports, Authorities

- DFW Airport Solicitations: wired through Bonfire.
- Austin-Bergstrom Airport Business
- Houston Airport System Business
- DART Procurement: wired through Bonfire.
- CapMetro Procurement
- VIA Metropolitan Transit Procurement
- Houston METRO Procurement
- North Texas Tollway Authority Procurement
- Capital Area Council of Governments Procurement
- San Antonio River Authority Business Opportunities: wired through Bonfire.
- CPS Energy Procurement and Suppliers: wired through CPS Energy B2GNow public proposal search.
- Austin Energy Vendor Information
- San Antonio Water System Purchasing
- North Texas Municipal Water District Business Opportunities: wired through Bonfire.
- Port Houston Procurement

### Priority 4: Education Sources Not Covered By ESBD

- Austin ISD Purchasing: wired through Bonfire.
- Houston ISD Procurement: wired through IonWave public current-bids table.
- San Antonio ISD Purchasing: wired through Bonfire.
- Dallas College Supplier Information
- Lone Star College Purchasing: wired through IonWave public current-bids table.

## Next Connector Families To Investigate

1. Bonfire portals: working for Dallas, Harris County, Fort Worth, Frisco, Round Rock, McKinney, Austin ISD, DFW Airport, DART, SAISD, San Antonio River Authority, and North Texas Municipal Water District. Keep adding confirmed Texas Bonfire hosts one at a time.
2. IonWave portals: connector family is implemented. Continue adding confirmed Texas IonWave hosts one at a time, with rate-limit-safe queueing and page caching.
3. OpenGov portals: connector family is implemented for Collin County and Sugar Land. Add any newly confirmed Texas OpenGov hosts through the same parser.
4. CivicPlus/official HTML pages: implement parsers only where the page contains current bid rows or downloadable bid documents.
5. Airport/transit/utility portals: Port Houston uses Workday Strategic Sourcing; Houston uses Beacon; Bexar uses Infor/CivCast; Addison uses BidNet Direct. Each needs a specific connector or non-scraping alert workflow if blocked.
6. Blocked sites: CAPCOG currently blocks server-side requests; do not mark it working until a non-blocked official feed, approved alert-email workflow, allowlisting, or browser collector exists.
