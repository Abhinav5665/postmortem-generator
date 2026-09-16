import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { differenceInMinutes } from 'date-fns'
import { incidentsApi, postmortemsApi } from '../lib/api'
import type { ActionItem, TeamMember } from '../lib/api'

// Truncated text with read more toggle
function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > 120

  return (
    <div>
      <p className="text-xs text-gray-600 whitespace-pre-wrap">
        {expanded || !isLong ? text : text.substring(0, 120) + '...'}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="text-xs text-indigo-500 hover:text-indigo-700 mt-1"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}

// Compare two action item arrays and return diff
function getActionItemDiff(oldJson: string, newJson: string) {
  try {
    const oldItems: ActionItem[] = JSON.parse(oldJson)
    const newItems: ActionItem[] = JSON.parse(newJson)

    const added = newItems.filter(
      curr => !oldItems.some(old => old.task === curr.task)
    )
    const removed = oldItems.filter(
      old => !newItems.some(curr => curr.task === old.task)
    )
    const edited = newItems.filter(curr =>
      oldItems.some(
        old => old.task === curr.task && old.owner !== curr.owner
      )
    )

    return { added, removed, edited }
  } catch {
    return { added: [], removed: [], edited: [] }
  }
}

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

  // ALL hooks at the top
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [editingActions, setEditingActions] = useState(false)
  const [editableActions, setEditableActions] = useState<ActionItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [slackSent, setSlackSent] = useState(false)
const [slackError, setSlackError] = useState<string | null>(null)

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
  const slackMutation = useMutation({
  mutationFn: () => incidentsApi.notifySlack(id!),
  onSuccess: () => {
    setSlackSent(true)
    setSlackError(null)
  },
  onError: (error: any) => {
    setSlackError(error.response?.data?.error || 'Failed to send to Slack')
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
    <div className="p-8 max-w-4xl mx-auto w-full">

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

       <div className="no-print flex items-center gap-3">
  {slackSent && (
    <span className="text-xs text-green-600 font-medium">✓ Sent to Slack</span>
  )}
  {slackError && (
    <span className="text-xs text-red-500">{slackError}</span>
  )}
  <button
    onClick={() => slackMutation.mutate()}
    disabled={slackMutation.isPending || slackSent}
    className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
  >
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
    {slackMutation.isPending ? 'Sending...' : slackSent ? 'Sent' : 'Send to Slack'}
  </button>
  <button
    onClick={() => window.print()}
    className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    Export PDF
  </button>
</div>
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

      {/* Impact metrics */}
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

      {/* Team */}
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
                  updateMutation.mutate({ actionItems: editableActions } as any)
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

      {/* Edit History */}
{postmortem.editHistory && postmortem.editHistory.length > 0 && (
  <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 no-print">
    <button
      onClick={() => setShowHistory(prev => !prev)}
      className="w-full flex items-center justify-between text-sm font-semibold text-gray-700"
    >
      <span>Edit History ({postmortem.editHistory.length} changes)</span>
      <svg
        className={`w-4 h-4 text-gray-400 transition-transform ${showHistory ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    {showHistory && (
      <div className="mt-4 space-y-4">
        {postmortem.editHistory.map((entry, index) => (
          <div key={index} className="border border-gray-100 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 capitalize">
                {entry.field.replace(/([A-Z])/g, ' $1').trim()} — edited
              </span>
              <span className="text-xs text-gray-400">
                {new Date(entry.editedAt).toISOString().substring(0, 16).replace('T', ' ')} UTC
              </span>
            </div>

            {entry.field === 'actionItems' ? (
              // Action item diff
              (() => {
                const { added, removed, edited } = getActionItemDiff(
  entry.oldValue,
  entry.newValue  // ← use stored newValue instead of current state
)
                return (
                  <div className="space-y-2">
                    {removed.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 bg-red-50 border border-red-100 rounded p-2">
                        <span className="text-xs text-red-500 font-bold mt-0.5">−</span>
                        <div>
                          <p className="text-xs text-red-600 line-through">{item.task}</p>
                          {item.owner && <p className="text-xs text-red-400">Owner: {item.owner}</p>}
                        </div>
                      </div>
                    ))}
                    {added.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 bg-green-50 border border-green-100 rounded p-2">
                        <span className="text-xs text-green-600 font-bold mt-0.5">+</span>
                        <div>
                          <p className="text-xs text-green-700">{item.task}</p>
                          {item.owner && <p className="text-xs text-green-500">Owner: {item.owner}</p>}
                        </div>
                      </div>
                    ))}
                    {edited.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 bg-yellow-50 border border-yellow-100 rounded p-2">
                        <span className="text-xs text-yellow-600 font-bold mt-0.5">✏</span>
                        <div>
                          <p className="text-xs text-yellow-700">{item.task}</p>
                          <p className="text-xs text-yellow-500">Owner changed to: {item.owner}</p>
                        </div>
                      </div>
                    ))}
                    {added.length === 0 && removed.length === 0 && edited.length === 0 && (
                      <p className="text-xs text-gray-400 italic">Action items were reordered or completion status changed</p>
                    )}
                  </div>
                )
              })()
            ) : (
              // Text field before/after
              <div className="space-y-2">
                <div className="bg-red-50 border border-red-100 rounded p-2">
                  <p className="text-xs text-red-500 font-medium mb-1">Before</p>
                  <ExpandableText text={entry.oldValue || 'Empty'} />
                </div>
                <div className="bg-green-50 border border-green-100 rounded p-2">
  <p className="text-xs text-green-600 font-medium mb-1">After</p>
  <ExpandableText text={entry.newValue || 'Empty'} />
</div>
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
)}

    </div>
  )
}