import * as p from '@clack/prompts';
import pc from 'picocolors';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { isFlightRulesInstalled, getFlightRulesDir } from '../utils/files.js';
const COMPLETION_SIGNAL = '<ralph-signal>COMPLETE</ralph-signal>';
/**
 * Generate a default branch name for Ralph work
 */
function generateBranchName() {
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
async function runGitCommand(args) {
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
async function isGitClean() {
    const result = await runGitCommand(['status', '--porcelain']);
    return result.success && result.output === '';
}
/**
 * Create and checkout a new git branch
 */
async function createAndCheckoutBranch(branchName) {
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
 * Build area constraint text to append to prompt
 */
function buildAreaConstraint(area) {
    return `

---

## Area Constraint

**IMPORTANT**: Focus ONLY on Area ${area} in the implementation docs.

- Only scan \`docs/implementation/${area}*/\` for task groups
- Ignore all other areas
- If no incomplete task groups exist in Area ${area}, output the completion signal
`;
}
/**
 * Check if Claude CLI is available
 */
async function isClaudeCliAvailable() {
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
async function runClaudeWithPrompt(promptContent, verbose) {
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
        claude.stdout?.on('data', (data) => {
            const text = data.toString();
            output += text;
            if (verbose) {
                // Parse stream-json format and extract text content
                const lines = text.split('\n').filter((line) => line.trim());
                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        // Handle different message types in stream-json format
                        if (parsed.type === 'assistant' && parsed.message?.content) {
                            for (const block of parsed.message.content) {
                                if (block.type === 'text' && block.text) {
                                    process.stdout.write(block.text);
                                }
                            }
                        }
                        else if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                            process.stdout.write(parsed.delta.text);
                        }
                    }
                    catch {
                        // Not valid JSON or incomplete line, skip
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
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Run the Ralph Loop - an autonomous agent loop that works through task groups
 */
export async function ralph(options) {
    const cwd = process.cwd();
    const flightRulesDir = getFlightRulesDir(cwd);
    const promptPath = join(flightRulesDir, 'prompts', 'ralph-loop.md');
    // Verify Flight Rules is installed
    if (!isFlightRulesInstalled(cwd)) {
        p.log.error('Flight Rules is not installed in this directory.');
        p.log.info('Run `flight-rules init` first.');
        return;
    }
    // Verify prompt file exists
    if (!existsSync(promptPath)) {
        p.log.error('Ralph prompt file not found.');
        p.log.info(`Expected at: ${promptPath}`);
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
    // Read the prompt content and optionally append area constraint
    let promptContent = readFileSync(promptPath, 'utf-8');
    if (options.area) {
        promptContent += buildAreaConstraint(options.area);
    }
    // Determine branch name if branching is requested
    let branchName;
    if (options.branch) {
        branchName = typeof options.branch === 'string' ? options.branch : generateBranchName();
    }
    // Dry run mode
    if (options.dryRun) {
        p.log.info(pc.yellow('Dry run mode - showing what would be executed:'));
        p.log.message(`  Prompt file: ${promptPath}`);
        p.log.message(`  Max iterations: ${options.maxIterations}`);
        if (options.area) {
            p.log.message(`  Area constraint: ${options.area}`);
        }
        if (branchName) {
            p.log.message(`  Branch: ${branchName}`);
        }
        p.log.message(`  Command: claude --dangerously-skip-permissions -p < "${promptPath}"`);
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
    p.log.info(`Starting autonomous loop with max ${options.maxIterations} iterations`);
    if (options.area) {
        p.log.info(`Targeting Area: ${pc.cyan(options.area)}`);
    }
    if (branchName) {
        p.log.info(`Working on branch: ${pc.cyan(branchName)}`);
    }
    p.log.warn('Press Ctrl+C to stop the loop at any time');
    console.log();
    for (let i = 1; i <= options.maxIterations; i++) {
        const separator = '='.repeat(50);
        p.log.step(pc.dim(separator));
        p.log.step(pc.magenta(`  Ralph Iteration ${i} of ${options.maxIterations}`));
        p.log.step(pc.dim(separator));
        console.log();
        try {
            const result = await runClaudeWithPrompt(promptContent, options.verbose);
            // Check for completion signal
            if (result.output.includes(COMPLETION_SIGNAL)) {
                console.log();
                p.log.success(pc.green('All task groups complete!'));
                p.log.info(`Finished at iteration ${i} of ${options.maxIterations}`);
                p.outro(pc.green('Ralph loop finished successfully'));
                return;
            }
            if (result.exitCode !== 0) {
                p.log.warn(`Claude exited with code ${result.exitCode}`);
            }
            p.log.info(`Iteration ${i} complete. Continuing...`);
            // Small delay between iterations to allow for any cleanup
            if (i < options.maxIterations) {
                await sleep(2000);
            }
        }
        catch (error) {
            p.log.error(`Error in iteration ${i}: ${error instanceof Error ? error.message : String(error)}`);
            // Continue to next iteration despite errors
        }
    }
    // Reached max iterations
    console.log();
    p.log.warn(`Reached max iterations (${options.maxIterations}) without completing all tasks.`);
    p.log.info('Check docs/progress.md and docs/ralph_logs/ for current status.');
    p.log.info('Run `flight-rules ralph` again to continue.');
    p.outro(pc.yellow('Ralph loop stopped'));
}
