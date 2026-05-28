import type {
  ReconfigurationTask,
  ReconfigurationTaskCreateRequest,
  ReconfigurationTaskStatusHistoryEntry,
} from '../types/reconfiguration'
import { apiFetch } from './http'

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export type FetchReconfigurationTasksOptions = {
  maxRecords?: number
  maxWaitSeconds?: number
}

/**
 * Снимок сообщений из Kafka-топика задач реконфигурации (чтение с earliest).
 */
export async function fetchReconfigurationTasks(
  options: FetchReconfigurationTasksOptions = {},
): Promise<ReconfigurationTask[]> {
  const params = new URLSearchParams()
  if (options.maxRecords != null) {
    params.set('maxRecords', String(options.maxRecords))
  }
  if (options.maxWaitSeconds != null) {
    params.set('maxWaitSeconds', String(options.maxWaitSeconds))
  }
  const q = params.toString()
  const path =
    q === '' ? '/api/v1/reconfiguration/tasks' : `/api/v1/reconfiguration/tasks?${q}`
  const res = await apiFetch(path)
  return parseJson<ReconfigurationTask[]>(res)
}

/**
 * Создать задачу (отправить сообщение в Kafka).
 */
export async function createReconfigurationTask(
  body: ReconfigurationTaskCreateRequest,
): Promise<ReconfigurationTask> {
  const res = await apiFetch('/api/v1/reconfiguration/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseJson<ReconfigurationTask>(res)
}

export async function cancelReconfigurationTask(
  taskId: string,
): Promise<ReconfigurationTask> {
  const res = await apiFetch(`/api/v1/reconfiguration/tasks/${taskId}/cancel`, {
    method: 'POST',
  })
  return parseJson<ReconfigurationTask>(res)
}

export async function confirmReconfigurationTask(
  taskId: string,
): Promise<ReconfigurationTask> {
  const res = await apiFetch(`/api/v1/reconfiguration/tasks/${taskId}/confirm`, {
    method: 'POST',
  })
  return parseJson<ReconfigurationTask>(res)
}

export async function fetchReconfigurationTaskStatusHistory(
  taskId: string,
): Promise<ReconfigurationTaskStatusHistoryEntry[]> {
  const res = await apiFetch(
    `/api/v1/reconfiguration/tasks/${taskId}/status-history`,
  )
  return parseJson<ReconfigurationTaskStatusHistoryEntry[]>(res)
}
