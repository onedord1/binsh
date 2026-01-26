# binsh Security

Security features, best practices, and implementation details.

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Vault Encryption](#vault-encryption)
3. [Authentication](#authentication)
4. [SSH Security](#ssh-security)
5. [Data Protection](#data-protection)
6. [Network Security](#network-security)
7. [Best Practices](#best-practices)
8. [Security Checklist](#security-checklist)

---

## Security Overview

binsh is designed with security as a core principle. All sensitive data is encrypted at rest, and secure protocols are used for all communications.

### Security Features

| Feature | Implementation |
|---------|----------------|
| Credential Encryption | AES-256-GCM |
| Password Hashing | bcrypt (cost 12) |
| Key Derivation | PBKDF2-SHA256 (100k iterations) |
| API Authentication | JWT with HMAC-SHA256 |
| SSH Protocol | OpenSSH compatible |
| Host Verification | Known hosts fingerprinting |

### What's Protected

- ✅ Host passwords
- ✅ SSH private keys
- ✅ Keychain entries
- ✅ Cloud provider credentials
- ✅ User account passwords
- ✅ Session tokens

### What's NOT Encrypted

- ⚠️ Host addresses and labels (for search functionality)
- ⚠️ Group names and settings
- ⚠️ Snippet commands
- ⚠️ Application settings

---

## Vault Encryption

The vault is the core security component that protects all sensitive credentials.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    VAULT ENCRYPTION FLOW                     │
└─────────────────────────────────────────────────────────────┘

                    Master Password
                          │
                          ▼
              ┌───────────────────────┐
              │   Salt (32 bytes)     │ ← Randomly generated
              │   stored separately   │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │      PBKDF2-SHA256    │
              │   100,000 iterations  │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   256-bit AES Key     │
              └───────────┬───────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│   Encrypt Data      │       │   Decrypt Data      │
│   (AES-256-GCM)     │       │   (AES-256-GCM)     │
└─────────────────────┘       └─────────────────────┘
```

### Encryption Algorithm

**AES-256-GCM (Galois/Counter Mode)**

- 256-bit key size
- 96-bit nonce (IV)
- 128-bit authentication tag
- Provides both confidentiality and integrity

### Key Derivation

**PBKDF2 Parameters:**

| Parameter | Value |
|-----------|-------|
| Algorithm | SHA-256 |
| Iterations | 100,000 |
| Salt Length | 32 bytes |
| Output Key | 256 bits |

### Encrypted Data Format

```
┌──────────────────────────────────────────────────────────┐
│ ENCRYPTED: │ Base64( Nonce ║ Ciphertext ║ Auth Tag )    │
└──────────────────────────────────────────────────────────┘
              │         │           │            │
              │   12 bytes    Variable      16 bytes
              │
        Prefix for identification
```

### Vault States

| State | Description |
|-------|-------------|
| **Not Configured** | No master password set |
| **Locked** | Configured but encryption key not in memory |
| **Unlocked** | Key in memory, operations allowed |

### Vault Security Measures

1. **Key never stored on disk** - Only derived when unlocked
2. **Memory protection** - Key cleared on lock
3. **Auto-lock timeout** - Configurable inactivity timeout
4. **Salt per installation** - Unique salt prevents rainbow attacks

---

## Authentication

### User Authentication

**Password Storage:**
```go
// bcrypt with cost factor 12
hash, _ := bcrypt.GenerateFromPassword(password, 12)
```

**Verification:**
```go
err := bcrypt.CompareHashAndPassword(hash, password)
```

### JWT Tokens

**Token Structure:**
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "user_id": "uuid",
    "email": "user@example.com",
    "iat": 1735286400,
    "exp": 1735372800
  },
  "signature": "HMAC-SHA256(header.payload, secret)"
}
```

**Token Properties:**

| Property | Value |
|----------|-------|
| Algorithm | HMAC-SHA256 |
| Expiration | 24 hours |
| Refresh | On activity |
| Storage | localStorage (frontend) |

### Session Security

- Tokens expire after 24 hours
- Invalid tokens rejected immediately
- No server-side session storage (stateless)

---

## SSH Security

### Authentication Methods

**1. Password Authentication**
- Password encrypted in vault
- Sent over encrypted SSH channel
- Not stored in memory after connection

**2. SSH Key Authentication**
- Private key encrypted in vault
- Key parsed only during connection
- Supports RSA, ECDSA, Ed25519

**3. Keychain Reference**
- Credentials stored in keychain
- Referenced by ID in host config
- Single source of truth

### Host Key Verification

binsh maintains a known hosts database similar to OpenSSH:

```
~/.config/binsh/ssh/known_hosts
```

**Verification Flow:**

```
1. Connect to host
        │
        ▼
2. Receive host public key
        │
        ▼
3. Check known_hosts database
        │
   ┌────┴────┐
   │         │
   ▼         ▼
Known?     Unknown?
   │         │
   ▼         ▼
Match?    Prompt user
   │         │
   │    ┌────┴────┐
   │    │         │
   │    ▼         ▼
   │  Accept    Reject
   │    │         │
   │    ▼         │
   │  Add to     │
   │  known_hosts│
   │    │         │
   ▼    ▼         ▼
Continue      Abort
```

### SSH Protocol Security

- TLS 1.3 for WebSocket transport
- SSH protocol encryption (AES-256, ChaCha20)
- Perfect forward secrecy with DHE/ECDHE
- Host key fingerprint verification

---

## Data Protection

### At-Rest Encryption

All sensitive data encrypted before writing to disk:

| Data Type | Encryption |
|-----------|------------|
| Passwords | AES-256-GCM |
| SSH Keys | AES-256-GCM |
| Cloud Credentials | AES-256-GCM |
| User Passwords | bcrypt hash |

### File Permissions

Recommended permissions for data files:

```bash
# Data directory
chmod 700 ~/.config/binsh

# Sensitive files
chmod 600 ~/.config/binsh/data/*
chmod 600 ~/.config/binsh/vault/*
chmod 600 ~/.config/binsh/auth.json
```

### Memory Security

- Credentials cleared from memory after use
- No credential logging
- Secure string handling

### Backup Security

When backing up binsh data:

1. **Full backup** includes encrypted vault
2. **Vault password required** to restore
3. **Without password**, encrypted data is unrecoverable

---

## Network Security

### API Communication

| Protocol | Usage |
|----------|-------|
| HTTPS | All API requests (recommended) |
| WSS | WebSocket terminal connections |
| SSH | Server connections |

### CORS Configuration

API restricts cross-origin requests:

```go
allowedOrigins := []string{
    "http://localhost:5173",
    "http://localhost:3000",
}
```

### Request Validation

- All inputs sanitized
- SQL injection prevention (no SQL database)
- Path traversal prevention in SFTP
- Command injection prevention

### Rate Limiting

Currently not implemented. Recommended for production:

- Login attempts: 5 per minute
- API requests: 100 per minute
- SSH connections: 10 per minute

---

## Best Practices

### Password Guidelines

**Master Password:**
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- Unique to binsh (not reused)
- Store in password manager

**Host Passwords:**
- Use SSH keys when possible
- Rotate regularly
- Use unique passwords per host

### SSH Key Guidelines

**Key Generation:**
```bash
# Ed25519 (recommended)
ssh-keygen -t ed25519 -C "binsh@$(hostname)"

# RSA (if Ed25519 not supported)
ssh-keygen -t rsa -b 4096 -C "binsh@$(hostname)"
```

**Key Protection:**
- Use passphrase-protected keys
- Store keys with 600 permissions
- Rotate keys periodically

### Cloud Credential Guidelines

**AWS:**
- Use IAM roles when possible
- Restrict permissions to EC2 read-only
- Rotate access keys regularly

**Example minimal IAM policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeRegions"
      ],
      "Resource": "*"
    }
  ]
}
```

### Operational Security

1. **Lock vault when away** - Use auto-lock feature
2. **Don't export passwords** - Use export without passwords option
3. **Verify host keys** - Don't blindly accept unknown keys
4. **Review known hosts** - Remove outdated entries
5. **Use groups wisely** - Separate production from development

---

## Security Checklist

### Initial Setup

- [ ] Set strong master password
- [ ] Enable vault auto-lock
- [ ] Set appropriate timeout
- [ ] Verify file permissions

### Regular Maintenance

- [ ] Rotate SSH keys periodically
- [ ] Review and remove unused hosts
- [ ] Check known hosts for outdated entries
- [ ] Update cloud credentials
- [ ] Backup encrypted data

### Before Sharing/Migration

- [ ] Export without passwords
- [ ] Remove sensitive hosts if needed
- [ ] Clear logs if they contain sensitive info
- [ ] Verify backup encryption

### Incident Response

If you suspect compromise:

1. **Lock the vault immediately**
2. **Change master password**
3. **Rotate all SSH keys**
4. **Change all host passwords**
5. **Revoke cloud credentials**
6. **Review known hosts**
7. **Check access logs on servers**

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public issue
2. Contact maintainers privately
3. Provide detailed description
4. Allow time for fix before disclosure

---

## Cryptographic Details

### Libraries Used

| Purpose | Library |
|---------|---------|
| AES-256-GCM | Go crypto/aes, crypto/cipher |
| PBKDF2 | Go crypto/pbkdf2 |
| bcrypt | golang.org/x/crypto/bcrypt |
| SSH | golang.org/x/crypto/ssh |
| HMAC-SHA256 | Go crypto/hmac |

### Random Number Generation

All cryptographic randomness from:
```go
crypto/rand
```

Never uses `math/rand` for security purposes.

---

*For data storage locations, see [Data Storage](./DATA_STORAGE.md).*
*For architecture details, see [Architecture](./ARCHITECTURE.md).*
