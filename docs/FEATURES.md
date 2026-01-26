# binsh Features

Complete feature reference for binsh SSH client and server management platform.

---

## Table of Contents

1. [Host Management](#host-management)
2. [Group Management](#group-management)
3. [Terminal & SSH](#terminal--ssh)
4. [SFTP File Manager](#sftp-file-manager)
5. [Cloud Provider Integration](#cloud-provider-integration)
6. [Port Forwarding](#port-forwarding)
7. [Keychain](#keychain)
8. [Snippets](#snippets)
9. [Quick Actions](#quick-actions)
10. [Vault & Security](#vault--security)
11. [Import & Export](#import--export)
12. [Settings](#settings)

---

## Host Management

Manage all your SSH servers in one place.

### Features

| Feature | Description |
|---------|-------------|
| **Add Hosts** | Add servers with hostname, IP, port, username |
| **Authentication Methods** | Password, SSH Key (file path or inline), or Keychain reference |
| **Tags** | Organize hosts with custom tags for filtering |
| **Groups** | Assign hosts to groups for organization |
| **Quick Connect** | One-click terminal connection |
| **Edit/Delete** | Modify or remove host configurations |
| **Search** | Global search across all hosts and groups |

### Host Configuration Options

```
Label:          Display name for the host
Address:        IP address or hostname
Port:           SSH port (default: 22)
Username:       SSH username
Auth Method:    password | key | keychain
Password:       For password authentication
SSH Key:        Private key content (inline)
SSH Key Path:   Path to private key file (e.g., ~/.ssh/id_rsa)
Keychain:       Reference to stored keychain entry
Group:          Assign to a host group
Tags:           Comma-separated tags
```

---

## Group Management

Organize hosts into logical groups.

### Features

| Feature | Description |
|---------|-------------|
| **Create Groups** | Create groups with custom name, color, and icon |
| **Nested Organization** | Visual grouping in the host list |
| **Cloud Sync** | Enable automatic sync with cloud providers |
| **Bulk Actions** | Perform actions on all hosts in a group |
| **Color Coding** | Custom colors for visual identification |
| **Icons** | Custom icons (folder, cloud, database, etc.) |

### Cloud Sync Configuration

When cloud sync is enabled, groups can automatically import instances from:

- AWS EC2
- Google Cloud Platform (GCP)
- Microsoft Azure
- DigitalOcean
- Linode (Akamai)
- Alibaba Cloud
- Oracle Cloud Infrastructure (OCI)

---

## Terminal & SSH

Full-featured terminal emulator with SSH support.

### Features

| Feature | Description |
|---------|-------------|
| **SSH Terminal** | Full xterm.js-based terminal emulator |
| **Local Terminal** | Access local shell without SSH |
| **Multi-Terminal** | Open multiple terminal sessions |
| **Tabs** | Tabbed interface for multiple connections |
| **Themes** | Multiple color themes (dark, light, custom) |
| **Font Settings** | Customizable font family and size |
| **Copy/Paste** | Full clipboard support |
| **Zen Mode** | Distraction-free full-screen terminal |
| **Quick Actions Panel** | Side panel with server management tools |

### Terminal Themes

- Dracula
- One Dark
- Nord
- Monokai
- Solarized Dark
- Solarized Light
- GitHub Dark
- GitHub Light
- Material
- Gruvbox
- And more...

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+C` | Copy |
| `Ctrl+Shift+V` | Paste |
| `Ctrl+Shift+T` | New Tab |
| `Ctrl+Shift+W` | Close Tab |
| `F11` | Toggle Zen Mode |

---

## SFTP File Manager

Dual-pane file manager for local and remote file operations.

### Features

| Feature | Description |
|---------|-------------|
| **Dual Pane** | Local filesystem on left, remote on right |
| **Multi-Host** | Tabs for multiple remote connections |
| **Upload/Download** | Transfer files between local and remote |
| **Server-to-Server** | Transfer files between two remote servers |
| **Directory Operations** | Create, rename, delete directories |
| **File Operations** | Create, rename, delete, view files |
| **Progress Tracking** | Real-time transfer progress |
| **Drag & Drop** | Drag files between panes |
| **Context Menu** | Right-click for quick actions |

### Transfer Modes

1. **Local ↔ Remote**: Upload/download between local machine and server
2. **Remote ↔ Remote**: Transfer between two different servers
3. **Streaming Transfer**: Memory-efficient streaming for large files

---

## Cloud Provider Integration

Automatically discover and import cloud instances.

### Supported Providers

| Provider | Features |
|----------|----------|
| **AWS EC2** | List instances, auto-import, region support |
| **Google Cloud** | Compute Engine instances |
| **Microsoft Azure** | Virtual Machines |
| **DigitalOcean** | Droplets |
| **Linode** | Linodes |
| **Alibaba Cloud** | ECS Instances |
| **Oracle Cloud** | Compute Instances |

### Configuration

Each provider requires specific credentials:

**AWS:**
- Access Key ID
- Secret Access Key
- Region

**GCP:**
- Project ID
- Service Account JSON

**Azure:**
- Subscription ID
- Tenant ID
- Client ID
- Client Secret

**DigitalOcean:**
- API Token

**Linode:**
- API Token

---

## Port Forwarding

Manage SSH tunnels and port forwards.

### Types

| Type | Description |
|------|-------------|
| **Local Forward** | Forward local port to remote destination |
| **Remote Forward** | Forward remote port to local destination |
| **Dynamic (SOCKS)** | Create SOCKS proxy through SSH |

### Features

- Create and save port forwarding rules
- Start/stop tunnels on demand
- Auto-start on connection
- Status monitoring
- Multiple tunnels per host

### Configuration

```
Name:           Descriptive name
Type:           local | remote | dynamic
Host:           SSH host to tunnel through
Local Port:     Port on local machine
Remote Host:    Destination host (for local/remote)
Remote Port:    Destination port
Auto Start:     Start tunnel automatically
```

---

## Keychain

Secure credential storage and management.

### Features

| Feature | Description |
|---------|-------------|
| **Store Credentials** | Save username/password pairs |
| **SSH Keys** | Store and manage SSH private keys |
| **Reference in Hosts** | Use keychain entries for authentication |
| **Encrypted Storage** | All credentials encrypted at rest |
| **Labels** | Descriptive names for credentials |

### Credential Types

1. **Password**: Username + password pair
2. **SSH Key**: Private key with optional passphrase
3. **Combined**: Username + SSH key

---

## Snippets

Command snippet library for quick execution.

### Features

| Feature | Description |
|---------|-------------|
| **Create Snippets** | Save frequently used commands |
| **Categories** | Organize snippets by category |
| **Quick Insert** | Insert snippets into terminal |
| **Variables** | Support for placeholder variables |
| **Search** | Quick search through snippets |

### Built-in Categories

- System Administration
- Docker/Containers
- Network
- File Operations
- User Management
- Package Management
- Custom

---

## Quick Actions

One-click server management tasks accessible from the terminal.

### System Metrics

Real-time system information:
- CPU usage and load average
- Memory usage (used/total/percentage)
- Disk usage per mount point
- Network interfaces and IPs
- System uptime
- Running processes count

### User Management

| Action | Description |
|--------|-------------|
| List Users | View all system users |
| Create User | Add new user with password and groups |
| Delete User | Remove user account |
| Modify Groups | Add/remove user from groups |
| List Groups | View all system groups |

### Service Management

| Action | Description |
|--------|-------------|
| List Services | View all systemd services |
| Start Service | Start a stopped service |
| Stop Service | Stop a running service |
| Restart Service | Restart a service |
| Enable Service | Enable service at boot |
| Disable Service | Disable service at boot |
| View Logs | View service logs (journalctl) |

### Package Management

Automatic package manager detection (apt, yum, dnf, pacman, apk):

| Action | Description |
|--------|-------------|
| Update | Update package list |
| Upgrade | Upgrade all packages |
| Install | Install new packages |
| Remove | Remove packages |
| Search | Search for packages |
| List Installed | View installed packages |

### Container Management

Support for Docker and Podman:

| Action | Description |
|--------|-------------|
| List Containers | View all containers |
| Start Container | Start stopped container |
| Stop Container | Stop running container |
| Restart Container | Restart container |
| View Logs | View container logs |
| List Images | View container images |
| Delete Images | Remove unused images |
| System Prune | Clean up unused resources |

### Firewall Management

Support for UFW and firewalld:

| Action | Description |
|--------|-------------|
| Status | View firewall status |
| Enable/Disable | Toggle firewall |
| Add Rule | Add firewall rule |
| Delete Rule | Remove firewall rule |
| List Rules | View all rules |

### Cron Jobs

| Action | Description |
|--------|-------------|
| List Jobs | View all cron jobs |
| Add Job | Create new cron job |
| Delete Job | Remove cron job |

### Process Management

| Action | Description |
|--------|-------------|
| List Processes | View running processes |
| Kill Process | Terminate a process |

### Log Viewer

| Log Type | Description |
|----------|-------------|
| System Log | /var/log/syslog or /var/log/messages |
| Auth Log | /var/log/auth.log or /var/log/secure |
| Custom Logs | Browse and view any log file |

---

## Vault & Security

Encrypted storage for sensitive data.

### Features

| Feature | Description |
|---------|-------------|
| **Master Password** | Single password to unlock vault |
| **AES-256 Encryption** | Industry-standard encryption |
| **Auto-Lock** | Automatic vault locking on timeout |
| **Secure Storage** | Passwords and keys encrypted at rest |

### Vault States

1. **Not Configured**: Initial state, needs setup
2. **Locked**: Configured but locked, needs unlock
3. **Unlocked**: Ready for use

### What's Protected

- Host passwords
- SSH private keys
- Keychain entries
- Cloud provider credentials

---

## Import & Export

Data portability features.

### Import Sources

| Source | Format | Description |
|--------|--------|-------------|
| **SSH Config** | ~/.ssh/config | Standard SSH config file |
| **JSON** | .json | binsh export format |
| **CSV** | .csv | Spreadsheet format |

### SSH Config Import

Parses standard SSH config format:
```
Host myserver
    HostName 192.168.1.100
    Port 22
    User admin
    IdentityFile ~/.ssh/id_rsa
```

### JSON Format

```json
{
  "version": "1.0",
  "exported_at": "2026-01-27T00:00:00Z",
  "hosts": [
    {
      "label": "Web Server",
      "address": "192.168.1.100",
      "port": 22,
      "username": "admin",
      "auth_method": "key",
      "ssh_key_path": "~/.ssh/id_rsa",
      "tags": ["production", "web"]
    }
  ],
  "groups": [
    {
      "id": "group-1",
      "label": "Production",
      "color": "#10B981"
    }
  ]
}
```

### CSV Format

```csv
label,address,port,username,auth_method,tags
Web Server,192.168.1.100,22,admin,key,"production;web"
DB Server,192.168.1.101,22,root,password,"production;database"
```

### Export Options

- **Format**: JSON or CSV
- **Include Groups**: Export group information
- **Include Passwords**: Optional (security warning)

---

## Settings

Application configuration options.

### General Settings

| Setting | Description |
|---------|-------------|
| Theme | Light or Dark mode |
| Language | Interface language |
| Auto-connect | Auto-connect to last session |

### Terminal Settings

| Setting | Description |
|---------|-------------|
| Font Family | Terminal font (monospace) |
| Font Size | Terminal font size |
| Theme | Terminal color scheme |
| Cursor Style | Block, underline, or bar |
| Scrollback | Number of lines to keep |

### Security Settings

| Setting | Description |
|---------|-------------|
| Vault Timeout | Auto-lock timeout |
| Confirm Delete | Require confirmation for deletions |

### Connection Settings

| Setting | Description |
|---------|-------------|
| Connection Timeout | SSH connection timeout |
| Keep Alive Interval | SSH keep-alive interval |
| Retry Attempts | Number of connection retries |

---

## Known Hosts

SSH host key management.

### Features

| Feature | Description |
|---------|-------------|
| **View Known Hosts** | List all known host keys |
| **Remove Entries** | Delete outdated or changed keys |
| **Auto-Add** | Automatically add new host keys |
| **Fingerprint Display** | View key fingerprints |

---

*For detailed usage instructions, see the [User Guide](./USER_GUIDE.md).*
