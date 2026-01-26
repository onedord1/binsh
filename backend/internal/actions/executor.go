package actions

import (
	"bytes"
	"fmt"
	"os"
	"regexp"
	"strconv"
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
	ID         string
	Label      string
	Address    string
	Port       int
	Username   string
	Password   string
	KeyPath    string
	Passphrase string
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
	// Handle leading whitespace and optional bullet point (●) in systemctl output
	re := regexp.MustCompile(`^\s*[●\s]*(\S+\.service)\s+(\S+)\s+(\S+)\s+(\S+)`)
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

// GroupInfo represents system group information
type GroupInfo struct {
	Name    string   `json:"name"`
	GID     string   `json:"gid"`
	Members []string `json:"members"`
}

// ListGroups lists all system groups
func (e *Executor) ListGroups(host *HostConfig) ([]GroupInfo, error) {
	result := e.ExecuteCommand(host, "cat /etc/group")
	if !result.Success {
		return nil, fmt.Errorf(result.Error)
	}

	var groups []GroupInfo
	for _, line := range strings.Split(result.Output, "\n") {
		parts := strings.Split(line, ":")
		if len(parts) >= 4 {
			members := []string{}
			if parts[3] != "" {
				members = strings.Split(parts[3], ",")
			}
			groups = append(groups, GroupInfo{
				Name:    parts[0],
				GID:     parts[2],
				Members: members,
			})
		}
	}

	return groups, nil
}

// GetUserGroups gets all groups a user belongs to
func (e *Executor) GetUserGroups(host *HostConfig, username string) ([]string, error) {
	result := e.ExecuteCommand(host, fmt.Sprintf("groups %s", username))
	if !result.Success {
		return nil, fmt.Errorf(result.Error)
	}

	// Output format: "username : group1 group2 group3"
	output := strings.TrimSpace(result.Output)
	if idx := strings.Index(output, ":"); idx != -1 {
		groupsStr := strings.TrimSpace(output[idx+1:])
		if groupsStr != "" {
			return strings.Fields(groupsStr), nil
		}
	}
	return []string{}, nil
}

// ModifyUserGroups modifies a user's group memberships
func (e *Executor) ModifyUserGroups(host *HostConfig, username string, groups []string) *ActionResult {
	if len(groups) == 0 {
		// Remove from all supplementary groups
		return e.ExecuteCommand(host, fmt.Sprintf("sudo usermod -G '' %s", username))
	}
	groupsStr := strings.Join(groups, ",")
	return e.ExecuteCommand(host, fmt.Sprintf("sudo usermod -G %s %s", groupsStr, username))
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
	res := e.ExecuteCommand(host, "hostname")
	if res.Success {
		metrics.Hostname = strings.TrimSpace(res.Output)
	} else {
		// Log first command failure to debug SSH connection issues
		return nil, fmt.Errorf("failed to execute hostname command: %s", res.Error)
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

// ContainerInfo represents Docker/Podman container information
type ContainerInfo struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Image   string `json:"image"`
	Status  string `json:"status"`
	State   string `json:"state"`
	Ports   string `json:"ports"`
	Created string `json:"created"`
}

// ContainerImage represents Docker/Podman image information
type ContainerImage struct {
	ID         string `json:"id"`
	Repository string `json:"repository"`
	Tag        string `json:"tag"`
	Size       string `json:"size"`
	Created    string `json:"created"`
}

// DetectContainerRuntime checks if docker or podman is installed
func (e *Executor) DetectContainerRuntime(host *HostConfig) (string, error) {
	// Try docker first
	result := e.ExecuteCommand(host, "which docker && docker --version")
	if result.Success && strings.Contains(result.Output, "Docker") {
		return "docker", nil
	}
	// Try podman
	result = e.ExecuteCommand(host, "which podman && podman --version")
	if result.Success && strings.Contains(result.Output, "podman") {
		return "podman", nil
	}
	return "", fmt.Errorf("no container runtime found")
}

// ListContainers lists Docker/Podman containers
func (e *Executor) ListContainers(host *HostConfig, runtime string) ([]ContainerInfo, error) {
	if runtime == "" {
		runtime = "docker"
	}
	cmd := fmt.Sprintf("%s ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}|{{.Ports}}|{{.CreatedAt}}'", runtime)
	result := e.ExecuteCommand(host, cmd)
	if !result.Success {
		return nil, fmt.Errorf(result.Error)
	}

	var containers []ContainerInfo
	for _, line := range strings.Split(result.Output, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, "|")
		if len(parts) >= 4 {
			container := ContainerInfo{
				ID:     parts[0],
				Name:   parts[1],
				Image:  parts[2],
				Status: parts[3],
			}
			if len(parts) >= 5 {
				container.State = parts[4]
			}
			if len(parts) >= 6 {
				container.Ports = parts[5]
			}
			if len(parts) >= 7 {
				container.Created = parts[6]
			}
			containers = append(containers, container)
		}
	}

	return containers, nil
}

// ContainerAction performs a container action
func (e *Executor) ContainerAction(host *HostConfig, runtime, containerID, action string) *ActionResult {
	if runtime == "" {
		runtime = "docker"
	}
	var cmd string
	switch action {
	case "start":
		cmd = fmt.Sprintf("%s start %s", runtime, containerID)
	case "stop":
		cmd = fmt.Sprintf("%s stop %s", runtime, containerID)
	case "restart":
		cmd = fmt.Sprintf("%s restart %s", runtime, containerID)
	case "logs":
		cmd = fmt.Sprintf("%s logs --tail 100 %s", runtime, containerID)
	default:
		cmd = fmt.Sprintf("%s %s %s", runtime, action, containerID)
	}
	return e.ExecuteCommand(host, cmd)
}

// GetContainerLogs gets container logs
func (e *Executor) GetContainerLogs(host *HostConfig, runtime, containerID string, lines int) *ActionResult {
	if runtime == "" {
		runtime = "docker"
	}
	if lines == 0 {
		lines = 100
	}
	cmd := fmt.Sprintf("%s logs --tail %d %s", runtime, lines, containerID)
	return e.ExecuteCommand(host, cmd)
}

// ListContainerImages lists Docker/Podman images
func (e *Executor) ListContainerImages(host *HostConfig, runtime string) ([]ContainerImage, error) {
	if runtime == "" {
		runtime = "docker"
	}
	cmd := fmt.Sprintf("%s images --format '{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}|{{.CreatedAt}}'", runtime)
	result := e.ExecuteCommand(host, cmd)
	if !result.Success {
		return nil, fmt.Errorf(result.Error)
	}

	var images []ContainerImage
	for _, line := range strings.Split(result.Output, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, "|")
		if len(parts) >= 4 {
			image := ContainerImage{
				ID:         parts[0],
				Repository: parts[1],
				Tag:        parts[2],
				Size:       parts[3],
			}
			if len(parts) >= 5 {
				image.Created = parts[4]
			}
			images = append(images, image)
		}
	}
	return images, nil
}

