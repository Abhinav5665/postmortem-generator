import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../lib/api'

export default function Login() {
  const navigate = useNavigate()

  
  const [isRegister, setIsRegister] = useState(false)
  const [canRegister, setCanRegister] = useState(false)  // ← add this
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
   

  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
  })

   // If already logged in redirect to dashboard
  useEffect(() => {
  authApi.me()
    .then(() => navigate('/dashboard'))
    .catch(() => {
      // Not logged in — check if setup needed
      authApi.checkSetup()
        .then(res => setCanRegister(res.data.needsSetup))
        .catch(() => setCanRegister(false))
    })
}, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit() {
    setError(null)
    setIsLoading(true)

    try {
      if (isRegister) {
        if (!form.name) {
          setError('Name is required')
          setIsLoading(false)
          return
        }
        await authApi.register({
          email: form.email,
          password: form.password,
          name: form.name,
        })
      } else {
        await authApi.login({
          email: form.email,
          password: form.password,
        })
      }
      navigate('/dashboard')
    } catch (err: any) {
      const message = err.response?.data?.error || 'Something went wrong'
      // If registration is closed show a helpful message
      if (message.includes('Registration is closed')) {
        setError('Admin already exists. Ask your admin to send you an invitation.')
        setIsRegister(false)
      } else {
        setError(message)
      }
    } finally {
      setIsLoading(false)
    }
  }

 return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 w-full max-w-sm shadow-sm">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-md shadow-teal-100">
            <span className="text-white text-xs font-bold">PM</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">PostmortemAI</p>
            <p className="text-xs text-slate-400">From outages to insights</p>
          </div>
        </div>

        <h1 className="text-lg font-bold text-slate-900 tracking-tight mb-1">
          {isRegister ? "Create admin account" : "Sign in"}
        </h1>
        <p className="text-xs text-slate-500 mb-6">
          {isRegister
            ? "First account becomes the admin"
            : "Enter your credentials to continue"}
        </p>

        <div className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Abhinav"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-50 focus:border-teal-300 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@company.com"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-50 focus:border-teal-300 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-50 focus:border-teal-300 transition-all"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs font-medium text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 disabled:from-teal-300 disabled:to-cyan-300 text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-md shadow-teal-100 active:scale-95"
          >
            {isLoading
              ? "Please wait..."
              : isRegister
              ? "Create Account"
              : "Sign In"}
          </button>
        </div>

        {canRegister && (
  <div className="mt-6 text-center">
    <button
      onClick={() => {
        setIsRegister(prev => !prev)
        setError(null)
      }}
      className="text-xs font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-full transition-colors"
    >
      {isRegister
        ? "Already have an account? Sign in"
        : "First time? Create admin account"}
    </button>
  </div>
)}
      </div>
    </div>
  )
}