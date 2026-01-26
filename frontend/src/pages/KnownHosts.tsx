import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Wifi, 
  Search, 
  Server, 
  Trash2, 
  RefreshCw,
  Loader2,
  FileKey,
  Plus,
  AlertCircle,
  Globe,
  MoreVertical
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { knownHosts, hosts } from '../lib/api'
import type { KnownHost } from '../types'

export default function KnownHosts() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<KnownHost | null>(null)
  const [convertModal, setConvertModal] = useState<KnownHost | null>(null)
  const [convertForm, setConvertForm] = useState({
    label: '',
    username: 'root',
    auth_method: 'key' as 'password' | 'key' | 'agent',
  })

  // Create unique key for each host entry
  const getUniqueKey = (host: KnownHost) => `${host.host}-${host.port}-${host.key_type}`

  const { data: knownHostsList = [], isLoading, refetch } = useQuery<KnownHost[]>({
    queryKey: ['known-hosts'],
    queryFn: knownHosts.list,
  })

  const removeMutation = useMutation({
    mutationFn: (host: string) => knownHosts.remove(host),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['known-hosts'] })
      toast.success('Host removed from known_hosts')
      setDeleteConfirm(null)
    },
    onError: () => toast.error('Failed to remove host'),
  })

  const convertMutation = useMutation({
    mutationFn: (data: { address: string; port: number; label: string; username: string; auth_method: 'password' | 'key' | 'agent' }) => 
      hosts.create({
        label: data.label,
        address: data.address,
        port: data.port,
        username: data.username,
        auth_method: data.auth_method,
        agent_forwarding: false,
        host_checking: true,
        utf8: true,
        mosh: false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      toast.success('Host created successfully!')
      setConvertModal(null)
      setConvertForm({ label: '', username: 'root', auth_method: 'key' })
      navigate('/hosts')
    },
    onError: () => toast.error('Failed to create host'),
  })

  const filteredHosts = knownHostsList.filter(host =>
    host.host.toLowerCase().includes(search.toLowerCase())
  )

  const handleConvert = (e: React.FormEvent) => {
    e.preventDefault()
    if (!convertModal || !convertForm.label) {
      toast.error('Please enter a label')
      return
    }
    convertMutation.mutate({
      address: convertModal.host,
      port: convertModal.port,
      label: convertForm.label,
      username: convertForm.username,
      auth_method: convertForm.auth_method,
    })
  }

  const getDisplayHost = (host: string, port: number) => {
    if (port !== 22) {
      return `[${host}]:${port}`
    }
    return host
  }

  // Get key type color
  const getKeyTypeColor = (keyType: string) => {
    if (keyType.includes('ed25519')) return 'from-emerald-500 to-teal-500'
    if (keyType.includes('ecdsa')) return 'from-purple-500 to-pink-500'
    if (keyType.includes('rsa')) return 'from-blue-500 to-cyan-500'
    return 'from-orange-500 to-amber-500'
  }

  return (
    <div className="min-h-screen">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-blue-500/5 to-cyan-500/5 dark:from-blue-500/3 dark:to-cyan-500/3 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/5 to-pink-500/5 dark:from-purple-500/3 dark:to-pink-500/3 rounded-full blur-3xl" />
      </div>

      <div className="p-6 max-w-[1800px] mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl blur-lg opacity-50" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-xl">
                <Globe className="w-7 h-7 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Known Hosts
              </h1>
              <p className="text-gray-500 dark:text-dark-400 mt-0.5">
                Discovered SSH hosts from ~/.ssh/known_hosts
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl font-medium text-gray-700 dark:text-dark-200 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Scan Again
          </motion.button>
        </motion.div>

        {/* Search & Stats Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4 mb-8"
        >
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-dark-500" />
            <input
              type="text"
              placeholder="Search hosts by address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          
          {/* Stats Cards */}
          <div className="flex gap-3">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 border border-blue-500/20 rounded-xl">
              <FileKey className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-dark-400">Total Hosts</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{knownHostsList.length}</p>
              </div>
            </div>
            {search && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 border border-purple-500/20 rounded-xl">
                <Search className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-dark-400">Results</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{filteredHosts.length}</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      ) : filteredHosts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-dark-800 flex items-center justify-center mx-auto mb-4">
            <Wifi className="w-10 h-10 text-gray-400 dark:text-dark-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {search ? 'No hosts found' : 'No known hosts'}
          </h3>
          <p className="text-gray-500 dark:text-dark-400 max-w-md mx-auto">
            {search 
              ? 'Try a different search term'
              : 'Your ~/.ssh/known_hosts file is empty or doesn\'t exist. Connect to SSH servers to populate this list.'
            }
          </p>
        </motion.div>
      ) : (
        /* Host Cards Grid */
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredHosts.map((host, index) => {
              const uniqueKey = getUniqueKey(host)
              const gradientColor = getKeyTypeColor(host.key_type)
              
              return (
                <motion.div
                  key={uniqueKey}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: Math.min(index * 0.02, 0.5) }}
                  className={`group relative ${activeMenu === uniqueKey ? 'z-50' : 'z-0'}`}
                >
                  <div className="relative rounded-2xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 hover:border-transparent hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300">
                    {/* Gradient Top Border */}
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradientColor} rounded-t-2xl`} />
                    
                    <div className="p-4">
                      {/* Icon and Host */}
                      <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradientColor} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                          <Wifi className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="font-semibold text-gray-900 dark:text-white truncate" title={getDisplayHost(host.host, host.port)}>
                            {getDisplayHost(host.host, host.port)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-dark-400 truncate mt-0.5">
                            {host.key_type}
                          </p>
                        </div>
                        
                        {/* Menu Button */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveMenu(activeMenu === uniqueKey ? null : uniqueKey)
                            }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-400 dark:text-dark-500 hover:text-gray-600 dark:hover:text-dark-300 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Dropdown Menu */}
                          <AnimatePresence>
                            {activeMenu === uniqueKey && (
                              <>
                                <div 
                                  className="fixed inset-0 z-40" 
                                  onClick={() => setActiveMenu(null)} 
                                />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                  className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 shadow-2xl z-50 overflow-hidden"
                                >
                                  <button
                                    onClick={() => {
                                      setConvertModal(host)
                                      setConvertForm({
                                        label: host.host,
                                        username: 'root',
                                        auth_method: 'key',
                                      })
                                      setActiveMenu(null)
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-dark-200 hover:bg-gradient-to-r hover:from-primary-500/10 hover:to-cyan-500/10 transition-colors"
                                  >
                                    <Server className="w-4 h-4 text-primary-500" />
                                    Convert to Host
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteConfirm(host)
                                      setActiveMenu(null)
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Remove
                                  </button>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-dark-700"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Remove Known Host</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-400">This action cannot be undone</p>
                </div>
              </div>
              
              <p className="text-gray-600 dark:text-dark-300 mb-6">
                Are you sure you want to remove <strong className="text-gray-900 dark:text-white">{deleteConfirm.host}</strong> from your known_hosts file?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => removeMutation.mutate(deleteConfirm.host)}
                  disabled={removeMutation.isPending}
                  className="btn bg-red-500 hover:bg-red-600 text-white flex-1 flex items-center justify-center gap-2"
                >
                  {removeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Convert to Host Modal */}
      <AnimatePresence>
        {convertModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setConvertModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-dark-700"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-cyan flex items-center justify-center shadow-lg shadow-primary-500/30">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Convert to Host</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-400">{convertModal.host}</p>
                </div>
              </div>

              <form onSubmit={handleConvert} className="space-y-4">
                <div>
                  <label className="label">Label</label>
                  <input
                    type="text"
                    value={convertForm.label}
                    onChange={(e) => setConvertForm({ ...convertForm, label: e.target.value })}
                    placeholder="My Server"
                    className="input"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="label">Username</label>
                  <input
                    type="text"
                    value={convertForm.username}
                    onChange={(e) => setConvertForm({ ...convertForm, username: e.target.value })}
                    placeholder="root"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Authentication Method</label>
                  <select
                    value={convertForm.auth_method}
                    onChange={(e) => setConvertForm({ ...convertForm, auth_method: e.target.value as 'password' | 'key' | 'agent' })}
                    className="input"
                  >
                    <option value="key">SSH Key</option>
                    <option value="password">Password</option>
                    <option value="agent">SSH Agent</option>
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-700/50 border border-gray-200 dark:border-dark-600">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-dark-300">
                    <Server className="w-4 h-4" />
                    <span>Address: <strong>{convertModal.host}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-dark-300 mt-1">
                    <Wifi className="w-4 h-4" />
                    <span>Port: <strong>{convertModal.port}</strong></span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setConvertModal(null)}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={convertMutation.isPending}
                    className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {convertMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Create Host
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}
