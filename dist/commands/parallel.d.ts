export interface SessionEntry {
    id: string;
    branch: string;
    worktree: string;
    startedAt: string;
    goals: string[];
    status: 'active' | 'completed' | 'abandoned';
}
export interface SessionManifest {
    version: number;
    project: string;
    sessions: SessionEntry[];
}
export interface ParallelOptions {
    force?: boolean;
}
/**
 * Run a git command and return the result
 */
export declare function runGitCommand(args: string[], cwd?: string): Promise<{
    success: boolean;
    output: string;
    error: string;
}>;
/**
 * Check if git working directory is clean
 */
export declare function isGitClean(cwd?: string): Promise<boolean>;
/**
 * Check if the current directory is inside a git worktree (not the main working tree)
 */
export declare function isInsideWorktree(cwd?: string): Promise<boolean>;
/**
 * Get list of git worktrees
 */
export declare function listGitWorktrees(cwd?: string): Promise<Array<{
    path: string;
    branch: string;
    bare: boolean;
}>>;
/**
 * Get the number of commits the base branch is ahead of the session branch point
 */
export declare function getCommitsAhead(baseBranch: string, sessionBranch: string, cwd?: string): Promise<number>;
/**
 * Get the current branch name
 */
export declare function getCurrentBranch(cwd?: string): Promise<string>;
/**
 * Get the sessions directory path for a project
 */
export declare function getSessionsDir(projectDir: string): string;
/**
 * Get the manifest file path
 */
export declare function getManifestPath(projectDir: string): string;
/**
 * Read the session manifest, returning null if not found or invalid
 */
export declare function readSessionManifest(projectDir: string): SessionManifest | null;
/**
 * Write the session manifest
 */
export declare function writeSessionManifest(projectDir: string, manifest: SessionManifest): void;
/**
 * Create an empty manifest for a project
 */
export declare function createEmptyManifest(projectDir: string): SessionManifest;
/**
 * Add a session to the manifest
 */
export declare function addSessionToManifest(projectDir: string, session: SessionEntry): SessionManifest;
/**
 * Remove a session from the manifest by ID
 */
export declare function removeSessionFromManifest(projectDir: string, sessionId: string): SessionManifest | null;
/**
 * Copy common environment files from source to destination
 */
export declare function copyEnvFiles(sourceDir: string, destDir: string): string[];
/**
 * Format a relative time string from an ISO date
 */
export declare function formatRelativeTime(isoDate: string): string;
/**
 * Create a new parallel session
 */
export declare function parallelCreate(sessionName: string, goals?: string[]): Promise<void>;
/**
 * Show status of all parallel sessions
 */
export declare function parallelStatus(): Promise<void>;
/**
 * Clean up orphaned parallel sessions
 */
export declare function parallelCleanup(options?: ParallelOptions): Promise<void>;
/**
 * Remove a specific parallel session with merge workflow
 */
export declare function parallelRemove(sessionName: string, options?: ParallelOptions): Promise<void>;
/**
 * Main parallel command dispatcher
 */
export declare function parallel(subcommand: string, args: string[], options?: ParallelOptions): Promise<void>;
