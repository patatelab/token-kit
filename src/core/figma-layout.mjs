// Figma layout: maps a flat token set to Figma variables ("specs") and back. Pure JavaScript,
// shared by the Figma plugin (which applies and reads specs) and by tests and converters.
//
// The layout (config.figma) describes how variables look in Figma:
//   collections  per tier: { name, modes: { light: "light", dark: "dark" } }
//   blocks       per tier: ordered [{ heading, prefixes }]; a heading becomes a divider variable "𝗛𝗘𝗔𝗗𝗜𝗡𝗚/ㅤ"
//   sections     per tier: [{ heading, insertAt, match }]; inserts "𝗛𝗘𝗔𝗗𝗜𝗡𝗚" as a name segment
//                (color/𝗨𝗦𝗔𝗚𝗘/background/page) and emits "color/𝗨𝗦𝗔𝗚𝗘/ㅤ" before the section
//   joinFrom     per tier: name segments from this index are joined with "-" (button/bg-primary-default)
//   percent      categories whose numbers are 0–100 in Figma (opacity 0.5 -> 50)
//   remBase      px per rem; rem/em dimensions are shown in px
//   fontWeights  numeric weight -> Figma style name (fontWeight tokens become STRING variables)
//   shadowLayers shadow tokens become one variable per layer and field (shadow/sm/layer-0/blur)
//   scopes       [{ tiers?, match, scopes }] first match wins, default ALL_SCOPES
//   hidden       [{ tiers?, match, hidden }] first match wins, default false
//   types        category -> $type for variables that were created in Figma
// Per token, $extensions.figma.{scopes,hidden} override the rules.
//
// Spec variable: { collection, name, type: COLOR|FLOAT|STRING, values: { <theme>: value }, scopes, hidden,
//   description, meta } with value = literal (hex string, number, string) | { alias: key } |
//   { color: { alias }, opacity: { alias } }. Keys are "<collection>|<name>". meta is null for dividers
//   and otherwise holds what a lossless round trip needs (path, tier, type, unit, form, ext, part, orig).

import { aliasOf, isPlainObject, referencesOf } from "./tokens.mjs";
import { formatHex, parseColor } from "./color.mjs";

export const FILLER = "ㅤ"; // HANGUL FILLER, renders as blank space in Figma

const BOLD = [
  [0x41, 0x5a, 0x1d5d4],
  [0x61, 0x7a, 0x1d5ee],
  [0x30, 0x39, 0x1d7ec],
];

export function boldText(text) {
  return [...text]
    .map((ch) => {
      const c = ch.codePointAt(0);
      const range = BOLD.find(([a, z]) => c >= a && c <= z);
      return range ? String.fromCodePoint(range[2] + c - range[0]) : ch;
    })
    .join("");
}

const isBoldChar = (ch) => {
  const c = ch.codePointAt(0);
  return c >= 0x1d5d4 && c <= 0x1d7ff;
};
const isFiller = (seg) => seg.length > 0 && [...seg].every((ch) => ch === FILLER || ch === " ");
const isHeading = (seg) => [...seg].some(isBoldChar) && [...seg].every((ch) => isBoldChar(ch) || ch === " " || ch === FILLER);

/** True for divider variables (headings and spacers that only structure the Figma panel). */
export function isDividerName(name) {
  return isFiller(name.split("/").at(-1));
}

const SHADOW_FIELDS = { "offset-x": "offsetX", "offset-y": "offsetY", blur: "blur", spread: "spread", color: "color" };
const SHADOW_PART = /^(.+)\/layer-(\d+)\/(offset-x|offset-y|blur|spread|color)$/;

