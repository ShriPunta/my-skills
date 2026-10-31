# Forges

CLI flags drift between releases; when a command fails, check `<cli> <command> --help` before falling back.

## Detect

Read the host from `git remote get-url origin` (or from the PR URL the user gave):

| Host | Forge | CLI |
| --- | --- | --- |
| `github.com`, GitHub Enterprise | GitHub | `gh` |
| `gitlab.com`, hosts with `gitlab` | GitLab | `glab` |
| `bitbucket.org` | Bitbucket Cloud | none: REST via `curl` |
| `dev.azure.com`, `*.visualstudio.com` | Azure DevOps | `az` + `azure-devops` extension |
| Gitea or Forgejo instance (Codeberg) | Gitea / Forgejo | `tea` |

Unknown self-hosted host: check `gh auth status`, `glab auth status`, and `tea logins list` for it, else ask the user.

## Install and login

| Forge | Install | Login | Auth check |
| --- | --- | --- | --- |
| GitHub | `brew install gh` (cli.github.com) | `gh auth login` | `gh auth status` |
| GitLab | `brew install glab` (gitlab.com/gitlab-org/cli) | `glab auth login` (`--hostname <host>` self-hosted) | `glab auth status` |
| Bitbucket | none | ask the user to export `BITBUCKET_TOKEN` (an API or access token with pull request read, plus write to post) | `curl` returns 200 |
| Azure DevOps | `brew install azure-cli`, then `az extension add --name azure-devops` | `az login` (or `az devops login` with a PAT) | `az account show` |
| Gitea / Forgejo | `brew install tea` (gitea.com/gitea/tea) | `tea login add` | `tea logins list` |

Other platforms: point the user to the install page instead of brew.

## Command map

`<id>` is the PR number; GitHub, GitLab, and Azure also resolve a branch (`gh pr view <branch>`, `glab mr view <branch>`, `az repos pr list --source-branch <branch>`).

**GitHub (`gh`)**
- View: `gh pr view <id> --json number,title,body,author,state,baseRefName,headRefName,headRefOid,url,files,reviewDecision`
- Diff: `gh pr diff <id>`
- Comments, reviews: `gh pr view <id> --comments`; inline: `gh api repos/{owner}/{repo}/pulls/<id>/comments`
- Checks: `gh pr checks <id>`
- Post comment: `gh pr comment <id> --body-file <file>`; edit description: `gh pr edit <id> --body-file <file>`

**GitLab (`glab`)**
- View: `glab mr view <id> --output json`
- Diff: `glab mr diff <id>`
- Comments, reviews: `glab mr view <id> --comments`
- Checks: `glab ci status --branch <head>`
- Post comment: `glab mr note <id> --message "<text>"`; edit description: `glab mr update <id> --description "<text>"`

**Bitbucket Cloud (REST)**: base `https://api.bitbucket.org/2.0/repositories/<workspace>/<repo>/pullrequests/<id>`, header `Authorization: Bearer $BITBUCKET_TOKEN`
- View: `GET <base>`; diff: `GET <base>/diff`; comments: `GET <base>/comments`; checks: `GET <base>/statuses`
- Post comment: `POST <base>/comments` with `{"content":{"raw":"<text>"}}`; edit description: `PUT <base>` with `{"description":"<text>"}`
- Bitbucket Server or Data Center: `https://<host>/rest/api/1.0/projects/<key>/repos/<slug>/pull-requests/<id>`; no token: ask the user, or use git-only mode.

**Azure DevOps (`az`)**
- View: `az repos pr show --id <id>`
- Diff: git-only mode with `sourceRefName` and `targetRefName` from view
- Comments, reviews: `az devops invoke --area git --resource pullRequestThreads --route-parameters project=<project> repositoryId=<repo> pullRequestId=<id>`
- Checks: `az repos pr policy list --id <id>`
- Post comment: the same `invoke` with `--http-method POST --in-file <thread.json>`; edit description: `az repos pr update --id <id> --description "<text>"`

**Gitea / Forgejo (`tea`)**
- View: `tea pr <id>`
- Diff: git-only mode, or `GET https://<host>/<owner>/<repo>/pulls/<id>.diff`
- Comments, reviews: `GET /api/v1/repos/<owner>/<repo>/issues/<id>/comments` and `/pulls/<id>/reviews`
- Checks: `GET /api/v1/repos/<owner>/<repo>/commits/<head-sha>/status`
- Post comment: `tea comment <id> "<text>"`; edit description: `PATCH /api/v1/repos/<owner>/<repo>/pulls/<id>` with `{"body":"<text>"}`

## Git-only mode

Covers the diff, changed files, commits, and TODOs. Description, comments, reviews, and CI status need the forge: say so in the report.

1. Fetch the head: by branch `git fetch origin <head>`; by number, the forge's PR ref:
   - GitHub, Gitea, Forgejo: `git fetch origin pull/<id>/head:pr-<id>`
   - GitLab: `git fetch origin merge-requests/<id>/head:pr-<id>`
   - Azure DevOps: `git fetch origin refs/pull/<id>/merge:pr-<id>` (merge preview)
   - Bitbucket: none; ask the user for the branch.
2. Base: the user's answer, else the default branch (`git remote show origin`).
3. Diff: `git diff origin/<base>...<head>`; files: `--name-status`; commits: `git log --oneline origin/<base>..<head>`.
