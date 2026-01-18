# Manifest Versioning

Status: ✅ Complete

## Overview

This spec defines how Flight Rules tracks the version of content deployed into a project via the `manifest.json` file.

## Problem Statement

Flight Rules has two versioning concepts that were previously conflated:

1. **CLI Version**: The npm package version (what's installed globally)
2. **Payload Version**: The content deployed into a project's `.flight-rules/`

Without a manifest, there's no way to know what version of Flight Rules content is in a specific project, making upgrades opaque and version tracking impossible.

## Solution

Introduce a `.flight-rules/manifest.json` file that records deployment metadata.

### Manifest Schema

```json
{
  "version": "0.4.4",
  "deployedAt": "2026-01-01T10:30:00Z",
  "deployedBy": {
    "cli": "0.4.4",
    "command": "init"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | The payload version deployed (semver) |
| `deployedAt` | string | ISO 8601 timestamp of deployment |
| `deployedBy.cli` | string | CLI version that performed the deployment |
| `deployedBy.command` | string | Command used: `"init"` or `"upgrade"` |

### File Location

`.flight-rules/manifest.json` — placed alongside other framework files.

## Behavior Changes

### `flight-rules init`

1. Copy payload to `.flight-rules/`
2. **NEW**: Write `manifest.json` with:
   - `version`: The fetched payload version
   - `deployedAt`: Current ISO timestamp
   - `deployedBy.cli`: CLI version from package.json
   - `deployedBy.command`: `"init"`

### `flight-rules upgrade`

1. **NEW**: Read existing `manifest.json` (if present) to get current version
2. **NEW**: Display comparison: "You have vX.X.X, upgrading to vY.Y.Y"
3. Fetch and copy new payload
4. **NEW**: Update `manifest.json` with:
   - `version`: The new payload version
   - `deployedAt`: Current ISO timestamp
   - `deployedBy.cli`: CLI version
   - `deployedBy.command`: `"upgrade"`

### Graceful Degradation

If `manifest.json` is missing (older installations), commands should:
- Fall back to reading `flight_rules_version` from `.flight-rules/AGENTS.md`
- Create `manifest.json` on next upgrade

## Implementation Tasks

### Task 1: Utility Functions

Add to `src/utils/files.ts`:

- `readManifest(targetDir)`: Read and parse manifest, return `null` if missing
- `writeManifest(targetDir, data)`: Write manifest with provided data

### Task 2: Update init Command

Modify `src/commands/init.ts` to write manifest after payload copy.

### Task 3: Update upgrade Command

Modify `src/commands/upgrade.ts` to:
- Read current manifest before fetching
- Show version comparison in output
- Write updated manifest after upgrade

### Task 4: Update Tests

- `tests/commands/init.test.ts`: Verify manifest is created with correct data
- `tests/commands/upgrade.test.ts`: Verify manifest is read and updated

## Out of Scope

- Independent payload versioning (deploying specific versions separate from CLI)
- Version pinning or locking
- Breaking change detection between versions
- Migration scripts for schema changes

These may be addressed in future iterations.


