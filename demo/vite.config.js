import { execFile } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const CHECK_ID = 'virtual:token-check'
const RESOLVED_CHECK_ID = '\0' + CHECK_ID

// Runs `token-kit check --json` and exposes the result as a module,
// so the start page can show the current check report.
function tokenCheckReport() {
  const runCheck = () =>
    new Promise((resolve) => {
      execFile('npx', ['token-kit', 'check', '--json'], { maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
        try {
          resolve({ ...JSON.parse(stdout), generatedAt: new Date().toISOString() })
        } catch {
          resolve({ findings: [], failing: true, error: String(stderr || error), generatedAt: new Date().toISOString() })
        }
      })
    })

  return {
    name: 'token-check-report',
    resolveId(id) {
      if (id === CHECK_ID) return RESOLVED_CHECK_ID
    },
    async load(id) {
      if (id === RESOLVED_CHECK_ID) return `export default ${JSON.stringify(await runCheck())}`
    },
    handleHotUpdate({ file, server }) {
      if (!/\/(src|tokens)\//.test(file) && !file.endsWith('token-kit.config.json')) return
      const mod = server.moduleGraph.getModuleById(RESOLVED_CHECK_ID)
      if (mod) server.reloadModule(mod)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tokenCheckReport()],
})
