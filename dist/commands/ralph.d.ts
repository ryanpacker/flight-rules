export interface RalphOptions {
    maxIterations: number;
    dryRun: boolean;
    verbose: boolean;
    area?: string;
    branch?: string | boolean;
}
export interface TaskGroupPlan {
    id: string;
    title: string;
    filePath: string;
    area: string;
    incompleteTasks: Array<{
        id: string;
        title: string;
        status: string;
    }>;
}
/**
 * Parse the discovery response from Claude into TaskGroupPlan objects.
 * Returns null if the response cannot be parsed (tags not found).
 * Returns empty array if ALL_COMPLETE.
 */
export declare function parseDiscoveryResponse(output: string): TaskGroupPlan[] | null;
/**
 * Build an execution prompt from the template and a task group plan.
 */
export declare function buildExecutionPrompt(template: string, taskGroup: TaskGroupPlan): string;
/**
 * Run the Ralph Loop - an autonomous agent loop that works through task groups
 */
export declare function ralph(options: RalphOptions): Promise<void>;
