import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Share2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Globe,
  Play,
  Square,
  Trash2,
  Server,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { portForwards, hosts } from '../lib/api'
import type { PortForward, Host } from '../types'

export default function PortForwarding() {
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedType, setSelectedType] = useState<'local' | 'remote' | 'dynamic'>('local')
  const [activeStatuses, setActiveStatuses] = useState<Record<string, boolean>>({})

  const [form, setForm] = useState({
    label: '',
    host_id: '',
    local_port: 8080,
    remote_host: 'localhost',
    remote_port: 80,
    bind_addr: '127.0.0.1',
    auto_start: false,
  })

  const { data: forwards = [], isLoading } = useQuery<PortForward[]>({
    queryKey: ['portforwards'],
    queryFn: portForwards.list,
  })

  const { data: hostList = [] } = useQuery<Host[]>({
    queryKey: ['hosts'],
    queryFn: hosts.list,
  })

  // Poll for tunnel status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const statuses = await portForwards.status()
        const statusMap: Record<string, boolean> = {}
        statuses.forEach((s) => {
          statusMap[s.id] = s.active
        })
        setActiveStatuses(statusMap)
      } catch {
        // Ignore errors
      }
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 3000)
    return () => clearInterval(interval)
  }, [])

  const createMutation = useMutation({
    mutationFn: (data: Partial<PortForward>) => portForwards.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portforwards'] })
      toast.success('Port forward created')
      setShowAddModal(false)
      resetForm()
    },
    onError: () => {
      toast.error('Failed to create port forward')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: portForwards.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portforwards'] })
      toast.success('Port forward deleted')
    },
    onError: () => {
      toast.error('Failed to delete port forward')
    },
  })

  const startMutation = useMutation({
    mutationFn: portForwards.start,
    onSuccess: (data, id) => {
      if (data.status === 'started') {
        toast.success('Tunnel started')
        setActiveStatuses((prev) => ({ ...prev, [id]: true }))
      } else if (data.status === 'already_running') {
        toast.success('Tunnel is already running')
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to start tunnel: ${error.message}`)
    },
  })

  const stopMutation = useMutation({
    mutationFn: portForwards.stop,
    onSuccess: (data, id) => {
      if (data.status === 'stopped') {
        toast.success('Tunnel stopped')
        setActiveStatuses((prev) => ({ ...prev, [id]: false }))
      }
    },
    onError: () => {
      toast.error('Failed to stop tunnel')
    },
  })

  const resetForm = () => {
    setForm({
      label: '',
      host_id: '',
      local_port: 8080,
      remote_host: 'localhost',
      remote_port: 80,
      bind_addr: '127.0.0.1',
      auto_start: false,
    })
    setSelectedType('local')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.host_id) {
      toast.error('Please select a host')
      return
    }
    if (!form.local_port) {
      toast.error('Local port is required')
      return
    }

    createMutation.mutate({
      ...form,
      type: selectedType,
    })
  }

  const getHostLabel = (hostId: string) => {
    const host = hostList.find((h) => h.id === hostId)
    return host?.label || host?.address || 'Unknown'
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'local':
        return <ArrowRight className="w-5 h-5 text-primary-400" />
      case 'remote':
        return <ArrowLeft className="w-5 h-5 text-accent-purple" />
      case 'dynamic':
        return <Globe className="w-5 h-5 text-accent-cyan" />
      default:
        return <Share2 className="w-5 h-5 text-dark-400" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'local':
        return 'bg-primary-500/20 border-primary-500/30'
      case 'remote':
        return 'bg-accent-purple/20 border-accent-purple/30'
      case 'dynamic':
        return 'bg-accent-cyan/20 border-accent-cyan/30'
      default:
        return 'bg-dark-700/50 border-dark-600'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Port Forwarding</h2>
          <p className="text-sm text-gray-500 dark:text-dark-400">Manage SSH tunnels and port forwards</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          New Tunnel
        </button>
      </div>

      {forwards.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center h-96"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-cyan/20 to-primary-500/20 border border-accent-cyan/30 flex items-center justify-center mb-6">
            <Share2 className="w-10 h-10 text-accent-cyan" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Port Forwarding</h2>
          <p className="text-gray-500 dark:text-dark-400 mb-6 text-center max-w-md">
            Create secure tunnels to forward local or remote ports through SSH connections.
          </p>

          <div className="grid grid-cols-3 gap-4 w-full max-w-2xl mb-8">
            <div className="card p-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center mx-auto mb-3">
                <ArrowRight className="w-6 h-6 text-primary-400" />
              </div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">Local Forward</h4>
              <p className="text-xs text-gray-500 dark:text-dark-400">Forward local port to remote</p>
            </div>
            <div className="card p-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-accent-purple/20 flex items-center justify-center mx-auto mb-3">
                <ArrowLeft className="w-6 h-6 text-accent-purple" />
              </div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">Remote Forward</h4>
              <p className="text-xs text-gray-500 dark:text-dark-400">Forward remote port to local</p>
            </div>
            <div className="card p-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-accent-cyan/20 flex items-center justify-center mx-auto mb-3">
                <Globe className="w-6 h-6 text-accent-cyan" />
              </div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">Dynamic (SOCKS)</h4>
              <p className="text-xs text-gray-500 dark:text-dark-400">SOCKS5 proxy tunnel</p>
            </div>
          </div>

          <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-lg">
            <Plus className="w-5 h-5" />
            Create Your First Tunnel
          </button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {forwards.map((forward) => {
            const isActive = activeStatuses[forward.id] || false
            return (
              <motion.div
                key={forward.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card card-hover group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${getTypeColor(forward.type)}`}>
                      {getTypeIcon(forward.type)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {forward.label || `${forward.type} forward`}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-400">
                        <Server className="w-3 h-3" />
                        <span>{getHostLabel(forward.host_id)}</span>
                        <span className="text-dark-600">•</span>
                        {forward.type === 'dynamic' ? (
                          <span>SOCKS5 on :{forward.local_port}</span>
                        ) : (
                          <span>
                            :{forward.local_port} → {forward.remote_host}:{forward.remote_port}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        isActive
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400 dark:text-dark-400'
                      }`}
                    >
                      {isActive ? 'Active' : 'Stopped'}
                    </span>

                    {isActive ? (
                      <button
                        onClick={() => stopMutation.mutate(forward.id)}
                        disabled={stopMutation.isPending}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Stop tunnel"
                      >
                        <Square className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => startMutation.mutate(forward.id)}
                        disabled={startMutation.isPending}
                        className="p-2 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors"
                        title="Start tunnel"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (confirm(`Delete "${forward.label || 'this tunnel'}"?`)) {
                          deleteMutation.mutate(forward.id)
                        }
                      }}
                      className="p-2 rounded-lg text-gray-400 dark:text-dark-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Add Tunnel Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-dark-950/60 backdrop-blur-sm z-40"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
            >
              <div className="w-full max-w-lg bg-white dark:bg-dark-850 border border-gray-200 dark:border-dark-700/50 rounded-2xl shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700/50">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Create Tunnel</h3>
                    <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">Set up a new port forward</p>
                  </div>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700/50 text-gray-500 dark:text-dark-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="label">Label</label>
                    <input
                      type="text"
                      value={form.label}
                      onChange={(e) => setForm({ ...form, label: e.target.value })}
                      placeholder="My Tunnel"
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="label">Host</label>
                    <select
                      value={form.host_id}
                      onChange={(e) => setForm({ ...form, host_id: e.target.value })}
                      className="input appearance-none cursor-pointer"
                    >
                      <option value="">Select a host...</option>
                      {hostList.map((host) => (
                        <option key={host.id} value={host.id}>
                          {host.label || host.address}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Tunnel Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'local', label: 'Local', icon: ArrowRight, color: 'primary' },
                        { id: 'remote', label: 'Remote', icon: ArrowLeft, color: 'purple' },
                        { id: 'dynamic', label: 'Dynamic', icon: Globe, color: 'cyan' },
                      ].map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setSelectedType(type.id as typeof selectedType)}
                          className={`p-3 rounded-xl border transition-all duration-200 flex flex-col items-center gap-2 ${
                            selectedType === type.id
                              ? 'bg-primary-500/10 border-primary-500/50 text-primary-400'
                              : 'bg-gray-50 dark:bg-dark-800/50 border-gray-200 dark:border-dark-700 text-gray-600 dark:text-dark-400 hover:border-gray-300 dark:hover:border-dark-600'
                          }`}
                        >
                          <type.icon className="w-5 h-5" />
                          <span className="text-xs font-medium">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Local Port</label>
                      <input
                        type="number"
                        value={form.local_port}
                        onChange={(e) => setForm({ ...form, local_port: parseInt(e.target.value) || 0 })}
                        className="input"
                      />
                    </div>
                    {selectedType !== 'dynamic' && (
                      <div>
                        <label className="label">Remote Port</label>
                        <input
                          type="number"
                          value={form.remote_port}
                          onChange={(e) => setForm({ ...form, remote_port: parseInt(e.target.value) || 0 })}
                          className="input"
                        />
                      </div>
                    )}
                  </div>

                  {selectedType !== 'dynamic' && (
                    <div>
                      <label className="label">Remote Host</label>
                      <input
                        type="text"
                        value={form.remote_host}
                        onChange={(e) => setForm({ ...form, remote_host: e.target.value })}
                        placeholder="localhost"
                        className="input"
                      />
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false)
                        resetForm()
                      }}
                      className="btn btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="btn btn-primary flex-1"
                    >
                      {createMutation.isPending ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Create Tunnel
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
