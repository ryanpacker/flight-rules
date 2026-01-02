import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync, cpSync } from 'fs';
import { join } from 'path';
import { isFlightRulesInstalled, fetchPayloadFromGitHub, copyFrameworkFilesFrom, ensureDir } from '../utils/files.js';
import { isInteractive } from '../utils/interactive.js';
import { isCursorAdapterInstalled, setupCursorCommands } from './adapter.js';
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
function copyNewDocsFromTemplates(templatesDir, docsDir) {
    ensureDir(docsDir);
    ensureDir(join(docsDir, 'implementation'));
    ensureDir(join(docsDir, 'session_logs'));
    const copied = [];
    for (const file of DOC_FILES) {
        const srcPath = join(templatesDir, file.src);
        const destPath = join(docsDir, file.dest);
        if (!existsSync(srcPath))
            continue;
        // Only copy if destination doesn't exist
        if (!existsSync(destPath)) {
            cpSync(srcPath, destPath);
            copied.push(file.dest);
        }
    }
    return copied;
}
export async function upgrade(version) {
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
    const adaptersToUpgrade = [];
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
    p.log.message('  New templates may be added to docs/, but existing files are never modified.');
    console.log();
    const spinner = p.spinner();
    // Fetch from GitHub
    spinner.start(version ? `Fetching Flight Rules ${version} from GitHub...` : 'Fetching latest Flight Rules from GitHub...');
    let fetched;
    try {
        fetched = await fetchPayloadFromGitHub(version);
        spinner.stop(`Found Flight Rules version ${pc.cyan(fetched.version)}`);
    }
    catch (error) {
        spinner.stop('Failed to fetch from GitHub');
        if (error instanceof Error) {
            p.log.error(error.message);
        }
        p.outro('Check your network connection and try again.');
        return;
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
    }
    else {
        // Non-interactive: proceed with upgrade
        p.log.info(`Upgrading to version ${fetched.version}...`);
    }
    // Upgrade .flight-rules/
    spinner.start('Upgrading Flight Rules...');
    try {
        copyFrameworkFilesFrom(fetched.payloadPath, cwd);
        spinner.stop('Flight Rules framework upgraded!');
    }
    catch (error) {
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
            // Upgrade Cursor commands if installed
            if (cursorAdapterInstalled) {
                const result = await setupCursorCommands(cwd, sourceCommandsDir, true); // skipPrompts = true for upgrade
                if (result.copied.length > 0) {
                    p.log.success(`Updated ${result.copied.length} command(s) in .cursor/commands/`);
                }
            }
            // Regenerate adapter files
            const adaptersToRegenerate = [];
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
        }
        catch (error) {
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
async function regenerateAdapterFile(cwd, adapterName, _sourceCommandsDir) {
    // Import the adapter config and content generator
    const { writeFileSync } = await import('fs');
    const { join } = await import('path');
    const ADAPTERS = {
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
    if (!config)
        return;
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
