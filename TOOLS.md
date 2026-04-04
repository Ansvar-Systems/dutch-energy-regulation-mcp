# Tools -- Dutch Energy Regulation MCP

8 tools for searching and retrieving Dutch energy sector regulations.

All data is in Dutch. Tool descriptions and parameter names are in English.

---

## 1. nl_energy_search_regulations

Search across Dutch energy regulations from ACM, RVO, and SodM. Covers Elektriciteitswet 1998, Gaswet, Warmtewet, and the new Energiewet. Supports Dutch-language queries.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query in Dutch or English (e.g., `elektriciteitswet`, `energiewet`, `warmtelevering`, `gaswinning`, `SDE++`) |
| `regulator` | string | No | Filter by regulator: `acm`, `rvo`, `sodm` |
| `type` | string | No | Filter by regulation type: `wet`, `besluit`, `regeling`, `beleidsregel` |
| `status` | string | No | Filter by status: `in_force`, `repealed`, `draft`. Defaults to all. |
| `limit` | number | No | Maximum results (default 20, max 100) |

**Returns:** Array of matching regulations with reference, title, text, type, status, effective date, and URL.

**Example:**

```json
{
  "query": "elektriciteitswet",
  "regulator": "acm",
  "status": "in_force"
}
```

**Data sources:** ACM (acm.nl), RVO (rvo.nl), SodM (sodm.nl), wetten.overheid.nl.

**Limitations:** Summaries, not full legal text. Dutch-language content only.

---

## 2. nl_energy_get_regulation

Get a specific Dutch energy regulation by its reference string. Returns the full record including text, metadata, and URL.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `reference` | string | Yes | Regulation reference (e.g., `Elektriciteitswet 1998`) |

**Returns:** Single regulation record with all fields, or an error if not found.

**Example:**

```json
{
  "reference": "Elektriciteitswet 1998"
}
```

**Data sources:** wetten.overheid.nl, acm.nl, rvo.nl, sodm.nl.

**Limitations:** Exact match on reference string. Partial matches are not supported -- use `nl_energy_search_regulations` for fuzzy search.

---

## 3. nl_energy_search_grid_codes

Search TenneT NL grid codes, congestion management rules, and network connection requirements.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query (e.g., `netcode`, `congestie`, `transportcapaciteit`, `aansluiting`, `balancering`) |
| `code_type` | string | No | Filter by code type: `technical_regulation`, `market_regulation`, `grid_connection`, `balancing`, `congestion_management` |
| `limit` | number | No | Maximum results (default 20, max 100) |

**Returns:** Array of matching grid code documents with reference, title, text, code type, version, effective date, and URL.

**Example:**

```json
{
  "query": "netcode",
  "code_type": "market_regulation"
}
```

**Data sources:** TenneT NL (tennet.eu).

**Limitations:** Summaries of technical regulations, not the full PDF documents. Dutch-language content only.

---

## 4. nl_energy_get_grid_code

Get a specific TenneT NL grid code document by its database ID. The ID is returned in search results from `nl_energy_search_grid_codes`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `document_id` | number | Yes | Grid code document ID (from search results) |

**Returns:** Single grid code record with all fields, or an error if not found.

**Example:**

```json
{
  "document_id": 2
}
```

**Data sources:** TenneT NL (tennet.eu).

**Limitations:** Requires a valid database ID. Use `nl_energy_search_grid_codes` to find IDs.

---

## 5. nl_energy_search_decisions

Search ACM method decisions, tariff determinations, and market monitoring reports.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query (e.g., `tarief`, `methodebesluit`, `reguleringsperiode`, `nettarief`, `transporttarief`) |
| `decision_type` | string | No | Filter by decision type: `tariff`, `revenue_cap`, `methodology`, `benchmark`, `complaint`, `market_monitoring` |
| `limit` | number | No | Maximum results (default 20, max 100) |

**Returns:** Array of matching decisions with reference, title, text, decision type, date decided, parties, and URL.

**Example:**

```json
{
  "query": "methodebesluit",
  "decision_type": "methodology"
}
```

**Data sources:** ACM (acm.nl).

**Limitations:** Summaries of decisions, not full legal text. Dutch-language content only.

---

## 6. nl_energy_about

Return metadata about this MCP server: version, list of regulators covered, tool list, and data coverage summary. Takes no parameters.

**Parameters:** None.

**Returns:** Server name, version, description, list of regulators (id, name, URL), and tool list (name, description).

**Example:**

```json
{}
```

**Data sources:** N/A (server metadata).

**Limitations:** None.

---

## 7. nl_energy_list_sources

List data sources with record counts, provenance URLs, and last refresh dates.

**Parameters:** None.

**Returns:** Array of data sources with id, name, URL, record count, data type, last refresh date, and refresh frequency.

**Example:**

```json
{}
```

**Data sources:** N/A (server metadata).

**Limitations:** None.

---

## 8. nl_energy_check_data_freshness

Check data freshness for each source. Reports staleness status and provides update instructions.

**Parameters:** None.

**Returns:** Freshness table with source, last refresh date, frequency, and status (Current/Due/OVERDUE).

**Example:**

```json
{}
```

**Data sources:** N/A (server metadata).

**Limitations:** None.
