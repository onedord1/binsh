import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Folder,
  Cloud,
  ChevronDown,
  Globe,
  Key,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '../../stores/appStore'
import { groups } from '../../lib/api'
import type { Group } from '../../types'

const groupColors = [
  { id: 'blue', color: '#3b82f6' },
  { id: 'purple', color: '#8b5cf6' },
  { id: 'pink', color: '#ec4899' },
  { id: 'red', color: '#ef4444' },
  { id: 'orange', color: '#f97316' },
  { id: 'yellow', color: '#eab308' },
  { id: 'green', color: '#22c55e' },
  { id: 'cyan', color: '#06b6d4' },
]

const cloudProviders = [
  { id: '', label: 'None' },
  { id: 'aws', label: 'AWS' },
  { id: 'digitalocean', label: 'DigitalOcean' },
  { id: 'azure', label: 'Azure' },
  { id: 'gcp', label: 'Google Cloud' },
]

export default function GroupForm() {
  const queryClient = useQueryClient()
  const { sidePanel, closeSidePanel } = useAppStore()
  const editGroup = sidePanel.data as Group | null
  const isEdit = sidePanel.mode === 'edit' && editGroup

  const [form, setForm] = useState({
    label: '',
    color: '#3b82f6',
    icon: 'folder',
    cloud_sync: false,
    cloud_provider: '',
    cloud_config: {
      region: '',
      access_key_id: '',
      secret_access_key: '',
      service: '',
      ip_address_type: 'public',
    },
  })

  useEffect(() => {
    if (isEdit && editGroup) {
      setForm({
        label: editGroup.label || '',
        color: editGroup.color || '#3b82f6',
        icon: editGroup.icon || 'folder',
        cloud_sync: editGroup.cloud_sync || false,
        cloud_provider: editGroup.cloud_provider || '',
        cloud_config: {
          region: editGroup.cloud_config?.region || '',
          access_key_id: editGroup.cloud_config?.access_key_id || '',
          secret_access_key: editGroup.cloud_config?.secret_access_key || '',
          service: editGroup.cloud_config?.service || '',
          ip_address_type: editGroup.cloud_config?.ip_address_type || 'public',
        },
      })
    }
  }, [isEdit, editGroup])

  const createMutation = useMutation({
    mutationFn: (data: Partial<Group>) => groups.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast.success('Group created successfully')
      closeSidePanel()
    },
    onError: () => {
      toast.error('Failed to create group')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Group>) => groups.update(editGroup!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast.success('Group updated successfully')
      closeSidePanel()
    },
    onError: () => {
      toast.error('Failed to update group')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.label) {
      toast.error('Group name is required')
      return
    }

    const data = {
      ...form,
      cloud_config: form.cloud_sync ? form.cloud_config : undefined,
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
        <div className="p-4 rounded-xl bg-gradient-to-br from-accent-purple/10 to-accent-pink/10 border border-accent-purple/20">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: form.color + '20' }}
            >
              <Folder className="w-5 h-5" style={{ color: form.color }} />
            </div>
            <div>
              <h4 className="font-medium text-white">Group Name</h4>
              <p className="text-xs text-dark-400">Organize your hosts</p>
            </div>
          </div>
          <input
            type="text"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Production Servers"
            className="input"
            autoFocus
          />
        </div>

        <div>
          <label className="label">Color</label>
          <div className="flex gap-2">
            {groupColors.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setForm({ ...form, color: c.color })}
                className={`w-8 h-8 rounded-lg transition-all duration-200 ${
                  form.color === c.color
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-850 scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c.color }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="divider" />

      <div className="space-y-4">
        <label className="flex items-center gap-3 p-4 rounded-xl bg-dark-800/30 cursor-pointer hover:bg-dark-800/50 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-cyan/20 to-primary-500/20 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-accent-cyan" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-white">Cloud Sync</h4>
            <p className="text-xs text-dark-400">Import hosts from cloud provider</p>
          </div>
          <input
            type="checkbox"
            checked={form.cloud_sync}
            onChange={(e) => setForm({ ...form, cloud_sync: e.target.checked })}
            className="w-5 h-5 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500/30"
          />
        </label>

        {form.cloud_sync && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 p-4 rounded-xl border border-dark-700/50 bg-dark-800/20"
          >
            <div>
              <label className="label">Cloud Provider</label>
              <div className="relative">
                <Cloud className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                <select
                  value={form.cloud_provider}
                  onChange={(e) => setForm({ ...form, cloud_provider: e.target.value })}
                  className="input pl-10 appearance-none cursor-pointer"
                >
                  {cloudProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" />
              </div>
            </div>

            {form.cloud_provider && (
              <>
                <div>
                  <label className="label flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Region
                  </label>
                  <input
                    type="text"
                    value={form.cloud_config.region}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        cloud_config: { ...form.cloud_config, region: e.target.value },
                      })
                    }
                    placeholder="us-east-1"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Access Key ID
                  </label>
                  <input
                    type="text"
                    value={form.cloud_config.access_key_id}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        cloud_config: { ...form.cloud_config, access_key_id: e.target.value },
                      })
                    }
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Secret Access Key</label>
                  <input
                    type="password"
                    value={form.cloud_config.secret_access_key}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        cloud_config: { ...form.cloud_config, secret_access_key: e.target.value },
                      })
                    }
                    placeholder="••••••••••••••••"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">IP Address Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['public', 'private'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            cloud_config: { ...form.cloud_config, ip_address_type: type },
                          })
                        }
                        className={`p-2.5 rounded-lg border transition-all text-sm font-medium capitalize ${
                          form.cloud_config.ip_address_type === type
                            ? 'bg-primary-500/10 border-primary-500/50 text-primary-400'
                            : 'bg-dark-800/50 border-dark-700 text-dark-400 hover:border-dark-600'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>

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
            'Create Group'
          )}
        </button>
      </div>
    </form>
  )
}
