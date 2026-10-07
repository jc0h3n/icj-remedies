// Tags each operative point of an ICJ decision with what the Court did in it. Rule-based and
// deliberately conservative; data/overrides.json corrects individual points after reading them.

// Order matters only for display. Each tag: [key, label, group, test(text, ctx)].
export const TAGS = [
  // Remedies the Court ordered or declared
  ["cessation", "Cessation", "remedy", t => /\b(?:cease|cessation|put\s+an?\s+end|discontinue|desist|bring\s+to\s+an\s+end|end\s+its\s+administration|terminate\s+(?:forthwith|immediately))\b/i.test(t) && !denied(t)],
  ["restitution", "Restitution", "remedy", t => /\b(?:restitution|restore|return\s+to|be\s+returned|shall\s+return|release|re-?establish|cancel|revoke|annul|withdraw(?:al)?\s+(?:of\s+)?(?:its|all|the)\s+(?:military|police|forces|troops|personnel|administration)|evacuat)/i.test(t) && !denied(t) && !pmOnly(t)],
  ["compensation", "Compensation", "remedy", t => /\b(?:compensation|indemnity|make\s+reparation|reparation\s+(?:is\s+)?due|pay\b|paid\b|US\s?\$|£|\bdollars\b|sterling)/i.test(t) && !denied(t)],
  ["performance", "Specific performance", "remedy", t => /\b(?:review\s+and\s+reconsideration|shall\s+(?:immediately\s+)?(?:take|adopt|provide|submit|ensure|implement|enact|allow|comply|grant|transfer|hand\s+over|deliver)|is\s+under\s+(?:an|the)\s+obligation\s+to\s+(?:take|provide|submit|ensure|allow|transfer|enact|comply)|must\s+(?:take|provide|submit|ensure))/i.test(t) && !denied(t)],
  ["non-repetition", "Assurances of non-repetition", "remedy", t => /\b(?:assurances?|guarantees?)\b[^.;]{0,80}\bnon-?repetition\b|\bnon-?repetition\b/i.test(t) && !denied(t)],
  ["satisfaction", "Satisfaction or declaration", "remedy", t => /\b(?:constitutes?\s+(?:in\s+itself\s+)?(?:appropriate\s+)?satisfaction|satisfaction)\b/i.test(t) && !denied(t)],
  ["negotiate", "Duty to negotiate", "remedy", t => /\bnegotiat|\bco-?operate\b|\bconsult\b/i.test(t) && /\b(?:obligation|shall|must|bound|duty|good\s+faith)\b/i.test(t) && !denied(t)],
  ["remedy-reserved", "Reparation to be settled later", "remedy", t => /\b(?:failing\s+agreement|reserves?\s+(?:for\s+this\s+purpose\s+)?the\s+subsequent\s+procedure|amount\s+of\s+(?:such\s+)?(?:compensation|reparation)[^.;]*\b(?:settled|determined)\s+by\s+the\s+Court)/i.test(t)],
  ["remedy-denied", "Remedy refused", "remedy", t => denied(t)],
  // Provisional measures
  ["pm-indicated", "Provisional measures indicated", "interim", (t, c) => c.order && /\b(?:indicates?|shall\s+(?:take|refrain|ensure|immediately|not|each|both|continue|prevent|allow|submit|release|withdraw|cease|suspend)|should\s+(?:take|refrain|ensure|immediately|not|each|both|continue|prevent|allow))\b/i.test(t) && !/\b(?:rejects|not\s+such\s+as\s+to\s+require|no\s+(?:need|occasion|ground)|declines|dismisses|reject)\b/i.test(t)],
  ["non-aggravation", "Do not aggravate the dispute", "interim", (t, c) => c.order && /\baggravat|\bextend\s+the\s+dispute/i.test(t)],
  ["report", "Report to the Court", "interim", (t, c) => /\bsubmit\s+(?:a\s+)?report|\breport\s+to\s+the\s+Court/i.test(t)],
  ["pm-rejected", "Provisional measures refused", "interim", (t, c) => c.order && /\b(?:rejects?|dismiss(?:es)?)\b[^.;]{0,140}\b(?:provisional|interim)\s+measures|\bnot\s+such\s+as\s+to\s+require\b|\bno\s+(?:need|occasion|ground)\s+to\s+indicate|\bdeclines?\s+to\s+indicate|\bcannot\s+indicate|\b(?:provisional|interim)\s+measures[^.;]{0,80}\b(?:rejected|refused)/i.test(t)],
  // Merits findings
  ["breach", "Breach found", "merits", t => /\b(?:has|have|had)\s+(?:thereby\s+|also\s+)?(?:\w+\s+)?(?:violated|breached|failed|acted\s+(?:in\s+breach|against|contrary|in\s+violation)|not\s+acted\s+in\s+conformity|not\s+complied|not\s+(?:fulfilled|discharged)|committed\s+acts|infringed|deprived|engaged\s+its\s+(?:international\s+)?responsibility)|\b(?:breached|violated|failed\s+to\s+comply\s+with|in\s+breach\s+of|in\s+violation\s+of)\b|\bis\s+(?:internationally\s+)?responsible\b|\bis\s+under\s+an\s+obligation\s+to\s+(?:cease|make\s+reparation)|\bwas\s+not\s+(?:made\s+)?in\s+conformity|\bnot\s+in\s+accordance\s+with\s+(?:international\s+law|its\s+obligations)/i.test(t) && !noBreach(t)],
  ["no-breach", "No breach found", "merits", t => noBreach(t)],
  ["claims-rejected", "Claims rejected", "merits", t => /\b(?:rejects|dismisses)\s+(?:all\s+(?:the\s+)?other\s+|the\s+(?:other\s+|remaining\s+)?|all\s+(?:the\s+)?)?(?:submissions|claims?|counter-?claims?|requests?)\b/i.test(t) && !/objection/i.test(t) && !denied(t)],
  ["title", "Sovereignty or boundary", "merits", t => /\b(?:sovereignty\s+over|belongs?\s+to|boundary|frontier|delimitation|delimit|maritime\s+(?:boundary|areas?)|continental\s+shelf|exclusive\s+economic\s+zone|line\s+(?:of|which|joining|connecting|runs|follows)|geodetic|coordinates|territorial\s+sea|equidistance|course\s+of\s+the\s+(?:line|frontier|boundary)|sovereign\s+over)\b/i.test(t)],
  ["interpretation", "Interpretation or revision", "merits", (t, c) => c.stage === "IN" || /\b(?:revision|interpretation)\b/i.test(t) && /\b(?:request|application)\b/i.test(t)],
  // Jurisdiction and admissibility
  ["no-jurisdiction", "No jurisdiction or inadmissible", "jurisdiction", t => /\b(?:(?:has|have)\s+no\s+jurisdiction|lacks?\s+jurisdiction|without\s+jurisdiction|not\s+competent|cannot\s+(?:proceed|entertain|adjudicate)|(?:is|are)\s+(?:in)?admissible\b(?<=inadmissible)|inadmissible|upholds?\s+the\s+(?:\w+\s+)?(?:preliminary\s+)?objection|no\s+longer\s+has\s+any\s+object|no\s+further\s+pronouncement|without\s+object|removed?\s+from\s+the\s+(?:general\s+)?list|not\s+called\s+upon\s+to\s+give\s+a\s+decision)/i.test(t)],
  ["jurisdiction", "Jurisdiction upheld", "jurisdiction", t => /\b(?:(?:has|have)\s+jurisdiction|is\s+competent|rejects?\s+(?:the\s+)?(?:\w+\s+){0,3}(?:preliminary\s+)?objections?|(?:is|are)\s+admissible|competent\s+to\s+(?:entertain|adjudicate)|(?:application|claims?)\s+(?:is|are)\s+admissible)/i.test(t) && !/\bno\s+jurisdiction|inadmissible|not\s+competent/i.test(t)],
  ["advisory-answer", "Advisory answer", "advisory", (t, c) => c.advisory],
];

