export interface RalphOptions {
    maxIterations: number;
    dryRun: boolean;
    verbose: boolean;
    area?: string;
    branch?: string | boolean;
}
/**
 * Run the Ralph Loop - an autonomous agent loop that works through task groups
 */
export declare function ralph(options: RalphOptions): Promise<void>;
