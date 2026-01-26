package cloud

import (
	"fmt"
	"systask/internal/storage"
)

// Instance representing a cloud virtual machine
type Instance struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	IPAddress string            `json:"ip_address"`
	Status    string            `json:"status"`
	Region    string            `json:"region"`
	Provider  string            `json:"provider"`
	Tags      map[string]string `json:"tags"`
	Metadata  map[string]string `json:"metadata"`
}

// Provider interface for cloud service integrations
type Provider interface {
	ListInstances(config storage.CloudConfig) ([]Instance, error)
	GetStatus() string
}

// NewProvider returns a cloud provider implementation based on type
func NewProvider(providerType string) (Provider, error) {
	switch providerType {
	case "aws":
		return &AWSProvider{}, nil
	case "digitalocean":
		return &DOProvider{}, nil
	case "azure":
		return &AzureProvider{}, nil
	case "mock":
		return &MockProvider{}, nil
	default:
		return nil, fmt.Errorf("unsupported provider: %s", providerType)
	}
}

// ========================================
// Mock Provider Implementation
// ========================================

type MockProvider struct{}

func (p *MockProvider) ListInstances(config storage.CloudConfig) ([]Instance, error) {
	return []Instance{
		{
			ID:        "i-0a1b2c3d4e5f6g7h8",
			Name:      "prod-web-01",
			IPAddress: "54.23.45.67",
			Status:    "running",
			Region:    "us-east-1",
			Provider:  "aws",
		},
		{
			ID:        "droplet-987654321",
			Name:      "dev-db-01",
			IPAddress: "159.203.45.12",
			Status:    "running",
			Region:    "nyc3",
			Provider:  "digitalocean",
		},
		{
			ID:        "azure-vm-xyz",
			Name:      "staging-api-01",
			IPAddress: "40.112.34.56",
			Status:    "stopped",
			Region:    "westus",
			Provider:  "azure",
		},
	}, nil
}

func (p *MockProvider) GetStatus() string {
	return "Simulated"
}

// ========================================
// AWS Provider (Placeholder/Mock for now)
// ========================================

type AWSProvider struct{}

func (p *AWSProvider) ListInstances(config storage.CloudConfig) ([]Instance, error) {
	if config.AccessKeyID == "" {
		return nil, fmt.Errorf("AWS Access Key is required")
	}
	// No real implementation yet, return empty list instead of fake data
	return []Instance{}, nil
}

func (p *AWSProvider) GetStatus() string {
	return "AWS (Simulated)"
}

// ========================================
// DigitalOcean Provider
// ========================================

type DOProvider struct{}

func (p *DOProvider) ListInstances(config storage.CloudConfig) ([]Instance, error) {
	if config.AccessKeyID == "" { // Assume token is required
		return nil, fmt.Errorf("Access Token is required")
	}
	return []Instance{}, nil
}

func (p *DOProvider) GetStatus() string {
	return "DigitalOcean (Simulated)"
}

// ========================================
// Azure Provider
// ========================================

type AzureProvider struct{}

func (p *AzureProvider) ListInstances(config storage.CloudConfig) ([]Instance, error) {
	if config.AccessKeyID == "" {
		return nil, fmt.Errorf("Azure Client ID is required")
	}
	return []Instance{}, nil
}

func (p *AzureProvider) GetStatus() string {
	return "Azure (Simulated)"
}
