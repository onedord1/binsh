import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Server,
  User,
  Lock,
  Key,
  FolderOpen,
  Terminal,
  Globe,
  Shield,
  ChevronDown,
  ChevronUp,
  Palette,
  KeyRound,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '../../stores/appStore'
import { hosts, groups, keychain } from '../../lib/api'
import type { Host, Group, Keychain } from '../../types'

const authMethods = [
  { id: 'password', label: 'Password', icon: Lock },
  { id: 'key', label: 'SSH Key', icon: Key },
  { id: 'agent', label: 'SSH Agent', icon: Shield },
]

export default function HostForm() {
  const queryClient = useQueryClient()
  const { sidePanel, closeSidePanel } = useAppStore()
  const editHost = sidePanel.data as Host | null
  const isEdit = sidePanel.mode === 'edit' && editHost

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [form, setForm] = useState({
    label: '',
    address: '',
    port: 22,
    username: 'root',
    auth_method: 'password' as 'password' | 'key' | 'agent',
    password: '',
    ssh_key_path: '',
    ssh_key: '',
    passphrase: '',
    group_id: '',
    tags: [] as string[],
    startup_command: '',
    agent_forwarding: false,
    host_checking: false,
    utf8: true,
    mosh: false,
    theme: 'binsh-dark',
    env_vars: '',
  })

  const { data: groupList = [] } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: groups.list,
  })

  const { data: keychainList = [] } = useQuery<Keychain[]>({
    queryKey: ['keychain'],
    queryFn: keychain.list,
  })

  const passwordCredentials = keychainList.filter(k => k.type === 'password')
  const keyCredentials = keychainList.filter(k => k.type === 'key')

  useEffect(() => {
    if (isEdit && editHost) {
      setForm({
        label: editHost.label || '',
        address: editHost.address || '',
        port: editHost.port || 22,
        username: editHost.username || 'root',
        auth_method: editHost.auth_method || 'password',
        password: editHost.password || '',
        ssh_key_path: editHost.ssh_key_path || '',
        ssh_key: editHost.ssh_key || '',
        passphrase: editHost.passphrase || '',
        group_id: editHost.group_id || '',
        tags: editHost.tags || [],
        startup_command: editHost.startup_command || '',
        agent_forwarding: editHost.agent_forwarding || false,
        host_checking: editHost.host_checking || false,
        utf8: editHost.utf8 ?? true,
        mosh: editHost.mosh || false,
        theme: editHost.theme || 'systask-dark',
        env_vars: editHost.env_vars || '',
      })
    }
  }, [isEdit, editHost])

  const createMutation = useMutation({
    mutationFn: (data: Partial<Host>) => hosts.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      toast.success('Host created successfully')
      closeSidePanel()
    },
    onError: () => {
      toast.error('Failed to create host')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Host>) => hosts.update(editHost!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      toast.success('Host updated successfully')
      closeSidePanel()
    },
    onError: () => {
      toast.error('Failed to update host')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.address) {
      toast.error('Address is required')
      return
    }

    const data = {
      ...form,
      label: form.label || form.address,
    }

    if (isEdit) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary-500/10 to-accent-cyan/10 dark:from-primary-500/20 dark:to-accent-cyan/20 border border-primary-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-cyan flex items-center justify-center">
              <Server className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Address</h4>
              <p className="text-xs text-gray-500 dark:text-dark-400">IP or hostname</p>
            </div>
          </div>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="192.168.1.1 or server.example.com"
            className="input"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Label</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="My Server"
              className="input"
            />
          </div>
          <div>
            <label className="label">Port</label>
            <input
              type="number"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 22 })}
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="label">Group</label>
          <div className="relative">
            <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
            <select
              value={form.group_id}
              onChange={(e) => setForm({ ...form, group_id: e.target.value })}
              className="input pl-10 appearance-none cursor-pointer"
            >
              <option value="">Ungrouped</option>
              {groupList.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" />
          </div>
          {!form.group_id && groupList.length === 0 && (
            <p className="text-xs text-yellow-500/80 mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              No groups found. Host will be added to "Ungrouped"
            </p>
          )}
        </div>

        <div className="divider" />

        <div>
          <label className="label flex items-center gap-2">
            <User className="w-4 h-4" />
            Username
          </label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="root"
            className="input"
          />
        </div>

        <div>
          <label className="label">Authentication Method</label>
          <div className="grid grid-cols-3 gap-2">
            {authMethods.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setForm({ ...form, auth_method: method.id as typeof form.auth_method })}
                className={`p-3 rounded-xl border transition-all duration-200 flex flex-col items-center gap-2 ${
                  form.auth_method === method.id
                    ? 'bg-primary-500/10 border-primary-500/50 text-primary-500'
                    : 'bg-white dark:bg-dark-800/50 border-gray-200 dark:border-dark-700 text-gray-500 dark:text-dark-400 hover:border-gray-300 dark:hover:border-dark-600'
                }`}
              >
                <method.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{method.label}</span>
              </button>
            ))}
          </div>
        </div>

        {form.auth_method === 'password' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            {passwordCredentials.length > 0 && (
              <div>
                <label className="label flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Use from Keychain
                </label>
                <select
                  onChange={(e) => {
                    const cred = passwordCredentials.find(c => c.id === e.target.value)
                    if (cred) {
                      setForm({ 
                        ...form, 
                        password: cred.password || '',
                        username: cred.username || form.username
                      })
                      toast.success(`Loaded credentials from "${cred.label}"`)
                    }
                  }}
                  className="input appearance-none cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>Select saved credential...</option>
                  {passwordCredentials.map((cred) => (
                    <option key={cred.id} value={cred.id}>
                      {cred.label} {cred.username ? `(${cred.username})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="input"
              />
            </div>
          </motion.div>
        )}

        {form.auth_method === 'key' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {keyCredentials.length > 0 && (
              <div>
                <label className="label flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Use from Keychain
                </label>
                <select
                  onChange={(e) => {
                    const cred = keyCredentials.find(c => c.id === e.target.value)
                    if (cred) {
                      setForm({ 
                        ...form, 
                        ssh_key: cred.private_key || '',
                        passphrase: cred.passphrase || '',
                        ssh_key_path: '',
                      })
                      toast.success(`Loaded SSH key from "${cred.label}"`)
                    }
                  }}
                  className="input appearance-none cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>Select saved SSH key...</option>
                  {keyCredentials.map((cred) => (
                    <option key={cred.id} value={cred.id}>
                      {cred.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label flex items-center gap-2">
                <Key className="w-4 h-4" />
                SSH Key Path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.ssh_key_path}
                  onChange={(e) => setForm({ ...form, ssh_key_path: e.target.value })}
                  placeholder="~/.ssh/id_rsa"
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = '.pem,.pub,.key,*'
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (file) {
                        // Read the file content and store the path
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          const content = event.target?.result as string
                          setForm({ 
                            ...form, 
                            ssh_key_path: file.name,
                            ssh_key: content 
                          })
                          toast.success(`Loaded key from ${file.name}`)
                        }
                        reader.readAsText(file)
                      }
                    }
                    input.click()
                  }}
                  className="btn btn-secondary px-3"
                  title="Browse for SSH key file"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">Or paste key content below</p>
            </div>
            {form.ssh_key && (
              <div>
                <label className="label">SSH Key Content</label>
                <textarea
                  value={form.ssh_key}
                  onChange={(e) => setForm({ ...form, ssh_key: e.target.value })}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                  className="input min-h-[80px] resize-none font-mono text-xs"
                />
              </div>
            )}
            <div>
              <label className="label">Key Passphrase (optional)</label>
              <input
                type="password"
                value={form.passphrase}
                onChange={(e) => setForm({ ...form, passphrase: e.target.value })}
                placeholder="••••••••"
                className="input"
              />
            </div>
          </motion.div>
        )}
      </div>

      <div className="divider" />

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-100 dark:bg-dark-800/30 hover:bg-gray-200 dark:hover:bg-dark-800/50 transition-colors border border-gray-200 dark:border-transparent"
      >
        <span className="text-sm font-medium text-gray-700 dark:text-dark-300">Advanced Settings</span>
        {showAdvanced ? (
          <ChevronUp className="w-4 h-4 text-gray-500 dark:text-dark-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-dark-400" />
        )}
      </button>

      {showAdvanced && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-4"
        >
          <div>
            <label className="label flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Startup Command
            </label>
            <input
              type="text"
              value={form.startup_command}
              onChange={(e) => setForm({ ...form, startup_command: e.target.value })}
              placeholder="cd /var/www && ls -la"
              className="input"
            />
          </div>

          <div>
            <label className="label flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Environment Variables
            </label>
            <textarea
              value={form.env_vars}
              onChange={(e) => setForm({ ...form, env_vars: e.target.value })}
              placeholder="KEY=value&#10;ANOTHER_KEY=value"
              className="input min-h-[80px] resize-none"
            />
          </div>

          <div>
            <label className="label flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Terminal Theme
            </label>
            <select
              value={form.theme}
              onChange={(e) => setForm({ ...form, theme: e.target.value })}
              className="input appearance-none cursor-pointer"
            >
              <option value="binsh-dark">binsh Dark</option>
              <option value="binsh-light">binsh Light</option>
              <option value="dracula">Dracula</option>
              <option value="monokai">Monokai</option>
              <option value="nord">Nord</option>
              <option value="one-dark">One Dark</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'agent_forwarding', label: 'Agent Forwarding' },
              { key: 'host_checking', label: 'Host Key Checking' },
              { key: 'utf8', label: 'UTF-8 Support' },
              { key: 'mosh', label: 'Use Mosh' },
            ].map((option) => (
              <label
                key={option.key}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-100 dark:bg-dark-800/30 cursor-pointer hover:bg-gray-200 dark:hover:bg-dark-800/50 transition-colors border border-gray-200 dark:border-transparent"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  form[option.key as keyof typeof form]
                    ? 'bg-primary-500 border-primary-500'
                    : 'bg-white dark:bg-dark-800 border-gray-300 dark:border-dark-600'
                }`}>
                  {form[option.key as keyof typeof form] && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={form[option.key as keyof typeof form] as boolean}
                  onChange={(e) => setForm({ ...form, [option.key]: e.target.checked })}
                  className="sr-only"
                />
                <span className="text-sm text-gray-700 dark:text-dark-300">{option.label}</span>
              </label>
            ))}
          </div>
        </motion.div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={closeSidePanel}
          className="btn btn-secondary flex-1"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary flex-1"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isEdit ? (
            'Save Changes'
          ) : (
            'Create Host'
          )}
        </button>
      </div>
    </form>
  )
}
