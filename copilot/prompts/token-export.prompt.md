---
mode: agent
description: Export the design tokens as a token-kit bundle (for another project or Figma).
---

Export this project's design tokens.

1. Run `npx token-kit check`. If it fails, list the failing findings and stop: only conform tokens are exported.
2. Ask which tiers to export if the user did not say. Defaults: all tiers. For a new project usually `--tiers primitive,scale,basic` (without this project's components).
3. Run `npx token-kit export --out tokens.bundle.json` (add `--tiers …` when chosen; add `--flat` only when the target is the Figma plugin and the user asked for the flat form — the plugin reads both).
4. Report: number of tokens, the checksum, the file path, and what the receiver should do next (`/token-import` in the target project, or "Import bundle" in the Figma plugin).
