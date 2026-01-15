# Test Suite

AgentCanvas is now **Convex-native**. YAML is supported only as a **one-way legacy importer**.

## Tests

- **Legacy YAML import** (`unit/legacy-import.test.js`)
  - Verifies YAML → (canvas + agents) conversion and that we don't persist YAML.
- **Convex subscription lifecycle** (`unit/convex-subscriptions.test.js`)
  - Ensures subscription replacement/cleanup logic works.
- **Validation** (`unit/validation.test.js`)
  - Mirrors core validation behavior.
- **Auth/session** (`integration/workos-auth.test.js`, `integration/session-encryption.test.js`)
  - Security-critical flows.

## Running Tests

```bash
# Install dependencies
pnpm install

# Run tests in watch mode
pnpm test

# Run tests once
pnpm test:run

# Run tests with UI
pnpm test:ui
```

## Test Structure

```
tests/
├── setup.js                    # Test environment setup (jsdom, mocks)
├── integration/
│   ├── session-encryption.test.js
│   └── workos-auth.test.js
└── unit/
    ├── convex-subscriptions.test.js
    ├── legacy-import.test.js
    └── validation.test.js
```

## Test Environment

- **Framework**: Vitest (ESM-native, fast)
- **Environment**: jsdom (browser-like DOM)
- **Mocks**: 
  - Vercel Blob Storage (in-memory)
  - fetch API
  - localStorage
  - DOM APIs

## Notes

- These tests intentionally avoid UI rendering specifics; they focus on **data integrity** and **security-sensitive logic**.

