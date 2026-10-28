# Design tokens (token-kit)

This project styles UI only through design tokens. `tokens/tokens.json` (W3C DTCG format) is the single source of truth; everything in `src/styles/tokens/` is generated. The full rules are in `docs/token-contract.md`.

## Tiers

The tier model is configured in `tiers` in `token-kit.config.json`; read it before touching tokens. The default chain is Primitive → Scale → Semantic Basic → Component, and references always point down the chain:

- **Primitives** (`foundations.*`) hold literal values: hex colours, rem sizes, font families.
- **Scales** (`foundations.*`) alias Primitives, e.g. `spacing.4 = {size.4}`.
- **Semantic Basic** roles (`color.*`, `space.*`, `radius.*`, `stroke.*`, `text.*`, `motion.*`) alias Scales or Primitives and carry Light/Dark. Dark values live under `dark-mode.*`.
- **Component** tokens (`button.*`, `card.*`, …) alias Basic roles or tokens of their own family. They never override themes.

## When you write UI code

- Use `var(--…)` of Basic or Component tokens in CSS, or `token("…")` from `src/styles/tokens/tokens.ts` in React. Never hex, rgb(), px/rem literals, or Tailwind arbitrary values such as `p-[13px]` for colours, spacing, radius, type or strokes.
- Never reference Primitives or Scales (`--palette-…`, `--size-…`, `--spacing-…`) from components.
- A component styles only its own family. Parents do not set a child's tokens; add a variant to the child instead.
- Structural values are fine: `0`, `auto`, `100%`, `none`, `transparent`.

## When you touch tokens

1. **Reuse first.** Search the same domain for a role with a fitting meaning, not just an equal value.
2. **Align, do not tokenise, small deviations** from an established pattern.
3. **Semantic names only.** No values, units, hex codes or scale steps in names (`button.padding-16px` is wrong).
4. **New tokens need approval.** Propose role, owner, Basic backing, Primitive backing, Light/Dark behaviour and consumers (use `/token-propose`). Never add them on your own authority.

## Gates

After UI or token changes run `npx token-kit build` and `npx token-kit check`. `check` fails on any error and on open reviews above the shrink-only ratchet in `tokens/baselines/`. Never raise a baseline to make a check pass; `token-kit report --accept-new` is an explicit owner decision with a reason in the PR.

## Exchange

Tokens move between projects and Figma as `*.tokens.bundle.json`: `/token-export`, `/token-import`. Imports are dry runs until the diff and the check are clean.
