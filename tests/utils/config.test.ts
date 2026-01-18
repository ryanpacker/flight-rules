/**
 * Tests for config.ts utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

// Mock os module
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}));

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import {
  getUserFlightRulesDir,
  getConfigPath,
  readConfig,
  writeConfig,
  getChannel,
  setChannel,
  updateLastCheck,
  getCachedVersion,
} from '../../src/utils/config.js';

describe('config.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUserFlightRulesDir', () => {
    it('should return ~/.flight-rules path', () => {
      const result = getUserFlightRulesDir();
      expect(result).toBe('/home/testuser/.flight-rules');
    });
  });

  describe('getConfigPath', () => {
    it('should return ~/.flight-rules/config.json path', () => {
      const result = getConfigPath();
      expect(result).toBe('/home/testuser/.flight-rules/config.json');
    });
  });

  describe('readConfig', () => {
    it('should return default config when file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = readConfig();

      expect(result).toEqual({ channel: 'dev' });
    });

    it('should return parsed config when file exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        channel: 'latest',
        lastUpdateCheck: {
          timestamp: '2026-01-15T10:00:00.000Z',
          latestVersion: '1.0.0',
        },
      }));

      const result = readConfig();

      expect(result.channel).toBe('latest');
      expect(result.lastUpdateCheck?.latestVersion).toBe('1.0.0');
    });

    it('should return default config on parse error', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid json');

      const result = readConfig();

      expect(result).toEqual({ channel: 'dev' });
    });

    it('should merge with defaults to handle missing fields', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        // Missing 'channel' field
        lastUpdateCheck: { timestamp: '2026-01-15T10:00:00.000Z', latestVersion: '1.0.0' },
      }));

      const result = readConfig();

      expect(result.channel).toBe('dev'); // Default value
      expect(result.lastUpdateCheck?.latestVersion).toBe('1.0.0');
    });
  });

  describe('writeConfig', () => {
    it('should create directory if it does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      writeConfig({ channel: 'dev' });

      expect(mkdirSync).toHaveBeenCalledWith('/home/testuser/.flight-rules', { recursive: true });
    });

    it('should write config as JSON', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const config = { channel: 'latest' as const };
      writeConfig(config);

      expect(writeFileSync).toHaveBeenCalledWith(
        '/home/testuser/.flight-rules/config.json',
        expect.stringContaining('"channel": "latest"'),
        'utf-8'
      );
    });
  });

  describe('getChannel', () => {
    it('should return channel from config', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ channel: 'latest' }));

      const result = getChannel();

      expect(result).toBe('latest');
    });

    it('should return default channel when config does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = getChannel();

      expect(result).toBe('dev');
    });
  });

  describe('setChannel', () => {
    it('should update channel in config', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ channel: 'dev' }));

      setChannel('latest');

      expect(writeFileSync).toHaveBeenCalledWith(
        '/home/testuser/.flight-rules/config.json',
        expect.stringContaining('"channel": "latest"'),
        'utf-8'
      );
    });
  });

  describe('updateLastCheck', () => {
    it('should update lastUpdateCheck in config', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ channel: 'dev' }));

      updateLastCheck('1.2.3');

      expect(writeFileSync).toHaveBeenCalledWith(
        '/home/testuser/.flight-rules/config.json',
        expect.stringContaining('"latestVersion": "1.2.3"'),
        'utf-8'
      );
    });
  });

  describe('getCachedVersion', () => {
    it('should return null when no cache exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ channel: 'dev' }));

      const result = getCachedVersion();

      expect(result).toBeNull();
    });

    it('should return null when cache is expired', () => {
      const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        channel: 'dev',
        lastUpdateCheck: { timestamp: oldTimestamp, latestVersion: '1.0.0' },
      }));

      const result = getCachedVersion();

      expect(result).toBeNull();
    });

    it('should return cached version when cache is valid', () => {
      const recentTimestamp = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1 hour ago
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        channel: 'dev',
        lastUpdateCheck: { timestamp: recentTimestamp, latestVersion: '1.0.0' },
      }));

      const result = getCachedVersion();

      expect(result).toBe('1.0.0');
    });

    it('should respect custom maxAge parameter', () => {
      const timestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        channel: 'dev',
        lastUpdateCheck: { timestamp, latestVersion: '1.0.0' },
      }));

      // With 1 hour maxAge, should be expired
      expect(getCachedVersion(1 * 60 * 60 * 1000)).toBeNull();

      // With 3 hour maxAge, should be valid
      expect(getCachedVersion(3 * 60 * 60 * 1000)).toBe('1.0.0');
    });
  });
});
