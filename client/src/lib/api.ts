import axios from 'axios'



const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

const publicApi = axios.create({
  baseURL: API_URL,
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
  severityOverridden?: boolean
  detectedSeverity?: string | null
  status: 'OPEN' | 'RESOLVED'
  createdAt: string
  teamMembers?: TeamMember[]
  rawLogs?: string
  engineerNotes?: string
  postmortem?: Postmortem
  createdByName?: string
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
export interface UpdatePostmortemPayload {
  summary?: string
  rootCause?: string
  impact?: string
  resolution?: string
  wentWell?: string
  actionItems?: ActionItem[]
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
  recurringAlert: {
    isRecurring: boolean
    serviceIncidentCount: number
    pattern: string
    recommendation: string
  } | null
  editHistory: {
    field: string
    oldValue: string
      newValue: string
       editedByName: string
    editedAt: string
  }[] | null
  isEdited: boolean
  editedAt: string | null
  generatedAt: string
}
export interface TeamMember {
  name: string
  role: string
}

export interface CreateIncidentPayload {
  serviceName: string
  startTime: string
  endTime: string
  engineerNotes: string
  rawLogs?: string
  teamMembers?: TeamMember[]
}

export interface Settings {
  id: string
  slackWebhook: string | null
  updatedAt: string
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

   notifySlack: (id: string) =>
    api.post(`/incidents/${id}/notify-slack`),
}

export const postmortemsApi = {
  getOne: (id: string) =>
    api.get<{ success: boolean; data: Postmortem }>(`/postmortems/${id}`),

  update: (id: string, data: UpdatePostmortemPayload) =>
  api.patch(`/postmortems/${id}`, data),

  toggleActionItem: (id: string, index: number) =>
    api.patch(`/postmortems/${id}/action-items/${index}`),
}

export const settingsApi = {
  get: () => api.get<{ success: boolean; data: Settings | null }>('/settings'),
  update: (data: { slackWebhook: string | null }) =>
    api.patch<{ success: boolean; data: Settings }>('/settings', data),
}


export interface User {
  id: string
  email: string
  name: string
  role: string
  createdAt?: string
}

export const authApi = {
    checkSetup: () =>
    publicApi.get<{ success: boolean; needsSetup: boolean }>('/auth/setup'),

  register: (data: { email: string; password: string; name: string }) =>
    api.post<{ success: boolean; data: User }>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<{ success: boolean; data: User }>('/auth/login', data),

  me: () =>
    api.get<{ success: boolean; data: User }>('/auth/me'),

  logout: () =>
    api.post('/auth/logout'),

}


export const invitationsApi = {
  send: (data: { email: string; role: string }) =>
    api.post('/invitations', data),

  list: () =>
    api.get<{ success: boolean; data: any[] }>('/invitations'),

  validate: (token: string) =>
    api.get<{ success: boolean; data: { email: string; role: string } }>(
      `/invitations/validate/${token}`
    ),

  accept: (token: string, data: { name: string; password: string }) =>
    api.post<{ success: boolean; data: User }>(
      `/invitations/accept/${token}`,
      data
    ),

  cancel: (id: string) =>
    api.delete(`/invitations/${id}`),
}

export const teamApi = {
  list: () =>
    api.get<{ success: boolean; data: User[] }>('/team'),

  updateRole: (id: string, role: string) =>
    api.patch(`/team/${id}/role`, { role }),

  remove: (id: string) =>
    api.delete(`/team/${id}`),
}
export default api