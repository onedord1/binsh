package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"golang.org/x/crypto/ssh"

	"systask/internal/actions"
	"systask/internal/auth"
	"systask/internal/cloud"
	"systask/internal/sftp"
	sshclient "systask/internal/ssh"
	"systask/internal/storage"
	"systask/internal/vault"
)

var (
	store        *storage.Store
	sshManager   *sshclient.Manager
	executor     *actions.Executor
	vaultService *vault.Vault
	upgrader     = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
)

// getRealHomeDir returns the real home directory, handling snap confinement
func getRealHomeDir() (string, error) {
	// In snap environment, SNAP_REAL_HOME contains the real home directory
	if snapRealHome := os.Getenv("SNAP_REAL_HOME"); snapRealHome != "" {
		return snapRealHome, nil
	}
	// Also check HOME before snap modified it
	if realHome := os.Getenv("REAL_HOME"); realHome != "" {
		return realHome, nil
	}
	// Fallback to standard home directory
	return os.UserHomeDir()
}

func init() {
	// Initialize data directory
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = "."
	}
	dataDir := filepath.Join(configDir, "binsh", "data")

	store, err = storage.NewStore(dataDir)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}

	// Setup file logging
	logFile, err := os.OpenFile(filepath.Join(dataDir, "binsh.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err == nil {
		log.SetOutput(io.MultiWriter(os.Stdout, logFile))
	} else {
		log.Printf("Failed to open log file: %v", err)
	}

	sshManager = sshclient.NewManager(dataDir)
	executor = actions.NewExecutor()

	// Initialize vault for credential encryption
	vaultService, err = vault.NewVault(dataDir)
	if err != nil {
		log.Printf("Warning: Failed to initialize vault: %v", err)
	}

	// Initialize MongoDB for authentication
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		// Note: @ in password is URL-encoded as %40
		mongoURI = "mongodb+srv://systask_apps_user:%40%40Ak112233@systask.vg893yd.mongodb.net/?appName=SysTask"
	}
	if err := auth.ConnectMongoDB(mongoURI); err != nil {
		log.Printf("Warning: Failed to connect to MongoDB: %v", err)
		// Fallback to file-based authentication storage
		if err := auth.SetupFileStorage(dataDir); err != nil {
			log.Printf("Warning: Failed to setup file storage for auth: %v", err)
		} else {
			log.Println("Using file-based authentication storage")
		}
	} else {
		log.Println("Connected to MongoDB successfully")
	}
}

func main() {
	r := mux.NewRouter()

	// Middleware
	r.Use(corsMiddleware)
	r.Use(loggingMiddleware)

	// API routes
	api := r.PathPrefix("/api").Subrouter()

	// Public Routes (Auth)
	api.HandleFunc("/auth/register", registerUser).Methods("POST", "OPTIONS")
	api.HandleFunc("/auth/login", loginUser).Methods("POST", "OPTIONS")
	api.HandleFunc("/auth/verify", verifyToken).Methods("GET", "OPTIONS")

	// Protected Routes (Everything else)
	protected := api.PathPrefix("/").Subrouter()
	protected.Use(AuthMiddleware)

	// ========================================
	// Authentication headers helper
	// ========================================

	// ========================================
	// Authentication
	// ========================================
	// Moved to Public Routes section above

	// ========================================
	// Vault (Credential Encryption)
	// ========================================
	api.HandleFunc("/vault/status", vaultStatus).Methods("GET", "OPTIONS")
	api.HandleFunc("/vault/setup", vaultSetup).Methods("POST", "OPTIONS")
	api.HandleFunc("/vault/unlock", vaultUnlock).Methods("POST", "OPTIONS")
	api.HandleFunc("/vault/lock", vaultLock).Methods("POST", "OPTIONS")
	protected.HandleFunc("/vault/credentials", getVaultCredentials).Methods("GET", "OPTIONS")

	// ========================================
	// Host Management
	// ========================================
	// ========================================
	// Host Management
	// ========================================
	protected.HandleFunc("/hosts", getHosts).Methods("GET", "OPTIONS")
	protected.HandleFunc("/hosts", createHost).Methods("POST", "OPTIONS")
	protected.HandleFunc("/hosts/{id}", getHost).Methods("GET", "OPTIONS")
	protected.HandleFunc("/hosts/{id}", updateHost).Methods("PUT", "OPTIONS")
	protected.HandleFunc("/hosts/{id}", deleteHost).Methods("DELETE", "OPTIONS")

	// ========================================
	// Group Management
	// ========================================
	protected.HandleFunc("/groups", getGroups).Methods("GET", "OPTIONS")
	protected.HandleFunc("/groups", createGroup).Methods("POST", "OPTIONS")
	protected.HandleFunc("/groups/{id}", updateGroup).Methods("PUT", "OPTIONS")
	protected.HandleFunc("/groups/{id}", deleteGroup).Methods("DELETE", "OPTIONS")
	protected.HandleFunc("/groups/{id}/cloud/sync", syncCloudHosts).Methods("POST", "OPTIONS")
	protected.HandleFunc("/groups/{id}/cloud/instances", getCloudInstances).Methods("GET", "OPTIONS")

	// ========================================
	// Keychain
	// ========================================
	protected.HandleFunc("/keychain", getKeychains).Methods("GET", "OPTIONS")
	protected.HandleFunc("/keychain", createKeychain).Methods("POST", "OPTIONS")
	protected.HandleFunc("/keychain/{id}", deleteKeychain).Methods("DELETE", "OPTIONS")

	// ========================================
	// Snippets
	// ========================================
	protected.HandleFunc("/snippets", getSnippets).Methods("GET", "OPTIONS")
	protected.HandleFunc("/snippets", createSnippet).Methods("POST", "OPTIONS")
	protected.HandleFunc("/snippets/{id}", deleteSnippet).Methods("DELETE", "OPTIONS")

	// ========================================
	// Known Hosts
	// ========================================
	protected.HandleFunc("/known-hosts", getKnownHosts).Methods("GET", "OPTIONS")
	protected.HandleFunc("/known-hosts/{host}", removeKnownHost).Methods("DELETE", "OPTIONS")

	// ========================================
	// Port Forwarding
	// ========================================
	protected.HandleFunc("/portforwards", getPortForwards).Methods("GET", "OPTIONS")
	protected.HandleFunc("/portforwards", createPortForward).Methods("POST", "OPTIONS")
	protected.HandleFunc("/portforwards/{id}", updatePortForward).Methods("PUT", "OPTIONS")
	protected.HandleFunc("/portforwards/{id}", deletePortForward).Methods("DELETE", "OPTIONS")
	protected.HandleFunc("/portforwards/{id}/start", startPortForward).Methods("POST", "OPTIONS")
	protected.HandleFunc("/portforwards/{id}/stop", stopPortForward).Methods("POST", "OPTIONS")
	protected.HandleFunc("/portforwards/status", getPortForwardStatus).Methods("GET", "OPTIONS")

	// ========================================
	// Settings
	// ========================================
	api.HandleFunc("/settings", getSettings).Methods("GET", "OPTIONS")
	api.HandleFunc("/settings", saveSettings).Methods("PUT", "OPTIONS")

	// ========================================
	// SSH WebSocket
	// ========================================
	r.HandleFunc("/ws/ssh/{hostId}", handleSSHWebSocket)
	r.HandleFunc("/ws/shell", handleLocalShellWebSocket)

	// ========================================
	// SFTP Operations (Protected)
	// ========================================
	protected.HandleFunc("/sftp/{hostId}/list", sftpList).Methods("GET", "OPTIONS")
	protected.HandleFunc("/sftp/{hostId}/mkdir", sftpMkdir).Methods("POST", "OPTIONS")
	protected.HandleFunc("/sftp/{hostId}/delete", sftpDelete).Methods("DELETE", "OPTIONS")
	protected.HandleFunc("/sftp/{hostId}/rename", sftpRename).Methods("POST", "OPTIONS")
	protected.HandleFunc("/sftp/{hostId}/download", sftpDownload).Methods("GET", "OPTIONS")
	protected.HandleFunc("/sftp/{hostId}/upload", sftpUpload).Methods("POST", "OPTIONS")
	protected.HandleFunc("/sftp/transfer", sftpTransfer).Methods("POST", "OPTIONS")
	protected.HandleFunc("/sftp/transfer/stream", sftpTransferStream).Methods("POST", "OPTIONS")

	// ========================================
	// Local Filesystem Operations (Protected)
	// ========================================
	protected.HandleFunc("/local/list", localList).Methods("GET", "OPTIONS")
	protected.HandleFunc("/local/mkdir", localMkdir).Methods("POST", "OPTIONS")
	protected.HandleFunc("/local/delete", localDelete).Methods("DELETE", "OPTIONS")
	protected.HandleFunc("/local/upload", localUpload).Methods("POST", "OPTIONS")

	// ========================================
	// Quick Actions
	// ========================================
	// Quick Actions
	// ========================================
	protected.HandleFunc("/actions/execute", executeCommand).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/execute-multi", executeMultiCommand).Methods("POST", "OPTIONS")

	// Package Manager
	// Package Manager
	protected.HandleFunc("/actions/packages/detect", detectPackageManager).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/packages/install", packageInstall).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/packages/remove", packageRemove).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/packages/update", packageUpdate).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/packages/search", packageSearch).Methods("POST", "OPTIONS")

	// Service Control
	// Service Control
	protected.HandleFunc("/actions/services", listServices).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/services/status", serviceStatus).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/services/control", serviceControl).Methods("POST", "OPTIONS")

	// User Management
	protected.HandleFunc("/actions/users", listUsers).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/users/create", createUser).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/users/delete", deleteUser).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/groups", listGroups).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/users/groups", getUserGroups).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/users/groups/modify", modifyUserGroups).Methods("POST", "OPTIONS")

	// System Metrics
	// System Metrics
	protected.HandleFunc("/actions/metrics", getMetrics).Methods("POST", "OPTIONS")

	// Logs
	// Logs
	protected.HandleFunc("/actions/logs", getLogs).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/logs/search", searchLogs).Methods("POST", "OPTIONS")

	// Container Management (Docker/Podman)
	protected.HandleFunc("/actions/containers/detect", detectContainerRuntime).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/containers/list", listContainersNew).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/containers/action", containerActionNew).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/containers/images", listContainerImages).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/containers/images/delete", deleteContainerImages).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/containers/prune", containerSystemPrune).Methods("POST", "OPTIONS")

	// Legacy Docker routes (for backwards compatibility)
	protected.HandleFunc("/actions/docker/containers", listContainers).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/docker/container/{action}", containerAction).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/docker/logs", containerLogs).Methods("POST", "OPTIONS")

	// Network Diagnostics
	protected.HandleFunc("/actions/network/ping", pingHost).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/network/traceroute", tracerouteHost).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/network/netstat", netstatHost).Methods("POST", "OPTIONS")

	// System Logs
	protected.HandleFunc("/actions/logs/syslog", getSyslog).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/logs/auth", getAuthLog).Methods("POST", "OPTIONS")

	// Cron Jobs Management
	protected.HandleFunc("/actions/cron/list", listCronJobs).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/cron/add", addCronJob).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/cron/delete", deleteCronJob).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/files/browse", browseDirectory).Methods("POST", "OPTIONS")

	// Process Management
	protected.HandleFunc("/actions/processes/list", listProcesses).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/processes/kill", killProcess).Methods("POST", "OPTIONS")

	// Firewall Management
	protected.HandleFunc("/actions/firewall/status", getFirewallStatus).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/firewall/add", addFirewallRule).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/firewall/delete", deleteFirewallRule).Methods("POST", "OPTIONS")
	protected.HandleFunc("/actions/firewall/toggle", toggleFirewall).Methods("POST", "OPTIONS")

	// Health check
	api.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "version": "1.0.0-beta"})
	}).Methods("GET")

	// Serve static frontend files (SPA)
	r.PathPrefix("/").Handler(spaHandler())

	port := os.Getenv("BINSH_PORT")
	if port == "" {
		port = os.Getenv("SYSTASK_PORT")
	}
	if port == "" {
		port = "9876"
	}

	fmt.Printf("🚀 binsh running on http://localhost:%s\n", port)
	fmt.Printf("📂 Data directory: %s\n", filepath.Join(os.Getenv("HOME"), ".config/binsh/data"))
	log.Fatal(http.ListenAndServe("0.0.0.0:"+port, r))
}

