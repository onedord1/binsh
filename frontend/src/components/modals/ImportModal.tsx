import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Upload,
  FileText,
  FileJson,
  FileSpreadsheet,
  Server,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '../../stores/appStore'
import { hosts } from '../../lib/api'
import type { Host } from '../../types'

interface ParsedHost {
  label: string
  address: string
  port: number
  username: string
  ssh_key_path?: string
  selected: boolean
}

export default function ImportModal() {
  const { importModalOpen, closeImportModal } = useAppStore()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [importType, setImportType] = useState<'ssh-config' | 'json' | 'csv' | null>(null)
  const [parsedHosts, setParsedHosts] = useState<ParsedHost[]>([])
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{ success: number; failed: number } | null>(null)

  const importMutation = useMutation({
    mutationFn: (host: Partial<Host>) => hosts.create(host),
  })

  const parseSSHConfig = (content: string): ParsedHost[] => {
    const hosts: ParsedHost[] = []
    const lines = content.split('\n')
    let currentHost: Partial<ParsedHost> | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('#') || !trimmed) continue

      if (trimmed.toLowerCase().startsWith('host ')) {
        if (currentHost && currentHost.address) {
          hosts.push({
            label: currentHost.label || currentHost.address || '',
            address: currentHost.address || '',
            port: currentHost.port || 22,
            username: currentHost.username || 'root',
            ssh_key_path: currentHost.ssh_key_path,
            selected: true,
          })
        }
        const hostName = trimmed.substring(5).trim()
        if (hostName !== '*') {
          currentHost = { label: hostName }
        } else {
          currentHost = null
        }
      } else if (currentHost) {
        const [key, ...valueParts] = trimmed.split(/\s+/)
        const value = valueParts.join(' ')
        switch (key.toLowerCase()) {
          case 'hostname':
            currentHost.address = value
            break
          case 'port':
            currentHost.port = parseInt(value) || 22
            break
          case 'user':
            currentHost.username = value
            break
          case 'identityfile':
            currentHost.ssh_key_path = value.replace('~', '')
            break
        }
      }
    }

    // Don't forget the last host
    if (currentHost && currentHost.address) {
      hosts.push({
        label: currentHost.label || currentHost.address || '',
        address: currentHost.address || '',
        port: currentHost.port || 22,
        username: currentHost.username || 'root',
        ssh_key_path: currentHost.ssh_key_path,
        selected: true,
      })
    }

    return hosts
  }

  const parseJSON = (content: string): ParsedHost[] => {
    try {
      const data = JSON.parse(content)
      const hostsArray = Array.isArray(data) ? data : data.hosts || []
      return hostsArray.map((h: Record<string, unknown>) => ({
        label: (h.label || h.name || h.address || '') as string,
        address: (h.address || h.hostname || h.host || '') as string,
        port: (h.port as number) || 22,
        username: (h.username || h.user || 'root') as string,
        ssh_key_path: h.ssh_key_path as string | undefined,
        selected: true,
      })).filter((h: ParsedHost) => h.address)
    } catch {
      toast.error('Invalid JSON format')
      return []
    }
  }

  const parseCSV = (content: string): ParsedHost[] => {
    const lines = content.split('\n').filter(line => line.trim())
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const hosts: ParsedHost[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/("([^"]*)"|[^,]*)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || []
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => { row[h] = values[idx] || '' })

      const address = row.address || row.hostname || row.host || row.ip || ''
      if (address) {
        hosts.push({
          label: row.label || row.name || address,
          address,
          port: parseInt(row.port) || 22,
          username: row.username || row.user || 'root',
          ssh_key_path: row.ssh_key_path || row.key_path,
          selected: true,
        })
      }
    }
    return hosts
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      let parsed: ParsedHost[] = []

      if (importType === 'ssh-config') {
        parsed = parseSSHConfig(content)
      } else if (importType === 'json') {
        parsed = parseJSON(content)
      } else if (importType === 'csv') {
        parsed = parseCSV(content)
      }

      if (parsed.length === 0) {
        toast.error('No hosts found in file')
      } else {
        setParsedHosts(parsed)
        toast.success(`Found ${parsed.length} hosts`)
      }
    }
    reader.readAsText(file)
  }

  const toggleHost = (index: number) => {
    setParsedHosts(prev => prev.map((h, i) => 
      i === index ? { ...h, selected: !h.selected } : h
    ))
  }

  const selectAll = () => {
    setParsedHosts(prev => prev.map(h => ({ ...h, selected: true })))
  }

  const deselectAll = () => {
    setParsedHosts(prev => prev.map(h => ({ ...h, selected: false })))
  }

  const handleImport = async () => {
    const selected = parsedHosts.filter(h => h.selected)
    if (selected.length === 0) {
      toast.error('No hosts selected')
      return
    }

    setImporting(true)
    let success = 0
    let failed = 0

    for (const host of selected) {
      try {
        await importMutation.mutateAsync({
          label: host.label,
          address: host.address,
          port: host.port,
          username: host.username,
          auth_method: host.ssh_key_path ? 'key' : 'password',
          ssh_key_path: host.ssh_key_path,
        })
        success++
      } catch {
        failed++
      }
    }

    setImporting(false)
    setImportResults({ success, failed })
    queryClient.invalidateQueries({ queryKey: ['hosts'] })

    if (success > 0) {
      toast.success(`Imported ${success} hosts`)
    }
    if (failed > 0) {
      toast.error(`Failed to import ${failed} hosts`)
    }
  }

  const handleClose = () => {
    setImportType(null)
    setParsedHosts([])
    setImportResults(null)
    closeImportModal()
  }

  if (!importModalOpen) return null

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
          className="bg-white dark:bg-dark-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-dark-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import Hosts</h2>
                <p className="text-sm text-gray-500 dark:text-dark-400">Import from SSH config or JSON file</p>
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
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {!importType && !importResults && (
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => setImportType('ssh-config')}
                  className="p-5 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors group"
                >
                  <FileText className="w-10 h-10 mx-auto mb-2 text-gray-400 dark:text-dark-400 group-hover:text-primary-500 transition-colors" />
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">SSH Config</h3>
                  <p className="text-xs text-gray-500 dark:text-dark-400">~/.ssh/config file</p>
                </button>
                <button
                  onClick={() => setImportType('json')}
                  className="p-5 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors group"
                >
                  <FileJson className="w-10 h-10 mx-auto mb-2 text-gray-400 dark:text-dark-400 group-hover:text-primary-500 transition-colors" />
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">JSON</h3>
                  <p className="text-xs text-gray-500 dark:text-dark-400">binsh export file</p>
                </button>
                <button
                  onClick={() => setImportType('csv')}
                  className="p-5 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors group"
                >
                  <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-gray-400 dark:text-dark-400 group-hover:text-primary-500 transition-colors" />
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">CSV</h3>
                  <p className="text-xs text-gray-500 dark:text-dark-400">Spreadsheet format</p>
                </button>
              </div>
            )}

            {importType && parsedHosts.length === 0 && !importResults && (
              <div className="text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={importType === 'json' ? '.json' : importType === 'csv' ? '.csv' : '.config,*'}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors w-full"
                >
                  <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-dark-400" />
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    Select {importType === 'ssh-config' ? 'SSH Config' : importType === 'csv' ? 'CSV' : 'JSON'} File
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-dark-400">
                    Click to browse or drag and drop
                  </p>
                </button>
                {importType === 'csv' && (
                  <p className="mt-3 text-xs text-gray-500 dark:text-dark-400">
                    CSV should have headers: label, address, port, username
                  </p>
                )}
                <button
                  onClick={() => setImportType(null)}
                  className="mt-4 text-sm text-gray-500 dark:text-dark-400 hover:text-primary-500"
                >
                  ← Back to options
                </button>
              </div>
            )}

            {parsedHosts.length > 0 && !importResults && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-500 dark:text-dark-400">
                    {parsedHosts.filter(h => h.selected).length} of {parsedHosts.length} selected
                  </span>
                  <div className="flex gap-2">
                    <button onClick={selectAll} className="text-sm text-primary-500 hover:underline">
                      Select All
                    </button>
                    <button onClick={deselectAll} className="text-sm text-gray-500 dark:text-dark-400 hover:underline">
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {parsedHosts.map((host, index) => (
                    <label
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        host.selected
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={host.selected}
                        onChange={() => toggleHost(index)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 text-primary-500 focus:ring-primary-500"
                      />
                      <Server className="w-4 h-4 text-gray-400 dark:text-dark-400" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{host.label}</p>
                        <p className="text-xs text-gray-500 dark:text-dark-400">
                          {host.username}@{host.address}:{host.port}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {importResults && (
              <div className="text-center py-8">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
                  importResults.failed === 0 ? 'bg-green-500/20' : 'bg-yellow-500/20'
                }`}>
                  {importResults.failed === 0 ? (
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-yellow-500" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Import Complete
                </h3>
                <p className="text-gray-500 dark:text-dark-400">
                  Successfully imported {importResults.success} hosts
                  {importResults.failed > 0 && `, ${importResults.failed} failed`}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {parsedHosts.length > 0 && !importResults && (
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-dark-700">
              <button
                onClick={() => {
                  setParsedHosts([])
                  setImportType(null)
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || parsedHosts.filter(h => h.selected).length === 0}
                className="btn btn-primary"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${parsedHosts.filter(h => h.selected).length} Hosts`
                )}
              </button>
            </div>
          )}

          {importResults && (
            <div className="flex justify-end p-6 border-t border-gray-200 dark:border-dark-700">
              <button onClick={handleClose} className="btn btn-primary">
                Done
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
