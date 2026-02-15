import * as p from '@clack/prompts';
import pc from 'picocolors';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { isFlightRulesInstalled, getFlightRulesDir } from '../utils/files.js';

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
  incompleteTasks: Array<{ id: string; title: string; status: string }>;
}

/**
 * Generate a default branch name for Ralph work
 */
function generateBranchName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `ralph/${year}${month}${day}-${hours}${minutes}`;
}

/**
 * Run a git command and return the result
 */
async function runGitCommand(args: string[]): Promise<{ success: boolean; output: string; error: string }> {
  return new Promise((resolve) => {
    const git = spawn('git', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let error = '';

    git.stdout?.on('data', (data) => {
      output += data.toString();
    });

    git.stderr?.on('data', (data) => {
      error += data.toString();
    });

    git.on('close', (code) => {
      resolve({ success: code === 0, output: output.trim(), error: error.trim() });
    });

    git.on('error', (err) => {
      resolve({ success: false, output: '', error: err.message });
    });
  });
}

/**
 * Check if git working directory is clean
 */
async function isGitClean(): Promise<boolean> {
  const result = await runGitCommand(['status', '--porcelain']);
  return result.success && result.output === '';
}

/**
 * Create and checkout a new git branch
 */
async function createAndCheckoutBranch(branchName: string): Promise<{ success: boolean; error?: string }> {
  // Check if branch already exists
  const checkResult = await runGitCommand(['rev-parse', '--verify', branchName]);
  if (checkResult.success) {
    return { success: false, error: `Branch '${branchName}' already exists` };
  }

  // Create and checkout new branch
  const result = await runGitCommand(['checkout', '-b', branchName]);
  if (!result.success) {
    return { success: false, error: result.error || 'Failed to create branch' };
  }

  return { success: true };
}

/**
 * Build area constraint text to append to discovery prompt
 */
function buildAreaConstraint(area: string): string {
  return `

---

## Area Constraint

**IMPORTANT**: Focus ONLY on Area ${area} in the implementation docs.

- Only scan \`docs/implementation/${area}*/\` for task groups
- Ignore all other areas
- If no incomplete task groups exist in Area ${area}, respond with ALL_COMPLETE
`;
}

/**
 * Format a timestamp for verbose output: [HH:MM:SS]
 */
export function formatTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `[${hours}:${minutes}:${seconds}]`;
}

/**
 * Check if Claude CLI is available
 */
async function isClaudeCliAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const claude = spawn('claude', ['--version'], {
      stdio: 'pipe',
      shell: true,
    });

    claude.on('close', (code) => {
      resolve(code === 0);
    });

    claude.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Run Claude with the ralph prompt
 */
async function runClaudeWithPrompt(
  promptContent: string,
  verbose: boolean
): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    // Use --output-format stream-json for real-time streaming output
    // Note: Claude CLI requires --verbose when using stream-json with -p
    const claude = spawn('claude', [
      '--dangerously-skip-permissions',
      '-p',
      '--verbose',
      '--output-format',
      'stream-json',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let errorOutput = '';
    let lineBuffer = ''; // Buffer for incomplete JSON lines
    let needsTimestamp = true; // Track whether next text output needs a timestamp

    claude.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;

      if (verbose) {
        // Prepend any buffered partial line from previous chunk
        const fullText = lineBuffer + text;
        const lines = fullText.split('\n');

        // Last element might be incomplete - save it for next chunk
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            // Handle different message types in stream-json format
            if (parsed.type === 'assistant' && parsed.message?.content) {
              for (const block of parsed.message.content) {
                if (block.type === 'text' && block.text) {
                  if (needsTimestamp) {
                    process.stdout.write(`${formatTimestamp()} `);
                    needsTimestamp = false;
                  }
                  process.stdout.write(block.text);
                }
              }
            } else if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              if (needsTimestamp) {
                process.stdout.write(`${formatTimestamp()} `);
                needsTimestamp = false;
              }
              process.stdout.write(parsed.delta.text);
            } else if (parsed.type === 'content_block_stop') {
              // Add newline + blank line after each content block ends
              process.stdout.write('\n\n');
              needsTimestamp = true;
            }
          } catch {
            // Not valid JSON, skip
          }
        }
      }
    });

    claude.stderr?.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      if (verbose) {
        process.stderr.write(text);
      }
    });

    claude.on('close', (code) => {
      resolve({ output, exitCode: code ?? 0 });
    });

    claude.on('error', (err) => {
      reject(err);
    });

    // Send prompt to stdin
    claude.stdin?.write(promptContent);
    claude.stdin?.end();
  });
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse the discovery response from Claude into TaskGroupPlan objects.
 * Returns null if the response cannot be parsed (tags not found).
 * Returns empty array if ALL_COMPLETE.
 */
