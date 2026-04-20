import { useMemo, useState } from 'react'
import { useAdminStore } from '../../stores/useAdminStore'
import { adminApi } from '../../mocks/adminApi'
import type { Inventory, VM } from '../../mocks/adminTypes'

function sanitizeSensitiveText(raw: string): string {
  return raw
    .split('\n')
    .filter((line) => {
      const l = line.trim().toLowerCase()
      if (!l) return true
      if (l.includes('password')) return false
      return true
    })
    .join('\n')
}

function pickFirstIpv4(raw: string): string | null {
  const m = raw.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/)
  if (!m) return null
  const ip = m[1]
  const parts = ip.split('.').map((x) => Number(x))
  if (parts.length !== 4) return null
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return ip
}

function parseVmImport(raw: string): {
  name: string
  ip: string
  provider: string
  tags: string
  notes: string
  warnings: string[]
} {
  const sanitized = sanitizeSensitiveText(raw)
  const warnings: string[] = []

  if (raw.toLowerCase().includes('password')) warnings.push('已忽略含 password 的內容（不保存密碼）。')

  const ip = pickFirstIpv4(sanitized) || ''
  const vncMatch = sanitized.match(/\bVNC\s*:\s*([0-9.]+)\s*:\s*(\d{2,6})\b/i)
  const vnc = vncMatch ? `${vncMatch[1]}:${vncMatch[2]}` : ''

  const providerMatch = sanitized.match(/\bOpenClaw\s*[-–]\s*([^\s]+)\b/i)
  const provider = providerMatch ? providerMatch[1] : 'proxmox'

  const userMatch = sanitized.match(/\bUser\s*:\s*([^\s]+)\b/i)
  const loginUser = userMatch ? userMatch[1] : ''

  const lines = sanitized
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const firstCandidate = lines.find((l) => !/\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(l) && !/^vnc\s*:/i.test(l) && !/^user\s*:/i.test(l))
  let name = firstCandidate || ''
  name = name.replace(/^#+\s*/, '').replace(/\s{2,}/g, ' ').trim()
  if (!name) name = ip ? `vm-${ip}` : 'vm'

  const forMatch = sanitized.match(/\bfor\s+([A-Za-z0-9_-]{2,32})\b/i)
  const ownerTag = forMatch ? forMatch[1].toLowerCase() : ''
  const tags = ['openclaw', ownerTag].filter(Boolean).join(',')

  const notesParts: string[] = []
  if (vnc) notesParts.push(`VNC: ${vnc}`)
  if (loginUser) notesParts.push(`User: ${loginUser}`)
  if (!ip) warnings.push('未偵測到 IP，請手動補上。')

  return {
    name,
    ip,
    provider,
    tags,
    notes: notesParts.join('\n'),
    warnings,
  }
}

export function ConfirmDialog({
  title,
  description,
  confirmText,
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  confirmText: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[520px] rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="px-5 py-4">
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-sm text-slate-600">{description}</div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button onClick={onConfirm} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CreateVmDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (vm: VM) => void }) {
  const user = useAdminStore((s) => s.user)
  const [name, setName] = useState('')
  const [ip, setIp] = useState('')
  const [provider, setProvider] = useState('proxmox')
  const [tags, setTags] = useState('openclaw')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const vm = await adminApi.createVm(user, {
        name,
        ip_address: ip,
        provider,
        tags: tags
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        status: 'unknown',
      })
      onCreated(vm)
      onClose()
    } catch (e) {
      setError(String((e as Error).message || 'ERROR'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[680px] rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-sm font-semibold">新增 VM</div>
          <div className="mt-1 text-xs text-slate-600">用於管理 Ansible inventory 與 VM 關聯。</div>
        </div>

        <div className="px-5 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-slate-600">名稱 *</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="openclaw-004"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600">IP</div>
              <input
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="10.10.0.14"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600">Provider</div>
              <input
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="proxmox"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600">Tags（逗號分隔）</div>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="openclaw,prod"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
              />
            </div>
          </div>

          {error ? <div className="mt-4 text-sm text-rose-700">{error}</div> : null}

          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              disabled={saving || !name.trim()}
              onClick={() => void save()}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                !saving && name.trim() ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
              }`}
            >
              {saving ? '建立中…' : '建立'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ImportVmDialog({ onClose, onImported }: { onClose: () => void; onImported: (vm: VM) => void }) {
  const user = useAdminStore((s) => s.user)
  const [raw, setRaw] = useState('')
  const parsed = useMemo(() => parseVmImport(raw), [raw])

  const [name, setName] = useState('')
  const [ip, setIp] = useState('')
  const [provider, setProvider] = useState('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function applyParsed() {
    setName(parsed.name)
    setIp(parsed.ip)
    setProvider(parsed.provider)
    setTags(parsed.tags)
    setNotes(parsed.notes)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const vm = await adminApi.createVm(user, {
        name: name.trim(),
        ip_address: ip.trim() || undefined,
        provider: provider.trim() || undefined,
        tags: tags
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        notes: notes.trim() || undefined,
        status: 'unknown',
      })
      onImported(vm)
      onClose()
    } catch (e) {
      setError(String((e as Error).message || 'ERROR'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[920px] rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-sm font-semibold">匯入 VM 資料</div>
          <div className="mt-1 text-xs text-slate-600">可貼上供應商/工單內容自動解析；含 password 的內容會被忽略且不保存。</div>
        </div>

        <div className="grid grid-cols-1 gap-6 px-5 py-5 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-slate-600">原始內容</div>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={14}
              placeholder="貼上 VM 資訊（建議不要包含密碼）"
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-xs outline-none"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setRaw(sanitizeSensitiveText(raw))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                移除 password 行
              </button>
              <button
                onClick={() => applyParsed()}
                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                套用解析結果
              </button>
            </div>

            {parsed.warnings.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                {parsed.warnings.join(' ')}
              </div>
            ) : null}
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-600">建立 VM</div>
            <div className="mt-2 grid grid-cols-1 gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-600">名稱 *</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={parsed.name}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-slate-600">IP</div>
                  <input
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder={parsed.ip || '10.10.0.14'}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Provider</div>
                  <input
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    placeholder={parsed.provider}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600">Tags（逗號分隔）</div>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder={parsed.tags}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600">Notes</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder={parsed.notes}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-xs outline-none"
                />
              </div>
            </div>

            {error ? <div className="mt-4 text-sm text-rose-700">{error}</div> : null}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                disabled={saving || !name.trim()}
                onClick={() => void save()}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  !saving && name.trim() ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
                }`}
              >
                {saving ? '建立中…' : '建立 VM'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CreateInventoryDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (inv: Inventory) => void }) {
  const user = useAdminStore((s) => s.user)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [varsText, setVarsText] = useState('{\n  "ansible_user": "ubuntu"\n}')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const vars = (varsText.trim() ? (JSON.parse(varsText) as Record<string, unknown>) : {})
      const inv = await adminApi.createInventory(user, { name, description, vars })
      onCreated(inv)
      onClose()
    } catch (e) {
      setError(String((e as Error).message || 'ERROR'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[720px] rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-sm font-semibold">新增 Inventory</div>
          <div className="mt-1 text-xs text-slate-600">用於管理 Ansible inventory（含 vars / hosts）。</div>
        </div>

        <div className="px-5 py-5">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-600">名稱 *</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="openclaw-prod"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600">描述</div>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="OpenClaw 生產環境"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600">Vars（JSON）</div>
              <textarea
                value={varsText}
                onChange={(e) => setVarsText(e.target.value)}
                rows={8}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-xs outline-none"
              />
              <div className="mt-1 text-xs text-slate-500">會在建立時進行 JSON 驗證。</div>
            </div>
          </div>

          {error ? <div className="mt-4 text-sm text-rose-700">{error}</div> : null}

          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              disabled={saving || !name.trim()}
              onClick={() => void save()}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                !saving && name.trim() ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
              }`}
            >
              {saving ? '建立中…' : '建立'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
