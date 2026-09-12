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
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incident Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage all past incidents and postmortems</p>
        </div>
        <button
          onClick={() => navigate('/incidents/new')}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Incident
        </button>
      </div>
      {/* Filter Bar */}
<div className="flex gap-3 mb-6">
  <input
    type="text"
    value={search}
    onChange={e => setSearch(e.target.value)}
    placeholder="Search by service name..."
    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
  />
  <select
    value={severityFilter}
    onChange={e => setSeverityFilter(e.target.value)}
    className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
  >
    <option value="ALL">All Severities</option>
    <option value="P0">P0</option>
    <option value="P1">P1</option>
    <option value="P2">P2</option>
  </select>
  <select
    value={statusFilter}
    onChange={e => setStatusFilter(e.target.value)}
    className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
  >
    <option value="ALL">All Status</option>
    <option value="OPEN">Open</option>
    <option value="RESOLVED">Resolved</option>
  </select>
</div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-gray-400">Loading incidents...</div>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">Failed to load incidents. Make sure the server is running.</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && filteredData?.length === 0 && (
        <div className="text-center py-20">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">No incidents yet</p>
          <button
            onClick={() => navigate('/incidents/new')}
            className="mt-3 text-indigo-600 text-sm hover:underline"
          >
            Create your first incident
          </button>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && filteredData && filteredData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Date / Time</th>
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Service</th>
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Severity</th>
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Duration</th>
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData?.map((incident: Incident) => (
                <tr
                  key={incident.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/incidents/${incident.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {format(new Date(incident.startTime), 'MMM d, yyyy')}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">{incident.serviceName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <SeverityBadge severity={incident.severity} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
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
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
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