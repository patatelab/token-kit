# token-kit Demo: Einstieg für Anfänger

Die Demo ist ein kleines Beispielprojekt, das token-kit so benutzt wie ein echtes Projekt: mit Token-Quelle, Regeln und einer Startseite im Browser, auf der du alle Tokens, Regeln und das aktuelle Prüfergebnis siehst. Sie verwendet den token-kit-Code aus genau diesem Repo.

Diese Anleitung setzt kein Vorwissen voraus. Wenn du alle Schritte der Reihe nach machst, läuft die Startseite nach etwa 15 Minuten auf deinem Rechner.

## Was wo liegt

| Ordner | Was es ist |
| --- | --- |
| Repo-Wurzel (`token-kit/`) | das **Werkzeug**: CLI `token-kit`, Prüfregeln, Figma-Plugin |
| `demo/` (dieser Ordner) | das **Beispielprojekt** mit Startseite |

`npm run dev` funktioniert in beiden Ordnern. In der Wurzel installiert es zuerst die Demo und startet sie dann.

## 1. Was du brauchst

| Werkzeug | Version | Wofür |
| --- | --- | --- |
| **Git** | beliebig aktuell | Repo herunterladen |
| **Node.js** | **22 LTS** empfohlen (mindestens 20.19 oder 22.12) | führt die Demo aus; bringt **npm** mit |
| Webbrowser | beliebig | die Startseite ansehen |
| Code-Editor | z. B. [VS Code](https://code.visualstudio.com/) | Dateien bearbeiten (optional, aber empfohlen) |

Ein GitHub-Konto oder SSH-Schlüssel ist **nicht** nötig: das Repo ist öffentlich.

### Prüfen, was schon installiert ist

Öffne ein Terminal:

- **macOS:** Programm „Terminal“ (Spotlight: `Cmd` + `Leertaste`, „Terminal“ tippen).
- **Windows:** „PowerShell“ aus dem Startmenü.

Tippe nacheinander:

```bash
git --version
```

```bash
node --version
```

```bash
npm --version
```

Erscheint jeweils eine Versionsnummer und ist `node --version` mindestens `v20.19.0`, kannst du direkt zu [Schritt 2](#2-repo-herunterladen) springen.

### Git installieren

- **macOS:** `git --version` im Terminal eingeben. Ist Git nicht da, bietet macOS an, die „Command Line Developer Tools“ zu installieren. Bestätigen und warten.
- **Windows:** Installer von [git-scm.com](https://git-scm.com/download/win) laden und mit den Standardeinstellungen durchklicken.

### Node.js installieren oder aktualisieren

1. Auf [nodejs.org](https://nodejs.org/) die Version mit **LTS** herunterladen (macOS: `.pkg`, Windows: `.msi`).
2. Installer ausführen, Standardeinstellungen übernehmen.
3. **Terminal schließen und neu öffnen**, dann `node --version` erneut prüfen.

Wer Homebrew auf dem Mac nutzt, kann stattdessen `brew install node@22` verwenden.

## 2. Repo herunterladen

Wechsle in den Ordner, in dem deine Projekte liegen sollen, zum Beispiel:

```bash
cd ~/Developer
```

(Gibt es den Ordner nicht, vorher `mkdir ~/Developer` ausführen.)

Repo klonen und hineinwechseln:

```bash
git clone https://github.com/patatelab/token-kit.git
```

```bash
cd token-kit
```

Hast du das Repo schon früher geklont, hol dir stattdessen den neuesten Stand, damit die Demo dabei ist:

```bash
git pull
```

## 3. Startseite starten

```bash
npm run dev
```

Beim ersten Mal installiert das die Abhängigkeiten der Demo (React, Vite) in `demo/node_modules`. Das dauert ein bis zwei Minuten. Hinweise wie `npm notice New major version of npm available` kannst du ignorieren. Danach erscheint:

```text
  VITE v8.x  ready in ... ms
  ➜  Local:   http://localhost:5173/
```

Öffne **http://localhost:5173** im Browser. Du siehst die Token-Übersicht, die Regeln und das aktuelle Prüfergebnis. Änderst du eine Datei unter `demo/tokens/` oder `demo/src/`, aktualisiert sich die Seite von selbst.

Beenden: im Terminal `Ctrl` + `C`.

## 4. Tokens bauen und prüfen

Die Datei `demo/tokens/tokens.json` ist die einzige Quelle für Token-Werte. Daraus erzeugt token-kit CSS- und TypeScript-Dateien. Wechsle für die folgenden Befehle in den Demo-Ordner:

```bash
cd demo
```

Nach jeder Änderung an den Tokens:

```bash
npm run tokens:build
```

```bash
npm run tokens:check
```

`tokens:check` prüft, ob die erzeugten Dateien aktuell sind, ob die Baselines stimmen und ob Tokens und Quellcode die Regeln einhalten. Am Ende steht zum Beispiel `0 error(s), 0 review(s) in total; 0 not covered by the baselines.` Dieselbe Prüfung läuft auf GitHub bei jedem Pull Request.

## Was in der Demo wo liegt

| Pfad (in `demo/`) | Inhalt | Von Hand bearbeiten? |
| --- | --- | --- |
| `tokens/tokens.json` | alle Tokens (Format: W3C Design Tokens) | ja, nach Freigabe |
| `tokens/baselines/` | eingefrorene Befunde, dürfen nur schrumpfen | nein, nur über `token-kit report` |
| `src/styles/tokens/` | erzeugtes `tokens.css` und `tokens.ts` | **nein**, wird von `tokens:build` überschrieben |
| `token-kit.config.json` | Ebenen, Themes, Kontrastpaare, Prüfumfang | ja |
| `docs/` | Regeln und Wissensbasis, wie `token-kit init` sie in ein Projekt kopiert | ja |
| `.github/` | Copilot-Anweisungen, Prompts und Workflow, wie `token-kit init` sie anlegt. In der Demo nur zum Ansehen; GitHub führt nur Workflows aus dem `.github/` der Repo-Wurzel aus. | ja |
| `src/` | die Startseite (React + Vite) | ja |

## Alle Befehle

In der Repo-Wurzel:

| Befehl | Was er tut |
| --- | --- |
| `npm run dev` | Demo installieren und Startseite starten |
| `npm run demo:check` | vollständige Token-Prüfung der Demo |
| `npm test` | Tests des Werkzeugs |

Im Ordner `demo/`:

| Befehl | Was er tut |
| --- | --- |
| `npm install` | Abhängigkeiten der Demo installieren |
| `npm run dev` | Startseite mit automatischem Neuladen starten |
| `npm run tokens:build` | CSS/TS aus `tokens/tokens.json` erzeugen |
| `npm run tokens:check` | vollständige Token-Prüfung wie in CI |
| `npx token-kit check --strict` | strenge Prüfung: jeder Befund schlägt fehl |
| `npm run lint` | Code-Stil prüfen |
| `npm run build` | Startseite für die Veröffentlichung bauen (Ordner `dist/`) |
| `npm run preview` | den gebauten Stand lokal ansehen |

## Probleme lösen

**`npm error Missing script: "dev"`**
Du stehst nicht im Repo, oder dein Klon ist älter als die Demo. Prüfe mit `pwd` (Windows: `cd`), dass du in `…/token-kit` oder `…/token-kit/demo` bist, und mit `ls` (Windows: `dir`), dass es dort einen Ordner `demo` bzw. die Datei `vite.config.js` gibt. Fehlt `demo`: `git pull` ausführen.

**`npm error enoent Could not read package.json`**
Falscher Ordner: `cd token-kit`.

**`Vite requires Node.js version 20.19+ or 22.12+`** oder `npm warn EBADENGINE`
Node.js ist zu alt. [Node.js aktualisieren](#nodejs-installieren-oder-aktualisieren), Terminal neu öffnen, dann den Ordner `demo/node_modules` löschen und `npm run dev` wiederholen.

**`git: command not found`**
Git fehlt. [Git installieren](#git-installieren), Terminal neu öffnen.

**`'token-kit' is not recognized` / `command not found: token-kit`**
Die Demo ist noch nicht installiert. In der Repo-Wurzel `npm run dev` oder im Ordner `demo` `npm install` ausführen und auf Fehlermeldungen achten.

**`Port 5173 is in use`**
Ein anderer Dev-Server läuft noch. Vite nimmt dann automatisch den nächsten freien Port; nimm die Adresse, die im Terminal steht. Oder den anderen Server mit `Ctrl` + `C` beenden.

**Die Startseite zeigt „… Fehler, … Hinweise“ statt „Check sauber“**
Das ist kein Installationsfehler: token-kit hat Regelverstöße in Tokens oder Code gefunden. Details liefert `npm run tokens:check` im Ordner `demo`. Was die Regeln bedeuten, steht in [docs/token-contract.md](docs/token-contract.md).

Hilft nichts davon: den kompletten Text aus dem Terminal kopieren und mitschicken. Die Ausgaben von `node --version`, `npm --version` und `pwd` helfen ebenfalls.

## Weiterlesen

- [docs/token-contract.md](docs/token-contract.md): Ebenen, Namensschema und alle Prüfregeln
- [docs/knowledge/naming-tokens.md](docs/knowledge/naming-tokens.md): wie man Tokens gut benennt
- [README des Werkzeugs](../README.md): token-kit in eigene Projekte einbauen, Export/Import und das Figma-Plugin
