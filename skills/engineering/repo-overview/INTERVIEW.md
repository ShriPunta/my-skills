# Author interview

Code shows what and how; only the author knows why, what success means, and what is out of scope.

## 1. Ingest

Read existing docs, ADRs, `CODEOWNERS`, `catalog-info.yaml`, and recent `git log` first, so each question carries a drafted answer.

## 2. Ask once

One message, every question with its draft marked as a guess. Open with:

> Answer any you like. Reply "skip" or "I don't remember" and I will mark it open instead of guessing.

Core (lite asks only these): why does this exist; what does success look like; what is out of scope on purpose. Full presets add principles, audience, and known gaps. Add the extras that apply, ten questions max in total:

| When | Ask |
| --- | --- |
| app | users; business outcome. Service: owner team, on-call, SLOs, catalog entry |
| library | audience; stability and deprecation policy |
| monorepo | packages that matter most; owner per package |
| platform, regulated | owner team; escalation path; data classification |
| lite | the pain it removes; what must never break. Dotfiles: machines, OSes, secrets location |
| docs | audience; voice; publish target |
| ml | hypotheses; metric of record; data licence and provenance |
| template | what consumers replace; what they keep |
| fork | why fork; upstream sync policy |
| oss | maintainers; decision process |
| last commit 6+ months ago | why it paused; where you left off; still worth it |

## 3. Record

- Each answer goes to the doc that owns it: intent to `01-intent.md`, ownership and SLOs to `04-context.md`, revival answers to "Where I left off" in `00-summary.md`.
- An accepted or edited draft is an answer. A skipped question becomes `TODO(author): <question>` in its section.
- `source: author` for answer-only docs, `mixed` where answers share a doc with derived facts. `confirmed: <today>` on docs the author answered or confirmed; a doc holding only `TODO(author)` lines drops `confirmed`.

Done when every question has an answer or a `TODO(author)` line.
