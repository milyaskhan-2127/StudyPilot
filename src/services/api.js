async function request(path, options = {}) {
  let response
  try {
    response = await fetch(path, { ...options, headers: { Accept: 'application/json', ...options.headers }, cache: 'no-store' })
  } catch {
    throw new Error('Network unavailable. Check your connection and retry.')
  }
  const raw = await response.text()
  let data
  try { data = raw ? JSON.parse(raw) : null } catch { data = raw }
  if (!response.ok) throw new Error(data?.error || data?.message || `Request failed (${response.status}).`)
  return data
}

const value = (item, ...keys) => keys.map(key => item[key]).find(entry => entry !== undefined && entry !== null && entry !== '')

export function normalizeAssignment(item, index) {
  if (!item || typeof item !== 'object') return null
  const title = value(item, 'title', 'name', 'assignment', 'task')
  if (!title) return null
  const rawDate = value(item, 'dueDate', 'due_date', 'deadline', 'due', 'date')
  const date = rawDate ? new Date(rawDate) : null
  const progress = Number(value(item, 'progress', 'percentComplete', 'completion') ?? 0)
  const statusText = String(value(item, 'status', 'state') ?? '').toLowerCase()
  const status = ['done', 'completed', 'complete', 'finished'].includes(statusText) || progress >= 100 ? 'completed' : ['in progress', 'in-progress', 'active', 'started'].includes(statusText) || progress > 0 ? 'in-progress' : 'pending'
  return {
    id: String(value(item, 'id', 'assignmentId', 'assignment_id', 'rowNumber') ?? `${title}-${rawDate ?? index}`),
    title: String(title),
    subject: String(value(item, 'subject', 'course', 'class', 'category') ?? 'General'),
    dueDate: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
    status,
    progress: status === 'completed' ? 100 : Math.min(99, Math.max(0, Number.isFinite(progress) ? progress : 0)),
    priority: String(value(item, 'priority', 'importance') ?? 'normal').toLowerCase(),
    difficulty: String(value(item, 'difficulty', 'level') ?? ''),
    estimatedMinutes: Number(value(item, 'estimatedMinutes', 'estimated_minutes', 'estimatedTime') ?? 0) || 0,
    notes: String(value(item, 'notes', 'description', 'details') ?? ''),
  }
}

export async function fetchAssignments(signal) {
  const data = await request('/api/assignments', { signal })
  const list = data?.assignments ?? data?.data?.assignments
  if (!Array.isArray(list)) throw new Error('The assignments API did not return an assignments array.')
  return list.map(normalizeAssignment).filter(Boolean)
}

function parseChatText(data) {
  const source = Array.isArray(data) ? data[0] : data
  const text = source?.output ?? source?.text ?? source?.message ?? source?.response
  if (typeof text === 'string' && text.trim()) return text
  if (typeof source === 'string' && source.trim()) return source
  throw new Error('The AI returned an empty or unsupported response.')
}

export async function sendChatMessage(sessionId, chatInput) {
  const data = await request('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sendMessage', sessionId, chatInput }) })
  return parseChatText(data)
}

export async function loadChatSession(sessionId) {
  const data = await request('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'loadPreviousSession', sessionId }) })
  const list = Array.isArray(data) ? data : data?.messages ?? data?.data?.messages
  if (!Array.isArray(list)) return []
  return list.map((entry, index) => ({
    id: `history-${index}`,
    role: ['human', 'user'].includes(String(entry.type ?? entry.role).toLowerCase()) ? 'user' : 'assistant',
    text: typeof entry.message === 'string' ? entry.message : typeof entry.content === 'string' ? entry.content : entry.text ?? '',
    time: entry.createdAt ?? entry.timestamp ?? null,
  })).filter(entry => entry.text)
}
