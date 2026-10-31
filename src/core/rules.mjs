// Token model rules (graph, tiers, naming, themes, contrast). Pure JavaScript.
// Each finding: {rule, severity: "error"|"review", subject, message, suggestion}.

import { aliasOf, effectiveTokens, familyOf, isPlainObject, lightTokens, referencesOf, themeNames, tierOf } from "./tokens.mjs";
import { contrastRatio, parseColor } from "./color.mjs";

export const RULES = {
  TOKEN_KEY_SYNTAX: "Token keys are lowercase kebab-case.",
  TOKEN_TYPE_MISSING: "Every token has a $type (directly or inherited from its group).",
  TOKEN_REF_MISSING: "Every reference points to an existing token.",
  TOKEN_REF_CYCLE: "References never form a cycle, in any theme.",
  TOKEN_TIER_CHAIN: "Each token references only the next higher tier (default: Component -> Semantic -> Primitive). No skipping, no foreign families.",
  TOKEN_RAW_VALUE: "Only tiers with literals: true (default: Primitive) hold RAW values; the others reference tokens.",
  TOKEN_TYPE_MISMATCH: "An alias has the same $type as its target.",
  TOKEN_THEME_ORPHAN: "A theme override has a base (light) token.",
  TOKEN_THEME_OVERRIDE: "Tiers with themes: false (default: Component) inherit themes from the roles they reference.",
  TOKEN_NAME_LITERAL: "Names describe the role, never the value (no px, hex, raw; numeric scale steps only in Primitives, and a step is a position, not the value).",
  TOKEN_NAME_STRUCTURE: "Names start with a category the tier allows (naming.categories), e.g. color-, spacing-, font-size-.",
  TOKEN_ROLE_DUPLICATE: "Each configured Primitive step has exactly one primary Semantic role (primaryRoles).",
  TOKEN_DESCRIPTION_MISSING: "Semantic and Component tokens carry a $description.",
  TOKEN_CONTRAST: "Configured text/background pairs meet their WCAG contrast minimum in every theme.",
  TOKEN_CONTRACT: "$extensions contracts (semanticAliases, componentContexts) are complete and valid.",
};

const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Names that encode a value: raw/literal leaves, units, hex codes.
// Values in names: raw-/literal-, units, hex codes, value prefixes (number-60, factor-0-75, negative-100percent, angle-180deg).
const LITERAL_NAME = /(?:^|[.-])(?:raw|literal)(?:-|$)|\d+(?:px|rem|percent|em|ch|deg|ms|s|vh|vw|dvh|svh|lvh|pt)(?:$|[.-])|(?:^|[.-])hex-[0-9a-f]{3,8}(?:$|[.-])|(?:^|[.-])(?:number|factor|angle|negative)-\d/;
// Numeric scale steps (color-blue-500, size-200) belong to Primitives; roles use words (md, strong).
const STEP_NAME = /(?:^|[.-])\d{2,}(?:$|[.-])|(?:^|[.-])(?:spacing|space|size|width|height)[.-]\d+(?:$|[.-])/;

function finding(rule, severity, subject, message, suggestion) {
  return { rule, severity, subject, message, suggestion: suggestion ?? RULES[rule] };
}

/** Builds an index (same shape as indexTree) from the flat form used by Figma. */
export function indexFlat(flat, config) {
  const tokens = new Map();
  for (const [path, item] of Object.entries(flat)) {
    const base = { path, storage: path.split("."), type: item.type, description: item.description, extensions: item.extensions };
    const tier = item.tier ?? tierOf(config, { ...base, value: item.value });
    const family = familyOf(config, tier, path);
    if (item.value !== undefined) tokens.set(`light:${path}`, { ...base, theme: "light", value: item.value, tier, family });
    for (const [theme, value] of Object.entries(item.themes ?? {}))
      tokens.set(`${theme}:${path}`, { ...base, theme, value, tier, family });
  }
  return { tokens, groups: new Map() };
}

function rootContracts(tree) {
  return isPlainObject(tree?.$extensions) ? tree.$extensions : {};
}