function denied(t) {
  return /\b(?:rejects|dismisses|declines|refuses|does\s+not\s+(?:uphold|accept)|cannot\s+(?:uphold|accept)|not\s+(?:entitled|necessary|appropriate|warranted))\b[^.;]{0,160}\b(?:compensation|reparation|restitution|guarantees?|assurances?|non-repetition|satisfaction|costs|interest|cessation|request\s+that|requests?\s+(?:of|by|made)|submissions?\s+(?:on|concerning|relating\s+to)\s+(?:reparation|remed))/i.test(t)
    || /\brejects\s+the\s+request\s+(?:of|by|made\s+by)\s+[^.;]{0,120}\bthat\b/i.test(t);
}
function noBreach(t) {
  return /\b(?:has|have|had|did)\s+not\s+(?:\w+\s+)?(?:violated|breached|violate|breach|acted\s+in\s+breach|committed|conspired|been\s+complicit|failed|infringed)|\bno\s+(?:breach|violation)\b|\bcannot\s+be\s+held\s+responsible|\bnot\s+(?:been\s+)?established\s+that\b[^.;]{0,120}\b(?:violated|breached|responsible)|\bnot\s+responsible\b/i.test(t);
}
function pmOnly(t) { return false; }

export function classify(text, ctx) {
  const tags = [];
  for (const [key, , , test] of TAGS) if (test(text, ctx)) tags.push(key);
  // A merits point that orders a remedy already implies the breach; a "rejects claims" point is not a breach.
  return tags;
}

