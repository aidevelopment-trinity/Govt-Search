# Government Contracts Research Workspace

This workspace is for a low-cost, human-in-the-loop contract discovery process for a leadership and management training business.

The goal is not to automate proposal submission. The goal is to build a repeatable target-account and opportunity-review workflow:

1. Register for official alerts.
2. Route alerts into one inbox.
3. Track opportunities and target buyers in CSVs.
4. Score fit manually or with lightweight AI help.
5. Draft bid/no-bid notes, compliance checklists, and proposal outlines.
6. Keep a human responsible for final review, certification, pricing, and submission.

## Files

- `procurement_sources.csv`: Federal and state procurement sources to register with and monitor.
- `saved_searches.csv`: Search terms, NAICS/PSC/NIGP-style categories, and alert setup notes.
- `texas_target_accounts.csv`: First-pass Texas target-account universe, grouped by buyer type.
- `opportunity_tracker.csv`: Working pipeline for open opportunities discovered from alerts.

## Initial Focus

Federal:

- SAM.gov contract opportunities.
- Agencies that buy leadership, management, workforce, public safety, HR, and organizational development training.

States:

- Texas
- Florida
- Tennessee
- North Carolina
- Georgia

Texas gets the deepest first pass because it has strong business conditions, high public-sector volume, and many state/local/special-purpose public buyers.

## Operating Cadence

Daily:

- Review email alerts.
- Add promising opportunities to `opportunity_tracker.csv`.
- Mark obvious misses as `Pass`.

Weekly:

- Review target accounts.
- Search top portals manually for new terms.
- Add past award evidence to target-account notes.
- Pick 3-5 buyers for relationship-building outreach.

Monthly:

- Re-score target accounts.
- Add/remove saved searches.
- Review won/lost/pass patterns.

## Fit Criteria

Strong opportunities usually include one or more of:

- Leadership development
- Supervisor training
- Management training
- Executive coaching
- Organizational development
- Strategic planning
- Change management
- Workforce development
- Succession planning
- Employee engagement
- Public safety leadership
- Conflict resolution
- Communication training

Useful codes:

- NAICS 611430: Professional and Management Development Training
- NAICS 541611: Administrative Management and General Management Consulting
- NAICS 541612: Human Resources Consulting Services
- NAICS 541618: Other Management Consulting Services
- PSC U008: Training/Curriculum Development
