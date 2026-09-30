import type { DragEvent } from 'react'

// What makes a card draggable. Firefox will not start a drag without some data, so the id goes in as
// plain text; the board itself tracks what is being dragged.
export function dragProps(id: string, onStart: () => void, onEnd: () => void) {
  return {
    draggable: true,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      event.dataTransfer.setData('text/plain', id)
      event.dataTransfer.effectAllowed = 'move'
      onStart()
    },
    onDragEnd: onEnd,
  }
}
