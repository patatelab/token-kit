// Token Kit Figma plugin (main thread). Applies and reads the Figma layout of src/core/figma-layout.mjs:
// one collection per tier, one mode per theme, headings and divider variables, scopes and visibility.
// Bundled with the pure-JS core by figma-plugin/build.mjs; core functions (resolveConfig, indexTree, toFlat,
// indexFlat, checkModel, gateFindings, createBundle, validateBundle, parseColor, formatHex, toFigmaSpecs,
// fromFigmaSpecs, figmaLayout, collectionNameOf, themesOf, modeNameOf) are in scope.
// The export gate matches `token-kit check`: findings frozen in the bundle's baselines pass,
// every other error or review blocks the export.

const META_KEY = "tk:meta";
const ROOT_KEY = { config: "tk:config", meta: "tk:meta", unmapped: "tk:unmapped", baselines: "tk:baselines", contracts: "tk:contracts" };

figma.showUI(__html__, { width: 420, height: 560, themeColors: true });

function storedConfig() {
  const raw = figma.root.getPluginData(ROOT_KEY.config);
  return resolveConfig(raw ? JSON.parse(raw) : {});
}

/** Root-level $extensions contracts (cssAliases, semanticAliases, componentContexts) of the imported tokens. */
function storedContracts() {
  const raw = figma.root.getPluginData(ROOT_KEY.contracts);
  return raw ? JSON.parse(raw) : undefined;
}

const keyOfVariable = (v, collectionsById) => `${collectionsById.get(v.variableCollectionId)?.name}|${v.name}`;

// ---------------------------------------------------------------- import

/** Collection with one mode per theme; an existing collection keeps its modes and gains missing ones. */
function ensureCollection(spec, existing) {
  let collection = existing.find((c) => c.name === spec.name);
  if (!collection) {
    collection = figma.variables.createVariableCollection(spec.name);
    collection.renameMode(collection.modes[0].modeId, spec.modes[0].name);
  }
  const modes = {};
  for (const [i, { theme, name }] of spec.modes.entries()) {
    const mode = collection.modes.find((m) => m.name === name) ?? (i === 0 ? collection.modes[0] : null);
    modes[theme] = mode ? mode.modeId : collection.addMode(name);
  }
  return { collection, modes };
}

/** Literal value of a spec (following aliases), for values Figma cannot express as an alias. */
function resolveSpec(byKey, key, theme, seen = new Set()) {
  const spec = byKey.get(key);
  if (!spec || seen.has(key)) return undefined;
  seen.add(key);
  const value = spec.values[theme] ?? spec.values.light;
  return value && typeof value === "object" && "alias" in value ? resolveSpec(byKey, value.alias, theme, seen) : value;
}

/** Figma value of a spec literal (colours as RGBA, everything else as is). */
const figmaValue = (type, value) => (type === "COLOR" ? parseColor(value) : value);

async function importBundle(bundle) {
  const errors = validateBundle(bundle);
  if (errors.length) return { ok: false, errors };
  const config = resolveConfig(bundle.config);
  const flat = bundle.kind === "tree" ? toFlat(indexTree(bundle.tokens, config)) : bundle.tokens;
  const specs = toFigmaSpecs(flat, config);
  const layout = figmaLayout(config);

  const existingCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const collections = new Map();
  for (const spec of specs.collections) collections.set(spec.name, ensureCollection(spec, existingCollections));
  const collectionsById = new Map([...collections.values()].map(({ collection }) => [collection.id, collection]));

  const existing = new Map();
  for (const v of await figma.variables.getLocalVariablesAsync()) if (collectionsById.has(v.variableCollectionId)) existing.set(keyOfVariable(v, collectionsById), v);

  // Pass 1: create or retype variables, in layout order (Figma lists variables in creation order).
  const byKey = new Map();
  const variables = new Map();
  for (const spec of specs.variables) {
    const key = `${spec.collection}|${spec.name}`;
    const { collection } = collections.get(spec.collection);
    let v = existing.get(key);
    if (v && v.resolvedType !== spec.type) {
      v.remove();
      v = null;
    }
    if (!v) v = figma.variables.createVariable(spec.name, collection, spec.type);
    v.description = spec.description ?? "";
    v.scopes = spec.scopes;
    v.hiddenFromPublishing = spec.hidden;
    byKey.set(key, spec);
    variables.set(key, v);
  }

  // Pass 2: values per mode, then the metadata that makes the export lossless.
  const broken = [];
  for (const spec of specs.variables) {
    const key = `${spec.collection}|${spec.name}`;
    const v = variables.get(key);
    const { modes } = collections.get(spec.collection);
    for (const [theme, value] of Object.entries(spec.values)) {
      if (value && typeof value === "object" && "alias" in value) {
        const target = variables.get(value.alias);
        if (target) v.setValueForMode(modes[theme], figma.variables.createVariableAlias(target));
        else broken.push(spec.meta?.path ?? spec.name);
      } else if (value && typeof value === "object" && "color" in value) {
        // Colour with an aliased opacity, as Figma stores it ({ color: alias, opacity: alias }).
        const color = variables.get(value.color.alias);
        const opacity = variables.get(value.opacity.alias);
        try {
          v.setValueForMode(modes[theme], { color: figma.variables.createVariableAlias(color), opacity: figma.variables.createVariableAlias(opacity) });
        } catch {
          // Without that support the resolved colour is stored; the composite travels in the metadata.
          const rgba = parseColor(resolveSpec(byKey, value.color.alias, theme) ?? "#000000");
          const percent = (layout.percent ?? []).includes("opacity") ? 100 : 1;
          const amount = resolveSpec(byKey, value.opacity.alias, theme);
          if (typeof amount === "number") rgba.a = amount / percent;
          v.setValueForMode(modes[theme], rgba);
          spec.meta.orig[theme] = { figma: formatHex(rgba), value: flat[spec.meta.path].themes?.[theme] ?? flat[spec.meta.path].value };
        }
      } else v.setValueForMode(modes[theme], figmaValue(spec.type, value));
    }
    v.setPluginData(META_KEY, spec.meta ? JSON.stringify(spec.meta) : "");
  }

  figma.root.setPluginData(ROOT_KEY.unmapped, "");
  figma.root.setPluginData(ROOT_KEY.config, JSON.stringify(bundle.config));
  if (bundle.baselines) figma.root.setPluginData(ROOT_KEY.baselines, JSON.stringify(bundle.baselines));
  const contracts = bundle.kind === "tree" ? bundle.tokens.$extensions : bundle.contracts;
  figma.root.setPluginData(ROOT_KEY.contracts, contracts ? JSON.stringify(contracts) : "");
  figma.root.setPluginData(ROOT_KEY.meta, JSON.stringify({ checksum: bundle.checksum, source: bundle.source, importedAt: new Date().toISOString() }));
  const dividers = specs.variables.filter((s) => !s.meta).length;
  return { ok: true, variables: variables.size - dividers, dividers, unmapped: 0, broken: [...new Set(broken)] };
}

