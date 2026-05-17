# Bunosh Skills

Agent skills for working with [Bunosh](https://buno.sh) — a task runner that turns
JavaScript functions into CLI commands.

| Skill | Use it when |
|-------|-------------|
| [`bunosh-fundamentals`](./bunosh-fundamentals) | Writing, editing, or debugging a `Bunoshfile.js`; you need to know how functions become commands, how args/options map, or how tasks behave. |
| [`migrate-to-bunosh`](./migrate-to-bunosh) | Converting existing bash scripts, npm/package.json scripts, Makefiles, or Node.js scripts into a single `Bunoshfile.js`. |

## Installation

Pick whichever fits your setup. All three install both skills.

### 1. Claude Code plugin (recommended)

This repo is a Claude Code plugin marketplace. Inside Claude Code:

```text
/plugin marketplace add DavertMik/bunosh-skills
/plugin install bunosh@bunosh-plugins
```

Updates: `/plugin marketplace update bunosh-plugins`. Skills install
namespaced as `bunosh:bunosh-fundamentals` and `bunosh:migrate-to-bunosh`.

### 2. `skills.sh`

Cross-agent installer ([skills.sh](https://skills.sh)) — works for Claude Code,
Cursor, Codex, Copilot, and more:

```bash
npx skills add DavertMik/bunosh-skills
```

### 3. `gh skill install`

Using the GitHub CLI skill extension (install per skill, user scope):

```bash
gh skill install DavertMik/bunosh-skills bunosh-fundamentals --agent claude-code --scope user
gh skill install DavertMik/bunosh-skills migrate-to-bunosh   --agent claude-code --scope user
```

Drop `--scope user` for project-local install, or `--agent <name>` to target a
different agent.

### Manual

```bash
git clone https://github.com/DavertMik/bunosh-skills.git
cp -r bunosh-skills/skills/* ~/.claude/skills/
```

After any method, restart the session (or run `/doctor`) so the skills load.

## Layout

```
bunosh-skills/
├── .claude-plugin/
│   └── marketplace.json          # lists the "bunosh" plugin
├── skills/                       # canonical skill sources
│   ├── bunosh-fundamentals/
│   │   └── SKILL.md
│   └── migrate-to-bunosh/
│       ├── SKILL.md
│       ├── references/
│       │   └── conversion-cheatsheet.md
│       └── evals/
│           └── evals.json
└── plugins/
    └── bunosh/
        ├── .claude-plugin/
        │   └── plugin.json
        └── skills/               # symlinks → ../../../skills/*
            ├── bunosh-fundamentals
            └── migrate-to-bunosh
```

`migrate-to-bunosh` depends conceptually on `bunosh-fundamentals` — install both.
