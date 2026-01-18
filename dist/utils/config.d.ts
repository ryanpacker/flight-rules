/**
 * User-level configuration for Flight Rules CLI
 */
export interface UserConfig {
    channel: 'dev' | 'latest';
    lastUpdateCheck?: {
        timestamp: string;
        latestVersion: string;
    };
}
/**
 * Get the path to the user-level Flight Rules directory
 */
export declare function getUserFlightRulesDir(): string;
/**
 * Get the path to the user-level config file
 */
export declare function getConfigPath(): string;
/**
 * Read the user-level config, creating default if missing
 */
export declare function readConfig(): UserConfig;
/**
 * Write the user-level config
 */
export declare function writeConfig(config: UserConfig): void;
/**
 * Get the configured release channel
 */
export declare function getChannel(): 'dev' | 'latest';
/**
 * Set the release channel
 */
export declare function setChannel(channel: 'dev' | 'latest'): void;
/**
 * Update the cached update check result
 */
export declare function updateLastCheck(latestVersion: string): void;
/**
 * Get the cached update check result, if still valid
 * @param maxAgeMs - Maximum age in milliseconds (default 24 hours)
 * @returns The cached version if valid, null otherwise
 */
export declare function getCachedVersion(maxAgeMs?: number): string | null;
