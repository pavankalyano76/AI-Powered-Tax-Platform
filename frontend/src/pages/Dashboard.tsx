import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Clock3,
  CircleDot,
  Inbox,
  Search,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Flame,
  CalendarClock,
  Lock,
  ArrowUpDown,
  CheckCircle2,
  MessageSquare,
  UserCog,
  AlarmClock,
} from 'lucide-react'
import { getDashboard, getUsers, updateTask, type DashboardTask, type UserInfo } from '../api/client'
import { useUser } from '../context/UserContext'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'

const STAFF_ROLES = ['preparer', 'reviewer', 'admin', 'seasonal_staff']

function daysUntil(dueDate: string | null): number | null {
  if (!dueDate) return null
  const due = new Date(dueDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

function dueDateLabel(dueDate: string | null): string {
  const diffDays = daysUntil(dueDate)
  if (diffDays == null) return 'No due date'
  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)}d`
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  return `Due in ${diffDays}d`
}

function isOverdue(task: DashboardTask) {
  return dueDateLabel(task.due_date).startsWith('Overdue')
}

function isBlocked(task: DashboardTask) {
  return task.status === 'blocked'
}

// Mirrors the actual backend scoring factors (priority weight, due-date
// proximity buckets, blocked bonus) in plain language — so the rank is
// legible, not just asserted. Same transparency idea as the AI confidence
// "why" panel, applied to prioritization instead.
function explainReason(task: DashboardTask): string {
  const reasons: string[] = []

  if (task.priority === 'urgent') reasons.push('Urgent priority')
  else if (task.priority === 'high') reasons.push('High priority')

  const diffDays = daysUntil(task.due_date)
  if (diffDays != null) {
    if (diffDays < 0) reasons.push(`overdue by ${Math.abs(diffDays)}d`)
    else if (diffDays <= 2) reasons.push('due very soon')
    else if (diffDays <= 7) reasons.push('due this week')
  }

  if (isBlocked(task)) reasons.push('blocked')

  return reasons.length > 0 ? reasons.join(' · ') : 'Routine priority, no immediate deadline'
}

function urgencyTier(score: number): { label: string; tone: 'danger' | 'warning' | 'neutral'; icon: typeof AlertCircle } {
  if (score >= 120) return { label: 'Urgent', tone: 'danger', icon: AlertCircle }
  if (score >= 70) return { label: 'High', tone: 'warning', icon: Clock3 }
  return { label: 'Normal', tone: 'neutral', icon: CircleDot }
}

function isUrgent(task: DashboardTask) {
  return urgencyTier(task.score).label === 'Urgent'
}

type QuickFilter = 'all' | 'urgent' | 'overdue' | 'blocked'
type SortKey = 'priority' | 'due_date' | 'client'

// The colored left edge — Dashboard is a ranked queue, not a browsable
// catalog like the Returns list, so its rows lean into that with an
// urgency accent + rank number instead of looking like another list of cards.
const TIER_ACCENT: Record<string, string> = {
  danger: 'border-l-4 border-l-red-500',
  warning: 'border-l-4 border-l-amber-400',
  neutral: 'border-l-4 border-l-slate-200',
}

type ActionHandlers = {
  staffOptions: UserInfo[]
  onComplete: (task: DashboardTask) => void
  onSnooze: (task: DashboardTask) => void
  onReassign: (task: DashboardTask, ownerId: number) => void
}

// Shared by the regular rows and the hero card so Complete/Message/
// Reassign/Snooze only exist in one place.
function ActionButtons({ task, staffOptions, onComplete, onSnooze, onReassign }: { task: DashboardTask } & ActionHandlers) {
  const navigate = useNavigate()
  const [reassigning, setReassigning] = useState(false)
  const messagesDestination = `/returns/${task.return_id}?tab=messages&from=dashboard`

  if (reassigning) {
    return (
      <select
        autoFocus
        defaultValue=""
        onChange={(e) => {
          const id = Number(e.target.value)
          if (id) onReassign(task, id)
          setReassigning(false)
        }}
        onBlur={() => setReassigning(false)}
        className="text-xs border border-slate-200 rounded-lg px-1.5 py-1.5 bg-white max-w-[110px]"
      >
        <option value="" disabled>
          Reassign to…
        </option>
        {staffOptions.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button
        title="Complete"
        onClick={() => onComplete(task)}
        className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
      >
        <CheckCircle2 className="w-4 h-4" />
      </button>
      <button
        title="Message client"
        onClick={() => navigate(messagesDestination)}
        className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
      >
        <MessageSquare className="w-4 h-4" />
      </button>
      <button
        title="Reassign"
        onClick={() => setReassigning(true)}
        className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
      >
        <UserCog className="w-4 h-4" />
      </button>
      <button
        title="Snooze 2 days"
        onClick={() => onSnooze(task)}
        className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
      >
        <AlarmClock className="w-4 h-4" />
      </button>
    </div>
  )
}

function TaskRow({ task, rank, showOwner, ...actions }: { task: DashboardTask; rank: number; showOwner?: boolean } & ActionHandlers) {
  const navigate = useNavigate()
  const tier = urgencyTier(task.score)
  const label = dueDateLabel(task.due_date)
  const overdue = label.startsWith('Overdue')
  const Icon = tier.icon
  const blocked = isBlocked(task)

  const destination = task.related_field_id
    ? `/returns/${task.return_id}?tab=fields&field=${task.related_field_id}&from=dashboard`
    : `/returns/${task.return_id}?from=dashboard`

  return (
    <div className="w-full flex items-center gap-3">
      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[11px] font-semibold flex items-center justify-center shrink-0">
        {rank}
      </span>

      <Card
        onClick={() => navigate(destination)}
        className={`flex-1 px-4 py-2.5 flex items-center justify-between gap-4 hover:shadow-md transition-all cursor-pointer ${
          blocked ? 'border-l-4 border-l-purple-400' : TIER_ACCENT[tier.tone]
        }`}
      >
        <div className="min-w-0">
          <div className="font-medium text-slate-900 truncate">{task.title}</div>
          <div className="text-sm text-slate-500 truncate">
            {task.client_name}
            {task.return_status && ` · ${task.return_status}`}
            {showOwner && task.owner_name && ` · ${task.owner_name}`}
          </div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">{explainReason(task)}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {blocked && (
            <Badge tone="purple">
              <Lock className="w-3 h-3" />
              Blocked
            </Badge>
          )}
          <Badge tone={tier.tone}>
            <Icon className="w-3 h-3" />
            {tier.label}
          </Badge>
          <span className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}>{label}</span>
        </div>
      </Card>

      <ActionButtons task={task} {...actions} />
    </div>
  )
}

// A visually heavier treatment of the single most urgent task — so the page
// has one clear "this is THE thing" instead of every row reading as equally
// important. Individual view only, and only under the default priority
// sort — under a different sort "first on the page" isn't really "most
// urgent," so the hero label would be dishonest.
function HeroTask({ task, ...actions }: { task: DashboardTask } & ActionHandlers) {
  const navigate = useNavigate()
  const tier = urgencyTier(task.score)
  const label = dueDateLabel(task.due_date)
  const overdue = label.startsWith('Overdue')
  const blocked = isBlocked(task)
  const destination = task.related_field_id
    ? `/returns/${task.return_id}?tab=fields&field=${task.related_field_id}&from=dashboard`
    : `/returns/${task.return_id}?from=dashboard`

  return (
    <div className="mb-5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        <Flame className="w-3.5 h-3.5 text-red-500" />
        Top Priority
      </div>
      <Card
        onClick={() => navigate(destination)}
        className={`p-5 cursor-pointer hover:shadow-lg transition-all ${
          blocked ? 'border-l-4 border-l-purple-400' : TIER_ACCENT[tier.tone]
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-slate-900">{task.title}</div>
            <div className="text-sm text-slate-500 mt-0.5">
              {task.client_name}
              {task.return_status && ` · ${task.return_status}`}
            </div>
            <div className="text-sm text-slate-600 mt-1.5">{explainReason(task)}</div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`text-xs ${overdue ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>{label}</span>
            <div onClick={(e) => e.stopPropagation()}>
              <ActionButtons task={task} {...actions} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Inbox className="w-8 h-8 text-slate-300 mb-3" />
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  )
}

// Fills the space that used to just be empty margin with something useful:
// a compact at-a-glance breakdown, without needing to scroll and expand
// every group in the main list to see who's overloaded.
function WorkloadPanel({
  tasks,
  title,
  groupKey,
}: {
  tasks: DashboardTask[]
  title: string
  groupKey: (t: DashboardTask) => string
}) {
  const rows = useMemo(() => {
    const map = new Map<string, { total: number; urgent: number }>()
    for (const t of tasks) {
      const key = groupKey(t)
      const row = map.get(key) ?? { total: 0, urgent: 0 }
      row.total += 1
      if (isUrgent(t)) row.urgent += 1
      map.set(key, row)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].urgent - a[1].urgent || b[1].total - a[1].total)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks])

  if (rows.length === 0) return null

  return (
    <Card className="p-4">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{title}</div>
      <div className="space-y-2.5">
        {rows.map(([name, stats]) => (
          <div key={name} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-slate-700 truncate min-w-0">{name}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {stats.urgent > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                  {stats.urgent} urgent
                </span>
              )}
              <span className="text-xs text-slate-400 tabular-nums">{stats.total}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// Alerts, not neutral counts — filled color instead of the plain white
// cards the Returns list uses, so the two screens read as different kinds
// of surfaces, not the same component reused. Three distinct hues (red,
// amber, purple) so Urgent/Overdue/Blocked stay visually separable.
const STAT_CARDS: {
  key: QuickFilter
  label: string
  icon: typeof ListChecks
  wrapper: string
  iconTone: string
  numberTone: string
}[] = [
  { key: 'all', label: 'Open Tasks', icon: ListChecks, wrapper: 'bg-white border-slate-200', iconTone: 'text-slate-400', numberTone: 'text-slate-900' },
  { key: 'urgent', label: 'Urgent', icon: Flame, wrapper: 'bg-red-50 border-red-200', iconTone: 'text-red-500', numberTone: 'text-red-700' },
  { key: 'overdue', label: 'Overdue', icon: CalendarClock, wrapper: 'bg-amber-50 border-amber-200', iconTone: 'text-amber-500', numberTone: 'text-amber-700' },
  { key: 'blocked', label: 'Blocked', icon: Lock, wrapper: 'bg-purple-50 border-purple-200', iconTone: 'text-purple-500', numberTone: 'text-purple-700' },
]

export function Dashboard() {
  const { currentUser } = useUser()
  const [tasks, setTasks] = useState<DashboardTask[]>([])
  const [staff, setStaff] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('priority')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  async function refresh() {
    if (!currentUser) return
    const fresh = await getDashboard(currentUser.id)
    setTasks(fresh)
  }

  useEffect(() => {
    if (!currentUser) return
    setLoading(true)
    Promise.all([getDashboard(currentUser.id), getUsers()])
      .then(([dashboardTasks, users]) => {
        setTasks(dashboardTasks)
        setStaff(users.filter((u) => STAFF_ROLES.includes(u.role)))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [currentUser])

  // All three actions re-fetch rather than hand-patch local state — a
  // snooze or reassign changes the task's real score/grouping server-side,
  // and refetching keeps the ranked order honest instead of guessing at it.
  async function handleComplete(task: DashboardTask) {
    await updateTask(task.id, { status: 'done' })
    await refresh()
  }

  async function handleSnooze(task: DashboardTask) {
    const newDue = new Date()
    newDue.setDate(newDue.getDate() + 2)
    await updateTask(task.id, { due_date: newDue.toISOString().slice(0, 10) })
    await refresh()
  }

  async function handleReassign(task: DashboardTask, ownerId: number) {
    await updateTask(task.id, { owner_user_id: ownerId })
    await refresh()
  }

  const actionHandlers: ActionHandlers = {
    staffOptions: staff,
    onComplete: handleComplete,
    onSnooze: handleSnooze,
    onReassign: handleReassign,
  }

  const counts = useMemo(
    () => ({
      all: tasks.length,
      urgent: tasks.filter(isUrgent).length,
      overdue: tasks.filter(isOverdue).length,
      blocked: tasks.filter(isBlocked).length,
    }),
    [tasks],
  )

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (quickFilter === 'urgent' && !isUrgent(t)) return false
      if (quickFilter === 'overdue' && !isOverdue(t)) return false
      if (quickFilter === 'blocked' && !isBlocked(t)) return false
      if (search) {
        const q = search.toLowerCase()
        const haystack = `${t.title} ${t.client_name ?? ''} ${t.owner_name ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [tasks, search, quickFilter])

  // Rank always reflects true priority order (the backend's score), regardless
  // of how the list is currently sorted for display — re-sorting by client
  // name shouldn't make the rank numbers stop meaning "how urgent is this."
  const rankById = useMemo(() => {
    const map = new Map<number, number>()
    filtered.forEach((t, i) => map.set(t.id, i + 1))
    return map
  }, [filtered])

  // Display order, separate from rank — sortBy only changes what order rows
  // render in, not the priority rank shown on each one.
  const sorted = useMemo(() => {
    if (sortBy === 'priority') return filtered
    const arr = [...filtered]
    if (sortBy === 'due_date') {
      arr.sort((a, b) => {
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })
    } else if (sortBy === 'client') {
      arr.sort((a, b) => (a.client_name ?? '').localeCompare(b.client_name ?? ''))
    }
    return arr
  }, [filtered, sortBy])

  if (loading) return <p className="p-6 text-slate-500">Loading dashboard…</p>
  if (error) return <p className="p-6 text-red-600">Error: {error}</p>

  const isAdmin = currentUser?.role === 'admin'
  const showHero = !isAdmin && sortBy === 'priority' && sorted.length > 0
  const heroTask = showHero ? sorted[0] : null
  const restTasks = showHero ? sorted.slice(1) : sorted

  const toolbar = tasks.length > 0 && (
    <>
      <div className="grid grid-cols-4 gap-3 mb-3">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon
          const isActive = quickFilter === card.key
          return (
            <button key={card.key} onClick={() => setQuickFilter(card.key)} className="text-left">
              <div
                className={`p-3 rounded-xl border shadow-sm transition-shadow hover:shadow-md ${card.wrapper} ${
                  isActive ? 'ring-2 ring-brand-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xl font-semibold ${card.numberTone}`}>{counts[card.key]}</span>
                  <Icon className={`w-4 h-4 ${card.iconTone}`} />
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{card.label}</div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={isAdmin ? 'Search by task, client, or staff member…' : 'Search by task or client…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm bg-white"
          />
        </div>
        <div className="relative">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="text-sm border border-slate-200 rounded-lg pl-7 pr-3 py-2 bg-white text-slate-700"
          >
            <option value="priority">Priority</option>
            <option value="due_date">Due Date</option>
            <option value="client">Client Name</option>
          </select>
        </div>
      </div>
    </>
  )

  const workloadPanel = tasks.length > 0 && (
    <aside className="w-64 shrink-0 sticky top-6">
      <WorkloadPanel
        tasks={tasks}
        title={isAdmin ? 'Workload by Preparer' : 'Open Tasks by Client'}
        groupKey={isAdmin ? (t) => t.owner_name ?? 'Unassigned' : (t) => t.client_name ?? 'Unknown'}
      />
    </aside>
  )

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">What needs your attention right now</p>
        </div>
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            {toolbar}
            {tasks.length === 0 ? (
              <EmptyState message="Nothing open right now." />
            ) : sorted.length === 0 ? (
              <EmptyState message="No tasks match your search or filter." />
            ) : (
              <>
                {heroTask && <HeroTask task={heroTask} {...actionHandlers} />}
                <div className="space-y-2">
                  {restTasks.map((t) => (
                    <TaskRow key={t.id} task={t} rank={rankById.get(t.id)!} {...actionHandlers} />
                  ))}
                </div>
              </>
            )}
          </div>
          {workloadPanel}
        </div>
      </div>
    )
  }

  // Manager view — group the firm-wide task list by whoever owns each one
  const grouped = new Map<string, DashboardTask[]>()
  for (const t of sorted) {
    const key = t.owner_name ?? 'Unassigned'
    const list = grouped.get(key) ?? []
    list.push(t)
    grouped.set(key, list)
  }
  // Owner group order responds to sortBy too, not just the tasks within each
  // group — otherwise a group with only one task never visibly moves, and
  // sorting looks broken even though it's working within larger groups.
  const owners = Array.from(grouped.keys()).sort((a, b) => {
    const topA = grouped.get(a)![0]
    const topB = grouped.get(b)![0]
    if (sortBy === 'due_date') {
      if (!topA.due_date) return 1
      if (!topB.due_date) return -1
      return topA.due_date.localeCompare(topB.due_date)
    }
    if (sortBy === 'client') {
      return (topA.client_name ?? '').localeCompare(topB.client_name ?? '')
    }
    return a.localeCompare(b)
  })

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Firm-wide view — all open tasks, grouped by owner</p>
      </div>
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          {toolbar}
          {tasks.length === 0 ? (
            <EmptyState message="Nothing open right now." />
          ) : owners.length === 0 ? (
            <EmptyState message="No tasks match your search or filter." />
          ) : (
            <div className="space-y-3">
              {owners.map((owner) => {
                const ownerTasks = grouped.get(owner)!
                const isCollapsed = collapsed[owner] ?? false
                const urgentCount = ownerTasks.filter(isUrgent).length
                const overdueCount = ownerTasks.filter(isOverdue).length
                const blockedCount = ownerTasks.filter(isBlocked).length
                return (
                  <div key={owner} className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                    <button
                      onClick={() => setCollapsed((c) => ({ ...c, [owner]: !isCollapsed }))}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-900 bg-slate-50 hover:bg-slate-100"
                    >
                      <span className="flex items-center gap-2">
                        {owner} <span className="text-slate-400 font-normal">({ownerTasks.length})</span>
                        {urgentCount > 0 && (
                          <Badge tone="danger">
                            <Flame className="w-3 h-3" />
                            {urgentCount}
                          </Badge>
                        )}
                        {overdueCount > 0 && (
                          <Badge tone="warning">
                            <CalendarClock className="w-3 h-3" />
                            {overdueCount}
                          </Badge>
                        )}
                        {blockedCount > 0 && (
                          <Badge tone="purple">
                            <Lock className="w-3 h-3" />
                            {blockedCount}
                          </Badge>
                        )}
                      </span>
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    {!isCollapsed && (
                      <div className="p-3 space-y-2">
                        {ownerTasks.map((t) => (
                          <TaskRow key={t.id} task={t} rank={rankById.get(t.id)!} {...actionHandlers} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {workloadPanel}
      </div>
    </div>
  )
}
