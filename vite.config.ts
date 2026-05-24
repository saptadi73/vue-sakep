import { fileURLToPath, URL } from 'node:url'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

const JSON_API_PATH = '/api/consolidation-config'
const CONFIG_FILE_PATH = path.resolve(process.cwd(), 'src/reference/consolidation-config.json')
const DEFAULT_FILE_PATH = path.resolve(
  process.cwd(),
  'src/reference/consolidation-config.default.json',
)

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

const readBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Uint8Array[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  return Buffer.concat(chunks).toString('utf-8')
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    {
      name: 'consolidation-config-file-api',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use(JSON_API_PATH, async (req, res, next) => {
          if (req.method === 'GET') {
            try {
              const raw = await fs.readFile(CONFIG_FILE_PATH, 'utf-8')
              const parsed = JSON.parse(raw)
              sendJson(res, 200, parsed)
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to read config file'
              sendJson(res, 500, { error: message })
            }
            return
          }

          if (req.method === 'PUT' || req.method === 'POST') {
            try {
              const raw = await readBody(req)
              const parsed = JSON.parse(raw)

              let backupCreated = false
              try {
                await fs.access(DEFAULT_FILE_PATH)
              } catch {
                const currentConfigRaw = await fs.readFile(CONFIG_FILE_PATH, 'utf-8')
                await fs.writeFile(DEFAULT_FILE_PATH, currentConfigRaw, 'utf-8')
                backupCreated = true
              }

              await fs.writeFile(CONFIG_FILE_PATH, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8')

              sendJson(res, 200, {
                ok: true,
                savedTo: 'src/reference/consolidation-config.json',
                backup: 'src/reference/consolidation-config.default.json',
                backupCreated,
              })
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to write config file'
              sendJson(res, 400, { error: message })
            }
            return
          }

          sendJson(res, 405, { error: 'Method not allowed' })
        })
      },
    },
  ],
  // Development server with proxy (only for dev mode)
  server: {
    port: 4000,
    proxy: {
      '/api/bprs': {
        target: 'http://iba-net.02.mglobalperdana.com:33503',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/bprs/, ''),
      },
      '/api/jabmart': {
        target: 'https://api.jabmart.id',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/jabmart/, '/kan/goerpapi.asmx'),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
