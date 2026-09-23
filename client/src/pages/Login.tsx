import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../lib/api'

export default function Login() {
  const navigate = useNavigate()
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
  })

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
      setError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white border border-gray-200 rounded-xl p-8 w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">PM</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">PostmortemAI</p>
            <p className="text-xs text-gray-400">From outages to insights</p>
          </div>
        </div>

        <h1 className="text-lg font-bold text-gray-900 mb-1">
          {isRegister ? 'Create admin account' : 'Sign in'}
        </h1>
        <p className="text-xs text-gray-500 mb-6">
          {isRegister
            ? 'First account becomes the admin'
            : 'Enter your credentials to continue'}
        </p>

        <div className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Abhinav"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@company.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {isLoading
              ? 'Please wait...'
              : isRegister
              ? 'Create Account'
              : 'Sign In'}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsRegister(prev => !prev)
              setError(null)
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            {isRegister
              ? 'Already have an account? Sign in'
              : 'First time? Create admin account'}
          </button>
        </div>
      </div>
    </div>
  )
}