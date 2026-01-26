package actions

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"sync"

	"golang.org/x/crypto/ssh"
)

// ActionResult represents the result of an action execution
type ActionResult struct {
	HostID    string `json:"host_id"`
	HostLabel string `json:"host_label,omitempty"`
	Success   bool   `json:"success"`
	Output    string `json:"output"`
	Error     string `json:"error,omitempty"`
}

// Executor handles quick action execution
type Executor struct {
	sshConfigs map[string]*ssh.ClientConfig
}

// NewExecutor creates a new action executor
func NewExecutor() *Executor {
	return &Executor{
		sshConfigs: make(map[string]*ssh.ClientConfig),
	}
}

// HostConfig represents host connection info
type HostConfig struct {
	ID       string
	Label    string
	Address  string
	Port     int
	Username string
	Password string
	KeyPath  string
}

// ExecuteCommand runs a command on a single host
func (e *Executor) ExecuteCommand(host *HostConfig, command string) *ActionResult {
	client, err := e.connect(host)
	if err != nil {
		return &ActionResult{
			HostID:    host.ID,
			HostLabel: host.Label,
			Success:   false,
			Error:     err.Error(),
		}
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return &ActionResult{
			HostID:    host.ID,
			HostLabel: host.Label,
			Success:   false,
			Error:     err.Error(),
		}
	}
	defer session.Close()

	var stdout, stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr

	err = session.Run(command)
	output := stdout.String()
	if stderr.Len() > 0 {
		if output != "" {
			output += "\n"
		}
		output += stderr.String()
	}

	return &ActionResult{
		HostID:    host.ID,
		HostLabel: host.Label,
		Success:   err == nil,
		Output:    output,
		Error:     errString(err),
	}
}

// ExecuteMulti runs a command on multiple hosts in parallel
func (e *Executor) ExecuteMulti(hosts []*HostConfig, command string) []*ActionResult {
	var wg sync.WaitGroup
	results := make([]*ActionResult, len(hosts))

	for i, host := range hosts {
		wg.Add(1)
		go func(idx int, h *HostConfig) {
			defer wg.Done()
			results[idx] = e.ExecuteCommand(h, command)
		}(i, host)
	}

	wg.Wait()
	return results
}

// ========================================
// Package Manager Actions
// ========================================

// PackageManagerType represents the detected package manager
type PackageManagerType string

const (
	PMTypeApt    PackageManagerType = "apt"
	PMTypeYum    PackageManagerType = "yum"
	PMTypeDnf    PackageManagerType = "dnf"
	PMTypePacman PackageManagerType = "pacman"
	PMTypeApk    PackageManagerType = "apk"
	PMTypeZypper PackageManagerType = "zypper"
)

// DetectPackageManager detects the package manager on a host
func (e *Executor) DetectPackageManager(host *HostConfig) (PackageManagerType, error) {
	result := e.ExecuteCommand(host, "which apt-get yum dnf pacman apk zypper 2>/dev/null | head -1")
	if !result.Success {
		return "", fmt.Errorf("failed to detect package manager")
	}

	output := strings.TrimSpace(result.Output)
	if strings.Contains(output, "apt") {
		return PMTypeApt, nil
	} else if strings.Contains(output, "dnf") {
		return PMTypeDnf, nil
	} else if strings.Contains(output, "yum") {
		return PMTypeYum, nil
	} else if strings.Contains(output, "pacman") {
		return PMTypePacman, nil
	} else if strings.Contains(output, "apk") {
		return PMTypeApk, nil
	} else if strings.Contains(output, "zypper") {
		return PMTypeZypper, nil
	}

	return "", fmt.Errorf("unknown package manager")
}

// PackageAction represents a package manager action
type PackageAction string

const (
	PkgInstall PackageAction = "install"
	PkgRemove  PackageAction = "remove"
	PkgUpdate  PackageAction = "update"
	PkgUpgrade PackageAction = "upgrade"
	PkgSearch  PackageAction = "search"
)

