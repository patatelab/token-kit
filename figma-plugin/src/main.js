// Token Kit Figma plugin (main thread). One variable collection per configured tier
// (config.tiers, label as collection name), one mode per theme. Bundled with the pure-JS core by figma-plugin/build.mjs;
// core functions (resolveConfig, indexTree, toFlat, indexFlat, checkModel, gateFindings, createBundle,
// validateBundle, parseColor, formatHex, aliasOf, referencesOf) are in scope.
// The export gate matches `token-kit check`: findings frozen in the bundle's baselines pass,
// every other error or review blocks the export.

const KEY = { path: "tk:path", tier: "tk:tier", type: "tk:type", unit: "tk:unit", form: "tk:form", ext: "tk:ext", themes: "tk:themes" };
const ROOT_KEY = { config: "tk:config", meta: "tk:meta", unmapped: "tk:unmapped", baselines: "tk:baselines", contracts: "tk:contracts" };

figma.showUI(__html__, { width: 420, height: 560, themeColors: true });

const collectionName = (tier) => tier.label ?? tier.name[0].toUpperCase() + tier.name.slice(1);
const modeLabel = (theme) => (theme === "light" ? "Light" : theme[0].toUpperCase() + theme.slice(1));
const varName = (path) => path.split(".").join("/");
const pathFromName = (name) => name.split("/").map((s) => s.trim().toLowerCase().replace(/\s+/g, "-")).join(".");

function storedConfig() {
  const raw = figma.root.getPluginData(ROOT_KEY.config);
  return resolveConfig(raw ? JSON.parse(raw) : {});
}

/** Root-level $extensions contracts (cssAliases, basicAliases, componentContexts) of the imported tokens. */
function storedContracts() {
  const raw = figma.root.getPluginData(ROOT_KEY.contracts);
  return raw ? JSON.parse(raw) : undefined;
}

// ---------------------------------------------------------------- import

