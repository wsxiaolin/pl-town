# Server source layout

- `index.ts`: HTTP/WebSocket composition root.
- `auth.ts`: authentication and session token operations.
- `db.ts`: persistence boundary.
- `config.ts`: environment-backed server configuration.
- `types.ts`: messages and shared server-side data contracts.

Keep transport concerns in `index.ts`; persistence and authentication should
remain independently testable modules.
