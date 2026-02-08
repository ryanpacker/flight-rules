/**
 * Tests for parallel.ts command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join, resolve, basename, dirname } from 'path';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    message: vi.fn(),
    step: vi.fn(),
  },
  confirm: vi.fn(),
  select: vi.fn(),
  isCancel: vi.fn(() => false),
}));

// Mock picocolors
vi.mock('picocolors', () => ({
  default: {
    cyan: vi.fn((str: string) => str),
    green: vi.fn((str: string) => str),
    yellow: vi.fn((str: string) => str),
    red: vi.fn((str: string) => str),
    bold: vi.fn((str: string) => str),
    dim: vi.fn((str: string) => str),
  },
}));

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    copyFileSync: vi.fn(),
    readdirSync: vi.fn(() => []),
  };
});

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock utils
vi.mock('../../src/utils/files.js', () => ({
  ensureDir: vi.fn(),
}));

vi.mock('../../src/utils/interactive.js', () => ({
  isInteractive: vi.fn(() => true),
}));

import * as p from '@clack/prompts';
import { existsSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'fs';
import { spawn } from 'child_process';
import { isInteractive } from '../../src/utils/interactive.js';

import {
  parallel,
  parallelCreate,
  parallelStatus,
  parallelCleanup,
  parallelRemove,
  getSessionsDir,
  getManifestPath,
  readSessionManifest,
  writeSessionManifest,
  createEmptyManifest,
  addSessionToManifest,
  removeSessionFromManifest,
  copyEnvFiles,
  formatRelativeTime,
  runGitCommand,
  isGitClean,
  isInsideWorktree,
  listGitWorktrees,
  getCommitsAhead,
  getCurrentBranch,
  SessionManifest,
  SessionEntry,
} from '../../src/commands/parallel.js';

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
    on: vi.fn((event: string, callback: (code: number | null) => void) => {
      if (event === 'close') {
        process.nextTick(() => callback(exitCode));
      }
    }),
  };
}

// Helper to set up spawn mock for specific git commands
function mockSpawnForGitCommands(
  commandResponses: Record<string, { exitCode: number; stdout: string; stderr?: string }>
) {
  const spawnMock = vi.mocked(spawn);
  spawnMock.mockImplementation(((cmd: string, args: string[]) => {
    const key = `${cmd} ${args.join(' ')}`;

    // Find matching response by prefix
    for (const [pattern, response] of Object.entries(commandResponses)) {
      if (key.includes(pattern)) {
        return createMockProcess(response.exitCode, response.stdout, response.stderr || '');
      }
    }

    // Default: success with empty output
    return createMockProcess(0, '', '');
  }) as typeof spawn);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process, 'cwd').mockReturnValue('/test/my-project');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Pure function tests ──────────────────────────────────────────────────

describe('getSessionsDir', () => {
  it('should return sibling sessions directory', () => {
    const result = getSessionsDir('/users/dev/my-project');
    expect(result).toBe(join('/users/dev', 'my-project-sessions'));
  });

  it('should handle nested paths', () => {
    const result = getSessionsDir('/users/dev/work/my-project');
    expect(result).toBe(join('/users/dev/work', 'my-project-sessions'));
  });
});

describe('getManifestPath', () => {
  it('should return manifest path in sessions directory', () => {
    const result = getManifestPath('/users/dev/my-project');
    expect(result).toBe(join('/users/dev', 'my-project-sessions', '.manifest.json'));
  });
});

describe('createEmptyManifest', () => {
  it('should create a manifest with version 1 and project name', () => {
    const result = createEmptyManifest('/users/dev/my-project');
    expect(result).toEqual({
      version: 1,
      project: 'my-project',
      sessions: [],
    });
  });
});

describe('formatRelativeTime', () => {
  it('should return "just now" for very recent times', () => {
    const result = formatRelativeTime(new Date().toISOString());
    expect(result).toBe('just now');
  });

  it('should return minutes for recent times', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const result = formatRelativeTime(fiveMinAgo);
    expect(result).toBe('5m ago');
  });

  it('should return hours for longer times', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeTime(twoHoursAgo);
    expect(result).toBe('2h ago');
  });

  it('should return days for old times', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeTime(threeDaysAgo);
    expect(result).toBe('3 days ago');
  });

  it('should return "1 day ago" for singular', () => {
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeTime(oneDayAgo);
    expect(result).toBe('1 day ago');
  });
});

// ── Manifest operations ──────────────────────────────────────────────────

describe('readSessionManifest', () => {
  it('should return null when manifest does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const result = readSessionManifest('/test/my-project');
    expect(result).toBeNull();
  });

  it('should parse valid manifest', () => {
    const manifest: SessionManifest = {
      version: 1,
      project: 'my-project',
      sessions: [
        {
          id: 'auth-refactor',
          branch: 'session/auth-refactor',
          worktree: '/test/my-project-sessions/auth-refactor',
          startedAt: '2026-01-17T10:30:00Z',
          goals: ['Refactor auth'],
          status: 'active',
        },
      ],
    };

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(manifest));

    const result = readSessionManifest('/test/my-project');
    expect(result).toEqual(manifest);
  });

  it('should return null for corrupted JSON', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('not valid json {{{');

    const result = readSessionManifest('/test/my-project');
    expect(result).toBeNull();
  });
});

describe('writeSessionManifest', () => {
  it('should write manifest to correct path', () => {
    const manifest: SessionManifest = {
      version: 1,
      project: 'my-project',
      sessions: [],
    };

    writeSessionManifest('/test/my-project', manifest);

    expect(writeFileSync).toHaveBeenCalledWith(
      getManifestPath('/test/my-project'),
      JSON.stringify(manifest, null, 2) + '\n',
      'utf-8'
    );
  });
});

describe('addSessionToManifest', () => {
  it('should create new manifest and add session when none exists', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const session: SessionEntry = {
      id: 'test-session',
      branch: 'session/test-session',
      worktree: '/test/my-project-sessions/test-session',
      startedAt: '2026-01-17T10:30:00Z',
      goals: ['Test goal'],
      status: 'active',
    };

    const result = addSessionToManifest('/test/my-project', session);

    expect(result.project).toBe('my-project');
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].id).toBe('test-session');
    expect(writeFileSync).toHaveBeenCalled();
  });

  it('should add session to existing manifest', () => {
    const existingManifest: SessionManifest = {
      version: 1,
      project: 'my-project',
      sessions: [
        {
          id: 'existing',
          branch: 'session/existing',
          worktree: '/test/my-project-sessions/existing',
          startedAt: '2026-01-17T10:30:00Z',
          goals: [],
          status: 'active',
        },
      ],
    };

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(existingManifest));

    const session: SessionEntry = {
      id: 'new-session',
      branch: 'session/new-session',
      worktree: '/test/my-project-sessions/new-session',
      startedAt: '2026-01-17T11:00:00Z',
      goals: ['New goal'],
      status: 'active',
    };

    const result = addSessionToManifest('/test/my-project', session);

    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[1].id).toBe('new-session');
  });
});

describe('removeSessionFromManifest', () => {
  it('should return null when no manifest exists', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = removeSessionFromManifest('/test/my-project', 'test');
    expect(result).toBeNull();
  });

  it('should remove session by ID', () => {
    const manifest: SessionManifest = {
      version: 1,
      project: 'my-project',
      sessions: [
        {
          id: 'keep-me',
          branch: 'session/keep-me',
          worktree: '/test/my-project-sessions/keep-me',
          startedAt: '2026-01-17T10:30:00Z',
          goals: [],
          status: 'active',
        },
        {
          id: 'remove-me',
          branch: 'session/remove-me',
          worktree: '/test/my-project-sessions/remove-me',
          startedAt: '2026-01-17T11:00:00Z',
          goals: [],
          status: 'active',
        },
      ],
    };

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(manifest));

    const result = removeSessionFromManifest('/test/my-project', 'remove-me');

    expect(result).not.toBeNull();
    expect(result!.sessions).toHaveLength(1);
    expect(result!.sessions[0].id).toBe('keep-me');
  });
});

// ── Env file helpers ─────────────────────────────────────────────────────

describe('copyEnvFiles', () => {
  it('should copy existing env files', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = String(path);
      return p.endsWith('.env') || p.endsWith('.env.local');
    });

    const result = copyEnvFiles('/source', '/dest');

    expect(result).toEqual(['.env', '.env.local']);
    expect(copyFileSync).toHaveBeenCalledTimes(2);
  });

  it('should return empty array when no env files exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = copyEnvFiles('/source', '/dest');
    expect(result).toEqual([]);
    expect(copyFileSync).not.toHaveBeenCalled();
  });
});

// ── Git helper tests ─────────────────────────────────────────────────────

describe('runGitCommand', () => {
  it('should run git command and return output', async () => {
    vi.mocked(spawn).mockImplementation((() => {
      return createMockProcess(0, 'output text', '');
    }) as typeof spawn);

    const result = await runGitCommand(['status']);
    expect(result.success).toBe(true);
    expect(result.output).toBe('output text');
  });

  it('should handle failure', async () => {
    vi.mocked(spawn).mockImplementation((() => {
      return createMockProcess(1, '', 'error message');
    }) as typeof spawn);

    const result = await runGitCommand(['bad-command']);
    expect(result.success).toBe(false);
    expect(result.error).toBe('error message');
  });
});

describe('isGitClean', () => {
  it('should return true when working directory is clean', async () => {
    vi.mocked(spawn).mockImplementation((() => {
      return createMockProcess(0, '', '');
    }) as typeof spawn);

    const result = await isGitClean();
    expect(result).toBe(true);
  });

  it('should return false when there are changes', async () => {
    vi.mocked(spawn).mockImplementation((() => {
      return createMockProcess(0, ' M src/file.ts', '');
    }) as typeof spawn);

    const result = await isGitClean();
    expect(result).toBe(false);
  });
});

describe('isInsideWorktree', () => {
  it('should return false for main working tree', async () => {
    let callCount = 0;
    vi.mocked(spawn).mockImplementation((() => {
      callCount++;
      if (callCount === 1) {
        return createMockProcess(0, 'true', ''); // is-inside-work-tree
      }
      return createMockProcess(0, '.git', ''); // git-dir (main tree)
    }) as typeof spawn);

    const result = await isInsideWorktree();
    expect(result).toBe(false);
  });

  it('should return true for linked worktree', async () => {
    let callCount = 0;
    vi.mocked(spawn).mockImplementation((() => {
      callCount++;
      if (callCount === 1) {
        return createMockProcess(0, 'true', '');
      }
      return createMockProcess(0, '/project/.git/worktrees/my-session', '');
    }) as typeof spawn);

    const result = await isInsideWorktree();
    expect(result).toBe(true);
  });
});

describe('listGitWorktrees', () => {
  it('should parse porcelain worktree list', async () => {
    const porcelainOutput = `worktree /users/dev/my-project
branch refs/heads/main

worktree /users/dev/my-project-sessions/auth
branch refs/heads/session/auth
`;
    vi.mocked(spawn).mockImplementation((() => {
      return createMockProcess(0, porcelainOutput, '');
    }) as typeof spawn);

    const result = await listGitWorktrees();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ path: '/users/dev/my-project', branch: 'main', bare: false });
    expect(result[1]).toEqual({ path: '/users/dev/my-project-sessions/auth', branch: 'session/auth', bare: false });
  });

  it('should return empty array on failure', async () => {
    vi.mocked(spawn).mockImplementation((() => {
      return createMockProcess(1, '', 'not a git repo');
    }) as typeof spawn);

    const result = await listGitWorktrees();
    expect(result).toEqual([]);
  });
});

describe('getCurrentBranch', () => {
  it('should return current branch name', async () => {
    vi.mocked(spawn).mockImplementation((() => {
      return createMockProcess(0, 'main', '');
    }) as typeof spawn);

    const result = await getCurrentBranch();
    expect(result).toBe('main');
  });

  it('should return "main" as fallback', async () => {
    vi.mocked(spawn).mockImplementation((() => {
      return createMockProcess(1, '', 'error');
    }) as typeof spawn);

    const result = await getCurrentBranch();
    expect(result).toBe('main');
  });
});

describe('getCommitsAhead', () => {
  it('should return commit count', async () => {
    vi.mocked(spawn).mockImplementation((() => {
      return createMockProcess(0, '5', '');
    }) as typeof spawn);

    const result = await getCommitsAhead('main', 'session/auth');
    expect(result).toBe(5);
  });

  it('should return 0 on failure', async () => {
    vi.mocked(spawn).mockImplementation((() => {
      return createMockProcess(1, '', 'error');
    }) as typeof spawn);

    const result = await getCommitsAhead('main', 'session/auth');
    expect(result).toBe(0);
  });
});

// ── parallelCreate tests ─────────────────────────────────────────────────

describe('parallelCreate', () => {
  it('should reject when inside a worktree', async () => {
    // isInsideWorktree needs two git calls
    let callCount = 0;
    vi.mocked(spawn).mockImplementation((() => {
      callCount++;
      if (callCount === 1) return createMockProcess(0, 'true', '');
      return createMockProcess(0, '/project/.git/worktrees/x', '');
    }) as typeof spawn);

    await parallelCreate('test');
    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining('already inside a parallel session')
    );
  });

  it('should reject duplicate session names', async () => {
    // Not inside worktree (2 git calls), then check manifest
    let callCount = 0;
    vi.mocked(spawn).mockImplementation((() => {
      callCount++;
      if (callCount === 1) return createMockProcess(0, 'true', '');
      return createMockProcess(0, '.git', ''); // main tree, not worktree
    }) as typeof spawn);

    const manifest: SessionManifest = {
      version: 1,
      project: 'my-project',
      sessions: [{ id: 'test', branch: 'session/test', worktree: '/path', startedAt: '', goals: [], status: 'active' }],
    };
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(manifest));

    await parallelCreate('test');
    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining("'test' already exists")
    );
  });

  it('should reject when worktree path already exists', async () => {
    // Not inside worktree
    let callCount = 0;
    vi.mocked(spawn).mockImplementation((() => {
      callCount++;
      if (callCount === 1) return createMockProcess(0, 'true', '');
      return createMockProcess(0, '.git', '');
    }) as typeof spawn);

    // No existing session in manifest, but worktree path exists
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('.manifest.json')) return false; // no manifest
      if (p.includes('-sessions/new-session')) return true; // worktree path exists
      return false;
    });

    await parallelCreate('new-session');
    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Worktree path already exists')
    );
  });

  it('should abort when git is dirty and user declines in interactive mode', async () => {
    // Not inside worktree
    let gitCallCount = 0;
    vi.mocked(spawn).mockImplementation((() => {
      gitCallCount++;
      if (gitCallCount === 1) return createMockProcess(0, 'true', '');
      if (gitCallCount === 2) return createMockProcess(0, '.git', '');
      if (gitCallCount === 3) return createMockProcess(0, ' M file.ts', ''); // dirty
      return createMockProcess(0, '', '');
    }) as typeof spawn);

    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(p.confirm).mockResolvedValue(false);

    await parallelCreate('test');
    expect(p.log.info).toHaveBeenCalledWith(
      expect.stringContaining('Cancelled')
    );
  });

  it('should abort in non-interactive mode when git is dirty', async () => {
    vi.mocked(isInteractive).mockReturnValue(false);

    let gitCallCount = 0;
    vi.mocked(spawn).mockImplementation((() => {
      gitCallCount++;
      if (gitCallCount === 1) return createMockProcess(0, 'true', '');
      if (gitCallCount === 2) return createMockProcess(0, '.git', '');
      if (gitCallCount === 3) return createMockProcess(0, ' M file.ts', ''); // dirty
      return createMockProcess(0, '', '');
    }) as typeof spawn);

    vi.mocked(existsSync).mockReturnValue(false);

    await parallelCreate('test');
    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining('not clean')
    );
  });

  it('should create worktree and register session on success', async () => {
    let gitCallCount = 0;
    vi.mocked(spawn).mockImplementation((() => {
      gitCallCount++;
      // isInsideWorktree calls
      if (gitCallCount === 1) return createMockProcess(0, 'true', '');
      if (gitCallCount === 2) return createMockProcess(0, '.git', '');
      // isGitClean
      if (gitCallCount === 3) return createMockProcess(0, '', '');
      // branch check (does not exist)
      if (gitCallCount === 4) return createMockProcess(1, '', 'not found');
      // worktree add
      if (gitCallCount === 5) return createMockProcess(0, 'Preparing worktree', '');
      return createMockProcess(0, '', '');
    }) as typeof spawn);

    vi.mocked(existsSync).mockReturnValue(false);

    await parallelCreate('auth-refactor', ['Refactor auth module']);

    expect(p.log.success).toHaveBeenCalledWith(
      expect.stringContaining('Worktree created')
    );
    expect(p.log.success).toHaveBeenCalledWith(
      expect.stringContaining('Session registered')
    );
    expect(writeFileSync).toHaveBeenCalled();
  });

  it('should reject existing branch names', async () => {
    let gitCallCount = 0;
    vi.mocked(spawn).mockImplementation((() => {
      gitCallCount++;
      if (gitCallCount === 1) return createMockProcess(0, 'true', '');
      if (gitCallCount === 2) return createMockProcess(0, '.git', '');
      if (gitCallCount === 3) return createMockProcess(0, '', ''); // clean
      if (gitCallCount === 4) return createMockProcess(0, 'abc123', ''); // branch exists!
      return createMockProcess(0, '', '');
    }) as typeof spawn);

    vi.mocked(existsSync).mockReturnValue(false);

    await parallelCreate('existing-branch');
    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining('already exists')
    );
  });
});

// ── parallelStatus tests ─────────────────────────────────────────────────

describe('parallelStatus', () => {
  it('should show no sessions message when manifest is empty', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await parallelStatus();
    expect(p.log.info).toHaveBeenCalledWith(
      expect.stringContaining('No active parallel sessions')
    );
  });

  it('should display active sessions', async () => {
    const manifest: SessionManifest = {
      version: 1,
      project: 'my-project',
      sessions: [
        {
          id: 'auth-refactor',
          branch: 'session/auth-refactor',
          worktree: '/test/my-project-sessions/auth-refactor',
          startedAt: new Date().toISOString(),
          goals: ['Refactor auth'],
          status: 'active',
        },
      ],
    };

    vi.mocked(existsSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('.manifest.json')) return true;
      if (p.includes('auth-refactor')) return true;
      return false;
    });
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(manifest));

    // Mock git worktree list and status
    let gitCallCount = 0;
    vi.mocked(spawn).mockImplementation((() => {
      gitCallCount++;
      if (gitCallCount === 1) {
        // worktree list
        return createMockProcess(0, `worktree /test/my-project
branch refs/heads/main

worktree /test/my-project-sessions/auth-refactor
branch refs/heads/session/auth-refactor
`, '');
      }
      if (gitCallCount === 2) return createMockProcess(0, '', ''); // isGitClean
      if (gitCallCount === 3) return createMockProcess(0, 'main', ''); // getCurrentBranch
      return createMockProcess(0, '', '');
    }) as typeof spawn);

    await parallelStatus();
    expect(p.log.message).toHaveBeenCalledWith(
      expect.stringContaining('auth-refactor')
    );
  });

  it('should flag orphaned sessions', async () => {
    const manifest: SessionManifest = {
      version: 1,
      project: 'my-project',
      sessions: [
        {
          id: 'orphaned',
          branch: 'session/orphaned',
          worktree: '/test/my-project-sessions/orphaned',
          startedAt: new Date().toISOString(),
          goals: [],
          status: 'active',
        },
      ],
    };

    vi.mocked(existsSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('.manifest.json')) return true;
      return false; // worktree does not exist
    });
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(manifest));

    // No worktrees found
    let gitCallCount = 0;
    vi.mocked(spawn).mockImplementation((() => {
      gitCallCount++;
      if (gitCallCount === 1) return createMockProcess(0, `worktree /test/my-project
branch refs/heads/main
`, '');
      if (gitCallCount === 2) return createMockProcess(0, '', '');
      if (gitCallCount === 3) return createMockProcess(0, 'main', '');
      return createMockProcess(0, '', '');
    }) as typeof spawn);

    await parallelStatus();
    expect(p.log.message).toHaveBeenCalledWith(
      expect.stringContaining('orphaned')
    );
  });
});

// ── parallelCleanup tests ────────────────────────────────────────────────

describe('parallelCleanup', () => {
  it('should report nothing to clean when no manifest', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await parallelCleanup();
    expect(p.log.info).toHaveBeenCalledWith(
      expect.stringContaining('No sessions in manifest')
    );
  });

  it('should report clean when no orphans', async () => {
    const manifest: SessionManifest = {
      version: 1,
      project: 'my-project',
      sessions: [
        {
          id: 'active',
          branch: 'session/active',
          worktree: '/test/my-project-sessions/active',
          startedAt: '',
          goals: [],
          status: 'active',
        },
      ],
    };

    vi.mocked(existsSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('.manifest.json')) return true;
      if (p.includes('active')) return true;
      return false;
    });
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(manifest));

    // Worktree exists
    vi.mocked(spawn).mockImplementation((() => {
      return createMockProcess(0, `worktree /test/my-project-sessions/active
branch refs/heads/session/active
`, '');
    }) as typeof spawn);

    await parallelCleanup();
    expect(p.log.success).toHaveBeenCalledWith(
      expect.stringContaining('No orphaned sessions')
    );
  });

  it('should clean up orphaned sessions with --force', async () => {
    const manifest: SessionManifest = {
      version: 1,
      project: 'my-project',
      sessions: [
        {
          id: 'orphaned',
          branch: 'session/orphaned',
          worktree: '/test/my-project-sessions/orphaned',
          startedAt: '',
          goals: [],
          status: 'active',
        },
      ],
    };

    // existsSync calls: first for manifest read, then for worktree check
    let existsCallCount = 0;
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('.manifest.json')) return true;
      if (p.includes('orphaned')) return false; // worktree missing
      return false;
    });
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(manifest));

    // Git calls: worktree list (no worktrees found), branch delete
    let gitCallCount = 0;
    vi.mocked(spawn).mockImplementation((() => {
      gitCallCount++;
      if (gitCallCount === 1) {
        return createMockProcess(0, `worktree /test/my-project
branch refs/heads/main
`, '');
      }
      // branch -D
      return createMockProcess(0, '', '');
    }) as typeof spawn);

    await parallelCleanup({ force: true });
    expect(p.log.success).toHaveBeenCalledWith(
      expect.stringContaining("Removed session 'orphaned'")
    );
  });
});

// ── parallelRemove tests ─────────────────────────────────────────────────

describe('parallelRemove', () => {
  it('should error when no manifest found', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await parallelRemove('test');
    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining('No session manifest')
    );
  });

  it('should error when session not found', async () => {
    const manifest: SessionManifest = {
      version: 1,
      project: 'my-project',
      sessions: [],
    };
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(manifest));

    await parallelRemove('nonexistent');
    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining("'nonexistent' not found")
    );
  });

  it('should handle missing worktree gracefully', async () => {
    const manifest: SessionManifest = {
      version: 1,
      project: 'my-project',
      sessions: [
        {
          id: 'gone',
          branch: 'session/gone',
          worktree: '/test/my-project-sessions/gone',
          startedAt: '',
          goals: [],
          status: 'active',
        },
      ],
    };

    vi.mocked(existsSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('.manifest.json')) return true;
      if (p.includes('my-project-sessions/gone')) return false;
      return false;
    });
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(manifest));

    await parallelRemove('gone');
    expect(p.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('no longer exists')
    );
    expect(p.log.success).toHaveBeenCalledWith(
      expect.stringContaining("Removed 'gone' from manifest")
    );
  });

  it('should block removal of dirty worktree in non-interactive mode', async () => {
    vi.mocked(isInteractive).mockReturnValue(false);

    const manifest: SessionManifest = {
      version: 1,
      project: 'my-project',
      sessions: [
        {
          id: 'dirty',
          branch: 'session/dirty',
          worktree: '/test/my-project-sessions/dirty',
          startedAt: '',
          goals: [],
          status: 'active',
        },
      ],
    };

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(manifest));

    // git status shows dirty
    vi.mocked(spawn).mockImplementation((() => {
      return createMockProcess(0, ' M file.ts', '');
    }) as typeof spawn);

    await parallelRemove('dirty');
    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Cannot remove a session with uncommitted changes')
    );
  });

  it('should use "keep" strategy as default in non-interactive mode', async () => {
    vi.mocked(isInteractive).mockReturnValue(false);

    const manifest: SessionManifest = {
      version: 1,
      project: 'my-project',
      sessions: [
        {
          id: 'clean-session',
          branch: 'session/clean-session',
          worktree: '/test/my-project-sessions/clean-session',
          startedAt: '',
          goals: [],
          status: 'active',
        },
      ],
    };

    vi.mocked(existsSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('.manifest.json')) return true;
      if (p.includes('clean-session')) return true;
      return false;
    });
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(manifest));
    vi.mocked(readdirSync).mockReturnValue([]);

    // Git calls: status (clean), push, worktree remove
    let gitCallCount = 0;
    vi.mocked(spawn).mockImplementation((() => {
      gitCallCount++;
      return createMockProcess(0, '', '');
    }) as typeof spawn);

    await parallelRemove('clean-session');
    // Should have pushed and removed (keep strategy)
    expect(p.log.success).toHaveBeenCalledWith(
      expect.stringContaining("'clean-session' removed from manifest")
    );
  });
});

// ── Main dispatcher tests ────────────────────────────────────────────────

describe('parallel (dispatcher)', () => {
  it('should show help for unknown subcommand', async () => {
    // Mock console.log for help output
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parallel('unknown', []);
    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Unknown subcommand')
    );

    consoleSpy.mockRestore();
  });

  it('should show help when no subcommand given', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parallel('', []);
    // No error for empty subcommand, just help
    consoleSpy.mockRestore();
  });

  it('should require name for create subcommand', async () => {
    await parallel('create', []);
    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Session name is required')
    );
  });

  it('should require name for remove subcommand', async () => {
    await parallel('remove', []);
    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Session name is required')
    );
  });

  it('should validate session name format', async () => {
    await parallel('create', ['invalid name!']);
    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining('letters, numbers, hyphens, and underscores')
    );
  });

  it('should accept valid session names', async () => {
    // Will fail at worktree check, but name validation should pass
    let callCount = 0;
    vi.mocked(spawn).mockImplementation((() => {
      callCount++;
      if (callCount === 1) return createMockProcess(0, 'true', '');
      return createMockProcess(0, '/project/.git/worktrees/x', ''); // inside worktree
    }) as typeof spawn);

    await parallel('create', ['valid-name_123']);
    // Should get past name validation and fail on worktree check instead
    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining('already inside a parallel session')
    );
  });
});
