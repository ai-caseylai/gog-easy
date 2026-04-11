export type ApiSuccess<T> = T & { success: true }

function getErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null
  const e = (json as { error?: unknown }).error
  return typeof e === 'string' ? e : null
}

export async function apiGet<T>(path: string): Promise<ApiSuccess<T>> {
  const res = await fetch(path, { credentials: 'include' })
  const json: unknown = await res.json()
  if (!res.ok || !json || typeof json !== 'object' || !(json as { success?: unknown }).success) {
    throw new Error(getErrorMessage(json) || 'REQUEST_FAILED')
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
  const json: unknown = await res.json()
  if (!res.ok || !json || typeof json !== 'object' || !(json as { success?: unknown }).success) {
    throw new Error(getErrorMessage(json) || 'REQUEST_FAILED')
  }
  return json as ApiSuccess<T>
}
