import { Routes, Route } from 'react-router-dom'
import { UserProvider, useUser } from './context/UserContext'
import { AppShell } from './components/AppShell'
import { Home } from './pages/Home'
import { ReturnDetail } from './pages/ReturnDetail'
import { Dashboard } from './pages/Dashboard'
import { Welcome } from './pages/Welcome'

function AppGate() {
  const { currentUser, loading } = useUser()

  if (loading) return <div className="p-6 text-slate-500">Loading…</div>
  if (!currentUser) return <Welcome />

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/returns/:id" element={<ReturnDetail />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </AppShell>
  )
}

function App() {
  return (
    <UserProvider>
      <AppGate />
    </UserProvider>
  )
}

export default App
