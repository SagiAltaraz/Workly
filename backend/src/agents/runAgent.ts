import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import type { z } from 'zod'

interface AgentCall<T extends z.ZodType> {
  client: OpenAI
  model: string
  systemPrompt: string
  userText: string
  schema: T
  schemaName: string
}

// The single place that talks to the OpenAI SDK.
export async function runAgent<T extends z.ZodType>(call: AgentCall<T>): Promise<z.infer<T>> {
  const completion = await call.client.chat.completions.parse({
    model: call.model,
    temperature: 0,
    messages: [
      { role: 'system', content: call.systemPrompt },
      { role: 'user', content: call.userText },
    ],
    response_format: zodResponseFormat(call.schema, call.schemaName),
  })

  const message = completion.choices[0]?.message
  if (message?.refusal) throw new Error(`Model refused: ${message.refusal}`)
  if (!message?.parsed) throw new Error('Model returned no structured output')
  return message.parsed as z.infer<T>
}
