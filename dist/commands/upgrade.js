import * as p from '@clack/prompts';
import pc from 'picocolors';
import { isFlightRulesInstalled, fetchPayloadFromGitHub, copyFrameworkFilesFrom } from '../utils/files.js';
export async function upgrade(version) {
    const cwd = process.cwd();
    // Check if Flight Rules is installed
    if (!isFlightRulesInstalled(cwd)) {
        p.log.error('Flight Rules is not installed in this directory.');
        p.outro('Run `flight-rules init` to install Flight Rules first.');
        return;
    }
    // Show what will be upgraded
    p.log.info(`${pc.bold('The following will be replaced:')}`);
    p.log.message('  • AGENTS.md');
    p.log.message('  • doc-templates/');
    p.log.message('  • commands/');
    p.log.message('  • prompts/');
    console.log();
    p.log.info(`${pc.bold('The following will be preserved:')}`);
    p.log.message('  • docs/ (your project content)');
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
    const shouldContinue = await p.confirm({
        message: `Upgrade to version ${fetched.version}?`,
        initialValue: true,
    });
    if (p.isCancel(shouldContinue) || !shouldContinue) {
        fetched.cleanup();
        p.log.info('Upgrade cancelled.');
        return;
    }
    spinner.start('Upgrading Flight Rules...');
    try {
        copyFrameworkFilesFrom(fetched.payloadPath, cwd);
        spinner.stop('Flight Rules upgraded!');
    }
    catch (error) {
        spinner.stop('Failed to upgrade Flight Rules');
        fetched.cleanup();
        throw error;
    }
    fetched.cleanup();
    p.log.success('Framework files have been updated.');
    p.log.info('Check doc-templates/ for any new templates you might want to use.');
    p.outro(pc.green('Upgrade complete!'));
}
