import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, History } from 'lucide-react'
import { useUser } from '../../context/UserContext'
import type { ReturnSummary, StatusEvent } from '../../api/client'

const STAGES = [
  { key: 'gathering_docs', client: 'Gathering Documents', staff: 'Gathering Documents' },
  { key: 'in_preparation', client: 'Preparing Your Return', staff: 'In Preparation' },
  { key: 'in_review', client: 'Under Review', staff: 'In Review' },
  { key: 'client_review', client: 'Your Review Needed', staff: 'Client Review' },
  { key: 'filed', client: 'Filed', staff: 'Filed' },
] as const

// Simple, deterministic mapping of "who owes the next action" per status.
// A real system might derive this from open tasks; for this prototype it's
// tied directly to the stage, which is enough to demonstrate the idea.
const OWNER_BY_STATUS: Record<string, 'client' | 'firm' | 'none'> = {
  gathering_docs: 'client',
  in_preparation: 'firm',
  in_review: 'firm',
  client_review: 'client',
  filed: 'none',
  blocked: 'client',
}

export function StatusBar({ taxReturn, history }: { taxReturn: ReturnSummary; history?: StatusEvent[] }) {
  const { currentUser } = useUser()
  const [showHistory, setShowHistory] = useState(false)
  const isClientView = currentUser?.role === 'client' || currentUser?.role === 'business_owner'
  const isBlocked = taxReturn.status === 'blocked'
  const activeIndex = STAGES.findIndex((s) => s.key === taxReturn.status)
  const owner = OWNER_BY_STATUS[taxReturn.status] ?? 'firm'

  return (
    <div className="border-b border-slate-200 bg-white px-8 py-4">
      <ol className="flex items-center gap-2 mb-3">
        {STAGES.map((stage, i) => {
          const isActive = !isBlocked && i === activeIndex
          const isPast = !isBlocked && i < activeIndex
          return (
            <li key={stage.key} className="flex-1">
              <div
                className={[
                  'h-1.5 rounded-full transition-colors',
                  isBlocked
                    ? 'bg-slate-200'
                    : isActive
                      ? 'bg-brand-600'
                      : isPast
                        ? 'bg-brand-300'
                        : 'bg-slate-200',
                ].join(' ')}
              />
            </li>
          )
        })}
      </ol>

      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="font-medium text-slate-900">
            {isBlocked ? 'Blocked' : isClientView ? STAGES[activeIndex]?.client : STAGES[activeIndex]?.staff}
          </span>
          {!isClientView && taxReturn.preparer && (
            <span className="text-slate-500"> · Assigned to {taxReturn.preparer.name}</span>
          )}
        </div>
        <div className="text-slate-500">
          {owner === 'client' && (isClientView ? 'Waiting on: You' : 'Waiting on: Client')}
          {owner === 'firm' && (isClientView ? 'Waiting on: Your CPA' : 'Waiting on: Firm')}
          {owner === 'none' && 'Complete'}
        </div>
      </div>

      {isBlocked && taxReturn.blocking_reason && (
        <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <span className="font-medium">Blocking issue:</span> {taxReturn.blocking_reason}
          </span>
        </div>
      )}

      {history && history.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            History
            {showHistory ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {showHistory && (
            <ol className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
              {history.map((event) => (
                <li key={event.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-brand-400 ring-4 ring-white" />
                  <span className="text-slate-700">{event.label}</span>
                  <span className="text-slate-400 ml-2 text-xs">
                    {new Date(event.occurred_at + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
