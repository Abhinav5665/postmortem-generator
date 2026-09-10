import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, differenceInMinutes } from 'date-fns'
import { incidentsApi, postmortemsApi } from '../lib/api'
import type { ActionItem } from '../lib/api'

function SeverityBadge({ severity }: { severity: 'P0' | 'P1' | 'P2' }) {
  const styles = {
    P0: 'bg-red-100 text-red-700 border border-red-200',
    P1: 'bg-orange-100 text-orange-700 border border-orange-200',
    P2: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-sm font-bold ${styles[severity]}`}>
      {severity}
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

export default function Postmortem() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  const { data: incident, isLoading, isError } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => incidentsApi.getOne(id!).then(res => res.data.data),
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      postmortemsApi.update(incident!.postmortem!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident', id] })
      setEditingField(null)
    },
  })

  const toggleActionMutation = useMutation({
    mutationFn: (index: number) =>
      postmortemsApi.toggleActionItem(incident!.postmortem!.id, index),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident', id] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: (status: 'OPEN' | 'RESOLVED') =>
      incidentsApi.updateStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident', id] })
    },
  })

  function startEdit(field: string, currentValue: string) {
    setEditingField(field)
    setEditValues(prev => ({ ...prev, [field]: currentValue }))
  }

  function saveEdit(field: string) {
    updateMutation.mutate({ [field]: editValues[field] })
  }

  function cancelEdit() {
    setEditingField(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">Loading postmortem...</p>
      </div>
    )
  }

  if (isError || !incident) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">Failed to load incident. Please try again.</p>
        </div>
      </div>
    )
  }

  const postmortem = incident.postmortem
  if (!postmortem) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">No postmortem found for this incident.</p>
      </div>
    )
  }

  const actionItems = postmortem.actionItems as ActionItem[]

  return (
    <div className="p-8 max-w-4xl">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>
      </div>

      {/* Title */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-gray-900">
            Postmortem — {incident.serviceName}
          </h1>
          <SeverityBadge severity={incident.severity as 'P0' | 'P1' | 'P2'} />
          {postmortem.isEdited && (
            <span className="text-xs text-gray-400 italic">edited</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{format(new Date(incident.startTime), 'MMM d, yyyy · h:mm a')} — {format(new Date(incident.endTime), 'h:mm a')}</span>
          <span>Duration: {getDuration(incident.startTime, incident.endTime)}</span>
          <button
            onClick={() => statusMutation.mutate(
              incident.status === 'OPEN' ? 'RESOLVED' : 'OPEN'
            )}
            className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
              incident.status === 'RESOLVED'
                ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
            }`}
          >
            {incident.status === 'RESOLVED' ? 'Resolved' : 'Open'}
          </button>
        </div>
      </div>

      {/* Impact metrics — borrowed from Image 2 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">Downtime</p>
          <p className="text-2xl font-bold text-gray-900">{postmortem.impactMetrics.downtime}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">Failure Rate</p>
          <p className="text-2xl font-bold text-red-600">{postmortem.impactMetrics.failureRate}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">Affected Users</p>
          <p className="text-2xl font-bold text-orange-600">{postmortem.impactMetrics.affectedUsers}</p>
        </div>
      </div>

      {/* Team */}
      {(incident.onCallEngineer || incident.incidentCommander || (incident.participants as string[])?.length > 0) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Team</h2>
          <div className="flex flex-wrap gap-6 text-sm">
            {incident.onCallEngineer && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">On-call Engineer</p>
                <p className="font-medium text-gray-900">{incident.onCallEngineer}</p>
              </div>
            )}
            {incident.incidentCommander && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Incident Commander</p>
                <p className="font-medium text-gray-900">{incident.incidentCommander}</p>
              </div>
            )}
            {(incident.participants as string[])?.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Participants</p>
                <p className="font-medium text-gray-900">
                  {(incident.participants as string[]).join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editable sections */}
      {[
        { key: 'summary', label: 'Executive Summary' },
        { key: 'rootCause', label: 'Root Cause' },
        { key: 'impact', label: 'Impact' },
        { key: 'resolution', label: 'Resolution' },
        { key: 'wentWell', label: 'What Went Well' },
      ].map(({ key, label }) => (
        <div key={key} className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">{label}</h2>
            {editingField !== key && (
              <button
                onClick={() => startEdit(key, postmortem[key as keyof typeof postmortem] as string)}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Edit
              </button>
            )}
          </div>
          {editingField === key ? (
            <div>
              <textarea
                value={editValues[key] || ''}
                onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => saveEdit(key)}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700"
                >
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-xs text-gray-500 px-3 py-1.5 rounded-md hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600 leading-relaxed">
              {postmortem[key as keyof typeof postmortem] as string}
            </p>
          )}
        </div>
      ))}

      {/* Timeline */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Timeline</h2>
        <div className="space-y-3">
          {postmortem.timeline.map((event, index) => (
            <div key={index} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${
                  event.type === 'FATAL' ? 'bg-red-500' :
                  event.type === 'ERROR' ? 'bg-orange-400' :
                  event.type === 'ALERT_START' ? 'bg-indigo-500' :
                  event.type === 'ALERT_END' ? 'bg-green-500' :
                  'bg-gray-400'
                }`} />
                {index < postmortem.timeline.length - 1 && (
                  <div className="w-px flex-1 bg-gray-200 mt-1" />
                )}
              </div>
              <div className="pb-3">
                <p className="text-xs text-gray-400 mb-0.5">
                  {event.time
                    ? format(new Date(event.time), 'h:mm a')
                    : 'Unknown'}
                </p>
                <p className="text-sm text-gray-700">{event.event}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Action Items</h2>
        <div className="space-y-3">
          {actionItems.map((item, index) => (
            <div key={index} className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => toggleActionMutation.mutate(index)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
              />
              <div className="flex-1">
                <p className={`text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {item.task}
                </p>
                <div className="flex gap-3 mt-0.5">
                  {item.owner && (
                    <span className="text-xs text-gray-400">Owner: {item.owner}</span>
                  )}
                  {item.dueDate && item.dueDate !== 'Not specified' && (
                    <span className="text-xs text-gray-400">Due: {item.dueDate}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}