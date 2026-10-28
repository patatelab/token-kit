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
      label: "Foundation Collection",
      match: { roots: ["primitive"] },
      references: [],
      literals: true,
      internal: true,
      naming: {
        categories: ["color", "font-family", "font-weight", "font-size", "line-height", "letter-spacing", "size", "space", "radius", "border", "shadow", "opacity", "elevation", "breakpoint", "motion", "z-index"],
      },
    },
    {
      name: "semantic",
      label: "Alias Collection",
      match: { roots: ["semantic"] },
      references: ["primitive"],
      naming: {
        categories: ["color", "spacing", "radius", "border-width", "opacity", "blur", "shadow", "font-family", "font-size", "font-weight", "line-height", "letter-spacing", "motion", "z-index", "elevation", "breakpoint"],
      },
    },
    { name: "component", label: "Control Collection", match: {}, references: ["semantic"], families: true, themes: false },
  ],
  themes: {
    dark: {
      root: "dark-mode",
      mediaQuery: "(prefers-color-scheme: dark)",
      selector: '[data-theme="dark"]',
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
  if (!config.tiers?.length) throw new Error("token-kit config: tiers must not be empty");
  return config;
}

export function tierByName(config, name) {
  return config.tiers.find((t) => t.name === name) ?? config.tiers.at(-1);
}

/** The subset of the config that travels inside a bundle. */
export function portableConfig(config) {
  const { tiers, themes, primaryRoles, contrastPairs, requireDescriptions, technicalValues, cssPrefix } = config;
  return { tiers, themes, primaryRoles, contrastPairs, requireDescriptions, technicalValues, cssPrefix };
}
