#!/usr/bin/env node

import * as p from '@clack/prompts';
import pc from 'picocolors';
import { init } from './commands/init.js';
import { upgrade } from './commands/upgrade.js';
import { adapter } from './commands/adapter.js';
import { getCliVersion } from './utils/files.js';

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
}

function showHelp() {
  console.log(`
${pc.bold('Usage:')} flight-rules <command> [options]

${pc.bold('Commands:')}
  init        Install Flight Rules into the current project
  upgrade     Upgrade Flight Rules (preserves your docs)
  adapter     Generate agent-specific adapter files

${pc.bold('Upgrade Options:')}
  --version <version>   Upgrade to a specific version (e.g., 0.1.4)
                        Defaults to latest from main branch

${pc.bold('Adapter Options:')}
  --cursor    Generate AGENTS.md for Cursor
  --claude    Generate CLAUDE.md for Claude Code
  --all       Generate all adapters

${pc.bold('Examples:')}
  flight-rules init
  flight-rules upgrade
  flight-rules upgrade --version 0.1.4
  flight-rules adapter --cursor --claude
`);
}

main().catch((err) => {
  p.log.error(err.message);
  process.exit(1);
});
