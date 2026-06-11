# Siya Telegram Gateway

Control your Siya coding agent from Telegram.

## Quick Start

```bash
export OPENROUTER_API_KEY=your-key
export TELEGRAM_BOT_TOKEN=your-bot-token

siya gateway setup
siya          # main agent — Telegram gateway auto-starts by default
```

Or run the gateway alone: `siya gateway`

Pair your account:

```bash
siya pairing approve telegram <CODE>
```

## Commands

| Command | Description |
|---------|-------------|
| `siya gateway` | Start Telegram gateway |
| `siya gateway setup` | Interactive setup wizard |
| `siya gateway status` | Show config status |
| `siya pairing list telegram` | List pending pairing requests |
| `siya pairing approve telegram <CODE>` | Approve a user |

## Configuration

Global: `~/.config/siya/gateway.json`

Project override: `.agents/gateway.json`

Store secrets in `.env` (gitignored), reference as `$TELEGRAM_BOT_TOKEN` in config.

`gateway.autoStart` defaults to `true` — set `"autoStart": false` to disable auto-start with the main agent.

## Groups (owner-only)

1. Add the bot to your Telegram group and make it admin (optional but recommended).
2. Only `ownerUserId` / `allowFrom` user can invoke the bot.
3. In groups, mention the bot: `@YourBotUsername` or `@siya` + your message.
4. Other group members are ignored silently — no pairing, no replies.

## Bot commands (/)

Telegram shows **all CLI slash commands** when you type `/` (35+ commands). Type `/help` for the full list.

Highlights:

| Command | Description |
|---------|-------------|
| `/help` | Full command list (CLI parity) |
| `/new` `/clear` `/reset` | Fresh conversation |
| `/init` `/interview` `/plan` `/review` | Same workflows as CLI |
| `/mode_lite` `/mode_max` `/mode_plan` | Agent modes |
| `/bash npm test` | Run shell via agent |
| `/skill my-skill` | Invoke a project skill |
| `/schedule in 10m remind me…` | Schedule task |
| `/tasks` `/cancel_task` | Manage scheduled tasks |
| `/notify` `/feedback` | Messaging |
| `/skills` `/agents` `/pairing` | Info (owner) |

Aliases: `/h` → help, `/img` → image, `/chats` → history, `/mode:lite` → mode_lite

## ask_user on Telegram

When the agent calls `ask_user`, you get **inline buttons** in Telegram:

- Tap an option for single-select questions
- Tap multiple options, then **Done selecting** for multi-select
- **Type custom answer** then reply with text
- **Skip all** to skip the questionnaire

## Images and files

- Send a **photo** or **image file** directly to the bot (with optional caption).
- Screenshots are passed to the vision-capable agent as base64 input.
- Files are saved under `.siya/telegram-uploads/` in your project.

## Proactive messages (agent → you)

When the Telegram gateway is running, the agent can message you directly on Telegram at any time using:

| Tool | Purpose |
|------|---------|
| `notify_telegram` | Send a text message (progress, alerts, quick questions) |
| `send_telegram_file` | Send a screenshot, image, or document |

Default target is your **owner DM** (`ownerUserId`), so the agent can reach you even while you are away from the chat. Use `target: "current_chat"` to post in the active Telegram conversation instead.

Works from:

- Telegram conversations (gateway bridge)
- Siya CLI/TUI when `gateway.autoStart` is enabled and the bot is connected

Example agent behavior: *"Build failed — I'll notify you on Telegram"* → calls `notify_telegram` with the error summary.

## Live tool activity

While the agent runs, Telegram shows tool calls live, for example:

```
● Read src/app.ts
✓ Run: npm test
✓ Edit src/app.ts

---
Here is what I changed...
```

Example group config:

```json
"ownerUserId": "7498724465",
"groupPolicy": "allowlist",
"groups": { "*": { "requireMention": true, "enabled": true } },
"mentionAliases": ["siya"]
```

## Health Check

`http://127.0.0.1:8787/health`
