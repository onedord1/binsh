import { useMemo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  Cloud,
  RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { hosts, groups } from '../lib/api'
import { useAppStore } from '../stores/appStore'
import type { Host, Group } from '../types'

function HostCard({ host, onEdit, onDelete }: { host: Host; onEdit: () => void; onDelete: () => void }) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)

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

  const handleMenuToggle = () => {
    if (!showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPosition({ top: rect.bottom + 4, left: rect.right - 160 })
    }
    setShowMenu(!showMenu)
  }

  useEffect(() => {
    if (showMenu) {
      const handleClickOutside = (e: MouseEvent) => {
        if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
          setShowMenu(false)
        }
      }
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showMenu])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      className="relative group cursor-pointer"
      onClick={() => navigate(`/connect/${host.id}`)}
    >
      {/* Card with gradient border effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 via-cyan-500/20 to-purple-500/20 rounded-2xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500" />
      <div className="relative bg-white dark:bg-dark-800/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-dark-700/50 p-5 shadow-lg shadow-gray-200/20 dark:shadow-dark-900/30 group-hover:border-primary-500/30 dark:group-hover:border-primary-500/30 transition-all duration-300">
        {/* Status indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <button
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation()
              handleMenuToggle()
            }}
            className="p-1.5 rounded-lg text-gray-400 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700/50 transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Server icon with gradient background */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center mb-4 shadow-lg shadow-primary-500/25 group-hover:shadow-primary-500/40 transition-shadow">
          <Server className="w-7 h-7 text-white" />
        </div>

        {/* Host info */}
        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1 group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors">
          {host.label || host.address}
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-400 mb-4">
          <Globe className="w-4 h-4" />
          <span className="font-mono">{host.address}:{host.port}</span>
        </div>

        {/* Tags */}
        {host.tags && host.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {host.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer with last connected */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-dark-700/50">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-400">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatLastConnected(host.last_connected)}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-primary-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            <span>Connect</span>
            <Play className="w-3 h-3" />
          </div>
        </div>

        {/* Dropdown menu portal */}
        {showMenu && createPortal(
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed w-44 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl shadow-2xl z-[9999] overflow-hidden"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
                navigate(`/connect/${host.id}`)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-600 dark:text-dark-200 hover:bg-primary-50 dark:hover:bg-primary-500/10 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <Play className="w-4 h-4" />
              Connect
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
                onEdit()
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-600 dark:text-dark-200 hover:bg-gray-50 dark:hover:bg-dark-700/50 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            <div className="border-t border-gray-100 dark:border-dark-700" />
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
                onDelete()
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </motion.div>,
          document.body
        )}
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
  onDelete,
  onEditHost,
  onDeleteHost,
  onSync,
  isSyncing,
}: {
  group: Group | null
  hosts: Host[]
  isExpanded: boolean
  onToggle: () => void
  onEdit?: () => void
  onDelete?: () => void
  onEditHost: (host: Host) => void
  onDeleteHost: (host: Host) => void
  onSync?: () => void
  isSyncing?: boolean
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
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
            {group?.cloud_sync && group?.cloud_provider && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSync?.()
                }}
                disabled={isSyncing}
                className={`p-1.5 rounded-lg flex items-center gap-1 text-xs font-medium transition-all ${
                  isSyncing
                    ? 'text-cyan-500 bg-cyan-500/10'
                    : 'text-gray-400 dark:text-dark-400 hover:text-cyan-500 hover:bg-cyan-500/10'
                }`}
                title="Sync from cloud"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <Cloud className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit?.()
              }}
              className="p-1.5 rounded-lg text-gray-400 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-700/50"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete?.()
              }}
              className="p-1.5 rounded-lg text-gray-400 dark:text-dark-400 hover:text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'host' | 'group'; item: Host | Group } | null>(null)

  const deleteMutation = useMutation({
    mutationFn: hosts.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      toast.success('Host deleted')
      setDeleteConfirm(null)
    },
    onError: () => {
      toast.error('Failed to delete host')
    },
  })

  const deleteGroupMutation = useMutation({
    mutationFn: groups.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast.success('Group deleted')
      setDeleteConfirm(null)
    },
    onError: () => {
      toast.error('Failed to delete group')
    },
  })

  const [syncingGroupId, setSyncingGroupId] = useState<string | null>(null)
  const syncCloudMutation = useMutation({
    mutationFn: (groupId: string) => groups.syncCloud(groupId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      toast.success(data.message || `Synced ${data.synced} hosts from cloud`)
      setSyncingGroupId(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to sync from cloud')
      setSyncingGroupId(null)
    },
  })

  const handleSyncCloud = (groupId: string) => {
    setSyncingGroupId(groupId)
    syncCloudMutation.mutate(groupId)
  }

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
    setDeleteConfirm({ type: 'host', item: host })
  }

  const handleDeleteGroup = (group: Group) => {
    setDeleteConfirm({ type: 'group', item: group })
  }

  const confirmDelete = () => {
    if (!deleteConfirm) return
    if (deleteConfirm.type === 'host') {
      deleteMutation.mutate((deleteConfirm.item as Host).id)
    } else {
      deleteGroupMutation.mutate((deleteConfirm.item as Group).id)
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
          onDelete={() => handleDeleteGroup(group)}
          onEditHost={(host) => openHostPanel('edit', host)}
          onDeleteHost={handleDeleteHost}
          onSync={() => handleSyncCloud(group.id)}
          isSyncing={syncingGroupId === group.id}
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

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-dark-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Delete {deleteConfirm.type === 'host' ? 'Host' : 'Group'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-dark-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-dark-300 mb-6">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {deleteConfirm.type === 'host'
                    ? (deleteConfirm.item as Host).label || (deleteConfirm.item as Host).address
                    : (deleteConfirm.item as Group).label}
                </span>
                ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="btn bg-red-500 hover:bg-red-600 text-white flex-1"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
