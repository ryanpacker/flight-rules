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
    red: vi.fn((str) => str),
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
import { ralph, RalphOptions, parseDiscoveryResponse, buildExecutionPrompt, TaskGroupPlan, formatTimestamp } from '../../src/commands/ralph.js';

/**
 * Wrap plain text as stream-json output that runClaudeWithPrompt can reassemble.
 * Each line of text becomes a content_block_delta event, followed by content_block_stop.
 */
function wrapAsStreamJson(text: string): string {
  if (!text) return '';
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  return [
    `{"type":"content_block_delta","delta":{"text":"${escaped}"}}`,
    '{"type":"content_block_stop"}',
    '',
  ].join('\n');
}

// Helper to create a mock spawn process
// stdout should be plain text — it will be wrapped as stream-json automatically
function createMockProcess(
  exitCode: number = 0,
  stdout: string = '',
  stderr: string = '',
  { rawStreamJson }: { rawStreamJson?: boolean } = {}
) {
  const streamStdout = stdout ? (rawStreamJson ? stdout : wrapAsStreamJson(stdout)) : '';
  return {
    stdout: {
      on: vi.fn((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data' && streamStdout) {
          process.nextTick(() => callback(Buffer.from(streamStdout)));
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

describe('parseDiscoveryResponse', () => {
  it('should parse valid discovery output with task groups', () => {
    const output = `Some preamble text...

<ralph-discovery>
TASK_GROUP|1.1|Project Setup|docs/implementation/1-setup/1.1-init.md|1-setup
TASK|1.1.1|Create config file|planned
TASK|1.1.2|Add validation|in_progress
TASK_GROUP|2.1|CLI Core|docs/implementation/2-cli/2.1-commands.md|2-cli
TASK|2.1.3|Add help output|planned
</ralph-discovery>

Some trailing text...`;

    const result = parseDiscoveryResponse(output);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);

    expect(result![0]).toEqual({
      id: '1.1',
      title: 'Project Setup',
      filePath: 'docs/implementation/1-setup/1.1-init.md',
      area: '1-setup',
      incompleteTasks: [
        { id: '1.1.1', title: 'Create config file', status: 'planned' },
        { id: '1.1.2', title: 'Add validation', status: 'in_progress' },
      ],
    });

    expect(result![1]).toEqual({
      id: '2.1',
      title: 'CLI Core',
      filePath: 'docs/implementation/2-cli/2.1-commands.md',
      area: '2-cli',
      incompleteTasks: [
        { id: '2.1.3', title: 'Add help output', status: 'planned' },
      ],
    });
  });

  it('should return empty array for ALL_COMPLETE', () => {
    const output = `<ralph-discovery>
ALL_COMPLETE
</ralph-discovery>`;

    const result = parseDiscoveryResponse(output);
    expect(result).toEqual([]);
  });

  it('should return null when tags are not found', () => {
    const output = 'No discovery tags here, just some random text.';

    const result = parseDiscoveryResponse(output);
    expect(result).toBeNull();
  });

  it('should handle empty content inside tags', () => {
    const output = `<ralph-discovery>
</ralph-discovery>`;

    const result = parseDiscoveryResponse(output);
    expect(result).not.toBeNull();
    expect(result).toEqual([]);
  });

  it('should skip malformed lines gracefully', () => {
    const output = `<ralph-discovery>
TASK_GROUP|1.1|Valid Group|path/to/file.md|1-area
TASK|1.1.1|Valid task|planned
MALFORMED_LINE
TASK|too|few
TASK_GROUP|incomplete
TASK|1.1.2|Another valid task|blocked
</ralph-discovery>`;

    const result = parseDiscoveryResponse(output);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].incompleteTasks).toHaveLength(2);
    expect(result![0].incompleteTasks[0].id).toBe('1.1.1');
    expect(result![0].incompleteTasks[1].id).toBe('1.1.2');
  });

  it('should handle response wrapped in code fences', () => {
    const output = `Here's the discovery result:

\`\`\`
<ralph-discovery>
TASK_GROUP|1.1|Setup|docs/impl/1-setup/1.1.md|1-setup
TASK|1.1.1|Init project|planned
</ralph-discovery>
\`\`\``;

    const result = parseDiscoveryResponse(output);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe('1.1');
  });

  it('should ignore TASK lines before any TASK_GROUP', () => {
    const output = `<ralph-discovery>
TASK|orphan.1|Orphaned task|planned
TASK_GROUP|1.1|Real Group|path.md|area
TASK|1.1.1|Real task|planned
</ralph-discovery>`;

    const result = parseDiscoveryResponse(output);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].incompleteTasks).toHaveLength(1);
  });
});

