import * as p from '@clack/prompts';
import pc from 'picocolors';
import { isFlightRulesInstalled, fetchPayloadFromGitHub, copyPayloadFrom, getFlightRulesDir, ensureDir } from '../utils/files.js';
import { cpSync, existsSync } from 'fs';
import { join } from 'path';
const DOC_FILES = [
    { src: 'prd.md', dest: 'prd.md' },
    { src: 'progress.md', dest: 'progress.md' },
    { src: 'critical-learnings.md', dest: 'critical-learnings.md' },
    { src: 'implementation/overview.md', dest: 'implementation/overview.md' },
];
async function copyDocsFromTemplates(templatesDir, docsDir, skipExisting) {
    ensureDir(docsDir);
    ensureDir(join(docsDir, 'implementation'));
    ensureDir(join(docsDir, 'session_logs'));
    for (const file of DOC_FILES) {
        const srcPath = join(templatesDir, file.src);
        const destPath = join(docsDir, file.dest);
        if (!existsSync(srcPath))
            continue;
        if (skipExisting && existsSync(destPath)) {
            continue;
        }
        cpSync(srcPath, destPath);
    }
}
export async function init() {
    const cwd = process.cwd();
    // Check if already installed
    if (isFlightRulesInstalled(cwd)) {
        const shouldContinue = await p.confirm({
            message: 'Flight Rules is already installed. Do you want to reinstall? (This will overwrite existing files)',
            initialValue: false,
        });
        if (p.isCancel(shouldContinue) || !shouldContinue) {
            p.log.info('Installation cancelled.');
            p.outro('Run `flight-rules upgrade` to update framework files while preserving your docs.');
            return;
        }
    }
    const spinner = p.spinner();
    // Fetch from GitHub
    spinner.start('Fetching latest Flight Rules from GitHub...');
    let fetched;
    try {
        fetched = await fetchPayloadFromGitHub();
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
    // Copy payload
    spinner.start('Installing Flight Rules...');
    try {
        copyPayloadFrom(fetched.payloadPath, cwd);
        spinner.stop('Flight Rules installed!');
    }
    catch (error) {
        spinner.stop('Failed to install Flight Rules');
        fetched.cleanup();
        throw error;
    }
    fetched.cleanup();
    // Ask about initializing docs
    const initDocs = await p.confirm({
        message: 'Would you like to initialize project docs from templates?',
        initialValue: true,
    });
    if (p.isCancel(initDocs)) {
        p.outro('Flight Rules installed. Run `flight-rules adapter` to generate agent adapters.');
        return;
    }
    if (initDocs) {
        const flightRulesDir = getFlightRulesDir(cwd);
        const templatesDir = join(flightRulesDir, 'doc-templates');
        const docsDir = join(cwd, 'docs');
        // Check if docs directory already exists with content
        const docsExist = existsSync(docsDir);
        let skipExisting = false;
        if (docsExist) {
            const handleExisting = await p.select({
                message: 'A docs/ directory already exists. How would you like to proceed?',
                options: [
                    { value: 'skip', label: 'Skip existing files', hint: 'only create missing files' },
                    { value: 'overwrite', label: 'Overwrite existing files' },
                    { value: 'cancel', label: 'Cancel docs initialization' },
                ],
            });
            if (p.isCancel(handleExisting) || handleExisting === 'cancel') {
                p.log.info('Skipped docs initialization.');
            }
            else {
                skipExisting = handleExisting === 'skip';
                await copyDocsFromTemplates(templatesDir, docsDir, skipExisting);
                p.log.success('Project docs initialized from templates.');
            }
        }
        else {
            await copyDocsFromTemplates(templatesDir, docsDir, false);
            p.log.success('Project docs initialized from templates.');
        }
    }
    // Ask about generating adapters
    const generateAdapters = await p.confirm({
        message: 'Would you like to generate agent adapter files?',
        initialValue: true,
    });
    if (p.isCancel(generateAdapters)) {
        p.outro('Done! Your project now has Flight Rules.');
        return;
    }
    if (generateAdapters) {
        const adapters = await p.multiselect({
            message: 'Which adapters would you like to generate?',
            options: [
                { value: 'cursor', label: 'Cursor (AGENTS.md + .cursor/commands/)', hint: 'recommended' },
                { value: 'claude', label: 'Claude Code (CLAUDE.md)' },
            ],
            initialValues: ['cursor'],
        });
        if (p.isCancel(adapters)) {
            p.outro('Done! Your project now has Flight Rules.');
            return;
        }
        // Import and run adapter generation
        const { generateAdapters: genAdapters } = await import('./adapter.js');
        await genAdapters(adapters);
    }
    p.outro(pc.green('Flight Rules is ready! Start with: "start coding session"'));
}
