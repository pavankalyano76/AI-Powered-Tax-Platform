import { useUser } from '../context/UserContext'
import { ReturnsList } from './ReturnsList'
import { ClientHome } from './ClientHome'

const CLIENT_ROLES = ['client', 'business_owner']

export function Home() {
  const { currentUser, loading } = useUser()

  if (loading || !currentUser) return <p className="p-6 text-gray-500">Loading…</p>

  return CLIENT_ROLES.includes(currentUser.role) ? <ClientHome /> : <ReturnsList />
}
