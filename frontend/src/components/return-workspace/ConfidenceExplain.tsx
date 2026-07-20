import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import {
  explainField,
  getFieldCorrection,
  updateField,
  type FieldExplanation,
  type FieldCorrection,
  type FieldInfo,
} from '../../api/client'

const ACTION_META: Record<string, { label: string; className: string }> = {
  verify: {
    label: 'Verify this value before proceeding',
    className: 'text-red-700 bg-red-50 border-red-200',
  },
  spot_check: {
    label: 'Quick spot-check recommended',
    className: 'text-amber-700 bg-amber-50 border-amber-200',
  },
}

export function ConfidenceExplain({
  field,
  onFieldUpdated,
}: {
  field: FieldInfo
  onFieldUpdated: (updated: FieldInfo) => void
}) {
  const [explanation, setExplanation] = useState<FieldExplanation | null>(null)
  const [correction, setCorrection] = useState<FieldCorrection | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([explainField(field.id), getFieldCorrection(field.id)])
      .then(([exp, corr]) => {
        setExplanation(exp)
        setCorrection(corr.suggested_value ? corr : null)
      })
      .finally(() => setLoading(false))
  }, [field.id])

  async function acceptCorrection() {
    if (!correction?.suggested_value) return
    setApplying(true)
    try {
      const updated = await updateField(field.id, {
        value: correction.suggested_value,
        state: 'verified',
        confidence: null,
      })
      onFieldUpdated(updated)
    } finally {
      setApplying(false)
    }
  }

  async function keepMine() {
    setApplying(true)
    try {
      const updated = await updateField(field.id, { state: 'verified', confidence: null })
      onFieldUpdated(updated)
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-3 text-xs text-slate-400 bg-slate-50 border-t border-slate-100">
        Loading explanation…
      </div>
    )
  }

  if (!explanation) return null

  return (
    <div
      className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-sm space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Brief AI reasoning first — this is what the reviewer reads immediately;
          the document viewer on the right has already jumped to this field's
          source by the time they get here, since selecting happens on badge click. */}
      <div className="space-y-1">
        <p className="text-slate-700">{explanation.summary}</p>
        {explanation.uncertainty && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
            {explanation.uncertainty}
          </p>
        )}
        {explanation.recommended_action && ACTION_META[explanation.recommended_action] && (
          <p
            className={`text-xs font-medium px-2 py-1.5 rounded-lg border ${ACTION_META[explanation.recommended_action].className}`}
          >
            Recommended action: {ACTION_META[explanation.recommended_action].label}
          </p>
        )}
      </div>

      {/* Spot-check tier (moderate confidence, no suggested correction) still
          needs a real action, not just a passive note — otherwise "what
          action should they take" has no way to actually be taken. */}
      {explanation.recommended_action === 'spot_check' && !correction?.suggested_value && (
        <button
          disabled={applying}
          onClick={keepMine}
          className="text-xs font-medium border border-amber-300 text-amber-700 px-2.5 py-1 rounded-lg hover:bg-amber-100 disabled:opacity-50"
        >
          Mark as reviewed
        </button>
      )}

      {correction?.suggested_value && (
        <div className="border border-brand-200 bg-brand-50 rounded-lg px-3 py-2 text-xs text-brand-900 space-y-2">
          <div>
            <span className="font-medium">AI suggests: </span>
            {correction.suggested_value}
            {correction.rationale && <p className="text-brand-700 mt-0.5">{correction.rationale}</p>}
          </div>
          <div className="flex gap-2">
            <button
              disabled={applying}
              onClick={acceptCorrection}
              className="text-xs font-medium bg-brand-600 text-white px-2.5 py-1 rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              Accept suggested value
            </button>
            <button
              disabled={applying}
              onClick={keepMine}
              className="text-xs font-medium border border-brand-300 text-brand-700 px-2.5 py-1 rounded-lg hover:bg-brand-100 disabled:opacity-50"
            >
              Keep mine, mark reviewed
            </button>
          </div>
        </div>
      )}

      {explanation.evidence.length > 0 && (
        <ul className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-200">
          {explanation.evidence.map((e, i) => (
            <li key={i}>
              {e.type === 'document' ? (
                <span className="inline-flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {e.detail}
                </span>
              ) : (
                <span>
                  <span className="font-medium text-slate-600">Calculation:</span> {e.detail}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
