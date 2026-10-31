---
name: analyze-pr
description: Analyze a pull or merge request on any forge (GitHub, GitLab, Bitbucket, Azure DevOps, Gitea, Forgejo), producing a summary by area, new TODOs, test gaps, and review and CI state, then refreshing generated files and docs on its branch. Use when the user gives a PR or MR number, URL, or branch to analyze, summarize, or document.
---

# Analyze PR

Turns one PR into a by-area summary, a follow-up list, and doc updates on its branch. Forge detection, commands, and git-only mode: [FORGES.md](FORGES.md). What to check: [CHECKLIST.md](CHECKLIST.md).

## 1. Resolve

1. Target: a PR number, URL, or branch; nothing given means the current branch. A URL names the forge and repo; otherwise detect the forge from `git remote get-url origin` per FORGES.md.
2. Check the forge CLI is installed and authenticated. If not, give the user its install and login commands, then continue in **git-only mode**.
3. Done when forge, PR id (if any), base ref, head ref, and head SHA are known; ask the user for whatever the remote cannot tell you.

## 2. Read

Fetch metadata and description, the diff (`<base>...<head>`), comments and reviews, and CI status. Large PR: with subagents, one read-only digest per area. Done when every changed file sits in an area and every unresolved thread and failing check is noted.

## 3. Analyze

Run every CHECKLIST.md section against the diff. Done when each section has a result: finding, change needed, or n/a.

## 4. Update

Edits land on the head branch, so check it out first; if the working tree has other changes or sits on another branch, ask the user (a worktree keeps both).

1. Generated files: regenerate with the repo's own command and fix the sources, so code stays the source of truth.
2. Overview: when the repo has one (`overview.config.json`, or a `- Repo overview:` line in `AGENTS.md` or `CLAUDE.md`), run the repo-overview skill on the docs this PR made stale (`--stale --base <base>`); only high-level changes (features, architecture, stack, operations, intent) warrant an overview edit. No overview: suggest once that the user run the setup-repo-overview skill (`/setup-repo-overview` in Claude Code).
3. Other docs CHECKLIST.md flagged.

Done when every "change needed" is made locally or listed for the user. Code and tests stay with the author.

## 5. Report and publish

1. Report: summary by area, TODOs, test gaps, failing checks, open threads, files changed locally.
2. Outward actions change shared state, so ask before each one and show the exact text or command: appending the summary to the PR description (after a `---`, author's text intact), posting a comment, committing, pushing. Commits run the repo's hooks.

Done when the user has the report and each outward action is done or declined.
