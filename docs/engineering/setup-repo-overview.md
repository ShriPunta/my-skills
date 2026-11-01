## What it does

`setup-repo-overview` prepares one repo for [repo-overview](repo-overview.md). It reads your repo, then proposes five decisions in one message, each with a recommended answer:

| | Decision | Recommended by default |
| --- | --- | --- |
| 1 | Preset and modifiers | detected from manifests, size, docs-site and dotfile-manager configs, notebooks, remotes |
| 2 | Location | `docs/overview/`; outside a published docs site; a dotted root for dotfiles; per-package roots in a monorepo |
| 3 | Index script | copied when Node 18+ is present; otherwise a Docker one-liner or a hand-maintained index |
| 4 | Hooks and CI | none for a solo repo without CI; otherwise a pre-commit hook, an advisory pre-push hook, and a PR check (`--check` gates, `--stale` reports; `--strict` opt-in makes it gate); optional `.gitattributes` and CODEOWNERS lines |
| 5 | Pointer line | one line in `CLAUDE.md` or `AGENTS.md`, only if you say yes |

Reply "all recommended" or change single numbers. It writes nothing until you confirm.

Presets: lite (scripts, tools, dotfiles, exercises, lists, jams, revived side projects), app (including services), library, monorepo, platform, docs, ml. Modifiers: template, fork, oss, regulated, large. Lite gives two core files and an interview of three questions.

## When to reach for it

Run the skill yourself: `/setup-repo-overview` in Claude Code, or pick it in your agent's skill menu. Harnesses that honour the user-only flag (Claude Code, Codex) never start it on their own, because it edits hooks, config, and instruction files you own.

Run it once per repo, before the first overview. Re-run it to change the preset, move the overview, change hooks, or pull in a newer script. It reads what already exists, so a re-run keeps your earlier answers and never duplicates the pointer line.

When it finishes, it hands off to `repo-overview`, which fills the content (or ask the agent to "build the repo overview" later).

## Common questions

**Why is setup a separate skill?**

Setup makes one-time choices about your repo and needs your confirmation for each. The overview skill runs often and on its own. Splitting them keeps the frequent path short and keeps the agent from editing hooks unprompted.

**What does the pointer line say?**

One line: read `<root>/INDEX.md` first, and before opening a PR run `node <script> --stale --base origin/<default>` and, if the change alters what the overview describes, update it with the repo-overview skill. Without Node, it says to compare `git diff --name-only origin/<default>...` against each doc's `paths` instead. It goes in `CLAUDE.md` if that exists, else `AGENTS.md`; when one points to the other, the canonical file gets it; when neither exists, it asks.

**My repo has no Node at all. Does it still work?**

Yes. It offers a Docker one-liner, or skips the script so the agent maintains `INDEX.md` by hand.

**My repo is a docs site. Will the overview get published?**

No. Setup picks a root outside the published folder. Docusaurus v3 compiles markdown as MDX, which rejects the templates' HTML comments, so there the root always sits outside `docs/`. mkdocs can also exclude it with `exclude_docs`.

**It's my dotfiles repo (stow, chezmoi, yadm).**

The overview gets a dotted root such as `.overview/`, with the script inside it, plus the matching ignore entry. With yadm, git commands go through `yadm` and the script runs inside `yadm enter`.

**We are a team. Will `INDEX.md` cause merge conflicts?**

It can, since every branch that adds a doc rewrites it. Resolve by regenerating. Teams with frequent conflicts let a default-branch CI job regenerate it and run `--validate` on PRs. See [HOOKS.md](../../skills/engineering/setup-repo-overview/HOOKS.md).

**Where do the script and templates come from?**

From the installed `repo-overview` skill folder, next to this one, or from your agent's skills directory or plugin cache. They live in one place, so every repo gets the current version.

## It's working if

- `overview.config.json` names the preset, modifiers, sections, and groups you accepted, and parses as JSON.
- Setup ends by handing off to `repo-overview` Init, with no failing check.
- Your instruction file has exactly one `- Repo overview:` line, and only if you asked for it.
- Hooks and CI match the tool you already use, and nothing you declined was added.
- Asking the agent to "build the repo overview" starts Init without a setup prompt.
