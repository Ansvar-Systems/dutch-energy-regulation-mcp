/**
 * Combined ingestion for Dutch energy regulators — real data corpus.
 *
 * Sources:
 *   - ACM (acm.nl) — method decisions, tariff decisions, code decisions,
 *     enforcement, market monitoring
 *   - TenneT (tennet.eu) — grid codes, connection requirements,
 *     congestion management, balancing rules, capacity allocation
 *   - RVO (rvo.nl) — SDE++ subsidy scheme, energy labels, BENG, renewables
 *   - SodM (sodm.nl) — Groningen gas, geothermal safety, offshore wind,
 *     CO2 storage, mining safety
 *   - wetten.overheid.nl — primary energy legislation and related besluiten
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
  { id: "acm", name: "ACM", full_name: "Autoriteit Consument & Markt (ACM)", url: "https://acm.nl", description: "Authority for Consumers and Markets — energy market regulation, tariff methodology, method decisions, code decisions, enforcement, consumer protection, competition oversight" },
  { id: "tennet", name: "TenneT", full_name: "TenneT TSO B.V.", url: "https://tennet.eu", description: "Dutch-German TSO — high-voltage grid management, grid codes, congestion management, balancing, grid connection standards, capacity allocation" },
  { id: "rvo", name: "RVO", full_name: "Rijksdienst voor Ondernemend Nederland (RVO)", url: "https://rvo.nl", description: "Netherlands Enterprise Agency — SDE++ subsidy scheme, energy labels, BENG requirements, renewable energy support, energy efficiency programs" },
  { id: "sodm", name: "SodM", full_name: "Staatstoezicht op de Mijnen (SodM)", url: "https://sodm.nl", description: "State Supervision of Mines — gas extraction safety (Groningen), geothermal energy safety, offshore wind safety, CO2 storage supervision, salt/mineral mining" },
];

const insertReg = db.prepare("INSERT OR IGNORE INTO regulators (id, name, full_name, url, description) VALUES (?, ?, ?, ?, ?)");
for (const r of regulators) insertReg.run(r.id, r.name, r.full_name, r.url, r.description);
console.log(`Inserted ${regulators.length} regulators`);

// ===================================================================
// REGULATIONS — Primary energy legislation (wetten.overheid.nl)
// ===================================================================

db.prepare("DELETE FROM regulations").run();

const insertRegulation = db.prepare(`
  INSERT INTO regulations (regulator_id, reference, title, text, type, status, effective_date, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Helper to build regulation tuples
type RegTuple = [string, string, string, string, string, string, string, string];

const allRegs: RegTuple[] = [];

// -------------------------------------------------------------------
// 1. Primary energy legislation (wetten.overheid.nl)
// -------------------------------------------------------------------

// -- Energiewet (replaced E-wet + Gaswet on 1 Jan 2026)
allRegs.push(["acm", "BWBR0050714", "Energiewet", "Wet van 11 december 2024, houdende regels over energiemarkten en energiesystemen (Energiewet). Vervangt de Elektriciteitswet 1998 en de Gaswet per 1 januari 2026. Implementeert EU-Richtlijnen 2019/944 en 2012/27/EU en Verordeningen 2019/943 en 2019/942. Bevat 7 hoofdstukken: algemene bepalingen, energiemarkten (art. 2.1-2.68), beheer van elektriciteits- en gassystemen (art. 3.1-3.130), beheren en uitwisselen van gegevens (art. 4.1-4.25), uitvoering toezicht en handhaving (art. 5.1-5.27), overige bepalingen (art. 6.1-6.14), overgangs- en slotbepalingen (art. 7.1-7.57).", "wet", "in_force", "2026-01-01", "https://wetten.overheid.nl/BWBR0050714/"]);

// -- Elektriciteitswet 1998 (repealed 1 Jan 2026)
allRegs.push(["acm", "BWBR0009755", "Elektriciteitswet 1998", "Wet van 2 juli 1998, houdende regels met betrekking tot de productie, het transport en de levering van elektriciteit (Elektriciteitswet 1998). Stb. 1998, 427. Implementatie van EU-Richtlijn 96/92/EG betreffende gemeenschappelijke regels voor de interne markt voor elektriciteit. Bevat hoofdstukken over algemene bepalingen, uitvoering en toezicht, transport van elektriciteit, voorwaarden wijze van gegevensverwerking, duurzame elektriciteitsvoorziening, overige bepalingen, wijziging andere wetten, overgangs- en slotbepalingen. Ingetrokken per 1 januari 2026 bij inwerkingtreding Energiewet.", "wet", "repealed", "1998-08-01", "https://wetten.overheid.nl/BWBR0009755/"]);

// -- Gaswet (repealed 1 Jan 2026)
allRegs.push(["acm", "BWBR0011440", "Gaswet", "Wet van 22 juni 2000, houdende regels omtrent het transport en de levering van gas (Gaswet). Stb. 2000, 305. Implementatie van EU-Richtlijn 98/30/EG betreffende gemeenschappelijke regels voor de interne markt voor aardgas. Regelt het transport en de levering van gas in Nederland, met toezicht door de ACM. Bevat bepalingen over vergunningen, netbeheer, tarieven en leveringszekerheid. Ingetrokken per 1 januari 2026 bij inwerkingtreding Energiewet.", "wet", "repealed", "2000-08-10", "https://wetten.overheid.nl/BWBR0011440/"]);

// -- Warmtewet
allRegs.push(["acm", "BWBR0033729", "Warmtewet", "Wet van 17 juni 2013, houdende regels omtrent de levering van warmte aan verbruikers (Warmtewet). Stb. 2013, 325. Regelt de levering van warmte aan verbruikers, inclusief bescherming van gebonden afnemers, maximum tarieven, leveringszekerheid en toezicht door de ACM. 10 hoofdstukken: algemene bepalingen, warmtelevering (vergunning, noodvoorziening), informatieverstrekking, handhaving, bijdragen, onderhandelingen producenttoegang, beroep, garanties van oorsprong, wijziging andere wetten, overgangs- en slotbepalingen.", "wet", "in_force", "2014-01-01", "https://wetten.overheid.nl/BWBR0033729/"]);

// -- Wet collectieve warmte (new, supplements Warmtewet)
allRegs.push(["acm", "BWBR0052212", "Wet collectieve warmte", "Wet collectieve warmte. Regelt de publieke regie op collectieve warmtenetten. Stelt kaders voor gemeentelijk warmteplanning, aanwijzing warmtebedrijven, en de transitie naar duurzame warmtebronnen. Gepubliceerd op 14 februari 2026. Aanvulling op de bestaande Warmtewet (BWBR0033729).", "wet", "in_force", "2026-02-14", "https://wetten.overheid.nl/BWBR0052212/"]);

// -- Mijnbouwwet
allRegs.push(["sodm", "BWBR0014168", "Mijnbouwwet", "Wet van 31 oktober 2002, houdende regels met betrekking tot het onderzoek naar en het winnen van delfstoffen en met betrekking tot met de mijnbouw verwante activiteiten (Mijnbouwwet). Stb. 2002, 542. 17 hoofdstukken: definities, vergunningen opsporing/winning delfstoffen, toewijzing zoekgebied en vergunningen aardwarmte (Hst. 2a), vergunningen opslag stoffen en opsporing CO2-opslagcomplexen (Hst. 3), gebiedsverkleining (Hst. 3a), goede uitvoering activiteiten (Hst. 4), bijzondere regels Groningenveld (Hst. 4a), financiele bepalingen, Mijnraad, rapportage, toezicht/handhaving, waarborgfonds mijnbouwschade, projectbesluit mijnbouwwerken, rechtsbescherming, overgangs- en slotbepalingen.", "wet", "in_force", "2003-01-01", "https://wetten.overheid.nl/BWBR0014168/"]);

// -- Wet windenergie op zee
allRegs.push(["acm", "BWBR0036752", "Wet windenergie op zee", "Wet windenergie op zee. Stb. 2015, 261. Regelt de vergunningverlening voor de bouw en exploitatie van windparken op zee in de Nederlandse exclusieve economische zone (EEZ) en de territoriale zee. Bevat bepalingen over kavelbesluiten, windgebieden, vergunningprocedures, veiligheid en milieubescherming. Toezicht door SodM en Rijkswaterstaat.", "wet", "in_force", "2015-07-01", "https://wetten.overheid.nl/BWBR0036752/"]);

// -- Wet bewijsvermoeden gaswinning Groningen
allRegs.push(["sodm", "BWBR0038963", "Wet bewijsvermoeden gaswinning Groningen", "Wet van 21 december 2016, houdende wijziging van het Burgerlijk Wetboek in verband met de aanpassing van de wettelijke bewijsregels ter zake van schade veroorzaakt door bodembeweging als gevolg van gaswinning uit het Groningenveld. Stb. 2016, 552. Invoering wettelijk bewijsvermoeden: fysieke schade aan gebouwen en werken in het effectgebied wordt vermoed het gevolg te zijn van bodembeweging door Groningen-gaswinning.", "wet", "in_force", "2017-01-01", "https://wetten.overheid.nl/BWBR0038963/"]);

// -- Tijdelijke wet Groningen
allRegs.push(["sodm", "BWBR0043252", "Tijdelijke wet Groningen", "Tijdelijke wet Groningen. Stb. 2020, 200. Regelt de publiekrechtelijke afhandeling van schade door bodembeweging als gevolg van gaswinning uit het Groningenveld. Instelling Instituut Mijnbouwschade Groningen (IMG). Bevat bepalingen over schadeafhandeling, versterking van gebouwen, subsidies voor waardedaling, en bestuurlijke organisatie. Gewijzigd bij Stb. 2022, 300 (versterkingsoperatie).", "wet", "in_force", "2020-07-01", "https://wetten.overheid.nl/BWBR0043252/"]);

// -- Wet milieubeheer (energiehoofdstukken)
allRegs.push(["rvo", "BWBR0003245", "Wet milieubeheer — Titel 15.13 SDE++", "Wet milieubeheer (BWBR0003245). Titel 15.13 vormt de wettelijke grondslag voor de subsidieregeling Stimulering Duurzame Energieproductie en Klimaattransitie (SDE++). Op grond van deze titel kan de Minister van Economische Zaken subsidie verstrekken voor de productie van hernieuwbare elektriciteit, hernieuwbaar gas, hernieuwbare warmte en klimaattransitietechnieken.", "wet", "in_force", "1993-03-01", "https://wetten.overheid.nl/BWBR0003245/"]);

// -------------------------------------------------------------------
// 2. AMvB's and Besluiten under primary legislation
// -------------------------------------------------------------------

// Energiebesluit
allRegs.push(["acm", "BWBR0051745", "Energiebesluit", "Energiebesluit — Algemene Maatregel van Bestuur onder de Energiewet. Bevat nadere regels over energiemarkten, systeembeheer, tarieven, meetinrichtingen en gegevensuitwisseling. In werking getreden 1 januari 2026 gelijktijdig met de Energiewet.", "besluit", "in_force", "2026-01-01", "https://wetten.overheid.nl/BWBR0051745/"]);

// Warmtebesluit
allRegs.push(["acm", "BWBR0033940", "Warmtebesluit", "Warmtebesluit — Besluit van 4 november 2013, houdende regels ter uitvoering van de Warmtewet. Stb. 2013, 448. Bevat nadere regels over maximumtarieven warmtelevering, redelijke prijs, compensatie bij storing, en meetinrichtingen.", "besluit", "in_force", "2014-01-01", "https://wetten.overheid.nl/BWBR0033940/"]);

// Mijnbouwbesluit
allRegs.push(["sodm", "BWBR0014394", "Mijnbouwbesluit", "Mijnbouwbesluit — Besluit van 6 december 2002, houdende regels ter uitvoering van de Mijnbouwwet. Stb. 2002, 604. Bevat technische en veiligheidsvoorschriften voor mijnbouwactiviteiten: boorputintegriteit, seismische monitoring, rapportageverplichtingen, milieuvoorschriften en arbeidsveiligheid.", "besluit", "in_force", "2003-01-01", "https://wetten.overheid.nl/BWBR0014394/"]);

// Besluit mijnbouwschade Groningen
allRegs.push(["sodm", "BWBR0040584", "Besluit mijnbouwschade Groningen", "Besluit mijnbouwschade Groningen — Regelt de procedure voor afhandeling van mijnbouwschade in Groningen. Bevat het effectgebied (contourenkaart), bewijsvermoeden-toepassing, en procedureregels voor schadeclaims bij het Instituut Mijnbouwschade Groningen.", "besluit", "in_force", "2018-03-19", "https://wetten.overheid.nl/BWBR0040584/"]);

// Besluit op afstand uitleesbare meetinrichtingen (slimme meter)
allRegs.push(["acm", "BWBR0030605", "Besluit op afstand uitleesbare meetinrichtingen", "Besluit op afstand uitleesbare meetinrichtingen. Stb. 2011, 340. Regelt de technische eisen voor slimme meters (op afstand uitleesbare meetinrichtingen) voor elektriciteit en gas. Bevat bepalingen over meetnauwkeurigheid, communicatie-eisen, privacybescherming en uitroltermijnen.", "besluit", "in_force", "2012-01-01", "https://wetten.overheid.nl/BWBR0030605/"]);

// Besluit energieprestatie gebouwen
allRegs.push(["rvo", "BWBR0023734", "Besluit energieprestatie gebouwen", "Besluit energieprestatie gebouwen — Stb. 2008, 132. Bevat regels voor de energieprestatie van gebouwen: energielabelverplichting bij verkoop en verhuur, energieprestatie-eisen bij nieuwbouw (BENG per 1 januari 2021), keuringsverplichtingen voor verwarmings- en koelsystemen.", "besluit", "in_force", "2008-07-01", "https://wetten.overheid.nl/BWBR0023734/"]);

// Besluit stimulering duurzame energieproductie en klimaattransitie (SDE)
allRegs.push(["rvo", "BWBR0022735", "Besluit stimulering duurzame energieproductie en klimaattransitie", "Besluit van 16 oktober 2007, houdende regels inzake de verstrekking van subsidies ten behoeve van de productie van hernieuwbare elektriciteit, hernieuwbaar gas en elektriciteit opgewekt door middel van warmtekrachtkoppeling. Stb. 2007, 410. Wettelijke grondslag SDE++ subsidieregeling. Gewijzigd bij Stb. 2020, 340 (klimaattransitie), Stb. 2022, 120 (RED II), Stb. 2024, 163 (kosteneffectiviteit).", "besluit", "in_force", "2007-11-01", "https://wetten.overheid.nl/BWBR0022735/"]);

// Besluit risico's zware ongevallen 2015 (Brzo) — applies to mining/storage
allRegs.push(["sodm", "Stb. 2015, 272", "Besluit risico's zware ongevallen 2015 (Brzo 2015)", "Besluit risico's zware ongevallen 2015 (Brzo 2015). Stb. 2015, 272. Implementatie EU-Richtlijn 2012/18/EU (Seveso III). Ondergrondse opslagen van mijnondernemingen moeten voldoen aan het Brzo 2015. SodM houdt toezicht op naleving bij mijnbouwinstallaties en ondergrondse opslaglocaties.", "besluit", "in_force", "2015-07-08", "https://wetten.overheid.nl/BWBR0036783/"]);

// Besluit aanwijzing toezichthouders windenergie op zee
allRegs.push(["sodm", "BWBR0039419", "Besluit aanwijzing toezichthouders windenergie op zee", "Besluit aanwijzing toezichthouders windenergie op zee. Stcrt. 2017, 18543. Wijst ambtenaren van SodM en Rijkswaterstaat aan als toezichthouders op de naleving van de Wet windenergie op zee. SodM houdt toezicht op arbeidsomstandigheden, arbeidstijden en productveiligheid.", "besluit", "in_force", "2017-04-05", "https://wetten.overheid.nl/BWBR0039419/"]);

// Wijzigingswet Mijnbouwwet (veiligheid offshore olie- en gas)
allRegs.push(["sodm", "BWBR0038985", "Wijzigingswet Mijnbouwwet — veiligheid offshore olie- en gasactiviteiten", "Wet van 21 december 2016 tot wijziging van de Mijnbouwwet, de Wet milieubeheer en de Wet op de economische delicten in verband met implementatie van richtlijn 2013/30/EU betreffende de veiligheid van offshore olie- en gasactiviteiten. Stb. 2017, 8. Verscherpt veiligheidseisen voor offshore mijnbouwinstallaties op het Nederlandse continentale plat.", "wet", "in_force", "2019-01-01", "https://wetten.overheid.nl/BWBR0038985/"]);

// Wijzigingswet Mijnbouwwet — versterking veiligheidsbelang
allRegs.push(["sodm", "BWBR0039007", "Wijzigingswet Mijnbouwwet — versterking veiligheidsbelang mijnbouw", "Wijzigingswet Mijnbouwwet (versterking veiligheidsbelang mijnbouw en regie op opsporings-, winnings- en opslagvergunningen). Stb. 2017, 16. Geeft de minister meer instrumenten om in te grijpen bij mijnbouwactiviteiten die risico's opleveren, waaronder de mogelijkheid om gaswinning te beperken of te beëindigen.", "wet", "in_force", "2017-01-01", "https://wetten.overheid.nl/BWBR0039007/"]);

// Wijzigingswet Mijnbouwwet — aanpassing vergunningsstelsel aardwarmte
allRegs.push(["sodm", "BWBR0047438", "Wijzigingswet Mijnbouwwet — aanpassing vergunningsstelsel aardwarmte", "Wijzigingswet Mijnbouwwet (aanpassing vergunningsstelsel voor opsporen en winnen van aardwarmte). Stb. 2023, 224. Invoering startvergunning en vervolgvergunning voor aardwarmteprojecten. Vervangt het systeem van opsporings- en winningsvergunningen voor geothermie door een meer gefaseerd vergunningenstelsel.", "wet", "in_force", "2023-07-01", "https://wetten.overheid.nl/BWBR0047438/"]);

// Wet uitvoering EU-handelingen energie-efficiëntie
allRegs.push(["rvo", "BWBR0035596", "Wet uitvoering EU-handelingen energie-efficiëntie", "Wet implementatie EU-richtlijnen energie-efficiëntie (EED). Regelt verplichte energieaudits voor grote ondernemingen, informatieverstrekking over energieverbruik, en nationale doelstellingen voor energie-efficiëntie conform EU-Richtlijn 2012/27/EU (herzien door Richtlijn 2023/1791).", "wet", "in_force", "2014-07-01", "https://wetten.overheid.nl/BWBR0035596/"]);

// Regeling waardevermeerdering gebouwen gaswinning Groningenveld
allRegs.push(["sodm", "BWBR0046541", "Regeling waardevermeerdering gebouwen gaswinning Groningenveld", "Regeling waardevermeerdering gebouwen gaswinning Groningenveld. Subsidieregeling voor eigenaren van gebouwen in het aardbevingsgebied Groningen waar schade door bodembeweging als gevolg van gaswinning is vastgesteld. Subsidie tot EUR 10.000 voor duurzame en energiebesparende maatregelen.", "regeling", "in_force", "2024-07-01", "https://wetten.overheid.nl/BWBR0046541/"]);

// Regeling Tijdelijke wet Groningen
allRegs.push(["sodm", "BWBR0048350", "Regeling Tijdelijke wet Groningen", "Regeling Tijdelijke wet Groningen. Uitvoeringsregeling bij de Tijdelijke wet Groningen. Bevat nadere regels over schadeafhandeling door het Instituut Mijnbouwschade Groningen (IMG), de versterkingsoperatie, en procedures voor subsidieverstrekking bij waardedaling.", "regeling", "in_force", "2022-11-01", "https://wetten.overheid.nl/BWBR0048350/"]);

// Beleidsregel schadeafhandeling Tijdelijke wet Groningen
allRegs.push(["sodm", "BWBR0049519", "Beleidsregel schadeafhandeling Tijdelijke wet Groningen", "Beleidsregel schadeafhandeling Tijdelijke wet Groningen. Beleidsregel van het Instituut Mijnbouwschade Groningen over de beoordeling en afhandeling van schademeldingen op grond van de Tijdelijke wet Groningen.", "beleidsregel", "in_force", "2024-01-01", "https://wetten.overheid.nl/BWBR0049519/"]);

// Procedure en werkwijze IMG 2022
allRegs.push(["sodm", "BWBR0046981", "Procedure en werkwijze Instituut Mijnbouwschade Groningen 2022", "Procedure en werkwijze van het Instituut Mijnbouwschade Groningen 2022. Regelt de werkwijze van het IMG bij de behandeling van schadeclaims op grond van de Tijdelijke wet Groningen: aanmeldprocedure, beoordelingskader, deskundigenonderzoek, besluitvorming en bezwaar.", "regeling", "in_force", "2022-09-01", "https://wetten.overheid.nl/BWBR0046981/"]);

// Wet aardgasprijzen
allRegs.push(["acm", "BWBR0002948", "Wet aardgasprijzen", "Wet aardgasprijzen. Stb. 1965, 345. Regelt de prijsvorming van aardgas. Bepaalt dat het aardgasbatenbeleid erop gericht is dat de verkoopprijs van aardgas uit het Groningenveld is gekoppeld aan de prijs van concurrerende brandstoffen (marktwaarde-beginsel). Grotendeels achterhaald door liberalisering gasmarkt.", "wet", "in_force", "1965-07-01", "https://wetten.overheid.nl/BWBR0002948/"]);

// Regeling afnemers en monitoring Elektriciteitswet 1998 en Gaswet
allRegs.push(["acm", "BWBR0016979", "Regeling afnemers en monitoring Elektriciteitswet 1998 en Gaswet", "Regeling afnemers en monitoring Elektriciteitswet 1998 en Gaswet. Bevat regels over de bescherming van consumenten op de energie­markt, overstapregeling leverancier, contractvoorwaarden en monitoring door de ACM.", "regeling", "in_force", "2004-07-01", "https://wetten.overheid.nl/BWBR0016979/"]);

// Energieregeling
allRegs.push(["acm", "BWBR0051760", "Energieregeling", "Energieregeling — Ministeriële regeling onder de Energiewet. Bevat nadere uitvoeringsregels over leveringsvergunningen, meetinrichtingen, gegevensuitwisseling, tariefstructuren en consumentenbescherming. In werking getreden 1 januari 2026.", "regeling", "in_force", "2026-01-01", "https://wetten.overheid.nl/BWBR0051760/"]);

// Warmteregeling
allRegs.push(["acm", "BWBR0033862", "Warmteregeling", "Warmteregeling — Ministeriële regeling ter uitvoering van de Warmtewet en het Warmtebesluit. Bevat nadere regels over maximumtarieven warmtelevering, rendementsnormen, informatieverstrekking en meetvoorschriften.", "regeling", "in_force", "2014-01-01", "https://wetten.overheid.nl/BWBR0033862/"]);

// Uitvoeringsregeling Gaswet
allRegs.push(["acm", "BWBR0015468", "Uitvoeringsregeling Gaswet", "Uitvoeringsregeling Gaswet. Ministeriële regeling ter uitvoering van de Gaswet. Bevat nadere regels over leveringsvergunningen gas, gasopslagverplichtingen, kwaliteitseisen, en meldingsverplichtingen.", "regeling", "repealed", "2003-07-01", "https://wetten.overheid.nl/BWBR0015468/"]);

// -------------------------------------------------------------------
// 3. ACM — Methodebesluiten (method decisions for regulatory periods)
// -------------------------------------------------------------------

// RP 2022-2026 methodebesluiten
allRegs.push(["acm", "ACM/UIT/556547", "Methodebesluit regionaal netbeheer elektriciteit 2022-2026", "Methodebesluit van de ACM voor de regionale netbeheerders elektriciteit voor de reguleringsperiode 2022-2026 (Coteq, Enexis, Liander, RENDO, Stedin, Westland). Bepaalt de methode voor vaststelling van de toegestane inkomsten (x-factor, efficiëntie-benchmark, WACC, kwaliteitsfactor). Zaaknr. ACM/19/035349.", "besluit", "in_force", "2021-09-30", "https://www.acm.nl/sites/default/files/documents/methodebesluit-regionaal-netbehher-elektriciteit-2022-2026-v2.pdf"]);

allRegs.push(["acm", "ACM/UIT/552048", "Ontwerpmethodebesluit systeemtaken TenneT 2022-2026", "Ontwerpmethodebesluit van de ACM voor de systeemtaken van TenneT voor de reguleringsperiode 2022-2026. Zaaknr. ACM/21/051147. Bepaalt de methode voor regulering van kosten voor systeembalancering, zwarte start, noodvermogen en frequentieregeling.", "besluit", "in_force", "2021-07-01", "https://www.acm.nl/sites/default/files/documents/ontwerpmethodebesluit-tennet-systeem-2022-2026.pdf"]);

allRegs.push(["acm", "ACM/UIT/556088", "Methodebesluit systeemtaken TenneT 2022-2026", "Methodebesluit van de ACM voor de systeemtaken van TenneT voor de reguleringsperiode 2022-2026. Definitief besluit na consultatie. Bevat de vastgestelde methode voor regulering van TenneT's systeemkosten.", "besluit", "in_force", "2021-09-30", "https://www.acm.nl/sites/default/files/documents/methodebesluit-tennet-systeem-2022-2026.pdf"]);

allRegs.push(["acm", "ACM/UIT/552087", "Ontwerpmethodebesluit regionaal netbeheer gas 2022-2026", "Ontwerpmethodebesluit van de ACM voor de regionale netbeheerders gas voor de reguleringsperiode 2022-2026 (Coteq, Enexis, Liander, RENDO, Stedin, Westland). Bevat de voorgestelde methode voor vaststelling van nettarieven gas.", "besluit", "in_force", "2021-07-01", "https://www.acm.nl/sites/default/files/documents/ontwerpmethodebesluit-regionaal-netbeheer-gas-2022-2026-nieuw.pdf"]);

allRegs.push(["acm", "ACM/UIT/556549", "Methodebesluit regionaal netbeheer gas 2022-2026", "Methodebesluit van de ACM voor de regionale netbeheerders gas voor de reguleringsperiode 2022-2026. Definitief besluit. Bepaalt de toegestane inkomsten en tariefmethode voor regionale gasnetbeheerders.", "besluit", "in_force", "2021-09-30", "https://www.acm.nl/nl/publicaties/tariefregulering-besluitenoverzicht"]);

allRegs.push(["acm", "ACM/UIT/556090", "Methodebesluit GTS 2022-2026", "Methodebesluit van de ACM voor Gasunie Transport Services (GTS) voor de reguleringsperiode 2022-2026. Bevat de methode voor vaststelling van transporttarieven op het landelijke gastransportnet.", "besluit", "in_force", "2021-09-30", "https://www.acm.nl/sites/default/files/documents/2020-08/ontwerpmethodebesluit-gts-2022-2026.pdf"]);

allRegs.push(["acm", "ACM/UIT/556045", "Methodebesluit TenneT transport 2022-2026", "Methodebesluit van de ACM voor TenneT transport (op land) voor de reguleringsperiode 2022-2026. Bepaalt de methode voor regulering van TenneT's transportkosten op het hoogspanningsnet.", "besluit", "in_force", "2021-09-30", "https://www.acm.nl/nl/publicaties/tariefregulering-besluitenoverzicht"]);

// Gewijzigd methodebesluit 2022-2026
allRegs.push(["acm", "ACM/UIT/605244", "Gewijzigd methodebesluit regionaal netbeheer elektriciteit 2022-2026", "Gewijzigd methodebesluit van de ACM voor de regionale netbeheerders elektriciteit 2022-2026. Aanpassing van het eerdere methodebesluit naar aanleiding van bezwaren en gewijzigde omstandigheden (investeringsopgave netcongestie).", "besluit", "in_force", "2023-12-01", "https://www.acm.nl/system/files/documents/gewijzigd-methodebesluit-rnb-elektriciteit-2022-2026.pdf"]);

// RP 2027-2031 methodebesluiten
allRegs.push(["acm", "ACM/UIT/656372", "Ontwerpmethodebesluit distributiesysteembeheerders elektriciteit 2027-2031", "Ontwerpmethodebesluit van de ACM voor distributiesysteembeheerders (DSB) elektriciteit voor de reguleringsperiode 2027-2031. Eerste methodebesluit onder de nieuwe Energiewet. Bevat gewijzigde methodiek voor vaststelling toegestane inkomsten met meer ruimte voor investeringen in netverzwaring.", "besluit", "in_force", "2025-09-01", "https://www.acm.nl/system/files/documents/ontwerpmethodebesluit-dsb-e.pdf"]);

allRegs.push(["acm", "ACM/UIT/656400", "Methodebesluit distributiesysteembeheerders elektriciteit 2027-2031", "Methodebesluit van de ACM voor distributiesysteembeheerders elektriciteit voor de reguleringsperiode 2027-2031. Definitief besluit. Bepaalt de tariefmethode voor regionale elektriciteitsnetbeheerders voor 2027-2031.", "besluit", "in_force", "2026-01-15", "https://www.acm.nl/nl/publicaties/methodebesluit-distributiesysteembeheerders-elektriciteit-2027-2031"]);

allRegs.push(["acm", "ACM/UIT/656380", "Ontwerpmethodebesluit TenneT op land 2027-2031", "Ontwerpmethodebesluit van de ACM voor TenneT op land voor de reguleringsperiode 2027-2031. Bevat de voorgestelde methode voor regulering van TenneT's transport- en systeemkosten op land.", "besluit", "in_force", "2025-09-01", "https://www.acm.nl/system/files/documents/ontwerpmethodebesluit-tennet-op-land.pdf"]);

allRegs.push(["acm", "ACM/UIT/656401", "Methodebesluit TenneT op land 2027-2031", "Methodebesluit van de ACM voor TenneT op land voor de reguleringsperiode 2027-2031. Definitief besluit na consultatie. Bepaalt de tariefmethode voor TenneT transport- en systeemtaken voor 2027-2031.", "besluit", "in_force", "2026-01-15", "https://www.acm.nl/nl/publicaties/methodebesluit-tennet-op-land-2027-2031"]);

allRegs.push(["acm", "ACM/UIT/656390", "Ontwerpmethodebesluit GTS 2027-2031", "Ontwerpmethodebesluit van de ACM voor Gasunie Transport Services (GTS) voor de reguleringsperiode 2027-2031. Bevat de voorgestelde methode voor regulering van GTS' transporttarieven.", "besluit", "in_force", "2025-09-01", "https://www.acm.nl/system/files/documents/ontwerpmethodebesluit-gts-2027-2031.pdf"]);

allRegs.push(["acm", "ACM/UIT/656402", "Methodebesluit GTS 2027-2031", "Methodebesluit van de ACM voor GTS voor de reguleringsperiode 2027-2031. Definitief besluit. Bepaalt de tariefmethode voor het landelijke gastransportnet voor 2027-2031.", "besluit", "in_force", "2026-01-15", "https://www.acm.nl/nl/publicaties/overzichtspagina-publicaties-methodebesluiten-reg2027"]);

// -------------------------------------------------------------------
// 4. ACM — Tarievenbesluiten (tariff decisions)
// -------------------------------------------------------------------

// Regional network operators — elektriciteit 2026
const rnbE = ["Coteq", "Enexis", "Liander", "RENDO", "Stedin", "Westland"];
for (const nb of rnbE) {
  allRegs.push(["acm", `TB-${nb}-E-2026`, `Tarievenbesluit ${nb} elektriciteit 2026`, `Tarievenbesluit van de ACM voor ${nb} Netbeheer B.V. elektriciteit 2026. Jaarlijks besluit van de ACM dat de nettarieven vaststelt die ${nb} in rekening mag brengen aan aangeslotenen op het elektriciteitsnet. Gebaseerd op het methodebesluit voor de reguleringsperiode 2022-2026 (gewijzigd) en de individuele kostendrijvers van ${nb}.`, "besluit", "in_force", "2025-12-01", `https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht`]);
}

// Regional network operators — elektriciteit 2025
for (const nb of rnbE) {
  allRegs.push(["acm", `TB-${nb}-E-2025`, `Tarievenbesluit ${nb} elektriciteit 2025`, `Tarievenbesluit van de ACM voor ${nb} Netbeheer B.V. elektriciteit 2025. Jaarlijks tarievenbesluit op basis van het methodebesluit regionaal netbeheer elektriciteit 2022-2026.`, "besluit", "in_force", "2024-12-01", `https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht`]);
}

// Regional network operators — gas 2026
for (const nb of rnbE) {
  allRegs.push(["acm", `TB-${nb}-G-2026`, `Tarievenbesluit ${nb} gas 2026`, `Tarievenbesluit van de ACM voor ${nb} Netbeheer B.V. gas 2026. Jaarlijks besluit van de ACM dat de nettarieven vaststelt die ${nb} in rekening mag brengen aan aangeslotenen op het gasnet. Gebaseerd op het methodebesluit regionaal netbeheer gas 2022-2026.`, "besluit", "in_force", "2025-12-01", `https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht`]);
}

// Regional network operators — gas 2025
for (const nb of rnbE) {
  allRegs.push(["acm", `TB-${nb}-G-2025`, `Tarievenbesluit ${nb} gas 2025`, `Tarievenbesluit van de ACM voor ${nb} Netbeheer B.V. gas 2025. Jaarlijks tarievenbesluit op basis van het methodebesluit regionaal netbeheer gas 2022-2026.`, "besluit", "in_force", "2024-12-01", `https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht`]);
}

// TenneT tariff decisions
allRegs.push(["acm", "TB-TenneT-2026", "Tarievenbesluit TenneT 2026", "Tarievenbesluit van de ACM voor TenneT TSO B.V. 2026. Jaarlijks besluit dat de transporttarieven vaststelt voor het landelijke hoogspanningsnet. Gebaseerd op het methodebesluit TenneT transport en systeemtaken 2022-2026.", "besluit", "in_force", "2025-12-01", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);
allRegs.push(["acm", "TB-TenneT-2025", "Tarievenbesluit TenneT 2025", "Tarievenbesluit van de ACM voor TenneT TSO B.V. 2025. Jaarlijks tarievenbesluit voor het landelijke hoogspanningsnet.", "besluit", "in_force", "2024-12-01", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

// GTS tariff decisions
allRegs.push(["acm", "TB-GTS-2026", "Tarievenbesluit GTS 2026", "Tarievenbesluit van de ACM voor Gasunie Transport Services B.V. (GTS) 2026. Jaarlijks besluit dat de transporttarieven vaststelt voor het landelijke gastransportnet.", "besluit", "in_force", "2025-12-01", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);
allRegs.push(["acm", "TB-GTS-2025", "Tarievenbesluit GTS 2025", "Tarievenbesluit van de ACM voor Gasunie Transport Services B.V. (GTS) 2025. Jaarlijks tarievenbesluit voor het landelijke gastransportnet.", "besluit", "in_force", "2024-12-01", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

// -------------------------------------------------------------------
// 5. ACM — Code decisions (codes elektriciteit en gas)
// -------------------------------------------------------------------

// Electricity codes under Energiewet (2026)
allRegs.push(["acm", "Code-BegE-2026", "Begrippencode elektriciteit 2026", "Begrippencode elektriciteit 2026 — Code vastgesteld door de ACM onder de Energiewet. Bevat de definities en begrippenlijst die van toepassing is op alle codes elektriciteit.", "besluit", "in_force", "2026-01-01", "https://www.acm.nl/nl/publicaties/acm-stelt-nieuwe-codes-elektriciteit-en-gas-vast-onder-de-energiewet"]);

allRegs.push(["acm", "Code-SysE-2026", "Systeemcode elektriciteit 2026", "Systeemcode elektriciteit 2026 — Voorheen: Netcode elektriciteit + Systeemcode elektriciteit samengevoegd onder de Energiewet. Bevat technische voorschriften voor aansluiting op en gebruik van het elektriciteitsnet: spanningskwaliteit, frequentieregeling, bescherming, planning en bedrijfsvoering.", "besluit", "in_force", "2026-01-01", "https://www.acm.nl/nl/publicaties/acm-stelt-nieuwe-codes-elektriciteit-en-gas-vast-onder-de-energiewet"]);

allRegs.push(["acm", "Code-TarE-2026", "Tarievencode elektriciteit 2026", "Tarievencode elektriciteit 2026 — Code vastgesteld door de ACM onder de Energiewet. Bevat de regels voor de berekening en structuur van nettarieven elektriciteit door netbeheerders. Basis voor de jaarlijkse tarievenbesluiten.", "besluit", "in_force", "2026-01-01", "https://www.acm.nl/nl/publicaties/acm-stelt-nieuwe-codes-elektriciteit-en-gas-vast-onder-de-energiewet"]);

allRegs.push(["acm", "Code-MeetE", "Meetcode elektriciteit", "Meetcode elektriciteit — ACM-codebesluit. Bevat de regels voor het meten van elektriciteitsverbruik en -invoeding: eisen aan meetinrichtingen, meetverantwoordelijkheden, validatie, substitutie en correctie van meetgegevens. BWBR0037946.", "besluit", "in_force", "2016-05-11", "https://www.acm.nl/nl/publicaties/publicatie/15743/Codebesluit-Meetcode-elektriciteit"]);

allRegs.push(["acm", "Code-GebE", "Gebiedsindelingscode elektriciteit", "Gebiedsindelingscode elektriciteit — ACM-codebesluit. Bepaalt de gebiedsindeling van het elektriciteitsnet: welke netbeheerder verantwoordelijk is voor welk geografisch gebied.", "besluit", "in_force", "2016-05-11", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

// Gas codes
allRegs.push(["acm", "Code-BegG", "Begrippencode gas TSB en DSB", "Begrippencode gas voor het transmissiesysteembeheerder (TSB = GTS) en distributiesysteembeheerders (DSB). Bevat de definities voor alle gascodes.", "besluit", "in_force", "2026-01-01", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "Code-TarG", "Tarievencode gas TSB en DSB", "Tarievencode gas voor transmissiesysteembeheerder en distributiesysteembeheerders. Bevat de regels voor berekening en structuur van nettarieven gas.", "besluit", "in_force", "2026-01-01", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "Code-GebG", "Gebiedsindelingscode gas", "Gebiedsindelingscode gas — ACM-codebesluit. Bepaalt de gebiedsindeling van het gasnet.", "besluit", "in_force", "2016-05-11", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "Code-AllocG", "Allocatiecode systeembeheerders gas", "Allocatiecode systeembeheerders gas. Bevat regels voor de toewijzing (allocatie) van gasvolumes aan shippers op het gastransportnet.", "besluit", "in_force", "2016-05-11", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "Code-ATDSB", "Aansluit- en transportcode gas DSB", "Aansluit- en transportcode gas voor distributiesysteembeheerders. Bevat technische en procedurele regels voor aansluiting op en transport via het regionale gasnet.", "besluit", "in_force", "2016-05-11", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "Code-MeetGRNB", "Meetcode gas RNB", "Meetcode gas voor regionale netbeheerders (RNB / DSB). Bevat regels voor het meten van gasverbruik bij aangeslotenen op het regionale gasnet.", "besluit", "in_force", "2016-05-11", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "Code-AanslTSB", "Aansluitcode gas TSB", "Aansluitcode gas voor transmissiesysteembeheerder (GTS). Bevat technische eisen voor aansluiting op het landelijke gastransportnet.", "besluit", "in_force", "2016-05-11", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "Code-MeetGLNB", "Meetcode gas LNB", "Meetcode gas voor landelijke netbeheerder (LNB = GTS). Bevat regels voor het meten van gasvolumes op het landelijke gastransportnet.", "besluit", "in_force", "2016-05-11", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "Code-TransTSB", "Transportcode gas TSB", "Transportcode gas voor transmissiesysteembeheerder (GTS). Bevat regels voor het gastransport op het landelijke net: boekingsprocedures, nominatie, allocatie, en congestiemanagement.", "besluit", "in_force", "2016-05-11", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "Code-InvoedTSB", "Invoedcode gas TSB", "Invoedcode gas voor transmissiesysteembeheerder (GTS). Bevat regels voor invoeding van gas op het landelijke gastransportnet.", "besluit", "in_force", "2016-05-11", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "Code-SysKoppel", "Systeemkoppelingscode TSB en DSB", "Systeemkoppelingscode voor transmissiesysteembeheerder en distributiesysteembeheerders. Regelt de technische koppeling en overdracht van gas tussen het landelijke en regionale gasnet.", "besluit", "in_force", "2016-05-11", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "Code-TakenTSB", "Takencode gas TSB", "Takencode gas voor transmissiesysteembeheerder (GTS). Bevat regels over de wettelijke taken van de landelijke gasnetbeheerder.", "besluit", "in_force", "2016-05-11", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

// Information code (both E and G)
allRegs.push(["acm", "Code-InfoEG", "Informatiecode elektriciteit en gas", "Informatiecode elektriciteit en gas — ACM-codebesluit. Bevat regels over gegevensuitwisseling tussen marktpartijen: leverancierswisselproces, meetgegevensuitwisseling, verhuisproces, EDSN-taken, EAN-codetoekenning. BWBR0037935.", "besluit", "in_force", "2016-05-11", "https://www.acm.nl/nl/publicaties/publicatie/15740/Codebesluit-Informatiecode-elektriciteit-en-gas"]);

// Codebesluit verzamelcode 2021
allRegs.push(["acm", "Code-Verz-2021", "Codebesluit verzamelcode 2021", "Codebesluit verzamelcode 2021 — Verzamelwijziging van diverse codes elektriciteit en gas. Bevat technische aanpassingen en verduidelijkingen op basis van praktijkervaringen.", "besluit", "in_force", "2021-07-01", "https://www.acm.nl/nl/publicaties/codebesluit-verzamelcode-2021"]);

// Codebesluit EAN-codes
allRegs.push(["acm", "Code-EAN", "Codebesluit toekenning EAN-codes elektriciteit", "Codebesluit toekenning EAN-codes elektriciteit. Regelt de procedure voor toewijzing van European Article Numbers (EAN) aan aansluitpunten op het elektriciteitsnet.", "besluit", "in_force", "2021-01-01", "https://www.acm.nl/nl/publicaties/codebesluit-toekenning-ean-codes-elektriciteit"]);

// Codewijzigingsvoorstel implementatie Energiewet
allRegs.push(["acm", "Code-EW-Impl", "Codewijzigingsvoorstel implementatie Energiewet", "Codewijzigingsvoorstel voor implementatie van de Energiewet in de bestaande codes elektriciteit en gas. Betreft de omzetting van verwijzingen naar de Elektriciteitswet 1998 en Gaswet naar de nieuwe Energiewet, en de naamswijziging van Netcode naar Systeemcode elektriciteit.", "besluit", "in_force", "2025-12-01", "https://www.acm.nl/system/files/documents/codewijzigingsvoorstel-implementatie%20van-de-energiewet.pdf"]);

// -------------------------------------------------------------------
// 6. ACM — Beleidsregels and richtsnoeren
// -------------------------------------------------------------------

allRegs.push(["acm", "BR-Doelmatig", "Beleidsregel ACM beoordeling doelmatige kosten", "Beleidsregel van de ACM over de beoordeling van doelmatige kosten van netbeheerders. Bepaalt hoe de ACM beoordeelt of investeringen en operationele kosten van netbeheerders efficiënt (doelmatig) zijn in het kader van tariefregulering.", "beleidsregel", "in_force", "2021-01-01", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "BR-Ontheffing", "Beleidsregel ontheffing van de codes energie", "Beleidsregel van de ACM over ontheffingen van de codes energie. Regelt onder welke voorwaarden marktpartijen ontheffing kunnen krijgen van verplichtingen in de codes elektriciteit en gas.", "beleidsregel", "in_force", "2021-01-01", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "BR-Geschil-2026", "Werkwijze geschilbeslechting energie 2026", "Werkwijze geschilbeslechting energie 2026 — ACM-beleidsregel over de behandeling van geschillen op de energiemarkt. Regelt de procedure voor beslechting van geschillen tussen netbeheerders, leveranciers en andere marktpartijen.", "beleidsregel", "in_force", "2026-01-01", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "BR-Warmte", "Leidraad Warmtelevering ACM", "Leidraad Warmtelevering — ACM-richtsnoer over de toepassing van de Warmtewet. Bevat uitleg over maximumtarieven, compensatieregeling bij storingen, en verplichtingen van warmteleveranciers.", "beleidsregel", "in_force", "2022-01-01", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

// -------------------------------------------------------------------
// 7. ACM — Enforcement decisions
// -------------------------------------------------------------------

allRegs.push(["acm", "ACM-Boete-HEM-2024", "Boetebesluit HEM — agressieve telefonische energiewerving", "Boetebesluit van de ACM: EUR 1.100.000 boete opgelegd aan Allround Hollands Energie Maatschappij B.V. (HEM) wegens ernstige en agressieve misleidende telefonische werving van energiecontracten. HEM misleidde consumenten over het doel van het verkoopgesprek en de identiteit van HEM, en bood contracten aan met tarieven ver boven het prijsplafond. Vergunningen ingetrokken op 5 december 2024.", "besluit", "in_force", "2024-05-15", "https://www.acm.nl/nl/publicaties/besluit-boete-hem-voor-ernstige-en-agressieve-telefonische-werving"]);

allRegs.push(["acm", "ACM-Boete-GMB-2024", "Boetebesluit Global Marketing Bridge — misleidende energiewerving", "Boetebesluit van de ACM: EUR 400.000 boete opgelegd aan Global Marketing Bridge B.V., EUR 50.000 aan de directeur/enig aandeelhouder, en EUR 65.000 aan de bestuurder wegens misleidende telefonische werving van energiecontracten.", "besluit", "in_force", "2024-03-01", "https://www.acm.nl/system/files/documents/openbare-besluit-intermediairs.pdf"]);

allRegs.push(["acm", "ACM-Boete-DGB-2023", "Boetebesluit DGB Energie — misleidende werving", "Boetebesluit van de ACM: EUR 400.000 boete opgelegd aan DGB Energie wegens misleidende telefonische werving van energiecontracten. Bevestigd door de Rechtbank Rotterdam in augustus 2023.", "besluit", "in_force", "2023-03-01", "https://www.acm.nl/nl/publicaties/rechtbank-terechte-boete-voor-misleidende-werving-door-energieleverancier-dgb"]);

allRegs.push(["acm", "ACM-Vergunning-HEM-2024", "Intrekkingsbesluit vergunningen HEM", "Besluit van de ACM tot intrekking van de energieleveringsvergunningen van Allround Hollands Energie Maatschappij B.V. (HEM) per 5 december 2024. Reden: acute en ernstige financiële problemen waardoor compensatie van consumenten niet realistisch was.", "besluit", "in_force", "2024-12-05", "https://www.acm.nl/nl/publicaties/acm-trekt-vergunningen-energieleverancier-hem-direct"]);

allRegs.push(["acm", "ACM-Toezegging-HEM-2024", "Toezeggingsbesluit HEM — lagere tarieven", "Toezeggingsbesluit van de ACM: HEM committeert zich om klanten gratis te laten overstappen of lagere tarieven aan te bieden. Resultaat van ACM-onderzoek naar oneerlijke handelspraktijken.", "besluit", "in_force", "2024-09-01", "https://www.acm.nl/system/files/documents/hem-toezeggingsbesluit.pdf"]);

// -------------------------------------------------------------------
// 8. ACM — Market monitoring reports
// -------------------------------------------------------------------

allRegs.push(["acm", "ACM-EM-2026-Q1", "Energiemonitor ACM — Q1 2026", "Energiemonitor ACM Q1 2026: gemiddelde kosten voor gas en elektriciteit blijven gelijk. Netbeheerskosten stijgen gemiddeld 3,4% (ca. EUR 25 per jaar). Energiebelasting op gas stijgt, op elektriciteit daalt. Maandelijkse Monitor Consumentenmarkt Energie.", "besluit", "in_force", "2026-01-15", "https://www.acm.nl/nl/publicaties/energiemonitor-acm-gemiddelde-kosten-voor-gas-en-elektriciteit-blijven-gelijk"]);

allRegs.push(["acm", "ACM-EM-2025-Q4", "Energiemonitor ACM — Q4 2025", "Energiemonitor ACM Q4 2025: gasprijs laag, energietarieven fors gedaald in 2025. Gasprijs gedaald tot EUR 29/MWh — laagste niveau in lange tijd door stabiele LNG-aanvoer en mild weer.", "besluit", "in_force", "2025-11-15", "https://www.acm.nl/nl/publicaties/energiemonitor-acm-gasprijs-laag-energietarieven-fors-gedaald-2025"]);

allRegs.push(["acm", "ACM-EM-2025-Q3", "Energiemonitor ACM — Q3 2025", "Energiemonitor ACM Q3 2025: gasprijs gestegen, vulgraad gasopslagen gedaald. Analyse van de ontwikkelingen op de Nederlandse consumentenmarkt voor energie.", "besluit", "in_force", "2025-09-15", "https://www.acm.nl/nl/publicaties/energiemonitor-acm-gasprijs-gestegen-vulgraad-gasopslagen-gedaald"]);

allRegs.push(["acm", "ACM-KB-2025", "Energiemonitor klantbeleving 2025", "Energiemonitor klantbeleving 2025 — Jaarlijks consumentenonderzoek van de ACM over kennis, perceptie en gedrag van consumenten op de energiemarkt. Uitgevoerd door bureau Motivaction.", "besluit", "in_force", "2025-06-01", "https://www.acm.nl/nl/publicaties/energiemonitor-klantbeleving-2025"]);

allRegs.push(["acm", "ACM-KB-2024", "Energiemonitor klantbeleving 2024", "Energiemonitor klantbeleving 2024 — Jaarlijks consumentenonderzoek van de ACM. Resultaten over mei 2023 - april 2024. Onderzoek door Motivaction in opdracht van ACM.", "besluit", "in_force", "2024-06-01", "https://www.acm.nl/nl/publicaties/energiemonitor-klantbeleving-2024"]);

allRegs.push(["acm", "ACM-KB-2023", "Energiemonitor klantbeleving 2023", "Energiemonitor klantbeleving 2023 — Jaarlijks consumentenonderzoek van de ACM. Ontwikkeling energiemarkt voor consumenten.", "besluit", "in_force", "2023-06-01", "https://www.acm.nl/nl/publicaties/energiemonitor-klantbeleving-2023"]);

// -------------------------------------------------------------------
// 9. RVO — SDE++ regelingen (annual designation regulations)
// -------------------------------------------------------------------

const sdeYears = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009, 2008];
for (const yr of sdeYears) {
  const sdeName = yr >= 2020 ? "SDE++" : (yr >= 2011 ? "SDE+" : "SDE");
  allRegs.push(["rvo", `SDE-Aanwijzing-${yr}`, `Aanwijzingsregeling categorieën ${sdeName} ${yr}`, `Aanwijzingsregeling categorieën ${sdeName} ${yr} — Ministeriële regeling die de technologiecategorieën, fasegrenzen en basisbedragen vaststelt voor de ${sdeName}-subsidieronde van ${yr}. Gepubliceerd in de Staatscourant. Bepaalt welke technieken voor hernieuwbare energie en CO2-reductie in aanmerking komen voor subsidie, de subsidiehoogte per kWh/ton CO2, en de fasegrenzen.`, "regeling", yr >= 2024 ? "in_force" : "repealed", `${yr}-03-01`, `https://www.rvo.nl/subsidies-financiering/sde/orienteren/wet-en-regelgeving`]);
}

// SDE++ budgets
allRegs.push(["rvo", "SDE-Budget-2026", "SDE++ 2026 — openstellingsbesluit", "SDE++ 2026 openstellingsbesluit: budget EUR 8 miljard. Kamerbrief 13 februari 2026. Categorieën: zon-PV, wind op land, biomassa, geothermie, aquathermie, waterstof-elektrolyse, CCS, restwarmte, elektrische boilers.", "besluit", "in_force", "2026-02-13", "https://www.rvo.nl/subsidies-financiering/sde"]);

allRegs.push(["rvo", "SDE-Budget-2025", "SDE++ 2025 — resultaten", "SDE++ 2025 resultaten: budget EUR 8 miljard. Ondernemers vroegen bijna 3 keer zoveel subsidie aan als beschikbaar. Overinschrijving toont sterke marktvraag naar hernieuwbare energiesubsidies.", "besluit", "in_force", "2025-11-01", "https://www.rvo.nl/nieuws/resultaten-sde-2025"]);

allRegs.push(["rvo", "SDE-Budget-2024", "SDE++ 2024 — openstellingsbesluit", "SDE++ 2024 openstellingsbesluit: budget EUR 11,5 miljard. Brochure beschikbaar met alle technologiecategorieën, basisbedragen en fasegrenzen.", "besluit", "in_force", "2024-06-01", "https://www.rvo.nl/sites/default/files/2024-09/Brochure-SDE-2024_20240906.pdf"]);

// SDE++ implementation regulation
allRegs.push(["rvo", "BWBR0023563", "Algemene uitvoeringsregeling SDE++", "Algemene uitvoeringsregeling stimulering duurzame energieproductie en klimaattransitie. Bevat nadere regels over aanvraagprocedure, subsidieverplichtingen, bankgaranties, productie-eisen en sancties. Gewijzigd bij Stcrt. 2025, 23408 en Stcrt. 2024, 28764.", "regeling", "in_force", "2008-04-01", "https://wetten.overheid.nl/BWBR0023563/"]);

// Beleidsregel toets passende stimulering (MSK-toets)
allRegs.push(["rvo", "BWBR0046885", "Beleidsregel toets passende stimulering en cumulatietoets SDE++", "Beleidsregel toets passende stimulering en cumulatietoets onder het Besluit duurzame energieproductie en klimaattransitie. Stcrt. 2022, 17825. Regelt de toets of subsidie passend is (niet hoger dan nodig) en de cumulatietoets met andere subsidies conform het EU-kader voor milieusteun.", "beleidsregel", "in_force", "2022-07-12", "https://wetten.overheid.nl/BWBR0046885/"]);

// SDE correction amounts
allRegs.push(["rvo", "SDE-Corr-2026", "Voorlopige correctiebedragen SDE 2026", "Voorlopige correctiebedragen SDE 2026. Jaarlijkse correctie op de SDE-subsidiebedragen op basis van de actuele energieprijzen. PDF beschikbaar (2,36 MB).", "regeling", "in_force", "2026-01-01", "https://www.rvo.nl/subsidies-financiering/sde/orienteren/wet-en-regelgeving"]);

allRegs.push(["rvo", "SDE-Corr-2024-Def", "Definitieve correctiebedragen SDE 2024", "Definitieve correctiebedragen SDE 2024. Definitieve vaststelling van de correctie op SDE-subsidiebedragen voor 2024. PDF beschikbaar (2,74 MB).", "regeling", "in_force", "2025-04-01", "https://www.rvo.nl/subsidies-financiering/sde/orienteren/wet-en-regelgeving"]);

// Regeling garanties van oorsprong
allRegs.push(["rvo", "BWBR0037578", "Regeling garanties van oorsprong en certificaten van oorsprong", "Regeling garanties van oorsprong en certificaten van oorsprong voor hernieuwbare energie. Gewijzigd bij Stcrt. 2023, 11999. Regelt de uitgifte, overdracht en intrekking van garanties van oorsprong (GvO's) voor hernieuwbare elektriciteit en warmte.", "regeling", "in_force", "2015-01-01", "https://www.rvo.nl/subsidies-financiering/sde/orienteren/wet-en-regelgeving"]);

// Duurzaamheidseisen biomassa RED SDE++
allRegs.push(["rvo", "SDE-RED", "Duurzaamheidseisen biomassa RED SDE++", "Duurzaamheidseisen biomassa onder de Renewable Energy Directive (RED) voor SDE++. Exploitanten die SDE++-subsidie ontvangen voor biomassa-installaties moeten voldoen aan de duurzaamheidscriteria van de EU-Richtlijn hernieuwbare energie (RED II/III).", "regeling", "in_force", "2022-01-01", "https://www.rvo.nl/subsidies-financiering/sde/aanvragen/red-sde"]);

// -------------------------------------------------------------------
// 10. RVO — Energy labels and BENG
// -------------------------------------------------------------------

allRegs.push(["rvo", "BENG-Eisen", "Eisen aan Bijna Energieneutrale Gebouwen (BENG)", "Eisen aan Bijna Energieneutrale Gebouwen (BENG). Per 1 januari 2021 moeten alle aanvragen voor bouwvergunningen voldoen aan BENG-eisen. Drie indicatoren: maximale energiebehoefte (kWh/m2/jaar), maximaal primair fossiel energiegebruik (kWh/m2/jaar), minimaal aandeel hernieuwbare energie (%). Berekening volgens NTA 8800 methode.", "regeling", "in_force", "2021-01-01", "https://www.rvo.nl/onderwerpen/wetten-en-regels-gebouwen/beng"]);

allRegs.push(["rvo", "Energielabel-Woning", "Energielabel woningen — verplichting", "Energielabel woningen — Verplichting voor woningeigenaren om bij verkoop of verhuur een geldig energielabel te overleggen. Energielabel wordt opgesteld door een gecertificeerd EP-adviseur volgens NTA 8800 methode. Labels van A++++ tot G.", "regeling", "in_force", "2015-01-01", "https://www.rvo.nl/onderwerpen/wetten-en-regels-gebouwen/energielabel-woningen"]);

allRegs.push(["rvo", "Energielabel-Utiliteit", "Energielabel utiliteitsgebouwen — verplichting", "Energielabel utiliteitsgebouwen — Verplichting voor eigenaren van kantoren, winkels en andere utiliteitsgebouwen om bij verkoop of verhuur een geldig energielabel te overleggen. Per 1 januari 2023 moeten kantoren minimaal label C hebben.", "regeling", "in_force", "2008-01-01", "https://www.rvo.nl/onderwerpen/wetten-en-regels-gebouwen/energielabel-utiliteitsgebouwen"]);

allRegs.push(["rvo", "Kantoren-Label-C", "Labelplicht kantoren — minimaal label C", "Labelplicht kantoren: per 1 januari 2023 moeten alle kantoorgebouwen groter dan 100 m2 minimaal energielabel C hebben. Kantoren die niet aan deze eis voldoen mogen niet meer als kantoor worden gebruikt. Handhaving door gemeenten.", "regeling", "in_force", "2023-01-01", "https://www.rvo.nl/onderwerpen/wetten-en-regels-gebouwen/energielabel-utiliteitsgebouwen"]);

// -------------------------------------------------------------------
// 11. RVO — Other energy transition programs
// -------------------------------------------------------------------

allRegs.push(["rvo", "ISDE", "Investeringssubsidie Duurzame Energie en Energiebesparing (ISDE)", "Investeringssubsidie Duurzame Energie en Energiebesparing (ISDE). Subsidieregeling voor particulieren en zakelijke gebruikers voor de aanschaf van warmtepompen, zonneboilers, isolatiemaatregelen en aansluiting op warmtenetten. Budget ca. EUR 400 miljoen per jaar.", "regeling", "in_force", "2016-01-01", "https://www.rvo.nl/subsidies-financiering/isde"]);

allRegs.push(["rvo", "EIA", "Energie-investeringsaftrek (EIA)", "Energie-investeringsaftrek (EIA). Fiscale regeling waarmee ondernemers 45,5% van de investeringskosten in energiebesparende bedrijfsmiddelen of duurzame energie kunnen aftrekken van de fiscale winst. Jaarlijkse Energielijst bepaalt welke investeringen in aanmerking komen.", "regeling", "in_force", "1997-01-01", "https://www.rvo.nl/subsidies-financiering/eia"]);

allRegs.push(["rvo", "SDE-Wind-Zee", "Subsidieregeling windenergie op zee", "Subsidieregeling windenergie op zee — Specifieke SDE-regelingen voor offshore windparken. Hollandse Kust (zuid) kavels I-IV: subsidy-free tenders. Hollandse Kust (noord) kavel V: tenderbesluit. IJmuiden Ver kavels: vergelijkende toets. Stb. 2017, 384 (innovatief).", "regeling", "in_force", "2017-10-01", "https://www.rvo.nl/subsidies-financiering/sde"]);

// -------------------------------------------------------------------
// 12. SodM — Geothermal safety regulations
// -------------------------------------------------------------------

allRegs.push(["sodm", "SodM-TA-Geo-2025", "Toezichtarrangement geothermie 2025", "Geactualiseerd toezichtarrangement geothermie van SodM (september 2025). Beschrijft hoe SodM toezicht houdt op de geothermiesector. Afgestemd op recente wijzigingen in wet- en regelgeving: inwerkingtreding Omgevingswet (2024) en wijziging Mijnbouwwet (2023). Beoordelingsaanpak: verificatie of risicobeheersingmaatregelen adequaat zijn.", "regeling", "in_force", "2025-09-15", "https://www.sodm.nl/actueel/nieuws/2025/09/15/sodm-publiceert-geactualiseerd-toezichtarrangement-voor-geothermie"]);

allRegs.push(["sodm", "SodM-Geo-Milieu-2020", "Eisen milieu en veiligheid geothermie — gebundeld overzicht", "Eisen voor milieu en veiligheid bij geothermie — gebundeld overzicht (SodM, juli 2020). Samenvatting van alle wettelijke eisen die gelden voor geothermieprojecten: vergunningseisen Mijnbouwwet, Omgevingswet, Waterwet; veiligheidseisen boorputintegriteit, seismisch risico, grondwaterbescherming, arbeidsveiligheid.", "regeling", "in_force", "2020-07-01", "https://www.sodm.nl/actueel/nieuws/2020/07/01/eisen-voor-milieu-en-veiligheid-bij-geothermie-gebundeld"]);

allRegs.push(["sodm", "SodM-Geo-Risico-2024", "SodM-advies nieuwe risicoanalyses aardwarmte", "Aanpak en advies SodM over nieuwe risicoanalyses aardwarmte (april 2024). SodM stapt over op risicogestuurde beoordeling van aardwarmteprojecten. Operatoren moeten aantonen dat risico's van seismiciteit, grondwaterverontreiniging en boorputfalen adequaat worden beheerst.", "regeling", "in_force", "2024-04-19", "https://www.sodm.nl/actueel/nieuws/2024/04/19/aanpak-en-advies-sodm-nieuwe-risicoanalyses-aardwarmte"]);

allRegs.push(["sodm", "SodM-StS-Geo-2017", "Staat van de Sector Geothermie 2017", "Staat van de Sector Geothermie (SodM, juli 2017). Eerste sectorrapportage over de veiligheid van aardwarmtewinning in Nederland. Beschrijft de belangrijkste risico's: risico op aardbevingen, milieuschade, vermenging zoet- en zoutwater, arbeidsveiligheid. Aanbevelingen voor verbeterd toezicht.", "regeling", "in_force", "2017-07-13", "https://www.sodm.nl/actueel/nieuws/2017/07/13/staat-van-de-sector-geothermie-ook-aardwarmte-moet-veilig-gewonnen-worden"]);

allRegs.push(["sodm", "SodM-Geo-Nieuwe-Aanpak-2025", "SodM nieuwe aanpak beoordeling veiligheid aardwarmte 2025", "SodM stapt over op nieuwe aanpak voor beoordeling veiligheid aardwarmte (juli 2025). Vervangt de prescriptieve toetsing door een risicogestuurde aanpak waarbij operatoren zelf de risicobeoordeling maken en SodM toetst of het risicobeheersysteem adequaat is.", "regeling", "in_force", "2025-07-16", "https://www.sodm.nl/actueel/nieuws/2025/07/16/sodm-stapt-over-op-nieuwe-aanpak-voor-beoordeling-veiligheid-aardwarmte"]);

// -------------------------------------------------------------------
// 13. SodM — Groningen gas decisions and reports
// -------------------------------------------------------------------

allRegs.push(["sodm", "SodM-Gron-Veiligheid-2024", "Staat van de veiligheid Groningen 2024", "Staat van de veiligheid van Groningen in verband met de voormalige gaswinning 2024. Jaarrapportage SodM over seismische activiteit, bodemdaling, gebouwschade en versterkingsoperatie na beëindiging gaswinning Groningenveld.", "regeling", "in_force", "2025-04-07", "https://www.sodm.nl/documenten/2025/4/07/staat-van-de-veiligheid-van-groningen-in-verband-met-de-voormalige-gaswinning-2024"]);

allRegs.push(["sodm", "SodM-Gron-Veiligheid-2023", "Staat van de veiligheid Groningen 2023", "Staat van de veiligheid van Groningen in verband met de voormalige gaswinning 2023. Jaarrapportage SodM over de voortdurende seismische risico's en bodemdaling na sluiting van het Groningenveld.", "regeling", "in_force", "2024-04-18", "https://www.sodm.nl/binaries/staatstoezicht-op-de-mijnen/documenten/rapporten/2024/04/18/staat-van-de-veiligheid-van-groningen-in-verband-met-de-voormalige-gaswinning-2023/SodM+Staat+van+de+veiligheid+van+Groningen+2023.pdf"]);

allRegs.push(["sodm", "SodM-Gron-Advies-2022-01", "SodM-advies veiligheidsrisico's gasbesluit Groningen 2022", "SodM adviseert minister over veiligheidsrisico's bij nieuw gasbesluit Groningen (januari 2022). Advies over de te hanteren productieniveaus voor het Groningenveld en de seismische risico's.", "regeling", "in_force", "2022-01-07", "https://www.sodm.nl/actueel/nieuws/2022/01/07/sodm-adviseert-minister-over-veiligheidsrisicos-bij-nieuw-gasbesluit-groningen"]);

allRegs.push(["sodm", "SodM-Gron-Bewoners-2022", "SodM-advies — betrek bewoners bij Groningen-keuze", "SodM-advies: betrek bewoners bij keuze over winning uit het Groningen-gasveld (maart 2022). Aanbeveling om de maatschappelijke impact en bewonersperspectief mee te wegen in het gasbesluit.", "regeling", "in_force", "2022-03-22", "https://www.sodm.nl/actueel/nieuws/2022/03/22/betrek-bewoners-bij-keuze-over-winning-uit-het-groningen-gasveld"]);

allRegs.push(["sodm", "SodM-Gron-Versnelling-2024", "SodM-advies versnelling versterkingsoperatie 2024", "SodM-advies: versnel de versterkingsoperatie significant om het doel van afronding in 2028 te halen (april 2024). Betreft de versterking van woningen en gebouwen in het aardbevingsgebied Groningen.", "regeling", "in_force", "2024-04-18", "https://www.sodm.nl/actueel/nieuws/2024/04/19/aanpak-en-advies-sodm-nieuwe-risicoanalyses-aardwarmte"]);

allRegs.push(["sodm", "SodM-Gron-MaatschOnt-2019", "SodM-advies maatschappelijke ontwrichting Groningen", "SodM-advies: weeg maatschappelijke ontwrichting mee in gaswinningsbeleid Groningen (juni 2019). Aanbeveling om niet alleen seismisch risico maar ook sociale en economische gevolgen van aardbevingen te betrekken bij beleidsbeslissingen.", "regeling", "in_force", "2019-06-17", "https://www.sodm.nl/actueel/nieuws/2019/06/17/sodm-adviseert-minister-over-maatschappelijke-ontwrichting"]);

allRegs.push(["sodm", "SodM-Gron-Westerwijtwerd-2019", "SodM-advies aardbeving Westerwijtwerd", "SodM-advies naar aanleiding van de aardbeving bij Westerwijtwerd (mei 2019, magnitude 3.4). Aanbeveling: behandel de versterking als crisisaanpak met proportionele middelen en tempo.", "regeling", "in_force", "2019-05-28", "https://www.sodm.nl/actueel/nieuws/2019/05/28/sodm-advies-naar-aanleiding-van-aardbeving-westerwijtwerd"]);

// -------------------------------------------------------------------
// 14. SodM — Offshore wind safety
// -------------------------------------------------------------------

allRegs.push(["sodm", "SodM-StS-Wind-2019", "Staat van de Sector Windenergie op zee 2019", "Staat van de Sector Windenergie op zee (SodM, november 2019). Eerste sectorrapportage over de veiligheid van offshore windparken in Nederland. Risico's: hijsen en borgen, werken op hoogte, transfers tussen schepen, arbeidstijden offshore. SodM en Rijkswaterstaat houden gezamenlijk toezicht.", "regeling", "in_force", "2019-11-28", "https://www.sodm.nl/binaries/staatstoezicht-op-de-mijnen/documenten/publicaties/2019/11/28/staat-van-de-sector-windenergie-op-zee/Summary+Offshore+Wind+Energy+Current+State.pdf"]);

allRegs.push(["sodm", "SodM-Wind-Milieu-2019", "SodM-advies milieubescherming en veiligheid windenergie op zee", "SodM-advies: regel milieubescherming en veiligheid gelijktijdig goed bij windenergie op zee (december 2019). Aanbeveling om veiligheids- en milieuregels vroegtijdig te integreren in het ontwerp- en bouwproces van offshore windparken.", "regeling", "in_force", "2019-12-04", "https://www.sodm.nl/actueel/nieuws/2019/12/4/regel-milieubescherming-en-veiligheid-gelijk-goed-bij-windenergie-op-zee"]);

allRegs.push(["sodm", "SodM-Wind-Chem-2023", "Windturbines op zee — risico's chemische stoffen en plastic", "Windturbines op zee: onderzoek naar mogelijke risico's van chemische stoffen en plastic (SodM, juli 2023). Onderzoek naar loslating van microplastics en chemische stoffen door slijtage van turbinebladen (PFAS, BPA, erosiecoatings).", "regeling", "in_force", "2023-07-18", "https://www.sodm.nl/actueel/nieuws/2023/07/18/windturbines-op-zee-onderzoek-naar-mogelijke-risicos-van-chemische-stoffen-en-plastic"]);

// -------------------------------------------------------------------
// 15. SodM — CO2 storage and underground operations
// -------------------------------------------------------------------

allRegs.push(["sodm", "SodM-CO2-2024", "SodM-advies aanvullende monitoring CO2-opslag Noordzee", "SodM pleit voor aanvullende monitoring bij offshore CO2-opslag in de Noordzee (oktober 2024). Veiligheid als randvoorwaarde bij ontwikkeling van CO2-opslag. Monitoring van cavernesstabiliteit, lekdetectie, en langetermijnintegriteit van afsluitlagen.", "regeling", "in_force", "2024-10-01", "https://www.sodm.nl/sectoren/ondergrondse-opslag"]);

allRegs.push(["sodm", "SodM-Opslag-Overzicht", "SodM toezicht ondergrondse opslag — overzicht", "SodM toezicht op ondergrondse opslag. Nederland heeft zeven locaties voor opslag van aardgas, stikstof (N2) en diesel. CO2- en waterstofopslag (H2) nog niet operationeel. SodM toetst: cavernesstabiliteit, integriteit afsluitlagen, boorputintegriteit, seismisch risico, bodemdaling/-stijging. Jaarlijkse veiligheidsinspecties. Mijnbouwwet Hoofdstuk 3 als wettelijk kader.", "regeling", "in_force", "2024-01-01", "https://www.sodm.nl/sectoren/ondergrondse-opslag"]);

allRegs.push(["sodm", "SodM-KEM", "Kennisprogramma Effecten Mijnbouw (KEM)", "Kennisprogramma Effecten Mijnbouw (KEM). Onderzoeksprogramma naar geomechanische factoren die drukfluctuaties en seismiciteit bij ondergrondse gasopslag beïnvloeden. Resultaten worden gebruikt voor verbetering van risicobeoordeling en toezicht.", "regeling", "in_force", "2020-01-01", "https://www.sodm.nl/sectoren/ondergrondse-opslag"]);

// SodM annual plans and reports
allRegs.push(["sodm", "SodM-JP-2024", "SodM Jaarplan 2024", "SodM Jaarplan 2024. Strategische prioriteiten: voormalige gaswinning Groningen (monitoring bodemdaling en seismiciteit), groei geothermiesector (toezicht op nieuwe projecten), offshore wind (nieuwe parken), CO2-opslag (eerste vergunningsaanvragen), en mijnbouwveiligheid. Budget en capaciteitsplanning.", "regeling", "in_force", "2024-02-15", "https://www.sodm.nl/site/binaries/site-content/collections/documents/2024/02/15/sodm-jaarplan-2024/Jaarplan+2024.pdf"]);

allRegs.push(["sodm", "SodM-Energietransitie-2018", "SodM Jaarplan 2018 — veilige energiewinning voor energietransitie", "Vertrouwen in veilige energiewinning als voorwaarde voor succesvolle energietransitie (SodM persbericht jaarplan 2018). Toenemende druk op ruimtelijk gebruik: groei gaswinning, nieuwe windparken, kabelroutes, CO2-opslag, geothermie.", "regeling", "in_force", "2018-03-14", "https://www.sodm.nl/actueel/nieuws/2018/03/14/persbericht-jaarplan-2018-sodm"]);

allRegs.push(["sodm", "SodM-Ondergrond-2021", "SodM-advies veilig gebruik ondergrond langetermijn", "SodM-advies: veilig gebruik van de ondergrond, ook voor de lange termijn (juni 2021). Aanbevelingen voor integraal beheer van de ondergrond bij toenemend gebruik voor energietransitie (geothermie, CO2-opslag, waterstof, warmte/koude-opslag).", "regeling", "in_force", "2021-06-15", "https://www.sodm.nl/actueel/nieuws/2021/06/15/veilig-gebruik-van-de-ondergrond-ook-voor-de-lange-termijn"]);

// -------------------------------------------------------------------
// 16. SodM — Mining and salt extraction safety
// -------------------------------------------------------------------

allRegs.push(["sodm", "SodM-Zout-Toezicht", "SodM toezicht zoutwinning", "SodM toezicht op zoutwinning in Nederland. Zoutwinning door oplossingsmijnbouw bij o.a. Nouryon (voorheen AkzoNobel) in Twente en Groningen. Risico's: cavernesstabiliteit, bodemdaling, grondwaterverontreiniging. SodM inspecteert jaarlijks de boorputintegriteit en cavernegeometrie (sonarmetingen).", "regeling", "in_force", "2020-01-01", "https://www.sodm.nl/sectoren/zout"]);

allRegs.push(["sodm", "SodM-Olie-Gas-Toezicht", "SodM toezicht olie- en gaswinning (excl. Groningen)", "SodM toezicht op olie- en gaswinning in Nederland (exclusief Groningenveld). Circa 200 locaties op land en op zee. Risico's: boorputintegriteit, seismiciteit (bevingsprotocol), milieuschade, arbeidsveiligheid. Operatoren moeten een risicobeheersysteem hebben op basis van Mijnbouwbesluit en Brzo 2015.", "regeling", "in_force", "2020-01-01", "https://www.sodm.nl/sectoren/olie-en-gaswinning"]);

// -------------------------------------------------------------------
// 17. EU Regulations applicable in NL energy sector
// -------------------------------------------------------------------

allRegs.push(["acm", "EU-2019/943", "Verordening (EU) 2019/943 — interne markt elektriciteit", "Verordening (EU) 2019/943 van het Europees Parlement en de Raad van 5 juni 2019 betreffende de interne markt voor elektriciteit. Rechtstreeks toepasselijk in Nederland. Regelt grensoverschrijdende handel, capaciteitsallocatie, congestiemanagement, balancering, en voorrang hernieuwbare energie.", "regeling", "in_force", "2019-07-04", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2019/944", "Richtlijn (EU) 2019/944 — gemeenschappelijke regels interne markt elektriciteit", "Richtlijn (EU) 2019/944 betreffende gemeenschappelijke regels voor de interne markt voor elektriciteit. Geïmplementeerd in de Energiewet (BWBR0050714). Regelt consumentenrechten, energiegemeenschappen, aggregatie, demand response, slimme meters.", "regeling", "in_force", "2019-07-04", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-1227/2011", "Verordening (EU) 1227/2011 — REMIT", "Verordening (EU) Nr. 1227/2011 betreffende de integriteit en transparantie van de groothandelsmarkt voor energie (REMIT). Rechtstreeks toepasselijk. Verbiedt marktmanipulatie en handel met voorkennis op de energiegroothandelsmarkt. ACM is nationale toezichthouder.", "regeling", "in_force", "2011-12-28", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2015/1222", "Verordening (EU) 2015/1222 — CACM Guideline", "Verordening (EU) 2015/1222 tot vaststelling van richtsnoeren voor capaciteitstoewijzing en congestiebeheer (CACM). Regelt de Europese day-ahead en intraday marktkoppeling: SDAC (Single Day-Ahead Coupling) en SIDC (Single Intraday Coupling).", "regeling", "in_force", "2015-08-14", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2016/1719", "Verordening (EU) 2016/1719 — FCA Guideline", "Verordening (EU) 2016/1719 tot vaststelling van richtsnoeren voor forward-capaciteitsallocatie (FCA). Regelt de langetermijnallocatie van grensoverschrijdende transmissiecapaciteit via veilingen.", "regeling", "in_force", "2016-10-17", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2017/2195", "Verordening (EU) 2017/2195 — EB Guideline", "Verordening (EU) 2017/2195 tot vaststelling van richtsnoeren voor elektriciteitsbalancering (EB). Regelt de Europese platforms voor balanceringsenergie: TERRE (mFRR), PICASSO (aFRR), MARI (mFRR). TenneT neemt hieraan deel.", "regeling", "in_force", "2017-12-18", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2016/631", "Verordening (EU) 2016/631 — RfG (Requirements for Generators)", "Verordening (EU) 2016/631 tot vaststelling van een netcode voor het aansluiten van elektriciteitsproducenten (RfG). Technische eisen voor aansluiting van generatoren op het elektriciteitsnet: frequentierespons, spanningsregeling, fault ride-through.", "regeling", "in_force", "2016-05-17", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2016/1388", "Verordening (EU) 2016/1388 — DCC (Demand Connection Code)", "Verordening (EU) 2016/1388 tot vaststelling van een netcode voor het aansluiten van verbruikers (DCC). Technische eisen voor aansluiting van verbruiksinstallaties en distributienetten.", "regeling", "in_force", "2016-09-07", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2016/1447", "Verordening (EU) 2016/1447 — HVDC code", "Verordening (EU) 2016/1447 tot vaststelling van een netcode voor het aansluiten van hoogspanningsgelijkstroomsystemen en gelijkstroomgekoppelde modules (HVDC). Technische eisen voor HVDC-interconnectoren en offshore windparkverbindingen.", "regeling", "in_force", "2016-09-26", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2017/1485", "Verordening (EU) 2017/1485 — SO Guideline", "Verordening (EU) 2017/1485 tot vaststelling van richtsnoeren betreffende het beheer van elektriciteitstransmissiesystemen (SO). Regelt operationele veiligheid, frequentiekwaliteit, reservecapaciteit en coördinatie tussen TSO's.", "regeling", "in_force", "2017-09-14", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2017/2196", "Verordening (EU) 2017/2196 — ER netcode", "Verordening (EU) 2017/2196 tot vaststelling van een netcode voor noodmaatregelen en herstel van het elektriciteitsnet (ER). Regelt black-start procedures, frequentieherstel en coördinatie bij grootschalige netverstoringen.", "regeling", "in_force", "2017-12-24", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2017/460", "Verordening (EU) 2017/460 — NC TAR (harmonised gas tariffs)", "Verordening (EU) 2017/460 tot vaststelling van een netcode betreffende geharmoniseerde transmissietariefstructuren voor gas (NC TAR). Regelt de tariefmethodologie voor gastransportnetbeheerders.", "regeling", "in_force", "2017-04-06", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2017/459", "Verordening (EU) 2017/459 — NC CAM (gas capacity allocation)", "Verordening (EU) 2017/459 tot vaststelling van een netcode betreffende capaciteitstoewijzingsmechanismen in gastransmissiesystemen (NC CAM). Regelt veilingprocedures voor gastransportcapaciteit.", "regeling", "in_force", "2017-04-06", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-312/2014", "Verordening (EU) 312/2014 — NC BAL (gas balancing)", "Verordening (EU) Nr. 312/2014 tot vaststelling van een netcode betreffende gasbalancering van transmissienetten (NC BAL). Regelt de balancering van het gasnet door shippers en de rol van GTS als marktbeheerder.", "regeling", "in_force", "2014-04-16", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2017/1938", "Verordening (EU) 2017/1938 — gasleveringszekerheid", "Verordening (EU) 2017/1938 betreffende maatregelen tot veiligstelling van de gasleveringszekerheid. Vereist dat lidstaten noodplannen en preventieve actieplannen opstellen voor het geval van ernstige gasleveringsonderbrekingen.", "regeling", "in_force", "2017-11-01", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2024/1788", "Verordening (EU) 2024/1788 — interne markten hernieuwbaar gas en waterstof", "Verordening (EU) 2024/1788 betreffende interne markten voor hernieuwbaar gas, aardgas en waterstof. Creëert regelgevend kader voor waterstoftransport en -handel. Nog niet volledig van kracht — gefaseerde implementatie.", "regeling", "in_force", "2024-07-01", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2022/869", "Verordening (EU) 2022/869 — TEN-E (trans-Europese energie-infrastructuur)", "Verordening (EU) 2022/869 betreffende richtsnoeren voor trans-Europese energie-infrastructuur (TEN-E). Regelt projecten van gemeenschappelijk belang (PCI's) voor grensoverschrijdende energieinfrastructuur, inclusief offshore grids en waterstofnetwerken.", "regeling", "in_force", "2022-06-23", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2018/2001", "Richtlijn (EU) 2018/2001 — RED II (hernieuwbare energie)", "Richtlijn (EU) 2018/2001 ter bevordering van het gebruik van energie uit hernieuwbare bronnen (RED II). Doel: 32% hernieuwbare energie in 2030 (later verhoogd naar 42,5% door RED III). Geïmplementeerd in SDE++-regelgeving en duurzaamheidseisen biomassa.", "regeling", "in_force", "2018-12-24", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2023/1791", "Richtlijn (EU) 2023/1791 — EED recast (energie-efficiëntie)", "Richtlijn (EU) 2023/1791 betreffende energie-efficiëntie (EED recast). Verhoogde energie-efficiëntiedoelstelling: 11,7% reductie finaal energieverbruik in 2030. Implementatie in Nederlandse wetgeving lopend.", "regeling", "in_force", "2023-10-10", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

allRegs.push(["acm", "EU-2019/941", "Verordening (EU) 2019/941 — risicobeheersing elektriciteitsvoorziening", "Verordening (EU) 2019/941 betreffende risicoparaatheid in de elektriciteitssector. Vereist dat lidstaten risicobeoordelingen en -plannen opstellen voor elektriciteitscrises. ENTSO-E voert jaarlijkse adequacy assessments uit.", "regeling", "in_force", "2019-07-04", "https://www.acm.nl/nl/energie/wetten-en-regels-voor-de-energiemarkt"]);

// -------------------------------------------------------------------
// 18. Additional RVO programs and regulations
// -------------------------------------------------------------------

allRegs.push(["rvo", "SCE", "Subsidieregeling Coöperatieve Energieopwekking (SCE)", "Subsidieregeling Coöperatieve Energieopwekking (SCE). Subsidie voor energiecoöperaties en VvE's die lokaal hernieuwbare energie opwekken. Vervangt de postcoderoosregeling. Budget ca. EUR 150 miljoen per jaar. Categorieën: zon-PV op dak, wind op land.", "regeling", "in_force", "2021-04-01", "https://www.rvo.nl/subsidies-financiering/sce"]);

allRegs.push(["rvo", "MOOI", "Missiegedreven Onderzoek, Ontwikkeling en Innovatie (MOOI)", "Missiegedreven Onderzoek, Ontwikkeling en Innovatie (MOOI). Subsidieregeling voor innovatieprojecten in de energietransitie: geïntegreerde oplossingen voor hernieuwbare elektriciteit, gebouwde omgeving, en industrie. Budget wisselend per ronde.", "regeling", "in_force", "2020-01-01", "https://www.rvo.nl/subsidies-financiering/mooi"]);

allRegs.push(["rvo", "DEI+", "Demonstratie Energie- en Klimaatinnovatie (DEI+)", "Demonstratie Energie- en Klimaatinnovatie (DEI+). Subsidie voor demonstratieprojecten die CO2 reduceren in de industrie, gebouwde omgeving, mobiliteit of landbouw. Bijdrage 25-45% van projectkosten.", "regeling", "in_force", "2019-01-01", "https://www.rvo.nl/subsidies-financiering/dei"]);

allRegs.push(["rvo", "IABO", "Investeringsaftrek bedrijfsmiddelen milieubescherming (MIA/VAMIL)", "Milieu-investeringsaftrek (MIA) en Willekeurige Afschrijving Milieu-investeringen (VAMIL). Fiscale regelingen voor milieu-investeringen waaronder energie-efficiëntiemaatregelen en hernieuwbare energie-installaties. Jaarlijkse Milieulijst bepaalt welke investeringen kwalificeren.", "regeling", "in_force", "2000-01-01", "https://www.rvo.nl/subsidies-financiering/mia-vamil"]);

allRegs.push(["rvo", "ETS-Compensatie", "Indirecte kostencompensatie ETS", "Indirecte kostencompensatie EU-ETS — Compensatieregeling voor elektriciteitsintensieve bedrijven voor de indirecte kosten van het EU-emissiehandelssysteem (doorberekening CO2-prijs in elektriciteitsprijs). Conform EU-richtsnoeren staatssteun ETS.", "regeling", "in_force", "2021-01-01", "https://www.rvo.nl/subsidies-financiering/indirecte-kostencompensatie-ets"]);

allRegs.push(["rvo", "Energiebesparingsplicht", "Energiebesparingsplicht bedrijven en instellingen", "Energiebesparingsplicht (artikel 2.15 Activiteitenbesluit milieubeheer). Bedrijven en instellingen met een jaarlijks energieverbruik van meer dan 50.000 kWh elektriciteit of 25.000 m3 aardgas(equivalent) zijn verplicht alle energiebesparende maatregelen te nemen met een terugverdientijd van 5 jaar of minder. Informatieplicht per 1 juli 2019.", "regeling", "in_force", "2019-07-01", "https://www.rvo.nl/onderwerpen/wetten-en-regels-gebouwen"]);

allRegs.push(["rvo", "WKK-Regeling", "Regeling certificaten warmtekrachtkoppeling", "Regeling certificaten warmtekrachtkoppeling (WKK). Regelt de uitgifte van certificaten voor hoogrenderende warmtekrachtkoppeling die recht geven op SDE-subsidie of andere stimulering.", "regeling", "in_force", "2012-01-01", "https://www.rvo.nl/subsidies-financiering/sde"]);

allRegs.push(["rvo", "Klimaatakkoord-Energie", "Klimaatakkoord 2019 — energiesectoren", "Klimaatakkoord (28 juni 2019) — Afspraken over CO2-reductie in vijf sectoren: elektriciteit (49% hernieuwbaar in 2030), gebouwde omgeving (aardgasvrij), industrie (CCS, waterstof), mobiliteit (elektrisch), landbouw. SDE++ is het centrale subsidie-instrument.", "regeling", "in_force", "2019-06-28", "https://www.rvo.nl/subsidies-financiering/sde"]);

allRegs.push(["rvo", "Nationaal-Plan-Energie", "Nationaal Plan Energiesysteem 2050", "Nationaal Plan Energiesysteem 2050 — Langetermijnvisie op het Nederlandse energiesysteem. Scenario's voor elektrificatie, waterstof, warmte en CCS. Doelstellingen: klimaatneutraal in 2050, 55% CO2-reductie in 2030.", "regeling", "in_force", "2023-12-01", "https://www.rvo.nl/onderwerpen/energietransitie"]);

allRegs.push(["rvo", "NTA-8800", "NTA 8800 — Energieprestatie gebouwen berekeningsmethode", "NTA 8800 — Nederlandse Technische Afspraak voor de bepaling van de energieprestatie van gebouwen. Vervangt de EPC-methode (NEN 7120). Gebruikt voor BENG-berekeningen bij nieuwbouw en voor het opstellen van energielabels bij bestaande gebouwen. Beheerd door NEN.", "regeling", "in_force", "2020-01-01", "https://www.rvo.nl/onderwerpen/wetten-en-regels-gebouwen/beng"]);

allRegs.push(["rvo", "WKB-Energie", "Wet kwaliteitsborging voor het bouwen — energieprestatie", "Wet kwaliteitsborging voor het bouwen (Wkb) — Per 1 januari 2024 gelden strengere kwaliteitseisen bij nieuwbouw, waaronder verificatie van energieprestatie (BENG). Onafhankelijke kwaliteitsborgers toetsen of het bouwwerk voldoet aan het Besluit bouwwerken leefomgeving.", "regeling", "in_force", "2024-01-01", "https://www.rvo.nl/onderwerpen/wetten-en-regels-gebouwen"]);

// -------------------------------------------------------------------
// 19. Additional SodM items
// -------------------------------------------------------------------

allRegs.push(["sodm", "Mijnbouwregeling", "Mijnbouwregeling", "Mijnbouwregeling — Ministeriële regeling ter uitvoering van de Mijnbouwwet en het Mijnbouwbesluit. Bevat nadere technische en procedurele voorschriften voor mijnbouwactiviteiten: boorputontwerp, seismische monitoring, rapportageformats, veiligheidszonering.", "regeling", "in_force", "2003-01-01", "https://wetten.overheid.nl/BWBR0014468/"]);

allRegs.push(["sodm", "SodM-Inspectie-Aanpak", "SodM inspectieaanpak — systeemgericht toezicht", "SodM inspectieaanpak — Systeemgericht toezicht (SGT). SodM inspecteert niet alleen de technische staat van installaties maar toetst het veiligheidsmanagementsysteem van operators. Beoordeelt of risico's systematisch worden geïdentificeerd, beheerst en gemonitord.", "regeling", "in_force", "2020-01-01", "https://www.sodm.nl/over-ons/inspecteren"]);

allRegs.push(["sodm", "SodM-Int-Samenwerking", "SodM internationale samenwerking", "SodM neemt deel aan internationale samenwerkingsverbanden: North Sea Offshore Authorities Forum (NSOAF), EU Offshore Authorities Group (EUOAG), International Regulators Forum (IRF). Harmonisatie van veiligheidsnormen voor offshore olie, gas en wind.", "regeling", "in_force", "2019-01-01", "https://www.sodm.nl/over-ons/internationale-samenwerking"]);

allRegs.push(["sodm", "SodM-Bodemdaling", "Bodemdalingsrapportage mijnbouw", "Jaarlijkse bodemdalingsrapportage voor mijnbouwactiviteiten. Operators moeten bodemdaling door gaswinning, zoutwinning en geothermie monitoren en rapporteren. SodM toetst of de bodemdaling binnen de vergunde grenzen blijft. Meetmethode: geodetisch netwerk en InSAR-satellietdata.", "regeling", "in_force", "2010-01-01", "https://www.sodm.nl/sectoren/gaswinning-groningen"]);

allRegs.push(["sodm", "SodM-Seismisch-Protocol", "Seismisch risico — bevingsprotocol mijnbouw", "Bevingsprotocol voor mijnbouwactiviteiten. Operators moeten een seismisch meetnetwerk installeren en onderhouden. Bij overschrijding van drempelwaarden (magnitude, grondversnelling) volgt een semafoorsysteem: groen/geel/oranje/rood met bijbehorende acties (doorgaan/onderzoeken/beperken/stoppen).", "regeling", "in_force", "2017-01-01", "https://www.sodm.nl/sectoren/olie-en-gaswinning"]);

allRegs.push(["sodm", "SodM-Boorputintegriteit", "Standaard boorputintegriteit", "Standaard boorputintegriteit (Well Integrity Standard). SodM-eis dat alle boorputten gedurende hun gehele levenscyclus (boring, productie, stillegging, afsluiting) moeten voldoen aan dubbele barrière-eisen. Gebaseerd op NORSOK D-010 en ISO 16530.", "regeling", "in_force", "2016-01-01", "https://www.sodm.nl/over-ons/inspecteren"]);

allRegs.push(["sodm", "SodM-Decommissioning", "Buiten gebruik stelling mijnbouwwerken", "Verplichtingen bij buiten gebruik stelling (decommissioning) van mijnbouwwerken. Mijnbouwwet art. 44-45. Operators moeten een sluitingsplan indienen en goedkeuring krijgen van SodM. Omvat permanent afsluiten van boorputten (plug & abandonment), verwijdering van installaties en ecologisch herstel.", "regeling", "in_force", "2003-01-01", "https://www.sodm.nl/sectoren/olie-en-gaswinning"]);

allRegs.push(["sodm", "SodM-Waterstof-Opslag", "Waterstofopslag in zoutcavernes — veiligheidskader", "Veiligheidskader voor ondergrondse waterstofopslag in zoutcavernes. In ontwikkeling bij SodM. Waterstofopslag nog niet operationeel in Nederland maar vergunningsaanvragen verwacht. Risico's: materiaalcompatibiliteit (hydrogen embrittlement), cavernesstabiliteit bij wisselende drukken, lekkagedetectie.", "regeling", "draft", "2025-01-01", "https://www.sodm.nl/sectoren/ondergrondse-opslag"]);

// -------------------------------------------------------------------
// 20. Additional ACM items
// -------------------------------------------------------------------

allRegs.push(["acm", "ACM-Leveranciersvergunning", "Vergunningstelsel energieleveranciers", "Vergunningstelsel voor energieleveranciers onder de Energiewet. Leveranciers van elektriciteit en gas aan kleinverbruikers (< 3x80 A) moeten een leveringsvergunning van de ACM hebben. Financiële eisen, organisatorische eisen, modelcontract, en continuïteitsplan.", "regeling", "in_force", "2026-01-01", "https://www.acm.nl/nl/energie/toezicht-op-de-energiemarkt"]);

allRegs.push(["acm", "ACM-Prijsplafond-2023", "Prijsplafond energie 2023", "Tijdelijk prijsplafond energie 2023 (Stb. 2022, 524). Maximumtarief voor elektriciteit (EUR 0,40/kWh tot 2.900 kWh) en gas (EUR 1,45/m3 tot 1.200 m3) voor kleinverbruikers. Overheidsmaatregel n.a.v. de energiecrisis 2022. Looptijd 1 januari - 31 december 2023.", "regeling", "repealed", "2023-01-01", "https://www.acm.nl/nl/energie/toezicht-op-de-energiemarkt"]);

allRegs.push(["acm", "ACM-Congestiemanagement-Besluit", "ACM-besluit congestiemanagement — verplichte deelname", "ACM-besluit over verplichte deelname aan congestiemanagement voor partijen met gecontracteerde transportcapaciteit > 60 MW. Op basis van artikel 9.5 Netcode elektriciteit (nu Systeemcode). Partijen moeten flexibiliteit structureel beschikbaar stellen aan netbeheerders.", "besluit", "in_force", "2021-07-01", "https://www.acm.nl/nl/energie/toezicht-op-de-energiemarkt"]);

allRegs.push(["acm", "ACM-Maatschappelijk-Prioriteren", "ACM-besluit maatschappelijk prioriteren bij netschaarste", "ACM-besluit maatschappelijk prioriteren bij netschaarste (oktober 2024). Bij onvoldoende transportcapaciteit krijgen bepaalde afnemers voorrang: woningbouw, ziekenhuizen, vitale infrastructuur. Wijziging van de Netcode elektriciteit (art. 9.14a-9.14d).", "besluit", "in_force", "2024-10-01", "https://www.acm.nl/nl/energie/toezicht-op-de-energiemarkt"]);

allRegs.push(["acm", "Begrippencode-gas-BWBR0037923", "Begrippencode gas", "Begrippencode gas (BWBR0037923). Officiële definitielijst voor alle begrippen in de gascodes. Vastgesteld door de ACM.", "besluit", "in_force", "2016-01-01", "https://wetten.overheid.nl/BWBR0037923"]);

allRegs.push(["acm", "Meetcode-E-BWBR0037946", "Meetcode elektriciteit (BWBR0037946)", "Meetcode elektriciteit (BWBR0037946). Officiële wettekst van de meetcode elektriciteit op wetten.overheid.nl. Bevat technische specificaties voor meetinrichtingen, validatie- en correctieprocedures.", "besluit", "in_force", "2016-01-01", "https://wetten.overheid.nl/BWBR0037946"]);

allRegs.push(["acm", "Informatiecode-BWBR0037935", "Informatiecode elektriciteit en gas (BWBR0037935)", "Informatiecode elektriciteit en gas (BWBR0037935). Officiële wettekst op wetten.overheid.nl. Bevat regels over gegevensuitwisseling: leverancierswisselproces, verhuisproces, meetdata-uitwisseling.", "besluit", "in_force", "2016-01-01", "https://wetten.overheid.nl/BWBR0037935"]);

// Wijzigingswetten E-wet en Gaswet
allRegs.push(["acm", "BWBR0020608", "Wijzigingswet E-wet en Gaswet — onafhankelijk netbeheer (Splitsingswet)", "Wijzigingswet Elektriciteitswet 1998 en Gaswet (nadere regels omtrent een onafhankelijk netbeheer). Stb. 2006, 614. De 'Splitsingswet': verplicht scheiding van netbeheer en commerciële energieactiviteiten. Energiebedrijven mogen geen netbeheerder en leverancier tegelijk zijn.", "wet", "repealed", "2008-07-01", "https://wetten.overheid.nl/BWBR0020608/"]);

allRegs.push(["acm", "BWBR0031815", "Wijzigingswet E-wet en Gaswet — derde energiepakket EU", "Wijzigingswet Elektriciteitswet 1998 en Gaswet (implementatie richtlijnen en verordeningen elektriciteit en gas). Stb. 2012, 334. Implementatie van het derde energiepakket EU (Richtlijnen 2009/72/EG en 2009/73/EG): versterking onafhankelijkheid TSO's, consumentenrechten, ACER-samenwerking.", "wet", "repealed", "2012-08-01", "https://wetten.overheid.nl/BWBR0031815/"]);

allRegs.push(["acm", "BWBR0040852", "Wijzigingswet E-wet — voortgang energietransitie", "Wijzigingswet Elektriciteitswet 1998 (voortgang energietransitie). Stb. 2018, 109. Regelt aanpassingen voor de energietransitie: experiment-AMvB, energieopslagfaciliteiten, en congestiemanagement-instrumenten.", "wet", "repealed", "2018-05-01", "https://wetten.overheid.nl/BWBR0040852/"]);

allRegs.push(["acm", "BWBR0043813", "Wijzigingswet E-wet en Gaswet — implementatie Gasrichtlijn 2019", "Wijzigingswet Elektriciteitswet 1998 (implementatie wijziging Gasrichtlijn en verordeningen elektriciteit en gas). Stb. 2020, 254. Aanpassingen aan de Nederlandse energiewetgeving op basis van herziene EU-gasrichtlijn.", "wet", "repealed", "2020-07-10", "https://wetten.overheid.nl/BWBR0043813/"]);

// -------------------------------------------------------------------
// 21. Kavelbesluit wind op zee (offshore wind plot decisions)
// -------------------------------------------------------------------

const kavelBesluiten: RegTuple[] = [
  ["acm", "BWBR0039095", "Kavelbesluit I windenergiegebied Hollandse Kust (zuid)", "Kavelbesluit I voor het windenergiegebied Hollandse Kust (zuid). Aanwijzing van kavel I voor de bouw en exploitatie van een offshore windpark. Vermogen circa 350 MW. Vergunning verleend aan Vattenfall (subsidy-free).", "besluit", "in_force", "2017-02-01", "https://wetten.overheid.nl/BWBR0039095/"],
  ["acm", "BWBR0039096", "Kavelbesluit II windenergiegebied Hollandse Kust (zuid)", "Kavelbesluit II voor het windenergiegebied Hollandse Kust (zuid). Kavel II, circa 350 MW. Vergunning verleend aan Vattenfall (subsidy-free).", "besluit", "in_force", "2017-02-01", "https://wetten.overheid.nl/BWBR0039096/"],
  ["acm", "BWBR0041607-III", "Kavelbesluit III windenergiegebied Hollandse Kust (zuid)", "Kavelbesluit III voor het windenergiegebied Hollandse Kust (zuid). Kavel III, circa 350 MW. Vergunning verleend aan Vattenfall.", "besluit", "in_force", "2019-01-01", "https://wetten.overheid.nl/BWBR0041607/"],
  ["acm", "BWBR0041608-IV", "Kavelbesluit IV windenergiegebied Hollandse Kust (zuid)", "Kavelbesluit IV voor het windenergiegebied Hollandse Kust (zuid). Kavel IV, circa 350 MW.", "besluit", "in_force", "2019-01-01", "https://wetten.overheid.nl/BWBR0041608/"],
  ["acm", "BWBR0043064-V", "Kavelbesluit V windenergiegebied Hollandse Kust (noord)", "Kavelbesluit V voor het windenergiegebied Hollandse Kust (noord). Kavel V, circa 700 MW. Vergunning verleend aan CrossWind (Shell/Eneco). Inclusief innovatieve technologieën (floating solar, groene waterstof).", "besluit", "in_force", "2020-04-01", "https://wetten.overheid.nl/BWBR0043064/"],
  ["acm", "KB-HKW-VI", "Kavelbesluit VI windenergiegebied Hollandse Kust (west)", "Kavelbesluit VI voor het windenergiegebied Hollandse Kust (west). Kavel VI, circa 700 MW. Vergelijkende toets met financieel bod.", "besluit", "in_force", "2022-01-01", "https://wetten.overheid.nl/BWBR0046828/"],
  ["acm", "KB-HKW-VII", "Kavelbesluit VII windenergiegebied Hollandse Kust (west)", "Kavelbesluit VII voor het windenergiegebied Hollandse Kust (west). Kavel VII, circa 700 MW.", "besluit", "in_force", "2022-01-01", "https://wetten.overheid.nl/BWBR0046828/"],
  ["acm", "KB-IJV-Alpha", "Kavelbesluit IJmuiden Ver — kavel Alpha", "Kavelbesluit voor windenergiegebied IJmuiden Ver, kavel Alpha. Circa 2 GW. Grootschalige offshore windproductie met aansluiting via TenneT 2GW HVDC-platform.", "besluit", "in_force", "2023-06-01", "https://www.rvo.nl/subsidies-financiering/sde"],
  ["acm", "KB-IJV-Beta", "Kavelbesluit IJmuiden Ver — kavel Beta", "Kavelbesluit voor windenergiegebied IJmuiden Ver, kavel Beta. Circa 2 GW. Oplevering gepland 2029-2030.", "besluit", "in_force", "2023-06-01", "https://www.rvo.nl/subsidies-financiering/sde"],
];
allRegs.push(...kavelBesluiten);

// -------------------------------------------------------------------
// COMMIT ALL REGULATIONS
// -------------------------------------------------------------------

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

type GCTuple = [string, string, string, string, string, string, string];

const allGridCodes: GCTuple[] = [
  // Technical regulations — grid codes
  ["TenneT-SysE-2026", "Systeemcode elektriciteit 2026 (voorheen Netcode)", "Systeemcode elektriciteit 2026 — Technische voorschriften voor het elektriciteitsnet. Voorheen: Netcode elektriciteit. Samenvoeging van Netcode en Systeemcode onder de Energiewet per 1 januari 2026. Bevat: spanningskwaliteit (EN 50160), frequentieregeling (49.8-50.2 Hz normaal), bescherming, vermogensregeling, spanningsregeling, aansluiteisen voor productie-eenheden (RfG-compliance) en verbruiksinstallaties (DCC-compliance), bedrijfsvoering, planning.", "technical_regulation", "2026.1", "2026-01-01", "https://www.netbeheernederland.nl/sites/default/files/2024-10/e02_-_20241001_-_20241024_-_netcode_elektriciteit.pdf"],

  ["TenneT-NetE-Legacy", "Netcode elektriciteit (pre-Energiewet)", "Netcode elektriciteit — Technische code vastgesteld door de ACM onder de Elektriciteitswet 1998. Bevatte de technische voorschriften voor het beheer van en de aansluiting op het elektriciteitsnet. Per 1 januari 2026 opgegaan in de Systeemcode elektriciteit 2026 onder de Energiewet.", "technical_regulation", "2024.10", "2024-10-01", "https://www.netbeheernederland.nl/sites/default/files/2024-10/e02_-_20241001_-_20241024_-_netcode_elektriciteit.pdf"],

  // Grid connection requirements
  ["TenneT-GCC-EU", "Grid Code Compliance — EU (RfG, DCC, HVDC)", "Grid Code Compliance EU (GCC-EU) — Verificatie van naleving van Europese netcodes door installaties aangesloten op het TenneT-net. Omvat: Requirements for Generators (RfG, EU 2016/631), Demand Connection Code (DCC, EU 2016/1388), HVDC (EU 2016/1447). Installaties doorlopen EON/ION/FON-proces (Energising Operational Notification / Interim / Final).", "grid_connection", "EU-2024", "2024-01-01", "https://www.tennet.eu/nl/de-elektriciteitsmarkt/aansluiten-op-het-nederlandse-hoogspanningsnet/compliance-verificatie-grid-code-compliance"],

  ["TenneT-GCC-NL", "Grid Code Compliance — NL (Systeemcode)", "Grid Code Compliance NL (GCC-NL) — Verificatie van naleving van de Nederlandse Systeemcode elektriciteit (voorheen Netcode) door installaties aangesloten op het TenneT-net. Nationale eisen bovenop de EU-netcodes. TenneT-specifieke aanvullende technische eisen voor aansluiting op 110 kV, 150 kV, 220 kV en 380 kV.", "grid_connection", "NL-2026", "2026-01-01", "https://www.tennet.eu/nl/de-elektriciteitsmarkt/aansluiten-op-het-nederlandse-hoogspanningsnet/compliance-verificatie-grid-code-compliance"],

  ["TenneT-EON-ION-FON", "EON/ION/FON aansluitproces", "Energising Operational Notification (EON), Interim Operational Notification (ION) en Final Operational Notification (FON) — Drie-staps aansluitproces voor installaties op het TenneT-net. EON: toestemming voor eerste inschakeling. ION: tussentijdse bedrijfstoestemming met voorwaarden. FON: definitieve toestemming na volledige GCC-EU en GCC-NL compliance verificatie.", "grid_connection", "2024.1", "2024-01-01", "https://www.tennet.eu/nl/de-elektriciteitsmarkt/aansluiten-op-het-nederlandse-hoogspanningsnet/compliance-verificatie-grid-code-compliance"],

  // Congestion management
  ["TenneT-Congestie-Art95", "Congestiemanagement — artikel 9.5 Netcode elektriciteit", "Congestiemanagement op basis van artikel 9.5 van de Netcode elektriciteit (nu Systeemcode elektriciteit). TenneT verwacht structureel congestie in het 150 kV-net van meerdere provincies (Flevoland, Gelderland, Noord-Brabant, Limburg) voor de periode 2021-2029. Aangeslotenen met gecontracteerde transportcapaciteit > 60 MW zijn verplicht deel te nemen aan congestiemanagement.", "congestion_management", "2024.1", "2024-01-01", "https://www.tennet.eu/nl/de-elektriciteitsmarkt/congestiemanagement/congestiemanagement-voor-afname-en-invoeding"],

  ["TenneT-Congestie-CSP", "Congestion Spread Platform (CSP)", "Congestion Spread Platform (CSP) — TenneT's platform voor congestiemanagement. Marktpartijen kunnen biedingen indienen om hun elektriciteitsverbruik of -invoeding aan te passen bij netcongestie. Redispatch-verplichtingen: capaciteit beschikbaar stellen vanaf sluiting day-ahead markt. Biedingen aanpasbaar tot 45 minuten voor aanvang kwartierperiode.", "congestion_management", "2024.2", "2024-01-01", "https://www.tennet.eu/nl/de-elektriciteitsmarkt/congestiemanagement/csp"],

  ["TenneT-Congestie-Prioriteren", "Maatschappelijk prioriteren bij congestie", "Maatschappelijk prioriteren bij netcongestie — Per 1 oktober 2024 (ACM-besluit) kunnen bepaalde afnemers voorrang krijgen bij toewijzing van transportcapaciteit op basis van maatschappelijk belang. Woningbouw, ziekenhuizen en vitale infrastructuur kunnen prioriteit krijgen boven commerciële aansluitingen.", "congestion_management", "2024.3", "2024-10-01", "https://www.tennet.eu/nl/de-elektriciteitsmarkt/congestiemanagement/maatschappelijk-prioriteren-bij-congestie"],

  ["TenneT-Netcapkaart", "Netcapaciteitskaart TenneT", "Netcapaciteitskaart — Transparantie-instrument van TenneT dat de beschikbare transportcapaciteit per regio op het hoogspanningsnet toont. Bevat informatie over congestiegebieden, wachtrijen, en geplande netverzwaringen. Wordt regelmatig bijgewerkt.", "congestion_management", "2026.1", "2026-01-01", "https://www.tennet.eu/nl/de-elektriciteitsmarkt/congestiemanagement/netcapaciteitskaart"],

  // Balancing
  ["TenneT-Balans-aFRR", "Automatic Frequency Restoration Reserve (aFRR)", "Automatic Frequency Restoration Reserve (aFRR) — TenneT's primaire balanceringsproduct. Geautomatiseerde frequentieherstelreserve met activatietijd van 30 seconden tot 15 minuten. TenneT berekent halfjaarlijks de benodigde reservecapaciteit en contracteert via dagelijkse veiling. Onderdeel van het Europese PICASSO-platform.", "balancing", "2024.1", "2024-01-01", "https://www.tennet.eu/nl/balanceringsmarkten"],

  ["TenneT-Balans-mFRR", "Manual Frequency Restoration Reserve (mFRR)", "Manual Frequency Restoration Reserve (mFRR) — TenneT's secundaire balanceringsproduct. Handmatig geactiveerde frequentieherstelreserve met activatietijd van 15 minuten. Contractering via dagelijkse veiling. Onderdeel van het Europese MARI-platform.", "balancing", "2024.1", "2024-01-01", "https://www.tennet.eu/nl/balanceringsmarkten"],

  ["TenneT-BRP", "Balanceringsverantwoordelijkheid (BRP)", "Balanceringsverantwoordelijkheid — Elke leverancier of afnemer met een netaansluiting draagt balanceringsverantwoordelijkheid en moet aangesloten zijn bij een Balance Responsible Party (BRP). De BRP is financieel verantwoordelijk voor alle onbalans in zijn portfolio van aansluitingen. TenneT publiceert onbalansprijzen per 15-minuten periode (ISP).", "balancing", "2024.1", "2024-01-01", "https://www.tennet.eu/nl/de-elektriciteitsmarkt/balansverantwoordelijken-brps/balanceringsverantwoordelijkheid"],

  ["TenneT-BSP", "Balancing Service Providers (BSP)", "Balancing Service Providers (BSP) — Partijen die balanceringsenergie aanbieden aan TenneT. BSP's leveren aFRR- en mFRR-capaciteit via het TenneT-biedingssysteem. Reactieve aanpak: TenneT activeert alleen balanceringsproducten wanneer onbalans daadwerkelijk optreedt, niet op basis van voorspelde onbalans.", "balancing", "2024.1", "2024-01-01", "https://www.tennet.eu/nl-en/balancing-service-providers-bsp"],

  ["TenneT-Balanshandhaving", "Balanshandhaving", "Balanshandhaving — Het proces waarmee TenneT de frequentie op het Nederlandse hoogspanningsnet op 50 Hz houdt. TenneT activeert balanceringsenergie (aFRR, mFRR) om het verschil tussen vraag en aanbod te compenseren. Settlement op basis van onbalansprijzen per ISP (imbalance settlement period).", "balancing", "2024.1", "2024-01-01", "https://www.tennet.eu/nl/de-elektriciteitsmarkt/nederlandse-markt/balanshandhaving"],

  // Capacity allocation
  ["TenneT-TDTR", "Tijdelijke transportrechten (TDTR)", "Tijdelijke transportrechten (TDTR / Time-limited Transport Rights) — TenneT heeft ruim 9 GW aan restruimte op het hoogspanningsnet toegewezen aan 57 bedrijven via TDTR. Partijen krijgen het recht om gedurende minimaal 85% van de tijd per jaar te transporteren. Geldt voor zowel afname als invoeding.", "market_regulation", "2024.1", "2024-09-01", "https://www.tennet.eu/nl/nieuws/restruimte-op-het-hoogspanningsnet-toegewezen-aan-geinteresseerde-partijen"],

  ["TenneT-GTO", "Groepstransportovereenkomst (GTO)", "Groepstransportovereenkomst (GTO) — Maakt onderling delen van transportcapaciteit mogelijk tussen aangeslotenen. Partijen kunnen gezamenlijk een groepstransportovereenkomst sluiten waarmee zij hun gecontracteerde transportcapaciteit optimaal benutten. Bijdraagt aan verlaging netcongestie.", "market_regulation", "2024.2", "2024-11-01", "https://magazines.tennet.eu/nieuwsbrief-netcongestie-november-2024/groepstransportovereenkomst-maakt-onderling-delen-van-transportcapaciteit-mogelijk1"],

  ["TenneT-Transportcapaciteit", "Transportcapaciteit — toewijzingsregels", "Transportcapaciteit toewijzingsregels — Bij voldoende capaciteit krijgen aanvragers direct transportcapaciteit. Bij onvoldoende capaciteit ontstaat een wachtrij op basis van First Come First Served (FCFS). Per 1 oktober 2024 geldt maatschappelijk prioriteren (ACM-besluit). Capaciteit komt vrij door congestiemanagement of netinvesteringen.", "market_regulation", "2024.3", "2024-10-01", "https://www.tennet.eu/nl/de-elektriciteitsmarkt/Nederlandse-markt/transportcapaciteit"],

  ["TenneT-2GW-HVDC", "TenneT 2 GW HVDC-platform standaard", "TenneT schaalt transportcapaciteit standaard op naar 2 GW per offshore platform om uitrol offshore windenergie te versnellen. 2 GW HVDC-platforms (gelijkstroomverbindingen) worden de standaard voor aansluiting van windparken op zee. Toegepast bij IJmuiden Ver en latere windgebieden.", "technical_regulation", "2024.1", "2024-06-01", "https://www.tennet.eu/nl/nieuws/nieuws/tennet-schaalt-transportcapaciteit-standaard-op-om-uitrol-offshore-windenergie-te-versnellen/"],

  // European codes via TenneT
  ["TenneT-EU-Codes", "Europese codes — overzicht TenneT", "Europese codes die van toepassing zijn op TenneT NL: RfG (EU 2016/631 — generatoren), DCC (EU 2016/1388 — verbruikers), HVDC (EU 2016/1447), SO GL (EU 2017/1485 — systeembeheer), EB GL (EU 2017/2195 — balancering), ER NC (EU 2017/2196 — noodmaatregelen), CACM (EU 2015/1222), FCA (EU 2016/1719). TenneT implementeert deze codes in de Nederlandse markt.", "technical_regulation", "EU-2024", "2024-01-01", "https://www.tennet.eu/nl/de-elektriciteitsmarkt/regels-en-procedures/europese-codes"],

  // Marktkoppeling
  ["TenneT-Marktkoppeling", "Marktkoppeling (market coupling)", "Marktkoppeling — TenneT neemt deel aan de Single Day-Ahead Coupling (SDAC) en Single Intraday Coupling (SIDC) voor optimale allocatie van grensoverschrijdende transportcapaciteit. SDAC: Europese day-ahead marktkoppeling via EUPHEMIA-algoritme. SIDC: continue intraday handel via XBID-platform.", "market_regulation", "2024.1", "2024-01-01", "https://www.tennet.eu/nl/over-tennet/onze-taken/marktfacilitering"],

  // Frequency containment
  ["TenneT-FCR", "Frequency Containment Reserve (FCR)", "Frequency Containment Reserve (FCR) — Primaire reserve voor frequentiestabilisatie. Automatische activatie binnen 30 seconden bij frequentieafwijking. Gecontracteerd via gemeenschappelijk Europees FCR-platform. TenneT contracteert ca. 100-120 MW FCR-capaciteit.", "balancing", "2024.1", "2024-01-01", "https://www.tennet.eu/nl/balanceringsmarkten"],

  // Settlement
  ["TenneT-Settlement", "Settlement prices — onbalansprijzen", "Settlement prices (onbalansprijzen) — TenneT publiceert onbalansprijzen per imbalance settlement period (ISP) van 15 minuten. Twee componenten: opregelprijzen en afregelprijzen. Single pricing: langere zijde van de onbalans bepaalt de prijs. Gepubliceerd via TenneT transparency data.", "market_regulation", "2024.1", "2024-01-01", "https://www.tennet.eu/nl-en/grids-and-markets/transparency-data-netherlands/settlement-prices"],
];

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

type DecTuple = [string, string, string, string, string, string, string];

const allDecisions: DecTuple[] = [];

// Historical method decisions (pre-2022)
allDecisions.push(["MB-RNB-E-2017-2021", "Methodebesluit regionaal netbeheer elektriciteit 2017-2021", "Methodebesluit van de ACM voor de regionale netbeheerders elektriciteit voor de reguleringsperiode 2017-2021 (vierde reguleringsperiode). Bevat de methode voor vaststelling van de x-factor, efficiëntiebenchmark en vermogenskostenvergoeding.", "methodology", "2016-09-30", "Coteq, Enexis, Liander, RENDO, Stedin, Westland", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

allDecisions.push(["MB-RNB-G-2017-2021", "Methodebesluit regionaal netbeheer gas 2017-2021", "Methodebesluit van de ACM voor de regionale netbeheerders gas voor de reguleringsperiode 2017-2021.", "methodology", "2016-09-30", "Coteq, Enexis, Liander, RENDO, Stedin, Westland", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

allDecisions.push(["MB-TenneT-2017-2021", "Methodebesluit TenneT transport 2017-2021", "Methodebesluit van de ACM voor TenneT transport voor de reguleringsperiode 2017-2021.", "methodology", "2016-09-30", "TenneT TSO B.V.", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

allDecisions.push(["MB-GTS-2017-2021", "Methodebesluit GTS 2017-2021", "Methodebesluit van de ACM voor Gasunie Transport Services voor de reguleringsperiode 2017-2021.", "methodology", "2016-09-30", "Gasunie Transport Services B.V.", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

allDecisions.push(["MB-RNB-E-2014-2016", "Methodebesluit regionaal netbeheer elektriciteit 2014-2016", "Methodebesluit van de ACM voor de regionale netbeheerders elektriciteit voor de reguleringsperiode 2014-2016.", "methodology", "2013-09-30", "Coteq, Enexis, Liander, RENDO, Stedin, Westland", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

allDecisions.push(["MB-RNB-G-2014-2016", "Methodebesluit regionaal netbeheer gas 2014-2016", "Methodebesluit van de ACM voor de regionale netbeheerders gas voor de reguleringsperiode 2014-2016.", "methodology", "2013-09-30", "Coteq, Enexis, Liander, RENDO, Stedin, Westland", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

// Revenue cap decisions
allDecisions.push(["RC-RNB-E-2026", "Inkomstenbesluit regionale netbeheerders elektriciteit 2026", "Besluit van de ACM over de totale toegestane inkomsten van de regionale netbeheerders elektriciteit voor 2026. Jaarlijks vastgesteld op basis van het methodebesluit 2022-2026. Bepaalt het maximale bedrag dat netbeheerders gezamenlijk via nettarieven mogen innen.", "revenue_cap", "2025-11-15", "Coteq, Enexis, Liander, RENDO, Stedin, Westland", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

allDecisions.push(["RC-RNB-G-2026", "Inkomstenbesluit regionale netbeheerders gas 2026", "Besluit van de ACM over de totale toegestane inkomsten van de regionale netbeheerders gas voor 2026.", "revenue_cap", "2025-11-15", "Coteq, Enexis, Liander, RENDO, Stedin, Westland", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

allDecisions.push(["RC-TenneT-2026", "Inkomstenbesluit TenneT 2026", "Besluit van de ACM over de totale toegestane inkomsten van TenneT voor 2026. Gebaseerd op het methodebesluit TenneT transport en systeemtaken 2022-2026.", "revenue_cap", "2025-11-15", "TenneT TSO B.V.", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

allDecisions.push(["RC-GTS-2026", "Inkomstenbesluit GTS 2026", "Besluit van de ACM over de totale toegestane inkomsten van GTS voor 2026.", "revenue_cap", "2025-11-15", "Gasunie Transport Services B.V.", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

// Benchmark decisions
allDecisions.push(["BM-E-2026", "Benchmarkbesluit regionale netbeheerders elektriciteit 2026", "Benchmarkbesluit van de ACM: vergelijking van de efficiëntie van regionale netbeheerders elektriciteit. Bepaalt de individuele efficiëntiescores en x-factoren per netbeheerder. Jaarlijkse bijstelling op basis van actuele kostengegevens.", "benchmark", "2025-11-15", "Coteq, Enexis, Liander, RENDO, Stedin, Westland", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

allDecisions.push(["BM-G-2026", "Benchmarkbesluit regionale netbeheerders gas 2026", "Benchmarkbesluit van de ACM: vergelijking van de efficiëntie van regionale netbeheerders gas.", "benchmark", "2025-11-15", "Coteq, Enexis, Liander, RENDO, Stedin, Westland", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

// WACC decisions
allDecisions.push(["WACC-E-2022-2026", "WACC-besluit netbeheerders elektriciteit 2022-2026", "Besluit van de ACM over de vermogenskostenvergoeding (WACC — Weighted Average Cost of Capital) voor netbeheerders elektriciteit voor de reguleringsperiode 2022-2026. Bepaalt het rendement dat netbeheerders mogen verdienen op hun geïnvesteerd vermogen.", "methodology", "2021-09-30", "Alle netbeheerders elektriciteit", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

allDecisions.push(["WACC-G-2022-2026", "WACC-besluit netbeheerders gas 2022-2026", "Besluit van de ACM over de vermogenskostenvergoeding (WACC) voor netbeheerders gas voor de reguleringsperiode 2022-2026.", "methodology", "2021-09-30", "Alle netbeheerders gas", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);

// Tariff decisions — historical years for TenneT and GTS
for (const yr of [2024, 2023, 2022]) {
  allDecisions.push([`TB-TenneT-${yr}`, `Tarievenbesluit TenneT ${yr}`, `Tarievenbesluit van de ACM voor TenneT TSO B.V. ${yr}. Jaarlijks tarievenbesluit voor het landelijke hoogspanningsnet.`, "tariff", `${yr - 1}-12-01`, "TenneT TSO B.V.", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);
  allDecisions.push([`TB-GTS-${yr}`, `Tarievenbesluit GTS ${yr}`, `Tarievenbesluit van de ACM voor Gasunie Transport Services B.V. (GTS) ${yr}. Jaarlijks tarievenbesluit voor het landelijke gastransportnet.`, "tariff", `${yr - 1}-12-01`, "Gasunie Transport Services B.V.", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);
}

// Regional tariff decisions — historical
for (const yr of [2024, 2023]) {
  for (const nb of rnbE) {
    allDecisions.push([`TB-${nb}-E-${yr}`, `Tarievenbesluit ${nb} elektriciteit ${yr}`, `Tarievenbesluit van de ACM voor ${nb} Netbeheer B.V. elektriciteit ${yr}.`, "tariff", `${yr - 1}-12-01`, `${nb} Netbeheer B.V.`, "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);
    allDecisions.push([`TB-${nb}-G-${yr}`, `Tarievenbesluit ${nb} gas ${yr}`, `Tarievenbesluit van de ACM voor ${nb} Netbeheer B.V. gas ${yr}.`, "tariff", `${yr - 1}-12-01`, `${nb} Netbeheer B.V.`, "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);
  }
}

// Additional historical method and tariff decisions
for (const yr of [2022, 2021, 2020, 2019, 2018]) {
  for (const nb of rnbE) {
    allDecisions.push([`TB-${nb}-E-${yr}`, `Tarievenbesluit ${nb} elektriciteit ${yr}`, `Tarievenbesluit van de ACM voor ${nb} Netbeheer B.V. elektriciteit ${yr}.`, "tariff", `${yr - 1}-12-01`, `${nb} Netbeheer B.V.`, "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);
  }
}

for (const yr of [2022, 2021, 2020, 2019, 2018]) {
  for (const nb of rnbE) {
    allDecisions.push([`TB-${nb}-G-${yr}`, `Tarievenbesluit ${nb} gas ${yr}`, `Tarievenbesluit van de ACM voor ${nb} Netbeheer B.V. gas ${yr}.`, "tariff", `${yr - 1}-12-01`, `${nb} Netbeheer B.V.`, "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);
  }
}

for (const yr of [2021, 2020, 2019, 2018]) {
  allDecisions.push([`TB-TenneT-${yr}`, `Tarievenbesluit TenneT ${yr}`, `Tarievenbesluit van de ACM voor TenneT TSO B.V. ${yr}.`, "tariff", `${yr - 1}-12-01`, "TenneT TSO B.V.", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);
  allDecisions.push([`TB-GTS-${yr}`, `Tarievenbesluit GTS ${yr}`, `Tarievenbesluit van de ACM voor Gasunie Transport Services B.V. (GTS) ${yr}.`, "tariff", `${yr - 1}-12-01`, "Gasunie Transport Services B.V.", "https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/tariefregulering-besluitenoverzicht"]);
}

// Complaint/enforcement decisions
allDecisions.push(["ACM-Geschil-Congestie-2024", "Geschilbesluit congestiemanagement 2024", "Geschilbesluit van de ACM inzake congestiemanagement: geschillen tussen aangeslotenen en netbeheerders over deelname aan congestiemanagement en toewijzing van transportcapaciteit bij netschaarste.", "complaint", "2024-06-01", "Diverse aangeslotenen, TenneT, regionale netbeheerders", "https://www.acm.nl/nl/energie/toezicht-op-de-energiemarkt"]);

allDecisions.push(["ACM-Geschil-Aansluiting-2024", "Geschilbesluit aansluitingsweigering 2024", "Geschilbesluit van de ACM inzake weigering van netaansluiting door regionale netbeheerders vanwege netcongestie. ACM toetst of de weigering rechtmatig is op grond van de Energiewet en de systeemcode.", "complaint", "2024-09-01", "Diverse aanvragers, regionale netbeheerders", "https://www.acm.nl/nl/energie/toezicht-op-de-energiemarkt"]);

// Akkoord nieuwe methode (agreement)
allDecisions.push(["ACM-Akkoord-REG2027", "Akkoord netbeheerders en ACM nieuwe methode tariefregulering 2027-2031", "Akkoord tussen netbeheerders, brancheorganisaties en de ACM over de nieuwe methode voor tariefregulering voor de reguleringsperiode 2027-2031 (januari 2026). Belangrijkste wijzigingen: meer ruimte voor investeringen in netverzwaring en energietransitie, betere afstemming distributie kapitaalkosten gas bij dalend gebruik.", "methodology", "2026-01-15", "Netbeheer Nederland, Energie-Nederland, VEMW, ACM", "https://www.acm.nl/nl/publicaties/akkoord-netbeheerders-brancheorganisaties-en-acm-over-nieuwe-methode-tariefregulering"]);

// Market monitoring decisions
allDecisions.push(["ACM-Toezicht-Energiemarkt", "Toezicht op de energiemarkt — overzicht ACM", "Overzicht van het toezicht door de ACM op de energiemarkt: leveranciersvergunningen, prijstoezicht, consumentenbescherming, naleving codes, REMIT-toezicht (marktmanipulatie en handel met voorkennis), congestiemanagement, en samenwerking met ACER.", "market_monitoring", "2026-01-01", "ACM", "https://www.acm.nl/nl/energie/toezicht-op-de-energiemarkt"]);

allDecisions.push(["ACM-REMIT-Toezicht", "ACM REMIT-toezicht energiegroothandelsmarkt", "ACM als nationaal toezichthouder onder REMIT (Verordening EU 1227/2011). Toezicht op integriteit en transparantie van de groothandelsmarkt voor energie. Monitoring van verdachte handelstransacties, marktmanipulatie en handel met voorkennis op energie­beurzen (APX, TTF, ICE).", "market_monitoring", "2020-01-01", "ACM, ACER", "https://www.acm.nl/nl/energie/toezicht-op-de-energiemarkt"]);

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
