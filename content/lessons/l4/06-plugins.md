---
slug: l4-plugins
level: 4
sort: 6
title: "Plugins: package and share a team setup"
objective: "Bundle skills, commands, hooks and MCP servers into one versioned plugin, share it from a team marketplace in a git repo, enable it per project, and decide whether to trust a plugin before it runs on your machine."
est_minutes: 45
tool_versions:
  claude_code: "2.1.287"
  codex_cli: "0.154.0"
last_verified_on: "2026-10-02"
differences:
  - "Manifest and layout: Claude Code reads `.claude-plugin/plugin.json` plus `skills/`, `commands/`, `agents/`, `hooks/hooks.json` and `.mcp.json` at the plugin root. Codex's current format is a root `plugin.json` (Agent Plugins schema) with `skills/` and `mcp.json`, and OpenAI-specific settings under `extensions.com.openai`. The older `.codex-plugin/plugin.json` still works. On 0.154.0, `codex plugin add` also installs a Claude-style `.claude-plugin/plugin.json` plugin."
  - "Components: a Claude Code plugin can bundle skills, commands, subagents, hooks, MCP servers and more. The Codex docs list skills, MCP servers, apps, hooks and browser extensions, and no commands or subagents, so treat commands as Claude Code only."
  - "Marketplace: Claude Code uses `.claude-plugin/marketplace.json` and `claude plugin marketplace add owner/repo`. Codex uses `.agents/plugins/marketplace.json` (it also read a `.claude-plugin/marketplace.json` here) and `codex plugin marketplace add owner/repo`. A Codex entry also needs a `policy` and a `category`."
  - "Per-project enabling: Claude Code commits `extraKnownMarketplaces` and `enabledPlugins` in `.claude/settings.json`. Codex sets `[plugins.\"name@marketplace\"] enabled = true` in the project's `.codex/config.toml`, which it loads only for trusted projects."
  - "Trust and pinning: both run plugin hooks with your permissions, so read them first. Claude Code pins by `version` in the manifest or by `ref` and `sha` on a git source. Codex git sources take `ref` or `sha`, and `--ref` on `marketplace add`. Codex skips a plugin's hooks until you review and trust them in `/hooks`."
exercise: ex-4-6-plugin
claude_no_equivalent: false
codex_no_equivalent: false
tldr:
  points:
    - "Package skills, hooks and MCP servers as one versioned plugin your team installs."
    - "Share it from a team marketplace in a git repo, and enable it per project."
    - "Read a plugin's hooks before you install it; they run with your permissions."
  try_this:
    claude: { kind: command, text: "claude plugin marketplace list" }
    codex: { kind: command, text: "codex plugin list" }
---

## Concept

By lesson 4.5 you have skills, and by 4.4 hooks. Each works on its own, in one repo, committed under `.claude/` or `.agents/`. That is the right place to start. The problem shows up on the third client repo: you copy the same format hook and the same four skills again, and a fix in one copy never reaches the others.

A **plugin** is the fix: a folder that bundles those pieces, with a manifest that names and versions it, so you install it once and update it from one place.

**What a plugin can bundle.** In Claude Code:

- **Skills** and **commands** (commands are the older, flat form of skills).
- **Subagents.**
- **Hooks.**
- **MCP servers.**

Claude Code plugins can also carry things such as LSP servers and output styles. A Codex plugin bundles skills, MCP servers, apps and hooks, per the Codex docs. Installing a plugin enables all of its parts at once, in every session.

**Namespacing.** A plugin's skills are called `/plugin-name:skill-name`, so two plugins can both ship a `review` skill without colliding.

**Plugin, marketplace, install.** Three separate things:

- A **plugin** is the folder.
- A **marketplace** is a catalog: a JSON file in a repo that lists plugins and where to fetch each. It is not a hosted store; a git repo is enough.
- **Installing** a plugin copies it from a marketplace into your machine and enables it for you, for one repo, or for everyone on the repo.

```diagram
type: flow
id: plugin-path
title: How a team plugin reaches every engineer
summary: The team repo holds the catalog. Each engineer adds it and installs the plugin, and the repo's committed settings enable it, so its skills, hooks and servers load in the next session.
steps:
  - id: repo
    label: Team repo
    sub: the catalog
    next: add
  - id: machine
    label: Installed
    sub: per machine
    next: enable
  - id: project
    label: Enabled
    sub: per repo
    next: start
  - id: session
    label: Loaded
    sub: next session
    emphasis: true
```

