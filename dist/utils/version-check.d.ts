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
    force?: boolean;
}
/**
 * Check for available updates
 * @param options - Options for the check
 * @returns Version check result, or null if check failed
 */
export declare function checkForUpdate(options?: VersionCheckOptions): Promise<VersionCheckResult | null>;
/**
 * Check if update check should be skipped based on environment
 */
export declare function shouldSkipUpdateCheck(): boolean;
