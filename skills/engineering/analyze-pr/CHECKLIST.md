# PR analysis checklist

Run each section against `git diff <base>...<head>`. Record one result per section: finding, change needed, or n/a.

## Areas and summary

Group changed files by the repo's own areas: workspace packages, else top-level folders (for example frontend, backend, schema or migrations, infra and CI, docs, tests). Write one bullet per change a reviewer cares about, never a file list. Draft for the PR description:

```markdown
---

## Summary of changes

**<Area>**
- <change>

**Docs**
- <doc updated, or "none">

**Follow-ups**
- <TODOs, test gaps, failing checks, open threads>
```

## TODOs

Added lines matching `TODO|FIXME|HACK|XXX` (`git diff -U0 <base>...<head>` lines starting with `+`). Record `file:line` and the text. When the repo keeps a TODO file (root or per package, such as `TODO.md` or `todo`), add each to the nearest one, prefixed `[PR <id>]`; otherwise list them in the report.

## Generated files

Find generators: `package.json` scripts, Makefile or justfile targets, task runner config, and files headed "generated" or "do not edit". When a generator's inputs changed (routes, API schemas, protobuf, GraphQL, ORM models, migrations), run it and keep the output diff. A hand-edited generated file in the PR is a finding: fix the source, then regenerate.

## Schema and data

Migration or model changes: update the repo's schema doc or ERD if one exists. Flag destructive steps (drop, rename, type narrowing) and missing down migrations where the repo writes them.

## API and contracts

Changed public API, routes, CLI flags, config keys, or env vars: check the README, docs, and changelog mention them. Flag breaking changes.

## Tests

Changed source with no changed test beside it is a test gap. When the repo has a coverage or scenario report command, run it and record the counts and any new gaps or orphans. Analysis only: tests belong to the author.

## Review state

Unresolved threads, requested changes, and failing or pending checks, each with its link.

## Docs

Docs whose subject changed: README sections, `docs/` pages that name changed paths, ADRs. Overview docs go through the repo-overview skill and change only for high-level changes, never for bug fixes or refactors alone.
