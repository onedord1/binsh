# SysTask Desktop Application Build Guide

## Prerequisites

### For Development
- **Node.js** 18+ (recommended: 20 LTS)
- **Rust** 1.77+ with cargo
- **System dependencies** (Ubuntu/Debian):
  ```bash
  sudo apt update
  sudo apt install -y libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```

### For Snap Publishing
- **Snapcraft**: `sudo snap install snapcraft --classic`
- **Snap Store Account**: https://snapcraft.io/account

## Development

### Run Desktop App (Development Mode)
```bash
cd frontend
npm install
npm run tauri:dev
```

This will:
1. Start the Vite dev server on port 5173
2. Compile and launch the Tauri desktop application
3. Enable hot-reload for frontend changes

### Build Desktop App (Release)
```bash
cd frontend
npm run tauri:build
```

Output files will be in:
- **Linux AppImage**: `src-tauri/target/release/bundle/appimage/`
- **Linux .deb**: `src-tauri/target/release/bundle/deb/`
- **Binary**: `src-tauri/target/release/systask`

## Snap Store Publishing

### Option 1: Build and Publish Script
```bash
cd frontend
chmod +x scripts/build-snap.sh
./scripts/build-snap.sh
```

### Option 2: Manual Build
```bash
cd frontend

# Build Tauri app first
npm run tauri:build

# Build snap package
snapcraft

# Install locally for testing
sudo snap install systask_1.0.0_amd64.snap --dangerous

# Login to Snap Store
snapcraft login

# Upload to Snap Store
snapcraft upload systask_1.0.0_amd64.snap --release=stable
```

### Snap Store Registration
1. Create account at https://snapcraft.io/account
2. Register your snap name:
   ```bash
   snapcraft register systask
   ```
3. Upload and release:
   ```bash
   snapcraft upload systask_1.0.0_amd64.snap --release=stable
   ```

## Project Structure

```
frontend/
├── src/                    # React frontend source
├── src-tauri/              # Tauri (Rust) backend
│   ├── src/
│   │   ├── lib.rs          # Tauri app logic
│   │   └── main.rs         # Entry point
│   ├── icons/              # App icons (PNG, ICO, ICNS)
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── snap/
│   └── snapcraft.yaml      # Snap packaging config
├── scripts/
│   └── build-snap.sh       # Build automation
└── package.json            # Node.js dependencies
```

## Configuration

### Tauri Config (`src-tauri/tauri.conf.json`)
- **Window size**: 1280x800 (min: 900x600)
- **App identifier**: `com.systask.app`
- **Bundle targets**: deb, appimage

### Snap Config (`snap/snapcraft.yaml`)
- **Confinement**: strict
- **Base**: core22
- **Plugs**: network, ssh-keys, home

## Troubleshooting

### WebKit2GTK not found
```bash
sudo apt install libwebkit2gtk-4.1-dev
```

### Rust not found
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Snap build fails
- Ensure you have snapcraft installed: `sudo snap install snapcraft --classic`
- Run with verbose output: `snapcraft --verbose`
- Clean build: `snapcraft clean && snapcraft`

## Backend Integration

The desktop app connects to the Go backend at `localhost:9876`. Ensure the backend is running:
```bash
cd ../backend
go run cmd/systask/main.go
```

Or build and run together using the root Makefile (if available).
