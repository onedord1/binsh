import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  Monitor,
  Users,
  Power,
  Settings,
  Package,
  ChevronRight,
  ChevronLeft,
  X,
  Cpu,
  HardDrive,
  MemoryStick,
  Clock,
  Activity,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  FileText,
  UserPlus,
  UserMinus,
  Download,
  Upload,
  Loader2,
  PowerOff,
  RotateCw,
  Search,
  UsersRound,
  Pin,
  PinOff,
  Box,
  Image,
  Trash2,
  Globe,
  Network,
  ScrollText,
  Shield,
  Calendar,
  FolderOpen,
  Skull,
  Flame,
  Plus,
  Lock,
  Unlock,
  Code2,
  Copy,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { quickActions, snippets } from '../../lib/api'
import type { Snippet } from '../../types'

interface QuickActionsProps {
  isConnected: boolean
  wsRef: React.RefObject<WebSocket | null>
  hostId?: string
}

interface SystemMetrics {
  uptime: string
  cpu_usage: number
  memory_total: number
  memory_used: number
  swap_total: number
  swap_used: number
  load_avg: string
  hostname: string
  ip_address: string
  disk_usage?: Array<{
    filesystem: string
    size: string
    used: string
    available: string
    use_percent: number
    mount_point: string
  }>
}

interface SystemUser {
  username: string
  uid: string
  gid: string
  home: string
  shell: string
  groups?: string[]
}

interface SystemService {
  name: string
  status: string
  sub_status: string
  active: boolean
  enabled: boolean
}

// Package name mapping for different package managers
const packageNameMap: Record<string, Record<string, string>> = {
  'docker.io': { apt: 'docker.io', yum: 'docker', dnf: 'docker', pacman: 'docker', apk: 'docker' },
  'docker-compose': { apt: 'docker-compose', yum: 'docker-compose-plugin', dnf: 'docker-compose-plugin', pacman: 'docker-compose', apk: 'docker-compose' },
  'build-essential': { apt: 'build-essential', yum: 'gcc make', dnf: 'gcc make', pacman: 'base-devel', apk: 'build-base' },
  'netcat-openbsd': { apt: 'netcat-openbsd', yum: 'nmap-ncat', dnf: 'nmap-ncat', pacman: 'openbsd-netcat', apk: 'netcat-openbsd' },
  'dnsutils': { apt: 'dnsutils', yum: 'bind-utils', dnf: 'bind-utils', pacman: 'bind', apk: 'bind-tools' },
  'apache2': { apt: 'apache2', yum: 'httpd', dnf: 'httpd', pacman: 'apache', apk: 'apache2' },
  'mysql-server': { apt: 'mysql-server', yum: 'mysql-server', dnf: 'mysql-server', pacman: 'mariadb', apk: 'mysql' },
  'redis-server': { apt: 'redis-server', yum: 'redis', dnf: 'redis', pacman: 'redis', apk: 'redis' },
  'openssh-server': { apt: 'openssh-server', yum: 'openssh-server', dnf: 'openssh-server', pacman: 'openssh', apk: 'openssh' },
  'python3-pip': { apt: 'python3-pip', yum: 'python3-pip', dnf: 'python3-pip', pacman: 'python-pip', apk: 'py3-pip' },
}

const getPackageName = (pkg: string, pm: string): string => {
  return packageNameMap[pkg]?.[pm] || pkg
}

const commonPackages = [
  { name: 'curl', description: 'URL Transfer Tool', category: 'essentials' },
  { name: 'wget', description: 'File Downloader', category: 'essentials' },
  { name: 'git', description: 'Version Control', category: 'essentials' },
  { name: 'vim', description: 'Text Editor', category: 'essentials' },
  { name: 'nano', description: 'Text Editor', category: 'essentials' },
  { name: 'htop', description: 'Process Viewer', category: 'essentials' },
  { name: 'tmux', description: 'Terminal Multiplexer', category: 'essentials' },
  { name: 'build-essential', description: 'Build Tools (gcc, make)', category: 'essentials' },
  { name: 'net-tools', description: 'Network Tools (ifconfig)', category: 'network' },
  { name: 'lsof', description: 'List Open Files', category: 'network' },
  { name: 'netcat-openbsd', description: 'Netcat Utility', category: 'network' },
  { name: 'traceroute', description: 'Network Path Tracing', category: 'network' },
  { name: 'dnsutils', description: 'DNS Tools (dig, nslookup)', category: 'network' },
  { name: 'iptables', description: 'Firewall Rules', category: 'network' },
  { name: 'ufw', description: 'Simple Firewall', category: 'security' },
  { name: 'fail2ban', description: 'Intrusion Prevention', category: 'security' },
  { name: 'openssh-server', description: 'SSH Server', category: 'security' },
  { name: 'certbot', description: 'SSL Certificates', category: 'security' },
  { name: 'nginx', description: 'Web Server', category: 'web' },
  { name: 'apache2', description: 'Apache Web Server', category: 'web' },
  { name: 'docker.io', description: 'Container Runtime', category: 'containers' },
  { name: 'docker-compose', description: 'Docker Compose', category: 'containers' },
  { name: 'python3', description: 'Python 3', category: 'languages' },
  { name: 'python3-pip', description: 'Python Package Manager', category: 'languages' },
  { name: 'nodejs', description: 'Node.js Runtime', category: 'languages' },
  { name: 'npm', description: 'Node Package Manager', category: 'languages' },
  { name: 'postgresql', description: 'PostgreSQL Database', category: 'databases' },
  { name: 'mysql-server', description: 'MySQL Database', category: 'databases' },
  { name: 'redis-server', description: 'Redis Cache', category: 'databases' },
  { name: 'sqlite3', description: 'SQLite Database', category: 'databases' },
  { name: 'zip', description: 'Zip Compression', category: 'utilities' },
  { name: 'unzip', description: 'Unzip Files', category: 'utilities' },
  { name: 'tar', description: 'Archive Tool', category: 'utilities' },
  { name: 'rsync', description: 'File Sync Tool', category: 'utilities' },
  { name: 'jq', description: 'JSON Processor', category: 'utilities' },
  { name: 'tree', description: 'Directory Tree', category: 'utilities' },
]

