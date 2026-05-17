import { exec, execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { platform } from 'os';
import { homedir } from 'os';
import { join } from 'path';
import { mkdir, chmod } from 'fs/promises';
import color from 'chalk';

export async function upgradeCommand(options = {}) {
  const { force = false, check = false } = options;
  
  try {
    const installMethod = detectInstallMethod();
    console.log(`Bunosh is installed via: ${color.bold(installMethod)}`);
    
    if (installMethod === 'bun' || installMethod === 'npm') {
      const currentVersion = getCurrentVersion();
      let latestVersion = null;
      try {
        latestVersion = await getLatestNpmVersion();
      } catch (e) {
      }

      console.log(`Current version: ${color.bold(currentVersion)}`);
      if (latestVersion) {
        console.log(`Latest version:  ${color.bold(latestVersion)}`);
      }

      if (latestVersion && !force && !isNewerVersion(latestVersion, currentVersion)) {
        console.log(color.green('You are already on the latest version!'));
        if (!force) {
          console.log(`   Use ${color.bold('--force')} to reinstall the current version.`);
        }
        return;
      }

      const upgradeCmd = installMethod === 'bun'
        ? 'bun add -g bunosh@latest --force'
        : 'npm install -g bunosh@latest';

      if (check) {
        console.log('Will upgrade with: ' + color.bold(upgradeCmd));
        return;
      }

      if (installMethod === 'bun') {
        await upgradeWithBun();
      } else {
        await upgradeWithNpm();
      }

      console.log();
      console.log(`Run ${color.bold('bunosh --version')} to verify the new version.`);
    } else if (installMethod === 'executable') {
      await upgradeExecutable({ force, check });
    } else {
      console.error('Unknown installation method');
      process.exit(1);
    }
  } catch (error) {
    console.error(`Upgrade failed: ${error.message}`);
    process.exit(1);
  }
}

function detectInstallMethod() {
  if (process.env.BUNOSH_EXECUTABLE === 'true') {
    return 'executable';
  }
  
  const executablePath = process.argv[0];
  
  if (executablePath.endsWith('bunosh')) {
    try {
      const buffer = readFileSync(executablePath);
      const header = buffer.subarray(0, 4).toString('hex');
      const binarySignatures = ['7f454c46', 'feedface', 'feedfacf', '4d5a9000'];
      
      if (binarySignatures.includes(header)) {
        return 'executable';
      }
      
      const textContent = buffer.toString('utf8');
      if (!textContent.startsWith('#!') && !textContent.includes('node_modules')) {
        return 'executable';
      }
    } catch (e) {
      return 'executable';
    }
  }
  
  const invokedVia = process.argv[0];
  
  if (invokedVia.endsWith('node') || invokedVia.includes('node.exe')) {
    return 'npm';
  }
  
  if (invokedVia.endsWith('bun') || invokedVia.includes('bun.exe')) {
    try {
      const bunGlobalPath = execSync('bun pm -g bin', { encoding: 'utf8' }).trim();
      const bunoshPath = join(bunGlobalPath, 'bunosh');
      
      if (existsSync(bunoshPath)) {
        return 'bun';
      }
    } catch (e) {
    }
  }
  
  try {
    const npmListOutput = execSync('npm list -g bunosh --depth=0 2>/dev/null || echo "not found"', { encoding: 'utf8' });
    if (npmListOutput.includes('bunosh@') && !npmListOutput.includes('not found')) {
      return 'npm';
    }
    
    const bunListOutput = execSync('bun pm -g ls 2>/dev/null | grep bunosh || echo "not found"', { encoding: 'utf8' });
    if (bunListOutput.includes('bunosh') && !bunListOutput.includes('not found')) {
      return 'bun';
    }
  } catch (e) {
  }
  
  if (process.argv[0].endsWith('bunosh')) {
    return 'executable';
  }
  
  return 'unknown';
}

function runStreaming(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', (error) => reject(new Error(`${command} not available: ${error.message}`)));
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function upgradeWithBun() {
  console.log('Upgrading with Bun...');

  try {
    await runStreaming('bun', ['add', '-g', 'bunosh@latest', '--force']);
    console.log(color.green('Upgrade successful!'));
    return;
  } catch (error) {
    console.warn(color.yellow(`Bun upgrade failed: ${error.message}`));
    console.warn(color.yellow('Falling back to npm (a known Bun global-install bug)...'));
  }

  await upgradeWithNpm();
}

async function upgradeWithNpm() {
  console.log('Upgrading with npm...');

  await runStreaming('npm', ['install', '-g', 'bunosh@latest']);
  console.log(color.green('Upgrade successful!'));
}

export async function getLatestNpmVersion(timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://registry.npmjs.org/bunosh/latest', {
      headers: { 'User-Agent': 'bunosh' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`npm registry error: ${response.status}`);
    }

    const data = await response.json();
    return data.version;
  } finally {
    clearTimeout(timer);
  }
}

async function getCachedLatestNpmVersion() {
  const cacheDir = join(homedir(), '.bunosh');
  const cacheFile = join(cacheDir, 'version-check.json');
  const TTL = 12 * 60 * 60 * 1000;

  try {
    if (existsSync(cacheFile)) {
      const cache = JSON.parse(readFileSync(cacheFile, 'utf8'));
      if (cache.latest && cache.checkedAt && Date.now() - cache.checkedAt < TTL) {
        return cache.latest;
      }
    }
  } catch (e) {
  }

  let latest = null;
  try {
    latest = await getLatestNpmVersion(2000);
  } catch (e) {
    return null;
  }

  try {
    await mkdir(cacheDir, { recursive: true });
    writeFileSync(cacheFile, JSON.stringify({ checkedAt: Date.now(), latest }));
  } catch (e) {
  }

  return latest;
}

