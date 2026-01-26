import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Maximize2,
  Minimize2,
  Palette,
  ChevronDown,
} from 'lucide-react'
import TabBar from '../components/terminal/TabBar'
import SplitPane from '../components/terminal/SplitPane'
import HostSelector from '../components/terminal/HostSelector'
import { useTerminalStore } from '../stores/terminalStore'
import { useAppStore } from '../stores/appStore'
import { terminalThemes, themeDisplayNames, darkThemes, lightThemes } from '../lib/terminalThemes'

export default function MultiTerminal() {
  const { hostId } = useParams<{ hostId: string }>()
  const navigate = useNavigate()
  const { terminalZenMode, toggleZenMode } = useAppStore()

  const {
    tabs,
    broadcastMode,
    createTab,
    addSession,
    splitPane,
    getActiveTab,
    focusedPaneId,
  } = useTerminalStore()

  const [currentTheme, setCurrentTheme] = useState<string>('binsh-dark')
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [showHostSelector, setShowHostSelector] = useState(false)
  const [pendingPaneId, setPendingPaneId] = useState<string | null>(null)

  // Initialize with a tab if opening with a hostId or if no tabs exist
  useEffect(() => {
    if (tabs.length === 0) {
      createTab('Terminal')
    }
  }, [])

  // Handle initial host connection
  useEffect(() => {
    if (hostId && tabs.length > 0) {
      const activeTab = getActiveTab()
      if (activeTab && activeTab.rootPane.sessions.length === 0) {
        if (hostId === 'local') {
          addSession(activeTab.id, activeTab.rootPane.id, 'local', 'Local Shell', 'localhost', true)
        } else {
          // Open host selector to get host details
          setPendingPaneId(activeTab.rootPane.id)
          setShowHostSelector(true)
        }
      }
    }
  }, [hostId, tabs.length])

  const [addToNewTab, setAddToNewTab] = useState(false)

  const handleAddHost = () => {
    // "Add Host to Tab" creates a NEW tab
    setAddToNewTab(true)
    setShowHostSelector(true)
  }

  const handleAddSession = (paneId: string) => {
    // Adding session to existing pane (from split view or empty pane)
    setAddToNewTab(false)
    setPendingPaneId(paneId)
    setShowHostSelector(true)
  }

  const handleHostSelect = (selectedHostId: string, hostLabel: string, hostAddress: string, isLocal: boolean) => {
    if (addToNewTab) {
      // Create new tab and add session to it
      const newTabId = createTab(hostLabel)
      const newTab = tabs.find(t => t.id === newTabId) || getActiveTab()
      if (newTab) {
        addSession(newTabId, newTab.rootPane.id, selectedHostId, hostLabel, hostAddress, isLocal)
      }
    } else {
      // Add to existing pane
      const activeTab = getActiveTab()
      if (activeTab && pendingPaneId) {
        addSession(activeTab.id, pendingPaneId, selectedHostId, hostLabel, hostAddress, isLocal)
      }
    }
    setPendingPaneId(null)
    setAddToNewTab(false)
  }

  const handleSplitHorizontal = () => {
    const activeTab = getActiveTab()
    if (activeTab && focusedPaneId) {
      splitPane(activeTab.id, focusedPaneId, 'horizontal')
    }
  }

  const handleSplitVertical = () => {
    const activeTab = getActiveTab()
    if (activeTab && focusedPaneId) {
      splitPane(activeTab.id, focusedPaneId, 'vertical')
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+T: New tab
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        createTab('New Tab')
      }
      // Ctrl+Shift+H: Split horizontal
      if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        e.preventDefault()
        handleSplitHorizontal()
      }
      // Ctrl+Shift+V: Split vertical
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault()
        handleSplitVertical()
      }
      // Escape: Exit zen mode
      if (e.key === 'Escape' && terminalZenMode) {
        toggleZenMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [terminalZenMode, focusedPaneId])

  const activeTab = getActiveTab()

  return (
    <div className={`h-screen bg-dark-900 flex flex-col ${terminalZenMode ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <motion.header
        initial={false}
        animate={{ height: terminalZenMode ? 0 : 'auto', opacity: terminalZenMode ? 0 : 1 }}
        className="bg-dark-850 border-b border-dark-700/50 overflow-hidden"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-dark-700/50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/hosts')}
              className="p-2 rounded-lg hover:bg-dark-700/50 text-dark-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="font-medium text-white">Terminal</span>
            {broadcastMode && (
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                BROADCAST MODE
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Theme selector */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="p-2 rounded-lg hover:bg-dark-700/50 text-dark-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <Palette className="w-4 h-4" />
                <ChevronDown className="w-3 h-3" />
              </button>

              <AnimatePresence>
                {showThemeMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="fixed top-14 right-12 w-48 bg-dark-800 border border-dark-700 rounded-xl shadow-xl z-[9999] max-h-96 overflow-y-auto"
                    onMouseLeave={() => setShowThemeMenu(false)}
                  >
                    <div className="px-3 py-2 text-xs font-semibold text-dark-400 border-b border-dark-700">Dark Themes</div>
                    {darkThemes.map((theme) => (
                      <button
                        key={theme}
                        onClick={() => {
                          setCurrentTheme(theme)
                          setShowThemeMenu(false)
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                          currentTheme === theme
                            ? 'bg-primary-500/10 text-primary-400'
                            : 'text-dark-200 hover:bg-dark-700/50'
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded border border-dark-600"
                          style={{ backgroundColor: terminalThemes[theme]?.background }}
                        />
                        <span>{themeDisplayNames[theme]}</span>
                      </button>
                    ))}
                    <div className="px-3 py-2 text-xs font-semibold text-dark-400 border-b border-t border-dark-700">Light Themes</div>
                    {lightThemes.map((theme) => (
                      <button
                        key={theme}
                        onClick={() => {
                          setCurrentTheme(theme)
                          setShowThemeMenu(false)
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                          currentTheme === theme
                            ? 'bg-primary-500/10 text-primary-400'
                            : 'text-dark-200 hover:bg-dark-700/50'
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded border border-dark-600"
                          style={{ backgroundColor: terminalThemes[theme]?.background }}
                        />
                        <span>{themeDisplayNames[theme]}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Zen mode */}
            <button
              onClick={toggleZenMode}
              className="p-2 rounded-lg hover:bg-dark-700/50 text-dark-400 hover:text-white transition-colors"
              title={terminalZenMode ? 'Exit Zen Mode' : 'Zen Mode'}
            >
              {terminalZenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <TabBar
          onSplitHorizontal={handleSplitHorizontal}
          onSplitVertical={handleSplitVertical}
          onAddHost={handleAddHost}
        />
      </motion.header>

      {/* Terminal area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab ? (
          <SplitPane
            pane={activeTab.rootPane}
            tabId={activeTab.id}
            theme={terminalThemes[currentTheme]}
            onAddSession={handleAddSession}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-dark-400">
            No terminal tabs open. Press the + button to create one.
          </div>
        )}
      </div>

      {/* Zen mode overlay controls */}
      {terminalZenMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed top-4 right-4 flex items-center gap-2 z-[60]"
        >
          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="p-2 rounded-lg bg-dark-800/80 backdrop-blur text-dark-400 hover:text-white transition-colors"
            >
              <Palette className="w-5 h-5" />
            </button>
            <AnimatePresence>
              {showThemeMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="fixed top-14 right-4 w-48 bg-dark-800 border border-dark-700 rounded-xl shadow-xl z-[9999] max-h-80 overflow-y-auto"
                  onMouseLeave={() => setShowThemeMenu(false)}
                >
                  {Object.keys(terminalThemes).map((theme) => (
                    <button
                      key={theme}
                      onClick={() => {
                        setCurrentTheme(theme)
                        setShowThemeMenu(false)
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                        currentTheme === theme
                          ? 'bg-primary-500/10 text-primary-400'
                          : 'text-dark-200 hover:bg-dark-700/50'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: terminalThemes[theme].background }}
                      />
                      <span className="capitalize">{theme.replace(/-/g, ' ')}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            className="p-2 rounded-lg bg-dark-800/80 backdrop-blur text-dark-400 hover:text-white transition-colors"
            onClick={toggleZenMode}
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        </motion.div>
      )}

      {/* Host Selector Modal */}
      <HostSelector
        isOpen={showHostSelector}
        onClose={() => {
          setShowHostSelector(false)
          setPendingPaneId(null)
        }}
        onSelect={handleHostSelect}
      />
    </div>
  )
}