**Versions.** If the manifest sets a `version`, people keep the copy they have until you change it. Push new commits without bumping the version and nobody gets them. Leave `version` out and every new commit counts as an update. Pick one and say which in the plugin's README. For a controlled rollout you can also point a marketplace entry at a branch, tag or exact commit.

**A plugin runs code as you.** This is the part to take seriously. Hooks are shell commands, MCP servers are processes, and both run with your user permissions, outside the sandbox. Skills, commands and agents are text, but they steer an agent that has your tools. So:

1. Read a plugin before you install it: its hooks, its MCP config, and anything it puts on your `PATH`.
2. Know who publishes the marketplace. A marketplace's name tells you who publishes the catalog, not what each plugin does.
3. Remember that updates change the files you reviewed. Pin a version, a tag or a commit for anything third-party, and keep auto-update off for it.
4. Do not let a plugin you have not read into a client repo.

### First Mate tip

Build one team plugin, `first-mate`, and keep it in a private `first-mate-plugins` repo. Put in it what every engagement needs: the format-on-edit and block-`rm -rf` hooks from 4.4, the `new-api-route`, `review-migration` and `release-notes` skills from 4.4 and 4.5, and a `/first-mate:changelog` command. Each client repo then commits two lines of settings instead of copying files, and a fix to the hook ships once. Pin the version, and review plugin PRs like production code, because the hooks run on every engineer's laptop with their credentials. Keep client names, tokens and URLs out of the plugin: it is shared across clients.

## Claude Code

### Layout and manifest

A plugin is a folder. The manifest goes in `.claude-plugin/`, and everything else sits at the plugin root:

```text
first-mate/
├── .claude-plugin/
│   └── plugin.json        manifest (only this file goes in here)
├── skills/
│   └── review-migration/
│       └── SKILL.md
├── commands/
│   └── changelog.md       flat command file (skills/ is preferred for new work)
├── agents/                subagent .md files
├── hooks/
│   └── hooks.json         hook config, same shape as "hooks" in settings
├── scripts/
│   └── format.sh          what the hook calls
└── .mcp.json              MCP servers
```

Add only the folders you use. Anything you save inside `.claude-plugin/` other than `plugin.json` does not load. `claude plugin validate` does not flag it either: the plugin loads with fewer components, and `claude plugin details <name>` shows the count (for example `Skills (0)`).

**`.claude-plugin/plugin.json`**

```json
{
  "name": "first-mate",
  "version": "1.0.0",
  "description": "First Mate's standard hooks and skills",
  "author": { "name": "First Mate" }
}
```

Only `name` is required. Use kebab-case, with no spaces. The name prefixes every skill and agent. The validator rejects names that pass as Anthropic's own: a name starting `claude-`, `anthropic-`, `anthropics-` or `cc-plugin-`; the names `claude`, `anthropic`, `anthropics`, `claude-code` and `claude-mods`; and a name that puts `official` beside `claude` or `anthropic`.

**`hooks/hooks.json`** has a top-level `hooks` key. Refer to bundled scripts with `${CLAUDE_PLUGIN_ROOT}`, which is the install path, and quote it:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/format.sh\"" }
        ]
      }
    ]
  }
}
```

A hook defined both in a plugin and in a settings file runs twice, because hooks are not namespaced.

### Build and test it

You do not need a marketplace to develop a plugin:

```bash
claude plugin validate ./first-mate     # manifest, plus frontmatter of every skill, agent and command
claude --plugin-dir ./first-mate        # load it for this session only
```

Inside the session, `/reload-plugins` applies edits to the folder. `/plugin` opens the manager: **Installed** shows your plugin and the components Claude Code found, and **Errors** lists what failed to load, for example a path that does not exist. In your shell, `claude plugin details first-mate` prints the component inventory and the token cost the plugin adds to every session. To turn a folder of `.claude/` files into a plugin, copy the folders to the plugin root and move the `hooks` object from settings into `hooks/hooks.json`; delete the originals afterwards, or the hooks run twice.

### A team marketplace in a git repo

A marketplace is a repo with `.claude-plugin/marketplace.json` that lists its plugins:

```text
first-mate-plugins/
├── .claude-plugin/
│   └── marketplace.json
└── plugins/
    └── first-mate/          the plugin above
