import * as p from '@clack/prompts';
import pc from 'picocolors';
import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'fs';
import { join, basename, dirname, resolve } from 'path';
import { ensureDir } from '../utils/files.js';
import { isInteractive } from '../utils/interactive.js';

// ── Types ────────────────────────────────────────────────────────────────

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

// ── Git helpers ──────────────────────────────────────────────────────────

/**
 * Run a git command and return the result
 */
export async function runGitCommand(
  args: string[],
  cwd?: string
): Promise<{ success: boolean; output: string; error: string }> {
  return new Promise((resolve) => {
    const git = spawn('git', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
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
export async function isGitClean(cwd?: string): Promise<boolean> {
  const result = await runGitCommand(['status', '--porcelain'], cwd);
  return result.success && result.output === '';
}

/**
 * Check if the current directory is inside a git worktree (not the main working tree)
 */
export async function isInsideWorktree(cwd?: string): Promise<boolean> {
  const result = await runGitCommand(['rev-parse', '--is-inside-work-tree'], cwd);
  if (!result.success) return false;

  // Check if this is the main worktree or a linked worktree
  const gitDir = await runGitCommand(['rev-parse', '--git-dir'], cwd);
  if (!gitDir.success) return false;

  // Linked worktrees have a .git file (not directory) pointing to .git/worktrees/<name>
  return gitDir.output.includes('/worktrees/');
}

/**
 * Get list of git worktrees
 */
export async function listGitWorktrees(cwd?: string): Promise<Array<{ path: string; branch: string; bare: boolean }>> {
  const result = await runGitCommand(['worktree', 'list', '--porcelain'], cwd);
  if (!result.success) return [];

  const worktrees: Array<{ path: string; branch: string; bare: boolean }> = [];
  let current: { path: string; branch: string; bare: boolean } | null = null;

  for (const line of result.output.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current) worktrees.push(current);
      current = { path: line.slice(9), branch: '', bare: false };
    } else if (line.startsWith('branch ') && current) {
      current.branch = line.slice(7).replace('refs/heads/', '');
    } else if (line === 'bare' && current) {
      current.bare = true;
    }
  }
  if (current) worktrees.push(current);

  return worktrees;
}

/**
 * Get the number of commits the base branch is ahead of the session branch point
 */
export async function getCommitsAhead(
  baseBranch: string,
  sessionBranch: string,
  cwd?: string
): Promise<number> {
  const result = await runGitCommand(
    ['rev-list', '--count', `${sessionBranch}..${baseBranch}`],
    cwd
  );
  if (!result.success) return 0;
  return parseInt(result.output, 10) || 0;
}

/**
 * Get the current branch name
 */
export async function getCurrentBranch(cwd?: string): Promise<string> {
  const result = await runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  return result.success ? result.output : 'main';
}

// ── Manifest helpers ─────────────────────────────────────────────────────

/**
 * Get the sessions directory path for a project
 */
export function getSessionsDir(projectDir: string): string {
  const projectName = basename(resolve(projectDir));
  return join(dirname(resolve(projectDir)), `${projectName}-sessions`);
}

/**
 * Get the manifest file path
 */
export function getManifestPath(projectDir: string): string {
  return join(getSessionsDir(projectDir), '.manifest.json');
}

/**
 * Read the session manifest, returning null if not found or invalid
 */
export function readSessionManifest(projectDir: string): SessionManifest | null {
  const manifestPath = getManifestPath(projectDir);
  if (!existsSync(manifestPath)) return null;

  try {
    const content = readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content) as SessionManifest;
  } catch {
    return null;
  }
}

/**
 * Write the session manifest
 */
export function writeSessionManifest(projectDir: string, manifest: SessionManifest): void {
  const manifestPath = getManifestPath(projectDir);
  ensureDir(dirname(manifestPath));
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

/**
 * Create an empty manifest for a project
 */
export function createEmptyManifest(projectDir: string): SessionManifest {
  return {
    version: 1,
    project: basename(resolve(projectDir)),
    sessions: [],
  };
}

/**
 * Add a session to the manifest
 */
export function addSessionToManifest(
  projectDir: string,
  session: SessionEntry
): SessionManifest {
  let manifest = readSessionManifest(projectDir);
  if (!manifest) {
    manifest = createEmptyManifest(projectDir);
  }

  manifest.sessions.push(session);
  writeSessionManifest(projectDir, manifest);
  return manifest;
}

/**
 * Remove a session from the manifest by ID
 */
export function removeSessionFromManifest(
  projectDir: string,
  sessionId: string
): SessionManifest | null {
  const manifest = readSessionManifest(projectDir);
  if (!manifest) return null;

  manifest.sessions = manifest.sessions.filter((s) => s.id !== sessionId);
  writeSessionManifest(projectDir, manifest);
  return manifest;
}

// ── Env file helpers ─────────────────────────────────────────────────────

const COMMON_ENV_FILES = [
  '.env',
  '.env.local',
  '.env.development.local',
];

/**
 * Copy common environment files from source to destination
 */
export function copyEnvFiles(
  sourceDir: string,
  destDir: string
): string[] {
  const copied: string[] = [];

  for (const envFile of COMMON_ENV_FILES) {
    const srcPath = join(sourceDir, envFile);
    if (existsSync(srcPath)) {
      copyFileSync(srcPath, join(destDir, envFile));
      copied.push(envFile);
    }
  }

  return copied;
}

// ── Time helpers ─────────────────────────────────────────────────────────

/**
 * Format a relative time string from an ISO date
 */
export function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

// ── Subcommands ──────────────────────────────────────────────────────────

/**
 * Create a new parallel session
 */
export async function parallelCreate(
  sessionName: string,
  goals: string[] = []
): Promise<void> {
  const cwd = process.cwd();
  const sessionsDir = getSessionsDir(cwd);
  const worktreePath = join(sessionsDir, sessionName);
  const branchName = `session/${sessionName}`;

  // Check if we're inside a worktree already
  if (await isInsideWorktree(cwd)) {
    p.log.error("You're already inside a parallel session worktree.");
    p.log.info('Start new parallel sessions from the main project directory.');
    return;
  }

  // Check for existing session with same name
  const manifest = readSessionManifest(cwd);
  if (manifest?.sessions.some((s) => s.id === sessionName)) {
    p.log.error(`A session named '${sessionName}' already exists.`);
    p.log.info('Use `flight-rules parallel status` to see active sessions.');
    return;
  }

  // Check if worktree path already exists
  if (existsSync(worktreePath)) {
    p.log.error(`Worktree path already exists: ${worktreePath}`);
    p.log.info('Use `flight-rules parallel cleanup` to remove orphaned worktrees.');
    return;
  }

  // Check for uncommitted changes
  const clean = await isGitClean(cwd);
  if (!clean) {
    if (!isInteractive()) {
      p.log.error('Git working directory is not clean.');
      p.log.info('Commit or stash your changes before creating a parallel session.');
      return;
    }

    const proceed = await p.confirm({
      message: 'You have uncommitted changes. Parallel sessions branch from HEAD. Proceed anyway?',
      initialValue: false,
    });

    if (p.isCancel(proceed) || !proceed) {
      p.log.info('Cancelled. Commit or stash your changes first.');
      return;
    }
  }

  // Check if branch already exists
  const branchCheck = await runGitCommand(['rev-parse', '--verify', branchName]);
  if (branchCheck.success) {
    p.log.error(`Branch '${branchName}' already exists.`);
    p.log.info('Choose a different session name or delete the existing branch.');
    return;
  }

  // Create sessions directory
  ensureDir(sessionsDir);

  // Create worktree with new branch
  p.log.info(`Creating worktree at ${pc.cyan(worktreePath)}...`);
  const worktreeResult = await runGitCommand([
    'worktree', 'add', worktreePath, '-b', branchName,
  ]);

  if (!worktreeResult.success) {
    p.log.error(`Failed to create worktree: ${worktreeResult.error}`);
    return;
  }
  p.log.success(`Worktree created on branch ${pc.cyan(branchName)}`);

  // Copy env files
  const copiedEnvFiles = copyEnvFiles(cwd, worktreePath);
  if (copiedEnvFiles.length > 0) {
    p.log.success(`Copied env files: ${copiedEnvFiles.join(', ')}`);
  }

  // Register in manifest
  const session: SessionEntry = {
    id: sessionName,
    branch: branchName,
    worktree: worktreePath,
    startedAt: new Date().toISOString(),
    goals,
    status: 'active',
  };
  addSessionToManifest(cwd, session);
  p.log.success('Session registered in manifest');

  // Display navigation instructions
  console.log();
  p.log.message(pc.dim('─'.repeat(50)));
  p.log.message(`To work in this session, open a new terminal and run:`);
  console.log();
  p.log.message(`  ${pc.cyan(`cd ${worktreePath}`)}`);
  p.log.message(`  ${pc.cyan('claude')}`);
  console.log();
  p.log.message(pc.dim('─'.repeat(50)));
}

/**
 * Show status of all parallel sessions
 */
export async function parallelStatus(): Promise<void> {
  const cwd = process.cwd();
  const manifest = readSessionManifest(cwd);

  if (!manifest || manifest.sessions.length === 0) {
    p.log.info('No active parallel sessions.');
    p.log.info('Create one with: flight-rules parallel create <name>');
    return;
  }

  // Get actual worktrees for cross-reference
  const worktrees = await listGitWorktrees(cwd);
  const worktreePaths = new Set(worktrees.map((w) => w.path));

  console.log();
  p.log.message(pc.bold('Active Parallel Sessions'));
  p.log.message(pc.dim('─'.repeat(60)));

  for (const session of manifest.sessions) {
    const exists = existsSync(session.worktree) && worktreePaths.has(session.worktree);
    const statusIcon = exists ? pc.green('●') : pc.red('●');
    const orphanTag = exists ? '' : pc.red(' (orphaned)');
    const age = formatRelativeTime(session.startedAt);

    p.log.message(
      `  ${statusIcon} ${pc.cyan(session.id)}${orphanTag}`
    );
    p.log.message(`    Branch: ${session.branch}`);
    p.log.message(`    Started: ${age}`);
    if (session.goals.length > 0) {
      p.log.message(`    Goals: ${session.goals.join(', ')}`);
    }
    p.log.message('');
  }

  p.log.message(pc.dim('─'.repeat(60)));

  // Show main directory status
  const mainClean = await isGitClean(cwd);
  const mainBranch = await getCurrentBranch(cwd);
  p.log.message(
    `Main directory: ${cwd} (${mainBranch}, ${mainClean ? 'clean' : 'dirty'})`
  );

  // Check for orphaned worktrees not in manifest
  const manifestPaths = new Set(manifest.sessions.map((s) => s.worktree));
  const sessionsDir = getSessionsDir(cwd);
  const unmanagedWorktrees = worktrees.filter(
    (w) => w.path.startsWith(sessionsDir) && !manifestPaths.has(w.path)
  );

  if (unmanagedWorktrees.length > 0) {
    console.log();
    p.log.warn('Found worktrees not in manifest:');
    for (const wt of unmanagedWorktrees) {
      p.log.message(`  ${pc.yellow(wt.path)} (${wt.branch})`);
    }
    p.log.info('Run `flight-rules parallel cleanup` to resolve.');
  }
}

/**
 * Clean up orphaned parallel sessions
 */
export async function parallelCleanup(options: ParallelOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const manifest = readSessionManifest(cwd);
  const interactive = isInteractive() && !options.force;

  if (!manifest || manifest.sessions.length === 0) {
    p.log.info('No sessions in manifest. Nothing to clean up.');
    return;
  }

  // Get actual worktrees
  const worktrees = await listGitWorktrees(cwd);
  const worktreePaths = new Set(worktrees.map((w) => w.path));

  // Find orphaned manifest entries (worktree no longer exists)
  const orphanedEntries = manifest.sessions.filter(
    (s) => !existsSync(s.worktree) || !worktreePaths.has(s.worktree)
  );

  if (orphanedEntries.length === 0) {
    p.log.success('No orphaned sessions found. Everything is clean.');
    return;
  }

  p.log.info(`Found ${orphanedEntries.length} orphaned session(s):`);
  for (const entry of orphanedEntries) {
    p.log.message(`  ${pc.yellow(entry.id)} — worktree missing at ${entry.worktree}`);
  }

  let removeCount = 0;

  for (const entry of orphanedEntries) {
    let shouldRemove = true;

    if (interactive) {
      const action = await p.confirm({
        message: `Remove orphaned session '${entry.id}' from manifest and delete branch '${entry.branch}'?`,
        initialValue: true,
      });

      if (p.isCancel(action)) {
        p.log.info('Cleanup cancelled.');
        return;
      }
      shouldRemove = action;
    }

    if (shouldRemove) {
      // Remove from manifest
      removeSessionFromManifest(cwd, entry.id);

      // Try to delete the branch
      const branchResult = await runGitCommand(['branch', '-D', entry.branch]);
      if (branchResult.success) {
        p.log.success(`Removed session '${entry.id}' and deleted branch '${entry.branch}'`);
      } else {
        p.log.success(`Removed session '${entry.id}' from manifest`);
        p.log.info(`Branch '${entry.branch}' may need manual cleanup: ${branchResult.error}`);
      }
      removeCount++;
    }
  }

  if (removeCount > 0) {
    p.log.success(`Cleaned up ${removeCount} orphaned session(s).`);
  }

  // Clean up empty sessions directory
  const sessionsDir = getSessionsDir(cwd);
  if (existsSync(sessionsDir)) {
    const remaining = readSessionManifest(cwd);
    if (!remaining || remaining.sessions.length === 0) {
      const entries = readdirSync(sessionsDir);
      // Only .manifest.json remains
      if (entries.length <= 1 && entries.every((e) => e === '.manifest.json')) {
        p.log.info('Sessions directory is empty and can be removed manually.');
      }
    }
  }
}

/**
 * Remove a specific parallel session with merge workflow
 */
export async function parallelRemove(
  sessionName: string,
  options: ParallelOptions = {}
): Promise<void> {
  const cwd = process.cwd();
  const manifest = readSessionManifest(cwd);
  const interactive = isInteractive() && !options.force;

  if (!manifest) {
    p.log.error('No session manifest found.');
    return;
  }

  const session = manifest.sessions.find((s) => s.id === sessionName);
  if (!session) {
    p.log.error(`Session '${sessionName}' not found.`);
    p.log.info('Run `flight-rules parallel status` to see active sessions.');
    return;
  }

  // Check if worktree still exists
  if (!existsSync(session.worktree)) {
    p.log.warn(`Worktree at ${session.worktree} no longer exists.`);
    removeSessionFromManifest(cwd, sessionName);
    p.log.success(`Removed '${sessionName}' from manifest.`);
    return;
  }

  // Check for uncommitted changes in the worktree
  const worktreeClean = await isGitClean(session.worktree);
  if (!worktreeClean) {
    p.log.warn(`Session '${sessionName}' has uncommitted changes.`);

    if (!interactive) {
      p.log.error('Cannot remove a session with uncommitted changes in non-interactive mode.');
      p.log.info('Commit or discard changes in the worktree first.');
      return;
    }

    const proceed = await p.confirm({
      message: 'Uncommitted changes will be lost. Proceed?',
      initialValue: false,
    });

    if (p.isCancel(proceed) || !proceed) {
      p.log.info('Cancelled. Commit your changes first.');
      return;
    }
  }

  // Determine merge strategy
  type MergeStrategy = 'pr' | 'merge' | 'keep' | 'abandon';
  let strategy: MergeStrategy = 'keep'; // safe default for non-interactive

  if (interactive) {
    // Check if base branch has diverged
    const baseBranch = await getCurrentBranch(cwd);
    const commitsAhead = await getCommitsAhead(baseBranch, session.branch, cwd);
    if (commitsAhead > 0) {
      p.log.warn(
        `The ${baseBranch} branch has ${commitsAhead} new commit(s) since this session started.`
      );
    }

    const choice = await p.select({
      message: 'How would you like to integrate these changes?',
      options: [
        { value: 'pr' as const, label: 'Create a PR', hint: 'recommended for review' },
        { value: 'merge' as const, label: 'Merge directly', hint: 'for small/safe changes' },
        { value: 'keep' as const, label: 'Keep branch for later', hint: "don't merge yet" },
        { value: 'abandon' as const, label: 'Abandon', hint: 'discard all changes' },
      ],
    });

    if (p.isCancel(choice)) {
      p.log.info('Cancelled.');
      return;
    }
    strategy = choice as MergeStrategy;
  }

  // Execute the merge strategy
  let branchDeleted = false;

  switch (strategy) {
    case 'pr': {
      p.log.info('Pushing branch and creating PR...');
      const pushResult = await runGitCommand(
        ['push', '-u', 'origin', session.branch],
        session.worktree
      );
      if (!pushResult.success) {
        p.log.error(`Failed to push: ${pushResult.error}`);
        p.log.info('You can push manually and create a PR later.');
        // Fall through to cleanup anyway
      } else {
        p.log.success(`Pushed ${pc.cyan(session.branch)} to origin`);

        // Try to create PR via gh
        const ghResult = await runGhPrCreate(session);
        if (ghResult.success) {
          p.log.success(`PR created: ${ghResult.output}`);
        } else {
          p.log.warn('Could not create PR automatically.');
          p.log.info(`Create one manually from branch ${pc.cyan(session.branch)}`);
        }
      }
      break;
    }

    case 'merge': {
      const baseBranch = await getCurrentBranch(cwd);
      p.log.info(`Merging ${session.branch} into ${baseBranch}...`);
      const mergeResult = await runGitCommand(
        ['merge', session.branch],
        cwd
      );
      if (!mergeResult.success) {
        p.log.error(`Merge failed: ${mergeResult.error}`);
        p.log.info('Resolve conflicts manually or choose a different strategy.');
        return; // Don't clean up if merge failed
      }
      p.log.success(`Merged ${pc.cyan(session.branch)} into ${baseBranch}`);
      branchDeleted = true; // We'll delete the branch after worktree removal
      break;
    }

    case 'keep': {
      // Try to push the branch to remote for safekeeping
      const pushResult = await runGitCommand(
        ['push', '-u', 'origin', session.branch],
        session.worktree
      );
      if (pushResult.success) {
        p.log.success(`Branch ${pc.cyan(session.branch)} pushed to origin for later.`);
      } else {
        p.log.info(`Branch ${pc.cyan(session.branch)} kept locally (push failed or no remote).`);
      }
      break;
    }

    case 'abandon': {
      p.log.info('Abandoning session changes...');
      branchDeleted = true; // Will delete branch after worktree removal
      break;
    }
  }

  // Clean up worktree
  p.log.info('Removing worktree...');
  const removeResult = await runGitCommand([
    'worktree', 'remove', session.worktree, '--force',
  ]);
  if (!removeResult.success) {
    p.log.warn(`Could not remove worktree: ${removeResult.error}`);
    p.log.info(`You may need to remove it manually: rm -rf ${session.worktree}`);
  } else {
    p.log.success('Worktree removed');
  }

  // Delete branch if appropriate
  if (branchDeleted) {
    const deleteResult = await runGitCommand(['branch', '-D', session.branch]);
    if (deleteResult.success) {
      p.log.success(`Branch ${pc.cyan(session.branch)} deleted`);
    } else {
      p.log.info(`Branch ${session.branch} may need manual cleanup.`);
    }
  }

  // Update manifest
  removeSessionFromManifest(cwd, sessionName);
  p.log.success(`Session '${sessionName}' removed from manifest`);

  // Clean up empty sessions directory
  const sessionsDir = getSessionsDir(cwd);
  if (existsSync(sessionsDir)) {
    const remainingManifest = readSessionManifest(cwd);
    if (!remainingManifest || remainingManifest.sessions.length === 0) {
      const entries = readdirSync(sessionsDir);
      if (entries.length <= 1) {
        p.log.info('No remaining sessions. Sessions directory can be removed.');
      }
    }
  }
}

// ── GitHub CLI helper ────────────────────────────────────────────────────

/**
 * Try to create a PR using gh CLI
 */
async function runGhPrCreate(
  session: SessionEntry
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const title = session.goals.length > 0
      ? session.goals[0]
      : `Parallel session: ${session.id}`;

    const body = [
      '## Summary',
      '',
      `Parallel session \`${session.id}\` started at ${session.startedAt}.`,
      '',
      session.goals.length > 0 ? '### Goals' : '',
      ...session.goals.map((g) => `- ${g}`),
      '',
      '---',
      `Created by \`flight-rules parallel remove --pr\``,
    ].join('\n');

    const gh = spawn('gh', [
      'pr', 'create',
      '--title', title,
      '--body', body,
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: session.worktree,
    });

    let output = '';

    gh.stdout?.on('data', (data) => {
      output += data.toString();
    });

    gh.stderr?.on('data', (data) => {
      output += data.toString();
    });

    gh.on('close', (code) => {
      resolve({ success: code === 0, output: output.trim() });
    });

    gh.on('error', () => {
      resolve({ success: false, output: 'gh CLI not available' });
    });
  });
}

