# Overview schema

Single source of truth for the overview's files, frontmatter, config, and INDEX.md format. Presets live in the setup-repo-overview skill (`PRESETS.md`); they only decide which sections and groups exist.

## Layout

Default root `docs/overview/` (also found: `.overview/`, `.config/overview/`, or any folder holding `overview.config.json`).
```
INDEX.md                 generated router (or hand-maintained without Node)
overview.config.json     optional
00-summary.md            REQUIRED: what it is, who for, status, how to run, where to start   (source: mixed)
01-intent.md             REQUIRED: why it exists, goals, principles, non-goals                (source: author)
02-<section>.md ...      optional sections chosen by the preset (stack, operations, context, ...)
roadmap.md               optional: Gaps / Next / Someday tables (also optional: llm-prompt-context.md)
<group>/                 one or more item groups, e.g. features/, api/, packages/, experiments/
  _template.md           skipped (any `_` or `.` prefixed file or folder is skipped)
  <slug>.md              one item; may be nested: <group>/team-a/auth.md
```

Root-level `.md` files form the **Core** group (numeric prefixes set reading order); each top-level subfolder is an item group. Skipped: `_*` and `.*` entries, the root `INDEX.md`, `README.md`, and `ignore` globs.

## Frontmatter

YAML subset: `key: value` (value taken verbatim; `#` inside a value is text), quoted keys and values, inline arrays `[a, "b, c"]`, block lists, block scalars `>` `>-` `|` `|-`, and full-line `#` comments. Nested maps are accepted and ignored. Extra keys are always allowed.

| Field | Where | Meaning |
| --- | --- | --- |
| `summary` | all, **required** | One sentence, a string. Quote it if it starts with `[`. Shown in INDEX.md (whitespace collapsed). |
| `keywords` | all | List. First `maxKeywords` shown in INDEX.md. |
| `source` | all | `author` (intent from the author), `derived` (read from code), or `mixed`. |
| `confirmed` | author/mixed docs | `YYYY-MM-DD` the author last confirmed it. Drives reconfirm. |
| `owner` | all | Team or handle, usually from CODEOWNERS. |
| `paths` | all | Files, folders (end with `/`), or simple globs, relative to the **repo root** (also in per-package overviews). Must exist. Drives `--stale`. |
| `related` | all | Item slugs: `group/slug` or a bare slug unique across all groups. |
| `related_docs` | all | Repo-root-relative paths (must exist) or URLs to deeper docs. |
| `classification` | all | `public`, `internal`, or `restricted`. |
| `name`, `status` | items | Human name (matches the H1); status, checked against the group's `statuses` when declared. |
| other | items | Group-specific, free-form: `area`, `entrypoints`, `stability`, `since`, `metrics`, `dataset`, `depends_on`, `upstream`, ... |

**Slugs.** An item's slug is its path inside the group folder without `.md`: `features/team-a/auth.md` has slug `team-a/auth` and full ref `features/team-a/auth`. A bare `related` slug matching items in two groups is an error ("ambiguous"); use `group/slug`.

## Markers

| Marker | Meaning | Write mode | `--check` / `--validate` |
| --- | --- | --- | --- |
| `TODO(fill: NAME)` | Template placeholder not yet filled | warning | error |
| `TODO(author): <question>` | Author input asked but not given. Never invent intent. | counted note: "N author-input items open" | same (never an error) |

Markers inside HTML comments (`<!-- ... -->`) are not counted. `{{...}}` is ordinary text.

## overview.config.json

All keys optional; unknown keys ignored.

