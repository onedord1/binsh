import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen,
  File,
  FileText,
  FileImage,
  FileCode,
  FileArchive,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Home,
  RefreshCw,
  Server,
  HardDrive,
  X,
  ArrowRight,
  Loader2,
  Search,
  Filter,
  MoreVertical,
  FolderPlus,
  Eye,
  EyeOff,
  Plus,
  Copy,
} from 'lucide-react'
import { sftp, hosts as hostsApi, type FileItem } from '../lib/api'
import type { Host } from '../types'

interface TransferItem {
  id: string
  fileName: string
  sourceHost: string
  sourcePath: string
  destHost: string
  destPath: string
  size: number
  transferred: number
  percent: number
  speed: number
  status: 'pending' | 'transferring' | 'completed' | 'failed'
  error?: string
}

interface PanelState {
  id: string
  hostId: string | null
  hostLabel: string
  currentPath: string
  files: FileItem[]
  loading: boolean
  error: string | null
  selectedFiles: Set<string>
  sortBy: 'name' | 'size' | 'date'
  sortDesc: boolean
  searchQuery: string
}

const createPanel = (id: string, hostId: string | null = null, hostLabel: string = 'Local'): PanelState => ({
  id,
  hostId,
  hostLabel,
  currentPath: hostId ? '~' : '/',
  files: [],
  loading: false,
  error: null,
  selectedFiles: new Set(),
  sortBy: 'name',
  sortDesc: false,
  searchQuery: '',
})

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '—'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatDate = (timestamp: number | string): string => {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getFileIcon = (file: FileItem) => {
  if (file.is_dir) return <FolderOpen className="w-5 h-5 text-yellow-400" />
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
    return <FileImage className="w-5 h-5 text-purple-400" />
  }
  if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes(ext)) {
    return <FileArchive className="w-5 h-5 text-orange-400" />
  }
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'css', 'html', 'json', 'yaml', 'yml', 'sh', 'bash'].includes(ext)) {
    return <FileCode className="w-5 h-5 text-green-400" />
  }
  if (['txt', 'md', 'log', 'conf', 'cfg', 'ini'].includes(ext)) {
    return <FileText className="w-5 h-5 text-blue-400" />
  }
  return <File className="w-5 h-5 text-gray-400 dark:text-dark-400" />
}

const getFileKind = (file: FileItem): string => {
  if (file.is_dir) return 'Folder'
  if (file.is_symlink) return 'Symlink'
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const kinds: Record<string, string> = {
    jpg: 'Image', jpeg: 'Image', png: 'Image', gif: 'Image', svg: 'Image', webp: 'Image',
    zip: 'Archive', tar: 'Archive', gz: 'Archive', rar: 'Archive', '7z': 'Archive',
    js: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript', py: 'Python', go: 'Go',
    txt: 'Text', md: 'Markdown', json: 'JSON', yaml: 'YAML', yml: 'YAML',
    pdf: 'PDF', doc: 'Document', docx: 'Document',
    mp3: 'Audio', wav: 'Audio', mp4: 'Video', mov: 'Video',
  }
  return kinds[ext] || ext.toUpperCase() || 'File'
}

