import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  getReturn,
  getMessages,
  type ReturnDetailData,
  type FieldInfo,
  type MessageInfo,
  type DocumentInfo,
} from '../api/client'
import { StatusBar } from '../components/return-workspace/StatusBar'
import { FieldList } from '../components/return-workspace/FieldList'
import { DocumentViewer } from '../components/return-workspace/DocumentViewer'
import { RelatedPanel } from '../components/return-workspace/RelatedPanel'
import { MessagesPanel } from '../components/return-workspace/MessagesPanel'
import { DocumentsPanel } from '../components/return-workspace/DocumentsPanel'
import { Breadcrumbs } from '../components/Breadcrumbs'

const TABS = [
  { key: 'fields', label: 'Fields' },
  { key: 'documents', label: 'Documents' },
  { key: 'messages', label: 'Messages' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function ReturnDetail() {
  const { id } = useParams()
  const [data, setData] = useState<ReturnDetailData | null>(null)
  const [messages, setMessages] = useState<MessageInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tab + selected field live in the URL (?tab=fields&field=12), not local
  // state — so refreshing, sharing a link, or hitting browser back/forward
  // actually preserves (or replays) exactly what you were looking at.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: TabKey = tabParam === 'messages' || tabParam === 'documents' ? tabParam : 'fields'
  const fieldParam = searchParams.get('field')
  const selectedFieldId = fieldParam ? Number(fieldParam) : null
  const highlightThreadId = searchParams.get('thread')

  function setActiveTab(tab: TabKey) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    })
  }

  function selectField(fieldId: number | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', 'fields')
      if (fieldId != null) next.set('field', String(fieldId))
      else next.delete('field')
      return next
    })
  }

  function selectThread(threadId: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', 'messages')
      next.set('thread', threadId)
      return next
    })
  }

  // Jump from a task in the sidebar straight to the field it's about — finds
  // any field sourced from the same document the task is linked to.
  function jumpToDocumentField(documentId: number) {
    const target = data?.fields.find((f) => f.source_document_id === documentId)
    if (target) selectField(target.id)
  }

  // Jump from the Documents tab straight into Fields, pre-selecting the
  // first field extracted from that document — not a dead-end list.
  function handleSelectDocument(doc: DocumentInfo) {
    const target = data?.fields.find((f) => f.source_document_id === doc.id)
    if (target) selectField(target.id)
  }

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([getReturn(Number(id)), getMessages(Number(id))])
      .then(([returnData, messageData]) => {
        setData(returnData)
        setMessages(messageData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="p-6 text-slate-500">Loading return…</p>
  if (error) return <p className="p-6 text-red-600">Error: {error}</p>
  if (!data) return null

  const selectedField = data.fields.find((f) => f.id === selectedFieldId) ?? null
  const selectedDocument = selectedField
    ? data.documents.find((d) => d.id === selectedField.source_document_id) ?? null
    : null

  function handleFieldUpdated(updated: FieldInfo) {
    setData((prev) =>
      prev ? { ...prev, fields: prev.fields.map((f) => (f.id === updated.id ? updated : f)) } : prev,
    )
  }

  const cameFromDashboard = searchParams.get('from') === 'dashboard'

  return (
    <div>
      <Breadcrumbs
        items={[
          cameFromDashboard ? { label: 'Dashboard', to: '/dashboard' } : { label: 'Returns', to: '/' },
          { label: `${data.client.name} — ${data.tax_year} ${data.form_type}` },
        ]}
      />
      <StatusBar taxReturn={data} history={data.history} />

      <div className="border-b border-slate-200 bg-white px-8 flex gap-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'fields' && (
        <div className="flex">
          <div className="flex-1 min-w-0">
            <FieldList
              fields={data.fields}
              selectedFieldId={selectedFieldId}
              onSelectField={(f) => selectField(f.id)}
              onFieldUpdated={handleFieldUpdated}
            />
          </div>
          <div className="w-96 shrink-0 border-l border-slate-200 bg-slate-50 sticky top-0 self-start max-h-screen overflow-y-auto">
            <DocumentViewer field={selectedField} document={selectedDocument} allFields={data.fields} />
            <RelatedPanel
              tasks={data.tasks}
              messages={messages}
              selectedDocument={selectedDocument}
              onSelectTask={(t) => t.related_document_id && jumpToDocumentField(t.related_document_id)}
              onSelectMessage={(m) => selectThread(m.thread_id)}
            />
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <DocumentsPanel documents={data.documents} fields={data.fields} onSelectDocument={handleSelectDocument} />
      )}

      {activeTab === 'messages' && (
        <MessagesPanel
          returnId={data.id}
          messages={messages}
          documents={data.documents}
          tasks={data.tasks}
          onMessagesChanged={setMessages}
          highlightThreadId={highlightThreadId}
        />
      )}
    </div>
  )
}
