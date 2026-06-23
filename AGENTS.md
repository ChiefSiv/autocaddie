<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Autocaddie

Golf-games PWA. Before working, read the living docs:
- `CONTEXT.md` — architecture, decisions, structure, theming + auth models.
- `KNOWN_ISSUES.md` — gotchas (two-pane frozen scorecard; offline conflict model).
- `PHASE_PROGRESS.md` — what's done per phase. **Respect phase discipline.**

Sources of truth: `claude-code-build-prompt-phase-0-1.md` (build plan),
`golf-games-hub-spec.md` + `golf-games-screen-spec.md` (behavior), and the six
`golf-games-*.html` mockups (visual ground truth — pull exact tokens from there).

Keep the living docs current as part of each change, not after.
