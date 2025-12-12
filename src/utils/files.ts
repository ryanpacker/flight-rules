import { existsSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the path to the payload directory (the Flight Rules content to install)
 */
export function getPayloadPath(): string {
  // Structure: flight-rules/dist/utils/files.js
  // Go up 2 levels to get to flight-rules/, then into payload/
  const projectRoot = dirname(dirname(__dirname));
  return join(projectRoot, 'payload');
}

/**
 * Check if Flight Rules is already installed in the target directory
 */
export function isFlightRulesInstalled(targetDir: string): boolean {
  return existsSync(join(targetDir, '.flight-rules'));
}

/**
 * Get the .flight-rules directory path in the target
 */
export function getFlightRulesDir(targetDir: string): string {
  return join(targetDir, '.flight-rules');
}

/**
 * Copy the payload to the target directory as .flight-rules
 */
export function copyPayload(targetDir: string): void {
  const payloadPath = getPayloadPath();
  const destPath = getFlightRulesDir(targetDir);
  
  if (!existsSync(payloadPath)) {
    throw new Error(`Payload not found at ${payloadPath}`);
  }
  
  cpSync(payloadPath, destPath, { recursive: true });
}

/**
 * Copy only framework files (not docs/) during upgrade
 */
export function copyFrameworkFiles(targetDir: string): void {
  const payloadPath = getPayloadPath();
  const destPath = getFlightRulesDir(targetDir);
  
  // Files/directories that are safe to replace on upgrade
  const frameworkItems = [
    'AGENTS.md',
    'doc-templates',
    'commands',
    'prompts'
  ];
  
  for (const item of frameworkItems) {
    const srcItem = join(payloadPath, item);
    const destItem = join(destPath, item);
    
    if (existsSync(srcItem)) {
      cpSync(srcItem, destItem, { recursive: true });
    }
  }
}

/**
 * Ensure a directory exists
 */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

