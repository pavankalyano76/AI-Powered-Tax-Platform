// Thin wrapper around fetch() for talking to the Flask API.
// In dev, Vite's proxy (see vite.config.ts) forwards /api/* to Flask on :5050.

export type ClientInfo = {
  id: number
  name: string
  email: string | null
  entity_type: string | null
}

export type UserInfo = {
  id: number
  name: string
  role: string
  client_id: number | null
}

export type ReturnSummary = {
  id: number
  client: ClientInfo
  tax_year: number
  form_type: string
  status: string
  blocking_reason: string | null
  preparer: UserInfo | null
  due_date: string | null
  needs_attention?: boolean
}

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    throw new Error(`Request to ${path} failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function getUsers() {
  return fetchJSON<UserInfo[]>('/api/users')
}

export function getReturns(userId?: number) {
  const qs = userId ? `?user_id=${userId}` : ''
  return fetchJSON<ReturnSummary[]>(`/api/returns${qs}`)
}

export type DocumentInfo = {
  id: number
  return_id: number
  name: string
  doc_type: string
  page_count: number
}

export type FieldInfo = {
  id: number
  return_id: number
  label: string
  category: string
  value: string
  state: string
  confidence: number | null
  source_document_id: number | null
  source_page: number | null
  source_region: string | null
  transform: string | null
}

export type TaskInfo = {
  id: number
  return_id: number
  title: string
  owner_role: string
  owner_user_id: number | null
  status: string
  priority: string
  due_date: string | null
  related_document_id: number | null
}

export type StatusEvent = {
  id: number
  return_id: number
  label: string
  occurred_at: string
}

export type ReturnDetailData = ReturnSummary & {
  documents: DocumentInfo[]
  fields: FieldInfo[]
  tasks: TaskInfo[]
  history: StatusEvent[]
}

export function getReturn(id: number) {
  return fetchJSON<ReturnDetailData>(`/api/returns/${id}`)
}

export type FieldExplanation = {
  summary: string
  evidence: { type: string; detail: string; region?: string | null }[]
  uncertainty: string | null
  recommended_action: string | null
}

export type FieldCorrection = {
  suggested_value?: string
  rationale?: string
}

export function explainField(fieldId: number) {
  return fetchJSON<FieldExplanation>(`/api/ai/explain/${fieldId}`)
}

export function getFieldCorrection(fieldId: number) {
  return fetchJSON<FieldCorrection>(`/api/ai/correction/${fieldId}`)
}

export type MessageInfo = {
  id: number
  return_id: number
  thread_id: string
  related_document_id: number | null
  related_task_id: number | null
  author: UserInfo
  visibility: string
  body: string
  created_at: string
}

export function getMessages(returnId: number) {
  return fetchJSON<MessageInfo[]>(`/api/returns/${returnId}/messages`)
}

export async function postMessage(
  returnId: number,
  message: {
    author_user_id: number
    visibility: string
    body: string
    thread_id?: string
    related_document_id?: number | null
    related_task_id?: number | null
  },
): Promise<MessageInfo> {
  const res = await fetch(`/api/returns/${returnId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })
  if (!res.ok) {
    throw new Error(`Request to post message failed: ${res.status}`)
  }
  return res.json() as Promise<MessageInfo>
}

export type DashboardTask = TaskInfo & {
  score: number
  client_name: string | null
  return_status: string | null
  owner_name: string | null
  related_field_id: number | null
}

export function getDashboard(userId: number) {
  return fetchJSON<DashboardTask[]>(`/api/dashboard?user_id=${userId}`)
}

export async function updateField(
  fieldId: number,
  changes: { value?: string; state?: string; confidence?: number | null },
): Promise<FieldInfo> {
  const res = await fetch(`/api/fields/${fieldId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
  if (!res.ok) {
    throw new Error(`Request to update field ${fieldId} failed: ${res.status}`)
  }
  return res.json() as Promise<FieldInfo>
}

export async function updateTask(
  taskId: number,
  changes: { status?: string; due_date?: string; owner_user_id?: number },
): Promise<TaskInfo> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
  if (!res.ok) {
    throw new Error(`Request to update task ${taskId} failed: ${res.status}`)
  }
  return res.json() as Promise<TaskInfo>
}
