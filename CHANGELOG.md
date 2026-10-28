# Änderungen

## 0.2.0 – 2026-10-28: Token-Richtlinie übernommen

Grundlage sind die fünf Richtlinien-Seiten *Design Tokens*, *RAW Value*, *Primitive Token*, *Semantic Token* und *Component Token*. Die vollständige Richtlinie steht in [docs/token-contract.md](docs/token-contract.md).

### Ebenen

| Vorher | Jetzt | Figma-Collection |
| --- | --- | --- |
| Primitives + Scale (`foundations`) | **Primitive** (`primitive`) | Foundation Collection |
| Basic | **Semantic** (`semantic`) | Alias Collection |
| Component | **Component** | Control Collection |

- Kette: RAW-Wert → Primitive → Semantic → Component. Jeder Token verweist nur auf die nächsthöhere Ebene. Primitive → Primitive und Component → Primitive sind jetzt Fehler (`TOKEN_TIER_CHAIN`).
- Theme-Overrides (Dark) gibt es nur auf der Semantic-Ebene, unter `dark-mode.semantic`.
- Die Gruppen `primitive` und `semantic` zählen nicht zum Namen: `primitive.color.blue.500` heißt `{color.blue.500}`, `--color-blue-500` und in Figma `color/blue/500`.

### Namensschema

| Ebene | Aufbau | Beispiele |
| --- | --- | --- |
| Primitive | Category-Property-Variant-Scale | `color-blue-500`, `size-200`, `radius-500`, `opacity-500`, `border-200`, `font-family-mark-pro` |
| Semantic | Category-Property-Variant-Scale | `color-text-supplementary`, `color-primary-strong`, `color-error-default`, `spacing-md`, `radius-md`, `opacity-disabled` |
| Component | Component-Property-Variant-State-Scale | `button-bg-primary-hover`, `button-padding-x-md`, `button-radius-md`, `snackbar-bg-error` |

- Semantische Farben: Brand, Usage (`bg`, `text`, `border`, `icon`), Role (`primary`, `secondary`, `tertiary`, dazu `on-<role>`), Intent (`success`, `warning`, `error`, `info`).
- Skalen: bei Primitives Zahlen (050, 100–900, 950; 500 = mittel), bei Semantic und Component Wörter (`default`/`strong`/`weak`, `xs`–`xl`).
- Component-States: `default`, `hover`, `pressed`, `focus`, `disabled`.

### Prüfregeln

| Regel | Änderung |
| --- | --- |
| `TOKEN_NAME_STRUCTURE` | **neu**: Primitive- und Semantic-Namen beginnen mit einer erlaubten Kategorie (`naming.categories` pro Ebene). |
| `TOKEN_NAME_LITERAL` | Zahlen-Skalen (`spacing-200`) sind nur noch bei Primitives erlaubt; Einheiten und Hex-Codes nirgends. |
| `TOKEN_ROLE_DUPLICATE` | ersetzt `TOKEN_SCALE_ALIAS_DUPLICATE`: eine primäre Semantic-Rolle pro Primitive-Stufe. |
| `TOKEN_TIER_CHAIN` | Text und Vorgaben auf die neue Kette angepasst. |

### Konfiguration (`token-kit.config.json`)

| Vorher | Jetzt |
| --- | --- |
| Ebenen `primitive`, `scale`, `basic`, `component` | `primitive`, `semantic`, `component` mit `label` = Figma-Collection |
| – | `tiers[].naming.categories` |
| `primaryScaleRoles` | `primaryRoles`, z. B. `{"radius.500": "radius.md"}` |
| `requireDescriptions: ["basic", "component"]` | `["semantic", "component"]` |
| `$extensions.basicAliases` | `$extensions.semanticAliases` |

### Entscheidungen zu Widersprüchen in den Richtlinien-Seiten

Mit Patrick am 2026-10-28 abgestimmt:

1. 16 px ist im Beispiel Skala 600, heißt aber `radius-500`. **Entscheidung:** `radius-500`.
2. `button-medium-radius` passt nicht zur Taxonomie. **Entscheidung:** `button-radius-md`.
3. `snackbar-error-bg` stellt die Variante vor die Eigenschaft. **Entscheidung:** `snackbar-bg-error` (Component-Property-Variant).
4. `button-text-primary-disabled` zeigt auf `opacity-disabled`. **Entscheidung:** `button-opacity-disabled` für die Deckkraft; `button-text-primary-disabled` bleibt eine Farbe (`color-text-disabled`).
5. `markPro` ist camelCase. **Entscheidung:** `font-family-mark-pro` (Namen sind durchgehend kleingeschrieben und mit Bindestrich).

### Beispiel-Tokens (`starter/`)

Neu aufgebaut nach der Richtlinie: 91 Primitives (Farben grey, lemon, blue, red, green, amber; Schrift, Size, Space, Radius, Border, Opacity, Shadow, Motion), 70 Semantic-Tokens (28 davon mit Dark-Wert) und 41 Component-Tokens für `button`, `card` und `snackbar`. Alle Kontrastpaare erfüllen WCAG AA in Light und Dark.

### Sonst

- Figma-Plugin: neue Variablen landen in der Gruppe ihrer Ebene (`primitive` bzw. `semantic`).
- README, Copilot-Anweisungen und Prompts (`/token-propose`, `/token-export`) folgen der Richtlinie.

### Migration bestehender Token-Dateien

1. Literale aus `foundations` nach `primitive` verschieben und nach `Category-Property-Variant-Scale` benennen; Scale-Aliase entfallen (Semantic verweist direkt auf Primitives).
2. Basic-Rollen nach `semantic` verschieben und umbenennen (z. B. `space.gutter` → `spacing.md`, `color.background.default` → `color.bg.default`).
3. Component-Tokens nach `Component-Property-Variant-State-Scale` umbenennen (z. B. `button.primary.background` → `button.bg.primary.default`).
4. In der Config `tiers` übernehmen und `primaryScaleRoles` → `primaryRoles`, `basicAliases` → `semanticAliases` umbenennen.
5. `npx token-kit check` zeigt, was noch fehlt.

## 0.1.0 – 2026-10-28: erste Version

CLI (`init`, `build`, `check`, `report`, `export`, `import`), Prüfkern mit Shrink-only-Ratchet, Bundle-Format mit SHA-256, Copilot-Anweisungen und Prompts, Figma-Plugin mit „Tokens prüfen“ und konformem Export.
