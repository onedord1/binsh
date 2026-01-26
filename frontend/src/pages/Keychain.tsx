import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Key,
  Lock,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  FileKey,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { keychain } from '../lib/api'
import type { Keychain as KeychainType } from '../types'

export default function Keychain() {
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedType, setSelectedType] = useState<'password' | 'key'>('password')
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set())

  const [form, setForm] = useState({
    label: '',
    username: '',
    password: '',
    private_key: '',
    passphrase: '',
  })

  const { data: keychainList = [], isLoading } = useQuery<KeychainType[]>({
    queryKey: ['keychain'],
    queryFn: keychain.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<KeychainType>) => keychain.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keychain'] })
      toast.success('Credential saved to vault')
      setShowAddModal(false)
      resetForm()
    },
    onError: () => {
      toast.error('Failed to save credential')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: keychain.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keychain'] })
      toast.success('Credential deleted')
    },
    onError: () => {
      toast.error('Failed to delete credential')
    },
  })

  const resetForm = () => {
    setForm({
      label: '',
      username: '',
      password: '',
      private_key: '',
      passphrase: '',
    })
    setSelectedType('password')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.label) {
      toast.error('Label is required')
      return
    }

    createMutation.mutate({
      ...form,
      type: selectedType,
    })
  }

  const toggleVisibility = (id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Keychain</h2>
          <p className="text-sm text-gray-500 dark:text-dark-400">Securely store your credentials in the vault</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Add Credential
        </button>
      </div>

      {keychainList.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center h-96"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-purple/20 to-accent-pink/20 border border-accent-purple/30 flex items-center justify-center mb-6">
            <Shield className="w-10 h-10 text-accent-purple" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Secure Vault</h2>
          <p className="text-gray-500 dark:text-dark-400 mb-6 text-center max-w-md">
            Store your SSH keys and passwords securely with AES-256 encryption.
          </p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-lg">
            <Plus className="w-5 h-5" />
            Add Your First Credential
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {keychainList.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card card-hover group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      item.type === 'key'
                        ? 'bg-accent-cyan/20 border border-accent-cyan/30'
                        : 'bg-accent-purple/20 border border-accent-purple/30'
                    }`}
                  >
                    {item.type === 'key' ? (
                      <FileKey className="w-6 h-6 text-accent-cyan" />
                    ) : (
                      <Lock className="w-6 h-6 text-accent-purple" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{item.label}</h3>
                    <p className="text-sm text-gray-500 dark:text-dark-400">{item.type === 'key' ? 'SSH Key' : 'Password'}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${item.label}"?`)) {
                      deleteMutation.mutate(item.id)
                    }
                  }}
                  className="p-2 rounded-lg text-gray-400 dark:text-dark-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {item.username && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 dark:text-dark-400 mb-1">Username</p>
                  <p className="text-sm text-white font-mono bg-dark-800/50 px-2 py-1 rounded">
                    {item.username}
                  </p>
                </div>
              )}

              {item.type === 'password' && item.password && (
                <div>
                  <p className="text-xs text-dark-400 mb-1">Password</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-sm text-white font-mono bg-dark-800/50 px-2 py-1 rounded">
                      {visibleIds.has(item.id) ? item.password : '••••••••••••'}
                    </p>
                    <button
                      onClick={() => toggleVisibility(item.id)}
                      className="p-1 text-dark-400 hover:text-white transition-colors"
                    >
                      {visibleIds.has(item.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {item.type === 'key' && (
                <div>
                  <p className="text-xs text-dark-400 mb-1">Private Key</p>
                  <p className="text-sm text-dark-300 font-mono bg-dark-800/50 px-2 py-1 rounded truncate">
                    {visibleIds.has(item.id) ? item.private_key?.substring(0, 50) + '...' : '••••••••••••'}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-dark-950/60 backdrop-blur-sm z-40"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
            >
              <div className="w-full max-w-md bg-dark-850 border border-dark-700/50 rounded-2xl shadow-2xl">
                <div className="p-6 border-b border-dark-700/50">
                  <h3 className="text-xl font-semibold text-white">Add Credential</h3>
                  <p className="text-sm text-dark-400 mt-1">Store securely in the vault</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="label">Label</label>
                    <input
                      type="text"
                      value={form.label}
                      onChange={(e) => setForm({ ...form, label: e.target.value })}
                      placeholder="My SSH Key"
                      className="input"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="label">Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'password', label: 'Password', icon: Lock },
                        { id: 'key', label: 'SSH Key', icon: FileKey },
                      ].map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setSelectedType(type.id as 'password' | 'key')}
                          className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                            selectedType === type.id
                              ? 'bg-primary-500/10 border-primary-500/50 text-primary-400'
                              : 'bg-dark-800/50 border-dark-700 text-dark-400 hover:border-dark-600'
                          }`}
                        >
                          <type.icon className="w-5 h-5" />
                          <span className="text-sm font-medium">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label">Username (optional)</label>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder="root"
                      className="input"
                    />
                  </div>

                  {selectedType === 'password' && (
                    <div>
                      <label className="label">Password</label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="••••••••"
                        className="input"
                      />
                    </div>
                  )}

                  {selectedType === 'key' && (
                    <>
                      <div>
                        <label className="label">Private Key</label>
                        <textarea
                          value={form.private_key}
                          onChange={(e) => setForm({ ...form, private_key: e.target.value })}
                          placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                          className="input min-h-[120px] resize-none font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="label">Passphrase (optional)</label>
                        <input
                          type="password"
                          value={form.passphrase}
                          onChange={(e) => setForm({ ...form, passphrase: e.target.value })}
                          placeholder="••••••••"
                          className="input"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false)
                        resetForm()
                      }}
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
                        <>
                          <Key className="w-4 h-4" />
                          Save to Vault
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
