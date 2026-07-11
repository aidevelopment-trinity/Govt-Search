# Source Connection Checklist

Generated from local verification of `leadership training` across all states and levels.

## Current Status

- Latest all-source local verification: 121 searched, 120 returned results, 2 directory-pending sources, 0 hard errors.
- Run status pending sources are now true unresolved connectors only:
  - Capital Area Council of Governments Procurement
  - Equalis Group Current Solicitations
- Source health can still show temporary IonWave cooldown rows during a full run. Those sources are wired, but the IonWave platform can return 429/challenge pages when many IonWave portals are searched in one burst.
- The production build passes with the current connector code.

## Newly Wired In This Pass

1. Colorado Vendor Self Service
   - Platform: Advantage VSS public published-solicitations feed.
   - Verified with `leadership training`; returned `Chronic Disease Assessment, Planning and Training`.
2. Colorado VSS Published Solicitations
   - Platform: same Advantage VSS feed as Colorado VSS.
   - Verified as connected through the shared VSS fetch and parser.
3. Colorado Department of Human Services Procurement
   - Platform: Colorado VSS with CDHS department filtering.
   - Verified with `treatment`; returned `RFP for Sex Offender Treatment Services`.
4. Palm Beach County Purchasing
   - Platform: Palm Beach County Advantage VSS.
   - Verified with `services`; returned active Palm Beach rows and VSS document-access links.
5. Mecklenburg County Vendor Opportunities
   - Platform: MeckProcure/Advantage VSS.
   - Verified with `tire`; returned `Scrap Tire Collection and Recycling Services RFP`.
6. The Woodlands Township Bids
   - Platform: official Township open-bids page with official Visit The Woodlands fallback when the Township host blocks Vercel.
   - Verified with `media`; returned the integrated creative/media agency RFP and a direct PDF document link.
7. City of Allen Purchasing
   - Platform: DemandStar public agency feed.
   - Verified as searched with status `ok`; current matching test terms may return zero because available rows are not active/future matches.
8. CPS Energy Procurement and Suppliers
   - Platform: CPS Energy B2GNow public proposal search.
   - Verified with `supply`; returned 11 active proposal rows with detail/document links.

## Previously Wired And Still Working

- Texas ESBD
- SAM.gov, when a valid key/quota is available
- GSA Forecast of Contracting Opportunities
- Georgia Procurement Registry
- North Carolina eVP, City of Raleigh, and Wake County filtering
- City of Atlanta and Metro Nashville Oracle Negotiation Abstracts
- City of Houston and City of Memphis Beacon portals
- BidNet/Rocky Mountain E-Purchasing sources already connected for Colorado and Georgia
- Bonfire, OpenGov, DemandStar, Miami-Dade, Gwinnett, Tennessee, and static official-page sources already connected in prior passes

## Remaining True Blockers

1. Capital Area Council of Governments Procurement
   - Official page: `https://www.capcog.org/about/do-business-with-us/`
   - Finding: server-side requests to the page, WordPress REST API, search, feed, and sitemap paths return Cloudflare 403.
   - Important nuance: exact CAPCOG PDF URLs are fetchable if already known, but the server cannot fetch a reliable official index of current opportunities.
   - Needed path: email-alert ingestion, CAPCOG allowlisting/API access, or an approved browser collector.
2. Equalis Group Current Solicitations
   - Official page: `https://equalisgroup.org/current-solicitations/`
   - Finding: server-side requests to the page and WordPress REST/API paths return Cloudflare challenge pages.
   - Needed path: Equalis alert/email ingestion, allowlisting/API access, or an approved browser collector.

## Wired But Sometimes Throttled

These are connected, but may show temporary source-health pending rows if IonWave rate-limits the live run:

1. City of Denton Purchasing
2. City of Georgetown Purchasing
3. City of Irving Purchasing
4. City of Plano Purchasing
5. Tarrant County Purchasing
6. Goodbuy Purchasing Cooperative Bid Opportunities
7. Houston ISD Procurement
8. Lone Star College Purchasing
9. TIPS-USA Cooperative Bid Opportunities

The app now starts IonWave searches first, queues them through a single platform-wide queue, and uses the corrected Denton public-bids URL. If IonWave still returns 429/challenge pages, the correct next improvement is a scheduled source snapshot job or approved browser/email collector, not pretending the live server fetch succeeded.
