# Hooks and CI

Snippets assume `scripts/overview-index.mjs`, root `docs/overview/`, and default branch `main`; substitute the chosen values. Keep `--root` so hooks never depend on root discovery. Monorepos with several roots swap `--root <dir>` for `--all`.

## Pre-commit: regenerate the root INDEX

Commit a hooks folder and point git at it once per clone (or add the body to the existing `core.hooksPath` hook):

```sh
mkdir -p .githooks
cat > .githooks/pre-commit <<'SH'
#!/bin/sh
if [ -n "$(git diff --cached --name-only -- docs/overview/)" ]; then
  node scripts/overview-index.mjs --root docs/overview && git add -- docs/overview/INDEX.md
fi
SH
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
```

Hook managers call the same commands:

- husky: the `if` block above in `.husky/pre-commit`.
- lefthook: a `pre-commit` command with `glob: "docs/overview/**/*.md"` running the regenerate and `git add` line.
- pre-commit framework: a `local` hook, `language: system`, `files: ^docs/overview/`, `pass_filenames: false`, running `--check` (it rejects hooks that modify files).

## Pre-push: advisory staleness

Lists docs the branch may have made stale; never blocks the push.

```sh
cat > .githooks/pre-push <<'SH'
#!/bin/sh
node scripts/overview-index.mjs --root docs/overview --stale --base origin/main
exit 0
SH
chmod +x .githooks/pre-push
```

## GitHub Actions

`--check` is the hard gate. `--stale` only reports, since bug fixes and refactors touch covered paths without changing what the overview says; the agent judges which listed docs need an edit. Teams that want every touched area acknowledged by a doc edit add `--strict` to the stale step to make it fail.

`.github/workflows/overview.yml`, or the steps added to an existing pull-request workflow:

```yaml
name: overview
on: pull_request
jobs:
  overview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # --stale --base needs history back to the merge-base
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node scripts/overview-index.mjs --root docs/overview --check
      - run: node scripts/overview-index.mjs --root docs/overview --stale --base origin/${{ github.base_ref }} # report only; add --strict to gate
```

## GitLab CI

A merge-request job (`GIT_DEPTH: 0`, `node:22-alpine` plus `git`) runs `git fetch origin $CI_MERGE_REQUEST_TARGET_BRANCH_NAME`, then the same two commands (stale report only) with `--base origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME`.

## Merge conflicts in INDEX.md

`INDEX.md` is generated, so resolve a conflict by regenerating: take either side, run the script, `git add` the result. Teams with frequent conflicts drop the pre-commit hook and let a default-branch CI job regenerate and commit `INDEX.md`; their PR jobs then run `--validate` in place of `--check`.

## Optional lines

- `.gitattributes`: `docs/overview/INDEX.md text eol=lf`, so every clone produces the bytes `--check` expects.
- `CODEOWNERS` (team or `regulated` repos): `/docs/overview/ @<team that owns the repo root>`.
