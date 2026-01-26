import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Terminal,
  Shield,
  Key,
  Globe,
} from 'lucide-react'
import { hosts, getWebSocketUrl } from '../lib/api'
import type { Host, ConnectionStatus as ConnectionStatusType } from '../types'

const statusSteps = [
  { id: 'resolving', label: 'Resolving hostname', icon: Globe },
  { id: 'connecting', label: 'Establishing connection', icon: Server },
  { id: 'authenticating', label: 'Authenticating', icon: Key },
  { id: 'verifying', label: 'Verifying host key', icon: Shield },
  { id: 'connected', label: 'Connected', icon: Terminal },
]

export default function ConnectionStatus() {
  const { hostId } = useParams<{ hostId: string }>()
  const navigate = useNavigate()
  
  const [logs, setLogs] = useState<ConnectionStatusType[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  
  const wsRef = useRef<WebSocket | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const connectedRef = useRef(false) // Sync ref to avoid race condition

  const { data: host } = useQuery<Host>({
    queryKey: ['host', hostId],
    queryFn: () => hosts.get(hostId!),
    enabled: !!hostId,
  })

  const connect = () => {
    if (!hostId) return

    setLogs([])
    setCurrentStep(0)
    setIsConnected(false)
    setError(null)
    setIsRetrying(false)
    connectedRef.current = false

    const ws = new WebSocket(getWebSocketUrl(hostId))
    wsRef.current = ws

    ws.onopen = () => {
      addLog({ type: 'status', message: 'Connection initiated...', timestamp: Date.now() })
      setCurrentStep(1)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'status' || data.type === 'log') {
          addLog(data)
          
          // Mark as connected early when we see SSH success messages
          if (data.message.includes('SSH connection established') || 
              data.message.includes('SSH session created') ||
              data.message.includes('PTY allocated')) {
            connectedRef.current = true
            setError(null) // Clear any error state
          }
          
          if (data.message.includes('Resolving')) setCurrentStep(1)
          else if (data.message.includes('Connecting')) setCurrentStep(2)
          else if (data.message.includes('Authenticat')) setCurrentStep(3)
          else if (data.message.includes('Verif') || data.message.includes('host key')) setCurrentStep(4)
        } else if (data.type === 'connected') {
          connectedRef.current = true
          setIsConnected(true)
          setCurrentStep(5)
          addLog({ type: 'status', message: 'Connection established successfully!', success: true, timestamp: Date.now() })
          
          setTimeout(() => {
            navigate(`/terminal/${hostId}`)
          }, 1500)
        } else if (data.type === 'error') {
          setError(data.message)
          addLog({ type: 'error', message: data.message, success: false, timestamp: Date.now() })
        } else if (data.type === 'output') {
          // Terminal output means connection is successful
          if (!connectedRef.current) {
            connectedRef.current = true
            setIsConnected(true)
            setCurrentStep(5)
            addLog({ type: 'status', message: 'Connection established successfully!', success: true, timestamp: Date.now() })
            
            setTimeout(() => {
              navigate(`/terminal/${hostId}`)
            }, 1500)
          }
        }
      } catch {
        // Regular terminal data, connection successful
        if (!connectedRef.current) {
          connectedRef.current = true
          setIsConnected(true)
          setCurrentStep(5)
          addLog({ type: 'status', message: 'Connection established successfully!', success: true, timestamp: Date.now() })
          
          setTimeout(() => {
            navigate(`/terminal/${hostId}`)
          }, 1500)
        }
      }
    }

    ws.onerror = () => {
      // Only show error if we haven't received any SSH success messages
      // The error might fire even after successful SSH connection due to websocket closure
    }

    ws.onclose = () => {
      // Don't show error - the websocket will close when navigating to Terminal
      // Terminal page will create its own connection
    }
  }

  const addLog = (log: ConnectionStatusType) => {
    setLogs((prev) => [...prev, log])
  }

  useEffect(() => {
    connect()
    return () => {
      // Only close WebSocket if NOT successfully connected
      // If connected, Terminal will handle it
      if (!connectedRef.current) {
        wsRef.current?.close()
      }
    }
  }, [hostId])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleRetry = () => {
    setIsRetrying(true)
    wsRef.current?.close()
    setTimeout(connect, 500)
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-900 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
              error
                ? 'bg-red-500/20 border-2 border-red-500/50'
                : isConnected
                ? 'bg-green-500/20 border-2 border-green-500/50'
                : 'bg-primary-500/20 border-2 border-primary-500/50'
            }`}
          >
            {error ? (
              <XCircle className="w-10 h-10 text-red-400" />
            ) : isConnected ? (
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            ) : (
              <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
            )}
          </motion.div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {error
              ? 'Connection Failed'
              : isConnected
              ? 'Connected!'
              : 'Connecting...'}
          </h1>
          <p className="text-gray-500 dark:text-dark-400">
            {host?.label || host?.address || 'Loading...'}
            {host && ` (${host.username}@${host.address}:${host.port})`}
          </p>
        </div>

        <div className="card p-6 mb-6">
          <div className="space-y-4">
            {statusSteps.map((step, index) => {
              const isActive = index === currentStep - 1
              const isComplete = index < currentStep - 1 || isConnected
              const isFailed = error && index === currentStep - 1

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-primary-500/10 border border-primary-500/30'
                      : isFailed
                      ? 'bg-red-500/10 border border-red-500/30'
                      : isComplete
                      ? 'bg-green-500/5'
                      : 'opacity-50'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isFailed
                        ? 'bg-red-500/20 text-red-400'
                        : isComplete
                        ? 'bg-green-500/20 text-green-400'
                        : isActive
                        ? 'bg-primary-500/20 text-primary-400'
                        : 'bg-gray-200 dark:bg-dark-700/50 text-gray-400 dark:text-dark-400'
                    }`}
                  >
                    {isFailed ? (
                      <XCircle className="w-5 h-5" />
                    ) : isComplete ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isActive ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium ${
                        isFailed
                          ? 'text-red-400'
                          : isComplete
                          ? 'text-green-400'
                          : isActive
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-400 dark:text-dark-400'
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                  {isActive && !isFailed && (
                    <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>

        {(logs.length > 0 || error) && (
          <div className="card p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-600 dark:text-dark-300 mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Connection Log
            </h3>
            <div className="bg-gray-900 dark:bg-dark-900 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-2 mb-1 ${
                    log.type === 'error' ? 'text-red-400' : log.success ? 'text-green-400' : 'text-gray-300 dark:text-dark-300'
                  }`}
                >
                  <span className="text-gray-500 dark:text-dark-500 select-none">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span>{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card p-4 mb-6 border-red-500/30 bg-red-500/5"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-400 mb-1">Error Details</h4>
                <p className="text-sm text-gray-600 dark:text-dark-300">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/hosts')}
            className="btn btn-secondary flex-1"
          >
            Back to Hosts
          </button>
          {error && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="btn btn-primary flex-1"
            >
              {isRetrying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Retry Connection
                </>
              )}
            </button>
          )}
          {isConnected && (
            <button
              onClick={() => navigate(`/terminal/${hostId}`)}
              className="btn btn-primary flex-1"
            >
              Open Terminal
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
