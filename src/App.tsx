import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import OAuthProcessing from './pages/OAuthProcessing'
import Dashboard from './pages/Dashboard'
import Setup from './pages/Setup'
import Twilio from './pages/Twilio'
import OpenClawSettings from './pages/OpenClawSettings'
import SystemStatus from './pages/SystemStatus'
import Billing from './pages/Billing'
import Fleet from './pages/Fleet'
import AdminLogin from './pages/AdminLogin'
import AdminConsole from './pages/AdminConsole'
import AdminVmDetail from './pages/AdminVmDetail'
import AdminInventoryDetail from './pages/AdminInventoryDetail'
import AdminSshConsole from './pages/AdminSshConsole'
import AdminVncConsole from './pages/AdminVncConsole'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/twilio" element={<Twilio />} />
        <Route path="/openclaw" element={<OpenClawSettings />} />
        <Route path="/oauth/processing" element={<OAuthProcessing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/fleet" element={<Fleet />} />
        <Route path="/system-status" element={<SystemStatus />} />
        <Route path="/billing" element={<Billing />} />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminConsole />} />
        <Route path="/admin/vms/:id" element={<AdminVmDetail />} />
        <Route path="/admin/vms/:id/ssh" element={<AdminSshConsole />} />
        <Route path="/admin/vms/:id/vnc" element={<AdminVncConsole />} />
        <Route path="/admin/inventories/:id" element={<AdminInventoryDetail />} />
      </Routes>
    </Router>
  )
}
