/**
 * Seed the Dutch Energy Regulation database with sample data for testing.
 *
 * Inserts representative regulations, grid codes, and decisions from:
 *   - ACM (tariff methodology, market supervision)
 *   - TenneT NL (grid codes, congestion management)
 *   - RVO (SDE++ subsidy scheme)
 *   - SodM (gas extraction safety, geothermal safety)
 *
 * Usage:
 *   npx tsx scripts/seed-sample.ts
 *   npx tsx scripts/seed-sample.ts --force   # drop and recreate
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL } from "../src/db.js";

const DB_PATH = process.env["NL_ENERGY_DB_PATH"] ?? "data/nl-energy.db";
const force = process.argv.includes("--force");

const dir = dirname(DB_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

if (force && existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
  console.log(`Deleted existing database at ${DB_PATH}`);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL);

console.log(`Database initialised at ${DB_PATH}`);

// -- Regulators --

const regulators = [
  {
    id: "acm",
    name: "ACM",
    full_name: "Autoriteit Consument & Markt (ACM)",
    url: "https://acm.nl",
    description:
      "Authority for Consumers and Markets — responsible for energy market regulation, tariff methodology, method decisions, consumer protection, and competition oversight in the Dutch energy sector.",
  },
  {
    id: "tennet",
    name: "TenneT",
    full_name: "TenneT TSO B.V.",
    url: "https://tennet.eu",
    description:
      "Dutch-German transmission system operator — manages the high-voltage electricity grid in the Netherlands, sets grid codes, congestion management rules, balancing requirements, and grid connection standards.",
  },
  {
    id: "rvo",
    name: "RVO",
    full_name: "Rijksdienst voor Ondernemend Nederland (RVO)",
    url: "https://rvo.nl",
    description:
      "Netherlands Enterprise Agency — administers the SDE++ subsidy scheme for renewable energy and CO2 reduction, energy efficiency programs, and innovation support for the energy transition.",
  },
  {
    id: "sodm",
    name: "SodM",
    full_name: "Staatstoezicht op de Mijnen (SodM)",
    url: "https://sodm.nl",
    description:
      "State Supervision of Mines — supervises safety of gas extraction (including Groningen), geothermal energy, salt and mineral mining, and CO2 storage in the Netherlands.",
  },
];

const insertRegulator = db.prepare(
  "INSERT OR IGNORE INTO regulators (id, name, full_name, url, description) VALUES (?, ?, ?, ?, ?)",
);

for (const r of regulators) {
  insertRegulator.run(r.id, r.name, r.full_name, r.url, r.description);
}
console.log(`Inserted ${regulators.length} regulators`);

// -- Regulations (ACM + RVO + SodM) --

const regulations = [
  // ACM
  {
    regulator_id: "acm",
    reference: "Elektriciteitswet 1998",
    title: "Elektriciteitswet 1998 — Wet regulering elektriciteitsvoorziening",
    text: "De Elektriciteitswet 1998 regelt de opwekking, het transport, de distributie en de levering van elektriciteit in Nederland. De wet bevat bepalingen over netbeheer, toegang tot het net, tariefregulering door de ACM, leveringsvergunningen, en consumentenbescherming. Netbeheerders zijn aangewezen door de Minister van Economische Zaken. De ACM stelt de methode vast voor de berekening van transporttarieven en aansluitvergoedingen. De wet implementeert de Europese elektriciteitsrichtlijnen.",
    type: "wet",
    status: "in_force",
    effective_date: "1998-07-01",
    url: "https://wetten.overheid.nl/BWBR0009755",
  },
  {
    regulator_id: "acm",
    reference: "Gaswet",
    title: "Gaswet — Wet regulering gasvoorziening",
    text: "De Gaswet regelt het transport, de distributie en de levering van gas in Nederland. De wet bevat bepalingen over het beheer van het gastransportnet door Gasunie Transport Services (GTS), regionale netbeheerders, tariefregulering door de ACM, en de geleidelijke afbouw van gaswinning uit het Groningenveld. De ACM stelt methodebesluiten vast voor de berekening van gastransporttarieven. De wet implementeert de Europese gasrichtlijnen en -verordeningen.",
    type: "wet",
    status: "in_force",
    effective_date: "2000-08-01",
    url: "https://wetten.overheid.nl/BWBR0011440",
  },
  // RVO
  {
    regulator_id: "rvo",
    reference: "SDE++ Regeling 2024",
    title: "Stimulering Duurzame Energieproductie en Klimaattransitie (SDE++) 2024",
    text: "De SDE++ is de belangrijkste subsidieregeling van de Nederlandse overheid voor de stimulering van duurzame energieproductie en CO2-reductie. De regeling staat open voor hernieuwbare elektriciteit (wind, zon, waterkracht), hernieuwbaar gas (groen gas, waterstof), hernieuwbare warmte (geothermie, biomassa), en CO2-reducerende technieken (CCS, CCU, elektrificatie). Subsidie wordt verleend op basis van de onrendabele top: het verschil tussen de kostprijs van de duurzame techniek en de marktprijs van de conventionele variant. De maximale looptijd is 12-15 jaar afhankelijk van de techniek. RVO beheert de aanvraag-, beschikkings- en uitbetalingsprocessen.",
    type: "regeling",
    status: "in_force",
    effective_date: "2024-06-01",
    url: "https://rvo.nl/subsidies-financiering/sde",
  },
  {
    regulator_id: "rvo",
    reference: "Warmtewet",
    title: "Warmtewet — Wet regulering warmtelevering",
    text: "De Warmtewet regelt de levering van warmte aan kleinverbruikers via warmtenetten. De wet bevat bepalingen over vergunningplicht voor warmteleveranciers, maximumtarieven vastgesteld door de ACM op basis van het niet-meer-dan-anders-principe (NMDA), leveringszekerheid, en consumentenbescherming. De ACM houdt toezicht op naleving. Een nieuwe Wet collectieve warmtevoorziening (Wcw) is in voorbereiding om de transitie naar duurzame warmtebronnen te versnellen.",
    type: "wet",
    status: "in_force",
    effective_date: "2014-01-01",
    url: "https://wetten.overheid.nl/BWBR0033729",
  },
  // SodM
  {
    regulator_id: "sodm",
    reference: "Mijnbouwwet",
    title: "Mijnbouwwet — Wet regulering delfstoffen en aardwarmte",
    text: "De Mijnbouwwet regelt de opsporing en winning van delfstoffen (aardgas, aardolie, zout, kalk) en aardwarmte in Nederland, inclusief het continentaal plat. De wet bevat bepalingen over vergunningen voor opsporing en winning, het winningsplan (goedkeuring door de Minister na advies van SodM en TNO), seismisch risicobeheer, bodemdaling, aansprakelijkheid voor mijnbouwschade, en de verplichting tot het buiten gebruik stellen van putten. SodM houdt toezicht op de naleving van veiligheidseisen. De Tijdelijke wet Groningen regelt de schadeafhandeling voor het Groningenveld apart.",
    type: "wet",
    status: "in_force",
    effective_date: "2003-01-01",
    url: "https://wetten.overheid.nl/BWBR0014168",
  },
];

const insertRegulation = db.prepare(`
  INSERT INTO regulations (regulator_id, reference, title, text, type, status, effective_date, url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertRegsAll = db.transaction(() => {
  for (const r of regulations) {
    insertRegulation.run(
      r.regulator_id, r.reference, r.title, r.text, r.type, r.status, r.effective_date, r.url,
    );
  }
});
insertRegsAll();
console.log(`Inserted ${regulations.length} regulations`);

// -- Grid codes (TenneT NL) --

const gridCodes = [
  {
    reference: "Netcode Elektriciteit",
    title: "Netcode Elektriciteit — technische codes voor het elektriciteitsnet",
    text: "De Netcode Elektriciteit bevat de technische voorwaarden voor aansluiting op en gebruik van het elektriciteitsnet in Nederland. De code is vastgesteld door de ACM op voorstel van de gezamenlijke netbeheerders. Onderwerpen: aansluitcondities, spanningskwaliteit, vermogensfactor, frequentierespons, beveiligingsinstelling, meetinrichtingen, en communicatieprotocollen. De code geldt voor alle aangeslotenen op het hoogspannings-, middenspannings- en laagspanningsnet. TenneT is verantwoordelijk voor de naleving op het hoogspanningsnet.",
    code_type: "technical_regulation",
    version: "2024.1",
    effective_date: "2024-01-01",
    url: "https://wetten.overheid.nl/BWBR0037940",
  },
  {
    reference: "Systeemcode Elektriciteit",
    title: "Systeemcode Elektriciteit — regels voor systeembeheer",
    text: "De Systeemcode Elektriciteit bevat de regels voor het beheer van het elektriciteitsvoorzieningssysteem in Nederland. De code regelt onder meer: balanshandhaving, congestiemanagement, noodmaatregelen, systeemreserves, spanningsregeling, en de uitwisseling van gegevens tussen netbeheerders. TenneT is als landelijk netbeheerder verantwoordelijk voor de balanshandhaving en koopt daartoe regelcapaciteit (FCR, aFRR, mFRR) in via marktgebaseerde mechanismen.",
    code_type: "balancing",
    version: "2024.1",
    effective_date: "2024-01-01",
    url: "https://wetten.overheid.nl/BWBR0037951",
  },
  {
    reference: "TenneT CMP",
    title: "TenneT Congestiemanagement Protocol",
    text: "Het Congestiemanagement Protocol beschrijft de procedures die TenneT toepast bij netcongestie op het hoogspanningsnet. Bij dreigende overbelasting kunnen aangeslotenen worden gevraagd om hun invoeding of afname aan te passen tegen vergoeding (redispatch). Het protocol onderscheidt preventief congestiemanagement (day-ahead en intraday) en curatief congestiemanagement (real-time). TenneT publiceert congestiegebieden en biedt marktpartijen de mogelijkheid om deel te nemen aan congestiemanagement via een transparant biedmechanisme.",
    code_type: "congestion_management",
    version: "3.0",
    effective_date: "2023-07-01",
    url: "https://tennet.eu/nl/netcongestie",
  },
];

const insertGridCode = db.prepare(`
  INSERT INTO grid_codes (reference, title, text, code_type, version, effective_date, url)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertGridAll = db.transaction(() => {
  for (const g of gridCodes) {
    insertGridCode.run(g.reference, g.title, g.text, g.code_type, g.version, g.effective_date, g.url);
  }
});
insertGridAll();
console.log(`Inserted ${gridCodes.length} grid codes`);

// -- Decisions (ACM) --

const decisions = [
  {
    reference: "ACM/23/177520",
    title: "Methodebesluit regionale netbeheerders elektriciteit 2022-2026",
    text: "De ACM heeft het methodebesluit vastgesteld voor de reguleringsperiode 2022-2026 voor regionale netbeheerders elektriciteit. Het besluit bepaalt de methode waarmee de ACM de toegestane inkomsten van de netbeheerders berekent. De methode is gebaseerd op een revenue cap met yardstick competition. De ACM stelt jaarlijks de x-factor (productiviteitskorting) vast op basis van benchmarking van de netbeheerders. Het besluit bevat ook regels voor de vergoeding van investeringen in netverzwaring ten behoeve van de energietransitie.",
    decision_type: "methodology",
    date_decided: "2023-09-15",
    parties: "Alle regionale netbeheerders elektriciteit",
    url: "https://acm.nl/nl/publicaties/methodebesluit-regionale-netbeheerders-elektriciteit",
  },
  {
    reference: "ACM/24/045891",
    title: "Tarievenbesluit transporttarieven elektriciteit TenneT 2024",
    text: "De ACM heeft de maximumtarieven vastgesteld die TenneT in 2024 mag berekenen voor het transport van elektriciteit over het landelijk hoogspanningsnet. De tarieven bestaan uit een aansluitvergoeding, een transportafhankelijk tarief, en een systeemdiensten-tarief. De tarieven zijn gestegen ten opzichte van 2023, met name door hogere investeringen in netverzwaring en de stijgende kosten voor congestiemanagement.",
    decision_type: "tariff",
    date_decided: "2024-01-15",
    parties: "TenneT TSO B.V.",
    url: "https://acm.nl/nl/publicaties/tarievenbesluit-tennet-2024",
  },
  {
    reference: "ACM/24/098234",
    title: "Marktmonitor Elektriciteit en Gas 2023",
    text: "De jaarlijkse marktmonitor van de ACM analyseert de werking van de Nederlandse elektriciteits- en gasmarkten. Het rapport behandelt de ontwikkeling van wholesale- en retailprijzen, marktconcentratie, switchgedrag van consumenten, leveringszekerheid, en de voortgang van de energietransitie. De ACM signaleert toenemende netcongestie als belangrijk knelpunt voor de energietransitie en beveelt versnelde netverzwaring en flexibeler gebruik van het bestaande net aan.",
    decision_type: "market_monitoring",
    date_decided: "2024-06-01",
    parties: "Alle marktpartijen",
    url: "https://acm.nl/nl/publicaties/marktmonitor-2023",
  },
];

const insertDecision = db.prepare(`
  INSERT INTO decisions (reference, title, text, decision_type, date_decided, parties, url)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertDecAll = db.transaction(() => {
  for (const d of decisions) {
    insertDecision.run(d.reference, d.title, d.text, d.decision_type, d.date_decided, d.parties, d.url);
  }
});
insertDecAll();
console.log(`Inserted ${decisions.length} decisions`);

// -- Metadata --

const insertMeta = db.prepare("INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)");
insertMeta.run("schema_version", "1.0");
insertMeta.run("tier", "free");
insertMeta.run("domain", "dutch-energy-regulation");
insertMeta.run("build_date", new Date().toISOString().split("T")[0]);

// -- Summary --

const stats = {
  regulators: (db.prepare("SELECT count(*) as cnt FROM regulators").get() as { cnt: number }).cnt,
  regulations: (db.prepare("SELECT count(*) as cnt FROM regulations").get() as { cnt: number }).cnt,
  grid_codes: (db.prepare("SELECT count(*) as cnt FROM grid_codes").get() as { cnt: number }).cnt,
  decisions: (db.prepare("SELECT count(*) as cnt FROM decisions").get() as { cnt: number }).cnt,
  regulations_fts: (db.prepare("SELECT count(*) as cnt FROM regulations_fts").get() as { cnt: number }).cnt,
  grid_codes_fts: (db.prepare("SELECT count(*) as cnt FROM grid_codes_fts").get() as { cnt: number }).cnt,
  decisions_fts: (db.prepare("SELECT count(*) as cnt FROM decisions_fts").get() as { cnt: number }).cnt,
};

console.log(`\nDatabase summary:`);
console.log(`  Regulators:       ${stats.regulators}`);
console.log(`  Regulations:      ${stats.regulations} (FTS: ${stats.regulations_fts})`);
console.log(`  Grid codes:       ${stats.grid_codes} (FTS: ${stats.grid_codes_fts})`);
console.log(`  Decisions:        ${stats.decisions} (FTS: ${stats.decisions_fts})`);
console.log(`\nDone. Database ready at ${DB_PATH}`);

db.close();
