# Testing Rules

For migration/refactor work, include validation proportional to risk:
- schema validation for master data
- permission logic tests
- row count comparison
- orphan FK checks
- transaction total reconciliation
- stock balance reconciliation
- smoke tests for login and core flows

Use `ns-scrap-erp-quality-audit` for substantial UI, state, workflow, or release-readiness checks.
Use `ns-scrap-erp-migration` batch guidance for large legacy-to-Vue, DB, schema, or repeated code transformations.

## Click-Path Checks

For click-path work, verify:
- the touchpoint label and user expectation
- the handler call order
- state reads, writes, resets, and side effects
- async ordering and race conditions
- whether final UI state matches the action intent

## Browser QA

For browser QA, verify:
- console and network failures
- desktop and mobile viewport behavior
- login, protected routes, logout, and core navigation
- valid and invalid form submissions
- accessibility basics: keyboard access, focus visibility, labels, and modal focus behavior

Use Playwright MCP through a sub agent by default for exploratory browser checks, screenshots, accessibility snapshots, and click-path reconnaissance.
Use local Playwright CLI/test tooling for repeatable regression tests.
