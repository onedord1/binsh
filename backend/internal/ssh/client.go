package ssh

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"
	"golang.org/x/crypto/ssh/knownhosts"
)

// ConnectionConfig holds SSH connection parameters
type ConnectionConfig struct {
	ID              string   `json:"id"`
	Address         string   `json:"address"`
	Port            int      `json:"port"`
	Username        string   `json:"username"`
	AuthMethod      string   `json:"auth_method"` // password, key, agent
	Password        string   `json:"password,omitempty"`
	PrivateKeyPath  string   `json:"private_key_path,omitempty"`
	PrivateKey      string   `json:"private_key,omitempty"`
	Passphrase      string   `json:"passphrase,omitempty"`
	HostChecking    bool     `json:"host_checking"`
	AgentForwarding bool     `json:"agent_forwarding"`
	StartupCommand  string   `json:"startup_command,omitempty"`
	EnvVars         []string `json:"env_vars,omitempty"`
}

// Session represents an active SSH session
type Session struct {
	ID         string
	Config     *ConnectionConfig
	Client     *ssh.Client
	Session    *ssh.Session
	StdinPipe  io.WriteCloser
	StdoutPipe io.Reader
	StderrPipe io.Reader
	mu         sync.Mutex
	connected  bool
}

// Manager handles multiple SSH sessions
type Manager struct {
	sessions       map[string]*Session
	knownHostsPath string
	mu             sync.RWMutex
}

// NewManager creates a new SSH session manager
func NewManager(dataDir string) *Manager {
	knownHostsPath := filepath.Join(dataDir, "known_hosts")
	// Ensure the file exists
	if _, err := os.Stat(knownHostsPath); os.IsNotExist(err) {
		os.WriteFile(knownHostsPath, []byte{}, 0600)
	}

	return &Manager{
		sessions:       make(map[string]*Session),
		knownHostsPath: knownHostsPath,
	}
}

// ConnectionStatus represents the status of a connection attempt
type ConnectionStatus struct {
	Type      string `json:"type"` // status, log, connected, error
	Message   string `json:"message"`
	Success   bool   `json:"success,omitempty"`
	Timestamp int64  `json:"timestamp"`
}

// Connect establishes an SSH connection and returns a session
func (m *Manager) Connect(config *ConnectionConfig, statusChan chan<- ConnectionStatus) (*Session, error) {
	sendStatus := func(t, msg string, success bool) {
		if statusChan != nil {
			statusChan <- ConnectionStatus{
				Type:      t,
				Message:   msg,
				Success:   success,
				Timestamp: time.Now().UnixMilli(),
			}
		}
	}

	sendStatus("log", fmt.Sprintf("Starting connection to %s:%d", config.Address, config.Port), false)

	// Build auth methods
	authMethods, err := m.buildAuthMethods(config, sendStatus)
	if err != nil {
		sendStatus("error", fmt.Sprintf("Authentication setup failed: %v", err), false)
		return nil, err
	}

	sendStatus("log", "Authentication methods configured", false)

	// SSH client config
	var hostKeyCallback ssh.HostKeyCallback
	var errKey error

	if config.HostChecking {
		hostKeyCallback, errKey = knownhosts.New(m.knownHostsPath)
		if errKey != nil {
			sendStatus("log", fmt.Sprintf("Warning: could not load known_hosts: %v. Falling back to insecure.", errKey), false)
			hostKeyCallback = ssh.InsecureIgnoreHostKey()
		} else {
			sendStatus("log", "Host key checking enabled", false)
		}
	} else {
		hostKeyCallback = ssh.InsecureIgnoreHostKey()
	}

	sshConfig := &ssh.ClientConfig{
		User:            config.Username,
		Auth:            authMethods,
		Timeout:         30 * time.Second,
		HostKeyCallback: hostKeyCallback,
	}

	// Connect
	addr := fmt.Sprintf("%s:%d", config.Address, config.Port)
	sendStatus("log", fmt.Sprintf("Connecting to %s", addr), false)

	client, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		sendStatus("error", fmt.Sprintf("Connection failed: %v", err), false)
		return nil, fmt.Errorf("failed to connect: %w", err)
	}

	sendStatus("log", "SSH connection established", true)

	// Create session
	session, err := client.NewSession()
	if err != nil {
		client.Close()
		sendStatus("error", fmt.Sprintf("Failed to create session: %v", err), false)
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	sendStatus("log", "SSH session created", true)

	// Set up agent forwarding if enabled
	if config.AgentForwarding {
		if agentConn, err := net.Dial("unix", os.Getenv("SSH_AUTH_SOCK")); err == nil {
			agentClient := agent.NewClient(agentConn)
			if err := agent.RequestAgentForwarding(session); err == nil {
				agent.ForwardToAgent(client, agentClient)
				sendStatus("log", "Agent forwarding enabled", false)
			}
		}
	}

	// Request PTY
	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}

	if err := session.RequestPty("xterm-256color", 40, 120, modes); err != nil {
		session.Close()
		client.Close()
		sendStatus("error", fmt.Sprintf("Failed to request PTY: %v", err), false)
		return nil, fmt.Errorf("failed to request pty: %w", err)
	}

	sendStatus("log", "PTY allocated", true)

	// Get pipes
	stdin, err := session.StdinPipe()
	if err != nil {
		session.Close()
		client.Close()
		return nil, err
	}

	stdout, err := session.StdoutPipe()
	if err != nil {
		session.Close()
		client.Close()
		return nil, err
	}

	stderr, err := session.StderrPipe()
	if err != nil {
		session.Close()
		client.Close()
		return nil, err
	}

	// Start shell
	if err := session.Shell(); err != nil {
		session.Close()
		client.Close()
		sendStatus("error", fmt.Sprintf("Failed to start shell: %v", err), false)
		return nil, fmt.Errorf("failed to start shell: %w", err)
	}

	sendStatus("connected", "Successfully connected", true)

	// Run startup command if specified
	if config.StartupCommand != "" {
		time.Sleep(100 * time.Millisecond)
		stdin.Write([]byte(config.StartupCommand + "\n"))
	}

	sess := &Session{
		ID:         config.ID,
		Config:     config,
		Client:     client,
		Session:    session,
		StdinPipe:  stdin,
		StdoutPipe: stdout,
		StderrPipe: stderr,
		connected:  true,
	}

	// Store session
	m.mu.Lock()
	m.sessions[config.ID] = sess
	m.mu.Unlock()

	return sess, nil
}

