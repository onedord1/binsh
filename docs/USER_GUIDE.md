# binsh User Guide

Complete guide to using binsh SSH client and server management platform.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Managing Hosts](#managing-hosts)
3. [Organizing with Groups](#organizing-with-groups)
4. [Connecting to Servers](#connecting-to-servers)
5. [Using the Terminal](#using-the-terminal)
6. [File Management with SFTP](#file-management-with-sftp)
7. [Cloud Sync](#cloud-sync)
8. [Port Forwarding](#port-forwarding)
9. [Using Quick Actions](#using-quick-actions)
10. [Keychain Management](#keychain-management)
11. [Snippets](#snippets)
12. [Import and Export](#import-and-export)
13. [Security and Vault](#security-and-vault)
14. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First Launch

1. **Start the Application**
   - Launch binsh from your applications menu or command line
   - The application opens to the login screen

2. **Create an Account**
   - Click "Register" if this is your first time
   - Enter your email and password
   - This creates a local account for the application

3. **Set Up the Vault**
   - After login, you'll be prompted to set up the vault
   - Create a master password (this encrypts your credentials)
   - **Important**: Remember this password - it cannot be recovered

4. **Unlock the Vault**
   - Enter your master password to unlock
   - The vault auto-locks after inactivity

### Navigation

The application has a sidebar with the following sections:

| Section | Description |
|---------|-------------|
| **Hosts** | Main host management view |
| **Known Hosts** | SSH known hosts management |
| **Keychain** | Credential storage |
| **Locker** | Secure notes and secrets |
| **Port Forwarding** | SSH tunnel management |
| **Snippets** | Command snippet library |
| **Settings** | Application settings |
| **Local Terminal** | Local shell access |
| **Multi Terminal** | Multiple terminal sessions |
| **SFTP Manager** | File transfer interface |

---

## Managing Hosts

### Adding a New Host

1. Click the **"+ New"** button in the header
2. Select **"New Host"**
3. Fill in the host details:

   ```
   Label:       My Web Server
   Address:     192.168.1.100 (or hostname)
   Port:        22
   Username:    admin
   ```

4. Choose authentication method:
   - **Password**: Enter the password directly
   - **SSH Key**: Paste key content or specify path
   - **Keychain**: Select from saved credentials

5. Optionally assign to a group and add tags
6. Click **"Save"**

### SSH Key Authentication

**Option 1: Key Path**
```
SSH Key Path: ~/Documents/mykey.pem
```
- Specify the full path to your private key
- Supports `~` expansion for home directory

**Option 2: Inline Key**
- Click the file picker to load a key
- The key content is stored securely in the vault

### Editing a Host

1. Find the host in the list
2. Click the **edit icon** (pencil)
3. Modify the settings
4. Click **"Save"**

### Deleting a Host

1. Find the host in the list
2. Click the **delete icon** (trash)
3. Confirm the deletion

### Searching Hosts

Use the search bar in the header to filter hosts by:
- Host label/name
- IP address
- Tags
- Group name

---

## Organizing with Groups

### Creating a Group

1. Click **"+ New"** → **"New Group"**
2. Enter group details:
   ```
   Name:   Production Servers
   Color:  #10B981 (green)
   Icon:   folder
   ```
3. Enable **Cloud Sync** if importing from cloud providers
4. Click **"Save"**

### Assigning Hosts to Groups

- When creating/editing a host, select the group from the dropdown
- Hosts appear under their group in the sidebar

### Cloud-Enabled Groups

For groups with Cloud Sync enabled:

1. Configure the cloud provider credentials
2. Click the **sync button** on the group
3. Instances are automatically imported as hosts

---

## Connecting to Servers

### Quick Connect

1. Find the host in the list
2. Click the **terminal icon** or the host card
3. A new terminal tab opens with the SSH connection

### Multi-Terminal

1. Navigate to **Multi Terminal** in the sidebar
2. Select multiple hosts
3. Commands are broadcast to all selected terminals

### Connection Status

- **Green dot**: Connected
- **Yellow dot**: Connecting
- **Red dot**: Connection failed
- **Gray dot**: Disconnected

---

## Using the Terminal

### Terminal Interface

The terminal provides a full xterm.js-based SSH experience:

- Full color support (256 colors)
- Mouse support
- Copy/paste functionality
- Scrollback buffer

### Terminal Tabs

- Each connection opens in a new tab
- Click tabs to switch between sessions
- Close tabs with the X button

### Quick Actions Panel

While connected, a side panel provides quick access to:
- System metrics
- User management
- Service control
- Package management
- And more...

Toggle the panel with the **Quick Actions** button.

### Zen Mode

Press **F11** or click the zen mode button for a distraction-free terminal experience.

### Terminal Settings

Access terminal settings to customize:
- Font family and size
- Color theme
- Cursor style
- Scrollback lines

---

## File Management with SFTP

### Opening SFTP Manager

1. Navigate to **SFTP Manager** in the sidebar
2. Select a host to connect

### Interface Layout

```
┌─────────────────┬─────────────────┐
│   Local Files   │  Remote Files   │
│                 │                 │
│  /home/user/    │  /var/www/      │
│  ├── Documents  │  ├── html       │
│  ├── Downloads  │  ├── logs       │
│  └── Projects   │  └── config     │
└─────────────────┴─────────────────┘
```

### File Operations

**Upload Files:**
1. Navigate to source on local side
2. Navigate to destination on remote side
3. Select files and click **Upload** or drag and drop

**Download Files:**
1. Navigate to source on remote side
2. Navigate to destination on local side
3. Select files and click **Download** or drag and drop

**Create Directory:**
- Click the **New Folder** button
- Enter the directory name

**Delete Files/Directories:**
- Select items
- Click **Delete** or press Delete key
- Confirm the deletion

**Rename:**
- Right-click → Rename
- Enter new name

### Multi-Host Transfers

1. Open multiple remote tabs
2. Transfer files between two remote servers
3. Uses streaming for efficiency

---

## Cloud Sync

### Setting Up Cloud Sync

1. Create or edit a group
2. Enable **Cloud Sync**
3. Select the **Cloud Provider**
4. Enter provider credentials

### AWS EC2 Setup

```
Provider:          AWS
Region:            us-east-1
Access Key ID:     AKIAIOSFODNN7EXAMPLE
Secret Access Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
IP Address Type:   Public IP (or Private IP)
```

### Google Cloud Setup

```
Provider:    GCP
Project ID:  my-project-123
Credentials: (paste service account JSON)
```

### Syncing Hosts

**Manual Sync:**
1. Go to the group in the Hosts page
2. Click the **Sync** button (cloud icon)
3. Instances are imported as hosts

**Global Cloud Sync:**
1. Click **"+ New"** → **"Cloud Sync"**
2. View all cloud-enabled groups
3. Click **"Sync All"** to sync all groups

---

## Port Forwarding

### Creating a Port Forward

1. Navigate to **Port Forwarding**
2. Click **"New Forward"**
3. Configure the tunnel:

**Local Forward Example** (access remote MySQL locally):
```
Name:         MySQL Tunnel
Type:         Local
Host:         db-server
Local Port:   3306
Remote Host:  localhost
Remote Port:  3306
```

**Remote Forward Example** (expose local service to remote):
```
Name:         Web Preview
Type:         Remote
Host:         jump-server
Local Port:   3000
Remote Host:  localhost
Remote Port:  8080
```

**Dynamic Forward** (SOCKS proxy):
```
Name:         SOCKS Proxy
Type:         Dynamic
Host:         proxy-server
Local Port:   1080
```

### Managing Tunnels

- **Start**: Click the play button
- **Stop**: Click the stop button
- **Status**: Green = active, Gray = stopped

### Using Tunnels

After starting a local forward:
```bash
# Connect to remote MySQL through tunnel
mysql -h 127.0.0.1 -P 3306 -u user -p
```

After starting a SOCKS proxy:
```bash
# Configure browser or application to use SOCKS5 proxy
# Host: 127.0.0.1, Port: 1080
```

---

## Using Quick Actions

Quick Actions are available in the terminal sidebar when connected to a server.

### System Metrics

Click **Metrics** to view:
- CPU usage and load average
- Memory usage
- Disk space per mount
- Network information
- Uptime

### Managing Users

1. Click **Users** tab
2. View existing users
3. **Create User**: Enter username, password, groups
4. **Delete User**: Click delete icon
5. **Modify Groups**: Click groups icon

### Managing Services

1. Click **Services** tab
2. View all systemd services
3. **Start/Stop/Restart**: Use action buttons
4. **View Logs**: Click logs icon

### Managing Packages

1. Click **Packages** tab
2. Auto-detects package manager (apt/yum/dnf/pacman)
3. **Update**: Refresh package list
4. **Upgrade**: Upgrade all packages
5. **Install**: Select packages to install

### Managing Containers

1. Click **Containers** tab
2. Auto-detects Docker or Podman
3. View running containers
4. Start/Stop/Restart containers
5. View container logs

### Firewall Management

1. Click **Firewall** tab
2. View current rules
3. Add new rules (allow/deny port/ip)
4. Enable/disable firewall

---

## Keychain Management

### Adding a Credential

1. Navigate to **Keychain**
2. Click **"+ Add"**
3. Enter credential details:
   ```
   Label:    Production Admin
   Username: admin
   Password: ********
   ```
4. Click **"Save"**

### Using Keychain in Hosts

When creating/editing a host:
1. Set Auth Method to **Keychain**
2. Select the keychain entry from dropdown
3. The credential is automatically used for connection

### Managing Credentials

- **Edit**: Update username or password
- **Delete**: Remove the credential
- **Copy**: Copy password to clipboard (temporarily)

---

## Snippets

### Creating a Snippet

1. Navigate to **Snippets**
2. Click **"+ Add"**
3. Enter snippet details:
   ```
   Name:     Check Disk Space
   Category: System
   Command:  df -h
   ```
4. Click **"Save"**

### Using Snippets

In the terminal:
1. Open the Snippets panel
2. Click on a snippet
3. The command is inserted into the terminal

### Snippet Variables

Use placeholders for dynamic values:
```
Command: tail -f /var/log/${LOG_FILE}
```
You'll be prompted to enter the value when using.

---

## Import and Export

### Importing Hosts

1. Click **"+ New"** → **"Import Hosts"**
2. Choose import format:

**SSH Config:**
- Select your `~/.ssh/config` file
- Parses Host, HostName, Port, User, IdentityFile

**JSON:**
- Select a binsh export file
- Imports hosts and groups

**CSV:**
- Select a CSV with headers
- Required columns: address
- Optional: label, port, username, auth_method

3. Preview and select hosts to import
4. Click **"Import"**

### Exporting Hosts

1. Click **"+ New"** → **"Export Hosts"**
2. Choose format (JSON or CSV)
3. Configure options:
   - Include groups
   - Include passwords (not recommended)
4. Click **"Export"**
5. File downloads automatically

---

## Security and Vault

### Vault Setup

The vault encrypts all sensitive data:
- Host passwords
- SSH private keys
- Keychain entries
- Cloud credentials

### Setting Up Vault

1. On first use, click **"Set Up Vault"**
2. Create a strong master password
3. The vault is now ready

### Unlocking Vault

1. Enter your master password
2. Click **"Unlock"**
3. Vault remains unlocked during session

### Vault Auto-Lock

The vault automatically locks after inactivity (configurable in Settings).

### Best Practices

- Use a strong, unique master password
- Don't export passwords unless necessary
- Regularly backup your data directory
- Use SSH keys instead of passwords when possible

---

## Troubleshooting

### Connection Issues

**"Connection refused"**
- Verify the host address and port
- Check if SSH is running on the server
- Check firewall rules

**"Permission denied"**
- Verify username and password
- Check SSH key path and permissions
- Ensure key is authorized on server

**"Host key verification failed"**
- The server's host key has changed
- Go to Known Hosts and remove the old entry
- Reconnect to accept the new key

### SSH Key Issues

**"Failed to read private key"**
- Verify the key path is correct
- Use full path (e.g., `/home/user/.ssh/id_rsa`)
- Check file permissions (should be 600)

**Key with passphrase:**
- Currently, passphrase-protected keys need the passphrase entered
- Consider using ssh-agent or unprotected keys

### SFTP Issues

**"SFTP subsystem not available"**
- Ensure SFTP is enabled on the server
- Check `/etc/ssh/sshd_config` for `Subsystem sftp`

**Slow transfers:**
- Check network bandwidth
- Use compression if available
- For large files, use streaming transfer

### Vault Issues

**Forgot master password:**
- Unfortunately, the vault cannot be recovered
- Delete the vault file and set up again
- You will lose all stored credentials

**Vault won't unlock:**
- Ensure you're using the correct password
- Check for caps lock
- Try restarting the application

### Performance Issues

**Slow startup:**
- Check the number of hosts
- Consider using groups to organize
- Check system resources

**Terminal lag:**
- Check network latency to server
- Reduce scrollback buffer in settings
- Try a different terminal theme

---

## Keyboard Shortcuts

### Global

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open search |
| `Ctrl+N` | New host |
| `Ctrl+G` | New group |

### Terminal

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+C` | Copy |
| `Ctrl+Shift+V` | Paste |
| `Ctrl+Shift+T` | New tab |
| `Ctrl+Shift+W` | Close tab |
| `F11` | Zen mode |

### SFTP

| Shortcut | Action |
|----------|--------|
| `Delete` | Delete selected |
| `F2` | Rename |
| `Ctrl+N` | New folder |

---

*For more information, see the [Features Reference](./FEATURES.md) or [Architecture Documentation](./ARCHITECTURE.md).*
