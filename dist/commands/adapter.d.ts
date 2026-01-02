/**
 * Copy command files to a destination directory with conflict handling
 */
export declare function copyCommandsWithConflictHandling(sourceDir: string, destDir: string, skipPrompts?: boolean): Promise<{
    copied: string[];
    skipped: string[];
}>;
/**
 * Setup Cursor-specific directories and commands
 */
export declare function setupCursorCommands(cwd: string, sourceCommandsDir: string, skipPrompts?: boolean): Promise<{
    copied: string[];
    skipped: string[];
}>;
/**
 * Check if Cursor adapter is installed (has .cursor/commands/)
 */
export declare function isCursorAdapterInstalled(cwd: string): boolean;
/**
 * Check if a specific adapter file exists
 */
export declare function isAdapterInstalled(cwd: string, adapterKey: string): boolean;
export declare function adapter(args: string[]): Promise<void>;
export declare function generateAdapters(adapterNames: string[], sourceCommandsDir?: string, interactive?: boolean): Promise<void>;
