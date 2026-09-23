import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { invitationsApi } from '../lib/api'

export default function AcceptInvite() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteData, setInviteData] = useState<{
    email: string
    role: string
  } | null>(null)

  const [form, setForm] = useState({
    name: '',
    password: '',
    confirmPassword: '',
  })

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link')
      setIsValidating(false)
      return
    }

    invitationsApi.validate(token)
      .then(res => {
        setInviteData(res.data.data)
        setIsValidating(false)
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Invalid or expired invitation link')
        setIsValidating(false)
      })
  }, [token])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit() {
    setError(null)

    if (!form.name) {
      setError('Name is required')
      return
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      await invitationsApi.accept(token, {
        name: form.name,
        password: form.password,
      })
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to accept invitation')
    } finally {
      setIsLoading(false)
    }
  }

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Validating invitation...</p>
      </div>
    )
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-xl p-8 w-full max-w-sm text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-1">Invalid Invitation</p>
          <p className="text-xs text-gray-500">{error}</p>
        </div>
      </div>
    )
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
          Accept Invitation
        </h1>
        <p className="text-xs text-gray-500 mb-1">
          You've been invited to join PostmortemAI
        </p>
        <p className="text-xs text-indigo-600 font-medium mb-6">
          {inviteData?.email}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="John Smith"
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

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
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
            {isLoading ? 'Joining...' : 'Join Team'}
          </button>
        </div>
      </div>
    </div>
  )
}