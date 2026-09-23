import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { teamApi, invitationsApi } from '../lib/api'

export default function Team() {
  const queryClient = useQueryClient()
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'MEMBER' })
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ['team'],
    queryFn: () => teamApi.list().then(res => res.data.data),
  })

  const { data: invitations, isLoading: loadingInvitations } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => invitationsApi.list().then(res => res.data.data),
  })

  const inviteMutation = useMutation({
    mutationFn: () => invitationsApi.send(inviteForm),
    onSuccess: () => {
      setInviteSuccess(`Invitation sent to ${inviteForm.email}`)
      setInviteForm({ email: '', role: 'MEMBER' })
      setShowInviteForm(false)
      setInviteError(null)
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
      setTimeout(() => setInviteSuccess(null), 3000)
    },
    onError: (err: any) => {
      setInviteError(err.response?.data?.error || 'Failed to send invitation')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => teamApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
    },
  })

  const cancelInviteMutation = useMutation({
    mutationFn: (id: string) => invitationsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      teamApi.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
    },
  })

  const pendingInvitations = invitations?.filter(
    (inv: any) => !inv.acceptedAt && new Date(inv.expiresAt) > new Date()
  )

  return (
    <div className="p-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage team members and invitations
          </p>
        </div>
        <button
          onClick={() => {
            setShowInviteForm(true)
            setInviteError(null)
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Invite Member
        </button>
      </div>

      {/* Success message */}
      {inviteSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
          <p className="text-sm text-green-600">{inviteSuccess}</p>
        </div>
      )}

      {/* Invite Form */}
      {showInviteForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Invite Team Member
          </h2>
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteForm.email}
              onChange={e => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="colleague@company.com"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={inviteForm.role}
              onChange={e => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteForm.email || inviteMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
            </button>
            <button
              onClick={() => setShowInviteForm(false)}
              className="text-sm text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
          {inviteError && (
            <p className="text-xs text-red-500 mt-2">{inviteError}</p>
          )}
        </div>
      )}

      {/* Team Members */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Members ({members?.length || 0})
          </h2>
        </div>
        {loadingMembers ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-400">Loading members...</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Name</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Email</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Role</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members?.map((member: any) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-gray-900">{member.name}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={member.role}
                      onChange={e => updateRoleMutation.mutate({
                        id: member.id,
                        role: e.target.value,
                      })}
                      className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MEMBER">Member</option>
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => removeMutation.mutate(member.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending Invitations */}
      {pendingInvitations && pendingInvitations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              Pending Invitations ({pendingInvitations.length})
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Email</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Role</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Expires</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pendingInvitations.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="text-sm text-gray-900">{inv.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {inv.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-xs text-gray-500">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => cancelInviteMutation.mutate(inv.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}