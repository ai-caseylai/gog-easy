import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAdminStore } from '../../stores/useAdminStore'

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, hydrate, hydrated, loading } = useAdminStore()
  const loc = useLocation()

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (!hydrated || loading) return <div className="min-h-screen bg-slate-50" />
  if (!user) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />
  return <>{children}</>
}
