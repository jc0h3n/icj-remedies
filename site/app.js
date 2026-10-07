import { hbars, stackedHbars, dots, legend, fmtInt, fmtPct } from "./charts.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

const TABS = [["overview", "Remedies"], ["interim", "Provisional measures"], ["advisory", "Advisory opinions"], ["cases", "Every case"], ["about", "About"]];

// Outcome of a judgment on the merits, in fixed colour order.
const OUTCOMES = [
  ["breach", "Breach found", "--c1"],
  ["mixed", "Breaches on both sides", "--c2"],
  ["title", "Territory or boundary decided", "--c3"],
  ["no-breach", "Claims rejected", "--c4"],
  ["compensation", "Compensation fixed", "--c5"],
  ["declaratory", "Rights declared", "--c0"],
  ["dismissed", "No decision on the merits", "--c0"],
  ["interpretation", "Interpretation or revision", "--c0"],
];
const OUT = Object.fromEntries(OUTCOMES.map(([k, l, c]) => [k, { label: l, color: c }]));
const REMEDIES = [
  ["declaration", "Declaration of breach only"],
  ["satisfaction", "Declaration as satisfaction"],
  ["cessation", "Cessation"],
  ["restitution", "Restitution or withdrawal"],
  ["performance", "Specific performance"],
  ["compensation", "Compensation or reparation"],
  ["non-repetition", "Assurances of non-repetition"],
  ["negotiate", "Duty to negotiate"],
];
const REM = Object.fromEntries(REMEDIES);
const PM = { indicated: ["Measures indicated", "--c1"], partly: ["Some measures indicated", "--c3"], refused: ["Refused", "--c4"] };
const KINDS = {
  "non-aggravation": "Do not aggravate the dispute", "stop-conduct": "Stop or refrain from conduct", "protect-people": "Protect people (life, liberty, execution, genocide)",
  "preserve-evidence": "Preserve evidence", "access-aid": "Let aid or access through", "report": "Report back to the Court",
  property: "Protect property or premises", territory: "Forces, territory or border",
};
const STAGE = { ME: "Merits", CO: "Compensation", RI: "Interpretation or revision", PO: "Preliminary objections", PM: "Provisional measures", AO: "Advisory opinion", IV: "Intervention" };

let D, cases, decisions;
const view = document.getElementById("view");

async function main() {
  D = await (await fetch("data/icj.json")).json();
  cases = D.cases;
  decisions = cases.flatMap(c => c.decisions.map(d => ({ ...d, c })));
  document.getElementById("generated").textContent = ` Built ${D.built}.`;
  addEventListener("hashchange", render);
  addEventListener("resize", debounce(() => current !== "cases" && render(), 250));
  render();
}

let current;
function render() {
  const h = new URLSearchParams(location.hash.slice(1));
  current = TABS.some(t => t[0] === h.get("tab")) ? h.get("tab") : "overview";
  document.getElementById("tabs").innerHTML = TABS.map(([k, l], i) =>
    `${i ? `<span class="muted"> / </span>` : ""}<a href="#tab=${k}"${k === current ? ` class="on" aria-current="page"` : ""}>${l}</a>`).join("");
  ({ overview, interim, advisory, cases: caseList, about })[current](h);
}

