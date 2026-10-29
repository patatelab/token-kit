# token-kit

Design-Tokens mit klaren Ebenen, Konformitätsprüfung, Shrink-only-Ratchet, Export/Import als Bundle, Copilot-Prompts und einem Figma-Plugin. Keine npm-Abhängigkeiten (Node ≥ 20).

## Schnellstart: Demo ansehen

Voraussetzungen: Git und Node.js 22 LTS (mindestens 20.19). Dann:

```bash
git clone https://github.com/patatelab/token-kit.git
cd token-kit
npm run dev
```

Im Browser **http://localhost:5173** öffnen: eine Startseite mit allen Tokens, Regeln und dem aktuellen Prüfergebnis. Neu dabei? Die Schritt-für-Schritt-Anleitung mit Installation von Git und Node.js und Hilfe bei Fehlern steht in [demo/README.md](demo/README.md).

## Aufbau

| Teil | Wo | Wofür |
| --- | --- | --- |
| Demo | `demo/` | Beispielprojekt mit Startseite (React + Vite), nutzt token-kit aus diesem Repo; `npm run dev` |
| CLI `token-kit` | `bin/`, `src/node/` | `init`, `build`, `check`, `report`, `export`, `import` |
| Check-Kern | `src/core/` | Regeln, Ratchet, Bundle-Format; reines JavaScript, läuft in Node, CI und im Figma-Plugin |
| Beispiel-Tokens | `starter/` | nach der Token-Richtlinie: Primitive → Semantic → Component, Light/Dark, Kontrastpaare |
| Copilot | `copilot/` | `copilot-instructions.md`, Instructions für CSS/TSX, Prompts `/token-export`, `/token-import`, `/token-propose`, `/token-audit` |
| Figma-Plugin | `figma-plugin/` | Bundle als Variables importieren, global ändern, „Tokens prüfen“, konform exportieren |
| Änderungen | `CHANGELOG.md` | Was sich je Version geändert hat, inkl. Entscheidungen und Migration |
| Wissensbasis | `docs/knowledge/` | Tokens benennen nach Curtis (2020), mit Belegen und Bezug zum Kit |
| Regeln | `docs/token-contract.md` | Token-Richtlinie (Ebenen, Namensschema) und der Vertrag, den `check` durchsetzt |
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
  return <span style={{ padding: token("spacing.xs"), color: token("color.text.default") }} />;
}
```

```css
.card {
  background: var(--card-bg-default);
  padding: var(--card-padding-md);
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

## Ebenen und Namen

Voreingestellt ist die Token-Richtlinie: RAW-Wert → Primitive → Semantic → Component. Jeder Token verweist nur auf die nächsthöhere Ebene. In Figma ist jede Ebene eine Collection.

| Ebene | Figma | Namensschema | Beispiel |
| --- | --- | --- | --- |
| Primitive | Primitive | Category-Property-Variant-Scale | `color-blue-500` = `#2B7FFF` |
| Semantic | Semantic | Category-Property-Variant-Scale | `color-primary-default` → `{color.lemon.500}` |
| Component | Components | Component-Property-Variant-State-Scale | `button-bg-primary-hover` → `{color.primary.strong}` |

Im Token-File ist jeder Namensteil eine Gruppenebene; die Ebenen-Gruppen `primitive` und `semantic` zählen nicht zum Namen (`pathSkip`):

```text
primitive.color.blue.500           #2B7FFF                   --color-blue-500         color/blue/500
semantic.color.primary.default     {color.lemon.500}         --color-primary-default  color/𝗥𝗢𝗟𝗘/primary/default
button.bg.primary.hover            {color.primary.strong}    --button-bg-primary-hover button/bg-primary-hover
```

Semantische Farben gliedern sich in Brand, Usage (`bg`, `text`, `border`, `icon`), Role (`primary`, `secondary`, `tertiary`) und Intent (`success`, `warning`, `error`, `info`). Skalen sind bei Primitives Zahlen (050–950, 500 = mittel), bei Semantic Wörter (`default`/`strong`/`weak`, `sm`/`md`/`lg`). Der Check prüft Ebenenkette, Kategorien (`TOKEN_NAME_STRUCTURE`) und Werte im Namen (`TOKEN_NAME_LITERAL`). Die ganze Richtlinie steht in [docs/token-contract.md](docs/token-contract.md).

Das Ebenen-Modell bleibt Konfiguration (`tiers` in `token-kit.config.json`): Ebenen, Collection-Namen, erlaubte Kategorien und Verweise lassen sich dort anpassen.

## Prüfen

`token-kit check` meldet jeden Befund mit Regel-ID, Schweregrad, Ort und Vorschlag.

- **Fehler** brechen immer ab: kaputte Referenzen, Zyklen, übersprungene Ebenen, Literale in Rollen, Werte im Namen, zu wenig Kontrast, Farb-Literale im Code, Primitives in Komponenten.
- **Reviews** brauchen eine Entscheidung und sind durch die Ratchet in `tokens/baselines/` eingefroren: neue oder zusätzliche Reviews schlagen fehl, bekannte nicht.
- `token-kit report` senkt die Baselines, sobald Befunde verschwinden, und erhöht sie nie. `report --accept-new` ist eine bewusste Entscheidung mit Begründung im PR.
- `token-kit check --strict` lässt jeden Befund fehlschlagen und ist die einzige Basis für „voll konform“.

## Export und Import

```bash
npx token-kit export --out tokens.bundle.json                     # alles
npx token-kit export --tiers primitive,semantic --out base.json    # ohne Komponenten
npx token-kit import other.tokens.bundle.json                     # Trockenlauf mit Diff + Check
npx token-kit import other.tokens.bundle.json --apply             # schreiben, wenn konform
```

Import-Optionen: `--strategy merge|replace` (fehlende Tokens behalten oder entfernen), `--only color,space`, `--accept-new-tokens` (nach Freigabe), `--report import.md`. Das Format beschreibt [schema/token-kit-bundle.schema.json](schema/token-kit-bundle.schema.json); der Kern `tokens` ist DTCG, eine SHA-256-Prüfsumme schützt vor nachträglicher Änderung.

Mit Copilot (Chat oder Coding Agent): `/token-export` und `/token-import` in `.github/prompts/` führen dieselben Schritte aus und fragen vor `--apply` und vor neuen Tokens nach.

## Figma

1. In Figma: *Plugins → Development → Import plugin from manifest…* und `figma-plugin/manifest.json` wählen.
2. **Bundle importieren**: legt die Variablen so an wie in der Referenzdatei *ds-3tier-v2* ([Prüfbericht R001](docs/audits/R001-figma-ds-3tier-v2.md)):
   - Collections *Primitive* (Mode `Mode 1`), *Semantic* (`light`, `dark`) und *Components* (`Value`).
   - Blöcke mit fetten Überschriften als Trenner-Variablen (`𝗦𝗪𝗔𝗧𝗖𝗛𝗘𝗦/ㅤ`, `𝗗𝗜𝗠𝗘𝗡𝗦𝗜𝗢𝗡/ㅤ`, `𝗔𝗖𝗧𝗜𝗢𝗡/ㅤ` …); Semantic-Farben in den Abschnitten 𝗕𝗥𝗔𝗡𝗗, 𝗨𝗦𝗔𝗚𝗘, 𝗥𝗢𝗟𝗘, 𝗜𝗡𝗧𝗘𝗡𝗧 (`color/𝗥𝗢𝗟𝗘/primary/default`). Überschriften gehören nicht zum Token-Namen.
   - Component-Namen mit einer Ebene nach der Komponente (`button/bg-primary-default`).
   - Deckkraft in Prozent, Schriftstärken als Stilnamen (`Semi Bold`), Schatten als eine Variable pro Ebene und Feld (`shadow/sm/layer-0/blur`), Farbe mit verknüpfter Deckkraft.
   - Scopes und „Hide from publishing“ nach Regeln; Abweichungen einzelner Tokens stehen in `$extensions.figma`.
   - Referenzen werden Aliase. Was Figma nicht nativ kennt (Easing-Kurven, Typografie-Komposita, `calc()`), wird eine String-Variable mit dem Wert als Text bzw. JSON, z. B. `[0.2,0,0,1]`.

   Das Layout steht in `token-kit.config.json` unter `figma` und gilt in beide Richtungen: Das Plugin liest auch Dateien, die es nicht selbst angelegt hat, z. B. die Referenzdatei (Tokens dazu in [examples/ds-3tier-v2/tokens.json](examples/ds-3tier-v2/tokens.json)).
3. Ändern: alle Ebenen sind pflegbar, von der Palette bis zu Komponenten-Tokens. Globale Änderungen an Primitives und Semantic-Tokens wirken über die Aliase bis in die Komponenten. Komponenten-Tokens dürfen weiterhin nur Semantic-Tokens oder die eigene Familie referenzieren; das prüft der Check.
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
