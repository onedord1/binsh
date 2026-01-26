#!/bin/bash
set -e

# binsh Snap Package Builder
# Builds snap package for Ubuntu Snap Store

VERSION="${VERSION:-1.0.0-beta}"
BUILD_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "========================================="
echo "📦 Building Snap package for binsh v${VERSION}"
echo "========================================="
echo ""

# Check for snapcraft
if ! command -v snapcraft &> /dev/null; then
    echo "❌ snapcraft not found."
    echo ""
    echo "On Arch Linux, install with:"
    echo "  1. Enable and start snapd:"
    echo "     sudo systemctl enable --now snapd.socket"
    echo "     sudo ln -s /var/lib/snapd/snap /snap"
    echo ""
    echo "  2. Install snapcraft:"
    echo "     sudo snap install snapcraft --classic"
    echo ""
    echo "  3. Log out and back in, then run this script again."
    exit 1
fi

# Check for LXD (required for building on non-Ubuntu)
if ! command -v lxd &> /dev/null; then
    echo "⚠️  LXD not found. Snapcraft needs LXD to build on non-Ubuntu systems."
    echo ""
    echo "On Arch Linux, install with:"
    echo "  sudo snap install lxd"
    echo "  sudo lxd init --auto"
    echo "  sudo usermod -aG lxd $USER"
    echo ""
    echo "Log out and back in, then run this script again."
    echo ""
    echo "Alternatively, use --use-lxd or --destructive-mode flags."
fi

cd "${BUILD_DIR}"

echo "🔧 Cleaning previous builds..."
snapcraft clean 2>/dev/null || true

echo ""
echo "🏗️  Building snap package..."
echo "   This may take a while on first run..."
echo ""

# Build with LXD (recommended for non-Ubuntu)
snapcraft --use-lxd

# Find the built snap
SNAP_FILE=$(ls -1 *.snap 2>/dev/null | head -1)

if [ -z "${SNAP_FILE}" ]; then
    echo "❌ Snap build failed. No .snap file found."
    exit 1
fi

# Move to dist directory
mkdir -p dist
mv "${SNAP_FILE}" dist/

echo ""
echo "========================================="
echo "✅ Snap package built successfully!"
echo "========================================="
echo ""
echo "Package: dist/${SNAP_FILE}"
echo "Size: $(du -h "dist/${SNAP_FILE}" | cut -f1)"
echo ""
echo "To test locally:"
echo "  sudo snap install --dangerous dist/${SNAP_FILE}"
echo ""
echo "To publish to Snap Store:"
echo "  1. Login: snapcraft login"
echo "  2. Register name: snapcraft register binsh"
echo "  3. Push: snapcraft upload dist/${SNAP_FILE} --release=beta"
