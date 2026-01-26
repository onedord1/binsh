# binsh

<p align="center">
  <strong>Modern SSH Client & Server Management Platform</strong>
</p>

<p align="center">
  A powerful, feature-rich SSH client designed for DevOps engineers, system administrators, and developers who manage multiple servers.
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🖥️ **Multi-Server Management** | Organize hosts with groups, tags, and search |
| 🔐 **Secure Vault** | AES-256 encrypted credential storage |
| 📁 **SFTP File Manager** | Dual-pane file transfer with drag & drop |
| ☁️ **Cloud Integration** | Auto-sync from AWS, GCP, Azure, DigitalOcean, Linode |
| 🛠️ **Quick Actions** | One-click server management tasks |
| 📊 **System Metrics** | Real-time CPU, memory, disk monitoring |
| 🔄 **Port Forwarding** | Local, remote, and dynamic SSH tunnels |
| 📝 **Snippets** | Command library for quick execution |
| 🎨 **Terminal Themes** | 15+ color themes with customizable fonts |

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/binsh.git
cd binsh

# Start backend
cd backend
go run ./cmd/systask

# Start frontend (in another terminal)
cd frontend
npm install
npm run dev

# Open http://localhost:5173
```

## 📚 Documentation

Complete documentation is available in the [`docs/`](./docs) folder:

| Document | Description |
|----------|-------------|
| 📖 [Features](./docs/FEATURES.md) | Complete feature reference |
| 📥 [Installation](./docs/INSTALLATION.md) | Setup and installation guide |
| 📘 [User Guide](./docs/USER_GUIDE.md) | Detailed usage instructions |
| 🏗️ [Architecture](./docs/ARCHITECTURE.md) | System design and structure |
| 💾 [Data Storage](./docs/DATA_STORAGE.md) | Where data is stored locally |
| 🔌 [API Reference](./docs/API_REFERENCE.md) | REST API documentation |
| 🔒 [Security](./docs/SECURITY.md) | Security features and best practices |

## 🛠️ Tech Stack

**Frontend:**
- React 18 + TypeScript
- TailwindCSS
- Zustand (state management)
- TanStack Query (server state)
- xterm.js (terminal)
- Framer Motion (animations)

**Backend:**
- Go 1.21+
- Gorilla Mux (routing)
- golang.org/x/crypto/ssh (SSH client)
- pkg/sftp (SFTP client)

## 📁 Project Structure

```
binsh/
├── frontend/          # React frontend application
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Page components
│   │   ├── stores/       # State management
│   │   ├── lib/          # Utilities & API
│   │   └── types/        # TypeScript types
│   └── package.json
│
├── backend/           # Go backend application
│   ├── cmd/systask/      # Main entry point
│   ├── internal/
│   │   ├── storage/      # Data persistence
│   │   ├── ssh/          # SSH client
│   │   ├── sftp/         # SFTP client
│   │   ├── cloud/        # Cloud providers
│   │   └── vault/        # Encryption
│   └── go.mod
│
└── docs/              # Documentation
```

## 💾 Data Storage

All data is stored locally:

| Platform | Location |
|----------|----------|
| Linux | `~/.config/binsh/` |
| macOS | `~/Library/Application Support/binsh/` |
| Windows | `%APPDATA%\binsh\` |

See [Data Storage](./docs/DATA_STORAGE.md) for details.

## 🔒 Security

- **Vault Encryption**: AES-256-GCM with PBKDF2 key derivation
- **Password Hashing**: bcrypt with cost factor 12
- **API Auth**: JWT tokens with HMAC-SHA256
- **SSH**: OpenSSH compatible with host key verification

See [Security](./docs/SECURITY.md) for complete details.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT License - see LICENSE file for details.

---

<p align="center">
  <strong>binsh</strong> - Modern SSH for Modern Infrastructure
</p>
