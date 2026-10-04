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
    <div className="p-8 max-w-4xl mx-auto w-full bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Team</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage team members and invitations
          </p>
        </div>
        <button
          onClick={() => {
            setShowInviteForm(true)
            setInviteError(null)
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-teal-100 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Invite Member
        </button>
      </div>

      {/* Success message */}
      {inviteSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-6">
          <p className="text-sm font-medium text-emerald-700">{inviteSuccess}</p>
        </div>
      )}

      {/* Invite Form */}
      {showInviteForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Invite Team Member
          </h2>
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteForm.email}
              onChange={e => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="colleague@company.com"
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-50 focus:border-teal-300 transition-all"
            />
            <select
              value={inviteForm.role}
              onChange={e => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-teal-50 focus:border-teal-300 cursor-pointer"
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteForm.email || inviteMutation.isPending}
              className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 disabled:from-teal-300 disabled:to-cyan-300 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
            >
              {inviteMutation.isPending ? "Sending..." : "Send Invite"}
            </button>
            <button
              onClick={() => setShowInviteForm(false)}
              className="text-sm font-medium text-slate-500 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          </div>
          {inviteError && (
            <p className="text-xs font-medium text-red-500 mt-2">{inviteError}</p>
          )}
        </div>
      )}

      {/* Team Members */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-6 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">
            Members ({members?.length || 0})
          </h2>
        </div>
        {loadingMembers ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-400">Loading members...</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold tracking-widest text-slate-500 uppercase px-5 py-3">Name</th>
                <th className="text-left text-xs font-semibold tracking-widest text-slate-500 uppercase px-5 py-3">Email</th>
                <th className="text-left text-xs font-semibold tracking-widest text-slate-500 uppercase px-5 py-3">Role</th>
                <th className="text-left text-xs font-semibold tracking-widest text-slate-500 uppercase px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members?.map((member: any) => (
                <tr key={member.id} className="hover:bg-teal-50/40 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-900">{member.name}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm text-slate-500">{member.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={member.role}
                      onChange={e => updateRoleMutation.mutate({
                        id: member.id,
                        role: e.target.value,
                      })}
                      className="text-xs font-medium border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MEMBER">Member</option>
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => removeMutation.mutate(member.id)}
                      className="text-xs font-medium text-red-500 hover:text-white hover:bg-red-500 border border-red-100 bg-red-50 px-2.5 py-1 rounded-full transition-all"
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
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">
              Pending Invitations ({pendingInvitations.length})
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold tracking-widest text-slate-500 uppercase px-5 py-3">Email</th>
                <th className="text-left text-xs font-semibold tracking-widest text-slate-500 uppercase px-5 py-3">Role</th>
                <th className="text-left text-xs font-semibold tracking-widest text-slate-500 uppercase px-5 py-3">Expires</th>
                <th className="text-left text-xs font-semibold tracking-widest text-slate-500 uppercase px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingInvitations.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-teal-50/40 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-900">{inv.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-full">
                      {inv.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-xs text-slate-500">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => cancelInviteMutation.mutate(inv.id)}
                      className="text-xs font-medium text-red-500 hover:text-white hover:bg-red-500 border border-red-100 bg-red-50 px-2.5 py-1 rounded-full transition-all"
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