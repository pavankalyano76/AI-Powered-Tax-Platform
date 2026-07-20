import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getUsers, type UserInfo } from '../api/client'

type UserContextValue = {
  users: UserInfo[]
  currentUser: UserInfo | null
  setCurrentUserId: (id: number) => void
  clearCurrentUser: () => void
  loading: boolean
}

const UserContext = createContext<UserContextValue | undefined>(undefined)

const STORAGE_KEY = 'tax-platform-current-user-id'

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<UserInfo[]>([])
  const [currentUserId, setCurrentUserIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? Number(stored) : null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUsers()
      .then((fetched) => setUsers(fetched))
      .finally(() => setLoading(false))
  }, [])

  function setCurrentUserId(id: number) {
    setCurrentUserIdState(id)
    localStorage.setItem(STORAGE_KEY, String(id))
  }

  function clearCurrentUser() {
    setCurrentUserIdState(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  const currentUser = users.find((u) => u.id === currentUserId) ?? null

  return (
    <UserContext.Provider value={{ users, currentUser, setCurrentUserId, clearCurrentUser, loading }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within a UserProvider')
  return ctx
}
