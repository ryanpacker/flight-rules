/**
 * Tests for version-check.ts utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('version-check.ts', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('checkForUpdate', () => {
    it('should return null when CLI version is unknown', async () => {
      vi.doMock('../../src/utils/files.js', () => ({
        getCliVersion: () => 'unknown',
      }));
      vi.doMock('../../src/utils/config.js', () => ({
        getChannel: () => 'dev',
        getCachedVersion: () => null,
        updateLastCheck: vi.fn(),
      }));

      const { checkForUpdate } = await import('../../src/utils/version-check.js');
      const result = await checkForUpdate();

      expect(result).toBeNull();
    });

    it('should use cached version when available and not forced', async () => {
      vi.doMock('../../src/utils/files.js', () => ({
        getCliVersion: () => '0.5.0',
      }));
      vi.doMock('../../src/utils/config.js', () => ({
        getChannel: () => 'dev',
        getCachedVersion: () => '0.6.0',
        updateLastCheck: vi.fn(),
      }));

      const { checkForUpdate } = await import('../../src/utils/version-check.js');
      const result = await checkForUpdate();

      expect(result).toEqual({
        currentVersion: '0.5.0',
        latestVersion: '0.6.0',
        updateAvailable: true,
        channel: 'dev',
      });
    });

    it('should return updateAvailable=false when current is latest', async () => {
      vi.doMock('../../src/utils/files.js', () => ({
        getCliVersion: () => '0.6.0',
      }));
      vi.doMock('../../src/utils/config.js', () => ({
        getChannel: () => 'dev',
        getCachedVersion: () => '0.6.0',
        updateLastCheck: vi.fn(),
      }));

      const { checkForUpdate } = await import('../../src/utils/version-check.js');
      const result = await checkForUpdate();

      expect(result?.updateAvailable).toBe(false);
    });

    it('should return updateAvailable=false when current is newer', async () => {
      vi.doMock('../../src/utils/files.js', () => ({
        getCliVersion: () => '0.7.0',
      }));
      vi.doMock('../../src/utils/config.js', () => ({
        getChannel: () => 'dev',
        getCachedVersion: () => '0.6.0',
        updateLastCheck: vi.fn(),
      }));

      const { checkForUpdate } = await import('../../src/utils/version-check.js');
      const result = await checkForUpdate();

      expect(result?.updateAvailable).toBe(false);
    });

    it('should return null on network error when cache is empty', async () => {
      vi.doMock('../../src/utils/files.js', () => ({
        getCliVersion: () => '0.5.0',
      }));
      vi.doMock('../../src/utils/config.js', () => ({
        getChannel: () => 'dev',
        getCachedVersion: () => null,
        updateLastCheck: vi.fn(),
      }));
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const { checkForUpdate } = await import('../../src/utils/version-check.js');
      const result = await checkForUpdate();

      expect(result).toBeNull();
    });

    it('should return null on non-ok response', async () => {
      vi.doMock('../../src/utils/files.js', () => ({
        getCliVersion: () => '0.5.0',
      }));
      vi.doMock('../../src/utils/config.js', () => ({
        getChannel: () => 'dev',
        getCachedVersion: () => null,
        updateLastCheck: vi.fn(),
      }));
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

      const { checkForUpdate } = await import('../../src/utils/version-check.js');
      const result = await checkForUpdate();

      expect(result).toBeNull();
    });

    it('should fetch from npm registry when cache is empty', async () => {
      const mockUpdateLastCheck = vi.fn();
      vi.doMock('../../src/utils/files.js', () => ({
        getCliVersion: () => '0.5.0',
      }));
      vi.doMock('../../src/utils/config.js', () => ({
        getChannel: () => 'dev',
        getCachedVersion: () => null,
        updateLastCheck: mockUpdateLastCheck,
      }));
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          'dist-tags': { dev: '0.6.0', latest: '0.5.5' },
        }),
      }));

      const { checkForUpdate } = await import('../../src/utils/version-check.js');
      const result = await checkForUpdate();

      expect(result).toEqual({
        currentVersion: '0.5.0',
        latestVersion: '0.6.0',
        updateAvailable: true,
        channel: 'dev',
      });
      expect(mockUpdateLastCheck).toHaveBeenCalledWith('0.6.0');
    });

    it('should use correct channel from config', async () => {
      vi.doMock('../../src/utils/files.js', () => ({
        getCliVersion: () => '0.5.0',
      }));
      vi.doMock('../../src/utils/config.js', () => ({
        getChannel: () => 'latest',
        getCachedVersion: () => null,
        updateLastCheck: vi.fn(),
      }));
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          'dist-tags': { dev: '0.7.0', latest: '0.6.0' },
        }),
      }));

      const { checkForUpdate } = await import('../../src/utils/version-check.js');
      const result = await checkForUpdate();

      expect(result?.latestVersion).toBe('0.6.0');
      expect(result?.channel).toBe('latest');
    });

    it('should handle semver comparison correctly', async () => {
      const testCases = [
        { current: '0.5.0', latest: '0.5.1', expected: true },
        { current: '0.5.0', latest: '0.6.0', expected: true },
        { current: '0.5.0', latest: '1.0.0', expected: true },
        { current: '1.0.0', latest: '0.9.9', expected: false },
        { current: '1.0.0', latest: '1.0.0', expected: false },
        { current: '0.10.0', latest: '0.9.0', expected: false },
        { current: '0.9.0', latest: '0.10.0', expected: true },
      ];

      for (const { current, latest, expected } of testCases) {
        vi.resetModules();
        vi.doMock('../../src/utils/files.js', () => ({
          getCliVersion: () => current,
        }));
        vi.doMock('../../src/utils/config.js', () => ({
          getChannel: () => 'dev',
          getCachedVersion: () => latest,
          updateLastCheck: vi.fn(),
        }));

        const { checkForUpdate } = await import('../../src/utils/version-check.js');
        const result = await checkForUpdate();

        expect(result?.updateAvailable).toBe(expected);
      }
    });
  });

  describe('shouldSkipUpdateCheck', () => {
    it('should return false when env var is not set', async () => {
      delete process.env.FLIGHT_RULES_NO_UPDATE_CHECK;
      vi.resetModules();

      const { shouldSkipUpdateCheck } = await import('../../src/utils/version-check.js');
      expect(shouldSkipUpdateCheck()).toBe(false);
    });

    it('should return true when env var is set to 1', async () => {
      process.env.FLIGHT_RULES_NO_UPDATE_CHECK = '1';
      vi.resetModules();

      const { shouldSkipUpdateCheck } = await import('../../src/utils/version-check.js');
      expect(shouldSkipUpdateCheck()).toBe(true);
    });

    it('should return false when env var is set to other value', async () => {
      process.env.FLIGHT_RULES_NO_UPDATE_CHECK = 'true';
      vi.resetModules();

      const { shouldSkipUpdateCheck } = await import('../../src/utils/version-check.js');
      expect(shouldSkipUpdateCheck()).toBe(false);
    });
  });
});
