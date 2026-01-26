import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Radio, SplitSquareHorizontal, SplitSquareVertical } from 'lucide-react'
import { useTerminalStore, type TerminalTab } from '../../stores/terminalStore'

interface TabBarProps {
  onSplitHorizontal: () => void
  onSplitVertical: () => void
  onAddHost: () => void
}

export default function TabBar({ onSplitHorizontal, onSplitVertical, onAddHost }: TabBarProps) {
  const {
    tabs,
    activeTabId,
    broadcastMode,
    createTab,
    closeTab,
    setActiveTab,
    renameTab,
    toggleBroadcastMode,
  } = useTerminalStore()

  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDoubleClick = (tab: TerminalTab) => {
    setEditingTabId(tab.id)
    setEditValue(tab.label)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleRename = (tabId: string) => {
    if (editValue.trim()) {
      renameTab(tabId, editValue.trim())
    }
    setEditingTabId(null)
  }

  const handleNewTab = () => {
    createTab('New Tab')
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-dark-850 border-b border-dark-700/50">
      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto flex-1 scrollbar-none">
        <AnimatePresence mode="popLayout">
          {tabs.map((tab) => (
            <motion.div
              key={tab.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                tab.id === activeTabId
                  ? 'bg-dark-700 text-white'
                  : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
              }`}
              onClick={() => setActiveTab(tab.id)}
              onDoubleClick={() => handleDoubleClick(tab)}
            >
              {editingTabId === tab.id ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleRename(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(tab.id)
                    if (e.key === 'Escape') setEditingTabId(null)
                  }}
                  className="bg-transparent border-none outline-none w-24 text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate max-w-[120px]">{tab.label}</span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-dark-600 rounded transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* New tab button */}
        <button
          onClick={handleNewTab}
          className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700/50 rounded-lg transition-colors"
          title="New Tab"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-dark-700" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Add Host */}
        <button
          onClick={onAddHost}
          className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700/50 rounded-lg transition-colors"
          title="Add Host to Tab"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Split Horizontal */}
        <button
          onClick={onSplitHorizontal}
          className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700/50 rounded-lg transition-colors"
          title="Split Horizontal"
        >
          <SplitSquareHorizontal className="w-4 h-4" />
        </button>

        {/* Split Vertical */}
        <button
          onClick={onSplitVertical}
          className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700/50 rounded-lg transition-colors"
          title="Split Vertical"
        >
          <SplitSquareVertical className="w-4 h-4" />
        </button>

        {/* Broadcast Mode */}
        <button
          onClick={toggleBroadcastMode}
          className={`p-1.5 rounded-lg transition-colors ${
            broadcastMode
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
          }`}
          title={broadcastMode ? 'Disable Broadcast Mode' : 'Enable Broadcast Mode'}
        >
          <Radio className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
