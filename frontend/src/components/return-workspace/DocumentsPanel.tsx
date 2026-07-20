import { useMemo, useState } from 'react'
import { Search, FileText, ChevronRight } from 'lucide-react'
import type { DocumentInfo, FieldInfo } from '../../api/client'
import { Card } from '../ui/Card'

export function DocumentsPanel({
  documents,
  fields,
  onSelectDocument,
}: {
  documents: DocumentInfo[]
  fields: FieldInfo[]
  onSelectDocument: (doc: DocumentInfo) => void
}) {
  const [query, setQuery] = useState('')

  const fieldCounts = useMemo(() => {
    const map = new Map<number, number>()
    for (const f of fields) {
      if (f.source_document_id != null) {
        map.set(f.source_document_id, (map.get(f.source_document_id) ?? 0) + 1)
      }
    }
    return map
  }, [fields])

  const filtered = useMemo(() => {
    if (!query) return documents
    const q = query.toLowerCase()
    return documents.filter((d) => d.name.toLowerCase().includes(q) || d.doc_type.toLowerCase().includes(q))
  }, [documents, query])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search ${documents.length} documents…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm bg-white"
          />
        </div>
        <span className="text-sm text-slate-400 shrink-0">
          {filtered.length} of {documents.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No documents match.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((doc) => {
            const count = fieldCounts.get(doc.id) ?? 0
            const clickable = count > 0
            return (
              <button
                key={doc.id}
                onClick={() => clickable && onSelectDocument(doc)}
                disabled={!clickable}
                className="text-left disabled:cursor-not-allowed"
              >
                <Card
                  className={`p-4 flex items-start gap-3 transition-shadow ${
                    clickable ? 'hover:shadow-md hover:border-brand-300' : 'opacity-60'
                  }`}
                >
                  <FileText className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900 truncate">{doc.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {doc.doc_type} · {doc.page_count} page{doc.page_count !== 1 ? 's' : ''} · {count} field
                      {count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {clickable && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
                </Card>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
