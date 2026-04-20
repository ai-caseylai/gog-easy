import { Link } from 'react-router-dom'
import { Monitor, TerminalSquare, Trash2 } from 'lucide-react'
import type { Inventory, VM } from '../../mocks/adminTypes'

function isoToShort(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleString()
}

export function VmTable({ vms, onDelete }: { vms: VM[]; onDelete: (id: string, name: string) => void }) {
  return (
    <div>
      <div className="grid grid-cols-12 gap-2 border-b border-slate-200 px-5 py-3 text-xs font-semibold text-slate-600">
        <div className="col-span-4">Name</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">IP</div>
        <div className="col-span-2">Updated</div>
        <div className="col-span-2 text-right">Actions</div>
      </div>
      <div className="divide-y divide-slate-100">
        {vms.map((v) => (
          <div key={v.id} className="grid grid-cols-12 gap-2 px-5 py-4">
            <div className="col-span-4">
              <Link
                to={`/admin/vms/${encodeURIComponent(v.id)}/ssh`}
                className={`text-sm font-semibold ${v.ip_address ? 'text-slate-900 hover:underline' : 'text-slate-400'}`}
              >
                {v.name}
              </Link>
              <div className="mt-0.5 font-mono text-xs text-slate-600">{v.id}</div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs">
                <Link to={`/admin/vms/${encodeURIComponent(v.id)}`} className="font-semibold text-slate-700 hover:underline">
                  設定
                </Link>
                <Link
                  to={`/admin/vms/${encodeURIComponent(v.id)}/vnc`}
                  className="font-semibold text-slate-700 hover:underline"
                >
                  VNC
                </Link>
              </div>
            </div>
            <div className="col-span-2 flex items-center text-xs text-slate-700">{v.status}</div>
            <div className="col-span-2 flex items-center font-mono text-xs text-slate-700">{v.ip_address || '-'}</div>
            <div className="col-span-2 flex items-center text-xs text-slate-600">{isoToShort(v.updated_at)}</div>
            <div className="col-span-2 flex items-center justify-end gap-2">
              <Link
                to={`/admin/vms/${encodeURIComponent(v.id)}/ssh`}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                  v.ip_address ? 'bg-slate-900 text-white hover:bg-slate-800' : 'pointer-events-none bg-slate-100 text-slate-400'
                }`}
              >
                <TerminalSquare className="h-4 w-4" />
                SSH
              </Link>
              <Link
                to={`/admin/vms/${encodeURIComponent(v.id)}/vnc`}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
              >
                <Monitor className="h-4 w-4" />
              </Link>
              <button
                onClick={() => onDelete(v.id, v.name)}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {vms.length === 0 ? <div className="p-5 text-sm text-slate-600">目前沒有 VM。</div> : null}
      </div>
    </div>
  )
}

export function InventoryTable({
  inventories,
  onDelete,
}: {
  inventories: Array<Inventory & { hostsCount: number }>
  onDelete: (id: string, name: string) => void
}) {
  return (
    <div>
      <div className="grid grid-cols-12 gap-2 border-b border-slate-200 px-5 py-3 text-xs font-semibold text-slate-600">
        <div className="col-span-5">Name</div>
        <div className="col-span-2">Hosts</div>
        <div className="col-span-4">Updated</div>
        <div className="col-span-1 text-right">Actions</div>
      </div>
      <div className="divide-y divide-slate-100">
        {inventories.map((inv) => (
          <div key={inv.id} className="grid grid-cols-12 gap-2 px-5 py-4">
            <div className="col-span-5">
              <Link to={`/admin/inventories/${encodeURIComponent(inv.id)}`} className="text-sm font-semibold text-slate-900 hover:underline">
                {inv.name}
              </Link>
              <div className="mt-0.5 font-mono text-xs text-slate-600">{inv.id}</div>
            </div>
            <div className="col-span-2 flex items-center text-xs text-slate-700">{inv.hostsCount}</div>
            <div className="col-span-4 flex items-center text-xs text-slate-600">{isoToShort(inv.updated_at)}</div>
            <div className="col-span-1 flex items-center justify-end">
              <button
                onClick={() => onDelete(inv.id, inv.name)}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {inventories.length === 0 ? <div className="p-5 text-sm text-slate-600">目前沒有 Inventory。</div> : null}
      </div>
    </div>
  )
}
