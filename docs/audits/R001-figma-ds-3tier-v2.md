# R001 — Figma-Datei „ds-3tier-v2“

Datum: 2026-10-28 · Umfang: alle lokalen Variablen der Figma-Datei *ds-3tier-v2* (Collections Primitive, Semantic, Components; 528 Variablen, davon 22 Trenner) · Prüfer: `token-kit check` (Regeln aus [token-contract.md](../token-contract.md)) über den Snapshot [test/fixtures/ds-3tier-v2.variables.tsv](../../test/fixtures/ds-3tier-v2.variables.tsv)

Die Datei wurde nur gelesen und nicht verändert. Sie ist die Vorlage dafür, wie das Kit Variablen in Figma anlegt. Das Kit liest sie verlustfrei ein und schreibt dieselben 506 Variablen zurück (gleiche Namen, Typen, Werte, Aliase, Scopes und Sichtbarkeit). Die eingelesenen Tokens liegen in [examples/ds-3tier-v2/tokens.json](../../examples/ds-3tier-v2/tokens.json).

## Ergebnis

Die Datei ergibt 461 Tokens (268 Primitive, 123 Semantic, 70 Component). Das Kit findet **31 Fehler** und **193 offene Reviews**. Die Fehler gehen auf vier Ursachen zurück: Verweise auf gelöschte Farben (18), Verweise, die eine Ebene überspringen (8), Hex-Werte in Semantic-Tokens (3) und Schlüssel in camelCase bzw. Großschreibung (2). Die Reviews betreffen fehlende Beschreibungen. Alle Fehler lassen sich ohne neue Tokens beheben.

| Regel | Betroffen | Anzahl | Vorschlag | Neuer Token |
| --- | --- | --- | --- | --- |
| `TOKEN_REF_MISSING` | 15 Semantic-Farben verweisen auf gelöschte `color/iron/*`, 3 auf gelöschte `color/lemon-tbd/*` (u. a. `color/𝗨𝗦𝗔𝗚𝗘/border/default`, `icon/default`, `text/supplementary`, `color/𝗕𝗥𝗔𝗡𝗗/secondary/brand-default`) | 18 | `iron` → `slate` mit gleichem Wert (siehe unten); `lemon-tbd/500` und `/600` → passende `lemon`-Stufen oder bewusst als Primitive neu anlegen | nein (ggf. 2 Lemon-Stufen) |
| `TOKEN_TIER_CHAIN` | `badge/{sm,md}-{gap,padding-x,padding-y}` verweisen direkt auf `spacing/*` (Primitive) | 6 | auf Semantic-Abstände (`spacing/xs` … `xl`) zeigen lassen | nein |
| `TOKEN_TIER_CHAIN` | `button/font-line-height` → `line-height/400` (Primitive) | 1 | auf eine Semantic-Zeilenhöhe zeigen lassen | nein |
| `TOKEN_TIER_CHAIN` | `color/𝗨𝗦𝗔𝗚𝗘/text/disabled` nutzt `opacity/disabled` (Semantic → Semantic) | 1 | Deckkraft auf `opacity/500` (Primitive) beziehen oder `text/disabled` als eigene Farbe führen | nein |
| `TOKEN_RAW_VALUE` | `color/𝗥𝗢𝗟𝗘/tertiary/strong` `#FFDD00`, `tertiary/weak` `#FFF61A`, `tertiary/on-tertiary` `#0B1E25` | 3 | `on-tertiary` → `color/slate/950` (gleicher Wert); für `strong`/`weak` Primitive-Farben anlegen oder vorhandene `lemon`-Stufen verwenden | ggf. 2 Primitive |
| `TOKEN_KEY_SYNTAX` | `font-family/Inter`, `font-family/markPro` | 2 | `font-family/inter`, `font-family/mark-pro` (Entscheidung 5 im [CHANGELOG](../../CHANGELOG.md)) | nein |
| `TOKEN_DESCRIPTION_MISSING` (Review) | alle 123 Semantic- und 70 Component-Variablen | 193 | Beschreibungen nachtragen; bis dahin per Ratchet einfrieren | nein |

### Gelöschte Iron-Farben

Die Werte der gelöschten `iron`-Stufen stimmen mit vorhandenen `slate`-Stufen überein. Das Umhängen ändert daher nichts am Aussehen.

| Gelöscht | Ersatz mit gleichem Wert |
| --- | --- |
| `color/iron/200` | `color/slate/100` |
| `color/iron/300` (`#CFD2D3`) | `color/slate/200` |
| `color/iron/600` | `color/slate/600` |
| `color/iron/700` | `color/slate/700` |
| `color/iron/950` | `color/slate/950` |
| `color/lemon-tbd/500` (`#7F7902`), `/600` (`#6A6501`) | keine Entsprechung, Entscheidung nötig |

## Beobachtungen ohne Regelverstoß

Diese Punkte meldet der Check nicht als Fehler. Sie sind aber für die Namensgebung (Curtis 2020, siehe [knowledge/naming-tokens.md](../knowledge/naming-tokens.md)) und die Richtlinie relevant.

