---
name: jira
description: Use when the user mentions Jira issues (e.g., "PROJ-123"), asks about tickets, wants to create/view/update issues, check sprint status, or manage their Jira workflow. Triggers on keywords like "jira", "issue", "ticket", "sprint", "backlog", or issue key patterns.
---

# Jira

Natural language interaction with Jira. Supports multiple backends.

## Backend Detection

**Run this check first** to determine which backend to use:

```
1. Check if jira CLI is available:
   → Run: which jira
   → If found: USE CLI BACKEND

2. If no CLI, check for Atlassian MCP:
   → Look for mcp__atlassian__* tools
   → If available: USE MCP BACKEND

3. If neither available:
   → GUIDE USER TO SETUP
```

| Backend | When to Use | Reference |
|---------|-------------|-----------|
| **CLI** | `jira` command available | `references/commands.md` |
| **MCP** | Atlassian MCP tools available | `references/mcp.md` |
| **None** | Neither available | Guide to install CLI |

---

## Quick Reference (CLI)

> Skip this section if using MCP backend.

| Intent | Command |
|--------|---------|
| View issue | `jira issue view ISSUE-KEY` |
| List my issues | `jira issue list -a$(jira me)` |
| My in-progress | `jira issue list -a$(jira me) -s"In Progress"` |
| Create issue | `jira issue create -tType -s"Summary" -b"Description"` |
| Move/transition | `jira issue move ISSUE-KEY "State"` |
| Assign to me | `jira issue assign ISSUE-KEY $(jira me)` |
| Unassign | `jira issue assign ISSUE-KEY x` |
| Add comment | `jira issue comment add ISSUE-KEY -b"Comment text"` |
| Open in browser | `jira open ISSUE-KEY` |
| Current sprint | `jira sprint list --state active` |
| Who am I | `jira me` |

---

## Quick Reference (MCP)

> Skip this section if using CLI backend.

| Intent | MCP Tool |
|--------|----------|
| Search issues | `mcp__atlassian__searchJiraIssuesUsingJql` |
| View issue | `mcp__atlassian__getJiraIssue` |
| Create issue | `mcp__atlassian__createJiraIssue` |
| Update issue | `mcp__atlassian__editJiraIssue` |
| Get transitions | `mcp__atlassian__getTransitionsForJiraIssue` |
| Transition | `mcp__atlassian__transitionJiraIssue` |
| Add comment | `mcp__atlassian__addCommentToJiraIssue` |
| User lookup | `mcp__atlassian__lookupJiraAccountId` |
| List projects | `mcp__atlassian__getVisibleJiraProjects` |

See `references/mcp.md` for full MCP patterns.

---

## Triggers

- "create a jira ticket"
- "show me PROJ-123"
- "list my tickets"
- "move ticket to done"
- "what's in the current sprint"

---

## Issue Key Detection

Issue keys follow the pattern: `[A-Z]+-[0-9]+` (e.g., PROJ-123, ABC-1).

When a user mentions an issue key in conversation:
- **CLI:** `jira issue view KEY` or `jira open KEY`
- **MCP:** `mcp__atlassian__jira_get_issue` with the key

---

## Workflow

**Creating tickets:**
1. Research context if user references code/tickets/PRs
2. Draft ticket content
3. Review with user
4. Create using appropriate backend

**Updating tickets:**
1. Fetch issue details first
2. Check status (careful with in-progress tickets)
3. Show current vs proposed changes
4. Get approval before updating
5. Add comment explaining changes

---

## Before Any Operation

Ask yourself:

1. **What's the current state?** — Always fetch the issue first. Don't assume status, assignee, or fields are what user thinks they are.

2. **Who else is affected?** — Check watchers, linked issues, parent epics. A "simple edit" might notify 10 people.

3. **Is this reversible?** — Transitions may have one-way gates. Some workflows require intermediate states. Description edits have no undo.

4. **Do I have the right identifiers?** — Issue keys, transition IDs, account IDs. Display names don't work for assignment (MCP).

---

## NEVER

- **NEVER transition without fetching current status** — Workflows may require intermediate states. "To Do" → "Done" might fail silently if "In Progress" is required first.

- **NEVER assign using display name (MCP)** — Only account IDs work. Always call `lookupJiraAccountId` first, or assignment silently fails.