export default function SFTPManagerMulti() {
  const navigate = useNavigate()
  const [hosts, setHosts] = useState<Host[]>([])
  const [showHostSelector, setShowHostSelector] = useState<string | null>(null)
  const [transfers, setTransfers] = useState<TransferItem[]>([])
  const [draggedFiles, setDraggedFiles] = useState<{ files: FileItem[]; sourcePanelId: string } | null>(null)
  const draggedFilesRef = useRef<{ files: FileItem[]; sourcePanelId: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [showHiddenFiles, setShowHiddenFiles] = useState(false)
  const [showNewFolderModal, setShowNewFolderModal] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [focusedPanelId, setFocusedPanelId] = useState<string>('panel-0')
  const nextPanelId = useRef(2)
  const transferAbortControllers = useRef<Map<string, AbortController>>(new Map())

  const [panels, setPanels] = useState<PanelState[]>([
    createPanel('panel-0', null, 'Local'),
    createPanel('panel-1', null, 'Connect to host'),
  ])

  useEffect(() => {
    hostsApi.list().then(setHosts).catch(console.error)
  }, [])

  useEffect(() => {
    loadFilesForPanel('panel-0', '/')
  }, [])

  const updatePanel = useCallback((panelId: string, updates: Partial<PanelState>) => {
    setPanels(prev => prev.map(p => 
      p.id === panelId ? { ...p, ...updates } : p
    ))
  }, [])


  const loadFilesForPanel = useCallback(async (panelId: string, path: string, overrideHostId?: string | null) => {
    const panel = panels.find(p => p.id === panelId)
    if (!panel) return

    // Use overrideHostId if provided (for when state hasn't updated yet)
    const hostId = overrideHostId !== undefined ? overrideHostId : panel.hostId

    updatePanel(panelId, { loading: true, error: null })

    try {
      let files: FileItem[]
      if (hostId) {
        files = await sftp.listRemote(hostId, path)
      } else {
        files = await sftp.listLocal(path)
      }
      
      if (!showHiddenFiles) {
        files = files.filter(f => !f.name.startsWith('.'))
      }
      
      updatePanel(panelId, { 
        files, 
        loading: false, 
        currentPath: path,
        selectedFiles: new Set()
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to load files'
      updatePanel(panelId, { loading: false, error })
    }
  }, [panels, showHiddenFiles, updatePanel])

  const navigateToPath = useCallback((panelId: string, path: string) => {
    loadFilesForPanel(panelId, path)
  }, [loadFilesForPanel])

  const navigateUp = useCallback((panelId: string) => {
    const panel = panels.find(p => p.id === panelId)
    if (!panel) return
    const parts = panel.currentPath.split('/').filter(Boolean)
    parts.pop()
    const newPath = '/' + parts.join('/')
    navigateToPath(panelId, newPath || '/')
  }, [panels, navigateToPath])

  const toggleFileSelection = (panelId: string, filePath: string, multiSelect: boolean) => {
    setPanels(prev => prev.map(p => {
      if (p.id !== panelId) return p
      const newSelected = new Set(multiSelect ? p.selectedFiles : [])
      if (newSelected.has(filePath)) {
        newSelected.delete(filePath)
      } else {
        newSelected.add(filePath)
      }
      return { ...p, selectedFiles: newSelected }
    }))
  }

  const handleDragStart = (panelId: string, files: FileItem[]) => {
    console.log('[DnD] Drag started from', panelId, 'with', files.length, 'files')
    const dragData = { files, sourcePanelId: panelId }
    draggedFilesRef.current = dragData
    setDraggedFiles(dragData)
  }

  const handleDragEnd = () => {
    draggedFilesRef.current = null
    setDraggedFiles(null)
    setDropTarget(null)
  }

  const handleDrop = async (targetPanelId: string) => {
    const currentDraggedFiles = draggedFilesRef.current
    console.log('[DnD] Drop on', targetPanelId, 'draggedFiles:', currentDraggedFiles)
    
    if (!currentDraggedFiles || currentDraggedFiles.sourcePanelId === targetPanelId) {
      handleDragEnd()
      return
    }

    const sourcePanel = panels.find(p => p.id === currentDraggedFiles.sourcePanelId)
    const destPanel = panels.find(p => p.id === targetPanelId)
    
    if (!sourcePanel || !destPanel) {
      handleDragEnd()
      return
    }

    for (const file of currentDraggedFiles.files) {
      const transferId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const destPath = destPanel.currentPath + '/' + file.name
      
      const newTransfer: TransferItem = {
        id: transferId,
        fileName: file.name,
        sourceHost: sourcePanel.hostId || 'local',
        sourcePath: file.path,
        destHost: destPanel.hostId || 'local',
        destPath,
        size: file.size,
        transferred: 0,
        percent: 0,
        speed: 0,
        status: 'pending',
      }
      
      setTransfers(prev => [...prev, newTransfer])
      executeTransfer(newTransfer, targetPanelId)
    }
    
    handleDragEnd()
  }

  const transferToAllPanels = (sourcePanelId: string) => {
    const sourcePanel = panels.find(p => p.id === sourcePanelId)
    if (!sourcePanel) return

    const selectedFiles = sourcePanel.files.filter(f => sourcePanel.selectedFiles.has(f.path))
    if (selectedFiles.length === 0) return

    const destPanels = panels.filter(p => p.id !== sourcePanelId && p.hostId)
    
    for (const destPanel of destPanels) {
      for (const file of selectedFiles) {
        const transferId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const destPath = destPanel.currentPath + '/' + file.name
        
        const newTransfer: TransferItem = {
          id: transferId,
          fileName: file.name,
          sourceHost: sourcePanel.hostId || 'local',
          sourcePath: file.path,
          destHost: destPanel.hostId || 'local',
          destPath,
          size: file.size,
          transferred: 0,
          percent: 0,
          speed: 0,
          status: 'pending',
        }
        
        setTransfers(prev => [...prev, newTransfer])
        executeTransfer(newTransfer, destPanel.id)
      }
    }
  }

  const executeTransfer = async (transfer: TransferItem, destPanelId: string) => {
    console.log('[Transfer] Starting transfer:', transfer)
    setTransfers(prev => prev.map(t => 
      t.id === transfer.id ? { ...t, status: 'transferring' } : t
    ))
    
    // Create AbortController for this transfer
    const abortController = new AbortController()
    transferAbortControllers.current.set(transfer.id, abortController)
    
    const token = localStorage.getItem('token')
    let lastTransferred = 0
    let lastTime = Date.now()
    
    try {
      const response = await fetch('/api/sftp/transfer/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          source_host: transfer.sourceHost,
          source_path: transfer.sourcePath,
          dest_host: transfer.destHost,
          dest_path: transfer.destPath,
          transfer_id: transfer.id,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`Transfer failed: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Streaming not supported')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              const now = Date.now()
              const timeDiff = (now - lastTime) / 1000
              const bytesDiff = data.transferred - lastTransferred
              const speed = timeDiff > 0 ? Math.round(bytesDiff / timeDiff) : 0
              
              lastTransferred = data.transferred
              lastTime = now

              setTransfers(prev => prev.map(t => 
                t.id === transfer.id ? {
                  ...t,
                  transferred: data.transferred,
                  percent: data.percent,
                  speed: speed,
                  status: data.status,
                  error: data.error || undefined,
                } : t
              ))

              if (data.status === 'completed') {
                const destPanel = panels.find(p => p.id === destPanelId)
                if (destPanel) {
                  loadFilesForPanel(destPanelId, destPanel.currentPath)
                }
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e)
            }
          }
        }
      }
    } catch (err: unknown) {
      // Clean up AbortController
      transferAbortControllers.current.delete(transfer.id)
      
      // Don't show error if aborted by user
      if (err instanceof Error && err.name === 'AbortError') {
        setTransfers(prev => prev.map(t => 
          t.id === transfer.id ? { ...t, status: 'failed', error: 'Cancelled' } : t
        ))
        return
      }
      
      const error = err instanceof Error ? err.message : 'Transfer failed'
      setTransfers(prev => prev.map(t => 
        t.id === transfer.id ? { ...t, status: 'failed', error } : t
      ))
    } finally {
      // Clean up AbortController on completion
      transferAbortControllers.current.delete(transfer.id)
    }
  }

  const addPanel = () => {
    const newId = `panel-${nextPanelId.current++}`
    setPanels(prev => [...prev, createPanel(newId, null, 'Connect to host')])
  }

  const removePanel = (panelId: string) => {
    if (panels.length <= 2) return
    setPanels(prev => prev.filter(p => p.id !== panelId))
    if (focusedPanelId === panelId) {
      setFocusedPanelId(panels[0].id)
    }
  }

  const connectHost = (panelId: string, host: Host) => {
    updatePanel(panelId, {
      hostId: host.id,
      hostLabel: host.label || host.address,
      currentPath: '~',
      files: [],
    })
    setShowHostSelector(null)
    // Pass host.id directly to avoid race condition with state update
    loadFilesForPanel(panelId, '~', host.id)
  }

  const disconnectHost = (panelId: string) => {
    updatePanel(panelId, {
      hostId: null,
      hostLabel: 'Local',
      currentPath: '/',
      files: [],
    })
    // Pass null explicitly to load local files
    loadFilesForPanel(panelId, '/', null)
  }

  const cancelTransfer = (id: string) => {
    // Abort the transfer if it's in progress
    const controller = transferAbortControllers.current.get(id)
    if (controller) {
      controller.abort()
      transferAbortControllers.current.delete(id)
    }
    // Remove from UI
    setTransfers(prev => prev.filter(t => t.id !== id))
  }

  const clearCompletedTransfers = () => {
    setTransfers(prev => prev.filter(t => t.status !== 'completed'))
  }

  const sortFiles = (files: FileItem[], sortBy: string, sortDesc: boolean): FileItem[] => {
    return [...files].sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
      let compare = 0
      switch (sortBy) {
        case 'name':
          compare = a.name.localeCompare(b.name)
          break
        case 'size':
          compare = a.size - b.size
          break
        case 'date':
          const aTime = typeof a.mod_time === 'string' ? new Date(a.mod_time).getTime() : a.mod_time
          const bTime = typeof b.mod_time === 'string' ? new Date(b.mod_time).getTime() : b.mod_time
          compare = aTime - bTime
          break
      }
      return sortDesc ? -compare : compare
    })
  }

  const filterFiles = (files: FileItem[], query: string): FileItem[] => {
    if (!query) return files
    return files.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
  }

  const renderPanel = (panel: PanelState) => {
    const isDropTarget = dropTarget === panel.id
    const files = filterFiles(sortFiles(panel.files, panel.sortBy, panel.sortDesc), panel.searchQuery)
    
    return (
      <div
        key={panel.id}
        className={`flex-1 min-w-[300px] flex flex-col bg-white dark:bg-dark-800 rounded-xl border transition-all duration-200 ${
          isDropTarget ? 'border-primary-500 bg-primary-500/5' : focusedPanelId === panel.id ? 'border-primary-500/50' : 'border-gray-200 dark:border-dark-700'
        }`}
        onClick={() => setFocusedPanelId(panel.id)}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (draggedFiles?.sourcePanelId !== panel.id) {
            setDropTarget(panel.id)
          }
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDropTarget(null)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleDrop(panel.id)
        }}
      >
        {/* Panel Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-dark-700">
          <button
            onClick={() => setShowHostSelector(panel.id)}
            className="flex items-center gap-2 px-2 py-1 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg transition-colors text-sm text-gray-900 dark:text-white"
          >
            {panel.hostId ? (
              <Server className="w-4 h-4 text-primary-400" />
            ) : (
              <HardDrive className="w-4 h-4 text-green-400" />
            )}
            <span className="font-medium truncate max-w-[120px]">{panel.hostLabel}</span>
            <ChevronRight className="w-3 h-3 text-gray-400 dark:text-dark-400" />
          </button>
          
          <div className="flex-1" />
          
          <button
            onClick={() => loadFilesForPanel(panel.id, panel.currentPath)}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-dark-700 rounded transition-colors text-gray-600 dark:text-gray-300"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${panel.loading ? 'animate-spin' : ''}`} />
          </button>
          
          {panels.length > 2 && (
            <button
              onClick={() => removePanel(panel.id)}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-dark-700 rounded transition-colors text-red-400"
              title="Remove panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Path Bar */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-200 dark:border-dark-700/50 bg-gray-50 dark:bg-dark-850 text-xs text-gray-700 dark:text-gray-300">
          <button
            onClick={() => navigateToPath(panel.id, panel.hostId ? '~' : '/')}
            className="p-1 hover:bg-gray-200 dark:hover:bg-dark-700 rounded transition-colors"
            title="Home"
          >
            <Home className="w-3 h-3" />
          </button>
          <button
            onClick={() => navigateUp(panel.id)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-dark-700 rounded transition-colors"
            title="Go up"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          
          <div className="flex-1 px-2 py-1 bg-gray-100 dark:bg-dark-900 rounded text-gray-600 dark:text-dark-400 truncate">
            {panel.currentPath}
          </div>
          
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-dark-500" />
            <input
              type="text"
              placeholder="Filter..."
              value={panel.searchQuery}
              onChange={(e) => updatePanel(panel.id, { searchQuery: e.target.value })}
              className="w-24 pl-6 pr-2 py-1 bg-gray-100 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:border-primary-500"
            />
          </div>
        </div>
        
        {/* Column Headers */}
        <div className="grid grid-cols-[1fr,80px,100px,60px] gap-1 px-3 py-1.5 text-[10px] text-gray-500 dark:text-dark-400 font-medium border-b border-gray-200 dark:border-dark-700/50">
          <button
            onClick={() => updatePanel(panel.id, {
              sortBy: 'name',
              sortDesc: panel.sortBy === 'name' ? !panel.sortDesc : false,
            })}
            className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors text-left"
          >
            Name
            {panel.sortBy === 'name' && (
              <ChevronUp className={`w-2 h-2 ${panel.sortDesc ? 'rotate-180' : ''}`} />
            )}
          </button>
          <span>Date</span>
          <span>Size</span>
          <span>Kind</span>
        </div>
        
        {/* File List */}
        <div 
          className="flex-1 overflow-auto"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDrop(panel.id) }}
        >
          {panel.loading && (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          )}
          
          {panel.error && (
            <div className="flex flex-col items-center justify-center h-24 text-red-400 text-sm">
              <p>{panel.error}</p>
              <button
                onClick={() => loadFilesForPanel(panel.id, panel.currentPath)}
                className="mt-2 px-2 py-1 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 rounded text-xs"
              >
                Retry
              </button>
            </div>
          )}
          
          {!panel.loading && !panel.error && files.length === 0 && (
            <div className="flex flex-col items-center justify-center h-24 text-dark-400 text-sm">
              <FolderOpen className="w-8 h-8 mb-1 opacity-50" />
              <p>Empty</p>
            </div>
          )}
          
          {!panel.loading && !panel.error && files.map((file) => (
            <div
              key={file.path}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'copy'
                e.dataTransfer.setData('text/plain', file.path)
                const selectedFiles = panel.selectedFiles.has(file.path)
                  ? files.filter(f => panel.selectedFiles.has(f.path))
                  : [file]
                handleDragStart(panel.id, selectedFiles)
              }}
              onDragEnd={handleDragEnd}
              onClick={(e) => toggleFileSelection(panel.id, file.path, e.ctrlKey || e.metaKey)}
              onDoubleClick={() => {
                if (file.is_dir) {
                  navigateToPath(panel.id, file.path)
                }
              }}
              className={`grid grid-cols-[1fr,80px,100px,60px] gap-1 px-3 py-1.5 text-xs text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-dark-700/50 cursor-grab active:cursor-grabbing transition-colors ${
                panel.selectedFiles.has(file.path) ? 'bg-primary-500/10 hover:bg-primary-500/20' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {getFileIcon(file)}
                <span className="truncate">{file.name}</span>
              </div>
              <span className="text-gray-500 dark:text-dark-400 truncate">{formatDate(file.mod_time)}</span>
              <span className="text-gray-500 dark:text-dark-400">{file.is_dir ? '—' : formatFileSize(file.size)}</span>
              <span className="text-gray-400 dark:text-dark-500 truncate">{getFileKind(file)}</span>
            </div>
          ))}
        </div>
        
        {/* Panel Footer */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-200 dark:border-dark-700/50 text-[10px] text-gray-500 dark:text-dark-400">
          <span>{files.length} items</span>
          {panel.selectedFiles.size > 0 && (
            <span>{panel.selectedFiles.size} selected</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-dark-900">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/hosts')}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-dark-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">SFTP Transfer Manager</h1>
            <p className="text-xs text-gray-500 dark:text-dark-400">Transfer files to multiple destinations</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={addPanel}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Panel</span>
          </button>
          
          <button
            onClick={() => transferToAllPanels(focusedPanelId)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 rounded-lg transition-colors text-sm text-gray-900 dark:text-white"
            title="Transfer selected files to all connected panels"
          >
            <Copy className="w-4 h-4" />
            <span>Transfer to All</span>
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 rounded-lg transition-colors text-sm text-gray-900 dark:text-white"
            >
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </button>
            <AnimatePresence>
              {showFilterMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl shadow-xl z-50 py-2"
                >
                  <button
                    onClick={() => {
                      setShowHiddenFiles(!showHiddenFiles)
                      setShowFilterMenu(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors text-left text-sm text-gray-900 dark:text-white"
                  >
                    {showHiddenFiles ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    <span>{showHiddenFiles ? 'Hide Hidden' : 'Show Hidden'}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 rounded-lg transition-colors text-sm text-gray-900 dark:text-white"
            >
              <MoreVertical className="w-4 h-4" />
              <span>Actions</span>
            </button>
            <AnimatePresence>
              {showActionsMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl shadow-xl z-50 py-2"
                >
                  <button
                    onClick={() => {
                      setShowNewFolderModal(focusedPanelId)
                      setShowActionsMenu(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors text-left text-sm text-gray-900 dark:text-white"
                  >
                    <FolderPlus className="w-4 h-4 text-yellow-400" />
                    <span>New Folder</span>
                  </button>
                  <button
                    onClick={() => {
                      panels.forEach(p => loadFilesForPanel(p.id, p.currentPath))
                      setShowActionsMenu(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors text-left text-sm text-gray-900 dark:text-white"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh All</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Host Selector Modal */}
      <AnimatePresence>
        {showHostSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowHostSelector(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 w-full max-w-md shadow-2xl max-h-[70vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">Select Host</h3>
                <button
                  onClick={() => setShowHostSelector(null)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-dark-700 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-2 max-h-[50vh] overflow-auto">
                <button
                  onClick={() => {
                    if (showHostSelector) disconnectHost(showHostSelector)
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                >
                  <HardDrive className="w-5 h-5 text-green-400" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-white">Local</div>
                    <div className="text-sm text-gray-500 dark:text-dark-400">Local filesystem</div>
                  </div>
                </button>
                {hosts.map(host => (
                  <button
                    key={host.id}
                    onClick={() => {
                      if (showHostSelector) connectHost(showHostSelector, host)
                    }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    <Server className="w-5 h-5 text-primary-400" />
                    <div className="text-left">
                      <div className="font-medium text-gray-900 dark:text-white">{host.label || host.address}</div>
                      <div className="text-sm text-gray-500 dark:text-dark-400">{host.username}@{host.address}</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Folder Modal */}
      <AnimatePresence>
        {showNewFolderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowNewFolderModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">Create New Folder</h3>
                <button
                  onClick={() => setShowNewFolderModal(null)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-dark-700 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <input
                  type="text"
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-primary-500"
                  autoFocus
                />
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setShowNewFolderModal(null)}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 rounded-lg transition-colors text-gray-900 dark:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const panelId = showNewFolderModal
                      const panel = panels.find(p => p.id === panelId)
                      if (!panel || !newFolderName) return
                      
                      const path = panel.currentPath + '/' + newFolderName
                      try {
                        if (panel.hostId) {
                          await sftp.mkdirRemote(panel.hostId, path)
                        } else {
                          await sftp.mkdirLocal(path)
                        }
                        loadFilesForPanel(panelId, panel.currentPath)
                      } catch (err) {
                        console.error('Failed to create folder:', err)
                      }
                      setNewFolderName('')
                      setShowNewFolderModal(null)
                    }}
                    className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
                  >
                    Create
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panels */}
      <div className="flex-1 flex gap-2 p-2 overflow-auto">
        {panels.map((panel) => renderPanel(panel))}
      </div>

      {/* Transfer Queue */}
      {transfers.length > 0 && (
        <div className="border-t border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-dark-700/50">
            <span className="text-sm font-medium text-gray-900 dark:text-white">Transfers ({transfers.length})</span>
            <button
              onClick={clearCompletedTransfers}
              className="text-xs text-gray-500 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Clear completed
            </button>
          </div>
          <div className="max-h-32 overflow-auto">
            {transfers.map(transfer => (
              <div key={transfer.id} className="flex items-center gap-3 px-4 py-2 border-b border-gray-200/50 dark:border-dark-700/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate">{transfer.fileName}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400 dark:text-dark-400 flex-shrink-0" />
                    <span className="text-gray-500 dark:text-dark-400 truncate">{transfer.destHost}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          transfer.status === 'completed' ? 'bg-green-500' :
                          transfer.status === 'failed' ? 'bg-red-500' : 'bg-primary-500'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${transfer.percent}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-dark-400 w-20 text-right">
                      {formatFileSize(transfer.transferred)} / {formatFileSize(transfer.size)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {transfer.status === 'transferring' && (
                    <span className="text-xs text-gray-500 dark:text-dark-400">{formatFileSize(transfer.speed)}/s</span>
                  )}
                  {transfer.status === 'completed' && (
                    <span className="text-xs text-green-400">✓ Completed</span>
                  )}
                  {transfer.status === 'failed' && (
                    <span className="text-xs text-red-400">✗ Failed</span>
                  )}
                  <button
                    onClick={() => cancelTransfer(transfer.id)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-dark-700 rounded transition-colors text-gray-600 dark:text-gray-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
