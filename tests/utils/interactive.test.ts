/**
 * Tests for interactive.ts utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isInteractive } from '../../src/utils/interactive.js';

describe('interactive.ts', () => {
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    // Restore original isTTY
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      writable: true,
    });
  });

  describe('isInteractive', () => {
    it('should return true when stdout is a TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
      });
      
      expect(isInteractive()).toBe(true);
    });

    it('should return false when stdout is not a TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        writable: true,
      });
      
      expect(isInteractive()).toBe(false);
    });

    it('should return false when isTTY is undefined (CI environment)', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: undefined,
        writable: true,
      });
      
      expect(isInteractive()).toBe(false);
    });
  });
});

