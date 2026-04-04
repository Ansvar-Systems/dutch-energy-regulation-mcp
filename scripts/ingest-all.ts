/**
 * Combined ingestion for all 4 Dutch energy regulators.
 *
 * Inserts regulatory content sourced from:
 *   - ACM (acm.nl) — method decisions, tariff regulations, market supervision
 *   - TenneT (tennet.eu) — grid codes, congestion management, balancing
 *   - RVO (rvo.nl) — SDE++ subsidy scheme, energy efficiency programs
 *   - SodM (sodm.nl) — gas extraction safety, geothermal, mining safety
 *
 * Usage:
 *   npx tsx scripts/ingest-all.ts
 *   npx tsx scripts/ingest-all.ts --force   # drop and recreate
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL } from "../src/db.js";

const DB_PATH = process.env["NL_ENERGY_DB_PATH"] ?? "data/nl-energy.db";
const force = process.argv.includes("--force");

const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
if (force && existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
  console.log(`Deleted ${DB_PATH}`);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL);

// ===================================================================
// REGULATORS
// ===================================================================

const regulators = [
  { id: "acm", name: "ACM", full_name: "Autoriteit Consument & Markt (ACM)", url: "https://acm.nl", description: "Authority for Consumers and Markets — energy market regulation, tariff methodology, method decisions, consumer protection, competition oversight" },
  { id: "tennet", name: "TenneT", full_name: "TenneT TSO B.V.", url: "https://tennet.eu", description: "Dutch-German TSO — high-voltage grid management, grid codes, congestion management, balancing, grid connection standards" },
  { id: "rvo", name: "RVO", full_name: "Rijksdienst voor Ondernemend Nederland (RVO)", url: "https://rvo.nl", description: "Netherlands Enterprise Agency — SDE++ subsidy scheme, energy efficiency, renewable energy support, innovation programs for energy transition" },
  { id: "sodm", name: "SodM", full_name: "Staatstoezicht op de Mijnen (SodM)", url: "https://sodm.nl", description: "State Supervision of Mines — gas extraction safety (Groningen), geothermal energy safety, salt/mineral mining, CO2 storage supervision" },
];

const insertReg = db.prepare("INSERT OR IGNORE INTO regulators (id, name, full_name, url, description) VALUES (?, ?, ?, ?, ?)");
for (const r of regulators) insertReg.run(r.id, r.name, r.full_name, r.url, r.description);
console.log(`Inserted ${regulators.length} regulators`);

// ===================================================================
// REGULATIONS (ACM + RVO + SodM)
// ===================================================================

db.prepare("DELETE FROM regulations").run();

const insertRegulation = db.prepare(`
  INSERT INTO regulations (regulator_id, reference, title, text, type, status, effective_date, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Placeholder: real ingestion will populate from wetten.overheid.nl, acm.nl, rvo.nl, sodm.nl
const allRegs: string[][] = [];

const insertRegBatch = db.transaction(() => {
  for (const r of allRegs) {
    insertRegulation.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]);
  }
});
insertRegBatch();
const acmCount = allRegs.filter(r => r[0] === "acm").length;
const rvoCount = allRegs.filter(r => r[0] === "rvo").length;
const sodmCount = allRegs.filter(r => r[0] === "sodm").length;
console.log(`Inserted ${acmCount} ACM + ${rvoCount} RVO + ${sodmCount} SodM = ${allRegs.length} regulations`);

// ===================================================================
// GRID CODES (TenneT NL)
// ===================================================================

db.prepare("DELETE FROM grid_codes").run();

const insertGridCode = db.prepare(`
  INSERT INTO grid_codes (reference, title, text, code_type, version, effective_date, url) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Placeholder: real ingestion will populate from tennet.eu and wetten.overheid.nl
const allGridCodes: string[][] = [];

const insertGCBatch = db.transaction(() => {
  for (const g of allGridCodes) {
    insertGridCode.run(g[0], g[1], g[2], g[3], g[4], g[5], g[6]);
  }
});
insertGCBatch();
console.log(`Inserted ${allGridCodes.length} TenneT grid codes`);

// ===================================================================
// DECISIONS (ACM)
// ===================================================================

db.prepare("DELETE FROM decisions").run();

const insertDecision = db.prepare(`
  INSERT INTO decisions (reference, title, text, decision_type, date_decided, parties, url) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Placeholder: real ingestion will populate from acm.nl
const allDecisions: string[][] = [];

const insertDecBatch = db.transaction(() => {
  for (const d of allDecisions) {
    insertDecision.run(d[0], d[1], d[2], d[3], d[4], d[5], d[6]);
  }
});
insertDecBatch();
console.log(`Inserted ${allDecisions.length} ACM decisions`);

// ===================================================================
// REBUILD FTS INDEXES
// ===================================================================

db.exec("INSERT INTO regulations_fts(regulations_fts) VALUES('rebuild')");
db.exec("INSERT INTO grid_codes_fts(grid_codes_fts) VALUES('rebuild')");
db.exec("INSERT INTO decisions_fts(decisions_fts) VALUES('rebuild')");

// ===================================================================
// DB METADATA
// ===================================================================

db.exec(`CREATE TABLE IF NOT EXISTS db_metadata (
  key   TEXT PRIMARY KEY,
  value TEXT,
  last_updated TEXT DEFAULT (datetime('now'))
)`);

const stats = {
  regulators: (db.prepare("SELECT count(*) as n FROM regulators").get() as { n: number }).n,
  regulations: (db.prepare("SELECT count(*) as n FROM regulations").get() as { n: number }).n,
  grid_codes: (db.prepare("SELECT count(*) as n FROM grid_codes").get() as { n: number }).n,
  decisions: (db.prepare("SELECT count(*) as n FROM decisions").get() as { n: number }).n,
  acm: (db.prepare("SELECT count(*) as n FROM regulations WHERE regulator_id = 'acm'").get() as { n: number }).n,
  rvo: (db.prepare("SELECT count(*) as n FROM regulations WHERE regulator_id = 'rvo'").get() as { n: number }).n,
  sodm: (db.prepare("SELECT count(*) as n FROM regulations WHERE regulator_id = 'sodm'").get() as { n: number }).n,
};

const insertMeta = db.prepare("INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)");
insertMeta.run("schema_version", "1.0");
insertMeta.run("tier", "free");
insertMeta.run("domain", "dutch-energy-regulation");
insertMeta.run("build_date", new Date().toISOString().split("T")[0]);
insertMeta.run("regulations_count", String(stats.regulations));
insertMeta.run("grid_codes_count", String(stats.grid_codes));
insertMeta.run("decisions_count", String(stats.decisions));
insertMeta.run("total_records", String(stats.regulations + stats.grid_codes + stats.decisions));

console.log(`\nDatabase summary:`);
console.log(`  Regulators:         ${stats.regulators}`);
console.log(`  Regulations:        ${stats.regulations} (ACM: ${stats.acm}, RVO: ${stats.rvo}, SodM: ${stats.sodm})`);
console.log(`  Grid codes:         ${stats.grid_codes} (TenneT)`);
console.log(`  Decisions:          ${stats.decisions} (ACM)`);
console.log(`  Total documents:    ${stats.regulations + stats.grid_codes + stats.decisions}`);
console.log(`\nDone. Database at ${DB_PATH}`);

db.close();
