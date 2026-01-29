#!/bin/bash
set -e

# binsh Electron Build Script
# Builds frontend, backend, and packages as Electron desktop app

VERSION="${VERSION:-1.0.0}"
BUILD_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "🖥️  Building binsh Desktop App v${VERSION}"
echo "📁 Build directory: ${BUILD_DIR}"

# Step 1: Build Frontend
echo ""
echo "📦 Step 1: Building frontend..."
cd "${BUILD_DIR}/frontend"

if [ ! -d "node_modules" ]; then
    echo "   Installing npm dependencies..."
    npm install
fi

npm run build
echo "   ✅ Frontend built successfully"

# Step 2: Build Backend with embedded frontend
echo ""
echo "🔧 Step 2: Building backend..."
cd "${BUILD_DIR}/backend"

# Copy frontend to backend static directory
STATIC_DIR="${BUILD_DIR}/backend/cmd/systask/static"
rm -rf "${STATIC_DIR}"
mkdir -p "${STATIC_DIR}"
cp -r "${BUILD_DIR}/frontend/dist/"* "${STATIC_DIR}/"

# Create dist directory
mkdir -p "${BUILD_DIR}/dist"

# Build for Linux
echo "   Building for Linux..."
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -X main.Version=${VERSION}" \
    -o "${BUILD_DIR}/dist/binsh" \
    ./cmd/systask

chmod +x "${BUILD_DIR}/dist/binsh"
echo "   ✅ Backend built successfully"

# Step 3: Install Electron dependencies
echo ""
echo "⚡ Step 3: Installing Electron dependencies..."
cd "${BUILD_DIR}/electron"

if [ ! -d "node_modules" ]; then
    npm install
fi
echo "   ✅ Electron dependencies installed"

# Step 4: Build Electron app
echo ""
echo "📦 Step 4: Building Electron app..."

# Build for requested target or all Linux targets
TARGET="${1:-linux}"

case $TARGET in
    "snap")
        npm run build:snap
        ;;
    "deb")
        npm run build:deb
        ;;
    "rpm")
        npm run build:rpm
        ;;
    "appimage")
        npm run build:appimage
        ;;
    "linux")
        npm run build:linux
        ;;
    *)
        echo "Unknown target: $TARGET"
        echo "Usage: $0 [snap|deb|rpm|appimage|linux]"
        exit 1
        ;;
esac

echo ""
echo "✅ Build complete!"
echo "📦 Output files are in: ${BUILD_DIR}/electron/release/"
ls -la "${BUILD_DIR}/electron/release/" 2>/dev/null || echo "   (No files yet - check for errors)"