// BuildPackageCommand builds the appropriate package manager command
func BuildPackageCommand(pm PackageManagerType, action PackageAction, packages []string, dryRun bool) string {
	pkgList := strings.Join(packages, " ")
	var cmd string

	switch pm {
	case PMTypeApt:
		switch action {
		case PkgInstall:
			cmd = fmt.Sprintf("sudo apt-get install -y %s", pkgList)
		case PkgRemove:
			cmd = fmt.Sprintf("sudo apt-get remove -y %s", pkgList)
		case PkgUpdate:
			cmd = "sudo apt-get update"
		case PkgUpgrade:
			cmd = "sudo apt-get upgrade -y"
		case PkgSearch:
			cmd = fmt.Sprintf("apt-cache search %s", pkgList)
		}
		if dryRun && (action == PkgInstall || action == PkgRemove || action == PkgUpgrade) {
			cmd = strings.Replace(cmd, "-y", "-y --dry-run", 1)
		}

	case PMTypeYum, PMTypeDnf:
		cmdPrefix := "yum"
		if pm == PMTypeDnf {
			cmdPrefix = "dnf"
		}
		switch action {
		case PkgInstall:
			cmd = fmt.Sprintf("sudo %s install -y %s", cmdPrefix, pkgList)
		case PkgRemove:
			cmd = fmt.Sprintf("sudo %s remove -y %s", cmdPrefix, pkgList)
		case PkgUpdate:
			cmd = fmt.Sprintf("sudo %s check-update", cmdPrefix)
		case PkgUpgrade:
			cmd = fmt.Sprintf("sudo %s upgrade -y", cmdPrefix)
		case PkgSearch:
			cmd = fmt.Sprintf("%s search %s", cmdPrefix, pkgList)
		}

	case PMTypePacman:
		switch action {
		case PkgInstall:
			cmd = fmt.Sprintf("sudo pacman -S --noconfirm %s", pkgList)
		case PkgRemove:
			cmd = fmt.Sprintf("sudo pacman -R --noconfirm %s", pkgList)
		case PkgUpdate:
			cmd = "sudo pacman -Sy"
		case PkgUpgrade:
			cmd = "sudo pacman -Syu --noconfirm"
		case PkgSearch:
			cmd = fmt.Sprintf("pacman -Ss %s", pkgList)
		}

	case PMTypeApk:
		switch action {
		case PkgInstall:
			cmd = fmt.Sprintf("sudo apk add %s", pkgList)
		case PkgRemove:
			cmd = fmt.Sprintf("sudo apk del %s", pkgList)
		case PkgUpdate:
			cmd = "sudo apk update"
		case PkgUpgrade:
			cmd = "sudo apk upgrade"
		case PkgSearch:
			cmd = fmt.Sprintf("apk search %s", pkgList)
		}
	}

	return cmd
}

// ========================================
// Service Control Actions
// ========================================

// ServiceAction represents a systemd service action
type ServiceAction string

const (
	SvcStart   ServiceAction = "start"
	SvcStop    ServiceAction = "stop"
	SvcRestart ServiceAction = "restart"
	SvcStatus  ServiceAction = "status"
	SvcEnable  ServiceAction = "enable"
	SvcDisable ServiceAction = "disable"
)

// ServiceStatus represents the status of a service
type ServiceStatus struct {
	Name      string `json:"name"`
	Active    bool   `json:"active"`
	Enabled   bool   `json:"enabled"`
	Status    string `json:"status"`
	SubStatus string `json:"sub_status"`
}

// ControlService performs a service action
func (e *Executor) ControlService(host *HostConfig, service string, action ServiceAction) *ActionResult {
	cmd := fmt.Sprintf("sudo systemctl %s %s", action, service)
	return e.ExecuteCommand(host, cmd)
}

