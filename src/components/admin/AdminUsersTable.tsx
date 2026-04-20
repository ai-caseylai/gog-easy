import type { AdminManagedUser } from './AdminUserDialogs'

export default function AdminUsersTable({
  users,
  onEdit,
  onDelete,
}: {
  users: AdminManagedUser[]
  onEdit: (u: AdminManagedUser) => void
  onDelete: (u: AdminManagedUser) => void
}) {
  return (
    <div>
      <div className="grid grid-cols-12 gap-2 border-b border-slate-200 px-5 py-3 text-xs font-semibold text-slate-600">
        <div className="col-span-6">Email</div>
        <div className="col-span-2">Role</div>
        <div className="col-span-2">Updated</div>
        <div className="col-span-2 text-right">Actions</div>
      </div>
      <div className="divide-y divide-slate-100">
        {users.map((u) => (
          <div key={u.id} className="grid grid-cols-12 gap-2 px-5 py-4">
            <div className="col-span-6">
              <div className="text-sm font-semibold text-slate-900">{u.email}</div>
              <div className="mt-0.5 font-mono text-xs text-slate-600">{u.id}</div>
            </div>
            <div className="col-span-2 flex items-center text-xs text-slate-700">{u.role}</div>
            <div className="col-span-2 flex items-center text-xs text-slate-600">{new Date(u.updated_at).toLocaleString()}</div>
            <div className="col-span-2 flex items-center justify-end gap-2">
              <button
                onClick={() => onEdit(u)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                編輯
              </button>
              <button
                onClick={() => onDelete(u)}
                className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                刪除
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 ? <div className="p-5 text-sm text-slate-600">尚無用戶。</div> : null}
      </div>
    </div>
  )
}

