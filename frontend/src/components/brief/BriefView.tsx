import { useApp } from '../../context/AppContext'
import { useEditRequests } from '../../hooks/useEditRequests'
import type { BriefFieldKey, BriefItem } from '../../types/brief'
import { briefDateKeys, briefFieldLabels } from '../../utils/labels'
import { weekdayAndDate } from '../../utils/isoDate'
import FactChip from '../common/FactChip'
import { PencilIcon, PlusIcon } from '../common/Icons'
import Menu, { type MenuItem } from '../common/Menu'
import './BriefView.css'

const fieldOrder: BriefFieldKey[] = ['client', 'campaign', 'message', 'audience', 'tone', 'deadline', 'launchDate']

interface ItemRowProps {
  item: BriefItem
  label: string
  actions: MenuItem[]
}

function ItemRow({ item, label, actions }: ItemRowProps) {
  const { showSource } = useApp()
  const { field } = item
  return (
    <li className={`brief-item brief-item-${field.status}`}>
      {field.quote !== null ? (
        <button type="button" className="brief-item-text" onClick={() => showSource({ field, label })} title="הצג בטקסט המקור">
          {field.value}
        </button>
      ) : (
        <span className="brief-item-text">{field.value}</span>
      )}
      <FactChip field={field} label={label} compact />
      <Menu items={actions} label={`פעולות: ${label}`} />
    </li>
  )
}

export default function BriefView() {
  const { app, showSource } = useApp()
  const edit = useEditRequests()
  const brief = app.workspace?.brief
  const clientName = brief?.fields.client.value
  const campaignName = brief?.fields.campaign.value
  const live = (items: BriefItem[]) => items.filter((item) => !item.deleted)

  return (
    <section id="brief" className="brief card-surface" aria-label="בריף">
      <header className="brief-header">
        <h2 className="section-title">בריף מקצועי</h2>
        {brief && (clientName || campaignName) && (
          <p className="brief-subtitle">{[clientName, campaignName].filter(Boolean).join(' · ')}</p>
        )}
      </header>

      {!brief ? (
        <div className="brief-empty">
          <p>עדיין אין בריף. הדביקו בצ׳אט בריף מהלקוח והוא יופיע כאן כמסמך מסודר, או הוסיפו ידנית.</p>
          <div className="brief-actions">
            <button type="button" className="brief-add" onClick={() => edit.newBriefItem('deliverables')}>
              <PlusIcon size={15} /> תוצר
            </button>
            <button type="button" className="brief-add" onClick={() => edit.newBriefItem('constraints')}>
              <PlusIcon size={15} /> תנאי
            </button>
          </div>
        </div>
      ) : (
        <div className="brief-body">
          <dl className="brief-fields">
            {fieldOrder.map((key) => {
              const field = brief.fields[key]
              const label = briefFieldLabels[key]
              const isDate = briefDateKeys.includes(key)
              const display = field.value ? (isDate ? weekdayAndDate(field.value) : field.value) : null
              return (
                <div key={key} className="brief-field">
                  <dt>{label}</dt>
                  <dd>
                    {display ? (
                      field.quote ? (
                        <button type="button" className="brief-value" onClick={() => showSource({ field, label })} title="הצג בטקסט המקור">
                          {display}
                        </button>
                      ) : (
                        <span className="brief-value">{display}</span>
                      )
                    ) : (
                      <span className="brief-value brief-value-missing">לא צוין</span>
                    )}
                    <FactChip field={field} label={label} compact />
                    <button type="button" className="icon-button brief-edit" aria-label={`עריכת ${label}`} onClick={() => edit.briefField(key, field.value)}>
                      <PencilIcon size={15} />
                    </button>
                  </dd>
                </div>
              )
            })}
          </dl>

          <div className="brief-block">
            <div className="brief-block-header">
              <h3>מה צריך להכין</h3>
              <button type="button" className="brief-add" onClick={() => edit.newBriefItem('deliverables')}>
                <PlusIcon size={15} /> תוצר
              </button>
            </div>
            <ul>
              {live(brief.deliverables).map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  label="תוצר"
                  actions={[
                    { label: 'עריכה', onSelect: () => edit.briefItem(item, 'תוצר') },
                    { label: 'הסרה', onSelect: () => void app.deleteBriefItem(item.id) },
                  ]}
                />
              ))}
            </ul>
          </div>

          <div className="brief-block">
            <div className="brief-block-header">
              <h3>תנאים לביצוע</h3>
              <button type="button" className="brief-add" onClick={() => edit.newBriefItem('constraints')}>
                <PlusIcon size={15} /> תנאי
              </button>
            </div>
            <ul>
              {live(brief.constraints).map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  label="תנאי"
                  actions={[
                    { label: 'עריכה', onSelect: () => edit.briefItem(item, 'תנאי') },
                    { label: 'הסרה', onSelect: () => void app.deleteBriefItem(item.id) },
                  ]}
                />
              ))}
            </ul>
          </div>

          {live(brief.suggestions).length > 0 && (
            <div className="brief-block">
              <h3>הצעות מקצועיות של המערכת</h3>
              <p className="brief-note">אלה הנחות, לא עובדות מהטקסט. אישור הופך הצעה לשלך.</p>
              <ul>
                {live(brief.suggestions).map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    label="הצעה"
                    actions={[
                      { label: 'אישור כתנאי', onSelect: () => void app.promoteSuggestion(item.id, 'constraints') },
                      { label: 'אישור כתוצר', onSelect: () => void app.promoteSuggestion(item.id, 'deliverables') },
                      { label: 'הסרה', onSelect: () => void app.deleteBriefItem(item.id) },
                    ]}
                  />
                ))}
              </ul>
            </div>
          )}

          {live(brief.missingDetails).length > 0 && (
            <div className="brief-block">
              <h3>מה עדיין חסר</h3>
              <ul>
                {live(brief.missingDetails).map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    label="פרט חסר"
                    actions={[
                      { label: 'מענה', onSelect: () => edit.missingDetail(item) },
                      { label: 'הסרה', onSelect: () => void app.deleteBriefItem(item.id) },
                    ]}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