// GetServiceStatus gets the status of a service
func (e *Executor) GetServiceStatus(host *HostConfig, service string) (*ServiceStatus, error) {
	result := e.ExecuteCommand(host, fmt.Sprintf("systemctl show %s --property=ActiveState,SubState,UnitFileState", service))
	if !result.Success {
		return nil, fmt.Errorf(result.Error)
	}

	status := &ServiceStatus{Name: service}
	for _, line := range strings.Split(result.Output, "\n") {
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

	return status, nil
}

// ListServices lists all services
func (e *Executor) ListServices(host *HostConfig) ([]ServiceStatus, error) {
	result := e.ExecuteCommand(host, "systemctl list-units --type=service --all --no-legend --no-pager")
	if !result.Success {
		return nil, fmt.Errorf(result.Error)
	}

	var services []ServiceStatus
	re := regexp.MustCompile(`^(\S+\.service)\s+(\S+)\s+(\S+)\s+(\S+)`)
	for _, line := range strings.Split(result.Output, "\n") {
		matches := re.FindStringSubmatch(line)
		if len(matches) >= 5 {
			services = append(services, ServiceStatus{
				Name:      strings.TrimSuffix(matches[1], ".service"),
				Active:    matches[3] == "active",
				Status:    matches[3],
				SubStatus: matches[4],
			})
		}
	}

	return services, nil
}

// ========================================
// User Management Actions
// ========================================

// UserInfo represents system user information
type UserInfo struct {
	Username string   `json:"username"`
	UID      string   `json:"uid"`
	GID      string   `json:"gid"`
	Home     string   `json:"home"`
	Shell    string   `json:"shell"`
	Groups   []string `json:"groups"`
	Sudo     bool     `json:"sudo"`
}

// ListUsers lists system users
func (e *Executor) ListUsers(host *HostConfig) ([]UserInfo, error) {
	result := e.ExecuteCommand(host, "cat /etc/passwd")
	if !result.Success {
		return nil, fmt.Errorf(result.Error)
	}

	var users []UserInfo
	for _, line := range strings.Split(result.Output, "\n") {
		parts := strings.Split(line, ":")
		if len(parts) >= 7 {
			uid := parts[2]
			// Filter out system users (UID < 1000 except root)
			if uid == "0" || (len(uid) >= 4) {
				users = append(users, UserInfo{
					Username: parts[0],
					UID:      parts[2],
					GID:      parts[3],
					Home:     parts[5],
					Shell:    parts[6],
				})
			}
		}
	}

	return users, nil
}

// CreateUser creates a new user
func (e *Executor) CreateUser(host *HostConfig, username string, options map[string]string) *ActionResult {
	cmd := fmt.Sprintf("sudo useradd -m %s", username)

	if shell, ok := options["shell"]; ok {
		cmd += fmt.Sprintf(" -s %s", shell)
	}
	if home, ok := options["home"]; ok {
		cmd += fmt.Sprintf(" -d %s", home)
	}
	if groups, ok := options["groups"]; ok {
		cmd += fmt.Sprintf(" -G %s", groups)
	}

	result := e.ExecuteCommand(host, cmd)

	// Add sudo if requested
	if sudo, ok := options["sudo"]; ok && sudo == "true" && result.Success {
		e.ExecuteCommand(host, fmt.Sprintf("sudo usermod -aG sudo %s", username))
	}

	// Set password if provided
	if password, ok := options["password"]; ok && result.Success {
		e.ExecuteCommand(host, fmt.Sprintf("echo '%s:%s' | sudo chpasswd", username, password))
	}

	return result
}

// DeleteUser deletes a user
func (e *Executor) DeleteUser(host *HostConfig, username string, removeHome bool) *ActionResult {
	cmd := "sudo userdel"
	if removeHome {
		cmd += " -r"
	}
	cmd += " " + username
	return e.ExecuteCommand(host, cmd)
}

// ========================================
// System Metrics Actions
// ========================================

// SystemMetrics represents system health metrics
type SystemMetrics struct {
	CPUUsage    float64     `json:"cpu_usage"`
	MemoryTotal int64       `json:"memory_total"`
	MemoryUsed  int64       `json:"memory_used"`
	MemoryFree  int64       `json:"memory_free"`
	SwapTotal   int64       `json:"swap_total"`
	SwapUsed    int64       `json:"swap_used"`
	DiskUsage   []DiskUsage `json:"disk_usage"`
	Uptime      string      `json:"uptime"`
	LoadAvg     string      `json:"load_avg"`
	Hostname    string      `json:"hostname"`
	IPAddress   string      `json:"ip_address"`
}

// DiskUsage represents disk usage for a mount point
type DiskUsage struct {
	Filesystem string  `json:"filesystem"`
	Size       string  `json:"size"`
	Used       string  `json:"used"`
	Available  string  `json:"available"`
	UsePercent float64 `json:"use_percent"`
	MountPoint string  `json:"mount_point"`
}

// GetSystemMetrics gets system health metrics
func (e *Executor) GetSystemMetrics(host *HostConfig) (*SystemMetrics, error) {
	metrics := &SystemMetrics{}

	// Hostname
	if res := e.ExecuteCommand(host, "hostname"); res.Success {
		metrics.Hostname = strings.TrimSpace(res.Output)
	}

	// IP Address
	if res := e.ExecuteCommand(host, "hostname -I | awk '{print $1}'"); res.Success {
		metrics.IPAddress = strings.TrimSpace(res.Output)
	}

	// CPU usage
	cpuResult := e.ExecuteCommand(host, "top -bn1 | grep 'Cpu(s)' | awk '{print $2}'")
	if cpuResult.Success {
		fmt.Sscanf(cpuResult.Output, "%f", &metrics.CPUUsage)
	}

	// Memory
	memResult := e.ExecuteCommand(host, "free -b | grep -E '^(Mem|Swap)'")
	if memResult.Success {
		for _, line := range strings.Split(memResult.Output, "\n") {
			fields := strings.Fields(line)
			if len(fields) >= 4 {
				if fields[0] == "Mem:" {
					fmt.Sscanf(fields[1], "%d", &metrics.MemoryTotal)
					fmt.Sscanf(fields[2], "%d", &metrics.MemoryUsed)
					fmt.Sscanf(fields[3], "%d", &metrics.MemoryFree)
				} else if fields[0] == "Swap:" {
					fmt.Sscanf(fields[1], "%d", &metrics.SwapTotal)
					fmt.Sscanf(fields[2], "%d", &metrics.SwapUsed)
				}
			}
		}
	}

	// Disk usage
	diskResult := e.ExecuteCommand(host, "df -h --output=source,size,used,avail,pcent,target | tail -n +2")
	if diskResult.Success {
		for _, line := range strings.Split(diskResult.Output, "\n") {
			fields := strings.Fields(line)
			if len(fields) >= 6 {
				var percent float64
				fmt.Sscanf(strings.TrimSuffix(fields[4], "%"), "%f", &percent)
				metrics.DiskUsage = append(metrics.DiskUsage, DiskUsage{
					Filesystem: fields[0],
					Size:       fields[1],
					Used:       fields[2],
					Available:  fields[3],
					UsePercent: percent,
					MountPoint: fields[5],
				})
			}
		}
	}

	// Uptime and load
	uptimeResult := e.ExecuteCommand(host, "uptime")
	if uptimeResult.Success {
		metrics.Uptime = strings.TrimSpace(uptimeResult.Output)
		if idx := strings.Index(metrics.Uptime, "load average:"); idx != -1 {
			metrics.LoadAvg = strings.TrimSpace(metrics.Uptime[idx+13:])
		}
	}

	return metrics, nil
}

// ========================================
// Log Explorer Actions
// ========================================

// LogEntry represents a log entry
type LogEntry struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Message   string `json:"message"`
	Source    string `json:"source"`
}

