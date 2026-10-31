---
summary: "Where and how TODO(fill: PROJECT_NAME) runs, builds, ships, and where its configuration lives."
keywords: [operations, deploy, release]
source: derived
paths:
  - "TODO(fill: CI_OR_DEPLOY_CONFIG)"
---

# Operations

<!-- Rename to fit the preset (`02-setup.md`, `03-release.md`, `03-targets-and-release.md`, ...). Delete sections that do not apply. Name hosts and accounts by role ("production database"), and in regulated repos leave out hostnames, IPs, and account ids entirely. Delete this comment. -->

## Where it runs

| Component | Runs on | Notes |
| --- | --- | --- |
| TODO(fill: COMPONENT) | TODO(fill: PLATFORM_OR_MACHINE) | TODO(fill: NOTES) |

## Environments

- TODO(fill: ENVIRONMENT): TODO(fill: PURPOSE)

## Schedules and jobs

- TODO(fill: JOB): TODO(fill: WHEN_AND_WHAT_IT_DOES)

## Targets

- TODO(fill: PLATFORMS_DEVICES_OR_RUNTIMES)

## Build and release

- TODO(fill: HOW_A_CHANGE_SHIPS)

## Configuration and secrets

- Secrets live in TODO(fill: SECRETS_LOCATION). Names and location only, never values.
- Config: TODO(fill: CONFIG_FILES)

## Failure modes

- TODO(fill: WHAT_BREAKS_AND_HOW_TO_RECOVER)
