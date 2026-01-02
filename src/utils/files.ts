import { existsSync, mkdirSync, cpSync, createWriteStream, rmSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GITHUB_REPO = 'ryanpacker/flight-rules';

/**
 * Get the CLI version from package.json
 */
export function getCliVersion(): string {
  // Structure: flight-rules/dist/utils/files.js
  // Go up 2 levels to get to flight-rules/, then read package.json
  const projectRoot = dirname(dirname(__dirname));
  const packageJsonPath = join(projectRoot, 'package.json');
  
  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Get the path to the payload directory (the Flight Rules content to install)
 */
export function getPayloadPath(): string {
  // Structure: flight-rules/dist/utils/files.js
  // Go up 2 levels to get to flight-rules/, then into payload/
  const projectRoot = dirname(dirname(__dirname));
  return join(projectRoot, 'payload');
}

/**
 * Check if Flight Rules is already installed in the target directory
 */
export function isFlightRulesInstalled(targetDir: string): boolean {
  return existsSync(join(targetDir, '.flight-rules'));
}

/**
 * Get the .flight-rules directory path in the target
 */
export function getFlightRulesDir(targetDir: string): string {
  return join(targetDir, '.flight-rules');
}

/**
 * Copy the payload to the target directory as .flight-rules
 */
export function copyPayload(targetDir: string): void {
  const payloadPath = getPayloadPath();
  const destPath = getFlightRulesDir(targetDir);
  
  if (!existsSync(payloadPath)) {
    throw new Error(`Payload not found at ${payloadPath}`);
  }
  
  cpSync(payloadPath, destPath, { recursive: true });
}

/**
 * Copy only framework files (not docs/) during upgrade
 */
export function copyFrameworkFiles(targetDir: string): void {
  const payloadPath = getPayloadPath();
  const destPath = getFlightRulesDir(targetDir);
  
  // Files/directories that are safe to replace on upgrade
  const frameworkItems = [
    'AGENTS.md',
    'doc-templates',
    'commands',
    'prompts'
  ];
  
  for (const item of frameworkItems) {
    const srcItem = join(payloadPath, item);
    const destItem = join(destPath, item);
    
    if (existsSync(srcItem)) {
      cpSync(srcItem, destItem, { recursive: true });
    }
  }
}

/**
 * Ensure a directory exists
 */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Result of fetching payload from GitHub
 */
export interface FetchedPayload {
  payloadPath: string;
  version: string;
  cleanup: () => void;
}

/**
 * Fetch the Flight Rules payload from GitHub
 * @param version - Git ref to fetch (tag like 'v0.1.4', branch like 'main', or 'latest' for main)
 * @returns Object with payloadPath, version string, and cleanup function
 */
export async function fetchPayloadFromGitHub(version?: string): Promise<FetchedPayload> {
  const ref = (!version || version === 'latest') ? 'main' : version.startsWith('v') ? version : `v${version}`;
  const tarballUrl = `https://github.com/${GITHUB_REPO}/tarball/${ref}`;
  
  // Create temp directory
  const tempDir = join(tmpdir(), `flight-rules-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
  
  const tarballPath = join(tempDir, 'payload.tar.gz');
  const extractDir = join(tempDir, 'extracted');
  mkdirSync(extractDir, { recursive: true });
  
  const cleanup = () => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  };
  
  try {
    // Download tarball
    const response = await fetch(tarballUrl, {
      headers: { 'Accept': 'application/vnd.github+json' },
      redirect: 'follow',
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Version '${ref}' not found. Check available versions at https://github.com/${GITHUB_REPO}/tags`);
      }
      throw new Error(`Failed to download from GitHub: ${response.status} ${response.statusText}`);
    }
    
    if (!response.body) {
      throw new Error('No response body received from GitHub');
    }
    
    // Write tarball to disk using Readable.fromWeb for proper stream compatibility
    const { Readable } = await import('stream');
    const fileStream = createWriteStream(tarballPath);
    const nodeStream = Readable.fromWeb(response.body as import('stream/web').ReadableStream);
    await pipeline(nodeStream, fileStream);
    
    // Extract tarball
    await tar.extract({
      file: tarballPath,
      cwd: extractDir,
    });
    
    // Find the extracted directory (GitHub creates a directory like 'user-repo-hash')
    const extractedDirs = readdirSync(extractDir);
    if (extractedDirs.length === 0) {
      throw new Error('No files extracted from tarball');
    }
    
    const repoDir = join(extractDir, extractedDirs[0]);
    const payloadPath = join(repoDir, 'payload');
    
    if (!existsSync(payloadPath)) {
      throw new Error('Payload directory not found in downloaded content');
    }
    
    // Read version from AGENTS.md
    let detectedVersion = ref;
    try {
      const agentsMd = readFileSync(join(payloadPath, 'AGENTS.md'), 'utf-8');
      const versionMatch = agentsMd.match(/flight_rules_version:\s*([\d.]+)/);
      if (versionMatch) {
        detectedVersion = versionMatch[1];
      }
    } catch {
      // Ignore version detection errors
    }
    
    return {
      payloadPath,
      version: detectedVersion,
      cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}

/**
 * Copy framework files from a source payload directory (used by both local and remote)
 */
export function copyFrameworkFilesFrom(sourcePayloadPath: string, targetDir: string): void {
  const destPath = getFlightRulesDir(targetDir);
  
  // Files/directories that are safe to replace on upgrade
  const frameworkItems = [
    'AGENTS.md',
    'doc-templates',
    'commands',
    'prompts'
  ];
  
  for (const item of frameworkItems) {
    const srcItem = join(sourcePayloadPath, item);
    const destItem = join(destPath, item);
    
    if (existsSync(srcItem)) {
      cpSync(srcItem, destItem, { recursive: true });
    }
  }
}

/**
 * Copy entire payload from a source directory (used by both local and remote)
 */
export function copyPayloadFrom(sourcePayloadPath: string, targetDir: string): void {
  const destPath = getFlightRulesDir(targetDir);
  
  if (!existsSync(sourcePayloadPath)) {
    throw new Error(`Payload not found at ${sourcePayloadPath}`);
  }
  
  cpSync(sourcePayloadPath, destPath, { recursive: true });
}

/**
 * Manifest file structure for tracking deployed Flight Rules version
 */
export interface Manifest {
  version: string;
  deployedAt: string;
  deployedBy: {
    cli: string;
    command: 'init' | 'upgrade';
  };
}

/**
 * Read the manifest.json from a Flight Rules installation
 * @returns The manifest data, or null if not found
 */
export function readManifest(targetDir: string): Manifest | null {
  const manifestPath = join(getFlightRulesDir(targetDir), 'manifest.json');
  
  if (!existsSync(manifestPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content) as Manifest;
  } catch {
    return null;
  }
}

/**
 * Write the manifest.json to a Flight Rules installation
 */
export function writeManifest(targetDir: string, data: Manifest): void {
  const manifestPath = join(getFlightRulesDir(targetDir), 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * Get the current version from manifest, falling back to AGENTS.md
 * @returns The version string, or null if not found
 */
export function getInstalledVersion(targetDir: string): string | null {
  // Try manifest first
  const manifest = readManifest(targetDir);
  if (manifest) {
    return manifest.version;
  }
  
  // Fall back to AGENTS.md for older installations
  const agentsMdPath = join(getFlightRulesDir(targetDir), 'AGENTS.md');
  if (!existsSync(agentsMdPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(agentsMdPath, 'utf-8');
    const match = content.match(/flight_rules_version:\s*([\d.]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

