import express from 'express'
import { env } from './config/env'
import { initDatabase } from './db/pool'
import healthRoutes from './routes/health.routes'
import workspaceRoutes from './routes/workspace.routes'
import type { ApiResponse } from './types/api'

const app = express()

app.use(express.json({ limit: '1mb' }))

app.use('/api/health', healthRoutes)
app.use('/api/workspaces', workspaceRoutes)

app.use((_req, res: express.Response<ApiResponse<never>>) => {
  res.status(404).json({ ok: false, error: 'Route not found' })
})

async function start() {
  await initDatabase()
  app.listen(env.port, () => {
    console.log(`Server on :${env.port} (${env.demoMode ? 'demo mode' : 'live model'})`)
  })
}

start().catch((error) => {
  console.error('failed to start', error)
  process.exit(1)
})
