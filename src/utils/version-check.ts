import { getCliVersion } from './files.js';
import { getChannel, getCachedVersion, updateLastCheck } from './config.js';

const NPM_REGISTRY_URL = 'https://registry.npmjs.org/flight-rules';

/**
 * Result of a version check
 */
export interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  channel: 'dev' | 'latest';
}

/**
 * Options for version check
 */
export interface VersionCheckOptions {
  force?: boolean;  // Bypass cache and always fetch
}

/**
 * Compare two semver versions
 * @returns true if v2 is newer than v1
 */
function isNewerVersion(current: string, latest: string): boolean {
  const v1Parts = current.split('.').map(Number);
  const v2Parts = latest.split('.').map(Number);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1 = v1Parts[i] || 0;
    const v2 = v2Parts[i] || 0;
    if (v2 > v1) return true;
    if (v2 < v1) return false;
  }
  return false;
}

/**
 * Fetch the latest version from npm registry
 * @returns The latest version for the given channel, or null on error
 */
async function fetchLatestVersion(channel: 'dev' | 'latest'): Promise<string | null> {
  try {
    const response = await fetch(NPM_REGISTRY_URL, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { 'dist-tags'?: Record<string, string> };
    const distTags = data['dist-tags'];

    if (!distTags) {
      return null;
    }

    return distTags[channel] || null;
  } catch {
    // Silent failure on network errors
    return null;
  }
}

/**
 * Check for available updates
 * @param options - Options for the check
 * @returns Version check result, or null if check failed
 */
export async function checkForUpdate(options: VersionCheckOptions = {}): Promise<VersionCheckResult | null> {
  const currentVersion = getCliVersion();
  const channel = getChannel();

  if (currentVersion === 'unknown') {
    return null;
  }

  // Check cache first (unless forced)
  if (!options.force) {
    const cachedVersion = getCachedVersion();
    if (cachedVersion) {
      return {
        currentVersion,
        latestVersion: cachedVersion,
        updateAvailable: isNewerVersion(currentVersion, cachedVersion),
        channel,
      };
    }
  }

  // Fetch from npm registry
  const latestVersion = await fetchLatestVersion(channel);

  if (!latestVersion) {
    return null; // Network error or registry issue
  }

  // Update cache
  updateLastCheck(latestVersion);

  return {
    currentVersion,
    latestVersion,
    updateAvailable: isNewerVersion(currentVersion, latestVersion),
    channel,
  };
}

/**
 * Check if update check should be skipped based on environment
 */
export function shouldSkipUpdateCheck(): boolean {
  return process.env.FLIGHT_RULES_NO_UPDATE_CHECK === '1';
}
