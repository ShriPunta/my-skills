## What it does

`analyze-pr` reads one pull or merge request and turns it into:

- a **summary by area** (packages or top-level folders), ready to append to the PR description;
- a **follow-up list**: new `TODO`/`FIXME` lines, changed code with no changed test, unresolved review threads, and failing or pending checks;
- **local updates** on the PR branch: generated files regenerated from their sources, schema and API docs refreshed, and, when the repo has one, the repo overview updated through the [repo-overview](repo-overview.md) skill.

It works on GitHub (`gh`), GitLab (`glab`), Bitbucket (REST with a token), Azure DevOps (`az repos pr`), and Gitea or Forgejo (`tea`). It detects the forge from `git remote get-url origin` or from the URL you paste. Without a forge CLI it falls back to plain git for the diff, commits, and TODOs.

## When to reach for it

You start it yourself: run the analyze-pr skill (`/analyze-pr` in Claude Code, or your agent's skill menu) with a PR number, URL, or branch; with none, it uses the current branch. On harnesses that honour the user-only flag (Claude Code, Codex), the agent never triggers it on its own, so nothing touches your PR until you ask.

Run it before requesting review, so reviewers see a structured summary and the docs already match the code. Pair it with the setup-repo-overview skill (`/setup-repo-overview` in Claude Code) once per repo if you want the overview kept current as part of every PR.

## Common questions

**Will it post to my PR or push commits?**

Only after you say yes to that specific action. It shows the exact text or command first: editing the description, posting a comment, committing, and pushing are each asked separately. Commits run your repo's hooks.

**Does it change my code or tests?**

It touches generated files and docs only; code and tests stay with the author, and test gaps show up in the report.

**My forge CLI isn't installed or logged in. What happens?**

It tells you the install and login commands, then continues with git alone: it fetches the PR ref (`pull/<n>/head` on GitHub, `merge-requests/<n>/head` on GitLab), diffs against the base, and says which parts (description, comments, CI) it could not read.

**What about Bitbucket?**

Bitbucket has no official CLI. Export `BITBUCKET_TOKEN` and the agent uses the REST API with `curl`; without a token it asks you for the branch and works from git.

**How does it know which overview docs to update?**

When the repo has an overview (an `overview.config.json`, or a `- Repo overview:` line in `AGENTS.md` or `CLAUDE.md`), it hands off to repo-overview with the PR's base branch, which finds docs whose `paths` the PR changed and edits only those the PR changes at a high level (features, architecture, stack, operations, intent). A bug-fix or refactor PR usually leaves the overview alone.

**My PR is huge.**

With subagents, the agent writes one read-only digest per area and works from those.

## It's working if

- The summary names areas and changes a reviewer cares about, not a file list.
- Every new `TODO` appears in the report with `file:line`, or in the repo's TODO file when one exists.
- Generated files in the branch match a fresh run of their generator.
- With a repo overview, each doc `--stale --base <base>` lists is updated or reported as judged current.
- Nothing reached the PR, the remote, or git history without your explicit yes.
