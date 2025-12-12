import * as p from '@clack/prompts';
import pc from 'picocolors';
import { 
  isFlightRulesInstalled, 
  copyPayload, 
  getFlightRulesDir,
  ensureDir 
} from '../utils/files.js';
import { cpSync, existsSync } from 'fs';
import { join } from 'path';

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
  
  // Copy payload
  spinner.start('Installing Flight Rules...');
  try {
    copyPayload(cwd);
    spinner.stop('Flight Rules installed!');
  } catch (error) {
    spinner.stop('Failed to install Flight Rules');
    throw error;
  }
  
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
    const docsDir = join(flightRulesDir, 'docs');
    
    // Copy templates to docs
    const filesToCopy = [
      { src: 'prd.md', dest: 'prd.md' },
      { src: 'progress.md', dest: 'progress.md' },
      { src: 'critical-learnings.md', dest: 'critical-learnings.md' },
      { src: 'implementation/overview.md', dest: 'implementation/overview.md' },
    ];
    
    for (const file of filesToCopy) {
      const srcPath = join(templatesDir, file.src);
      const destPath = join(docsDir, file.dest);
      
      if (existsSync(srcPath)) {
        ensureDir(join(docsDir, 'implementation'));
        cpSync(srcPath, destPath);
      }
    }
    
    p.log.success('Project docs initialized from templates.');
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
        { value: 'cursor', label: 'Cursor (AGENTS.md)', hint: 'recommended' },
        { value: 'claude', label: 'Claude Code (CLAUDE.md)' },
        { value: 'windsurf', label: 'Windsurf (.windsurfrules)' },
      ],
      initialValues: ['cursor'],
    });
    
    if (p.isCancel(adapters)) {
      p.outro('Done! Your project now has Flight Rules.');
      return;
    }
    
    // Import and run adapter generation
    const { generateAdapters: genAdapters } = await import('./adapter.js');
    await genAdapters(adapters as string[]);
  }
  
  p.outro(pc.green('Flight Rules is ready! Start with: "start coding session"'));
}

