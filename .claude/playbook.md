# Aider Orchestration Playbook

Evolving knowledge base for Claude-Aider orchestration. Update this when you learn something new.

## Known Issues

### MiniMax M2.5 Constraints
- Rejects `system` role messages → `use_system_prompt: false`
- `diff` edit format produces garbled code → use `whole` format only
- Emits `<think>` tags → `reasoning_tag: "think"` strips them
- 8192 max output tokens → keep tasks focused, one phase at a time

### Windows / Aider Quirks
- `vite` not in PATH inside Aider's test runner → test.ps1 uses `node node_modules/vite/bin/vite.js build`
- Unicode crash (cp1252) → `$env:PYTHONUTF8 = "1"` in all scripts, `auto-lint: false`
- Aider adds `.aider*` to .gitignore → use `--no-gitignore` flag always
- `npm run build` fails in MSYS bash → use PowerShell for all scripts

### Svelte Gotchas
- Imports MUST be in top-level `<script>` block, never inside `{#if}` blocks
- Aider sometimes puts imports inside conditionals → always verify App.svelte after changes
- Unused imports trigger build warnings → clean up after Aider

## Task Sizing Guidelines
- One phase of a spec per aider-task call (Aider has 8192 token output limit)
- For large phases, break into sub-tasks (e.g., "Phase 2a: data model", "Phase 2b: UI")
- If Aider's output gets truncated, the task was too large

## Cost Optimization
- `whole` format costs more tokens but prevents corruption
- `map-tokens: 2048` balances context awareness vs cost
- Typical small task: ~$0.01-0.03
- Phase implementation: ~$0.03-0.10

## Verification Checklist
After every aider-task run:
1. Check AIDER_EXIT code (0 = success)
2. Check AIDER_TEST result (passed/failed/skipped)
3. If test failed, run `.\aider-fix.ps1` (max 3 attempts)
4. If still failing, read the build output and fix manually
5. Verify the actual code changes make sense (don't blindly trust)

## Patterns That Work
- Prepend conventions to every message → consistent code style
- Include spec as editable file → Aider checks off criteria
- Use --read for context files that shouldn't be edited
- Log every run → track costs and identify recurring issues