describe('buildExecutionPrompt', () => {
  const template = `Task Group: {{TASK_GROUP_ID}} — {{TASK_GROUP_TITLE}}
File: {{TASK_GROUP_FILE_PATH}}
Tasks:
{{INCOMPLETE_TASKS_LIST}}
End of {{TASK_GROUP_ID}}.`;

  const taskGroup: TaskGroupPlan = {
    id: '2.3',
    title: 'Authentication',
    filePath: 'docs/implementation/2-cli/2.3-auth.md',
    area: '2-cli',
    incompleteTasks: [
      { id: '2.3.1', title: 'Add login endpoint', status: 'planned' },
      { id: '2.3.2', title: 'Add token refresh', status: 'in_progress' },
    ],
  };

  it('should replace all placeholders', () => {
    const result = buildExecutionPrompt(template, taskGroup);

    expect(result).toContain('Task Group: 2.3 — Authentication');
    expect(result).toContain('File: docs/implementation/2-cli/2.3-auth.md');
    expect(result).toContain('End of 2.3.');
  });

  it('should render incomplete tasks as markdown bullet points', () => {
    const result = buildExecutionPrompt(template, taskGroup);

    expect(result).toContain('- **2.3.1**: Add login endpoint (planned)');
    expect(result).toContain('- **2.3.2**: Add token refresh (in_progress)');
  });

  it('should replace multiple occurrences of the same placeholder', () => {
    const result = buildExecutionPrompt(template, taskGroup);

    // {{TASK_GROUP_ID}} appears twice in template
    const matches = result.match(/2\.3/g);
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle single task', () => {
    const singleTaskGroup: TaskGroupPlan = {
      id: '1.1',
      title: 'Init',
      filePath: 'path.md',
      area: '1-area',
      incompleteTasks: [{ id: '1.1.1', title: 'Single task', status: 'planned' }],
    };

    const result = buildExecutionPrompt(template, singleTaskGroup);
    expect(result).toContain('- **1.1.1**: Single task (planned)');
  });
});

