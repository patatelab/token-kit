# token-kit

Design-Tokens mit klaren Ebenen, Konformitätsprüfung, Shrink-only-Ratchet, Export/Import als Bundle, Copilot-Prompts und einem Figma-Plugin. Keine npm-Abhängigkeiten (Node ≥ 20).

| Teil | Wo | Wofür |
| --- | --- | --- |
| CLI `token-kit` | `bin/`, `src/node/` | `init`, `build`, `check`, `report`, `export`, `import` |
| Check-Kern | `src/core/` | Regeln, Ratchet, Bundle-Format; reines JavaScript, läuft in Node, CI und im Figma-Plugin |
| Beispiel-Tokens | `starter/` | Primitives → Scale → Basic → Component, Light/Dark, Kontrastpaare |
| Copilot | `copilot/` | `copilot-instructions.md`, Instructions für CSS/TSX, Prompts `/token-export`, `/token-import`, `/token-propose`, `/token-audit` |
| Figma-Plugin | `figma-plugin/` | Bundle als Variables importieren, global ändern, „Tokens prüfen“, konform exportieren |
| Regeln | `docs/token-contract.md` | Der Vertrag, den `check` durchsetzt |
| Vorlagen | `templates/` | GitHub Action für den Token-Check, Audit-Bericht R001… |

## In ein React-Projekt einbauen

```bash
npm install --save-dev github:patatelab/token-kit
npx token-kit init      # Config, tokens/tokens.json, .github/ (Copilot + Workflow), docs/token-contract.md
npx token-kit build     # src/styles/tokens/tokens.css + tokens.ts
npx token-kit check     # Modell + Quellcode gegen die Baselines
```

`tokens.css` einmal global importieren (z. B. in `main.tsx` oder `app/layout.tsx`). In Komponenten:

```tsx
import { token } from "@/styles/tokens/tokens";

export function Badge() {
  return <span style={{ padding: token("space.inline-gap"), color: token("color.text.default") }} />;
}
```

```css
.card {
  background: var(--card-background);
  padding: var(--card-padding);
  border-radius: var(--card-radius);
}
```

Dark Mode greift automatisch über `prefers-color-scheme`; erzwingen mit `data-theme="dark"` (oder `"light"`) auf `<html>`.

Empfohlene Scripts in der `package.json` des Projekts:

```json
"tokens:build": "token-kit build",
"tokens:check": "token-kit build --check && token-kit report --check && token-kit check",
"tokens:export": "token-kit export --out tokens.bundle.json",
"tokens:import": "token-kit import"
```

## Ebenen

Das Ebenen-Modell ist Konfiguration (`tiers` in `token-kit.config.json`), nicht Code: beliebig viele Ebenen, eigene Namen, eigene Zuordnung über Pfad-Präfixe oder Gruppen, und pro Ebene, worauf sie verweisen darf. Die Figma-Collections heißen wie die Ebenen. Voreingestellt ist die Kette Primitive → Scale → Basic → Component; ein schlankeres Modell wie `core` → `semantic` → `component` sind drei Einträge. Details in [docs/token-contract.md](docs/token-contract.md).

```text
foundations.palette.brand.500   #2563EB                  Primitive  (Literal)
foundations.spacing.4           {size.4}                 Scale      (Alias auf Primitive)
color.brand.primary             {palette.brand.500}      Basic      (Rolle, Light/Dark)
button.primary.background       {color.brand.primary}    Component  (nur Basic oder eigene Familie)
```

## Prüfen

`token-kit check` meldet jeden Befund mit Regel-ID, Schweregrad, Ort und Vorschlag.

- **Fehler** brechen immer ab: kaputte Referenzen, Zyklen, übersprungene Ebenen, Literale in Rollen, Werte im Namen, zu wenig Kontrast, Farb-Literale im Code, Primitives in Komponenten.
- **Reviews** brauchen eine Entscheidung und sind durch die Ratchet in `tokens/baselines/` eingefroren: neue oder zusätzliche Reviews schlagen fehl, bekannte nicht.
- `token-kit report` senkt die Baselines, sobald Befunde verschwinden, und erhöht sie nie. `report --accept-new` ist eine bewusste Entscheidung mit Begründung im PR.
- `token-kit check --strict` lässt jeden Befund fehlschlagen und ist die einzige Basis für „voll konform“.

