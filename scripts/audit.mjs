// Cross-checks the hand coding against each decision's operative text and prints the decisions that disagree.
// node scripts/audit.mjs [--all]   (needs site/data/icj.json from build.mjs)
import fs from "node:fs";

const j = JSON.parse(fs.readFileSync("site/data/icj.json", "utf8"));
const all = process.argv.includes("--all");
// Words in the operative text that signal each coded remedy
const SIGNS = {
  cessation: /\bcease|cessation|put an end|bring to an end|end its|revoke|halt|refrain from|discontinue/i,
  restitution: /restitution|restore|return|withdraw|evacuat|remove its|cancel|release|annul|cease to have effect/i,
  compensation: /compensat|reparation|indemnit|\bpay\b|US\$|£|francs/i,
  performance: /shall\b|must\b|obligation to|is under an? obligation|review and reconsideration|submit the case|negotiat|take (all|effective)|give effect|transfer/i,
  "non-repetition": /non-repetition|assurances|guarantees|commitment/i,
  satisfaction: /satisfaction/i,
  negotiate: /negotiat|consult|co-?operat/i,
  declaration: /./,
};
const BREACH = /(has|have|had)\s+(?:thereby\s+|also\s+)?(?:\w+\s+)?(violated|breached|failed|acted\s+in\s+breach|not\s+acted\s+in\s+conformity|not\s+complied|deprived|engaged)|in breach of|in violation of|not in conformity|not acting in accordance|is responsible/i;
const NOBREACH = /(has|have|had|did)\s+not\s+(?:\w+\s+)?(violated|breached|committed|been complicit|acted contrary)|rejects (all|the) (other )?(submissions|claims?)|cannot be upheld|rejects .{0,40}claim/i;

let n = 0;
for (const c of j.cases) for (const d of c.decisions) {
  if (!d.points?.length || !["ME", "CO", "RI", "AO"].includes(d.stage)) continue;
  const text = d.points.map(p => p.t).join(" • ");
  const flags = [];
  for (const r of d.r || []) if (SIGNS[r] && !SIGNS[r].test(text)) flags.push(`coded ${r}, no sign in text`);
  if (["breach", "mixed"].includes(d.o) && !BREACH.test(text)) flags.push(`coded ${d.o}, no breach finding in text`);
  if (d.o === "no-breach" && BREACH.test(text) && !NOBREACH.test(text)) flags.push("coded no-breach, text finds a breach");
  if (d.o !== "advisory" && /compensat|reparation/i.test(text) && !(d.r || []).includes("compensation") && !(d.d || []).includes("compensation") && d.o !== "compensation") flags.push("text mentions compensation/reparation, not coded");
  if (/satisfaction/i.test(text) && !(d.r || []).includes("satisfaction")) flags.push("text mentions satisfaction, not coded");
  if (/non-repetition|assurances|guarantees/i.test(text) && !(d.r || []).includes("non-repetition") && !(d.d || []).includes("non-repetition")) flags.push("text mentions assurances, not coded");
  if (/\bcease\b|cessation/i.test(text) && !(d.r || []).includes("cessation") && !(d.d || []).includes("cessation")) flags.push("text mentions cessation, not coded");
  if (!flags.length && !all) continue;
  n++;
  console.log(`\n=== ${c.court} ${c.no} ${d.date} ${d.stage} o=${d.o} r=[${(d.r || []).join(",")}] d=[${(d.d || []).join(",")}]  ${c.name.slice(0, 70)}`);
  if (flags.length) console.log("FLAGS: " + flags.join("; "));
  console.log("CODED: " + (d.s || ""));
  console.log("TEXT:  " + text.slice(0, 1600));
}
console.log(`\n${n} decisions ${all ? "listed" : "flagged"}`);
