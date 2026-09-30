// Where, inside a card, a drag currently is: the upper half means "before this card".
export function dropPosition(event: { clientY: number; currentTarget: HTMLElement }): 'before' | 'after' {
  const box = event.currentTarget.getBoundingClientRect()
  return event.clientY < box.top + box.height / 2 ? 'before' : 'after'
}
