// Kit configuration: defaults merged with token-kit.config.json.
// Pure JavaScript (no Node APIs) so the Figma plugin can bundle it.

export const DEFAULT_CONFIG = {
  tokens: "tokens/tokens.json",
  outDir: "src/styles/tokens",
  // Output format modules (see src/node/formats/). Replace or add your own.
  formats: ["css-variables", "typescript"],
  cssPrefix: "",
  tailwindNamespace: "tk",
  // The tier model. Order matters: a token belongs to the first tier whose `match` fits.
  //   label           Figma collection name
  //   match.roots     top-level storage groups (e.g. "primitive"; mark them "$extensions": {"pathSkip": true})
  //   match.prefixes  logical path prefixes (e.g. "color" matches color.*)
  //   match.paths     exact logical paths
  //   match.literal   true: only literal values, false: only references
  //   references      tiers this tier may reference
  //   literals        may hold literal values (otherwise TOKEN_RAW_VALUE)
  //   families        first path segment is a family; same-family references are allowed,
  //                   other families only through $extensions.componentContexts
  //   allowPrefixes   further logical prefixes this tier may reference
  //   internal        not consumed by product code (source audit, TypeScript output)
  //   themes          may carry theme overrides (false: TOKEN_THEME_OVERRIDE review)
  //   naming.categories  allowed leading name parts (TOKEN_NAME_STRUCTURE), e.g. "color", "font-size"
  // A tier without match conditions catches everything left. Any number of tiers works.
  // The default follows the token guideline: RAW value -> Primitive -> Semantic -> Component,
  // each tier references only the next higher one (docs/token-contract.md).
  tiers: [
    {
      name: "primitive",
      label: "Primitive",
      match: { roots: ["primitive"] },
      references: [],
      literals: true,
      internal: true,
      themes: false,
      naming: {
        categories: ["color", "font-family", "font-weight", "font-size", "line-height", "letter-spacing", "size", "space", "spacing", "radius", "border", "shadow", "blur", "opacity", "elevation", "breakpoint", "motion", "z-index"],
      },
    },
    {
      name: "semantic",
      label: "Semantic",
      match: { roots: ["semantic"] },
      references: ["primitive"],
      naming: {
        categories: ["color", "spacing", "radius", "border-width", "opacity", "blur", "shadow", "font-family", "font-size", "font-weight", "line-height", "letter-spacing", "motion", "z-index", "elevation", "breakpoint"],
      },
    },
    { name: "component", label: "Components", match: {}, references: ["semantic"], families: true, themes: false },
  ],
  themes: {
    dark: {
      root: "dark-mode",
      mediaQuery: "(prefers-color-scheme: dark)",
      selector: '[data-theme="dark"]',
    },
  },
  // How variables look in Figma (src/core/figma-layout.mjs). The default follows the reference
  // file: collections Primitive/Semantic/Components, bold headings with divider variables,
  // colour sections Brand/Usage/Role/Intent, component names joined after the component,
  // opacity in percent, font weights as style names and shadows as layer variables.
  figma: {
    collections: {
      primitive: { modes: { light: "Mode 1" } },
      semantic: { modes: { light: "light", dark: "dark" } },
      component: { modes: { light: "Value" } },
    },
    dividers: true,
    blocks: {
      primitive: [
        { heading: "SWATCHES", prefixes: ["color"] },
        { heading: "DIMENSION", prefixes: ["spacing", "space", "radius", "border", "size"] },
        { heading: "EFFECT", prefixes: ["opacity", "shadow", "blur", "elevation", "z-index"] },
        { heading: "TYPOGRAPHY", prefixes: ["font", "font-family", "font-weight", "font-size", "line-height", "letter-spacing"] },
        { heading: "MOTION", prefixes: ["motion", "duration", "easing"] },
      ],
      semantic: [
        { prefixes: ["color"] },
        { heading: "DIMENSION", prefixes: ["radius", "border-width", "spacing", "size"] },
        { heading: "EFFECT", prefixes: ["opacity", "blur", "shadow", "elevation", "z-index"] },
        { heading: "TYPOGRAPHY", prefixes: ["font-family", "font-weight", "font-size", "line-height", "letter-spacing"] },
        { heading: "MOTION", prefixes: ["motion"] },
      ],
      component: [
        { heading: "ACTION", prefixes: ["button", "link", "icon-button"] },
        { heading: "FEEDBACK", prefixes: ["snackbar", "badge", "alert", "toast"] },
        { heading: "CONTAINMENT", prefixes: ["card", "dialog", "sheet"] },
      ],
    },
    sections: {
      semantic: [
        { heading: "BRAND", insertAt: 1, match: ["color.brand", "color.*.brand-*", "color.accent"] },
        { heading: "USAGE", insertAt: 1, match: ["color.bg", "color.background", "color.text", "color.border", "color.icon", "color.illustration", "color.surface"] },
        { heading: "ROLE", insertAt: 1, match: ["color.primary", "color.secondary", "color.tertiary"] },
        { heading: "INTENT", insertAt: 1, match: ["color.neutral", "color.info", "color.success", "color.warning", "color.error"] },
      ],
    },
    joinFrom: { component: 1 },
    percent: ["opacity"],
    remBase: 16,
    fontWeights: { 100: "Thin", 200: "Extra Light", 300: "Light", 400: "Regular", 500: "Medium", 600: "Semi Bold", 700: "Bold", 800: "Heavy", 900: "Black" },
    shadowLayers: true,
    scopes: [
      { tiers: ["primitive"], match: ["spacing", "space"], scopes: ["GAP"] },
      { tiers: ["primitive"], match: ["radius"], scopes: ["CORNER_RADIUS"] },
      { tiers: ["primitive"], match: ["border"], scopes: ["STROKE_FLOAT"] },
      { tiers: ["primitive"], match: ["size", "blur"], scopes: ["WIDTH_HEIGHT"] },
      { tiers: ["primitive"], match: ["font-family", "font.family"], scopes: ["FONT_FAMILY"] },
      { match: ["font-size", "font.size"], scopes: ["FONT_SIZE"] },
      { tiers: ["semantic"], match: ["line-height"], scopes: ["LINE_HEIGHT"] },
    ],
    hidden: [
      { tiers: ["primitive"], match: ["*"], hidden: true },
      { tiers: ["semantic"], match: ["font-size", "line-height"], hidden: true },
    ],
    types: {
      "font-weight": "fontWeight",
      "font-family": "fontFamily",
      "font-size": "dimension",
      "line-height": "dimension",
      "letter-spacing": "dimension",
      opacity: "number",
      "motion-duration": "duration",
      duration: "duration",
    },
  },
  // One primary Semantic role per Primitive step, e.g. {"radius.500": "radius.md"}.
  primaryRoles: {},
  // WCAG contrast checks, evaluated in every theme.
  contrastPairs: [],
  // Tiers whose tokens need a $description.
  requireDescriptions: ["semantic", "component"],
  // Literal values a Semantic/Component token may carry without a reference.
  technicalValues: ["0", "none", "transparent", "auto", "inherit", "currentColor", "100%"],
  source: {
    roots: ["src"],
    extensions: [".css", ".scss", ".tsx", ".jsx"],
    ignore: ["node_modules", "dist", "build", ".next", "generated", "tokens"],
  },
  baselines: {
    ratchet: "tokens/baselines/open-review-ratchet.json",
    knownErrors: "tokens/baselines/known-errors.json",
  },
};

export function resolveConfig(user = {}) {
  const config = { ...DEFAULT_CONFIG, ...user };
  config.themes = { ...DEFAULT_CONFIG.themes, ...(user.themes ?? {}) };
  config.source = { ...DEFAULT_CONFIG.source, ...(user.source ?? {}) };
  config.baselines = { ...DEFAULT_CONFIG.baselines, ...(user.baselines ?? {}) };
  config.figma = { ...DEFAULT_CONFIG.figma, ...(user.figma ?? {}) };
  if (!config.tiers?.length) throw new Error("token-kit config: tiers must not be empty");
  return config;
}

export function tierByName(config, name) {
  return config.tiers.find((t) => t.name === name) ?? config.tiers.at(-1);
}

/** The subset of the config that travels inside a bundle. */
export function portableConfig(config) {
  const { tiers, themes, primaryRoles, contrastPairs, requireDescriptions, technicalValues, cssPrefix, figma } = config;
  return { tiers, themes, primaryRoles, contrastPairs, requireDescriptions, technicalValues, cssPrefix, figma };
}
