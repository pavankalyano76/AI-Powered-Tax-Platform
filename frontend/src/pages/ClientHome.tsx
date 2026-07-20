import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PartyPopper,
  AlertTriangle,
  ArrowRight,
  Upload,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react'
import {
  getReturns,
  getReturn,
  getMessages,
  updateTask,
  type ReturnSummary,
  type ReturnDetailData,
  type TaskInfo,
  type MessageInfo,
} from '../api/client'
import { useUser } from '../context/UserContext'
import { Card } from '../components/ui/Card'
import { UploadDialog } from '../components/onboarding/UploadDialog'
import { StatusBar } from '../components/return-workspace/StatusBar'

// Only "upload"-style tasks open the upload flow for now — the other
// checklist items (questionnaire, e-signature) aren't wired up yet, this is
// being built one interaction at a time.
function isUploadTask(task: TaskInfo) {
  return task.title.toLowerCase().startsWith('upload')
}

// Presentation-only copy for the known onboarding tasks — not a backend
// field, since this is just explanatory text for three specific checklist
// items, not something that needs to generalize across the whole Task model.
const TASK_META: Record<string, { estimate: string; purpose: string }> = {
  'upload your w-2': { estimate: 'About 2 minutes', purpose: 'needed to verify your wages and withholding' },
  'complete your tax questionnaire': {
    estimate: 'About 5 minutes',
    purpose: 'covers life changes that affect your return',
  },
  'sign the engagement letter': { estimate: 'About 1 minute', purpose: 'authorizes us to prepare your return' },
}

function getTaskMeta(title: string) {
  return TASK_META[title.toLowerCase()] ?? null
}

function TaskCard({
  task,
  highlight,
  subtitle,
  onUploadClick,
}: {
  task: TaskInfo
  highlight: boolean
  subtitle?: string
  onUploadClick?: () => void
}) {
  const uploadable = isUploadTask(task)
  const isDone = task.status === 'done'
  const meta = !isDone ? getTaskMeta(task.title) : null

  const content = (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      {isDone ? (
        <CheckCircle2 className="w-5 h-5 text-brand-500 shrink-0" />
      ) : (
        <span
          className={`w-5 h-5 rounded-full border-2 shrink-0 ${highlight ? 'border-brand-500' : 'border-slate-300'}`}
        />
      )}
      <div className="min-w-0">
        <div className={`font-medium ${isDone ? 'text-slate-500' : 'text-slate-900'}`}>{task.title}</div>
        {subtitle && <div className="text-xs text-brand-700 mt-0.5">{subtitle}</div>}
        {meta && (
          <div className="text-xs text-slate-400 mt-0.5">
            {meta.estimate} — {meta.purpose}
          </div>
        )}
      </div>
    </div>
  )

  // Completed non-upload tasks aren't revisitable yet — only the upload flow
  // supports "replace" for now, so they render as a plain, static card.
  if (uploadable) {
    return (
      <button onClick={onUploadClick} className="w-full text-left">
        <Card
          className={`flex items-center justify-between gap-3 px-4 py-3 hover:shadow-md transition-shadow ${
            highlight ? 'border-brand-300 bg-brand-50' : ''
          }`}
        >
          {content}
          <div className="flex items-center gap-1 text-xs font-medium text-brand-700 shrink-0">
            <Upload className="w-3.5 h-3.5" />
            {isDone ? 'Replace' : 'Upload'}
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </Card>
      </button>
    )
  }

  return (
    <Card className={`flex items-center gap-3 px-4 py-3 ${highlight ? 'border-brand-300 bg-brand-50' : ''}`}>
      {content}
    </Card>
  )
}

