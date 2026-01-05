/**
 * Tests for upgrade.ts command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  log: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
  outro: vi.fn(),
  isCancel: vi.fn((value) => value === Symbol.for('cancel')),
}));

// Mock picocolors
vi.mock('picocolors', () => ({
  default: {
    cyan: vi.fn((str) => str),
    green: vi.fn((str) => str),
    bold: vi.fn((str) => str),
    yellow: vi.fn((str) => str),
  },
}));

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    cpSync: vi.fn(),
  };
});

// Mock utils/files.js
vi.mock('../../src/utils/files.js', () => ({
  isFlightRulesInstalled: vi.fn(),
  fetchPayloadFromGitHub: vi.fn(),
  copyFrameworkFilesFrom: vi.fn(),
  ensureDir: vi.fn(),
  getInstalledVersion: vi.fn(),
  writeManifest: vi.fn(),
  getCliVersion: vi.fn(() => '0.4.4'),
}));

// Mock adapter.js
vi.mock('../../src/commands/adapter.js', () => ({
  isCursorAdapterInstalled: vi.fn(),
  setupCursorCommands: vi.fn(),
}));

// Mock interactive utility
vi.mock('../../src/utils/interactive.js', () => ({
  isInteractive: vi.fn(() => true), // Default to interactive
}));

import * as p from '@clack/prompts';
import { existsSync, writeFileSync, cpSync } from 'fs';
import { 
  isFlightRulesInstalled, 
  fetchPayloadFromGitHub, 
  copyFrameworkFilesFrom,
  ensureDir,
  getInstalledVersion,
  writeManifest,
  getCliVersion,
} from '../../src/utils/files.js';
import { isInteractive } from '../../src/utils/interactive.js';
import { isCursorAdapterInstalled, setupCursorCommands } from '../../src/commands/adapter.js';
import { upgrade } from '../../src/commands/upgrade.js';

describe('upgrade.ts', () => {
  const mockCwd = '/mock/project';
  const mockPayloadPath = '/tmp/flight-rules-123/payload';
  const mockCleanup = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
    
    // Default: Flight Rules is installed
    vi.mocked(isFlightRulesInstalled).mockReturnValue(true);
    
    // Default: no adapters installed
    vi.mocked(isCursorAdapterInstalled).mockReturnValue(false);
    vi.mocked(existsSync).mockReturnValue(false);
    
    // Default: successful fetch
    vi.mocked(fetchPayloadFromGitHub).mockResolvedValue({
      payloadPath: mockPayloadPath,
      version: '0.4.0',
      cleanup: mockCleanup,
    });
    
    // Default: user confirms upgrade
    vi.mocked(p.confirm).mockResolvedValue(true);
    
    // Default: isCancel returns false
    vi.mocked(p.isCancel).mockReturnValue(false);
    
    // Default: setup commands succeeds
    vi.mocked(setupCursorCommands).mockResolvedValue({ copied: [], skipped: [] });
    
    // Default: copyFrameworkFilesFrom succeeds
    vi.mocked(copyFrameworkFilesFrom).mockImplementation(() => {});
    
    // Default: no existing version (new installation)
    vi.mocked(getInstalledVersion).mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when Flight Rules is not installed', () => {
    it('should show error and exit', async () => {
      vi.mocked(isFlightRulesInstalled).mockReturnValue(false);
      
      await upgrade();
      
      expect(p.log.error).toHaveBeenCalledWith('Flight Rules is not installed in this directory.');
      expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('init'));
      expect(fetchPayloadFromGitHub).not.toHaveBeenCalled();
    });
  });

  describe('adapter detection', () => {
    it('should detect Cursor adapter when .cursor/commands exists', async () => {
      vi.mocked(isCursorAdapterInstalled).mockReturnValue(true);
      
      await upgrade();
      
      expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('Installed adapters'));
    });

    it('should detect AGENTS.md', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).includes('AGENTS.md');
      });
      
      await upgrade();
      
      expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('Installed adapters'));
    });

    it('should detect CLAUDE.md', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).includes('CLAUDE.md');
      });
      
      await upgrade();
      
      expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('Installed adapters'));
    });
  });

  describe('fetching from GitHub', () => {
    it('should fetch latest version by default', async () => {
      await upgrade();
      
      expect(fetchPayloadFromGitHub).toHaveBeenCalledWith(undefined);
    });

    it('should fetch specific version when provided', async () => {
      await upgrade('0.3.0');
      
      expect(fetchPayloadFromGitHub).toHaveBeenCalledWith('0.3.0');
    });

    it('should handle fetch failure gracefully', async () => {
      vi.mocked(fetchPayloadFromGitHub).mockRejectedValue(new Error('Network error'));
      
      await upgrade();
      
      expect(p.log.error).toHaveBeenCalledWith('Network error');
      expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('network connection'));
    });
  });

  describe('user confirmation', () => {
    it('should prompt for upgrade confirmation', async () => {
      await upgrade();
      
      expect(p.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Upgrade to version'),
        })
      );
    });

    it('should cancel if user declines', async () => {
      vi.mocked(p.confirm).mockResolvedValue(false);
      
      await upgrade();
      
      expect(p.log.info).toHaveBeenCalledWith('Upgrade cancelled.');
      expect(copyFrameworkFilesFrom).not.toHaveBeenCalled();
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should cancel if user cancels prompt', async () => {
      vi.mocked(p.confirm).mockResolvedValue(Symbol.for('cancel'));
      vi.mocked(p.isCancel).mockImplementation((value) => value === Symbol.for('cancel'));
      
      await upgrade();
      
      expect(p.log.info).toHaveBeenCalledWith('Upgrade cancelled.');
      expect(mockCleanup).toHaveBeenCalled();
    });
  });

  describe('framework upgrade', () => {
    it('should copy framework files when user confirms', async () => {
      await upgrade();
      
      expect(copyFrameworkFilesFrom).toHaveBeenCalledWith(mockPayloadPath, mockCwd);
    });

    it('should show success message', async () => {
      await upgrade();
      
      expect(p.log.success).toHaveBeenCalledWith('Framework files have been updated.');
    });

    it('should cleanup and rethrow on copy failure', async () => {
      vi.mocked(copyFrameworkFilesFrom).mockImplementationOnce(() => {
        throw new Error('Copy failed');
      });
      
      await expect(upgrade()).rejects.toThrow('Copy failed');
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should write manifest after upgrading', async () => {
      await upgrade();
      
      expect(writeManifest).toHaveBeenCalledWith(mockCwd, expect.objectContaining({
        version: '0.4.0',
        deployedBy: expect.objectContaining({
          cli: '0.4.4',
          command: 'upgrade',
        }),
      }));
    });

    it('should include deployedAt timestamp in manifest', async () => {
      await upgrade();
      
      expect(writeManifest).toHaveBeenCalledWith(mockCwd, expect.objectContaining({
        deployedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      }));
    });
  });

  describe('version comparison', () => {
    it('should show current version when manifest exists', async () => {
      vi.mocked(getInstalledVersion).mockReturnValue('0.3.0');
      
      await upgrade();
      
      expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('0.3.0'));
      expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('0.4.0'));
    });

    it('should not show version comparison when no manifest exists', async () => {
      vi.mocked(getInstalledVersion).mockReturnValue(null);
      
      await upgrade();
      
      // Should not have a version comparison message (only other info messages)
      const infoCalls = vi.mocked(p.log.info).mock.calls;
      const versionComparisonCalls = infoCalls.filter(call => 
        String(call[0]).includes('→')
      );
      expect(versionComparisonCalls.length).toBe(0);
    });
  });

  describe('adapter upgrades', () => {
    it('should upgrade Cursor commands when installed', async () => {
      vi.mocked(isCursorAdapterInstalled).mockReturnValue(true);
      vi.mocked(setupCursorCommands).mockResolvedValue({ 
        copied: ['dev-session.start.md'], 
        skipped: [] 
      });
      
      await upgrade();
      
      expect(setupCursorCommands).toHaveBeenCalledWith(
        mockCwd,
        join(mockPayloadPath, 'commands'),
        true // skipPrompts
      );
      expect(p.log.success).toHaveBeenCalledWith(expect.stringContaining('Updated 1 command'));
    });

    it('should regenerate AGENTS.md when it exists', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).includes('AGENTS.md');
      });
      
      await upgrade();
      
      expect(writeFileSync).toHaveBeenCalledWith(
        join(mockCwd, 'AGENTS.md'),
        expect.stringContaining('Flight Rules – Cursor Adapter'),
        'utf-8'
      );
    });

    it('should regenerate CLAUDE.md when it exists', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).includes('CLAUDE.md');
      });
      
      await upgrade();
      
      expect(writeFileSync).toHaveBeenCalledWith(
        join(mockCwd, 'CLAUDE.md'),
        expect.stringContaining('Flight Rules – Claude Code Adapter'),
        'utf-8'
      );
    });

    it('should regenerate both adapters when both exist', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        return pathStr.includes('AGENTS.md') || pathStr.includes('CLAUDE.md');
      });
      
      await upgrade();
      
      expect(writeFileSync).toHaveBeenCalledTimes(2);
    });

    it('should cleanup and rethrow on adapter upgrade failure', async () => {
      vi.mocked(isCursorAdapterInstalled).mockReturnValue(true);
      vi.mocked(setupCursorCommands).mockRejectedValue(new Error('Command copy failed'));
      
      await expect(upgrade()).rejects.toThrow('Command copy failed');
      expect(mockCleanup).toHaveBeenCalled();
    });
  });

  describe('completion', () => {
    it('should cleanup temp files', async () => {
      await upgrade();
      
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should show completion message', async () => {
      await upgrade();
      
      expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('Upgrade complete'));
    });
  });

  describe('new doc templates', () => {
    it('should create docs directories', async () => {
      await upgrade();
      
      expect(ensureDir).toHaveBeenCalledWith(join(mockCwd, 'docs'));
      expect(ensureDir).toHaveBeenCalledWith(join(mockCwd, 'docs', 'implementation'));
      expect(ensureDir).toHaveBeenCalledWith(join(mockCwd, 'docs', 'session_logs'));
    });

    it('should copy new templates when they do not exist in docs/', async () => {
      // Template exists in payload, but not in docs/
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        // Templates exist
        if (pathStr.includes('/doc-templates/')) return true;
        // Target docs do not exist
        if (pathStr.includes('/docs/')) return false;
        return false;
      });
      
      await upgrade();
      
      // Should copy templates
      expect(cpSync).toHaveBeenCalled();
      expect(p.log.success).toHaveBeenCalledWith(expect.stringContaining('new template'));
    });

    it('should NOT overwrite existing doc files', async () => {
      // Both template and docs exist
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('/doc-templates/prd.md')) return true;
        if (pathStr.includes('/docs/prd.md')) return true;
        return false;
      });
      
      await upgrade();
      
      // cpSync should NOT be called for prd.md since it already exists
      const cpSyncCalls = vi.mocked(cpSync).mock.calls;
      const prdCopied = cpSyncCalls.some(call => 
        String(call[1]).includes('prd.md')
      );
      expect(prdCopied).toBe(false);
    });

    it('should only log when new templates were actually added', async () => {
      // All docs already exist - no new templates added
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('/doc-templates/')) return true;
        if (pathStr.includes('/docs/')) return true;
        return false;
      });
      
      await upgrade();
      
      // Should NOT show "Added X new template(s)" message
      const successCalls = vi.mocked(p.log.success).mock.calls;
      const newTemplateMessage = successCalls.some(call => 
        String(call[0]).includes('new template')
      );
      expect(newTemplateMessage).toBe(false);
    });
  });

  describe('non-interactive mode', () => {
    beforeEach(() => {
      vi.mocked(isInteractive).mockReturnValue(false);
    });

    afterEach(() => {
      vi.mocked(isInteractive).mockReturnValue(true);
    });

    it('should proceed with upgrade without confirmation prompt', async () => {
      await upgrade();
      
      // Should not prompt for confirmation
      expect(p.confirm).not.toHaveBeenCalled();
      // Should log that upgrade is proceeding
      expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('Upgrading to version'));
      // Should complete the upgrade
      expect(copyFrameworkFilesFrom).toHaveBeenCalled();
    });

    it('should complete full upgrade flow without prompts', async () => {
      vi.mocked(isCursorAdapterInstalled).mockReturnValue(true);
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).includes('AGENTS.md');
      });
      vi.mocked(setupCursorCommands).mockResolvedValue({ copied: ['test.md'], skipped: [] });
      
      await upgrade();
      
      expect(p.confirm).not.toHaveBeenCalled();
      expect(copyFrameworkFilesFrom).toHaveBeenCalled();
      expect(setupCursorCommands).toHaveBeenCalled();
      expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('Upgrade complete'));
    });
  });
});

