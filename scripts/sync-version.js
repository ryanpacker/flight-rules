#!/usr/bin/env node

/**
 * Syncs the version from package.json to payload/AGENTS.md
 * 
 * This script is run automatically by `npm version` via the "version" script
 * in package.json. It ensures the flight_rules_version in AGENTS.md always
 * matches the package version.
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
const version = packageJson.version;

// Update payload/AGENTS.md
const agentsPath = join(rootDir, 'payload', 'AGENTS.md');
let agentsContent = readFileSync(agentsPath, 'utf-8');

// Replace the flight_rules_version line
const versionRegex = /^flight_rules_version:\s*.+$/m;
if (versionRegex.test(agentsContent)) {
  agentsContent = agentsContent.replace(versionRegex, `flight_rules_version: ${version}`);
} else {
  console.error('Could not find flight_rules_version line in payload/AGENTS.md');
  process.exit(1);
}

writeFileSync(agentsPath, agentsContent, 'utf-8');

console.log(`✓ Synced version ${version} to payload/AGENTS.md`);

