import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Cloud,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Folder,
  Server,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '../../stores/appStore'
import { groups } from '../../lib/api'
import type { Group } from '../../types'

interface SyncStatus {
  groupId: string
  status: 'pending' | 'syncing' | 'success' | 'error'
  message?: string
  synced?: number
}

export default function CloudSyncModal() {
  const { cloudSyncModalOpen, closeCloudSyncModal } = useAppStore()
  const queryClient = useQueryClient()
  
  const [syncStatuses, setSyncStatuses] = useState<Record<string, SyncStatus>>({})
  const [isSyncingAll, setIsSyncingAll] = useState(false)

  const { data: groupList = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: groups.list,
  })

  const cloudGroups = groupList.filter((g: Group) => g.cloud_sync && g.cloud_provider)

  const syncMutation = useMutation({
    mutationFn: (groupId: string) => groups.syncCloud(groupId),
  })

  const syncGroup = async (group: Group) => {
    setSyncStatuses(prev => ({
      ...prev,
      [group.id]: { groupId: group.id, status: 'syncing' }
    }))

    try {
      const result = await syncMutation.mutateAsync(group.id)
      setSyncStatuses(prev => ({
        ...prev,
        [group.id]: {
          groupId: group.id,
          status: 'success',
          message: result.message,
          synced: result.synced
        }
      }))
      return { success: true, synced: result.synced }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed'
      setSyncStatuses(prev => ({
        ...prev,
        [group.id]: {
          groupId: group.id,
          status: 'error',
          message
        }
      }))
      return { success: false, synced: 0 }
    }
  }

  const syncAllGroups = async () => {
    if (cloudGroups.length === 0) {
      toast.error('No cloud-enabled groups to sync')
      return
    }

    setIsSyncingAll(true)
    let totalSynced = 0
    let successCount = 0
    let errorCount = 0

    for (const group of cloudGroups) {
      const result = await syncGroup(group)
      if (result.success) {
        successCount++
        totalSynced += result.synced
      } else {
        errorCount++
      }
    }

    setIsSyncingAll(false)
    queryClient.invalidateQueries({ queryKey: ['hosts'] })

    if (successCount > 0) {
      toast.success(`Synced ${totalSynced} hosts from ${successCount} groups`)
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} groups failed to sync`)
    }
  }

  const handleSingleSync = async (group: Group) => {
    await syncGroup(group)
    queryClient.invalidateQueries({ queryKey: ['hosts'] })
  }

  const getProviderLabel = (provider: string) => {
    const labels: Record<string, string> = {
      aws: 'AWS EC2',
      gcp: 'Google Cloud',
      azure: 'Microsoft Azure',
      digitalocean: 'DigitalOcean',
      alibaba: 'Alibaba Cloud',
      oracle: 'Oracle Cloud',
      linode: 'Akamai / Linode',
    }
    return labels[provider] || provider
  }

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      aws: 'from-orange-500 to-yellow-500',
      gcp: 'from-blue-500 to-green-500',
      azure: 'from-blue-600 to-cyan-500',
      digitalocean: 'from-blue-500 to-blue-600',
      alibaba: 'from-orange-600 to-orange-500',
      oracle: 'from-red-600 to-red-500',
      linode: 'from-green-600 to-green-500',
    }
    return colors[provider] || 'from-gray-500 to-gray-600'
  }

  const handleClose = () => {
    setSyncStatuses({})
    closeCloudSyncModal()
  }

  if (!cloudSyncModalOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-dark-800 rounded-2xl w-full max-w-xl max-h-[80vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-dark-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-primary-500 flex items-center justify-center">
                <Cloud className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cloud Sync</h2>
                <p className="text-sm text-gray-500 dark:text-dark-400">
                  Sync hosts from cloud providers
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[50vh]">
            {cloudGroups.length === 0 ? (
              <div className="text-center py-12">
                <Cloud className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-dark-600" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Cloud Groups
                </h3>
                <p className="text-gray-500 dark:text-dark-400 max-w-sm mx-auto">
                  Create a group with Cloud Sync enabled to import hosts from your cloud providers.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cloudGroups.map((group: Group) => {
                  const status = syncStatuses[group.id]
                  return (
                    <div
                      key={group.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-800/50"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: (group.color || '#64748b') + '20' }}
                      >
                        <Folder className="w-5 h-5" style={{ color: group.color }} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">
                          {group.label}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${getProviderColor(group.cloud_provider || '')} text-white`}>
                            {getProviderLabel(group.cloud_provider || '')}
                          </span>
                          {status?.status === 'success' && status.synced !== undefined && (
                            <span className="text-xs text-green-500">
                              {status.synced} hosts synced
                            </span>
                          )}
                          {status?.status === 'error' && (
                            <span className="text-xs text-red-500 truncate max-w-[150px]">
                              {status.message}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {status?.status === 'syncing' ? (
                          <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                        ) : status?.status === 'success' ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : status?.status === 'error' ? (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        ) : null}
                        
                        <button
                          onClick={() => handleSingleSync(group)}
                          disabled={status?.status === 'syncing' || isSyncingAll}
                          className="p-2 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-500/10 transition-colors disabled:opacity-50"
                          title="Sync this group"
                        >
                          <RefreshCw className={`w-4 h-4 ${status?.status === 'syncing' ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {cloudGroups.length > 0 && (
            <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-dark-700">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-400">
                <Server className="w-4 h-4" />
                <span>{cloudGroups.length} cloud-enabled groups</span>
              </div>
              <button
                onClick={syncAllGroups}
                disabled={isSyncingAll}
                className="btn btn-primary"
              >
                {isSyncingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing All...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sync All Groups
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
