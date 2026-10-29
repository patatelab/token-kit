// Registry of everything the start page links to. Files are read as raw text
// at build time, so new knowledge articles or prompts show up automatically.

const knowledge = import.meta.glob('/docs/knowledge/*.md', { query: '?raw', import: 'default', eager: true })
const instructions = import.meta.glob('/.github/instructions/*.md', { query: '?raw', import: 'default', eager: true })
const prompts = import.meta.glob('/.github/prompts/*.md', { query: '?raw', import: 'default', eager: true })
const workflows = import.meta.glob('/.github/workflows/*.yml', { query: '?raw', import: 'default', eager: true })
const single = import.meta.glob(
  [
    '/docs/token-contract.md',
    '/.github/copilot-instructions.md',
    '/token-kit.config.json',
    '/tokens/tokens.json',
    '/tokens/baselines/*.json',
    '/src/styles/tokens/*',
  ],
  { query: '?raw', import: 'default', eager: true },
)

const fileName = (path) => path.split('/').pop()

const titleFromMarkdown = (text, path) => text.match(/^#\s+(.+)$/m)?.[1] ?? fileName(path)

const fileItem = (path, text, extra = {}) => ({
  id: path.replace(/^\//, ''),
  path: path.replace(/^\//, ''),
  title: path.endsWith('.md') ? titleFromMarkdown(text, path) : fileName(path),
  kind: path.endsWith('.md') ? 'markdown' : 'code',
  text,
  ...extra,
})

const fromGlob = (files, extra) => Object.entries(files).map(([path, text]) => fileItem(path, text, extra))

export const sections = [
  {
    title: 'Tokens',
    description: 'Die Token-Quelle und was token-kit daraus erzeugt.',
    items: [
      { id: 'tokens', kind: 'tokens', title: 'Token-Übersicht', summary: 'Alle Tokens nach Ebene, mit Farbfeldern und Werten.' },
      fileItem('/tokens/tokens.json', single['/tokens/tokens.json'], { summary: 'Die einzige gepflegte Token-Quelle (W3C DTCG).' }),
      ...Object.entries(single)
        .filter(([path]) => path.startsWith('/src/styles/tokens/'))
        .map(([path, text]) => fileItem(path, text, { summary: 'Generiert von token-kit build. Nicht bearbeiten.' })),
    ],
  },
  {
    title: 'Regeln und Wissen',
    description: 'Wie Tokens benannt, gestuft und geprüft werden.',
    items: [
      fileItem('/docs/token-contract.md', single['/docs/token-contract.md'], { summary: 'Der Vertrag, den token-kit check durchsetzt.' }),
      ...fromGlob(knowledge, { summary: 'Wissensbasis' }),
    ],
  },
  {
    title: 'Prüfung',
    description: 'Ergebnis von token-kit check und die Baselines dazu.',
    items: [
      { id: 'check', kind: 'check', title: 'Check-Bericht', summary: 'Aktuelle Befunde aus Tokens und Quellcode.' },
      ...Object.entries(single)
        .filter(([path]) => path.startsWith('/tokens/baselines/'))
        .map(([path, text]) => fileItem(path, text, { summary: 'Baseline' })),
    ],
  },
  {
    title: 'Copilot',
    description: 'Anweisungen und Prompts für GitHub Copilot.',
    items: [
      fileItem('/.github/copilot-instructions.md', single['/.github/copilot-instructions.md'], { summary: 'Projektweite Anweisungen' }),
      ...fromGlob(instructions, { summary: 'Anweisungen für Token-Dateien' }),
      ...fromGlob(prompts, { summary: 'Prompt' }),
    ],
  },
  {
    title: 'Einrichtung',
    description: 'Konfiguration und CI.',
    items: [
      fileItem('/token-kit.config.json', single['/token-kit.config.json'], { summary: 'Ebenen, Themes, Kontrastpaare, Ausgaben.' }),
      ...fromGlob(workflows, { summary: 'GitHub-Actions-Workflow' }),
    ],
  },
]

export const items = sections.flatMap((section) => section.items)

export const findItem = (id) => items.find((item) => item.id === id)
