// Converts DTCG values to CSS. Shared by the built-in output formats and by custom ones.

import { isPlainObject } from "../core/tokens.mjs";

export function cssVarName(path, prefix = "") {
  return `--${prefix}${path.split(".").join("-")}`;
}

function dimension(v) {
  return isPlainObject(v) && "value" in v && "unit" in v ? `${v.value}${v.unit}` : v;
}

/** CSS text for a token value; references become var(--…). */
export function cssValue(value, type, extensions, prefix = "") {
  const refs = (s) => String(s).replace(/\{([^{}]+)\}/g, (_, p) => `var(${cssVarName(p, prefix)})`);
  if (typeof value === "string") return refs(value);
  if (Array.isArray(value)) {
    if (type === "cubicBezier") return `cubic-bezier(${value.join(", ")})`;
    if (type === "fontFamily") return value.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(", ");
    if (type === "shadow") return value.map((s) => cssValue(s, type, undefined, prefix)).join(", ");
    return value.map((v) => refs(dimension(v))).join(", ");
  }
  if (isPlainObject(value)) {
    if ("value" in value && "unit" in value) return `${value.value}${value.unit}`;
    if (type === "shadow")
      return [value.inset ? "inset" : "", value.offsetX, value.offsetY, value.blur, value.spread, value.color]
        .filter((p) => p !== undefined && p !== "")
        .map((p) => refs(dimension(p)))
        .join(" ");
    if (type === "border") return [value.width, value.style, value.color].map((p) => refs(dimension(p))).join(" ");
    return null; // typography and other composites have no single CSS value
  }
  if (type === "number" && extensions?.cssUnit) return `${value}${extensions.cssUnit}`;
  return String(value);
}