// SearchLogs searches system logs
func (e *Executor) SearchLogs(host *HostConfig, pattern string, logFile string, limit int) ([]LogEntry, error) {
	if logFile == "" {
		logFile = "/var/log/syslog"
	}
	if limit == 0 {
		limit = 100
	}

	cmd := fmt.Sprintf("grep -i '%s' %s 2>/dev/null | tail -n %d", pattern, logFile, limit)
	result := e.ExecuteCommand(host, cmd)

	var entries []LogEntry
	for _, line := range strings.Split(result.Output, "\n") {
		if line != "" {
			entries = append(entries, LogEntry{
				Message: line,
				Source:  logFile,
			})
		}
	}

	return entries, nil
}

// GetRecentLogs gets recent log entries
func (e *Executor) GetRecentLogs(host *HostConfig, logType string, lines int) ([]LogEntry, error) {
	var logFile string
	switch logType {
	case "syslog":
		logFile = "/var/log/syslog"
	case "auth":
		logFile = "/var/log/auth.log"
	case "kernel":
		logFile = "/var/log/kern.log"
	case "messages":
		logFile = "/var/log/messages"
	default:
		logFile = "/var/log/syslog"
	}

	if lines == 0 {
		lines = 50
	}

	cmd := fmt.Sprintf("tail -n %d %s 2>/dev/null || journalctl -n %d 2>/dev/null", lines, logFile, lines)
	result := e.ExecuteCommand(host, cmd)

	var entries []LogEntry
	for _, line := range strings.Split(result.Output, "\n") {
		if line != "" {
			entries = append(entries, LogEntry{
				Message: line,
				Source:  logType,
			})
		}
	}

	return entries, nil
}

