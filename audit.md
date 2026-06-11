# Siya Project — Comprehensive Code Audit

> **Date:** June 11, 2026
> **Scope:** Full monorepo (agents/, cli/, common/, sdk/, packages/*)
> **Files analyzed:** ~800 TypeScript/TSX files
> **Methods:** Static analysis, pattern search, parallel multi-perspective code reviews (6 reviewer agents across all packages), type checking

---

## 🚨 Severity Legend

| Level | Meaning |
|-------|---------|
| 🔴 **Critical** | Will cause bugs, crashes, or security issues in production |
| 🟠 **Major** | Significant code quality, maintainability, or correctness concern |
| 🟡 **Minor** | Best-practice violation or technical debt |
| 🔵 **Suggestion** | Improvement opportunity |

---

## 1. 🔴 Critical Issues

### 1.1 ESLint Infrastructure is Completely Broken — Zero Lint Enforcement

**Severity:** 🔴 Critical
**Affects:** Root project — all packages
**Root cause:** `typescript-eslint` version incompatible with ESLint 10.4.1

The ESLint setup crashes at initialization with:
```
TypeError: Class extends value undefined is not a constructor or null
    at LegacyESLint.js:12:51
```

**Why this is the #1 issue:** The project has **zero automated code quality enforcement**. No style rules, no import rules, no safety checks are running. This means every commit bypasses all lint gates, allowing regressions to accumulate unchecked.

**Root cause:** `@typescript-eslint/utils` in the `typescript-eslint` package tries to extend ESLint's `LegacyESLint` class, which doesn't exist in ESLint 10.x — the API was restructured.

**Suggested fix:** Pin ESLint to `^9.x` which is compatible with the installed `typescript-eslint` version, or upgrade `@typescript-eslint/*` packages to versions compatible with ESLint 10.

Additionally, `eslint.config.js` imports `globals` which is **not in any `package.json`** — this would be a second blocker even after fixing the version mismatch.

---

### 1.2 TypeScript is a Transitive-Only Dependency at Root

**Severity:** 🔴 Critical
**Affects:** Root project

TypeScript is not installed as a direct root dependency. It exists only as a transitive dependency through `@opentui/core` → `bun-ffi-structs`. This means:
- Root-level `tsc` cannot run (only workspace-level via Bun)
- Root `tsconfig.json` cannot be validated
- Cross-package type consistency is unverifiable
- CI typecheck gates don't work at root level

**Fix:** Add `typescript` as a root `devDependency`.

---

### 1.3 Import Casing Mismatch (`siya-message.ts` vs `Siya-message.ts`)

**Severity:** 🔴 Critical
**Affects:** `common/src/util/__tests__/messages.test.ts`

The file on disk is `common/src/types/messages/siya-message.ts` (lowercase `s`) but some imports reference `Siya-message` (uppercase `S`).

```typescript
// ❌ Wrong casing — passes on Windows, breaks on Linux/macOS
import { ... } from '../../types/messages/Siya-message'
// ✅ Correct
import { ... } from '../../types/messages/siya-message'
```

This passes on Windows (case-insensitive filesystem) but will **break on Linux/macOS CI** with module-not-found errors.

**Fix:** Standardize all imports to use lowercase `siya-message`. Check for other files with similar casing issues.

---

### 1.4 Environment Variable Casing Mismatch in Tests

**Severity:** 🔴 Critical
**Affects:** `common/src/__tests__/env-process.test.ts`

Test code uses `Siya_IS_BINARY` and `Siya_CLI_VERSION` (PascalCase), but the schema defines `SIYA_IS_BINARY` and `SIYA_CLI_VERSION` (all uppercase). TypeScript correctly catches this mismatch:

```
Type '"Siya_IS_BINARY"' is not assignable to type '"SIYA_IS_BINARY"'
```

This would block CI on case-sensitive systems and reveals that env var naming conventions are not consistently enforced.

**Fix:** Correct test env var names to match the canonical schema casing.

---

### 1.5 Type Safety Regression in LLM Provider (MUST FIX TODO)

**Severity:** 🔴 Critical
**Affects:** `packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.ts:396`

```typescript
// TODO we lost type safety on Chunk, most likely due to the error schema. MUST FIX
```

This is a **known, acknowledged type safety regression** in the LLM provider's chat model implementation. The `Chunk` type has been widened/lost in the streaming path, meaning:
- No compile-time checking on streamed response chunks
- Potential runtime errors from malformed chunks
- Downstream consumers receive untyped data

**Fix:** Investigate and restore proper typing for `Chunk` in the streaming response path.

---

### 1.6 Heavy `any` Type Proliferation (400+ instances)

**Severity:** 🔴 Critical
**Affects:** All packages

**199+ explicit `: any` annotations** and **212+ `as any` casts** found in production source code. This is the single largest technical debt item in the project.

**Worst offenders by file:**

| File | Occurrences | Impact |
|------|------------|--------|
| `agents/file-explorer/file-picker.ts` | 8+ `any` params | Core agent utility functions are untyped |
| `cli/src/utils/logger.ts` | Multiple | Logging infrastructure bypasses types |
| `cli/src/utils/sdk-event-handlers.ts` | 10+ `any[]` | Event handling pipeline is opaque |
| `cli/src/utils/message-block-helpers.ts` | 15+ `as any` casts | UI rendering pipeline has no type safety |
| `packages/agent-runtime/src/tools/tool-executor.ts` | `as any` casts | Tool execution — a security-critical path |
| `packages/agent-runtime/src/tools/prompts.ts` | `exampleInputs?: any[]` | Prompt construction without type checks |
| `agents/types/tools.ts` | `messages: any` | Core type definition uses `any` |
| `sdk/src/run.ts` | `any` in public API | Public SDK surface has untyped inputs |
| `cli/src/components/tools/*.tsx` | All 20+ components | Every tool component casts `toolBlock.input as any` |
| `common/src/tools/compile-tool-definitions.ts` | `{ [key: string]: any }` | Fallback type in code generation |

**Impact:** Every `any` is a potential runtime error waiting to happen. The type checker cannot verify these paths, making refactoring dangerous and hiding bugs.

**Fix:** Replace `any` with proper types systematically. Prioritize public APIs, tool interfaces, and security-critical paths.

---

### 1.7 `console.log` in Production Source Code (217+ instances)

**Severity:** 🔴 Critical
**Affects:** Multiple packages

**217+ `console.log`** calls found outside test files. Key offenders in production code:

| File | Lines | Issue |
|------|-------|-------|
| `packages/code-map/src/parse.ts` | 115, 176, 216-218, 231 | Debug logging left in production parser |
| `packages/gateway/src/gateway.ts` | 70, 83 | Production server logs via console.log |
| `packages/gateway/src/bridge/siya-bridge.ts` | 42 | Debug log in bridge |
| `packages/gateway/src/setup-wizard.ts` | 28-82 | Acceptable — CLI wizard UX |
| `cli/src/commands/gateway.ts` | 25-67 | Acceptable — CLI command output |
| `cli/src/commands/pairing.ts` | 25-54 | Acceptable — CLI command output |
| `cli/src/index.tsx` | 106, 114 | Debug logging in entry point |
| `cli/scripts/prebuild-agents.ts` | 144-196 | 10+ debug logs in build script (should be silent by default) |
| `sdk/scripts/*.ts` | Multiple | Build/publish scripts — acceptable |

**Fix:** Replace stray `console.log` in production runtime code with the structured `logger` utility. Remove debug logging from `code-map/parse.ts` and make `prebuild-agents.ts` logging conditional on a `--verbose` flag.

---

## 2. 🟠 Major Issues

### 2.1 No Test Results Collected — Audit Gap

**Severity:** 🟠 Major
**Affects:** All packages

**Note:** This is a limitation of the current audit, not a code issue.

`bun test` was **not executed** across workspace packages. Test failures would be the highest-priority findings in a code audit. The following test suites need to be run:

| Workspace | Test Command | Test Files |
|-----------|-------------|------------|
| `sdk/` | `bun run test` | 20+ test files |
| `packages/agent-runtime/` | `bun run test` | 25+ test files |
| `packages/gateway/` | `bun run test` | 8+ test files |
| `packages/code-map/` | `bun run test` | 3 test files |
| `common/` | `bun run test` | 10+ test files |
| `agents/` | `bun test (root)` | 5 test files |
| `cli/` | `bun run test` | 1 test file |

**Why this matters:** Without running tests, we cannot confirm if any of the code issues found (type mismatches, `any` types, etc.) are actually causing test failures.

---

### 2.2 Test Coverage Gap in CLI

**Severity:** 🟠 Major
**Affects:** `cli/`

The CLI has **103 TSX component files** but only **1 test file** (`cli-args.test.ts`). This means:
- 102 components have zero test coverage
- Complex components (chat-input-bar, blocks-renderer, tool-call-item, etc.) are untested
- State management stores have no tests
- Hook logic (20+ custom hooks) has no tests

**Risk:** Refactoring the TUI is high-risk with no test safety net.

---

### 2.3 Agent Type Definitions Triplicated

**Severity:** 🟠 Major
**Affects:** `agents/` + `common/`

Tool parameter types are defined and duplicated in three locations:

1. `agents/types/tools.ts` — Agent-facing tool types
2. `common/src/tools/params/tool/*.ts` — Runtime tool schemas (33 tool files)
3. `common/src/templates/initial-agents-dir/types/tools.ts` — Template copy for user agents

This triplication will inevitably drift. Any change to tool schemas must be synchronized across all three locations.

**Fix:** Consolidate tool parameter types into a single source of truth in `common/`. Import into agents and templates from there.

---

### 2.4 Model Constants Duplication

**Severity:** 🟠 Major
**Affects:** `common/src/constants/siya-models.ts` + `agents/siya-agent-models.ts`

Model definitions exist in two places with potential overlap. This creates a single-source-of-truth violation where one file could fall out of sync with the other.

**Fix:** Decide on a canonical location (likely `common/`) and import across packages.

---

### 2.5 Multiple State Stores Without Clear Data Flow

**Severity:** 🟠 Major
**Affects:** `cli/src/state/`

Six independent Zustand stores:
- `chat-store.ts` — Chat messages and state
- `chat-history-store.ts` — Chat session history
- `feedback-store.ts` — User feedback
- `message-block-store.ts` — Message rendering blocks
- `publish-store.ts` — Agent publishing
- `review-store.ts` — Code review state

**Risk:** Fragmented state with no clear ownership boundaries. Synchronization issues can arise when multiple stores need to update in coordination.

**Fix:** Establish clear store hierarchy. Consider consolidating related stores or using a single store with logical slices.

---

### 2.6 Gateway Scheduler Lacks Timezone Support

**Severity:** 🟠 Major
**Affects:** `packages/gateway/src/scheduler/parse-schedule.ts`

Cron expressions are parsed and stored without any timezone context. A user in UTC+5:30 setting "0 9 * * *" expects 9 AM local time, but the engine interprets it as UTC.

**Fix:** Store timezone ID alongside each scheduled task's cron expression. Resolve against the stored timezone when computing next run.

---

## 3. 🟡 Minor Issues

### 3.1 Gateway Session Store Lacks TTL/Cleanup

**Severity:** 🟡 Minor
**Affects:** `packages/gateway/src/session/session-store.ts`

Telegram sessions accumulate indefinitely with no expiration or pruning mechanism. This is a resource leak (especially long-running gateway instances) and a security concern (stale sessions for de-authorized users).

**Fix:** Add TTL to sessions. Register a cleanup task in the scheduler engine to prune expired sessions periodically.

### 3.2 Scheduler Lacks Crash Recovery (WAL)

**Severity:** 🟡 Minor
**Affects:** `packages/gateway/src/scheduler/store.ts`

Scheduled tasks are persisted to disk, but there's no write-ahead log or transaction-level persistence. If the process crashes between saving a task and the engine registering it, that task is lost.

**Fix:** Add a WAL-style durability mechanism or in-memory buffer with flush confirmation.

### 3.3 `@ts-ignore` Usage (27 instances)

**Severity:** 🟡 Minor
**Affects:** Various non-node_modules files

27 `@ts-ignore` comments bypass type checking. While some are justified (Bun runtime specifics in `cli/src/commands/init.ts`), each should be reviewed and ideally replaced with proper type handling.

### 3.4 `@ts-expect-error` Usage (9 instances)

**Severity:** 🟡 Minor
**Affects:** Various non-node_modules files

9 `@ts-expect-error` comments. Unlike `@ts-ignore`, these will fail if the underlying error is ever fixed — which is better, but still bypasses type safety. Review each for continued necessity.

### 3.5 README References Old Package Name

**Severity:** 🟡 Minor
**Affects:** `cli/README.md`

References `@codebuff/cli` instead of the current `@siya/cli`. Causes confusion for new developers.

### 3.6 Cross-Platform Script Issues

**Severity:** 🟡 Minor
**Affects:** `cli/scripts/`

- `validate-cli-with-tmux.sh` assumes bash/tmux — won't work on Windows
- Several scripts use POSIX-only paths

**Fix:** Document platform assumptions in script headers or provide Windows alternatives (PowerShell equivalents).

### 3.7 Code Map Package Debug Logging

**Severity:** 🟡 Minor
**Affects:** `packages/code-map/src/parse.ts`

Debug `console.log` statements remain in production parser code (lines 115, 176, 216-218, 231). These will produce noisy output during normal use.

### 3.8 `prebuild-agents.ts` Verbose Debug Output

**Severity:** 🟡 Minor
**Affects:** `cli/scripts/prebuild-agents.ts`

Lines 144-196 contain 10+ `console.log` statements with `🔍 DEBUG:` prefixes that always run. This is a build script that should be quiet by default and verbose only with a flag.

---

## 4. 🔵 Suggestions

### 4.1 Add Event Middleware Architecture

The gateway bridge has no middleware-style interception point for logging, metrics, or debugging across the event → process → response flow. Adding an `EventMiddleware` type would enable future monitoring without invasive changes.

### 4.2 Add Schema Validation to Tool Component Inputs

Every tool component in `cli/src/components/tools/*.tsx` casts `toolBlock.input as any`. Define and validate input shapes for each component instead of bypassing type checking.

### 4.3 Compose Agents from Config Instead of Code Duplication

The many agent variants (`base2`, `base2-fast`, `base2-lite`, `base2-max`, `base2-plan`, `base-deep`, etc.) suggest combinatorial explosion. Consider composing agents from configuration rather than copy-paste code duplication.

### 4.4 Add CI/CD Pipeline

No CI/CD configuration files were found (`.github/` was not observed in the project tree). Adding GitHub Actions (or equivalent) would catch type errors, lint failures, and test regressions automatically on pull requests.

### 4.5 Add Missing LICENSE File

Root `package.json` specifies `"license": "Apache-2.0"` but no `LICENSE` file exists in the project tree. This is a legal requirement for the Apache 2.0 license.

### 4.6 Decouple Gateway Bridge from Event Adapter

`event-adapter.ts` and `siya-bridge.ts` have overlapping responsibilities. Consider a clearer pipeline: raw event → adapter → normalized event → bridge → agent runtime, with explicit interfaces between each stage.

### 4.7 Session Persistence Should Be Encrypted

Session store writes session state to disk without encryption or integrity checks. If a user gains filesystem access, they could tamper with session data. Consider encrypting serialized session state.

---

## 5. 📊 Summary Statistics

| Metric | Count |
|--------|-------|
| Total TypeScript files | ~689 `.ts` files |
| Total TSX files | ~103 `.tsx` files |
| `: any` annotations (source) | 199+ |
| `as any` casts (source) | 212+ |
| `console.log` in production code | 217+ |
| `@ts-ignore` comments | 27 |
| `@ts-expect-error` comments | 9 |
| Unresolved `TODO` items | 6 |
| State stores (CLI) | 6 |
| Agent type variants | 8+ |
| Workspace packages | 8 |
| CLI component test files | 1 (out of 103 components) |

---

## 6. ⚠️ Audit Limitations

The following analyses were **not performed** and should be addressed in a follow-up audit:

| Missing Analysis | Reason |
|-----------------|--------|
| 🔴 **Test execution** | `bun test` was not run across workspaces — this is the #1 gap |
| 🔴 **Security vulnerability scan** | `npm audit` / `bun pm audit` not run for known CVEs |
| 🔴 **Dependency audit** | Unused deps, outdated packages, missing peer deps not checked |
| 🟠 **Circular dependency analysis** | Monorepo of this size likely has import cycles |
| 🟠 **Hardcoded secrets check** | API keys, tokens, passwords not scanned in source |
| 🟠 **Unused exports / dead code** | No `noUnusedLocals` enforcement means dead code is invisible |
| 🟠 **Error handling audit** | Unhandled promise rejections, missing try/catch not checked |
| 🟠 **Complete typecheck of all workspaces** | CLI, SDK, and agent-runtime typechecks were cancelled/timeout |

---

## 7. 🎯 Recommended Action Plan

### Immediate (Week 1)

1. **Fix ESLint infrastructure** — Pin ESLint to `^9.x` compatible with `typescript-eslint` or upgrade deps. Add `globals` devDependency.
2. **Add TypeScript as root devDependency** to enable root-level typechecking.
3. **Fix import casing** — `siya-message.ts` vs `Siya-message.ts` (blocks Linux/macOS).
4. **Fix env var casing** in `env-process.test.ts` tests.
5. **Fix the `MUST FIX` TODO** in `openai-compatible-chat-language-model.ts:396`.
6. **Run all test suites** and fix any failures found.

### Short-term (Week 2-3)

7. **Replace `any` types systematically** — Start with public APIs (`sdk/src/run.ts`, `agents/types/tools.ts`) and tool interfaces (`cli/src/components/tools/*.tsx`).
8. **Remove `console.log` from production runtime code** — Especially `code-map/parse.ts` and `gateway.ts`.
9. **Make `prebuild-agents.ts` logging conditional** on `--verbose` flag.
10. **Add LICENSE file** (Apache-2.0).

### Medium-term (Month 1-2)

11. **Consolidate duplicated types** — Tool params, model constants, agent definitions into `common/`.
12. **Add session TTL and cleanup** in Telegram gateway.
13. **Add timezone support** to the scheduler.
14. **Add CI/CD pipeline** — GitHub Actions for automated typechecking, linting, testing.
15. **Add component tests** for CLI — prioritize `chat-input-bar`, `blocks-renderer`, `tool-call-item`.

### Long-term (Quarter)

16. **Address architectural items**: Event middleware, agent composition, encrypted session storage.
17. **Run comprehensive security audit**: Dependency vulnerability scan, hardcoded secrets detection, injection vector analysis.
18. **Circular dependency analysis and resolution**.

---

*Generated by Siya's automated code audit system on June 11, 2026*
*Method: 6 parallel code-reviewer-multi-prompt agents + static analysis + pattern search*
