import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, differenceInMinutes } from 'date-fns'
import { incidentsApi, postmortemsApi } from '../lib/api'
import type { ActionItem, TeamMember } from '../lib/api'

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
const [editingActions, setEditingActions] = useState(false)
const [editableActions, setEditableActions] = useState<ActionItem[]>([])

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
   <div className="p-8 max-w-7xl mx-auto w-full">
 {/* Top bar */}
<div className="flex items-center justify-between mb-8">
  <button
    onClick={() => navigate('/dashboard')}
    className="no-print flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
    Back to Dashboard
  </button>

  <button
    onClick={() => window.print()}
    className="no-print flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    Export PDF
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
          <span>
  {new Date(incident.startTime).toISOString().substring(0, 10)} · {new Date(incident.startTime).toISOString().substring(11, 16)} — {new Date(incident.endTime).toISOString().substring(11, 16)} UTC
</span>
          <span>Duration: {getDuration(incident.startTime, incident.endTime)}</span>
          <button
            onClick={() => statusMutation.mutate(
              incident.status === 'OPEN' ? 'RESOLVED' : 'OPEN'
            )}
            className={`no-print px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
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
      {/* Recurring Incident Alert */}
{postmortem.recurringAlert && postmortem.recurringAlert.isRecurring && (
  <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-6">
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-orange-800 mb-1">
          ⚠️ Recurring Incident Detected — {postmortem.recurringAlert.serviceIncidentCount} incidents for this service in 30 days
        </p>
        <p className="text-sm text-orange-700 mb-2">
          <span className="font-medium">Pattern:</span> {postmortem.recurringAlert.pattern}
        </p>
        <p className="text-sm text-orange-700">
          <span className="font-medium">Recommendation:</span> {postmortem.recurringAlert.recommendation}
        </p>
      </div>
    </div>
  </div>
)}
     {(incident.teamMembers as TeamMember[])?.length > 0 && (
  <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
    <h2 className="text-sm font-semibold text-gray-700 mb-3">Team</h2>
    <div className="divide-y divide-gray-100">
      {(incident.teamMembers as TeamMember[]).map((member, index) => (
        <div key={index} className="flex items-center justify-between py-2">
          <span className="text-sm font-medium text-gray-900">{member.name}</span>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {member.role}
          </span>
        </div>
      ))}
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
                className="no-print text-xs text-indigo-600 hover:text-indigo-800"
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
                  className="no-print text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700"
                >
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="no-print text-xs text-gray-500 px-3 py-1.5 rounded-md hover:bg-gray-100"
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
    ? new Date(event.time).toISOString().substring(11, 16) + ' UTC'
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
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-sm font-semibold text-gray-700">Action Items</h2>
    {!editingActions ? (
      <button
        onClick={() => {
          setEditableActions([...actionItems])
          setEditingActions(true)
        }}
        className="no-print text-xs text-indigo-600 hover:text-indigo-800"
      >
        Edit
      </button>
    ) : (
      <div className="flex gap-2">
        <button
          onClick={() => {
            updateMutation.mutate({
              actionItems: editableActions
            } as any)
            setEditingActions(false)
          }}
          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700"
        >
          Save
        </button>
        <button
          onClick={() => setEditingActions(false)}
          className="text-xs text-gray-500 px-3 py-1.5 rounded-md hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    )}
  </div>

  {!editingActions ? (
    // View mode
    <div className="space-y-3">
      {actionItems.map((item, index) => (
        <div key={index} className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={item.completed}
            onChange={() => toggleActionMutation.mutate(index)}
            className="no-print mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
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
  ) : (
    // Edit mode
    <div className="space-y-3">
      {editableActions.map((item, index) => (
        <div key={index} className="flex items-start gap-2 p-3 border border-gray-200 rounded-lg">
          <div className="flex-1 space-y-2">
            <textarea
              value={item.task}
              onChange={e => setEditableActions(prev =>
                prev.map((a, i) => i === index ? { ...a, task: e.target.value } : a)
              )}
              rows={2}
              placeholder="Action item description"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={item.owner}
              onChange={e => setEditableActions(prev =>
                prev.map((a, i) => i === index ? { ...a, owner: e.target.value } : a)
              )}
              placeholder="Owner"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={() => setEditableActions(prev => prev.filter((_, i) => i !== index))}
            className="text-gray-400 hover:text-red-500 transition-colors mt-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Add new action item */}
      <button
        onClick={() => setEditableActions(prev => [
          ...prev,
          { task: '', owner: '', dueDate: 'Not specified', completed: false }
        ])}
        className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add action item
      </button>
    </div>
  )}
</div>

    </div>
  )
}