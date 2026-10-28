// Reads the variable snapshot format of test/fixtures/*.variables.tsv into figma-layout specs.
import { readFileSync } from "node:fs";

const COLLECTIONS = { P: "Primitive", S: "Semantic", C: "Components" };

function value(raw) {
  const alias = (s) => {
    const [initial, ...name] = s.slice(1).split(":");
    return { alias: `${COLLECTIONS[initial]}|${name.join(":")}` };
  };
  if (raw.startsWith("@")) return alias(raw);
  if (raw.startsWith("#")) return raw;
  if (raw.startsWith('"')) return JSON.parse(raw);
  if (raw.startsWith("{")) return Object.fromEntries(Object.entries(JSON.parse(raw)).map(([k, v]) => [k, alias(v)]));
  return Number(raw);
}

export function readVariablesTsv(file) {
  const specs = { collections: [], variables: [] };
  let collection = null;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const cols = line.split("\t");
    if (cols[0] === "@collection") {
      collection = cols[1];
      specs.collections.push({ name: collection, modes: [cols[2]] });
      continue;
    }
    const [name, type, raw, scopes = "*", hidden = ""] = cols;
    specs.variables.push({
      key: `${collection}|${name}`,
      collection,
      name,
      type: { C: "COLOR", F: "FLOAT", S: "STRING" }[type],
      values: { light: value(raw) },
      scopes: scopes === "*" ? ["ALL_SCOPES"] : scopes === "-" ? [] : scopes.split(","),
      hidden: hidden === "h",
      description: "",
    });
  }
  return specs;
}

/** Writes specs back into the snapshot format (for comparisons). */
export function writeVariablesTsv(specs) {
  const initials = Object.fromEntries(Object.entries(COLLECTIONS).map(([k, v]) => [v, k]));
  const fmt = (v) => {
    if (v && typeof v === "object" && "alias" in v) {
      const [c, ...name] = v.alias.split("|");
      return `@${initials[c]}:${name.join("|")}`;
    }
    if (v && typeof v === "object") return JSON.stringify(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fmt(x)])));
    if (typeof v === "string" && !v.startsWith("#")) return JSON.stringify(v);
    return String(v);
  };
  const lines = [];
  for (const c of specs.collections) {
    lines.push(`@collection\t${c.name}\t${c.modes[0].name ?? c.modes[0]}`);
    for (const v of specs.variables.filter((x) => x.collection === c.name)) {
      const scopes = v.scopes.length === 0 ? "-" : v.scopes.join(",") === "ALL_SCOPES" ? "*" : v.scopes.join(",");
      lines.push([v.name, v.type[0], fmt(v.values.light), scopes, v.hidden ? "h" : ""].join("\t").replace(/\t$/, ""));
    }
  }
  return lines.join("\n");
}
