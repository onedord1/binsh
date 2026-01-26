import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { X, Search, Server, Terminal } from 'lucide-react'
import { hosts as hostsApi } from '../../lib/api'
import type { Host } from '../../types'

interface HostSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (hostId: string, hostLabel: string, hostAddress: string, isLocal: boolean) => void
}

export default function HostSelector({ isOpen, onClose, onSelect }: HostSelectorProps) {
  const [search, setSearch] = useState('')

  const { data: hostsList = [] } = useQuery<Host[]>({
    queryKey: ['hosts'],
    queryFn: hostsApi.list,
    enabled: isOpen,
  })

  const filteredHosts = hostsList.filter(
    (host) =>
      host.label?.toLowerCase().includes(search.toLowerCase()) ||
      host.address.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelectLocal = () => {
    onSelect('local', 'Local Shell', 'localhost', true)
    onClose()
  }

  const handleSelectHost = (host: Host) => {
    onSelect(host.id, host.label || host.address, `${host.username}@${host.address}:${host.port}`, false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-dark-800 border border-dark-700 rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-dark-700">
            <h3 className="text-lg font-semibold text-white">Select Host</h3>
            <button
              onClick={onClose}
              className="p-1 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-dark-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search hosts..."
                className="w-full pl-10 pr-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:border-primary-500"
                autoFocus
              />
            </div>
          </div>

          {/* Host list */}
          <div className="max-h-80 overflow-y-auto">
            {/* Local Shell option */}
            <button
              onClick={handleSelectLocal}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-700/50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                <Terminal className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <div className="font-medium text-white">Local Shell</div>
                <div className="text-sm text-dark-400">localhost</div>
              </div>
            </button>

            {/* Divider */}
            <div className="mx-4 my-2 h-px bg-dark-700" />

            {/* Remote hosts */}
            {filteredHosts.length === 0 ? (
              <div className="px-4 py-8 text-center text-dark-400">
                {search ? 'No hosts found' : 'No hosts configured'}
              </div>
            ) : (
              filteredHosts.map((host) => (
                <button
                  key={host.id}
                  onClick={() => handleSelectHost(host)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-700/50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-dark-700 flex items-center justify-center">
                    <Server className="w-5 h-5 text-dark-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">
                      {host.label || host.address}
                    </div>
                    <div className="text-sm text-dark-400 truncate">
                      {host.username}@{host.address}:{host.port}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
