import type { Task } from '../../types/task'

export type Tone = 'red' | 'orange' | 'amber' | 'blue' | 'gray' | 'green' | 'purple'

export function toneOfTask(task: Task): Tone {
  if (task.done) return 'green'
  if (task.blocked) return 'gray'
  switch (task.priority) {
    case 'p1':
      return 'red'
    case 'p2':
      return 'orange'
    case 'p3':
      return 'amber'
    default:
      return 'blue'
  }
}
