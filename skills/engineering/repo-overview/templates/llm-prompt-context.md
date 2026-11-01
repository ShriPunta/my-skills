---
summary: "Copy-paste prompt that gives any LLM the context of TODO(fill: PROJECT_NAME) before a task."
keywords: [prompt, context, llm]
source: derived
---

# LLM prompt context

Paste the block below into any LLM chat, then replace the task line.

```text
## Context
TODO(fill: PROJECT_NAME): TODO(fill: ONE_LINE_PITCH)
Read TODO(fill: OVERVIEW_ROOT)/INDEX.md first, then open only the overview files relevant to the task.
Stack: TODO(fill: STACK_ONE_LINE)

## Current state
TODO(fill: STATUS)

## Task
<describe your task here>
```
