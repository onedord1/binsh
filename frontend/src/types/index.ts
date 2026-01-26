export interface User {
  id: string
  email: string
  name?: string
  created_at: number
}

export interface Host {
  id: string
  user_id: string
  label: string
  address: string
  port: number
  username: string
  auth_method: 'password' | 'key' | 'agent'
  password?: string
  ssh_key_path?: string
  ssh_key?: string
  passphrase?: string
  group_id?: string
  tags?: string[]
  startup_command?: string
  proxy_id?: string
  backspace?: string
  agent_forwarding: boolean
  host_checking: boolean
  utf8: boolean
  mosh: boolean
  theme?: string
  env_vars?: string
  created_at: number
  last_connected?: number
}

export interface Group {
  id: string
  user_id: string
  label: string
  parent_id?: string
  icon?: string
  color?: string
  cloud_sync: boolean
  cloud_provider?: string
  cloud_config?: CloudConfig
  created_at: number
}

export interface CloudConfig {
  region?: string
  access_key_id?: string
  secret_access_key?: string
  service?: string
  ip_address_type?: string
}

export interface Keychain {
  id: string
  user_id: string
  label: string
  type: 'password' | 'key'
  username?: string
  password?: string
  private_key?: string
  passphrase?: string
  created_at: number
}

export interface Snippet {
  id: string
  user_id: string
  label: string
  content: string
  description?: string
  tags?: string[]
  created_at: number
}

export interface PortForward {
  id: string
  label: string
  host_id: string
  type: 'local' | 'remote' | 'dynamic'
  local_port: number
  remote_host?: string
  remote_port?: number
  bind_addr?: string
  auto_start: boolean
  created_at: number
}

export interface Settings {
  theme: string
  default_port: number
  default_username: string
  terminal_font: string
  terminal_font_size: number
  terminal_theme: string
  scrollback_lines: number
  copy_on_select: boolean
  paste_on_right_click: boolean
}

export interface ConnectionStatus {
  type: 'status' | 'log' | 'connected' | 'error'
  message: string
  success?: boolean
  timestamp: number
}

export interface AuthResponse {
  token: string
  user: User
}

export type TerminalTheme = {
  name: string
  id: string
  colors: {
    background: string
    foreground: string
    cursor: string
    cursorAccent: string
    selectionBackground: string
    black: string
    red: string
    green: string
    yellow: string
    blue: string
    magenta: string
    cyan: string
    white: string
    brightBlack: string
    brightRed: string
    brightGreen: string
    brightYellow: string
    brightBlue: string
    brightMagenta: string
    brightCyan: string
    brightWhite: string
  }
}
