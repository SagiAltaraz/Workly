import cors from 'cors'
import express from 'express'
import { env } from './config/env'
import { initDatabase } from './db/pool'
import healthRoutes from './routes/health.routes'
import workspaceRoutes from './routes/workspace.routes'
import { flushWrites, hydrateWorkspaces } from './services/workspace.service'
import type { ApiResponse } from './types/api'

const app = express()

// The UI normally reaches the API through its own proxy; this lets a page served from another
// local port (a Vite dev server, the Docker frontend) call the API directly too.
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/] }))
app.use(express.json({ limit: '1mb' }))

app.use('/api/health', healthRoutes)
app.use('/api/workspaces', workspaceRoutes)

app.use((_req, res: express.Response<ApiResponse<never>>) => {
  res.status(404).json({ ok: false, error: 'Route not found' })
})

async function start() {
  await initDatabase()
  const restored = await hydrateWorkspaces()
  const server = app.listen(env.port, () => {
    console.log(
      `Server on :${env.port}, ${restored} workspaces restored, model ${env.openaiApiKey ? env.model : 'not configured'}`,
    )
  })

  // Docker stops the container with SIGTERM; finish pending database writes first.
  process.on('SIGTERM', () => {
    server.close()
    flushWrites().finally(() => process.exit(0))
  })
}

start().catch((error) => {
  console.error('failed to start', error)
  process.exit(1)
})
