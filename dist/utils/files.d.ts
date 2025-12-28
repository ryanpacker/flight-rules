/**
 * Get the path to the payload directory (the Flight Rules content to install)
 */
export declare function getPayloadPath(): string;
/**
 * Check if Flight Rules is already installed in the target directory
 */
export declare function isFlightRulesInstalled(targetDir: string): boolean;
/**
 * Get the .flight-rules directory path in the target
 */
export declare function getFlightRulesDir(targetDir: string): string;
/**
 * Copy the payload to the target directory as .flight-rules
 */
export declare function copyPayload(targetDir: string): void;
/**
 * Copy only framework files (not docs/) during upgrade
 */
export declare function copyFrameworkFiles(targetDir: string): void;
/**
 * Ensure a directory exists
 */
export declare function ensureDir(dir: string): void;
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
export declare function fetchPayloadFromGitHub(version?: string): Promise<FetchedPayload>;
/**
 * Copy framework files from a source payload directory (used by both local and remote)
 */
export declare function copyFrameworkFilesFrom(sourcePayloadPath: string, targetDir: string): void;
/**
 * Copy entire payload from a source directory (used by both local and remote)
 */
export declare function copyPayloadFrom(sourcePayloadPath: string, targetDir: string): void;
