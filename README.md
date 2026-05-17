# Dutch Energy Regulation MCP

<!-- ANSVAR-CTA-BEGIN -->
> ### ▶ Try this MCP instantly via Ansvar Gateway
> **50 free queries/day · no card required · OAuth signup at [ansvar.eu/gateway](https://ansvar.eu/gateway)**
>
> One endpoint, one OAuth signup, access from any MCP-compatible client.

### Connect

**Claude Code** (one line):

```bash
claude mcp add ansvar --transport http https://gateway.ansvar.eu/mcp
```

**Claude Desktop / Cursor** — add to `claude_desktop_config.json` (or `mcp.json`):

```json
{
  "mcpServers": {
    "ansvar": {
      "type": "url",
      "url": "https://gateway.ansvar.eu/mcp"
    }
  }
}
```

**Claude.ai** — Settings → Connectors → Add custom connector → paste `https://gateway.ansvar.eu/mcp`

First request opens an OAuth flow at [ansvar.eu/gateway](https://ansvar.eu/gateway). After signup, your client is bound to your account; tier (free / premium / team / company) determines fan-out, quota, and which downstream MCPs are reachable.

---

## Self-host this MCP

You can also clone this repo and build the corpus yourself. The schema,
fetcher, and tool implementations all live here. What is not in the repo is
the pre-built database — TDM and standards-licensing constraints on the
upstream sources mean we host the corpus on Ansvar infrastructure rather
than redistribute it as a public artifact.

Build your own: run this repo's ingestion script (entry-point varies per
repo — typically `scripts/ingest.sh`, `npm run ingest`, or `make ingest`;
check the repo root).
<!-- ANSVAR-CTA-END -->


MCP server for Dutch energy sector regulations -- ACM tariff methodology, TenneT NL grid codes, RVO SDE++ subsidy scheme, SodM gas extraction safety.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Covers four Dutch energy regulators with full-text search across regulations, grid codes, and regulatory decisions. All data is in Dutch.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Regulators Covered

| Regulator | Role | Website |
|-----------|------|---------|
| **ACM** (Autoriteit Consument & Markt) | Energy market regulation, tariff methodology, market monitoring, consumer protection | [acm.nl](https://acm.nl) |
| **TenneT TSO B.V.** | Electricity transmission, grid codes, congestion management, transport capacity | [tennet.eu](https://tennet.eu) |
| **RVO** (Rijksdienst voor Ondernemend Nederland) | SDE++ renewable energy subsidy, energy efficiency, sustainability support | [rvo.nl](https://rvo.nl) |
| **SodM** (Staatstoezicht op de Mijnen) | Gas extraction safety (Groningen), geothermal safety, mining law, offshore safety | [sodm.nl](https://sodm.nl) |

---

## Tools

| Tool | Description |
|------|-------------|
| `nl_energy_search_regulations` | Full-text search across energy regulations from ACM, RVO, and SodM |
| `nl_energy_get_regulation` | Get a specific regulation by reference string (e.g., `Elektriciteitswet 1998`) |
| `nl_energy_search_grid_codes` | Search TenneT NL grid codes, congestion management, and transport capacity rules |
| `nl_energy_get_grid_code` | Get a specific grid code document by database ID |
| `nl_energy_search_decisions` | Search ACM tariff decisions, methodology approvals, and market monitoring |
| `nl_energy_about` | Return server metadata: version, regulators, tool list, data coverage |
| `nl_energy_list_sources` | List data sources with record counts and provenance URLs |
| `nl_energy_check_data_freshness` | Check data freshness and staleness status for each source |

Full tool documentation: [TOOLS.md](TOOLS.md)

---

## Data Coverage

| Source | Records | Content |
|--------|---------|---------|
| ACM | 132 regulations | Elektriciteitswet, Gaswet, Warmtewet, Energiewet, tariff methodology |
| RVO | 49 regulations | SDE++ subsidy scheme, renewable energy, energy efficiency |
| SodM | 45 regulations | Gas extraction, geothermal safety, mining law, offshore safety |
| TenneT NL | 22 grid codes | Netcode, congestion management, transport capacity, balancing |
| ACM (decisions) | 117 decisions | Tariff determinations, methodology approvals, revenue caps |
| **Total** | **365 records** | ~360 KB database |

**Language note:** All regulatory content is in Dutch. Search queries work best in Dutch (e.g., `elektriciteitswet`, `nettarief`, `methodebesluit`, `congestie`).

Full coverage details: [COVERAGE.md](COVERAGE.md)

---

## Data Sources

See [sources.yml](sources.yml) for machine-readable provenance metadata.

---

## Docker

```bash
docker build -t dutch-energy-regulation-mcp .
docker run --rm -p 3000:3000 -v /path/to/data:/app/data dutch-energy-regulation-mcp
```

Set `NL_ENERGY_DB_PATH` to use a custom database location (default: `data/nl-energy.db`).

---

## Development

```bash
npm install
npm run build
npm run seed         # populate sample data
npm run dev          # HTTP server on port 3000
```

---

## Further Reading

- [TOOLS.md](TOOLS.md) -- full tool documentation with examples
- [COVERAGE.md](COVERAGE.md) -- data coverage and limitations
- [sources.yml](sources.yml) -- data provenance metadata
- [DISCLAIMER.md](DISCLAIMER.md) -- legal disclaimer
- [PRIVACY.md](PRIVACY.md) -- privacy policy
- [SECURITY.md](SECURITY.md) -- vulnerability disclosure

---

## License

Apache-2.0 -- [Ansvar Systems AB](https://ansvar.eu)

See [LICENSE](LICENSE) for the full license text.

See [DISCLAIMER.md](DISCLAIMER.md) for important legal disclaimers about the use of this regulatory data.

---

[ansvar.ai/mcp](https://ansvar.ai/mcp) -- Full MCP server catalog
