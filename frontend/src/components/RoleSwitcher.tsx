import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Check, FlaskConical } from 'lucide-react'
import { useUser } from '../context/UserContext'
import { Avatar } from './ui/Avatar'
import type { UserInfo } from '../api/client'

export const ROLE_LABELS: Record<string, string> = {
  client: 'Client',
  business_owner: 'Business Owner',
  preparer: 'Preparer',
  reviewer: 'Reviewer',
  admin: 'Admin',
  seasonal_staff: 'Seasonal Staff',
}
export const CLIENT_ROLES = ['client', 'business_owner']

function UserRow({ user, isCurrent, onPick }: { user: UserInfo; isCurrent: boolean; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-slate-50 ${
        isCurrent ? 'bg-brand-50' : ''
      }`}
    >
      <Avatar name={user.name} size="sm" />
      <span className="flex-1 text-left min-w-0">
        <span className="block font-medium text-slate-800 truncate">{user.name}</span>
        <span className="block text-xs text-slate-400">{ROLE_LABELS[user.role] ?? user.role}</span>
      </span>
      {isCurrent && <Check className="w-4 h-4 text-brand-600 shrink-0" />}
    </button>
  )
}

export function RoleSwitcher() {
  const { users, currentUser, setCurrentUserId } = useUser()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!currentUser) return null

  const clients = users.filter((u) => CLIENT_ROLES.includes(u.role))
  const staff = users.filter((u) => !CLIENT_ROLES.includes(u.role))

  function pick(id: number) {
    setCurrentUserId(id)
    setOpen(false)
    navigate('/')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all"
      >
        <Avatar name={currentUser.name} size="sm" />
        <span className="text-sm font-medium text-slate-800">{currentUser.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-20">
          <div className="px-3 py-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400 bg-slate-50 border-b border-slate-100">
            <FlaskConical className="w-3 h-3" />
            Demo — switch role
          </div>

          <div className="py-1 max-h-80 overflow-y-auto">
            <div className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Clients
            </div>
            {clients.map((u) => (
              <UserRow key={u.id} user={u} isCurrent={u.id === currentUser.id} onPick={() => pick(u.id)} />
            ))}

            <div className="px-3 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Firm Staff
            </div>
            {staff.map((u) => (
              <UserRow key={u.id} user={u} isCurrent={u.id === currentUser.id} onPick={() => pick(u.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
