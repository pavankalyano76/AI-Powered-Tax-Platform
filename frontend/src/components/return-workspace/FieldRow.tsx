import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { AlertTriangle } from 'lucide-react'
import { updateField, type FieldInfo } from '../../api/client'
import { ConfidenceExplain } from './ConfidenceExplain'
import { FIELD_STATE_META } from './fieldState'

const ROW_CURSOR: Record<string, string> = {
  editable: 'cursor-text hover:bg-slate-50',
  ai_generated: 'cursor-pointer hover:bg-brand-50',
  locked: 'cursor-not-allowed opacity-70',
  verified: 'cursor-pointer hover:bg-brand-50',
}

function confidenceColor(confidence: number | null) {
  if (confidence == null) return ''
  if (confidence >= 0.9) return 'bg-green-100 text-green-800'
  if (confidence >= 0.7) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

export function FieldRow({
  field,
  isSelected,
  onClick,
  onFieldUpdated,
}: {
  field: FieldInfo
  isSelected?: boolean
  onClick?: () => void
  onFieldUpdated: (updated: FieldInfo) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftValue, setDraftValue] = useState(field.value)
  const cancelledRef = useRef(false)
  const meta = FIELD_STATE_META[field.state]
  const StateIcon = meta?.icon
  const isEditableField = field.state === 'editable'
  const needsApproval = field.state === 'ai_generated' && field.confidence != null && field.confidence < 0.7

  function handleRowClick() {
    if (isEditableField && !editing) {
      setDraftValue(field.value)
      setEditing(true)
      return
    }
    onClick?.()
  }

  function openExplain(e: MouseEvent) {
    e.stopPropagation()
    onClick?.()
    setExpanded((v) => !v)
  }

  async function commitEdit() {
    if (cancelledRef.current) {
      cancelledRef.current = false
      setEditing(false)
      return
    }
    setEditing(false)
    if (draftValue === field.value) return
    const updated = await updateField(field.id, { value: draftValue })
    onFieldUpdated(updated)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur() // triggers commitEdit via onBlur
    } else if (e.key === 'Escape') {
      cancelledRef.current = true
      e.currentTarget.blur()
    }
  }

  return (
    <div className={isSelected ? 'bg-brand-50' : ''}>
      <div
        onClick={handleRowClick}
        className={`flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${ROW_CURSOR[field.state] ?? ''}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {StateIcon && (
            <span title={meta.label} className="shrink-0">
              <StateIcon className="w-3.5 h-3.5 text-slate-400" />
            </span>
          )}
          <span className="text-slate-700 truncate">{field.label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {field.state === 'verified' && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">Verified</span>
          )}
          {needsApproval && (
            <button
              type="button"
              onClick={openExplain}
              title="Low confidence — review and approve or correct"
              className="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-800 hover:ring-1 hover:ring-offset-1 hover:ring-red-300 transition-shadow"
            >
              <AlertTriangle className="w-3 h-3" />
              Needs Approval
            </button>
          )}
          {field.confidence != null && (
            <button
              type="button"
              onClick={openExplain}
              title="Why?"
              className={`text-xs font-medium px-1.5 py-0.5 rounded transition-shadow ${confidenceColor(field.confidence)} hover:ring-1 hover:ring-offset-1 hover:ring-slate-300`}
            >
              {Math.round(field.confidence * 100)}%
            </button>
          )}
          {editing ? (
            <input
              autoFocus
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleKeyDown}
              onBlur={commitEdit}
              className="font-medium text-slate-900 tabular-nums text-right border border-brand-300 rounded px-1.5 py-0.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          ) : (
            <span
              className={`font-medium text-slate-900 tabular-nums ${
                isEditableField ? 'border-b border-dashed border-slate-300' : ''
              }`}
            >
              {field.value}
            </span>
          )}
        </div>
      </div>
      {expanded && (
        <ConfidenceExplain
          field={field}
          onFieldUpdated={(updated) => {
            onFieldUpdated(updated)
            setExpanded(false)
          }}
        />
      )}
    </div>
  )
}
