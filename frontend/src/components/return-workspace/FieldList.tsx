import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, ChevronDown, ChevronRight, AlertTriangle, ArrowUpDown } from 'lucide-react'
import type { FieldInfo } from '../../api/client'
import { FieldRow } from './FieldRow'
import { FIELD_STATE_META } from './fieldState'

type StateFilter = 'all' | 'editable' | 'ai_generated' | 'locked' | 'verified' | 'needs_approval'
type SortKey = 'category' | 'label' | 'confidence' | 'value'

function parseValue(value: string): number {
  const n = parseFloat(value.replace(/,/g, ''))
  return Number.isNaN(n) ? 0 : n
}

const STATE_FILTERS: { key: StateFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'editable', label: FIELD_STATE_META.editable.label },
  { key: 'ai_generated', label: FIELD_STATE_META.ai_generated.label },
  { key: 'locked', label: FIELD_STATE_META.locked.label },
  { key: 'verified', label: FIELD_STATE_META.verified.label },
  { key: 'needs_approval', label: 'Needs Approval' },
]

export function FieldList({
  fields,
  selectedFieldId,
  onSelectField,
  onFieldUpdated,
}: {
  fields: FieldInfo[]
  selectedFieldId?: number | null
  onSelectField?: (field: FieldInfo) => void
  onFieldUpdated: (updated: FieldInfo) => void
}) {
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('category')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Category rollup — the "summary" half of "summary vs. detail," computed
  // from every field regardless of active filters, so totals always reflect
  // the whole return. Doubles as a quick-jump: click one to narrow to it.
  const categorySummary = useMemo(() => {
    const map = new Map<string, number>()
    for (const f of fields) {
      map.set(f.category, (map.get(f.category) ?? 0) + parseValue(f.value))
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [fields])

  const filtered = useMemo(() => {
    return fields.filter((f) => {
      if (stateFilter === 'needs_approval') {
        if (!(f.state === 'ai_generated' && f.confidence != null && f.confidence < 0.7)) return false
      } else if (stateFilter !== 'all' && f.state !== stateFilter) {
        return false
      }
      if (categoryFilter && f.category !== categoryFilter) return false
      if (query && !f.label.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [fields, query, stateFilter, categoryFilter])

  // Sorting by category keeps the grouped/collapsible view (the default);
  // any other sort flattens into one ordered list — grouping and a global
  // sort order don't really make sense at the same time.
  const sortedFlat = useMemo(() => {
    if (sortBy === 'category') return null
    const arr = [...filtered]
    if (sortBy === 'label') arr.sort((a, b) => a.label.localeCompare(b.label))
    else if (sortBy === 'confidence') arr.sort((a, b) => (a.confidence ?? -1) - (b.confidence ?? -1))
    else if (sortBy === 'value') arr.sort((a, b) => parseValue(b.value) - parseValue(a.value))
    return arr
  }, [filtered, sortBy])

  const grouped = useMemo(() => {
    const map = new Map<string, FieldInfo[]>()
    for (const f of filtered) {
      const list = map.get(f.category) ?? []
      list.push(f)
      map.set(f.category, list)
    }
    return map
  }, [filtered])

  const categories = Array.from(grouped.keys()).sort()

  const fieldRefs = useRef<Record<number, HTMLDivElement | null>>({})

  // When the selected field arrives from outside this component (a Dashboard
  // deep-link, a RelatedPanel jump), being "selected" isn't the same as
  // being visible on a 150-field return — auto-expand its category and
  // scroll it into view instead of making the user go hunt for it.
  useEffect(() => {
    if (selectedFieldId == null) return
    const field = fields.find((f) => f.id === selectedFieldId)
    if (field) {
      setCollapsed((c) => (c[field.category] ? { ...c, [field.category]: false } : c))
    }
    const raf = requestAnimationFrame(() => {
      fieldRefs.current[selectedFieldId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => cancelAnimationFrame(raf)
  }, [selectedFieldId, fields])

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
        {Object.entries(FIELD_STATE_META).map(([state, meta]) => {
          const Icon = meta.icon
          return (
            <span key={state} className="flex items-center gap-1">
              <Icon className="w-3.5 h-3.5" />
              {meta.label}
            </span>
          )
        })}
        <span className="flex items-center gap-1 text-red-600">
          <AlertTriangle className="w-3.5 h-3.5" />
          Needs Approval
        </span>
      </div>

      {/* Category rollup / summary strip */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => setCategoryFilter(null)}
          className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
            categoryFilter === null
              ? 'bg-brand-50 border-brand-300 text-brand-800'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          All ({fields.length})
        </button>
        {categorySummary.map(([category, total]) => (
          <button
            key={category}
            onClick={() => setCategoryFilter(categoryFilter === category ? null : category)}
            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
              categoryFilter === category
                ? 'bg-brand-50 border-brand-300 text-brand-800'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {category}: ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </button>
        ))}
      </div>

      {/* State filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATE_FILTERS.map((sf) => (
          <button
            key={sf.key}
            onClick={() => setStateFilter(sf.key)}
            className={`text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
              stateFilter === sf.key
                ? sf.key === 'needs_approval'
                  ? 'bg-red-100 border-red-300 text-red-800'
                  : 'bg-slate-800 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {sf.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search ${fields.length} fields…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm bg-white"
          />
        </div>
        <div className="relative">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="text-sm border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 bg-white text-slate-700"
          >
            <option value="category">By Category</option>
            <option value="label">By Label (A–Z)</option>
            <option value="confidence">By Confidence (low first)</option>
            <option value="value">By Value (high first)</option>
          </select>
        </div>
      </div>

      {sortedFlat ? (
        // Flat, sorted view — no category grouping while a specific sort is active
        <>
          {sortedFlat.length === 0 && <p className="text-sm text-slate-500">No fields match.</p>}
          <div className="border border-slate-200 rounded-xl bg-white shadow-sm divide-y divide-slate-100 overflow-hidden">
            {sortedFlat.map((f) => (
              <div key={f.id} ref={(el) => { fieldRefs.current[f.id] = el }}>
                <FieldRow
                  field={f}
                  isSelected={f.id === selectedFieldId}
                  onClick={() => onSelectField?.(f)}
                  onFieldUpdated={onFieldUpdated}
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {categories.length === 0 && <p className="text-sm text-slate-500">No fields match.</p>}
          <div className="space-y-3">
            {categories.map((category) => {
              const items = grouped.get(category)!
              const isCollapsed = collapsed[category] ?? false
              return (
                <div key={category} className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [category]: !isCollapsed }))}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-900 bg-slate-50 hover:bg-slate-100"
                  >
                    <span>
                      {category} <span className="text-slate-400 font-normal">({items.length})</span>
                    </span>
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100">
                      {items.map((f) => (
                        <div key={f.id} ref={(el) => { fieldRefs.current[f.id] = el }}>
                          <FieldRow
                            field={f}
                            isSelected={f.id === selectedFieldId}
                            onClick={() => onSelectField?.(f)}
                            onFieldUpdated={onFieldUpdated}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
