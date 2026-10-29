---
mode: agent
description: Import a token-kit bundle (from another project or the Figma plugin), check it and apply it after confirmation.
---

Import the token bundle ${input:bundle:path to *.tokens.bundle.json}.

1. Dry run: `npx token-kit import ${input:bundle} --report token-import-report.md`. Never pass `--apply` in this step.
2. Summarise the report for the user in a short table: added, changed, removed, failing findings. Explain every failing finding with its rule ID and the fix the report suggests.
3. If there are failing findings: stop. Propose fixes in the bundle source (Figma or the exporting project), not by editing baselines.
4. If tokens were removed, ask whether to keep them (`--strategy merge`, default) or remove them (`--strategy replace`).
5. If new tokens are listed under "Approval needed": show role, tier, value and description of each and ask the user for explicit approval. Without approval, do not continue.
6. After the user confirms: `npx token-kit import ${input:bundle} --apply` (plus `--accept-new-tokens` only if new tokens were approved, plus the chosen `--strategy`), then `npx token-kit build` and `npx token-kit check`.
7. Commit on a branch and open a PR whose description contains the import report.
