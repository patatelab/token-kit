# Design tokens (token-kit)

This project styles UI only through design tokens. `tokens/tokens.json` (W3C DTCG format) is the single source of truth; everything in `src/styles/tokens/` is generated. The full rules are in `docs/token-contract.md`.

## Tiers

The tier model is configured in `tiers` in `token-kit.config.json`; read it before touching tokens. The chain is RAW value → Primitive → Semantic → Component, and each token references only the next higher tier:

- **Primitive** (under `primitive`, Figma collection "Primitive") hold the RAW values: `color-blue-500`, `size-200`, `radius-500`, `opacity-500`. Never used in product code.
- **Semantic** (under `semantic`, Figma collection "Semantic") give Primitives a meaning and carry Light/Dark: `color-text-supplementary`, `color-primary-default`, `color-error-default`, `spacing-md`, `radius-md`, `opacity-disabled`. Dark values live under `dark-mode.semantic.*`.
- **Component** (`button.*`, `card.*`, `snackbar.*`, Figma collection "Components") reference Semantic tokens or tokens of their own family: `button-bg-primary-default`, `button-padding-x-md`. They never override themes.

## When you write UI code

- Use `var(--…)` of Semantic or Component tokens in CSS, or `token("…")` from `src/styles/tokens/tokens.ts` in React. Never hex, rgb(), px/rem literals, or Tailwind arbitrary values such as `p-[13px]` for colours, spacing, radius, type or strokes.
- Never reference Primitives (`--color-blue-500`, `--size-200`, `--radius-500`) from components.
- A component styles only its own family. Parents do not set a child's tokens; add a variant to the child instead.
- Structural values are fine: `0`, `auto`, `100%`, `none`, `transparent`.

## When you touch tokens

1. **Reuse first.** Search the same category for a token with a fitting meaning, not just an equal value.
2. **Align, do not tokenise, small deviations** from an established pattern.
3. **Names follow the taxonomy** (lowercase, hyphen-separated, one group level per part):
   - Primitive: Category-Property-Variant-Scale, numeric scale (`color-blue-500`, `font-family-mark-pro`).
   - Semantic: Category-Property-Variant-Scale, scale as words (`color-primary-strong`, `radius-md`). Colour areas: Brand, Usage (`bg`, `text`, `border`, `icon`), Role (`primary`, `secondary`, `tertiary`), Intent (`success`, `warning`, `error`, `info`).
   - Component: Component-Property-Variant-State-Scale (`button-icon-primary-hover`), states `default`, `hover`, `pressed`, `focus`, `disabled`, sizes `sm`, `md`, `lg`.
   - Never values, units or hex codes in names (`button-padding-16px` is wrong).
4. **New tokens need approval.** Propose tier, name, owner, Semantic and Primitive backing, Light/Dark behaviour and consumers (use `/token-propose`). Never add them on your own authority.

Background on naming levels and principles: `docs/knowledge/naming-tokens.md`.

## Gates

After UI or token changes run `npx token-kit build` and `npx token-kit check`. `check` fails on any error and on open reviews above the shrink-only ratchet in `tokens/baselines/`. Never raise a baseline to make a check pass; `token-kit report --accept-new` is an explicit owner decision with a reason in the PR.

## Exchange

Tokens move between projects and Figma as `*.tokens.bundle.json`: `/token-export`, `/token-import`. Imports are dry runs until the diff and the check are clean.
