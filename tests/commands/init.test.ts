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
}));

// Mock adapter.js - use dynamic import pattern
vi.mock('../../src/commands/adapter.js', () => ({
  generateAdapters: vi.fn(),
}));

import * as p from '@clack/prompts';
import { existsSync, cpSync } from 'fs';
import { 
  isFlightRulesInstalled, 
  fetchPayloadFromGitHub, 
  copyPayloadFrom,
  ensureDir,
} from '../../src/utils/files.js';
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
});

