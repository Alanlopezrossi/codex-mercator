// Event schedule (World boss timers). Each day starts at 00:00 UTC: first the "p" sequence, then "q" repeats.
// Each step is [segment, minutes]; segment 0 means nothing is happening.
const DAY = 1440;

export function segments(ev, fromMin, toMin) {
  const out = [];
  for (let day = Math.floor(fromMin / DAY) - 1; day <= Math.floor(toMin / DAY) + 1; day++) {
    let tm = day * DAY;
    const end = tm + DAY;
    const push = (r, d) => { if (r && tm + d > fromMin && tm < toMin) out.push({ r: String(r), start: tm, end: tm + d }); tm += d; };
    for (const [r, d] of ev.p) { if (tm >= end) break; push(r, Math.min(d, end - tm)); }
    if (ev.q.length) while (tm < end) for (const [r, d] of ev.q) { if (tm >= end) break; push(r, Math.min(d, end - tm)); }
  }
  out.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (last && last.r === s.r && last.end === s.start) last.end = s.end;
    else merged.push({ ...s });
  }
  return merged;
}
