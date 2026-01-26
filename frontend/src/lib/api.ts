import axios from 'axios'
import type { Host, Group, Keychain, Snippet, Settings, AuthResponse, User, PortForward, KnownHost } from '../types'

const API_BASE = '/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't auto-redirect on 401 - let the auth store handle it
    // Only clear token if it's a protected route that fails
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/')) {
      localStorage.removeItem('token')
    }
    return Promise.reject(error)
  }
)

export const auth = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/login', { email, password })
    return data
  },
  register: async (email: string, password: string, name?: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/register', { email, password, name })
    return data
  },
  verify: async (): Promise<{ valid: boolean; user: User }> => {
    const { data } = await api.get('/auth/verify')
    return data
  },
}

export const hosts = {
  list: async (): Promise<Host[]> => {
    const { data } = await api.get('/hosts')
    return data || []
  },
  get: async (id: string): Promise<Host> => {
    const { data } = await api.get(`/hosts/${id}`)
    return data
  },
  create: async (host: Partial<Host>): Promise<Host> => {
    const { data } = await api.post('/hosts', host)
    return data
  },
  update: async (id: string, host: Partial<Host>): Promise<Host> => {
    const { data } = await api.put(`/hosts/${id}`, host)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/hosts/${id}`)
  },
}

export const groups = {
  list: async (): Promise<Group[]> => {
    const { data } = await api.get('/groups')
    return data || []
  },
  create: async (group: Partial<Group>): Promise<Group> => {
    const { data } = await api.post('/groups', group)
    return data
  },
  update: async (id: string, group: Partial<Group>): Promise<Group> => {
    const { data } = await api.put(`/groups/${id}`, group)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/groups/${id}`)
  },
  syncCloud: async (id: string): Promise<{ synced: number; message: string }> => {
    const { data } = await api.post(`/groups/${id}/cloud/sync`)
    return data
  },
}

export const keychain = {
  list: async (): Promise<Keychain[]> => {
    const { data } = await api.get('/keychain')
    return data || []
  },
  create: async (item: Partial<Keychain>): Promise<Keychain> => {
    const { data } = await api.post('/keychain', item)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/keychain/${id}`)
  },
}

export const snippets = {
  list: async (): Promise<Snippet[]> => {
    const { data } = await api.get('/snippets')
    return data || []
  },
  create: async (snippet: Partial<Snippet>): Promise<Snippet> => {
    const { data } = await api.post('/snippets', snippet)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/snippets/${id}`)
  },
}

export const knownHosts = {
  list: async (): Promise<KnownHost[]> => {
    const { data } = await api.get('/known-hosts')
    return data || []
  },
  remove: async (host: string): Promise<void> => {
    await api.delete(`/known-hosts/${encodeURIComponent(host)}`)
  },
}

