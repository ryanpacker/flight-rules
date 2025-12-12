import * as p from '@clack/prompts';
import pc from 'picocolors';
import { 
  isFlightRulesInstalled, 
  copyFrameworkFiles,
  getPayloadPath
} from '../utils/files.js';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function upgrade() {
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
  
  // Get version info if available
  try {
    const payloadPath = getPayloadPath();
    const agentsMd = readFileSync(join(payloadPath, 'AGENTS.md'), 'utf-8');
    const versionMatch = agentsMd.match(/flight_rules_version:\s*([\d.]+)/);
    if (versionMatch) {
      p.log.info(`Upgrading to Flight Rules version ${pc.cyan(versionMatch[1])}`);
    }
  } catch {
    // Ignore version detection errors
  }
  
  const shouldContinue = await p.confirm({
    message: 'Proceed with upgrade?',
    initialValue: true,
  });
  
  if (p.isCancel(shouldContinue) || !shouldContinue) {
    p.log.info('Upgrade cancelled.');
    return;
  }
  
  const spinner = p.spinner();
  
  spinner.start('Upgrading Flight Rules...');
  try {
    copyFrameworkFiles(cwd);
    spinner.stop('Flight Rules upgraded!');
  } catch (error) {
    spinner.stop('Failed to upgrade Flight Rules');
    throw error;
  }
  
  p.log.success('Framework files have been updated.');
  p.log.info('Check doc-templates/ for any new templates you might want to use.');
  p.outro(pc.green('Upgrade complete!'));
}

