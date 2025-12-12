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
