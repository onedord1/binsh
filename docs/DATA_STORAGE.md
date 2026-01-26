# binsh Data Storage

Complete reference for where binsh stores data on your local machine.

---

## Table of Contents

1. [Overview](#overview)
2. [Data Directory Location](#data-directory-location)
3. [File Structure](#file-structure)
4. [Configuration Files](#configuration-files)
5. [Database Files](#database-files)
6. [Vault & Encrypted Data](#vault--encrypted-data)
7. [Logs](#logs)
8. [Backup & Migration](#backup--migration)

---

## Overview

binsh stores all data locally on your machine. No data is sent to external servers (except when connecting to your own SSH servers or cloud providers).

**Data Categories:**

| Category | Encryption | Purpose |
|----------|------------|---------|
| Configuration | No | App settings, preferences |
| Hosts & Groups | Partial | Server configurations |
| Credentials | Yes (AES-256) | Passwords, SSH keys |
| Known Hosts | No | SSH host key fingerprints |
| Vault | Yes (AES-256) | Master encryption key |

---

## Data Directory Location

### Linux

```
~/.config/binsh/
```

Full path example:
```
/home/username/.config/binsh/
```

### macOS

```
~/Library/Application Support/binsh/
```

Full path example:
```
/Users/username/Library/Application Support/binsh/
```

### Windows

```
%APPDATA%\binsh\
```

Full path example:
```
C:\Users\username\AppData\Roaming\binsh\
```

### Environment Variable Override

You can set a custom data directory:

```bash
export BINSH_DATA_DIR=/custom/path/to/data
```

---

## File Structure

```
~/.config/binsh/
├── data/
│   ├── hosts.json           # Host configurations
│   ├── groups.json          # Group configurations
│   ├── keychain.json        # Keychain entries (encrypted)
│   ├── snippets.json        # Command snippets
│   ├── portforwards.json    # Port forwarding rules
│   └── users.json           # User accounts
│
├── vault/
│   ├── vault.key            # Encrypted vault key
│   └── vault.salt           # Salt for key derivation
│
├── ssh/
│   └── known_hosts          # SSH known hosts
│
├── settings.json            # Application settings
├── auth.json                # Authentication tokens
└── logs/
    └── app.log              # Application logs
```

---

## Configuration Files

### settings.json

Application-wide settings:

```json
{
  "theme": "dark",
  "terminal": {
    "fontFamily": "JetBrains Mono, monospace",
    "fontSize": 14,
    "theme": "dracula",
    "cursorStyle": "block",
    "scrollback": 10000
  },
  "security": {
    "vaultTimeout": 30,
    "confirmDelete": true
  },
  "connection": {
    "timeout": 30,
    "keepAliveInterval": 60,
    "retryAttempts": 3
  }
}
```

**Location:** `~/.config/binsh/settings.json`

### auth.json

Authentication state (JWT tokens):

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2026-01-28T00:00:00Z"
}
```

**Location:** `~/.config/binsh/auth.json`

**Security Note:** This file contains sensitive tokens. Permissions should be `600` (owner read/write only).

---

## Database Files

### hosts.json

All configured SSH hosts:

```json
{
  "hosts": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "label": "Production Web Server",
      "address": "192.168.1.100",
      "port": 22,
      "username": "admin",
      "auth_method": "key",
      "ssh_key_path": "~/.ssh/prod_key",
      "group_id": "660e8400-e29b-41d4-a716-446655440001",
      "tags": ["production", "web"],
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-15T00:00:00Z"
    }
  ]
}
```

**Location:** `~/.config/binsh/data/hosts.json`

**Encrypted Fields:**
- `password` (if auth_method is "password")
- `ssh_key` (if inline key is stored)

### groups.json

Host groups and cloud sync configuration:

```json
{
  "groups": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "label": "Production",
      "color": "#10B981",
      "icon": "folder",
      "cloud_sync": true,
      "cloud_provider": "aws",
      "cloud_config": {
        "region": "us-east-1",
        "access_key_id": "ENCRYPTED:...",
        "secret_access_key": "ENCRYPTED:...",
        "ip_address_type": "public"
      },
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

**Location:** `~/.config/binsh/data/groups.json`

**Encrypted Fields:**
- `cloud_config.access_key_id`
- `cloud_config.secret_access_key`
- All cloud provider credentials

### keychain.json

Stored credentials:

```json
{
  "entries": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "label": "Admin Credentials",
      "username": "admin",
      "password": "ENCRYPTED:...",
      "ssh_key": "ENCRYPTED:...",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

**Location:** `~/.config/binsh/data/keychain.json`

**Note:** All sensitive fields are encrypted with AES-256-GCM.

### snippets.json

Command snippets library:

```json
{
  "snippets": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "name": "Check Disk Space",
      "category": "system",
      "command": "df -h",
      "description": "Show disk usage in human-readable format",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

**Location:** `~/.config/binsh/data/snippets.json`

### portforwards.json

Port forwarding rules:

```json
{
  "forwards": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "name": "MySQL Tunnel",
      "type": "local",
      "host_id": "550e8400-e29b-41d4-a716-446655440000",
      "local_port": 3306,
      "remote_host": "localhost",
      "remote_port": 3306,
      "auto_start": false,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

**Location:** `~/.config/binsh/data/portforwards.json`

### users.json

Local user accounts:

```json
{
  "users": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440005",
      "email": "user@example.com",
      "password_hash": "$2a$12$...",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

**Location:** `~/.config/binsh/data/users.json`

**Note:** Passwords are hashed with bcrypt, not stored in plain text.

---

## Vault & Encrypted Data

### How Encryption Works

1. **Master Password** → User enters on vault unlock
2. **Key Derivation** → PBKDF2 with SHA-256, 100,000 iterations
3. **Encryption Key** → 256-bit AES key derived
4. **Data Encryption** → AES-256-GCM authenticated encryption

### vault.key

Encrypted vault key file:

```
BINSH_VAULT_V1
[encrypted key material]
[authentication tag]
```

**Location:** `~/.config/binsh/vault/vault.key`

**Important:** If this file is deleted or corrupted, all encrypted data is lost.

### vault.salt

Random salt for key derivation:

```
[32 bytes of random data, base64 encoded]
```

**Location:** `~/.config/binsh/vault/vault.salt`

### Encrypted Data Format

All encrypted fields use the format:

```
ENCRYPTED:[base64(nonce + ciphertext + tag)]
```

Example:
```
ENCRYPTED:MTIzNDU2Nzg5MGFiY2RlZg...
```

---

## Logs

### Application Logs

**Location:** `~/.config/binsh/logs/app.log`

**Log Format:**
```
2026-01-27 03:45:00 [INFO] Application started
2026-01-27 03:45:01 [INFO] Vault unlocked successfully
2026-01-27 03:45:05 [INFO] SSH connection established to 192.168.1.100
2026-01-27 03:50:00 [ERROR] Connection to 192.168.1.101 failed: timeout
```

**Log Levels:**
- `DEBUG` - Detailed debugging information
- `INFO` - General operational messages
- `WARN` - Warning conditions
- `ERROR` - Error conditions

### Log Rotation

Logs are automatically rotated:
- Maximum file size: 10 MB
- Maximum files kept: 5
- Oldest logs are deleted when limit reached

---

## Backup & Migration

### Creating a Backup

**Full Backup (Recommended):**

```bash
# Linux/macOS
tar -czvf binsh-backup-$(date +%Y%m%d).tar.gz ~/.config/binsh/

# Windows (PowerShell)
Compress-Archive -Path "$env:APPDATA\binsh" -DestinationPath "binsh-backup.zip"
```

**Data Only (Excluding vault):**

```bash
tar -czvf binsh-data-backup.tar.gz \
  ~/.config/binsh/data/ \
  ~/.config/binsh/settings.json
```

### Restoring from Backup

```bash
# Stop binsh if running

# Linux/macOS
tar -xzvf binsh-backup.tar.gz -C ~/

# Windows (PowerShell)
Expand-Archive -Path "binsh-backup.zip" -DestinationPath "$env:APPDATA"

# Restart binsh
```

### Migration Between Machines

1. **Export hosts** (using Export feature in app)
2. **Copy SSH keys** separately
3. **On new machine:** Import hosts using Import feature
4. **Re-enter passwords** (encrypted data won't transfer)

**Or for full migration:**

1. Create full backup on source machine
2. Copy backup file to destination machine
3. Restore backup
4. **Important:** Use same master password on destination

### Data Export Locations

| Export Type | Default Location |
|-------------|------------------|
| JSON Export | Downloads folder |
| CSV Export | Downloads folder |
| Backup Archive | User-specified |

---

## File Permissions

### Recommended Permissions (Linux/macOS)

```bash
# Set correct permissions
chmod 700 ~/.config/binsh
chmod 600 ~/.config/binsh/data/*
chmod 600 ~/.config/binsh/vault/*
chmod 600 ~/.config/binsh/auth.json
chmod 644 ~/.config/binsh/settings.json
```

### Permission Table

| File/Directory | Permission | Octal |
|----------------|------------|-------|
| Data directory | rwx------ | 700 |
| Database files | rw------- | 600 |
| Vault files | rw------- | 600 |
| Auth tokens | rw------- | 600 |
| Settings | rw-r--r-- | 644 |
| Logs | rw-r--r-- | 644 |

---

## Clearing Data

### Reset Application

To completely reset binsh:

```bash
# Linux/macOS
rm -rf ~/.config/binsh

# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:APPDATA\binsh"
```

**Warning:** This deletes all hosts, credentials, and settings permanently.

### Clear Specific Data

```bash
# Clear hosts only
rm ~/.config/binsh/data/hosts.json

# Clear keychain only
rm ~/.config/binsh/data/keychain.json

# Clear known hosts
rm ~/.config/binsh/ssh/known_hosts

# Clear logs
rm -rf ~/.config/binsh/logs/*
```

---

## Troubleshooting

### "Vault corrupted" Error

The vault key file may be corrupted:
1. Delete vault files: `rm ~/.config/binsh/vault/*`
2. Restart application
3. Set up vault again (previous encrypted data will be lost)

### "Permission denied" Errors

Fix file permissions:
```bash
chmod -R 700 ~/.config/binsh
```

### Data Not Persisting

Check if the data directory exists and is writable:
```bash
ls -la ~/.config/binsh
touch ~/.config/binsh/test && rm ~/.config/binsh/test
```

---

*For architecture details, see [Architecture](./ARCHITECTURE.md).*
*For security information, see [Security](./SECURITY.md).*