// ========================================
// Authentication Handlers
// ========================================

func registerUser(w http.ResponseWriter, r *http.Request) {
	var req auth.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		http.Error(w, "Email and password are required", http.StatusBadRequest)
		return
	}

	resp, err := auth.Register(req)
	if err != nil {
		if err == auth.ErrUserExists {
			http.Error(w, "User already exists", http.StatusConflict)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func loginUser(w http.ResponseWriter, r *http.Request) {
	var req auth.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		http.Error(w, "Email and password are required", http.StatusBadRequest)
		return
	}

	resp, err := auth.Login(req)
	if err != nil {
		if err == auth.ErrInvalidCreds || err == auth.ErrUserNotFound {
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func verifyToken(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Authorization header required", http.StatusUnauthorized)
		return
	}

	// Extract token from "Bearer <token>"
	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	if tokenString == authHeader {
		http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
		return
	}

	claims, err := auth.ValidateToken(tokenString)
	if err != nil {
		http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
		return
	}

	// Get user details
	user, err := auth.GetUserByID(claims.UserID)
	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"valid": true,
		"user":  user,
	})
}

// ========================================
// Vault Handlers
// ========================================

func vaultStatus(w http.ResponseWriter, r *http.Request) {
	status := "uninitialized"
	if vaultService != nil {
		status = vaultService.Status()
	}
	json.NewEncoder(w).Encode(map[string]string{"status": status})
}

func vaultSetup(w http.ResponseWriter, r *http.Request) {
	if vaultService == nil {
		http.Error(w, "vault not available", http.StatusInternalServerError)
		return
	}

	var req struct {
		MasterPassword string `json:"master_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if len(req.MasterPassword) < 8 {
		http.Error(w, "master password must be at least 8 characters", http.StatusBadRequest)
		return
	}

	if err := vaultService.Setup(req.MasterPassword); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "vault initialized"})
}

func vaultUnlock(w http.ResponseWriter, r *http.Request) {
	if vaultService == nil {
		http.Error(w, "vault not available", http.StatusInternalServerError)
		return
	}

	var req struct {
		MasterPassword string `json:"master_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := vaultService.Unlock(req.MasterPassword); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "vault unlocked"})
}

func vaultLock(w http.ResponseWriter, r *http.Request) {
	if vaultService != nil {
		vaultService.Lock()
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "vault locked"})
}

func getVaultCredentials(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if vaultService == nil || !vaultService.IsUnlocked() {
		http.Error(w, "vault is locked", http.StatusForbidden)
		return
	}

	// Get all hosts for the user
	hosts, err := store.GetHosts(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Filter to only password-based hosts and decrypt passwords
	type CredentialHost struct {
		ID       string `json:"id"`
		Label    string `json:"label"`
		Address  string `json:"address"`
		Port     int    `json:"port"`
		Username string `json:"username"`
		Password string `json:"password"`
	}

	var credentials []CredentialHost
	for _, h := range hosts {
		if h.AuthMethod == "password" && h.Password != "" {
			password := h.Password
			// Decrypt if encrypted
			if vault.IsEncrypted(password) {
				decrypted, err := vaultService.Decrypt(password)
				if err == nil {
					password = decrypted
				}
			}
			credentials = append(credentials, CredentialHost{
				ID:       h.ID,
				Label:    h.Label,
				Address:  h.Address,
				Port:     h.Port,
				Username: h.Username,
				Password: password,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(credentials)
}

// ========================================
// Middleware
// ========================================

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}

// isLocalHost checks if the host ID indicates local execution
// Accepts: "local", "local-terminal", or empty string
func isLocalHost(hostID string) bool {
	return hostID == "" || hostID == "local" || hostID == "local-terminal"
}

// AuthMiddleware validates the JWT token
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handle CORS preflight
		if r.Method == "OPTIONS" {
			next.ServeHTTP(w, r)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		// Check format "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
			return
		}

		tokenString := parts[1]
		claims, err := auth.ValidateToken(tokenString)
		if err != nil {
			http.Error(w, "Invalid token: "+err.Error(), http.StatusUnauthorized)
			return
		}

		// Add UserID to context
		ctx := context.WithValue(r.Context(), "userID", claims.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func getUserID(r *http.Request) string {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		return ""
	}
	return userID
}

// ========================================
// Host Handlers
// ========================================

func getHosts(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hosts, err := store.GetHosts(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(hosts)
}

func getHost(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	host, err := store.GetHost(vars["id"], userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if host == nil {
		http.Error(w, "Host not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(host)
}

func createHost(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var host storage.Host
	if err := json.NewDecoder(r.Body).Decode(&host); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Encrypt sensitive credentials if vault is unlocked
	if vaultService != nil && vaultService.IsUnlocked() {
		if host.Password != "" {
			encrypted, err := vaultService.Encrypt(host.Password)
			if err != nil {
				http.Error(w, "failed to encrypt password: "+err.Error(), http.StatusInternalServerError)
				return
			}
			host.Password = encrypted
		}
		if host.Passphrase != "" {
			encrypted, err := vaultService.Encrypt(host.Passphrase)
			if err != nil {
				http.Error(w, "failed to encrypt passphrase: "+err.Error(), http.StatusInternalServerError)
				return
			}
			host.Passphrase = encrypted
		}
	}

	if err := store.CreateHost(&host, userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(host)
}

func updateHost(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	var host storage.Host
	if err := json.NewDecoder(r.Body).Decode(&host); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	host.ID = vars["id"]

	// Encrypt sensitive credentials if vault is unlocked and not already encrypted
	if vaultService != nil && vaultService.IsUnlocked() {
		if host.Password != "" && !vault.IsEncrypted(host.Password) {
			encrypted, err := vaultService.Encrypt(host.Password)
			if err != nil {
				http.Error(w, "failed to encrypt password: "+err.Error(), http.StatusInternalServerError)
				return
			}
			host.Password = encrypted
		}
		if host.Passphrase != "" && !vault.IsEncrypted(host.Passphrase) {
			encrypted, err := vaultService.Encrypt(host.Passphrase)
			if err != nil {
				http.Error(w, "failed to encrypt passphrase: "+err.Error(), http.StatusInternalServerError)
				return
			}
			host.Passphrase = encrypted
		}
	}

	if err := store.UpdateHost(&host, userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(host)
}

func deleteHost(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	if err := store.DeleteHost(vars["id"], userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ========================================
// Group Handlers
// ========================================

func getGroups(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	groups, err := store.GetGroups(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(groups)
}

func createGroup(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var group storage.Group
	if err := json.NewDecoder(r.Body).Decode(&group); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := store.CreateGroup(&group, userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(group)
}

func updateGroup(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	var group storage.Group
	if err := json.NewDecoder(r.Body).Decode(&group); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	group.ID = vars["id"]
	if err := store.UpdateGroup(&group, userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(group)
}

func deleteGroup(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	if err := store.DeleteGroup(vars["id"], userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ========================================
// Cloud Sync Handlers
// ========================================

func getCloudInstances(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groups, _ := store.GetGroups(userID)
	var group *storage.Group
	for _, g := range groups {
		if g.ID == vars["id"] {
			group = &g
			break
		}
	}

	if group == nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	if !group.CloudSync || group.CloudProvider == "" {
		http.Error(w, "Cloud sync not enabled for this group", http.StatusBadRequest)
		return
	}

	provider, err := cloud.NewProvider(group.CloudProvider)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	instances, err := provider.ListInstances(group.CloudConfig)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(instances)
}

func syncCloudHosts(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groups, _ := store.GetGroups(userID)
	var group *storage.Group
	for _, g := range groups {
		if g.ID == vars["id"] {
			group = &g
			break
		}
	}

	if group == nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	provider, err := cloud.NewProvider(group.CloudProvider)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	instances, err := provider.ListInstances(group.CloudConfig)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Create hosts from instances
	var syncedCount int
	for _, inst := range instances {
		// Simple check for existing hosts by address
		hosts, _ := store.GetHosts(userID)
		exists := false
		for _, h := range hosts {
			if h.Address == inst.IPAddress && h.GroupID == group.ID {
				exists = true
				break
			}
		}

		if !exists {
			host := &storage.Host{
				Label:      inst.Name,
				Address:    inst.IPAddress,
				Port:       22,
				Username:   "root", // default
				AuthMethod: "key",
				GroupID:    group.ID,
				Tags:       []string{inst.Provider, inst.Region},
			}
			store.CreateHost(host, userID)
			syncedCount++
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "ok",
		"synced":  syncedCount,
		"message": fmt.Sprintf("Successfully synced %d hosts from %s", syncedCount, group.CloudProvider),
	})
}

// ========================================
// Keychain Handlers
// ========================================

func getKeychains(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	items, err := store.GetKeychains(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Decrypt sensitive fields if vault is unlocked
	if vaultService != nil && vaultService.IsUnlocked() {
		for i := range items {
			if items[i].Password != "" {
				decrypted, err := vaultService.Decrypt(items[i].Password)
				if err == nil {
					items[i].Password = decrypted
				}
			}
			if items[i].PrivateKey != "" {
				decrypted, err := vaultService.Decrypt(items[i].PrivateKey)
				if err == nil {
					items[i].PrivateKey = decrypted
				}
			}
			if items[i].Passphrase != "" {
				decrypted, err := vaultService.Decrypt(items[i].Passphrase)
				if err == nil {
					items[i].Passphrase = decrypted
				}
			}
		}
	}

	json.NewEncoder(w).Encode(items)
}

func createKeychain(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var item storage.Keychain
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Encrypt sensitive fields if vault is unlocked
	if vaultService != nil && vaultService.IsUnlocked() {
		if item.Password != "" {
			encrypted, err := vaultService.Encrypt(item.Password)
			if err != nil {
				http.Error(w, "failed to encrypt password: "+err.Error(), http.StatusInternalServerError)
				return
			}
			item.Password = encrypted
		}
		if item.PrivateKey != "" {
			encrypted, err := vaultService.Encrypt(item.PrivateKey)
			if err != nil {
				http.Error(w, "failed to encrypt private key: "+err.Error(), http.StatusInternalServerError)
				return
			}
			item.PrivateKey = encrypted
		}
		if item.Passphrase != "" {
			encrypted, err := vaultService.Encrypt(item.Passphrase)
			if err != nil {
				http.Error(w, "failed to encrypt passphrase: "+err.Error(), http.StatusInternalServerError)
				return
			}
			item.Passphrase = encrypted
		}
	}

	if err := store.CreateKeychain(&item, userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

func deleteKeychain(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	if err := store.DeleteKeychain(vars["id"], userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ========================================
// Snippets Handlers
// ========================================

func getSnippets(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	items, err := store.GetSnippets(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(items)
}

func createSnippet(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var item storage.Snippet
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := store.CreateSnippet(&item, userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

func deleteSnippet(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	if err := store.DeleteSnippet(vars["id"], userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ========================================
// Known Hosts Handlers
// ========================================

type KnownHostEntry struct {
	Host      string `json:"host"`
	Port      int    `json:"port"`
	KeyType   string `json:"key_type"`
	PublicKey string `json:"public_key"`
}

func getKnownHosts(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	homeDir, err := getRealHomeDir()
	if err != nil {
		http.Error(w, "Failed to get home directory", http.StatusInternalServerError)
		return
	}

	knownHostsPath := filepath.Join(homeDir, ".ssh", "known_hosts")
	content, err := os.ReadFile(knownHostsPath)
	if err != nil {
		if os.IsNotExist(err) {
			json.NewEncoder(w).Encode([]KnownHostEntry{})
			return
		}
		// Check if this is a snap permission error
		if os.IsPermission(err) && os.Getenv("SNAP") != "" {
			log.Printf("Snap permission denied for %s. Run: sudo snap connect binsh:ssh-keys", knownHostsPath)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":       "snap_permission_denied",
				"message":     "SSH keys access not connected. Please run: sudo snap connect binsh:ssh-keys",
				"command":     "sudo snap connect binsh:ssh-keys",
				"isSnapError": true,
			})
			return
		}
		log.Printf("Failed to read known_hosts from %s: %v", knownHostsPath, err)
		http.Error(w, "Failed to read known_hosts file", http.StatusInternalServerError)
		return
	}

	var entries []KnownHostEntry
	lines := strings.Split(string(content), "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) < 3 {
			continue
		}

		hostPart := parts[0]
		keyType := parts[1]
		publicKey := parts[2]

		// Handle hashed hosts (starting with |1|)
		if strings.HasPrefix(hostPart, "|1|") {
			continue // Skip hashed entries as we can't display them
		}

		// Parse host and port
		host := hostPart
		port := 22

		// Handle [host]:port format
		if strings.HasPrefix(hostPart, "[") {
			endBracket := strings.Index(hostPart, "]")
			if endBracket > 0 {
				host = hostPart[1:endBracket]
				if len(hostPart) > endBracket+2 && hostPart[endBracket+1] == ':' {
					portStr := hostPart[endBracket+2:]
					if p, err := strconv.Atoi(portStr); err == nil {
						port = p
					}
				}
			}
		} else if strings.Contains(hostPart, ",") {
			// Handle host,ip format - take first part
			host = strings.Split(hostPart, ",")[0]
		}

		entries = append(entries, KnownHostEntry{
			Host:      host,
			Port:      port,
			KeyType:   keyType,
			PublicKey: publicKey,
		})
	}

	json.NewEncoder(w).Encode(entries)
}

func removeKnownHost(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	hostToRemove := vars["host"]

	homeDir, err := getRealHomeDir()
	if err != nil {
		http.Error(w, "Failed to get home directory", http.StatusInternalServerError)
		return
	}

	knownHostsPath := filepath.Join(homeDir, ".ssh", "known_hosts")
	content, err := os.ReadFile(knownHostsPath)
	if err != nil {
		log.Printf("Failed to read known_hosts from %s: %v", knownHostsPath, err)
		http.Error(w, "Failed to read known_hosts file", http.StatusInternalServerError)
		return
	}

	lines := strings.Split(string(content), "\n")
	var newLines []string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		parts := strings.Fields(trimmed)
		if len(parts) < 1 {
			newLines = append(newLines, line)
			continue
		}

		hostPart := parts[0]
		shouldKeep := true

		// Check if this line matches the host to remove
		if strings.HasPrefix(hostPart, "[") {
			endBracket := strings.Index(hostPart, "]")
			if endBracket > 0 {
				host := hostPart[1:endBracket]
				if host == hostToRemove {
					shouldKeep = false
				}
			}
		} else if strings.Contains(hostPart, ",") {
			hosts := strings.Split(hostPart, ",")
			for _, h := range hosts {
				if h == hostToRemove {
					shouldKeep = false
					break
				}
			}
		} else if hostPart == hostToRemove {
			shouldKeep = false
		}

		if shouldKeep {
			newLines = append(newLines, line)
		}
	}

	newContent := strings.Join(newLines, "\n")
	if len(newLines) > 0 && !strings.HasSuffix(newContent, "\n") {
		newContent += "\n"
	}

	if err := os.WriteFile(knownHostsPath, []byte(newContent), 0644); err != nil {
		http.Error(w, "Failed to write known_hosts file", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ========================================
// Port Forwarding Handlers
// ========================================

// Active tunnels map: id -> cancel function
var activeTunnels = make(map[string]func())
var tunnelsMu sync.RWMutex

type TunnelStatus struct {
	ID     string `json:"id"`
	Active bool   `json:"active"`
}

func getPortForwards(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	items, err := store.GetPortForwards(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(items)
}

func createPortForward(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var item storage.PortForward
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := store.CreatePortForward(&item); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

func updatePortForward(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	var item storage.PortForward
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	item.ID = vars["id"]
	if err := store.UpdatePortForward(&item); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(item)
}

func deletePortForward(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	id := vars["id"]

	// Stop tunnel if active
	tunnelsMu.Lock()
	if cancel, ok := activeTunnels[id]; ok {
		cancel()
		delete(activeTunnels, id)
	}
	tunnelsMu.Unlock()

	if err := store.DeletePortForward(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func startPortForward(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	id := vars["id"]

	// Check if already active
	tunnelsMu.RLock()
	if _, ok := activeTunnels[id]; ok {
		tunnelsMu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "already_running"})
		return
	}
	tunnelsMu.RUnlock()

	// Get port forward config
	pf, err := store.GetPortForward(id)
	if err != nil {
		http.Error(w, "Port forward not found", http.StatusNotFound)
		return
	}

	// Get host details
	host, err := store.GetHost(pf.HostID, userID)
	if err != nil {
		http.Error(w, "Host not found", http.StatusNotFound)
		return
	}

	// Decrypt password if needed
	password := host.Password
	if vaultService != nil && vaultService.IsUnlocked() && password != "" {
		if decrypted, err := vaultService.Decrypt(password); err == nil {
			password = decrypted
		}
	}

	// Create SSH client config
	config := &ssh.ClientConfig{
		User:            host.Username,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	if host.AuthMethod == "password" {
		config.Auth = []ssh.AuthMethod{ssh.Password(password)}
	} else if host.AuthMethod == "key" {
		keyData := []byte(host.SSHKey)
		if host.SSHKeyPath != "" {
			// Read key from file
			expanded := host.SSHKeyPath
			if strings.HasPrefix(expanded, "~") {
				home, _ := getRealHomeDir()
				expanded = filepath.Join(home, expanded[1:])
			}
			if data, err := os.ReadFile(expanded); err == nil {
				keyData = data
			}
		}
		var signer ssh.Signer
		var err error
		if host.Passphrase != "" {
			passphrase := host.Passphrase
			if vaultService != nil && vaultService.IsUnlocked() {
				if decrypted, e := vaultService.Decrypt(passphrase); e == nil {
					passphrase = decrypted
				}
			}
			signer, err = ssh.ParsePrivateKeyWithPassphrase(keyData, []byte(passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey(keyData)
		}
		if err != nil {
			http.Error(w, "Failed to parse SSH key: "+err.Error(), http.StatusBadRequest)
			return
		}
		config.Auth = []ssh.AuthMethod{ssh.PublicKeys(signer)}
	}

	// Connect to SSH server
	addr := fmt.Sprintf("%s:%d", host.Address, host.Port)
	sshClient, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		http.Error(w, "Failed to connect to host: "+err.Error(), http.StatusBadGateway)
		return
	}

	// Create context for cancellation
	ctx, cancel := context.WithCancel(context.Background())

	// Store cancel function
	tunnelsMu.Lock()
	activeTunnels[id] = func() {
		cancel()
		sshClient.Close()
	}
	tunnelsMu.Unlock()

	// Start the tunnel based on type
	go func() {
		defer func() {
			tunnelsMu.Lock()
			delete(activeTunnels, id)
			tunnelsMu.Unlock()
			sshClient.Close()
		}()

		switch pf.Type {
		case "local":
			runLocalForward(ctx, sshClient, pf)
		case "remote":
			runRemoteForward(ctx, sshClient, pf)
		case "dynamic":
			runDynamicForward(ctx, sshClient, pf)
		}
	}()

	json.NewEncoder(w).Encode(map[string]interface{}{"status": "started", "id": id})
}

func stopPortForward(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	id := vars["id"]

	tunnelsMu.Lock()
	if cancel, ok := activeTunnels[id]; ok {
		cancel()
		delete(activeTunnels, id)
		tunnelsMu.Unlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "stopped", "id": id})
		return
	}
	tunnelsMu.Unlock()

	json.NewEncoder(w).Encode(map[string]interface{}{"status": "not_running", "id": id})
}

func getPortForwardStatus(w http.ResponseWriter, r *http.Request) {
	tunnelsMu.RLock()
	defer tunnelsMu.RUnlock()

	var statuses []TunnelStatus
	for id := range activeTunnels {
		statuses = append(statuses, TunnelStatus{ID: id, Active: true})
	}
	json.NewEncoder(w).Encode(statuses)
}

// Local port forwarding: listen locally, forward to remote
func runLocalForward(ctx context.Context, sshClient *ssh.Client, pf *storage.PortForward) {
	bindAddr := pf.BindAddr
	if bindAddr == "" {
		bindAddr = "127.0.0.1"
	}
	localAddr := fmt.Sprintf("%s:%d", bindAddr, pf.LocalPort)
	remoteAddr := fmt.Sprintf("%s:%d", pf.RemoteHost, pf.RemotePort)

	listener, err := net.Listen("tcp", localAddr)
	if err != nil {
		log.Printf("[PortForward] Failed to listen on %s: %v", localAddr, err)
		return
	}
	defer listener.Close()

	log.Printf("[PortForward] Local forward started: %s -> %s", localAddr, remoteAddr)

	go func() {
		<-ctx.Done()
		listener.Close()
	}()

	for {
		conn, err := listener.Accept()
		if err != nil {
			select {
			case <-ctx.Done():
				return
			default:
				log.Printf("[PortForward] Accept error: %v", err)
				continue
			}
		}

		go func(conn net.Conn) {
			defer conn.Close()
			remote, err := sshClient.Dial("tcp", remoteAddr)
			if err != nil {
				log.Printf("[PortForward] Failed to dial remote: %v", err)
				return
			}
			defer remote.Close()

			// Bidirectional copy
			done := make(chan struct{}, 2)
			go func() {
				io.Copy(remote, conn)
				done <- struct{}{}
			}()
			go func() {
				io.Copy(conn, remote)
				done <- struct{}{}
			}()
			<-done
		}(conn)
	}
}

// Remote port forwarding: listen on remote, forward to local
func runRemoteForward(ctx context.Context, sshClient *ssh.Client, pf *storage.PortForward) {
	bindAddr := pf.BindAddr
	if bindAddr == "" {
		bindAddr = "127.0.0.1"
	}
	remoteAddr := fmt.Sprintf("%s:%d", bindAddr, pf.RemotePort)
	localAddr := fmt.Sprintf("127.0.0.1:%d", pf.LocalPort)

	listener, err := sshClient.Listen("tcp", remoteAddr)
	if err != nil {
		log.Printf("[PortForward] Failed to listen on remote %s: %v", remoteAddr, err)
		return
	}
	defer listener.Close()

	log.Printf("[PortForward] Remote forward started: %s -> %s", remoteAddr, localAddr)

	go func() {
		<-ctx.Done()
		listener.Close()
	}()

	for {
		conn, err := listener.Accept()
		if err != nil {
			select {
			case <-ctx.Done():
				return
			default:
				log.Printf("[PortForward] Accept error: %v", err)
				continue
			}
		}

		go func(conn net.Conn) {
			defer conn.Close()
			local, err := net.Dial("tcp", localAddr)
			if err != nil {
				log.Printf("[PortForward] Failed to dial local: %v", err)
				return
			}
			defer local.Close()

			// Bidirectional copy
			done := make(chan struct{}, 2)
			go func() {
				io.Copy(local, conn)
				done <- struct{}{}
			}()
			go func() {
				io.Copy(conn, local)
				done <- struct{}{}
			}()
			<-done
		}(conn)
	}
}

// Dynamic port forwarding: SOCKS5 proxy
func runDynamicForward(ctx context.Context, sshClient *ssh.Client, pf *storage.PortForward) {
	bindAddr := pf.BindAddr
	if bindAddr == "" {
		bindAddr = "127.0.0.1"
	}
	localAddr := fmt.Sprintf("%s:%d", bindAddr, pf.LocalPort)

	listener, err := net.Listen("tcp", localAddr)
	if err != nil {
		log.Printf("[PortForward] Failed to listen on %s: %v", localAddr, err)
		return
	}
	defer listener.Close()

	log.Printf("[PortForward] Dynamic (SOCKS5) forward started on %s", localAddr)

	go func() {
		<-ctx.Done()
		listener.Close()
	}()

	for {
		conn, err := listener.Accept()
		if err != nil {
			select {
			case <-ctx.Done():
				return
			default:
				continue
			}
		}

		go handleSOCKS5(conn, sshClient)
	}
}

// Simple SOCKS5 handler
func handleSOCKS5(conn net.Conn, sshClient *ssh.Client) {
	defer conn.Close()

	// Read SOCKS5 greeting
	buf := make([]byte, 256)
	n, err := conn.Read(buf)
	if err != nil || n < 2 || buf[0] != 0x05 {
		return
	}

	// Send no-auth response
	conn.Write([]byte{0x05, 0x00})

	// Read connect request
	n, err = conn.Read(buf)
	if err != nil || n < 7 || buf[0] != 0x05 || buf[1] != 0x01 {
		return
	}

	var targetAddr string
	var targetPort int

	switch buf[3] {
	case 0x01: // IPv4
		if n < 10 {
			return
		}
		targetAddr = fmt.Sprintf("%d.%d.%d.%d", buf[4], buf[5], buf[6], buf[7])
		targetPort = int(buf[8])<<8 | int(buf[9])
	case 0x03: // Domain
		domainLen := int(buf[4])
		if n < 5+domainLen+2 {
			return
		}
		targetAddr = string(buf[5 : 5+domainLen])
		targetPort = int(buf[5+domainLen])<<8 | int(buf[6+domainLen])
	case 0x04: // IPv6
		if n < 22 {
			return
		}
		targetAddr = fmt.Sprintf("[%x:%x:%x:%x:%x:%x:%x:%x]",
			uint16(buf[4])<<8|uint16(buf[5]), uint16(buf[6])<<8|uint16(buf[7]),
			uint16(buf[8])<<8|uint16(buf[9]), uint16(buf[10])<<8|uint16(buf[11]),
			uint16(buf[12])<<8|uint16(buf[13]), uint16(buf[14])<<8|uint16(buf[15]),
			uint16(buf[16])<<8|uint16(buf[17]), uint16(buf[18])<<8|uint16(buf[19]))
		targetPort = int(buf[20])<<8 | int(buf[21])
	default:
		return
	}

	// Connect via SSH
	remote, err := sshClient.Dial("tcp", fmt.Sprintf("%s:%d", targetAddr, targetPort))
	if err != nil {
		conn.Write([]byte{0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0})
		return
	}
	defer remote.Close()

	// Send success response
	conn.Write([]byte{0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0})

	// Bidirectional copy
	done := make(chan struct{}, 2)
	go func() {
		io.Copy(remote, conn)
		done <- struct{}{}
	}()
	go func() {
		io.Copy(conn, remote)
		done <- struct{}{}
	}()
	<-done
}

// ========================================
// Settings Handlers
// ========================================

func getSettings(w http.ResponseWriter, r *http.Request) {
	settings := store.GetSettings()
	json.NewEncoder(w).Encode(settings)
}

func saveSettings(w http.ResponseWriter, r *http.Request) {
	var settings storage.Settings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := store.SaveSettings(settings); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(settings)
}

// ========================================
// SSH WebSocket Handler
// ========================================

func handleSSHWebSocket(w http.ResponseWriter, r *http.Request) {
	log.Printf("Incoming SSH WebSocket request: %s", r.URL.Path)
	vars := mux.Vars(r)
	hostID := vars["hostId"]

	// Extract token from query parameter
	tokenString := r.URL.Query().Get("token")
	if tokenString == "" {
		http.Error(w, "Token required", http.StatusUnauthorized)
		return
	}

	claims, err := auth.ValidateToken(tokenString)
	if err != nil {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}
	userID := claims.UserID

	host, err := store.GetHost(hostID, userID)
	if err != nil || host == nil {
		http.Error(w, "Host not found", http.StatusNotFound)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	// Update last connected time
	store.UpdateHostLastConnected(hostID, userID)

	// Create SSH config
	config := &sshclient.ConnectionConfig{
		ID:              host.ID,
		Address:         host.Address,
		Port:            host.Port,
		Username:        host.Username,
		AuthMethod:      host.AuthMethod,
		Password:        host.Password,
		PrivateKeyPath:  host.SSHKeyPath,
		PrivateKey:      host.SSHKey,
		Passphrase:      host.Passphrase,
		HostChecking:    host.HostChecking,
		AgentForwarding: host.AgentForwarding,
		StartupCommand:  host.StartupCommand,
	}

	// Handle SSH session over WebSocket
	sshManager.HandleWebSocket(conn, config)
}

func handleLocalShellWebSocket(w http.ResponseWriter, r *http.Request) {
	// Local shell also requires auth!
	tokenString := r.URL.Query().Get("token")
	if tokenString == "" {
		http.Error(w, "Token required", http.StatusUnauthorized)
		return
	}
	if _, err := auth.ValidateToken(tokenString); err != nil {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	log.Printf("Incoming Local Shell WebSocket request: %s", r.URL.Path)
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	// Always use bash for consistent terminal experience (avoids Starship/zsh issues)
	// Use --noprofile --norc to avoid loading system configs that print banners
	// Use -i to force interactive mode (fixes "can't type" issues and prompt behavior)
	shell := "/bin/bash"
	args := []string{"--noprofile", "--norc", "-i"}

	c := exec.Command(shell, args...)

	// Create a clean environment
	// We deliberately do NOT include os.Environ() to avoid loading ENV/BASH_ENV/PROMPT_COMMAND
	c.Env = []string{
		"TERM=xterm-256color",
		"PS1=\\[\\e[1;32m\\]\\u@\\h\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]$ ",
		"PATH=" + os.Getenv("PATH"), // Keep PATH so commands work
		"HOME=" + os.Getenv("HOME"), // Keep HOME
		"LANG=en_US.UTF-8",          // Ensure UTF-8
	}
	f, err := pty.Start(c)
	if err != nil {
		log.Printf("PTY start failed: %v", err)
		return
	}
	defer f.Close()

	// Handle output
	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := f.Read(buf)
			if n > 0 {
				msg := map[string]string{
					"type": "output",
					"data": string(buf[:n]),
				}
				jsonMsg, _ := json.Marshal(msg)
				if err := conn.WriteMessage(websocket.TextMessage, jsonMsg); err != nil {
					return
				}
			}
			if err != nil {
				return
			}
		}
	}()

	// Handle input
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var req map[string]interface{}
		if err := json.Unmarshal(message, &req); err != nil {
			continue
		}

		switch req["type"] {
		case "input":
			if data, ok := req["data"].(string); ok {
				if _, err := f.Write([]byte(data)); err != nil {
					log.Printf("Failed to write to PTY: %v", err)
				}
			}
		case "resize":
			if cols, ok := req["cols"].(float64); ok {
				if rows, ok := req["rows"].(float64); ok {
					pty.Setsize(f, &pty.Winsize{
						Cols: uint16(cols),
						Rows: uint16(rows),
					})
				}
			}
		}
	}

	c.Process.Kill()
}

// ========================================
// SFTP Handlers
// ========================================

func getSFTPClient(hostID, userID string) (*sftp.Client, error) {
	log.Printf("[SFTP] Getting SFTP client for hostID=%s, userID=%s", hostID, userID)
	
	host, err := store.GetHost(hostID, userID)
	if err != nil {
		log.Printf("[SFTP] Error getting host: %v", err)
		return nil, fmt.Errorf("host not found: %v", err)
	}
	if host == nil {
		log.Printf("[SFTP] Host is nil for hostID=%s", hostID)
		return nil, fmt.Errorf("host not found")
	}

	log.Printf("[SFTP] Connecting to %s@%s:%d", host.Username, host.Address, host.Port)
	
	config := &sftp.ConnectionConfig{
		Address:        host.Address,
		Port:           host.Port,
		Username:       host.Username,
		Password:       host.Password,
		PrivateKeyPath: host.SSHKeyPath,
		PrivateKey:     host.SSHKey,
	}

	client, err := sftp.NewClient(config)
	if err != nil {
		log.Printf("[SFTP] Failed to create SFTP client: %v", err)
		return nil, err
	}
	
	log.Printf("[SFTP] Connected successfully")
	return client, nil
}

func sftpList(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	path := r.URL.Query().Get("path")
	if path == "" {
		path = "~"
	}
	
	log.Printf("[SFTP] Listing directory: %s", path)

	client, err := getSFTPClient(vars["hostId"], userID)
	if err != nil {
		log.Printf("[SFTP] Failed to get client: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer client.Close()

	files, err := client.ListDir(path)
	if err != nil {
		log.Printf("[SFTP] ListDir error for path '%s': %v", path, err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	log.Printf("[SFTP] Listed %d files in %s", len(files), path)

	json.NewEncoder(w).Encode(files)
}

func sftpMkdir(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	var req struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	client, err := getSFTPClient(vars["hostId"], userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer client.Close()

	if err := client.Mkdir(req.Path); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func sftpDelete(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	path := r.URL.Query().Get("path")

	client, err := getSFTPClient(vars["hostId"], userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer client.Close()

	if err := client.RemoveAll(path); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func sftpRename(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	var req struct {
		OldPath string `json:"old_path"`
		NewPath string `json:"new_path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	client, err := getSFTPClient(vars["hostId"], userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer client.Close()

	if err := client.Rename(req.OldPath, req.NewPath); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func sftpDownload(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	path := r.URL.Query().Get("path")

	client, err := getSFTPClient(vars["hostId"], userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer client.Close()

	data, err := client.ReadFile(path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filepath.Base(path)))
	w.Write(data)
}

func sftpUpload(w http.ResponseWriter, r *http.Request) {
	// Handle multipart file upload
	http.Error(w, "Not implemented - use WebSocket for large files", http.StatusNotImplemented)
}

// ========================================
// SFTP Transfer Handler
// ========================================
func sftpTransfer(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		SourceHost string `json:"source_host"`
		SourcePath string `json:"source_path"`
		DestHost   string `json:"dest_host"`
		DestPath   string `json:"dest_path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("[Transfer] %s:%s -> %s:%s", req.SourceHost, req.SourcePath, req.DestHost, req.DestPath)

	isSourceLocal := req.SourceHost == "local" || req.SourceHost == ""
	isDestLocal := req.DestHost == "local" || req.DestHost == ""

	// Local to Local
	if isSourceLocal && isDestLocal {
		input, err := os.ReadFile(req.SourcePath)
		if err != nil {
			http.Error(w, "Failed to read source: "+err.Error(), http.StatusInternalServerError)
			return
		}
		if err := os.WriteFile(req.DestPath, input, 0644); err != nil {
			http.Error(w, "Failed to write destination: "+err.Error(), http.StatusInternalServerError)
			return
		}
		log.Printf("[Transfer] Local->Local completed")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		return
	}

	// Local to Remote (Upload)
	if isSourceLocal && !isDestLocal {
		client, err := getSFTPClient(req.DestHost, userID)
		if err != nil {
			log.Printf("[Transfer] Failed to connect to dest: %v", err)
			http.Error(w, "Failed to connect to destination: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Read local file
		data, err := os.ReadFile(req.SourcePath)
		if err != nil {
			log.Printf("[Transfer] Failed to read local file: %v", err)
			http.Error(w, "Failed to read source file: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Write to remote
		if err := client.WriteFile(req.DestPath, data); err != nil {
			log.Printf("[Transfer] Failed to write remote file: %v", err)
			http.Error(w, "Failed to write to destination: "+err.Error(), http.StatusInternalServerError)
			return
		}

		log.Printf("[Transfer] Local->Remote completed: %d bytes", len(data))
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		return
	}

	// Remote to Local (Download)
	if !isSourceLocal && isDestLocal {
		client, err := getSFTPClient(req.SourceHost, userID)
		if err != nil {
			log.Printf("[Transfer] Failed to connect to source: %v", err)
			http.Error(w, "Failed to connect to source: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer client.Close()

		// Read remote file
		data, err := client.ReadFile(req.SourcePath)
		if err != nil {
			log.Printf("[Transfer] Failed to read remote file: %v", err)
			http.Error(w, "Failed to read source file: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Ensure destination directory exists
		destDir := filepath.Dir(req.DestPath)
		if err := os.MkdirAll(destDir, 0755); err != nil {
			log.Printf("[Transfer] Failed to create dest dir: %v", err)
			http.Error(w, "Failed to create destination directory: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Write to local
		if err := os.WriteFile(req.DestPath, data, 0644); err != nil {
			log.Printf("[Transfer] Failed to write local file: %v", err)
			http.Error(w, "Failed to write to destination: "+err.Error(), http.StatusInternalServerError)
			return
		}

		log.Printf("[Transfer] Remote->Local completed: %d bytes", len(data))
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		return
	}

	// Remote to Remote
	if !isSourceLocal && !isDestLocal {
		// Connect to source
		srcClient, err := getSFTPClient(req.SourceHost, userID)
		if err != nil {
			log.Printf("[Transfer] Failed to connect to source: %v", err)
			http.Error(w, "Failed to connect to source: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer srcClient.Close()

		// Connect to destination
		destClient, err := getSFTPClient(req.DestHost, userID)
		if err != nil {
			log.Printf("[Transfer] Failed to connect to dest: %v", err)
			http.Error(w, "Failed to connect to destination: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer destClient.Close()

		// Read from source
		data, err := srcClient.ReadFile(req.SourcePath)
		if err != nil {
			log.Printf("[Transfer] Failed to read from source: %v", err)
			http.Error(w, "Failed to read source file: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Write to destination
		if err := destClient.WriteFile(req.DestPath, data); err != nil {
			log.Printf("[Transfer] Failed to write to dest: %v", err)
			http.Error(w, "Failed to write to destination: "+err.Error(), http.StatusInternalServerError)
			return
		}

		log.Printf("[Transfer] Remote->Remote completed: %d bytes", len(data))
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		return
	}

	http.Error(w, "Invalid transfer configuration", http.StatusBadRequest)
}

// ========================================
// SFTP Streaming Transfer Handler (SSE)
// ========================================
func sftpTransferStream(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		SourceHost string `json:"source_host"`
		SourcePath string `json:"source_path"`
		DestHost   string `json:"dest_host"`
		DestPath   string `json:"dest_path"`
		TransferID string `json:"transfer_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	sendProgress := func(transferred, total int64, status string, errMsg string) {
		percent := float64(0)
		if total > 0 {
			percent = float64(transferred) / float64(total) * 100
		}
		data := map[string]interface{}{
			"transfer_id": req.TransferID,
			"transferred": transferred,
			"total":       total,
			"percent":     percent,
			"status":      status,
			"error":       errMsg,
		}
		jsonData, _ := json.Marshal(data)
		fmt.Fprintf(w, "data: %s\n\n", jsonData)
		flusher.Flush()
	}

	log.Printf("[StreamTransfer] %s:%s -> %s:%s", req.SourceHost, req.SourcePath, req.DestHost, req.DestPath)

	// Create a cancellation channel that will be closed when context is done
	ctx := r.Context()
	cancelled := make(chan struct{})
	go func() {
		<-ctx.Done()
		close(cancelled)
		log.Printf("[StreamTransfer] Context cancelled, transfer will be stopped")
	}()

	// Helper to check if cancelled
	isCancelled := func() bool {
		select {
		case <-cancelled:
			return true
		default:
			return false
		}
	}

	isSourceLocal := req.SourceHost == "local" || req.SourceHost == ""
	isDestLocal := req.DestHost == "local" || req.DestHost == ""

	// Local to Remote (Upload with progress)
	if isSourceLocal && !isDestLocal {
		// Get file info first
		fileInfo, err := os.Stat(req.SourcePath)
		if err != nil {
			sendProgress(0, 0, "failed", "Failed to stat source file: "+err.Error())
			return
		}
		totalSize := fileInfo.Size()
		sendProgress(0, totalSize, "connecting", "")

		client, err := getSFTPClient(req.DestHost, userID)
		if err != nil {
			sendProgress(0, totalSize, "failed", "Failed to connect: "+err.Error())
			return
		}
		defer client.Close()

		sendProgress(0, totalSize, "transferring", "")

		// Open source file
		srcFile, err := os.Open(req.SourcePath)
		if err != nil {
			sendProgress(0, totalSize, "failed", "Failed to open source: "+err.Error())
			return
		}
		defer srcFile.Close()

		// Create destination file on remote
		dstFile, err := client.Create(req.DestPath)
		if err != nil {
			sendProgress(0, totalSize, "failed", "Failed to create destination: "+err.Error())
			return
		}
		defer dstFile.Close()

		// Copy with progress tracking
		buf := make([]byte, 32*1024) // 32KB buffer
		var transferred int64 = 0
		lastUpdate := time.Now()

		for {
			// Check if client disconnected
			if isCancelled() {
				log.Printf("[StreamTransfer] Transfer cancelled by client (Local->Remote)")
				sendProgress(transferred, totalSize, "failed", "Cancelled by user")
				return
			}

			n, err := srcFile.Read(buf)
			if n > 0 {
				written, werr := dstFile.Write(buf[:n])
				if werr != nil {
					sendProgress(transferred, totalSize, "failed", "Write error: "+werr.Error())
					return
				}
				transferred += int64(written)

				// Send progress update every 100ms or every 1MB
				if time.Since(lastUpdate) > 100*time.Millisecond || transferred-transferred%(1024*1024) == 0 {
					sendProgress(transferred, totalSize, "transferring", "")
					lastUpdate = time.Now()
				}
			}
			if err == io.EOF {
				break
			}
			if err != nil {
				sendProgress(transferred, totalSize, "failed", "Read error: "+err.Error())
				return
			}
		}

		sendProgress(totalSize, totalSize, "completed", "")
		log.Printf("[StreamTransfer] Local->Remote completed: %d bytes", totalSize)
		return
	}

	// Remote to Local (Download with progress)
	if !isSourceLocal && isDestLocal {
		client, err := getSFTPClient(req.SourceHost, userID)
		if err != nil {
			sendProgress(0, 0, "failed", "Failed to connect: "+err.Error())
			return
		}
		defer client.Close()

		// Get remote file info
		remoteInfo, err := client.Stat(req.SourcePath)
		if err != nil {
			sendProgress(0, 0, "failed", "Failed to stat remote file: "+err.Error())
			return
		}
		totalSize := remoteInfo.Size

		sendProgress(0, totalSize, "transferring", "")

		// Open remote file
		srcFile, err := client.Open(req.SourcePath)
		if err != nil {
			sendProgress(0, totalSize, "failed", "Failed to open remote file: "+err.Error())
			return
		}
		defer srcFile.Close()

		// Ensure destination directory exists
		destDir := filepath.Dir(req.DestPath)
		if err := os.MkdirAll(destDir, 0755); err != nil {
			sendProgress(0, totalSize, "failed", "Failed to create dest dir: "+err.Error())
			return
		}

		// Create local file
		dstFile, err := os.Create(req.DestPath)
		if err != nil {
			sendProgress(0, totalSize, "failed", "Failed to create local file: "+err.Error())
			return
		}
		defer dstFile.Close()

		// Copy with progress tracking
		buf := make([]byte, 32*1024)
		var transferred int64 = 0
		lastUpdate := time.Now()

		for {
			// Check if client disconnected
			if isCancelled() {
				log.Printf("[StreamTransfer] Transfer cancelled by client (Remote->Local)")
				sendProgress(transferred, totalSize, "failed", "Cancelled by user")
				return
			}

			n, err := srcFile.Read(buf)
			if n > 0 {
				written, werr := dstFile.Write(buf[:n])
				if werr != nil {
					sendProgress(transferred, totalSize, "failed", "Write error: "+werr.Error())
					return
				}
				transferred += int64(written)

				if time.Since(lastUpdate) > 100*time.Millisecond {
					sendProgress(transferred, totalSize, "transferring", "")
					lastUpdate = time.Now()
				}
			}
			if err == io.EOF {
				break
			}
			if err != nil {
				sendProgress(transferred, totalSize, "failed", "Read error: "+err.Error())
				return
			}
		}

		sendProgress(totalSize, totalSize, "completed", "")
		log.Printf("[StreamTransfer] Remote->Local completed: %d bytes", totalSize)
		return
	}

	// Remote to Remote
	if !isSourceLocal && !isDestLocal {
		srcClient, err := getSFTPClient(req.SourceHost, userID)
		if err != nil {
			sendProgress(0, 0, "failed", "Failed to connect to source: "+err.Error())
			return
		}
		defer srcClient.Close()

		destClient, err := getSFTPClient(req.DestHost, userID)
		if err != nil {
			sendProgress(0, 0, "failed", "Failed to connect to dest: "+err.Error())
			return
		}
		defer destClient.Close()

		remoteInfo, err := srcClient.Stat(req.SourcePath)
		if err != nil {
			sendProgress(0, 0, "failed", "Failed to stat source: "+err.Error())
			return
		}
		totalSize := remoteInfo.Size

		sendProgress(0, totalSize, "transferring", "")

		srcFile, err := srcClient.Open(req.SourcePath)
		if err != nil {
			sendProgress(0, totalSize, "failed", "Failed to open source: "+err.Error())
			return
		}
		defer srcFile.Close()

		dstFile, err := destClient.Create(req.DestPath)
		if err != nil {
			sendProgress(0, totalSize, "failed", "Failed to create dest: "+err.Error())
			return
		}
		defer dstFile.Close()

		buf := make([]byte, 32*1024)
		var transferred int64 = 0
		lastUpdate := time.Now()

		for {
			// Check if client disconnected
			if isCancelled() {
				log.Printf("[StreamTransfer] Transfer cancelled by client (Remote->Remote)")
				sendProgress(transferred, totalSize, "failed", "Cancelled by user")
				return
			}

			n, err := srcFile.Read(buf)
			if n > 0 {
				written, werr := dstFile.Write(buf[:n])
				if werr != nil {
					sendProgress(transferred, totalSize, "failed", "Write error: "+werr.Error())
					return
				}
				transferred += int64(written)

				if time.Since(lastUpdate) > 100*time.Millisecond {
					sendProgress(transferred, totalSize, "transferring", "")
					lastUpdate = time.Now()
				}
			}
			if err == io.EOF {
				break
			}
			if err != nil {
				sendProgress(transferred, totalSize, "failed", "Read error: "+err.Error())
				return
			}
		}

		sendProgress(totalSize, totalSize, "completed", "")
		log.Printf("[StreamTransfer] Remote->Remote completed: %d bytes", totalSize)
		return
	}

	// Local to Local
	if isSourceLocal && isDestLocal {
		fileInfo, err := os.Stat(req.SourcePath)
		if err != nil {
			sendProgress(0, 0, "failed", "Failed to stat source: "+err.Error())
			return
		}
		totalSize := fileInfo.Size()

		sendProgress(0, totalSize, "transferring", "")

		srcFile, err := os.Open(req.SourcePath)
		if err != nil {
			sendProgress(0, totalSize, "failed", "Failed to open source: "+err.Error())
			return
		}
		defer srcFile.Close()

		dstFile, err := os.Create(req.DestPath)
		if err != nil {
			sendProgress(0, totalSize, "failed", "Failed to create dest: "+err.Error())
			return
		}
		defer dstFile.Close()

		buf := make([]byte, 32*1024)
		var transferred int64 = 0
		lastUpdate := time.Now()

		for {
			// Check if client disconnected
			if isCancelled() {
				log.Printf("[StreamTransfer] Transfer cancelled by client (Local->Local)")
				sendProgress(transferred, totalSize, "failed", "Cancelled by user")
				return
			}

			n, err := srcFile.Read(buf)
			if n > 0 {
				written, werr := dstFile.Write(buf[:n])
				if werr != nil {
					sendProgress(transferred, totalSize, "failed", "Write error: "+werr.Error())
					return
				}
				transferred += int64(written)

				if time.Since(lastUpdate) > 100*time.Millisecond {
					sendProgress(transferred, totalSize, "transferring", "")
					lastUpdate = time.Now()
				}
			}
			if err == io.EOF {
				break
			}
			if err != nil {
				sendProgress(transferred, totalSize, "failed", "Read error: "+err.Error())
				return
			}
		}

		sendProgress(totalSize, totalSize, "completed", "")
		return
	}

	sendProgress(0, 0, "failed", "Invalid transfer configuration")
}

// ========================================
// Local Filesystem Handlers
// ========================================
type FileInfo struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	IsDir   bool   `json:"is_dir"`
	Size    int64  `json:"size"`
	ModTime string `json:"mod_time"`
}

func localList(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		path = "/"
	}

	entries, err := os.ReadDir(path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var files []FileInfo
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		files = append(files, FileInfo{
			Name:    entry.Name(),
			Path:    filepath.Join(path, entry.Name()),
			IsDir:   entry.IsDir(),
			Size:    info.Size(),
			ModTime: info.ModTime().Format("2006-01-02T15:04:05Z"),
		})
	}

	json.NewEncoder(w).Encode(files)
}

func localMkdir(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := os.MkdirAll(req.Path, 0755); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func localDelete(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, "path required", http.StatusBadRequest)
		return
	}

	if err := os.RemoveAll(path); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func localUpload(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	file, handler, err := r.FormFile("file")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	destPath := r.FormValue("path")
	if destPath == "" {
		destPath = "/"
	}

	destFile := filepath.Join(destPath, handler.Filename)
	out, err := os.Create(destFile)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer out.Close()

	buf := make([]byte, 1024*1024)
	for {
		n, err := file.Read(buf)
		if n > 0 {
			out.Write(buf[:n])
		}
		if err != nil {
			break
		}
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "path": destFile})
}

// ========================================
// Quick Action Handlers
// ========================================

type actionRequest struct {
	HostID       string            `json:"host_id"`
	HostIDs      []string          `json:"host_ids"`
	Command      string            `json:"command"`
	Packages     []string          `json:"packages"`
	DryRun       bool              `json:"dry_run"`
	Service      string            `json:"service"`
	Action       string            `json:"action"`
	Username     string            `json:"username"`
	Options      map[string]string `json:"options"`
	Groups       []string          `json:"groups"`
	Target       string            `json:"target"`
	Count        int               `json:"count"`
	Lines        int               `json:"lines"`
	LogType      string            `json:"log_type"`
	Pattern      string            `json:"pattern"`
	LogFile      string            `json:"log_file"`
	All          bool              `json:"all"`
	SudoPassword string            `json:"sudo_password"`
	Stream       bool              `json:"stream"`
	Runtime      string            `json:"runtime"`
	ContainerID  string            `json:"container_id"`
	ImageIDs     []string          `json:"image_ids"`
	User         string            `json:"user"`
}

func getHostConfig(hostID, userID string) (*actions.HostConfig, error) {
	host, err := store.GetHost(hostID, userID)
	if err != nil || host == nil {
		return nil, fmt.Errorf("host not found")
	}

	// Decrypt password if vault is unlocked
	password := host.Password
	if vaultService != nil && vaultService.IsUnlocked() && password != "" {
		if decrypted, err := vaultService.Decrypt(password); err == nil {
			password = decrypted
		}
	}

	// Decrypt passphrase if vault is unlocked
	passphrase := host.Passphrase
	if vaultService != nil && vaultService.IsUnlocked() && passphrase != "" {
		if decrypted, err := vaultService.Decrypt(passphrase); err == nil {
			passphrase = decrypted
		}
	}

	return &actions.HostConfig{
		ID:         host.ID,
		Label:      host.Label,
		Address:    host.Address,
		Port:       host.Port,
		Username:   host.Username,
		Password:   password,
		KeyPath:    host.SSHKeyPath,
		Passphrase: passphrase,
	}, nil
}

func executeCommand(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Support local execution when host_id is "local" or empty
	if isLocalHost(req.HostID) {
		output, err := executeLocalCommand(req.Command)
		result := map[string]string{"output": output}
		if err != nil {
			result["error"] = err.Error()
		}
		json.NewEncoder(w).Encode(result)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	result := executor.ExecuteCommand(hostConfig, req.Command)
	json.NewEncoder(w).Encode(result)
}

// executeLocalCommand runs a command on the local machine
func executeLocalCommand(command string) (string, error) {
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
	}
	cmd := exec.Command(shell, "-c", command)
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// executeLocalCommandWithInput runs a command on the local machine, providing input to stdin
func executeLocalCommandWithInput(command string, input string) (string, error) {
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
	}
	cmd := exec.Command(shell, "-c", command)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return "", fmt.Errorf("failed to get stdin pipe: %w", err)
	}

	go func() {
		defer stdin.Close()
		io.WriteString(stdin, input)
	}()

	output, err := cmd.CombinedOutput()
	return string(output), err
}

// streamLocalCommand runs a command and streams output to the response writer
func streamLocalCommand(w http.ResponseWriter, command string, input string) {
	// Set headers for streaming
	w.Header().Set("Content-Type", "text/plain")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
	}

	// Use pty to get unbuffered output
	c := exec.Command(shell, "-c", command)
	f, err := pty.Start(c)
	if err != nil {
		fmt.Fprintf(w, "Error starting command: %v\n", err)
		return
	}
	defer f.Close()

	// Handle input (password) if provided
	if input != "" {
		go func() {
			time.Sleep(500 * time.Millisecond) // Wait for sudo to initialize and flush buffers
			io.WriteString(f, input)
		}()
	}

	// Copy output to response writer and flush
	buf := make([]byte, 1024)
	for {
		n, err := f.Read(buf)
		if n > 0 {
			w.Write(buf[:n])
			flusher.Flush()
		}
		if err != nil {
			if err != io.EOF {
				// Don't report read errors triggered by command exit as failures
				// Linux pty returns EIO when the process closes, which is normal
				if !strings.Contains(err.Error(), "input/output error") {
					fmt.Fprintf(w, "\nError reading output: %v\n", err)
				}
			}
			break
		}
	}

	// Wait for command to finish to ensure process cleanup
	c.Wait()
}

func executeMultiCommand(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var hostConfigs []*actions.HostConfig
	for _, id := range req.HostIDs {
		if cfg, err := getHostConfig(id, userID); err == nil {
			hostConfigs = append(hostConfigs, cfg)
		}
	}

	results := executor.ExecuteMulti(hostConfigs, req.Command)
	json.NewEncoder(w).Encode(results)
}

func detectPackageManager(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Support local package manager detection
	if isLocalHost(req.HostID) {
		pm, err := detectLocalPackageManager()
		if err != nil {
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"package_manager": string(pm)})
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	pm, err := executor.DetectPackageManager(hostConfig)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"package_manager": string(pm)})
}

func detectLocalPackageManager() (actions.PackageManagerType, error) {
	// 1. Check for Distro Specific Files first (More reliable)
	if _, err := os.Stat("/etc/arch-release"); err == nil {
		return actions.PMTypePacman, nil
	}
	if _, err := os.Stat("/etc/debian_version"); err == nil {
		return actions.PMTypeApt, nil
	}
	if _, err := os.Stat("/etc/alpine-release"); err == nil {
		return actions.PMTypeApk, nil
	}
	if _, err := os.Stat("/etc/fedora-release"); err == nil {
		return actions.PMTypeDnf, nil // defaulting to dnf for fedora
	}
	if _, err := os.Stat("/etc/redhat-release"); err == nil {
		// check for dnf binary, otherwise yum
		output, _ := executeLocalCommand("which dnf")
		if output != "" {
			return actions.PMTypeDnf, nil
		}
		return actions.PMTypeYum, nil
	}

	// 2. Fallback to binary detection
	output, err := executeLocalCommand("which apt-get yum dnf pacman apk zypper 2>/dev/null | head -1")
	if err != nil || output == "" {
		return "", fmt.Errorf("failed to detect package manager")
	}

	output = strings.TrimSpace(output)
	if strings.Contains(output, "apt") {
		return actions.PMTypeApt, nil
	} else if strings.Contains(output, "dnf") {
		return actions.PMTypeDnf, nil
	} else if strings.Contains(output, "yum") {
		return actions.PMTypeYum, nil
	} else if strings.Contains(output, "pacman") {
		return actions.PMTypePacman, nil
	} else if strings.Contains(output, "apk") {
		return actions.PMTypeApk, nil
	} else if strings.Contains(output, "zypper") {
		return actions.PMTypeZypper, nil
	}

	return "", fmt.Errorf("unknown package manager: %s", output)
}

func packageInstall(w http.ResponseWriter, r *http.Request) {
	handlePackageAction(w, r, actions.PkgInstall)
}

func packageRemove(w http.ResponseWriter, r *http.Request) {
	handlePackageAction(w, r, actions.PkgRemove)
}

func packageUpdate(w http.ResponseWriter, r *http.Request) {
	handlePackageAction(w, r, actions.PkgUpdate)
}

func packageSearch(w http.ResponseWriter, r *http.Request) {
	handlePackageAction(w, r, actions.PkgSearch)
}

func handlePackageAction(w http.ResponseWriter, r *http.Request, action actions.PackageAction) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Support local execution
	if isLocalHost(req.HostID) {
		pm, err := detectLocalPackageManager()
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
			return
		}

		// Build and execute command locally
		cmd := actions.BuildPackageCommand(pm, action, req.Packages, req.DryRun)

		var output string
		var execErr error

		// If password provided, use sudo -S
		if req.SudoPassword != "" {
			// Remove existing sudo if present to avoid double sudo
			cmd = strings.TrimPrefix(cmd, "sudo ")
			cmd = strings.TrimPrefix(cmd, "-n ")

			// Use sudo -S which reads password from stdin
			finalCmd := "sudo -S " + cmd

			if req.Stream {
				streamLocalCommand(w, finalCmd, req.SudoPassword+"\n")
				return
			}

			output, execErr = executeLocalCommandWithInput(finalCmd, req.SudoPassword+"\n")
		} else {
			// Standard passwordless attempt
			if !strings.HasPrefix(cmd, "sudo ") {
				cmd = "sudo -n " + cmd
			} else {
				cmd = strings.Replace(cmd, "sudo ", "sudo -n ", 1)
			}

			if req.Stream {
				streamLocalCommand(w, cmd, "")
				return
			}

			output, execErr = executeLocalCommand(cmd)
		}

		result := &actions.ActionResult{
			HostID:  "local",
			Success: execErr == nil,
			Output:  output,
		}
		if execErr != nil {
			result.Error = execErr.Error()
			// Return specific error if sudo failed due to permissions
			if strings.Contains(strings.ToLower(execErr.Error()), "exit status 1") ||
				strings.Contains(strings.ToLower(output), "password is required") {
				result.Error = "sudo: a password is required"
			}
		}

		json.NewEncoder(w).Encode(result)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Detect package manager
	pm, err := executor.DetectPackageManager(hostConfig)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	// Build and execute command
	cmd := actions.BuildPackageCommand(pm, action, req.Packages, req.DryRun)
	result := executor.ExecuteCommand(hostConfig, cmd)
	json.NewEncoder(w).Encode(result)
}

func listServices(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Support local services when host_id is "local" or empty
	if isLocalHost(req.HostID) {
		services := getLocalServices()
		json.NewEncoder(w).Encode(services)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	services, err := executor.ListServices(hostConfig)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(services)
}

// getLocalServices returns list of services from the local machine
func getLocalServices() []map[string]interface{} {
	var services []map[string]interface{}

	// Try systemctl first (systemd)
	output, err := executeLocalCommand("systemctl list-units --type=service --state=running,failed --no-pager --no-legend 2>/dev/null | head -30")
	if err == nil && len(output) > 0 {
		lines := strings.Split(output, "\n")
		for _, line := range lines {
			fields := strings.Fields(line)
			if len(fields) >= 4 {
				service := map[string]interface{}{
					"name":   strings.TrimSuffix(fields[0], ".service"),
					"status": fields[2],
					"active": fields[2] == "running",
					"sub":    fields[3],
				}
				services = append(services, service)
			}
		}
	}

	return services
}

func serviceStatus(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Support local services when host_id is "local" or empty
	if isLocalHost(req.HostID) {
		cmd := fmt.Sprintf("systemctl show %s --property=ActiveState,SubState,UnitFileState", req.Service)
		output, err := executeLocalCommand(cmd)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
			return
		}

		status := &actions.ServiceStatus{Name: req.Service}
		for _, line := range strings.Split(output, "\n") {
			parts := strings.SplitN(line, "=", 2)
			if len(parts) != 2 {
				continue
			}
			switch parts[0] {
			case "ActiveState":
				status.Status = parts[1]
				status.Active = parts[1] == "active"
			case "SubState":
				status.SubStatus = parts[1]
			case "UnitFileState":
				status.Enabled = parts[1] == "enabled"
			}
		}
		json.NewEncoder(w).Encode(status)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	status, err := executor.GetServiceStatus(hostConfig, req.Service)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(status)
}

func serviceControl(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Support local services
	if isLocalHost(req.HostID) {
		cmd := fmt.Sprintf("sudo -n systemctl %s %s", req.Action, req.Service)
		output, err := executeLocalCommand(cmd)

		result := &actions.ActionResult{
			HostID:  "local",
			Success: err == nil,
			Output:  output,
		}

		if err != nil {
			result.Error = err.Error()
		}

		json.NewEncoder(w).Encode(result)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	result := executor.ControlService(hostConfig, req.Service, actions.ServiceAction(req.Action))
	json.NewEncoder(w).Encode(result)
}

func listUsers(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Support local users when host_id is "local" or empty
	if isLocalHost(req.HostID) {
		users := getLocalUsers()
		json.NewEncoder(w).Encode(users)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	users, err := executor.ListUsers(hostConfig)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(users)
}

// getLocalUsers returns users from the local machine
func getLocalUsers() []map[string]interface{} {
	var users []map[string]interface{}

	// Get users from /etc/passwd
	output, err := executeLocalCommand("getent passwd | grep -E '(/bin/bash|/bin/zsh|/bin/sh)$'")
	if err != nil {
		return users
	}

	lines := strings.Split(output, "\n")
	for _, line := range lines {
		fields := strings.Split(line, ":")
		if len(fields) >= 7 {
			user := map[string]interface{}{
				"username": fields[0],
				"uid":      fields[2],
				"gid":      fields[3],
				"home":     fields[5],
				"shell":    fields[6],
			}

			// Check if user is currently logged in
			whoOutput, _ := executeLocalCommand(fmt.Sprintf("who | grep '^%s ' | wc -l", fields[0]))
			count := strings.TrimSpace(whoOutput)
			user["active"] = count != "0" && count != ""

			// Get user's groups
			groupsOutput, _ := executeLocalCommand(fmt.Sprintf("groups %s 2>/dev/null | cut -d':' -f2", fields[0]))
			user["groups"] = strings.TrimSpace(groupsOutput)

			users = append(users, user)
		}
	}

	return users
}

func createUser(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	result := executor.CreateUser(hostConfig, req.Username, req.Options)
	json.NewEncoder(w).Encode(result)
}

func deleteUser(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	removeHome := req.Options["remove_home"] == "true"
	result := executor.DeleteUser(hostConfig, req.Username, removeHome)
	json.NewEncoder(w).Encode(result)
}

func listGroups(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	groups, err := executor.ListGroups(hostConfig)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(groups)
}

func getUserGroups(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	groups, err := executor.GetUserGroups(hostConfig, req.Username)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"groups": groups})
}

func modifyUserGroups(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	result := executor.ModifyUserGroups(hostConfig, req.Username, req.Groups)
	json.NewEncoder(w).Encode(result)
}

func getMetrics(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Support local metrics when host_id is "local" or empty
	if isLocalHost(req.HostID) {
		metrics := getLocalMetrics()
		json.NewEncoder(w).Encode(metrics)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		log.Printf("[DEBUG] getMetrics: Failed to get host config for hostID=%s: %v", req.HostID, err)
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	log.Printf("[DEBUG] getMetrics: Got hostConfig - Address=%s, Port=%d, Username=%s, HasPassword=%v, KeyPath=%s",
		hostConfig.Address, hostConfig.Port, hostConfig.Username, hostConfig.Password != "", hostConfig.KeyPath)

	metrics, err := executor.GetSystemMetrics(hostConfig)
	if err != nil {
		log.Printf("[DEBUG] getMetrics: GetSystemMetrics error: %v", err)
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	log.Printf("[DEBUG] getMetrics: Success - Hostname=%s, CPU=%.1f, MemTotal=%d", metrics.Hostname, metrics.CPUUsage, metrics.MemoryTotal)

	json.NewEncoder(w).Encode(metrics)
}

// getLocalMetrics returns system metrics for the local machine
func getLocalMetrics() map[string]interface{} {
	metrics := make(map[string]interface{})

	// Get hostname
	hostname, _ := os.Hostname()
	metrics["hostname"] = hostname

	// Get CPU usage via command
	cpuOutput, _ := executeLocalCommand("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1")
	if cpuUsage, err := strconv.ParseFloat(strings.TrimSpace(cpuOutput), 64); err == nil {
		metrics["cpu_usage"] = cpuUsage
	} else {
		metrics["cpu_usage"] = 0.0
	}

	// Get memory info
	memOutput, _ := executeLocalCommand("free -b | grep Mem")
	memParts := strings.Fields(memOutput)
	if len(memParts) >= 3 {
		if total, err := strconv.ParseInt(memParts[1], 10, 64); err == nil {
			metrics["memory_total"] = total
		}
		if used, err := strconv.ParseInt(memParts[2], 10, 64); err == nil {
			metrics["memory_used"] = used
		}
	}

	// Get swap info
	swapOutput, _ := executeLocalCommand("free -b | grep Swap")
	swapParts := strings.Fields(swapOutput)
	if len(swapParts) >= 3 {
		if total, err := strconv.ParseInt(swapParts[1], 10, 64); err == nil {
			metrics["swap_total"] = total
		}
		if used, err := strconv.ParseInt(swapParts[2], 10, 64); err == nil {
			metrics["swap_used"] = used
		}
	}

	// Get uptime
	uptimeOutput, _ := executeLocalCommand("uptime -p")
	metrics["uptime"] = strings.TrimSpace(uptimeOutput)

	// Get load average
	loadOutput, _ := executeLocalCommand("cat /proc/loadavg | awk '{print $1, $2, $3}'")
	metrics["load_avg"] = strings.TrimSpace(loadOutput)

	// Get IP address (using ip addr which is more portable than hostname -I)
	ipOutput, _ := executeLocalCommand("ip -4 addr show scope global | grep inet | awk '{print $2}' | cut -d'/' -f1 | head -1")
	if strings.TrimSpace(ipOutput) == "" {
		// Fallback: try getting from /etc/hosts
		ipOutput, _ = executeLocalCommand("grep $(hostname) /etc/hosts | awk '{print $1}' | head -1")
	}
	if strings.TrimSpace(ipOutput) == "" {
		ipOutput = "127.0.0.1"
	}
	metrics["ip_address"] = strings.TrimSpace(ipOutput)

	// Get disk usage (root partition)
	diskOutput, _ := executeLocalCommand("df -B1 / | tail -1")
	diskParts := strings.Fields(diskOutput)
	if len(diskParts) >= 4 {
		if total, err := strconv.ParseInt(diskParts[1], 10, 64); err == nil {
			metrics["disk_total"] = total
		}
		if used, err := strconv.ParseInt(diskParts[2], 10, 64); err == nil {
			metrics["disk_used"] = used
		}
	}

	return metrics
}

func getLogs(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Support local logs when host_id is "local" or empty
	if isLocalHost(req.HostID) {
		logs := getLocalLogs(req.LogType, req.Lines)
		json.NewEncoder(w).Encode(logs)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	logs, err := executor.GetRecentLogs(hostConfig, req.LogType, req.Lines)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(logs)
}

// getLocalLogs returns recent logs from the local machine
func getLocalLogs(logType string, lines int) map[string]interface{} {
	if lines <= 0 {
		lines = 50
	}

	var cmd string
	switch logType {
	case "syslog":
		cmd = fmt.Sprintf("journalctl -n %d --no-pager 2>/dev/null || tail -n %d /var/log/syslog 2>/dev/null || echo 'Syslog not available'", lines, lines)
	case "auth":
		cmd = fmt.Sprintf("journalctl _COMM=sshd -n %d --no-pager 2>/dev/null || tail -n %d /var/log/auth.log 2>/dev/null || echo 'Auth log not available'", lines, lines)
	default:
		cmd = fmt.Sprintf("journalctl -n %d --no-pager 2>/dev/null || echo 'Logs not available'", lines)
	}

	output, err := executeLocalCommand(cmd)
	result := map[string]interface{}{"logs": output, "type": logType, "lines": lines}
	if err != nil {
		result["error"] = err.Error()
	}
	return result
}

func searchLogs(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	logs, err := executor.SearchLogs(hostConfig, req.Pattern, req.LogFile, req.Lines)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(logs)
}

func listContainers(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Support local containers when host_id is "local" or empty
	if isLocalHost(req.HostID) {
		containers := getLocalContainers(req.All)
		json.NewEncoder(w).Encode(containers)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	runtime := "docker"
	containers, err := executor.ListContainers(hostConfig, runtime)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(containers)
}

// getLocalContainers returns list of docker containers from the local machine
func getLocalContainers(all bool) []map[string]interface{} {
	var containers []map[string]interface{}

	allFlag := ""
	if all {
		allFlag = "-a"
	}

	output, err := executeLocalCommand(fmt.Sprintf("docker ps %s --format '{{.ID}}|{{.Image}}|{{.Names}}|{{.Status}}|{{.Ports}}' 2>/dev/null", allFlag))
	if err != nil {
		return containers
	}

	lines := strings.Split(output, "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}
		parts := strings.Split(line, "|")
		if len(parts) >= 4 {
			container := map[string]interface{}{
				"id":     parts[0],
				"image":  parts[1],
				"name":   parts[2],
				"status": parts[3],
			}
			if len(parts) >= 5 {
				container["ports"] = parts[4]
			}
			containers = append(containers, container)
		}
	}

	return containers
}

func containerAction(w http.ResponseWriter, r *http.Request) {
	var req struct {
		HostID      string `json:"host_id"`
		ContainerID string `json:"container_id"`
	}
	vars := mux.Vars(r)
	action := vars["action"]

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	runtime := "docker"
	result := executor.ContainerAction(hostConfig, runtime, req.ContainerID, action)
	json.NewEncoder(w).Encode(result)
}

func containerLogs(w http.ResponseWriter, r *http.Request) {
	var req struct {
		HostID      string `json:"host_id"`
		ContainerID string `json:"container_id"`
		Lines       int    `json:"lines"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	runtime := "docker"
	result := executor.GetContainerLogs(hostConfig, runtime, req.ContainerID, req.Lines)
	json.NewEncoder(w).Encode(result)
}

func pingHost(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	result := executor.Ping(hostConfig, req.Target, req.Count)
	json.NewEncoder(w).Encode(result)
}

func tracerouteHost(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	result := executor.Traceroute(hostConfig, req.Target)
	json.NewEncoder(w).Encode(result)
}

func netstatHost(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	result := executor.Netstat(hostConfig, req.Pattern)
	json.NewEncoder(w).Encode(result)
}

// Helper function
func parseInt(s string, defaultVal int) int {
	if v, err := strconv.Atoi(s); err == nil {
		return v
	}
	return defaultVal
}

// ========================================
// Container Management Handlers (New)
// ========================================

func detectContainerRuntime(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	runtime, err := executor.DetectContainerRuntime(hostConfig)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"installed": false, "error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"installed": true, "runtime": runtime})
}

func listContainersNew(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	runtime := req.Runtime
	if runtime == "" {
		runtime = "docker"
	}

	containers, err := executor.ListContainers(hostConfig, runtime)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(containers)
}

func containerActionNew(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	runtime := req.Runtime
	if runtime == "" {
		runtime = "docker"
	}

	result := executor.ContainerAction(hostConfig, runtime, req.ContainerID, req.Action)
	json.NewEncoder(w).Encode(result)
}

func listContainerImages(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	runtime := req.Runtime
	if runtime == "" {
		runtime = "docker"
	}

	images, err := executor.ListContainerImages(hostConfig, runtime)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(images)
}

func deleteContainerImages(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	runtime := req.Runtime
	if runtime == "" {
		runtime = "docker"
	}

	result := executor.DeleteContainerImages(hostConfig, runtime, req.ImageIDs)
	json.NewEncoder(w).Encode(result)
}

func containerSystemPrune(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	runtime := req.Runtime
	if runtime == "" {
		runtime = "docker"
	}

	result := executor.ContainerSystemPrune(hostConfig, runtime)
	json.NewEncoder(w).Encode(result)
}

// ========================================
// System Log Handlers
// ========================================

func getSyslog(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	lines := req.Lines
	if lines <= 0 {
		lines = 100
	}

	result := executor.GetSyslog(hostConfig, lines)
	json.NewEncoder(w).Encode(result)
}

func getAuthLog(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	lines := req.Lines
	if lines <= 0 {
		lines = 100
	}

	result := executor.GetAuthLog(hostConfig, lines)
	json.NewEncoder(w).Encode(result)
}

// ========================================
// Cron Jobs Handlers
// ========================================

func listCronJobs(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	user := req.User
	if user == "" {
		user = "current"
	}

	jobs, err := executor.ListCronJobs(hostConfig, user)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(jobs)
}

func addCronJob(w http.ResponseWriter, r *http.Request) {
	var req struct {
		HostID  string `json:"host_id"`
		User    string `json:"user"`
		Minute  string `json:"minute"`
		Hour    string `json:"hour"`
		Day     string `json:"day"`
		Month   string `json:"month"`
		Weekday string `json:"weekday"`
		Command string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	result := executor.AddCronJob(hostConfig, req.User, req.Minute, req.Hour, req.Day, req.Month, req.Weekday, req.Command)
	json.NewEncoder(w).Encode(result)
}

func deleteCronJob(w http.ResponseWriter, r *http.Request) {
	var req struct {
		HostID     string `json:"host_id"`
		User       string `json:"user"`
		LineNumber int    `json:"line_number"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	result := executor.DeleteCronJob(hostConfig, req.User, req.LineNumber)
	json.NewEncoder(w).Encode(result)
}

func browseDirectory(w http.ResponseWriter, r *http.Request) {
	var req struct {
		HostID string `json:"host_id"`
		Path   string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	result := executor.ListDirectory(hostConfig, req.Path)
	json.NewEncoder(w).Encode(result)
}

// ========================================
// Process Management Handlers
// ========================================

func listProcesses(w http.ResponseWriter, r *http.Request) {
	var req struct {
		HostID string `json:"host_id"`
		SortBy string `json:"sort_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	processes, err := executor.ListProcesses(hostConfig, req.SortBy)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(processes)
}

func killProcess(w http.ResponseWriter, r *http.Request) {
	var req struct {
		HostID string `json:"host_id"`
		PID    string `json:"pid"`
		Signal string `json:"signal"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	result := executor.KillProcess(hostConfig, req.PID, req.Signal)
	json.NewEncoder(w).Encode(result)
}

// ========================================
// Firewall Management Handlers
// ========================================

func getFirewallStatus(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	status, err := executor.GetFirewallStatus(hostConfig)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(status)
}

func addFirewallRule(w http.ResponseWriter, r *http.Request) {
	var req struct {
		HostID   string `json:"host_id"`
		Port     string `json:"port"`
		Protocol string `json:"protocol"`
		FromIP   string `json:"from_ip"`
		Action   string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	result := executor.AddFirewallRule(hostConfig, "", req.Port, req.Protocol, req.FromIP, req.Action)
	json.NewEncoder(w).Encode(result)
}

func deleteFirewallRule(w http.ResponseWriter, r *http.Request) {
	var req struct {
		HostID     string `json:"host_id"`
		RuleNumber int    `json:"rule_number"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	result := executor.DeleteFirewallRule(hostConfig, req.RuleNumber)
	json.NewEncoder(w).Encode(result)
}

func toggleFirewall(w http.ResponseWriter, r *http.Request) {
	var req struct {
		HostID string `json:"host_id"`
		Enable bool   `json:"enable"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hostConfig, err := getHostConfig(req.HostID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	result := executor.ToggleFirewall(hostConfig, req.Enable)
	json.NewEncoder(w).Encode(result)
}
