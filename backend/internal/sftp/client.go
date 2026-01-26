package sftp

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// FileInfo represents file metadata
type FileInfo struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Size        int64  `json:"size"`
	Mode        string `json:"mode"`
	ModTime     int64  `json:"mod_time"`
	IsDir       bool   `json:"is_dir"`
	IsSymlink   bool   `json:"is_symlink"`
	Permissions string `json:"permissions"`
	Owner       string `json:"owner,omitempty"`
	Group       string `json:"group,omitempty"`
}

// TransferProgress represents file transfer progress
type TransferProgress struct {
	FileName    string  `json:"file_name"`
	TotalBytes  int64   `json:"total_bytes"`
	Transferred int64   `json:"transferred"`
	Percent     float64 `json:"percent"`
	Speed       int64   `json:"speed"`  // bytes per second
	Status      string  `json:"status"` // transferring, completed, failed
	Error       string  `json:"error,omitempty"`
}

// Client wraps SFTP client with additional functionality
type Client struct {
	sshClient  *ssh.Client
	sftpClient *sftp.Client
	config     *ConnectionConfig
}

// ConnectionConfig holds SFTP connection parameters
type ConnectionConfig struct {
	Address        string `json:"address"`
	Port           int    `json:"port"`
	Username       string `json:"username"`
	Password       string `json:"password,omitempty"`
	PrivateKeyPath string `json:"private_key_path,omitempty"`
	PrivateKey     string `json:"private_key,omitempty"`
}

// NewClient creates a new SFTP client
func NewClient(config *ConnectionConfig) (*Client, error) {
	// Build SSH auth
	var authMethods []ssh.AuthMethod

	if config.Password != "" {
		authMethods = append(authMethods, ssh.Password(config.Password))
	}

	if config.PrivateKeyPath != "" {
		key, err := os.ReadFile(expandPath(config.PrivateKeyPath))
		if err != nil {
			return nil, fmt.Errorf("failed to read private key: %w", err)
		}
		signer, err := ssh.ParsePrivateKey(key)
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}

	if config.PrivateKey != "" {
		signer, err := ssh.ParsePrivateKey([]byte(config.PrivateKey))
		if err != nil {
			return nil, fmt.Errorf("failed to parse inline private key: %w", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}

	// Try default keys if no auth specified
	if len(authMethods) == 0 {
		homeDir, _ := os.UserHomeDir()
		defaultKeys := []string{
			filepath.Join(homeDir, ".ssh", "id_rsa"),
			filepath.Join(homeDir, ".ssh", "id_ed25519"),
		}
		for _, keyPath := range defaultKeys {
			if key, err := os.ReadFile(keyPath); err == nil {
				if signer, err := ssh.ParsePrivateKey(key); err == nil {
					authMethods = append(authMethods, ssh.PublicKeys(signer))
					break
				}
			}
		}
	}

	if len(authMethods) == 0 {
		return nil, fmt.Errorf("no authentication methods available")
	}

	sshConfig := &ssh.ClientConfig{
		User:            config.Username,
		Auth:            authMethods,
		Timeout:         30 * time.Second,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
	}

	addr := fmt.Sprintf("%s:%d", config.Address, config.Port)
	sshClient, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		return nil, fmt.Errorf("SSH connection failed: %w", err)
	}

	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		sshClient.Close()
		return nil, fmt.Errorf("SFTP client creation failed: %w", err)
	}

	return &Client{
		sshClient:  sshClient,
		sftpClient: sftpClient,
		config:     config,
	}, nil
}

// Close closes the SFTP and SSH connections
func (c *Client) Close() error {
	if c.sftpClient != nil {
		c.sftpClient.Close()
	}
	if c.sshClient != nil {
		c.sshClient.Close()
	}
	return nil
}

// ListDir lists files in a directory
func (c *Client) ListDir(path string) ([]FileInfo, error) {
	// Handle home directory
	if path == "" || path == "~" {
		// Get current working directory (usually home)
		cwd, err := c.sftpClient.Getwd()
		if err != nil {
			// Fallback to /home/username or just /
			path = "/"
		} else {
			path = cwd
		}
	}
	
	files, err := c.sftpClient.ReadDir(path)
	if err != nil {
		return nil, err
	}

	var result []FileInfo
	for _, f := range files {
		info := FileInfo{
			Name:        f.Name(),
			Path:        filepath.Join(path, f.Name()),
			Size:        f.Size(),
			Mode:        f.Mode().String(),
			ModTime:     f.ModTime().UnixMilli(),
			IsDir:       f.IsDir(),
			IsSymlink:   f.Mode()&os.ModeSymlink != 0,
			Permissions: f.Mode().Perm().String(),
		}

		// Try to get owner/group info
		if sys := f.Sys(); sys != nil {
			// Platform-specific stat info would go here
		}

		result = append(result, info)
	}

	// Sort: directories first, then alphabetically
	sort.Slice(result, func(i, j int) bool {
		if result[i].IsDir != result[j].IsDir {
			return result[i].IsDir
		}
		return result[i].Name < result[j].Name
	})

	return result, nil
}

// Stat returns file info for a path
func (c *Client) Stat(path string) (*FileInfo, error) {
	f, err := c.sftpClient.Stat(path)
	if err != nil {
		return nil, err
	}

	return &FileInfo{
		Name:        f.Name(),
		Path:        path,
		Size:        f.Size(),
		Mode:        f.Mode().String(),
		ModTime:     f.ModTime().UnixMilli(),
		IsDir:       f.IsDir(),
		Permissions: f.Mode().Perm().String(),
	}, nil
}

