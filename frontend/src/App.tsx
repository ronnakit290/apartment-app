import Landing from './pages/Landing'
import Login from './pages/Login'
import DashboardLayout from './pages/dashboard/Layout'
import { AuthProvider, useAuth } from './lib/auth'
import { Loading, ToastProvider, useHashPath } from './lib/ui'

function Dashboard({ path }: { path: string }) {
  const { user, ready } = useAuth()
  if (!ready) return <div className="login-page"><Loading /></div>
  return user ? <DashboardLayout path={path} /> : <Login />
}

export default function App() {
  const path = useHashPath()
  return (
    <ToastProvider>
      <AuthProvider>
        {path.startsWith('/app') ? <Dashboard path={path} /> : <Landing />}
      </AuthProvider>
    </ToastProvider>
  )
}