// Money awarded: "US$225,000,000", "£843,947", "120,000 United States dollars".
export function amounts(text) {
  const out = [];
  for (const m of text.matchAll(/(?:US\s?\$\s?|USD\s?)([\d,.]+(?:\s?million)?)|£\s?([\d,.]+)|([\d,.]{4,})\s+(?:United\s+States\s+dollars|US\s+dollars|pounds\s+sterling)/gi)) {
    const raw = (m[1] || m[2] || m[3]).replace(/,/g, "");
    let v = parseFloat(raw.replace(/\s?million/, "")); if (/million/.test(raw)) v *= 1e6;
    if (!isFinite(v) || v < 1000) continue;
    out.push({ currency: m[2] || /pounds/i.test(m[0]) ? "GBP" : "USD", value: v });
  }
  return out;
}

// Provisional measures orders, judged as a whole: did the Court indicate measures, and of what kind?
export function pmOutcome(disp) {
  const t = disp.replace(/\s+/g, " ");
  const refused = /\bnot\s+such\s+as\s+to\s+require|\b(?:rejects|dismisses)\s+the\s+(?:\w+\s+){0,6}request[^.;]{0,140}?(?:provisional|interim|indicat|modif)|\bno\s+(?:need|occasion|ground)\s+to\s+indicate|\bdeclines?\s+to\s+indicate|\bcannot\s+(?:accede|indicate)|\bremoved\s+from\s+the\s+(?:general\s+)?list|\bmanifest(?:ly)?\s+lack/i.test(t);
  const granted = /(?<!not\s|to\s)\bindicates?\b|\bmodif(?:y|ies)\s+the\s+measures|\b(?:should|shall|must)\s+(?:each\s+|both\s+|immediately\s+|forthwith\s+|continue\s+to\s+|also\s+)?(?:take|refrain|ensure|not\b|cease|prevent|allow|withdraw|release|suspend|transmit|abstain|enable|maintain|halt|respect|keep|reopen|immediately|facilitate|restore|deposit|inform|submit)/i.test(t)
    && !/\bno\s+(?:need|occasion)\s+to\s+indicate/i.test(t);
  const outcome = granted && refused ? "partly" : granted ? "indicated" : refused ? "refused" : "other";
  const kinds = [];
  const k = (key, re) => { if (re.test(t)) kinds.push(key); };
  if (granted) {
    k("non-aggravation", /aggravat|\bextend\s+the\s+dispute/i);
    k("stop-conduct", /\b(?:refrain|cease|halt|suspend|abstain|desist|stop|withdraw|not\s+(?:take|carry|execut|proceed|deploy|enforce|adopt|implement|engage))/i);
    k("protect-people", /\b(?:genocide|killing|lives|life|persons|population|civilian|humanitarian|detained|detention|executed|execution|release|protect\s+the)/i);
    k("preserve-evidence", /\bevidence|\bpreserv\w*\s+(?:the\s+)?(?:documents|data|materials)/i);
    k("access-aid", /\bhumanitarian\s+(?:assistance|aid)|\bbasic\s+services|\bunhindered|\baccess\s+(?:to|for)\b/i);
    k("report", /\breport|\binform\s+the\s+Court\b|\bsubmit\s+(?:a\s+)?report/i);
    k("property", /\b(?:property|premises|assets|documents|building|vessel|ship|equipment|platform|installations)\b/i);
    k("territory", /\b(?:territory|military|troops|forces|police|personnel|border|frontier|area)\b/i);
  }
  return { outcome, kinds };
}
