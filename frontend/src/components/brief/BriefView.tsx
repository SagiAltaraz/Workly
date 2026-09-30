import { useApp } from '../../context/AppContext'
import { useEditRequests } from '../../hooks/useEditRequests'
import { PlusIcon } from '../common/Icons'
import BriefCard from './BriefCard'
import './BriefView.css'

export default function BriefView() {
  const { app } = useApp()
  const edit = useEditRequests()
  const workspace = app.workspace
  const briefs = workspace?.briefs ?? []

  return (
    <section id="brief" className="brief-section" aria-label="בריפים">
      <header className="brief-section-header">
        <h2 className="section-title">בריף מקצועי{briefs.length > 1 ? ` (${briefs.length})` : ''}</h2>
        {briefs.length > 0 && (
          <button type="button" className="brief-add" onClick={() => void app.addBrief()}>
            <PlusIcon size={15} /> בריף חדש
          </button>
        )}
      </header>

      {briefs.length === 0 ? (
        <div className="brief-empty card-surface">
          <p>עדיין אין בריף. הדביקו בצ׳אט בריף מהלקוח והוא יופיע כאן כמסמך מסודר, או הוסיפו ידנית.</p>
          <div className="brief-actions">
            <button type="button" className="brief-add" onClick={() => edit.newBriefItem(null, 'deliverables')}>
              <PlusIcon size={15} /> תוצר
            </button>
            <button type="button" className="brief-add" onClick={() => edit.newBriefItem(null, 'constraints')}>
              <PlusIcon size={15} /> תנאי
            </button>
          </div>
        </div>
      ) : (
        <div className="brief-list">
          {briefs.map((brief) => (
            <BriefCard
              key={brief.id}
              brief={brief}
              questionCount={workspace?.questions.filter((question) => question.targetType === 'brief' && question.targetId === brief.id).length ?? 0}
            />
          ))}
        </div>
      )}
    </section>
  )
}
