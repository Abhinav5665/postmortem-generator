import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import NewIncident from './pages/NewIncident'
import Postmortem from './pages/Postmortem'
import Login from './pages/Login'
import AcceptInvite from './pages/AcceptInvite'
import Team from './pages/Team'
import { authApi } from './lib/api'
import type { User } from './lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function Sidebar({ user }: { user: User }) {
  const location = useLocation()
  const navigate = useNavigate()

  async function handleLogout() {
    await authApi.logout()
    queryClient.clear()
    navigate('/login')
  }

  const links = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/incidents/new', label: 'New Incident' },
    ...(user.role === 'ADMIN' ? [{ path: '/team', label: 'Team' }] : []),
  ]

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">PM</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">PostmortemAI</p>
            <p className="text-xs text-gray-400">From outages to insights</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(link => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              location.pathname === link.path
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {link.label}
          </button>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-4 py-4 border-t border-gray-200">
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-900 truncate">{user.name}</p>
          <p className="text-xs text-gray-400 truncate">{user.email}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${
            user.role === 'ADMIN'
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {user.role}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-left text-xs text-gray-500 hover:text-red-500 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}

function ProtectedLayout() {
  const navigate = useNavigate()

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me().then(res => res.data.data),
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  if (isError || !user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/incidents/new" element={<NewIncident />} />
          <Route path="/incidents/:id" element={<Postmortem />} />
          {user.role === 'ADMIN' && (
            <Route path="/team" element={<Team />} />
          )}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/invite/accept" element={<AcceptInvite />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}