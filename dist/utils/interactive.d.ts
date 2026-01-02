/**
 * Check if the CLI is running in an interactive terminal.
 * Returns false in CI environments, piped output, or when called by agents.
 */
export declare function isInteractive(): boolean;
