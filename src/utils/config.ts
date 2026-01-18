import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

/**
 * User-level configuration for Flight Rules CLI
 */
export interface UserConfig {
  channel: 'dev' | 'latest';
  lastUpdateCheck?: {
    timestamp: string;      // ISO date string
    latestVersion: string;  // version on configured channel
  };
}

const DEFAULT_CONFIG: UserConfig = {
  channel: 'dev',
};

/**
 * Get the path to the user-level Flight Rules directory
 */
export function getUserFlightRulesDir(): string {
  return join(homedir(), '.flight-rules');
}

/**
 * Get the path to the user-level config file
 */
export function getConfigPath(): string {
  return join(getUserFlightRulesDir(), 'config.json');
}

/**
 * Read the user-level config, creating default if missing
 */
export function readConfig(): UserConfig {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    // Merge with defaults to handle missing fields
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Write the user-level config
 */
export function writeConfig(config: UserConfig): void {
  const configPath = getConfigPath();
  const configDir = dirname(configPath);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Get the configured release channel
 */
export function getChannel(): 'dev' | 'latest' {
  return readConfig().channel;
}

/**
 * Set the release channel
 */
export function setChannel(channel: 'dev' | 'latest'): void {
  const config = readConfig();
  config.channel = channel;
  writeConfig(config);
}

/**
 * Update the cached update check result
 */
export function updateLastCheck(latestVersion: string): void {
  const config = readConfig();
  config.lastUpdateCheck = {
    timestamp: new Date().toISOString(),
    latestVersion,
  };
  writeConfig(config);
}

/**
 * Get the cached update check result, if still valid
 * @param maxAgeMs - Maximum age in milliseconds (default 24 hours)
 * @returns The cached version if valid, null otherwise
 */
export function getCachedVersion(maxAgeMs: number = 24 * 60 * 60 * 1000): string | null {
  const config = readConfig();

  if (!config.lastUpdateCheck) {
    return null;
  }

  const checkTime = new Date(config.lastUpdateCheck.timestamp).getTime();
  const now = Date.now();

  if (now - checkTime > maxAgeMs) {
    return null; // Cache expired
  }

  return config.lastUpdateCheck.latestVersion;
}