/** Follows aliases to a literal value; null when unresolvable or cyclic. */
export function resolveValue(tokens, path, seen = new Set()) {
  const e = tokens.get(path);
  if (!e || seen.has(path)) return null;
  seen.add(path);
  const target = aliasOf(e.value);
  return target ? resolveValue(tokens, target, seen) : e.value;
}

function findCycles(tokens) {
  const cycles = new Set();
  const state = new Map();
  function visit(path, stack) {
    if (state.get(path) === "done") return;
    if (state.get(path) === "open") {
      cycles.add(stack.slice(stack.indexOf(path)).join(" -> ") + " -> " + path);
      return;
    }
    state.set(path, "open");
    const e = tokens.get(path);
    for (const r of e ? referencesOf(e.value) : []) if (tokens.has(r)) visit(r, [...stack, path]);
    state.set(path, "done");
  }
  for (const path of tokens.keys()) visit(path, []);
  return [...cycles];
}

function allowedReference(config, contracts, e, target) {
  const tier = config.tiers.find((t) => t.name === e.tier);
  if (!tier) return false;
  if (tier.allowPrefixes?.some((p) => target.path === p || target.path.startsWith(p.endsWith(".") ? p : p + "."))) return true;
  if (target.tier === e.tier) {
    if (tier.families && target.family === e.family) return true;
    if (contracts.semanticAliases?.[e.path]?.target === target.path) return true;
    if (tier.families && target.family) {
      const leaf = target.path.slice(target.family.length + 1);
      if (contracts.componentContexts?.[target.family]?.consumers?.[e.family]?.includes(leaf)) return true;
    }
  }
  return (tier.references ?? []).includes(target.tier);
}

/**
 * Runs every model rule. `index` comes from indexTree or indexFlat; `tree` is optional
 * and only used for root-level $extensions contracts.
 */