describe('ralph command', () => {
  const mockCwd = '/mock/project';
  const mockDiscoveryPath = join(mockCwd, '.flight-rules', 'prompts', 'ralph-discovery.md');
  const mockExecutionPath = join(mockCwd, '.flight-rules', 'prompts', 'ralph-execution.md');
  const mockDiscoveryContent = '# Discovery prompt...';
  const mockExecutionContent = '# Execution template with {{TASK_GROUP_ID}} and {{TASK_GROUP_TITLE}} and {{TASK_GROUP_FILE_PATH}} and {{INCOMPLETE_TASKS_LIST}}';

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

    // Default: both prompt files exist
    vi.mocked(existsSync).mockReturnValue(true);

    // Default: prompt content — return different content based on path
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (String(path).includes('ralph-discovery')) return mockDiscoveryContent;
      if (String(path).includes('ralph-execution')) return mockExecutionContent;
      return '';
    });

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

    it('should error if discovery prompt file is missing', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (String(path).includes('ralph-discovery')) return false;
        return true;
      });

      await ralph(defaultOptions);

      expect(p.log.error).toHaveBeenCalledWith('Ralph discovery prompt file not found.');
      expect(p.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Expected at:')
      );
    });

    it('should error if execution prompt file is missing', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (String(path).includes('ralph-execution')) return false;
        return true;
      });

      await ralph(defaultOptions);

      expect(p.log.error).toHaveBeenCalledWith('Ralph execution prompt file not found.');
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
    it('should show two-phase info without executing', async () => {
      // First spawn call is for claude --version check, which succeeds
      vi.mocked(spawn).mockImplementationOnce(() => {
        return createMockProcess(0) as any;
      });

      await ralph({ ...defaultOptions, dryRun: true });

      expect(p.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Dry run mode')
      );
      expect(p.log.message).toHaveBeenCalledWith(
        expect.stringContaining('Discovery prompt:')
      );
      expect(p.log.message).toHaveBeenCalledWith(
        expect.stringContaining('Execution prompt:')
      );
      expect(p.log.message).toHaveBeenCalledWith(
        expect.stringContaining('Max task groups:')
      );
      expect(p.log.message).toHaveBeenCalledWith(
        expect.stringContaining('Phase 1: Discovery')
      );
      expect(p.log.message).toHaveBeenCalledWith(
        expect.stringContaining('Phase 2: Execution')
      );

      // Should only spawn once for --version check, not for actual execution
      expect(spawn).toHaveBeenCalledTimes(1);
      expect(spawn).toHaveBeenCalledWith('claude', ['--version'], expect.any(Object));
    });
  });

  describe('two-phase flow', () => {
    it('should run discovery then execution for each task group', async () => {
      const discoveryOutput = `<ralph-discovery>
TASK_GROUP|1.1|Setup|docs/impl/1-setup/1.1.md|1-setup
TASK|1.1.1|Init|planned
TASK_GROUP|2.1|CLI|docs/impl/2-cli/2.1.md|2-cli
TASK|2.1.1|Commands|planned
</ralph-discovery>`;

      // version check, discovery, execution 1, execution 2
      vi.mocked(spawn)
        .mockImplementationOnce(() => createMockProcess(0) as any)           // --version
        .mockImplementationOnce(() => createMockProcess(0, discoveryOutput) as any) // discovery
        .mockImplementationOnce(() => createMockProcess(0) as any)           // exec 1
        .mockImplementationOnce(() => createMockProcess(0) as any);          // exec 2

      await ralph({ ...defaultOptions, maxIterations: 10 });

      // version check + discovery + 2 executions = 4
      expect(spawn).toHaveBeenCalledTimes(4);
      expect(p.log.success).toHaveBeenCalledWith(expect.stringContaining('1.1 complete'));
      expect(p.log.success).toHaveBeenCalledWith(expect.stringContaining('2.1 complete'));
    });

    it('should abort on unparseable discovery response', async () => {
      const badOutput = 'No tags here, just rambling...';

      vi.mocked(spawn)
        .mockImplementationOnce(() => createMockProcess(0) as any)           // --version
        .mockImplementationOnce(() => createMockProcess(0, badOutput) as any); // discovery

      await ralph(defaultOptions);

      expect(p.log.error).toHaveBeenCalledWith(
        expect.stringContaining('Could not parse discovery response')
      );
      expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('aborted'));
      // Only version check + discovery = 2
      expect(spawn).toHaveBeenCalledTimes(2);
    });

    it('should handle ALL_COMPLETE early exit', async () => {
      const completeOutput = `<ralph-discovery>
ALL_COMPLETE
</ralph-discovery>`;

      vi.mocked(spawn)
        .mockImplementationOnce(() => createMockProcess(0) as any)             // --version
        .mockImplementationOnce(() => createMockProcess(0, completeOutput) as any); // discovery

      await ralph(defaultOptions);

      expect(p.log.success).toHaveBeenCalledWith(
        expect.stringContaining('All task groups complete!')
      );
      // Only version check + discovery = 2
      expect(spawn).toHaveBeenCalledTimes(2);
    });

    it('should limit task groups executed by --max-iterations', async () => {
      const discoveryOutput = `<ralph-discovery>
TASK_GROUP|1.1|Group A|path-a.md|1-area
TASK|1.1.1|Task A|planned
TASK_GROUP|2.1|Group B|path-b.md|2-area
TASK|2.1.1|Task B|planned
TASK_GROUP|3.1|Group C|path-c.md|3-area
TASK|3.1.1|Task C|planned
</ralph-discovery>`;

      vi.mocked(spawn)
        .mockImplementationOnce(() => createMockProcess(0) as any)           // --version
        .mockImplementationOnce(() => createMockProcess(0, discoveryOutput) as any) // discovery
        .mockImplementationOnce(() => createMockProcess(0) as any)           // exec 1
        .mockImplementationOnce(() => createMockProcess(0) as any);          // exec 2

      await ralph({ ...defaultOptions, maxIterations: 2 });

      // version + discovery + 2 executions = 4 (not 5, which would be all 3)
      expect(spawn).toHaveBeenCalledTimes(4);
      expect(p.log.info).toHaveBeenCalledWith(
        expect.stringContaining('1 task group(s) remaining')
      );
    });

    it('should continue to next task group despite errors', async () => {
      const discoveryOutput = `<ralph-discovery>
TASK_GROUP|1.1|Group A|path-a.md|1-area
TASK|1.1.1|Task A|planned
TASK_GROUP|2.1|Group B|path-b.md|2-area
TASK|2.1.1|Task B|planned
</ralph-discovery>`;

      vi.mocked(spawn)
        .mockImplementationOnce(() => createMockProcess(0) as any)           // --version
        .mockImplementationOnce(() => createMockProcess(0, discoveryOutput) as any) // discovery
        .mockImplementationOnce(() => {                                       // exec 1 — errors
          const mockProcess = createMockProcess(0);
          mockProcess.on = vi.fn((event: string, callback: any) => {
            if (event === 'error') {
              process.nextTick(() => callback(new Error('Test error')));
            }
          });
          return mockProcess as any;
        })
        .mockImplementationOnce(() => createMockProcess(0) as any);          // exec 2 — succeeds

      await ralph({ ...defaultOptions, maxIterations: 10 });

      // Should still attempt both executions
      expect(spawn).toHaveBeenCalledTimes(4);
      expect(p.log.error).toHaveBeenCalledWith(
        expect.stringContaining('Error executing task group 1.1')
      );
      expect(p.log.success).toHaveBeenCalledWith(
        expect.stringContaining('2.1 complete')
      );
    });

    it('should flush lineBuffer when stream ends without trailing newline', async () => {
      // Simulate stream output where the last JSON line has no trailing newline,
      // so it stays in lineBuffer and must be flushed on close
      const discoveryText = `<ralph-discovery>\nTASK_GROUP|1.1|Setup|docs/impl/1.1.md|1-setup\nTASK|1.1.1|Init|planned\n</ralph-discovery>`;
      const escaped = discoveryText.replace(/\n/g, '\\n');
      // No trailing newline — the last line stays in lineBuffer
      const streamOutput = `{"type":"content_block_delta","delta":{"text":"${escaped}"}}`;

      vi.mocked(spawn)
        .mockImplementationOnce(() => createMockProcess(0) as any)           // --version
        .mockImplementationOnce(() => createMockProcess(0, streamOutput, '', { rawStreamJson: true }) as any) // discovery
        .mockImplementationOnce(() => createMockProcess(0) as any);          // exec 1

      await ralph({ ...defaultOptions, maxIterations: 10 });

      // Should parse the task group, not report ALL_COMPLETE
      expect(p.log.success).toHaveBeenCalledWith(expect.stringContaining('1.1 complete'));
      expect(p.log.success).not.toHaveBeenCalledWith(expect.stringContaining('All task groups complete!'));
    });

    it('should fall back to result event text when streaming deltas are empty', async () => {
      const discoveryText = `<ralph-discovery>\nTASK_GROUP|1.1|Setup|docs/impl/1.1.md|1-setup\nTASK|1.1.1|Init|planned\n</ralph-discovery>`;
      const escapedResult = discoveryText.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
      // Only a result event, no content_block_delta events
      const streamOutput = [
        `{"type":"result","subtype":"success","result":"${escapedResult}"}`,
        '',
      ].join('\n');

      vi.mocked(spawn)
        .mockImplementationOnce(() => createMockProcess(0) as any)           // --version
        .mockImplementationOnce(() => createMockProcess(0, streamOutput, '', { rawStreamJson: true }) as any) // discovery
        .mockImplementationOnce(() => createMockProcess(0) as any);          // exec 1

      await ralph({ ...defaultOptions, maxIterations: 10 });

      // Should parse the task group from the result fallback
      expect(p.log.success).toHaveBeenCalledWith(expect.stringContaining('1.1 complete'));
      expect(p.log.success).not.toHaveBeenCalledWith(expect.stringContaining('All task groups complete!'));
    });

    it('should count non-zero exit codes as failures', async () => {
      const discoveryOutput = `<ralph-discovery>
TASK_GROUP|1.1|Group A|path-a.md|1-area
TASK|1.1.1|Task A|planned
</ralph-discovery>`;

      vi.mocked(spawn)
        .mockImplementationOnce(() => createMockProcess(0) as any)           // --version
        .mockImplementationOnce(() => createMockProcess(0, discoveryOutput) as any) // discovery
        .mockImplementationOnce(() => createMockProcess(1) as any);          // exec — non-zero exit

      await ralph(defaultOptions);

      expect(p.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('exited with code 1')
      );
      expect(p.log.info).toHaveBeenCalledWith(
        expect.stringContaining('0 completed, 1 failed')
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
      const completeOutput = `<ralph-discovery>
ALL_COMPLETE
</ralph-discovery>`;

      vi.mocked(spawn)
        .mockImplementationOnce(() => createMockProcess(0) as any)
        .mockImplementationOnce(() => createMockProcess(0, completeOutput) as any);

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
      const completeOutput = `<ralph-discovery>
ALL_COMPLETE
</ralph-discovery>`;

      // claude --version succeeds
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0) as any);

      // git status --porcelain returns clean
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0, '') as any);

      // git rev-parse --verify fails (branch doesn't exist)
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(1) as any);

      // git checkout -b succeeds
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0) as any);

      // discovery returns ALL_COMPLETE
      vi.mocked(spawn).mockImplementationOnce(() => createMockProcess(0, completeOutput) as any);

      await ralph({ ...defaultOptions, branch: 'new-branch' });

      expect(p.log.success).toHaveBeenCalledWith(
        expect.stringContaining('Switched to new branch: new-branch')
      );
    });
  });

  describe('verbose output formatting', () => {
    let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      stdoutWriteSpy.mockRestore();
    });

    it('should prepend timestamp to content block text in verbose mode', async () => {
      // Raw stream-json — the verbose tests need raw format to test the streaming display logic
      const streamOutput = [
        '{"type":"content_block_delta","delta":{"text":"<ralph-discovery>\\nALL_COMPLETE\\n</ralph-discovery>"}}',
        '{"type":"content_block_stop"}',
        '{"type":"content_block_delta","delta":{"text":"Hello world"}}',
        '{"type":"content_block_stop"}',
        '',
      ].join('\n');

      vi.mocked(spawn)
        .mockImplementationOnce(() => createMockProcess(0) as any)                     // --version
        .mockImplementationOnce(() => createMockProcess(0, streamOutput, '', { rawStreamJson: true }) as any); // discovery

      await ralph({ ...defaultOptions, verbose: true });

      const writes = stdoutWriteSpy.mock.calls.map(c => c[0]);
      // Should have a write that matches the timestamp pattern [HH:MM:SS]
      const hasTimestamp = writes.some(w => typeof w === 'string' && /^\[\d{2}:\d{2}:\d{2}\] $/.test(w));
      expect(hasTimestamp).toBe(true);
    });

    it('should add blank line between content blocks in verbose mode', async () => {
      const streamOutput = [
        '{"type":"content_block_delta","delta":{"text":"<ralph-discovery>\\nALL_COMPLETE\\n</ralph-discovery>"}}',
        '{"type":"content_block_stop"}',
        '{"type":"content_block_delta","delta":{"text":"Second block"}}',
        '{"type":"content_block_stop"}',
        '',
      ].join('\n');

      vi.mocked(spawn)
        .mockImplementationOnce(() => createMockProcess(0) as any)                     // --version
        .mockImplementationOnce(() => createMockProcess(0, streamOutput, '', { rawStreamJson: true }) as any); // discovery

      await ralph({ ...defaultOptions, verbose: true });

      const writes = stdoutWriteSpy.mock.calls.map(c => c[0]);
      // content_block_stop should produce '\n\n' (newline + blank line)
      const doubleNewlines = writes.filter(w => w === '\n\n');
      expect(doubleNewlines.length).toBeGreaterThanOrEqual(2);
    });

    it('should reset timestamp flag after each content block stop', async () => {
      const streamOutput = [
        '{"type":"content_block_delta","delta":{"text":"<ralph-discovery>\\nALL_COMPLETE\\n</ralph-discovery>"}}',
        '{"type":"content_block_stop"}',
        '{"type":"content_block_delta","delta":{"text":"Block 2"}}',
        '{"type":"content_block_stop"}',
        '',
      ].join('\n');

      vi.mocked(spawn)
        .mockImplementationOnce(() => createMockProcess(0) as any)                     // --version
        .mockImplementationOnce(() => createMockProcess(0, streamOutput, '', { rawStreamJson: true }) as any); // discovery

      await ralph({ ...defaultOptions, verbose: true });

      const writes = stdoutWriteSpy.mock.calls.map(c => c[0]);
      // Should have two timestamps — one per content block
      const timestamps = writes.filter(w => typeof w === 'string' && /^\[\d{2}:\d{2}:\d{2}\] $/.test(w));
      expect(timestamps.length).toBe(2);
    });
  });
});

describe('formatTimestamp', () => {
  it('should return timestamp in [HH:MM:SS] format', () => {
    const result = formatTimestamp();
    expect(result).toMatch(/^\[\d{2}:\d{2}:\d{2}\]$/);
  });
});