```

```json
{
  "name": "first-mate-team",
  "description": "First Mate's shared Claude Code setup",
  "owner": { "name": "First Mate" },
  "plugins": [
    {
      "name": "first-mate",
      "source": "./plugins/first-mate",
      "description": "Standard hooks and skills"
    }
  ]
}
```

`name`, `owner` and `plugins` are required. Write a relative `source` from the marketplace root, starting with `./` and without `..`. The entry `name` must equal the `name` in the plugin's own `plugin.json`, or installs by name fail. A plugin that lives in another repo uses a source object instead, such as `{ "source": "github", "repo": "YOUR-ORG/some-plugin" }`.

Run `claude plugin validate .` in the marketplace repo, push it to a private repo, and teammates add it once:

```bash
claude plugin marketplace add YOUR-ORG/first-mate-plugins     # or /plugin marketplace add ... in a session
claude plugin install first-mate@first-mate-team              # or /plugin install first-mate@first-mate-team
```

In a session, `/plugin install` opens the plugin's details so you can read what it adds (the "Will install" list) and choose a scope. Claude Code runs `git` with your own credentials and never prompts, so a private repo needs SSH or a stored credential (`gh auth login` then `gh auth setup-git`). A marketplace you add gets no auto-update by default; turn it on per marketplace in `/plugin`, in the **Marketplaces** tab, or update by hand with `claude plugin update first-mate@first-mate-team`.

### Scopes and enabling per project

Every install has a scope: `user` (you, every project), `project` (everyone on the repo, in the committed `.claude/settings.json`) or `local` (you, this repo only, in `.claude/settings.local.json`). Local overrides project, and project overrides user. The `claude plugin marketplace add` and `claude plugin install` commands take `--scope`:

```bash
claude plugin marketplace add YOUR-ORG/first-mate-plugins --scope project
claude plugin install first-mate@first-mate-team --scope project
```

That writes this to the client repo's `.claude/settings.json`, which you commit:

```json
{
  "extraKnownMarketplaces": {
    "first-mate-team": { "source": { "source": "github", "repo": "YOUR-ORG/first-mate-plugins" } }
  },
  "enabledPlugins": { "first-mate@first-mate-team": true }
}
```

A teammate who opens the repo gets a trust prompt for the folder. `extraKnownMarketplaces` applies only after they accept it. A plugin the marketplace lists by relative path then loads from the marketplace copy. If the plugin comes from an external source, or Claude Code reports `Plugin ... is enabled in project settings but isn't installed here`, the teammate runs `claude plugin install first-mate@first-mate-team --scope project` once. On a Team or Enterprise plan, admins can instead require marketplaces and plugins for everyone in managed settings.

### Version and release

Bump `version` in `plugin.json` for each release (set it in the manifest or in the marketplace entry, not both: the manifest wins and the validator flags the mismatch), run `claude plugin validate .`, and tag it with `claude plugin tag`, which creates a `first-mate--v1.1.0` tag and checks that the manifest and the marketplace entry agree. To hold a plugin at a known state, give its entry a `ref` (branch or tag) or a 40-character `sha`, or have users add the marketplace as `YOUR-ORG/first-mate-plugins#stable`. For stable and early-access tracks, host two marketplaces whose entries point at different refs. If you rename a plugin, add it to a `renames` map in `marketplace.json`, or every existing install breaks.

### Trust and security

- `/plugin` shows a plugin's details before you install: what it will add (commands, agents, skills, hooks, MCP servers), and for Anthropic's official marketplace a context-cost estimate. The list shows that a hook exists, not what it runs: open `hooks/hooks.json`, `.mcp.json` and `bin/` in the source.
- `claude plugin marketplace list` shows where each marketplace came from. `claude --plugin-dir <folder> plugin details <name>` prints a plugin's component inventory from a clone, before you install it.
- Claude Code does not sandbox hooks or MCP server processes. A plugin's `bin/` folder is added to the `PATH` of the Bash tool.
- Only a few marketplace names are Anthropic's; a marketplace your coworker or your company publishes is third-party. Claude Code accepts an official name only from `github.com/anthropics/` repos.
- A marketplace entry can pin an `archive` source to a `sha256`, and Claude Code then refuses a changed download.
- Remove what you stop trusting with `claude plugin uninstall <plugin>`, and `claude plugin marketplace remove <name>` to drop a marketplace and its plugins.

