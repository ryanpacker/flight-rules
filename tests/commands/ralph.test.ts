/**
 * Tests for ralph.ts command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  log: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    message: vi.fn(),
    step: vi.fn(),
  },
}));

// Mock picocolors
vi.mock('picocolors', () => ({
  default: {
    cyan: vi.fn((str) => str),
    green: vi.fn((str) => str),
    yellow: vi.fn((str) => str),
    magenta: vi.fn((str) => str),
    white: vi.fn((str) => str),
    dim: vi.fn((str) => str),
    bgMagenta: vi.fn((str) => str),
  },
}));

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock utils/files.js
vi.mock('../../src/utils/files.js', () => ({
  isFlightRulesInstalled: vi.fn(),
  getFlightRulesDir: vi.fn((cwd: string) => join(cwd, '.flight-rules')),
}));

import * as p from '@clack/prompts';
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import { isFlightRulesInstalled, getFlightRulesDir } from '../../src/utils/files.js';
import { ralph, RalphOptions } from '../../src/commands/ralph.js';

// Helper to create a mock spawn process
function createMockProcess(
  exitCode: number = 0,
  stdout: string = '',
  stderr: string = ''
) {
  return {
    stdout: {
      on: vi.fn((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data' && stdout) {
          process.nextTick(() => callback(Buffer.from(stdout)));
        }
      }),
    },
    stderr: {
      on: vi.fn((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data' && stderr) {
          process.nextTick(() => callback(Buffer.from(stderr)));
        }
      }),
    },
    stdin: {
      write: vi.fn(),
      end: vi.fn(),
    },
    on: vi.fn((event: string, callback: (code: number) => void) => {
      if (event === 'close') {
        process.nextTick(() => callback(exitCode));
      }
    }),
  };
}

describe('ralph command', () => {
  const mockCwd = '/mock/project';
  const mockPromptPath = join(mockCwd, '.flight-rules', 'prompts', 'ralph-loop.md');
  const mockPromptContent = '# Flight Rules Autonomous Agent\n...';

  const defaultOptions: RalphOptions = {
    maxIterations: 10,
    dryRun: false,
    verbose: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);

    // Default: Flight Rules is installed
    vi.mocked(isFlightRulesInstalled).mockReturnValue(true);

    // Default: prompt file exists
    vi.mocked(existsSync).mockReturnValue(true);

    // Default: prompt content
    vi.mocked(readFileSync).mockReturnValue(mockPromptContent);

    // Default: Claude CLI is available
    vi.mocked(spawn).mockReturnValue(createMockProcess(0) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validation', () => {
    it('should error if Flight Rules is not installed', async () => {
      vi.mocked(isFlightRulesInstalled).mockReturnValue(false);

      await ralph(defaultOptions);

      expect(p.log.error).toHaveBeenCalledWith(
        'Flight Rules is not installed in this directory.'
      );
      expect(p.log.info).toHaveBeenCalledWith('Run `flight-rules init` first.');
    });

    it('should error if prompt file is missing', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        // Flight Rules dir exists, but prompt file doesn't
        if (String(path).includes('ralph-loop.md')) {
          return false;
        }
        return true;
      });

      await ralph(defaultOptions);

      expect(p.log.error).toHaveBeenCalledWith('Ralph prompt file not found.');
      expect(p.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Expected at:')
      );
    });

    it('should error if Claude CLI is not available', async () => {
      // First call is for claude --version check
      vi.mocked(spawn).mockImplementationOnce(() => {
        const mockProcess = createMockProcess(1);
        return mockProcess as any;
      });

      await ralph(defaultOptions);

      expect(p.log.error).toHaveBeenCalledWith('Claude Code CLI not found.');
      expect(p.log.info).toHaveBeenCalledWith(
        expect.stringContaining('npm install -g @anthropic-ai/claude-code')
      );
    });
  });

  describe('dry run mode', () => {
    it('should show info without executing', async () => {
      // First spawn call is for claude --version check, which succeeds
      vi.mocked(spawn).mockImplementationOnce(() => {
        return createMockProcess(0) as any;
      });

      await ralph({ ...defaultOptions, dryRun: true });

      expect(p.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Dry run mode')
      );
      expect(p.log.message).toHaveBeenCalledWith(
        expect.stringContaining('Prompt file:')
      );
      expect(p.log.message).toHaveBeenCalledWith(
        expect.stringContaining('Max iterations:')
      );
      expect(p.log.message).toHaveBeenCalledWith(
        expect.stringContaining('Command:')
      );

      // Should only spawn once for --version check, not for actual execution
      expect(spawn).toHaveBeenCalledTimes(1);
      expect(spawn).toHaveBeenCalledWith('claude', ['--version'], expect.any(Object));
    });
  });

  describe('completion signal detection', () => {
    it('should stop on COMPLETE signal', async () => {
      const completionOutput = 'Working...\n<ralph-signal>COMPLETE</ralph-signal>\n';

      // First call: claude --version (success)
      // Second call: claude with prompt (returns completion signal)
      vi.mocked(spawn)
        .mockImplementationOnce(() => createMockProcess(0) as any)
        .mockImplementationOnce(() => createMockProcess(0, completionOutput) as any);

      await ralph({ ...defaultOptions, maxIterations: 5 });

      expect(p.log.success).toHaveBeenCalledWith(
        expect.stringContaining('All task groups complete!')
      );
      // Should only run 2 spawns: version check + 1 iteration
      expect(spawn).toHaveBeenCalledTimes(2);
    });
  });

  describe('max iterations', () => {
    it('should respect max iterations limit', async () => {
      const normalOutput = 'Working on task group 1.1...';

      // First call: claude --version (success)
      // Next N calls: normal output (no completion signal)
      vi.mocked(spawn).mockImplementation((command, args) => {
        if (args && args.includes('--version')) {
          return createMockProcess(0) as any;
        }
        return createMockProcess(0, normalOutput) as any;
      });

      await ralph({ ...defaultOptions, maxIterations: 3 });

      expect(p.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('Reached max iterations (3)')
      );
      // Should be: 1 version check + 3 iterations = 4 total
      expect(spawn).toHaveBeenCalledTimes(4);
    });

    it('should use custom max-iterations value', async () => {
      vi.mocked(spawn).mockImplementation((command, args) => {
        if (args && args.includes('--version')) {
          return createMockProcess(0) as any;
        }
        return createMockProcess(0, 'working...') as any;
      });

      await ralph({ ...defaultOptions, maxIterations: 2 });

      expect(p.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('Reached max iterations (2)')
      );
      // 1 version check + 2 iterations = 3 total
      expect(spawn).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('should continue loop despite errors in individual iterations', async () => {
      let callCount = 0;

      vi.mocked(spawn).mockImplementation((command, args) => {
        callCount++;
        if (args && args.includes('--version')) {
          return createMockProcess(0) as any;
        }
        // Second iteration (callCount 3) throws error
        if (callCount === 3) {
          const mockProcess = createMockProcess(0);
          mockProcess.on = vi.fn((event: string, callback: any) => {
            if (event === 'error') {
              process.nextTick(() => callback(new Error('Test error')));
            }
          });
          return mockProcess as any;
        }
        return createMockProcess(0, 'working...') as any;
      });

      await ralph({ ...defaultOptions, maxIterations: 3 });

      // Should still complete all iterations despite error
      expect(p.log.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in iteration')
      );
    });
  });

  describe('claude invocation', () => {
    it('should pass correct flags to claude', async () => {
      vi.mocked(spawn)
        .mockImplementationOnce(() => createMockProcess(0) as any)
        .mockImplementationOnce(() => createMockProcess(0, '<ralph-signal>COMPLETE</ralph-signal>') as any);

      await ralph(defaultOptions);

      // Check the second spawn call (first is --version check)
      expect(spawn).toHaveBeenNthCalledWith(
        2,
        'claude',
        ['--dangerously-skip-permissions', '-p'],
        expect.objectContaining({
          shell: true,
        })
      );
    });
  });

  describe('area constraint', () => {
    it('should show area in dry run output', async () => {
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0) as any);

      await ralph({ ...defaultOptions, dryRun: true, area: '2' });

      expect(p.log.message).toHaveBeenCalledWith(
        expect.stringContaining('Area constraint: 2')
      );
    });

    it('should show area info when starting loop', async () => {
      vi.mocked(spawn)
        .mockImplementationOnce(() => createMockProcess(0) as any)
        .mockImplementationOnce(() => createMockProcess(0, '<ralph-signal>COMPLETE</ralph-signal>') as any);

      await ralph({ ...defaultOptions, area: '2-cli-core' });

      expect(p.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Targeting Area: 2-cli-core')
      );
    });
  });

  describe('branch management', () => {
    it('should show branch in dry run output', async () => {
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0) as any);

      await ralph({ ...defaultOptions, dryRun: true, branch: 'feature/test' });

      expect(p.log.message).toHaveBeenCalledWith(
        expect.stringContaining('Branch: feature/test')
      );
    });

    it('should auto-generate branch name when branch is true', async () => {
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0) as any);

      await ralph({ ...defaultOptions, dryRun: true, branch: true });

      expect(p.log.message).toHaveBeenCalledWith(
        expect.stringMatching(/Branch: ralph\/\d{8}-\d{4}/)
      );
    });

    it('should error if git is not clean when branch is specified', async () => {
      // claude --version succeeds
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0) as any);

      // git status --porcelain returns dirty state
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0, 'M file.txt') as any);

      await ralph({ ...defaultOptions, branch: 'feature/test' });

      expect(p.log.error).toHaveBeenCalledWith(
        'Git working directory is not clean.'
      );
      expect(p.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Commit or stash your changes')
      );
    });

    it('should error if branch already exists', async () => {
      // claude --version succeeds
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0) as any);

      // git status --porcelain returns clean
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0, '') as any);

      // git rev-parse --verify succeeds (branch exists)
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0) as any);

      await ralph({ ...defaultOptions, branch: 'existing-branch' });

      expect(p.log.error).toHaveBeenCalledWith(
        expect.stringContaining("Branch 'existing-branch' already exists")
      );
    });

    it('should create and checkout branch successfully', async () => {
      // claude --version succeeds
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0) as any);

      // git status --porcelain returns clean
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0, '') as any);

      // git rev-parse --verify fails (branch doesn't exist)
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(1) as any);

      // git checkout -b succeeds
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0) as any);

      // claude loop returns completion
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0, '<ralph-signal>COMPLETE</ralph-signal>') as any);

      await ralph({ ...defaultOptions, branch: 'new-branch' });

      expect(p.log.success).toHaveBeenCalledWith(
        expect.stringContaining('Switched to new branch: new-branch')
      );
    });
  });
});
