#!/usr/bin/env node

import * as p from '@clack/prompts';
import pc from 'picocolors';
import { init } from './commands/init.js';
import { upgrade } from './commands/upgrade.js';
import { adapter } from './commands/adapter.js';
import { update } from './commands/update.js';
import { getCliVersion } from './utils/files.js';
import { checkForUpdate, shouldSkipUpdateCheck } from './utils/version-check.js';
import { isInteractive } from './utils/interactive.js';

const command = process.argv[2];
const args = process.argv.slice(3);

/**
 * Parse --version flag from args, returning the version value if present
 */
function parseVersionArg(args: string[]): string | undefined {
  const versionIndex = args.findIndex(arg => arg === '--version' || arg === '-V');
  if (versionIndex !== -1 && args[versionIndex + 1]) {
    return args[versionIndex + 1];
  }
  // Also support --version=0.1.4 format
  const versionArg = args.find(arg => arg.startsWith('--version='));
  if (versionArg) {
    return versionArg.split('=')[1];
  }
  return undefined;
}

async function main() {
  // Handle --version early, without intro banner
  if (command === '--version' || command === '-v') {
    console.log(getCliVersion());
    return;
  }

  console.log();
  p.intro(pc.bgCyan(pc.black(' flight-rules ')));

  switch (command) {
    case 'init':
      await init();
      break;
    case 'upgrade':
      const version = parseVersionArg(args);
      await upgrade(version);
      break;
    case 'adapter':
      await adapter(args);
      break;
    case 'update':
      await update(args);
      break;
    case undefined:
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      p.log.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }

  // Show update notification after command completes (uses cache, non-blocking)
  await showUpdateNotification();
}

function showHelp() {
  console.log(`
${pc.bold('Usage:')} flight-rules <command> [options]

${pc.bold('Commands:')}
  init        Install Flight Rules into the current project
  upgrade     Upgrade Flight Rules (preserves your docs)
  adapter     Generate agent-specific adapter files
  update      Update the Flight Rules CLI itself

${pc.bold('Upgrade Options:')}
  --version <version>   Upgrade to a specific version (e.g., 0.1.4)
                        Defaults to latest from main branch

${pc.bold('Update Options:')}
  --channel <channel>   Switch release channel (dev or latest)
                        Defaults to current channel

${pc.bold('Adapter Options:')}
  --cursor    Generate AGENTS.md for Cursor
  --claude    Generate CLAUDE.md for Claude Code
  --all       Generate all adapters

${pc.bold('Examples:')}
  flight-rules init
  flight-rules upgrade
  flight-rules upgrade --version 0.1.4
  flight-rules update
  flight-rules update --channel=latest
  flight-rules adapter --cursor --claude
`);
}

/**
 * Show update notification if a newer version is available.
 * Uses cached check result to avoid slowing down commands.
 * Only shows in interactive (TTY) mode.
 */
async function showUpdateNotification(): Promise<void> {
  // Skip in non-interactive mode or if disabled
  if (!isInteractive() || shouldSkipUpdateCheck()) {
    return;
  }

  // Skip for commands that handle their own version checking
  if (command === 'update' || command === '--version' || command === '-v') {
    return;
  }

  try {
    const result = await checkForUpdate(); // Uses cache, won't slow down
    if (result?.updateAvailable) {
      console.log();
      p.log.message(
        pc.yellow(`Update available: ${result.currentVersion} → ${result.latestVersion}`) +
        pc.dim(` Run 'flight-rules update' to upgrade.`)
      );
    }
  } catch {
    // Silent failure - don't disrupt the user's workflow
  }
}

main().catch((err) => {
  p.log.error(err.message);
  process.exit(1);
});
