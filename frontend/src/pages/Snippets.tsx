import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Code2, Plus, Trash2, Copy, Check, Pencil, Terminal } from 'lucide-react'
import toast from 'react-hot-toast'
import { snippets } from '../lib/api'
import type { Snippet } from '../types'

export default function Snippets() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Snippet | null>(null)
  const [form, setForm] = useState({ label: '', content: '', description: '' })

  const { data: snippetList = [], isLoading } = useQuery<Snippet[]>({
    queryKey: ['snippets'],
    queryFn: snippets.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Snippet>) => snippets.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snippets'] })
      toast.success(editingSnippet ? 'Snippet updated' : 'Snippet created')
      closeModal()
    },
    onError: () => toast.error('Failed to save snippet'),
  })

  const deleteMutation = useMutation({
    mutationFn: snippets.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snippets'] })
      toast.success('Snippet deleted')
      setDeleteConfirm(null)
    },
    onError: () => toast.error('Failed to delete snippet'),
  })

  const openModal = (snippet?: Snippet) => {
    if (snippet) {
      setEditingSnippet(snippet)
      setForm({ label: snippet.label, content: snippet.content, description: snippet.description || '' })
    } else {
      setEditingSnippet(null)
      setForm({ label: '', content: '', description: '' })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingSnippet(null)
    setForm({ label: '', content: '', description: '' })
  }

  const handleCopy = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.label || !form.content) {
      toast.error('Label and content are required')
      return
    }
    createMutation.mutate(form)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Snippets</h2>
          <p className="text-sm text-gray-500 dark:text-dark-400">Save frequently used commands</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Add Snippet
        </button>
      </div>

      {snippetList.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center h-96"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-orange/20 to-accent-pink/20 border border-accent-orange/30 flex items-center justify-center mb-6">
            <Code2 className="w-10 h-10 text-accent-orange" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Command Snippets</h2>
          <p className="text-gray-500 dark:text-dark-400 mb-6 text-center max-w-md">
            Save your frequently used commands for quick access.
          </p>
          <button onClick={() => openModal()} className="btn btn-primary btn-lg">
            <Plus className="w-5 h-5" />
            Create Your First Snippet
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {snippetList.map((snippet) => (
            <motion.div
              key={snippet.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card card-hover group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-orange/20 border border-accent-orange/30 flex items-center justify-center">
                    <Code2 className="w-5 h-5 text-accent-orange" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{snippet.label}</h3>
                    {snippet.description && (
                      <p className="text-xs text-gray-500 dark:text-dark-400">{snippet.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleCopy(snippet.id, snippet.content)}
                    className="p-2 rounded-lg text-gray-400 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-700/50 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedId === snippet.id ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => openModal(snippet)}
                    className="p-2 rounded-lg text-gray-400 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-700/50 transition-colors"
                    title="Edit snippet"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(snippet)}
                    className="p-2 rounded-lg text-gray-400 dark:text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete snippet"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <pre className="bg-gray-100 dark:bg-dark-900 rounded-lg p-3 text-sm font-mono text-gray-700 dark:text-dark-200 overflow-x-auto">
                {snippet.content}
              </pre>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
            >
              <div className="w-full max-w-lg bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-2xl shadow-2xl">
                <div className="flex items-center gap-3 p-6 border-b border-gray-100 dark:border-dark-700">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                    <Terminal className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {editingSnippet ? 'Edit Snippet' : 'Create Snippet'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-dark-400">Save a command for quick access</p>
                  </div>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="label">Label</label>
                    <input
                      type="text"
                      value={form.label}
                      onChange={(e) => setForm({ ...form, label: e.target.value })}
                      placeholder="Deploy script"
                      className="input"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="label">Description (optional)</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Deploys the production app"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Command</label>
                    <textarea
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      placeholder="cd /var/www && git pull && npm run build"
                      className="input min-h-[120px] resize-none font-mono text-sm"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="btn btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="btn btn-primary flex-1"
                    >
                      {createMutation.isPending ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        editingSnippet ? 'Save Changes' : 'Create Snippet'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Snippet</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-400">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-dark-300 mb-6">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-gray-900 dark:text-white">"{deleteConfirm.label}"</span>?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirm.id)}
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
