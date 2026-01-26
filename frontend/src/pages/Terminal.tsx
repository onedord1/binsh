import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal as XTerminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import {
  X,
  Maximize2,
  Minimize2,
  Copy,
  Clipboard,
  ChevronDown,
  Palette,
} from 'lucide-react'
import { hosts, getWebSocketUrl, getLocalShellUrl } from '../lib/api'
import { useAppStore } from '../stores/appStore'
import { terminalThemes, themeDisplayNames, darkThemes, lightThemes } from '../lib/terminalThemes'
import type { Host } from '../types'

export default function Terminal() {
  const { hostId } = useParams<{ hostId: string }>()
  const navigate = useNavigate()
  const { terminalZenMode, toggleZenMode } = useAppStore()
  
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const mountedRef = useRef(true) // Track if component is mounted (for StrictMode)
  
  const [isConnected, setIsConnected] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<keyof typeof terminalThemes>('binsh-dark')
  const [showThemeMenu, setShowThemeMenu] = useState(false)

  const isLocalShell = hostId === 'local'

  const { data: host } = useQuery<Host>({
    queryKey: ['host', hostId],
    queryFn: () => hosts.get(hostId!),
    enabled: !isLocalShell && !!hostId,
  })

  useEffect(() => {
    if (!terminalRef.current) return
    
    mountedRef.current = true

    const term = new XTerminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      theme: terminalThemes[currentTheme],
      allowProposedApi: true,
      scrollback: 10000,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(terminalRef.current)
    
    // Delay initial fit to ensure container has final dimensions
    setTimeout(() => {
      fitAddon.fit()
    }, 50)

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    const wsUrl = isLocalShell ? getLocalShellUrl() : getWebSocketUrl(hostId!)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      term.focus()
      
      // Re-fit terminal when connection opens to ensure correct dimensions
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
        // If not JSON, write raw data
        term.write(event.data)
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      term.write('\r\n\x1b[33mSession ended. Redirecting...\x1b[0m\r\n')
      setTimeout(() => {
        navigate('/hosts')
      }, 1500)
    }

    ws.onerror = () => {
      setIsConnected(false)
      term.write('\r\n\x1b[31mConnection error.\x1b[0m\r\n')
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    })

    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      mountedRef.current = false
      window.removeEventListener('resize', handleResize)
      // Small delay before cleanup to handle React StrictMode double-invoke
      setTimeout(() => {
        if (!mountedRef.current) {
          ws.close()
          term.dispose()
        }
      }, 100)
    }
  }, [hostId, isLocalShell])

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = terminalThemes[currentTheme]
    }
  }, [currentTheme])

  useEffect(() => {
    // Multiple fit calls to ensure terminal fits after zen mode transition
    // Longer delays to wait for CSS transitions to complete
    const timers = [
      setTimeout(() => fitAddonRef.current?.fit(), 50),
      setTimeout(() => fitAddonRef.current?.fit(), 200),
      setTimeout(() => fitAddonRef.current?.fit(), 400),
      setTimeout(() => fitAddonRef.current?.fit(), 600),
    ]
    return () => timers.forEach(clearTimeout)
  }, [terminalZenMode])

  const handleCopy = () => {
    const selection = xtermRef.current?.getSelection()
    if (selection) {
      navigator.clipboard.writeText(selection)
    }
  }

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText()
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: text }))
    }
  }

  return (
    <div className={`h-screen bg-dark-900 flex flex-col ${terminalZenMode ? 'fixed inset-0 z-50' : ''}`}>
      <motion.header
        initial={false}
        animate={{ height: terminalZenMode ? 0 : 56, opacity: terminalZenMode ? 0 : 1 }}
        className="bg-dark-850 border-b border-dark-700/50 px-4 flex items-center justify-between relative z-20"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/hosts')}
            className="p-2 rounded-lg hover:bg-dark-700/50 text-dark-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className={`status-dot ${isConnected ? 'status-online' : 'status-offline'}`} />
            <span className="font-medium text-white">
              {isLocalShell ? 'Local Shell' : (host?.label || host?.address || 'Connecting...')}
            </span>
            {!isLocalShell && host && (
              <span className="text-sm text-dark-400">
                {host.username}@{host.address}:{host.port}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg hover:bg-dark-700/50 text-dark-400 hover:text-white transition-colors"
            title="Copy"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={handlePaste}
            className="p-2 rounded-lg hover:bg-dark-700/50 text-dark-400 hover:text-white transition-colors"
            title="Paste"
          >
            <Clipboard className="w-4 h-4" />
          </button>

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
                        setCurrentTheme(theme as keyof typeof terminalThemes)
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
                        setCurrentTheme(theme as keyof typeof terminalThemes)
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

          <button
            onClick={toggleZenMode}
            className="p-2 rounded-lg hover:bg-dark-700/50 text-dark-400 hover:text-white transition-colors"
            title={terminalZenMode ? 'Exit Zen Mode' : 'Zen Mode'}
          >
            {terminalZenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </motion.header>

      <div 
        className={`flex-1 min-h-0 overflow-hidden ${terminalZenMode ? 'p-0' : 'p-2'}`}
        style={{ height: terminalZenMode ? '100vh' : 'calc(100vh - 56px)' }}
      >
        <div
          ref={terminalRef}
          className={`terminal-container w-full h-full ${terminalZenMode ? '' : 'rounded-lg'}`}
          style={{ backgroundColor: terminalThemes[currentTheme].background }}
        />
      </div>

      {terminalZenMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed top-4 right-4 flex items-center gap-2 z-[60]"
        >
          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="p-2 rounded-lg bg-dark-800/80 backdrop-blur text-dark-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <Palette className="w-5 h-5" />
            </button>
            <AnimatePresence>
              {showThemeMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="fixed top-14 right-4 w-48 bg-dark-800 border border-dark-700 rounded-xl shadow-xl z-[9999] max-h-96 overflow-y-auto"
                  onMouseLeave={() => setShowThemeMenu(false)}
                >
                  <div className="px-3 py-2 text-xs font-semibold text-dark-400 border-b border-dark-700">Dark Themes</div>
                  {darkThemes.map((theme) => (
                    <button
                      key={theme}
                      onClick={() => {
                        setCurrentTheme(theme as keyof typeof terminalThemes)
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
                        setCurrentTheme(theme as keyof typeof terminalThemes)
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
          <button
            className="p-2 rounded-lg bg-dark-800/80 backdrop-blur text-dark-400 hover:text-white transition-colors"
            onClick={toggleZenMode}
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        </motion.div>
      )}
    </div>
  )
}
