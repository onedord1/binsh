package storage

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Store handles JSON file persistence
type Store struct {
	dataDir string
	mu      sync.RWMutex
}

// NewStore creates a new storage instance
func NewStore(dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	return &Store{dataDir: dataDir}, nil
}

// Host represents a server connection configuration
type Host struct {
	ID              string   `json:"id"`
	UserID          string   `json:"user_id"`
	Label           string   `json:"label"`
	Address         string   `json:"address"`
	Port            int      `json:"port"`
	Username        string   `json:"username"`
	AuthMethod      string   `json:"auth_method"`
	Password        string   `json:"password,omitempty"`
	SSHKeyPath      string   `json:"ssh_key_path,omitempty"`
	SSHKey          string   `json:"ssh_key,omitempty"`
	Passphrase      string   `json:"passphrase,omitempty"`
	GroupID         string   `json:"group_id,omitempty"`
	CloudInstanceID string   `json:"cloud_instance_id,omitempty"`
	Tags            []string `json:"tags,omitempty"`
	StartupCommand  string   `json:"startup_command,omitempty"`
	ProxyID         string   `json:"proxy_id,omitempty"`
	Backspace       string   `json:"backspace,omitempty"`
	AgentForwarding bool     `json:"agent_forwarding"`
	HostChecking    bool     `json:"host_checking"`
	UTF8            bool     `json:"utf8"`
	Mosh            bool     `json:"mosh"`
	Theme           string   `json:"theme,omitempty"`
	EnvVars         string   `json:"env_vars,omitempty"`
	CreatedAt       int64    `json:"created_at"`
	LastConnected   int64    `json:"last_connected,omitempty"`
}

// Group represents a collection of hosts
type Group struct {
	ID            string      `json:"id"`
	UserID        string      `json:"user_id"`
	Label         string      `json:"label"`
	ParentID      string      `json:"parent_id,omitempty"`
	Icon          string      `json:"icon,omitempty"`
	Color         string      `json:"color,omitempty"`
	CloudSync     bool        `json:"cloud_sync"`
	CloudProvider string      `json:"cloud_provider,omitempty"`
	CloudConfig   CloudConfig `json:"cloud_config,omitempty"`
	CreatedAt     int64       `json:"created_at"`
}

// CloudConfig stores cloud provider credentials
type CloudConfig struct {
	Region          string `json:"region,omitempty"`
	AccessKeyID     string `json:"access_key_id,omitempty"`
	SecretAccessKey string `json:"secret_access_key,omitempty"`
	Service         string `json:"service,omitempty"`
	IPAddressType   string `json:"ip_address_type,omitempty"`
	// GCP specific
	ProjectID          string `json:"project_id,omitempty"`
	ServiceAccountJSON string `json:"service_account_json,omitempty"`
	// Azure specific
	SubscriptionID string `json:"subscription_id,omitempty"`
	TenantID       string `json:"tenant_id,omitempty"`
	ClientID       string `json:"client_id,omitempty"`
	ClientSecret   string `json:"client_secret,omitempty"`
	ResourceGroup  string `json:"resource_group,omitempty"`
	// Oracle Cloud specific
	TenancyOCID     string `json:"tenancy_ocid,omitempty"`
	UserOCID        string `json:"user_ocid,omitempty"`
	Fingerprint     string `json:"fingerprint,omitempty"`
	PrivateKey      string `json:"private_key,omitempty"`
	CompartmentOCID string `json:"compartment_ocid,omitempty"`
	// Alibaba Cloud specific
	// Uses AccessKeyID and SecretAccessKey
	// Akamai/Linode specific
	APIToken string `json:"api_token,omitempty"`
}

// Keychain represents stored credentials
type Keychain struct {
	ID         string `json:"id"`
	UserID     string `json:"user_id"`
	Label      string `json:"label"`
	Type       string `json:"type"`
	Username   string `json:"username,omitempty"`
	Password   string `json:"password,omitempty"`
	PrivateKey string `json:"private_key,omitempty"`
	Passphrase string `json:"passphrase,omitempty"`
	CreatedAt  int64  `json:"created_at"`
}