// ---------------------------------------------------------------- export

/** Reads the variables of the configured collections into specs (see src/core/figma-layout.mjs). */
async function readSpecs(config) {
  const all = await figma.variables.getLocalVariableCollectionsAsync();
  const collections = [];
  const modesByCollection = new Map();
  for (const tier of config.tiers) {
    const name = collectionNameOf(config, tier);
    const c = all.find((x) => x.name === name);
    if (!c) continue;
    collections.push({ name, tier: tier.name });
    const modes = {};
    for (const [i, theme] of themesOf(config, tier.name).entries()) {
      const mode = c.modes.find((m) => m.name === modeNameOf(config, tier.name, theme)) ?? (i === 0 ? c.modes[0] : null);
      if (mode) modes[theme] = mode.modeId;
    }
    modesByCollection.set(c.id, { collection: c, modes });
  }
  const collectionsById = new Map([...modesByCollection].map(([id, { collection }]) => [id, collection]));
  const locals = (await figma.variables.getLocalVariablesAsync()).filter((v) => modesByCollection.has(v.variableCollectionId));
  const keyById = new Map(locals.map((v) => [v.id, keyOfVariable(v, collectionsById)]));

  const aliasOfRaw = async (raw) => {
    if (keyById.has(raw.id)) return { alias: keyById.get(raw.id) };
    // Deleted or remote variables are not local, but their names still say what they were.
    const target = await figma.variables.getVariableByIdAsync(raw.id);
    return target ? { alias: `?|${target.name}`, name: target.name } : undefined;
  };

  const variables = [];
  for (const v of locals) {
    if (v.resolvedType === "BOOLEAN") continue;
    const { collection, modes } = modesByCollection.get(v.variableCollectionId);
    const values = {};
    for (const [theme, modeId] of Object.entries(modes)) {
      const raw = v.valuesByMode[modeId];
      if (raw === undefined) continue;
      if (raw && raw.type === "VARIABLE_ALIAS") {
        const alias = await aliasOfRaw(raw);
        if (alias) values[theme] = alias;
      } else if (raw && typeof raw === "object" && raw.color?.type === "VARIABLE_ALIAS" && raw.opacity?.type === "VARIABLE_ALIAS") {
        const color = await aliasOfRaw(raw.color);
        const opacity = await aliasOfRaw(raw.opacity);
        if (color && opacity) values[theme] = { color, opacity };
      } else values[theme] = v.resolvedType === "COLOR" ? formatHex(raw) : raw;
    }
    const meta = v.getPluginData(META_KEY);
    variables.push({
      key: keyById.get(v.id),
      collection: collection.name,
      name: v.name,
      type: v.resolvedType,
      values,
      scopes: v.scopes,
      hidden: v.hiddenFromPublishing,
      description: v.description,
      meta: meta ? JSON.parse(meta) : undefined,
    });
  }
  return { collections, variables };
}

async function collectFlat() {
  const config = storedConfig();
  const { flat, created, invalid } = fromFigmaSpecs(await readSpecs(config), config);
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