export function checkModel(index, config, tree = null) {
  const findings = [];
  const contracts = rootContracts(tree);
  const light = lightTokens(index);
  const technical = new Set(config.technicalValues.map(String));
  // var(--name) inside values also references tokens (and registered cssAliases).
  const prefix = config.cssPrefix ?? "";
  const byCssName = new Map([...light.keys()].map((p) => [`--${prefix}${p.split(".").join("-")}`, p]));
  for (const [name, path] of Object.entries(contracts.cssAliases ?? {})) byCssName.set(name, path);
  const referencesWithVars = (value) => {
    const refs = referencesOf(value);
    (function visit(v) {
      if (typeof v === "string") for (const m of v.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) refs.push(byCssName.get(m[1]) ?? `var(${m[1]})`);
      else if (Array.isArray(v)) v.forEach(visit);
      else if (isPlainObject(v)) Object.values(v).forEach(visit);
    })(value);
    return refs;
  };

  for (const e of index.tokens.values()) {
    const themed = e.theme === "light" ? e.path : `${e.path} (${e.theme})`;
    for (const key of e.storage) {
      if (!KEY_PATTERN.test(key)) findings.push(finding("TOKEN_KEY_SYNTAX", "error", themed, `invalid key "${key}"`));
    }
    if (!e.type) findings.push(finding("TOKEN_TYPE_MISSING", "error", themed, "no $type"));

    if (e.theme !== "light") {
      if (!light.has(e.path)) findings.push(finding("TOKEN_THEME_ORPHAN", "error", themed, `${e.theme} override without base token`));
      else if (config.tiers.find((t) => t.name === light.get(e.path).tier)?.themes === false)
        findings.push(finding("TOKEN_THEME_OVERRIDE", "review", themed, `${light.get(e.path).tier} ${e.theme} override`, "Override the role it references instead."));
    }

    const subject = e.theme === "light" ? e : { ...e, tier: light.get(e.path)?.tier ?? e.tier, family: light.get(e.path)?.family ?? e.family };
    const refs = referencesWithVars(e.value);
    for (const r of refs) {
      const target = light.get(r);
      if (!target) {
        findings.push(finding("TOKEN_REF_MISSING", "error", themed, r.startsWith("var(") ? `unknown ${r}` : `missing reference {${r}}`));
        continue;
      }
      if (!allowedReference(config, contracts, subject, target))
        findings.push(finding("TOKEN_TIER_CHAIN", "error", themed, `${subject.tier} -> ${target.tier} {${r}}`));
    }
    const subjectTier = config.tiers.find((t) => t.name === subject.tier);
    if (!refs.length && !subjectTier?.literals && !technical.has(String(e.value)))
      findings.push(finding("TOKEN_RAW_VALUE", "error", themed, `literal ${JSON.stringify(e.value)} in ${subject.tier} token`, `Reference a ${(subjectTier?.references ?? []).join(" or ") || "token"} token instead.`));

    const alias = aliasOf(e.value);
    const target = alias && light.get(alias);
    if (target && e.type && target.type && target.type !== e.type)
      findings.push(finding("TOKEN_TYPE_MISMATCH", "review", themed, `${e.type} aliases ${target.type} {${alias}}`));

    if (e.theme === "light") {
      if (LITERAL_NAME.test(e.path) || (!subjectTier?.literals && STEP_NAME.test(e.path)))
        findings.push(finding("TOKEN_NAME_LITERAL", "error", e.path, "name encodes a value"));
      const categories = subjectTier?.naming?.categories;
      const name = e.path.split(".").join("-");
      if (categories?.length && !categories.some((c) => name === c || name.startsWith(c + "-")))
        findings.push(finding("TOKEN_NAME_STRUCTURE", "error", e.path, `"${name}" starts with no ${subject.tier} category`, `Start with one of: ${categories.join(", ")}.`));
      if (config.requireDescriptions.includes(e.tier) && !e.description)
        findings.push(finding("TOKEN_DESCRIPTION_MISSING", "review", e.path, "no $description"));
    }
  }

  // One primary Semantic role per configured Primitive step.
  for (const [step, primary] of Object.entries(config.primaryRoles ?? {})) {
    const domain = primary.split(".")[0] + ".";
    for (const e of light.values())
      if (e.tier === light.get(primary)?.tier && e.path !== primary && e.path.startsWith(domain) && aliasOf(e.value) === step)
        findings.push(finding("TOKEN_ROLE_DUPLICATE", "error", e.path, `second ${e.tier} alias of ${step}`, `Use ${primary}.`));
  }

  for (const theme of themeNames(config)) {
    const effective = effectiveTokens(index, theme);
    for (const cycle of findCycles(effective))
      findings.push(finding("TOKEN_REF_CYCLE", "error", cycle.split(" -> ")[0], `${theme}: ${cycle}`));
    for (const pair of config.contrastPairs ?? []) {
      const fg = parseColor(resolveValue(effective, pair.foreground));
      const bg = parseColor(resolveValue(effective, pair.background));
      const subject = `${pair.foreground} on ${pair.background}`;
      if (!fg || !bg) {
        findings.push(finding("TOKEN_CONTRAST", "review", subject, `${theme}: colour not resolvable`));
        continue;
      }
      const ratio = contrastRatio(fg, bg);
      const min = pair.min ?? 4.5;
      if (ratio < min) findings.push(finding("TOKEN_CONTRAST", "error", subject, `${theme}: ${ratio.toFixed(2)}:1 < ${min}:1`));
    }
  }

  for (const [path, alias] of Object.entries(contracts.semanticAliases ?? {}))
    if (!alias?.reason || !light.has(path) || !light.has(alias?.target))
      findings.push(finding("TOKEN_CONTRACT", "error", `semanticAliases.${path}`, "needs an existing source, target and a reason"));
  for (const [owner, ctx] of Object.entries(contracts.componentContexts ?? {}))
    if (!ctx?.reason || !isPlainObject(ctx.consumers) || !Object.keys(ctx.consumers).length)
      findings.push(finding("TOKEN_CONTRACT", "error", `componentContexts.${owner}`, "needs a reason and consumers"));

  return findings.sort((a, b) => a.subject.localeCompare(b.subject) || a.rule.localeCompare(b.rule));
}
