import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Settings as SettingsIcon,
  Monitor,
  Type,
  Palette,
  Save,
  RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { settings as settingsApi } from '../lib/api'
import { terminalThemes, themeDisplayNames, darkThemes, lightThemes, terminalFonts } from '../lib/terminalThemes'
import type { Settings as SettingsType } from '../types'

const defaultSettings: SettingsType = {
  theme: 'dark',
  default_port: 22,
  default_username: 'root',
  terminal_font: 'JetBrains Mono',
  terminal_font_size: 14,
  terminal_theme: 'binsh-dark',
  scrollback_lines: 10000,
  copy_on_select: true,
  paste_on_right_click: true,
}

export default function Settings() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<SettingsType>(defaultSettings)
  const [hasChanges, setHasChanges] = useState(false)

  const { data: settings, isLoading } = useQuery<SettingsType>({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  })

  const saveMutation = useMutation({
    mutationFn: settingsApi.save,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Settings saved')
      setHasChanges(false)
    },
    onError: () => toast.error('Failed to save settings'),
  })

  useEffect(() => {
    if (settings) {
      setForm(settings)
    }
  }, [settings])

  const handleChange = (key: keyof SettingsType, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = () => {
    saveMutation.mutate(form)
  }

  const handleReset = () => {
    if (settings) {
      setForm(settings)
      setHasChanges(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
          <p className="text-sm text-gray-500 dark:text-dark-400">Configure your binsh preferences</p>
        </div>
        {hasChanges && (
          <div className="flex gap-2">
            <button onClick={handleReset} className="btn btn-secondary btn-sm">
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button onClick={handleSave} className="btn btn-primary btn-sm" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Connection Defaults</h3>
              <p className="text-xs text-gray-500 dark:text-dark-400">Default values for new hosts</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Default Port</label>
              <input
                type="number"
                value={form.default_port}
                onChange={(e) => handleChange('default_port', parseInt(e.target.value) || 22)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Default Username</label>
              <input
                type="text"
                value={form.default_username}
                onChange={(e) => handleChange('default_username', e.target.value)}
                className="input"
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent-cyan/20 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-accent-cyan" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Terminal</h3>
              <p className="text-xs text-gray-500 dark:text-dark-400">Terminal appearance and behavior</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Font Family
                </label>
                <select
                  value={form.terminal_font}
                  onChange={(e) => handleChange('terminal_font', e.target.value)}
                  className="input appearance-none cursor-pointer"
                >
                  {terminalFonts.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Font Size</label>
                <input
                  type="number"
                  value={form.terminal_font_size}
                  onChange={(e) => handleChange('terminal_font_size', parseInt(e.target.value) || 14)}
                  min={10}
                  max={24}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="label flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Terminal Theme
              </label>
              <select
                value={form.terminal_theme}
                onChange={(e) => handleChange('terminal_theme', e.target.value)}
                className="input appearance-none cursor-pointer"
              >
                <optgroup label="Dark Themes">
                  {darkThemes.map((theme) => (
                    <option key={theme} value={theme}>
                      {themeDisplayNames[theme]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Light Themes">
                  {lightThemes.map((theme) => (
                    <option key={theme} value={theme}>
                      {themeDisplayNames[theme]}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="p-3 rounded-xl border border-gray-200 dark:border-dark-700">
              <label className="label mb-2">Theme Preview</label>
              <div
                className="h-24 rounded-lg p-3 font-mono text-sm overflow-hidden"
                style={{
                  backgroundColor: terminalThemes[form.terminal_theme]?.background || '#0f172a',
                  color: terminalThemes[form.terminal_theme]?.foreground || '#e2e8f0',
                }}
              >
                <div>$ ls -la</div>
                <div style={{ color: terminalThemes[form.terminal_theme]?.blue }}>drwxr-xr-x  user  group  4096  Documents/</div>
                <div style={{ color: terminalThemes[form.terminal_theme]?.green }}>-rwxr-xr-x  user  group  1024  script.sh</div>
                <div style={{ color: terminalThemes[form.terminal_theme]?.yellow }}>-rw-r--r--  user  group  2048  config.json</div>
              </div>
            </div>

            <div>
              <label className="label">Scrollback Lines</label>
              <input
                type="number"
                value={form.scrollback_lines}
                onChange={(e) => handleChange('scrollback_lines', parseInt(e.target.value) || 10000)}
                min={1000}
                max={100000}
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-100 dark:bg-dark-800/30 cursor-pointer hover:bg-gray-200 dark:hover:bg-dark-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={form.copy_on_select}
                  onChange={(e) => handleChange('copy_on_select', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-primary-500 focus:ring-primary-500/30"
                />
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">Copy on Select</p>
                  <p className="text-xs text-gray-500 dark:text-dark-400">Auto copy selected text</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-100 dark:bg-dark-800/30 cursor-pointer hover:bg-gray-200 dark:hover:bg-dark-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={form.paste_on_right_click}
                  onChange={(e) => handleChange('paste_on_right_click', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-primary-500 focus:ring-primary-500/30"
                />
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">Right-Click Paste</p>
                  <p className="text-xs text-gray-500 dark:text-dark-400">Paste with right click</p>
                </div>
              </label>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
