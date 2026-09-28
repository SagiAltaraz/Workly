import dotenv from 'dotenv'

// Local runs read the root .env; in Docker the variables arrive already set.
dotenv.config({ path: '../.env' })

const openaiApiKey = process.env.OPENAI_API_KEY?.trim() || undefined

export const env = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://workly:workly@localhost:5432/workly',
  openaiApiKey,
  // No key means the server answers from the recorded demo instead of calling the model.
  demoMode: !openaiApiKey,
}
