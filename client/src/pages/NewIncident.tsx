import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { incidentsApi } from '../lib/api'
import type { TeamMember } from '../lib/api'


// ... imports

function extractFirstTimestamp(logs: string): string {
  const lines = logs.split('\n').filter(Boolean)
  for (const line of lines) {
    const match = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)
    if (match) return match[1]
  }
  return ''
}


  // ... component code

export default function NewIncident() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logInputType, setLogInputType] = useState<'paste' | 'file'>('paste')
  const [logFile, setLogFile] = useState<File | null>(null)

  const [form, setForm] = useState({
    serviceName: '',
    startTime: '',
    endTime: '',
    engineerNotes: '',
    rawLogs: '',
    onCallEngineer: '',
    incidentCommander: '',
    participants: '',
    templateType: 'General',
  })

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
  { name: '', role: '' }
])

function addTeamMember() {
  setTeamMembers(prev => [...prev, { name: '', role: '' }])
}

function removeTeamMember(index: number) {
  setTeamMembers(prev => prev.filter((_, i) => i !== index))
}

function updateTeamMember(index: number, field: 'name' | 'role', value: string) {
  setTeamMembers(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
}

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit() {
    setError(null)

    // Basic validation
    if (!form.serviceName || !form.startTime || !form.endTime || !form.engineerNotes) {
      setError('Service name, start time, end time and engineer notes are required')
      return
    }

    if (logInputType === 'paste' && !form.rawLogs) {
      setError('Please paste your logs or upload a log file')
      return
    }

    if (logInputType === 'file' && !logFile) {
      setError('Please upload a log file')
      return
    }

    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('serviceName', form.serviceName)
      formData.append('startTime', new Date(form.startTime + ':00Z').toISOString())
formData.append('endTime', new Date(form.endTime + ':00Z').toISOString())
      formData.append('engineerNotes', form.engineerNotes)
      formData.append('templateType', form.templateType)

      const validTeamMembers = teamMembers.filter(m => m.name && m.role)
if (validTeamMembers.length > 0) {
  formData.append('teamMembers', JSON.stringify(validTeamMembers))
}

      if (logInputType === 'paste') {
        formData.append('rawLogs', form.rawLogs)
      } else if (logFile) {
        formData.append('logFile', logFile)
      }

      console.log('startTime:', new Date(form.startTime + ':00Z').toISOString())
console.log('endTime:', new Date(form.endTime + ':00Z').toISOString())

      const response = await incidentsApi.create(formData)
      const incidentId = response.data.data.id
      navigate(`/incidents/${incidentId}`)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate postmortem. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

 return (
    <div className="p-8 w-full bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create New Incident</h1>
        <p className="text-sm text-slate-500 mt-1">
          Provide the details and we\'ll generate a complete postmortem for you
        </p>
      </div>

      <div className="space-y-6">
        {/* Service Name */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Service Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="serviceName"
            value={form.serviceName}
            onChange={handleChange}
            placeholder="e.g. Payment Service"
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-50 focus:border-teal-300 transition-all"
          />
        </div>

       {/* Template Type */}
<div>
  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
    Incident Type
  </label>
  <div className="grid grid-cols-3 gap-2 mb-2">
    {["General", "Deployment", "Database", "Security", "Performance", "Infrastructure"].map(type => (
      <button
        key={type}
        onClick={() => setForm(prev => ({ ...prev, templateType: type }))}
        className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
          form.templateType === type
            ? "bg-gradient-to-r from-teal-600 to-cyan-600 text-white border-teal-600 shadow-md shadow-teal-100"
            : "bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:bg-teal-50"
        }`}
      >
        {type}
      </button>
    ))}
  </div>
  <input
    type="text"
    value={form.templateType}
    onChange={e => setForm(prev => ({ ...prev, templateType: e.target.value }))}
    placeholder="Or type a custom incident type..."
    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-50 focus:border-teal-300 transition-all"
  />
</div>

       {/* Times */}
<div className="grid grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
      Incident Start Time <span className="text-red-500">*</span>
    </label>
    <div className="grid grid-cols-2 gap-2">
      <input
        type="date"
        name="startDate"
        value={form.startTime.split("T")[0] || ""}
        onChange={e => setForm(prev => ({
          ...prev,
          startTime: `${e.target.value}T${prev.startTime.split("T")[1] || "00:00"}`
        }))}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-teal-50 focus:border-teal-300 transition-all"
      />
      <input
        type="time"
        name="startTimeOnly"
        value={form.startTime.split("T")[1] || ""}
        onChange={e => setForm(prev => ({
          ...prev,
          startTime: `${prev.startTime.split("T")[0] || ""}T${e.target.value}`
        }))}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-teal-50 focus:border-teal-300 transition-all"
      />
    </div>
  </div>
  <div>
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
      Incident End Time <span className="text-red-500">*</span>
    </label>
    <div className="grid grid-cols-2 gap-2">
      <input
        type="date"
        name="endDate"
        value={form.endTime.split("T")[0] || ""}
        onChange={e => setForm(prev => ({
          ...prev,
          endTime: `${e.target.value}T${prev.endTime.split("T")[1] || "00:00"}`
        }))}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-teal-50 focus:border-teal-300 transition-all"
      />
      <input
        type="time"
        name="endTimeOnly"
        value={form.endTime.split("T")[1] || ""}
        onChange={e => setForm(prev => ({
          ...prev,
          endTime: `${prev.endTime.split("T")[0] || ""}T${e.target.value}`
        }))}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-teal-50 focus:border-teal-300 transition-all"
      />
    </div>
  </div>
</div>
        {/* Raw Logs */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Raw Logs <span className="text-red-500">*</span>
          </label>

          {/* Toggle */}
          <div className="flex gap-1 mb-2 border border-slate-200 rounded-xl p-1 w-fit bg-slate-50">
            <button
              onClick={() => setLogInputType("paste")}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all ${
                logInputType === "paste"
                  ? "bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Paste Logs
            </button>
            <button
              onClick={() => setLogInputType("file")}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all ${
                logInputType === "file"
                  ? "bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Upload File
            </button>
          </div>

          {logInputType === "paste" ? (
            <textarea
              name="rawLogs"
              value={form.rawLogs}
              onChange={e => {
  const logs = e.target.value
  setForm(prev => {
    const detected = extractFirstTimestamp(logs)
    return {
      ...prev,
      rawLogs: logs,
      startTime: !prev.startTime && detected ? detected : prev.startTime,
    }
  })
}}
          
              rows={8}
              placeholder="Paste your raw log output here..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-50 focus:border-teal-300 bg-slate-900 text-green-400 placeholder-slate-600 transition-all"
            />
          ) : (
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-white hover:border-teal-300 hover:bg-teal-50/30 transition-colors">
              <input
                type="file"
                accept=".log,.txt"
                onChange={e => setLogFile(e.target.files?.[0] || null)}
                className="hidden"
                id="logFile"
              />
              <label htmlFor="logFile" className="cursor-pointer">
                <svg className="w-8 h-8 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {logFile ? (
                  <p className="text-sm text-teal-700 font-semibold">{logFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-slate-600">Click to upload a log file</p>
                    <p className="text-xs text-slate-400 mt-1">.log or .txt files only, max 5MB</p>
                  </>
                )}
              </label>
            </div>
          )}
        </div>

        {/* Engineer Notes */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Engineer Notes <span className="text-red-500">*</span>
          </label>
          <textarea
            name="engineerNotes"
            value={form.engineerNotes}
            onChange={handleChange}
            rows={4}
            placeholder="What did you observe? What were the symptoms? Any relevant context..."
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-50 focus:border-teal-300 transition-all"
          />
        </div>

       {/* Team Members */}
<div className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-white shadow-sm">
  <h2 className="text-sm font-semibold text-slate-800">Team Members</h2>

  <div className="space-y-3">
    {teamMembers.map((member, index) => (
      <div key={index} className="flex gap-2 items-center">
        <input
          type="text"
          value={member.name}
          onChange={e => updateTeamMember(index, "name", e.target.value)}
          placeholder="Name"
          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-50 focus:border-teal-300 transition-all"
        />
        <select
          value={member.role}
          onChange={e => updateTeamMember(index, "role", e.target.value)}
          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-teal-50 focus:border-teal-300 transition-all cursor-pointer"
        >
          <option value="">Select role</option>
          <option value="On-call Engineer">On-call Engineer</option>
          <option value="Incident Commander">Incident Commander</option>
          <option value="Backend Engineer">Backend Engineer</option>
          <option value="Frontend Engineer">Frontend Engineer</option>
          <option value="DevOps Engineer">DevOps Engineer</option>
          <option value="Database Engineer">Database Engineer</option>
          <option value="Product Manager">Product Manager</option>
          <option value="QA Engineer">QA Engineer</option>
          <option value="Other">Other</option>
        </select>
        {teamMembers.length > 1 && (
          <button
            onClick={() => removeTeamMember(index)}
            className="text-slate-400 hover:text-red-500 transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    ))}
  </div>

  <button
    onClick={addTeamMember}
    className="text-sm font-semibold text-teal-700 hover:text-white hover:bg-teal-600 flex items-center gap-1 bg-teal-50 hover:bg-teal-600 px-3 py-1.5 rounded-full border border-teal-100 transition-all"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
    Add another person
  </button>
</div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm font-medium text-red-600">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 disabled:from-teal-300 disabled:to-cyan-300 text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-md shadow-teal-100 active:scale-95 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating Postmortem...
            </>
          ) : (
            "Generate Postmortem"
          )}
        </button>

        {isLoading && (
          <p className="text-center text-xs text-slate-400">
            This usually takes 10–15 seconds
          </p>
        )}
      </div>
    </div>
  )
}