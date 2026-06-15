---
name: Capability Development
description: Use when adding new AI capabilities to OWNAI — backend handlers, API routes, frontend cards, and plugin commands.
version: 1.0.0
---

# Capability Development Skill

## Plugin Structure (OWNAI format)

```
plugin-name/
├── .ownai-plugin/plugin.json
├── commands/*.md      # Phase-based workflows
├── agents/*.md        # Specialist agents
├── skills/*/SKILL.md  # Auto-invoked guidance
├── hooks/hooks.json   # Lifecycle hooks
└── README.md
```

## Command File Format

```markdown
---
description: One-line summary
argument-hint: Args description
---

# Command Title

## Phase 1: ...
## Phase 2: ...
```

## Agent File Format

```markdown
---
name: agent-name
description: When to use this agent
color: cyan
---

System prompt body...
```

## Never copy external repos — adapt the format, write original implementations.
