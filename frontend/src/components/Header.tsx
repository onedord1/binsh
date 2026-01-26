import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  ChevronDown,
  Server,
  FolderPlus,
  Terminal,
  Import,
  Download,
  Cloud,
} from 'lucide-react'
import { useAppStore } from '../stores/appStore'

const quickActions = [
  { id: 'new-host', label: 'New Host', icon: Server, color: 'from-primary-500 to-accent-cyan' },
  { id: 'new-group', label: 'New Group', icon: FolderPlus, color: 'from-accent-purple to-accent-pink' },
  { id: 'terminal', label: 'Local Terminal', icon: Terminal, color: 'from-accent-green to-accent-cyan' },
  { id: 'import', label: 'Import Hosts', icon: Import, color: 'from-accent-orange to-accent-pink' },
  { id: 'export', label: 'Export Hosts', icon: Download, color: 'from-green-500 to-accent-cyan' },
  { id: 'cloud', label: 'Cloud Sync', icon: Cloud, color: 'from-accent-cyan to-primary-500' },
]

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { searchQuery, setSearchQuery, openHostPanel, openGroupPanel, openImportModal, openExportModal, openCloudSyncModal } = useAppStore()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleQuickAction = (actionId: string) => {
    setShowDropdown(false)
    switch (actionId) {
      case 'new-host':
        openHostPanel('create')
        break
      case 'new-group':
        openGroupPanel('create')
        break
      case 'terminal':
        navigate('/terminal/local')
        break
      case 'import':
        openImportModal()
        break
      case 'export':
        openExportModal()
        break
      case 'cloud':
        openCloudSyncModal()
        break
    }
  }

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/hosts':
        return 'Hosts'
      case '/keychain':
        return 'Keychain'
      case '/port-forwarding':
        return 'Port Forwarding'
      case '/snippets':
        return 'Snippets'
      case '/settings':
        return 'Settings'
      default:
        return 'Dashboard'
    }
  }

  return (
    <header className="h-16 bg-white/80 dark:bg-dark-850/80 backdrop-blur-xl border-b border-gray-200 dark:border-dark-700/50 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{getPageTitle()}</h2>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-dark-400" />
          <input
            type="text"
            placeholder="Search hosts, groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-80 pl-10 pr-4 py-2 bg-gray-100 dark:bg-dark-800/50 border border-gray-200 dark:border-dark-700/50 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-all"
          />
          {searchQuery && (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-dark-500 bg-gray-200 dark:bg-dark-700 px-1.5 py-0.5 rounded">
              ESC
            </kbd>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="btn btn-primary gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700/50 rounded-xl shadow-2xl shadow-gray-200/50 dark:shadow-dark-950/50 overflow-hidden z-50"
              >
                <div className="p-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleQuickAction(action.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700/50 transition-colors group"
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg`}>
                        <action.icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-dark-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                        {action.label}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
