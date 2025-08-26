# Bunosh Upgrade Guide

Bunosh provides different upgrade paths depending on how it was installed.

## Single Executable (Recommended)

If you installed Bunosh as a single executable, you can upgrade directly using the built-in upgrade command.

### Check for Updates

```bash
bunosh upgrade --check
```

**Example output:**
```bash
📍 Current version: 0.1.5
🔍 Checking for updates...
📦 Latest version: 0.1.6
✨ Update available! 0.1.5 → 0.1.6
Run bunosh upgrade to update.
```

### Upgrade to Latest Version

```bash
bunosh upgrade
```

**Example output:**
```bash
📍 Current version: 0.1.5
⬆️  Starting upgrade process...

   Checking for updates...
   Downloading latest release...
   Download complete
   Extracting and installing...
   Installation complete

🎉 Upgrade successful!
   0.1.5 → 0.1.6

💡 Run bunosh --version to verify the new version.
```

### Force Reinstall

```bash
bunosh upgrade --force
```

This will reinstall the current version even if you're already on the latest.

## NPM Installation

If you installed Bunosh via npm:

```bash
# Check current version
npm list -g bunosh

# Update to latest
npm update -g bunosh

# Or reinstall
npm install -g bunosh@latest
```

## How the Upgrade Works

### For Single Executables

1. **Detection**: Automatically detects you're running a single executable
2. **Version Check**: Compares current version with latest GitHub release
3. **Platform Detection**: Identifies your OS and architecture
4. **Download**: Downloads the appropriate binary from GitHub releases
5. **Backup**: Creates a backup of your current executable
6. **Replace**: Replaces the current executable with the new version
7. **Cleanup**: Removes temporary files and backup

### Safety Features

- **Automatic Backup**: Creates `.backup` file before upgrade
- **Rollback on Failure**: Restores backup if upgrade fails
- **Platform Validation**: Only upgrades if your platform is supported
- **Executable Detection**: Prevents NPM users from using executable upgrade

## Supported Platforms

The upgrade command works on:
- **Linux x64**: `bunosh-linux-x64`
- **macOS ARM64**: `bunosh-darwin-arm64` (Apple Silicon)
- **macOS Intel**: `bunosh-darwin-x64`
- **Windows x64**: `bunosh-windows-x64.exe`

## Error Scenarios

### Not Running as Executable

```bash
📦 Bunosh is installed via npm.
To upgrade, run: npm update -g bunosh
```

### Unsupported Platform

```bash
❌ Upgrade failed: Unsupported platform: linux arm64

💡 Supported platforms:
   • Linux x64
   • macOS ARM64 (Apple Silicon)
   • Windows x64
```

### Network Issues

```bash
❌ Upgrade failed: Failed to fetch release info: fetch failed

💡 Try again later or check your internet connection.
```

### Already Latest Version

```bash
📍 Current version: 0.1.6
⬆️  Starting upgrade process...

✅ Already on latest version: 0.1.6
   Use --force to reinstall the current version.
```

## Troubleshooting

### Permission Issues (Unix)

If you get permission errors:

```bash
sudo bunosh upgrade
```

Or move bunosh to a user-writable location:

```bash
# Move to user bin directory
mv /usr/local/bin/bunosh ~/bin/bunosh
export PATH="$HOME/bin:$PATH"
bunosh upgrade
```

### Windows Antivirus

Some antivirus software may flag the download. This is a false positive. The binaries are:
- Downloaded from official GitHub releases
- Signed and verified
- Scanned by GitHub's security systems

### Verification

After upgrade, verify the installation:

```bash
# Check version
bunosh --version

# Check it works
bunosh --help

# Test with a simple command
bunosh init --help
```

## Automatic Updates (Future)

Future versions may include:
- **Update notifications** when new versions are available
- **Automatic background checks** for updates
- **Scheduled upgrade** options

## Rollback

If you need to rollback to a previous version:

1. Download the older release manually from [GitHub Releases](https://github.com/davertmik/bunosh/releases)
2. Replace your current executable
3. Or use `--force` with a manual downgrade

## Development Builds

For development or beta versions:

```bash
# Install specific version (manual download required)
curl -L https://github.com/davertmik/bunosh/releases/download/v0.1.5/bunosh-linux-x64.tar.gz | tar -xz
```

The upgrade command only works with official releases, not development builds.