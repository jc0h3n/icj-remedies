// Builds site/data/icj.json: every ICJ case with its decisions, what each decision did, and the remedies.
//  - CD-ICJ corpus decisions: operative points extracted and machine-tagged; merits, compensation and
//    advisory decisions then coded by hand in data/coding.json.
//  - Decisions newer than the corpus: hand-coded in data/recent.json; any not yet coded are listed as pending.
import fs from "node:fs";
import { points } from "./dispositif.mjs";
import { classify, pmOutcome } from "./classify.mjs";
import { clean } from "./dispositif.mjs";

const read = f => JSON.parse(fs.readFileSync(f, "utf8"));
const corpus = read("data/corpus.json");
const coding = read("data/coding.json");
const recent = read("data/recent.json");
const icjCases = fs.existsSync("data/icj-cases.json") ? read("data/icj-cases.json") : [];
const icjDocs = fs.existsSync("data/icj-docs.json") ? read("data/icj-docs.json") : [];
const countries = fs.existsSync("data/countries.json") ? read("data/countries.json") : {};

const PROCEDURAL = /time-limit|discontinuance|composition|appointment|intervention|suspension|joinder|removal|withdrawal|experts?\b|counter-claim|admissibility of the declaration|organization of the procedure/i;
const cases = new Map();
const caseOf = no => {
  if (!cases.has(no)) cases.set(no, { no, decisions: [] });
  return cases.get(no);
};

for (const d of corpus.docs) {
  const c = caseOf(d.caseno);
  if (!c.first || d.date < c.first) c.first = d.date;
  c.name ??= d.name; c.applicant ??= d.applicant; c.respondent ??= d.respondent;
  const key = `${d.caseno}:${d.date}`;
  const dec = { date: d.date, type: d.type, src: "corpus", id: d.id };
  if (d.disp) {
    const order = d.type === "ORD";
    dec.points = points(d.disp).map(p => ({ l: p.label, t: p.text, v: p.vote, g: classify(p.text, { order, advisory: d.type === "ADV", stage: d.stage }) }));
  }
  if (d.type === "ORD") {
    const text = clean(d.disp);
    if (!/(?:provisional|interim)\s+measures|\bindicat/i.test(text) || /special\s+Chamber/i.test(text)) continue;
    const pm = pmOutcome(text);
    if (pm.outcome === "other") pm.outcome = /\b(?:reaffirms|confirms)\b/i.test(text) ? "indicated" : "refused";
    Object.assign(dec, { stage: "PM", pm: pm.outcome, kinds: pm.kinds }, coding[key] || {});
  } else if (d.type === "ADV") {
    Object.assign(dec, { stage: "AO", o: "advisory", r: [] }, coding[key] || {});
  } else if (d.stage === "PO") {
    const tags = new Set(dec.points?.flatMap(p => p.g) || []);
    dec.stage = "PO";
    dec.o = tags.has("jurisdiction") ? (tags.has("no-jurisdiction") ? "proceeds" : "proceeds") : tags.has("no-jurisdiction") ? "dismissed" : "proceeds";
    Object.assign(dec, coding[key] || {});
  } else if (d.stage === "IN") {
    dec.stage = "IV"; dec.o = "intervention";
  } else {
    const code = coding[key];
    if (!code) console.warn("not hand-coded:", key, d.id);
    Object.assign(dec, { stage: code?.o === "compensation" ? "CO" : code?.o === "interpretation" ? "RI" : "ME" }, code || { o: "uncoded", r: [] });
  }
  c.decisions.push(dec);
}

// Decisions after the corpus.
const docByKey = new Map(icjDocs.map(x => [`${x.caseno}:${x.date}`, x]));
for (const [key, code] of Object.entries(recent)) {
  if (key.startsWith("_")) continue;
  const [no, date] = key.split(":");
  const doc = docByKey.get(key);
  const stage = code.kind === "ORD" ? "PM" : code.kind === "ADV" ? "AO" : code.o === "intervention" ? "IV" : code.o === "proceeds" || code.o === "dismissed" ? "PO" : "ME";
  caseOf(+no).decisions.push({ date, type: code.kind, src: "hand", stage, url: doc?.url, ...code });
}
const pending = icjDocs.filter(x => x.date > corpus.cutoff && !recent[`${x.caseno}:${x.date}`] && !PROCEDURAL.test(x.subtitle))
  .map(x => ({ no: x.caseno, date: x.date, type: x.type, title: x.title, subtitle: x.subtitle, url: x.url }));