/** How a literal value is represented as a Figma variable, or null when it is not representable. */
function toFigmaLiteral(type, value) {
  if (type === "color") {
    const c = parseColor(value);
    return c && { resolvedType: "COLOR", value: c, unit: "", form: "string" };
  }
  if (type === "dimension" || type === "duration" || type === "number" || type === "fontWeight") {
    if (typeof value === "number") return { resolvedType: "FLOAT", value, unit: "", form: "number" };
    if (value && typeof value === "object" && typeof value.value === "number")
      return { resolvedType: "FLOAT", value: value.value, unit: value.unit ?? "", form: "object" };
    const m = typeof value === "string" && value.trim().match(/^(-?\d*\.?\d+)(px|rem|em|%|ms|s)?$/);
    if (m) return { resolvedType: "FLOAT", value: parseFloat(m[1]), unit: m[2] ?? "", form: "string" };
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

/**
 * Decides the Figma type of every token. Values Figma can hold natively (colours, numbers with
 * a unit, strings) become COLOR/FLOAT/STRING variables with aliases kept; everything else
 * (easing curves, shadows, typography composites, calc()/color-mix() expressions, mixed types
 * across themes) becomes an editable STRING variable in "text" form: strings as written,
 * composites as JSON. So every token in the bundle is maintainable in Figma.
 */
function planVariables(flat) {
  const plan = new Map(); // path -> mode values ({alias} | literal) or null for text form
  const resolved = new Map(); // path -> resolvedType
  const literalPlan = (item, value) => (aliasOf(value) ? { alias: aliasOf(value) } : toFigmaLiteral(item.type, value));
  for (const [path, item] of Object.entries(flat)) {
    if (item.value === undefined) continue;
    const values = [item.value, ...Object.values(item.themes ?? {})].map((v) => literalPlan(item, v));
    const literalTypes = new Set(values.filter((v) => v && !v.alias).map((v) => v.resolvedType));
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
      const types = values.map((v) => (v.alias ? (plan.has(v.alias) ? resolved.get(v.alias) : null) : v.resolvedType));
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
  return { resolved, plan };
}

const toText = (value) => (typeof value === "string" ? value : JSON.stringify(value));
function fromText(raw) {
  const t = String(raw).trim();
  if (!/^[[{]/.test(t) || aliasOf(t)) return { value: raw };
  try {
    return { value: JSON.parse(t) };
  } catch {
    // Text with references ("{a.b} solid") is a string, not broken JSON.
    return referencesOf(t).length && !/^\[/.test(t) ? { value: raw } : { value: raw, invalid: true };
  }
}

async function ensureCollection(name, existing, themes) {
  let collection = existing.find((c) => c.name === name);
  if (!collection) {
    collection = figma.variables.createVariableCollection(name);
    collection.renameMode(collection.modes[0].modeId, "Light");
  }
  const modes = {};
  for (const theme of themes) {
    const label = modeLabel(theme);
    let mode = collection.modes.find((m) => m.name === label);
    if (!mode && theme === "light") mode = collection.modes[0];
    modes[theme] = mode ? mode.modeId : collection.addMode(label);
  }
  return { collection, modes };
}

async function importBundle(bundle) {
  const errors = validateBundle(bundle);
  if (errors.length) return { ok: false, errors };
  const config = resolveConfig(bundle.config);
  const flat = bundle.kind === "tree" ? toFlat(indexTree(bundle.tokens, config)) : bundle.tokens;
  const themes = ["light", ...Object.keys(config.themes ?? {})];
  const { resolved, plan } = planVariables(flat);

  const existingCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const collections = {};
  for (const tier of config.tiers) collections[tier.name] = await ensureCollection(collectionName(tier), existingCollections, themes);
  const fallbackTier = config.tiers.at(-1).name;

  const existing = new Map();
  for (const v of await figma.variables.getLocalVariablesAsync()) {
    const p = v.getPluginData(KEY.path);
    if (p) existing.set(p, v);
  }

  // Pass 1: create or retype variables.
  const variables = new Map();
  for (const [path, resolvedType] of resolved) {
    const item = flat[path];
    const tier = collections[item.tier] ? item.tier : fallbackTier;
    const { collection } = collections[tier];
    let v = existing.get(path);
    if (v && (v.resolvedType !== resolvedType || v.variableCollectionId !== collection.id)) {
      v.remove();
      v = null;
    }
    if (!v) v = figma.variables.createVariable(varName(path), collection, resolvedType);
    v.description = item.description ?? "";
    const text = plan.get(path) === null;
    const literal = text ? { unit: "", form: "text" } : plan.get(path).find((x) => !x.alias);
    v.setPluginData(KEY.path, path);
    v.setPluginData(KEY.tier, tier);
    v.setPluginData(KEY.type, item.type ?? "");
    v.setPluginData(KEY.unit, literal ? literal.unit : "");
    v.setPluginData(KEY.form, literal ? literal.form : "");
    v.setPluginData(KEY.ext, item.extensions ? JSON.stringify(item.extensions) : "");
    v.setPluginData(KEY.themes, JSON.stringify(Object.keys(item.themes ?? {})));
    variables.set(path, v);
  }

  // Pass 2: values per mode.
  for (const [path, v] of variables) {
    const item = flat[path];
    const { modes } = collections[collections[item.tier] ? item.tier : fallbackTier];
    for (const theme of themes) {
      const value = theme === "light" ? item.value : item.themes?.[theme] ?? item.value;
      if (plan.get(path) === null) {
        v.setValueForMode(modes[theme], toText(value));
        v.setPluginData(`tk:orig:${theme}`, JSON.stringify({ figma: toText(value), value }));
        continue;
      }
      const target = aliasOf(value);
      if (target) {
        const t = variables.get(target);
        // Unit/form of aliases follow the target; remember the target's for literals set later in Figma.
        if (!v.getPluginData(KEY.unit)) v.setPluginData(KEY.unit, t.getPluginData(KEY.unit));
        if (!v.getPluginData(KEY.form) && t.getPluginData(KEY.form) !== "text") v.setPluginData(KEY.form, t.getPluginData(KEY.form));
        v.setValueForMode(modes[theme], figma.variables.createVariableAlias(t));
      } else {
        const literal = toFigmaLiteral(item.type, value).value;
        v.setValueForMode(modes[theme], literal);
        // Remember the source spelling (#fff vs #FFFFFF, "1rem" vs {value,unit}) for an unchanged export.
        v.setPluginData(`tk:orig:${theme}`, JSON.stringify({ figma: literal, value }));
      }
    }
  }

  const unmapped = {};
  for (const [path, item] of Object.entries(flat)) if (!variables.has(path)) unmapped[path] = item;
  figma.root.setPluginData(ROOT_KEY.unmapped, JSON.stringify(unmapped));
  figma.root.setPluginData(ROOT_KEY.config, JSON.stringify(bundle.config));
  if (bundle.baselines) figma.root.setPluginData(ROOT_KEY.baselines, JSON.stringify(bundle.baselines));
  const contracts = bundle.kind === "tree" ? bundle.tokens.$extensions : bundle.contracts;
  figma.root.setPluginData(ROOT_KEY.contracts, contracts ? JSON.stringify(contracts) : "");
  figma.root.setPluginData(ROOT_KEY.meta, JSON.stringify({ checksum: bundle.checksum, source: bundle.source, importedAt: new Date().toISOString() }));
  return { ok: true, variables: variables.size, unmapped: Object.keys(unmapped).length };
}

// ---------------------------------------------------------------- export

function fromFigmaLiteral(v, raw, invalid) {
  const unit = v.getPluginData(KEY.unit);
  const form = v.getPluginData(KEY.form);
  if (form === "text") {
    const parsed = fromText(raw);
    if (parsed.invalid) invalid.push(v.getPluginData(KEY.path) || v.name);
    return parsed.value;
  }
  if (v.resolvedType === "COLOR") return formatHex(raw);
  if (v.resolvedType === "FLOAT") {
    const n = Math.round(raw * 10000) / 10000;
    if (form === "number" || (!unit && form !== "object")) return form === "string" ? String(n) : n;
    return form === "object" ? { value: n, unit } : `${n}${unit}`;
  }
  if (v.resolvedType === "STRING") return form === "array" ? raw.split(",").map((s) => s.trim()) : raw;
  return raw;
}

/** Deep equality with float tolerance (Figma stores numbers and colour channels as float32). */
function sameFigmaValue(a, b) {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => sameFigmaValue(a[k], b[k]));
  }
  return a === b;
}

const DEFAULT_TYPE = { COLOR: "color", FLOAT: "dimension", STRING: "string", BOOLEAN: "boolean" };

async function collectFlat() {
  const config = storedConfig();
  const themes = ["light", ...Object.keys(config.themes ?? {})];
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const tierByCollection = new Map();
  for (const tier of config.tiers) {
    const c = collections.find((x) => x.name === collectionName(tier));
    if (c) tierByCollection.set(c.id, { tier: tier.name, collection: c });
  }
  const all = (await figma.variables.getLocalVariablesAsync()).filter((v) => tierByCollection.has(v.variableCollectionId));
  const pathById = new Map(all.map((v) => [v.id, v.getPluginData(KEY.path) || pathFromName(v.name)]));
  const flat = {};
  const created = [];
  const invalid = [];
  for (const v of all) {
    if (v.resolvedType === "BOOLEAN") continue;
    const { tier, collection } = tierByCollection.get(v.variableCollectionId);
    const path = pathById.get(v.id);
    if (!v.getPluginData(KEY.path)) created.push(path);
    const valueFor = (theme) => {
      const mode = collection.modes.find((m) => m.name === modeLabel(theme)) ?? (theme === "light" ? collection.modes[0] : null);
      if (!mode) return undefined;
      const raw = v.valuesByMode[mode.modeId];
      if (raw && raw.type === "VARIABLE_ALIAS") return pathById.has(raw.id) ? `{${pathById.get(raw.id)}}` : undefined;
      if (raw === undefined) return undefined;
      const orig = v.getPluginData(`tk:orig:${theme}`);
      if (orig) {
        const { figma: imported, value } = JSON.parse(orig);
        if (sameFigmaValue(raw, imported)) return value;
      }
      return fromFigmaLiteral(v, raw, invalid);
    };
    // Imported variables keep their original $type (even none); new ones get one from the Figma type.
    const type = v.getPluginData(KEY.path) ? v.getPluginData(KEY.type) || undefined : DEFAULT_TYPE[v.resolvedType];
    const item = { type, value: valueFor("light"), tier };
    if (v.description) item.description = v.description;
    const ext = v.getPluginData(KEY.ext);
    if (ext) item.extensions = JSON.parse(ext);
    const explicit = JSON.parse(v.getPluginData(KEY.themes) || "[]");
    for (const theme of themes.slice(1)) {
      const value = valueFor(theme);
      if (value !== undefined && (explicit.includes(theme) || JSON.stringify(value) !== JSON.stringify(item.value))) (item.themes ??= {})[theme] = value;
    }
    flat[path] = item;
  }
  const unmapped = JSON.parse(figma.root.getPluginData(ROOT_KEY.unmapped) || "{}");
  for (const [path, item] of Object.entries(unmapped)) if (!(path in flat)) flat[path] = item;
  return { config, flat, created, invalid };
}

async function runCheck() {
  const { config, flat, created, invalid } = await collectFlat();
  const contracts = storedContracts();
  const findings = checkModel(indexFlat(flat, config), config, contracts ? { $extensions: contracts } : null);
  for (const path of [...new Set(invalid)])
    findings.unshift({ rule: "TOKEN_FIGMA_VALUE", severity: "error", subject: path, message: "value is not valid JSON", suggestion: "Composite values (shadows, curves, typography) are edited as JSON; fix the brackets or quotes." });
  const baselines = JSON.parse(figma.root.getPluginData(ROOT_KEY.baselines) || "{}");
  const failing = gateFindings(findings, { ratchet: baselines.ratchet, knownErrors: baselines.knownErrors });
  const frozen = findings.length - failing.length;
  return { config, flat, created, findings: failing, frozen, errors: failing.length };
}

// ---------------------------------------------------------------- messages

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === "import") {
      figma.ui.postMessage({ type: "imported", result: await importBundle(msg.bundle) });
    } else if (msg.type === "check") {
      const { findings, errors, created, flat, frozen } = await runCheck();
      figma.ui.postMessage({ type: "checked", findings, errors, created, frozen, count: Object.keys(flat).length });
    } else if (msg.type === "export") {
      const { flat, findings, errors, created, frozen } = await runCheck();
      if (errors) {
        figma.ui.postMessage({ type: "checked", findings, errors, created, frozen, count: Object.keys(flat).length, blocked: true });
        return;
      }
      const meta = JSON.parse(figma.root.getPluginData(ROOT_KEY.meta) || "{}");
      const bundle = createBundle({
        kind: "flat",
        tokens: flat,
        config: JSON.parse(figma.root.getPluginData(ROOT_KEY.config) || "{}"),
        source: { tool: "token-kit-figma", file: figma.root.name, basedOn: meta.checksum, newTokens: created },
        contracts: storedContracts(),
      });
      figma.ui.postMessage({ type: "exported", bundle, findings, created });
    } else if (msg.type === "status") {
      const meta = JSON.parse(figma.root.getPluginData(ROOT_KEY.meta) || "null");
      figma.ui.postMessage({ type: "status", meta });
    }
  } catch (error) {
    figma.ui.postMessage({ type: "error", message: String(error && error.message ? error.message : error) });
  }
};
