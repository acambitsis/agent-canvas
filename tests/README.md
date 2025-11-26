# Test Suite

Ultra high-value tests for AgentCanvas. These 4 tests cover the critical paths that prevent data loss, security breaches, and silent data corruption.

## Tests

1. **Round-Trip Data Integrity** (`integration/round-trip.test.js`)
   - Tests complete save/load workflow
   - Verifies data persists through YAML parse/serialize cycle
   - Most critical test - if this fails, users lose data

2. **API Authentication Enforcement** (`integration/auth.test.js`)
   - Tests that all endpoints reject unauthenticated requests
   - Verifies password validation and trimming
   - Security-critical test

3. **Form ↔ YAML Synchronization** (`unit/form-yaml-sync.test.js`)
   - Tests bidirectional sync between form fields and YAML editor
   - Verifies round-trip data preservation
   - Prevents silent data corruption

4. **Document Name Sanitization** (`unit/sanitization.test.js`)
   - Tests input validation for document names
   - Prevents path traversal attacks
   - Security and stability critical

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
├── fixtures/
│   └── valid-config.yaml       # Test data fixture
├── integration/
│   ├── round-trip.test.js      # Test #1: Data persistence
│   └── auth.test.js            # Test #2: Authentication
└── unit/
    ├── form-yaml-sync.test.js  # Test #3: Modal sync
    └── sanitization.test.js    # Test #4: Document name validation
```

## Test Environment

- **Framework**: Vitest (ESM-native, fast)
- **Environment**: jsdom (browser-like DOM)
- **Mocks**: 
  - Vercel Blob Storage (in-memory)
  - fetch API
  - localStorage
  - DOM APIs

## Coverage

These 4 tests cover:
- ✅ Complete data pipeline (load → save)
- ✅ Security perimeter (auth + input validation)
- ✅ Core user workflow (editing)
- ✅ Storage layer integrity

Everything else (UI rendering, tooltips, collapse state, icons) is cosmetic. These 4 are the foundation.

