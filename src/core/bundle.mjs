// Exchange format: *.tokens.bundle.json. Pure JavaScript.
// kind "tree": tokens is a DTCG tree (CLI export, round-trips everything).
// kind "flat": tokens is { path: {type, value, tier, description?, extensions?, themes?} } (Figma plugin export),
//   with the tree's root $extensions in `contracts`.

import { sha256Hex } from "./sha256.mjs";
import { isPlainObject } from "./tokens.mjs";

export const BUNDLE_FORMAT = "token-kit-bundle";
export const BUNDLE_VERSION = 1;

/** JSON with sorted object keys, so checksums do not depend on key order. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isPlainObject(value))
    return `{${Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function checksumOf(tokens) {
  return `sha256:${sha256Hex(canonicalJson(tokens))}`;
}

export function createBundle({ kind, tokens, config, source = {}, baselines, contracts, exportedAt = new Date().toISOString() }) {
  const bundle = { format: BUNDLE_FORMAT, version: BUNDLE_VERSION, kind, exportedAt, source, config, tokens };
  if (baselines) bundle.baselines = baselines;
  // Flat bundles carry the tree's root $extensions (cssAliases, semanticAliases, componentContexts) separately.
  if (contracts) bundle.contracts = contracts;
  bundle.checksum = checksumOf(tokens);
  return bundle;
}

/** Structural validation; returns a list of error strings (empty when valid). */
export function validateBundle(bundle) {
  const errors = [];
  if (!isPlainObject(bundle)) return ["bundle is not a JSON object"];
  if (bundle.format !== BUNDLE_FORMAT) errors.push(`format must be "${BUNDLE_FORMAT}"`);
  if (bundle.version !== BUNDLE_VERSION) errors.push(`unsupported version ${bundle.version}`);
  if (!["tree", "flat"].includes(bundle.kind)) errors.push('kind must be "tree" or "flat"');
  if (!isPlainObject(bundle.tokens)) errors.push("tokens must be an object");
  if (!isPlainObject(bundle.config)) errors.push("config must be an object");
  if (typeof bundle.checksum !== "string") errors.push("checksum missing");
  else if (isPlainObject(bundle.tokens) && checksumOf(bundle.tokens) !== bundle.checksum)
    errors.push("checksum mismatch: the tokens were changed after export");
  if (bundle.kind === "flat" && isPlainObject(bundle.tokens))
    for (const [path, item] of Object.entries(bundle.tokens))
      if (!isPlainObject(item) || (item.value === undefined && !isPlainObject(item.themes))) errors.push(`token ${path}: needs value or themes`);
  return errors;
}

/** Differences between two flat token sets (added / changed / removed paths). */
export function diffFlat(before, after) {
  const added = [];
  const changed = [];
  const removed = [];
  for (const [path, item] of Object.entries(after)) {
    if (!(path in before)) added.push(path);
    else if (canonicalJson(strip(before[path])) !== canonicalJson(strip(item))) changed.push(path);
  }
  for (const path of Object.keys(before)) if (!(path in after)) removed.push(path);
  return { added, changed, removed };
}

function strip({ type, value, description, themes }) {
  return { type, value, description, themes };
}
