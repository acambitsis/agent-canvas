# Finding Unused Code

This document explains how to systematically find unused code in the AgentCanvas codebase.

## Automated Tool: `unimported`

We use [`unimported`](https://github.com/smeijer/unimported) to detect:
- Unused files
- Unused dependencies
- Unresolved imports

### Usage

```bash
pnpm check:unused
```

This will report:
1. **Unimported files** - Files that are never imported/required
2. **Unused dependencies** - npm packages in package.json that aren't used
3. **Unresolved imports** - Import statements that can't be resolved

### Configuration

Configuration is in `.unimportedrc.json`. Currently ignores:
- Test files (`tests/**`)
- Generated files (`_generated/**`)
- Scripts (`scripts/**`)
- TypeScript definition files (`*.d.ts`)

### Important Notes

⚠️ **Always verify before removing!** Some code might be:
- Used dynamically (e.g., `import('./file.js')`)
- Used in HTML files (check `<script>` tags)
- Part of a public API
- Used in tests (which are ignored by default)

### Example Output

```
─────┬──────────────────────────────────────────────────────────────────────────
     │ 1 unimported files
─────┼──────────────────────────────────────────────────────────────────────────
   1 │ client/modal-utils.js
─────┴──────────────────────────────────────────────────────────────────────────
```

This means `modal-utils.js` is never imported anywhere. Verify it's not used dynamically before removing.

## Manual Checks

For things the tool can't detect:

1. **Unused state properties**: Search for `state.propertyName` across the codebase
2. **Unused functions**: Search for function name usage
3. **Unused CSS classes**: Use browser DevTools or CSS analysis tools
4. **Dead event listeners**: Check for `addEventListener` calls with no corresponding handlers

## Regular Maintenance

Run `pnpm check:unused` periodically (e.g., before major releases) to catch unused code early.
