## Railway Environment Variables

- **CRITICAL RULE**: NEVER override Railway's `TRIGGER_SECRET_KEY` with the local value from `.env`.
- The local `TRIGGER_SECRET_KEY` in `.env` is a development key (`tr_dev_sk_...`) meant exclusively for local testing with `npx trigger.dev@latest dev`.
- Production on Railway uses a dedicated production key.
- Whenever using the Railway skill or any command to "sync environment variables" to Railway, **ALWAYS EXCLUDE `TRIGGER_SECRET_KEY`**. Never push or overwrite Railway's production `TRIGGER_SECRET_KEY` with the local dev value.

## Hono CLI

Run `npx hono --help` first, and use the CLI instead of a dev server.

<!-- TRIGGER.DEV SKILLS START -->
## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.agents/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-authoring-chat-agent`, `trigger-chat-agent-advanced`, `trigger-realtime-and-frontend`.
<!-- TRIGGER.DEV SKILLS END -->
