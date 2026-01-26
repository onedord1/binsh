#!/bin/bash
set -e

# binsh Debian Package Builder
# Creates .deb package for Debian/Ubuntu systems

VERSION="${VERSION:-1.0.0-beta}"
ARCH="${ARCH:-amd64}"
BUILD_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE_NAME="binsh"
PACKAGE_DIR="${BUILD_DIR}/dist/deb-build"
OUTPUT_DIR="${BUILD_DIR}/dist"

echo "📦 Building Debian package for binsh v${VERSION}"

# Ensure binary exists
if [ ! -f "${OUTPUT_DIR}/binsh" ]; then
    echo "❌ Binary not found. Run build.sh first."
    exit 1
fi

# Clean and create package directory structure
rm -rf "${PACKAGE_DIR}"
mkdir -p "${PACKAGE_DIR}/DEBIAN"
mkdir -p "${PACKAGE_DIR}/usr/bin"
mkdir -p "${PACKAGE_DIR}/usr/share/binsh/static"
mkdir -p "${PACKAGE_DIR}/usr/share/applications"
mkdir -p "${PACKAGE_DIR}/usr/share/icons/hicolor/16x16/apps"
mkdir -p "${PACKAGE_DIR}/usr/share/icons/hicolor/32x32/apps"
mkdir -p "${PACKAGE_DIR}/usr/share/icons/hicolor/48x48/apps"
mkdir -p "${PACKAGE_DIR}/usr/share/icons/hicolor/64x64/apps"
mkdir -p "${PACKAGE_DIR}/usr/share/icons/hicolor/128x128/apps"
mkdir -p "${PACKAGE_DIR}/usr/share/icons/hicolor/256x256/apps"
mkdir -p "${PACKAGE_DIR}/usr/share/icons/hicolor/512x512/apps"
mkdir -p "${PACKAGE_DIR}/usr/share/icons/hicolor/scalable/apps"
mkdir -p "${PACKAGE_DIR}/usr/share/doc/binsh"
mkdir -p "${PACKAGE_DIR}/lib/systemd/user"

# Copy binary
cp "${OUTPUT_DIR}/binsh" "${PACKAGE_DIR}/usr/bin/binsh"
chmod 755 "${PACKAGE_DIR}/usr/bin/binsh"

# Copy static files (frontend)
if [ -d "${BUILD_DIR}/backend/cmd/systask/static" ]; then
    cp -r "${BUILD_DIR}/backend/cmd/systask/static/"* "${PACKAGE_DIR}/usr/share/binsh/static/"
fi

# Copy documentation
cp "${BUILD_DIR}/README.md" "${PACKAGE_DIR}/usr/share/doc/binsh/"
cp -r "${BUILD_DIR}/docs/"* "${PACKAGE_DIR}/usr/share/doc/binsh/" 2>/dev/null || true

# Copy icons
ICONS_DIR="${BUILD_DIR}/assets/icons"
if [ -d "${ICONS_DIR}" ]; then
    cp "${ICONS_DIR}/binsh-16.png" "${PACKAGE_DIR}/usr/share/icons/hicolor/16x16/apps/binsh.png" 2>/dev/null || true
    cp "${ICONS_DIR}/binsh-32.png" "${PACKAGE_DIR}/usr/share/icons/hicolor/32x32/apps/binsh.png" 2>/dev/null || true
    cp "${ICONS_DIR}/binsh-48.png" "${PACKAGE_DIR}/usr/share/icons/hicolor/48x48/apps/binsh.png" 2>/dev/null || true
    cp "${ICONS_DIR}/binsh-64.png" "${PACKAGE_DIR}/usr/share/icons/hicolor/64x64/apps/binsh.png" 2>/dev/null || true
    cp "${ICONS_DIR}/binsh-128.png" "${PACKAGE_DIR}/usr/share/icons/hicolor/128x128/apps/binsh.png" 2>/dev/null || true
    cp "${ICONS_DIR}/binsh-256.png" "${PACKAGE_DIR}/usr/share/icons/hicolor/256x256/apps/binsh.png" 2>/dev/null || true
    cp "${ICONS_DIR}/binsh-512.png" "${PACKAGE_DIR}/usr/share/icons/hicolor/512x512/apps/binsh.png" 2>/dev/null || true
    cp "${ICONS_DIR}/binsh.svg" "${PACKAGE_DIR}/usr/share/icons/hicolor/scalable/apps/binsh.svg" 2>/dev/null || true
