# Coverage -- Dutch Energy Regulation MCP

Current coverage of Dutch energy sector regulatory data.

**Last updated:** 2026-04-04

---

## Sources

| Source | Authority | Records | Content |
|--------|-----------|---------|---------|
| **ACM** | Authority for Consumers & Markets | 132 regulations | Elektriciteitswet, Gaswet, Warmtewet, Energiewet, tariff methodology, market supervision |
| **RVO** | Netherlands Enterprise Agency | 49 regulations | SDE++ subsidy scheme, renewable energy support, energy efficiency obligations |
| **SodM** | State Supervision of Mines | 45 regulations | Gas extraction (Groningen), geothermal safety, mining law, offshore safety |
| **TenneT NL** | Dutch TSO | 22 grid codes | Netcode, congestion management, transport capacity, grid connection, balancing |
| **ACM (decisions)** | Authority for Consumers & Markets | 117 decisions | Tariff determinations, methodology approvals, revenue caps, market monitoring |
| **Total** | | **365 records** | ~360 KB SQLite database |

---

## Regulation Types

| Type | Dutch Term | Count | Regulators |
|------|-------------|-------|------------|
| `regeling` | Regeling (Ministerial Regulation) | 101 | ACM, RVO, SodM |
| `besluit` | Besluit (Decree/Decision) | 100 | ACM, RVO |
| `wet` | Wet (Act/Law) | 19 | Tweede Kamer via ACM |
| `beleidsregel` | Beleidsregel (Policy Rule) | 6 | ACM |

## Grid Code Types

| Type | Description | Count |
|------|-------------|-------|
| `balancing` | Balancing market rules and imbalance settlement | 6 |
| `market_regulation` | Market rules for electricity trading and settlement | 5 |
| `congestion_management` | Congestion management and transport capacity allocation | 4 |
| `technical_regulation` | Technical requirements for generation, consumption, and storage | 4 |
| `grid_connection` | Grid connection requirements for transmission and distribution | 3 |

## Decision Types

| Type | Description | Count |
|------|-------------|-------|
| `tariff` | Network tariff (nettarief/transporttarief) determinations | 98 |
| `methodology` | Methodology approvals (methodebesluit) for tariff calculation | 9 |
| `revenue_cap` | Revenue cap determinations for network operators | 4 |
| `benchmark` | Benchmarking of network operator efficiency | 2 |
| `complaint` | Consumer and industry complaint rulings | 2 |
| `market_monitoring` | Market monitoring and surveillance reports | 2 |

---

## What Is NOT Included

This is a seed dataset. The following are not yet covered:

- **Full text of original documents** -- records contain summaries, not complete legal text from wetten.overheid.nl
- **Court decisions** -- CBb (College van Beroep voor het bedrijfsleven) energy rulings are not included
- **Historical and repealed regulations** -- only current in-force regulations are covered
- **EU energy directives** -- EU Electricity Directive, Gas Directive, Renewable Energy Directive, etc. are covered by the [EU Regulations MCP](https://github.com/Ansvar-Systems/EU_compliance_MCP), not this server
- **Tweede Kamer proceedings** -- parliamentary energy debates and committee reports are not included
- **Municipal energy plans** -- local authority energy transition plans are not covered
- **Individual tariff schedules** -- utility-specific tariff sheets are not included (only ACM approval decisions)

---

## Limitations

- **Seed dataset** -- 365 records across regulations, grid codes, and decisions
- **Dutch text only** -- all regulatory content is in Dutch. English search queries may return limited results.
- **Summaries, not full legal text** -- records contain representative summaries, not the complete official text from wetten.overheid.nl or regulator websites.
- **Quarterly manual refresh** -- data is updated manually. Recent regulatory changes may not be reflected.
- **No real-time tracking** -- amendments and repeals are not tracked automatically.

---

## Planned Improvements

Full automated ingestion is planned from:

- **wetten.overheid.nl** -- Dutch legislation (Elektriciteitswet, Gaswet, Warmtewet, Energiewet)
- **acm.nl** -- ACM tariff decisions, methodology documents, market monitoring reports
- **tennet.eu** -- TenneT NL grid codes, congestion management, transport capacity rules
- **rvo.nl** -- RVO SDE++ scheme, renewable energy publications, energy efficiency guidance
- **sodm.nl** -- SodM gas extraction regulations, geothermal safety, mining inspectorate publications

---

## Language

All content is in Dutch. The following search terms are useful starting points:

| Dutch Term | English Equivalent |
|-------------|-------------------|
| elektriciteitswet | electricity act |
| energiewet | energy act |
| nettarief | network tariff |
| transporttarief | transport tariff |
| methodebesluit | method decision |
| congestie | congestion |
| netcode | grid code |
| aansluiting | grid connection |
| balancering | balancing |
| warmtelevering | heat supply |
| gaswinning | gas extraction |
| SDE++ | renewable energy subsidy |
| transportcapaciteit | transport capacity |
| duurzame energie | sustainable energy |
