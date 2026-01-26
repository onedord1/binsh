import { useCallback, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import TerminalPane from './TerminalPane'
import { useTerminalStore, type SplitPane as SplitPaneType } from '../../stores/terminalStore'

interface SplitPaneProps {
  pane: SplitPaneType
  tabId: string
  theme: Record<string, string>
  onAddSession: (paneId: string) => void
  isInSplit?: boolean
}

export default function SplitPane({
  pane,
  tabId,
  theme,
  onAddSession,
  isInSplit = false,
}: SplitPaneProps) {
  const { 
    focusedPaneId, 
    focusedSessionId, 
    setFocusedPane, 
    removeSession,
    resizePane,
    closeEmptyPane,
  } = useTerminalStore()

  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault()
    setIsDragging(true)

    const startX = e.clientX
    const startY = e.clientY
    const container = containerRef.current
    if (!container || !pane.children) return

    const isHorizontal = pane.splitDirection === 'horizontal'
    const containerRect = container.getBoundingClientRect()
    const totalSize = isHorizontal ? containerRect.width : containerRect.height
    const startSize = pane.children[index].size

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = isHorizontal
        ? moveEvent.clientX - startX
        : moveEvent.clientY - startY
      const deltaPercent = (delta / totalSize) * 100
      const newSize = Math.max(10, Math.min(90, startSize + deltaPercent))

      if (pane.children && pane.children[index]) {
        resizePane(tabId, pane.children[index].id, newSize)
        if (pane.children[index + 1]) {
          resizePane(tabId, pane.children[index + 1].id, 100 - newSize)
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [pane, tabId, resizePane])

  // Render split children
  if (pane.children && pane.children.length > 0) {
    const isHorizontal = pane.splitDirection === 'horizontal'

    return (
      <div
        ref={containerRef}
        className={`flex w-full h-full ${isHorizontal ? 'flex-row' : 'flex-col'}`}
      >
        {pane.children.map((child, index) => (
          <div key={child.id} className="flex" style={{ flex: `0 0 ${child.size}%` }}>
            <div className="flex-1 min-w-0 min-h-0">
              <SplitPane
                pane={child}
                tabId={tabId}
                theme={theme}
                onAddSession={onAddSession}
                isInSplit={true}
              />
            </div>
            {index < pane.children!.length - 1 && (
              <div
                className={`flex-shrink-0 ${
                  isHorizontal
                    ? 'w-1 cursor-col-resize hover:bg-primary-500/50'
                    : 'h-1 cursor-row-resize hover:bg-primary-500/50'
                } bg-dark-700 transition-colors ${isDragging ? 'bg-primary-500' : ''}`}
                onMouseDown={(e) => handleMouseDown(e, index)}
              />
            )}
          </div>
        ))}
      </div>
    )
  }

  // Render sessions in this pane
  if (pane.sessions.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-dark-850 relative">
        {/* Close button for empty panes in splits */}
        {isInSplit && (
          <button
            onClick={() => closeEmptyPane(tabId, pane.id)}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-dark-700/50 hover:bg-dark-600 text-dark-400 hover:text-white transition-colors"
            title="Close this pane"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onAddSession(pane.id)}
          className="flex flex-col items-center gap-3 p-8 rounded-xl bg-dark-800/50 border border-dark-700/50 hover:border-primary-500/50 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center">
            <Plus className="w-6 h-6 text-primary-400" />
          </div>
          <span className="text-dark-300">Add Terminal Session</span>
        </motion.button>
      </div>
    )
  }

  // Single or multiple sessions in one pane (tabbed within pane)
  const activeSession = pane.sessions.find((s) => s.id === pane.activeSessionId) || pane.sessions[0]
  const isFocused = focusedPaneId === pane.id && focusedSessionId === activeSession?.id

  return (
    <div className="w-full h-full flex flex-col">
      {/* Session tabs within pane (if multiple sessions) */}
      {pane.sessions.length > 1 && (
        <div className="flex items-center gap-1 px-1 py-1 bg-dark-850 border-b border-dark-700/50 overflow-x-auto">
          {pane.sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setFocusedPane(pane.id, session.id)}
              className={`flex items-center gap-2 px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                session.id === pane.activeSessionId
                  ? 'bg-dark-700 text-white'
                  : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${session.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="truncate max-w-[100px]">{session.hostLabel}</span>
            </button>
          ))}
          <button
            onClick={() => onAddSession(pane.id)}
            className="p-1 text-dark-400 hover:text-white hover:bg-dark-700/50 rounded transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Active terminal */}
      <div className="flex-1 min-h-0">
        {activeSession && (
          <TerminalPane
            key={activeSession.id}
            session={activeSession}
            paneId={pane.id}
            tabId={tabId}
            theme={theme}
            isFocused={isFocused}
            onFocus={() => setFocusedPane(pane.id, activeSession.id)}
            onClose={() => removeSession(tabId, pane.id, activeSession.id)}
          />
        )}
      </div>
    </div>
  )
}
