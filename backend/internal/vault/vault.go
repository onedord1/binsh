package vault

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/chacha20poly1305"
)

const (
	// Argon2id parameters (OWASP recommended)
	argonTime    = 3
	argonMemory  = 64 * 1024 // 64 MB
	argonThreads = 4
	argonKeyLen  = 32 // 256-bit key for XChaCha20-Poly1305

	// Encryption prefix to identify encrypted values
	EncryptedPrefix = "encrypted:"
)

// VaultConfig stores the vault configuration
type VaultConfig struct {
	Salt             []byte `json:"salt"`              // Random salt for key derivation
	VerificationHash []byte `json:"verification_hash"` // Hash to verify correct password
	Initialized      bool   `json:"initialized"`
}

// Vault manages encryption/decryption of sensitive data
type Vault struct {
	mu         sync.RWMutex
	configPath string
	config     *VaultConfig
	key        []byte // Derived encryption key (only in memory when unlocked)
	unlocked   bool
}

// NewVault creates a new vault instance
func NewVault(dataDir string) (*Vault, error) {
	configPath := filepath.Join(dataDir, "vault.json")

	v := &Vault{
		configPath: configPath,
		unlocked:   false,
	}

	// Try to load existing config
	if err := v.loadConfig(); err != nil && !os.IsNotExist(err) {
		return nil, err
	}

	return v, nil
}

// loadConfig loads vault configuration from disk
func (v *Vault) loadConfig() error {
	data, err := os.ReadFile(v.configPath)
	if err != nil {
		return err
	}

	v.config = &VaultConfig{}
	return json.Unmarshal(data, v.config)
}

// saveConfig saves vault configuration to disk
func (v *Vault) saveConfig() error {
	data, err := json.MarshalIndent(v.config, "", "  ")
	if err != nil {
		return err
	}

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(v.configPath), 0700); err != nil {
		return err
	}

	return os.WriteFile(v.configPath, data, 0600)
}

// IsInitialized returns true if vault has been set up with a master password
func (v *Vault) IsInitialized() bool {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return v.config != nil && v.config.Initialized
}

// IsUnlocked returns true if vault is currently unlocked
func (v *Vault) IsUnlocked() bool {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return v.unlocked && v.key != nil
}

// Status returns the current vault status
func (v *Vault) Status() string {
	if !v.IsInitialized() {
		return "uninitialized"
	}
	if v.IsUnlocked() {
		return "unlocked"
	}
	return "locked"
}

// Setup initializes the vault with a master password
func (v *Vault) Setup(masterPassword string) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if v.config != nil && v.config.Initialized {
		return errors.New("vault already initialized")
	}

	// Generate random salt
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return err
	}

	// Derive key using Argon2id
	key := argon2.IDKey([]byte(masterPassword), salt, argonTime, argonMemory, argonThreads, argonKeyLen)

	// Create verification hash (encrypt a known value)
	verificationPlain := []byte("binsh-vault-verification")
	verificationHash, err := v.encryptWithKey(key, verificationPlain)
	if err != nil {
		return err
	}

	v.config = &VaultConfig{
		Salt:             salt,
		VerificationHash: verificationHash,
		Initialized:      true,
	}

	if err := v.saveConfig(); err != nil {
		return err
	}

	// Keep vault unlocked after setup
	v.key = key
	v.unlocked = true

	return nil
}

// Unlock unlocks the vault with the master password
func (v *Vault) Unlock(masterPassword string) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if v.config == nil || !v.config.Initialized {
		return errors.New("vault not initialized")
	}

	// Derive key using stored salt
	key := argon2.IDKey([]byte(masterPassword), v.config.Salt, argonTime, argonMemory, argonThreads, argonKeyLen)

	// Verify password by decrypting verification hash
	_, err := v.decryptWithKey(key, v.config.VerificationHash)
	if err != nil {
		return errors.New("incorrect master password")
	}

	v.key = key
	v.unlocked = true

	return nil
}

// Lock locks the vault, clearing the key from memory
func (v *Vault) Lock() {
	v.mu.Lock()
	defer v.mu.Unlock()

	// Clear key from memory
	if v.key != nil {
		for i := range v.key {
			v.key[i] = 0
		}
		v.key = nil
	}
	v.unlocked = false
}

// Encrypt encrypts a plaintext string
func (v *Vault) Encrypt(plaintext string) (string, error) {
	v.mu.RLock()
	defer v.mu.RUnlock()

	if !v.unlocked || v.key == nil {
		return "", errors.New("vault is locked")
	}

	encrypted, err := v.encryptWithKey(v.key, []byte(plaintext))
	if err != nil {
		return "", err
	}

	return EncryptedPrefix + base64.StdEncoding.EncodeToString(encrypted), nil
}

// Decrypt decrypts an encrypted string
func (v *Vault) Decrypt(encrypted string) (string, error) {
	v.mu.RLock()
	defer v.mu.RUnlock()

	if !v.unlocked || v.key == nil {
		return "", errors.New("vault is locked")
	}

	// Check for encrypted prefix
	if len(encrypted) < len(EncryptedPrefix) {
		return encrypted, nil // Not encrypted, return as-is
	}

	if encrypted[:len(EncryptedPrefix)] != EncryptedPrefix {
		return encrypted, nil // Not encrypted, return as-is
	}

	ciphertext, err := base64.StdEncoding.DecodeString(encrypted[len(EncryptedPrefix):])
	if err != nil {
		return "", err
	}

	plaintext, err := v.decryptWithKey(v.key, ciphertext)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// encryptWithKey performs XChaCha20-Poly1305 encryption
func (v *Vault) encryptWithKey(key, plaintext []byte) ([]byte, error) {
	aead, err := chacha20poly1305.NewX(key)
	if err != nil {
		return nil, err
	}

	// Generate random nonce
	nonce := make([]byte, aead.NonceSize()) // 24 bytes for XChaCha20
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}

	// Encrypt and prepend nonce
	ciphertext := aead.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

// decryptWithKey performs XChaCha20-Poly1305 decryption
func (v *Vault) decryptWithKey(key, ciphertext []byte) ([]byte, error) {
	aead, err := chacha20poly1305.NewX(key)
	if err != nil {
		return nil, err
	}

	nonceSize := aead.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}

	// Extract nonce and decrypt
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

// IsEncrypted checks if a string is encrypted
func IsEncrypted(s string) bool {
	return len(s) >= len(EncryptedPrefix) && s[:len(EncryptedPrefix)] == EncryptedPrefix
}