## Codex CLI

Codex has plugins and marketplaces in 0.154.0: `codex plugin` has `add`, `list`, `remove` and `marketplace` (with `add`, `list`, `upgrade` and `remove`), and `/plugins` opens a plugin browser in the CLI.

### Layout and manifest

A Codex plugin bundles skills and MCP servers, and can add hooks and apps. The current portable layout is a `plugin.json` at the plugin root:

```text
first-mate/
├── plugin.json          manifest (Agent Plugins schema)
├── skills/
│   └── review-migration/
│       └── SKILL.md
├── mcp.json             MCP servers, optional
└── hooks/
    └── hooks.json       lifecycle hooks, optional
```

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "first-mate",
  "version": "1.0.0",
  "description": "First Mate's standard hooks and skills"
}
```

Codex-specific settings (display metadata, the hooks path, registered app mappings) go under `extensions.com.openai` in the same file. The older `.codex-plugin/plugin.json` still works, and `$plugin-creator` scaffolds it. The docs do not list plugin commands or subagents, so do not put a command in a plugin and expect Codex to run it.

Plugin hook commands get `PLUGIN_ROOT` and `PLUGIN_DATA` in their environment, and Codex also sets `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` for compatibility with plugins written for Claude Code.

### A team marketplace

A marketplace is `.agents/plugins/marketplace.json`, in a repo or in your home folder. Point each entry at a plugin folder with a `./` path relative to the marketplace root:

```json
{
  "name": "first-mate-team",
  "plugins": [
    {
      "name": "first-mate",
      "source": { "source": "local", "path": "./plugins/first-mate" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Productivity"
    }
  ]
}
```

Git sources use `"source": "url"` or `"git-subdir"` with a `ref` or `sha`. Push the repo, then add it and install:

```bash
codex plugin marketplace add YOUR-ORG/first-mate-plugins            # owner/repo[@ref], a Git URL, or a local path
codex plugin marketplace add YOUR-ORG/first-mate-plugins --ref v1.0.0   # pin a ref
codex plugin list                                                   # shows installed or not, and the version
codex plugin add first-mate@first-mate-team
codex plugin marketplace upgrade                                    # refresh Git marketplace snapshots
```

On 0.154.0, adding a local marketplace and running `codex plugin add` installs the plugin, `codex plugin list` reports `installed, enabled`, and Codex writes `[marketplaces.first-mate-team]` and `[plugins."first-mate@first-mate-team"]` entries to `config.toml`. The same works for a plugin with a `.claude-plugin/plugin.json` listed in a `.claude-plugin/marketplace.json`, so a skills-only plugin can serve both tools from one repo. Installed skills become available in a new session, and `/plugins` in the CLI browses marketplaces, installs and uninstalls, and toggles a plugin with the space bar.

### Enabling per project

A marketplace only makes plugins discoverable. To turn one on for a repo, set it in the project's `.codex/config.toml`:

```toml
[plugins."first-mate@first-mate-team"]
enabled = true
```

The key is `plugin-name@marketplace-name`. Codex loads project `.codex/config.toml` only for trusted projects, and `enabled = false` disables the plugin for the project without uninstalling it.

### Trust and security

- A plugin's hooks are non-managed hooks. Installing or enabling a plugin does not trust them: Codex skips them until you review and trust the current definition in `/hooks`. Read the hook scripts first.
- MCP servers a plugin bundles can be switched off, or have their approval mode tuned, from your own config under `plugins.<plugin>.mcp_servers.<server>`, without editing the plugin.
- Pin what you do not control: `--ref` on `marketplace add`, and `ref` or `sha` on a marketplace entry's git source. A npm source takes a `version` or range, and Codex downloads the package without running lifecycle scripts.
- Remove with `codex plugin remove first-mate@first-mate-team` and `codex plugin marketplace remove first-mate-team`.

### If you only need the skills

If a Codex repo needs nothing but shared skills, you do not need a plugin: commit `.agents/skills/` (lesson 4.5), or keep the skills in one repo and copy or symlink them into each project. Use a plugin when you want versioned installs, bundled MCP servers or hooks, or one install for the whole team.