// DeleteContainerImages deletes container images
func (e *Executor) DeleteContainerImages(host *HostConfig, runtime string, imageIDs []string) *ActionResult {
	if runtime == "" {
		runtime = "docker"
	}
	if len(imageIDs) == 0 {
		return &ActionResult{Success: false, Error: "no images specified"}
	}
	cmd := fmt.Sprintf("%s rmi %s", runtime, strings.Join(imageIDs, " "))
	return e.ExecuteCommand(host, cmd)
}

// ContainerSystemPrune cleans up unused container resources
func (e *Executor) ContainerSystemPrune(host *HostConfig, runtime string) *ActionResult {
	if runtime == "" {
		runtime = "docker"
	}
	cmd := fmt.Sprintf("%s system prune -af", runtime)
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
// System Log Actions
// ========================================

// GetSyslog retrieves system logs
func (e *Executor) GetSyslog(host *HostConfig, lines int) *ActionResult {
	if lines <= 0 {
		lines = 100
	}
	// Try journalctl first (systemd), fallback to traditional syslog
	cmd := fmt.Sprintf("journalctl -n %d --no-pager 2>/dev/null || tail -n %d /var/log/syslog 2>/dev/null || tail -n %d /var/log/messages", lines, lines, lines)
	return e.ExecuteCommand(host, cmd)
}

// GetAuthLog retrieves authentication logs
func (e *Executor) GetAuthLog(host *HostConfig, lines int) *ActionResult {
	if lines <= 0 {
		lines = 100
	}
	// Try journalctl first (systemd), fallback to auth.log or secure
	cmd := fmt.Sprintf("journalctl -u sshd -n %d --no-pager 2>/dev/null || tail -n %d /var/log/auth.log 2>/dev/null || tail -n %d /var/log/secure", lines, lines, lines)
	return e.ExecuteCommand(host, cmd)
}

// ========================================
// Cron Jobs Management
// ========================================

type CronJob struct {
	ID       string `json:"id"`
	Minute   string `json:"minute"`
	Hour     string `json:"hour"`
	Day      string `json:"day"`
	Month    string `json:"month"`
	Weekday  string `json:"weekday"`
	Command  string `json:"command"`
	User     string `json:"user"`
	Enabled  bool   `json:"enabled"`
	RawLine  string `json:"raw_line"`
}

func (e *Executor) ListCronJobs(host *HostConfig, user string) ([]CronJob, error) {
	var cmd string
	if user == "" || user == "current" {
		cmd = "crontab -l 2>/dev/null || echo ''"
	} else if user == "root" {
		cmd = "sudo crontab -l 2>/dev/null || echo ''"
	} else {
		cmd = fmt.Sprintf("sudo crontab -u %s -l 2>/dev/null || echo ''", user)
	}
	
	result := e.ExecuteCommand(host, cmd)
	if result.Error != "" {
		return nil, fmt.Errorf(result.Error)
	}
	
	var jobs []CronJob
	lines := strings.Split(result.Output, "\n")
	for i, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		
		parts := strings.Fields(line)
		if len(parts) >= 6 {
			jobs = append(jobs, CronJob{
				ID:      fmt.Sprintf("%d", i),
				Minute:  parts[0],
				Hour:    parts[1],
				Day:     parts[2],
				Month:   parts[3],
				Weekday: parts[4],
				Command: strings.Join(parts[5:], " "),
				User:    user,
				Enabled: true,
				RawLine: line,
			})
		}
	}
	return jobs, nil
}

