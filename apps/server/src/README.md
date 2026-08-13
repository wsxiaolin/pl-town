# Server source layout

- `index.ts`: HTTP/WebSocket composition root.
- `auth.ts`: authentication and session token operations.
- `db.ts`: persistence boundary.
- `config.ts`: environment-backed server configuration.
- `logger.ts`: console + file logging with daily rotation and level filtering.
- `types.ts`: messages and shared server-side data contracts.
- `adminAuth.ts` / `adminRouter.ts`: cookie/CSRF administration boundary and routes.
- `backup.ts` / `backupVerifier.ts`: online backups, manifest, retention, and worker verification.
- `restoreBackup.ts` / `runtimeLock.ts`: offline restore and exclusive data-directory ownership.
- `requestSecurity.ts` / `httpBody.ts` / `rateLimit.ts`: transport security helpers.

Keep transport concerns in `index.ts`; persistence and authentication should
remain independently testable modules.

## Story progress protocol

Story content, display text, and branching rules live in the web client. The
server only persists small, reusable progress records keyed by resident and
story ID:

- `story.get`: `{ storyId }` creates/returns the record.
- `story.update`: `{ storyId, nodeId?, flags?, ending?, visit? }` atomically
  merges flags, replaces supplied node/ending values, and increments
  `visitCount` when `visit` is true.
- Both commands reply with `story.updated`; inspect `event.type` to distinguish
  `story.loaded` from `story.updated`.

IDs and flag keys use portable ASCII identifiers. Flag values are intentionally
limited to JSON primitives so story state stays compact and versionable while
all authored content remains client-side.