// ========================================
// Docker Actions
// ========================================

// ContainerInfo represents Docker container information
type ContainerInfo struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Image   string `json:"image"`
	Status  string `json:"status"`
	Ports   string `json:"ports"`
	Created string `json:"created"`
}

// ListContainers lists Docker containers
func (e *Executor) ListContainers(host *HostConfig, all bool) ([]ContainerInfo, error) {
	cmd := "docker ps --format '{{json .}}'"
	if all {
		cmd = "docker ps -a --format '{{json .}}'"
	}

	result := e.ExecuteCommand(host, cmd)
	if !result.Success {
		return nil, fmt.Errorf(result.Error)
	}

	var containers []ContainerInfo
	for _, line := range strings.Split(result.Output, "\n") {
		if line == "" {
			continue
		}
		var info struct {
			ID      string `json:"ID"`
			Names   string `json:"Names"`
			Image   string `json:"Image"`
			Status  string `json:"Status"`
			Ports   string `json:"Ports"`
			Created string `json:"CreatedAt"`
		}
		if err := json.Unmarshal([]byte(line), &info); err == nil {
			containers = append(containers, ContainerInfo{
				ID:      info.ID,
				Name:    info.Names,
				Image:   info.Image,
				Status:  info.Status,
				Ports:   info.Ports,
				Created: info.Created,
			})
		}
	}

	return containers, nil
}

// ContainerAction performs a container action
func (e *Executor) ContainerAction(host *HostConfig, containerID string, action string) *ActionResult {
	cmd := fmt.Sprintf("docker %s %s", action, containerID)
	return e.ExecuteCommand(host, cmd)
}

// GetContainerLogs gets container logs
func (e *Executor) GetContainerLogs(host *HostConfig, containerID string, lines int) *ActionResult {
	if lines == 0 {
		lines = 100
	}
	cmd := fmt.Sprintf("docker logs --tail %d %s", lines, containerID)
	return e.ExecuteCommand(host, cmd)
}

// ========================================
// Network Diagnostics
// ========================================

// Ping performs a ping test
func (e *Executor) Ping(host *HostConfig, target string, count int) *ActionResult {
	if count == 0 {
		count = 4
	}
	cmd := fmt.Sprintf("ping -c %d %s", count, target)
	return e.ExecuteCommand(host, cmd)
}

// Traceroute performs a traceroute
func (e *Executor) Traceroute(host *HostConfig, target string) *ActionResult {
	cmd := fmt.Sprintf("traceroute %s 2>/dev/null || tracepath %s", target, target)
	return e.ExecuteCommand(host, cmd)
}

// Netstat shows network connections
func (e *Executor) Netstat(host *HostConfig, filter string) *ActionResult {
	cmd := "ss -tuln"
	if filter != "" {
		cmd += fmt.Sprintf(" | grep '%s'", filter)
	}
	return e.ExecuteCommand(host, cmd)
}

// ========================================
// Helpers
// ========================================

func (e *Executor) connect(host *HostConfig) (*ssh.Client, error) {
	var authMethods []ssh.AuthMethod

	if host.Password != "" {
		authMethods = append(authMethods, ssh.Password(host.Password))
	}

	if host.KeyPath != "" {
		key, err := os.ReadFile(host.KeyPath)
		if err == nil {
			signer, err := ssh.ParsePrivateKey(key)
			if err == nil {
				authMethods = append(authMethods, ssh.PublicKeys(signer))
			}
		}
	}

	if len(authMethods) == 0 {
		return nil, fmt.Errorf("no authentication methods available")
	}

	config := &ssh.ClientConfig{
		User:            host.Username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
	}

	addr := fmt.Sprintf("%s:%d", host.Address, host.Port)
	return ssh.Dial("tcp", addr, config)
}

func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