export function ClientHome() {
  const { currentUser } = useUser()
  const [summary, setSummary] = useState<ReturnSummary | null>(null)
  const [detail, setDetail] = useState<ReturnDetailData | null>(null)
  const [messages, setMessages] = useState<MessageInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadTask, setUploadTask] = useState<TaskInfo | null>(null)
  const [showWhy, setShowWhy] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    setLoading(true)
    getReturns(currentUser.id)
      .then(async (returns) => {
        const first = returns[0] ?? null
        setSummary(first)
        if (first) {
          const [full, msgs] = await Promise.all([getReturn(first.id), getMessages(first.id)])
          setDetail(full)
          setMessages(msgs)
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [currentUser])

  async function handleUploadSuccess() {
    if (!uploadTask) return
    const updated = await updateTask(uploadTask.id, { status: 'done' })
    setDetail((prev) =>
      prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === updated.id ? updated : t)) } : prev,
    )
    setUploadTask(null)
  }

  if (loading) return <p className="p-6 text-slate-500">Loading…</p>
  if (error) return <p className="p-6 text-red-600">Error: {error}</p>

  if (!summary || !detail) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center py-16">
        <p className="text-slate-500">No return on file yet. Your CPA will set one up shortly.</p>
      </div>
    )
  }

  const myTasks = detail.tasks.filter((t) => t.owner_user_id === currentUser?.id)
  const openTasks = myTasks.filter((t) => t.status !== 'done')
  const doneTasks = myTasks.filter((t) => t.status === 'done')
  const doneCount = doneTasks.length
  const progressPct = myTasks.length > 0 ? Math.round((doneCount / myTasks.length) * 100) : 0
  const hasDocuments = detail.documents.length > 0
  const isBrandNew = !hasDocuments && doneCount === 0
  const isFiled = summary.status === 'filed'
  const isBlocked = summary.status === 'blocked'
  const firstName = currentUser?.name.split(' ')[0]

  if (isFiled) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center py-16">
        <PartyPopper className="w-10 h-10 text-brand-500 mx-auto mb-3" />
        <h1 className="text-xl font-semibold text-slate-900 mb-1">
          Your {summary.tax_year} return has been filed!
        </h1>
        <p className="text-slate-500">Nothing left to do. We'll reach out if anything changes.</p>
      </div>
    )
  }

  const uploadDialog = uploadTask && (
    <UploadDialog
      label={uploadTask.title.replace(/^Upload\s+(your\s+)?/i, '')}
      onSuccess={handleUploadSuccess}
      onClose={() => setUploadTask(null)}
    />
  )

  // ---- Brand new: full onboarding checklist, hero-style ----
  if (isBrandNew) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Welcome, {firstName}.</h1>
        <p className="text-slate-500 mb-6">
          Let's get your {summary.tax_year} {summary.form_type} started. Here's what we need from you first.
        </p>

        {openTasks.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-slate-700">Your next steps</span>
              <span className="text-xs text-slate-400">
                {doneCount} of {myTasks.length} complete
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        <div className="space-y-2 mt-4">
          {openTasks.map((t, i) => (
            <TaskCard
              key={t.id}
              task={t}
              highlight={i === 0}
              subtitle={i === 0 ? 'Start here' : undefined}
              onUploadClick={() => setUploadTask(t)}
            />
          ))}
        </div>

        {doneTasks.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Completed</div>
            <div className="space-y-2">
              {doneTasks.map((t) => (
                <TaskCard key={t.id} task={t} highlight={false} onUploadClick={() => setUploadTask(t)} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 text-sm">
          <button
            onClick={() => setShowWhy((v) => !v)}
            className="flex items-center gap-1 text-brand-700 hover:text-brand-800 font-medium"
          >
            Why we need this
            {showWhy ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {showWhy && (
            <div className="mt-3 flex items-start gap-2.5 bg-brand-50 border border-brand-200 text-brand-900 rounded-lg px-4 py-3">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-brand-600" />
              <p>
                Everything here helps us prepare an accurate return and stay compliant with IRS requirements.
                Your documents are encrypted and visible only to your assigned preparer and firm staff — never
                shared without your consent. And you don't need to do all three at once — we'll follow up if
                anything's still open.
              </p>
            </div>
          )}
        </div>

        {uploadDialog}
      </div>
    )
  }

  // ---- Past onboarding: status + one next action + recent activity, not a checklist ----
  const nextTask = openTasks[0] ?? null
  const recentMessages = [...messages]
    .filter((m) => m.visibility === 'client')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3)

  return (
    <div className="max-w-xl mx-auto">
      <div className="p-8 pb-0">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Welcome back, {firstName}.</h1>
        <p className="text-slate-500 mb-6">Here's where your {summary.tax_year} return stands.</p>
      </div>

      <StatusBar taxReturn={summary} history={detail.history} />

      <div className="p-8 space-y-6">
        {isBlocked && summary.blocking_reason && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <span className="font-medium">Action needed: </span>
              {summary.blocking_reason}
            </span>
          </div>
        )}

        <div>
          <div className="text-sm font-medium text-slate-700 mb-2">Your next action</div>
          {nextTask ? (
            <TaskCard task={nextTask} highlight onUploadClick={() => setUploadTask(nextTask)} />
          ) : (
            <p className="text-slate-500 text-sm">You're all caught up — we'll let you know when we need anything else.</p>
          )}
        </div>

        {doneTasks.length > 0 && (
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Completed</div>
            <div className="space-y-1.5">
              {doneTasks.map((t) => (
                <TaskCard key={t.id} task={t} highlight={false} onUploadClick={() => setUploadTask(t)} />
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="text-sm font-medium text-slate-700 mb-2">Recent activity</div>
          {recentMessages.length === 0 ? (
            <p className="text-slate-400 text-sm">Nothing new yet.</p>
          ) : (
            <div className="space-y-1.5">
              {recentMessages.map((m) => (
                <Card key={m.id} className="flex items-start gap-2.5 px-3 py-2.5 text-sm">
                  <MessageSquare className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-medium text-slate-800">{m.author.name}: </span>
                    <span className="text-slate-600">{m.body}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Link
          to={`/returns/${summary.id}`}
          className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-800 hover:underline font-medium text-sm"
        >
          View full return details
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {uploadDialog}
    </div>
  )
}
