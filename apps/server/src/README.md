# Server source layout

- `index.ts`: HTTP/WebSocket composition root.
- `auth.ts`: authentication and session token operations.
- `db.ts`: persistence boundary.
- `config.ts`: environment-backed server configuration.
- `logger.ts`: console + file logging with daily rotation and level filtering.
- `types.ts`: messages and shared server-side data contracts.

Keep transport concerns in `index.ts`; persistence and authentication should
remain independently testable modules.
