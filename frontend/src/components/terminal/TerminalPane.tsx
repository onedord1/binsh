import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal as XTerminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import { Palette } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { getWebSocketUrl, getLocalShellUrl } from '../../lib/api'
import { useTerminalStore, type TerminalSession } from '../../stores/terminalStore'
import { terminalThemes, themeDisplayNames, darkThemes, lightThemes } from '../../lib/terminalThemes'

interface TerminalPaneProps {
  session: TerminalSession
  paneId: string
  tabId: string
  theme: Record<string, string>
  isFocused: boolean
  onFocus: () => void
  onClose: () => void
}

export default function TerminalPane({
  session,
  theme: globalTheme,
  isFocused,
  onFocus,
  onClose,
}: TerminalPaneProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const mountedRef = useRef(true)
  const [showThemeMenu, setShowThemeMenu] = useState(false)

  const { setSessionConnected, setSessionTheme, broadcastMode, registerBroadcastFn, unregisterBroadcastFn } = useTerminalStore()
  
  // Use session theme if set, otherwise use global theme
  const effectiveTheme = session.theme ? terminalThemes[session.theme] : globalTheme

  const sendToTerminal = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data }))
    }
  }, [])

  useEffect(() => {
    if (!terminalRef.current) return

    mountedRef.current = true

    const term = new XTerminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      theme: effectiveTheme,
      allowProposedApi: true,
      scrollback: 10000,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(terminalRef.current)

    setTimeout(() => {
      fitAddon.fit()
    }, 50)

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    const wsUrl = session.isLocal ? getLocalShellUrl() : getWebSocketUrl(session.hostId)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setSessionConnected(session.id, true)
      if (isFocused) {
        term.focus()
      }

      fitAddon.fit()

      ws.send(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows,
      }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'output' && msg.data) {
          term.write(msg.data)
        }
      } catch {
        term.write(event.data)
      }
    }

    ws.onclose = () => {
      setSessionConnected(session.id, false)
      term.write('\r\n\x1b[33mSession ended.\x1b[0m\r\n')
    }

    ws.onerror = () => {
      setSessionConnected(session.id, false)
      term.write('\r\n\x1b[31mConnection error.\x1b[0m\r\n')
    }

    term.onData((data) => {
      // Get current broadcast state from store directly
      const state = useTerminalStore.getState()
      if (state.broadcastMode) {
        // In broadcast mode, send to all registered terminals
        state.broadcastToAll(data)
      } else {
        // Normal mode, send only to this terminal
        sendToTerminal(data)
      }
    })

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    })

    // Register for broadcast using store
    registerBroadcastFn(session.id, sendToTerminal)

    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      mountedRef.current = false
      window.removeEventListener('resize', handleResize)
      
      unregisterBroadcastFn(session.id)

      setTimeout(() => {
        if (!mountedRef.current) {
          ws.close()
          term.dispose()
        }
      }, 100)
    }
  }, [session.id, session.hostId, session.isLocal])

  // Update theme when it changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = effectiveTheme
    }
  }, [effectiveTheme, session.theme])

  // Focus terminal when pane is focused
  useEffect(() => {
    if (isFocused && xtermRef.current) {
      xtermRef.current.focus()
    }
  }, [isFocused])

  // Refit when pane size changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fitAddonRef.current?.fit()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className={`flex flex-col w-full h-full ${isFocused ? 'ring-2 ring-primary-500/50' : ''}`}
      onClick={onFocus}
    >
      {/* Session header - fixed height, not absolute */}
      <div className="flex-shrink-0 flex items-center justify-between px-2 py-1 bg-dark-800/90 text-xs border-b border-dark-700/50 h-7">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${session.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-dark-200 truncate max-w-[200px]">
            {session.hostLabel || session.hostAddress}
          </span>
          {broadcastMode && (
            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[10px]">
              BROADCAST
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Theme selector */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowThemeMenu(!showThemeMenu)
              }}
              className="p-1 hover:bg-dark-700 rounded text-dark-400 hover:text-white transition-colors"
              title="Change theme"
            >
              <Palette className="w-3 h-3" />
            </button>
            <AnimatePresence>
              {showThemeMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute right-0 top-full mt-1 w-44 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setSessionTheme(session.id, undefined)
                      setShowThemeMenu(false)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                      !session.theme
                        ? 'bg-primary-500/10 text-primary-400'
                        : 'text-dark-200 hover:bg-dark-700/50'
                    }`}
                  >
                    <span>Use Global Theme</span>
                  </button>
                  <div className="px-3 py-1 text-[10px] font-semibold text-dark-500 border-b border-dark-700">Dark</div>
                  {darkThemes.map((themeName) => (
                    <button
                      key={themeName}
                      onClick={() => {
                        setSessionTheme(session.id, themeName)
                        setShowThemeMenu(false)
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                        session.theme === themeName
                          ? 'bg-primary-500/10 text-primary-400'
                          : 'text-dark-200 hover:bg-dark-700/50'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded border border-dark-600"
                        style={{ backgroundColor: terminalThemes[themeName]?.background }}
                      />
                      <span>{themeDisplayNames[themeName]}</span>
                    </button>
                  ))}
                  <div className="px-3 py-1 text-[10px] font-semibold text-dark-500 border-b border-t border-dark-700">Light</div>
                  {lightThemes.map((themeName) => (
                    <button
                      key={themeName}
                      onClick={() => {
                        setSessionTheme(session.id, themeName)
                        setShowThemeMenu(false)
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                        session.theme === themeName
                          ? 'bg-primary-500/10 text-primary-400'
                          : 'text-dark-200 hover:bg-dark-700/50'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded border border-dark-600"
                        style={{ backgroundColor: terminalThemes[themeName]?.background }}
                      />
                      <span>{themeDisplayNames[themeName]}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="p-1 hover:bg-dark-700 rounded text-dark-400 hover:text-white transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Terminal container - fills remaining space */}
      <div
        ref={terminalRef}
        className="terminal-container flex-1 min-h-0 w-full"
        style={{ backgroundColor: effectiveTheme.background }}
      />
    </div>
  )
}
