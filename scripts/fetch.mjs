// Downloads the sources:
//  1. The newest version of the Corpus of Decisions: International Court of Justice (CD-ICJ, Seán Fobbe, CC0)
//     from Zenodo, and extracts the operative part of every majority decision into data/corpus.json.
//  2. The ICJ's own list of cases, and for every case still open or decided recently, the list of its
//     judgments, orders and advisory opinions (titles, dates, links) into data/icj-docs.json, so decisions
//     newer than the corpus show up and can be coded by hand. Only HTML pages are read; the ICJ's PDFs
//     sit behind a bot check and are not downloaded.
import fs from "node:fs";
import zlib from "node:zlib";
import { parseCsv } from "./csv.mjs";
import { dispositif } from "./dispositif.mjs";

const UA = "icj-remedies/1.0 (https://github.com/jc0h3n/icj-remedies)";
const BROWSER = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36", "Accept-Language": "en" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync("raw", { recursive: true });
fs.mkdirSync("data", { recursive: true });

async function step(name, fn) {
  try { await fn(); console.log("ok   ", name); }
  catch (e) { console.warn("FAIL ", name, "-", e.message, "(keeping the last good copy in data/)"); }
}

// Reads the single entry of a zip file (CD-ICJ ships one CSV per zip).
function unzipFirst(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const cd = buf.readUInt32LE(eocd + 16);
  const method = buf.readUInt16LE(cd + 10), size = buf.readUInt32LE(cd + 20), local = buf.readUInt32LE(cd + 42);
  const name = buf.toString("utf8", cd + 46, cd + 46 + buf.readUInt16LE(cd + 28));
  const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  const data = buf.subarray(start, start + size);
  return { name, data: method === 8 ? zlib.inflateRawSync(data) : data };
}

await step("CD-ICJ corpus (Zenodo)", async () => {
  const rec = await (await fetch("https://zenodo.org/api/records/3826444", { headers: { "User-Agent": UA } })).json();
  const file = rec.files.find(f => /_EN_CSV_BEST_FULL\.zip$/.test(f.key));
  if (!file) throw new Error("no EN_CSV_BEST_FULL file in the newest record");
  const csvPath = `raw/${file.key.replace(/\.zip$/, ".csv")}`;
  if (!fs.existsSync(csvPath)) {
    const buf = Buffer.from(await (await fetch(file.links.self, { headers: { "User-Agent": UA } })).arrayBuffer());
    fs.writeFileSync(csvPath, unzipFirst(buf).data);
  }
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8")).filter(r => r.opinion === "0");
  const docs = [];
  for (const r of rows) {
    const d = dispositif(r.text);
    docs.push({
      id: r.doc_id.replace(/_EN\.txt$/, ""), caseno: +r.caseno, short: r.shortname, name: r.fullname,
      applicant: r.applicant, respondent: r.respondent, date: r.date, type: r.doctype, stage: r.stage,
      // Orders that set time-limits and the like carry no operative "THE COURT," part; keep only those that do.
      disp: d && d.length < 40000 ? d : null,
      head: r.doctype === "ORD" ? r.text.slice(0, 3000).replace(/\s+/g, " ") : undefined,
    });
  }
  fs.writeFileSync("data/corpus.json", JSON.stringify({
    version: rec.metadata.version, doi: rec.doi, published: rec.metadata.publication_date,
    cutoff: docs.reduce((m, d) => d.date > m ? d.date : m, ""), docs: docs.filter(d => d.disp || d.type !== "ORD"),
  }));
});

// Party names and UN regions for the ISO codes CD-ICJ uses.
await step("Country codes (CD-ICJ source data)", async () => {
  const csv = await (await fetch("https://codeberg.org/seanfobbe/cd-icj/raw/branch/main/data/CD-ICJ_Source_CountryCodes.csv", { headers: { "User-Agent": UA } })).text();
  const rows = parseCsv(csv);
  if (rows.length < 50) throw new Error("too few rows");
  fs.writeFileSync("data/countries.json", JSON.stringify(Object.fromEntries(rows.map(r => [r.ISO3, [r.name, r.region, r.subregion]]))));
});