func (e *Executor) AddCronJob(host *HostConfig, user, minute, hour, day, month, weekday, command string) *ActionResult {
	cronLine := fmt.Sprintf("%s %s %s %s %s %s", minute, hour, day, month, weekday, command)
	
	var cmd string
	if user == "" || user == "current" {
		cmd = fmt.Sprintf("(crontab -l 2>/dev/null; echo '%s') | crontab -", cronLine)
	} else if user == "root" {
		cmd = fmt.Sprintf("(sudo crontab -l 2>/dev/null; echo '%s') | sudo crontab -", cronLine)
	} else {
		cmd = fmt.Sprintf("(sudo crontab -u %s -l 2>/dev/null; echo '%s') | sudo crontab -u %s -", user, cronLine, user)
	}
	
	return e.ExecuteCommand(host, cmd)
}

func (e *Executor) DeleteCronJob(host *HostConfig, user string, lineNumber int) *ActionResult {
	var cmd string
	if user == "" || user == "current" {
		cmd = fmt.Sprintf("crontab -l 2>/dev/null | sed '%dd' | crontab -", lineNumber+1)
	} else if user == "root" {
		cmd = fmt.Sprintf("sudo crontab -l 2>/dev/null | sed '%dd' | sudo crontab -", lineNumber+1)
	} else {
		cmd = fmt.Sprintf("sudo crontab -u %s -l 2>/dev/null | sed '%dd' | sudo crontab -u %s -", user, lineNumber+1, user)
	}
	
	return e.ExecuteCommand(host, cmd)
}

func (e *Executor) ListDirectory(host *HostConfig, path string) *ActionResult {
	if path == "" {
		path = "/"
	}
	// List directories and files with type indicator
	cmd := fmt.Sprintf("ls -la %s 2>/dev/null | tail -n +2", path)
	return e.ExecuteCommand(host, cmd)
}

// ========================================
// Process Management
// ========================================

type ProcessInfo struct {
	PID     string  `json:"pid"`
	User    string  `json:"user"`
	CPU     float64 `json:"cpu"`
	Memory  float64 `json:"memory"`
	VSZ     string  `json:"vsz"`
	RSS     string  `json:"rss"`
	TTY     string  `json:"tty"`
	Stat    string  `json:"stat"`
	Start   string  `json:"start"`
	Time    string  `json:"time"`
	Command string  `json:"command"`
}

