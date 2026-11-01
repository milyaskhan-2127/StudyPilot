import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import assignmentsHandler from './api/assignments.js'
import chatHandler from './api/chat.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) if (!process.env[key]) process.env[key] = value
  return {
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'local-api',
      configureServer(server) {
        server.middlewares.use('/api/assignments', (req, res) => assignmentsHandler(req, res))
        server.middlewares.use('/api/chat', (req, res) => chatHandler(req, res))
      },
    },
  ],
  }
})