// ── Main entry point ─────────────────────────────────────────────────────

/**
 * Main parallel command dispatcher
 */
export async function parallel(subcommand: string, args: string[], options: ParallelOptions = {}): Promise<void> {
  switch (subcommand) {
    case 'create': {
      const name = args[0];
      if (!name) {
        p.log.error('Session name is required.');
        p.log.info('Usage: flight-rules parallel create <name>');
        return;
      }
      // Validate session name (alphanumeric, hyphens, underscores)
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        p.log.error('Session name must contain only letters, numbers, hyphens, and underscores.');
        return;
      }
      await parallelCreate(name, args.slice(1));
      break;
    }

    case 'status':
      await parallelStatus();
      break;

    case 'cleanup':
      await parallelCleanup(options);
      break;

    case 'remove': {
      const name = args[0];
      if (!name) {
        p.log.error('Session name is required.');
        p.log.info('Usage: flight-rules parallel remove <name>');
        return;
      }
      await parallelRemove(name, options);
      break;
    }

    default:
      if (subcommand) {
        p.log.error(`Unknown subcommand: ${subcommand}`);
      }
      showParallelHelp();
      break;
  }
}

function showParallelHelp(): void {
  console.log(`
${pc.bold('Usage:')} flight-rules parallel <subcommand> [options]

${pc.bold('Subcommands:')}
  create <name>    Create a new parallel session in an isolated worktree
  status           Show all active parallel sessions
  cleanup          Detect and clean up orphaned sessions
  remove <name>    Remove a session (with merge workflow)

${pc.bold('Options:')}
  --force          Skip confirmations (cleanup, remove)

${pc.bold('Examples:')}
  flight-rules parallel create auth-refactor
  flight-rules parallel status
  flight-rules parallel cleanup
  flight-rules parallel remove auth-refactor
`);
}