- **NEVER edit description without showing original** — Jira has no undo. User must see what they're replacing.

- **NEVER use `--no-input` without all required fields (CLI)** — Fails silently with cryptic errors. Check project's required fields first.

- **NEVER assume transition names are universal** — "Done", "Closed", "Complete" vary by project. Always get available transitions first.

- **NEVER bulk-modify without explicit approval** — Each ticket change notifies watchers. 10 edits = 10 notification storms.

---

## Safety

- Always show the command/tool call before running it
- Always get approval before modifying tickets
- Preserve original information when editing
- Verify updates after applying
- Always surface authentication issues clearly so the user can resolve them

---

## No Backend Available

If neither CLI nor MCP is available, guide the user:

```
To use Jira, you need one of:

1. **jira CLI** (recommended):
   https://github.com/ankitpokhrel/jira-cli

   Install: brew install ankitpokhrel/jira-cli/jira-cli
   Setup:   jira init

2. **Atlassian MCP**:
   Configure in your MCP settings with Atlassian credentials.
```

---

## CLI Gotchas (Lessons Learned)

These are practical lessons from real usage of the `jira` CLI that aren't in the official docs:

### Issue Creation

- **`--no-input` hangs if required fields are missing.** The flag doesn't error — it silently waits for stdin. Always provide `-t`, `-s`, `-y` (type, summary, priority) at minimum.
- **Multi-line descriptions:** Don't use `-b` with multi-line strings — the CLI mangles them. Instead, write to a temp file and use `--template /tmp/file.txt` (or `-T`).
- **`-T` (template) is the reliable way** to pass long descriptions. Write body to `/tmp/jira_body.txt` first, then pass `-T /tmp/jira_body.txt`.

### Issue Hierarchy

- **Tasks cannot be children of Stories.** Both are hierarchy level 0. To create child issues under a Story, use `-t Subtask -P PARENT-KEY`.
- **Hierarchy levels:** Epic (1) → Story/Task/Bug (0) → Subtask (-1). Only lower-level types can be children.
- **Always check project issue types** before assuming parent-child works: `curl .../rest/api/3/project/PROJ` and inspect `issueTypes[].hierarchyLevel`.

### Board Management (Kanban/Simple Boards)

- **New issues go to the backlog by default**, not the board. To move them onto the board, use the Agile REST API:
  ```
  POST /rest/agile/1.0/board/{boardId}/issue
  {"issues": ["PROJ-1", "PROJ-2"]}
  ```
- **Board IDs:** Find with `jira board list --project PROJ`. Simple boards don't have sprints.
- **Sprint commands don't work on simple/kanban boards.** `jira sprint list --project PROJ` returns "No result found" — this is expected, not an error.

### Authentication

- **Config vs token are separate.** `jira init` creates `~/.config/.jira/.config.yml` (URL + email), but the API token must be set via `JIRA_API_TOKEN` env var or `.netrc`. Config existing ≠ authenticated.
- **Shell state doesn't persist between commands.** Always `export JIRA_API_TOKEN=...` at the start of each command chain.

### REST API Fallbacks

Some operations aren't supported by the CLI and need direct REST API calls:
- Moving issues from backlog to board (Agile API)
- Setting parent on existing issues (`PUT /rest/api/3/issue/{key}` with `{"fields": {"parent": {"key": "PARENT"}}}`)
- Auth format: `-u "email:$JIRA_API_TOKEN"` (basic auth with API token as password)

---

## Deep Dive

**LOAD reference when:**
- Creating issues with complex fields or multi-line content
- Building JQL queries beyond simple filters
- Troubleshooting errors or authentication issues
- Working with transitions, linking, or sprints

**Do NOT load reference for:**
- Simple view/list operations (Quick Reference above is sufficient)
- Basic status checks (`jira issue view KEY`)
- Opening issues in browser

| Task | Load Reference? |
|------|-----------------|
| View single issue | No |
| List my tickets | No |
| Create with description | **Yes** — CLI needs `/tmp` pattern |
| Transition issue | **Yes** — need transition ID workflow |
| JQL search | **Yes** — for complex queries |
| Link issues | **Yes** — MCP limitation, need script |

References:
- CLI patterns: `references/commands.md`
- MCP patterns: `references/mcp.md`
