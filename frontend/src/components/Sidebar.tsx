import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Server,
  Key,
  Share2,
  Code2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Terminal,
  LogOut,
  LayoutGrid,
  FolderSync,
  Sun,
  Moon,
  Shield,
} from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'
import clsx from 'clsx'

const navItems = [
  { path: '/hosts', icon: Server, label: 'Hosts' },
  { path: '/keychain', icon: Key, label: 'Keychain' },
  { path: '/locker', icon: Shield, label: 'Locker' },
  { path: '/port-forwarding', icon: Share2, label: 'Port Forwarding' },
  { path: '/snippets', icon: Code2, label: 'Snippets' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { sidebarCollapsed, toggleSidebar, theme, toggleTheme } = useAppStore()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 64 : 256 }}
      className="fixed left-0 top-0 h-full bg-white dark:bg-dark-850 border-r border-gray-200 dark:border-dark-700/50 z-40 flex flex-col"
    >
      <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-dark-700/50">
        <AnimatePresence mode="wait">
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-cyan flex items-center justify-center shadow-lg shadow-primary-500/30">
                <span className="text-white font-logo font-bold text-2xl">#</span>
              </div>
              <div className="pl-0.5">
                <h1 className="font-logo font-bold text-xl text-gray-900 dark:text-white tracking-tight">binsh</h1>
                <p className="text-[10px] text-gray-500 dark:text-dark-400 -mt-0.5 pl-[1px]">SSH Client</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {sidebarCollapsed && (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-cyan flex items-center justify-center shadow-lg shadow-primary-500/30 mx-auto">
            <span className="text-white font-logo font-bold text-xl">#</span>
          </div>
        )}

        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-700/50 text-gray-500 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
      </div>

      {sidebarCollapsed && (
        <button
          onClick={toggleSidebar}
          className="p-3 flex justify-center text-gray-500 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white transition-colors border-b border-gray-200 dark:border-dark-700/50"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200 group relative',
                sidebarCollapsed ? 'justify-center px-2' : 'px-3',
                isActive
                  ? 'bg-primary-500/10 dark:bg-gradient-to-r dark:from-primary-500/20 dark:to-transparent text-primary-500 dark:text-primary-400 shadow-lg shadow-primary-500/5'
                  : 'text-gray-600 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700/30'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && !sidebarCollapsed && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-500 rounded-r-full"
                  />
                )}
                <div className={clsx(
                  'relative flex items-center justify-center',
                  sidebarCollapsed && isActive && 'after:absolute after:inset-0 after:rounded-lg after:ring-2 after:ring-primary-500/50'
                )}>
                  <item.icon className={clsx(
                    'w-5 h-5 flex-shrink-0 transition-colors',
                    isActive ? 'text-primary-500 dark:text-primary-400' : 'group-hover:text-primary-500 dark:group-hover:text-primary-400'
                  )} />
                </div>
                <AnimatePresence mode="wait">
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="font-medium text-sm whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            )}
          </NavLink>
        ))}

        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-dark-700/50 space-y-1">
          <button
            onClick={() => navigate('/terminal/local')}
            className={clsx(
              'w-full flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200',
              sidebarCollapsed ? 'justify-center px-2' : 'px-3',
              'text-gray-600 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700/30 group'
            )}
          >
            <Terminal className="w-5 h-5 flex-shrink-0 group-hover:text-accent-cyan transition-colors" />
            <AnimatePresence mode="wait">
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="font-medium text-sm whitespace-nowrap"
                >
                  Local Terminal
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          <button
            onClick={() => navigate('/multi-terminal')}
            className={clsx(
              'w-full flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200',
              sidebarCollapsed ? 'justify-center px-2' : 'px-3',
              'text-gray-600 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700/30 group'
            )}
          >
            <LayoutGrid className="w-5 h-5 flex-shrink-0 group-hover:text-primary-400 transition-colors" />
            <AnimatePresence mode="wait">
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="font-medium text-sm whitespace-nowrap"
                >
                  Multi Terminal
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          <button
            onClick={() => navigate('/sftp')}
            className={clsx(
              'w-full flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200',
              sidebarCollapsed ? 'justify-center px-2' : 'px-3',
              'text-gray-600 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700/30 group'
            )}
          >
            <FolderSync className="w-5 h-5 flex-shrink-0 group-hover:text-accent-purple transition-colors" />
            <AnimatePresence mode="wait">
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="font-medium text-sm whitespace-nowrap"
                >
                  SFTP Manager
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </nav>

      <div className="p-3 border-t border-gray-200 dark:border-dark-700/50">
        <div className={clsx(
          'flex items-center gap-3 p-2 rounded-xl bg-gray-100 dark:bg-dark-800/50',
          sidebarCollapsed ? 'justify-center' : ''
        )}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user?.name || user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-dark-400 truncate">{user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {!sidebarCollapsed && (
            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-500 dark:text-dark-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-500 dark:text-dark-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