export async function printUpgradeNoticeIfAvailable() {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST_WORKER_ID !== undefined) {
    return;
  }

  try {
    const currentVersion = getCurrentVersion();
    if (!currentVersion || currentVersion === 'unknown') {
      return;
    }

    const latestVersion = await getCachedLatestNpmVersion();
    if (!latestVersion || !isNewerVersion(latestVersion, currentVersion)) {
      return;
    }

    console.log();
    console.log(color.yellow(`🦾 A new version of Bunosh is available: ${color.bold(currentVersion)} → ${color.bold(latestVersion)}`));
    console.log(color.dim(`   Run ${color.bold('bunosh upgrade')} to update.`));
  } catch (e) {
  }
}

export async function upgradeExecutable(options = {}) {
  const { force = false, check = false } = options;
  
  const currentVersion = getCurrentVersion();
  console.log(`Current version: ${color.bold(currentVersion)}`);
  
  if (check) {
    console.log('Checking for updates...');
    try {
      const release = await getLatestRelease();
      const latestVersion = release.tag_name;
      
      console.log(`Latest version: ${color.bold(latestVersion)}`);
      
      if (isNewerVersion(latestVersion, currentVersion)) {
        console.log(`${color.green('Update available!')} ${currentVersion} → ${latestVersion}`);
        console.log('Run ' + color.bold('bunosh upgrade') + ' to update.');
      } else {
        console.log(`${color.green('You are on the latest version!')}`);
      }
    } catch (error) {
      console.error(`Failed to check for updates: ${error.message}`);
      process.exit(1);
    }
    return;
  }
  
  console.log('Starting upgrade process...');
  console.log();
  
  let lastMessage = '';
  const result = await performUpgradeExecutable({
    force,
    onProgress: (message) => {
      if (message !== lastMessage) {
        console.log(`   ${message}`);
        lastMessage = message;
      }
    }
  });
  
  console.log();
  if (result.updated) {
    console.log(`${color.green('Upgrade successful!')}`);
    console.log(`   ${result.currentVersion} → ${color.bold(result.latestVersion)}`);
    console.log();
    console.log(`Run ${color.bold('bunosh --version')} to verify the new version.`);
  } else {
    console.log(`${color.green(result.message)}`);
    if (!force) {
      console.log(`   Use ${color.bold('--force')} to reinstall the current version.`);
    }
  }
}

function getCurrentVersion() {
  try {
    const pkgPath = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg.version;
  } catch (e) {
    return 'unknown';
  }
}

async function getLatestRelease() {
  const response = await fetch('https://api.github.com/repos/DavertMik/bunosh/releases/latest', {
    headers: {
      'User-Agent': 'bunosh'
    }
  });
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  
  return await response.json();
}

function isNewerVersion(latest, current) {
  const latestParts = latest.replace(/^v/, '').split('.').map(Number);
  const currentParts = current.replace(/^v/, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const latestPart = latestParts[i] || 0;
    const currentPart = currentParts[i] || 0;
    
    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }
  
  return false;
}

async function performUpgradeExecutable(options = {}) {
  const { force = false, onProgress = () => {} } = options;
  
  const release = await getLatestRelease();
  const latestVersion = release.tag_name;
  const currentVersion = getCurrentVersion();
  
  if (!force && !isNewerVersion(latestVersion, currentVersion)) {
    return {
      updated: false,
      message: 'Already on latest version',
      currentVersion,
      latestVersion
    };
  }
  
  const platformName = getPlatformName();
  const asset = release.assets.find(a => a.name.includes(platformName));
  
  if (!asset) {
    throw new Error(`Unsupported platform: ${platformName}`);
  }
  
  onProgress('Downloading update...');
  
  const downloadDir = join(homedir(), '.bunosh', 'updates');
  await mkdir(downloadDir, { recursive: true });
  
  const downloadPath = join(downloadDir, asset.name);
  
  await downloadFile(asset.browser_download_url, downloadPath, onProgress);
  
  onProgress('Installing update...');
  
  const currentPath = process.argv[0];
  const backupPath = `${currentPath}.backup`;
  if (existsSync(currentPath)) {
    writeFileSync(backupPath, readFileSync(currentPath));
  }
  
  writeFileSync(currentPath, readFileSync(downloadPath));
  await chmod(currentPath, '755');
  
  return {
    updated: true,
    currentVersion,
    latestVersion
  };
}

function getPlatformName() {
  const arch = platform().arch();
  const sysPlatform = platform().toLowerCase();
  
  if (sysPlatform === 'darwin' && arch === 'arm64') {
    return 'darwin-arm64';
  }
  
  if (sysPlatform === 'darwin' && arch === 'x64') {
    return 'darwin-x64';
  }
  
  if (sysPlatform === 'linux' && arch === 'x64') {
    return 'linux-x64';
  }
  
  if (sysPlatform === 'win32' && arch === 'x64') {
    return 'windows-x64.exe';
  }
  
  throw new Error(`Unsupported platform: ${sysPlatform} ${arch}`);
}

async function downloadFile(url, filePath, onProgress = () => {}) {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }
  
  const reader = response.body.getReader();
  const contentLength = +response.headers.get('Content-Length');
  let receivedLength = 0;
  
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    chunks.push(value);
    receivedLength += value.length;
    
    const progress = Math.round((receivedLength / contentLength) * 100);
    onProgress(`Downloading... ${progress}%`);
  }
  
  const chunksAll = new Uint8Array(receivedLength);
  let position = 0;
  for (let chunk of chunks) {
    chunksAll.set(chunk, position);
    position += chunk.length;
  }
  
  writeFileSync(filePath, chunksAll);
}