fi

# Create control file
cat > "${PACKAGE_DIR}/DEBIAN/control" << EOF
Package: ${PACKAGE_NAME}
Version: ${VERSION}
Section: net
Priority: optional
Architecture: ${ARCH}
Depends: libc6
Maintainer: binsh Team <support@binsh.dev>
Homepage: https://github.com/onedord1/binsh
Description: Modern SSH Client & Server Management Platform
 binsh is a powerful, feature-rich SSH client designed for DevOps
 engineers, system administrators, and developers who manage
 multiple servers.
 .
 Features include:
  - Multi-server management with groups and tags
  - Secure credential storage with AES-256 encryption
  - SFTP file manager with dual-pane interface
  - Cloud provider integration (AWS, GCP, Azure, etc.)
  - Port forwarding management
  - Command snippets library
  - Real-time system metrics
EOF

# Create postinst script
cat > "${PACKAGE_DIR}/DEBIAN/postinst" << 'EOF'
#!/bin/bash
set -e

# Create binsh group if it doesn't exist
if ! getent group binsh > /dev/null 2>&1; then
    groupadd -r binsh || true
fi

# Set correct permissions
chmod 755 /usr/bin/binsh

# Update icon cache
if command -v gtk-update-icon-cache &> /dev/null; then
    gtk-update-icon-cache -f /usr/share/icons/hicolor 2>/dev/null || true
fi

# Update desktop database
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database /usr/share/applications 2>/dev/null || true
fi

echo ""
echo "✅ binsh installed successfully!"
echo ""
echo "To start binsh:"
echo "  binsh"
echo ""
echo "Then open your browser to:"
echo "  http://localhost:9876"
echo ""
echo "Or enable the systemd user service:"
echo "  systemctl --user enable binsh"
echo "  systemctl --user start binsh"
echo ""

exit 0
EOF
chmod 755 "${PACKAGE_DIR}/DEBIAN/postinst"

# Create prerm script
cat > "${PACKAGE_DIR}/DEBIAN/prerm" << 'EOF'
#!/bin/bash
set -e

# Stop user service if running
systemctl --user stop binsh 2>/dev/null || true
systemctl --user disable binsh 2>/dev/null || true

exit 0
EOF
chmod 755 "${PACKAGE_DIR}/DEBIAN/prerm"

# Create desktop entry
cat > "${PACKAGE_DIR}/usr/share/applications/binsh.desktop" << EOF
[Desktop Entry]
Name=binsh
Comment=Modern SSH Client & Server Management
Exec=binsh
Icon=binsh
Terminal=false
Type=Application
Categories=Network;RemoteAccess;System;
Keywords=ssh;terminal;server;remote;
StartupNotify=true
EOF

# Create systemd user service
cat > "${PACKAGE_DIR}/lib/systemd/user/binsh.service" << EOF
[Unit]
Description=binsh SSH Client
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/binsh
Restart=on-failure
RestartSec=5
Environment=BINSH_PORT=9876

[Install]
WantedBy=default.target
EOF


# Calculate installed size
INSTALLED_SIZE=$(du -sk "${PACKAGE_DIR}" | cut -f1)
echo "Installed-Size: ${INSTALLED_SIZE}" >> "${PACKAGE_DIR}/DEBIAN/control"

# Build the package
DEB_FILE="${OUTPUT_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"
dpkg-deb --build --root-owner-group "${PACKAGE_DIR}" "${DEB_FILE}"

# Clean up
rm -rf "${PACKAGE_DIR}"

echo ""
echo "========================================="
echo "✅ Debian package built successfully!"
echo "========================================="
echo ""
echo "Package: ${DEB_FILE}"
echo "Size: $(du -h "${DEB_FILE}" | cut -f1)"
echo ""
echo "To install:"
echo "  sudo dpkg -i ${DEB_FILE}"
echo ""
echo "To install with dependencies:"
echo "  sudo apt install ./${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"
