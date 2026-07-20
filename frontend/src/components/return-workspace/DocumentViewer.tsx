import type { DocumentInfo, FieldInfo } from '../../api/client'
import { FIELD_STATE_META } from './fieldState'

function parseRegion(region: string | null) {
  if (!region) return null
  const [x, y, w, h] = region.split(',').map(Number)
  if ([x, y, w, h].some((n) => Number.isNaN(n))) return null
  return { x, y, w, h }
}

export function DocumentViewer({
  field,
  document,
  allFields,
}: {
  field: FieldInfo | null
  document: DocumentInfo | null
  allFields: FieldInfo[]
}) {
  if (!field) {
    return (
      <div className="p-6 text-sm text-slate-400 text-center">Select a field to see where it came from.</div>
    )
  }

  if (!document) {
    return (
      <div className="p-4">
        <div className="text-sm font-medium text-slate-900 mb-1">{field.label}</div>
        <div className="text-sm text-slate-500">Entered directly — no source document. Value: {field.value}</div>
      </div>
    )
  }

  // Every field extracted from this same document, not just the selected
  // one — so the mock page reads as an actual filled-in form.
  const fieldsOnDoc = allFields.filter((f) => f.source_document_id === document.id && f.source_region)

  return (
    <div className="p-4">
      <div className="text-sm font-medium text-slate-900 mb-1">{field.label}</div>
      <div className="text-xs text-slate-500 mb-3">
        {document.name}, page {field.source_page ?? 1}
      </div>

      <div className="relative bg-white border border-slate-200 rounded-xl shadow-sm aspect-[8.5/11] overflow-hidden">
        <div className="absolute top-2 left-2 right-2 text-[10px] text-slate-400 uppercase tracking-wide">
          {document.doc_type} · {document.name}
        </div>

        {fieldsOnDoc.map((f) => {
          const region = parseRegion(f.source_region)
          if (!region) return null
          const isSelected = f.id === field.id
          const StateIcon = FIELD_STATE_META[f.state]?.icon
          return (
            <div
              key={f.id}
              title={f.label}
              className={[
                'absolute rounded-md border px-1.5 py-1 overflow-hidden leading-tight transition-colors',
                isSelected ? 'border-amber-500 bg-amber-100 z-10 shadow-sm' : 'border-slate-200 bg-slate-50',
              ].join(' ')}
              style={{
                left: `${region.x}%`,
                top: `${region.y}%`,
                width: `${region.w}%`,
                height: `${region.h}%`,
              }}
            >
              <div
                className={`flex items-center gap-1 text-[9px] truncate ${isSelected ? 'text-amber-800' : 'text-slate-400'}`}
              >
                {StateIcon && <StateIcon className="w-2.5 h-2.5 shrink-0" />}
                {f.label}
              </div>
              <div className={`text-[11px] font-medium truncate ${isSelected ? 'text-amber-900' : 'text-slate-600'}`}>
                {f.value}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 text-sm">
        <span className="font-medium text-slate-900">Extracted value: </span>
        <span className="text-slate-700">{field.value}</span>
      </div>

      {field.transform && (
        <div className="mt-2 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-900">
          <span className="font-medium">Calculation: </span>
          {field.transform}
        </div>
      )}
    </div>
  )
}
