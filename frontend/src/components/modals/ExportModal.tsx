import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  X,
  Download,
  FileJson,
  FileSpreadsheet,
  Server,
  Folder,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '../../stores/appStore'
import { hosts, groups } from '../../lib/api'
import type { Host, Group } from '../../types'

type ExportFormat = 'json' | 'csv'

export default function ExportModal() {
  const { exportModalOpen, closeExportModal } = useAppStore()
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json')
  const [includeGroups, setIncludeGroups] = useState(true)
  const [includePasswords, setIncludePasswords] = useState(false)

  const { data: hostList = [] } = useQuery({
    queryKey: ['hosts'],
    queryFn: hosts.list,
  })

  const { data: groupList = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: groups.list,
  })

  const generateJSON = () => {
    const exportData: {
      version: string
      exported_at: string
      hosts: Partial<Host>[]
      groups?: Partial<Group>[]
    } = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      hosts: hostList.map((host: Host) => {
        const h: Partial<Host> = {
          label: host.label,
          address: host.address,
          port: host.port,
          username: host.username,
          auth_method: host.auth_method,
          group_id: host.group_id,
          tags: host.tags,
          ssh_key_path: host.ssh_key_path,
        }
        if (includePasswords && host.password) {
          h.password = host.password
        }
        return h
      }),
    }

    if (includeGroups) {
      exportData.groups = groupList.map((group: Group) => ({
        id: group.id,
        label: group.label,
        color: group.color,
        icon: group.icon,
      }))
    }

    return JSON.stringify(exportData, null, 2)
  }

  const generateCSV = () => {
    const headers = ['label', 'address', 'port', 'username', 'auth_method', 'group', 'tags']
    if (includePasswords) headers.push('password')

    const groupMap = new Map(groupList.map((g: Group) => [g.id, g.label]))

    const rows = hostList.map((host: Host) => {
      const row = [
        host.label || '',
        host.address,
        String(host.port),
        host.username,
        host.auth_method,
        host.group_id ? groupMap.get(host.group_id) || '' : '',
        (host.tags || []).join(';'),
      ]
      if (includePasswords) row.push(host.password || '')
      return row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    })

    return [headers.join(','), ...rows].join('\n')
  }

  const handleExport = () => {
    const content = exportFormat === 'json' ? generateJSON() : generateCSV()
    const mimeType = exportFormat === 'json' ? 'application/json' : 'text/csv'
    const extension = exportFormat === 'json' ? 'json' : 'csv'
    const filename = `binsh-hosts-export-${new Date().toISOString().split('T')[0]}.${extension}`

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(`Exported ${hostList.length} hosts to ${filename}`)
    closeExportModal()
  }

  if (!exportModalOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]"
        onClick={closeExportModal}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-dark-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-200 dark:border-dark-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Export Hosts</h2>
                <p className="text-sm text-gray-500 dark:text-dark-400">Download your hosts configuration</p>
              </div>
            </div>
            <button
              onClick={closeExportModal}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Stats */}
            <div className="flex gap-4">
              <div className="flex-1 p-4 rounded-xl bg-gray-50 dark:bg-dark-800/50 border border-gray-200 dark:border-dark-700">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-primary-500" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{hostList.length}</p>
                    <p className="text-xs text-gray-500 dark:text-dark-400">Hosts</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 p-4 rounded-xl bg-gray-50 dark:bg-dark-800/50 border border-gray-200 dark:border-dark-700">
                <div className="flex items-center gap-3">
                  <Folder className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{groupList.length}</p>
                    <p className="text-xs text-gray-500 dark:text-dark-400">Groups</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Format Selection */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-dark-200 mb-3 block">Export Format</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setExportFormat('json')}
                  className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    exportFormat === 'json'
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
                  }`}
                >
                  <FileJson className={`w-6 h-6 ${exportFormat === 'json' ? 'text-primary-500' : 'text-gray-400 dark:text-dark-400'}`} />
                  <div className="text-left">
                    <p className={`font-medium ${exportFormat === 'json' ? 'text-primary-500' : 'text-gray-900 dark:text-white'}`}>JSON</p>
                    <p className="text-xs text-gray-500 dark:text-dark-400">Re-importable format</p>
                  </div>
                </button>
                <button
                  onClick={() => setExportFormat('csv')}
                  className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    exportFormat === 'csv'
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
                  }`}
                >
                  <FileSpreadsheet className={`w-6 h-6 ${exportFormat === 'csv' ? 'text-primary-500' : 'text-gray-400 dark:text-dark-400'}`} />
                  <div className="text-left">
                    <p className={`font-medium ${exportFormat === 'csv' ? 'text-primary-500' : 'text-gray-900 dark:text-white'}`}>CSV</p>
                    <p className="text-xs text-gray-500 dark:text-dark-400">Spreadsheet compatible</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeGroups}
                  onChange={(e) => setIncludeGroups(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-dark-200">Include groups information</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePasswords}
                  onChange={(e) => setIncludePasswords(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-dark-200">Include passwords (not recommended)</span>
                {includePasswords && (
                  <span className="text-xs text-red-500 font-medium">⚠️ Security risk</span>
                )}
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-dark-700">
            <button onClick={closeExportModal} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleExport} className="btn btn-primary">
              <Download className="w-4 h-4" />
              Export {hostList.length} Hosts
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
