import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync, cpSync, writeFileSync } from 'fs';
import { join } from 'path';
import { 
  isFlightRulesInstalled, 
  fetchPayloadFromGitHub,
  copyFrameworkFilesFrom,
  ensureDir,
  getInstalledVersion,
  writeManifest,
  getCliVersion
} from '../utils/files.js';
import { isInteractive } from '../utils/interactive.js';
import {
  ADAPTERS,
  generateAdapterContent,
  isCodexAdapterInstalled,
  isCursorAdapterInstalled,
  isClaudeAdapterInstalled,
  setupCodexSkills,
  setupCursorCommands,
  setupClaudeCommands,
  setupSkills,
} from './adapter.js';

const DOC_FILES = [
  { src: 'prd.md', dest: 'prd.md' },
  { src: 'progress.md', dest: 'progress.md' },
  { src: 'critical-learnings.md', dest: 'critical-learnings.md' },
  { src: 'implementation/overview.md', dest: 'implementation/overview.md' },
  { src: 'tech-stack.md', dest: 'tech-stack.md' },
];

/**
 * Copy new doc templates to docs/ without overwriting existing files.
 * Returns the list of files that were copied.
 */
function copyNewDocsFromTemplates(templatesDir: string, docsDir: string): string[] {
  ensureDir(docsDir);
  ensureDir(join(docsDir, 'implementation'));
  ensureDir(join(docsDir, 'session_logs'));
  ensureDir(join(docsDir, 'backlog'));
  
  const copied: string[] = [];
  
  for (const file of DOC_FILES) {
    const srcPath = join(templatesDir, file.src);
    const destPath = join(docsDir, file.dest);
    
    if (!existsSync(srcPath)) continue;
    
    // Only copy if destination doesn't exist
    if (!existsSync(destPath)) {
      cpSync(srcPath, destPath);
      copied.push(file.dest);
    }
  }
  
  return copied;
}

