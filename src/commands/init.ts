import * as p from '@clack/prompts';
import pc from 'picocolors';
import { 
  isFlightRulesInstalled, 
  fetchPayloadFromGitHub,
  copyPayloadFrom,
  getFlightRulesDir,
  ensureDir,
  writeManifest,
  getCliVersion
} from '../utils/files.js';
import { isInteractive } from '../utils/interactive.js';
import { cpSync, existsSync } from 'fs';
import { join } from 'path';

const DOC_FILES = [
  { src: 'prd.md', dest: 'prd.md' },
  { src: 'progress.md', dest: 'progress.md' },
  { src: 'critical-learnings.md', dest: 'critical-learnings.md' },
  { src: 'implementation/overview.md', dest: 'implementation/overview.md' },
  { src: 'tech-stack.md', dest: 'tech-stack.md' },
];

async function copyDocsFromTemplates(templatesDir: string, docsDir: string, skipExisting: boolean): Promise<void> {
  ensureDir(docsDir);
  ensureDir(join(docsDir, 'implementation'));
  ensureDir(join(docsDir, 'session_logs'));
  
  for (const file of DOC_FILES) {
    const srcPath = join(templatesDir, file.src);
    const destPath = join(docsDir, file.dest);
    
    if (!existsSync(srcPath)) continue;
    
    if (skipExisting && existsSync(destPath)) {
      continue;
    }
    
    cpSync(srcPath, destPath);
  }
}

export async function init() {
  const cwd = process.cwd();
  const interactive = isInteractive();
  
  // Check if already installed
  if (isFlightRulesInstalled(cwd)) {
    if (interactive) {
      const shouldContinue = await p.confirm({
        message: 'Flight Rules is already installed. Do you want to reinstall? (This will overwrite existing files)',
        initialValue: false,
      });
      
      if (p.isCancel(shouldContinue) || !shouldContinue) {
        p.log.info('Installation cancelled.');
        p.outro('Run `flight-rules upgrade` to update framework files while preserving your docs.');
        return;
      }
    } else {
      // Non-interactive: skip reinstall (safe default)
      p.log.info('Flight Rules is already installed. Skipping reinstall.');
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
  } catch (error) {
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
    
    // Write manifest to track deployed version
    writeManifest(cwd, {
      version: fetched.version,
      deployedAt: new Date().toISOString(),
      deployedBy: {
        cli: getCliVersion(),
        command: 'init',
      },
    });
    
    spinner.stop('Flight Rules installed!');
  } catch (error) {
    spinner.stop('Failed to install Flight Rules');
    fetched.cleanup();
    throw error;
  }
  
  fetched.cleanup();
  
  // Ask about initializing docs
  let initDocs: boolean;
  if (interactive) {
    const initDocsResult = await p.confirm({
      message: 'Would you like to initialize project docs from templates?',
      initialValue: true,
    });
    
    if (p.isCancel(initDocsResult)) {
      p.outro('Flight Rules installed. Run `flight-rules adapter` to generate agent adapters.');
      return;
    }
    initDocs = initDocsResult;
  } else {
    // Non-interactive: default to yes (create docs)
    initDocs = true;
  }
  
  if (initDocs) {
    const flightRulesDir = getFlightRulesDir(cwd);
    const templatesDir = join(flightRulesDir, 'doc-templates');
    const docsDir = join(cwd, 'docs');
    
    // Check if docs directory already exists with content
    const docsExist = existsSync(docsDir);
    let skipExisting = false;
    
    if (docsExist) {
      if (interactive) {
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
        } else {
          skipExisting = handleExisting === 'skip';
          await copyDocsFromTemplates(templatesDir, docsDir, skipExisting);
          p.log.success('Project docs initialized from templates.');
        }
      } else {
        // Non-interactive: skip existing files (safe default)
        skipExisting = true;
        await copyDocsFromTemplates(templatesDir, docsDir, skipExisting);
        p.log.success('Project docs initialized from templates (skipped existing files).');
      }
    } else {
      await copyDocsFromTemplates(templatesDir, docsDir, false);
      p.log.success('Project docs initialized from templates.');
    }
  }
  
  // Ask about generating adapters
  if (interactive) {
    const generateAdaptersResult = await p.confirm({
      message: 'Would you like to generate agent adapter files?',
      initialValue: true,
    });
    
    if (p.isCancel(generateAdaptersResult)) {
      p.outro('Done! Your project now has Flight Rules.');
      return;
    }
    
    if (generateAdaptersResult) {
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
      await genAdapters(adapters as string[]);
    }
  } else {
    // Non-interactive: skip adapter generation (user can run `flight-rules adapter` separately)
    p.log.info('Skipping adapter generation. Run `flight-rules adapter --cursor` or `--claude` to generate adapters.');
  }
  
  // Ask about installing .editorconfig
  const editorConfigPath = join(cwd, '.editorconfig');
  const editorConfigExists = existsSync(editorConfigPath);
  
  if (!editorConfigExists) {
    if (interactive) {
      const installEditorConfig = await p.confirm({
        message: 'Would you like to add a standard .editorconfig? (helps prevent formatting diffs)',
        initialValue: true,
      });
      
      if (!p.isCancel(installEditorConfig) && installEditorConfig) {
        const flightRulesDir = getFlightRulesDir(cwd);
        const srcEditorConfig = join(flightRulesDir, '.editorconfig');
        
        if (existsSync(srcEditorConfig)) {
          cpSync(srcEditorConfig, editorConfigPath);
          p.log.success('Added .editorconfig to project root.');
        }
      }
    }
    // Non-interactive: skip .editorconfig installation (safe default)
  }
  
  p.outro(pc.green('Flight Rules is ready! Start with: "start coding session"'));
}