// buildAuthMethods creates SSH auth methods based on config
func (m *Manager) buildAuthMethods(config *ConnectionConfig, sendStatus func(string, string, bool)) ([]ssh.AuthMethod, error) {
	var methods []ssh.AuthMethod

	switch config.AuthMethod {
	case "password":
		if config.Password != "" {
			methods = append(methods, ssh.Password(config.Password))
			sendStatus("log", "Using password authentication", false)
		}

	case "key":
		var keyLoaded bool

		// Try private key from path first
		if config.PrivateKeyPath != "" {
			keyPath := expandPath(config.PrivateKeyPath)
			key, err := os.ReadFile(keyPath)
			if err == nil {
				var signer ssh.Signer
				if config.Passphrase != "" {
					signer, err = ssh.ParsePrivateKeyWithPassphrase(key, []byte(config.Passphrase))
				} else {
					signer, err = ssh.ParsePrivateKey(key)
				}
				if err != nil {
					return nil, fmt.Errorf("failed to parse private key: %w", err)
				}
				methods = append(methods, ssh.PublicKeys(signer))
				sendStatus("log", fmt.Sprintf("Using SSH key from %s", config.PrivateKeyPath), false)
				keyLoaded = true
			} else {
				// Path failed, will try inline key next
				sendStatus("log", fmt.Sprintf("Could not read key from path %s, trying inline key", config.PrivateKeyPath), false)
			}
		}

		// Try inline private key (fallback or primary if no path)
		if !keyLoaded && config.PrivateKey != "" {
			var signer ssh.Signer
			var err error
			if config.Passphrase != "" {
				signer, err = ssh.ParsePrivateKeyWithPassphrase([]byte(config.PrivateKey), []byte(config.Passphrase))
			} else {
				signer, err = ssh.ParsePrivateKey([]byte(config.PrivateKey))
			}
			if err != nil {
				return nil, fmt.Errorf("failed to parse inline private key: %w", err)
			}
			methods = append(methods, ssh.PublicKeys(signer))
			sendStatus("log", "Using inline SSH key", false)
		}

	case "agent":
		// Try SSH agent
		if agentSock := os.Getenv("SSH_AUTH_SOCK"); agentSock != "" {
			conn, err := net.Dial("unix", agentSock)
			if err == nil {
				agentClient := agent.NewClient(conn)
				methods = append(methods, ssh.PublicKeysCallback(agentClient.Signers))
				sendStatus("log", "Using SSH agent", false)
			}
		}
	}

	// Fallback: try default SSH keys
	if len(methods) == 0 {
		homeDir, _ := os.UserHomeDir()
		defaultKeys := []string{
			filepath.Join(homeDir, ".ssh", "id_rsa"),
			filepath.Join(homeDir, ".ssh", "id_ed25519"),
			filepath.Join(homeDir, ".ssh", "id_ecdsa"),
		}

		for _, keyPath := range defaultKeys {
			if key, err := os.ReadFile(keyPath); err == nil {
				if signer, err := ssh.ParsePrivateKey(key); err == nil {
					methods = append(methods, ssh.PublicKeys(signer))
					sendStatus("log", fmt.Sprintf("Using default key %s", keyPath), false)
					break
				}
			}
		}
	}

	if len(methods) == 0 {
		return nil, fmt.Errorf("no authentication methods available")
	}

	return methods, nil
}

// GetSession returns an active session by ID
func (m *Manager) GetSession(id string) (*Session, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	sess, ok := m.sessions[id]
	return sess, ok
}

