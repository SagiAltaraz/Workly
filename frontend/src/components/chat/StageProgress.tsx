import type { StageMap } from '../../api/workspaceApi'
import { stageLabels, stageOrder } from '../../utils/labels'
import { CheckIcon, XIcon } from '../common/Icons'
import './StageProgress.css'

interface StageProgressProps {
  stages: StageMap
  running: boolean
}

// One line per pipeline stage, so a run shows what is happening and not just a spinner.
export default function StageProgress({ stages, running }: StageProgressProps) {
  const rows = stageOrder.filter((stage) => running || stages[stage])

  return (
    <ol className="stage-progress" aria-live="polite" aria-label="התקדמות העיבוד">
      {rows.map((stage) => {
        const event = stages[stage]
        const status = event?.status ?? 'pending'
        return (
          <li key={stage} className={`stage stage-${status}`}>
            <span className="stage-icon" aria-hidden="true">
              {status === 'running' && <span className="stage-spinner" />}
              {status === 'done' && <CheckIcon size={14} />}
              {status === 'failed' && <XIcon size={14} />}
              {status === 'skipped' && '–'}
            </span>
            <span className="stage-label">{stageLabels[stage]}</span>
            {event?.detail && <span className="stage-detail">{event.detail}</span>}
          </li>
        )
      })}
    </ol>
  )
}