## Export und Import

```bash
npx token-kit export --out tokens.bundle.json                     # alles
npx token-kit export --tiers primitive,scale,basic --out base.json # ohne Komponenten
npx token-kit import other.tokens.bundle.json                     # Trockenlauf mit Diff + Check
npx token-kit import other.tokens.bundle.json --apply             # schreiben, wenn konform
```

Import-Optionen: `--strategy merge|replace` (fehlende Tokens behalten oder entfernen), `--only color,space`, `--accept-new-tokens` (nach Freigabe), `--report import.md`. Das Format beschreibt [schema/token-kit-bundle.schema.json](schema/token-kit-bundle.schema.json); der Kern `tokens` ist DTCG, eine SHA-256-Prüfsumme schützt vor nachträglicher Änderung.

Mit Copilot (Chat oder Coding Agent): `/token-export` und `/token-import` in `.github/prompts/` führen dieselben Schritte aus und fragen vor `--apply` und vor neuen Tokens nach.

## Figma

1. In Figma: *Plugins → Development → Import plugin from manifest…* und `figma-plugin/manifest.json` wählen.
2. **Bundle importieren**: legt die Collections *Primitives*, *Scale*, *Basic*, *Component* mit den Modes *Light* und *Dark* an. Referenzen werden Variable-Aliase. Jeder Token wird eine Variable und ist damit pflegbar: Farben als Color, Maße und Dauern als Number (Einheit bleibt erhalten), Schriften als String. Was Figma nicht nativ kennt (Easing-Kurven, Schatten, Typografie-Komposita, `calc()`/`color-mix()`), wird eine String-Variable mit dem Wert als Text bzw. JSON, z. B. `[0.2,0,0,1]`.
3. Ändern: alle Ebenen sind pflegbar, von der Palette bis zu Komponenten-Tokens. Globale Änderungen an Primitives und Scale wirken über die Aliase bis in die Komponenten. Komponenten-Tokens dürfen weiterhin nur Basic-Rollen oder die eigene Familie referenzieren; das prüft der Check.
4. **Tokens prüfen** führt dieselben Regeln aus wie `token-kit check` (ohne Quellcode-Audit) und listet Fehler und Reviews mit Regel-ID, Token und Vorschlag. Ungültiges JSON in Text-Werten ist ein Fehler (`TOKEN_FIGMA_VALUE`).
5. **Exportieren** ist nur möglich, wenn der Check nichts Neues meldet. Wie bei `token-kit check` zählen Befunde, die in den Baselines des importierten Bundles eingefroren sind, nicht; jeder neue Fehler oder Review sperrt den Export. Das Plugin lädt dann `figma.tokens.bundle.json` herunter. In Figma neu angelegte Variablen werden als „neue Tokens, Freigabe nötig“ markiert.
6. Die Datei per PR ins Repo legen. Die GitHub Action prüft sie noch einmal; übernommen wird sie mit `/token-import` bzw. `token-kit import … --apply`.

Hinweis: Mehrere Modes (Light/Dark) pro Collection brauchen einen kostenpflichtigen Figma-Plan.

Das Plugin wird aus `figma-plugin/src/main.js` und `src/core/` gebaut: `npm run figma:build` (CI prüft, dass `dist/code.js` aktuell ist).

## Eigenes CSS-Format

Der CSS-Output ist austauschbar. Ein Format ist ein Modul mit `name` und `files(context)`:

```js
// formats/our-framework.mjs
import { cssValue, cssVarName } from "token-kit/css-value";

export default {
  name: "our-framework",
  files({ index, config }) {
    const lines = [...index.tokens.values()]
      .filter((t) => t.theme === "light" && t.tier !== "primitive")
      .map((t) => `  ${cssVarName(t.path, "ds-")}: ${cssValue(t.value, t.type, t.extensions, "ds-")};`);
    return [{ path: "our-framework.css", content: `:root {\n${lines.join("\n")}\n}\n` }];
  },
};
```

In `token-kit.config.json`: `"formats": ["./formats/our-framework.mjs", "typescript"]`. `index.tokens` enthält jeden Token mit `path`, `theme`, `tier`, `type`, `value`, `description`.

## Entwicklung

```bash
npm test               # Kern, CLI, Figma-Plugin gegen eine Variables-API-Attrappe
npm run figma:build
```
