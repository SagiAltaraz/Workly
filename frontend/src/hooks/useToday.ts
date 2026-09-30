import { useEffect, useState } from 'react'
import { todayInIsrael } from '../utils/isoDate'

// Just the date in Israel, refreshed once a minute so it rolls over at midnight. No time of day: a
// ticking clock in the header is a distraction nobody asked to watch.
export function useToday(): string {
  const [today, setToday] = useState(() => todayInIsrael())
  useEffect(() => {
    const timer = setInterval(() => {
      const next = todayInIsrael()
      setToday((current) => (current === next ? current : next))
    }, 60_000)
    return () => clearInterval(timer)
  }, [])
  return today
}
