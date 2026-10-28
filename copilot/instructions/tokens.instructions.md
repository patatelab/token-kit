---
applyTo: "**/*.css,**/*.scss,**/*.tsx,**/*.jsx"
---

# Styling with tokens

- Colours, spacing, radius, strokes, type and motion come from Basic or Component tokens: `var(--color-text-default)`, `var(--button-padding-inline)` or `token("button.radius")`.
- No literals for those properties (hex, rgb(), hsl(), px, rem, em) and no Tailwind arbitrary values (`bg-[#fff]`, `p-[13px]`).
- No Primitive or Scale variables (`--palette-*`, `--size-*`, `--spacing-*`, `--corner-*`, `--font-scale-*`) in components.
- A component reads only its own family (`--card-*` in CardUI). To change a child, use the child's props or variants.
- Local custom properties are allowed when they are derived from tokens in the same file: `--_inset: calc(var(--space-gutter) * 2);`.
- Missing a fitting token? Stop and run `/token-propose` instead of inventing one or hard-coding a value.
- Afterwards: `npx token-kit check`.
