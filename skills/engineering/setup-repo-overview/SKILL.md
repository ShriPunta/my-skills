---
name: setup-repo-overview
description: "One-time setup for the repo-overview skill: preset, location, index script, hooks or CI, and an optional agent pointer line."
disable-model-invocation: true
---

# Setup repo overview

Settle the one-time choices; the repo-overview skill writes the content. Explore, propose, confirm, then write: nothing touches disk before the user says yes.

**Assets.** `<ro>` is the repo-overview skill folder: `../repo-overview/` beside this one, else the first `repo-overview/SKILL.md` under `.claude/skills`, `.agents/skills`, `.cursor/skills`, `.codex/skills`, `.gemini/skills` (in the repo or `~`), `.github/skills`, `~/.copilot/skills`, or a plugin cache (`~/.claude/plugins/`, `~/.codex/plugins/`). Missing: tell the user to install it and stop.

## 1. Explore

Find prior setup (config, script copy, `- Repo overview:` line) and keep it. Then read the repo kind against [PRESETS.md](PRESETS.md), size, last commit date, remotes, default branch, Node 18+, git, docs site, dotfile manager, workspaces, `CODEOWNERS`, hook tool, CI, and the canonical agent instruction file (symlink or `@AGENTS.md`-style pointer). Done when each decision below has a recommendation backed by a finding.

## 2. Propose

Summarise findings in a few lines, then send one message with the five decisions, each led by its recommendation, so "all recommended" works. Skip settled ones.

1. **Preset and modifiers** per PRESETS.md, naming the signals and the sections and groups it creates.
2. **Location**: `docs/overview/`, adjusted per PRESETS.md "Location".
3. **Script**: with Node 18+, copy `<ro>/scripts/overview-index.mjs` to `scripts/` (dotfiles: into the root), plus `docs:overview`, `docs:overview:check`, `docs:overview:stale` in a Node repo's `package.json`. Without Node: `docker run --rm -v "$PWD":/w -w /w node:22-alpine node <script>`, or hand mode.
4. **Hooks and CI** from [HOOKS.md](HOOKS.md): none for a solo repo without CI. For teams, CI runs `--check` as a gate and `--stale` as a report (`--strict` opt-in to gate it); warn about `INDEX.md` merge conflicts. Offer the optional `.gitattributes` and `CODEOWNERS` lines.
5. **Pointer line**: "Add one line to your agent instructions pointing at the overview?"

On yes only, edit `CLAUDE.md` if it exists, else `AGENTS.md`; when one symlinks or points to the other, edit the target; with neither, ask which to create. Replace an existing `- Repo overview:` line in place, else append, so re-runs stay at one line:

```markdown
- Repo overview: read `<root>/INDEX.md` first; before opening a PR run `node <script> --stale --base origin/<default>` and, if the change alters what the overview describes, update it with the repo-overview skill.
```

Hand mode swaps the command for: compare `git diff --name-only origin/<default>...` against each doc's `paths`, and update matches whose change alters what the overview describes with the repo-overview skill.

## 3. Confirm and write

Show every file to create and every exact edit; write after a yes:

1. Root plus `overview.config.json` from `<ro>/templates/`, with title, preset, modifiers, sections, and groups (keys in `<ro>/SCHEMA.md`). An existing config keeps keys the user left alone.
2. Copy the script; on a re-run, show the diff against the bundled copy and offer the update.
3. Apply the accepted package scripts, hooks, CI, ignore entries, optional lines, and pointer line.
4. Check that the config parses as JSON. Core files come next, in Init.

Done when every accepted item is written. List it, then start the repo-overview skill in Init if the user wants the overview now; otherwise tell them to ask for "build the repo overview". Re-run setup to change any decision or pull a newer script.