// Download downloads a remote file to local path
func (c *Client) Download(remotePath, localPath string, progressChan chan<- TransferProgress) error {
	remoteFile, err := c.sftpClient.Open(remotePath)
	if err != nil {
		return fmt.Errorf("failed to open remote file: %w", err)
	}
	defer remoteFile.Close()

	stat, err := remoteFile.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat remote file: %w", err)
	}

	localFile, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("failed to create local file: %w", err)
	}
	defer localFile.Close()

	totalSize := stat.Size()
	fileName := filepath.Base(remotePath)

	if progressChan != nil {
		progressChan <- TransferProgress{
			FileName:   fileName,
			TotalBytes: totalSize,
			Status:     "transferring",
		}
	}

	// Copy with progress tracking
	buf := make([]byte, 32*1024)
	var transferred int64
	startTime := time.Now()

	for {
		n, err := remoteFile.Read(buf)
		if n > 0 {
			written, wErr := localFile.Write(buf[:n])
			if wErr != nil {
				return fmt.Errorf("failed to write local file: %w", wErr)
			}
			transferred += int64(written)

			if progressChan != nil {
				elapsed := time.Since(startTime).Seconds()
				speed := int64(0)
				if elapsed > 0 {
					speed = int64(float64(transferred) / elapsed)
				}

				progressChan <- TransferProgress{
					FileName:    fileName,
					TotalBytes:  totalSize,
					Transferred: transferred,
					Percent:     float64(transferred) / float64(totalSize) * 100,
					Speed:       speed,
					Status:      "transferring",
				}
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read remote file: %w", err)
		}
	}

	if progressChan != nil {
		progressChan <- TransferProgress{
			FileName:    fileName,
			TotalBytes:  totalSize,
			Transferred: transferred,
			Percent:     100,
			Status:      "completed",
		}
	}

	return nil
}

// Upload uploads a local file to remote path
func (c *Client) Upload(localPath, remotePath string, progressChan chan<- TransferProgress) error {
	localFile, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("failed to open local file: %w", err)
	}
	defer localFile.Close()

	stat, err := localFile.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat local file: %w", err)
	}

	remoteFile, err := c.sftpClient.Create(remotePath)
	if err != nil {
		return fmt.Errorf("failed to create remote file: %w", err)
	}
	defer remoteFile.Close()

	totalSize := stat.Size()
	fileName := filepath.Base(localPath)

	if progressChan != nil {
		progressChan <- TransferProgress{
			FileName:   fileName,
			TotalBytes: totalSize,
			Status:     "transferring",
		}
	}

	buf := make([]byte, 32*1024)
	var transferred int64
	startTime := time.Now()

	for {
		n, err := localFile.Read(buf)
		if n > 0 {
			written, wErr := remoteFile.Write(buf[:n])
			if wErr != nil {
				return fmt.Errorf("failed to write remote file: %w", wErr)
			}
			transferred += int64(written)

			if progressChan != nil {
				elapsed := time.Since(startTime).Seconds()
				speed := int64(0)
				if elapsed > 0 {
					speed = int64(float64(transferred) / elapsed)
				}

				progressChan <- TransferProgress{
					FileName:    fileName,
					TotalBytes:  totalSize,
					Transferred: transferred,
					Percent:     float64(transferred) / float64(totalSize) * 100,
					Speed:       speed,
					Status:      "transferring",
				}
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read local file: %w", err)
		}
	}

	if progressChan != nil {
		progressChan <- TransferProgress{
			FileName:    fileName,
			TotalBytes:  totalSize,
			Transferred: transferred,
			Percent:     100,
			Status:      "completed",
		}
	}

	return nil
}

// Mkdir creates a directory
func (c *Client) Mkdir(path string) error {
	return c.sftpClient.MkdirAll(path)
}

// Remove removes a file or empty directory
func (c *Client) Remove(path string) error {
	return c.sftpClient.Remove(path)
}

// RemoveAll removes a file or directory recursively
func (c *Client) RemoveAll(path string) error {
	stat, err := c.sftpClient.Stat(path)
	if err != nil {
		return err
	}

	if !stat.IsDir() {
		return c.sftpClient.Remove(path)
	}

	// Remove directory contents first
	files, err := c.sftpClient.ReadDir(path)
	if err != nil {
		return err
	}

	for _, f := range files {
		childPath := filepath.Join(path, f.Name())
		if err := c.RemoveAll(childPath); err != nil {
			return err
		}
	}

	return c.sftpClient.RemoveDirectory(path)
}

// Rename renames/moves a file or directory
func (c *Client) Rename(oldPath, newPath string) error {
	return c.sftpClient.Rename(oldPath, newPath)
}

// Chmod changes file permissions
func (c *Client) Chmod(path string, mode os.FileMode) error {
	return c.sftpClient.Chmod(path, mode)
}

// ReadFile reads entire file content
func (c *Client) ReadFile(path string) ([]byte, error) {
	file, err := c.sftpClient.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	return io.ReadAll(file)
}

// WriteFile writes content to a file
func (c *Client) WriteFile(path string, content []byte) error {
	file, err := c.sftpClient.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.Write(content)
	return err
}

// Open opens a remote file for reading (returns *sftp.File)
func (c *Client) Open(path string) (*sftp.File, error) {
	return c.sftpClient.Open(path)
}

// Create creates a remote file for writing (returns *sftp.File)
func (c *Client) Create(path string) (*sftp.File, error) {
	return c.sftpClient.Create(path)
}

// GetHomeDir returns the user's home directory on the remote server
func (c *Client) GetHomeDir() (string, error) {
	return c.sftpClient.Getwd()
}

func expandPath(path string) string {
	if len(path) > 0 && path[0] == '~' {
		home, _ := os.UserHomeDir()
		return filepath.Join(home, path[1:])
	}
	return path
}
