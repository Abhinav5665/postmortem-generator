import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Types
export interface Incident {
  id: string
  serviceName: string
  startTime: string
  endTime: string
  severity: 'P0' | 'P1' | 'P2'
  status: 'OPEN' | 'RESOLVED'
  createdAt: string
  onCallEngineer?: string
  incidentCommander?: string
  participants?: string[]
  rawLogs?: string
  engineerNotes?: string
  postmortem?: Postmortem
}

export interface TimelineEvent {
  time: string
  event: string
  type: 'ALERT_START' | 'ALERT_END' | 'ERROR' | 'FATAL' | 'WARN'
}

export interface ActionItem {
  task: string
  owner: string
  dueDate: string
  completed: boolean
}

export interface Postmortem {
  id: string
  incidentId: string
  summary: string
  timeline: TimelineEvent[]
  rootCause: string
  impact: string
  impactMetrics: {
    affectedUsers: string
    failureRate: string
    downtime: string
  }
  resolution: string
  wentWell: string
  actionItems: ActionItem[]
  severity: 'P0' | 'P1' | 'P2'
  isEdited: boolean
  editedAt: string | null
  generatedAt: string
}

export interface CreateIncidentPayload {
  serviceName: string
  startTime: string
  endTime: string
  engineerNotes: string
  rawLogs?: string
  onCallEngineer?: string
  incidentCommander?: string
  participants?: string
}

// API calls
export const incidentsApi = {
  getAll: () => api.get<{ success: boolean; data: Incident[] }>('/incidents'),

  getOne: (id: string) =>
    api.get<{ success: boolean; data: Incident }>(`/incidents/${id}`),

  create: (formData: FormData) =>
    api.post<{ success: boolean; data: Incident }>('/incidents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updateStatus: (id: string, status: 'OPEN' | 'RESOLVED') =>
    api.patch(`/incidents/${id}/status`, { status }),
}

export const postmortemsApi = {
  getOne: (id: string) =>
    api.get<{ success: boolean; data: Postmortem }>(`/postmortems/${id}`),

  update: (id: string, data: Partial<Postmortem>) =>
    api.patch(`/postmortems/${id}`, data),

  toggleActionItem: (id: string, index: number) =>
    api.patch(`/postmortems/${id}/action-items/${index}`),
}

export default api