// ICJ case list: number, title, year introduced, year concluded (blank while pending), type.
await step("ICJ list of cases", async () => {
  const html = await (await fetch("https://www.icj-cij.org/list-of-all-cases", { headers: BROWSER })).text();
  const cases = [];
  for (const row of html.matchAll(/<tr>\s*<td[^>]*>\s*<a href="\/?case\/(\d+)"><p>([\s\S]*?)<\/p>\s*<\/a>[\s\S]*?<\/tr>/g)) {
    const cells = [...row[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
    cases.push({ no: +row[1], title: decode(row[2].replace(/<[^>]+>/g, "").trim()), introduced: +cells[1] || null, concluded: +cells[2] || null, kind: cells[3] || "" });
  }
  if (cases.length < 150) throw new Error(`only ${cases.length} cases parsed`);
  // The full list leaves out pending cases; they have their own page.
  await sleep(1500);
  const pend = await (await fetch("https://www.icj-cij.org/pending-cases", { headers: BROWSER })).text();
  for (const m of pend.matchAll(/<a href="\/?case\/(\d+)"><p>([\s\S]*?)<\/p>\s*<\/a>/g)) {
    if (cases.some(c => c.no === +m[1])) continue;
    const title = decode(m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
    cases.push({ no: +m[1], title, introduced: null, concluded: null, kind: /advisory|obligations of|legal consequences|right to strike/i.test(title) && !/\bv\.\s/.test(title) ? "Advisory" : "Contentious", pending: true });
  }
  cases.sort((a, b) => a.no - b.no);
  fs.writeFileSync("data/icj-cases.json", JSON.stringify(cases, null, 1));
});

// Decisions per case, for cases that are pending, concluded since the corpus cutoff year, or newer than it.
await step("ICJ decisions since the corpus", async () => {
  const cases = JSON.parse(fs.readFileSync("data/icj-cases.json", "utf8"));
  const corpus = JSON.parse(fs.readFileSync("data/corpus.json", "utf8"));
  const cutYear = +corpus.cutoff.slice(0, 4);
  const maxNo = Math.max(...corpus.docs.map(d => d.caseno));
  const want = cases.filter(c => !c.concluded || c.concluded >= cutYear || c.no > maxNo);
  const out = [];
  for (const c of want) {
    for (const kind of ["judgments", "orders", "advisory-opinions"]) {
      await sleep(1500);
      const res = await fetch(`https://www.icj-cij.org/case/${c.no}/${kind}`, { headers: BROWSER });
      if (!res.ok) continue;
      const html = await res.text();
      for (const m of html.matchAll(/<div class="cases-document">([\s\S]*?)(?=<div class="cases-document">|<\/main>)/g)) {
        const link = m[1].match(/href="([^"]+?-(\d{8})-(jud|ord|adv)-(\d\d)-00-en\.pdf)"[^>]*>\s*<p>([\s\S]*?)<\/p>/);
        if (!link) continue;
        const sub = (m[1].match(/<h6 class="other-title[^"]*">([\s\S]*?)<\/h6>/) || [])[1];
        const d = link[2];
        out.push({ caseno: c.no, date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`, type: link[3].toUpperCase(), seq: +link[4],
          title: decode(link[5].replace(/<[^>]+>/g, "").trim()), subtitle: sub ? decode(sub.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()) : "",
          url: link[1].startsWith("http") ? link[1] : `https://www.icj-cij.org${link[1]}` });
      }
    }
  }
  if (!out.length) throw new Error("no documents parsed");
  out.sort((a, b) => a.date.localeCompare(b.date) || a.caseno - b.caseno);
  fs.writeFileSync("data/icj-docs.json", JSON.stringify(out, null, 1));
});

// Permanent Court of International Justice: its published series list every decision with a link.
await step("PCIJ series (judgments, orders, advisory opinions)", async () => {
  const out = [];
  for (const s of ["a", "b", "ab"]) {
    await sleep(1500);
    const html = await (await fetch(`https://www.icj-cij.org/pcij-series-${s}`, { headers: BROWSER })).text();
    for (const block of html.split(/<h3>/).slice(1)) {
      const ref = block.match(/^([^<]+)<\/h3>/)[1].trim();
      const docs = [...block.matchAll(/href="([^"]+\.pdf)"[^>]*>([^<]+)<\/a>/g)].map(m => [decode(m[2].trim()), new URL(m[1], "https://www.icj-cij.org").href])
        .filter(([t]) => /^(Judgment|Order|Advisory Opinion)/i.test(t));
      out.push({ ref, docs });
    }
  }
  if (out.length < 70) throw new Error(`only ${out.length} PCIJ entries`);
  fs.writeFileSync("data/pcij-docs.json", JSON.stringify(out, null, 1));
});

function decode(s) {
  return s.replace(/&amp;/g, "&").replace(/&#039;|&#39;|&rsquo;/g, "’").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
