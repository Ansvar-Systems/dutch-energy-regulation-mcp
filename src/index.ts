#!/usr/bin/env node

/**
 * Dutch Energy Regulation MCP -- stdio entry point.
 *
 * Provides MCP tools for querying Dutch energy regulators:
 *   - ACM (Autoriteit Consument & Markt)
 *   - TenneT TSO B.V. (grid codes, congestion management)
 *   - RVO (Rijksdienst voor Ondernemend Nederland — SDE++)
 *   - SodM (Staatstoezicht op de Mijnen — gas extraction, geothermal)
 *
 * Tool prefix: nl_energy_
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  listRegulators,
  searchRegulations,
  getRegulationByReference,
  searchGridCodes,
  getGridCode,
  searchDecisions,
  getMetadataValue,
  getRecordCounts,
  getRegulationCountByRegulator,
} from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pkgVersion = "0.1.0";
try {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, "..", "package.json"), "utf8"),
  ) as { version: string };
  pkgVersion = pkg.version;
} catch {
  // fallback to default
}

const SERVER_NAME = "dutch-energy-regulation-mcp";

// --- Tool definitions ---

const TOOLS = [
  {
    name: "nl_energy_search_regulations",
    description:
      "Search across Dutch energy regulations from ACM, RVO, and SodM. Covers Elektriciteitswet 1998, Gaswet, Warmtewet, and the new Energiewet. Supports Dutch-language queries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query in Dutch or English (e.g., 'elektriciteitswet', 'energiewet', 'warmtelevering', 'gaswinning', 'SDE++')",
        },
        regulator: {
          type: "string",
          enum: ["acm", "rvo", "sodm"],
          description: "Filter by regulator. Optional.",
        },
        type: {
          type: "string",
          enum: ["wet", "besluit", "regeling", "beleidsregel"],
          description: "Filter by regulation type. Optional.",
        },
        status: {
          type: "string",
          enum: ["in_force", "repealed", "draft"],
          description: "Filter by status. Defaults to all.",
        },
        limit: {
          type: "number",
          description: "Maximum results (default 20, max 100).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "nl_energy_get_regulation",
    description:
      "Get a specific Dutch energy regulation by its reference string (e.g., 'Elektriciteitswet 1998'). Returns full text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        reference: {
          type: "string",
          description: "Regulation reference (e.g., 'Elektriciteitswet 1998')",
        },
      },
      required: ["reference"],
    },
  },
  {
    name: "nl_energy_search_grid_codes",
    description:
      "Search TenneT NL grid codes, congestion management rules, and network connection requirements.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query (e.g., 'netcode', 'congestie', 'transportcapaciteit', 'aansluiting', 'balancering')",
        },
        code_type: {
          type: "string",
          enum: ["technical_regulation", "market_regulation", "grid_connection", "balancing", "congestion_management"],
          description: "Filter by code type. Optional.",
        },
        limit: {
          type: "number",
          description: "Maximum results (default 20, max 100).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "nl_energy_get_grid_code",
    description:
      "Get a specific TenneT NL grid code document by its database ID. Returns full text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "number",
          description: "Grid code document ID (from search results)",
        },
      },
      required: ["document_id"],
    },
  },
  {
    name: "nl_energy_search_decisions",
    description:
      "Search ACM method decisions, tariff determinations, and market monitoring reports.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query (e.g., 'tarief', 'methodebesluit', 'reguleringsperiode', 'nettarief', 'transporttarief')",
        },
        decision_type: {
          type: "string",
          enum: ["tariff", "revenue_cap", "methodology", "benchmark", "complaint", "market_monitoring"],
          description: "Filter by decision type. Optional.",
        },
        limit: {
          type: "number",
          description: "Maximum results (default 20, max 100).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "nl_energy_about",
    description:
      "Dutch energy regulation MCP server. Covers ACM (tariff methodology and market supervision), TenneT NL (grid codes and congestion management), RVO (SDE++ subsidy scheme), and SodM (gas extraction and geothermal safety).",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "nl_energy_list_sources",
    description:
      "List data sources with record counts, provenance URLs, and last refresh dates.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "nl_energy_check_data_freshness",
    description:
      "Check data freshness for each source. Reports staleness and provides update instructions.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// --- Zod schemas ---

const SearchRegulationsArgs = z.object({
  query: z.string().min(1),
  regulator: z
    .enum(["acm", "rvo", "sodm"])
    .optional(),
  type: z
    .enum(["wet", "besluit", "regeling", "beleidsregel"])
    .optional(),
  status: z.enum(["in_force", "repealed", "draft"]).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const GetRegulationArgs = z.object({
  reference: z.string().min(1),
});

const SearchGridCodesArgs = z.object({
  query: z.string().min(1),
  code_type: z
    .enum([
      "technical_regulation",
      "market_regulation",
      "grid_connection",
      "balancing",
      "congestion_management",
    ])
    .optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const GetGridCodeArgs = z.object({
  document_id: z.number().int().positive(),
});

const SearchDecisionsArgs = z.object({
  query: z.string().min(1),
  decision_type: z
    .enum(["tariff", "revenue_cap", "methodology", "benchmark", "complaint", "market_monitoring"])
    .optional(),
  limit: z.number().int().positive().max(100).optional(),
});

// --- Helpers ---

let _cachedBuildDate: string | null = null;

function dbBuildDate(): string {
  if (_cachedBuildDate) return _cachedBuildDate;
  try {
    _cachedBuildDate = getMetadataValue("build_date") ?? "unknown";
  } catch {
    _cachedBuildDate = "unknown";
  }
  return _cachedBuildDate;
}

function makeMeta() {
  return {
    _meta: {
      disclaimer:
        "Reference data only — not legal or regulatory advice. Verify against official sources.",
      data_source:
        "Dutch energy regulators (acm.nl, tennet.eu, rvo.nl, sodm.nl)",
      database_built: dbBuildDate(),
    },
  };
}

function textContent(data: unknown) {
  const payload =
    data !== null && typeof data === "object" && !Array.isArray(data)
      ? { ...(data as Record<string, unknown>), ...makeMeta() }
      : { data, ...makeMeta() };
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
  };
}

function errorContent(message: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: message, ...makeMeta() }, null, 2),
      },
    ],
    isError: true as const,
  };
}

// --- Server setup ---

const server = new Server(
  { name: SERVER_NAME, version: pkgVersion },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "nl_energy_search_regulations": {
        const parsed = SearchRegulationsArgs.parse(args);
        const results = searchRegulations({
          query: parsed.query,
          regulator: parsed.regulator,
          type: parsed.type,
          status: parsed.status,
          limit: parsed.limit,
        });
        return textContent({ results, count: results.length });
      }

      case "nl_energy_get_regulation": {
        const parsed = GetRegulationArgs.parse(args);
        const regulation = getRegulationByReference(parsed.reference);
        if (!regulation) {
          return errorContent(`Regulation not found: ${parsed.reference}`);
        }
        return textContent(regulation);
      }

      case "nl_energy_search_grid_codes": {
        const parsed = SearchGridCodesArgs.parse(args);
        const results = searchGridCodes({
          query: parsed.query,
          code_type: parsed.code_type,
          limit: parsed.limit,
        });
        return textContent({ results, count: results.length });
      }

      case "nl_energy_get_grid_code": {
        const parsed = GetGridCodeArgs.parse(args);
        const code = getGridCode(parsed.document_id);
        if (!code) {
          return errorContent(`Grid code not found: ID ${parsed.document_id}`);
        }
        return textContent(code);
      }

      case "nl_energy_search_decisions": {
        const parsed = SearchDecisionsArgs.parse(args);
        const results = searchDecisions({
          query: parsed.query,
          decision_type: parsed.decision_type,
          limit: parsed.limit,
        });
        return textContent({ results, count: results.length });
      }

      case "nl_energy_about": {
        const regulators = listRegulators();
        return textContent({
          name: SERVER_NAME,
          version: pkgVersion,
          description:
            "Dutch energy regulation MCP server. Covers ACM (tariff methodology and market supervision), TenneT NL (grid codes and congestion management), RVO (SDE++ subsidy scheme), and SodM (gas extraction and geothermal safety).",
          regulators: regulators.map((r) => ({
            id: r.id,
            name: r.name,
            url: r.url,
          })),
          tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
        });
      }

      case "nl_energy_list_sources": {
        const counts = getRecordCounts();
        const sources = [
          {
            id: "acm",
            name: "Autoriteit Consument & Markt (ACM)",
            url: "https://acm.nl",
            record_count: getRegulationCountByRegulator("acm"),
            data_type: "regulations",
            last_refresh: dbBuildDate(),
            refresh_frequency: "quarterly",
          },
          {
            id: "tennet",
            name: "TenneT TSO B.V.",
            url: "https://tennet.eu",
            record_count: counts.grid_codes,
            data_type: "grid_codes",
            last_refresh: dbBuildDate(),
            refresh_frequency: "quarterly",
          },
          {
            id: "rvo",
            name: "Rijksdienst voor Ondernemend Nederland (RVO)",
            url: "https://rvo.nl",
            record_count: getRegulationCountByRegulator("rvo"),
            data_type: "regulations",
            last_refresh: dbBuildDate(),
            refresh_frequency: "quarterly",
          },
          {
            id: "sodm",
            name: "Staatstoezicht op de Mijnen (SodM)",
            url: "https://sodm.nl",
            record_count: getRegulationCountByRegulator("sodm"),
            data_type: "regulations",
            last_refresh: dbBuildDate(),
            refresh_frequency: "quarterly",
          },
        ];
        return textContent({
          sources,
          total_records: counts.regulations + counts.grid_codes + counts.decisions,
        });
      }

      case "nl_energy_check_data_freshness": {
        const buildDate = dbBuildDate();
        const buildMs = buildDate !== "unknown" ? Date.parse(buildDate) : NaN;
        const nowMs = Date.now();

        const frequencyDays: Record<string, number> = {
          quarterly: 90,
        };

        const sourceEntries = [
          { source: "ACM (acm.nl)", frequency: "quarterly" },
          { source: "TenneT (tennet.eu)", frequency: "quarterly" },
          { source: "RVO (rvo.nl)", frequency: "quarterly" },
          { source: "SodM (sodm.nl)", frequency: "quarterly" },
        ];

        const rows = sourceEntries.map((s) => {
          let status = "Unknown";
          if (!isNaN(buildMs)) {
            const thresholdMs = (frequencyDays[s.frequency] ?? 90) * 86_400_000;
            const ageMs = nowMs - buildMs;
            if (ageMs <= thresholdMs) {
              status = "Current";
            } else if (ageMs <= thresholdMs * 1.5) {
              status = "Due";
            } else {
              status = "OVERDUE";
            }
          }
          return { source: s.source, last_refresh: buildDate, frequency: s.frequency, status };
        });

        const header = "| Source | Last Refresh | Frequency | Status |";
        const sep = "|---|---|---|---|";
        const tableRows = rows.map(
          (r) => `| ${r.source} | ${r.last_refresh} | ${r.frequency} | ${r.status} |`,
        );
        const table = [header, sep, ...tableRows].join("\n");

        const updateInstructions =
          "To refresh data, run: npx tsx scripts/ingest-all.ts --force";

        return textContent({
          freshness_table: table,
          build_date: buildDate,
          update_instructions: updateInstructions,
          entries: rows,
        });
      }

      default:
        return errorContent(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorContent(`Error in ${name}: ${message}`);
  }
});

// --- Main ---

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`${SERVER_NAME} v${pkgVersion} running on stdio\n`);
}

main().catch((err) => {
  process.stderr.write(
    `Fatal error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
