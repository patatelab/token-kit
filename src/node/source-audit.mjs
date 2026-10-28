// Source audit: finds design values in CSS and JSX/TSX that bypass the tokens.
// Regex-based and dependency-free. Contract: stable rule IDs,
// severity error (fails) or review (frozen by the ratchet), file + line, suggestion.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { cssVarName } from "./css-value.mjs";

export const SOURCE_RULES = {
  TOKEN_SOURCE_COLOR: "Colours come from tokens: use var(--color-…) or token(\"…\").",
  TOKEN_SOURCE_LENGTH: "Spacing, radius, type sizes and strokes come from tokens.",
  TOKEN_SOURCE_UNKNOWN_VAR: "var(--…) must name a token or a custom property declared in the same file.",
  TOKEN_SOURCE_TIER_BYPASS: "Product code never reads internal tiers (default: Primitives and Scales).",
  TOKEN_SOURCE_TAILWIND_ARBITRARY: "No Tailwind arbitrary values for design properties; use the token theme.",
};

const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/;
const LENGTH = /(?<![\w.-])-?\d*\.?\d+(?:px|rem|em)\b/;
const DESIGN_LENGTH_PROPS =
  /^(?:margin|padding|gap|row-gap|column-gap|font-size|letter-spacing|line-height|border-radius|border(?:-[a-z]+)*-width|border-width|outline-width|outline-offset|box-shadow|text-shadow|inset|top|right|bottom|left|width|height|min-width|max-width|min-height|max-height|(?:margin|padding|inset)-[a-z-]+|border-[a-z-]+-radius)$/;
const STRUCTURAL = new Set(["0", "0px", "auto", "none", "100%", "inherit", "initial", "unset", "transparent", "currentColor", "currentcolor"]);

function walkFiles(root, dir, config, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (config.source.ignore.includes(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walkFiles(root, full, config, out);
    else if (config.source.extensions.includes(extname(name)) && !/\.(test|spec|stories)\.[jt]sx?$/.test(name)) out.push(full);
  }
}

function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function blankComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function camelToKebab(name) {
  return name.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
}

/**
 * tokenVars: Map<css var name, tier> of all tokens.
 * Returns findings with file (relative to cwd), line, rule, severity, message.
 */
export function auditSource(cwd, config, tokenVars) {
  const internal = new Set(config.tiers.filter((t) => t.internal).map((t) => t.name));
  const files = [];
  for (const root of config.source.roots) walkFiles(cwd, join(cwd, root), config, files);
  const allowedVars = new Set(config.source.allowedVars ?? []);
  const findings = [];

  for (const file of files.sort()) {
    const rel = relative(cwd, file);
    const raw = readFileSync(file, "utf8");
    const text = blankComments(raw);
    const isCss = /\.(css|scss)$/.test(file);
    const localVars = new Set([...text.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]));
    const push = (index, rule, severity, message) =>
      findings.push({ rule, severity, subject: rel, line: lineAt(text, index), message, suggestion: SOURCE_RULES[rule] });

    const checkValue = (index, prop, value) => {
      if (STRUCTURAL.has(value.trim())) return;
      if (prop.startsWith("--")) return; // local custom properties are checked where they are used
      const withoutVars = value.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "");
      if (COLOR.test(withoutVars)) push(index, "TOKEN_SOURCE_COLOR", "error", `${prop}: ${value.trim()}`);
      else if (DESIGN_LENGTH_PROPS.test(prop) && LENGTH.test(withoutVars)) push(index, "TOKEN_SOURCE_LENGTH", "review", `${prop}: ${value.trim()}`);
    };

    if (isCss) {
      for (const m of text.matchAll(/(?:^|[;{\s])(-{0,2}[a-zA-Z][a-zA-Z0-9-]*)\s*:\s*([^;{}]+?)\s*(?=;|})/g))
        checkValue(m.index, m[1].toLowerCase(), m[2]);
    } else {
      for (const m of text.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
        for (const p of m[1].matchAll(/([A-Za-z]+)\s*:\s*("[^"]*"|'[^']*'|`[^`$]*`|-?\d+(?:\.\d+)?)(?=\s*[,}\n]|\s*$)/g)) {
          const prop = camelToKebab(p[1]);
          const literal = p[2].replace(/^["'`]|["'`]$/g, "");
          const value = /^-?\d/.test(p[2]) && p[2] !== "0" && DESIGN_LENGTH_PROPS.test(prop) ? `${literal}px` : literal;
          checkValue(m.index + 8 + p.index, prop, value);
        }
      }
      for (const m of text.matchAll(/["'`][^"'`\n]*?#[0-9a-fA-F]{6}\b[^"'`\n]*?["'`]/g))
        if (!/style=\{\{/.test(text.slice(Math.max(0, m.index - 200), m.index)))
          push(m.index, "TOKEN_SOURCE_COLOR", "review", `string literal ${m[0]}`);
    }

    for (const m of text.matchAll(/\b([a-z]+(?:-[a-z]+)*)-\[([^\]\s]+)\]/g)) {
      const value = m[2];
      if (COLOR.test(value)) push(m.index, "TOKEN_SOURCE_TAILWIND_ARBITRARY", "error", `${m[0]}`);
      else if (LENGTH.test(value)) push(m.index, "TOKEN_SOURCE_TAILWIND_ARBITRARY", "review", `${m[0]}`);
    }

    for (const m of text.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) {
      const name = m[1];
      const tier = tokenVars.get(name);
      if (internal.has(tier)) push(m.index, "TOKEN_SOURCE_TIER_BYPASS", "error", `${name} is a ${tier} token`);
      else if (!tier && !localVars.has(name) && !allowedVars.has(name)) push(m.index, "TOKEN_SOURCE_UNKNOWN_VAR", "error", `unknown ${name}`);
    }
  }
  return findings;
}

/** css var name -> tier for every token in the index. */
export function tokenVarTiers(index, config) {
  const map = new Map();
  for (const e of index.tokens.values()) if (e.theme === "light") map.set(cssVarName(e.path, config.cssPrefix ?? ""), e.tier);
  return map;
}
