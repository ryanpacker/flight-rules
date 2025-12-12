import * as p from '@clack/prompts';
import pc from 'picocolors';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
const ADAPTERS = {
    cursor: {
        name: 'Cursor',
        filename: 'AGENTS.md',
        title: 'Flight Rules – Cursor Adapter',
        description: 'This file is placed at the project root as `AGENTS.md` for Cursor compatibility.',
    },
    claude: {
        name: 'Claude Code',
        filename: 'CLAUDE.md',
        title: 'Flight Rules – Claude Code Adapter',
        description: 'This file is placed at the project root as `CLAUDE.md` for Claude Code compatibility.',
    },
    windsurf: {
        name: 'Windsurf',
        filename: '.windsurfrules',
        title: 'Flight Rules – Windsurf Adapter',
        description: 'This file is placed at the project root as `.windsurfrules` for Windsurf compatibility.',
    },
};
function generateAdapterContent(config) {
    return `# ${config.title}

${config.description}

---

**This project uses Flight Rules.**

All agent guidelines, project documentation, and workflows live in \`.flight-rules/\`.

## Quick Reference

| What | Where |
|------|-------|
| Agent Guidelines | \`.flight-rules/AGENTS.md\` |
| PRD | \`.flight-rules/docs/prd.md\` |
| Implementation Specs | \`.flight-rules/docs/implementation/\` |
| Progress Log | \`.flight-rules/docs/progress.md\` |
| Session Commands | \`.flight-rules/commands/\` |

## For Agents

Please read \`.flight-rules/AGENTS.md\` for complete guidelines on:
- Project structure
- Implementation specs
- Coding sessions
- How to work with this system

When the user says "start coding session" or "end coding session", follow the instructions in \`.flight-rules/commands/\`.
`;
}
export async function adapter(args) {
    const cwd = process.cwd();
    // Parse arguments
    let selectedAdapters = [];
    if (args.includes('--all')) {
        selectedAdapters = Object.keys(ADAPTERS);
    }
    else {
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
                label: `${config.name} (${config.filename})`,
                hint: key === 'cursor' ? 'recommended' : undefined,
            })),
            initialValues: ['cursor'],
        });
        if (p.isCancel(selection)) {
            p.log.info('Cancelled.');
            return;
        }
        selectedAdapters = selection;
    }
    await generateAdapters(selectedAdapters);
}
export async function generateAdapters(adapterNames) {
    const cwd = process.cwd();
    for (const name of adapterNames) {
        const config = ADAPTERS[name];
        if (!config)
            continue;
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
    }
}