export async function upgrade(version?: string) {
  const cwd = process.cwd();
  
  // Check if Flight Rules is installed
  if (!isFlightRulesInstalled(cwd)) {
    p.log.error('Flight Rules is not installed in this directory.');
    p.outro('Run `flight-rules init` to install Flight Rules first.');
    return;
  }
  
  // Get current installed version
  const currentVersion = getInstalledVersion(cwd);
  
  // Detect installed adapters before upgrade
  const codexAdapterInstalled = isCodexAdapterInstalled(cwd);
  const cursorAdapterInstalled = isCursorAdapterInstalled(cwd);
  const claudeAdapterInstalled = isClaudeAdapterInstalled(cwd);
  const agentsMdExists = existsSync(join(cwd, 'AGENTS.md'));
  const claudeMdExists = existsSync(join(cwd, 'CLAUDE.md'));
  
  // Show what will be upgraded
  p.log.info(`${pc.bold('The .flight-rules/ directory will be upgraded.')}`);
  p.log.message('  Framework files (AGENTS.md, doc-templates/, commands/, prompts/, skills/) will be replaced.');
  console.log();
  
  // Show adapter upgrade info
  const adaptersToUpgrade: string[] = [];
  if (codexAdapterInstalled) {
    adaptersToUpgrade.push('Codex (.agents/skills/)');
  }
  if (cursorAdapterInstalled) {
    adaptersToUpgrade.push('Cursor (.cursor/commands/)');
  }
  if (claudeAdapterInstalled) {
    adaptersToUpgrade.push('Claude Code (.claude/commands/)');
  } else if (claudeMdExists) {
    // CLAUDE.md exists but .claude/commands/ doesn't - will be created on upgrade
    adaptersToUpgrade.push('Claude Code (.claude/commands/ will be created)');
  }
  if (agentsMdExists) {
    adaptersToUpgrade.push('AGENTS.md');
  }
  if (claudeMdExists && !adaptersToUpgrade.some(a => a.includes('Claude Code'))) {
    adaptersToUpgrade.push('CLAUDE.md');
  }
  
  if (adaptersToUpgrade.length > 0) {
    p.log.info(`${pc.bold('Installed adapters will also be upgraded:')}`);
    p.log.message(`  ${adaptersToUpgrade.join(', ')}`);
    console.log();
  }
  
  p.log.info(`${pc.bold('Your project content will be preserved.')}`);
  p.log.message('  New templates may be added to docs/, but existing files are never modified.');
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
  
  // Show version comparison
  if (currentVersion) {
    p.log.info(`Current version: ${pc.yellow(currentVersion)} → ${pc.cyan(fetched.version)}`);
  }
  
  if (isInteractive()) {
    const shouldContinue = await p.confirm({
      message: `Upgrade to version ${fetched.version}?`,
      initialValue: true,
    });
    
    if (p.isCancel(shouldContinue) || !shouldContinue) {
      fetched.cleanup();
      p.log.info('Upgrade cancelled.');
      return;
    }
  } else {
    // Non-interactive: proceed with upgrade
    p.log.info(`Upgrading to version ${fetched.version}...`);
  }
  
  // Upgrade .flight-rules/
  spinner.start('Upgrading Flight Rules...');
  try {
    copyFrameworkFilesFrom(fetched.payloadPath, cwd);
    
    // Write manifest to track deployed version
    writeManifest(cwd, {
      version: fetched.version,
      deployedAt: new Date().toISOString(),
      deployedBy: {
        cli: getCliVersion(),
        command: 'upgrade',
      },
    });
    
    spinner.stop('Flight Rules framework upgraded!');
  } catch (error) {
    spinner.stop('Failed to upgrade Flight Rules');
    fetched.cleanup();
    throw error;
  }
  
  p.log.success('Framework files have been updated.');
  
  // Add new doc templates to docs/ (without overwriting existing files)
  const templatesDir = join(fetched.payloadPath, 'doc-templates');
  const docsDir = join(cwd, 'docs');
  const newDocs = copyNewDocsFromTemplates(templatesDir, docsDir);
  
  if (newDocs.length > 0) {
    p.log.success(`Added ${newDocs.length} new template(s) to docs/: ${newDocs.join(', ')}`);
  }
  
  // Upgrade installed adapters
  if (adaptersToUpgrade.length > 0) {
    spinner.start('Upgrading adapters...');
    
    try {
      const sourceCommandsDir = join(fetched.payloadPath, 'commands');
      const sourceSkillsDir = join(fetched.payloadPath, 'skills');
      const sourceCodexSkillsDir = join(fetched.payloadPath, 'skills', 'codex');

      if (codexAdapterInstalled) {
        const result = await setupCodexSkills(cwd, sourceCodexSkillsDir, true);
        if (result.copied.length > 0) {
          p.log.success(`Updated ${result.copied.length} skill(s) in .agents/skills/`);
        }
      }

      // Upgrade Cursor commands and skills if installed
      if (cursorAdapterInstalled) {
        const result = await setupCursorCommands(cwd, sourceCommandsDir, true); // skipPrompts = true for upgrade
        if (result.copied.length > 0) {
          p.log.success(`Updated ${result.copied.length} command(s) in .cursor/commands/`);
        }

        if (existsSync(sourceSkillsDir)) {
          const skillResult = await setupSkills(cwd, sourceSkillsDir, '.cursor/skills', true);
          if (skillResult.copied.length > 0) {
            p.log.success(`Updated ${skillResult.copied.length} skill(s) in .cursor/skills/`);
          }
        }
      }

      // Upgrade Claude commands and skills if installed
      if (claudeAdapterInstalled || claudeMdExists) {
        const result = await setupClaudeCommands(cwd, sourceCommandsDir, true); // skipPrompts = true for upgrade
        if (result.copied.length > 0) {
          const action = claudeAdapterInstalled ? 'Updated' : 'Created';
          p.log.success(`${action} ${result.copied.length} command(s) in .claude/commands/`);
        }

        if (existsSync(sourceSkillsDir)) {
          const skillResult = await setupSkills(cwd, sourceSkillsDir, '.claude/skills', true);
          if (skillResult.copied.length > 0) {
            const action = claudeAdapterInstalled ? 'Updated' : 'Created';
            p.log.success(`${action} ${skillResult.copied.length} skill(s) in .claude/skills/`);
          }
        }
      }
      
      // Regenerate adapter files
      const adapterFilesToRegenerate = new Set<'AGENTS.md' | 'CLAUDE.md'>();
      if (agentsMdExists) {
        adapterFilesToRegenerate.add('AGENTS.md');
      }
      if (claudeMdExists) {
        adapterFilesToRegenerate.add('CLAUDE.md');
      }
      
      if (adapterFilesToRegenerate.size > 0) {
        for (const filename of adapterFilesToRegenerate) {
          regenerateAdapterFile(cwd, filename);
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
  
  p.outro(pc.green('Upgrade complete!'));
}

/**
 * Regenerate a single adapter file during upgrade (no prompts, just overwrite)
 */
function regenerateAdapterFile(cwd: string, filename: 'AGENTS.md' | 'CLAUDE.md'): void {
  const config = filename === 'AGENTS.md' ? ADAPTERS.codex : ADAPTERS.claude;
  const content = generateAdapterContent(config);
  const filePath = join(cwd, filename);
  writeFileSync(filePath, content, 'utf-8');
}