| Key | Default | Meaning |
| --- | --- | --- |
| `title` | `"Project Overview"` | INDEX.md H1. |
| `preset`, `modifiers`, `sections` | none | Recorded by setup; informational for the script. |
| `groups` | `{}` | Per group: `{ title, item, statuses, required, indexFields }`. Key order sets section order after Core; unlisted groups follow alphabetically, titled by capitalized folder name, with no status/required checks. `indexFields` values must be scalars or lists (a map is warned about). Example: `"api": { "title": "API", "statuses": ["Experimental", "Stable", "Deprecated", "Removed"], "required": ["name", "status", "paths"], "indexFields": ["status"] }`. |
| `ignore` | `[]` | Globs (relative to the root) never indexed, added to the built-in `README.md`. A pattern without `/` matches a file name at any depth; a trailing `/` matches a folder. |
| `staleIgnore` | lockfiles (`**/package-lock.json`, `**/pnpm-lock.yaml`, `**/yarn.lock`, `**/Cargo.lock`, `**/poetry.lock`, `**/go.sum`) | Git glob pathspecs excluded from `--stale`. Every overview root in the repo is always excluded. |
| `reconfirmAfterDays` | `180` | `--stale` lists author/mixed docs whose `confirmed` is older, and `source: author` docs with no `confirmed` and no open `TODO(author)`. `0` disables. |
| `maxKeywords` | `3` | Keywords shown per INDEX line. |
| `indexBudgetBytes` | `8000` | Root INDEX.md larger than this is a warning. `0` disables. |
| `denyPatterns` | `[]` | Case-insensitive regex strings that must not appear in docs (hostnames, account ids). Also always scanned: private key and PEM `-----BEGIN` blocks, AWS key ids (`AKIA` + 16), GitHub (`ghp_` etc.) and Slack (`xoxb-` etc.) tokens. Reported by file, line, and label, never the value. |

## INDEX.md format

Byte-exact, so a hand-maintained INDEX matches generated output:
```
<!-- GENERATED by overview-index.mjs. Do not edit by hand; regenerate with the repo's overview script. -->

# <title>

Read this first, then open only the files you need. Paths are relative to this folder.

## Core

- `00-summary.md`: <summary> _(kw1, kw2, kw3)_

## Features

- `features/billing.md`: `payments` · `Implemented` · <summary> _(stripe, invoices)_
```

1. Line 1 is the header. Without Node, write `<!-- Maintained by hand following the repo-overview INDEX format. -->` instead. `--check` ignores line 1, so both pass.
2. Sections: `## Core` first (if any root docs), then configured groups in config order, then other groups alphabetically. Each section: heading, blank line, entries, blank line.
3. Entries sorted by path (plain byte order). Path is relative to the overview root, in backticks, then `: `.
4. Then each of the group's `indexFields` that has a value, in backticks (lists joined with `, `), each followed by ` · ` (U+00B7 between spaces). Then the summary on one line.
5. Keywords: first `maxKeywords`, joined with `, `, as ` _(a, b)_`. Omitted when none.
6. File ends with exactly one newline; no trailing blank line.

## Script CLI

`scripts/overview-index.mjs` (Node >= 18, no dependencies; usage in its header). Optional: everything above works by hand. Exit 1 on problems, 2 on usage error or ambiguous root; warnings (INDEX over budget, map `indexFields`, `TODO(author)` count) never fail.

**Staleness.** `--stale` lists docs whose `paths` have commits after the doc's last commit, or uncommitted changes; a doc with uncommitted edits is skipped. `--stale --base REF` (PR mode) counts only commits in `merge-base(REF, HEAD)..HEAD`, and a doc changed in that range is current. A missing REF exits 2; in CI use `fetch-depth: 0`. Shallow clones warn.

**Root resolution.** `--root DIR` wins. Otherwise walk up from the current folder to the repo root; at each folder take it if it holds `overview.config.json`, else the first existing `docs/overview/`, `.overview/`, `.config/overview/` under it. Otherwise search down from the repo root (depth 4; skips `node_modules`, `.git`, `vendor`, `dist`, `build`, `Library`, `.cache`, `.local`, `.npm`, `.venv`, `target`). One hit, or a single shallowest hit, is used; otherwise pass `--root` or `--all` (every root found). Outside git with the current folder at `$HOME`, there is no down-search: pass `--root`.
