// Token tree model: DTCG tree <-> flat index, references, tiers.
// Pure JavaScript (no Node APIs) so the Figma plugin can bundle it.

const REF_PATTERN = /\{([^{}]+)\}/g;

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** All token paths referenced anywhere inside a value (strings, arrays, composites). */
export function referencesOf(value) {
  const refs = [];
  (function visit(v) {
    if (typeof v === "string") for (const m of v.matchAll(REF_PATTERN)) refs.push(m[1]);
    else if (Array.isArray(v)) v.forEach(visit);
    else if (isPlainObject(v)) Object.values(v).forEach(visit);
  })(value);
  return refs;
}

/** The target path when the value is exactly one reference, else null. */
export function aliasOf(value) {
  if (typeof value !== "string") return null;
  const m = value.match(/^\{([^{}]+)\}$/);
  return m ? m[1] : null;
}

function themeOfRoot(config, key) {
  for (const [name, theme] of Object.entries(config.themes ?? {})) if (theme.root === key) return name;
  return null;
}

function tierMatches(match = {}, entry) {
  const p = entry.path;
  // Theme overrides live under the theme root, so their tier root is the second key.
  const root = entry.theme && entry.theme !== "light" ? entry.storage[1] : entry.storage[0];
  if (match.roots && !match.roots.includes(root)) return false;
  if (match.literal !== undefined && match.literal === referencesOf(entry.value).length > 0) return false;
  const byPrefix = match.prefixes?.some((x) => p === x || p.startsWith(x + "."));
  const byPath = match.paths?.includes(p);
  if ((match.prefixes || match.paths) && !byPrefix && !byPath) return false;
  return true;
}

/** Name of the first tier (config.tiers order) whose match fits the token. */
export function tierOf(config, entry) {
  return (config.tiers.find((t) => tierMatches(t.match, entry)) ?? config.tiers.at(-1)).name;
}

/** Family of a token in a tier with families (its first path segment), else null. */
export function familyOf(config, tier, path) {
  return config.tiers.find((t) => t.name === tier)?.families ? path.split(".")[0] : null;
}

/**
 * Walks a DTCG tree. Returns
 *   tokens: Map<"theme:path", entry>   (theme "light" for the base tree)
 *   groups: Map<"theme:path", storage> (logical group path -> storage path, for inserts)
 * entry = {path, theme, storage, value, type, description, extensions, tier, family}
 */
export function indexTree(tree, config) {
  const tokens = new Map();
  const groups = new Map();
  function walk(node, storage, logical, type, theme) {
    if (!isPlainObject(node)) return;
    type = node.$type ?? type;
    if ("$value" in node) {
      const entry = {
        path: logical.join("."),
        theme,
        storage,
        value: node.$value,
        type,
        description: node.$description,
        extensions: node.$extensions,
      };
      entry.tier = tierOf(config, entry);
      entry.family = familyOf(config, entry.tier, entry.path);
      tokens.set(`${theme}:${entry.path}`, entry);
      return;
    }
    groups.set(`${theme}:${logical.join(".")}`, storage);
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith("$")) continue;
      const childTheme = storage.length === 0 ? themeOfRoot(config, key) : null;
      const skip = childTheme !== null || (isPlainObject(child) && child.$extensions?.pathSkip);
      walk(child, [...storage, key], skip ? logical : [...logical, key], type, childTheme ?? theme);
    }
  }
  walk(tree, [], [], undefined, "light");
  return { tokens, groups };
}

export function themeNames(config) {
  return ["light", ...Object.keys(config.themes ?? {})];
}

/** Light entries keyed by path. */
export function lightTokens(index) {
  const out = new Map();
  for (const e of index.tokens.values()) if (e.theme === "light") out.set(e.path, e);
  return out;
}

/** Effective entries for a theme: its overrides on top of light. */
export function effectiveTokens(index, theme) {
  const out = lightTokens(index);
  if (theme === "light") return out;
  for (const e of index.tokens.values())
    if (e.theme === theme && out.has(e.path)) out.set(e.path, { ...out.get(e.path), value: e.value, theme });
  return out;
}

/**
 * Flat form used by the Figma plugin and partial bundles:
 * { "<path>": { type, value, tier, description?, extensions?, themes?: { dark: value } } }
 */
export function toFlat(index) {
  const flat = {};
  for (const e of index.tokens.values()) {
    if (e.theme !== "light") continue;
    const item = { type: e.type, value: e.value, tier: e.tier };
    if (e.description !== undefined) item.description = e.description;
    if (e.extensions !== undefined) item.extensions = e.extensions;
    flat[e.path] = item;
  }
  for (const e of index.tokens.values()) {
    if (e.theme === "light") continue;
    const item = flat[e.path] ?? (flat[e.path] = { type: e.type, value: undefined, tier: e.tier, orphan: true });
    (item.themes ??= {})[e.theme] = e.value;
  }
  return flat;
}

function nodeAt(tree, storage) {
  let node = tree;
  for (const key of storage) node = node?.[key];
  return node;
}

