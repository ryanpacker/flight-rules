/**
 * Tests for init.ts command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
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
  },
}));

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    cpSync: vi.fn(),
  };
});

// Mock utils/files.js
vi.mock('../../src/utils/files.js', () => ({
  isFlightRulesInstalled: vi.fn(),
  fetchPayloadFromGitHub: vi.fn(),
  copyPayloadFrom: vi.fn(),
  getFlightRulesDir: vi.fn((cwd: string) => join(cwd, '.flight-rules')),
  ensureDir: vi.fn(),
  writeManifest: vi.fn(),
  getCliVersion: vi.fn(() => '0.4.4'),
}));

// Mock adapter.js - use dynamic import pattern
vi.mock('../../src/commands/adapter.js', () => ({
  generateAdapters: vi.fn(),
}));

// Mock interactive utility
vi.mock('../../src/utils/interactive.js', () => ({
  isInteractive: vi.fn(() => true), // Default to interactive
}));

import * as p from '@clack/prompts';
import { existsSync, cpSync } from 'fs';
import { 
  isFlightRulesInstalled, 
  fetchPayloadFromGitHub, 
  copyPayloadFrom,
  ensureDir,
  writeManifest,
  getCliVersion,
} from '../../src/utils/files.js';
import { isInteractive } from '../../src/utils/interactive.js';
import { init } from '../../src/commands/init.js';

describe('init.ts', () => {
  const mockCwd = '/mock/project';
  const mockPayloadPath = '/tmp/flight-rules-123/payload';
  const mockCleanup = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
    
    // Default: Flight Rules not installed
    vi.mocked(isFlightRulesInstalled).mockReturnValue(false);
    
    // Default: successful fetch
    vi.mocked(fetchPayloadFromGitHub).mockResolvedValue({
      payloadPath: mockPayloadPath,
      version: '0.3.2',
      cleanup: mockCleanup,
    });
    
    // Default: copyPayloadFrom succeeds
    vi.mocked(copyPayloadFrom).mockImplementation(() => {});
    
    // Default: existsSync returns false
    vi.mocked(existsSync).mockReturnValue(false);
    
    // Default: isCancel returns false
    vi.mocked(p.isCancel).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when Flight Rules is already installed', () => {
    beforeEach(() => {
      vi.mocked(isFlightRulesInstalled).mockReturnValue(true);
    });

    it('should prompt for reinstall confirmation', async () => {
      vi.mocked(p.confirm).mockResolvedValueOnce(false);
      
      await init();
      
      expect(p.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('already installed'),
        })
      );
    });

    it('should cancel if user declines reinstall', async () => {
      vi.mocked(p.confirm).mockResolvedValueOnce(false);
      
      await init();
      
      expect(p.log.info).toHaveBeenCalledWith('Installation cancelled.');
      expect(fetchPayloadFromGitHub).not.toHaveBeenCalled();
    });

    it('should cancel if user cancels prompt', async () => {
      vi.mocked(p.confirm).mockResolvedValueOnce(Symbol.for('cancel'));
      vi.mocked(p.isCancel).mockReturnValueOnce(true);
      
      await init();
      
      expect(p.log.info).toHaveBeenCalledWith('Installation cancelled.');
    });

    it('should continue with reinstall if user confirms', async () => {
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(true)  // reinstall
        .mockResolvedValueOnce(false) // init docs
        .mockResolvedValueOnce(false); // generate adapters
      
      await init();
      
      expect(fetchPayloadFromGitHub).toHaveBeenCalled();
      expect(copyPayloadFrom).toHaveBeenCalled();
    });
  });

  describe('fresh installation', () => {
    it('should fetch payload from GitHub', async () => {
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(false) // init docs
        .mockResolvedValueOnce(false); // generate adapters
      
      await init();
      
      expect(fetchPayloadFromGitHub).toHaveBeenCalled();
    });

    it('should copy payload to project', async () => {
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);
      
      await init();
      
      expect(copyPayloadFrom).toHaveBeenCalledWith(mockPayloadPath, mockCwd);
    });

    it('should write manifest after copying payload', async () => {
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);
      
      await init();
      
      expect(writeManifest).toHaveBeenCalledWith(mockCwd, expect.objectContaining({
        version: '0.3.2',
        deployedBy: expect.objectContaining({
          cli: '0.4.4',
          command: 'init',
        }),
      }));
    });

    it('should include deployedAt timestamp in manifest', async () => {
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);
      
      await init();
      
      expect(writeManifest).toHaveBeenCalledWith(mockCwd, expect.objectContaining({
        deployedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      }));
    });

    it('should cleanup after successful install', async () => {
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);
      
      await init();
      
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should handle fetch failure gracefully', async () => {
      vi.mocked(fetchPayloadFromGitHub).mockRejectedValue(new Error('Network error'));
      
      await init();
      
      expect(p.log.error).toHaveBeenCalledWith('Network error');
      expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('network connection'));
    });

    it('should cleanup and rethrow on copy failure', async () => {
      vi.mocked(copyPayloadFrom).mockImplementationOnce(() => {
        throw new Error('Copy failed');
      });
      
      await expect(init()).rejects.toThrow('Copy failed');
      expect(mockCleanup).toHaveBeenCalled();
    });
  });

  describe('docs initialization', () => {

    it('should prompt for docs initialization', async () => {
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(true)  // init docs
        .mockResolvedValueOnce(false); // generate adapters
      
      await init();
      
      expect(p.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('initialize project docs'),
        })
      );
    });

    it('should create docs directories when confirmed', async () => {
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(true)  // init docs
        .mockResolvedValueOnce(false); // generate adapters
      
      await init();
      
      expect(ensureDir).toHaveBeenCalledWith(join(mockCwd, 'docs'));
      expect(ensureDir).toHaveBeenCalledWith(join(mockCwd, 'docs/implementation'));
      expect(ensureDir).toHaveBeenCalledWith(join(mockCwd, 'docs/session_logs'));
    });

    it('should copy all doc template files including tech-stack.md', async () => {
      // Template files exist in payload
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('doc-templates')) return true;
        return false;
      });
      
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(true)  // init docs
        .mockResolvedValueOnce(false); // generate adapters
      
      await init();
      
      // Verify tech-stack.md is among the files copied
      expect(cpSync).toHaveBeenCalledWith(
        join(mockCwd, '.flight-rules/doc-templates/tech-stack.md'),
        join(mockCwd, 'docs/tech-stack.md')
      );
    });

    it('should skip docs initialization if user declines', async () => {
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(false) // init docs
        .mockResolvedValueOnce(false); // generate adapters
      
      await init();
      
      // ensureDir should not be called for docs
      expect(ensureDir).not.toHaveBeenCalledWith(expect.stringContaining('docs'));
    });

    it('should handle cancelled docs prompt', async () => {
      vi.mocked(p.confirm).mockResolvedValueOnce(Symbol.for('cancel'));
      vi.mocked(p.isCancel).mockReturnValueOnce(true);
      
      await init();
      
      expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('adapter'));
    });

    describe('when docs directory exists', () => {
      beforeEach(() => {
        vi.mocked(existsSync).mockImplementation((path) => {
          const pathStr = String(path);
          // docs dir exists, template files exist
          if (pathStr.includes('docs') && !pathStr.includes('.flight-rules')) return true;
          if (pathStr.includes('doc-templates')) return true;
          return false;
        });
      });

      it('should prompt for conflict handling', async () => {
        vi.mocked(p.confirm).mockResolvedValueOnce(true); // init docs
        vi.mocked(p.select).mockResolvedValueOnce('skip');
        vi.mocked(p.confirm).mockResolvedValueOnce(false); // generate adapters
        
        await init();
        
        expect(p.select).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('docs/ directory already exists'),
          })
        );
      });

      it('should skip existing files when user chooses skip', async () => {
        vi.mocked(p.confirm).mockResolvedValueOnce(true);
        vi.mocked(p.select).mockResolvedValueOnce('skip');
        vi.mocked(p.confirm).mockResolvedValueOnce(false);
        
        await init();
        
        // cpSync should not be called for existing files
        expect(cpSync).not.toHaveBeenCalled();
      });

      it('should cancel docs init when user chooses cancel', async () => {
        vi.mocked(p.confirm).mockResolvedValueOnce(true);
        vi.mocked(p.select).mockResolvedValueOnce('cancel');
        vi.mocked(p.confirm).mockResolvedValueOnce(false);
        
        await init();
        
        expect(p.log.info).toHaveBeenCalledWith('Skipped docs initialization.');
      });
    });
  });

  describe('adapter generation', () => {
    it('should prompt for adapter generation', async () => {
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(false) // init docs
        .mockResolvedValueOnce(true); // generate adapters
      vi.mocked(p.multiselect).mockResolvedValueOnce(['cursor']);
      
      await init();
      
      expect(p.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('generate agent adapter'),
        })
      );
    });

    it('should prompt for adapter selection when confirmed', async () => {
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      vi.mocked(p.multiselect).mockResolvedValueOnce(['cursor']);
      
      await init();
      
      expect(p.multiselect).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Which adapters'),
        })
      );
    });

    it('should skip adapter generation if user declines', async () => {
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);
      
      await init();
      
      expect(p.multiselect).not.toHaveBeenCalled();
    });

    it('should handle cancelled adapter prompt', async () => {
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(Symbol.for('cancel'));
      vi.mocked(p.isCancel).mockImplementation((value) => value === Symbol.for('cancel'));
      
      await init();
      
      expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('Flight Rules'));
    });

    it('should handle cancelled adapter selection', async () => {
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      vi.mocked(p.multiselect).mockResolvedValueOnce(Symbol.for('cancel'));
      vi.mocked(p.isCancel).mockImplementation((value) => value === Symbol.for('cancel'));
      
      await init();
      
      expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('Flight Rules'));
    });
  });

  describe('completion', () => {
    it('should show success message on completion', async () => {
      vi.mocked(p.confirm)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);
      
      await init();
      
      expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('ready'));
    });
  });

  describe('non-interactive mode', () => {
    beforeEach(() => {
      vi.mocked(isInteractive).mockReturnValue(false);
    });

    afterEach(() => {
      vi.mocked(isInteractive).mockReturnValue(true);
    });

    it('should skip reinstall when already installed', async () => {
      vi.mocked(isFlightRulesInstalled).mockReturnValue(true);
      
      await init();
      
      // Should not prompt, should skip
      expect(p.confirm).not.toHaveBeenCalled();
      expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('Skipping reinstall'));
      expect(fetchPayloadFromGitHub).not.toHaveBeenCalled();
    });

    it('should initialize docs without prompting', async () => {
      // Template files exist in payload
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('doc-templates')) return true;
        return false;
      });
      
      await init();
      
      // Should create docs directories without prompting
      expect(ensureDir).toHaveBeenCalledWith(join(mockCwd, 'docs'));
      expect(p.log.success).toHaveBeenCalledWith(expect.stringContaining('docs initialized'));
    });

    it('should skip existing docs files without prompting', async () => {
      // Both templates and docs exist
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('doc-templates')) return true;
        if (pathStr.includes('docs') && !pathStr.includes('.flight-rules')) return true;
        return false;
      });
      
      await init();
      
      // Should not prompt for docs conflict handling
      expect(p.select).not.toHaveBeenCalled();
      // Should skip existing files
      expect(p.log.success).toHaveBeenCalledWith(expect.stringContaining('skipped existing'));
    });

    it('should skip adapter generation without prompting', async () => {
      await init();
      
      // Should not prompt for adapter generation
      expect(p.multiselect).not.toHaveBeenCalled();
      // Should log that adapters were skipped
      expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('Skipping adapter'));
    });
  });
});

