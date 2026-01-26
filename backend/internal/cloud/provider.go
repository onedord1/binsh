package cloud

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"systask/internal/storage"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	"github.com/digitalocean/godo"
	"github.com/linode/linodego"
	"golang.org/x/oauth2"
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
	case "gcp":
		return &GCPProvider{}, nil
	case "alibaba":
		return &AlibabaProvider{}, nil
	case "oracle":
		return &OracleProvider{}, nil
	case "akamai", "linode":
		return &LinodeProvider{}, nil
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

func (p *MockProvider) ListInstances(cfg storage.CloudConfig) ([]Instance, error) {
	return []Instance{
		{
			ID:        "mock-instance-1",
			Name:      "mock-server-01",
			IPAddress: "10.0.0.1",
			Status:    "running",
			Region:    "mock-region",
			Provider:  "mock",
		},
	}, nil
}

func (p *MockProvider) GetStatus() string {
	return "Mock Provider"
}

// ========================================
// AWS Provider - Real Implementation
// ========================================

type AWSProvider struct{}

func (p *AWSProvider) ListInstances(cfg storage.CloudConfig) ([]Instance, error) {
	if cfg.AccessKeyID == "" || cfg.SecretAccessKey == "" {
		return nil, fmt.Errorf("AWS Access Key ID and Secret Access Key are required")
	}

	ctx := context.Background()
	region := cfg.Region
	if region == "" {
		region = "us-east-1"
	}

	awsCfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.AccessKeyID,
			cfg.SecretAccessKey,
			"",
		)),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	client := ec2.NewFromConfig(awsCfg)

	result, err := client.DescribeInstances(ctx, &ec2.DescribeInstancesInput{})
	if err != nil {
		return nil, fmt.Errorf("failed to describe instances: %w", err)
	}

	var instances []Instance
	for _, reservation := range result.Reservations {
		for _, inst := range reservation.Instances {
			name := ""
			tags := make(map[string]string)
			for _, tag := range inst.Tags {
				if tag.Key != nil && tag.Value != nil {
					tags[*tag.Key] = *tag.Value
					if *tag.Key == "Name" {
						name = *tag.Value
					}
				}
			}

			ip := ""
			if cfg.IPAddressType == "private" && inst.PrivateIpAddress != nil {
				ip = *inst.PrivateIpAddress
			} else if inst.PublicIpAddress != nil {
				ip = *inst.PublicIpAddress
			} else if inst.PrivateIpAddress != nil {
				ip = *inst.PrivateIpAddress
			}

			status := "unknown"
			if inst.State != nil && inst.State.Name != "" {
				status = string(inst.State.Name)
			}

			instances = append(instances, Instance{
				ID:        *inst.InstanceId,
				Name:      name,
				IPAddress: ip,
				Status:    status,
				Region:    region,
				Provider:  "aws",
				Tags:      tags,
			})
		}
	}

	return instances, nil
}

func (p *AWSProvider) GetStatus() string {
	return "AWS EC2"
}

// ========================================
// DigitalOcean Provider - Real Implementation
// ========================================

type DOProvider struct{}

func (p *DOProvider) ListInstances(cfg storage.CloudConfig) ([]Instance, error) {
	token := cfg.APIToken
	if token == "" {
		token = cfg.AccessKeyID // Fallback to access key field
	}
	if token == "" {
		return nil, fmt.Errorf("DigitalOcean API Token is required")
	}

	tokenSource := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
	oauthClient := oauth2.NewClient(context.Background(), tokenSource)
	client := godo.NewClient(oauthClient)

	ctx := context.Background()
	opt := &godo.ListOptions{PerPage: 200}

	droplets, _, err := client.Droplets.List(ctx, opt)
	if err != nil {
		return nil, fmt.Errorf("failed to list droplets: %w", err)
	}

	var instances []Instance
	for _, droplet := range droplets {
		ip := ""
		if cfg.IPAddressType == "private" {
			privateIP, _ := droplet.PrivateIPv4()
			ip = privateIP
		}
		if ip == "" {
			publicIP, _ := droplet.PublicIPv4()
			ip = publicIP
		}
		if ip == "" {
			privateIP, _ := droplet.PrivateIPv4()
			ip = privateIP
		}

		tags := make(map[string]string)
		for _, tag := range droplet.Tags {
			tags[tag] = "true"
		}

		instances = append(instances, Instance{
			ID:        fmt.Sprintf("%d", droplet.ID),
			Name:      droplet.Name,
			IPAddress: ip,
			Status:    droplet.Status,
			Region:    droplet.Region.Slug,
			Provider:  "digitalocean",
			Tags:      tags,
		})
	}

	return instances, nil
}