// Snippet represents a saved command snippet
type Snippet struct {
	ID          string   `json:"id"`
	UserID      string   `json:"user_id"`
	Label       string   `json:"label"`
	Content     string   `json:"content"`
	Description string   `json:"description,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	CreatedAt   int64    `json:"created_at"`
}

// KnownHost represents an SSH known host
type KnownHost struct {
	ID          string `json:"id"`
	UserID      string `json:"user_id"`
	Host        string `json:"host"`
	KeyType     string `json:"key_type"`
	PublicKey   string `json:"public_key"`
	Fingerprint string `json:"fingerprint"`
	AddedAt     int64  `json:"added_at"`
}

// PortForward represents a port forwarding configuration
type PortForward struct {
	ID         string `json:"id"`
	Label      string `json:"label"`
	HostID     string `json:"host_id"`
	Type       string `json:"type"` // local, remote, dynamic
	LocalPort  int    `json:"local_port"`
	RemoteHost string `json:"remote_host,omitempty"`
	RemotePort int    `json:"remote_port,omitempty"`
	BindAddr   string `json:"bind_addr,omitempty"`
	AutoStart  bool   `json:"auto_start"`
	CreatedAt  int64  `json:"created_at"`
}

// Settings represents app settings
type Settings struct {
	Theme             string `json:"theme"`
	DefaultPort       int    `json:"default_port"`
	DefaultUsername   string `json:"default_username"`
	TerminalFont      string `json:"terminal_font"`
	TerminalFontSize  int    `json:"terminal_font_size"`
	TerminalTheme     string `json:"terminal_theme"`
	ScrollbackLines   int    `json:"scrollback_lines"`
	CopyOnSelect      bool   `json:"copy_on_select"`
	PasteOnRightClick bool   `json:"paste_on_right_click"`
}

// GenerateID creates a unique ID
func GenerateID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// ========================================
// Host Operations
// ========================================

func (s *Store) GetHosts(userID string) ([]Host, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var hosts []Host
	data, err := os.ReadFile(filepath.Join(s.dataDir, "hosts.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return hosts, nil
		}
		return nil, err
	}
	if err := json.Unmarshal(data, &hosts); err != nil {
		return nil, err
	}

	log.Printf("[DEBUG] GetHosts called for UserID: '%s'. Total hosts in file: %d", userID, len(hosts))

	// Strict Filter by user ID
	var userHosts []Host
	for _, h := range hosts {
		// Log detailed check for debugging
		match := h.UserID == userID
		// log.Printf("[DEBUG] Checking host %s (UserID: '%s') -> Match: %v", h.ID, h.UserID, match)

		if match {
			userHosts = append(userHosts, h)
		}
	}
	log.Printf("[DEBUG] Returning %d hosts for user '%s'", len(userHosts), userID)
	return userHosts, nil
}

func (s *Store) GetHost(id, userID string) (*Host, error) {
	hosts, err := s.GetHosts(userID)
	if err != nil {
		return nil, err
	}
	for _, h := range hosts {
		if h.ID == id {
			return &h, nil
		}
	}
	return nil, nil
}

func (s *Store) CreateHost(host *Host, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	host.ID = GenerateID()
	host.UserID = userID
	host.CreatedAt = time.Now().UnixMilli()

	hosts, _ := s.getHostsUnsafe()
	hosts = append(hosts, *host)
	return s.saveHostsUnsafe(hosts)
}

func (s *Store) UpdateHost(host *Host, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	hosts, err := s.getHostsUnsafe()
	if err != nil {
		return err
	}

	for i, h := range hosts {
		if h.ID == host.ID && h.UserID == userID {
			// Preserve UserID even if not sent in update
			host.UserID = userID
			hosts[i] = *host
			return s.saveHostsUnsafe(hosts)
		}
	}
	return nil
}

func (s *Store) DeleteHost(id, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	hosts, err := s.getHostsUnsafe()
	if err != nil {
		return err
	}

	for i, h := range hosts {
		if h.ID == id && h.UserID == userID {
			hosts = append(hosts[:i], hosts[i+1:]...)
			return s.saveHostsUnsafe(hosts)
		}
	}
	return nil
}

func (s *Store) UpdateHostLastConnected(id, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	hosts, err := s.getHostsUnsafe()
	if err != nil {
		return err
	}

	for i, h := range hosts {
		if h.ID == id && h.UserID == userID {
			hosts[i].LastConnected = time.Now().UnixMilli()
			return s.saveHostsUnsafe(hosts)
		}
	}
	return nil
}

func (s *Store) getHostsUnsafe() ([]Host, error) {
	var hosts []Host
	data, err := os.ReadFile(filepath.Join(s.dataDir, "hosts.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return hosts, nil
		}
		return nil, err
	}
	json.Unmarshal(data, &hosts)
	return hosts, nil
}

func (s *Store) saveHostsUnsafe(hosts []Host) error {
	data, err := json.MarshalIndent(hosts, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.dataDir, "hosts.json"), data, 0644)
}

// ========================================
// Group Operations
// ========================================

func (s *Store) GetGroups(userID string) ([]Group, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var groups []Group
	data, err := os.ReadFile(filepath.Join(s.dataDir, "groups.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return groups, nil
		}
		return nil, err
	}
	if err := json.Unmarshal(data, &groups); err != nil {
		return nil, err
	}

	// Strict Filter by user ID
	var userGroups []Group
	for _, g := range groups {
		if g.UserID == userID {
			userGroups = append(userGroups, g)
		}
	}
	return userGroups, nil
}

func (s *Store) CreateGroup(group *Group, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	group.ID = GenerateID()
	group.UserID = userID
	group.CreatedAt = time.Now().UnixMilli()

	groups, _ := s.getGroupsUnsafe()
	groups = append(groups, *group)
	return s.saveGroupsUnsafe(groups)
}

func (s *Store) UpdateGroup(group *Group, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	groups, err := s.getGroupsUnsafe()
	if err != nil {
		return err
	}

	for i, g := range groups {
		if g.ID == group.ID && g.UserID == userID {
			group.UserID = userID
			groups[i] = *group
			return s.saveGroupsUnsafe(groups)
		}
	}
	return nil
}

func (s *Store) DeleteGroup(id, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	groups, err := s.getGroupsUnsafe()
	if err != nil {
		return err
	}

	for i, g := range groups {
		if g.ID == id && g.UserID == userID {
			groups = append(groups[:i], groups[i+1:]...)
			return s.saveGroupsUnsafe(groups)
		}
	}
	return nil
}

func (s *Store) getGroupsUnsafe() ([]Group, error) {
	var groups []Group
	data, err := os.ReadFile(filepath.Join(s.dataDir, "groups.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return groups, nil
		}
		return nil, err
	}
	json.Unmarshal(data, &groups)
	return groups, nil
}

func (s *Store) saveGroupsUnsafe(groups []Group) error {
	data, err := json.MarshalIndent(groups, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.dataDir, "groups.json"), data, 0644)
}

// ========================================
// Keychain Operations
// ========================================

func (s *Store) GetKeychains(userID string) ([]Keychain, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var items []Keychain
	data, err := os.ReadFile(filepath.Join(s.dataDir, "keychain.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return items, nil
		}
		return nil, err
	}
	json.Unmarshal(data, &items)

	// Strict Filter by user ID
	var userItems []Keychain
	for _, k := range items {
		if k.UserID == userID {
			userItems = append(userItems, k)
		}
	}
	return userItems, nil
}

func (s *Store) CreateKeychain(item *Keychain, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	item.ID = GenerateID()
	item.UserID = userID
	item.CreatedAt = time.Now().UnixMilli()

	items, _ := s.getKeychainsUnsafe()
	items = append(items, *item)
	return s.saveKeychainsUnsafe(items)
}

func (s *Store) DeleteKeychain(id, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	items, err := s.getKeychainsUnsafe()
	if err != nil {
		return err
	}

	for i, k := range items {
		if k.ID == id && k.UserID == userID {
			items = append(items[:i], items[i+1:]...)
			return s.saveKeychainsUnsafe(items)
		}
	}
	return nil
}

func (s *Store) getKeychainsUnsafe() ([]Keychain, error) {
	var items []Keychain
	data, err := os.ReadFile(filepath.Join(s.dataDir, "keychain.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return items, nil
		}
		return nil, err
	}
	json.Unmarshal(data, &items)
	return items, nil
}

func (s *Store) saveKeychainsUnsafe(items []Keychain) error {
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.dataDir, "keychain.json"), data, 0644)
}

// ========================================
// Snippets Operations
// ========================================

func (s *Store) GetSnippets(userID string) ([]Snippet, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var items []Snippet
	data, err := os.ReadFile(filepath.Join(s.dataDir, "snippets.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return items, nil
		}
		return nil, err
	}
	json.Unmarshal(data, &items)

	// Strict Filter by user ID
	var userItems []Snippet
	for _, k := range items {
		if k.UserID == userID {
			userItems = append(userItems, k)
		}
	}
	return userItems, nil
}

func (s *Store) CreateSnippet(item *Snippet, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	item.ID = GenerateID()
	item.UserID = userID
	item.CreatedAt = time.Now().UnixMilli()

	items, _ := s.getSnippetsUnsafe()
	items = append(items, *item)
	return s.saveSnippetsUnsafe(items)
}

func (s *Store) DeleteSnippet(id, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	items, err := s.getSnippetsUnsafe()
	if err != nil {
		return err
	}

	for i, k := range items {
		if k.ID == id && k.UserID == userID {
			items = append(items[:i], items[i+1:]...)
			return s.saveSnippetsUnsafe(items)
		}
	}
	return nil

}

func (s *Store) getSnippetsUnsafe() ([]Snippet, error) {
	var items []Snippet
	data, err := os.ReadFile(filepath.Join(s.dataDir, "snippets.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return items, nil
		}
		return nil, err
	}
	json.Unmarshal(data, &items)
	return items, nil
}

func (s *Store) saveSnippetsUnsafe(items []Snippet) error {
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.dataDir, "snippets.json"), data, 0644)
}

// ========================================
// Settings Operations
// ========================================

func (s *Store) GetSettings() Settings {
	s.mu.RLock()
	defer s.mu.RUnlock()

	settings := Settings{
		Theme:             "dark",
		DefaultPort:       22,
		DefaultUsername:   "root",
		TerminalFont:      "JetBrains Mono",
		TerminalFontSize:  14,
		TerminalTheme:     "termius-dark",
		ScrollbackLines:   10000,
		CopyOnSelect:      true,
		PasteOnRightClick: true,
	}

	data, err := os.ReadFile(filepath.Join(s.dataDir, "settings.json"))
	if err != nil {
		return settings
	}
	json.Unmarshal(data, &settings)
	return settings
}

func (s *Store) SaveSettings(settings Settings) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.dataDir, "settings.json"), data, 0644)
}

// ========================================
// Port Forward Operations
// ========================================

func (s *Store) GetPortForwards(userID string) ([]PortForward, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var items []PortForward
	data, err := os.ReadFile(filepath.Join(s.dataDir, "portforwards.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return items, nil
		}
		return nil, err
	}
	json.Unmarshal(data, &items)
	return items, nil
}

func (s *Store) GetPortForward(id string) (*PortForward, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	items, err := s.getPortForwardsUnsafe()
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		if item.ID == id {
			return &item, nil
		}
	}
	return nil, errors.New("port forward not found")
}

func (s *Store) CreatePortForward(item *PortForward) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	item.ID = GenerateID()
	item.CreatedAt = time.Now().UnixMilli()

	items, _ := s.getPortForwardsUnsafe()
	items = append(items, *item)
	return s.savePortForwardsUnsafe(items)
}

func (s *Store) UpdatePortForward(item *PortForward) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	items, err := s.getPortForwardsUnsafe()
	if err != nil {
		return err
	}

	for i, existing := range items {
		if existing.ID == item.ID {
			items[i] = *item
			return s.savePortForwardsUnsafe(items)
		}
	}
	return errors.New("port forward not found")
}

func (s *Store) DeletePortForward(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	items, err := s.getPortForwardsUnsafe()
	if err != nil {
		return err
	}

	for i, item := range items {
		if item.ID == id {
			items = append(items[:i], items[i+1:]...)
			return s.savePortForwardsUnsafe(items)
		}
	}
	return nil
}

func (s *Store) getPortForwardsUnsafe() ([]PortForward, error) {
	var items []PortForward
	data, err := os.ReadFile(filepath.Join(s.dataDir, "portforwards.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return items, nil
		}
		return nil, err
	}
	json.Unmarshal(data, &items)
	return items, nil
}

func (s *Store) savePortForwardsUnsafe(items []PortForward) error {
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.dataDir, "portforwards.json"), data, 0644)
}
