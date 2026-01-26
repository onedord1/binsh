#!/bin/bash
set -e

echo "🚀 Building SysTask Desktop Application for Snap Store"
echo "======================================================="

# Navigate to frontend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$FRONTEND_DIR"

# Step 1: Install dependencies
echo ""
echo "📦 Step 1: Installing dependencies..."
npm install

# Step 2: Build the Tauri application
echo ""
echo "🔨 Step 2: Building Tauri application..."
npm run tauri:build

# Step 3: Check if deb was created
DEB_FILE=$(find src-tauri/target/release/bundle/deb -name "*.deb" 2>/dev/null | head -n 1)
if [ -z "$DEB_FILE" ]; then
    echo "❌ Error: .deb file not found. Build may have failed."
    exit 1
fi
echo "✅ Debian package created: $DEB_FILE"

# Step 4: Build the snap
echo ""
echo "📦 Step 3: Building Snap package..."
cd "$FRONTEND_DIR"

# Check if snapcraft is installed
if ! command -v snapcraft &> /dev/null; then
    echo "⚠️  Snapcraft not found. Install it with: sudo snap install snapcraft --classic"
    echo ""
    echo "After installing snapcraft, run:"
    echo "  cd $FRONTEND_DIR && snapcraft"
    exit 0
fi

snapcraft

# Step 5: Show results
echo ""
echo "✅ Build complete!"
echo ""
SNAP_FILE=$(find . -maxdepth 1 -name "*.snap" | head -n 1)
if [ -n "$SNAP_FILE" ]; then
    echo "📦 Snap package: $SNAP_FILE"
    echo ""
    echo "To install locally:"
    echo "  sudo snap install $SNAP_FILE --dangerous"
    echo ""
    echo "To publish to Snap Store:"
    echo "  snapcraft login"
    echo "  snapcraft upload $SNAP_FILE --release=stable"
fi
