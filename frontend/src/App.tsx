import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Hosts from './pages/Hosts'
import Terminal from './pages/Terminal'
import MultiTerminal from './pages/MultiTerminal'
import Keychain from './pages/Keychain'
import Snippets from './pages/Snippets'
import PortForwarding from './pages/PortForwarding'
import Settings from './pages/Settings'
import Locker from './pages/Locker'
import KnownHosts from './pages/KnownHosts'
import ConnectionStatus from './pages/ConnectionStatus'
import SFTPManagerMulti from './pages/SFTPManagerMulti'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-dark-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-dark-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/hosts" replace />} />
        <Route path="hosts" element={<Hosts />} />
        <Route path="known-hosts" element={<KnownHosts />} />
        <Route path="keychain" element={<Keychain />} />
        <Route path="port-forwarding" element={<PortForwarding />} />
        <Route path="snippets" element={<Snippets />} />
        <Route path="settings" element={<Settings />} />
        <Route path="locker" element={<Locker />} />
      </Route>
      <Route
        path="/terminal/:hostId"
        element={
          <ProtectedRoute>
            <Terminal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/multi-terminal"
        element={
          <ProtectedRoute>
            <MultiTerminal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/multi-terminal/:hostId"
        element={
          <ProtectedRoute>
            <MultiTerminal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/connect/:hostId"
        element={
          <ProtectedRoute>
            <ConnectionStatus />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sftp"
        element={
          <ProtectedRoute>
            <SFTPManagerMulti />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
