import { motion } from 'framer-motion'
import { X, Check } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import HostForm from './forms/HostForm'
import GroupForm from './forms/GroupForm'

// Shared id linking the header Save button to the active form so the button
// can live in the header (next to the close button) while the form is a child.
export const SIDE_PANEL_FORM_ID = 'side-panel-form'

export default function SidePanel() {
  const { sidePanel, closeSidePanel } = useAppStore()

  const getTitle = () => {
    if (sidePanel.type === 'host') {
      return sidePanel.mode === 'create' ? 'New Host' : 'Edit Host'
    }
    if (sidePanel.type === 'group') {
      return sidePanel.mode === 'create' ? 'New Group' : 'Edit Group'
    }
    return ''
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-gray-900/30 dark:bg-dark-950/60 backdrop-blur-sm z-40"
        onClick={closeSidePanel}
      />
      
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-[420px] bg-white dark:bg-dark-850 border-l border-gray-200 dark:border-dark-700/50 z-50 flex flex-col shadow-2xl shadow-gray-300/50 dark:shadow-dark-950/50"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700/50">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{getTitle()}</h3>
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">
              {sidePanel.type === 'host' 
                ? 'Configure SSH connection settings' 
                : 'Organize your hosts into groups'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              form={SIDE_PANEL_FORM_ID}
              title="Save"
              className="p-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/25 transition-colors"
            >
              <Check className="w-5 h-5" />
            </button>
            <button
              onClick={closeSidePanel}
              title="Close"
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-700/50 text-gray-400 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {sidePanel.type === 'host' && <HostForm />}
          {sidePanel.type === 'group' && <GroupForm />}
        </div>
      </motion.div>
    </>
  )
}
