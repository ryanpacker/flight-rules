import * as p from '@clack/prompts';
import pc from 'picocolors';
import { writeFileSync, existsSync, readdirSync, cpSync } from 'fs';
import { join } from 'path';
import { ensureDir, getFlightRulesDir } from '../utils/files.js';

interface AdapterConfig {
  name: string;
  filename: string;
  title: string;
  description: string;
  /** Whether this adapter uses native commands (like Cursor's .cursor/commands/) */
  hasNativeCommands: boolean;
}

const ADAPTERS: Record<string, AdapterConfig> = {
  cursor: {
    name: 'Cursor',
    filename: 'AGENTS.md',
    title: 'Flight Rules – Cursor Adapter',
    description: 'This file is placed at the project root as `AGENTS.md` for Cursor compatibility.',
    hasNativeCommands: true,
  },
  claude: {
    name: 'Claude Code',
    filename: 'CLAUDE.md',
    title: 'Flight Rules – Claude Code Adapter',
    description: 'This file is placed at the project root as `CLAUDE.md` for Claude Code compatibility.',
    hasNativeCommands: false,
  },
};

function generateAdapterContent(config: AdapterConfig): string {
  // Adapter-specific command instructions
  const commandLocation = config.hasNativeCommands
    ? `\`.cursor/commands/\` (as slash commands)`
    : `\`.flight-rules/commands/\``;
  
  const commandInstructions = config.hasNativeCommands
    ? `Use the \`/start-coding-session\` and \`/end-coding-session\` slash commands.`
    : `When the user says "start coding session" or "end coding session", follow the instructions in \`.flight-rules/commands/\`.`;

  return `# ${config.title}

${config.description}

---

**This project uses Flight Rules.**

Agent guidelines and workflows live in \`.flight-rules/\`. Project documentation lives in \`docs/\`.

## Quick Reference

| What | Where |
|------|-------|
| Agent Guidelines | \`.flight-rules/AGENTS.md\` |
| PRD | \`docs/prd.md\` |
| Implementation Specs | \`docs/implementation/\` |
| Progress Log | \`docs/progress.md\` |
| Tech Stack | \`docs/tech-stack.md\` |
| Session Commands | ${commandLocation} |

## For Agents

Please read \`.flight-rules/AGENTS.md\` for complete guidelines on:
- Project structure
- Implementation specs
- Coding sessions
- How to work with this system

${commandInstructions}
`;
}

/**
 * Result of conflict handling for a single file
 */
type ConflictAction = 'replace' | 'skip' | 'replace_all' | 'skip_all';

/**
 * Copy command files to a destination directory with conflict handling
 */
export async function copyCommandsWithConflictHandling(
  sourceDir: string,
  destDir: string,
  skipPrompts = false
): Promise<{ copied: string[]; skipped: string[] }> {
  const copied: string[] = [];
  const skipped: string[] = [];
  
  if (!existsSync(sourceDir)) {
    return { copied, skipped };
  }
  
  const files = readdirSync(sourceDir).filter(f => f.endsWith('.md'));
  let batchAction: 'replace_all' | 'skip_all' | null = null;
  
  for (const file of files) {
    const srcPath = join(sourceDir, file);
    const destPath = join(destDir, file);
    
    if (existsSync(destPath)) {
      // File already exists - need to handle conflict
      if (skipPrompts) {
        // During upgrade with no prompts, replace by default
        cpSync(srcPath, destPath);
        copied.push(file);
        continue;
      }
      
      if (batchAction === 'replace_all') {
        cpSync(srcPath, destPath);
        copied.push(file);
        continue;
      } else if (batchAction === 'skip_all') {
        skipped.push(file);
        continue;
      }
      
      // Prompt for this specific file
      const action = await promptForConflict(file, files.length > 1);
      
      if (action === 'replace_all') {
        batchAction = 'replace_all';
        cpSync(srcPath, destPath);
        copied.push(file);
      } else if (action === 'skip_all') {
        batchAction = 'skip_all';
        skipped.push(file);
      } else if (action === 'replace') {
        cpSync(srcPath, destPath);
        copied.push(file);
      } else {
        skipped.push(file);
      }
    } else {
      // No conflict - just copy
      cpSync(srcPath, destPath);
      copied.push(file);
    }
  }
  
  return { copied, skipped };
}

/**
 * Prompt user for how to handle a file conflict
 */
