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
  //   match.roots     top-level storage groups (e.g. "foundations")
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
  // A tier without match conditions catches everything left. Any number of tiers works:
  // two (core/semantic), three, or more. The default is a four-tier chain.
  tiers: [
    { name: "primitive", label: "Primitives", match: { roots: ["foundations"], literal: true }, references: [], literals: true, internal: true },
    { name: "scale", label: "Scale", match: { roots: ["foundations"] }, references: ["primitive", "scale"], internal: true },
    { name: "basic", label: "Basic", match: { prefixes: ["color", "space", "radius", "stroke", "text", "font", "motion", "shadow", "opacity"] }, references: ["scale", "primitive"] },
    { name: "component", label: "Component", match: {}, references: ["basic"], families: true, themes: false },
  ],
  themes: {
    dark: {
      root: "dark-mode",
      mediaQuery: "(prefers-color-scheme: dark)",
      selector: '[data-theme="dark"]',
    },
  },
  // One primary Basic role per Scale step, e.g. {"spacing.4": "space.gutter"}.
  primaryScaleRoles: {},
  // WCAG contrast checks, evaluated in every theme.
  contrastPairs: [],
  // Tiers whose tokens need a $description.
  requireDescriptions: ["basic", "component"],
  // Literal values a Basic/Component token may carry without a reference.
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
  const { tiers, themes, primaryScaleRoles, contrastPairs, requireDescriptions, technicalValues, cssPrefix } = config;
  return { tiers, themes, primaryScaleRoles, contrastPairs, requireDescriptions, technicalValues, cssPrefix };
}
