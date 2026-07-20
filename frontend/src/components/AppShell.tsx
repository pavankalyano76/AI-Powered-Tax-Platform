import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, Sprout } from 'lucide-react'
import { useUser } from '../context/UserContext'
import { RoleSwitcher } from './RoleSwitcher'

const STAFF_ROLES = ['preparer', 'reviewer', 'admin', 'seasonal_staff']

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/', label: 'Returns', icon: FileText },
]

function Logo() {
  return (
    <div className="leading-tight">
      <div className="font-bold text-lg tracking-tight">
        <span className="text-brand-700">Green</span>
        <span className="text-slate-900">Growth</span>
      </div>
      <div className="text-[11px] font-semibold text-brand-700/70 uppercase tracking-wide">Tax Platform</div>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { currentUser, loading, clearCurrentUser } = useUser()
  const location = useLocation()

  if (loading || !currentUser) {
    return <div className="p-6 text-slate-500">Loading…</div>
  }

  const isStaff = STAFF_ROLES.includes(currentUser.role)

  if (!isStaff) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-3 flex items-center justify-between">
          <button onClick={clearCurrentUser} className="flex items-center gap-3" title="Switch account">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm flex items-center justify-center shrink-0">
              <Sprout className="w-5.5 h-5.5 text-white" />
            </div>
            <Logo />
          </button>
          <RoleSwitcher />
        </header>
        <main className="flex-1">{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <button
          onClick={clearCurrentUser}
          title="Switch account"
          className="px-5 py-6 flex items-center gap-3 border-b border-slate-100 hover:bg-slate-50 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm flex items-center justify-center shrink-0">
            <Sprout className="w-5.5 h-5.5 text-white" />
          </div>
          <Logo />
        </button>

        <nav className="flex-1 px-3 pt-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.to
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-slate-200 bg-white px-8 py-3 flex items-center justify-end">
          <RoleSwitcher />
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  )
}
