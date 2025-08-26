import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

/**
 * Detects if bunosh is running as a single executable or npm package
 */
export function isExecutable() {
  try {
    // Check if we're running from a compiled executable
    // In Bun compiled binaries, process.execPath points to the executable
    const execPath = process.execPath;
    const isCompiledBinary = !execPath.includes('node_modules') && 
                            !execPath.includes('.bun') &&
                            (execPath.includes('bunosh') || path.basename(execPath).startsWith('bunosh'));
    
    return isCompiledBinary;
  } catch (error) {
    return false;
  }
}

/**
 * Gets the current executable path
 */
export function getExecutablePath() {
  if (!isExecutable()) {
    throw new Error('Not running as executable');
  }
  return process.execPath;
}

/**
 * Detects the platform and architecture for download
 */
export function getPlatformInfo() {
  const platform = process.platform;
  const arch = process.arch;
  
  // Map to GitHub release asset names
  switch (platform) {
    case 'linux':
      if (arch === 'x64' || arch === 'x86_64') {
        return { platform: 'linux', arch: 'x64', asset: 'bunosh-linux-x64.tar.gz' };
      }
      break;
    case 'darwin':
      if (arch === 'arm64') {
        return { platform: 'darwin', arch: 'arm64', asset: 'bunosh-darwin-arm64.tar.gz' };
      }
      if (arch === 'x64' || arch === 'x86_64') {
        return { platform: 'darwin', arch: 'x64', asset: 'bunosh-darwin-x64.tar.gz' };
      }
      break;
    case 'win32':
      if (arch === 'x64' || arch === 'x86_64') {
        return { platform: 'windows', arch: 'x64', asset: 'bunosh-windows-x64.exe.zip' };
      }
      break;
  }
  
  throw new Error(`Unsupported platform: ${platform} ${arch}`);
}

/**
 * Fetches the latest release info from GitHub
 */
export async function getLatestRelease() {
  try {
    const response = await fetch('https://api.github.com/repos/davertmik/bunosh/releases/latest');
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to fetch release info: ${error.message}`);
  }
}

/**
 * Gets current version from package.json or executable
 */
export function getCurrentVersion() {
  try {
    // Try to read from package.json first
    const packagePath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (pkg.name === 'bunosh') {
        return pkg.version;
      }
    }
    
    // For executable, version might be embedded or we can try --version
    try {
      const version = execSync('bunosh --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
      return version;
    } catch (error) {
      // Fallback to unknown
      return 'unknown';
    }
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Compares version strings (simple semantic version comparison)
 */
export function isNewerVersion(latest, current) {
  if (current === 'unknown') return true;
  
  // Remove 'v' prefix if present
  const latestClean = latest.replace(/^v/, '');
  const currentClean = current.replace(/^v/, '');
  
  const latestParts = latestClean.split('.').map(n => parseInt(n) || 0);
  const currentParts = currentClean.split('.').map(n => parseInt(n) || 0);
  
  // Pad arrays to same length
  const maxLength = Math.max(latestParts.length, currentParts.length);
  while (latestParts.length < maxLength) latestParts.push(0);
  while (currentParts.length < maxLength) currentParts.push(0);
  
  // Compare each part
  for (let i = 0; i < maxLength; i++) {
    if (latestParts[i] > currentParts[i]) return true;
    if (latestParts[i] < currentParts[i]) return false;
  }
  
  return false; // Versions are equal
}

/**
 * Downloads and extracts the new binary
 */
export async function downloadAndInstall(release, platformInfo, executablePath, onProgress) {
  const asset = release.assets.find(a => a.name === platformInfo.asset);
  if (!asset) {
    throw new Error(`No asset found for platform: ${platformInfo.asset}`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bunosh-upgrade-'));
  const downloadPath = path.join(tempDir, asset.name);
  
  try {
    // Download with progress
    onProgress?.('Downloading latest release...');
    const response = await fetch(asset.browser_download_url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(downloadPath, Buffer.from(buffer));
    onProgress?.('Download complete');

    // Extract and replace
    onProgress?.('Extracting and installing...');
    
    // Create backup of current executable
    const backupPath = executablePath + '.backup';
    fs.copyFileSync(executablePath, backupPath);

    if (platformInfo.platform === 'windows') {
      // Handle ZIP extraction for Windows
      execSync(`powershell -command "Expand-Archive -Path '${downloadPath}' -DestinationPath '${tempDir}' -Force"`);
      const extractedExe = path.join(tempDir, 'bunosh-windows-x64.exe');
      fs.copyFileSync(extractedExe, executablePath);
    } else {
      // Handle tar.gz extraction for Unix
      const extractDir = path.join(tempDir, 'extracted');
      fs.mkdirSync(extractDir);
      
      execSync(`tar -xzf "${downloadPath}" -C "${extractDir}"`);
      
      // Find the executable in extracted files
      const extractedFiles = fs.readdirSync(extractDir);
      const executableName = extractedFiles.find(f => f.startsWith('bunosh-'));
      
      if (!executableName) {
        throw new Error('Could not find executable in downloaded archive');
      }
      
      const extractedPath = path.join(extractDir, executableName);
      fs.copyFileSync(extractedPath, executablePath);
      fs.chmodSync(executablePath, 0o755);
    }

    onProgress?.('Installation complete');
    
    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.unlinkSync(backupPath);
    
    return true;
  } catch (error) {
    // Restore backup if something went wrong
    const backupPath = executablePath + '.backup';
    if (fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(backupPath, executablePath);
        fs.unlinkSync(backupPath);
      } catch (restoreError) {
        console.error('Failed to restore backup:', restoreError.message);
      }
    }
    
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    throw error;
  }
}

/**
 * Main upgrade function
 */
export async function upgradeExecutable(options = {}) {
  const { force = false, onProgress } = options;
  
  if (!isExecutable()) {
    throw new Error('Upgrade is only available for single executable installations. Use "npm update -g bunosh" for npm installations.');
  }

  onProgress?.('Checking for updates...');
  
  const currentVersion = getCurrentVersion();
  const release = await getLatestRelease();
  const latestVersion = release.tag_name;
  
  if (!force && !isNewerVersion(latestVersion, currentVersion)) {
    return {
      updated: false,
      currentVersion,
      latestVersion,
      message: `Already on latest version: ${currentVersion}`
    };
  }

  const platformInfo = getPlatformInfo();
  const executablePath = getExecutablePath();
  
  await downloadAndInstall(release, platformInfo, executablePath, onProgress);
  
  return {
    updated: true,
    currentVersion,
    latestVersion,
    message: `Successfully upgraded from ${currentVersion} to ${latestVersion}`
  };
}