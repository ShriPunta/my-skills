# my-skills

Agent skills published as a plugin (Claude Code, Codex, Copilot CLI), via `gemini skills install`, and via `npx skills`.

This file lives in `.claude/` so plugin validation stays clean (a root `CLAUDE.md` is flagged as plugin context that never loads). `AGENTS.md` at the root is a symlink to it.

## Layout

- Skills live in buckets: `skills/<bucket>/<skill-name>/SKILL.md` (buckets: `engineering`, add more as needed).
- A skill folder holds `SKILL.md`, `agents/openai.yaml`, optional reference files (`SCHEMA.md`, `HOOKS.md`, ...), `templates/`, `scripts/`, and `evals/evals.json` (realistic prompts covering each branch, skill-creator schema).
- Human docs live in `docs/<bucket>/<skill-name>.md` with sections: What it does, When to reach for it, Common questions, It's working if.
- Tests live in `tests/*.test.mjs` and use `node:test`.

## Rules

- Every skill is listed in `README.md` under **User-invoked** or **Model-invoked** (name linked to its `SKILL.md`, a link to its docs page, plus one line) and in `.claude-plugin/plugin.json` `skills`.
- Invocation is one axis, kept in sync across harnesses:
  - **User-invoked**: `disable-model-invocation: true` in `SKILL.md` and `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. Human-facing one-line `description`, no trigger list.
  - **Model-invoked**: neither flag. Model-facing `description`: front-load what it does, then "Use when ..." triggers, one per distinct branch.
  - Every skill has `agents/openai.yaml` with `interface.display_name` and `interface.short_description`. A skill is user-invoked in both files or neither; tests enforce this.
- Referring to another skill: name it as "the <name> skill"; for a user-invoked target add the Claude Code form: "the <name> skill (`/<name>` in Claude Code)", since only the user can start it.
- Each file lives in one skill only. Skills never link across folders; when one skill needs another's files, it locates the sibling skill folder at run time (see `setup-repo-overview`).
- Keep `SKILL.md` at 45 lines or fewer (tests enforce it); move detail into linked reference files. Cut no-ops a capable model does by default.
- Write skills in the imperative and explain why a step matters instead of stacking MUSTs.
- Keep prose harness-neutral: "ask the user", "subagents if your harness supports them", no tool names from a single harness.
- Scripts: plain Node >= 18 ESM, zero runtime dependencies, single file, usage in a header comment.
- Run `npm test` after any change; all tests pass before finishing.
- Before a PR, also run `claude plugin validate . --strict` (needs the Claude Code CLI, so CI skips it).
- Prose: concise, positive phrasing, no em-dashes.
- Bump `version` in `.claude-plugin/plugin.json` and `package.json` together on release.
- Never write email addresses into files.
