/**
 * Tests for adapter.ts command
 * 
 * This file demonstrates mocking patterns for:
 * - @clack/prompts (interactive CLI prompts)
 * - File system operations
 * - Exported functions with dependencies
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';

// Mock @clack/prompts before importing the module under test
vi.mock('@clack/prompts', () => ({
  multiselect: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
  log: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
  isCancel: vi.fn((value) => value === Symbol.for('cancel')),
}));

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(() => ['start-coding-session.md', 'end-coding-session.md']),
    cpSync: vi.fn(),
  };
});

// Mock the files utility
vi.mock('../../src/utils/files.js', () => ({
  ensureDir: vi.fn(),
  getFlightRulesDir: vi.fn((cwd: string) => join(cwd, '.flight-rules')),
}));

import * as p from '@clack/prompts';
import { existsSync, writeFileSync, readdirSync, cpSync } from 'fs';
import { 
  isCursorAdapterInstalled,
  isAdapterInstalled,
  copyCommandsWithConflictHandling,
  setupCursorCommands,
  generateAdapters,
} from '../../src/commands/adapter.js';

describe('adapter.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset process.cwd mock
    vi.spyOn(process, 'cwd').mockReturnValue('/mock/project');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isCursorAdapterInstalled', () => {
    it('should return true when .cursor/commands/ exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      const result = isCursorAdapterInstalled('/some/project');
      
      expect(result).toBe(true);
      expect(existsSync).toHaveBeenCalledWith('/some/project/.cursor/commands');
    });

    it('should return false when .cursor/commands/ does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const result = isCursorAdapterInstalled('/some/project');
      
      expect(result).toBe(false);
    });
  });

  describe('isAdapterInstalled', () => {
    it('should return true for cursor if AGENTS.md exists', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).includes('AGENTS.md');
      });
      
      const result = isAdapterInstalled('/project', 'cursor');
      
      expect(result).toBe(true);
    });

    it('should return true for cursor if .cursor/commands exists', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).includes('.cursor/commands');
      });
      
      const result = isAdapterInstalled('/project', 'cursor');
      
      expect(result).toBe(true);
    });

    it('should return true for claude if CLAUDE.md exists', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).includes('CLAUDE.md');
      });
      
      const result = isAdapterInstalled('/project', 'claude');
      
      expect(result).toBe(true);
    });

    it('should return false for unknown adapter', () => {
      const result = isAdapterInstalled('/project', 'unknown');
      
      expect(result).toBe(false);
    });
  });

  describe('copyCommandsWithConflictHandling', () => {
    it('should copy files when no conflicts exist', async () => {
      // Source dir exists, but destination files don't
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        // Source directory exists
        if (pathStr === '/source/commands') return true;
        // Destination files don't exist
        return false;
      });
      vi.mocked(readdirSync).mockReturnValue(['start-coding-session.md', 'end-coding-session.md'] as unknown as ReturnType<typeof readdirSync>);
      
      const result = await copyCommandsWithConflictHandling('/source/commands', '/dest/commands');
      
      expect(result.copied).toHaveLength(2);
      expect(result.skipped).toHaveLength(0);
      expect(cpSync).toHaveBeenCalledTimes(2);
    });

    it('should skip prompts and replace when skipPrompts is true', async () => {
      vi.mocked(existsSync).mockReturnValue(true); // All files exist
      vi.mocked(readdirSync).mockReturnValue(['start-coding-session.md'] as unknown as ReturnType<typeof readdirSync>);
      
      const result = await copyCommandsWithConflictHandling('/source', '/dest', true);
      
      expect(result.copied).toHaveLength(1);
      expect(p.select).not.toHaveBeenCalled(); // No prompts
    });

    it('should prompt for conflict resolution when files exist', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        // Source directory exists, destination file exists
        return true;
      });
      vi.mocked(readdirSync).mockReturnValue(['test.md'] as unknown as ReturnType<typeof readdirSync>);
      vi.mocked(p.select).mockResolvedValue('replace');
      
      const result = await copyCommandsWithConflictHandling('/source', '/dest', false);
      
      expect(p.select).toHaveBeenCalled();
      expect(result.copied).toContain('test.md');
    });

    it('should handle replace_all batch action', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['file1.md', 'file2.md', 'file3.md'] as unknown as ReturnType<typeof readdirSync>);
      vi.mocked(p.select).mockResolvedValueOnce('replace_all');
      
      const result = await copyCommandsWithConflictHandling('/source', '/dest', false);
      
      // Should only prompt once, then batch replace
      expect(p.select).toHaveBeenCalledTimes(1);
      expect(result.copied).toHaveLength(3);
    });

    it('should handle skip_all batch action', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['file1.md', 'file2.md'] as unknown as ReturnType<typeof readdirSync>);
      vi.mocked(p.select).mockResolvedValueOnce('skip_all');
      
      const result = await copyCommandsWithConflictHandling('/source', '/dest', false);
      
      expect(p.select).toHaveBeenCalledTimes(1);
      expect(result.skipped).toHaveLength(2);
      expect(result.copied).toHaveLength(0);
    });

    it('should return empty arrays when source directory does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const result = await copyCommandsWithConflictHandling('/missing', '/dest');
      
      expect(result.copied).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
    });
  });

  describe('setupCursorCommands', () => {
    it('should create .cursor/commands directory and copy commands', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        // Source directory exists
        if (pathStr === '/source/commands') return true;
        // Destination files don't exist
        return false;
      });
      vi.mocked(readdirSync).mockReturnValue(['start-coding-session.md'] as unknown as ReturnType<typeof readdirSync>);
      
      const result = await setupCursorCommands('/project', '/source/commands');
      
      expect(result.copied).toContain('start-coding-session.md');
    });
  });

  describe('generateAdapters', () => {
    it('should generate AGENTS.md for cursor adapter', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(readdirSync).mockReturnValue([] as unknown as ReturnType<typeof readdirSync>);
      
      await generateAdapters(['cursor']);
      
      expect(writeFileSync).toHaveBeenCalledWith(
        '/mock/project/AGENTS.md',
        expect.stringContaining('Flight Rules – Cursor Adapter'),
        'utf-8'
      );
    });

    it('should generate CLAUDE.md for claude adapter', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      await generateAdapters(['claude']);
      
      expect(writeFileSync).toHaveBeenCalledWith(
        '/mock/project/CLAUDE.md',
        expect.stringContaining('Flight Rules – Claude Code Adapter'),
        'utf-8'
      );
    });

    it('should prompt for overwrite when adapter file exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(p.confirm).mockResolvedValue(true);
      vi.mocked(readdirSync).mockReturnValue([] as unknown as ReturnType<typeof readdirSync>);
      
      await generateAdapters(['claude']);
      
      expect(p.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'CLAUDE.md already exists. Overwrite?',
        })
      );
    });

    it('should skip generation when user declines overwrite', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(p.confirm).mockResolvedValue(false);
      
      await generateAdapters(['claude']);
      
      expect(writeFileSync).not.toHaveBeenCalled();
      expect(p.log.info).toHaveBeenCalledWith('Skipped CLAUDE.md');
    });

    it('should handle cancelled prompt', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(p.confirm).mockResolvedValue(Symbol.for('cancel'));
      vi.mocked(p.isCancel).mockReturnValue(true);
      
      await generateAdapters(['claude']);
      
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('should generate multiple adapters', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(readdirSync).mockReturnValue([] as unknown as ReturnType<typeof readdirSync>);
      
      await generateAdapters(['cursor', 'claude']);
      
      expect(writeFileSync).toHaveBeenCalledTimes(2);
    });

    it('should skip unknown adapter names', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      await generateAdapters(['unknown', 'fake']);
      
      expect(writeFileSync).not.toHaveBeenCalled();
    });
  });
});

