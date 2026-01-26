# binsh Architecture

Technical architecture and design documentation for binsh.

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Data Flow](#data-flow)
6. [Security Architecture](#security-architecture)
7. [Communication Protocols](#communication-protocols)
8. [Database Schema](#database-schema)
9. [Cloud Provider Integration](#cloud-provider-integration)

---

## Overview

binsh is a modern SSH client built with a decoupled frontend-backend architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│                    (React + TypeScript)                      │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Hosts   │  │ Terminal │  │   SFTP   │  │ Settings │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
│                      (Go + Gorilla)                          │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   API    │  │    SSH   │  │   SFTP   │  │  Vault   │    │
│  │  Router  │  │  Client  │  │  Client  │  │ Crypto   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Storage                            │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  JSON    │  │  Vault   │  │  Known   │  │ Settings │    │
│  │  Store   │  │ (Crypto) │  │  Hosts   │  │   File   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## System Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 | UI framework |
| **Styling** | TailwindCSS | Utility-first CSS |
| **State** | Zustand | State management |
| **Data Fetching** | TanStack Query | Server state management |
| **Terminal** | xterm.js | Terminal emulator |
| **Animations** | Framer Motion | UI animations |
| **Backend** | Go 1.21+ | API server |
| **Routing** | Gorilla Mux | HTTP router |
| **SSH** | golang.org/x/crypto/ssh | SSH client |
| **SFTP** | github.com/pkg/sftp | SFTP client |
| **Storage** | JSON files | Persistent storage |
| **Encryption** | AES-256-GCM | Credential encryption |

### Directory Structure

```
binsh/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   │   ├── forms/       # Form components
│   │   │   ├── modals/      # Modal dialogs
│   │   │   └── terminal/    # Terminal components
│   │   ├── pages/           # Page components
│   │   ├── stores/          # Zustand stores
│   │   ├── lib/             # Utilities and API client
│   │   ├── types/           # TypeScript types
│   │   └── App.tsx          # Main app component
│   ├── public/              # Static assets
│   └── package.json         # Dependencies
│
├── backend/                  # Go backend application
│   ├── cmd/
│   │   └── systask/         # Main application entry
│   │       └── main.go      # API routes and handlers
│   ├── internal/
│   │   ├── storage/         # Data persistence
│   │   ├── ssh/             # SSH client wrapper
│   │   ├── sftp/            # SFTP client wrapper
│   │   ├── cloud/           # Cloud provider integrations
│   │   └── vault/           # Encryption/vault
│   └── go.mod               # Go modules
│
└── docs/                     # Documentation
```

---

## Frontend Architecture

### Component Hierarchy

```
App
├── Layout
│   ├── Sidebar
│   ├── Header
│   └── Outlet (Page Content)
│       ├── Hosts
│       ├── Terminal
│       ├── MultiTerminal
│       ├── SFTPManager
│       ├── Keychain
│       ├── PortForwarding
│       ├── Snippets
│       ├── Settings
│       └── ...
├── SidePanel (Host/Group forms)
├── ImportModal
├── ExportModal
└── CloudSyncModal
```

### State Management

**Zustand Stores:**

```typescript
// appStore - Global application state
{
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  sidePanel: { type, mode, data }
  searchQuery: string
  terminalZenMode: boolean
  activeTerminals: string[]
  importModalOpen: boolean
  exportModalOpen: boolean
  cloudSyncModalOpen: boolean
}

// authStore - Authentication state
{
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}
```

**TanStack Query:**

Used for server state management:
- Automatic caching
- Background refetching
- Optimistic updates
- Error handling

```typescript
// Example query
const { data: hosts } = useQuery({
  queryKey: ['hosts'],
  queryFn: hosts.list,
})

// Example mutation
const mutation = useMutation({
  mutationFn: hosts.create,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['hosts'] })
  },
})
```

### API Client

Located in `src/lib/api.ts`:

```typescript
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Interceptors for auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// API namespaces
export const hosts = {
  list: () => api.get('/hosts'),
  create: (data) => api.post('/hosts', data),
  update: (id, data) => api.put(`/hosts/${id}`, data),
  delete: (id) => api.delete(`/hosts/${id}`),
}
```

### Terminal Implementation

Uses xterm.js with addons:

```typescript
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'

// WebSocket connection to backend
const ws = new WebSocket(`ws://host/ws/ssh/${hostId}`)

// Terminal setup
const terminal = new Terminal({
  cursorBlink: true,
  fontFamily: 'monospace',
  fontSize: 14,
})

// Bidirectional data flow
terminal.onData((data) => ws.send(data))
ws.onmessage = (event) => terminal.write(event.data)
```

---

## Backend Architecture

### API Router

Using Gorilla Mux for routing:

```go
r := mux.NewRouter()
api := r.PathPrefix("/api").Subrouter()

// Middleware
api.Use(corsMiddleware)
protected.Use(authMiddleware)

// Route groups
api.HandleFunc("/auth/login", loginUser).Methods("POST")
protected.HandleFunc("/hosts", getHosts).Methods("GET")
protected.HandleFunc("/hosts", createHost).Methods("POST")
// ...
```

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  Login   │────▶│  Verify  │
│          │     │ Endpoint │     │ Password │
└──────────┘     └──────────┘     └──────────┘
                                        │
                                        ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Store   │◀────│  Return  │◀────│ Generate │
│  Token   │     │   JWT    │     │   JWT    │
└──────────┘     └──────────┘     └──────────┘
```

**JWT Token Structure:**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "exp": 1735000000
}
```

### SSH Connection Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ WebSocket│────▶│  Backend │────▶│  Remote  │
│  Client  │     │SSH Client│     │  Server  │
└──────────┘     └──────────┘     └──────────┘
      │                │                │
      │    stdin       │    stdin       │
      │───────────────▶│───────────────▶│
      │                │                │
      │    stdout      │    stdout      │
      │◀───────────────│◀───────────────│
```

**SSH Client Configuration:**

```go
type ConnectionConfig struct {
    Host           string
    Port           int
    Username       string
    Password       string
    PrivateKey     string
    PrivateKeyPath string
    AuthMethod     string
    Timeout        time.Duration
}
```

### SFTP Operations

```go
// SFTP Client wrapper
type Client struct {
    sshClient  *ssh.Client
    sftpClient *sftp.Client
}

// Operations
func (c *Client) List(path string) ([]FileInfo, error)
func (c *Client) Upload(local, remote string) error
func (c *Client) Download(remote, local string) error
func (c *Client) Mkdir(path string) error
func (c *Client) Delete(path string) error
func (c *Client) Rename(old, new string) error
```

### Quick Actions Implementation

Remote command execution via SSH:

```go
func executeCommand(host Host, command string) (string, error) {
    client, err := ssh.NewClient(host)
    if err != nil {
        return "", err
    }
    defer client.Close()
    
    session, err := client.NewSession()
    if err != nil {
        return "", err
    }
    defer session.Close()
    
    output, err := session.CombinedOutput(command)
    return string(output), err
}
```

---

## Data Flow

### Host Connection Flow

```
1. User clicks "Connect" on host
           │
           ▼
2. Frontend opens WebSocket to /ws/ssh/{hostId}
           │
           ▼
3. Backend fetches host config from storage
           │
           ▼
4. Backend decrypts credentials from vault
           │
           ▼
5. Backend establishes SSH connection
           │
           ▼
6. Backend creates PTY session
           │
           ▼
7. Bidirectional data streaming begins
           │
           ▼
8. User types → WebSocket → SSH → Remote Server
           │
           ▼
9. Remote output → SSH → WebSocket → Terminal display
```

### SFTP Transfer Flow

```
1. User selects files and destination
           │
           ▼
2. Frontend sends POST to /sftp/{hostId}/upload
           │
           ▼
3. Backend establishes SFTP session
           │
           ▼
4. Backend streams file data
           │
           ▼
5. Progress updates sent to frontend
           │
           ▼
6. Transfer complete, UI refreshes
```

---

## Security Architecture

### Vault Encryption

```
┌────────────────────────────────────────────┐
│              Master Password               │
└─────────────────────┬──────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────┐
│         PBKDF2 Key Derivation              │
│    (100,000 iterations, SHA-256)           │
└─────────────────────┬──────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────┐
│            AES-256-GCM Key                 │
└─────────────────────┬──────────────────────┘
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐
│ Encrypt Secrets │      │ Decrypt Secrets │
└─────────────────┘      └─────────────────┘
```

### Authentication Security

- **Password Hashing**: bcrypt with cost factor 12
- **JWT Tokens**: HMAC-SHA256 signed, 24h expiry
- **HTTPS**: All API communication encrypted
- **CORS**: Restricted to frontend origin

### SSH Key Handling

```
1. Key stored in vault (encrypted)
           │
           ▼
2. Key decrypted on connection
           │
           ▼
3. Key parsed to SSH signer
           │
           ▼
4. Key used for authentication
           │
           ▼
5. Key discarded from memory
```

---

## Communication Protocols

### REST API

Standard REST endpoints for CRUD operations:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/hosts | List all hosts |
| POST | /api/hosts | Create host |
| PUT | /api/hosts/{id} | Update host |
| DELETE | /api/hosts/{id} | Delete host |

### WebSocket

Used for real-time communication:

**SSH Terminal:**
```
ws://host/ws/ssh/{hostId}

Messages:
- Client → Server: Terminal input (raw bytes)
- Server → Client: Terminal output (raw bytes)
- Server → Client: Resize events (JSON)
```

**Local Shell:**
```
ws://host/ws/shell

Messages:
- Same as SSH terminal but for local shell
```

---

## Database Schema

### Hosts Collection

```json
{
  "id": "uuid",
  "label": "string",
  "address": "string",
  "port": 22,
  "username": "string",
  "password": "encrypted",
  "auth_method": "password|key|keychain",
  "ssh_key": "encrypted",
  "ssh_key_path": "string",
  "keychain_id": "uuid",
  "group_id": "uuid",
  "tags": ["string"],
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### Groups Collection

```json
{
  "id": "uuid",
  "label": "string",
  "color": "#hex",
  "icon": "string",
  "cloud_sync": true,
  "cloud_provider": "aws|gcp|azure|...",
  "cloud_config": {
    "region": "string",
    "access_key_id": "encrypted",
    "secret_access_key": "encrypted"
  },
  "created_at": "timestamp"
}
```

### Keychain Collection

```json
{
  "id": "uuid",
  "label": "string",
  "username": "string",
  "password": "encrypted",
  "ssh_key": "encrypted",
  "created_at": "timestamp"
}
```

### Port Forwards Collection

```json
{
  "id": "uuid",
  "name": "string",
  "type": "local|remote|dynamic",
  "host_id": "uuid",
  "local_port": 8080,
  "remote_host": "string",
  "remote_port": 80,
  "auto_start": false,
  "created_at": "timestamp"
}
```

---

## Cloud Provider Integration

### Provider Interface

```go
type CloudProvider interface {
    ListInstances(config CloudConfig) ([]Instance, error)
}

type Instance struct {
    ID        string
    Name      string
    PublicIP  string
    PrivateIP string
    State     string
    Tags      map[string]string
}
```

### AWS Integration

```go
type AWSProvider struct{}

func (p *AWSProvider) ListInstances(cfg CloudConfig) ([]Instance, error) {
    sess := session.Must(session.NewSession(&aws.Config{
        Region: aws.String(cfg.Region),
        Credentials: credentials.NewStaticCredentials(
            cfg.AccessKeyID,
            cfg.SecretAccessKey,
            "",
        ),
    }))
    
    svc := ec2.New(sess)
    result, err := svc.DescribeInstances(&ec2.DescribeInstancesInput{})
    // ... process results
}
```

### Provider Factory

```go
func GetProvider(providerType string) CloudProvider {
    switch providerType {
    case "aws":
        return &AWSProvider{}
    case "gcp":
        return &GCPProvider{}
    case "azure":
        return &AzureProvider{}
    case "digitalocean":
        return &DOProvider{}
    case "linode":
        return &LinodeProvider{}
    default:
        return nil
    }
}
```

---

## Performance Considerations

### Connection Pooling

SSH connections are not pooled - each session creates a new connection for security isolation.

### Caching

- Frontend uses TanStack Query with 5-minute stale time
- Backend caches cloud provider instance lists for 60 seconds

### Streaming

- Large file transfers use streaming to avoid memory issues
- Terminal output is streamed in real-time via WebSocket

### Lazy Loading

- Host lists are paginated in large deployments
- Terminal themes are loaded on demand

---

*For data storage locations, see [Data Storage](./DATA_STORAGE.md).*
*For API details, see [API Reference](./API_REFERENCE.md).*
