// Finds the operative part (dispositif) of an ICJ decision and splits it into numbered points with votes.

// From the last "THE COURT," (with its "For these reasons," lead-in) before the closing formula
// ("Done in English and in French…") up to that formula.
export function dispositif(t) {
  const end = t.search(/\n\s*(?:\d+\.\s*)?Done\s+(?:in|at)\s+(?:the\s+)?(?:English|French|Peace\s+Palace)/);
  if (end < 0) return null;
  const head = t.slice(0, end);
  const starts = [...head.matchAll(/THE\s+(?:COURT|CHAMBER)\b[,.:;]?|\bThe\s+(?:Court|Chamber),?\s*\n/g)];
  if (!starts.length) return null;
  let s = starts[starts.length - 1].index;
  const lead = head.slice(Math.max(0, s - 160), s).search(/(?:\d+\.\s*)?For\s+the(?:se|\s+above)?\s+reasons/i);
  if (lead >= 0) s = Math.max(0, s - 160) + lead;
  return head.slice(s).trim();
}

const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17 };
const num = w => NUM[w.toLowerCase()] ?? (/^\d+$/.test(w) ? +w : null);
const LABEL = String.raw`\(\s*(\d{1,2}|[A-Z]|[a-z]|[ivx]{1,4})\s*[)}\]]`;

// Removes print artefacts, running heads, page numbers and the IN FAVOUR / AGAINST lists.
export function clean(d) {
  return d
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, " ")
    .replace(/[^\n]*\.indb\s+\d+[^\n]*/g, "")
    .replace(/\n\s*\d{1,4}\s*(?=\n)/g, "")
    .replace(/\n\s*\d{0,4}\s*[A-Z][A-Za-z0-9 ,.'’()&\-–]{6,}\((?:JUDGMENT|ORDER|ADVISORY|OPINION|judgment|order)[^\n]*/g, "")
    .replace(/\n\s*[a-z][a-z0-9 ,.'’()&\-–]{6,}\((?:judgment|order|advisory opinion)\)\s*\d*\s*(?=\n)/g, "")
    .replace(new RegExp(String.raw`\bin\s+favour\s*:[\s\S]*?\bagainst\s*:[\s\S]*?(?=\n\s*\n|\n\s*${LABEL}|\n\s*(?:by\s+\w+\s+votes|unanimously)|$)`, "gi"), "")
    .replace(/(\w)-\n\s*(\w)/g, "$1$2")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .trim();
}

// Splits into points on "(1)", "(2)", "(a)"… at line starts after punctuation, so a wrapped "(6) hereof" stays put.
// Older judgments without numbers are split on "by X votes to Y," / "unanimously," lines instead.
export function points(d) {
  const body = clean(d).replace(/^[\s\S]*?THE\s+(?:COURT|CHAMBER)[,.:;]?\s*/i, "");
  const numbered = new RegExp(String.raw`(?<=(?:^|[;:.,])\s*)\n(?=${LABEL.replace(String.raw`(\d`, String.raw`(?:\d`)}\s)`);
  let parts = body.split(numbered);
  if (parts.length === 1) parts = body.split(/(?<=[;:.]\s*)\n(?=(?:by\s+\w+\s+votes?\s+to\s+\w+|unanimously)\s*,)/i);
  const out = []; let top = null;
  for (const p of parts) {
    const m = p.match(new RegExp("^" + LABEL + "\\s*"));
    let label = "";
    if (m) {
      if (/^\d+$/.test(m[1])) { top = m[1]; label = top; }
      else label = top ? `${top}${m[1]}` : m[1];
    }
    const text = (m ? p.slice(m[0].length) : p).replace(/\s*\n\s*/g, " ").replace(/\s+([;,.])/g, "$1").trim();
    if (!text) continue;
    out.push({ label, text, vote: vote(text) });
  }
  return out;
}

// The vote that opens a point: "unanimously" → "u"; "by twelve votes to three" → [12, 3]; none → null.
export function vote(t) {
  const m = t.slice(0, 400).match(/\b(unanimously)\b|by\s+(\w+)\s+votes?\s+to\s+(\w+)/i);
  if (!m) return null;
  if (m[1]) return "u";
  const a = num(m[2]), b = num(m[3]);
  return a != null && b != null ? [a, b] : null;
}
