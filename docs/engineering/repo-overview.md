## What it does

`repo-overview` writes and maintains a **modular overview of a repo**: a folder of small markdown files plus an `INDEX.md` router. Agents read `INDEX.md` first, one line per file, then open only the files a task needs.

Every overview has two core files: `00-summary.md` (what it is, who for, status, how to run, where you left off) and `01-intent.md` (why it exists, goals, principles, non-goals). The rest depends on the **preset** chosen at setup: an app gets stack, operations, roadmap, and one file per feature; a library gets an `api/` group with stability statuses; a script, dotfiles repo, or side project gets the two core files and nothing else (**lite**).

Each file carries YAML frontmatter with a one-sentence `summary` and a **provenance** tag: `derived` (read from the code), `author` (from you, dated with `confirmed`), or `mixed`. Docs list the code they cover in `paths`, which lets the optional script flag docs your branch made stale.

## When to reach for it

The agent reaches for it on its own, mostly at the end of a piece of work: "the feature is done", "I'm about to open the PR", "is the overview still accurate?", "I'm back on this project after two years, catch me up". It picks one of three modes:

| Mode | When | What happens |
| --- | --- | --- |
| **Init** | setup is done, no content yet | derives facts from the code, asks you one batched set of intent questions, writes the files, builds the index |
| **Update** | a feature is done or a PR is next | runs `--stale --base origin/<default>`, judges which docs whose `paths` your branch changed need an edit (new or changed features, architecture, stack, operations, intent; bug fixes and refactors alone do not), updates those at a high level, asks you to reconfirm intent when direction shifts, regenerates the index |
| **Check** | you ask about freshness | reports index drift, broken links, stale files, intent due for reconfirmation, and open author questions |

Run the [setup-repo-overview](setup-repo-overview.md) skill (`/setup-repo-overview` in Claude Code) once per repo first. When you skip it, the agent recommends it, and on request proceeds with a lite overview in `docs/overview/` and no hooks.

## Common questions

**What does it ask me, and can I skip?**

Three questions for a lite overview: why it exists, what success looks like, what is out of scope. Full presets add a few that fit the repo (on-call for a service, stability policy for a library, hypotheses for ML). Each comes with a drafted guess you can accept or edit, and any answer can be "skip" or "I don't remember".

**What happens to questions I skip?**

They become `TODO(author): <question>` lines in the right doc. The agent never fills intent with a guess, because a guess reads as fact. Check mode counts the open ones.

**How does it know which docs a branch made stale?**

`--stale --base origin/main` compares against the merge-base: a doc is stale when files in its `paths` changed on the branch and the doc did not. Run it before opening a PR; the setup pointer line tells agents to. A listed doc is a prompt to review: the agent leaves it when the change does not alter what the overview describes and tells you so. In CI it reports by default; `--strict` makes it fail.

**Why many small files instead of one big doc?**

An agent pays for every token it reads. A small index plus focused files lets it load the billing doc for a billing task and skip the rest.

**Does it need Node?**

No. The index script needs Node 18+ and gives you `--check` and `--stale`. Without Node, the agent writes `INDEX.md` by hand in the same format and compares `git diff --name-only origin/<default>...` against each doc's `paths`.

**Which agents does it work with?**

Any harness that loads Agent Skills: Claude Code, Codex, Copilot CLI, Gemini CLI, Cursor, and others. Large repos use subagents for exploration where the harness supports them.

**It's a regulated or team repo. Anything different?**

The `regulated` modifier drops the paste-into-any-LLM page, describes infrastructure by role without hostnames or account ids, adds deny patterns to the secret scan, and asks before fanning out subagents. `owner` comes from `CODEOWNERS`.

## It's working if

- `INDEX.md` lists every overview file with a one-sentence summary and stays within its byte budget.
- `node scripts/overview-index.mjs --check` passes, or the hand-written index lists every doc.
- No `TODO(fill: ...)` remains; every skipped question is a visible `TODO(author): ...` line.
- `01-intent.md` says `source: author`, carries a `confirmed` date, and contains only what you said.
- A fresh agent session answers "what does this repo do, why, and where does billing live?" after reading `INDEX.md` and one or two files.
- Before a PR, `--stale --base origin/<default>` names the docs the branch touched; the update edits only those the change matters to and reports the rest as judged current.
