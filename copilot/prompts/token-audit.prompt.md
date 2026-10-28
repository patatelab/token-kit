---
mode: agent
description: Run the token audit and write a numbered audit report.
---

1. Run `npx token-kit check --list --json` and group the findings by rule ID and by file or token family.
2. Pick the next free report number from `docs/audits/` (R001, R002, …) and write `docs/audits/R<nnn>-<topic>.md` using `templates/audit-report.md` from token-kit (copy its headings).
3. For each group: what is wrong, why it matters (cite the rule from `docs/token-contract.md`), the proposed fix, and whether it needs a new token (then link `/token-propose`, never add it yourself).
4. Fix only what the user approves. After fixes run `npx token-kit report` so the baselines shrink, then `npx token-kit check`.