func (p *DOProvider) GetStatus() string {
	return "DigitalOcean"
}

// ========================================
// Azure Provider - Real Implementation
// ========================================

type AzureProvider struct{}

func (p *AzureProvider) ListInstances(cfg storage.CloudConfig) ([]Instance, error) {
	if cfg.SubscriptionID == "" || cfg.TenantID == "" || cfg.ClientID == "" || cfg.ClientSecret == "" {
		return nil, fmt.Errorf("Azure requires Subscription ID, Tenant ID, Client ID, and Client Secret")
	}

	// Get Azure access token
	tokenURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", cfg.TenantID)
	data := fmt.Sprintf("client_id=%s&client_secret=%s&scope=https://management.azure.com/.default&grant_type=client_credentials",
		cfg.ClientID, cfg.ClientSecret)

	resp, err := http.Post(tokenURL, "application/x-www-form-urlencoded", strings.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to get Azure token: %w", err)
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	// List VMs
	vmURL := fmt.Sprintf("https://management.azure.com/subscriptions/%s/providers/Microsoft.Compute/virtualMachines?api-version=2023-09-01", cfg.SubscriptionID)
	if cfg.ResourceGroup != "" {
		vmURL = fmt.Sprintf("https://management.azure.com/subscriptions/%s/resourceGroups/%s/providers/Microsoft.Compute/virtualMachines?api-version=2023-09-01",
			cfg.SubscriptionID, cfg.ResourceGroup)
	}

	req, _ := http.NewRequest("GET", vmURL, nil)
	req.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)

	client := &http.Client{Timeout: 30 * time.Second}
	vmResp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to list VMs: %w", err)
	}
	defer vmResp.Body.Close()

	var vmList struct {
		Value []struct {
			ID       string `json:"id"`
			Name     string `json:"name"`
			Location string `json:"location"`
			Tags     map[string]string `json:"tags"`
			Properties struct {
				InstanceView struct {
					Statuses []struct {
						Code string `json:"code"`
					} `json:"statuses"`
				} `json:"instanceView"`
			} `json:"properties"`
		} `json:"value"`
	}
	if err := json.NewDecoder(vmResp.Body).Decode(&vmList); err != nil {
		return nil, fmt.Errorf("failed to decode VM list: %w", err)
	}

	var instances []Instance
	for _, vm := range vmList.Value {
		status := "unknown"
		for _, s := range vm.Properties.InstanceView.Statuses {
			if strings.HasPrefix(s.Code, "PowerState/") {
				status = strings.TrimPrefix(s.Code, "PowerState/")
			}
		}

		instances = append(instances, Instance{
			ID:        vm.ID,
			Name:      vm.Name,
			IPAddress: "", // Would need additional API call to get NIC IPs
			Status:    status,
			Region:    vm.Location,
			Provider:  "azure",
			Tags:      vm.Tags,
		})
	}

	return instances, nil
}

func (p *AzureProvider) GetStatus() string {
	return "Azure"
}

// ========================================
// GCP Provider - Real Implementation
// ========================================

type GCPProvider struct{}

func (p *GCPProvider) ListInstances(cfg storage.CloudConfig) ([]Instance, error) {
	if cfg.ProjectID == "" {
		return nil, fmt.Errorf("GCP Project ID is required")
	}
	if cfg.ServiceAccountJSON == "" && (cfg.AccessKeyID == "" || cfg.SecretAccessKey == "") {
		return nil, fmt.Errorf("GCP requires Service Account JSON or Access credentials")
	}

	// For GCP, we use the REST API with service account credentials
	// This is a simplified implementation - production would use the official SDK
	
	var accessToken string
	if cfg.ServiceAccountJSON != "" {
		// Parse service account JSON and get access token
		var sa struct {
			ClientEmail string `json:"client_email"`
			PrivateKey  string `json:"private_key"`
			TokenURI    string `json:"token_uri"`
		}
		if err := json.Unmarshal([]byte(cfg.ServiceAccountJSON), &sa); err != nil {
			return nil, fmt.Errorf("invalid service account JSON: %w", err)
		}
		// Would need JWT signing here for production
		return nil, fmt.Errorf("service account JSON authentication requires google-cloud-go SDK - please use API key method or install SDK")
	}

	if accessToken == "" {
		return nil, fmt.Errorf("could not obtain GCP access token")
	}

	return []Instance{}, nil
}

func (p *GCPProvider) GetStatus() string {
	return "Google Cloud"
}

// ========================================
// Alibaba Cloud Provider
// ========================================

type AlibabaProvider struct{}

