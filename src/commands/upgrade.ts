import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync } from 'fs';
import { join } from 'path';
import { 
  isFlightRulesInstalled, 
  fetchPayloadFromGitHub,
  copyFrameworkFilesFrom
} from '../utils/files.js';
import { 
  isCursorAdapterInstalled, 
  setupCursorCommands
} from './adapter.js';

export async function upgrade(version?: string) {
  const cwd = process.cwd();
  
  // Check if Flight Rules is installed
  if (!isFlightRulesInstalled(cwd)) {
    p.log.error('Flight Rules is not installed in this directory.');
    p.outro('Run `flight-rules init` to install Flight Rules first.');
    return;
  }
  
  // Detect installed adapters before upgrade
  const cursorAdapterInstalled = isCursorAdapterInstalled(cwd);
  const agentsMdExists = existsSync(join(cwd, 'AGENTS.md'));
  const claudeMdExists = existsSync(join(cwd, 'CLAUDE.md'));
  
  // Show what will be upgraded
  p.log.info(`${pc.bold('The .flight-rules/ directory will be upgraded.')}`);
  p.log.message('  Framework files (AGENTS.md, doc-templates/, commands/, prompts/) will be replaced.');
  console.log();
  
  // Show adapter upgrade info
  const adaptersToUpgrade: string[] = [];
  if (cursorAdapterInstalled) {
    adaptersToUpgrade.push('Cursor (.cursor/commands/)');
  }
  if (agentsMdExists) {
    adaptersToUpgrade.push('AGENTS.md');
  }
  if (claudeMdExists) {
    adaptersToUpgrade.push('CLAUDE.md');
  }
  
  if (adaptersToUpgrade.length > 0) {
    p.log.info(`${pc.bold('Installed adapters will also be upgraded:')}`);
    p.log.message(`  ${adaptersToUpgrade.join(', ')}`);
    console.log();
  }
  
  p.log.info(`${pc.bold('Your project content will be preserved.')}`);
  p.log.message('  docs/ at project root is never touched by Flight Rules.');
  console.log();
  
  const spinner = p.spinner();
  
  // Fetch from GitHub
  spinner.start(version ? `Fetching Flight Rules ${version} from GitHub...` : 'Fetching latest Flight Rules from GitHub...');
  
  let fetched;
  try {
    fetched = await fetchPayloadFromGitHub(version);
    spinner.stop(`Found Flight Rules version ${pc.cyan(fetched.version)}`);
  } catch (error) {
    spinner.stop('Failed to fetch from GitHub');
    if (error instanceof Error) {
      p.log.error(error.message);
    }
    p.outro('Check your network connection and try again.');
    return;
  }
  
  const shouldContinue = await p.confirm({
    message: `Upgrade to version ${fetched.version}?`,
    initialValue: true,
  });
  
  if (p.isCancel(shouldContinue) || !shouldContinue) {
    fetched.cleanup();
    p.log.info('Upgrade cancelled.');
    return;
  }
  
  // Upgrade .flight-rules/
  spinner.start('Upgrading Flight Rules...');
  try {
    copyFrameworkFilesFrom(fetched.payloadPath, cwd);
    spinner.stop('Flight Rules framework upgraded!');
  } catch (error) {
    spinner.stop('Failed to upgrade Flight Rules');
    fetched.cleanup();
    throw error;
  }
  
  p.log.success('Framework files have been updated.');
  
  // Upgrade installed adapters
  if (adaptersToUpgrade.length > 0) {
    spinner.start('Upgrading adapters...');
    
    try {
      const sourceCommandsDir = join(fetched.payloadPath, 'commands');
      
      // Upgrade Cursor commands if installed
      if (cursorAdapterInstalled) {
        const result = await setupCursorCommands(cwd, sourceCommandsDir, true); // skipPrompts = true for upgrade
        if (result.copied.length > 0) {
          p.log.success(`Updated ${result.copied.length} command(s) in .cursor/commands/`);
        }
      }
      
      // Regenerate adapter files
      const adaptersToRegenerate: string[] = [];
      if (agentsMdExists) {
        adaptersToRegenerate.push('cursor');
      }
      if (claudeMdExists) {
        adaptersToRegenerate.push('claude');
      }
      
      if (adaptersToRegenerate.length > 0) {
        // For upgrade, we regenerate silently (the files already exist, so we just overwrite)
        for (const adapterName of adaptersToRegenerate) {
          await regenerateAdapterFile(cwd, adapterName, sourceCommandsDir);
        }
      }
      
      spinner.stop('Adapters upgraded!');
    } catch (error) {
      spinner.stop('Failed to upgrade adapters');
      fetched.cleanup();
      throw error;
    }
  }
  
  fetched.cleanup();
  
  p.log.info('Check doc-templates/ for any new templates you might want to use.');
  p.outro(pc.green('Upgrade complete!'));
}

/**
 * Regenerate a single adapter file during upgrade (no prompts, just overwrite)
 */
async function regenerateAdapterFile(cwd: string, adapterName: string, _sourceCommandsDir: string): Promise<void> {
  // Import the adapter config and content generator
  const { writeFileSync } = await import('fs');
  const { join } = await import('path');
  
  const ADAPTERS: Record<string, { filename: string; title: string; description: string; hasNativeCommands: boolean }> = {
    cursor: {
      filename: 'AGENTS.md',
      title: 'Flight Rules – Cursor Adapter',
      description: 'This file is placed at the project root as `AGENTS.md` for Cursor compatibility.',
      hasNativeCommands: true,
    },
    claude: {
      filename: 'CLAUDE.md',
      title: 'Flight Rules – Claude Code Adapter',
      description: 'This file is placed at the project root as `CLAUDE.md` for Claude Code compatibility.',
      hasNativeCommands: false,
    },
  };
  
  const config = ADAPTERS[adapterName];
  if (!config) return;
  
  const commandLocation = config.hasNativeCommands
    ? `\`.cursor/commands/\` (as slash commands)`
    : `\`.flight-rules/commands/\``;
  
  const commandInstructions = config.hasNativeCommands
    ? `Use the \`/start-coding-session\` and \`/end-coding-session\` slash commands.`
    : `When the user says "start coding session" or "end coding session", follow the instructions in \`.flight-rules/commands/\`.`;

  const content = `# ${config.title}

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
| Session Commands | ${commandLocation} |

## For Agents

Please read \`.flight-rules/AGENTS.md\` for complete guidelines on:
- Project structure
- Implementation specs
- Coding sessions
- How to work with this system

${commandInstructions}
`;
  
  const filePath = join(cwd, config.filename);
  writeFileSync(filePath, content, 'utf-8');
}