const merits = () => decisions.filter(d => d.stage === "ME" || d.stage === "CO" || d.stage === "RI");
const caseLabel = c => c.name.replace(/\s+/g, " ");
const shortName = c => caseLabel(c).replace(/\s*\((?:[^()]|\([^()]*\))*\)\s*$/, "") || caseLabel(c);
const parties = c => (caseLabel(c).match(/\(((?:[^()]|\([^()]*\))*)\)\s*$/) || [])[1] || "";
const year = d => +d.date.slice(0, 4);
const fmtDate = s => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const money = ([cur, v]) => (cur === "GBP" ? "£" : "US$") + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
const tile = (label, value, sub = "") => `<div class="tile"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;
const chart = (id, title, note = "", wide = false) => `<section class="chart${wide ? " wide" : ""}"><h2>${title}</h2>${note ? `<p class="note">${note}</p>` : ""}<div class="body" id="${id}"></div></section>`;
const caseLink = c => `<a href="#tab=cases&case=${c.no}">${esc(shortName(c))}</a>`;

// ---------------------------------------------------------------- Remedies
function overview() {
  const m = merits();
  const judged = m.filter(d => d.stage === "ME");
  const found = judged.filter(d => d.o === "breach" || d.o === "mixed");
  const comp = m.filter(d => d.o === "compensation");
  const contentious = cases.filter(c => c.kind === "contentious");
  const reachedMerits = new Set(judged.filter(d => d.o !== "dismissed").map(d => d.c.no));
  const pm = decisions.filter(d => d.stage === "PM");
  const withRemedy = found.filter(d => d.r?.some(r => r !== "declaration" && r !== "satisfaction"));

  view.innerHTML = `
    <p class="summary">The Court has heard ${contentious.length} contentious cases since 1946. ${reachedMerits.size} reached a judgment on the merits, and in ${found.length} judgments it found that a state had broken international law. It went beyond saying so, ordering the state to stop, undo, perform or pay, in ${withRemedy.length}. It has fixed an amount of money only ${comp.length} times.</p>
    <div class="tiles">
      ${tile("Contentious cases", contentious.length, `${cases.length - contentious.length} advisory proceedings besides`)}
      ${tile("Merits judgments", judged.length, `in ${reachedMerits.size} cases`)}
      ${tile("Breach found", found.length, `${fmtPct(found.length / judged.length)} of merits judgments`)}
      ${tile("Compensation fixed", comp.length, comp.map(d => money(d.amt[0])).join(" · "))}
      ${tile("Provisional measures", pm.filter(d => d.pm !== "refused").length, `ordered in ${pm.length} decisions on requests`)}
    </div>
    <div class="grid2">
      ${chart("c-time", "Every judgment on the merits, by outcome", "One dot per judgment (merits, compensation, interpretation). Hover for the case and what was decided.", true)}
      ${chart("c-rem", "What the Court ordered when it found a breach", `Share of the ${found.length} judgments finding a breach that included each remedy. Most included more than one.`)}
      ${chart("c-refused", "What it was asked for and refused", "Number of merits and compensation judgments in which the Court rejected a request for each remedy.")}
      ${chart("c-decade", "Outcomes by decade", "Merits, compensation and interpretation judgments.")}
      ${chart("c-region", "Which states were found in breach, by region", "Merits judgments finding a breach, by the region of the respondent. Counter-claims and joined cases make this approximate.")}
    </div>
    <h2 class="section-title">Money the Court has awarded</h2>
    <p class="caveat">In eight decades the Court has put a figure on compensation four times. In other cases it held that reparation was owed but left the amount to the parties, and the question was settled, abandoned or is still open.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Case</th><th>Judgment</th><th class="num">Amount</th><th>For</th></tr></thead>
      <tbody>${comp.map(d => `<tr><td>${caseLink(d.c)}<div class="muted">${esc(parties(d.c))}</div></td><td>${fmtDate(d.date)}</td><td class="num money">${d.amt.map(money).join("<br>")}</td><td>${esc(d.s)}</td></tr>`).join("")}</tbody>
    </table></div>
    <h3>Reparation owed but never fixed by the Court</h3>
    <ul class="sources">${m.filter(d => d.r?.includes("compensation") && d.stage === "ME" && !comp.some(x => x.c.no === d.c.no)).map(d => `<li>${caseLink(d.c)} (${year(d)}): ${esc(d.s)}</li>`).join("")}</ul>`;

  // Timeline strip: rows are outcome groups.
  const rows = OUTCOMES.filter(([k]) => m.some(d => d.o === k)).map(([k, l]) => ({ key: k, label: l }));
  const el = document.getElementById("c-time");
  dots(el, m.map(d => ({
    x: year(d) + (+d.date.slice(5, 7) - 1) / 12, row: d.o, color: css(OUT[d.o]?.color || "--c0"),
    tip: `<b>${esc(shortName(d.c))}</b><br><span class="muted">${esc(parties(d.c))} · ${fmtDate(d.date)}</span><br>${esc(d.s || "")}`,
  })), { strip: true, rows: rows.map(r => ({ ...r, label: r.label.length > 18 ? r.label.split(" ").slice(0, 2).join(" ") + "…" : r.label })), xDomain: [1945, 2030], xTitle: "" });
  el.querySelectorAll("text.rowlab").forEach((t, i) => t.textContent = shortRow(rows[i].key));

  hbars(document.getElementById("c-rem"), REMEDIES.map(([k, l]) => ({ label: l, value: found.filter(d => d.r?.includes(k)).length / found.length }))
    .filter(i => i.value).sort((a, b) => b.value - a.value),
    { tipText: i => `<b>${esc(i.label)}</b><br>${Math.round(i.value * found.length)} of ${found.length} judgments finding a breach` });

  hbars(document.getElementById("c-refused"), REMEDIES.map(([k, l]) => ({ label: l, value: m.filter(d => d.d?.includes(k)).length, cases: m.filter(d => d.d?.includes(k)) }))
    .filter(i => i.value).sort((a, b) => b.value - a.value),
    { format: fmtInt, tipText: i => `<b>${esc(i.label)}</b> refused in:<br>${i.cases.map(d => `${esc(shortName(d.c))} (${year(d)})`).join("<br>")}` });

  const decades = [...new Set(m.map(d => Math.floor(year(d) / 10) * 10))].sort();
  stackedHbars(document.getElementById("c-decade"), decades.map(dec => ({
    label: `${dec}s`,
    segments: OUTCOMES.filter(([k]) => OUT[k].color !== "--c0").map(([k, l, c]) => ({ key: l, color: css(c), value: m.filter(d => d.o === k && Math.floor(year(d) / 10) * 10 === dec).length }))
      .concat([{ key: "Other", color: css("--c0"), value: m.filter(d => OUT[d.o]?.color === "--c0" && Math.floor(year(d) / 10) * 10 === dec).length }]),
  })), OUTCOMES.filter(([, , c]) => c !== "--c0").map(([, l, c]) => ({ label: l, color: css(c) })).concat([{ label: "Other", color: css("--c0") }]), "judgments");

  const byRegion = {};
  for (const d of found) for (const p of d.c.parties?.r || []) byRegion[p[2] || "Other"] = (byRegion[p[2] || "Other"] || 0) + 1;
  hbars(document.getElementById("c-region"), Object.entries(byRegion).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v })), { format: fmtInt });
}
const shortRow = k => ({ breach: "Breach", mixed: "Both sides", title: "Boundary", "no-breach": "Rejected", compensation: "Money", declaratory: "Declared", dismissed: "No merits", interpretation: "Interpret." }[k] || k);

// ---------------------------------------------------------------- Provisional measures
function interim() {
  const pm = decisions.filter(d => d.stage === "PM");
  const granted = pm.filter(d => d.pm !== "refused");
  const decades = [...new Set(pm.map(d => Math.floor(year(d) / 10) * 10))].sort();
  view.innerHTML = `
    <p class="summary">While a case is pending, a state can ask the Court to order interim measures to protect its rights. Since 1951 the Court has ruled on ${pm.length} such requests and ordered measures in ${granted.length}. Requests have multiplied: ${pm.filter(d => year(d) >= 2010).length} of them came after 2010.</p>
    <div class="tiles">
      ${tile("Requests decided", pm.length)}
      ${tile("Measures ordered", granted.length, fmtPct(granted.length / pm.length))}
      ${tile("Refused", pm.length - granted.length)}
      ${tile("Since 2010", pm.filter(d => year(d) >= 2010).length, "requests decided")}
    </div>
    <div class="grid2">
      ${chart("p-decade", "Requests by decade and outcome")}
      ${chart("p-kinds", "What the measures required", `Share of the ${granted.length} orders granting measures that included each kind (tagged from the operative text).`)}
    </div>
    <h2 class="section-title">Every order</h2>
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Case</th><th>Outcome</th><th>What it required</th></tr></thead><tbody>
    ${pm.slice().sort((a, b) => b.date.localeCompare(a.date)).map(d => `<tr><td style="white-space:nowrap">${d.date}</td><td>${caseLink(d.c)}<div class="muted">${esc(parties(d.c))}</div></td>
      <td><i class="key" style="background:${css(PM[d.pm][1])}"></i>${PM[d.pm][0]}</td>
      <td>${d.s ? esc(d.s) : esc(firstMeasure(d))}</td></tr>`).join("")}</tbody></table></div>`;
  stackedHbars(document.getElementById("p-decade"), decades.map(dec => ({
    label: `${dec}s`, segments: Object.entries(PM).map(([k, [l, c]]) => ({ key: l, color: css(c), value: pm.filter(d => d.pm === k && Math.floor(year(d) / 10) * 10 === dec).length })),
  })), Object.values(PM).map(([l, c]) => ({ label: l, color: css(c) })), "decisions");
  hbars(document.getElementById("p-kinds"), Object.entries(KINDS).map(([k, l]) => ({ label: l, value: granted.filter(d => d.kinds?.includes(k)).length / granted.length }))
    .filter(i => i.value).sort((a, b) => b.value - a.value));
}
function firstMeasure(d) {
  const p = d.points?.find(p => /\b(?:should|shall|must|indicates?|not such as|rejects|dismisses)\b/i.test(p.t));
  const t = (p?.t || "").replace(/^(?:By\s+\w+\s+votes?\s+to\s+\w+,?|Unanimously,?)\s*/i, "");
  return t.length > 260 ? t.slice(0, 257) + "…" : t;
}

// ---------------------------------------------------------------- Advisory opinions
function advisory() {
  const ao = decisions.filter(d => d.stage === "AO").sort((a, b) => b.date.localeCompare(a.date));
  const rem = ao.filter(d => d.r?.length);
  view.innerHTML = `
    <p class="summary">Advisory opinions answer questions from UN organs and agencies and bind no one. But some spell out remedies all the same: the Court has told states to withdraw, to stop building, to end an administration or to make reparation in ${rem.length} of its ${ao.length} opinions.</p>
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Opinion</th><th>Consequences stated</th><th>In brief</th></tr></thead><tbody>
    ${ao.map(d => `<tr><td style="white-space:nowrap">${d.date}</td><td>${caseLink(d.c)}</td><td>${(d.r || []).map(r => `<span class="pill">${esc(REM[r])}</span>`).join("") || `<span class="muted">—</span>`}</td><td>${esc(d.s || firstAnswer(d))}</td></tr>`).join("")}
    </tbody></table></div>`;
}
function firstAnswer(d) {
  const p = d.points?.filter(p => !/comply with the request|has jurisdiction to give/i.test(p.t)).at(0);
  const t = (p?.t || "").replace(/^(?:IS OF OPINION,?|By\s+\w+\s+votes?\s+to\s+\w+,?|Unanimously,?|\s)+/i, "");
  return t.length > 240 ? t.slice(0, 237) + "…" : t;
}

// ---------------------------------------------------------------- Every case
function caseList(h) {
  const q = (h.get("q") || "").toLowerCase();
  const open = +h.get("case") || null;
  const list = cases.slice().sort((a, b) => b.no - a.no).filter(c => !q || `${c.name} ${c.no}`.toLowerCase().includes(q));
  view.innerHTML = `
    <div class="table-tools"><input type="search" id="q" placeholder="Search cases or states" value="${esc(h.get("q") || "")}" aria-label="Search cases">
      <span class="muted">${list.length} of ${cases.length} cases · dots show each decision's outcome</span></div>
    ${legend([...OUTCOMES.filter(o => o[2] !== "--c0").map(([, l, c]) => ({ label: l, color: css(c) })), { label: "Measures ordered", color: css("--c1") }, { label: "Other", color: css("--c0") }])}
    <div id="list">${list.map(c => caseHtml(c, c.no === open)).join("")}</div>
    ${D.pending.length ? `<h2 class="section-title">Decisions not yet coded</h2><ul class="sources">${D.pending.map(p => `<li>${p.date}: case ${p.no}, ${esc(p.title)} ${esc(p.subtitle)} <a href="${p.url}">PDF</a></li>`).join("")}</ul>` : ""}`;
  const input = document.getElementById("q");
  input.addEventListener("input", debounce(() => {
    const p = new URLSearchParams({ tab: "cases" }); if (input.value) p.set("q", input.value);
    history.replaceState(null, "", "#" + p); caseList(p); const i = document.getElementById("q"); i.focus(); i.setSelectionRange(i.value.length, i.value.length);
  }, 200));
  if (open) document.querySelector(`details[data-no="${open}"]`)?.scrollIntoView({ block: "start" });
}
function dotColor(d) {
  if (d.stage === "PM") return css(d.pm === "refused" ? "--c4" : "--c1");
  if (d.stage === "PO") return css(d.o === "dismissed" ? "--c0" : "--axis");
  return css(OUT[d.o]?.color || "--c0");
}
function caseHtml(c, open) {
  const ds = c.decisions;
  const years = c.introduced ? `${c.introduced}–${c.concluded || "pending"}` : ds.length ? `${ds[0].date.slice(0, 4)}–${c.pending ? "pending" : ds.at(-1).date.slice(0, 4)}` : "";
  return `<details class="case" data-no="${c.no}"${open ? " open" : ""}>
    <summary><span class="no">${c.no}</span><span class="cname">${esc(caseLabel(c))}</span>
      <span class="meta"><span class="dots-row">${ds.map(d => `<i style="background:${dotColor(d)}" title="${esc(STAGE[d.stage] + ", " + d.date)}"></i>`).join("")}</span> ${years}${c.kind === "advisory" ? " · advisory" : ""}</span></summary>
    ${ds.length ? ds.map(decisionHtml).join("") : `<p class="decision muted">No judgment, opinion or provisional measures order: the case was withdrawn, settled or is still at the written stage.</p>`}
  </details>`;
}
function decisionHtml(d) {
  const tags = [
    ...(d.r || []).map(r => `<span class="pill">${esc(REM[r] || r)}</span>`),
    ...(d.d || []).map(r => `<span class="pill no" title="Asked for and refused">${esc(REM[r] || r)}</span>`),
    ...(d.amt || []).map(a => `<span class="pill">${money(a)}</span>`),
  ].join("");
  const label = d.stage === "PM" ? PM[d.pm][0] : d.stage === "PO" ? (d.o === "dismissed" ? "Case ended here" : "Case proceeds") : OUT[d.o]?.label || "";
  return `<div class="decision">
    <h3><span>${STAGE[d.stage]}, ${fmtDate(d.date)}</span><span class="muted"><i class="key" style="background:${dotColor(d)}"></i>${esc(label)}</span>${d.url ? `<a href="${d.url}">ICJ</a>` : ""}</h3>
    ${d.s ? `<p class="sum">${esc(d.s)}</p>` : ""}${tags ? `<div>${tags}</div>` : ""}
    ${d.points?.length ? `<details><summary class="muted" style="cursor:pointer;font-size:0.85em">Operative part (${d.points.length} points)</summary><ul class="points">${d.points.map(p => `<li>${p.l ? `<span class="lab">(${esc(p.l)})</span>` : ""}${esc(p.t.replace(/^(?:By\s+\w+\s+votes?\s+to\s+\w+,?|Unanimously,?)\s*/i, ""))} <span class="vote">${p.v === "u" ? "unanimous" : p.v ? `${p.v[0]}–${p.v[1]}` : ""}</span></li>`).join("")}</ul></details>` : ""}
    ${d.src === "hand" ? `<p class="muted" style="font-size:0.8em">Coded from the ICJ's summary; operative text not yet in the corpus.</p>` : ""}
  </div>`;
}

// ---------------------------------------------------------------- About
function about() {
  view.innerHTML = `<div style="max-width:78ch">
    <h2 class="section-title">What this shows</h2>
    <p>Every case on the International Court of Justice's lists, and for each decision what the Court did: whether it found a breach, decided a boundary, rejected the claims or never reached the merits, and which remedies it ordered or refused. Remedies follow the categories of the law of state responsibility: cessation, restitution, compensation, satisfaction (often a declaration that a breach occurred) and assurances of non-repetition, plus orders to perform a specific act and to negotiate.</p>
    <h2 class="section-title">How it was built</h2>
    <ul class="sources">
      <li><b>Text.</b> The operative part of every judgment, order and opinion to ${esc(D.corpus.cutoff)} comes from the Corpus of Decisions: International Court of Justice by Seán Fobbe (version ${esc(D.corpus.version)}, <a href="https://doi.org/${esc(D.corpus.doi)}">doi:${esc(D.corpus.doi)}</a>, CC0). A script finds each operative part ("For these reasons, THE COURT,…") and splits it into numbered points and votes.</li>
      <li><b>Outcomes and remedies.</b> Merits, compensation and interpretation judgments and advisory opinions are coded by hand from those points. Preliminary objection judgments and provisional measures orders are classified by rules and spot-checked. A remedy counts as "refused" when the Court rejected a specific request for it, in the operative part or in its reasoning.</li>
      <li><b>Newer decisions.</b> Decisions after the corpus are listed from the ICJ's case pages and coded by hand from the Court's published summaries; the site does not reproduce their text. Any decision the weekly update finds that has not been coded yet is listed at the foot of <a href="#tab=cases">Every case</a>.</li>
      <li><b>Updates.</b> A weekly job checks Zenodo for a new corpus version and the ICJ's case pages for new decisions.</li>
    </ul>
    <h2 class="section-title">Caveats</h2>
    <ul class="sources">
      <li>Coding compresses long judgments into a few categories. Read the operative text (under each decision) and the judgment itself before relying on any entry.</li>
      <li>The corpus text comes from OCR of older Reports, so some operative points split imperfectly.</li>
      <li>Joined cases (for example Costa Rica v. Nicaragua and Nicaragua v. Costa Rica) appear under each case number.</li>
      <li>"Breach found" includes breaches found on a counter-claim.</li>
    </ul>
    <h2 class="section-title">Sources</h2>
    <ul class="sources">
      <li>Fobbe, Seán. Corpus of Decisions: International Court of Justice (CD-ICJ). Zenodo. <a href="https://doi.org/10.5281/zenodo.3826444">doi:10.5281/zenodo.3826444</a>. Code: <a href="https://codeberg.org/seanfobbe/cd-icj">codeberg.org/seanfobbe/cd-icj</a>.</li>
      <li>International Court of Justice, <a href="https://www.icj-cij.org/list-of-all-cases">list of all cases</a> and <a href="https://www.icj-cij.org/pending-cases">pending cases</a>.</li>
      <li>Source code: <a href="https://github.com/jc0h3n/icj-remedies">github.com/jc0h3n/icj-remedies</a>.</li>
    </ul></div>`;
}

function debounce(f, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; }
main();
