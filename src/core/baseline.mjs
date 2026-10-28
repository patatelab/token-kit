// Shrink-only baselines (open-review ratchet and frozen known errors). Pure JavaScript.
// A finding is identified by subject, rule and message (never by line).
//   ratchet:     counts of known open reviews; more than listed fails.
//   knownErrors: frozen pre-existing errors; anything not listed fails.
// Both only shrink on `report`; raising them is an explicit --accept-new.

const baselineKey = (f) => `${f.subject}\u0000${f.rule}\u0000${f.message}`;

export function emptyBaseline() {
  return { schemaVersion: 1, total: 0, entries: [] };
}

function countBy(findings, severity) {
  const counts = new Map();
  for (const f of findings) if (f.severity === severity) counts.set(baselineKey(f), (counts.get(baselineKey(f)) ?? 0) + 1);
  return counts;
}

function parseBaseline(json) {
  const counts = new Map();
  for (const e of json?.entries ?? []) counts.set(`${e.subject}\u0000${e.rule}\u0000${e.message}`, e.count ?? 1);
  return counts;
}

function serializeBaseline(counts, description) {
  const entries = [...counts]
    .filter(([, n]) => n > 0)
    .map(([key, count]) => {
      const [subject, rule, message] = key.split("\u0000");
      return { subject, rule, message, count };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.rule.localeCompare(b.rule) || a.message.localeCompare(b.message));
  return { schemaVersion: 1, description, total: entries.reduce((s, e) => s + e.count, 0), entries };
}

/** Findings not covered by the baselines (these fail the gate). */
export function gateFindings(findings, { ratchet, knownErrors }) {
  const allowed = { review: parseBaseline(ratchet), error: parseBaseline(knownErrors) };
  const used = new Map();
  return findings.filter((f) => {
    const key = `${f.severity}\u0000${baselineKey(f)}`;
    const n = (used.get(key) ?? 0) + 1;
    used.set(key, n);
    return n > (allowed[f.severity]?.get(baselineKey(f)) ?? 0);
  });
}

/** Lowers baselines to what still occurs; with acceptNew also records new findings. */
export function nextBaselines(findings, { ratchet, knownErrors }, { acceptNew = false } = {}) {
  const build = (json, severity, description) => {
    const current = countBy(findings, severity);
    const previous = parseBaseline(json);
    const next = new Map();
    const keys = acceptNew ? new Set([...previous.keys(), ...current.keys()]) : previous.keys();
    for (const key of keys) {
      const n = acceptNew ? current.get(key) ?? 0 : Math.min(previous.get(key), current.get(key) ?? 0);
      if (n > 0) next.set(key, n);
    }
    return serializeBaseline(next, description);
  };
  return {
    ratchet: build(ratchet, "review", "Known open token reviews. `token-kit check` fails on any review above these counts; `token-kit report` only lowers them. Raising needs `token-kit report --accept-new` and a reason in the change."),
    knownErrors: build(knownErrors, "error", "Frozen pre-existing token errors. Anything not listed fails; `token-kit report` only removes resolved entries."),
  };
}

/** True when a stored baseline still lists findings that no longer occur. */
export function baselineIsStale(stored, next) {
  return JSON.stringify(stored?.entries ?? []) !== JSON.stringify(next.entries);
}