export default function QuickActions({ isConnected, wsRef, hostId }: QuickActionsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [activeDialog, setActiveDialog] = useState<string | null>(null)

  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

  const [users, setUsers] = useState<SystemUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '' })
  const [systemGroups, setSystemGroups] = useState<Array<{ name: string; gid: string; members: string[] }>>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const [editingUserGroups, setEditingUserGroups] = useState<{ username: string; groups: Set<string> } | null>(null)

  const [services, setServices] = useState<SystemService[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [serviceSearch, setServiceSearch] = useState('')
  const [serviceLog, setServiceLog] = useState<{ name: string; logs: string } | null>(null)

  const [installedPackages, setInstalledPackages] = useState<string[]>([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set())
  const [isUpdating, setIsUpdating] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [packageLog, setPackageLog] = useState<{ action: string; output: string } | null>(null)
  const [packageTab, setPackageTab] = useState<'installed' | 'install'>('installed')
  const [packageCategoryFilter, setPackageCategoryFilter] = useState<string>('all')
  const [detectedPkgManager, setDetectedPkgManager] = useState<string>('apt')

  // Container Management State
  const [containerRuntime, setContainerRuntime] = useState<string | null>(null)
  const [containerRuntimeChecked, setContainerRuntimeChecked] = useState(false)
  const [containers, setContainers] = useState<Array<{ id: string; name: string; image: string; status: string; state: string; ports: string }>>([])
  const [containersLoading, setContainersLoading] = useState(false)
  const [containerImages, setContainerImages] = useState<Array<{ id: string; repository: string; tag: string; size: string }>>([])
  const [imagesLoading, setImagesLoading] = useState(false)
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [containerLog, setContainerLog] = useState<{ name: string; logs: string } | null>(null)
  const [containerActionLoading, setContainerActionLoading] = useState<string | null>(null)

  // Network Diagnostics State
  const [networkTarget, setNetworkTarget] = useState('')
  const [networkResult, setNetworkResult] = useState<{ type: string; output: string } | null>(null)
  const [networkLoading, setNetworkLoading] = useState(false)

  // System Logs State
  const [syslogContent, setSyslogContent] = useState('')
  const [authLogContent, setAuthLogContent] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)

  // Cron Jobs State
  const [cronJobs, setCronJobs] = useState<Array<{ id: string; minute: string; hour: string; day: string; month: string; weekday: string; command: string; raw_line: string }>>([])
  const [cronLoading, setCronLoading] = useState(false)
  const [cronUser, setCronUser] = useState('current')
  const [showCronForm, setShowCronForm] = useState(false)
  const [newCronJob, setNewCronJob] = useState({ minute: '*', hour: '*', day: '*', month: '*', weekday: '*', command: '' })
  const [browsingPath, setBrowsingPath] = useState('/')
  const [directoryContents, setDirectoryContents] = useState<Array<{ name: string; type: string; path: string }>>([])
  const [showFileBrowser, setShowFileBrowser] = useState(false)

  // Process Management State
  const [processes, setProcesses] = useState<Array<{ pid: string; user: string; cpu: number; memory: number; command: string }>>([])
  const [processesLoading, setProcessesLoading] = useState(false)
  const [processSortBy, setProcessSortBy] = useState('cpu')
  const [killingPid, setKillingPid] = useState<string | null>(null)

  // Firewall State
  const [firewallStatus, setFirewallStatus] = useState<{ active: boolean; type: string; rules: Array<{ id: string; number: number; port: string; action: string; protocol: string; raw_rule: string }> } | null>(null)
  const [firewallLoading, setFirewallLoading] = useState(false)
  const [showFirewallForm, setShowFirewallForm] = useState(false)
  const [newFirewallRule, setNewFirewallRule] = useState({ port: '', protocol: 'tcp', fromIP: '', action: 'allow' })
  const [pendingConfirm, setPendingConfirm] = useState<{ type: string; data?: unknown } | null>(null)

  // Snippets State
  const [snippetsList, setSnippetsList] = useState<Snippet[]>([])
  const [snippetsLoading, setSnippetsLoading] = useState(false)

  const fetchMetrics = async () => {
    if (!hostId) {
      console.log('QuickActions: No hostId provided')
      return
    }
    setMetricsLoading(true)
    try {
      console.log('QuickActions: Fetching metrics for hostId:', hostId)
      const data = await quickActions.getMetrics(hostId)
      console.log('QuickActions: Metrics response:', data)
      if (data && typeof data === 'object') {
        setMetrics(data)
      } else {
        console.error('QuickActions: Invalid metrics data:', data)
        toast.error('Invalid metrics data received')
      }
    } catch (err) {
      console.error('QuickActions: Failed to fetch metrics:', err)
      toast.error('Failed to fetch metrics')
    } finally {
      setMetricsLoading(false)
    }
  }

  const fetchUsers = async () => {
    if (!hostId) return
    setUsersLoading(true)
    try {
      const data = await quickActions.listUsers(hostId)
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error('Failed to fetch users')
    } finally {
      setUsersLoading(false)
    }
  }

  const fetchGroups = async () => {
    if (!hostId) return
    setGroupsLoading(true)
    try {
      const data = await quickActions.listGroups(hostId)
      if (Array.isArray(data)) {
        // Filter to common groups that users typically belong to
        const commonGroups = data.filter((g: { name: string; gid: string }) => {
          const gid = parseInt(g.gid)
          // Include groups with GID >= 1000 or specific system groups
          const importantGroups = ['sudo', 'docker', 'www-data', 'adm', 'wheel', 'admin', 'staff', 'users', 'developers']
          return gid >= 1000 || importantGroups.includes(g.name)
        })
        setSystemGroups(commonGroups)
      }
    } catch (err) {
      toast.error('Failed to fetch groups')
    } finally {
      setGroupsLoading(false)
    }
  }

  const createUser = async () => {
    if (!hostId || !newUser.username) {
      toast.error('Username is required')
      return
    }
    try {
      const options: Record<string, string> = {}
      if (newUser.password) options.password = newUser.password
      if (selectedGroups.size > 0) options.groups = Array.from(selectedGroups).join(',')
      await quickActions.createUser(hostId, newUser.username, options)
      toast.success(`User ${newUser.username} created`)
      setNewUser({ username: '', password: '' })
      setSelectedGroups(new Set())
      fetchUsers()
    } catch (err) {
      toast.error('Failed to create user')
    }
  }

  const deleteUser = async (username: string) => {
    if (!hostId) return
    if (!confirm(`Delete user ${username}?`)) return
    try {
      await quickActions.deleteUser(hostId, username, true)
      toast.success(`User ${username} deleted`)
      fetchUsers()
    } catch (err) {
      toast.error('Failed to delete user')
    }
  }

  const startEditingUserGroups = async (username: string) => {
    if (!hostId) return
    try {
      const data = await quickActions.getUserGroups(hostId, username)
      const userGroups = data.groups || []
      setEditingUserGroups({ username, groups: new Set(userGroups) })
    } catch (err) {
      toast.error('Failed to fetch user groups')
    }
  }

  const saveUserGroups = async () => {
    if (!hostId || !editingUserGroups) return
    try {
      await quickActions.modifyUserGroups(hostId, editingUserGroups.username, Array.from(editingUserGroups.groups))
      toast.success(`Groups updated for ${editingUserGroups.username}`)
      setEditingUserGroups(null)
      fetchUsers()
    } catch (err) {
      toast.error('Failed to update user groups')
    }
  }

  const toggleGroupForUser = (group: string) => {
    if (!editingUserGroups) return
    const newGroups = new Set(editingUserGroups.groups)
    if (newGroups.has(group)) {
      newGroups.delete(group)
    } else {
      newGroups.add(group)
    }
    setEditingUserGroups({ ...editingUserGroups, groups: newGroups })
  }

  const toggleGroupForNewUser = (group: string) => {
    const newGroups = new Set(selectedGroups)
    if (newGroups.has(group)) {
      newGroups.delete(group)
    } else {
      newGroups.add(group)
    }
    setSelectedGroups(newGroups)
  }

  const fetchServices = async () => {
    if (!hostId) return
    setServicesLoading(true)
    try {
      const data = await quickActions.listServices(hostId)
      setServices(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error('Failed to fetch services')
    } finally {
      setServicesLoading(false)
    }
  }

  const controlService = async (service: string, action: string) => {
    if (!hostId) return
    try {
      await quickActions.controlService(hostId, service, action)
      toast.success(`Service ${service} ${action}ed`)
      fetchServices()
    } catch (err) {
      toast.error(`Failed to ${action} ${service}`)
    }
  }

  const getServiceLogs = async (service: string) => {
    if (!hostId) return
    try {
      const data = await quickActions.getServiceLogs(hostId, service)
      setServiceLog({ name: service, logs: data.output || 'No logs available' })
    } catch (err) {
      toast.error('Failed to fetch logs')
    }
  }

  const getPackageManagerCmd = (pm: string, action: 'update' | 'upgrade') => {
    const cmds: Record<string, Record<string, string>> = {
      apt: { update: 'apt-get update', upgrade: 'apt-get upgrade -y' },
      yum: { update: 'yum check-update', upgrade: 'yum update -y' },
      dnf: { update: 'dnf check-update', upgrade: 'dnf upgrade -y' },
      pacman: { update: 'pacman -Sy', upgrade: 'pacman -Syu' },
      apk: { update: 'apk update', upgrade: 'apk upgrade' },
      zypper: { update: 'zypper refresh', upgrade: 'zypper update -y' },
    }
    return cmds[pm]?.[action] || cmds.apt[action]
  }

  const detectPkgManager = async () => {
    if (!hostId) return
    try {
      const result = await quickActions.detectPackageManager(hostId)
      if (result.package_manager) {
        setDetectedPkgManager(result.package_manager)
      }
    } catch {
      // Default to apt if detection fails
    }
  }

  const updatePackageList = async () => {
    if (!hostId) return
    setIsUpdating(true)
    const cmd = getPackageManagerCmd(detectedPkgManager, 'update')
    setPackageLog({ action: 'Updating Package List', output: `Running ${cmd}...\n` })
    try {
      const result = await quickActions.updatePackages(hostId)
      const output = result?.output || result?.message || 'Package list updated successfully'
      setPackageLog({ action: 'Update Package List', output })
      toast.success('Package list updated')
    } catch (err) {
      setPackageLog({ action: 'Update Package List', output: 'Failed to update package list' })
      toast.error('Failed to update package list')
    } finally {
      setIsUpdating(false)
    }
  }

  const upgradeAllPackages = async () => {
    if (!hostId) return
    if (!confirm('Upgrade all packages? This may take a while.')) return
    setIsUpgrading(true)
    const cmd = getPackageManagerCmd(detectedPkgManager, 'upgrade')
    setPackageLog({ action: 'Upgrading All Packages', output: `Running ${cmd}...\nThis may take several minutes...\n` })
    try {
      const result = await quickActions.upgradePackages(hostId)
      const output = result?.output || result?.message || 'All packages upgraded successfully'
      setPackageLog({ action: 'Upgrade All Packages', output })
      toast.success('All packages upgraded')
    } catch (err) {
      setPackageLog({ action: 'Upgrade All Packages', output: 'Failed to upgrade packages' })
      toast.error('Failed to upgrade packages')
    } finally {
      setIsUpgrading(false)
    }
  }

  const fetchInstalledPackages = async () => {
    if (!hostId) return
    setPackagesLoading(true)
    try {
      const data = await quickActions.listInstalledPackages(hostId)
      const packages = (data.output || '').split('\n').filter(Boolean)
      setInstalledPackages(packages)
    } catch (err) {
      toast.error('Failed to fetch packages')
    } finally {
      setPackagesLoading(false)
    }
  }

  const installSelectedPackages = async () => {
    if (!hostId || selectedPackages.size === 0) {
      toast.error('Select at least one package')
      return
    }
    setIsUpdating(true)
    try {
      // Map package names based on detected package manager
      const mappedPackages = Array.from(selectedPackages).map(pkg => getPackageName(pkg, detectedPkgManager))
      await quickActions.installPackages(hostId, mappedPackages)
      toast.success('Packages installed')
      setSelectedPackages(new Set())
    } catch (err) {
      toast.error('Failed to install packages')
    } finally {
      setIsUpdating(false)
    }
  }

  const powerAction = async (action: 'shutdown' | 'reboot') => {
    if (!hostId) return
    if (!confirm(`Are you sure you want to ${action} this server?`)) return
    try {
      const cmd = action === 'shutdown' ? 'sudo shutdown -h now' : 'sudo reboot'
      await quickActions.executeCommand(hostId, cmd)
      toast.success(`Server ${action} initiated`)
    } catch (err) {
      toast.error(`Failed to ${action}`)
    }
  }

  // Container Management Functions
  const checkContainerRuntime = async () => {
    if (!hostId) return
    setContainerRuntimeChecked(false)
    try {
      const result = await quickActions.detectContainerRuntime(hostId)
      if (result.installed) {
        setContainerRuntime(result.runtime)
      } else {
        setContainerRuntime(null)
      }
    } catch {
      setContainerRuntime(null)
    } finally {
      setContainerRuntimeChecked(true)
    }
  }

  const fetchContainers = async () => {
    if (!hostId || !containerRuntime) return
    setContainersLoading(true)
    try {
      const data = await quickActions.listContainers(hostId, containerRuntime)
      if (Array.isArray(data)) {
        setContainers(data)
      } else if (data.error) {
        toast.error(data.error)
        setContainers([])
      }
    } catch {
      toast.error('Failed to fetch containers')
      setContainers([])
    } finally {
      setContainersLoading(false)
    }
  }

  const handleContainerAction = async (containerId: string, action: string) => {
    if (!hostId || !containerRuntime) return
    setContainerActionLoading(`${containerId}-${action}`)
    try {
      const result = await quickActions.containerAction(hostId, containerRuntime, containerId, action)
      if (action === 'logs') {
        const container = containers.find(c => c.id === containerId)
        setContainerLog({ name: container?.name || containerId, logs: result.output || 'No logs available' })
      } else {
        toast.success(`Container ${action} successful`)
        fetchContainers()
      }
    } catch {
      toast.error(`Failed to ${action} container`)
    } finally {
      setContainerActionLoading(null)
    }
  }

  const fetchContainerImages = async () => {
    if (!hostId || !containerRuntime) return
    setImagesLoading(true)
    try {
      const data = await quickActions.listContainerImages(hostId, containerRuntime)
      if (Array.isArray(data)) {
        setContainerImages(data)
      } else if (data.error) {
        toast.error(data.error)
        setContainerImages([])
      }
    } catch {
      toast.error('Failed to fetch images')
      setContainerImages([])
    } finally {
      setImagesLoading(false)
    }
  }

  const deleteSelectedImages = async () => {
    if (!hostId || !containerRuntime || selectedImages.size === 0) return
    if (!confirm(`Delete ${selectedImages.size} selected image(s)?`)) return
    try {
      const result = await quickActions.deleteContainerImages(hostId, containerRuntime, Array.from(selectedImages))
      if (result.success) {
        toast.success('Images deleted')
        setSelectedImages(new Set())
        fetchContainerImages()
      } else {
        toast.error(result.error || 'Failed to delete images')
      }
    } catch {
      toast.error('Failed to delete images')
    }
  }

  const pruneContainerSystem = async () => {
    if (!hostId || !containerRuntime) return
    if (!confirm('This will remove all unused containers, networks, images. Continue?')) return
    try {
      const result = await quickActions.containerSystemPrune(hostId, containerRuntime)
      if (result.success) {
        toast.success('System pruned successfully')
        setContainerLog({ name: 'System Prune', logs: result.output || 'Cleanup completed' })
      } else {
        toast.error(result.error || 'Prune failed')
      }
    } catch {
      toast.error('Failed to prune system')
    }
  }

  // Network Diagnostic Functions
  const runPing = async () => {
    if (!hostId || !networkTarget.trim()) {
      toast.error('Enter a target host')
      return
    }
    setNetworkLoading(true)
    try {
      const result = await quickActions.ping(hostId, networkTarget.trim(), 4)
      setNetworkResult({ type: 'Ping', output: result.output || result.error || 'No response' })
    } catch {
      toast.error('Ping failed')
    } finally {
      setNetworkLoading(false)
    }
  }

  const runTraceroute = async () => {
    if (!hostId || !networkTarget.trim()) {
      toast.error('Enter a target host')
      return
    }
    setNetworkLoading(true)
    try {
      const result = await quickActions.traceroute(hostId, networkTarget.trim())
      setNetworkResult({ type: 'Traceroute', output: result.output || result.error || 'No response' })
    } catch {
      toast.error('Traceroute failed')
    } finally {
      setNetworkLoading(false)
    }
  }

  const runNetstat = async () => {
    if (!hostId) return
    setNetworkLoading(true)
    try {
      const result = await quickActions.netstat(hostId)
      setNetworkResult({ type: 'Netstat', output: result.output || result.error || 'No connections' })
    } catch {
      toast.error('Netstat failed')
    } finally {
      setNetworkLoading(false)
    }
  }

  // System Logs Functions
  const fetchSyslog = async () => {
    if (!hostId) return
    setLogsLoading(true)
    try {
      const result = await quickActions.getSyslog(hostId, 200)
      setSyslogContent(result.output || result.error || 'No logs available')
    } catch {
      toast.error('Failed to fetch syslog')
    } finally {
      setLogsLoading(false)
    }
  }

  const fetchAuthLog = async () => {
    if (!hostId) return
    setLogsLoading(true)
    try {
      const result = await quickActions.getAuthLog(hostId, 200)
      setAuthLogContent(result.output || result.error || 'No logs available')
    } catch {
      toast.error('Failed to fetch auth log')
    } finally {
      setLogsLoading(false)
    }
  }

  // Cron Jobs Functions
  const fetchCronJobs = async () => {
    if (!hostId) return
    setCronLoading(true)
    try {
      const data = await quickActions.listCronJobs(hostId, cronUser)
      if (Array.isArray(data)) {
        setCronJobs(data)
      } else if (data.error) {
        toast.error(data.error)
        setCronJobs([])
      }
    } catch {
      toast.error('Failed to fetch cron jobs')
      setCronJobs([])
    } finally {
      setCronLoading(false)
    }
  }

  const addNewCronJob = async () => {
    if (!hostId || !newCronJob.command.trim()) {
      toast.error('Command is required')
      return
    }
    try {
      const result = await quickActions.addCronJob(
        hostId, cronUser,
        newCronJob.minute, newCronJob.hour, newCronJob.day,
        newCronJob.month, newCronJob.weekday, newCronJob.command
      )
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Cron job added')
        setShowCronForm(false)
        setNewCronJob({ minute: '*', hour: '*', day: '*', month: '*', weekday: '*', command: '' })
        fetchCronJobs()
      }
    } catch {
      toast.error('Failed to add cron job')
    }
  }

  const deleteCron = async (lineNumber: number) => {
    if (!hostId) return
    try {
      const result = await quickActions.deleteCronJob(hostId, cronUser, lineNumber)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Cron job deleted')
        fetchCronJobs()
      }
    } catch {
      toast.error('Failed to delete cron job')
    }
  }

  const browseDir = async (path: string) => {
    if (!hostId) return
    try {
      const result = await quickActions.browseDirectory(hostId, path)
      if (result.output) {
        const items: Array<{ name: string; type: string; path: string }> = []
        const lines = result.output.split('\n').filter(Boolean)
        for (const line of lines) {
          const parts = line.split(/\s+/)
          if (parts.length >= 9) {
            const name = parts.slice(8).join(' ')
            if (name === '.' || name === '..') continue
            const type = parts[0].startsWith('d') ? 'dir' : 'file'
            items.push({ name, type, path: path === '/' ? `/${name}` : `${path}/${name}` })
          }
        }
        setDirectoryContents(items)
        setBrowsingPath(path)
      }
    } catch {
      toast.error('Failed to browse directory')
    }
  }

  // Snippets Functions
  const fetchSnippets = async () => {
    setSnippetsLoading(true)
    try {
      const data = await snippets.list()
      setSnippetsList(data || [])
    } catch {
      toast.error('Failed to fetch snippets')
      setSnippetsList([])
    } finally {
      setSnippetsLoading(false)
    }
  }

  const runSnippet = (content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error('Terminal not connected')
      return
    }
    // Send the command to the terminal
    wsRef.current.send(JSON.stringify({ type: 'input', data: content + '\n' }))
    toast.success('Snippet executed')
    setActiveDialog(null)
  }

  // Process Management Functions
  const fetchProcesses = async () => {
    if (!hostId) return
    setProcessesLoading(true)
    try {
      const data = await quickActions.listProcesses(hostId, processSortBy)
      if (Array.isArray(data)) {
        setProcesses(data)
      } else if (data.error) {
        toast.error(data.error)
        setProcesses([])
      }
    } catch {
      toast.error('Failed to fetch processes')
      setProcesses([])
    } finally {
      setProcessesLoading(false)
    }
  }

  const killProc = async (pid: string, signal: string = 'TERM') => {
    if (!hostId) return
    setKillingPid(pid)
    try {
      const result = await quickActions.killProcess(hostId, pid, signal)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Process ${pid} killed`)
        fetchProcesses()
      }
    } catch {
      toast.error('Failed to kill process')
    } finally {
      setKillingPid(null)
    }
  }

  // Firewall Functions
  const fetchFirewallStatus = async () => {
    if (!hostId) return
    setFirewallLoading(true)
    try {
      const data = await quickActions.getFirewallStatus(hostId)
      if (data.error) {
        toast.error(data.error)
        setFirewallStatus(null)
      } else {
        setFirewallStatus(data)
      }
    } catch {
      toast.error('Failed to fetch firewall status')
      setFirewallStatus(null)
    } finally {
      setFirewallLoading(false)
    }
  }

  const addFwRule = async () => {
    if (!hostId || !newFirewallRule.port.trim()) {
      toast.error('Port is required')
      return
    }
    try {
      const result = await quickActions.addFirewallRule(
        hostId,
        newFirewallRule.port,
        newFirewallRule.protocol,
        newFirewallRule.fromIP,
        newFirewallRule.action
      )
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Firewall rule added')
        setShowFirewallForm(false)
        setNewFirewallRule({ port: '', protocol: 'tcp', fromIP: '', action: 'allow' })
        fetchFirewallStatus()
      }
    } catch {
      toast.error('Failed to add firewall rule')
    }
  }

  const deleteFwRule = async (ruleNumber: number) => {
    if (!hostId) return
    try {
      const result = await quickActions.deleteFirewallRule(hostId, ruleNumber)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Firewall rule deleted')
        fetchFirewallStatus()
      }
    } catch {
      toast.error('Failed to delete rule')
    }
    setPendingConfirm(null)
  }

  const toggleFw = async (enable: boolean) => {
    if (!hostId) return
    try {
      const result = await quickActions.toggleFirewall(hostId, enable)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Firewall ${enable ? 'enabled' : 'disabled'}`)
        fetchFirewallStatus()
      }
    } catch {
      toast.error('Failed to toggle firewall')
    }
    setPendingConfirm(null)
  }

  useEffect(() => {
    if (activeDialog === 'metrics' && isConnected && hostId) {
      fetchMetrics()
      const interval = setInterval(fetchMetrics, 5000)
      return () => clearInterval(interval)
    }
  }, [activeDialog, isConnected, hostId])

  useEffect(() => {
    if (activeDialog === 'users') {
      fetchUsers()
      fetchGroups()
    }
    if (activeDialog === 'services') fetchServices()
    if (activeDialog === 'packages') {
      detectPkgManager()
      fetchInstalledPackages()
    }
    if (activeDialog === 'install') {
      detectPkgManager()
    }
    if (activeDialog === 'containers' || activeDialog === 'images') {
      checkContainerRuntime()
    }
    if (activeDialog === 'syslog') fetchSyslog()
    if (activeDialog === 'authlog') fetchAuthLog()
    if (activeDialog === 'netstat') runNetstat()
    if (activeDialog === 'cronjobs') fetchCronJobs()
    if (activeDialog === 'processes') fetchProcesses()
    if (activeDialog === 'firewall') fetchFirewallStatus()
    if (activeDialog === 'snippets') fetchSnippets()
  }, [activeDialog])

  if (!isConnected) return null

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const filteredServices = services.filter(s =>
    s.name.toLowerCase().includes(serviceSearch.toLowerCase())
  )

  const categories = [
    {
      name: 'System',
      icon: Monitor,
      color: 'from-blue-500 to-cyan-500',
      items: [
        { id: 'metrics', label: 'System Metrics', icon: Activity, description: 'Real-time system stats' },
        { id: 'users', label: 'Users Management', icon: Users, description: 'Manage system users' },
        { id: 'power', label: 'Power Options', icon: Power, description: 'Shutdown or reboot' },
      ],
    },
    {
      name: 'System Services',
      icon: Settings,
      color: 'from-purple-500 to-pink-500',
      items: [
        { id: 'services', label: 'Manage Services', icon: Settings, description: 'Control systemd services' },
      ],
    },
    {
      name: 'Package Management',
      icon: Package,
      color: 'from-green-500 to-emerald-500',
      items: [
        { id: 'update', label: 'Update List', icon: RefreshCw, description: 'Refresh package list' },
        { id: 'upgrade', label: 'Upgrade All', icon: Upload, description: 'Upgrade all packages' },
        { id: 'packages', label: 'Installed Packages', icon: Package, description: 'View installed packages' },
        { id: 'install', label: 'Install Packages', icon: Download, description: 'Install common packages' },
      ],
    },
    {
      name: 'Container Management',
      icon: Box,
      color: 'from-cyan-500 to-blue-500',
      items: [
        { id: 'containers', label: 'Containers', icon: Box, description: 'Manage Docker/Podman containers' },
        { id: 'images', label: 'Images', icon: Image, description: 'Manage container images' },
      ],
    },
    {
      name: 'Network',
      icon: Globe,
      color: 'from-teal-500 to-green-500',
      items: [
        { id: 'ping', label: 'Ping', icon: Globe, description: 'Test network connectivity' },
        { id: 'netstat', label: 'Netstat', icon: Network, description: 'View network connections' },
        { id: 'traceroute', label: 'Traceroute', icon: Network, description: 'Trace network path' },
      ],
    },
    {
      name: 'Logs',
      icon: ScrollText,
      color: 'from-amber-500 to-orange-500',
      items: [
        { id: 'syslog', label: 'Syslog', icon: ScrollText, description: 'View system logs' },
        { id: 'authlog', label: 'Auth Log', icon: Shield, description: 'View authentication logs' },
      ],
    },
    {
      name: 'Scheduled Tasks',
      icon: Calendar,
      color: 'from-indigo-500 to-purple-500',
      items: [
        { id: 'cronjobs', label: 'Cron Jobs', icon: Calendar, description: 'Manage scheduled tasks' },
      ],
    },
    {
      name: 'Process Management',
      icon: Cpu,
      color: 'from-red-500 to-pink-500',
      items: [
        { id: 'processes', label: 'Processes', icon: Skull, description: 'View and kill processes' },
      ],
    },
    {
      name: 'Firewall',
      icon: Flame,
      color: 'from-orange-500 to-red-500',
      items: [
        { id: 'firewall', label: 'Firewall Rules', icon: Flame, description: 'Manage UFW/iptables' },
      ],
    },
    {
      name: 'Snippets',
      icon: Code2,
      color: 'from-orange-500 to-pink-500',
      items: [
        { id: 'snippets', label: 'Run Snippets', icon: Code2, description: 'Execute saved commands' },
      ],
    },
  ]

  return (
    <>
      <AnimatePresence>
        {!isExpanded && (
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-14 bottom-0 z-[100] cursor-pointer flex items-center"
            onMouseEnter={() => setIsExpanded(true)}
            onClick={() => setIsExpanded(true)}
          >
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-purple rounded-l-xl blur-md opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-dark-900/95 backdrop-blur-xl border border-dark-700/50 border-r-0 rounded-l-xl px-2 py-4 shadow-2xl">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-purple flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <ChevronLeft className="w-4 h-4 text-dark-400 group-hover:text-white transition-colors animate-pulse" />
                  <span className="text-[10px] text-dark-400 group-hover:text-white transition-colors font-medium tracking-wide" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                    Quick Actions
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-14 bottom-0 z-[100] flex items-center"
            onMouseLeave={() => !activeDialog && !isPinned && setIsExpanded(false)}
          >
            <div className="bg-dark-900/95 backdrop-blur-xl border border-dark-700/50 rounded-l-2xl shadow-2xl overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-primary-500/20 to-accent-purple/20 border-b border-dark-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-purple flex items-center justify-center">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
                      <p className="text-xs text-dark-400">Server Management</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPinned(!isPinned)}
                    className={`p-2 rounded-lg transition-all ${isPinned ? 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30' : 'bg-dark-800/50 text-dark-400 hover:text-white hover:bg-dark-700/50'}`}
                    title={isPinned ? 'Unpin panel' : 'Pin panel'}
                  >
                    {isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-2 space-y-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {categories.map((category) => (
                  <div key={category.name} className="space-y-1">
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${category.color} flex items-center justify-center`}>
                        <category.icon className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-dark-300 uppercase tracking-wide">
                        {category.name}
                      </span>
                    </div>
                    {category.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (item.id === 'update') updatePackageList()
                          else if (item.id === 'upgrade') upgradeAllPackages()
                          else setActiveDialog(item.id)
                        }}
                        disabled={(item.id === 'update' && isUpdating) || (item.id === 'upgrade' && isUpgrading)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-dark-800/80 transition-all group disabled:opacity-50"
                      >
                        <div className="w-8 h-8 rounded-lg bg-dark-800 group-hover:bg-dark-700 flex items-center justify-center transition-colors">
                          {(item.id === 'update' && isUpdating) || (item.id === 'upgrade' && isUpgrading) ? (
                            <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
                          ) : (
                            <item.icon className="w-4 h-4 text-dark-400 group-hover:text-white transition-colors" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-dark-200 group-hover:text-white transition-colors">{item.label}</p>
                          <p className="text-xs text-dark-500">{item.description}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-dark-600 group-hover:text-dark-400 transition-colors" />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeDialog === 'metrics' && (
          <Dialog title="System Metrics" onClose={() => setActiveDialog(null)} size="lg">
            {metricsLoading && !metrics ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
              </div>
            ) : metrics ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-dark-800/50 rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Monitor className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">{metrics.hostname || 'Unknown'}</p>
                    <p className="text-sm text-dark-400">{metrics.ip_address || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-dark-800/50 rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-dark-400">System Uptime</p>
                    <p className="text-lg font-semibold text-white">{metrics.uptime || 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <MetricCard icon={Cpu} label="CPU Usage" value={`${(metrics.cpu_usage || 0).toFixed(1)}%`} percent={metrics.cpu_usage || 0} color="from-orange-500 to-red-500" />
                  <div className="p-4 bg-dark-800/50 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <Activity className="w-5 h-5 text-purple-400" />
                      <span className="text-sm text-dark-400">Load Average</span>
                    </div>
                    <p className="text-lg font-semibold text-white">{metrics.load_avg || 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <MetricCard icon={MemoryStick} label="Memory" value={`${formatBytes(metrics.memory_used || 0)} / ${formatBytes(metrics.memory_total || 0)}`} percent={metrics.memory_total ? (metrics.memory_used / metrics.memory_total) * 100 : 0} color="from-green-500 to-emerald-500" />
                  <MetricCard icon={HardDrive} label="Swap" value={metrics.swap_total ? `${formatBytes(metrics.swap_used || 0)} / ${formatBytes(metrics.swap_total)}` : 'No swap'} percent={metrics.swap_total ? (metrics.swap_used / metrics.swap_total) * 100 : 0} color="from-yellow-500 to-orange-500" />
                </div>

                {metrics.disk_usage && metrics.disk_usage.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-dark-300">Disk Usage</h4>
                    {metrics.disk_usage.slice(0, 3).map((disk, i) => (
                      <div key={i} className="p-3 bg-dark-800/50 rounded-lg">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-dark-400">{disk.mount_point}</span>
                          <span className="text-white">{disk.used} / {disk.size}</span>
                        </div>
                        <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all" style={{ width: `${disk.use_percent}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end">
                  <button onClick={fetchMetrics} disabled={metricsLoading} className="btn btn-secondary btn-sm">
                    <RefreshCw className={`w-4 h-4 ${metricsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-dark-400 text-center py-8">Failed to load metrics</p>
            )}
          </Dialog>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeDialog === 'users' && (
          <Dialog title="Users Management" onClose={() => { setActiveDialog(null); setEditingUserGroups(null) }} size="xl">
            <div className="space-y-4">
              {editingUserGroups ? (
                <div className="p-4 bg-dark-800/50 rounded-xl space-y-3">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Settings className="w-4 h-4 text-blue-400" />
                    Edit Groups for: {editingUserGroups.username}
                  </h4>
                  {groupsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                      {systemGroups.map((group) => (
                        <label key={group.name} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${editingUserGroups.groups.has(group.name) ? 'bg-primary-500/20 border border-primary-500' : 'bg-dark-700/50 border border-dark-600 hover:border-dark-500'}`}>
                          <input type="checkbox" checked={editingUserGroups.groups.has(group.name)} onChange={() => toggleGroupForUser(group.name)} className="sr-only" />
                          <span className="text-sm text-white">{group.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={saveUserGroups} className="btn btn-primary btn-sm">Save Groups</button>
                    <button onClick={() => setEditingUserGroups(null)} className="btn btn-secondary btn-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-dark-800/50 rounded-xl space-y-3">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-green-400" />
                    Create New User
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="input input-sm" />
                    <input type="password" placeholder="Password (optional)" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="input input-sm" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-dark-400">Select groups:</p>
                    {groupsLoading ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                        <span className="text-xs text-dark-500">Loading groups...</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                        {systemGroups.map((group) => (
                          <label key={group.name} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${selectedGroups.has(group.name) ? 'bg-primary-500/20 border border-primary-500' : 'bg-dark-700/50 border border-dark-600 hover:border-dark-500'}`}>
                            <input type="checkbox" checked={selectedGroups.has(group.name)} onChange={() => toggleGroupForNewUser(group.name)} className="sr-only" />
                            <span className="text-sm text-white">{group.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={createUser} className="btn btn-primary btn-sm">
                    <UserPlus className="w-4 h-4" />
                    Create User
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-dark-300 flex items-center gap-2">
                  <UsersRound className="w-4 h-4" />
                  System Users ({users.length})
                </h4>
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {users.map((user) => (
                      <div key={user.username} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{user.username}</p>
                          <p className="text-xs text-dark-500">UID: {user.uid} | {user.home}</p>
                          {user.groups && user.groups.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {user.groups.slice(0, 5).map((g) => (
                                <span key={g} className="text-xs px-1.5 py-0.5 bg-dark-700 rounded text-dark-400">{g}</span>
                              ))}
                              {user.groups.length > 5 && <span className="text-xs text-dark-500">+{user.groups.length - 5} more</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEditingUserGroups(user.username)} className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors" title="Edit Groups">
                            <Settings className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteUser(user.username)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors" title="Delete User">
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeDialog === 'power' && (
          <Dialog title="Power Options" onClose={() => setActiveDialog(null)}>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => powerAction('reboot')} className="flex flex-col items-center gap-3 p-6 bg-dark-800/50 hover:bg-dark-700/50 rounded-xl transition-colors group">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <RotateCw className="w-8 h-8 text-white" />
                </div>
                <span className="text-white font-medium">Reboot</span>
              </button>
              <button onClick={() => powerAction('shutdown')} className="flex flex-col items-center gap-3 p-6 bg-dark-800/50 hover:bg-dark-700/50 rounded-xl transition-colors group">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <PowerOff className="w-8 h-8 text-white" />
                </div>
                <span className="text-white font-medium">Shutdown</span>
              </button>
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeDialog === 'services' && (
          <Dialog title="System Services" onClose={() => { setActiveDialog(null); setServiceLog(null) }} size={serviceLog ? 'full' : 'xl'}>
            {serviceLog ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    Logs: {serviceLog.name}
                  </h4>
                  <button onClick={() => setServiceLog(null)} className="btn btn-secondary btn-sm">
                    <X className="w-4 h-4" /> Close
                  </button>
                </div>
                <pre className="p-4 bg-dark-950 rounded-lg text-sm text-dark-300 overflow-auto max-h-[60vh] font-mono whitespace-pre-wrap break-all">{serviceLog.logs}</pre>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                  <input type="text" placeholder="Search services..." value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} className="input pl-10" />
                </div>
                {servicesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {filteredServices.slice(0, 50).map((service) => (
                      <div key={service.name} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${service.active ? 'bg-green-500' : 'bg-red-500'}`} />
                          <div>
                            <p className="text-sm font-medium text-white">{service.name}</p>
                            <p className="text-xs text-dark-500">{service.status} ({service.sub_status})</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => controlService(service.name, service.active ? 'stop' : 'start')} className={`p-2 rounded-lg transition-colors ${service.active ? 'text-red-400 hover:bg-red-500/20' : 'text-green-400 hover:bg-green-500/20'}`}>
                            {service.active ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <button onClick={() => controlService(service.name, 'restart')} className="p-2 text-yellow-400 hover:bg-yellow-500/20 rounded-lg transition-colors">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button onClick={() => getServiceLogs(service.name)} className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors">
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Dialog>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeDialog === 'packages' && (
          <Dialog title="Package Management" onClose={() => { setActiveDialog(null); setPackageTab('installed'); setPackageCategoryFilter('all') }} size="xl">
            <div className="space-y-4">
              <div className="flex gap-2 border-b border-dark-700 pb-2">
                <button onClick={() => setPackageTab('installed')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${packageTab === 'installed' ? 'bg-primary-500/20 text-primary-400' : 'text-dark-400 hover:text-white hover:bg-dark-800'}`}>
                  <Package className="w-4 h-4 inline mr-2" />Installed ({installedPackages.length})
                </button>
                <button onClick={() => setPackageTab('install')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${packageTab === 'install' ? 'bg-green-500/20 text-green-400' : 'text-dark-400 hover:text-white hover:bg-dark-800'}`}>
                  <Download className="w-4 h-4 inline mr-2" />Install Packages
                </button>
              </div>

              {packageTab === 'installed' ? (
                packagesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-dark-400">Showing first 100 installed packages</p>
                    <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                      {installedPackages.map((pkg) => (
                        <div key={pkg} className="p-2 bg-dark-800/50 rounded text-sm text-dark-200 truncate" title={pkg}>{pkg}</div>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    {['all', 'essentials', 'network', 'security', 'web', 'containers', 'languages', 'databases', 'utilities'].map((cat) => (
                      <button key={cat} onClick={() => setPackageCategoryFilter(cat)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${packageCategoryFilter === cat ? 'bg-primary-500 text-white' : 'bg-dark-800 text-dark-400 hover:text-white'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {commonPackages
                      .filter((pkg) => packageCategoryFilter === 'all' || pkg.category === packageCategoryFilter)
                      .map((pkg) => {
                        const isInstalled = installedPackages.some(p => p.includes(pkg.name.split('.')[0]))
                        return (
                          <label key={pkg.name} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${isInstalled ? 'bg-green-500/10 border border-green-500/30' : selectedPackages.has(pkg.name) ? 'bg-primary-500/20 border border-primary-500/50' : 'bg-dark-800/50 hover:bg-dark-700/50 border border-transparent'}`}>
                            <input type="checkbox" checked={selectedPackages.has(pkg.name)} disabled={isInstalled} onChange={(e) => {
                              const newSet = new Set(selectedPackages)
                              if (e.target.checked) newSet.add(pkg.name)
                              else newSet.delete(pkg.name)
                              setSelectedPackages(newSet)
                            }} className="sr-only" />
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isInstalled ? 'bg-green-500 border-green-500' : selectedPackages.has(pkg.name) ? 'bg-primary-500 border-primary-500' : 'border-dark-500'}`}>
                              {(isInstalled || selectedPackages.has(pkg.name)) && <span className="text-white text-xs">✓</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{pkg.name}</p>
                              <p className="text-xs text-dark-500 truncate">{isInstalled ? 'Already installed' : pkg.description}</p>
                            </div>
                          </label>
                        )
                      })}
                  </div>
                  {selectedPackages.size > 0 && (
                    <button onClick={installSelectedPackages} disabled={isUpdating} className="btn btn-primary w-full">
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Install {selectedPackages.size} Package{selectedPackages.size !== 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              )}
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeDialog === 'install' && (
          <Dialog title="Install Packages" onClose={() => setActiveDialog(null)} size="lg">
            <div className="space-y-4">
              <p className="text-sm text-dark-400">Select packages to install</p>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {commonPackages.map((pkg) => (
                  <label key={pkg.name} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedPackages.has(pkg.name) ? 'bg-primary-500/20 border border-primary-500/50' : 'bg-dark-800/50 hover:bg-dark-700/50'}`}>
                    <input
                      type="checkbox"
                      checked={selectedPackages.has(pkg.name)}
                      onChange={(e) => {
                        const newSet = new Set(selectedPackages)
                        if (e.target.checked) newSet.add(pkg.name)
                        else newSet.delete(pkg.name)
                        setSelectedPackages(newSet)
                      }}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedPackages.has(pkg.name) ? 'bg-primary-500 border-primary-500' : 'border-dark-500'}`}>
                      {selectedPackages.has(pkg.name) && <span className="text-white text-xs">✓</span>}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{pkg.name}</p>
                      <p className="text-xs text-dark-500">{pkg.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <button onClick={installSelectedPackages} disabled={selectedPackages.size === 0 || isUpdating} className="btn btn-primary w-full">
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Install {selectedPackages.size} Package{selectedPackages.size !== 1 ? 's' : ''}
              </button>
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {packageLog && (
          <Dialog title={packageLog.action} onClose={() => setPackageLog(null)} size="full">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(isUpdating || isUpgrading) && <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />}
                  <span className="text-sm text-dark-400">
                    {(isUpdating || isUpgrading) ? 'Operation in progress...' : 'Operation completed'}
                  </span>
                </div>
                <button onClick={() => setPackageLog(null)} className="btn btn-secondary btn-sm">
                  <X className="w-4 h-4" /> Close
                </button>
              </div>
              <pre className="p-4 bg-dark-950 rounded-lg text-sm text-dark-300 overflow-auto max-h-[60vh] font-mono whitespace-pre-wrap break-all">
                {packageLog.output}
              </pre>
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Container Management Dialog */}
      <AnimatePresence>
        {activeDialog === 'containers' && (
          <Dialog title={`Containers (${containerRuntime || 'checking...'})`} onClose={() => { setActiveDialog(null); setContainerLog(null) }} size="xl">
            {!containerRuntimeChecked ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                <span className="ml-2 text-dark-400">Detecting container runtime...</span>
              </div>
            ) : !containerRuntime ? (
              <div className="text-center py-12">
                <Box className="w-16 h-16 text-dark-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No Container Runtime Found</h3>
                <p className="text-dark-400 mb-4">Docker or Podman is not installed on this server.</p>
                <p className="text-sm text-dark-500">Install Docker or Podman to manage containers.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs font-medium uppercase">{containerRuntime}</span>
                    <span className="text-sm text-dark-400">{containers.length} container(s)</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={fetchContainers} className="btn btn-secondary btn-sm">
                      <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                    <button onClick={pruneContainerSystem} className="btn btn-secondary btn-sm text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" /> Clean
                    </button>
                  </div>
                </div>
                
                {containersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                  </div>
                ) : containers.length === 0 ? (
                  <div className="text-center py-8 text-dark-400">
                    <Box className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No containers found</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {containers.map((container) => (
                      <div key={container.id} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-3 h-3 rounded-full ${container.state === 'running' ? 'bg-green-500' : container.state === 'exited' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate">{container.name}</p>
                            <p className="text-xs text-dark-500 truncate">{container.image}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs ${container.state === 'running' ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'}`}>
                            {container.state}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          {container.state === 'running' ? (
                            <button onClick={() => handleContainerAction(container.id, 'stop')} disabled={containerActionLoading === `${container.id}-stop`} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors" title="Stop">
                              {containerActionLoading === `${container.id}-stop` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                            </button>
                          ) : (
                            <button onClick={() => handleContainerAction(container.id, 'start')} disabled={containerActionLoading === `${container.id}-start`} className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors" title="Start">
                              {containerActionLoading === `${container.id}-start` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            </button>
                          )}
                          <button onClick={() => handleContainerAction(container.id, 'restart')} disabled={containerActionLoading === `${container.id}-restart`} className="p-2 text-yellow-400 hover:bg-yellow-500/20 rounded-lg transition-colors" title="Restart">
                            {containerActionLoading === `${container.id}-restart` ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                          </button>
                          <button onClick={() => handleContainerAction(container.id, 'logs')} disabled={containerActionLoading === `${container.id}-logs`} className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors" title="Logs">
                            {containerActionLoading === `${container.id}-logs` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Dialog>
        )}
      </AnimatePresence>

      {/* Container Images Dialog */}
      <AnimatePresence>
        {activeDialog === 'images' && (
          <Dialog title={`Container Images (${containerRuntime || 'checking...'})`} onClose={() => { setActiveDialog(null); setSelectedImages(new Set()) }} size="xl">
            {!containerRuntimeChecked ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                <span className="ml-2 text-dark-400">Detecting container runtime...</span>
              </div>
            ) : !containerRuntime ? (
              <div className="text-center py-12">
                <Image className="w-16 h-16 text-dark-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No Container Runtime Found</h3>
                <p className="text-dark-400 mb-4">Docker or Podman is not installed on this server.</p>
                <p className="text-sm text-dark-500">Install Docker or Podman to manage images.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs font-medium uppercase">{containerRuntime}</span>
                    <span className="text-sm text-dark-400">{containerImages.length} image(s)</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={fetchContainerImages} className="btn btn-secondary btn-sm">
                      <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                    {selectedImages.size > 0 && (
                      <button onClick={deleteSelectedImages} className="btn btn-secondary btn-sm text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" /> Delete ({selectedImages.size})
                      </button>
                    )}
                  </div>
                </div>
                
                {imagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                  </div>
                ) : containerImages.length === 0 ? (
                  <div className="text-center py-8 text-dark-400">
                    <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No images found</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {containerImages.map((image) => (
                      <label key={image.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedImages.has(image.id) ? 'bg-red-500/20 border border-red-500/50' : 'bg-dark-800/50 hover:bg-dark-700/50'}`}>
                        <input type="checkbox" checked={selectedImages.has(image.id)} onChange={(e) => {
                          const newSet = new Set(selectedImages)
                          if (e.target.checked) newSet.add(image.id)
                          else newSet.delete(image.id)
                          setSelectedImages(newSet)
                        }} className="sr-only" />
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedImages.has(image.id) ? 'bg-red-500 border-red-500' : 'border-dark-500'}`}>
                          {selectedImages.has(image.id) && <span className="text-white text-xs">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{image.repository}:{image.tag}</p>
                          <p className="text-xs text-dark-500">{image.id.substring(0, 12)} • {image.size}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Dialog>
        )}
      </AnimatePresence>

      {/* Container Logs Dialog */}
      <AnimatePresence>
        {containerLog && (
          <Dialog title={`Logs: ${containerLog.name}`} onClose={() => setContainerLog(null)} size="full">
            <pre className="p-4 bg-dark-950 rounded-lg text-sm text-dark-300 overflow-auto max-h-[60vh] font-mono whitespace-pre-wrap break-all">
              {containerLog.logs}
            </pre>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Ping Dialog */}
      <AnimatePresence>
        {activeDialog === 'ping' && (
          <Dialog title="Ping" onClose={() => { setActiveDialog(null); setNetworkResult(null); setNetworkTarget('') }} size="lg">
            <div className="space-y-4">
              <div className="flex gap-2">
                <input type="text" value={networkTarget} onChange={(e) => setNetworkTarget(e.target.value)} placeholder="Enter hostname or IP (e.g., google.com)" className="flex-1 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-primary-500" onKeyDown={(e) => e.key === 'Enter' && runPing()} />
                <button onClick={runPing} disabled={networkLoading} className="btn btn-primary">
                  {networkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                  Ping
                </button>
              </div>
              {networkResult && networkResult.type === 'Ping' && (
                <pre className="p-4 bg-dark-950 rounded-lg text-sm text-dark-300 overflow-auto max-h-80 font-mono whitespace-pre-wrap">
                  {networkResult.output}
                </pre>
              )}
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Traceroute Dialog */}
      <AnimatePresence>
        {activeDialog === 'traceroute' && (
          <Dialog title="Traceroute" onClose={() => { setActiveDialog(null); setNetworkResult(null); setNetworkTarget('') }} size="lg">
            <div className="space-y-4">
              <div className="flex gap-2">
                <input type="text" value={networkTarget} onChange={(e) => setNetworkTarget(e.target.value)} placeholder="Enter hostname or IP (e.g., google.com)" className="flex-1 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-primary-500" onKeyDown={(e) => e.key === 'Enter' && runTraceroute()} />
                <button onClick={runTraceroute} disabled={networkLoading} className="btn btn-primary">
                  {networkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
                  Trace
                </button>
              </div>
              {networkResult && networkResult.type === 'Traceroute' && (
                <pre className="p-4 bg-dark-950 rounded-lg text-sm text-dark-300 overflow-auto max-h-80 font-mono whitespace-pre-wrap">
                  {networkResult.output}
                </pre>
              )}
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Netstat Dialog */}
      <AnimatePresence>
        {activeDialog === 'netstat' && (
          <Dialog title="Network Connections" onClose={() => { setActiveDialog(null); setNetworkResult(null) }} size="full">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-400">Active network connections and listening ports</span>
                <button onClick={runNetstat} disabled={networkLoading} className="btn btn-secondary btn-sm">
                  {networkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Refresh
                </button>
              </div>
              {networkLoading && !networkResult ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
              ) : networkResult && networkResult.type === 'Netstat' ? (
                <pre className="p-4 bg-dark-950 rounded-lg text-sm text-dark-300 overflow-auto max-h-[60vh] font-mono whitespace-pre-wrap">
                  {networkResult.output}
                </pre>
              ) : null}
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Syslog Dialog */}
      <AnimatePresence>
        {activeDialog === 'syslog' && (
          <Dialog title="System Log" onClose={() => setActiveDialog(null)} size="full">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-400">Recent system log entries (last 200 lines)</span>
                <button onClick={fetchSyslog} disabled={logsLoading} className="btn btn-secondary btn-sm">
                  {logsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Refresh
                </button>
              </div>
              {logsLoading && !syslogContent ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
              ) : (
                <pre className="p-4 bg-dark-950 rounded-lg text-sm text-dark-300 overflow-auto max-h-[60vh] font-mono whitespace-pre-wrap">
                  {syslogContent || 'No logs available'}
                </pre>
              )}
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Auth Log Dialog */}
      <AnimatePresence>
        {activeDialog === 'authlog' && (
          <Dialog title="Authentication Log" onClose={() => setActiveDialog(null)} size="full">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-400">Recent authentication events (last 200 lines)</span>
                <button onClick={fetchAuthLog} disabled={logsLoading} className="btn btn-secondary btn-sm">
                  {logsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Refresh
                </button>
              </div>
              {logsLoading && !authLogContent ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
              ) : (
                <pre className="p-4 bg-dark-950 rounded-lg text-sm text-dark-300 overflow-auto max-h-[60vh] font-mono whitespace-pre-wrap">
                  {authLogContent || 'No logs available'}
                </pre>
              )}
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Cron Jobs Dialog */}
      <AnimatePresence>
        {activeDialog === 'cronjobs' && (
          <Dialog title="Cron Jobs" onClose={() => { setActiveDialog(null); setShowCronForm(false); setShowFileBrowser(false) }} size="xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <select value={cronUser} onChange={(e) => { setCronUser(e.target.value); }} className="px-3 py-1.5 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white appearance-none cursor-pointer">
                    <option value="current">Current User</option>
                    <option value="root">Root</option>
                  </select>
                  <button onClick={fetchCronJobs} className="btn btn-secondary btn-sm">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <button onClick={() => setShowCronForm(!showCronForm)} className="btn btn-primary btn-sm">
                  <Plus className="w-4 h-4" /> Add Job
                </button>
              </div>

              {showCronForm && (
                <div className="p-4 bg-dark-800/50 rounded-lg space-y-3">
                  <div className="grid grid-cols-5 gap-2">
                    <div>
                      <label className="text-xs text-dark-400">Minute</label>
                      <input type="text" value={newCronJob.minute} onChange={(e) => setNewCronJob({...newCronJob, minute: e.target.value})} className="w-full px-2 py-1 bg-dark-900 border border-dark-700 rounded text-sm text-white" placeholder="*" />
                    </div>
                    <div>
                      <label className="text-xs text-dark-400">Hour</label>
                      <input type="text" value={newCronJob.hour} onChange={(e) => setNewCronJob({...newCronJob, hour: e.target.value})} className="w-full px-2 py-1 bg-dark-900 border border-dark-700 rounded text-sm text-white" placeholder="*" />
                    </div>
                    <div>
                      <label className="text-xs text-dark-400">Day</label>
                      <input type="text" value={newCronJob.day} onChange={(e) => setNewCronJob({...newCronJob, day: e.target.value})} className="w-full px-2 py-1 bg-dark-900 border border-dark-700 rounded text-sm text-white" placeholder="*" />
                    </div>
                    <div>
                      <label className="text-xs text-dark-400">Month</label>
                      <input type="text" value={newCronJob.month} onChange={(e) => setNewCronJob({...newCronJob, month: e.target.value})} className="w-full px-2 py-1 bg-dark-900 border border-dark-700 rounded text-sm text-white" placeholder="*" />
                    </div>
                    <div>
                      <label className="text-xs text-dark-400">Weekday</label>
                      <input type="text" value={newCronJob.weekday} onChange={(e) => setNewCronJob({...newCronJob, weekday: e.target.value})} className="w-full px-2 py-1 bg-dark-900 border border-dark-700 rounded text-sm text-white" placeholder="*" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={newCronJob.command} onChange={(e) => setNewCronJob({...newCronJob, command: e.target.value})} className="flex-1 px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white" placeholder="Command or script path" />
                    <button onClick={() => { setShowFileBrowser(true); browseDir('/') }} className="btn btn-secondary btn-sm">
                      <FolderOpen className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addNewCronJob} className="btn btn-primary btn-sm">Save</button>
                    <button onClick={() => setShowCronForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
                  </div>
                </div>
              )}

              {showFileBrowser && (
                <div className="p-4 bg-dark-800/50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-sm text-dark-400">
                    <FolderOpen className="w-4 h-4" />
                    <span>{browsingPath}</span>
                    {browsingPath !== '/' && (
                      <button onClick={() => browseDir(browsingPath.split('/').slice(0, -1).join('/') || '/')} className="text-primary-400 hover:underline">← Back</button>
                    )}
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {directoryContents.map((item) => (
                      <div key={item.path} className="flex items-center gap-2 p-2 hover:bg-dark-700/50 rounded cursor-pointer" onClick={() => item.type === 'dir' ? browseDir(item.path) : setNewCronJob({...newCronJob, command: item.path})}>
                        {item.type === 'dir' ? <FolderOpen className="w-4 h-4 text-yellow-400" /> : <FileText className="w-4 h-4 text-blue-400" />}
                        <span className="text-sm text-white">{item.name}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setShowFileBrowser(false)} className="btn btn-secondary btn-sm">Close Browser</button>
                </div>
              )}

              {cronLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                </div>
              ) : cronJobs.length === 0 ? (
                <div className="text-center py-8 text-dark-400">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No cron jobs found</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {cronJobs.map((job, idx) => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-primary-400">{job.minute} {job.hour} {job.day} {job.month} {job.weekday}</p>
                        <p className="text-sm text-white truncate">{job.command}</p>
                      </div>
                      <button onClick={() => deleteCron(idx)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Process Management Dialog */}
      <AnimatePresence>
        {activeDialog === 'processes' && (
          <Dialog title="Process Management" onClose={() => setActiveDialog(null)} size="full">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-dark-400">Sort by:</span>
                  <select value={processSortBy} onChange={(e) => { setProcessSortBy(e.target.value); }} className="px-3 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white">
                    <option value="cpu">CPU Usage</option>
                    <option value="memory">Memory Usage</option>
                  </select>
                </div>
                <button onClick={fetchProcesses} disabled={processesLoading} className="btn btn-secondary btn-sm">
                  {processesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Refresh
                </button>
              </div>

              {processesLoading && processes.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
              ) : (
                <div className="overflow-auto max-h-[60vh]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-dark-400 border-b border-dark-700">
                        <th className="p-2">PID</th>
                        <th className="p-2">User</th>
                        <th className="p-2">CPU %</th>
                        <th className="p-2">MEM %</th>
                        <th className="p-2">Command</th>
                        <th className="p-2 w-20">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processes.slice(0, 30).map((proc) => (
                        <tr key={proc.pid} className="border-b border-dark-800 hover:bg-dark-800/50">
                          <td className="p-2 font-mono text-primary-400">{proc.pid}</td>
                          <td className="p-2 text-dark-300">{proc.user}</td>
                          <td className="p-2">
                            <span className={proc.cpu > 50 ? 'text-red-400' : proc.cpu > 20 ? 'text-yellow-400' : 'text-green-400'}>
                              {proc.cpu.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-2">
                            <span className={proc.memory > 50 ? 'text-red-400' : proc.memory > 20 ? 'text-yellow-400' : 'text-green-400'}>
                              {proc.memory.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-2 text-dark-300 truncate max-w-xs" title={proc.command}>{proc.command}</td>
                          <td className="p-2">
                            <button onClick={() => killProc(proc.pid, 'TERM')} disabled={killingPid === proc.pid} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors" title="Kill (SIGTERM)">
                              {killingPid === proc.pid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Skull className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Firewall Dialog */}
      <AnimatePresence>
        {activeDialog === 'firewall' && (
          <Dialog title="Firewall Management" onClose={() => { setActiveDialog(null); setShowFirewallForm(false) }} size="xl">
            <div className="space-y-4">
              {firewallLoading && !firewallStatus ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
              ) : !firewallStatus || firewallStatus.type === 'none' ? (
                <div className="text-center py-8 text-dark-400">
                  <Flame className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No firewall detected (UFW or iptables)</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-dark-800 rounded text-xs font-medium uppercase text-dark-300">{firewallStatus.type}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${firewallStatus.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {firewallStatus.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {pendingConfirm?.type === 'toggleFirewall' ? (
                        <div className="flex items-center gap-2 bg-dark-800 rounded-lg px-3 py-1.5">
                          <span className="text-sm text-dark-300">{firewallStatus.active ? 'Disable' : 'Enable'} firewall?</span>
                          <button onClick={() => toggleFw(!firewallStatus.active)} className="text-xs px-2 py-1 bg-primary-500 text-white rounded">Yes</button>
                          <button onClick={() => setPendingConfirm(null)} className="text-xs px-2 py-1 bg-dark-700 text-dark-300 rounded">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setPendingConfirm({ type: 'toggleFirewall' })} className={`btn btn-sm ${firewallStatus.active ? 'btn-secondary text-red-400' : 'btn-primary'}`}>
                          {firewallStatus.active ? <><Unlock className="w-4 h-4" /> Disable</> : <><Lock className="w-4 h-4" /> Enable</>}
                        </button>
                      )}
                      <button onClick={() => setShowFirewallForm(!showFirewallForm)} className="btn btn-primary btn-sm">
                        <Plus className="w-4 h-4" /> Add Rule
                      </button>
                      <button onClick={fetchFirewallStatus} className="btn btn-secondary btn-sm">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {showFirewallForm && (
                    <div className="p-4 bg-dark-800/50 rounded-lg space-y-3">
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs text-dark-400">Port</label>
                          <input type="text" value={newFirewallRule.port} onChange={(e) => setNewFirewallRule({...newFirewallRule, port: e.target.value})} className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white" placeholder="22, 80, 443" />
                        </div>
                        <div>
                          <label className="text-xs text-dark-400">Protocol</label>
                          <select value={newFirewallRule.protocol} onChange={(e) => setNewFirewallRule({...newFirewallRule, protocol: e.target.value})} className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white">
                            <option value="tcp">TCP</option>
                            <option value="udp">UDP</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-dark-400">From IP (optional)</label>
                          <input type="text" value={newFirewallRule.fromIP} onChange={(e) => setNewFirewallRule({...newFirewallRule, fromIP: e.target.value})} className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white" placeholder="Any" />
                        </div>
                        <div>
                          <label className="text-xs text-dark-400">Action</label>
                          <select value={newFirewallRule.action} onChange={(e) => setNewFirewallRule({...newFirewallRule, action: e.target.value})} className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white">
                            <option value="allow">Allow</option>
                            <option value="deny">Deny</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={addFwRule} className="btn btn-primary btn-sm">Add Rule</button>
                        <button onClick={() => setShowFirewallForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
                      </div>
                    </div>
                  )}

                  {firewallStatus.rules.length === 0 ? (
                    <div className="text-center py-8 text-dark-400">
                      <p>No firewall rules configured</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {firewallStatus.rules.map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-dark-500">#{rule.number}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${rule.action === 'ALLOW' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                              {rule.action}
                            </span>
                            <span className="text-sm text-white">{rule.port || rule.raw_rule}</span>
                            {rule.protocol && <span className="text-xs text-dark-500">/{rule.protocol}</span>}
                          </div>
                          <button onClick={() => deleteFwRule(rule.number)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </Dialog>
        )}

        {/* Snippets Dialog */}
        {activeDialog === 'snippets' && (
          <Dialog title="Run Snippets" onClose={() => setActiveDialog(null)} size="lg">
            <div className="p-4 space-y-4">
              {snippetsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
              ) : snippetsList.length === 0 ? (
                <div className="text-center py-8">
                  <Code2 className="w-12 h-12 text-dark-500 mx-auto mb-3" />
                  <p className="text-dark-400 mb-2">No snippets saved</p>
                  <p className="text-sm text-dark-500">Create snippets from the Snippets page to use them here</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {snippetsList.map((snippet) => (
                    <div key={snippet.id} className="group p-4 bg-dark-800/50 rounded-xl border border-dark-700/50 hover:border-primary-500/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-white">{snippet.label}</h4>
                          {snippet.description && (
                            <p className="text-xs text-dark-400">{snippet.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(snippet.content)
                              toast.success('Copied to clipboard')
                            }}
                            className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                            title="Copy to clipboard"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => runSnippet(snippet.content)}
                            className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Run
                          </button>
                        </div>
                      </div>
                      <pre className="bg-dark-900 rounded-lg p-3 text-sm font-mono text-dark-200 overflow-x-auto">
                        {snippet.content}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  )
}

function Dialog({ title, onClose, children, size = 'md' }: { title: string; onClose: () => void; children: React.ReactNode; size?: 'md' | 'lg' | 'xl' | 'full' }) {
  const sizeClasses = { md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl', full: 'max-w-4xl' }
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={`w-full ${sizeClasses[size]} bg-dark-900 border border-dark-700/50 rounded-2xl shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700/50">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  )
}

function MetricCard({ icon: Icon, label, value, percent, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; percent: number; color: string }) {
  return (
    <div className="p-4 bg-dark-800/50 rounded-xl">
      <div className="flex items-center gap-3 mb-3">
        <Icon className="w-5 h-5 text-white" />
        <span className="text-sm text-dark-400">{label}</span>
      </div>
      <p className="text-lg font-semibold text-white mb-2">{value}</p>
      <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <p className="text-xs text-dark-500 mt-1">{percent.toFixed(1)}%</p>
    </div>
  )
}
