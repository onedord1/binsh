#!/bin/bash
set -e

# binsh Release Script
# Builds and packages binsh for distribution

VERSION="${VERSION:-1.0.0-beta}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "========================================="
echo "🚀 binsh Release Builder v${VERSION}"
echo "========================================="
echo ""

# Step 1: Build the application
echo "📦 Step 1: Building application..."
"${SCRIPT_DIR}/build.sh"

# Step 2: Build Debian package
echo ""
echo "📦 Step 2: Building Debian package..."
if command -v dpkg-deb &> /dev/null; then
    VERSION="${VERSION}" "${SCRIPT_DIR}/package-deb.sh"
else
    echo "   ⚠️  Skipping .deb (dpkg-deb not found)"
fi

# Step 3: Build RPM package
echo ""
echo "📦 Step 3: Building RPM package..."
if command -v rpmbuild &> /dev/null; then
    VERSION="${VERSION}" "${SCRIPT_DIR}/package-rpm.sh"
else
    echo "   ⚠️  Skipping .rpm (rpmbuild not found)"
    echo "   Install with: sudo apt install rpm OR sudo dnf install rpm-build"
fi

# Step 4: Create release archives
echo ""
echo "📦 Step 4: Creating release archives..."
cd "${BUILD_DIR}/dist"

# Create tar.gz for Linux
if [ -f "binsh" ]; then
    tar -czvf "binsh-${VERSION}-linux-amd64.tar.gz" binsh
    echo "   ✅ Created binsh-${VERSION}-linux-amd64.tar.gz"
fi

# Summary
echo ""
echo "========================================="
echo "✅ Release build complete!"
echo "========================================="
echo ""
echo "Release artifacts in ${BUILD_DIR}/dist/:"
ls -lh "${BUILD_DIR}/dist/"
echo ""
echo "Upload these files to GitHub Releases:"
echo "  - binsh-${VERSION}-linux-amd64.tar.gz"
echo "  - binsh_${VERSION}_amd64.deb (if built)"
echo "  - binsh-${VERSION}-*.rpm (if built)"
