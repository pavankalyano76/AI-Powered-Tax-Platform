import { ChevronRight } from 'lucide-react'
import { useUser } from '../../context/UserContext'
import type { TaskInfo, MessageInfo, DocumentInfo } from '../../api/client'

const STAFF_ROLES = ['preparer', 'reviewer', 'admin', 'seasonal_staff']

function TaskItem({ task, onClick }: { task: TaskInfo; onClick?: () => void }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-slate-800">{task.title}</span>
        {onClick && <ChevronRight className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
      </div>
      <div className="text-slate-400 mt-0.5">
        {task.status} · {task.priority}
        {task.due_date && ` · due ${task.due_date}`}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white hover:border-brand-300 hover:shadow-sm transition-all"
      >
        {body}
      </button>
    )
  }

  return <div className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">{body}</div>
}

function MessageItem({ message, onClick }: { message: MessageInfo; onClick?: () => void }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-slate-800">{message.author.name}</span>
        <div className="flex items-center gap-1 shrink-0">
          {message.visibility === 'internal' && (
            <span className="text-[10px] uppercase tracking-wide text-purple-600 bg-purple-50 px-1 rounded">
              Internal
            </span>
          )}
          {onClick && <ChevronRight className="w-3.5 h-3.5 text-brand-500" />}
        </div>
      </div>
      <div className="text-slate-600 mt-0.5">{message.body}</div>
    </>
  )

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white hover:border-brand-300 hover:shadow-sm transition-all"
      >
        {body}
      </button>
    )
  }

  return <div className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">{body}</div>
}

export function RelatedPanel({
  tasks,
  messages,
  selectedDocument,
  onSelectTask,
  onSelectMessage,
}: {
  tasks: TaskInfo[]
  messages: MessageInfo[]
  selectedDocument: DocumentInfo | null
  onSelectTask?: (task: TaskInfo) => void
  onSelectMessage?: (message: MessageInfo) => void
}) {
  const { currentUser } = useUser()
  const isStaff = currentUser ? STAFF_ROLES.includes(currentUser.role) : false

  // clients never see internal firm notes
  const visibleMessages = messages.filter((m) => isStaff || m.visibility === 'client')

  const relatedTasks = selectedDocument
    ? tasks.filter((t) => t.related_document_id === selectedDocument.id)
    : []
  const relatedMessages = selectedDocument
    ? visibleMessages.filter((m) => m.related_document_id === selectedDocument.id)
    : []

  const otherTasks = tasks.filter((t) => !relatedTasks.includes(t) && t.status !== 'done')
  const otherMessages = visibleMessages.filter((m) => !relatedMessages.includes(m))

  // Only tasks with a linked document have somewhere to actually jump to —
  // the rest render as plain, non-clickable cards.
  function taskClickHandler(task: TaskInfo) {
    return task.related_document_id && onSelectTask ? () => onSelectTask(task) : undefined
  }

  return (
    <div className="border-t border-slate-200 p-4 space-y-4">
      {selectedDocument && (relatedTasks.length > 0 || relatedMessages.length > 0) && (
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Related to this document
          </div>
          <div className="space-y-1.5">
            {relatedTasks.map((t) => (
              <TaskItem key={`t-${t.id}`} task={t} onClick={taskClickHandler(t)} />
            ))}
            {relatedMessages.map((m) => (
              <MessageItem key={`m-${m.id}`} message={m} onClick={onSelectMessage ? () => onSelectMessage(m) : undefined} />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          Other open items on this return
        </div>
        {otherTasks.length === 0 && otherMessages.length === 0 ? (
          <p className="text-xs text-slate-400">Nothing else open.</p>
        ) : (
          <div className="space-y-1.5">
            {otherTasks.map((t) => (
              <TaskItem key={`t-${t.id}`} task={t} onClick={taskClickHandler(t)} />
            ))}
            {otherMessages.map((m) => (
              <MessageItem key={`m-${m.id}`} message={m} onClick={onSelectMessage ? () => onSelectMessage(m) : undefined} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
