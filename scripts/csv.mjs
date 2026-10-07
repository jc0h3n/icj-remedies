// Minimal RFC 4180 CSV parser: quoted fields may contain commas, quotes ("") and newlines.
// Fields are sliced rather than built character by character, so 90 MB files parse quickly.
export function parseCsv(s) {
  const rows = []; let row = [], i = 0;
  const n = s.length;
  while (i < n) {
    let f;
    if (s[i] === '"') {
      let j = i + 1, parts = [];
      for (;;) {
        const k = s.indexOf('"', j);
        if (k < 0) { parts.push(s.slice(j)); i = n; break; }
        parts.push(s.slice(j, k));
        if (s[k + 1] === '"') { parts.push('"'); j = k + 2; } else { i = k + 1; break; }
      }
      f = parts.join("");
    } else {
      let k = i;
      while (k < n && s[k] !== "," && s[k] !== "\n") k++;
      f = s.slice(i, k).replace(/\r$/, ""); i = k;
    }
    row.push(f);
    if (s[i] === ",") i++;
    else { if (s[i] === "\r") i++; if (s[i] === "\n") i++; rows.push(row); row = []; }
  }
  const [head, ...body] = rows;
  return body.map(r => Object.fromEntries(head.map((h, x) => [h, r[x]])));
}