export const portForwards = {
  list: async (): Promise<PortForward[]> => {
    const { data } = await api.get('/portforwards')
    return data || []
  },
  create: async (item: Partial<PortForward>): Promise<PortForward> => {
    const { data } = await api.post('/portforwards', item)
    return data
  },
  update: async (id: string, item: Partial<PortForward>): Promise<PortForward> => {
    const { data } = await api.put(`/portforwards/${id}`, item)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/portforwards/${id}`)
  },
  start: async (id: string): Promise<{ status: string }> => {
    const { data } = await api.post(`/portforwards/${id}/start`)
    return data
  },
  stop: async (id: string): Promise<{ status: string }> => {
    const { data } = await api.post(`/portforwards/${id}/stop`)
    return data
  },
  status: async (): Promise<{ id: string; active: boolean }[]> => {
    const { data } = await api.get('/portforwards/status')
    return data || []
  },
}

export const settings = {
  get: async (): Promise<Settings> => {
    const { data } = await api.get('/settings')
    return data
  },
  save: async (settings: Settings): Promise<Settings> => {
    const { data } = await api.put('/settings', settings)
    return data
  },
}

export const getWebSocketUrl = (hostId: string): string => {
  const token = localStorage.getItem('token')
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}/ws/ssh/${hostId}?token=${token}`
}

export const getLocalShellUrl = (): string => {
  const token = localStorage.getItem('token')
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}/ws/shell?token=${token}`
}

// SFTP / File Transfer APIs
export interface FileItem {
  name: string
  path: string
  size: number
  mod_time: number | string
  is_dir: boolean
  is_symlink?: boolean
  permissions?: string
  mode?: string
}

// Secure Locker (Credential Vault) APIs
export interface LockerStatus {
  status: 'uninitialized' | 'locked' | 'unlocked'
}

export interface CredentialHost {
  id: string
  label: string
  address: string
  port: number
  username: string
  password: string
}

export const locker = {
  status: async (): Promise<LockerStatus> => {
    const { data } = await api.get('/vault/status')
    return data
  },
  setup: async (masterPassword: string): Promise<{ status: string; message: string }> => {
    const { data } = await api.post('/vault/setup', { master_password: masterPassword })
    return data
  },
  unlock: async (masterPassword: string): Promise<{ status: string; message: string }> => {
    const { data } = await api.post('/vault/unlock', { master_password: masterPassword })
    return data
  },
  lock: async (): Promise<{ status: string; message: string }> => {
    const { data } = await api.post('/vault/lock')
    return data
  },
  getCredentials: async (): Promise<CredentialHost[]> => {
    const { data } = await api.get('/vault/credentials')
    return data || []
  },
}

export const sftp = {
  listRemote: async (hostId: string, path: string): Promise<FileItem[]> => {
    const { data } = await api.get(`/sftp/${hostId}/list`, { params: { path } })
    return data || []
  },
  listLocal: async (path: string): Promise<FileItem[]> => {
    const { data } = await api.get('/local/list', { params: { path } })
    return data || []
  },
  mkdirRemote: async (hostId: string, path: string): Promise<void> => {
    await api.post(`/sftp/${hostId}/mkdir`, { path })
  },
  mkdirLocal: async (path: string): Promise<void> => {
    await api.post('/local/mkdir', { path })
  },
  deleteRemote: async (hostId: string, path: string): Promise<void> => {
    await api.delete(`/sftp/${hostId}/delete`, { params: { path } })
  },
  deleteLocal: async (path: string): Promise<void> => {
    await api.delete('/local/delete', { params: { path } })
  },
  renameRemote: async (hostId: string, oldPath: string, newPath: string): Promise<void> => {
    await api.post(`/sftp/${hostId}/rename`, { old_path: oldPath, new_path: newPath })
  },
  downloadRemote: (hostId: string, path: string): string => {
    const token = localStorage.getItem('token')
    return `${API_BASE}/sftp/${hostId}/download?path=${encodeURIComponent(path)}&token=${token}`
  },
  transfer: async (sourceHost: string, sourcePath: string, destHost: string, destPath: string): Promise<void> => {
    await api.post('/sftp/transfer', {
      source_host: sourceHost,
      source_path: sourcePath,
      dest_host: destHost,
      dest_path: destPath,
    })
  },
}

// Quick Actions API
export const quickActions = {
  // System Metrics
  getMetrics: async (hostId: string) => {
    const { data } = await api.post('/actions/metrics', { host_id: hostId })
    return data
  },

  // Users
  listUsers: async (hostId: string) => {
    const { data } = await api.post('/actions/users', { host_id: hostId })
    return data
  },
  createUser: async (hostId: string, username: string, options: Record<string, string>) => {
    const { data } = await api.post('/actions/users/create', { host_id: hostId, username, options })
    return data
  },
  deleteUser: async (hostId: string, username: string, removeHome: boolean = false) => {
    const { data } = await api.post('/actions/users/delete', { host_id: hostId, username, remove_home: removeHome })
    return data
  },

  // Groups
  listGroups: async (hostId: string) => {
    const { data } = await api.post('/actions/groups', { host_id: hostId })
    return data
  },
  getUserGroups: async (hostId: string, username: string) => {
    const { data } = await api.post('/actions/users/groups', { host_id: hostId, username })
    return data
  },
  modifyUserGroups: async (hostId: string, username: string, groups: string[]) => {
    const { data } = await api.post('/actions/users/groups/modify', { host_id: hostId, username, groups })
    return data
  },

  // Services
  listServices: async (hostId: string) => {
    const { data } = await api.post('/actions/services', { host_id: hostId })
    return data
  },
  controlService: async (hostId: string, service: string, action: string) => {
    const { data } = await api.post('/actions/services/control', { host_id: hostId, service, action })
    return data
  },
  getServiceLogs: async (hostId: string, service: string, lines: number = 50) => {
    const { data } = await api.post('/actions/execute', { 
      host_id: hostId, 
      command: `journalctl -u ${service} -n ${lines} --no-pager` 
    })
    return data
  },

  // Package Management
  detectPackageManager: async (hostId: string) => {
    const { data } = await api.post('/actions/packages/detect', { host_id: hostId })
    return data
  },
  updatePackages: async (hostId: string) => {
    const { data } = await api.post('/actions/packages/update', { host_id: hostId })
    return data
  },
  upgradePackages: async (hostId: string) => {
    const { data } = await api.post('/actions/execute', { host_id: hostId, command: 'sudo apt upgrade -y || sudo dnf upgrade -y || sudo yum upgrade -y || sudo pacman -Syu --noconfirm' })
    return data
  },
  installPackages: async (hostId: string, packages: string[]) => {
    const { data } = await api.post('/actions/packages/install', { host_id: hostId, packages })
    return data
  },
  listInstalledPackages: async (hostId: string) => {
    const { data } = await api.post('/actions/execute', { 
      host_id: hostId, 
      command: 'dpkg --get-selections 2>/dev/null | grep -v deinstall | head -100 | awk \'{print $1}\' || rpm -qa --qf "%{NAME}\\n" 2>/dev/null | head -100 || pacman -Q 2>/dev/null | head -100 | awk \'{print $1}\'' 
    })
    return data
  },

  // Power
  executeCommand: async (hostId: string, command: string) => {
    const { data } = await api.post('/actions/execute', { host_id: hostId, command })
    return data
  },

  // Container Management (Docker/Podman)
  detectContainerRuntime: async (hostId: string) => {
    const { data } = await api.post('/actions/containers/detect', { host_id: hostId })
    return data
  },
  listContainers: async (hostId: string, runtime: string) => {
    const { data } = await api.post('/actions/containers/list', { host_id: hostId, runtime })
    return data
  },
  containerAction: async (hostId: string, runtime: string, containerId: string, action: string) => {
    const { data } = await api.post('/actions/containers/action', { host_id: hostId, runtime, container_id: containerId, action })
    return data
  },
  listContainerImages: async (hostId: string, runtime: string) => {
    const { data } = await api.post('/actions/containers/images', { host_id: hostId, runtime })
    return data
  },
  deleteContainerImages: async (hostId: string, runtime: string, imageIds: string[]) => {
    const { data } = await api.post('/actions/containers/images/delete', { host_id: hostId, runtime, image_ids: imageIds })
    return data
  },
  containerSystemPrune: async (hostId: string, runtime: string) => {
    const { data } = await api.post('/actions/containers/prune', { host_id: hostId, runtime })
    return data
  },

  // Network Diagnostics
  ping: async (hostId: string, target: string, count: number = 4) => {
    const { data } = await api.post('/actions/network/ping', { host_id: hostId, target, count })
    return data
  },
  traceroute: async (hostId: string, target: string) => {
    const { data } = await api.post('/actions/network/traceroute', { host_id: hostId, target })
    return data
  },
  netstat: async (hostId: string) => {
    const { data } = await api.post('/actions/network/netstat', { host_id: hostId })
    return data
  },

  // System Logs
  getSyslog: async (hostId: string, lines: number = 100) => {
    const { data } = await api.post('/actions/logs/syslog', { host_id: hostId, lines })
    return data
  },
  getAuthLog: async (hostId: string, lines: number = 100) => {
    const { data } = await api.post('/actions/logs/auth', { host_id: hostId, lines })
    return data
  },

  // Cron Jobs Management
  listCronJobs: async (hostId: string, user: string = 'current') => {
    const { data } = await api.post('/actions/cron/list', { host_id: hostId, user })
    return data
  },
  addCronJob: async (hostId: string, user: string, minute: string, hour: string, day: string, month: string, weekday: string, command: string) => {
    const { data } = await api.post('/actions/cron/add', { host_id: hostId, user, minute, hour, day, month, weekday, command })
    return data
  },
  deleteCronJob: async (hostId: string, user: string, lineNumber: number) => {
    const { data } = await api.post('/actions/cron/delete', { host_id: hostId, user, line_number: lineNumber })
    return data
  },
  browseDirectory: async (hostId: string, path: string) => {
    const { data } = await api.post('/actions/files/browse', { host_id: hostId, path })
    return data
  },

  // Process Management
  listProcesses: async (hostId: string, sortBy: string = 'cpu') => {
    const { data } = await api.post('/actions/processes/list', { host_id: hostId, sort_by: sortBy })
    return data
  },
  killProcess: async (hostId: string, pid: string, signal: string = 'TERM') => {
    const { data } = await api.post('/actions/processes/kill', { host_id: hostId, pid, signal })
    return data
  },

  // Firewall Management
  getFirewallStatus: async (hostId: string) => {
    const { data } = await api.post('/actions/firewall/status', { host_id: hostId })
    return data
  },
  addFirewallRule: async (hostId: string, port: string, protocol: string, fromIP: string, action: string) => {
    const { data } = await api.post('/actions/firewall/add', { host_id: hostId, port, protocol, from_ip: fromIP, action })
    return data
  },
  deleteFirewallRule: async (hostId: string, ruleNumber: number) => {
    const { data } = await api.post('/actions/firewall/delete', { host_id: hostId, rule_number: ruleNumber })
    return data
  },
  toggleFirewall: async (hostId: string, enable: boolean) => {
    const { data } = await api.post('/actions/firewall/toggle', { host_id: hostId, enable })
    return data
  },
}

export default api
