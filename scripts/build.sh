#!/bin/bash
set -e

# binsh Build Script
# Builds frontend and backend into a single binary

VERSION="${VERSION:-1.0.0-beta}"
BUILD_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="${BUILD_DIR}/dist"

echo "🔨 Building binsh v${VERSION}"
echo "📁 Build directory: ${BUILD_DIR}"

# Clean previous builds
rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"

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

# Step 2: Copy frontend to backend static directory
echo ""
echo "📋 Step 2: Copying frontend to backend..."
STATIC_DIR="${BUILD_DIR}/backend/cmd/systask/static"
rm -rf "${STATIC_DIR}"
mkdir -p "${STATIC_DIR}"
cp -r "${BUILD_DIR}/frontend/dist/"* "${STATIC_DIR}/"
echo "   ✅ Frontend copied to ${STATIC_DIR}"

# Step 3: Build Backend
echo ""
echo "🔧 Step 3: Building backend..."
cd "${BUILD_DIR}/backend"

# Get build info
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Build for current platform
echo "   Building for current platform..."
CGO_ENABLED=0 go build \
    -ldflags="-s -w -X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME} -X main.GitCommit=${GIT_COMMIT}" \
    -o "${OUTPUT_DIR}/binsh" \
    ./cmd/systask

echo "   ✅ Backend built successfully"

# Step 4: Build for multiple platforms (optional)
if [ "$BUILD_ALL" = "true" ]; then
    echo ""
    echo "🌍 Building for multiple platforms..."
    
    platforms=(
        "linux/amd64"
        "linux/arm64"
        "darwin/amd64"
        "darwin/arm64"
        "windows/amd64"
    )
    
    for platform in "${platforms[@]}"; do
        GOOS="${platform%/*}"
        GOARCH="${platform#*/}"
        output_name="binsh-${GOOS}-${GOARCH}"
        
        if [ "$GOOS" = "windows" ]; then
            output_name="${output_name}.exe"
        fi
        
        echo "   Building ${GOOS}/${GOARCH}..."
        CGO_ENABLED=0 GOOS=$GOOS GOARCH=$GOARCH go build \
            -ldflags="-s -w -X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME} -X main.GitCommit=${GIT_COMMIT}" \
            -o "${OUTPUT_DIR}/${output_name}" \
            ./cmd/systask
    done
    
    echo "   ✅ All platforms built"
fi

# Summary
echo ""
echo "========================================="
echo "✅ Build complete!"
echo "========================================="
echo ""
echo "Output files:"
ls -lh "${OUTPUT_DIR}/"
echo ""
echo "To run: ${OUTPUT_DIR}/binsh"
echo "Access: http://localhost:9876"
