#!/bin/bash

# binsh GitHub Release Creator
# Requires: GitHub CLI (gh) to be installed and authenticated

VERSION="${VERSION:-1.0.0-beta}"
BUILD_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="${BUILD_DIR}/dist"

echo "========================================="
echo "🚀 binsh Release Creator v${VERSION}"
echo "========================================="
echo ""

# Check for GitHub CLI
if ! command -v gh &> /dev/null; then
    echo "⚠️  GitHub CLI (gh) not found."
    echo ""
    echo "To install:"
    echo "  Linux: sudo apt install gh OR sudo dnf install gh"
    echo "  macOS: brew install gh"
    echo ""
    echo "After installing, authenticate with:"
    echo "  gh auth login"
    echo ""
    echo "Manual release instructions:"
    echo "1. Go to: https://github.com/onedord1/binsh/releases/new"
    echo "2. Create tag: v${VERSION}"
    echo "3. Title: binsh v${VERSION}"
    echo "4. Upload these files from ${DIST_DIR}/:"
    ls -1 "${DIST_DIR}/" | grep -E '\.(deb|rpm|tar\.gz)$' | while read f; do
        echo "   - $f"
    done
    echo ""
    exit 0
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub."
    echo "Run: gh auth login"
    exit 1
fi

# Create release notes
RELEASE_NOTES=$(cat << EOF
## binsh v${VERSION}

Modern SSH Client & Server Management Platform

### 🆕 What's New

- Initial beta release
- Multi-server management with groups and tags
- Secure credential storage with AES-256 encryption
- SFTP file manager with dual-pane interface
- Cloud provider integration (AWS, GCP, Azure, DigitalOcean, Linode)
- Port forwarding management
- Command snippets library
- Real-time system metrics
- Import/Export hosts (SSH config, JSON, CSV)

### 📦 Installation

**Debian/Ubuntu:**
\`\`\`bash
sudo dpkg -i binsh_${VERSION}_amd64.deb
\`\`\`

**Fedora/RHEL/CentOS:**
\`\`\`bash
sudo rpm -i binsh-${VERSION//-/.}-1.x86_64.rpm
\`\`\`

**Generic Linux:**
\`\`\`bash
tar -xzf binsh-${VERSION}-linux-amd64.tar.gz
./binsh
\`\`\`

### 🚀 Quick Start

1. Run \`binsh\`
2. Open http://localhost:9876
3. Register and set up vault
4. Add your first host!

### 📚 Documentation

See [docs/](https://github.com/onedord1/binsh/tree/stage/docs) for full documentation.
EOF
)

echo "Creating GitHub release v${VERSION}..."

# Create the release
gh release create "v${VERSION}" \
    --title "binsh v${VERSION}" \
    --notes "${RELEASE_NOTES}" \
    --prerelease \
    "${DIST_DIR}/binsh_${VERSION}_amd64.deb" \
    "${DIST_DIR}/binsh-${VERSION//-/.}-1.x86_64.rpm" \
    "${DIST_DIR}/binsh-${VERSION}-linux-amd64.tar.gz"

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "✅ Release created successfully!"
    echo "========================================="
    echo ""
    echo "View at: https://github.com/onedord1/binsh/releases/tag/v${VERSION}"
else
    echo ""
    echo "❌ Failed to create release"
    exit 1
fi
