import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, MessageSquare, FileText, CheckSquare } from 'lucide-react'
import { postMessage } from '../../api/client'
import type { MessageInfo, TaskInfo, DocumentInfo } from '../../api/client'
import { useUser } from '../../context/UserContext'
import { Avatar } from '../ui/Avatar'

const STAFF_ROLES = ['preparer', 'reviewer', 'admin', 'seasonal_staff']
const CLIENT_ROLES = ['client', 'business_owner']

type Thread = {
  threadId: string
  messages: MessageInfo[]
  document: DocumentInfo | null
  task: TaskInfo | null
}

function buildThreads(messages: MessageInfo[], documents: DocumentInfo[], tasks: TaskInfo[]): Thread[] {
  const map = new Map<string, MessageInfo[]>()
  for (const m of messages) {
    const list = map.get(m.thread_id) ?? []
    list.push(m)
    map.set(m.thread_id, list)
  }
  return Array.from(map.entries()).map(([threadId, msgs]) => {
    const sorted = [...msgs].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const docId = sorted.find((m) => m.related_document_id)?.related_document_id
    const taskId = sorted.find((m) => m.related_task_id)?.related_task_id
    return {
      threadId,
      messages: sorted,
      document: docId ? (documents.find((d) => d.id === docId) ?? null) : null,
      task: taskId ? (tasks.find((t) => t.id === taskId) ?? null) : null,
    }
  })
}

function threadStatus(
  thread: Thread,
  isStaffViewer: boolean,
): { label: string; tone: 'waiting' | 'resolved' | 'internal' } {
  if (thread.task?.status === 'done') {
    return { label: 'Resolved', tone: 'resolved' }
  }
  const clientVisible = thread.messages.filter((m) => m.visibility === 'client')
  if (clientVisible.length === 0) {
    return { label: 'Internal only', tone: 'internal' }
  }
  const last = clientVisible[clientVisible.length - 1]
  const lastFromClient = CLIENT_ROLES.includes(last.author.role)
  if (lastFromClient) {
    return { label: isStaffViewer ? 'Waiting on: Firm' : 'Waiting on: Your CPA', tone: 'waiting' }
  }
  return { label: isStaffViewer ? 'Waiting on: Client' : 'Waiting on: You', tone: 'waiting' }
}

const TONE_CLASS = {
  waiting: 'bg-amber-50 text-amber-800 border-amber-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  internal: 'bg-purple-50 text-purple-700 border-purple-200',
}

function ThreadCard({
  thread,
  isStaffViewer,
  isHighlighted,
  onSend,
}: {
  thread: Thread
  isStaffViewer: boolean
  isHighlighted?: boolean
  onSend: (
    threadId: string,
    body: string,
    visibility: string,
    docId: number | null,
    taskId: number | null,
  ) => Promise<void>
}) {
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<'client' | 'internal'>('client')
  const [sending, setSending] = useState(false)
  const status = threadStatus(thread, isStaffViewer)

  const visibleMessages = thread.messages.filter((m) => isStaffViewer || m.visibility === 'client')

  async function handleSend() {
    if (!body.trim()) return
    setSending(true)
    try {
      await onSend(
        thread.threadId,
        body.trim(),
        isStaffViewer ? visibility : 'client',
        thread.document?.id ?? null,
        thread.task?.id ?? null,
      )
      setBody('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className={`border rounded-xl bg-white shadow-sm overflow-hidden transition-shadow ${
        isHighlighted ? 'border-brand-400 ring-2 ring-brand-200' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
          {thread.document ? (
            <>
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              {thread.document.name}
            </>
          ) : thread.task ? (
            <>
              <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
              {thread.task.title}
            </>
          ) : (
            'General'
          )}
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TONE_CLASS[status.tone]}`}>
          {status.label}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {visibleMessages.map((m) => (
          <div key={m.id} className="flex items-start gap-2.5 text-sm">
            <Avatar name={m.author.name} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{m.author.name}</span>
                {m.visibility === 'internal' && (
                  <span className="text-[10px] uppercase tracking-wide text-purple-600 bg-purple-50 px-1 rounded">
                    Internal
                  </span>
                )}
                <span className="text-xs text-slate-400">{new Date(m.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-slate-600 mt-0.5">{m.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4 flex gap-2">
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a reply…"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
        />
        {isStaffViewer && (
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'client' | 'internal')}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="client">Client-visible</option>
            <option value="internal">Internal note</option>
          </select>
        )}
        <button
          onClick={handleSend}
          disabled={sending || !body.trim()}
          className="flex items-center gap-1.5 text-sm font-medium bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          Send
        </button>
      </div>
    </div>
  )
}

export function MessagesPanel({
  returnId,
  messages,
  documents,
  tasks,
  onMessagesChanged,
  highlightThreadId,
}: {
  returnId: number
  messages: MessageInfo[]
  documents: DocumentInfo[]
  tasks: TaskInfo[]
  onMessagesChanged: (messages: MessageInfo[]) => void
  highlightThreadId?: string | null
}) {
  const { currentUser } = useUser()
  const isStaffViewer = currentUser ? STAFF_ROLES.includes(currentUser.role) : false

  const visibleForRole = isStaffViewer ? messages : messages.filter((m) => m.visibility === 'client')
  const threads = useMemo(
    () => buildThreads(visibleForRole, documents, tasks),
    [visibleForRole, documents, tasks],
  )

  const threadRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (highlightThreadId && threadRefs.current[highlightThreadId]) {
      threadRefs.current[highlightThreadId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightThreadId, threads.length])

  async function handleSend(
    threadId: string,
    body: string,
    visibility: string,
    docId: number | null,
    taskId: number | null,
  ) {
    if (!currentUser) return
    const newMessage = await postMessage(returnId, {
      author_user_id: currentUser.id,
      visibility,
      body,
      thread_id: threadId,
      related_document_id: docId,
      related_task_id: taskId,
    })
    onMessagesChanged([...messages, newMessage])
  }

  if (!currentUser) return null

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <MessageSquare className="w-8 h-8 text-slate-300 mb-3" />
        <p className="text-slate-500 text-sm">No conversations on this return yet.</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl space-y-4">
      {threads.map((thread) => (
        <div key={thread.threadId} ref={(el) => { threadRefs.current[thread.threadId] = el }}>
          <ThreadCard
            thread={thread}
            isStaffViewer={isStaffViewer}
            isHighlighted={thread.threadId === highlightThreadId}
            onSend={handleSend}
          />
        </div>
      ))}
    </div>
  )
}
