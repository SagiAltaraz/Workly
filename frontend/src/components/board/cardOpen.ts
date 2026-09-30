import type { KeyboardEvent, MouseEvent } from 'react'

const interactive = 'button, a, input, textarea, select, [role="menu"]'

// A click anywhere on a card opens it in full, except on the controls inside it (menu, quote, chips).
export function openProps(open: () => void) {
  return {
    tabIndex: 0,
    onClick: (event: MouseEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest(interactive)) return
      open()
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open()
      }
    },
  }
}