// Case titles, parties and status from the ICJ's list.
// Every case on the ICJ's lists appears, including those with no substantive decision yet (or ever).
for (const k of icjCases) {
  const c = caseOf(k.no);
  c.name = k.title; c.introduced = k.introduced; c.concluded = k.concluded; c.pending = !k.concluded;
  c.kind = /advis/i.test(k.kind) ? "advisory" : "contentious";
}
for (const c of cases.values()) {
  c.kind ??= c.decisions.some(d => d.type === "ADV") ? "advisory" : "contentious";
  c.decisions.sort((a, b) => a.date.localeCompare(b.date));
  c.year = c.introduced || +(c.decisions[0]?.date || c.first || "0").slice(0, 4) || null;
  delete c.first;
  if (!c.applicant && c.kind === "contentious") {
    const m = c.name.match(/\(([^()]+?)\s+v\.\s+([^():]+?)(?::[^()]*)?\)\s*$/);
    if (m) { c.applicantName = m[1]; c.respondentName = m[2]; }
  }
}

const name = code => countries[code]?.[0] || code;
const region = code => countries[code]?.[1] || null;
const out = [...cases.values()].sort((a, b) => a.no - b.no).map(c => ({
  ...c,
  court: "ICJ",
  parties: c.kind === "contentious"
    ? { a: (c.applicant || "").split("-").filter(Boolean).map(x => [x, name(x), region(x)]), r: (c.respondent || "").split("-").filter(x => x && x !== "NA").map(x => [x, name(x), region(x)]) }
    : { body: c.applicant },
}));

// The Permanent Court of International Justice (1922–1946), coded by hand in data/pcij.json. Each decision is
// linked to its document in the PCIJ series by matching the date in the document's title.
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, jully: 7, august: 8, september: 9, october: 10, november: 11, december: 12, "décember": 12 };
const isoOf = title => {
  const m = title.match(/(\d{1,2}) (\p{L}+) (\d{4})/u);
  return m && MONTHS[m[2].toLowerCase()] ? `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
};
const pcijDocs = fs.existsSync("data/pcij-docs.json") ? read("data/pcij-docs.json") : [];
for (const c of read("data/pcij.json").cases) {
  const docs = pcijDocs.filter(d => c.refs.includes(d.ref)).flatMap(d => d.docs.map(([t, url]) => ({ t, url, date: isoOf(t), ref: d.ref })));
  const decisions = c.decisions.map(d => {
    const doc = docs.find(x => x.date === d.date && (d.type === "ORD" ? /^Order/i.test(x.t) : d.type === "ADV" ? /^Advisory/i.test(x.t) : /^Judgment/i.test(x.t)))
      || docs.find(x => x.date === d.date);
    if (!doc) console.warn(`PCIJ ${c.no} ${d.date}: no document link found`);
    return { src: "hand", ...d, url: doc?.url, series: doc?.ref };
  }).sort((a, b) => a.date.localeCompare(b.date));
  const years = [...decisions.map(d => +d.date.slice(0, 4)), ...docs.map(d => +(d.date || "0").slice(0, 4)).filter(Boolean)];
  out.push({ no: c.no, name: c.name, kind: c.kind, court: "PCIJ", refs: c.refs, decisions,
    year: years.length ? Math.min(...years) : null, introduced: years.length ? Math.min(...years) : null,
    concluded: years.length ? Math.max(...years) : null, pending: false, parties: {} });
}

fs.mkdirSync("site/data", { recursive: true });
const data = {
  built: new Date().toISOString().slice(0, 10),
  corpus: { version: corpus.version, doi: corpus.doi, cutoff: corpus.cutoff },
  cases: out, pending,
};
fs.writeFileSync("site/data/icj.json", JSON.stringify(data));
const all = out.flatMap(c => c.decisions);
console.log(`${out.length} cases, ${all.length} decisions (${all.filter(d => d.stage === "ME" || d.stage === "CO").length} merits/compensation, ${all.filter(d => d.stage === "PM").length} provisional measures, ${all.filter(d => d.stage === "AO").length} advisory), ${pending.length} awaiting coding; ${(fs.statSync("site/data/icj.json").size / 1024).toFixed(0)} KB`);
