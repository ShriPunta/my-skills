# Presets

Every overview has `00-summary.md` and `01-intent.md`. A preset adds sections (file stems in config `sections`; parentheses name the template to rename) and item groups. When unsure, pick `lite`: sections can be added later.

| Preset | Signals | Sections | Group: statuses / required / indexFields |
| --- | --- | --- | --- |
| `lite` | under ~2k lines: script, CLI, dotfiles, exercises, curated list, jam, or a revived side project | none | none (INDEX optional) |
| `app` | web, mobile, desktop, game, or service; framework deps, routes, UI folders, Dockerfile | `02-stack`, `03-operations`, `roadmap`; service (one of many, `catalog-info.yaml`): + `04-context` | `features`: Planned, In progress, Implemented, Deprecated, Removed / name, status, paths / area, status |
| `library` | `exports`/`main`, `lib.rs`, no app entry, semver tags | `02-stack`, `03-release` (operations), `roadmap` | `api`: Experimental, Stable, Deprecated, Removed / name, status, paths / stability, since |
| `monorepo` | pnpm or npm workspaces, `go.work`, Cargo workspace, nx, turbo | `02-stack`, `03-operations` | `packages`: Active, Deprecated / name, status, paths / area, status |
| `platform` | Terraform, Pulumi, Helm, Ansible, CDK, many environments | `02-environments` (operations), `04-context` | `modules`: Planned, Active, Deprecated / name, status, paths / area, status |
| `docs` | docusaurus, mkdocs, vitepress, jekyll, mdbook, hugo; mostly markdown | `02-publishing` (operations) | `chapters`: Draft, Review, Published / name, status / status |
| `ml` | notebooks, `dvc.yaml`, MLflow, wandb, datasets | `02-environment` (stack), `03-operations` | `experiments`: Running, Concluded, Abandoned / name, status / status, metrics; `datasets`: Active, Retired / name / status |

`ml`: suggest `"staleIgnore": ["**/*.ipynb", "data/**"]`, and keep `metrics` a scalar or list, since `indexFields` render only those.

## Modifiers

| Modifier | Signals | Adds |
| --- | --- | --- |
| `template` | template flag, `cookiecutter.json`, `copier.yml`, "use this template" | `customize` section; `Placeholder` status |
| `fork` | `upstream` remote, "fork of" in README | `divergence` section; its `paths` list carried-change files only |
| `oss` | LICENSE plus CONTRIBUTING or CODE_OF_CONDUCT | `governance` section |
| `regulated` | user says so, compliance docs, classification labels | `denyPatterns`; no `llm-prompt-context` (opt-in elsewhere); `classification` on docs; CODEOWNERS line |
| `large` | ~50k+ lines, 20+ areas, legacy with few docs | `coverage` section; phased Init |

## Location

- **Docs site**: a root outside the published folder, such as `.overview/`. Docusaurus v3 compiles `.md` as MDX, which rejects the templates' HTML comments, so the root never sits inside its `docs/`. mkdocs: a root inside `docs/` needs an `exclude_docs` entry.
- **Dotfiles**: a dotted root such as `.overview/`, with the script inside it (`.overview/overview-index.mjs`) so nothing lands in a linked folder. chezmoi: add the root to `.chezmoiignore`. stow: add it to `.stow-local-ignore` when stowing the repo root. yadm: the work tree is `$HOME`, so use `~/.config/overview/`; git commands go through `yadm`, and the script runs inside `yadm enter`.
- **Monorepo**: one root per large package (`packages/<name>/docs/overview/`); `paths` stay repo-root-relative; hooks and CI use `--all`.
