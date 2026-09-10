import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import NewIncident from './pages/NewIncident'
import Postmortem from './pages/Postmortem'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  const links = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/incidents/new', label: 'New Incident' },
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
    </aside>
  )
}

function Layout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/incidents/new" element={<NewIncident />} />
          <Route path="/incidents/:id" element={<Postmortem />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </QueryClientProvider>
  )
}