# binsh Installation Guide

Complete installation and setup instructions for binsh.

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Quick Start](#quick-start)
3. [Installation Methods](#installation-methods)
4. [Building from Source](#building-from-source)
5. [Configuration](#configuration)
6. [First Run](#first-run)
7. [Updating](#updating)
8. [Uninstallation](#uninstallation)

---

## System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| **OS** | Linux, macOS, or Windows 10+ |
| **RAM** | 512 MB |
| **Disk** | 100 MB |
| **Network** | Internet for SSH connections |

### Supported Platforms

| Platform | Architecture | Status |
|----------|--------------|--------|
| Linux | x64 | ✅ Supported |
| Linux | ARM64 | ✅ Supported |
| macOS | x64 | ✅ Supported |
| macOS | ARM64 (M1/M2) | ✅ Supported |
| Windows | x64 | ✅ Supported |

### Dependencies

**Runtime:**
- No external dependencies for binary releases

**Development:**
- Node.js 18+ (frontend)
- Go 1.21+ (backend)
- npm or yarn (package manager)

---

## Quick Start

### Linux/macOS

```bash
# Clone the repository
git clone https://github.com/your-org/binsh.git
cd binsh

# Build and run
./scripts/build.sh
./scripts/run.sh
```

### Windows

```powershell
# Clone the repository
git clone https://github.com/your-org/binsh.git
cd binsh

# Build and run
.\scripts\build.ps1
.\scripts\run.ps1
```

---

## Installation Methods

### Method 1: Pre-built Binaries (Recommended)

Download the latest release for your platform:

**Linux (x64):**
```bash
wget https://github.com/your-org/binsh/releases/latest/download/binsh-linux-amd64.tar.gz
tar -xzf binsh-linux-amd64.tar.gz
sudo mv binsh /usr/local/bin/
```

**Linux (ARM64):**
```bash
wget https://github.com/your-org/binsh/releases/latest/download/binsh-linux-arm64.tar.gz
tar -xzf binsh-linux-arm64.tar.gz
sudo mv binsh /usr/local/bin/
```

**macOS:**
```bash
wget https://github.com/your-org/binsh/releases/latest/download/binsh-darwin-amd64.tar.gz
tar -xzf binsh-darwin-amd64.tar.gz
sudo mv binsh /usr/local/bin/
```

**macOS (Apple Silicon):**
```bash
wget https://github.com/your-org/binsh/releases/latest/download/binsh-darwin-arm64.tar.gz
tar -xzf binsh-darwin-arm64.tar.gz
sudo mv binsh /usr/local/bin/
```

**Windows:**
1. Download `binsh-windows-amd64.zip`
2. Extract to desired location
3. Add to PATH (optional)

### Method 2: Package Managers

**Homebrew (macOS/Linux):**
```bash
brew tap your-org/binsh
brew install binsh
```

**APT (Debian/Ubuntu):**
```bash
curl -fsSL https://your-org.github.io/binsh/gpg | sudo gpg --dearmor -o /usr/share/keyrings/binsh.gpg
echo "deb [signed-by=/usr/share/keyrings/binsh.gpg] https://your-org.github.io/binsh stable main" | sudo tee /etc/apt/sources.list.d/binsh.list
sudo apt update
sudo apt install binsh
```

**Snap (Linux):**
```bash
sudo snap install binsh
```

### Method 3: Docker

```bash
docker pull your-org/binsh:latest
docker run -p 8080:8080 -v ~/.config/binsh:/data your-org/binsh
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  binsh:
    image: your-org/binsh:latest
    ports:
      - "8080:8080"
    volumes:
      - binsh-data:/data
    restart: unless-stopped

volumes:
  binsh-data:
```

---

## Building from Source

### Prerequisites

Install required tools:

**Go (Backend):**
```bash
# Linux
wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# macOS
brew install go

# Verify
go version
```

**Node.js (Frontend):**
```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Verify
node --version
npm --version
```

### Clone Repository

```bash
git clone https://github.com/your-org/binsh.git
cd binsh
```

### Build Backend

```bash
cd backend

# Download dependencies
go mod download

# Build binary
go build -o binsh ./cmd/systask

# Or with optimizations
CGO_ENABLED=0 go build -ldflags="-s -w" -o binsh ./cmd/systask
```

### Build Frontend

```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# Or for development
npm run dev
```

### Run Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
go run ./cmd/systask
# Server starts on http://localhost:8080
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Opens http://localhost:5173
```

### Build Complete Application

```bash
# Build frontend
cd frontend
npm run build

# Copy to backend
cp -r dist ../backend/static

# Build backend with embedded frontend
cd ../backend
go build -o binsh ./cmd/systask

# Run
./binsh
# Access at http://localhost:8080
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BINSH_PORT` | Server port | 8080 |
| `BINSH_HOST` | Server host | 0.0.0.0 |
| `BINSH_DATA_DIR` | Data directory | ~/.config/binsh |
| `BINSH_LOG_LEVEL` | Log level (debug/info/warn/error) | info |
| `BINSH_JWT_SECRET` | JWT signing secret | (auto-generated) |

**Example:**
```bash
export BINSH_PORT=9090
export BINSH_DATA_DIR=/opt/binsh/data
./binsh
```

### Configuration File

Create `~/.config/binsh/config.yaml`:

```yaml
server:
  port: 8080
  host: "0.0.0.0"

security:
  vault_timeout: 30  # minutes
  jwt_expiry: 24     # hours

logging:
  level: info
  file: ~/.config/binsh/logs/app.log

terminal:
  default_shell: /bin/bash
```

### Data Directory Structure

After first run, the following structure is created:

```
~/.config/binsh/
├── data/
│   ├── hosts.json
│   ├── groups.json
│   ├── keychain.json
│   ├── snippets.json
│   ├── portforwards.json
│   └── users.json
├── vault/
│   ├── vault.key
│   └── vault.salt
├── ssh/
│   └── known_hosts
├── logs/
│   └── app.log
└── settings.json
```

---

## First Run

### Step 1: Start the Application

```bash
binsh
```

Or with specific port:
```bash
binsh --port 9090
```

### Step 2: Open Web Interface

Open your browser to:
```
http://localhost:8080
```

### Step 3: Create Account

1. Click **Register**
2. Enter email and password
3. Click **Create Account**

### Step 4: Set Up Vault

1. You'll be prompted to set up the vault
2. Enter a strong master password
3. **Important:** Remember this password!

### Step 5: Unlock Vault

1. Enter your master password
2. Click **Unlock**
3. You're ready to use binsh!

### Step 6: Add Your First Host

1. Click **+ New** → **New Host**
2. Enter host details:
   - Label: My Server
   - Address: 192.168.1.100
   - Port: 22
   - Username: admin
3. Choose authentication method
4. Click **Save**

### Step 7: Connect

1. Click on the host
2. Terminal opens with SSH connection
3. Start working!

---

## Updating

### Binary Update

```bash
# Download new version
wget https://github.com/your-org/binsh/releases/latest/download/binsh-linux-amd64.tar.gz

# Stop running instance
pkill binsh

# Replace binary
tar -xzf binsh-linux-amd64.tar.gz
sudo mv binsh /usr/local/bin/

# Restart
binsh
```

### Package Manager Update

**Homebrew:**
```bash
brew upgrade binsh
```

**APT:**
```bash
sudo apt update
sudo apt upgrade binsh
```

### Docker Update

```bash
docker pull your-org/binsh:latest
docker-compose down
docker-compose up -d
```

### From Source Update

```bash
cd binsh
git pull origin main

# Rebuild
cd backend
go build -o binsh ./cmd/systask

cd ../frontend
npm install
npm run build
```

### Data Migration

Data files are automatically migrated between versions. No manual action required.

**Backup before major updates:**
```bash
tar -czvf binsh-backup-$(date +%Y%m%d).tar.gz ~/.config/binsh/
```

---

## Uninstallation

### Remove Application

**Binary:**
```bash
sudo rm /usr/local/bin/binsh
```

**Homebrew:**
```bash
brew uninstall binsh
```

**APT:**
```bash
sudo apt remove binsh
```

**Docker:**
```bash
docker-compose down
docker rmi your-org/binsh
```

### Remove Data (Optional)

**Warning:** This deletes all hosts, credentials, and settings!

```bash
# Linux/macOS
rm -rf ~/.config/binsh

# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:APPDATA\binsh"
```

### Keep Data for Later

If you plan to reinstall:

```bash
# Backup data
tar -czvf binsh-backup.tar.gz ~/.config/binsh/

# Remove application only
sudo rm /usr/local/bin/binsh

# Later, restore data
tar -xzvf binsh-backup.tar.gz -C ~/
```

---

## Troubleshooting Installation

### Port Already in Use

```bash
# Check what's using port 8080
lsof -i :8080

# Use different port
binsh --port 9090
```

### Permission Denied

```bash
# Fix binary permissions
chmod +x /usr/local/bin/binsh

# Fix data directory
chmod 700 ~/.config/binsh
```

### Can't Connect to localhost

1. Check if server is running:
   ```bash
   ps aux | grep binsh
   ```

2. Check server logs:
   ```bash
   cat ~/.config/binsh/logs/app.log
   ```

3. Try explicit host:
   ```bash
   binsh --host 127.0.0.1
   ```

### Build Errors

**Go modules error:**
```bash
cd backend
go mod tidy
go mod download
```

**Node modules error:**
```bash
cd frontend
rm -rf node_modules
npm install
```

### macOS Security Warning

If macOS blocks the binary:
1. Go to System Preferences → Security & Privacy
2. Click "Allow Anyway"
3. Or run: `xattr -d com.apple.quarantine /usr/local/bin/binsh`

---

## Running as a Service

### Systemd (Linux)

Create `/etc/systemd/system/binsh.service`:

```ini
[Unit]
Description=binsh SSH Client
After=network.target

[Service]
Type=simple
User=your-username
ExecStart=/usr/local/bin/binsh
Restart=on-failure
RestartSec=5
Environment=BINSH_DATA_DIR=/home/your-username/.config/binsh

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable binsh
sudo systemctl start binsh
```

### launchd (macOS)

Create `~/Library/LaunchAgents/com.binsh.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.binsh</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/binsh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

Load the service:
```bash
launchctl load ~/Library/LaunchAgents/com.binsh.plist
```

---

*For usage instructions, see [User Guide](./USER_GUIDE.md).*
*For feature details, see [Features](./FEATURES.md).*
