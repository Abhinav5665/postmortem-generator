import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { incidentsApi } from '../lib/api'
import type { Incident } from '../lib/api'
import { formatDistanceToNow, format, differenceInMinutes } from 'date-fns'
import { useState } from 'react'

function SeverityBadge({ severity }: { severity: 'P0' | 'P1' | 'P2' }) {
  const styles = {
    P0: 'bg-red-100 text-red-700 border border-red-200',
    P1: 'bg-orange-100 text-orange-700 border border-orange-200',
    P2: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${styles[severity]}`}>
      {severity}
    </span>
  )
}

function StatusBadge({ status }: { status: 'OPEN' | 'RESOLVED' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      status === 'RESOLVED'
        ? 'bg-green-100 text-green-700 border border-green-200'
        : 'bg-gray-100 text-gray-600 border border-gray-200'
    }`}>
      {status === 'RESOLVED' ? 'Resolved' : 'Open'}
    </span>
  )
}

function getDuration(startTime: string, endTime: string): string {
  const minutes = differenceInMinutes(new Date(endTime), new Date(startTime))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

export default function Dashboard() {
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => incidentsApi.getAll().then(res => res.data.data),
  })

    const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

const filteredData = data?.filter(incident => {
  const matchesSearch = incident.serviceName
    .toLowerCase()
    .includes(search.toLowerCase())
  const matchesSeverity = severityFilter === 'ALL' || incident.severity === severityFilter
  const matchesStatus = statusFilter === 'ALL' || incident.status === statusFilter
  return matchesSearch && matchesSeverity && matchesStatus
})

 return (
    <div className="p-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Incident Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Track and manage all past incidents and postmortems</p>
        </div>
        <button
          onClick={() => navigate('/incidents/new')}
          className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-teal-100 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Incident
        </button>
      </div>
      {/* Filter Bar */}
<div className="flex gap-3 mb-6 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
  <input
    type="text"
    value={search}
    onChange={e => setSearch(e.target.value)}
    placeholder="Search by service name..."
    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-teal-50 focus:border-teal-300 transition-all"
  />
  <select
    value={severityFilter}
    onChange={e => setSeverityFilter(e.target.value)}
    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:ring-4 focus:ring-teal-50 focus:border-teal-300 cursor-pointer"
  >
    <option value="ALL">All Severities</option>
    <option value="P0">P0</option>
    <option value="P1">P1</option>
    <option value="P2">P2</option>
  </select>
  <select
    value={statusFilter}
    onChange={e => setStatusFilter(e.target.value)}
    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:ring-4 focus:ring-teal-50 focus:border-teal-300 cursor-pointer"
  >
    <option value="ALL">All Status</option>
    <option value="OPEN">Open</option>
    <option value="RESOLVED">Resolved</option>
  </select>
</div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="text-sm text-slate-400">Loading incidents...</div>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">Failed to load incidents. Make sure the server is running.</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && filteredData?.length === 0 && (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="w-12 h-12 bg-teal-50 border border-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-slate-900 text-sm font-semibold">No incidents yet</p>
          <button
            onClick={() => navigate('/incidents/new')}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-4 py-2 rounded-full transition-colors"
          >
            Create your first incident
          </button>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && filteredData && filteredData.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold tracking-widest text-slate-500 uppercase px-6 py-3.5">Date / Time</th>
                <th className="text-left text-xs font-semibold tracking-widest text-slate-500 uppercase px-6 py-3.5">Service</th>
                <th className="text-left text-xs font-semibold tracking-widest text-slate-500 uppercase px-6 py-3.5">Severity</th>
                <th className="text-left text-xs font-semibold tracking-widest text-slate-500 uppercase px-6 py-3.5">Duration</th>
                <th className="text-left text-xs font-semibold tracking-widest text-slate-500 uppercase px-6 py-3.5">Status</th>
                <th className="text-left text-xs font-semibold tracking-widest text-slate-500 uppercase px-6 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData?.map((incident: Incident) => (
                <tr
                  key={incident.id}
                  className="hover:bg-teal-50/40 transition-colors cursor-pointer"
                  onClick={() => navigate(`/incidents/${incident.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-900">
                      {format(new Date(incident.startTime), 'MMM d, yyyy')}
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
  <div className="flex items-center gap-2">
    <span className="text-sm font-semibold text-slate-900">{incident.serviceName}</span>
    {incident.postmortem && (incident.postmortem as any).recurringAlert?.isRecurring && (
      <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-semibold">
        Recurring
      </span>
    )}
  </div>
</td>
                  <td className="px-6 py-4">
                    <SeverityBadge severity={incident.severity} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
                      {getDuration(incident.startTime, incident.endTime)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={incident.status} />
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        navigate(`/incidents/${incident.id}`)
                      }}
                      className="text-sm font-semibold flex items-center gap-1 bg-teal-50 text-teal-700 hover:bg-teal-600 hover:text-white border border-teal-100 px-3 py-1.5 rounded-full transition-all"
                    >
                      View
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
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