func (e *Executor) ListProcesses(host *HostConfig, sortBy string) ([]ProcessInfo, error) {
	var cmd string
	switch sortBy {
	case "cpu":
		cmd = "ps aux --sort=-%cpu | head -50"
	case "memory", "mem":
		cmd = "ps aux --sort=-%mem | head -50"
	default:
		cmd = "ps aux --sort=-%cpu | head -50"
	}
	
	result := e.ExecuteCommand(host, cmd)
	if result.Error != "" {
		return nil, fmt.Errorf(result.Error)
	}
	
	var processes []ProcessInfo
	lines := strings.Split(result.Output, "\n")
	for i, line := range lines {
		if i == 0 || line == "" { // Skip header
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 11 {
			cpu, _ := strconv.ParseFloat(fields[2], 64)
			mem, _ := strconv.ParseFloat(fields[3], 64)
			processes = append(processes, ProcessInfo{
				PID:     fields[1],
				User:    fields[0],
				CPU:     cpu,
				Memory:  mem,
				VSZ:     fields[4],
				RSS:     fields[5],
				TTY:     fields[6],
				Stat:    fields[7],
				Start:   fields[8],
				Time:    fields[9],
				Command: strings.Join(fields[10:], " "),
			})
		}
	}
	return processes, nil
}

func (e *Executor) KillProcess(host *HostConfig, pid string, signal string) *ActionResult {
	if signal == "" {
		signal = "TERM"
	}
	// Validate PID is numeric
	if _, err := strconv.Atoi(pid); err != nil {
		return &ActionResult{Error: fmt.Sprintf("invalid PID: %s", pid)}
	}
	cmd := fmt.Sprintf("sudo kill -%s %s", signal, pid)
	return e.ExecuteCommand(host, cmd)
}

func (e *Executor) GetProcessDetails(host *HostConfig, pid string) *ActionResult {
	cmd := fmt.Sprintf("ps -p %s -o pid,ppid,user,%%cpu,%%mem,vsz,rss,tty,stat,start,time,comm,args --no-headers 2>/dev/null && echo '---' && ls -la /proc/%s/fd 2>/dev/null | wc -l", pid, pid)
	return e.ExecuteCommand(host, cmd)
}

// ========================================
// Firewall Management (UFW/iptables)
// ========================================

type FirewallRule struct {
	ID       string `json:"id"`
	Number   int    `json:"number"`
	To       string `json:"to"`
	Action   string `json:"action"`
	From     string `json:"from"`
	Port     string `json:"port"`
	Protocol string `json:"protocol"`
	V6       bool   `json:"v6"`
	RawRule  string `json:"raw_rule"`
}

type FirewallStatus struct {
	Active   bool           `json:"active"`
	Type     string         `json:"type"` // ufw or iptables
	Rules    []FirewallRule `json:"rules"`
	Default  string         `json:"default"`
}

func (e *Executor) GetFirewallStatus(host *HostConfig) (*FirewallStatus, error) {
	// Try UFW first
	result := e.ExecuteCommand(host, "sudo ufw status numbered 2>/dev/null")
	if result.Error == "" && !strings.Contains(result.Output, "command not found") {
		return e.parseUFWStatus(result.Output), nil
	}
	
	// Fallback to iptables
	result = e.ExecuteCommand(host, "sudo iptables -L -n --line-numbers 2>/dev/null")
	if result.Error != "" {
		return &FirewallStatus{Active: false, Type: "none"}, nil
	}
	return e.parseIptablesStatus(result.Output), nil
}

func (e *Executor) parseUFWStatus(output string) *FirewallStatus {
	status := &FirewallStatus{Type: "ufw", Rules: []FirewallRule{}}
	
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.Contains(line, "Status: active") {
			status.Active = true
		} else if strings.Contains(line, "Status: inactive") {
			status.Active = false
		}
		
		// Parse rules like: [ 1] 22/tcp                     ALLOW IN    Anywhere
		if strings.HasPrefix(line, "[") {
			parts := strings.Fields(line)
			if len(parts) >= 4 {
				numStr := strings.Trim(parts[0], "[]")
				num, _ := strconv.Atoi(numStr)
				
				rule := FirewallRule{
					ID:      numStr,
					Number:  num,
					RawRule: line,
				}
				
				// Parse port/protocol
				if len(parts) > 1 {
					portProto := parts[1]
					if strings.Contains(portProto, "/") {
						pp := strings.Split(portProto, "/")
						rule.Port = pp[0]
						rule.Protocol = pp[1]
					} else {
						rule.Port = portProto
					}
					rule.To = portProto
				}
				
				// Parse action
				for _, p := range parts {
					if p == "ALLOW" || p == "DENY" || p == "REJECT" || p == "LIMIT" {
						rule.Action = p
						break
					}
				}
				
				// Check for v6
				if strings.Contains(line, "(v6)") {
					rule.V6 = true
				}
				
				// Parse from
				for i, p := range parts {
					if p == "Anywhere" || strings.Contains(p, ".") || strings.Contains(p, ":") {
						if i > 2 {
							rule.From = p
						}
					}
				}
				
				status.Rules = append(status.Rules, rule)
			}
		}
	}
	return status
}

