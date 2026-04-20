export type ApiSuccess<T> = T & { success: true }

function getErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null
  const e = (json as { error?: unknown }).error
  return typeof e === 'string' ? e : null
}

async function readJsonOrNull(res: Response): Promise<unknown | null> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { raw: text }
  }
}

function statusMessage(res: Response, json: unknown | null): string {
  const e = getErrorMessage(json)
  if (e) return e
  const raw = json && typeof json === 'object' && 'raw' in json ? (json as { raw?: unknown }).raw : null
  if (typeof raw === 'string' && raw.trim()) {
    const s = raw.trim()
    return s.length > 180 ? `${s.slice(0, 180)}…` : s
  }
  return `HTTP_${res.status}`
}

export async function apiGet<T>(path: string): Promise<ApiSuccess<T>> {
  const res = await fetch(path, { credentials: 'include' })
  const json: unknown | null = await readJsonOrNull(res)
  if (!res.ok || !json || typeof json !== 'object' || !(json as { success?: unknown }).success) {
    throw new Error(statusMessage(res, json) || 'REQUEST_FAILED')
  }
  return json as ApiSuccess<T>
}

export async function apiPost<T>(path: string, body?: unknown): Promise<ApiSuccess<T>> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })
  const json: unknown | null = await readJsonOrNull(res)
  if (!res.ok || !json || typeof json !== 'object' || !(json as { success?: unknown }).success) {
    throw new Error(statusMessage(res, json) || 'REQUEST_FAILED')
  }
  return json as ApiSuccess<T>
}
