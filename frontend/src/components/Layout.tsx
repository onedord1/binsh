import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import SidePanel from './SidePanel'
import { useAppStore } from '../stores/appStore'

export default function Layout() {
  const { sidebarCollapsed, sidePanel } = useAppStore()

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-dark-900 overflow-hidden">
      <Sidebar />
      
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <Header />
        
        <main className="flex-1 overflow-hidden relative">
          <div className="h-full overflow-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {sidePanel.type && <SidePanel />}
    </div>
  )
}
