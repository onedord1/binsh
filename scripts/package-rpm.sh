#!/bin/bash
set -e

# binsh RPM Package Builder
# Creates .rpm package for Fedora/RHEL/CentOS systems

# RPM doesn't allow hyphens in version, convert to underscore
VERSION_INPUT="${VERSION:-1.0.0-beta}"
VERSION="${VERSION_INPUT//-/.}"
RELEASE="${RELEASE:-1}"
ARCH="${ARCH:-x86_64}"
BUILD_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE_NAME="binsh"
OUTPUT_DIR="${BUILD_DIR}/dist"

# RPM build directories
RPM_BUILD_ROOT="${BUILD_DIR}/dist/rpm-build"
RPMBUILD_DIR="${RPM_BUILD_ROOT}/rpmbuild"

echo "📦 Building RPM package for binsh v${VERSION}"

# Ensure binary exists
if [ ! -f "${OUTPUT_DIR}/binsh" ]; then
    echo "❌ Binary not found. Run build.sh first."
    exit 1
fi

# Check for rpmbuild
if ! command -v rpmbuild &> /dev/null; then
    echo "❌ rpmbuild not found. Install rpm-build package:"
    echo "   Fedora/RHEL: sudo dnf install rpm-build"
    echo "   Ubuntu/Debian: sudo apt install rpm"
    exit 1
fi

# Clean and create RPM build structure
rm -rf "${RPM_BUILD_ROOT}"
mkdir -p "${RPMBUILD_DIR}"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
mkdir -p "${RPMBUILD_DIR}/BUILDROOT/${PACKAGE_NAME}-${VERSION}-${RELEASE}.${ARCH}"

# Create tarball for SOURCES
TARBALL_DIR="${RPM_BUILD_ROOT}/${PACKAGE_NAME}-${VERSION}"
mkdir -p "${TARBALL_DIR}/usr/bin"
mkdir -p "${TARBALL_DIR}/usr/share/binsh/static"
mkdir -p "${TARBALL_DIR}/usr/share/applications"
mkdir -p "${TARBALL_DIR}/usr/share/icons/hicolor/256x256/apps"
mkdir -p "${TARBALL_DIR}/usr/share/doc/binsh"
mkdir -p "${TARBALL_DIR}/usr/lib/systemd/user"

# Copy files
cp "${OUTPUT_DIR}/binsh" "${TARBALL_DIR}/usr/bin/binsh"
chmod 755 "${TARBALL_DIR}/usr/bin/binsh"

if [ -d "${BUILD_DIR}/backend/cmd/systask/static" ]; then
    cp -r "${BUILD_DIR}/backend/cmd/systask/static/"* "${TARBALL_DIR}/usr/share/binsh/static/"
fi

cp "${BUILD_DIR}/README.md" "${TARBALL_DIR}/usr/share/doc/binsh/"
cp -r "${BUILD_DIR}/docs/"* "${TARBALL_DIR}/usr/share/doc/binsh/" 2>/dev/null || true

# Create desktop entry
cat > "${TARBALL_DIR}/usr/share/applications/binsh.desktop" << EOF
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
cat > "${TARBALL_DIR}/usr/lib/systemd/user/binsh.service" << EOF
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

# Create SVG icon
cat > "${TARBALL_DIR}/usr/share/icons/hicolor/256x256/apps/binsh.svg" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="32" fill="#1a1a2e"/>
  <text x="128" y="160" font-family="monospace" font-size="120" font-weight="bold" fill="#00d4ff" text-anchor="middle">$_</text>
</svg>
EOF

# Create tarball
cd "${RPM_BUILD_ROOT}"
tar -czvf "${RPMBUILD_DIR}/SOURCES/${PACKAGE_NAME}-${VERSION}.tar.gz" "${PACKAGE_NAME}-${VERSION}"

# Create spec file
cat > "${RPMBUILD_DIR}/SPECS/${PACKAGE_NAME}.spec" << EOF
Name:           ${PACKAGE_NAME}
Version:        ${VERSION}
Release:        ${RELEASE}%{?dist}
Summary:        Modern SSH Client & Server Management Platform

License:        MIT
URL:            https://github.com/onedord1/binsh
Source0:        %{name}-%{version}.tar.gz

# Disable debug package generation
%global debug_package %{nil}

BuildArch:      ${ARCH}
Requires:       glibc

%description
binsh is a powerful, feature-rich SSH client designed for DevOps
engineers, system administrators, and developers who manage
multiple servers.

Features include:
- Multi-server management with groups and tags
- Secure credential storage with AES-256 encryption
- SFTP file manager with dual-pane interface
- Cloud provider integration (AWS, GCP, Azure, etc.)
- Port forwarding management
- Command snippets library
- Real-time system metrics

%prep
%setup -q

%install
mkdir -p %{buildroot}
cp -r usr %{buildroot}/

%files
%license /usr/share/doc/binsh/README.md
%dir /usr/share/doc/binsh
/usr/share/doc/binsh/*.md
/usr/bin/binsh
/usr/share/binsh/
/usr/share/applications/binsh.desktop
/usr/share/icons/hicolor/256x256/apps/binsh.svg
/usr/lib/systemd/user/binsh.service

%post
echo ""
echo "✅ binsh installed successfully!"
echo ""
echo "To start binsh:"
echo "  binsh"
echo ""
echo "Then open your browser to:"
echo "  http://localhost:9876"
echo ""

%preun
systemctl --user stop binsh 2>/dev/null || true
systemctl --user disable binsh 2>/dev/null || true

%changelog
* $(date "+%a %b %d %Y") binsh Team <support@binsh.dev> - ${VERSION}-${RELEASE}
- Initial beta release
- Multi-server management with groups and tags
- Secure vault with AES-256 encryption
- SFTP file manager
- Cloud provider integration
- Port forwarding
- Command snippets
- Real-time metrics
EOF

# Build RPM
rpmbuild --define "_topdir ${RPMBUILD_DIR}" -bb "${RPMBUILD_DIR}/SPECS/${PACKAGE_NAME}.spec"

# Copy RPM to output directory
find "${RPMBUILD_DIR}/RPMS" -name "*.rpm" -exec cp {} "${OUTPUT_DIR}/" \;

# Clean up
rm -rf "${RPM_BUILD_ROOT}"

RPM_FILE=$(ls "${OUTPUT_DIR}"/*.rpm 2>/dev/null | head -1)

echo ""
echo "========================================="
echo "✅ RPM package built successfully!"
echo "========================================="
echo ""
echo "Package: ${RPM_FILE}"
echo "Size: $(du -h "${RPM_FILE}" | cut -f1)"
echo ""
echo "To install:"
echo "  sudo rpm -i ${RPM_FILE}"
echo ""
echo "Or with dnf:"
echo "  sudo dnf install ${RPM_FILE}"