export function parseDiscoveryResponse(output: string): TaskGroupPlan[] | null {
  // Extract content between <ralph-discovery> tags
  const match = output.match(/<ralph-discovery>([\s\S]*?)<\/ralph-discovery>/);
  if (!match) {
    return null;
  }

  const content = match[1].trim();

  // Handle ALL_COMPLETE case
  if (content === 'ALL_COMPLETE') {
    return [];
  }

  const taskGroups: TaskGroupPlan[] = [];
  let currentGroup: TaskGroupPlan | null = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('TASK_GROUP|')) {
      const parts = trimmed.split('|');
      if (parts.length >= 5) {
        currentGroup = {
          id: parts[1],
          title: parts[2],
          filePath: parts[3],
          area: parts[4],
          incompleteTasks: [],
        };
        taskGroups.push(currentGroup);
      }
    } else if (trimmed.startsWith('TASK|') && currentGroup) {
      const parts = trimmed.split('|');
      if (parts.length >= 4) {
        currentGroup.incompleteTasks.push({
          id: parts[1],
          title: parts[2],
          status: parts[3],
        });
      }
    }
    // Skip malformed lines silently
  }

  return taskGroups;
}

/**
 * Build an execution prompt from the template and a task group plan.
 */
export function buildExecutionPrompt(template: string, taskGroup: TaskGroupPlan): string {
  // Render incomplete tasks as markdown bullet points
  const tasksList = taskGroup.incompleteTasks
    .map((t) => `- **${t.id}**: ${t.title} (${t.status})`)
    .join('\n');

  return template
    .replace(/\{\{TASK_GROUP_ID\}\}/g, taskGroup.id)
    .replace(/\{\{TASK_GROUP_TITLE\}\}/g, taskGroup.title)
    .replace(/\{\{TASK_GROUP_FILE_PATH\}\}/g, taskGroup.filePath)
    .replace(/\{\{INCOMPLETE_TASKS_LIST\}\}/g, tasksList);
}

/**
 * Run the Ralph Loop - an autonomous agent loop that works through task groups
 */
