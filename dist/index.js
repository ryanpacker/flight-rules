#!/usr/bin/env node
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { init } from './commands/init.js';
import { upgrade } from './commands/upgrade.js';
import { adapter } from './commands/adapter.js';
const command = process.argv[2];
const args = process.argv.slice(3);
async function main() {
    console.log();
    p.intro(pc.bgCyan(pc.black(' flight-rules ')));
    switch (command) {
        case 'init':
            await init();
            break;
        case 'upgrade':
            await upgrade();
            break;
        case 'adapter':
            await adapter(args);
            break;
        case undefined:
        case '--help':
        case '-h':
            showHelp();
            break;
        case '--version':
        case '-v':
            console.log('flight-rules v0.1.0');
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

${pc.bold('Adapter Options:')}
  --cursor    Generate AGENTS.md for Cursor
  --claude    Generate CLAUDE.md for Claude Code
  --all       Generate all adapters

${pc.bold('Examples:')}
  flight-rules init
  flight-rules upgrade
  flight-rules adapter --cursor --claude
`);
}
main().catch((err) => {
    p.log.error(err.message);
    process.exit(1);
});