func (e *Executor) parseIptablesStatus(output string) *FirewallStatus {
	status := &FirewallStatus{Type: "iptables", Active: true, Rules: []FirewallRule{}}
	
	lines := strings.Split(output, "\n")
	ruleNum := 0
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "Chain") || line == "" || strings.HasPrefix(line, "num") {
			continue
		}
		
		parts := strings.Fields(line)
		if len(parts) >= 4 {
			ruleNum++
			rule := FirewallRule{
				ID:      fmt.Sprintf("%d", ruleNum),
				Number:  ruleNum,
				Action:  parts[1],
				RawRule: line,
			}
			
			// Try to extract port
			for i, p := range parts {
				if p == "dpt:" || strings.HasPrefix(p, "dpt:") {
					if strings.HasPrefix(p, "dpt:") {
						rule.Port = strings.TrimPrefix(p, "dpt:")
					} else if i+1 < len(parts) {
						rule.Port = parts[i+1]
					}
				}
				if p == "tcp" || p == "udp" {
					rule.Protocol = p
				}
			}
			
			status.Rules = append(status.Rules, rule)
		}
	}
	return status
}

func (e *Executor) AddFirewallRule(host *HostConfig, ruleType, port, protocol, fromIP, action string) *ActionResult {
	// Check if UFW is available
	checkCmd := "which ufw 2>/dev/null"
	checkResult := e.ExecuteCommand(host, checkCmd)
	
	if strings.TrimSpace(checkResult.Output) != "" {
		// Use UFW
		var cmd string
		if action == "" {
			action = "allow"
		}
		if fromIP != "" && fromIP != "any" {
			cmd = fmt.Sprintf("sudo ufw %s from %s to any port %s", action, fromIP, port)
		} else {
			if protocol != "" {
				cmd = fmt.Sprintf("sudo ufw %s %s/%s", action, port, protocol)
			} else {
				cmd = fmt.Sprintf("sudo ufw %s %s", action, port)
			}
		}
		return e.ExecuteCommand(host, cmd)
	}
	
	// Fallback to iptables
	if action == "" || action == "allow" {
		action = "ACCEPT"
	} else if action == "deny" {
		action = "DROP"
	}
	if protocol == "" {
		protocol = "tcp"
	}
	
	cmd := fmt.Sprintf("sudo iptables -A INPUT -p %s --dport %s -j %s", protocol, port, action)
	if fromIP != "" && fromIP != "any" {
		cmd = fmt.Sprintf("sudo iptables -A INPUT -s %s -p %s --dport %s -j %s", fromIP, protocol, port, action)
	}
	return e.ExecuteCommand(host, cmd)
}

func (e *Executor) DeleteFirewallRule(host *HostConfig, ruleNumber int) *ActionResult {
	// Try UFW first
	checkCmd := "which ufw 2>/dev/null"
	checkResult := e.ExecuteCommand(host, checkCmd)
	
	if strings.TrimSpace(checkResult.Output) != "" {
		cmd := fmt.Sprintf("sudo ufw --force delete %d", ruleNumber)
		return e.ExecuteCommand(host, cmd)
	}
	
	// Fallback to iptables
	cmd := fmt.Sprintf("sudo iptables -D INPUT %d", ruleNumber)
	return e.ExecuteCommand(host, cmd)
}

func (e *Executor) ToggleFirewall(host *HostConfig, enable bool) *ActionResult {
	// Try UFW first
	checkCmd := "which ufw 2>/dev/null"
	checkResult := e.ExecuteCommand(host, checkCmd)
	
	if strings.TrimSpace(checkResult.Output) != "" {
		var cmd string
		if enable {
			cmd = "sudo ufw --force enable"
		} else {
			cmd = "sudo ufw disable"
		}
		return e.ExecuteCommand(host, cmd)
	}
	
	return &ActionResult{Error: "UFW not found. Manual iptables management required."}
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
		keyPath := host.KeyPath
		// Expand tilde to home directory
		if strings.HasPrefix(keyPath, "~/") {
			if home, err := os.UserHomeDir(); err == nil {
				keyPath = home + keyPath[1:]
			}
		}
		key, err := os.ReadFile(keyPath)
		if err == nil {
			var signer ssh.Signer
			if host.Passphrase != "" {
				signer, err = ssh.ParsePrivateKeyWithPassphrase(key, []byte(host.Passphrase))
			} else {
				signer, err = ssh.ParsePrivateKey(key)
			}
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
