import { useEffect, useMemo, useState } from 'react'
import { marked } from 'marked'
import checkReport from 'virtual:token-check'
import { findItem, items, sections } from './content.js'
import tokens from '../tokens/tokens.json'

function useHashRoute() {
  const read = () => decodeURIComponent(window.location.hash.replace(/^#\/?/, ''))
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => {
      setRoute(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

const href = (id) => `#/${encodeURI(id)}`

function Home() {
  const errors = checkReport.findings.filter((f) => f.severity === 'error').length
  const reviews = checkReport.findings.length - errors
  return (
    <>
      <header className="hero">
        <p className="eyebrow">token-kit</p>
        <h1>Design Tokens</h1>
        <p className="lead">
          Alles an einem Ort: die Token-Quelle, die Regeln dahinter, der aktuelle Prüfbericht und die Dateien für Copilot und CI.
        </p>
        <a className={`status ${errors ? 'status-error' : 'status-success'}`} href={href('check')}>
          {errors ? `${errors} Fehler, ${reviews} Hinweise` : reviews ? `Keine Fehler, ${reviews} Hinweise` : 'Check sauber'}
        </a>
      </header>
      {sections.map((section) => (
        <section key={section.title} className="section">
          <h2>{section.title}</h2>
          <p className="muted">{section.description}</p>
          <ul className="card-grid">
            {section.items.map((item) => (
              <li key={item.id}>
                <a className="card" href={href(item.id)}>
                  <span className="card-title">{item.title}</span>
                  <span className="card-summary">{item.summary}</span>
                  {item.path && <code className="card-path">{item.path}</code>}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

// Relative links inside a document point to other files; open them in the app when they are known.
function resolveLink(fromPath, target) {
  const base = fromPath.split('/').slice(0, -1)
  for (const part of target.split('#')[0].split('/')) {
    if (part === '..') base.pop()
    else if (part && part !== '.') base.push(part)
  }
  return base.join('/')
}

function Markdown({ item }) {
  const html = useMemo(() => {
    const renderer = new marked.Renderer()
    const link = renderer.link.bind(renderer)
    renderer.link = (token) => {
      if (!/^[a-z]+:|^#/.test(token.href)) {
        const target = resolveLink(item.path, token.href)
        if (findItem(target)) token = { ...token, href: href(target) }
      }
      return link(token)
    }
    return marked.parse(item.text, { renderer })
  }, [item])
  return <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />
}

function FileView({ item }) {
  return (
    <>
      {item.kind !== 'markdown' && <h1>{item.title}</h1>}
      <p className="muted">
        <code>{item.path}</code>
      </p>
      {item.kind === 'markdown' ? <Markdown item={item} /> : <pre className="code-block">{item.text}</pre>}
    </>
  )
}

const SKIPPED_ROOTS = new Set(['dark-mode'])

function flattenTokens(node, path = [], tier = null, type = null, out = []) {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$') || !value || typeof value !== 'object') continue
    if (path.length === 0 && SKIPPED_ROOTS.has(key)) continue
    const nextTier = tier ?? (['primitive', 'semantic'].includes(key) ? key : 'component')
    const nextPath = value.$extensions?.pathSkip ? path : [...path, key]
    const nextType = value.$type ?? type
    if ('$value' in value) {
      out.push({
        name: nextPath.join('-'),
        tier: nextTier,
        type: nextType,
        value: typeof value.$value === 'string' ? value.$value : JSON.stringify(value.$value),
        description: value.$description,
      })
    } else {
      flattenTokens(value, nextPath, nextTier, nextType, out)
    }
  }
  return out
}

const TIERS = [
  { id: 'primitive', label: 'Primitive', note: 'Rohwerte. Werden im Produktcode nie direkt verwendet.' },
  { id: 'semantic', label: 'Semantic', note: 'Bedeutung und Rolle, mit Light- und Dark-Werten.' },
  { id: 'component', label: 'Components', note: 'Eigenschaften einzelner Komponenten.' },
]

function TokenOverview() {
  const all = useMemo(() => flattenTokens(tokens), [])
  const [query, setQuery] = useState('')
  const visible = all.filter((t) => t.name.includes(query.trim().toLowerCase()))
  return (
    <>
      <h1>Token-Übersicht</h1>
      <p className="muted">
        {all.length} Tokens aus <a href={href('tokens/tokens.json')}>tokens/tokens.json</a>
      </p>
      <input
        className="search"
        type="search"
        placeholder="Token suchen, z. B. color-error"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {TIERS.map((tier) => {
        const list = visible.filter((t) => t.tier === tier.id)
        if (!list.length) return null
        return (
          <section key={tier.id} className="section">
            <h2>
              {tier.label} <span className="count">{list.length}</span>
            </h2>
            <p className="muted">{tier.note}</p>
            <div className="table-wrap">
              <table className="token-table">
                <thead>
                  <tr>
                    <th />
                    <th>Name</th>
                    <th>Wert</th>
                    <th>Beschreibung</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((t) => (
                    <tr key={t.name}>
                      <td>{t.type === 'color' && <span className="swatch" style={{ background: `var(--${t.name})` }} />}</td>
                      <td>
                        <code>--{t.name}</code>
                      </td>
                      <td>
                        <code>{t.value}</code>
                      </td>
                      <td className="muted">{t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </>
  )
}

function CheckView() {
  const { findings } = checkReport
  const bySubject = {}
  for (const f of findings) (bySubject[f.subject] ??= []).push(f)
  return (
    <>
      <h1>Check-Bericht</h1>
      <p className="muted">
        Ergebnis von <code>npx token-kit check</code>, erzeugt {new Date(checkReport.generatedAt).toLocaleString('de-DE')}. Im
        Dev-Server aktualisiert er sich, sobald du Dateien in <code>src</code> oder <code>tokens</code> speicherst.
      </p>
      {checkReport.error && <pre className="code-block">{checkReport.error}</pre>}
      {!findings.length && !checkReport.error && <p className="status status-success">Keine Befunde.</p>}
      {Object.entries(bySubject).map(([subject, list]) => (
        <section key={subject} className="section">
          <h2>
            {subject} <span className="count">{list.length}</span>
          </h2>
          <ul className="finding-list">
            {list.map((f, i) => (
              <li key={i} className="finding">
                <span className={`badge badge-${f.severity}`}>{f.severity === 'error' ? 'Fehler' : 'Hinweis'}</span>
                <code>{f.rule}</code>
                {f.line && <span className="muted">Zeile {f.line}</span>}
                <span className="finding-message">{f.message}</span>
                <span className="muted finding-suggestion">{f.suggestion}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

function App() {
  const route = useHashRoute()
  const item = route ? findItem(route) : null
  useEffect(() => {
    document.title = item ? `${item.title} · token-kit` : 'token-kit'
  }, [item])

  let page = <Home />
  if (item?.kind === 'tokens') page = <TokenOverview />
  else if (item?.kind === 'check') page = <CheckView />
  else if (item) page = <FileView item={item} />
  else if (route) page = <p className="muted">Diese Seite gibt es nicht.</p>

  return (
    <div className="layout">
      <nav className="topbar">
        <a className="brand" href="#/">
          token-kit
        </a>
        {route && (
          <select
            className="jump"
            aria-label="Inhalt wählen"
            value={item?.id ?? ''}
            onChange={(e) => (window.location.hash = href(e.target.value))}
          >
            {!item && <option value="">Inhalt wählen</option>}
            {sections.map((section) => (
              <optgroup key={section.title} label={section.title}>
                {section.items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </nav>
      <main className="content">{page}</main>
      <footer className="footer muted">{items.length} Inhalte</footer>
    </div>
  )
}

export default App
