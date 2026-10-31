---
name: repo-overview
description: Update the repo overview (docs/overview: summary, intent, stack, features, INDEX.md) when a feature is done, a branch wraps up, or a PR is about to open or merge. Also use to create, refresh, or check it.
---

# Repo overview

Small markdown docs with frontmatter plus an `INDEX.md` router that agents read first. Format, config, markers, CLI: [SCHEMA.md](SCHEMA.md). Author questions: [INTERVIEW.md](INTERVIEW.md). Starters: [templates/](templates/).

`<script>` is the repo's copy of `overview-index.mjs`, else this skill's [scripts/overview-index.mjs](scripts/overview-index.mjs) with `--root <root>`. **Hand mode** (no Node): write `INDEX.md` per SCHEMA.md with the hand header, and read docs against SCHEMA.md where a step says `--check`.

## 1. Detect

A `- Repo overview:` line in `CLAUDE.md` or `AGENTS.md` names the root, the script command, and the base branch; else walk up for `overview.config.json` or `docs/overview/`. Core files missing or holding `TODO(fill:`: **Init**. A change, finished feature, or PR prep: **Update**. A freshness question: **Check**.

Nothing found: recommend the setup-repo-overview skill (`/setup-repo-overview` in Claude Code; only the user can start it). To proceed now: root `docs/overview/`, config from the template as is (lite), then **Init**. Done when root, script or hand mode, and mode are known.

## 2. Init

1. Derive facts from the code and `git log --oneline -30`. Where an existing doc already explains an area, link it in `related_docs`.
2. Large repo (~50k lines or 20+ areas): agree a first scope and list the rest in `coverage.md`; with subagents, one read-only digest per area (300 words max: purpose, paths, entrypoints, gotchas). `regulated`: ask before fanning out.
3. Interview per INTERVIEW.md.
4. Write the core templates, each config `sections` entry, and per group `<group>/<slug>.md` from `templates/items/_item.md` with the group's required fields; save it as `<group>/_template.md` too. Fill every `TODO(fill:`, delete sections and comments that do not apply, keep only existing `paths`.
5. Run `node <script>`, then `--check`. Done when it passes (hand mode: INDEX lists every doc) and every unanswered question is a `TODO(author):` line.

## 3. Update

1. Base: `origin/<default branch>` (pointer line, else `git remote show origin`). Run `node <script> --stale --base <base>`; hand mode: match `git diff --name-only <base>...` against each doc's `paths`. Add docs the user's description touches.
2. Judge each listed doc: edit it only when the change alters what an overview reader should know (features added, removed, or behaving differently; architecture; notable stack; operations; intent). Tests, bug fixes, refactors, internal tweaks, formatting, and dependency bumps alone do not qualify; leave the doc and tell the user it was judged current.
3. Edit only docs that qualify; an edit marks a doc current. New item: `<group>/<slug>.md`, linked from neighbours' `related`. Removed: `status: Removed`, or delete it and every reference.
4. Direction shift or reconfirm due: show the author doc, ask, and bump `confirmed` only on their yes.
5. Run `node <script>`, then `--check`. Done when every doc `--stale` listed is updated or reported as judged current, and `--check` passes.

## 4. Check

Run `--check` and `--stale` (with `--base` on a branch). Report drift, problems, stale docs with their commits, reconfirms due, and the open `TODO(author)` count. Offer **Update**; edit after the user agrees.

## Rules

- **Never invent intent.** An unanswered why, goal, or non-goal stays a `TODO(author): <question>` line.
- **Provenance.** Code facts are `source: derived`; author input is `author` or `mixed` with `confirmed: YYYY-MM-DD`.
- **Secrets and hosts.** Name secrets and where they live, never values. `regulated`: infra by role, no hostnames, IPs, or account ids.
- **Ownership.** `owner` comes from `CODEOWNERS`; flag docs covering another team's paths for that team's review.
- **High level.** Distill technical changes into what they mean for a reader, never file by file or changelog style. Record what code hides: reasons, conventions, cross-cutting links, gotchas. `summary` is one sentence, the INDEX line.