async function promptForConflict(filename: string, showBatchOptions: boolean): Promise<ConflictAction> {
  type OptionType = { value: ConflictAction; label: string; hint: string };
  
  const options: OptionType[] = [
    { value: 'replace', label: 'Replace', hint: 'overwrite with Flight Rules version' },
    { value: 'skip', label: 'Skip', hint: 'keep existing file' },
  ];
  
  if (showBatchOptions) {
    options.push(
      { value: 'replace_all', label: 'Replace all', hint: 'replace this and all remaining conflicts' },
      { value: 'skip_all', label: 'Skip all', hint: 'skip this and all remaining conflicts' }
    );
  }
  
  const action = await p.select({
    message: `${pc.cyan(filename)} already exists. What would you like to do?`,
    options,
  });
  
  if (p.isCancel(action)) {
    return 'skip';
  }
  
  return action as ConflictAction;
}

/**
 * Setup Cursor-specific directories and commands
 */
export async function setupCursorCommands(
  cwd: string,
  sourceCommandsDir: string,
  skipPrompts = false
): Promise<{ copied: string[]; skipped: string[] }> {
  const cursorDir = join(cwd, '.cursor');
  const cursorCommandsDir = join(cursorDir, 'commands');
  
  // Create directories
  ensureDir(cursorDir);
  ensureDir(cursorCommandsDir);
  
  // Copy commands with conflict handling
  return copyCommandsWithConflictHandling(sourceCommandsDir, cursorCommandsDir, skipPrompts);
}

/**
 * Check if Cursor adapter is installed (has .cursor/commands/)
 */
export function isCursorAdapterInstalled(cwd: string): boolean {
  return existsSync(join(cwd, '.cursor', 'commands'));
}

/**
 * Check if a specific adapter file exists
 */
export function isAdapterInstalled(cwd: string, adapterKey: string): boolean {
  const config = ADAPTERS[adapterKey];
  if (!config) return false;
  
  if (adapterKey === 'cursor') {
    // For Cursor, check both AGENTS.md and .cursor/commands/
    return existsSync(join(cwd, config.filename)) || isCursorAdapterInstalled(cwd);
  }
  
  return existsSync(join(cwd, config.filename));
}

export async function adapter(args: string[]) {
  const cwd = process.cwd();
  
  // Parse arguments
  let selectedAdapters: string[] = [];
  
  if (args.includes('--all')) {
    selectedAdapters = Object.keys(ADAPTERS);
  } else {
    for (const arg of args) {
      const adapterName = arg.replace('--', '');
      if (ADAPTERS[adapterName]) {
        selectedAdapters.push(adapterName);
      }
    }
  }
  
  // If no adapters specified via args, prompt for selection
  if (selectedAdapters.length === 0) {
    const selection = await p.multiselect({
      message: 'Which adapters would you like to generate?',
      options: Object.entries(ADAPTERS).map(([key, config]) => ({
        value: key,
        label: key === 'cursor' 
          ? `${config.name} (${config.filename} + .cursor/commands/)` 
          : `${config.name} (${config.filename})`,
        hint: key === 'cursor' ? 'recommended' : undefined,
      })),
      initialValues: ['cursor'],
    });
    
    if (p.isCancel(selection)) {
      p.log.info('Cancelled.');
      return;
    }
    
    selectedAdapters = selection as string[];
  }
  
  await generateAdapters(selectedAdapters);
}

export async function generateAdapters(adapterNames: string[], sourceCommandsDir?: string) {
  const cwd = process.cwd();
  
  // Default to .flight-rules/commands if no source specified
  const commandsDir = sourceCommandsDir ?? join(getFlightRulesDir(cwd), 'commands');
  
  for (const name of adapterNames) {
    const config = ADAPTERS[name];
    if (!config) continue;
    
    const filePath = join(cwd, config.filename);
    
    // Check if file already exists
    if (existsSync(filePath)) {
      const overwrite = await p.confirm({
        message: `${config.filename} already exists. Overwrite?`,
        initialValue: false,
      });
      
      if (p.isCancel(overwrite) || !overwrite) {
        p.log.info(`Skipped ${config.filename}`);
        continue;
      }
    }
    
    const content = generateAdapterContent(config);
    writeFileSync(filePath, content, 'utf-8');
    p.log.success(`Created ${pc.cyan(config.filename)} for ${config.name}`);
    
    // For Cursor, also set up .cursor/commands/
    if (name === 'cursor') {
      const result = await setupCursorCommands(cwd, commandsDir);
      
      if (result.copied.length > 0) {
        p.log.success(`Created ${pc.cyan('.cursor/commands/')} with ${result.copied.length} command(s)`);
      }
      if (result.skipped.length > 0) {
        p.log.info(`Skipped ${result.skipped.length} existing command(s) in .cursor/commands/`);
      }
    }
  }
}

