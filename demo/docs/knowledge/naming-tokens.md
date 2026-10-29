# Wissensbasis: Tokens benennen

**Quelle:** Curtis (2020), siehe [Literaturverzeichnis](#literaturverzeichnis). Grundlage dieser Zusammenfassung ist der vollständige Artikeltext, den der Projektinhaber am 28.10.2026 als PDF bereitgestellt hat.

**Zitierweise:** Paraphrasen sind mit einem Kurzbeleg *(Curtis, 2020, Abschn. „…“)* versehen; die Abschnittsnamen sind die Überschriften des Originals. Wörtliche Zitate stehen in Anführungszeichen und sind kurz gehalten. Abschnitt 7 trennt davon klar die **eigenen Ableitungen** für das Token-Kit; sie stützen sich zusätzlich auf die Projekt-Richtlinie (Token-Richtlinie, 2026). Verbindlich für das Projekt ist die Richtlinie in [../token-contract.md](../token-contract.md); dieser Artikel ist die allgemeine Wissensbasis.

## 1. Ausgangspunkt

Token-Namen tragen das gemeinsame Verständnis von visuellem Stil über Design, Code und Doku hinweg. Teams müssen Entscheidungen in ihren Werkzeugen, auch in Design-Tools, schnell finden und wiedererkennen; Curtis fasst das mit „Terms matter“ zusammen *(Curtis, 2020, Einleitung)*. Er bezieht sich dabei auf frühere Arbeiten zu Design Tokens *(Curtis, 2016)* und auf offengelegte Token-Modelle von Salesforce, Shopify, Adobe Spectrum und Style Dictionary *(Curtis, 2020, Einleitung)*.

Schon einfache Tokens folgen Ebenen *(Curtis, 2020, Abschn. „Starting with the Basics“)*:

- `esds-color-neutral-42` setzt sich aus Namespace, Kategorie, Variante und Skala zusammen und steht für `#6B6B6B`.
- `esds-space-1-x` setzt sich aus Namespace, Kategorie und Skala zusammen und steht für 16px.

Zweckgebundene Tokens brauchen mehr Ebenen, z. B. `esds-color-feedback-background-error` oder `esds-font-heading-size-1` *(ebd.)*.

## 2. Vier Gruppen von Ebenen

Curtis ordnet die Ebenen in vier Gruppen *(Curtis, 2020, Abschn. „Starting with the Basics“)*:

| Gruppe | Ebenen | Beispiele |
| --- | --- | --- |
| **Base** („backbone“) | Category, Concept, Property | `color`, `action`, `size` |
| **Modifier** | Variant, State, Scale, Mode | `primary`, `hover`, `100`, `on-dark` |
| **Object** | Component Group, Component, Element | `forms`, `button`, `left-icon` |
| **Namespace** | System, Theme, Domain | `esds`, `ocean`, `retail` |

### 2.1 Base

**Category** ist der grobe Stilbereich. Curtis nennt gängige Kategorien, jeweils mit einem bevorzugten Begriff und den Varianten anderer Systeme in Klammern *(Curtis, 2020, Abschn. „Base Levels – Category“)*:

- `color`
- `font` (type, typography, text)
- `space` (units, dimension, spacing)
- `size` (sizing)
- `elevation` (z-index, layer, layering)
- `breakpoints` (media-query, responsive)
- `shadow` (depth)
- `touch`
- `time` (animation, duration)

Aus diesen Begriffen bildet ein Team sein kontrolliertes Vokabular *(ebd.)*.

> **Prinzip: Homonyme vermeiden.** `type` lässt sich als Typografie oder als Typ lesen, `text` als Typografie, Inhalt oder Property. Viele Teams wählen deshalb `font` *(Curtis, 2020, Abschn. „Base Levels – Category“)*.

**Property** ist die Eigenschaft innerhalb der Kategorie *(Curtis, 2020, Abschn. „Base Levels – Property“)*:

- bei Farbe `text`, `background`, `border`, `fill`;
- bei Schrift `size`, `weight`, `line-height`, `letter-spacing`.

Kategorie und Property allein (`color-background`, `font-size`) sind laut Curtis „exceedingly general and not purposefully useful“ *(ebd.)*.

**Concept** gruppiert Tokens einer Kategorie nach Zweck *(Curtis, 2020, Abschn. „Base Levels – Concept“)*. Für Farbe nennt Curtis:

- `feedback` (notification, messaging, alert) mit success, warning, error;
- `action` (cta, interactive) für Handlungsaufforderungen und ausgewählte Elemente;
- `visualization` (dataviz, charts);
- `commerce` (sale, clearance, …).

Daraus entstehen Namen wie `color-feedback-success`, `color-action-primary` und `color-visualization-performance-positive`. Für Typografie nennt er `heading` (header, headline, display) und `body`, dazu Sonderfälle wie `eyebrow` oder `lead` *(ebd.)*.

> **Prinzip: Homogen innerhalb, heterogen zwischen.** In einem Concept stehen gleichartige Dinge, und Concepts unterscheiden sich klar voneinander. Sale und Clearance gehören zum Beispiel nicht in `visualization`, sondern in ein eigenes Concept *(Curtis, 2020, Abschn. „Principle: Homogeneity Within, Heterogeneity Between“)*.

### 2.2 Modifier

Modifier geben Tokens ihren Zweck. Sie kommen einzeln oder kombiniert vor *(Curtis, 2020, Abschn. „Modifiers“)*.

**Variant** unterscheidet alternative Anwendungsfälle *(Curtis, 2020, Abschn. „Modifiers – Variant“)*:

- Hierarchie: `primary` (default, base), `secondary` (subdued, subtle), `tertiary` (nonessential);
- Feedback: `success` (confirmation, positive), `error` (danger, alert, critical), `info` (information), `warning`, `new`.

Beispiele sind `color-text-primary`, `color-background-warning` und `color-fill-new` *(ebd.)*.

> **Prinzip: Flexibilität oder Spezifität.** `color-success` passt auf viele Fälle, lässt aber offen, ob Text, Hintergrund oder Rahmen gemeint ist. Mit Property, also `color-background-success` oder `color-text-success`, wird der Token spezifischer und präziser anwendbar, aber weniger flexibel *(Curtis, 2020, Abschn. „Principle: Flexibility or Specificity?“)*.

**State** beschreibt Interaktionszustände *(Curtis, 2020, Abschn. „Modifiers – State“)*:

- `default`
- `hover`
- `press`/`active`
- `focus`
- `disabled`
- `visited`
- `error`

Ein voll ausgeschriebenes Beispiel ist `color-action-text-secondary-focus` *(ebd.)*.

**Scale** beschreibt Abstufungen. Curtis unterscheidet fünf Arten *(Curtis, 2020, Abschn. „Modifiers – Scale“)*:

- **aufgezählt**: Heading-Level `1`, `2`, `3`;
- **geordnet**: `50`, `100`, …, `900` (wie Material Color);
- **begrenzt**: z. B. Helligkeit 0–100 (`slate-42`);
- **proportional**: `1-x`, `2-x`, `half-x`;
- **T-Shirt-Größen**: `s`, `m`, `l` bis `xs`, `xl`, `xxxl`.

Für Abstände empfiehlt er Proportionen statt T-Shirt-Größen, denn „Size ≠ space“ *(ebd.)*. Skalen gibt es sowohl in generischen, also primitiven, Tokens (`space-2-x`, `color-neutral-42`) als auch in zweckgebundenen (`font-size-heading-level-1`). Selten braucht ein Name zwei Concept/Scale-Paare, z. B. Heading-Level plus Breakpoint *(ebd.)*.

**Mode** unterscheidet Werte je Untergrund, meist hell und dunkel (`on-light`, `on-dark`, auch `on-brand`). Ein Beispiel ist `color-action-background-secondary-hover-on-dark`. Mode vergrößert die Zahl der Tokens, betrifft in der Praxis aber kleine Teilmengen, und einfachere Aliase wie `color-accent-hover-on-dark` mildern das *(Curtis, 2020, Abschn. „Modifiers – Mode“)*.

> **Prinzip: Expliziter oder weggelassener Default.** Entweder ist hell der stille Default, und nur dunkle Alternativen bekommen `on-dark`. Oder alle Geschwister tragen den Mode, damit man sie verlässlich durchlaufen kann *(Curtis, 2020, Abschn. „Principle: Explicit versus Truncated Defaults“)*.
>
> **Prinzip: Modifier-Wörter mitschreiben?** `on-dark` liest sich besser, ist aber länger. Bei der Frage, welche Konvention man wählt, ist Curtis' Meinung schwach; stark ist sie bei der Forderung, *dass* es eine gibt *(Curtis, 2020, Abschn. „Principle: Include or Exclude Modifying Terms?“)*.

### 2.3 Object

Curtis unterscheidet drei Object-Ebenen *(Curtis, 2020, Abschn. „Objects“)*:

- **Component**, z. B. `input-color-border`;
- **Element** innerhalb einer Komponente, ähnlich wie BEM, z. B. `input-left-icon-color-fill`;
- **Component Group**, z. B. `forms-color-border`.

> **Prinzip: Erst lokal, dann übergreifend.** Eine komponentenspezifische Entscheidung wird zuerst lokal festgehalten, in den Specs oder der Komponentendatei. Brauchen sie mehrere Komponenten, wird sie zum Token der Komponentengruppe befördert. Curtis' Faustregel dafür: ab drei Komponenten. Die Schritte sind: Gruppen-Token anlegen, lokalen Token ersetzen, lokalen Token entfernen, Gruppen-Token auf die anderen Komponenten anwenden *(Curtis, 2020, Abschn. „Principle: Start Within, Then Promote Across Components“)*.
>
> **Prinzip: Nicht vorschnell globalisieren.** Ist die Wiederverwendung unsicher (Tooltip jetzt, Popover und Menu vielleicht später), bleiben die Tokens lokal. Das vermeidet subjektive Debatten und hält den globalen Namensraum sauber *(Curtis, 2020, Abschn. „Principle: Don't Globalize Decisions Prematurely“)*.

### 2.4 Namespace

Namespaces haben drei Ausprägungen *(Curtis, 2020, Abschn. „Namespaces“)*:

- **System**: ein kurzer Name (etwa fünf Zeichen oder weniger) oder ein Akronym als Präfix, z. B. `slds-` oder `esds-`.
- **Theme**: verschiebt Stilwerte über den ganzen Komponentenkatalog; ein Theme-Namespace wie `aads-ocean-…` überschreibt oder erweitert Standard-Tokens.
- **Domain**: ein eigener Namensraum für einen Geschäftsbereich, z. B. `esds-consumer-…`. Laut Curtis in der Praxis noch nicht beobachtet, aber absehbar.

> **Prinzip: Theme ≠ Mode.** Ein Theme kann selbst wieder Light- und Dark-Mode brauchen; die beiden Achsen sind „orthogonal“ zueinander *(Curtis, 2020, Abschn. „Namespaces – Theme“)*.

## 3. Reihenfolge der Ebenen

Eine vorherrschende Reihenfolge gibt es nicht *(Curtis, 2020, Abschn. „Lessons Learned – Order“)*. Curtis beobachtet aber stabile Muster *(ebd.)*:

1. **Namespaces** stehen vorn.
2. **Objects** folgen den Namespaces und geben den Kontext für Base und Modifier.
3. **Base** bildet die Mitte. Innerhalb von Base gibt es drei Varianten:
   - streng hierarchisch: `color-interactive-background`;
   - gut lesbar: `interactive-background-color`;
   - Kategorie und Property zusammen: `color-background-interactive`.
4. **Modifier** stehen am Ende; Mode meist ganz zuletzt.

## 4. Vollständigkeit

Kein Token braucht alle Ebenen. Domain, Theme und Element sind selten, und Scale (quantitativ) und Variant (qualitativ) schließen sich oft aus. Man nimmt nur die Ebenen auf, die den Zweck beschreiben und abgrenzen *(Curtis, 2020, Abschn. „Lessons Learned – Completeness“)*. Curtis zeigt das an einem Gegenbeispiel:

- gut: `shape-tile-corner-radius`;
- redundant: `shape-tile-corner-radius-default-on-light` und `…-on-dark` *(ebd.)*.

## 5. Polyhierarchie

Dieselbe Entscheidung kann an zwei Orten sinnvoll sein. Ein Fehler-Rot gehört etwa zu `color-feedback-error` und zugleich zu `ui-controls-color-text-error`. Wenn beide Sets ohne den Wert unvollständig wären, behält Curtis beide Tokens und setzt den objektbezogenen als Alias auf den konzeptbezogenen *(Curtis, 2020, Abschn. „Lessons Learned – Polyhierarchy“)*:

```text
ui-controls-color-text-error = color-feedback-error (= color-red-36 = #B90000)
```

So lässt sich der spezifische Wert später ändern, ohne andere Verwendungen zu berühren *(ebd.)*.

## 6. Prinzipien im Überblick

| Prinzip | Kern | Beleg |
| --- | --- | --- |
| Homonyme vermeiden | eindeutige Begriffe (`font` statt `type`/`text`) | Curtis, 2020, „Base Levels – Category“ |
| Homogen innerhalb, heterogen zwischen | Concepts sauber trennen | Curtis, 2020, „Principle: Homogeneity Within …“ |
| Flexibilität vs. Spezifität | Property aufnehmen, wenn die Anwendung eindeutig sein muss | Curtis, 2020, „Principle: Flexibility or Specificity?“ |
| Expliziter vs. weggelassener Default | Mode-Konvention festlegen | Curtis, 2020, „Principle: Explicit versus Truncated Defaults“ |
| Modifier-Wörter | Konvention wählen und durchhalten | Curtis, 2020, „Principle: Include or Exclude Modifying Terms?“ |
| Erst lokal, dann übergreifend | ab ca. 3 Komponenten zur Gruppe befördern | Curtis, 2020, „Principle: Start Within …“ |
| Nicht vorschnell globalisieren | unsichere Wiederverwendung lokal lassen | Curtis, 2020, „Principle: Don't Globalize …“ |
| Theme ≠ Mode | unabhängige Achsen | Curtis, 2020, „Namespaces – Theme“ |
| Vollständigkeit | nur nötige Ebenen | Curtis, 2020, „Lessons Learned – Completeness“ |
| Polyhierarchie | spezifisch per Alias auf allgemein | Curtis, 2020, „Lessons Learned – Polyhierarchy“ |

## 7. Eigene Ableitungen für das Token-Kit

*Dieser Abschnitt gibt nicht Curtis wieder. Er ordnet die Projekt-Richtlinie (Token-Richtlinie, 2026) und die Umsetzung im Kit (token-kit, 2026) in Curtis' Begriffe ein.*

| Curtis (2020) | Projekt-Richtlinie (Token-Richtlinie, 2026) | Umsetzung im Kit |
| --- | --- | --- |
| generische Tokens mit Scale | **Primitive**: Category-Property-Variant-Scale, Zahlen-Skala 050–950 | Ebene `primitive`, `literals: true`, nicht in Produktcode (`TOKEN_SOURCE_TIER_BYPASS`) |
| Base + Modifier, zweckgebunden | **Semantic**: Category-Property-Variant-Scale, Wort-Skalen (`default`/`strong`/`weak`, `sm`–`xl`) | Ebene `semantic`, nur Verweise auf Primitives; Zahlen-Skalen sind `TOKEN_NAME_LITERAL` |
| Object + Base + Modifier | **Component**: (Group-)Component-Property-Variant-State-Scale | Ebene `component`, Familien je Komponente |
| Concept (feedback, action, …) | Farb-Bereiche Brand, Usage, Role, Intent | `naming.categories`, Überschriften in Figma |
| Mode (`on-dark`) | Light/Dark als Figma-Modes, nicht im Namen | `themes.dark`, Overrides nur in Semantic; `on-<role>` bezeichnet Inhalt *auf* einer Rollenfarbe |
| Namespace System | kein Präfix vorgesehen | optional `cssPrefix` |
| Homonyme vermeiden | `font-*` für Typografie | Kategorien-Liste |
| Erst lokal, dann übergreifend | Komponenten nutzen die eigene Familie, andere nur über Verträge | `TOKEN_TIER_CHAIN`, `$extensions.componentContexts` |
| Polyhierarchie per Alias | Component → Semantic → Primitive | `TOKEN_ROLE_DUPLICATE` für die primäre Rolle einer Primitive-Stufe |
| Vollständigkeit | Namensteile dürfen entfallen | Richtlinie, Abschnitt Naming |

**Abweichungen.** Wo Curtis und die Richtlinie auseinandergehen, gilt im Projekt die Richtlinie:

- **Abstände:** Die Richtlinie verwendet T-Shirt-Größen auch für `spacing-*`; Curtis empfiehlt dafür Proportionen *(Curtis, 2020, Abschn. „Modifiers – Scale“)*.
- **Mode:** Die Richtlinie bildet Mode über Figma-Modes ab statt im Namen *(vgl. Curtis, 2020, Abschn. „Modifiers – Mode“)*.

## Literaturverzeichnis

Curtis, N. (2016, 24. Juni). *Tokens in design systems: 10 tips to architect & implement design decisions for everyone*. EightShapes. https://medium.com/eightshapes-llc/tokens-in-design-systems-25dd82d58421 (nur als Hintergrund genannt; in Curtis, 2020, referenziert, nicht selbst ausgewertet)

Curtis, N. (2020, 15. Oktober). *Naming tokens in design systems: Terms, types, and taxonomy to describe visual style*. EightShapes. https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676 (Abgerufen am 28. Oktober 2026 als PDF-Ausdruck des Projektinhabers)

token-kit. (2026). *Token contract* [Projektdokumentation]. patatelab/token-kit, `docs/token-contract.md`.

Token-Richtlinie. (2026). *Design Tokens; RAW Value; Primitive Token; Semantic Token; Component Token* [Interne Richtlinien-Seiten, PDF]. Bereitgestellt am 28. Oktober 2026.