function ensureNode(tree, storage) {
  let node = tree;
  for (const key of storage) {
    if (!isPlainObject(node[key])) node[key] = {};
    node = node[key];
  }
  return node;
}

function storageForNew(index, theme, path, config, tier) {
  const parts = path.split(".");
  const root = theme === "light" ? [] : [config.themes[theme].root];
  const tierRoot = config.tiers.find((t) => t.name === tier)?.match?.roots?.[0];
  for (let i = parts.length - 1; i >= 1; i--) {
    const group = index.groups.get(`${theme}:${parts.slice(0, i).join(".")}`);
    if (group && (!tierRoot || group[root.length] === tierRoot)) return [...group, ...parts.slice(i)];
  }
  return [...root, ...(tierRoot ? [tierRoot] : []), ...parts];
}

/** Tier root groups (match.roots) are pathSkip groups; mark one when an insert creates it. */
function markTierRoot(tree, storage, config, theme) {
  const depth = theme === "light" ? 0 : 1;
  const key = storage[depth];
  if (storage.length <= depth + 1 || !config.tiers.some((t) => t.match?.roots?.includes(key))) return;
  const node = nodeAt(tree, storage.slice(0, depth + 1));
  if (!node.$extensions?.pathSkip) node.$extensions = { ...node.$extensions, pathSkip: true };
}

function writeLeaf(leaf, value, type, inheritedType) {
  leaf.$value = value;
  // Keep an explicit $type; add one only where the group does not already give it.
  if (type && (type !== inheritedType || leaf.$type !== undefined)) leaf.$type = type;
}

function inheritedTypeAt(tree, storage) {
  let node = tree;
  let type;
  for (const key of storage.slice(0, -1)) {
    node = node?.[key];
    if (node?.$type) type = node.$type;
  }
  return type;
}

/**
 * Applies a flat token set onto a tree (returns a new tree and a change log).
 * strategy "merge" keeps tokens missing from the flat set; "replace" removes them.
 * only: optional list of path prefixes to restrict the import to.
 * storage: optional Map("theme:path" -> storage path) for new tokens (from an incoming tree).
 */
export function applyFlat(tree, flat, config, { strategy = "merge", only = null, storage: hints = null } = {}) {
  const next = JSON.parse(JSON.stringify(tree));
  const index = indexTree(tree, config);
  const inScope = (path) => !only || only.some((p) => path === p || path.startsWith(p + "."));
  const changes = { added: [], changed: [], removed: [] };

  for (const [path, item] of Object.entries(flat)) {
    if (!inScope(path)) continue;
    for (const theme of themeNames(config)) {
      const value = theme === "light" ? item.value : item.themes?.[theme];
      if (value === undefined) continue;
      const existing = index.tokens.get(`${theme}:${path}`);
      const storage = existing?.storage ?? hints?.get(`${theme}:${path}`) ?? storageForNew(index, theme, path, config, item.tier);
      const leaf = existing ? nodeAt(next, storage) : ensureNode(next, storage);
      if (!existing) markTierRoot(next, storage, config, theme);
      const before = existing ? JSON.stringify([existing.value, existing.type, existing.description ?? null]) : null;
      writeLeaf(leaf, value, item.type, inheritedTypeAt(next, storage));
      if (theme === "light") {
        if (item.description !== undefined) leaf.$description = item.description;
        if (item.extensions !== undefined) leaf.$extensions = item.extensions;
      }
      const after = JSON.stringify([value, item.type, theme === "light" ? (item.description ?? existing?.description ?? null) : (existing?.description ?? null)]);
      const id = theme === "light" ? path : `${path} (${theme})`;
      if (!existing) changes.added.push(id);
      else if (before !== after) changes.changed.push(id);
    }
  }

  if (strategy === "replace") {
    for (const e of index.tokens.values()) {
      if (!inScope(e.path)) continue;
      const item = flat[e.path];
      const keep = item && (e.theme === "light" ? item.value !== undefined : item.themes?.[e.theme] !== undefined);
      if (keep) continue;
      const parent = nodeAt(next, e.storage.slice(0, -1));
      if (parent) delete parent[e.storage.at(-1)];
      changes.removed.push(e.theme === "light" ? e.path : `${e.path} (${e.theme})`);
    }
  }
  return { tree: next, changes };
}

/** Restricts a tree to the given tiers (for partial exports). */
export function filterTreeByTier(tree, config, tiers) {
  const index = indexTree(tree, config);
  const next = JSON.parse(JSON.stringify(tree));
  const tierByPath = new Map([...lightTokens(index)].map(([p, e]) => [p, e.tier]));
  for (const e of index.tokens.values()) {
    if (tiers.includes(tierByPath.get(e.path) ?? e.tier)) continue;
    const parent = nodeAt(next, e.storage.slice(0, -1));
    if (parent) delete parent[e.storage.at(-1)];
  }
  (function prune(node) {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("$") || !isPlainObject(v) || "$value" in v) continue;
      prune(v);
      if (!Object.keys(v).some((c) => !c.startsWith("$"))) delete node[k];
    }
  })(next);
  return next;
}
