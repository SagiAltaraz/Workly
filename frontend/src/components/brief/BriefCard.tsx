import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useEditRequests } from '../../hooks/useEditRequests'
import type { Brief, BriefFieldKey, BriefItem } from '../../types/brief'
import { briefDateKeys, briefFieldLabels } from '../../utils/labels'
import { weekdayAndDate } from '../../utils/isoDate'
import FactChip from '../common/FactChip'
import { ChevronDownIcon, PencilIcon, PlusIcon } from '../common/Icons'
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

// One brief, as its own collapsible card - so a workspace with several client requests stays
// readable: collapse the ones you already read, keep the current one open.
export default function BriefCard({ brief, questionCount }: { brief: Brief; questionCount: number }) {
  const { app, showSource } = useApp()
  const edit = useEditRequests()
  const [collapsed, setCollapsed] = useState(false)
  const live = (items: BriefItem[]) => items.filter((item) => !item.deleted)

  const clientName = brief.fields.client.value
  const campaignName = brief.fields.campaign.value
  const title = [clientName, campaignName].filter(Boolean).join(' · ') || 'בריף ללא שם'

  return (
    <article className="brief-card card-surface">
      <button
        type="button"
        className="brief-card-toggle"
        aria-expanded={!collapsed}
        aria-controls={`brief-body-${brief.id}`}
        title={collapsed ? 'לחיצה תרחיב את הבריף' : 'לחיצה תצמצם את הבריף'}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="brief-card-title">{title}</span>
        {questionCount > 0 && <span className="brief-card-question-count">{questionCount} שאלות</span>}
        <span className={`brief-chevron${collapsed ? ' brief-chevron-collapsed' : ''}`}>
          <ChevronDownIcon size={18} />
        </span>
      </button>

      <div id={`brief-body-${brief.id}`} hidden={collapsed}>
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
                    <button type="button" className="icon-button brief-edit" aria-label={`עריכת ${label}`} onClick={() => edit.briefField(brief.id, key, field.value)}>
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
              <button type="button" className="brief-add" onClick={() => edit.newBriefItem(brief.id, 'deliverables')}>
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
              <button type="button" className="brief-add" onClick={() => edit.newBriefItem(brief.id, 'constraints')}>
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
      </div>
    </article>
  )
}
