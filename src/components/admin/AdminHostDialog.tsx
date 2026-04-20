import { useMemo, useState } from 'react'
import type { InventoryHost, VM } from '../../mocks/adminTypes'

export default function AdminHostDialog({
  title,
  initial,
  vms,
  onClose,
  onSave,
}: {
  title: string
  initial?: Partial<InventoryHost>
  vms: VM[]
  onClose: () => void
  onSave: (input: { id?: string; hostname: string; ansible_host?: string; vm_id?: string; vars: Record<string, unknown> }) => Promise<void>
}) {
  const [hostname, setHostname] = useState(initial?.hostname || '')
  const [ansibleHost, setAnsibleHost] = useState(initial?.ansible_host || '')
  const [vmId, setVmId] = useState(initial?.vm_id || '')
  const [varsText, setVarsText] = useState(JSON.stringify((initial?.vars || {}) as Record<string, unknown>, null, 2) || '{}')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = useMemo(() => hostname.trim().length > 0 && !saving, [hostname, saving])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const vars = (varsText.trim() ? (JSON.parse(varsText) as Record<string, unknown>) : {})
      await onSave({
        id: initial?.id,
        hostname,
        ansible_host: ansibleHost.trim() || undefined,
        vm_id: vmId.trim() || undefined,
        vars,
      })
      onClose()
    } catch (e) {
      setError(String((e as Error).message || 'ERROR'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[760px] rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-xs text-slate-600">用於維護 inventory 的 hosts 與 vars。</div>
        </div>
        <div className="px-5 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-slate-600">hostname *</div>
              <input
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="openclaw-001"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600">ansible_host</div>
              <input
                value={ansibleHost}
                onChange={(e) => setAnsibleHost(e.target.value)}
                placeholder="10.10.0.11"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <div className="text-xs font-semibold text-slate-600">關聯 VM（可選）</div>
              <select
                value={vmId}
                onChange={(e) => setVmId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="">不關聯</option>
                {vms.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs font-semibold text-slate-600">vars（JSON）</div>
              <textarea
                value={varsText}
                onChange={(e) => setVarsText(e.target.value)}
                rows={8}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-xs outline-none"
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
              disabled={!canSave}
              onClick={() => void save()}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                canSave ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
              }`}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

