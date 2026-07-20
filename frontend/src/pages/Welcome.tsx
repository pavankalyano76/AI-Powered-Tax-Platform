import { Sprout, ChevronRight } from 'lucide-react'
import { useUser } from '../context/UserContext'
import { Avatar } from '../components/ui/Avatar'
import { ROLE_LABELS, CLIENT_ROLES } from '../components/RoleSwitcher'
import type { UserInfo } from '../api/client'

function AccountRow({ user, onPick }: { user: UserInfo; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-slate-50 transition-colors group"
    >
      <Avatar name={user.name} size="md" />
      <span className="flex-1 min-w-0">
        <span className="block font-medium text-slate-900 truncate">{user.name}</span>
        <span className="block text-xs text-slate-500">{ROLE_LABELS[user.role] ?? user.role}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 shrink-0" />
    </button>
  )
}

export function Welcome() {
  const { users, setCurrentUserId } = useUser()

  const clients = users.filter((u) => CLIENT_ROLES.includes(u.role))
  const staff = users.filter((u) => !CLIENT_ROLES.includes(u.role))

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/60 to-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-md flex items-center justify-center mb-3">
            <Sprout className="w-7 h-7 text-white" />
          </div>
          <div className="font-bold text-2xl tracking-tight">
            <span className="text-brand-700">Green</span>
            <span className="text-slate-900">Growth</span>
          </div>
          <div className="text-xs font-semibold text-brand-700/70 uppercase tracking-wide mt-0.5">
            Tax Platform
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-lg font-semibold text-slate-900">Choose an account</h1>
          <p className="text-sm text-slate-500 mt-1">Select your profile to continue.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="py-2">
            <div className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Clients
            </div>
            {clients.map((u) => (
              <AccountRow key={u.id} user={u} onPick={() => setCurrentUserId(u.id)} />
            ))}

            <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Firm Team
            </div>
            {staff.map((u) => (
              <AccountRow key={u.id} user={u} onPick={() => setCurrentUserId(u.id)} />
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Don't see your account? Contact your firm administrator.
        </p>
      </div>
    </div>
  )
}
