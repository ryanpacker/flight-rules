/**
 * Copy command files to a destination directory with conflict handling
 */
export declare function copyCommandsWithConflictHandling(sourceDir: string, destDir: string, skipPrompts?: boolean): Promise<{
    copied: string[];
    skipped: string[];
}>;
/**
 * Copy skill files to a destination directory with conflict handling.
 * Source skills are flat .md files (e.g., web-prototype.md).
 * They are deployed as directories containing SKILL.md (e.g., web-prototype/SKILL.md),
 * which is the format Claude Code expects.
 */
export declare function copySkillsWithConflictHandling(sourceDir: string, destDir: string, skipPrompts?: boolean): Promise<{
    copied: string[];
    skipped: string[];
}>;
/**
 * Setup skills for a given adapter directory
 */
export declare function setupSkills(cwd: string, sourceSkillsDir: string, adapterSkillsDir: string, skipPrompts?: boolean): Promise<{
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
 * Setup Claude Code-specific directories and commands
 */
export declare function setupClaudeCommands(cwd: string, sourceCommandsDir: string, skipPrompts?: boolean): Promise<{
    copied: string[];
    skipped: string[];
}>;
/**
 * Check if Claude Code adapter is installed (has .claude/commands/)
 */
export declare function isClaudeAdapterInstalled(cwd: string): boolean;
/**
 * Check if a specific adapter file exists
 */
export declare function isAdapterInstalled(cwd: string, adapterKey: string): boolean;
export declare function adapter(args: string[]): Promise<void>;
export declare function generateAdapters(adapterNames: string[], sourceCommandsDir?: string, interactive?: boolean): Promise<void>;
