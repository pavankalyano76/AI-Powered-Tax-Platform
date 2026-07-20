import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, AlertTriangle, Ban, CheckCircle2, FileStack } from 'lucide-react'
import { getReturns, getUsers, type ReturnSummary, type UserInfo } from '../api/client'
import { useUser } from '../context/UserContext'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'

type Tone = 'neutral' | 'info' | 'brand' | 'warning' | 'danger' | 'success'

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  gathering_docs: { label: 'Gathering Docs', tone: 'neutral' },
  in_preparation: { label: 'In Preparation', tone: 'info' },
  in_review: { label: 'In Review', tone: 'brand' },
  client_review: { label: 'Client Review', tone: 'warning' },
  blocked: { label: 'Blocked', tone: 'danger' },
  filed: { label: 'Filed', tone: 'success' },
}

const STAFF_ROLES = ['preparer', 'reviewer', 'admin', 'seasonal_staff']

type QuickFilter = 'all' | 'attention' | 'blocked' | 'review'

export function ReturnsList() {
  const { currentUser } = useUser()
  const [returns, setReturns] = useState<ReturnSummary[]>([])
  const [preparers, setPreparers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [preparerFilter, setPreparerFilter] = useState('all')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')

  useEffect(() => {
    if (!currentUser) return
    setLoading(true)
    Promise.all([getReturns(currentUser.id), getUsers()])
      .then(([returnData, users]) => {
        setReturns(returnData)
        setPreparers(users.filter((u) => STAFF_ROLES.includes(u.role)))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [currentUser])

  const counts = useMemo(
    () => ({
      total: returns.length,
      attention: returns.filter((r) => r.needs_attention).length,
      blocked: returns.filter((r) => r.status === 'blocked').length,
      review: returns.filter((r) => r.status === 'in_review').length,
    }),
    [returns],
  )

  const filtered = useMemo(() => {
    return returns.filter((r) => {
      if (search && !r.client.name.toLowerCase().includes(search.toLowerCase())) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (preparerFilter !== 'all' && String(r.preparer?.id) !== preparerFilter) return false
      if (quickFilter === 'attention' && !r.needs_attention) return false
      if (quickFilter === 'blocked' && r.status !== 'blocked') return false
      if (quickFilter === 'review' && r.status !== 'in_review') return false
      return true
    })
  }, [returns, search, statusFilter, preparerFilter, quickFilter])

  if (loading) return <p className="p-6 text-slate-500">Loading returns…</p>
  if (error) return <p className="p-6 text-red-600">Error: {error}</p>

  const STAT_CARDS: { key: QuickFilter; label: string; value: number; icon: typeof FileStack; tone: string }[] = [
    { key: 'all', label: 'Total Returns', value: counts.total, icon: FileStack, tone: 'text-slate-400' },
    { key: 'attention', label: 'Need Attention', value: counts.attention, icon: AlertTriangle, tone: 'text-amber-500' },
    { key: 'blocked', label: 'Blocked', value: counts.blocked, icon: Ban, tone: 'text-red-500' },
    { key: 'review', label: 'Ready for Review', value: counts.review, icon: CheckCircle2, tone: 'text-brand-600' },
  ]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Returns</h1>
        <p className="text-sm text-slate-500 mt-1">Manage, prioritize, and review all client tax returns</p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon
          const isActive = quickFilter === card.key
          return (
            <button key={card.key} onClick={() => setQuickFilter(card.key)} className="text-left">
              <Card className={`p-4 transition-shadow hover:shadow-md ${isActive ? 'ring-2 ring-brand-500' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-semibold text-slate-900">{card.value}</span>
                  <Icon className={`w-5 h-5 ${card.tone}`} />
                </div>
                <div className="text-xs text-slate-500 mt-1">{card.label}</div>
              </Card>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm bg-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700"
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
        {currentUser?.role === 'admin' && (
          <select
            value={preparerFilter}
            onChange={(e) => setPreparerFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700"
          >
            <option value="all">Assigned to: Anyone</option>
            {preparers.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <Button variant="primary" size="sm" onClick={() => alert("Return creation isn't wired up in this prototype.")}>
          <Plus className="w-4 h-4" />
          New return
        </Button>
      </div>

      {filtered.length === 0 && <p className="text-sm text-slate-500 py-8 text-center">No returns match these filters.</p>}

      <div className="space-y-2">
        {filtered.map((r) => {
          const meta = STATUS_META[r.status] ?? { label: r.status, tone: 'neutral' as Tone }
          return (
            <Link key={r.id} to={`/returns/${r.id}`}>
              <Card className="p-4 flex items-center justify-between hover:border-brand-300 transition-colors">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 flex items-center gap-2">
                    {r.client.name}
                    {r.needs_attention && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                  </div>
                  <div className="text-sm text-slate-500">
                    {r.tax_year} {r.form_type}
                    {r.preparer && ` · ${r.preparer.name}`}
                  </div>
                  {r.status === 'blocked' && r.blocking_reason && (
                    <div className="flex items-center gap-1 text-xs text-red-700 mt-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {r.blocking_reason}
                    </div>
                  )}
                </div>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