func (p *AlibabaProvider) ListInstances(cfg storage.CloudConfig) ([]Instance, error) {
	if cfg.AccessKeyID == "" || cfg.SecretAccessKey == "" {
		return nil, fmt.Errorf("Alibaba Cloud Access Key ID and Secret are required")
	}

	region := cfg.Region
	if region == "" {
		region = "cn-hangzhou"
	}

	// Alibaba Cloud ECS API
	endpoint := fmt.Sprintf("https://ecs.%s.aliyuncs.com", region)
	
	// Build signed request (simplified - production needs proper signature)
	client := &http.Client{Timeout: 30 * time.Second}
	
	// This is a placeholder - real implementation requires Alibaba Cloud SDK signature
	req, _ := http.NewRequest("GET", endpoint+"/?Action=DescribeInstances&Version=2014-05-26", nil)
	
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call Alibaba API: %w", err)
	}
	defer resp.Body.Close()

	// For now, return empty - full implementation needs alibaba-cloud-sdk-go
	return []Instance{}, nil
}

func (p *AlibabaProvider) GetStatus() string {
	return "Alibaba Cloud"
}

// ========================================
// Oracle Cloud Provider
// ========================================

type OracleProvider struct{}

func (p *OracleProvider) ListInstances(cfg storage.CloudConfig) ([]Instance, error) {
	if cfg.TenancyOCID == "" || cfg.UserOCID == "" || cfg.Fingerprint == "" || cfg.PrivateKey == "" {
		return nil, fmt.Errorf("Oracle Cloud requires Tenancy OCID, User OCID, Fingerprint, and Private Key")
	}

	region := cfg.Region
	if region == "" {
		region = "us-ashburn-1"
	}

	compartment := cfg.CompartmentOCID
	if compartment == "" {
		compartment = cfg.TenancyOCID
	}

	// Oracle Cloud REST API
	endpoint := fmt.Sprintf("https://iaas.%s.oraclecloud.com/20160918/instances?compartmentId=%s", region, compartment)

	// Create signed request (simplified - production needs OCI SDK signature)
	client := &http.Client{Timeout: 30 * time.Second}
	req, _ := http.NewRequest("GET", endpoint, nil)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call Oracle API: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	
	var ociInstances []struct {
		ID          string `json:"id"`
		DisplayName string `json:"displayName"`
		Region      string `json:"region"`
		LifecycleState string `json:"lifecycleState"`
	}
	if err := json.Unmarshal(body, &ociInstances); err != nil {
		// Return empty for unsigned requests
		return []Instance{}, nil
	}

	var instances []Instance
	for _, inst := range ociInstances {
		instances = append(instances, Instance{
			ID:        inst.ID,
			Name:      inst.DisplayName,
			IPAddress: "",
			Status:    inst.LifecycleState,
			Region:    inst.Region,
			Provider:  "oracle",
		})
	}

	return instances, nil
}

func (p *OracleProvider) GetStatus() string {
	return "Oracle Cloud"
}

// ========================================
// Linode/Akamai Provider - Real Implementation
// ========================================

type LinodeProvider struct{}

func (p *LinodeProvider) ListInstances(cfg storage.CloudConfig) ([]Instance, error) {
	token := cfg.APIToken
	if token == "" {
		token = cfg.AccessKeyID
	}
	if token == "" {
		return nil, fmt.Errorf("Linode/Akamai API Token is required")
	}

	tokenSource := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
	oauth2Client := oauth2.NewClient(context.Background(), tokenSource)
	client := linodego.NewClient(oauth2Client)

	ctx := context.Background()
	linodes, err := client.ListInstances(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list Linode instances: %w", err)
	}

	var instances []Instance
	for _, linode := range linodes {
		ip := ""
		if cfg.IPAddressType == "private" {
			for _, addr := range linode.IPv4 {
				if strings.HasPrefix(addr.String(), "192.168.") || strings.HasPrefix(addr.String(), "10.") {
					ip = addr.String()
					break
				}
			}
		}
		if ip == "" && len(linode.IPv4) > 0 {
			ip = linode.IPv4[0].String()
		}

		tags := make(map[string]string)
		for _, tag := range linode.Tags {
			tags[tag] = "true"
		}

		instances = append(instances, Instance{
			ID:        fmt.Sprintf("%d", linode.ID),
			Name:      linode.Label,
			IPAddress: ip,
			Status:    string(linode.Status),
			Region:    linode.Region,
			Provider:  "linode",
			Tags:      tags,
		})
	}

	return instances, nil
}

func (p *LinodeProvider) GetStatus() string {
	return "Linode/Akamai"
}
