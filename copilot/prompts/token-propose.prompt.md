---
mode: agent
description: Propose a new design token (or find an existing one) following the token contract.
---

The user needs a token for: ${input:need:what should be styled, in which component}.

1. **Reuse first.** Search `tokens/tokens.json` in the same category (colour, spacing, radius, border width, opacity, typography, motion) for an existing token whose meaning fits. Equal values alone are not enough. If one fits, show it and how to use it (`var(--…)` / `token("…")`) and stop.
2. **Align deviations.** If the need differs only slightly from an existing pattern, recommend aligning to it instead of adding a token.
3. Otherwise write a proposal table and do not edit `tokens.json`:

| Field | Value |
| --- | --- |
| Name | per `docs/token-contract.md`: Semantic Category-Property-Variant-Scale, Component Component-Property-Variant-State-Scale; no values or units |
| Tier | Semantic or Component (family) |
| Owner | component or team |
| Semantic backing | for Component tokens |
| Primitive backing | for Semantic tokens (new Primitive only if no step fits) |
| Light / Dark | values per theme, or "inherits" |
| Consumers | files that will use it |
| Description | one sentence for `$description` |

4. Only after the user approves the exact list, add the token(s), run `npx token-kit build` and `npx token-kit check`, and mention the approval in the PR.
