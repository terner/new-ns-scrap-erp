# Sub Agent Rules

Use sub agents only for bounded work that can run in parallel without blocking the main implementation path.

## Good Sub Agent Tasks

- Legacy/source investigation, such as finding where a menu, flow, field, or calculation is used in `old-apps/legacy/`.
- Independent codebase questions, such as listing all routes/APIs affected by one module.
- Parallel page audits after a batch is implemented, such as checking buttons, modals, validation, pagination, export, and empty/error states.
- Verification side work while the main agent continues implementation, such as Playwright smoke paths, route inventory, or API response checks.
- Bounded implementation with disjoint file ownership, such as one worker handling only docs while another handles one isolated page or API.

## Playwright Default

Use a sub agent by default for Playwright work:
- browser reconnaissance through Playwright MCP
- click-path smoke checks
- screenshot/accessibility snapshot review
- console/network error inspection
- responsive viewport checks

The main agent remains responsible for defining the exact Playwright task, continuing non-overlapping implementation work, integrating findings, updating docs, and deciding whether code changes are required.

## Do Not Use Sub Agents For

- The immediate blocking task on the critical path.
- Broad unclear requests like "finish everything" without a page/module/task boundary.
- Database schema changes unless the write scope and target environment are explicit.
- Git reset/revert, secret handling, production data changes, or destructive operations.
- Work that overlaps with another active agent's file ownership.

## Before Starting

- Define the exact question or deliverable.
- Define read/write ownership. For code changes, specify files or module boundaries.
- State that it must not revert or overwrite other agents' or user changes.
- Ask for concise output: findings, changed files, validation run, and blockers.

## Close When

- Its assigned task is complete and the result has been integrated or recorded.
- The result is no longer needed because the main plan changed.
- It is idle, blocked, or waiting on information the main agent can resolve faster.
- Its work would start overlapping with the main agent or another agent.
- A batch checkpoint is committed/pushed and there is no remaining task for that agent.

Long-running reminder agents are allowed only when the user explicitly asks for them. They must be closed when the current task list is complete or when the work pauses for discussion.