1. **Reihenfolge der Ebenen im Namen.** Bei `badge/md-padding-x` und `badge/sm-gap` steht die Größe vor der Eigenschaft. Die Richtlinie verlangt Component-Property-Variant-State-Scale, also `badge/padding-x-md`. `button` und `snackbar` folgen dem Schema bereits.
2. **`color/𝗕𝗥𝗔𝗡𝗗/secondary/brand-on-primary`.** Der Name mischt die Rollen Secondary und Primary. Vorschlag: `brand-on-secondary`.
3. **Disabled-Zustände.** `button/bg-primary-disabled` und `border-primary-disabled` zeigen auf `color/primary/default`. Damit unterscheidet sich der Zustand nur über die Deckkraft von Text und Icon. Das ist zulässig, sollte aber in der Beschreibung stehen.
4. **Dark Mode.** Die Collection Semantic hat nur den Modus `light`. Das Kit legt bei einem Import einen Modus `dark` an, der zunächst dieselben Werte trägt.
5. **Scopes und Sichtbarkeit sind uneinheitlich.** 45 Variablen weichen von der Regel ihrer Gruppe ab: `color/static/*`, `shadow/color/*`, `line-height/*` und `letter-spacing/*` sind als einzige Primitives veröffentlicht. Die 11 `color/gray/*` haben eingeschränkte Scopes (`FRAME_FILL`, `SHAPE_FILL`, `EFFECT_COLOR`), die anderen Paletten `ALL_SCOPES`. `size/1300` bis `2100` und `blur/100` haben `ALL_SCOPES` statt `WIDTH_HEIGHT`. Das Kit übernimmt die Abweichungen pro Token (`$extensions.figma`), damit nichts verloren geht. Besser wäre eine einheitliche Regel.
6. **Sortierung.** `color/slate/050` steht vor der Lemon-Palette und getrennt von `slate/100` bis `950`. Die Badge- und Snackbar-Variablen sind ineinander geschoben. Beim Anlegen sortiert das Kit nach Pfad und Skala.
7. **Collection-Namen.** Die Datei nennt die Ebenen Primitive, Semantic und Components. Die Richtlinien-Seiten sprechen von Foundation, Alias und Control Collection. Das Kit verwendet jetzt die Namen der Datei.

## Was das Kit aus der Datei übernimmt

- Drei Collections mit den Modi `Mode 1`, `light`/`dark` und `Value`.
- Blöcke mit fett gesetzten Überschriften als Trenner-Variablen (`𝗦𝗪𝗔𝗧𝗖𝗛𝗘𝗦/ㅤ`, `𝗗𝗜𝗠𝗘𝗡𝗦𝗜𝗢𝗡/ㅤ`, `𝗔𝗖𝗧𝗜𝗢𝗡/ㅤ` …) und Leer-Trenner (`ㅤ ㅤ/ㅤ`).
- Semantic-Farben in den Abschnitten 𝗕𝗥𝗔𝗡𝗗, 𝗨𝗦𝗔𝗚𝗘, 𝗥𝗢𝗟𝗘 und 𝗜𝗡𝗧𝗘𝗡𝗧 als zweite Namensebene (`color/𝗥𝗢𝗟𝗘/primary/default`). Die Überschrift gehört nicht zum Token-Namen.
- Component-Namen mit einer Ebene nach der Komponente (`button/bg-primary-default`).
- Deckkraft in Prozent (Token 0.5 ↔ Figma 50), Schriftstärken als Stilnamen (`Semi Bold`), Schatten als eine Variable pro Ebene und Feld (`shadow/sm/layer-0/blur`).
- Farbe mit verknüpfter Deckkraft (`{color, opacity}`), Scopes und „Hide from publishing“ nach Regeln in `token-kit.config.json` (`figma`).

## Entscheidungen nötig

- [ ] `iron` → `slate` wie in der Tabelle umhängen (15 Verweise).
- [ ] `lemon-tbd/500` und `/600`: auf vorhandene `lemon`-Stufen umhängen oder als Primitive neu anlegen.
- [ ] Tertiary: `on-tertiary` auf `color/slate/950` umhängen; `#FFDD00` und `#FFF61A` als Primitives anlegen oder vorhandene Stufen nehmen.
- [ ] Badge-Abstände und `button/font-line-height` auf Semantic-Tokens umstellen; Badge-Namen auf `badge/padding-x-md` usw. umbenennen.
- [ ] `font-family/Inter` → `inter`, `markPro` → `mark-pro`.
- [ ] Eine Scope- und Sichtbarkeitsregel pro Gruppe festlegen.

## Nach der Korrektur

Offen. Nach den Änderungen in der Datei: Snapshot neu ziehen, `npm test` und `token-kit check` laufen lassen und die Zahlen hier eintragen.

## Literatur

Curtis, N. (2020). *Naming Tokens in Design Systems*. EightShapes. https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676 (abgerufen am 2026-10-28; lokale Aufbereitung in [knowledge/naming-tokens.md](../knowledge/naming-tokens.md)).