// CloseSession closes and removes a session
func (m *Manager) CloseSession(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	sess, ok := m.sessions[id]
	if !ok {
		return fmt.Errorf("session not found")
	}

	sess.mu.Lock()
	sess.connected = false
	sess.mu.Unlock()

	if sess.Session != nil {
		sess.Session.Close()
	}
	if sess.Client != nil {
		sess.Client.Close()
	}

	delete(m.sessions, id)
	return nil
}

// HandleWebSocket handles WebSocket connection for terminal I/O
func (m *Manager) HandleWebSocket(ws *websocket.Conn, config *ConnectionConfig) {
	statusChan := make(chan ConnectionStatus, 10)
	var wsMu sync.Mutex // Protect ALL concurrent WebSocket writes

	// Send status updates to WebSocket
	go func() {
		for status := range statusChan {
			data, _ := json.Marshal(status)
			wsMu.Lock()
			ws.WriteMessage(websocket.TextMessage, data)
			wsMu.Unlock()
		}
	}()

	// Connect
	session, err := m.Connect(config, statusChan)
	if err != nil {
		close(statusChan)
		return
	}
	close(statusChan)

	// Handle terminal I/O
	done := make(chan struct{})

	// Read from SSH and send to WebSocket
	go func() {
		buf := make([]byte, 8192)
		for {
			n, err := session.StdoutPipe.Read(buf)
			if err != nil {
				break
			}
			if n > 0 {
				msg := map[string]interface{}{
					"type": "output",
					"data": string(buf[:n]),
				}
				data, _ := json.Marshal(msg)
				wsMu.Lock()
				ws.WriteMessage(websocket.TextMessage, data)
				wsMu.Unlock()
			}
		}
		done <- struct{}{}
	}()

	// Read stderr
	go func() {
		buf := make([]byte, 8192)
		for {
			n, err := session.StderrPipe.Read(buf)
			if err != nil {
				break
			}
			if n > 0 {
				msg := map[string]interface{}{
					"type": "output",
					"data": string(buf[:n]),
				}
				data, _ := json.Marshal(msg)
				wsMu.Lock()
				ws.WriteMessage(websocket.TextMessage, data)
				wsMu.Unlock()
			}
		}
	}()

	// Read from WebSocket and send to SSH
	go func() {
		for {
			_, message, err := ws.ReadMessage()
			if err != nil {
				break
			}

			var msg struct {
				Type string `json:"type"`
				Data string `json:"data"`
				Cols int    `json:"cols"`
				Rows int    `json:"rows"`
			}
			if err := json.Unmarshal(message, &msg); err != nil {
				continue
			}

			switch msg.Type {
			case "input":
				session.StdinPipe.Write([]byte(msg.Data))
			case "resize":
				if msg.Cols > 0 && msg.Rows > 0 {
					session.Session.WindowChange(msg.Rows, msg.Cols)
				}
			}
		}
		done <- struct{}{}
	}()

	<-done
	m.CloseSession(config.ID)
}

// ExecuteCommand runs a single command and returns output
func (m *Manager) ExecuteCommand(config *ConnectionConfig, command string) (string, error) {
	// Build auth methods
	authMethods, err := m.buildAuthMethods(config, func(string, string, bool) {})
	if err != nil {
		return "", err
	}

	sshConfig := &ssh.ClientConfig{
		User:            config.Username,
		Auth:            authMethods,
		Timeout:         30 * time.Second,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
	}

	addr := fmt.Sprintf("%s:%d", config.Address, config.Port)
	client, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		return "", err
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	var stdout, stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr

	err = session.Run(command)
	output := stdout.String()
	if stderr.Len() > 0 {
		output += "\n" + stderr.String()
	}

	return output, err
}

// ExecuteCommandMulti runs command on multiple hosts in parallel
func (m *Manager) ExecuteCommandMulti(configs []*ConnectionConfig, command string) map[string]struct {
	Output string `json:"output"`
	Error  string `json:"error,omitempty"`
} {
	results := make(map[string]struct {
		Output string `json:"output"`
		Error  string `json:"error,omitempty"`
	})
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, config := range configs {
		wg.Add(1)
		go func(cfg *ConnectionConfig) {
			defer wg.Done()

			output, err := m.ExecuteCommand(cfg, command)

			mu.Lock()
			if err != nil {
				results[cfg.ID] = struct {
					Output string `json:"output"`
					Error  string `json:"error,omitempty"`
				}{Output: output, Error: err.Error()}
			} else {
				results[cfg.ID] = struct {
					Output string `json:"output"`
					Error  string `json:"error,omitempty"`
				}{Output: output}
			}
			mu.Unlock()
		}(config)
	}

	wg.Wait()
	return results
}

func expandPath(path string) string {
	if len(path) > 0 && path[0] == '~' {
		home, _ := os.UserHomeDir()
		return filepath.Join(home, path[1:])
	}
	return path
}
