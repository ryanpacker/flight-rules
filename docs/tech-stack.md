# Tech Stack

This document describes the technical environment for this project. It serves as a reference for humans and agents when performing tech-dependent tasks.

---

## Testing

### Framework

**Vitest** v4.0.16 with `@vitest/coverage-v8` for code coverage.

Configuration: `vitest.config.ts`
- `globals: true` — enables `describe`, `it`, `expect` without imports
- `environment: 'node'` — Node.js test environment
- Coverage provider: `v8` with HTML and text reporters

### Test Location & Naming

- Tests live in `tests/` directory, mirroring the `src/` structure
- Test files named `*.test.ts`
- Pattern: `tests/**/*.test.ts`

```
tests/
├── commands/
│   ├── adapter.test.ts
│   ├── init.test.ts
│   └── upgrade.test.ts
└── utils/
    └── files.test.ts
```

### Running Tests

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Run in watch mode (interactive) |
| `npm run test:coverage` | Run with coverage report |

Coverage reports are output to `tests/coverage/`.

### Patterns & Conventions

- **Assertion style**: `expect()` (Vitest)
- **Mocking**: `vi.mock()` for module mocking, `vi.fn()` for mock functions
- **Test organization**: Nested `describe/it` blocks
- **Setup/teardown**: `beforeEach`/`afterEach` with `vi.clearAllMocks()` and `vi.restoreAllMocks()`
- **Typed mocks**: `vi.mocked()` for type-safe access to mocked functions

**Mocking pattern**: External dependencies (`@clack/prompts`, `fs`, custom utils) are mocked at the top of each test file before importing the module under test.

### Example Test Structure

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies BEFORE importing module under test
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    cpSync: vi.fn(),
  };
});

import { existsSync, cpSync } from 'fs';
import { myFunction } from '../../src/myModule.js';

describe('myModule.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('myFunction', () => {
    it('should do something when condition is met', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      const result = myFunction('/some/path');
      
      expect(result).toBe(expected);
      expect(existsSync).toHaveBeenCalledWith('/some/path');
    });

    it('should handle errors gracefully', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      expect(() => myFunction('/missing')).toThrow('Not found');
    });
  });
});
```

---

## Runtime & Language

- **Runtime**: Node.js (ESM modules, `"type": "module"`)
- **Language**: TypeScript 5.3+

---

## Build Tools

- **TypeScript** (`tsc`) for compilation
- Output to `dist/` directory
- Source files in `src/`

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@clack/prompts` | Interactive CLI prompts |
| `picocolors` | Terminal output coloring |
| `tar` | Tarball extraction for GitHub payload fetch |

