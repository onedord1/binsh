# binsh API Reference

Complete REST API documentation for binsh backend.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Hosts API](#hosts-api)
4. [Groups API](#groups-api)
5. [Keychain API](#keychain-api)
6. [Snippets API](#snippets-api)
7. [Port Forwarding API](#port-forwarding-api)
8. [Known Hosts API](#known-hosts-api)
9. [SFTP API](#sftp-api)
10. [Local Filesystem API](#local-filesystem-api)
11. [Quick Actions API](#quick-actions-api)
12. [Settings API](#settings-api)
13. [Vault API](#vault-api)
14. [WebSocket API](#websocket-api)

---

## Overview

### Base URL

```
http://localhost:8080/api
```

### Content Type

All requests and responses use JSON:

```
Content-Type: application/json
```

### Authentication

Most endpoints require a Bearer token:

```
Authorization: Bearer <jwt_token>
```

### Response Format

**Success Response:**
```json
{
  "data": { ... },
  "message": "Success"
}
```

**Error Response:**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Authentication

### Register User

Create a new user account.

```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Login

Authenticate and receive JWT token.

```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com"
  }
}
```

### Verify Token

Check if current token is valid.

```http
GET /api/auth/verify
Authorization: Bearer <token>
```

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com"
  }
}
```

---

## Hosts API

### List Hosts

Get all configured hosts.

```http
GET /api/hosts
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "label": "Web Server",
    "address": "192.168.1.100",
    "port": 22,
    "username": "admin",
    "auth_method": "key",
    "ssh_key_path": "~/.ssh/id_rsa",
    "group_id": "660e8400-e29b-41d4-a716-446655440001",
    "tags": ["production", "web"],
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-15T00:00:00Z"
  }
]
```

### Get Host

Get a single host by ID.

```http
GET /api/hosts/{id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "label": "Web Server",
  "address": "192.168.1.100",
  "port": 22,
  "username": "admin",
  "auth_method": "key",
  "ssh_key_path": "~/.ssh/id_rsa",
  "group_id": "660e8400-e29b-41d4-a716-446655440001",
  "tags": ["production", "web"]
}
```

### Create Host

Add a new host.

```http
POST /api/hosts
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "label": "New Server",
  "address": "192.168.1.101",
  "port": 22,
  "username": "root",
  "auth_method": "password",
  "password": "secretpassword",
  "group_id": "660e8400-e29b-41d4-a716-446655440001",
  "tags": ["staging"]
}
```

**Auth Method Options:**
- `password` - Use password authentication
- `key` - Use SSH key (provide `ssh_key` or `ssh_key_path`)
- `keychain` - Use keychain entry (provide `keychain_id`)

**Response:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "label": "New Server",
  "address": "192.168.1.101",
  "port": 22,
  "username": "root",
  "auth_method": "password",
  "group_id": "660e8400-e29b-41d4-a716-446655440001",
  "tags": ["staging"],
  "created_at": "2026-01-27T00:00:00Z"
}
```

### Update Host

Modify an existing host.

```http
PUT /api/hosts/{id}
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "label": "Updated Server Name",
  "port": 2222,
  "tags": ["staging", "updated"]
}
```

**Response:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "label": "Updated Server Name",
  "address": "192.168.1.101",
  "port": 2222,
  "username": "root",
  "auth_method": "password",
  "tags": ["staging", "updated"],
  "updated_at": "2026-01-27T01:00:00Z"
}
```

### Delete Host

Remove a host.

```http
DELETE /api/hosts/{id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Host deleted successfully"
}
```

---

## Groups API

### List Groups

Get all groups.

```http
GET /api/groups
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "label": "Production",
    "color": "#10B981",
    "icon": "folder",
    "cloud_sync": true,
    "cloud_provider": "aws",
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

### Create Group

Add a new group.

```http
POST /api/groups
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "label": "Development",
  "color": "#3B82F6",
  "icon": "code",
  "cloud_sync": false
}
```

**With Cloud Sync:**
```json
{
  "label": "AWS Production",
  "color": "#F59E0B",
  "icon": "cloud",
  "cloud_sync": true,
  "cloud_provider": "aws",
  "cloud_config": {
    "region": "us-east-1",
    "access_key_id": "AKIAIOSFODNN7EXAMPLE",
    "secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "ip_address_type": "public"
  }
}
```

**Response:**
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "label": "Development",
  "color": "#3B82F6",
  "icon": "code",
  "cloud_sync": false,
  "created_at": "2026-01-27T00:00:00Z"
}
```

### Update Group

Modify an existing group.

```http
PUT /api/groups/{id}
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "label": "Updated Group Name",
  "color": "#EF4444"
}
```

### Delete Group

Remove a group (hosts are not deleted).

```http
DELETE /api/groups/{id}
Authorization: Bearer <token>
```

### Sync Cloud Hosts

Sync hosts from cloud provider.

```http
POST /api/groups/{id}/cloud/sync
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Successfully synced 5 hosts from AWS",
  "synced": 5,
  "hosts": [
    {
      "id": "new-host-id",
      "label": "i-0123456789abcdef0",
      "address": "54.123.45.67"
    }
  ]
}
```

### Get Cloud Instances

List cloud instances without syncing.

```http
GET /api/groups/{id}/cloud/instances
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "i-0123456789abcdef0",
    "name": "web-server-1",
    "public_ip": "54.123.45.67",
    "private_ip": "10.0.1.100",
    "state": "running",
    "tags": {
      "Name": "web-server-1",
      "Environment": "production"
    }
  }
]
```

---

## Keychain API

### List Keychain Entries

```http
GET /api/keychain
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "label": "Admin Credentials",
    "username": "admin",
    "has_password": true,
    "has_ssh_key": false,
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

### Create Keychain Entry

```http
POST /api/keychain
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "label": "Production Admin",
  "username": "admin",
  "password": "secretpassword",
  "ssh_key": "-----BEGIN OPENSSH PRIVATE KEY-----\n..."
}
```

### Delete Keychain Entry

```http
DELETE /api/keychain/{id}
Authorization: Bearer <token>
```

---

## Snippets API

### List Snippets

```http
GET /api/snippets
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "name": "Check Disk Space",
    "category": "system",
    "command": "df -h",
    "description": "Show disk usage",
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

### Create Snippet

```http
POST /api/snippets
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Restart Nginx",
  "category": "web",
  "command": "sudo systemctl restart nginx",
  "description": "Restart the Nginx web server"
}
```

### Delete Snippet

```http
DELETE /api/snippets/{id}
Authorization: Bearer <token>
```

---

## Port Forwarding API

### List Port Forwards

```http
GET /api/portforwards
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440006",
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
```

### Create Port Forward

```http
POST /api/portforwards
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Redis Tunnel",
  "type": "local",
  "host_id": "550e8400-e29b-41d4-a716-446655440000",
  "local_port": 6379,
  "remote_host": "localhost",
  "remote_port": 6379,
  "auto_start": true
}
```

**Type Options:**
- `local` - Local port forwarding
- `remote` - Remote port forwarding
- `dynamic` - Dynamic SOCKS proxy

### Update Port Forward

```http
PUT /api/portforwards/{id}
Authorization: Bearer <token>
```

### Delete Port Forward

```http
DELETE /api/portforwards/{id}
Authorization: Bearer <token>
```

### Start Port Forward

```http
POST /api/portforwards/{id}/start
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Port forward started",
  "status": "running"
}
```

### Stop Port Forward

```http
POST /api/portforwards/{id}/stop
Authorization: Bearer <token>
```

### Get Port Forward Status

```http
GET /api/portforwards/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "bb0e8400-e29b-41d4-a716-446655440006": {
    "status": "running",
    "started_at": "2026-01-27T00:00:00Z"
  }
}
```

---

## Known Hosts API

### List Known Hosts

```http
GET /api/known-hosts
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "host": "192.168.1.100",
    "key_type": "ssh-ed25519",
    "fingerprint": "SHA256:AbCdEfGhIjKlMnOpQrStUvWxYz1234567890",
    "added_at": "2026-01-01T00:00:00Z"
  }
]
```

### Remove Known Host

```http
DELETE /api/known-hosts/{host}
Authorization: Bearer <token>
```

---

## SFTP API

### List Directory

```http
GET /api/sftp/{hostId}/list?path=/home/user
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "name": "documents",
    "path": "/home/user/documents",
    "is_dir": true,
    "size": 4096,
    "mod_time": "2026-01-15T00:00:00Z",
    "permissions": "drwxr-xr-x"
  },
  {
    "name": "file.txt",
    "path": "/home/user/file.txt",
    "is_dir": false,
    "size": 1024,
    "mod_time": "2026-01-20T00:00:00Z",
    "permissions": "-rw-r--r--"
  }
]
```

### Create Directory

```http
POST /api/sftp/{hostId}/mkdir
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "path": "/home/user/new_directory"
}
```

### Delete File/Directory

```http
DELETE /api/sftp/{hostId}/delete?path=/home/user/file.txt
Authorization: Bearer <token>
```

### Rename File/Directory

```http
POST /api/sftp/{hostId}/rename
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "old_path": "/home/user/old_name.txt",
  "new_path": "/home/user/new_name.txt"
}
```

### Download File

```http
GET /api/sftp/{hostId}/download?path=/home/user/file.txt
Authorization: Bearer <token>
```

**Response:** File binary data with appropriate headers.

### Upload File

```http
POST /api/sftp/{hostId}/upload?path=/home/user/uploads
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file` - File to upload

### Transfer Between Servers

```http
POST /api/sftp/transfer
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "source_host_id": "host-1",
  "source_path": "/home/user/file.txt",
  "dest_host_id": "host-2",
  "dest_path": "/home/user/file.txt"
}
```

---

## Local Filesystem API

### List Local Directory

```http
GET /api/local/list?path=/home/user
Authorization: Bearer <token>
```

### Create Local Directory

```http
POST /api/local/mkdir
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "path": "/home/user/new_folder"
}
```

### Delete Local File/Directory

```http
DELETE /api/local/delete?path=/home/user/file.txt
Authorization: Bearer <token>
```

### Upload to Local

```http
POST /api/local/upload?path=/home/user/uploads
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

---

## Quick Actions API

### Execute Command

Run a command on a remote host.

```http
POST /api/actions/execute
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "host_id": "550e8400-e29b-41d4-a716-446655440000",
  "command": "uptime"
}
```

**Response:**
```json
{
  "output": " 10:30:00 up 30 days, 5:00, 2 users, load average: 0.15, 0.10, 0.05",
  "exit_code": 0
}
```

### Execute Multi-Host Command

Run command on multiple hosts.

```http
POST /api/actions/execute-multi
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "host_ids": ["host-1", "host-2", "host-3"],
  "command": "hostname"
}
```

### System Metrics

```http
POST /api/actions/metrics
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "host_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "cpu": {
    "usage": 15.5,
    "cores": 4,
    "load_1m": 0.15,
    "load_5m": 0.10,
    "load_15m": 0.05
  },
  "memory": {
    "total": 8589934592,
    "used": 4294967296,
    "free": 4294967296,
    "percent": 50.0
  },
  "disk": [
    {
      "mount": "/",
      "total": 107374182400,
      "used": 53687091200,
      "free": 53687091200,
      "percent": 50.0
    }
  ],
  "uptime": "30 days, 5:00",
  "hostname": "web-server-1"
}
```

### List Services

```http
POST /api/actions/services
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "host_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Control Service

```http
POST /api/actions/services/control
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "host_id": "550e8400-e29b-41d4-a716-446655440000",
  "service": "nginx",
  "action": "restart"
}
```

**Action Options:** `start`, `stop`, `restart`, `enable`, `disable`

### List Users

```http
POST /api/actions/users
Authorization: Bearer <token>
```

### Create User

```http
POST /api/actions/users/create
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "host_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "newuser",
  "password": "password123",
  "groups": "sudo,docker"
}
```

### List Containers

```http
POST /api/actions/containers/list
Authorization: Bearer <token>
```

### Container Action

```http
POST /api/actions/containers/action
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "host_id": "550e8400-e29b-41d4-a716-446655440000",
  "container_id": "abc123",
  "action": "restart"
}
```

### Firewall Status

```http
POST /api/actions/firewall/status
Authorization: Bearer <token>
```

### Add Firewall Rule

```http
POST /api/actions/firewall/add
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "host_id": "550e8400-e29b-41d4-a716-446655440000",
  "rule": "allow 80/tcp"
}
```

---

## Settings API

### Get Settings

```http
GET /api/settings
```

**Response:**
```json
{
  "theme": "dark",
  "terminal": {
    "fontFamily": "JetBrains Mono",
    "fontSize": 14,
    "theme": "dracula"
  }
}
```

### Save Settings

```http
PUT /api/settings
```

**Request Body:**
```json
{
  "theme": "light",
  "terminal": {
    "fontSize": 16
  }
}
```

---

## Vault API

### Get Vault Status

```http
GET /api/vault/status
```

**Response:**
```json
{
  "configured": true,
  "locked": false
}
```

### Setup Vault

```http
POST /api/vault/setup
```

**Request Body:**
```json
{
  "master_password": "your-secure-master-password"
}
```

### Unlock Vault

```http
POST /api/vault/unlock
```

**Request Body:**
```json
{
  "master_password": "your-secure-master-password"
}
```

### Lock Vault

```http
POST /api/vault/lock
```

---

## WebSocket API

### SSH Terminal

Connect to remote host terminal.

```
ws://localhost:8080/ws/ssh/{hostId}
```

**Message Format:**
- Client → Server: Raw terminal input bytes
- Server → Client: Raw terminal output bytes

**Resize Event (JSON):**
```json
{
  "type": "resize",
  "cols": 120,
  "rows": 40
}
```

### Local Shell

Connect to local shell.

```
ws://localhost:8080/ws/shell
```

**Message Format:** Same as SSH terminal.

---

## Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication token required |
| `AUTH_INVALID` | Invalid or expired token |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid request data |
| `CONNECTION_FAILED` | SSH connection failed |
| `VAULT_LOCKED` | Vault is locked |
| `PERMISSION_DENIED` | Insufficient permissions |

---

*For architecture details, see [Architecture](./ARCHITECTURE.md).*