function globMatch(pattern, path) {
  const p = pattern.split(".");
  const s = path.split(".");
  if (p.length > s.length) return false;
  return p.every((seg, i) => new RegExp(`^${seg.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(s[i]));
}

const firstRule = (rules, tier, path) => (rules ?? []).find((r) => (!r.tiers || r.tiers.includes(tier)) && r.match.some((m) => globMatch(m, path)));

const category = (layout, path) => {
  const name = path.split(".").join("-");
  return Object.keys(layout.types ?? {})
    .concat(layout.percent ?? [])
    .sort((a, b) => b.length - a.length)
    .find((c) => name === c || name.startsWith(c + "-"));
};

export function figmaLayout(config) {
  const layout = config.figma ?? {};
  return { ...layout, collections: layout.collections ?? {}, remBase: layout.remBase ?? 16 };
}

export function collectionNameOf(config, tier) {
  const t = typeof tier === "string" ? config.tiers.find((x) => x.name === tier) : tier;
  return figmaLayout(config).collections[t.name]?.name ?? t.label ?? t.name[0].toUpperCase() + t.name.slice(1);
}

export function themesOf(config, tier) {
  const t = config.tiers.find((x) => x.name === tier);
  return t?.themes === false ? ["light"] : ["light", ...Object.keys(config.themes ?? {})];
}

export function modeNameOf(config, tier, theme) {
  return figmaLayout(config).collections[tier]?.modes?.[theme] ?? (theme === "light" ? "Light" : theme[0].toUpperCase() + theme.slice(1));
}

function sectionOf(layout, tier, path) {
  return (layout.sections?.[tier] ?? []).find((s) => s.match.some((m) => globMatch(m, path)));
}

/** Figma variable name of a token path. */
export function figmaNameOf(config, tier, path) {
  const layout = figmaLayout(config);
  let segs = path.split(".");
  const join = layout.joinFrom?.[tier];
  if (join !== undefined && segs.length > join + 1) segs = [...segs.slice(0, join), segs.slice(join).join("-")];
  const section = sectionOf(layout, tier, path);
  if (section) segs.splice(Math.min(section.insertAt ?? 1, segs.length - 1), 0, boldText(section.heading));
  return segs.join("/");
}

/** Token path of a Figma variable name (headings removed, segments as written). */
export function pathOfFigmaName(name) {
  return name
    .split("/")
    .filter((s) => !isHeading(s))
    .map((s) => s.trim().replace(/\s+/g, "-"))
    .join(".");
}

// ---------------------------------------------------------------- values

const round = (n) => Math.round(n * 10000) / 10000;

/** Figma literal for a token literal, or null when Figma cannot hold it natively. */
export function toFigmaLiteral(layout, path, type, value) {
  if (type === "color") {
    const c = parseColor(value);
    return c && { resolvedType: "COLOR", value: formatHex(c), unit: "", form: "string" };
  }
  const percent = (layout.percent ?? []).includes(category(layout, path));
  if (type === "fontWeight" && layout.fontWeights) {
    const name = layout.fontWeights[String(value)];
    if (name) return { resolvedType: "STRING", value: name, unit: "", form: typeof value === "number" ? "number" : "string" };
    if (typeof value === "string" && !/^\d+$/.test(value)) return { resolvedType: "STRING", value, unit: "", form: "string" };
  }
  if (type === "dimension" || type === "duration" || type === "number" || type === "fontWeight") {
    const scale = (n, unit) => (unit === "rem" || unit === "em" ? n * layout.remBase : percent ? n * 100 : n);
    if (typeof value === "number") return { resolvedType: "FLOAT", value: round(scale(value, "")), unit: "", form: "number" };
    if (isPlainObject(value) && typeof value.value === "number")
      return { resolvedType: "FLOAT", value: round(scale(value.value, value.unit)), unit: value.unit ?? "", form: "object" };
    const m = typeof value === "string" && value.trim().match(/^(-?\d*\.?\d+)(px|rem|em|%|ms|s)?$/);
    if (m) return { resolvedType: "FLOAT", value: round(scale(parseFloat(m[1]), m[2])), unit: m[2] ?? "", form: "string" };
    if (type === "fontWeight" && typeof value === "string") return { resolvedType: "STRING", value, unit: "", form: "string" };
    return null;
  }
  if (type === "fontFamily") {
    if (Array.isArray(value)) return { resolvedType: "STRING", value: value.join(", "), unit: "", form: "array" };
    return typeof value === "string" ? { resolvedType: "STRING", value, unit: "", form: "string" } : null;
  }
  if (typeof value === "string" && !referencesOf(value).length) return { resolvedType: "STRING", value, unit: "", form: "string" };
  return null;
}

/** Token literal for a Figma literal. meta: {type, unit, form} when known. */
export function fromFigmaLiteral(layout, path, resolvedType, raw, meta = {}) {
  const type = meta.type || inferType(layout, path, resolvedType);
  if (resolvedType === "COLOR") return typeof raw === "string" ? raw.toUpperCase() : formatHex(raw);
  if (resolvedType === "FLOAT") {
    const percent = (layout.percent ?? []).includes(category(layout, path));
    const unit = meta.unit ?? (type === "dimension" ? "px" : type === "duration" ? "ms" : "");
    const n = round(unit === "rem" || unit === "em" ? raw / layout.remBase : percent ? raw / 100 : raw);
    if (meta.form === "object") return { value: n, unit };
    if (meta.form === "number" || !unit) return n;
    return `${n}${unit}`;
  }
  if (resolvedType === "STRING") {
    if (type === "fontWeight" && layout.fontWeights) {
      const weight = Object.entries(layout.fontWeights).find(([, name]) => name.toLowerCase() === String(raw).toLowerCase());
      if (weight) return meta.form === "string" ? weight[0] : Number(weight[0]);
    }
    if (meta.form === "array") return String(raw).split(",").map((s) => s.trim());
    return raw;
  }
  return raw;
}

function inferType(layout, path, resolvedType) {
  const c = category(layout, path);
  if (c && layout.types?.[c]) return layout.types[c];
  return { COLOR: "color", FLOAT: "dimension", STRING: "string", BOOLEAN: "boolean" }[resolvedType];
}

const toText = (value) => (typeof value === "string" ? value : JSON.stringify(value));

export function fromText(raw) {
  const t = String(raw).trim();
  if (!/^[[{]/.test(t) || aliasOf(t)) return { value: raw };
  try {
    return { value: JSON.parse(t) };
  } catch {
    // Text with references ("{a.b} solid") is a string, not broken JSON.
    return referencesOf(t).length && !/^\[/.test(t) ? { value: raw } : { value: raw, invalid: true };
  }
}

// Figma type for a token type, used when an alias target is missing.
function nativeTypeOf(type) {
  if (type === "color") return "COLOR";
  if (["dimension", "number", "duration", "fontWeight"].includes(type)) return "FLOAT";
  if (["fontFamily", "string"].includes(type)) return "STRING";
  return null;
}

const isColorOpacity = (v) => isPlainObject(v) && Object.keys(v).length === 2 && aliasOf(v.color) && aliasOf(v.opacity);

// ---------------------------------------------------------------- tokens -> specs

/**
 * Plans the Figma variables for a flat token set (see toFlat). Every token becomes at least one
 * variable: native COLOR/FLOAT/STRING where Figma can hold the value (aliases kept), shadow layers
 * when configured, otherwise an editable STRING in "text" form (JSON for composites).
 */
export function toFigmaSpecs(flat, config) {
  const layout = figmaLayout(config);
  const tierNames = new Set(config.tiers.map((t) => t.name));
  const tierOfItem = (item) => (tierNames.has(item.tier) ? item.tier : config.tiers.at(-1).name);
  const themeValues = (path, item) => {
    const out = {};
    for (const theme of themesOf(config, tierOfItem(item))) {
      const v = theme === "light" ? item.value : item.themes?.[theme] ?? item.value;
      if (v !== undefined) out[theme] = v;
    }
    return out;
  };

  // Shadow layers: count per token (following aliases), null when not layerable.
  const layerMemo = new Map();
  const layersOf = (path, seen = new Set()) => {
    if (layerMemo.has(path)) return layerMemo.get(path);
    const item = flat[path];
    let result = null;
    if (layout.shadowLayers && item?.type === "shadow" && !seen.has(path)) {
      seen.add(path);
      const counts = Object.values(themeValues(path, item)).map((v) => {
        if (aliasOf(v)) return flat[aliasOf(v)]?.type === "shadow" ? layersOf(aliasOf(v), seen) : null;
        const list = Array.isArray(v) ? v : isPlainObject(v) ? [v] : null;
        if (!list || list.some((l) => !isPlainObject(l) || l.inset || Object.keys(l).some((k) => !Object.values(SHADOW_FIELDS).includes(k)))) return null;
        return list.length;
      });
      result = counts.length && counts.every((n) => n && n === counts[0]) ? counts[0] : null;
    }
    layerMemo.set(path, result);
    return result;
  };

  // Native plan per token: values per theme as {alias} | literal | {colorOpacity}; null = text form.
  const plan = new Map();
  const resolved = new Map();
  for (const [path, item] of Object.entries(flat)) {
    if (item.value === undefined || layersOf(path)) continue;
    const values = Object.values(themeValues(path, item)).map((v) => {
      if (aliasOf(v)) return { alias: aliasOf(v) };
      if (item.type === "color" && isColorOpacity(v)) return { colorOpacity: true };
      return toFigmaLiteral(layout, path, item.type, v);
    });
    const literalTypes = new Set(values.filter((v) => v && !v.alias).map((v) => (v.colorOpacity ? "COLOR" : v.resolvedType)));
    if (values.includes(null) || literalTypes.size > 1) {
      plan.set(path, null);
      resolved.set(path, "STRING");
    } else plan.set(path, values);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [path, values] of plan) {
      if (resolved.has(path)) continue;
      const types = values.map((v) =>
        v.alias ? (plan.has(v.alias) ? resolved.get(v.alias) : flat[v.alias] ? null : nativeTypeOf(flat[path].type)) : v.colorOpacity ? "COLOR" : v.resolvedType,
      );
      if (types.includes(undefined)) continue;
      const set = new Set(types);
      if (set.has(null) || set.size > 1) plan.set(path, null);
      resolved.set(path, set.has(null) || set.size > 1 ? "STRING" : types[0]);
      changed = true;
    }
  }
  for (const path of plan.keys())
    if (!resolved.has(path)) {
      plan.set(path, null); // alias cycle: keep it visible as text, the check reports the cycle
      resolved.set(path, "STRING");
    }

  // Targets missing from the set (broken references) keep their name in the referenced tier.
  const missingTier = (from) => config.tiers.find((t) => t.name === tierOfItem(flat[from]))?.references?.[0] ?? tierOfItem(flat[from]);
  const keyOf = (path, part, from) => {
    const tier = flat[path] ? tierOfItem(flat[path]) : missingTier(from);
    const name = figmaNameOf(config, tier, path);
    return `${collectionNameOf(config, tier)}|${part ? `${name}/layer-${part.layer}/${part.field}` : name}`;
  };
  const scopesFor = (tier, path, item) => item.extensions?.figma?.scopes ?? firstRule(layout.scopes, tier, path)?.scopes ?? ["ALL_SCOPES"];
  const hiddenFor = (tier, path, item) => item.extensions?.figma?.hidden ?? firstRule(layout.hidden, tier, path)?.hidden ?? false;
  const extWithoutFigma = (ext) => {
    if (!ext) return undefined;
    const { figma, ...rest } = ext;
    return Object.keys(rest).length ? rest : undefined;
  };

  const specsByTier = new Map(config.tiers.map((t) => [t.name, []]));
  for (const [path, item] of Object.entries(flat)) {
    if (item.value === undefined) continue;
    const tier = tierOfItem(item);
    const collection = collectionNameOf(config, tier);
    const name = figmaNameOf(config, tier, path);
    const base = { collection, scopes: scopesFor(tier, path, item), hidden: hiddenFor(tier, path, item), description: item.description ?? "" };
    const meta = { path, tier, type: item.type ?? "", ext: extWithoutFigma(item.extensions), themes: Object.keys(item.themes ?? {}), figmaExt: item.extensions?.figma };
    const values = themeValues(path, item);
    const count = layersOf(path);
    if (count) {
      for (let layer = 0; layer < count; layer++)
        for (const [field, key] of Object.entries(SHADOW_FIELDS)) {
          const spec = { ...base, name: `${name}/layer-${layer}/${field}`, type: field === "color" ? "COLOR" : "FLOAT", values: {}, meta: { ...meta, part: { layer, field }, orig: {} } };
          if (layer || field !== "offset-x") spec.description = "";
          for (const [theme, v] of Object.entries(values)) {
            if (aliasOf(v)) {
              spec.values[theme] = { alias: keyOf(aliasOf(v), { layer, field }, path) };
              continue;
            }
            const part = (Array.isArray(v) ? v : [v])[layer][key] ?? (field === "color" ? "#00000000" : "0px");
            if (aliasOf(part)) spec.values[theme] = { alias: keyOf(aliasOf(part), undefined, path) };
            else {
              const lit = toFigmaLiteral(layout, path, field === "color" ? "color" : "dimension", part);
              spec.values[theme] = lit ? lit.value : field === "color" ? "#00000000" : 0;
              spec.meta.unit = lit?.unit ?? "px";
              spec.meta.form = lit?.form ?? "string";
            }
            spec.meta.orig[theme] = { figma: spec.values[theme], value: v };
          }
          specsByTier.get(tier).push(spec);
        }
      continue;
    }
    const values0 = plan.get(path);
    const spec = { ...base, name, type: resolved.get(path), values: {}, meta: { ...meta, orig: {} } };
    if (values0 === null) {
      spec.meta.form = "text";
      spec.meta.unit = "";
      for (const [theme, v] of Object.entries(values)) {
        spec.values[theme] = toText(v);
        spec.meta.orig[theme] = { figma: toText(v), value: v };
      }
    } else {
      for (const [theme, v] of Object.entries(values)) {
        if (aliasOf(v)) spec.values[theme] = { alias: keyOf(aliasOf(v), undefined, path) };
        else if (isColorOpacity(v))
          spec.values[theme] = { color: { alias: keyOf(aliasOf(v.color), undefined, path) }, opacity: { alias: keyOf(aliasOf(v.opacity), undefined, path) } };
        else {
          const lit = toFigmaLiteral(layout, path, item.type, v);
          spec.values[theme] = lit.value;
          spec.meta.unit = lit.unit;
          spec.meta.form = lit.form;
          spec.meta.orig[theme] = { figma: lit.value, value: v };
        }
      }
    }
    specsByTier.get(tier).push(spec);
  }

  // Unit/form of aliases follow their target, so literals typed later in Figma keep the unit.
  const byKey = new Map();
  for (const list of specsByTier.values()) for (const s of list) byKey.set(`${s.collection}|${s.name}`, s);
  const unitOf = (spec, seen = new Set()) => {
    if (spec.meta.form !== undefined || seen.has(spec)) return spec.meta;
    seen.add(spec);
    const alias = Object.values(spec.values).find((v) => v?.alias)?.alias;
    const target = alias && byKey.get(alias);
    return target ? unitOf(target, seen) : {};
  };
  for (const list of specsByTier.values())
    for (const s of list)
      if (s.meta.form === undefined) {
        const t = unitOf(s);
        s.meta.unit = t.unit ?? "";
        s.meta.form = t.form === "text" ? "" : t.form ?? "";
      }

  // Order by blocks and sections, with divider variables.
  const collections = [];
  const variables = [];
  for (const tier of config.tiers) {
    const collection = collectionNameOf(config, tier);
    collections.push({ tier: tier.name, name: collection, modes: themesOf(config, tier.name).map((theme) => ({ theme, name: modeNameOf(config, tier.name, theme) })) });
    const list = specsByTier.get(tier.name);
    const blocks = layout.blocks?.[tier.name] ?? [];
    const blockOf = (s) => blocks.findIndex((b) => b.prefixes.some((p) => globMatch(p, s.meta.path)));
    const sections = layout.sections?.[tier.name] ?? [];
    const sectionIndex = (s) => sections.indexOf(sectionOf(layout, tier.name, s.meta.path));
    const ordered = [...blocks.keys(), -1].map((b) => list.filter((s) => blockOf(s) === b));
    let spacer = 0;
    const divider = (name) => ({ collection, name, type: "COLOR", values: { light: "#FFFFFF" }, scopes: [], hidden: true, description: "", meta: null });
    ordered.forEach((group, b) => {
      if (!group.length) return;
      const block = blocks[b];
      if (layout.dividers && block) {
        if (spacer > 0) variables.push(divider(`${Array(spacer).fill(FILLER).join(" ")}/${FILLER}`));
        spacer++;
        if (block.heading) variables.push(divider(`${boldText(block.heading)}/${FILLER}`));
      }
      const bySection = [...sections.keys(), -1].map((i) => group.filter((s) => sectionIndex(s) === i));
      bySection.forEach((items, i) => {
        if (!items.length) return;
        if (layout.dividers && sections[i]) {
          const at = sections[i].insertAt ?? 1;
          variables.push(divider([...items[0].name.split("/").slice(0, at), boldText(sections[i].heading), FILLER].join("/")));
        }
        variables.push(...naturalOrder(items));
      });
    });
  }
  return { collections, variables };
}

// JSON objects list integer-like keys first ("100" before "050"); Figma lists steps in scale order.
// Keeps the order of first appearance, but sorts numeric siblings numerically.
function naturalOrder(specs) {
  const root = new Map();
  for (const spec of specs) {
    let node = root;
    for (const seg of spec.name.split("/")) {
      if (!node.has(seg)) node.set(seg, { children: new Map(), specs: [] });
      const next = node.get(seg);
      node = next.children;
      if (seg === spec.name.split("/").at(-1)) next.specs.push(spec);
    }
  }
  const out = [];
  const walk = (node) => {
    const keys = [...node.keys()];
    const numeric = keys.filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
    let n = 0;
    for (const key of keys.map((k) => (/^\d+$/.test(k) ? numeric[n++] : k))) {
      out.push(...node.get(key).specs);
      walk(node.get(key).children);
    }
  };
  walk(root);
  return out;
}

// ---------------------------------------------------------------- specs -> tokens

/** Deep equality with float tolerance (Figma stores numbers and colour channels as float32). */
export function sameFigmaValue(a, b) {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  if (typeof a === "string" && typeof b === "string" && /^#/.test(a) && /^#/.test(b)) return formatHex(parseColor(a)) === formatHex(parseColor(b));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => sameFigmaValue(a[k], b[k]));
  }
  return a === b;
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Reads Figma variables back into a flat token set.
 * specs: { collections: [{ name, tier? }], variables: [{ key, collection, name, type, values: { <theme>: raw },
 *   scopes, hidden, description, meta? }] } with aliases as { alias: key, name?, collection? }
 * (name/collection describe targets that are not in the list, e.g. deleted variables).
 * Returns { flat, created, invalid, dividers }.
 */
export function fromFigmaSpecs(specs, config) {
  const layout = figmaLayout(config);
  const tierByCollection = new Map();
  for (const t of config.tiers) tierByCollection.set(collectionNameOf(config, t), t.name);
  for (const c of specs.collections ?? []) if (c.tier) tierByCollection.set(c.name, c.tier);

  const vars = specs.variables.filter((v) => tierByCollection.has(v.collection) && v.type !== "BOOLEAN");
  const dividers = vars.filter((v) => !v.meta && isDividerName(v.name)).length;
  const real = vars.filter((v) => v.meta || !isDividerName(v.name));
  const keyOf = (v) => v.key ?? `${v.collection}|${v.name}`;

  // Path and part of every variable.
  const info = new Map();
  for (const v of real) {
    const tier = v.meta?.tier ?? tierByCollection.get(v.collection);
    let path = v.meta?.path;
    let part = v.meta?.part;
    if (!path) {
      const m = layout.shadowLayers && v.name.match(SHADOW_PART);
      if (m) {
        path = pathOfFigmaName(m[1]);
        part = { layer: Number(m[2]), field: m[3] };
      } else path = pathOfFigmaName(v.name);
    }
    info.set(keyOf(v), { v, tier, path, part });
  }
  const targetPath = (alias) => {
    const t = info.get(alias.alias);
    if (t) return { path: t.path, part: t.part };
    const name = alias.name ?? String(alias.alias).split("|").slice(1).join("|");
    const m = layout.shadowLayers && name.match(SHADOW_PART);
    return m ? { path: pathOfFigmaName(m[1]), part: { layer: Number(m[2]), field: m[3] } } : { path: pathOfFigmaName(name), part: undefined };
  };

  const flat = {};
  const created = [];
  const invalid = [];
  const groups = new Map(); // path -> [info] (one entry, or several shadow parts)
  for (const entry of info.values()) {
    if (!groups.has(entry.path)) groups.set(entry.path, []);
    groups.get(entry.path).push(entry);
  }

  const literalOf = (entry, theme) => {
    const { v, path } = entry;
    const raw = v.values[theme];
    if (raw === undefined) return undefined;
    if (raw && typeof raw === "object" && "alias" in raw) {
      const t = targetPath(raw);
      return `{${t.path}}`;
    }
    if (raw && typeof raw === "object" && "color" in raw && "opacity" in raw)
      return { color: `{${targetPath(raw.color).path}}`, opacity: `{${targetPath(raw.opacity).path}}` };
    const orig = v.meta?.orig?.[theme];
    if (orig && !entry.part && sameFigmaValue(raw, orig.figma)) return orig.value;
    if (v.meta?.form === "text") {
      const parsed = fromText(raw);
      if (parsed.invalid) invalid.push(path);
      return parsed.value;
    }
    const type = entry.part ? (entry.part.field === "color" ? "color" : "dimension") : v.meta?.type;
    return fromFigmaLiteral(layout, path, v.type, raw, { type, unit: v.meta?.unit, form: entry.part ? "string" : v.meta?.form });
  };

  for (const [path, entries] of groups) {
    const first = entries[0];
    const tier = first.tier;
    const themes = themesOf(config, tier);
    const isShadow = entries.some((e) => e.part);
    const valueFor = (theme) => {
      if (!isShadow) return literalOf(first, theme);
      // Unchanged kit-made shadow: every part still equals what was written.
      const origs = entries.map((e) => e.v.meta?.orig?.[theme]);
      if (origs.every(Boolean) && entries.every((e, i) => sameFigmaValue(e.v.values[theme], origs[i].figma))) return origs[0].value;
      const parts = entries.filter((e) => e.v.values[theme] !== undefined);
      if (!parts.length) return undefined;
      // All parts alias the same parts of one shadow token: an alias of that token.
      const targets = parts.map((e) => {
        const raw = e.v.values[theme];
        return raw && typeof raw === "object" && "alias" in raw ? targetPath(raw) : null;
      });
      if (targets.every((t, i) => t && t.part && t.part.layer === parts[i].part.layer && t.part.field === parts[i].part.field && t.path === targets[0].path))
        return `{${targets[0].path}}`;
      const layers = [];
      for (const e of parts) {
        const layer = (layers[e.part.layer] ??= {});
        layer[SHADOW_FIELDS[e.part.field]] = literalOf(e, theme);
      }
      const ordered = layers.map((l) => (l ? Object.fromEntries(["color", "offsetX", "offsetY", "blur", "spread"].filter((k) => k in l).map((k) => [k, l[k]])) : l));
      return ordered.length === 1 ? ordered[0] : ordered;
    };
    const meta = first.v.meta;
    const type = isShadow ? "shadow" : meta ? meta.type || undefined : inferType(layout, path, first.v.type);
    const item = { type, value: valueFor("light"), tier };
    const description = entries.map((e) => e.v.description).find(Boolean);
    if (description) item.description = description;
    const ext = meta?.ext ? { ...meta.ext } : {};
    // Scopes and visibility that differ from the layout rules are kept per token.
    const rule = { scopes: firstRule(layout.scopes, tier, path)?.scopes ?? ["ALL_SCOPES"], hidden: firstRule(layout.hidden, tier, path)?.hidden ?? false };
    const figmaExt = { ...(meta?.figmaExt ?? {}) };
    if (first.v.scopes && !sameSet(first.v.scopes, rule.scopes)) figmaExt.scopes = first.v.scopes;
    else delete figmaExt.scopes;
    if (first.v.hidden !== undefined && first.v.hidden !== rule.hidden) figmaExt.hidden = first.v.hidden;
    else delete figmaExt.hidden;
    if (Object.keys(figmaExt).length) ext.figma = figmaExt;
    if (Object.keys(ext).length) item.extensions = ext;
    const explicit = meta?.themes ?? [];
    for (const theme of themes.slice(1)) {
      const value = valueFor(theme);
      if (value !== undefined && (explicit.includes(theme) || JSON.stringify(value) !== JSON.stringify(item.value))) (item.themes ??= {})[theme] = value;
    }
    if (!meta) created.push(path);
    flat[path] = item;
  }

  // Types of variables created in Figma follow their alias target where the category says nothing.
  for (const [path, item] of Object.entries(flat)) {
    if (info.get(keyOf(groups.get(path)[0].v))?.v.meta) continue;
    const seen = new Set();
    let target = aliasOf(item.value);
    while (target && flat[target] && !seen.has(target)) {
      seen.add(target);
      if (!aliasOf(flat[target].value)) break;
      target = aliasOf(flat[target].value);
    }
    const inferred = inferType(layout, path, groups.get(path)[0].v.type);
    if (target && flat[target]?.type && (inferred === "dimension" || inferred === "string" || inferred === "color") && !category(layout, path))
      item.type = flat[target].type;
  }
  return { flat, created, invalid: [...new Set(invalid)], dividers };
}
