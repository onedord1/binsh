import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Server,
  Folder,
  MoreHorizontal,
  Play,
  Pencil,
  Trash2,
  Clock,
  Globe,
  ChevronRight,
  Plus,
  FolderOpen,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { hosts, groups } from '../lib/api'
import { useAppStore } from '../stores/appStore'
import type { Host, Group } from '../types'

function HostCard({ host, onEdit, onDelete }: { host: Host; onEdit: () => void; onDelete: () => void }) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)

  const formatLastConnected = (timestamp?: number) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="card card-hover group"
    >
      <div className="flex items-start justify-between">
        <div
          className="flex items-center gap-3 flex-1 cursor-pointer"
          onClick={() => navigate(`/terminal/${host.id}`)}
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-cyan/20 border border-primary-500/30 flex items-center justify-center group-hover:border-primary-500/50 transition-colors">
            <Server className="w-6 h-6 text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-primary-400 transition-colors">
              {host.label || host.address}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-400">
              <Globe className="w-3.5 h-3.5" />
              <span className="truncate">{host.address}:{host.port}</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-lg text-gray-400 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-700/50 transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl shadow-xl z-10 overflow-hidden"
                onMouseLeave={() => setShowMenu(false)}
              >
                <button
                  onClick={() => {
                    setShowMenu(false)
                    navigate(`/terminal/${host.id}`)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-dark-200 hover:bg-gray-100 dark:hover:bg-dark-700/50 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Connect
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false)
                    onEdit()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-dark-200 hover:bg-gray-100 dark:hover:bg-dark-700/50 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false)
                    onDelete()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-dark-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatLastConnected(host.last_connected)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {host.tags?.slice(0, 2).map((tag, i) => (
            <span key={i} className="badge badge-neutral text-xs">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function GroupSection({
  group,
  hosts,
  isExpanded,
  onToggle,
  onEdit,
  onEditHost,
  onDeleteHost,
}: {
  group: Group | null
  hosts: Host[]
  isExpanded: boolean
  onToggle: () => void
  onEdit?: () => void
  onEditHost: (host: Host) => void
  onDeleteHost: (host: Host) => void
}) {
  const isUngrouped = !group

  return (
    <div className="mb-6">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-200/50 dark:hover:bg-dark-800/30 transition-colors group"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: (group?.color || '#64748b') + '20' }}
        >
          {isUngrouped ? (
            <FolderOpen className="w-4 h-4 text-gray-400 dark:text-dark-400" />
          ) : (
            <Folder className="w-4 h-4" style={{ color: group.color }} />
          )}
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-medium text-gray-900 dark:text-white">
            {isUngrouped ? 'Ungrouped' : group.label}
          </h3>
          <p className="text-xs text-gray-500 dark:text-dark-400">{hosts.length} host{hosts.length !== 1 ? 's' : ''}</p>
        </div>
        <ChevronRight
          className={`w-5 h-5 text-gray-400 dark:text-dark-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
        {!isUngrouped && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit?.()
            }}
            className="p-1.5 rounded-lg text-gray-400 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-700/50 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-3 pl-4">
              {hosts.map((host) => (
                <HostCard
                  key={host.id}
                  host={host}
                  onEdit={() => onEditHost(host)}
                  onDelete={() => onDeleteHost(host)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

import { useState } from 'react'

export default function Hosts() {
  const queryClient = useQueryClient()
  const { openHostPanel, openGroupPanel, searchQuery } = useAppStore()

  const { data: hostList = [], isLoading: hostsLoading } = useQuery<Host[]>({
    queryKey: ['hosts'],
    queryFn: hosts.list,
  })

  const { data: groupList = [], isLoading: groupsLoading } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: groups.list,
  })

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['ungrouped']))

  const deleteMutation = useMutation({
    mutationFn: hosts.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      toast.success('Host deleted')
    },
    onError: () => {
      toast.error('Failed to delete host')
    },
  })

  const filteredHosts = useMemo(() => {
    if (!searchQuery) return hostList
    const query = searchQuery.toLowerCase()
    return hostList.filter(
      (host) =>
        host.label?.toLowerCase().includes(query) ||
        host.address.toLowerCase().includes(query) ||
        host.tags?.some((tag) => tag.toLowerCase().includes(query))
    )
  }, [hostList, searchQuery])

  const groupedHosts = useMemo(() => {
    const grouped: Record<string, Host[]> = { ungrouped: [] }
    groupList.forEach((group) => {
      grouped[group.id] = []
    })
    filteredHosts.forEach((host) => {
      if (host.group_id && grouped[host.group_id]) {
        grouped[host.group_id].push(host)
      } else {
        grouped.ungrouped.push(host)
      }
    })
    return grouped
  }, [filteredHosts, groupList])

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const handleDeleteHost = (host: Host) => {
    if (confirm(`Delete "${host.label || host.address}"?`)) {
      deleteMutation.mutate(host.id)
    }
  }

  const isLoading = hostsLoading || groupsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-dark-400">Loading hosts...</p>
        </div>
      </div>
    )
  }

  if (hostList.length === 0 && groupList.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center h-96"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-cyan/20 border border-primary-500/30 flex items-center justify-center mb-6">
          <Server className="w-10 h-10 text-primary-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Create host</h2>
        <p className="text-dark-400 mb-6 text-center max-w-md">
          Save your connection details as hosts to connect in one click.
        </p>
        <button onClick={() => openHostPanel('create')} className="btn btn-primary btn-lg">
          <Plus className="w-5 h-5" />
          Add Your First Host
        </button>
      </motion.div>
    )
  }

  return (
    <div>
      {groupList.map((group) => (
        <GroupSection
          key={group.id}
          group={group}
          hosts={groupedHosts[group.id] || []}
          isExpanded={expandedGroups.has(group.id)}
          onToggle={() => toggleGroup(group.id)}
          onEdit={() => openGroupPanel('edit', group)}
          onEditHost={(host) => openHostPanel('edit', host)}
          onDeleteHost={handleDeleteHost}
        />
      ))}

      {groupedHosts.ungrouped.length > 0 && (
        <GroupSection
          group={null}
          hosts={groupedHosts.ungrouped}
          isExpanded={expandedGroups.has('ungrouped')}
          onToggle={() => toggleGroup('ungrouped')}
          onEditHost={(host) => openHostPanel('edit', host)}
          onDeleteHost={handleDeleteHost}
        />
      )}
    </div>
  )
}