export async function ralph(options: RalphOptions): Promise<void> {
  const cwd = process.cwd();
  const flightRulesDir = getFlightRulesDir(cwd);
  const discoveryPromptPath = join(flightRulesDir, 'prompts', 'ralph-discovery.md');
  const executionPromptPath = join(flightRulesDir, 'prompts', 'ralph-execution.md');

  // Verify Flight Rules is installed
  if (!isFlightRulesInstalled(cwd)) {
    p.log.error('Flight Rules is not installed in this directory.');
    p.log.info('Run `flight-rules init` first.');
    return;
  }

  // Verify both prompt files exist
  if (!existsSync(discoveryPromptPath)) {
    p.log.error('Ralph discovery prompt file not found.');
    p.log.info(`Expected at: ${discoveryPromptPath}`);
    p.log.info('You may need to run `flight-rules upgrade` to get the latest files.');
    return;
  }

  if (!existsSync(executionPromptPath)) {
    p.log.error('Ralph execution prompt file not found.');
    p.log.info(`Expected at: ${executionPromptPath}`);
    p.log.info('You may need to run `flight-rules upgrade` to get the latest files.');
    return;
  }

  // Verify Claude CLI is available
  const claudeAvailable = await isClaudeCliAvailable();
  if (!claudeAvailable) {
    p.log.error('Claude Code CLI not found.');
    p.log.info('Install it with: npm install -g @anthropic-ai/claude-code');
    return;
  }

  // Read prompt files
  let discoveryPrompt = readFileSync(discoveryPromptPath, 'utf-8');
  const executionTemplate = readFileSync(executionPromptPath, 'utf-8');

  // Optionally append area constraint to discovery prompt
  if (options.area) {
    discoveryPrompt += buildAreaConstraint(options.area);
  }

  // Determine branch name if branching is requested
  let branchName: string | undefined;
  if (options.branch) {
    branchName = typeof options.branch === 'string' ? options.branch : generateBranchName();
  }

  // Dry run mode
  if (options.dryRun) {
    p.log.info(pc.yellow('Dry run mode - showing what would be executed:'));
    p.log.message(`  Discovery prompt: ${discoveryPromptPath}`);
    p.log.message(`  Execution prompt: ${executionPromptPath}`);
    p.log.message(`  Max task groups: ${options.maxIterations}`);
    if (options.area) {
      p.log.message(`  Area constraint: ${options.area}`);
    }
    if (branchName) {
      p.log.message(`  Branch: ${branchName}`);
    }
    p.log.message('  Phase 1: Discovery — identify incomplete task groups');
    p.log.message('  Phase 2: Execution — one Claude instance per task group');
    return;
  }

  // Handle branch creation if requested
  if (branchName) {
    // Check for clean git state
    const clean = await isGitClean();
    if (!clean) {
      p.log.error('Git working directory is not clean.');
      p.log.info('Commit or stash your changes before starting a Ralph loop with --branch.');
      return;
    }

    // Create and checkout new branch
    p.log.info(`Creating branch: ${pc.cyan(branchName)}`);
    const branchResult = await createAndCheckoutBranch(branchName);
    if (!branchResult.success) {
      p.log.error(`Failed to create branch: ${branchResult.error}`);
      return;
    }
    p.log.success(`Switched to new branch: ${pc.cyan(branchName)}`);
  }

  // Start the loop
  console.log();
  p.intro(pc.bgMagenta(pc.white(' Flight Rules Ralph Loop ')));
  p.log.info(`Two-phase mode: discover then execute (max ${options.maxIterations} task groups)`);
  if (options.area) {
    p.log.info(`Targeting Area: ${pc.cyan(options.area)}`);
  }
  if (branchName) {
    p.log.info(`Working on branch: ${pc.cyan(branchName)}`);
  }
  p.log.warn('Press Ctrl+C to stop the loop at any time');
  console.log();

  // ── Phase 1: Discovery ──────────────────────────────────────────────
  p.log.step(pc.magenta('Phase 1: Discovery'));
  p.log.info('Scanning implementation docs for incomplete task groups...');
  console.log();

  let taskGroups: TaskGroupPlan[];

  try {
    const discoveryResult = await runClaudeWithPrompt(discoveryPrompt, options.verbose);

    if (discoveryResult.exitCode !== 0) {
      p.log.warn(`Discovery phase exited with code ${discoveryResult.exitCode}`);
    }

    const parsed = parseDiscoveryResponse(discoveryResult.output);

    if (parsed === null) {
      p.log.error('Could not parse discovery response. Expected <ralph-discovery> tags.');
      p.log.info('Run with --verbose to see the full Claude output.');
      p.outro(pc.red('Ralph loop aborted'));
      return;
    }

    taskGroups = parsed;
  } catch (error) {
    p.log.error(`Discovery phase failed: ${error instanceof Error ? error.message : String(error)}`);
    p.outro(pc.red('Ralph loop aborted'));
    return;
  }

  // Handle ALL_COMPLETE
  if (taskGroups.length === 0) {
    console.log();
    p.log.success(pc.green('All task groups complete!'));
    p.outro(pc.green('Ralph loop finished — nothing to do'));
    return;
  }

  // Display discovered task groups
  console.log();
  p.log.info(`Found ${taskGroups.length} incomplete task group(s):`);
  for (const tg of taskGroups) {
    p.log.message(`  ${pc.cyan(tg.id)} — ${tg.title} (${tg.incompleteTasks.length} tasks)`);
  }
  console.log();

  // Limit to max iterations
  const groupsToExecute = taskGroups.slice(0, options.maxIterations);
  if (taskGroups.length > options.maxIterations) {
    p.log.info(`Will execute ${options.maxIterations} of ${taskGroups.length} task groups (--max-iterations)`);
    console.log();
  }

  // ── Phase 2: Execution ──────────────────────────────────────────────
  p.log.step(pc.magenta('Phase 2: Execution'));
  console.log();

  let completed = 0;
  let failed = 0;

  for (let i = 0; i < groupsToExecute.length; i++) {
    const taskGroup = groupsToExecute[i];
    const separator = '='.repeat(50);
    p.log.step(pc.dim(separator));
    p.log.step(pc.magenta(`  Task Group ${i + 1} of ${groupsToExecute.length}: ${taskGroup.id} — ${taskGroup.title}`));
    p.log.step(pc.dim(separator));
    console.log();

    try {
      const executionPrompt = buildExecutionPrompt(executionTemplate, taskGroup);
      const result = await runClaudeWithPrompt(executionPrompt, options.verbose);

      if (result.exitCode !== 0) {
        p.log.warn(`Task group ${taskGroup.id} exited with code ${result.exitCode}`);
        failed++;
      } else {
        p.log.success(`Task group ${taskGroup.id} complete`);
        completed++;
      }
    } catch (error) {
      p.log.error(`Error executing task group ${taskGroup.id}: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
      // Continue to next task group despite errors
    }

    // Small delay between executions
    if (i < groupsToExecute.length - 1) {
      await sleep(2000);
    }
  }

  // Summary
  console.log();
  const separator = '='.repeat(50);
  p.log.step(pc.dim(separator));
  p.log.info(`Summary: ${completed} completed, ${failed} failed out of ${groupsToExecute.length} task groups`);

  if (taskGroups.length > options.maxIterations) {
    p.log.info(`${taskGroups.length - options.maxIterations} task group(s) remaining. Run \`flight-rules ralph\` again to continue.`);
  }

  if (failed > 0) {
    p.log.info('Check docs/ralph_logs/ for details on failures.');
    p.outro(pc.yellow('Ralph loop finished with errors'));
  } else {
    p.outro(pc.green('Ralph loop finished successfully'));
  }
}
