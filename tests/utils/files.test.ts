import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { 
  getPayloadPath,
  isFlightRulesInstalled,
  getFlightRulesDir,
  ensureDir,
  copyPayload,
  copyPayloadFrom,
  copyFrameworkFiles,
  copyFrameworkFilesFrom,
  fetchPayloadFromGitHub,
} from '../../src/utils/files.js';

// Mock the fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    cpSync: vi.fn(),
    rmSync: vi.fn(),
    createWriteStream: vi.fn(() => ({
      on: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    })),
    readdirSync: vi.fn(() => ['ryanpacker-flight-rules-abc1234']),
    readFileSync: vi.fn(() => 'flight_rules_version: 0.3.0'),
  };
});

// Mock tar module
vi.mock('tar', () => ({
  extract: vi.fn(() => Promise.resolve()),
}));

// Mock stream/promises
vi.mock('stream/promises', () => ({
  pipeline: vi.fn(() => Promise.resolve()),
}));

import { existsSync, mkdirSync, cpSync, rmSync, readdirSync, readFileSync } from 'fs';
import * as tar from 'tar';

describe('files.ts utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPayloadPath', () => {
    it('should return a path ending with /payload', () => {
      const payloadPath = getPayloadPath();
      expect(payloadPath).toMatch(/payload$/);
    });

    it('should return an absolute path', () => {
      const payloadPath = getPayloadPath();
      expect(payloadPath.startsWith('/')).toBe(true);
    });
  });

  describe('getFlightRulesDir', () => {
    it('should return .flight-rules directory path', () => {
      const result = getFlightRulesDir('/some/project');
      expect(result).toBe('/some/project/.flight-rules');
    });

    it('should handle paths with trailing slash', () => {
      const result = getFlightRulesDir('/some/project/');
      expect(result).toBe('/some/project/.flight-rules');
    });
  });

  describe('isFlightRulesInstalled', () => {
    it('should return true when .flight-rules directory exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      const result = isFlightRulesInstalled('/some/project');
      
      expect(result).toBe(true);
      expect(existsSync).toHaveBeenCalledWith('/some/project/.flight-rules');
    });

    it('should return false when .flight-rules directory does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const result = isFlightRulesInstalled('/some/project');
      
      expect(result).toBe(false);
      expect(existsSync).toHaveBeenCalledWith('/some/project/.flight-rules');
    });
  });

  describe('ensureDir', () => {
    it('should create directory if it does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      ensureDir('/some/new/dir');
      
      expect(mkdirSync).toHaveBeenCalledWith('/some/new/dir', { recursive: true });
    });

    it('should not create directory if it already exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      ensureDir('/existing/dir');
      
      expect(mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('copyPayloadFrom', () => {
    it('should copy payload to .flight-rules directory', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      copyPayloadFrom('/source/payload', '/target/project');
      
      expect(cpSync).toHaveBeenCalledWith(
        '/source/payload',
        '/target/project/.flight-rules',
        { recursive: true }
      );
    });

    it('should throw error if source payload does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      expect(() => copyPayloadFrom('/missing/payload', '/target'))
        .toThrow('Payload not found at /missing/payload');
    });
  });

  describe('copyFrameworkFilesFrom', () => {
    it('should copy only framework items (AGENTS.md, doc-templates, commands, prompts)', () => {
      // existsSync is called for each framework item
      vi.mocked(existsSync).mockReturnValue(true);
      
      copyFrameworkFilesFrom('/source/payload', '/target/project');
      
      // Should copy each framework item
      expect(cpSync).toHaveBeenCalledWith(
        '/source/payload/AGENTS.md',
        '/target/project/.flight-rules/AGENTS.md',
        { recursive: true }
      );
      expect(cpSync).toHaveBeenCalledWith(
        '/source/payload/doc-templates',
        '/target/project/.flight-rules/doc-templates',
        { recursive: true }
      );
      expect(cpSync).toHaveBeenCalledWith(
        '/source/payload/commands',
        '/target/project/.flight-rules/commands',
        { recursive: true }
      );
      expect(cpSync).toHaveBeenCalledWith(
        '/source/payload/prompts',
        '/target/project/.flight-rules/prompts',
        { recursive: true }
      );
    });

    it('should skip framework items that do not exist in source', () => {
      // Only AGENTS.md exists
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).includes('AGENTS.md');
      });
      
      copyFrameworkFilesFrom('/source/payload', '/target/project');
      
      // Should only copy AGENTS.md
      expect(cpSync).toHaveBeenCalledTimes(1);
      expect(cpSync).toHaveBeenCalledWith(
        '/source/payload/AGENTS.md',
        '/target/project/.flight-rules/AGENTS.md',
        { recursive: true }
      );
    });
  });

  describe('copyPayload', () => {
    it('should copy from getPayloadPath() to .flight-rules directory', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      copyPayload('/target/project');
      
      // Should call cpSync with payload path and target .flight-rules
      expect(cpSync).toHaveBeenCalledWith(
        expect.stringMatching(/payload$/),
        '/target/project/.flight-rules',
        { recursive: true }
      );
    });

    it('should throw error if payload directory does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      expect(() => copyPayload('/target'))
        .toThrow(/Payload not found at/);
    });
  });

  describe('copyFrameworkFiles', () => {
    it('should copy framework items from getPayloadPath() to target', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      copyFrameworkFiles('/target/project');
      
      // Should copy each framework item from payload path
      expect(cpSync).toHaveBeenCalledTimes(4);
      
      // Verify the destination paths
      const calls = vi.mocked(cpSync).mock.calls;
      const destPaths = calls.map(call => call[1]);
      
      expect(destPaths).toContain('/target/project/.flight-rules/AGENTS.md');
      expect(destPaths).toContain('/target/project/.flight-rules/doc-templates');
      expect(destPaths).toContain('/target/project/.flight-rules/commands');
      expect(destPaths).toContain('/target/project/.flight-rules/prompts');
    });

    it('should skip items that do not exist in payload', () => {
      // Simulate only some items existing
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        return pathStr.includes('AGENTS.md') || pathStr.includes('commands');
      });
      
      copyFrameworkFiles('/target/project');
      
      expect(cpSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchPayloadFromGitHub', () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
      // Setup global fetch mock
      vi.stubGlobal('fetch', mockFetch);
      
      // Reset mocks
      mockFetch.mockReset();
      vi.mocked(existsSync).mockReset();
      vi.mocked(mkdirSync).mockReset();
      vi.mocked(rmSync).mockReset();
      vi.mocked(readdirSync).mockReset();
      vi.mocked(readFileSync).mockReset();
      
      // Default mock implementations
      vi.mocked(readdirSync).mockReturnValue(['ryanpacker-flight-rules-abc1234'] as unknown as ReturnType<typeof readdirSync>);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('flight_rules_version: 0.3.2');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should fetch from main branch by default', async () => {
      // Create a mock ReadableStream
      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        }
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: mockBody,
      });

      const result = await fetchPayloadFromGitHub();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/ryanpacker/flight-rules/tarball/main',
        expect.objectContaining({
          headers: { 'Accept': 'application/vnd.github+json' },
          redirect: 'follow',
        })
      );

      expect(result.version).toBe('0.3.2');
      expect(result.payloadPath).toContain('payload');
      expect(typeof result.cleanup).toBe('function');

      // Cleanup
      result.cleanup();
    });

    it('should fetch specific version with v prefix', async () => {
      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        }
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: mockBody,
      });

      await fetchPayloadFromGitHub('0.2.0');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/ryanpacker/flight-rules/tarball/v0.2.0',
        expect.any(Object)
      );
    });

    it('should handle version already having v prefix', async () => {
      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        }
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: mockBody,
      });

      await fetchPayloadFromGitHub('v0.2.0');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/ryanpacker/flight-rules/tarball/v0.2.0',
        expect.any(Object)
      );
    });

    it('should throw error on 404 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(fetchPayloadFromGitHub('v99.99.99'))
        .rejects
        .toThrow("Version 'v99.99.99' not found");
    });

    it('should throw error on other HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(fetchPayloadFromGitHub())
        .rejects
        .toThrow('Failed to download from GitHub: 500 Internal Server Error');
    });

    it('should throw error if no response body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: null,
      });

      await expect(fetchPayloadFromGitHub())
        .rejects
        .toThrow('No response body received from GitHub');
    });

    it('should throw error if no files extracted', async () => {
      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        }
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: mockBody,
      });

      vi.mocked(readdirSync).mockReturnValue([] as unknown as ReturnType<typeof readdirSync>);

      await expect(fetchPayloadFromGitHub())
        .rejects
        .toThrow('No files extracted from tarball');
    });

    it('should throw error if payload directory not found in extracted content', async () => {
      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        }
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: mockBody,
      });

      // Payload path check returns false
      vi.mocked(existsSync).mockImplementation((path) => {
        return !String(path).includes('payload');
      });

      await expect(fetchPayloadFromGitHub())
        .rejects
        .toThrow('Payload directory not found in downloaded content');
    });

    it('should cleanup temp directory on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(fetchPayloadFromGitHub()).rejects.toThrow('Network error');

      // rmSync should be called for cleanup
      expect(rmSync).toHaveBeenCalled();
    });

    it('should use "latest" as alias for main branch', async () => {
      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        }
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: mockBody,
      });

      await fetchPayloadFromGitHub('latest');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/ryanpacker/flight-rules/tarball/main',
        expect.any(Object)
      );
    });
  });
});

