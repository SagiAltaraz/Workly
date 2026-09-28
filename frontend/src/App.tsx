import { useEffect, useState } from 'react'

interface HealthResponse {
  ok: boolean
  data?: { status: string; demoMode: boolean }
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false }))
  }, [])

  return (
    <main style={{ padding: 24 }}>
      <h1>Workly</h1>
      <p>
        {health === null && 'בודק חיבור לשרת…'}
        {health?.ok && `השרת פעיל${health.data?.demoMode ? ' (מצב דמו)' : ''}`}
        {health && !health.ok && 'אין חיבור לשרת'}
      </p>
    </main>
  )
}
